import { DivinationMethod } from '../core/liuyao-data';

export interface HistoryRecordItem {
    id: string;
    createdAt?: string;
    method: string;
    question: string;
    guaName: string;
    bianGuaName: string;
    isFavorite: boolean;
}

export interface HistoryFilterState {
    keyword: string;
    onlyFavorite: boolean;
    methods: DivinationMethod[];
}

export const DEFAULT_HISTORY_FILTER: HistoryFilterState = {
    keyword: '',
    onlyFavorite: false,
    methods: [],
};

export function filterHistoryRecords<T extends HistoryRecordItem>(records: T[], filter: HistoryFilterState): T[] {
    const keyword = filter.keyword.trim().toLowerCase();
    const hasMethodFilter = filter.methods.length > 0;

    return records.filter((record) => {
        if (filter.onlyFavorite && !record.isFavorite) {
            return false;
        }

        if (hasMethodFilter && !filter.methods.includes(record.method as DivinationMethod)) {
            return false;
        }

        if (!keyword) {
            return true;
        }

        const question = (record.question || '').toLowerCase();
        const guaName = (record.guaName || '').toLowerCase();
        const bianGuaName = (record.bianGuaName || '').toLowerCase();

        return question.includes(keyword) || guaName.includes(keyword) || bianGuaName.includes(keyword);
    });
}
