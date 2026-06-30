import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  AssetManifestSchema,
  StoryCatalogSchema,
  StorySchema,
  type AssetManifest,
  type Story
} from "../src/engine/schema";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicRoot = path.join(repoRoot, "public");
const catalogPath = path.join(publicRoot, "game/catalog.json");

type AssetRef = { kind: "image" | "audio"; id: string; where: string };

async function main() {
  const catalog = StoryCatalogSchema.parse(await readJson(catalogPath));
  const errors: string[] = [];
  const summaries: string[] = [];

  for (const entry of catalog.stories) {
    const story = StorySchema.parse(await readJson(resolvePublicFile(entry.storyUrl)));
    const manifest = AssetManifestSchema.parse(await readJson(resolvePublicFile(entry.manifestUrl)));
    const refs = collectAssetRefs(story);

    if (story.id !== entry.id) {
      errors.push(`Catalog entry '${entry.id}' points to story id '${story.id}'. These ids should match.`);
    }

    for (const ref of refs) {
      if (ref.kind === "image" && !manifest.images[ref.id]) {
        errors.push(`Missing image asset '${ref.id}' used at ${story.id}:${ref.where}`);
      }
      if (ref.kind === "audio" && !manifest.audio[ref.id]) {
        errors.push(`Missing audio asset '${ref.id}' used at ${story.id}:${ref.where}`);
      }
    }

    await validateAssetFiles(manifest, errors);
    summaries.push(`'${story.title}' has ${story.nodes.length} nodes and ${refs.length} asset references`);
  }

  if (errors.length > 0) {
    console.error("Story validation failed:\n" + errors.map((error) => `  - ${error}`).join("\n"));
    process.exitCode = 1;
    return;
  }

  console.log(`OK: catalog has ${catalog.stories.length} stories.`);
  for (const summary of summaries) {
    console.log(`  - ${summary}`);
  }
}

async function readJson(filePath: string): Promise<unknown> {
  return JSON.parse(await readFile(filePath, "utf-8"));
}

function resolvePublicFile(src: string): string {
  return path.join(publicRoot, src.replace(/^\//, ""));
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
    try {
      await stat(resolvePublicFile(src));
    } catch {
      errors.push(`Missing ${kind} file for '${id}': ${src}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
