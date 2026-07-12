import { describe, expect, it } from "vitest";
import { getTextVoiceProfile } from "./audio";

describe("text voice profiles", () => {
  it("maps the same speaker to a stable profile", () => {
    expect(getTextVoiceProfile("luming")).toEqual(getTextVoiceProfile("luming"));
  });

  it("gives speakers distinct, restrained text voices", () => {
    const luming = getTextVoiceProfile("luming");
    const monitor = getTextVoiceProfile("monitor_voice");

    expect(luming).not.toEqual(monitor);
    for (const profile of [luming, monitor]) {
      expect(profile.frequency).toBeGreaterThanOrEqual(70);
      expect(profile.frequency).toBeLessThanOrEqual(320);
      expect(profile.volume).toBeLessThanOrEqual(0.06);
      expect(profile.intervalMs).toBeGreaterThanOrEqual(40);
    }
  });
});
