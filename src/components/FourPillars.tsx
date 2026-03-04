/**
 * 四柱八字展示组件
 * 显示年柱、月柱、日柱、时柱及纳音
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PanResult } from '../core/liuyao-calc';
import { getMonthGeneralByJieqi, getMoonPhase } from '../core/time-signs';
import { Spacing, FontSize, BorderRadius } from '../theme/colors';
import { useTheme } from "../theme/ThemeContext";

interface FourPillarsProps {
    result: PanResult;
}

const PillarItem: React.FC<{
    label: string;
    ganZhi: string;
    naYin: string;
    diZhi: string;
    highlight?: boolean;
    styles: any;
}> = React.memo(({ label, ganZhi, naYin, diZhi, highlight = false, styles }) => (
    <View style={styles.pillarItem}>
        <Text style={styles.pillarLabel}>{label}</Text>
        <View style={[
            styles.pillarContent,
            highlight && styles.pillarHighlight,
        ]}>
            <Text style={styles.pillarGanZhi}>{ganZhi}</Text>
        </View>
        <Text style={styles.pillarNaYin}>{naYin}</Text>
        <Text style={styles.pillarDiZhi}>{diZhi}</Text>
    </View>
));

const FourPillars: React.FC<FourPillarsProps> = React.memo(({ result }) => {
    const { Colors } = useTheme();
    const styles = makeStyles(Colors);
    const { yearGanZhi, monthGanZhi, dayGanZhi, hourGanZhi } = result;
    const { yearNaYin, monthNaYin, dayNaYin, hourNaYin } = result;
    const monthGeneral = result.monthGeneral || getMonthGeneralByJieqi(result.jieqi?.current || '', result.monthGanZhi?.[1]);
    const createdAtDate = new Date(result.createdAt);
    const moonPhase = result.moonPhase || getMoonPhase(
        Number.isNaN(createdAtDate.getTime()) ? new Date() : createdAtDate
    );
    const shenShaItems = result.shenSha ? [
        { label: '驿马', value: result.shenSha.yiMa || '无' },
        { label: '桃花', value: result.shenSha.taoHua || '无' },
        { label: '天乙贵人', value: result.shenSha.tianYiGuiRen?.join(' ') || '无' },
        { label: '禄神', value: result.shenSha.luShen || '无' },
        { label: '羊刃', value: result.shenSha.yangRen || '无' },
        { label: '文昌', value: result.shenSha.wenChang || '无' },
        { label: '将星', value: result.shenSha.jiangXing || '无' },
        { label: '华盖', value: result.shenSha.huaGai || '无' },
        { label: '劫煞', value: result.shenSha.jieSha || '无' },
        { label: '灾煞', value: result.shenSha.zaiSha || '无' },
    ] : [];

    return (
        <View style={styles.container}>
            <View style={styles.pillarsRow}>
                <PillarItem
                    label="年柱"
                    ganZhi={yearGanZhi}
                    naYin={yearNaYin}
                    diZhi={yearGanZhi.charAt(1)}
                    styles={styles}
                />
                <PillarItem
                    label="月柱"
                    ganZhi={monthGanZhi}
                    naYin={monthNaYin}
                    diZhi={monthGanZhi.charAt(1)}
                    styles={styles}
                />
                <PillarItem
                    label="日柱"
                    ganZhi={dayGanZhi}
                    naYin={dayNaYin}
                    diZhi={dayGanZhi.charAt(1)}
                    highlight={true}
                    styles={styles}
                />
                <PillarItem
                    label="时柱"
                    ganZhi={hourGanZhi}
                    naYin={hourNaYin}
                    diZhi={hourGanZhi.charAt(1)}
                    styles={styles}
                />
            </View>

            {/* 旬空 · 月将 · 月相 · 神煞单卡 */}
            {result.shenSha && result.xunKong && (
                <View style={styles.fortuneMetaCard}>
                    <Text style={styles.fortuneMetaTitle}>旬空 · 月将 · 月相 · 神煞</Text>

                    <View style={styles.metaKeyGrid}>
                        <View style={styles.metaKeyBlock}>
                            <Text style={styles.metaKeyLabel}>旬空</Text>
                            <Text style={styles.metaKeyValue}>{result.xunKong.join(' ') || '无'}</Text>
                        </View>

                        <View style={styles.metaKeyBlock}>
                            <Text style={styles.metaKeyLabel}>月将</Text>
                            <Text style={styles.metaKeyValue}>{`${monthGeneral.zhi}将 · ${monthGeneral.name}`}</Text>
                            <Text style={styles.metaHintText}>{`依据节气：${monthGeneral.basedOnTerm}`}</Text>
                        </View>

                        <View style={styles.metaKeyBlock}>
                            <Text style={styles.metaKeyLabel}>月相</Text>
                            <Text style={styles.metaKeyValue}>{moonPhase.name}</Text>
                            <Text style={styles.metaHintText}>{`月龄 ${moonPhase.ageDays.toFixed(2)} 天 · 亮度 ${moonPhase.illuminationPct}%`}</Text>
                        </View>
                    </View>

                    <View style={styles.metaDivider} />

                    <View style={styles.shenShaGrid}>
                        {shenShaItems.map(item => (
                            <View key={item.label} style={styles.shenShaItem}>
                                <Text style={styles.shenShaItemLabel}>{item.label}</Text>
                                <Text style={styles.shenShaItemValue}>{item.value || '无'}</Text>
                            </View>
                        ))}
                    </View>
                </View>
            )}
        </View>
    );
});
export default React.memo(FourPillars, (prevProps, nextProps) => {
    return prevProps.result.id === nextProps.result.id;
});

const makeStyles = (Colors: any) => StyleSheet.create({
    container: {
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.md,
    },
    pillarsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        backgroundColor: Colors.bg.card,
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
    },
    pillarItem: {
        alignItems: 'center',
        flex: 1,
    },
    pillarLabel: {
        fontSize: FontSize.xs,
        color: Colors.text.tertiary,
        marginBottom: Spacing.sm,
    },
    pillarContent: {
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.md,
        borderRadius: BorderRadius.md,
    },
    pillarHighlight: {
        backgroundColor: Colors.bg.elevated,
    },
    pillarGanZhi: {
        fontSize: FontSize.xxxl,
        color: Colors.text.heading,
        fontWeight: '300',
    },
    pillarNaYin: {
        fontSize: FontSize.xs,
        color: Colors.text.tertiary,
        marginTop: Spacing.xs,
    },
    pillarDiZhi: {
        fontSize: FontSize.xs,
        color: Colors.text.secondary,
        marginTop: 2,
    },
    fortuneMetaCard: {
        marginTop: Spacing.md,
        backgroundColor: Colors.bg.card,
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
        padding: Spacing.lg,
    },
    fortuneMetaTitle: {
        fontSize: FontSize.md,
        color: Colors.text.heading,
        fontWeight: '600',
        marginBottom: Spacing.md,
    },
    metaKeyGrid: {
        gap: Spacing.sm,
    },
    metaKeyBlock: {
        backgroundColor: Colors.bg.elevated,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
    },
    metaKeyLabel: {
        fontSize: FontSize.xs,
        color: Colors.text.tertiary,
        marginBottom: 2,
    },
    metaKeyValue: {
        fontSize: FontSize.md,
        color: Colors.accent.gold,
        fontWeight: '700',
    },
    metaHintText: {
        marginTop: 2,
        fontSize: FontSize.xs,
        color: Colors.text.secondary,
    },
    metaDivider: {
        height: 1,
        backgroundColor: Colors.border.subtle,
        marginVertical: Spacing.md,
    },
    shenShaGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    shenShaItem: {
        width: '48%',
        marginBottom: Spacing.sm,
        paddingVertical: Spacing.xs,
        paddingHorizontal: Spacing.sm,
        borderRadius: BorderRadius.sm,
        backgroundColor: Colors.bg.elevated,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
    },
    shenShaItemLabel: {
        fontSize: FontSize.xs,
        color: Colors.text.tertiary,
        marginBottom: 2,
    },
    shenShaItemValue: {
        fontSize: FontSize.sm,
        color: Colors.text.primary,
        fontWeight: '600',
    },
});
