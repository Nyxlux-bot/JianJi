import React, { useMemo } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { buildResultPalette, type ResultPalette } from '../theme/result-palette';
import HexagramLines from './result/HexagramLines';
import { findHexagramByLines } from '../core/iching-texts';

// Import datasets
import tuanData from '../data/ichuan/tuan.json';
import xiangData from '../data/ichuan/xiang.json';
import wenData from '../data/ichuan/wen.json';

const SERIF = Platform.select({ ios: 'Songti SC', android: 'serif', default: 'serif' });

export interface HexagramData {
    id: number;
    name: string;
    symbol: string;
    array: number[];
    combination: string[];
    scripture: string;
    lines: {
        id: number;
        type: number;
        name: string;
        scripture: string;
    }[];
}

const TuanDict = tuanData as Record<string, string>;
const XiangDict = xiangData as Record<string, string>;
const WenDict = wenData as Record<string, string>;

interface HexagramDetailViewProps {
    data: HexagramData;
}

export default function HexagramDetailView({ data }: HexagramDetailViewProps) {
    const { Colors } = useTheme();
    const palette = useMemo(() => buildResultPalette(Colors), [Colors]);
    const styles = useMemo(() => makeStyles(palette), [palette]);

    const hexagram = useMemo(() => findHexagramByLines(data.array), [data.array]);
    const tuan = TuanDict[`iching__${data.id}`] || null;
    const daXiang = XiangDict[`iching__${data.id}`] || null;
    const wen = WenDict[`iching__${data.id}`] || null;
    const getXiaoXiang = (hexId: number, lineIndex: number) => XiangDict[`iching__${hexId}_${lineIndex + 1}`] || null;

    return (
        <ScrollView style={styles.detailScroll} contentContainerStyle={styles.detailContent} showsVerticalScrollIndicator={false}>
            <View style={styles.detailTop}>
                <HexagramLines
                    lines={data.array}
                    width={68}
                    barHeight={7}
                    gap={6}
                    trigramGap={4}
                    color={palette.gold}
                    movingColor={palette.gold}
                />
                <Text style={styles.detailName}>{hexagram?.fullName ?? data.name}</Text>
                <Text style={styles.detailMeta}>
                    {data.combination[1]}上 · {data.combination[0]}下 · 第 {data.id} 卦
                </Text>
            </View>

            <View style={styles.sectionBlock}>
                <View style={styles.sectionHead}>
                    <Text style={styles.sectionLabel}>卦辞</Text>
                    <View style={styles.sectionRule} />
                </View>
                <Text style={styles.scriptureHero}>{data.scripture}</Text>
            </View>

            {tuan ? (
                <View style={styles.sectionBlock}>
                    <View style={styles.sectionHead}>
                        <Text style={styles.sectionLabel}>彖传</Text>
                        <View style={styles.sectionRule} />
                    </View>
                    <Text style={styles.scriptureText}>{tuan}</Text>
                </View>
            ) : null}

            {daXiang ? (
                <View style={styles.sectionBlock}>
                    <View style={styles.sectionHead}>
                        <Text style={styles.sectionLabel}>大象</Text>
                        <View style={styles.sectionRule} />
                    </View>
                    <Text style={styles.scriptureText}>{daXiang}</Text>
                </View>
            ) : null}

            {wen ? (
                <View style={styles.sectionBlock}>
                    <View style={styles.sectionHead}>
                        <Text style={styles.sectionLabel}>文言</Text>
                        <View style={styles.sectionRule} />
                    </View>
                    <Text style={styles.scriptureText}>{wen}</Text>
                </View>
            ) : null}

            <View style={styles.sectionBlock}>
                <View style={styles.sectionHead}>
                    <Text style={styles.sectionLabel}>爻辞与小象</Text>
                    <View style={styles.sectionRule} />
                </View>
                <View style={styles.linesCard}>
                    {data.lines.map((line, index) => {
                        const xiaoXiang = getXiaoXiang(data.id, index);
                        return (
                            <View key={line.id} style={[styles.lineItem, index > 0 && styles.lineRule]}>
                                <View style={styles.lineHeader}>
                                    {index < 6 ? (
                                        <HexagramLines
                                            lines={[data.array[index]]}
                                            width={24}
                                            barHeight={3.5}
                                            color={palette.gold}
                                            movingColor={palette.gold}
                                        />
                                    ) : null}
                                    <Text style={styles.lineName}>{line.name}</Text>
                                </View>
                                <View style={styles.lineBody}>
                                    <Text style={styles.lineScripture}>{line.scripture}</Text>
                                    {xiaoXiang ? (
                                        <Text style={styles.xiaoXiangText}>
                                            <Text style={styles.xiaoXiangLabel}>《象》曰　</Text>
                                            {xiaoXiang}
                                        </Text>
                                    ) : null}
                                </View>
                            </View>
                        );
                    })}
                </View>
            </View>
            <View style={styles.bottomPad} />
        </ScrollView>
    );
}

const makeStyles = (palette: ResultPalette) => StyleSheet.create({
    detailScroll: {
        flex: 1,
    },
    detailContent: {
        paddingHorizontal: 16,
        paddingTop: 14,
        paddingBottom: 24,
        gap: 18,
    },
    detailTop: {
        alignItems: 'center',
        paddingVertical: 18,
        paddingHorizontal: 16,
        backgroundColor: palette.card,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: palette.cardBorder,
    },
    detailName: {
        marginTop: 14,
        fontFamily: SERIF,
        fontSize: 24,
        lineHeight: 32,
        fontWeight: '700',
        letterSpacing: 3,
        paddingLeft: 3,
        color: palette.heading,
    },
    detailMeta: {
        marginTop: 4,
        fontSize: 12.5,
        lineHeight: 18,
        letterSpacing: 1.5,
        color: palette.muted,
    },
    sectionBlock: {
        gap: 8,
    },
    sectionHead: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    sectionLabel: {
        fontSize: 12,
        lineHeight: 18,
        fontWeight: '600',
        letterSpacing: 2,
        color: palette.gold,
    },
    sectionRule: {
        flex: 1,
        height: 1,
        backgroundColor: palette.hairline,
    },
    scriptureHero: {
        fontFamily: SERIF,
        fontSize: 17,
        lineHeight: 28,
        color: palette.heading,
        backgroundColor: palette.quoteBg,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    scriptureText: {
        fontFamily: SERIF,
        fontSize: 15,
        lineHeight: 26,
        color: palette.ink,
        textAlign: 'justify',
    },
    linesCard: {
        backgroundColor: palette.card,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: palette.cardBorder,
        paddingHorizontal: 12,
    },
    lineItem: {
        flexDirection: 'row',
        gap: 12,
        paddingVertical: 11,
    },
    lineRule: {
        borderTopWidth: 1,
        borderTopColor: palette.hairline,
    },
    lineHeader: {
        width: 42,
        alignItems: 'center',
        gap: 6,
        paddingTop: 4,
    },
    lineName: {
        fontSize: 12.5,
        lineHeight: 16,
        fontWeight: '700',
        color: palette.ink,
    },
    lineBody: {
        flex: 1,
        minWidth: 0,
    },
    lineScripture: {
        fontFamily: SERIF,
        fontSize: 15,
        lineHeight: 24,
        color: palette.heading,
    },
    xiaoXiangLabel: {
        color: palette.gold,
    },
    xiaoXiangText: {
        marginTop: 4,
        fontSize: 12.5,
        lineHeight: 19,
        color: palette.muted,
    },
    bottomPad: {
        height: 36,
    },
});
