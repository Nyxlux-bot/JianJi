import { normalizeStoredBaziResult } from '../core/bazi-normalize';
import { BaziResult } from '../core/bazi-types';
import { PanResult } from '../core/liuyao-calc';
import {
    DivinationEngine,
    DivinationRecordEnvelope,
    isDivinationMethod,
    isPanResult,
} from './record-types';

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
}

function assertCreatedAt(value: unknown, index: number): void {
    if (!isNonEmptyString(value) || Number.isNaN(Date.parse(value))) {
        throw new Error(`第${index + 1}条记录格式无效：缺少有效 createdAt`);
    }
}

function validateLiuyaoRecord(result: unknown, index: number): void {
    if (!isPanResult(result)) {
        throw new Error(`第${index + 1}条记录格式无效：缺少有效 benGua`);
    }
    if (!isDivinationMethod(result.method)) {
        throw new Error(`第${index + 1}条记录格式无效：缺少有效 method`);
    }
    assertCreatedAt(result.createdAt, index);
}

function validateBaziRecord(result: unknown, index: number): BaziResult {
    const normalized = normalizeStoredBaziResult(result);
    if (!normalized) {
        throw new Error(`第${index + 1}条记录格式无效：八字结果结构非法`);
    }
    assertCreatedAt(normalized.createdAt, index);
    return normalized;
}

function normalizeSummary(summary: unknown): DivinationRecordEnvelope['summary'] {
    if (!isObject(summary)) {
        return undefined;
    }
    return {
        method: typeof summary.method === 'string' ? summary.method : undefined,
        question: typeof summary.question === 'string' ? summary.question : undefined,
        title: typeof summary.title === 'string' ? summary.title : undefined,
        subtitle: typeof summary.subtitle === 'string' ? summary.subtitle : undefined,
    };
}

function assertEngineType(value: unknown, index: number): asserts value is DivinationEngine {
    if (value !== 'liuyao' && value !== 'bazi') {
        throw new Error(`第${index + 1}条记录格式无效：缺少有效 engineType`);
    }
}

function normalizeRecord(record: unknown, index: number): DivinationRecordEnvelope {
    if (!isObject(record)) {
        throw new Error(`第${index + 1}条记录格式无效：必须是对象`);
    }

    // v2: { engineType, result, summary? }
    if (Object.prototype.hasOwnProperty.call(record, 'engineType')) {
        assertEngineType(record.engineType, index);
        if (!isObject(record.result)) {
            throw new Error(`第${index + 1}条记录格式无效：缺少有效 result`);
        }
        if (record.engineType === 'liuyao') {
            validateLiuyaoRecord(record.result, index);
            const result = record.result as unknown as PanResult;
            return {
                engineType: 'liuyao',
                result,
                summary: normalizeSummary(record.summary),
            };
        }

        const result = validateBaziRecord(record.result, index);
        return {
            engineType: 'bazi',
            result,
            summary: normalizeSummary(record.summary),
        };
    }

    // v1: 直接导出的六爻 PanResult
    validateLiuyaoRecord(record, index);
    return {
        engineType: 'liuyao',
        result: record as unknown as PanResult,
    };
}

export function validateImportRecords(records: unknown[]): DivinationRecordEnvelope[] {
    if (!Array.isArray(records)) {
        throw new Error('导入数据格式无效：records 必须是数组');
    }

    return records.map((record, index) => {
        if (!isObject(record)) {
            throw new Error(`第${index + 1}条记录格式无效：必须是对象`);
        }
        if (Object.prototype.hasOwnProperty.call(record, 'engineType')) {
            if (!isObject(record.result) || !isNonEmptyString(record.result.id)) {
                throw new Error(`第${index + 1}条记录格式无效：缺少有效 id`);
            }
        } else if (!isNonEmptyString(record.id)) {
            throw new Error(`第${index + 1}条记录格式无效：缺少有效 id`);
        }
        return normalizeRecord(record, index);
    });
}
