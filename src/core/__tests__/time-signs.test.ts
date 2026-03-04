import { getMonthGeneralByJieqi, getMoonPhase } from '../time-signs';

describe('time-signs', () => {
    describe('getMonthGeneralByJieqi', () => {
        it('returns 亥将登明 at 雨水', () => {
            const result = getMonthGeneralByJieqi('雨水');
            expect(result.zhi).toBe('亥');
            expect(result.name).toBe('登明');
            expect(result.basedOnTerm).toBe('雨水');
        });

        it('inherits previous anchor for 惊蛰', () => {
            const result = getMonthGeneralByJieqi('惊蛰');
            expect(result.zhi).toBe('亥');
            expect(result.name).toBe('登明');
            expect(result.basedOnTerm).toBe('雨水');
        });

        it('returns 戌将河魁 at 春分', () => {
            const result = getMonthGeneralByJieqi('春分');
            expect(result.zhi).toBe('戌');
            expect(result.name).toBe('河魁');
            expect(result.basedOnTerm).toBe('春分');
        });

        it('returns 子将神后 at 大寒', () => {
            const result = getMonthGeneralByJieqi('大寒');
            expect(result.zhi).toBe('子');
            expect(result.name).toBe('神后');
            expect(result.basedOnTerm).toBe('大寒');
        });

        it('falls back by month zhi when solar term is invalid', () => {
            const result = getMonthGeneralByJieqi('未知节气', '寅');
            expect(result.zhi).toBe('亥');
            expect(result.name).toBe('登明');
            expect(result.basedOnTerm).toBe('月支兜底:寅');
        });
    });

    describe('getMoonPhase', () => {
        const synodicMonth = 29.530588853;
        const baseNewMoon = new Date(Date.UTC(2000, 0, 6, 18, 14, 0));

        it('returns near-new-moon phase around base timestamp', () => {
            const result = getMoonPhase(baseNewMoon);
            expect(result.name).toBe('朔月');
            expect(result.illuminationPct).toBeLessThanOrEqual(1);
        });

        it('returns near-full-moon phase around +14.7 days', () => {
            const nearFull = new Date(baseNewMoon.getTime() + (14.7 * 86400000));
            const result = getMoonPhase(nearFull);
            expect(result.name).toBe('望月');
            expect(result.illuminationPct).toBeGreaterThan(95);
        });

        it('forces 望月 on lunar day 15', () => {
            const anyDate = new Date('2026-02-15T12:00:00Z');
            const result = getMoonPhase(anyDate, 15);
            expect(result.name).toBe('望月');
        });

        it('forces 既望 on lunar day 16', () => {
            const anyDate = new Date('2026-02-16T12:00:00Z');
            const result = getMoonPhase(anyDate, 16);
            expect(result.name).toBe('既望');
        });

        it('keeps ageDays within [0, synodicMonth)', () => {
            const dates = [
                new Date('1998-04-12T00:00:00Z'),
                new Date('2026-02-18T00:00:00Z'),
                new Date('2033-11-01T12:30:00Z'),
            ];

            for (const date of dates) {
                const result = getMoonPhase(date);
                expect(result.ageDays).toBeGreaterThanOrEqual(0);
                expect(result.ageDays).toBeLessThan(synodicMonth);
            }
        });
    });
});
