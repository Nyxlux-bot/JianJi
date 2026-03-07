import React, { useState } from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { router } from 'expo-router';
import StatusBarDecor from '../../src/components/StatusBarDecor';
import { useTheme } from '../../src/theme/ThemeContext';
import { BorderRadius, FontSize, Spacing } from '../../src/theme/colors';
import {
    BaGuaIcon,
    ClockIcon,
    CoinIcon,
    HandIcon,
    HistoryIcon,
    NumberIcon,
    ReadIcon,
} from '../../src/components/Icons';

type HomeSystemTab = 'liuyao' | 'bazi';

interface MethodTileProps {
    title: string;
    description: string;
    icon: React.ReactNode;
    onPress: () => void;
    styles: ReturnType<typeof makeStyles>;
}

const MethodTile: React.FC<MethodTileProps> = ({ title, description, icon, onPress, styles }) => (
    <TouchableOpacity style={styles.methodTile} activeOpacity={0.78} onPress={onPress}>
        <View style={styles.methodTileIcon}>{icon}</View>
        <Text style={styles.methodTileTitle}>{title}</Text>
        <Text style={styles.methodTileDesc}>{description}</Text>
    </TouchableOpacity>
);

const QuickCard: React.FC<{
    title: string;
    description: string;
    icon: React.ReactNode;
    onPress: () => void;
    styles: ReturnType<typeof makeStyles>;
}> = ({ title, description, icon, onPress, styles }) => (
    <TouchableOpacity style={styles.quickCard} activeOpacity={0.82} onPress={onPress}>
        <View style={styles.quickCardTop}>
            <View style={styles.quickCardIcon}>{icon}</View>
            <Text style={styles.quickCardTitle}>{title}</Text>
        </View>
        <Text style={styles.quickCardDesc}>{description}</Text>
    </TouchableOpacity>
);

export default function HomePage() {
    const { Colors } = useTheme();
    const styles = makeStyles(Colors);
    const [activeTab, setActiveTab] = useState<HomeSystemTab>('liuyao');

    return (
        <View style={styles.container}>
            <StatusBarDecor />
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.heroSection}>
                    <View style={styles.heroBadge}>
                        <BaGuaIcon size={62} color={Colors.accent.gold} />
                    </View>
                    <Text style={styles.appTitle}>见机</Text>
                    <Text style={styles.appSubtitle}>六爻易数 · 八字命理</Text>
                    <Text style={styles.heroDesc}>
                        起卦、排盘、回看、备份，一处完成。
                    </Text>
                </View>

                <View style={styles.segmentedWrap}>
                    <TouchableOpacity
                        style={[styles.segmentedBtn, activeTab === 'liuyao' && styles.segmentedBtnActive]}
                        onPress={() => setActiveTab('liuyao')}
                        activeOpacity={0.84}
                    >
                        <Text style={[styles.segmentedText, activeTab === 'liuyao' && styles.segmentedTextActive]}>
                            六爻易数
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.segmentedBtn, activeTab === 'bazi' && styles.segmentedBtnActive]}
                        onPress={() => setActiveTab('bazi')}
                        activeOpacity={0.84}
                    >
                        <Text style={[styles.segmentedText, activeTab === 'bazi' && styles.segmentedTextActive]}>
                            八字命理
                        </Text>
                    </TouchableOpacity>
                </View>

                {activeTab === 'liuyao' ? (
                    <View style={styles.primarySection}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>六爻起卦</Text>
                            <Text style={styles.sectionHint}>四种起卦方式</Text>
                        </View>

                        <View style={styles.methodGrid}>
                            <MethodTile
                                title="时间排卦"
                                description="当前或指定时间起卦"
                                icon={<ClockIcon size={24} />}
                                onPress={() => router.push('/divination/time')}
                                styles={styles}
                            />
                            <MethodTile
                                title="硬币排卦"
                                description="模拟铜钱六次摇掷"
                                icon={<CoinIcon size={24} />}
                                onPress={() => router.push('/divination/coin')}
                                styles={styles}
                            />
                            <MethodTile
                                title="数字排卦"
                                description="数字成卦，快速直达"
                                icon={<NumberIcon size={24} />}
                                onPress={() => router.push('/divination/number')}
                                styles={styles}
                            />
                            <MethodTile
                                title="手动起卦"
                                description="逐爻录入，自由组合"
                                icon={<HandIcon size={24} />}
                                onPress={() => router.push('/divination/manual')}
                                styles={styles}
                            />
                        </View>
                    </View>
                ) : (
                    <View style={styles.primarySection}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>八字命理</Text>
                            <Text style={styles.sectionHint}>专业四柱排盘</Text>
                        </View>

                        <TouchableOpacity
                            style={styles.baziFeatureCard}
                            activeOpacity={0.82}
                            onPress={() => router.push('/bazi/input')}
                        >
                            <View style={styles.baziFeatureHead}>
                                <View style={styles.baziFeatureIcon}>
                                    <ReadIcon size={28} />
                                </View>
                                <View style={styles.baziFeatureBadge}>
                                    <Text style={styles.baziFeatureBadgeText}>专业细盘</Text>
                                </View>
                            </View>
                            <Text style={styles.baziFeatureTitle}>八字排盘</Text>
                            <Text style={styles.baziFeatureDesc}>
                                支持四柱、十神、藏干、大运、流年、流月，以及专业细盘查看。
                            </Text>
                            <View style={styles.baziPillRow}>
                                <View style={styles.baziPill}><Text style={styles.baziPillText}>本地钟表时</Text></View>
                                <View style={styles.baziPill}><Text style={styles.baziPillText}>平太阳时</Text></View>
                                <View style={styles.baziPill}><Text style={styles.baziPillText}>真太阳时</Text></View>
                            </View>
                        </TouchableOpacity>
                    </View>
                )}

                <View style={styles.quickSection}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>卷宗与学习</Text>
                        <Text style={styles.sectionHint}>常用快捷入口</Text>
                    </View>

                    <View style={styles.quickGrid}>
                        <QuickCard
                            title="历史卷宗"
                            description="查看六爻与八字记录，支持收藏与筛选。"
                            icon={<HistoryIcon size={22} />}
                            onPress={() => router.push('/history')}
                            styles={styles}
                        />
                        <QuickCard
                            title="易学资料"
                            description="进入六十四卦总览与后续学习内容。"
                            icon={<ReadIcon size={22} />}
                            onPress={() => router.push('/learn')}
                            styles={styles}
                        />
                    </View>
                </View>

                <View style={styles.footer}>
                    <Text style={styles.footerText}>心诚则灵</Text>
                </View>
            </ScrollView>
        </View>
    );
}

const makeStyles = (Colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.bg.primary,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 40,
    },
    heroSection: {
        alignItems: 'center',
        paddingTop: 48,
        paddingBottom: 28,
        paddingHorizontal: Spacing.xl,
    },
    heroBadge: {
        width: 88,
        height: 88,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.bg.card,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
    },
    appTitle: {
        marginTop: Spacing.lg,
        fontSize: FontSize.xxxl,
        color: Colors.text.heading,
        fontWeight: '300',
        letterSpacing: 8,
    },
    appSubtitle: {
        marginTop: Spacing.sm,
        fontSize: FontSize.sm,
        color: Colors.accent.gold,
        letterSpacing: 4,
    },
    heroDesc: {
        marginTop: Spacing.md,
        fontSize: FontSize.sm,
        color: Colors.text.tertiary,
        lineHeight: 22,
        textAlign: 'center',
        maxWidth: 320,
    },
    segmentedWrap: {
        flexDirection: 'row',
        marginHorizontal: Spacing.xl,
        marginBottom: Spacing.xl,
        backgroundColor: Colors.bg.elevated,
        borderRadius: BorderRadius.round,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
        padding: 4,
    },
    segmentedBtn: {
        flex: 1,
        minHeight: 42,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: BorderRadius.round,
    },
    segmentedBtnActive: {
        backgroundColor: Colors.bg.card,
        borderWidth: 1,
        borderColor: Colors.accent.gold,
    },
    segmentedText: {
        fontSize: FontSize.md,
        color: Colors.text.secondary,
        fontWeight: '600',
    },
    segmentedTextActive: {
        color: Colors.accent.gold,
    },
    primarySection: {
        paddingHorizontal: Spacing.xl,
        marginBottom: Spacing.xl,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        marginBottom: Spacing.lg,
    },
    sectionTitle: {
        fontSize: FontSize.lg,
        color: Colors.text.heading,
        fontWeight: '600',
    },
    sectionHint: {
        fontSize: FontSize.xs,
        color: Colors.text.tertiary,
    },
    methodGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.md,
    },
    methodTile: {
        width: '48%',
        minHeight: 124,
        borderRadius: BorderRadius.lg,
        backgroundColor: Colors.bg.card,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
        padding: Spacing.lg,
    },
    methodTileIcon: {
        width: 42,
        height: 42,
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.bg.elevated,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing.md,
    },
    methodTileTitle: {
        fontSize: FontSize.md,
        color: Colors.text.heading,
        fontWeight: '600',
    },
    methodTileDesc: {
        marginTop: 6,
        fontSize: FontSize.xs,
        color: Colors.text.tertiary,
        lineHeight: 18,
    },
    baziFeatureCard: {
        borderRadius: BorderRadius.xl,
        backgroundColor: Colors.bg.card,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
        padding: Spacing.xl,
    },
    baziFeatureHead: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: Spacing.lg,
    },
    baziFeatureIcon: {
        width: 52,
        height: 52,
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.bg.elevated,
        alignItems: 'center',
        justifyContent: 'center',
    },
    baziFeatureBadge: {
        paddingHorizontal: Spacing.md,
        paddingVertical: 6,
        borderRadius: BorderRadius.round,
        backgroundColor: Colors.accent.gold + '20',
        borderWidth: 1,
        borderColor: Colors.accent.gold + '33',
    },
    baziFeatureBadgeText: {
        color: Colors.accent.gold,
        fontSize: FontSize.xs,
        fontWeight: '600',
    },
    baziFeatureTitle: {
        fontSize: FontSize.xl,
        color: Colors.text.heading,
        fontWeight: '700',
    },
    baziFeatureDesc: {
        marginTop: Spacing.sm,
        fontSize: FontSize.sm,
        color: Colors.text.secondary,
        lineHeight: 22,
    },
    baziPillRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
        marginTop: Spacing.lg,
    },
    baziPill: {
        paddingHorizontal: Spacing.md,
        paddingVertical: 7,
        borderRadius: BorderRadius.round,
        backgroundColor: Colors.bg.elevated,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
    },
    baziPillText: {
        color: Colors.text.secondary,
        fontSize: FontSize.xs,
    },
    quickSection: {
        paddingHorizontal: Spacing.xl,
        marginBottom: Spacing.xl,
    },
    quickGrid: {
        flexDirection: 'row',
        gap: Spacing.md,
    },
    quickCard: {
        flex: 1,
        minHeight: 122,
        borderRadius: BorderRadius.lg,
        backgroundColor: Colors.bg.card,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
        padding: Spacing.lg,
        justifyContent: 'space-between',
    },
    quickCardTop: {
        gap: Spacing.md,
    },
    quickCardIcon: {
        width: 40,
        height: 40,
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.bg.elevated,
        alignItems: 'center',
        justifyContent: 'center',
    },
    quickCardTitle: {
        fontSize: FontSize.md,
        color: Colors.text.heading,
        fontWeight: '600',
    },
    quickCardDesc: {
        fontSize: FontSize.xs,
        color: Colors.text.tertiary,
        lineHeight: 18,
    },
    footer: {
        alignItems: 'center',
        marginTop: Spacing.xxxl,
        paddingBottom: Spacing.xxl,
    },
    footerText: {
        fontSize: FontSize.xs,
        color: Colors.text.tertiary,
        letterSpacing: 6,
    },
});
