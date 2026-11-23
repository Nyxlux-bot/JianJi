import React, { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { getGanZhiElement } from '../../features/bazi/wuxing';
import { getQimenReading, type QimenReadingTab } from '../../features/qimen/ai-reading';
import { getQimenPillars } from '../../features/qimen/flying-board';
import { annotateQimenPassages, linkQimenPalaces, qimenCitationText } from '../../features/qimen/palace-links';
import { getPeriodBoard } from '../../features/qimen/period-board';
import { QIMEN_PERIODS, type QimenPeriod, type QimenResult } from '../../features/qimen/types';
import { useTheme } from '../../theme/ThemeContext';
import { AIReadingText } from './AIChapterCard';
import { ELEMENT_COLOR_KEYS, type AIMarkdownStyles, type AIPageStyles } from './ai-page-styles';
import type { ChapterMessage } from './derive-chapters';

export interface QimenQuote { period: QimenPeriod; text: string }

export function QimenQuotePreview({ quote, styles, onRemove }: { quote: QimenQuote; styles: AIPageStyles; onRemove: () => void }) {
    const label = qimenCitationText(quote.text).replace(/\*\*/gu, '');
    return <View style={styles.quotedPassage}>
        <View style={styles.chartTop}>
            <Text style={styles.chapNo}>{quote.period}原文</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="移除引用" onPress={onRemove} hitSlop={8}>
                <Text style={styles.hint}>移除引用</Text>
            </Pressable>
        </View>
        <ScrollView style={{ maxHeight: 96 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
            <Text style={styles.chartLineMuted}>{label}</Text>
        </ScrollView>
    </View>;
}

interface Props {
    result: QimenResult;
    tab: QimenReadingTab;
    messages: ChapterMessage[];
    busy: boolean;
    summaryOpen: boolean;
    onToggleSummary: () => void;
    styles: AIPageStyles;
    markdown: AIMarkdownStyles;
    onAsk: (quote: QimenQuote) => void;
    onBoard?: (period: QimenPeriod) => void;
    onLinkPress?: (url: string) => boolean;
    onTab: (tab: QimenReadingTab) => void;
    onRead: () => void;
    footer: React.ReactNode;
}

export function QimenReadingPanel({ result, tab, messages, busy, summaryOpen, onToggleSummary, styles, markdown, onAsk, onBoard, onLinkPress, onTab, onRead, footer }: Props) {
    const { Colors } = useTheme();
    const reading = useMemo(() => getQimenReading(messages), [messages]);
    const pillars = useMemo(() => getQimenPillars(result), [result]);
    const board = useMemo(() => tab === '追问' ? undefined : getPeriodBoard(result, tab), [result, tab]);
    const inChat = tab === '追问';
    const body = inChat ? undefined : reading.sections?.[tab];
    const draft = busy ? messages.filter(m => !m.pending).at(-1) : undefined;
    const streamReport = !!draft && draft === reading.message;
    const showText = (text: string, streaming = false) => <AIReadingText text={linkQimenPalaces(text)} streaming={streaming}
        markdownStyles={markdown} onLinkPress={onLinkPress} />;
    const question = result.question.trim() || reading.question;
    return <>
        <View style={[styles.chap, styles.qimenCase]}>
            <Text style={styles.chapNo}>占问事项 · {result.form ?? '转盘'}</Text>
            <Text style={styles.caseQuestion}>{question || '未填写占问'}</Text>
            {!inChat && <>
                <Text style={styles.hint}>{result.solarDate}　{result.solarTime} · 北京时间</Text>
                <View style={styles.casePillars}>{pillars.map((pillar, i) => <View key={QIMEN_PERIODS[i]} style={styles.casePillar}>
                    <Text style={styles.hint}>{QIMEN_PERIODS[i][0]}</Text>
                    <Text style={styles.casePillarValue}>{Array.from(pillar, char => {
                        const element = getGanZhiElement(char);
                        return <Text key={char} style={{ color: element ? Colors.bazi[ELEMENT_COLOR_KEYS[element]] : Colors.text.primary }}>{char}</Text>;
                    })}</Text>
                </View>)}</View>
                {reading.sections?.总断 && <View style={styles.qimenVerdict}>
                    <Pressable accessibilityRole="button" accessibilityLabel={summaryOpen ? '收起总断' : '展开总断'} aria-expanded={summaryOpen}
                        style={styles.chartTop} onPress={onToggleSummary}>
                        <Text style={styles.chapNo}>总断</Text><Text style={styles.hint}>{summaryOpen ? '收起' : '展开'}</Text>
                    </Pressable>
                    {summaryOpen && showText(reading.sections.总断, streamReport)}
                </View>}
            </>}
        </View>
        {inChat ? <>
            <Text style={styles.chapName}>本次占问的追问</Text>
            {reading.chat.map(message => message.role === 'user'
                ? <View key={message.uiId} style={styles.question}>
                    {message.qimenExcerpt && <View style={styles.quotedPassage}>
                        <Text style={styles.chapNo}>{message.qimenPeriod}原文</Text>
                        {showText(message.qimenExcerpt)}
                    </View>}
                    <Text style={styles.questionText}>{message.content}</Text>
                </View>
                : <View key={message.uiId} style={styles.chap}>{message === reading.message ? <>
                    {reading.sections?.总断 && showText(reading.sections.总断, streamReport)}
                    <Pressable accessibilityRole="button" style={styles.foldBtn} onPress={() => onTab('时盘')}>
                        <Text style={styles.chipText}>查看四盘分卷</Text>
                    </Pressable>
                </> : showText(message.content, draft === message)}</View>)}
            {!reading.chat.length && !busy && <Text style={styles.hint}>可以接着四盘解读问，也可以补充新的情况。</Text>}
            {footer}
        </> : <View style={styles.chap}>
            <View style={styles.chapHead}>
                <Text style={styles.chapName}>{tab}</Text>
                <Text style={styles.hint}>{pillars[QIMEN_PERIODS.indexOf(tab)]}{tab[0]} · {board?.title}</Text>
            </View>
            {streamReport && body && <Text style={styles.hint}>生成中 · 盘据待核对</Text>}
            {body ? showText(streamReport ? body : annotateQimenPassages(body, tab), streamReport) : <Text style={styles.intro}>{busy ? '这一卷正在生成。'
                : reading.sections ? '这份解读没有单列这一卷。' : '还没有这次占问的四盘分卷。'}</Text>}
            <View style={styles.readingActions}>
                {onBoard && <Pressable accessibilityRole="button" style={styles.foldBtn} onPress={() => onBoard(tab)}>
                    <Text style={styles.chipText}>查看{tab}九宫</Text>
                </Pressable>}
                {body ? <Pressable accessibilityRole="button" disabled={streamReport} style={styles.foldBtn} onPress={() => onAsk({ period: tab, text: body })}>
                    <Text style={styles.foldText}>问这一段</Text>
                </Pressable> : !busy && !footer && <Pressable accessibilityRole="button" style={styles.foldBtn} onPress={question ? onRead : () => onTab('追问')}>
                    <Text style={styles.chipText}>{question ? '解读四盘' : '补充占问'}</Text>
                </Pressable>}
            </View>
            {footer}
        </View>}
    </>;
}
