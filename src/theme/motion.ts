/**
 * 动效令牌：时长 120 / 220 / 380 / 520，缓动「出」「进出」，只动 transform 与 opacity。
 * 系统开启「减弱动态效果」时，入场动画一律跳过。
 */
import { Easing, Keyframe, ReduceMotion } from 'react-native-reanimated';

export const EASE_OUT = Easing.bezier(0.2, 0.8, 0.2, 1);
export const EASE_IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);

/** 爻画起笔：自左向右展开，视图需配 transformOrigin: 'left' */
export function drawIn(delay: number, duration = 300) {
    return new Keyframe({
        0: { transform: [{ scaleX: 0 }] },
        100: { transform: [{ scaleX: 1 }], easing: EASE_OUT },
    }).duration(duration).delay(delay).reduceMotion(ReduceMotion.System);
}

/** 上浮淡入 */
export function riseIn(delay: number, distance = 12, duration = 420) {
    return new Keyframe({
        0: { opacity: 0, transform: [{ translateY: distance }] },
        100: { opacity: 1, transform: [{ translateY: 0 }], easing: EASE_OUT },
    }).duration(duration).delay(delay).reduceMotion(ReduceMotion.System);
}

/** 原地淡入 */
export function fadeIn(delay: number, duration = 400) {
    return new Keyframe({
        0: { opacity: 0 },
        100: { opacity: 1, easing: EASE_OUT },
    }).duration(duration).delay(delay).reduceMotion(ReduceMotion.System);
}

/** 盖印：从 1.7 倍斜着压下，略带回弹后摆正 */
export function stampIn(delay = 0) {
    return new Keyframe({
        0: { opacity: 0, transform: [{ scale: 1.7 }, { rotate: '-14deg' }] },
        55: { opacity: 1, transform: [{ scale: 0.92 }, { rotate: '-4deg' }], easing: EASE_OUT },
        100: { opacity: 1, transform: [{ scale: 1 }, { rotate: '0deg' }] },
    }).duration(360).delay(delay).reduceMotion(ReduceMotion.System);
}
