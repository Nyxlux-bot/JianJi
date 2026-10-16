import type { PersistedAIChatMessage } from '../../core/ai-meta';
import type { LunarDate } from '../../core/lunar';
import type { LiuyaoSubject } from '../../core/liuyao-data';

/** 起卦时用户填写的附加信息 */
export type MeihuaCastContext = Pick<MeihuaResult, 'subject' | 'recentEvents' | 'timeRange'>;

/** 存储用 method；带前缀，避免旧数据回退逻辑把裸 time/number 当成六爻。 */
export type MeihuaMethod = 'meihua_time' | 'meihua_number';

export const MEIHUA_METHOD_LABEL: Record<MeihuaMethod, string> = {
    meihua_time: '时间起卦',
    meihua_number: '数字起卦',
};

export interface MeihuaHexagram {
    /** 上卦先天数 1-8 */
    upper: number;
    /** 下卦先天数 1-8 */
    lower: number;
    /** 初爻→上爻，1 阳 0 阴 */
    lines: number[];
    name: string;
    fullName: string;
}

export interface MeihuaNumberSource {
    label: string;
    source: string;
    value: number;
}

export interface MeihuaResult {
    kind: 'meihua';
    id: string;
    createdAt: string;
    method: MeihuaMethod;
    question: string;
    solarDate: string;
    solarTime: string;
    lunarInfo: LunarDate;
    jieqi: { current: string; currentDate: string; next: string; nextDate: string };
    /** 取数来源，按表格从左到右 */
    numbers: MeihuaNumberSource[];
    /** 上卦、下卦、动爻的算式 */
    formulas: { upper: string; lower: string; moving: string };
    /** 动爻 1-6 */
    movingLine: number;
    ben: MeihuaHexagram;
    hu: MeihuaHexagram;
    bian: MeihuaHexagram;
    /** 体卦所在：动爻在上卦则体在下卦 */
    tiPosition: 'upper' | 'lower';
    /** 起卦主体：男、女或其他（物种、物品等） */
    subject?: LiuyaoSubject;
    /** 用户补充的近期事件（选填） */
    recentEvents?: string;
    /** 想看的时间范围（选填） */
    timeRange?: string;
    aiAnalysis?: string;
    aiChatHistory?: PersistedAIChatMessage[];
    quickReplies?: string[];
}
