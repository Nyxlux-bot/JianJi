import { Colors } from './colors';
import { buildBaziThemeTokens } from './bazi-theme';

// 文字与金色按对比度 ≥ 4.5:1 校过：tertiary #76674f、gold #8a6312（金底上的反色字 5.2:1）；
// 输入框边框 ≥ 3:1；遮罩加深到能压住底下的页面。爻线、勾陈仍用原来的 #9b7017。
const baseColors = {
    bg: { primary: '#f6f1e7', secondary: '#eee5d5', card: '#fffaf0', elevated: '#f9f0df', input: '#f0e6d4', overlay: 'rgba(37,29,18,0.42)' },
    text: { primary: '#211b12', secondary: '#5f5445', tertiary: '#76674f', inverse: '#fffaf0', heading: '#120f0a' },
    accent: { gold: '#8a6312', goldLight: '#c79b3a', goldDark: '#72510f', red: '#b74d3d', redLight: '#d66b5b', jade: '#4d8a63', jadeDark: '#2d6543' },
    yao: { yang: '#9b7017', yin: '#9b7017', moving: '#b74d3d', movingBg: 'rgba(183,77,61,0.12)' },
    liushen: { qinglong: '#4d8a63', zhuque: '#b74d3d', gouchen: '#9b7017', tengshe: '#8b6c45', baihu: '#7f7769', xuanwu: '#475d78' },
    border: { subtle: '#ded2bd', normal: '#cfc0a8', accent: '#8a6312', input: '#9c8b70' },
};

export const WhiteColors: typeof Colors = {
    ...baseColors,
    bazi: buildBaziThemeTokens(baseColors),
};
