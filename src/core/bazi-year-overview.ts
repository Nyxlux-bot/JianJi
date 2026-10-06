import type { BaziResult } from './bazi-types';
import { buildBaziWuXingEnergy, type BaziWuXingEnergySnapshot } from './bazi-wuxing-energy';

export interface BaziYearInfo {
    year: number;
    ganZhi: string;
    age: number;
    /** 大运干支; undefined before the first 大运 (小运 period). */
    daYunGanZhi?: string;
    /** Set when the 大运 changes during this year: the one before the switch. */
    previousDaYunGanZhi?: string;
    daYunIndex: number;
    liuNianIndex: number;
}

/** App-side facts for one year, so headings the model writes never decide what is shown. */
export function getBaziYearInfo(result: Readonly<BaziResult>, year: number): BaziYearInfo | null {
    for (const [position, daYun] of result.daYun.entries()) {
        const liuNianIndex = daYun.liuNian.findIndex((item) => item.year === year);
        if (liuNianIndex !== -1) {
            const liuNian = daYun.liuNian[liuNianIndex];
            const switchesThisYear = position > 0 && new Date(daYun.jiaoYunDateTimeIso).getFullYear() === year;
            return {
                year, ganZhi: liuNian.ganZhi, age: liuNian.age, daYunGanZhi: daYun.ganZhi || undefined, daYunIndex: daYun.index, liuNianIndex,
                ...(switchesThisYear ? { previousDaYunGanZhi: result.daYun[position - 1].ganZhi } : {}),
            };
        }
    }
    const xiaoYun = result.xiaoYun.find((item) => item.year === year);
    return xiaoYun ? { year, ganZhi: xiaoYun.ganZhi, age: xiaoYun.age, daYunIndex: -1, liuNianIndex: -1 } : null;
}

/** 五行占比 for 原局 + that year's 大运 and 流年 (no 流月). */
export function getBaziYearEnergy(result: Readonly<BaziResult>, year: number): BaziWuXingEnergySnapshot | null {
    const info = getBaziYearInfo(result, year);
    if (!info || info.daYunIndex < 0) return null;
    const daYunPosition = result.daYun.findIndex((item) => item.index === info.daYunIndex);
    try {
        return buildBaziWuXingEnergy(result, {
            mode: 'dayun', selectedDaYunIndex: daYunPosition, selectedXiaoYunIndex: -1,
            selectedLiuNianIndex: info.liuNianIndex, selectedLiuYueIndex: -1,
        });
    } catch {
        return null;
    }
}

/** 原局五行：只计四柱、藏干与宫位，不带任何岁运（缺省的岁运来源记在 omittedSources）。 */
export function getBaziNatalEnergy(result: Readonly<BaziResult>): BaziWuXingEnergySnapshot | null {
    try {
        return buildBaziWuXingEnergy(result, {
            mode: 'dayun', selectedDaYunIndex: -1, selectedXiaoYunIndex: -1, selectedLiuNianIndex: -1, selectedLiuYueIndex: -1,
        });
    } catch {
        return null;
    }
}
