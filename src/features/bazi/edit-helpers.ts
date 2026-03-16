import {
    buildRegionSelection,
    findRegionCandidateByDisplayText,
    RegionSelection,
} from '../../core/city-data';
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

export function findRegionForBaziResult(result: BaziResult): RegionSelection | null {
    const placeText = normalizePlaceName(result.baseInfo.birthPlaceDisplay || '');
    const candidate = placeText ? findRegionCandidateByDisplayText(placeText) : null;

    if (candidate && result.longitude !== null) {
        return buildRegionSelection(candidate, {
            longitude: result.longitude,
            latitude: null,
        });
    }

    if (result.longitude === null) {
        return null;
    }

    return {
        provinceCode: '',
        provinceName: '',
        cityCode: '',
        cityName: result.baseInfo.birthPlaceDisplay || '',
        districtCode: '',
        districtName: '',
        longitude: result.longitude,
        latitude: null,
    };
}

export function buildBaziEditFormState(result: BaziResult, now: Date = new Date()): BaziFormState {
    const location = findRegionForBaziResult(result);
    const isCompatibilityFallbackLocation = Boolean(
        location
        && !location.provinceCode
        && !location.cityCode
        && !location.districtCode,
    );
    const birthDate = parseLocalDateTime(result.timeMeta.solarDateTimeLocal)
        ?? parseLocalDateTime(buildLocalDateTimeFromDateAndTime(result.solarDate, result.solarTime))
        ?? new Date(result.timeMeta.solarDateTimeIso);

    return {
        name: result.subject.name,
        birthDate,
        gender: result.gender,
        location,
        editingRecordId: result.id,
        locationFallbackLabel: isCompatibilityFallbackLocation
            ? result.baseInfo.birthPlaceDisplay
            : (location ? '' : result.baseInfo.birthPlaceDisplay),
        useCustomReferenceDate: false,
        referenceDate: now,
        ziHourMode: result.schoolOptionsResolved.ziHourMode,
        timeMode: result.schoolOptionsResolved.timeMode,
        daylightSaving: result.schoolOptionsResolved.daylightSaving,
    };
}
