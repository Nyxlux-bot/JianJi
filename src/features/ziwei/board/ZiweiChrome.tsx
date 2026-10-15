import React, { memo, useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { BackIcon, MoreVerticalIcon, SparklesIcon } from '../../../components/Icons';
import type { ZiweiMutagen, ZiweiPalaceAnalysisView } from '../types';
import { parseMutKey } from '../scope-layer';
import { GanzhiSpan } from './ZiweiPalaceDetail';
import type { ZiweiPalette } from './palette';

const base = { includeFontPadding: false } as const;

export function ChevronIcon({ direction, color, size = 14 }: { direction: 'left' | 'right' | 'up' | 'down'; color: string; size?: number }) {
    const d = {
        left: 'M15 6l-6 6 6 6',
        right: 'M9 6l6 6-6 6',
        up: 'M6 15l6-6 6 6',
        down: 'M6 9l6 6 6-6',
    }[direction];
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
            <Path d={d} stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </Svg>
    );
}

/* ------------------------------------------------------------------ */
/* 顶栏：命主信息并入，不再放标题                                         */
/* ------------------------------------------------------------------ */

export interface ZiweiTopBarProps {
    name: string;
    genderLabel: string;
    fiveElements: string;
    dateLine: string;
    aiEnabled: boolean;
    menuEnabled: boolean;
    narrow: boolean;
    palette: ZiweiPalette;
    onBack: () => void;
    onIdentity: () => void;
    onAI: () => void;
    onMenu: () => void;
}

function ZiweiTopBarBase({
    name,
    genderLabel,
    fiveElements,
    dateLine,
    aiEnabled,
    menuEnabled,
    narrow,
    palette,
    onBack,
    onIdentity,
    onAI,
    onMenu,
}: ZiweiTopBarProps) {
    const styles = useMemo(() => StyleSheet.create({
        bar: { height: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 },
        iconBtn: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
        identity: { flexShrink: 1, minWidth: 0, paddingVertical: 4 },
        nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
        name: { ...base, fontSize: 17, lineHeight: 22, fontWeight: '700', letterSpacing: 1, color: palette.heading, flexShrink: 1 },
        gender: { width: 32, height: 18, borderRadius: 3, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.vermilion },
        genderText: { ...base, fontSize: 10.5, lineHeight: 14, fontWeight: '700', letterSpacing: 1, color: palette.sealText },
        ju: { paddingHorizontal: 6, borderRadius: 4, backgroundColor: palette.chipBg },
        juText: { ...base, fontSize: 11, lineHeight: 18, fontWeight: '500', color: palette.chipInk },
        dateRow: { flexDirection: 'row', alignItems: 'center', gap: 1 },
        date: { ...base, fontSize: 11.5, lineHeight: 15, color: palette.muted, fontVariant: ['tabular-nums'] },
        spacer: { flex: 1 },
        ai: {
            height: 28,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            marginRight: 2,
            paddingLeft: 8,
            paddingRight: 10,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: palette.goldBorder,
            backgroundColor: palette.goldSoft,
        },
        aiText: { ...base, fontSize: 12, lineHeight: 16, fontWeight: '600', color: palette.gold },
        disabled: { opacity: 0.45 },
    }), [palette]);

    return (
        <View style={styles.bar}>
            <Pressable style={styles.iconBtn} onPress={onBack} accessibilityRole="button" accessibilityLabel="返回">
                <BackIcon size={22} color={palette.ink} />
            </Pressable>
            <Pressable style={styles.identity} onPress={onIdentity} accessibilityRole="button" accessibilityLabel="命盘信息">
                <View style={styles.nameRow}>
                    <Text style={styles.name} numberOfLines={1}>{name}</Text>
                    <View style={styles.gender}><Text style={styles.genderText}>{genderLabel}</Text></View>
                    {fiveElements ? <View style={styles.ju}><Text style={styles.juText}>{fiveElements}</Text></View> : null}
                </View>
                <View style={styles.dateRow}>
                    <Text style={styles.date} numberOfLines={1}>{dateLine}</Text>
                    <ChevronIcon direction="right" color={palette.faint} size={11} />
                </View>
            </Pressable>
            <View style={styles.spacer} />
            <Pressable
                style={[styles.ai, !aiEnabled && styles.disabled]}
                onPress={onAI}
                disabled={!aiEnabled}
                accessibilityRole="button"
                accessibilityLabel="AI 解盘"
            >
                <SparklesIcon size={13} color={palette.gold} />
                <Text style={styles.aiText}>{narrow ? 'AI' : 'AI 解盘'}</Text>
            </Pressable>
            <Pressable
                style={[styles.iconBtn, !menuEnabled && styles.disabled]}
                onPress={onMenu}
                disabled={!menuEnabled}
                accessibilityRole="button"
                accessibilityLabel="更多操作"
            >
                <MoreVerticalIcon size={20} color={palette.icon} />
            </Pressable>
        </View>
    );
}

export const ZiweiTopBar = memo(ZiweiTopBarBase);

/* ------------------------------------------------------------------ */
/* 底部详情条                                                           */
/* ------------------------------------------------------------------ */

export interface ZiweiPeekBarProps {
    palace: ZiweiPalaceAnalysisView | null;
    meta: string;
    mutKey: string;
    compact: boolean;
    height: number;
    bottomInset: number;
    palette: ZiweiPalette;
    onOpen: () => void;
}

function MiniChip({ mutagen, filled, palette }: { mutagen: ZiweiMutagen; filled: boolean; palette: ZiweiPalette }) {
    const color = palette.mutagen[mutagen];
    return (
        <View style={[{ width: 13, height: 13, borderRadius: 3, alignItems: 'center', justifyContent: 'center' }, filled ? { backgroundColor: color } : { borderWidth: 1, borderColor: color }]}>
            <Text style={{ ...base, fontSize: 9, lineHeight: 11, fontWeight: '700', color: filled ? (mutagen === '忌' ? palette.jiText : palette.sealText) : color }}>{mutagen}</Text>
        </View>
    );
}

function ZiweiPeekBarBase({ palace, meta, mutKey, compact, height, bottomInset, palette, onOpen }: ZiweiPeekBarProps) {
    const styles = useMemo(() => StyleSheet.create({
        bar: {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            borderTopWidth: 1,
            borderColor: palette.cardBorder,
            backgroundColor: palette.card,
            shadowColor: '#000',
            shadowOpacity: palette.isLight ? 0.08 : 0.4,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: -4 },
            elevation: 8,
        },
        handle: { position: 'absolute', left: '50%', top: 6, width: 36, height: 4, marginLeft: -18, borderRadius: 2, backgroundColor: palette.segBorder },
        row: { position: 'absolute', left: 16, right: 14, flexDirection: 'row', alignItems: 'center', gap: 6 },
        name: { ...base, fontSize: 15, lineHeight: 20, fontWeight: '700', color: palette.vermilion },
        gz: { ...base, fontSize: 13, lineHeight: 20, fontWeight: '600' },
        meta: { ...base, fontSize: 11.5, lineHeight: 16, color: palette.muted, flexShrink: 1 },
        more: { flexDirection: 'row', alignItems: 'center', gap: 2 },
        moreText: { ...base, fontSize: 12, lineHeight: 16, color: palette.muted },
        stars: { flexDirection: 'row', alignItems: 'center', gap: 8, overflow: 'hidden', flexShrink: 1 },
        star: { flexDirection: 'row', alignItems: 'center', gap: 3 },
        starMajor: { ...base, fontSize: 13, lineHeight: 18, fontWeight: '700', color: palette.heading },
        starMinor: { ...base, fontSize: 13, lineHeight: 18, color: palette.body },
        bright: { ...base, fontSize: 11, lineHeight: 14, color: palette.muted },
        rule: { width: 1, height: 12, marginHorizontal: 2, backgroundColor: palette.hairline },
    }), [palette]);

    const pan = useMemo(() => Gesture.Pan()
        .activeOffsetY(-12)
        .onEnd((event) => {
            if (event.translationY < -24) {
                runOnJS(onOpen)();
            }
        }), [onOpen]);

    if (!palace) {
        return null;
    }
    const scopeMutagens = parseMutKey(mutKey);
    const stars = (
        <View style={styles.stars}>
            {[...palace.majorStars, ...palace.minorStars].map((star, order) => {
                const major = order < palace.majorStars.length;
                return (
                    <View key={star.name} style={styles.star}>
                        <Text style={major ? styles.starMajor : styles.starMinor}>{star.name}</Text>
                        {major && star.brightness ? <Text style={styles.bright}>{star.brightness}</Text> : null}
                        {star.mutagen ? <MiniChip mutagen={star.mutagen as ZiweiMutagen} filled palette={palette} /> : null}
                        {scopeMutagens[star.name] ? <MiniChip mutagen={scopeMutagens[star.name]} filled={false} palette={palette} /> : null}
                    </View>
                );
            })}
            {palace.majorStars.length + palace.minorStars.length === 0 ? <Text style={styles.starMinor}>空宫</Text> : null}
        </View>
    );
    const more = (
        <View style={styles.more}>
            <Text style={styles.moreText}>详情</Text>
            <ChevronIcon direction="up" color={palette.muted} />
        </View>
    );

    return (
        <GestureDetector gesture={pan}>
            <Pressable
                style={[styles.bar, { height: height + bottomInset }]}
                onPress={onOpen}
                accessibilityRole="button"
                accessibilityLabel={`${palace.name}详情`}
            >
                <View style={styles.handle} />
                {compact ? (
                    <View style={[styles.row, { top: 16 }]}>
                        <Text style={styles.name}>{palace.name}</Text>
                        <GanzhiSpan text={`${palace.heavenlyStem}${palace.earthlyBranch}`} palette={palette} style={styles.gz} />
                        <View style={styles.rule} />
                        {stars}
                        <View style={{ flex: 1 }} />
                        {more}
                    </View>
                ) : (
                    <>
                        <View style={[styles.row, { top: 14 }]}>
                            <Text style={styles.name}>{palace.name}</Text>
                            <GanzhiSpan text={`${palace.heavenlyStem}${palace.earthlyBranch}`} palette={palette} style={styles.gz} />
                            <Text style={styles.meta} numberOfLines={1}>{meta}</Text>
                            <View style={{ flex: 1 }} />
                            {more}
                        </View>
                        <View style={[styles.row, { top: 38 }]}>{stars}</View>
                    </>
                )}
            </Pressable>
        </GestureDetector>
    );
}

export const ZiweiPeekBar = memo(ZiweiPeekBarBase);

/* ------------------------------------------------------------------ */
/* 整页面板：详情与命盘信息共用，完全盖住棋盘                               */
/* ------------------------------------------------------------------ */

export interface ZiweiSheetProps {
    visible: boolean;
    topInset: number;
    palette: ZiweiPalette;
    header: React.ReactNode;
    children: React.ReactNode;
    onClose: () => void;
    /** 收起动画走完后回调，页面借此卸载整页面板 */
    onClosed?: () => void;
    /** 左右滑换内容（详情里换宫位） */
    onSwipe?: (direction: -1 | 1) => void;
    /**
     * 收起后不卸载，只隐藏（display: none）。页面在空闲时预先挂好详情页，
     * 点「详情」只剩一次滑入动画。
     */
    keepMounted?: boolean;
}

const SHEET_DURATION = 220;
const SHEET_HIDDEN = { display: 'none' as const };

export function ZiweiSheet({ visible, topInset, palette, header, children, onClose, onClosed, onSwipe, keepMounted = false }: ZiweiSheetProps) {
    const { height: screenHeight } = useWindowDimensions();
    const progress = useSharedValue(0);
    const [mounted, setMounted] = React.useState(visible || keepMounted);
    const [hidden, setHidden] = React.useState(!visible);
    const travel = screenHeight + 40;

    const handleHidden = React.useCallback(() => {
        if (keepMounted) {
            setHidden(true);
        } else {
            setMounted(false);
        }
        onClosed?.();
    }, [keepMounted, onClosed]);

    useEffect(() => {
        if (visible) {
            setMounted(true);
            setHidden(false);
            progress.value = withTiming(1, { duration: SHEET_DURATION });
        } else {
            progress.value = withTiming(0, { duration: SHEET_DURATION }, (finished) => {
                if (finished) {
                    runOnJS(handleHidden)();
                }
            });
        }
    }, [handleHidden, progress, visible]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: (1 - progress.value) * travel }],
    }), [travel]);

    // 下滑收起只认顶部区域，避免和正文滚动抢手势；左右滑换宫整页都认
    const closeGesture = useMemo(() => Gesture.Pan()
        .activeOffsetY(16)
        .failOffsetX([-20, 20])
        .onEnd((event) => {
            if (event.translationY > 70) {
                runOnJS(onClose)();
            }
        }), [onClose]);
    const swipeGesture = useMemo(() => Gesture.Pan()
        .enabled(Boolean(onSwipe))
        .activeOffsetX([-24, 24])
        .failOffsetY([-14, 14])
        .onEnd((event) => {
            if (onSwipe && Math.abs(event.translationX) > 60) {
                runOnJS(onSwipe)(event.translationX < 0 ? 1 : -1);
            }
        }), [onSwipe]);

    if (!mounted) {
        return null;
    }

    return (
        <GestureDetector gesture={swipeGesture}>
            <Animated.View
                style={[
                    StyleSheet.absoluteFill,
                    { backgroundColor: palette.card, paddingTop: topInset, zIndex: 20, elevation: 20 },
                    hidden && SHEET_HIDDEN,
                    animatedStyle,
                ]}
                pointerEvents={visible ? 'auto' : 'none'}
                aria-hidden={!visible}
            >
                <GestureDetector gesture={closeGesture}>
                    <View collapsable={false}>{header}</View>
                </GestureDetector>
                {children}
            </Animated.View>
        </GestureDetector>
    );
}
