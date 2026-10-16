/**
 * 学习「书阁」：搜卦名篇名、继续阅读、周易按上卦直达、命理典籍书脊、速查。
 */
import React, { useCallback, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import StatusBarDecor from '../../src/components/StatusBarDecor';
import HexagramLines from '../../src/components/result/HexagramLines';
import { ChevronRightIcon } from '../../src/components/Icons';
import { BA_GUA } from '../../src/core/liuyao-data';
import { HEXAGRAMS } from '../../src/core/iching-texts';
import { BAZI_CLASSIC_BOOK_INDEX, getChapterLabel } from '../../src/data/bazi-classics';
import { loadReadingState, type ReadingState } from '../../src/services/reading-progress';
import { buildResultPalette, type ResultPalette } from '../../src/theme/result-palette';
import { useTheme } from '../../src/theme/ThemeContext';

const SERIF = Platform.select({ ios: 'Songti SC', android: 'serif', default: 'serif' });
const TRIGRAM_INDEXES = [1, 2, 3, 4, 5, 6, 7, 8];
/** 书脊底色，两套主题共用，像布面封皮 */
const BOOK_COLORS: Record<string, string> = {
    zipingzhenquan: '#23324A',
    ditiansuichanwei: '#23392F',
    yuanhaiziping: '#47262A',
    minglitanyuan: '#4A3A22',
};
const REFS = [
    { key: 'trigram', title: '八卦类象', meta: '说卦传', tone: 'gold' },
    { key: 'nayin', title: '纳音', meta: '六十甲子', tone: '水' },
    { key: 'shensha', title: '神煞', meta: '55 项释义', tone: 'vermilion' },
    { key: 'tiyong', title: '体用诀', meta: '梅花易数', tone: '木' },
] as const;

const wan = (chars: number) => `${(chars / 10000).toFixed(1)} 万字`;

export default function LearnPage() {
    const { Colors } = useTheme();
    const insets = useSafeAreaInsets();
    const palette = useMemo(() => buildResultPalette(Colors), [Colors]);
    const styles = useMemo(() => makeStyles(palette), [palette]);
    const [query, setQuery] = useState('');
    const [reading, setReading] = useState<ReadingState | null>(null);

    useFocusEffect(useCallback(() => {
        loadReadingState().then(setReading);
    }, []));

    const chapterTotal = BAZI_CLASSIC_BOOK_INDEX.reduce((sum, book) => sum + book.chapterCount, 0);
    const keyword = query.trim();
    const results = useMemo(() => {
        if (!keyword) return [];
        const hexagrams = HEXAGRAMS
            .filter((item) => item.name.includes(keyword) || item.fullName.includes(keyword))
            .map((item) => ({ key: `h${item.id}`, title: item.fullName, meta: `第 ${item.id} 卦`, onPress: () => router.push(`/learn/hexagram/${item.id}`) }));
        const chapters = BAZI_CLASSIC_BOOK_INDEX.flatMap((book) => book.chapters
            .map((chapter) => ({ chapter, label: getChapterLabel(chapter.title) }))
            .filter(({ label }) => label.title.includes(keyword))
            .map(({ chapter, label }) => ({
                key: `${book.id}-${chapter.id}`,
                title: label.title,
                meta: `${book.title}${label.volume ? ` · ${label.volume}` : ''}`,
                onPress: () => router.push({ pathname: '/learn/reader', params: { book: book.id, chapter: chapter.id } }),
            })));
        return [...hexagrams, ...chapters].slice(0, 40);
    }, [keyword]);

    const lastBook = reading?.lastBookId ? BAZI_CLASSIC_BOOK_INDEX.find((book) => book.id === reading.lastBookId) : undefined;
    const lastProgress = lastBook ? reading?.books[lastBook.id] : undefined;
    const lastIndex = lastBook && lastProgress ? lastBook.chapters.findIndex((chapter) => chapter.id === lastProgress.chapterId) : -1;
    const toneColor = (tone: string) => tone === 'gold' ? palette.gold : tone === 'vermilion' ? palette.vermilion : palette.element[tone as '水' | '木'];

    return (
        <View style={styles.container}>
            <StatusBarDecor />
            <View style={styles.header}>
                <View>
                    <Text style={styles.brand}>书阁</Text>
                    <Text style={styles.brandSub}>经典原文与卦象速查</Text>
                </View>
                <Text style={styles.headerMeta}>64 卦 · {BAZI_CLASSIC_BOOK_INDEX.length} 部典籍</Text>
            </View>

            <ScrollView
                style={styles.body}
                contentContainerStyle={[styles.bodyContent, { paddingBottom: 64 + Math.max(insets.bottom, 16) + 24 }]}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.search}>
                    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                        <Circle cx={11} cy={11} r={6.5} stroke={palette.muted} strokeWidth={1.8} />
                        <Path d="M16 16l4 4" stroke={palette.muted} strokeWidth={1.8} strokeLinecap="round" />
                    </Svg>
                    <TextInput
                        value={query}
                        onChangeText={setQuery}
                        placeholder="搜卦名、篇名"
                        placeholderTextColor={palette.muted}
                        style={styles.searchInput}
                        returnKeyType="search"
                        accessibilityLabel="搜索卦名或篇名"
                    />
                </View>

                {keyword ? (
                    <View style={styles.resultList}>
                        {results.length === 0 ? <Text style={styles.empty}>没有找到「{keyword}」</Text> : results.map((item, index) => (
                            <Pressable key={item.key} onPress={item.onPress} style={({ pressed }) => [styles.resultRow, index > 0 && styles.resultRule, pressed && styles.pressed]} accessibilityRole="button">
                                <Text style={styles.resultTitle} numberOfLines={1}>{item.title}</Text>
                                <Text style={styles.resultMeta} numberOfLines={1}>{item.meta}</Text>
                                <ChevronRightIcon size={16} color={palette.muted} />
                            </Pressable>
                        ))}
                    </View>
                ) : (
                    <>
                        {lastBook && lastProgress && lastIndex >= 0 ? (
                            <Pressable
                                onPress={() => router.push({ pathname: '/learn/reader', params: { book: lastBook.id, chapter: lastProgress.chapterId } })}
                                style={({ pressed }) => [styles.resume, pressed && styles.pressed]}
                                accessibilityRole="button"
                                accessibilityLabel={`继续阅读 ${lastBook.title} ${getChapterLabel(lastBook.chapters[lastIndex].title).title}`}
                            >
                                <View style={[styles.miniSpine, { backgroundColor: BOOK_COLORS[lastBook.id] || palette.chipBg }]}>
                                    <View style={styles.miniLabel}>
                                        {lastBook.title.slice(0, 4).split('').map((ch, i) => <Text key={i} style={styles.miniLabelText}>{ch}</Text>)}
                                    </View>
                                </View>
                                <View style={styles.flex}>
                                    <Text style={styles.resumeKicker}>继续阅读</Text>
                                    <Text style={styles.resumeTitle} numberOfLines={1}>{getChapterLabel(lastBook.chapters[lastIndex].title).title}</Text>
                                    <View style={styles.resumeMetaRow}>
                                        <Text style={styles.resumeMeta}>{lastBook.title} · 第 {lastIndex + 1} 篇 · 读到 {Math.round(lastProgress.progress * 100)}%</Text>
                                        <View style={styles.bar}><View style={[styles.barFill, { width: `${Math.round(lastProgress.progress * 100)}%` }]} /></View>
                                    </View>
                                </View>
                                <ChevronRightIcon size={18} color={palette.muted} />
                            </Pressable>
                        ) : null}

                        <View style={styles.card}>
                            <View style={styles.sectionHead}>
                                <View style={styles.diamond} />
                                <Text style={styles.sectionTitle}>周易 · 六十四卦</Text>
                                <View style={styles.flex} />
                                <Pressable onPress={() => router.push('/learn/hexagrams')} hitSlop={8} style={styles.linkRow} accessibilityRole="button">
                                    <Text style={styles.link}>方图</Text>
                                    <ChevronRightIcon size={12} color={palette.gold} />
                                </Pressable>
                            </View>
                            <Text style={styles.cardDesc}>卦辞 · 彖传 · 象传 · 文言 · 爻辞，按上卦查</Text>
                            <View style={styles.trigramRow}>
                                {TRIGRAM_INDEXES.map((index) => {
                                    const trigram = BA_GUA[index];
                                    const color = palette.element[trigram.wuxing];
                                    return (
                                        <Pressable
                                            key={index}
                                            onPress={() => router.push({ pathname: '/learn/hexagrams', params: { upper: String(index) } })}
                                            style={({ pressed }) => [styles.trigramChip, pressed && styles.pressed]}
                                            accessibilityRole="button"
                                            accessibilityLabel={`${trigram.name}为${trigram.nature}，查上卦为${trigram.name}的八卦`}
                                        >
                                            <HexagramLines lines={trigram.yao} width={18} barHeight={2.5} gap={2.5} color={color} movingColor={color} />
                                            <Text style={[styles.trigramName, { color }]}>{trigram.name}</Text>
                                        </Pressable>
                                    );
                                })}
                            </View>
                        </View>

                        <View style={styles.section}>
                            <View style={styles.sectionHead}>
                                <View style={styles.diamond} />
                                <Text style={styles.sectionTitle}>命理典籍</Text>
                                <Text style={styles.sectionMeta}>{BAZI_CLASSIC_BOOK_INDEX.length} 部 · {chapterTotal} 篇</Text>
                            </View>
                            <View style={styles.shelf}>
                                {BAZI_CLASSIC_BOOK_INDEX.map((book) => (
                                    <Pressable
                                        key={book.id}
                                        onPress={() => router.push({ pathname: '/learn/reader', params: { book: book.id } })}
                                        style={({ pressed }) => [styles.book, pressed && styles.pressed]}
                                        accessibilityRole="button"
                                        accessibilityLabel={`${book.title}，${book.dynasty} ${book.author}，${book.chapterCount} 篇`}
                                    >
                                        <View style={[styles.spine, { backgroundColor: BOOK_COLORS[book.id] || palette.chipBg }]}>
                                            <View style={styles.stitch} />
                                            <View style={styles.label}>
                                                {book.title.split('').map((ch, i) => <Text key={i} style={[styles.labelText, book.title.length > 4 && styles.labelTextSmall]}>{ch}</Text>)}
                                            </View>
                                            <Text style={styles.spineCount}>{book.chapterCount} 篇</Text>
                                        </View>
                                        <Text style={styles.bookAuthor} numberOfLines={1}>{book.dynasty} · {book.author}</Text>
                                        <Text style={styles.bookSize}>{wan(book.charCount)}</Text>
                                    </Pressable>
                                ))}
                            </View>
                        </View>

                        <View style={styles.section}>
                            <View style={styles.sectionHead}>
                                <View style={styles.diamond} />
                                <Text style={styles.sectionTitle}>速查</Text>
                            </View>
                            <View style={styles.refRow}>
                                {REFS.map((ref) => (
                                    <Pressable
                                        key={ref.key}
                                        onPress={() => router.push(`/learn/ref/${ref.key}`)}
                                        style={({ pressed }) => [styles.refTile, pressed && styles.pressed]}
                                        accessibilityRole="button"
                                    >
                                        <Text style={[styles.refTitle, { color: toneColor(ref.tone) }]} numberOfLines={1}>{ref.title}</Text>
                                        <Text style={styles.refMeta} numberOfLines={1}>{ref.meta}</Text>
                                    </Pressable>
                                ))}
                            </View>
                        </View>
                    </>
                )}
            </ScrollView>
        </View>
    );
}

const makeStyles = (palette: ResultPalette) => StyleSheet.create({
    container: { flex: 1, backgroundColor: palette.page },
    flex: { flex: 1, minWidth: 0 },
    pressed: { opacity: 0.7 },
    header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingTop: 20, paddingHorizontal: 16 },
    brand: { fontFamily: SERIF, fontSize: 28, lineHeight: 36, fontWeight: '500', letterSpacing: 6, color: palette.heading },
    brandSub: { fontSize: 11, lineHeight: 16, letterSpacing: 2, color: palette.gold },
    headerMeta: { fontSize: 12, lineHeight: 16, color: palette.muted },
    body: { flex: 1 },
    bodyContent: { paddingHorizontal: 16, paddingTop: 12, gap: 12 },
    search: {
        height: 40, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12,
        borderRadius: 12, borderWidth: 1, borderColor: palette.cardBorder, backgroundColor: palette.segTrack,
    },
    searchInput: { flex: 1, minWidth: 0, height: '100%', fontSize: 14, color: palette.heading, paddingVertical: 0 },
    resultList: { borderRadius: 16, borderWidth: 1, borderColor: palette.cardBorder, backgroundColor: palette.card, overflow: 'hidden' },
    resultRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 },
    resultRule: { borderTopWidth: 1, borderTopColor: palette.hairline },
    resultTitle: { flexShrink: 1, fontSize: 15, fontWeight: '700', color: palette.heading },
    resultMeta: { flex: 1, fontSize: 12, color: palette.muted, textAlign: 'right' },
    empty: { padding: 20, fontSize: 13, color: palette.muted, textAlign: 'center' },
    resume: {
        flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingLeft: 12, paddingRight: 10,
        borderRadius: 16, borderWidth: 1, borderColor: palette.cardBorder, backgroundColor: palette.card,
    },
    miniSpine: { width: 38, height: 52, borderTopLeftRadius: 3, borderBottomLeftRadius: 3, borderTopRightRadius: 5, borderBottomRightRadius: 5, alignItems: 'center', paddingTop: 5 },
    miniLabel: { width: 13, paddingVertical: 1, alignItems: 'center', backgroundColor: '#E9E1C9' },
    miniLabelText: { fontFamily: SERIF, fontSize: 8.5, lineHeight: 10, color: '#2A2A2A' },
    resumeKicker: { fontSize: 11, lineHeight: 15, letterSpacing: 1, color: palette.gold },
    resumeTitle: { fontSize: 15, lineHeight: 21, fontWeight: '700', color: palette.heading },
    resumeMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 },
    resumeMeta: { fontSize: 12, lineHeight: 16, color: palette.body },
    bar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: palette.barTrack, overflow: 'hidden' },
    barFill: { height: '100%', backgroundColor: palette.gold },
    card: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1, borderColor: palette.cardBorder, backgroundColor: palette.card },
    section: { marginTop: 4 },
    sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    diamond: { width: 7, height: 7, backgroundColor: palette.vermilion, transform: [{ rotate: '45deg' }] },
    sectionTitle: { fontSize: 15, lineHeight: 20, fontWeight: '700', color: palette.heading },
    sectionMeta: { fontSize: 12, color: palette.muted },
    linkRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    link: { fontSize: 12, lineHeight: 16, color: palette.gold },
    cardDesc: { marginTop: 4, fontSize: 12, lineHeight: 18, color: palette.muted },
    trigramRow: { marginTop: 10, flexDirection: 'row', gap: 4 },
    trigramChip: { flex: 1, height: 52, alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 10, backgroundColor: palette.segTrack },
    trigramName: { fontFamily: SERIF, fontSize: 13, lineHeight: 16, fontWeight: '700' },
    shelf: { marginTop: 10, flexDirection: 'row', gap: 10 },
    book: { flex: 1, gap: 4 },
    spine: {
        height: 142, alignItems: 'center', paddingTop: 12,
        borderTopLeftRadius: 3, borderBottomLeftRadius: 3, borderTopRightRadius: 8, borderBottomRightRadius: 8,
    },
    stitch: { position: 'absolute', left: 6, top: 10, bottom: 10, borderLeftWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(233,225,201,0.3)' },
    label: { width: 24, minHeight: 92, paddingVertical: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E9E1C9' },
    labelText: { fontFamily: SERIF, fontSize: 15, lineHeight: 19, fontWeight: '700', color: '#2A2A2A' },
    labelTextSmall: { fontSize: 13, lineHeight: 16 },
    spineCount: { position: 'absolute', right: 8, bottom: 8, fontSize: 10, lineHeight: 12, color: 'rgba(233,225,201,0.7)' },
    bookAuthor: { marginTop: 2, fontSize: 11.5, lineHeight: 15, color: palette.body, textAlign: 'center' },
    bookSize: { fontSize: 10.5, lineHeight: 14, color: palette.muted, textAlign: 'center' },
    refRow: { marginTop: 10, flexDirection: 'row', gap: 8 },
    refTile: {
        flex: 1, minWidth: 0, height: 64, justifyContent: 'center', gap: 2, paddingHorizontal: 10,
        borderRadius: 12, borderWidth: 1, borderColor: palette.cardBorder, backgroundColor: palette.card,
    },
    refTitle: { fontSize: 13.5, lineHeight: 19, fontWeight: '700' },
    refMeta: { fontSize: 11, lineHeight: 15, color: palette.muted },
});
