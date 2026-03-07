import { BaziResult } from '../core/bazi-types';
import { PanResult } from '../core/liuyao-calc';
import { DivinationMethod } from '../core/liuyao-data';

export type DivinationEngine = 'liuyao' | 'bazi';

export type DivinationResult = PanResult | BaziResult;

const LIUYAO_METHODS: readonly DivinationMethod[] = ['time', 'coin', 'number', 'manual'];

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

function isBaziTimeMode(value: unknown): boolean {
    return value === 'clock_time' || value === 'mean_solar_time' || value === 'true_solar_time';
}

function isBaziZiHourMode(value: unknown): boolean {
    return value === 'late_zi_next_day' || value === 'early_zi_same_day';
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

export function inferEngineFromResult(result: unknown): DivinationEngine {
    if (isPanResult(result)) {
        return 'liuyao';
    }
    if (isBaziResult(result)) {
        return 'bazi';
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
