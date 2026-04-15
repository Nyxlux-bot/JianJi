import {
    buildZiweiBoardDecorations,
    buildZiweiBoardScopeModel,
    buildZiweiDirectHoroscopeScopeViewByScope,
    buildZiweiOrbitDrawerState,
} from './view-model';
import {
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

const ZIWEI_RUNTIME_BUNDLE_CACHE_LIMIT = 72;
const runtimeBundleCache = new Map<string, ZiweiRuntimeBundle>();
const runtimeBundleInFlight = new Map<string, Promise<ZiweiRuntimeBundle>>();

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

function buildRuntimeBundleKey(staticChart: ZiweiStaticChartResult, cursorDate: Date, scope: ZiweiActiveScope): string {
    const hourKey = [
        cursorDate.getFullYear(),
        cursorDate.getMonth() + 1,
        cursorDate.getDate(),
        cursorDate.getHours(),
    ].join('-');

    return `${staticChart.cacheKey}|${hourKey}|${scope}`;
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

export interface ZiweiRuntimeBundle {
    cacheKey: string;
    dynamic: ZiweiDynamicHoroscopeResult;
    scope: ZiweiActiveScope;
    boardScopeModel: ZiweiBoardScopeModel;
    boardDecorations: ZiweiBoardDecorationModel;
    orbitDrawerState: ZiweiOrbitDrawerState;
    selectedDirectScope: ZiweiDirectHoroscopeScopeView | null;
}

function buildRuntimeBundle(
    staticChart: ZiweiStaticChartResult,
    dynamic: ZiweiDynamicHoroscopeResult,
    scope: ZiweiActiveScope,
): ZiweiRuntimeBundle {
    const selectedDirectScope = scope === 'age'
        ? null
        : buildZiweiDirectHoroscopeScopeViewByScope(
            staticChart.astrolabe,
            dynamic.horoscopeNow,
            scope,
            staticChart.input.config.algorithm,
        );

    return {
        cacheKey: buildRuntimeBundleKey(staticChart, dynamic.cursorDate, scope),
        dynamic,
        scope,
        boardScopeModel: buildZiweiBoardScopeModel(
            staticChart,
            dynamic,
            scope,
            selectedDirectScope,
        ),
        boardDecorations: buildZiweiBoardDecorations(
            staticChart,
            dynamic,
            scope,
            computeZiweiDynamicHoroscope,
        ),
        orbitDrawerState: buildZiweiOrbitDrawerState(
            staticChart,
            dynamic,
            scope,
        ),
        selectedDirectScope,
    };
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
        const cacheKey = buildRuntimeBundleKey(staticChart, cursorDate, scope);

        return resolveCachedAsync({
            cache: runtimeBundleCache,
            inFlight: runtimeBundleInFlight,
            cacheKey,
            cacheLimit: ZIWEI_RUNTIME_BUNDLE_CACHE_LIMIT,
            factory: () => measureZiweiAsyncPerf('prepareRuntimeBundle', async () => {
                const dynamic = await runIdleTask(
                    () => computeZiweiDynamicHoroscope(staticChart, cursorDate),
                    120,
                );
                return runIdleTask(() => buildRuntimeBundle(staticChart, dynamic, scope), 120);
            }),
        });
    },
};
