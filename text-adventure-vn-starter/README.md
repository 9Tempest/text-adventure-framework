# Text Adventure VN Starter

一个面向“互动影视 / 视觉小说 / 文字冒险”的数据驱动 starter。核心目标是让编剧、美术、音频、程序可以并行迭代：剧情写 JSON，资源写 manifest，播放器只解释数据。

## 本地启动

```bash
npm install
npm run validate
npm run dev
```

打开 Vite 输出的本地地址即可预览。

## 目录结构

```text
public/game/story/main.story.json     # 剧情节点、对白、分支、变量
public/game/assets/manifest.json      # 图片 / BGM / SFX / VO 资源索引
public/game/assets/images             # 背景、角色立绘、CG
public/game/assets/audio              # 配乐、音效、配音
src/engine                            # 引擎核心：schema/runtime/audio/save/loader/plugins
src/App.tsx                           # 示例播放器 UI
tools/validate-story.ts               # 剧情与资源引用检查
docs/SYSTEM_DESIGN.md                 # 详细系统设计
docs/AUTHORING_GUIDE.md               # 编剧/资源接入说明
```

## 最小内容迭代方式

1. 把图片、配乐、配音放进 `public/game/assets/...`。
2. 在 `public/game/assets/manifest.json` 里给资源起稳定 id。
3. 在 `public/game/story/main.story.json` 里引用这些 id。
4. 运行 `npm run validate` 检查节点跳转、资源引用和文件是否存在。
5. 运行 `npm run dev` 预览。

## 剧情节点示例

```json
{
  "id": "chapter1.room",
  "scene": {
    "background": "bg_room",
    "music": "bgm_tension",
    "characters": [{ "character": "han", "image": "han_neutral", "slot": "right" }]
  },
  "steps": [
    { "type": "line", "speaker": "han", "voice": "voice_han_001", "text": "你迟到了。" },
    { "type": "sfx", "audio": "sfx_knock" },
    { "type": "inc", "key": "trustHan", "by": 1 }
  ],
  "choices": [
    { "id": "answer", "text": "解释原因", "target": "chapter1.answer" }
  ]
}
```

## Codex 后续实现建议

优先保持 `src/engine` 无 UI 依赖。新系统尽量以插件或新 step 类型扩展，例如：

- backlog/history plugin
- skip/auto mode
- gallery/CG unlock plugin
- route graph visualizer
- script-to-JSON compiler
- Electron desktop packaging
- local editor for writers

## 当前 starter 已包含

- TypeScript + React + Vite 播放器
- Zod schema 校验
- JSON 剧情节点解释器
- 条件分支、变量、自动跳转、存档/读档
- Howler 音频管理：BGM、SFX、voice
- 示例背景、角色 SVG、占位 WAV
- `npm run validate` 资源/剧情检查工具
- Vitest runtime 单元测试样例
