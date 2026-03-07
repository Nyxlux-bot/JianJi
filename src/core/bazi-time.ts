import { BaziTimeMode } from './bazi-types';
import { calculateMeanSolarTime, calculateTrueSolarTime } from './true-solar-time';

function cloneDate(date: Date): Date {
    return new Date(date.getTime());
}

export function calculateBaziChartTime(
    date: Date,
    longitude: number | null,
    timeMode: BaziTimeMode,
    daylightSavingEnabled: boolean = false,
): Date {
    if (timeMode === 'clock_time' || longitude === null) {
        return cloneDate(date);
    }

    if (timeMode === 'mean_solar_time') {
        return calculateMeanSolarTime(date, longitude, {
            daylightSavingEnabled,
        });
    }

    return calculateTrueSolarTime(date, longitude, {
        daylightSavingEnabled,
    });
}

export function getBaziTimeModeLabel(timeMode: BaziTimeMode): string {
    switch (timeMode) {
        case 'clock_time':
            return '本地钟表时';
        case 'mean_solar_time':
            return '平太阳时';
        case 'true_solar_time':
            return '真太阳时';
        default:
            return '本地钟表时';
    }
}

export function getBaziChartTimeLabel(timeMode: BaziTimeMode): string {
    switch (timeMode) {
        case 'clock_time':
            return '本地时间';
        case 'mean_solar_time':
            return '平太阳时';
        case 'true_solar_time':
            return '真太阳时';
        default:
            return '本地时间';
    }
}

export function baziTimeModeNeedsLongitude(timeMode: BaziTimeMode): boolean {
    return timeMode !== 'clock_time';
}
