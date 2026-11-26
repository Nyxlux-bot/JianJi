import { useCallback, useEffect, useRef } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { EASE_OUT } from '../theme/motion';

/**
 * 页签下的朱红指示条：量出各页签位置，切换时 220ms 滑过去；开启减弱动态效果时直接落位。
 * 指示条放在页签容器里，left 为 0，transform 交给返回的 style。
 */
export function useTabIndicator(active: string, indicatorWidth = 16) {
    const reduceMotion = useReducedMotion();
    const layouts = useRef(new Map<string, { x: number; width: number }>());
    const x = useSharedValue(-1);

    const place = useCallback((animate: boolean) => {
        const layout = layouts.current.get(active);
        if (!layout) return;
        const target = layout.x + layout.width / 2 - indicatorWidth / 2;
        x.value = animate && !reduceMotion && x.value >= 0 ? withTiming(target, { duration: 220, easing: EASE_OUT }) : target;
    }, [active, indicatorWidth, reduceMotion, x]);

    useEffect(() => {
        place(true);
    }, [place]);

    const onTabLayout = (key: string) => (event: LayoutChangeEvent) => {
        layouts.current.set(key, event.nativeEvent.layout);
        if (key === active) place(false);
    };

    const style = useAnimatedStyle(() => ({
        opacity: x.value < 0 ? 0 : 1,
        transform: [{ translateX: x.value }],
    }));

    return { onTabLayout, style };
}
