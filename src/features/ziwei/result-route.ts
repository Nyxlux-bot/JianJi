import { buildZiweiRouteParams } from './iztro-adapter';
import type { ZiweiComputedInput, ZiweiInputPayload } from './types';

export function buildZiweiResultRoute(params: {
    payload: ZiweiInputPayload;
    computed?: ZiweiComputedInput;
    recordId: string;
}) {
    return {
        pathname: '/ziwei/result' as const,
        params: {
            ...buildZiweiRouteParams(params.payload, params.computed),
            recordId: params.recordId,
        },
    };
}

export function buildZiweiHistoryRestoreRoute(recordId: string) {
    return {
        pathname: '/ziwei/result' as const,
        params: {
            recordId,
        },
    };
}
