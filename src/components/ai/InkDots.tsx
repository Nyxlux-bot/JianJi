/** 研墨：三点墨轮流呼吸，替代转圈的菊花。系统减弱动态效果时静止。 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { css, useReducedMotion } from 'react-native-reanimated';

// 循环交给 C++ 驱动的 CSS 动画，每帧不跑 JS
const BREATH = css.keyframes({
    from: { opacity: 0.25, transform: [{ scale: 0.8 }] },
    to: { opacity: 0.9, transform: [{ scale: 1 }] },
});

function Dot({ color, delay }: { color: string; delay: number }) {
    const reduceMotion = useReducedMotion();
    return (
        <Animated.View
            style={[
                styles.dot,
                { backgroundColor: color },
                reduceMotion ? styles.still : {
                    animationName: BREATH,
                    animationDuration: 600,
                    animationDelay: delay,
                    animationDirection: 'alternate',
                    animationIterationCount: 'infinite',
                    animationTimingFunction: 'ease-in-out',
                    animationFillMode: 'backwards',
                },
            ]}
        />
    );
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
    still: { opacity: 0.9 },
});
