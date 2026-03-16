import {
    buildRegionSelection,
    findRegionCandidateByDisplayText,
    RegionSelection,
} from '../../core/city-data';
import { parseLocalDateTime } from '../../core/bazi-local-time';
import { ZiweiRecordResult } from './record';

export interface ZiweiEditFormState {
    name: string;
    gender: ZiweiRecordResult['gender'];
    birthDate: Date;
    birthSelection: {
        calendarType: ZiweiRecordResult['calendarType'];
        lunar?: ZiweiRecordResult['lunar'];
    };
    config: ZiweiRecordResult['config'];
    daylightSavingEnabled: boolean;
    location: RegionSelection | null;
    locationFallbackLabel: string;
    editingRecordId: string;
}

export function findRegionForZiweiRecord(record: ZiweiRecordResult): RegionSelection | null {
    const placeText = (record.cityLabel || '').trim();
    const candidate = placeText ? findRegionCandidateByDisplayText(placeText) : null;

    if (!candidate) {
        return null;
    }

    return buildRegionSelection(candidate, {
        longitude: record.longitude,
        latitude: null,
    });
}

export function buildZiweiEditFormState(record: ZiweiRecordResult): ZiweiEditFormState {
    const location = findRegionForZiweiRecord(record);
    const birthDate = parseLocalDateTime(record.birthLocal) || new Date(record.createdAt);

    return {
        name: record.name || '',
        gender: record.gender,
        birthDate,
        birthSelection: {
            calendarType: record.calendarType,
            lunar: record.calendarType === 'lunar' ? record.lunar : undefined,
        },
        config: record.config,
        daylightSavingEnabled: record.daylightSavingEnabled,
        location,
        locationFallbackLabel: location ? '' : (record.cityLabel || ''),
        editingRecordId: record.id,
    };
}
