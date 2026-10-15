import React, { useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import type { ZiweiDynamicHoroscopeResult, ZiweiDynamicScope, ZiweiMutagen, ZiweiPalaceAnalysisView } from '../types';
import { lunarMonthLabel, palaceShortLabel, parseMutKey, verticalTextOf, type ZiweiCursorInfo, type ZiweiView } from '../scope-layer';
import { ChevronIcon } from './ZiweiChrome';
import { GanzhiSpan } from './ZiweiPalaceDetail';
import type { ZiweiPalette } from './palette';

const base = { includeFontPadding: false } as const;
const DOUBLE_TAP_MS = 250;
const SCOPE_ROWS: Array<{ scope: ZiweiDynamicScope; label: string; prefix: string }> = [
    { scope: 'decadal', label: '大限', prefix: '限' },
    { scope: 'yearly', label: '流年', prefix: '年' },
    { scope: 'monthly', label: '流月', prefix: '月' },
];

export interface ZiweiZoomCardProps {
    /** 是否展开；收起后组件留在后台（display: none），下次双击只剩动画 */
    open: boolean;
    /** 展示的宫位；收起时页面继续传上一次的宫位 */
    palace: ZiweiPalaceAnalysisView | null;
    prevName: string;
    nextName: string;
    dynamic: ZiweiDynamicHoroscopeResult | null;
    cursorInfo: ZiweiCursorInfo | null;
    view: ZiweiView;
    mutKey: string;
    /** 卡片中心落点（窗口坐标，取棋盘中心） */
    anchorY: number;
    width: number;
    palette: ZiweiPalette;
    onClose: () => void;
    /** 收起动画走完 */
    onClosed?: () => void;
    onStep: (direction: -1 | 1) => void;
    onOpenDetail: () => void;
}

function Chip({ mutagen, filled, palette, size }: { mutagen: ZiweiMutagen; filled: boolean; palette: ZiweiPalette; size: number }) {
    const color = palette.mutagen[mutagen];
    return (
        <View style={[{ width: size, height: size, borderRadius: 3, alignItems: 'center', justifyContent: 'center' }, filled ? { backgroundColor: color } : { borderWidth: 1, borderColor: color }]}>
            <Text style={{ ...base, fontSize: size - 6, lineHeight: size - 3, fontWeight: '700', color: filled ? (mutagen === '忌' ? palette.jiText : palette.sealText) : color }}>{mutagen}</Text>
        </View>
    );
}

const HIDDEN = { display: 'none' as const };

export function ZiweiZoomCard({
    open,
    palace,
    prevName,
    nextName,
    dynamic,
    cursorInfo,
    view,
    mutKey,
    anchorY,
    width,
    palette,
    onClose,
    onClosed,
    onStep,
    onOpenDetail,
}: ZiweiZoomCardProps) {
    const progress = useSharedValue(0);
    const lastTapRef = useRef(0);
    const visible = open && Boolean(palace);
    const shown = palace;
    const [hidden, setHidden] = React.useState(!visible);
    const [cardHeight, setCardHeight] = React.useState(380);
    const handleHidden = React.useCallback(() => {
        setHidden(true);
        onClosed?.();
    }, [onClosed]);

    useEffect(() => {
        if (visible) {
            setHidden(false);
            progress.value = withTiming(1, { duration: 180 });
        } else {
            progress.value = withTiming(0, { duration: 150 }, (finished) => {
                if (finished) {
                    runOnJS(handleHidden)();
                }
            });
        }
    }, [handleHidden, progress, visible]);

    const scrimStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
    const cardStyle = useAnimatedStyle(() => ({
        opacity: progress.value,
        transform: [{ scale: 0.86 + progress.value * 0.14 }],
    }));

    const styles = useMemo(() => StyleSheet.create({
        root: { ...StyleSheet.absoluteFill, zIndex: 15, elevation: 15 },
        scrim: { ...StyleSheet.absoluteFill, backgroundColor: palette.scrim },
        card: {
            position: 'absolute',
            left: 16,
            borderRadius: 16,
            borderWidth: 1.5,
            borderColor: palette.vermilion,
            backgroundColor: palette.card,
            overflow: 'hidden',
            shadowColor: '#000',
            shadowOpacity: 0.3,
            shadowRadius: 24,
            shadowOffset: { width: 0, height: 12 },
            elevation: 12,
        },
        stars: { paddingHorizontal: 18, paddingTop: 18, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', columnGap: 12, rowGap: 10 },
        col: { alignItems: 'center' },
        major: { ...base, fontSize: 26, lineHeight: 28, fontWeight: '700', color: palette.heading, textAlign: 'center' },
        minor: { ...base, fontSize: 19, lineHeight: 21, fontWeight: '500', color: palette.body, textAlign: 'center' },
        adj: { ...base, fontSize: 16, lineHeight: 18, color: palette.muted, textAlign: 'center' },
        bright: { ...base, marginTop: 3, fontSize: 12, lineHeight: 15, color: palette.faint },
        chips: { marginTop: 4, flexDirection: 'row', gap: 2 },
        empty: { ...base, fontSize: 15, lineHeight: 22, color: palette.faint },
        scopes: { marginTop: 16, marginHorizontal: 10, gap: 2 },
        scopeRow: { height: 30, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, borderRadius: 8 },
        scopeRowOn: { backgroundColor: palette.selectedTint },
        scopeLabel: { ...base, width: 76, fontSize: 12, lineHeight: 16, color: palette.muted, fontVariant: ['tabular-nums'] },
        scopeLabelOn: { color: palette.ink, fontWeight: '600' },
        tag: { paddingHorizontal: 5, borderRadius: 4, borderWidth: 1, borderColor: palette.goldBorder, backgroundColor: palette.goldSoft },
        tagText: { ...base, fontSize: 12, lineHeight: 18, fontWeight: '600', color: palette.gold },
        flows: { ...base, flexShrink: 1, fontSize: 13, lineHeight: 18, color: palette.gold },
        footer: {
            marginTop: 14,
            marginHorizontal: 18,
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: palette.hairline,
            flexDirection: 'row',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
        },
        gods: { width: 132, flexDirection: 'row', flexWrap: 'wrap', rowGap: 3 },
        god: { width: 66, flexDirection: 'row', alignItems: 'baseline', gap: 5 },
        godLabel: { ...base, fontSize: 11, lineHeight: 15, color: palette.faint },
        godValue: { ...base, fontSize: 13, lineHeight: 15, color: palette.body },
        nameBlock: { alignItems: 'center' },
        name: { ...base, fontSize: 24, lineHeight: 30, fontWeight: '700', color: palette.vermilion },
        range: { ...base, fontSize: 12, lineHeight: 16, color: palette.muted, fontVariant: ['tabular-nums'] },
        gz: { ...base, fontSize: 22, lineHeight: 25, fontWeight: '700', textAlign: 'center' },
        nav: {
            marginTop: 14,
            height: 46,
            borderTopWidth: 1,
            borderTopColor: palette.hairline,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 14,
        },
        navSide: { flexDirection: 'row', alignItems: 'center', gap: 2, minWidth: 64, height: 46 },
        navText: { ...base, fontSize: 13, lineHeight: 18, color: palette.muted },
        detailBtn: {
            height: 30,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 2,
            paddingHorizontal: 14,
            borderRadius: 15,
            borderWidth: 1,
            borderColor: palette.goldBorder,
            backgroundColor: palette.goldSoft,
        },
        detailText: { ...base, fontSize: 13, lineHeight: 18, fontWeight: '600', color: palette.gold },
        hint: { position: 'absolute', left: 0, right: 0, textAlign: 'center', fontSize: 12, lineHeight: 18, color: 'rgba(255,250,240,0.82)' },
    }), [palette]);

    const swipe = useMemo(() => Gesture.Pan()
        .activeOffsetX([-20, 20])
        .onEnd((event) => {
            if (Math.abs(event.translationX) > 50) {
                runOnJS(onStep)(event.translationX < 0 ? 1 : -1);
            }
        }), [onStep]);

    if (!shown) {
        return null;
    }

    const scopeMutagens = parseMutKey(mutKey);
    const handleCardPress = () => {
        const now = Date.now();
        if (now - lastTapRef.current < DOUBLE_TAP_MS) {
            lastTapRef.current = 0;
            onClose();
            return;
        }
        lastTapRef.current = now;
    };
    const top = Math.max(24, anchorY - cardHeight / 2);
    const range = shown.decadalRange.replace(/[^\d–-]/g, '').replace('-', '–');
    const starCount = shown.majorStars.length + shown.minorStars.length + shown.adjectiveStars.length;

    return (
        <View style={[styles.root, hidden && HIDDEN]} pointerEvents={visible ? 'auto' : 'none'} aria-hidden={!visible}>
            <Animated.View style={[styles.scrim, scrimStyle]}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="收起放大" />
            </Animated.View>
            <GestureDetector gesture={swipe}>
                <Animated.View
                    style={[styles.card, { top, width: width - 32 }, cardStyle]}
                    onLayout={(event) => {
                        const next = Math.round(event.nativeEvent.layout.height);
                        if (next > 0) {
                            setCardHeight((current) => (current === next ? current : next));
                        }
                    }}
                >
                    <Pressable onPress={handleCardPress}>
                        <View style={styles.stars}>
                            {shown.majorStars.map((star) => (
                                <View key={star.name} style={styles.col}>
                                    <Text style={styles.major}>{verticalTextOf(star.name)}</Text>
                                    <Text style={styles.bright}>{star.brightness || ' '}</Text>
                                    {star.mutagen || scopeMutagens[star.name] ? (
                                        <View style={styles.chips}>
                                            {star.mutagen ? <Chip mutagen={star.mutagen as ZiweiMutagen} filled palette={palette} size={18} /> : null}
                                            {scopeMutagens[star.name] ? <Chip mutagen={scopeMutagens[star.name]} filled={false} palette={palette} size={18} /> : null}
                                        </View>
                                    ) : null}
                                </View>
                            ))}
                            {shown.minorStars.map((star) => (
                                <View key={star.name} style={styles.col}>
                                    <Text style={styles.minor}>{verticalTextOf(star.name)}</Text>
                                    <Text style={styles.bright}>{star.brightness || ' '}</Text>
                                    {star.mutagen || scopeMutagens[star.name] ? (
                                        <View style={styles.chips}>
                                            {star.mutagen ? <Chip mutagen={star.mutagen as ZiweiMutagen} filled palette={palette} size={16} /> : null}
                                            {scopeMutagens[star.name] ? <Chip mutagen={scopeMutagens[star.name]} filled={false} palette={palette} size={16} /> : null}
                                        </View>
                                    ) : null}
                                </View>
                            ))}
                            {shown.adjectiveStars.map((star) => (
                                <View key={star.name} style={styles.col}>
                                    <Text style={styles.adj}>{verticalTextOf(star.name)}</Text>
                                </View>
                            ))}
                            {starCount === 0 ? <Text style={styles.empty}>空宫</Text> : null}
                        </View>

                        {dynamic && cursorInfo ? (
                            <View style={styles.scopes}>
                                {SCOPE_ROWS.map(({ scope, label, prefix }) => {
                                    const snapshot = dynamic.runtimeSnapshot.scopes[scope];
                                    const role = snapshot.palaceNames[shown.palaceIndex] || '';
                                    const flows = (snapshot.starNamesByPalaceIndex[shown.palaceIndex] || []).join(' ');
                                    const on = view === scope;
                                    const when = scope === 'decadal'
                                        ? (dynamic.horoscopeNow.astrolabe.palaces[dynamic.horoscopeNow.decadal.index]?.decadal.range || []).join('–')
                                        : scope === 'yearly'
                                            ? `${cursorInfo.liunianYear}`
                                            : lunarMonthLabel(cursorInfo.lunarMonth, cursorInfo.isLeap);
                                    return (
                                        <View key={scope} style={[styles.scopeRow, on && styles.scopeRowOn]}>
                                            <Text style={[styles.scopeLabel, on && styles.scopeLabelOn]} numberOfLines={1}>{`${label} ${when}`}</Text>
                                            {role ? <View style={styles.tag}><Text style={styles.tagText}>{`${prefix}${palaceShortLabel(role)}`}</Text></View> : null}
                                            <Text style={styles.flows} numberOfLines={1}>{flows}</Text>
                                        </View>
                                    );
                                })}
                            </View>
                        ) : null}

                        <View style={styles.footer}>
                            <View style={styles.gods}>
                                {[
                                    ['长生', shown.changsheng12],
                                    ['博士', shown.boshi12],
                                    ['岁前', shown.suiqian12],
                                    ['将前', shown.jiangqian12],
                                ].map(([label, value]) => (
                                    <View key={label} style={styles.god}>
                                        <Text style={styles.godLabel}>{label}</Text>
                                        <Text style={styles.godValue}>{value || '—'}</Text>
                                    </View>
                                ))}
                            </View>
                            <View style={styles.nameBlock}>
                                <Text style={styles.name}>{shown.name}</Text>
                                <Text style={styles.range}>{`大限 ${range}`}</Text>
                            </View>
                            <View>
                                <GanzhiSpan text={shown.heavenlyStem} palette={palette} style={styles.gz} />
                                <GanzhiSpan text={shown.earthlyBranch} palette={palette} style={styles.gz} />
                            </View>
                        </View>
                    </Pressable>

                    <View style={styles.nav}>
                        <Pressable style={styles.navSide} onPress={() => onStep(-1)} accessibilityLabel={`上一宫 ${prevName}`}>
                            <ChevronIcon direction="left" color={palette.muted} />
                            <Text style={styles.navText}>{prevName}</Text>
                        </Pressable>
                        <Pressable style={styles.detailBtn} onPress={onOpenDetail} accessibilityRole="button">
                            <Text style={styles.detailText}>看详情</Text>
                            <ChevronIcon direction="right" color={palette.gold} />
                        </Pressable>
                        <Pressable style={[styles.navSide, { justifyContent: 'flex-end' }]} onPress={() => onStep(1)} accessibilityLabel={`下一宫 ${nextName}`}>
                            <Text style={styles.navText}>{nextName}</Text>
                            <ChevronIcon direction="right" color={palette.muted} />
                        </Pressable>
                    </View>
                </Animated.View>
            </GestureDetector>
            <Animated.Text style={[styles.hint, { top: top + cardHeight + 14 }, scrimStyle]} pointerEvents="none">
                左右滑动换宫 · 双击或点空白处收起
            </Animated.Text>
        </View>
    );
}
