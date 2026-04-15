import type { ZiweiRecordResult } from './record';
import type { ZiweiActiveScope, ZiweiStaticChartResult } from './types';
import type { ZiweiRuntimeBundle } from './chart-engine';

export interface ZiweiResultSession {
    record: ZiweiRecordResult;
    staticChart: ZiweiStaticChartResult;
    runtimeBundle: ZiweiRuntimeBundle;
    activeScope: ZiweiActiveScope;
    isFavorite: boolean;
}

const ziweiSessions = new Map<string, ZiweiResultSession>();

export function primeZiweiSession(recordId: string, session: ZiweiResultSession): void {
    ziweiSessions.set(recordId, session);
}

export function consumeZiweiSession(recordId: string): ZiweiResultSession | null {
    const session = ziweiSessions.get(recordId) || null;
    if (session) {
        ziweiSessions.delete(recordId);
    }
    return session;
}
