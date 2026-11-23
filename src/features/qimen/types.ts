import type { PersistedAIChatMessage } from '../../core/ai-meta';
import type { LiuyaoSubject, WuXing } from '../../core/liuyao-data';

export type QimenGate = '休门' | '生门' | '伤门' | '杜门' | '景门' | '死门' | '惊门' | '开门';
export type QimenStar = '天蓬' | '天芮' | '天冲' | '天辅' | '天禽' | '天心' | '天柱' | '天任' | '天英';
export type QimenDun = 'yang' | 'yin';
export const QIMEN_FORMS = ['转盘', '飞盘', '星飞门转'] as const;
export const QIMEN_YEAR_RANGE = { min: 1900, max: 2100 } as const;
export const QIMEN_BOARD_VERSIONS = { 转盘: '转盘 v1', 飞盘: '鸣法 v1', 星飞门转: '透派坐山 v1' } as const;
export const QIMEN_PERIODS = ['年盘', '月盘', '日盘', '时盘'] as const;
export const QIMEN_JU_METHODS = ['chaibu', 'zhirun', 'maoshan'] as const;
export const QIMEN_SPIRIT_STYLES = ['gouchen', 'baihu'] as const;
export type QimenForm = typeof QIMEN_FORMS[number];
export type QimenPeriod = typeof QIMEN_PERIODS[number];
export type QimenJuMethod = typeof QIMEN_JU_METHODS[number];
export type QimenSpiritStyle = typeof QIMEN_SPIRIT_STYLES[number];

export interface QimenCastInput {
    form?: QimenForm;
    /** 转盘时家定局法：拆补（默认）、置闰、茅山。 */
    juMethod?: QimenJuMethod;
    /** 转盘八神名称：勾陈/朱雀（默认）或白虎/玄武。 */
    spiritStyle?: QimenSpiritStyle;
    /** 报数起局种子（1–9999）；不填则为时间起局。 */
    numberSeed?: number;
    /** 北京时间墙上时间，独立于设备时区。 */
    dateTime: string;
    location: string;
    longitude?: number;
    question: string;
    subject?: LiuyaoSubject;
    recentEvents?: string;
    timeRange?: string;
}

export interface QimenPalace {
    number: number;
    earthStem: string;
    hostedEarthStem: string | null;
    heavenStem: string | null;
    hostedHeavenStem: string | null;
    star: QimenStar | null;
    gate: QimenGate | null;
    spirit: string | null;
    voidBranches: string[];
    isHorse: boolean;
}

export interface QimenBoard {
    dun: QimenDun;
    ju: number;
    xunHead: string;
    hiddenStem: string;
    voidBranches: string[];
    horseBranch: string;
    horsePalace: number;
    chiefStar: QimenStar;
    chiefGate: QimenGate;
    chiefOrigin: number;
    chiefStarPalace: number;
    chiefGatePalace: number;
    chiefGateRawPalace: number;
    palaces: QimenPalace[];
}

export interface QimenReviewEntry {
    volume: '总断' | QimenPeriod;
    date: string;
    horizon: string;
    forecast: string;
    observation: string;
    recordedAt: string;
}

export interface QimenResult extends QimenBoard {
    /** 早期记录只有时家转盘快照。其他盘层按此盘式和保存的四柱取用。 */
    form?: QimenForm;
    juMethod?: QimenJuMethod;
    spiritStyle?: QimenSpiritStyle;
    numberSeed?: number;
    kind: 'qimen';
    id: string;
    createdAt: string;
    method: 'qimen_hour';
    ruleVersion: 'qimen-chaibu-1';
    boardVersion?: string;
    sourceId?: string;
    reviews?: QimenReviewEntry[];
    aiEvidence?: { version: string; capturedAt: string; context: string };
    timeBasis: 'clock';
    timezoneOffsetMinutes: -480;
    dayBoundary: 'zi_start';
    centerRule: 'kun';
    inputDateTime: string;
    solarDate: string;
    solarTime: string;
    location: string;
    longitude?: number;
    question: string;
    subject?: LiuyaoSubject;
    recentEvents?: string;
    timeRange?: string;
    lunarDate: string;
    fourPillars: [string, string, string, string];
    solarTerm: { name: string; at: string; nextName: string; nextAt: string };
    yuan: '上元' | '中元' | '下元';
    fuTou: string;
    aiAnalysis?: string;
    aiChatHistory?: PersistedAIChatMessage[];
    quickReplies?: string[];
}

export interface QimenPalaceInfo {
    number: number;
    name: string;
    direction: string;
    element: WuXing;
    branches: string;
    star: QimenStar;
    gate: QimenGate | null;
}
