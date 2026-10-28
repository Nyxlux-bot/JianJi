/** 研墨：三点墨轮流呼吸，替代转圈的菊花。系统减弱动态效果时静止。 */
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

function Dot({ color, delay }: { color: string; delay: number }) {
    const reduceMotion = useReducedMotion();
    const breath = useSharedValue(reduceMotion ? 1 : 0);

    useEffect(() => {
        if (reduceMotion) return;
        const half = { duration: 600, easing: Easing.inOut(Easing.sin) };
        breath.value = withDelay(delay, withRepeat(withSequence(withTiming(1, half), withTiming(0, half)), -1));
    }, [breath, delay, reduceMotion]);

    const style = useAnimatedStyle(() => ({
        opacity: 0.25 + 0.65 * breath.value,
        transform: [{ scale: 0.8 + 0.2 * breath.value }],
    }));
    return <Animated.View style={[styles.dot, { backgroundColor: color }, style]} />;
}

export default function InkDots({ color }: { color: string }) {
    return (
        <View style={styles.row} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Dot color={color} delay={0} />
            <Dot color={color} delay={160} />
            <Dot color={color} delay={320} />
        </View>
    );
}

const styles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 20 },
    dot: { width: 7, height: 7, borderRadius: 3.5 },
});
