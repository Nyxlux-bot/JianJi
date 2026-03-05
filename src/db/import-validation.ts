import { PanResult } from '../core/liuyao-calc';

const VALID_METHODS = new Set(['time', 'coin', 'number', 'manual']);

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
}

function assertRecordShape(record: unknown, index: number): asserts record is Record<string, unknown> {
    if (!isObject(record)) {
        throw new Error(`第${index + 1}条记录格式无效：必须是对象`);
    }

    if (!isNonEmptyString(record.id)) {
        throw new Error(`第${index + 1}条记录格式无效：缺少有效 id`);
    }

    if (!isNonEmptyString(record.createdAt) || Number.isNaN(Date.parse(record.createdAt))) {
        throw new Error(`第${index + 1}条记录格式无效：缺少有效 createdAt`);
    }

    if (!isNonEmptyString(record.method) || !VALID_METHODS.has(record.method)) {
        throw new Error(`第${index + 1}条记录格式无效：缺少有效 method`);
    }

    if (!isObject(record.benGua) || !isNonEmptyString(record.benGua.fullName)) {
        throw new Error(`第${index + 1}条记录格式无效：缺少有效 benGua`);
    }

    if (record.bianGua !== undefined) {
        if (!isObject(record.bianGua) || !isNonEmptyString(record.bianGua.fullName)) {
            throw new Error(`第${index + 1}条记录格式无效：bianGua 结构非法`);
        }
    }
}

function normalizeRecord(record: Record<string, unknown>): PanResult {
    return {
        ...record,
        question: typeof record.question === 'string' ? record.question : '',
    } as PanResult;
}

export function validateImportRecords(records: unknown[]): PanResult[] {
    if (!Array.isArray(records)) {
        throw new Error('导入数据格式无效：records 必须是数组');
    }

    return records.map((record, index) => {
        assertRecordShape(record, index);
        return normalizeRecord(record);
    });
}
