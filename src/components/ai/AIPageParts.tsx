import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { BaziResult } from '../../core/bazi-types';
import { DIZHI_WUXING, TIANGAN_WUXING } from '../../core/liuyao-data';
import type { BaziWuXingEnergySnapshot } from '../../core/bazi-wuxing-energy';
import type { BaziCompatibilityResult } from '../../features/bazi/match/types';
import type { ZiweiMutagenPlacement, ZiweiNatalOverview } from '../../features/ziwei/ai-overview';
import { getLuminance } from '../../theme/bazi-theme';
import { getActiveModel, getActiveProvider, getSettings, subscribeSettings } from '../../services/settings';
import { SendIcon } from '../Icons';
import AIModelSelector from '../AIModelSelector';
import { ELEMENT_COLOR_KEYS, type AIPageStyles } from './ai-page-styles';
import type { Chapter, ChapterStatus } from './derive-chapters';

/* ---------- stepper ---------- */

export function AIStageStepper({ chapters, currentId, styles, onPress }: {
    chapters: Chapter[]; currentId?: string; styles: AIPageStyles; onPress: (id: Chapter['id']) => void;
}) {
    return (
        <View style={styles.stepper} accessibilityRole="tablist">
            {chapters.map((chapter) => {
                const reachable = chapter.status !== 'todo';
                const barStyle = chapter.status === 'done' ? styles.stepBarDone : chapter.status === 'running' ? styles.stepBarRun
                    : chapter.status === 'failed' ? styles.stepBarFail : null;
                const current = chapter.id === currentId;
                return (
                    <TouchableOpacity key={chapter.id} style={styles.step} disabled={!reachable} onPress={() => onPress(chapter.id)}
                        accessibilityRole="tab" accessibilityState={{ selected: current, disabled: !reachable }}
                        accessibilityLabel={`${chapter.no}${chapter.title}，${STEP_STATUS[chapter.status]}`}>
                        <View style={[styles.stepBar, barStyle]} />
                        <Text numberOfLines={1} style={[styles.stepLabel, reachable && styles.stepLabelActive, current && styles.stepLabelCurrent]}>
                            {chapter.no} {chapter.short}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}
const STEP_STATUS: Record<ChapterStatus, string> = { todo: '未开始', running: '生成中', done: '已完成', failed: '未写完' };

/* ---------- chart summary (from app data, never from the reply) ---------- */

function elementColor(Colors: any, char: string): string {
    const element = TIANGAN_WUXING[char] ?? DIZHI_WUXING[char];
    const key = element ? ELEMENT_COLOR_KEYS[element as keyof typeof ELEMENT_COLOR_KEYS] : undefined;
    return key ? Colors.bazi[key] : Colors.text.primary;
}

const PILLAR_LABELS = ['年', '月', '日', '时'];

export function BaziChartSummary({ result, styles, Colors }: { result: BaziResult; styles: AIPageStyles; Colors: any }) {
    return (
        <View style={styles.chart} accessibilityLabel={`原局 ${result.fourPillars.join(' ')}`}>
            <View style={styles.chartTop}>
                <Text style={styles.chartTopText}>原局 · 由排盘数据生成</Text>
                <Text style={styles.chartTopText}>{result.subject?.mingZaoLabel ?? ''}</Text>
            </View>
            <View style={styles.pillars}>
                {result.fourPillars.map((ganZhi, index) => {
                    const god = index === 2 ? '日主' : result.shiShen.find((item) => item.pillarIndex === index)?.shiShen ?? '';
                    const hidden = result.cangGan[index]?.items?.map((item) => item.gan).join(' ') ?? '';
                    return (
                        <View key={index} style={styles.pillar}>
                            <Text style={[styles.pillarGod, index === 2 && styles.pillarGodMe]}>{PILLAR_LABELS[index]} · {god}</Text>
                            <Text style={styles.pillarGanZhi}>
                                {[...ganZhi].map((char, charIndex) => <Text key={charIndex} style={{ color: elementColor(Colors, char) }}>{char}</Text>)}
                            </Text>
                            {hidden ? <Text style={styles.pillarHidden}>{hidden}</Text> : null}
                        </View>
                    );
                })}
            </View>
        </View>
    );
}

const MUTAGEN_COLOR_KEYS: Record<ZiweiMutagenPlacement['kind'], 'jade' | 'gold' | 'goldLight' | 'red'> = { 禄: 'jade', 权: 'gold', 科: 'goldLight', 忌: 'red' };

export function MutagenChips({ items, styles, Colors }: { items: ZiweiMutagenPlacement[]; styles: AIPageStyles; Colors: any }) {
    return (
        <View style={styles.chartRow}>
            {items.map((item) => (
                <View key={`${item.kind}${item.star}`} style={styles.mutChip} accessibilityLabel={`${item.star}化${item.kind}${item.palace ? `，在${item.palace}` : ''}`}>
                    <Text style={[styles.mutKind, { color: Colors.accent[MUTAGEN_COLOR_KEYS[item.kind]] }]}>{item.kind}</Text>
                    <Text style={styles.mutText}>{item.star}{item.palace ? ` · ${item.palace}` : ''}</Text>
                </View>
            ))}
        </View>
    );
}

export function ZiweiChartSummary({ overview, subtitle, styles, Colors }: { overview: ZiweiNatalOverview; subtitle: string; styles: AIPageStyles; Colors: any }) {
    const life = overview.lifePalace;
    return (
        <View style={styles.chart}>
            <View style={styles.chartTop}>
                <Text style={styles.chartTopText}>本命盘 · 由排盘数据生成</Text>
                <Text style={styles.chartTopText}>{overview.bodyPalaceName ? `身宫在${overview.bodyPalaceName}` : ''}</Text>
            </View>
            <Text style={styles.chartLine}>命宫 {life.ganZhi} · {life.majorStars.length ? life.majorStars.join('、') : '空宫'}</Text>
            <Text style={styles.chartLineMuted}>{subtitle}</Text>
            <Text style={styles.chartLineMuted}>生年四化</Text>
            <MutagenChips items={overview.birthMutagens} styles={styles} Colors={Colors} />
        </View>
    );
}

export function CompatChartSummary({ result, styles }: { result: BaziCompatibilityResult; styles: AIPageStyles }) {
    return (
        <View style={styles.chart}>
            <View style={styles.chartTop}>
                <Text style={styles.chartTopText}>本地规则评分 · 参考，不是成婚概率</Text>
            </View>
            <View style={styles.scoreRow}>
                <Text style={styles.scoreBig}>{result.totalScore}</Text>
                <Text style={styles.scoreGrade}>{result.grade} · {result.maleProfile.name || '男方'} × {result.femaleProfile.name || '女方'}</Text>
            </View>
            <View style={styles.scoreGrid}>
                {result.dimensions.map((dimension) => (
                    <View key={dimension.key} style={styles.scoreCell}>
                        <Text style={styles.scoreCellLabel} numberOfLines={1}>{dimension.title}</Text>
                        <Text style={styles.scoreCellValue}>{dimension.score}</Text>
                    </View>
                ))}
            </View>
        </View>
    );
}

/* ---------- 卷三 year panel ---------- */

export function EnergyPanel({ energy, title, styles, Colors }: { energy: BaziWuXingEnergySnapshot; title: string; styles: AIPageStyles; Colors: any }) {
    const items = energy.elements.filter((item) => item.percentage > 0);
    // One text colour per theme: picking black/white per segment flips between neighbours in the light theme.
    const color = getLuminance(Colors.bg.primary) > 0.42 ? '#FFFFFF' : '#121212';
    return (
        <View style={styles.yearPanel}>
            <View style={styles.yearPanelHead}>
                <Text style={styles.yearPanelTitle}>{title}</Text>
                <Text style={styles.yearPanelMeta}>原局 + 大运 {energy.focus.yunGanZhi || '—'} + 流年 {energy.focus.liuNianGanZhi || '—'}</Text>
            </View>
            <View style={styles.energyBar} accessible accessibilityRole="image"
                accessibilityLabel={`五行占比：${items.map((item) => `${item.element} ${item.percentage}%`).join('，')}`}>
                {items.map((item) => {
                    const backgroundColor = Colors.bazi[ELEMENT_COLOR_KEYS[item.element]];
                    const label = item.percentage >= 12 ? `${item.element}${item.percentage}%` : item.percentage >= 6 ? `${item.percentage}%` : '';
                    return (
                        <View key={item.element} style={[styles.energySeg, { flexGrow: item.percentage, flexBasis: 0, backgroundColor }]}>
                            <Text style={[styles.energyText, { color }]} numberOfLines={1}>{label}</Text>
                        </View>
                    );
                })}
            </View>
        </View>
    );
}

/* ---------- progress / failure ---------- */

const PROGRESS_STEPS = ['提交盘据', '模型思考', '撰写正文', '检查完整'] as const;

export function ProgressBlock({ status, startedAt, styles, onStop, stopDisabled, modelLabel }: {
    status: string; startedAt?: string; styles: AIPageStyles; onStop?: () => void; stopDisabled?: boolean; modelLabel?: string;
}) {
    const index = status === 'running' ? 0 : status === 'reasoning' ? 1 : status === 'streaming' ? 2 : 3;
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);
    const elapsed = startedAt ? Math.max(0, Math.round((now - Date.parse(startedAt)) / 1000)) : 0;
    const hint = index <= 1 ? '长推理模型可能先安静思考一两分钟，期间可以离开本页，回来后会接着显示。'
        : index === 2 ? '正文边写边显示；写完并检查完整后才保存。' : '正在保存结果。';
    return (
        <View style={styles.footer} accessibilityLiveRegion="polite">
            <View style={styles.progSteps}>
                {PROGRESS_STEPS.map((label, stepIndex) => (
                    <Text key={label} style={[styles.progStep, stepIndex === index && styles.progStepOn, stepIndex < index && styles.progStepOk]}>
                        {stepIndex < index ? '✓ ' : ''}{label}
                    </Text>
                ))}
            </View>
            <Text style={styles.footerText}>{hint}</Text>
            <View style={styles.progMeta}>
                <Text style={styles.progMetaText} numberOfLines={1}>{[modelLabel, `已用时 ${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`].filter(Boolean).join(' · ')}</Text>
                {onStop ? (
                    <TouchableOpacity style={styles.linkBtn} onPress={onStop} disabled={stopDisabled} accessibilityRole="button">
                        <Text style={[styles.linkText, styles.linkDanger, stopDisabled && styles.btnDisabled]}>停止</Text>
                    </TouchableOpacity>
                ) : null}
            </View>
        </View>
    );
}

export function FailureBanner({ title, message, detail, styles, actions }: {
    title: string; message: string; detail?: string; styles: AIPageStyles;
    actions: Array<{ label: string; onPress: () => void; primary?: boolean }>;
}) {
    const [open, setOpen] = useState(false);
    return (
        <View style={[styles.footer]}>
            <View style={[styles.banner, styles.bannerBad]} accessibilityRole="alert">
                <Text style={styles.bannerTitle}>{title}</Text>
                <Text style={styles.bannerText}>{message}</Text>
                <View style={styles.row}>
                    {actions.map((action) => (
                        <TouchableOpacity key={action.label} style={[styles.btn, styles.btnSmall, action.primary && styles.btnPrimary]} onPress={action.onPress}>
                            <Text style={[styles.btnText, styles.btnSmallText, action.primary && styles.btnPrimaryText]}>{action.label}</Text>
                        </TouchableOpacity>
                    ))}
                    {detail ? (
                        <TouchableOpacity style={styles.linkBtn} onPress={() => setOpen(!open)} accessibilityState={{ expanded: open }}>
                            <Text style={styles.linkText}>{open ? '收起详情' : '详情'}</Text>
                        </TouchableOpacity>
                    ) : null}
                </View>
                {open && detail ? <Text style={styles.detailText} selectable>{detail}</Text> : null}
            </View>
        </View>
    );
}

export function ActionButton({ label, onPress, primary, disabled, styles, small }: {
    label: string; onPress: () => void; primary?: boolean; disabled?: boolean; styles: AIPageStyles; small?: boolean;
}) {
    return (
        <TouchableOpacity style={[styles.btn, small && styles.btnSmall, primary && styles.btnPrimary, disabled && styles.btnDisabled]}
            onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityState={{ disabled }}>
            <Text style={[styles.btnText, small && styles.btnSmallText, primary && styles.btnPrimaryText]}>{label}</Text>
        </TouchableOpacity>
    );
}

/* ---------- composer ---------- */

export function AIComposer({ value, onChange, onSend, disabledReason, busy, quickReplies, onQuickReply, styles, Colors }: {
    value: string; onChange: (text: string) => void; onSend: () => void; disabledReason?: string; busy?: boolean;
    quickReplies: string[]; onQuickReply: (text: string) => void; styles: AIPageStyles; Colors: any;
}) {
    const locked = Boolean(disabledReason);
    const canSend = !locked && !busy && value.trim().length > 0;
    return (
        <View style={styles.composer}>
            {!locked && quickReplies.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} keyboardShouldPersistTaps="handled">
                    {quickReplies.map((item) => (
                        <TouchableOpacity key={item} style={styles.chip} onPress={() => onQuickReply(item)} disabled={busy}>
                            <Text style={styles.chipText}>{item}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            ) : null}
            <View style={styles.inputRow}>
                <TextInput
                    style={[styles.input, locked && { color: Colors.text.tertiary }]}
                    placeholder={disabledReason ?? '继续追问…'}
                    placeholderTextColor={Colors.text.tertiary}
                    value={locked ? '' : value}
                    onChangeText={onChange}
                    editable={!locked && !busy}
                    multiline
                    maxLength={240}
                    accessibilityLabel="追问"
                    accessibilityHint={disabledReason}
                />
                <TouchableOpacity style={[styles.send, !canSend && styles.sendDisabled]} onPress={onSend} disabled={!canSend}
                    accessibilityRole="button" accessibilityLabel="发送" accessibilityState={{ disabled: !canSend }}>
                    {busy && !locked ? <ActivityIndicator size="small" color={Colors.text.inverse} />
                        : <SendIcon size={18} color={canSend ? Colors.text.inverse : Colors.text.tertiary} />}
                </TouchableOpacity>
            </View>
        </View>
    );
}

/* ---------- model chip + sheet ---------- */

export function AIModelChip({ running, styles, Colors, visible }: { running?: string; styles: AIPageStyles; Colors: any; visible: boolean }) {
    const [label, setLabel] = useState('');
    const [open, setOpen] = useState(false);
    const mounted = useRef(true);
    useEffect(() => {
        mounted.current = true;
        if (!visible) return undefined;
        const apply = (settings: Awaited<ReturnType<typeof getSettings>>) => {
            if (mounted.current) setLabel(getActiveModel(getActiveProvider(settings))?.model ?? '');
        };
        getSettings().then(apply).catch(() => undefined);
        const unsubscribe = subscribeSettings(apply);
        return () => { mounted.current = false; unsubscribe(); };
    }, [visible]);
    const shown = running ?? label;
    return (
        <>
            <TouchableOpacity style={styles.modelChip} onPress={() => setOpen(true)} accessibilityRole="button"
                accessibilityLabel={`模型：${shown || '未选择'}，点按切换模型与思考等级`}>
                <Text style={styles.modelChipDot}>●</Text>
                <Text style={styles.modelChipText} numberOfLines={1}>{shown || '选择模型'}</Text>
            </TouchableOpacity>
            <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
                <View style={styles.sheetRoot}>
                    <Pressable style={styles.sheetScrim} onPress={() => setOpen(false)} accessibilityLabel="关闭" />
                    <View style={styles.sheet}>
                        <View style={styles.sheetHead}>
                            <Text style={styles.sheetTitle}>模型与思考等级</Text>
                            <TouchableOpacity style={styles.sheetClose} onPress={() => setOpen(false)} accessibilityRole="button">
                                <Text style={styles.sheetCloseText}>完成</Text>
                            </TouchableOpacity>
                        </View>
                        <AIModelSelector visible={open} alwaysExpanded running={undefined} />
                        {running ? <Text style={[styles.hint, { paddingHorizontal: 20 }]}>本次分析仍用 {running}；切换后从下一次生成开始生效。</Text> : null}
                    </View>
                </View>
            </Modal>
        </>
    );
}
