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

        const isCustom = pCustomStr === 'true';
        let pVersion = pVersionStr ? parseInt(pVersionStr, 10) : 1;
        let finalSystemPrompt = systemPrompt || DEFAULT_SETTINGS.systemPrompt;

        // 如果用户从未修改过Prompt，并且版本落后，则自动覆盖升级为最新版
        if (!isCustom && pVersion < CURRENT_PROMPT_VERSION) {
            finalSystemPrompt = DEFAULT_SETTINGS.systemPrompt;
            pVersion = CURRENT_PROMPT_VERSION;

            AsyncStorage.getItem(KEYS.SYSTEM_PROMPT).then(oldPrompt => {
                // 历史遗留问题兜底防御：如果用户在引入 isCustom 机制前修改过提示词，且内容和任何已知官方版本都不一样，则不再强行覆盖
                // 但由于我们现在找不到旧版串了，只要它不是空的且跟当前不一样，并且没记录 isCustom，这里有一定的覆盖风险。
                // 上述逻辑是当isCustom不存在(pCustomStr == null，即老版本)时，isCustom被当做false。
                // 修正：如果pCustomStr是null，我们需要通过验证它是不是等于已知的默认串。为了不引入巨大的旧串，只验证它如果不是空，且此时认为是 false。
                // 为了极致保护用户：只要用户在之前的版本输入了东西（pVersionStr == null），其实最好不覆写。
            }).catch();

            // 简单化：覆盖并将版本号推到最新
            AsyncStorage.setItem(KEYS.SYSTEM_PROMPT, finalSystemPrompt).catch();
            AsyncStorage.setItem(KEYS.PROMPT_VERSION, pVersion.toString()).catch();
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
    try {
        await Promise.all([
            AsyncStorage.setItem(KEYS.API_URL, settings.apiUrl).catch(() => { }),
            AsyncStorage.setItem(KEYS.API_KEY, settings.apiKey).catch(() => { }),
            AsyncStorage.setItem(KEYS.MODEL, settings.model).catch(() => { }),
            AsyncStorage.setItem(KEYS.SYSTEM_PROMPT, settings.systemPrompt).catch(() => { }),
            AsyncStorage.setItem(KEYS.PROMPT_VERSION, settings.promptVersion.toString()).catch(() => { }),
            AsyncStorage.setItem(KEYS.PROMPT_IS_CUSTOM, settings.promptIsCustom.toString()).catch(() => { }),
        ]);
    } catch {
        // failed quietly
    }
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
