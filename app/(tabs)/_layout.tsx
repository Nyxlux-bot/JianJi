import React, { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import { createStandardRouterNavigator, TabRouter, unstable_useReconcileTabHistory } from 'expo-router';
import Animated, { cancelAnimation, makeMutable, useAnimatedStyle, useReducedMotion, useSharedValue, type SharedValue } from 'react-native-reanimated';
import PageBackground from '../../src/components/PageBackground';
import { YunZhuanForeground } from '../../src/components/YunZhuanBanners';
import LiquidTabBar, { TAB_GLASS_TARGET, slideTabPanels, type LiquidTabItem } from '../../src/components/LiquidTabBar';
import { GlassTarget } from '../../modules/liquid-glass';

type FluidTabOptions = {
    title?: string;
    sceneStyle?: StyleProp<ViewStyle>;
};

type FluidTabEvents = {
    tabPress: { data: undefined; canPreventDefault: true };
};

type FluidTabCreateProps = {
    routeNames: string[];
    preload: (name: string) => void;
    navigateSync: (name: string, params?: object) => void;
};

const TAB_TITLES: Record<string, string> = {
    index: '排盘',
    learn: '书阁',
    history: '历史',
    settings: '设置',
};

const SCREEN_OPTIONS: FluidTabOptions = {
    sceneStyle: { backgroundColor: 'transparent' },
};

const TabPanel = memo(function TabPanel({
    pos,
    screenWidth,
    focused,
    sceneStyle,
    children,
}: {
    pos: SharedValue<number>;
    screenWidth: SharedValue<number>;
    focused: boolean;
    sceneStyle?: StyleProp<ViewStyle>;
    children: React.ReactNode;
}) {
    const motion = useAnimatedStyle(() => ({
        transform: [{ translateX: pos.value * screenWidth.value }],
    }));
    const webProps = Platform.OS === 'web' ? ({ inert: !focused } as object) : undefined;
    return (
        <Animated.View
            {...webProps}
            pointerEvents={focused ? 'auto' : 'none'}
            aria-hidden={Platform.OS === 'web' ? undefined : !focused}
            accessibilityElementsHidden={Platform.OS === 'web' ? undefined : !focused}
            importantForAccessibility={focused ? 'auto' : 'no-hide-descendants'}
            style={[styles.panel, sceneStyle, motion]}
        >
            {children}
        </Animated.View>
    );
});

type FluidTabsContentProps = {
    state: {
        index: number;
        routes: ReadonlyArray<{ key: string; name: string; params?: object }>;
    };
    descriptors: Record<string, { options: FluidTabOptions; render: () => React.ReactNode }>;
    emitter: { emit: (event: { type: 'tabPress'; target?: string; canPreventDefault: true }) => { defaultPrevented?: boolean } };
    routeNames: string[];
    preload: (name: string) => void;
    navigateSync: (name: string, params?: object) => void;
    readonly __eventMap__?: FluidTabEvents;
    readonly __navigatorProps__?: object;
    readonly __createProps__?: FluidTabCreateProps;
};

/**
 * 自建 Reanimated UI 线程页签容器：
 * 1. 四个页签常驻布局不走 display: 'none'，也不拆装安卓 Fragment，切页零 Yoga 重排、零 SVG 位图重建；
 * 2. 切页横滑由 Reanimated 共享值在 UI 线程驱动，与液态玻璃底栏松手同一帧同步起步，消除底栏抢跑与旧版 Animated 起步顿感；
 * 3. 路由切换走 dispatchSync，跳过 Expo Router 异步队列的额外渲染与 effect 往返。
 */
function FluidTabsContent({ state, descriptors, emitter, routeNames, preload, navigateSync }: FluidTabsContentProps) {
    unstable_useReconcileTabHistory();
    const { width } = useWindowDimensions();
    const reduceMotion = useReducedMotion();
    const screenWidth = useSharedValue(width);
    useEffect(() => {
        screenWidth.value = width;
    }, [screenWidth, width]);

    const focusedName = state.routes[state.index]?.name ?? routeNames[0];
    const focusedSlot = Math.max(0, routeNames.indexOf(focusedName));
    const activeSlot = useSharedValue(focusedSlot);
    const slotPositions = useMemo(
        () => routeNames.map((_, k) => makeMutable(k === focusedSlot ? 0 : k > focusedSlot ? 1 : -1)),
        // routeNames 固定为四个页签，仅初始化一次共享值
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    useEffect(() => () => {
        slotPositions.forEach(cancelAnimation);
    }, [slotPositions]);

    const uiSlidSlotsRef = useRef<number[]>([]);
    // 外部触发的路由变化（返回键、浏览器前进后退、深链或带拦截确认后的设置页离开）由此补齐滑页；
    // 已经由底栏在 UI 线程先起步的点击跳过补滑，避免高频连点时旧一次 JS 提交把新滑页拽回去
    useEffect(() => {
        const queued = uiSlidSlotsRef.current;
        const hit = queued.indexOf(focusedSlot);
        if (hit >= 0) {
            queued.splice(0, hit + 1);
            return;
        }
        slideTabPanels(activeSlot, slotPositions, focusedSlot, reduceMotion);
    }, [activeSlot, focusedSlot, reduceMotion, slotPositions]);

    const routeByName = useMemo(() => {
        const map = new Map<string, { key: string; name: string; params?: object }>();
        for (const route of state.routes) map.set(route.name, route);
        return map;
    }, [state.routes]);

    const mountedNamesRef = useRef<Set<string>>(new Set());
    mountedNamesRef.current = new Set(routeByName.keys());

    const items = useMemo<LiquidTabItem[]>(() => routeNames.map((name) => {
        const mounted = routeByName.get(name);
        const title = (mounted ? descriptors[mounted.key]?.options.title : undefined) ?? TAB_TITLES[name] ?? name;
        return { key: name, name, label: title };
    }), [descriptors, routeByName, routeNames]);

    const handleSelect = useCallback((slotIndex: number, alreadySlid: boolean) => {
        const name = routeNames[slotIndex];
        if (!name) return false;
        const mounted = routeByName.get(name);
        const event = emitter.emit({ type: 'tabPress', target: mounted?.key ?? name, canPreventDefault: true });
        if (event?.defaultPrevented) return false;
        if (alreadySlid) uiSlidSlotsRef.current.push(slotIndex);
        navigateSync(name, mounted?.params);
        return true;
    }, [emitter, navigateSync, routeByName, routeNames]);

    const handlePreload = useCallback((name: string) => {
        if (!mountedNamesRef.current.has(name)) preload(name);
    }, [preload]);

    return (
        <View style={styles.fill}>
            {/* 页签自己铺背景：经幡也要被底栏折射 */}
            <GlassTarget targetId={TAB_GLASS_TARGET} style={styles.fill}>
                {/* 只放一个子视图：1.8.1 的原生 GlassTarget 会把多个子视图横着排开，把页面挤出屏幕 */}
                <View style={styles.fill}>
                    <PageBackground />
                    <View style={styles.deck}>
                        {state.routes.map((route, index) => {
                            const slot = routeNames.indexOf(route.name);
                            const descriptor = descriptors[route.key];
                            if (slot < 0 || !descriptor) return null;
                            return (
                                <TabPanel
                                    key={route.key}
                                    pos={slotPositions[slot]}
                                    screenWidth={screenWidth}
                                    focused={state.index === index}
                                    sceneStyle={descriptor.options.sceneStyle}
                                >
                                    {descriptor.render()}
                                </TabPanel>
                            );
                        })}
                    </View>
                    <YunZhuanForeground homePos={slotPositions[0]} active={focusedSlot === 0} />
                </View>
            </GlassTarget>
            <LiquidTabBar
                items={items}
                activeIndex={focusedSlot}
                activeSlot={activeSlot}
                slotPositions={slotPositions}
                onSelect={handleSelect}
                onPreload={handlePreload}
            />
        </View>
    );
}

const FluidTabs = createStandardRouterNavigator(FluidTabsContent, TabRouter, {
    activityDefaultThreshold: 1,
    createProps: ({ state, dispatch, dispatchSync }): FluidTabCreateProps => ({
        routeNames: state.routeNames,
        preload: (name: string) => dispatch({ type: 'PRELOAD', payload: { name }, target: state.key }),
        navigateSync: (name: string, params?: object) => dispatchSync({ type: 'NAVIGATE', payload: { name, params }, target: state.key }),
    }),
});

export default function TabLayout() {
    return (
        <FluidTabs screenOptions={SCREEN_OPTIONS}>
            <FluidTabs.Screen name="index" options={{ title: '排盘' }} />
            <FluidTabs.Screen name="learn" options={{ title: '书阁' }} />
            <FluidTabs.Screen name="history" options={{ title: '历史' }} />
            <FluidTabs.Screen name="settings" options={{ title: '设置' }} />
        </FluidTabs>
    );
}

const styles = StyleSheet.create({
    fill: { flex: 1 },
    deck: { flex: 1, overflow: 'hidden', position: 'relative', zIndex: 0 },
    panel: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
});
