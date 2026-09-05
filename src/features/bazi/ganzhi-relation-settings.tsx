import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
    PropsWithChildren,
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react';
import {
    DEFAULT_GAN_ZHI_RELATION_SETTINGS,
    GanZhiRelationSettingKey,
    GanZhiRelationSettings,
    normalizeGanZhiRelationSettings,
} from '../../core/bazi-ganzhi-relation-engine';

const STORAGE_KEY = 'bazi_ganzhi_relation_settings_v1';

interface GanZhiRelationSettingsContextValue {
    settings: GanZhiRelationSettings;
    ready: boolean;
    setSetting: (key: GanZhiRelationSettingKey, enabled: boolean) => void;
    replaceSettings: (value: unknown) => Promise<GanZhiRelationSettings>;
    resetSettings: () => void;
}

const GanZhiRelationSettingsContext = createContext<GanZhiRelationSettingsContextValue | null>(null);

export function GanZhiRelationSettingsProvider({ children }: PropsWithChildren) {
    const [settings, setSettings] = useState<GanZhiRelationSettings>(DEFAULT_GAN_ZHI_RELATION_SETTINGS);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const raw = await AsyncStorage.getItem(STORAGE_KEY);
                if (!cancelled && raw) {
                    setSettings(normalizeGanZhiRelationSettings(JSON.parse(raw)));
                }
            } catch (error) {
                console.error('读取干支图示设置失败', error);
            } finally {
                if (!cancelled) setReady(true);
            }
        };
        void load();
        return () => {
            cancelled = true;
        };
    }, []);

    const persist = useCallback((next: GanZhiRelationSettings) => {
        setSettings(next);
        void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch((error) => {
            console.error('保存干支图示设置失败', error);
        });
    }, []);

    const setSetting = useCallback((key: GanZhiRelationSettingKey, enabled: boolean) => {
        setSettings((current) => {
            const next = { ...current, [key]: enabled };
            void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch((error) => {
                console.error('保存干支图示设置失败', error);
            });
            return next;
        });
    }, []);

    const replaceSettings = useCallback(async (value: unknown) => {
        const next = normalizeGanZhiRelationSettings(value);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        setSettings(next);
        return next;
    }, []);

    const resetSettings = useCallback(() => {
        persist({ ...DEFAULT_GAN_ZHI_RELATION_SETTINGS });
    }, [persist]);

    const value = useMemo(() => ({
        settings,
        ready,
        setSetting,
        replaceSettings,
        resetSettings,
    }), [ready, replaceSettings, resetSettings, setSetting, settings]);

    return (
        <GanZhiRelationSettingsContext.Provider value={value}>
            {children}
        </GanZhiRelationSettingsContext.Provider>
    );
}

export function useGanZhiRelationSettings(): GanZhiRelationSettingsContextValue {
    const context = useContext(GanZhiRelationSettingsContext);
    if (!context) {
        throw new Error('useGanZhiRelationSettings must be used within GanZhiRelationSettingsProvider');
    }
    return context;
}
