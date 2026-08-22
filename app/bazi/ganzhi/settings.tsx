import React from 'react';
import {
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackIcon } from '../../../src/components/Icons';
import { CustomAlert } from '../../../src/components/CustomAlertProvider';
import StatusBarDecor from '../../../src/components/StatusBarDecor';
import { GanZhiRelationSettingKey } from '../../../src/core/bazi-ganzhi-relation-engine';
import { useGanZhiRelationSettings } from '../../../src/features/bazi/ganzhi-relation-settings';
import { BorderRadius, FontSize, Spacing } from '../../../src/theme/colors';
import { useTheme } from '../../../src/theme/ThemeContext';

interface SettingItem {
    key: GanZhiRelationSettingKey;
    label: string;
    help?: string;
}

const GROUPS: Array<{ title: string; items: SettingItem[] }> = [
    {
        title: '天干关系',
        items: [
            { key: 'stemClash', label: '天干相冲' },
            { key: 'stemControl', label: '天干相克' },
            {
                key: 'stemFiveCombination',
                label: '天干五合',
                help: '图示中的“合化某五行”只表示五合的结构归属，不代表已经满足旺衰、月令等成化条件。',
            },
        ],
    },
    {
        title: '地支关系',
        items: [
            {
                key: 'branchSixCombination',
                label: '地支六合',
                help: '图示中的“合化某五行”只表示六合的结构归属，不作为旺衰层面的成化结论。',
            },
            { key: 'branchThreeCombination', label: '地支三合' },
            { key: 'branchThreeMeeting', label: '地支三会' },
            {
                key: 'branchHiddenCombination',
                label: '地支暗合',
                help: '默认采用寅丑、午亥、卯申三组口径。',
            },
            {
                key: 'branchHiddenSandwich',
                label: '地支暗夹',
                help: '相邻且同干的两柱，地支为三会两端，并且中神没有明现时，显示暗夹。',
            },
            {
                key: 'branchSandwich',
                label: '地支夹',
                help: '相邻两柱的地支为三会两端，并且中神没有明现时显示；不要求两柱同干。',
            },
            { key: 'branchPunishment', label: '地支相刑' },
            { key: 'branchClash', label: '地支相冲' },
            { key: 'branchBreak', label: '地支相破' },
            { key: 'branchHarm', label: '地支相害' },
        ],
    },
    {
        title: '整柱关系',
        items: [
            {
                key: 'pillarSelfCombination',
                label: '自合',
                help: '按甲午、壬午、丁亥、戊子、辛巳、癸巳六组识别。',
            },
            {
                key: 'pillarHiddenCarry',
                label: '暗带',
                help: '相邻原局两柱在六十甲子中相隔一柱时，显示中间一柱。',
            },
            { key: 'pillarCover', label: '盖头' },
            { key: 'pillarCut', label: '截脚' },
            { key: 'pillarRepeating', label: '伏吟' },
            {
                key: 'pillarOpposing',
                label: '反吟',
                help: '两柱同时满足天干相克、地支相冲时显示反吟。',
            },
        ],
    },
];

export default function GanZhiRelationSettingsPage() {
    const { Colors } = useTheme();
    const styles = makeStyles(Colors);
    const insets = useSafeAreaInsets();
    const { settings, setSetting, resetSettings } = useGanZhiRelationSettings();

    const showHelp = (item: SettingItem) => {
        if (item.help) CustomAlert.alert(item.label, item.help);
    };

    const confirmReset = () => {
        CustomAlert.alert('恢复默认设置', '确定恢复参考应用的默认干支关系设置吗？', [
            { text: '取消', style: 'cancel' },
            {
                text: '恢复默认',
                onPress: () => {
                    resetSettings();
                    CustomAlert.alert('已恢复', '干支关系设置已恢复默认。');
                },
            },
        ]);
    };

    return (
        <View style={styles.container}>
            <StatusBarDecor />
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => router.back()}
                    accessibilityRole="button"
                    accessibilityLabel="返回"
                    activeOpacity={0.75}
                >
                    <BackIcon size={25} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>干支关系</Text>
                <View style={styles.headerSpacer} />
            </View>
            <ScrollView
                contentContainerStyle={[
                    styles.scrollContent,
                    { paddingBottom: Math.max(insets.bottom, Spacing.xl) + Spacing.xl },
                ]}
                showsVerticalScrollIndicator={false}
            >
                <Text style={styles.intro}>
                    设置会同步应用到干支图示、干支分层文字和分析上下文。
                </Text>
                {GROUPS.map((group) => (
                    <View key={group.title} style={styles.card}>
                        <Text style={styles.groupTitle}>{group.title}</Text>
                        {group.items.map((item, index) => (
                            <View
                                key={item.key}
                                style={[styles.row, index > 0 && styles.rowBorder]}
                            >
                                <View style={styles.rowLabelWrap}>
                                    <Text style={styles.rowLabel}>{item.label}</Text>
                                    {item.help ? (
                                        <TouchableOpacity
                                            style={styles.helpButton}
                                            onPress={() => showHelp(item)}
                                            accessibilityRole="button"
                                            accessibilityLabel={`查看${item.label}说明`}
                                        >
                                            <Text style={styles.helpText}>?</Text>
                                        </TouchableOpacity>
                                    ) : null}
                                </View>
                                <View style={styles.valueWrap}>
                                    <Text style={styles.valueText}>{settings[item.key] ? '开启' : '关闭'}</Text>
                                    <Switch
                                        value={settings[item.key]}
                                        onValueChange={(value) => setSetting(item.key, value)}
                                        trackColor={{
                                            false: Colors.border.normal,
                                            true: Colors.accent.jade,
                                        }}
                                        thumbColor={Colors.bg.card}
                                        accessibilityLabel={item.label}
                                    />
                                </View>
                            </View>
                        ))}
                    </View>
                ))}
                <TouchableOpacity
                    style={styles.resetButton}
                    onPress={confirmReset}
                    activeOpacity={0.78}
                    accessibilityRole="button"
                >
                    <Text style={styles.resetText}>恢复默认设置</Text>
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
}

const makeStyles = (Colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.bg.primary,
    },
    header: {
        minHeight: 58,
        paddingHorizontal: Spacing.lg,
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: Colors.border.subtle,
        backgroundColor: Colors.bg.card,
    },
    backButton: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        flex: 1,
        textAlign: 'center',
        color: Colors.text.heading,
        fontSize: FontSize.xl,
        fontWeight: '700',
    },
    headerSpacer: {
        width: 44,
    },
    scrollContent: {
        width: '100%',
        maxWidth: 760,
        alignSelf: 'center',
        padding: Spacing.lg,
        gap: Spacing.lg,
    },
    intro: {
        color: Colors.text.secondary,
        fontSize: FontSize.sm,
        lineHeight: 20,
        paddingHorizontal: Spacing.sm,
    },
    card: {
        backgroundColor: Colors.bg.card,
        borderRadius: BorderRadius.xl,
        paddingHorizontal: Spacing.lg,
        overflow: 'hidden',
    },
    groupTitle: {
        color: Colors.text.heading,
        fontSize: FontSize.lg,
        fontWeight: '700',
        paddingTop: Spacing.xl,
        paddingBottom: Spacing.md,
    },
    row: {
        minHeight: 64,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: Spacing.md,
    },
    rowBorder: {
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: Colors.border.subtle,
    },
    rowLabelWrap: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    rowLabel: {
        color: Colors.text.primary,
        fontSize: FontSize.md,
    },
    helpButton: {
        width: 28,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    helpText: {
        width: 20,
        height: 20,
        borderWidth: 1,
        borderColor: Colors.text.tertiary,
        borderRadius: 10,
        color: Colors.text.tertiary,
        textAlign: 'center',
        lineHeight: 18,
        fontSize: FontSize.sm,
        fontWeight: '700',
    },
    valueWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    valueText: {
        color: Colors.text.tertiary,
        fontSize: FontSize.sm,
    },
    resetButton: {
        minHeight: 48,
        borderWidth: 1,
        borderColor: Colors.border.normal,
        borderRadius: BorderRadius.round,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.bg.card,
    },
    resetText: {
        color: Colors.accent.goldLight,
        fontSize: FontSize.md,
        fontWeight: '600',
    },
});
