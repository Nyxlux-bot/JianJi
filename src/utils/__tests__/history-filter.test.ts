import { filterHistoryRecords, HistoryFilterState, HistoryRecordItem } from '../history-filter';

const mockRecords: HistoryRecordItem[] = [
    {
        id: '1',
        createdAt: '2026-03-01T00:00:00.000Z',
        method: 'time',
        question: '什么时候换工作',
        guaName: '乾为天',
        bianGuaName: '天风姤',
        isFavorite: true,
    },
    {
        id: '2',
        createdAt: '2026-03-02T00:00:00.000Z',
        method: 'coin',
        question: '感情走势如何',
        guaName: '坤为地',
        bianGuaName: '地雷复',
        isFavorite: false,
    },
    {
        id: '3',
        createdAt: '2026-03-03T00:00:00.000Z',
        method: 'number',
        question: '',
        guaName: '水雷屯',
        bianGuaName: '',
        isFavorite: true,
    },
];

function buildFilter(overrides: Partial<HistoryFilterState> = {}): HistoryFilterState {
    return {
        keyword: '',
        onlyFavorite: false,
        methods: [],
        ...overrides,
    };
}

describe('filterHistoryRecords', () => {
    it('filters by favorite switch', () => {
        const result = filterHistoryRecords(mockRecords, buildFilter({ onlyFavorite: true }));
        expect(result.map(r => r.id)).toEqual(['1', '3']);
    });

    it('filters by selected methods', () => {
        const result = filterHistoryRecords(mockRecords, buildFilter({ methods: ['coin', 'manual'] }));
        expect(result.map(r => r.id)).toEqual(['2']);
    });

    it('matches keyword against question and gua names', () => {
        expect(filterHistoryRecords(mockRecords, buildFilter({ keyword: '感情' })).map(r => r.id)).toEqual(['2']);
        expect(filterHistoryRecords(mockRecords, buildFilter({ keyword: '乾为天' })).map(r => r.id)).toEqual(['1']);
        expect(filterHistoryRecords(mockRecords, buildFilter({ keyword: '地雷复' })).map(r => r.id)).toEqual(['2']);
    });

    it('supports combined filters', () => {
        const result = filterHistoryRecords(
            mockRecords,
            buildFilter({
                onlyFavorite: true,
                methods: ['time', 'coin'],
                keyword: '工作',
            })
        );

        expect(result.map(r => r.id)).toEqual(['1']);
    });
});
