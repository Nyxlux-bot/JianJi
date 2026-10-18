/**
 * 六十四卦：「方图」上卦为行、下卦为列（先天序），点格看卦辞；「卦序」按上经、下经列表。
 */
import React, { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import StatusBarDecor from '../../src/components/StatusBarDecor';
import HexagramLines from '../../src/components/result/HexagramLines';
import { BackIcon, ChevronRightIcon } from '../../src/components/Icons';
import { BA_GUA } from '../../src/core/liuyao-data';
import { HEXAGRAMS, type HexagramEntry } from '../../src/core/iching-texts';
import { buildResultPalette, type ResultPalette } from '../../src/theme/result-palette';
import { useTheme } from '../../src/theme/ThemeContext';

const SERIF = Platform.select({ ios: 'Songti SC', android: 'serif', default: 'serif' });
const TRIGRAMS = [1, 2, 3, 4, 5, 6, 7, 8];
const BY_KEY = new Map(HEXAGRAMS.map((item) => [`${item.upper}-${item.lower}`, item]));
const PARTS = [{ label: '上经', items: HEXAGRAMS.slice(0, 30) }, { label: '下经', items: HEXAGRAMS.slice(30) }];
type View_ = 'grid' | 'list';

const partsLabel = (item: HexagramEntry) => `${BA_GUA[item.upper].name}上${BA_GUA[item.lower].name}下`;

export default function HexagramsPage() {
    const { Colors } = useTheme();
    const insets = useSafeAreaInsets();
    const palette = useMemo(() => buildResultPalette(Colors), [Colors]);
    const styles = useMemo(() => makeStyles(palette), [palette]);
    const params = useLocalSearchParams<{ upper?: string }>();
    const initialRow = Number(params.upper) >= 1 && Number(params.upper) <= 8 ? Number(params.upper) : 0;
    const [view, setView] = useState<View_>('grid');
    const [row, setRow] = useState(initialRow);
    const [selectedId, setSelectedId] = useState(() => (initialRow ? BY_KEY.get(`${initialRow}-${initialRow}`)!.id : 1));
    const selected = HEXAGRAMS[selectedId - 1];
    const openDetail = (id: number) => router.push(`/learn/hexagram/${id}`);

    return (
        <View style={styles.container}>
            <StatusBarDecor />
            <View style={styles.topBar}>
                <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="返回">
                    <BackIcon size={22} color={palette.ink} />
                </Pressable>
                <Text style={styles.title}>六十四卦</Text>
                <View style={styles.flex} />
                <View style={styles.segment} accessibilityRole="radiogroup" accessibilityLabel="排列方式">
                    {([['grid', '方图'], ['list', '卦序']] as const).map(([key, label]) => {
                        const on = view === key;
                        return (
                            <Pressable key={key} onPress={() => setView(key)} style={[styles.segmentBtn, on && styles.segmentBtnOn]} accessibilityRole="radio" accessibilityState={{ checked: on }}>
                                <Text style={[styles.segmentText, on && styles.segmentTextOn]}>{label}</Text>
                            </Pressable>
                        );
                    })}
                </View>
            </View>

            {view === 'grid' ? (
                <ScrollView contentContainerStyle={[styles.gridBody, { paddingBottom: insets.bottom + 16 }]} showsVerticalScrollIndicator={false}>
                    <View style={styles.legend}>
                        <Text style={styles.legendText}>上卦为行 · 下卦为列 · 先天卦序</Text>
                        <Text style={styles.legendHint}>点行标高亮一行</Text>
                    </View>
                    <View style={styles.gridRow}>
                        <Text style={styles.corner}>上╲下</Text>
                        {TRIGRAMS.map((index) => {
                            const color = palette.element[BA_GUA[index].wuxing];
                            return (
                                <View key={index} style={styles.colHead} accessibilityLabel={`下卦${BA_GUA[index].name}`}>
                                    <HexagramLines lines={BA_GUA[index].yao} width={12} barHeight={1.8} gap={1.5} color={color} movingColor={color} />
                                    <Text style={[styles.headName, { color }]}>{BA_GUA[index].name}</Text>
                                </View>
                            );
                        })}
                    </View>
                    {TRIGRAMS.map((upper) => {
                        const on = row === upper;
                        const color = palette.element[BA_GUA[upper].wuxing];
                        return (
                            <View key={upper} style={styles.gridRow}>
                                <Pressable
                                    onPress={() => setRow(on ? 0 : upper)}
                                    style={[styles.rowHead, on && styles.rowHeadOn]}
                                    accessibilityRole="button"
                                    accessibilityLabel={`上卦${BA_GUA[upper].name}`}
                                    accessibilityState={{ selected: on }}
                                >
                                    <HexagramLines lines={BA_GUA[upper].yao} width={12} barHeight={1.8} gap={1.5} color={color} movingColor={color} />
                                    <Text style={[styles.headName, { color }]}>{BA_GUA[upper].name}</Text>
                                </Pressable>
                                {TRIGRAMS.map((lower) => {
                                    const item = BY_KEY.get(`${upper}-${lower}`)!;
                                    const sel = item.id === selectedId;
                                    return (
                                        <Pressable
                                            key={lower}
                                            onPress={() => (sel ? openDetail(item.id) : setSelectedId(item.id))}
                                            style={[styles.cell, on && styles.cellRowOn, sel && styles.cellSelected]}
                                            accessibilityRole="button"
                                            accessibilityLabel={`${item.fullName}，第${item.id}卦`}
                                            accessibilityState={{ selected: sel }}
                                        >
                                            <HexagramLines lines={item.lines} width={17} barHeight={2} gap={1.6} trigramGap={0} color={palette.gold} movingColor={palette.gold} />
                                            <Text style={[styles.cellName, sel && styles.cellNameOn]} numberOfLines={1}>{item.name}</Text>
                                        </Pressable>
                                    );
                                })}
                            </View>
                        );
                    })}

                    <Pressable onPress={() => openDetail(selected.id)} style={({ pressed }) => [styles.preview, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`查看${selected.fullName}全文`}>
                        <HexagramLines lines={selected.lines} width={34} barHeight={4} gap={3.5} trigramGap={0} color={palette.gold} movingColor={palette.gold} />
                        <View style={styles.flex}>
                            <View style={styles.previewHead}>
                                <Text style={styles.previewName}>{selected.name}</Text>
                                <Text style={styles.previewFull} numberOfLines={1}>{selected.fullName} · 第 {selected.id} 卦</Text>
                            </View>
                            <Text style={styles.previewParts}>{partsLabel(selected)} · {selected.id <= 30 ? '上经' : '下经'}</Text>
                            <Text style={styles.previewText} numberOfLines={2}>{selected.scripture}</Text>
                        </View>
                        <ChevronRightIcon size={18} color={palette.gold} />
                    </Pressable>
                </ScrollView>
            ) : (
                <ScrollView contentContainerStyle={[styles.listBody, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
                    {PARTS.map((part) => (
                        <View key={part.label} style={styles.part}>
                            <View style={styles.partHead}>
                                <Text style={styles.partLabel}>{part.label}</Text>
                                <Text style={styles.partMeta}>{part.items.length} 卦</Text>
                            </View>
                            <View style={styles.listCard}>
                                {part.items.map((item, index) => {
                                    const sel = item.id === selectedId;
                                    return (
                                        <Pressable
                                            key={item.id}
                                            onPress={() => { setSelectedId(item.id); openDetail(item.id); }}
                                            style={({ pressed }) => [styles.listRow, index > 0 && styles.listRule, sel && styles.listRowOn, pressed && styles.pressed]}
                                            accessibilityRole="button"
                                            accessibilityLabel={`${item.fullName}，第${item.id}卦`}
                                        >
                                            <Text style={styles.listNo}>{item.id}</Text>
                                            <HexagramLines lines={item.lines} width={20} barHeight={2.6} gap={2} trigramGap={0} color={palette.gold} movingColor={palette.gold} />
                                            <View style={styles.flex}>
                                                <View style={styles.listHead}>
                                                    <Text style={[styles.listName, sel && styles.cellNameOn]}>{item.name}</Text>
                                                    <Text style={styles.listFull}>{item.fullName}</Text>
                                                </View>
                                                <Text style={styles.listText} numberOfLines={1}>{item.scripture}</Text>
                                            </View>
                                            <View style={styles.tag}><Text style={styles.tagText}>{partsLabel(item)}</Text></View>
                                        </Pressable>
                                    );
                                })}
                            </View>
                        </View>
                    ))}
                </ScrollView>
            )}
        </View>
    );
}

const makeStyles = (palette: ResultPalette) => StyleSheet.create({
    container: { flex: 1, backgroundColor: 'transparent' },
    flex: { flex: 1, minWidth: 0 },
    pressed: { opacity: 0.7 },
    topBar: {
        height: 48, flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 4, paddingRight: 12,
        backgroundColor: palette.card, borderBottomWidth: 1, borderBottomColor: palette.hairline,
    },
    iconBtn: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
    title: { fontFamily: SERIF, fontSize: 17, fontWeight: '700', letterSpacing: 2, color: palette.heading },
    segment: { flexDirection: 'row', gap: 2, padding: 2, borderRadius: 15, borderWidth: 1, borderColor: palette.segBorder, backgroundColor: palette.segTrack },
    segmentBtn: { height: 26, paddingHorizontal: 12, borderRadius: 13, borderWidth: 1, borderColor: 'transparent', justifyContent: 'center' },
    segmentBtnOn: { borderColor: palette.segBorder, backgroundColor: palette.segOn },
    segmentText: { fontSize: 12.5, fontWeight: '600', color: palette.muted },
    segmentTextOn: { color: palette.heading },
    gridBody: { paddingHorizontal: 10, paddingTop: 8, gap: 2 },
    legend: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, paddingBottom: 6 },
    legendText: { fontSize: 12, lineHeight: 16, color: palette.muted },
    legendHint: { fontSize: 12, lineHeight: 16, color: palette.muted, opacity: 0.75 },
    gridRow: { flexDirection: 'row', gap: 2 },
    corner: { width: 28, alignSelf: 'flex-end', paddingBottom: 4, fontSize: 9.5, lineHeight: 11, color: palette.muted, textAlign: 'center' },
    colHead: { flex: 1, height: 30, alignItems: 'center', justifyContent: 'center', gap: 3 },
    rowHead: { width: 28, height: 60, alignItems: 'center', justifyContent: 'center', gap: 3, borderRadius: 8 },
    rowHeadOn: { backgroundColor: palette.chipBg },
    headName: { fontFamily: SERIF, fontSize: 11, lineHeight: 13, fontWeight: '700' },
    cell: {
        flex: 1, minWidth: 0, height: 60, alignItems: 'center', justifyContent: 'center', gap: 5,
        borderRadius: 8, borderWidth: 1, borderColor: 'transparent', backgroundColor: palette.segTrack,
    },
    cellRowOn: { backgroundColor: palette.chipBg },
    cellSelected: { backgroundColor: palette.goldSoft, borderColor: palette.goldBorder },
    cellName: { fontFamily: SERIF, fontSize: 11, lineHeight: 13, fontWeight: '700', color: palette.body },
    cellNameOn: { color: palette.gold },
    preview: {
        marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingHorizontal: 14,
        borderRadius: 16, borderWidth: 1, borderColor: palette.cardBorder, backgroundColor: palette.card,
    },
    previewHead: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
    previewName: { fontFamily: SERIF, fontSize: 24, lineHeight: 30, fontWeight: '700', color: palette.heading },
    previewFull: { flexShrink: 1, fontSize: 12.5, color: palette.body },
    previewParts: { marginTop: 2, fontSize: 12, lineHeight: 16, color: palette.muted },
    previewText: { marginTop: 6, fontFamily: SERIF, fontSize: 13.5, lineHeight: 21, color: palette.ink },
    listBody: { paddingHorizontal: 16 },
    part: { marginTop: 12 },
    partHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    partLabel: { fontSize: 12, lineHeight: 16, color: palette.muted },
    partMeta: { fontSize: 11, lineHeight: 16, color: palette.muted, opacity: 0.75 },
    listCard: { borderRadius: 16, borderWidth: 1, borderColor: palette.cardBorder, backgroundColor: palette.card, overflow: 'hidden' },
    listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 12 },
    listRule: { borderTopWidth: 1, borderTopColor: palette.hairline },
    listRowOn: { backgroundColor: palette.goldSoft },
    listNo: { width: 20, fontSize: 12, color: palette.muted, textAlign: 'right', fontVariant: ['tabular-nums'] },
    listHead: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
    listName: { fontFamily: SERIF, fontSize: 17, lineHeight: 23, fontWeight: '700', color: palette.heading },
    listFull: { fontSize: 12, color: palette.body },
    listText: { fontSize: 12.5, lineHeight: 18, color: palette.muted },
    tag: { paddingHorizontal: 5, borderRadius: 4, backgroundColor: palette.chipBg },
    tagText: { fontSize: 10.5, lineHeight: 15, color: palette.chipInk },
});
