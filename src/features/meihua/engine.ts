/**
 * 梅花易数起卦：先天数取上下卦，总数除六取动爻，再推互卦、变卦与体用。
 * 依据《梅花易数》卷一「年月日时起例」「物数占例」「互卦」。
 */
import { BA_GUA, DIZHI_INDEX, GUA_64, WuXing, yaoToGuaIndex } from '../../core/liuyao-data';
import { getCurrentJieqi, solarToLunar } from '../../core/lunar';
import type { MeihuaHexagram, MeihuaMethod, MeihuaNumberSource, MeihuaResult } from './types';

export type MeihuaCastInput =
    | { method: 'meihua_time' }
    | { method: 'meihua_number'; first: number; second: number };

const POSITION_NAMES = ['初', '二', '三', '四', '五', '上'];

export function getLinePositionName(line: number): string {
    return `${POSITION_NAMES[line - 1]}爻`;
}

function remainder(value: number, base: number): number {
    const rest = value % base;
    return rest === 0 ? base : rest;
}

function hexagramOf(upper: number, lower: number): MeihuaHexagram {
    const gua = GUA_64[`${upper}-${lower}`];
    return {
        upper,
        lower,
        lines: [...BA_GUA[lower].yao, ...BA_GUA[upper].yao],
        name: gua.name,
        fullName: gua.fullName,
    };
}

function hexagramFromLines(lines: number[]): MeihuaHexagram {
    return hexagramOf(yaoToGuaIndex(lines[3], lines[4], lines[5]), yaoToGuaIndex(lines[0], lines[1], lines[2]));
}

export function getTrigram(index: number): { index: number; name: string; wuxing: WuXing; nature: string } {
    const { name, wuxing, nature } = BA_GUA[index];
    return { index, name, wuxing, nature };
}

/** 由上下卦和动爻排出本、互、变卦与体用。 */
export function buildMeihuaHexagrams(upper: number, lower: number, movingLine: number): Pick<MeihuaResult, 'ben' | 'hu' | 'bian' | 'tiPosition'> {
    const ben = hexagramOf(upper, lower);
    // 互卦：去初、上二爻，二三四爻为下卦，三四五爻为上卦
    const hu = hexagramFromLines([ben.lines[1], ben.lines[2], ben.lines[3], ben.lines[2], ben.lines[3], ben.lines[4]]);
    const bianLines = ben.lines.map((value, index) => (index === movingLine - 1 ? 1 - value : value));
    return { ben, hu, bian: hexagramFromLines(bianLines), tiPosition: movingLine > 3 ? 'lower' : 'upper' };
}

function generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 11);
}

function formatClock(date: Date): { solarDate: string; solarTime: string } {
    const pad = (value: number) => String(value).padStart(2, '0');
    return {
        solarDate: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
        solarTime: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
    };
}

export function castMeihua(input: MeihuaCastInput, date: Date, question = ''): MeihuaResult {
    const lunarInfo = solarToLunar(date);
    const hourValue = DIZHI_INDEX[lunarInfo.hourZhi];
    const hourSource: MeihuaNumberSource = { label: '时', source: lunarInfo.hourZhi, value: hourValue };
    let numbers: MeihuaNumberSource[];
    let upperSum: number;
    let lowerSum: number;
    let movingSum: number;
    let formulas: MeihuaResult['formulas'];

    if (input.method === 'meihua_time') {
        // 年月日数为上卦，加时为下卦，年月日时总数取爻
        const yearZhi = lunarInfo.yearGanZhi[1];
        numbers = [
            { label: '年', source: yearZhi, value: DIZHI_INDEX[yearZhi] },
            { label: '月', source: lunarInfo.lunarMonthCN, value: lunarInfo.month },
            { label: '日', source: lunarInfo.lunarDayCN, value: lunarInfo.day },
            hourSource,
        ];
        upperSum = numbers[0].value + numbers[1].value + numbers[2].value;
        lowerSum = upperSum + hourValue;
        movingSum = lowerSum;
        formulas = {
            upper: `${upperSum} ÷ 8 余 ${remainder(upperSum, 8)}`,
            lower: `${lowerSum} ÷ 8 余 ${remainder(lowerSum, 8)}`,
            moving: `${movingSum} ÷ 6 余 ${remainder(movingSum, 6)}`,
        };
    } else {
        // 前数为上卦，后数为下卦；动爻并时数（卷一「物数占例」）
        const first = Math.trunc(input.first);
        const second = Math.trunc(input.second);
        if (!(first > 0 && second > 0)) {
            throw new Error('报数须为正整数');
        }
        numbers = [
            { label: '上数', source: '报数', value: first },
            { label: '下数', source: '报数', value: second },
            hourSource,
        ];
        upperSum = first;
        lowerSum = second;
        movingSum = first + second + hourValue;
        formulas = {
            upper: `${first} ÷ 8 余 ${remainder(first, 8)}`,
            lower: `${second} ÷ 8 余 ${remainder(second, 8)}`,
            moving: `${movingSum} ÷ 6 余 ${remainder(movingSum, 6)}`,
        };
    }

    const movingLine = remainder(movingSum, 6);
    const method: MeihuaMethod = input.method;
    return {
        kind: 'meihua',
        id: generateId(),
        createdAt: date.toISOString(),
        method,
        question,
        ...formatClock(date),
        lunarInfo,
        jieqi: getCurrentJieqi(date),
        numbers,
        formulas,
        movingLine,
        ...buildMeihuaHexagrams(remainder(upperSum, 8), remainder(lowerSum, 8), movingLine),
    };
}

/** 体卦、用卦的先天数。 */
export function getTiYong(result: Pick<MeihuaResult, 'ben' | 'tiPosition'>): { ti: number; yong: number } {
    return result.tiPosition === 'lower'
        ? { ti: result.ben.lower, yong: result.ben.upper }
        : { ti: result.ben.upper, yong: result.ben.lower };
}

/** 变卦中由用卦变出的经卦（体卦不变）。 */
export function getBianYong(result: Pick<MeihuaResult, 'bian' | 'tiPosition'>): number {
    return result.tiPosition === 'lower' ? result.bian.upper : result.bian.lower;
}

if (__DEV__) {
    // 设计稿两例：丙午年九月初七巳时得山风蛊五爻动；报 3、8 于巳时得火地晋五爻动
    const byTime = castMeihua({ method: 'meihua_time' }, new Date(2026, 9, 16, 10, 30));
    const byNumber = castMeihua({ method: 'meihua_number', first: 3, second: 8 }, new Date(2026, 9, 16, 10, 30));
    const ok = byTime.ben.fullName === '山风蛊' && byTime.movingLine === 5 && byTime.hu.fullName === '雷泽归妹'
        && byTime.bian.fullName === '巽为风' && byTime.tiPosition === 'lower'
        && byNumber.ben.fullName === '火地晋' && byNumber.movingLine === 5 && byNumber.bian.fullName === '天地否';
    if (!ok) {
        console.error('[meihua] 起卦自检失败', byTime.ben.fullName, byTime.hu.fullName, byTime.bian.fullName, byNumber.ben.fullName);
    }
}
