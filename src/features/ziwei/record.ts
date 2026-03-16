import type {
    AIConversationStage,
    PersistedAIChatMessage,
    ZiweiAIConversationDigest,
} from '../../core/ai-meta';
import { formatLocalDateTime } from '../../core/bazi-local-time';
import { buildZiweiChartSnapshot } from './view-model';
import {
    ZIWEI_BRIGHTNESS_BASELINE_VERSION,
    ZIWEI_IZTRO_VERSION,
} from './runtime-meta';
import type {
    ZiweiChartSnapshotV1,
    ZiweiComputedInput,
    ZiweiDynamicHoroscopeResult,
    ZiweiInputPayload,
    ZiweiLunarDateInput,
    ZiweiPalaceAnalysisView,
    ZiweiStarViewModel,
    ZiweiStaticChartResult,
} from './types';

export interface ZiweiRuleSignature {
    promptSeedVersion: number;
    iztroVersion: string;
    brightnessBaselineVersion: number;
}

export interface ZiweiAIContextSnapshot {
    inputSummary: string;
    trueSolarSummary: string;
    chartSummary: string;
    palaceSummary: string;
    scopeSummary: string;
    defaultPalaceName?: string;
    promptSeed?: string;
    promptVersion?: number;
    ruleSignature?: ZiweiRuleSignature;
}

export const ZIWEI_PROMPT_SEED_VERSION = 2;

export interface ZiweiRecordResult {
    id: string;
    createdAt: string;
    birthLocal: string;
    longitude: number;
    gender: 'male' | 'female';
    tzOffsetMinutes: number;
    daylightSavingEnabled: boolean;
    calendarType: 'solar' | 'lunar';
    lunar?: ZiweiLunarDateInput;
    config: ZiweiInputPayload['config'];
    name?: string;
    cityLabel?: string;
    solarDate: string;
    trueSolarDateTimeLocal: string;
    trueSolarLunar: ZiweiLunarDateInput;
    timeIndex: number;
    timeLabel: string;
    timeRange: string;
    lunarDate: string;
    chineseDate: string;
    fiveElementsClass: string;
    soul: string;
    body: string;
    aiAnalysis?: string;
    aiChatHistory?: PersistedAIChatMessage[];
    quickReplies?: string[];
    aiConversationDigest?: ZiweiAIConversationDigest;
    aiConversationStage?: AIConversationStage;
    aiVerificationSummary?: string;
    aiContextSnapshot?: ZiweiAIContextSnapshot;
    ruleSignature?: ZiweiRuleSignature;
    chartSnapshot?: ZiweiChartSnapshotV1;
}

export function buildCurrentZiweiRuleSignature(): ZiweiRuleSignature {
    return {
        promptSeedVersion: ZIWEI_PROMPT_SEED_VERSION,
        iztroVersion: ZIWEI_IZTRO_VERSION,
        brightnessBaselineVersion: ZIWEI_BRIGHTNESS_BASELINE_VERSION,
    };
}

export function isZiweiRuleSignatureCurrent(signature?: Partial<ZiweiRuleSignature> | null): boolean {
    if (!signature) {
        return false;
    }

    const current = buildCurrentZiweiRuleSignature();
    return signature.promptSeedVersion === current.promptSeedVersion
        && signature.iztroVersion === current.iztroVersion
        && signature.brightnessBaselineVersion === current.brightnessBaselineVersion;
}

export function createZiweiRecordId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

function formatInputSummary(input: ZiweiComputedInput): string {
    if (input.calendarType === 'lunar' && input.lunar) {
        return `农历 ${input.lunar.label || `${input.lunar.year}-${input.lunar.month}-${input.lunar.day}`}`;
    }
    return `公历 ${input.birthLocal.replace('T', ' ')}`;
}

function formatRecordDateTime(date: Date): string {
    return formatLocalDateTime(date).replace('T', ' ');
}

function formatConfigSummary(input: ZiweiComputedInput): string {
    return `${input.config.algorithm === 'zhongzhou' ? '中州算法' : '通行算法'} · ${input.config.yearDivide === 'exact' ? '年界立春' : '年界农历'} · ${input.config.horoscopeDivide === 'exact' ? '运限立春' : '运限农历'} · ${input.config.dayDivide === 'current' ? '晚子当日' : '晚子次日'} · ${input.config.astroType === 'earth' ? '地盘' : input.config.astroType === 'human' ? '人盘' : '天盘'}`;
}

function formatStar(star: ZiweiStarViewModel): string {
    return [star.name, star.brightness || '', star.mutagen ? `化${star.mutagen}` : '']
        .filter(Boolean)
        .join('');
}

function formatStarGroup(stars: ZiweiStarViewModel[]): string {
    return stars.length > 0 ? stars.map(formatStar).join('、') : '无';
}

function formatFlightTargets(palace: ZiweiPalaceAnalysisView): string {
    return palace.flight.destinations
        .map((item) => `${item.mutagen}→${item.palaceName || '无'}`)
        .join(' · ') || '无';
}

function formatPalaceFlags(palace: ZiweiPalaceAnalysisView): string {
    const flags = [
        palace.isBodyPalace ? '身宫' : '',
        palace.isOriginalPalace ? '来因宫' : '',
        palace.isEmpty ? '空宫' : '',
    ].filter(Boolean);

    return flags.length > 0 ? ` [${flags.join(' / ')}]` : '';
}

function buildPromptSeedPalaceLines(palace: ZiweiPalaceAnalysisView): string[] {
    return [
        `- ${palace.name} ${palace.heavenlyStem}${palace.earthlyBranch}${formatPalaceFlags(palace)} | 大限 ${palace.decadalRange} | 小限 ${palace.ages}`,
        `  主星：${formatStarGroup(palace.majorStars)}`,
        `  辅曜：${formatStarGroup(palace.minorStars)}`,
        `  杂耀：${formatStarGroup(palace.adjectiveStars)}`,
        `  长生/博士/岁前/将前：${palace.changsheng12} / ${palace.boshi12} / ${palace.suiqian12} / ${palace.jiangqian12}`,
    ];
}

function buildPromptSeedStructureLines(palace: ZiweiPalaceAnalysisView): string[] {
    const mutagenFlags = [
        palace.surrounded.hasLu ? '禄' : '',
        palace.surrounded.hasQuan ? '权' : '',
        palace.surrounded.hasKe ? '科' : '',
        palace.surrounded.hasJi ? '忌' : '',
    ].filter(Boolean).join('');

    return [
        `- ${palace.name}：三方四正 ${palace.surrounded.palaceNames.join(' / ')}`,
        `  主星组合：${palace.surrounded.majorStars.join('、') || '无'} | 辅曜：${palace.surrounded.minorStars.join('、') || '无'} | 杂耀：${palace.surrounded.adjectiveStars.join('、') || '无'}`,
        `  生年四化：${palace.flight.birthMutagens.join(' / ') || '无'} | 自化：${palace.flight.selfMutagens.join(' / ') || '无'} | 四化去向：${formatFlightTargets(palace)}`,
        `  禄权科忌：${mutagenFlags || '无'}`,
        `  判定标签：${palace.surrounded.checks.map((item) => `${item.label}${item.matched ? '✓' : '·'}`).join(' ｜ ')}`,
    ];
}

function buildZiweiPromptSeed(
    staticChart: ZiweiStaticChartResult,
): string {
    const input = staticChart.input;
    const lines: string[] = [
        '【紫微斗数命盘】',
        '【盘头】',
        `- 姓名：${input.name?.trim() || '未填写'}`,
        `- 性别：${input.gender === 'male' ? '男命' : '女命'}`,
        `- 出生地：${input.cityLabel || '未设置出生地'}`,
        `- 输入语义：${formatInputSummary(input)}`,
        `- 真太阳时：${formatRecordDateTime(input.trueSolarDate)} · ${input.timeLabel} (${input.timeRange})`,
        `- 北京时间：${formatRecordDateTime(input.birthLocalDate)}`,
        `- 节气四柱：${staticChart.astrolabe.chineseDate}`,
        `- 农历：${staticChart.astrolabe.lunarDate}`,
        `- 五行局：${staticChart.astrolabe.fiveElementsClass}`,
        `- 命主 / 身主：${staticChart.astrolabe.soul} / ${staticChart.astrolabe.body}`,
        `- 当前配置：${formatConfigSummary(input)}`,
        '',
        '【本命盘】',
    ];

    staticChart.palaces.forEach((palace) => {
        lines.push(...buildPromptSeedPalaceLines(palace));
    });

    lines.push('');
    lines.push('【结构层】');
    staticChart.palaces.forEach((palace) => {
        lines.push(...buildPromptSeedStructureLines(palace));
    });

    return lines.join('\n');
}

export function buildZiweiAIContextSnapshot(
    staticChart: ZiweiStaticChartResult,
    dynamic: ZiweiDynamicHoroscopeResult,
): ZiweiAIContextSnapshot {
    const mingGong = staticChart.palaceByName.命宫;
    const mingGongStars = mingGong
        ? mingGong.majorStars.map((item) => item.name).join('、') || '空宫'
        : '命宫摘要缺失';

    return {
        inputSummary: formatInputSummary(staticChart.input),
        trueSolarSummary: `真太阳时 ${formatLocalDateTime(staticChart.input.trueSolarDate).replace('T', ' ')} · ${staticChart.input.timeLabel}`,
        chartSummary: `${staticChart.astrolabe.lunarDate} · ${staticChart.astrolabe.chineseDate} · ${staticChart.astrolabe.fiveElementsClass} · 命主${staticChart.astrolabe.soul} · 身主${staticChart.astrolabe.body}`,
        palaceSummary: `命宫 ${mingGong?.heavenlyStem || ''}${mingGong?.earthlyBranch || ''} · ${mingGongStars}`.trim(),
        scopeSummary: dynamic.horoscopeSummary.yearly,
        defaultPalaceName: mingGong?.name || '命宫',
        promptSeed: buildZiweiPromptSeed(staticChart),
        promptVersion: ZIWEI_PROMPT_SEED_VERSION,
        ruleSignature: buildCurrentZiweiRuleSignature(),
    };
}

export function buildZiweiRecordResult(params: {
    staticChart: ZiweiStaticChartResult;
    dynamic: ZiweiDynamicHoroscopeResult;
    id?: string;
    createdAt?: string;
}): ZiweiRecordResult {
    const { staticChart, dynamic } = params;
    const input = staticChart.input;

    return {
        id: params.id || createZiweiRecordId(),
        createdAt: params.createdAt || new Date().toISOString(),
        birthLocal: input.birthLocal,
        longitude: input.longitude,
        gender: input.gender,
        tzOffsetMinutes: input.tzOffsetMinutes,
        daylightSavingEnabled: input.daylightSavingEnabled,
        calendarType: input.calendarType,
        lunar: input.lunar,
        config: input.config,
        name: input.name,
        cityLabel: input.cityLabel,
        solarDate: input.solarDate,
        trueSolarDateTimeLocal: formatLocalDateTime(input.trueSolarDate),
        trueSolarLunar: input.trueSolarLunar,
        timeIndex: input.timeIndex,
        timeLabel: input.timeLabel,
        timeRange: input.timeRange,
        lunarDate: staticChart.astrolabe.lunarDate,
        chineseDate: staticChart.astrolabe.chineseDate,
        fiveElementsClass: staticChart.astrolabe.fiveElementsClass,
        soul: staticChart.astrolabe.soul,
        body: staticChart.astrolabe.body,
        aiContextSnapshot: buildZiweiAIContextSnapshot(staticChart, dynamic),
        ruleSignature: buildCurrentZiweiRuleSignature(),
        chartSnapshot: buildZiweiChartSnapshot(staticChart),
    };
}

export function buildZiweiSummary(result: ZiweiRecordResult) {
    const genderLabel = result.gender === 'male' ? '男命' : '女命';

    return {
        method: result.gender,
        question: '',
        title: result.name?.trim() || '紫微命盘',
        subtitle: `${genderLabel} · ${result.cityLabel || '未设置出生地'} · ${result.fiveElementsClass}`,
    };
}

export function toZiweiInputPayload(record: ZiweiRecordResult): ZiweiInputPayload {
    return {
        birthLocal: record.birthLocal,
        longitude: record.longitude,
        gender: record.gender,
        tzOffsetMinutes: record.tzOffsetMinutes,
        daylightSavingEnabled: record.daylightSavingEnabled,
        calendarType: record.calendarType,
        lunar: record.lunar,
        config: record.config,
        cityLabel: record.cityLabel,
        name: record.name,
    };
}
