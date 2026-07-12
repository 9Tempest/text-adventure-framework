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
  id: "yun-chapter1",
  title: "折光三则：第一则 画页之城",
  storyUrl: "/game/story/yun-chapter1.story.json",
  manifestUrl: "/game/assets/manifest.json"
};

export async function loadStoryCatalog(catalogUrl = "/game/catalog.json"): Promise<StoryCatalog> {
  return StoryCatalogSchema.parse(await fetchJson(resolvePublicUrl(catalogUrl)));
}

export function getDefaultStoryEntry(catalog: StoryCatalog): StoryCatalogEntry {
  return catalog.stories.find((story) => story.id === catalog.defaultStory) ?? catalog.stories[0];
}

export async function loadGameContent(entry: StoryCatalogEntry = DEFAULT_STORY_ENTRY): Promise<LoadedGameContent> {
  const [storyRaw, manifestRaw] = await Promise.all([
    fetchJson(resolvePublicUrl(entry.storyUrl)),
    fetchJson(resolvePublicUrl(entry.manifestUrl))
  ]);

  const manifest = AssetManifestSchema.parse(manifestRaw);

  return {
    story: StorySchema.parse(storyRaw),
    assets: {
      ...manifest,
      images: Object.fromEntries(
        Object.entries(manifest.images).map(([id, asset]) => [id, { ...asset, src: resolvePublicUrl(asset.src) }])
      ),
      audio: Object.fromEntries(
        Object.entries(manifest.audio).map(([id, asset]) => [id, { ...asset, src: resolvePublicUrl(asset.src) }])
      )
    },
    catalogEntry: entry
  };
}

export function resolvePublicUrl(url: string, baseUrl = import.meta.env.BASE_URL): string {
  if (/^(?:[a-z]+:)?\/\//i.test(url) || /^(?:data|blob):/i.test(url)) {
    return url;
  }

  const normalizedBase = `/${baseUrl.replace(/^\/+|\/+$/g, "")}/`.replace("//", "/");
  if (normalizedBase !== "/" && url.startsWith(normalizedBase)) {
    return url;
  }
  return `${normalizedBase}${url.replace(/^\/+/, "")}`;
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return response.json();
}
