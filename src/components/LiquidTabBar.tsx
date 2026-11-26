import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';
import { GlassView, liquidGlassSupported } from '../../modules/liquid-glass';
import { useTheme } from '../theme/ThemeContext';
import { webLiquidGlass } from '../theme/web-enhance';
import { HistoryIcon, HomeIcon, ReadIcon, SettingsIcon } from './Icons';
import { getSettingsLeaveGuarded, requestSettingsLeave, subscribeSettingsLeaveGuarded } from '../services/settings-leave-guard';

export interface LiquidTabItem {
    key: string;
    name: string;
    label: string;
}

export interface LiquidTabBarProps {
    items: LiquidTabItem[];
    activeIndex: number;
    activeSlot: SharedValue<number>;
    slotPositions: SharedValue<number>[];
    onSelect: (index: number, alreadySlid: boolean) => boolean;
    onPreload: (name: string) => void;
}

/** 底栏折射的是 (tabs)/_layout 里 GlassTarget 包住的页面 */
export const TAB_GLASS_TARGET = 'tabs';

// 页签整屏横滑：临界阻尼弹簧（ζ ≈ 1.00），无过冲不露缝，连续快切折返时保留速度丝滑接力
const PAGE_SPRING = { stiffness: 380, damping: 39, mass: 1, overshootClamping: true, energyThreshold: 1e-4 };
// 按住底栏拖动时的跟手弹簧（ζ = 1.00）：与水泡 FOLLOW 同刚度、无过冲，页面紧贴手指连续横滚
const PAGE_FOLLOW = { stiffness: 900, damping: 60, mass: 1, overshootClamping: true, energyThreshold: 1e-4 };

/** 在 UI 线程直接驱动四个页签的横向位移：只滑动离开页与进入页，中间跨过的页在屏外静默归位不闪过 */
export function slideTabPanels(
    activeSlot: SharedValue<number>,
    slotPositions: SharedValue<number>[],
    target: number,
    reduceMotion: boolean,
) {
    'worklet';
    const from = activeSlot.value;
    if (from === target || target < 0 || target >= slotPositions.length) return;
    activeSlot.value = target;
    for (let k = 0; k < slotPositions.length; k++) {
        const to = k === target ? 0 : k > target ? 1 : -1;
        if (reduceMotion) {
            cancelAnimation(slotPositions[k]);
            slotPositions[k].value = to;
            continue;
        }
        if (k === target || k === from) {
            slotPositions[k].value = withSpring(to, PAGE_SPRING);
            continue;
        }
        const cur = slotPositions[k].value;
        if (Math.abs(cur) < 0.99 && cur * to >= 0) {
            slotPositions[k].value = withSpring(to, PAGE_SPRING);
        } else {
            cancelAnimation(slotPositions[k]);
            slotPositions[k].value = to;
        }
    }
}

/** 按住底栏连续拖动时，把四个页签按画卷顺序在 UI 线程实时跟手横移（不触发 JS 路由） */
function scrubTabPanels(
    activeSlot: SharedValue<number>,
    slotPositions: SharedValue<number>[],
    progress: number,
    prepareStrip: boolean,
) {
    'worklet';
    if (prepareStrip) {
        const base = activeSlot.value;
        for (let k = 0; k < slotPositions.length; k++) {
            // 仅把已在屏外的页签静默排到画卷对应槽位，屏内页签保持原位不跳变
            if (Math.abs(slotPositions[k].value) >= 0.99) {
                cancelAnimation(slotPositions[k]);
                slotPositions[k].value = k - base;
            }
        }
    }
    for (let k = 0; k < slotPositions.length; k++) {
        slotPositions[k].value = withSpring(k - progress, PAGE_FOLLOW);
    }
}

/** 拖动松手（或手势取消）后，将画卷平滑吸附到目标页签并把屏外页签归位到 ±1 */
function settleTabPanels(
    activeSlot: SharedValue<number>,
    slotPositions: SharedValue<number>[],
    target: number,
    reduceMotion: boolean,
) {
    'worklet';
    if (target < 0 || target >= slotPositions.length) return;
    activeSlot.value = target;
    for (let k = 0; k < slotPositions.length; k++) {
        const to = k === target ? 0 : k > target ? 1 : -1;
        if (reduceMotion) {
            cancelAnimation(slotPositions[k]);
            slotPositions[k].value = to;
            continue;
        }
        // 目标页及仍在屏内可见的页签全部平滑滑到落位，已在屏外的直接静默复位到 ±1
        if (k === target || Math.abs(slotPositions[k].value) < 0.99) {
            slotPositions[k].value = withSpring(to, PAGE_SPRING);
        } else {
            cancelAnimation(slotPositions[k]);
            slotPositions[k].value = to;
        }
    }
}

const ICONS: Record<string, typeof HomeIcon> = { index: HomeIcon, learn: ReadIcon, history: HistoryIcon, settings: SettingsIcon };
const HEIGHT = 64;
const PILL_W = 74;
const PILL_H = 56;
// 圆角比半高少 1：正好半高时 Android 把胶囊拆成上下两排拼，中间零高度，半透明的叠缝在正中闪成一道亮线
const BAR_R = HEIGHT / 2 - 1;
const PILL_R = PILL_H / 2 - 1;
const GROW = 1.18;                                  // 按住时水泡鼓多大
const LENS_FADE = 4;                                 // 水泡扩出底栏边缘之前完成交叉淡入
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
        // 有折射时玻璃几乎不着色；网页端用渐进毛玻璃配半透明底，其余端退成半透明底
        tint: liquidGlassSupported ? 'rgba(255, 255, 255, 0.05)' : Platform.OS === 'web' ? 'rgba(30, 29, 27, 0.76)' : 'rgba(30, 29, 27, 0.88)',
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
        // 与浅色主题的 accent.gold 一致
        on: '#8a6312',
        tint: liquidGlassSupported ? 'rgba(255, 255, 255, 0.22)' : Platform.OS === 'web' ? 'rgba(246, 240, 228, 0.78)' : 'rgba(246, 240, 228, 0.9)',
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
export default function LiquidTabBar({ items, activeIndex, activeSlot, slotPositions, onSelect, onPreload }: LiquidTabBarProps) {
    const { theme } = useTheme();
    const colors = THEME[theme];
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const reduce = useReducedMotion();
    const count = items.length;
    const barWidth = width * 0.85;
    const item = barWidth / count;
    const start = (activeIndex + 0.5) * item;
    const x = useSharedValue(start);
    const aim = useSharedValue(start);
    const press = useSharedValue(0);
    const swollen = useSharedValue(false);
    const scrubbing = useSharedValue(false);
    const picked = useSharedValue(false);
    const settingsGuarded = useSharedValue(getSettingsLeaveGuarded());
    const settingsIndex = items.findIndex((tab) => tab.name === 'settings');
    const indexRef = useRef(activeIndex);
    indexRef.current = activeIndex;
    const rollbackTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    useEffect(() => {
        settingsGuarded.value = getSettingsLeaveGuarded();
        return subscribeSettingsLeaveGuarded((guarded) => {
            settingsGuarded.value = guarded;
        });
    }, [settingsGuarded]);

    const clearRollback = useCallback(() => {
        if (rollbackTimerRef.current !== undefined) {
            clearTimeout(rollbackTimerRef.current);
            rollbackTimerRef.current = undefined;
        }
    }, []);

    useEffect(() => clearRollback, [clearRollback]);

    const settle = useCallback((index: number) => {
        const to = (index + 0.5) * item;
        // 松手时已经朝这里落了：切页后再起一次弹簧会打断它，多晃一下
        if (Math.abs(aim.value - to) < 0.5) return;
        aim.value = to;
        x.value = reduce ? to : withSpring(to, SETTLE);
    }, [aim, item, reduce, x]);

    useEffect(() => {
        settle(activeIndex);
    }, [activeIndex, settle]);

    // 页签默认第一次点开才挂载，挂载那一下会卡住切页动画。启动稳住后把没开过的页签逐个预加载好
    const onPreloadRef = useRef(onPreload);
    onPreloadRef.current = onPreload;
    useEffect(() => {
        const timers = items.map((tab, k) => setTimeout(() => {
            if (indexRef.current !== k) onPreloadRef.current(tab.name);
        }, PRELOAD_AFTER_MS + k * PRELOAD_GAP_MS));
        return () => timers.forEach(clearTimeout);
        // 只在启动时排一次
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const preloadAll = useCallback(() => {
        items.forEach((tab) => onPreloadRef.current(tab.name));
    }, [items]);

    const go = useCallback((index: number, alreadySlid: boolean) => {
        const target = items[index];
        if (!target) return;
        if (index !== indexRef.current) {
            const navigate = () => {
                const switched = onSelect(index, alreadySlid);
                if (!switched) {
                    slideTabPanels(activeSlot, slotPositions, indexRef.current, reduce);
                    settle(indexRef.current);
                }
            };
            if (items[indexRef.current]?.name === 'settings') requestSettingsLeave(navigate);
            else navigate();
        }
        // 设置页有未保存的改动时会先弹确认，没切过去就把玻璃送回原位；仅保留最新一次回弹计时
        clearRollback();
        rollbackTimerRef.current = setTimeout(() => {
            rollbackTimerRef.current = undefined;
            if (indexRef.current !== index) {
                slideTabPanels(activeSlot, slotPositions, indexRef.current, reduce);
                settle(indexRef.current);
            }
        }, 400);
    }, [activeSlot, clearRollback, items, onSelect, reduce, settle, slotPositions]);

    const goRef = useRef(go);
    goRef.current = go;
    const triggerGo = useCallback((index: number, alreadySlid: boolean) => {
        goRef.current(index, alreadySlid);
    }, []);

    const gesture = useMemo(() => Gesture.Simultaneous(
        // 按下就鼓水泡、跟手；拖动时四页排成画卷在 UI 线程连续跟手滑，松手吸附并只切一次路由
        Gesture.Pan().minDistance(0)
            .onBegin((event) => {
                picked.value = false;
                scrubbing.value = false;
                runOnJS(clearRollback)();
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
                if (swollen.value && !reduce && !(activeSlot.value === settingsIndex && settingsGuarded.value)) {
                    const firstFrame = !scrubbing.value;
                    if (firstFrame) {
                        scrubbing.value = true;
                        runOnJS(preloadAll)();
                    }
                    const progress = Math.max(0, Math.min(count - 1, (to - item / 2) / item));
                    scrubTabPanels(activeSlot, slotPositions, progress, firstFrame);
                }
            })
            .onFinalize((_, moved) => {
                press.value = reduce ? 0 : withSpring(0, SWELL);
                const index = Math.max(0, Math.min(count - 1, Math.round(aim.value / item - 0.5)));
                const to = (index + 0.5) * item;
                aim.value = to;
                x.value = reduce ? to : withSpring(to, SETTLE);
                const wasScrubbing = scrubbing.value;
                scrubbing.value = false;
                if (moved && !picked.value) {
                    picked.value = true;
                    const canSlideNow = !(activeSlot.value === settingsIndex && settingsGuarded.value);
                    if (wasScrubbing) {
                        settleTabPanels(activeSlot, slotPositions, index, reduce);
                    } else if (canSlideNow) {
                        slideTabPanels(activeSlot, slotPositions, index, reduce);
                    }
                    runOnJS(triggerGo)(index, wasScrubbing || canSlideNow);
                } else if (wasScrubbing) {
                    // 手势被系统打断时把画卷平滑收回到当前页，避免半截停在屏中
                    settleTabPanels(activeSlot, slotPositions, activeSlot.value, reduce);
                }
            }),
        // 没拖动的点按（含按住不动再松开）由它选；进入画卷拖动后交由 Pan.onFinalize 统一吸附收尾
        Gesture.Tap().maxDuration(10000).maxDistance(12).onEnd((event, success) => {
            if (success && !picked.value && !scrubbing.value) {
                picked.value = true;
                const index = Math.max(0, Math.min(count - 1, Math.floor(event.x / item)));
                const canSlideNow = !(activeSlot.value === settingsIndex && settingsGuarded.value);
                if (canSlideNow) slideTabPanels(activeSlot, slotPositions, index, reduce);
                runOnJS(triggerGo)(index, canSlideNow);
            }
        }),
    ), [activeSlot, aim, barWidth, clearRollback, count, item, picked, preloadAll, press, reduce, scrubbing, settingsGuarded, settingsIndex, slotPositions, swollen, triggerGo, x]);

    const pill = useAnimatedStyle(() => ({
        opacity: 1 - Math.min(1, Math.max(0, press.value * LENS_FADE)),
        transform: shape(x, aim, press, item, barWidth),
    }));
    const lens = useAnimatedStyle(() => ({
        opacity: Math.min(1, Math.max(0, press.value * LENS_FADE)),
        transform: shape(x, aim, press, item, barWidth),
    }));

    return (
        <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <GestureDetector gesture={gesture}>
                <View style={[styles.bar, { width: barWidth, boxShadow: colors.shadow }]} accessibilityRole="tablist">
                    {/* 不加模糊：0.6dp 几乎看不出，却每帧多一遍全栏模糊 */}
                    <GlassView targetId={TAB_GLASS_TARGET} style={styles.fill} cornerRadius={BAR_R} refraction={16} bevel={22} blurRadius={0} />
                    <View pointerEvents="none" style={[styles.fill, styles.round, { backgroundColor: colors.tint, boxShadow: colors.rim }, webLiquidGlass]} />
                    <Animated.View pointerEvents="none" style={[styles.pill, styles.edge, { backgroundColor: colors.pill, borderColor: colors.pillEdge }, pill]} />
                    <Animated.View pointerEvents="none" style={[styles.pill, lens]}>
                        <GlassView targetId={TAB_GLASS_TARGET} style={styles.fill} cornerRadius={PILL_R} refraction={14} bevel={18} magnify={0.12} blurRadius={0} />
                        <View style={[styles.fill, styles.pillRound, styles.edge, { backgroundColor: colors.lens, borderColor: colors.lensEdge, boxShadow: colors.lensShadow }]} />
                    </Animated.View>
                    {items.map((tab, index) => (
                        <TabIcon
                            key={tab.key}
                            index={index}
                            item={item}
                            x={x}
                            press={press}
                            Icon={ICONS[tab.name] ?? HomeIcon}
                            idle={colors.idle}
                            on={colors.on}
                            label={tab.label}
                            selected={index === activeIndex}
                            onActivate={() => {
                                const canSlideNow = !(activeSlot.value === settingsIndex && settingsGuarded.value);
                                if (canSlideNow) slideTabPanels(activeSlot, slotPositions, index, reduce);
                                go(index, canSlideNow);
                            }}
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
