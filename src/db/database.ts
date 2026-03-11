/**
 * 数据库操作封装
 * 原生端使用 expo-sqlite，Web 端降级使用 localStorage
 */

import { Platform } from 'react-native';
import { normalizeStoredBaziResult } from '../core/bazi-normalize';
import { BaziResult } from '../core/bazi-types';
import { PanResult } from '../core/liuyao-calc';
import { validateImportRecords } from './import-validation';
import { resolveImportAction } from './import-strategy';
import {
    buildSummaryFields,
    DivinationEngine,
    DivinationRecordEnvelope,
    DivinationResult,
    inferEngineFromResult,
    isDivinationMethod,
    isPanResult,
    RecordSummary,
} from './record-types';

// ==================== 类型定义 ====================

interface RecordRow {
    id: string;
    created_at: string;
    engine_type: string | null;
    method: string | null;
    question: string | null;
    title: string | null;
    subtitle: string | null;
    gua_name: string | null;
    bian_gua_name: string | null;
    is_favorite: number;
}

interface RecordDetailRow {
    engine_type: string | null;
    method: string | null;
    question: string | null;
    title: string | null;
    subtitle: string | null;
    full_result: string;
}

interface ExportRow extends RecordDetailRow {
    id: string;
}

export type RecordDetail =
    | { engineType: 'liuyao'; result: PanResult }
    | { engineType: 'bazi'; result: BaziResult };

export type ImportMode = 'merge' | 'replace';
export type ImportConflictPolicy = 'skip' | 'replace';

export interface ImportStats {
    inserted: number;
    updated: number;
    skipped: number;
}

export interface ImportOptions {
    mode?: ImportMode;
    conflictPolicy?: ImportConflictPolicy;
}

function normalizeEngineType(
    engineType: unknown,
    method: unknown,
    result: unknown
): DivinationEngine {
    if (engineType === 'liuyao' || engineType === 'bazi') {
        return engineType;
    }
    if (method === 'bazi') {
        return 'bazi';
    }
    if (isDivinationMethod(method)) {
        return 'liuyao';
    }
    if (result === null || result === undefined) {
        return 'liuyao';
    }
    return inferEngineFromResult(result);
}

function toMethodForStorage(engineType: DivinationEngine, method: string | undefined): string {
    if (engineType === 'bazi') {
        return method || 'bazi';
    }
    return method || '';
}

function toRecordSummary(row: RecordRow): RecordSummary {
    const engineType = normalizeEngineType(row.engine_type, row.method, null);
    const method = row.method || '';

    return {
        id: row.id,
        createdAt: row.created_at,
        engineType,
        method,
        question: row.question || '',
        title: row.title || row.gua_name || '',
        subtitle: row.subtitle || row.bian_gua_name || '',
        isFavorite: row.is_favorite === 1,
    };
}

function toRecordDetail(row: RecordDetailRow): RecordDetail | null {
    const parsed = JSON.parse(row.full_result) as unknown;
    const engineType = normalizeEngineType(row.engine_type, row.method, parsed);

    if (engineType === 'liuyao' && isPanResult(parsed)) {
        return { engineType, result: parsed };
    }
    if (engineType === 'bazi') {
        const normalized = normalizeStoredBaziResult(parsed);
        if (normalized) {
            return { engineType, result: normalized };
        }
    }
    return null;
}

function toEnvelope(row: ExportRow): DivinationRecordEnvelope | null {
    const detail = toRecordDetail(row);
    if (!detail) {
        return null;
    }
    return {
        engineType: detail.engineType,
        result: detail.result,
        summary: {
            method: row.method || undefined,
            question: row.question || '',
            title: row.title || '',
            subtitle: row.subtitle || '',
        },
    };
}

// ==================== Web 端 localStorage 实现 ====================

const WEB_STORAGE_KEY_V2 = 'divination_records_v2';
const WEB_STORAGE_KEY_V1 = 'liuyao_records';

interface WebRecord {
    id: string;
    createdAt: string;
    engineType: DivinationEngine;
    method: string;
    question: string;
    title: string;
    subtitle: string;
    fullResult: DivinationResult;
    isFavorite: boolean;
}

interface LegacyWebRecord {
    id: string;
    createdAt: string;
    method: string;
    question: string;
    guaName: string;
    bianGuaName: string;
    fullResult: unknown;
    isFavorite: boolean;
}

function setWebRecords(records: WebRecord[]): void {
    try {
        localStorage.setItem(WEB_STORAGE_KEY_V2, JSON.stringify(records));
    } catch (e) {
        console.warn('Web storage limit exceeded', e);
    }
}

function migrateLegacyWebRecords(): WebRecord[] {
    try {
        const legacyRaw = localStorage.getItem(WEB_STORAGE_KEY_V1);
        if (!legacyRaw) {
            return [];
        }
        const legacyParsed = JSON.parse(legacyRaw) as unknown;
        if (!Array.isArray(legacyParsed)) {
            return [];
        }

        const migrated: WebRecord[] = [];
        legacyParsed.forEach((item) => {
            const legacy = item as Partial<LegacyWebRecord>;
            if (!legacy || typeof legacy !== 'object') {
                return;
            }
            if (typeof legacy.id !== 'string' || typeof legacy.createdAt !== 'string') {
                return;
            }
            if (!isPanResult(legacy.fullResult)) {
                return;
            }
            migrated.push({
                id: legacy.id,
                createdAt: legacy.createdAt,
                engineType: 'liuyao',
                method: legacy.method || legacy.fullResult.method,
                question: legacy.question || legacy.fullResult.question || '',
                title: legacy.guaName || legacy.fullResult.benGua.fullName,
                subtitle: legacy.bianGuaName || legacy.fullResult.bianGua?.fullName || '',
                fullResult: legacy.fullResult,
                isFavorite: Boolean(legacy.isFavorite),
            });
        });

        migrated.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        setWebRecords(migrated);
        return migrated;
    } catch {
        return [];
    }
}

function getWebRecords(): WebRecord[] {
    try {
        const data = localStorage.getItem(WEB_STORAGE_KEY_V2);
        if (!data) {
            return migrateLegacyWebRecords();
        }
        const parsed = JSON.parse(data) as unknown;
        if (!Array.isArray(parsed)) {
            return migrateLegacyWebRecords();
        }

        return parsed
            .map((item) => item as Partial<WebRecord>)
            .filter((item) => (
                typeof item.id === 'string'
                && typeof item.createdAt === 'string'
                && (item.engineType === 'liuyao' || item.engineType === 'bazi')
                && typeof item.method === 'string'
                && typeof item.title === 'string'
                && typeof item.subtitle === 'string'
            ))
            .map((item) => ({
                id: item.id as string,
                createdAt: item.createdAt as string,
                engineType: item.engineType as DivinationEngine,
                method: item.method as string,
                question: typeof item.question === 'string' ? item.question : '',
                title: item.title as string,
                subtitle: item.subtitle as string,
                fullResult: item.fullResult as DivinationResult,
                isFavorite: Boolean(item.isFavorite),
            }));
    } catch {
        return migrateLegacyWebRecords();
    }
}

function toWebRecord(envelope: DivinationRecordEnvelope, isFavorite: boolean): WebRecord {
    const summary = buildSummaryFields(envelope);

    return {
        id: envelope.result.id,
        createdAt: envelope.result.createdAt,
        engineType: envelope.engineType,
        method: toMethodForStorage(envelope.engineType, summary.method),
        question: summary.question,
        title: summary.title,
        subtitle: summary.subtitle,
        fullResult: envelope.result,
        isFavorite,
    };
}

const webDb = {
    async save(envelope: DivinationRecordEnvelope): Promise<void> {
        const records = getWebRecords();
        const index = records.findIndex((record) => record.id === envelope.result.id);
        const favorite = index >= 0 ? records[index].isFavorite : false;
        const nextRecord = toWebRecord(envelope, favorite);

        if (index >= 0) {
            records[index] = nextRecord;
        } else {
            records.unshift(nextRecord);
        }

        records.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        setWebRecords(records);
    },

    async replace(oldId: string, envelope: DivinationRecordEnvelope): Promise<void> {
        const records = getWebRecords();
        const oldRecord = records.find((record) => record.id === oldId);
        const sameIdIndex = records.findIndex((record) => record.id === envelope.result.id);
        const inheritedFavorite = oldRecord?.isFavorite ?? (sameIdIndex >= 0 ? records[sameIdIndex].isFavorite : false);
        const nextRecord = toWebRecord(envelope, inheritedFavorite);
        const filtered = records.filter((record) => record.id !== oldId && record.id !== envelope.result.id);

        filtered.unshift(nextRecord);
        filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        setWebRecords(filtered);
    },

    async getAll(): Promise<RecordSummary[]> {
        return getWebRecords()
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .map((record) => ({
                id: record.id,
                createdAt: record.createdAt,
                engineType: record.engineType,
                method: record.method || undefined,
                question: record.question,
                title: record.title,
                subtitle: record.subtitle,
                isFavorite: record.isFavorite,
            }));
    },

    async get(id: string): Promise<RecordDetail | null> {
        const record = getWebRecords().find((item) => item.id === id);
        if (!record) {
            return null;
        }
        if (record.engineType === 'liuyao' && isPanResult(record.fullResult)) {
            return {
                engineType: 'liuyao',
                result: record.fullResult,
            };
        }
        if (record.engineType === 'bazi') {
            const normalized = normalizeStoredBaziResult(record.fullResult);
            if (normalized) {
                return {
                    engineType: 'bazi',
                    result: normalized,
                };
            }
        }
        return null;
    },

    async delete(id: string): Promise<void> {
        const records = getWebRecords().filter((record) => record.id !== id);
        setWebRecords(records);
    },

    async toggleFav(id: string): Promise<void> {
        const records = getWebRecords();
        const record = records.find((item) => item.id === id);
        if (!record) {
            return;
        }
        record.isFavorite = !record.isFavorite;
        setWebRecords(records);
    },

    async exportAll(): Promise<DivinationRecordEnvelope[]> {
        const exported: DivinationRecordEnvelope[] = [];

        getWebRecords().forEach((record) => {
            if (record.engineType === 'bazi') {
                const normalized = normalizeStoredBaziResult(record.fullResult);
                if (!normalized) {
                    return;
                }
                exported.push({
                    engineType: 'bazi',
                    result: normalized,
                    summary: {
                        method: record.method || undefined,
                        question: record.question,
                        title: record.title,
                        subtitle: record.subtitle,
                    },
                });
                return;
            }

            if (!isPanResult(record.fullResult)) {
                return;
            }

            exported.push({
                engineType: 'liuyao',
                result: record.fullResult,
                summary: {
                    method: record.method || undefined,
                    question: record.question,
                    title: record.title,
                    subtitle: record.subtitle,
                },
            });
        });

        return exported;
    },

    async importAll(records: DivinationRecordEnvelope[], options: ImportOptions = {}): Promise<ImportStats> {
        const mode = options.mode || 'merge';
        const conflictPolicy = options.conflictPolicy || 'replace';
        const validated = validateImportRecords(records as unknown[]);
        const sourceRecords = mode === 'replace' ? [] : getWebRecords();
        const nextRecords = [...sourceRecords];
        const stats: ImportStats = { inserted: 0, updated: 0, skipped: 0 };
        const indexById = new Map(nextRecords.map((record, index) => [record.id, index]));

        for (const envelope of validated) {
            const existingIndex = indexById.get(envelope.result.id);
            const hasExisting = existingIndex !== undefined;
            const action = resolveImportAction(hasExisting, mode, conflictPolicy);

            if (action === 'skip') {
                stats.skipped += 1;
                continue;
            }

            if (action === 'update') {
                const index = existingIndex as number;
                const previous = nextRecords[index];
                nextRecords[index] = toWebRecord(envelope, mode === 'replace' ? false : previous.isFavorite);
                stats.updated += 1;
                continue;
            }

            nextRecords.push(toWebRecord(envelope, false));
            indexById.set(envelope.result.id, nextRecords.length - 1);
            stats.inserted += 1;
        }

        nextRecords.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        setWebRecords(nextRecords);
        return stats;
    },
};

// ==================== 原生端 SQLite 实现 ====================

let db: unknown = null;
let dbInitPromise: Promise<unknown> | null = null;

async function ensureNativeSchema(database: {
    getAllAsync: (sql: string, params?: unknown[]) => Promise<unknown[]>;
    runAsync: (sql: string, params?: unknown[]) => Promise<unknown>;
}): Promise<void> {
    const rows = await database.getAllAsync(`PRAGMA table_info(records)`);
    const columns = new Set(
        rows.map((row) => String((row as { name?: unknown }).name || ''))
    );

    const alterSql: string[] = [];
    if (!columns.has('engine_type')) {
        alterSql.push(`ALTER TABLE records ADD COLUMN engine_type TEXT DEFAULT 'liuyao'`);
    }
    if (!columns.has('title')) {
        alterSql.push(`ALTER TABLE records ADD COLUMN title TEXT DEFAULT ''`);
    }
    if (!columns.has('subtitle')) {
        alterSql.push(`ALTER TABLE records ADD COLUMN subtitle TEXT DEFAULT ''`);
    }

    for (const sql of alterSql) {
        await database.runAsync(sql);
    }

    await database.runAsync(
        `UPDATE records
         SET engine_type = CASE
             WHEN engine_type IS NULL OR engine_type = '' THEN
                 CASE
                     WHEN method = 'bazi' THEN 'bazi'
                     WHEN method IN ('time', 'coin', 'number', 'manual') THEN 'liuyao'
                     ELSE 'liuyao'
                 END
             ELSE engine_type
         END`
    );
    await database.runAsync(
        `UPDATE records
         SET title = CASE
             WHEN title IS NULL OR title = '' THEN COALESCE(gua_name, '')
             ELSE title
         END`
    );
    await database.runAsync(
        `UPDATE records
         SET subtitle = CASE
             WHEN subtitle IS NULL OR subtitle = '' THEN COALESCE(bian_gua_name, '')
             ELSE subtitle
         END`
    );
}

async function getNativeDatabase(): Promise<{
    runAsync: (sql: string, params?: unknown[]) => Promise<unknown>;
    getAllAsync: (sql: string, params?: unknown[]) => Promise<unknown[]>;
    getFirstAsync: (sql: string, params?: unknown[]) => Promise<unknown>;
    withTransactionAsync: (fn: () => Promise<void>) => Promise<void>;
}> {
    if (db) {
        return db as {
            runAsync: (sql: string, params?: unknown[]) => Promise<unknown>;
            getAllAsync: (sql: string, params?: unknown[]) => Promise<unknown[]>;
            getFirstAsync: (sql: string, params?: unknown[]) => Promise<unknown>;
            withTransactionAsync: (fn: () => Promise<void>) => Promise<void>;
        };
    }

    if (!dbInitPromise) {
        dbInitPromise = (async () => {
            const SQLite = require('expo-sqlite');
            const database = await SQLite.openDatabaseAsync('liuyao.db');
            await database.execAsync(`
                CREATE TABLE IF NOT EXISTS records (
                  id TEXT PRIMARY KEY NOT NULL,
                  created_at TEXT NOT NULL,
                  engine_type TEXT DEFAULT 'liuyao',
                  method TEXT DEFAULT '',
                  question TEXT DEFAULT '',
                  title TEXT DEFAULT '',
                  subtitle TEXT DEFAULT '',
                  gua_name TEXT DEFAULT '',
                  bian_gua_name TEXT DEFAULT '',
                  full_result TEXT NOT NULL,
                  is_favorite INTEGER DEFAULT 0
                );
                CREATE INDEX IF NOT EXISTS idx_created_at ON records(created_at);
            `);
            await ensureNativeSchema(database);
            db = database;
            return database;
        })();
    }

    return dbInitPromise as Promise<{
        runAsync: (sql: string, params?: unknown[]) => Promise<unknown>;
        getAllAsync: (sql: string, params?: unknown[]) => Promise<unknown[]>;
        getFirstAsync: (sql: string, params?: unknown[]) => Promise<unknown>;
        withTransactionAsync: (fn: () => Promise<void>) => Promise<void>;
    }>;
}

const nativeDb = {
    async save(envelope: DivinationRecordEnvelope): Promise<void> {
        const database = await getNativeDatabase();
        const summary = buildSummaryFields(envelope);
        const method = toMethodForStorage(envelope.engineType, summary.method);
        const question = summary.question;
        const title = summary.title;
        const subtitle = summary.subtitle;

        await database.runAsync(
            `INSERT OR REPLACE INTO records (
                id, created_at, engine_type, method, question, title, subtitle, gua_name, bian_gua_name, full_result, is_favorite
             ) VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT is_favorite FROM records WHERE id = ?), 0)
             )`,
            [
                envelope.result.id,
                envelope.result.createdAt,
                envelope.engineType,
                method,
                question,
                title,
                subtitle,
                title,
                subtitle,
                JSON.stringify(envelope.result),
                envelope.result.id,
            ]
        );
    },

    async replace(oldId: string, envelope: DivinationRecordEnvelope): Promise<void> {
        const database = await getNativeDatabase();
        const summary = buildSummaryFields(envelope);
        const method = toMethodForStorage(envelope.engineType, summary.method);
        const question = summary.question;
        const title = summary.title;
        const subtitle = summary.subtitle;

        await database.withTransactionAsync(async () => {
            const oldFavoriteRow = await database.getFirstAsync(
                `SELECT is_favorite FROM records WHERE id = ?`,
                [oldId]
            ) as { is_favorite: number } | null;
            const newFavoriteRow = await database.getFirstAsync(
                `SELECT is_favorite FROM records WHERE id = ?`,
                [envelope.result.id]
            ) as { is_favorite: number } | null;
            const favoriteValue = oldFavoriteRow?.is_favorite ?? newFavoriteRow?.is_favorite ?? 0;

            await database.runAsync(
                `INSERT OR REPLACE INTO records (
                    id, created_at, engine_type, method, question, title, subtitle, gua_name, bian_gua_name, full_result, is_favorite
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    envelope.result.id,
                    envelope.result.createdAt,
                    envelope.engineType,
                    method,
                    question,
                    title,
                    subtitle,
                    title,
                    subtitle,
                    JSON.stringify(envelope.result),
                    favoriteValue,
                ]
            );

            if (oldId !== envelope.result.id) {
                await database.runAsync(`DELETE FROM records WHERE id = ?`, [oldId]);
            }
        });
    },

    async getAll(): Promise<RecordSummary[]> {
        const database = await getNativeDatabase();
        const rows = await database.getAllAsync(
            `SELECT id, created_at, engine_type, method, question, title, subtitle, gua_name, bian_gua_name, is_favorite
             FROM records ORDER BY created_at DESC`
        );
        return (rows as RecordRow[]).map((row) => toRecordSummary(row));
    },

    async get(id: string): Promise<RecordDetail | null> {
        const database = await getNativeDatabase();
        const row = await database.getFirstAsync(
            `SELECT engine_type, method, question, title, subtitle, full_result FROM records WHERE id = ?`,
            [id]
        );
        if (!row) {
            return null;
        }
        return toRecordDetail(row as RecordDetailRow);
    },

    async delete(id: string): Promise<void> {
        const database = await getNativeDatabase();
        await database.runAsync(`DELETE FROM records WHERE id = ?`, [id]);
    },

    async toggleFav(id: string): Promise<void> {
        const database = await getNativeDatabase();
        await database.runAsync(
            `UPDATE records SET is_favorite = CASE WHEN is_favorite = 1 THEN 0 ELSE 1 END WHERE id = ?`,
            [id]
        );
    },

    async exportAll(): Promise<DivinationRecordEnvelope[]> {
        const database = await getNativeDatabase();
        const results: DivinationRecordEnvelope[] = [];
        const limit = 50;
        let offset = 0;

        while (true) {
            const rows = await database.getAllAsync(
                `SELECT id, engine_type, method, question, title, subtitle, full_result
                 FROM records ORDER BY created_at DESC LIMIT ? OFFSET ?`,
                [limit, offset]
            );

            if (!rows || rows.length === 0) {
                break;
            }

            for (const row of rows as ExportRow[]) {
                const envelope = toEnvelope(row);
                if (envelope) {
                    results.push(envelope);
                }
            }
            offset += limit;
        }

        return results;
    },

    async importAll(records: DivinationRecordEnvelope[], options: ImportOptions = {}): Promise<ImportStats> {
        const mode = options.mode || 'merge';
        const conflictPolicy = options.conflictPolicy || 'replace';
        const database = await getNativeDatabase();
        const validated = validateImportRecords(records as unknown[]);
        const stats: ImportStats = { inserted: 0, updated: 0, skipped: 0 };

        await database.withTransactionAsync(async () => {
            if (mode === 'replace') {
                await database.runAsync(`DELETE FROM records`);
            }

            for (const envelope of validated) {
                const existing = await database.getFirstAsync(
                    `SELECT is_favorite FROM records WHERE id = ?`,
                    [envelope.result.id]
                ) as { is_favorite: number } | null;

                const action = resolveImportAction(Boolean(existing), mode, conflictPolicy);
                if (action === 'skip') {
                    stats.skipped += 1;
                    continue;
                }

                const summary = buildSummaryFields(envelope);
                const favoriteValue = mode === 'replace' ? 0 : (existing?.is_favorite ?? 0);
                await database.runAsync(
                    `INSERT OR REPLACE INTO records (
                        id, created_at, engine_type, method, question, title, subtitle, gua_name, bian_gua_name, full_result, is_favorite
                     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        envelope.result.id,
                        envelope.result.createdAt,
                        envelope.engineType,
                        toMethodForStorage(envelope.engineType, summary.method),
                        summary.question,
                        summary.title,
                        summary.subtitle,
                        summary.title,
                        summary.subtitle,
                        JSON.stringify(envelope.result),
                        favoriteValue,
                    ]
                );

                if (action === 'update') {
                    stats.updated += 1;
                } else {
                    stats.inserted += 1;
                }
            }
        });

        return stats;
    },
};

// ==================== 统一导出接口 ====================

const isWeb = Platform.OS === 'web';
const storage = isWeb ? webDb : nativeDb;

/** 保存排盘记录 */
export async function saveRecord(payload: DivinationRecordEnvelope): Promise<void> {
    return storage.save(payload);
}

/** 用新结果覆盖旧记录，并继承旧收藏状态 */
export async function replaceRecord(oldId: string, payload: DivinationRecordEnvelope): Promise<void> {
    if (oldId === payload.result.id) {
        return storage.save(payload);
    }
    return storage.replace(oldId, payload);
}

/** 获取所有记录（按时间降序） */
export async function getAllRecords(): Promise<RecordSummary[]> {
    return storage.getAll();
}

/** 获取单条记录详情 */
export async function getRecord(id: string): Promise<RecordDetail | null> {
    return storage.get(id);
}

/** 删除记录 */
export async function deleteRecord(id: string): Promise<void> {
    return storage.delete(id);
}

/** 切换收藏状态 */
export async function toggleFavorite(id: string): Promise<void> {
    return storage.toggleFav(id);
}

/** 全量导出排盘数据 (用于备份) */
export async function exportAllRecords(): Promise<DivinationRecordEnvelope[]> {
    return storage.exportAll();
}

/** 批量导入排盘数据 (用于恢复，支持 merge/replace 模式) */
export async function importRecords(
    records: DivinationRecordEnvelope[],
    options: ImportOptions = {}
): Promise<ImportStats> {
    return storage.importAll(records, options);
}

export type { DivinationEngine, DivinationRecordEnvelope, RecordSummary } from './record-types';
