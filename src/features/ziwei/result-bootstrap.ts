import { toZiweiInputPayload } from './record';
import type { ZiweiRouteParseResult, ZiweiChartSnapshotV1, ZiweiInputPayload } from './types';
import type { ZiweiRecordResult } from './record';

type BootstrapRecordDetail =
    | { engineType: 'liuyao'; isFavorite: boolean }
    | { engineType: 'bazi'; isFavorite: boolean }
    | { engineType: 'ziwei'; result: ZiweiRecordResult; isFavorite: boolean };

export type ZiweiResultBootstrapPlan =
    | { kind: 'load-record' }
    | { kind: 'error'; message: string }
    | { kind: 'redirect'; pathname: string }
    | {
        kind: 'live';
        source: 'route' | 'history_snapshot' | 'history_legacy';
        payload: ZiweiInputPayload;
        snapshot: ZiweiChartSnapshotV1 | null;
        recordResult: ZiweiRecordResult | null;
        isFavorite: boolean;
    };

export function resolveZiweiResultBootstrapPlan(params: {
    parsed: ZiweiRouteParseResult;
    recordId?: string;
    recordDetail?: BootstrapRecordDetail | null;
}): ZiweiResultBootstrapPlan {
    const { parsed, recordId, recordDetail } = params;

    if (parsed.ok) {
        return {
            kind: 'live',
            source: 'route',
            payload: parsed.value,
            snapshot: null,
            recordResult: recordDetail?.engineType === 'ziwei' ? recordDetail.result : null,
            isFavorite: recordDetail?.isFavorite || false,
        };
    }

    if (!recordId) {
        return {
            kind: 'error',
            message: parsed.message,
        };
    }

    if (typeof recordDetail === 'undefined') {
        return {
            kind: 'load-record',
        };
    }

    if (recordDetail === null) {
        return {
            kind: 'error',
            message: '记录不存在或已被删除。',
        };
    }

    if (recordDetail.engineType !== 'ziwei') {
        return {
            kind: 'redirect',
            pathname: recordDetail.engineType === 'bazi' ? `/bazi/result/${recordId}` : `/result/${recordId}`,
        };
    }

    return {
        kind: 'live',
        source: recordDetail.result.chartSnapshot ? 'history_snapshot' : 'history_legacy',
        payload: toZiweiInputPayload(recordDetail.result),
        snapshot: recordDetail.result.chartSnapshot || null,
        recordResult: recordDetail.result,
        isFavorite: recordDetail.isFavorite,
    };
}
