/**
 * 结果页的「运限层」与时间轴数据。
 *
 * 盘面拆成三层：星曜层只认本命数据、排盘后不再变化；运限层就是这里算出的
 * 每宫一小段字符串（宫位角色、流曜、运限四化），切运限时只有这些字符串变了的宫格重画；
 * 选中层只认一个宫位序号。这里全部是纯函数，输入是已经算好的运限结果，
 * 不再调用 iztro。
 */
import { LunarYear, Solar } from 'lunar-typescript';
import { kot, t } from 'iztro/lib/i18n';
import { getMutagensByHeavenlyStem } from 'iztro/lib/utils';
import { getCachedLunarDate } from './horoscope-fast';
import type {
    ZiweiDynamicHoroscopeResult,
    ZiweiDynamicScope,
    ZiweiMutagen,
    ZiweiPalaceAnalysisView,
    ZiweiStaticChartResult,
} from './types';

export type ZiweiView = 'natal' | ZiweiDynamicScope;

export const ZIWEI_VIEWS: Array<{ key: ZiweiView; label: string }> = [
    { key: 'natal', label: '本命' },
    { key: 'decadal', label: '大限' },
    { key: 'yearly', label: '流年' },
    { key: 'monthly', label: '流月' },
    { key: 'daily', label: '流日' },
    { key: 'hourly', label: '流时' },
];

export const ZIWEI_MUTAGEN_ORDER: ZiweiMutagen[] = ['禄', '权', '科', '忌'];

const STEMS = '甲乙丙丁戊己庚辛壬癸';
const BRANCHES = '子丑寅卯辰巳午未申酉戌亥';
const MONTH_NAMES = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];
const DAY_NAMES = [
    '', '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
    '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
    '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十',
];
/** 每个时辰取的锚点小时，子时取早子 0 点 */
const HOUR_ANCHORS = [0, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21];
const HOUR_RANGES = ['23–1', '1–3', '3–5', '5–7', '7–9', '9–11', '11–13', '13–15', '15–17', '17–19', '19–21', '21–23'];

const SCOPE_PREFIX: Record<ZiweiDynamicScope, string> = {
    decadal: '限',
    yearly: '年',
    monthly: '月',
    daily: '日',
    hourly: '时',
};
const PALACE_SHORT: Record<string, string> = {
    命宫: '命', 兄弟: '兄', 夫妻: '夫', 子女: '子', 财帛: '财', 疾厄: '疾',
    迁移: '迁', 仆役: '友', 交友: '友', 官禄: '官', 田宅: '田', 福德: '福', 父母: '父',
};

/** 竖排：一个 Text 里逐字换行，比每个字一个 Text 少得多的节点 */
export function verticalTextOf(text: string): string {
    return text.split('').join('\n');
}

export function palaceShortLabel(name: string): string {
    return PALACE_SHORT[name] || name.replace(/宫/g, '').slice(0, 1);
}

const zhCache = new Map<string, string>();

/** iztro 的 t() 走 i18next，单次就要零点几毫秒；渲染路径上一律查缓存 */
export function zh(value: string, kind?: string): string {
    if (!value) {
        return value;
    }
    const key = kind ? `${value}|${kind}` : value;
    let result = zhCache.get(key);
    if (result === undefined) {
        result = t(kot(value, kind)) as string;
        zhCache.set(key, result);
    }
    return result;
}

/** 天干四化：按 [禄, 权, 科, 忌] 给出星名，随当前算法配置（中州派与通行派个别天干不同） */
export function stemMutagenStars(stem: string): string[] {
    try {
        return (getMutagensByHeavenlyStem(kot(stem, 'Heavenly') as never) as string[]).map((name) => zh(name));
    } catch {
        return ['', '', '', ''];
    }
}

export function yearGanzhi(year: number): string {
    const offset = year - 4;
    return `${STEMS[((offset % 10) + 10) % 10]}${BRANCHES[((offset % 12) + 12) % 12]}`;
}

function julianDayOf(date: Date): number {
    return Math.floor(Solar.fromYmd(date.getFullYear(), date.getMonth() + 1, date.getDate()).getJulianDay() + 0.5);
}

/** 日干支：儒略日 + 49 对 60 取余（已与 lunar-typescript 对过 2 万天） */
export function dayGanzhiOfJulianDay(julianDay: number): string {
    const index = (((julianDay + 49) % 60) + 60) % 60;
    return `${STEMS[index % 10]}${BRANCHES[index % 12]}`;
}

/** 五鼠遁：由日干推时干 */
export function hourGanzhi(dayStem: string, hourIndex: number): string {
    const dayStemIndex = STEMS.indexOf(dayStem);
    const startStem = ((dayStemIndex % 5) * 2) % 10;
    return `${STEMS[(startStem + hourIndex) % 10]}${BRANCHES[hourIndex]}`;
}

/** 五虎遁：由年干推月干，正月建寅 */
export function monthGanzhi(lunarYear: number, lunarMonth: number): string {
    const yearStemIndex = (((lunarYear - 4) % 10) + 10) % 10;
    const startStem = ((yearStemIndex % 5) * 2 + 2) % 10;
    const offset = lunarMonth - 1;
    return `${STEMS[(startStem + offset) % 10]}${BRANCHES[(2 + offset) % 12]}`;
}

export function lunarMonthLabel(month: number, isLeap: boolean): string {
    return `${isLeap ? '闰' : ''}${MONTH_NAMES[month - 1] || month}月`;
}

export function lunarDayLabel(day: number): string {
    return DAY_NAMES[day] || String(day);
}

export function hourIndexOf(date: Date): number {
    const hour = date.getHours();
    return hour === 23 ? 0 : Math.floor((hour + 1) / 2);
}

/* ------------------------------------------------------------------ */
/* 农历月份表（按农历年缓存）                                            */
/* ------------------------------------------------------------------ */

export interface ZiweiLunarMonthInfo {
    year: number;
    month: number;
    isLeap: boolean;
    days: number;
    firstJulianDay: number;
}

const monthTableCache = new Map<number, ZiweiLunarMonthInfo[]>();

export function lunarMonthsOfYear(lunarYear: number): ZiweiLunarMonthInfo[] {
    let months = monthTableCache.get(lunarYear);
    if (!months) {
        months = LunarYear.fromYear(lunarYear).getMonthsInYear().map((item) => ({
            year: lunarYear,
            month: Math.abs(item.getMonth()),
            isLeap: item.getMonth() < 0,
            days: item.getDayCount(),
            firstJulianDay: item.getFirstJulianDay(),
        }));
        monthTableCache.set(lunarYear, months);
        if (monthTableCache.size > 64) {
            const oldest = monthTableCache.keys().next().value;
            if (oldest !== undefined) {
                monthTableCache.delete(oldest);
            }
        }
    }
    return months;
}

function findLunarMonth(lunarYear: number, month: number, isLeap: boolean): ZiweiLunarMonthInfo | null {
    const months = lunarMonthsOfYear(lunarYear);
    return months.find((item) => item.month === month && item.isLeap === isLeap)
        || months.find((item) => item.month === month && !item.isLeap)
        || null;
}

function solarFromJulianDay(julianDay: number, hour: number, minute = 0): Date {
    const solar = Solar.fromJulianDay(julianDay);
    return new Date(solar.getYear(), solar.getMonth() - 1, solar.getDay(), hour, minute, 0, 0);
}

function lunarToDate(lunarYear: number, month: number, isLeap: boolean, day: number, hour: number): Date | null {
    const info = findLunarMonth(lunarYear, month, isLeap);
    if (!info) {
        return null;
    }
    return solarFromJulianDay(info.firstJulianDay + Math.min(Math.max(day, 1), info.days) - 1, hour);
}

/* ------------------------------------------------------------------ */
/* 运限层                                                               */
/* ------------------------------------------------------------------ */

export interface ZiweiScopeHead {
    label: string;
    main: string;
    mainGanzhi: string;
    sub: string;
}

export interface ZiweiScopeLayer {
    key: string;
    view: ZiweiView;
    /** 每宫一个角色标签，如「年命」；本命为空串 */
    tags: string[];
    mingIndex: number;
    /** 每宫流曜，空格分隔 */
    flows: string[];
    /** 每宫被运限四化的星，格式「星名:四化|星名:四化」，便于做浅比较 */
    mutKeys: string[];
    head: ZiweiScopeHead;
    /** 中宫四化：[禄, 权, 科, 忌] 对应的星 */
    mutagenStars: string[];
    filledMutagen: boolean;
}

export interface ZiweiCursorInfo {
    cursor: Date;
    lunarYear: number;
    lunarMonth: number;
    lunarDay: number;
    isLeap: boolean;
    /** 流年所在公历年（按流年干支对回公历年） */
    liunianYear: number;
    hourIndex: number;
    nominalAge: number;
}

export function buildZiweiCursorInfo(dynamic: ZiweiDynamicHoroscopeResult): ZiweiCursorInfo {
    const cursor = dynamic.cursorDate;
    const lunar = getCachedLunarDate(cursor);
    const yearlyGz = `${zh(dynamic.horoscopeNow.yearly.heavenlyStem, 'Heavenly')}${zh(dynamic.horoscopeNow.yearly.earthlyBranch, 'Earthly')}`;
    const solarYear = cursor.getFullYear();
    const liunianYear = [solarYear, solarYear - 1, solarYear + 1].find((year) => yearGanzhi(year) === yearlyGz) ?? solarYear;

    return {
        cursor,
        lunarYear: lunar.lunarYear,
        lunarMonth: lunar.lunarMonth,
        lunarDay: lunar.lunarDay,
        isLeap: lunar.isLeap,
        liunianYear,
        hourIndex: hourIndexOf(cursor),
        nominalAge: dynamic.horoscopeNow.age.nominalAge,
    };
}

function birthMutagenStars(palaces: ZiweiPalaceAnalysisView[]): string[] {
    const result = ['', '', '', ''];
    palaces.forEach((palace) => {
        [...palace.majorStars, ...palace.minorStars].forEach((star) => {
            const order = ZIWEI_MUTAGEN_ORDER.indexOf(star.mutagen as ZiweiMutagen);
            if (order >= 0) {
                result[order] = star.name;
            }
        });
    });
    return result;
}

const EMPTY_TWELVE = Array.from({ length: 12 }, () => '');

export function buildNatalLayer(staticChart: ZiweiStaticChartResult): ZiweiScopeLayer {
    const birthYear = staticChart.astrolabe.rawDates.lunarDate.lunarYear;
    const yearGz = yearGanzhi(birthYear);
    return {
        key: `${staticChart.cacheKey}|natal`,
        view: 'natal',
        tags: EMPTY_TWELVE,
        mingIndex: -1,
        flows: EMPTY_TWELVE,
        mutKeys: EMPTY_TWELVE,
        head: {
            label: '本命',
            main: '生年四化',
            mainGanzhi: '',
            sub: `${yearGz}年生 · ${yearGz[0]}干四化`,
        },
        mutagenStars: birthMutagenStars(staticChart.palaces),
        filledMutagen: true,
    };
}

function buildScopeHead(
    staticChart: ZiweiStaticChartResult,
    dynamic: ZiweiDynamicHoroscopeResult,
    scope: ZiweiDynamicScope,
    info: ZiweiCursorInfo,
): ZiweiScopeHead {
    const scopeItem = dynamic.horoscopeNow[scope];
    const ganzhi = `${zh(scopeItem.heavenlyStem, 'Heavenly')}${zh(scopeItem.earthlyBranch, 'Earthly')}`;
    const mingPalace = staticChart.palaces[scopeItem.index]?.name || '';
    const monthLabel = lunarMonthLabel(info.lunarMonth, info.isLeap);

    switch (scope) {
        case 'decadal': {
            const [start, end] = staticChart.astrolabe.palaces[scopeItem.index]?.decadal.range || [0, 0];
            return {
                label: scopeItem.name || '大限',
                main: `${start}–${end}岁`,
                mainGanzhi: ganzhi,
                sub: `大限命宫 → ${mingPalace}`,
            };
        }
        case 'yearly':
            return {
                label: '流年',
                main: `${info.liunianYear}`,
                mainGanzhi: ganzhi,
                sub: `流年命宫 → ${mingPalace} · 虚岁 ${info.nominalAge}`,
            };
        case 'monthly':
            return {
                label: '流月',
                main: monthLabel,
                mainGanzhi: ganzhi,
                sub: `流月命宫 → ${mingPalace} · ${info.liunianYear} ${yearGanzhi(info.liunianYear)}年`,
            };
        case 'daily':
            return {
                label: '流日',
                main: lunarDayLabel(info.lunarDay),
                mainGanzhi: ganzhi,
                sub: `流日命宫 → ${mingPalace} · ${monthLabel}`,
            };
        case 'hourly':
        default:
            return {
                label: '流时',
                main: `${BRANCHES[info.hourIndex]}时`,
                mainGanzhi: ganzhi,
                sub: `流时命宫 → ${mingPalace} · ${monthLabel}${lunarDayLabel(info.lunarDay)}`,
            };
    }
}

export function buildScopeLayer(
    staticChart: ZiweiStaticChartResult,
    dynamic: ZiweiDynamicHoroscopeResult,
    scope: ZiweiDynamicScope,
    info: ZiweiCursorInfo = buildZiweiCursorInfo(dynamic),
): ZiweiScopeLayer {
    const snapshot = dynamic.runtimeSnapshot.scopes[scope];
    const prefix = SCOPE_PREFIX[scope];
    const tags = staticChart.palaces.map((_, index) => {
        const role = snapshot.palaceNames[index];
        return role ? `${prefix}${palaceShortLabel(role)}` : '';
    });
    const flows = staticChart.palaces.map((_, index) => (snapshot.starNamesByPalaceIndex[index] || []).join(' '));
    const mutagenByStar = new Map<string, ZiweiMutagen>();
    snapshot.mutagen.forEach((starName, order) => {
        if (starName) {
            mutagenByStar.set(starName, ZIWEI_MUTAGEN_ORDER[order]);
        }
    });
    const mutKeys = staticChart.palaces.map((palace) => (
        [...palace.majorStars, ...palace.minorStars]
            .filter((star) => mutagenByStar.has(star.name))
            .map((star) => `${star.name}:${mutagenByStar.get(star.name)}`)
            .join('|')
    ));

    return {
        key: `${staticChart.cacheKey}|${dynamic.cursorDate.getTime()}|${scope}`,
        view: scope,
        tags,
        mingIndex: snapshot.index,
        flows,
        mutKeys,
        head: buildScopeHead(staticChart, dynamic, scope, info),
        mutagenStars: ZIWEI_MUTAGEN_ORDER.map((_, order) => snapshot.mutagen[order] || ''),
        filledMutagen: false,
    };
}

export function parseMutKey(mutKey: string): Record<string, ZiweiMutagen> {
    if (!mutKey) {
        return {};
    }
    return Object.fromEntries(mutKey.split('|').map((item) => item.split(':') as [string, ZiweiMutagen]));
}

/* ------------------------------------------------------------------ */
/* 时间轴                                                               */
/* ------------------------------------------------------------------ */

export interface ZiweiTrackItem {
    key: string;
    top: string;
    ganzhi: string;
    sub: string;
    /** 落点按需再算：流年一轴有 120 项，提前全算会白白多换算一百多次农历 */
    resolve: () => Date;
    active: boolean;
}

export interface ZiweiTrackParent {
    label: string;
    ganzhi: string;
    prev: (() => Date) | null;
    next: (() => Date) | null;
    /** 点上级标签时切去的视图 */
    view: ZiweiView;
}

export interface ZiweiTrack {
    view: ZiweiView;
    items: ZiweiTrackItem[];
    activeIndex: number;
    parent: ZiweiTrackParent | null;
}

interface TrackContext {
    staticChart: ZiweiStaticChartResult;
    dynamic: ZiweiDynamicHoroscopeResult;
    info: ZiweiCursorInfo;
}

function birthLunarYear(staticChart: ZiweiStaticChartResult): number {
    return staticChart.astrolabe.rawDates.lunarDate.lunarYear;
}

/**
 * 流年 Y 的落点：尽量保留当前的农历月日；运限按立春分界时，
 * 正月里立春前的日子挪到农历新年与立春之后，保证流年和虚岁都落在 Y。
 */
export function yearCursor(staticChart: ZiweiStaticChartResult, info: ZiweiCursorInfo, year: number): Date {
    const hour = info.cursor.getHours();
    const desired = lunarToDate(year, info.lunarMonth, info.isLeap, info.lunarDay, hour)
        ?? new Date(year, 6, 1, hour);
    if (staticChart.input.config.horoscopeDivide === 'exact') {
        // 立春总在 2 月 3–5 日：2/6 之后一定进了 Y 年，次年 2/2 之前一定还没出 Y 年
        const newYear = lunarToDate(year, 1, false, 1, hour) ?? desired;
        const afterSpring = new Date(year, 1, 6, hour);
        const floor = newYear > afterSpring ? newYear : afterSpring;
        const nextNewYear = lunarToDate(year + 1, 1, false, 1, hour);
        const beforeNextSpring = new Date(year + 1, 1, 2, hour);
        const lastLunarDay = nextNewYear
            ? new Date(nextNewYear.getFullYear(), nextNewYear.getMonth(), nextNewYear.getDate() - 1, hour)
            : beforeNextSpring;
        const ceiling = lastLunarDay < beforeNextSpring ? lastLunarDay : beforeNextSpring;
        if (desired < floor) {
            return floor;
        }
        return desired > ceiling ? ceiling : desired;
    }
    return desired;
}

const exactMonthCache = new Map<string, string>();

function exactMonthGanzhi(julianDay: number, hour: number): string {
    const key = `${julianDay}|${hour}`;
    let value = exactMonthCache.get(key);
    if (!value) {
        const solar = Solar.fromJulianDay(julianDay);
        const lunar = Solar.fromYmdHms(solar.getYear(), solar.getMonth(), solar.getDay(), hour, 30, 0).getLunar();
        value = `${lunar.getMonthGanExact()}${lunar.getMonthZhiExact()}`;
        exactMonthCache.set(key, value);
        if (exactMonthCache.size > 256) {
            const oldest = exactMonthCache.keys().next().value;
            if (oldest !== undefined) {
                exactMonthCache.delete(oldest);
            }
        }
    }
    return value;
}

function decadalItems(context: TrackContext): ZiweiTrackItem[] {
    const { staticChart, dynamic, info } = context;
    const birthYear = birthLunarYear(staticChart);
    return [...staticChart.astrolabe.palaces]
        .sort((a, b) => a.decadal.range[0] - b.decadal.range[0])
        .map((palace) => {
            const [start, end] = palace.decadal.range;
            return {
                key: `decadal-${start}`,
                top: `${start}–${end}`,
                ganzhi: `${zh(palace.decadal.heavenlyStem, 'Heavenly')}${zh(palace.decadal.earthlyBranch, 'Earthly')}`,
                sub: zh(palace.name),
                resolve: () => yearCursor(staticChart, { ...info, lunarMonth: 7, lunarDay: 1, isLeap: false }, birthYear + start - 1),
                active: dynamic.horoscopeNow.decadal.index === palace.index,
            };
        });
}

function currentDecadeRange(context: TrackContext): [number, number] | null {
    const palace = context.staticChart.astrolabe.palaces[context.dynamic.horoscopeNow.decadal.index];
    return palace ? [palace.decadal.range[0], palace.decadal.range[1]] : null;
}

function yearlyTrack(context: TrackContext): ZiweiTrack {
    const { staticChart, info } = context;
    const birthYear = birthLunarYear(staticChart);
    const decades = [...staticChart.astrolabe.palaces].map((palace) => palace.decadal.range).sort((a, b) => a[0] - b[0]);
    let range = currentDecadeRange(context);
    // 童限（未起运）时大限宫不在年龄区间里：列出起运前的年份
    if (!range || info.nominalAge < range[0] || info.nominalAge > range[1]) {
        const firstStart = decades[0]?.[0] ?? 2;
        range = info.nominalAge < firstStart ? [1, firstStart - 1] : range;
    }
    const items: ZiweiTrackItem[] = [];
    if (range) {
        for (let age = range[0]; age <= range[1]; age += 1) {
            const year = birthYear + age - 1;
            items.push({
                key: `year-${year}`,
                top: `${year}`,
                ganzhi: yearGanzhi(year),
                sub: `${age}岁`,
                resolve: () => yearCursor(staticChart, info, year),
                active: year === info.liunianYear,
            });
        }
    }
    const decadeIndex = range ? decades.findIndex((item) => item[0] === range![0]) : -1;
    const jump = (delta: number): (() => Date) | null => {
        const target = decadeIndex >= 0
            ? decades[decadeIndex + delta]
            : delta > 0 ? decades[0] : undefined;
        return target ? () => yearCursor(staticChart, info, birthYear + target[0] - 1) : null;
    };
    return {
        view: 'yearly',
        items,
        activeIndex: items.findIndex((item) => item.active),
        parent: range
            ? {
                label: `${range[0]}–${range[1]}`,
                ganzhi: '',
                prev: jump(-1),
                next: jump(1),
                view: 'decadal',
            }
            : null,
    };
}

function shiftLunarMonth(info: ZiweiCursorInfo, delta: number): ZiweiLunarMonthInfo | null {
    const sequence = [
        ...lunarMonthsOfYear(info.lunarYear - 1),
        ...lunarMonthsOfYear(info.lunarYear),
        ...lunarMonthsOfYear(info.lunarYear + 1),
    ];
    const index = sequence.findIndex((item) => item.year === info.lunarYear && item.month === info.lunarMonth && item.isLeap === info.isLeap);
    return index >= 0 ? sequence[index + delta] || null : null;
}

function monthlyTrack(context: TrackContext): ZiweiTrack {
    const { staticChart, dynamic, info } = context;
    const hour = info.cursor.getHours();
    const activeGanzhi = `${zh(dynamic.horoscopeNow.monthly.heavenlyStem, 'Heavenly')}${zh(dynamic.horoscopeNow.monthly.earthlyBranch, 'Earthly')}`;
    const exact = staticChart.input.config.horoscopeDivide === 'exact';
    const items = lunarMonthsOfYear(info.lunarYear).map((month) => {
        const start = Solar.fromJulianDay(month.firstJulianDay);
        const active = month.month === info.lunarMonth && month.isLeap === info.isLeap;
        const day = Math.min(info.lunarDay, month.days);
        const julianDay = month.firstJulianDay + day - 1;
        let ganzhi = activeGanzhi;
        if (!active) {
            // 与 lunar-lite 同规：按初一换月时闰月后半月算下个月；按节气换月时取该日所在节气月
            ganzhi = exact
                ? exactMonthGanzhi(julianDay, hour)
                : monthGanzhi(month.year, month.month + (month.isLeap && day > 15 ? 1 : 0));
        }
        return {
            key: `month-${month.year}-${month.month}-${month.isLeap ? 'L' : ''}`,
            top: lunarMonthLabel(month.month, month.isLeap),
            ganzhi,
            sub: `${start.getMonth()}/${start.getDay()}`,
            resolve: () => solarFromJulianDay(julianDay, hour),
            active,
        };
    });
    const yearShift = (delta: number): (() => Date) | null => {
        const target = info.lunarYear + delta;
        if (target < 1901 || target > 2099) {
            return null;
        }
        return () => lunarToDate(target, info.lunarMonth, info.isLeap, info.lunarDay, hour) ?? new Date(target, 6, 1, hour);
    };
    return {
        view: 'monthly',
        items,
        activeIndex: items.findIndex((item) => item.active),
        parent: {
            label: `${info.lunarYear}`,
            ganzhi: yearGanzhi(info.lunarYear),
            prev: yearShift(-1),
            next: yearShift(1),
            view: 'yearly',
        },
    };
}

function dailyTrack(context: TrackContext): ZiweiTrack {
    const { info } = context;
    const hour = info.cursor.getHours();
    const month = findLunarMonth(info.lunarYear, info.lunarMonth, info.isLeap);
    const items: ZiweiTrackItem[] = [];
    if (month) {
        for (let day = 1; day <= month.days; day += 1) {
            const julianDay = month.firstJulianDay + day - 1;
            const solar = Solar.fromJulianDay(julianDay);
            items.push({
                key: `day-${month.year}-${month.month}-${month.isLeap ? 'L' : ''}-${day}`,
                top: lunarDayLabel(day),
                ganzhi: dayGanzhiOfJulianDay(julianDay),
                sub: `${solar.getMonth()}/${solar.getDay()}`,
                resolve: () => solarFromJulianDay(julianDay, hour),
                active: day === info.lunarDay,
            });
        }
    }
    const monthShift = (delta: number): (() => Date) | null => {
        const target = shiftLunarMonth(info, delta);
        return target ? () => solarFromJulianDay(target.firstJulianDay + Math.min(info.lunarDay, target.days) - 1, hour) : null;
    };
    return {
        view: 'daily',
        items,
        activeIndex: items.findIndex((item) => item.active),
        parent: {
            label: lunarMonthLabel(info.lunarMonth, info.isLeap),
            ganzhi: '',
            prev: monthShift(-1),
            next: monthShift(1),
            view: 'monthly',
        },
    };
}

function hourlyTrack(context: TrackContext): ZiweiTrack {
    const { info } = context;
    const cursor = info.cursor;
    const dayStem = dayGanzhiOfJulianDay(julianDayOf(cursor))[0];
    const items = HOUR_ANCHORS.map((anchor, index) => ({
        key: `hour-${index}`,
        top: `${BRANCHES[index]}时`,
        ganzhi: hourGanzhi(dayStem, index),
        sub: HOUR_RANGES[index],
        resolve: () => new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), anchor, 0, 0, 0),
        active: index === info.hourIndex,
    }));
    const dayShift = (delta: number): (() => Date) => () => new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + delta, cursor.getHours(), 0, 0, 0);
    return {
        view: 'hourly',
        items,
        activeIndex: items.findIndex((item) => item.active),
        parent: {
            label: `${cursor.getMonth() + 1}/${cursor.getDate()}`,
            ganzhi: '',
            prev: dayShift(-1),
            next: dayShift(1),
            view: 'daily',
        },
    };
}

export function buildZiweiTrack(
    staticChart: ZiweiStaticChartResult,
    dynamic: ZiweiDynamicHoroscopeResult,
    view: ZiweiView,
    info: ZiweiCursorInfo = buildZiweiCursorInfo(dynamic),
): ZiweiTrack {
    const context: TrackContext = { staticChart, dynamic, info };
    switch (view) {
        case 'decadal': {
            const items = decadalItems(context);
            return { view, items, activeIndex: items.findIndex((item) => item.active), parent: null };
        }
        case 'yearly':
            return yearlyTrack(context);
        case 'monthly':
            return monthlyTrack(context);
        case 'daily':
            return dailyTrack(context);
        case 'hourly':
            return hourlyTrack(context);
        case 'natal':
        default:
            return { view: 'natal', items: [], activeIndex: -1, parent: null };
    }
}

/** 预热用：当前视图附近会被点到的落点 */
export function buildPrewarmResolvers(track: ZiweiTrack, radius = 3): Array<() => Date> {
    if (track.activeIndex < 0) {
        return track.items.slice(0, radius).map((item) => item.resolve);
    }
    const result: Array<() => Date> = [];
    for (let offset = 1; offset <= radius; offset += 1) {
        const next = track.items[track.activeIndex + offset];
        const prev = track.items[track.activeIndex - offset];
        if (next) {
            result.push(next.resolve);
        }
        if (prev) {
            result.push(prev.resolve);
        }
    }
    if (track.parent?.prev) {
        result.push(track.parent.prev);
    }
    if (track.parent?.next) {
        result.push(track.parent.next);
    }
    return result;
}
