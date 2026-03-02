import React, { useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, FlatList, Modal, ScrollView
} from 'react-native';
import { router } from 'expo-router';
import StatusBarDecor from '../../src/components/StatusBarDecor';
import { useTheme } from '../../src/theme/ThemeContext';
import { BackIcon, ChevronRightIcon, CloseIcon } from '../../src/components/Icons';
import { Spacing, FontSize, BorderRadius } from '../../src/theme/colors';

// Import datasets
import ichingData from '../../src/data/iching.json';
import tuanData from '../../src/data/ichuan/tuan.json';
import xiangData from '../../src/data/ichuan/xiang.json';
import wenData from '../../src/data/ichuan/wen.json';

interface HexagramData {
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

// Type cast the imported dictionaries safely
const TuanDict = tuanData as Record<string, string>;
const XiangDict = xiangData as Record<string, string>;
const WenDict = wenData as Record<string, string>;

export default function HexagramsOverviewPage() {
    const { Colors } = useTheme();
    const styles = makeStyles(Colors);

    const data = ichingData as HexagramData[];
    const [selectedHex, setSelectedHex] = useState<HexagramData | null>(null);

    const renderItem = ({ item }: { item: HexagramData }) => (
        <TouchableOpacity
            style={styles.card}
            activeOpacity={0.7}
            onPress={() => setSelectedHex(item)}
        >
            <View style={styles.cardLeft}>
                <Text style={styles.symbol}>{item.symbol}</Text>
                <View style={styles.info}>
                    <Text style={styles.name}>{item.id}. {item.name}</Text>
                    <Text style={styles.meta}>
                        {item.combination[0]}上 · {item.combination[1]}下
                    </Text>
                </View>
            </View>
            <ChevronRightIcon size={20} color={Colors.text.tertiary} />
        </TouchableOpacity>
    );

    // Helpers to retrieve Yi Zhuan
    const getTuan = (id: number) => TuanDict[`iching__${id}`] || null;
    const getDaXiang = (id: number) => XiangDict[`iching__${id}`] || null;
    const getWen = (id: number) => WenDict[`iching__${id}`] || null;
    const getXiaoXiang = (hexId: number, lineIndex: number) => XiangDict[`iching__${hexId}_${lineIndex + 1}`] || null;

    return (
        <View style={styles.container}>
            <StatusBarDecor />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
                    <BackIcon size={24} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>周易六十四卦库</Text>
                <View style={styles.iconBtn} />
            </View>

            <FlatList
                data={data}
                keyExtractor={item => item.id.toString()}
                renderItem={renderItem}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                initialNumToRender={10}
            />

            {/* Detail Modal */}
            <Modal
                visible={!!selectedHex}
                animationType="slide"
                onRequestClose={() => setSelectedHex(null)}
            >
                <View style={[styles.container, { backgroundColor: Colors.bg.primary }]}>
                    <StatusBarDecor />
                    <View style={styles.header}>
                        <View style={styles.iconBtn} />
                        <Text style={styles.headerTitle}>{selectedHex?.name}卦详解</Text>
                        <TouchableOpacity onPress={() => setSelectedHex(null)} style={styles.iconBtn}>
                            <CloseIcon size={24} color={Colors.text.primary} />
                        </TouchableOpacity>
                    </View>

                    {selectedHex && (
                        <ScrollView style={styles.detailScroll} contentContainerStyle={styles.detailContent}>
                            <View style={styles.detailTop}>
                                <Text style={styles.detailSymbol}>{selectedHex.symbol}</Text>
                                <Text style={styles.detailName}>{selectedHex.name}</Text>
                                <Text style={styles.detailMeta}>{selectedHex.combination[0]}上 · {selectedHex.combination[1]}下</Text>
                                <Text style={styles.detailArray}>爻象: {selectedHex.array.join('').replace(/0/g, '⚋').replace(/1/g, '—')}</Text>
                            </View>

                            <View style={styles.sectionBlock}>
                                <Text style={styles.sectionLabel}>卦辞</Text>
                                <Text style={styles.scriptureText}>{selectedHex.scripture}</Text>
                            </View>

                            <View style={styles.sectionBlock}>
                                <Text style={styles.sectionLabel}>彖传 (Tuan)</Text>
                                <Text style={styles.scriptureText}>{getTuan(selectedHex.id) || '暂无内容'}</Text>
                            </View>

                            <View style={styles.sectionBlock}>
                                <Text style={styles.sectionLabel}>象传 (大象)</Text>
                                <Text style={styles.scriptureText}>{getDaXiang(selectedHex.id) || '暂无内容'}</Text>
                            </View>

                            {getWen(selectedHex.id) && (
                                <View style={styles.sectionBlock}>
                                    <Text style={styles.sectionLabel}>文言 (Wen Yan)</Text>
                                    <Text style={styles.scriptureText}>{getWen(selectedHex.id)}</Text>
                                </View>
                            )}

                            <View style={styles.sectionBlock}>
                                <Text style={styles.sectionLabel}>爻辞与小象</Text>
                                {selectedHex.lines.map((line, index) => {
                                    const xiaoXiang = getXiaoXiang(selectedHex.id, index);
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
                            <View style={{ height: 60 }} />
                        </ScrollView>
                    )}
                </View>
            </Modal>
        </View>
    );
}

const makeStyles = (Colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.bg.primary,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        borderBottomWidth: 0.5,
        borderColor: Colors.border.subtle,
    },
    iconBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
    headerTitle: {
        fontSize: FontSize.lg,
        color: Colors.text.heading,
        fontWeight: '500'
    },
    listContent: {
        paddingHorizontal: Spacing.xl,
        paddingTop: Spacing.md,
        paddingBottom: 60,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: Colors.bg.card,
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        marginBottom: Spacing.sm,
        borderWidth: 0.5,
        borderColor: Colors.border.subtle,
    },
    cardLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    symbol: {
        fontSize: 48,
        color: Colors.text.heading,
        fontWeight: '300',
        lineHeight: 52,
    },
    info: {
        marginLeft: Spacing.lg,
    },
    name: {
        fontSize: FontSize.lg,
        color: Colors.text.heading,
        fontWeight: '500',
    },
    meta: {
        fontSize: FontSize.sm,
        color: Colors.text.tertiary,
        marginTop: 4,
    },
    detailScroll: {
        flex: 1,
    },
    detailContent: {
        padding: Spacing.xl,
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
