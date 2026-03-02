/**
 * 六爻排盘 - 新中式禅意设计系统色彩
 */
export const Colors = {
  // 背景色
  bg: {
    primary: '#121212',      // 主背景（深灰近黑）
    secondary: '#1A1A1A',    // 次级背景
    card: '#242424',         // 卡片背景
    elevated: '#2A2A2A',     // 高层级背景
    input: '#181818',        // 输入框背景
    overlay: 'rgba(0,0,0,0.6)', // 遮罩
  },

  // 文字色
  text: {
    primary: '#E0E0E0',      // 主文字（浅灰色）
    secondary: '#A0A0A0',    // 次要文字（中灰）
    tertiary: '#707070',     // 更弱文字（深灰）
    inverse: '#121212',      // 反色文字
    heading: '#FFFFFF',      // 标题（纯白）
  },

  // 强调色
  accent: {
    gold: '#CFB53B',         // 金色（主强调）
    goldLight: '#EAD576',    // 浅金
    goldDark: '#AA8C22',     // 深金
    red: '#C64D3E',          // 朱红（动爻/警示）
    redLight: '#DF6658',     // 浅朱红
    jade: '#5C9A7B',         // 翡翠绿
    jadeDark: '#3A7A5C',     // 暗翡
  },

  // 爻线色
  yao: {
    yang: '#CFB53B',         // 阳爻（金色实线）
    yin: '#CFB53B',          // 阴爻（金色断线）
    moving: '#C64D3E',       // 动爻（朱红）
    movingBg: 'rgba(198,77,62,0.15)', // 动爻背景
  },

  // 六神色
  liushen: {
    qinglong: '#5C9A7B',     // 青龙（翠绿）
    zhuque: '#C64D3E',       // 朱雀（朱红）
    gouchen: '#CFB53B',      // 勾陈（金）
    tengshe: '#8C857B',      // 螣蛇（冷褐）
    baihu: '#D0D0D0',        // 白虎（银白）
    xuanwu: '#486C8C',       // 玄武（深灰蓝）
  },

  // 边框
  border: {
    subtle: '#2E2E2E',       // 微弱边框
    normal: '#424242',       // 普通边框
    accent: '#CFB53B',       // 强调边框
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40,
};

export const FontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 18,
  xl: 22,
  xxl: 28,
  xxxl: 36,
  giant: 44,
};

export const BorderRadius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  round: 100,
};
