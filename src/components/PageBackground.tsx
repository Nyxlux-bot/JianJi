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
            {theme === 'yin' ? <Vignette /> : null}
        </View>
    );
}

// 阴面四周压暗。原来是 120px 模糊的全屏内阴影，GPU 性能条显示它每帧都要整屏重算模糊，底栏玻璃还会再画一遍；
// 换成四条边上的渐变，深浅大致相同：边上约 0.3，120dp 内淡到 0
const SHADE = ['rgba(0, 0, 0, 0.3)', 'rgba(0, 0, 0, 0.12)', 'rgba(0, 0, 0, 0.03)', 'rgba(0, 0, 0, 0)'] as const;
const SHADE_AT = [0, 0.35, 0.7, 1] as const;
function Vignette() {
    return (
        <>
            <LinearGradient colors={SHADE} locations={SHADE_AT} style={[styles.edge, styles.top]} />
            <LinearGradient colors={SHADE} locations={SHADE_AT} start={{ x: 0.5, y: 1 }} end={{ x: 0.5, y: 0 }} style={[styles.edge, styles.bottom]} />
            <LinearGradient colors={SHADE} locations={SHADE_AT} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={[styles.edge, styles.left]} />
            <LinearGradient colors={SHADE} locations={SHADE_AT} start={{ x: 1, y: 0.5 }} end={{ x: 0, y: 0.5 }} style={[styles.edge, styles.right]} />
        </>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1 },
    fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
    edge: { position: 'absolute' },
    top: { top: 0, left: 0, right: 0, height: 120 },
    bottom: { bottom: 0, left: 0, right: 0, height: 120 },
    left: { top: 0, bottom: 0, left: 0, width: 120 },
    right: { top: 0, bottom: 0, right: 0, width: 120 },
});
