/**
 * 按压反馈：按下缩到 0.97、淡到 85%（120ms），松手 220ms 回弹。
 * 系统开启「减弱动态效果」时只留淡出，不缩放。
 */
import React from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { EASE_OUT } from '../theme/motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, 'style'> & {
    style?: StyleProp<ViewStyle>;
    /** 行一类的大块面用 0.985 */
    scaleTo?: number;
};

export default function PressableScale({ style, scaleTo = 0.97, onPressIn, onPressOut, ...rest }: Props) {
    const reduceMotion = useReducedMotion();
    const pressed = useSharedValue(0);
    const motion = useAnimatedStyle(() => ({
        opacity: 1 - 0.15 * pressed.value,
        transform: [{ scale: reduceMotion ? 1 : 1 - (1 - scaleTo) * pressed.value }],
    }));

    return (
        <AnimatedPressable
            {...rest}
            style={[style, motion]}
            onPressIn={(event) => {
                pressed.value = withTiming(1, { duration: 120, easing: EASE_OUT });
                onPressIn?.(event);
            }}
            onPressOut={(event) => {
                pressed.value = withTiming(0, { duration: 220, easing: EASE_OUT });
                onPressOut?.(event);
            }}
        />
    );
}
