import {
    BaziBaseInfo,
    BaziChildLimit,
    BaziJieQiContext,
    BaziPillarMatrixRow,
    BaziRenYuanDutyDetail,
    BaziResult,
    BaziSchoolOptionsResolved,
    BaziShenShaLayerBucket,
    BaziShenShaV2Result,
    BaziSubject,
    BaziTimeMeta,
} from './bazi-types';
import {
    buildLocalDateTimeFromDateAndTime,
    formatLocalDateTime,
    formatLocalDisplayDateTime,
    normalizeLocalDateTimeText,
    parseLocalDateTime,
} from './bazi-local-time';
import { BAZI_SHENSHA_ALIAS_TO_FULLNAME, BAZI_SHENSHA_CATALOG } from './bazi-shensha-catalog';
import { buildBaziShenShaBucketMap } from './bazi-shensha';
import { normalizeBaziFormatterContext } from './bazi-ai-context';
import { buildJiaoYunRuleDetail, createEmptyJiaoYunRuleDetail } from './jiaoyun-rule';
import { calculateRenYuanDuty, createEmptyRenYuanDutyDetail } from './renyuan-duty';

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

function isStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isGender(value: unknown): value is 0 | 1 {
    return value === 0 || value === 1;
}

function isTimeMode(value: unknown): value is 'clock_time' | 'mean_solar_time' | 'true_solar_time' {
    return value === 'clock_time' || value === 'mean_solar_time' || value === 'true_solar_time';
}

function isZiHourMode(value: unknown): value is 'late_zi_next_day' | 'early_zi_same_day' {
    return value === 'late_zi_next_day' || value === 'early_zi_same_day';
}

function toTrimmedString(value: unknown, fallback: string = ''): string {
    return typeof value === 'string' ? value.trim() : fallback;
}

function normalizeStarName(name: string): string {
    return BAZI_SHENSHA_ALIAS_TO_FULLNAME[name] ?? name;
}

function normalizeLayerBucket(bucket: BaziShenShaLayerBucket): BaziShenShaLayerBucket {
    const byPillar = bucket.byPillar.map((position) => ({
        ...position,
        stars: position.stars.map((item) => ({
            ...item,
            star: normalizeStarName(item.star),
        })),
    }));
    const allStars = Array.from(new Set(byPillar.flatMap((item) => item.stars.map((star) => star.star))));
    const starToPositions: Record<string, Array<'year' | 'month' | 'day' | 'hour'>> = {};

    byPillar.forEach((item) => {
        item.stars.forEach((star) => {
            if (!starToPositions[star.star]) {
                starToPositions[star.star] = [];
            }
            if (!starToPositions[star.star].includes(item.position)) {
                starToPositions[star.star].push(item.position);
            }
        });
    });

    return {
        byPillar,
        allStars,
        starToPositions,
        compatNote: bucket.compatNote,
    };
}

function extractGanZhiFromDisplay(value: string | undefined): string {
    if (!value) {
        return '';
    }
    return value.split('（')[0]?.trim() ?? '';
}

function buildShenShaGanZhiPool(result: BaziResult): string[] {
    return [
        extractGanZhiFromDisplay(result.baseInfo?.shenGong),
        extractGanZhiFromDisplay(result.baseInfo?.mingGong),
        extractGanZhiFromDisplay(result.baseInfo?.taiYuan),
        ...result.daYun.map((item) => item.ganZhi),
        ...result.daYun.flatMap((item) => item.liuNian.map((liuNian) => liuNian.ganZhi)),
        ...result.daYun.flatMap((item) => item.liuNian.flatMap((liuNian) => liuNian.liuYue.map((liuYue) => liuYue.ganZhi))),
        ...result.xiaoYun.map((item) => item.ganZhi),
        ...result.xiaoYun.map((item) => item.xiaoYunGanZhi),
        ...result.xiaoYun.flatMap((item) => item.liuYue.map((liuYue) => liuYue.ganZhi)),
    ];
}

function normalizeLegacyStars(result: BaziResult): BaziResult {
    const normalizedByPillar = result.shenSha.byPillar.map((pillar) => ({
        ...pillar,
        stars: pillar.stars.map(normalizeStarName),
    })) as BaziResult['shenSha']['byPillar'];
    const allStars = Array.from(new Set(normalizedByPillar.flatMap((item) => item.stars)));
    const starToPillars: Record<string, Array<'year' | 'month' | 'day' | 'hour'>> = {};
    normalizedByPillar.forEach((item) => {
        item.stars.forEach((star) => {
            if (!starToPillars[star]) {
                starToPillars[star] = [];
            }
            if (!starToPillars[star].includes(item.pillar)) {
                starToPillars[star].push(item.pillar);
            }
        });
    });

    return {
        ...result,
        shenSha: {
            byPillar: normalizedByPillar,
            allStars,
            starToPillars,
        },
    };
}

function parseDateOrNull(value: string | undefined): Date | null {
    if (!value) {
        return null;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeRenYuanDutyDetail(input: {
    detail: BaziRenYuanDutyDetail | undefined;
    trueSolarDateTimeIso: string | undefined;
}): BaziRenYuanDutyDetail {
    const parsedDate = parseDateOrNull(input.trueSolarDateTimeIso);
    if (parsedDate) {
        return calculateRenYuanDuty(parsedDate);
    }

    if (input.detail && input.detail.stem && input.detail.element && input.detail.dayIndex >= 1) {
        return {
            ...input.detail,
            monthBranch: input.detail.monthBranch ?? '',
            ruleKey: 'ziping_zhenquan_v1',
        };
    }

    return createEmptyRenYuanDutyDetail();
}

function getStringFromRecord(value: unknown, key: string): string | undefined {
    if (!isObject(value)) {
        return undefined;
    }
    const field = value[key];
    return typeof field === 'string' ? field : undefined;
}

function formatDisplayDateTimeFromLocal(value: string | undefined): string | undefined {
    const parsed = parseLocalDateTime(value);
    return parsed ? formatLocalDisplayDateTime(parsed) : undefined;
}

function buildNormalizedTimeMeta(result: Partial<BaziResult>, trueSolarDisplay?: string): BaziTimeMeta {
    const rawTimeMeta = isObject(result.timeMeta) ? result.timeMeta : {};
    const solarDateTimeLocal = normalizeLocalDateTimeText(getStringFromRecord(rawTimeMeta, 'solarDateTimeLocal'))
        ?? buildLocalDateTimeFromDateAndTime(result.solarDate, result.solarTime)
        ?? (() => {
            const parsed = parseDateOrNull(getStringFromRecord(rawTimeMeta, 'solarDateTimeIso'));
            return parsed ? formatLocalDateTime(parsed) : undefined;
        })();
    const trueSolarDateTimeLocal = normalizeLocalDateTimeText(getStringFromRecord(rawTimeMeta, 'trueSolarDateTimeLocal'))
        ?? normalizeLocalDateTimeText(trueSolarDisplay)
        ?? buildLocalDateTimeFromDateAndTime(result.solarDate, result.trueSolarTime)
        ?? (() => {
            const parsed = parseDateOrNull(getStringFromRecord(rawTimeMeta, 'trueSolarDateTimeIso'));
            return parsed ? formatLocalDateTime(parsed) : undefined;
        })();

    const solarDateTime = parseLocalDateTime(solarDateTimeLocal)
        ?? parseDateOrNull(getStringFromRecord(rawTimeMeta, 'solarDateTimeIso'));
    const trueSolarDateTime = parseLocalDateTime(trueSolarDateTimeLocal)
        ?? parseDateOrNull(getStringFromRecord(rawTimeMeta, 'trueSolarDateTimeIso'))
        ?? solarDateTime;
    const solarDateIso = getStringFromRecord(rawTimeMeta, 'solarDateIso')
        || solarDateTimeLocal?.slice(0, 10)
        || (solarDateTime ? formatLocalDateTime(solarDateTime).slice(0, 10) : '');
    const solarDateTimeIso = getStringFromRecord(rawTimeMeta, 'solarDateTimeIso')
        || (solarDateTime ? solarDateTime.toISOString() : '');
    const trueSolarDateTimeIso = getStringFromRecord(rawTimeMeta, 'trueSolarDateTimeIso')
        || (trueSolarDateTime ? trueSolarDateTime.toISOString() : solarDateTimeIso);

    return {
        solarDate: getStringFromRecord(rawTimeMeta, 'solarDate') || toTrimmedString(result.solarDate),
        solarTime: getStringFromRecord(rawTimeMeta, 'solarTime') || toTrimmedString(result.solarTime),
        trueSolarTime: getStringFromRecord(rawTimeMeta, 'trueSolarTime') || toTrimmedString(result.trueSolarTime),
        solarDateIso,
        solarDateTimeIso,
        trueSolarDateTimeIso,
        solarDateTimeLocal,
        trueSolarDateTimeLocal,
    };
}

function inferTimeMode(result: Partial<BaziResult>, timeMeta: BaziTimeMeta): BaziSchoolOptionsResolved['timeMode'] {
    if (isObject(result.schoolOptionsResolved) && isTimeMode(result.schoolOptionsResolved.timeMode)) {
        return result.schoolOptionsResolved.timeMode;
    }
    if (result.longitude === null || result.longitude === undefined) {
        return 'clock_time';
    }

    return timeMeta.solarDateTimeLocal && timeMeta.trueSolarDateTimeLocal
        && timeMeta.solarDateTimeLocal === timeMeta.trueSolarDateTimeLocal
        ? 'clock_time'
        : 'true_solar_time';
}

function isRecoverableChildLimit(value: unknown): value is BaziChildLimit {
    return isObject(value)
        && isFiniteNumber(value.years)
        && isFiniteNumber(value.months)
        && isFiniteNumber(value.days)
        && isFiniteNumber(value.hours)
        && (value.minutes === undefined || isFiniteNumber(value.minutes))
        && isFiniteNumber(value.startAge)
        && isFiniteNumber(value.startYear)
        && typeof value.jiaoYunDateTime === 'string';
}

function isRecoverableYuanMing(value: unknown): boolean {
    return isObject(value)
        && isObject(value.current)
        && typeof value.current.guaName === 'string'
        && typeof value.current.group === 'string';
}

function isRecoverableShenSha(value: unknown): boolean {
    return isObject(value)
        && Array.isArray(value.byPillar)
        && value.byPillar.length === 4
        && value.byPillar.every((item) => isObject(item) && Array.isArray(item.stars))
        && Array.isArray(value.allStars)
        && isObject(value.starToPillars);
}

function isRecoverableLegacyBaziResult(value: unknown): value is Partial<BaziResult> {
    if (!isObject(value)) {
        return false;
    }

    return typeof value.id === 'string'
        && typeof value.createdAt === 'string'
        && isGender(value.gender)
        && isStringArray(value.fourPillars)
        && value.fourPillars.length === 4
        && Array.isArray(value.shiShen)
        && value.shiShen.length === 4
        && Array.isArray(value.cangGan)
        && value.cangGan.length === 4
        && isRecoverableChildLimit(value.childLimit)
        && Array.isArray(value.daYun)
        && Array.isArray(value.xiaoYun)
        && isFiniteNumber(value.currentDaYunIndex)
        && isRecoverableYuanMing(value.yuanMing)
        && isRecoverableShenSha(value.shenSha)
        && typeof value.solarDate === 'string'
        && typeof value.solarTime === 'string'
        && typeof value.trueSolarTime === 'string';
}

function normalizeChildLimit(childLimit: BaziChildLimit): BaziChildLimit {
    const startYear = Number.isFinite(childLimit.startYear) ? childLimit.startYear : 0;
    const parsedJiaoYunDate = parseDateOrNull(childLimit.jiaoYunDateTimeIso);
    const jiaoYunRule = (parsedJiaoYunDate && startYear > 0)
        ? buildJiaoYunRuleDetail(parsedJiaoYunDate, startYear)
        : createEmptyJiaoYunRuleDetail();

    return {
        ...childLimit,
        minutes: childLimit.minutes ?? 0,
        jiaoYunRuleText: childLimit.jiaoYunRuleText || jiaoYunRule.displayText,
        jiaoYunYearStems: childLimit.jiaoYunYearStems ?? jiaoYunRule.yearStemPair,
        jiaoYunAnchorJieName: childLimit.jiaoYunAnchorJieName || jiaoYunRule.anchorJieName,
        jiaoYunAnchorJieDateTime: childLimit.jiaoYunAnchorJieDateTime || jiaoYunRule.anchorJieDateTime,
        jiaoYunAnchorJieDateTimeIso: childLimit.jiaoYunAnchorJieDateTimeIso || jiaoYunRule.anchorJieDateTimeIso,
        jiaoYunOffsetDaysAfterJie: childLimit.jiaoYunOffsetDaysAfterJie ?? jiaoYunRule.offsetDaysAfterJie,
    };
}

export function normalizeBaziResultV2(result: BaziResult): BaziResult {
    const normalized = normalizeLegacyStars(result);
    const timeMeta = buildNormalizedTimeMeta(normalized, normalized.baseInfo?.trueSolarDisplay);
    const subjectSource: Partial<BaziSubject> = isObject(normalized.subject)
        ? normalized.subject as Partial<BaziSubject>
        : {};
    const subject: BaziSubject = {
        name: toTrimmedString(subjectSource.name, '未命名命盘') || '未命名命盘',
        genderLabel: subjectSource.genderLabel === '男' || subjectSource.genderLabel === '女'
            ? subjectSource.genderLabel
            : (normalized.gender === 1 ? '男' : '女'),
        mingZaoLabel: subjectSource.mingZaoLabel === '乾造' || subjectSource.mingZaoLabel === '坤造'
            ? subjectSource.mingZaoLabel
            : (normalized.gender === 1 ? '乾造' : '坤造'),
        yinYangLabel: subjectSource.yinYangLabel === '阴' ? '阴' : '阳',
    };
    const defaultBaseInfo: BaziBaseInfo = {
        zodiac: '',
        lunarDisplay: '',
        solarDisplay: formatDisplayDateTimeFromLocal(timeMeta.solarDateTimeLocal)
            || `${normalized.solarDate} ${normalized.solarTime}`,
        trueSolarDisplay: formatDisplayDateTimeFromLocal(timeMeta.trueSolarDateTimeLocal)
            || `${normalized.solarDate} ${normalized.trueSolarTime}:00`,
        birthPlaceDisplay: '未设置出生地',
        constellation: '',
        xingXiu: '',
        renYuanDuty: '',
        renYuanDutyDetail: {
            stem: '',
            element: '',
            dayIndex: 1,
            monthBranch: '',
            ruleKey: 'ziping_zhenquan_v1',
            display: '',
        },
        taiYuan: '',
        taiXi: '',
        mingGong: '',
        shenGong: '',
        mingGua: `${normalized.yuanMing.current.guaName}卦（${normalized.yuanMing.current.group}）`,
        kongWang: '',
    };
    const baseInfoSource: Partial<BaziBaseInfo> = isObject(normalized.baseInfo)
        ? normalized.baseInfo as Partial<BaziBaseInfo>
        : {};
    const renYuanDutyDetailSource = isObject(baseInfoSource.renYuanDutyDetail)
        ? baseInfoSource.renYuanDutyDetail as Partial<BaziRenYuanDutyDetail>
        : null;
    const baseInfo: BaziBaseInfo = {
        zodiac: toTrimmedString(baseInfoSource.zodiac),
        lunarDisplay: toTrimmedString(baseInfoSource.lunarDisplay),
        solarDisplay: toTrimmedString(baseInfoSource.solarDisplay, defaultBaseInfo.solarDisplay) || defaultBaseInfo.solarDisplay,
        trueSolarDisplay: toTrimmedString(baseInfoSource.trueSolarDisplay, defaultBaseInfo.trueSolarDisplay) || defaultBaseInfo.trueSolarDisplay,
        birthPlaceDisplay: toTrimmedString(baseInfoSource.birthPlaceDisplay, '未设置出生地') || '未设置出生地',
        constellation: toTrimmedString(baseInfoSource.constellation),
        xingXiu: toTrimmedString(baseInfoSource.xingXiu),
        renYuanDuty: toTrimmedString(baseInfoSource.renYuanDuty),
        renYuanDutyDetail: renYuanDutyDetailSource
            ? {
                stem: toTrimmedString(renYuanDutyDetailSource.stem),
                element: toTrimmedString(renYuanDutyDetailSource.element),
                dayIndex: isFiniteNumber(renYuanDutyDetailSource.dayIndex) ? renYuanDutyDetailSource.dayIndex : 1,
                monthBranch: toTrimmedString(renYuanDutyDetailSource.monthBranch),
                ruleKey: 'ziping_zhenquan_v1',
                display: toTrimmedString(renYuanDutyDetailSource.display),
            }
            : defaultBaseInfo.renYuanDutyDetail,
        taiYuan: toTrimmedString(baseInfoSource.taiYuan),
        taiXi: toTrimmedString(baseInfoSource.taiXi),
        mingGong: toTrimmedString(baseInfoSource.mingGong),
        shenGong: toTrimmedString(baseInfoSource.shenGong),
        mingGua: toTrimmedString(baseInfoSource.mingGua, defaultBaseInfo.mingGua) || defaultBaseInfo.mingGua,
        kongWang: toTrimmedString(baseInfoSource.kongWang),
    };
    const renYuanDutyDetail = normalizeRenYuanDutyDetail({
        detail: baseInfo.renYuanDutyDetail,
        trueSolarDateTimeIso: timeMeta.trueSolarDateTimeIso,
    });
    const normalizedBaseInfo: BaziBaseInfo = {
        ...baseInfo,
        renYuanDuty: renYuanDutyDetail.stem ? `${renYuanDutyDetail.stem}${renYuanDutyDetail.element}用事` : '',
        renYuanDutyDetail,
    };
    const jieQiContext: BaziJieQiContext = normalized.jieQiContext ?? {
        prevTerm: { name: '', dateTime: '', dateTimeIso: '' },
        currentTerm: { name: '', dateTime: '', dateTimeIso: '' },
        nextTerm: { name: '', dateTime: '', dateTimeIso: '' },
        afterPrev: '',
        beforeNext: '',
    };
    const pillarMatrix: BaziPillarMatrixRow[] = normalized.pillarMatrix ?? [];
    const schoolOptionsResolved: BaziSchoolOptionsResolved = {
        ziHourMode: isObject(normalized.schoolOptionsResolved) && isZiHourMode(normalized.schoolOptionsResolved.ziHourMode)
            && normalized.schoolOptionsResolved.ziHourMode === 'early_zi_same_day'
            ? 'early_zi_same_day'
            : 'late_zi_next_day',
        timeMode: inferTimeMode(normalized, timeMeta),
        daylightSaving: isObject(normalized.schoolOptionsResolved) && normalized.schoolOptionsResolved.daylightSaving === true,
    };
    const shenShaV2Raw: BaziShenShaV2Result = normalized.shenShaV2 ?? {
        catalogVersion: 'fatemaster-55-v1',
        catalog: BAZI_SHENSHA_CATALOG,
        siZhu: {
            byPillar: normalized.shenSha.byPillar.map((item) => ({
                position: item.pillar,
                ganZhi: item.ganZhi,
                stars: item.stars.map((star) => ({
                    star,
                    hitLevel: 'normal',
                    hitReason: `命中${star}`,
                })),
            })),
            allStars: normalized.shenSha.allStars,
            starToPositions: normalized.shenSha.starToPillars,
            compatNote: ['历史记录自动补全为 V2 结构'],
        } as BaziShenShaLayerBucket,
        daYun: [],
        liuNian: [],
        liuYue: [],
    };
    const shenShaV2: BaziShenShaV2Result = {
        ...shenShaV2Raw,
        catalog: BAZI_SHENSHA_CATALOG,
        siZhu: normalizeLayerBucket(shenShaV2Raw.siZhu),
        daYun: shenShaV2Raw.daYun.map((item) => ({
            ...item,
            bucket: normalizeLayerBucket(item.bucket),
        })),
        liuNian: shenShaV2Raw.liuNian.map((item) => ({
            ...item,
            bucket: normalizeLayerBucket(item.bucket),
        })),
        liuYue: shenShaV2Raw.liuYue.map((item) => ({
            ...item,
            bucket: normalizeLayerBucket(item.bucket),
        })),
        ganZhiBuckets: shenShaV2Raw.ganZhiBuckets
            ? Object.fromEntries(
                Object.entries(shenShaV2Raw.ganZhiBuckets).map(([ganZhi, bucket]) => [ganZhi, normalizeLayerBucket(bucket)])
            )
            : buildBaziShenShaBucketMap({
                fourPillars: normalized.fourPillars,
                gender: normalized.gender,
                ganZhiList: buildShenShaGanZhiPool(normalized),
            }),
    };

    const rawStage = normalized.aiConversationStage as string | undefined;
    const normalizedStage = rawStage === 'foundation_pending'
        || rawStage === 'foundation_ready'
        || rawStage === 'verification_ready'
        || rawStage === 'followup_ready'
        ? rawStage
        : (rawStage === 'verification_confirmed'
            ? 'followup_ready'
            : (rawStage === 'initial_pending'
                ? 'foundation_pending'
                : (rawStage === 'verification_pending' ? 'verification_ready' : undefined)));

    const visibleHistory = (normalized.aiChatHistory || []).filter((message) => !message.hidden && message.role !== 'system');
    const hasFollowUpHistory = visibleHistory.some((message) => message.role === 'user')
        || visibleHistory.filter((message) => message.role === 'assistant').length > 1;
    const latestAssistant = [...(normalized.aiChatHistory || [])]
        .reverse()
        .find((message) => message.role === 'assistant' && message.content.trim())?.content
        || normalized.aiAnalysis
        || '';
    const hasVerificationMarker = latestAssistant.includes('[[BAZI_STAGE:VERIFICATION_DONE]]')
        || normalized.aiVerificationSummary?.includes('[[BAZI_STAGE:VERIFICATION_DONE]]');
    const hasFoundationMarker = latestAssistant.includes('[[BAZI_STAGE:FOUNDATION_DONE]]');

    return {
        ...normalized,
        timeMeta,
        solarDate: timeMeta.solarDate,
        solarTime: timeMeta.solarTime,
        trueSolarTime: timeMeta.trueSolarTime,
        childLimit: normalizeChildLimit(normalized.childLimit),
        aiConversationStage: normalizedStage
            ?? ((normalized.aiConversationDigest
                || (normalized.quickReplies && normalized.quickReplies.length > 0)
                || hasFollowUpHistory)
                ? 'followup_ready'
                : (hasVerificationMarker
                    ? 'verification_ready'
                    : (((normalized.aiAnalysis
                        || (normalized.aiChatHistory && normalized.aiChatHistory.length > 0)
                        || hasFoundationMarker)
                        ? 'foundation_ready'
                        : undefined)))),
        aiVerificationSummary: normalized.aiVerificationSummary,
        aiContextSnapshot: normalizeBaziFormatterContext(normalized.aiContextSnapshot),
        subject,
        baseInfo: normalizedBaseInfo,
        jieQiContext,
        pillarMatrix,
        schoolOptionsResolved,
        shenShaV2,
    };
}

export function normalizeStoredBaziResult(value: unknown): BaziResult | null {
    if (!isRecoverableLegacyBaziResult(value)) {
        return null;
    }

    const partial = value as Partial<BaziResult>;
    const trueSolarDisplay = isObject(partial.baseInfo)
        ? getStringFromRecord(partial.baseInfo, 'trueSolarDisplay')
        : undefined;
    const timeMeta = buildNormalizedTimeMeta(partial, trueSolarDisplay);

    const recoverableResult = {
        ...partial,
        solarDate: timeMeta.solarDate,
        solarTime: timeMeta.solarTime,
        trueSolarTime: timeMeta.trueSolarTime,
        timeMeta,
    } as BaziResult;

    return normalizeBaziResultV2(recoverableResult);
}
