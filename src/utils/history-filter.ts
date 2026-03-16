import { DivinationMethod } from '../core/liuyao-data';
import { DivinationEngine } from '../db/database';

export type HistoryActiveEngine = 'liuyao' | 'bazi' | 'ziwei';
export type LiuyaoHistoryCategory = 'all' | DivinationMethod | 'favorite';
export type BaziHistoryCategory = 'all' | 'kunzao' | 'qianzao' | 'favorite';
export type ZiweiHistoryCategory = 'all' | 'male' | 'female' | 'favorite';

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
    ziweiCategory: ZiweiHistoryCategory;
}

export const DEFAULT_HISTORY_FILTER: HistoryFilterState = {
    keyword: '',
    activeEngine: 'liuyao',
    liuyaoCategory: 'all',
    baziCategory: 'all',
    ziweiCategory: 'all',
};

export function getActiveHistoryCategory(filter: HistoryFilterState): LiuyaoHistoryCategory | BaziHistoryCategory | ZiweiHistoryCategory {
    if (filter.activeEngine === 'liuyao') {
        return filter.liuyaoCategory;
    }
    if (filter.activeEngine === 'bazi') {
        return filter.baziCategory;
    }
    return filter.ziweiCategory;
}

export function getBaziCategory(record: Pick<HistoryRecordItem, 'engineType' | 'subtitle' | 'method'>): Exclude<BaziHistoryCategory, 'all' | 'favorite'> | null {
    if (record.engineType !== 'bazi') {
        return null;
    }

    const methodStr = record.method || '';
    if (methodStr === 'qianzao' || methodStr.includes('乾造') || methodStr.includes('男')) return 'qianzao';
    if (methodStr === 'kunzao' || methodStr.includes('坤造') || methodStr.includes('女')) return 'kunzao';

    const subtitle = record.subtitle || '';
    if (subtitle.includes('乾造') || subtitle.includes('男')) return 'qianzao';
    if (subtitle.includes('坤造') || subtitle.includes('女')) return 'kunzao';

    return null;
}

function getZiweiCategory(record: Pick<HistoryRecordItem, 'engineType' | 'subtitle' | 'method'>): Exclude<ZiweiHistoryCategory, 'all' | 'favorite'> | null {
    if (record.engineType !== 'ziwei') {
        return null;
    }

    const methodStr = record.method || '';
    if (methodStr === 'male') return 'male';
    if (methodStr === 'female') return 'female';

    const subtitle = record.subtitle || '';
    if (subtitle.includes('男命')) return 'male';
    if (subtitle.includes('女命')) return 'female';

    return null;
}

export function getHistoryMetaLabel(record: HistoryRecordItem): string {
    if (record.engineType === 'liuyao') {
        return record.method || 'all';
    }
    if (record.engineType === 'ziwei') {
        return getZiweiCategory(record) || 'ziwei';
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
        } else if (filter.activeEngine === 'bazi') {
            if (activeCategory === 'favorite' && !record.isFavorite) {
                return false;
            }
            if (activeCategory !== 'all' && activeCategory !== 'favorite') {
                const category = getBaziCategory(record);
                if (category !== activeCategory) {
                    return false;
                }
            }
        } else {
            if (activeCategory === 'favorite' && !record.isFavorite) {
                return false;
            }
            const category = getZiweiCategory(record);
            if (activeCategory === 'male' && category !== 'male') {
                return false;
            }
            if (activeCategory === 'female' && category !== 'female') {
                return false;
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
