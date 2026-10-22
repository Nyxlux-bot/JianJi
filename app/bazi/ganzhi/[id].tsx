import React, { useEffect, useMemo, useState } from 'react';
import {
    Image,
    Pressable,
    StyleProp,
    TextStyle,
    ScrollView,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Line } from 'react-native-svg';
import ArcChart, { ArcColumn, ArcLink, ArcVertical } from '../../../src/components/ArcChart';
import { BackIcon, SettingsIcon } from '../../../src/components/Icons';
import StatusBarDecor from '../../../src/components/StatusBarDecor';
import WuXingIcon from '../../../src/components/WuXingIcon';
import { makeResultChromeStyles, ResultCard, ResultChromeStyles } from '../../../src/components/result/ResultChrome';
import { normalizeBaziResultV2 } from '../../../src/core/bazi-normalize';
import { BaziPillarKey, BaziResult } from '../../../src/core/bazi-types';
import { getRecord } from '../../../src/db/database';
import {
    GanZhiRelationMode,
    GanZhiVisualTab,
    GanZhiVisualViewModel,
    buildGanZhiVisualViewModel,
} from '../../../src/features/bazi/ganzhi-visual';
import {
    DialRelation,
    FlowChain,
    FlowGlyph,
    KinReading,
    PalaceReading,
    ReadingTone,
    buildDialRelations,
    buildFlowReading,
    buildKinReading,
    buildPalaceReading,
} from '../../../src/features/bazi/ganzhi-reading';
import { getPendingBaziRecord } from '../../../src/features/bazi/pending-result-cache';
import { useGanZhiRelationSettings } from '../../../src/features/bazi/ganzhi-relation-settings';
import { FortuneSelectionView } from '../../../src/features/bazi/types';
import {
    buildBaziProChartViewModel,
    getInitialFortuneSelection,
} from '../../../src/features/bazi/view-model';
import { WuXingElement, getGanZhiElement } from '../../../src/features/bazi/wuxing';
import { buildResultPalette, ResultPalette } from '../../../src/theme/result-palette';
import { useTheme } from '../../../src/theme/ThemeContext';

const TAB_ITEMS: Array<{ key: GanZhiVisualTab; label: string }> = [
    { key: 'ganzhi', label: '干支' },
    { key: 'flow', label: '流通' },
    { key: 'palace', label: '宫位' },
    { key: 'relations', label: '六亲' },
];

// ResultCard 左右内边距 14 + 1px 边框
const CARD_INSET = 30;

const PALACE_SHORT: Record<BaziPillarKey, string> = { year: '祖辈宫', month: '父母宫', day: '夫妻宫', hour: '子女宫' };

const STAGE_ICONS = [
    require('../../../assets/bazi/ui/stage-root.png'),
    require('../../../assets/bazi/ui/stage-sprout.png'),
    require('../../../assets/bazi/ui/stage-flower.png'),
    require('../../../assets/bazi/ui/stage-fruit.png'),
];

type Styles = ReturnType<typeof makeStyles>;

interface PageContext {
    name: string;
    mingZao: string;
    liuNian: string;
    liuNianYear: string;
    liuNianIsCurrent: boolean;
    age: number | null;
    yunLabel: string;
    yunGanZhi: string;
    yunAges: string;
}

function parseIndex(value: string | string[] | undefined, fallback: number): number {
    const raw = Array.isArray(value) ? value[0] : value;
    if (raw === undefined || raw === '') return fallback;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function resolveSelection(
    result: BaziResult,
    params: ReturnType<typeof useLocalSearchParams>,
): FortuneSelectionView {
    const fallback = getInitialFortuneSelection(result);
    const rawMode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
    return {
        mode: rawMode === 'xiaoyun' || rawMode === 'dayun' ? rawMode : fallback.mode,
        selectedDaYunIndex: parseIndex(params.dayun, fallback.selectedDaYunIndex),
        selectedXiaoYunIndex: parseIndex(params.xiaoyun, fallback.selectedXiaoYunIndex),
        selectedLiuNianIndex: parseIndex(params.liunian, fallback.selectedLiuNianIndex),
        selectedLiuYueIndex: parseIndex(params.liuyue, fallback.selectedLiuYueIndex),
    };
}

function toneColor(tone: ReadingTone, palette: ResultPalette): string {
    if (tone === 'pos') return palette.positive;
    if (tone === 'neg') return palette.negative;
    return palette.gold;
}

function toneSoft(tone: ReadingTone, palette: ResultPalette): string {
    if (tone === 'pos') return palette.positiveSoft;
    if (tone === 'neg') return palette.negativeSoft;
    return palette.goldSoft;
}

function elementColor(element: string | null | undefined, palette: ResultPalette): string {
    return element && element in palette.element ? palette.element[element as WuXingElement] : palette.ink;
}

/** 生、克带方向：箭头指向受生、受克的一方 */
function arrowTarget(label: string, direction: string, from: number, to: number): number | undefined {
    if (label !== '生' && label !== '克') return undefined;
    if (direction === 'left_to_right') return to;
    if (direction === 'right_to_left') return from;
    return undefined;
}

export default function BaziGanZhiVisualPage() {
    const params = useLocalSearchParams();
    const { Colors } = useTheme();
    const palette = useMemo(() => buildResultPalette(Colors), [Colors]);
    const chrome = useMemo(() => makeResultChromeStyles(palette), [palette]);
    const styles = useMemo(() => makeStyles(palette), [palette]);
    const { width } = useWindowDimensions();
    const [result, setResult] = useState<BaziResult | null>(null);
    const [screenState, setScreenState] = useState<'loading' | 'ready' | 'missing'>('loading');
    const [activeTab, setActiveTab] = useState<GanZhiVisualTab>('ganzhi');
    const { settings: ganZhiRelationSettings } = useGanZhiRelationSettings();
    const rawId = Array.isArray(params.id) ? params.id[0] : params.id;

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            if (!rawId) {
                setScreenState('missing');
                return;
            }
            const pending = getPendingBaziRecord(rawId);
            if (pending) {
                setResult(normalizeBaziResultV2(pending.result));
                setScreenState('ready');
                return;
            }
            const detail = await getRecord(rawId);
            if (cancelled) return;
            if (!detail || detail.engineType !== 'bazi') {
                setScreenState('missing');
                return;
            }
            setResult(normalizeBaziResultV2(detail.result));
            setScreenState('ready');
        };
        void load();
        return () => {
            cancelled = true;
        };
    }, [rawId]);

    const selection = useMemo(
        () => result ? resolveSelection(result, params) : null,
        [params, result],
    );
    const model = useMemo(() => {
        if (!result || !selection) return null;
        const proChart = buildBaziProChartViewModel(result, selection, ganZhiRelationSettings);
        const yunLabel = selection.mode === 'xiaoyun' ? '小运' : '大运';
        const viewModel = buildGanZhiVisualViewModel(result, proChart.fortuneColumns, yunLabel, ganZhiRelationSettings);
        const liuNianCell = proChart.liuNianTrack.find((cell) => cell.active);
        const daYunCell = proChart.daYunTrack.find((cell) => cell.active);
        const ageMatch = liuNianCell?.subLabel.match(/\d+/);
        const context: PageContext = {
            name: result.subject.name || '未命名',
            mingZao: result.subject.mingZaoLabel,
            liuNian: viewModel.diagram.nodes[0]?.pillar ?? '—',
            liuNianYear: liuNianCell?.topLabel ?? '',
            liuNianIsCurrent: Boolean(liuNianCell?.isCurrent),
            age: ageMatch ? Number(ageMatch[0]) : null,
            yunLabel,
            yunGanZhi: viewModel.diagram.nodes[1]?.pillar ?? '—',
            yunAges: selection.mode === 'xiaoyun' ? '' : (daYunCell?.subLabel.replace('~', '–') ?? ''),
        };
        return { viewModel, context };
    }, [ganZhiRelationSettings, result, selection]);
    const contentWidth = Math.max(288, Math.min(width - 32, 560));

    if (screenState === 'loading') {
        return (
            <View style={styles.container}>
                <StatusBarDecor />
                <View style={styles.centerState}><Text style={styles.stateText}>加载中...</Text></View>
            </View>
        );
    }

    if (screenState === 'missing' || !model || !result) {
        return (
            <View style={styles.container}>
                <StatusBarDecor />
                <View style={chrome.topBar}>
                    <Pressable onPress={() => router.back()} style={({ pressed }) => [chrome.iconBtn, chrome.backBtn, pressed && chrome.pressed]} accessibilityRole="button" accessibilityLabel="返回排盘">
                        <BackIcon size={22} color={palette.ink} />
                    </Pressable>
                </View>
                <View style={styles.centerState}>
                    <Text style={styles.missingTitle}>排盘记录无法读取</Text>
                    <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.returnButton, pressed && chrome.pressed]}>
                        <Text style={styles.returnButtonText}>返回排盘</Text>
                    </Pressable>
                </View>
            </View>
        );
    }

    const { viewModel, context } = model;
    const props = { viewModel, context, width: contentWidth, palette, chrome, styles };
    return (
        <View style={styles.container}>
            <StatusBarDecor />
            <TopBar activeTab={activeTab} onChange={setActiveTab} chrome={chrome} palette={palette} />
            <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={{ width: contentWidth, alignSelf: 'center' }}>
                    {activeTab === 'ganzhi' ? (
                        <GanZhiTab {...props} />
                    ) : activeTab === 'flow' ? (
                        <FlowTab {...props} />
                    ) : activeTab === 'palace' ? (
                        <PalaceTab {...props} />
                    ) : (
                        <KinTab {...props} result={result} />
                    )}
                </View>
            </ScrollView>
        </View>
    );
}

interface TabProps {
    viewModel: GanZhiVisualViewModel;
    context: PageContext;
    width: number;
    palette: ResultPalette;
    chrome: ResultChromeStyles;
    styles: Styles;
}

const TopBar: React.FC<{
    activeTab: GanZhiVisualTab;
    onChange: (tab: GanZhiVisualTab) => void;
    chrome: ResultChromeStyles;
    palette: ResultPalette;
}> = ({ activeTab, onChange, chrome, palette }) => (
    <View style={chrome.topBar}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [chrome.iconBtn, chrome.backBtn, pressed && chrome.pressed]} accessibilityRole="button" accessibilityLabel="返回排盘">
            <BackIcon size={22} color={palette.ink} />
        </Pressable>
        <View style={chrome.tabs} accessibilityRole="tablist">
            {TAB_ITEMS.map((item) => {
                const on = item.key === activeTab;
                return (
                    <Pressable key={item.key} onPress={() => onChange(item.key)} style={({ pressed }) => [chrome.tab, pressed && chrome.pressed]} accessibilityRole="tab" accessibilityState={{ selected: on }}>
                        <Text style={[chrome.tabText, on && chrome.tabTextActive]}>{item.label}</Text>
                        {on ? <View style={chrome.tabIndicator} /> : null}
                    </Pressable>
                );
            })}
        </View>
        <View style={chrome.spacer} />
        <Pressable onPress={() => router.push('/bazi/ganzhi/settings')} style={({ pressed }) => [chrome.iconBtn, { width: 44 }, pressed && chrome.pressed]} accessibilityRole="button" accessibilityLabel="干支关系设置">
            <SettingsIcon size={20} color={palette.icon} />
        </Pressable>
    </View>
);

const Segmented = <K extends string>({ items, value, onChange, styles }: {
    items: Array<{ key: K; label: string }>;
    value: K;
    onChange: (key: K) => void;
    styles: Styles;
}) => (
    <View style={styles.seg} accessibilityRole="tablist">
        {items.map((item) => {
            const on = item.key === value;
            return (
                <Pressable key={item.key} onPress={() => onChange(item.key)} style={[styles.segBtn, on && styles.segBtnOn]} accessibilityRole="tab" accessibilityState={{ selected: on }} hitSlop={{ top: 8, bottom: 8 }}>
                    <Text style={[styles.segText, on && styles.segTextOn]}>{item.label}</Text>
                </Pressable>
            );
        })}
    </View>
);

const Tag: React.FC<{ text: string; tone: ReadingTone; palette: ResultPalette; styles: Styles }> = ({ text, tone, palette, styles }) => (
    <View style={[styles.tag, { backgroundColor: toneSoft(tone, palette) }]}>
        <Text style={[styles.tagText, { color: toneColor(tone, palette) }]}>{text}</Text>
    </View>
);

const GanZhiText: React.FC<{ text: string; style: StyleProp<TextStyle>; palette: ResultPalette }> = ({ text, style, palette }) => (
    <Text style={style}>
        {Array.from(text).map((char, index) => (
            <Text key={`${char}-${index}`} style={{ color: elementColor(getGanZhiElement(char), palette) }}>{char}</Text>
        ))}
    </Text>
);

const HangGlyph: React.FC<{ char: string; size: number; palette: ResultPalette; styles: Styles }> = ({ char, size, palette, styles }) => {
    const element = getGanZhiElement(char);
    const icon = Math.round(size * 0.56);
    return (
        <View style={styles.hang}>
            {element ? <WuXingIcon element={char} size={icon} style={[styles.hangIcon, { left: -(icon + 2), top: (size * 1.3 - icon) / 2 }]} /> : null}
            <Text style={{ fontSize: size, lineHeight: size * 1.3, fontWeight: '700', color: elementColor(element, palette) }}>{char}</Text>
        </View>
    );
};

const LegendLine: React.FC<{ color: string; label: string; dash?: string; styles: Styles }> = ({ color, label, dash, styles }) => (
    <View style={styles.legendItem}>
        <Svg width={16} height={4}>
            <Line x1={1} y1={2} x2={15} y2={2} stroke={color} strokeWidth={2} strokeLinecap="round" strokeDasharray={dash} />
        </Svg>
        <Text style={styles.legendText}>{label}</Text>
    </View>
);

/* ------------------------------------------------------------------ */
/* 干支：六柱一行，上方天干与整柱，下方地支                                */
/* ------------------------------------------------------------------ */

const GanZhiTab: React.FC<TabProps> = ({ viewModel, context, width, palette, chrome, styles }) => {
    // 岁运与原局放在一张图上关系太密，分三档看：原局只排四柱；流年、大运各画自己碰到的关系
    const [scope, setScope] = useState<'yuanju' | 'liunian' | 'yun'>('yuanju');
    const [focus, setFocus] = useState<string | null>(null);
    const { diagram } = viewModel;
    const all = useMemo(
        () => [...buildDialRelations(diagram, 'gan'), ...buildDialRelations(diagram, 'zhi')],
        [diagram],
    );
    const scopeOf = (order: number) => diagram.nodes.find((node) => node.order === order)?.scope;
    const yunOrders = diagram.nodes.filter((node) => node.scope === 'suiyun').map((node) => node.order).sort((left, right) => left - right);
    const [liuNianOrder, yunOrder] = yunOrders;
    const nodes = scope === 'yuanju' ? diagram.nodes.filter((node) => node.scope === 'yuanju') : diagram.nodes;
    // 流年与大运之间的关系归在流年这一档
    const relations = all.filter((relation) => {
        if (scope === 'yuanju') return relation.nodeOrders.every((order) => scopeOf(order) === 'yuanju');
        if (scope === 'liunian') return relation.nodeOrders.includes(liuNianOrder);
        return relation.nodeOrders.includes(yunOrder) && !relation.nodeOrders.includes(liuNianOrder);
    });
    const colOf = (order: number) => nodes.findIndex((node) => node.order === order);
    const lastYun = nodes.reduce((acc, node, index) => (node.scope === 'suiyun' ? index : acc), -1);

    const columns: ArcColumn[] = nodes.map((node) => ({
        key: node.key,
        stem: node.gan,
        branch: node.zhi,
        header: [node.label],
        headerTone: node.scope === 'suiyun' ? 'yun' : node.key === 'day' ? 'day' : undefined,
        highlight: node.key === 'day',
    }));
    const links: ArcLink[] = relations.map((relation) => ({
        key: relation.key,
        cols: relation.nodeOrders.map(colOf).filter((col) => col >= 0),
        side: relation.layer === 'branch' ? 'below' : 'above',
        tone: relation.tone,
        // 两柱之间只标一个字，三柱成局才写全名
        label: relation.nodeOrders.length >= 3 ? relation.label : relation.tag,
        arrowTo: relation.arrowToOrder === undefined ? undefined : colOf(relation.arrowToOrder),
        dimmed: focus !== null && focus !== relation.key,
    }));
    const groups = ([
        ['地支', relations.filter((relation) => relation.layer === 'branch')],
        ['天干', relations.filter((relation) => relation.layer === 'stem')],
        ['整柱', relations.filter((relation) => relation.layer === 'pillar')],
    ] as Array<[string, DialRelation[]]>).filter(([, list]) => list.length > 0);
    const hasMid = relations.some((relation) => relation.tone === 'mid');
    const hasArrow = relations.some((relation) => relation.arrowToOrder !== undefined);
    const hasYun = diagram.nodes.some((node) => node.scope === 'suiyun');

    return (
        <>
            <ContextLine context={context} palette={palette} styles={styles} />

            <ResultCard
                title="六柱"
                meta={scope === 'yuanju' ? '上干下支' : undefined}
                styles={chrome}
                style={styles.card}
                right={hasYun ? (
                    <Segmented
                        items={[{ key: 'yuanju', label: '原局' }, { key: 'liunian', label: '流年' }, { key: 'yun', label: context.yunLabel }]}
                        value={scope}
                        onChange={(next) => {
                            setScope(next);
                            setFocus(null);
                        }}
                        styles={styles}
                    />
                ) : undefined}
            >
                <View style={styles.chart}>
                    <ArcChart
                        columns={columns}
                        links={links}
                        splitAfter={lastYun >= 0 ? lastYun : undefined}
                        width={width - CARD_INSET}
                        glyphSize={scope === 'yuanju' ? 26 : 22}
                        palette={palette}
                        accessibilityLabel={`${scope === 'yuanju' ? '原局' : scope === 'liunian' ? '流年' : context.yunLabel}关系：${relations.map((relation) => relation.name).join('，') || '无明显关系'}`}
                    />
                </View>
                <View style={styles.legend}>
                    <LegendLine color={palette.positive} label="合" styles={styles} />
                    <LegendLine color={palette.negative} dash="4,3" label="冲 · 刑 · 克" styles={styles} />
                    {hasMid ? <LegendLine color={palette.gold} dash="0.1,4" label="伏吟" styles={styles} /> : null}
                    {hasArrow ? <Text style={styles.legendText}>箭头指向受克一方</Text> : null}
                </View>
            </ResultCard>

            <ResultCard title="关系" meta={relations.length ? '点一条，图上只亮它' : undefined} styles={chrome} style={styles.card}>
                {groups.length === 0 ? (
                    <Text style={styles.emptyText}>{scope === 'yuanju' ? '原局四柱之间无明显关系。' : `${scope === 'liunian' ? '流年' : context.yunLabel}与原局之间无明显关系。`}</Text>
                ) : groups.map(([name, list]) => (
                    <View key={name}>
                        <Text style={styles.group}>{name}</Text>
                        {list.map((relation) => {
                            const on = focus === relation.key;
                            return (
                                <Pressable
                                    key={relation.key}
                                    onPress={() => setFocus(on ? null : relation.key)}
                                    style={({ pressed }) => [styles.relRow, on && styles.relRowOn, pressed && styles.pressed]}
                                    accessibilityRole="button"
                                    accessibilityState={{ selected: on }}
                                    accessibilityLabel={`${relation.name}，${relation.positions}`}
                                >
                                    <Tag text={relation.tag} tone={relation.tone} palette={palette} styles={styles} />
                                    <Text style={styles.relName} numberOfLines={1}>{relation.name}</Text>
                                    <Text style={styles.relPos} numberOfLines={1}>{relation.positions}</Text>
                                </Pressable>
                            );
                        })}
                    </View>
                ))}
            </ResultCard>
        </>
    );
};

const ContextLine: React.FC<{ context: PageContext; palette: ResultPalette; styles: Styles }> = ({ context, palette, styles }) => (
    <Text style={styles.who}>
        <Text style={styles.whoName}>{context.name}</Text>
        {` · ${context.mingZao}　流年 `}
        <GanZhiText text={context.liuNian} style={styles.whoGlyph} palette={palette} />
        {context.liuNianYear ? ` ${context.liuNianYear}` : ''}
        {`　${context.yunLabel} `}
        <GanZhiText text={context.yunGanZhi} style={styles.whoGlyph} palette={palette} />
        {context.yunAges ? ` ${context.yunAges}` : ''}
    </Text>
);

/* ------------------------------------------------------------------ */
/* 流通：四柱一行，上看天干相邻，下看地支相邻，中看柱内                      */
/* ------------------------------------------------------------------ */

const FlowTab: React.FC<TabProps> = ({ viewModel, context, width, palette, chrome, styles }) => {
    const reading = useMemo(() => buildFlowReading(viewModel), [viewModel]);
    const { pillars, flowLinks } = viewModel;
    const toneOf = (tone: string): ReadingTone => (tone === 'supportive' ? 'pos' : tone === 'obstructive' ? 'neg' : 'mid');

    const columns: ArcColumn[] = pillars.map((pillar) => ({
        key: pillar.key,
        stem: pillar.stem,
        branch: pillar.branch,
        header: [pillar.label, pillar.stemShiShen],
        headerTone: pillar.key === 'day' ? 'day' : undefined,
        status: pillar.pillarStatus ?? undefined,
        highlight: pillar.key === 'day',
    }));
    const links: ArcLink[] = flowLinks.filter((link) => link.axis === 'horizontal').map((link) => ({
        key: link.key,
        cols: [link.fromIndex, link.toIndex],
        side: link.row === 'branch' ? 'below' : 'above',
        tone: toneOf(link.tone),
        label: link.label,
        arrowTo: arrowTarget(link.label, link.direction, link.fromIndex, link.toIndex),
    }));
    const verticals: ArcVertical[] = flowLinks.filter((link) => link.axis === 'vertical').map((link) => ({
        col: link.fromIndex,
        tone: toneOf(link.tone),
        label: link.direction === 'bidirectional' ? link.label : `${link.label}${link.direction === 'left_to_right' ? '↓' : '↑'}`,
    }));

    return (
        <>
            <Text style={styles.who}>{context.name} · {context.mingZao} · 原局四柱</Text>
            <Text style={styles.h1} accessibilityRole="header">{reading.headline}</Text>
            <Text style={styles.lede}>{reading.lede}</Text>
            <View style={styles.meter} accessible accessibilityLabel={`流通 ${reading.pass} 处，阻塞 ${reading.block} 处`}>
                <Text style={styles.meterText}>通 <Text style={{ color: palette.positive, fontWeight: '700' }}>{reading.pass}</Text></Text>
                <View style={styles.meterBar}>
                    {reading.pass > 0 ? <View style={[styles.meterSeg, { flex: reading.pass, backgroundColor: palette.positive }]} /> : null}
                    {reading.block > 0 ? <View style={[styles.meterSeg, { flex: reading.block, backgroundColor: palette.negative }]} /> : null}
                </View>
                <Text style={styles.meterText}>阻 <Text style={{ color: palette.negative, fontWeight: '700' }}>{reading.block}</Text></Text>
            </View>

            <ResultCard title="四柱" meta="上看天干相邻 · 下看地支相邻 · 中看柱内" styles={chrome} style={styles.card}>
                <View style={styles.chart}>
                    <ArcChart
                        columns={columns}
                        links={links}
                        verticals={verticals}
                        width={width - CARD_INSET}
                        glyphSize={26}
                        palette={palette}
                        accessibilityLabel={`流通：${reading.lede}`}
                    />
                </View>
                <View style={styles.legend}>
                    <LegendLine color={palette.positive} label="生 · 合" styles={styles} />
                    <LegendLine color={palette.negative} dash="4,3" label="冲 · 克" styles={styles} />
                    <Text style={styles.legendText}>箭头指向受生、受克一方</Text>
                </View>
            </ResultCard>

            {reading.chains.length > 0 ? (
                <ResultCard title="气路" meta="相生、相合连成的路" styles={chrome} style={styles.card}>
                    {reading.chains.map((chain, index) => (
                        <ChainRow key={chain.key} chain={chain} first={index === 0} palette={palette} styles={styles} />
                    ))}
                </ResultCard>
            ) : null}

            <ResultCard title="阻点" meta={reading.blocks.length ? `${reading.blocks.length} 处` : undefined} styles={chrome} style={styles.card}>
                {reading.blocks.length === 0 ? (
                    <Text style={styles.emptyText}>四柱之间与柱内都没有冲克刑阻。</Text>
                ) : (
                    <View style={styles.cardBody}>
                        {reading.blocks.map((block, index) => (
                            <View key={block.key} style={[styles.blockRow, index > 0 && styles.rowSep]}>
                                <Tag text={block.tag} tone="neg" palette={palette} styles={styles} />
                                <Text style={styles.blockName}>
                                    <Text style={{ color: elementColor(block.first.element, palette) }}>{block.first.char}</Text>
                                    <Text style={styles.blockVerb}> {block.tag} </Text>
                                    <Text style={{ color: elementColor(block.second.element, palette) }}>{block.second.char}</Text>
                                </Text>
                                <View style={styles.blockWhere}>
                                    <Text style={styles.blockWhereText}>{block.where}</Text>
                                    {block.note ? <Text style={styles.blockNote}>{block.note}</Text> : null}
                                </View>
                            </View>
                        ))}
                    </View>
                )}
            </ResultCard>
        </>
    );
};

const ChainRow: React.FC<{ chain: FlowChain; first: boolean; palette: ResultPalette; styles: Styles }> = ({ chain, first, palette, styles }) => (
    <View style={[styles.chainRow, !first && styles.rowSep]}>
        <View style={styles.chain}>
            {chain.glyphs.map((glyph: FlowGlyph, index) => (
                <React.Fragment key={`${chain.key}-${glyph.position}`}>
                    <View style={styles.chainNode}>
                        {glyph.element ? <WuXingIcon element={glyph.element} size={28} /> : <View style={{ height: 28 }} />}
                        <Text style={[styles.chainChar, { color: elementColor(glyph.element, palette) }]}>{glyph.char}</Text>
                        <Text style={styles.chainPos}>{glyph.position}</Text>
                    </View>
                    {index < chain.links.length ? (
                        <View style={styles.chainLink}>
                            <View style={[styles.chainLine, { backgroundColor: palette.positive }]} />
                            {chain.links[index].dir === 'forward' ? <View style={[styles.arrowRight, { borderLeftColor: palette.positive }]} /> : null}
                            {chain.links[index].dir === 'backward' ? <View style={[styles.arrowLeft, { borderRightColor: palette.positive }]} /> : null}
                            <Text style={[styles.chainLinkText, { color: palette.positive }]}>{chain.links[index].label}</Text>
                        </View>
                    ) : null}
                </React.Fragment>
            ))}
            {chain.result ? (
                <View style={[styles.chainResult, { backgroundColor: palette.positiveSoft }]}>
                    {chain.result.element ? <WuXingIcon element={chain.result.element} size={16} /> : null}
                    <Text style={[styles.chainResultText, { color: palette.positive }]}>{chain.result.text}</Text>
                </View>
            ) : null}
        </View>
        <Text style={styles.caption}>{chain.caption}</Text>
    </View>
);

/* ------------------------------------------------------------------ */
/* 宫位：根苗花实、岁运动到的宫、当下这一柱、其余三柱                       */
/* ------------------------------------------------------------------ */

const PalaceTab: React.FC<TabProps> = ({ viewModel, context, width, palette, chrome, styles }) => {
    const reading: PalaceReading = useMemo(() => buildPalaceReading(viewModel, {
        age: context.age,
        yearWord: context.liuNianIsCurrent ? '今年' : `${context.liuNianYear} 年`,
        liuNian: context.liuNian,
        yunLabel: context.yunLabel,
        yunGanZhi: context.yunGanZhi,
    }), [context, viewModel]);
    const { diagram } = viewModel;
    const current = reading.stages[reading.currentIndex];
    const others = reading.stages.filter((_, index) => index !== reading.currentIndex);

    // 只画岁运与原局之间的关系；流年、大运分两档，每档只排那一柱加原局四柱
    const [source, setSource] = useState<'liunian' | 'yun'>('liunian');
    const yunNodes = diagram.nodes.filter((node) => node.scope === 'suiyun').sort((left, right) => left.order - right.order);
    const sourceNode = source === 'liunian' ? yunNodes[0] : yunNodes[1];
    const nodes = diagram.nodes.filter((node) => node.scope === 'yuanju' || node === sourceNode);
    const cross = useMemo(() => {
        const scopeOf = (order: number) => diagram.nodes.find((node) => node.order === order)?.scope;
        return [...buildDialRelations(diagram, 'gan'), ...buildDialRelations(diagram, 'zhi')].filter((relation) =>
            relation.nodeOrders.some((order) => scopeOf(order) === 'suiyun') && relation.nodeOrders.some((order) => scopeOf(order) === 'yuanju'));
    }, [diagram]);
    const shown = cross.filter((relation) => sourceNode && relation.nodeOrders.includes(sourceNode.order)
        && relation.nodeOrders.every((order) => nodes.some((node) => node.order === order)));
    const colOf = (order: number) => nodes.findIndex((node) => node.order === order);
    const hitCols = new Set(shown.flatMap((relation) => relation.nodeOrders.map(colOf)));
    const columns: ArcColumn[] = nodes.map((node, index) => {
        const pillarKey = (['year', 'month', 'day', 'hour'] as BaziPillarKey[]).find((key) => key === node.key);
        return {
            key: node.key,
            stem: node.gan,
            branch: node.zhi,
            header: [node.label],
            headerTone: node.scope === 'suiyun' ? 'yun' : undefined,
            footer: pillarKey ? PALACE_SHORT[pillarKey] : source === 'liunian' ? context.liuNianYear : context.yunAges,
            footerStrong: Boolean(pillarKey) && hitCols.has(index),
            highlight: Boolean(current) && node.key === current?.key,
        };
    });
    const links: ArcLink[] = shown.map((relation) => ({
        key: relation.key,
        cols: relation.nodeOrders.map(colOf).filter((col) => col >= 0),
        side: relation.layer === 'branch' ? 'below' : 'above',
        tone: relation.tone,
        label: relation.nodeOrders.length >= 3 ? relation.label : relation.tag,
        arrowTo: relation.arrowToOrder === undefined ? undefined : colOf(relation.arrowToOrder),
    }));
    const sourceLabel = sourceNode?.label ?? '';
    const hitGroups = reading.hits
        .map((group) => ({ ...group, items: group.items.filter((hit) => hit.detail.startsWith(sourceLabel)) }))
        .filter((group) => group.items.length > 0);

    return (
        <>
            <Text style={styles.who}>{context.name} · {context.mingZao}{context.liuNianYear ? ` · ${context.liuNianYear} 年` : ''}</Text>
            <Text style={styles.h1} accessibilityRole="header">{reading.headline}</Text>
            <Text style={styles.lede}>{reading.lede}</Text>

            <ResultCard title="根苗花实" meta="四柱分管一生四段" styles={chrome} style={styles.card}>
                <View style={styles.rail}>
                    {reading.stages.map((stage, index) => {
                        const now = index === reading.currentIndex;
                        return (
                            <View key={stage.key} style={[styles.stage, now && styles.stageNow]}>
                                <Image source={STAGE_ICONS[index]} style={[styles.stageImage, !now && styles.stageImageIdle]} />
                                <Text style={[styles.stageWord, now && { color: palette.heading }]}>{stage.word}</Text>
                                <Text style={styles.stageGz}>
                                    <Text style={{ color: elementColor(stage.stemElement, palette) }}>{stage.stem}</Text>
                                    <Text style={{ color: elementColor(stage.branchElement, palette) }}>{stage.branch}</Text>
                                </Text>
                                <Text style={[styles.stageRange, now && { color: palette.ink }]}>{stage.range}</Text>
                            </View>
                        );
                    })}
                </View>
                {reading.currentIndex >= 0 && context.age !== null ? (
                    <AgeTrack age={context.age} palette={palette} styles={styles} />
                ) : null}
            </ResultCard>

            <ResultCard
                title={reading.hitsTitle}
                styles={chrome}
                style={styles.card}
                right={yunNodes.length > 1 ? (
                    <Segmented
                        items={[{ key: 'liunian', label: '流年' }, { key: 'yun', label: context.yunLabel }]}
                        value={source}
                        onChange={setSource}
                        styles={styles}
                    />
                ) : undefined}
            >
                <View style={styles.chart}>
                    <ArcChart
                        columns={columns}
                        links={links}
                        splitAfter={sourceNode ? 0 : undefined}
                        width={width - CARD_INSET}
                        palette={palette}
                        accessibilityLabel={`${sourceLabel}${sourceNode?.pillar ?? ''}动到的宫：${shown.map((relation) => relation.name).join('，') || '没有冲合刑害'}`}
                    />
                </View>
                {hitGroups.length === 0 ? (
                    <Text style={styles.emptyText}>{sourceLabel}与原局四柱之间没有冲合刑害。</Text>
                ) : (
                    <View style={styles.hits}>
                        {hitGroups.map((group, index) => (
                            <View key={group.stage.key} style={[styles.hitRow, index > 0 && styles.rowSep]}>
                                <View style={styles.hitBadge}>
                                    <Text style={[styles.hitBadgeText, { color: elementColor(group.stage.stemElement, palette) }]}>{group.stage.stem}</Text>
                                    <Text style={[styles.hitBadgeText, { color: elementColor(group.stage.branchElement, palette) }]}>{group.stage.branch}</Text>
                                </View>
                                <View style={styles.hitMain}>
                                    <Text style={styles.hitTitle} numberOfLines={1}>{group.stage.palaces.join(' · ')}</Text>
                                    {group.items.map((hit) => (
                                        <View key={hit.key} style={styles.hitItem}>
                                            <Tag text={hit.tag} tone={hit.tone} palette={palette} styles={styles} />
                                            <Text style={styles.hitDetail} numberOfLines={1}>{hit.detail}</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        ))}
                    </View>
                )}
            </ResultCard>

            {current ? (
                <ResultCard title={`当下 · ${current.label} ${current.stem}${current.branch}`} meta={`${current.word} · ${current.range}`} styles={chrome} style={styles.card}>
                    <View style={styles.cardBody}>
                        {[
                            { label: '宫位', value: current.palaces.join('、') },
                            { label: '时间', value: current.time, note: `${current.range} 岁`.replace('往后 岁', '岁往后') },
                            { label: '空间', value: current.space },
                            { label: '身体', value: current.body },
                            { label: '人际', value: current.people },
                        ].map((row, index) => (
                            <View key={row.label} style={[styles.kv, index > 0 && styles.rowSep]}>
                                <Text style={styles.kvLabel}>{row.label}</Text>
                                <Text style={styles.kvValue}>{row.value}{row.note ? <Text style={styles.kvNote}>  {row.note}</Text> : null}</Text>
                            </View>
                        ))}
                    </View>
                </ResultCard>
            ) : null}

            <ResultCard title={current ? '其余三柱' : '四柱'} styles={chrome} style={styles.card}>
                <View style={styles.cardBody}>
                    {(current ? others : reading.stages).map((stage, index) => (
                        <View key={stage.key} style={[styles.pillarRow, index > 0 && styles.rowSep]}>
                            <View style={styles.pillarHead}>
                                <Text style={styles.pillarWord}>{stage.word}</Text>
                                <Text style={styles.pillarGz}>
                                    <Text style={{ color: elementColor(stage.stemElement, palette) }}>{stage.stem}</Text>
                                    <Text style={{ color: elementColor(stage.branchElement, palette) }}>{stage.branch}</Text>
                                </Text>
                                <Text style={styles.pillarPalace} numberOfLines={1}>{stage.palaces.join(' · ')}</Text>
                                <Text style={styles.pillarTime}>{stage.time} {stage.range}</Text>
                            </View>
                            <Text style={styles.pillarDetail}>{stage.space} · {stage.body} · {stage.people}</Text>
                        </View>
                    ))}
                </View>
            </ResultCard>
        </>
    );
};

const AgeTrack: React.FC<{ age: number; palette: ResultPalette; styles: Styles }> = ({ age, palette, styles }) => {
    // 四段等宽：0–18、18–36、36–48、48 往后（按 60 岁封顶）
    const bands = [[0, 18], [18, 36], [36, 48], [48, 60]];
    const found = bands.findIndex(([, to]) => age < to);
    const bandIndex = found < 0 ? 3 : found;
    const [from, to] = bands[bandIndex];
    const ratio = (bandIndex + Math.min(1, Math.max(0, (age - from) / (to - from)))) / 4;
    return (
        <View style={styles.ageTrack}>
            <View style={styles.ageBars}>
                {bands.map((band, index) => (
                    <View key={band[0]} style={[styles.ageBar, { backgroundColor: index < bandIndex ? palette.gold : palette.barTrack }]}>
                        {index === bandIndex ? <View style={[styles.ageFill, { width: `${(ratio * 4 - index) * 100}%` as const, backgroundColor: palette.gold }]} /> : null}
                    </View>
                ))}
                <View style={[styles.agePin, { left: `${ratio * 100}%` as const, backgroundColor: palette.gold }]} />
            </View>
            <Text style={[styles.ageLabel, { color: palette.gold }]}>今 {age} 岁</Text>
        </View>
    );
};

/* ------------------------------------------------------------------ */
/* 六亲：六亲谱 + 按人找位                                                */
/* ------------------------------------------------------------------ */

interface KinCell {
    key: string;
    char: string;
    star: string;
    primary: string;
    rest: string;
}

const KinTab: React.FC<TabProps & { result: BaziResult }> = ({ viewModel, result, context, palette, chrome, styles }) => {
    const [mode, setMode] = useState<GanZhiRelationMode>('family');
    const [focus, setFocus] = useState<string | null>(null);
    const reading: KinReading = useMemo(() => buildKinReading(viewModel.pillars, result.gender, mode), [mode, result.gender, viewModel.pillars]);
    const pillars = viewModel.pillars;

    const byKey = new Map(reading.satellites.map((satellite) => [satellite.key, satellite]));
    const cellOf = (key: string, fallback: KinCell): KinCell => {
        const satellite = byKey.get(key);
        return satellite ? { key, char: satellite.char, star: satellite.star, primary: satellite.primary, rest: satellite.rest } : fallback;
    };
    const stemCells = pillars.map((pillar) => cellOf(`${pillar.key}-stem`, { key: `${pillar.key}-stem`, char: pillar.stem, star: '日主', primary: '自己', rest: '' }));
    const branchCells = pillars.map((pillar) => cellOf(`${pillar.key}-branch`, { key: `${pillar.key}-branch`, char: pillar.branch, star: pillar.branchShiShen, primary: '—', rest: '' }));
    const focusRow = reading.rows.find((row) => row.key === focus);
    const lit = focusRow ? new Set(focusRow.at.map((spot) => spot.key)) : null;
    const dayIndex = pillars.findIndex((pillar) => pillar.key === 'day');

    const renderCell = (cell: KinCell, index: number, last: boolean) => {
        const day = index === dayIndex;
        const state = lit ? (lit.has(cell.key) ? 'hit' : 'dim') : null;
        return (
            <View key={cell.key} style={[styles.kinCell, day && styles.kinCellDay, day && last && styles.kinCellDayLast, state === 'hit' && styles.kinCellHit, state === 'dim' && styles.kinCellDim]}>
                <HangGlyph char={cell.char} size={24} palette={palette} styles={styles} />
                <Text style={styles.kinStar} numberOfLines={1}>{cell.star}</Text>
                <Text style={styles.kinPrimary} numberOfLines={1}>{cell.primary}</Text>
                {cell.rest ? <Text style={styles.kinRest} numberOfLines={2}>{cell.rest}</Text> : null}
            </View>
        );
    };

    return (
        <>
            <View style={styles.kinHead}>
                <Text style={[styles.who, { flex: 1 }]}>{context.name} · {context.mingZao} · 以日主为心</Text>
                <Segmented
                    items={[{ key: 'family', label: '亲属' }, { key: 'social', label: '社会' }]}
                    value={mode}
                    onChange={(next) => {
                        setMode(next);
                        setFocus(null);
                    }}
                    styles={styles}
                />
            </View>
            <Text style={styles.h1} accessibilityRole="header">{reading.headline}</Text>
            {reading.lede ? <Text style={styles.lede}>{reading.lede}</Text> : null}

            <ResultCard title="六亲谱" meta="每个字落在谁身上" styles={chrome} style={styles.card}>
                <View style={styles.kinGrid}>
                    {pillars.map((pillar, index) => (
                        <View key={pillar.key} style={[styles.kinCol, index === dayIndex && styles.kinHeadDay]}>
                            <Text style={[styles.kinColLabel, index === dayIndex && { color: palette.heading }]}>{pillar.label}</Text>
                            <Text style={[styles.kinColPalace, index === dayIndex && { color: palette.gold, fontWeight: '600' }]}>{PALACE_SHORT[pillar.key]}</Text>
                        </View>
                    ))}
                </View>
                <View style={styles.kinGrid}>{stemCells.map((cell, index) => renderCell(cell, index, false))}</View>
                <View style={styles.kinGrid}>{branchCells.map((cell, index) => renderCell(cell, index, true))}</View>
            </ResultCard>

            <ResultCard title={reading.listTitle} meta="点一行，谱上只亮它" styles={chrome} style={styles.card}>
                <View style={styles.cardBody}>
                    {reading.rows.map((row) => {
                        const on = focus === row.key;
                        return (
                            <Pressable
                                key={row.key}
                                onPress={() => setFocus(on ? null : row.key)}
                                style={({ pressed }) => [styles.kinRow, on && styles.relRowOn, pressed && styles.pressed]}
                                accessibilityRole="button"
                                accessibilityState={{ selected: on }}
                            >
                                <View style={styles.kinWho}>
                                    <Text style={styles.kinWhoText} numberOfLines={1}>{row.who}</Text>
                                    <Text style={styles.kinStars} numberOfLines={1}>{row.stars}</Text>
                                </View>
                                <View style={styles.kinAt}>
                                    {row.at.length === 0 ? (
                                        <Text style={styles.kinNone}>— 原局未见</Text>
                                    ) : row.at.map((spot) => (
                                        <View key={spot.key} style={[styles.loc, spot.spouse && { backgroundColor: palette.goldSoft }]}>
                                            <Text style={[styles.locLabel, spot.spouse && { color: palette.gold }]}>{spot.label}</Text>
                                            <Text style={[styles.locChar, { color: elementColor(spot.element, palette) }]}>{spot.char}</Text>
                                        </View>
                                    ))}
                                </View>
                            </Pressable>
                        );
                    })}
                </View>
            </ResultCard>
        </>
    );
};

const makeStyles = (palette: ResultPalette) => StyleSheet.create({
    container: { flex: 1, backgroundColor: 'transparent' },
    content: { flex: 1 },
    scrollContent: { paddingTop: 14, paddingBottom: 40 },
    centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
    stateText: { color: palette.muted, fontSize: 15 },
    missingTitle: { color: palette.ink, fontSize: 18, fontWeight: '600' },
    returnButton: { minHeight: 44, paddingHorizontal: 20, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.goldSoft },
    returnButtonText: { color: palette.gold, fontSize: 15, fontWeight: '600' },
    pressed: { opacity: 0.72 },

    who: { fontSize: 12, lineHeight: 18, color: palette.muted },
    whoName: { fontWeight: '700', color: palette.heading },
    whoGlyph: { fontWeight: '700', letterSpacing: 1 },
    h1: { marginTop: 6, fontSize: 22, lineHeight: 30, fontWeight: '700', color: palette.heading },
    lede: { marginTop: 8, fontSize: 14, lineHeight: 22, color: palette.ink },
    // 一段一张 ResultCard，卡里只用细线分行
    card: { marginTop: 12 },
    cardBody: { marginTop: 4 },
    rowSep: { borderTopWidth: 1, borderTopColor: palette.hairline },
    chart: { marginTop: 8 },
    emptyText: { paddingVertical: 10, fontSize: 13, lineHeight: 20, color: palette.muted },
    caption: { marginTop: 10, fontSize: 13, lineHeight: 20, color: palette.body },
    tag: { minWidth: 32, height: 20, paddingHorizontal: 5, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
    tagText: { fontSize: 11, fontWeight: '700' },

    seg: { flexDirection: 'row', padding: 2, borderRadius: 8, backgroundColor: palette.segTrack },
    segBtn: { height: 28, paddingHorizontal: 12, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
    segBtnOn: { backgroundColor: palette.segOn },
    segText: { fontSize: 13, color: palette.muted },
    segTextOn: { color: palette.heading, fontWeight: '700' },

    legend: { marginTop: 6, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 6, columnGap: 14 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendText: { fontSize: 11.5, lineHeight: 16, color: palette.muted },

    group: { marginTop: 10, marginBottom: 2, fontSize: 11.5, lineHeight: 16, color: palette.muted },
    relRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: -8, paddingHorizontal: 8, borderRadius: 8 },
    relRowOn: { backgroundColor: palette.goldSoft },
    relName: { flexShrink: 1, fontSize: 14, lineHeight: 20, fontWeight: '600', color: palette.heading },
    relPos: { marginLeft: 'auto', fontSize: 12, lineHeight: 20, color: palette.muted },

    meter: { marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
    meterText: { fontSize: 12, color: palette.muted },
    meterBar: { flex: 1, height: 6, flexDirection: 'row', gap: 3 },
    meterSeg: { height: 6, borderRadius: 3 },
    chainRow: { paddingVertical: 12 },
    chain: { flexDirection: 'row', alignItems: 'flex-start' },
    chainNode: { width: 58, alignItems: 'center', gap: 2 },
    chainChar: { fontSize: 20, lineHeight: 24, fontWeight: '700' },
    chainPos: { fontSize: 11, lineHeight: 14, color: palette.muted },
    chainLink: { flex: 1, height: 28, alignItems: 'center', justifyContent: 'center' },
    chainLine: { position: 'absolute', left: 0, right: 0, top: 13, height: 2 },
    arrowRight: { position: 'absolute', right: -1, top: 9, width: 0, height: 0, borderLeftWidth: 7, borderTopWidth: 5, borderBottomWidth: 5, borderTopColor: 'transparent', borderBottomColor: 'transparent' },
    arrowLeft: { position: 'absolute', left: -1, top: 9, width: 0, height: 0, borderRightWidth: 7, borderTopWidth: 5, borderBottomWidth: 5, borderTopColor: 'transparent', borderBottomColor: 'transparent' },
    chainLinkText: { paddingHorizontal: 6, fontSize: 12, fontWeight: '700', backgroundColor: palette.card },
    chainResult: { alignSelf: 'center', marginLeft: 6, height: 24, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, borderRadius: 4 },
    chainResultText: { fontSize: 12, fontWeight: '700' },
    blockRow: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 12 },
    blockName: { fontSize: 16, lineHeight: 22, fontWeight: '700', letterSpacing: 1 },
    blockVerb: { fontSize: 12, fontWeight: '600', color: palette.muted, letterSpacing: 0 },
    blockWhere: { marginLeft: 'auto', alignItems: 'flex-end' },
    blockWhereText: { fontSize: 13, lineHeight: 18, color: palette.ink },
    blockNote: { fontSize: 11, lineHeight: 15, color: palette.muted },

    rail: { marginTop: 10, flexDirection: 'row', gap: 4 },
    stage: { flex: 1, minWidth: 0, alignItems: 'center', paddingVertical: 10, borderRadius: 8 },
    stageNow: { backgroundColor: palette.dayFill },
    stageImage: { width: 40, height: 40 },
    stageImageIdle: { opacity: 0.45 },
    stageWord: { marginTop: 6, fontSize: 21, lineHeight: 27, fontWeight: '700', color: palette.muted },
    stageGz: { marginTop: 2, fontSize: 16, lineHeight: 22, fontWeight: '700', letterSpacing: 1 },
    stageRange: { marginTop: 2, fontSize: 12, lineHeight: 16, color: palette.muted },
    ageTrack: { marginTop: 14, marginHorizontal: 4, alignItems: 'center' },
    ageBars: { alignSelf: 'stretch', height: 14, flexDirection: 'row', alignItems: 'center', gap: 4 },
    ageBar: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden' },
    ageFill: { height: 4 },
    agePin: { position: 'absolute', top: 0, width: 14, height: 14, marginLeft: -7, borderRadius: 7, borderWidth: 3, borderColor: palette.card },
    ageLabel: { marginTop: 6, fontSize: 12, fontWeight: '700' },
    hits: { marginTop: 4, borderTopWidth: 1, borderTopColor: palette.hairline },
    hitRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12 },
    hitBadge: { width: 40, height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.chipBg },
    hitBadgeText: { fontSize: 15, lineHeight: 17, fontWeight: '700' },
    hitMain: { flex: 1, minWidth: 0 },
    hitTitle: { fontSize: 15, lineHeight: 21, fontWeight: '600', color: palette.heading },
    hitItem: { marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 8 },
    hitDetail: { flex: 1, fontSize: 13, lineHeight: 19, color: palette.body },
    kv: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 12 },
    kvLabel: { width: 34, fontSize: 13, color: palette.muted },
    kvValue: { flex: 1, fontSize: 15, lineHeight: 22, fontWeight: '600', color: palette.heading },
    kvNote: { fontSize: 13, fontWeight: '400', color: palette.muted },
    pillarRow: { paddingVertical: 12 },
    pillarHead: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
    pillarWord: { fontSize: 17, lineHeight: 22, fontWeight: '700', color: palette.muted },
    pillarGz: { fontSize: 16, lineHeight: 22, fontWeight: '700', letterSpacing: 1 },
    pillarPalace: { flexShrink: 1, fontSize: 15, fontWeight: '600', color: palette.heading },
    pillarTime: { marginLeft: 'auto', fontSize: 12, color: palette.muted },
    pillarDetail: { marginTop: 4, fontSize: 13, lineHeight: 20, color: palette.body },

    hang: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
    hangIcon: { position: 'absolute' },
    kinHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    kinGrid: { flexDirection: 'row', gap: 4 },
    kinCol: { flex: 1, minWidth: 0, alignItems: 'center', paddingTop: 10, paddingBottom: 6 },
    kinHeadDay: { borderTopLeftRadius: 8, borderTopRightRadius: 8, backgroundColor: palette.dayFill },
    kinColLabel: { fontSize: 12, lineHeight: 17, fontWeight: '600', color: palette.ink },
    kinColPalace: { fontSize: 11, lineHeight: 15, color: palette.muted },
    kinCell: { flex: 1, minWidth: 0, minHeight: 100, alignItems: 'center', paddingTop: 8, paddingBottom: 10, paddingHorizontal: 2, borderRadius: 8 },
    kinCellDay: { borderRadius: 0, backgroundColor: palette.dayFill },
    kinCellDayLast: { borderBottomLeftRadius: 8, borderBottomRightRadius: 8 },
    kinCellHit: { borderRadius: 8, borderWidth: 1, borderColor: palette.goldBorder, backgroundColor: palette.goldSoft },
    kinCellDim: { opacity: 0.35 },
    kinStar: { marginTop: 2, fontSize: 12, lineHeight: 17, fontWeight: '700', color: palette.ink },
    kinPrimary: { marginTop: 4, fontSize: 13, lineHeight: 18, fontWeight: '600', color: palette.heading },
    kinRest: { fontSize: 11, lineHeight: 15, color: palette.muted, textAlign: 'center' },
    kinRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: -8, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8 },
    kinWho: { minWidth: 92, flexShrink: 1 },
    kinWhoText: { fontSize: 15, lineHeight: 21, fontWeight: '600', color: palette.heading },
    kinStars: { fontSize: 12, lineHeight: 16, color: palette.muted },
    kinAt: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 6 },
    kinNone: { fontSize: 13, color: palette.muted },
    loc: { height: 26, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 7, borderRadius: 4, backgroundColor: palette.chipBg },
    locLabel: { fontSize: 12, color: palette.muted },
    locChar: { fontSize: 15, fontWeight: '700' },
});
