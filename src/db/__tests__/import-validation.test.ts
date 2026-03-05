import { validateImportRecords } from '../import-validation';

describe('validateImportRecords', () => {
    const validRecord = {
        id: 'rec-1',
        createdAt: '2026-03-05T08:00:00.000Z',
        method: 'time',
        question: '测试',
        benGua: {
            fullName: '乾为天',
        },
    };

    it('accepts valid backup records', () => {
        const result = validateImportRecords([validRecord]);
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('rec-1');
    });

    it('rejects records with invalid method', () => {
        expect(() => validateImportRecords([
            { ...validRecord, method: 'invalid' }
        ])).toThrow('第1条记录格式无效：缺少有效 method');
    });

    it('rejects records without benGua.fullName', () => {
        expect(() => validateImportRecords([
            { ...validRecord, benGua: {} }
        ])).toThrow('第1条记录格式无效：缺少有效 benGua');
    });

    it('rejects non-array input', () => {
        expect(() => validateImportRecords(null as unknown as any[]))
            .toThrow('导入数据格式无效：records 必须是数组');
    });
});
