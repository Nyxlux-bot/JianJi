import { resolveImportAction } from '../import-strategy';

type Mode = 'merge' | 'replace';
type Policy = 'skip' | 'replace';

function simulateImport(
    existingIds: string[],
    incomingIds: string[],
    options: { mode: Mode; conflictPolicy: Policy }
) {
    const stats = { inserted: 0, updated: 0, skipped: 0 };
    const existing = new Set(options.mode === 'replace' ? [] : existingIds);

    for (const id of incomingIds) {
        const hasExisting = existing.has(id);
        const action = resolveImportAction(hasExisting, options.mode, options.conflictPolicy);

        if (action === 'insert') {
            stats.inserted += 1;
            existing.add(id);
        } else if (action === 'update') {
            stats.updated += 1;
            existing.add(id);
        } else {
            stats.skipped += 1;
        }
    }

    return stats;
}

describe('database import strategy', () => {
    it('skips duplicates when conflictPolicy is skip', () => {
        const stats = simulateImport(['rec-1'], ['rec-1', 'rec-2'], {
            mode: 'merge',
            conflictPolicy: 'skip',
        });

        expect(stats).toEqual({ inserted: 1, updated: 0, skipped: 1 });
    });

    it('updates duplicates when conflictPolicy is replace', () => {
        const stats = simulateImport(['rec-1'], ['rec-1', 'rec-2'], {
            mode: 'merge',
            conflictPolicy: 'replace',
        });

        expect(stats).toEqual({ inserted: 1, updated: 1, skipped: 0 });
    });

    it('treats replace mode as full overwrite and counts repeated ids', () => {
        const stats = simulateImport(['rec-1', 'rec-3'], ['rec-1', 'rec-1', 'rec-2'], {
            mode: 'replace',
            conflictPolicy: 'skip',
        });

        expect(stats).toEqual({ inserted: 2, updated: 1, skipped: 0 });
    });
});
