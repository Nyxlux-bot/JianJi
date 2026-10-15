import { getLuminance, toRgba } from '../../../theme/bazi-theme';
import { getGanZhiElement, type WuXingElement } from '../../bazi/wuxing';
import type { ZiweiMutagen } from '../types';

/**
 * 紫微结果页的语义色，阴阳两套。取值与八字结果页同源，
 * 四化色按「禄绿 权朱 科蓝 忌墨」，阴主题整体提亮。
 */
export function buildZiweiPalette(Colors: any) {
    const isLight = getLuminance(Colors.bg.primary) > 0.42;
    const gold: string = Colors.accent.gold;
    const vermilion: string = isLight ? Colors.accent.red : Colors.accent.redLight;
    const element: Record<WuXingElement, string> = {
        木: Colors.bazi.elementWood,
        火: Colors.bazi.elementFire,
        土: Colors.bazi.elementEarth,
        金: Colors.bazi.elementMetal,
        水: Colors.bazi.elementWater,
    };
    const mutagen: Record<ZiweiMutagen, string> = isLight
        ? { 禄: '#2F7A4A', 权: '#B74D3D', 科: '#2D5B8C', 忌: '#211b12' }
        : { 禄: '#5DB57A', 权: '#E8664F', 科: '#7FA6D8', 忌: '#E8E8E8' };

    return {
        isLight,
        page: Colors.bg.primary as string,
        card: Colors.bg.card as string,
        cardBorder: isLight ? '#ece2cf' : '#2E2E2E',
        grid: isLight ? '#e6dac4' : '#363636',
        hairline: isLight ? '#efe6d4' : '#333333',
        ink: Colors.text.primary as string,
        heading: Colors.text.heading as string,
        body: isLight ? '#4a3f31' : '#CFCFCF',
        muted: isLight ? '#7d6d55' : '#949494',
        faint: isLight ? '#a99b83' : '#6E6E6E',
        icon: isLight ? '#5f5445' : '#BDBDBD',
        vermilion,
        sealText: '#fffaf0',
        gold,
        goldSoft: isLight ? '#f7eedb' : toRgba(gold, 0.1),
        goldBorder: isLight ? '#e2cc98' : toRgba(gold, 0.38),
        selectedTint: isLight ? '#fbf1ec' : toRgba(vermilion, 0.1),
        triadLine: isLight ? toRgba(vermilion, 0.38) : toRgba(vermilion, 0.45),
        chipBg: isLight ? '#f3ead8' : '#333333',
        chipInk: isLight ? '#6f5b39' : '#C8C8C8',
        segTrack: isLight ? '#f1e8d6' : '#1A1A1A',
        segOn: isLight ? '#fffaf0' : '#333333',
        segBorder: isLight ? '#e3d6bc' : '#3D3D3D',
        trackCell: isLight ? '#fffdf8' : '#2A2A2A',
        relationBg: isLight ? '#f6efe2' : '#2E2E2E',
        scrim: isLight ? 'rgba(18,14,8,0.52)' : 'rgba(0,0,0,0.62)',
        sheetShadow: isLight ? 'rgba(80,60,20,0.10)' : 'rgba(0,0,0,0.5)',
        jiText: isLight ? '#fffaf0' : '#121212',
        mutagen,
        element,
        sealOpacity: isLight ? 0.19 : 0.23,
    };
}

export type ZiweiPalette = ReturnType<typeof buildZiweiPalette>;

export function ganzhiColor(char: string, palette: ZiweiPalette): string {
    const element = getGanZhiElement(char);
    return element ? palette.element[element] : palette.ink;
}
