/**
 * 居中弹窗：遮罩单独淡入，内容从 0.96 放大并淡入（200ms）；收起 140ms 后才卸下 Modal。
 * 替换 Modal 自带的 fade。遮罩由这里画，子内容的外层不要再铺遮罩色。
 * 与 SheetModal（底部弹层）是一对：两者的遮罩色、网页端的背景模糊一致。
 */
import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeContext';
import { EASE_OUT } from '../theme/motion';
import { webScrimBlur, webScrimProps } from '../theme/web-enhance';

export default function DialogModal({ visible, onRequestClose, onShow, children }: {
    visible: boolean;
    onRequestClose: () => void;
    onShow?: () => void;
    children: React.ReactNode;
}) {
    const { Colors } = useTheme();
    const reduceMotion = useReducedMotion();
    const [mounted, setMounted] = useState(visible);
    const progress = useSharedValue(0);

    useEffect(() => {
        if (visible) {
            setMounted(true);
            progress.value = withTiming(1, { duration: reduceMotion ? 0 : 200, easing: EASE_OUT });
        } else if (mounted) {
            progress.value = withTiming(0, { duration: reduceMotion ? 0 : 140, easing: Easing.in(Easing.cubic) }, (finished) => {
                if (finished) runOnJS(setMounted)(false);
            });
        }
    }, [visible, mounted, reduceMotion, progress]);

    const scrim = useAnimatedStyle(() => ({ opacity: progress.value }));
    const content = useAnimatedStyle(() => ({
        opacity: progress.value,
        transform: [{ scale: reduceMotion ? 1 : 0.96 + 0.04 * progress.value }],
    }), [reduceMotion]);

    return (
        <Modal visible={mounted} transparent animationType="none" onRequestClose={onRequestClose} onShow={onShow}>
            <Animated.View {...webScrimProps} pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: Colors.bg.overlay }, webScrimBlur, scrim]} />
            <Animated.View style={[styles.fill, content]}>{children}</Animated.View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    fill: { flex: 1 },
});
