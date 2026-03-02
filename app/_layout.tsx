/**
 * 根布局 - expo-router
 */

import React, { useEffect, useRef } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, Animated } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { ThemeProvider, useTheme } from "../src/theme/ThemeContext";
import CustomAlertProvider from '../src/components/CustomAlertProvider';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync().catch(() => { });

function RootApp() {
    const { Colors } = useTheme();
    const styles = makeStyles(Colors);
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const prepareApp = async () => {
            try {
                // Ensure proper delay to prevent flash and allow layout computation
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (e) {
                console.warn(e);
            } finally {
                await SplashScreen.hideAsync();
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 600,
                    useNativeDriver: true,
                }).start();
            }
        };

        prepareApp();
    }, [fadeAnim]);

    return (
        <SafeAreaProvider>
            <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
                <StatusBar style={Colors.bg.primary === '#f9f6f0' ? 'dark' : 'light'} />
                <Stack
                    screenOptions={{
                        headerShown: false,
                        contentStyle: { backgroundColor: Colors.bg.primary },
                        animation: 'fade',
                    }}
                />
                <CustomAlertProvider />
            </Animated.View>
        </SafeAreaProvider>
    );
}

export default function RootLayout() {
    return (
        <ThemeProvider>
            <RootApp />
        </ThemeProvider>
    );
}

const makeStyles = (Colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.bg.primary,
    },
});
