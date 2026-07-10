import {
    buildZiweiBoardDecorations,
    buildZiweiBoardScopeModel,
    buildZiweiDirectHoroscopeScopeViewByScope,
    buildZiweiOrbitDrawerState,
} from './view-model';
import {
    computeZiweiDynamicHoroscope,
    loadZiweiStaticChartAsync,
    normalizeZiweiHoroscopeCursorDate,
} from './iztro-adapter';
import { measureZiweiAsyncPerf, measureZiweiPerf } from './perf';
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

const ZIWEI_RUNTIME_SET_CACHE_LIMIT = 128;
const ZIWEI_RUNTIME_BUNDLE_CACHE_LIMIT = 256;
const runtimeBundleCache = new Map<string, ZiweiRuntimeBundle>();
const runtimeSetCache = new Map<string, ZiweiRuntimeSet>();
const runtimeSetInFlight = new Map<string, Promise<ZiweiRuntimeSet>>();

function trimCache<T>(cache: Map<string, T>, limit: number): void {
    if (cache.size <= limit) {
        return;
    }

    const oldestKey = cache.keys().next().value;
    if (oldestKey) {
        cache.delete(oldestKey);
    }
}

function getLruValue<T>(cache: Map<string, T>, key: string): T | undefined {
    const value = cache.get(key);
    if (value === undefined) {
        return undefined;
    }

    cache.delete(key);
    cache.set(key, value);
    return value;
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

function buildRuntimeBundleKey(staticChart: ZiweiStaticChartResult, cursorDate: Date, scope: ZiweiActiveScope): string {
    const normalizedCursorDate = normalizeZiweiHoroscopeCursorDate(cursorDate);
    const hourKey = [
        normalizedCursorDate.getFullYear(),
        normalizedCursorDate.getMonth() + 1,
        normalizedCursorDate.getDate(),
        normalizedCursorDate.getHours(),
    ].join('-');

    return `${staticChart.cacheKey}|${hourKey}|${scope}`;
}

function buildRuntimeSetKey(staticChart: ZiweiStaticChartResult, cursorDate: Date): string {
    const normalizedCursorDate = normalizeZiweiHoroscopeCursorDate(cursorDate);
    const hourKey = [
        normalizedCursorDate.getFullYear(),
        normalizedCursorDate.getMonth() + 1,
        normalizedCursorDate.getDate(),
        normalizedCursorDate.getHours(),
    ].join('-');

    return `${staticChart.cacheKey}|${hourKey}`;
}

function rememberRuntimeBundle(bundle: ZiweiRuntimeBundle): ZiweiRuntimeBundle {
    runtimeBundleCache.delete(bundle.cacheKey);
    runtimeBundleCache.set(bundle.cacheKey, bundle);
    trimCache(runtimeBundleCache, ZIWEI_RUNTIME_BUNDLE_CACHE_LIMIT);
    return bundle;
}

async function resolveCachedAsync<T>(params: {
    cache: Map<string, T>;
    inFlight: Map<string, Promise<T>>;
    cacheKey: string;
    cacheLimit: number;
    factory: () => Promise<T>;
}): Promise<T> {
    const cached = getLruValue(params.cache, params.cacheKey);
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

export interface ZiweiRuntimeBundle {
    cacheKey: string;
    dynamic: ZiweiDynamicHoroscopeResult;
    scope: ZiweiActiveScope;
    boardScopeModel: ZiweiBoardScopeModel;
    boardDecorations: ZiweiBoardDecorationModel;
    orbitDrawerState: ZiweiOrbitDrawerState;
    selectedDirectScope: ZiweiDirectHoroscopeScopeView | null;
}

export interface ZiweiRuntimeSet {
    cacheKey: string;
    cursorDate: Date;
    dynamic: ZiweiDynamicHoroscopeResult;
    bundles: Partial<Record<ZiweiActiveScope, ZiweiRuntimeBundle>>;
}

export interface ZiweiPreparedChart {
    staticChart: ZiweiStaticChartResult;
    initialBundle: ZiweiRuntimeBundle;
}

export interface ZiweiRuntimePrewarmRequest {
    cursorDate: Date;
    scope: ZiweiActiveScope;
}

export interface ZiweiRuntimePrewarmHandle {
    cancel: () => void;
}

function buildRuntimeBundle(
    staticChart: ZiweiStaticChartResult,
    dynamic: ZiweiDynamicHoroscopeResult,
    scope: ZiweiActiveScope,
): ZiweiRuntimeBundle {
    return measureZiweiPerf(`buildRuntimeBundle:${scope}`, () => {
        const selectedDirectScope = measureZiweiPerf(`buildDirectScope:${scope}`, () => (
            scope === 'age'
                ? null
                : buildZiweiDirectHoroscopeScopeViewByScope(
                    staticChart.astrolabe,
                    dynamic.horoscopeNow,
                    scope,
                    staticChart.input.config.algorithm,
                )
        ));
        const boardScopeModel = measureZiweiPerf(`buildBoardScope:${scope}`, () => (
            buildZiweiBoardScopeModel(
                staticChart,
                dynamic,
                scope,
                selectedDirectScope,
            )
        ));
        const boardDecorations = measureZiweiPerf(`buildBoardDecorations:${scope}`, () => (
            buildZiweiBoardDecorations(
                staticChart,
                dynamic,
                scope,
                computeZiweiDynamicHoroscope,
            )
        ));
        const orbitDrawerState = measureZiweiPerf(`buildOrbitDrawer:${scope}`, () => (
            buildZiweiOrbitDrawerState(
                staticChart,
                dynamic,
                scope,
            )
        ));

        return {
            cacheKey: buildRuntimeBundleKey(staticChart, dynamic.cursorDate, scope),
            dynamic,
            scope,
            boardScopeModel,
            boardDecorations,
            orbitDrawerState,
            selectedDirectScope,
        };
    });
}

function buildRuntimeSet(
    staticChart: ZiweiStaticChartResult,
    dynamic: ZiweiDynamicHoroscopeResult,
    requestedScope: ZiweiActiveScope = 'yearly',
): ZiweiRuntimeSet {
    return measureZiweiPerf('buildRuntimeSet', () => {
        const requestedBundle = buildRuntimeBundle(staticChart, dynamic, requestedScope);
        rememberRuntimeBundle(requestedBundle);

        const runtimeSet: ZiweiRuntimeSet = {
            cacheKey: buildRuntimeSetKey(staticChart, dynamic.cursorDate),
            cursorDate: dynamic.cursorDate,
            dynamic,
            bundles: {
                [requestedScope]: requestedBundle,
            },
        };

        return runtimeSet;
    });
}

function ensureRuntimeBundle(
    staticChart: ZiweiStaticChartResult,
    runtimeSet: ZiweiRuntimeSet,
    scope: ZiweiActiveScope,
): ZiweiRuntimeBundle {
    const runtimeSetBundle = runtimeSet.bundles[scope];
    if (runtimeSetBundle) {
        rememberRuntimeBundle(runtimeSetBundle);
        return runtimeSetBundle;
    }

    const existing = getLruValue(runtimeBundleCache, buildRuntimeBundleKey(staticChart, runtimeSet.cursorDate, scope));
    if (existing) {
        runtimeSet.bundles[scope] = existing;
        return existing;
    }

    const bundle = rememberRuntimeBundle(buildRuntimeBundle(staticChart, runtimeSet.dynamic, scope));
    runtimeSet.bundles[scope] = bundle;
    return bundle;
}

export const ZiweiChartEngine = {
    async prepareStaticChart(payload: ZiweiInputPayload): Promise<ZiweiStaticChartResult> {
        return measureZiweiAsyncPerf('prepareStaticChart', () => loadZiweiStaticChartAsync(payload));
    },

    async prepareRuntimeBundle(
        staticChart: ZiweiStaticChartResult,
        cursorDate: Date,
        scope: ZiweiActiveScope,
    ): Promise<ZiweiRuntimeBundle> {
        const runtimeSet = await ZiweiChartEngine.prepareRuntimeSet(staticChart, cursorDate, scope);
        return ensureRuntimeBundle(staticChart, runtimeSet, scope);
    },

    async prepareRuntimeSet(
        staticChart: ZiweiStaticChartResult,
        cursorDate: Date,
        requestedScope: ZiweiActiveScope = 'yearly',
    ): Promise<ZiweiRuntimeSet> {
        const normalizedCursorDate = normalizeZiweiHoroscopeCursorDate(cursorDate);
        const cacheKey = buildRuntimeSetKey(staticChart, normalizedCursorDate);

        const runtimeSet = await resolveCachedAsync({
            cache: runtimeSetCache,
            inFlight: runtimeSetInFlight,
            cacheKey,
            cacheLimit: ZIWEI_RUNTIME_SET_CACHE_LIMIT,
            factory: () => measureZiweiAsyncPerf('prepareRuntimeSet', async () => {
                const dynamic = measureZiweiPerf('computeDynamicHoroscope', () => (
                    computeZiweiDynamicHoroscope(staticChart, normalizedCursorDate)
                ));
                return buildRuntimeSet(staticChart, dynamic, requestedScope);
            }),
        });
        ensureRuntimeBundle(staticChart, runtimeSet, requestedScope);
        return runtimeSet;
    },

    getRuntimeBundle(
        staticChart: ZiweiStaticChartResult,
        cursorDate: Date,
        scope: ZiweiActiveScope,
    ): ZiweiRuntimeBundle | null {
        return getLruValue(runtimeBundleCache, buildRuntimeBundleKey(staticChart, cursorDate, scope)) || null;
    },

    async preparePreparedChart(
        payload: ZiweiInputPayload,
        cursorDate: Date,
        activeScope: ZiweiActiveScope = 'yearly',
    ): Promise<ZiweiPreparedChart> {
        const staticChart = await ZiweiChartEngine.prepareStaticChart(payload);
        const initialBundle = await ZiweiChartEngine.prepareRuntimeBundle(staticChart, cursorDate, activeScope);

        return {
            staticChart,
            initialBundle,
        };
    },

    prewarmRuntimeSets(
        staticChart: ZiweiStaticChartResult,
        requests: ZiweiRuntimePrewarmRequest[],
    ): ZiweiRuntimePrewarmHandle {
        const uniqueRequests = Array.from(new Map(requests.map((request) => [
            buildRuntimeBundleKey(staticChart, request.cursorDate, request.scope),
            request,
        ])).values());

        let index = 0;
        let cancelled = false;
        let scheduled: { cancel: () => void } | null = null;
        const schedulePump = () => {
            if (cancelled) {
                return;
            }
            scheduled = scheduleIdleTask(() => {
                scheduled = null;
                pump();
            }, 120);
        };
        const pump = () => {
            if (cancelled) {
                return;
            }

            const request = uniqueRequests[index];
            index += 1;
            if (!request) {
                return;
            }

            void ZiweiChartEngine.prepareRuntimeBundle(staticChart, request.cursorDate, request.scope)
                .catch((error: unknown) => {
                    if (typeof globalThis !== 'undefined'
                        && '__DEV__' in globalThis
                        && Boolean((globalThis as typeof globalThis & { __DEV__?: boolean }).__DEV__)) {
                        const message = error instanceof Error ? error.message : String(error);
                        console.warn('[ziwei][prewarmRuntimeSets]', request.scope, request.cursorDate.toISOString(), message);
                    }
                })
                .finally(() => {
                    schedulePump();
                });
        };

        schedulePump();
        return {
            cancel: () => {
                cancelled = true;
                scheduled?.cancel();
                scheduled = null;
            },
        };
    },
};
