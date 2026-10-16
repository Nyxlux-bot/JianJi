import React, { useCallback, useMemo, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import StatusBarDecor from '../../src/components/StatusBarDecor';
import YongleCoin from '../../src/components/YongleCoin';
import { BaGuaIcon, ChevronRightIcon, ClockIcon, CoinIcon, HandIcon, NumberIcon, StarIcon } from '../../src/components/Icons';
import { useTheme } from '../../src/theme/ThemeContext';
import { buildResultPalette, type ResultPalette } from '../../src/theme/result-palette';
import { getCurrentJieqi, solarToLunar } from '../../src/core/lunar';
import { getXunKong } from '../../src/core/xun-kong';
import { getGanZhiElement } from '../../src/features/bazi/wuxing';
import { castMeihua, getLinePositionName } from '../../src/features/meihua/engine';
import { getAllRecords } from '../../src/db/database';
import { DIVINATION_ENGINE_LABEL, type RecordSummary } from '../../src/db/record-types';
import { getRecordRoute } from '../../src/utils/record-route';

const PLUM_BRANCH = require('../../assets/meihua/ui/plum-branch.png');
const SERIF = Platform.select({ ios: 'Songti SC', android: 'serif', default: 'serif' });
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
const LIUYAO_METHOD_LABEL: Record<string, string> = { coin: '摇卦', manual: '手动', time: '时间', number: '数字' };
const RECENT_BADGE: Record<RecordSummary['engineType'], string> = { liuyao: '卦', meihua: '梅', bazi: '八', baziCompatibility: '合', ziwei: '紫' };

function formatRecentTime(iso: string, now: Date): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (value: number) => String(value).padStart(2, '0');
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    if (date.getTime() >= dayStart) return `今天 ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    if (date.getTime() >= dayStart - 86400000) return '昨天';
    return `${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function describeRecent(record: RecordSummary): { title: string; meta: string } {
    const label = DIVINATION_ENGINE_LABEL[record.engineType];
    if (record.engineType === 'liuyao') {
        return {
            title: record.subtitle ? `${record.title} 之 ${record.subtitle}` : record.title,
            meta: [label, LIUYAO_METHOD_LABEL[record.method || '']].filter(Boolean).join(' · '),
        };
    }
    return { title: record.title, meta: [label, record.subtitle].filter(Boolean).join(' · ') };
}

export default function HomePage() {
    const { Colors } = useTheme();
    const insets = useSafeAreaInsets();
    const palette = useMemo(() => buildResultPalette(Colors), [Colors]);
    const styles = useMemo(() => makeStyles(palette, Colors), [palette, Colors]);
    const [now, setNow] = useState(() => new Date());
    const [recents, setRecents] = useState<RecordSummary[]>([]);

    useFocusEffect(useCallback(() => {
        let cancelled = false;
        setNow(new Date());
        getAllRecords().then((records) => {
            if (!cancelled) setRecents(records.slice(0, 2));
        }).catch(() => undefined);
        return () => {
            cancelled = true;
        };
    }, []));

    const today = useMemo(() => {
        const lunar = solarToLunar(now);
        return {
            lunar,
            jieqi: getCurrentJieqi(now).current,
            xunKong: getXunKong(lunar.dayGanZhi),
            meihua: castMeihua({ method: 'meihua_time' }, now),
        };
    }, [now]);
    const colorOf = (char: string) => {
        const element = getGanZhiElement(char);
        return element ? palette.element[element] : palette.ink;
    };
    const ganZhi = (text: string) => [...text].map((char, index) => (
        <Text key={index} style={{ color: colorOf(char) }}>{char}</Text>
    ));
    const pillars = [today.lunar.yearGanZhi, today.lunar.monthGanZhi, today.lunar.dayGanZhi, today.lunar.hourGanZhi];
    const monthZhi = today.lunar.monthGanZhi[1];
    const dayZhi = today.lunar.dayGanZhi[1];
    const todayItems = [
        { label: '节气', value: <Text style={[styles.todayValue, { color: palette.heading }]}>{today.jieqi}</Text> },
        { label: '月建', value: <Text style={styles.todayValue}>{ganZhi(monthZhi)}<Text style={{ color: colorOf(monthZhi) }}>{getGanZhiElement(monthZhi)}</Text></Text> },
        { label: '日辰', value: <Text style={styles.todayValue}>{ganZhi(dayZhi)}<Text style={{ color: colorOf(dayZhi) }}>{getGanZhiElement(dayZhi)}</Text></Text> },
        { label: '旬空', value: <Text style={styles.todayValue}>{ganZhi(today.xunKong.join(''))}</Text> },
    ];

    return (
        <View style={styles.container}>
            <StatusBarDecor />
            <ScrollView
                contentContainerStyle={[styles.content, { paddingBottom: 64 + Math.max(insets.bottom, 16) + 16 }]}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.header}>
                    <View>
                        <Text style={styles.brand}>见机</Text>
                        <Text style={styles.brandSub}>六爻 · 梅花 · 八字 · 紫微</Text>
                    </View>
                    <View style={styles.headerRight}>
                        <Text style={styles.pillars}>
                            {pillars.map((pillar, index) => <Text key={index}>{index > 0 ? ' ' : ''}{ganZhi(pillar)}</Text>)}
                        </Text>
                        <Text style={styles.dateText}>
                            {`${now.getMonth() + 1}月${now.getDate()}日 周${WEEKDAYS[now.getDay()]} · 农历${today.lunar.lunarMonthCN}${today.lunar.lunarDayCN}`}
                        </Text>
                    </View>
                </View>

                <View style={styles.todayStrip}>
                    {todayItems.map((item, index) => (
                        <View key={item.label} style={[styles.todayCell, index > 0 && styles.todayDivider]}>
                            <Text style={styles.todayLabel}>{item.label}</Text>
                            {item.value}
                        </View>
                    ))}
                </View>

                <Text style={styles.sectionLabel}>起卦</Text>
                <View style={styles.castCard}>
                    <View style={styles.castBody}>
                        <View style={styles.castTitleRow}>
                            <Text style={styles.castTitle}>六爻</Text>
                            <Text style={styles.castSub}>纳甲 · 六亲 · 世应</Text>
                        </View>
                        <Text style={styles.castDesc}>三枚铜钱，六次摇掷成卦</Text>
                        <View style={[styles.capsule, styles.capsuleGold]}>
                            <Pressable onPress={() => router.push('/divination/coin')} style={({ pressed }) => [styles.capsuleBtn, styles.capsulePrimary, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="摇卦">
                                <CoinIcon size={16} color={Colors.text.inverse} />
                                <Text style={styles.capsulePrimaryText}>摇卦</Text>
                            </Pressable>
                            <Pressable onPress={() => router.push('/divination/manual')} style={({ pressed }) => [styles.capsuleBtn, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="手动录入">
                                <HandIcon size={16} color={Colors.accent.goldLight} />
                                <Text style={styles.capsuleText}>手动</Text>
                            </Pressable>
                        </View>
                    </View>
                    <View style={styles.coins} pointerEvents="none">
                        <YongleCoin face="front" size={60} style={[styles.coin, { left: 0, top: 30, transform: [{ rotate: '-14deg' }] }]} />
                        <YongleCoin face="back" size={60} style={[styles.coin, { left: 38, top: 0, transform: [{ rotate: '8deg' }] }]} />
                        <YongleCoin face="front" size={60} style={[styles.coin, { left: 66, top: 40, transform: [{ rotate: '22deg' }] }]} />
                    </View>
                </View>

                <View style={styles.castCard}>
                    <Image source={PLUM_BRANCH} style={styles.plum} resizeMode="contain" accessibilityIgnoresInvertColors />
                    <View style={styles.castBody}>
                        <View style={styles.castTitleRow}>
                            <Text style={styles.castTitle}>梅花易数</Text>
                            <Text style={styles.castSub}>先天数 · 体用</Text>
                        </View>
                        <Text style={styles.castDesc}>
                            此刻起卦得 <Text style={styles.castDescStrong}>{today.meihua.ben.fullName}</Text>
                            {' · '}<Text style={{ color: palette.vermilion }}>{getLinePositionName(today.meihua.movingLine)}动</Text>
                        </Text>
                        <View style={[styles.capsule, styles.capsulePlain]}>
                            <Pressable onPress={() => router.push('/meihua/input?mode=time')} style={({ pressed }) => [styles.capsuleBtn, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="时间起卦">
                                <ClockIcon size={16} color={Colors.accent.goldLight} />
                                <Text style={styles.capsuleText}>时间</Text>
                            </Pressable>
                            <View style={styles.capsuleDivider} />
                            <Pressable onPress={() => router.push('/meihua/input?mode=number')} style={({ pressed }) => [styles.capsuleBtn, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="数字起卦">
                                <NumberIcon size={16} color={Colors.accent.goldLight} />
                                <Text style={styles.capsuleText}>数字</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>

                <Text style={styles.sectionLabel}>命盘</Text>
                <View style={styles.tileRow}>
                    <Pressable onPress={() => router.push('/bazi/input')} style={({ pressed }) => [styles.tile, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="八字命理">
                        <BaGuaIcon size={28} color={palette.gold} />
                        <Text style={styles.tileTitle}>八字命理</Text>
                        <Text style={styles.tileDesc}>四柱十神 · 大运流年</Text>
                    </Pressable>
                    <Pressable onPress={() => router.push('/bazi/match')} style={({ pressed }) => [styles.matchBtn, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="八字合盘">
                        <Text style={styles.matchText}>合盘</Text>
                    </Pressable>
                    <Pressable onPress={() => router.push('/ziwei/input')} style={({ pressed }) => [styles.tile, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="紫微斗数">
                        <StarIcon size={28} color={palette.gold} />
                        <Text style={styles.tileTitle}>紫微斗数</Text>
                        <Text style={styles.tileDesc}>十二宫 · 四化运限</Text>
                    </Pressable>
                </View>

                <View style={styles.recentHead}>
                    <Text style={styles.sectionLabelInline}>最近</Text>
                    <Pressable onPress={() => router.push('/history')} accessibilityRole="link" hitSlop={8}>
                        <Text style={styles.recentAll}>全部记录</Text>
                    </Pressable>
                </View>
                <View style={styles.recentList}>
                    {recents.length === 0 ? (
                        <Text style={styles.recentEmpty}>还没有记录，起一卦试试</Text>
                    ) : recents.map((record, index) => {
                        const { title, meta } = describeRecent(record);
                        return (
                            <Pressable
                                key={record.id}
                                onPress={() => router.push(getRecordRoute(record.engineType, record.id))}
                                style={({ pressed }) => [styles.recentRow, index > 0 && styles.recentDivider, pressed && styles.pressed]}
                                accessibilityRole="button"
                                accessibilityLabel={title}
                            >
                                <Text style={styles.recentBadge}>{RECENT_BADGE[record.engineType]}</Text>
                                <View style={styles.recentMain}>
                                    <Text style={styles.recentTitle} numberOfLines={1}>{title}</Text>
                                    <Text style={styles.recentMeta} numberOfLines={1}>{[meta, formatRecentTime(record.createdAt, now)].filter(Boolean).join(' · ')}</Text>
                                </View>
                                <ChevronRightIcon size={14} color={palette.muted} />
                            </Pressable>
                        );
                    })}
                </View>
            </ScrollView>
        </View>
    );
}

function makeStyles(palette: ResultPalette, Colors: any) {
    const surface = Colors.bg.secondary as string;
    return StyleSheet.create({
        container: { flex: 1, backgroundColor: palette.page },
        content: { paddingTop: 20, paddingHorizontal: 16, gap: 12 },
        header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
        brand: { fontFamily: SERIF, fontSize: 30, lineHeight: 38, fontWeight: '500', letterSpacing: 6, color: palette.heading },
        brandSub: { fontSize: 11, lineHeight: 16, letterSpacing: 2, color: palette.gold },
        headerRight: { alignItems: 'flex-end' },
        pillars: { fontSize: 15, lineHeight: 22, fontWeight: '600', letterSpacing: 1 },
        dateText: { fontSize: 11, lineHeight: 16, color: palette.muted },
        todayStrip: {
            flexDirection: 'row',
            paddingVertical: 8,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: palette.cardBorder,
            backgroundColor: surface,
        },
        todayCell: { flex: 1, alignItems: 'center' },
        todayDivider: { borderLeftWidth: 1, borderLeftColor: palette.cardBorder },
        todayLabel: { fontSize: 11, lineHeight: 15, color: palette.muted },
        todayValue: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
        sectionLabel: { fontSize: 12, lineHeight: 16, color: palette.muted, marginBottom: -4 },
        sectionLabelInline: { fontSize: 12, lineHeight: 16, color: palette.muted },
        castCard: {
            position: 'relative',
            overflow: 'hidden',
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 16,
            paddingLeft: 16,
            paddingRight: 12,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: palette.cardBorder,
            backgroundColor: palette.card,
        },
        castBody: { flex: 1, minWidth: 0 },
        castTitleRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
        castTitle: { fontFamily: SERIF, fontSize: 21, lineHeight: 28, fontWeight: '700', color: palette.heading },
        castSub: { fontSize: 12, lineHeight: 16, color: palette.muted },
        castDesc: { marginTop: 4, fontSize: 12.5, lineHeight: 18, color: palette.muted },
        castDescStrong: { fontWeight: '700', color: palette.heading },
        capsule: { marginTop: 14, alignSelf: 'flex-start', flexDirection: 'row', height: 40, borderRadius: 20, overflow: 'hidden', borderWidth: 1 },
        capsuleGold: { borderColor: palette.gold },
        capsulePlain: { borderColor: palette.segBorder, backgroundColor: palette.segTrack },
        capsuleBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 15 },
        capsulePrimary: { backgroundColor: palette.gold },
        capsulePrimaryText: { fontSize: 14, fontWeight: '700', color: Colors.text.inverse },
        capsuleText: { fontSize: 14, fontWeight: '600', color: Colors.accent.goldLight },
        capsuleDivider: { width: 1, marginVertical: 10, backgroundColor: palette.segBorder },
        coins: { width: 128, height: 104 },
        coin: { position: 'absolute' },
        plum: { position: 'absolute', right: -22, bottom: -34, width: 172, height: 172 },
        tileRow: { flexDirection: 'row', gap: 8 },
        tile: {
            flex: 1,
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: palette.cardBorder,
            backgroundColor: palette.card,
        },
        tileTitle: { marginTop: 8, fontSize: 15, lineHeight: 21, fontWeight: '700', color: palette.heading },
        tileDesc: { fontSize: 12, lineHeight: 17, color: palette.muted },
        matchBtn: {
            position: 'absolute',
            top: 10,
            left: '50%',
            marginLeft: -60,
            height: 26,
            paddingHorizontal: 10,
            borderRadius: 13,
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: palette.segBorder,
            backgroundColor: palette.segTrack,
            zIndex: 1,
        },
        matchText: { fontSize: 12, color: Colors.accent.goldLight },
        recentHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: -4 },
        recentAll: { fontSize: 12, lineHeight: 16, color: palette.gold },
        recentList: { borderRadius: 16, borderWidth: 1, borderColor: palette.cardBorder, backgroundColor: surface },
        recentEmpty: { paddingVertical: 18, textAlign: 'center', fontSize: 13, color: palette.muted },
        recentRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 14 },
        recentDivider: { borderTopWidth: 1, borderTopColor: palette.cardBorder },
        recentBadge: {
            width: 32,
            height: 32,
            borderRadius: 10,
            overflow: 'hidden',
            textAlign: 'center',
            lineHeight: 32,
            fontFamily: SERIF,
            fontSize: 15,
            fontWeight: '700',
            color: palette.gold,
            backgroundColor: palette.chipBg,
        },
        recentMain: { flex: 1, minWidth: 0 },
        recentTitle: { fontSize: 14, lineHeight: 20, color: palette.heading },
        recentMeta: { fontSize: 11.5, lineHeight: 16, color: palette.muted },
        pressed: { opacity: 0.75 },
    });
}
