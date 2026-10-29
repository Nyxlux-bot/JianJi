/**
 * 学习「书阁」：顶上速查五项；山医命相卜五卷，一卷一架书（每层四本），点卷名或左右滑动换卷；可搜卦名、书名与篇名。
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { PanResponder, Platform, Pressable, StyleSheet, Text, TextInput, View, type LayoutChangeEvent } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import StatusBarDecor from '../../src/components/StatusBarDecor';
import HexagramLines from '../../src/components/result/HexagramLines';
import PressableScale from '../../src/components/PressableScale';
import { ChevronRightIcon } from '../../src/components/Icons';
import { HEXAGRAMS } from '../../src/core/iching-texts';
import { CLASSIC_ARTS, CLASSIC_BOOKS, type ClassicArt, type ClassicBookMeta } from '../../src/data/classics';
import { useTabIndicator } from '../../src/hooks/useTabIndicator';
import { loadReadingState, type ReadingState } from '../../src/services/reading-progress';
import { EASE_OUT, riseIn } from '../../src/theme/motion';
import { buildResultPalette, type ResultPalette } from '../../src/theme/result-palette';
import { useTheme } from '../../src/theme/ThemeContext';

const SERIF = Platform.select({ ios: 'Songti SC', android: 'serif', default: 'serif' });
/** 书衣一卷一色，两套主题共用：山松绿、医赭、命藏青、相紫、卜绛 */
const CLOTH: Record<ClassicArt, string> = { shan: '#23392F', yi: '#4A3A22', ming: '#23324A', xiang: '#382C3D', bu: '#47262A' };
const QUICK = [
    { glyph: '卦', title: '六十四卦', meta: '方图 · 按上卦查', href: '/learn/hexagrams' },
    { glyph: '象', title: '八卦类象', meta: '说卦传', href: '/learn/ref/trigram' },
    { glyph: '纳', title: '纳音', meta: '六十甲子', href: '/learn/ref/nayin' },
    { glyph: '煞', title: '神煞', meta: '释义', href: '/learn/ref/shensha' },
    { glyph: '用', title: '体用诀', meta: '梅花易数', href: '/learn/ref/tiyong' },
] as const;
const SUGGESTIONS = ['乾', '泰', '用神', '月令', '人参', '脉'];
const BOOKS_BY_ART = CLASSIC_ARTS.map((art) => CLASSIC_BOOKS.filter((book) => book.art === art.key));
const SHELF = 4;
const SWIPE = 56;
const NAV_HEIGHT = 65;

export default function LearnPage() {
    const { Colors } = useTheme();
    const insets = useSafeAreaInsets();
    const palette = useMemo(() => buildResultPalette(Colors), [Colors]);
    const styles = useMemo(() => makeStyles(palette), [palette]);
    const [query, setQuery] = useState('');
    const [searching, setSearching] = useState(false);
    const [reading, setReading] = useState<ReadingState | null>(null);
    const [picked, setPicked] = useState<number | null>(null);

    useFocusEffect(useCallback(() => {
        loadReadingState().then(setReading);
    }, []));

    // 没点过卷名时，落在最近读的那部书所在的卷，否则落在「命」
    const lastArt = CLASSIC_BOOKS.find((book) => book.id === reading?.lastBookId)?.art;
    const artIndex = picked ?? Math.max(0, CLASSIC_ARTS.findIndex((art) => art.key === (lastArt ?? 'ming')));
    const art = CLASSIC_ARTS[artIndex];
    const books = BOOKS_BY_ART[artIndex];
    const indicator = useTabIndicator(art.key);

    const scrollRef = useRef<Animated.ScrollView>(null);
    const scrollY = useSharedValue(0);
    const navTop = useSharedValue(Number.MAX_SAFE_INTEGER);
    const onScroll = useAnimatedScrollHandler((event) => { scrollY.value = event.contentOffset.y; });
    const navBackground = useAnimatedStyle(() => ({
        opacity: interpolate(scrollY.value, [navTop.value - 24, navTop.value], [0, 1], Extrapolation.CLAMP),
    }));

    const go = useCallback((target: number) => {
        if (target < 0 || target >= CLASSIC_ARTS.length) return;
        // 五术栏吸顶时换卷，把新卷首顶到栏下面，免得藏在栏后
        if (scrollY.value > navTop.value) scrollRef.current?.scrollTo({ y: navTop.value, animated: false });
        setPicked(target);
    }, [navTop, scrollY]);
    const goRef = useRef(go);
    goRef.current = go;
    const artRef = useRef(artIndex);
    artRef.current = artIndex;
    const swipe = useMemo(() => PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 14 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
        onPanResponderRelease: (_, g) => {
            if (Math.abs(g.dx) > SWIPE) goRef.current(artRef.current + (g.dx < 0 ? 1 : -1));
        },
        onPanResponderTerminationRequest: () => true,
    }), []);

    const keyword = query.trim();
    const groups = useMemo(() => (keyword ? searchAll(keyword) : []), [keyword]);
    const closeSearch = () => {
        setSearching(false);
        setQuery('');
    };

    return (
        <View style={styles.container}>
            <StatusBarDecor />
            <Animated.ScrollView
                ref={scrollRef}
                style={styles.body}
                contentContainerStyle={[styles.bodyContent, { paddingBottom: 64 + Math.max(insets.bottom, 16) + 24 }]}
                stickyHeaderIndices={searching ? undefined : [2]}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                onScroll={onScroll}
                scrollEventThrottle={16}
            >
                <View style={styles.header}>
                    {searching ? (
                        <>
                            <View style={styles.searchField}>
                                <SearchGlyph color={palette.muted} size={16} />
                                <TextInput
                                    value={query}
                                    onChangeText={setQuery}
                                    autoFocus
                                    placeholder="搜卦名、书名、篇名"
                                    placeholderTextColor={palette.muted}
                                    style={styles.searchInput}
                                    returnKeyType="search"
                                    accessibilityLabel="搜索卦名、书名或篇名"
                                />
                                {query ? (
                                    <Pressable onPress={() => setQuery('')} style={styles.clearBtn} accessibilityRole="button" accessibilityLabel="清除">
                                        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none"><Path d="M7 7l10 10M17 7L7 17" stroke={palette.muted} strokeWidth={1.8} strokeLinecap="round" /></Svg>
                                    </Pressable>
                                ) : null}
                            </View>
                            <Pressable onPress={closeSearch} style={({ pressed }) => [styles.cancelBtn, pressed && styles.pressed]} accessibilityRole="button">
                                <Text style={styles.cancel}>取消</Text>
                            </Pressable>
                        </>
                    ) : (
                        <>
                            <View>
                                <Text style={styles.brand}>书阁</Text>
                                <Text style={styles.brandSub}>五术典籍 · 原文与速查</Text>
                            </View>
                            <PressableScale onPress={() => setSearching(true)} style={styles.searchBtn} scaleTo={0.94} accessibilityRole="button" accessibilityLabel="搜索卦名、书名或篇名">
                                <SearchGlyph color={palette.body} size={18} />
                            </PressableScale>
                        </>
                    )}
                </View>

                {searching ? <View /> : (
                    <View style={styles.quickWrap}>
                        <Text style={styles.quickHead}>速查</Text>
                        <View style={styles.quick}>
                            {QUICK.map((item) => (
                                <PressableScale key={item.title} onPress={() => router.push(item.href)} style={styles.quickItem} scaleTo={0.93} accessibilityRole="button" accessibilityLabel={`速查，${item.title}，${item.meta}`}>
                                    <View style={styles.badge}><Text style={styles.badgeText}>{item.glyph}</Text></View>
                                    <Text style={styles.quickTitle} numberOfLines={1}>{item.title}</Text>
                                </PressableScale>
                            ))}
                        </View>
                    </View>
                )}

                {searching ? <View /> : (
                    <View>
                        <Animated.View pointerEvents="none" style={[styles.navBackground, { backgroundColor: Colors.bg.primary }, navBackground]} />
                        <View style={styles.nav} accessibilityRole="tablist">
                            {CLASSIC_ARTS.map((item, i) => (
                                <ArtTab key={item.key} ch={item.ch} cap={item.cap} on={i === artIndex} onPress={() => go(i)} onLayout={indicator.onTabLayout(item.key)} label={`${item.ch}，${item.title}，${BOOKS_BY_ART[i].length} 部`} styles={styles} />
                            ))}
                            <Animated.View pointerEvents="none" style={[styles.navIndicator, indicator.style]} />
                        </View>
                    </View>
                )}

                {searching ? (
                    <SearchResults keyword={keyword} groups={groups} onPick={setQuery} styles={styles} palette={palette} />
                ) : (
                    // 吸顶的栏被 ScrollView 包了一层，量不准自己的位置；用紧随其后的卷首倒推
                    <View {...swipe.panHandlers} onLayout={(event: LayoutChangeEvent) => { navTop.value = event.nativeEvent.layout.y - NAV_HEIGHT; }}>
                        <View key={art.key}>
                            <View style={styles.mast}>
                                {/* 淡度放外层：entering 动画结束会把自身 opacity 设回 1 */}
                                <View style={[styles.watermarkClip, { opacity: palette.isLight ? 0.09 : 0.075 }]} pointerEvents="none">
                                    <Animated.Text entering={riseIn(0, 12, 520)} style={[styles.watermark, { color: palette.gold }]}>{art.ch}</Animated.Text>
                                </View>
                                <Animated.Text entering={riseIn(0, 8, 380)} style={styles.mastKicker}>{art.juan}</Animated.Text>
                                <Animated.Text entering={riseIn(50, 8, 380)} style={styles.mastTitle}>{art.title}</Animated.Text>
                                <Animated.Text entering={riseIn(100, 8, 380)} style={styles.mastDesc}>{art.desc}</Animated.Text>
                                <Animated.Text entering={riseIn(100, 8, 380)} style={styles.mastMeta}>{books.length} 部</Animated.Text>
                            </View>
                            {chunk(books, SHELF).map((row, r) => (
                                <View key={r} style={[styles.shelf, r > 0 && styles.shelfNext]}>
                                    <View style={styles.row}>
                                        {pad(row).map((book, k) => (book ? (
                                            <Animated.View key={book.id} entering={riseIn(150 + (r * SHELF + k) * 50, 8, 380)} style={styles.col}>
                                                <BookCover
                                                    book={book}
                                                    color={CLOTH[art.key]}
                                                    progress={bookProgress(book, reading)}
                                                    styles={styles}
                                                />
                                            </Animated.View>
                                        ) : <View key={k} style={styles.col} />))}
                                    </View>
                                    <View style={styles.plank} />
                                    <View style={styles.row}>
                                        {pad(row).map((book, k) => (
                                            <View key={k} style={[styles.col, styles.label]}>
                                                {book ? <Text style={styles.labelAuthor} numberOfLines={1}>{book.author}</Text> : null}
                                                {book ? <Text style={styles.labelDynasty} numberOfLines={1}>{book.dynasty}</Text> : null}
                                            </View>
                                        ))}
                                    </View>
                                </View>
                            ))}
                        </View>
                    </View>
                )}
            </Animated.ScrollView>
        </View>
    );
}

function ArtTab({ ch, cap, on, label, onPress, onLayout, styles }: {
    ch: string;
    cap: string;
    on: boolean;
    label: string;
    onPress: () => void;
    onLayout: (event: LayoutChangeEvent) => void;
    styles: Styles;
}) {
    const reduce = useReducedMotion();
    const scale = useAnimatedStyle(() => ({ transform: [{ scale: withTiming(on && !reduce ? 1.14 : 1, { duration: 220, easing: EASE_OUT }) }] }), [on, reduce]);
    return (
        <PressableScale onPress={onPress} onLayout={onLayout} style={styles.navItem} scaleTo={0.92} accessibilityRole="tab" aria-selected={on} accessibilityLabel={label}>
            <Animated.Text style={[styles.navChar, on && styles.navCharOn, scale]}>{ch}</Animated.Text>
            <Text style={[styles.navCap, on && styles.navCapOn]}>{cap}</Text>
        </PressableScale>
    );
}

/** 书面朝外立在架上：线装四眼订线、左上题签；在读的抽出一截，底边金线是进度；按下整本抽起 */
function BookCover({ book, color, progress, styles }: { book: ClassicBookMeta; color: string; progress: number | null; styles: Styles }) {
    const reduce = useReducedMotion();
    const pressed = useSharedValue(0);
    const lift = progress == null ? 0 : -6;
    const motion = useAnimatedStyle(() => (reduce
        ? { opacity: 1 - 0.15 * pressed.value }
        : { transform: [{ translateY: lift - 8 * pressed.value }, { rotate: `${-2 * pressed.value}deg` }] }), [lift, reduce]);
    const chars = book.title.split('');
    const slipText = chars.length > 5 ? styles.slipTextSmall : chars.length > 4 ? styles.slipTextMid : null;
    return (
        <Pressable
            onPress={() => router.push({ pathname: '/learn/reader', params: { book: book.id } })}
            onPressIn={() => { pressed.value = withTiming(1, { duration: 160, easing: EASE_OUT }); }}
            onPressOut={() => { pressed.value = withTiming(0, { duration: 220, easing: EASE_OUT }); }}
            accessibilityRole="button"
            accessibilityLabel={`${book.title}，${book.dynasty} ${book.author}，${book.chapters.length} 篇${progress == null ? '' : `，读到 ${Math.round(progress * 100)}%`}`}
        >
            <Animated.View style={[styles.cover, { backgroundColor: color }, motion]}>
                <View style={styles.bind}>
                    {['14%', '37%', '62%', '85%'].map((top) => <View key={top} style={[styles.tick, { top: top as `${number}%` }]} />)}
                </View>
                <View style={styles.slip}>
                    <View style={styles.slipFrame}>
                        {chars.map((ch, i) => <Text key={i} style={[styles.slipText, slipText]}>{ch}</Text>)}
                    </View>
                </View>
                {progress == null ? null : <View style={[styles.progress, { width: `${Math.max(4, Math.round(progress * 100))}%` }]} />}
            </Animated.View>
        </Pressable>
    );
}

type ResultRow = { key: string; title: string; hit: number; meta: string; badge: string; lines?: number[]; onPress: () => void };
type ResultGroup = { key: string; glyph: string; label: string; total: number; rows: ResultRow[] };

function SearchResults({ keyword, groups, onPick, styles, palette }: { keyword: string; groups: ResultGroup[]; onPick: (value: string) => void; styles: Styles; palette: ResultPalette }) {
    if (!keyword) {
        return (
            <View style={styles.results}>
                <Text style={styles.resultsHint}>试试</Text>
                <View style={styles.suggestions}>
                    {SUGGESTIONS.map((word) => (
                        <PressableScale key={word} onPress={() => onPick(word)} style={styles.suggestion} scaleTo={0.94} accessibilityRole="button">
                            <Text style={styles.suggestionText}>{word}</Text>
                        </PressableScale>
                    ))}
                </View>
            </View>
        );
    }
    if (groups.length === 0) return <Text style={styles.empty}>没有找到「{keyword}」，试试卦名、书名或篇名</Text>;
    let order = 0;
    return (
        <View style={styles.results}>
            {groups.map((group) => (
                <View key={group.key} style={styles.resultGroup}>
                    <Text style={styles.resultGroupHead}><Text style={styles.resultGroupGlyph}>{group.glyph}</Text>  {group.label} · {group.total}</Text>
                    <View style={styles.resultList}>
                        {group.rows.map((row, i) => (
                            <Animated.View key={row.key} entering={riseIn(Math.min(order++, 12) * 30, 8, 320)}>
                                <Pressable onPress={row.onPress} style={({ pressed }) => [styles.resultRow, i > 0 && styles.resultRule, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`${row.title}，${row.meta}`}>
                                    <View style={styles.badge}>
                                        {row.lines ? <HexagramLines lines={row.lines} width={14} barHeight={1.6} gap={1.6} color={palette.gold} movingColor={palette.gold} /> : <Text style={styles.badgeText}>{row.badge}</Text>}
                                    </View>
                                    <View style={styles.flex}>
                                        <Text style={styles.resultTitle} numberOfLines={1}>
                                            {row.title.slice(0, row.hit)}<Text style={styles.resultHit}>{row.title.slice(row.hit, row.hit + keyword.length)}</Text>{row.title.slice(row.hit + keyword.length)}
                                        </Text>
                                        <Text style={styles.resultMeta} numberOfLines={1}>{row.meta}</Text>
                                    </View>
                                    <ChevronRightIcon size={16} color={palette.muted} />
                                </Pressable>
                            </Animated.View>
                        ))}
                    </View>
                </View>
            ))}
        </View>
    );
}

function SearchGlyph({ color, size }: { color: string; size: number }) {
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Circle cx={11} cy={11} r={6.5} stroke={color} strokeWidth={1.8} />
            <Path d="M16 16l4 4" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
        </Svg>
    );
}

/** 卦名一组，其余按书所在的卷分组；书名命中排在篇名前，每组最多 20 条 */
function searchAll(keyword: string): ResultGroup[] {
    const groups: ResultGroup[] = [];
    const hexagrams = HEXAGRAMS.filter((item) => item.fullName.includes(keyword));
    if (hexagrams.length) {
        groups.push({
            key: 'gua', glyph: '卦', label: '六十四卦', total: hexagrams.length,
            rows: hexagrams.slice(0, 20).map((item) => ({
                key: `h${item.id}`, title: item.fullName, hit: item.fullName.indexOf(keyword), meta: `第 ${item.id} 卦`, badge: '', lines: item.lines,
                onPress: () => router.push(`/learn/hexagram/${item.id}`),
            })),
        });
    }
    CLASSIC_ARTS.forEach((art, i) => {
        const rows: ResultRow[] = [];
        let total = 0;
        for (const book of BOOKS_BY_ART[i]) {
            if (book.title.includes(keyword)) {
                total += 1;
                rows.unshift({
                    key: book.id, title: book.title, hit: book.title.indexOf(keyword), meta: `${book.dynasty} · ${book.author} · ${book.chapters.length} 篇`, badge: book.title[0],
                    onPress: () => router.push({ pathname: '/learn/reader', params: { book: book.id } }),
                });
            }
            for (const chapter of book.chapters) {
                if (!chapter.title.includes(keyword)) continue;
                total += 1;
                if (rows.length >= 20) continue;
                rows.push({
                    key: chapter.id, title: chapter.title, hit: chapter.title.indexOf(keyword), meta: `${book.title}${chapter.volume ? ` · ${chapter.volume}` : ''}`, badge: book.title[0],
                    onPress: () => router.push({ pathname: '/learn/reader', params: { book: book.id, chapter: chapter.id } }),
                });
            }
        }
        if (rows.length) groups.push({ key: art.key, glyph: art.ch, label: art.title, total, rows: rows.slice(0, 20) });
    });
    return groups;
}

/** 整部书读到的比例：已读的篇加上当前篇里的位置；没读过返回 null */
function bookProgress(book: ClassicBookMeta, reading: ReadingState | null): number | null {
    const saved = reading?.books[book.id];
    if (!saved) return null;
    const index = book.chapters.findIndex((chapter) => chapter.id === saved.chapterId);
    return index < 0 ? null : Math.min(1, (index + saved.progress) / book.chapters.length);
}

function chunk<T>(items: T[], size: number): T[][] {
    const rows: T[][] = [];
    for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
    return rows;
}

const pad = <T,>(row: T[]): Array<T | null> => [...row, ...Array(SHELF - row.length).fill(null)];

type Styles = ReturnType<typeof makeStyles>;

const makeStyles = (palette: ResultPalette) => StyleSheet.create({
    container: { flex: 1, backgroundColor: 'transparent' },
    flex: { flex: 1, minWidth: 0 },
    pressed: { opacity: 0.7 },
    body: { flex: 1 },
    bodyContent: { paddingHorizontal: 16 },
    header: { minHeight: 74, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10, paddingTop: 20 },
    brand: { fontFamily: SERIF, fontSize: 30, lineHeight: 38, fontWeight: '500', letterSpacing: 6, color: palette.heading },
    brandSub: { fontSize: 11, lineHeight: 16, letterSpacing: 2, color: palette.gold },
    searchBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.cardBorder },
    searchField: {
        flex: 1, minWidth: 0, height: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 14,
        borderRadius: 22, borderWidth: 1, borderColor: palette.cardBorder, backgroundColor: palette.segTrack,
    },
    searchInput: { flex: 1, minWidth: 0, height: '100%', fontSize: 15, color: palette.heading, paddingVertical: 0 },
    clearBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    cancelBtn: { height: 44, justifyContent: 'center', paddingHorizontal: 4 },
    cancel: { fontSize: 14, color: palette.gold },
    quickWrap: { paddingBottom: 20 },
    quickHead: { marginTop: 18, fontSize: 12, lineHeight: 16, color: palette.muted },
    quick: {
        marginTop: 8, flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 4,
        borderRadius: 16, borderWidth: 1, borderColor: palette.cardBorder, backgroundColor: palette.segTrack,
    },
    quickItem: { flex: 1, minWidth: 0, height: 74, alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 12 },
    quickTitle: { fontSize: 11.5, lineHeight: 15, color: palette.body },
    badge: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.chipBg },
    badgeText: { fontFamily: SERIF, fontSize: 16, lineHeight: 20, fontWeight: '700', color: palette.gold },
    navBackground: { position: 'absolute', top: 0, right: -16, bottom: 0, left: -16 },
    nav: { height: NAV_HEIGHT, flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: palette.hairline },
    navItem: { flex: 1, minWidth: 0, height: 64, alignItems: 'center', justifyContent: 'center', gap: 2 },
    navChar: { fontFamily: SERIF, fontSize: 22, lineHeight: 28, fontWeight: '700', color: palette.body },
    navCharOn: { color: palette.heading },
    navCap: { fontSize: 11, lineHeight: 15, color: palette.muted },
    navCapOn: { color: palette.gold },
    navIndicator: { position: 'absolute', left: 0, bottom: -1, width: 16, height: 3, borderRadius: 1.5, backgroundColor: palette.vermilion },
    mast: { marginTop: 28, minHeight: 112 },
    watermarkClip: { position: 'absolute', top: -30, right: -16, width: 218, height: 200, overflow: 'hidden' },
    watermark: { position: 'absolute', top: 0, right: -18, fontFamily: SERIF, fontSize: 200, lineHeight: 200, fontWeight: '700' },
    mastKicker: { fontSize: 11, lineHeight: 15, letterSpacing: 4, color: palette.gold },
    mastTitle: { marginTop: 6, fontFamily: SERIF, fontSize: 25, lineHeight: 34, fontWeight: '700', letterSpacing: 3, color: palette.heading },
    mastDesc: { marginTop: 6, fontSize: 12.5, lineHeight: 18, color: palette.body },
    mastMeta: { marginTop: 2, fontSize: 12, lineHeight: 16, color: palette.muted },
    shelf: { marginTop: 22 },
    shelfNext: { marginTop: 18 },
    row: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
    col: { flex: 1, minWidth: 0 },
    cover: { height: 128, borderTopLeftRadius: 2, borderBottomLeftRadius: 2, borderTopRightRadius: 18, borderBottomRightRadius: 18, overflow: 'hidden', transformOrigin: 'bottom' },
    bind: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 9, borderRightWidth: 1, borderRightColor: 'rgba(233,225,201,0.16)' },
    tick: { position: 'absolute', left: 0, width: 9, height: 1, backgroundColor: 'rgba(233,225,201,0.42)' },
    slip: { position: 'absolute', left: 16, top: 10, padding: 2, backgroundColor: '#E9E1C9' },
    slipFrame: { paddingVertical: 4, paddingHorizontal: 2, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(42,42,42,0.26)' },
    slipText: { fontFamily: SERIF, fontSize: 14, lineHeight: 16, fontWeight: '700', color: '#2A2A2A' },
    slipTextMid: { fontSize: 12.5, lineHeight: 14.5 },
    slipTextSmall: { fontSize: 11, lineHeight: 13 },
    progress: { position: 'absolute', left: 0, bottom: 0, height: 2, backgroundColor: '#E2C46E' },
    plank: {
        marginHorizontal: -16, height: 9, backgroundColor: palette.segTrack,
        borderTopWidth: 1, borderTopColor: palette.rule, borderBottomWidth: 1, borderBottomColor: palette.hairline,
    },
    label: { marginTop: 9, alignItems: 'center' },
    labelAuthor: { fontSize: 12, lineHeight: 16, color: palette.body },
    labelDynasty: { fontSize: 11, lineHeight: 15, color: palette.muted },
    results: { marginTop: 22 },
    resultsHint: { marginBottom: 10, fontSize: 12, lineHeight: 16, color: palette.muted },
    suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    suggestion: { height: 44, paddingHorizontal: 18, borderRadius: 22, justifyContent: 'center', borderWidth: 1, borderColor: palette.cardBorder, backgroundColor: palette.segTrack },
    suggestionText: { fontFamily: SERIF, fontSize: 15, fontWeight: '700', color: palette.body },
    empty: { paddingVertical: 28, textAlign: 'center', fontSize: 13, lineHeight: 20, color: palette.muted },
    resultGroup: { marginBottom: 22 },
    resultGroupHead: { marginBottom: 10, fontSize: 12, lineHeight: 20, color: palette.muted },
    resultGroupGlyph: { fontFamily: SERIF, fontSize: 15, fontWeight: '700', color: palette.heading },
    resultList: { borderRadius: 16, borderWidth: 1, borderColor: palette.cardBorder, backgroundColor: palette.segTrack, overflow: 'hidden' },
    resultRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 14 },
    resultRule: { borderTopWidth: 1, borderTopColor: palette.hairline },
    resultTitle: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: palette.heading },
    resultHit: { color: palette.gold },
    resultMeta: { fontSize: 11.5, lineHeight: 16, color: palette.muted },
});
