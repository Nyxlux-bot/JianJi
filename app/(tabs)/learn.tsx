/**
 * 学习「书阁」：顶上速查五项；山医命相卜五卷，点卷名或左右滑动换卷。当前卷有在读书目时先呈一张案头续读笺，
 * 下面两列宋刻扉页式书叶；可搜卦名、书名与篇名。所有内容收在左右边距内，横滑切页时中缝只露经幡。
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Platform, Pressable, StyleSheet, Text, TextInput, View, type GestureResponderEvent, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { useFieldFocus } from '../../src/components/FocusTextInput';
import { webFocusFieldProps, webLiquidGlass } from '../../src/theme/web-enhance';
import Animated, { Extrapolation, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import StatusBarDecor from '../../src/components/StatusBarDecor';
import HexagramLines from '../../src/components/result/HexagramLines';
import PressableScale from '../../src/components/PressableScale';
import { ChevronRightIcon } from '../../src/components/Icons';
import { HEXAGRAMS } from '../../src/core/iching-texts';
import { CLASSIC_ARTS, CLASSIC_BOOKS, type ClassicBookMeta } from '../../src/data/classics';
import { useTabIndicator } from '../../src/hooks/useTabIndicator';
import { loadReadingState, type ReadingState } from '../../src/services/reading-progress';
import { EASE_OUT } from '../../src/theme/motion';
import { buildResultPalette, type ResultPalette } from '../../src/theme/result-palette';
import { useTheme } from '../../src/theme/ThemeContext';

const SERIF = Platform.select({ ios: 'Songti SC', android: 'serif', default: 'serif' });
const QUICK = [
    { glyph: '卦', title: '六十四卦', meta: '方图 · 按上卦查', href: '/learn/hexagrams' },
    { glyph: '象', title: '八卦类象', meta: '说卦传', href: '/learn/ref/trigram' },
    { glyph: '纳', title: '纳音', meta: '六十甲子', href: '/learn/ref/nayin' },
    { glyph: '煞', title: '神煞', meta: '释义', href: '/learn/ref/shensha' },
    { glyph: '用', title: '体用诀', meta: '梅花易数', href: '/learn/ref/tiyong' },
] as const;
const SUGGESTIONS = ['乾', '泰', '用神', '月令', '人参', '脉'];
const BOOKS_BY_ART = CLASSIC_ARTS.map((art) => CLASSIC_BOOKS.filter((book) => book.art === art.key));
const LIBRARY_STAT = `${CLASSIC_BOOKS.length} 部 · ${CLASSIC_BOOKS.reduce((sum, book) => sum + book.chapters.length, 0)} 篇`;
const COLUMNS = 2;
const SWIPE = 56;
const NAV_HEIGHT = 60;
// 按下书叶：手指那一角往里按，角度和弹簧同首页牌叠（EntryDeck 的 LEAN、HOVER）
const LEAN = 4.55;
const PRESS_SPRING = { stiffness: 415, damping: 19.7, mass: 1 };
// 书叶中栏竖排篇名最多放这么多字（叶高固定，留足底部对内框线的呼吸间距）
const LEAF_CHAPTER_CHARS = 10;
// 纯序跋/凡例/目录类开篇：未读时跳过，优先展示第一篇正文
const FRONT_MATTER_RE = /^(?:(?:《[^》]+》)?(?:自|原|总|罗|重刻|新刻|[\u4e00-\u9fff]{1,6})?[序叙](?:[一二三四五六七八九十\d]|录)?(?:\s*[［\[].*)?|进《[^》]+》疏.*|(?:《[^》]+》|[\u4e00-\u9fff]{1,6})?凡例|提要|目录|前言|引言|题辞|卷首)$/;
// 竖排标点映射：将横排括号与破折号转为直排形态，顿号转居中中点避免左下偏移
const VERTICAL_PUNCT: Record<string, string> = {
    '（': '︵', '(': '︵',
    '）': '︶', ')': '︶',
    '〔': '︹', '〕': '︺',
    '「': '﹁', '」': '﹂',
    '『': '﹃', '』': '﹄',
    '【': '︻', '［': '︻', '[': '︻',
    '】': '︼', '］': '︼', ']': '︼',
    '《': '︽', '》': '︾',
    '—': '︱', '–': '︱', '-': '︱',
    '、': '·',
};
const OPEN_VERTICAL_BRACKETS = new Set(['︵', '︹', '﹁', '﹃', '︻', '︽']);

/** 半透书叶：压在流动经幡上。玄黑/宣白均取沉稳不透明度，既留纸墨呼吸又不被经幡搅花小字 */
function buildLeafTones(palette: ResultPalette) {
    return palette.isLight
        ? { leaf: 'rgba(252,248,240,0.88)', leafHi: 'rgba(255,251,244,0.97)', line: 'rgba(138,99,18,0.22)', rule: 'rgba(74,50,24,0.12)', frame: 'rgba(138,99,18,0.36)', track: 'rgba(74,50,24,0.1)', seal: palette.vermilion, goldInk: '#7a560f' }
        // 阴面印章底比 vermilion 深一档：#DF6658 配米白字只有 3.3:1，#BC4637 为 5.0:1
        : { leaf: 'rgba(22,21,19,0.86)', leafHi: 'rgba(28,27,24,0.96)', line: 'rgba(207,181,59,0.22)', rule: 'rgba(255,255,255,0.08)', frame: 'rgba(207,181,59,0.34)', track: 'rgba(255,255,255,0.1)', seal: '#BC4637', goldInk: palette.gold };
}
type LeafTones = ReturnType<typeof buildLeafTones>;

export default function LearnPage() {
    const { Colors } = useTheme();
    const insets = useSafeAreaInsets();
    const palette = useMemo(() => buildResultPalette(Colors), [Colors]);
    const tones = useMemo(() => buildLeafTones(palette), [palette]);
    const styles = useMemo(() => makeStyles(palette, tones), [palette, tones]);
    const [query, setQuery] = useState('');
    const [searching, setSearching] = useState(false);
    const searchFocus = useFieldFocus();
    const [reading, setReading] = useState<ReadingState | null>(null);
    const [picked, setPicked] = useState<number | null>(null);
    const hasLoadedReadingRef = useRef(false);

    useFocusEffect(useCallback(() => {
        let active = true;
        const refresh = () => {
            loadReadingState().then((next) => {
                if (!active) return;
                hasLoadedReadingRef.current = true;
                setReading((prev) => (prev && JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
            }).catch(() => undefined);
        };
        if (!hasLoadedReadingRef.current) {
            refresh();
            return () => { active = false; };
        }
        // 已有阅读进度时等切页滑稳再读，快速划过书阁时不打扰存储也不在动画中重渲染
        const timer = setTimeout(refresh, 200);
        return () => {
            active = false;
            clearTimeout(timer);
        };
    }, []));

    // 没点过卷名时，落在最近读的那部书所在的卷，否则落在「命」
    const lastArt = CLASSIC_BOOKS.find((book) => book.id === reading?.lastBookId)?.art;
    const artIndex = picked ?? Math.max(0, CLASSIC_ARTS.findIndex((art) => art.key === (lastArt ?? 'ming')));
    const art = CLASSIC_ARTS[artIndex];
    const books = BOOKS_BY_ART[artIndex];
    const artChars = useMemo(() => books.reduce((sum, book) => sum + book.charCount, 0), [books]);
    const indicator = useTabIndicator(art.key);

    const scrollRef = useRef<Animated.ScrollView>(null);
    const scrollY = useSharedValue(0);
    const navTop = useSharedValue(Number.MAX_SAFE_INTEGER);
    const onScroll = useAnimatedScrollHandler((event) => { scrollY.value = event.contentOffset.y; });
    // 吸顶时浮条底色加深一档；底色只在浮条圆角内，不铺满全宽
    const navStuck = useAnimatedStyle(() => ({
        opacity: interpolate(scrollY.value, [navTop.value - 24, navTop.value], [0, 1], Extrapolation.CLAMP),
    }));

    const go = useCallback((target: number) => {
        if (target < 0 || target >= CLASSIC_ARTS.length) return;
        // 五卷栏吸顶时换卷，把新卷首顶到栏下面，免得藏在栏后
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

    const deskBook = pickDeskBook(books, reading);

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
                            <View style={[styles.searchField, { borderColor: searchFocus.borderColor }]}>
                                <SearchGlyph color={palette.muted} size={16} />
                                <TextInput
                                    {...webFocusFieldProps}
                                    value={query}
                                    onChangeText={setQuery}
                                    autoFocus
                                    placeholder="搜卦名、书名、篇名"
                                    placeholderTextColor={palette.muted}
                                    style={styles.searchInput}
                                    onFocus={searchFocus.onFocus}
                                    onBlur={searchFocus.onBlur}
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
                                <Text style={styles.brandSub}>{LIBRARY_STAT}</Text>
                            </View>
                            <PressableScale onPress={() => setSearching(true)} style={styles.searchBtn} scaleTo={0.94} accessibilityRole="button" accessibilityLabel="搜索卦名、书名或篇名">
                                <SearchGlyph color={palette.body} size={18} />
                            </PressableScale>
                        </>
                    )}
                </View>

                {searching ? <View /> : (
                    <View style={styles.quick}>
                        {QUICK.map((item) => (
                            <PressableScale key={item.title} onPress={() => router.push(item.href)} style={styles.quickItem} scaleTo={0.93} accessibilityRole="button" accessibilityLabel={`速查，${item.title}，${item.meta}`}>
                                <View style={styles.quickBadge}><Text style={styles.quickGlyph}>{item.glyph}</Text></View>
                                <Text style={styles.quickTitle} numberOfLines={1}>{item.title}</Text>
                            </PressableScale>
                        ))}
                    </View>
                )}

                {searching ? <View /> : (
                    <View style={styles.navWrap}>
                        <View style={styles.nav} accessibilityRole="tablist">
                            <Animated.View pointerEvents="none" style={[styles.navStuck, webLiquidGlass, navStuck]} />
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
                            <Rise delay={0} style={styles.mast}>
                                <View style={styles.mastRow}>
                                    <Text style={styles.mastTitle}><Text style={styles.mastJuan}>{art.juan}  </Text>{art.title}</Text>
                                    <Text style={styles.mastCount}>{books.length} 部 · {formatChars(artChars)}</Text>
                                </View>
                                <Text style={styles.mastDesc}>{art.desc}</Text>
                            </Rise>
                            {deskBook ? (
                                <Rise delay={60}>
                                    <DeskCard book={deskBook.book} saved={deskBook.saved} styles={styles} />
                                </Rise>
                            ) : null}
                            {chunk(books, COLUMNS).map((row, r) => (
                                <View key={r} style={styles.leafRow}>
                                    {pad(row).map((book, k) => (book ? (
                                        <Rise key={book.id} delay={(deskBook ? 120 : 60) + (r * COLUMNS + k) * 45} style={styles.col}>
                                            <BookLeaf book={book} saved={reading?.books[book.id]} styles={styles} />
                                        </Rise>
                                    ) : <View key={k} style={styles.col} />))}
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
    const scale = useAnimatedStyle(() => ({ transform: [{ scale: withTiming(on && !reduce ? 1.12 : 1, { duration: 220, easing: EASE_OUT }) }] }), [on, reduce]);
    return (
        <PressableScale onPress={onPress} onLayout={onLayout} style={styles.navItem} scaleTo={0.92} accessibilityRole="tab" aria-selected={on} accessibilityLabel={label}>
            <Animated.Text style={[styles.navChar, on && styles.navCharOn, scale]}>{ch}</Animated.Text>
            <Text style={[styles.navCap, on && styles.navCapOn]}>{cap}</Text>
        </PressableScale>
    );
}

/**
 * 挂载时淡入上浮。不用 entering={riseIn()}：Reanimated 网页端 Keyframe 入场结束后会把元素改成绝对定位，
 * 行高塌掉，最后一排被底栏挡住；这里只动 opacity / translateY，元素始终在布局里
 */
function Rise({ delay, duration = 380, style, children }: { delay: number; duration?: number; style?: StyleProp<ViewStyle>; children: React.ReactNode }) {
    const reduce = useReducedMotion();
    const shown = useSharedValue(reduce ? 1 : 0);
    useEffect(() => {
        if (!reduce) shown.value = withDelay(delay, withTiming(1, { duration, easing: EASE_OUT }));
        // 只在挂载时播一次；换卷时外层按卷重挂载
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const motion = useAnimatedStyle(() => ({ opacity: shown.value, transform: [{ translateY: (1 - shown.value) * 8 }] }));
    return <Animated.View style={[style, motion]}>{children}</Animated.View>;
}

/** 按住时手指那一角往里按；减弱动态效果时不翘 */
function useLean() {
    const reduce = useReducedMotion();
    const rx = useSharedValue(0);
    const ry = useSharedValue(0);
    const size = useRef({ width: 1, height: 1 });
    const style = useAnimatedStyle(() => ({
        transform: [{ perspective: 760 }, { rotateX: `${rx.value}deg` }, { rotateY: `${ry.value}deg` }],
    }));
    const onLayout = (event: LayoutChangeEvent) => { size.current = event.nativeEvent.layout; };
    const onPressIn = (event: GestureResponderEvent) => {
        if (reduce) return;
        const x = clampUnit((event.nativeEvent.locationX / size.current.width) * 2 - 1);
        const y = clampUnit((event.nativeEvent.locationY / size.current.height) * 2 - 1);
        rx.value = withSpring(-y * LEAN, PRESS_SPRING);
        ry.value = withSpring(x * LEAN, PRESS_SPRING);
    };
    const onPressOut = () => {
        rx.value = withSpring(0, PRESS_SPRING);
        ry.value = withSpring(0, PRESS_SPRING);
    };
    return { style, onLayout, onPressIn, onPressOut };
}

type SavedBook = ReadingState['books'][string] | undefined;

/** 案头续读笺：仅在本卷存在在读记录时展示，宋刻语汇、细金进度线与方正续读签 */
function DeskCard({ book, saved, styles }: { book: ClassicBookMeta; saved: NonNullable<SavedBook>; styles: Styles }) {
    const lean = useLean();
    const progress = bookProgress(book, saved) ?? 0;
    const index = Math.max(0, book.chapters.findIndex((chapter) => chapter.id === saved.chapterId));
    const now = book.chapters[index] ?? book.chapters[0];
    const pct = Math.round(progress * 100);
    const pctWidth = Math.max(4, Math.min(100, pct));
    return (
        <Pressable
            onPress={() => router.push({ pathname: '/learn/reader', params: { book: book.id } })}
            onPressIn={lean.onPressIn}
            onPressOut={lean.onPressOut}
            onLayout={lean.onLayout}
            accessibilityRole="button"
            accessibilityLabel={`续读${book.title}，${bookByLine(book)}，第 ${index + 1} / ${book.chapters.length} 篇 ${now?.title ?? ''}，${pct}%`}
        >
            <Animated.View style={[styles.desk, lean.style]}>
                <View style={styles.deskSlip}>
                    <View style={styles.deskSlipIn}>
                        <Text style={styles.deskTitle} allowFontScaling={false}>{stack(book.title)}</Text>
                    </View>
                </View>
                <View style={styles.deskMain}>
                    <View style={styles.deskTop}>
                        <View style={styles.deskMark}>
                            <View style={styles.deskMarkDot} />
                            <Text style={styles.deskMarkText}>案头续读</Text>
                        </View>
                        <Text style={styles.deskStat}>{book.chapters.length} 篇 · {formatChars(book.charCount)}</Text>
                    </View>
                    <Text style={styles.deskBy}>{bookByLine(book)}</Text>
                    {now ? <Text style={styles.deskNowName} numberOfLines={1}>「{now.title}」</Text> : null}
                    <View style={styles.deskProgress}>
                        <View style={styles.deskTrack}>
                            <View style={[styles.deskFill, { width: `${pctWidth}%` }]} />
                        </View>
                        <View style={[styles.deskDot, { left: `${pctWidth}%`, marginLeft: pctWidth >= 98 ? -6 : -3 }]} />
                    </View>
                    <View style={styles.deskFoot}>
                        <Text style={styles.deskPct} numberOfLines={1}>第 {index + 1} / {book.chapters.length} 篇 · {pct}%</Text>
                        <View style={styles.deskAction}><Text style={styles.deskActionText}>续读 ›</Text></View>
                    </View>
                </View>
            </Animated.View>
        </Pressable>
    );
}

/** 宋刻扉页书叶：四周双边，界行分三栏，右书名、中首篇正文（在读改为金色「续·篇名」）、左作者落款与朝代印；叶脚篇数字数 */
function BookLeaf({ book, saved, styles }: { book: ClassicBookMeta; saved: SavedBook; styles: Styles }) {
    const lean = useLean();
    const progress = bookProgress(book, saved);
    const index = saved ? book.chapters.findIndex((chapter) => chapter.id === saved.chapterId) : -1;
    const chapter = index >= 0 ? book.chapters[index] : pickLeadChapter(book);
    const note = chapter ? formatLeafNote(index >= 0 ? `续·${chapter.title}` : chapter.title) : '';
    const seal = dynastySeal(book.dynasty);
    return (
        <Pressable
            onPress={() => router.push({ pathname: '/learn/reader', params: { book: book.id } })}
            onPressIn={lean.onPressIn}
            onPressOut={lean.onPressOut}
            onLayout={lean.onLayout}
            accessibilityRole="button"
            accessibilityLabel={`${book.title}，${bookByLine(book)}，${book.chapters.length} 篇${progress == null ? '' : `，读到 ${Math.round(progress * 100)}%`}`}
        >
            <Animated.View style={[styles.leaf, lean.style]}>
                <View style={styles.leafFrame}>
                    <View style={styles.leafFrameIn}>
                        <View style={styles.leafColTitle}>
                            <Text style={styles.leafTitle} allowFontScaling={false}>{stack(book.title)}</Text>
                        </View>
                        <View style={styles.leafColNote}>
                            <Text style={[styles.leafNote, index >= 0 && styles.leafNoteOn]} allowFontScaling={false}>{stack(note)}</Text>
                        </View>
                        <View style={styles.leafColBy}>
                            <Text style={styles.leafBy} allowFontScaling={false}>{stack(leafAuthor(book))}</Text>
                            <View style={[styles.seal, seal.length > 1 && styles.sealTall]}>
                                <Text style={styles.sealText} allowFontScaling={false}>{stack(seal)}</Text>
                            </View>
                        </View>
                    </View>
                </View>
                <View style={styles.leafFoot}>
                    {progress == null ? null : (
                        <View style={styles.leafTrack}><View style={[styles.leafFill, { width: `${Math.max(4, Math.round(progress * 100))}%` }]} /></View>
                    )}
                    <Text style={styles.leafFootText} numberOfLines={1}>{book.chapters.length} 篇 · {formatChars(book.charCount)}</Text>
                </View>
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
                            <Rise key={row.key} delay={Math.min(order++, 12) * 30} duration={320}>
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
                            </Rise>
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
function bookProgress(book: ClassicBookMeta, saved: SavedBook): number | null {
    if (!saved) return null;
    const index = book.chapters.findIndex((chapter) => chapter.id === saved.chapterId);
    return index < 0 ? null : Math.min(1, (index + saved.progress) / book.chapters.length);
}

/** 案头续读笺选书：仅在当前卷存在在读记录时返回（优先最近读的书），未读时不展示 */
function pickDeskBook(books: ClassicBookMeta[], reading: ReadingState | null): { book: ClassicBookMeta; saved: NonNullable<SavedBook> } | null {
    const read = (book: ClassicBookMeta) => bookProgress(book, reading?.books[book.id]) != null;
    const book = books.find((item) => item.id === reading?.lastBookId && read(item)) ?? books.find(read);
    if (!book) return null;
    const saved = reading?.books[book.id];
    return saved ? { book, saved } : null;
}

/** 未读时跳过纯序跋/凡例/目录等开篇，取第一篇正文；全部命中时回退第 0 篇 */
function pickLeadChapter(book: ClassicBookMeta) {
    return book.chapters.find((chapter) => !FRONT_MATTER_RE.test(chapter.title.trim())) ?? book.chapters[0];
}

function formatChars(count: number): string {
    return count >= 10000 ? `${Number((count / 10000).toFixed(1))} 万字` : `${count} 字`;
}

function bookByLine(book: ClassicBookMeta): string {
    const author = book.author.replace(' · ', '、');
    return author === '佚名' ? `${book.dynasty} · 佚名` : `${book.dynasty} · ${author} 撰`;
}

/** 书叶左栏竖排的落款：作者撰；多作者用居中中点隔开，避免竖排顿号偏左下 */
function leafAuthor(book: ClassicBookMeta): string {
    const author = book.author.replace(/\s*[·、]\s*/g, '·');
    if (author === '佚名') return '佚名';
    return book.dynasty.startsWith('旧题') ? `旧题${author}` : `${author}撰`;
}

/** 朝代印：去掉「旧题」，三个字以上取末字（南朝梁 → 梁） */
function dynastySeal(dynasty: string): string {
    const name = dynasty.replace('旧题', '');
    return name.length > 2 ? name.slice(-1) : name;
}

/** 竖排文本预处理：映射直排括号与破折号、空白转居中中点、合并连续中点并去首尾中点 */
function normalizeVertical(text: string): string {
    const mapped = Array.from(text.replace(/\s+/g, '·'), (ch) => VERTICAL_PUNCT[ch] ?? ch).join('');
    return mapped.replace(/·+/g, '·').replace(/^·+|·+$/g, '');
}

/** 中栏竖排篇名截取：先规范化再限长，避免末尾残留孤立中点或未闭合的开括号 */
function formatLeafNote(text: string): string {
    const chars = Array.from(normalizeVertical(text));
    if (chars.length <= LEAF_CHAPTER_CHARS) return chars.join('');
    const sliced = chars.slice(0, LEAF_CHAPTER_CHARS);
    // 若截断落在括号内部（有未闭合开括号），退回该开括号前，保证视觉完整
    let openAt = -1;
    let depth = 0;
    for (let i = 0; i < sliced.length; i++) {
        if (OPEN_VERTICAL_BRACKETS.has(sliced[i])) {
            if (depth === 0) openAt = i;
            depth++;
        } else if ('︶︺﹂﹄︼︾'.includes(sliced[i]) && depth > 0) {
            depth--;
            if (depth === 0) openAt = -1;
        }
    }
    const clean = depth > 0 && openAt > 0 ? sliced.slice(0, openAt) : sliced;
    while (clean.length > 1 && (clean[clean.length - 1] === '·' || clean[clean.length - 1] === '第' || OPEN_VERTICAL_BRACKETS.has(clean[clean.length - 1]))) {
        clean.pop();
    }
    return clean.join('');
}

/** RN 没有竖排：规范标点与中点后一字一行 */
function stack(text: string): string {
    return Array.from(normalizeVertical(text)).join('\n');
}

// 拿不到按下位置（部分平台的 locationX 为空）时按正中处理，不翘
function clampUnit(value: number): number {
    return Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
}

function chunk<T>(items: T[], size: number): T[][] {
    const rows: T[][] = [];
    for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
    return rows;
}

const pad = <T,>(row: T[]): Array<T | null> => [...row, ...Array(COLUMNS - row.length).fill(null)];

type Styles = ReturnType<typeof makeStyles>;

const makeStyles = (palette: ResultPalette, tones: LeafTones) => StyleSheet.create({
    container: { flex: 1, backgroundColor: 'transparent' },
    flex: { flex: 1, minWidth: 0 },
    pressed: { opacity: 0.7 },
    body: { flex: 1 },
    bodyContent: { paddingHorizontal: 16 },
    header: { minHeight: 74, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10, paddingTop: 20 },
    brand: { fontFamily: SERIF, fontSize: 30, lineHeight: 38, fontWeight: '500', letterSpacing: 6, color: palette.heading },
    brandSub: { fontSize: 11, lineHeight: 16, letterSpacing: 1, color: palette.muted, fontVariant: ['tabular-nums'] },
    searchBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: tones.line, backgroundColor: tones.leaf },
    searchField: {
        flex: 1, minWidth: 0, height: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 14,
        borderRadius: 22, borderWidth: 1, borderColor: tones.line, backgroundColor: tones.leaf,
    },
    searchInput: { flex: 1, minWidth: 0, height: '100%', fontSize: 15, color: palette.heading, paddingVertical: 0 },
    clearBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    cancelBtn: { height: 44, justifyContent: 'center', paddingHorizontal: 4 },
    cancel: { fontSize: 14, color: tones.goldInk },
    quick: { marginTop: 14, marginBottom: 8, flexDirection: 'row' },
    quickItem: { flex: 1, minWidth: 0, height: 62, alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12 },
    quickBadge: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: tones.line, backgroundColor: tones.leaf },
    quickGlyph: { fontFamily: SERIF, fontSize: 16, lineHeight: 20, fontWeight: '700', color: palette.gold },
    // 直接压在经幡上的字只用正文色
    quickTitle: { fontSize: 11.5, lineHeight: 15, color: palette.body },
    navWrap: {},
    nav: { height: NAV_HEIGHT, flexDirection: 'row', borderRadius: 16, borderWidth: 1, borderColor: tones.line, backgroundColor: tones.leaf },
    navStuck: {
        position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: 15, backgroundColor: tones.leafHi,
        shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: palette.isLight ? 0.1 : 0.36, shadowRadius: 12, elevation: 6,
    },
    navItem: { flex: 1, minWidth: 0, height: '100%', alignItems: 'center', justifyContent: 'center', gap: 1 },
    navChar: { fontFamily: SERIF, fontSize: 21, lineHeight: 27, fontWeight: '700', color: palette.body },
    navCharOn: { color: palette.heading },
    navCap: { fontSize: 11, lineHeight: 15, color: palette.muted },
    navCapOn: { color: palette.gold },
    navIndicator: { position: 'absolute', left: 0, bottom: 5, width: 16, height: 3, borderRadius: 1.5, backgroundColor: palette.vermilion },
    mast: { marginTop: 18 },
    mastRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
    mastJuan: { fontSize: 13, fontWeight: '500', letterSpacing: 2 },
    mastTitle: { flexShrink: 1, fontFamily: SERIF, fontSize: 20, lineHeight: 28, fontWeight: '700', letterSpacing: 2, color: palette.heading },
    mastCount: { fontSize: 12, lineHeight: 18, color: palette.body, fontVariant: ['tabular-nums'] },
    mastDesc: { marginTop: 2, fontSize: 12.5, lineHeight: 18, color: palette.body },
    desk: { marginTop: 14, flexDirection: 'row', gap: 14, padding: 14, borderRadius: 6, borderWidth: 1, borderColor: tones.frame, backgroundColor: tones.leafHi },
    deskSlip: { width: 58, padding: 3, borderWidth: 1, borderColor: tones.frame },
    deskSlipIn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderWidth: 1, borderColor: tones.frame },
    deskTitle: { fontFamily: SERIF, fontSize: 23, lineHeight: 28, fontWeight: '700', textAlign: 'center', color: palette.heading },
    deskMain: { flex: 1, minWidth: 0, justifyContent: 'space-between' },
    deskTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    deskMark: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    deskMarkDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: tones.seal },
    deskMarkText: { fontFamily: SERIF, fontSize: 12, lineHeight: 16, letterSpacing: 1.5, fontWeight: '600', color: palette.gold },
    deskStat: { flexShrink: 1, fontSize: 12, lineHeight: 16, color: palette.muted, fontVariant: ['tabular-nums'] },
    deskBy: { marginTop: 6, fontSize: 12.5, lineHeight: 18, color: palette.body },
    deskNowName: { marginTop: 8, fontFamily: SERIF, fontSize: 17, lineHeight: 24, fontWeight: '700', color: palette.heading },
    deskProgress: { marginTop: 14, height: 8, justifyContent: 'center' },
    deskTrack: { height: 2, borderRadius: 1, overflow: 'hidden', backgroundColor: tones.track },
    deskFill: { height: '100%', backgroundColor: palette.gold },
    deskDot: { position: 'absolute', top: 1, width: 6, height: 6, marginLeft: -3, borderRadius: 3, backgroundColor: tones.seal },
    deskFoot: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    deskPct: { flexShrink: 1, fontSize: 12.5, lineHeight: 18, color: palette.muted, fontVariant: ['tabular-nums'] },
    deskAction: {
        minHeight: 36, paddingHorizontal: 14, borderRadius: 6, justifyContent: 'center', alignItems: 'center',
        borderWidth: 1, borderColor: tones.frame, backgroundColor: palette.goldSoft,
    },
    deskActionText: { fontFamily: SERIF, fontSize: 13.5, lineHeight: 18, fontWeight: '600', letterSpacing: 1, color: tones.goldInk },
    leafRow: { marginTop: 12, flexDirection: 'row', gap: 12 },
    col: { flex: 1, minWidth: 0 },
    leaf: { height: 248, paddingTop: 8, paddingHorizontal: 8, borderRadius: 4, backgroundColor: tones.leaf },
    leafFrame: { flex: 1, padding: 3, borderWidth: 1, borderColor: tones.frame },
    leafFrameIn: { flex: 1, flexDirection: 'row-reverse', borderWidth: 1, borderColor: tones.frame },
    leafColTitle: { flex: 1.5, alignItems: 'center', paddingVertical: 14 },
    leafTitle: { fontFamily: SERIF, fontSize: 19, lineHeight: 24, fontWeight: '700', textAlign: 'center', color: palette.heading },
    leafColNote: { flex: 1, alignItems: 'center', paddingVertical: 14, overflow: 'hidden', borderLeftWidth: 1, borderRightWidth: 1, borderColor: tones.rule },
    leafNote: { fontSize: 11.5, lineHeight: 14, textAlign: 'center', color: palette.muted },
    leafNoteOn: { color: palette.gold },
    leafColBy: { flex: 1, alignItems: 'center', justifyContent: 'space-between', paddingTop: 14, paddingBottom: 8 },
    leafBy: { fontSize: 12, lineHeight: 14, textAlign: 'center', color: palette.body },
    seal: { width: 22, height: 22, borderRadius: 3, alignItems: 'center', justifyContent: 'center', backgroundColor: tones.seal },
    sealTall: { height: 38 },
    sealText: { fontFamily: SERIF, fontSize: 12.5, lineHeight: 14, fontWeight: '700', textAlign: 'center', color: palette.sealText },
    leafFoot: { height: 32, alignItems: 'center', justifyContent: 'center' },
    leafTrack: { position: 'absolute', top: 6, left: 0, right: 0, height: 2, borderRadius: 1, overflow: 'hidden', backgroundColor: tones.track },
    leafFill: { height: '100%', backgroundColor: palette.gold },
    leafFootText: { paddingTop: 6, fontSize: 11, lineHeight: 15, color: palette.muted, fontVariant: ['tabular-nums'] },
    results: { marginTop: 22 },
    resultsHint: { marginBottom: 10, fontSize: 12, lineHeight: 16, color: palette.body },
    suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    suggestion: { height: 44, paddingHorizontal: 18, borderRadius: 22, justifyContent: 'center', borderWidth: 1, borderColor: tones.line, backgroundColor: tones.leaf },
    suggestionText: { fontFamily: SERIF, fontSize: 15, fontWeight: '700', color: palette.body },
    empty: { paddingVertical: 28, textAlign: 'center', fontSize: 13, lineHeight: 20, color: palette.body },
    resultGroup: { marginBottom: 22 },
    resultGroupHead: { marginBottom: 10, fontSize: 12, lineHeight: 20, color: palette.body },
    resultGroupGlyph: { fontFamily: SERIF, fontSize: 15, fontWeight: '700', color: palette.heading },
    resultList: { borderRadius: 16, borderWidth: 1, borderColor: tones.line, backgroundColor: tones.leaf, overflow: 'hidden' },
    resultRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 14 },
    resultRule: { borderTopWidth: 1, borderTopColor: tones.rule },
    badge: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: tones.line },
    badgeText: { fontFamily: SERIF, fontSize: 16, lineHeight: 20, fontWeight: '700', color: palette.gold },
    resultTitle: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: palette.heading },
    resultHit: { color: palette.gold },
    resultMeta: { fontSize: 11.5, lineHeight: 16, color: palette.muted },
});
