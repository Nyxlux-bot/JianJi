import AsyncStorage from '@react-native-async-storage/async-storage';
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
    LIUYAO_SYSTEM_PROMPT: 'settings_prompt_liuyao_system',
    LIUYAO_PROMPT_VERSION: 'settings_prompt_liuyao_version',
    LIUYAO_PROMPT_IS_CUSTOM: 'settings_prompt_liuyao_is_custom',
    BAZI_SYSTEM_PROMPT: 'settings_prompt_bazi_system',
    BAZI_PROMPT_VERSION: 'settings_prompt_bazi_version',
    BAZI_PROMPT_IS_CUSTOM: 'settings_prompt_bazi_is_custom',
    LEGACY_SYSTEM_PROMPT: 'settings_system_prompt',
    LEGACY_PROMPT_VERSION: 'settings_prompt_version',
    LEGACY_PROMPT_IS_CUSTOM: 'settings_prompt_is_custom',
    LEGACY_AI_UNLOCKED: 'settings_ai_unlocked',
} as const;

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
        storage.removeItem.mockResolvedValue();
    });

    it('returns API settings only and ignores stored prompt branches', async () => {
        values.set(KEYS.API_URL, 'https://example.com/v1/chat/completions');
        values.set(KEYS.API_KEY, 'abc');
        values.set(KEYS.MODEL, 'test-model');
        values.set(KEYS.LIUYAO_SYSTEM_PROMPT, '旧六爻提示词');
        values.set(KEYS.BAZI_SYSTEM_PROMPT, '旧八字提示词');

        const settings = await getSettings();

        expect(settings).toEqual({
            apiUrl: 'https://example.com/v1/chat/completions',
            apiKey: 'abc',
            model: 'test-model',
        });
        expect(storage.removeItem).toHaveBeenCalledWith(KEYS.LIUYAO_SYSTEM_PROMPT);
        expect(storage.removeItem).toHaveBeenCalledWith(KEYS.BAZI_SYSTEM_PROMPT);
    });

    it('falls back to defaults when no value exists', async () => {
        const settings = await getSettings();
        expect(settings).toEqual(DEFAULT_SETTINGS);
    });

    it('propagates storage failures from saveSettings', async () => {
        storage.setItem.mockRejectedValueOnce(new Error('write failed'));

        await expect(saveSettings(DEFAULT_SETTINGS)).rejects.toThrow('write failed');
    });

    it('writes only API settings and clears legacy prompt keys on save', async () => {
        await saveSettings(DEFAULT_SETTINGS);

        expect(storage.setItem).toHaveBeenCalledWith(KEYS.API_URL, DEFAULT_SETTINGS.apiUrl);
        expect(storage.setItem).toHaveBeenCalledWith(KEYS.API_KEY, DEFAULT_SETTINGS.apiKey);
        expect(storage.setItem).toHaveBeenCalledWith(KEYS.MODEL, DEFAULT_SETTINGS.model);
        expect(storage.removeItem).toHaveBeenCalledWith(KEYS.LIUYAO_SYSTEM_PROMPT);
        expect(storage.removeItem).toHaveBeenCalledWith(KEYS.BAZI_SYSTEM_PROMPT);
        expect(storage.removeItem).toHaveBeenCalledWith(KEYS.LEGACY_AI_UNLOCKED);
    });

    it('clears all legacy prompt storage keys when reading settings', async () => {
        await getSettings();

        expect(storage.removeItem).toHaveBeenCalledWith(KEYS.LIUYAO_PROMPT_VERSION);
        expect(storage.removeItem).toHaveBeenCalledWith(KEYS.LIUYAO_PROMPT_IS_CUSTOM);
        expect(storage.removeItem).toHaveBeenCalledWith(KEYS.BAZI_PROMPT_VERSION);
        expect(storage.removeItem).toHaveBeenCalledWith(KEYS.BAZI_PROMPT_IS_CUSTOM);
        expect(storage.removeItem).toHaveBeenCalledWith(KEYS.LEGACY_SYSTEM_PROMPT);
        expect(storage.removeItem).toHaveBeenCalledWith(KEYS.LEGACY_PROMPT_VERSION);
        expect(storage.removeItem).toHaveBeenCalledWith(KEYS.LEGACY_PROMPT_IS_CUSTOM);
    });
});
