import React, { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { ZIWEI_VIEWS, ZIWEI_MUTAGEN_ORDER, type ZiweiTrack, type ZiweiTrackItem, type ZiweiView } from '../scope-layer';
import { ZIWEI_STAGE } from './layout';
import { ganzhiColor, type ZiweiPalette } from './palette';

const CELL_WIDTH = 54;
const CELL_GAP = 6;

function makeAxisStyles(palette: ZiweiPalette) {
    const base = { includeFontPadding: false } as const;
    return StyleSheet.create({
        card: {
            height: ZIWEI_STAGE.axisHeight,
            paddingHorizontal: 10,
            paddingVertical: 8,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: palette.cardBorder,
            backgroundColor: palette.card,
        },
        segRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
        seg: {
            flex: 1,
            height: 32,
            flexDirection: 'row',
            padding: 2,
            borderRadius: 16,
            backgroundColor: palette.segTrack,
        },
        segBtn: {
            flex: 1,
            height: 28,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
        },
        segBtnOn: { borderColor: palette.segBorder, backgroundColor: palette.segOn },
        segText: { ...base, fontSize: 13, lineHeight: 18, color: palette.muted },
        segTextOn: { color: palette.ink, fontWeight: '600' },
        today: {
            width: 32,
            height: 32,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: palette.goldBorder,
            backgroundColor: palette.goldSoft,
            alignItems: 'center',
            justifyContent: 'center',
        },
        todayText: { ...base, fontSize: 13, lineHeight: 18, fontWeight: '700', color: palette.gold },
        trackRow: { marginTop: 8, height: 50, flexDirection: 'row', alignItems: 'center' },
        parent: {
            height: 50,
            marginRight: 6,
            paddingHorizontal: 2,
            flexDirection: 'row',
            alignItems: 'center',
            borderRadius: 8,
            backgroundColor: palette.segTrack,
        },
        parentArrow: { width: 22, height: 50, alignItems: 'center', justifyContent: 'center' },
        parentArrowDisabled: { opacity: 0.3 },
        parentLabel: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2, minWidth: 34 },
        parentText: { ...base, fontSize: 11.5, lineHeight: 15, fontWeight: '600', color: palette.ink, fontVariant: ['tabular-nums'] },
        parentGz: { ...base, marginTop: 2, fontSize: 13, lineHeight: 17, fontWeight: '700' },
        cell: {
            width: CELL_WIDTH,
            height: 50,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: palette.hairline,
            backgroundColor: palette.trackCell,
            alignItems: 'center',
            justifyContent: 'center',
        },
        cellOn: { borderWidth: 1.5, borderColor: palette.gold, backgroundColor: palette.goldSoft },
        dot: { position: 'absolute', top: 4, right: 4, width: 5, height: 5, borderRadius: 3, backgroundColor: palette.vermilion },
        cellTop: { ...base, fontSize: 11.5, lineHeight: 15, fontWeight: '600', color: palette.ink, fontVariant: ['tabular-nums'] },
        cellGz: { ...base, marginTop: 2, fontSize: 15, lineHeight: 19, fontWeight: '700' },
        cellSub: { ...base, fontSize: 9.5, lineHeight: 12, color: palette.muted, fontVariant: ['tabular-nums'] },
        natalRow: { marginTop: 8, height: 50, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 4 },
        natalLabel: { ...base, fontSize: 12, lineHeight: 16, color: palette.muted },
        natalItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
        natalStar: { ...base, fontSize: 13, lineHeight: 18, color: palette.ink },
        natalChip: { width: 15, height: 15, borderRadius: 3, alignItems: 'center', justifyContent: 'center' },
        natalChipText: { ...base, fontSize: 10, lineHeight: 13, fontWeight: '700' },
    });
}

type AxisStyles = ReturnType<typeof makeAxisStyles>;

function Chevron({ direction, color }: { direction: 'left' | 'right'; color: string }) {
    return (
        <Svg width={14} height={14} viewBox="0 0 24 24">
            <Path
                d={direction === 'left' ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'}
                stroke={color}
                strokeWidth={2.2}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
            />
        </Svg>
    );
}

function GanzhiText({ text, palette, style }: { text: string; palette: ZiweiPalette; style: any }) {
    return (
        <Text style={style}>
            {text.split('').map((char, index) => (
                <Text key={index} style={{ color: ganzhiColor(char, palette) }}>{char}</Text>
            ))}
        </Text>
    );
}

const returnTrue = () => true;

/**
 * 时间轴格子：用最轻的响应者 View 而不是 Pressable，且只在自己的文字或高亮变了时重画。
 * 点击回调按 key 取最新一轮的数据，所以格子不必因为回调换了身份而重画。
 */
const TrackCell = memo(function TrackCell({
    item,
    palette,
    styles,
    onPressKey,
}: {
    item: ZiweiTrackItem;
    palette: ZiweiPalette;
    styles: AxisStyles;
    onPressKey: (key: string) => void;
}) {
    const handleRelease = useCallback(() => onPressKey(item.key), [item.key, onPressKey]);
    return (
        <View
            onStartShouldSetResponder={returnTrue}
            onResponderRelease={handleRelease}
            style={[styles.cell, item.active && styles.cellOn]}
            accessible
            accessibilityRole="button"
            accessibilityState={{ selected: item.active }}
            accessibilityLabel={`${item.top} ${item.ganzhi}`}
            onAccessibilityTap={handleRelease}
        >
            {item.active ? <View style={styles.dot} /> : null}
            <Text style={styles.cellTop}>{item.top}</Text>
            <GanzhiText text={item.ganzhi} palette={palette} style={styles.cellGz} />
        </View>
    );
}, (prev, next) => (
    prev.item.key === next.item.key
    && prev.item.active === next.item.active
    && prev.item.top === next.item.top
    && prev.item.ganzhi === next.item.ganzhi
    && prev.palette === next.palette
    && prev.styles === next.styles
    && prev.onPressKey === next.onPressKey
));

const SegmentRow = memo(function SegmentRow({
    view,
    styles,
    onChangeView,
    onToday,
}: {
    view: ZiweiView;
    styles: AxisStyles;
    onChangeView: (view: ZiweiView) => void;
    onToday: () => void;
}) {
    return (
        <View style={styles.segRow}>
            <View style={styles.seg}>
                {ZIWEI_VIEWS.map((item) => {
                    const on = item.key === view;
                    return (
                        <Pressable
                            key={item.key}
                            style={[styles.segBtn, on && styles.segBtnOn]}
                            onPress={() => onChangeView(item.key)}
                            accessibilityRole="tab"
                            accessibilityState={{ selected: on }}
                        >
                            <Text style={[styles.segText, on && styles.segTextOn]}>{item.label}</Text>
                        </Pressable>
                    );
                })}
            </View>
            <Pressable style={styles.today} onPress={onToday} accessibilityRole="button" accessibilityLabel="回到今天">
                <Text style={styles.todayText}>今</Text>
            </Pressable>
        </View>
    );
});

const ParentBlock = memo(function ParentBlock({
    label,
    ganzhi,
    hasPrev,
    hasNext,
    palette,
    styles,
    onStep,
    onUp,
}: {
    label: string;
    ganzhi: string;
    hasPrev: boolean;
    hasNext: boolean;
    palette: ZiweiPalette;
    styles: AxisStyles;
    onStep: (direction: -1 | 1) => void;
    onUp: () => void;
}) {
    return (
        <View style={styles.parent}>
            <Pressable
                style={[styles.parentArrow, !hasPrev && styles.parentArrowDisabled]}
                disabled={!hasPrev}
                onPress={() => onStep(-1)}
                accessibilityLabel="上一段"
            >
                <Chevron direction="left" color={palette.muted} />
            </Pressable>
            <Pressable style={styles.parentLabel} onPress={onUp} accessibilityLabel={`回到${label}`}>
                <Text style={styles.parentText}>{label}</Text>
                {ganzhi ? <GanzhiText text={ganzhi} palette={palette} style={styles.parentGz} /> : null}
            </Pressable>
            <Pressable
                style={[styles.parentArrow, !hasNext && styles.parentArrowDisabled]}
                disabled={!hasNext}
                onPress={() => onStep(1)}
                accessibilityLabel="下一段"
            >
                <Chevron direction="right" color={palette.muted} />
            </Pressable>
        </View>
    );
});

export interface ZiweiTimeAxisProps {
    view: ZiweiView;
    track: ZiweiTrack;
    natalMutagenStars: string[];
    palette: ZiweiPalette;
    onChangeView: (view: ZiweiView) => void;
    onChangeCursor: (cursor: Date) => void;
    onToday: () => void;
}

function ZiweiTimeAxisBase({
    view,
    track,
    natalMutagenStars,
    palette,
    onChangeView,
    onChangeCursor,
    onToday,
}: ZiweiTimeAxisProps) {
    const styles = useMemo(() => makeAxisStyles(palette), [palette]);
    const scrollRef = useRef<ScrollView>(null);
    const trackRef = useRef(track);
    trackRef.current = track;
    const handlePressKey = useCallback((key: string) => {
        const item = trackRef.current.items.find((candidate) => candidate.key === key);
        if (item && !item.active) {
            onChangeCursor(item.resolve());
        }
    }, [onChangeCursor]);

    // 换了一条轨道时把当前项放到左侧第二格；同一条轨道里点到的格子本来就在眼前，不再滚动
    // （滚动会强制同步排版，点一下流年能省出一整帧）
    const offsetRef = useRef(0);
    const viewportRef = useRef(0);
    const shapeRef = useRef('');
    useEffect(() => {
        if (track.activeIndex < 0) {
            return;
        }
        const shape = `${track.view}|${track.items.length}|${track.items[0]?.key ?? ''}`;
        const sameShape = shape === shapeRef.current;
        shapeRef.current = shape;
        const start = (CELL_WIDTH + CELL_GAP) * track.activeIndex;
        const offset = offsetRef.current;
        if (sameShape && viewportRef.current > 0 && start >= offset && start + CELL_WIDTH <= offset + viewportRef.current) {
            return;
        }
        const x = Math.max(0, start - (CELL_WIDTH + CELL_GAP));
        if (Math.abs(x - offset) < 1 && sameShape) {
            return;
        }
        offsetRef.current = x;
        scrollRef.current?.scrollTo({ x, animated: false });
    }, [track]);
    const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
        offsetRef.current = event.nativeEvent.contentOffset.x;
    }, []);
    const handleViewport = useCallback((event: LayoutChangeEvent) => {
        viewportRef.current = event.nativeEvent.layout.width;
    }, []);

    const parent = track.parent;
    const handleParentStep = useCallback((direction: -1 | 1) => {
        const current = trackRef.current.parent;
        const resolve = direction < 0 ? current?.prev : current?.next;
        if (resolve) {
            onChangeCursor(resolve());
        }
    }, [onChangeCursor]);
    const handleParentUp = useCallback(() => {
        const current = trackRef.current.parent;
        if (current) {
            onChangeView(current.view);
        }
    }, [onChangeView]);

    return (
        <View style={styles.card}>
            <SegmentRow view={view} styles={styles} onChangeView={onChangeView} onToday={onToday} />

            {view === 'natal' ? (
                <View style={styles.natalRow}>
                    <Text style={styles.natalLabel}>生年四化</Text>
                    {ZIWEI_MUTAGEN_ORDER.map((mutagen, order) => (natalMutagenStars[order] ? (
                        <View key={mutagen} style={styles.natalItem}>
                            <View style={[styles.natalChip, { backgroundColor: palette.mutagen[mutagen] }]}>
                                <Text style={[styles.natalChipText, { color: mutagen === '忌' ? palette.jiText : palette.sealText }]}>{mutagen}</Text>
                            </View>
                            <Text style={styles.natalStar}>{natalMutagenStars[order]}</Text>
                        </View>
                    ) : null))}
                </View>
            ) : (
                <View style={styles.trackRow}>
                    {parent ? (
                        <ParentBlock
                            label={parent.label}
                            ganzhi={parent.ganzhi}
                            hasPrev={Boolean(parent.prev)}
                            hasNext={Boolean(parent.next)}
                            palette={palette}
                            styles={styles}
                            onStep={handleParentStep}
                            onUp={handleParentUp}
                        />
                    ) : null}
                    <ScrollView
                        ref={scrollRef}
                        style={{ flex: 1 }}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        onScroll={handleScroll}
                        scrollEventThrottle={48}
                        onLayout={handleViewport}
                        contentContainerStyle={{ gap: CELL_GAP }}
                    >
                        {track.items.map((item) => (
                            <TrackCell key={item.key} item={item} palette={palette} styles={styles} onPressKey={handlePressKey} />
                        ))}
                    </ScrollView>
                </View>
            )}
        </View>
    );
}

export const ZiweiTimeAxis = memo(ZiweiTimeAxisBase);
