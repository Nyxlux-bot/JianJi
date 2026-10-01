import React, { memo, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { parseChapter, type ChapterSegment, type EventSegment, type YearSegment } from '../../ai/layout/parse-chapter';
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

function Md({ children, markdownStyles }: { children: string; markdownStyles: AIMarkdownStyles }) {
    return children.trim() ? <Markdown style={markdownStyles}>{children}</Markdown> : null;
}

const MARK_ORDER: AIVerificationMark[] = ['yes', 'no', 'unsure'];
const FIELD_LABELS = { basis: '命理依据', luck: '对应运限', detail: '推演说明' } as const;

function EventCard({ event, first, styles, markdownStyles, Colors, yearMeta, mark, onMark }: {
    event: EventSegment; first: boolean; styles: AIPageStyles; markdownStyles: AIMarkdownStyles; Colors: any;
    yearMeta?: ChapterYearMeta; mark?: AIVerificationMark; onMark?: (mark: AIVerificationMark | null) => void;
}) {
    const [open, setOpen] = useState(false);
    const fieldKeys = (Object.keys(FIELD_LABELS) as Array<keyof typeof FIELD_LABELS>).filter((key) => event.fields[key]?.trim());
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
                    {fieldKeys.map((key) => (
                        <View key={key}>
                            <Text style={styles.fieldLabel}>{FIELD_LABELS[key]}</Text>
                            <Md markdownStyles={markdownStyles}>{event.fields[key] ?? ''}</Md>
                        </View>
                    ))}
                    {event.extra ? <Md markdownStyles={markdownStyles}>{event.extra}</Md> : null}
                </View>
            ) : null}
            {!foldable ? <Md markdownStyles={markdownStyles}>{event.extra}</Md> : null}
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
                if (segment.type !== 'event') return <Md key={index} markdownStyles={props.markdownStyles}>{segmentText(segment)}</Md>;
                const first = eventIndex === 0;
                eventIndex += 1;
                return (
                    <EventCard key={`${segment.year}-${index}`} event={segment} first={first} styles={props.styles} markdownStyles={props.markdownStyles}
                        Colors={props.Colors} yearMeta={props.yearMeta?.(segment.year)} mark={props.marks?.[String(segment.year)]?.mark}
                        onMark={props.onMark && !streaming ? (mark) => props.onMark?.(segment.year, segment.summary, mark) : undefined} />
                );
            })}
        </View>
    );
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
    return (
        <View>
            {leading.map((segment, index) => <Md key={`l${index}`} markdownStyles={markdownStyles}>{segmentText(segment)}</Md>)}
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
                                    <Text style={styles.beadTag} numberOfLines={1}>{[meta?.ganZhi ?? item.ganZhi, item.tag].filter(Boolean).join(' · ')}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                    {selected ? (
                        <View>
                            {props.renderYearPanel?.(selected.year)}
                            <Md markdownStyles={markdownStyles}>{selected.body}</Md>
                        </View>
                    ) : null}
                </>
            ) : null}
            {trailing.map((segment, index) => segment.type === 'strategy' ? (
                <View key={`t${index}`} style={styles.strategy}>
                    <Text style={styles.yearTitle}>{segment.title}</Text>
                    <Md markdownStyles={markdownStyles}>{segment.body}</Md>
                </View>
            ) : <Md key={`t${index}`} markdownStyles={markdownStyles}>{segmentText(segment)}</Md>)}
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
                if (segment.type !== 'section') return <Md key={index} markdownStyles={markdownStyles}>{segmentText(segment)}</Md>;
                const first = sectionIndex === 0;
                sectionIndex += 1;
                return (
                    <View key={index} style={[styles.section, first && styles.sectionFirst]}>
                        <Text style={styles.sectionTitle}>{segment.title}</Text>
                        {segment.lead ? <Text style={styles.sectionLead}>{segment.lead}</Text> : null}
                        <Md markdownStyles={markdownStyles}>{segment.body}</Md>
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
    const content = stripRepeatedTitle(props.getDisplayContent(item.message), [props.chapter.title, props.chapter.short, '基础定局', '基础命盘', '前事核验']);
    const streaming = Boolean(item.streaming);
    const id = props.chapter.id;
    if (item.stage === 'kinship' || item.stage === 'kinship_review') {
        return (
            <View style={props.styles.kinBox}>
                <Text style={props.styles.kinLabel}>六亲初验</Text>
                <Md markdownStyles={props.markdownStyles}>{content}</Md>
            </View>
        );
    }
    if (id === 'verification') return <VerificationView content={content} streaming={streaming} props={props} />;
    if (id === 'five_year') return <FiveYearView content={content} streaming={streaming} props={props} />;
    if (id === 'compat') return <CompatView content={content} streaming={streaming} props={props} />;
    return <Md markdownStyles={props.markdownStyles}>{content}</Md>;
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
                                <ActivityIndicator size="small" color={Colors.accent.gold} />
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
