import { buildZiweiRouteParams } from './iztro-adapter';
import type { ZiweiComputedInput, ZiweiInputPayload } from './types';

export function buildZiweiResultRoute(params: {
    payload: ZiweiInputPayload;
    computed?: ZiweiComputedInput;
    recordId: string;
    recordCreatedAt?: string;
    routeDraft?: boolean;
}) {
    return {
        pathname: '/ziwei/result' as const,
        params: {
            ...buildZiweiRouteParams(params.payload, params.computed),
            recordId: params.recordId,
            recordCreatedAt: params.recordCreatedAt,
            routeDraft: params.routeDraft ? '1' : undefined,
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
