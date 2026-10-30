import React, { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import type { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';
import { GlassView, liquidGlassSupported } from '../../modules/liquid-glass';
import { useTheme } from '../theme/ThemeContext';
import { HistoryIcon, HomeIcon, ReadIcon, SettingsIcon } from './Icons';
import { requestSettingsLeave } from '../services/settings-leave-guard';

export type TabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];

/** 底栏折射的是 (tabs)/_layout 里 GlassTarget 包住的页面 */
export const TAB_GLASS_TARGET = 'tabs';

const ICONS: Record<string, typeof HomeIcon> = { index: HomeIcon, learn: ReadIcon, history: HistoryIcon, settings: SettingsIcon };
const HEIGHT = 64;
const PILL_W = 74;
const PILL_H = 56;
// 圆角比半高少 1：正好半高时 Android 把胶囊拆成上下两排拼，中间零高度，半透明的叠缝在正中闪成一道亮线
const BAR_R = HEIGHT / 2 - 1;
const PILL_R = PILL_H / 2 - 1;
const GROW = 1.18;                                  // 按住时水泡鼓多大
// Reanimated 4 弹簧默认 mass 是 4，不写的话阻尼比只剩一半，最远一跳（设置→排盘）会冲出栏外
const FOLLOW = { stiffness: 900, damping: 45, mass: 1 };   // 按住时跟手要紧
const SETTLE = { stiffness: 415, damping: 29, mass: 1 };   // 松手落位：阻尼比约 0.7、过冲约 4%，同原来的朱红指示条
const SWELL = { stiffness: 520, damping: 33, mass: 1 };    // 水泡鼓起：阻尼比约 0.7
const BUBBLE_MS = 150;                                     // 按住这么久才鼓水泡，点按不鼓
const PRELOAD_AFTER_MS = 2000;                             // 启动后等首页稳住再预加载其他页签
const PRELOAD_GAP_MS = 400;                                // 一个一个来，别把挂载挤在同一帧
const THEME = {
    yin: {
        idle: '#8a857a',
        on: '#CFB53B',
        // 有折射时玻璃几乎不着色；没有（Expo Go、旧 Android、iOS）就退成半透明底
        tint: liquidGlassSupported ? 'rgba(255, 255, 255, 0.05)' : 'rgba(30, 29, 27, 0.88)',
        rim: 'inset 1.5px 1.5px 1px -1px rgba(255, 255, 255, 0.5), inset -1px -1px 1px -0.5px rgba(255, 255, 255, 0.18), inset 0 0 0 0.5px rgba(255, 255, 255, 0.16), inset 0 -6px 14px rgba(0, 0, 0, 0.25)',
        shadow: '0 10px 26px rgba(0, 0, 0, 0.45), 0 1px 3px rgba(0, 0, 0, 0.35)',
        // 选中块和水泡会被拉伸缩放，亮边只用描边：内阴影在胶囊形上是上下两段弧拼的，一拉伸正中间就露出一道亮缝
        pill: 'rgba(255, 255, 255, 0.1)',
        pillEdge: 'rgba(255, 255, 255, 0.14)',
        // 水泡比底栏高，没有折射时要实心，否则底栏的边会透出来成一根横线
        lens: liquidGlassSupported ? 'rgba(255, 255, 255, 0.04)' : 'rgba(58, 55, 50, 0.97)',
        lensEdge: 'rgba(255, 255, 255, 0.35)',
        lensShadow: '0 8px 18px rgba(0, 0, 0, 0.45)',
    },
    yang: {
        idle: '#7d6f5a',
        on: '#9b7017',
        tint: liquidGlassSupported ? 'rgba(255, 255, 255, 0.22)' : 'rgba(246, 240, 228, 0.9)',
        rim: 'inset 1.5px 1.5px 1px -1px rgba(255, 255, 255, 1), inset -1px -1px 1px -0.5px rgba(255, 255, 255, 0.7), inset 0 0 0 0.5px rgba(255, 255, 255, 0.6), inset 0 -6px 14px rgba(120, 90, 50, 0.1)',
        shadow: '0 10px 26px rgba(80, 60, 30, 0.18), 0 1px 3px rgba(80, 60, 30, 0.14)',
        pill: 'rgba(255, 255, 255, 0.62)',
        pillEdge: 'rgba(255, 255, 255, 0.9)',
        lens: liquidGlassSupported ? 'rgba(255, 255, 255, 0.12)' : 'rgba(252, 249, 243, 0.97)',
        lensEdge: 'rgba(255, 255, 255, 0.9)',
        lensShadow: '0 8px 18px rgba(80, 60, 30, 0.2)',
    },
};

/**
 * 液态玻璃底栏：选中块是一片玻璃。点页签，它弹簧滑过去、路上略拉长；
 * 按住，它鼓成透亮的水泡，折射并放大底下；按住左右拖，水泡跟手走，经过的图标放大变金，松手落到最近的页签。
 */
export default function LiquidTabBar({ state, descriptors, navigation }: TabBarProps) {
    const { theme } = useTheme();
    const colors = THEME[theme];
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const reduce = useReducedMotion();
    const count = state.routes.length;
    const barWidth = width * 0.85;
    const item = barWidth / count;
    const start = (state.index + 0.5) * item;
    const x = useSharedValue(start);
    const aim = useSharedValue(start);
    const press = useSharedValue(0);
    const swollen = useSharedValue(false);
    const indexRef = useRef(state.index);
    indexRef.current = state.index;

    const settle = useCallback((index: number) => {
        const to = (index + 0.5) * item;
        // 松手时已经朝这里落了：切页后再起一次弹簧会打断它，多晃一下
        if (Math.abs(aim.value - to) < 0.5) return;
        aim.value = to;
        x.value = reduce ? to : withSpring(to, SETTLE);
    }, [aim, item, reduce, x]);

    useEffect(() => {
        settle(state.index);
    }, [settle, state.index]);

    // 页签默认第一次点开才挂载，挂载那一下会卡住切页动画。启动稳住后把没开过的页签逐个预加载好
    useEffect(() => {
        const timers = state.routes.map((route, k) => setTimeout(() => {
            const now = navigation.getState();
            if (now.routes[now.index].key !== route.key) navigation.preload(route.name);
        }, PRELOAD_AFTER_MS + k * PRELOAD_GAP_MS));
        return () => timers.forEach(clearTimeout);
        // 只在启动时排一次
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const go = useCallback((index: number) => {
        const route = state.routes[index];
        const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
        if (index !== state.index && !event.defaultPrevented) {
            // 立刻切：原来延后 180ms，连点 A→B→C 时 B 迟到落地会把玻璃拽回 B 再去 C，看着跟不上。
            // 原生同步开关打开后，挂载新页面不再卡住玻璃的动画；页签也已预加载，切过去不用现挂载
            const navigate = () => navigation.navigate(route.name);
            if (state.routes[state.index]?.name === 'settings') requestSettingsLeave(navigate);
            else navigate();
        }
        // 设置页有未保存的改动时会先弹确认，没切过去就把玻璃送回原位
        setTimeout(() => { if (indexRef.current !== index) settle(indexRef.current); }, 400);
    }, [navigation, settle, state.index, state.routes]);

    const gesture = Gesture.Simultaneous(
        // 按下就鼓水泡、跟手；拖动松手由它选页签
        Gesture.Pan().minDistance(0)
            .onBegin((event) => {
                const to = Math.max(item / 2, Math.min(barWidth - item / 2, event.x));
                aim.value = to;
                // 按下时用落位弹簧：点按 80ms 就松手，若先用跟手弹簧冲起来再交接，会带着高速冲过头来回晃
                x.value = reduce ? to : withSpring(to, SETTLE);
                // 点按只滑选中块；按住一会儿或拖动才鼓水泡
                swollen.value = false;
                press.value = withDelay(BUBBLE_MS, reduce ? withTiming(1, { duration: 0 }) : withSpring(1, SWELL));
            })
            .onUpdate((event) => {
                const to = Math.max(item / 2, Math.min(barWidth - item / 2, event.x));
                aim.value = to;
                x.value = reduce ? to : withSpring(to, FOLLOW);
                if (!swollen.value && Math.abs(event.translationX) > 6) {
                    swollen.value = true;
                    press.value = reduce ? 1 : withSpring(1, SWELL);
                }
            })
            .onFinalize((_, moved) => {
                press.value = reduce ? 0 : withSpring(0, SWELL);
                const index = Math.max(0, Math.min(count - 1, Math.round(aim.value / item - 0.5)));
                const to = (index + 0.5) * item;
                aim.value = to;
                x.value = reduce ? to : withSpring(to, SETTLE);
                if (moved) runOnJS(go)(index);
            }),
        // 没拖动的点按（含按住不动再松开）由它选
        Gesture.Tap().maxDuration(10000).onEnd((event, success) => {
            if (success) runOnJS(go)(Math.max(0, Math.min(count - 1, Math.floor(event.x / item))));
        }),
    );

    const pill = useAnimatedStyle(() => ({
        opacity: 1 - press.value,
        transform: shape(x, aim, press, item, barWidth),
    }));
    const lens = useAnimatedStyle(() => ({
        opacity: press.value,
        transform: shape(x, aim, press, item, barWidth),
    }));

    return (
        <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <GestureDetector gesture={gesture}>
                <View style={[styles.bar, { width: barWidth, boxShadow: colors.shadow }]} accessibilityRole="tablist">
                    {/* 不加模糊：0.6dp 几乎看不出，却每帧多一遍全栏模糊 */}
                    <GlassView targetId={TAB_GLASS_TARGET} style={styles.fill} cornerRadius={BAR_R} refraction={16} bevel={22} blurRadius={0} />
                    <View pointerEvents="none" style={[styles.fill, styles.round, { backgroundColor: colors.tint, boxShadow: colors.rim }]} />
                    <Animated.View pointerEvents="none" style={[styles.pill, styles.edge, { backgroundColor: colors.pill, borderColor: colors.pillEdge }, pill]} />
                    <Animated.View pointerEvents="none" style={[styles.pill, lens]}>
                        <GlassView targetId={TAB_GLASS_TARGET} style={styles.fill} cornerRadius={PILL_R} refraction={14} bevel={18} magnify={0.12} blurRadius={0} />
                        <View style={[styles.fill, styles.pillRound, styles.edge, { backgroundColor: colors.lens, borderColor: colors.lensEdge, boxShadow: colors.lensShadow }]} />
                    </Animated.View>
                    {state.routes.map((route, index) => (
                        <TabIcon
                            key={route.key}
                            index={index}
                            item={item}
                            x={x}
                            press={press}
                            Icon={ICONS[route.name] ?? HomeIcon}
                            idle={colors.idle}
                            on={colors.on}
                            label={descriptors[route.key]?.options.title ?? route.name}
                            selected={index === state.index}
                            onActivate={() => go(index)}
                        />
                    ))}
                </View>
            </GestureDetector>
        </View>
    );
}

// 选中块的位置和形状：按住鼓起；离落点越远横向越长、纵向略收，像一滴水被拖着走；
// 弹簧回弹冲过两端时不出栏，停在端头被压扁
function shape(x: SharedValue<number>, aim: SharedValue<number>, press: SharedValue<number>, item: number, barWidth: number) {
    'worklet';
    const lo = item / 2;
    const hi = barWidth - item / 2;
    const over = x.value < lo ? lo - x.value : x.value > hi ? x.value - hi : 0;
    const squash = Math.min(0.3, over / PILL_W);
    const stretch = Math.min(0.22, Math.abs(aim.value - x.value) / item * 0.25);
    const scale = 1 + (GROW - 1) * press.value;
    return [
        { translateX: Math.min(hi, Math.max(lo, x.value)) - PILL_W / 2 },
        { scaleX: scale * (1 + stretch) * (1 - squash) },
        { scaleY: scale * (1 - stretch * 0.35) * (1 + squash * 0.3) },
    ];
}

function TabIcon({ index, item, x, press, Icon, idle, on, label, selected, onActivate }: {
    index: number;
    item: number;
    x: SharedValue<number>;
    press: SharedValue<number>;
    Icon: typeof HomeIcon;
    idle: string;
    on: string;
    label: string;
    selected: boolean;
    onActivate: () => void;
}) {
    const center = (index + 0.5) * item;
    // 水泡底下的图标跟着放大，离得越远越小
    const grow = useAnimatedStyle(() => {
        const near = Math.max(0, 1 - Math.abs(x.value - center) / item);
        return { transform: [{ scale: 1 + (GROW - 1) * 1.4 * press.value * near }] };
    });
    // 玻璃经过时变金
    const lit = useAnimatedStyle(() => ({ opacity: Math.max(0, Math.min(1, 1 - Math.abs(x.value - center) / (item * 0.5))) }));
    return (
        <Animated.View
            pointerEvents="none"
            style={[styles.tab, { left: index * item, width: item }, grow]}
            accessible
            accessibilityRole="tab"
            accessibilityLabel={label}
            aria-selected={selected}
            accessibilityActions={[{ name: 'activate' }]}
            onAccessibilityAction={onActivate}
        >
            <Icon size={24} color={idle} />
            <Animated.View style={[styles.iconOn, lit]}>
                <Icon size={24} color={on} />
            </Animated.View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    wrap: { position: 'absolute', bottom: 0, width: '100%', alignItems: 'center', paddingHorizontal: 20 },
    bar: { height: HEIGHT, borderRadius: BAR_R },
    fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
    round: { borderRadius: BAR_R },
    pill: { position: 'absolute', top: (HEIGHT - PILL_H) / 2, left: 0, width: PILL_W, height: PILL_H, borderRadius: PILL_R },
    pillRound: { borderRadius: PILL_R },
    edge: { borderWidth: 0.5 },
    tab: { position: 'absolute', top: 0, height: '100%', alignItems: 'center', justifyContent: 'center' },
    iconOn: { position: 'absolute' },
});
