import { CityInfo, getAllCities } from '../../core/city-data';
import { BaziResult } from '../../core/bazi-types';
import { buildLocalDateTimeFromDateAndTime, parseLocalDateTime } from '../../core/bazi-local-time';
import { BaziFormState } from './types';

function normalizePlaceName(value: string): string {
    return value
        .trim()
        .replace(/\s+/g, '')
        .replace(/特别行政区/g, '')
        .replace(/自治区/g, '')
        .replace(/自治州/g, '')
        .replace(/省|市|区|县/g, '');
}

export function findCityForBaziResult(result: BaziResult): CityInfo | null {
    const allCities = getAllCities();
    const placeText = normalizePlaceName(result.baseInfo.birthPlaceDisplay || '');

    if (placeText) {
        const byPlace = allCities.find((city) => {
            const cityText = normalizePlaceName(`${city.province}${city.name}`);
            return placeText.includes(cityText) || cityText.includes(placeText);
        });
        if (byPlace) {
            return byPlace;
        }
    }

    if (result.longitude !== null) {
        const targetLongitude = result.longitude;
        const byLongitude = allCities.find((city) => Math.abs(city.longitude - targetLongitude) < 0.01);
        if (byLongitude) {
            return byLongitude;
        }

        const nearest = [...allCities].sort(
            (left, right) => Math.abs(left.longitude - targetLongitude) - Math.abs(right.longitude - targetLongitude)
        )[0];
        if (nearest && Math.abs(nearest.longitude - targetLongitude) < 0.5) {
            return nearest;
        }
    }

    return null;
}

export function buildBaziEditFormState(result: BaziResult, now: Date = new Date()): BaziFormState {
    const city = findCityForBaziResult(result);
    const birthDate = parseLocalDateTime(result.timeMeta.solarDateTimeLocal)
        ?? parseLocalDateTime(buildLocalDateTimeFromDateAndTime(result.solarDate, result.solarTime))
        ?? new Date(result.timeMeta.solarDateTimeIso);

    return {
        name: result.subject.name,
        birthDate,
        gender: result.gender,
        city,
        editingRecordId: result.id,
        locationFallbackLabel: city ? '' : result.baseInfo.birthPlaceDisplay,
        useCustomReferenceDate: false,
        referenceDate: now,
        ziHourMode: result.schoolOptionsResolved.ziHourMode,
        timeMode: result.schoolOptionsResolved.timeMode,
        daylightSaving: result.schoolOptionsResolved.daylightSaving,
    };
}
