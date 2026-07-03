import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors as DefaultColors } from './colors';
import { WhiteColors } from './colors-white';

export type ThemeType = 'yin' | 'yang';

interface ThemeContextProps {
    theme: ThemeType;
    setTheme: (t: ThemeType) => void;
    Colors: typeof DefaultColors;
}

const ThemeContext = createContext<ThemeContextProps>({
    theme: 'yin',
    setTheme: () => { },
    Colors: DefaultColors,
});

function normalizeTheme(value: string | null): ThemeType {
    return value === 'white' || value === 'yang' ? 'yang' : 'yin';
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [theme, setThemeState] = useState<ThemeType>('yin');
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        let mounted = true;
        const initTheme = async () => {
            try {
                const t = await AsyncStorage.getItem('app-theme');
                if (!mounted) return;
                const normalized = normalizeTheme(t);
                setThemeState(normalized);
                if (t !== normalized) {
                    AsyncStorage.setItem('app-theme', normalized).catch(() => { });
                }
            } catch {
                // fallback to default theme
            } finally {
                if (mounted) {
                    setIsReady(true);
                }
            }
        };
        initTheme();
        return () => {
            mounted = false;
        };
    }, []);

    const setTheme = (t: ThemeType) => {
        setThemeState(t);
        AsyncStorage.setItem('app-theme', t).catch(() => { });
    };

    const getColors = () => {
        switch (theme) {
            case 'yang': return WhiteColors;
            default: return DefaultColors;
        }
    };

    if (!isReady) return null;

    return (
        <ThemeContext.Provider value={{ theme, setTheme, Colors: getColors() }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => useContext(ThemeContext);
