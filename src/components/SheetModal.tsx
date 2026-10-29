/**
 * 底部弹层：遮罩淡入，内容用弹簧升起、轻微过冲；收起 240ms 加速离场后才卸下 Modal。
 * 替换 Modal 自带的 slide。遮罩由这里画，子内容的外层不要再铺遮罩色。
 */
import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeContext';

/** 过冲部分只上移这么多倍，免得底部露出缝 */
const OVERSHOOT_PX = 150;

export default function SheetModal({ visible, onRequestClose, children }: {
    visible: boolean;
    onRequestClose: () => void;
    children: React.ReactNode;
}) {
    const { Colors } = useTheme();
    const { height } = useWindowDimensions();
    const reduceMotion = useReducedMotion();
    const [mounted, setMounted] = useState(visible);
    const progress = useSharedValue(0);

    useEffect(() => {
        if (visible) {
            setMounted(true);
            progress.value = reduceMotion ? 1 : withSpring(1, { damping: 20, stiffness: 220, mass: 0.9 });
        } else {
            progress.value = withTiming(0, { duration: reduceMotion ? 0 : 240, easing: Easing.in(Easing.cubic) }, (finished) => {
                if (finished) runOnJS(setMounted)(false);
            });
        }
    }, [visible, reduceMotion, progress]);

    const scrim = useAnimatedStyle(() => ({ opacity: Math.min(progress.value, 1) }));
    const sheet = useAnimatedStyle(() => ({
        transform: [{ translateY: progress.value <= 1 ? (1 - progress.value) * height : (1 - progress.value) * OVERSHOOT_PX }],
    }));

    return (
        <Modal visible={mounted} transparent animationType="none" onRequestClose={onRequestClose}>
            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: Colors.bg.overlay }, scrim]} />
            <Animated.View style={[styles.fill, sheet]}>{children}</Animated.View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    fill: { flex: 1 },
});
