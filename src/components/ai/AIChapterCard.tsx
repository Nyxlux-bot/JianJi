import React, { createContext, memo, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import InkDots from './InkDots';
import Markdown from 'react-native-markdown-display';
import { parseChapter, type ChapterSegment, type EventSegment, type YearSegment } from '../../ai/layout/parse-chapter';
import { reflowLongParagraphs } from '../../ai/layout/reflow';
import { AI_VERIFICATION_MARK_LABELS, type AIVerificationMark, type AIVerificationMarkEntry } from '../../core/ai-verification-marks';
import type { AIMarkdownStyles, AIPageStyles } from './ai-page-styles';
import type { Chapter, ChapterItem, ChapterMessage, ChapterStatus } from './derive-chapters';

export interface ChapterYearMeta {
    ganZhi?: string;
    /** e.g. "26岁 · 大运 乙酉" */
    meta?: string;
}

export interface AIChapterCardProps<M extends ChapterMessage> {
    chapter: Chapter<M>;
    styles: AIPageStyles;
    markdownStyles: AIMarkdownStyles;
    Colors: any;
    /** Display text for an assistant message (kinship JSON → prose, display cleanup). */
    getDisplayContent: (message: M) => string;
    yearMeta?: (year: number) => ChapterYearMeta | undefined;
    /** Extra app-computed panel for a year in 卷三 (五行占比 / 流年四化). */
    renderYearPanel?: (year: number) => React.ReactNode;
    marks?: Record<string, AIVerificationMarkEntry>;
    onMark?: (year: number, summary: string, mark: AIVerificationMark | null) => void;
    /** Next step / progress / failure block, shown inside the latest chapter. */
    footer?: React.ReactNode;
    onLayout?: (y: number) => void;
    /** Lets a chapter that just started be scrolled to the top of the screen. */
    minHeight?: number;
}

const SEAL_LABEL: Record<ChapterStatus, string> = { todo: '未开始', running: '生成中', done: '已完成', failed: '未写完' };

function Seal({ status, styles, Colors }: { status: ChapterStatus; styles: AIPageStyles; Colors: any }) {
    const color = status === 'done' ? Colors.accent.jade : status === 'running' ? Colors.accent.gold : status === 'failed' ? Colors.accent.red : Colors.text.secondary;
    return <Text style={[styles.seal, { color, borderColor: color }]}>{SEAL_LABEL[status]}</Text>;
}

/** 核验、五年卷每次推送都整卷重解析；文字没变的段落别跟着重排 Markdown */
const Md = memo(function Md({ children, markdownStyles }: { children: string; markdownStyles: AIMarkdownStyles }) {
    const text = useMemo(() => reflowLongParagraphs(children), [children]);
    return text.trim() ? <Markdown style={markdownStyles}>{text}</Markdown> : null;
});

const REVEAL_FRAME_MS = 33;
const REVEAL_MIN_CPS = 40;
/** 积压的字约这么久吐完：推送 250ms 一批，吐字略慢于推送，屏上就一直在匀速出字而不是一批批跳出来 */
const REVEAL_CATCH_UP_S = 0.35;
/** 每个字从透明到实的时长：末尾总有一小段由实到虚的墨晕，没有任何东西整块冒出来 */
const FADE_MS = 280;

/** 不占显示位置的字：粗体星号、标题井号和它后面的空格、换行 */
function isMarkup(text: string, index: number): boolean {
    const ch = text[index];
    return ch === '*' || ch === '#' || ch === '\n' || ch === '\r' || (ch === ' ' && text[index - 1] === '#');
}

function visibleLength(text: string): number {
    let count = 0;
    for (let i = 0; i < text.length; i += 1) if (!isMarkup(text, i)) count += 1;
    return count;
}

/**
 * 生成中按帧匀速吐字：推送攒下的一批字不一次性贴上去，而是约 30 帧/秒地往外放，
 * 积压越多放得越快，始终追得上。每个字记下出现的时刻，tail 是末尾还在淡入的字从后往前的不透明度。
 * 打开时已写好的部分直接显示；写完时没放完的字一次补齐，同样淡入。
 */
function useRevealedText(text: string, streaming: boolean): { text: string; tail: number[] } {
    const [, setFrame] = useState(0);
    const shownRef = useRef(text.length);
    const atRef = useRef<number[]>([]);
    const lastAtRef = useRef(0);
    const targetRef = useRef(text.length);
    targetRef.current = text.length;
    // 重新生成时文本会变短
    if (shownRef.current > text.length) shownRef.current = text.length;
    const reveal = (to: number, now: number) => {
        for (let i = shownRef.current; i < to; i += 1) atRef.current[i] = now;
        shownRef.current = to;
        lastAtRef.current = now;
    };
    if (!streaming && shownRef.current < text.length) reveal(text.length, Date.now());
    useEffect(() => {
        const busy = () => shownRef.current < targetRef.current || Date.now() - lastAtRef.current < FADE_MS;
        if (!busy()) return;
        let frame = 0;
        let last = Date.now();
        const tick = () => {
            const now = Date.now();
            const elapsed = now - last;
            if (elapsed >= REVEAL_FRAME_MS) {
                const backlog = targetRef.current - shownRef.current;
                if (backlog > 0) {
                    const step = Math.max(1, Math.round(Math.max(REVEAL_MIN_CPS, backlog / REVEAL_CATCH_UP_S) * elapsed / 1000));
                    reveal(Math.min(targetRef.current, shownRef.current + step), now);
                }
                setFrame((n) => n + 1);
                last = now;
            }
            if (busy()) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [text.length, streaming]);
    const shown = shownRef.current;
    const now = Date.now();
    const tail: number[] = [];
    if (now - lastAtRef.current < FADE_MS) {
        for (let i = shown - 1; i >= 0; i -= 1) {
            if (isMarkup(text, i)) continue;
            const age = now - (atRef.current[i] ?? 0);
            if (age >= FADE_MS) break;
            tail.push(1 - Math.pow(1 - age / FADE_MS, 3));
        }
    }
    return { text: shown >= text.length ? text : closeOpenMarkup(text.slice(0, shown)), tail };
}

/** 吐到一半的标记先收好：半个「**」、只有井号的标题行不露出来，未闭合的粗体临时补上结尾 */
function closeOpenMarkup(slice: string): string {
    let text = slice.endsWith('*') && !slice.endsWith('**') ? slice.slice(0, -1) : slice;
    const lineStart = text.lastIndexOf('\n') + 1;
    const line = text.slice(lineStart);
    if (/^\s*#{1,6}\s*$/.test(line)) return text.slice(0, lineStart);
    if ((line.match(/\*\*/g)?.length ?? 0) % 2) text += '**';
    return text;
}

/** 按空行切成段落块；代码块里的空行不切 */
function splitBlocks(text: string): string[] {
    const blocks: string[] = [];
    let current: string[] = [];
    let inFence = false;
    for (const line of text.split('\n')) {
        if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
        if (!inFence && !line.trim()) {
            if (current.length) blocks.push(current.join('\n'));
            current = [];
            continue;
        }
        current.push(line);
    }
    if (current.length) blocks.push(current.join('\n'));
    return blocks;
}

/** 已写完的段落文字不变，不随末段每次推送重新解析 */
const MdBlock = memo(function MdBlock({ text, markdownStyles }: { text: string; markdownStyles: AIMarkdownStyles }) {
    return <Markdown style={markdownStyles}>{text}</Markdown>;
});

/** 末尾还在淡入的字从后往前的不透明度，由 AssistantBody 提供给写在最后的那段 */
const TailContext = createContext<number[]>([]);

const TEXT_KEYS = ['color', 'fontSize', 'lineHeight', 'fontWeight', 'fontFamily', 'fontStyle', 'letterSpacing', 'textAlign'];
/** 和 Markdown 库一样：文字属性给 Text，边距这类给外面的 View */
function splitStyle(style: Record<string, any> | undefined): { text: Record<string, any>; view: Record<string, any> } {
    const text: Record<string, any> = {};
    const view: Record<string, any> = {};
    Object.entries(style ?? {}).forEach(([key, value]) => { (TEXT_KEYS.includes(key) ? text : view)[key] = value; });
    return { text, view };
}

function withAlpha(color: string, alpha: number): string {
    if (alpha >= 1) return color;
    const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color)?.[1];
    if (hex) {
        const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
        const n = parseInt(full, 16);
        return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
    }
    const rgb = /^rgba?\(([^,]+),([^,]+),([^,)]+)/.exec(color);
    return rgb ? `rgba(${rgb[1]},${rgb[2]},${rgb[3]},${alpha})` : alpha < 0.5 ? 'transparent' : color;
}

type Run = { text: string; strong: boolean };
type Part = { level: number; runs: Run[] };
/** 列表、引用、表格、代码、链接交还给 Markdown 库，不做淡入 */
const NOT_SIMPLE = /^\s*(?:[-*+]\s|\d+[.)、]\s|>|\||```|~~~)|`|\]\(/m;

/** 只认标题、段落和粗体：AI 正文几乎都是这几样 */
function parseSimple(block: string): Part[] | null {
    if (NOT_SIMPLE.test(block)) return null;
    const parts: Part[] = [];
    let para: string[] = [];
    const runs = (text: string) => text.split('**').map((piece, index) => ({ text: piece, strong: index % 2 === 1 })).filter((run) => run.text);
    const flush = () => { if (para.length) parts.push({ level: 0, runs: runs(para.join('\n')) }); para = []; };
    for (const line of block.split('\n')) {
        const heading = /^\s*(#{1,6})\s+(.*)$/.exec(line);
        if (heading) {
            flush();
            parts.push({ level: Math.min(4, heading[1].length), runs: runs(heading[2]) });
        } else {
            para.push(line);
        }
    }
    flush();
    return parts;
}

/** 正在写的段落：版式与 Markdown 库渲染的一致，末尾的字按不透明度上色 */
function FadeBlock({ text, alphas, markdownStyles }: { text: string; alphas: number[]; markdownStyles: AIMarkdownStyles }) {
    const parts = useMemo(() => parseSimple(text), [text]);
    if (!parts) return <MdBlock text={text} markdownStyles={markdownStyles} />;
    const styles = markdownStyles as Record<string, any>;
    const body = splitStyle(styles.body);
    let remaining = parts.reduce((sum, part) => sum + part.runs.reduce((count, run) => count + visibleLength(run.text), 0), 0);
    return (
        <View style={body.view}>
            {parts.map((part, partIndex) => {
                const box = splitStyle(part.level ? styles[`heading${part.level}`] : styles.paragraph);
                const textStyle = { ...body.text, ...box.text };
                const spans: React.ReactNode[] = [];
                part.runs.forEach((run, runIndex) => {
                    const color = run.strong && !part.level ? styles.strong?.color ?? textStyle.color : textStyle.color;
                    const weight = run.strong && !part.level ? styles.strong?.fontWeight : undefined;
                    let piece = '';
                    let pieceAlpha = -1;
                    const push = () => {
                        if (piece) spans.push(<Text key={`${runIndex}-${spans.length}`} style={{ color: withAlpha(color, pieceAlpha), fontWeight: weight }}>{piece}</Text>);
                        piece = '';
                    };
                    for (let i = 0; i < run.text.length; i += 1) {
                        let alpha = pieceAlpha < 0 ? 1 : pieceAlpha;
                        if (!isMarkup(run.text, i)) {
                            remaining -= 1;
                            alpha = remaining < alphas.length ? Math.round(alphas[remaining] * 20) / 20 : 1;
                        }
                        if (alpha !== pieceAlpha) { push(); pieceAlpha = alpha; }
                        piece += run.text[i];
                    }
                    push();
                });
                return <View key={partIndex} style={box.view}><Text style={textStyle}>{spans}</Text></View>;
            })}
        </View>
    );
}

/** 按段渲染：写完的段落缓存不重排；末尾正在淡入的一两段交给 FadeBlock */
function TailBlocks({ text, markdownStyles, tail }: { text: string; markdownStyles: AIMarkdownStyles; tail: number[] }) {
    const blocks = useMemo(() => splitBlocks(reflowLongParagraphs(text)), [text]);
    const fading: Array<number[] | null> = blocks.map(() => null);
    let offset = 0;
    for (let i = blocks.length - 1; i >= 0 && offset < tail.length; i -= 1) {
        const length = visibleLength(blocks[i]);
        fading[i] = tail.slice(offset, offset + length);
        offset += length;
    }
    return (
        <View>
            {blocks.map((block, index) => {
                const alphas = fading[index];
                return alphas ? <FadeBlock key={index} text={block} alphas={alphas} markdownStyles={markdownStyles} />
                    : <MdBlock key={index} text={block} markdownStyles={markdownStyles} />;
            })}
        </View>
    );
}

/** 结构化卷（核验、五年、合盘）里写在最后的那段 Markdown：淡入时按段渲染，淡完回到整段 */
function FadeMd({ children, markdownStyles }: { children: string; markdownStyles: AIMarkdownStyles }) {
    const tail = useContext(TailContext);
    return tail.length ? <TailBlocks text={children} markdownStyles={markdownStyles} tail={tail} /> : <Md markdownStyles={markdownStyles}>{children}</Md>;
}

/**
 * 流式正文：每段各自渲染，写完的段落不跟着重排；末尾的字逐个淡入，不再整段上浮。
 * 从没流式过的消息按整篇渲染。
 */
function StreamMd({ children, markdownStyles, streaming }: { children: string; markdownStyles: AIMarkdownStyles; streaming: boolean }) {
    const tail = useContext(TailContext);
    const streamed = useRef(streaming);
    if (streaming) streamed.current = true;
    if (!streamed.current) return <Md markdownStyles={markdownStyles}>{children}</Md>;
    return <TailBlocks text={children} markdownStyles={markdownStyles} tail={tail} />;
}

const MARK_ORDER: AIVerificationMark[] = ['yes', 'no', 'unsure'];
const FIELD_LABELS = { basis: '命理依据', luck: '对应运限', detail: '推演说明' } as const;

function EventCard({ event, first, last, styles, markdownStyles, Colors, yearMeta, mark, onMark }: {
    event: EventSegment; first: boolean; last: boolean; styles: AIPageStyles; markdownStyles: AIMarkdownStyles; Colors: any;
    yearMeta?: ChapterYearMeta; mark?: AIVerificationMark; onMark?: (mark: AIVerificationMark | null) => void;
}) {
    const [open, setOpen] = useState(false);
    const fieldKeys = (Object.keys(FIELD_LABELS) as Array<keyof typeof FIELD_LABELS>).filter((key) => event.fields[key]?.trim());
    // 正在写的这一条，写在最后的那段（补充说明，没有就是最后一个字段）跟着淡入
    const tailKey = last ? (event.extra ? 'extra' : fieldKeys[fieldKeys.length - 1]) : null;
    const bodyFor = (key: string) => (key === tailKey ? FadeMd : Md);
    const ExtraMd = bodyFor('extra');
    // Without labelled fields there is nothing to fold: show the text as written.
    const foldable = fieldKeys.length > 0;
    const ganZhi = yearMeta?.ganZhi ?? event.ganZhi;
    const meta = yearMeta?.meta ?? event.age;
    const markColor = mark === 'yes' ? Colors.accent.jade : mark === 'no' ? Colors.accent.red : Colors.text.secondary;
    return (
        <View style={[styles.event, first && styles.eventFirst]}>
            <View style={styles.eventHead}>
                <Text style={styles.eventYear}>{event.year}{ganZhi ? ` ${ganZhi}` : ''}</Text>
                {meta ? <Text style={styles.eventMeta}>{meta}</Text> : null}
                {mark ? <Text style={[styles.eventMarkBadge, { color: markColor, borderColor: markColor, borderWidth: 1 }]}>{AI_VERIFICATION_MARK_LABELS[mark]}</Text> : null}
            </View>
            {event.summary ? <Text style={styles.eventSummary}>{event.summary}</Text> : null}
            {foldable && open ? (
                <View style={[styles.eventBody, { marginTop: 8 }]}>
                    {fieldKeys.map((key) => {
                        const Body = bodyFor(key);
                        return (
                            <View key={key}>
                                <Text style={styles.fieldLabel}>{FIELD_LABELS[key]}</Text>
                                <Body markdownStyles={markdownStyles}>{event.fields[key] ?? ''}</Body>
                            </View>
                        );
                    })}
                    {event.extra ? <ExtraMd markdownStyles={markdownStyles}>{event.extra}</ExtraMd> : null}
                </View>
            ) : null}
            {!foldable ? <ExtraMd markdownStyles={markdownStyles}>{event.extra}</ExtraMd> : null}
            {(foldable || onMark) && !event.open ? (
                <View style={styles.eventActions}>
                    {foldable ? (
                        <TouchableOpacity style={styles.eventToggle} onPress={() => setOpen(!open)}
                            accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={`${event.year} 年推演依据`}>
                            <Text style={styles.eventToggleText}>{open ? '收起 ⌃' : '依据 ⌄'}</Text>
                        </TouchableOpacity>
                    ) : <View />}
                    {onMark ? (
                        <View style={styles.marks} accessibilityRole="radiogroup" accessibilityLabel={`${event.year} 年是否准确`}>
                            {MARK_ORDER.map((value) => {
                                const on = mark === value;
                                const color = value === 'yes' ? Colors.accent.jade : value === 'no' ? Colors.accent.red : Colors.text.primary;
                                return (
                                    <TouchableOpacity key={value} style={[styles.markBtn, on && { borderColor: color }]}
                                        accessibilityRole="radio" accessibilityState={{ checked: on }}
                                        onPress={() => onMark(on ? null : value)}>
                                        <Text style={[styles.markBtnText, on && { color, fontWeight: '600' }]}>{AI_VERIFICATION_MARK_LABELS[value]}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    ) : null}
                </View>
            ) : null}
        </View>
    );
}

function VerificationView<M extends ChapterMessage>({ content, streaming, props }: { content: string; streaming: boolean; props: AIChapterCardProps<M> }) {
    const layout = useMemo(() => parseChapter('verification', content, !streaming), [content, streaming]);
    let eventIndex = 0;
    const hasEvents = layout.blockCount > 0;
    return (
        <View>
            {hasEvents && !streaming && props.onMark ? (
                <Text style={props.styles.intro}>以下是待你核对的过去节点。点“依据”看推演过程，也可以逐条标记准不准，重新核验时会参考你的标记。</Text>
            ) : null}
            {layout.segments.map((segment, index) => {
                const last = index === layout.segments.length - 1;
                if (segment.type !== 'event') {
                    const Body = last ? FadeMd : Md;
                    return <Body key={index} markdownStyles={props.markdownStyles}>{segmentText(segment)}</Body>;
                }
                const first = eventIndex === 0;
                eventIndex += 1;
                return (
                    <EventCard key={`${segment.year}-${index}`} event={segment} first={first} last={last} styles={props.styles} markdownStyles={props.markdownStyles}
                        Colors={props.Colors} yearMeta={props.yearMeta?.(segment.year)} mark={props.marks?.[String(segment.year)]?.mark}
                        onMark={props.onMark && !streaming ? (mark) => props.onMark?.(segment.year, segment.summary, mark) : undefined} />
                );
            })}
        </View>
    );
}

/** Models often write a longer label than asked; the bead shows its first clause, the panel title the whole. */
function shortTag(tag: string): string {
    return tag.split(/[，,；;、]/u)[0].trim();
}

function segmentText(segment: ChapterSegment): string {
    return segment.type === 'markdown' ? segment.text : segment.raw;
}

function FiveYearView<M extends ChapterMessage>({ content, streaming, props }: { content: string; streaming: boolean; props: AIChapterCardProps<M> }) {
    const layout = useMemo(() => parseChapter('five_year', content, !streaming), [content, streaming]);
    const years = layout.segments.filter((segment): segment is YearSegment => segment.type === 'year');
    const [picked, setPicked] = useState<number | null>(null);
    const fallback = streaming ? years[years.length - 1]?.year : years[0]?.year;
    const selectedYear = picked !== null && years.some((item) => item.year === picked) ? picked : fallback;
    const selected = years.find((item) => item.year === selectedYear);
    const { styles, markdownStyles } = props;
    const leading = [] as ChapterSegment[];
    const trailing = [] as ChapterSegment[];
    let seenYear = false;
    layout.segments.forEach((segment) => {
        if (segment.type === 'year') { seenYear = true; return; }
        (seenYear ? trailing : leading).push(segment);
    });
    // 正在写的是哪段：总策略之后的、最后一年（且正看着它）、或年份之前的总纲
    const tailAt = trailing.length ? 'trailing' : years.length ? 'year' : 'leading';
    const LeadMd = (index: number) => (tailAt === 'leading' && index === leading.length - 1 ? FadeMd : Md);
    const YearMd = tailAt === 'year' && selected === years[years.length - 1] ? FadeMd : Md;
    const TrailMd = (index: number) => (tailAt === 'trailing' && index === trailing.length - 1 ? FadeMd : Md);
    return (
        <View>
            {leading.map((segment, index) => {
                const Body = LeadMd(index);
                return <Body key={`l${index}`} markdownStyles={markdownStyles}>{segmentText(segment)}</Body>;
            })}
            {years.length > 0 ? (
                <>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.beads}
                        accessibilityRole="tablist" accessibilityLabel="选择年份">
                        {years.map((item) => {
                            const on = item.year === selectedYear;
                            const meta = props.yearMeta?.(item.year);
                            return (
                                <TouchableOpacity key={item.year} style={[styles.bead, on && styles.beadOn]} onPress={() => setPicked(item.year)}
                                    accessibilityRole="tab" accessibilityState={{ selected: on }}>
                                    <Text style={[styles.beadYear, on && styles.beadYearOn]}>{item.year}</Text>
                                    <Text style={styles.beadTag} numberOfLines={1}>{[meta?.ganZhi ?? item.ganZhi, shortTag(item.tag)].filter(Boolean).join(' · ')}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                    {selected ? (
                        <View>
                            {props.renderYearPanel?.(selected.year)}
                            <Text style={[styles.yearTitle, { marginTop: 8 }]}>
                                {[`${selected.year}`, props.yearMeta?.(selected.year)?.ganZhi ?? selected.ganZhi, selected.tag].filter(Boolean).join(' · ')}
                            </Text>
                            <YearMd markdownStyles={markdownStyles}>{selected.body}</YearMd>
                        </View>
                    ) : null}
                </>
            ) : null}
            {trailing.map((segment, index) => {
                const Body = TrailMd(index);
                return segment.type === 'strategy' ? (
                    <View key={`t${index}`} style={styles.strategy}>
                        <Text style={styles.yearTitle}>{segment.title}</Text>
                        <Body markdownStyles={markdownStyles}>{segment.body}</Body>
                    </View>
                ) : <Body key={`t${index}`} markdownStyles={markdownStyles}>{segmentText(segment)}</Body>;
            })}
        </View>
    );
}

function CompatView<M extends ChapterMessage>({ content, streaming, props }: { content: string; streaming: boolean; props: AIChapterCardProps<M> }) {
    const layout = useMemo(() => parseChapter('compat', content, !streaming), [content, streaming]);
    const { styles, markdownStyles } = props;
    let sectionIndex = 0;
    return (
        <View>
            {layout.segments.map((segment, index) => {
                const Body = index === layout.segments.length - 1 ? FadeMd : Md;
                if (segment.type !== 'section') return <Body key={index} markdownStyles={markdownStyles}>{segmentText(segment)}</Body>;
                const first = sectionIndex === 0;
                sectionIndex += 1;
                return (
                    <View key={index} style={[styles.section, first && styles.sectionFirst]}>
                        <Text style={styles.sectionTitle}>{segment.title}</Text>
                        {segment.lead ? <Text style={styles.sectionLead}>{segment.lead}</Text> : null}
                        <Body markdownStyles={markdownStyles}>{segment.body}</Body>
                    </View>
                );
            })}
        </View>
    );
}

/** Drop a leading "# 基础定局"-style heading that repeats the card's own title. */
function stripRepeatedTitle(content: string, titles: string[]): string {
    const match = /^\s*#{1,2}\s+(.+)\n+/u.exec(content);
    if (!match) return content;
    const heading = match[1].replace(/[#*_\s]/g, '');
    return titles.some((title) => heading.includes(title)) ? content.slice(match[0].length) : content;
}

function AssistantBody<M extends ChapterMessage>({ item, props }: { item: ChapterItem<M>; props: AIChapterCardProps<M> }) {
    const streaming = Boolean(item.streaming);
    const { text: content, tail } = useRevealedText(
        stripRepeatedTitle(props.getDisplayContent(item.message), [props.chapter.title, props.chapter.short, '基础定局', '基础命盘', '前事核验']),
        streaming,
    );
    return <TailContext.Provider value={tail}>{renderBody(item, props, content, streaming)}</TailContext.Provider>;
}

function renderBody<M extends ChapterMessage>(item: ChapterItem<M>, props: AIChapterCardProps<M>, content: string, streaming: boolean) {
    const id = props.chapter.id;
    if (item.stage === 'kinship' || item.stage === 'kinship_review') {
        return (
            <View style={props.styles.kinBox}>
                <Text style={props.styles.kinLabel}>六亲初验</Text>
                <StreamMd markdownStyles={props.markdownStyles} streaming={streaming}>{content}</StreamMd>
            </View>
        );
    }
    if (id === 'verification') return <VerificationView content={content} streaming={streaming} props={props} />;
    if (id === 'five_year') return <FiveYearView content={content} streaming={streaming} props={props} />;
    if (id === 'compat') return <CompatView content={content} streaming={streaming} props={props} />;
    return <StreamMd markdownStyles={props.markdownStyles} streaming={streaming}>{content}</StreamMd>;
}

function Superseded<M extends ChapterMessage>({ item, props }: { item: ChapterItem<M>; props: AIChapterCardProps<M> }) {
    const [open, setOpen] = useState(false);
    return (
        <View style={props.styles.supersededBox}>
            <TouchableOpacity style={props.styles.foldBtn} onPress={() => setOpen(!open)} accessibilityRole="button" accessibilityState={{ expanded: open }}>
                <Text style={props.styles.foldText}>{open ? '收起上一版核验 ⌃' : '上一版核验（已重新生成） ⌄'}</Text>
            </TouchableOpacity>
            {open ? <Md markdownStyles={props.markdownStyles}>{props.getDisplayContent(item.message)}</Md> : null}
        </View>
    );
}

function AIChapterCardInner<M extends ChapterMessage>(props: AIChapterCardProps<M>) {
    const { chapter, styles, Colors } = props;
    return (
        <View style={[styles.chap, props.minHeight ? { minHeight: props.minHeight } : null]} onLayout={(event) => props.onLayout?.(event.nativeEvent.layout.y)}
            accessibilityLabel={`${chapter.no} ${chapter.title}`}>
            <View style={styles.chapHead}>
                <Text style={styles.chapNo}>{chapter.no}</Text>
                <Text style={styles.chapName}>{chapter.title}</Text>
                <Seal status={chapter.status} styles={styles} Colors={Colors} />
            </View>
            {chapter.items.map((item) => {
                if (item.message.role === 'user') {
                    return (
                        <View key={item.message.uiId} style={styles.question}>
                            <Text style={styles.questionText}>{item.message.content}</Text>
                        </View>
                    );
                }
                if (item.superseded) return <Superseded key={item.message.uiId} item={item} props={props} />;
                return (
                    <View key={item.message.uiId}>
                        <AssistantBody item={item} props={props} />
                        {item.streaming ? (
                            <View style={styles.cursorLine}>
                                <InkDots color={Colors.text.primary} />
                                <Text style={styles.cursorText}>正在撰写…</Text>
                            </View>
                        ) : null}
                    </View>
                );
            })}
            {props.footer}
        </View>
    );
}

function sameItems(left: ChapterItem[], right: ChapterItem[]): boolean {
    return left.length === right.length && left.every((item, index) => {
        const other = right[index];
        return item.message.uiId === other.message.uiId && item.message.content === other.message.content
            && item.superseded === other.superseded && item.streaming === other.streaming && item.stage === other.stage;
    });
}

/** Finished chapters skip re-rendering while a later chapter streams. */
export const AIChapterCard = memo(AIChapterCardInner, (prev, next) =>
    prev.chapter.status === next.chapter.status
    && sameItems(prev.chapter.items, next.chapter.items)
    && prev.chapter.title === next.chapter.title
    && prev.styles === next.styles
    && prev.marks === next.marks
    && prev.footer === next.footer
    && prev.minHeight === next.minHeight
    && prev.onMark === next.onMark
    && prev.yearMeta === next.yearMeta
    && prev.renderYearPanel === next.renderYearPanel
    && prev.getDisplayContent === next.getDisplayContent) as typeof AIChapterCardInner;
