import React, { useLayoutEffect, useMemo, useState } from 'react';
import { Easing, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Tabs } from 'expo-router';
import { useReducedMotion } from 'react-native-reanimated';
import PageBackground from '../../src/components/PageBackground';
import LiquidTabBar, { TAB_GLASS_TARGET, type TabBarProps } from '../../src/components/LiquidTabBar';
import { GlassTarget } from '../../modules/liquid-glass';

type ScreenOptions = NonNullable<Extract<React.ComponentProps<typeof Tabs>['screenOptions'], object>>;

// 玻璃底栏得画在 GlassTarget 外面才能折射页面（放里面会折射到自己），Tabs 这里只把导航状态递出去
function TabBarBridge({ props, onChange }: { props: TabBarProps; onChange: (props: TabBarProps) => void }) {
    useLayoutEffect(() => {
        onChange(props);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [props.state, onChange]);
    return null;
}

export default function TabLayout() {
    const [bar, setBar] = useState<TabBarProps | null>(null);
    const { width } = useWindowDimensions();
    const reduceMotion = useReducedMotion();
    // 切页整屏左右平移：按页签顺序，往右的页从右边滑进来，旧页往左滑走。
    // 动画走 RN 原生驱动，不经过 JS；背景经幡铺在 Tabs 外面不动，页面在它上面滑过
    const slide = useMemo((): ScreenOptions => (reduceMotion ? {} : {
        animation: 'shift',
        transitionSpec: { animation: 'timing', config: { duration: 300, easing: Easing.bezier(0.2, 0.8, 0.2, 1) } },
        sceneStyleInterpolator: ({ current }) => ({
            sceneStyle: { transform: [{ translateX: current.progress.interpolate({ inputRange: [-1, 0, 1], outputRange: [-width, 0, width] }) }] },
        }),
    }), [reduceMotion, width]);

    return (
        <View style={styles.fill}>
            {/* 页签自己铺背景：经幡也要被底栏折射 */}
            <GlassTarget targetId={TAB_GLASS_TARGET} style={styles.fill}>
                {/* 只放一个子视图：1.8.1 的原生 GlassTarget 会把多个子视图横着排开，把页面挤出屏幕 */}
                <View style={styles.fill}>
                    <PageBackground />
                    <Tabs
                        tabBar={(props) => <TabBarBridge props={props} onChange={setBar} />}
                        screenOptions={{
                            headerShown: false,
                            sceneStyle: { backgroundColor: 'transparent' },
                            ...slide,
                        }}
                    >
                        <Tabs.Screen name="index" options={{ title: '排盘' }} />
                        <Tabs.Screen name="learn" options={{ title: '书阁' }} />
                        <Tabs.Screen name="history" options={{ title: '历史' }} />
                        <Tabs.Screen name="settings" options={{ title: '设置' }} />
                    </Tabs>
                </View>
            </GlassTarget>
            {bar ? <LiquidTabBar {...bar} /> : null}
        </View>
    );
}

const styles = StyleSheet.create({
    fill: { flex: 1 },
});
