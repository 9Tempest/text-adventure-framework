import type { RuntimeSaveData } from "./runtime";

const SAVE_PREFIX = "vn-save:";

export function saveGame(data: RuntimeSaveData): void {
  if (!hasStorage()) {
    return;
  }
  window.localStorage.setItem(`${SAVE_PREFIX}${data.storyId}`, JSON.stringify(data));
}

export function loadGameSave(storyId: string): RuntimeSaveData | null {
  if (!hasStorage()) {
    return null;
  }

  const raw = window.localStorage.getItem(`${SAVE_PREFIX}${storyId}`);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as RuntimeSaveData;
    return parsed.storyId === storyId ? parsed : null;
  } catch {
    return null;
  }
}

export function clearGameSave(storyId: string): void {
  if (!hasStorage()) {
    return;
  }
  window.localStorage.removeItem(`${SAVE_PREFIX}${storyId}`);
}

function hasStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}
