# Authoring Guide

## 1. 添加故事

每个 story 是一个独立 JSON 文件，放在：

```text
public/game/story
```

在 `public/game/catalog.json` 增加入口：

```json
{
  "id": "chapter-one",
  "title": "第一章",
  "description": "章节简介",
  "storyUrl": "/game/story/chapter-one.story.json",
  "manifestUrl": "/game/assets/manifest.json"
}
```

约定：

- catalog entry 的 `id` 和 story JSON 里的 `id` 保持一致。
- 多个 story 可以共用一个 manifest，也可以指向不同 manifest。
- `defaultStory` 决定播放器首次打开时加载哪一个 story。

## 2. 添加图片

把文件放入：

```text
public/game/assets/images
```

然后在 `manifest.json` 增加：

```json
"bg_office": {
  "src": "/game/assets/images/bg_office.png",
  "alt": "办公室",
  "tags": ["background"]
}
```

剧情里引用 id：

```json
"scene": { "background": "bg_office" }
```

## 3. 添加配乐

```json
"bgm_office": {
  "src": "/game/assets/audio/bgm_office.mp3",
  "kind": "music",
  "loop": true,
  "volume": 0.35
}
```

剧情里引用：

```json
"scene": { "music": "bgm_office" }
```

停止音乐：

```json
"scene": { "music": null }
```

## 4. 添加人物配音

建议一条对白一个 voice id：

```json
{
  "type": "line",
  "speaker": "han",
  "voice": "voice_han_ch01_0001",
  "text": "你迟到了。"
}
```

manifest：

```json
"voice_han_ch01_0001": {
  "src": "/game/assets/audio/voice_han_ch01_0001.wav",
  "kind": "voice",
  "volume": 0.9
}
```

## 5. 添加分支

```json
"choices": [
  {
    "id": "trust",
    "text": "相信他",
    "target": "chapter1.trust",
    "effects": [{ "type": "inc", "key": "trustHan", "by": 1 }]
  },
  {
    "id": "doubt",
    "text": "怀疑他",
    "target": "chapter1.doubt",
    "effects": [{ "type": "set", "key": "doubtedHan", "value": true }]
  }
]
```

## 6. 条件显示选项

```json
{
  "id": "secret",
  "text": "展示密电",
  "target": "chapter2.secret",
  "conditions": [{ "key": "hasCipher", "op": "truthy" }]
}
```

## 7. 验证

每次改完：

```bash
npm run validate
```

这个命令会检查：

- catalog JSON 是否符合 schema
- catalog 中的每个 story JSON 是否符合 schema
- catalog entry id 和 story id 是否一致
- `startNode` 是否存在
- choice/jump/next target 是否存在
- story 引用的 asset id 是否存在
- manifest 里的文件路径是否真实存在
