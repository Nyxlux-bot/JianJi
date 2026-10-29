/**
 * 根布局 - expo-router
 */

import '../src/polyfills/intl';
import React, { useMemo, useState } from 'react';
import { Stack, DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { ThemeProvider, useTheme } from "../src/theme/ThemeContext";
import CustomAlertProvider from '../src/components/CustomAlertProvider';
import { withPageBackground } from '../src/components/PageBackground';
import LaunchOverlay from '../src/components/LaunchOverlay';
import { GanZhiRelationSettingsProvider } from '../src/features/bazi/ganzhi-relation-settings';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync().catch(() => { });
// 启动动画第一帧与启动图同色，直接收起；安卓默认会再淡出 400ms，把动画开头吃掉。
// Expo Go 用的是它自己的启动屏，不认这项设置
if (Constants.executionEnvironment !== ExecutionEnvironment.StoreClient) {
    SplashScreen.setOptions({ duration: 0 });
}

function RootApp() {
    const { Colors, theme } = useTheme();
    const styles = useMemo(() => makeStyles(Colors), [Colors]);
    const [launching, setLaunching] = useState(true);
    const navigationTheme = theme === 'yang' ? DefaultTheme : DarkTheme;

    return (
        <GestureHandlerRootView style={styles.container}>
            <SafeAreaProvider>
                <View style={styles.container}>
                    <StatusBar style={theme === 'yang' ? 'dark' : 'light'} />
                    <NavigationThemeProvider value={{ ...navigationTheme, colors: { ...navigationTheme.colors, background: 'transparent' } }}>
                        <Stack
                            screenLayout={withPageBackground}
                            screenOptions={{
                                headerShown: false,
                                contentStyle: { backgroundColor: 'transparent' },
                                animation: 'ios_from_right',
                            }}
                        />
                    </NavigationThemeProvider>
                    <CustomAlertProvider />
                    {launching ? <LaunchOverlay onDone={() => setLaunching(false)} /> : null}
                </View>
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
}

export default function RootLayout() {
    return (
        <ThemeProvider>
            <GanZhiRelationSettingsProvider>
                <RootApp />
            </GanZhiRelationSettingsProvider>
        </ThemeProvider>
    );
}

const makeStyles = (Colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.bg.primary,
    },
});
