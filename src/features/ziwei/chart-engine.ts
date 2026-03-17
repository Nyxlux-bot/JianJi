import {
    buildZiweiBoardDecorations,
    buildZiweiBoardScopeModel,
    buildZiweiDirectHoroscopeScopeViewByScope,
    buildZiweiOrbitDrawerState,
} from './view-model';
import {
    buildZiweiStaticCacheKey,
    computeZiweiDynamicHoroscope,
    loadZiweiStaticChartAsync,
} from './iztro-adapter';
import { measureZiweiAsyncPerf } from './perf';
import type {
    ZiweiActiveScope,
    ZiweiBoardDecorationModel,
    ZiweiBoardScopeModel,
    ZiweiDynamicHoroscopeResult,
    ZiweiDirectHoroscopeScopeView,
    ZiweiInputPayload,
    ZiweiOrbitDrawerState,
    ZiweiStaticChartResult,
} from './types';

interface IdleDeadlineLike {
    didTimeout: boolean;
    timeRemaining: () => number;
}

type IdleTaskHandle = number | ReturnType<typeof setTimeout>;

const ZIWEI_DYNAMIC_CACHE_LIMIT = 36;
const ZIWEI_CURSOR_BUNDLE_CACHE_LIMIT = 24;
const ZIWEI_ACTIVE_SCOPES: ZiweiActiveScope[] = ['decadal', 'age', 'yearly', 'monthly', 'daily', 'hourly'];

const dynamicSnapshotCache = new Map<string, ZiweiDynamicHoroscopeResult>();
const dynamicSnapshotInFlight = new Map<string, Promise<ZiweiDynamicHoroscopeResult>>();
const cursorBundleCache = new Map<string, ZiweiCursorBundle>();
const cursorBundleInFlight = new Map<string, Promise<ZiweiCursorBundle>>();

function trimCache<T>(cache: Map<string, T>, limit: number): void {
    if (cache.size <= limit) {
        return;
    }

    const oldestKey = cache.keys().next().value;
    if (oldestKey) {
        cache.delete(oldestKey);
    }
}

function scheduleIdleTask(
    task: (deadline: IdleDeadlineLike) => void,
    timeoutMs: number = 120,
): { cancel: () => void } {
    const idleGlobal = globalThis as typeof globalThis & {
        requestIdleCallback?: (cb: (deadline: IdleDeadlineLike) => void, options?: { timeout: number }) => IdleTaskHandle;
        cancelIdleCallback?: (handle: IdleTaskHandle) => void;
    };
    const idleScheduler = idleGlobal.requestIdleCallback;
    const idleCanceller = idleGlobal.cancelIdleCallback;

    if (typeof idleScheduler === 'function') {
        const handle = idleScheduler(task, { timeout: timeoutMs });
        return {
            cancel: () => {
                if (typeof idleCanceller === 'function') {
                    idleCanceller(handle);
                }
            },
        };
    }

    const handle = setTimeout(() => {
        task({
            didTimeout: true,
            timeRemaining: () => 0,
        });
    }, Math.min(timeoutMs, 32));

    return {
        cancel: () => {
            clearTimeout(handle);
        },
    };
}

function runIdleTask<T>(
    task: () => T,
    timeoutMs?: number,
): Promise<T> {
    return new Promise((resolve, reject) => {
        let settled = false;
        const scheduled = scheduleIdleTask(() => {
            if (settled) {
                return;
            }

            settled = true;
            try {
                resolve(task());
            } catch (error) {
                reject(error);
            }
        }, timeoutMs);

        void scheduled;
    });
}

function buildDynamicSnapshotKey(staticChart: ZiweiStaticChartResult, cursorDate: Date): string {
    return `${staticChart.cacheKey}|${cursorDate.getTime()}`;
}

function buildCursorBundleKey(staticChart: ZiweiStaticChartResult, cursorDate: Date): string {
    return buildDynamicSnapshotKey(staticChart, cursorDate);
}

async function resolveCachedAsync<T>(params: {
    cache: Map<string, T>;
    inFlight: Map<string, Promise<T>>;
    cacheKey: string;
    cacheLimit: number;
    factory: () => Promise<T>;
}): Promise<T> {
    const cached = params.cache.get(params.cacheKey);
    if (cached) {
        return cached;
    }

    const pending = params.inFlight.get(params.cacheKey);
    if (pending) {
        return pending;
    }

    const nextPromise = params.factory()
        .then((result) => {
            params.cache.set(params.cacheKey, result);
            trimCache(params.cache, params.cacheLimit);
            params.inFlight.delete(params.cacheKey);
            return result;
        })
        .catch((error) => {
            params.inFlight.delete(params.cacheKey);
            throw error;
        });
    params.inFlight.set(params.cacheKey, nextPromise);
    return nextPromise;
}

export interface ZiweiCursorBundle {
    cacheKey: string;
    dynamic: ZiweiDynamicHoroscopeResult;
    byScopeBoardScopeModel: Record<ZiweiActiveScope, ZiweiBoardScopeModel>;
    byScopeBoardDecorations: Record<ZiweiActiveScope, ZiweiBoardDecorationModel>;
    byScopeOrbitDrawerState: Record<ZiweiActiveScope, ZiweiOrbitDrawerState>;
    byScopeSelectedDirectScope: Record<ZiweiActiveScope, ZiweiDirectHoroscopeScopeView | null>;
}

async function prepareDynamicSnapshot(
    staticChart: ZiweiStaticChartResult,
    cursorDate: Date,
): Promise<ZiweiDynamicHoroscopeResult> {
    const cacheKey = buildDynamicSnapshotKey(staticChart, cursorDate);

    return resolveCachedAsync({
        cache: dynamicSnapshotCache,
        inFlight: dynamicSnapshotInFlight,
        cacheKey,
        cacheLimit: ZIWEI_DYNAMIC_CACHE_LIMIT,
        factory: () => measureZiweiAsyncPerf(
            'prepareDynamicSnapshot',
            () => runIdleTask(
                () => computeZiweiDynamicHoroscope(staticChart, cursorDate),
                120,
            ),
        ),
    });
}

export const ZiweiChartEngine = {
    async prepareStaticChart(payload: ZiweiInputPayload): Promise<ZiweiStaticChartResult> {
        return loadZiweiStaticChartAsync(payload);
    },

    async prewarmStaticChart(payload: ZiweiInputPayload): Promise<ZiweiStaticChartResult> {
        return runIdleTask(() => loadZiweiStaticChartAsync(payload), 180).then((result) => result);
    },

    async prepareCursorBundle(
        staticChart: ZiweiStaticChartResult,
        cursorDate: Date,
    ): Promise<ZiweiCursorBundle> {
        const cacheKey = buildCursorBundleKey(staticChart, cursorDate);

        return resolveCachedAsync({
            cache: cursorBundleCache,
            inFlight: cursorBundleInFlight,
            cacheKey,
            cacheLimit: ZIWEI_CURSOR_BUNDLE_CACHE_LIMIT,
            factory: async () => {
                const dynamic = await prepareDynamicSnapshot(staticChart, cursorDate);

                return measureZiweiAsyncPerf('prepareCursorBundle', () => runIdleTask(() => {
                    const byScopeSelectedDirectScope = Object.fromEntries(ZIWEI_ACTIVE_SCOPES.map((scope) => {
                        const selectedDirectScope = scope === 'age'
                            ? null
                            : buildZiweiDirectHoroscopeScopeViewByScope(
                                staticChart.astrolabe,
                                dynamic.horoscopeNow,
                                scope,
                                staticChart.input.config.algorithm,
                            );
                        return [scope, selectedDirectScope];
                    })) as Record<ZiweiActiveScope, ZiweiDirectHoroscopeScopeView | null>;

                    const byScopeBoardScopeModel = Object.fromEntries(ZIWEI_ACTIVE_SCOPES.map((scope) => [
                        scope,
                        buildZiweiBoardScopeModel(
                            staticChart,
                            dynamic,
                            scope,
                            byScopeSelectedDirectScope[scope],
                        ),
                    ])) as Record<ZiweiActiveScope, ZiweiBoardScopeModel>;

                    const byScopeBoardDecorations = Object.fromEntries(ZIWEI_ACTIVE_SCOPES.map((scope) => [
                        scope,
                        buildZiweiBoardDecorations(
                            staticChart,
                            dynamic,
                            scope,
                            computeZiweiDynamicHoroscope,
                        ),
                    ])) as Record<ZiweiActiveScope, ZiweiBoardDecorationModel>;

                    const byScopeOrbitDrawerState = Object.fromEntries(ZIWEI_ACTIVE_SCOPES.map((scope) => [
                        scope,
                        buildZiweiOrbitDrawerState(
                            staticChart,
                            dynamic,
                            scope,
                        ),
                    ])) as Record<ZiweiActiveScope, ZiweiOrbitDrawerState>;

                    return {
                        cacheKey,
                        dynamic,
                        byScopeBoardScopeModel,
                        byScopeBoardDecorations,
                        byScopeOrbitDrawerState,
                        byScopeSelectedDirectScope,
                    };
                }, 120));
            },
        });
    },
};

export function buildZiweiStaticWarmupKey(payload: ZiweiInputPayload): string {
    return buildZiweiStaticCacheKey(payload);
}
