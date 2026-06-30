import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AssetManifestSchema, StorySchema, type AssetManifest, type Story } from "../src/engine/schema";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicRoot = path.join(repoRoot, "public");
const storyPath = path.join(publicRoot, "game/story/main.story.json");
const manifestPath = path.join(publicRoot, "game/assets/manifest.json");

type AssetRef = { kind: "image" | "audio"; id: string; where: string };

async function main() {
  const story = StorySchema.parse(await readJson(storyPath));
  const manifest = AssetManifestSchema.parse(await readJson(manifestPath));

  const refs = collectAssetRefs(story);
  const errors: string[] = [];

  for (const ref of refs) {
    if (ref.kind === "image" && !manifest.images[ref.id]) {
      errors.push(`Missing image asset '${ref.id}' used at ${ref.where}`);
    }
    if (ref.kind === "audio" && !manifest.audio[ref.id]) {
      errors.push(`Missing audio asset '${ref.id}' used at ${ref.where}`);
    }
  }

  await validateAssetFiles(manifest, errors);

  if (errors.length > 0) {
    console.error("Story validation failed:\n" + errors.map((error) => `  - ${error}`).join("\n"));
    process.exitCode = 1;
    return;
  }

  console.log(`OK: '${story.title}' has ${story.nodes.length} nodes and ${refs.length} asset references.`);
}

async function readJson(filePath: string): Promise<unknown> {
  return JSON.parse(await readFile(filePath, "utf-8"));
}

function collectAssetRefs(story: Story): AssetRef[] {
  const refs: AssetRef[] = [];
  for (const node of story.nodes) {
    if (node.scene?.background) {
      refs.push({ kind: "image", id: node.scene.background, where: `${node.id}.scene.background` });
    }
    if (node.scene?.music) {
      refs.push({ kind: "audio", id: node.scene.music, where: `${node.id}.scene.music` });
    }
    if (node.scene?.ambience) {
      refs.push({ kind: "audio", id: node.scene.ambience, where: `${node.id}.scene.ambience` });
    }
    for (const character of node.scene?.characters ?? []) {
      refs.push({ kind: "image", id: character.image, where: `${node.id}.scene.characters.${character.character}` });
    }
    for (const step of node.steps) {
      if (step.type === "line") {
        if (step.voice) {
          refs.push({ kind: "audio", id: step.voice, where: `${node.id}.line.voice` });
        }
        if (step.portrait) {
          refs.push({ kind: "image", id: step.portrait, where: `${node.id}.line.portrait` });
        }
      }
      if (step.type === "sfx") {
        refs.push({ kind: "audio", id: step.audio, where: `${node.id}.sfx` });
      }
    }
  }
  return refs;
}

async function validateAssetFiles(manifest: AssetManifest, errors: string[]): Promise<void> {
  const entries = [
    ...Object.entries(manifest.images).map(([id, asset]) => ["image", id, asset.src] as const),
    ...Object.entries(manifest.audio).map(([id, asset]) => ["audio", id, asset.src] as const)
  ];

  for (const [kind, id, src] of entries) {
    const filePath = path.join(publicRoot, src.replace(/^\//, ""));
    try {
      await stat(filePath);
    } catch {
      errors.push(`Missing ${kind} file for '${id}': ${src}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
