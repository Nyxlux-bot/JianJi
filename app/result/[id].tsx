/**
 * 排盘结果详情页
 * 对应路由: /result/[id]
 */

import React, { useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    ScrollView,
} from 'react-native';
import StatusBarDecor from '../../src/components/StatusBarDecor';
import ConfirmModal from '../../src/components/ConfirmModal';
import { CustomAlert } from '../../src/components/CustomAlertProvider';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spacing, FontSize, BorderRadius } from '../../src/theme/colors';
import { BackIcon, SparklesIcon, CompassIcon, MoreVerticalIcon } from '../../src/components/Icons';
import HexagramDisplay from '../../src/components/HexagramDisplay';
import FourPillars from '../../src/components/FourPillars';
import { PanResult } from '../../src/core/liuyao-calc';
import { getRecord, deleteRecord, getAllRecords, toggleFavorite } from '../../src/db/database';
import { isAIConfigured } from '../../src/services/settings';
import { useTheme } from "../../src/theme/ThemeContext";
import GuaXiangBottomSheet from '../../src/components/GuaXiangBottomSheet';
import AIChatModal from '../../src/components/AIChatModal';
import { shareResultMarkdown } from '../../src/services/share';
import OverflowMenu, { OverflowMenuItem } from '../../src/components/OverflowMenu';

const METHOD_CN: Record<string, string> = {
    time: '时间排卦', coin: '硬币排卦', number: '数字排卦', manual: '手动起卦',
};
const YAO_POS_CN = ['初', '二', '三', '四', '五', '上'];
const YAO_TITLE = (pos: number, isYang: boolean) =>
    `${isYang ? '九' : '六'}${YAO_POS_CN[pos - 1]}`;

export default function ResultPage() {
    const { Colors } = useTheme();
    const styles = makeStyles(Colors);
    const insets = useSafeAreaInsets();

    const { id } = useLocalSearchParams<{ id: string }>();
    const [result, setResult] = useState<PanResult | null>(null);
    const [isFavorite, setIsFavorite] = useState(false);
    const [showBasicInfo, setShowBasicInfo] = useState(false);
    const [aiChatVisible, setAiChatVisible] = useState(false);
    const [aiConfigured, setAiConfigured] = useState(false);
    const [deleteModalVisible, setDeleteModalVisible] = useState(false);
    const [sheetVisible, setSheetVisible] = useState(false);
    const [menuVisible, setMenuVisible] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            if (id) {
                const [detail, summaries] = await Promise.all([
                    getRecord(id),
                    getAllRecords(),
                ]);
                if (!cancelled) {
                    setResult(detail);
                    setIsFavorite(Boolean(summaries.find(item => item.id === id)?.isFavorite));
                }
            }
            const configured = await isAIConfigured();
            if (!cancelled) {
                setAiConfigured(configured);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [id]);

    const handleOpenAIChat = () => {
        if (!result) return;
        if (!aiConfigured) {
            CustomAlert.alert('未配置AI', '请先在设置中配置 AI 接口地址和 API Key', [
                { text: '去设置', onPress: () => router.push('/settings') },
                { text: '取消', style: 'cancel' },
            ]);
            return;
        }
        setAiChatVisible(true);
    };

    const confirmDelete = async () => {
        setDeleteModalVisible(false);
        if (id) {
            await deleteRecord(id);
            router.back();
        }
    };

    const handleDelete = () => {
        setDeleteModalVisible(true);
    };

    const handleToggleFavorite = async () => {
        if (!id) return;
        await toggleFavorite(id);
        setIsFavorite(prev => !prev);
    };

    const handleShare = async () => {
        if (!result) return;
        try {
            await shareResultMarkdown(result);
        } catch (error: any) {
            const message = typeof error?.message === 'string' ? error.message : '导出失败，请稍后重试';
            CustomAlert.alert('分享失败', message);
        }
    };

    const menuItems: OverflowMenuItem[] = [
        { key: 'share', label: '导出分享', onPress: handleShare },
        { key: 'favorite', label: isFavorite ? '取消收藏' : '收藏结果', onPress: handleToggleFavorite },
        { key: 'delete', label: '删除记录', onPress: handleDelete, destructive: true },
    ];

    if (!result) {
        return (
            <View style={styles.container}>
                <StatusBarDecor />
                <View style={styles.loading}>
                    <Text style={styles.loadingText}>加载中...</Text>
                </View>
            </View>
        );
    }

    const benGuaNumArray = result.benGuaYao.map(y => y.nature === 'yang' ? 1 : 0);

    return (
        <View style={styles.container}>
            <StatusBarDecor />
            {/* 顶部栏 */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
                    <BackIcon size={24} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>排盘结果</Text>
                <TouchableOpacity onPress={() => setMenuVisible(prev => !prev)} style={styles.headerBtn}>
                    <MoreVerticalIcon size={20} />
                </TouchableOpacity>
            </View>
            <OverflowMenu
                visible={menuVisible}
                top={insets.top + 54}
                right={Spacing.lg}
                items={menuItems}
                onClose={() => setMenuVisible(false)}
            />

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* 日期信息卡 */}
                <View style={styles.dateCard}>
                    <View style={styles.dateRow}>
                        <Text style={styles.solarDate}>{result.solarDate}  {result.solarTime}</Text>
                        <View style={styles.jieqiContainer}>
                            <Text style={styles.jieqiName}>{result.jieqi.current}</Text>
                            <Text style={styles.jieqiDate}>{result.jieqi.currentDate}</Text>
                            <Text style={styles.jieqiNext}>
                                下节 {result.jieqi.next} {result.jieqi.nextDate}
                            </Text>
                        </View>
                    </View>
                    <Text style={styles.lunarDate}>
                        农历{result.lunarInfo.lunarMonthCN}{result.lunarInfo.lunarDayCN}
                        {result.lunarInfo.hourZhi}时
                    </Text>
                    {result.trueSolarTime && (
                        <Text style={styles.trueSolarTime}>
                            真太阳时 {result.trueSolarTime}
                            {result.location ? ` · ${result.location}` : ''}
                        </Text>
                    )}
                </View>

                {/* 四柱八字 */}
                <FourPillars result={result} />

                {/* 本卦 + 变卦 */}
                <HexagramDisplay result={result} />

                {/* 动爻详情 */}
                {result.movingYaoPositions.length > 0 && (
                    <View style={styles.movingSection}>
                        <Text style={styles.sectionTitle}>动爻详情</Text>
                        {result.movingYaoPositions.map(pos => {
                            const yao = result.benGuaYao[pos - 1];
                            const title = YAO_TITLE(pos, yao.nature === 'yang');
                            return (
                                <View key={pos} style={styles.movingCard}>
                                    <View style={styles.movingHeader}>
                                        <Text style={styles.movingTitle}>{title}</Text>
                                        <View style={styles.movingBadge}>
                                            <Text style={styles.movingBadgeText}>动</Text>
                                        </View>
                                    </View>
                                    <Text style={styles.movingDesc}>
                                        {yao.liuShen} · {yao.liuQin}{yao.zhi}
                                        {yao.bianZhi ? ` → ${yao.bianLiuQin}${yao.bianZhi}` : ''}
                                    </Text>
                                </View>
                            );
                        })}
                    </View>
                )}

                {/* 基本信息 */}
                <TouchableOpacity
                    style={styles.basicInfoHeader}
                    activeOpacity={0.7}
                    onPress={() => setShowBasicInfo(!showBasicInfo)}
                >
                    <Text style={styles.sectionTitle}>基本信息</Text>
                    <Text style={styles.expandText}>{showBasicInfo ? '收起' : '展开'}</Text>
                </TouchableOpacity>

                {showBasicInfo && (
                    <View style={styles.basicInfoCard}>
                        <InfoRow label="起卦方式" value={METHOD_CN[result.method] || result.method} styles={styles} />
                        {result.question ? <InfoRow label="占问事项" value={result.question} styles={styles} /> : null}
                        <InfoRow label="年柱" value={`${result.yearGanZhi} (${result.yearNaYin})`} styles={styles} />
                        <InfoRow label="月柱" value={`${result.monthGanZhi} (${result.monthNaYin})`} styles={styles} />
                        <InfoRow label="日柱" value={`${result.dayGanZhi} (${result.dayNaYin})`} styles={styles} />
                        <InfoRow label="时柱" value={`${result.hourGanZhi} (${result.hourNaYin})`} styles={styles} />
                        <InfoRow label="本卦" value={`${result.benGua.fullName} (${result.benGua.gong}宫)`} styles={styles} />
                        {result.bianGua && (
                            <InfoRow label="变卦" value={`${result.bianGua.fullName} (${result.bianGua.gong}宫)`} styles={styles} />
                        )}
                        <InfoRow
                            label="世应"
                            value={`世爻第${result.benGua.shiYao}爻 · 应爻第${result.benGua.yingYao}爻`}
                            styles={styles}
                        />
                    </View>
                )}

                {/* 增加底部留白，防止被悬浮按钮遮挡 */}
                <View style={{ height: 120 }} />
            </ScrollView>

            {/* 底部悬浮双胶囊按钮区绝对定位 */}
            <View style={styles.floatingCapsulesContainer}>
                <TouchableOpacity
                    style={styles.floatingCapsuleBtn}
                    activeOpacity={0.8}
                    onPress={() => setSheetVisible(true)}
                >
                    <CompassIcon size={20} color={Colors.text.inverse} />
                    <Text style={styles.floatingCapsuleText}>查阅卦象</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.floatingCapsuleBtn}
                    activeOpacity={0.8}
                    onPress={handleOpenAIChat}
                >
                    <SparklesIcon size={20} color={Colors.text.inverse} />
                    <Text style={styles.floatingCapsuleText}>AI 分析</Text>
                </TouchableOpacity>
            </View>

            <ConfirmModal
                visible={deleteModalVisible}
                title="删除记录"
                message="确定要删除此排盘记录吗？删除后将无法恢复。"
                confirmText="删除"
                destructive={true}
                onConfirm={confirmDelete}
                onCancel={() => setDeleteModalVisible(false)}
            />

            {/* 半屏互错综卦象查阅抽屉 */}
            <GuaXiangBottomSheet
                visible={sheetVisible}
                onClose={() => setSheetVisible(false)}
                baseHexagramArray={benGuaNumArray}
            />

            {/* AI 沉浸式对话弹窗 */}
            <AIChatModal
                visible={aiChatVisible}
                onClose={() => setAiChatVisible(false)}
                result={result}
                onUpdateResult={(updatedResult) => {
                    setResult(updatedResult);
                }}
            />
        </View>
    );
}

const InfoRow: React.FC<{ label: string; value: string; styles: any }> = ({ label, value, styles }) => (
    <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
    </View>
);

// 定制化原生的 Markdown 显示样式
const makeMarkdownStyles = (Colors: any) => StyleSheet.create({
    body: {
        fontSize: FontSize.md,
        color: Colors.text.primary,
        lineHeight: 24,
    },
    heading1: {
        fontSize: FontSize.lg,
        color: Colors.accent.gold,
        marginTop: Spacing.md,
        marginBottom: Spacing.sm,
        fontWeight: 'bold',
    },
    heading2: {
        fontSize: FontSize.md,
        color: Colors.accent.gold,
        marginTop: Spacing.sm,
        marginBottom: Spacing.xs,
        fontWeight: 'bold',
    },
    heading3: {
        fontSize: FontSize.md,
        color: Colors.text.heading,
        marginTop: Spacing.sm,
        marginBottom: -Spacing.xs,
        fontWeight: 'bold',
    },
    strong: {
        fontWeight: 'bold',
        color: Colors.accent.gold,
    },
    em: {
        fontStyle: 'italic',
        color: Colors.text.secondary,
    },
    list_item: {
        marginVertical: 4,
    },
    bullet_list: {
        marginBottom: Spacing.md,
    },
    ordered_list: {
        marginBottom: Spacing.md,
    },
    blockquote: {
        backgroundColor: Colors.bg.elevated,
        borderLeftColor: Colors.border.subtle,
        borderLeftWidth: 4,
        paddingLeft: Spacing.md,
        marginVertical: Spacing.sm,
    },
    paragraph: {
        marginTop: 0,
        marginBottom: Spacing.md,
    }
} as any);

const makeStyles = (Colors: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.bg.primary },
    loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { color: Colors.text.secondary, fontSize: FontSize.md },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    },
    headerBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
    headerTitle: { fontSize: FontSize.lg, color: Colors.text.heading, fontWeight: '400' },
    content: { flex: 1 },
    dateCard: {
        marginHorizontal: Spacing.md, padding: Spacing.lg,
        backgroundColor: Colors.bg.card, borderRadius: BorderRadius.lg,
    },
    dateRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    solarDate: { fontSize: FontSize.lg, color: Colors.text.heading, fontWeight: '400' },
    jieqiContainer: { alignItems: 'flex-end' },
    jieqiName: { fontSize: FontSize.sm, color: Colors.accent.red },
    jieqiDate: { fontSize: FontSize.xs, color: Colors.text.tertiary, marginTop: 2 },
    jieqiNext: { fontSize: FontSize.xs, color: Colors.text.tertiary, marginTop: 2 },
    lunarDate: {
        fontSize: FontSize.sm, color: Colors.text.secondary, marginTop: Spacing.sm,
    },
    trueSolarTime: {
        fontSize: FontSize.xs, color: Colors.accent.gold, marginTop: 4,
    },
    movingSection: { paddingHorizontal: Spacing.md, marginTop: Spacing.md },
    sectionTitle: { fontSize: FontSize.lg, color: Colors.text.heading, fontWeight: '400' },
    movingCard: {
        backgroundColor: Colors.bg.card, borderRadius: BorderRadius.md,
        padding: Spacing.lg, marginTop: Spacing.md,
        borderLeftWidth: 3, borderLeftColor: Colors.accent.red,
    },
    movingHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    movingTitle: { fontSize: FontSize.lg, color: Colors.accent.red, fontWeight: '400' },
    movingBadge: {
        backgroundColor: Colors.yao.movingBg, paddingHorizontal: Spacing.sm,
        paddingVertical: 2, borderRadius: BorderRadius.sm,
    },
    movingBadgeText: { fontSize: FontSize.xs, color: Colors.accent.red },
    movingDesc: {
        fontSize: FontSize.sm, color: Colors.text.secondary, marginTop: Spacing.sm, lineHeight: 22,
    },
    basicInfoHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: Spacing.md, marginTop: Spacing.xxl, paddingVertical: Spacing.sm,
    },
    expandText: { fontSize: FontSize.sm, color: Colors.accent.gold },
    basicInfoCard: {
        marginHorizontal: Spacing.md, marginTop: Spacing.sm,
        backgroundColor: Colors.bg.card, borderRadius: BorderRadius.lg, padding: Spacing.lg,
    },
    infoRow: {
        flexDirection: 'row', justifyContent: 'space-between',
        paddingVertical: Spacing.sm, borderBottomWidth: 0.5, borderBottomColor: Colors.border.subtle,
    },
    infoLabel: { fontSize: FontSize.sm, color: Colors.text.tertiary },
    infoValue: { fontSize: FontSize.sm, color: Colors.text.primary, flex: 1, textAlign: 'right' },
    aiSection: {
        paddingHorizontal: Spacing.md, marginTop: Spacing.xxl,
    },
    aiResultCard: {
        marginTop: Spacing.lg, backgroundColor: Colors.bg.card,
        borderRadius: BorderRadius.lg, padding: Spacing.lg,
        borderLeftWidth: 3, borderLeftColor: Colors.accent.gold,
    },
    aiResultTitle: {
        fontSize: FontSize.md, color: Colors.accent.gold, fontWeight: '500',
        marginBottom: Spacing.md,
    },
    aiResultContent: {
        fontSize: FontSize.sm, color: Colors.text.primary, lineHeight: 24,
    },
    floatingCapsulesContainer: {
        position: 'absolute',
        bottom: 50,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-evenly',
        paddingHorizontal: Spacing.lg,
    },
    floatingCapsuleBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.accent.gold,
        paddingVertical: 14,
        paddingHorizontal: 28,
        borderRadius: 999, // 极高圆角胶囊
        shadowColor: Colors.accent.gold,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 6,
    },
    floatingCapsuleText: {
        color: Colors.text.inverse,
        fontSize: FontSize.md,
        fontWeight: 'bold',
        marginLeft: 8,
    }
});
