import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView, ScrollView } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronDownIcon, ChevronRightIcon, CloseIcon, SparkleIcon } from '../../components/Icons';
import PressableScale from '../../components/PressableScale';
import { useTheme } from '../../theme/ThemeContext';
import { buildResultPalette, type ResultPalette } from '../../theme/result-palette';
import { webScrimBlur, webScrimProps } from '../../theme/web-enhance';
import { getGanZhiElement } from '../bazi/wuxing';
import { QIMEN_GATES, QIMEN_LAYOUT, QIMEN_PALACES } from './data';
import { getQimenPalaceNotes } from './rules';
import type { QimenPalace, QimenPeriod, QimenResult } from './types';
import type { PeriodBoard } from './period-board';

export default function QimenPalaceDetail({ result, palace, period, board, visible, onSelect, onClose, onAI }: {
    result: QimenResult;
    palace: QimenPalace;
    period: QimenPeriod;
    board: PeriodBoard;
    visible: boolean;
    onSelect: (number: number) => void;
    onClose: () => void;
    onAI: () => void;
}) {
    const { Colors } = useTheme();
    const palette = useMemo(() => buildResultPalette(Colors), [Colors]);
    const styles = useMemo(() => makeStyles(palette), [palette]);
    const insets = useSafeAreaInsets();
    const { height } = useWindowDimensions();
    const reduceMotion = useReducedMotion();
    const [mounted, setMounted] = useState(visible);
    const [notesOpen, setNotesOpen] = useState(false);
    const progress = useSharedValue(0);
    const info = QIMEN_PALACES[palace.number - 1];
    const turn = board.turn;
    const notes = useMemo(() => getQimenPalaceNotes(result, palace, board, period), [board, palace, period, result]);
    const darkStem = board.darkStems?.[palace.number - 1];
    const order = QIMEN_LAYOUT;
    const index = order.indexOf(palace.number);
    const previous = order[(index + order.length - 1) % order.length];
    const next = order[(index + 1) % order.length];
    const gate = palace.gate ? QIMEN_GATES[palace.gate] : null;
    const starElement = QIMEN_PALACES.find(item => item.star === palace.star)?.element;
    const stemColor = (stem: string) => {
        const element = getGanZhiElement(stem);
        return element ? palette.element[element] : palette.ink;
    };
    const stepPalace = useCallback((direction: -1 | 1) => {
        onSelect(direction === -1 ? previous : next);
    }, [next, onSelect, previous]);

    useEffect(() => {
        if (visible) {
            setMounted(true);
            setNotesOpen(false);
            progress.value = withTiming(1, { duration: reduceMotion ? 0 : 180 });
        } else {
            progress.value = withTiming(0, { duration: reduceMotion ? 0 : 150 }, finished => {
                if (finished) runOnJS(setMounted)(false);
            });
        }
    }, [progress, reduceMotion, visible]);

    const scrimStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
    const cardStyle = useAnimatedStyle(() => ({
        opacity: progress.value,
        transform: [{ scale: reduceMotion ? 1 : 0.86 + progress.value * 0.14 }],
    }));
    const swipe = useMemo(() => Gesture.Pan()
        .activeOffsetX([-20, 20])
        .failOffsetY([-16, 16])
        .onEnd(event => {
            if (Math.abs(event.translationX) > 50) runOnJS(stepPalace)(event.translationX < 0 ? 1 : -1);
        }), [stepPalace]);
    const doubleTap = useMemo(() => Gesture.Tap().numberOfTaps(2).maxDelay(250)
        .onEnd((_event, success) => {
            if (success) runOnJS(onClose)();
        }), [onClose]);

    return (
        <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
            <GestureHandlerRootView style={styles.fill}>
                <Animated.View {...webScrimProps} style={[StyleSheet.absoluteFill, { backgroundColor: palette.isLight ? 'rgba(26,21,16,0.64)' : Colors.bg.overlay }, webScrimBlur, scrimStyle]}>
                    <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="回到九宫盘" />
                </Animated.View>
                <View style={[styles.overlay, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]} pointerEvents="box-none">
                    <GestureDetector gesture={swipe}>
                        <Animated.View style={[styles.card, { maxHeight: height - insets.top - insets.bottom - 80 }, cardStyle]} accessibilityViewIsModal onAccessibilityEscape={onClose}>
                            <View style={styles.header}>
                                <Text style={styles.meta}>{result.form === '飞盘' ? '九神' : '八神'}</Text>
                                <Text style={styles.spirit}>{palace.spirit || (turn ? '中五寄宫' : '中宫无神')}</Text>
                                <PressableScale onPress={onClose} style={styles.close} accessibilityRole="button" accessibilityLabel="收起宫位详情">
                                    <CloseIcon size={20} color={palette.muted} />
                                </PressableScale>
                            </View>
                            <ScrollView key={palace.number} style={styles.scroll} showsVerticalScrollIndicator={false}>
                                <GestureDetector gesture={doubleTap} touchAction="pan-y">
                                    <View collapsable={false}>
                                        {turn && palace.number === 5 ? (
                                            <>
                                                <View style={styles.centerPalace}>
                                                    <Text style={styles.meta}>九星本位</Text>
                                                    <Text style={[styles.centerStar, { color: palette.element.土 }]}>天禽</Text>
                                                    <Text style={styles.centerNote}>中五寄坤 · 天禽随芮</Text>
                                                    <Text style={styles.meta}>无独立八门与八神</Text>
                                                </View>
                                                <View style={styles.centerStems}>
                                                    <View style={styles.centerStemColumn}><Text style={styles.meta}>天盘干</Text><Text style={styles.hostedValue}>随天禽寄宫</Text></View>
                                                    <View style={styles.centerStemColumn}><Text style={styles.meta}>地盘干</Text><Text style={[styles.stem, { color: stemColor(palace.earthStem) }]}>{palace.earthStem}</Text></View>
                                                    {darkStem ? <View style={styles.centerStemColumn}><Text style={styles.meta}>暗干</Text><Text style={[styles.stem, { color: stemColor(darkStem) }]}>{darkStem}</Text></View> : null}
                                                </View>
                                            </>
                                        ) : (
                                            <View style={styles.main}>
                                                <View style={styles.verticals}>
                                                    <View style={styles.verticalColumn}>
                                                        <Text style={styles.meta}>九星</Text>
                                                        <View style={styles.starPair}>
                                                            <Text style={[styles.verticalName, { color: starElement ? palette.element[starElement] : palette.ink }]} accessibilityLabel={palace.star || undefined}>{palace.star?.split('').join('\n')}</Text>
                                                            {palace.hostedHeavenStem ? <Text style={styles.hostedStar} accessibilityLabel="天禽">{'天\n禽'}</Text> : null}
                                                        </View>
                                                        {palace.number === board.chief.chiefStarPalace ? <Text style={styles.chief}>{palace.star === board.chief.chiefStar ? '值符' : `值符·${board.chief.chiefStar}`}</Text> : null}
                                                    </View>
                                                    <View style={styles.verticalColumn}>
                                                        <Text style={styles.meta}>八门</Text>
                                                        <Text style={[styles.verticalName, gate && { color: palette.element[gate.element] }]} accessibilityLabel={palace.gate || undefined}>{(palace.gate ?? (result.form === '飞盘' ? '五位' : '无门')).split('').join('\n')}</Text>
                                                        {palace.number === board.chief.chiefGatePalace ? <Text style={styles.chief}>值使</Text> : null}
                                                    </View>
                                                </View>
                                                <View style={styles.stems}>
                                                    <View style={styles.stemRow}>
                                                        <View style={styles.stemLabels}>
                                                            <Text style={styles.meta}>天盘</Text>
                                                            {palace.hostedHeavenStem ? <Text style={styles.meta} accessibilityLabel={`天禽寄${palace.hostedHeavenStem}`}>寄<Text style={{ color: stemColor(palace.hostedHeavenStem) }}>{palace.hostedHeavenStem}</Text></Text> : null}
                                                        </View>
                                                        <Text style={[styles.stem, palace.heavenStem && { color: stemColor(palace.heavenStem) }]}>{palace.heavenStem}</Text>
                                                    </View>
                                                    <View style={styles.stemRow}>
                                                        <View style={styles.stemLabels}>
                                                            <Text style={styles.meta}>地盘</Text>
                                                            {palace.hostedEarthStem ? <Text style={styles.meta} accessibilityLabel={`中五寄${palace.hostedEarthStem}`}>寄<Text style={{ color: stemColor(palace.hostedEarthStem) }}>{palace.hostedEarthStem}</Text></Text> : null}
                                                        </View>
                                                        <Text style={[styles.stem, { color: stemColor(palace.earthStem) }]}>{palace.earthStem}</Text>
                                                    </View>
                                                    {darkStem ? (
                                                        <View style={styles.stemRow}>
                                                            <View style={styles.stemLabels}><Text style={styles.meta}>暗干</Text></View>
                                                            <Text style={[styles.darkStem, { color: stemColor(darkStem) }]}>{darkStem}</Text>
                                                        </View>
                                                    ) : null}
                                                </View>
                                            </View>
                                        )}
                                        <View style={styles.base}>
                                            <View style={styles.markers}>
                                                <Text style={[styles.meta, palace.voidBranches.length > 0 && styles.marked]}>{palace.voidBranches.length ? `${period[0]}空 · ${palace.voidBranches.join('')}` : '本宫不空'}</Text>
                                                <Text style={[styles.meta, palace.isHorse && styles.marked]}>{palace.isHorse ? `${period[0]}马 · ${board.horseBranch}` : `无${period[0]}马`}</Text>
                                            </View>
                                            <View style={styles.nameBlock}>
                                                <Text style={styles.title} accessibilityRole="header">{info.name}宫</Text>
                                                <Text style={styles.meta}>{info.direction} · {info.element}{info.branches ? ` · ${info.branches}` : ''}</Text>
                                            </View>
                                            <View style={styles.locator} accessible accessibilityLabel={`${info.name}宫在九宫盘的位置`}>
                                                {QIMEN_LAYOUT.map(number => <View key={number} style={[styles.locatorCell, number === palace.number && styles.locatorSelected]} />)}
                                            </View>
                                        </View>
                                        <View style={styles.notes}>
                                            {notesOpen ? (
                                                <View style={styles.notesBody}>
                                                    <View style={styles.notesHeading}><Text style={styles.meta}>盘面注记</Text><Text style={styles.meta}>{notes.length} 条</Text></View>
                                                    {notes.map(note => <View key={note.label + note.detail} style={styles.note}><Text style={styles.noteTitle}>{note.label}</Text><Text style={styles.paragraph}>{note.detail}</Text></View>)}
                                                    <Text style={styles.meta}>注记需结合取用与全盘，不单独作为问事结论。</Text>
                                                </View>
                                            ) : (
                                                <Text style={styles.noteSummary}>{Array.from(new Set(notes.map(note => note.label))).join(' · ')}</Text>
                                            )}
                                        </View>
                                    </View>
                                </GestureDetector>
                                {notesOpen ? (
                                    <PressableScale onPress={onAI} style={styles.aiButton} accessibilityRole="button" accessibilityLabel={`请 AI 解读${info.name}宫`}>
                                        <SparkleIcon size={15} color={palette.gold} /><Text style={styles.aiText}>解读此宫</Text><ChevronRightIcon size={14} color={palette.gold} />
                                    </PressableScale>
                                ) : null}
                            </ScrollView>
                            <View style={styles.nav}>
                                <PressableScale style={styles.navSide} onPress={() => stepPalace(-1)} accessibilityRole="button" accessibilityLabel={`上一宫 ${QIMEN_PALACES[previous - 1].name}宫`}>
                                    <View style={styles.chevronLeft}><ChevronRightIcon size={16} color={palette.muted} /></View>
                                    <Text style={styles.navText}>{QIMEN_PALACES[previous - 1].name}</Text>
                                </PressableScale>
                                <PressableScale onPress={() => setNotesOpen(value => !value)} style={styles.notesToggle}
                                    accessibilityRole="button" accessibilityLabel={notesOpen ? '收起盘面注记' : '展开盘面注记'} aria-expanded={notesOpen}>
                                    <Text style={styles.aiText}>{notesOpen ? '收起注记' : '盘面注记'}</Text>
                                    <View style={notesOpen && styles.chevronUp}><ChevronDownIcon size={16} color={palette.gold} /></View>
                                </PressableScale>
                                <PressableScale style={[styles.navSide, styles.navNext]} onPress={() => stepPalace(1)} accessibilityRole="button" accessibilityLabel={`下一宫 ${QIMEN_PALACES[next - 1].name}宫`}>
                                    <Text style={styles.navText}>{QIMEN_PALACES[next - 1].name}</Text><ChevronRightIcon size={16} color={palette.muted} />
                                </PressableScale>
                            </View>
                        </Animated.View>
                    </GestureDetector>
                    <Animated.Text style={[styles.hint, scrimStyle]} pointerEvents="none">左右滑动换宫 · 双击盘面或点空白处收起</Animated.Text>
                </View>
            </GestureHandlerRootView>
        </Modal>
    );
}

function makeStyles(palette: ResultPalette) {
    return StyleSheet.create({
        fill: { flex: 1 },
        overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 },
        card: { width: '100%', maxWidth: 420, borderRadius: 16, borderWidth: 1.5, borderColor: palette.vermilion, backgroundColor: palette.card, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 16 },
        header: { paddingLeft: 20, paddingRight: 8, paddingTop: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
        spirit: { flex: 1, fontSize: 20, lineHeight: 28, fontWeight: '500', color: palette.body },
        locator: { width: 28, height: 28, flexDirection: 'row', flexWrap: 'wrap', gap: 2, flexShrink: 0 },
        locatorCell: { width: 8, height: 8, borderRadius: 1, backgroundColor: palette.rule },
        locatorSelected: { backgroundColor: palette.vermilion },
        title: { fontSize: 24, lineHeight: 32, fontWeight: '600', color: palette.vermilion },
        meta: { fontSize: 12, lineHeight: 18, color: palette.muted },
        close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
        scroll: { flexShrink: 1 },
        main: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 16, minHeight: 169, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 22 },
        verticals: { flexDirection: 'row', alignItems: 'flex-start', gap: 24 },
        verticalColumn: { alignItems: 'center', gap: 8 },
        verticalName: { includeFontPadding: false, fontSize: 28, lineHeight: 36, fontWeight: '600', textAlign: 'center', color: palette.heading },
        starPair: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
        hostedStar: { includeFontPadding: false, fontSize: 20, lineHeight: 27, color: palette.muted, textAlign: 'center' },
        chief: { fontSize: 11, lineHeight: 17, paddingHorizontal: 4, borderRadius: 3, backgroundColor: palette.goldSoft, color: palette.gold },
        centerPalace: { alignItems: 'center', paddingHorizontal: 20, paddingVertical: 20, gap: 4 },
        centerStar: { fontSize: 32, lineHeight: 44, fontWeight: '500' },
        centerNote: { fontSize: 14, lineHeight: 22, color: palette.body },
        centerStems: { flexDirection: 'row', marginHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, borderColor: palette.hairline },
        centerStemColumn: { flex: 1, alignItems: 'center', gap: 2 },
        stems: { gap: 8, alignItems: 'flex-end' },
        stemRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
        stemLabels: { alignItems: 'flex-end' },
        stem: { includeFontPadding: false, fontSize: 32, lineHeight: 42, fontWeight: '500', color: palette.ink },
        darkStem: { includeFontPadding: false, fontSize: 22, lineHeight: 28, fontWeight: '500', color: palette.muted },
        hostedValue: { fontSize: 16, lineHeight: 42, color: palette.body },
        base: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, borderTopColor: palette.hairline },
        markers: { gap: 3, flexShrink: 1 },
        nameBlock: { alignItems: 'center', flexShrink: 1 },
        marked: { color: palette.vermilion },
        notes: { paddingHorizontal: 20, paddingBottom: 14 },
        notesToggle: { minHeight: 44, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 8, backgroundColor: palette.goldSoft },
        notesHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
        chevronUp: { transform: [{ rotate: '180deg' }] },
        chevronLeft: { transform: [{ rotate: '180deg' }] },
        noteSummary: { fontSize: 12, lineHeight: 20, color: palette.muted },
        notesBody: { gap: 14 },
        note: { gap: 4 },
        noteTitle: { fontSize: 13, lineHeight: 20, color: palette.gold, fontWeight: '600' },
        paragraph: { fontSize: 14, lineHeight: 23, color: palette.body },
        nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderTopWidth: 1, borderTopColor: palette.hairline },
        navSide: { flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 2 },
        navNext: { justifyContent: 'flex-end' },
        navText: { fontSize: 13, color: palette.muted },
        aiButton: { minHeight: 44, marginHorizontal: 20, marginBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
        aiText: { fontSize: 13, fontWeight: '600', color: palette.gold },
        hint: { marginTop: 14, fontSize: 12, lineHeight: 18, color: 'rgba(255,250,240,0.82)', textAlign: 'center' },
    });
}
