import { Colors } from './colors';
import { buildBaziThemeTokens } from './bazi-theme';

const baseColors = {
    bg: { primary: '#f9f6f0', secondary: '#f0ede6', card: '#ffffff', elevated: '#ffffff', input: '#f2efea', overlay: 'rgba(0,0,0,0.3)' },
    text: { primary: '#1a1b1c', secondary: '#5a5b5c', tertiary: '#8a8b8c', inverse: '#ffffff', heading: '#000000' },
    accent: { gold: '#cc3333', goldLight: '#e64d4d', goldDark: '#a32929', red: '#cc3333', redLight: '#e64d4d', jade: '#2b7a4b', jadeDark: '#1a4e2e' },
    yao: { yang: '#cc3333', yin: '#cc3333', moving: '#1a1b1c', movingBg: 'rgba(26,27,28,0.1)' },
    liushen: { qinglong: '#2b7a4b', zhuque: '#cc3333', gouchen: '#b37a24', tengshe: '#66523d', baihu: '#8a8b8c', xuanwu: '#2b3f5c' },
    border: { subtle: '#e6e3dd', normal: '#d4d1cb', accent: '#cc3333' },
};

export const WhiteColors: typeof Colors = {
    ...baseColors,
    bazi: buildBaziThemeTokens(baseColors, { brandColor: '#cc3333' }),
};
