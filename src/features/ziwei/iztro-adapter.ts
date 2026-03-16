import '../../polyfills/intl';
import { astro } from 'iztro';
import type { IFunctionalAstrolabe } from 'iztro/lib/astro/FunctionalAstrolabe';
import type { IFunctionalHoroscope } from 'iztro/lib/astro/FunctionalHoroscope';
import {
    formatLunarDateLabel,
    getLunarLeapMonth,
    getLunarMonthDays,
    solarToLunar,
} from '../../core/lunar';
import { calculateTrueSolarTime } from '../../core/true-solar-time';
import { formatLocalDateTime, parseLocalDateTime } from '../../core/bazi-local-time';
import {
    buildZiweiBoardLayout,
    buildZiweiDirectHoroscopeScopeViews,
    buildZiweiHoroscopeScopeViews,
    buildZiweiHoroscopeSummary,
    buildZiweiPalaceAnalysisViews,
    buildZiweiStaticPalaceAnalysisViews,
    buildZiweiStarInsightViews,
} from './view-model';
import { buildZiweiBrightnessConfig, resolveZiweiBrightnessSchoolId } from './brightness/baseline';
import { ZIWEI_SUPPORTED_TIMEZONE_OFFSET_MINUTES } from './runtime-meta';
import {
    ZiweiAstroType,
    ZiweiCalendarType,
    ZiweiChartResult,
    ZiweiComputedInput,
    ZiweiConfigOptions,
    ZiweiDynamicHoroscopeResult,
    ZiweiGender,
    ZiweiInputPayload,
    ZiweiLunarDateInput,
    ZiweiRouteParams,
    ZiweiRouteParseResult,
    ZiweiStaticChartResult,
    ZiweiAlgorithm,
    ZiweiDayDivide,
    ZiweiYearDivide,
} from './types';

export const ZIWEI_STANDARD_TIMEZONE_OFFSET_MINUTES = ZIWEI_SUPPORTED_TIMEZONE_OFFSET_MINUTES;
export const ZIWEI_LANGUAGE = 'zh-CN' as const;
export const ZIWEI_FIX_LEAP = true;
const ZIWEI_STATIC_CACHE_LIMIT = 8;
const ziweiStaticChartCache = new Map<string, ZiweiStaticChartResult>();
const ZIWEI_DYNAMIC_CACHE_LIMIT = 36;
const ziweiDynamicHoroscopeCache = new Map<string, ZiweiDynamicHoroscopeResult>();
export const ZIWEI_DEFAULT_CONFIG: ZiweiConfigOptions = {
    algorithm: 'default',
    yearDivide: 'normal',
    horoscopeDivide: 'normal',
    dayDivide: 'forward',
    astroType: 'heaven',
};

const ZIWEI_TIME_LABELS = [
    '早子时',
    '丑时',
    '寅时',
    '卯时',
    '辰时',
    '巳时',
    '午时',
    '未时',
    '申时',
    '酉时',
    '戌时',
    '亥时',
    '晚子时',
] as const;

const ZIWEI_TIME_RANGES = [
    '00:00~01:00',
    '01:00~03:00',
    '03:00~05:00',
    '05:00~07:00',
    '07:00~09:00',
    '09:00~11:00',
    '11:00~13:00',
    '13:00~15:00',
    '15:00~17:00',
    '17:00~19:00',
    '19:00~21:00',
    '21:00~23:00',
    '23:00~00:00',
] as const;

/**
 * `iztro` v2.5.8 的源码和官方测试确认：
 * - `dayDivide = 'forward'` 时，`timeIndex = 12` 会参与“次日链路”的计算；
 * - `dayDivide = 'current'` 时，`timeIndex = 12` 会被折算回当天早子时语义。
 * 默认配置仍使用 `forward`，但适配层会尊重显式传入的 `current`；
 * 同时绝不手动对日期做 `+1 day` 二次修正。
 */

function formatSolarDate(date: Date): string {
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function formatLunarDateValue(lunar: ZiweiLunarDateInput): string {
    return `${lunar.year}-${lunar.month}-${lunar.day}`;
}

function firstQueryValue(value: string | string[] | undefined): string | undefined {
    return Array.isArray(value) ? value[0] : value;
}

function isZiweiGender(value: string): value is ZiweiGender {
    return value === 'male' || value === 'female';
}

function isZiweiCalendarType(value: string): value is ZiweiCalendarType {
    return value === 'solar' || value === 'lunar';
}

function isZiweiAlgorithm(value: string): value is ZiweiAlgorithm {
    return value === 'default' || value === 'zhongzhou';
}

function isZiweiYearDivide(value: string): value is ZiweiYearDivide {
    return value === 'normal' || value === 'exact';
}

function isZiweiDayDivide(value: string): value is ZiweiDayDivide {
    return value === 'forward' || value === 'current';
}

function isZiweiAstroType(value: string): value is ZiweiAstroType {
    return value === 'heaven' || value === 'earth' || value === 'human';
}

function parseBooleanFlag(value: string): boolean | null {
    if (value === '1') {
        return true;
    }
    if (value === '0') {
        return false;
    }
    return null;
}

function toFiniteNumber(value: string): number | null {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function normalizeZiweiConfig(config?: Partial<ZiweiConfigOptions>): ZiweiConfigOptions {
    return {
        algorithm: config?.algorithm ?? ZIWEI_DEFAULT_CONFIG.algorithm,
        yearDivide: config?.yearDivide ?? ZIWEI_DEFAULT_CONFIG.yearDivide,
        horoscopeDivide: config?.horoscopeDivide ?? ZIWEI_DEFAULT_CONFIG.horoscopeDivide,
        dayDivide: config?.dayDivide ?? ZIWEI_DEFAULT_CONFIG.dayDivide,
        astroType: config?.astroType ?? ZIWEI_DEFAULT_CONFIG.astroType,
    };
}

function toZiweiLunarDateInput(date: Date): ZiweiLunarDateInput {
    const lunar = solarToLunar(date);
    return {
        year: lunar.year,
        month: lunar.month,
        day: lunar.day,
        isLeapMonth: lunar.isLeap,
        label: formatLunarDateLabel({
            year: lunar.year,
            month: lunar.month,
            day: lunar.day,
            isLeap: lunar.isLeap,
        }),
    };
}

function parseZiweiConfigFromRoute(
    rawParams: Record<string, string | string[] | undefined>,
): ZiweiConfigOptions | null {
    const algorithmValue = firstQueryValue(rawParams.algorithm);
    const yearDivideValue = firstQueryValue(rawParams.yearDivide);
    const horoscopeDivideValue = firstQueryValue(rawParams.horoscopeDivide);
    const dayDivideValue = firstQueryValue(rawParams.dayDivide);
    const astroTypeValue = firstQueryValue(rawParams.astroType);

    if (algorithmValue && !isZiweiAlgorithm(algorithmValue)) {
        return null;
    }
    if (yearDivideValue && !isZiweiYearDivide(yearDivideValue)) {
        return null;
    }
    if (horoscopeDivideValue && !isZiweiYearDivide(horoscopeDivideValue)) {
        return null;
    }
    if (dayDivideValue && !isZiweiDayDivide(dayDivideValue)) {
        return null;
    }
    if (astroTypeValue && !isZiweiAstroType(astroTypeValue)) {
        return null;
    }

    return normalizeZiweiConfig({
        algorithm: algorithmValue as ZiweiAlgorithm | undefined,
        yearDivide: yearDivideValue as ZiweiYearDivide | undefined,
        horoscopeDivide: horoscopeDivideValue as ZiweiYearDivide | undefined,
        dayDivide: dayDivideValue as ZiweiDayDivide | undefined,
        astroType: astroTypeValue as ZiweiAstroType | undefined,
    });
}

export function getZiweiTimeLabel(timeIndex: number): string {
    return ZIWEI_TIME_LABELS[timeIndex] ?? '未知时辰';
}

export function getZiweiTimeRange(timeIndex: number): string {
    return ZIWEI_TIME_RANGES[timeIndex] ?? '--';
}

export function toZiweiTimeIndex(date: Date): number {
    const hour = date.getHours();

    if (hour === 0) {
        return 0;
    }

    if (hour === 23) {
        return 12;
    }

    return Math.floor((hour + 1) / 2);
}

export function computeZiweiDerivedInput(payload: ZiweiInputPayload): ZiweiComputedInput {
    const birthLocalDate = parseLocalDateTime(payload.birthLocal);
    if (!birthLocalDate) {
        throw new Error('出生时间参数无效');
    }

    const trueSolarDate = calculateTrueSolarTime(birthLocalDate, payload.longitude, {
        timezoneOffsetMinutes: payload.tzOffsetMinutes,
        daylightSavingEnabled: payload.daylightSavingEnabled,
    });
    const timeIndex = toZiweiTimeIndex(trueSolarDate);

    return {
        ...payload,
        birthLocalDate,
        trueSolarDate,
        solarDate: formatSolarDate(trueSolarDate),
        trueSolarLunar: toZiweiLunarDateInput(trueSolarDate),
        timeIndex,
        timeLabel: getZiweiTimeLabel(timeIndex),
        timeRange: getZiweiTimeRange(timeIndex),
    };
}

function buildAstrolabe(computed: ZiweiComputedInput): IFunctionalAstrolabe {
    const brightnessSchoolId = resolveZiweiBrightnessSchoolId(computed.config.algorithm);
    const brightness = buildZiweiBrightnessConfig(brightnessSchoolId);

    const baseOptions = {
        timeIndex: computed.timeIndex,
        gender: computed.gender,
        fixLeap: ZIWEI_FIX_LEAP,
        language: ZIWEI_LANGUAGE,
        config: {
            algorithm: computed.config.algorithm,
            yearDivide: computed.config.yearDivide,
            horoscopeDivide: computed.config.horoscopeDivide,
            dayDivide: computed.config.dayDivide,
            brightness,
        },
        astroType: computed.config.astroType,
    } as const;

    if (computed.calendarType === 'lunar') {
        return astro.withOptions({
            ...baseOptions,
            type: 'lunar',
            dateStr: formatLunarDateValue(computed.trueSolarLunar),
            isLeapMonth: computed.trueSolarLunar.isLeapMonth,
        }) as IFunctionalAstrolabe;
    }

    return astro.withOptions({
        ...baseOptions,
        type: 'solar',
        dateStr: computed.solarDate,
    }) as IFunctionalAstrolabe;
}

function buildCurrentHoroscope(astrolabe: IFunctionalAstrolabe, targetDate?: Date): IFunctionalHoroscope {
    return astrolabe.horoscope(targetDate ?? new Date());
}

export function buildZiweiStaticCacheKey(payload: ZiweiInputPayload): string {
    return [
        payload.birthLocal,
        payload.longitude,
        payload.gender,
        payload.tzOffsetMinutes,
        payload.daylightSavingEnabled ? 'dst1' : 'dst0',
        payload.calendarType,
        payload.lunar
            ? `${payload.lunar.year}-${payload.lunar.month}-${payload.lunar.day}-${payload.lunar.isLeapMonth ? '1' : '0'}`
            : 'solar',
        payload.config.algorithm,
        payload.config.yearDivide,
        payload.config.horoscopeDivide,
        payload.config.dayDivide,
        payload.config.astroType,
    ].join('|');
}

function rememberZiweiStaticChart(cacheKey: string, chart: ZiweiStaticChartResult): ZiweiStaticChartResult {
    ziweiStaticChartCache.set(cacheKey, chart);

    if (ziweiStaticChartCache.size > ZIWEI_STATIC_CACHE_LIMIT) {
        const oldestKey = ziweiStaticChartCache.keys().next().value;
        if (oldestKey) {
            ziweiStaticChartCache.delete(oldestKey);
        }
    }

    return chart;
}

export function computeZiweiStaticChart(payload: ZiweiInputPayload): ZiweiStaticChartResult {
    const cacheKey = buildZiweiStaticCacheKey(payload);
    const cached = ziweiStaticChartCache.get(cacheKey);

    if (cached) {
        return cached;
    }

    const computed = computeZiweiDerivedInput(payload);
    const astrolabe = buildAstrolabe(computed);
    const palaces = buildZiweiStaticPalaceAnalysisViews(astrolabe, computed.config.algorithm);

    return rememberZiweiStaticChart(cacheKey, {
        cacheKey,
        input: computed,
        astrolabe,
        workbenchLayout: buildZiweiBoardLayout(astrolabe),
        palaces,
        palaceByName: Object.fromEntries(palaces.map((item) => [item.name, item])),
        lazy: {},
    });
}

function buildZiweiDynamicCacheKey(staticChart: ZiweiStaticChartResult, cursorDate: Date): string {
    return `${staticChart.cacheKey}|${cursorDate.getTime()}`;
}

function rememberZiweiDynamicHoroscope(
    cacheKey: string,
    result: ZiweiDynamicHoroscopeResult,
): ZiweiDynamicHoroscopeResult {
    ziweiDynamicHoroscopeCache.set(cacheKey, result);

    if (ziweiDynamicHoroscopeCache.size > ZIWEI_DYNAMIC_CACHE_LIMIT) {
        const oldestKey = ziweiDynamicHoroscopeCache.keys().next().value;
        if (oldestKey) {
            ziweiDynamicHoroscopeCache.delete(oldestKey);
        }
    }

    return result;
}

export function computeZiweiDynamicHoroscope(
    staticChart: ZiweiStaticChartResult,
    targetDate?: Date,
): ZiweiDynamicHoroscopeResult {
    const cursorDate = targetDate ?? new Date();
    const cacheKey = buildZiweiDynamicCacheKey(staticChart, cursorDate);
    const cached = ziweiDynamicHoroscopeCache.get(cacheKey);

    if (cached) {
        return cached;
    }

    // Keep one dedicated dynamic astrolabe per static chart so repeated horoscope snapshots
    // can reuse iztro's runtime without sharing state across different rule configurations.
    if (!staticChart.lazy.dynamicAstrolabe) {
        staticChart.lazy.dynamicAstrolabe = buildAstrolabe(staticChart.input);
    }
    const horoscopeNow = buildCurrentHoroscope(staticChart.lazy.dynamicAstrolabe, cursorDate);

    return rememberZiweiDynamicHoroscope(cacheKey, {
        cursorDate,
        horoscopeNow,
        horoscopeSummary: buildZiweiHoroscopeSummary(staticChart.astrolabe, horoscopeNow),
    });
}

export function getZiweiStaticStarInsights(staticChart: ZiweiStaticChartResult) {
    if (!staticChart.lazy.starInsights || !staticChart.lazy.starByName) {
        const starInsights = buildZiweiStarInsightViews(staticChart.astrolabe, staticChart.input.config.algorithm);
        staticChart.lazy.starInsights = starInsights;
        staticChart.lazy.starByName = Object.fromEntries(starInsights.map((item) => [item.name, item]));
    }

    return {
        starInsights: staticChart.lazy.starInsights,
        starByName: staticChart.lazy.starByName,
    };
}

export function computeZiweiChart(payload: ZiweiInputPayload, targetDate?: Date): ZiweiChartResult {
    const staticChart = computeZiweiStaticChart(payload);
    const dynamic = computeZiweiDynamicHoroscope(staticChart, targetDate);
    const palaces = buildZiweiPalaceAnalysisViews(staticChart.astrolabe, dynamic.horoscopeNow, staticChart.input.config.algorithm);
    const { starInsights: stars, starByName } = getZiweiStaticStarInsights(staticChart);
    const directHoroscopeByScope = buildZiweiDirectHoroscopeScopeViews(staticChart.astrolabe, dynamic.horoscopeNow, staticChart.input.config.algorithm);

    return {
        input: staticChart.input,
        astrolabe: staticChart.astrolabe,
        horoscopeNow: dynamic.horoscopeNow,
        horoscopeSummary: dynamic.horoscopeSummary,
        workbenchLayout: staticChart.workbenchLayout,
        palaces,
        palaceByName: Object.fromEntries(palaces.map((item) => [item.name, item])),
        stars,
        starByName,
        horoscopeScopes: buildZiweiHoroscopeScopeViews(staticChart.astrolabe, dynamic.horoscopeNow, directHoroscopeByScope),
        directHoroscopeByScope,
    };
}

export function buildZiweiRouteParams(
    payload: ZiweiInputPayload,
    computed?: ZiweiComputedInput,
): ZiweiRouteParams {
    const trimmedName = payload.name?.trim();
    const trimmedCityLabel = payload.cityLabel?.trim();

    return {
        birthLocal: payload.birthLocal,
        longitude: String(payload.longitude),
        gender: payload.gender,
        tzOffsetMinutes: String(payload.tzOffsetMinutes),
        dst: payload.daylightSavingEnabled ? '1' : '0',
        calendarType: payload.calendarType,
        lunarYear: payload.lunar ? String(payload.lunar.year) : undefined,
        lunarMonth: payload.lunar ? String(payload.lunar.month) : undefined,
        lunarDay: payload.lunar ? String(payload.lunar.day) : undefined,
        isLeapMonth: payload.lunar ? (payload.lunar.isLeapMonth ? '1' : '0') : undefined,
        algorithm: payload.config.algorithm,
        yearDivide: payload.config.yearDivide,
        horoscopeDivide: payload.config.horoscopeDivide,
        dayDivide: payload.config.dayDivide,
        astroType: payload.config.astroType,
        cityLabel: trimmedCityLabel || undefined,
        name: trimmedName || undefined,
        timeIndex: computed ? String(computed.timeIndex) : undefined,
    };
}

export function parseZiweiRouteParams(
    rawParams: Record<string, string | string[] | undefined>,
): ZiweiRouteParseResult {
    const birthLocal = firstQueryValue(rawParams.birthLocal);
    const longitudeValue = firstQueryValue(rawParams.longitude);
    const genderValue = firstQueryValue(rawParams.gender);
    const tzOffsetValue = firstQueryValue(rawParams.tzOffsetMinutes);
    const dstValue = firstQueryValue(rawParams.dst);
    const debugTimeIndexValue = firstQueryValue(rawParams.timeIndex);
    const calendarTypeValue = firstQueryValue(rawParams.calendarType) ?? 'solar';

    if (!birthLocal) {
        return { ok: false, message: '缺少出生时间参数。' };
    }

    const parsedBirthLocal = parseLocalDateTime(birthLocal);
    if (!parsedBirthLocal) {
        return { ok: false, message: '出生时间参数无效。' };
    }
    if (parsedBirthLocal.getFullYear() < 1900 || parsedBirthLocal.getFullYear() > 2100) {
        return { ok: false, message: '当前仅支持 1900-2100 年的紫微排盘。' };
    }

    if (!longitudeValue) {
        return { ok: false, message: '缺少出生地经度参数。' };
    }

    if (!genderValue || !isZiweiGender(genderValue)) {
        return { ok: false, message: '性别参数无效。' };
    }

    if (!tzOffsetValue) {
        return { ok: false, message: '缺少标准时区参数。' };
    }

    if (!dstValue) {
        return { ok: false, message: '缺少夏令时参数。' };
    }

    if (!isZiweiCalendarType(calendarTypeValue)) {
        return { ok: false, message: '日期类型参数无效。' };
    }

    const longitude = toFiniteNumber(longitudeValue);
    if (longitude === null || longitude < -180 || longitude > 180) {
        return { ok: false, message: '出生地经度参数无效。' };
    }

    const tzOffsetMinutes = toFiniteNumber(tzOffsetValue);
    if (tzOffsetMinutes === null) {
        return { ok: false, message: '标准时区参数无效。' };
    }
    if (tzOffsetMinutes !== ZIWEI_STANDARD_TIMEZONE_OFFSET_MINUTES) {
        return { ok: false, message: '当前版本仅支持中国标准时区 UTC+8 的紫微排盘。' };
    }

    const daylightSavingEnabled = parseBooleanFlag(dstValue);
    if (daylightSavingEnabled === null) {
        return { ok: false, message: '夏令时参数无效。' };
    }

    const config = parseZiweiConfigFromRoute(rawParams);
    if (!config) {
        return { ok: false, message: '紫微高级配置参数无效。' };
    }

    let lunar: ZiweiLunarDateInput | undefined;
    if (calendarTypeValue === 'lunar') {
        const lunarYearValue = firstQueryValue(rawParams.lunarYear);
        const lunarMonthValue = firstQueryValue(rawParams.lunarMonth);
        const lunarDayValue = firstQueryValue(rawParams.lunarDay);
        const isLeapMonthValue = firstQueryValue(rawParams.isLeapMonth);

        if (!lunarYearValue || !lunarMonthValue || !lunarDayValue || !isLeapMonthValue) {
            return { ok: false, message: '缺少农历日期语义参数。' };
        }

        const year = toFiniteNumber(lunarYearValue);
        const month = toFiniteNumber(lunarMonthValue);
        const day = toFiniteNumber(lunarDayValue);
        const isLeapMonth = parseBooleanFlag(isLeapMonthValue);

        if (
            year === null
            || month === null
            || day === null
            || isLeapMonth === null
            || year < 1900
            || year > 2100
            || month < 1
            || month > 12
            || day < 1
            || day > 30
        ) {
            return { ok: false, message: '农历日期语义参数无效。' };
        }
        if (isLeapMonth && getLunarLeapMonth(year) !== month) {
            return { ok: false, message: '当前农历闰月参数无效。' };
        }
        if (day > getLunarMonthDays(year, month, isLeapMonth)) {
            return { ok: false, message: '当前农历日期超出该月范围。' };
        }

        lunar = {
            year,
            month,
            day,
            isLeapMonth,
            label: formatLunarDateLabel({
                year,
                month,
                day,
                isLeap: isLeapMonth,
            }),
        };
    }

    const debugTimeIndex = debugTimeIndexValue ? toFiniteNumber(debugTimeIndexValue) ?? undefined : undefined;

    return {
        ok: true,
        value: {
            birthLocal,
            longitude,
            gender: genderValue,
            tzOffsetMinutes,
            daylightSavingEnabled,
            calendarType: calendarTypeValue,
            lunar,
            config,
            cityLabel: firstQueryValue(rawParams.cityLabel)?.trim() || undefined,
            name: firstQueryValue(rawParams.name)?.trim() || undefined,
        },
        debugTimeIndex: typeof debugTimeIndex === 'number' ? debugTimeIndex : undefined,
    };
}

export function buildZiweiInputPayload(input: {
    birthDate: Date;
    longitude: number;
    gender: ZiweiGender;
    daylightSavingEnabled: boolean;
    calendarType?: ZiweiCalendarType;
    lunar?: ZiweiLunarDateInput;
    config?: Partial<ZiweiConfigOptions>;
    name?: string;
    cityLabel?: string;
    tzOffsetMinutes?: number;
}): ZiweiInputPayload {
    const calendarType = input.calendarType ?? 'solar';

    return {
        birthLocal: formatLocalDateTime(input.birthDate),
        longitude: input.longitude,
        gender: input.gender,
        tzOffsetMinutes: input.tzOffsetMinutes ?? ZIWEI_STANDARD_TIMEZONE_OFFSET_MINUTES,
        daylightSavingEnabled: input.daylightSavingEnabled,
        calendarType,
        lunar: calendarType === 'lunar'
            ? {
                ...(input.lunar ?? toZiweiLunarDateInput(input.birthDate)),
            }
            : undefined,
        config: normalizeZiweiConfig(input.config),
        cityLabel: input.cityLabel?.trim() || undefined,
        name: input.name?.trim() || undefined,
    };
}
