# 云天明完整篇：配乐来源与加工记录

本项目完整篇使用 10 首重新剪辑、分层和循环化的 BGM。源素材来自 John Bartmann 的 `Straylight Drones`，作者将整套素材以 CC0 1.0 释出；无需署名，但项目仍保留本记录以便追溯。

## 原始素材

| 本地源文件 | 原始文件页 | 许可 | 下载日期 |
|---|---|---|---|
| `dark-basement.ogg` | [Dark Basement](https://commons.wikimedia.org/wiki/File:John_Bartmann_-_dark-basement-master.ogg) | CC0 1.0 | 2026-07-11 |
| `aetherbells.ogg` | [Aetherbells](https://commons.wikimedia.org/wiki/File:John_Bartmann_-_aetherbells-master.ogg) | CC0 1.0 | 2026-07-11 |
| `blue-whale.ogg` | [Blue Whale](https://commons.wikimedia.org/wiki/File:John_Bartmann_-_blue-whale-master.ogg) | CC0 1.0 | 2026-07-11 |
| `cold-morning.ogg` | [Cold Morning](https://commons.wikimedia.org/wiki/File:John_Bartmann_-_cold-morning-master.ogg) | CC0 1.0 | 2026-07-11 |
| `above-the-clouds.ogg` | [Above the Clouds](https://commons.wikimedia.org/wiki/File:John_Bartmann_-_above-the-clouds-master.ogg) | CC0 1.0 | 2026-07-11 |
| `endgame.ogg` | [Endgame](https://commons.wikimedia.org/wiki/File:John_Bartmann_-_endgame-master.ogg) | CC0 1.0 | 2026-07-11 |

专辑原始发布页：[100 Ambient Atmospheric Audio Drama Soundtracks: Straylight Drones](https://johnbartmann.bandcamp.com/album/100-ambient-atmospheric-audio-drama-soundtracks-straylight-drones)。

## 加工方式

生成脚本为 `tools/build-yun-score.mjs`。它从每个 244 秒源文件截取不同段落，并执行：

- 30–180 Hz 高通与 3.6–11.8 kHz 低通，给对白保留中频空间；
- 两首源素材按场景分层，建立“钟声 / 深海 / 白塔 / 黎明”共同母题；
- 5 秒 equal-power 首尾交叉淡化，制作约 73 秒无缝循环；
- 输出 48 kHz、立体声、Ogg Vorbis；
- 由 manifest 逐轨设定播放音量，避免听证厅、深海和黎明段落响度突变。

最终文件位于 `public/game/assets/audio/yun/score/`。源下载文件只作为本地构建缓存，不参与游戏发布。

## 成品映射

| Asset id | 叙事用途 | 主要素材 |
|---|---|---|
| `SCORE_white_tower` | 地下白塔、译码舱 | Dark Basement |
| `SCORE_bells_before_paper` | 拾声王国清晨 | Aetherbells |
| `SCORE_fairytale_air` | 画页之城全章；轻柔、空灵、低音量童话底色 | Above the Clouds + Aetherbells（由 `SCORE_thousand_islands` 再均衡） |
| `SCORE_paper_edge` | 画页灾害、纸背群星 | Aetherbells + Endgame |
| `SCORE_hungry_sea` | 饥潮之海 | Blue Whale + Endgame |
| `SCORE_deep_lantern` | 沉钟岛、深灯王子 | Blue Whale + Aetherbells |
| `SCORE_three_line_hearing` | 三线听证 | Dark Basement + Aetherbells |
| `SCORE_dual_dawn` | 双轨黎明、白痕为伞 | Cold Morning + Above the Clouds |
| `SCORE_thousand_islands` | 第四盏灯 | Above the Clouds + Aetherbells |
| `SCORE_signal_cut` | 通信中止 | Endgame |
| `SCORE_after_the_warning` | 其余苦涩结局 | Endgame + Cold Morning |

建议鸣谢（非许可要求）：`Straylight Drones music by John Bartmann, CC0.`
