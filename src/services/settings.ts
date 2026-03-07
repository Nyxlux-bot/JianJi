/**
 * 设置存储服务
 * 使用 AsyncStorage 持久化 AI 接口配置
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
    API_URL: 'settings_api_url',
    API_KEY: 'settings_api_key',
    MODEL: 'settings_model',
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
}

export const DEFAULT_SETTINGS: AISettings = {
    apiUrl: 'https://api.openai.com/v1/chat/completions',
    apiKey: '',
    model: 'gpt-4o',
};

async function clearLegacyPromptStorage(): Promise<void> {
    await Promise.allSettled(LEGACY_PROMPT_KEYS.map((key) => AsyncStorage.removeItem(key)));
}

/** 获取全部设置 */
export async function getSettings(): Promise<AISettings> {
    try {
        const [apiUrl, apiKey, model] = await Promise.all([
            AsyncStorage.getItem(KEYS.API_URL).catch(() => null),
            AsyncStorage.getItem(KEYS.API_KEY).catch(() => null),
            AsyncStorage.getItem(KEYS.MODEL).catch(() => null),
        ]);

        await clearLegacyPromptStorage();

        return {
            apiUrl: apiUrl || DEFAULT_SETTINGS.apiUrl,
            apiKey: apiKey || DEFAULT_SETTINGS.apiKey,
            model: model || DEFAULT_SETTINGS.model,
        };
    } catch {
        return DEFAULT_SETTINGS;
    }
}

/** 保存全部设置 */
export async function saveSettings(settings: AISettings): Promise<void> {
    await Promise.all([
        AsyncStorage.setItem(KEYS.API_URL, settings.apiUrl),
        AsyncStorage.setItem(KEYS.API_KEY, settings.apiKey),
        AsyncStorage.setItem(KEYS.MODEL, settings.model),
        ...LEGACY_PROMPT_KEYS.map((key) => AsyncStorage.removeItem(key)),
    ]);
}

/** 检查 AI 是否已配置 */
export async function isAIConfigured(): Promise<boolean> {
    const settings = await getSettings();
    return settings.apiKey.length > 0 && settings.apiUrl.length > 0;
}
