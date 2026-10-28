/**
 * 冷启动动画「此刻之卦」：以此刻时间梅花起卦，自初爻起笔画到上爻，动爻转朱，再淡出到首页。
 * 原生启动图只有底色，第一帧与之相同；点按任意处跳过。首页在下面照常渲染、读库。
 * 自己的第一帧铺好后才收起原生启动图，收起之后才开播，整段动画都看得到。
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { interpolateColor, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeContext';
import { buildResultPalette, type ResultPalette } from '../theme/result-palette';
import { castMeihua, getLinePositionName, getTrigram } from '../features/meihua/engine';
import { EASE_IN_OUT, drawIn, fadeIn, riseIn } from '../theme/motion';

/** 与 app.json 里 expo-splash-screen 的 backgroundColor 一致 */
const SPLASH_BG = '#16110c';
const SERIF = Platform.select({ ios: 'Songti SC', android: 'serif', default: 'serif' });
const LINE_W = 168;
const LINE_H = 12;
const LINE_GAP = 14;
const TRIGRAM_GAP = 8;
const YIN_GAP = Math.round(LINE_W * 0.16);
const HEX_H = LINE_H * 6 + LINE_GAP * 5 + TRIGRAM_GAP;
/** 卦上卦下的文字比卦宽，两边各伸出这么多 */
const TEXT_SPAN = 120;
// 启动图收起后才开播，开头不必再留空
const EXIT_AT = 1810;

/** 第 index 爻（0 起，自下而上）距卦顶的距离 */
function lineTop(index: number): number {
    const row = 5 - index;
    return row * (LINE_H + LINE_GAP) + (row >= 3 ? TRIGRAM_GAP : 0);
}

export default function LaunchOverlay({ onDone }: { onDone: () => void }) {
    const { Colors } = useTheme();
    const palette = useMemo(() => buildResultPalette(Colors), [Colors]);
    const styles = useMemo(() => makeStyles(palette), [palette]);
    const reduceMotion = useReducedMotion();
    const cast = useMemo(() => castMeihua({ method: 'meihua_time' }, new Date()), []);
    const ground = useSharedValue(0);
    const opacity = useSharedValue(1);
    const pageBg = Colors.bg.primary as string;
    const [started, setStarted] = useState(false);
    const layoutDone = useRef(false);

    const hideSplash = () => {
        if (layoutDone.current) return;
        layoutDone.current = true;
        SplashScreen.hideAsync().catch(() => undefined).finally(() => {
            if (reduceMotion) onDone();
            else requestAnimationFrame(() => setStarted(true));
        });
    };

    useEffect(() => {
        if (!started) return;
        ground.value = withTiming(1, { duration: 520 });
        opacity.value = withDelay(EXIT_AT, withTiming(0, { duration: 460, easing: EASE_IN_OUT }, (finished) => {
            if (finished) runOnJS(onDone)();
        }));
    }, [started]);

    const rootStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        backgroundColor: interpolateColor(ground.value, [0, 1], [SPLASH_BG, pageBg]),
    }));

    const skip = () => {
        opacity.value = withTiming(0, { duration: 200 }, (finished) => {
            if (finished) runOnJS(onDone)();
        });
    };
    const { lunarInfo: lunar, ben, bian, movingLine } = cast;
    const movingYang = ben.lines[movingLine - 1] === 1;
    const delayOf = (index: number) => 180 + index * 150;

    return (
        <Animated.View style={[StyleSheet.absoluteFill, rootStyle]} onLayout={hideSplash}>
            {started ? <>
                <Pressable
                    style={StyleSheet.absoluteFill}
                    onPress={skip}
                    accessibilityRole="button"
                    accessibilityLabel={`此刻之卦 ${ben.fullName}，点按跳过`}
                />
                <View style={styles.center} pointerEvents="none">
                    {/* 卦画落在屏幕正中，时辰与卦名挂在它上下 */}
                    <View style={styles.hex}>
                        <Animated.View entering={riseIn(120, 12, 480)} style={styles.when}>
                            <Text style={styles.whenLabel}>此刻之卦</Text>
                            <Text style={styles.whenTime}>{`${lunar.yearGanZhi}年 ${lunar.lunarMonthCN}${lunar.lunarDayCN} ${lunar.hourZhi}时`}</Text>
                        </Animated.View>
                        <Animated.Text entering={fadeIn(1310)} style={[styles.trigram, { top: (lineTop(5) + lineTop(3) + LINE_H) / 2 - 9 }]}>{`${getTrigram(ben.upper).name}上`}</Animated.Text>
                        <Animated.Text entering={fadeIn(1310)} style={[styles.trigram, { top: (lineTop(2) + lineTop(0) + LINE_H) / 2 - 9 }]}>{`${getTrigram(ben.lower).name}下`}</Animated.Text>
                        {ben.lines.map((value, index) => {
                            const top = lineTop(index);
                            const delay = delayOf(index);
                            return (
                                <View key={index} style={[styles.line, { top }]}>
                                    {value === 1 ? (
                                        <Animated.View entering={drawIn(delay, 320)} style={[styles.bar, { width: LINE_W }]} />
                                    ) : (
                                        <>
                                            <Animated.View entering={drawIn(delay, 320)} style={[styles.bar, { width: (LINE_W - YIN_GAP) / 2 }]} />
                                            <Animated.View entering={drawIn(delay + 60, 320)} style={[styles.bar, { left: (LINE_W + YIN_GAP) / 2, width: (LINE_W - YIN_GAP) / 2 }]} />
                                        </>
                                    )}
                                </View>
                            );
                        })}
                        {/* 动爻画完后转朱：同形朱红层淡入盖上 */}
                        <View style={[styles.line, { top: lineTop(movingLine - 1) }]}>
                            {movingYang ? (
                                <Animated.View entering={fadeIn(1180, 520)} style={[styles.bar, styles.moving, { width: LINE_W }]} />
                            ) : (
                                <>
                                    <Animated.View entering={fadeIn(1180, 520)} style={[styles.bar, styles.moving, { width: (LINE_W - YIN_GAP) / 2 }]} />
                                    <Animated.View entering={fadeIn(1180, 520)} style={[styles.bar, styles.moving, { left: (LINE_W + YIN_GAP) / 2, width: (LINE_W - YIN_GAP) / 2 }]} />
                                </>
                            )}
                            <Animated.Text entering={fadeIn(1240, 360)} style={styles.movingMark}>{movingYang ? '○' : '×'}</Animated.Text>
                        </View>
                        <Animated.Text entering={riseIn(1360, 12, 520)} style={styles.name}>{ben.fullName}</Animated.Text>
                        <Animated.Text entering={riseIn(1460, 12, 520)} style={styles.sub}>
                            <Text style={styles.vermilion}>{`${getLinePositionName(movingLine)}动`}</Text>
                            {` · 之 ${bian.fullName}`}
                        </Animated.Text>
                    </View>
                </View>
                <Animated.View entering={fadeIn(360, 600)} style={styles.footer} pointerEvents="none">
                    <Text style={styles.brand}>见机</Text>
                    <Text style={styles.motto}>君子见几而作</Text>
                </Animated.View>
            </> : null}
        </Animated.View>
    );
}

function makeStyles(palette: ResultPalette) {
    return StyleSheet.create({
        center: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
        when: { position: 'absolute', left: -TEXT_SPAN, right: -TEXT_SPAN, bottom: HEX_H + 44, alignItems: 'center', gap: 6 },
        whenLabel: { paddingLeft: 6, fontSize: 11, lineHeight: 16, letterSpacing: 6, color: palette.muted },
        whenTime: { fontSize: 13, lineHeight: 18, letterSpacing: 2, color: palette.gold },
        hex: { width: LINE_W, height: HEX_H },
        line: { position: 'absolute', left: 0, width: LINE_W, height: LINE_H },
        bar: { position: 'absolute', top: 0, left: 0, height: LINE_H, borderRadius: 2, backgroundColor: palette.gold, transformOrigin: 'left' },
        moving: { backgroundColor: palette.vermilion },
        movingMark: { position: 'absolute', left: LINE_W + 12, top: -4, fontSize: 16, lineHeight: 20, fontWeight: '700', color: palette.vermilion },
        trigram: { position: 'absolute', left: -70, width: 56, textAlign: 'right', fontFamily: SERIF, fontSize: 13, lineHeight: 18, letterSpacing: 2, color: palette.muted },
        name: { position: 'absolute', left: -TEXT_SPAN, right: -TEXT_SPAN, top: HEX_H + 32, textAlign: 'center', paddingLeft: 8, fontFamily: SERIF, fontSize: 30, lineHeight: 40, fontWeight: '700', letterSpacing: 8, color: palette.heading },
        sub: { position: 'absolute', left: -TEXT_SPAN, right: -TEXT_SPAN, top: HEX_H + 80, textAlign: 'center', fontSize: 12.5, lineHeight: 18, color: palette.muted },
        vermilion: { color: palette.vermilion },
        footer: { position: 'absolute', left: 0, right: 0, bottom: 88, alignItems: 'center' },
        brand: { paddingLeft: 8, fontFamily: SERIF, fontSize: 20, lineHeight: 28, fontWeight: '500', letterSpacing: 8, color: palette.heading },
        motto: { marginTop: 4, paddingLeft: 4, fontSize: 11, lineHeight: 16, letterSpacing: 4, color: palette.muted },
    });
}
