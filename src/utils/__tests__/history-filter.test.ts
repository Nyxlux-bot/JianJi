import {
    filterHistoryRecords,
    getBaziCategory,
    getHistoryMetaLabel,
    HistoryFilterState,
    HistoryRecordItem,
} from '../history-filter';

const mockRecords: HistoryRecordItem[] = [
    {
        id: '1',
        createdAt: '2026-03-01T00:00:00.000Z',
        engineType: 'liuyao',
        method: 'time',
        question: '什么时候换工作',
        title: '乾为天',
        subtitle: '天风姤',
        isFavorite: true,
    },
    {
        id: '2',
        createdAt: '2026-03-02T00:00:00.000Z',
        engineType: 'liuyao',
        method: 'coin',
        question: '感情走势如何',
        title: '坤为地',
        subtitle: '地雷复',
        isFavorite: false,
    },
    {
        id: '3',
        createdAt: '2026-03-03T00:00:00.000Z',
        engineType: 'bazi',
        question: '',
        title: '辛巳 辛卯 己巳 壬申',
        subtitle: '男 · 汕头 · 乾造',
        isFavorite: true,
    },
    {
        id: '4',
        createdAt: '2026-03-04T00:00:00.000Z',
        engineType: 'bazi',
        question: '',
        title: '乙酉 丁丑 癸卯 壬子',
        subtitle: '女 · 上海 · 坤造',
        isFavorite: false,
    },
];

function buildFilter(overrides: Partial<HistoryFilterState> = {}): HistoryFilterState {
    return {
        keyword: '',
        activeEngine: 'liuyao',
        liuyaoCategory: 'all',
        baziCategory: 'all',
        ...overrides,
    };
}

describe('history filter', () => {
    it('filters liuyao records by current engine', () => {
        const result = filterHistoryRecords(mockRecords, buildFilter());
        expect(result.map((record) => record.id)).toEqual(['1', '2']);
    });

    it('filters liuyao by method and favorite category', () => {
        expect(filterHistoryRecords(mockRecords, buildFilter({ liuyaoCategory: 'time' })).map((record) => record.id)).toEqual(['1']);
        expect(filterHistoryRecords(mockRecords, buildFilter({ liuyaoCategory: 'favorite' })).map((record) => record.id)).toEqual(['1']);
    });

    it('filters bazi by profile category and favorite category', () => {
        expect(
            filterHistoryRecords(mockRecords, buildFilter({ activeEngine: 'bazi', baziCategory: 'qianzao' })).map((record) => record.id),
        ).toEqual(['3']);
        expect(
            filterHistoryRecords(mockRecords, buildFilter({ activeEngine: 'bazi', baziCategory: 'kunzao' })).map((record) => record.id),
        ).toEqual(['4']);
        expect(
            filterHistoryRecords(mockRecords, buildFilter({ activeEngine: 'bazi', baziCategory: 'favorite' })).map((record) => record.id),
        ).toEqual(['3']);
    });

    it('matches keyword only inside the active engine shelf', () => {
        expect(filterHistoryRecords(mockRecords, buildFilter({ keyword: '感情' })).map((record) => record.id)).toEqual(['2']);
        expect(filterHistoryRecords(mockRecords, buildFilter({ activeEngine: 'bazi', keyword: '汕头' })).map((record) => record.id)).toEqual(['3']);
        expect(filterHistoryRecords(mockRecords, buildFilter({ activeEngine: 'bazi', keyword: '换工作' }))).toEqual([]);
    });

    it('derives bazi categories and meta labels from subtitle text', () => {
        expect(getBaziCategory(mockRecords[2])).toBe('qianzao');
        expect(getBaziCategory(mockRecords[3])).toBe('kunzao');
        expect(getHistoryMetaLabel(mockRecords[0])).toBe('time');
        expect(getHistoryMetaLabel(mockRecords[3])).toBe('kunzao');
    });
});
