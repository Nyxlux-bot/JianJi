/**
 * 卦详情：头图放卦画、上下卦与互错综；「经」页签放卦辞、彖传、大象、文言，「爻」页签放爻辞与小象。
 */
import React, { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import StatusBarDecor from '../../../src/components/StatusBarDecor';
import HexagramLines from '../../../src/components/result/HexagramLines';
import { ResultCard, makeResultChromeStyles } from '../../../src/components/result/ResultChrome';
import WuXingIcon from '../../../src/components/WuXingIcon';
import { BackIcon, ChevronRightIcon } from '../../../src/components/Icons';
import { BA_GUA } from '../../../src/core/liuyao-data';
import { getCuoGua, getHuGua, getZongGua } from '../../../src/core/hexagramTransform';
import { findHexagramByLines, getHexagramClassics, HEXAGRAMS } from '../../../src/core/iching-texts';
import { TRIGRAM_IMAGES } from '../../../src/features/meihua/images';
import { buildResultPalette, type ResultPalette } from '../../../src/theme/result-palette';
import { useTheme } from '../../../src/theme/ThemeContext';

const SERIF = Platform.select({ ios: 'Songti SC', android: 'serif', default: 'serif' });
type Tab = 'jing' | 'yao';

export default function HexagramDetailPage() {
    const { Colors } = useTheme();
    const insets = useSafeAreaInsets();
    const palette = useMemo(() => buildResultPalette(Colors), [Colors]);
    const styles = useMemo(() => makeStyles(palette), [palette]);
    const chrome = useMemo(() => makeResultChromeStyles(palette), [palette]);
    const { id: rawId } = useLocalSearchParams<{ id: string }>();
    const id = Math.min(64, Math.max(1, Number(rawId) || 1));
    const hexagram = HEXAGRAMS[id - 1];
    const classics = useMemo(() => getHexagramClassics(id), [id]);
    const [tab, setTab] = useState<Tab>('jing');

    const related = [
        { kind: '互', lines: getHuGua(hexagram.lines) },
        { kind: '错', lines: getCuoGua(hexagram.lines) },
        { kind: '综', lines: getZongGua(hexagram.lines) },
    ].map((item) => ({ kind: item.kind, hex: findHexagramByLines(item.lines)! }));
    const prev = id > 1 ? HEXAGRAMS[id - 2] : null;
    const next = id < 64 ? HEXAGRAMS[id] : null;
    const go = (target: number) => router.replace(`/learn/hexagram/${target}`);

    const trigramRow = (label: string, index: number) => {
        const trigram = BA_GUA[index];
        return (
            <View style={styles.heroRow}>
                <Text style={styles.heroLabel}>{label}</Text>
                <WuXingIcon element={trigram.wuxing} size={14} />
                <Text style={[styles.trigramName, { color: palette.element[trigram.wuxing] }]}>{trigram.name}</Text>
                <Text style={styles.trigramMeta}>{trigram.nature} · {TRIGRAM_IMAGES[trigram.name]?.virtue}</Text>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <StatusBarDecor />
            <View style={chrome.topBar}>
                <Pressable onPress={() => router.back()} style={({ pressed }) => [chrome.iconBtn, chrome.backBtn, pressed && chrome.pressed]} accessibilityRole="button" accessibilityLabel="返回">
                    <BackIcon size={22} color={palette.ink} />
                </Pressable>
                <View style={chrome.tabs} accessibilityRole="tablist">
                    {([['jing', '经'], ['yao', '爻']] as const).map(([key, label]) => {
                        const on = tab === key;
                        return (
                            <Pressable key={key} onPress={() => setTab(key)} style={({ pressed }) => [chrome.tab, pressed && chrome.pressed]} accessibilityRole="tab" accessibilityState={{ selected: on }}>
                                <Text style={[chrome.tabText, on && chrome.tabTextActive]}>{label}</Text>
                                {on ? <View style={chrome.tabIndicator} /> : null}
                            </Pressable>
                        );
                    })}
                </View>
                <View style={chrome.spacer} />
                {prev ? (
                    <Pressable onPress={() => go(prev.id)} style={({ pressed }) => [styles.stepBtn, pressed && chrome.pressed]} accessibilityRole="button" accessibilityLabel={`上一卦 ${prev.fullName}`}>
                        <View style={styles.flip}><ChevronRightIcon size={14} color={palette.muted} /></View>
                        <Text style={styles.stepText}>{prev.name}</Text>
                    </Pressable>
                ) : null}
                {next ? (
                    <Pressable onPress={() => go(next.id)} style={({ pressed }) => [styles.stepBtn, pressed && chrome.pressed]} accessibilityRole="button" accessibilityLabel={`下一卦 ${next.fullName}`}>
                        <Text style={styles.stepText}>{next.name}</Text>
                        <ChevronRightIcon size={14} color={palette.muted} />
                    </Pressable>
                ) : null}
            </View>

            <View style={styles.hero}>
                <View style={styles.heroLines}>
                    <HexagramLines lines={hexagram.lines} width={64} barHeight={7} gap={6} trigramGap={4} color={palette.gold} movingColor={palette.gold} />
                </View>
                <View style={styles.flex}>
                    <View style={styles.nameRow}>
                        <Text style={styles.name}>{hexagram.name}</Text>
                        <Text style={styles.fullName}>{hexagram.fullName}</Text>
                        <View style={chrome.seal}><Text style={chrome.sealText}>{id <= 30 ? '上经' : '下经'}</Text></View>
                        <Text style={styles.order}>第 {id} 卦</Text>
                    </View>
                    <View style={styles.heroRows}>
                        {trigramRow('上卦', hexagram.upper)}
                        {trigramRow('下卦', hexagram.lower)}
                        <View style={styles.heroRow}>
                            <Text style={styles.heroLabel}>关联</Text>
                            <View style={styles.related}>
                                {related.map((item) => (
                                    <Pressable
                                        key={item.kind}
                                        disabled={item.hex.id === id}
                                        onPress={() => router.push(`/learn/hexagram/${item.hex.id}`)}
                                        style={({ pressed }) => [styles.relatedItem, pressed && chrome.pressed]}
                                        accessibilityRole="button"
                                        accessibilityLabel={`${item.kind}卦 ${item.hex.fullName}`}
                                    >
                                        <Text style={styles.relatedKind}>{item.kind}</Text>
                                        <Text style={[styles.relatedName, item.hex.id === id && styles.relatedSelf]}>{item.hex.name}</Text>
                                    </Pressable>
                                ))}
                            </View>
                        </View>
                    </View>
                </View>
            </View>

            <ScrollView style={styles.flex} contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
                {tab === 'jing' ? (
                    <>
                        <ResultCard title="卦辞" styles={chrome}>
                            <Text style={styles.scripture}>{hexagram.scripture}</Text>
                        </ResultCard>
                        {classics.tuan ? (
                            <ResultCard title="彖传" meta="释卦辞" styles={chrome}>
                                <Text style={styles.text}>{classics.tuan}</Text>
                            </ResultCard>
                        ) : null}
                        {classics.xiang ? (
                            <ResultCard title="大象" meta="象传" styles={chrome}>
                                <Text style={styles.text}>{classics.xiang}</Text>
                            </ResultCard>
                        ) : null}
                        {classics.wen ? (
                            <ResultCard title="文言" styles={chrome}>
                                <Text style={styles.text}>{classics.wen}</Text>
                            </ResultCard>
                        ) : <Text style={styles.note}>文言传只有乾、坤两卦有。</Text>}
                    </>
                ) : (
                    <ResultCard title="爻辞" meta={classics.lines.length > 6 ? '初爻至上爻，附用爻 · 小象' : '初爻至上爻 · 附小象'} styles={chrome}>
                        {classics.lines.map((line, index) => (
                            <View key={line.name} style={[styles.yaoRow, index > 0 && styles.yaoRule]}>
                                <View style={styles.yaoHead}>
                                    {index < 6 ? (
                                        <HexagramLines lines={[hexagram.lines[index]]} width={26} barHeight={4} color={palette.gold} movingColor={palette.gold} />
                                    ) : null}
                                    <Text style={styles.yaoName}>{line.name}</Text>
                                </View>
                                <View style={styles.flex}>
                                    <Text style={styles.yaoText}>{line.scripture}</Text>
                                    {line.xiang ? (
                                        <Text style={styles.yaoXiang}><Text style={styles.yaoXiangLabel}>《象》曰　</Text>{line.xiang}</Text>
                                    ) : null}
                                </View>
                            </View>
                        ))}
                    </ResultCard>
                )}
            </ScrollView>
        </View>
    );
}

const makeStyles = (palette: ResultPalette) => StyleSheet.create({
    container: { flex: 1, backgroundColor: palette.page },
    flex: { flex: 1, minWidth: 0 },
    stepBtn: { height: 32, flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 6 },
    flip: { transform: [{ rotate: '180deg' }] },
    stepText: { fontSize: 12.5, color: palette.muted },
    hero: {
        flexDirection: 'row', gap: 18, paddingVertical: 16, paddingHorizontal: 20,
        backgroundColor: palette.card, borderBottomWidth: 1, borderBottomColor: palette.heroBorder,
    },
    heroLines: { paddingTop: 6 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    name: { fontFamily: SERIF, fontSize: 34, lineHeight: 40, fontWeight: '700', color: palette.heading },
    fullName: { fontSize: 14, color: palette.body },
    order: { fontSize: 12, color: palette.muted },
    heroRows: { marginTop: 8, gap: 5 },
    heroRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    heroLabel: { width: 35, fontSize: 12, lineHeight: 19, color: palette.muted },
    trigramName: { fontFamily: SERIF, fontSize: 13.5, lineHeight: 19, fontWeight: '700' },
    trigramMeta: { fontSize: 13, lineHeight: 19, color: palette.body },
    related: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    relatedItem: { flexDirection: 'row', alignItems: 'center', gap: 3, minHeight: 24 },
    relatedKind: { fontSize: 11.5, color: palette.muted },
    relatedName: { fontFamily: SERIF, fontSize: 13.5, fontWeight: '700', color: palette.gold },
    relatedSelf: { color: palette.muted },
    body: { padding: 12, gap: 10 },
    scripture: { marginTop: 8, fontFamily: SERIF, fontSize: 19, lineHeight: 32, color: palette.heading },
    text: { marginTop: 8, fontFamily: SERIF, fontSize: 15, lineHeight: 26, color: palette.ink },
    note: { paddingHorizontal: 4, fontSize: 11.5, lineHeight: 17, color: palette.muted },
    yaoRow: { flexDirection: 'row', gap: 12, paddingVertical: 10 },
    yaoRule: { borderTopWidth: 1, borderTopColor: palette.hairline },
    yaoHead: { width: 40, alignItems: 'center', gap: 6, paddingTop: 4 },
    yaoName: { fontSize: 12.5, lineHeight: 16, fontWeight: '700', color: palette.ink },
    yaoText: { fontFamily: SERIF, fontSize: 15, lineHeight: 24, color: palette.heading },
    yaoXiang: { marginTop: 3, fontSize: 12.5, lineHeight: 19, color: palette.muted },
    yaoXiangLabel: { color: palette.gold },
});
