import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, SafeAreaView } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { Spacing, FontSize, BorderRadius } from '../theme/colors';
import HexagramDetailView, { HexagramData } from './HexagramDetailView';
import { CloseIcon } from './Icons';
import StatusBarDecor from './StatusBarDecor';

// Import hexagram dictionary
import ichingData from '../data/iching.json';
import { getAllRelatedGua } from '../core/hexagramTransform';

interface GuaXiangBottomSheetProps {
    visible: boolean;
    onClose: () => void;
    baseHexagramArray: number[]; // 长度为6的本卦爻象 [初, 二, 三, 四, 五, 上]
}

type TabType = 'base' | 'hu' | 'cuo' | 'zong';

export default function GuaXiangBottomSheet({ visible, onClose, baseHexagramArray }: GuaXiangBottomSheetProps) {
    const { Colors } = useTheme();
    const styles = makeStyles(Colors);

    const [activeTab, setActiveTab] = useState<TabType>('base');
    const [hexagramsData, setHexagramsData] = useState<Record<TabType, HexagramData | null>>({
        base: null, hu: null, cuo: null, zong: null
    });

    useEffect(() => {
        if (!visible || !baseHexagramArray || baseHexagramArray.length !== 6) return;

        try {
            const allRelatedArrays = getAllRelatedGua(baseHexagramArray);

            // 辅助函数：通过数组匹配 dictionary 中的数据
            const findGuaDataByArray = (arr: number[]) => {
                const targetStr = arr.join('');
                return (ichingData as HexagramData[]).find(item => item.array.join('') === targetStr) || null;
            };

            setHexagramsData({
                base: findGuaDataByArray(allRelatedArrays.base),
                hu: findGuaDataByArray(allRelatedArrays.hu),
                cuo: findGuaDataByArray(allRelatedArrays.cuo),
                zong: findGuaDataByArray(allRelatedArrays.zong),
            });
            setActiveTab('base'); // reset
        } catch (error) {
            console.error("生成相连卦象失败:", error);
        }
    }, [visible, baseHexagramArray]);

    const tabs: { key: TabType, label: string }[] = [
        { key: 'base', label: '本卦' },
        { key: 'hu', label: '互卦' },
        { key: 'cuo', label: '错卦' },
        { key: 'zong', label: '综卦' },
    ];

    const currentData = hexagramsData[activeTab];

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.sheetContainer}>
                    {/* 伪首栏作为底色延伸 */}
                    <SafeAreaView style={{ backgroundColor: Colors.bg.elevated }} />

                    {/* Header 控制区 */}
                    <View style={styles.header}>
                        <View style={styles.iconBtnPlaceholder} />
                        <Text style={styles.title}>卦象演化与详释</Text>
                        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                            <CloseIcon size={24} color={Colors.text.primary} />
                        </TouchableOpacity>
                    </View>

                    {/* Segmented Control */}
                    <View style={styles.tabsContainer}>
                        {tabs.map((tab) => {
                            const isActive = activeTab === tab.key;
                            return (
                                <TouchableOpacity
                                    key={tab.key}
                                    style={[styles.tabBtn, isActive && styles.tabBtnActive]}
                                    onPress={() => setActiveTab(tab.key)}
                                >
                                    <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                                        {tab.label}
                                    </Text>
                                    <View style={styles.tabBadgeBox}>
                                        <Text style={[styles.tabBadgeText, isActive && styles.tabBadgeTextActive]}>
                                            {hexagramsData[tab.key]?.name || '...'}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {/* Content View */}
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
        </Modal>
    );
}

const makeStyles = (Colors: any) => StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.6)', // 暗色蒙版
    },
    sheetContainer: {
        height: '92%', // 占屏幕较高比例的半屏
        backgroundColor: Colors.bg.primary,
        borderTopLeftRadius: BorderRadius.xl,
        borderTopRightRadius: BorderRadius.xl,
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        backgroundColor: Colors.bg.elevated,
    },
    title: {
        fontSize: FontSize.lg,
        color: Colors.text.heading,
        fontWeight: 'bold',
    },
    iconBtnPlaceholder: { width: 40, height: 40 },
    closeBtn: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.bg.card,
        borderRadius: 20
    },
    tabsContainer: {
        flexDirection: 'row',
        backgroundColor: Colors.bg.elevated,
        paddingHorizontal: Spacing.md,
        paddingBottom: Spacing.md,
        borderBottomWidth: 0.5,
        borderBottomColor: Colors.border.subtle,
    },
    tabBtn: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: Spacing.sm,
        marginHorizontal: 4,
        borderRadius: BorderRadius.md,
        backgroundColor: 'transparent',
    },
    tabBtnActive: {
        backgroundColor: Colors.accent.gold + '20', // 透金背景
    },
    tabLabel: {
        fontSize: FontSize.md,
        color: Colors.text.secondary,
        fontWeight: '500',
    },
    tabLabelActive: {
        color: Colors.accent.gold,
        fontWeight: 'bold',
    },
    tabBadgeBox: {
        marginTop: 2,
    },
    tabBadgeText: {
        fontSize: FontSize.sm,
        color: Colors.text.tertiary,
    },
    tabBadgeTextActive: {
        color: Colors.accent.gold,
    },
    contentWrapper: {
        flex: 1,
        backgroundColor: Colors.bg.primary,
    },
    emptyBox: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center'
    },
    emptyText: {
        color: Colors.text.tertiary,
        fontSize: FontSize.md
    }
});
