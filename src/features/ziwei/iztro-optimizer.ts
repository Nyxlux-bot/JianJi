/**
 * iztro 性能优化层
 *
 * 这个文件提供 iztro 热路径函数的优化版本。
 * 必须在任何 iztro 调用之前 import 并调用 patchIztroKot()。
 */

import * as iztroI18n from 'iztro/lib/i18n';
import { star } from 'iztro';
import type { IFunctionalStar } from 'iztro/lib/star/FunctionalStar';

// ============================================================================
// 1. kot() 优化 - 最大的性能杀手
// ============================================================================

/**
 * 缓存上游 kot() 的返回值，避免重复遍历翻译表。
 * 首次查询仍交给上游处理，保留星曜别名及后续版本的查询语义。
 * 使用方法：在 iztro-adapter.ts 顶部调用 patchIztroKot()。
 */
const originalKot = iztroI18n.kot;
const kotCache = new Map<string, string>();

let kotPatched = false;

function optimizedKot(value: string, k?: string): string {
    if (!value) {
        return value;
    }

    const cacheKey = k ? `${value}|${k}` : value;
    const cached = kotCache.get(cacheKey);
    if (cached !== undefined) {
        return cached;
    }

    const result = originalKot<string>(value, k);
    kotCache.set(cacheKey, result);
    return result;
}

/**
 * 将 iztro 的 kot() 替换为带缓存的优化版本。
 * 幂等：多次调用只会 patch 一次。
 */
export function patchIztroKot(): void {
    if (kotPatched) {
        return;
    }

    (iztroI18n as any).kot = optimizedKot;
    kotPatched = true;

    // 开发环境日志
    if (getDevFlag()) {
        console.info('[iztro-optimizer] ✓ kot() patched with cache layer');
    }
}

// ============================================================================
// 2. star.getHoroscopeStar() 全局缓存
// ============================================================================

/**
 * star.getHoroscopeStar() 的结果完全由 (天干, 地支, scope) 三元组决定。
 * 总共只有 10 × 12 × 5 = 600 种组合，可以全局缓存。
 *
 * 预期收益：每个 scope bundle 构建时间 -20%
 */
const horoscopeStarCache = new Map<string, IFunctionalStar[][]>();

export function getCachedHoroscopeStar(
    heavenlyStem: string,
    earthlyBranch: string,
    scope: 'decadal' | 'yearly' | 'monthly' | 'daily' | 'hourly',
): IFunctionalStar[][] {
    const key = `${heavenlyStem}|${earthlyBranch}|${scope}`;
    const cached = horoscopeStarCache.get(key);
    if (cached !== undefined) {
        return cached;
    }

    const result = star.getHoroscopeStar(
        heavenlyStem as any,
        earthlyBranch as any,
        scope,
    );
    horoscopeStarCache.set(key, result);
    return result;
}

// ============================================================================
// 3. 缓存统计（开发环境）
// ============================================================================

function getDevFlag(): boolean {
    return typeof globalThis !== 'undefined'
        && '__DEV__' in globalThis
        ? Boolean((globalThis as typeof globalThis & { __DEV__?: boolean }).__DEV__)
        : false;
}

export function logIztroOptimizerStats(): void {
    if (!getDevFlag()) {
        return;
    }

    console.info('[iztro-optimizer] kot cache size:', kotCache.size);
    console.info('[iztro-optimizer] horoscope star cache size:', horoscopeStarCache.size);
}
