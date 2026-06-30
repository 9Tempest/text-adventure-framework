import { describe, expect, it } from "vitest";
import { StorySchema } from "./schema";
import { RuntimeEngine } from "./runtime";

const story = StorySchema.parse({
  version: 1,
  id: "test-story",
  title: "Test Story",
  startNode: "start",
  variables: { trust: 0 },
  characters: [],
  nodes: [
    {
      id: "start",
      steps: [
        { type: "line", text: "hello" },
        { type: "inc", key: "trust", by: 1 }
      ],
      choices: [
        { id: "go", text: "Go", target: "end", conditions: [{ key: "trust", op: "gte", value: 1 }] }
      ]
    },
    {
      id: "end",
      steps: [{ type: "line", text: "done" }]
    }
  ]
});

describe("RuntimeEngine", () => {
  it("advances lines, applies actions, and reveals conditional choices", () => {
    const engine = new RuntimeEngine(story);
    expect(engine.snapshot().currentLine?.text).toBe("hello");

    const afterLine = engine.continue();
    expect(afterLine.variables.trust).toBe(1);
    expect(afterLine.availableChoices).toHaveLength(1);

    const afterChoice = engine.choose("go");
    expect(afterChoice.nodeId).toBe("end");
    expect(afterChoice.currentLine?.text).toBe("done");
  });
});
