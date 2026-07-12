import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (relativePath) => JSON.parse(readFileSync(path.join(root, relativePath), "utf8"));

const chapterOne = readJson("public/game/story/yun-chapter1.story.json");
const chapterTwo = readJson("public/game/story/yun-chapter2.story.json");
const sourcePack = readJson("yun_fairytale_adventure_pack/scripts/script_nodes.json");
const sourceById = new Map(sourcePack.scenes.map((scene) => [scene.id, scene]));

const speakerIds = {
  "旁白": undefined,
  "鹿暝": "luming",
  "槐姨": "huaiyi",
  "风帆卫士": "sailor",
  "折页匠": "folding_artisan",
  "空伞师": "umbrella_master",
  "砾亲王": "prince_li",
  "卫兵": "guard",
  "潜灯王子": "deep_prince",
  "译码员": "decoder",
  "澄安": "chengan",
  "监察音": "monitor_voice",
  "远航者Y": "voyager_y",
  "幸存者档案": "archive_voice",
  "档案旁白": "archive_voice",
  "远航档案": "archive_voice",
  "文学评审": "reviewer",
  "异星译文": "alien_archive"
};

const characters = [
  ["luming", "鹿暝", "#f3d6a1"],
  ["huaiyi", "槐姨", "#d8c4a7"],
  ["sailor", "风帆卫士", "#8fc7df"],
  ["folding_artisan", "折页匠", "#e6e8ef"],
  ["umbrella_master", "空伞师", "#99b7d2"],
  ["prince_li", "砾亲王", "#d29086"],
  ["deep_prince", "潜灯王子", "#82d8d0"],
  ["decoder", "译码员", "#dbe8ff"],
  ["chengan", "澄安", "#f0c9aa"],
  ["monitor_voice", "监察音", "#ff8585"],
  ["voyager_y", "远航者Y", "#f3df9e"],
  ["guard", "卫兵", "#d5d8df"],
  ["merchant_old", "老海商", "#c5a783"],
  ["archive_voice", "幸存者档案", "#a9c7d8"],
  ["reviewer", "文学评审", "#c2bdc9"],
  ["alien_archive", "异星译文", "#a4f4dc"]
].map(([id, name, color]) => ({ id, name, color }));

const variables = {
  trust: 0,
  science: 0,
  risk: 0,
  heat: 0,
  politics: 0,
  worlds: 0,
  act1_done: 0,
  act3_done: 0,
  clue_flatten: 0,
  clue_spread_rate: 0,
  clue_umbrella: 0,
  clue_common_origin: 0,
  clue_curvature: 0,
  clue_wake: 0,
  clue_slowlight: 0,
  clue_coordinate: 0,
  clue_escape: 0,
  clue_blackdomain: 0,
  decode_flatten: 0,
  decode_escape: 0,
  decode_blackdomain: 0,
  decode_balanced: 0,
  escape_bias: 0,
  defense_bias: 0
};

const backgroundById = {
  P00: "bg_r00",
  P01: "bg_r01",
  P02: "bg_r00",
  R00: "bg_r00",
  R01: "bg_r01",
  T3_01: "bg_t3_01",
  T3_02: "bg_t3_02",
  T3_03: "bg_t2_08",
  T3_04: "bg_t3_04",
  T3_05: "bg_t3_04",
  T3_06: "bg_t3_04",
  T3_07: "bg_t3_07",
  T3_08: "bg_t3_02",
  T3_09: "bg_t3_04",
  T3_10: "bg_t3_04",
  R02: "bg_r01",
  R03: "bg_t1_11",
  R04: "bg_t2_08",
  R05: "bg_t3_07",
  R06: "bg_r06",
  E_TRUE: "bg_e_true",
  E_WARNING_ONLY: "bg_r06",
  E_ESCAPE: "bg_t2_09",
  E_ESCAPE_FLAWED: "bg_t2_08",
  E_BLACKDOMAIN: "bg_t3_07",
  E_BLACKDOMAIN_FLAWED: "bg_t1_09",
  E_MISSED: "bg_r01",
  E_CENSOR: "bg_r00",
  E_FOURTH_LIGHT: "bg_e_fourth_light",
  E_WAKE_UMBRELLA: "bg_e_true",
  E_PAPER_STARS: "bg_t1_11"
};

function scoreFor(id) {
  if (/^T1_/.test(id)) return "SCORE_fairytale_air";
  if (/^T2_/.test(id)) return "SCORE_hungry_sea";
  if (/^T3_/.test(id)) return "SCORE_deep_lantern";
  if (id === "R06") return "SCORE_three_line_hearing";
  if (["E_TRUE", "E_WAKE_UMBRELLA"].includes(id)) return "SCORE_dual_dawn";
  if (id === "E_FOURTH_LIGHT") return "SCORE_thousand_islands";
  if (id === "E_PAPER_STARS") return "SCORE_paper_edge";
  if (id === "E_CENSOR") return "SCORE_signal_cut";
  if (id.startsWith("E_")) return "SCORE_after_the_warning";
  return "SCORE_white_tower";
}

const sfxById = {
  P00: "SFX_low_rumble",
  P01: "SFX_soft_bells",
  P02: "SFX_data_lock",
  R00: "SFX_low_rumble",
  R01: "SFX_soft_bells",
  T3_01: "SFX_distant_bells",
  T3_02: "SFX_water_silence",
  T3_03: "SFX_water_silence",
  T3_04: "SFX_soft_waves",
  T3_05: "SFX_soft_bells",
  T3_06: "SFX_glass_clink",
  T3_07: "SFX_clock_creak",
  T3_08: "SFX_star_map_slide",
  T3_09: "SFX_data_lock",
  T3_10: "SFX_bubbles",
  R02: "SFX_data_lock",
  R03: "SFX_paper_rip_slow",
  R04: "SFX_star_map_slide",
  R05: "SFX_umbrella_spin",
  R06: "SFX_data_lock",
  E_TRUE: "SFX_wind_chimes",
  E_WARNING_ONLY: "SFX_distant_bells",
  E_ESCAPE: "SFX_soft_waves",
  E_ESCAPE_FLAWED: "SFX_water_silence",
  E_BLACKDOMAIN: "SFX_clock_creak",
  E_BLACKDOMAIN_FLAWED: "SFX_umbrella_spin_unstable",
  E_MISSED: "SFX_soft_bells",
  E_CENSOR: "SFX_signal_cut",
  E_FOURTH_LIGHT: "SFX_soft_bells",
  E_WAKE_UMBRELLA: "SFX_distant_bells",
  E_PAPER_STARS: "SFX_paper_rip_slow"
};

const extraText = {
  T3_01: [
    ["旁白", "雾里偶尔浮出几盏没有火焰的灯。它们照不亮海面，只让每一道浪显得更深。"],
    ["鹿暝", "如果他一直在等，为什么不让钟响得更大？"],
    ["风帆卫士", "因为真正想藏起来的人，连等待也不能发出坐标。"]
  ],
  T3_02: [
    ["旁白", "他的声音经过海水抵达时，每个字都比上一个字更旧，像一句话在路上度过了许多年。"],
    ["槐姨", "殿下，他不是怕回家。他是怕自己成为回家的那条路。"],
    ["潜灯王子", "姐姐，王国最贵重的东西不是王位，是还有人不知道它在哪里。"]
  ],
  T3_03: [
    ["旁白", "一滴浪花悬在岩缝上方，迟迟没有落下。你看着它，第一次看见时间也能成为地形。"],
    ["鹿暝", "我们每一次逃离，都可能在身后造出另一座监狱。"],
    ["风帆卫士", "所以船长必须记得尾迹，而英雄最爱忘记。"]
  ],
  T3_04: [
    ["旁白", "一顶旧王冠悬在水墙中央，既不上浮，也不下沉。潜灯王子没有伸手。"],
    ["潜灯王子", "如果我戴上它，所有人会记住我的脸；而猎手最擅长顺着被记住的脸寻找世界。"],
    ["鹿暝", "那我带来的不是继承人。是一位守门人。"],
    ["潜灯王子", "不，是一扇学会假装自己不存在的门。"]
  ],
  T3_05: [
    ["旁白", "深灯厅的地面亮起两条路。一条向外弯进黑海，一条向内收成静蓝色的圆。"],
    ["槐姨", "为什么每条活路看上去都像失去什么？"],
    ["潜灯王子", "因为没有代价的生存，只存在于还没讲完的童话里。"],
    ["鹿暝", "那就把代价也讲完。哪怕听的人因此不再爱这个答案。"]
  ],
  T3_06: [
    ["旁白", "档案胶囊一排排沉在幽蓝水光中。每一枚都没有国徽，只有一个普通人的名字。"],
    ["槐姨", "这里为什么收着一锅失败的冬汤配方？"],
    ["潜灯王子", "因为文明若只保存伟大，就会在醒来后不知道怎样吃一顿不好吃的晚饭。"],
    ["鹿暝", "把笑话也装船。末日之后，第一个会笑的人，才真正证明我们抵达了。"]
  ],
  T3_07: [
    ["旁白", "穹顶内有一座模型城市。街道平静，灯火温柔，所有钟都停在同一个安全的时刻。"],
    ["鹿暝", "他们会知道自己被保护了吗？"],
    ["潜灯王子", "第一代知道。第二代纪念。第三代会说，外面的星空只是危险分子编出的传说。"],
    ["旁白", "安全没有露出獠牙。它只是温柔地拿走了远方。"]
  ],
  T3_08: [
    ["旁白", "海图的墨线离开封蜡后自行弯曲，避开所有已知灯塔，也避开每一条容易被歌颂的捷径。"],
    ["鹿暝", "如果永远不能回头，谁来证明我们曾经属于这里？"],
    ["潜灯王子", "不是坐标。是你愿意带走哪些无用的东西。名字、口音、错误，还有没人鼓掌的善意。"],
    ["旁白", "你忽然明白，一艘方舟最重的货物，从来不是机器。"]
  ],
  T3_09: [
    ["旁白", "三件象征物在桌上投下重叠的影：一片纸、一枚泡、一截黑伞骨。重叠处没有答案，只有责任。"],
    ["潜灯王子", "完整的命令会制造服从，不完整的童话才会迫使后来的人继续判断。"],
    ["鹿暝", "可判断会犯错。"],
    ["潜灯王子", "对。那正是自由最不体面的部分。"]
  ],
  T3_10: [
    ["旁白", "水墙后的人影开始被黑暗收回。鹿暝知道，再多问一句，也许就会让这条隐藏路线多亮一分。"],
    ["潜灯王子", "还有一句，不写进报告。若听故事的人仍在，就告诉她：我没有把她当作答案，我只把选择交给她。"],
    ["鹿暝", "她会听见。"],
    ["旁白", "这一次，监察音没有插话。也许它不理解，也许它理解得太晚。"]
  ],
  R02: [
    ["旁白", "三则童话同时悬在译码台上。它们的图像彼此渗透：纸边长进海里，白痕绕成伞骨，深灯照出一条没有坐标的路。"],
    ["澄安", "委员会会逼我们给出唯一答案。"],
    ["译码员", "那就先决定，我们愿不愿意把不确定也当成情报。"]
  ],
  R03: [
    ["旁白", "沙盘上的三维城市依次失去高度。尖塔先变成线，线再变成一层仍在发光的薄面。"],
    ["澄安", "模型里那些还没离开的人呢？"],
    ["译码员", "这正是报告最容易用一个百分比抹掉的人。"]
  ],
  R04: [
    ["旁白", "航线越亮，出发名额越少。屏幕没有显示谁该留下，但每个人都看见了那块空白。"],
    ["澄安", "不要让速度替我们伪装成公平。"],
    ["译码员", "也不要让不公平成为拒绝救任何人的借口。"]
  ],
  R05: [
    ["旁白", "防御模型安静得令人向往。城市没有伤亡，没有警报，也没有任何消息能够抵达边界外。"],
    ["澄安", "如果活着的人再也不能说自己活着，这算成功吗？"],
    ["译码员", "至少必须由他们知道自己在选择什么。"]
  ],
  R06: [
    ["旁白", "听证厅没有窗。可在你开口前，穹顶投下了一线并不存在的黎明。"],
    ["监察音", "最终摘要即将写入不可撤销档案。"],
    ["澄安", "别替童话选择语气。把每一种活法连同它的伤口一起说出来。"]
  ],
  E_TRUE: [
    ["旁白", "有些船在黎明前离岸，有些城市在黎明前把灯调慢。两边的人都知道，自己选择的不是胜利。"],
    ["澄安", "他没有给我们天堂。"],
    ["译码员", "他给了我们不把同一种死亡强加给所有人的机会。"],
    ["旁白", "很远的地方，三盏无人看守的灯依次熄灭。第四盏还没有亮。"]
  ],
  E_WARNING_ONLY: [
    ["旁白", "警报穿过城市时，人们第一次抬头看见那条正在增长的白。"],
    ["澄安", "我们争取到了恐惧。却没有替恐惧争取方向。"],
    ["旁白", "听证厅外，第一掌宽的世界悄无声息地抵达了海岸。"]
  ],
  E_ESCAPE: [
    ["旁白", "船上的孩子把故乡画成一枚很小的铃。他们从没听过那只铃真正的声音。"],
    ["幸存者档案", "我们保存了名字，却再也无法确认被保存的人是否原谅我们。"],
    ["旁白", "远舟没有岸。只有故事在船舱里一代代变旧，又一代代被重新讲起。"]
  ],
  E_ESCAPE_FLAWED: [
    ["旁白", "最后一艘追赶的船在白痕里停成琥珀。它的信号用了两百年才说完‘等等’。"],
    ["旁白", "宇宙没有惩罚他们。宇宙只是忠实执行了被删去的代价。"]
  ],
  E_BLACKDOMAIN: [
    ["旁白", "穹顶内的学校后来删除了‘星星’这个词。没有孩子反对，因为没人见过它。"],
    ["档案旁白", "我们安全。我们安全。我们安全。"],
    ["旁白", "重复到第九百年时，这句话终于听起来像一扇没有把手的门。"]
  ],
  E_BLACKDOMAIN_FLAWED: [
    ["旁白", "控制塔里最后留下的是一把静止的伞。伞面干燥，像从未替任何人挡过雨。"],
    ["旁白", "他们不是不知道答案。他们只把答案里不方便的一半叫作噪声。"]
  ],
  E_MISSED: [
    ["旁白", "文学组为童话颁了一枚奖。奖章送入库房时，库房的墙已经薄得能透过它看见另一侧的星。"],
    ["澄安", "最安全的误读，是把所有警告都赞美得很美。"],
    ["旁白", "后来的人终于读懂了。后来，已经没有人能够把读懂这件事告诉别人。"]
  ],
  E_CENSOR: [
    ["旁白", "澄安仍在呼喊，可她的声音被压成一条没有振幅的线。"],
    ["译码员", "太直白不是勇敢。太直白有时只是替猎手指出该剪断哪里。"],
    ["旁白", "黑窗倒映出你自己的脸。三盏灯熄灭后，第四盏从未得到存在的机会。"]
  ]
};

const endingMeta = {
  E_TRUE: ["A", "双轨黎明", "没有完美幸存，只有被诚实保留的两种未来。", "hope"],
  E_WARNING_ONLY: ["B", "纸边警报", "你让世界看见末日，却没来得及给它一条路。", "bittersweet"],
  E_ESCAPE: ["C", "远舟无岸", "故事离开了故乡，也永远欠故乡一个回答。", "bittersweet"],
  E_ESCAPE_FLAWED: ["D", "白痕归途", "被删去的代价沿着最漂亮的路追了上来。", "dark"],
  E_BLACKDOMAIN: ["E", "静蓝王国", "文明活了很久，也忘记了远方。", "bittersweet"],
  E_BLACKDOMAIN_FLAWED: ["F", "伞停之后", "不愿承认边界的防御，最终失去了边界。", "dark"],
  E_MISSED: ["G", "仍是童话", "所有人都赞美了它，直到赞美失去意义。", "failure"],
  E_CENSOR: ["X", "通信中止", "故事还活着，只是不再能够抵达。", "failure"],
  E_FOURTH_LIGHT: ["H · 隐藏", "第四盏灯", "听见警告之后，你也让讲故事的人听见了回答。", "secret"],
  E_WAKE_UMBRELLA: ["I · 隐藏", "白痕为伞", "三十九艘不归的船，把副作用弯成故乡的边界。", "secret"],
  E_PAPER_STARS: ["J · 隐藏", "纸背群星", "无法离开的人，也拥有决定如何被未来读到的权利。", "secret"]
};

function effectHint(effects = []) {
  const keys = new Set(effects.filter((effect) => effect.type === "inc" && effect.by > 0).map((effect) => effect.key));
  if (keys.has("heat")) return "危险表达 · 监察正在靠近";
  if (keys.has("clue_wake") || keys.has("clue_flatten") || keys.has("clue_slowlight") || keys.has("clue_curvature")) return "观察 · 一个隐喻开始发光";
  if (keys.has("trust")) return "倾听 · 有人会记住你的方式";
  if (keys.has("risk")) return "冒险 · 代价不会立刻出现";
  if (keys.has("science")) return "推演 · 把结构留在词语之后";
  return undefined;
}

function enrichLegacyNode(node, chapter) {
  const nextNode = structuredClone(node);
  const source = sourceById.get(node.id);
  const replacements = {
    "chapter1.to_chapter2": "T2_01",
    "chapter2.to_chapter3": "T3_01",
    "chapter1.censored": "E_CENSOR",
    "chapter2.censored": "E_CENSOR"
  };

  nextNode.chapter = chapter;
  nextNode.location = source?.location;
  nextNode.layer = node.id === "T1_08" ? "decode" : "fairytale";
  nextNode.scene = {
    ...nextNode.scene,
    music: scoreFor(node.id),
    transition: node.id === "T1_08" ? "cut" : "dissolve"
  };
  nextNode.choices = (nextNode.choices ?? []).map((choice) => ({
    ...choice,
    target: replacements[choice.target] ?? choice.target,
    hint: effectHint(choice.effects)
  }));
  if (nextNode.next) nextNode.next = replacements[nextNode.next] ?? nextNode.next;
  return nextNode;
}

function makeLine([speakerName, text]) {
  const speaker = speakerIds[speakerName];
  return speaker ? { type: "line", speaker, text } : { type: "line", text };
}

function makeEffects(values = {}) {
  return Object.entries(values).map(([key, by]) => ({ type: "inc", key, by }));
}

function chapterFor(id) {
  if (id.startsWith("T3_")) return "第三则 · 深灯王子";
  if (id.startsWith("R0")) return "终章 · 译码听证";
  if (id.startsWith("E_")) return "结局 · 童话抵达之后";
  return "序章 · 被允许的谎言";
}

function layerFor(id) {
  if (id.startsWith("T3_")) return "fairytale";
  if (id.startsWith("R0")) return "decode";
  if (id.startsWith("E_")) return "ending";
  return "reality";
}

function makeSourceNode(id, override = {}) {
  const source = sourceById.get(id);
  if (!source && !override.title) throw new Error(`Missing source scene ${id}`);
  const text = override.text ?? [...(source?.text ?? []), ...(extraText[id] ?? [])];
  const steps = [];
  const sfx = override.sfx ?? sfxById[id];
  if (sfx) steps.push({ type: "sfx", audio: sfx });
  steps.push(...text.map(makeLine));

  const choices = override.choices ?? (source?.choices ?? []).map((choice, index) => {
    const effects = makeEffects(choice.set);
    return {
      id: `${id}_C${String(index + 1).padStart(2, "0")}`,
      text: choice.text,
      target: choice.to,
      effects,
      hint: effectHint(effects)
    };
  });

  const meta = endingMeta[id];
  return {
    id,
    title: override.title ?? source.title,
    chapter: override.chapter ?? chapterFor(id),
    location: override.location ?? source.location,
    layer: override.layer ?? layerFor(id),
    ...(meta ? { ending: { code: meta[0], title: meta[1], subtitle: meta[2], tone: meta[3] } } : {}),
    scene: {
      background: override.background ?? backgroundById[id],
      music: override.music ?? scoreFor(id),
      transition: override.transition ?? (id.startsWith("R") ? "cut" : "dissolve")
    },
    steps,
    ...(choices.length ? { choices } : {})
  };
}

const prologue = [
  makeSourceNode("P00", {
    title: "在群星学会沉默以后",
    chapter: "引言 · 星海里的旧名字",
    location: "太阳系 / 一段尚未结束的历史",
    layer: "reality",
    text: [
      ["旁白", "很久以前，人类仰望群星，以为黑暗只是距离。后来他们才知道，黑暗也是礼貌：活得足够久的文明，都懂得不让陌生目光找到自己的门。"],
      ["旁白", "四光年外，三颗太阳照着另一个世界。那里的文明听见了地球，地球也看见了他们。两边隔着漫长夜色，却像两个人同时在雪地里发现了对方的脚印。"],
      ["旁白", "他们没有成为朋友。一个世界驶来舰队，另一个世界点亮武器；战争、威慑与短暂和平依次登场，每一次握手都藏着计算，每一次沉默都可能是一枚坐标。"],
      ["旁白", "更远的宇宙里，还有从不询问善恶的猎手。它们只确认哪里亮着，然后让那里重新安静。于是，被看见不再等于被理解，有时只等于来不及逃。"],
      ["旁白", "和平最后薄得像一张纸。人类仍能生活、争论、爱人，却知道某些科学名词一旦说出口，通话就会中止；某些正确答案一旦太清楚，世界就会提前关门。"],
      ["旁白", "就在这样的年代，一个被送往敌人星海的地球人，请求同故乡说最后一次话。"],
      ["旁白", "他没有索要军队，也没有索要纪念碑。他只请求三盏灯，和讲完三个童话所需的一点时间。"]
    ],
    choices: [
      { id: "P00_C01", text: "翻开那位远航者留下的档案", target: "P01", effects: [], hint: "有些名字，要走很远才会回到故乡" }
    ]
  }),
  makeSourceNode("P01", {
    title: "先把现实里的名字说清楚",
    chapter: "引言 · 云天明与白塔",
    location: "白塔档案层 / 身份记录",
    layer: "reality",
    text: [
      ["旁白", "在进入童话以前，先把现实里的名字说清楚。你不需要读过任何旧档案，也不需要认识此前发生过的故事。"],
      ["旁白", "云天明，是一个出生在地球的人。身患绝症时，他参加了人类的‘阶梯计划’：身体留在故乡，大脑被装进探测器，送往正在逼近太阳系的三体舰队。那是一趟没有返航舱的远行。"],
      ["旁白", "三体文明来自四光年外一个被三颗太阳反复毁灭的世界。他们拥有远胜地球的技术，也曾派出舰队准备占领太阳系；后来，两个文明在威慑下维持着脆弱和平。"],
      ["旁白", "三体舰队在星海中找到了云天明，并用异星技术重新构造了他。多年以后，他获准向地球通话一次，但三体监察系统会监听每个字：公式、武器和逃生路线一旦说得太直白，通信就会立刻中止。"],
      ["旁白", "所以，‘远航者Y’不是另一个人。那是云天明在这次受监控通信中的代号；三则童话，都由他讲述。"],
      ["旁白", "澄安是白塔的通信负责人。她负责保护云天明话语中的感情、动机和对普通人的牵挂，防止技术分析把讲故事的人也一并删去。"],
      ["旁白", "你就是画面上所说的‘译码员’。你的工作是从童话里辨认宇宙灾难、逃生办法与防御方案，并决定最后向人类提交什么报告。你的选择会改变结局。"],
      ["旁白", "‘监察音’来自三体一方。它不是同伴，也不是童话角色，而是守在通信线路上的审查系统。界面中的‘监察’数值过高，通话会被切断。"],
      ["旁白", "这场游戏因此发生在两个地方：现实中的白塔译码舱，以及云天明讲述的三个童话王国。画面标为‘现实层’时，你在白塔；标为‘童话层’时，你正在故事内部。"],
      ["旁白", "现在，现实里的名字已经放稳。下一页档案，只介绍你即将在童话里遇见的人。"]
    ],
    choices: [
      { id: "P01_C01", text: "继续阅读童话人物索引", target: "P02", effects: [], hint: "先认识他们，再走进他们的命运" }
    ]
  }),
  makeSourceNode("P02", {
    title: "灯亮以前的人名册",
    chapter: "引言 · 三则童话的人物",
    location: "白塔译码台 / 人物索引",
    layer: "reality",
    text: [
      ["旁白", "鹿暝，是第一则童话《画页之城》的年轻王子，也是你进入童话后的主要视角。他并不知道世界将发生什么；他的职责，是替玩家发问并作出选择。"],
      ["旁白", "槐姨，是照料鹿暝长大的宫廷女官。她熟悉王城里的普通人，总会提醒王子：任何宏大的救亡方案，最后都要落在具体姓名和具体生活上。"],
      ["旁白", "折页匠，是突然进入王宫的神秘画师。他与人口失踪和异常白纸有关。在隐喻层面，他带来的不是普通魔法，而是一种能让整个世界失去厚度的灾难。"],
      ["旁白", "风帆卫士，是来自王国之外的航海者。他知道世界不只一座岛，也知道远航可以保存文明，却不可能让每个人同时离开。"],
      ["旁白", "空伞师，守着一把旋转黑伞。他掌握一种让光和信息变慢的保护方式；它能隐藏一座城，也可能把受到保护的人永远关在里面。"],
      ["旁白", "潜灯王子，在第三则童话中守候于深海。他知道如何熄灭一个世界的坐标，也保管着故事最后的两条生路：向外远航，或向内藏起灯火。"],
      ["旁白", "砾亲王、卫兵、老海商等人物会在登场时说明身份，你不必提前记住。真正需要记住的是：纸象征降维灾难，轻泡象征远航技术，黑伞与慢灯象征隐藏文明的防御。"],
      ["旁白", "这些角色不是现实人物的一一化名。云天明把人物、技术和文明揉在一起，是为了让真相穿过监察；你要寻找的不是标准答案，而是每个比喻同时保存了哪些事实与代价。"],
      ["旁白", "三盏灯已经放上译码台。第一盏属于画页，第二盏属于饥潮，第三盏沉在无人敢点亮的深海。"],
      ["旁白", "从下一刻开始，说明结束，故事开始。"]
    ],
    choices: [
      { id: "P02_C01", text: "我明白了，走进白塔", target: "R00", effects: [], hint: "听云天明亲自点亮第一盏灯" }
    ]
  }),
  makeSourceNode("R00", {
    title: "白塔最后一次开窗",
    chapter: "序章 · 被允许的谎言",
    layer: "reality",
    text: [
      ["旁白", "白塔的窗户在地下。这里没有风，只有机器替人类模拟出来的星光。"],
      ["旁白", "距离传输窗口关闭还有四十七分钟。会议记录把它称为‘一次低价值文化交流’。没有人敢写‘最后一次’。"],
      ["澄安", "讯使没有发来公式，也没有发来坐标。他只说：请把它当作童话听完。"],
      ["译码员", "如果童话里藏着技术呢？"],
      ["澄安", "那我们要先保证它活着抵达，再决定怎样把它拆开。"],
      ["监察音", "提示：直接技术传输将被中止。隐喻、民谣、寓言可继续。"],
      ["旁白", "黑色传输窗里掠过一个人的轮廓。看不清脸，只看得见他身旁亮着三盏小灯。"],
      ["远航者Y", "很久以前，有一座把人的一生写进铃铛的王国。"],
      ["旁白", "你把手放在译码台上。三盏灯依次命名：画页、饥潮、深灯。"],
      ["澄安", "答应我一件事。别急着证明自己聪明。先听他把故事讲完。"]
    ],
    choices: [
      { id: "R00_C01", text: "保持原始顺序，一字不抢", target: "R01", effects: [{ type: "inc", key: "trust", by: 1 }], hint: "倾听 · 先让故事完整" },
      { id: "R00_C02", text: "先试探监察允许哪些词", target: "R01", effects: [{ type: "inc", key: "science", by: 1 }, { type: "inc", key: "heat", by: 1 }], hint: "试探 · 边界也会记住你" },
      { id: "R00_C03", text: "从第一句起，把所有比喻都标为情报", target: "R01", effects: [{ type: "inc", key: "risk", by: 1 }, { type: "inc", key: "science", by: 1 }], hint: "推演 · 童话可能因此变薄" }
    ]
  }),
  makeSourceNode("R01", {
    title: "被允许的谎言",
    chapter: "序章 · 被允许的谎言",
    layer: "reality",
    text: [
      ["澄安", "它不像求救，更像遗嘱；不像谎言，更像只允许以谎言形式出现的真话。"],
      ["译码员", "每一则至少有三层：表面的命运、藏起来的物理、没能直说的人。"],
      ["监察音", "通信稳定。请勿使用未经许可的科学名词。"],
      ["旁白", "译码台把三个图标投在掌心：折起的纸、没有重量的泡、一把正在旋转的黑伞。"],
      ["澄安", "如果我们只听技术，会弄丢他为什么冒险；如果只听感情，会弄丢他冒险带来的东西。"],
      ["译码员", "那就两边都不替他删。"],
      ["远航者Y", "第一盏灯亮起时，王国正迎来一个太过美丽的清晨。"],
      ["旁白", "白塔下沉。海风、铃声与一座尚不知道自己将变成纸的城市扑面而来。"]
    ],
    choices: [
      { id: "R01_C01", text: "进入第一则：画页之城", target: "T1_01", effects: [], hint: "画页灯亮起" }
    ]
  })
];

const actOne = chapterOne.nodes
  .filter((node) => /^T1_/.test(node.id))
  .map((node) => enrichLegacyNode(node, "第一则 · 画页之城"));
const actTwo = chapterTwo.nodes
  .filter((node) => /^T2_/.test(node.id))
  .map((node) => enrichLegacyNode(node, "第二则 · 饥潮之海"));
const actThree = Array.from({ length: 10 }, (_, index) => makeSourceNode(`T3_${String(index + 1).padStart(2, "0")}`));

const decodeNodes = ["R02", "R03", "R04", "R05", "R06"].map((id) => makeSourceNode(id));
decodeNodes[0].choices = [
  { id: "R02_C00", text: "监察热度已越过阈值：锁住缓存", target: "E_CENSOR", conditions: [{ key: "heat", op: "gte", value: 3 }], effects: [], hint: "通信正在被切断" },
  { id: "R02_C01", text: "优先解读画页灾害", target: "R03", conditions: [{ key: "heat", op: "lte", value: 2 }], effects: [{ type: "inc", key: "decode_flatten", by: 1 }], hint: "报告路径 · 灾害" },
  { id: "R02_C02", text: "优先解读轻泡远航", target: "R04", conditions: [{ key: "heat", op: "lte", value: 2 }], effects: [{ type: "inc", key: "decode_escape", by: 1 }], hint: "报告路径 · 远航" },
  { id: "R02_C03", text: "优先解读黑伞慢灯", target: "R05", conditions: [{ key: "heat", op: "lte", value: 2 }], effects: [{ type: "inc", key: "decode_blackdomain", by: 1 }], hint: "报告路径 · 防御" },
  { id: "R02_C04", text: "同时保留三条线索与全部代价", target: "R06", conditions: [{ key: "heat", op: "lte", value: 2 }], effects: [{ type: "inc", key: "decode_balanced", by: 1 }], hint: "困难路径 · 不删去矛盾" }
];

decodeNodes[4].choices = [
  {
    id: "R06_SECRET_H",
    text: "提交双轨黎明；再借童话回信：有一个王国，听完了",
    target: "E_FOURTH_LIGHT",
    conditions: [
      ...["clue_flatten", "clue_spread_rate", "clue_curvature", "clue_wake", "clue_slowlight", "clue_coordinate", "clue_escape", "clue_blackdomain", "act3_done", "decode_balanced"].map((key) => ({ key, op: "truthy" })),
      { key: "decode_flatten", op: "falsy" },
      { key: "decode_escape", op: "falsy" },
      { key: "decode_blackdomain", op: "falsy" },
      { key: "trust", op: "gte", value: 10 },
      { key: "science", op: "gte", value: 5 },
      { key: "risk", op: "lte", value: 3 },
      { key: "heat", op: "lte", value: 1 }
    ],
    effects: [],
    hint: "隐藏回声 · 第四盏灯正在等待"
  },
  {
    id: "R06_SECRET_I",
    text: "让第一批远舟沿恒星外缘，用白色尾迹为故乡合上一把伞",
    target: "E_WAKE_UMBRELLA",
    conditions: [
      ...["clue_flatten", "clue_spread_rate", "clue_common_origin", "clue_curvature", "clue_wake", "clue_slowlight", "clue_coordinate", "clue_escape", "clue_blackdomain", "decode_escape", "decode_balanced"].map((key) => ({ key, op: "truthy" })),
      { key: "science", op: "gte", value: 8 },
      { key: "trust", op: "gte", value: 3 },
      { key: "risk", op: "gte", value: 2 },
      { key: "risk", op: "lte", value: 7 },
      { key: "heat", op: "lte", value: 2 }
    ],
    effects: [],
    hint: "隐藏推演 · 副作用也能被选择"
  },
  {
    id: "R06_SECRET_J",
    text: "在双轨之外加入第三项：让无法离开的人，把文明写进即将到来的纸背",
    target: "E_PAPER_STARS",
    conditions: [
      ...["clue_flatten", "clue_spread_rate", "clue_coordinate", "clue_escape", "clue_blackdomain", "act3_done", "decode_flatten", "decode_balanced"].map((key) => ({ key, op: "truthy" })),
      { key: "science", op: "gte", value: 8 },
      { key: "trust", op: "gte", value: 5 },
      { key: "risk", op: "lte", value: 4 },
      { key: "heat", op: "lte", value: 1 }
    ],
    effects: [],
    hint: "隐藏提案 · 剩下的人不再是统计数字"
  },
  {
    id: "R06_TRUE",
    text: "提交双轨黎明：远航备份 + 有限慢灯 + 公开代价",
    target: "E_TRUE",
    conditions: [
      ...["clue_flatten", "clue_curvature", "clue_wake", "clue_slowlight", "clue_coordinate"].map((key) => ({ key, op: "truthy" })),
      { key: "trust", op: "gte", value: 3 },
      { key: "heat", op: "lte", value: 2 }
    ],
    effects: [],
    hint: "完整报告 · 没有一种幸存被伪装成胜利"
  },
  { id: "R06_BLACK", text: "为求一致，删去远航，只留慢灯", target: "E_BLACKDOMAIN", effects: [], hint: "单轨方案 · 安全会拿走远方" },
  { id: "R06_ESCAPE", text: "为求自由，删去慢灯，只留远航", target: "E_ESCAPE", effects: [], hint: "单轨方案 · 船不会带走所有人" },
  { id: "R06_MISSED", text: "不提交，保留童话原文等待更多证据", target: "E_MISSED", effects: [], hint: "延迟决定 · 纸边不会等待" }
];

const standardEndingIds = ["E_TRUE", "E_WARNING_ONLY", "E_ESCAPE", "E_ESCAPE_FLAWED", "E_BLACKDOMAIN", "E_BLACKDOMAIN_FLAWED", "E_MISSED", "E_CENSOR"];
const endings = standardEndingIds.map((id) => makeSourceNode(id));
endings.push(
  makeSourceNode("E_FOURTH_LIGHT", {
    title: "结局H：第四盏灯",
    location: "白塔 / 未授权回信窗口",
    text: [
      ["旁白", "双轨报告进入听证系统。光标却停在最后一页，一栏从未被任何委员会要求填写的‘附言’。"],
      ["澄安", "技术报告已经结束了。你还想翻译什么？"],
      ["译码员", "不是翻译。是回信。——从前有一个王国，听完了另一个人的三个故事。"],
      ["监察音", "未检测到公式、坐标或规避指令。附言获准发送。"],
      ["旁白", "那句话不携带方向，因此穿过了所有寻找方向的猎手。很久以后，远方讯使面前已经熄灭的三盏灯旁，亮起了第四盏。"],
      ["远航者Y", "原来童话抵达的时候，讲故事的人也会被找到。"],
      ["澄安", "你听见了吗？我们没有把你留下的选择变成纪念碑。我们让它继续被选择。"],
      ["旁白", "故乡仍开始远航，城市仍逐区慢灯；没有人因此得到完整胜利。但世界的末日，从此不再由一个人独自讲述，也不再由一个人独自听完。"],
      ["旁白", "第四盏灯没有照亮坐标。它只照亮了一句回答。"]
    ]
  }),
  makeSourceNode("E_WAKE_UMBRELLA", {
    title: "结局I：白痕为伞",
    location: "恒星系外缘 / 三十九道航迹",
    text: [
      ["译码员", "轻泡与黑伞不是两套互不相干的答案。白色尾迹，是一根尚未弯回来的伞骨。"],
      ["旁白", "三十九艘船被选中。船员都知道，当最后一道航迹闭合，没有一艘还能穿过自己留下的慢光边界回家。"],
      ["旁白", "远舟没有飞向群星。它们沿恒星系外缘分散，拖出三十九道苍白弧线，像有人用一生给太阳画圆。"],
      ["旁白", "最后两道白痕相接时，外部星光骤然变长。猎手望向这里，只看见一个沉默、迟缓、已经失去威胁的黑点。"],
      ["远航档案", "末舰未发送坐标，只发送了三十九个名字。随后，声音被合拢的伞沿拉成了无人能够听完的一声长鸣。"],
      ["旁白", "伞内的孩子仍能看见海。他们把三十九艘船画在太阳周围，并第一次明白：伞也可以撑在故乡之外。"],
      ["澄安", "他们不是离开的人，也不是留下的人。"],
      ["译码员", "他们是让这两个词仍然有区别的人。"],
      ["旁白", "此后无人能够证明故乡是否仍然活着。宇宙第一次因为不知道答案，而保护了答案。"]
    ]
  }),
  makeSourceNode("E_PAPER_STARS", {
    title: "结局J：纸背群星",
    location: "纸边前线 / 最后一座刻写城",
    text: [
      ["旁白", "远航名额有限，慢灯穹顶也不可能覆盖全部城市。报告第一次没有把剩下的人写成一个统计数字。"],
      ["译码员", "纸边既然有方向、有速度，就有可以刻写的正面。我们救不了每一个生命，但可以让每一个人决定留下什么。"],
      ["旁白", "工厂被改造成巨大的刻写阵列。人们交来的不只有基因、法律与历史，还有错题、笑话、摇篮曲，以及没有翻译方法的方言。"],
      ["澄安", "这不算活下去。"],
      ["译码员", "不算。但也不等于白白消失。"],
      ["旁白", "纸边抵达那天，远舟已经离岸，慢灯已经落下。最后一声城市钟鸣没有消散，它与海、街道和仍在仰望的人一起，被压进一层银白的薄面。"],
      ["旁白", "许多个纪元后，一艘陌生的船在死去的恒星旁发现了那一页。它用了三百年，读出第一句话。"],
      ["异星译文", "从前，有一个把每个人一生写进铃铛的王国。"],
      ["旁白", "从这一句开始，纸不再只是坟墓。它成了一封终于被拆开的信；纸背那些被压平的灯，像群星一样重新有了名字。"]
    ]
  })
);

const nodes = [...prologue, ...actOne, ...actTwo, ...actThree, ...decodeNodes, ...endings];
for (const [index, node] of nodes.entries()) {
  node.progress = node.layer === "ending" ? 1 : Number((index / (nodes.length - endings.length)).toFixed(3));
}

const story = {
  version: 1,
  id: "yun-tianming-three-fables",
  title: "云天明童话：三盏灯熄灭之前",
  presentation: {
    kicker: "一场被监察的宇宙遗言译码案",
    synopsis: "云天明被人类送往三体舰队，又在异星获得一次受监察的通话。你就是白塔译码员：听完他的三则童话，从纸、轻泡与黑伞中找出留给人类的警告和生路。",
    contentNotice: "原创化同人叙事，不复刻原著童话文本。包含宇宙灾难、牺牲、审查与苦涩结局。",
    clueLabels: {
      clue_flatten: { label: "折页", glyph: "◩", description: "画页并非画像，而是世界失去一个维度。" },
      clue_spread_rate: { label: "纸边", glyph: "▱", description: "灾害有速度，也就存在一个会关闭的窗口。" },
      clue_curvature: { label: "轻泡", glyph: "○", description: "不是推动船，而是让船前的世界先弯开。" },
      clue_wake: { label: "白痕", glyph: "⌁", description: "每次远航都会留下比船更长寿的代价。" },
      clue_slowlight: { label: "慢灯", glyph: "◐", description: "把光调慢可以隐藏，也可以把家变成牢。" },
      clue_coordinate: { label: "熄灯坐标", glyph: "✦", description: "被看见本身，就是向猎手发出的邀请。" },
      clue_escape: { label: "离岸海图", glyph: "↗", description: "远航保存的不只是人，也包括错误、名字与无用之物。" },
      clue_blackdomain: { label: "黑伞穹顶", glyph: "◒", description: "防御和囚禁之间，有时只有一个参数的距离。" }
    },
    metricLabels: {
      trust: "倾听",
      science: "推演",
      risk: "冒险",
      heat: "监察"
    },
    highlightTerms: {
      "云天明": { tone: "person", description: "被送往三体舰队、以童话向故乡传递警告的人。" },
      "远航者Y": { tone: "person", description: "云天明在受监察通信中的代号。" },
      "澄安": { tone: "person", description: "白塔通信负责人，守护话语中的人性与动机。" },
      "鹿暝": { tone: "person", description: "画页之城的年轻王子，也是玩家在童话中的主要视角。" },
      "槐姨": { tone: "person", description: "记住普通人姓名与生活的宫廷女官。" },
      "风帆卫士": { tone: "person", description: "知道远方、航路与离岸代价的航海者。" },
      "空伞师": { tone: "person", description: "掌握慢光防御，也理解庇护会变成牢笼的人。" },
      "潜灯王子": { tone: "person", description: "守在深海，保管故事最后两条生路的人。" },
      "折页匠": { tone: "warning", description: "让世界失去厚度的灾难所戴的人形面具。" },
      "译码员": { tone: "faction", description: "你在现实层的身份：拆解童话并提交最终报告。" },
      "监察音": { tone: "warning", description: "三体一方守在通信线路上的审查系统。" },
      "三体文明": { tone: "faction", description: "来自三颗太阳下、技术远胜地球的异星文明。" },
      "白塔": { tone: "faction", description: "接收通信并分析三则童话的地球译码机构。" },
      "画页": { tone: "concept", description: "世界被压成平面的灾难隐喻。" },
      "轻泡": { tone: "concept", description: "改变航路前方空间曲率的远航隐喻。" },
      "黑伞": { tone: "concept", description: "通过降低光速隐藏文明的防御隐喻。" },
      "慢灯": { tone: "concept", description: "让光与信息变慢的局部安全边界。" },
      "白痕": { tone: "concept", description: "远航在世界后方留下的长期副作用。" },
      "纸边": { tone: "warning", description: "降维灾难不断推进的边界。" },
      "坐标": { tone: "warning", description: "宇宙猎手定位文明的危险信息。" }
    }
  },
  startNode: "P00",
  variables,
  characters,
  nodes
};

const outputPath = path.join(root, "public/game/story/yun-tianming-three-fables.story.json");
writeFileSync(outputPath, `${JSON.stringify(story, null, 2)}\n`);
console.log(`Wrote ${path.relative(root, outputPath)} (${nodes.length} nodes)`);
