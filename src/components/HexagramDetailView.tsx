import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { Spacing, FontSize, BorderRadius } from '../theme/colors';

// Import datasets
import tuanData from '../data/ichuan/tuan.json';
import xiangData from '../data/ichuan/xiang.json';
import wenData from '../data/ichuan/wen.json';

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
    const styles = makeStyles(Colors);

    const getTuan = (id: number) => TuanDict[`iching__${id}`] || null;
    const getDaXiang = (id: number) => XiangDict[`iching__${id}`] || null;
    const getWen = (id: number) => WenDict[`iching__${id}`] || null;
    const getXiaoXiang = (hexId: number, lineIndex: number) => XiangDict[`iching__${hexId}_${lineIndex + 1}`] || null;

    return (
        <ScrollView style={styles.detailScroll} contentContainerStyle={styles.detailContent} showsVerticalScrollIndicator={false}>
            <View style={styles.detailTop}>
                <Text style={styles.detailSymbol}>{data.symbol}</Text>
                <Text style={styles.detailName}>{data.name}</Text>
                <Text style={styles.detailMeta}>{data.combination[0]}上 · {data.combination[1]}下</Text>
                <Text style={styles.detailArray}>爻象: {data.array.join('').replace(/0/g, '⚋').replace(/1/g, '—')}</Text>
            </View>

            <View style={styles.sectionBlock}>
                <Text style={styles.sectionLabel}>卦辞</Text>
                <Text style={styles.scriptureText}>{data.scripture}</Text>
            </View>

            <View style={styles.sectionBlock}>
                <Text style={styles.sectionLabel}>彖传 (Tuan)</Text>
                <Text style={styles.scriptureText}>{getTuan(data.id) || '暂无内容'}</Text>
            </View>

            <View style={styles.sectionBlock}>
                <Text style={styles.sectionLabel}>象传 (Da Xiang)</Text>
                <Text style={styles.scriptureText}>{getDaXiang(data.id) || '暂无内容'}</Text>
            </View>

            {getWen(data.id) && (
                <View style={styles.sectionBlock}>
                    <Text style={styles.sectionLabel}>文言 (Wen Yan)</Text>
                    <Text style={styles.scriptureText}>{getWen(data.id)}</Text>
                </View>
            )}

            <View style={styles.sectionBlock}>
                <Text style={styles.sectionLabel}>爻辞与小象</Text>
                {data.lines.map((line, index) => {
                    const xiaoXiang = getXiaoXiang(data.id, index);
                    return (
                        <View key={line.id} style={styles.lineItem}>
                            <View style={styles.lineHeader}>
                                <Text style={styles.lineName}>{line.name}</Text>
                            </View>
                            <View style={styles.lineBody}>
                                <Text style={styles.lineScripture}>{line.scripture}</Text>
                                {xiaoXiang && (
                                    <View style={styles.xiaoXiangBox}>
                                        <Text style={styles.xiaoXiangLabel}>《象》曰：</Text>
                                        <Text style={styles.xiaoXiangText}>{xiaoXiang}</Text>
                                    </View>
                                )}
                            </View>
                        </View>
                    );
                })}
            </View>
            <View style={{ height: 100 }} />
        </ScrollView>
    );
}

const makeStyles = (Colors: any) => StyleSheet.create({
    detailScroll: {
        flex: 1,
    },
    detailContent: {
        padding: Spacing.lg,
        paddingBottom: 40,
    },
    detailTop: {
        alignItems: 'center',
        marginBottom: Spacing.xxl,
        paddingVertical: Spacing.lg,
        backgroundColor: Colors.bg.elevated,
        borderRadius: BorderRadius.xl,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
    },
    detailSymbol: {
        fontSize: 72,
        color: Colors.text.heading,
        lineHeight: 80,
    },
    detailName: {
        fontSize: FontSize.xxl,
        color: Colors.accent.gold,
        fontWeight: 'bold',
        marginTop: Spacing.md,
    },
    detailMeta: {
        fontSize: FontSize.md,
        color: Colors.text.secondary,
        marginTop: Spacing.sm,
        letterSpacing: 2,
    },
    detailArray: {
        fontSize: FontSize.sm,
        color: Colors.text.tertiary,
        marginTop: Spacing.xs,
        letterSpacing: 4,
    },
    sectionBlock: {
        marginBottom: Spacing.xxl,
    },
    sectionLabel: {
        fontSize: FontSize.md,
        color: Colors.accent.gold,
        fontWeight: 'bold',
        marginBottom: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border.subtle,
        paddingBottom: Spacing.xs,
    },
    scriptureText: {
        fontSize: FontSize.md,
        color: Colors.text.primary,
        lineHeight: 26,
    },
    lineItem: {
        flexDirection: 'row',
        marginBottom: Spacing.md,
        backgroundColor: Colors.bg.card,
        padding: Spacing.md,
        borderRadius: BorderRadius.md,
        borderWidth: 0.5,
        borderColor: Colors.border.subtle,
    },
    lineHeader: {
        width: 60,
    },
    lineName: {
        fontSize: FontSize.md,
        color: Colors.text.secondary,
        fontWeight: 'bold',
    },
    lineBody: {
        flex: 1,
    },
    lineScripture: {
        fontSize: FontSize.md,
        color: Colors.text.primary,
        lineHeight: 24,
    },
    xiaoXiangBox: {
        marginTop: Spacing.sm,
        paddingTop: Spacing.sm,
        borderTopWidth: 0.5,
        borderStyle: 'dashed',
        borderTopColor: Colors.border.subtle,
    },
    xiaoXiangLabel: {
        fontSize: FontSize.sm,
        color: Colors.accent.gold,
        marginBottom: 4,
    },
    xiaoXiangText: {
        fontSize: FontSize.sm,
        color: Colors.text.tertiary,
        lineHeight: 20,
    }
});
