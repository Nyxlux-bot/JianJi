import { Colors } from './colors';
import { buildBaziThemeTokens } from './bazi-theme';

const baseColors = {
    bg: { primary: '#f6f1e7', secondary: '#eee5d5', card: '#fffaf0', elevated: '#f9f0df', input: '#f0e6d4', overlay: 'rgba(37,29,18,0.28)' },
    text: { primary: '#211b12', secondary: '#5f5445', tertiary: '#8b7d68', inverse: '#fffaf0', heading: '#120f0a' },
    accent: { gold: '#9b7017', goldLight: '#c79b3a', goldDark: '#72510f', red: '#b74d3d', redLight: '#d66b5b', jade: '#4d8a63', jadeDark: '#2d6543' },
    yao: { yang: '#9b7017', yin: '#9b7017', moving: '#b74d3d', movingBg: 'rgba(183,77,61,0.12)' },
    liushen: { qinglong: '#4d8a63', zhuque: '#b74d3d', gouchen: '#9b7017', tengshe: '#8b6c45', baihu: '#7f7769', xuanwu: '#475d78' },
    border: { subtle: '#ded2bd', normal: '#cfc0a8', accent: '#9b7017' },
};

export const WhiteColors: typeof Colors = {
    ...baseColors,
    bazi: buildBaziThemeTokens(baseColors),
};
