import { calculateBazi } from '../../../core/bazi-calc';
import { buildBaziEditFormState } from '../edit-helpers';

describe('bazi edit helpers', () => {
    it('maps a stored bazi result back to editable form state', () => {
        const result = calculateBazi({
            date: new Date(2001, 11, 8, 17, 41, 0),
            gender: 1,
            longitude: 116.68,
            locationName: '广东汕头',
            schoolOptions: { timeMode: 'true_solar_time' },
        });

        const form = buildBaziEditFormState(result, new Date(2026, 0, 1, 0, 0, 0));

        expect(form.editingRecordId).toBe(result.id);
        expect(form.birthDate.toISOString()).toBe(result.timeMeta.solarDateTimeIso);
        expect(form.city?.name).toBe('汕头');
        expect(form.locationFallbackLabel).toBe('');
        expect(form.timeMode).toBe(result.schoolOptionsResolved.timeMode);
    });

    it('keeps a fallback birth-place label when city matching fails', () => {
        const result = calculateBazi({
            date: new Date(2001, 11, 8, 17, 41, 0),
            gender: 1,
            schoolOptions: { timeMode: 'clock_time' },
        });

        const form = buildBaziEditFormState({
            ...result,
            longitude: null,
            baseInfo: {
                ...result.baseInfo,
                birthPlaceDisplay: '海外未录入地点',
            },
        });

        expect(form.city).toBeNull();
        expect(form.locationFallbackLabel).toBe('海外未录入地点');
    });
});
