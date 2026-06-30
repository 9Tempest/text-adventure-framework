import {
  AssetManifestSchema,
  StoryCatalogSchema,
  StorySchema,
  type AssetManifest,
  type Story,
  type StoryCatalog,
  type StoryCatalogEntry
} from "./schema";

export type LoadedGameContent = {
  story: Story;
  assets: AssetManifest;
  catalogEntry: StoryCatalogEntry;
};

const DEFAULT_STORY_ENTRY: StoryCatalogEntry = {
  id: "shadow-letters-demo",
  title: "暗线：序章 Demo",
  storyUrl: "/game/story/shadow-letters-demo.story.json",
  manifestUrl: "/game/assets/manifest.json"
};

export async function loadStoryCatalog(catalogUrl = "/game/catalog.json"): Promise<StoryCatalog> {
  return StoryCatalogSchema.parse(await fetchJson(catalogUrl));
}

export function getDefaultStoryEntry(catalog: StoryCatalog): StoryCatalogEntry {
  return catalog.stories.find((story) => story.id === catalog.defaultStory) ?? catalog.stories[0];
}

export async function loadGameContent(entry: StoryCatalogEntry = DEFAULT_STORY_ENTRY): Promise<LoadedGameContent> {
  const [storyRaw, manifestRaw] = await Promise.all([
    fetchJson(entry.storyUrl),
    fetchJson(entry.manifestUrl)
  ]);

  return {
    story: StorySchema.parse(storyRaw),
    assets: AssetManifestSchema.parse(manifestRaw),
    catalogEntry: entry
  };
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return response.json();
}
