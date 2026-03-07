import { calculateBazi } from '../../../core/bazi-calc';
import {
    clearPendingBaziRecord,
    getPendingBaziRecord,
    primePendingBaziRecord,
    retryPendingBaziPersist,
    subscribePendingBaziRecord,
} from '../pending-result-cache';

describe('pending bazi result cache', () => {
    it('stores pending result immediately and updates after persist succeeds', async () => {
        const result = calculateBazi({
            date: new Date(2001, 11, 8, 17, 41, 0),
            gender: 1,
        });
        const events: string[] = [];
        const unsubscribe = subscribePendingBaziRecord(result.id, () => {
            const current = getPendingBaziRecord(result.id);
            if (current) {
                events.push(current.status);
            }
        });

        primePendingBaziRecord({
            result,
            envelope: {
                engineType: 'bazi',
                result,
            },
            persist: async () => undefined,
        });

        await Promise.resolve();
        await Promise.resolve();

        expect(getPendingBaziRecord(result.id)?.status).toBe('saved');
        expect(events).toContain('saving');
        expect(events).toContain('saved');

        unsubscribe();
        clearPendingBaziRecord(result.id);
    });

    it('can retry a failed persist', async () => {
        const result = calculateBazi({
            date: new Date(2001, 2, 7, 15, 40, 0),
            gender: 0,
        });
        let attempts = 0;

        primePendingBaziRecord({
            result,
            envelope: {
                engineType: 'bazi',
                result,
            },
            persist: async () => {
                attempts += 1;
                if (attempts === 1) {
                    throw new Error('network down');
                }
            },
        });

        await Promise.resolve();
        await Promise.resolve();
        expect(getPendingBaziRecord(result.id)?.status).toBe('error');

        retryPendingBaziPersist(result.id);
        await Promise.resolve();
        await Promise.resolve();

        expect(getPendingBaziRecord(result.id)?.status).toBe('saved');
        clearPendingBaziRecord(result.id);
    });
});
