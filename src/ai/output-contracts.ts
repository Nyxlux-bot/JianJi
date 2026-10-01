import type { BaziAIConversationDigest, ZiweiAIConversationDigest } from '../core/ai-meta';
import type { KinshipPrediction } from '../core/bazi-kinship';

export const BAZI_DIGEST_OUTPUT = {
    foundation: { dayMaster: '', structure: '', favorableGod: '', unfavorableGod: '', personality: '' },
    verificationSummary: '', fiveYearSummary: '', rollingSummary: '', topicNotes: { wealth: '', relationship: '', career: '' },
} satisfies Omit<BaziAIConversationDigest, 'version' | 'generatedAt'>;
export const ZIWEI_DIGEST_OUTPUT = {
    foundation: { lifeTheme: '', mingPalace: '', bodySoul: '', mutagenDynamics: '', personality: '' },
    verificationSummary: '', fiveYearSummary: '', rollingSummary: '', topicNotes: { wealth: '', relationship: '', career: '' },
    verificationTimeline: [], yearlyOutlook: {}, focusAnchors: {},
} satisfies Omit<ZiweiAIConversationDigest, 'version' | 'generatedAt'>;
export const KINSHIP_PREDICTION_OUTPUT = {
    kind: 'kinship', family: {
        onlyChild: null, birthOrder: null,
        siblings: { olderBrothers: null, olderSisters: null, youngerBrothers: null, youngerSisters: null },
        evidenceIds: [], basis: '简短说明实际支持判断的盘据；看不准的部分直说',
    },
} satisfies KinshipPrediction;
export const LIUYAO_QUICK_REPLIES_OUTPUT = { quickReplies: ['追问1', '追问2', '追问3'] };

/**
 * Chapter contracts: the single source for both the "输出格式" section sent to
 * the model and the lenient layout parser in src/ai/layout/parse-chapter.ts.
 * The model always writes complete Markdown; the parser only reads structure
 * from it and never rejects content that does not match.
 */
export type ChapterContractEngine = 'bazi' | 'ziwei';

export interface ChapterFieldContract {
    key: 'basis' | 'luck' | 'detail';
    label: string;
    /** Other labels models tend to write for the same field. */
    aliases: readonly string[];
}

export const VERIFICATION_CONTRACT = {
    minEvents: 3,
    maxEvents: 5,
    summaryMaxChars: 16,
    fields: [
        { key: 'basis', label: '依据', aliases: ['命理依据', '盘据', '命盘依据', '星曜依据'] },
        { key: 'luck', label: '运限', aliases: ['对应运限', '大运流年', '岁运', '大限流年', '运限层'] },
        { key: 'detail', label: '推演', aliases: ['推演说明', '可能应事', '应事', '说明'] },
    ] as const satisfies readonly ChapterFieldContract[],
} as const;

export const FIVE_YEAR_CONTRACT = {
    tagMaxChars: 6,
    strategyTitle: '总策略',
} as const;

export const COMPAT_CONTRACT = {
    sections: ['合婚总断', '最合之处', '最大冲突', '能不能成', '婚后相处', '婚期应期', '一句话取法'],
} as const;

const FIELD_HINTS: Record<ChapterContractEngine, Record<ChapterFieldContract['key'], string>> = {
    bazi: {
        basis: '原局与该年岁运之间实际发生的作用（合冲刑害、生克、透藏），只写盘里有的',
        luck: '大运{干支} · 流年{干支}',
        detail: '这些作用落到现实里可能是什么事，为什么',
    },
    ziwei: {
        basis: '涉及的宫位、星曜与四化引动，只写盘里有的',
        luck: '大限{宫名}（{起止虚岁}） · 流年{干支}',
        detail: '这些引动落到现实里可能是什么事，为什么',
    },
};

/** "输出格式" section for 前事核验, injected into the stage request as {{outputFormat}}. */
export function renderVerificationFormat(engine: ChapterContractEngine): string {
    const { fields, minEvents, maxEvents, summaryMaxChars } = VERIFICATION_CONTRACT;
    const age = engine === 'ziwei' ? '虚岁{N}' : '{N}岁';
    return [
        '【输出格式】正文按下面的骨架写。### 标题和粗体标签原样照写，其余用自然中文；不要再加别的标题层级。',
        '开头可以先用一两句话交代本轮核验的范围（可省略）。',
        `### {年份} {该年干支} · ${age} · {一句话应事，不超过${summaryMaxChars}字}`,
        ...fields.map((field) => `**${field.label}**：${FIELD_HINTS[engine][field.key]}`),
        `共写 ${minEvents} 到 ${maxEvents} 节，按年份从早到晚排列；每节只对应一个年份，跨年的阶段写起始年。`,
        '最后可以用一句话请用户逐条核对（可省略）。',
    ].join('\n');
}

/** "输出格式" section for 今年与未来五年. */
export function renderFiveYearFormat(engine: ChapterContractEngine, currentYear: number, futureEndYear: number): string {
    const { tagMaxChars, strategyTitle } = FIVE_YEAR_CONTRACT;
    const trigger = engine === 'ziwei' ? '流年命宫、四化落宫与大限的引动' : '流年与大运对原局的引动';
    return [
        '【输出格式】正文按下面的骨架写。### 标题原样照写，其余用自然中文；不要再加别的标题层级。',
        '开头用一段话写五年总纲：运程大势与主线节奏。',
        `然后从 ${currentYear} 到 ${futureEndYear} 每年一节，共 ${futureEndYear - currentYear + 1} 节，${currentYear} 年是今年：`,
        `### {年份} {该年干支} · {不超过${tagMaxChars}字的年度标签}`,
        `每节写核心主线、${trigger}、机会与风险、可执行的建议；交运年份分开交运前后。`,
        `最后一节：### ${strategyTitle}`,
        '总策略写当下应对重点，点明最宜主动与最需稳守的年份。',
    ].join('\n');
}

/** "输出格式" section for 合盘详批. */
export function renderCompatFormat(): string {
    return [
        '【输出格式】正文只用下面七个 ### 小节，顺序和标题原样照写：',
        ...COMPAT_CONTRACT.sections.map((title) => `### ${title}`),
        '每节第一句是断语（一句话结论，以句号结束），然后写命理依据，必要时写取法；每节 1-2 段。',
    ].join('\n');
}
