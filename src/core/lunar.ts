/**
 * 农历/天干地支/节气计算
 * 用于时间排卦和四柱八字推算
 */

import {
    DefaultEightCharProvider,
    EightCharProvider,
    LunarSect2EightCharProvider,
    SolarTerm,
    SolarDay,
    SolarTime,
} from 'tyme4ts';
import { TIAN_GAN, DI_ZHI, NAYIN } from './liuyao-data';

/** 子时口径，与 bazi-types 的 BaziZiHourMode 相同（底层模块不反向依赖八字类型） */
export type ZiHourMode = 'late_zi_next_day' | 'early_zi_same_day';

// ==================== 农历数据 (1900-2100) ====================
/**
 * 农历数据编码：每项是一个16进制数
 * 低12位：每bit代表一个月的大小月(1=大月30天, 0=小月29天)
 * 第13-16位：闰月月份(0=无闰月)
 * 最高4位的最低位: 闰月大小(1=30天, 0=29天)
 * 已按香港天文台历表校正：1933 年闰五月大、六月小（0x06e95 → 0x16a95），
 * 2097 年六月小、七月大（0x0a4d0 → 0x0a2d0）。
 */
const LUNAR_INFO = [
    0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0, 0x09ad0, 0x055d2,
    0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540, 0x0d6a0, 0x0ada2, 0x095b0, 0x14977,
    0x04970, 0x0a4b0, 0x0b4b5, 0x06a50, 0x06d40, 0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970,
    0x06566, 0x0d4a0, 0x0ea50, 0x16a95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950,
    0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, 0x025d0, 0x092d0, 0x0d2b2, 0x0a950, 0x0b557,
    0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5b0, 0x14573, 0x052b0, 0x0a9a8, 0x0e950, 0x06aa0,
    0x0aea6, 0x0ab50, 0x04b60, 0x0aae4, 0x0a570, 0x05260, 0x0f263, 0x0d950, 0x05b57, 0x056a0,
    0x096d0, 0x04dd5, 0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250, 0x0d558, 0x0b540, 0x0b6a0, 0x195a6,
    0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50, 0x06d40, 0x0af46, 0x0ab60, 0x09570,
    0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58, 0x05ac0, 0x0ab60, 0x096d5, 0x092e0,
    0x0c960, 0x0d954, 0x0d4a0, 0x0da50, 0x07552, 0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5,
    0x0a950, 0x0b4a0, 0x0baa4, 0x0ad50, 0x055d9, 0x04ba0, 0x0a5b0, 0x15176, 0x052b0, 0x0a930,
    0x07954, 0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6, 0x0a4e0, 0x0d260, 0x0ea65, 0x0d530,
    0x05aa0, 0x076a3, 0x096d0, 0x04afb, 0x04ad0, 0x0a4d0, 0x1d0b6, 0x0d250, 0x0d520, 0x0dd45,
    0x0b5a0, 0x056d0, 0x055b2, 0x049b0, 0x0a577, 0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0,
    0x14b63, 0x09370, 0x049f8, 0x04970, 0x064b0, 0x168a6, 0x0ea50, 0x06b20, 0x1a6c4, 0x0aae0,
    0x092e0, 0x0d2e3, 0x0c960, 0x0d557, 0x0d4a0, 0x0da50, 0x05d55, 0x056a0, 0x0a6d0, 0x055d4,
    0x052d0, 0x0a9b8, 0x0a950, 0x0b4a0, 0x0b6a6, 0x0ad50, 0x055a0, 0x0aba4, 0x0a5b0, 0x052b0,
    0x0b273, 0x06930, 0x07337, 0x06aa0, 0x0ad50, 0x14b55, 0x04b60, 0x0a570, 0x054e4, 0x0d160,
    0x0e968, 0x0d520, 0x0daa0, 0x16aa6, 0x056d0, 0x04ae0, 0x0a9d4, 0x0a2d0, 0x0d150, 0x0f252,
    0x0d520,
];

// ==================== 节气数据 ====================
/**
 * 节气名与所在公历月，从小寒开始，每两个节气（节+气）为一个月。
 * 交节日期由 tyme4ts 的天文算法给出（北京时间）。
 */
const SOLAR_TERM_BASE = [
    // [月, 节气名, 基准日期(世纪内)]
    [1, '小寒'], [1, '大寒'], [2, '立春'], [2, '雨水'],
    [3, '惊蛰'], [3, '春分'], [4, '清明'], [4, '谷雨'],
    [5, '立夏'], [5, '小满'], [6, '芒种'], [6, '夏至'],
    [7, '小暑'], [7, '大暑'], [8, '立秋'], [8, '处暑'],
    [9, '白露'], [9, '秋分'], [10, '寒露'], [10, '霜降'],
    [11, '立冬'], [11, '小雪'], [12, '大雪'], [12, '冬至'],
] as const;

export const SOLAR_TERM_NAMES = SOLAR_TERM_BASE.map(s => s[1]);

const solarTermDayCache = new Map<number, [number, number, number]>();

/**
 * 返回某年第 n 个节气交节当日的公历日期（本地 00:00，日期按北京时间）。
 * n: 0=小寒, 1=大寒, ..., 23=冬至
 */
export function getSolarTermDate(year: number, n: number): Date {
    const key = year * 24 + n;
    let ymd = solarTermDayCache.get(key);
    if (!ymd) {
        // tyme4ts 的节气序号以上一年冬至为 0，小寒为 1；序号 24 即当年冬至。
        const time = SolarTerm.fromIndex(year, n + 1).getJulianDay().getSolarTime();
        ymd = [time.getYear(), time.getMonth(), time.getDay()];
        solarTermDayCache.set(key, ymd);
    }
    return new Date(ymd[0], ymd[1] - 1, ymd[2]);
}

// ==================== 农历转换 ====================

/** 获取农历年的总天数 */
function lunarYearDays(y: number): number {
    const idx = y - 1900;
    if (idx < 0 || idx >= LUNAR_INFO.length) return 348;
    let sum = 348;
    const info = LUNAR_INFO[idx];
    for (let i = 0x8000; i > 0x8; i >>= 1) {
        sum += (info & i) ? 1 : 0;
    }
    return sum + leapDays(y);
}

/** 获取闰月天数 */
function leapDays(y: number): number {
    const idx = y - 1900;
    if (idx < 0 || idx >= LUNAR_INFO.length) return 0;
    if (leapMonth(y) === 0) return 0;
    return (LUNAR_INFO[idx] & 0x10000) ? 30 : 29;
}

/** 获取闰月月份(0=无闰月) */
function leapMonth(y: number): number {
    const idx = y - 1900;
    if (idx < 0 || idx >= LUNAR_INFO.length) return 0;
    return LUNAR_INFO[idx] & 0xf;
}

export function getLunarLeapMonth(year: number): number {
    return leapMonth(year);
}

/** 获取农历某月天数 */
function monthDays(y: number, m: number): number {
    const idx = y - 1900;
    if (idx < 0 || idx >= LUNAR_INFO.length) return 29;
    return (LUNAR_INFO[idx] & (0x10000 >> m)) ? 30 : 29;
}

export function getLunarMonthDays(year: number, month: number, isLeap: boolean = false): number {
    if (isLeap && leapMonth(year) === month) {
        return leapDays(year);
    }
    return monthDays(year, month);
}

export interface LunarDate {
    year: number;
    month: number;
    day: number;
    isLeap: boolean;
    yearGanZhi: string;
    monthGanZhi: string;
    dayGanZhi: string;
    hourGanZhi: string;
    lunarYearCN: string;
    lunarMonthCN: string;
    lunarDayCN: string;
    hourZhi: string;
}

const MONTH_CN = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];
const DAY_CN = [
    '', '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
    '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
    '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十',
];

export function getLunarMonthName(month: number): string {
    return MONTH_CN[month - 1] || `${month}`;
}

export function getLunarDayName(day: number): string {
    return DAY_CN[day] || `${day}`;
}

export function formatLunarDateLabel(input: {
    year: number;
    month: number;
    day: number;
    isLeap: boolean;
}): string {
    return `${input.year}年${input.isLeap ? '闰' : ''}${getLunarMonthName(input.month)}月${getLunarDayName(input.day)}`;
}

export type LunarCalendarDate = Pick<LunarDate, 'year' | 'month' | 'day' | 'isLeap'>;

/**
 * 公历转农历，只算农历年月日，不算四柱。
 * 需要在循环里大量换算日期时用这个（四柱计算要慢得多）。
 */
export function solarToLunarDate(date: Date): LunarCalendarDate {
    // 计算距1900年1月31日(农历1900正月初一)的天数。
    // 按公历日差计算，不受夏令时、1901 年前地方平时等历史时区偏移影响。
    let offset = Math.round(
        (Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - Date.UTC(1900, 0, 31)) / 86400000,
    );

    // LUNAR_INFO 只覆盖农历 1900–2100 年（公历 1900-01-31 至 2100 年底），表外日期改由 tyme4ts 换算
    if (offset < 0 || date.getFullYear() > 2100) {
        const lunarDay = SolarDay.fromYmd(date.getFullYear(), date.getMonth() + 1, date.getDate()).getLunarDay();
        const lunarMonth = lunarDay.getLunarMonth();
        return {
            year: lunarDay.getYear(),
            month: lunarMonth.getMonth(),
            day: lunarDay.getDay(),
            isLeap: lunarMonth.isLeap(),
        };
    }

    let lunarYear = 1900;
    let temp = 0;
    for (lunarYear = 1900; lunarYear < 2101 && offset > 0; lunarYear++) {
        temp = lunarYearDays(lunarYear);
        offset -= temp;
    }
    if (offset < 0) {
        offset += temp;
        lunarYear--;
    }

    const leap = leapMonth(lunarYear);
    let isLeap = false;
    let lunarMonth = 1;

    for (let i = 1; i < 13 && offset >= 0; i++) {
        if (leap > 0 && i === leap + 1 && !isLeap) {
            --i;
            isLeap = true;
            temp = leapDays(lunarYear);
        } else {
            temp = monthDays(lunarYear, i);
        }

        if (isLeap && i === leap + 1) {
            isLeap = false;
        }

        offset -= temp;
        if (!isLeap) lunarMonth = i;
    }

    if (offset === 0 && leap > 0 && lunarMonth === leap + 1) {
        if (isLeap) {
            isLeap = false;
        } else {
            isLeap = true;
            --lunarMonth;
        }
    }
    if (offset < 0) {
        offset += temp;
    }
    const lunarDay = offset + 1;

    return {
        year: lunarYear,
        month: lunarMonth,
        day: lunarDay,
        isLeap,
    };
}

/** 公历转农历，含四柱 */
export function solarToLunar(date: Date): LunarDate {
    const { year: lunarYear, month: lunarMonth, day: lunarDay, isLeap } = solarToLunarDate(date);
    const [yearGZ, monthGZ, dayGZ, hourGZ] = getFourPillars(
        date.getFullYear(),
        date.getMonth() + 1,
        date.getDate(),
        date.getHours(),
        date.getMinutes(),
        date.getSeconds(),
    );

    return {
        year: lunarYear,
        month: lunarMonth,
        day: lunarDay,
        isLeap,
        yearGanZhi: yearGZ,
        monthGanZhi: monthGZ,
        dayGanZhi: dayGZ,
        hourGanZhi: hourGZ,
        lunarYearCN: `${TIAN_GAN[(lunarYear - 4) % 10]}${DI_ZHI[(lunarYear - 4) % 12]}`,
        lunarMonthCN: `${isLeap ? '闰' : ''}${MONTH_CN[lunarMonth - 1]}月`,
        lunarDayCN: DAY_CN[lunarDay] || `${lunarDay}`,
        hourZhi: hourGZ[1],
    };
}

// ==================== 四柱计算 ====================

/**
 * 四柱口径：
 * - 年柱以立春、月柱以各「节」的交节时刻为界（精确到秒，北京时间）；
 * - solarToLunar（首页、六爻）子初换日：23:00 起日柱换成次日，时柱为次日子时，
 *   与八字默认「晚子时次日」（late_zi_next_day）、奇门一致；农历日期仍在 00:00 换日；
 * - 八字「早子时当日」（early_zi_same_day）只在 23 点不同：日柱仍是本日，时干按次日五鼠遁。
 * 直接调用 provider，不读写八字、奇门会临时切换的全局 LunarHour.provider。
 */
const SAME_DAY_ZI_PROVIDER = new LunarSect2EightCharProvider();
const NEXT_DAY_ZI_PROVIDER = new DefaultEightCharProvider();

function getEightCharProvider(ziHourMode: ZiHourMode): EightCharProvider {
    return ziHourMode === 'early_zi_same_day' ? SAME_DAY_ZI_PROVIDER : NEXT_DAY_ZI_PROVIDER;
}

function getFourPillars(
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
    second: number,
    provider: EightCharProvider = NEXT_DAY_ZI_PROVIDER,
): [string, string, string, string] {
    const eightChar = provider.getEightChar(
        SolarTime.fromYmdHms(year, month, day, hour, minute, second).getLunarHour(),
    );
    return [
        eightChar.getYear().getName(),
        eightChar.getMonth().getName(),
        eightChar.getDay().getName(),
        eightChar.getHour().getName(),
    ];
}

/** 按八字子时口径取某时刻的四柱（年、月、日、时），与八字排盘一致 */
export function getBaziPillars(
    date: Date,
    ziHourMode: ZiHourMode = 'late_zi_next_day',
): [string, string, string, string] {
    return getFourPillars(
        date.getFullYear(),
        date.getMonth() + 1,
        date.getDate(),
        date.getHours(),
        date.getMinutes(),
        date.getSeconds(),
        getEightCharProvider(ziHourMode),
    );
}

/** 六十甲子序号（甲子=0），不是合法干支时返回 -1 */
function getSixtyCycleIndex(ganZhi: string): number {
    if (ganZhi.length !== 2) return -1;
    const ganIdx = (TIAN_GAN as readonly string[]).indexOf(ganZhi[0]);
    const zhiIdx = (DI_ZHI as readonly string[]).indexOf(ganZhi[1]);
    if (ganIdx < 0 || zhiIdx < 0 || ganIdx % 2 !== zhiIdx % 2) return -1;
    return (6 * ganIdx - 5 * zhiIdx + 60) % 60;
}

/** 公历日的日柱六十甲子序号（2000-01-07 为甲子日），按公历日差计算，不受时区历史影响 */
function getDaySixtyCycleIndexUTC(utcDayStart: number): number {
    const diffDays = Math.round((utcDayStart - Date.UTC(2000, 0, 7)) / 86400000);
    return ((diffDays % 60) + 60) % 60;
}

/** 获取纳音 */
export function getNaYin(ganZhi: string): string {
    return NAYIN[ganZhi] || '';
}

/**
 * 获取某时刻所在的节气信息。
 * 与月柱同一套判定（tyme4ts 按交节时刻，精确到秒），交节当天交节前仍是上一个节气。
 */
export function getCurrentJieqi(date: Date): { current: string; currentDate: string; next: string; nextDate: string } {
    const current = SolarTime.fromYmdHms(
        date.getFullYear(),
        date.getMonth() + 1,
        date.getDate(),
        date.getHours(),
        date.getMinutes(),
        date.getSeconds(),
    ).getTerm();
    const next = current.next(1);

    const formatTermDate = (term: SolarTerm): string => {
        const time = term.getJulianDay().getSolarTime();
        return `${String(time.getMonth()).padStart(2, '0')}-${String(time.getDay()).padStart(2, '0')}`;
    };

    return {
        current: current.getName(),
        currentDate: formatTermDate(current),
        next: next.getName(),
        nextDate: formatTermDate(next),
    };
}

// ==================== 反向推导 (Reverse Lookup) ====================

/**
 * 农历转公历
 * 由于范围在 1900-2100之间，最大只跨越2年，采用快速遍历撞库法。
 */
export function lunarToSolar(lunarYear: number, lunarMonth: number, lunarDay: number, isLeap: boolean = false): Date | null {
    // 农历年从公历当年 1 月下旬至 2 月中旬开始，闰年 384 天，年尾最晚落在次年 2 月下旬，
    // 因此从该年 1 月 1 日往后找 450 天内必能找到。
    // 按日历逐日构造日期（而不是累加毫秒），夏令时、历史时区切换时不会偏日。
    for (let i = -30; i < 450; i++) {
        const d = new Date(lunarYear, 0, 1 + i);
        const l = solarToLunarDate(d);
        if (l.year === lunarYear && l.month === lunarMonth && l.day === lunarDay && l.isLeap === isLeap) {
            return d;
        }
    }
    return null;
}

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/**
 * 钟面时间轴：把北京时间的年月日时分秒借用 UTC 毫秒记成一个数，没有时区和夏令时，
 * 只用于比较、加减和取整，再按本地时间的年月日时分秒还原成 Date。
 */
function toWallClockMs(time: SolarTime): number {
    return Date.UTC(time.getYear(), time.getMonth() - 1, time.getDay(), time.getHour(), time.getMinute(), time.getSecond());
}

/**
 * tyme4ts 定月柱时实际换月的时刻：先按「节气所在日」粗定、再与精确交节时刻比较，
 * 所以取两者较晚者。少数深夜交节的节气（1801–2100 年共 41 个）所在日被算到次日，
 * 交节后到午夜之间仍算上个月；年柱则始终以精确的立春时刻为界。
 */
function getMonthBoundaryWallClockMs(term: SolarTerm): number {
    const termDay = term.getSolarDay();
    return Math.max(
        toWallClockMs(term.getJulianDay().getSolarTime()),
        Date.UTC(termDay.getYear(), termDay.getMonth() - 1, termDay.getDay()),
    );
}

function wallClockParts(ms: number): [number, number, number, number, number, number] {
    const date = new Date(ms);
    return [
        date.getUTCFullYear(),
        date.getUTCMonth() + 1,
        date.getUTCDate(),
        date.getUTCHours(),
        date.getUTCMinutes(),
        date.getUTCSeconds(),
    ];
}

function wallClockToLocalDate(ms: number): Date {
    const [y, m, d, h, mi, s] = wallClockParts(ms);
    return new Date(y, m - 1, d, h, mi, s, 0);
}

/** 该钟面时刻在本地时间里是否存在（夏令时跳时那一小时不存在） */
function existsInLocalTime(ms: number): boolean {
    const [y, m, d, h, mi] = wallClockParts(ms);
    const date = new Date(y, m - 1, d, h, mi, 0, 0);
    return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d
        && date.getHours() === h && date.getMinutes() === mi;
}

export interface BaziReverseMatch {
    /** 代表时间：落在有效区间内的整分，可直接用于排盘 */
    date: Date;
    /** 有效区间起点（含），精确到秒 */
    validFrom: Date;
    /** 有效区间终点（不含），精确到秒 */
    validUntil: Date;
    /** 交节落在这个时辰内时给出：side 为 after 表示有效段在交节之后，before 表示在交节之前 */
    solarTerm?: { name: string; time: Date; side: 'before' | 'after' };
    /** 早子时当日口径下 23 点的晚子时（时干按次日五鼠遁） */
    isLateZi: boolean;
}

export interface FindBaziMatchesOptions {
    startYear?: number;
    endYear?: number;
    /** 子时口径，默认与八字排盘默认值一致（晚子时算次日） */
    ziHourMode?: ZiHourMode;
}

/**
 * 四柱反查
 * 给定 年干支，月干支，日干支，时干支，在公历 [startYear, endYear] 年间查找所有符合该四柱的时段，按时间先后返回。
 * 每条结果给出精确的有效区间（时辰与交节求交）和一个代表时间：
 * 时辰中点（子时：晚子时算次日取 00:00，早子取 00:30，晚子取 23:30）在有效区间内就用中点，
 * 否则取有效区间的中点，均为整分。有效区间内没有可用整分的不返回。
 */
export function findBaziMatches(
    yearGZ: string,
    monthGZ: string,
    dayGZ: string,
    hourGZ: string,
    options: FindBaziMatchesOptions = {},
): BaziReverseMatch[] {
    const { startYear = 1900, endYear = 2100, ziHourMode = 'late_zi_next_day' } = options;
    const matches: BaziReverseMatch[] = [];
    const yearIdx = getSixtyCycleIndex(yearGZ);
    const monthIdx = getSixtyCycleIndex(monthGZ);
    const dayIdx = getSixtyCycleIndex(dayGZ);
    const hourIdx = getSixtyCycleIndex(hourGZ);
    if (yearIdx < 0 || monthIdx < 0 || dayIdx < 0 || hourIdx < 0) {
        return matches;
    }

    // 五鼠遁：甲己日起甲子，乙庚日起丙子，丙辛日起戊子，丁壬日起庚子，戊癸日起壬子
    const ziGanOf = (dayGanIdx: number) => (dayGanIdx % 5) * 2;
    const hourZhiIdx = hourIdx % 12;
    const hourGanIdx = hourIdx % 10;
    const dayGanIdx = dayIdx % 10;
    let isLateZi = false;
    if (hourGanIdx !== (ziGanOf(dayGanIdx) + hourZhiIdx) % 10) {
        // 只有早子时当日口径的 23 点晚子时按次日五鼠遁起时干
        if (hourZhiIdx === 0 && ziHourMode === 'early_zi_same_day' && hourGanIdx === ziGanOf(dayGanIdx + 1)) {
            isLateZi = true;
        } else {
            return matches;
        }
    }

    // 时辰相对「日柱所在公历日 00:00」的区间与中点
    let hourFrom: number;
    let hourUntil: number;
    let hourCenter: number;
    if (hourZhiIdx !== 0) {
        hourFrom = (2 * hourZhiIdx - 1) * HOUR_MS;
        hourUntil = (2 * hourZhiIdx + 1) * HOUR_MS;
        hourCenter = 2 * hourZhiIdx * HOUR_MS;
    } else if (isLateZi) {
        hourFrom = 23 * HOUR_MS;
        hourUntil = 24 * HOUR_MS;
        hourCenter = 23 * HOUR_MS + 30 * MINUTE_MS;
    } else if (ziHourMode === 'early_zi_same_day') {
        hourFrom = 0;
        hourUntil = HOUR_MS;
        hourCenter = 30 * MINUTE_MS;
    } else {
        // 晚子时算次日：前一日 23:00 起即为本日子时
        hourFrom = -HOUR_MS;
        hourUntil = HOUR_MS;
        hourCenter = 0;
    }

    const provider = getEightCharProvider(ziHourMode);
    // 寅月为第 0 个月；节令月 k 从 tyme4ts 节气序号 3 + 2k（立春=3）交节开始，到 5 + 2k 交节结束。
    const monthOrder = (monthIdx % 12 - 2 + 12) % 12;

    // 立春前的丑月属于上一个干支年，所以从 startYear - 1 年查起，最后按代表时间的公历年过滤。
    for (let year = startYear - 1; year <= endYear; year++) {
        if ((((year - 4) % 60) + 60) % 60 !== yearIdx) continue;

        const startTerm = SolarTerm.fromIndex(year, 3 + 2 * monthOrder);
        const endTerm = SolarTerm.fromIndex(year, 5 + 2 * monthOrder);
        const monthFrom = getMonthBoundaryWallClockMs(startTerm);
        // 丑月的终点同时是年柱的终点，年柱以精确立春时刻为界
        const monthUntil = monthOrder === 11
            ? toWallClockMs(endTerm.getJulianDay().getSolarTime())
            : getMonthBoundaryWallClockMs(endTerm);

        // 节令月不足 60 天，日柱至多出现一次。
        const firstDay = Math.floor(monthFrom / DAY_MS) * DAY_MS;
        const pillarDay = firstDay + ((dayIdx - getDaySixtyCycleIndexUTC(firstDay) + 60) % 60) * DAY_MS;
        const shichenFrom = pillarDay + hourFrom;
        const shichenUntil = pillarDay + hourUntil;
        const validFrom = Math.max(shichenFrom, monthFrom);
        const validUntil = Math.min(shichenUntil, monthUntil);
        if (validFrom >= validUntil) continue;

        const firstWholeMinute = Math.ceil(validFrom / MINUTE_MS) * MINUTE_MS;
        let representative = pillarDay + hourCenter;
        if (representative < validFrom || representative >= validUntil) {
            representative = Math.max(
                firstWholeMinute,
                Math.floor((validFrom + validUntil) / 2 / MINUTE_MS) * MINUTE_MS,
            );
        }
        // 夏令时跳时：代表时间在本地不存在时，改取有效区间内存在的最早整分
        if (!existsInLocalTime(representative)) {
            representative = firstWholeMinute;
            while (representative < validUntil && !existsInLocalTime(representative)) {
                representative += MINUTE_MS;
            }
        }
        if (representative >= validUntil) continue;

        const parts = wallClockParts(representative);
        if (parts[0] < startYear || parts[0] > endYear) continue;
        const pillars = getFourPillars(...parts, provider);
        if (pillars[0] !== yearGZ || pillars[1] !== monthGZ || pillars[2] !== dayGZ || pillars[3] !== hourGZ) {
            continue;
        }

        let solarTerm: BaziReverseMatch['solarTerm'];
        if (monthFrom > shichenFrom) {
            solarTerm = {
                name: startTerm.getName(),
                time: wallClockToLocalDate(toWallClockMs(startTerm.getJulianDay().getSolarTime())),
                side: 'after',
            };
        } else if (monthUntil < shichenUntil) {
            solarTerm = {
                name: endTerm.getName(),
                time: wallClockToLocalDate(toWallClockMs(endTerm.getJulianDay().getSolarTime())),
                side: 'before',
            };
        }

        matches.push({
            date: wallClockToLocalDate(representative),
            validFrom: wallClockToLocalDate(validFrom),
            validUntil: wallClockToLocalDate(validUntil),
            solarTerm,
            isLateZi,
        });
    }

    return matches;
}

/** 四柱反查，只返回代表时间（晚子时算次日口径），见 findBaziMatches */
export function findDatesByBazi(
    yearGZ: string,
    monthGZ: string,
    dayGZ: string,
    hourGZ: string,
    startYear: number = 1900,
    endYear: number = 2100
): Date[] {
    return findBaziMatches(yearGZ, monthGZ, dayGZ, hourGZ, { startYear, endYear }).map((match) => match.date);
}
