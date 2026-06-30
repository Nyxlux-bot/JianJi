import {
    AIConversationStage,
    ZiweiAIConversationDigest,
} from '../core/ai-meta';
import { BaziResult } from '../core/bazi-types';
import { PanResult } from '../core/liuyao-calc';
import type {
    BaziCompatibilityResult,
    BaziMarriageTimingCandidate,
    BaziMarriageTimingProfile,
    BaziMarriageTimingResult,
    BaziMarriageYearCandidate,
    BaziMatchDimensionScore,
    BaziMatchEvidence,
    BaziMatchMatrixEntry,
    BaziMatchProfile,
    BaziMatchReview,
} from '../features/bazi/match/types';
import { DivinationMethod } from '../core/liuyao-data';
import { ZiweiRecordResult } from '../features/ziwei/record';
import { ZIWEI_SUPPORTED_TIMEZONE_OFFSET_MINUTES } from '../features/ziwei/runtime-meta';

export type DivinationEngine = 'liuyao' | 'bazi' | 'ziwei' | 'baziCompatibility';

export type DivinationResult = PanResult | BaziResult | ZiweiRecordResult | BaziCompatibilityResult;

const LIUYAO_METHODS: readonly DivinationMethod[] = ['time', 'coin', 'number', 'manual'];
const WUXING_VALUES = ['木', '火', '土', '金', '水'] as const;
const BAZI_MATCH_GRADES = ['优', '良', '中', '差'] as const;
const BAZI_MATCH_DIMENSION_KEYS = ['harmony', 'supportHusband', 'supportWife', 'offspring', 'longevity', 'mutualSupport', 'lifecycle'] as const;
const BAZI_MATCH_REFERENCE_IDS = ['HM-01', 'HM-02', 'FS-01', 'FS-02', 'PG-01', 'PG-02', 'CY-01', 'YY-01', 'YQ-01', 'EXP-01', 'LS-01'] as const;
const BAZI_MATCH_MATRIX_CATEGORIES = ['bestFit', 'mainConflict', 'spouseStarPalace', 'elementComplement', 'relationImpact', 'fortuneTiming', 'marriageTiming', 'riskPriority'] as const;
const BAZI_MATCH_MATRIX_DIRECTIONS = ['positive', 'negative', 'neutral'] as const;
const BAZI_MATCH_MATRIX_STRENGTHS = ['high', 'medium', 'low'] as const;
const BAZI_MATCH_REVIEW_CAN_PROCEED = ['strong', 'workable', 'cautious', 'difficult'] as const;

export interface RecordSummary {
    id: string;
    createdAt: string;
    engineType: DivinationEngine;
    method?: string;
    question: string;
    title: string;
    subtitle: string;
    isFavorite: boolean;
}

export interface RecordSummaryFields {
    method?: string;
    question: string;
    title: string;
    subtitle: string;
}

export interface DivinationRecordEnvelope {
    engineType: DivinationEngine;
    result: DivinationResult;
    summary?: Partial<RecordSummaryFields>;
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

function isStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isStringTuple4(value: unknown): value is [string, string, string, string] {
    return isStringArray(value) && value.length === 4;
}

function isOneOf(value: unknown, options: readonly string[]): boolean {
    return typeof value === 'string' && options.includes(value);
}

function isWuXingArray(value: unknown): boolean {
    return Array.isArray(value) && value.every((item) => isOneOf(item, WUXING_VALUES));
}

function isWuXingCounts(value: unknown): boolean {
    return isObject(value) && WUXING_VALUES.every((item) => isFiniteNumber(value[item]));
}

function isStarCounts(value: unknown): boolean {
    return isObject(value) && Object.values(value).every((item) => isFiniteNumber(item));
}

function isBaziMatchEvidence(value: unknown): value is BaziMatchEvidence {
    return isObject(value)
        && typeof value.label === 'string'
        && typeof value.detail === 'string'
        && (value.effect === 'positive' || value.effect === 'negative' || value.effect === 'neutral')
        && (value.referenceIds === undefined || (Array.isArray(value.referenceIds) && value.referenceIds.every((item) => isOneOf(item, BAZI_MATCH_REFERENCE_IDS))));
}

function isBaziMatchDimension(value: unknown): value is BaziMatchDimensionScore {
    return isObject(value)
        && isOneOf(value.key, BAZI_MATCH_DIMENSION_KEYS)
        && typeof value.title === 'string'
        && isFiniteNumber(value.score)
        && isOneOf(value.grade, BAZI_MATCH_GRADES)
        && typeof value.summary === 'string'
        && Array.isArray(value.evidence)
        && value.evidence.every((item) => isBaziMatchEvidence(item));
}

function isBaziMatchMatrixEntry(value: unknown): value is BaziMatchMatrixEntry {
    return isObject(value)
        && isOneOf(value.category, BAZI_MATCH_MATRIX_CATEGORIES)
        && typeof value.title === 'string'
        && isOneOf(value.direction, BAZI_MATCH_MATRIX_DIRECTIONS)
        && isOneOf(value.strength, BAZI_MATCH_MATRIX_STRENGTHS)
        && typeof value.detail === 'string'
        && (value.referenceIds === undefined || (Array.isArray(value.referenceIds) && value.referenceIds.every((item) => isOneOf(item, BAZI_MATCH_REFERENCE_IDS))));
}

function isBaziMatchReview(value: unknown): value is BaziMatchReview {
    return isObject(value)
        && typeof value.mainLine === 'string'
        && isOneOf(value.canProceed, BAZI_MATCH_REVIEW_CAN_PROCEED)
        && typeof value.scoreReview === 'string'
        && typeof value.bestFit === 'string'
        && typeof value.mainConflict === 'string'
        && isStringArray(value.priorities);
}

function isBaziMarriageYear(value: unknown): value is BaziMarriageYearCandidate {
    return isObject(value)
        && isFiniteNumber(value.year)
        && typeof value.ganZhi === 'string'
        && (value.kind === 'trigger' || value.kind === 'recommendation')
        && isFiniteNumber(value.score)
        && isStringArray(value.reasons)
        && (value.maleAge === undefined || isFiniteNumber(value.maleAge))
        && (value.femaleAge === undefined || isFiniteNumber(value.femaleAge))
        && (value.referenceIds === undefined || (Array.isArray(value.referenceIds) && value.referenceIds.every((item) => isOneOf(item, BAZI_MATCH_REFERENCE_IDS))));
}

function isBaziMarriageTimingCandidate(value: unknown): value is BaziMarriageTimingCandidate {
    return isObject(value)
        && isFiniteNumber(value.year)
        && isFiniteNumber(value.age)
        && typeof value.ganZhi === 'string'
        && isFiniteNumber(value.score)
        && isStringArray(value.reasons)
        && (value.referenceIds === undefined || (Array.isArray(value.referenceIds) && value.referenceIds.every((item) => isOneOf(item, BAZI_MATCH_REFERENCE_IDS))));
}

function isBaziMarriageTimingProfile(value: unknown): value is BaziMarriageTimingProfile {
    return isObject(value)
        && typeof value.name === 'string'
        && typeof value.genderLabel === 'string'
        && Array.isArray(value.candidates)
        && value.candidates.every((item) => isBaziMarriageTimingCandidate(item));
}

function isBaziMarriageTimingResult(value: unknown): value is BaziMarriageTimingResult {
    return isObject(value)
        && isBaziMarriageTimingProfile(value.male)
        && isBaziMarriageTimingProfile(value.female)
        && typeof value.summary === 'string';
}

function isBaziFutureDaYun(value: unknown): boolean {
    return Array.isArray(value) && value.every((item) => (
        isObject(item)
        && typeof item.ganZhi === 'string'
        && isFiniteNumber(item.startYear)
        && isFiniteNumber(item.endYear)
        && isOneOf(item.stemElement, WUXING_VALUES)
        && isOneOf(item.branchElement, WUXING_VALUES)
    ));
}

function isBaziMatchProfile(value: unknown): value is BaziMatchProfile {
    return isObject(value)
        && typeof value.sourceId === 'string'
        && typeof value.name === 'string'
        && (value.gender === 0 || value.gender === 1)
        && typeof value.genderLabel === 'string'
        && typeof value.mingZaoLabel === 'string'
        && isStringTuple4(value.fourPillars)
        && isStringTuple4(value.stems)
        && isStringTuple4(value.branches)
        && typeof value.yearBranch === 'string'
        && typeof value.dayStem === 'string'
        && typeof value.dayBranch === 'string'
        && typeof value.hourBranch === 'string'
        && typeof value.mingGongBranch === 'string'
        && typeof value.zodiac === 'string'
        && isStringArray(value.shenSha)
        && isWuXingCounts(value.elementCounts)
        && isWuXingArray(value.neededElements)
        && isWuXingArray(value.dominantElements)
        && isWuXingArray(value.weakElements)
        && isStarCounts(value.starCounts)
        && (value.strength === 'weak' || value.strength === 'balanced' || value.strength === 'strong')
        && isBaziFutureDaYun(value.futureDaYun);
}

function isPersistedAIChatMessage(value: unknown): boolean {
    return isObject(value)
        && (value.role === 'user' || value.role === 'assistant')
        && typeof value.content === 'string'
        && (value.hidden === undefined || typeof value.hidden === 'boolean')
        && (value.requestContent === undefined || typeof value.requestContent === 'string');
}

function isPersistedAIChatHistory(value: unknown): boolean {
    return Array.isArray(value) && value.every((item) => isPersistedAIChatMessage(item));
}

function isBaziTimeMode(value: unknown): boolean {
    return value === 'clock_time' || value === 'mean_solar_time' || value === 'true_solar_time';
}

function isBaziZiHourMode(value: unknown): boolean {
    return value === 'late_zi_next_day' || value === 'early_zi_same_day';
}

function isZiweiCalendarType(value: unknown): boolean {
    return value === 'solar' || value === 'lunar';
}

function isZiweiGender(value: unknown): boolean {
    return value === 'male' || value === 'female';
}

function isZiweiConfigOptions(value: unknown): boolean {
    return isObject(value)
        && (value.algorithm === 'default' || value.algorithm === 'zhongzhou')
        && (value.yearDivide === 'normal' || value.yearDivide === 'exact')
        && (value.horoscopeDivide === 'normal' || value.horoscopeDivide === 'exact')
        && (value.dayDivide === 'forward' || value.dayDivide === 'current')
        && (value.astroType === 'heaven' || value.astroType === 'earth' || value.astroType === 'human');
}

function isZiweiLunarInput(value: unknown): boolean {
    return !value || (
        isObject(value)
        && isFiniteNumber(value.year)
        && isFiniteNumber(value.month)
        && isFiniteNumber(value.day)
        && typeof value.isLeapMonth === 'boolean'
        && (value.label === undefined || typeof value.label === 'string')
    );
}

function isZiweiAIContextSnapshot(value: unknown): boolean {
    return !value || (
        isObject(value)
        && (value.contextVersion === undefined || isFiniteNumber(value.contextVersion))
        && typeof value.inputSummary === 'string'
        && typeof value.trueSolarSummary === 'string'
        && typeof value.chartSummary === 'string'
        && typeof value.palaceSummary === 'string'
        && typeof value.scopeSummary === 'string'
        && (value.defaultPalaceName === undefined || typeof value.defaultPalaceName === 'string')
        && (value.promptSeed === undefined || typeof value.promptSeed === 'string')
        && (value.promptVersion === undefined || isFiniteNumber(value.promptVersion))
        && (
            value.ruleSignature === undefined
            || (
                isObject(value.ruleSignature)
                && isFiniteNumber(value.ruleSignature.promptSeedVersion)
                && typeof value.ruleSignature.iztroVersion === 'string'
                && isFiniteNumber(value.ruleSignature.brightnessBaselineVersion)
            )
        )
    );
}

function isZiweiChartSnapshot(value: unknown): boolean {
    return !value || (
        isObject(value)
        && value.version === 1
        && isObject(value.staticMeta)
        && typeof value.staticMeta.lunarDate === 'string'
        && typeof value.staticMeta.chineseDate === 'string'
        && typeof value.staticMeta.fiveElementsClass === 'string'
        && typeof value.staticMeta.soul === 'string'
        && typeof value.staticMeta.body === 'string'
        && typeof value.staticMeta.birthLocal === 'string'
        && typeof value.staticMeta.trueSolarDateTimeLocal === 'string'
        && typeof value.staticMeta.timeLabel === 'string'
        && typeof value.staticMeta.timeRange === 'string'
        && isObject(value.workbenchLayout)
        && Array.isArray(value.workbenchLayout.ringCells)
        && isObject(value.workbenchLayout.byPalaceName)
        && Array.isArray(value.palaces)
        && isObject(value.baseBoard)
        && typeof value.baseBoard.selectedPalaceName === 'string'
        && isObject(value.baseBoard.byPalaceName)
        && isObject(value.baseBoard.centerPanel)
        && typeof value.baseBoard.centerPanel.focusTitle === 'string'
        && typeof value.baseBoard.centerPanel.scopeState === 'string'
        && typeof value.baseBoard.centerPanel.scopeSummary === 'string'
        && isStringArray(value.baseBoard.centerPanel.summaryItems)
        && Array.isArray(value.baseBoard.centerPanel.mutagenBadges)
    );
}

function isAIConversationStage(value: unknown): value is AIConversationStage {
    return value === 'foundation_pending'
        || value === 'foundation_ready'
        || value === 'verification_ready'
        || value === 'followup_ready';
}

function isZiweiConversationFoundation(value: unknown): value is ZiweiAIConversationDigest['foundation'] {
    return isObject(value)
        && typeof value.lifeTheme === 'string'
        && typeof value.mingPalace === 'string'
        && typeof value.bodySoul === 'string'
        && typeof value.mutagenDynamics === 'string'
        && typeof value.personality === 'string';
}

function isZiweiConversationDigest(value: unknown): value is ZiweiAIConversationDigest {
    return isObject(value)
        && isFiniteNumber(value.version)
        && typeof value.generatedAt === 'string'
        && isZiweiConversationFoundation(value.foundation)
        && typeof value.verificationSummary === 'string'
        && typeof value.fiveYearSummary === 'string'
        && typeof value.rollingSummary === 'string'
        && isObject(value.topicNotes)
        && Object.values(value.topicNotes).every((item) => typeof item === 'string')
        && (value.verificationTimeline === undefined || isStringArray(value.verificationTimeline))
        && (
            value.yearlyOutlook === undefined
            || (isObject(value.yearlyOutlook) && Object.values(value.yearlyOutlook).every((item) => typeof item === 'string'))
        )
        && (
            value.focusAnchors === undefined
            || (isObject(value.focusAnchors) && Object.values(value.focusAnchors).every((item) => typeof item === 'string'))
        );
}

function isIsoLikeString(value: unknown): boolean {
    return typeof value === 'string';
}

export function isDivinationMethod(value: unknown): value is DivinationMethod {
    return typeof value === 'string' && LIUYAO_METHODS.includes(value as DivinationMethod);
}

export function isPanResult(value: unknown): value is PanResult {
    if (typeof value !== 'object' || value === null) {
        return false;
    }
    const candidate = value as Partial<PanResult>;
    return typeof candidate.id === 'string'
        && typeof candidate.createdAt === 'string'
        && isDivinationMethod(candidate.method)
        && typeof candidate.benGua?.fullName === 'string';
}

export function isBaziResult(value: unknown): value is BaziResult {
    if (!isObject(value)) {
        return false;
    }
    const candidate = value as Partial<BaziResult>;

    const timeMeta = candidate.timeMeta;
    const hasValidTimeMeta = isObject(timeMeta)
        && typeof timeMeta.solarDate === 'string'
        && typeof timeMeta.solarTime === 'string'
        && typeof timeMeta.trueSolarTime === 'string'
        && typeof timeMeta.solarDateIso === 'string'
        && typeof timeMeta.solarDateTimeIso === 'string'
        && typeof timeMeta.trueSolarDateTimeIso === 'string';
    const hasValidFourPillars = isStringArray(candidate.fourPillars) && candidate.fourPillars.length === 4;
    const hasValidShiShen = Array.isArray(candidate.shiShen) && candidate.shiShen.length === 4;
    const hasValidCangGan = Array.isArray(candidate.cangGan) && candidate.cangGan.length === 4;
    const childLimit = candidate.childLimit;
    const hasValidChildLimit = isObject(childLimit)
        && isFiniteNumber(childLimit.years)
        && isFiniteNumber(childLimit.months)
        && isFiniteNumber(childLimit.days)
        && isFiniteNumber(childLimit.hours)
        && isFiniteNumber(childLimit.minutes)
        && isFiniteNumber(childLimit.startAge)
        && isFiniteNumber(childLimit.startYear)
        && typeof childLimit.jiaoYunDateTime === 'string'
        && typeof childLimit.jiaoYunDateTimeIso === 'string';
    const yuanMing = candidate.yuanMing;
    const hasValidYuanMing = isObject(yuanMing)
        && isObject(yuanMing.current)
        && typeof yuanMing.current.guaName === 'string'
        && typeof yuanMing.current.group === 'string';
    const shenSha = candidate.shenSha;
    const hasValidShenSha = isObject(shenSha)
        && Array.isArray(shenSha.byPillar)
        && shenSha.byPillar.length === 4
        && shenSha.byPillar.every((item) => isObject(item) && Array.isArray(item.stars))
        && Array.isArray(shenSha.allStars)
        && isObject(shenSha.starToPillars);
    const schoolOptionsResolved = candidate.schoolOptionsResolved;
    const hasValidSchoolOptions = schoolOptionsResolved === undefined || (
        isObject(schoolOptionsResolved)
        && isBaziTimeMode(schoolOptionsResolved.timeMode)
        && isBaziZiHourMode(schoolOptionsResolved.ziHourMode)
        && (schoolOptionsResolved.daylightSaving === undefined || typeof schoolOptionsResolved.daylightSaving === 'boolean')
    );

    return typeof candidate.id === 'string'
        && typeof candidate.createdAt === 'string'
        && (candidate.gender === 0 || candidate.gender === 1)
        && hasValidTimeMeta
        && hasValidFourPillars
        && hasValidShiShen
        && hasValidCangGan
        && hasValidChildLimit
        && Array.isArray(candidate.daYun)
        && Array.isArray(candidate.xiaoYun)
        && isFiniteNumber(candidate.currentDaYunIndex)
        && hasValidYuanMing
        && hasValidShenSha
        && hasValidSchoolOptions;
}

export function isBaziCompatibilityResult(value: unknown): value is BaziCompatibilityResult {
    if (!isObject(value)) {
        return false;
    }
    const candidate = value as Partial<BaziCompatibilityResult>;
    return typeof candidate.id === 'string'
        && typeof candidate.createdAt === 'string'
        && typeof candidate.calculatedAt === 'string'
        && isBaziResult(candidate.male)
        && isBaziResult(candidate.female)
        && isBaziMatchProfile(candidate.maleProfile)
        && isBaziMatchProfile(candidate.femaleProfile)
        && Array.isArray(candidate.dimensions)
        && candidate.dimensions.every((item) => isBaziMatchDimension(item))
        && isFiniteNumber(candidate.totalScore)
        && isOneOf(candidate.grade, BAZI_MATCH_GRADES)
        && typeof candidate.summary === 'string'
        && Array.isArray(candidate.marriageYears)
        && candidate.marriageYears.every((item) => isBaziMarriageYear(item))
        && (candidate.marriageTiming === undefined || isBaziMarriageTimingResult(candidate.marriageTiming))
        && (candidate.review === undefined || isBaziMatchReview(candidate.review))
        && (candidate.evidenceMatrix === undefined || (Array.isArray(candidate.evidenceMatrix) && candidate.evidenceMatrix.every((item) => isBaziMatchMatrixEntry(item))))
        && (candidate.aiAnalysis === undefined || typeof candidate.aiAnalysis === 'string')
        && (candidate.aiChatHistory === undefined || isPersistedAIChatHistory(candidate.aiChatHistory));
}

export function isZiweiRecordResult(value: unknown): value is ZiweiRecordResult {
    if (!isObject(value)) {
        return false;
    }
    const candidate = value as Partial<ZiweiRecordResult>;

    return typeof candidate.id === 'string'
        && typeof candidate.createdAt === 'string'
        && typeof candidate.birthLocal === 'string'
        && isFiniteNumber(candidate.longitude)
        && isZiweiGender(candidate.gender)
        && candidate.tzOffsetMinutes === ZIWEI_SUPPORTED_TIMEZONE_OFFSET_MINUTES
        && typeof candidate.daylightSavingEnabled === 'boolean'
        && isZiweiCalendarType(candidate.calendarType)
        && isZiweiLunarInput(candidate.lunar)
        && isZiweiConfigOptions(candidate.config)
        && (candidate.name === undefined || typeof candidate.name === 'string')
        && (candidate.cityLabel === undefined || typeof candidate.cityLabel === 'string')
        && typeof candidate.solarDate === 'string'
        && typeof candidate.trueSolarDateTimeLocal === 'string'
        && isZiweiLunarInput(candidate.trueSolarLunar)
        && isFiniteNumber(candidate.timeIndex)
        && typeof candidate.timeLabel === 'string'
        && typeof candidate.timeRange === 'string'
        && typeof candidate.lunarDate === 'string'
        && typeof candidate.chineseDate === 'string'
        && typeof candidate.fiveElementsClass === 'string'
        && typeof candidate.soul === 'string'
        && typeof candidate.body === 'string'
        && (candidate.aiAnalysis === undefined || typeof candidate.aiAnalysis === 'string')
        && (candidate.aiChatHistory === undefined || isPersistedAIChatHistory(candidate.aiChatHistory))
        && (candidate.quickReplies === undefined || isStringArray(candidate.quickReplies))
        && (candidate.aiConversationDigest === undefined || isZiweiConversationDigest(candidate.aiConversationDigest))
        && (candidate.aiConversationStage === undefined || isAIConversationStage(candidate.aiConversationStage))
        && (candidate.aiVerificationSummary === undefined || typeof candidate.aiVerificationSummary === 'string')
        && (candidate.aiConfigSignature === undefined || typeof candidate.aiConfigSignature === 'string')
        && (candidate.aiInvalidatedAt === undefined || isIsoLikeString(candidate.aiInvalidatedAt))
        && isZiweiAIContextSnapshot(candidate.aiContextSnapshot)
        && isZiweiChartSnapshot(candidate.chartSnapshot)
        && (
            candidate.ruleSignature === undefined
            || (
                isObject(candidate.ruleSignature)
                && isFiniteNumber(candidate.ruleSignature.promptSeedVersion)
                && typeof candidate.ruleSignature.iztroVersion === 'string'
                && isFiniteNumber(candidate.ruleSignature.brightnessBaselineVersion)
            )
        );
}

export function inferEngineFromResult(result: unknown): DivinationEngine {
    if (isPanResult(result)) {
        return 'liuyao';
    }
    if (isBaziResult(result)) {
        return 'bazi';
    }
    if (isZiweiRecordResult(result)) {
        return 'ziwei';
    }
    if (isBaziCompatibilityResult(result)) {
        return 'baziCompatibility';
    }
    throw new Error('无法识别记录引擎类型');
}

export function buildSummaryFields(envelope: DivinationRecordEnvelope): RecordSummaryFields {
    const { engineType, result, summary } = envelope;

    if (engineType === 'liuyao') {
        if (!isPanResult(result)) {
            throw new Error('六爻记录结构非法');
        }
        return {
            method: summary?.method || result.method,
            question: summary?.question ?? result.question ?? '',
            title: summary?.title || result.benGua.fullName,
            subtitle: summary?.subtitle ?? result.bianGua?.fullName ?? '',
        };
    }

    if (engineType === 'ziwei') {
        if (!isZiweiRecordResult(result)) {
            throw new Error('紫微记录结构非法');
        }
        const genderLabel = result.gender === 'male' ? '男命' : '女命';

        return {
            method: summary?.method || result.gender,
            question: summary?.question ?? '',
            title: summary?.title || result.name?.trim() || '紫微命盘',
            subtitle: summary?.subtitle ?? `${genderLabel} · ${result.cityLabel || '未设置出生地'} · ${result.fiveElementsClass}`,
        };
    }

    if (engineType === 'baziCompatibility') {
        if (!isBaziCompatibilityResult(result)) {
            throw new Error('八字合盘记录结构非法');
        }
        return {
            method: summary?.method || 'baziCompatibility',
            question: summary?.question ?? '',
            title: summary?.title || `${result.maleProfile.name} × ${result.femaleProfile.name}`,
            subtitle: summary?.subtitle ?? `合盘 · ${result.totalScore}分 · ${result.grade}`,
        };
    }

    if (!isBaziResult(result)) {
        throw new Error('八字记录结构非法');
    }
    const fallbackName = result.fourPillars.join(' ');
    const name = result.subject?.name?.trim() || '';
    const genderLabel = result.subject?.genderLabel || (result.gender === 1 ? '男' : '女');
    const mingZaoLabel = result.subject?.mingZaoLabel || (result.gender === 1 ? '乾造' : '坤造');
    const birthPlace = result.baseInfo?.birthPlaceDisplay || '未设置出生地';
    const defaultSubtitle = `${genderLabel} · ${birthPlace} · ${mingZaoLabel}`;

    return {
        method: summary?.method,
        question: summary?.question ?? '',
        title: summary?.title || name || fallbackName,
        subtitle: summary?.subtitle ?? defaultSubtitle,
    };
}
