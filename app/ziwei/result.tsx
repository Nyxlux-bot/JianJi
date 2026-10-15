import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    LayoutChangeEvent,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from 'react-native';
import { ScrollView as GestureScrollView } from 'react-native-gesture-handler';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AIChatModal from '../../src/components/AIChatModal';
import ConfirmModal from '../../src/components/ConfirmModal';
import { BackIcon } from '../../src/components/Icons';
import OverflowMenu, { OverflowMenuItem } from '../../src/components/OverflowMenu';
import StatusBarDecor from '../../src/components/StatusBarDecor';
import { CustomAlert } from '../../src/components/CustomAlertProvider';
import { deleteRecord, getRecord, saveRecord, toggleFavorite } from '../../src/db/database';
import { recordDiagnosticLog } from '../../src/services/diagnostics';
import { cloneZiweiFormatterContext } from '../../src/features/ziwei/ai-context';
import ZiweiConfigPanel from '../../src/features/ziwei/components/ZiweiConfigPanel';
import {
    buildZiweiAIConfigSignature,
    buildZiweiRecordResult,
    buildZiweiSummary,
    hasZiweiAIArtifacts,
    isZiweiAIConfigStale,
    isZiweiRuleSignatureCurrent,
    toZiweiInputPayload,
    ZiweiRecordResult,
} from '../../src/features/ziwei/record';
import { consumeZiweiSession, primeZiweiSession } from '../../src/features/ziwei/result-session';
import { isAIConfigured } from '../../src/services/settings';
import { clearAIAnalysisJob } from '../../src/services/ai-analysis-jobs';
import { useTheme } from '../../src/theme/ThemeContext';
import { BorderRadius, FontSize, Spacing } from '../../src/theme/colors';
import { formatLocalDateTime } from '../../src/core/bazi-local-time';
import {
    computeZiweiDynamicHoroscope,
    getZiweiStaticStarInsights,
    normalizeZiweiHoroscopeCursorDate,
    ZIWEI_DEFAULT_CONFIG,
} from '../../src/features/ziwei/iztro-adapter';
import { scheduleIdleTask, ZiweiChartEngine } from '../../src/features/ziwei/chart-engine';
import {
    buildNatalLayer,
    buildPrewarmResolvers,
    buildScopeLayer,
    buildZiweiCursorInfo,
    buildZiweiTrack,
    ZIWEI_VIEWS,
    type ZiweiView,
} from '../../src/features/ziwei/scope-layer';
import { buildZiweiPalette } from '../../src/features/ziwei/board/palette';
import { computeZiweiStageLayout, ZIWEI_STAGE } from '../../src/features/ziwei/board/layout';
import { makeBoardStyles, ZiweiBoardView } from '../../src/features/ziwei/board/ZiweiBoardView';
import { ZiweiTimeAxis } from '../../src/features/ziwei/board/ZiweiTimeAxis';
import {
    GanzhiSpan,
    makeDetailStyles,
    ZiweiLocator,
    ZiweiPalaceDetail,
} from '../../src/features/ziwei/board/ZiweiPalaceDetail';
import { ChevronIcon, ZiweiPeekBar, ZiweiSheet, ZiweiTopBar } from '../../src/features/ziwei/board/ZiweiChrome';
import { ZiweiZoomCard } from '../../src/features/ziwei/board/ZiweiZoomCard';
import { ZiweiInfoPanel } from '../../src/features/ziwei/board/ZiweiInfoPanel';
import {
    createZiweiSelectionStore,
    useZiweiSelectedIndex,
    type ZiweiSelectionStore,
} from '../../src/features/ziwei/board/selection-store';
import type {
    ZiweiActiveScope,
    ZiweiDynamicHoroscopeResult,
    ZiweiInputPayload,
    ZiweiPalaceAnalysisView,
    ZiweiStaticChartResult,
    ZiweiTopTab,
} from '../../src/features/ziwei/types';

const BRANCH_ZODIAC: Record<string, string> = {
    子: '鼠', 丑: '牛', 寅: '虎', 卯: '兔', 辰: '龙', 巳: '蛇',
    午: '马', 未: '羊', 申: '猴', 酉: '鸡', 戌: '狗', 亥: '猪',
};
const MemoStatusBarDecor = memo(StatusBarDecor);

/** AI 对话框只在打开过之后挂载；隐藏期间冻结上下文，点宫位、切运限时不跟着重画 */
const ZiweiAIChat = memo(function ZiweiAIChat({
    visible,
    result,
    context,
    onClose,
    onUpdate,
}: {
    visible: boolean;
    result: ZiweiRecordResult;
    context: ReturnType<typeof cloneZiweiFormatterContext>;
    onClose: () => void;
    onUpdate: (result: ZiweiRecordResult) => void;
}) {
    return (
        <AIChatModal
            visible={visible}
            onClose={onClose}
            result={result}
            ziweiContext={context}
            onUpdateResult={(updated) => onUpdate(updated as ZiweiRecordResult)}
        />
    );
}, (prev, next) => !next.visible && !prev.visible && prev.result === next.result);

/**
 * 订阅选中宫位的小区块：点宫位只重画这里面的内容（详情条、详情页、宽屏侧栏），
 * 页面本身与十二个宫格都不动。
 */
function SelectedPalace({
    selection,
    isValid,
    fallback,
    paused = false,
    children,
}: {
    selection: ZiweiSelectionStore;
    isValid: (index: number) => boolean;
    fallback: number;
    paused?: boolean;
    children: (index: number) => React.ReactNode;
}) {
    const index = useZiweiSelectedIndex(selection, isValid, fallback, paused);
    return <>{children(index)}</>;
}

/**
 * 收起的详情页停在后台：连续两次都是 frozen 时跳过重画（切运限等不会叫醒它）；
 * 由开到关的那一次照常传下去，好让面板收到 visible=false 走完收起动画。
 */
const Freeze = memo(function Freeze({ children }: { frozen: boolean; children: React.ReactNode }) {
    return <>{children}</>;
}, (prev, next) => prev.frozen && next.frozen);

const VIEW_LABEL: Record<ZiweiView, string> = Object.fromEntries(ZIWEI_VIEWS.map((item) => [item.key, item.label])) as Record<ZiweiView, string>;

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
    void recordDiagnosticLog({ level: 'warn', source: `ziwei:${scope}`, message });
}

function formatDot(local: string): string {
    // 1990-05-17T08:30 → 1990.05.17 08:30
    return local.replace('T', ' ').replace(/^(\d{4})-(\d{2})-(\d{2})/, '$1.$2.$3').slice(0, 16);
}

function viewToScope(view: ZiweiView): ZiweiActiveScope {
    return view === 'natal' ? 'yearly' : view;
}

function scopeToView(scope: ZiweiActiveScope | undefined): ZiweiView {
    if (!scope || scope === 'age') {
        return 'yearly';
    }
    return scope;
}

function formatConfigChips(config: ZiweiInputPayload['config']): string[] {
    return [
        config.algorithm === 'zhongzhou' ? '中州派' : '通行算法',
        config.yearDivide === 'exact' ? '年界立春' : '年界农历',
        config.horoscopeDivide === 'exact' ? '运限立春' : '运限农历',
        config.dayDivide === 'current' ? '晚子算当日' : '晚子算次日',
        config.astroType === 'earth' ? '地盘' : config.astroType === 'human' ? '人盘' : '天盘',
    ];
}

function getZiweiRuleDriftMessage(record: ZiweiRecordResult | null, hasSnapshot: boolean): string | null {
    if (!record || isZiweiRuleSignatureCurrent(record.ruleSignature)) {
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
        aiInvalidatedAt: configChanged && hasAI ? new Date().toISOString() : baseRecord.aiInvalidatedAt,
    };
}

function buildPersistStatusNotice(status: 'saving' | 'saved' | 'error' | null, errorMessage: string): { tone: 'neutral' | 'warning'; text: string } | null {
    if (status === 'saving') {
        return { tone: 'neutral', text: '正在按新配置重算并保存命盘，当前页面会在完成后直接更新。' };
    }
    if (status === 'error') {
        return { tone: 'warning', text: errorMessage || '命盘保存失败，请重试。' };
    }
    return null;
}

/** 空闲时预算附近的落点：命中缓存后，切换只剩渲染 */
function schedulePrewarm(tasks: Array<() => void>, delay = 120): () => void {
    let cancelled = false;
    // 定时器与空闲回调分开取消：新架构的 cancelIdleCallback 只认空闲句柄，传定时器 id 会直接抛错
    let pending: { cancel: () => void } | null = null;
    const next = (index: number) => {
        if (cancelled || index >= tasks.length) {
            return;
        }
        pending = scheduleIdleTask(() => {
            if (cancelled) {
                return;
            }
            try {
                tasks[index]();
            } catch {
                // 预热失败不影响交互
            }
            next(index + 1);
        }, 400);
    };
    const timer = setTimeout(() => next(0), delay);
    return () => {
        cancelled = true;
        clearTimeout(timer);
        pending?.cancel();
    };
}

export default function ZiweiResultPage() {
    const { Colors } = useTheme();
    const insets = useSafeAreaInsets();
    const { width: screenWidth, height: screenHeight } = useWindowDimensions();
    const palette = useMemo(() => buildZiweiPalette(Colors), [Colors]);
    const styles = useMemo(() => makeStyles(Colors, palette), [Colors, palette]);
    const detailStyles = useMemo(() => makeDetailStyles(palette), [palette]);
    const params = useLocalSearchParams<{ recordId?: string | string[] }>();
    const recordId = useMemo(() => (Array.isArray(params.recordId) ? params.recordId[0] : params.recordId), [params.recordId]);

    const [view, setView] = useState<ZiweiView>('yearly');
    const [cursorDate, setCursorDate] = useState<Date>(() => normalizeZiweiHoroscopeCursorDate(new Date()));
    const selection = useMemo(() => createZiweiSelectionStore(), []);
    const selectedStarRef = useRef<string | null>(null);
    const [aiContext, setAiContext] = useState<ReturnType<typeof cloneZiweiFormatterContext> | null>(null);
    const [detailOpen, setDetailOpen] = useState(false);
    const [detailMounted, setDetailMounted] = useState(false);
    const [infoOpen, setInfoOpen] = useState(false);
    const [infoMounted, setInfoMounted] = useState(false);
    const [zoomIndex, setZoomIndex] = useState<number | null>(null);
    const [zoomMounted, setZoomMounted] = useState(false);
    const [aiChatMounted, setAiChatMounted] = useState(false);
    const [stageHeight, setStageHeight] = useState<number | null>(null);
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
    }>({ status: 'loading', chart: null, error: '' });
    const [runtime, setRuntime] = useState<{
        chartKey: string | null;
        dynamic: ZiweiDynamicHoroscopeResult | null;
        error: string;
    }>({ chartKey: null, dynamic: null, error: '' });
    const isPersisting = persistStatus === 'saving';
    const hasPersistedRecord = persistStatus === null || persistStatus === 'saved';
    const staticChart = staticState.chart;
    const staticChartRef = useRef<ZiweiStaticChartResult | null>(null);
    staticChartRef.current = staticChart;
    const aiInputRef = useRef<{ cursorDate: Date; view: ZiweiView; activeTopTab: ZiweiTopTab; mingIndex: number }>({
        cursorDate,
        view,
        activeTopTab: 'chart',
        mingIndex: 0,
    });
    const palaceByIndexRef = useRef<ZiweiPalaceAnalysisView[]>([]);

    /* -------------------------------- 读取记录 -------------------------------- */

    useEffect(() => {
        let cancelled = false;
        const resetForMissingRecord = (message: string) => {
            setRecordResult(null);
            setIsFavorite(false);
            setActivePayload(null);
            setStaticState({ status: 'error', chart: null, error: message });
            setRuntime({ chartKey: null, dynamic: null, error: '' });
        };

        setView('yearly');
        selection.set(-1);
        selectedStarRef.current = null;
        setDetailOpen(false);
        setDetailMounted(false);
        setInfoOpen(false);
        setInfoMounted(false);
        setZoomIndex(null);
        setZoomMounted(false);
        premountKeyRef.current = null;
        setSettingsVisible(false);
        setSettingsDraftConfig(null);

        if (!recordId) {
            resetForMissingRecord('缺少紫微记录。');
            return;
        }

        setPersistStatus(null);
        setPersistError('');
        const session = consumeZiweiSession(recordId);
        if (session) {
            setRecordResult(session.record);
            setIsFavorite(session.isFavorite);
            setActivePayload(toZiweiInputPayload(session.record));
            setView(scopeToView(session.activeScope));
            setCursorDate(new Date(session.runtimeBundle.dynamic.cursorDate));
            setStaticState({ status: 'ready', chart: session.staticChart, error: '' });
            setRuntime({ chartKey: session.staticChart.cacheKey, dynamic: session.runtimeBundle.dynamic, error: '' });
            return;
        }

        setRecordResult(null);
        setIsFavorite(false);
        setActivePayload(null);
        setStaticState({ status: 'loading', chart: null, error: '' });
        setRuntime({ chartKey: null, dynamic: null, error: '' });

        void (async () => {
            const detail = await getRecord(recordId);
            if (cancelled) {
                return;
            }
            if (!detail || detail.engineType !== 'ziwei') {
                resetForMissingRecord('记录不存在、已被删除，或属于旧版紫微数据。');
                return;
            }
            setRecordResult(detail.result);
            setIsFavorite(detail.isFavorite);
            setActivePayload(toZiweiInputPayload(detail.result));
        })();

        return () => {
            cancelled = true;
        };
    }, [recordId, selection]);

    useEffect(() => {
        let cancelled = false;
        if (!activePayload || staticState.status === 'error') {
            return;
        }
        const activeChart = staticState.chart;
        if (
            staticState.status === 'ready'
            && activeChart
            && activeChart.input.birthLocal === activePayload.birthLocal
            && activeChart.input.longitude === activePayload.longitude
            && activeChart.input.gender === activePayload.gender
            && activeChart.input.daylightSavingEnabled === activePayload.daylightSavingEnabled
            && activeChart.input.calendarType === activePayload.calendarType
            && buildZiweiAIConfigSignature(activeChart.input.config) === buildZiweiAIConfigSignature(activePayload.config)
            && activeChart.input.name === activePayload.name
            && activeChart.input.cityLabel === activePayload.cityLabel
        ) {
            return;
        }

        setStaticState({ status: 'loading', chart: null, error: '' });
        void ZiweiChartEngine.prepareStaticChart(activePayload)
            .then((chart) => {
                if (!cancelled) {
                    setStaticState({ status: 'ready', chart, error: '' });
                }
            })
            .catch((error: unknown) => {
                logZiweiRuntimeWarning('prepareStaticChart', error);
                if (!cancelled) {
                    setStaticState({
                        status: 'error',
                        chart: null,
                        error: error instanceof Error ? error.message : '命盘参数无效，无法恢复静态命盘。',
                    });
                }
            });

        return () => {
            cancelled = true;
        };
    }, [activePayload, staticState.chart, staticState.status]);

    /* -------------------------------- 运限 -------------------------------- */

    // 运限同步计算：查表后冷启动约 1–2 ms，命中缓存约 0.2 ms，一次点击只触发一次渲染
    const applyCursor = useCallback((cursor: Date) => {
        const chart = staticChartRef.current;
        if (!chart) {
            return;
        }
        try {
            const dynamic = computeZiweiDynamicHoroscope(chart, cursor);
            setRuntime({ chartKey: chart.cacheKey, dynamic, error: '' });
            setCursorDate(dynamic.cursorDate);
        } catch (error) {
            logZiweiRuntimeWarning('computeDynamic', error);
            setRuntime((current) => ({
                ...current,
                error: error instanceof Error ? error.message : '当前运限计算失败。',
            }));
        }
    }, []);

    useEffect(() => {
        if (staticChart && runtime.chartKey !== staticChart.cacheKey) {
            applyCursor(cursorDate);
        }
    }, [applyCursor, cursorDate, runtime.chartKey, staticChart]);

    const dynamic = staticChart && runtime.chartKey === staticChart.cacheKey ? runtime.dynamic : null;

    /* -------------------------------- 盘面数据 -------------------------------- */

    const chartSnapshot = recordResult?.chartSnapshot?.version === 1 ? recordResult.chartSnapshot : null;
    const palaces: ZiweiPalaceAnalysisView[] | null = staticChart?.palaces || chartSnapshot?.palaces || null;
    const workbench = staticChart?.workbenchLayout || chartSnapshot?.workbenchLayout || null;
    const palaceByIndex = useMemo(() => {
        const result: ZiweiPalaceAnalysisView[] = [];
        palaces?.forEach((palace) => {
            result[palace.palaceIndex] = palace;
        });
        return result;
    }, [palaces]);
    const mingIndex = useMemo(() => palaces?.find((palace) => palace.name === '命宫')?.palaceIndex ?? 0, [palaces]);
    const isValidIndex = useCallback((index: number) => Boolean(palaceByIndex[index]), [palaceByIndex]);
    const cellOf = useMemo(() => {
        const map = new Map<number, { row: number; col: number }>();
        workbench?.ringCells.forEach((cell) => map.set(cell.palaceIndex, { row: cell.row, col: cell.col }));
        return (index: number) => map.get(index);
    }, [workbench]);
    const ringOrder = useMemo(() => {
        // 按地支顺序（宫位序号）排，下一宫 = 顺时针下一格
        return [...(palaces || [])].sort((a, b) => a.palaceIndex - b.palaceIndex).map((palace) => palace.palaceIndex);
    }, [palaces]);
    const stepIndex = useCallback((from: number, direction: -1 | 1) => {
        const position = ringOrder.indexOf(from);
        if (position < 0 || ringOrder.length === 0) {
            return from;
        }
        return ringOrder[(position + direction + ringOrder.length) % ringOrder.length];
    }, [ringOrder]);

    const cursorInfo = useMemo(() => (dynamic ? buildZiweiCursorInfo(dynamic) : null), [dynamic]);
    const natalLayer = useMemo(() => (staticChart ? buildNatalLayer(staticChart) : null), [staticChart]);
    const layer = useMemo(() => {
        if (!staticChart || !dynamic || !cursorInfo) {
            return null;
        }
        return view === 'natal' ? natalLayer : buildScopeLayer(staticChart, dynamic, view, cursorInfo);
    }, [cursorInfo, dynamic, natalLayer, staticChart, view]);
    const track = useMemo(() => (
        staticChart && dynamic && cursorInfo ? buildZiweiTrack(staticChart, dynamic, view, cursorInfo) : null
    ), [cursorInfo, dynamic, staticChart, view]);
    const starInsights = useMemo(() => (
        staticChart && (detailMounted || screenWidth >= 720) ? getZiweiStaticStarInsights(staticChart).starByName : null
    ), [detailMounted, screenWidth, staticChart]);

    useEffect(() => {
        if (!track || !staticChart) {
            return undefined;
        }
        const chart = staticChart;
        const tasks = buildPrewarmResolvers(track).map((resolve) => () => {
            computeZiweiDynamicHoroscope(chart, resolve());
        });
        return schedulePrewarm(tasks);
    }, [staticChart, track]);

    // 首屏稳定后，空闲时先把星曜释义算好、把详情页和放大卡挂在后台，点开只剩动画
    const boardReady = Boolean(staticChart && palaces && workbench && dynamic);
    const premountKeyRef = useRef<string | null>(null);
    useEffect(() => {
        if (!boardReady || !staticChart || screenWidth >= 720 || premountKeyRef.current === staticChart.cacheKey) {
            return undefined;
        }
        const chart = staticChart;
        return schedulePrewarm([
            () => {
                getZiweiStaticStarInsights(chart);
            },
            () => setDetailMounted(true),
            () => {
                setZoomMounted(true);
                premountKeyRef.current = chart.cacheKey;
            },
        ], 900);
    }, [boardReady, screenWidth, staticChart]);

    /* -------------------------------- 尺寸 -------------------------------- */

    const narrow = screenWidth < 380;
    const statusTop = Math.max(insets.top, 24);
    const estimatedStage = screenHeight - statusTop - 52 - insets.bottom;
    const layout = useMemo(() => (
        workbench ? computeZiweiStageLayout(workbench, screenWidth, Math.max(320, (stageHeight ?? estimatedStage + insets.bottom) - insets.bottom)) : null
    ), [estimatedStage, insets.bottom, screenWidth, stageHeight, workbench]);
    const boardStyles = useMemo(() => makeBoardStyles(palette, layout?.fontScale ?? 1), [layout?.fontScale, palette]);
    const handleStageLayout = useCallback((event: LayoutChangeEvent) => {
        const next = Math.round(event.nativeEvent.layout.height);
        setStageHeight((current) => (current === next ? current : next));
    }, []);

    /* -------------------------------- 交互 -------------------------------- */

    const handleSelect = useCallback((index: number) => {
        selection.set(index);
        selectedStarRef.current = null;
    }, [selection]);
    const handleSelectStar = useCallback((name: string | null) => {
        selectedStarRef.current = name;
    }, []);
    const handleDoubleTap = useCallback((index: number) => {
        selection.set(index);
        selectedStarRef.current = null;
        setZoomMounted(true);
        setZoomIndex(index);
    }, [selection]);
    const handleChangeView = useCallback((next: ZiweiView) => setView(next), []);
    const handleToday = useCallback(() => applyCursor(new Date()), [applyCursor]);
    const handleOpenDetail = useCallback(() => {
        setZoomIndex(null);
        setDetailMounted(true);
        setDetailOpen(true);
    }, []);
    const handleCloseDetail = useCallback(() => setDetailOpen(false), []);
    const handleInfoClosed = useCallback(() => setInfoMounted(false), []);
    const handleCloseInfo = useCallback(() => setInfoOpen(false), []);
    const handleCloseAI = useCallback(() => setAiChatVisible(false), []);
    const handleUpdateAI = useCallback((updated: ZiweiRecordResult) => setRecordResult(updated), []);
    const handleStepPalace = useCallback((direction: -1 | 1) => {
        const current = selection.get();
        selection.set(stepIndex(current >= 0 && isValidIndex(current) ? current : mingIndex, direction));
        selectedStarRef.current = null;
    }, [isValidIndex, mingIndex, selection, stepIndex]);
    const zoomIndexRef = useRef<number | null>(null);
    zoomIndexRef.current = zoomIndex;
    // 收起后放大卡留在后台，继续显示上一次的宫位
    const zoomShownRef = useRef<number | null>(null);
    if (zoomIndex !== null) {
        zoomShownRef.current = zoomIndex;
    }
    const handleZoomStep = useCallback((direction: -1 | 1) => {
        const next = stepIndex(zoomIndexRef.current ?? mingIndex, direction);
        selection.set(next);
        selectedStarRef.current = null;
        setZoomIndex(next);
    }, [mingIndex, selection, stepIndex]);
    const handleCloseZoom = useCallback(() => setZoomIndex(null), []);
    const handleIdentity = useCallback(() => {
        setInfoMounted(true);
        setInfoOpen(true);
    }, []);

    useEffect(() => {
        let cancelled = false;
        void isAIConfigured().then((configured) => {
            if (!cancelled) {
                setAiConfigured(configured);
            }
        });
        return () => {
            cancelled = true;
        };
    }, []);

    const handleOpenAIChat = useCallback(() => {
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
        const input = aiInputRef.current;
        const current = selection.get();
        const palace = palaceByIndexRef.current[current >= 0 ? current : -1] || palaceByIndexRef.current[input.mingIndex];
        setAiContext(cloneZiweiFormatterContext({
            cursorDateIso: input.cursorDate.toISOString(),
            activeScope: viewToScope(input.view),
            selectedPalaceName: palace?.name || '命宫',
            selectedStarName: selectedStarRef.current,
            activeTopTab: input.activeTopTab,
        }));
        setAiChatMounted(true);
        setAiChatVisible(true);
    }, [aiConfigured, recordResult, selection]);

    const handleEdit = () => {
        if (!recordId || isPersisting) {
            return;
        }
        router.push(`/ziwei/input?editId=${recordId}`);
    };

    const handleOpenSettings = useCallback(() => {
        if (!recordResult) {
            return;
        }
        setPersistError('');
        setSettingsDraftConfig(activePayload?.config || recordResult.config);
        setSettingsVisible(true);
    }, [activePayload, recordResult]);

    const handleInfoEditConfig = useCallback(() => {
        setInfoOpen(false);
        handleOpenSettings();
    }, [handleOpenSettings]);
    const handleInfoOpenPalace = useCallback((index: number) => {
        selection.set(index);
        selectedStarRef.current = null;
        setInfoOpen(false);
        // 宽屏右侧栏就是详情，选中即可
        if (screenWidth < 720) {
            handleOpenDetail();
        }
    }, [handleOpenDetail, screenWidth, selection]);

    const handleDismissSettings = useCallback(() => {
        if (persistStatus === 'saving') {
            return;
        }
        setSettingsVisible(false);
        setSettingsDraftConfig(null);
        setPersistError('');
    }, [persistStatus]);

    const settingsDirty = useMemo(() => {
        const currentConfig = activePayload?.config || recordResult?.config || staticChart?.input.config || null;
        if (!settingsDraftConfig || !currentConfig) {
            return false;
        }
        return buildZiweiAIConfigSignature(settingsDraftConfig) !== buildZiweiAIConfigSignature(currentConfig);
    }, [activePayload, recordResult, settingsDraftConfig, staticChart]);

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
            const nextPayload: ZiweiInputPayload = { ...activePayload, config: settingsDraftConfig };
            const scope = viewToScope(view);
            const prepared = await ZiweiChartEngine.preparePreparedChart(nextPayload, cursorDate, scope);
            const nextRecord = buildUpdatedZiweiRecord({
                baseRecord: recordResult,
                staticChart: prepared.staticChart,
                dynamic: prepared.initialBundle.dynamic,
            });
            await saveRecord({ engineType: 'ziwei', result: nextRecord, summary: buildZiweiSummary(nextRecord) });
            setActivePayload(nextPayload);
            setStaticState({ status: 'ready', chart: prepared.staticChart, error: '' });
            setRuntime({ chartKey: prepared.staticChart.cacheKey, dynamic: prepared.initialBundle.dynamic, error: '' });
            setRecordResult(nextRecord);
            primeZiweiSession(recordId, {
                record: nextRecord,
                staticChart: prepared.staticChart,
                runtimeBundle: prepared.initialBundle,
                activeScope: scope,
                isFavorite,
            });
            setSettingsVisible(false);
            setSettingsDraftConfig(null);
            setPersistStatus(null);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : '紫微配置保存失败';
            setPersistStatus('error');
            setPersistError(message);
            CustomAlert.alert('保存失败', `${message}。当前页面仍保留最新盘面，可重试保存。`);
        }
    }, [activePayload, cursorDate, handleDismissSettings, isFavorite, recordId, recordResult, settingsDirty, settingsDraftConfig, view]);

    const handleRetryPersist = () => {
        if (settingsVisible) {
            void handleSaveSettings();
        }
    };

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
        await clearAIAnalysisJob('ziwei', recordId);
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
    const handleMenu = useCallback(() => setMenuVisible((prev) => !prev), []);
    const handleBack = useCallback(() => router.back(), []);

    /* -------------------------------- 文案 -------------------------------- */

    const currentName = staticChart?.input.name?.trim() || recordResult?.name?.trim() || '匿名命盘';
    const genderLabel = (staticChart?.input.gender || recordResult?.gender) === 'female' ? '坤造' : '乾造';
    const fiveElements = (staticChart?.astrolabe.fiveElementsClass as string | undefined) || chartSnapshot?.staticMeta.fiveElementsClass || '';
    const birthLocal = staticChart ? formatLocalDateTime(staticChart.input.birthLocalDate) : chartSnapshot?.staticMeta.birthLocal || '';
    const trueSolar = staticChart ? formatLocalDateTime(staticChart.input.trueSolarDate) : chartSnapshot?.staticMeta.trueSolarDateTimeLocal || '';
    const dateLine = birthLocal
        ? `${formatDot(birthLocal)}${narrow || !trueSolar ? '' : ` · 真太阳时 ${trueSolar.replace(/^.*T/, '').slice(0, 5)}`}`
        : '';
    const chineseDate = (staticChart?.astrolabe.chineseDate as string | undefined) || chartSnapshot?.staticMeta.chineseDate || '';
    const zodiac = (staticChart?.astrolabe.zodiac as string | undefined)
        || BRANCH_ZODIAC[chineseDate.split(' ')[0]?.[1] || '']
        || null;
    const soul = (staticChart?.astrolabe.soul as string | undefined) || chartSnapshot?.staticMeta.soul || '';
    const body = (staticChart?.astrolabe.body as string | undefined) || chartSnapshot?.staticMeta.body || '';
    const cityLabel = staticChart?.input.cityLabel || recordResult?.cityLabel || '';
    const lunarLine = staticChart ? `${staticChart.astrolabe.lunarDate} ${staticChart.input.timeLabel}` : chartSnapshot?.staticMeta.lunarDate || '';
    const infoDateRows = useMemo<Array<[string, string]>>(() => [
        ['阳历', birthLocal ? formatDot(birthLocal) : '—'],
        ['真太阳时', trueSolar ? `${formatDot(trueSolar)}${cityLabel ? ` · ${cityLabel}` : ''}` : '—'],
        ['农历', lunarLine || '—'],
    ], [birthLocal, cityLabel, lunarLine, trueSolar]);
    const infoConfig = activePayload?.config || recordResult?.config || staticChart?.input.config || ZIWEI_DEFAULT_CONFIG;
    const infoConfigChips = useMemo(() => formatConfigChips(infoConfig), [infoConfig]);
    const metaFor = useCallback((palace: ZiweiPalaceAnalysisView) => {
        const range = palace.decadalRange.replace(/[^\d–-]/g, '').replace('-', '–');
        const role = view !== 'natal' && dynamic ? dynamic.runtimeSnapshot.scopes[view].palaceNames[palace.palaceIndex] : '';
        return [`大限 ${range}`, role ? `${VIEW_LABEL[view]}${role}` : ''].filter(Boolean).join(' · ');
    }, [dynamic, view]);
    const mutKeyOf = (index: number) => (layer ? layer.mutKeys[index] || '' : '');

    const ruleDriftMessage = useMemo(() => getZiweiRuleDriftMessage(recordResult, Boolean(recordResult?.chartSnapshot)), [recordResult]);
    const persistNotice = useMemo(() => buildPersistStatusNotice(persistStatus, persistError), [persistError, persistStatus]);
    const aiConfigStale = useMemo(() => isZiweiAIConfigStale(recordResult), [recordResult]);
    const activeTopTab: ZiweiTopTab = infoOpen ? 'info' : detailOpen ? 'palace' : 'chart';
    aiInputRef.current = { cursorDate, view, activeTopTab, mingIndex };
    palaceByIndexRef.current = palaceByIndex;

    const staticFatalError = staticState.status === 'error' && !chartSnapshot;

    if (staticFatalError) {
        return (
            <View style={styles.container}>
                <StatusBarDecor />
                <View style={styles.errorHeader}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.errorBack}>
                        <BackIcon size={24} />
                    </TouchableOpacity>
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

    /* -------------------------------- 渲染 -------------------------------- */

    const wide = layout?.mode === 'wide';
    const board = layout && palaces ? (
        <View style={styles.boardWrap}>
            <ZiweiBoardView
                palaces={palaces}
                layout={layout}
                layer={layer}
                selection={selection}
                isValidIndex={isValidIndex}
                fallbackIndex={mingIndex}
                soul={soul}
                body={body}
                chineseDate={chineseDate}
                zodiac={zodiac}
                palette={palette}
                styles={boardStyles}
                onSelect={handleSelect}
                onDoubleTap={staticChart ? handleDoubleTap : undefined}
            />
        </View>
    ) : (
        <View style={styles.loading}><Text style={styles.loadingText}>正在排盘…</Text></View>
    );
    const axis = track && natalLayer ? (
        <View style={styles.axisWrap}>
            <ZiweiTimeAxis
                view={view}
                track={track}
                natalMutagenStars={natalLayer.mutagenStars}
                palette={palette}
                onChangeView={handleChangeView}
                onChangeCursor={applyCursor}
                onToday={handleToday}
            />
        </View>
    ) : null;

    const renderDetailBody = (palace: ZiweiPalaceAnalysisView | undefined) => (palace && palaces ? (
        <ZiweiPalaceDetail
            palace={palace}
            palaces={palaces}
            dynamic={dynamic}
            cursorInfo={cursorInfo}
            view={view}
            mutKey={mutKeyOf(palace.palaceIndex)}
            starByName={starInsights}
            selectedStarName={null}
            onSelectStar={handleSelectStar}
            palette={palette}
            styles={detailStyles}
        />
    ) : null);

    const renderContextStrip = (palace: ZiweiPalaceAnalysisView) => (layer ? (
        <View style={styles.contextStrip}>
            <View style={styles.contextChip}><Text style={styles.contextChipText}>{layer.head.label}</Text></View>
            <Text style={styles.contextMain}>
                {layer.head.main}
                {layer.head.mainGanzhi ? ' · ' : ''}
                <GanzhiSpan text={layer.head.mainGanzhi} palette={palette} />
            </Text>
            <Text style={styles.contextMeta} numberOfLines={1}>{metaFor(palace)}</Text>
            <View style={{ flex: 1 }} />
            <Pressable onPress={handleOpenAIChat} hitSlop={8} disabled={!aiConfigured || !recordResult}>
                <Text style={[styles.contextAI, (!aiConfigured || !recordResult) && { opacity: 0.45 }]}>AI 解读</Text>
            </Pressable>
        </View>
    ) : null);

    const renderSheetHeader = (index: number) => {
        const palace = palaceByIndex[index];
        if (!palace) {
            return null;
        }
        const prevName = palaceByIndex[stepIndex(index, -1)]?.name || '';
        const nextName = palaceByIndex[stepIndex(index, 1)]?.name || '';
        return (
            <View>
                <View style={styles.sheetHead}>
                    <Pressable style={styles.sheetClose} onPress={handleCloseDetail} accessibilityLabel="收起详情">
                        <ChevronIcon direction="down" color={palette.ink} size={22} />
                    </Pressable>
                    <View style={styles.sheetTitleRow}>
                        <Pressable style={styles.sheetNav} onPress={() => handleStepPalace(-1)} accessibilityLabel={`上一宫 ${prevName}`}>
                            <ChevronIcon direction="left" color={palette.muted} />
                            <Text style={styles.sheetNavText}>{prevName}</Text>
                        </Pressable>
                        <Text style={styles.sheetTitle}>{palace.name}</Text>
                        <GanzhiSpan text={`${palace.heavenlyStem}${palace.earthlyBranch}`} palette={palette} style={styles.sheetGz} />
                        <Pressable style={styles.sheetNav} onPress={() => handleStepPalace(1)} accessibilityLabel={`下一宫 ${nextName}`}>
                            <Text style={styles.sheetNavText}>{nextName}</Text>
                            <ChevronIcon direction="right" color={palette.muted} />
                        </Pressable>
                    </View>
                    <Pressable style={styles.sheetClose} onPress={handleCloseDetail} accessibilityLabel="回到棋盘">
                        {palaces ? <ZiweiLocator palace={palace} palaces={palaces} cellOf={cellOf} palette={palette} /> : null}
                    </Pressable>
                </View>
                {renderContextStrip(palace)}
            </View>
        );
    };

    const zoomShownIndex = zoomShownRef.current ?? mingIndex;

    const stage = (
        <>
            {board}
            {axis}
        </>
    );

    return (
        <View style={styles.container}>
            <MemoStatusBarDecor backgroundColor={palette.page} />
            <ZiweiTopBar
                name={currentName}
                genderLabel={genderLabel}
                fiveElements={fiveElements}
                dateLine={dateLine}
                aiEnabled={aiConfigured && Boolean(recordResult)}
                menuEnabled={hasEnabledMenuItems}
                narrow={narrow}
                palette={palette}
                onBack={handleBack}
                onIdentity={handleIdentity}
                onAI={handleOpenAIChat}
                onMenu={handleMenu}
            />
            <OverflowMenu visible={menuVisible} top={statusTop + 52} right={Spacing.lg} items={menuItems} onClose={() => setMenuVisible(false)} />

            {ruleDriftMessage ? (
                <View style={styles.notice}><Text style={styles.noticeText}>{ruleDriftMessage}</Text></View>
            ) : null}
            {persistNotice ? (
                <View style={[styles.notice, persistNotice.tone === 'warning' && styles.noticeWarning]}>
                    <Text style={styles.noticeText}>{persistNotice.text}</Text>
                    {persistNotice.tone === 'warning' ? (
                        <TouchableOpacity style={styles.retryBtn} onPress={handleRetryPersist}>
                            <Text style={styles.retryBtnText}>重试保存</Text>
                        </TouchableOpacity>
                    ) : null}
                </View>
            ) : null}
            {aiConfigStale ? (
                <View style={[styles.notice, styles.noticeStale]}>
                    <Text style={styles.noticeText}>当前 AI 分析基于旧排盘口径，已失效。旧内容仍可查看，但继续追问前需要按当前配置重新开始 AI 分析。</Text>
                </View>
            ) : null}
            {runtime.error ? (
                <View style={[styles.notice, styles.noticeWarning]}><Text style={styles.noticeText}>{runtime.error}</Text></View>
            ) : null}

            <View style={styles.stage} onLayout={handleStageLayout}>
                {wide && layout ? (
                    <View style={styles.wideRow}>
                        <View style={{ width: layout.boardWidth + ZIWEI_STAGE.sidePadding * 2 }}>{stage}</View>
                        <View style={[styles.sidePanel, { width: layout.sideWidth }]}>
                            <SelectedPalace selection={selection} isValid={isValidIndex} fallback={mingIndex}>
                                {(index) => {
                                    const palace = palaceByIndex[index];
                                    return (
                                        <>
                                            {palace ? (
                                                <View style={styles.sideHead}>
                                                    <Text style={styles.sideTitle}>{palace.name}</Text>
                                                    <GanzhiSpan text={`${palace.heavenlyStem}${palace.earthlyBranch}`} palette={palette} style={styles.sideGz} />
                                                    <Text style={styles.sideMeta} numberOfLines={1}>{metaFor(palace)}</Text>
                                                </View>
                                            ) : null}
                                            <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 16 }} showsVerticalScrollIndicator={false}>
                                                {renderDetailBody(palace)}
                                            </ScrollView>
                                        </>
                                    );
                                }}
                            </SelectedPalace>
                        </View>
                    </View>
                ) : layout?.mode === 'scroll' ? (
                    <ScrollView contentContainerStyle={{ paddingBottom: (layout?.peekHeight ?? 0) + insets.bottom + 8 }} showsVerticalScrollIndicator={false}>
                        {stage}
                    </ScrollView>
                ) : (
                    stage
                )}
                {!wide && layout ? (
                    <SelectedPalace selection={selection} isValid={isValidIndex} fallback={mingIndex}>
                        {(index) => {
                            const palace = palaceByIndex[index] || null;
                            return (
                                <ZiweiPeekBar
                                    palace={palace}
                                    meta={palace ? metaFor(palace) : ''}
                                    mutKey={mutKeyOf(index)}
                                    compact={layout.mode !== 'std'}
                                    height={layout.peekHeight}
                                    bottomInset={insets.bottom}
                                    palette={palette}
                                    onOpen={handleOpenDetail}
                                />
                            );
                        }}
                    </SelectedPalace>
                ) : null}
            </View>

            {zoomMounted ? (
            <Freeze frozen={zoomIndex === null}>
                <ZiweiZoomCard
                    open={zoomIndex !== null}
                    palace={palaceByIndex[zoomShownIndex] || null}
                    prevName={palaceByIndex[stepIndex(zoomShownIndex, -1)]?.name || ''}
                    nextName={palaceByIndex[stepIndex(zoomShownIndex, 1)]?.name || ''}
                    dynamic={dynamic}
                    cursorInfo={cursorInfo}
                    view={view}
                    mutKey={mutKeyOf(zoomShownIndex)}
                    anchorY={statusTop + 52 + ZIWEI_STAGE.boardTop + (layout?.boardHeight ?? 400) / 2}
                    width={Math.min(screenWidth, 520)}
                    palette={palette}
                    onClose={handleCloseZoom}
                    onStep={handleZoomStep}
                    onOpenDetail={handleOpenDetail}
                />
            </Freeze>
            ) : null}

            {detailMounted && !wide ? (
            <Freeze frozen={!detailOpen}>
            <ZiweiSheet
                visible={detailOpen}
                topInset={statusTop}
                palette={palette}
                onClose={handleCloseDetail}
                onSwipe={handleStepPalace}
                keepMounted
                header={(
                    <SelectedPalace selection={selection} isValid={isValidIndex} fallback={mingIndex} paused={!detailOpen}>
                        {renderSheetHeader}
                    </SelectedPalace>
                )}
            >
                <GestureScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }} showsVerticalScrollIndicator={false}>
                    <SelectedPalace selection={selection} isValid={isValidIndex} fallback={mingIndex} paused={!detailOpen}>
                        {(index) => renderDetailBody(palaceByIndex[index])}
                    </SelectedPalace>
                </GestureScrollView>
            </ZiweiSheet>
            </Freeze>
            ) : null}

            {infoMounted ? (
            <ZiweiSheet
                visible={infoOpen}
                topInset={statusTop}
                palette={palette}
                onClose={handleCloseInfo}
                onClosed={handleInfoClosed}
                header={(
                    <View style={styles.sheetHead}>
                        <Pressable style={styles.sheetClose} onPress={handleCloseInfo} accessibilityLabel="收起命盘信息">
                            <ChevronIcon direction="down" color={palette.ink} size={22} />
                        </Pressable>
                        <View style={styles.sheetTitleRow}>
                            <Text style={styles.sheetTitle}>命盘信息</Text>
                        </View>
                        <View style={styles.sheetClose} />
                    </View>
                )}
            >
                <GestureScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }} showsVerticalScrollIndicator={false}>
                    <ZiweiInfoPanel
                        name={currentName}
                        gender={(staticChart?.input.gender || recordResult?.gender) === 'female' ? 'female' : 'male'}
                        chineseDate={chineseDate}
                        zodiac={zodiac}
                        sign={(staticChart?.astrolabe.sign as string | undefined) || ''}
                        fiveElements={fiveElements}
                        soul={soul}
                        body={body}
                        dateRows={infoDateRows}
                        palaceByIndex={palaceByIndex}
                        dynamic={dynamic}
                        cursorLabel={formatDot(formatLocalDateTime(cursorDate))}
                        configChips={infoConfigChips}
                        canEditConfig={Boolean(recordResult)}
                        palette={palette}
                        onOpenPalace={handleInfoOpenPalace}
                        onEditConfig={handleInfoEditConfig}
                    />
                </GestureScrollView>
            </ZiweiSheet>
            ) : null}

            {deleteVisible ? (
            <ConfirmModal
                visible={deleteVisible}
                title="删除记录"
                message="确定要删除此紫微命盘记录吗？删除后将无法恢复。"
                confirmText="删除"
                destructive={true}
                onConfirm={handleDelete}
                onCancel={() => setDeleteVisible(false)}
            />
            ) : null}

            {settingsVisible ? (
            <Modal visible={settingsVisible} transparent animationType="fade" onRequestClose={handleDismissSettings}>
                <View style={styles.modalWrap}>
                    <Pressable style={styles.modalBackdrop} onPress={handleDismissSettings} />
                    <View style={styles.configModalCard}>
                        <ZiweiConfigPanel
                            value={settingsDraftConfig || activePayload?.config || recordResult?.config || staticChart?.input.config || ZIWEI_DEFAULT_CONFIG}
                            onChange={setSettingsDraftConfig}
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
            ) : null}

            {recordResult && aiChatMounted && aiContext ? (
                <ZiweiAIChat
                    visible={aiChatVisible}
                    result={recordResult}
                    context={aiContext}
                    onClose={handleCloseAI}
                    onUpdate={handleUpdateAI}
                />
            ) : null}
        </View>
    );
}

function makeStyles(Colors: any, palette: ReturnType<typeof buildZiweiPalette>) {
    const base = { includeFontPadding: false } as const;
    return StyleSheet.create({
        container: { flex: 1, backgroundColor: palette.page },
        stage: { flex: 1 },
        boardWrap: { marginTop: ZIWEI_STAGE.boardTop, paddingHorizontal: ZIWEI_STAGE.sidePadding, alignItems: 'center' },
        axisWrap: { marginTop: ZIWEI_STAGE.axisTop, paddingHorizontal: ZIWEI_STAGE.sidePadding },
        loading: { height: 320, alignItems: 'center', justifyContent: 'center' },
        loadingText: { ...base, fontSize: 13, color: palette.muted },
        wideRow: { flex: 1, flexDirection: 'row' },
        sidePanel: { marginLeft: ZIWEI_STAGE.sidePadding, borderLeftWidth: 1, borderLeftColor: palette.hairline, backgroundColor: palette.card },
        sideHead: { flexDirection: 'row', alignItems: 'baseline', gap: 6, paddingHorizontal: 16, paddingTop: 14 },
        sideTitle: { ...base, fontSize: 18, lineHeight: 24, fontWeight: '700', color: palette.vermilion },
        sideGz: { ...base, fontSize: 15, lineHeight: 20, fontWeight: '600' },
        sideMeta: { ...base, fontSize: 12, lineHeight: 16, color: palette.muted, flexShrink: 1 },
        notice: {
            marginTop: Spacing.sm,
            marginHorizontal: Spacing.lg,
            borderRadius: BorderRadius.lg,
            borderWidth: 1,
            borderColor: palette.goldBorder,
            backgroundColor: palette.card,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.sm,
        },
        noticeWarning: { borderColor: Colors.accent.red },
        noticeStale: { borderColor: Colors.accent.jade },
        noticeText: { ...base, fontSize: FontSize.xs, lineHeight: 18, color: palette.muted },
        retryBtn: {
            marginTop: Spacing.sm,
            alignSelf: 'flex-start',
            minHeight: 36,
            paddingHorizontal: Spacing.md,
            borderRadius: BorderRadius.round,
            borderWidth: 1,
            borderColor: palette.gold,
            alignItems: 'center',
            justifyContent: 'center',
        },
        retryBtnText: { fontSize: FontSize.xs, color: palette.gold, fontWeight: '600' },
        sheetHead: { height: 52, flexDirection: 'row', alignItems: 'center', paddingLeft: 4, paddingRight: 8 },
        sheetClose: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
        sheetTitleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
        sheetNav: { flexDirection: 'row', alignItems: 'center', gap: 1, paddingHorizontal: 4, height: 44 },
        sheetNavText: { ...base, fontSize: 12, lineHeight: 16, color: palette.muted },
        sheetTitle: { ...base, fontSize: 19, lineHeight: 24, fontWeight: '700', color: palette.vermilion },
        sheetGz: { ...base, fontSize: 15, lineHeight: 20, fontWeight: '600' },
        contextStrip: {
            height: 38,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 16,
            borderBottomWidth: 1,
            borderBottomColor: palette.cardBorder,
        },
        contextChip: { paddingHorizontal: 5, borderRadius: 3, borderWidth: 1, borderColor: palette.goldBorder, backgroundColor: palette.goldSoft },
        contextChipText: { ...base, fontSize: 11, lineHeight: 16, fontWeight: '600', color: palette.gold },
        contextMain: { ...base, fontSize: 13, lineHeight: 18, fontWeight: '600', color: palette.ink, fontVariant: ['tabular-nums'] },
        contextMeta: { ...base, fontSize: 12, lineHeight: 18, color: palette.muted, flexShrink: 1 },
        contextAI: { ...base, fontSize: 12, lineHeight: 18, fontWeight: '600', color: palette.gold },
        modalWrap: { flex: 1, backgroundColor: Colors.bg.overlay },
        modalBackdrop: { ...StyleSheet.absoluteFill },
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
        configModalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm },
        configActionBtn: { minHeight: 44, borderRadius: BorderRadius.round, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.lg },
        configActionPrimary: { backgroundColor: Colors.accent.gold },
        configActionSecondary: { backgroundColor: Colors.bg.elevated, borderWidth: 1, borderColor: Colors.border.subtle },
        configActionDisabled: { opacity: 0.6 },
        configActionText: { fontSize: FontSize.sm, fontWeight: '600' },
        configActionPrimaryText: { color: Colors.text.inverse },
        configActionSecondaryText: { color: Colors.text.primary },
        configErrorText: { fontSize: FontSize.xs, lineHeight: 18, color: Colors.accent.red },
        errorHeader: { height: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 },
        errorBack: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
        errorWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl },
        errorTitle: { fontSize: FontSize.xl, color: Colors.text.heading, fontWeight: '700' },
        errorText: { marginTop: Spacing.md, fontSize: FontSize.sm, color: Colors.text.secondary, lineHeight: 22, textAlign: 'center' },
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
        errorActionText: { color: Colors.text.inverse, fontSize: FontSize.md, fontWeight: '700' },
    });
}
