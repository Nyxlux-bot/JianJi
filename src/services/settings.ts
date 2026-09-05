/**
 * 设置存储服务
 * 使用 AsyncStorage 持久化 AI 接口配置
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AIProviderProtocolPreference } from './ai-provider-types';

const KEYS = {
    API_URL: 'settings_api_url',
    API_KEY: 'settings_api_key',
    MODEL: 'settings_model',
    PROTOCOL: 'settings_ai_protocol',
    PROTOCOL_VERIFIED: 'settings_ai_protocol_verified',
    TEMPERATURE: 'settings_temperature',
    GEOCODER_API_KEY: 'settings_geocoder_api_key',
    LIUYAO_SYSTEM_PROMPT: 'settings_prompt_liuyao_system',
    LIUYAO_PROMPT_VERSION: 'settings_prompt_liuyao_version',
    LIUYAO_PROMPT_IS_CUSTOM: 'settings_prompt_liuyao_is_custom',
    BAZI_SYSTEM_PROMPT: 'settings_prompt_bazi_system',
    BAZI_PROMPT_VERSION: 'settings_prompt_bazi_version',
    BAZI_PROMPT_IS_CUSTOM: 'settings_prompt_bazi_is_custom',
    LEGACY_SYSTEM_PROMPT: 'settings_system_prompt',
    LEGACY_AI_UNLOCKED: 'settings_ai_unlocked',
    LEGACY_PROMPT_VERSION: 'settings_prompt_version',
    LEGACY_PROMPT_IS_CUSTOM: 'settings_prompt_is_custom',
} as const;

const LEGACY_PROMPT_KEYS = [
    KEYS.LIUYAO_SYSTEM_PROMPT,
    KEYS.LIUYAO_PROMPT_VERSION,
    KEYS.LIUYAO_PROMPT_IS_CUSTOM,
    KEYS.BAZI_SYSTEM_PROMPT,
    KEYS.BAZI_PROMPT_VERSION,
    KEYS.BAZI_PROMPT_IS_CUSTOM,
    KEYS.LEGACY_SYSTEM_PROMPT,
    KEYS.LEGACY_AI_UNLOCKED,
    KEYS.LEGACY_PROMPT_VERSION,
    KEYS.LEGACY_PROMPT_IS_CUSTOM,
] as const;

export interface AISettings {
    apiUrl: string;
    apiKey: string;
    model: string;
    protocol: AIProviderProtocolPreference;
    protocolVerified: boolean;
    temperature: number;
    geocoderApiKey: string;
}

export const DEFAULT_SETTINGS: AISettings = {
    apiUrl: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'gpt-4o',
    protocol: 'responses',
    protocolVerified: false,
    temperature: 0.7,
    geocoderApiKey: '',
};

function normalizeTemperature(value: unknown, fallback = DEFAULT_SETTINGS.temperature): number {
    const numberValue = typeof value === 'number'
        ? value
        : (typeof value === 'string' ? Number(value) : NaN);
    if (!Number.isFinite(numberValue)) {
        return fallback;
    }
    return Math.max(0, Math.min(2, Number(numberValue.toFixed(2))));
}

function normalizeProtocol(value: unknown): AIProviderProtocolPreference {
    return value === 'anthropic_messages' ? 'anthropic_messages' : 'responses';
}

function normalizeProtocolVerified(value: unknown): boolean {
    return value === true || value === 'true';
}

export function mergeImportedSettings(rawSettings: unknown, currentSettings: AISettings): AISettings {
    if (!rawSettings || typeof rawSettings !== 'object') {
        return currentSettings;
    }

    const incoming = rawSettings as Record<string, unknown>;

    const apiUrl = typeof incoming.apiUrl === 'string' && incoming.apiUrl.trim().length > 0
        ? incoming.apiUrl
        : currentSettings.apiUrl;
    const apiKey = typeof incoming.apiKey === 'string' && incoming.apiKey.trim().length > 0
        ? incoming.apiKey
        : currentSettings.apiKey;
    const model = typeof incoming.model === 'string' && incoming.model.trim().length > 0
        ? incoming.model
        : currentSettings.model;
    const providerChanged = apiUrl.trim() !== currentSettings.apiUrl.trim()
        || apiKey.trim() !== currentSettings.apiKey.trim()
        || model.trim() !== currentSettings.model.trim();

    return {
        apiUrl,
        apiKey,
        model,
        protocol: providerChanged ? 'responses' : currentSettings.protocol,
        protocolVerified: providerChanged ? false : currentSettings.protocolVerified,
        temperature: normalizeTemperature(incoming.temperature, currentSettings.temperature),
        geocoderApiKey: typeof incoming.geocoderApiKey === 'string' && incoming.geocoderApiKey.trim().length > 0
            ? incoming.geocoderApiKey
            : currentSettings.geocoderApiKey,
    };
}

async function clearLegacyPromptStorage(): Promise<void> {
    await Promise.allSettled(LEGACY_PROMPT_KEYS.map((key) => AsyncStorage.removeItem(key)));
}

/** 获取全部设置 */
export async function getSettings(): Promise<AISettings> {
    try {
        const [apiUrl, apiKey, model, protocol, protocolVerified, temperature, geocoderApiKey] = await Promise.all([
            AsyncStorage.getItem(KEYS.API_URL).catch(() => null),
            AsyncStorage.getItem(KEYS.API_KEY).catch(() => null),
            AsyncStorage.getItem(KEYS.MODEL).catch(() => null),
            AsyncStorage.getItem(KEYS.PROTOCOL).catch(() => null),
            AsyncStorage.getItem(KEYS.PROTOCOL_VERIFIED).catch(() => null),
            AsyncStorage.getItem(KEYS.TEMPERATURE).catch(() => null),
            AsyncStorage.getItem(KEYS.GEOCODER_API_KEY).catch(() => null),
        ]);

        await clearLegacyPromptStorage();

        const isProtocolVerified = normalizeProtocolVerified(protocolVerified);
        const normalizedProtocol = isProtocolVerified ? normalizeProtocol(protocol) : 'responses';
        if (protocol !== normalizedProtocol || protocolVerified !== String(isProtocolVerified)) {
            try {
                await Promise.all([
                    AsyncStorage.setItem(KEYS.PROTOCOL, normalizedProtocol),
                    AsyncStorage.setItem(KEYS.PROTOCOL_VERIFIED, String(isProtocolVerified)),
                ]);
            } catch (error) {
                console.warn('[settings] failed to migrate AI protocol', error);
            }
        }

        return {
            apiUrl: apiUrl || DEFAULT_SETTINGS.apiUrl,
            apiKey: apiKey || DEFAULT_SETTINGS.apiKey,
            model: model || DEFAULT_SETTINGS.model,
            protocol: normalizedProtocol,
            protocolVerified: isProtocolVerified,
            temperature: normalizeTemperature(temperature),
            geocoderApiKey: geocoderApiKey || DEFAULT_SETTINGS.geocoderApiKey,
        };
    } catch {
        return DEFAULT_SETTINGS;
    }
}

/** 保存全部设置 */
export async function saveSettings(settings: AISettings): Promise<void> {
    const protocol = settings.protocolVerified ? normalizeProtocol(settings.protocol) : 'responses';
    await Promise.all([
        AsyncStorage.setItem(KEYS.API_URL, settings.apiUrl),
        AsyncStorage.setItem(KEYS.API_KEY, settings.apiKey),
        AsyncStorage.setItem(KEYS.MODEL, settings.model),
        AsyncStorage.setItem(KEYS.PROTOCOL, protocol),
        AsyncStorage.setItem(KEYS.PROTOCOL_VERIFIED, String(settings.protocolVerified)),
        AsyncStorage.setItem(KEYS.TEMPERATURE, String(normalizeTemperature(settings.temperature))),
        AsyncStorage.setItem(KEYS.GEOCODER_API_KEY, settings.geocoderApiKey),
        ...LEGACY_PROMPT_KEYS.map((key) => AsyncStorage.removeItem(key)),
    ]);
}

/** 检查 AI 是否已配置 */
export async function isAIConfigured(): Promise<boolean> {
    const settings = await getSettings();
    return settings.apiKey.length > 0 && settings.apiUrl.length > 0;
}
