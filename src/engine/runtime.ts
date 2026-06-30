import type {
  Choice,
  Condition,
  Effect,
  LineStep,
  Scene,
  SceneCharacter,
  Step,
  Story,
  StoryNode,
  VariableValue
} from "./schema";

export type SceneState = {
  background?: string | null;
  music?: string | null;
  ambience?: string | null;
  characters: SceneCharacter[];
  transition?: "cut" | "fade" | "dissolve";
};

export type RuntimeEvent =
  | { type: "nodeEntered"; nodeId: string; title?: string }
  | { type: "sceneChanged"; scene: SceneState }
  | { type: "line"; line: LineStep }
  | { type: "sfx"; audio: string }
  | { type: "variableChanged"; key: string; value?: VariableValue }
  | { type: "choiceSelected"; choiceId: string; target: string }
  | { type: "ending" };

export type RuntimeHistoryEntry = {
  nodeId: string;
  choiceId: string;
  target: string;
  at: number;
};

export type RuntimeSaveData = {
  storyId: string;
  nodeId: string;
  stepIndex: number;
  variables: Record<string, VariableValue>;
  history: RuntimeHistoryEntry[];
  scene: SceneState;
  ending: boolean;
  savedAt: string;
};

export type RuntimeSnapshot = {
  storyId: string;
  storyTitle: string;
  nodeId: string;
  nodeTitle?: string;
  stepIndex: number;
  currentLine: LineStep | null;
  availableChoices: Choice[];
  variables: Record<string, VariableValue>;
  scene: SceneState;
  ending: boolean;
  revision: number;
  events: RuntimeEvent[];
};

export type RuntimePlugin = {
  name: string;
  onEvent?: (event: RuntimeEvent, snapshot: RuntimeSnapshot, engine: RuntimeEngine) => void;
  onSnapshot?: (snapshot: RuntimeSnapshot, engine: RuntimeEngine) => void;
};

export type RuntimeEngineOptions = {
  initialState?: RuntimeSaveData;
  plugins?: RuntimePlugin[];
};

const MAX_AUTO_STEPS = 1000;

export class RuntimeEngine {
  private readonly nodeIndex: Map<string, StoryNode>;
  private readonly plugins: RuntimePlugin[];
  private readonly state: {
    nodeId: string;
    stepIndex: number;
    variables: Record<string, VariableValue>;
    history: RuntimeHistoryEntry[];
    scene: SceneState;
    ending: boolean;
    revision: number;
    lastEvents: RuntimeEvent[];
  };

  constructor(private readonly story: Story, options: RuntimeEngineOptions = {}) {
    this.plugins = options.plugins ?? [];
    this.nodeIndex = new Map(story.nodes.map((node) => [node.id, node]));

    const initialState = options.initialState;
    this.state = initialState
      ? {
          nodeId: initialState.nodeId,
          stepIndex: initialState.stepIndex,
          variables: { ...initialState.variables },
          history: [...initialState.history],
          scene: {
            ...initialState.scene,
            characters: [...initialState.scene.characters]
          },
          ending: initialState.ending,
          revision: 0,
          lastEvents: []
        }
      : {
          nodeId: story.startNode,
          stepIndex: 0,
          variables: { ...story.variables },
          history: [],
          scene: { characters: [] },
          ending: false,
          revision: 0,
          lastEvents: []
        };

    if (!initialState) {
      const events: RuntimeEvent[] = [];
      this.enterNode(story.startNode, events);
      this.runUntilPresentable(events);
      this.finalize(events);
    } else {
      const events: RuntimeEvent[] = [];
      this.runUntilPresentable(events);
      this.finalize(events);
    }
  }

  snapshot(): RuntimeSnapshot {
    const node = this.getCurrentNode();
    return {
      storyId: this.story.id,
      storyTitle: this.story.title,
      nodeId: this.state.nodeId,
      nodeTitle: node.title,
      stepIndex: this.state.stepIndex,
      currentLine: this.getCurrentLine(),
      availableChoices: this.getAvailableChoices(),
      variables: { ...this.state.variables },
      scene: {
        ...this.state.scene,
        characters: [...this.state.scene.characters]
      },
      ending: this.state.ending,
      revision: this.state.revision,
      events: [...this.state.lastEvents]
    };
  }

  continue(): RuntimeSnapshot {
    if (this.state.ending) {
      return this.snapshot();
    }

    const events: RuntimeEvent[] = [];
    const line = this.getCurrentLine();
    if (!line) {
      return this.snapshot();
    }

    for (const effect of line.effects ?? []) {
      this.applyEffect(effect, events);
    }
    this.state.stepIndex += 1;
    this.runUntilPresentable(events);
    this.finalize(events);
    return this.snapshot();
  }

  choose(choiceId: string): RuntimeSnapshot {
    if (this.state.ending) {
      return this.snapshot();
    }

    const choice = this.getAvailableChoices().find((candidate) => candidate.id === choiceId);
    if (!choice) {
      throw new Error(`Choice '${choiceId}' is not available from node '${this.state.nodeId}'.`);
    }

    const events: RuntimeEvent[] = [{ type: "choiceSelected", choiceId: choice.id, target: choice.target }];
    for (const effect of choice.effects ?? []) {
      this.applyEffect(effect, events);
    }

    this.state.history.push({
      nodeId: this.state.nodeId,
      choiceId: choice.id,
      target: choice.target,
      at: Date.now()
    });

    this.enterNode(choice.target, events);
    this.runUntilPresentable(events);
    this.finalize(events);
    return this.snapshot();
  }

  exportSaveData(): RuntimeSaveData {
    return {
      storyId: this.story.id,
      nodeId: this.state.nodeId,
      stepIndex: this.state.stepIndex,
      variables: { ...this.state.variables },
      history: [...this.state.history],
      scene: {
        ...this.state.scene,
        characters: [...this.state.scene.characters]
      },
      ending: this.state.ending,
      savedAt: new Date().toISOString()
    };
  }

  getVariable(key: string): VariableValue | undefined {
    return this.state.variables[key];
  }

  setVariable(key: string, value: VariableValue): RuntimeSnapshot {
    const events: RuntimeEvent[] = [];
    this.setVariableInternal(key, value, events);
    this.finalize(events);
    return this.snapshot();
  }

  private finalize(events: RuntimeEvent[]): void {
    this.state.lastEvents = events;
    this.state.revision += 1;
    const snapshot = this.snapshot();
    for (const plugin of this.plugins) {
      plugin.onSnapshot?.(snapshot, this);
      for (const event of events) {
        plugin.onEvent?.(event, snapshot, this);
      }
    }
  }

  private runUntilPresentable(events: RuntimeEvent[]): void {
    let guard = 0;
    while (!this.state.ending) {
      guard += 1;
      if (guard > MAX_AUTO_STEPS) {
        throw new Error(`Runtime auto-step guard exceeded near node '${this.state.nodeId}'. Check for an infinite jump/action loop.`);
      }

      const node = this.getCurrentNode();
      const step = node.steps[this.state.stepIndex];

      if (step) {
        if (step.type === "line") {
          events.push({ type: "line", line: step });
          return;
        }

        this.applyNonLineStep(step, events);
        continue;
      }

      const choices = this.getAvailableChoices();
      if (choices.length > 0) {
        return;
      }

      if (node.next) {
        this.enterNode(node.next, events);
        continue;
      }

      this.state.ending = true;
      events.push({ type: "ending" });
      return;
    }
  }

  private applyNonLineStep(step: Step, events: RuntimeEvent[]): void {
    switch (step.type) {
      case "set":
        this.setVariableInternal(step.key, step.value, events);
        this.state.stepIndex += 1;
        return;
      case "inc":
        this.incrementVariable(step.key, step.by ?? 1, events);
        this.state.stepIndex += 1;
        return;
      case "toggle":
        this.setVariableInternal(step.key, !Boolean(this.state.variables[step.key]), events);
        this.state.stepIndex += 1;
        return;
      case "unset":
        delete this.state.variables[step.key];
        events.push({ type: "variableChanged", key: step.key, value: undefined });
        this.state.stepIndex += 1;
        return;
      case "sfx":
        events.push({ type: "sfx", audio: step.audio });
        this.state.stepIndex += 1;
        return;
      case "jump":
        this.enterNode(step.target, events);
        return;
      case "line":
        return;
      default:
        assertNever(step);
    }
  }

  private applyEffect(effect: Effect, events: RuntimeEvent[]): void {
    switch (effect.type) {
      case "set":
        this.setVariableInternal(effect.key, effect.value, events);
        return;
      case "inc":
        this.incrementVariable(effect.key, effect.by ?? 1, events);
        return;
      case "toggle":
        this.setVariableInternal(effect.key, !Boolean(this.state.variables[effect.key]), events);
        return;
      case "unset":
        delete this.state.variables[effect.key];
        events.push({ type: "variableChanged", key: effect.key, value: undefined });
        return;
      default:
        assertNever(effect);
    }
  }

  private incrementVariable(key: string, by: number, events: RuntimeEvent[]): void {
    const current = this.state.variables[key];
    const base = typeof current === "number" ? current : 0;
    this.setVariableInternal(key, base + by, events);
  }

  private setVariableInternal(key: string, value: VariableValue, events: RuntimeEvent[]): void {
    this.state.variables[key] = value;
    events.push({ type: "variableChanged", key, value });
  }

  private enterNode(nodeId: string, events: RuntimeEvent[]): void {
    const node = this.nodeIndex.get(nodeId);
    if (!node) {
      throw new Error(`Node '${nodeId}' does not exist.`);
    }

    this.state.nodeId = nodeId;
    this.state.stepIndex = 0;
    this.state.ending = false;
    events.push({ type: "nodeEntered", nodeId, title: node.title });
    this.mergeScene(node.scene, events);
  }

  private mergeScene(scene: Scene | undefined, events: RuntimeEvent[]): void {
    if (!scene) {
      return;
    }

    let changed = false;
    if (hasOwn(scene, "background")) {
      this.state.scene.background = scene.background;
      changed = true;
    }
    if (hasOwn(scene, "music")) {
      this.state.scene.music = scene.music;
      changed = true;
    }
    if (hasOwn(scene, "ambience")) {
      this.state.scene.ambience = scene.ambience;
      changed = true;
    }
    if (hasOwn(scene, "characters") && scene.characters) {
      this.state.scene.characters = [...scene.characters];
      changed = true;
    }
    if (hasOwn(scene, "transition")) {
      this.state.scene.transition = scene.transition;
      changed = true;
    }

    if (changed) {
      events.push({
        type: "sceneChanged",
        scene: {
          ...this.state.scene,
          characters: [...this.state.scene.characters]
        }
      });
    }
  }

  private getCurrentLine(): LineStep | null {
    const step = this.getCurrentNode().steps[this.state.stepIndex];
    return step?.type === "line" ? step : null;
  }

  private getAvailableChoices(): Choice[] {
    if (this.state.ending) {
      return [];
    }

    const node = this.getCurrentNode();
    if (this.getCurrentLine() || this.state.stepIndex < node.steps.length) {
      return [];
    }

    return (node.choices ?? []).filter((choice) =>
      (choice.conditions ?? []).every((condition) => this.evaluateCondition(condition))
    );
  }

  private evaluateCondition(condition: Condition): boolean {
    const actual = this.state.variables[condition.key];
    const expected = condition.value;

    switch (condition.op) {
      case "truthy":
        return Boolean(actual);
      case "falsy":
        return !Boolean(actual);
      case "eq":
        return actual === expected;
      case "neq":
        return actual !== expected;
      case "gt":
        return toNumber(actual) > toNumber(expected);
      case "gte":
        return toNumber(actual) >= toNumber(expected);
      case "lt":
        return toNumber(actual) < toNumber(expected);
      case "lte":
        return toNumber(actual) <= toNumber(expected);
      default:
        assertNever(condition.op);
    }
  }

  private getCurrentNode(): StoryNode {
    const node = this.nodeIndex.get(this.state.nodeId);
    if (!node) {
      throw new Error(`Current node '${this.state.nodeId}' does not exist.`);
    }
    return node;
  }
}

function toNumber(value: VariableValue | undefined): number {
  return typeof value === "number" ? value : Number(value ?? 0);
}

function hasOwn<T extends object>(value: T, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function assertNever(value: never): never {
  throw new Error(`Unhandled value: ${String(value)}`);
}
