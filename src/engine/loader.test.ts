import { describe, expect, it } from "vitest";
import { resolvePublicUrl } from "./loader";

describe("resolvePublicUrl", () => {
  it("keeps root URLs unchanged during local development", () => {
    expect(resolvePublicUrl("/game/catalog.json", "/")).toBe("/game/catalog.json");
  });

  it("places public assets below the GitHub Pages project path", () => {
    expect(resolvePublicUrl("/game/story/demo.story.json", "/text-adventure-framework/")).toBe(
      "/text-adventure-framework/game/story/demo.story.json"
    );
  });

  it("does not rewrite external or already-prefixed URLs", () => {
    expect(resolvePublicUrl("https://cdn.example.com/score.ogg", "/text-adventure-framework/")).toBe(
      "https://cdn.example.com/score.ogg"
    );
    expect(resolvePublicUrl("/text-adventure-framework/game/catalog.json", "/text-adventure-framework/")).toBe(
      "/text-adventure-framework/game/catalog.json"
    );
  });
});
