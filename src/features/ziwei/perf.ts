function getNow(): number {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
        return performance.now();
    }

    return Date.now();
}

const ZIWEI_PERF_LOG_THRESHOLD_MS = 3;

function logDuration(label: string, durationMs: number): void {
    const devFlag = typeof globalThis !== 'undefined'
        && '__DEV__' in globalThis
        ? Boolean((globalThis as typeof globalThis & { __DEV__?: boolean }).__DEV__)
        : false;

    if (!devFlag) {
        return;
    }

    if (durationMs < ZIWEI_PERF_LOG_THRESHOLD_MS) {
        return;
    }

    console.info(`[ziwei-perf] ${label} ${durationMs.toFixed(1)}ms`);
}

export function measureZiweiPerf<T>(label: string, work: () => T): T {
    const start = getNow();
    const result = work();
    logDuration(label, getNow() - start);
    return result;
}

export async function measureZiweiAsyncPerf<T>(label: string, work: () => Promise<T>): Promise<T> {
    const start = getNow();
    const result = await work();
    logDuration(label, getNow() - start);
    return result;
}
