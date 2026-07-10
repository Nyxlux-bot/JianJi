import {
    buildZiweiStaticCacheKey,
    normalizeZiweiHoroscopeCursorDate,
} from './iztro-adapter';
import {
    ZiweiChartEngine,
    type ZiweiPreparedChart,
} from './chart-engine';
import type {
    ZiweiActiveScope,
    ZiweiInputPayload,
} from './types';

const ZIWEI_PREPARED_CHART_CACHE_LIMIT = 8;
const preparedCharts = new Map<string, ZiweiPreparedChart>();
const inFlightCharts = new Map<string, Promise<ZiweiPreparedChart>>();

function getPreparedChart(key: string): ZiweiPreparedChart | undefined {
    const prepared = preparedCharts.get(key);
    if (!prepared) {
        return undefined;
    }

    preparedCharts.delete(key);
    preparedCharts.set(key, prepared);
    return prepared;
}

function buildPrepareKey(
    payload: ZiweiInputPayload,
    cursorDate: Date,
    activeScope: ZiweiActiveScope,
): string {
    const normalizedCursorDate = normalizeZiweiHoroscopeCursorDate(cursorDate);

    return [
        buildZiweiStaticCacheKey(payload),
        payload.name?.trim() || '',
        payload.cityLabel?.trim() || '',
        normalizedCursorDate.getFullYear(),
        normalizedCursorDate.getMonth() + 1,
        normalizedCursorDate.getDate(),
        normalizedCursorDate.getHours(),
        activeScope,
    ].join('|');
}

function trimPreparedCharts(): void {
    if (preparedCharts.size <= ZIWEI_PREPARED_CHART_CACHE_LIMIT) {
        return;
    }

    const oldestKey = preparedCharts.keys().next().value;
    if (oldestKey) {
        preparedCharts.delete(oldestKey);
    }
}

function getOrCreatePreparedChart(
    payload: ZiweiInputPayload,
    cursorDate: Date,
    activeScope: ZiweiActiveScope,
): Promise<ZiweiPreparedChart> {
    const key = buildPrepareKey(payload, cursorDate, activeScope);
    const prepared = getPreparedChart(key);

    if (prepared) {
        return Promise.resolve(prepared);
    }

    const inFlight = inFlightCharts.get(key);
    if (inFlight) {
        return inFlight;
    }

    const next = ZiweiChartEngine.preparePreparedChart(payload, cursorDate, activeScope)
        .then((preparedChart) => {
            preparedCharts.delete(key);
            preparedCharts.set(key, preparedChart);
            trimPreparedCharts();
            inFlightCharts.delete(key);
            return preparedChart;
        })
        .catch((error) => {
            inFlightCharts.delete(key);
            throw error;
        });

    inFlightCharts.set(key, next);
    return next;
}

export const ZiweiPrepareStore = {
    prewarm(payload: ZiweiInputPayload, cursorDate: Date = new Date()): void {
        void getOrCreatePreparedChart(payload, cursorDate, 'yearly').catch(() => {
            // 后台准备失败时，不阻断输入页；点击“开始排盘”会走同一条准备链路并抛出真实错误。
        });
    },

    prepareForNavigation(
        payload: ZiweiInputPayload,
        cursorDate: Date = new Date(),
        activeScope: ZiweiActiveScope = 'yearly',
    ): Promise<ZiweiPreparedChart> {
        return getOrCreatePreparedChart(payload, cursorDate, activeScope);
    },
};
