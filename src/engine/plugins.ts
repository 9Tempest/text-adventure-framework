import type { RuntimePlugin } from "./runtime";

export function createDebugLoggerPlugin(enabled = false): RuntimePlugin {
  return {
    name: "debug-logger",
    onEvent(event, snapshot) {
      if (!enabled) {
        return;
      }
      console.debug(`[VN:${snapshot.storyId}]`, event.type, event);
    }
  };
}

export function createAnalyticsPlugin(track: (name: string, payload: Record<string, unknown>) => void): RuntimePlugin {
  return {
    name: "analytics",
    onEvent(event, snapshot) {
      if (event.type === "choiceSelected") {
        track("choice_selected", {
          storyId: snapshot.storyId,
          nodeId: snapshot.nodeId,
          choiceId: event.choiceId,
          target: event.target
        });
      }
      if (event.type === "ending") {
        track("ending_reached", {
          storyId: snapshot.storyId,
          nodeId: snapshot.nodeId
        });
      }
    }
  };
}
