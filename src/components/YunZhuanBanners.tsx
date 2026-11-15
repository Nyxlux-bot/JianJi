import React, { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useFonts } from 'expo-font';
import { useIsFocused } from 'expo-router';
import Animated, { css, makeMutable, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeContext';

// 《度人经》开篇。字体子集只含这些字，改字要重跑 scripts/build-yunzhuan-font.py
const TEXT = '道言昔于始青天中碧落空歌大浮黎土受元始度人无量上品元始天尊当说是经周回十过以召十方始当诣座天真大神上圣高尊妙行真人无鞅数众乘空而来飞云丹霄绿舆琼轮羽盖垂荫流精玉光五色郁勃洞焕太空七日七夜诸天日月星宿璇玑玉衡一时停轮神风静默山海藏云天无浮翳四气朗清';
const FONT = 'JianJiYunZhuan';
const FONT_SOURCE = { [FONT]: require('../../assets/fonts/JianJiYunZhuan.ttf') };

/** 经幡整体亮度：首页聚焦时 1，其他页 0.6 */
export const bannerLevel = makeMutable(0.6);
/** 首页转卡时轮盘的显隐（0–1），经幡跟着退暗 */
export const ringLevel = makeMutable(0);

type Layer = 'far' | 'mid' | 'focus' | 'near';

// 按 390 宽设计稿：[x, 字号]。同列字号一致，越大越近、流得越快
const COLUMNS: Record<Layer, [number, number][]> = {
    far: [[8, 17], [62, 19], [118, 16], [176, 18], [232, 17], [288, 19], [346, 16]],
    mid: [[30, 25], [138, 27], [250, 24], [334, 26]],
    focus: [[84, 36], [204, 40], [306, 34]],
    near: [[-28, 60], [350, 66]],
};
const FIRST_INDEX: Record<Layer, number> = { far: 0, mid: 7, focus: 11, near: 14 };
const PAD = 24; // 字影最远伸出约 16dp（焦点层半径 10 + 下移 6）
const INK = {
    yin: { far: '#a8924e', mid: '#c9ad5c', focus: '#e2c46e', near: '#f0d78a', shadow: 'rgba(0, 0, 0, 0.8)' },
    yang: { far: '#d6a596', mid: '#c97462', focus: '#b23f2e', near: '#a8382a', shadow: 'rgba(150, 60, 40, 0.28)' },
};
const LAYER_OPACITY = {
    yin: { far: 0.18, mid: 0.3, focus: 0.62, near: 0.26 },
    yang: { far: 0.24, mid: 0.32, focus: 0.55, near: 0.22 },
};

function Column({ index, x, size, layer, theme, screenHeight, still }: {
    index: number;
    x: number;
    size: number;
    layer: Layer;
    theme: 'yin' | 'yang';
    screenHeight: number;
    still: boolean;
}) {
    const lineHeight = Math.round(size * 1.55);
    const count = Math.ceil(screenHeight * 1.1 / lineHeight) + 1;
    const loop = count * lineHeight;
    const text = useMemo(() => {
        const start = (index * 29) % TEXT.length;
        return Array.from({ length: count }, (_, k) => TEXT[(start + k) % TEXT.length]).join('\n');
    }, [index, count]);
    // 循环交给 Reanimated 的 CSS 动画，C++ 每帧插值，不跑 JS：16 列常驻也不占 UI 线程的 JS 和 GC。
    // 速度与字号成正比，每秒走字号的 0.2 倍；负延迟让各列错开起点；暂停后原位接着走
    const motion = useMemo(() => {
        const duration = loop / (size * 0.2) * 1000;
        return {
            animationName: css.keyframes({ from: { transform: [{ translateY: 0 }] }, to: { transform: [{ translateY: -loop }] } }),
            animationDuration: duration,
            animationDelay: -((index * 211) % loop) / loop * duration,
            animationTimingFunction: 'linear',
            animationIterationCount: 'infinite',
        } as const;
    }, [index, loop, size]);

    const color = INK[theme][layer];
    // RN 没有文字模糊，远近景用透明字 + 同色阴影代替；焦点层加落影浮起来
    const ink = layer === 'near'
        ? { color: 'transparent', textShadowColor: color, textShadowRadius: 10 }
        : layer === 'far'
            ? { color: 'transparent', textShadowColor: color, textShadowRadius: 1.6 }
            : layer === 'focus'
                ? { color, textShadowColor: INK[theme].shadow, textShadowOffset: { width: 0, height: 6 }, textShadowRadius: 10 }
                : { color };

    // 整列只平移不变内容：栅格化成贴图，滚动时不重绘文字和阴影。
    // 一列约两屏高，做成一张贴图会超过很多 GPU 的上限（4096px），超了 Android 就悄悄退回每帧重画文字和字影；
    // 所以拆成上下两段各一张，每段多留 PAD 给字影，两段在接缝处重叠
    return (
        <Animated.View style={[styles.column, { left: x, width: size, animationPlayState: still ? 'paused' : 'running' }, motion]}>
            {[0, 1].map((k) => (
                <View
                    key={k}
                    style={{ height: loop + PAD * 2, marginTop: k === 0 ? -PAD : -PAD * 2, paddingTop: PAD }}
                    shouldRasterizeIOS
                    renderToHardwareTextureAndroid
                >
                    <Text style={[styles.glyphs, { fontSize: size, lineHeight }, ink]} allowFontScaling={false}>{text}</Text>
                </View>
            ))}
        </Animated.View>
    );
}

function Field({ layers }: { layers: Layer[] }) {
    const { theme } = useTheme();
    const [loaded] = useFonts(FONT_SOURCE);
    const { width, height } = useWindowDimensions();
    // 被新页面盖住或切到别的页签时停下：栈里每页各有一套经幡，不停的话会叠着一起跑
    const reduceMotion = useReducedMotion();
    const focused = useIsFocused();
    const still = reduceMotion || !focused;
    const shown = useSharedValue(0);
    const scaleX = width / 390;
    const scaleSize = Math.min(1.25, Math.max(0.9, scaleX));

    useEffect(() => {
        if (loaded) shown.value = withTiming(1, { duration: still ? 0 : 600 });
    }, [loaded, still, shown]);

    const fade = useAnimatedStyle(() => ({
        opacity: shown.value * bannerLevel.value * (1 - 0.65 * ringLevel.value),
    }));

    // 字体到之前不画：否则会先用系统字体闪出普通汉字
    if (!loaded) return null;

    return (
        <Animated.View style={[styles.fill, fade]} pointerEvents="none" aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {layers.map(layer => (
                <View key={layer} style={[styles.fill, { opacity: LAYER_OPACITY[theme][layer] }]}>
                    {COLUMNS[layer].map(([x, size], k) => (
                        <Column
                            key={k}
                            index={FIRST_INDEX[layer] + k}
                            x={x * scaleX}
                            size={Math.round(size * scaleSize)}
                            layer={layer}
                            theme={theme}
                            screenHeight={height}
                            still={still}
                        />
                    ))}
                </View>
            ))}
        </Animated.View>
    );
}

/** 全局背景里的经幡：远、中、焦三层 */
export function YunZhuanBanners() {
    return <Field layers={['far', 'mid', 'focus']} />;
}

/** 首页压在界面之上的前景层：贴屏幕两边、最虚最快 */
export function YunZhuanForeground() {
    return <Field layers={['near']} />;
}

const styles = StyleSheet.create({
    fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, overflow: 'hidden' },
    column: { position: 'absolute', top: 0 },
    glyphs: { fontFamily: FONT, textAlign: 'center' },
});
