import { t } from 'iztro/lib/i18n';

import { buildZiweiBrightnessConfig } from './baseline';
import baseline from './ziwei-brightness-baseline.json';
import type { ZiweiBrightnessValue } from './baseline';

describe('ziwei brightness baseline', () => {
    it('uses a stable schema and valid values', () => {
        expect(baseline.version).toBeGreaterThanOrEqual(1);
        expect(baseline.generatedAt).toEqual(expect.any(String));
        expect(baseline.branchOrder).toEqual(['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑']);
        expect(baseline.levels).toEqual(['miao', 'wang', 'de', 'li', 'ping', 'xian', 'bu']);

        const allowed = new Set(baseline.levels);

        Object.entries(baseline.schools).forEach(([schoolId, school]) => {
            expect(schoolId).toEqual(expect.any(String));
            expect(school.displayName).toEqual(expect.any(String));
            expect(Array.isArray(school.sources)).toBe(true);
            expect(Array.isArray(school.renderScopeStarKeys)).toBe(true);
            expect(Array.isArray(school.notApplicableStarKeys)).toBe(true);
            expect(Array.isArray(school.unresolvedStarKeys)).toBe(true);
            expect(Array.isArray(school.sourceTables)).toBe(true);
            const schoolStars = school.stars as Record<string, ZiweiBrightnessValue[]>;
            const notApplicable = school.notApplicableStarKeys as string[];
            const unresolved = school.unresolvedStarKeys as string[];

            Object.entries(schoolStars).forEach(([starKey, values]) => {
                // Ensure `iztro` can translate this key (guards typos like `zuoFuMin`).
                expect(t(starKey)).not.toBe(starKey);

                expect(Array.isArray(values)).toBe(true);
                expect(values).toHaveLength(baseline.branchOrder.length);

                (values as ZiweiBrightnessValue[]).forEach((value) => {
                    if (value === null) {
                        return;
                    }
                    expect(allowed.has(value)).toBe(true);
                });
            });

            school.renderScopeStarKeys.forEach((starKey) => {
                const covered = Boolean(schoolStars[starKey])
                    || notApplicable.includes(starKey)
                    || unresolved.includes(starKey);
                expect(covered).toBe(true);
            });

            school.sourceTables.forEach((table) => {
                table.starKeys.forEach((starKey) => {
                    expect(t(starKey)).not.toBe(starKey);
                });
            });
        });
    });

    it('keeps partially-known stars in the runtime config instead of dropping them entirely', () => {
        const config = buildZiweiBrightnessConfig('common_quanshu');

        expect(config.dikongMin).toHaveLength(12);
        expect(config.dikongMin.some((value) => value !== '')).toBe(true);

        expect(config.tianmaMin).toHaveLength(12);
        expect(config.tianmaMin.every((value) => value === '')).toBe(true);

        expect(config.qingyangMin).toHaveLength(12);
        expect(config.qingyangMin.some((value) => value === 'miao' || value === 'xian')).toBe(true);
    });
});
