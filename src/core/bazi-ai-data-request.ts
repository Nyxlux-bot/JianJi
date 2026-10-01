import type { BaziAIWorkflowStage, PersistedAIChatMessage } from './ai-meta';
import type { BaziFormatterContext } from './bazi-ai-context';
import type { BaziAIEvidenceRequest } from './bazi-ai-evidence';
import type { BaziResult } from './bazi-types';

export const BAZI_FORECAST_YEARS = 5;

function yearRange(from: number, to: number): number[] {
    return Array.from({ length: Math.max(0, to - from + 1) }, (_, index) => from + index);
}

function requestedYears(text: string, currentYear: number): number[] {
    const years = new Set<number>();
    for (const match of text.matchAll(/(?<!\d)(\d{4})\s*(?:年)?\s*(?:到|至|—|–|-|~|～)\s*(\d{4})(?!\d)/g)) {
        const from = Number(match[1]);
        const to = Number(match[2]);
        if (to < from || to - from > 100) throw new Error('请将分析年份范围限定为顺序排列的 100 年以内。');
        yearRange(from, to).forEach((year) => years.add(year));
    }
    for (const match of text.matchAll(/(?<!\d)(\d{4})(?!\d)(?!\s*(?:元|万|块))/g)) years.add(Number(match[1]));
    const relativeYears = [['前年', -2], ['去年', -1], ['今年', 0], ['明年', 1], ['后年', 2]] as const;
    relativeYears.forEach(([label, offset]) => { if (text.includes(label)) years.add(currentYear + offset); });
    for (const match of text.matchAll(/(过去|未来|今后|接下来)\s*([1-9]\d?|[一二三四五六七八九十])\s*年/g)) {
        const count = Number(match[2]) || '一二三四五六七八九十'.indexOf(match[2]) + 1;
        const from = match[1] === '过去' ? currentYear - count : currentYear + 1;
        const to = match[1] === '过去' ? currentYear - 1 : currentYear + count;
        yearRange(from, to).forEach((year) => years.add(year));
    }
    return [...years].sort((a, b) => a - b);
}

/** 决定取数范围的是应用阶段及用户原话，旧提示词中的年份不参与选取。 */
export function resolveBaziEvidenceRequest(
    result: BaziResult,
    stage: BaziAIWorkflowStage,
    asOf: Date,
    messages: PersistedAIChatMessage[] = [],
    context?: BaziFormatterContext,
): BaziAIEvidenceRequest {
    if (stage === 'foundation' || stage === 'kinship') return { scope: 'natal' };
    const currentYear = asOf.getFullYear();
    if (stage === 'verification') {
        return { scope: 'historical', years: yearRange(Number(result.solarDate.slice(0, 4)), currentYear), monthYears: [] };
    }
    if (stage === 'five_year') {
        return { scope: 'forecast', years: yearRange(currentYear, currentYear + BAZI_FORECAST_YEARS), monthYears: [] };
    }
    const text = stage === 'kinship_review'
        ? Object.values(result.aiKinshipVerification?.actualFeedback ?? {}).join('\n')
        : [...messages].reverse().find((message) => message.role === 'user')?.content ?? '';
    let years = requestedYears(text, currentYear);
    const monthly = /流月|月份|[个哪逐每本下上]月|(?<!\d)\d{1,2}\s*月|[一二三四五六七八九十腊正]月/u.test(text);
    if (years.length === 0 && monthly) {
        const selection = context?.fortuneSelection;
        const focusYear = selection?.mode === 'xiaoyun'
            ? result.xiaoYun[selection.selectedXiaoYunIndex]?.year
            : selection ? result.daYun[selection.selectedDaYunIndex]?.liuNian[selection.selectedLiuNianIndex]?.year : undefined;
        const relativeMonth = /上个?月/u.test(text) ? -1 : /下个?月/u.test(text) ? 1 : /本月|这个月|当月/u.test(text) ? 0 : undefined;
        years = [relativeMonth === undefined ? focusYear ?? currentYear
            : new Date(currentYear, asOf.getMonth() + relativeMonth, 1).getFullYear()];
    }
    if (stage === 'kinship_review') {
        const historicalYears = years.filter((year) => year <= currentYear);
        return historicalYears.length
            ? { scope: 'focused', years: historicalYears, monthYears: monthly ? historicalYears : [] }
            : { scope: 'natal' };
    }
    return years.length
        ? { scope: 'focused', years, monthYears: monthly ? years : [] }
        : { scope: 'forecast', years: yearRange(currentYear, currentYear + BAZI_FORECAST_YEARS), monthYears: [] };
}
