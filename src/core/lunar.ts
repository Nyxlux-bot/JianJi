/**
 * 农历/天干地支/节气计算
 * 用于时间排卦和四柱八字推算
 */

import { TIAN_GAN, DI_ZHI, NAYIN } from './liuyao-data';

// ==================== 农历数据 (1900-2100) ====================
/**
 * 农历数据编码：每项是一个16进制数
 * 低12位：每bit代表一个月的大小月(1=大月30天, 0=小月29天)
 * 第13-16位：闰月月份(0=无闰月)
 * 最高4位的最低位: 闰月大小(1=30天, 0=29天)
 */
const LUNAR_INFO = [
    0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0, 0x09ad0, 0x055d2,
    0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540, 0x0d6a0, 0x0ada2, 0x095b0, 0x14977,
    0x04970, 0x0a4b0, 0x0b4b5, 0x06a50, 0x06d40, 0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970,
    0x06566, 0x0d4a0, 0x0ea50, 0x06e95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950,
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
    0x0e968, 0x0d520, 0x0daa0, 0x16aa6, 0x056d0, 0x04ae0, 0x0a9d4, 0x0a4d0, 0x0d150, 0x0f252,
    0x0d520,
];

// ==================== 节气数据 ====================
/**
 * 节气：每年24节气的日期（简化算法）
 * 从小寒开始，每两个节气（节+气）为一个月
 * 这里用公式近似计算
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

/**
 * 寿星万年历节气计算公式
 * 返回某年第n个节气的日期（公历）
 * n: 0=小寒, 1=大寒, ..., 23=冬至
 */
export function getSolarTermDate(year: number, n: number): Date {
    const y = year;
    const century = Math.floor(y / 100) + 1;

    // 世纪常数
    const stC20 = [
        6.11, 20.84, 4.15, 19.04, 6.11, 20.87, 5.59, 20.53,
        6.36, 21.37, 6.22, 21.81, 7.44, 23.13, 7.93, 23.24,
        8.44, 23.44, 8.57, 23.69, 7.98, 22.36, 7.18, 21.94,
    ];
    const stC21 = [
        5.4055, 20.12, 3.87, 18.73, 5.63, 20.646, 4.81, 20.1,
        5.52, 21.04, 5.678, 21.37, 7.108, 22.83, 7.5, 23.13,
        7.646, 23.042, 8.318, 23.438, 7.438, 22.36, 7.18, 21.94,
    ];

    const stConstants = century === 21 ? stC21 : stC20;

    const D = 0.2422;
    const base = stConstants[n];
    const yMod = y % 100;
    let day = Math.floor(yMod * D + base) - Math.floor(yMod / 4);

    // 特殊修正
    if (n === 0 && y === 2019) day = 5;  // 小寒修正
    if (n === 2 && (y === 2026)) day = 4; // 立春修正

    const month = SOLAR_TERM_BASE[n][0];
    return new Date(year, month - 1, day);
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

/** 公历转农历 */
export function solarToLunar(date: Date): LunarDate {
    const y = date.getFullYear();
    const m = date.getMonth() + 1;
    const d = date.getDate();
    const h = date.getHours();

    // 计算距1900年1月31日(农历1900正月初一)的天数
    const baseDate = new Date(1900, 0, 31);
    let offset = Math.floor((date.getTime() - baseDate.getTime()) / 86400000);

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

    // 天干地支计算
    const yearGZ = getYearGanZhi(y, m, d);
    const monthGZ = getMonthGanZhi(y, m, d);
    const dayGZ = getDayGanZhi(y, m, d);
    const hourGZ = getHourGanZhi(dayGZ, h);

    // 时辰地支
    const hourZhiIdx = Math.floor((h + 1) / 2) % 12;
    const hourZhi = DI_ZHI[hourZhiIdx];

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
        hourZhi,
    };
}

// ==================== 四柱计算 ====================

/** 年柱（以立春为界） */
function getYearGanZhi(y: number, m: number, d: number): string {
    // 检查是否在立春前
    const lichun = getSolarTermDate(y, 2); // 立春
    if (m < lichun.getMonth() + 1 || (m === lichun.getMonth() + 1 && d < lichun.getDate())) {
        y -= 1; // 立春前算上一年
    }
    const ganIdx = (y - 4) % 10;
    const zhiIdx = (y - 4) % 12;
    return TIAN_GAN[ganIdx] + DI_ZHI[zhiIdx];
}

/** 月柱（以节气为界） */
function getMonthGanZhi(y: number, m: number, d: number): string {
    // 确定月支：以节气划分
    // 节气索引: 立春(2), 惊蛰(4), 清明(6), 立夏(8), 芒种(10), 小暑(12),
    //          立秋(14), 白露(16), 寒露(18), 立冬(20), 大雪(22), 小寒(0)
    const jieqiIndices = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 0]; // 对应寅-丑月
    let monthZhiIdx = 2; // 默认寅月

    // 先检查是否在小寒和立春之间（丑月）
    const xiaohan = getSolarTermDate(y, 0);
    const lichun = getSolarTermDate(y, 2);

    if (m === 1 && d < xiaohan.getDate()) {
        // 上一年的大雪后 → 子月
        y -= 1;
        monthZhiIdx = 0; // 子
    } else if ((m === 1) || (m === 2 && d < lichun.getDate())) {
        // 丑月
        monthZhiIdx = 1;
    } else {
        // 寅月-亥月
        for (let i = 0; i < 11; i++) {
            const currJQ = getSolarTermDate(y, jieqiIndices[i]);
            const nextJQ = i < 10
                ? getSolarTermDate(y, jieqiIndices[i + 1])
                : getSolarTermDate(y + 1, 0); // 小寒跨年

            const currMonth = currJQ.getMonth() + 1;
            const currDay = currJQ.getDate();
            const nextMonth = nextJQ.getMonth() + 1;
            const nextDay = nextJQ.getDate();

            const afterCurr = m > currMonth || (m === currMonth && d >= currDay);
            const beforeNext = m < nextMonth || (m === nextMonth && d < nextDay);

            if (afterCurr && beforeNext) {
                monthZhiIdx = (i + 2) % 12; // 从寅开始
                break;
            }
        }
    }

    // 月干 = 年干×2 + 月支序号(寅=0) 的规律
    const yearGan = getYearGanZhi(y, m, d)[0];
    const yearGanIdx = (TIAN_GAN as readonly string[]).indexOf(yearGan);
    // 甲己→丙寅头, 乙庚→戊寅头, 丙辛→庚寅头, 丁壬→壬寅头, 戊癸→甲寅头
    const startGanIdx = [2, 4, 6, 8, 0][yearGanIdx % 5];
    const monthGanIdx = (startGanIdx + monthZhiIdx - 2 + 20) % 10;

    return TIAN_GAN[monthGanIdx] + DI_ZHI[monthZhiIdx];
}

/** 日柱（基于日期差值法） */
function getDayGanZhi(y: number, m: number, d: number): string {
    // 日干支计算：以 2000-01-07（甲子日）为基准
    // 使用 2000 年后的日期作为基准，避免 Hermes JS 引擎处理
    // 1970 年前负时间戳时可能存在的历史时区偏差
    // 验证: 2000-01-07 = 甲子 (甲=0, 子=0)
    const baseDate = new Date(2000, 0, 7);
    const targetDate = new Date(y, m - 1, d);
    const diffDays = Math.floor((targetDate.getTime() - baseDate.getTime()) / 86400000);
    const ganIdx = ((diffDays % 10) + 10) % 10;       // 甲=0
    const zhiIdx = ((diffDays % 12) + 12) % 12;       // 子=0
    return TIAN_GAN[ganIdx] + DI_ZHI[zhiIdx];
}

/** 时柱 */
function getHourGanZhi(dayGZ: string, hour: number): string {
    const dayGan = dayGZ[0];
    const dayGanIdx = (TIAN_GAN as readonly string[]).indexOf(dayGan);
    // 时辰地支
    const hourZhiIdx = Math.floor((hour + 1) / 2) % 12;
    // 日干定时干起始: 甲己→甲子, 乙庚→丙子, 丙辛→戊子, 丁壬→庚子, 戊癸→壬子
    const startGanIdx = [0, 2, 4, 6, 8][dayGanIdx % 5];
    const hourGanIdx = (startGanIdx + hourZhiIdx) % 10;
    return TIAN_GAN[hourGanIdx] + DI_ZHI[hourZhiIdx];
}

/** 获取纳音 */
export function getNaYin(ganZhi: string): string {
    return NAYIN[ganZhi] || '';
}

/** 获取当前时辰对应的节气信息 */
export function getCurrentJieqi(date: Date): { current: string; currentDate: string; next: string; nextDate: string } {
    const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
    const termPool: Array<{ name: string; date: Date }> = [];

    for (let year = date.getFullYear() - 1; year <= date.getFullYear() + 1; year += 1) {
        for (let index = 0; index < 24; index += 1) {
            termPool.push({
                name: SOLAR_TERM_NAMES[index],
                date: getSolarTermDate(year, index),
            });
        }
    }

    termPool.sort((left, right) => left.date.getTime() - right.date.getTime());

    let current = termPool[0];
    let next = termPool[termPool.length - 1];

    for (const term of termPool) {
        if (term.date.getTime() <= targetDate.getTime()) {
            current = term;
            continue;
        }
        next = term;
        break;
    }

    const formatTermDate = (termDate: Date): string => (
        `${String(termDate.getMonth() + 1).padStart(2, '0')}-${String(termDate.getDate()).padStart(2, '0')}`
    );

    return {
        current: current.name,
        currentDate: formatTermDate(current.date),
        next: next.name,
        nextDate: formatTermDate(next.date),
    };
}

// ==================== 反向推导 (Reverse Lookup) ====================

/**
 * 农历转公历
 * 由于范围在 1900-2100之间，最大只跨越2年，采用快速遍历撞库法。
 */
export function lunarToSolar(lunarYear: number, lunarMonth: number, lunarDay: number, isLeap: boolean = false): Date | null {
    // 农历年对应的公历年大多在同一年或下一年年初，因此从该年的1月1日开始往后找 400 天内必能找到
    const start = new Date(lunarYear, 0, 1).getTime();

    for (let i = -30; i < 400; i++) {
        const d = new Date(start + i * 86400000);
        const l = solarToLunar(d);
        if (l.year === lunarYear && l.month === lunarMonth && l.day === lunarDay && l.isLeap === isLeap) {
            return d;
        }
    }
    return null;
}

/**
 * 四柱反查年份
 * 给定 年干支，月干支，日干支，时干支
 * 在 [startYear, endYear] 之间查找所有符合该四柱的公历时间起点（通常返回该时辰的起始时间）
 */
export function findDatesByBazi(
    yearGZ: string,
    monthGZ: string,
    dayGZ: string,
    hourGZ: string,
    startYear: number = 1900,
    endYear: number = 2100
): Date[] {
    const results: Date[] = [];

    // 快速筛除非法的四柱输入 (比如时柱不匹配日柱等直接阻断)
    const testHour = getHourGanZhi(dayGZ, 0); // 随便测一个子时，如果连对应关系都不对，那说明输入本身前后矛盾
    // ... 这里为了简化，直接进入搜索

    // 年干支 60年一轮回。我们先找到所有符合 yearGZ 的年份
    const matchingYears: number[] = [];
    for (let y = startYear; y <= endYear; y++) {
        const yGZ = getYearGanZhi(y, 6, 1); // 随便取年中，避免立春交界的麻烦
        if (yGZ === yearGZ) {
            matchingYears.push(y);
        }
    }

    for (const year of matchingYears) {
        // 月干支也是在一个固定区间。遍历此年的 1月到12月 或者是前一年的12月到下一年的2月
        // 粗暴但绝对准确：遍历这年附近的 365+60 天
        const startTime = new Date(year - 1, 11, 1).getTime();
        for (let i = 0; i < 400; i++) {
            const date = new Date(startTime + i * 86400000);

            // 匹配年
            const yG = getYearGanZhi(date.getFullYear(), date.getMonth() + 1, date.getDate());
            if (yG !== yearGZ) continue;

            // 匹配月
            const mG = getMonthGanZhi(date.getFullYear(), date.getMonth() + 1, date.getDate());
            if (mG !== monthGZ) continue;

            // 匹配日
            const dG = getDayGanZhi(date.getFullYear(), date.getMonth() + 1, date.getDate());
            if (dG === dayGZ) {
                // 日子匹配了，再推算时辰
                // 通过 hourGZ 反查具体的小时数
                let foundHour = -1;
                for (let h = 0; h < 24; h += 2) {
                    if (getHourGanZhi(dayGZ, h) === hourGZ) {
                        foundHour = h;
                        break;
                    }
                }

                if (foundHour !== -1) {
                    const finalDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), foundHour, 0);
                    // 找到了一个符合的
                    results.push(finalDate);
                }
                break; // 日子匹配只有一天，剩下的天数不用看了
            }
        }
    }

    return results;
}
