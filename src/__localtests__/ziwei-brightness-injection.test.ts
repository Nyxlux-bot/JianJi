process.env.TZ = 'Asia/Shanghai';

jest.mock('../polyfills/intl', () => ({}));

import baseline from '../features/ziwei/brightness/ziwei-brightness-baseline.json';
import * as brightnessBaseline from '../features/ziwei/brightness/baseline';
import { collectZiweiStarsMissingBrightness } from '../features/ziwei/brightness/coverage';
import { computeZiweiStaticChart, ZIWEI_DEFAULT_CONFIG, ZIWEI_STANDARD_TIMEZONE_OFFSET_MINUTES } from '../features/ziwei/iztro-adapter';
import type { ZiweiInputPayload } from '../features/ziwei/types';

function makePayload(overrides: Partial<ZiweiInputPayload>): ZiweiInputPayload {
    return {
        birthLocal: '1990-01-01T00:00',
        longitude: 120,
        gender: 'male',
        tzOffsetMinutes: ZIWEI_STANDARD_TIMEZONE_OFFSET_MINUTES,
        daylightSavingEnabled: false,
        calendarType: 'solar',
        config: ZIWEI_DEFAULT_CONFIG,
        ...overrides,
    };
}

describe('ziwei brightness injection (local only)', () => {
    it('injects brightness for stars missing from iztro defaults and keeps major stars non-empty', () => {
        const chart = computeZiweiStaticChart(makePayload({}));
        const stars = chart.palaces.flatMap((palace) => [
            ...palace.majorStars,
            ...palace.minorStars,
            ...palace.adjectiveStars,
        ]);

        const find = (name: string) => stars.find((star) => star.name === name)?.brightness ?? '';

        // Main stars should always have single-char brightness.
        expect(find('紫微')).toHaveLength(1);

        // These are empty in upstream iztro defaults (v2.5.8) without brightness config.
        expect(find('左辅')).toHaveLength(1);
        expect(find('右弼')).toHaveLength(1);
        expect(find('天魁')).toHaveLength(1);
        expect(find('天钺')).toHaveLength(1);
        expect(find('禄存')).toBe('庙');
    });

    it('keeps the injected brightness when using zhongzhou algorithm config', () => {
        const chart = computeZiweiStaticChart(makePayload({
            config: {
                ...ZIWEI_DEFAULT_CONFIG,
                algorithm: 'zhongzhou',
            },
        }));
        const stars = chart.palaces.flatMap((palace) => [
            ...palace.majorStars,
            ...palace.minorStars,
            ...palace.adjectiveStars,
        ]);

        const lucun = stars.find((star) => star.name === '禄存');
        expect(lucun?.brightness).toBe('庙');
    });

    it('resolves brightness without reading the global astro config at runtime', () => {
        const brightnessSpy = jest.spyOn(brightnessBaseline, 'resolveZiweiBrightnessLabel');

        expect(() => computeZiweiStaticChart(makePayload({
            birthLocal: '1990-01-01T00:02',
            config: { ...ZIWEI_DEFAULT_CONFIG, algorithm: 'default' },
        }))).not.toThrow();

        expect(brightnessSpy.mock.calls.length).toBeGreaterThan(0);
        expect(brightnessSpy.mock.calls.every(([algorithm]) => algorithm === 'default')).toBe(true);

        brightnessSpy.mockRestore();
    });

    it('limits current-page brightness gaps to declared unresolved keys', () => {
        const chart = computeZiweiStaticChart(makePayload({}));
        const missing = collectZiweiStarsMissingBrightness(chart.palaces);
        const allowed = new Set([
            ...baseline.schools.common_quanshu.notApplicableStarKeys,
            ...baseline.schools.common_quanshu.unresolvedStarKeys,
        ]);

        expect(chart.palaces.flatMap((palace) => palace.adjectiveStars).find((star) => star.name === '恩光')?.brightness).toHaveLength(1);
        expect(chart.palaces.flatMap((palace) => palace.adjectiveStars).find((star) => star.name === '天寿')?.brightness).toHaveLength(1);
        expect(chart.palaces.flatMap((palace) => palace.minorStars).find((star) => star.name === '地劫')?.brightness).toHaveLength(1);

        missing.forEach((item) => {
            expect(allowed.has(item.starKey)).toBe(true);
        });
    });
});
