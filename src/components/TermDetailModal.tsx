/**
 * 术语精解弹窗：排盘页点术语时原地弹出，不离开盘面。
 * 顶栏（类目小签、宋体主标题、副标题、本盘位置）与底栏（书阁原典入口）固定，正文滚动；
 * 点 ×、点遮罩、网页端 Esc、安卓返回键都能关。翻原典时先收弹窗，再以查典模式打开书阁。
 *
 * 用法：页面外层包 <TermDetailProvider>，单元格用 <TermPress entry={…} context="本盘 · 年柱天干 甲">。
 */
import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type Insets, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { router } from 'expo-router';
import DialogModal from './DialogModal';
import PressableScale from './PressableScale';
import { ChevronRightIcon, CloseIcon } from './Icons';
import { getClassicBookMeta } from '../data/classics';
import { SEASON_ORDER, STAGE_ORDER, STAGE_RANK, type GlossaryClassicBookLink, type GlossaryEntry, type GlossaryItemTone } from '../core/glossary';
import { toRgba } from '../theme/bazi-theme';
import { buildResultPalette, type ResultPalette } from '../theme/result-palette';
import { useTheme } from '../theme/ThemeContext';

const SERIF = Platform.select({ ios: 'Songti SC', android: 'serif', default: 'serif' });
/** 收起动画 140ms 走完再跳书阁，免得两层转场叠在一起 */
const CLOSE_BEFORE_NAVIGATE_MS = 160;

interface OpenState {
    entry: GlossaryEntry;
    context?: string;
}

interface TermDetailApi {
    open: (entry: GlossaryEntry, context?: string) => void;
    palette: ResultPalette;
}

const TermDetailContext = createContext<TermDetailApi | null>(null);

export function useTermDetail(): TermDetailApi | null {
    return useContext(TermDetailContext);
}

export function TermDetailProvider({ children }: { children: React.ReactNode }) {
    const { Colors } = useTheme();
    const palette = useMemo(() => buildResultPalette(Colors), [Colors]);
    const [state, setState] = useState<OpenState | null>(null);
    const [visible, setVisible] = useState(false);
    const navigateTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    const open = useCallback((entry: GlossaryEntry, context?: string) => {
        setState({ entry, context });
        setVisible(true);
    }, []);
    const close = useCallback(() => setVisible(false), []);
    const openBook = useCallback((link: GlossaryClassicBookLink, quote: string | undefined, from: string) => {
        setVisible(false);
        clearTimeout(navigateTimer.current);
        navigateTimer.current = setTimeout(() => {
            router.push({
                pathname: '/learn/reader',
                params: { book: link.bookId, chapter: link.chapterId, preview: '1', from, ...(quote ? { q: quote } : {}) },
            });
        }, CLOSE_BEFORE_NAVIGATE_MS);
    }, []);

    const api = useMemo(() => ({ open, palette }), [open, palette]);
    return (
        <TermDetailContext.Provider value={api}>
            {children}
            <TermDetailModal state={state} visible={visible} onClose={close} onOpenBook={openBook} palette={palette} />
        </TermDetailContext.Provider>
    );
}

/**
 * 盘面上的可点术语：不改单元格尺寸，只在按下时给文字铺一层淡金圆角底，网页端悬停淡一档。
 * 没有词条或页面外层没有 Provider 时，原样渲染。
 */
export function TermPress({ entry, context, style, innerStyle, hitSlop = 4, children }: {
    entry: GlossaryEntry | null | undefined;
    context?: string;
    style?: StyleProp<ViewStyle>;
    /** 淡金底那一层的排版，如多个子元素横排时传 { flexDirection: 'row', alignItems: 'center' } */
    innerStyle?: StyleProp<ViewStyle>;
    hitSlop?: number | Insets;
    children: React.ReactNode;
}) {
    const api = useTermDetail();
    if (!entry || !api) return <View style={style}>{innerStyle ? <View style={innerStyle}>{children}</View> : children}</View>;
    const { palette } = api;
    return (
        <Pressable
            style={style}
            onPress={() => api.open(entry, context)}
            accessibilityRole="button"
            accessibilityHint={`查看「${entry.title}」释义`}
            hitSlop={hitSlop}
        >
            {(state) => {
                const hovered = (state as { hovered?: boolean }).hovered;
                const background = state.pressed ? palette.goldSoft : hovered ? toRgba(palette.gold, 0.07) : undefined;
                return <View style={[pressStyles.pill, innerStyle, background ? { backgroundColor: background } : null]}>{children}</View>;
            }}
        </Pressable>
    );
}

/** 句子里的可点术语（嵌在 Text 里）：没有底色，只换手型；没有词条时原样输出 */
export function TermInline({ entry, context, style, children }: {
    entry: GlossaryEntry | null | undefined;
    context?: string;
    style?: StyleProp<TextStyle>;
    children: React.ReactNode;
}) {
    const api = useTermDetail();
    if (!entry || !api) return <Text style={style}>{children}</Text>;
    return (
        <Text style={style} onPress={() => api.open(entry, context)} suppressHighlighting accessibilityRole="button" accessibilityHint={`查看「${entry.title}」释义`}>
            {children}
        </Text>
    );
}

const pressStyles = StyleSheet.create({
    pill: { borderRadius: 6, paddingHorizontal: 4, marginHorizontal: -4 },
});

/* ---------------------------------------------------------------- */

/** 四句以上、句句等长的五言七言，按诗诀分行 */
function asVerse(text: string): string[] | null {
    const parts = text.match(/[^，；。！？]+[，；。！？]?/g) ?? [];
    const cores = parts.map((part) => part.replace(/[，；。！？]/g, ''));
    const size = cores[0]?.length ?? 0;
    return parts.length >= 4 && (size === 5 || size === 7) && cores.every((core) => core.length === size) ? parts : null;
}

/** 《三命通会·论天乙贵人》→ 书名《三命通会》、篇名「论天乙贵人」 */
function splitSource(source: string): { title: string; chapter: string; isBook: boolean } {
    const match = source.match(/^《([^·》]+)(?:·([^》]+))?》(.*)$/);
    if (!match) return { title: source, chapter: '', isBook: false };
    const chapter = [match[2], match[3]].filter(Boolean).join(' · ');
    return { title: `《${match[1]}》`, chapter, isBook: !source.includes('口诀') };
}

const toneColor = (palette: ResultPalette, tone?: GlossaryItemTone): string => {
    if (tone === 'favorable') return palette.positive;
    if (tone === 'unfavorable') return palette.negative;
    return palette.heading;
};

function TermDetailModal({ state, visible, onClose, onOpenBook, palette }: {
    state: OpenState | null;
    visible: boolean;
    onClose: () => void;
    onOpenBook: (link: GlossaryClassicBookLink, quote: string | undefined, from: string) => void;
    palette: ResultPalette;
}) {
    const { width, height } = useWindowDimensions();
    const styles = useMemo(() => makeStyles(palette), [palette]);
    const entry = state?.entry;

    const links = useMemo(() => {
        if (!entry) return [];
        // 有引文出自这一章的排前面，同章去重，最多两条
        const quoteOf = new Map<string, string>();
        entry.citations.forEach((citation) => {
            const id = citation.bookLink?.chapterId;
            if (id && !quoteOf.has(id)) quoteOf.set(id, citation.original.split('……')[0]);
        });
        const seen = new Set<string>();
        return entry.bookLinks
            .map((link, index) => ({ link, index, quote: quoteOf.get(link.chapterId) }))
            .sort((a, b) => Number(Boolean(b.quote)) - Number(Boolean(a.quote)) || a.index - b.index)
            .filter(({ link }) => (seen.has(link.chapterId) ? false : (seen.add(link.chapterId), true)))
            .slice(0, 2);
    }, [entry]);

    const unpunctuated = useMemo(() => {
        if (!entry) return [];
        const titles = new Set<string>();
        entry.citations.forEach((citation) => {
            const link = citation.bookLink;
            if (link && getClassicBookMeta(link.bookId)?.source.kind === '殆知阁') titles.add(link.bookTitle);
        });
        return [...titles];
    }, [entry]);

    if (!entry) return null;
    const isStage = entry.category === 'bazi-changsheng';
    const hasSource = links.some((item) => item.quote);

    return (
        <DialogModal visible={visible} onRequestClose={onClose}>
            <View style={styles.center}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="关闭释义" />
                <View
                    style={[styles.card, { width: Math.min(width - 32, 440), maxHeight: Math.round(height * 0.78) }]}
                    accessibilityViewIsModal
                    aria-modal
                >
                    <View style={styles.header}>
                        <Text style={styles.tag}>{entry.categoryLabel}</Text>
                        <Text style={styles.title} accessibilityRole="header">{entry.title}</Text>
                        {entry.subtitle ? <Text style={styles.subtitle}>{entry.subtitle}</Text> : null}
                        {state?.context ? <Text style={styles.contextChip}>{state.context}</Text> : null}
                        <PressableScale onPress={onClose} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel="关闭">
                            <CloseIcon size={18} color={palette.muted} />
                        </PressableScale>
                    </View>

                    <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
                        <Text style={styles.summary}>{entry.summary}</Text>

                        {entry.focusHint ? (
                            <View style={styles.facts}>
                                <View style={styles.factRow}>
                                    <Text style={styles.factKey}>要点</Text>
                                    <Text style={styles.factValue}>{entry.focusHint}</Text>
                                </View>
                            </View>
                        ) : null}

                        {isStage ? <StageStrip current={entry.title} palette={palette} styles={styles} /> : null}
                        {entry.category === 'wuxing-season' ? <SeasonStrip current={entry.title} palette={palette} styles={styles} /> : null}

                        {entry.blocks.map((block) => (
                            <View key={block.heading} style={styles.section}>
                                <SectionHeading text={block.heading} styles={styles} />
                                {(block.paragraphs ?? []).map((paragraph) => {
                                    const verse = asVerse(paragraph);
                                    return verse
                                        ? <VerseBox key={paragraph} lines={verse} styles={styles} />
                                        : <Text key={paragraph} style={styles.paragraph}>{paragraph}</Text>;
                                })}
                                {(block.items ?? []).map((item) => (
                                    item.label.length <= 3 ? (
                                        <View key={item.label + item.content} style={styles.itemInline}>
                                            <Text style={[styles.itemLabel, { color: toneColor(palette, item.tone) }]}>{item.label}</Text>
                                            <Text style={[styles.paragraph, styles.flex]}>{item.content}</Text>
                                        </View>
                                    ) : (
                                        <View key={item.label + item.content}>
                                            <Text style={[styles.itemLabelStacked, { color: toneColor(palette, item.tone) }]}>{item.label}</Text>
                                            <Text style={styles.paragraph}>{item.content}</Text>
                                        </View>
                                    )
                                ))}
                            </View>
                        ))}

                        {entry.citations.length > 0 ? (
                            <View style={[styles.section, styles.citeSection]}>
                                <SectionHeading text="古籍引证" styles={styles} />
                                {entry.citations.map((citation, index) => {
                                    const source = splitSource(citation.source);
                                    const verse = asVerse(citation.original);
                                    const kind = verse ? (source.isBook ? '诗诀' : '口诀') : (source.isBook ? '原文' : '口诀');
                                    return (
                                        <View key={`${citation.source}-${index}`} style={styles.cite}>
                                            <View style={styles.citeHead}>
                                                <Text style={styles.citeBook}>{source.title}</Text>
                                                {source.chapter ? <Text style={styles.citeChapter}>{source.chapter}</Text> : null}
                                            </View>
                                            <Text style={styles.kind}>{kind}</Text>
                                            {verse
                                                ? <VerseBox lines={verse} styles={styles} />
                                                : <Text style={styles.original} selectable>{citation.original}</Text>}
                                            {citation.translation ? (
                                                <>
                                                    <Text style={styles.kind}>今译</Text>
                                                    <Text style={styles.paragraph}>{citation.translation}</Text>
                                                </>
                                            ) : null}
                                        </View>
                                    );
                                })}
                            </View>
                        ) : null}

                        <Text style={styles.note}>
                            {unpunctuated.length > 0 ? `${unpunctuated.map((t) => `《${t}》`).join('')}书阁底本无标点，标点为本应用所加；` : ''}
                            今译与精评为本应用所写。
                        </Text>
                    </ScrollView>

                    <View style={styles.footer}>
                        <Text style={styles.footTitle}>{hasSource || links.length === 0 ? '书阁原典' : '延伸阅读'}</Text>
                        {links.length > 0 ? links.map(({ link, quote }) => (
                            <PressableScale
                                key={link.chapterId}
                                onPress={() => onOpenBook(link, quote, entry.title)}
                                style={styles.linkRow}
                                scaleTo={0.985}
                                accessibilityRole="link"
                                accessibilityLabel={`翻阅《${link.bookTitle}·${link.label ?? link.chapterTitle}》`}
                            >
                                <Text style={styles.linkText} numberOfLines={1}>《{link.bookTitle}》· {link.label ?? link.chapterTitle}</Text>
                                <Text style={styles.linkAction}>{quote ? '翻阅原典' : '延伸阅读'}</Text>
                                <ChevronRightIcon size={14} color={palette.gold} />
                            </PressableScale>
                        )) : (
                            <Text style={styles.noLink}>书阁暂未收录此条专篇</Text>
                        )}
                    </View>
                </View>
            </View>
        </DialogModal>
    );
}

type Styles = ReturnType<typeof makeStyles>;

const SectionHeading: React.FC<{ text: string; styles: Styles }> = ({ text, styles }) => (
    <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{text}</Text>
        <View style={styles.sectionRule} />
    </View>
);

const VerseBox: React.FC<{ lines: string[]; styles: Styles }> = ({ lines, styles }) => (
    <View style={styles.verseBox}>
        {lines.map((line, index) => <Text key={`${line}-${index}`} style={styles.verseLine} selectable>{line}</Text>)}
    </View>
);

/** 十二长生：按《三命通会》四贵、四平、四忌着色，当前一位加金边 */
const StageStrip: React.FC<{ current: string; palette: ResultPalette; styles: Styles }> = ({ current, palette, styles }) => {
    const chip = (name: string) => {
        const rank = STAGE_RANK[name];
        const color = rank === '四贵' ? palette.gold : rank === '四忌' ? palette.negative : palette.muted;
        const background = rank === '四贵' ? palette.goldSoft : rank === '四忌' ? palette.negativeSoft : palette.chipBg;
        const on = name === current;
        return (
            <View key={name} style={[styles.stageChip, { backgroundColor: background }, on && { borderColor: palette.gold }]}>
                <Text style={[styles.stageText, { color }, on && styles.stageTextOn]}>{name}</Text>
            </View>
        );
    };
    return (
        <View style={styles.stageWrap}>
            <View style={styles.stageRow}>{STAGE_ORDER.slice(0, 6).map(chip)}</View>
            <View style={styles.stageRow}>{STAGE_ORDER.slice(6).map(chip)}</View>
            <View style={styles.legend}>
                {[['四贵', palette.gold], ['四平', palette.muted], ['四忌', palette.negative]].map(([label, color]) => (
                    <View key={label} style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: color }]} />
                        <Text style={styles.legendText}>{label}</Text>
                    </View>
                ))}
            </View>
        </View>
    );
};

/** 旺相休囚死：得令两等着金色，失令两等着红，当前一位加金边 */
const SeasonStrip: React.FC<{ current: string; palette: ResultPalette; styles: Styles }> = ({ current, palette, styles }) => (
    <View style={styles.stageWrap}>
        <View style={styles.stageRow}>
            {SEASON_ORDER.map((name, index) => {
                const color = index < 2 ? palette.gold : index > 2 ? palette.negative : palette.muted;
                const background = index < 2 ? palette.goldSoft : index > 2 ? palette.negativeSoft : palette.chipBg;
                const on = name === current;
                return (
                    <View key={name} style={[styles.stageChip, { backgroundColor: background }, on && { borderColor: palette.gold }]}>
                        <Text style={[styles.stageText, { color }, on && styles.stageTextOn]}>{name}</Text>
                    </View>
                );
            })}
        </View>
    </View>
);

const makeStyles = (palette: ResultPalette) => StyleSheet.create({
    flex: { flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
    card: {
        overflow: 'hidden',
        borderRadius: 18,
        borderWidth: 1,
        borderColor: palette.cardBorder,
        backgroundColor: palette.card,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 18 },
        shadowOpacity: palette.isLight ? 0.18 : 0.5,
        shadowRadius: 30,
        elevation: 12,
    },
    header: {
        alignItems: 'center',
        paddingTop: 16,
        paddingBottom: 12,
        paddingHorizontal: 52,
        borderBottomWidth: 1,
        borderBottomColor: palette.hairline,
    },
    tag: { fontSize: 11, lineHeight: 16, letterSpacing: 3, paddingLeft: 3, color: palette.gold },
    title: { marginTop: 2, fontFamily: SERIF, fontSize: 23, lineHeight: 31, fontWeight: '700', letterSpacing: 3, paddingLeft: 3, color: palette.heading, textAlign: 'center' },
    subtitle: { marginTop: 2, fontSize: 12, lineHeight: 18, color: palette.muted, textAlign: 'center' },
    contextChip: {
        marginTop: 8,
        paddingHorizontal: 10,
        paddingVertical: 1,
        borderRadius: 10,
        overflow: 'hidden',
        fontSize: 11.5,
        lineHeight: 18,
        color: palette.chipInk,
        backgroundColor: palette.chipBg,
    },
    closeBtn: { position: 'absolute', top: 6, right: 6, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    body: { flexGrow: 0, flexShrink: 1 },
    bodyContent: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 18, gap: 18 },
    summary: { fontSize: 15, lineHeight: 25, color: palette.ink, textAlign: 'justify' },
    facts: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: palette.hairline },
    factRow: { flexDirection: 'row', gap: 12, paddingVertical: 8 },
    factKey: { width: 30, fontSize: 12, lineHeight: 20, color: palette.muted },
    factValue: { flex: 1, fontSize: 13.5, lineHeight: 20, color: palette.body },
    section: { gap: 8 },
    citeSection: { gap: 14 },
    sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    sectionTitle: { fontSize: 12, lineHeight: 18, fontWeight: '600', letterSpacing: 2, color: palette.gold },
    sectionRule: { flex: 1, height: 1, backgroundColor: palette.hairline },
    paragraph: { fontSize: 13.5, lineHeight: 22, color: palette.body, textAlign: 'justify' },
    itemInline: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
    itemLabel: { minWidth: 30, fontSize: 12, lineHeight: 22, fontWeight: '600' },
    itemLabelStacked: { fontSize: 12, lineHeight: 19, fontWeight: '600' },
    verseBox: { alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, backgroundColor: palette.quoteBg },
    verseLine: { fontFamily: SERIF, fontSize: 15.5, lineHeight: 28, letterSpacing: 1, color: palette.ink },
    cite: { gap: 6 },
    citeHead: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 4 },
    citeBook: { fontFamily: SERIF, fontSize: 15, lineHeight: 22, fontWeight: '700', color: palette.heading },
    citeChapter: { fontSize: 12, lineHeight: 18, color: palette.muted },
    kind: { marginTop: 2, fontSize: 11, lineHeight: 16, letterSpacing: 2, color: palette.muted },
    original: {
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 10,
        overflow: 'hidden',
        fontFamily: SERIF,
        fontSize: 15.5,
        lineHeight: 27,
        color: palette.ink,
        backgroundColor: palette.quoteBg,
        textAlign: 'justify',
    },
    note: { fontSize: 11.5, lineHeight: 17, color: palette.muted },
    stageWrap: { gap: 6 },
    stageRow: { flexDirection: 'row', gap: 6 },
    stageChip: { flex: 1, height: 30, borderRadius: 8, borderWidth: 1.5, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
    stageText: { fontSize: 13, fontWeight: '500' },
    stageTextOn: { fontWeight: '700' },
    legend: { flexDirection: 'row', gap: 14, marginTop: 2 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    legendDot: { width: 8, height: 8, borderRadius: 2 },
    legendText: { fontSize: 11.5, lineHeight: 17, color: palette.muted },
    footer: { paddingTop: 8, paddingBottom: 10, paddingHorizontal: 10, borderTopWidth: 1, borderTopColor: palette.hairline },
    footTitle: { paddingHorizontal: 8, paddingVertical: 2, fontSize: 11, lineHeight: 16, letterSpacing: 2, color: palette.muted },
    linkRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, borderRadius: 10 },
    linkText: { flex: 1, fontFamily: SERIF, fontSize: 14.5, lineHeight: 20, color: palette.ink },
    linkAction: { fontSize: 13, lineHeight: 20, color: palette.gold },
    noLink: { minHeight: 36, paddingHorizontal: 8, paddingTop: 8, fontSize: 13, color: palette.muted },
});
