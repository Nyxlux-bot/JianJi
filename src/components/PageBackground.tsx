import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme/ThemeContext';
import { toRgba } from '../theme/bazi-theme';
import { YunZhuanBanners } from './YunZhuanBanners';

// 自己铺背景的路由：干支里套了一层栈，每页已有背景，外层这层会被整个盖住却还在跑经幡；
// 页签把背景铺在液态玻璃的折射目标里，底栏才折射得到经幡
const NESTED_STACKS = new Set(['bazi/ganzhi', '(tabs)']);
// 只铺底色的路由：长文压在流动的经幡上读着累
const PLAIN = new Set(['learn/reader']);

/** 栈的 screenLayout：每页自带不透明背景，推入转场时不会透出上一页 */
export function withPageBackground({ route, children }: { route: { name: string }; children: React.ReactNode }) {
    if (NESTED_STACKS.has(route.name)) return <>{children}</>;
    return (
        <View style={styles.screen}>
            <PageBackground plain={PLAIN.has(route.name)} />
            {children}
        </View>
    );
}

export default function PageBackground({ plain = false }: { plain?: boolean }) {
    const { Colors, theme } = useTheme();
    const bg = Colors.bg.primary as string;

    if (plain) return <View style={[styles.fill, { backgroundColor: bg }]} pointerEvents="none" testID="app-page-background" />;
    return (
        <View
            style={[styles.fill, { backgroundColor: bg }]}
            pointerEvents="none"
            aria-hidden
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            testID="app-page-background"
        >
            <YunZhuanBanners />
            {/* 顶部字标、今日四格压暗经幡，底部略收 */}
            <LinearGradient
                colors={[toRgba(bg, 0.72), toRgba(bg, 0.72), toRgba(bg, 0), toRgba(bg, 0), toRgba(bg, 0.45)]}
                locations={[0, 0.13, 0.27, 0.76, 1]}
                style={styles.fill}
            />
            {theme === 'yin' ? <View style={[styles.fill, styles.vignette]} /> : null}
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1 },
    fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
    vignette: { boxShadow: 'inset 0 0 120px rgba(0, 0, 0, 0.6)' },
});
