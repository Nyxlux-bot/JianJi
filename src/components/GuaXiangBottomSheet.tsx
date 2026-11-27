import React, { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SheetModal from './SheetModal';
import PressableScale from './PressableScale';
import { useTheme } from '../theme/ThemeContext';
import { buildResultPalette, type ResultPalette } from '../theme/result-palette';
import HexagramDetailView, { HexagramData } from './HexagramDetailView';
import { CloseIcon } from './Icons';

// Import hexagram dictionary
import ichingData from '../data/iching.json';
import { getAllRelatedGua } from '../core/hexagramTransform';

const SERIF = Platform.select({ ios: 'Songti SC', android: 'serif', default: 'serif' });

interface GuaXiangBottomSheetProps {
    visible: boolean;
    onClose: () => void;
    baseHexagramArray: number[]; // 长度为6的本卦爻象 [初, 二, 三, 四, 五, 上]
}

type TabType = 'base' | 'hu' | 'cuo' | 'zong';

export default function GuaXiangBottomSheet({ visible, onClose, baseHexagramArray }: GuaXiangBottomSheetProps) {
    const { Colors } = useTheme();
    const insets = useSafeAreaInsets();
    const palette = useMemo(() => buildResultPalette(Colors), [Colors]);
    const styles = useMemo(() => makeStyles(palette), [palette]);

    const [activeTab, setActiveTab] = useState<TabType>('base');
    const [hexagramsData, setHexagramsData] = useState<Record<TabType, HexagramData | null>>({
        base: null, hu: null, cuo: null, zong: null,
    });

    useEffect(() => {
        if (!visible || !baseHexagramArray || baseHexagramArray.length !== 6) return;

        try {
            const allRelatedArrays = getAllRelatedGua(baseHexagramArray);

            const findGuaDataByArray = (arr: number[]) => {
                const targetStr = arr.join('');
                return (ichingData as HexagramData[]).find((item) => item.array.join('') === targetStr) || null;
            };

            setHexagramsData({
                base: findGuaDataByArray(allRelatedArrays.base),
                hu: findGuaDataByArray(allRelatedArrays.hu),
                cuo: findGuaDataByArray(allRelatedArrays.cuo),
                zong: findGuaDataByArray(allRelatedArrays.zong),
            });
            setActiveTab('base');
        } catch (error) {
            console.error('生成相连卦象失败:', error);
        }
    }, [visible, baseHexagramArray]);

    const tabs: { key: TabType; label: string }[] = [
        { key: 'base', label: '本卦' },
        { key: 'hu', label: '互卦' },
        { key: 'cuo', label: '错卦' },
        { key: 'zong', label: '综卦' },
    ];

    const currentData = hexagramsData[activeTab];

    return (
        <SheetModal visible={visible} onRequestClose={onClose}>
            <View style={styles.overlay}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="关闭卦象详释" />
                <View style={[styles.sheetContainer, { paddingBottom: insets.bottom }]} accessibilityViewIsModal aria-modal>
                    <View style={styles.header}>
                        <View style={styles.iconBtnPlaceholder} />
                        <Text style={styles.title} accessibilityRole="header">卦象演化与详释</Text>
                        <PressableScale style={styles.closeBtn} onPress={onClose} accessibilityRole="button" accessibilityLabel="关闭">
                            <CloseIcon size={20} color={palette.muted} />
                        </PressableScale>
                    </View>

                    <View style={styles.tabsContainer} accessibilityRole="tablist">
                        {tabs.map((tab) => {
                            const isActive = activeTab === tab.key;
                            return (
                                <PressableScale
                                    key={tab.key}
                                    style={[styles.tabBtn, isActive && styles.tabBtnActive]}
                                    onPress={() => setActiveTab(tab.key)}
                                    accessibilityRole="tab"
                                    accessibilityState={{ selected: isActive }}
                                >
                                    <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                                        {tab.label}
                                    </Text>
                                    <Text style={[styles.tabBadgeText, isActive && styles.tabBadgeTextActive]} numberOfLines={1}>
                                        {hexagramsData[tab.key]?.name || '…'}
                                    </Text>
                                </PressableScale>
                            );
                        })}
                    </View>

                    <View style={styles.contentWrapper}>
                        {currentData ? (
                            <HexagramDetailView data={currentData} />
                        ) : (
                            <View style={styles.emptyBox}>
                                <Text style={styles.emptyText}>无法检索对应的卦象辞典</Text>
                            </View>
                        )}
                    </View>
                </View>
            </View>
        </SheetModal>
    );
}

const makeStyles = (palette: ResultPalette) => StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    sheetContainer: {
        height: '88%',
        backgroundColor: palette.page,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        borderTopWidth: 1,
        borderColor: palette.cardBorder,
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 14,
        paddingVertical: 10,
        backgroundColor: palette.card,
    },
    title: {
        fontFamily: SERIF,
        fontSize: 17,
        lineHeight: 24,
        fontWeight: '700',
        letterSpacing: 2,
        color: palette.heading,
    },
    iconBtnPlaceholder: { width: 40, height: 40 },
    closeBtn: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 20,
    },
    tabsContainer: {
        flexDirection: 'row',
        gap: 6,
        backgroundColor: palette.card,
        paddingHorizontal: 12,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: palette.hairline,
    },
    tabBtn: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 7,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'transparent',
        backgroundColor: 'transparent',
        gap: 2,
    },
    tabBtnActive: {
        backgroundColor: palette.goldSoft,
        borderColor: palette.segBorder,
    },
    tabLabel: {
        fontSize: 13.5,
        lineHeight: 18,
        color: palette.muted,
        fontWeight: '500',
    },
    tabLabelActive: {
        color: palette.gold,
        fontWeight: '700',
    },
    tabBadgeText: {
        fontFamily: SERIF,
        fontSize: 12,
        lineHeight: 16,
        color: palette.muted,
    },
    tabBadgeTextActive: {
        color: palette.heading,
    },
    contentWrapper: {
        flex: 1,
        backgroundColor: palette.page,
    },
    emptyBox: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyText: {
        color: palette.muted,
        fontSize: 14,
    },
});
