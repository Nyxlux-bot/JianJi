import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors as DefaultColors } from './colors';
import { GreenColors } from './colors-green';
import { WhiteColors } from './colors-white';
import { PurpleColors } from './colors-purple';

type ThemeType = 'dark' | 'green' | 'white' | 'purple';

interface ThemeContextProps {
    theme: ThemeType;
    setTheme: (t: ThemeType) => void;
    Colors: typeof DefaultColors;
}

const ThemeContext = createContext<ThemeContextProps>({
    theme: 'dark',
    setTheme: () => { },
    Colors: DefaultColors,
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [theme, setThemeState] = useState<ThemeType>('dark');
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        let mounted = true;
        const initTheme = async () => {
            try {
                const t = await AsyncStorage.getItem('app-theme');
                if (!mounted) return;
                if (t === 'green' || t === 'white' || t === 'purple' || t === 'dark') {
                    setThemeState(t as ThemeType);
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
            case 'green': return GreenColors;
            case 'white': return WhiteColors;
            case 'purple': return PurpleColors;
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
