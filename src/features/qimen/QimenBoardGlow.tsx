import React, { useEffect, useState } from 'react';
import { AppState, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { css } from 'react-native-reanimated';
import { toRgba } from '../../theme/bazi-theme';

const CIRCUIT = css.keyframes({
    from: { transform: [{ rotate: '0deg' }] },
    to: { transform: [{ rotate: '360deg' }] },
});

export default function QimenBoardGlow({ width, height, color, running }: {
    width: number;
    height: number;
    color: string;
    running: boolean;
}) {
    const [active, setActive] = useState(AppState.currentState === 'active');
    useEffect(() => {
        const subscription = AppState.addEventListener('change', state => setActive(state === 'active'));
        return () => subscription.remove();
    }, []);
    const size = Math.hypot(width, height);
    if (!size) return null;

    // 盘格盖住中部，只露出外框上的两段光；循环只旋转已栅格化的光带，不逐帧重绘九宫。
    return <Animated.View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        renderToHardwareTextureAndroid
        shouldRasterizeIOS
        style={[styles.light, {
            width: size, height: size, left: (width - size) / 2, top: (height - size) / 2,
            opacity: running ? 0.8 : 0,
            animationName: CIRCUIT,
            animationDuration: 18000,
            animationTimingFunction: 'linear',
            animationIterationCount: 'infinite',
            animationPlayState: running && active ? 'running' : 'paused',
        }]}
    >
        <LinearGradient colors={[toRgba(color, 0), toRgba(color, 0.18), color, toRgba(color, 0.18), toRgba(color, 0)]}
            locations={[0, 0.25, 0.5, 0.75, 1]} style={styles.beam} />
    </Animated.View>;
}

const styles = StyleSheet.create({
    light: { position: 'absolute' },
    beam: { position: 'absolute', left: 0, right: 0, top: '50%', height: 64, transform: [{ translateY: -32 }] },
});
