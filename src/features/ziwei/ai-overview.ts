import { computeZiweiDynamicHoroscope, computeZiweiStaticChart } from './iztro-adapter';
import type { ZiweiRecordResult } from './record';
import type { ZiweiInputPayload, ZiweiPalaceAnalysisView, ZiweiStaticChartResult } from './types';

/** Chart facts the AI page shows next to the model's text; computed by the app, never parsed from replies. */
export type ZiweiMutagenKind = '禄' | '权' | '科' | '忌';
export interface ZiweiMutagenPlacement { kind: ZiweiMutagenKind; star: string; palace: string }
export interface ZiweiNatalOverview {
    lifePalace: { name: string; ganZhi: string; majorStars: string[] };
    bodyPalaceName: string;
    birthMutagens: ZiweiMutagenPlacement[];
}
export interface ZiweiYearOverview {
    year: number;
    ganZhi: string;
    /** Natal palace that the 流年命宫 falls in. */
    yearlyPalace: string;
    decadalPalace: string;
    decadalRange: string;
    mutagens: ZiweiMutagenPlacement[];
}

const MUTAGEN_KINDS: ZiweiMutagenKind[] = ['禄', '权', '科', '忌'];

function toPayload(record: ZiweiRecordResult): ZiweiInputPayload {
    return {
        birthLocal: record.birthLocal, longitude: record.longitude, gender: record.gender,
        tzOffsetMinutes: record.tzOffsetMinutes, daylightSavingEnabled: record.daylightSavingEnabled,
        calendarType: record.calendarType, lunar: record.lunar, config: record.config,
        cityLabel: record.cityLabel, name: record.name,
    };
}

function starsOf(palace: ZiweiPalaceAnalysisView) {
    return [...palace.majorStars, ...palace.minorStars, ...palace.adjectiveStars];
}

function findStarPalace(chart: ZiweiStaticChartResult, star: string): string {
    return chart.palaces.find((palace) => starsOf(palace).some((item) => item.name === star))?.name ?? '';
}

function staticChartOf(record: ZiweiRecordResult): ZiweiStaticChartResult | null {
    try {
        return computeZiweiStaticChart(toPayload(record));
    } catch {
        return null;
    }
}

export function getZiweiNatalOverview(record: ZiweiRecordResult): ZiweiNatalOverview | null {
    const chart = staticChartOf(record);
    const life = chart?.palaces.find((palace) => palace.name === '命宫');
    if (!chart || !life) return null;
    const birthMutagens = MUTAGEN_KINDS.flatMap((kind) => chart.palaces.flatMap((palace) =>
        starsOf(palace).filter((star) => star.mutagen === kind).map((star) => ({ kind, star: star.name, palace: palace.name }))));
    return {
        lifePalace: { name: life.name, ganZhi: `${life.heavenlyStem}${life.earthlyBranch}`, majorStars: life.majorStars.map((star) => star.name) },
        bodyPalaceName: chart.palaces.find((palace) => palace.isBodyPalace)?.name ?? '',
        birthMutagens,
    };
}

/** 流年 at the same 7/1 12:00 anchor the five-year evidence pack uses. */
export function getZiweiYearOverviews(record: ZiweiRecordResult, years: number[]): Record<number, ZiweiYearOverview> {
    const chart = staticChartOf(record);
    if (!chart) return {};
    const entries = years.flatMap((year) => {
        try {
            const { horoscopeNow } = computeZiweiDynamicHoroscope(chart, new Date(year, 6, 1, 12, 0, 0, 0));
            const decadal = chart.palaces.find((palace) => palace.palaceIndex === horoscopeNow.decadal.index);
            const overview: ZiweiYearOverview = {
                year,
                ganZhi: `${horoscopeNow.yearly.heavenlyStem}${horoscopeNow.yearly.earthlyBranch}`,
                yearlyPalace: chart.palaces.find((palace) => palace.palaceIndex === horoscopeNow.yearly.index)?.name ?? '',
                decadalPalace: decadal?.name ?? '',
                decadalRange: decadal?.decadalRange ?? '',
                mutagens: horoscopeNow.yearly.mutagen.slice(0, 4).map((star, index) => ({
                    kind: MUTAGEN_KINDS[index], star, palace: findStarPalace(chart, star),
                })),
            };
            return [[year, overview] as const];
        } catch {
            return [];
        }
    });
    return Object.fromEntries(entries);
}
