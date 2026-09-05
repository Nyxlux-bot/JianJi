import React, { useEffect, useMemo, useState } from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, {
    Circle,
    Line,
    Path,
    Polygon,
    Rect,
    Text as SvgText,
} from 'react-native-svg';
import {
    BackIcon,
    ClockIcon,
    CompassIcon,
    HandIcon,
    HomeIcon,
    SettingsIcon,
} from '../../../src/components/Icons';
import StatusBarDecor from '../../../src/components/StatusBarDecor';
import {
    BaziGanZhiDiagramNode,
    BaziGanZhiDiagramRelation,
} from '../../../src/core/bazi-ganzhi-diagram';
import { normalizeBaziResultV2 } from '../../../src/core/bazi-normalize';
import { BaziResult } from '../../../src/core/bazi-types';
import { getRecord } from '../../../src/db/database';
import {
    GanZhiFlowDirection,
    GanZhiFlowLink,
    GanZhiPalaceGroup,
    GanZhiRelationMode,
    GanZhiRelationProfile,
    GanZhiVisualPillar,
    GanZhiVisualTab,
    GanZhiVisualViewModel,
    buildGanZhiVisualViewModel,
} from '../../../src/features/bazi/ganzhi-visual';
import { getPendingBaziRecord } from '../../../src/features/bazi/pending-result-cache';
import { useGanZhiRelationSettings } from '../../../src/features/bazi/ganzhi-relation-settings';
import { FortuneSelectionView } from '../../../src/features/bazi/types';
import {
    buildBaziProChartViewModel,
    getInitialFortuneSelection,
} from '../../../src/features/bazi/view-model';
import { BorderRadius, FontSize, Spacing } from '../../../src/theme/colors';
import { useTheme } from '../../../src/theme/ThemeContext';

const TAB_ITEMS: Array<{ key: GanZhiVisualTab; label: string }> = [
    { key: 'ganzhi', label: '干支' },
    { key: 'flow', label: '流通' },
    { key: 'palace', label: '宫位' },
    { key: 'relations', label: '六亲' },
];

interface PositionedRelation extends BaziGanZhiDiagramRelation {
    lane: number;
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

function allocateLanes(
    relations: BaziGanZhiDiagramRelation[],
    spanOrder: 'long-first' | 'short-first',
): PositionedRelation[] {
    const sorted = [...relations].sort((left, right) => {
        const leftSpan = Math.abs(left.rightOrder - left.leftOrder);
        const rightSpan = Math.abs(right.rightOrder - right.leftOrder);
        if (leftSpan !== rightSpan) {
            return spanOrder === 'long-first'
                ? rightSpan - leftSpan
                : leftSpan - rightSpan;
        }
        if (left.leftOrder !== right.leftOrder) return left.leftOrder - right.leftOrder;
        if (left.rightOrder !== right.rightOrder) return right.rightOrder - left.rightOrder;
        if (left.priority !== right.priority) return left.priority - right.priority;
        return left.key.localeCompare(right.key);
    });
    return sorted.map((relation, lane) => ({ ...relation, lane }));
}

function getElementColor(element: string | null, Colors: any): string {
    switch (element) {
        case '木': return Colors.accent.jade;
        case '火': return Colors.accent.redLight;
        case '土': return '#B28A54';
        case '金': return Colors.accent.goldLight;
        case '水': return '#4D8DE3';
        default: return Colors.text.primary;
    }
}

function getSymbolColor(symbol: string, Colors: any): string {
    const wood = '甲乙寅卯';
    const fire = '丙丁巳午';
    const earth = '戊己辰戌丑未';
    const metal = '庚辛申酉';
    const water = '壬癸子亥';
    if (wood.includes(symbol)) return getElementColor('木', Colors);
    if (fire.includes(symbol)) return getElementColor('火', Colors);
    if (earth.includes(symbol)) return getElementColor('土', Colors);
    if (metal.includes(symbol)) return getElementColor('金', Colors);
    if (water.includes(symbol)) return getElementColor('水', Colors);
    return Colors.text.tertiary;
}

function relationColor(relation: BaziGanZhiDiagramRelation, Colors: any): string {
    if (relation.tone === 'supportive') return Colors.accent.jade;
    if (relation.tone === 'obstructive') return Colors.accent.redLight;
    return Colors.bazi.chromeTextActive;
}

export default function BaziGanZhiVisualPage() {
    const params = useLocalSearchParams();
    const { Colors } = useTheme();
    const styles = makeStyles(Colors);
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const [result, setResult] = useState<BaziResult | null>(null);
    const [screenState, setScreenState] = useState<'loading' | 'ready' | 'missing'>('loading');
    const [activeTab, setActiveTab] = useState<GanZhiVisualTab>('ganzhi');
    const [relationMode, setRelationMode] = useState<GanZhiRelationMode>('family');
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
    const viewModel = useMemo(() => {
        if (!result || !selection) return null;
        const proChart = buildBaziProChartViewModel(result, selection);
        return buildGanZhiVisualViewModel(
            result,
            proChart.fortuneColumns,
            selection.mode === 'xiaoyun' ? '小运' : '大运',
            ganZhiRelationSettings,
        );
    }, [ganZhiRelationSettings, result, selection]);
    const contentWidth = Math.max(320, Math.min(width - Spacing.lg * 2, 760));

    if (screenState === 'loading') {
        return (
            <View style={styles.container}>
                <StatusBarDecor />
                <View style={styles.centerState}><Text style={styles.stateText}>加载中...</Text></View>
            </View>
        );
    }

    if (screenState === 'missing' || !viewModel) {
        return (
            <View style={styles.container}>
                <StatusBarDecor />
                <View style={styles.simpleHeader}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.75}>
                        <BackIcon size={24} />
                    </TouchableOpacity>
                </View>
                <View style={styles.centerState}>
                    <Text style={styles.missingTitle}>排盘记录无法读取</Text>
                    <TouchableOpacity onPress={() => router.back()} style={styles.returnButton} activeOpacity={0.8}>
                        <Text style={styles.returnButtonText}>返回排盘</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBarDecor />
            <VisualHeader activeTab={activeTab} onChange={setActiveTab} styles={styles} />

            {activeTab === 'relations' ? (
                <>
                    <ScrollView
                        style={styles.content}
                        contentContainerStyle={[styles.scrollContent, { paddingBottom: Spacing.xl }]}
                        showsVerticalScrollIndicator={false}
                    >
                        <RelationsPage
                            viewModel={viewModel}
                            mode={relationMode}
                            contentWidth={contentWidth}
                            Colors={Colors}
                            styles={styles}
                        />
                    </ScrollView>
                    <RelationModeSwitch
                        mode={relationMode}
                        onChange={setRelationMode}
                        bottomInset={insets.bottom}
                        styles={styles}
                    />
                </>
            ) : activeTab === 'flow' ? (
                <View style={styles.content}>
                    <FlowPage
                        viewModel={viewModel}
                        contentWidth={contentWidth}
                        Colors={Colors}
                        styles={styles}
                    />
                </View>
            ) : (
                <ScrollView
                    style={styles.content}
                    contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, Spacing.xl) + Spacing.xl }]}
                    showsVerticalScrollIndicator={false}
                >
                    {activeTab === 'ganzhi' ? (
                        <GanZhiPage viewModel={viewModel} contentWidth={contentWidth} Colors={Colors} styles={styles} />
                    ) : null}
                    {activeTab === 'palace' ? (
                        <PalacePage viewModel={viewModel} contentWidth={contentWidth} Colors={Colors} styles={styles} />
                    ) : null}
                </ScrollView>
            )}
        </View>
    );
}

const VisualHeader: React.FC<{
    activeTab: GanZhiVisualTab;
    onChange: (tab: GanZhiVisualTab) => void;
    styles: ReturnType<typeof makeStyles>;
}> = ({ activeTab, onChange, styles }) => (
    <View style={styles.visualHeader}>
        <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="返回排盘"
        >
            <BackIcon size={24} />
        </TouchableOpacity>
        <View style={styles.visualTabs} accessibilityRole="tablist">
            {TAB_ITEMS.map((item) => {
                const active = item.key === activeTab;
                return (
                    <TouchableOpacity
                        key={item.key}
                        style={[styles.visualTab, active && styles.visualTabActive]}
                        onPress={() => onChange(item.key)}
                        activeOpacity={0.78}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: active }}
                    >
                        <Text style={[styles.visualTabText, active && styles.visualTabTextActive]}>{item.label}</Text>
                    </TouchableOpacity>
                );
            })}
        </View>
        <TouchableOpacity
            onPress={() => router.push('/bazi/ganzhi/settings')}
            style={styles.headerIconButton}
            activeOpacity={0.72}
            accessibilityRole="button"
            accessibilityLabel="干支关系设置"
        >
            <SettingsIcon size={21} />
        </TouchableOpacity>
    </View>
);

const GanZhiPage: React.FC<{
    viewModel: GanZhiVisualViewModel;
    contentWidth: number;
    Colors: any;
    styles: ReturnType<typeof makeStyles>;
}> = ({ viewModel, contentWidth, Colors, styles }) => {
    const stemRelations = allocateLanes(viewModel.diagram.stemRelations, 'long-first');
    const crossPillarRelations = viewModel.diagram.pillarRelations.filter((item) => item.leftOrder !== item.rightOrder);
    const branchRelations = allocateLanes(
        [...viewModel.diagram.branchRelations, ...crossPillarRelations],
        'short-first',
    );
    const statusRelations = viewModel.diagram.pillarRelations.filter((item) => (
        item.leftOrder === item.rightOrder
    ));
    return (
        <View style={[styles.pageSurface, { width: contentWidth }]}>
            <RelationSectionHeader title="天干关系" styles={styles} />
            <RelationCanvas
                nodes={viewModel.diagram.nodes}
                relations={stemRelations}
                width={contentWidth}
                symbolKey="gan"
                Colors={Colors}
                styles={styles}
            />
            <SixPillarStrip nodes={viewModel.diagram.nodes} Colors={Colors} styles={styles} />
            <View style={styles.statusRow}>
                {viewModel.diagram.nodes.map((node) => {
                    const statuses = statusRelations
                        .filter((item) => item.leftOrder === node.order)
                        .map((item) => item.text);
                    return (
                        <Text key={`status-${node.key}`} style={styles.statusText}>
                            {statuses.length > 0 ? statuses.join('\n') : ' '}
                        </Text>
                    );
                })}
            </View>
            <RelationSectionHeader title="地支与整柱关系" styles={styles} />
            <RelationCanvas
                nodes={viewModel.diagram.nodes}
                relations={branchRelations}
                width={contentWidth}
                symbolKey="zhi"
                Colors={Colors}
                styles={styles}
            />
        </View>
    );
};

const RelationSectionHeader: React.FC<{
    title: string;
    styles: ReturnType<typeof makeStyles>;
}> = ({ title, styles }) => (
    <View style={styles.relationSectionHeader}>
        <View style={styles.relationSectionMark} />
        <Text style={styles.relationSectionTitle}>{title}</Text>
        <View style={styles.relationSectionRule} />
    </View>
);

const RelationCanvas: React.FC<{
    nodes: BaziGanZhiDiagramNode[];
    relations: PositionedRelation[];
    width: number;
    symbolKey: 'gan' | 'zhi';
    Colors: any;
    styles: ReturnType<typeof makeStyles>;
}> = ({ nodes, relations, width, symbolKey, Colors, styles }) => {
    const rowCount = relations.length;
    const height = Math.max(76, rowCount * 52 + 24);
    const padding = 28;
    const innerWidth = width - padding * 2;
    const xAt = (order: number) => nodes.length <= 1
        ? width / 2
        : padding + (innerWidth * order) / (nodes.length - 1);

    if (relations.length === 0) {
        return (
            <View style={[styles.emptyRelations, { height }]}>
                <Text style={styles.emptyRelationsText}>无明显关系</Text>
            </View>
        );
    }

    return (
        <Svg width={width} height={height}>
            {relations.map((relation) => {
                const x1 = xAt(relation.leftOrder);
                const x2 = xAt(relation.rightOrder);
                const y = 30 + relation.lane * 52;
                const color = relationColor(relation, Colors);
                const textWidth = Math.min(Math.max(relation.text.length * 12 + 10, 42), Math.max(Math.abs(x2 - x1) - 6, 42));
                const midX = (x1 + x2) / 2;
                return (
                    <React.Fragment key={relation.key}>
                        <Line x1={x1 + 18} y1={y} x2={x2 - 18} y2={y} stroke={color} strokeWidth={1.35} opacity={0.68} />
                        {relation.nodeOrders.map((order) => {
                            const node = nodes[order];
                            const x = xAt(order);
                            const symbol = node?.[symbolKey] ?? '—';
                            return (
                                <React.Fragment key={`${relation.key}-${order}`}>
                                    <Circle cx={x} cy={y} r={18} fill={Colors.bg.primary} stroke={color} strokeWidth={1.35} />
                                    <SvgText x={x} y={y + 5.5} fill={getSymbolColor(symbol, Colors)} fontSize={17} fontWeight="600" textAnchor="middle">
                                        {symbol}
                                    </SvgText>
                                </React.Fragment>
                            );
                        })}
                        <Rect x={midX - textWidth / 2} y={y - 25} width={textWidth} height={19} rx={9.5} fill={Colors.bg.primary} />
                        <SvgText x={midX} y={y - 11.5} fill={color} fontSize={11.5} fontWeight="600" textAnchor="middle">
                            {relation.text}
                        </SvgText>
                    </React.Fragment>
                );
            })}
        </Svg>
    );
};

const SixPillarStrip: React.FC<{
    nodes: BaziGanZhiDiagramNode[];
    Colors: any;
    styles: ReturnType<typeof makeStyles>;
}> = ({ nodes, Colors, styles }) => (
    <View style={styles.sixPillarStrip}>
        {nodes.map((node, index) => (
            <View
                key={node.key}
                style={[
                    styles.sixPillarCell,
                    index < 2 && styles.sixPillarFortuneCell,
                    index > 0 && styles.sixPillarCellBorder,
                ]}
            >
                <Text style={styles.sixPillarLabel}>{node.label}</Text>
                <Text style={[styles.sixPillarSymbol, { color: getSymbolColor(node.gan, Colors) }]}>{node.gan}</Text>
                <Text style={[styles.sixPillarSymbol, { color: getSymbolColor(node.zhi, Colors) }]}>{node.zhi}</Text>
            </View>
        ))}
    </View>
);

const FlowPage: React.FC<{
    viewModel: GanZhiVisualViewModel;
    contentWidth: number;
    Colors: any;
    styles: ReturnType<typeof makeStyles>;
}> = ({ viewModel, contentWidth, Colors, styles }) => (
    <View style={[styles.pageSurface, styles.flowPageSurface, { width: contentWidth }]}>
        <FlowDiagram
            pillars={viewModel.pillars}
            links={viewModel.flowLinks}
            width={contentWidth}
            Colors={Colors}
        />
        <View style={styles.flowLegend}>
            <View style={styles.legendRow}>
                <View style={[styles.legendIcon, { backgroundColor: Colors.accent.jade }]}><Text style={styles.legendIconText}>✓</Text></View>
                <Text style={styles.legendText}>流通：三合、五合、六合、相生、相助</Text>
            </View>
            <View style={styles.legendRow}>
                <View style={[styles.legendIcon, { backgroundColor: Colors.accent.red }]}><Text style={styles.legendIconText}>×</Text></View>
                <Text style={styles.legendText}>阻塞：相冲、相刑、相克</Text>
            </View>
        </View>
    </View>
);

const FlowDiagram: React.FC<{
    pillars: GanZhiVisualPillar[];
    links: GanZhiFlowLink[];
    width: number;
    Colors: any;
}> = ({ pillars, links, width, Colors }) => {
    const height = 292;
    const padding = 38;
    const innerWidth = width - padding * 2;
    const xAt = (index: number) => padding + (innerWidth * index) / 3;
    const stemY = 101;
    const branchY = 198;

    const drawArrowHead = (
        key: string,
        x: number,
        y: number,
        direction: 'left' | 'right' | 'up' | 'down',
        color: string,
    ) => {
        const points = direction === 'right'
            ? `${x},${y} ${x - 6},${y - 3.5} ${x - 6},${y + 3.5}`
            : direction === 'left'
                ? `${x},${y} ${x + 6},${y - 3.5} ${x + 6},${y + 3.5}`
                : direction === 'down'
                    ? `${x},${y} ${x - 3.5},${y - 6} ${x + 3.5},${y - 6}`
                    : `${x},${y} ${x - 3.5},${y + 6} ${x + 3.5},${y + 6}`;
        return <Polygon key={key} points={points} fill={color} />;
    };

    const drawLink = (link: GanZhiFlowLink) => {
        const color = link.tone === 'supportive' ? Colors.accent.jade : Colors.accent.redLight;
        if (link.axis === 'horizontal') {
            const y = link.row === 'stem' ? stemY : branchY;
            const x1 = xAt(link.fromIndex) + 21;
            const x2 = xAt(link.toIndex) - 21;
            const midX = (x1 + x2) / 2;
            return (
                <React.Fragment key={link.key}>
                    <Line x1={x1} y1={y} x2={x2} y2={y} stroke={color} strokeWidth={1.3} opacity={0.78} />
                    {link.direction === 'left_to_right' || link.direction === 'bidirectional'
                        ? drawArrowHead(`${link.key}-right`, x2, y, 'right', color)
                        : null}
                    {link.direction === 'right_to_left' || link.direction === 'bidirectional'
                        ? drawArrowHead(`${link.key}-left`, x1, y, 'left', color)
                        : null}
                    <Circle cx={midX} cy={y} r={12} fill={color} />
                    <SvgText x={midX} y={y + 4} fill={Colors.text.inverse} fontSize={11.5} fontWeight="700" textAnchor="middle">{link.label}</SvgText>
                </React.Fragment>
            );
        }

        const x = xAt(link.fromIndex);
        const y1 = stemY + 21;
        const y2 = branchY - 21;
        const midY = (y1 + y2) / 2;
        return (
            <React.Fragment key={link.key}>
                <Line x1={x} y1={y1} x2={x} y2={y2} stroke={color} strokeWidth={1.3} opacity={0.78} />
                {link.direction === 'left_to_right' || link.direction === 'bidirectional'
                    ? drawArrowHead(`${link.key}-down`, x, y2, 'down', color)
                    : null}
                {link.direction === 'right_to_left' || link.direction === 'bidirectional'
                    ? drawArrowHead(`${link.key}-up`, x, y1, 'up', color)
                    : null}
                <Circle cx={x} cy={midY} r={12} fill={color} />
                <SvgText x={x} y={midY + 4} fill={Colors.text.inverse} fontSize={11.5} fontWeight="700" textAnchor="middle">{link.label}</SvgText>
            </React.Fragment>
        );
    };

    return (
        <Svg width={width} height={height}>
            {links.map(drawLink)}
            {pillars.map((pillar, index) => {
                const x = xAt(index);
                return (
                    <React.Fragment key={pillar.key}>
                        <SvgText x={x} y={20} fill={Colors.text.tertiary} fontSize={12} textAnchor="middle">{pillar.label}</SvgText>
                        <SvgText x={x} y={50} fill={Colors.text.secondary} fontSize={13.5} textAnchor="middle">{pillar.stemShiShen}</SvgText>
                        <SvgText x={x} y={stemY + 9} fill={getElementColor(pillar.stemElement, Colors)} fontSize={28} fontWeight="600" textAnchor="middle">{pillar.stem}</SvgText>
                        <SvgText x={x} y={branchY + 9} fill={getElementColor(pillar.branchElement, Colors)} fontSize={28} fontWeight="600" textAnchor="middle">{pillar.branch}</SvgText>
                        <SvgText x={x} y={238} fill={Colors.text.secondary} fontSize={13} textAnchor="middle">{pillar.branchShiShen}</SvgText>
                        <SvgText x={x} y={274} fill={Colors.bazi.chromeTextActive} fontSize={12} fontWeight="600" textAnchor="middle">{pillar.pillarStatus ?? ''}</SvgText>
                    </React.Fragment>
                );
            })}
        </Svg>
    );
};

const PalacePage: React.FC<{
    viewModel: GanZhiVisualViewModel;
    contentWidth: number;
    Colors: any;
    styles: ReturnType<typeof makeStyles>;
}> = ({ viewModel, contentWidth, Colors, styles }) => (
    <View style={[styles.pageSurface, { width: contentWidth }]}>
        <View style={styles.palacePillars}>
            {viewModel.pillars.map((pillar) => (
                <View key={pillar.key} style={styles.palacePillar}>
                    <View style={styles.palaceLabels}>
                        {viewModel.palaceLabels[pillar.key].map((label) => (
                            <Text key={label} style={styles.palaceLabel}>{label}</Text>
                        ))}
                    </View>
                    <Text style={styles.palacePillarLabel}>{pillar.label}</Text>
                    <Text style={[styles.palaceSymbol, { color: getElementColor(pillar.stemElement, Colors) }]}>{pillar.stem}</Text>
                    <Text style={[styles.palaceSymbol, { color: getElementColor(pillar.branchElement, Colors) }]}>{pillar.branch}</Text>
                </View>
            ))}
        </View>
        <View style={styles.palaceCards}>
            {viewModel.palaceGroups.map((group) => (
                <PalaceCard key={group.key} group={group} Colors={Colors} styles={styles} />
            ))}
        </View>
    </View>
);

const PalaceCard: React.FC<{
    group: GanZhiPalaceGroup;
    Colors: any;
    styles: ReturnType<typeof makeStyles>;
}> = ({ group, Colors, styles }) => {
    const icon = group.key === 'time'
        ? <ClockIcon size={19} color={Colors.bazi.infoBandText} />
        : group.key === 'space'
            ? <HomeIcon size={19} color={Colors.bazi.infoBandText} />
            : group.key === 'body'
                ? <HandIcon size={19} color={Colors.bazi.infoBandText} />
                : <CompassIcon size={19} color={Colors.bazi.infoBandText} />;
    return (
        <View style={styles.palaceCard}>
            <View style={styles.palaceCardTitleRow}>
                <View style={styles.palaceCardIcon}>{icon}</View>
                <Text style={styles.palaceCardTitle}>{group.title}</Text>
            </View>
            <View style={styles.palaceCardGrid}>
                {group.values.map((value, index) => (
                    <View key={`${group.key}-${index}`} style={styles.palaceCardCell}>
                        <Text style={styles.palaceCardPrimary}>{value.primary}</Text>
                        {value.secondary ? <Text style={styles.palaceCardSecondary}>{value.secondary}</Text> : null}
                    </View>
                ))}
            </View>
        </View>
    );
};

const RelationsPage: React.FC<{
    viewModel: GanZhiVisualViewModel;
    mode: GanZhiRelationMode;
    contentWidth: number;
    Colors: any;
    styles: ReturnType<typeof makeStyles>;
}> = ({ viewModel, mode, contentWidth, Colors, styles }) => {
    const profiles = mode === 'family' ? viewModel.familyProfiles : viewModel.socialProfiles;
    const profileByKey = new Map(profiles.map((profile) => [profile.pillarKey, profile]));
    return (
        <View style={[styles.pageSurface, { width: contentWidth }]}>
            <View style={styles.relationColumns}>
                {viewModel.pillars.map((pillar) => (
                    <RelationColumn
                        key={pillar.key}
                        pillar={pillar}
                        profile={profileByKey.get(pillar.key)}
                        Colors={Colors}
                        styles={styles}
                    />
                ))}
            </View>
        </View>
    );
};

const RelationColumn: React.FC<{
    pillar: GanZhiVisualPillar;
    profile?: GanZhiRelationProfile;
    Colors: any;
    styles: ReturnType<typeof makeStyles>;
}> = ({ pillar, profile, Colors, styles }) => (
    <View style={styles.relationColumn}>
        <View style={styles.relationLabelsTop}>
            {profile?.stemLabels.map((label) => <Text key={`${pillar.key}-top-${label}`} style={styles.relationMeaning}>{label}</Text>)}
        </View>
        <Text style={styles.relationStar}>{pillar.stemShiShen}</Text>
        <Text style={[styles.relationSymbol, { color: getElementColor(pillar.stemElement, Colors) }]}>{pillar.stem}</Text>
        <Text style={[styles.relationSymbol, { color: getElementColor(pillar.branchElement, Colors) }]}>{pillar.branch}</Text>
        <Text style={styles.relationStar}>{pillar.branchShiShen}</Text>
        <View style={styles.relationLabelsBottom}>
            {profile?.branchLabels.map((label) => <Text key={`${pillar.key}-bottom-${label}`} style={styles.relationMeaning}>{label}</Text>)}
        </View>
    </View>
);

const RelationModeSwitch: React.FC<{
    mode: GanZhiRelationMode;
    onChange: (mode: GanZhiRelationMode) => void;
    bottomInset: number;
    styles: ReturnType<typeof makeStyles>;
}> = ({ mode, onChange, bottomInset, styles }) => (
    <View style={[styles.relationSwitchDock, { paddingBottom: Math.max(bottomInset, Spacing.md) }]}>
        <View style={styles.relationSwitch}>
            <TouchableOpacity
                style={[styles.relationSwitchButton, mode === 'family' && styles.relationSwitchButtonActive]}
                onPress={() => onChange('family')}
                activeOpacity={0.78}
                accessibilityRole="tab"
                accessibilityState={{ selected: mode === 'family' }}
            >
                <Text style={[styles.relationSwitchText, mode === 'family' && styles.relationSwitchTextActive]}>亲属关系</Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[styles.relationSwitchButton, mode === 'social' && styles.relationSwitchButtonActive]}
                onPress={() => onChange('social')}
                activeOpacity={0.78}
                accessibilityRole="tab"
                accessibilityState={{ selected: mode === 'social' }}
            >
                <Text style={[styles.relationSwitchText, mode === 'social' && styles.relationSwitchTextActive]}>社会关系</Text>
            </TouchableOpacity>
        </View>
    </View>
);

const makeStyles = (Colors: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.bg.primary },
    centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.lg },
    stateText: { color: Colors.text.tertiary, fontSize: FontSize.md },
    missingTitle: { color: Colors.text.primary, fontSize: FontSize.lg, fontWeight: '600' },
    returnButton: {
        minHeight: 44,
        paddingHorizontal: Spacing.xl,
        borderRadius: BorderRadius.round,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.bazi.actionBg,
        borderWidth: 1,
        borderColor: Colors.bazi.actionBorder,
    },
    returnButtonText: { color: Colors.bazi.chromeTextActive, fontSize: FontSize.md, fontWeight: '600' },
    simpleHeader: { minHeight: 56, paddingHorizontal: Spacing.md, justifyContent: 'center' },
    visualHeader: {
        minHeight: 68,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: Colors.bazi.chromeBorder,
        backgroundColor: Colors.bg.primary,
    },
    backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    headerIconButton: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: BorderRadius.round,
        backgroundColor: Colors.bazi.actionBg,
        borderWidth: 1,
        borderColor: Colors.bazi.actionBorder,
    },
    visualTabs: {
        flex: 1,
        minHeight: 46,
        flexDirection: 'row',
        padding: 3,
        borderRadius: BorderRadius.xl,
        backgroundColor: Colors.bazi.chromeBg,
        borderWidth: 1,
        borderColor: Colors.bazi.chromeBorder,
    },
    visualTab: { flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: BorderRadius.lg },
    visualTabActive: {
        backgroundColor: Colors.bg.card,
        borderWidth: 1,
        borderColor: Colors.bazi.actionBorder,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 2,
        elevation: 1,
    },
    visualTabText: { color: Colors.bazi.chromeText, fontSize: FontSize.md, fontWeight: '600' },
    visualTabTextActive: { color: Colors.bazi.chromeTextActive },
    content: { flex: 1 },
    scrollContent: { alignItems: 'center' },
    pageSurface: {
        alignSelf: 'center',
        paddingTop: Spacing.sm,
        backgroundColor: Colors.bg.primary,
    },
    flowPageSurface: {
        flex: 1,
        justifyContent: 'center',
        paddingTop: 0,
        paddingBottom: Spacing.sm,
    },
    relationSectionHeader: {
        minHeight: 46,
        paddingHorizontal: Spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    relationSectionMark: {
        width: 3,
        height: 16,
        borderRadius: 2,
        backgroundColor: Colors.bazi.chromeTextActive,
    },
    relationSectionTitle: {
        color: Colors.text.secondary,
        fontSize: FontSize.sm,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    relationSectionRule: {
        flex: 1,
        height: StyleSheet.hairlineWidth,
        backgroundColor: Colors.border.subtle,
    },
    emptyRelations: { alignItems: 'center', justifyContent: 'center' },
    emptyRelationsText: { color: Colors.text.tertiary, fontSize: FontSize.sm },
    sixPillarStrip: {
        marginHorizontal: Spacing.sm,
        flexDirection: 'row',
        overflow: 'hidden',
        borderRadius: BorderRadius.xl,
        borderWidth: 1,
        borderColor: Colors.bazi.actionBorder,
        backgroundColor: Colors.bg.card,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
    },
    sixPillarCell: { flex: 1, minWidth: 0, alignItems: 'center', paddingVertical: 14 },
    sixPillarFortuneCell: { backgroundColor: Colors.bazi.actionBg },
    sixPillarCellBorder: { borderLeftWidth: 1, borderLeftColor: Colors.border.subtle },
    sixPillarLabel: { color: Colors.text.tertiary, fontSize: FontSize.xs, marginBottom: Spacing.sm, fontWeight: '500' },
    sixPillarSymbol: { fontSize: 30, lineHeight: 39, fontWeight: '600' },
    statusRow: { flexDirection: 'row', marginHorizontal: Spacing.sm, minHeight: 38, paddingTop: 6 },
    statusText: { flex: 1, textAlign: 'center', color: Colors.bazi.chromeTextActive, fontSize: FontSize.xs, lineHeight: 16, fontWeight: '600' },
    flowLegend: {
        marginHorizontal: Spacing.sm,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        gap: Spacing.sm,
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
        backgroundColor: Colors.bg.card,
    },
    legendRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    legendIcon: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
    legendIconText: { color: Colors.text.inverse, fontSize: FontSize.md, fontWeight: '700' },
    legendText: { flex: 1, color: Colors.text.primary, fontSize: FontSize.sm, lineHeight: 20 },
    palacePillars: { flexDirection: 'row', paddingTop: Spacing.xxl, paddingHorizontal: Spacing.sm, paddingBottom: Spacing.xl },
    palacePillar: { flex: 1, minWidth: 0, alignItems: 'center' },
    palaceLabels: { minHeight: 90, justifyContent: 'flex-end', alignItems: 'center', gap: 4 },
    palaceLabel: { color: Colors.text.secondary, fontSize: FontSize.sm, textAlign: 'center' },
    palacePillarLabel: { color: Colors.text.tertiary, fontSize: FontSize.sm, marginTop: Spacing.md, marginBottom: Spacing.sm },
    palaceSymbol: { fontSize: 32, lineHeight: 42, fontWeight: '600' },
    palaceCards: { gap: Spacing.sm, paddingHorizontal: Spacing.sm },
    palaceCard: {
        borderRadius: BorderRadius.xl,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
        backgroundColor: Colors.bg.card,
        paddingVertical: Spacing.lg,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 1,
    },
    palaceCardTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, marginBottom: Spacing.lg },
    palaceCardIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.bazi.infoBandBg, alignItems: 'center', justifyContent: 'center' },
    palaceCardTitle: { color: Colors.text.heading, fontSize: FontSize.lg, fontWeight: '600' },
    palaceCardGrid: { flexDirection: 'row' },
    palaceCardCell: { flex: 1, minWidth: 0, alignItems: 'center', paddingHorizontal: 3 },
    palaceCardPrimary: { color: Colors.text.primary, fontSize: FontSize.sm, lineHeight: 21, textAlign: 'center' },
    palaceCardSecondary: { color: Colors.text.secondary, fontSize: FontSize.xs, lineHeight: 18, textAlign: 'center' },
    relationColumns: { flexDirection: 'row', paddingHorizontal: Spacing.sm, paddingTop: Spacing.xxl },
    relationColumn: { flex: 1, minWidth: 0, alignItems: 'center' },
    relationLabelsTop: { minHeight: 116, justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: 2 },
    relationLabelsBottom: { minHeight: 132, alignItems: 'center', paddingHorizontal: 2, paddingBottom: Spacing.lg },
    relationMeaning: { color: Colors.text.secondary, fontSize: FontSize.sm, lineHeight: 23, textAlign: 'center' },
    relationStar: { color: Colors.text.tertiary, fontSize: FontSize.sm, lineHeight: 24, marginVertical: Spacing.xs },
    relationSymbol: { fontSize: 34, lineHeight: 48, fontWeight: '600' },
    relationSwitchDock: {
        paddingTop: Spacing.md,
        paddingHorizontal: Spacing.xl,
        backgroundColor: Colors.bg.primary,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: Colors.border.subtle,
    },
    relationSwitch: {
        alignSelf: 'center',
        width: '82%',
        maxWidth: 400,
        minHeight: 52,
        flexDirection: 'row',
        padding: 3,
        borderRadius: BorderRadius.xl,
        backgroundColor: Colors.bazi.chromeBg,
        borderWidth: 1,
        borderColor: Colors.bazi.chromeBorder,
    },
    relationSwitchButton: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: BorderRadius.lg },
    relationSwitchButtonActive: { backgroundColor: Colors.bg.card, borderWidth: 1, borderColor: Colors.bazi.actionBorder },
    relationSwitchText: { color: Colors.bazi.chromeText, fontSize: FontSize.md },
    relationSwitchTextActive: { color: Colors.bazi.chromeTextActive, fontWeight: '600' },
});
