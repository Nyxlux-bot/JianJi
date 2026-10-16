/**
 * 书阁速查：八卦类象、纳音、神煞释义、梅花体用诀，都取自程序里已有的资料表。
 */
import React, { useMemo } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import StatusBarDecor from '../../../src/components/StatusBarDecor';
import HexagramLines from '../../../src/components/result/HexagramLines';
import { ResultCard, makeResultChromeStyles } from '../../../src/components/result/ResultChrome';
import WuXingIcon from '../../../src/components/WuXingIcon';
import { BackIcon } from '../../../src/components/Icons';
import { BA_GUA, NAYIN } from '../../../src/core/liuyao-data';
import { BAZI_SHENSHA_CATALOG } from '../../../src/core/bazi-shensha-catalog';
import { TRIGRAM_IMAGES, TRIGRAM_IMAGE_SOURCE } from '../../../src/features/meihua/images';
import { QUOTE_BIAN, QUOTE_HU, QUOTE_SEASON, RELATION_RULES, SOURCE_SEASON, SOURCE_TIYONG, type MeihuaRelation } from '../../../src/features/meihua/rules';
import { resolveWuXingElement } from '../../../src/features/bazi/wuxing';
import { buildResultPalette, type ResultPalette } from '../../../src/theme/result-palette';
import { useTheme } from '../../../src/theme/ThemeContext';

const SERIF = Platform.select({ ios: 'Songti SC', android: 'serif', default: 'serif' });
const TITLES: Record<string, string> = { trigram: '八卦类象', nayin: '纳音', shensha: '神煞', tiyong: '体用诀' };
const RELATION_LABEL: Record<MeihuaRelation, string> = { 比和: '体用比和', 生体: '用生体', 体克: '体克用', 克体: '用克体', 体生: '体生用' };

export default function LearnRefPage() {
    const { Colors } = useTheme();
    const insets = useSafeAreaInsets();
    const palette = useMemo(() => buildResultPalette(Colors), [Colors]);
    const styles = useMemo(() => makeStyles(palette), [palette]);
    const chrome = useMemo(() => makeResultChromeStyles(palette), [palette]);
    const { key = '' } = useLocalSearchParams<{ key: string }>();

    const body = (() => {
        switch (key) {
            case 'trigram':
                return (
                    <ResultCard title="八卦类象" meta={`取自${TRIGRAM_IMAGE_SOURCE}`} styles={chrome}>
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((index, i) => {
                            const trigram = BA_GUA[index];
                            const image = TRIGRAM_IMAGES[trigram.name];
                            const color = palette.element[trigram.wuxing];
                            return (
                                <View key={index} style={[styles.row, i > 0 && styles.rule]}>
                                    <HexagramLines lines={trigram.yao} width={22} barHeight={3} gap={3} color={color} movingColor={color} />
                                    <View style={styles.trigramHead}>
                                        <WuXingIcon element={trigram.wuxing} size={14} />
                                        <Text style={[styles.trigramName, { color }]}>{trigram.name}</Text>
                                    </View>
                                    <View style={styles.flex}>
                                        <Text style={styles.rowTitle}>{image.virtue} · {trigram.nature}</Text>
                                        <Text style={styles.rowText}>{image.items.join(' · ')}</Text>
                                    </View>
                                </View>
                            );
                        })}
                    </ResultCard>
                );
            case 'nayin': {
                const pairs: Array<[string, string, string]> = [];
                const entries = Object.entries(NAYIN);
                for (let i = 0; i < entries.length; i += 2) pairs.push([entries[i][0], entries[i + 1][0], entries[i][1]]);
                return (
                    <ResultCard title="六十甲子纳音" meta="两柱一组，共 30 组" styles={chrome}>
                        <View style={styles.grid}>
                            {pairs.map(([a, b, name]) => {
                                const element = resolveWuXingElement(name.slice(-1));
                                return (
                                    <View key={a} style={styles.nayinCell}>
                                        <Text style={styles.nayinPillars}>{a} {b}</Text>
                                        <View style={styles.nayinName}>
                                            {element ? <WuXingIcon element={element} size={13} /> : null}
                                            <Text style={[styles.nayinText, element && { color: palette.element[element] }]}>{name}</Text>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    </ResultCard>
                );
            }
            case 'shensha': {
                const groups = BAZI_SHENSHA_CATALOG.reduce<Array<{ category: string; items: typeof BAZI_SHENSHA_CATALOG }>>((acc, item) => {
                    const group = acc.find((entry) => entry.category === item.category);
                    if (group) group.items.push(item);
                    else acc.push({ category: item.category, items: [item] });
                    return acc;
                }, []);
                return (
                    <>
                        <Text style={styles.note}>释义为常见说法的简述，各家取法不尽相同，仅作查阅。</Text>
                        {groups.map((group) => (
                            <ResultCard key={group.category} title={group.category} meta={`${group.items.length} 项`} styles={chrome}>
                                {group.items.map((item, i) => (
                                    <View key={item.key} style={[styles.row, i > 0 && styles.rule]}>
                                        <View style={styles.shenshaHead}>
                                            <Text style={styles.rowTitle}>{item.fullName}</Text>
                                            {item.aliases.length ? <Text style={styles.alias}>又名 {item.aliases.join('、')}</Text> : null}
                                        </View>
                                        <Text style={[styles.rowText, styles.flex]}>{item.description}</Text>
                                    </View>
                                ))}
                            </ResultCard>
                        ))}
                    </>
                );
            }
            case 'tiyong':
                return (
                    <>
                        <ResultCard title="体用生克" meta={SOURCE_TIYONG} styles={chrome}>
                            {(Object.keys(RELATION_RULES) as MeihuaRelation[]).map((relation, i) => {
                                const rule = RELATION_RULES[relation];
                                const good = rule.tone === 'good';
                                return (
                                    <View key={relation} style={[styles.row, i > 0 && styles.rule]}>
                                        <Text style={styles.relation}>{RELATION_LABEL[relation]}</Text>
                                        <Text style={[styles.quote, styles.flex]}>{rule.quote}</Text>
                                        <Text style={[styles.tone, { color: good ? palette.element.木 : palette.vermilion }]}>{good ? '吉' : '凶'}</Text>
                                    </View>
                                );
                            })}
                        </ResultCard>
                        <ResultCard title="互变" meta={SOURCE_TIYONG} styles={chrome}>
                            <Text style={[styles.quote, styles.block]}>{QUOTE_HU}</Text>
                            <Text style={[styles.quote, styles.block]}>{QUOTE_BIAN}</Text>
                        </ResultCard>
                        <ResultCard title="衰旺" meta={SOURCE_SEASON} styles={chrome}>
                            <Text style={[styles.quote, styles.block]}>{QUOTE_SEASON}</Text>
                        </ResultCard>
                    </>
                );
            default:
                return <Text style={styles.note}>没有这一项速查</Text>;
        }
    })();

    return (
        <View style={styles.container}>
            <StatusBarDecor />
            <View style={chrome.topBar}>
                <Pressable onPress={() => router.back()} style={({ pressed }) => [chrome.iconBtn, chrome.backBtn, pressed && chrome.pressed]} accessibilityRole="button" accessibilityLabel="返回">
                    <BackIcon size={22} color={palette.ink} />
                </Pressable>
                <Text style={styles.title}>{TITLES[key] || '速查'}</Text>
            </View>
            <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
                {body}
            </ScrollView>
        </View>
    );
}

const makeStyles = (palette: ResultPalette) => StyleSheet.create({
    container: { flex: 1, backgroundColor: palette.page },
    flex: { flex: 1, minWidth: 0 },
    title: { fontFamily: SERIF, fontSize: 17, fontWeight: '700', letterSpacing: 2, color: palette.heading },
    body: { padding: 12, gap: 10 },
    note: { paddingHorizontal: 4, fontSize: 12, lineHeight: 18, color: palette.muted },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
    rule: { borderTopWidth: 1, borderTopColor: palette.hairline },
    trigramHead: { width: 36, flexDirection: 'row', alignItems: 'center', gap: 3 },
    trigramName: { fontFamily: SERIF, fontSize: 16, fontWeight: '700' },
    rowTitle: { fontSize: 14, lineHeight: 20, fontWeight: '700', color: palette.heading },
    rowText: { fontSize: 13, lineHeight: 19, color: palette.body },
    grid: { marginTop: 6, flexDirection: 'row', flexWrap: 'wrap' },
    nayinCell: { width: '50%', paddingVertical: 8, paddingRight: 8, gap: 2 },
    nayinPillars: { fontFamily: SERIF, fontSize: 15, lineHeight: 21, fontWeight: '700', color: palette.heading },
    nayinName: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    nayinText: { fontSize: 13, lineHeight: 18, color: palette.body },
    shenshaHead: { width: 96, gap: 1 },
    alias: { fontSize: 11, color: palette.muted },
    relation: { width: 64, fontSize: 13.5, fontWeight: '700', color: palette.heading },
    quote: { fontFamily: SERIF, fontSize: 14.5, lineHeight: 23, color: palette.ink },
    block: { marginTop: 8 },
    tone: { fontSize: 13, fontWeight: '700' },
});
