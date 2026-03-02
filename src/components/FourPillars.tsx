/**
 * 四柱八字展示组件
 * 显示年柱、月柱、日柱、时柱及纳音
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PanResult } from '../core/liuyao-calc';
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

const ShenShaBadge: React.FC<{ label: string; value: string; isAccent?: boolean; styles: any }> = React.memo(({ label, value, isAccent, styles }) => (
    <View style={[styles.shenShaBadge, isAccent && styles.shenShaAccentBadge]}>
        <Text style={isAccent ? styles.shenShaBadgeTextAccent : styles.shenShaBadgeText}>{label}</Text>
        <Text style={isAccent ? styles.shenShaValueAccent : styles.shenShaValue}>{value || '-'}</Text>
    </View>
));

const FourPillars: React.FC<FourPillarsProps> = React.memo(({ result }) => {
    const { Colors } = useTheme();
    const styles = makeStyles(Colors);
    const { yearGanZhi, monthGanZhi, dayGanZhi, hourGanZhi } = result;
    const { yearNaYin, monthNaYin, dayNaYin, hourNaYin } = result;

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

            {/* 旬空与神煞展示区 */}
            {result.shenSha && result.xunKong && (
                <View style={styles.shenShaContainer}>
                    <ShenShaBadge label="旬空" value={result.xunKong.join(' ')} styles={styles} />
                    <ShenShaBadge label="驿马" value={result.shenSha.yiMa} isAccent={true} styles={styles} />
                    <ShenShaBadge label="桃花" value={result.shenSha.taoHua} isAccent={true} styles={styles} />
                    <ShenShaBadge label="贵人" value={result.shenSha.tianYiGuiRen.join(' ')} styles={styles} />
                    <ShenShaBadge label="禄神" value={result.shenSha.luShen} styles={styles} />
                    <ShenShaBadge label="羊刃" value={result.shenSha.yangRen} styles={styles} />
                    <ShenShaBadge label="文昌" value={result.shenSha.wenChang} styles={styles} />
                    <ShenShaBadge label="将星" value={result.shenSha.jiangXing} styles={styles} />
                    <ShenShaBadge label="华盖" value={result.shenSha.huaGai} styles={styles} />
                    <ShenShaBadge label="劫煞" value={result.shenSha.jieSha} styles={styles} />
                    <ShenShaBadge label="灾煞" value={result.shenSha.zaiSha} styles={styles} />
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
    shenShaContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
        marginTop: Spacing.md,
    },
    shenShaBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.bg.elevated,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 4,
        borderRadius: BorderRadius.sm,
        borderWidth: 0.5,
        borderColor: Colors.border.subtle,
    },
    shenShaBadgeText: {
        fontSize: FontSize.xs,
        color: Colors.text.tertiary,
        marginRight: 4,
    },
    shenShaValue: {
        fontSize: FontSize.xs,
        color: Colors.text.secondary,
        fontWeight: '500',
    },
    shenShaAccentBadge: {
        backgroundColor: 'rgba(200, 148, 58, 0.1)',
        borderColor: Colors.accent.goldDark,
    },
    shenShaBadgeTextAccent: {
        fontSize: FontSize.xs,
        color: Colors.accent.gold,
        marginRight: 4,
    },
    shenShaValueAccent: {
        fontSize: FontSize.xs,
        color: Colors.accent.gold,
        fontWeight: 'bold',
    },
});
