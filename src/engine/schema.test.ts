import { describe, expect, it } from "vitest";
import { StoryCatalogSchema } from "./schema";

describe("StoryCatalogSchema", () => {
  it("requires the default story to exist in the catalog", () => {
    expect(() =>
      StoryCatalogSchema.parse({
        version: 1,
        defaultStory: "missing",
        stories: [
          {
            id: "demo",
            title: "Demo",
            storyUrl: "/game/story/demo.story.json",
            manifestUrl: "/game/assets/manifest.json"
          }
        ]
      })
    ).toThrow(/defaultStory/);
  });
});
