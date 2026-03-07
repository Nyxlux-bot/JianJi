import {
    ChildLimit,
    ChildLimitProvider,
    DecadeFortune,
    DefaultChildLimitProvider,
    DefaultEightCharProvider,
    EightChar,
    EightCharProvider,
    Fortune,
    Gender,
    HeavenStem,
    HideHeavenStem,
    HideHeavenStemType,
    LunarHour,
    LunarSect2EightCharProvider,
    SixtyCycle,
    SixtyCycleYear,
    SolarTime,
} from 'tyme4ts';
import { formatTrueSolarTime } from './true-solar-time';
import { solarToLunar } from './lunar';
import { getXunKong } from './xun-kong';
import { calculateRenYuanDuty } from './renyuan-duty';
import { buildJiaoYunRuleDetail } from './jiaoyun-rule';
import { calculateBaziChartTime } from './bazi-time';
import {
    BaziBaseInfo,
    BaziChildLimit,
    BaziCangGanGroup,
    BaziCangGanItem,
    BaziDaYunItem,
    BaziFourPillars,
    BaziGender,
    BaziJieQiContext,
    BaziPillarMatrixRow,
    BaziLiuNianItem,
    BaziLiuYueItem,
    BaziPillarKey,
    BaziRenYuanDutyDetail,
    BaziResult,
    BaziSchoolOptions,
    BaziSchoolOptionsResolved,
    BaziShiShenItem,
    BaziSubject,
    BaziTimeMeta,
    BaziYuanMing,
    BaziYuanMingItem,
    CangGanType,
    ShiShenName,
} from './bazi-types';
import { calculateBaziShenShaV2, toLegacyBaziShenShaResult } from './bazi-shensha';

export interface CalculateBaziParams {
    date: Date;
    gender: BaziGender;
    longitude?: number;
    referenceDate?: Date;
    createdAt?: Date;
    name?: string;
    locationName?: string;
    schoolOptions?: BaziSchoolOptions;
}

interface NormalizedCalculateBaziParams {
    inputDate: Date;
    chartDate: Date;
    referenceInputDate: Date;
    referenceChartDate: Date;
    gender: BaziGender;
    longitude: number | null;
    name: string;
    locationName: string;
    schoolOptionsResolved: BaziSchoolOptionsResolved;
}

interface BaziChildLimitInternal {
    raw: ChildLimit;
    startTime: SolarTime;
    endTime: SolarTime;
    startDate: Date;
    endDate: Date;
}

const PILLAR_KEYS: [BaziPillarKey, BaziPillarKey, BaziPillarKey, BaziPillarKey] = ['year', 'month', 'day', 'hour'];
const LATE_ZI_EIGHT_CHAR_PROVIDER: EightCharProvider = new DefaultEightCharProvider();
const EARLY_ZI_EIGHT_CHAR_PROVIDER: EightCharProvider = new LunarSect2EightCharProvider();
const DEFAULT_CHILD_LIMIT_PROVIDER: ChildLimitProvider = new DefaultChildLimitProvider();
const NON_DAY_SHI_SHEN_NAMES = new Set<Exclude<ShiShenName, '日主'>>([
    '比肩',
    '劫财',
    '食神',
    '伤官',
    '偏财',
    '正财',
    '七杀',
    '正官',
    '偏印',
    '正印',
]);
const GUA_META: Record<number, { name: string; wuXing: string; group: '东四命' | '西四命' }> = {
    1: { name: '坎', wuXing: '水', group: '东四命' },
    2: { name: '坤', wuXing: '土', group: '西四命' },
    3: { name: '震', wuXing: '木', group: '东四命' },
    4: { name: '巽', wuXing: '木', group: '东四命' },
    6: { name: '乾', wuXing: '金', group: '西四命' },
    7: { name: '兑', wuXing: '金', group: '西四命' },
    8: { name: '艮', wuXing: '土', group: '西四命' },
    9: { name: '离', wuXing: '火', group: '东四命' },
};
const YANG_STEMS = new Set(['甲', '丙', '戊', '庚', '壬']);
const CONSTELLATION_RANGES: Array<{ name: string; start: [number, number]; end: [number, number] }> = [
    { name: '摩羯座', start: [12, 22], end: [1, 19] },
    { name: '水瓶座', start: [1, 20], end: [2, 18] },
    { name: '双鱼座', start: [2, 19], end: [3, 20] },
    { name: '白羊座', start: [3, 21], end: [4, 19] },
    { name: '金牛座', start: [4, 20], end: [5, 20] },
    { name: '双子座', start: [5, 21], end: [6, 21] },
    { name: '巨蟹座', start: [6, 22], end: [7, 22] },
    { name: '狮子座', start: [7, 23], end: [8, 22] },
    { name: '处女座', start: [8, 23], end: [9, 22] },
    { name: '天秤座', start: [9, 23], end: [10, 23] },
    { name: '天蝎座', start: [10, 24], end: [11, 22] },
    { name: '射手座', start: [11, 23], end: [12, 21] },
];

function assertValidDate(value: Date, label: string): void {
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
        throw new Error(`无效的${label}`);
    }
}

function normalizeLongitude(longitude?: number): number | null {
    if (longitude === undefined) {
        return null;
    }
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
        throw new Error(`无效的经度: ${String(longitude)}`);
    }
    return longitude;
}

function normalizeName(name?: string): string {
    if (typeof name !== 'string') {
        return '';
    }
    return name.trim();
}

function normalizeLocationName(locationName?: string): string {
    if (typeof locationName !== 'string') {
        return '';
    }
    return locationName.trim();
}

function normalizeSchoolOptions(schoolOptions?: BaziSchoolOptions): BaziSchoolOptionsResolved {
    return {
        ziHourMode: schoolOptions?.ziHourMode === 'early_zi_same_day'
            ? 'early_zi_same_day'
            : 'late_zi_next_day',
        timeMode: schoolOptions?.timeMode === 'mean_solar_time' || schoolOptions?.timeMode === 'true_solar_time'
            ? schoolOptions.timeMode
            : 'clock_time',
        daylightSaving: schoolOptions?.daylightSaving === true,
    };
}

function resolveEightCharProvider(schoolOptions: BaziSchoolOptionsResolved): EightCharProvider {
    return schoolOptions.ziHourMode === 'early_zi_same_day'
        ? EARLY_ZI_EIGHT_CHAR_PROVIDER
        : LATE_ZI_EIGHT_CHAR_PROVIDER;
}

function withLunarHourProvider<T>(provider: EightCharProvider, action: () => T): T {
    const previousProvider = LunarHour.provider;
    LunarHour.provider = provider;
    try {
        return action();
    } finally {
        LunarHour.provider = previousProvider;
    }
}

function withChildLimitProvider<T>(provider: ChildLimitProvider, action: () => T): T {
    const previousProvider = ChildLimit.provider;
    ChildLimit.provider = provider;
    try {
        return action();
    } finally {
        ChildLimit.provider = previousProvider;
    }
}

function normalizeParams(params: CalculateBaziParams): NormalizedCalculateBaziParams {
    const { date, referenceDate, createdAt, gender } = params;
    assertValidDate(date, '出生时间');
    if (referenceDate) {
        assertValidDate(referenceDate, '参考时间');
    }
    if (createdAt) {
        assertValidDate(createdAt, '记录创建时间');
    }
    if (gender !== 0 && gender !== 1) {
        throw new Error(`无效的性别: ${String(gender)}`);
    }

    const longitude = normalizeLongitude(params.longitude);
    const name = normalizeName(params.name);
    const locationName = normalizeLocationName(params.locationName);
    const schoolOptionsResolved = normalizeSchoolOptions(params.schoolOptions);
    const inputDate = new Date(date.getTime());
    const referenceInputDate = new Date((referenceDate ?? date).getTime());
    const chartDate = calculateBaziChartTime(
        new Date(inputDate.getTime()),
        longitude,
        schoolOptionsResolved.timeMode,
        schoolOptionsResolved.daylightSaving,
    );
    const referenceChartDate = calculateBaziChartTime(
        new Date(referenceInputDate.getTime()),
        longitude,
        schoolOptionsResolved.timeMode,
        schoolOptionsResolved.daylightSaving,
    );

    return {
        inputDate,
        chartDate,
        referenceInputDate,
        referenceChartDate,
        gender,
        longitude,
        name,
        locationName,
        schoolOptionsResolved,
    };
}

function pad2(value: number): string {
    return String(value).padStart(2, '0');
}

function formatDisplayDate(date: Date): string {
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

function formatDisplayTime(date: Date): string {
    return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function formatDisplayDateTime(date: Date): string {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function formatIsoDate(date: Date): string {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function reduceToSingleDigit(value: number): number {
    let current = Math.abs(value);
    while (current >= 10) {
        current = String(current)
            .split('')
            .reduce((sum, digit) => sum + Number(digit), 0);
    }
    return current;
}

function resolveBaziYear(chartDate: Date, yearPillarGanZhi: string): number {
    const base = chartDate.getFullYear();
    for (let offset = -1; offset <= 1; offset += 1) {
        const candidate = base + offset;
        if (SixtyCycleYear.fromYear(candidate).getSixtyCycle().getName() === yearPillarGanZhi) {
            return candidate;
        }
    }
    return base;
}

function buildYuanMingItem(baseYear: number, mode: 'male' | 'female'): BaziYuanMingItem {
    const yearSum = reduceToSingleDigit(baseYear);
    let gua = mode === 'male'
        ? 11 - yearSum
        : yearSum + 4;

    while (gua > 9) {
        gua -= 9;
    }
    while (gua <= 0) {
        gua += 9;
    }

    // 5 宫按传统元男/元女分置
    if (gua === 5) {
        gua = mode === 'male' ? 2 : 8;
    }

    const meta = GUA_META[gua];
    if (!meta) {
        throw new Error(`无法解析元命卦: ${String(gua)}`);
    }

    return {
        label: mode === 'male' ? '元男' : '元女',
        guaNumber: gua,
        guaName: meta.name,
        wuXing: meta.wuXing,
        group: meta.group,
    };
}

function buildYuanMing(gender: BaziGender, chartDate: Date, yearPillarGanZhi: string): BaziYuanMing {
    const baseYear = resolveBaziYear(chartDate, yearPillarGanZhi);
    const yuanNan = buildYuanMingItem(baseYear, 'male');
    const yuanNv = buildYuanMingItem(baseYear, 'female');
    return {
        baseYear,
        yuanNan,
        yuanNv,
        current: gender === 1 ? yuanNan : yuanNv,
    };
}

function buildTimeMeta(input: { inputDate: Date; chartDate: Date }): BaziTimeMeta {
    return {
        solarDate: formatDisplayDate(input.inputDate),
        solarTime: formatDisplayTime(input.inputDate),
        trueSolarTime: formatTrueSolarTime(input.chartDate),
        solarDateIso: formatIsoDate(input.inputDate),
        solarDateTimeIso: input.inputDate.toISOString(),
        trueSolarDateTimeIso: input.chartDate.toISOString(),
    };
}

function toTymeSolarTime(date: Date): SolarTime {
    return SolarTime.fromYmdHms(
        date.getFullYear(),
        date.getMonth() + 1,
        date.getDate(),
        date.getHours(),
        date.getMinutes(),
        date.getSeconds()
    );
}

function getEightCharFromSolarTime(solarTime: SolarTime, schoolOptions: BaziSchoolOptionsResolved): EightChar {
    return resolveEightCharProvider(schoolOptions).getEightChar(solarTime.getLunarHour());
}

function solarTimeToDate(solarTime: SolarTime): Date {
    return new Date(
        solarTime.getYear(),
        solarTime.getMonth() - 1,
        solarTime.getDay(),
        solarTime.getHour(),
        solarTime.getMinute(),
        solarTime.getSecond(),
        0
    );
}

function solarDayToDate(year: number, month: number, day: number): Date {
    return new Date(year, month - 1, day, 0, 0, 0, 0);
}

function extractFourPillars(eightChar: EightChar): BaziFourPillars {
    return [
        eightChar.getYear().getName(),
        eightChar.getMonth().getName(),
        eightChar.getDay().getName(),
        eightChar.getHour().getName(),
    ];
}

function toNonDayShiShenName(name: string): Exclude<ShiShenName, '日主'> {
    if (!NON_DAY_SHI_SHEN_NAMES.has(name as Exclude<ShiShenName, '日主'>)) {
        throw new Error(`未知十神: ${name}`);
    }
    return name as Exclude<ShiShenName, '日主'>;
}

function buildShiShen(fourPillars: BaziFourPillars, dayMaster: HeavenStem): BaziResult['shiShen'] {
    return fourPillars.map((ganZhi, pillarIndex) => {
        const pillar = PILLAR_KEYS[pillarIndex];
        const sixtyCycle = SixtyCycle.fromName(ganZhi);
        const tianGan = sixtyCycle.getHeavenStem().getName();
        const shiShen: ShiShenName = pillar === 'day'
            ? '日主'
            : toNonDayShiShenName(dayMaster.getTenStar(sixtyCycle.getHeavenStem()).getName());

        return {
            pillar,
            pillarIndex: pillarIndex as 0 | 1 | 2 | 3,
            ganZhi,
            tianGan,
            shiShen,
        };
    }) as BaziResult['shiShen'];
}

function toCangGanType(type: HideHeavenStemType): CangGanType {
    switch (type) {
        case HideHeavenStemType.MAIN:
            return 'benQi';
        case HideHeavenStemType.MIDDLE:
            return 'zhongQi';
        case HideHeavenStemType.RESIDUAL:
            return 'yuQi';
        default:
            throw new Error(`未知藏干类型: ${String(type)}`);
    }
}

function mapHideHeavenStem(hide: HideHeavenStem, dayMaster: HeavenStem): BaziCangGanItem {
    return {
        type: toCangGanType(hide.getType()),
        gan: hide.getHeavenStem().getName(),
        shiShen: toNonDayShiShenName(dayMaster.getTenStar(hide.getHeavenStem()).getName()),
    };
}

function buildCangGan(fourPillars: BaziFourPillars, dayMaster: HeavenStem): BaziResult['cangGan'] {
    return fourPillars.map((ganZhi, pillarIndex) => {
        const pillar = PILLAR_KEYS[pillarIndex];
        const sixtyCycle = SixtyCycle.fromName(ganZhi);
        const diZhi = sixtyCycle.getEarthBranch();
        const items = diZhi.getHideHeavenStems().map((item) => mapHideHeavenStem(item, dayMaster));

        const group: BaziCangGanGroup = {
            pillar,
            pillarIndex: pillarIndex as 0 | 1 | 2 | 3,
            diZhi: diZhi.getName(),
            benQi: null,
            zhongQi: null,
            yuQi: null,
            items,
        };

        items.forEach((item) => {
            if (item.type === 'benQi') {
                group.benQi = item;
            } else if (item.type === 'zhongQi') {
                group.zhongQi = item;
            } else {
                group.yuQi = item;
            }
        });

        return group;
    }) as BaziResult['cangGan'];
}

function toTymeGender(gender: BaziGender): Gender {
    return gender === 1 ? Gender.MAN : Gender.WOMAN;
}

function buildChildLimit(
    chartSolarTime: SolarTime,
    gender: BaziGender,
    schoolOptions: BaziSchoolOptionsResolved,
    childLimitProvider: ChildLimitProvider = DEFAULT_CHILD_LIMIT_PROVIDER,
): BaziChildLimitInternal {
    const raw = withLunarHourProvider(resolveEightCharProvider(schoolOptions), () => (
        withChildLimitProvider(childLimitProvider, () => ChildLimit.fromSolarTime(chartSolarTime, toTymeGender(gender)))
    ));
    const startTime = raw.getStartTime();
    const endTime = raw.getEndTime();

    return {
        raw,
        startTime,
        endTime,
        startDate: solarTimeToDate(startTime),
        endDate: solarTimeToDate(endTime),
    };
}

function toPublicChildLimit(childLimit: BaziChildLimitInternal): BaziChildLimit {
    const startYear = childLimit.raw.getEndSixtyCycleYear().getYear();
    const jiaoYunRule = buildJiaoYunRuleDetail(childLimit.endDate, startYear);
    return {
        years: childLimit.raw.getYearCount(),
        months: childLimit.raw.getMonthCount(),
        days: childLimit.raw.getDayCount(),
        hours: childLimit.raw.getHourCount(),
        minutes: childLimit.raw.getMinuteCount(),
        startAge: childLimit.raw.getStartAge(),
        startYear,
        jiaoYunDateTime: formatDisplayDateTime(childLimit.endDate),
        jiaoYunDateTimeIso: childLimit.endDate.toISOString(),
        jiaoYunRuleText: jiaoYunRule.displayText,
        jiaoYunYearStems: jiaoYunRule.yearStemPair,
        jiaoYunAnchorJieName: jiaoYunRule.anchorJieName,
        jiaoYunAnchorJieDateTime: jiaoYunRule.anchorJieDateTime,
        jiaoYunAnchorJieDateTimeIso: jiaoYunRule.anchorJieDateTimeIso,
        jiaoYunOffsetDaysAfterJie: jiaoYunRule.offsetDaysAfterJie,
    };
}

function addYears(date: Date, years: number): Date {
    const next = new Date(date.getTime());
    next.setFullYear(next.getFullYear() + years);
    return next;
}

function isDateInRange(target: Date, start: Date, end: Date): boolean {
    return target.getTime() >= start.getTime() && target.getTime() < end.getTime();
}

function buildLiuYueList(input: {
    year: number;
    dayMaster: HeavenStem;
    birthChartDate: Date;
    referenceChartDate: Date;
}): BaziLiuYueItem[] {
    const yearMonths = SixtyCycleYear.fromYear(input.year).getMonths();
    const months: BaziLiuYueItem[] = [];

    for (let i = 0; i < yearMonths.length; i += 1) {
        const month = yearMonths[i];
        const firstDay = month.getFirstDay().getSolarDay();
        const startDate = solarDayToDate(firstDay.getYear(), firstDay.getMonth(), firstDay.getDay());
        const nextFirstDay = month.next(1).getFirstDay().getSolarDay();
        const endDate = solarDayToDate(nextFirstDay.getYear(), nextFirstDay.getMonth(), nextFirstDay.getDay());

        if (startDate.getFullYear() !== input.year) {
            continue;
        }

        if (
            input.year === input.birthChartDate.getFullYear()
            && endDate.getTime() <= input.birthChartDate.getTime()
        ) {
            continue;
        }

        const monthGanZhi = month.getName().replace(/月$/, '');
        const monthSixtyCycle = SixtyCycle.fromName(monthGanZhi);
        const tianGan = monthSixtyCycle.getHeavenStem();
        const diZhi = monthSixtyCycle.getEarthBranch();
        const diZhiMainGan = diZhi.getHideHeavenStemMain();

        months.push({
            index: months.length,
            year: input.year,
            ganZhi: monthGanZhi,
            tianGan: tianGan.getName(),
            diZhi: diZhi.getName(),
            tianGanShiShen: toNonDayShiShenName(input.dayMaster.getTenStar(tianGan).getName()),
            diZhiShiShen: toNonDayShiShenName(input.dayMaster.getTenStar(diZhiMainGan).getName()),
            termName: firstDay.getTerm().getName(),
            termDate: `${firstDay.getMonth()}/${firstDay.getDay()}`,
            termDateIso: `${firstDay.getYear()}-${pad2(firstDay.getMonth())}-${pad2(firstDay.getDay())}`,
            isCurrent: isDateInRange(input.referenceChartDate, startDate, endDate),
        });
    }

    return months;
}

function buildLiuNianList(input: {
    decadeFortune: DecadeFortune;
    dayMaster: HeavenStem;
    birthChartDate: Date;
    referenceChartDate: Date;
}): BaziLiuNianItem[] {
    const startFortune = input.decadeFortune.getStartFortune();
    const currentYear = input.referenceChartDate.getFullYear();
    const items: BaziLiuNianItem[] = [];

    for (let i = 0; i < 10; i += 1) {
        const yearly: Fortune = startFortune.next(i);
        const sixtyCycleYear = yearly.getSixtyCycleYear();
        const year = sixtyCycleYear.getYear();
        items.push({
            year,
            age: yearly.getAge(),
            ganZhi: sixtyCycleYear.getSixtyCycle().getName(),
            xiaoYunGanZhi: yearly.getSixtyCycle().getName(),
            isCurrent: year === currentYear,
            liuYue: buildLiuYueList({
                year,
                dayMaster: input.dayMaster,
                birthChartDate: input.birthChartDate,
                referenceChartDate: input.referenceChartDate,
            }),
        });
    }

    return items;
}

function buildDaYunList(input: {
    childLimit: BaziChildLimitInternal;
    dayMaster: HeavenStem;
    birthChartDate: Date;
    referenceChartDate: Date;
    count: number;
}): BaziDaYunItem[] {
    const startDecadeFortune = input.childLimit.raw.getStartDecadeFortune();
    const items: BaziDaYunItem[] = [];

    for (let i = 0; i < input.count; i += 1) {
        const decadeFortune = startDecadeFortune.next(i);
        const stepStartDate = addYears(input.childLimit.endDate, i * 10);
        const stepEndDate = addYears(input.childLimit.endDate, (i + 1) * 10);

        items.push({
            index: i,
            ganZhi: decadeFortune.getSixtyCycle().getName(),
            startAge: decadeFortune.getStartAge(),
            endAge: decadeFortune.getEndAge(),
            startYear: decadeFortune.getStartSixtyCycleYear().getYear(),
            endYear: decadeFortune.getEndSixtyCycleYear().getYear(),
            jiaoYunDateTime: formatDisplayDateTime(stepStartDate),
            jiaoYunDateTimeIso: stepStartDate.toISOString(),
            isCurrent: isDateInRange(input.referenceChartDate, stepStartDate, stepEndDate),
            liuNian: buildLiuNianList({
                decadeFortune,
                dayMaster: input.dayMaster,
                birthChartDate: input.birthChartDate,
                referenceChartDate: input.referenceChartDate,
            }),
        });
    }

    return items;
}

function buildXiaoYunList(input: {
    hourPillar: SixtyCycle;
    forward: boolean;
    dayMaster: HeavenStem;
    birthChartDate: Date;
    referenceChartDate: Date;
    daYun: BaziDaYunItem[];
}): BaziLiuNianItem[] {
    const firstDaYunStartAge = input.daYun.length > 0 ? input.daYun[0].startAge : 1;
    const count = Math.max(firstDaYunStartAge, 1);
    const currentYear = input.referenceChartDate.getFullYear();
    const items: BaziLiuNianItem[] = [];

    for (let i = 0; i < count; i += 1) {
        const age = i + 1;
        const year = input.birthChartDate.getFullYear() + i;
        const xiaoYunGanZhi = input.hourPillar.next(input.forward ? age : -age).getName();
        const sixtyCycleYear = SixtyCycleYear.fromYear(year);
        items.push({
            year,
            age,
            ganZhi: sixtyCycleYear.getSixtyCycle().getName(),
            xiaoYunGanZhi,
            isCurrent: year === currentYear,
            liuYue: buildLiuYueList({
                year,
                dayMaster: input.dayMaster,
                birthChartDate: input.birthChartDate,
                referenceChartDate: input.referenceChartDate,
            }),
        });
    }

    return items;
}

function findCurrentDaYunIndex(daYun: BaziDaYunItem[], referenceChartDate: Date): number {
    if (daYun.length === 0) {
        return -1;
    }

    const firstStartDate = new Date(daYun[0].jiaoYunDateTimeIso);
    if (referenceChartDate.getTime() < firstStartDate.getTime()) {
        return -1;
    }

    for (let i = 0; i < daYun.length; i += 1) {
        const item = daYun[i];
        const start = new Date(item.jiaoYunDateTimeIso);
        const end = addYears(start, 10);
        if (isDateInRange(referenceChartDate, start, end)) {
            return i;
        }
    }

    return -1;
}

function solarTimeToDisplay(date: Date): string {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}

function zodiacFromYearPillar(yearPillar: string): string {
    return SixtyCycle.fromName(yearPillar).getEarthBranch().getZodiac().getName();
}

function constellationFromDate(date: Date): string {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const isInRange = (start: [number, number], end: [number, number]): boolean => {
        const [sm, sd] = start;
        const [em, ed] = end;
        if (sm > em) {
            return (month === sm && day >= sd) || (month === em && day <= ed);
        }
        if (month < sm || month > em) {
            return false;
        }
        if (month === sm && day < sd) {
            return false;
        }
        if (month === em && day > ed) {
            return false;
        }
        return true;
    };

    const matched = CONSTELLATION_RANGES.find((item) => isInRange(item.start, item.end));
    return matched ? matched.name : '未知';
}

function formatDuration(from: Date, to: Date): string {
    const diff = Math.max(to.getTime() - from.getTime(), 0);
    const totalMinutes = Math.floor(diff / (60 * 1000));
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutes = totalMinutes % 60;
    return `${days}天${hours}小时${minutes}分钟`;
}

function buildSubjectInfo(input: {
    name: string;
    gender: BaziGender;
    dayMaster: HeavenStem;
}): BaziSubject {
    return {
        name: input.name || '未命名命盘',
        genderLabel: input.gender === 1 ? '男' : '女',
        mingZaoLabel: input.gender === 1 ? '乾造' : '坤造',
        yinYangLabel: YANG_STEMS.has(input.dayMaster.getName()) ? '阳' : '阴',
    };
}

function buildJieQiContext(chartSolarTime: SolarTime): BaziJieQiContext {
    const currentTerm = chartSolarTime.getSolarDay().getTerm();
    const prevTerm = currentTerm.next(-1);
    const nextTerm = currentTerm.next(1);
    const currentDate = solarTimeToDate(currentTerm.getJulianDay().getSolarTime());
    const prevDate = solarTimeToDate(prevTerm.getJulianDay().getSolarTime());
    const nextDate = solarTimeToDate(nextTerm.getJulianDay().getSolarTime());
    const chartDate = solarTimeToDate(chartSolarTime);

    return {
        prevTerm: {
            name: prevTerm.getName(),
            dateTime: solarTimeToDisplay(prevDate),
            dateTimeIso: prevDate.toISOString(),
        },
        currentTerm: {
            name: currentTerm.getName(),
            dateTime: solarTimeToDisplay(currentDate),
            dateTimeIso: currentDate.toISOString(),
        },
        nextTerm: {
            name: nextTerm.getName(),
            dateTime: solarTimeToDisplay(nextDate),
            dateTimeIso: nextDate.toISOString(),
        },
        afterPrev: formatDuration(currentDate, chartDate),
        beforeNext: formatDuration(chartDate, nextDate),
    };
}

function buildBaseInfo(input: {
    fourPillars: BaziFourPillars;
    eightChar: EightChar;
    chartSolarTime: SolarTime;
    chartDate: Date;
    trueSolarDate: Date;
    locationName: string;
}): BaziBaseInfo {
    const lunar = solarToLunar(input.trueSolarDate);
    const lunarHour = input.chartSolarTime.getLunarHour();
    const lunarDay = lunarHour.getLunarDay();
    const twentyEight = lunarDay.getTwentyEightStar();
    const zone = twentyEight.getZone();
    const renYuanDutyDetail = calculateRenYuanDuty(input.trueSolarDate);
    const mingGua = SixtyCycle.fromName(input.fourPillars[0]).getEarthBranch().getDirection().getName();
    const yearXunKong = getXunKong(input.fourPillars[0]).join('');
    const dayXunKong = getXunKong(input.fourPillars[2]).join('');
    const taiYuan = input.eightChar.getFetalOrigin();
    const taiXi = input.eightChar.getFetalBreath();
    const mingGongPillar = input.eightChar.getOwnSign();
    const shenGongPillar = input.eightChar.getBodySign();

    return {
        zodiac: zodiacFromYearPillar(input.fourPillars[0]),
        lunarDisplay: `${lunar.year}年${lunar.lunarMonthCN}${lunar.lunarDayCN}${lunar.hourZhi}时`,
        solarDisplay: solarTimeToDisplay(input.chartDate),
        trueSolarDisplay: solarTimeToDisplay(input.trueSolarDate),
        birthPlaceDisplay: input.locationName || '未设置出生地',
        constellation: constellationFromDate(input.chartDate),
        xingXiu: `${twentyEight.getName()}宿${zone.toString()}方${zone.getBeast().toString()}`,
        renYuanDuty: `${renYuanDutyDetail.stem}${renYuanDutyDetail.element}用事`,
        renYuanDutyDetail,
        taiYuan: `${taiYuan.getName()}（${taiYuan.getSound().getName()}）`,
        taiXi: `${taiXi.getName()}（${taiXi.getSound().getName()}）`,
        mingGong: `${mingGongPillar.getName()}（${mingGongPillar.getSound().getName()}）`,
        shenGong: `${shenGongPillar.getName()}（${shenGongPillar.getSound().getName()}）`,
        mingGua: `${mingGua}`,
        kongWang: `${yearXunKong} ${dayXunKong}`,
    };
}

function buildPillarMatrix(input: {
    fourPillars: BaziFourPillars;
    shiShen: BaziResult['shiShen'];
    cangGan: BaziResult['cangGan'];
    shenSha: BaziResult['shenSha'];
    subject: BaziSubject;
}): BaziPillarMatrixRow[] {
    const mainStarValues: [string, string, string, string] = [
        input.shiShen[0].shiShen,
        input.shiShen[1].shiShen,
        input.subject.genderLabel === '男' ? '元男' : '元女',
        input.shiShen[3].shiShen,
    ];
    const subStarValues = input.cangGan.map((group) => group.items.map((item) => item.shiShen).join(' ')) as [string, string, string, string];
    const tianGanValues = input.fourPillars.map((item) => SixtyCycle.fromName(item).getHeavenStem().getName()) as [string, string, string, string];
    const diZhiValues = input.fourPillars.map((item) => SixtyCycle.fromName(item).getEarthBranch().getName()) as [string, string, string, string];
    const cangGanValues = input.cangGan.map((group) => group.items.map((item) => `${item.gan}${item.shiShen}`).join(' ')) as [string, string, string, string];
    const xingYunValues = input.fourPillars.map((item) => {
        const sixtyCycle = SixtyCycle.fromName(item);
        return SixtyCycle.fromName(input.fourPillars[2]).getHeavenStem().getTerrain(sixtyCycle.getEarthBranch()).getName();
    }) as [string, string, string, string];
    const ziZuoValues = input.fourPillars.map((item) => {
        const sixtyCycle = SixtyCycle.fromName(item);
        return sixtyCycle.getHeavenStem().getTerrain(sixtyCycle.getEarthBranch()).getName();
    }) as [string, string, string, string];
    const kongWangValues = input.fourPillars.map((item) => getXunKong(item).join('')) as [string, string, string, string];
    const naYinValues = input.fourPillars.map((item) => SixtyCycle.fromName(item).getSound().getName()) as [string, string, string, string];
    const shenShaValues = input.shenSha.byPillar.map((item) => item.stars.join('\n')) as [string, string, string, string];

    return [
        { key: 'mainStar', label: '主星', values: mainStarValues },
        { key: 'subStar', label: '副星', values: subStarValues },
        { key: 'tianGan', label: '天干', values: tianGanValues },
        { key: 'diZhi', label: '地支', values: diZhiValues },
        { key: 'cangGan', label: '藏干', values: cangGanValues },
        { key: 'xingYun', label: '星运', values: xingYunValues },
        { key: 'ziZuo', label: '自坐', values: ziZuoValues },
        { key: 'kongWang', label: '空亡', values: kongWangValues },
        { key: 'naYin', label: '纳音', values: naYinValues },
        { key: 'shenSha', label: '神煞', values: shenShaValues },
    ];
}

function buildShenShaGanZhiPool(input: {
    daYun: BaziDaYunItem[];
    xiaoYun: BaziLiuNianItem[];
    extraGanZhi: string[];
}): string[] {
    return [
        ...input.extraGanZhi,
        ...input.daYun.map((item) => item.ganZhi),
        ...input.daYun.flatMap((item) => item.liuNian.map((liuNian) => liuNian.ganZhi)),
        ...input.daYun.flatMap((item) => item.liuNian.flatMap((liuNian) => liuNian.liuYue.map((liuYue) => liuYue.ganZhi))),
        ...input.xiaoYun.map((item) => item.ganZhi),
        ...input.xiaoYun.map((item) => item.xiaoYunGanZhi),
        ...input.xiaoYun.flatMap((item) => item.liuYue.map((liuYue) => liuYue.ganZhi)),
    ];
}

function fnv1a32(input: string): string {
    let hash = 0x811c9dc5;
    for (let i = 0; i < input.length; i += 1) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
}

function buildStableBaziId(input: {
    inputDate: Date;
    chartDate: Date;
    referenceInputDate: Date;
    referenceChartDate: Date;
    gender: BaziGender;
    longitude: number | null;
    schoolOptionsResolved: BaziSchoolOptionsResolved;
}): string {
    const longitudeValue = input.longitude === null ? 'null' : input.longitude.toFixed(6);
    const canonicalPayload = [
        'bazi',
        input.inputDate.toISOString(),
        input.chartDate.toISOString(),
        input.referenceInputDate.toISOString(),
        input.referenceChartDate.toISOString(),
        String(input.gender),
        longitudeValue,
        input.schoolOptionsResolved.ziHourMode,
        input.schoolOptionsResolved.timeMode,
    ].join('|');

    return `bazi_${fnv1a32(canonicalPayload)}`;
}

export function calculateBazi(params: CalculateBaziParams): BaziResult {
    const normalized = normalizeParams(params);
    const createdAt = params.createdAt ? new Date(params.createdAt.getTime()) : new Date();
    const timeMeta = buildTimeMeta(normalized);
    const chartSolarTime = toTymeSolarTime(normalized.chartDate);
    const eightChar = getEightCharFromSolarTime(chartSolarTime, normalized.schoolOptionsResolved);
    const dayMaster = eightChar.getDay().getHeavenStem();

    const fourPillars = extractFourPillars(eightChar);
    const shiShen = buildShiShen(fourPillars, dayMaster);
    const cangGan = buildCangGan(fourPillars, dayMaster);
    const yuanMing = buildYuanMing(normalized.gender, normalized.chartDate, fourPillars[0]);
    const subject = buildSubjectInfo({
        name: normalized.name,
        gender: normalized.gender,
        dayMaster,
    });
    const jieQiContext = buildJieQiContext(chartSolarTime);
    const childLimitInternal = buildChildLimit(chartSolarTime, normalized.gender, normalized.schoolOptionsResolved);
    const childLimit = toPublicChildLimit(childLimitInternal);
    const daYun = buildDaYunList({
        childLimit: childLimitInternal,
        dayMaster,
        birthChartDate: normalized.chartDate,
        referenceChartDate: normalized.referenceChartDate,
        count: 10,
    });
    const xiaoYun = buildXiaoYunList({
        hourPillar: SixtyCycle.fromName(fourPillars[3]),
        forward: childLimitInternal.raw.isForward(),
        dayMaster,
        birthChartDate: normalized.chartDate,
        referenceChartDate: normalized.referenceChartDate,
        daYun,
    });
    const currentDaYunIndex = findCurrentDaYunIndex(daYun, normalized.referenceChartDate);
    const liuNian = currentDaYunIndex >= 0 ? daYun[currentDaYunIndex].liuNian : [];
    const currentLiuNian = liuNian.find((item) => item.isCurrent) ?? liuNian[0];
    const shenShaGanZhiPool = buildShenShaGanZhiPool({
        daYun,
        xiaoYun,
        extraGanZhi: [
            eightChar.getBodySign().getName(),
            eightChar.getOwnSign().getName(),
            eightChar.getFetalOrigin().getName(),
        ],
    });
    const shenShaV2 = calculateBaziShenShaV2({
        fourPillars,
        gender: normalized.gender,
        daYun: daYun.map((item) => ({ index: item.index, ganZhi: item.ganZhi })),
        liuNian: liuNian.map((item, index) => ({ index, year: item.year, ganZhi: item.ganZhi })),
        liuYue: (currentLiuNian?.liuYue ?? []).map((item, index) => ({
            index,
            year: item.year,
            ganZhi: item.ganZhi,
            termName: item.termName,
        })),
        ganZhiPool: shenShaGanZhiPool,
    });
    const shenSha = toLegacyBaziShenShaResult(shenShaV2.siZhu);
    const baseInfo = buildBaseInfo({
        fourPillars,
        eightChar,
        chartSolarTime,
        chartDate: normalized.inputDate,
        trueSolarDate: normalized.chartDate,
        locationName: normalized.locationName,
    });
    const pillarMatrix = buildPillarMatrix({
        fourPillars,
        shiShen,
        cangGan,
        shenSha,
        subject,
    });

    return {
        id: buildStableBaziId(normalized),
        createdAt: createdAt.toISOString(),
        calculatedAt: normalized.chartDate.toISOString(),
        gender: normalized.gender,
        longitude: normalized.longitude,
        solarDate: timeMeta.solarDate,
        solarTime: timeMeta.solarTime,
        trueSolarTime: timeMeta.trueSolarTime,
        timeMeta,
        fourPillars,
        shiShen,
        cangGan,
        childLimit,
        currentDaYunIndex,
        daYun,
        liuNian,
        xiaoYun,
        yuanMing,
        shenSha,
        subject,
        baseInfo: {
            ...baseInfo,
            mingGua: `${yuanMing.current.guaName}卦（${yuanMing.current.group}）`,
        },
        jieQiContext,
        pillarMatrix,
        schoolOptionsResolved: normalized.schoolOptionsResolved,
        shenShaV2,
    };
}
