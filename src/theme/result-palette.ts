import { getLuminance, mixHex, toRgba } from './bazi-theme';
import { WUXING_ORDER, WuXingElement } from '../features/bazi/wuxing';

/** 排盘结果页（八字、六爻、梅花）共用的宣纸 / 暗底配色。 */
export function buildResultPalette(Colors: any) {
    const isLight = getLuminance(Colors.bg.primary) > 0.42;
    const card: string = Colors.bg.card;
    const gold: string = Colors.accent.gold;
    const vermilion: string = isLight ? Colors.accent.red : Colors.accent.redLight;
    const element: Record<WuXingElement, string> = {
        木: Colors.bazi.elementWood,
        火: Colors.bazi.elementFire,
        土: Colors.bazi.elementEarth,
        金: Colors.bazi.elementMetal,
        水: Colors.bazi.elementWater,
    };
    const softWeight = isLight ? 0.1 : 0.16;
    const elementSoft = WUXING_ORDER.reduce((acc, key) => {
        acc[key] = mixHex(card, element[key], softWeight);
        return acc;
    }, {} as Record<WuXingElement, string>);

    return {
        isLight,
        page: Colors.bazi.pageBg as string,
        card,
        cardBorder: isLight ? '#ece2cf' : '#2E2E2E',
        heroBorder: isLight ? '#e9dfcb' : '#2E2E2E',
        hairline: isLight ? '#efe6d4' : '#333333',
        rule: isLight ? '#e6dac4' : '#3D3D3D',
        ink: Colors.text.primary as string,
        heading: Colors.text.heading as string,
        body: isLight ? '#4a3f31' : '#CFCFCF',
        muted: isLight ? '#7d6d55' : '#949494',
        icon: isLight ? '#5f5445' : '#BDBDBD',
        vermilion,
        sealText: '#fffaf0',
        gold,
        goldSoft: isLight ? '#f7eedb' : toRgba(gold, 0.1),
        goldBorder: isLight ? '#ead9b5' : toRgba(gold, 0.34),
        dayTint: isLight ? '#f7eedb' : toRgba(gold, 0.08),
        // 与 dayTint 同色但不透明：要压住连线的高亮块用它
        dayFill: isLight ? '#f7eedb' : mixHex(card, gold, 0.1),
        chipBg: isLight ? '#f3ead8' : '#333333',
        chipInk: isLight ? '#6f5b39' : '#C8C8C8',
        segTrack: isLight ? '#f1e8d6' : '#1A1A1A',
        segOn: isLight ? '#fffaf0' : '#333333',
        segBorder: isLight ? '#e3d6bc' : '#3D3D3D',
        barTrack: isLight ? '#f1e8d6' : '#333333',
        partySame: isLight ? '#4a3f31' : '#BDBDBD',
        partyDiff: isLight ? '#ddd0b6' : '#3D3D3D',
        relationBg: isLight ? '#f6efe2' : '#2E2E2E',
        trackCellBg: isLight ? '#fffdf8' : (Colors.bg.elevated as string),
        trackCellBorder: isLight ? '#efe6d4' : '#333333',
        tagBorder: isLight ? '#d9c9a8' : '#4A4A4A',
        chipBorder: isLight ? '#e6dbc5' : '#3D3D3D',
        timelineThin: isLight ? '#d9cdb5' : '#3D3D3D',
        timelineHollow: isLight ? '#b8a682' : '#6B6B6B',
        birthHalo: isLight ? '#f7e2dc' : toRgba(vermilion, 0.25),
        fadeFrom: toRgba(card, 0),
        // 无描边分层：页面底 → surface（低一阶）→ raised（再高一阶）
        surface: isLight ? card : '#1B1B1B',
        raised: isLight ? '#f1e8d6' : card,
        meta: isLight ? '#7d6d55' : '#949494',
        positive: isLight ? '#2f7a52' : '#54b78e',
        negative: isLight ? '#b9483e' : '#e16a5e',
        positiveSoft: isLight ? '#e3f0e6' : 'rgba(84,183,142,0.16)',
        negativeSoft: isLight ? '#f6e1dc' : 'rgba(225,106,94,0.16)',
        dialBand: isLight ? '#f3e8d2' : '#1c1b19',
        dialLine: toRgba(gold, isLight ? 0.38 : 0.32),
        dialTick: toRgba(gold, isLight ? 0.45 : 0.4),
        element,
        elementSoft,
    };
}

export type ResultPalette = ReturnType<typeof buildResultPalette>;
