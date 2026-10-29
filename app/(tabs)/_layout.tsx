import React, { useLayoutEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Tabs } from 'expo-router';
import PageBackground from '../../src/components/PageBackground';
import LiquidTabBar, { TAB_GLASS_TARGET, type TabBarProps } from '../../src/components/LiquidTabBar';
import { GlassTarget } from '../../modules/liquid-glass';

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
    return (
        <View style={styles.fill}>
            {/* 页签自己铺背景：经幡也要被底栏折射 */}
            <GlassTarget targetId={TAB_GLASS_TARGET} style={styles.fill}>
                <PageBackground />
                <Tabs
                    tabBar={(props) => <TabBarBridge props={props} onChange={setBar} />}
                    screenOptions={{
                        headerShown: false,
                        sceneStyle: { backgroundColor: 'transparent' },
                    }}
                >
                    <Tabs.Screen name="index" options={{ title: '排盘' }} />
                    <Tabs.Screen name="learn" options={{ title: '书阁' }} />
                    <Tabs.Screen name="history" options={{ title: '历史' }} />
                    <Tabs.Screen name="settings" options={{ title: '设置' }} />
                </Tabs>
            </GlassTarget>
            {bar ? <LiquidTabBar {...bar} /> : null}
        </View>
    );
}

const styles = StyleSheet.create({
    fill: { flex: 1 },
});
