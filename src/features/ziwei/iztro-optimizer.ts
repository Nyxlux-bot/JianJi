/**
 * iztro 性能优化层
 *
 * 这个文件提供 iztro 热路径函数的优化版本。
 * 必须在任何 iztro 调用之前 import 并调用 patchIztroKot()。
 */

import * as iztroI18n from 'iztro/lib/i18n';
import enUS from 'iztro/lib/i18n/locales/en-US';
import jaJP from 'iztro/lib/i18n/locales/ja-JP';
import koKR from 'iztro/lib/i18n/locales/ko-KR';
import zhCN from 'iztro/lib/i18n/locales/zh-CN';
import zhTW from 'iztro/lib/i18n/locales/zh-TW';
import viVN from 'iztro/lib/i18n/locales/vi-VN';
import { star } from 'iztro';
import type { IFunctionalStar } from 'iztro/lib/star/FunctionalStar';

// ============================================================================
// 1. kot() 优化 - 最大的性能杀手
// ============================================================================

/**
 * iztro 的 kot() 是 O(n²) 循环查表，每次调用都遍历 6 种语言 × 数百个 key。
 * 用 Map 缓存后变成 O(1) 查询。
 *
 * 预期收益：prepareStaticChart 从 3311ms → 1500-2000ms（~50% 提升）
 *
 * 在模块初始化时建立六种语言的反向索引，首次查询也不再遍历全部翻译。
 * 使用方法：在 iztro-adapter.ts 顶部调用 patchIztroKot()。
 */
const kotCache = new Map<string, string>();
const translationKeysByValue = new Map<string, string[]>();

[enUS, jaJP, koKR, zhCN, zhTW, viVN].forEach((translations) => {
    Object.entries(translations).forEach(([translationKey, translationValue]) => {
        if (typeof translationValue !== 'string') {
            return;
        }

        const keys = translationKeysByValue.get(translationValue);
        if (keys) {
            keys.push(translationKey);
        } else {
            translationKeysByValue.set(translationValue, [translationKey]);
        }
    });
});

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

    const translationKeys = translationKeysByValue.get(value);
    const result = k
        ? translationKeys?.find((translationKey) => translationKey.includes(k)) || value
        : translationKeys?.[0] || value;
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
