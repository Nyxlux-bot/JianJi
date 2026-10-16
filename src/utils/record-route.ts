import type { DivinationEngine } from '../db/record-types';
import { buildZiweiHistoryRestoreRoute } from '../features/ziwei/result-route';

/** 记录详情页路由：历史页与首页「最近」共用。 */
export function getRecordRoute(engineType: DivinationEngine, id: string) {
    if (engineType === 'bazi') return `/bazi/result/${id}`;
    if (engineType === 'baziCompatibility') return `/bazi/match/result/${id}`;
    if (engineType === 'ziwei') return buildZiweiHistoryRestoreRoute(id);
    if (engineType === 'meihua') return `/meihua/result/${id}`;
    return `/result/${id}`;
}
