import { BaziResult } from '../../core/bazi-types';
import { DivinationRecordEnvelope } from '../../db/record-types';

export type PendingPersistStatus = 'saving' | 'saved' | 'error';

export interface PendingBaziRecordEntry {
    result: BaziResult;
    envelope: DivinationRecordEnvelope;
    isFavorite: boolean;
    status: PendingPersistStatus;
    errorMessage: string;
    persist: () => Promise<void>;
}

type PendingListener = () => void;

const pendingEntries = new Map<string, PendingBaziRecordEntry>();
const pendingListeners = new Map<string, Set<PendingListener>>();

function notifyPendingListeners(id: string): void {
    pendingListeners.get(id)?.forEach((listener) => listener());
}

function setPendingEntry(id: string, entry: PendingBaziRecordEntry): void {
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

export function primePendingBaziRecord(input: {
    result: BaziResult;
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

export function getPendingBaziRecord(id: string): PendingBaziRecordEntry | null {
    return pendingEntries.get(id) ?? null;
}

export function retryPendingBaziPersist(id: string): void {
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

export function subscribePendingBaziRecord(id: string, listener: PendingListener): () => void {
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

export function clearPendingBaziRecord(id: string): void {
    pendingEntries.delete(id);
    notifyPendingListeners(id);
}
