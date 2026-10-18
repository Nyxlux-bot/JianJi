import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme/ThemeContext';
import { toRgba } from '../theme/bazi-theme';

const backgrounds = {
    yang: require('../../assets/backgrounds/day-clouds-birds.png'),
    yin: require('../../assets/backgrounds/night-milky-way.png'),
};

export default function PageBackground() {
    const { Colors, theme } = useTheme();

    return (
        <View
            style={[StyleSheet.absoluteFill, { backgroundColor: Colors.bg.primary }]}
            pointerEvents="none"
            aria-hidden
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            testID="app-page-background"
        >
            <Image
                source={backgrounds[theme]}
                style={[StyleSheet.absoluteFill, { width: '100%', height: '100%', opacity: theme === 'yang' ? 0.55 : 0.7 }]}
                resizeMode="stretch"
                fadeDuration={0}
                accessibilityIgnoresInvertColors
            />
            <LinearGradient
                colors={[toRgba(Colors.bg.primary, 0), toRgba(Colors.bg.primary, 0), toRgba(Colors.bg.primary, theme === 'yang' ? 0.25 : 0.65), Colors.bg.primary, Colors.bg.primary, toRgba(Colors.bg.primary, theme === 'yang' ? 0.18 : 0.36)]}
                locations={[0, 0.08, 0.15, 0.42, 0.58, 0.88]}
                style={StyleSheet.absoluteFill}
            />
        </View>
    );
}
