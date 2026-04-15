export function buildZiweiResultRoute(params: {
    recordId: string;
}) {
    return {
        pathname: '/ziwei/result' as const,
        params: {
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
