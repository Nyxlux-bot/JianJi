import type { BaziResult } from './bazi-types';

/** 查看岁运和请求日期不属于出生盘身份，不应使六亲反馈失效。 */
export function getBaziBirthSignature(result: BaziResult): string {
    return JSON.stringify({
        fourPillars: result.fourPillars,
        gender: result.gender,
        solarDate: result.solarDate,
        solarTime: result.solarTime,
        chartTime: result.timeMeta.trueSolarDateTimeLocal ?? result.timeMeta.trueSolarDateTimeIso,
        longitude: result.longitude,
        place: result.baseInfo.birthPlaceDisplay,
        options: result.schoolOptionsResolved,
    });
}
