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
} from './bazi-types';
import { BAZI_SHENSHA_ALIAS_TO_FULLNAME, BAZI_SHENSHA_CATALOG } from './bazi-shensha-catalog';
import { buildBaziShenShaBucketMap } from './bazi-shensha';
import { buildJiaoYunRuleDetail, createEmptyJiaoYunRuleDetail } from './jiaoyun-rule';
import { calculateRenYuanDuty, createEmptyRenYuanDutyDetail } from './renyuan-duty';

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
    const subject: BaziSubject = normalized.subject ?? {
        name: '未命名命盘',
        genderLabel: normalized.gender === 1 ? '男' : '女',
        mingZaoLabel: normalized.gender === 1 ? '乾造' : '坤造',
        yinYangLabel: '阳',
    };
    const baseInfo: BaziBaseInfo = normalized.baseInfo ?? {
        zodiac: '',
        lunarDisplay: '',
        solarDisplay: `${normalized.solarDate} ${normalized.solarTime}`,
        trueSolarDisplay: `${normalized.solarDate} ${normalized.trueSolarTime}:00`,
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
    const renYuanDutyDetail = normalizeRenYuanDutyDetail({
        detail: baseInfo.renYuanDutyDetail,
        trueSolarDateTimeIso: normalized.timeMeta?.trueSolarDateTimeIso,
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
        ziHourMode: normalized.schoolOptionsResolved?.ziHourMode === 'early_zi_same_day'
            ? 'early_zi_same_day'
            : 'late_zi_next_day',
        timeMode: normalized.schoolOptionsResolved?.timeMode === 'mean_solar_time'
            || normalized.schoolOptionsResolved?.timeMode === 'true_solar_time'
            ? normalized.schoolOptionsResolved.timeMode
            : (normalized.longitude === null ? 'clock_time' : 'true_solar_time'),
        daylightSaving: normalized.schoolOptionsResolved?.daylightSaving === true,
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
        subject,
        baseInfo: normalizedBaseInfo,
        jieQiContext,
        pillarMatrix,
        schoolOptionsResolved,
        shenShaV2,
    };
}
