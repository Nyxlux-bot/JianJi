/**
 * 数据库操作封装
 * 原生端使用 expo-sqlite，Web 端降级使用 localStorage
 */

import { Platform } from 'react-native';
import { PanResult } from '../core/liuyao-calc';

// ==================== 类型定义 ====================

interface RecordRow {
    id: string;
    created_at: string;
    method: string;
    question: string;
    gua_name: string;
    bian_gua_name: string;
    is_favorite: number;
}

export interface RecordSummary {
    id: string;
    createdAt: string;
    method: string;
    question: string;
    guaName: string;
    bianGuaName: string;
    isFavorite: boolean;
}

export type ImportMode = 'merge' | 'replace';

// ==================== Web 端 localStorage 实现 ====================

const WEB_STORAGE_KEY = 'liuyao_records';

interface WebRecord {
    id: string;
    createdAt: string;
    method: string;
    question: string;
    guaName: string;
    bianGuaName: string;
    fullResult: PanResult;
    isFavorite: boolean;
}

function getWebRecords(): WebRecord[] {
    try {
        const data = localStorage.getItem(WEB_STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
}

function setWebRecords(records: WebRecord[]): void {
    try {
        localStorage.setItem(WEB_STORAGE_KEY, JSON.stringify(records));
    } catch (e) {
        console.warn('Web storage limit exceeded', e);
    }
}

function mergeWebRecord(records: WebRecord[], res: PanResult): void {
    const existing = records.findIndex(r => r.id === res.id);
    const rec: WebRecord = {
        id: res.id,
        createdAt: res.createdAt,
        method: res.method,
        question: res.question,
        guaName: res.benGua.fullName,
        bianGuaName: res.bianGua?.fullName || '',
        fullResult: res,
        isFavorite: false,
    };
    if (existing >= 0) {
        records[existing] = { ...rec, isFavorite: records[existing].isFavorite };
    } else {
        records.unshift(rec);
    }
}

const webDb = {
    async save(result: PanResult): Promise<void> {
        const records = getWebRecords();
        mergeWebRecord(records, result);
        setWebRecords(records);
    },
    async getAll(): Promise<RecordSummary[]> {
        return getWebRecords()
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .map(r => ({
                id: r.id,
                createdAt: r.createdAt,
                method: r.method,
                question: r.question,
                guaName: r.guaName,
                bianGuaName: r.bianGuaName,
                isFavorite: r.isFavorite,
            }));
    },
    async get(id: string): Promise<PanResult | null> {
        const rec = getWebRecords().find(r => r.id === id);
        return rec ? rec.fullResult : null;
    },
    async delete(id: string): Promise<void> {
        setWebRecords(getWebRecords().filter(r => r.id !== id));
    },
    async toggleFav(id: string): Promise<void> {
        const records = getWebRecords();
        const rec = records.find(r => r.id === id);
        if (rec) {
            rec.isFavorite = !rec.isFavorite;
            setWebRecords(records);
        }
    },
    async exportAll(): Promise<PanResult[]> {
        return getWebRecords().map(r => r.fullResult);
    },
    async importAll(results: PanResult[], mode: ImportMode = 'merge'): Promise<void> {
        let records = mode === 'replace' ? [] : getWebRecords();
        for (const res of results) {
            mergeWebRecord(records, res);
        }
        setWebRecords(records);
    }
};

// ==================== 原生端 SQLite 实现 ====================

let db: any = null;
let dbInitPromise: Promise<any> | null = null;

async function getNativeDatabase(): Promise<any> {
    if (db) return db;
    if (!dbInitPromise) {
        dbInitPromise = (async () => {
            const SQLite = require('expo-sqlite');
            db = await SQLite.openDatabaseAsync('liuyao.db');
            await db.execAsync(`
                CREATE TABLE IF NOT EXISTS records (
                  id TEXT PRIMARY KEY NOT NULL,
                  created_at TEXT NOT NULL,
                  method TEXT NOT NULL,
                  question TEXT DEFAULT '',
                  gua_name TEXT NOT NULL,
                  bian_gua_name TEXT DEFAULT '',
                  full_result TEXT NOT NULL,
                  is_favorite INTEGER DEFAULT 0
                );
                CREATE INDEX IF NOT EXISTS idx_created_at ON records(created_at);
            `);
            return db;
        })();
    }
    return dbInitPromise;
}

const nativeDb = {
    async save(result: PanResult): Promise<void> {
        const database = await getNativeDatabase();
        await database.runAsync(
            `INSERT OR REPLACE INTO records (id, created_at, method, question, gua_name, bian_gua_name, full_result, is_favorite)
             VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
            [
                result.id,
                result.createdAt,
                result.method,
                result.question,
                result.benGua.fullName,
                result.bianGua?.fullName || '',
                JSON.stringify(result),
            ]
        );
    },
    async getAll(): Promise<RecordSummary[]> {
        const database = await getNativeDatabase();
        const rows = await database.getAllAsync(
            `SELECT id, created_at, method, question, gua_name, bian_gua_name, is_favorite
             FROM records ORDER BY created_at DESC`
        );
        return (rows as RecordRow[]).map(row => ({
            id: row.id,
            createdAt: row.created_at,
            method: row.method,
            question: row.question,
            guaName: row.gua_name,
            bianGuaName: row.bian_gua_name,
            isFavorite: row.is_favorite === 1,
        }));
    },
    async get(id: string): Promise<PanResult | null> {
        const database = await getNativeDatabase();
        const row = await database.getFirstAsync(
            `SELECT full_result FROM records WHERE id = ?`,
            [id]
        );
        if (!row) return null;
        return JSON.parse((row as { full_result: string }).full_result) as PanResult;
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
    async exportAll(): Promise<PanResult[]> {
        const database = await getNativeDatabase();
        const results: PanResult[] = [];
        const limit = 50; // 分页游标，避免一次性过桥拉爆内存
        let offset = 0;

        while (true) {
            const rows: any[] = await database.getAllAsync(
                `SELECT full_result FROM records LIMIT ? OFFSET ?`,
                [limit, offset]
            );

            if (!rows || rows.length === 0) break;

            for (const row of rows) {
                results.push(JSON.parse(row.full_result));
            }
            offset += limit;
        }
        return results;
    },
    async importAll(results: PanResult[], mode: ImportMode = 'merge'): Promise<void> {
        const database = await getNativeDatabase();
        if (mode === 'replace') {
            await database.runAsync(`DELETE FROM records`);
        }
        // 原生 SQLite 推荐使用异步串行避免卡顿死锁
        for (const res of results) {
            if (mode === 'replace') {
                await database.runAsync(
                    `INSERT OR REPLACE INTO records (id, created_at, method, question, gua_name, bian_gua_name, full_result, is_favorite)
                     VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
                    [
                        res.id,
                        res.createdAt,
                        res.method,
                        res.question,
                        res.benGua.fullName,
                        res.bianGua?.fullName || '',
                        JSON.stringify(res),
                    ]
                );
            } else {
                await database.runAsync(
                    `INSERT OR REPLACE INTO records (id, created_at, method, question, gua_name, bian_gua_name, full_result, is_favorite)
                     VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT is_favorite FROM records WHERE id = ?), 0))`,
                    [
                        res.id,
                        res.createdAt,
                        res.method,
                        res.question,
                        res.benGua.fullName,
                        res.bianGua?.fullName || '',
                        JSON.stringify(res),
                        res.id
                    ]
                );
            }
        }
    }
};

// ==================== 统一导出接口 ====================

const isWeb = Platform.OS === 'web';
const storage = isWeb ? webDb : nativeDb;

/** 保存排盘记录 */
export async function saveRecord(result: PanResult): Promise<void> {
    return storage.save(result);
}

/** 获取所有记录（按时间降序） */
export async function getAllRecords(): Promise<RecordSummary[]> {
    return storage.getAll();
}

/** 获取单条记录详情 */
export async function getRecord(id: string): Promise<PanResult | null> {
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
export async function exportAllRecords(): Promise<PanResult[]> {
    return storage.exportAll();
}

/** 批量导入排盘数据 (用于恢复，支持 merge/replace 模式) */
export async function importRecords(
    records: PanResult[],
    options: { mode?: ImportMode } = {}
): Promise<void> {
    return storage.importAll(records, options.mode || 'merge');
}
