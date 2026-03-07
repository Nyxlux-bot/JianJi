import { calculateBazi } from '../../core/bazi-calc';
import { validateImportRecords } from '../import-validation';

describe('validateImportRecords', () => {
    const validLiuyaoRecord = {
        id: 'rec-1',
        createdAt: '2026-03-05T08:00:00.000Z',
        method: 'time',
        question: '测试',
        benGua: {
            fullName: '乾为天',
        },
    };

    const validBaziResult = calculateBazi({
        date: new Date(2001, 2, 7, 15, 40, 0),
        gender: 1,
        longitude: 116.41,
        schoolOptions: { timeMode: 'true_solar_time' },
    });

    it('accepts v1 liuyao records', () => {
        const result = validateImportRecords([validLiuyaoRecord]);
        expect(result).toHaveLength(1);
        expect(result[0].engineType).toBe('liuyao');
        expect(result[0].result.id).toBe('rec-1');
    });

    it('accepts v2 bazi envelopes', () => {
        const result = validateImportRecords([
            {
                engineType: 'bazi',
                result: validBaziResult,
                summary: {
                    title: '辛巳 辛卯 己巳 壬申',
                },
            },
        ]);

        expect(result).toHaveLength(1);
        expect(result[0].engineType).toBe('bazi');
        expect(result[0].result.id).toBe(validBaziResult.id);
        expect(result[0].summary?.title).toBe('辛巳 辛卯 己巳 壬申');
    });

    it('rejects bazi envelopes missing timeMeta required by the result views', () => {
        const { timeMeta, ...incompleteResult } = validBaziResult;

        expect(() => validateImportRecords([
            {
                engineType: 'bazi',
                result: incompleteResult,
            },
        ])).toThrow('第1条记录格式无效：八字结果结构非法');
    });

    it('rejects records with invalid engineType', () => {
        expect(() => validateImportRecords([
            {
                engineType: 'unknown',
                result: validLiuyaoRecord,
            },
        ])).toThrow('第1条记录格式无效：缺少有效 engineType');
    });

    it('rejects invalid bazi result shape', () => {
        expect(() => validateImportRecords([
            {
                engineType: 'bazi',
                result: {
                    id: 'bazi-1',
                    createdAt: '2026-03-05T08:00:00.000Z',
                    fourPillars: ['辛巳'],
                    daYun: [],
                },
            },
        ])).toThrow('第1条记录格式无效：八字结果结构非法');
    });

    it('rejects incomplete bazi backups missing render-critical fields', () => {
        expect(() => validateImportRecords([
            {
                engineType: 'bazi',
                result: {
                    id: 'bazi-2',
                    createdAt: '2026-03-05T08:00:00.000Z',
                    gender: 1,
                    fourPillars: ['辛巳', '辛卯', '己巳', '壬申'],
                    daYun: [],
                    xiaoYun: [],
                    currentDaYunIndex: -1,
                    shiShen: [{}, {}, {}, {}],
                    cangGan: [{}, {}, {}, {}],
                },
            },
        ])).toThrow('第1条记录格式无效：八字结果结构非法');
    });

    it('rejects non-array input', () => {
        expect(() => validateImportRecords(null as unknown as any[]))
            .toThrow('导入数据格式无效：records 必须是数组');
    });
});
