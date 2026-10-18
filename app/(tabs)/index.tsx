import React, { useCallback, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import StatusBarDecor from '../../src/components/StatusBarDecor';
import EntryDeck from '../../src/features/home/EntryDeck';
import { ChevronRightIcon } from '../../src/components/Icons';
import { useTheme } from '../../src/theme/ThemeContext';
import { buildResultPalette, type ResultPalette } from '../../src/theme/result-palette';
import { getCurrentJieqi, solarToLunar } from '../../src/core/lunar';
import { getXunKong } from '../../src/core/xun-kong';
import { getGanZhiElement } from '../../src/features/bazi/wuxing';
import { castMeihua, getLinePositionName } from '../../src/features/meihua/engine';
import { getAllRecords } from '../../src/db/database';
import { DIVINATION_ENGINE_LABEL, type RecordSummary } from '../../src/db/record-types';
import { getRecordRoute } from '../../src/utils/record-route';

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

                <EntryDeck
                    liuyaoMeta={`今日${today.lunar.dayGanZhi}日 · 旬空${today.xunKong.join('')}`}
                    meihuaDescription={<>此刻起卦得 <Text style={{ fontWeight: '700' }}>{today.meihua.ben.fullName}</Text>{' · '}<Text style={{ color: palette.isLight ? '#9E3F35' : '#F08A7C' }}>{getLinePositionName(today.meihua.movingLine)}动</Text></>}
                    meihuaMeta={`${today.lunar.yearGanZhi}年 ${today.lunar.lunarMonthCN}${today.lunar.lunarDayCN} ${today.lunar.hourGanZhi[1]}时`}
                />

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
        container: { flex: 1, backgroundColor: 'transparent' },
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
        sectionLabelInline: { fontSize: 12, lineHeight: 16, color: palette.muted },
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
