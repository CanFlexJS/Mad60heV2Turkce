"use strict";
const HERO_NAMES_ZH = {
  astra: "星礈",
  breach: "铁臂",
  brimstone: "炼狱",
  chamber: "尚勃勒",
  clove: "暮蝶",
  cypher: "零",
  deadlock: "钢锁",
  fade: "黑梦",
  gekko: "盖可",
  harbor: "海神",
  iso: "壹决",
  jett: "捷风",
  kayo: "K/O",
  killjoy: "奇乐",
  miks: "迷核",
  neon: "霓虹",
  omen: "幽影",
  phoenix: "不死鸟",
  raze: "雷兹",
  reyna: "芮娜",
  sage: "贤者",
  skye: "斯凯",
  sova: "猎枭",
  tejo: "钛狐",
  veto: "禁灭",
  viper: "蝰蛇",
  vyse: "维斯",
  waylay: "幻棱",
  yoru: "夜露"
};
const HERO_SLUGS = [
  "astra",
  "breach",
  "brimstone",
  "chamber",
  "clove",
  "cypher",
  "deadlock",
  "fade",
  "gekko",
  "harbor",
  "iso",
  "jett",
  "kayo",
  "killjoy",
  "miks",
  "neon",
  "omen",
  "phoenix",
  "raze",
  "reyna",
  "sage",
  "skye",
  "sova",
  "tejo",
  "veto",
  "viper",
  "vyse",
  "waylay",
  "yoru"
];
const ABILITY_SLOTS = [
  { slot: 1, key: "C" },
  { slot: 2, key: "Q" },
  { slot: 3, key: "E" },
  { slot: 4, key: "X" }
];
function titleCase(slug) {
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}
const VALORANT_HEROES = HERO_SLUGS.map((slug) => ({
  id: slug,
  name: titleCase(slug),
  nameZh: HERO_NAMES_ZH[slug] ?? titleCase(slug),
  abilities: ABILITY_SLOTS.map(({ slot, key }) => ({
    key,
    name: `${titleCase(slug)} ${key}`,
    nameZh: `${HERO_NAMES_ZH[slug] ?? titleCase(slug)} ${key}`,
    iconPath: `hero/${slug}/${slot}.png`
  }))
}));
function findValorantHero(id) {
  return VALORANT_HEROES.find((h) => h.id === id);
}
const VALORANT_REF_WIDTH = 2560;
const VALORANT_REF_HEIGHT = 1440;
const VALORANT_SKILL_ICON = {
  x: 1002,
  y: 1308,
  blockWidth: 150
};
const VALORANT_SKILL_HUD_GATE = {
  edgeRatioThreshold: 0.07,
  cannyLow: 50,
  cannyHigh: 150,
  cannyAperture: 3,
  /** 连续 N 帧一致才切换门控状态，抑制闪烁 */
  stableFrames: 2
};
const VALORANT_SKILL_ENERGY = {
  /** 相对 skill_icon 左上角的偏移（槽 0 / C），使充能条居中于图标 */
  offsetX: 1018 - 1002,
  y: 1380,
  height: 30,
  /** 充能条实际宽度（居中于图标下方，对应 heroes.json skill_energy.width） */
  width: 70,
  /**
   * minWidth/minHeight/maxHeight 均为 2560×1440 参考像素；检测时按裁剪尺寸折算到裁剪空间
   * （scaleX=w/width, scaleY=h/height）。minHeight/maxHeight 界定「细横条」竖直跨度的下/上限，
   * 用于把充能条与手臂/特效等大色块区分开（见 skillEnergyDetector.detectEnergyBarCharges）。
   * minWidth 取较小值（折算后 minSegW≈6）：双充能条（如 Jett C）中间偏高的内侧列会被 maxHeight
   * 跨度门控排除，使每条「能计数的平整段」比实际窄；若 minSegW 卡在该平整段宽度附近，抗锯齿的
   * 1px 抖动就会让某条时计时不计，造成 2↔1 充能反复跳变。放宽 minWidth 给平整段留余量即可消除。
   */
  minWidth: 8,
  minHeight: 10,
  maxHeight: 20,
  /**
   * 充能「可用/段数」需连续 N 帧一致才翻转：既抑制手臂扫过技能区的单帧误判，也压住双充能条
   * 分段在临界宽度附近的逐帧抖动（见 recognitionService.stabilizeAbility）。
   */
  confirmFrames: 3
};
const VALORANT_ABILITY_KEYS = ["C", "Q", "E", "X"];
const VALORANT_ULTIMATE_MAX_POINTS = 7;
function abilityKeyToSlotIndex(key) {
  const idx = VALORANT_ABILITY_KEYS.indexOf(key);
  return idx >= 0 ? idx : 0;
}
function getSkillHudGatePixelRect() {
  const bottomY = VALORANT_SKILL_ENERGY.y + VALORANT_SKILL_ENERGY.height;
  return {
    x: VALORANT_SKILL_ICON.x,
    y: VALORANT_SKILL_ICON.y,
    width: VALORANT_SKILL_ICON.blockWidth * 4,
    height: bottomY - VALORANT_SKILL_ICON.y
  };
}
function getSkillEnergyPixelRect(slotIndex) {
  const baseX = VALORANT_SKILL_ICON.x + slotIndex * VALORANT_SKILL_ICON.blockWidth;
  return {
    x: baseX + VALORANT_SKILL_ENERGY.offsetX,
    y: VALORANT_SKILL_ENERGY.y,
    width: VALORANT_SKILL_ENERGY.width,
    height: VALORANT_SKILL_ENERGY.height
  };
}
const VALORANT_HP_CONFIG = {
  area: { x: 770, y: 1345, width: 100, height: 45 }
};
const VALORANT_KILL_CONFIG = {
  killArea: { x: 1140, y: 1010, width: 280, height: 280 },
  /**
   * kill_detector.onnx 对击杀区 128×128 灰度图输出单个 logit：正=击杀横幅存在，负=不存在
   * （离线实测：存在≈+8~+18，不存在≈−4~−6）。横幅出现后停留约 1s 再淡出，故按「上升沿」触发，
   * 用迟滞阈值（enter>exit）吸收淡入淡出抖动。阈值取存在/不存在之间且偏向不存在以保召回；
   * 实机标定看 `[svc] kill score=` 日志（仅 score≥exitThreshold 的帧才打印，正常对局零刷屏）。
   */
  enterThreshold: 1,
  exitThreshold: 0,
  /** 连续 N 帧 ≥enterThreshold 才确认横幅出现，滤除单帧尖峰（横幅停留约 15 帧，不损召回） */
  enterFrames: 2,
  cooldownMs: 1500
};
const VALORANT_WIN_CONFIG = {
  /**
   * 回合结算文字区（2560×1440 基准）：源自 heroes.json round_config.text_area，
   * 经真机 2560×1440 截图核对，正好框住居中的「获胜」绿色横幅文字。
   */
  winArea: { x: 1160, y: 210, width: 240, height: 115 },
  /**
   * OCR 文本（去空白、大写后）含其一即判胜利；只匹配胜利词，故「失败/DEFEAT」不会触发。
   * 国服回合胜利横幅实测为「获胜」（非「胜利」），见真机截图。
   */
  winKeywords: ["获胜", "胜利", "VICTORY", "WIN"],
  /** 命中关键词时的最小 OCR 置信度（低于此判为误读，不计分） */
  enterThreshold: 0.5,
  /** 跌破此分判定横幅消失，等待下一回合（迟滞，enter>exit 吸收淡入淡出） */
  exitThreshold: 0.35,
  /**
   * 连续 N 次「跑了 OCR 且命中」才确认。OCR 关键词匹配精度高且结算文字静止时会被指纹降频跳过，
   * 故取 1（命中即发），靠冷却防重复。
   */
  enterFrames: 1,
  cooldownMs: 3e3
};
const VALORANT_DEFEAT_CONFIG = {
  /** 回合结算文字区（2560×1440 基准）：与 winArea 完全相同，框住居中的「败北」红色横幅文字 */
  defeatArea: { x: 1160, y: 210, width: 240, height: 115 },
  /**
   * OCR 文本（去空白、大写后）含其一即判失败；只匹配失败词，故「获胜/VICTORY」不会触发。
   * 国服回合失败横幅实测为「败北」，另兼容「失败/DEFEAT/LOST」。
   */
  defeatKeywords: ["败北", "失败", "DEFEAT", "LOST"],
  /**
   * 命中关键词时的最小 OCR 置信度（低于此判为误读，不计分）。
   * 故意低于胜利的 0.5：败北横幅为红色，PP-OCR 在红字上的置信度系统性偏低，且灰度指纹
   * （0.587G vs 0.299R）对红字淡入不敏感、淡入期 OCR 试跑次数也更少——同用 0.5 会让败北
   * 长期踩不过闸门、触发明显慢于胜利。关键词命中本身已是强证据，故置信度门放宽到 0.35。
   * 仍嫌慢可继续下调，但需看 `[svc] result ocr text="败北" conf=…` 实测值，别低于其稳定区间。
   */
  enterThreshold: 0.35,
  /** 跌破此分判定横幅消失，等待下一回合（迟滞，须 enter>exit 吸收淡入淡出） */
  exitThreshold: 0.25,
  /** 同胜利：命中即发，靠冷却防重复 */
  enterFrames: 1,
  cooldownMs: 3e3
};
const VALORANT_AGENT_SELECT_ICONS = {
  searchAreas: [{ name: "role_filter", x: 20, y: 80, width: 600, height: 220 }],
  threshold: 0.55,
  /** 连续 N 帧命中才确认，避免对局场景里单帧误匹配清空英雄 */
  stableFrames: 2,
  icons: [
    {
      name: "role_duelist",
      templatePath: "/templates/valorant/game/role_duelist.png",
      threshold: 0.55
    },
    {
      name: "role_controller",
      templatePath: "/templates/valorant/game/role_controller.png",
      threshold: 0.55
    },
    {
      name: "role_initiator",
      templatePath: "/templates/valorant/game/role_initiator.png",
      threshold: 0.55
    },
    {
      name: "role_sentinel",
      templatePath: "/templates/valorant/game/role_sentinel.png",
      threshold: 0.55
    }
  ]
};
const VALORANT_MENU_ICONS = {
  searchArea: { x: 2180, y: 0, width: 380, height: 220 },
  /**
   * 梯度 NCC 峰值阈值；命中任一图标即判定菜单已打开。齿轮(⚙)是高频细齿结构，NCC 天然低于简单的 ✕，
   * 故阈值取 0.5 偏宽（误判代价仅为「真离开对局时多保持一帧已锁英雄」，风险低）。
   * 分图标分数 + 命中尺度看 `[svc] menuIcon` 日志，据此精调阈值或尺度。
   */
  threshold: 0.5,
  icons: [
    { name: "menu_close", templatePath: "/templates/valorant/game/close.png", threshold: 0.5 },
    { name: "menu_settings", templatePath: "/templates/valorant/game/settings_gear.png", threshold: 0.4 }
  ]
};
const VALORANT_ADAPTER = {
  name: "Valorant",
  windowTitle: "VALORANT",
  templateBasePath: "/templates/valorant",
  uiPositions: {
    heroPortrait: { x: 0.02, y: 0.85, width: 0.08, height: 0.12 },
    skillBar: { x: 0.3914, y: 0.9083, width: 0.2148, height: 0.0438 },
    abilities: [
      { key: "C", x: 0.3914, y: 0.9083, width: 0.0398, height: 0.0438 },
      { key: "Q", x: 0.45, y: 0.9083, width: 0.0398, height: 0.0438 },
      { key: "E", x: 0.5086, y: 0.9083, width: 0.0398, height: 0.0438 },
      { key: "X", x: 0.5672, y: 0.9083, width: 0.0398, height: 0.0438 }
    ]
  },
  heroes: VALORANT_HEROES
};
const VALORANT_MODEL_CONFIGS = [
  {
    id: "valorantHp",
    path: "hp.onnx",
    type: "onnx",
    inputShape: [1, 1, 32, 64],
    outputType: "hp_digits",
    normalize: "0-1",
    description: "Valorant HP E2E"
  },
  {
    id: "valorantKill",
    path: "templates/valorant/kill/kill_detector.onnx",
    type: "onnx",
    inputShape: [1, 1, 128, 128],
    outputType: "features",
    normalize: "0-1",
    description: "Valorant kill features"
  },
  {
    id: "valorantOcr",
    path: "ocr.onnx",
    type: "onnx",
    inputShape: [1, 3, 48, 320],
    outputType: "ocr",
    normalize: "-1-1",
    labelsPath: "ocr_keys.txt",
    custom: {
      dynamicWidth: true,
      minWidth: 16,
      maxWidth: 512,
      ocrCharset: "ppocr",
      alreadySoftmax: true
    },
    description: "Valorant OCR"
  }
];
function computeLetterboxTransform(frameWidth, frameHeight) {
  const scale = Math.min(frameWidth / VALORANT_REF_WIDTH, frameHeight / VALORANT_REF_HEIGHT);
  const contentWidth = VALORANT_REF_WIDTH * scale;
  const contentHeight = VALORANT_REF_HEIGHT * scale;
  const offsetX = (frameWidth - contentWidth) / 2;
  const offsetY = (frameHeight - contentHeight) / 2;
  return { scale, offsetX, offsetY, contentWidth, contentHeight };
}
function mapRelativeRect(relative, frameWidth, frameHeight) {
  const t = computeLetterboxTransform(frameWidth, frameHeight);
  return {
    x: Math.round(relative.x * VALORANT_REF_WIDTH * t.scale + t.offsetX),
    y: Math.round(relative.y * VALORANT_REF_HEIGHT * t.scale + t.offsetY),
    width: Math.round(relative.width * VALORANT_REF_WIDTH * t.scale),
    height: Math.round(relative.height * VALORANT_REF_HEIGHT * t.scale)
  };
}
function mapPixelRect(rect, frameWidth, frameHeight) {
  const t = computeLetterboxTransform(frameWidth, frameHeight);
  return {
    x: Math.round(rect.x * t.scale + t.offsetX),
    y: Math.round(rect.y * t.scale + t.offsetY),
    width: Math.round(rect.width * t.scale),
    height: Math.round(rect.height * t.scale)
  };
}
exports.VALORANT_ABILITY_KEYS = VALORANT_ABILITY_KEYS;
exports.VALORANT_ADAPTER = VALORANT_ADAPTER;
exports.VALORANT_AGENT_SELECT_ICONS = VALORANT_AGENT_SELECT_ICONS;
exports.VALORANT_DEFEAT_CONFIG = VALORANT_DEFEAT_CONFIG;
exports.VALORANT_HEROES = VALORANT_HEROES;
exports.VALORANT_HP_CONFIG = VALORANT_HP_CONFIG;
exports.VALORANT_KILL_CONFIG = VALORANT_KILL_CONFIG;
exports.VALORANT_MENU_ICONS = VALORANT_MENU_ICONS;
exports.VALORANT_MODEL_CONFIGS = VALORANT_MODEL_CONFIGS;
exports.VALORANT_SKILL_ENERGY = VALORANT_SKILL_ENERGY;
exports.VALORANT_SKILL_HUD_GATE = VALORANT_SKILL_HUD_GATE;
exports.VALORANT_ULTIMATE_MAX_POINTS = VALORANT_ULTIMATE_MAX_POINTS;
exports.VALORANT_WIN_CONFIG = VALORANT_WIN_CONFIG;
exports.abilityKeyToSlotIndex = abilityKeyToSlotIndex;
exports.findValorantHero = findValorantHero;
exports.getSkillEnergyPixelRect = getSkillEnergyPixelRect;
exports.getSkillHudGatePixelRect = getSkillHudGatePixelRect;
exports.mapPixelRect = mapPixelRect;
exports.mapRelativeRect = mapRelativeRect;
