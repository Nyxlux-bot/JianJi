import { DivinationMethod } from '../core/liuyao-data';
import { DivinationEngine } from '../db/database';

export type HistoryActiveEngine = 'liuyao' | 'bazi';
export type LiuyaoHistoryCategory = 'all' | DivinationMethod | 'favorite';
export type BaziHistoryCategory = 'all' | 'kunzao' | 'qianzao' | 'favorite';

export interface HistoryRecordItem {
    id: string;
    createdAt?: string;
    engineType: DivinationEngine;
    method?: string;
    question: string;
    title: string;
    subtitle: string;
    isFavorite: boolean;
}

export interface HistoryFilterState {
    keyword: string;
    activeEngine: HistoryActiveEngine;
    liuyaoCategory: LiuyaoHistoryCategory;
    baziCategory: BaziHistoryCategory;
}

export const DEFAULT_HISTORY_FILTER: HistoryFilterState = {
    keyword: '',
    activeEngine: 'liuyao',
    liuyaoCategory: 'all',
    baziCategory: 'all',
};

export function getActiveHistoryCategory(filter: HistoryFilterState): LiuyaoHistoryCategory | BaziHistoryCategory {
    return filter.activeEngine === 'liuyao' ? filter.liuyaoCategory : filter.baziCategory;
}

export function getBaziCategory(record: Pick<HistoryRecordItem, 'engineType' | 'subtitle'>): Exclude<BaziHistoryCategory, 'all' | 'favorite'> | null {
    if (record.engineType !== 'bazi') {
        return null;
    }

    const subtitle = record.subtitle || '';
    if (subtitle.includes('乾造') || subtitle.includes('男')) {
        return 'qianzao';
    }
    if (subtitle.includes('坤造') || subtitle.includes('女')) {
        return 'kunzao';
    }
    return null;
}

export function getHistoryMetaLabel(record: HistoryRecordItem): string {
    if (record.engineType === 'liuyao') {
        return record.method || 'all';
    }

    return getBaziCategory(record) || 'bazi';
}

export function filterHistoryRecords<T extends HistoryRecordItem>(records: T[], filter: HistoryFilterState): T[] {
    const keyword = filter.keyword.trim().toLowerCase();
    const activeCategory = getActiveHistoryCategory(filter);

    return records.filter((record) => {
        if (record.engineType !== filter.activeEngine) {
            return false;
        }

        if (filter.activeEngine === 'liuyao') {
            if (activeCategory === 'favorite' && !record.isFavorite) {
                return false;
            }
            if (activeCategory !== 'all' && activeCategory !== 'favorite' && record.method !== activeCategory) {
                return false;
            }
        } else {
            if (activeCategory === 'favorite' && !record.isFavorite) {
                return false;
            }
            if (activeCategory !== 'all' && activeCategory !== 'favorite') {
                const category = getBaziCategory(record);
                if (category !== activeCategory) {
                    return false;
                }
            }
        }

        if (!keyword) {
            return true;
        }

        const question = (record.question || '').toLowerCase();
        const title = (record.title || '').toLowerCase();
        const subtitle = (record.subtitle || '').toLowerCase();

        return question.includes(keyword) || title.includes(keyword) || subtitle.includes(keyword);
    });
}
