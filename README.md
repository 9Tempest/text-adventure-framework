# Text Adventure Framework

一个面向“互动影视 / 视觉小说 / 文字冒险”的数据驱动 framework。核心目标是让同一个播放器运行多个 story：编剧改 JSON，资源写 manifest，播放器读取 catalog 并解释数据。

## 本地启动

```bash
npm install
npm run validate
npm run dev
```

打开 Vite 输出的本地地址即可预览。页面顶部的故事下拉菜单会显示 `public/game/catalog.json` 里登记的所有 story。

Codex app 中建议让 agent 直接输出可点击链接。当前 demo 如果跑在 5174 端口，可以点：

[Open local demo](http://127.0.0.1:5174/)

如果 Vite 输出了其他端口，使用终端里显示的实际地址。

## 目录结构

```text
public/game/catalog.json                    # 多故事目录：默认 story、story 文件、manifest 文件
public/game/story/*.story.json              # 剧情节点、对白、分支、变量
public/game/assets/manifest.json            # 图片 / BGM / SFX / VO 资源索引
public/game/assets/images                   # 背景、角色立绘、CG
public/game/assets/audio                    # 配乐、音效、配音
src/engine                                  # 引擎核心：schema/runtime/audio/save/loader/plugins
src/App.tsx                                 # 示例播放器 UI：故事选择、播放、存档
tools/validate-story.ts                     # catalog、剧情与资源引用检查
docs/SYSTEM_DESIGN.md                       # 详细系统设计
docs/AUTHORING_GUIDE.md                     # 编剧/资源接入说明
```

## 添加一个新故事

1. 在 `public/game/story/` 新建 `your-story.story.json`。
2. 如果需要新资源，把图片、配乐、配音放进 `public/game/assets/...`。
3. 在 `public/game/assets/manifest.json` 里给资源起稳定 id。
4. 在 `public/game/catalog.json` 的 `stories` 中新增一条：

```json
{
  "id": "your-story",
  "title": "你的故事",
  "description": "一句话描述",
  "storyUrl": "/game/story/your-story.story.json",
  "manifestUrl": "/game/assets/manifest.json"
}
```

5. 运行 `npm run validate` 检查 catalog、节点跳转、资源引用和文件是否存在。
6. 运行 `npm run dev` 预览，并在顶部下拉菜单切换 story。

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

## 扩展方向

优先保持 `src/engine` 无 UI 依赖。新系统尽量以插件、adapter 或新 step 类型扩展，例如：

- backlog/history plugin
- skip/auto mode
- gallery/CG unlock plugin
- route graph visualizer
- script-to-JSON compiler
- Electron desktop packaging
- local editor for writers

## 当前已包含

- TypeScript + React + Vite 播放器
- Zod schema 校验
- catalog 驱动的多 story 加载
- JSON 剧情节点解释器
- 条件分支、变量、自动跳转、存档/读档
- Howler 音频管理：BGM、SFX、voice
- 示例背景、角色 SVG、占位 WAV
- `npm run validate` catalog / story / resource 检查工具
- Vitest runtime 单元测试样例
