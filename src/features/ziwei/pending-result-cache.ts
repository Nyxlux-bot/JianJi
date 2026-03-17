import { DivinationRecordEnvelope } from '../../db/record-types';
import { ZiweiRecordResult } from './record';

export type PendingPersistStatus = 'saving' | 'saved' | 'error';

export interface PendingZiweiRecordEntry {
    result: ZiweiRecordResult;
    envelope: DivinationRecordEnvelope;
    isFavorite: boolean;
    status: PendingPersistStatus;
    errorMessage: string;
    persist: () => Promise<void>;
}

type PendingListener = () => void;

const pendingEntries = new Map<string, PendingZiweiRecordEntry>();
const pendingListeners = new Map<string, Set<PendingListener>>();

function notifyPendingListeners(id: string): void {
    pendingListeners.get(id)?.forEach((listener) => listener());
}

function setPendingEntry(id: string, entry: PendingZiweiRecordEntry): void {
    pendingEntries.set(id, entry);
    notifyPendingListeners(id);
}

async function runPersist(id: string): Promise<void> {
    const current = pendingEntries.get(id);
    if (!current) {
        return;
    }

    try {
        await current.persist();
        const latest = pendingEntries.get(id);
        if (!latest) {
            return;
        }
        setPendingEntry(id, {
            ...latest,
            status: 'saved',
            errorMessage: '',
        });
    } catch (error: unknown) {
        const latest = pendingEntries.get(id);
        if (!latest) {
            return;
        }
        setPendingEntry(id, {
            ...latest,
            status: 'error',
            errorMessage: error instanceof Error ? error.message : '保存失败',
        });
    }
}

export function primePendingZiweiRecord(input: {
    result: ZiweiRecordResult;
    envelope: DivinationRecordEnvelope;
    isFavorite?: boolean;
    persist: () => Promise<void>;
}): void {
    setPendingEntry(input.result.id, {
        result: input.result,
        envelope: input.envelope,
        isFavorite: input.isFavorite ?? false,
        status: 'saving',
        errorMessage: '',
        persist: input.persist,
    });
    void Promise.resolve().then(() => runPersist(input.result.id));
}

export function getPendingZiweiRecord(id: string): PendingZiweiRecordEntry | null {
    return pendingEntries.get(id) ?? null;
}

export function retryPendingZiweiPersist(id: string): void {
    const current = pendingEntries.get(id);
    if (!current) {
        return;
    }

    setPendingEntry(id, {
        ...current,
        status: 'saving',
        errorMessage: '',
    });
    void Promise.resolve().then(() => runPersist(id));
}

export function subscribePendingZiweiRecord(id: string, listener: PendingListener): () => void {
    const listeners = pendingListeners.get(id) ?? new Set<PendingListener>();
    listeners.add(listener);
    pendingListeners.set(id, listeners);

    return () => {
        const current = pendingListeners.get(id);
        if (!current) {
            return;
        }
        current.delete(listener);
        if (current.size === 0) {
            pendingListeners.delete(id);
        }
    };
}

export function clearPendingZiweiRecord(id: string): void {
    pendingEntries.delete(id);
    notifyPendingListeners(id);
}
