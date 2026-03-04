/**
 * 时令辅助计算
 * - 月将：按节气实时推导（中气锚点 + 区间继承）
 * - 月相：基于朔望月的近似角度计算
 */

import { SOLAR_TERM_NAMES } from './lunar';

export interface MonthGeneral {
    zhi: string;
    name: string;
    basedOnTerm: string;
}

export interface MoonPhase {
    name: string;
    ageDays: number;
    illuminationPct: number;
    angleDeg: number;
}

const MONTH_GENERAL_NAME_BY_ZHI: Record<string, string> = {
    '子': '神后',
    '丑': '大吉',
    '寅': '功曹',
    '卯': '太冲',
    '辰': '天罡',
    '巳': '太乙',
    '午': '胜光',
    '未': '小吉',
    '申': '传送',
    '酉': '从魁',
    '戌': '河魁',
    '亥': '登明',
};

const ANCHOR_TERMS: string[] = [
    '雨水', '春分', '谷雨', '小满', '夏至', '大暑',
    '处暑', '秋分', '霜降', '小雪', '冬至', '大寒',
];

const MONTH_GENERAL_BY_ANCHOR: Record<string, string> = {
    '雨水': '亥',
    '春分': '戌',
    '谷雨': '酉',
    '小满': '申',
    '夏至': '未',
    '大暑': '午',
    '处暑': '巳',
    '秋分': '辰',
    '霜降': '卯',
    '小雪': '寅',
    '冬至': '丑',
    '大寒': '子',
};

const MONTH_GENERAL_BY_MONTH_ZHI: Record<string, string> = {
    '寅': '亥',
    '卯': '戌',
    '辰': '酉',
    '巳': '申',
    '午': '未',
    '未': '午',
    '申': '巳',
    '酉': '辰',
    '戌': '卯',
    '亥': '寅',
    '子': '丑',
    '丑': '子',
};

function normalizeToMonthGeneral(zhi: string, basedOnTerm: string): MonthGeneral {
    const name = MONTH_GENERAL_NAME_BY_ZHI[zhi] || '神后';
    return {
        zhi: MONTH_GENERAL_NAME_BY_ZHI[zhi] ? zhi : '子',
        name,
        basedOnTerm,
    };
}

/**
 * 月将推导（按当前节气向前寻找最近中气锚点）
 */
export function getMonthGeneralByJieqi(currentTerm: string, monthZhiFallback?: string): MonthGeneral {
    const termIdx = SOLAR_TERM_NAMES.indexOf(currentTerm as any);

    if (termIdx !== -1) {
        const anchorCandidates = ANCHOR_TERMS
            .map(term => ({ term, idx: SOLAR_TERM_NAMES.indexOf(term as any) }))
            .filter(x => x.idx !== -1)
            .sort((a, b) => a.idx - b.idx);

        let chosen = anchorCandidates[anchorCandidates.length - 1];
        for (const candidate of anchorCandidates) {
            if (candidate.idx <= termIdx) {
                chosen = candidate;
            } else {
                break;
            }
        }

        const zhi = MONTH_GENERAL_BY_ANCHOR[chosen.term];
        if (zhi) return normalizeToMonthGeneral(zhi, chosen.term);
    }

    if (monthZhiFallback && MONTH_GENERAL_BY_MONTH_ZHI[monthZhiFallback]) {
        return normalizeToMonthGeneral(
            MONTH_GENERAL_BY_MONTH_ZHI[monthZhiFallback],
            `月支兜底:${monthZhiFallback}`
        );
    }

    return normalizeToMonthGeneral('子', '默认兜底');
}

const SYNODIC_MONTH = 29.530588853;
const DAY_MS = 86400000;
const BASE_NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14, 0);
const PHASE_NAMES = ['朔月', '娥眉月', '上弦月', '盈凸月', '望月', '亏凸月', '下弦月', '残月'] as const;

/**
 * 月相推导（朔望月近似）
 */
export function getMoonPhase(date: Date): MoonPhase {
    const t = date.getTime();
    const lunarAgeRaw = ((t - BASE_NEW_MOON_MS) / DAY_MS) % SYNODIC_MONTH;
    const ageDays = (lunarAgeRaw + SYNODIC_MONTH) % SYNODIC_MONTH;
    const angleDeg = (ageDays / SYNODIC_MONTH) * 360;
    const illumination = (1 - Math.cos((angleDeg * Math.PI) / 180)) / 2;

    const phaseIndex = Math.floor((angleDeg + 22.5) / 45) % 8;

    return {
        name: PHASE_NAMES[phaseIndex],
        ageDays: Number(ageDays.toFixed(2)),
        illuminationPct: Math.round(illumination * 100),
        angleDeg: Number(angleDeg.toFixed(2)),
    };
}
