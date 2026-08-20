import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import appConfig from '../../app.json';

type DiagnosticLogLevel = 'info' | 'warn' | 'error';

interface DiagnosticLogEntry {
    timestamp: string;
    level: DiagnosticLogLevel;
    source: string;
    message: string;
    context?: unknown;
    appVersion: string;
    platform: string;
}

const DIAGNOSTIC_LOG_STORAGE_KEY = 'diagnostic_logs_v1';
const MAX_LOG_ENTRIES = 200;
const MAX_CONTEXT_STRING_LENGTH = 500;
let diagnosticWriteQueue: Promise<void> = Promise.resolve();

const SENSITIVE_KEY_PATTERN = /^(apiKey|api_key|geocoderApiKey|authorization|token|accessToken|access_token|secret|password)$/i;

function sanitizeString(value: string): string {
    return value
        .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]')
        .replace(/sk-[A-Za-z0-9._-]+/g, 'sk-[REDACTED]')
        .slice(0, MAX_CONTEXT_STRING_LENGTH);
}

function sanitizeValue(value: unknown, depth = 0): unknown {
    if (value === null || value === undefined) {
        return value;
    }
    if (typeof value === 'string') {
        return sanitizeString(value);
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
        return value;
    }
    if (Array.isArray(value)) {
        if (depth >= 3) {
            return '[Array]';
        }
        return value.slice(0, 20).map((item) => sanitizeValue(item, depth + 1));
    }
    if (typeof value === 'object') {
        if (depth >= 3) {
            return '[Object]';
        }
        const sanitized: Record<string, unknown> = {};
        Object.entries(value as Record<string, unknown>).slice(0, 40).forEach(([key, item]) => {
            sanitized[key] = SENSITIVE_KEY_PATTERN.test(key) ? '[REDACTED]' : sanitizeValue(item, depth + 1);
        });
        return sanitized;
    }
    return String(value);
}

function getAppVersion(): string {
    return appConfig.expo.version || 'unknown';
}

function normalizeMessage(message: unknown): string {
    if (message instanceof Error) {
        return sanitizeString(message.message || message.name);
    }
    return sanitizeString(String(message || '未知错误'));
}

async function readLogEntries(): Promise<DiagnosticLogEntry[]> {
    const raw = await AsyncStorage.getItem(DIAGNOSTIC_LOG_STORAGE_KEY);
    if (!raw) {
        return [];
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
        return [];
    }

    return parsed.filter((item): item is DiagnosticLogEntry => (
        typeof item === 'object'
        && item !== null
        && typeof (item as DiagnosticLogEntry).timestamp === 'string'
        && ((item as DiagnosticLogEntry).level === 'info' || (item as DiagnosticLogEntry).level === 'warn' || (item as DiagnosticLogEntry).level === 'error')
        && typeof (item as DiagnosticLogEntry).source === 'string'
        && typeof (item as DiagnosticLogEntry).message === 'string'
    ));
}

export function recordDiagnosticLog(input: {
    level: DiagnosticLogLevel;
    source: string;
    message: unknown;
    context?: unknown;
}): Promise<void> {
    const nextEntry: DiagnosticLogEntry = {
        timestamp: new Date().toISOString(),
        level: input.level,
        source: sanitizeString(input.source),
        message: normalizeMessage(input.message),
        context: input.context === undefined ? undefined : sanitizeValue(input.context),
        appVersion: getAppVersion(),
        platform: Platform.OS,
    };
    const write = diagnosticWriteQueue.catch(() => undefined).then(async () => {
        try {
            const entries = await readLogEntries();
            const nextEntries = [...entries, nextEntry].slice(-MAX_LOG_ENTRIES);
            await AsyncStorage.setItem(DIAGNOSTIC_LOG_STORAGE_KEY, JSON.stringify(nextEntries));
        } catch (error) {
            console.warn('[diagnostics] failed to persist log', error);
        }
    });
    diagnosticWriteQueue = write;
    return write;
}

export async function exportDiagnosticLogFile(): Promise<void> {
    if (!(await Sharing.isAvailableAsync())) {
        throw new Error('当前设备不支持分享文件');
    }

    await diagnosticWriteQueue.catch(() => undefined);
    const logs = await readLogEntries();
    const payload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        app: {
            name: appConfig.expo.name || '见机',
            version: getAppVersion(),
            platform: Platform.OS,
        },
        meta: {
            logCount: logs.length,
            maxLogEntries: MAX_LOG_ENTRIES,
            message: logs.length === 0 ? '暂无故障记录' : undefined,
        },
        logs,
    };
    const fileName = `jianji_diagnostic_log_${Date.now()}.json`;
    const fileUri = `${FileSystem.documentDirectory}${fileName}`;

    await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(payload, null, 2), { encoding: FileSystem.EncodingType.UTF8 });
    await Sharing.shareAsync(fileUri, {
        mimeType: 'application/json',
        dialogTitle: '导出故障日志',
        UTI: 'public.json',
    });
}
