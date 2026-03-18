import React, {
    memo,
    startTransition,
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import {
    FlatList,
    LayoutChangeEvent,
    Modal,
    NativeScrollEvent,
    NativeSyntheticEvent,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View,
    type ViewStyle,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
    cancelAnimation,
    interpolate,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import AIChatModal from '../../src/components/AIChatModal';
import ConfirmModal from '../../src/components/ConfirmModal';
import { BackIcon, MoreVerticalIcon, SparklesIcon } from '../../src/components/Icons';
import OverflowMenu, { OverflowMenuItem } from '../../src/components/OverflowMenu';
import StatusBarDecor from '../../src/components/StatusBarDecor';
import { CustomAlert } from '../../src/components/CustomAlertProvider';
import { deleteRecord, getRecord, saveRecord, toggleFavorite } from '../../src/db/database';
import { cloneZiweiFormatterContext } from '../../src/features/ziwei/ai-context';
import { computeZiweiTileStarsLayout } from '../../src/features/ziwei/brightness/tile-layout';
import ZiweiConfigPanel from '../../src/features/ziwei/components/ZiweiConfigPanel';
import {
    buildZiweiZoomDisplayLayout,
    canCloseZiweiZoom,
    canOpenZiweiZoom,
    resolveZiweiZoomPalaceName,
    type ZiweiZoomPhase,
} from '../../src/features/ziwei/brightness/zoom-layout';
import {
    buildZiweiAIConfigSignature,
    buildZiweiRecordResult,
    buildZiweiSummary,
    hasZiweiAIArtifacts,
    isZiweiAIConfigStale,
    isZiweiRuleSignatureCurrent,
    ZiweiRecordResult,
} from '../../src/features/ziwei/record';
import {
    clearPendingZiweiRecord,
    getPendingZiweiRecord,
    primePendingZiweiRecord,
    retryPendingZiweiPersist,
    subscribePendingZiweiRecord,
} from '../../src/features/ziwei/pending-result-cache';
import { resolveZiweiResultBootstrapPlan } from '../../src/features/ziwei/result-bootstrap';
import { buildZiweiResultRoute } from '../../src/features/ziwei/result-route';
import { isAIConfigured } from '../../src/services/settings';
import { useTheme } from '../../src/theme/ThemeContext';
import { BorderRadius, FontSize, Spacing } from '../../src/theme/colors';
import { formatLocalDateTime } from '../../src/core/bazi-local-time';
import { useDebounce } from '../../src/hooks/useDebounce';
import {
    buildZiweiStaticCacheKey,
    getZiweiStaticStarInsights,
    parseZiweiRouteParams,
    ZIWEI_DEFAULT_CONFIG,
} from '../../src/features/ziwei/iztro-adapter';
import {
    ZiweiChartEngine,
    type ZiweiPreparedScopeBundle,
} from '../../src/features/ziwei/chart-engine';
import {
    buildZiweiBoardMetrics,
    buildZiweiBoardRenderModelFromScopeModel,
    buildZiweiChartSnapshot,
    buildZiweiHoroscopePalaceView,
    getCurrentScopeSummary,
    hydrateZiweiBoardSnapshotModel,
    buildZiweiZoomMotion,
} from '../../src/features/ziwei/view-model';
import type {
    ZiweiActiveScope,
    ZiweiBoardDecorationModel,
    ZiweiBoardMetrics,
    ZiweiBoardRenderModel,
    ZiweiBoardScopeModel,
    ZiweiBoardSnapshotModel,
    ZiweiBranchSlotCell,
    ZiweiChartSnapshotV1,
    ZiweiDynamicHoroscopeResult,
    ZiweiHoroscopePalaceView,
    ZiweiHoroscopeMutagenStars,
    ZiweiInputPayload,
    ZiweiOrbitDrawerRow,
    ZiweiOrbitDrawerState,
    ZiweiOrbitTrackItem,
    ZiweiPalaceAnalysisView,
    ZiweiPalaceDecorationView,
    ZiweiPalaceOverlayView,
    ZiweiPalaceSelectionRenderModel,
    ZiweiPalaceRenderModel,
    ZiweiStarInsightView,
    ZiweiStarViewModel,
    ZiweiStaticChartResult,
    ZiweiTopTab,
    ZiweiZoomRect,
    ZiweiZoomTarget,
} from '../../src/features/ziwei/types';

const TOP_TABS: Array<{ key: ZiweiTopTab; label: string }> = [
    { key: 'chart', label: '命盘' },
    { key: 'pattern', label: '格局分析' },
    { key: 'palace', label: '宫位详解' },
    { key: 'info', label: '基本信息' },
];

const SCOPE_OPTIONS: Array<{ key: ZiweiActiveScope; label: string }> = [
    { key: 'decadal', label: '大限' },
    { key: 'yearly', label: '流年' },
    { key: 'monthly', label: '流月' },
    { key: 'daily', label: '流日' },
    { key: 'hourly', label: '流时' },
];

const ACTIVE_SCOPE_LABELS: Record<ZiweiActiveScope, string> = {
    decadal: '大限',
    age: '小限',
    yearly: '流年',
    monthly: '流月',
    daily: '流日',
    hourly: '流时',
};

const DRAWER_PEEK_HEIGHT = 40;
const DRAWER_TRACK_ITEM_WIDTH = 96;

interface MeasuredBoardShellRect extends ZiweiZoomRect {
    scrollY: number;
}

interface ZiweiTileFrame {
    left: number;
    top: number;
    width: number;
    height: number;
}

interface ZiweiZoomRuntimeState {
    phase: ZiweiZoomPhase;
    target: ZiweiZoomTarget | null;
    motion: ReturnType<typeof buildZiweiZoomMotion> | null;
}

interface ZiweiDynamicSnapshotState {
    status: 'idle' | 'loading' | 'ready' | 'error';
    chartKey: string | null;
    snapshot: ZiweiDynamicHoroscopeResult | null;
    error: string;
}

interface ZiweiScopeBundleState {
    status: 'idle' | 'loading' | 'ready' | 'error';
    chartKey: string | null;
    bundle: ZiweiPreparedScopeBundle | null;
    error: string;
}

const ZIWEI_DOUBLE_TAP_DELAY = 250;
const ZIWEI_ZOOM_OPEN_DURATION = 180;
const ZIWEI_ZOOM_CLOSE_DURATION = 150;
const ZIWEI_ZOOM_CLOSED_STATE: ZiweiZoomRuntimeState = {
    phase: 'closed',
    target: null,
    motion: null,
};

function waitForNextPaint(): Promise<void> {
    return new Promise((resolve) => {
        requestAnimationFrame(() => resolve());
    });
}

function formatDateTime(date: Date): string {
    return formatLocalDateTime(date).replace('T', ' ');
}

function toStarLabel(star: ZiweiStarViewModel): string {
    return [star.name, star.brightness || '', star.mutagen ? `化${star.mutagen}` : ''].join('');
}

function formatTileMutagen(mutagen?: string): string {
    return mutagen || '';
}

function isZiweiDevEnv(): boolean {
    return typeof globalThis !== 'undefined'
        && '__DEV__' in globalThis
        ? Boolean((globalThis as typeof globalThis & { __DEV__?: boolean }).__DEV__)
        : false;
}

function logZiweiRuntimeWarning(scope: string, error: unknown): void {
    if (!isZiweiDevEnv()) {
        return;
    }

    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[ziwei][${scope}]`, message);
}

function firstStarName(palace: ZiweiPalaceAnalysisView): string | null {
    return palace.majorStars[0]?.name || palace.minorStars[0]?.name || palace.adjectiveStars[0]?.name || null;
}

function formatInputSemantic(chart: ZiweiStaticChartResult): string {
    if (chart.input.calendarType === 'lunar' && chart.input.lunar) {
        return `农历 ${chart.input.lunar.label || ''}`.trim();
    }

    return `公历 ${chart.input.solarDate}`;
}

function formatConfigSummary(chart: ZiweiStaticChartResult): string {
    return [
        chart.input.config.algorithm === 'zhongzhou' ? '中州' : '通行',
        chart.input.config.yearDivide === 'exact' ? '年界立春' : '年界农历',
        chart.input.config.horoscopeDivide === 'exact' ? '运限立春' : '运限农历',
        chart.input.config.dayDivide === 'current' ? '晚子算当日' : '晚子算次日',
        chart.input.config.astroType === 'earth'
            ? '地盘'
            : chart.input.config.astroType === 'human'
                ? '人盘'
                : '天盘',
    ].join(' · ');
}

function formatHoroscopeMutagenStars(mutagenStars: ZiweiHoroscopeMutagenStars): string {
    const parts = [
        mutagenStars.lu ? `禄:${mutagenStars.lu}` : '',
        mutagenStars.quan ? `权:${mutagenStars.quan}` : '',
        mutagenStars.ke ? `科:${mutagenStars.ke}` : '',
        mutagenStars.ji ? `忌:${mutagenStars.ji}` : '',
    ].filter(Boolean);

    return parts.join(' · ') || '无四化';
}

function getBoardCellFrame(cell: ZiweiBranchSlotCell, metrics: ZiweiBoardMetrics): ZiweiTileFrame {
    return {
        left: metrics.boardInset + cell.col * (metrics.cellWidth + metrics.gap),
        top: metrics.boardInset + cell.row * (metrics.cellHeight + metrics.gap),
        width: metrics.cellWidth,
        height: metrics.cellHeight,
    };
}

function getCenterPanelFrame(metrics: ZiweiBoardMetrics) {
    const offsetX = metrics.boardInset + metrics.cellWidth + metrics.gap;
    const offsetY = metrics.boardInset + metrics.cellHeight + metrics.gap;

    return {
        left: offsetX,
        top: offsetY,
        width: metrics.centerWidth,
        height: metrics.centerHeight,
    };
}

function buildZoomRectFromFrame(
    boardShellRect: MeasuredBoardShellRect,
    frame: ZiweiTileFrame,
    scrollY: number,
): ZiweiZoomRect {
    const scrollDelta = scrollY - boardShellRect.scrollY;

    return {
        x: boardShellRect.x + frame.left,
        y: boardShellRect.y + frame.top - scrollDelta,
        width: frame.width,
        height: frame.height,
    };
}

function getZiweiPalaceCardStyles(
    styles: ZiweiPalaceCardStyles,
    renderModel?: ZiweiTileRenderModel,
    options?: { showCardTint?: boolean },
) {
    const showCardTint = options?.showCardTint ?? true;

    return [
        styles.palaceCard,
        showCardTint && renderModel?.selected && styles.palaceCellSelected,
        showCardTint && renderModel?.highlightKind === 'target' && styles.palaceCellTarget,
        showCardTint && renderModel?.highlightKind === 'opposite' && styles.palaceCellOpposite,
        showCardTint && renderModel?.highlightKind === 'wealth' && styles.palaceCellWealth,
        showCardTint && renderModel?.highlightKind === 'career' && styles.palaceCellCareer,
    ];
}

function getOverlayToneColor(overlay: ZiweiPalaceOverlayView, Colors: any) {
    switch (overlay.tone) {
        case 'decadal':
            return '#7E6DFF';
        case 'age':
            return '#53B8FF';
        case 'yearly':
            return '#D99C27';
        case 'monthly':
            return Colors.accent.jade;
        case 'daily':
            return '#7CD38A';
        case 'hourly':
            return '#C98DFF';
        default:
            return Colors.text.secondary;
    }
}

function buildAnalysisCards(
    selectedPalace: ZiweiPalaceAnalysisView,
    selectedStar: ZiweiStarInsightView | null,
    selectedScopePalace: ZiweiHoroscopePalaceView | null,
) {
    return [
        {
            key: 'flight',
            title: '飞星系统',
            lines: [
                `飞化去向：${selectedPalace.flight.destinations.map((item) => `${item.mutagen}→${item.palaceName || '无'}`).join(' · ')}`,
                `自化：${selectedPalace.flight.selfMutagens.join(' / ') || '无'}；生年四化：${selectedPalace.flight.birthMutagens.join(' / ') || '无'}`,
                `飞向宫位：${selectedPalace.flight.targets.map((item) => `${item.palaceName}:${item.mutagens.join('')}`).join(' · ') || '无'}`,
            ],
        },
        {
            key: 'surround',
            title: '三方四正',
            lines: [
                `${selectedPalace.surrounded.target} / ${selectedPalace.surrounded.opposite} / ${selectedPalace.surrounded.wealth} / ${selectedPalace.surrounded.career}`,
                `主星：${selectedPalace.surrounded.majorStars.join(' · ') || '无'}`,
                `辅曜：${selectedPalace.surrounded.minorStars.join(' · ') || '无'}`,
                `判定：${selectedPalace.surrounded.checks.map((item) => `${item.label}${item.matched ? '✓' : '·'}`).join(' ｜ ')}`,
            ],
        },
        {
            key: 'scope',
            title: '当前运限',
            lines: selectedScopePalace
                ? [
                    `${selectedScopePalace.requestedPalaceName} → ${selectedScopePalace.resolvedPalaceName} · ${selectedScopePalace.heavenlyStem}${selectedScopePalace.earthlyBranch}`,
                    `四化：${formatHoroscopeMutagenStars(selectedScopePalace.mutagenStars)}`,
                    `流耀：${selectedScopePalace.directHoroscopeStars.join(' / ') || '当前 scope 无直取 API'}`,
                ]
                : ['当前未选中可计算的运限宫位。'],
        },
        {
            key: 'star',
            title: '选中星曜',
            lines: selectedStar
                ? [
                    `${selectedStar.name} · ${selectedStar.palaceName} / ${selectedStar.oppositePalaceName}`,
                    `亮度：${selectedStar.brightnessMatches.join(' / ') || selectedStar.brightness || '无'}`,
                    `四化：${selectedStar.mutagenFlags.map((item) => `化${item}`).join(' / ') || '无'}`,
                ]
                : ['当前宫位没有可聚焦的星曜。'],
        },
    ];
}

function buildSelectedPalaceSummary(selectedPalace: ZiweiPalaceAnalysisView): string {
    return [
        selectedPalace.decadalRange,
        selectedPalace.isBodyPalace ? '身宫' : '',
        selectedPalace.isOriginalPalace ? '来因宫' : '',
        selectedPalace.isEmpty ? '空宫' : '',
    ].filter(Boolean).join(' · ');
}

function buildPillarColumnsFromChineseDate(chineseDate: string) {
    const parts = chineseDate.split(' ');
    const headers = ['年', '月', '日', '时'];

    return parts.map((part, index) => ({
        key: headers[index] || `p-${index}`,
        header: headers[index] || '--',
        value: part || '--',
    }));
}

function buildPillarColumns(chart: ZiweiStaticChartResult) {
    return buildPillarColumnsFromChineseDate(chart.astrolabe.chineseDate);
}

function buildChartStatusLine(
    chart: ZiweiStaticChartResult,
    activeScope: ZiweiActiveScope,
    selectedPalace: ZiweiPalaceAnalysisView,
): string {
    return [
        chart.astrolabe.fiveElementsClass,
        `命主${chart.astrolabe.soul} / 身主${chart.astrolabe.body}`,
        `当前${ACTIVE_SCOPE_LABELS[activeScope]}`,
        `焦点${selectedPalace.name}`,
    ].join(' · ');
}

function buildStaticShellStatusLine(
    snapshot: ZiweiChartSnapshotV1,
    selectedPalace: ZiweiPalaceAnalysisView,
    stageLabel: string = '静态盘',
): string {
    return [
        snapshot.staticMeta.fiveElementsClass,
        `命主${snapshot.staticMeta.soul} / 身主${snapshot.staticMeta.body}`,
        stageLabel,
        `焦点${selectedPalace.name}`,
    ].join(' · ');
}

function getZiweiRuleDriftMessage(record: ZiweiRecordResult | null, hasSnapshot: boolean): string | null {
    if (!record) {
        return null;
    }

    if (isZiweiRuleSignatureCurrent(record.ruleSignature)) {
        return null;
    }

    if (hasSnapshot) {
        return '该历史命盘的静态盘按保存时快照展示，当前运限与 AI 内容按现版本规则重建，结果可能与保存当时略有差异。';
    }

    return '该历史命盘未保存完整静态快照，当前页面与 AI 已按当前版本规则重建，结果可能与保存当时略有差异。';
}

function buildUpdatedZiweiRecord(params: {
    baseRecord: ZiweiRecordResult;
    staticChart: ZiweiStaticChartResult;
    dynamic: ZiweiDynamicHoroscopeResult;
}): ZiweiRecordResult {
    const { baseRecord, staticChart, dynamic } = params;
    const rebuiltRecord = buildZiweiRecordResult({
        staticChart,
        dynamic,
        id: baseRecord.id,
        createdAt: baseRecord.createdAt,
    });
    const configChanged = buildZiweiAIConfigSignature(baseRecord.config) !== buildZiweiAIConfigSignature(rebuiltRecord.config);
    const hasAI = hasZiweiAIArtifacts(baseRecord);

    return {
        ...rebuiltRecord,
        aiAnalysis: baseRecord.aiAnalysis,
        aiChatHistory: baseRecord.aiChatHistory,
        quickReplies: baseRecord.quickReplies,
        aiConversationDigest: baseRecord.aiConversationDigest,
        aiConversationStage: baseRecord.aiConversationStage,
        aiVerificationSummary: baseRecord.aiVerificationSummary,
        aiConfigSignature: baseRecord.aiConfigSignature,
        aiInvalidatedAt: configChanged && hasAI
            ? new Date().toISOString()
            : baseRecord.aiInvalidatedAt,
    };
}

function buildPersistStatusNotice(status: 'saving' | 'saved' | 'error' | null, errorMessage: string): { tone: 'neutral' | 'warning'; text: string } | null {
    if (status === 'saving') {
        return {
            tone: 'neutral',
            text: '命盘正在后台写入记录，当前页面可继续查看；写入完成后会自动切换为正式记录。',
        };
    }

    if (status === 'error') {
        return {
            tone: 'warning',
            text: errorMessage || '命盘保存失败，请重试写入。',
        };
    }

    return null;
}

export default function ZiweiResultPage() {
    const { Colors } = useTheme();
    const insets = useSafeAreaInsets();
    const { width: screenWidth, height: screenHeight } = useWindowDimensions();
    const boardMetrics = useMemo(() => buildZiweiBoardMetrics(screenWidth), [screenWidth]);
    const styles = useMemo(() => makeStyles(Colors, boardMetrics), [Colors, boardMetrics]);
    const compactBoard = boardMetrics.cellWidth < 88;
    const params = useLocalSearchParams<{
        birthLocal?: string | string[];
        longitude?: string | string[];
        gender?: string | string[];
        tzOffsetMinutes?: string | string[];
        dst?: string | string[];
        calendarType?: string | string[];
        lunarYear?: string | string[];
        lunarMonth?: string | string[];
        lunarDay?: string | string[];
        isLeapMonth?: string | string[];
        algorithm?: string | string[];
        yearDivide?: string | string[];
        horoscopeDivide?: string | string[];
        dayDivide?: string | string[];
        astroType?: string | string[];
        cityLabel?: string | string[];
        name?: string | string[];
        timeIndex?: string | string[];
        recordId?: string | string[];
        recordCreatedAt?: string | string[];
        routeDraft?: string | string[];
    }>();
    const recordId = useMemo(() => (
        Array.isArray(params.recordId) ? params.recordId[0] : params.recordId
    ), [params.recordId]);
    const recordCreatedAt = useMemo(() => (
        Array.isArray(params.recordCreatedAt) ? params.recordCreatedAt[0] : params.recordCreatedAt
    ), [params.recordCreatedAt]);
    const routeDraftRequested = useMemo(() => (
        (Array.isArray(params.routeDraft) ? params.routeDraft[0] : params.routeDraft) === '1'
    ), [params.routeDraft]);

    const [activeTopTab, setActiveTopTab] = useState<ZiweiTopTab>('chart');
    const [activeScope, setActiveScope] = useState<ZiweiActiveScope>('yearly');
    const [drawerExpanded, setDrawerExpanded] = useState(false);
    const [cursorDate, setCursorDate] = useState<Date>(new Date());
    const [selectedPalaceName, setSelectedPalaceName] = useState('命宫');
    const [selectedStarName, setSelectedStarName] = useState<string | null>(null);
    const [zoomState, setZoomState] = useState<ZiweiZoomRuntimeState>(ZIWEI_ZOOM_CLOSED_STATE);
    const [recordDetail, setRecordDetail] = useState<Awaited<ReturnType<typeof getRecord>> | null | undefined>(undefined);
    const [recordResult, setRecordResult] = useState<ZiweiRecordResult | null>(null);
    const [activePayload, setActivePayload] = useState<ZiweiInputPayload | null>(null);
    const [isFavorite, setIsFavorite] = useState(false);
    const [aiConfigured, setAiConfigured] = useState(false);
    const [aiChatVisible, setAiChatVisible] = useState(false);
    const [menuVisible, setMenuVisible] = useState(false);
    const [settingsVisible, setSettingsVisible] = useState(false);
    const [settingsDraftConfig, setSettingsDraftConfig] = useState<ZiweiInputPayload['config'] | null>(null);
    const [deleteVisible, setDeleteVisible] = useState(false);
    const [persistStatus, setPersistStatus] = useState<'saving' | 'saved' | 'error' | null>(null);
    const [persistError, setPersistError] = useState('');
    const [staticState, setStaticState] = useState<{
        status: 'loading' | 'ready' | 'error';
        chart: ZiweiStaticChartResult | null;
        error: string;
    }>({
        status: 'loading',
        chart: null,
        error: '',
    });
    const [dynamicState, setDynamicState] = useState<ZiweiDynamicSnapshotState>({
        status: 'idle',
        chartKey: null,
        snapshot: null,
        error: '',
    });
    const [scopeBundleState, setScopeBundleState] = useState<ZiweiScopeBundleState>({
        status: 'idle',
        chartKey: null,
        bundle: null,
        error: '',
    });

    const deferredCursorDate = useDebounce(cursorDate, 300);
    const isPersisting = persistStatus === 'saving';
    const hasPersistedRecord = persistStatus === null || persistStatus === 'saved';
    const zoomProgress = useSharedValue(0);
    const chartScrollOffsetRef = useRef(0);
    const zoomCardTapRef = useRef(0);
    const zoomStateRef = useRef<ZiweiZoomRuntimeState>(ZIWEI_ZOOM_CLOSED_STATE);
    const lastValidScopeBundleRef = useRef<ZiweiPreparedScopeBundle | null>(null);
    const lastValidDynamicRef = useRef<ZiweiDynamicHoroscopeResult | null>(null);

    const parsed = useMemo(() => parseZiweiRouteParams({
        birthLocal: params.birthLocal,
        longitude: params.longitude,
        gender: params.gender,
        tzOffsetMinutes: params.tzOffsetMinutes,
        dst: params.dst,
        calendarType: params.calendarType,
        lunarYear: params.lunarYear,
        lunarMonth: params.lunarMonth,
        lunarDay: params.lunarDay,
        isLeapMonth: params.isLeapMonth,
        algorithm: params.algorithm,
        yearDivide: params.yearDivide,
        horoscopeDivide: params.horoscopeDivide,
        dayDivide: params.dayDivide,
        astroType: params.astroType,
        cityLabel: params.cityLabel,
        name: params.name,
        timeIndex: params.timeIndex,
    }), [
        params.algorithm,
        params.astroType,
        params.birthLocal,
        params.calendarType,
        params.cityLabel,
        params.dayDivide,
        params.dst,
        params.gender,
        params.horoscopeDivide,
        params.isLeapMonth,
        params.lunarDay,
        params.lunarMonth,
        params.lunarYear,
        params.longitude,
        params.name,
        params.timeIndex,
        params.tzOffsetMinutes,
        params.yearDivide,
    ]);

    useEffect(() => {
        let cancelled = false;

        const applyZiweiDetail = (detail: { result: ZiweiRecordResult; isFavorite: boolean } | null) => {
            if (!detail) {
                setRecordDetail(null);
                setRecordResult(null);
                setIsFavorite(false);
                return;
            }

            setRecordDetail({
                engineType: 'ziwei',
                result: detail.result,
                isFavorite: detail.isFavorite,
            });
            setRecordResult(detail.result);
            setIsFavorite(detail.isFavorite);
        };

        const loadFromStorage = async (clearSavedPending: boolean = false) => {
            if (!recordId) {
                return;
            }

            const detail = await getRecord(recordId);
            if (cancelled) {
                return;
            }

            setRecordDetail(detail);
            if (!detail || detail.engineType !== 'ziwei') {
                setRecordResult(null);
                setIsFavorite(detail?.isFavorite || false);
                if (!detail && !getPendingZiweiRecord(recordId)) {
                    setPersistStatus(null);
                    setPersistError('');
                }
                return;
            }

            setRecordResult(detail.result);
            setIsFavorite(detail.isFavorite);
            setPersistStatus(null);
            setPersistError('');
            if (clearSavedPending && getPendingZiweiRecord(recordId)?.status === 'saved') {
                clearPendingZiweiRecord(recordId);
            }
        };

        if (!recordId) {
            setRecordDetail(null);
            setRecordResult(null);
            setIsFavorite(false);
            setActivePayload(null);
            setPersistStatus(null);
            setPersistError('');
            return;
        }

        setRecordDetail(undefined);
        const pending = getPendingZiweiRecord(recordId);
        if (pending && pending.status !== 'saved') {
            applyZiweiDetail({
                result: pending.result,
                isFavorite: pending.isFavorite,
            });
            setPersistStatus(pending.status);
            setPersistError(pending.errorMessage);
        } else if (routeDraftRequested) {
            setPersistStatus(null);
            setPersistError('');
            setRecordDetail(null);
            setRecordResult(null);
        } else {
            setPersistStatus(null);
            setPersistError('');
            void loadFromStorage(pending?.status === 'saved');
        }

        const unsubscribe = subscribePendingZiweiRecord(recordId, () => {
            if (cancelled) {
                return;
            }
            const latestPending = getPendingZiweiRecord(recordId);
            if (!latestPending) {
                return;
            }
            if (latestPending.status === 'saved') {
                void loadFromStorage(true);
                return;
            }

            applyZiweiDetail({
                result: latestPending.result,
                isFavorite: latestPending.isFavorite,
            });
            setPersistStatus(latestPending.status);
            setPersistError(latestPending.errorMessage);
        });

        return () => {
            cancelled = true;
            unsubscribe();
        };
    }, [recordId, routeDraftRequested]);

    const bootstrapPlan = useMemo(() => resolveZiweiResultBootstrapPlan({
        parsed,
        recordId,
        recordDetail,
        preferRoutePayload: routeDraftRequested,
    }), [parsed, recordDetail, recordId, routeDraftRequested]);
    const seedPayload = bootstrapPlan.kind === 'live' ? bootstrapPlan.payload : null;
    const snapshotChart = bootstrapPlan.kind === 'live' ? bootstrapPlan.snapshot : null;
    const seedPayloadKey = useMemo(() => (
        seedPayload ? buildZiweiStaticCacheKey(seedPayload) : null
    ), [seedPayload]);
    const activePayloadKey = useMemo(() => (
        activePayload ? buildZiweiStaticCacheKey(activePayload) : null
    ), [activePayload]);
    const staticChart = useMemo(() => (
        staticState.chart && activePayloadKey && staticState.chart.cacheKey === activePayloadKey
            ? staticState.chart
            : null
    ), [activePayloadKey, staticState.chart]);
    const dynamic = useMemo(() => (
        dynamicState.snapshot && activePayloadKey && dynamicState.chartKey === activePayloadKey
            ? dynamicState.snapshot
            : null
    ), [activePayloadKey, dynamicState.chartKey, dynamicState.snapshot]);
    const currentScopeBundle = useMemo(() => (
        scopeBundleState.bundle && activePayloadKey && scopeBundleState.chartKey === activePayloadKey
            ? scopeBundleState.bundle
            : null
    ), [activePayloadKey, scopeBundleState.bundle, scopeBundleState.chartKey]);

    useEffect(() => {
        if (bootstrapPlan.kind !== 'redirect') {
            return;
        }

        router.replace(bootstrapPlan.pathname);
    }, [bootstrapPlan]);

    useEffect(() => {
        if (bootstrapPlan.kind !== 'live' || !seedPayload) {
            setActivePayload(null);
            setSettingsDraftConfig(null);
            return;
        }

        setActivePayload(seedPayload);
        setSettingsDraftConfig(null);
    }, [bootstrapPlan.kind, recordId, seedPayload, seedPayloadKey]);

    useEffect(() => {
        lastValidScopeBundleRef.current = null;
        lastValidDynamicRef.current = null;
    }, [activePayloadKey, recordId, staticChart?.cacheKey]);

    useEffect(() => {
        let cancelled = false;

        if (bootstrapPlan.kind === 'load-record') {
            setStaticState({
                status: 'loading',
                chart: null,
                error: '',
            });
            setDynamicState({
                status: 'idle',
                chartKey: null,
                snapshot: null,
                error: '',
            });
            setScopeBundleState({
                status: 'idle',
                chartKey: null,
                bundle: null,
                error: '',
            });
            return;
        }

        if (bootstrapPlan.kind === 'error') {
            setStaticState({
                status: 'error',
                chart: null,
                error: bootstrapPlan.message,
            });
            setDynamicState({
                status: 'idle',
                chartKey: null,
                snapshot: null,
                error: '',
            });
            setScopeBundleState({
                status: 'idle',
                chartKey: null,
                bundle: null,
                error: '',
            });
            return;
        }

        if (bootstrapPlan.kind !== 'live' || !activePayload) {
            setDynamicState({
                status: 'idle',
                chartKey: null,
                snapshot: null,
                error: '',
            });
            setScopeBundleState({
                status: 'idle',
                chartKey: null,
                bundle: null,
                error: '',
            });
            return;
        }

        if (
            staticState.status === 'ready'
            && staticState.chart
            && staticState.chart.cacheKey === activePayloadKey
            && staticState.chart.input.name === activePayload.name
            && staticState.chart.input.cityLabel === activePayload.cityLabel
        ) {
            return;
        }

        setStaticState({
            status: 'loading',
            chart: null,
            error: '',
        });
        setDynamicState({
            status: 'idle',
            chartKey: null,
            snapshot: null,
            error: '',
        });
        setScopeBundleState({
            status: 'idle',
            chartKey: null,
            bundle: null,
            error: '',
        });

        const restoreChart = async () => {
            if (bootstrapPlan.source === 'history_snapshot' && bootstrapPlan.snapshot) {
                await waitForNextPaint();
            } else {
                // Let the loading screen paint before we start a very heavy cold static compute.
                await waitForNextPaint();
                await waitForNextPaint();
            }

            try {
                const chart = await ZiweiChartEngine.prepareStaticChart(activePayload);
                if (!cancelled) {
                    setStaticState({
                        status: 'ready',
                        chart,
                        error: '',
                    });
                }
            } catch (error: unknown) {
                logZiweiRuntimeWarning('prepareStaticChart', error);
                if (!cancelled) {
                    setStaticState({
                        status: 'error',
                        chart: null,
                        error: error instanceof Error ? error.message : '命盘参数无效，无法恢复静态命盘。',
                    });
                }
            }
        };

        void restoreChart();

        return () => {
            cancelled = true;
        };
    }, [activePayload, activePayloadKey, bootstrapPlan.kind, snapshotChart, staticState.chart, staticState.status]);

    useEffect(() => {
        let cancelled = false;

        if (!staticChart) {
            setDynamicState({
                status: 'idle',
                chartKey: null,
                snapshot: null,
                error: '',
            });
            return;
        }

        setDynamicState((prev) => ({
            status: 'loading',
            chartKey: staticChart.cacheKey,
            snapshot: prev.chartKey === staticChart.cacheKey ? prev.snapshot : null,
            error: '',
        }));
        void ZiweiChartEngine.prepareDynamicSnapshot(staticChart, deferredCursorDate)
            .then((nextDynamic) => {
                if (!cancelled) {
                    setDynamicState({
                        status: 'ready',
                        chartKey: staticChart.cacheKey,
                        snapshot: nextDynamic,
                        error: '',
                    });
                }
            })
            .catch((error: unknown) => {
                logZiweiRuntimeWarning('prepareDynamicSnapshot', error);
                if (!cancelled) {
                    setDynamicState((prev) => ({
                        status: 'error',
                        chartKey: staticChart.cacheKey,
                        snapshot: prev.chartKey === staticChart.cacheKey ? prev.snapshot : null,
                        error: error instanceof Error ? error.message : '动态运限快照计算失败。',
                    }));
                }
            });

        return () => {
            cancelled = true;
        };
    }, [deferredCursorDate, staticChart]);

    useEffect(() => {
        let cancelled = false;

        if (!staticChart) {
            setScopeBundleState({
                status: 'idle',
                chartKey: null,
                bundle: null,
                error: '',
            });
            return;
        }

        setScopeBundleState((prev) => ({
            status: 'loading',
            chartKey: staticChart.cacheKey,
            bundle: prev.chartKey === staticChart.cacheKey && prev.bundle?.scope === activeScope ? prev.bundle : null,
            error: '',
        }));
        void ZiweiChartEngine.prepareScopeBundle(staticChart, deferredCursorDate, activeScope)
            .then((nextScopeBundle) => {
                if (!cancelled) {
                    setScopeBundleState({
                        status: 'ready',
                        chartKey: staticChart.cacheKey,
                        bundle: nextScopeBundle,
                        error: '',
                    });
                }
            })
            .catch((error: unknown) => {
                logZiweiRuntimeWarning('prepareScopeBundle', error);
                if (!cancelled) {
                    setScopeBundleState((prev) => ({
                        status: 'error',
                        chartKey: staticChart.cacheKey,
                        bundle: prev.chartKey === staticChart.cacheKey && prev.bundle?.scope === activeScope ? prev.bundle : null,
                        error: error instanceof Error ? error.message : '当前运限视图计算失败。',
                    }));
                }
            });

        return () => {
            cancelled = true;
        };
    }, [activeScope, deferredCursorDate, staticChart]);

    useEffect(() => {
        if (
            !staticChart
            || dynamicState.status !== 'ready'
            || !dynamicState.snapshot
            || dynamicState.chartKey !== staticChart.cacheKey
            || scopeBundleState.status !== 'ready'
            || !scopeBundleState.bundle
            || scopeBundleState.chartKey !== staticChart.cacheKey
        ) {
            return;
        }

        lastValidDynamicRef.current = dynamicState.snapshot;
        lastValidScopeBundleRef.current = scopeBundleState.bundle;
    }, [
        dynamicState.chartKey,
        dynamicState.snapshot,
        dynamicState.status,
        scopeBundleState.bundle,
        scopeBundleState.chartKey,
        scopeBundleState.status,
        staticChart,
    ]);

    const generatedShellSnapshot = useMemo(() => (
        staticChart ? buildZiweiChartSnapshot(staticChart) : null
    ), [staticChart]);
    const shellSnapshot = snapshotChart || generatedShellSnapshot;
    const effectiveScopeBundle = useMemo(() => {
        if (currentScopeBundle) {
            return currentScopeBundle;
        }

        const staleScopeBundle = lastValidScopeBundleRef.current;
        if (!staticChart || !staleScopeBundle || !staleScopeBundle.cacheKey.startsWith(`${staticChart.cacheKey}|`)) {
            return null;
        }

        return staleScopeBundle;
    }, [activeScope, currentScopeBundle, scopeBundleState.status, staticChart]);
    const renderedDynamic = useMemo(() => {
        if (currentScopeBundle) {
            return dynamic || lastValidDynamicRef.current || null;
        }

        return lastValidDynamicRef.current || dynamic;
    }, [currentScopeBundle, dynamic, scopeBundleState.status]);
    const currentScopeModel = useMemo<ZiweiBoardScopeModel | null>(() => (
        effectiveScopeBundle?.boardScopeModel ?? null
    ), [activeScope, effectiveScopeBundle]);
    const currentBoardDecorations = useMemo<ZiweiBoardDecorationModel | null>(() => (
        effectiveScopeBundle?.boardDecorations ?? null
    ), [activeScope, effectiveScopeBundle]);
    const currentOrbitDrawerState = useMemo<ZiweiOrbitDrawerState | null>(() => (
        effectiveScopeBundle?.orbitDrawerState ?? null
    ), [activeScope, effectiveScopeBundle]);
    const currentSelectedDirectScope = useMemo(() => (
        effectiveScopeBundle?.selectedDirectScope ?? null
    ), [activeScope, effectiveScopeBundle]);
    const renderedScope = currentScopeModel?.activeScope || activeScope;
    const effectiveTopTab: ZiweiTopTab = staticChart && renderedDynamic ? activeTopTab : 'chart';
    const starInsights = useMemo(() => {
        if (!staticChart || (effectiveTopTab !== 'pattern' && effectiveTopTab !== 'palace')) {
            return null;
        }

        return getZiweiStaticStarInsights(staticChart);
    }, [effectiveTopTab, staticChart]);

    const starByName = useMemo(() => (
        starInsights?.starByName || {}
    ), [starInsights]);

    const shellBoardModel = useMemo<ZiweiBoardSnapshotModel | null>(() => (
        shellSnapshot ? hydrateZiweiBoardSnapshotModel(shellSnapshot, selectedPalaceName) : null
    ), [selectedPalaceName, shellSnapshot]);
    const shellPalaceByName = useMemo<Record<string, ZiweiPalaceAnalysisView> | null>(() => (
        shellSnapshot
            ? Object.fromEntries(shellSnapshot.palaces.map((palace) => [palace.name, palace])) as Record<string, ZiweiPalaceAnalysisView>
            : null
    ), [shellSnapshot]);
    const displayPalaceByName = staticChart?.palaceByName || shellPalaceByName;
    const zoomVisible = zoomState.phase !== 'closed';
    const zoomTarget = zoomState.target;
    const zoomMotion = zoomState.motion;
    const selectedPalace = displayPalaceByName?.[selectedPalaceName] || displayPalaceByName?.命宫 || null;
    const shellSelectedPalace = shellPalaceByName?.[selectedPalaceName] || shellPalaceByName?.命宫 || null;
    const fallbackStarName = staticChart && selectedPalace ? firstStarName(selectedPalace) : null;
    const selectedStar = !staticChart || effectiveTopTab === 'chart'
        ? null
        : (selectedStarName && starByName[selectedStarName]) || (fallbackStarName ? starByName[fallbackStarName] : null);
    const boardRenderModel = useMemo(() => {
        if (!staticChart || !renderedDynamic || !currentScopeModel) {
            return null;
        }

        return buildZiweiBoardRenderModelFromScopeModel({
            staticChart,
            dynamic: renderedDynamic,
            scopeModel: currentScopeModel,
            selectedPalaceName,
        });
    }, [currentScopeModel, renderedDynamic, selectedPalaceName, staticChart]);
    const selectedScopePalace = useMemo(() => {
        if (!staticChart || !renderedDynamic || !selectedPalace || renderedScope === 'age') {
            return null;
        }

        return buildZiweiHoroscopePalaceView(
            staticChart.astrolabe,
            renderedDynamic.horoscopeNow,
            selectedPalace.name,
            renderedScope,
            currentSelectedDirectScope,
        );
    }, [currentSelectedDirectScope, renderedDynamic, renderedScope, selectedPalace, staticChart]);
    const analysisCards = useMemo(() => (
        effectiveTopTab === 'pattern' && selectedPalace
            ? buildAnalysisCards(selectedPalace, selectedStar, selectedScopePalace)
            : []
    ), [effectiveTopTab, selectedPalace, selectedScopePalace, selectedStar]);
    const pillarColumns = useMemo(() => (
        staticChart
            ? buildPillarColumns(staticChart)
            : shellSnapshot
                ? buildPillarColumnsFromChineseDate(shellSnapshot.staticMeta.chineseDate)
                : []
    ), [shellSnapshot, staticChart]);
    const snapshotGender = recordResult?.gender || staticChart?.input.gender || seedPayload?.gender || 'male';
    const currentName = staticChart?.input.name?.trim() || recordResult?.name?.trim() || seedPayload?.name?.trim() || '匿名命盘';
    const ruleDriftMessage = useMemo(() => (
        getZiweiRuleDriftMessage(recordResult, Boolean(snapshotChart))
    ), [recordResult, snapshotChart]);
    const persistNotice = useMemo(() => buildPersistStatusNotice(persistStatus, persistError), [persistError, persistStatus]);
    const aiConfigStale = useMemo(() => isZiweiAIConfigStale(recordResult), [recordResult]);
    const settingsDirty = useMemo(() => {
        const currentConfig = activePayload?.config || recordResult?.config || staticChart?.input.config || null;
        if (!settingsDraftConfig || !currentConfig) {
            return false;
        }

        return buildZiweiAIConfigSignature(settingsDraftConfig) !== buildZiweiAIConfigSignature(currentConfig);
    }, [activePayload, recordResult, settingsDraftConfig, staticChart]);
    const zoomViewport = useMemo(() => ({
        width: screenWidth,
        height: screenHeight,
        paddingTop: insets.top + 56,
        paddingBottom: insets.bottom + 24,
        paddingHorizontal: Spacing.lg,
    }), [insets.bottom, insets.top, screenHeight, screenWidth]);
    const liveBoardReady = Boolean(staticChart && renderedDynamic && selectedPalace && boardRenderModel);
    const zoomDisplayLayout = useMemo(() => (
        zoomTarget ? buildZiweiZoomDisplayLayout(zoomTarget.rect, zoomViewport) : null
    ), [zoomTarget, zoomViewport]);
    const zoomPalaceName = useMemo(() => (
        resolveZiweiZoomPalaceName(zoomTarget, selectedPalaceName)
    ), [selectedPalaceName, zoomTarget]);
    const zoomPalace = displayPalaceByName?.[zoomPalaceName] || null;
    const zoomPalaceRenderModel = zoomPalace
        ? (liveBoardReady ? boardRenderModel?.byPalaceName[zoomPalace.name] : shellBoardModel?.byPalaceName[zoomPalace.name])
        : undefined;
    const zoomPalaceDecoration = liveBoardReady && zoomPalace ? currentBoardDecorations?.byPalaceName[zoomPalace.name] : undefined;
    const ziweiFormatterContext = useMemo(() => cloneZiweiFormatterContext({
        cursorDateIso: cursorDate.toISOString(),
        activeScope,
        selectedPalaceName,
        selectedStarName,
        activeTopTab: effectiveTopTab,
    }), [activeScope, cursorDate, effectiveTopTab, selectedPalaceName, selectedStarName]);
    const showStaticShell = !liveBoardReady && Boolean(shellSnapshot && shellBoardModel && shellSelectedPalace);
    const showPlaceholderShell = !liveBoardReady && !showStaticShell && staticState.status !== 'error';
    const staticFatalError = staticState.status === 'error' && !showStaticShell;
    const boardStageNotice = showStaticShell
        ? (
            staticState.status === 'error'
                ? '静态命盘已保留，当前版本命盘恢复失败，已降级为静态展示。'
                : dynamicState.status === 'error'
                    ? '当前动态运限恢复失败，已降级为静态命盘。'
                    : scopeBundleState.status === 'error'
                        ? (effectiveScopeBundle
                            ? '当前运限切换失败，页面保留上一份结果。'
                            : '当前运限视图恢复失败，已降级为静态命盘。')
                        : '静态命盘已先行打开，动态运限与增强信息会在后台完成后无缝接入。'
        )
        : null;
    const liveBundleWarning = (dynamicState.status === 'error' || scopeBundleState.status === 'error') && liveBoardReady
        ? '当前运限切换失败，页面保留上一份结果。'
        : null;

    const zoomAnimatedStyle = useAnimatedStyle(() => {
        const progress = zoomProgress.value;
        const initialScale = zoomMotion?.initialScale ?? 1;
        const translateX = interpolate(progress, [0, 1], [zoomMotion?.translateX ?? 0, 0]);
        const translateY = interpolate(progress, [0, 1], [zoomMotion?.translateY ?? 0, 0]);
        const scale = interpolate(progress, [0, 1], [initialScale, 1]);

        return {
            opacity: interpolate(progress, [0, 1], [0.32, 1]),
            transform: [
                { translateX },
                { translateY },
                { scale },
            ],
        };
    });

    const commitZoomState = useCallback((nextState: ZiweiZoomRuntimeState) => {
        zoomStateRef.current = nextState;
        setZoomState(nextState);
    }, []);

    const resetZoomState = useCallback(() => {
        zoomCardTapRef.current = 0;
        commitZoomState(ZIWEI_ZOOM_CLOSED_STATE);
        zoomProgress.value = 0;
    }, [commitZoomState, zoomProgress]);

    const markZoomOpen = useCallback(() => {
        const current = zoomStateRef.current;
        if (current.phase !== 'opening') {
            return;
        }

        commitZoomState({
            ...current,
            phase: 'open',
        });
    }, [commitZoomState]);

    const handleCloseZoom = useCallback(() => {
        const current = zoomStateRef.current;
        if (!canCloseZiweiZoom(current.phase)) {
            return;
        }
        zoomCardTapRef.current = 0;
        if (!current.target) {
            resetZoomState();
            return;
        }

        commitZoomState({
            ...current,
            phase: 'closing',
        });
        cancelAnimation(zoomProgress);
        zoomProgress.value = withTiming(0, { duration: ZIWEI_ZOOM_CLOSE_DURATION }, (finished) => {
            if (finished) {
                runOnJS(resetZoomState)();
            }
        });
    }, [commitZoomState, resetZoomState, zoomProgress]);

    useEffect(() => {
        if (zoomState.phase !== 'opening' || !zoomState.motion) {
            return;
        }

        cancelAnimation(zoomProgress);
        zoomProgress.value = 0;
        zoomProgress.value = withTiming(1, { duration: ZIWEI_ZOOM_OPEN_DURATION }, (finished) => {
            if (finished) {
                runOnJS(markZoomOpen)();
            }
        });
    }, [markZoomOpen, zoomProgress, zoomState.motion, zoomState.phase]);

    const handleOpenZoom = useCallback((target: ZiweiZoomTarget) => {
        const current = zoomStateRef.current;
        if (!canOpenZiweiZoom(current.phase)) {
            return;
        }

        zoomCardTapRef.current = 0;
        const nextZoomLayout = buildZiweiZoomDisplayLayout(target.rect, zoomViewport);
        commitZoomState({
            phase: 'opening',
            target,
            motion: buildZiweiZoomMotion(target.rect, nextZoomLayout.rect, screenWidth, screenHeight),
        });
    }, [commitZoomState, screenHeight, screenWidth, zoomViewport]);

    const handleZoomCardPress = useCallback(() => {
        const now = Date.now();
        if (zoomCardTapRef.current && now - zoomCardTapRef.current < ZIWEI_DOUBLE_TAP_DELAY) {
            zoomCardTapRef.current = 0;
            handleCloseZoom();
            return;
        }

        zoomCardTapRef.current = now;
    }, [handleCloseZoom]);

    const handleChartScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
        chartScrollOffsetRef.current = event.nativeEvent.contentOffset.y;
    }, []);

    const handleSelectCursor = useCallback((item: ZiweiOrbitTrackItem, scope: ZiweiActiveScope) => {
        startTransition(() => {
            if (scope !== activeScope) {
                setActiveScope(scope);
            }
            setCursorDate(item.cursorDate);
        });
    }, [activeScope]);

    const handleScopeChange = useCallback((scope: ZiweiActiveScope) => {
        startTransition(() => {
            setActiveScope(scope);
        });
    }, []);

    const handleToggleDrawer = useCallback(() => {
        startTransition(() => {
            setDrawerExpanded((value) => !value);
        });
    }, []);

    const handleDrawerExpandedChange = useCallback((expanded: boolean) => {
        startTransition(() => {
            setDrawerExpanded(expanded);
        });
    }, []);

    const handleTopTabChange = useCallback((tab: ZiweiTopTab) => {
        startTransition(() => {
            setActiveTopTab(tab);
        });
    }, []);

    const handleSelectPalace = useCallback((palaceName: string) => {
        startTransition(() => {
            setSelectedPalaceName(palaceName);
            if (!staticChart) {
                setSelectedStarName(null);
                return;
            }
            setSelectedStarName(firstStarName(staticChart.palaceByName[palaceName]));
        });
    }, [staticChart]);

    useEffect(() => {
        setActiveTopTab('chart');
        setDrawerExpanded(false);
        setSelectedPalaceName('命宫');
        setSelectedStarName(null);
        setSettingsVisible(false);
        setSettingsDraftConfig(null);
    }, [recordId, seedPayloadKey]);

    useEffect(() => {
        let cancelled = false;
        const loadAIConfig = async () => {
            const configured = await isAIConfigured();
            if (!cancelled) {
                setAiConfigured(configured);
            }
        };
        void loadAIConfig();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (
            !routeDraftRequested
            || !recordId
            || !staticChart
            || !dynamic
            || recordResult
            || bootstrapPlan.kind !== 'live'
            || bootstrapPlan.source !== 'route'
            || getPendingZiweiRecord(recordId)
        ) {
            return;
        }

        const nextRecord = buildZiweiRecordResult({
            staticChart,
            dynamic,
            id: recordId,
            createdAt: recordCreatedAt,
        });
        const envelope = {
            engineType: 'ziwei' as const,
            result: nextRecord,
            summary: buildZiweiSummary(nextRecord),
        };

        primePendingZiweiRecord({
            result: nextRecord,
            envelope,
            isFavorite,
            persist: () => saveRecord(envelope),
        });
        setRecordDetail({
            engineType: 'ziwei',
            result: nextRecord,
            isFavorite,
        });
        setRecordResult(nextRecord);
        setPersistStatus('saving');
        setPersistError('');
        router.replace(buildZiweiResultRoute({
            payload: activePayload || staticChart.input,
            computed: staticChart.input,
            recordId: nextRecord.id,
            recordCreatedAt: nextRecord.createdAt,
            routeDraft: false,
        }));
    }, [
        activePayload,
        bootstrapPlan,
        dynamic,
        isFavorite,
        recordCreatedAt,
        recordId,
        recordResult,
        routeDraftRequested,
        staticChart,
    ]);

    const handleOpenAIChat = () => {
        if (!recordResult) {
            CustomAlert.alert('提示', '当前命盘未关联可写回的紫微记录。请先从保存后的命盘进入。');
            return;
        }
        if (!aiConfigured) {
            CustomAlert.alert('未配置AI', '请先在设置中配置 AI 接口地址和 API Key', [
                { text: '去设置', onPress: () => router.push('/settings') },
                { text: '取消', style: 'cancel' },
            ]);
            return;
        }
        setAiChatVisible(true);
    };

    const handleEdit = () => {
        if (!recordId || isPersisting) {
            return;
        }
        router.push(`/ziwei/input?editId=${recordId}`);
    };

    const handleOpenSettings = () => {
        if (!recordResult) {
            return;
        }
        setPersistError('');
        setSettingsDraftConfig(activePayload?.config || recordResult.config);
        setSettingsVisible(true);
    };

    const handleDismissSettings = useCallback(() => {
        if (persistStatus === 'saving') {
            return;
        }

        setSettingsVisible(false);
        setSettingsDraftConfig(null);
        setPersistError('');
    }, [persistStatus]);

    const handleConfigChange = (nextConfig: ZiweiInputPayload['config']) => {
        setSettingsDraftConfig(nextConfig);
    };

    const handleRetryPersist = () => {
        if (!recordId) {
            return;
        }

        const pending = getPendingZiweiRecord(recordId);
        if (pending) {
            retryPendingZiweiPersist(recordId);
            return;
        }

        if (settingsVisible) {
            void handleSaveSettings();
        }
    };

    const handleSaveSettings = useCallback(async () => {
        if (!settingsDirty) {
            handleDismissSettings();
            return;
        }

        if (!recordId || !recordResult || !activePayload || !settingsDraftConfig) {
            handleDismissSettings();
            return;
        }

        setPersistStatus('saving');
        setPersistError('');
        try {
            const nextPayload: ZiweiInputPayload = {
                ...activePayload,
                config: settingsDraftConfig,
            };
            const nextStaticChart = await ZiweiChartEngine.prepareStaticChart(nextPayload);
            const nextDynamic = await ZiweiChartEngine.prepareDynamicSnapshot(nextStaticChart, cursorDate);
            const nextScopeBundle = await ZiweiChartEngine.prepareScopeBundle(nextStaticChart, cursorDate, activeScope);
            const nextRecord = buildUpdatedZiweiRecord({
                baseRecord: recordResult,
                staticChart: nextStaticChart,
                dynamic: nextDynamic,
            });

            await saveRecord({
                engineType: 'ziwei',
                result: nextRecord,
                summary: buildZiweiSummary(nextRecord),
            });

            setActivePayload(nextPayload);
            setStaticState({
                status: 'ready',
                chart: nextStaticChart,
                error: '',
            });
            setDynamicState({
                status: 'ready',
                chartKey: nextStaticChart.cacheKey,
                snapshot: nextDynamic,
                error: '',
            });
            setScopeBundleState({
                status: 'ready',
                chartKey: nextStaticChart.cacheKey,
                bundle: nextScopeBundle,
                error: '',
            });
            lastValidDynamicRef.current = nextDynamic;
            lastValidScopeBundleRef.current = nextScopeBundle;
            setRecordResult(nextRecord);
            setRecordDetail({
                engineType: 'ziwei',
                result: nextRecord,
                isFavorite,
            });
            setSettingsVisible(false);
            setSettingsDraftConfig(null);
            setPersistStatus(null);
            router.replace(buildZiweiResultRoute({
                payload: nextPayload,
                computed: nextStaticChart.input,
                recordId,
                recordCreatedAt: nextRecord.createdAt,
                routeDraft: false,
            }));
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : '紫微配置保存失败';
            setPersistStatus('error');
            setPersistError(message);
            CustomAlert.alert('保存失败', `${message}。当前页面仍保留最新盘面，可重试保存。`);
        }
    }, [
        activePayload,
        activeScope,
        cursorDate,
        handleDismissSettings,
        isFavorite,
        recordId,
        recordResult,
        selectedPalaceName,
        settingsDirty,
        settingsDraftConfig,
    ]);

    const handleToggleFavorite = async () => {
        if (!recordId || !recordResult || !hasPersistedRecord) {
            return;
        }
        await toggleFavorite(recordId);
        setIsFavorite((prev) => !prev);
    };

    const handleDelete = async () => {
        if (!recordId || !recordResult || !hasPersistedRecord) {
            return;
        }
        setDeleteVisible(false);
        await deleteRecord(recordId);
        router.back();
    };

    const menuItems: OverflowMenuItem[] = [
        { key: 'settings', label: '排盘设置', onPress: handleOpenSettings, disabled: !recordResult || !hasPersistedRecord || isPersisting },
        { key: 'edit', label: '修改内容', onPress: handleEdit, disabled: !recordId || !recordResult || isPersisting },
        { key: 'favorite', label: isFavorite ? '取消收藏' : '收藏结果', onPress: handleToggleFavorite, disabled: !recordId || !recordResult || !hasPersistedRecord },
        { key: 'delete', label: '删除记录', onPress: () => setDeleteVisible(true), destructive: true, disabled: !recordId || !recordResult || !hasPersistedRecord },
    ];
    const hasEnabledMenuItems = menuItems.some((item) => !item.disabled);
    const chartStatusLine = liveBoardReady && staticChart && selectedPalace
        ? buildChartStatusLine(staticChart, activeScope, selectedPalace)
        : showStaticShell && shellSnapshot && shellSelectedPalace
            ? buildStaticShellStatusLine(
                shellSnapshot,
                shellSelectedPalace,
                snapshotChart ? '历史快照' : '静态盘',
            )
            : '紫微斗数';

    if (staticFatalError) {
        return (
            <View style={styles.container}>
                <StatusBarDecor />
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
                        <BackIcon size={24} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>紫微斗数</Text>
                    <View style={styles.headerBtn} />
                </View>
                <View style={styles.errorWrap}>
                    <Text style={styles.errorTitle}>命盘无法恢复</Text>
                    <Text style={styles.errorText}>{staticState.error || '静态命盘恢复失败。'}</Text>
                    <TouchableOpacity style={styles.errorAction} onPress={() => router.replace('/ziwei/input')} activeOpacity={0.84}>
                        <Text style={styles.errorActionText}>返回重新排盘</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBarDecor />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
                    <BackIcon size={24} />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <TouchableOpacity
                        onPress={handleOpenAIChat}
                        style={[styles.aiHeaderBtn, (!aiConfigured || !recordResult) && styles.aiHeaderBtnDisabled]}
                        activeOpacity={0.82}
                        disabled={!aiConfigured || !recordResult}
                    >
                        <SparklesIcon size={18} color={Colors.text.inverse} />
                        <Text style={styles.aiHeaderBtnText}>AI 分析</Text>
                    </TouchableOpacity>
                </View>
                <View style={styles.headerActions}>
                    <TouchableOpacity
                        onPress={() => setMenuVisible((prev) => !prev)}
                        style={[styles.headerBtn, !hasEnabledMenuItems && styles.headerBtnDisabled]}
                        disabled={!hasEnabledMenuItems}
                    >
                        <MoreVerticalIcon size={20} />
                    </TouchableOpacity>
                </View>
            </View>
            <OverflowMenu
                visible={menuVisible}
                top={insets.top + 54}
                right={Spacing.lg}
                items={menuItems}
                onClose={() => setMenuVisible(false)}
            />

            <View style={styles.topTabsWrap}>
                {TOP_TABS.map((tab) => {
                    const active = effectiveTopTab === tab.key;
                    const disabled = !liveBoardReady && tab.key !== 'chart';
                    return (
                        <TouchableOpacity
                            key={tab.key}
                            style={[styles.topTabBtn, active && styles.topTabBtnActive, disabled && styles.topTabBtnDisabled]}
                            onPress={() => {
                                if (!disabled) {
                                    handleTopTabChange(tab.key);
                                }
                            }}
                            activeOpacity={0.84}
                            disabled={disabled}
                        >
                            <Text style={[styles.topTabText, active && styles.topTabTextActive, disabled && styles.topTabTextDisabled]}>{tab.label}</Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            <View style={styles.screenSubtitleWrap}>
                <Text style={styles.screenSubtitle}>{chartStatusLine}</Text>
            </View>
            {ruleDriftMessage ? (
                <View style={styles.ruleDriftCard}>
                    <Text style={styles.ruleDriftText}>{ruleDriftMessage}</Text>
                </View>
            ) : null}
            {persistNotice ? (
                <View style={[styles.ruleDriftCard, persistNotice.tone === 'warning' && styles.persistWarningCard]}>
                    <Text style={styles.ruleDriftText}>{persistNotice.text}</Text>
                    {persistNotice.tone === 'warning' ? (
                        <TouchableOpacity style={styles.persistRetryBtn} onPress={handleRetryPersist}>
                            <Text style={styles.persistRetryBtnText}>重试保存</Text>
                        </TouchableOpacity>
                    ) : null}
                </View>
            ) : null}
            {aiConfigStale ? (
                <View style={[styles.ruleDriftCard, styles.aiStaleCard]}>
                    <Text style={styles.ruleDriftText}>
                        当前 AI 分析基于旧排盘口径，已失效。旧内容仍可查看，但继续追问前需要按当前配置重新开始 AI 分析。
                    </Text>
                </View>
            ) : null}
            {liveBundleWarning ? (
                <View style={[styles.ruleDriftCard, styles.persistWarningCard]}>
                    <Text style={styles.ruleDriftText}>{liveBundleWarning}</Text>
                </View>
            ) : null}

            {effectiveTopTab === 'chart' ? (
                <View style={styles.chartStage}>
                    <ScrollView
                        style={styles.chartScroll}
                        contentContainerStyle={{
                            paddingBottom: Math.max(0, DRAWER_PEEK_HEIGHT + insets.bottom - 6),
                            paddingTop: 0,
                        }}
                        onScroll={handleChartScroll}
                        scrollEventThrottle={16}
                        showsVerticalScrollIndicator={false}
                    >
                        {showStaticShell && shellSnapshot && shellBoardModel && shellSelectedPalace ? (
                            <>
                                <ZiweiSnapshotBoard
                                    snapshot={shellSnapshot}
                                    snapshotBoardModel={shellBoardModel}
                                    metrics={boardMetrics}
                                    currentName={currentName}
                                    gender={snapshotGender}
                                    chartScrollOffsetRef={chartScrollOffsetRef}
                                    onSelectPalace={handleSelectPalace}
                                    onOpenZoom={handleOpenZoom}
                                />
                                {boardStageNotice ? (
                                    <View style={styles.snapshotRestoreCard}>
                                        <Text style={styles.snapshotRestoreText}>{boardStageNotice}</Text>
                                    </View>
                                ) : null}
                            </>
                        ) : showPlaceholderShell ? (
                            <ZiweiBoardPlaceholder
                                metrics={boardMetrics}
                                styles={styles}
                            />
                        ) : (
                            <ZiweiBoard
                                staticChart={staticChart!}
                                boardRenderModel={boardRenderModel}
                                boardDecorations={currentBoardDecorations}
                                metrics={boardMetrics}
                                activeScope={activeScope}
                                selectedPalaceName={selectedPalace!.name}
                                currentHoroscope={renderedDynamic!}
                                currentName={currentName}
                                chartScrollOffsetRef={chartScrollOffsetRef}
                                onSelectPalace={handleSelectPalace}
                                onOpenZoom={handleOpenZoom}
                            />
                        )}
                    </ScrollView>

                    {liveBoardReady && currentOrbitDrawerState ? (
                        <ZiweiOrbitDrawer
                            orbitState={currentOrbitDrawerState}
                            activeScope={activeScope}
                            drawerExpanded={drawerExpanded}
                            onToggleExpanded={handleToggleDrawer}
                            onExpandedChange={handleDrawerExpandedChange}
                            onScopeChange={handleScopeChange}
                            onSelectItem={handleSelectCursor}
                            styles={styles}
                            screenHeight={screenHeight}
                            safeBottom={insets.bottom}
                        />
                    ) : null}
                </View>
            ) : null}

            {effectiveTopTab === 'pattern' ? (
                <ScrollView
                    style={styles.analysisScroll}
                    contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.xl }}
                    showsVerticalScrollIndicator={false}
                >
                    {analysisCards.map((card) => (
                        <AnalysisCard key={card.key} title={card.title} lines={card.lines} styles={styles} />
                    ))}
                </ScrollView>
            ) : null}

            {liveBoardReady && effectiveTopTab === 'palace' ? (
                <ScrollView
                    style={styles.analysisScroll}
                    contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.xl }}
                    showsVerticalScrollIndicator={false}
                >
                    <AnalysisCard
                        title={`${selectedPalace!.name} · ${selectedPalace!.heavenlyStem}${selectedPalace!.earthlyBranch}`}
                        lines={[
                            buildSelectedPalaceSummary(selectedPalace!),
                            `主星：${selectedPalace!.majorStars.map(toStarLabel).join(' · ') || '空宫'}`,
                            `辅曜：${selectedPalace!.minorStars.map(toStarLabel).join(' · ') || '无'}`,
                            `杂耀：${selectedPalace!.adjectiveStars.map(toStarLabel).join(' · ') || '无'}`,
                            `长生/博士/岁前/将前：${selectedPalace!.changsheng12} · ${selectedPalace!.boshi12} · ${selectedPalace!.suiqian12} · ${selectedPalace!.jiangqian12}`,
                        ]}
                        styles={styles}
                    />
                    {selectedScopePalace ? (
                        <AnalysisCard
                            title={`${ACTIVE_SCOPE_LABELS[renderedScope]}映射`}
                            lines={[
                                `${selectedScopePalace.requestedPalaceName} → ${selectedScopePalace.resolvedPalaceName}`,
                                `四化：${formatHoroscopeMutagenStars(selectedScopePalace.mutagenStars)}`,
                                `流耀：${selectedScopePalace.directHoroscopeStars.join(' / ') || '当前 scope 无直取 API'}`,
                                `三方四正：${selectedScopePalace.surrounded ? selectedScopePalace.surrounded.palaceNames.join(' / ') : '无'}`,
                            ]}
                            styles={styles}
                        />
                    ) : null}
                    <AnalysisCard
                        title="当前选中星曜"
                        lines={selectedStar
                            ? [
                                `${selectedStar.name} · ${selectedStar.palaceName} / ${selectedStar.oppositePalaceName}`,
                                `亮度：${selectedStar.brightnessMatches.join(' / ') || selectedStar.brightness || '无'}`,
                                `四化：${selectedStar.mutagenFlags.map((item) => `化${item}`).join(' / ') || '无'}`,
                            ]
                            : ['当前宫位没有可聚焦的星曜。']}
                        styles={styles}
                    />
                </ScrollView>
            ) : null}

            {liveBoardReady && effectiveTopTab === 'info' ? (
                <ScrollView
                    style={styles.analysisScroll}
                    contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.xl }}
                    showsVerticalScrollIndicator={false}
                >
                    <AnalysisCard
                        title="基本信息"
                        lines={[
                            `${currentName} · ${staticChart!.input.gender === 'male' ? '阳男' : '阴女'}`,
                            `输入语义：${formatInputSemantic(staticChart!)}`,
                            `真太阳时：${formatDateTime(staticChart!.input.trueSolarDate)}`,
                            `北京时间：${formatDateTime(staticChart!.input.birthLocalDate)}`,
                            `节气四柱：${staticChart!.astrolabe.chineseDate}`,
                            `命主/身主：${staticChart!.astrolabe.soul} / ${staticChart!.astrolabe.body}`,
                            `配置：${formatConfigSummary(staticChart!)}`,
                        ]}
                        styles={styles}
                    />
                    <AnalysisCard
                        title="当前运限摘要"
                        lines={[
                            renderedDynamic!.horoscopeSummary.decadal,
                            renderedDynamic!.horoscopeSummary.age,
                            renderedDynamic!.horoscopeSummary.yearly,
                            renderedDynamic!.horoscopeSummary.monthly,
                            renderedDynamic!.horoscopeSummary.daily,
                            renderedDynamic!.horoscopeSummary.hourly,
                        ]}
                        styles={styles}
                    />
                </ScrollView>
            ) : null}

            <Modal visible={zoomVisible} transparent animationType="none" onRequestClose={handleCloseZoom}>
                <View style={styles.modalWrap}>
                    <Pressable style={styles.modalBackdrop} onPress={handleCloseZoom} />
                    {zoomTarget && zoomDisplayLayout && zoomPalace ? (
                        <Animated.View
                            style={[
                                styles.zoomCard,
                                {
                                    width: zoomDisplayLayout.rect.width,
                                    height: zoomDisplayLayout.rect.height,
                                    left: zoomDisplayLayout.rect.x,
                                    top: zoomDisplayLayout.rect.y,
                                },
                                zoomAnimatedStyle,
                            ]}
                        >
                            <Pressable style={styles.zoomTileViewport} onPress={handleZoomCardPress}>
                                <View
                                    style={[
                                        styles.zoomTileBase,
                                        {
                                            left: zoomDisplayLayout.baseOffsetX,
                                            top: zoomDisplayLayout.baseOffsetY,
                                            transform: [{ scale: zoomDisplayLayout.scale }],
                                        },
                                    ]}
                                >
                                    <ZiweiPalaceTileFace
                                        palace={zoomPalace}
                                        scopeModel={zoomPalaceRenderModel}
                                        decoration={zoomPalaceDecoration}
                                        activeScope={activeScope}
                                        selectedPalaceName={selectedPalaceName}
                                        size={{
                                            width: zoomTarget.rect.width,
                                            height: zoomTarget.rect.height,
                                        }}
                                        tilePadding={boardMetrics.tilePadding}
                                        compactBoard={compactBoard}
                                        showCardTint={false}
                                    />
                                </View>
                            </Pressable>
                        </Animated.View>
                    ) : null}
                </View>
            </Modal>

            <ConfirmModal
                visible={deleteVisible}
                title="删除记录"
                message="确定要删除此紫微命盘记录吗？删除后将无法恢复。"
                confirmText="删除"
                destructive={true}
                onConfirm={handleDelete}
                onCancel={() => setDeleteVisible(false)}
            />

            <Modal visible={settingsVisible} transparent animationType="fade" onRequestClose={handleDismissSettings}>
                <View style={styles.modalWrap}>
                    <Pressable style={styles.modalBackdrop} onPress={handleDismissSettings} />
                    <View style={styles.configModalCard}>
                        <ZiweiConfigPanel
                            value={settingsDraftConfig || activePayload?.config || recordResult?.config || staticChart?.input.config || seedPayload?.config || ZIWEI_DEFAULT_CONFIG}
                            onChange={handleConfigChange}
                            mode="result"
                        />
                        {persistStatus === 'error' && persistError ? (
                            <Text style={styles.configErrorText}>{persistError}</Text>
                        ) : null}
                        <View style={styles.configModalActions}>
                            {persistStatus === 'error' ? (
                                <TouchableOpacity style={[styles.configActionBtn, styles.configActionSecondary]} onPress={handleRetryPersist}>
                                    <Text style={[styles.configActionText, styles.configActionSecondaryText]}>重试保存</Text>
                                </TouchableOpacity>
                            ) : null}
                            <TouchableOpacity
                                style={[styles.configActionBtn, styles.configActionPrimary, persistStatus === 'saving' && styles.configActionDisabled]}
                                onPress={() => { void handleSaveSettings(); }}
                                disabled={persistStatus === 'saving'}
                            >
                                <Text style={[styles.configActionText, styles.configActionPrimaryText]}>
                                    {persistStatus === 'saving' ? '保存中...' : '完成'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {recordResult ? (
                <AIChatModal
                    visible={aiChatVisible}
                    onClose={() => setAiChatVisible(false)}
                    result={recordResult}
                    ziweiContext={ziweiFormatterContext}
                    onUpdateResult={(updatedResult) => {
                        const nextResult = updatedResult as ZiweiRecordResult;
                        setRecordResult(nextResult);
                        setRecordDetail({
                            engineType: 'ziwei',
                            result: nextResult,
                            isFavorite,
                        });
                    }}
                />
            ) : null}
        </View>
    );
}

type ZiweiTileRenderModel = ZiweiPalaceRenderModel | ZiweiPalaceSelectionRenderModel;
type ZiweiTileStarsLayoutView = ReturnType<typeof computeZiweiTileStarsLayout>;
type ZiweiPalaceCardStyles = Pick<
    ReturnType<typeof makeStyles>,
    'palaceCard' | 'palaceCellSelected' | 'palaceCellTarget' | 'palaceCellOpposite' | 'palaceCellWealth' | 'palaceCellCareer'
>;
type ZiweiPalaceTileStyles = ReturnType<typeof makeZiweiPalaceTileStyles>;

const ZIWEI_PALACE_CELL_STYLE = StyleSheet.create({
    palaceCell: {
        position: 'absolute',
    },
}).palaceCell;

const ZiweiSnapshotBoard = memo(function ZiweiSnapshotBoard({
    snapshot,
    snapshotBoardModel,
    metrics,
    currentName,
    gender,
    chartScrollOffsetRef,
    onSelectPalace,
    onOpenZoom,
}: {
    snapshot: ZiweiChartSnapshotV1;
    snapshotBoardModel: ZiweiBoardSnapshotModel;
    metrics: ZiweiBoardMetrics;
    currentName: string;
    gender: 'male' | 'female';
    chartScrollOffsetRef: React.MutableRefObject<number>;
    onSelectPalace: (palaceName: string) => void;
    onOpenZoom: (target: ZiweiZoomTarget) => void;
}) {
    const { Colors } = useTheme();
    const styles = useMemo(() => makeStyles(Colors, metrics), [Colors, metrics]);
    const snapshotPalaceByName = useMemo(() => (
        Object.fromEntries(snapshot.palaces.map((palace) => [palace.name, palace])) as Record<string, ZiweiPalaceAnalysisView>
    ), [snapshot.palaces]);
    const selectedPalace = snapshotPalaceByName[snapshotBoardModel.selectedPalaceName] || snapshotPalaceByName.命宫 || snapshot.palaces[0];
    const compactBoard = metrics.cellWidth < 88;
    const boardShellRef = useRef<View | null>(null);
    const boardShellRectRef = useRef<MeasuredBoardShellRect | null>(null);
    const [boardShellRect, setBoardShellRect] = useState<MeasuredBoardShellRect | null>(null);

    useEffect(() => {
        boardShellRectRef.current = boardShellRect;
    }, [boardShellRect]);

    const syncBoardShellRect = useCallback(() => {
        boardShellRef.current?.measureInWindow((x, y, width, height) => {
            const nextRect: MeasuredBoardShellRect = {
                x,
                y,
                width,
                height,
                scrollY: chartScrollOffsetRef.current,
            };

            setBoardShellRect((prev) => {
                if (
                    prev
                    && prev.x === nextRect.x
                    && prev.y === nextRect.y
                    && prev.width === nextRect.width
                    && prev.height === nextRect.height
                    && prev.scrollY === nextRect.scrollY
                ) {
                    return prev;
                }
                return nextRect;
            });
        });
    }, [chartScrollOffsetRef]);

    useLayoutEffect(() => {
        syncBoardShellRect();
    }, [metrics.boardHeight, metrics.boardWidth, syncBoardShellRect]);

    const handleBoardShellLayout = useCallback((_event: LayoutChangeEvent) => {
        syncBoardShellRect();
    }, [syncBoardShellRect]);

    const handleOpenZoomTarget = useCallback((palaceName: string, frame: ZiweiTileFrame) => {
        const measured = boardShellRectRef.current;
        if (!measured) {
            return;
        }

        onOpenZoom({
            palaceName,
            rect: buildZoomRectFromFrame(measured, frame, chartScrollOffsetRef.current),
        });
    }, [chartScrollOffsetRef, onOpenZoom]);

    return (
        <View style={styles.boardWrap}>
            <View ref={boardShellRef} onLayout={handleBoardShellLayout} collapsable={false} style={styles.boardShell}>
                {snapshot.workbenchLayout.ringCells.map((cell) => (
                    <ZiweiPalaceTile
                        key={`snapshot-${cell.row}-${cell.col}`}
                        palace={snapshotPalaceByName[cell.palaceName]}
                        scopeModel={snapshotBoardModel.byPalaceName[cell.palaceName]}
                        selectedPalaceName={snapshotBoardModel.selectedPalaceName}
                        frame={getBoardCellFrame(cell, metrics)}
                        tilePadding={metrics.tilePadding}
                        compactBoard={compactBoard}
                        onSingleTap={onSelectPalace}
                        onDoubleTap={handleOpenZoomTarget}
                    />
                ))}

                <ZiweiSnapshotCenterCard
                    snapshot={snapshot}
                    selectedPalace={selectedPalace}
                    centerPanel={snapshotBoardModel.centerPanel}
                    currentName={currentName}
                    gender={gender}
                    frame={getCenterPanelFrame(metrics)}
                    styles={styles}
                />
            </View>
        </View>
    );
});

const ZiweiBoard = memo(function ZiweiBoard({
    staticChart,
    boardRenderModel,
    boardDecorations,
    metrics,
    activeScope,
    selectedPalaceName,
    currentHoroscope,
    currentName,
    chartScrollOffsetRef,
    onSelectPalace,
    onOpenZoom,
}: {
    staticChart: ZiweiStaticChartResult;
    boardRenderModel: ZiweiBoardRenderModel | null;
    boardDecorations: ZiweiBoardDecorationModel | null;
    metrics: ZiweiBoardMetrics;
    activeScope: ZiweiActiveScope;
    selectedPalaceName: string;
    currentHoroscope: ZiweiDynamicHoroscopeResult;
    currentName: string;
    chartScrollOffsetRef: React.MutableRefObject<number>;
    onSelectPalace: (palaceName: string) => void;
    onOpenZoom: (target: ZiweiZoomTarget) => void;
}) {
    const { Colors } = useTheme();
    const styles = useMemo(() => makeStyles(Colors, metrics), [Colors, metrics]);
    const selectedPalace = staticChart.palaceByName[selectedPalaceName] || staticChart.palaceByName.命宫;
    const compactBoard = metrics.cellWidth < 88;
    const boardShellRef = useRef<View | null>(null);
    const boardShellRectRef = useRef<MeasuredBoardShellRect | null>(null);
    const [boardShellRect, setBoardShellRect] = useState<MeasuredBoardShellRect | null>(null);

    useEffect(() => {
        boardShellRectRef.current = boardShellRect;
    }, [boardShellRect]);

    const syncBoardShellRect = useCallback(() => {
        boardShellRef.current?.measureInWindow((x, y, width, height) => {
            const nextRect: MeasuredBoardShellRect = {
                x,
                y,
                width,
                height,
                scrollY: chartScrollOffsetRef.current,
            };

            setBoardShellRect((prev) => {
                if (
                    prev
                    && prev.x === nextRect.x
                    && prev.y === nextRect.y
                    && prev.width === nextRect.width
                    && prev.height === nextRect.height
                    && prev.scrollY === nextRect.scrollY
                ) {
                    return prev;
                }
                return nextRect;
            });
        });
    }, [chartScrollOffsetRef]);

    useLayoutEffect(() => {
        syncBoardShellRect();
    }, [metrics.boardHeight, metrics.boardWidth, syncBoardShellRect]);

    const handleBoardShellLayout = useCallback((_event: LayoutChangeEvent) => {
        syncBoardShellRect();
    }, [syncBoardShellRect]);

    const handleOpenZoomTarget = useCallback((palaceName: string, frame: ZiweiTileFrame) => {
        const measured = boardShellRectRef.current;
        if (!measured) {
            return;
        }

        onOpenZoom({
            palaceName,
            rect: buildZoomRectFromFrame(measured, frame, chartScrollOffsetRef.current),
        });
    }, [chartScrollOffsetRef, onOpenZoom]);

    return (
        <View style={styles.boardWrap}>
            <View ref={boardShellRef} onLayout={handleBoardShellLayout} collapsable={false} style={styles.boardShell}>
                {staticChart.workbenchLayout.ringCells.map((cell) => (
                    <ZiweiPalaceTile
                        key={`${cell.row}-${cell.col}`}
                        palace={staticChart.palaceByName[cell.palaceName]}
                        scopeModel={boardRenderModel?.byPalaceName[cell.palaceName]}
                        decoration={boardDecorations?.byPalaceName[cell.palaceName]}
                        activeScope={activeScope}
                        selectedPalaceName={selectedPalaceName}
                        frame={getBoardCellFrame(cell, metrics)}
                        tilePadding={metrics.tilePadding}
                        compactBoard={compactBoard}
                        onSingleTap={onSelectPalace}
                        onDoubleTap={handleOpenZoomTarget}
                    />
                ))}

                <ZiweiCenterCard
                    chart={staticChart}
                    dynamic={currentHoroscope}
                    selectedPalace={selectedPalace}
                    activeScope={activeScope}
                    centerPanel={boardRenderModel?.centerPanel}
                    currentName={currentName}
                    frame={getCenterPanelFrame(metrics)}
                    styles={styles}
                />
            </View>
        </View>
    );
});

const ZiweiBoardPlaceholder = memo(function ZiweiBoardPlaceholder({
    metrics,
    styles,
}: {
    metrics: ZiweiBoardMetrics;
    styles: ReturnType<typeof makeStyles>;
}) {
    const { Colors } = useTheme();
    const placeholderFrames = useMemo(() => (
        [
            { row: 0, col: 0 },
            { row: 0, col: 1 },
            { row: 0, col: 2 },
            { row: 0, col: 3 },
            { row: 1, col: 0 },
            { row: 1, col: 3 },
            { row: 2, col: 0 },
            { row: 2, col: 3 },
            { row: 3, col: 0 },
            { row: 3, col: 1 },
            { row: 3, col: 2 },
            { row: 3, col: 3 },
        ].map((item) => ({
            key: `${item.row}-${item.col}`,
            left: metrics.boardInset + item.col * (metrics.cellWidth + metrics.gap),
            top: metrics.boardInset + item.row * (metrics.cellHeight + metrics.gap),
            width: metrics.cellWidth,
            height: metrics.cellHeight,
        }))
    ), [metrics]);
    const centerFrame = useMemo(() => getCenterPanelFrame(metrics), [metrics]);
    const placeholderTone = Colors.border.subtle;

    return (
        <View style={styles.boardWrap}>
            <View style={styles.boardShell}>
                {placeholderFrames.map((frame) => (
                    <View key={frame.key} style={[styles.palaceCell, frame]}>
                        <View style={[styles.palaceCard, { opacity: 0.78 }]}>
                            <View style={styles.tileInnerV2}>
                                <View style={{ gap: 6 }}>
                                    <View style={{ width: '52%', height: 10, borderRadius: 999, backgroundColor: placeholderTone }} />
                                    <View style={{ width: '34%', height: 10, borderRadius: 999, backgroundColor: placeholderTone }} />
                                    <View style={{ width: '58%', height: 10, borderRadius: 999, backgroundColor: placeholderTone }} />
                                </View>
                                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                                    <View style={{ width: 30, height: 14, borderRadius: 999, backgroundColor: placeholderTone }} />
                                    <View style={{ width: 18, height: 18, borderRadius: 6, backgroundColor: placeholderTone }} />
                                </View>
                            </View>
                        </View>
                    </View>
                ))}

                <View style={[styles.centerCard, centerFrame, { opacity: 0.82 }]}>
                    <View style={styles.centerCardTop}>
                        <View style={{ width: '42%', height: 14, borderRadius: 999, backgroundColor: placeholderTone }} />
                        <View style={{ width: '62%', height: 12, borderRadius: 999, backgroundColor: placeholderTone }} />
                        <View style={{ width: '72%', height: 12, borderRadius: 999, backgroundColor: placeholderTone }} />
                        <View style={{ width: '78%', height: 12, borderRadius: 999, backgroundColor: placeholderTone }} />
                    </View>

                    <View style={styles.centerCardMiddle}>
                        <View style={{ width: '48%', height: 16, borderRadius: 999, backgroundColor: placeholderTone }} />
                        <View style={{ width: '68%', height: 12, borderRadius: 999, backgroundColor: placeholderTone }} />
                        <View style={{ width: '84%', height: 12, borderRadius: 999, backgroundColor: placeholderTone }} />
                        <View style={styles.centerMutagenGrid}>
                            {Array.from({ length: 4 }, (_, index) => (
                                <View
                                    key={index}
                                    style={{
                                        width: index % 2 === 0 ? '42%' : '36%',
                                        height: 12,
                                        borderRadius: 999,
                                        backgroundColor: placeholderTone,
                                    }}
                                />
                            ))}
                        </View>
                    </View>

                    <View style={styles.centerCardBottom}>
                        <View style={styles.centerPillarsRow}>
                            {Array.from({ length: 4 }, (_, index) => (
                                <View key={index} style={styles.pillarColumn}>
                                    <View style={{ width: 18, height: 10, borderRadius: 999, backgroundColor: placeholderTone, marginBottom: 6 }} />
                                    <View style={{ width: 20, height: 20, borderRadius: 8, backgroundColor: placeholderTone }} />
                                </View>
                            ))}
                        </View>
                    </View>
                </View>
            </View>
        </View>
    );
});

function ZiweiPalaceTile({
    palace,
    scopeModel,
    decoration,
    activeScope,
    selectedPalaceName,
    frame,
    tilePadding,
    compactBoard,
    onSingleTap,
    onDoubleTap,
}: {
    palace: ZiweiPalaceAnalysisView;
    scopeModel?: ZiweiTileRenderModel;
    decoration?: ZiweiPalaceDecorationView;
    activeScope?: ZiweiActiveScope;
    selectedPalaceName?: string;
    frame: ZiweiTileFrame;
    tilePadding: number;
    compactBoard: boolean;
    onSingleTap: (palaceName: string) => void;
    onDoubleTap: (palaceName: string, frame: ZiweiTileFrame) => void;
}) {
    const tapRef = useRef(0);
    const contentKey = `${frame.width}-${frame.height}-${compactBoard ? 'compact' : 'regular'}-${tilePadding}`;

    const handlePress = () => {
        const now = Date.now();
        if (tapRef.current && now - tapRef.current < ZIWEI_DOUBLE_TAP_DELAY) {
            tapRef.current = 0;
            onDoubleTap(palace.name, frame);
            return;
        }

        tapRef.current = now;
        onSingleTap(palace.name);
    };

    return (
        <TouchableOpacity
            activeOpacity={0.88}
            onPress={handlePress}
            style={[ZIWEI_PALACE_CELL_STYLE, frame]}
        >
            <ZiweiPalaceTileFace
                key={contentKey}
                palace={palace}
                scopeModel={scopeModel}
                decoration={decoration}
                activeScope={activeScope}
                selectedPalaceName={selectedPalaceName}
                size={frame}
                tilePadding={tilePadding}
                compactBoard={compactBoard}
            />
        </TouchableOpacity>
    );
}

const ZiweiPalaceTileFace = memo(function ZiweiPalaceTileFace({
    palace,
    scopeModel,
    decoration,
    activeScope,
    selectedPalaceName,
    size,
    tilePadding,
    compactBoard,
    showCardTint = true,
}: {
    palace: ZiweiPalaceAnalysisView;
    scopeModel?: ZiweiTileRenderModel;
    decoration?: ZiweiPalaceDecorationView;
    activeScope?: ZiweiActiveScope;
    selectedPalaceName?: string;
    size: Pick<ZiweiTileFrame, 'width' | 'height'>;
    tilePadding: number;
    compactBoard: boolean;
    showCardTint?: boolean;
}) {
    const { Colors } = useTheme();
    const styles = useMemo(() => (
        makeZiweiPalaceTileStyles(Colors, compactBoard, tilePadding)
    ), [Colors, compactBoard, tilePadding]);
    const allStars = useMemo(() => [...palace.majorStars, ...palace.minorStars, ...palace.adjectiveStars], [palace.adjectiveStars, palace.majorStars, palace.minorStars]);
    const activeOverlay = decoration?.activeOverlay || null;
    const historyOverlayLabels = decoration?.historyOverlayLabels || [];
    const displayYearAssignment = decoration?.displayYearAssignment || null;
    const displayYearBoxStyle = useMemo(() => {
        const width = Math.max(28, Math.round(size.width * (compactBoard ? 0.26 : 0.28)));
        const left = Math.max(22, Math.round(size.width * (compactBoard ? 0.34 : 0.33)));

        return {
            left,
            width,
            bottom: compactBoard ? 8 : 10,
        };
    }, [compactBoard, size.width]);

    const starsLayout = useMemo(() => {
        const availableWidth = size.width - tilePadding * 2;
        const availableHeight = Math.max(24, size.height - tilePadding * 2 - (compactBoard ? 58 : 70));

        return computeZiweiTileStarsLayout({
            availableHeight,
            availableWidth,
            compactBoard,
            stars: allStars,
        });
    }, [allStars, compactBoard, size.height, size.width, tilePadding]);
    const starsScaleTransform = useMemo<NonNullable<ViewStyle['transform']>>(() => {
        const scale = starsLayout.scale;
        const translateX = scale < 1 ? (starsLayout.scaledWidth - starsLayout.innerWidth) / 2 : 0;
        const translateY = scale < 1 ? (starsLayout.scaledHeight - starsLayout.rawColumnHeight) / 2 : 0;

        return [
            { translateX },
            { translateY },
            { scale },
        ];
    }, [starsLayout]);

    return (
        <View style={[getZiweiPalaceCardStyles(styles, scopeModel, { showCardTint }), { width: size.width, height: size.height }]}>
            <View style={styles.tileInnerV2}>
                {starsLayout.totalColumns > 0 ? (
                    <ZiweiPalaceTileStarsLayer
                        palace={palace}
                        tileStyles={styles}
                        starsLayout={starsLayout}
                        starsScaleTransform={starsScaleTransform}
                    />
                ) : null}

                {(historyOverlayLabels.length > 0 || activeOverlay) ? (
                    <View
                        style={[
                            styles.scopeOverlayAreaV2,
                            {
                                top: Math.max(starsLayout.scaledHeight + 6, compactBoard ? 24 : 30),
                            },
                        ]}
                    >
                        {historyOverlayLabels.length > 0 ? (
                            <Text style={styles.scopeOverlayHistoryV2} numberOfLines={1}>
                                {historyOverlayLabels.join(' ')}
                            </Text>
                        ) : null}
                        {activeOverlay ? (
                            <View style={styles.scopeOverlayItemV2}>
                                <View style={styles.scopeOverlayLabelRowV2}>
                                    <Text
                                        style={[
                                            styles.scopeOverlayLabelV2,
                                            { color: getOverlayToneColor(activeOverlay, Colors) },
                                            styles.scopeOverlayLabelActiveV2,
                                        ]}
                                        numberOfLines={1}
                                    >
                                        {activeOverlay.label}
                                    </Text>
                                    {activeOverlay.mutagens.length > 0 ? (
                                        <View style={styles.scopeOverlayMutagenRowV2}>
                                            {activeOverlay.mutagens.map((mutagen) => (
                                                <Text
                                                    key={`${activeOverlay.key}-${mutagen}`}
                                                    style={[
                                                        styles.scopeOverlayMutagenV2,
                                                        { color: getOverlayToneColor(activeOverlay, Colors) },
                                                    ]}
                                                >
                                                    {mutagen}
                                                </Text>
                                            ))}
                                        </View>
                                    ) : null}
                                </View>
                                {activeOverlay.stars.length > 0 ? (
                                    <Text
                                        style={[
                                            styles.scopeOverlayStarsV2,
                                            { color: getOverlayToneColor(activeOverlay, Colors) },
                                        ]}
                                        numberOfLines={1}
                                    >
                                        {activeOverlay.stars.join(' ')}
                                    </Text>
                                ) : null}
                            </View>
                        ) : null}
                    </View>
                ) : null}

                {displayYearAssignment ? (
                    <View style={[styles.bottomCenterV2, displayYearBoxStyle]}>
                        <Text
                            style={[
                                styles.bottomCenterYearV2,
                                displayYearAssignment.active && styles.decadalRangeActiveV2,
                            ]}
                            numberOfLines={1}
                        >
                            {displayYearAssignment.year}年
                        </Text>
                        <Text
                            style={[
                                styles.bottomCenterAgeV2,
                                displayYearAssignment.active && styles.decadalRangeActiveV2,
                            ]}
                            numberOfLines={1}
                        >
                            {displayYearAssignment.nominalAge}岁
                        </Text>
                    </View>
                ) : null}

                <View style={styles.tileBottomAreaV2}>
                    <View style={styles.bottomLeftV2}>
                        <View style={styles.shenshaColV2}>
                            <Text style={styles.shenshaTextV2}>{palace.boshi12}</Text>
                            <Text style={styles.shenshaTextV2}>{palace.suiqian12}</Text>
                            <Text style={styles.shenshaTextV2}>{palace.jiangqian12}</Text>
                        </View>
                    </View>

                    <View style={styles.bottomRightV2}>
                        <View style={styles.palaceNameBlockV2}>
                            <Text style={[
                                styles.palaceNameTextV2,
                                scopeModel?.selected && styles.palaceNameActiveV2,
                            ]}>{palace.name}</Text>
                        </View>
                        <View style={styles.branchBlockV2}>
                            <Text style={styles.zhangshengTextV2}>{palace.changsheng12}</Text>
                            <Text style={styles.stemBranchBigV2}>{palace.heavenlyStem}</Text>
                            <Text style={styles.stemBranchBigV2}>{palace.earthlyBranch}</Text>
                        </View>
                    </View>
                </View>
            </View>
        </View>
    );
}, (prev, next) => (
    prev.palace === next.palace
    && prev.scopeModel === next.scopeModel
    && prev.decoration === next.decoration
    && prev.activeScope === next.activeScope
    && prev.selectedPalaceName === next.selectedPalaceName
));

const ZiweiPalaceTileStarsLayer = memo(function ZiweiPalaceTileStarsLayer({
    palace,
    tileStyles,
    starsLayout,
    starsScaleTransform,
}: {
    palace: ZiweiPalaceAnalysisView;
    tileStyles: ZiweiPalaceTileStyles;
    starsLayout: ZiweiTileStarsLayoutView;
    starsScaleTransform: NonNullable<ViewStyle['transform']>;
}) {
    return (
        <View
            style={[
                tileStyles.starsScaleWrapV2,
                {
                    height: starsLayout.scaledHeight,
                    width: starsLayout.scaledWidth,
                },
            ]}
        >
            <View
                style={[
                    tileStyles.starsAreaV2,
                    tileStyles.starsAreaInnerV2,
                    {
                        gap: starsLayout.gap,
                        width: starsLayout.innerWidth,
                        transform: starsScaleTransform,
                    },
                ]}
            >
                {palace.majorStars.map((star) => (
                    <ZiweiPalaceTileStarColumn
                        key={`${palace.name}-${star.name}`}
                        star={star}
                        tileStyles={tileStyles}
                        starsLayout={starsLayout}
                        major={true}
                    />
                ))}
                {[...palace.minorStars, ...palace.adjectiveStars].map((star) => (
                    <ZiweiPalaceTileStarColumn
                        key={`${palace.name}-${star.name}`}
                        star={star}
                        tileStyles={tileStyles}
                        starsLayout={starsLayout}
                        major={false}
                    />
                ))}
            </View>
        </View>
    );
});

function ZiweiPalaceTileStarColumn({
    star,
    tileStyles,
    starsLayout,
    major,
}: {
    star: ZiweiStarViewModel;
    tileStyles: ZiweiPalaceTileStyles;
    starsLayout: ZiweiTileStarsLayoutView;
    major: boolean;
}) {
    return (
        <View
            style={[
                tileStyles.starColV2,
                {
                    height: starsLayout.rawColumnHeight,
                    width: starsLayout.colWidth,
                },
            ]}
        >
            <View style={[tileStyles.starNameSlotV2, { height: starsLayout.nameSlotHeight }]}>
                {star.name.split('').map((char, idx) => (
                    <Text
                        key={idx}
                        style={[
                            major ? tileStyles.starTextMajorV2 : tileStyles.starTextMinorV2,
                            {
                                fontSize: major ? starsLayout.majorFontSize : starsLayout.minorFontSize,
                                lineHeight: major ? starsLayout.majorLineHeight : starsLayout.minorLineHeight,
                            },
                        ]}
                    >
                        {char}
                    </Text>
                ))}
            </View>
            <View style={[tileStyles.starMetaSlotV2, { height: starsLayout.brightnessSlotHeight }]}>
                <Text
                    style={[
                        tileStyles.starBrightnessV2,
                        !star.brightness && tileStyles.starBrightnessPlaceholderV2,
                    ]}
                >
                    {star.brightness || '·'}
                </Text>
            </View>
            <View style={[tileStyles.starMetaSlotV2, { height: starsLayout.mutagenSlotHeight }]}>
                <Text style={[tileStyles.starMutagenV2, !star.mutagen && tileStyles.starMetaHiddenV2]}>
                    {formatTileMutagen(star.mutagen)}
                </Text>
            </View>
        </View>
    );
}

const ZiweiSnapshotCenterCard = memo(function ZiweiSnapshotCenterCard({
    snapshot,
    selectedPalace,
    centerPanel,
    currentName,
    gender,
    frame,
    styles,
}: {
    snapshot: ZiweiChartSnapshotV1;
    selectedPalace: ZiweiPalaceAnalysisView;
    centerPanel: ZiweiBoardSnapshotModel['centerPanel'];
    currentName: string;
    gender: 'male' | 'female';
    frame: { left: number; top: number; width: number; height: number };
    styles: ReturnType<typeof makeStyles>;
}) {
    const summaryItems = centerPanel.summaryItems;
    const pillarColumns = buildPillarColumnsFromChineseDate(snapshot.staticMeta.chineseDate);
    const duplicateScopeSummary = centerPanel.scopeState === centerPanel.scopeSummary;

    return (
        <View style={[styles.centerCard, frame]}>
            <View style={styles.centerCardTop}>
                <Text style={styles.centerName} numberOfLines={1}>{currentName}</Text>
                <Text style={styles.centerLine} numberOfLines={1}>
                    {gender === 'male' ? '阳男' : '阴女'} · {snapshot.staticMeta.fiveElementsClass}
                </Text>
                <Text style={styles.centerLine} numberOfLines={1}>{snapshot.staticMeta.birthLocal.replace('T', ' ')}</Text>
                <Text style={styles.centerLine} numberOfLines={1}>
                    真太阳时 {snapshot.staticMeta.trueSolarDateTimeLocal.replace('T', ' ')}
                </Text>
            </View>

            <View style={styles.centerCardMiddle}>
                <Text style={styles.centerFocusTitle} numberOfLines={1}>{centerPanel.focusTitle}</Text>
                <Text style={styles.centerScopeState} numberOfLines={1}>{centerPanel.scopeState}</Text>
                {!duplicateScopeSummary ? (
                    <Text style={styles.centerFocusMeta} numberOfLines={2}>{centerPanel.scopeSummary}</Text>
                ) : null}
                <Text style={styles.centerBadgeRowText} numberOfLines={1}>
                    {summaryItems.join(' · ')}
                </Text>

                <View style={styles.centerMutagenGrid}>
                    {centerPanel.mutagenBadges.map((badge, index) => (
                        <Text
                            key={badge.key}
                            style={[
                                styles.centerMutagenText,
                                !badge.active && styles.centerMutagenTextInactive,
                                index % 2 === 0 ? styles.centerMutagenTextLeft : styles.centerMutagenTextRight,
                            ]}
                            numberOfLines={1}
                        >
                            {badge.label} {badge.value}
                        </Text>
                    ))}
                </View>
            </View>

            <View style={styles.centerCardBottom}>
                <View style={styles.centerPillarsRow}>
                    {pillarColumns.map((column) => (
                        <View key={column.key} style={styles.pillarColumn}>
                            <Text style={styles.pillarHead}>{column.header}</Text>
                            <Text style={styles.pillarValue}>{column.value}</Text>
                        </View>
                    ))}
                </View>
                <Text style={styles.centerSnapshotFooter} numberOfLines={1}>
                    {selectedPalace.name} · {snapshot.staticMeta.lunarDate} · {snapshot.staticMeta.timeLabel}
                </Text>
            </View>
        </View>
    );
});

const ZiweiCenterCard = memo(function ZiweiCenterCard({
    chart,
    dynamic,
    selectedPalace,
    activeScope,
    centerPanel,
    currentName,
    frame,
    styles,
}: {
    chart: ZiweiStaticChartResult;
    dynamic: ZiweiDynamicHoroscopeResult;
    selectedPalace: ZiweiPalaceAnalysisView;
    activeScope: ZiweiActiveScope;
    centerPanel?: ZiweiBoardRenderModel['centerPanel'];
    currentName: string;
    frame: { left: number; top: number; width: number; height: number };
    styles: ReturnType<typeof makeStyles>;
}) {
    const summaryItems = centerPanel?.summaryItems || [
        `命主 ${chart.astrolabe.soul}`,
        `身主 ${chart.astrolabe.body}`,
        `当前 ${ACTIVE_SCOPE_LABELS[activeScope]}`,
    ];
    const pillarColumns = buildPillarColumns(chart);
    const focusTitle = centerPanel?.focusTitle || `${selectedPalace.name} · ${selectedPalace.heavenlyStem}${selectedPalace.earthlyBranch}`;
    const scopeState = centerPanel?.scopeState || `当前 ${ACTIVE_SCOPE_LABELS[activeScope]}`;
    const scopeSummary = centerPanel?.scopeSummary || getCurrentScopeSummary(dynamic, activeScope);
    const mutagenBadges = centerPanel?.mutagenBadges || [];
    const duplicateScopeSummary = scopeState === scopeSummary;

    return (
        <View style={[styles.centerCard, frame]}>
            <View style={styles.centerCardTop}>
                <Text style={styles.centerName} numberOfLines={1}>{currentName}</Text>
                <Text style={styles.centerLine} numberOfLines={1}>
                    {chart.input.gender === 'male' ? '阳男' : '阴女'} · {chart.astrolabe.fiveElementsClass}
                </Text>
                <Text style={styles.centerLine} numberOfLines={1}>{formatDateTime(chart.input.birthLocalDate)}</Text>
                <Text style={styles.centerLine} numberOfLines={1}>真太阳时 {formatDateTime(chart.input.trueSolarDate)}</Text>
            </View>

            <View style={styles.centerCardMiddle}>
                <Text style={styles.centerFocusTitle} numberOfLines={1}>{focusTitle}</Text>
                <Text style={styles.centerScopeState} numberOfLines={1}>{scopeState}</Text>
                {!duplicateScopeSummary ? (
                    <Text style={styles.centerFocusMeta} numberOfLines={2}>{scopeSummary}</Text>
                ) : null}
                
                <Text style={styles.centerBadgeRowText} numberOfLines={1}>
                    {summaryItems.join(' · ')}
                </Text>

                <View style={styles.centerMutagenGrid}>
                    {mutagenBadges.map((badge: ZiweiBoardRenderModel['centerPanel']['mutagenBadges'][number], index: number) => (
                        <Text
                            key={badge.key}
                            style={[
                                styles.centerMutagenText,
                                !badge.active && styles.centerMutagenTextInactive,
                                index % 2 === 0 ? styles.centerMutagenTextLeft : styles.centerMutagenTextRight,
                            ]}
                            numberOfLines={1}
                        >
                            {badge.label} {badge.value}
                        </Text>
                    ))}
                </View>
            </View>

            <View style={styles.centerCardBottom}>
                <View style={styles.centerPillarsRow}>
                    {pillarColumns.map((column) => (
                        <View key={column.key} style={styles.pillarColumn}>
                            <Text style={styles.pillarHead}>{column.header}</Text>
                            <Text style={styles.pillarValue}>{column.value}</Text>
                        </View>
                    ))}
                </View>
            </View>
        </View>
    );
});

const ZiweiOrbitDrawer = memo(function ZiweiOrbitDrawer({
    orbitState,
    activeScope,
    drawerExpanded,
    onToggleExpanded,
    onExpandedChange,
    onScopeChange,
    onSelectItem,
    styles,
    screenHeight,
    safeBottom,
}: {
    orbitState: ZiweiOrbitDrawerState;
    activeScope: ZiweiActiveScope;
    drawerExpanded: boolean;
    onToggleExpanded: () => void;
    onExpandedChange: (expanded: boolean) => void;
    onScopeChange: (scope: ZiweiActiveScope) => void;
    onSelectItem: (item: ZiweiOrbitTrackItem, scope: ZiweiActiveScope) => void;
    styles: ReturnType<typeof makeStyles>;
    screenHeight: number;
    safeBottom: number;
}) {
    const drawerHeight = Math.min(340, Math.max(220, screenHeight * 0.33));
    const closedOffset = drawerHeight - DRAWER_PEEK_HEIGHT;
    const translateY = useSharedValue(drawerExpanded ? 0 : closedOffset);
    const dragStartY = useSharedValue(closedOffset);

    useEffect(() => {
        translateY.value = withSpring(drawerExpanded ? 0 : closedOffset, {
            damping: 24,
            stiffness: 220,
            overshootClamping: true,
        });
    }, [closedOffset, drawerExpanded, translateY]);

    const panGesture = useMemo(() => Gesture.Pan()
        .onStart(() => {
            dragStartY.value = translateY.value;
        })
        .onUpdate((event) => {
            const next = dragStartY.value + event.translationY;
            translateY.value = Math.max(0, Math.min(closedOffset, next));
        })
        .onEnd(() => {
            const expanded = translateY.value < closedOffset * 0.5;
            translateY.value = withSpring(expanded ? 0 : closedOffset, {
                damping: 24,
                stiffness: 220,
                overshootClamping: true,
            });
            runOnJS(onExpandedChange)(expanded);
        }), [closedOffset, dragStartY, onExpandedChange, translateY]);

    const drawerAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
    }));

    return (
        <Animated.View
            style={[
                styles.drawerShell,
                {
                    height: drawerHeight + safeBottom,
                    paddingBottom: safeBottom,
                },
                drawerAnimatedStyle,
            ]}
        >
            <View style={{ flex: 1 }}>
                <GestureDetector gesture={panGesture}>
                    <TouchableOpacity style={styles.drawerHandleArea} onPress={onToggleExpanded} activeOpacity={0.84}>
                        <View style={styles.drawerSummaryRow}>
                            <View style={styles.drawerExpandRow}>
                                <Text style={styles.drawerExpandText}>{drawerExpanded ? '收起运限' : '展开运限'}</Text>
                                <Text style={[styles.drawerExpandArrow, drawerExpanded && styles.drawerExpandArrowExpanded]}>▾</Text>
                            </View>
                            {drawerExpanded ? (
                                <View style={styles.drawerSummaryPills}>
                                    {orbitState.summaryItems.map((item) => (
                                        <View key={item.key} style={styles.drawerSummaryPill}>
                                            <Text style={styles.drawerSummaryPillText}>
                                                {item.label} {item.value}
                                            </Text>
                                        </View>
                                    ))}
                                    <View style={[styles.drawerSummaryPill, styles.drawerSummaryPillActive]}>
                                        <Text style={styles.drawerSummaryPillText}>{orbitState.activeScopeLabel}</Text>
                                    </View>
                                </View>
                            ) : null}
                        </View>
                    </TouchableOpacity>
                </GestureDetector>

                <ScrollView
                    style={styles.drawerContent}
                    contentContainerStyle={styles.drawerContentInner}
                    nestedScrollEnabled
                    showsVerticalScrollIndicator={false}
                >
                    <ScrollView
                        horizontal
                        nestedScrollEnabled
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.drawerScopeRow}
                    >
                        {SCOPE_OPTIONS.map((item) => {
                            const active = item.key === activeScope;
                            return (
                                <TouchableOpacity
                                    key={item.key}
                                    style={[styles.drawerScopeBtn, active && styles.drawerScopeBtnActive]}
                                    onPress={() => onScopeChange(item.key)}
                                    activeOpacity={0.84}
                                >
                                    <Text style={[styles.drawerScopeText, active && styles.drawerScopeTextActive]}>
                                        {item.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>

                    {orbitState.rows.map((row) => (
                        <OrbitRow
                            key={row.key}
                            row={row}
                            scope={row.key}
                            styles={styles}
                            onSelectItem={onSelectItem}
                        />
                    ))}
                </ScrollView>
            </View>
        </Animated.View>
    );
});

const OrbitTrackItemButton = memo(function OrbitTrackItemButton({
    itemKey,
    label,
    secondary,
    active,
    styles,
    onPress,
}: {
    itemKey: string;
    label: string;
    secondary: string;
    active: boolean;
    styles: ReturnType<typeof makeStyles>;
    onPress: (itemKey: string) => void;
}) {
    const handlePress = useCallback(() => {
        onPress(itemKey);
    }, [itemKey, onPress]);

    return (
        <TouchableOpacity
            style={[styles.drawerTrackItem, active && styles.drawerTrackItemActive]}
            onPress={handlePress}
            activeOpacity={0.84}
        >
            <Text style={[styles.drawerTrackPrimary, active && styles.drawerTrackPrimaryActive]}>
                {label}
            </Text>
            <Text style={[styles.drawerTrackSecondary, active && styles.drawerTrackSecondaryActive]}>
                {secondary}
            </Text>
        </TouchableOpacity>
    );
});

function OrbitRow({
    row,
    scope,
    styles,
    onSelectItem,
}: {
    row: ZiweiOrbitDrawerRow;
    scope: ZiweiActiveScope;
    styles: ReturnType<typeof makeStyles>;
    onSelectItem: (item: ZiweiOrbitTrackItem, scope: ZiweiActiveScope) => void;
}) {
    const rowItemsByKey = useMemo(() => (
        Object.fromEntries(row.items.map((item) => [item.key, item]))
    ), [row.items]);

    const handleSelectItemByKey = useCallback((itemKey: string) => {
        const item = rowItemsByKey[itemKey];
        if (!item) {
            return;
        }
        onSelectItem(item, scope);
    }, [onSelectItem, rowItemsByKey, scope]);

    const keyExtractor = useCallback((item: ZiweiOrbitTrackItem) => item.key, []);
    const getItemLayout = useCallback((_: ArrayLike<ZiweiOrbitTrackItem> | null | undefined, index: number) => ({
        length: DRAWER_TRACK_ITEM_WIDTH,
        offset: DRAWER_TRACK_ITEM_WIDTH * index,
        index,
    }), []);
    const initialNumToRender = useMemo(() => Math.min(row.items.length, 8), [row.items.length]);

    const renderItem = useCallback(({ item }: { item: ZiweiOrbitTrackItem }) => (
        <OrbitTrackItemButton
            itemKey={item.key}
            label={item.label}
            secondary={item.secondary}
            active={item.active}
            styles={styles}
            onPress={handleSelectItemByKey}
        />
    ), [handleSelectItemByKey, styles]);

    return (
        <View style={styles.drawerRowSection}>
            <Text style={styles.drawerRowTitle}>{row.label}</Text>
            <FlatList
                data={row.items}
                keyExtractor={keyExtractor}
                horizontal
                nestedScrollEnabled
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.drawerTrackList}
                getItemLayout={getItemLayout}
                initialNumToRender={initialNumToRender}
                maxToRenderPerBatch={6}
                updateCellsBatchingPeriod={16}
                windowSize={5}
                removeClippedSubviews
                renderItem={renderItem}
            />
        </View>
    );
}

function AnalysisCard({
    title,
    lines,
    styles,
}: {
    title: string;
    lines: string[];
    styles: ReturnType<typeof makeStyles>;
}) {
    return (
        <View style={styles.analysisCard}>
            <Text style={styles.analysisCardTitle}>{title}</Text>
            {lines.map((line) => (
                <Text key={`${title}-${line}`} style={styles.analysisCardLine}>
                    {line}
                </Text>
            ))}
        </View>
    );
}

function makeZiweiPalaceTileStyles(Colors: any, compactBoard: boolean, tilePadding: number) {
    return StyleSheet.create({
        palaceCard: {
            flex: 1,
            backgroundColor: Colors.bg.card,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: Colors.border.subtle,
            padding: tilePadding,
            overflow: 'hidden',
        },
        palaceCellSelected: {
            backgroundColor: 'rgba(194, 171, 102, 0.08)',
            borderColor: 'rgba(194, 171, 102, 0.6)',
        },
        palaceCellTarget: {
            backgroundColor: 'rgba(82, 180, 93, 0.05)',
            borderColor: 'rgba(82, 180, 93, 0.4)',
        },
        palaceCellOpposite: {
            backgroundColor: 'rgba(47, 143, 232, 0.05)',
            borderColor: 'rgba(47, 143, 232, 0.4)',
        },
        palaceCellWealth: {
            backgroundColor: 'rgba(211, 165, 22, 0.05)',
            borderColor: 'rgba(211, 165, 22, 0.4)',
        },
        palaceCellCareer: {
            backgroundColor: 'rgba(221, 61, 118, 0.05)',
            borderColor: 'rgba(221, 61, 118, 0.4)',
        },
        tileInnerV2: {
            flex: 1,
            position: 'relative',
        },
        starsAreaV2: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: compactBoard ? 2 : 4,
            paddingTop: 0,
        },
        starsAreaInnerV2: {
            alignSelf: 'flex-start',
        },
        starsScaleWrapV2: {
            alignSelf: 'flex-start',
            overflow: 'hidden',
        },
        starColV2: {
            alignItems: 'center',
            justifyContent: 'flex-start',
            width: compactBoard ? 13 : 15,
        },
        starNameSlotV2: {
            alignItems: 'center',
            justifyContent: 'flex-start',
        },
        starMetaSlotV2: {
            alignItems: 'center',
            justifyContent: 'flex-start',
            width: '100%',
        },
        starMetaHiddenV2: {
            opacity: 0,
        },
        starTextMajorV2: {
            fontSize: compactBoard ? 13 : 15,
            fontWeight: '700',
            color: Colors.text.heading,
            lineHeight: compactBoard ? 14 : 16,
        },
        starMutagenV2: {
            fontSize: compactBoard ? 9 : 10,
            lineHeight: compactBoard ? 10 : 12,
            color: Colors.accent.red,
            fontWeight: '600',
            textAlign: 'center',
            includeFontPadding: false,
        },
        starBrightnessV2: {
            fontSize: compactBoard ? 8 : 10,
            lineHeight: compactBoard ? 10 : 12,
            color: Colors.text.tertiary,
            textAlign: 'center',
            includeFontPadding: false,
        },
        starBrightnessPlaceholderV2: {
            opacity: 0.55,
        },
        starTextMinorV2: {
            fontSize: compactBoard ? 12 : 14,
            color: Colors.text.secondary,
            lineHeight: compactBoard ? 13 : 15,
        },
        scopeOverlayAreaV2: {
            position: 'absolute',
            left: 2,
            right: compactBoard ? 32 : 40,
            bottom: compactBoard ? 48 : 58,
            justifyContent: 'flex-end',
        },
        scopeOverlayItemV2: {
            marginBottom: compactBoard ? 1 : 2,
        },
        scopeOverlayHistoryV2: {
            fontSize: compactBoard ? 9 : 10,
            lineHeight: compactBoard ? 10 : 12,
            color: Colors.text.secondary,
            marginBottom: 2,
        },
        scopeOverlayLabelRowV2: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: compactBoard ? 2 : 3,
        },
        scopeOverlayLabelV2: {
            fontSize: compactBoard ? 11 : 12,
            fontWeight: '700',
            lineHeight: compactBoard ? 12 : 14,
        },
        scopeOverlayLabelActiveV2: {
            textDecorationLine: 'underline',
        },
        scopeOverlayMutagenRowV2: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 1,
        },
        scopeOverlayMutagenV2: {
            fontSize: compactBoard ? 8 : 9,
            fontWeight: '700',
            lineHeight: compactBoard ? 9 : 10,
        },
        scopeOverlayStarsV2: {
            marginTop: 1,
            fontSize: compactBoard ? 8 : 9,
            lineHeight: compactBoard ? 9 : 10,
        },
        tileBottomAreaV2: {
            position: 'absolute',
            bottom: 2,
            left: 2,
            right: 2,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
        },
        bottomLeftV2: {
            flex: 1,
            justifyContent: 'flex-end',
        },
        bottomCenterV2: {
            position: 'absolute',
            alignItems: 'center',
            justifyContent: 'flex-end',
            pointerEvents: 'none',
            zIndex: 2,
        },
        shenshaColV2: {
            flexDirection: 'column',
        },
        shenshaTextV2: {
            fontSize: compactBoard ? 9 : 10,
            color: Colors.text.tertiary,
            lineHeight: compactBoard ? 11 : 12,
        },
        decadalRangeActiveV2: {
            color: Colors.accent.gold,
            fontWeight: '700',
        },
        bottomCenterYearV2: {
            fontSize: compactBoard ? 7 : 8,
            lineHeight: compactBoard ? 8 : 9,
            color: Colors.text.secondary,
            textAlign: 'center',
        },
        bottomCenterAgeV2: {
            fontSize: compactBoard ? 8 : 9,
            lineHeight: compactBoard ? 9 : 10,
            color: Colors.text.primary,
            textAlign: 'center',
            fontWeight: '600',
        },
        bottomRightV2: {
            alignItems: 'flex-end',
            flexShrink: 0,
        },
        palaceNameBlockV2: {
            marginBottom: compactBoard ? 0 : 2,
        },
        palaceNameTextV2: {
            fontSize: compactBoard ? 12 : 14,
            fontWeight: '700',
            color: Colors.text.heading,
        },
        palaceNameActiveV2: {
            color: Colors.accent.gold,
        },
        branchBlockV2: {
            alignItems: 'center',
        },
        zhangshengTextV2: {
            fontSize: compactBoard ? 10 : 12,
            color: Colors.text.primary,
            marginBottom: 2,
        },
        stemBranchBigV2: {
            fontSize: compactBoard ? 13 : 16,
            fontWeight: '700',
            color: Colors.text.heading,
            lineHeight: compactBoard ? 14 : 17,
        },
    });
}

const makeStyles = (Colors: any, metrics: ZiweiBoardMetrics) => {
    const compactBoard = metrics.cellWidth < 88;
    const tileTagFont = compactBoard ? 9 : 10;
    const centerNameFont = compactBoard ? 18 : 20;
    const centerBodyFont = compactBoard ? 11 : 12;

    return StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: Colors.bg.primary,
        },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.sm,
        },
        headerCenter: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            marginHorizontal: Spacing.sm,
        },
        headerActions: {
            width: 44,
            alignItems: 'flex-end',
            justifyContent: 'center',
        },
        headerBtn: {
            width: 44,
            height: 44,
            borderRadius: BorderRadius.md,
            borderWidth: 1,
            borderColor: Colors.border.subtle,
            backgroundColor: Colors.bg.card,
            alignItems: 'center',
            justifyContent: 'center',
        },
        headerBtnDisabled: {
            opacity: 0.45,
        },
        aiHeaderBtn: {
            minHeight: 40,
            paddingHorizontal: Spacing.md,
            borderRadius: BorderRadius.round,
            backgroundColor: Colors.accent.gold,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: Spacing.xs,
        },
        aiHeaderBtnDisabled: {
            opacity: 0.5,
        },
        aiHeaderBtnText: {
            fontSize: FontSize.sm,
            color: Colors.text.inverse,
            fontWeight: '700',
        },
        headerTitle: {
            fontSize: FontSize.lg,
            color: Colors.text.heading,
            fontWeight: '500',
        },
        topTabsWrap: {
            flexDirection: 'row',
            marginHorizontal: Spacing.lg,
            marginTop: Spacing.xs,
            padding: 4,
            borderRadius: BorderRadius.round,
            backgroundColor: Colors.bg.card,
            borderWidth: 1,
            borderColor: Colors.border.subtle,
        },
        topTabBtn: {
            flex: 1,
            minHeight: 44,
            borderRadius: BorderRadius.round,
            alignItems: 'center',
            justifyContent: 'center',
        },
        topTabBtnActive: {
            backgroundColor: 'rgba(191,203,231,0.48)',
        },
        topTabBtnDisabled: {
            opacity: 0.42,
        },
        topTabText: {
            fontSize: FontSize.md,
            color: Colors.text.secondary,
        },
        topTabTextActive: {
            color: Colors.text.heading,
            fontWeight: '700',
        },
        topTabTextDisabled: {
            color: Colors.text.tertiary,
        },
        screenSubtitleWrap: {
            marginTop: Spacing.sm,
            marginHorizontal: Spacing.lg,
            borderRadius: BorderRadius.round,
            borderWidth: 1,
            borderColor: Colors.border.subtle,
            backgroundColor: Colors.bg.card,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.sm,
        },
        screenSubtitle: {
            fontSize: FontSize.sm,
            color: Colors.text.secondary,
            textAlign: 'center',
            lineHeight: 20,
        },
        ruleDriftCard: {
            marginTop: Spacing.sm,
            marginHorizontal: Spacing.lg,
            borderRadius: BorderRadius.lg,
            borderWidth: 1,
            borderColor: Colors.accent.gold,
            backgroundColor: Colors.bg.card,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.sm,
        },
        ruleDriftText: {
            fontSize: FontSize.xs,
            color: Colors.text.secondary,
            lineHeight: 18,
        },
        persistWarningCard: {
            borderColor: Colors.accent.red,
        },
        aiStaleCard: {
            borderColor: Colors.accent.jade,
        },
        persistRetryBtn: {
            marginTop: Spacing.sm,
            alignSelf: 'flex-start',
            minHeight: 36,
            paddingHorizontal: Spacing.md,
            borderRadius: BorderRadius.round,
            borderWidth: 1,
            borderColor: Colors.accent.gold,
            alignItems: 'center',
            justifyContent: 'center',
        },
        persistRetryBtnText: {
            fontSize: FontSize.xs,
            color: Colors.accent.gold,
            fontWeight: '600',
        },
        snapshotRestoreCard: {
            marginTop: Spacing.md,
            marginHorizontal: Spacing.lg,
            borderRadius: BorderRadius.lg,
            borderWidth: 1,
            borderColor: Colors.border.subtle,
            backgroundColor: Colors.bg.card,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.sm,
        },
        snapshotRestoreText: {
            fontSize: FontSize.xs,
            color: Colors.text.secondary,
            lineHeight: 18,
            textAlign: 'center',
        },
        chartStage: {
            flex: 1,
            position: 'relative',
        },
        chartScroll: {
            flex: 1,
        },
        boardWrap: {
            alignItems: 'center',
            marginTop: 4,
        },
        boardShell: {
            position: 'relative',
            width: metrics.boardWidth,
            height: metrics.boardHeight,
            backgroundColor: Colors.bg.elevated,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: Colors.border.subtle,
        },
        palaceCell: {
            position: 'absolute',
        },
        palaceCard: {
            flex: 1,
            backgroundColor: Colors.bg.card,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: Colors.border.subtle,
            padding: metrics.tilePadding,
            overflow: 'hidden',
        },
        palaceCellSelected: {
            backgroundColor: 'rgba(194, 171, 102, 0.08)',
            borderColor: 'rgba(194, 171, 102, 0.6)',
        },
        palaceCellTarget: {
            backgroundColor: 'rgba(82, 180, 93, 0.05)',
            borderColor: 'rgba(82, 180, 93, 0.4)',
        },
        palaceCellOpposite: {
            backgroundColor: 'rgba(47, 143, 232, 0.05)',
            borderColor: 'rgba(47, 143, 232, 0.4)',
        },
        palaceCellWealth: {
            backgroundColor: 'rgba(211, 165, 22, 0.05)',
            borderColor: 'rgba(211, 165, 22, 0.4)',
        },
        palaceCellCareer: {
            backgroundColor: 'rgba(221, 61, 118, 0.05)',
            borderColor: 'rgba(221, 61, 118, 0.4)',
        },
        tileInnerV2: {
            flex: 1,
            position: 'relative',
        },
        starsAreaV2: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: compactBoard ? 2 : 4,
            paddingTop: 0,
        },
        starsAreaInnerV2: {
            alignSelf: 'flex-start',
        },
        starsScaleWrapV2: {
            alignSelf: 'flex-start',
            overflow: 'hidden',
        },
        starColV2: {
            alignItems: 'center',
            justifyContent: 'flex-start',
            width: compactBoard ? 13 : 15,
        },
        starNameSlotV2: {
            alignItems: 'center',
            justifyContent: 'flex-start',
        },
        starMetaSlotV2: {
            alignItems: 'center',
            justifyContent: 'flex-start',
            width: '100%',
        },
        starMetaHiddenV2: {
            opacity: 0,
        },
        starTextMajorV2: {
            fontSize: compactBoard ? 13 : 15,
            fontWeight: '700',
            color: Colors.text.heading,
            lineHeight: compactBoard ? 14 : 16,
        },
        starMutagenV2: {
            fontSize: compactBoard ? 9 : 10,
            lineHeight: compactBoard ? 10 : 12,
            color: Colors.accent.red,
            fontWeight: '600',
            textAlign: 'center',
            includeFontPadding: false,
        },
        starBrightnessV2: {
            fontSize: compactBoard ? 8 : 10,
            lineHeight: compactBoard ? 10 : 12,
            color: Colors.text.tertiary,
            textAlign: 'center',
            includeFontPadding: false,
        },
        starBrightnessPlaceholderV2: {
            opacity: 0.55,
        },
        starTextMinorV2: {
            fontSize: compactBoard ? 12 : 14,
            color: Colors.text.secondary,
            lineHeight: compactBoard ? 13 : 15,
        },
        scopeOverlayAreaV2: {
            position: 'absolute',
            left: 2,
            right: compactBoard ? 32 : 40,
            bottom: compactBoard ? 48 : 58,
            justifyContent: 'flex-end',
        },
        scopeOverlayItemV2: {
            marginBottom: compactBoard ? 1 : 2,
        },
        scopeOverlayHistoryV2: {
            fontSize: compactBoard ? 9 : 10,
            lineHeight: compactBoard ? 10 : 12,
            color: Colors.text.secondary,
            marginBottom: 2,
        },
        scopeOverlayLabelRowV2: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: compactBoard ? 2 : 3,
        },
        scopeOverlayLabelV2: {
            fontSize: compactBoard ? 11 : 12,
            fontWeight: '700',
            lineHeight: compactBoard ? 12 : 14,
        },
        scopeOverlayLabelActiveV2: {
            textDecorationLine: 'underline',
        },
        scopeOverlayMutagenRowV2: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 1,
        },
        scopeOverlayMutagenV2: {
            fontSize: compactBoard ? 8 : 9,
            fontWeight: '700',
            lineHeight: compactBoard ? 9 : 10,
        },
        scopeOverlayStarsV2: {
            marginTop: 1,
            fontSize: compactBoard ? 8 : 9,
            lineHeight: compactBoard ? 9 : 10,
        },
        tileBottomAreaV2: {
            position: 'absolute',
            bottom: 2,
            left: 2,
            right: 2,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
        },
        bottomLeftV2: {
            flex: 1,
            justifyContent: 'flex-end',
        },
        bottomCenterV2: {
            position: 'absolute',
            alignItems: 'center',
            justifyContent: 'flex-end',
            pointerEvents: 'none',
            zIndex: 2,
        },
        shenshaColV2: {
            flexDirection: 'column',
        },
        shenshaTextV2: {
            fontSize: compactBoard ? 9 : 10,
            color: Colors.text.tertiary,
            lineHeight: compactBoard ? 11 : 12,
        },
        decadalRangeV2: {
            fontSize: compactBoard ? 10 : 11,
            color: Colors.text.primary,
            marginBottom: 1,
        },
        decadalRangeActiveV2: {
            color: Colors.accent.gold,
            fontWeight: '700',
        },
        bottomCenterYearV2: {
            fontSize: compactBoard ? 7 : 8,
            lineHeight: compactBoard ? 8 : 9,
            color: Colors.text.secondary,
            textAlign: 'center',
        },
        bottomCenterAgeV2: {
            fontSize: compactBoard ? 8 : 9,
            lineHeight: compactBoard ? 9 : 10,
            color: Colors.text.primary,
            textAlign: 'center',
            fontWeight: '600',
        },
        bottomRightV2: {
            alignItems: 'flex-end',
            flexShrink: 0,
        },
        palaceNameBlockV2: {
            marginBottom: compactBoard ? 0 : 2,
        },
        palaceNameTextV2: {
            fontSize: compactBoard ? 12 : 14,
            fontWeight: '700',
            color: Colors.text.heading,
        },
        palaceNameActiveV2: {
            color: Colors.accent.gold,
        },
        branchBlockV2: {
            alignItems: 'center',
        },
        zhangshengTextV2: {
            fontSize: compactBoard ? 10 : 12,
            color: Colors.text.primary,
            marginBottom: 2,
        },
        stemBranchBigV2: {
            fontSize: compactBoard ? 13 : 16,
            fontWeight: '700',
            color: Colors.text.heading,
            lineHeight: compactBoard ? 14 : 17,
        },
        centerCard: {
            position: 'absolute',
            borderRadius: BorderRadius.md,
            backgroundColor: Colors.bg.card,
            borderWidth: 0.5,
            borderColor: Colors.border.subtle,
            paddingHorizontal: Spacing.md,
            paddingTop: Spacing.sm,
            paddingBottom: Spacing.sm,
            overflow: 'hidden',
        },
        centerCardTop: {
            alignItems: 'center',
            minHeight: metrics.centerTopHeight,
            justifyContent: 'center',
            paddingTop: Spacing.xs,
            paddingBottom: Spacing.sm,
        },
        centerName: {
            fontSize: centerNameFont,
            color: Colors.text.heading,
            fontWeight: '700',
        },
        centerLine: {
            marginTop: 3,
            fontSize: centerBodyFont,
            color: Colors.text.secondary,
        },
        centerCardMiddle: {
            flex: 1,
            minHeight: Math.max(104, metrics.centerBottomHeight - 88),
            paddingTop: Spacing.md,
            paddingBottom: Spacing.sm,
            alignItems: 'center',
            justifyContent: 'center',
        },
        centerFocusTitle: {
            fontSize: FontSize.md,
            color: Colors.text.heading,
            fontWeight: '700',
        },
        centerScopeState: {
            marginTop: 4,
            fontSize: centerBodyFont,
            color: Colors.accent.gold,
            textAlign: 'center',
            fontWeight: '600',
        },
        centerFocusMeta: {
            marginTop: 4,
            fontSize: centerBodyFont,
            color: Colors.text.secondary,
            textAlign: 'center',
            lineHeight: 18,
        },
        centerBadgeRowText: {
            marginTop: 8,
            fontSize: centerBodyFont,
            color: Colors.text.secondary,
            textAlign: 'center',
        },
        centerMutagenGrid: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 8,
            marginTop: 10,
            maxWidth: 160,
        },
        centerMutagenText: {
            width: '45%',
            fontSize: compactBoard ? 11 : 12,
            color: Colors.text.heading,
            fontWeight: '500',
        },
        centerMutagenTextLeft: {
            textAlign: 'right',
        },
        centerMutagenTextRight: {
            textAlign: 'left',
        },
        centerMutagenTextInactive: {
            color: Colors.text.tertiary,
        },
        centerCardBottom: {
            paddingTop: Spacing.sm,
        },
        centerPillarsRow: {
            flexDirection: 'row',
            gap: 8,
            justifyContent: 'center',
            marginTop: 4,
        },
        pillarColumn: {
            width: 32,
            alignItems: 'center',
        },
        pillarHead: {
            fontSize: tileTagFont,
            color: Colors.text.tertiary,
            marginBottom: 2,
        },
        pillarValue: {
            fontSize: compactBoard ? 12 : 13,
            color: Colors.text.heading,
            fontWeight: '700',
        },
        centerSnapshotFooter: {
            marginTop: Spacing.xs,
            fontSize: tileTagFont,
            color: Colors.text.tertiary,
            textAlign: 'center',
        },
        drawerShell: {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            borderTopLeftRadius: BorderRadius.xl,
            borderTopRightRadius: BorderRadius.xl,
            backgroundColor: Colors.bg.card,
            borderTopWidth: 1,
            borderColor: Colors.border.subtle,
            shadowColor: Colors.text.heading,
            shadowOpacity: 0.08,
            shadowRadius: 14,
            elevation: 12,
            overflow: 'hidden',
        },
        drawerHandleArea: {
            minHeight: DRAWER_PEEK_HEIGHT,
            paddingTop: Spacing.sm,
            paddingHorizontal: Spacing.lg,
            paddingBottom: Spacing.sm,
            justifyContent: 'center',
        },
        drawerSummaryRow: {
            gap: 0,
        },
        drawerExpandRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
        },
        drawerExpandText: {
            fontSize: FontSize.sm,
            color: Colors.text.secondary,
            textAlign: 'center',
            fontWeight: '600',
        },
        drawerExpandArrow: {
            fontSize: FontSize.sm,
            color: Colors.text.secondary,
            fontWeight: '700',
        },
        drawerExpandArrowExpanded: {
            transform: [{ rotate: '180deg' }],
        },
        drawerSummaryPills: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: 6,
        },
        drawerSummaryPill: {
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: BorderRadius.round,
            backgroundColor: Colors.bg.elevated,
            borderWidth: 1,
            borderColor: Colors.border.subtle,
        },
        drawerSummaryPillActive: {
            borderColor: Colors.accent.gold,
            backgroundColor: 'rgba(191,203,231,0.36)',
        },
        drawerSummaryPillText: {
            fontSize: 11,
            color: Colors.text.primary,
            fontWeight: '600',
        },
        drawerContent: {
            flex: 1,
        },
        drawerContentInner: {
            paddingHorizontal: Spacing.lg,
            paddingTop: Spacing.xs,
            paddingBottom: Spacing.md,
        },
        drawerScopeRow: {
            gap: 6,
            paddingBottom: Spacing.sm,
        },
        drawerScopeBtn: {
            minHeight: 38,
            paddingHorizontal: 12,
            borderRadius: BorderRadius.round,
            backgroundColor: Colors.bg.elevated,
            borderWidth: 1,
            borderColor: Colors.border.subtle,
            alignItems: 'center',
            justifyContent: 'center',
        },
        drawerScopeBtnActive: {
            borderColor: Colors.accent.gold,
            backgroundColor: 'rgba(191,203,231,0.36)',
        },
        drawerScopeText: {
            fontSize: FontSize.sm,
            color: Colors.text.secondary,
        },
        drawerScopeTextActive: {
            color: Colors.text.heading,
            fontWeight: '700',
        },
        drawerRowSection: {
            marginBottom: Spacing.sm,
        },
        drawerRowTitle: {
            fontSize: FontSize.sm,
            color: Colors.text.secondary,
            marginBottom: 6,
            fontWeight: '600',
        },
        drawerTrackList: {
            gap: 8,
            paddingRight: Spacing.sm,
        },
        drawerTrackItem: {
            width: 88,
            minHeight: 54,
            borderRadius: BorderRadius.md,
            backgroundColor: Colors.bg.elevated,
            borderWidth: 1,
            borderColor: Colors.border.subtle,
            paddingHorizontal: 8,
            justifyContent: 'center',
        },
        drawerTrackItemActive: {
            borderColor: Colors.accent.gold,
            backgroundColor: Colors.bg.primary,
        },
        drawerTrackPrimary: {
            fontSize: FontSize.sm,
            color: Colors.text.heading,
            fontWeight: '700',
        },
        drawerTrackPrimaryActive: {
            color: Colors.accent.gold,
        },
        drawerTrackSecondary: {
            marginTop: 2,
            fontSize: FontSize.xs,
            color: Colors.text.tertiary,
        },
        drawerTrackSecondaryActive: {
            color: Colors.accent.gold,
        },
        analysisScroll: {
            flex: 1,
            paddingHorizontal: Spacing.lg,
            marginTop: Spacing.md,
        },
        analysisCard: {
            borderRadius: BorderRadius.xl,
            backgroundColor: Colors.bg.card,
            borderWidth: 1,
            borderColor: Colors.border.subtle,
            padding: Spacing.lg,
            marginBottom: Spacing.md,
        },
        analysisCardTitle: {
            fontSize: FontSize.md,
            color: Colors.text.heading,
            fontWeight: '700',
            marginBottom: Spacing.sm,
        },
        analysisCardLine: {
            fontSize: FontSize.sm,
            color: Colors.text.secondary,
            lineHeight: 22,
            marginBottom: 4,
        },
        modalWrap: {
            flex: 1,
            backgroundColor: Colors.bg.overlay,
        },
        modalBackdrop: {
            ...StyleSheet.absoluteFillObject,
        },
        configModalCard: {
            marginTop: 'auto',
            marginHorizontal: Spacing.lg,
            marginBottom: Spacing.xl,
            borderRadius: BorderRadius.xl,
            backgroundColor: Colors.bg.primary,
            borderWidth: 1,
            borderColor: Colors.border.subtle,
            padding: Spacing.md,
            gap: Spacing.md,
        },
        configModalActions: {
            flexDirection: 'row',
            justifyContent: 'flex-end',
            gap: Spacing.sm,
        },
        configActionBtn: {
            minHeight: 44,
            borderRadius: BorderRadius.round,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: Spacing.lg,
        },
        configActionPrimary: {
            backgroundColor: Colors.accent.gold,
        },
        configActionSecondary: {
            backgroundColor: Colors.bg.elevated,
            borderWidth: 1,
            borderColor: Colors.border.subtle,
        },
        configActionDisabled: {
            opacity: 0.6,
        },
        configActionText: {
            fontSize: FontSize.sm,
            fontWeight: '600',
        },
        configActionPrimaryText: {
            color: Colors.text.inverse,
        },
        configActionSecondaryText: {
            color: Colors.text.primary,
        },
        configErrorText: {
            fontSize: FontSize.xs,
            lineHeight: 18,
            color: Colors.accent.red,
        },
        zoomCard: {
            position: 'absolute',
        },
        zoomTileViewport: {
            flex: 1,
        },
        zoomTileBase: {
            position: 'absolute',
        },
        errorWrap: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: Spacing.xl,
        },
        errorTitle: {
            fontSize: FontSize.xl,
            color: Colors.text.heading,
            fontWeight: '700',
        },
        errorText: {
            marginTop: Spacing.md,
            fontSize: FontSize.sm,
            color: Colors.text.secondary,
            lineHeight: 22,
            textAlign: 'center',
        },
        errorAction: {
            marginTop: Spacing.xl,
            minHeight: 48,
            minWidth: 180,
            borderRadius: BorderRadius.round,
            backgroundColor: Colors.accent.gold,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: Spacing.xl,
        },
        errorActionText: {
            color: Colors.text.inverse,
            fontSize: FontSize.md,
            fontWeight: '700',
        },
    });
};
