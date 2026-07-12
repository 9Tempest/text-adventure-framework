import { describe, expect, it } from "vitest";
import { StoryCatalogSchema, StorySchema } from "./schema";

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

describe("StorySchema", () => {
  it("accepts presentation and cinematic node metadata", () => {
    const story = StorySchema.parse({
      version: 1,
      id: "story",
      title: "Story",
      startNode: "start",
      presentation: {
        kicker: "A quiet transmission",
        clueLabels: { clue_light: { label: "Light", glyph: "◌" } }
      },
      nodes: [
        {
          id: "start",
          chapter: "Prologue",
          location: "Below the tower",
          layer: "reality",
          progress: 0,
          steps: [{ type: "line", text: "Listen." }]
        }
      ]
    });

    expect(story.presentation?.clueLabels?.clue_light.label).toBe("Light");
    expect(story.nodes[0].layer).toBe("reality");
  });

  it("rejects duplicate node ids", () => {
    expect(() =>
      StorySchema.parse({
        version: 1,
        id: "story",
        title: "Story",
        startNode: "same",
        nodes: [
          { id: "same", steps: [] },
          { id: "same", steps: [] }
        ]
      })
    ).toThrow(/unique/);
  });
});
