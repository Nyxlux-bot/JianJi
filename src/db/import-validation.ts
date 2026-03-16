import { normalizeStoredBaziResult } from '../core/bazi-normalize';
import { BaziResult } from '../core/bazi-types';
import { PanResult } from '../core/liuyao-calc';
import { ZiweiRecordResult } from '../features/ziwei/record';
import { ZIWEI_SUPPORTED_TIMEZONE_OFFSET_MINUTES } from '../features/ziwei/runtime-meta';
import {
    DivinationEngine,
    DivinationRecordEnvelope,
    isDivinationMethod,
    isPanResult,
    isZiweiRecordResult,
} from './record-types';

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
}

function isPersistedAIChatMessageStruct(value: unknown): value is {
    role: 'user' | 'assistant';
    content: string;
    hidden?: boolean;
    requestContent?: string;
} {
    return isObject(value)
        && (value.role === 'user' || value.role === 'assistant')
        && typeof value.content === 'string'
        && (value.hidden === undefined || typeof value.hidden === 'boolean')
        && (value.requestContent === undefined || typeof value.requestContent === 'string');
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

function validateZiweiRecord(result: unknown, index: number): ZiweiRecordResult {
    if (isObject(result) && result.tzOffsetMinutes !== ZIWEI_SUPPORTED_TIMEZONE_OFFSET_MINUTES) {
        throw new Error(`第${index + 1}条记录格式无效：当前版本仅支持中国标准时区 UTC+8 的紫微记录`);
    }

    const sanitized = isObject(result) && Array.isArray(result.aiChatHistory)
        ? {
            ...result,
            aiChatHistory: result.aiChatHistory.filter((item) => isPersistedAIChatMessageStruct(item)),
        }
        : result;

    if (!isZiweiRecordResult(sanitized)) {
        throw new Error(`第${index + 1}条记录格式无效：紫微结果结构非法`);
    }
    assertCreatedAt(sanitized.createdAt, index);
    return sanitized;
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
    if (value !== 'liuyao' && value !== 'bazi' && value !== 'ziwei') {
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

        if (record.engineType === 'bazi') {
            const result = validateBaziRecord(record.result, index);
            return {
                engineType: 'bazi',
                result,
                summary: normalizeSummary(record.summary),
            };
        }

        const result = validateZiweiRecord(record.result, index);
        return {
            engineType: 'ziwei',
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
