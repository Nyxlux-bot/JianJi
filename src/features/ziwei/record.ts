import type {
    AIConversationStage,
    PersistedAIChatMessage,
    ZiweiAIConversationDigest,
} from '../../core/ai-meta';
import { formatLocalDateTime } from '../../core/bazi-local-time';
import {
    buildZiweiPromptSeed,
    ZIWEI_AI_CONTEXT_VERSION,
} from './ai-serializer';
import { buildZiweiChartSnapshot } from './view-model';
import {
    ZIWEI_BRIGHTNESS_BASELINE_VERSION,
    ZIWEI_IZTRO_VERSION,
} from './runtime-meta';
import type {
    ZiweiChartSnapshotV1,
    ZiweiDynamicHoroscopeResult,
    ZiweiInputPayload,
    ZiweiLunarDateInput,
    ZiweiStaticChartResult,
} from './types';

export interface ZiweiRuleSignature {
    promptSeedVersion: number;
    iztroVersion: string;
    brightnessBaselineVersion: number;
}

export interface ZiweiAIContextSnapshot {
    contextVersion?: number;
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

export const ZIWEI_PROMPT_SEED_VERSION = 3;

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
    aiConfigSignature?: string;
    aiInvalidatedAt?: string;
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

export function isZiweiContextSnapshotCurrent(snapshot?: Partial<ZiweiAIContextSnapshot> | null): boolean {
    if (!snapshot) {
        return false;
    }

    return snapshot.contextVersion === ZIWEI_AI_CONTEXT_VERSION
        && snapshot.promptVersion === ZIWEI_PROMPT_SEED_VERSION
        && isZiweiRuleSignatureCurrent(snapshot.ruleSignature);
}

export function createZiweiRecordId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

export function buildZiweiAIConfigSignature(config: ZiweiInputPayload['config']): string {
    return [
        config.algorithm,
        config.yearDivide,
        config.horoscopeDivide,
        config.dayDivide,
        config.astroType,
    ].join('|');
}

export function hasZiweiAIArtifacts(record: Partial<ZiweiRecordResult> | null | undefined): boolean {
    if (!record) {
        return false;
    }

    return Boolean(record.aiAnalysis?.trim())
        || Boolean(record.aiChatHistory && record.aiChatHistory.length > 0)
        || Boolean(record.aiConversationDigest)
        || Boolean(record.quickReplies && record.quickReplies.length > 0);
}

export function isZiweiAIConfigStale(record: Partial<ZiweiRecordResult> | null | undefined): boolean {
    if (!record || !hasZiweiAIArtifacts(record) || !record.config) {
        return false;
    }

    if (record.aiInvalidatedAt) {
        return true;
    }

    if (!record.aiConfigSignature) {
        return false;
    }

    return record.aiConfigSignature !== buildZiweiAIConfigSignature(record.config);
}

function formatInputSummary(input: ZiweiStaticChartResult['input']): string {
    if (input.calendarType === 'lunar' && input.lunar) {
        return `农历 ${input.lunar.label || `${input.lunar.year}-${input.lunar.month}-${input.lunar.day}`}`;
    }
    return `公历 ${input.birthLocal.replace('T', ' ')}`;
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
        contextVersion: ZIWEI_AI_CONTEXT_VERSION,
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
