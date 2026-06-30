import { AssetManifestSchema, StorySchema, type AssetManifest, type Story } from "./schema";

export type LoadedGameContent = {
  story: Story;
  assets: AssetManifest;
};

export async function loadGameContent(
  storyUrl = "/game/story/main.story.json",
  manifestUrl = "/game/assets/manifest.json"
): Promise<LoadedGameContent> {
  const [storyRaw, manifestRaw] = await Promise.all([
    fetchJson(storyUrl),
    fetchJson(manifestUrl)
  ]);

  return {
    story: StorySchema.parse(storyRaw),
    assets: AssetManifestSchema.parse(manifestRaw)
  };
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return response.json();
}
