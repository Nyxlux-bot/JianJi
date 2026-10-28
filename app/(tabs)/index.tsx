import React, { useCallback, useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import StatusBarDecor from '../../src/components/StatusBarDecor';
import { YunZhuanForeground, bannerLevel } from '../../src/components/YunZhuanBanners';
import EntryDeck from '../../src/features/home/EntryDeck';
import { useTheme } from '../../src/theme/ThemeContext';
import { buildResultPalette, type ResultPalette } from '../../src/theme/result-palette';
import { getCurrentJieqi, solarToLunar } from '../../src/core/lunar';
import { getXunKong } from '../../src/core/xun-kong';
import { getGanZhiElement } from '../../src/features/bazi/wuxing';
import { castMeihua, getLinePositionName } from '../../src/features/meihua/engine';

const SERIF = Platform.select({ ios: 'Songti SC', android: 'serif', default: 'serif' });
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

export default function HomePage() {
    const { Colors } = useTheme();
    const insets = useSafeAreaInsets();
    const palette = useMemo(() => buildResultPalette(Colors), [Colors]);
    const styles = useMemo(() => makeStyles(palette, Colors), [palette, Colors]);
    const [now, setNow] = useState(() => new Date());

    // 经幡只在首页全亮，其他页退到六成
    useFocusEffect(useCallback(() => {
        setNow(new Date());
        bannerLevel.value = withTiming(1, { duration: 300 });
        return () => {
            bannerLevel.value = withTiming(0.6, { duration: 300 });
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
                        <Text style={styles.brand} accessibilityRole="header">见机</Text>
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
            </ScrollView>
            <YunZhuanForeground />
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
    });
}
