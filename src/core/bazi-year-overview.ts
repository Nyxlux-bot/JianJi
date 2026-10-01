import type { BaziResult } from './bazi-types';
import { buildBaziWuXingEnergy, type BaziWuXingEnergySnapshot } from './bazi-wuxing-energy';

export interface BaziYearInfo {
    year: number;
    ganZhi: string;
    age: number;
    /** 大运干支; undefined before the first 大运 (小运 period). */
    daYunGanZhi?: string;
    daYunIndex: number;
    liuNianIndex: number;
}

/** App-side facts for one year, so headings the model writes never decide what is shown. */
export function getBaziYearInfo(result: Readonly<BaziResult>, year: number): BaziYearInfo | null {
    for (const daYun of result.daYun) {
        const liuNianIndex = daYun.liuNian.findIndex((item) => item.year === year);
        if (liuNianIndex !== -1) {
            const liuNian = daYun.liuNian[liuNianIndex];
            return { year, ganZhi: liuNian.ganZhi, age: liuNian.age, daYunGanZhi: daYun.ganZhi || undefined, daYunIndex: daYun.index, liuNianIndex };
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
