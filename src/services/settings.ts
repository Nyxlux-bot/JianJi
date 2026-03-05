/**
 * 设置存储服务
 * 使用 AsyncStorage 持久化 AI 接口配置和提示词
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_SYSTEM_PROMPT, CURRENT_PROMPT_VERSION } from './default-prompts';

const KEYS = {
    API_URL: 'settings_api_url',
    API_KEY: 'settings_api_key',
    MODEL: 'settings_model',
    SYSTEM_PROMPT: 'settings_system_prompt',
    AI_UNLOCKED: 'settings_ai_unlocked',
    PROMPT_VERSION: 'settings_prompt_version',
    PROMPT_IS_CUSTOM: 'settings_prompt_is_custom',
};

export interface AISettings {
    apiUrl: string;
    apiKey: string;
    model: string;
    systemPrompt: string;
    aiSettingsUnlocked: boolean; // 新增隐藏标记
    promptVersion: number;
    promptIsCustom: boolean;
}

export const DEFAULT_SETTINGS: AISettings = {
    apiUrl: 'https://api.openai.com/v1/chat/completions',
    apiKey: '',
    model: 'gpt-4o',
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    aiSettingsUnlocked: false, // 默认锁定
    promptVersion: CURRENT_PROMPT_VERSION,
    promptIsCustom: false,
};

/** 获取全部设置 */
export async function getSettings(): Promise<AISettings> {
    try {
        const [apiUrl, apiKey, model, systemPrompt, unlocked, pVersionStr, pCustomStr] = await Promise.all([
            AsyncStorage.getItem(KEYS.API_URL).catch(() => null),
            AsyncStorage.getItem(KEYS.API_KEY).catch(() => null),
            AsyncStorage.getItem(KEYS.MODEL).catch(() => null),
            AsyncStorage.getItem(KEYS.SYSTEM_PROMPT).catch(() => null),
            AsyncStorage.getItem(KEYS.AI_UNLOCKED).catch(() => null),
            AsyncStorage.getItem(KEYS.PROMPT_VERSION).catch(() => null),
            AsyncStorage.getItem(KEYS.PROMPT_IS_CUSTOM).catch(() => null),
        ]);

        const storedPrompt = systemPrompt || DEFAULT_SETTINGS.systemPrompt;
        const parsedVersion = pVersionStr ? parseInt(pVersionStr, 10) : NaN;
        let pVersion = Number.isFinite(parsedVersion) && parsedVersion > 0 ? parsedVersion : 1;

        // 历史兼容：当旧版本没有 promptIsCustom 标志时，按内容是否等于默认串推断
        const inferredCustom = pCustomStr === null
            ? storedPrompt.trim() !== DEFAULT_SETTINGS.systemPrompt.trim()
            : pCustomStr === 'true';

        let finalSystemPrompt = storedPrompt;
        let isCustom = inferredCustom;

        // 如果用户未自定义 Prompt，且版本落后，则自动升级为最新版默认 Prompt
        if (!isCustom && pVersion < CURRENT_PROMPT_VERSION) {
            finalSystemPrompt = DEFAULT_SETTINGS.systemPrompt;
            pVersion = CURRENT_PROMPT_VERSION;
            isCustom = false;

            await Promise.allSettled([
                AsyncStorage.setItem(KEYS.SYSTEM_PROMPT, finalSystemPrompt),
                AsyncStorage.setItem(KEYS.PROMPT_VERSION, pVersion.toString()),
                AsyncStorage.setItem(KEYS.PROMPT_IS_CUSTOM, 'false'),
            ]);
        }

        return {
            apiUrl: apiUrl || DEFAULT_SETTINGS.apiUrl,
            apiKey: apiKey || DEFAULT_SETTINGS.apiKey,
            model: model || DEFAULT_SETTINGS.model,
            systemPrompt: finalSystemPrompt,
            aiSettingsUnlocked: unlocked === 'true',
            promptVersion: pVersion,
            promptIsCustom: isCustom,
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
        AsyncStorage.setItem(KEYS.SYSTEM_PROMPT, settings.systemPrompt),
        AsyncStorage.setItem(KEYS.PROMPT_VERSION, settings.promptVersion.toString()),
        AsyncStorage.setItem(KEYS.PROMPT_IS_CUSTOM, settings.promptIsCustom.toString()),
    ]);
}

/** 专门触发展示隐藏模块 */
export async function unlockAISettings(): Promise<void> {
    try {
        await AsyncStorage.setItem(KEYS.AI_UNLOCKED, 'true');
    } catch { }
}

/** 专门锁上隐藏模块 */
export async function lockAISettings(): Promise<void> {
    try {
        await AsyncStorage.setItem(KEYS.AI_UNLOCKED, 'false');
    } catch { }
}

/** 检查 AI 是否已配置 */
export async function isAIConfigured(): Promise<boolean> {
    const settings = await getSettings();
    return settings.apiKey.length > 0 && settings.apiUrl.length > 0;
}
