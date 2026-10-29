/**
 * 典籍阅读：宋体正文、字号三档、底部目录、上一篇 / 下一篇；读到的篇和位置存本机，再打开这部书时接着读。
 * 目录随包内置，正文打开时才读入。
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import SheetModal from '../../src/components/SheetModal';
import { FlatList, Platform, Pressable, ScrollView, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import StatusBarDecor from '../../src/components/StatusBarDecor';
import { BackIcon, ChevronRightIcon } from '../../src/components/Icons';
import { getClassicBookMeta, loadClassicChapters, type ClassicChapter } from '../../src/data/classics';
import { loadReadingState, saveReadingState, type ReadingState } from '../../src/services/reading-progress';
import { buildResultPalette, type ResultPalette } from '../../src/theme/result-palette';
import { useTheme } from '../../src/theme/ThemeContext';

const SERIF = Platform.select({ ios: 'Songti SC', android: 'serif', default: 'serif' });
const SIZES = [{ size: 16, lineHeight: 30, label: '小' }, { size: 18, lineHeight: 34, label: '中' }, { size: 20, lineHeight: 38, label: '大' }];
const TOC_ROW = 44;

export default function ReaderPage() {
    const { Colors } = useTheme();
    const insets = useSafeAreaInsets();
    const palette = useMemo(() => buildResultPalette(Colors), [Colors]);
    const styles = useMemo(() => makeStyles(palette), [palette]);
    const params = useLocalSearchParams<{ book?: string; chapter?: string }>();
    const book = useMemo(() => getClassicBookMeta(params.book || ''), [params.book]);
    const [texts, setTexts] = useState<ClassicChapter[] | null>(null);
    const [loadFailed, setLoadFailed] = useState(false);
    const [chapterId, setChapterId] = useState<string | null>(null);
    const [fontSize, setFontSize] = useState(1);
    const [tocOpen, setTocOpen] = useState(false);
    const stateRef = useRef<ReadingState | null>(null);
    const scrollRef = useRef<ScrollView>(null);
    const restoreRef = useRef(0);
    const viewHeight = useRef(0);

    useEffect(() => {
        if (!book) return;
        let alive = true;
        setTexts(null);
        setLoadFailed(false);
        loadClassicChapters(book.id)
            .then((chapters) => { if (alive) setTexts(chapters); })
            .catch(() => { if (alive) setLoadFailed(true); });
        return () => { alive = false; };
    }, [book]);

    // 读入进度：没指定篇就接着上次读到的篇，同一篇恢复到上次位置
    useEffect(() => {
        if (!book) return;
        loadReadingState().then((state) => {
            stateRef.current = state;
            setFontSize(state.fontSize);
            const saved = state.books[book.id];
            const target = params.chapter || saved?.chapterId || book.chapters[0]?.id || null;
            restoreRef.current = saved && saved.chapterId === target ? saved.progress : 0;
            setChapterId(target);
        });
    }, [book, params.chapter]);

    const index = book && chapterId ? book.chapters.findIndex((item) => item.id === chapterId) : -1;
    const chapter = index >= 0 ? texts?.[index] : undefined;
    const paragraphs = useMemo(() => (chapter ? chapter.text.split('\n').filter(Boolean) : []), [chapter]);
    const progressRef = useRef(0);
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    const save = (progress: number, nextFont = fontSize) => {
        clearTimeout(saveTimerRef.current);
        if (!book || !chapter || !stateRef.current) return;
        const next: ReadingState = {
            ...stateRef.current,
            lastBookId: book.id,
            fontSize: nextFont,
            books: { ...stateRef.current.books, [book.id]: { chapterId: chapter.id, progress } },
        };
        stateRef.current = next;
        saveReadingState(next);
    };
    const saveRef = useRef(save);
    saveRef.current = save;

    // 换篇时记下「读到这一篇」；离开页面时记下读到的位置
    useEffect(() => {
        progressRef.current = restoreRef.current;
        if (chapter && stateRef.current) save(restoreRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [chapter?.id]);
    useEffect(() => {
        const flush = () => saveRef.current(progressRef.current);
        if (Platform.OS === 'web') window.addEventListener('pagehide', flush);
        return () => {
            if (Platform.OS === 'web') window.removeEventListener('pagehide', flush);
            flush();
        };
    }, []);

    // Web 没有拖动结束事件，停滚后合并保存；刷新或换篇时立即保存。
    const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
        const room = contentSize.height - layoutMeasurement.height;
        progressRef.current = room > 0 ? Math.min(1, Math.max(0, contentOffset.y / room)) : 1;
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => saveRef.current(progressRef.current), 250);
    };
    const onScrollEnd = () => save(progressRef.current);

    // 恢复上次位置：视口高度和正文高度都量到后按比例滚过去，只做一次
    const contentHeight = useRef(0);
    const tryRestore = () => {
        const room = contentHeight.current - viewHeight.current;
        if (restoreRef.current <= 0 || viewHeight.current <= 0 || room <= 0) return;
        const y = restoreRef.current * room;
        restoreRef.current = 0;
        setTimeout(() => scrollRef.current?.scrollTo({ y, animated: false }), 0);
    };

    const openChapter = (target: number) => {
        if (!book || target < 0 || target >= book.chapters.length) return;
        save(progressRef.current);
        restoreRef.current = 0;
        setTocOpen(false);
        setChapterId(book.chapters[target].id);
        scrollRef.current?.scrollTo({ y: 0, animated: false });
    };

    const cycleFont = () => {
        const next = (fontSize + 1) % SIZES.length;
        setFontSize(next);
        save(progressRef.current, next);
    };

    if (!book || !chapter) {
        return (
            <View style={styles.container}>
                <StatusBarDecor />
                <View style={styles.topBar}>
                    <Pressable onPress={() => router.back()} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="返回">
                        <BackIcon size={22} color={palette.ink} />
                    </Pressable>
                    {book ? <Text style={styles.bookTitle} numberOfLines={1}>{book.title}</Text> : null}
                    {book ? <View style={styles.iconBtn} /> : null}
                </View>
                <Text style={styles.missing}>{!book ? '没有找到这本书' : loadFailed ? '这部书没能打开，返回后再试一次' : '正在展开…'}</Text>
            </View>
        );
    }

    const prev = index > 0 ? book.chapters[index - 1].title : '';
    const next = index < book.chapters.length - 1 ? book.chapters[index + 1].title : '';
    const font = SIZES[fontSize] || SIZES[1];

    return (
        <View style={styles.container}>
            <StatusBarDecor />
            <View style={styles.topBar}>
                <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="返回">
                    <BackIcon size={22} color={palette.ink} />
                </Pressable>
                <Text style={styles.bookTitle} numberOfLines={1}>{book.title}</Text>
                <Pressable onPress={cycleFont} style={({ pressed }) => [styles.iconBtn, styles.fontBtn, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`字号：${font.label}，点按切换`}>
                    <Text style={styles.fontSmall}>A</Text>
                    <Text style={styles.fontBig}>a</Text>
                </Pressable>
                <Pressable onPress={() => setTocOpen(true)} style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="目录">
                    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                        <Path d="M8 6h12M8 12h12M8 18h12" stroke={palette.ink} strokeWidth={1.8} strokeLinecap="round" />
                        <Circle cx={4} cy={6} r={1.2} fill={palette.ink} />
                        <Circle cx={4} cy={12} r={1.2} fill={palette.ink} />
                        <Circle cx={4} cy={18} r={1.2} fill={palette.ink} />
                    </Svg>
                </Pressable>
            </View>

            <ScrollView
                ref={scrollRef}
                style={styles.flex}
                contentContainerStyle={styles.page}
                onLayout={(event) => { viewHeight.current = event.nativeEvent.layout.height; tryRestore(); }}
                onContentSizeChange={(_, height) => { contentHeight.current = height; tryRestore(); }}
                onScroll={onScroll}
                onScrollEndDrag={onScrollEnd}
                onMomentumScrollEnd={onScrollEnd}
                scrollEventThrottle={64}
            >
                <Text style={styles.chapterMeta}>{book.dynasty} · {book.author} · 第 {index + 1} 篇 / {book.chapters.length}{chapter.volume ? ` · ${chapter.volume}` : ''}</Text>
                <Text style={styles.chapterTitle}>{chapter.title}</Text>
                <View style={styles.ornament}>
                    <View style={styles.ornamentLine} />
                    <View style={styles.ornamentDiamond} />
                    <View style={styles.ornamentLine} />
                </View>
                {paragraphs.map((paragraph, i) => (
                    <Text key={i} style={[styles.paragraph, { fontSize: font.size, lineHeight: font.lineHeight }]}>{'　　'}{paragraph}</Text>
                ))}
            </ScrollView>

            <View style={[styles.pager, { paddingBottom: Math.max(insets.bottom, 8) }]}>
                <Pressable disabled={!prev} onPress={() => openChapter(index - 1)} style={({ pressed }) => [styles.pageBtn, !prev && styles.hidden, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`上一篇 ${prev}`}>
                    <View style={styles.flip}><ChevronRightIcon size={16} color={palette.body} /></View>
                    <Text style={styles.pageBtnText} numberOfLines={1}>{prev}</Text>
                </Pressable>
                <View style={styles.pagerMid}>
                    <Text style={styles.pagerCount}>{index + 1} / {book.chapters.length} 篇</Text>
                    <View style={styles.bar}><View style={[styles.barFill, { width: `${((index + 1) / book.chapters.length) * 100}%` }]} /></View>
                </View>
                <Pressable disabled={!next} onPress={() => openChapter(index + 1)} style={({ pressed }) => [styles.pageBtn, styles.pageBtnRight, !next && styles.hidden, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`下一篇 ${next}`}>
                    <Text style={styles.pageBtnText} numberOfLines={1}>{next}</Text>
                    <ChevronRightIcon size={16} color={palette.body} />
                </Pressable>
            </View>

            <SheetModal visible={tocOpen} onRequestClose={() => setTocOpen(false)}>
                <View style={styles.sheetWrap}>
                    <Pressable style={styles.backdrop} onPress={() => setTocOpen(false)} accessibilityRole="button" accessibilityLabel="关闭目录" />
                    <View style={[styles.sheet, { paddingBottom: insets.bottom }]}>
                        <View style={styles.grabber} />
                        <View style={styles.sheetHead}>
                            <Text style={styles.sheetTitle}>目录</Text>
                            <Text style={styles.sheetMeta}>{book.chapters.length} 篇 · 约 {(book.charCount / 10000).toFixed(1)} 万字</Text>
                        </View>
                        <Text style={styles.sheetSource}>底本：{book.source.kind}{book.source.note ? ` · ${book.source.note}` : ''}</Text>
                        <FlatList
                            data={book.chapters}
                            keyExtractor={(item) => item.id}
                            initialScrollIndex={Math.max(0, index - 3)}
                            getItemLayout={(_, i) => ({ length: TOC_ROW, offset: TOC_ROW * i, index: i })}
                            contentContainerStyle={styles.tocList}
                            renderItem={({ item, index: i }) => {
                                const on = i === index;
                                return (
                                    <Pressable onPress={() => openChapter(i)} style={({ pressed }) => [styles.tocRow, on && styles.tocRowOn, pressed && styles.pressed]} accessibilityRole="button" accessibilityState={{ selected: on }}>
                                        <Text style={styles.tocNo}>{i + 1}</Text>
                                        <Text style={[styles.tocTitle, on && styles.tocTitleOn]} numberOfLines={1}>{item.title}</Text>
                                        {item.volume ? <Text style={styles.tocVolume} numberOfLines={1}>{item.volume}</Text> : null}
                                        {on ? <View style={styles.tocTag}><Text style={styles.tocTagText}>在读</Text></View> : null}
                                        <Text style={styles.tocChars}>{item.charCount} 字</Text>
                                    </Pressable>
                                );
                            }}
                        />
                    </View>
                </View>
            </SheetModal>
        </View>
    );
}

const makeStyles = (palette: ResultPalette) => StyleSheet.create({
    container: { flex: 1, backgroundColor: 'transparent' },
    flex: { flex: 1 },
    pressed: { opacity: 0.7 },
    hidden: { opacity: 0 },
    topBar: {
        height: 48, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4,
        backgroundColor: palette.card, borderBottomWidth: 1, borderBottomColor: palette.hairline,
    },
    iconBtn: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
    bookTitle: { flex: 1, textAlign: 'center', fontFamily: SERIF, fontSize: 16, fontWeight: '700', letterSpacing: 2, color: palette.heading },
    fontBtn: { flexDirection: 'row', alignItems: 'baseline', paddingTop: 10 },
    fontSmall: { fontFamily: SERIF, fontSize: 12, color: palette.ink },
    fontBig: { fontFamily: SERIF, fontSize: 17, fontWeight: '700', color: palette.ink },
    missing: { padding: 24, textAlign: 'center', fontSize: 14, color: palette.muted },
    page: { paddingHorizontal: 22, paddingTop: 22, paddingBottom: 32 },
    chapterMeta: { fontSize: 12, lineHeight: 16, letterSpacing: 1, color: palette.muted, textAlign: 'center' },
    chapterTitle: { marginTop: 8, fontFamily: SERIF, fontSize: 25, lineHeight: 34, fontWeight: '700', letterSpacing: 3, color: palette.heading, textAlign: 'center' },
    ornament: { width: 160, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, marginBottom: 20 },
    ornamentLine: { flex: 1, height: 1, backgroundColor: palette.rule },
    ornamentDiamond: { width: 6, height: 6, backgroundColor: palette.vermilion, transform: [{ rotate: '45deg' }] },
    paragraph: { marginBottom: 16, fontFamily: SERIF, letterSpacing: 0.5, color: palette.isLight ? '#3a3127' : '#E6E0D2', textAlign: 'justify' },
    pager: {
        flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 8, paddingHorizontal: 12,
        backgroundColor: palette.card, borderTopWidth: 1, borderTopColor: palette.hairline,
    },
    pageBtn: { width: 104, height: 44, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 4 },
    pageBtnRight: { justifyContent: 'flex-end' },
    pageBtnText: { flexShrink: 1, fontSize: 13, color: palette.body },
    flip: { transform: [{ rotate: '180deg' }] },
    pagerMid: { flex: 1, alignItems: 'center', gap: 5 },
    pagerCount: { fontSize: 12, lineHeight: 16, color: palette.muted, fontVariant: ['tabular-nums'] },
    bar: { alignSelf: 'stretch', height: 3, borderRadius: 2, backgroundColor: palette.barTrack, overflow: 'hidden' },
    barFill: { height: '100%', backgroundColor: palette.gold },
    sheetWrap: { flex: 1, justifyContent: 'flex-end' },
    backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
    sheet: { height: '68%', borderTopLeftRadius: 20, borderTopRightRadius: 20, backgroundColor: palette.card, borderTopWidth: 1, borderColor: palette.cardBorder },
    grabber: { width: 36, height: 4, marginTop: 8, alignSelf: 'center', borderRadius: 2, backgroundColor: palette.rule },
    sheetHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 12, paddingBottom: 10 },
    sheetTitle: { fontFamily: SERIF, fontSize: 17, lineHeight: 24, fontWeight: '700', color: palette.heading },
    sheetMeta: { fontSize: 12, color: palette.muted },
    sheetSource: { marginTop: -4, marginBottom: 8, paddingHorizontal: 18, fontSize: 11.5, lineHeight: 16, color: palette.muted },
    tocList: { paddingHorizontal: 12, paddingBottom: 24 },
    tocRow: { height: TOC_ROW, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8, borderRadius: 10 },
    tocRowOn: { backgroundColor: palette.goldSoft },
    tocNo: { width: 22, fontSize: 12, color: palette.muted, textAlign: 'right', fontVariant: ['tabular-nums'] },
    tocTitle: { flexShrink: 1, fontSize: 14.5, color: palette.ink },
    tocTitleOn: { fontWeight: '700', color: palette.gold },
    tocVolume: { fontSize: 11, color: palette.muted },
    tocTag: { paddingHorizontal: 5, borderRadius: 4, backgroundColor: palette.goldSoft },
    tocTagText: { fontSize: 10.5, lineHeight: 15, color: palette.gold },
    tocChars: { marginLeft: 'auto', fontSize: 11.5, color: palette.muted, fontVariant: ['tabular-nums'] },
});
