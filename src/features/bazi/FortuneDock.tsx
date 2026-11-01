import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import type { ResultPalette } from '../../theme/result-palette';
import { EASE_OUT } from '../../theme/motion';
import { getGanZhiElement } from './wuxing';
import type { DenseTrackCellView } from './types';

export interface FortuneDockLevel {
    /** 页签名：大运 / 小运 / 流年 / 流月 / 流日 / 流时 */
    name: string;
    ganZhi: string;
    /** 还没加进盘面的层，页签上的干支淡一些 */
    ghost: boolean;
    /** 顶上说明行，日期写明阳历 */
    info: string;
    cells: DenseTrackCellView[];
    onSelect: (cell: DenseTrackCellView) => void;
}

const CELL_WIDTH = 54;
const CELL_GAP = 2;
const TRACK_PAD = 2;
const SWEEP_SIZE = 480;

/**
 * 专业细盘底部的浮岛运程坞：说明行 + 当前层的一行格子 + 五层分段页签。
 * 再点当前页签收起，只剩页签；每次换选中，金光沿描边扫一圈。
 */
const FortuneDock: React.FC<{
    levels: FortuneDockLevel[];
    activeLevel: number;
    open: boolean;
    onLevelPress: (level: number) => void;
    /** 选中变了就换一个值，触发描边扫光 */
    selectionKey: string;
    bottom: number;
    onLayout: (event: LayoutChangeEvent) => void;
    palette: ResultPalette;
}> = ({ levels, activeLevel, open, onLevelPress, selectionKey, bottom, onLayout, palette }) => {
    const styles = useMemo(() => makeStyles(palette), [palette]);
    const level = levels[activeLevel];

    return (
        <View style={[styles.shadow, { bottom }]} onLayout={onLayout}>
            <View style={styles.ring}>
                <Sweep selectionKey={selectionKey} color={palette.gold} />
                <View style={styles.inner}>
                    {open && level ? (
                        <>
                            <Text style={styles.info} numberOfLines={1}>{level.info}</Text>
                            <DockTrack level={level} palette={palette} styles={styles} />
                        </>
                    ) : null}
                    <View style={styles.segTrack} accessibilityRole="tablist">
                        {levels.map((item, index) => {
                            const active = index === activeLevel;
                            return (
                                <Pressable
                                    key={item.name}
                                    onPress={() => onLevelPress(index)}
                                    style={({ pressed }) => [styles.seg, active && styles.segOn, pressed && styles.pressed]}
                                    accessibilityRole="tab"
                                    accessibilityState={{ selected: active }}
                                    accessibilityLabel={`${item.name} ${item.ganZhi}${active ? (open ? '，再点收起' : '，再点展开') : ''}`}
                                >
                                    <Text style={[styles.segName, active && styles.segNameOn]}>{item.name}</Text>
                                    <GanZhiText value={item.ganZhi} style={[styles.segValue, item.ghost && styles.ghost]} palette={palette} />
                                </Pressable>
                            );
                        })}
                    </View>
                </View>
            </View>
        </View>
    );
};

const GanZhiText: React.FC<{ value: string; style: any; palette: ResultPalette }> = ({ value, style, palette }) => (
    <Text style={style}>
        {value.split('').map((char, index) => {
            const element = getGanZhiElement(char);
            return <Text key={`${char}-${index}`} style={{ color: element ? palette.element[element] : palette.muted }}>{char}</Text>;
        })}
    </Text>
);

const DockTrack: React.FC<{ level: FortuneDockLevel; palette: ResultPalette; styles: Styles }> = ({ level, palette, styles }) => {
    const scrollRef = useRef<ScrollView>(null);
    const [viewportWidth, setViewportWidth] = useState(0);
    const hasScrolledRef = useRef(false);
    const activeIndex = level.cells.findIndex((cell) => cell.active);
    const cellCount = level.cells.length;

    useEffect(() => {
        if (viewportWidth <= 0 || activeIndex < 0) {
            return;
        }
        // 选中格居中，滚到头时贴边
        const step = CELL_WIDTH + CELL_GAP;
        const contentWidth = cellCount * step - CELL_GAP + TRACK_PAD * 2;
        const x = Math.max(0, Math.min(activeIndex * step + TRACK_PAD - (viewportWidth - CELL_WIDTH) / 2, contentWidth - viewportWidth));
        scrollRef.current?.scrollTo({ x, animated: hasScrolledRef.current });
        hasScrolledRef.current = true;
    }, [activeIndex, cellCount, viewportWidth]);

    return (
        <ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.trackContent}
            onLayout={(event) => setViewportWidth(Math.round(event.nativeEvent.layout.width))}
            accessibilityLabel={`${level.name}，可左右滑动查看更多`}
        >
            {level.cells.map((cell) => {
                const notes = [cell.primaryText.slice(1), cell.secondaryText.slice(1)].filter(Boolean).join(' ');
                return (
                    <Pressable
                        key={cell.key}
                        onPress={() => level.onSelect(cell)}
                        disabled={!cell.selectable}
                        style={({ pressed }) => [styles.cell, cell.active && styles.cellOn, pressed && styles.pressed]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: cell.active }}
                        accessibilityLabel={`${cell.topLabel} ${cell.subLabel} ${cell.primaryText.charAt(0)}${cell.secondaryText.charAt(0)}${cell.isCurrent ? ' 此刻' : ''}`}
                    >
                        {cell.isCurrent ? <View style={styles.dot} /> : null}
                        <Text style={[styles.cellTop, cell.active && styles.cellTopOn]} numberOfLines={1}>{cell.topLabel}</Text>
                        <GanZhiText value={`${cell.primaryText.charAt(0)}${cell.secondaryText.charAt(0)}`} style={styles.cellGlyph} palette={palette} />
                        <Text style={[styles.cellSub, cell.active && styles.cellSubOn]} numberOfLines={1}>{cell.subLabel.replace('~', '–')}</Text>
                        <Text style={styles.cellNote} numberOfLines={1}>{notes || ' '}</Text>
                    </Pressable>
                );
            })}
        </ScrollView>
    );
};

/** 描边后面的一张渐变，换选中时转一圈再淡出；不是循环动画，系统减弱动态效果时不播 */
const Sweep: React.FC<{ selectionKey: string; color: string }> = ({ selectionKey, color }) => {
    const reduceMotion = useReducedMotion();
    const rotation = useSharedValue(0);
    const opacity = useSharedValue(0);
    const firstKeyRef = useRef(selectionKey);

    useEffect(() => {
        if (reduceMotion || selectionKey === firstKeyRef.current) {
            return;
        }
        firstKeyRef.current = selectionKey;
        rotation.value = 0;
        opacity.value = 1;
        rotation.value = withTiming(360, { duration: 1100, easing: EASE_OUT });
        opacity.value = withDelay(820, withTiming(0, { duration: 280 }));
    }, [opacity, reduceMotion, rotation, selectionKey]);

    const style = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ rotate: `${rotation.value}deg` }],
    }));

    // 外面再裁一层：渐变比浮岛大得多，不裁的话网页端会把描边外框撑成可滚动，聚焦按钮时整块内容被滚走
    return (
        <View pointerEvents="none" style={sweepStyles.clip}>
            <Animated.View style={[sweepStyles.sweep, style]}>
                <LinearGradient
                    colors={['transparent', color]}
                    locations={[0.4, 1]}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={sweepStyles.fill}
                />
            </Animated.View>
        </View>
    );
};

const sweepStyles = StyleSheet.create({
    clip: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, overflow: 'hidden' },
    sweep: {
        position: 'absolute',
        left: '50%',
        top: '50%',
        width: SWEEP_SIZE,
        height: SWEEP_SIZE,
        marginLeft: -SWEEP_SIZE / 2,
        marginTop: -SWEEP_SIZE / 2,
    },
    fill: { width: SWEEP_SIZE, height: SWEEP_SIZE },
});

type Styles = ReturnType<typeof makeStyles>;

const makeStyles = (palette: ResultPalette) => StyleSheet.create({
    // 投影放在外层：内层要裁圆角，裁了就带不出投影
    shadow: {
        position: 'absolute',
        left: 12,
        right: 12,
        borderRadius: 20,
        backgroundColor: palette.cardBorder,
        shadowColor: palette.ink,
        shadowOpacity: 0.15,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 6,
    },
    ring: { padding: 1, borderRadius: 20, overflow: 'hidden' },
    inner: { borderRadius: 19, backgroundColor: palette.card, padding: 6 },
    info: { height: 22, paddingHorizontal: 8, paddingTop: 2, fontSize: 11, lineHeight: 16, color: palette.muted },
    trackContent: { gap: CELL_GAP, paddingHorizontal: TRACK_PAD, paddingBottom: 4 },
    cell: {
        position: 'relative',
        width: CELL_WIDTH,
        height: 76,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
    },
    cellOn: { borderColor: palette.goldBorder, backgroundColor: palette.dayTint },
    dot: { position: 'absolute', top: 4, right: 4, width: 5, height: 5, borderRadius: 3, backgroundColor: palette.vermilion },
    cellTop: { fontSize: 10, lineHeight: 13, color: palette.muted, fontVariant: ['tabular-nums'] },
    cellTopOn: { fontWeight: '600', color: palette.gold },
    cellGlyph: { fontSize: 17, lineHeight: 22, fontWeight: '700' },
    cellSub: { fontSize: 10, lineHeight: 12, color: palette.muted, fontVariant: ['tabular-nums'] },
    cellSubOn: { color: palette.ink },
    cellNote: { fontSize: 10, lineHeight: 12, color: palette.muted },
    segTrack: { flexDirection: 'row', height: 44, padding: 3, borderRadius: 14, backgroundColor: palette.segTrack },
    seg: {
        flex: 1,
        minWidth: 0,
        borderRadius: 11,
        borderWidth: 1,
        borderColor: 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
    },
    segOn: { borderColor: palette.segBorder, backgroundColor: palette.segOn },
    segName: { fontSize: 10, lineHeight: 13, color: palette.muted },
    segNameOn: { fontWeight: '600', color: palette.ink },
    segValue: { fontSize: 14, lineHeight: 18, fontWeight: '700' },
    ghost: { opacity: 0.45 },
    pressed: { opacity: 0.7 },
});

export default FortuneDock;
