import AsyncStorage from '@react-native-async-storage/async-storage';
import { CURRENT_PROMPT_VERSION } from '../default-prompts';
import { DEFAULT_SETTINGS, getSettings, saveSettings } from '../settings';

jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
}));

const KEYS = {
    API_URL: 'settings_api_url',
    API_KEY: 'settings_api_key',
    MODEL: 'settings_model',
    SYSTEM_PROMPT: 'settings_system_prompt',
    AI_UNLOCKED: 'settings_ai_unlocked',
    PROMPT_VERSION: 'settings_prompt_version',
    PROMPT_IS_CUSTOM: 'settings_prompt_is_custom',
};

describe('settings service', () => {
    const storage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
    const values = new Map<string, string | null>();

    beforeEach(() => {
        jest.clearAllMocks();
        values.clear();

        storage.getItem.mockImplementation(async (key: string) => (
            values.has(key) ? values.get(key)! : null
        ));
        storage.setItem.mockResolvedValue();
    });

    it('keeps legacy custom prompt when custom flag is missing', async () => {
        const customPrompt = '这是用户自定义提示词';
        values.set(KEYS.SYSTEM_PROMPT, customPrompt);
        values.set(KEYS.PROMPT_VERSION, '1');
        values.set(KEYS.PROMPT_IS_CUSTOM, null);

        const settings = await getSettings();

        expect(settings.systemPrompt).toBe(customPrompt);
        expect(settings.promptIsCustom).toBe(true);
        expect(storage.setItem).not.toHaveBeenCalled();
    });

    it('auto upgrades only default prompt when version is outdated', async () => {
        values.set(KEYS.SYSTEM_PROMPT, DEFAULT_SETTINGS.systemPrompt);
        values.set(KEYS.PROMPT_VERSION, '1');
        values.set(KEYS.PROMPT_IS_CUSTOM, 'false');

        const settings = await getSettings();

        expect(settings.promptVersion).toBe(CURRENT_PROMPT_VERSION);
        expect(settings.promptIsCustom).toBe(false);
        expect(storage.setItem).toHaveBeenCalledWith(KEYS.SYSTEM_PROMPT, DEFAULT_SETTINGS.systemPrompt);
        expect(storage.setItem).toHaveBeenCalledWith(KEYS.PROMPT_VERSION, String(CURRENT_PROMPT_VERSION));
        expect(storage.setItem).toHaveBeenCalledWith(KEYS.PROMPT_IS_CUSTOM, 'false');
    });

    it('propagates storage failures from saveSettings', async () => {
        storage.setItem.mockRejectedValueOnce(new Error('write failed'));

        await expect(saveSettings(DEFAULT_SETTINGS)).rejects.toThrow('write failed');
    });
});
