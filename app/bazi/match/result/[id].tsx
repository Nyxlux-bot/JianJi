import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Svg, { Circle, Line, Polygon, Text as SvgText } from 'react-native-svg';
import { router, useLocalSearchParams } from 'expo-router';
import StatusBarDecor from '../../../../src/components/StatusBarDecor';
import { BackIcon, MoreVerticalIcon, SparklesIcon } from '../../../../src/components/Icons';
import ConfirmModal from '../../../../src/components/ConfirmModal';
import OverflowMenu, { OverflowMenuItem } from '../../../../src/components/OverflowMenu';
import { CustomAlert } from '../../../../src/components/CustomAlertProvider';
import { BaziCompatibilityResult, BaziMatchDimensionScore } from '../../../../src/features/bazi/match/types';
import { getDisplayMarriageYears } from '../../../../src/features/bazi/match/formatter';
import { getBaziMatchClassicRefs, getBaziMatchDimensionReferenceFallbackIds } from '../../../../src/features/bazi/match/classic-references';
import type { BaziMatchClassicReferenceId } from '../../../../src/features/bazi/match/classic-references';
import { deleteRecord, getRecord, toggleFavorite } from '../../../../src/db/database';
import { clearAIAnalysisJob } from '../../../../src/services/ai-analysis-jobs';
import AIChatModal from '../../../../src/components/AIChatModal';
import { isAIConfigured } from '../../../../src/services/settings';
import { BorderRadius, FontSize, Spacing } from '../../../../src/theme/colors';
import { useTheme } from '../../../../src/theme/ThemeContext';

const DIMENSION_ORDER: Array<{ key: BaziMatchDimensionScore['key']; title: string; legacyKey?: string }> = [
    { key: 'harmony', title: '和睦' },
    { key: 'supportHusband', title: '旺夫', legacyKey: 'mutualSupport' },
    { key: 'supportWife', title: '帮妻', legacyKey: 'mutualSupport' },
    { key: 'offspring', title: '子女' },
    { key: 'longevity', title: '同寿', legacyKey: 'lifecycle' },
];

function normalizeDimensions(dimensions: BaziMatchDimensionScore[]): BaziMatchDimensionScore[] {
    return DIMENSION_ORDER.map((target) => {
        const exact = dimensions.find((item) => item.key === target.key);
        if (exact) {
            return { ...exact, title: target.title };
        }
        const legacy = target.legacyKey ? dimensions.find((item) => (item.key as string) === target.legacyKey) : null;
        if (legacy) {
            return { ...legacy, key: target.key, title: target.title };
        }
        return {
            key: target.key,
            title: target.title,
            score: 0,
            grade: '差',
            summary: `${target.title}暂无明细。`,
            evidence: [],
        };
    });
}

function uniqReferenceIds(ids: BaziMatchClassicReferenceId[]): BaziMatchClassicReferenceId[] {
    return [...new Set(ids)];
}

function getDimensionReferenceIds(dimension: BaziMatchDimensionScore): BaziMatchClassicReferenceId[] {
    const evidenceIds = dimension.evidence.flatMap((item) => item.referenceIds || []);
    return uniqReferenceIds(evidenceIds.length > 0 ? evidenceIds : getBaziMatchDimensionReferenceFallbackIds(dimension.key));
}

function formatMarriageReason(reasons: string[]): string {
    return reasons.slice(0, 3).join('；');
}

function buildRadarPoint(index: number, total: number, radius: number, center: number): { x: number; y: number } {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / total;
    return {
        x: center + Math.cos(angle) * radius,
        y: center + Math.sin(angle) * radius,
    };
}

function pointsToString(points: Array<{ x: number; y: number }>): string {
    return points.map((point) => `${point.x},${point.y}`).join(' ');
}


export default function BaziMatchResultPage() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const { Colors } = useTheme();
    const styles = useMemo(() => makeStyles(Colors), [Colors]);
    const mountedRef = useRef(true);
    const [result, setResult] = useState<BaziCompatibilityResult | null>(null);
    const [screenState, setScreenState] = useState<'loading' | 'ready' | 'missing'>('loading');
    const [aiConfigured, setAiConfigured] = useState(false);
    const [aiVisible, setAiVisible] = useState(false);
    const [dimensionSheetVisible, setDimensionSheetVisible] = useState(false);
    const [referenceIds, setReferenceIds] = useState<BaziMatchClassicReferenceId[]>([]);
    const [menuVisible, setMenuVisible] = useState(false);
    const [deleteVisible, setDeleteVisible] = useState(false);
    const [isFavorite, setIsFavorite] = useState(false);

    const displayDimensions = useMemo(() => normalizeDimensions(result?.dimensions || []), [result]);
    const displayMarriageYears = useMemo(() => (result ? getDisplayMarriageYears(result) : []), [result]);

    const load = useCallback(async () => {
        if (!id) {
            return;
        }
        const [detail, configured] = await Promise.all([getRecord(id), isAIConfigured()]);
        if (!mountedRef.current) {
            return;
        }
        setAiConfigured(configured);
        if (!detail) {
            setScreenState('missing');
            return;
        }
        if (detail.engineType !== 'baziCompatibility') {
            if (detail.engineType === 'bazi') {
                router.replace(`/bazi/result/${id}`);
                return;
            }
            if (detail.engineType === 'ziwei') {
                router.replace(`/ziwei/result/${id}`);
                return;
            }
            router.replace(`/result/${id}`);
            return;
        }
        setResult(detail.result);
        setIsFavorite(detail.isFavorite);
        setScreenState('ready');
    }, [id]);

    useEffect(() => {
        mountedRef.current = true;
        void load();
        return () => {
            mountedRef.current = false;
        };
    }, [load]);

    // The AI page owns generation, streaming and failure display for 合盘 too.
    const handleAI = () => {
        if (!result) {
            return;
        }
        if (!aiConfigured) {
            CustomAlert.alert('尚未配置', '请先在设置中配置接口地址和 API Key', [
                { text: '去设置', onPress: () => router.push('/settings') },
                { text: '取消', style: 'cancel' },
            ]);
            return;
        }
        setAiVisible(true);
    };

    const handleToggleFavorite = async () => {
        if (!id) return;
        await toggleFavorite(id);
        setIsFavorite((prev) => !prev);
    };

    const handleDelete = async () => {
        if (!id) return;
        setDeleteVisible(false);
        await clearAIAnalysisJob('baziCompatibility', id);
        await deleteRecord(id);
        router.back();
    };

    const menuItems: OverflowMenuItem[] = [
        { key: 'favorite', label: isFavorite ? '取消收藏' : '收藏合盘', onPress: handleToggleFavorite },
        { key: 'delete', label: '删除合盘', onPress: () => setDeleteVisible(true), destructive: true },
    ];

    if (screenState === 'loading') {
        return (
            <View style={styles.container}>
                <StatusBarDecor />
                <View style={styles.center}><Text style={styles.centerText}>加载中...</Text></View>
            </View>
        );
    }

    if (screenState === 'missing' || !result) {
        return (
            <View style={styles.container}>
                <StatusBarDecor />
                <View style={styles.center}><Text style={styles.centerText}>合盘记录不存在或已被删除</Text></View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBarDecor />
            <View style={styles.compactHeader}>
                <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn} accessibilityRole="button" accessibilityLabel="返回">
                    <BackIcon size={24} />
                </TouchableOpacity>

                <View style={styles.headerSpacer} />

                <TouchableOpacity
                    onPress={handleAI}
                    style={[styles.aiCompactBtn, !aiConfigured && styles.aiCompactBtnDisabled]}
                    activeOpacity={0.82}
                    disabled={!aiConfigured}
                    accessibilityRole="button"
                    accessibilityLabel="AI 分析"
                >
                    <SparklesIcon size={16} color={Colors.text.inverse} />
                    <Text style={styles.aiCompactBtnText}>AI</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setMenuVisible((prev) => !prev)} style={styles.headerBtn} accessibilityRole="button" accessibilityLabel="更多操作">
                    <MoreVerticalIcon size={20} />
                </TouchableOpacity>
            </View>

            <OverflowMenu
                visible={menuVisible}
                top={54}
                right={Spacing.lg}
                items={menuItems}
                onClose={() => setMenuVisible(false)}
            />

            <ScrollView style={styles.content} contentContainerStyle={styles.contentBody} showsVerticalScrollIndicator={false}>
                <View style={styles.heroCard}>
                    <Text style={styles.heroTitle}>{result.maleProfile.name} × {result.femaleProfile.name}</Text>
                    <View style={styles.heroScoreRow}>
                        <Text style={styles.heroScore}>{result.totalScore}</Text>
                        <Text style={styles.heroGrade}>总婚配指数 · {result.grade}</Text>
                    </View>
                    <Text style={styles.heroSummary}>{result.summary}</Text>
                </View>

                <View style={styles.peopleRow}>
                    <PersonCard title="男方" name={result.maleProfile.name} pillars={result.maleProfile.fourPillars.join(' ')} styles={styles} />
                    <PersonCard title="女方" name={result.femaleProfile.name} pillars={result.femaleProfile.fourPillars.join(' ')} styles={styles} />
                </View>

                <TouchableOpacity style={styles.radarCard} activeOpacity={0.86} onPress={() => setDimensionSheetVisible(true)}>
                    <View style={styles.radarHeader}>
                        <View>
                            <Text style={styles.sectionTitle}>五维合盘</Text>
                            <Text style={styles.radarSubtitle}>点开查看五维详断</Text>
                        </View>
                        <View style={styles.radarScoreBadge}>
                            <Text style={styles.radarScore}>{result.totalScore}</Text>
                            <Text style={styles.radarScoreLabel}>{result.grade}</Text>
                        </View>
                    </View>
                    <RadarChart dimensions={displayDimensions} Colors={Colors} />
                    <View style={styles.dimensionPillRow}>
                        {displayDimensions.map((dimension) => (
                            <View key={dimension.key} style={styles.dimensionPill}>
                                <Text style={styles.dimensionPillName}>{dimension.title}</Text>
                                <Text style={styles.dimensionPillScore}>{dimension.score}</Text>
                            </View>
                        ))}
                    </View>
                </TouchableOpacity>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>婚期判断</Text>
                    {displayMarriageYears.length === 0 ? (
                        <Text style={styles.noticeText}>两盘近年未见同年应期，暂不定具体婚年。</Text>
                    ) : displayMarriageYears.map((item, index) => (
                        <View key={`${item.year}-${item.kind}`} style={styles.yearCard}>
                            <View style={styles.yearHeader}>
                                <View>
                                    <Text style={styles.yearTitle}>{item.year}年 · {item.ganZhi}</Text>
                                    <Text style={styles.yearKind}>{index === 0 ? '主应期' : '备选应期'}</Text>
                                </View>
                                {item.maleAge && item.femaleAge ? (
                                    <Text style={styles.yearAge}>男{item.maleAge} · 女{item.femaleAge}</Text>
                                ) : null}
                            </View>
                            <Text style={styles.yearReason}>{formatMarriageReason(item.reasons)}</Text>
                        </View>
                    ))}
                </View>
            </ScrollView>

            <DimensionDetailSheet
                visible={dimensionSheetVisible}
                dimensions={displayDimensions}
                onOpenReferences={setReferenceIds}
                onClose={() => setDimensionSheetVisible(false)}
                styles={styles}
            />

            <ClassicReferenceSheet
                visible={referenceIds.length > 0}
                referenceIds={referenceIds}
                onClose={() => setReferenceIds([])}
                styles={styles}
            />

            <AIChatModal
                visible={aiVisible}
                onClose={() => setAiVisible(false)}
                result={result}
                onUpdateResult={(next) => setResult(next as BaziCompatibilityResult)}
            />

            <ConfirmModal
                visible={deleteVisible}
                title="删除合盘"
                message="确定要删除这条八字合盘记录吗？删除后将无法恢复。"
                confirmText="删除"
                destructive
                onConfirm={handleDelete}
                onCancel={() => setDeleteVisible(false)}
            />
        </View>
    );
}

const PersonCard: React.FC<{ title: string; name: string; pillars: string; styles: ReturnType<typeof makeStyles> }> = ({ title, name, pillars, styles }) => (
    <View style={styles.personCard}>
        <Text style={styles.personLabel}>{title}</Text>
        <Text style={styles.personName} numberOfLines={1}>{name}</Text>
        <Text style={styles.personPillars}>{pillars}</Text>
    </View>
);

const RadarChart: React.FC<{ dimensions: BaziMatchDimensionScore[]; Colors: any }> = ({ dimensions, Colors }) => {
    const size = 260;
    const center = size / 2;
    const radius = 84;
    const levels = [0.25, 0.5, 0.75, 1];
    const gridPolygons = levels.map((level) => pointsToString(dimensions.map((_, index) => buildRadarPoint(index, dimensions.length, radius * level, center))));
    const axisPoints = dimensions.map((_, index) => buildRadarPoint(index, dimensions.length, radius, center));
    const dataPoints = dimensions.map((dimension, index) => buildRadarPoint(index, dimensions.length, radius * Math.max(0, Math.min(1, dimension.score / 100)), center));

    return (
        <View style={{ alignItems: 'center' }}>
            <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                {gridPolygons.map((points, index) => (
                    <Polygon key={`grid-${index}`} points={points} fill="none" stroke={Colors.border.normal} strokeOpacity={0.45} strokeWidth={1} />
                ))}
                {axisPoints.map((point, index) => (
                    <Line key={`axis-${index}`} x1={center} y1={center} x2={point.x} y2={point.y} stroke={Colors.border.subtle} strokeWidth={1} />
                ))}
                <Polygon points={pointsToString(dataPoints)} fill={Colors.accent.gold} fillOpacity={0.2} stroke={Colors.accent.gold} strokeWidth={2} />
                {dataPoints.map((point, index) => (
                    <Circle key={`point-${index}`} cx={point.x} cy={point.y} r={3} fill={Colors.accent.goldLight} />
                ))}
                {dimensions.map((dimension, index) => {
                    const point = buildRadarPoint(index, dimensions.length, radius + 28, center);
                    return (
                        <SvgText
                            key={`label-${dimension.key}`}
                            x={point.x}
                            y={point.y + 4}
                            fill={Colors.text.secondary}
                            fontSize="12"
                            fontWeight="600"
                            textAnchor="middle"
                        >
                            {dimension.title}
                        </SvgText>
                    );
                })}
            </Svg>
        </View>
    );
};

const DimensionDetailSheet: React.FC<{
    visible: boolean;
    dimensions: BaziMatchDimensionScore[];
    onOpenReferences: (ids: BaziMatchClassicReferenceId[]) => void;
    onClose: () => void;
    styles: ReturnType<typeof makeStyles>;
}> = ({ visible, dimensions, onOpenReferences, onClose, styles }) => (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <View style={styles.sheetRoot}>
            <TouchableOpacity style={styles.sheetScrim} activeOpacity={1} onPress={onClose} />
            <View style={styles.sheetPanel}>
                <View style={styles.sheetHandle} />
                <View style={styles.sheetHeader}>
                    <View>
                        <Text style={styles.sheetTitle}>五维详断</Text>
                        <Text style={styles.sheetSubtitle}>每项保留关键命理依据</Text>
                    </View>
                    <TouchableOpacity onPress={onClose} style={styles.sheetCloseBtn}>
                        <Text style={styles.sheetCloseText}>关闭</Text>
                    </TouchableOpacity>
                </View>
                <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheetScrollBody} showsVerticalScrollIndicator={false}>
                    {dimensions.map((dimension) => (
                        <View key={dimension.key} style={styles.dimensionDetailCard}>
                            <View style={styles.dimensionHeader}>
                                <Text style={styles.dimensionTitle}>{dimension.title}</Text>
                                <Text style={styles.dimensionScore}>{dimension.score} · {dimension.grade}</Text>
                            </View>
                            <Text style={styles.dimensionSummary}>{dimension.summary}</Text>
                            {dimension.evidence.slice(0, 3).map((item, index) => (
                                <Text key={`${dimension.key}-${index}`} style={styles.evidenceText}>• {item.label}：{item.detail}</Text>
                            ))}
                            <TouchableOpacity
                                style={styles.referenceBtn}
                                activeOpacity={0.78}
                                onPress={() => onOpenReferences(getDimensionReferenceIds(dimension))}
                            >
                                <Text style={styles.referenceBtnText}>查看依据</Text>
                            </TouchableOpacity>
                        </View>
                    ))}
                </ScrollView>
            </View>
        </View>
    </Modal>
);

const ClassicReferenceSheet: React.FC<{
    visible: boolean;
    referenceIds: BaziMatchClassicReferenceId[];
    onClose: () => void;
    styles: ReturnType<typeof makeStyles>;
}> = ({ visible, referenceIds, onClose, styles }) => {
    const references = getBaziMatchClassicRefs(referenceIds);

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.sheetRoot}>
                <TouchableOpacity style={styles.sheetScrim} activeOpacity={1} onPress={onClose} />
                <View style={styles.referencePanel}>
                    <View style={styles.sheetHandle} />
                    <View style={styles.sheetHeader}>
                        <View>
                            <Text style={styles.sheetTitle}>典籍依据</Text>
                            <Text style={styles.sheetSubtitle}>短引、原意与本地规则</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.sheetCloseBtn}>
                            <Text style={styles.sheetCloseText}>关闭</Text>
                        </TouchableOpacity>
                    </View>
                    <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheetScrollBody} showsVerticalScrollIndicator={false}>
                        {references.map((item) => (
                            <View key={item.id} style={styles.referenceCard}>
                                <View style={styles.referenceHeader}>
                                    <Text style={styles.referenceId}>{item.id}</Text>
                                    <Text style={styles.referenceSection}>{item.section}</Text>
                                </View>
                                <Text style={styles.referenceTitle}>{item.title}</Text>
                                <Text style={styles.referenceSource}>{item.source}</Text>
                                <Text style={styles.referenceQuote}>“{item.quote}”</Text>
                                <Text style={styles.referenceText}>原意：{item.meaning}</Text>
                                <Text style={styles.referenceText}>规则：{item.localRule}</Text>
                                <Text style={styles.referenceBoundary}>边界：{item.boundary}</Text>
                            </View>
                        ))}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};

const makeStyles = (Colors: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.bg.primary },
    compactHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        height: 48,
        paddingHorizontal: Spacing.xs,
        paddingVertical: Spacing.xs,
        backgroundColor: Colors.bg.primary,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border.subtle,
    },
    headerBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
    headerSpacer: { flex: 1 },
    aiCompactBtn: {
        height: 32,
        paddingHorizontal: 8,
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.accent.gold,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
    },
    aiHeaderBtnDisabled: { opacity: 0.45 },
    aiCompactBtnDisabled: { opacity: 0.45 },
    aiCompactBtnText: { color: Colors.text.inverse, fontSize: FontSize.xs, fontWeight: '700' },
    content: { flex: 1 },
    contentBody: { padding: Spacing.lg, paddingBottom: 48, gap: Spacing.lg },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
    centerText: { color: Colors.text.secondary, fontSize: FontSize.md },
    heroCard: {
        borderRadius: BorderRadius.xl,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
        backgroundColor: Colors.bg.card,
        padding: Spacing.xl,
        gap: Spacing.sm,
    },
    heroTitle: { color: Colors.text.heading, fontSize: FontSize.lg, fontWeight: '600', textAlign: 'center' },
    heroScoreRow: { alignItems: 'center', justifyContent: 'center', gap: 2 },
    heroScore: { color: Colors.accent.gold, fontSize: 52, fontWeight: '300', lineHeight: 58 },
    heroGrade: { color: Colors.text.secondary, fontSize: FontSize.sm },
    heroSummary: { color: Colors.text.primary, fontSize: FontSize.md, lineHeight: 24, textAlign: 'center' },
    peopleRow: { flexDirection: 'row', gap: Spacing.md },
    personCard: {
        flex: 1,
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
        backgroundColor: Colors.bg.card,
        padding: Spacing.md,
        gap: 4,
    },
    personLabel: { color: Colors.text.tertiary, fontSize: FontSize.sm },
    personName: { color: Colors.text.heading, fontSize: FontSize.md, fontWeight: '600' },
    personPillars: { color: Colors.accent.gold, fontSize: FontSize.sm, lineHeight: 20 },
    section: { gap: Spacing.sm },
    sectionTitle: { color: Colors.text.heading, fontSize: FontSize.lg, fontWeight: '600' },
    radarCard: {
        borderRadius: BorderRadius.xl,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
        backgroundColor: Colors.bg.card,
        padding: Spacing.lg,
        gap: Spacing.md,
    },
    radarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md },
    radarSubtitle: { color: Colors.text.secondary, fontSize: FontSize.sm, marginTop: 2 },
    radarScoreBadge: {
        minWidth: 60,
        minHeight: 60,
        borderRadius: 30,
        borderWidth: 1,
        borderColor: Colors.border.accent,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(207,181,59,0.08)',
    },
    radarScore: { color: Colors.accent.gold, fontSize: FontSize.xl, fontWeight: '700' },
    radarScoreLabel: { color: Colors.text.secondary, fontSize: FontSize.xs },
    dimensionPillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    dimensionPill: {
        flexGrow: 1,
        minWidth: 92,
        borderRadius: BorderRadius.round,
        backgroundColor: Colors.bg.elevated,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    dimensionPillName: { color: Colors.text.secondary, fontSize: FontSize.sm },
    dimensionPillScore: { color: Colors.accent.gold, fontSize: FontSize.sm, fontWeight: '700' },
    dimensionDetailCard: {
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
        backgroundColor: Colors.bg.card,
        padding: Spacing.md,
        gap: Spacing.xs,
    },
    dimensionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.md },
    dimensionTitle: { flex: 1, color: Colors.text.heading, fontSize: FontSize.md, fontWeight: '600' },
    dimensionScore: { color: Colors.accent.gold, fontSize: FontSize.md, fontWeight: '600' },
    dimensionSummary: { color: Colors.text.secondary, fontSize: FontSize.sm, lineHeight: 20 },
    evidenceText: { color: Colors.text.primary, fontSize: FontSize.sm, lineHeight: 21 },
    referenceBtn: {
        alignSelf: 'flex-start',
        minHeight: 32,
        borderRadius: BorderRadius.round,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
        backgroundColor: Colors.bg.elevated,
        paddingHorizontal: Spacing.md,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: Spacing.xs,
    },
    referenceBtnText: { color: Colors.accent.gold, fontSize: FontSize.sm, fontWeight: '600' },
    yearCard: {
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
        backgroundColor: Colors.bg.card,
        padding: Spacing.md,
        gap: Spacing.sm,
    },
    yearHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.md },
    yearTitle: { color: Colors.text.heading, fontSize: FontSize.md, fontWeight: '600' },
    yearKind: { color: Colors.accent.gold, fontSize: FontSize.sm, marginTop: 2 },
    yearAge: { color: Colors.text.secondary, fontSize: FontSize.sm, lineHeight: 20 },
    yearReason: { color: Colors.text.secondary, fontSize: FontSize.sm, lineHeight: 21 },
    noticeText: { color: Colors.text.secondary, fontSize: FontSize.sm, lineHeight: 21 },
    sheetRoot: { flex: 1, justifyContent: 'flex-end' },
    sheetScrim: { ...StyleSheet.absoluteFill, backgroundColor: Colors.bg.overlay },
    sheetPanel: {
        maxHeight: '78%',
        borderTopLeftRadius: BorderRadius.xl,
        borderTopRightRadius: BorderRadius.xl,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
        backgroundColor: Colors.bg.secondary,
        paddingTop: Spacing.sm,
        paddingHorizontal: Spacing.lg,
        paddingBottom: Spacing.lg,
    },
    referencePanel: {
        maxHeight: '72%',
        borderTopLeftRadius: BorderRadius.xl,
        borderTopRightRadius: BorderRadius.xl,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
        backgroundColor: Colors.bg.secondary,
        paddingTop: Spacing.sm,
        paddingHorizontal: Spacing.lg,
        paddingBottom: Spacing.lg,
    },
    sheetHandle: {
        alignSelf: 'center',
        width: 42,
        height: 4,
        borderRadius: 2,
        backgroundColor: Colors.border.normal,
        marginBottom: Spacing.md,
    },
    sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.md },
    sheetTitle: { color: Colors.text.heading, fontSize: FontSize.lg, fontWeight: '700' },
    sheetSubtitle: { color: Colors.text.secondary, fontSize: FontSize.sm, marginTop: 2 },
    sheetActions: { flexDirection: 'row', gap: Spacing.sm },
    sheetCloseBtn: {
        minHeight: 34,
        paddingHorizontal: Spacing.md,
        borderRadius: BorderRadius.round,
        backgroundColor: Colors.bg.elevated,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sheetCloseText: { color: Colors.accent.gold, fontSize: FontSize.sm, fontWeight: '600' },
    sheetScroll: { flexGrow: 0 },
    sheetScrollBody: { gap: Spacing.md, paddingBottom: Spacing.xl },
    aiMarkdownCard: {
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
        backgroundColor: Colors.bg.card,
        padding: Spacing.md,
    },
    referenceCard: {
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
        backgroundColor: Colors.bg.card,
        padding: Spacing.md,
        gap: Spacing.xs,
    },
    referenceHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    referenceId: {
        color: Colors.text.inverse,
        backgroundColor: Colors.accent.gold,
        borderRadius: BorderRadius.round,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 2,
        fontSize: FontSize.xs,
        fontWeight: '700',
        overflow: 'hidden',
    },
    referenceSection: { color: Colors.text.tertiary, fontSize: FontSize.xs },
    referenceTitle: { color: Colors.text.heading, fontSize: FontSize.md, fontWeight: '700' },
    referenceSource: { color: Colors.text.secondary, fontSize: FontSize.sm },
    referenceQuote: {
        color: Colors.accent.goldLight,
        fontSize: FontSize.sm,
        lineHeight: 22,
        paddingVertical: Spacing.xs,
    },
    referenceText: { color: Colors.text.primary, fontSize: FontSize.sm, lineHeight: 21 },
    referenceBoundary: { color: Colors.text.secondary, fontSize: FontSize.sm, lineHeight: 21 },
});
