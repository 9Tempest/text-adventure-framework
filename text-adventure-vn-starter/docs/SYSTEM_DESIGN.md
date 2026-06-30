# 文字冒险 / 视觉小说框架 System Design

## 1. 设计目标

这套 starter 面向类似《隐形守护者》一类互动影视/视觉小说：剧情以场景和对白推进，玩家在关键点选择路线，系统需要支持图片、文字、配乐、音效、人物配音、存档和分支变量。

优先级：

1. **容易迭代**：编剧改 JSON 即可预览，不需要每次改 React 代码。
2. **容易扩展**：核心 runtime 不依赖 UI，后续可以接 Web、Electron、移动端或自制编辑器。
3. **资源可插拔**：图片、BGM、SFX、VO 都通过 manifest id 引用。
4. **强校验**：剧情跳转、条件分支、资源引用尽量在开发阶段失败，而不是运行时失败。
5. **适合 MacBook 开发**：Node + Vite 本地启动快，资源直接放 public 目录即可。

## 2. 技术路线

当前 starter 使用：

- **TypeScript**：保证剧情解释器、schema、插件接口可维护。
- **React**：实现可替换的播放器 UI。
- **Vite**：提供本地 dev server 与 build 流程。
- **Zod**：运行时校验 JSON 剧情和资源 manifest。
- **Howler**：统一管理 BGM、SFX、配音。

后续桌面端建议加 Electron，但不要把 Electron 逻辑混进 `src/engine`。建议新增：

```text
apps/web       # 当前 Vite/React 播放器
apps/desktop   # Electron shell
packages/engine
packages/editor
```

当前 starter 为了简洁先采用单包结构。

## 3. 架构总览

```text
+------------------------------+
| Writer JSON / Asset Manifest |
+---------------+--------------+
                |
                v
+------------------------------+
| schema.ts                    |
| - StorySchema                |
| - AssetManifestSchema        |
| - static-ish runtime types   |
+---------------+--------------+
                |
                v
+------------------------------+       +------------------+
| RuntimeEngine                | ----> | RuntimePlugin    |
| - node state                 |       | analytics/debug  |
| - variables                  |       | achievements     |
| - choices/conditions         |       | gallery unlock   |
| - save export                |       +------------------+
+---------------+--------------+
                |
                v
+------------------------------+
| React Player UI              |
| - background/character layer |
| - dialogue box               |
| - choices                    |
| - save/load/mute             |
+---------------+--------------+
                |
                v
+------------------------------+
| AudioManager                 |
| - BGM                        |
| - SFX events                 |
| - VO per line                |
+------------------------------+
```

## 4. 数据模型

### 4.1 Story

`Story` 是整个游戏脚本入口：

```ts
type Story = {
  version: 1;
  id: string;
  title: string;
  startNode: string;
  variables: Record<string, string | number | boolean | null>;
  characters: Character[];
  nodes: StoryNode[];
};
```

### 4.2 Node

一个 node 是剧情图中的一个可跳转段落。它可以更新场景，也可以只继承上一场景。

```ts
type StoryNode = {
  id: string;
  title?: string;
  scene?: Scene;
  steps: Step[];
  choices?: Choice[];
  next?: string;
};
```

规则：

- `scene` 缺省时沿用上一 node 的背景/音乐/角色。
- `steps` 顺序执行。
- `line` step 会暂停并等待玩家继续。
- `set/inc/toggle/unset/sfx/jump` 会自动执行，直到遇到下一个 `line`、`choices` 或 ending。
- `choices` 出现在 node 末尾。
- 没有 `choices` 但有 `next` 时自动进入下一个 node。
- 没有 `choices`、没有 `next`、steps 执行完则进入 ending。

### 4.3 Step

当前 starter 已支持：

```ts
type Step =
  | { type: "line"; speaker?: string; text: string; voice?: string; portrait?: string; effects?: Effect[] }
  | { type: "set"; key: string; value: VariableValue }
  | { type: "inc"; key: string; by?: number }
  | { type: "toggle"; key: string }
  | { type: "unset"; key: string }
  | { type: "sfx"; audio: string }
  | { type: "jump"; target: string };
```

推荐后续新增 step 类型：

```ts
| { type: "showCg"; image: string; unlock?: string }
| { type: "shake"; intensity: number; durationMs: number }
| { type: "wait"; durationMs: number }
| { type: "video"; src: string; skippable: boolean }
| { type: "minigame"; id: string; success: string; fail: string }
```

### 4.4 Choice

```ts
type Choice = {
  id: string;
  text: string;
  target: string;
  conditions?: Condition[];
  effects?: Effect[];
  hint?: string;
};
```

Choice 的 `conditions` 全部通过才显示。`effects` 在玩家选择后立即应用。

### 4.5 Variables / Conditions

变量是剧情状态：信任度、物品、flag、路线标记。

```json
{
  "trustHan": 2,
  "hasCipher": true,
  "liedToHan": false
}
```

条件支持：`eq`、`neq`、`gt`、`gte`、`lt`、`lte`、`truthy`、`falsy`。

## 5. Runtime Engine

`RuntimeEngine` 的核心职责：

1. 加载已经通过 schema 校验的 `Story`。
2. 建立 `nodeId -> StoryNode` 索引。
3. 维护当前状态：`nodeId`、`stepIndex`、`variables`、`scene`、`history`。
4. 提供 deterministic API：

```ts
engine.snapshot();
engine.continue();
engine.choose(choiceId);
engine.exportSaveData();
```

UI 不应该直接改 runtime 内部状态，只通过这些方法推进。

## 6. 事件系统

runtime 每次推进会产生 events：

```ts
type RuntimeEvent =
  | { type: "nodeEntered"; nodeId: string }
  | { type: "sceneChanged"; scene: SceneState }
  | { type: "line"; line: LineStep }
  | { type: "sfx"; audio: string }
  | { type: "variableChanged"; key: string; value?: VariableValue }
  | { type: "choiceSelected"; choiceId: string; target: string }
  | { type: "ending" };
```

UI 和插件应消费 events，而不是把副作用写进 runtime。例如：

- `AudioManager` 根据 `scene.music` 播放/停止 BGM，根据 `sfx` event 播放音效。
- Analytics plugin 监听 `choiceSelected`。
- Gallery plugin 监听特定变量或 `showCg` step。

## 7. 音频设计

音频统一由 `manifest.json` 管理：

```json
{
  "audio": {
    "bgm_tension": { "src": "/game/assets/audio/bgm_tension.wav", "kind": "music", "loop": true, "volume": 0.28 },
    "voice_han_001": { "src": "/game/assets/audio/voice_han_001.wav", "kind": "voice" },
    "sfx_knock": { "src": "/game/assets/audio/sfx_knock.wav", "kind": "sfx" }
  }
}
```

约定：

- BGM/ambience 通常 loop。
- SFX one-shot。
- VO 建议一条对白一个文件，方便后期替换和 localization。
- 大项目可以升级为 audio sprite 或 voice bundle，但剧情层仍引用稳定 id。

## 8. 存档设计

存档保存 runtime 的最小可恢复状态：

```ts
type RuntimeSaveData = {
  storyId: string;
  nodeId: string;
  stepIndex: number;
  variables: Record<string, VariableValue>;
  history: RuntimeHistoryEntry[];
  scene: SceneState;
  ending: boolean;
  savedAt: string;
};
```

当前示例用 `localStorage`。正式项目建议抽象 `SaveAdapter`：

```ts
interface SaveAdapter {
  save(slot: string, data: RuntimeSaveData): Promise<void>;
  load(slot: string): Promise<RuntimeSaveData | null>;
  list(): Promise<SaveSlotMeta[]>;
  delete(slot: string): Promise<void>;
}
```

Electron 版可用文件系统，Web 版可用 IndexedDB。

## 9. Plugin 设计

当前插件接口：

```ts
type RuntimePlugin = {
  name: string;
  onEvent?: (event, snapshot, engine) => void;
  onSnapshot?: (snapshot, engine) => void;
};
```

插件不要破坏 deterministic runtime。推荐用途：

- debug logger
- analytics
- achievement unlock
- CG gallery unlock
- route coverage
- localization injection
- content warning overlay

## 10. 可扩展路线图

### Phase 1：核心体验

- 打字机效果
- auto/skip 模式
- backlog 历史文本
- 多存档槽
- 设置页：音量、文字速度、全屏
- route debug overlay

### Phase 2：内容生产效率

- Markdown/YAML script compiler：编剧写更自然的脚本，工具编译成 JSON。
- Story graph visualizer：检查孤立节点、死分支、变量条件。
- Asset import CLI：自动生成 manifest。
- VO coverage report：检查哪些 line 缺少 voice。

### Phase 3：发行

- Electron desktop build。
- Steam/itch 包装。
- 章节 DLC：按 chapter 分 bundle。
- i18n：按语言切换 story text 与 voice manifest。

## 11. Codex 实现约束

让 Codex 后续改代码时，建议附加这些规则：

1. 不要把剧情内容硬编码进 React 组件。
2. 新增剧情语义时，优先新增 `StepSchema` 和 runtime 解释逻辑。
3. 所有外部 JSON 必须通过 Zod parse。
4. UI 只消费 `RuntimeSnapshot`。
5. 音频、存档、analytics 作为 adapter/plugin，不侵入 runtime。
6. 每个新 step 类型至少补一个 runtime test。
7. 每次改 story/manifest 后运行 `npm run validate`。
