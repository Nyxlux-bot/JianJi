import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    LayoutChangeEvent,
    NativeScrollEvent,
    NativeSyntheticEvent,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
    BackIcon,
    ChevronRightIcon,
    EyeIcon,
    EyeOffIcon,
    MoreVerticalIcon,
    SparkleIcon,
} from '../../../src/components/Icons';
import AIChatModal from '../../../src/components/AIChatModal';
import ConfirmModal from '../../../src/components/ConfirmModal';
import { CustomAlert } from '../../../src/components/CustomAlertProvider';
import OverflowMenu, { OverflowMenuItem } from '../../../src/components/OverflowMenu';
import StatusBarDecor from '../../../src/components/StatusBarDecor';
import WuXingIcon from '../../../src/components/WuXingIcon';
import ZodiacPaperCut from '../../../src/components/ZodiacPaperCut';
import { useTheme } from '../../../src/theme/ThemeContext';
import { BorderRadius, FontSize, Spacing } from '../../../src/theme/colors';
import { buildResultPalette as buildPalette, type ResultPalette } from '../../../src/theme/result-palette';
import {
    BaziAnalysisProfile,
    BaziPillarMatrixRow,
    BaziResult,
} from '../../../src/core/bazi-types';
import { getBaziChartTimeLabel, getBaziTimeModeLabel } from '../../../src/core/bazi-time';
import {
    buildBaziWuXingEnergy,
    type BaziWuXingEnergySnapshot,
} from '../../../src/core/bazi-wuxing-energy';
import { normalizeBaziResultV2 } from '../../../src/core/bazi-normalize';
import { deleteRecord, getAllRecords, getRecord, toggleFavorite } from '../../../src/db/database';
import {
    BaziPanelMode,
    BaziSectionKey,
    DenseTrackCellView,
    FortuneSelectionView,
    ProChartColumnView,
    ProShenShaRowView,
    QiYunBandItemView,
} from '../../../src/features/bazi/types';
import {
    buildBaziProChartViewModel,
    getInitialFortuneSelection,
} from '../../../src/features/bazi/view-model';
import {
    clearPendingBaziRecord,
    getPendingBaziRecord,
    retryPendingBaziPersist,
    subscribePendingBaziRecord,
} from '../../../src/features/bazi/pending-result-cache';
import { useGanZhiRelationSettings } from '../../../src/features/bazi/ganzhi-relation-settings';
import {
    getGanZhiElement,
    resolveWuXingElement,
    WUXING_ORDER,
    WuXingElement,
} from '../../../src/features/bazi/wuxing';
import { shareBaziResultMarkdown } from '../../../src/services/share';
import { isAIConfigured } from '../../../src/services/settings';
import { clearAIAnalysisJob } from '../../../src/services/ai-analysis-jobs';

type EnergyMetric = 'energy' | 'direct' | 'hidden';
type Styles = ReturnType<typeof makeStyles>;

/* ------------------------------------------------------------------ */
/* 配色：页面专用的语义色，阴阳两套                                       */
/* ------------------------------------------------------------------ */

type Palette = ResultPalette;

function elementColor(text: string, palette: Palette, fallback?: string): string {
    const element = resolveWuXingElement(text);
    return element ? palette.element[element] : (fallback ?? palette.ink);
}

function ganZhiCharColor(char: string, palette: Palette, fallback?: string): string {
    const element = getGanZhiElement(char);
    return element ? palette.element[element] : (fallback ?? palette.ink);
}

/* ------------------------------------------------------------------ */
/* 文本工具                                                             */
/* ------------------------------------------------------------------ */

function ziHourModeLabel(mode: 'late_zi_next_day' | 'early_zi_same_day'): string {
    return mode === 'early_zi_same_day' ? '早子时当日' : '晚子时次日';
}

function timeModeLabel(mode: 'clock_time' | 'mean_solar_time' | 'true_solar_time'): string {
    return getBaziTimeModeLabel(mode);
}

function maskVisibleText(text: string): string {
    if (!text) {
        return '***';
    }
    return '*'.repeat(Math.max(3, text.length));
}

function getCurrentItemIndex<T extends { isCurrent: boolean }>(items: T[]): number {
    if (items.length === 0) {
        return 0;
    }
    const currentIndex = items.findIndex((item) => item.isCurrent);
    return currentIndex >= 0 ? currentIndex : 0;
}

interface ParsedDateTime {
    year: number;
    month: number;
    day: number;
    time: string;
}

function parseDateTime(value: string): ParsedDateTime | null {
    const match = value.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/);
    if (!match) {
        return null;
    }
    return {
        year: Number(match[1]),
        month: Number(match[2]),
        day: Number(match[3]),
        time: match[4] ? `${match[4].padStart(2, '0')}:${match[5]}` : '',
    };
}

/** 1990-05-06 02:35:26 → 5月6日 02:35 */
function formatMonthDayTime(value: string): string {
    const parsed = parseDateTime(value);
    if (!parsed) {
        return value;
    }
    return `${parsed.month}月${parsed.day}日${parsed.time ? ` ${parsed.time}` : ''}`;
}

/** 1997-01-08 14:17 → { date: 1997年1月8日, time: 14:17 } */
function splitFullDate(value: string): { date: string; time: string } {
    const parsed = parseDateTime(value);
    if (!parsed) {
        return { date: value, time: '' };
    }
    return { date: `${parsed.year}年${parsed.month}月${parsed.day}日`, time: parsed.time };
}

/** 11天5小时43分钟 → 11天5时43分 */
function compactDuration(value: string): string {
    return value.replace(/小时/g, '时').replace(/分钟/g, '分');
}

/** 1990年四月廿三辰时 → 1990年 四月廿三 辰时 */
function spaceLunarDisplay(value: string): string {
    const match = value.match(/^(.*?年)(.*?)([子丑寅卯辰巳午未申酉戌亥]时)$/);
    return match ? `${match[1]} ${match[2]} ${match[3]}` : value;
}

/** 壬申（剑锋金）→ [壬申, 剑锋金]；角宿东方青龙 → [角宿, 东方青龙] */
function splitParamValue(value: string): { main: string; sub: string } {
    const paren = value.match(/^(.+?)[（(](.+?)[）)]$/);
    if (paren) {
        return { main: paren[1], sub: paren[2] };
    }
    const xiu = value.match(/^(.宿)(.+)$/);
    if (xiu) {
        return { main: xiu[1], sub: xiu[2] };
    }
    return { main: value, sub: '' };
}

function splitStarText(value: string): string[] {
    return value
        .split(/、|，|,/)
        .map((item) => item.trim())
        .filter((item) => item && item !== '无' && item !== '—');
}

function splitMatrixLines(value: string): string[] {
    const lines = value.split(/\n|\s+/).map((item) => item.trim()).filter(Boolean);
    return lines.length > 0 ? lines : ['—'];
}

function spacedDots(value: string): string {
    return value.split(/\s*·\s*/).filter(Boolean).join(' · ');
}

const SEASON_BAND_ORDER: Record<string, number> = { 木: 0, 火: 1, 土: 2, 金: 3, 水: 4 };

export default function BaziResultPage() {
    const { Colors } = useTheme();
    const { width } = useWindowDimensions();
    const palette = useMemo(() => buildPalette(Colors), [Colors]);
    const styles = useMemo(() => makeStyles(Colors, palette, width), [Colors, palette, width]);
    const isNarrow = width < 375;
    const { id } = useLocalSearchParams<{ id: string }>();
    const { settings: ganZhiRelationSettings } = useGanZhiRelationSettings();

    const [result, setResult] = useState<BaziResult | null>(null);
    const [isFavorite, setIsFavorite] = useState(false);
    const [aiConfigured, setAiConfigured] = useState(false);
    const [aiChatVisible, setAiChatVisible] = useState(false);
    const [menuVisible, setMenuVisible] = useState(false);
    const [deleteVisible, setDeleteVisible] = useState(false);
    const [activeSection, setActiveSection] = useState<BaziSectionKey>('overview');
    const [privacyEnabled, setPrivacyEnabled] = useState(false);
    const [panelMode, setPanelMode] = useState<BaziPanelMode>('fortune');
    const [energyMetric, setEnergyMetric] = useState<EnergyMetric>('energy');
    const [persistStatus, setPersistStatus] = useState<'saving' | 'saved' | 'error' | null>(null);
    const [persistError, setPersistError] = useState('');
    const [screenState, setScreenState] = useState<'loading' | 'ready' | 'missing'>('loading');
    const [fortuneSelection, setFortuneSelection] = useState<FortuneSelectionView>({
        mode: 'dayun',
        selectedDaYunIndex: 0,
        selectedXiaoYunIndex: 0,
        selectedLiuNianIndex: 0,
        selectedLiuYueIndex: 0,
    });
    const isPersisting = persistStatus === 'saving';
    const hasPersistedRecord = persistStatus === null || persistStatus === 'saved';

    useEffect(() => {
        let cancelled = false;
        const loadFromStorage = async (clearSavedPending: boolean = false) => {
            if (!id) {
                return;
            }
            const [detail, summaries] = await Promise.all([getRecord(id), getAllRecords()]);
            if (cancelled) {
                return;
            }
            if (!detail) {
                if (!getPendingBaziRecord(id)) {
                    setResult(null);
                    setPersistStatus(null);
                    setPersistError('');
                    setScreenState('missing');
                }
                return;
            }
            if (detail.engineType !== 'bazi') {
                router.replace(detail.engineType === 'ziwei'
                    ? `/ziwei/result/${id}`
                    : detail.engineType === 'baziCompatibility'
                        ? `/bazi/match/result/${id}`
                        : `/result/${id}`);
                return;
            }
            const normalized = normalizeBaziResultV2(detail.result);
            setResult(normalized);
            setFortuneSelection(getInitialFortuneSelection(normalized));
            setIsFavorite(Boolean(summaries.find((item) => item.id === id)?.isFavorite));
            setPersistStatus(null);
            setPersistError('');
            setScreenState('ready');
            if (clearSavedPending && getPendingBaziRecord(id)?.status === 'saved') {
                clearPendingBaziRecord(id);
            }
        };

        if (id) {
            const pending = getPendingBaziRecord(id);
            if (pending && pending.status !== 'saved') {
                const normalized = normalizeBaziResultV2(pending.result);
                setResult(normalized);
                setFortuneSelection(getInitialFortuneSelection(normalized));
                setIsFavorite(pending.isFavorite);
                setPersistStatus(pending.status);
                setPersistError(pending.errorMessage);
                setScreenState('ready');
            } else {
                setPersistStatus(null);
                setPersistError('');
                setScreenState('loading');
                void loadFromStorage(pending?.status === 'saved');
            }
        }

        const unsubscribe = id ? subscribePendingBaziRecord(id, () => {
            if (cancelled || !id) {
                return;
            }
            const pending = getPendingBaziRecord(id);
            if (!pending) {
                return;
            }
            if (pending.status === 'saved') {
                void loadFromStorage(true);
                return;
            }
            setPersistStatus(pending.status);
            setPersistError(pending.errorMessage);
            setIsFavorite(pending.isFavorite);
            setScreenState('ready');
            const normalized = normalizeBaziResultV2(pending.result);
            setResult(normalized);
            setFortuneSelection((prev) => (
                prev.selectedDaYunIndex === 0
                    && prev.selectedLiuNianIndex === 0
                    && prev.selectedLiuYueIndex === 0
                    && prev.selectedXiaoYunIndex === 0
                    ? getInitialFortuneSelection(normalized)
                    : prev
            ));
        }) : () => undefined;

        return () => {
            cancelled = true;
            unsubscribe();
        };
    }, [id]);

    useFocusEffect(useCallback(() => {
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
    }, []));

    const proChartView = useMemo(() => (
        result ? buildBaziProChartViewModel(result, fortuneSelection, ganZhiRelationSettings) : null
    ), [fortuneSelection, ganZhiRelationSettings, result]);
    const overviewOriginRows = useMemo(() => (
        result && proChartView ? buildOverviewOriginRows(result, proChartView.fortuneColumns) : []
    ), [proChartView, result]);
    const energyState = useMemo<{ snapshot: BaziWuXingEnergySnapshot | null; error: string }>(() => {
        if (!result) return { snapshot: null, error: '' };
        try {
            return { snapshot: buildBaziWuXingEnergy(result, fortuneSelection), error: '' };
        } catch (error) {
            return {
                snapshot: null,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }, [fortuneSelection, result]);
    const displayName = privacyEnabled ? maskVisibleText(result?.subject.name ?? '') : (result?.subject.name ?? '');
    const handleRetryPersist = () => {
        if (!id) {
            return;
        }
        retryPendingBaziPersist(id);
    };

    const handleOpenAIChat = () => {
        if (!result) {
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
        if (!id || isPersisting) {
            return;
        }
        router.push(`/bazi/input?editId=${id}`);
    };

    const handleOpenGanZhiVisual = () => {
        if (!id) {
            return;
        }
        router.push({
            pathname: '/bazi/ganzhi/[id]',
            params: {
                id,
                mode: fortuneSelection.mode,
                dayun: String(fortuneSelection.selectedDaYunIndex),
                xiaoyun: String(fortuneSelection.selectedXiaoYunIndex),
                liunian: String(fortuneSelection.selectedLiuNianIndex),
                liuyue: String(fortuneSelection.selectedLiuYueIndex),
            },
        });
    };

    const handleSelectDaYunCell = (cell: DenseTrackCellView) => {
        if (!result || !cell.selectable) {
            return;
        }
        if (cell.trackKind === 'xiaoyun') {
            const nextXiaoYun = result.xiaoYun[cell.sourceIndex];
            setFortuneSelection((prev) => ({
                ...prev,
                mode: 'xiaoyun',
                selectedXiaoYunIndex: cell.sourceIndex,
                selectedLiuNianIndex: cell.sourceIndex,
                selectedLiuYueIndex: getCurrentItemIndex(nextXiaoYun?.liuYue ?? []),
            }));
            return;
        }

        const nextDaYun = result.daYun[cell.sourceIndex];
        const nextLiuNianIndex = getCurrentItemIndex(nextDaYun?.liuNian ?? []);
        const nextLiuNian = nextDaYun?.liuNian[nextLiuNianIndex];
        setFortuneSelection((prev) => ({
            ...prev,
            mode: 'dayun',
            selectedDaYunIndex: cell.sourceIndex,
            selectedLiuNianIndex: nextLiuNianIndex,
            selectedLiuYueIndex: getCurrentItemIndex(nextLiuNian?.liuYue ?? []),
        }));
    };

    const handleSelectLiuNianCell = (cell: DenseTrackCellView) => {
        if (!result || !cell.selectable) {
            return;
        }
        if (cell.trackKind === 'xiaoyun') {
            const nextXiaoYun = result.xiaoYun[cell.sourceIndex];
            setFortuneSelection((prev) => ({
                ...prev,
                mode: 'xiaoyun',
                selectedXiaoYunIndex: cell.sourceIndex,
                selectedLiuNianIndex: cell.sourceIndex,
                selectedLiuYueIndex: getCurrentItemIndex(nextXiaoYun?.liuYue ?? []),
            }));
            return;
        }

        const selectedDaYun = result.daYun[Math.min(Math.max(fortuneSelection.selectedDaYunIndex, 0), result.daYun.length - 1)];
        const nextLiuNian = selectedDaYun?.liuNian[cell.sourceIndex];
        setFortuneSelection((prev) => ({
            ...prev,
            mode: 'dayun',
            selectedLiuNianIndex: cell.sourceIndex,
            selectedLiuYueIndex: getCurrentItemIndex(nextLiuNian?.liuYue ?? []),
        }));
    };

    const handleSelectLiuYueCell = (cell: DenseTrackCellView) => {
        if (!cell.selectable) {
            return;
        }
        setFortuneSelection((prev) => ({
            ...prev,
            selectedLiuYueIndex: cell.sourceIndex,
        }));
    };

    const handleToggleFavorite = async () => {
        if (!id || !hasPersistedRecord) return;
        await toggleFavorite(id);
        setIsFavorite((prev) => !prev);
    };

    const handleShare = async () => {
        if (!result) return;
        try {
            await shareBaziResultMarkdown(result, ganZhiRelationSettings);
        } catch (error: any) {
            const message = typeof error?.message === 'string' ? error.message : '导出失败，请稍后重试';
            CustomAlert.alert('导出失败', message);
        }
    };

    const handleDelete = async () => {
        if (!id || !hasPersistedRecord) return;
        setDeleteVisible(false);
        await clearAIAnalysisJob('bazi', id);
        await deleteRecord(id);
        router.back();
    };
    const menuItems: OverflowMenuItem[] = [
        { key: 'export', label: '导出八字', onPress: handleShare },
        { key: 'edit', label: '修改内容', onPress: handleEdit, disabled: isPersisting },
        { key: 'favorite', label: isFavorite ? '取消收藏' : '收藏结果', onPress: handleToggleFavorite, disabled: !hasPersistedRecord },
        { key: 'delete', label: '删除记录', onPress: () => setDeleteVisible(true), destructive: true, disabled: !hasPersistedRecord },
    ];
    const hasEnabledMenuItems = menuItems.some((item) => !item.disabled);

    const [headerScrolled, setHeaderScrolled] = useState(false);
    const headerScrolledRef = useRef(false);
    const handleContentScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const next = event.nativeEvent.contentOffset.y > 2;
        if (next !== headerScrolledRef.current) {
            headerScrolledRef.current = next;
            setHeaderScrolled(next);
        }
    }, []);

    if (screenState === 'loading') {
        return (
            <View style={styles.container}>
                <StatusBarDecor />
                <View style={styles.loading}>
                    <Text style={styles.loadingText}>加载中...</Text>
                </View>
            </View>
        );
    }

    if (screenState === 'missing' || !result) {
        return (
            <View style={styles.container}>
                <StatusBarDecor />
                <View style={styles.loading}>
                    <View style={styles.missingCard}>
                        <Text style={styles.missingTitle}>记录不存在或已被删除</Text>
                        <Text style={styles.missingBody}>当前八字结果已无法读取，可以返回上一页或前往历史记录查看其他卷宗。</Text>
                        <View style={styles.missingActions}>
                            <Pressable style={({ pressed }) => [styles.missingBtn, styles.missingBtnSecondary, pressed && styles.pressed]} onPress={() => router.back()}>
                                <Text style={[styles.missingBtnText, styles.missingBtnSecondaryText]}>返回上一页</Text>
                            </Pressable>
                            <Pressable style={({ pressed }) => [styles.missingBtn, styles.missingBtnPrimary, pressed && styles.pressed]} onPress={() => router.replace('/history')}>
                                <Text style={[styles.missingBtnText, styles.missingBtnPrimaryText]}>去历史记录</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </View>
        );
    }

    const heroRows = buildHeroRows(result, privacyEnabled);
    const aiDisabled = !aiConfigured || !result;

    return (
        <View style={styles.container}>
            <StatusBarDecor backgroundColor={palette.card} />
            <View style={styles.shell}>
                <View style={[styles.topBar, headerScrolled && styles.topBarScrolled]}>
                    <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.topBarIconBtn, styles.topBarBackBtn, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="返回">
                        <BackIcon size={22} color={palette.ink} />
                    </Pressable>

                    <View style={styles.topTabs} accessibilityRole="tablist">
                        <SectionTab label="命盘概览" active={activeSection === 'overview'} onPress={() => setActiveSection('overview')} styles={styles} />
                        <SectionTab label="专业细盘" active={activeSection === 'proChart'} onPress={() => setActiveSection('proChart')} styles={styles} />
                    </View>

                    <View style={styles.topBarSpacer} />

                    <Pressable
                        onPress={handleOpenAIChat}
                        style={({ pressed }) => [styles.aiChip, aiDisabled && styles.aiChipDisabled, pressed && styles.pressed]}
                        disabled={aiDisabled}
                        accessibilityRole="button"
                        accessibilityLabel="AI 解盘"
                        hitSlop={{ top: 8, bottom: 8 }}
                    >
                        <SparkleIcon size={13} color={palette.gold} />
                        <Text style={styles.aiChipText}>{isNarrow ? 'AI' : 'AI 解盘'}</Text>
                    </Pressable>

                    <Pressable
                        onPress={() => setPrivacyEnabled((prev) => !prev)}
                        style={({ pressed }) => [styles.topBarIconBtn, pressed && styles.pressed]}
                        accessibilityRole="switch"
                        accessibilityState={{ checked: privacyEnabled }}
                        accessibilityLabel={privacyEnabled ? '关闭隐私模式' : '开启隐私模式'}
                    >
                        {privacyEnabled ? (
                            <View style={styles.privacyOnBadge}>
                                <EyeOffIcon size={20} color={palette.gold} />
                            </View>
                        ) : (
                            <EyeIcon size={20} color={palette.icon} />
                        )}
                    </Pressable>
                    <Pressable
                        onPress={() => setMenuVisible((prev) => !prev)}
                        style={({ pressed }) => [styles.topBarIconBtn, !hasEnabledMenuItems && styles.topBarIconBtnDisabled, pressed && styles.pressed]}
                        disabled={!hasEnabledMenuItems}
                        accessibilityRole="button"
                        accessibilityLabel="更多操作"
                    >
                        <MoreVerticalIcon size={20} color={palette.icon} />
                    </Pressable>
                </View>

                <OverflowMenu
                    visible={menuVisible}
                    top={54}
                    right={Spacing.lg}
                    items={menuItems}
                    onClose={() => setMenuVisible(false)}
                />

                {persistStatus === 'error' ? (
                    <PersistBanner
                        message={`保存失败：${persistError || '点击重试'}`}
                        onPress={handleRetryPersist}
                        styles={styles}
                    />
                ) : null}

                <ScrollView
                    style={styles.content}
                    contentContainerStyle={styles.contentContainer}
                    showsVerticalScrollIndicator={false}
                    nestedScrollEnabled
                    onScroll={handleContentScroll}
                    scrollEventThrottle={32}
                >
                    <View style={styles.pageSurface}>
                        <ResultHero
                            name={displayName || '未命名'}
                            mingZao={result.subject.mingZaoLabel}
                            yinYangGender={`${result.subject.yinYangLabel}${result.subject.genderLabel}`}
                            zodiac={result.baseInfo.zodiac}
                            rows={heroRows}
                            accessory={activeSection === 'proChart' ? (
                                <PanelModeSwitch
                                    panelMode={panelMode}
                                    onChange={setPanelMode}
                                    styles={styles}
                                />
                            ) : null}
                            styles={styles}
                        />

                        {activeSection === 'overview' ? (
                            <>
                                <SiZhuCard rows={overviewOriginRows} palette={palette} styles={styles} />
                                {result.analysisProfile ? (
                                    <MingJuCard profile={result.analysisProfile} palette={palette} styles={styles} />
                                ) : null}
                                <WuXingCard
                                    energy={energyState.snapshot}
                                    error={energyState.error}
                                    metric={energyMetric}
                                    onMetricChange={setEnergyMetric}
                                    palette={palette}
                                    styles={styles}
                                />
                                <JieQiCard result={result} privacyEnabled={privacyEnabled} palette={palette} styles={styles} />
                                <ParamsCard result={result} styles={styles} />
                                <QiYunCard result={result} privacyEnabled={privacyEnabled} styles={styles} />
                            </>
                        ) : proChartView ? (
                            <>
                                <PaiPanCard
                                    panelMode={panelMode}
                                    summary={buildPaiPanSummary(proChartView)}
                                    columns={panelMode === 'fortune' ? proChartView.fortuneColumns : proChartView.taimingColumns}
                                    liuNianTrack={proChartView.liuNianTrack}
                                    daYunTrack={proChartView.daYunTrack}
                                    qiYunBand={proChartView.infoStrip.qiYunBand}
                                    palette={palette}
                                    styles={styles}
                                />
                                <YunChengCard
                                    result={result}
                                    privacyEnabled={privacyEnabled}
                                    daYunTrack={proChartView.daYunTrack}
                                    liuNianTrack={proChartView.liuNianTrack}
                                    liuYueTrack={proChartView.liuYueTrack}
                                    onSelectDaYun={handleSelectDaYunCell}
                                    onSelectLiuNian={handleSelectLiuNianCell}
                                    onSelectLiuYue={handleSelectLiuYueCell}
                                    palette={palette}
                                    styles={styles}
                                />
                                <ShenShaCard rows={proChartView.shenShaRows} palette={palette} styles={styles} />
                                <GanZhiLayerCard
                                    layer={proChartView.ganZhiLayer}
                                    onOpenDetail={handleOpenGanZhiVisual}
                                    palette={palette}
                                    styles={styles}
                                />
                            </>
                        ) : null}
                    </View>
                </ScrollView>
            </View>

            <ConfirmModal
                visible={deleteVisible}
                title="删除记录"
                message="确定要删除此八字排盘记录吗？删除后将无法恢复。"
                confirmText="删除"
                destructive={true}
                onConfirm={handleDelete}
                onCancel={() => setDeleteVisible(false)}
            />

            <AIChatModal
                visible={aiChatVisible}
                onClose={() => setAiChatVisible(false)}
                result={result}
                baziContext={{
                    panelMode,
                    fortuneSelection,
                    wuXingEnergy: energyState.snapshot ?? undefined,
                    ganZhiRelationSettings,
                }}
                onUpdateResult={(updatedResult) => {
                    setResult(normalizeBaziResultV2(updatedResult as BaziResult));
                }}
            />
        </View>
    );
}

/* ------------------------------------------------------------------ */
/* 数据整理                                                             */
/* ------------------------------------------------------------------ */

function getPillarMatrixValues(rows: BaziPillarMatrixRow[], key: BaziPillarMatrixRow['key']): string[] {
    const values = rows.find((row) => row.key === key)?.values;
    return Array.from({ length: 4 }, (_, index) => values?.[index] ?? '');
}

function toPillarTuple(values: string[]): BaziPillarMatrixRow['values'] {
    return [values[0] ?? '', values[1] ?? '', values[2] ?? '', values[3] ?? ''];
}

function buildOverviewOriginRows(
    result: BaziResult,
    columns: ProChartColumnView[],
): BaziPillarMatrixRow[] {
    const pillarColumns = (['year', 'month', 'day', 'hour'] as const).map((key) => (
        columns.find((column) => column.key === key)
    ));
    const genderLabel = result.subject.genderLabel === '男' ? '元男' : '元女';
    const generated: BaziPillarMatrixRow[] = [
        {
            key: 'mainStar',
            label: '主星',
            values: toPillarTuple(pillarColumns.map((column, index) => index === 2 ? genderLabel : column?.mainStarFull ?? '')),
        },
        {
            key: 'subStar',
            label: '副星',
            values: toPillarTuple(result.cangGan.map((group) => group.items.map((item) => item.shiShen).join('\n'))),
        },
        {
            key: 'tianGan',
            label: '天干',
            values: toPillarTuple(pillarColumns.map((column) => column?.tianGan ?? '')),
        },
        {
            key: 'diZhi',
            label: '地支',
            values: toPillarTuple(pillarColumns.map((column) => column?.diZhi ?? '')),
        },
        {
            key: 'cangGan',
            label: '藏干',
            values: toPillarTuple(result.cangGan.map((group) => group.items.map((item) => `${item.gan}${item.shiShen}`).join('\n'))),
        },
        {
            key: 'xingYun',
            label: '星运',
            values: toPillarTuple(pillarColumns.map((column) => column?.xingYun ?? '')),
        },
        {
            key: 'ziZuo',
            label: '自坐',
            values: toPillarTuple(pillarColumns.map((column) => column?.ziZuo ?? '')),
        },
        {
            key: 'kongWang',
            label: '空亡',
            values: toPillarTuple(pillarColumns.map((column) => column?.kongWang ?? '')),
        },
        {
            key: 'naYin',
            label: '纳音',
            values: toPillarTuple(pillarColumns.map((column) => column?.naYin ?? '')),
        },
        {
            key: 'shenSha',
            label: '神煞',
            values: toPillarTuple(pillarColumns.map((column) => column?.shenSha.join('\n') ?? '')),
        },
    ];

    return generated.map((row) => {
        const stored = result.pillarMatrix?.find((candidate) => candidate.key === row.key);
        if (!stored) return row;
        return {
            ...row,
            label: stored.label || row.label,
            values: toPillarTuple(row.values.map((value, index) => stored.values[index] || value)),
        };
    });
}

interface HeroRow {
    label: string;
    value: string;
}

function buildHeroRows(result: BaziResult, privacyEnabled: boolean): HeroRow[] {
    const meta = result.timeMeta;
    const solar = meta?.solarDate && meta?.solarTime ? `${meta.solarDate} ${meta.solarTime}` : result.baseInfo.solarDisplay;
    const lunar = spaceLunarDisplay(result.baseInfo.lunarDisplay);
    const solarParsed = parseDateTime(result.baseInfo.solarDisplay);
    const chartParsed = parseDateTime(result.baseInfo.trueSolarDisplay);
    let chartTime = result.baseInfo.trueSolarDisplay;
    if (chartParsed) {
        const sameDay = Boolean(solarParsed)
            && solarParsed?.year === chartParsed.year
            && solarParsed?.month === chartParsed.month
            && solarParsed?.day === chartParsed.day;
        chartTime = sameDay ? chartParsed.time : `${chartParsed.month}月${chartParsed.day}日 ${chartParsed.time}`;
    }
    const place = result.baseInfo.birthPlaceDisplay;
    const hasPlace = Boolean(place) && place !== '未设置出生地';
    const chartValue = [chartTime, hasPlace ? place : ''].filter(Boolean).join(' · ');
    const rows: HeroRow[] = [
        { label: '阳历', value: solar },
        { label: '农历', value: lunar },
        { label: getBaziChartTimeLabel(result.schoolOptionsResolved.timeMode), value: chartValue },
    ];
    return privacyEnabled ? rows.map((row) => ({ ...row, value: maskVisibleText(row.value) })) : rows;
}

function buildPaiPanSummary(view: ReturnType<typeof buildBaziProChartViewModel>): string {
    const liuNian = view.fortuneColumns.find((column) => column.key === 'liuNian');
    const yun = view.fortuneColumns.find((column) => column.key === 'daYun');
    const year = view.liuNianTrack.find((cell) => cell.active)?.topLabel ?? '';
    const parts: string[] = [];
    if (liuNian && liuNian.ganZhi !== '—') {
        parts.push([year, liuNian.ganZhi].filter(Boolean).join(' '));
    }
    if (yun && yun.ganZhi !== '—') {
        parts.push(`${yun.ganZhi}${yun.label === '小运' ? '小运' : '运'}`);
    }
    return parts.join(' · ');
}

/* ------------------------------------------------------------------ */
/* 顶部与头部                                                           */
/* ------------------------------------------------------------------ */

const SectionTab: React.FC<{ label: string; active: boolean; onPress: () => void; styles: Styles }> = ({ label, active, onPress, styles }) => (
    <Pressable
        style={({ pressed }) => [styles.topTab, pressed && styles.pressed]}
        onPress={onPress}
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
    >
        <Text style={[styles.topTabText, active && styles.topTabTextActive]}>{label}</Text>
        {active ? <View style={styles.topTabIndicator} /> : null}
    </Pressable>
);

const PANEL_MODES: Array<{ key: BaziPanelMode; label: string }> = [
    { key: 'fortune', label: '流年大运' },
    { key: 'taiming', label: '胎命身' },
];

const PanelModeSwitch: React.FC<{
    panelMode: BaziPanelMode;
    onChange: (mode: BaziPanelMode) => void;
    styles: Styles;
}> = ({ panelMode, onChange, styles }) => (
    <View style={styles.heroSwitch} accessibilityRole="tablist">
        {PANEL_MODES.map((mode) => {
            const on = panelMode === mode.key;
            return (
                <Pressable
                    key={mode.key}
                    onPress={() => onChange(mode.key)}
                    style={[styles.heroSwitchBtn, on && styles.heroSwitchBtnOn]}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: on }}
                    hitSlop={{ top: 10, bottom: 10 }}
                >
                    <Text style={[styles.heroSwitchText, on && styles.heroSwitchTextOn]}>{mode.label}</Text>
                </Pressable>
            );
        })}
    </View>
);

const ResultHero: React.FC<{
    name: string;
    mingZao: string;
    yinYangGender: string;
    zodiac: string;
    rows: HeroRow[];
    accessory?: React.ReactNode;
    styles: Styles;
}> = ({ name, mingZao, yinYangGender, zodiac, rows, accessory, styles }) => (
    <View style={styles.hero}>
        <View style={styles.heroPaperCut}>
            <ZodiacPaperCut zodiac={zodiac} size={180} />
        </View>
        <View style={styles.heroNameRow}>
            <Text style={styles.heroName} numberOfLines={1}>{name}</Text>
            <View style={styles.heroSeal}>
                <Text style={styles.heroSealText}>{mingZao || '—'}</Text>
            </View>
            <View style={styles.heroChip}>
                <Text style={styles.heroChipText}>{yinYangGender}</Text>
            </View>
            {accessory}
        </View>
        <View style={styles.heroRows}>
            {rows.map((row) => (
                <View key={row.label} style={styles.heroRow}>
                    <Text style={styles.heroRowLabel}>{row.label}</Text>
                    <Text style={styles.heroRowValue} numberOfLines={1}>{row.value || '—'}</Text>
                </View>
            ))}
        </View>
    </View>
);

const PersistBanner: React.FC<{
    message: string;
    onPress: () => void;
    styles: Styles;
}> = ({ message, onPress, styles }) => (
    <Pressable style={({ pressed }) => [styles.persistBanner, pressed && styles.pressed]} onPress={onPress}>
        <Text style={styles.persistBannerText}>{message}</Text>
    </Pressable>
);

/* ------------------------------------------------------------------ */
/* 通用片段                                                             */
/* ------------------------------------------------------------------ */

const Card: React.FC<{
    title: string;
    right?: React.ReactNode;
    first?: boolean;
    dense?: boolean;
    accessibilityLabel?: string;
    children: React.ReactNode;
    styles: Styles;
}> = ({ title, right, first = false, dense = false, accessibilityLabel, children, styles }) => (
    <View style={[styles.card, first && styles.cardFirst, dense && styles.cardDense]} accessibilityLabel={accessibilityLabel}>
        <View style={styles.cardHeader}>
            <View style={styles.cardDiamond} />
            <Text style={styles.cardTitle} accessibilityRole="header">{title}</Text>
            {right}
        </View>
        {children}
    </View>
);

const GlyphWithIcon: React.FC<{
    char: string;
    textStyle: any;
    iconSize: number;
    palette: Palette;
    styles: Styles;
}> = ({ char, textStyle, iconSize, palette, styles }) => {
    const value = char || '—';
    const hasElement = Boolean(resolveWuXingElement(value));
    return (
        <View style={styles.glyphWrap}>
            {hasElement ? (
                <WuXingIcon
                    element={value}
                    size={iconSize}
                    style={[styles.glyphIcon, { left: -(iconSize + (iconSize > 12 ? 2 : 1)) }]}
                />
            ) : null}
            <Text style={[styles.glyphText, textStyle, { color: elementColor(value, palette, palette.muted) }]}>
                {value}
            </Text>
        </View>
    );
};

/** “丁正财”→ 丁（五行色、加粗）+ 正财（弱色） */
const StemLine: React.FC<{
    line: string;
    stemSize: number;
    noteSize: number;
    lineHeight: number;
    palette: Palette;
    styles: Styles;
}> = ({ line, stemSize, noteSize, lineHeight, palette, styles }) => {
    const first = line.charAt(0);
    const element = getGanZhiElement(first);
    if (!element) {
        return <Text style={[styles.stemNote, { fontSize: noteSize, lineHeight }]}>{line}</Text>;
    }
    return (
        <Text style={[styles.stemLine, { fontSize: stemSize, lineHeight }]}>
            <Text style={[styles.stemChar, { color: palette.element[element] }]}>{first}</Text>
            <Text style={[styles.stemNote, { fontSize: noteSize }]}>{` ${line.slice(1)}`}</Text>
        </Text>
    );
};

const ColoredGanZhi: React.FC<{ value: string; palette: Palette; style: any }> = ({ value, palette, style }) => (
    <Text style={style}>
        {value.split('').map((char, index) => (
            <Text key={`${char}-${index}`} style={{ color: ganZhiCharColor(char, palette, palette.ink) }}>{char}</Text>
        ))}
    </Text>
);

/* ------------------------------------------------------------------ */
/* 命盘概览                                                             */
/* ------------------------------------------------------------------ */

const PILLAR_LABELS = ['年柱', '月柱', '日柱', '时柱'];

const SiZhuCard: React.FC<{ rows: BaziPillarMatrixRow[]; palette: Palette; styles: Styles }> = ({ rows, palette, styles }) => {
    const mainStars = getPillarMatrixValues(rows, 'mainStar');
    const tianGan = getPillarMatrixValues(rows, 'tianGan');
    const diZhi = getPillarMatrixValues(rows, 'diZhi');
    const cangGan = getPillarMatrixValues(rows, 'cangGan');
    const shenSha = getPillarMatrixValues(rows, 'shenSha');
    const detailRows: Array<{ key: BaziPillarMatrixRow['key']; label: string }> = [
        { key: 'xingYun', label: '星运' },
        { key: 'ziZuo', label: '自坐' },
        { key: 'naYin', label: '纳音' },
        { key: 'kongWang', label: '空亡' },
    ];
    const knownKeys = new Set<string>([
        'mainStar', 'subStar', 'tianGan', 'diZhi', 'cangGan', 'shenSha',
        ...detailRows.map((row) => row.key),
    ]);
    const additionalRows = rows.filter((row) => !knownKeys.has(row.key));

    return (
        <Card title="四柱" first styles={styles}>
            <View style={styles.tableWrap}>
                <View style={[styles.tableOverlay, styles.siZhuOverlay]}>
                    {PILLAR_LABELS.map((label, index) => (
                        <View key={label} style={[styles.tableOverlayCol, index === 2 && styles.tableDayTint]} />
                    ))}
                </View>

                <View style={[styles.tableRow, styles.siZhuHeadRow]}>
                    <View style={styles.siZhuLabelCell} />
                    {PILLAR_LABELS.map((label, index) => (
                        <Text key={label} style={[styles.tableCellText, styles.tableHeadText, index === 2 && styles.tableHeadTextDay]}>{label}</Text>
                    ))}
                </View>
                <View style={[styles.tableRow, styles.siZhuStarRow]}>
                    <Text style={[styles.siZhuLabelCell, styles.tableRowLabel]}>十神</Text>
                    {mainStars.map((value, index) => (
                        <Text key={`star-${index}`} style={[styles.tableCellText, styles.siZhuStarText]} numberOfLines={1}>{value || '—'}</Text>
                    ))}
                </View>
                {[{ label: '天干', values: tianGan }, { label: '地支', values: diZhi }].map((row) => (
                    <View key={row.label} style={[styles.tableRow, styles.siZhuGlyphRow]}>
                        <Text style={[styles.siZhuLabelCell, styles.tableRowLabel]}>{row.label}</Text>
                        {row.values.map((value, index) => (
                            <View key={`${row.label}-${index}`} style={styles.tableCell}>
                                <GlyphWithIcon char={value} textStyle={styles.siZhuGlyphText} iconSize={16} palette={palette} styles={styles} />
                            </View>
                        ))}
                    </View>
                ))}
                <View style={[styles.tableRow, styles.siZhuCangRow]}>
                    <Text style={[styles.siZhuLabelCell, styles.tableRowLabel]}>藏干</Text>
                    {cangGan.map((value, index) => (
                        <View key={`cang-${index}`} style={styles.tableCellStack}>
                            {splitMatrixLines(value).map((line, lineIndex) => (
                                <StemLine key={`${line}-${lineIndex}`} line={line} stemSize={13} noteSize={12} lineHeight={18} palette={palette} styles={styles} />
                            ))}
                        </View>
                    ))}
                </View>

                {detailRows.map((row, rowIndex) => {
                    const values = getPillarMatrixValues(rows, row.key);
                    return (
                        <View key={row.key} style={[styles.tableRow, styles.siZhuDetailRow, rowIndex === 0 && styles.siZhuDetailFirst]}>
                            <Text style={[styles.siZhuLabelCell, styles.tableRowLabel]}>{row.label}</Text>
                            {values.map((value, index) => (
                                <Text key={`${row.key}-${index}`} style={[styles.tableCellText, styles.siZhuDetailText]} numberOfLines={1}>{value || '—'}</Text>
                            ))}
                        </View>
                    );
                })}
                <View style={[styles.tableRow, styles.siZhuStackRow]}>
                    <Text style={[styles.siZhuLabelCell, styles.tableRowLabel]}>神煞</Text>
                    {shenSha.map((value, index) => (
                        <View key={`sha-${index}`} style={styles.tableCellStack}>
                            {splitMatrixLines(value).map((line, lineIndex) => (
                                <Text key={`${line}-${lineIndex}`} style={styles.siZhuShenShaText}>{line}</Text>
                            ))}
                        </View>
                    ))}
                </View>
                {additionalRows.map((row) => (
                    <View key={row.key} style={[styles.tableRow, styles.siZhuStackRow]}>
                        <Text style={[styles.siZhuLabelCell, styles.tableRowLabel]}>{row.label}</Text>
                        {getPillarMatrixValues(rows, row.key).map((value, index) => (
                            <View key={`${row.key}-${index}`} style={styles.tableCellStack}>
                                {splitMatrixLines(value).map((line, lineIndex) => (
                                    <Text key={`${line}-${lineIndex}`} style={styles.siZhuShenShaText}>{line}</Text>
                                ))}
                            </View>
                        ))}
                    </View>
                ))}
            </View>
        </Card>
    );
};

const SchoolLines: React.FC<{ shu: string; mang: string; styles: Styles }> = ({ shu, mang, styles }) => (
    <View style={styles.schoolLines}>
        {[{ tag: '书', value: shu }, { tag: '盲', value: mang }].map((line) => (
            <View key={line.tag} style={styles.schoolLine}>
                <View style={styles.schoolTag}>
                    <Text style={styles.schoolTagText}>{line.tag}</Text>
                </View>
                <Text style={styles.schoolLineText}>{line.value ? spacedDots(line.value) : '—'}</Text>
            </View>
        ))}
    </View>
);

const MingJuCard: React.FC<{ profile: BaziAnalysisProfile; palette: Palette; styles: Styles }> = ({ profile, palette, styles }) => {
    const dayMasterColor = elementColor(profile.dayMasterElement || profile.dayMasterProperty, palette);
    return (
        <Card title="命局参考" accessibilityLabel="书房派与盲派命盘参考" styles={styles}>
            <View style={styles.pairGrid}>
                <View style={styles.pairRow}>
                    <View style={styles.pairItem}>
                        <Text style={styles.fieldLabel}>日主</Text>
                        <View style={styles.inlineIconValue}>
                            <WuXingIcon element={profile.dayMasterElement || profile.dayMasterProperty} size={16} />
                            <Text style={[styles.fieldValueStrong, { color: dayMasterColor }]}>{profile.dayMasterProperty || '—'}</Text>
                        </View>
                    </View>
                    <View style={styles.pairItem}>
                        <Text style={styles.fieldLabel}>阴阳</Text>
                        <Text style={styles.fieldValueStrong}>{profile.yinYangReference || '—'}</Text>
                    </View>
                </View>
                <View style={styles.pairRow}>
                    <View style={styles.pairItem}>
                        <Text style={styles.fieldLabel}>旺衰</Text>
                        <SchoolLines shu={profile.shufang?.strength ?? ''} mang={profile.mangpai?.strength ?? ''} styles={styles} />
                    </View>
                    <View style={styles.pairItem}>
                        <Text style={styles.fieldLabel}>格局</Text>
                        <SchoolLines shu={profile.shufang?.structure ?? ''} mang={profile.mangpai?.structure ?? ''} styles={styles} />
                    </View>
                </View>
            </View>
        </Card>
    );
};

const ENERGY_TABS: Array<{ key: EnergyMetric; label: string }> = [
    { key: 'energy', label: '能量' },
    { key: 'direct', label: '个数' },
    { key: 'hidden', label: '含藏干' },
];

const Segmented = <T extends string>({ items, value, onChange, styles }: {
    items: Array<{ key: T; label: string }>;
    value: T;
    onChange: (next: T) => void;
    styles: Styles;
}) => (
    <View style={styles.segmented} accessibilityRole="tablist">
        {items.map((item) => {
            const on = item.key === value;
            return (
                <Pressable
                    key={item.key}
                    onPress={() => onChange(item.key)}
                    style={[styles.segmentedBtn, on && styles.segmentedBtnOn]}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: on }}
                    hitSlop={{ top: 8, bottom: 8 }}
                >
                    <Text style={[styles.segmentedText, on && styles.segmentedTextOn]}>{item.label}</Text>
                </Pressable>
            );
        })}
    </View>
);

const WuXingCard: React.FC<{
    energy: BaziWuXingEnergySnapshot | null;
    error: string;
    metric: EnergyMetric;
    onMetricChange: (metric: EnergyMetric) => void;
    palette: Palette;
    styles: Styles;
}> = ({ energy, error, metric, onMetricChange, palette, styles }) => {
    const valueOf = (item: BaziWuXingEnergySnapshot['elements'][number]): number => (
        metric === 'energy' ? item.percentage : metric === 'direct' ? item.directCount : item.withHiddenCount
    );
    const total = !energy
        ? 1
        : metric === 'energy'
            ? 100
            : Math.max(1, energy.elements.reduce((sum, item) => sum + valueOf(item), 0));

    return (
        <Card
            title="五行"
            right={<Segmented items={ENERGY_TABS} value={metric} onChange={onMetricChange} styles={styles} />}
            styles={styles}
        >
            {!energy ? (
                <View style={styles.energyError}>
                    <Text style={styles.energyErrorTitle}>五行综合能量计算失败</Text>
                    <Text style={styles.energyErrorText}>{error || '命盘数据不完整'}</Text>
                </View>
            ) : (
                <>
                    <View style={styles.energyList}>
                        {energy.elements.map((item) => {
                            const value = valueOf(item);
                            const color = elementColor(item.element, palette);
                            const width = value > 0 ? Math.max((value / total) * 100, 3) : 0;
                            return (
                                <View key={item.element} style={styles.energyRow}>
                                    <View style={styles.energyLabel}>
                                        <WuXingIcon element={item.element} size={16} />
                                        <Text style={[styles.energyElement, { color }]}>{item.element}</Text>
                                    </View>
                                    <View style={styles.energyTrack}>
                                        <View style={[styles.energyFill, { width: `${width}%`, backgroundColor: color }]} />
                                    </View>
                                    <Text style={styles.energyValue}>{value}{metric === 'energy' ? '%' : '个'}</Text>
                                    <Text style={styles.energyMeta} numberOfLines={1}>{item.seasonStatus} · {item.tenGodGroup}</Text>
                                </View>
                            );
                        })}
                    </View>
                    <View style={styles.partyBlock}>
                        <View style={styles.partyRow}>
                            <Text style={styles.partyLabel}>
                                同党 <Text style={styles.partyValue}>{energy.samePartyPercentage}%</Text>
                            </Text>
                            <View style={styles.partyBar}>
                                <View style={[styles.partySame, { width: `${energy.samePartyPercentage}%` }]} />
                                <View style={styles.partyDiff} />
                            </View>
                            <Text style={styles.partyLabel}>
                                <Text style={styles.partyValue}>{energy.differentPartyPercentage}%</Text> 异党
                            </Text>
                        </View>
                        <View style={styles.partyLegend}>
                            <Text style={styles.noteText}>印绶 + 比劫</Text>
                            <Text style={styles.noteText}>财才 + 官杀 + 食伤</Text>
                        </View>
                    </View>
                    <Text style={[styles.noteText, styles.energyScopeNote]}>
                        能量综合干支、藏干、宫位、岁运、刑冲合害与神煞活跃度
                        {energy.omittedSources.length > 0 ? `\n未计入缺失来源：${energy.omittedSources.join('、')}` : ''}
                    </Text>
                </>
            )}
        </Card>
    );
};

const JieQiCard: React.FC<{ result: BaziResult; privacyEnabled: boolean; palette: Palette; styles: Styles }> = ({ result, privacyEnabled, palette, styles }) => {
    const ctx = result.jieQiContext;
    const show = (value: string) => (privacyEnabled ? maskVisibleText(value) : value);
    const nodes = [
        { key: 'term', name: ctx.currentTerm.name, date: show(formatMonthDayTime(ctx.currentTerm.dateTime)) },
        { key: 'birth', name: '出生', date: show(formatMonthDayTime(result.baseInfo.trueSolarDisplay)) },
        { key: 'next', name: ctx.nextTerm.name, date: show(formatMonthDayTime(ctx.nextTerm.dateTime)) },
    ];
    const duty = result.baseInfo.renYuanDutyDetail;
    const dutyName = duty?.stem ? `${duty.stem}${duty.element}` : result.baseInfo.renYuanDuty;
    return (
        <Card title="节气" styles={styles}>
            <View style={styles.timeline}>
                <Text style={[styles.timelineSpan, styles.timelineSpanLeft]} numberOfLines={1}>{compactDuration(ctx.afterPrev)}</Text>
                <Text style={[styles.timelineSpan, styles.timelineSpanRight]} numberOfLines={1}>{compactDuration(ctx.beforeNext)}</Text>
                <View style={styles.timelineLinePast} />
                <View style={styles.timelineLineFuture} />
                {nodes.map((node, index) => (
                    <View key={node.key} style={[styles.timelineNode, { left: `${(index * 100) / 3}%` }]}>
                        {node.key === 'birth' ? (
                            <View style={styles.timelineBirthDot} />
                        ) : (
                            <View style={[styles.timelineDiamond, node.key === 'next' && styles.timelineDiamondHollow]} />
                        )}
                        <Text
                            style={[
                                styles.timelineName,
                                node.key === 'birth' && styles.timelineNameBirth,
                                node.key === 'next' && styles.timelineNameNext,
                            ]}
                        >
                            {node.name}
                        </Text>
                        <Text style={styles.timelineDate} numberOfLines={1}>{node.date}</Text>
                    </View>
                ))}
            </View>
            <View style={styles.cardFooterRow}>
                <Text style={styles.footerLabel}>人元司令</Text>
                {privacyEnabled ? (
                    <Text style={styles.footerBody}>{maskVisibleText(duty?.display || result.baseInfo.renYuanDuty)}</Text>
                ) : (
                    <>
                        <View style={styles.inlineIconValue}>
                            <WuXingIcon element={duty?.element || dutyName} size={16} />
                            <Text style={[styles.footerStrong, { color: elementColor(duty?.element || dutyName, palette) }]}>{dutyName || '—'}</Text>
                        </View>
                        {duty?.dayIndex ? <Text style={styles.footerBody}>第 {duty.dayIndex} 天用事</Text> : null}
                    </>
                )}
            </View>
        </Card>
    );
};

const ParamsCard: React.FC<{ result: BaziResult; styles: Styles }> = ({ result, styles }) => {
    const info = result.baseInfo;
    const kongWangParts = info.kongWang.trim().split(/\s+/).filter(Boolean);
    const items: Array<{ label: string; node: React.ReactNode }> = [
        { label: '星座', value: info.constellation },
        { label: '星宿', value: info.xingXiu },
        { label: '胎元', value: info.taiYuan },
        { label: '胎息', value: info.taiXi },
        { label: '命宫', value: info.mingGong },
        { label: '身宫', value: info.shenGong },
        { label: '命卦', value: info.mingGua },
    ].map((item) => {
        const parts = splitParamValue(item.value || '—');
        return {
            label: item.label,
            node: (
                <>
                    <Text style={styles.paramMain} numberOfLines={1}>{parts.main}</Text>
                    {parts.sub ? <Text style={styles.paramSub} numberOfLines={1}>{parts.sub}</Text> : null}
                </>
            ),
        };
    });
    items.push({
        label: '空亡',
        node: kongWangParts.length === 2 ? (
            <>
                <Text style={styles.paramSub}>年</Text>
                <Text style={[styles.paramMain, styles.paramTight]}>{kongWangParts[0]}</Text>
                <Text style={styles.paramSub}>日</Text>
                <Text style={[styles.paramMain, styles.paramTight]}>{kongWangParts[1]}</Text>
            </>
        ) : (
            <Text style={styles.paramMain} numberOfLines={1}>{info.kongWang || '—'}</Text>
        ),
    });
    const pairs: Array<typeof items> = [];
    for (let index = 0; index < items.length; index += 2) {
        pairs.push(items.slice(index, index + 2));
    }
    return (
        <Card title="命理参数" styles={styles}>
            <View style={styles.paramGrid}>
                {pairs.map((pair, pairIndex) => (
                    <View key={pairIndex} style={styles.paramPair}>
                        {pair.map((item) => (
                            <View key={item.label} style={[styles.paramCell, pairIndex < pairs.length - 1 && styles.paramCellDivider]}>
                                <Text style={styles.paramLabel}>{item.label}</Text>
                                {item.node}
                            </View>
                        ))}
                    </View>
                ))}
            </View>
        </Card>
    );
};

const QiYunCard: React.FC<{ result: BaziResult; privacyEnabled: boolean; styles: Styles }> = ({ result, privacyEnabled, styles }) => {
    const limit = result.childLimit;
    const jiaoYun = splitFullDate(limit.jiaoYunDateTime);
    const school = result.schoolOptionsResolved;
    const chips = [
        timeModeLabel(school.timeMode),
        ziHourModeLabel(school.ziHourMode),
        `夏令时 ${school.daylightSaving ? '开' : '关'}`,
    ];
    return (
        <Card title="起运" styles={styles}>
            <View style={[styles.pairRow, styles.qiYunGrid]}>
                <View style={styles.pairItem}>
                    <Text style={styles.fieldLabel}>出生后起运</Text>
                    <Text style={styles.fieldValueStrong}>
                        {`${limit.years}年${limit.months}月${limit.days}天`}
                        <Text style={styles.fieldValueMinor}>{` ${limit.hours}时${limit.minutes}分`}</Text>
                    </Text>
                </View>
                <View style={styles.pairItem}>
                    <Text style={styles.fieldLabel}>交运时间</Text>
                    {privacyEnabled ? (
                        <Text style={styles.fieldValueStrong}>{maskVisibleText(limit.jiaoYunDateTime)}</Text>
                    ) : (
                        <Text style={styles.fieldValueStrong}>
                            {jiaoYun.date}
                            {jiaoYun.time ? <Text style={styles.fieldValueMinor}>{` ${jiaoYun.time}`}</Text> : null}
                        </Text>
                    )}
                </View>
            </View>
            {limit.jiaoYunRuleText ? <Text style={[styles.noteText, styles.qiYunRule]}>{limit.jiaoYunRuleText}</Text> : null}
            <View style={[styles.cardFooterRow, styles.chipRow]}>
                <Text style={styles.chipRowLabel}>口径</Text>
                {chips.map((chip) => (
                    <View key={chip} style={styles.outlineChip}>
                        <Text style={styles.outlineChipText}>{chip}</Text>
                    </View>
                ))}
            </View>
        </Card>
    );
};

/* ------------------------------------------------------------------ */
/* 专业细盘                                                             */
/* ------------------------------------------------------------------ */

const PaiPanCard: React.FC<{
    panelMode: BaziPanelMode;
    summary: string;
    columns: ProChartColumnView[];
    liuNianTrack: DenseTrackCellView[];
    daYunTrack: DenseTrackCellView[];
    qiYunBand: QiYunBandItemView[];
    palette: Palette;
    styles: Styles;
}> = ({ panelMode, summary, columns, liuNianTrack, daYunTrack, qiYunBand, palette, styles }) => {
    const groupSplit = panelMode === 'fortune' ? 2 : 3;
    const groups = panelMode === 'fortune'
        ? [{ label: '岁运', span: 2 }, { label: '原局', span: columns.length - 2 }]
        : [{ label: '胎命身', span: 3 }, { label: '原局', span: columns.length - 3 }];
    const dayIndex = columns.findIndex((column) => column.key === 'day');
    const dense = columns.length >= 7;
    const activeLiuNian = liuNianTrack.find((cell) => cell.active);
    const activeYun = daYunTrack.find((cell) => cell.active);
    const subLabelFor = (column: ProChartColumnView): string => {
        if (column.key === 'liuNian') return activeLiuNian?.topLabel ?? '';
        if (column.key === 'daYun') return (activeYun?.subLabel ?? '').replace('~', '–');
        return '';
    };
    const band = [...qiYunBand].sort((a, b) => (SEASON_BAND_ORDER[a.element] ?? 9) - (SEASON_BAND_ORDER[b.element] ?? 9));
    const detail: Array<{ key: string; label: string; pick: (column: ProChartColumnView) => string; small?: boolean }> = [
        { key: 'xingYun', label: '星运', pick: (column) => column.xingYun },
        { key: 'ziZuo', label: '自坐', pick: (column) => column.ziZuo },
        { key: 'kongWang', label: '空亡', pick: (column) => column.kongWang || '—' },
        { key: 'naYin', label: '纳音', pick: (column) => column.naYin, small: true },
    ];

    return (
        <Card
            title="排盘"
            first
            dense
            right={summary ? <Text style={styles.cardHeaderMeta} numberOfLines={1}>{summary}</Text> : null}
            styles={styles}
        >
            <View style={styles.tableWrap}>
                <View style={[styles.tableOverlay, styles.proTintOverlay]}>
                    {columns.map((column, index) => (
                        <View key={column.key} style={[styles.tableOverlayCol, index === dayIndex && styles.tableDayTint]} />
                    ))}
                </View>
                <View style={[styles.tableOverlay, styles.proDividerOverlay]}>
                    {columns.map((column, index) => (
                        <View key={column.key} style={[styles.tableOverlayCol, index === groupSplit - 1 && styles.proGroupDivider]} />
                    ))}
                </View>

                <View style={[styles.tableRow, styles.proGroupRow]}>
                    <View style={styles.proLabelCell} />
                    {groups.map((group) => (
                        <View key={group.label} style={[styles.proGroupCell, { flex: group.span }]}>
                            <Text style={styles.proGroupText}>{group.label}</Text>
                        </View>
                    ))}
                </View>
                <View style={[styles.tableRow, styles.proHeadRow]}>
                    <View style={styles.proLabelCell} />
                    {columns.map((column) => {
                        const sub = subLabelFor(column);
                        return (
                            <View key={column.key} style={styles.tableCell}>
                                <Text style={[styles.proHeadText, column.key === 'day' && styles.tableHeadTextDay]} numberOfLines={1}>{column.label}</Text>
                                {sub ? <Text style={styles.proHeadSub} numberOfLines={1}>{sub}</Text> : null}
                            </View>
                        );
                    })}
                </View>
                <View style={[styles.tableRow, styles.proStarRow]}>
                    <Text style={[styles.proLabelCell, styles.tableRowLabel]}>主星</Text>
                    {columns.map((column) => (
                        <Text key={column.key} style={[styles.tableCellText, styles.proStarText]} numberOfLines={1}>
                            {(column.key === 'day' ? column.mainStarShort : column.mainStarFull) || '—'}
                        </Text>
                    ))}
                </View>
                {[{ label: '天干', pick: (column: ProChartColumnView) => column.tianGan }, { label: '地支', pick: (column: ProChartColumnView) => column.diZhi }].map((row) => (
                    <View key={row.label} style={[styles.tableRow, styles.proGlyphRow]}>
                        <Text style={[styles.proLabelCell, styles.tableRowLabel]}>{row.label}</Text>
                        {columns.map((column) => (
                            <View key={column.key} style={styles.tableCell}>
                                <GlyphWithIcon char={row.pick(column)} textStyle={dense ? styles.proGlyphTextDense : styles.proGlyphText} iconSize={11} palette={palette} styles={styles} />
                            </View>
                        ))}
                    </View>
                ))}
                <View style={[styles.tableRow, styles.proCangRow]}>
                    <Text style={[styles.proLabelCell, styles.tableRowLabel]}>藏干</Text>
                    {columns.map((column) => (
                        <View key={column.key} style={styles.tableCellStack}>
                            {(column.cangGanLines.length > 0 ? column.cangGanLines : ['—']).map((line, lineIndex) => (
                                <StemLine key={`${line}-${lineIndex}`} line={line} stemSize={12} noteSize={11} lineHeight={17} palette={palette} styles={styles} />
                            ))}
                        </View>
                    ))}
                </View>
                {detail.map((row, rowIndex) => (
                    <View key={row.key} style={[styles.tableRow, styles.proDetailRow, rowIndex === 0 && styles.proDetailFirst]}>
                        <Text style={[styles.proLabelCell, styles.tableRowLabel]}>{row.label}</Text>
                        {columns.map((column) => (
                            <Text
                                key={column.key}
                                style={[styles.tableCellText, styles.proDetailText, row.small && styles.proDetailTextSmall]}
                                numberOfLines={1}
                                adjustsFontSizeToFit
                                minimumFontScale={0.8}
                            >
                                {row.pick(column) || '—'}
                            </Text>
                        ))}
                    </View>
                ))}
                <View style={[styles.tableRow, styles.proStackRow]}>
                    <Text style={[styles.proLabelCell, styles.tableRowLabel]}>神煞</Text>
                    {columns.map((column) => (
                        <View key={column.key} style={styles.tableCellStack}>
                            {(column.shenSha.length > 0 ? column.shenSha : ['—']).map((line, lineIndex) => (
                                <Text key={`${line}-${lineIndex}`} style={[styles.proShenShaText, dense && styles.proShenShaTextDense]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{line}</Text>
                            ))}
                        </View>
                    ))}
                </View>
            </View>
            {band.length > 0 ? (
                <View style={styles.seasonRow} accessibilityLabel="月令旺衰">
                    <Text style={styles.seasonLabel}>月令</Text>
                    {band.map((item) => {
                        const element = resolveWuXingElement(item.element);
                        return (
                            <View
                                key={`${item.element}-${item.status}`}
                                style={[styles.seasonChip, element ? { backgroundColor: palette.elementSoft[element] } : null]}
                            >
                                <WuXingIcon element={item.element} size={11} />
                                <Text style={[styles.seasonElement, { color: elementColor(item.element, palette) }]}>{item.element}</Text>
                                <Text style={styles.seasonStatus}>{item.status}</Text>
                            </View>
                        );
                    })}
                </View>
            ) : null}
        </Card>
    );
};

const TRACK_CELL_WIDTH = 54;
const TRACK_CELL_GAP = 6;
/** 末格右侧留白，确保滚到底时最后一格完全露出、不被渐隐遮住 */
const TRACK_END_PADDING = 18;

const FortuneTrack: React.FC<{
    label: string;
    cells: DenseTrackCellView[];
    onSelect: (cell: DenseTrackCellView) => void;
    markXiaoYun?: boolean;
    palette: Palette;
    styles: Styles;
}> = ({ label, cells, onSelect, markXiaoYun = false, palette, styles }) => {
    const scrollRef = useRef<ScrollView>(null);
    const [viewportWidth, setViewportWidth] = useState(0);
    const hasScrolledRef = useRef(false);
    const activeIndex = cells.findIndex((cell) => cell.active);
    const cellCount = cells.length;

    useEffect(() => {
        if (viewportWidth <= 0 || activeIndex < 0) {
            return;
        }
        const step = TRACK_CELL_WIDTH + TRACK_CELL_GAP;
        const contentWidth = cellCount * step - TRACK_CELL_GAP + TRACK_END_PADDING;
        // 让选中格尽量居中，并对齐到格子边界，避免左侧露出半格
        const centred = activeIndex * step - (viewportWidth - TRACK_CELL_WIDTH) / 2;
        const snapped = Math.round(centred / step) * step;
        const x = Math.max(0, Math.min(snapped, contentWidth - viewportWidth));
        scrollRef.current?.scrollTo({ x, animated: hasScrolledRef.current });
        hasScrolledRef.current = true;
    }, [activeIndex, cellCount, viewportWidth]);

    const handleLayout = (event: LayoutChangeEvent) => {
        const next = Math.round(event.nativeEvent.layout.width);
        if (next !== viewportWidth) {
            setViewportWidth(next);
        }
    };

    return (
        <View style={styles.trackRow}>
            <View style={styles.trackLabel}>
                {label.split('').map((char, index) => (
                    <Text key={`${char}-${index}`} style={styles.trackLabelText}>{char}</Text>
                ))}
            </View>
            {cells.length === 0 ? (
                <View style={styles.trackEmpty}>
                    <Text style={styles.noteText}>无</Text>
                </View>
            ) : (
                <View style={styles.trackViewport} onLayout={handleLayout}>
                    <ScrollView
                        ref={scrollRef}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.trackContent}
                        accessibilityLabel={`${label}轨道，可左右滑动查看更多`}
                    >
                        {cells.map((cell) => {
                            const primaryChar = cell.primaryText.charAt(0);
                            const secondaryChar = cell.secondaryText.charAt(0);
                            return (
                                <Pressable
                                    key={cell.key}
                                    style={({ pressed }) => [
                                        styles.trackCell,
                                        cell.active && styles.trackCellActive,
                                        pressed && cell.selectable && styles.pressed,
                                    ]}
                                    onPress={() => onSelect(cell)}
                                    disabled={!cell.selectable}
                                    accessibilityRole="button"
                                    accessibilityState={{ selected: cell.active, disabled: !cell.selectable }}
                                    accessibilityLabel={`${cell.topLabel} ${cell.subLabel} ${cell.primaryText}${cell.secondaryText}${cell.isCurrent ? ' 当前' : ''}`}
                                >
                                    {cell.isCurrent ? <View style={styles.trackCurrentDot} /> : null}
                                    <Text style={styles.trackTop} numberOfLines={1}>{cell.topLabel}</Text>
                                    <Text style={styles.trackSub} numberOfLines={1}>{cell.subLabel.replace('~', '–')}</Text>
                                    <Text style={[styles.trackGlyph, styles.trackGlyphFirst, { color: ganZhiCharColor(primaryChar, palette) }]}>
                                        {primaryChar}
                                        <Text style={styles.trackGlyphNote}>{cell.primaryText.slice(1)}</Text>
                                    </Text>
                                    <Text style={[styles.trackGlyph, { color: ganZhiCharColor(secondaryChar, palette) }]}>
                                        {secondaryChar}
                                        <Text style={styles.trackGlyphNote}>{cell.secondaryText.slice(1)}</Text>
                                    </Text>
                                    {markXiaoYun && cell.trackKind === 'xiaoyun' ? <Text style={styles.trackTag}>小运</Text> : null}
                                </Pressable>
                            );
                        })}
                    </ScrollView>
                    <LinearGradient
                        colors={[palette.fadeFrom, palette.card]}
                        start={{ x: 0, y: 0.5 }}
                        end={{ x: 1, y: 0.5 }}
                        style={styles.trackFade}
                    />
                </View>
            )}
        </View>
    );
};

const YunChengCard: React.FC<{
    result: BaziResult;
    privacyEnabled: boolean;
    daYunTrack: DenseTrackCellView[];
    liuNianTrack: DenseTrackCellView[];
    liuYueTrack: DenseTrackCellView[];
    onSelectDaYun: (cell: DenseTrackCellView) => void;
    onSelectLiuNian: (cell: DenseTrackCellView) => void;
    onSelectLiuYue: (cell: DenseTrackCellView) => void;
    palette: Palette;
    styles: Styles;
}> = ({ result, privacyEnabled, daYunTrack, liuNianTrack, liuYueTrack, onSelectDaYun, onSelectLiuNian, onSelectLiuYue, palette, styles }) => {
    const limit = result.childLimit;
    const age = liuNianTrack.find((cell) => cell.active)?.subLabel ?? '—';
    const jiaoYunDate = splitFullDate(limit.jiaoYunDateTime).date;
    const duty = result.baseInfo.renYuanDutyDetail;
    const dutyName = duty?.stem ? `${duty.stem}${duty.element}` : '—';
    const facts = [
        { label: '当前', node: <Text style={styles.factValue} numberOfLines={1}>{age}</Text> },
        { label: '起运', node: <Text style={styles.factValue} numberOfLines={1}>{`${limit.years}年${limit.months}月${limit.days}天`}</Text> },
        { label: '交运', node: <Text style={styles.factValue} numberOfLines={1}>{privacyEnabled ? maskVisibleText(jiaoYunDate) : jiaoYunDate}</Text> },
        {
            label: '人元司令',
            node: (
                <View style={styles.inlineIconValueTight}>
                    <WuXingIcon element={duty?.element || dutyName} size={12} />
                    <Text style={[styles.factValue, styles.factValueInline, { color: elementColor(duty?.element || dutyName, palette) }]}>{dutyName}</Text>
                </View>
            ),
        },
    ];
    return (
        <Card title="运程" dense styles={styles}>
            <View style={styles.factRow}>
                {facts.map((fact) => (
                    <View key={fact.label} style={styles.factItem}>
                        <Text style={styles.fieldLabel} numberOfLines={1}>{fact.label}</Text>
                        {fact.node}
                    </View>
                ))}
            </View>
            <View style={styles.trackStack}>
                <FortuneTrack label="大运" cells={daYunTrack} onSelect={onSelectDaYun} markXiaoYun palette={palette} styles={styles} />
                <FortuneTrack label="流年" cells={liuNianTrack} onSelect={onSelectLiuNian} palette={palette} styles={styles} />
                <FortuneTrack label="流月" cells={liuYueTrack} onSelect={onSelectLiuYue} palette={palette} styles={styles} />
            </View>
        </Card>
    );
};

const ShenShaCard: React.FC<{ rows: ProShenShaRowView[]; palette: Palette; styles: Styles }> = ({ rows, palette, styles }) => (
    <Card title="神煞" dense styles={styles}>
        <View style={styles.shenShaList}>
            {rows.map((row, index) => {
                const next = rows[index + 1];
                const isGroupEnd = Boolean(next) && next.group !== row.group;
                const isLast = index === rows.length - 1;
                return (
                    <View
                        key={row.key}
                        style={[
                            styles.shenShaRow,
                            !isLast && styles.shenShaRowDivider,
                            isGroupEnd && styles.shenShaRowGroupEnd,
                        ]}
                    >
                        <Text style={styles.shenShaLabel}>{row.label}</Text>
                        <ColoredGanZhi value={row.ganZhi || '—'} palette={palette} style={styles.shenShaGanZhi} />
                        <Text style={[styles.shenShaStars, row.stars.length === 0 && styles.shenShaStarsEmpty]}>
                            {row.stars.length > 0 ? row.stars.join(' · ') : '—'}
                        </Text>
                    </View>
                );
            })}
        </View>
    </Card>
);

const GanZhiLayerCard: React.FC<{
    layer: ReturnType<typeof buildBaziProChartViewModel>['ganZhiLayer'];
    onOpenDetail: () => void;
    palette: Palette;
    styles: Styles;
}> = ({ layer, onOpenDetail, palette, styles }) => {
    const groups = [
        {
            title: '岁运作用',
            rows: [
                { label: '天干', value: layer.suiYunTianGan },
                { label: '地支', value: layer.suiYunDiZhi },
                { label: '整柱', value: layer.suiYunZhengZhu },
            ],
        },
        {
            title: '原局',
            rows: [
                { label: '天干', value: layer.yuanJuTianGan },
                { label: '地支', value: layer.yuanJuDiZhi },
                { label: '整柱', value: layer.yuanJuZhengZhu },
            ],
        },
    ];
    return (
        <Card
            title="干支分层"
            dense
            right={(
                <Pressable
                    style={({ pressed }) => [styles.cardLink, pressed && styles.pressed]}
                    onPress={onOpenDetail}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel="打开干支详情"
                >
                    <Text style={styles.cardLinkText}>干支详情</Text>
                    <ChevronRightIcon size={12} color={palette.gold} />
                </Pressable>
            )}
            styles={styles}
        >
            {groups.map((group, groupIndex) => (
                <View key={group.title} style={groupIndex > 0 ? styles.relationGroupNext : styles.relationGroupFirst}>
                    <Text style={styles.noteText}>{group.title}</Text>
                    <View style={styles.relationRows}>
                        {group.rows.map((row) => {
                            const chips = splitStarText(row.value || '');
                            return (
                                <View key={row.label} style={styles.relationRow}>
                                    <Text style={styles.relationLabel}>{row.label}</Text>
                                    {chips.length > 0 ? (
                                        <View style={styles.relationChips}>
                                            {chips.map((chip, chipIndex) => (
                                                <View key={`${chip}-${chipIndex}`} style={styles.relationChip}>
                                                    <Text style={styles.relationChipText}>{chip}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    ) : (
                                        <Text style={styles.relationEmpty}>无</Text>
                                    )}
                                </View>
                            );
                        })}
                    </View>
                </View>
            ))}
        </Card>
    );
};

/* ------------------------------------------------------------------ */
/* 样式                                                                 */
/* ------------------------------------------------------------------ */

const makeStyles = (Colors: any, palette: Palette, viewportWidth: number = 862) => {
    const boundedWidth = Math.min(862, Math.max(320, viewportWidth));
    const fluid = (min: number, max: number): number => Math.round(min + ((boundedWidth - 320) / 542) * (max - min));
    const isNarrow = viewportWidth < 375;
    const siZhuGlyph = fluid(34, 48);
    const proGlyph = fluid(27, 38);
    const proGlyphDense = fluid(24, 34);
    const tabular = ['tabular-nums'] as Array<'tabular-nums'>;

    return StyleSheet.create({
        container: { flex: 1, backgroundColor: 'transparent' },
        shell: {
            position: 'relative',
            flex: 1,
            width: '100%',
            maxWidth: 862,
            alignSelf: 'center',
            overflow: 'hidden',
            backgroundColor: 'transparent',
            borderLeftWidth: viewportWidth > 862 ? StyleSheet.hairlineWidth : 0,
            borderRightWidth: viewportWidth > 862 ? StyleSheet.hairlineWidth : 0,
            borderColor: Colors.bazi.divider,
        },
        loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
        loadingText: { fontSize: FontSize.md, color: Colors.text.tertiary },
        missingCard: {
            width: '88%',
            maxWidth: 420,
            padding: Spacing.xl,
            borderRadius: BorderRadius.lg,
            borderWidth: 1,
            borderColor: Colors.border.subtle,
            backgroundColor: Colors.bg.card,
            gap: Spacing.md,
        },
        missingTitle: {
            fontSize: FontSize.lg,
            color: Colors.text.heading,
            fontWeight: '700',
            textAlign: 'center',
        },
        missingBody: {
            fontSize: FontSize.sm,
            color: Colors.text.secondary,
            lineHeight: 22,
            textAlign: 'center',
        },
        missingActions: { flexDirection: 'row', gap: Spacing.sm },
        missingBtn: {
            flex: 1,
            minHeight: 44,
            borderRadius: BorderRadius.md,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: Spacing.md,
        },
        missingBtnPrimary: { backgroundColor: Colors.bazi.trackActiveBorder },
        missingBtnSecondary: {
            borderWidth: 1,
            borderColor: Colors.border.subtle,
            backgroundColor: Colors.bg.elevated,
        },
        missingBtnText: { fontSize: FontSize.sm, fontWeight: '600' },
        missingBtnPrimaryText: { color: Colors.text.inverse },
        missingBtnSecondaryText: { color: Colors.text.primary },

        /* 顶部导航：与头部同底，连成一整块卷首 */
        topBar: {
            height: 48,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 4,
            backgroundColor: palette.card,
            borderBottomWidth: 1,
            borderBottomColor: palette.card,
            zIndex: 2,
        },
        topBarScrolled: { borderBottomColor: palette.hairline },
        topBarIconBtn: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
        topBarBackBtn: { width: 44 },
        topBarIconBtnDisabled: { opacity: 0.45 },
        topBarSpacer: { flex: 1 },
        topTabs: { flexDirection: 'row', alignItems: 'center', gap: isNarrow ? 16 : 20, marginLeft: 2 },
        topTab: { height: 44, paddingHorizontal: 2, justifyContent: 'center' },
        topTabText: {
            fontSize: isNarrow ? 14 : 15,
            lineHeight: 20,
            fontWeight: '500',
            color: palette.muted,
        },
        topTabTextActive: { fontWeight: '700', color: palette.heading },
        topTabIndicator: {
            position: 'absolute',
            left: '50%',
            bottom: 6,
            width: 16,
            height: 2,
            marginLeft: -8,
            borderRadius: 1,
            backgroundColor: palette.vermilion,
        },
        aiChip: {
            height: 28,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            marginRight: 2,
            paddingLeft: 8,
            paddingRight: 10,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: palette.goldBorder,
            backgroundColor: palette.goldSoft,
        },
        aiChipDisabled: { opacity: 0.45 },
        aiChipText: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: palette.gold },
        privacyOnBadge: {
            width: 32,
            height: 28,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: palette.chipBg,
        },
        persistBanner: {
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.sm,
            backgroundColor: Colors.bazi.warningBg,
            borderBottomWidth: 1,
            borderBottomColor: Colors.bazi.warningBorder,
        },
        persistBannerText: {
            color: Colors.bazi.warningText,
            fontSize: FontSize.sm,
            textAlign: 'center',
        },

        content: { flex: 1 },
        contentContainer: { width: '100%', alignItems: 'center', paddingBottom: 28 },
        pageSurface: { width: '100%', maxWidth: 862, backgroundColor: 'transparent' },

        /* 头部：宣纸底 + 右侧剪纸生肖 */
        hero: {
            position: 'relative',
            overflow: 'hidden',
            paddingTop: 14,
            paddingBottom: 18,
            paddingHorizontal: 20,
            backgroundColor: palette.card,
            borderBottomWidth: 1,
            borderBottomColor: palette.heroBorder,
        },
        heroPaperCut: {
            position: 'absolute',
            top: -10,
            right: -16,
            width: 180,
            height: 180,
            pointerEvents: 'none',
        },
        heroNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
        heroName: {
            flexShrink: 1,
            fontSize: 22,
            lineHeight: 28,
            fontWeight: '700',
            letterSpacing: 1,
            color: palette.heading,
        },
        heroSeal: {
            minWidth: 36,
            height: 20,
            paddingHorizontal: 4,
            borderRadius: 3,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: palette.vermilion,
        },
        heroSealText: {
            fontSize: 11,
            lineHeight: 14,
            fontWeight: '700',
            letterSpacing: 1,
            color: palette.sealText,
        },
        heroChip: {
            paddingHorizontal: 6,
            paddingVertical: 1,
            borderRadius: 4,
            backgroundColor: palette.chipBg,
        },
        heroChipText: { fontSize: 11, lineHeight: 16, fontWeight: '500', color: palette.chipInk },
        heroSwitch: {
            flexDirection: 'row',
            height: 24,
            marginLeft: 2,
            padding: 2,
            borderRadius: 12,
            backgroundColor: palette.segTrack,
        },
        heroSwitchBtn: {
            height: 20,
            paddingHorizontal: 8,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: 'transparent',
            justifyContent: 'center',
        },
        heroSwitchBtnOn: { borderColor: palette.segBorder, backgroundColor: palette.segOn },
        heroSwitchText: { fontSize: 11, lineHeight: 15, color: palette.muted },
        heroSwitchTextOn: { fontWeight: '600', color: palette.ink },
        heroRows: { marginTop: 12, gap: 6 },
        heroRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
        heroRowLabel: { width: 56, fontSize: 12, lineHeight: 18, color: palette.muted },
        heroRowValue: {
            flexShrink: 1,
            fontSize: 13,
            lineHeight: 18,
            color: palette.ink,
            fontVariant: tabular,
        },

        /* 卡片 */
        card: {
            marginHorizontal: 12,
            marginTop: 10,
            padding: 14,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: palette.cardBorder,
            backgroundColor: palette.card,
        },
        cardFirst: { marginTop: 12 },
        cardDense: { padding: 12 },
        cardHeader: { minHeight: 22, flexDirection: 'row', alignItems: 'center', gap: 8 },
        cardDiamond: {
            width: 5,
            height: 5,
            backgroundColor: palette.vermilion,
            transform: [{ rotate: '45deg' }],
        },
        cardTitle: {
            flex: 1,
            fontSize: 15,
            lineHeight: 22,
            fontWeight: '600',
            letterSpacing: 1,
            color: palette.heading,
        },
        cardHeaderMeta: { flexShrink: 1, fontSize: 12, color: palette.muted, fontVariant: tabular },
        cardLink: { flexDirection: 'row', alignItems: 'center', gap: 2 },
        cardLinkText: { fontSize: 12, color: palette.gold },
        cardFooterRow: {
            marginTop: 14,
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: palette.hairline,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
        },
        footerLabel: { fontSize: 12, color: palette.muted },
        footerStrong: { fontSize: 15, lineHeight: 22, fontWeight: '600' },
        footerBody: { fontSize: 13, color: palette.body },
        noteText: { fontSize: 11, lineHeight: 16, color: palette.muted },
        fieldLabel: { fontSize: 11, lineHeight: 16, color: palette.muted },
        fieldValueStrong: {
            marginTop: 4,
            fontSize: 15,
            lineHeight: 22,
            fontWeight: '600',
            color: palette.ink,
            fontVariant: tabular,
        },
        fieldValueMinor: { fontSize: 12, fontWeight: '400', color: palette.muted },
        inlineIconValue: { marginTop: 0, flexDirection: 'row', alignItems: 'center', gap: 4 },
        inlineIconValueTight: { marginTop: 2, flexDirection: 'row', alignItems: 'center', gap: 3 },

        /* 表格（四柱 / 排盘）共用 */
        tableWrap: { position: 'relative', marginTop: 12 },
        tableOverlay: {
            position: 'absolute',
            right: 0,
            flexDirection: 'row',
            pointerEvents: 'none',
        },
        tableOverlayCol: { flex: 1 },
        tableDayTint: { borderRadius: 8, backgroundColor: palette.dayTint },
        tableRow: { flexDirection: 'row', alignItems: 'center' },
        tableCell: { flex: 1, alignItems: 'center', justifyContent: 'center' },
        tableCellStack: { flex: 1, alignItems: 'center' },
        tableCellText: { flex: 1, textAlign: 'center' },
        tableRowLabel: { fontSize: 11, lineHeight: 16, color: palette.muted },
        tableHeadText: { fontSize: 12, color: palette.muted },
        tableHeadTextDay: { fontWeight: '600', color: palette.ink },
        // 不用百分比 inset：原生 Yoga 对收缩宽度父节点按可用宽度（整列）解析 right:'100%'，图标会左偏一列
        glyphWrap: { position: 'relative', justifyContent: 'center' },
        glyphIcon: { position: 'absolute' },
        glyphText: { fontWeight: '700', textAlign: 'center' },
        stemLine: { textAlign: 'center' },
        stemChar: { fontWeight: '700' },
        stemNote: { color: palette.muted, textAlign: 'center' },

        /* 四柱 */
        siZhuOverlay: { top: 0, bottom: 0, left: 30 },
        siZhuLabelCell: { width: 30 },
        siZhuHeadRow: { height: 26 },
        siZhuStarRow: { height: 28 },
        siZhuStarText: { fontSize: 14, color: palette.body },
        siZhuGlyphRow: { height: Math.round(siZhuGlyph * 1.28) },
        siZhuGlyphText: { fontSize: siZhuGlyph, lineHeight: Math.round(siZhuGlyph * 1.24) },
        siZhuCangRow: { minHeight: 66, paddingVertical: 4 },
        siZhuDetailRow: { height: 34, borderTopWidth: 1, borderTopColor: palette.hairline },
        siZhuDetailFirst: { marginTop: 8 },
        siZhuDetailText: { fontSize: 13, color: palette.body },
        siZhuStackRow: {
            paddingTop: 8,
            paddingBottom: 4,
            borderTopWidth: 1,
            borderTopColor: palette.hairline,
        },
        siZhuShenShaText: { fontSize: 12, lineHeight: 17, color: palette.muted, textAlign: 'center' },

        /* 命局参考 */
        pairGrid: { marginTop: 12, gap: 14 },
        pairRow: { flexDirection: 'row', gap: 12 },
        pairItem: { flex: 1, minWidth: 0 },
        schoolLines: { marginTop: 4, gap: 4 },
        schoolLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
        schoolTag: {
            width: 16,
            height: 16,
            borderRadius: 3,
            borderWidth: 1,
            borderColor: palette.tagBorder,
            alignItems: 'center',
            justifyContent: 'center',
        },
        schoolTagText: { fontSize: 10, lineHeight: 13, color: palette.muted },
        schoolLineText: { flexShrink: 1, fontSize: 13, lineHeight: 20, color: palette.ink },

        /* 五行 */
        segmented: {
            flexDirection: 'row',
            height: 28,
            padding: 2,
            borderRadius: 14,
            backgroundColor: palette.segTrack,
        },
        segmentedBtn: {
            height: 24,
            paddingHorizontal: 10,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: 'transparent',
            justifyContent: 'center',
        },
        segmentedBtnOn: { borderColor: palette.segBorder, backgroundColor: palette.segOn },
        segmentedText: { fontSize: 12, lineHeight: 16, color: palette.muted },
        segmentedTextOn: { fontWeight: '600', color: palette.ink },
        energyList: { marginTop: 12, gap: 8 },
        energyRow: { height: 30, flexDirection: 'row', alignItems: 'center', gap: 10 },
        energyLabel: { width: 38, flexDirection: 'row', alignItems: 'center', gap: 4 },
        energyElement: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
        energyTrack: {
            flex: 1,
            height: 6,
            borderRadius: 3,
            overflow: 'hidden',
            backgroundColor: palette.barTrack,
        },
        energyFill: { height: '100%', borderRadius: 3 },
        energyValue: {
            width: 38,
            textAlign: 'right',
            fontSize: 13,
            fontWeight: '600',
            color: palette.ink,
            fontVariant: tabular,
        },
        energyMeta: { width: 60, textAlign: 'right', fontSize: 12, color: palette.muted },
        energyError: { marginTop: 12, gap: 4 },
        energyErrorTitle: { fontSize: 13, fontWeight: '600', color: Colors.bazi.warningText },
        energyErrorText: { fontSize: 12, lineHeight: 18, color: palette.muted },
        partyBlock: {
            marginTop: 14,
            paddingTop: 14,
            borderTopWidth: 1,
            borderTopColor: palette.hairline,
        },
        partyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
        partyLabel: { fontSize: 12, color: palette.muted },
        partyValue: { fontSize: 15, fontWeight: '600', color: palette.ink, fontVariant: tabular },
        partyBar: { flex: 1, height: 6, flexDirection: 'row', gap: 2 },
        partySame: { borderRadius: 3, backgroundColor: palette.partySame },
        partyDiff: { flex: 1, borderRadius: 3, backgroundColor: palette.partyDiff },
        partyLegend: { marginTop: 6, flexDirection: 'row', justifyContent: 'space-between' },
        energyScopeNote: { marginTop: 12 },

        /* 节气 */
        timeline: { position: 'relative', marginTop: 14, height: 96 },
        timelineSpan: {
            position: 'absolute',
            top: 8,
            textAlign: 'center',
            fontSize: 11,
            lineHeight: 16,
            color: palette.muted,
            fontVariant: tabular,
        },
        timelineSpanLeft: { left: '16.6%', right: '50%' },
        timelineSpanRight: { left: '50%', right: '16.6%' },
        timelineLinePast: {
            position: 'absolute',
            left: '16.6%',
            right: '50%',
            top: 33,
            height: 2,
            backgroundColor: palette.gold,
        },
        timelineLineFuture: {
            position: 'absolute',
            left: '50%',
            right: '16.6%',
            top: 33.5,
            height: 1,
            backgroundColor: palette.timelineThin,
        },
        timelineNode: { position: 'absolute', top: 27, width: '33.3%', alignItems: 'center' },
        timelineDiamond: {
            width: 10,
            height: 10,
            marginTop: 2,
            backgroundColor: palette.gold,
            transform: [{ rotate: '45deg' }],
        },
        timelineDiamondHollow: {
            borderWidth: 1.5,
            borderColor: palette.timelineHollow,
            backgroundColor: palette.card,
        },
        timelineBirthDot: {
            width: 14,
            height: 14,
            borderRadius: 7,
            borderWidth: 3,
            borderColor: palette.birthHalo,
            backgroundColor: palette.vermilion,
        },
        timelineName: {
            marginTop: 9,
            fontSize: 15,
            lineHeight: 20,
            fontWeight: '600',
            color: palette.ink,
        },
        timelineNameBirth: { color: palette.vermilion },
        timelineNameNext: { fontWeight: '400', color: palette.body },
        timelineDate: { fontSize: 12, lineHeight: 16, color: palette.muted, fontVariant: tabular },

        /* 命理参数 */
        paramGrid: { marginTop: 6 },
        paramPair: { flexDirection: 'row', gap: 16 },
        paramCell: {
            flex: 1,
            minWidth: 0,
            height: 44,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },
        paramCellDivider: { borderBottomWidth: 1, borderBottomColor: palette.hairline },
        paramLabel: { width: 30, fontSize: 12, color: palette.muted },
        paramMain: { fontSize: 14, color: palette.ink },
        paramSub: { flexShrink: 1, fontSize: 12, color: palette.muted },
        paramTight: { marginLeft: -4 },

        /* 起运 */
        qiYunGrid: { marginTop: 12 },
        qiYunRule: { marginTop: 8 },
        chipRow: { flexWrap: 'wrap', gap: 6 },
        chipRowLabel: { marginRight: 2, fontSize: 11, color: palette.muted },
        outlineChip: {
            paddingHorizontal: 8,
            paddingVertical: 2,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: palette.chipBorder,
        },
        outlineChipText: { fontSize: 11, lineHeight: 16, color: palette.body },

        /* 排盘 */
        proTintOverlay: { top: 20, bottom: 0, left: 28 },
        proDividerOverlay: { top: 24, bottom: 4, left: 28 },
        proGroupDivider: { borderRightWidth: 1, borderRightColor: palette.rule },
        proLabelCell: { width: 28 },
        proGroupRow: { height: 20, alignItems: 'stretch' },
        proGroupCell: {
            marginHorizontal: 6,
            borderBottomWidth: 1,
            borderBottomColor: palette.rule,
            justifyContent: 'center',
        },
        proGroupText: { textAlign: 'center', fontSize: 11, lineHeight: 16, color: palette.muted },
        proHeadRow: { height: 36 },
        proHeadText: { fontSize: 12, lineHeight: 15, color: palette.muted },
        proHeadSub: { fontSize: isNarrow ? 9 : 10, lineHeight: 15, color: palette.muted, fontVariant: tabular },
        proStarRow: { height: 26 },
        proStarText: { fontSize: 13, color: palette.body },
        proGlyphRow: { height: Math.round(proGlyph * 1.42) },
        proGlyphText: { fontSize: proGlyph, lineHeight: Math.round(proGlyph * 1.28) },
        proGlyphTextDense: { fontSize: proGlyphDense, lineHeight: Math.round(proGlyphDense * 1.28) },
        proCangRow: { minHeight: 58, paddingVertical: 4 },
        proDetailRow: { height: 30, borderTopWidth: 1, borderTopColor: palette.hairline },
        proDetailFirst: { marginTop: 6 },
        proDetailText: { fontSize: 13, color: palette.body },
        proDetailTextSmall: { fontSize: isNarrow ? 11 : 12 },
        proStackRow: {
            paddingTop: 7,
            paddingBottom: 4,
            borderTopWidth: 1,
            borderTopColor: palette.hairline,
        },
        proShenShaText: { fontSize: isNarrow ? 10 : 11, lineHeight: 16, color: palette.muted, textAlign: 'center' },
        proShenShaTextDense: { fontSize: isNarrow ? 9 : 10, lineHeight: 15 },
        seasonRow: {
            marginTop: 10,
            paddingTop: 10,
            borderTopWidth: 1,
            borderTopColor: palette.hairline,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
        },
        seasonLabel: { width: 28, fontSize: 11, color: palette.muted },
        seasonChip: {
            flex: 1,
            height: 24,
            borderRadius: 12,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 3,
            backgroundColor: palette.chipBg,
        },
        seasonElement: { fontSize: 12, fontWeight: '700' },
        seasonStatus: { fontSize: 12, color: palette.body },

        /* 运程 */
        factRow: { marginTop: 10, flexDirection: 'row', justifyContent: 'space-between', gap: isNarrow ? 6 : 10 },
        factItem: { flexShrink: 1 },
        factValue: {
            marginTop: 2,
            fontSize: isNarrow ? 13 : 14,
            lineHeight: 20,
            fontWeight: '600',
            color: palette.ink,
            fontVariant: tabular,
        },
        factValueInline: { marginTop: 0 },
        trackStack: {
            marginTop: 12,
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: palette.hairline,
            gap: 10,
        },
        trackRow: { flexDirection: 'row', alignItems: 'stretch', gap: 8 },
        trackLabel: {
            width: 28,
            alignItems: 'center',
            justifyContent: 'center',
            borderRightWidth: 1,
            borderRightColor: palette.hairline,
        },
        trackLabelText: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: palette.ink },
        trackViewport: { position: 'relative', flex: 1, minWidth: 0 },
        trackEmpty: { flex: 1, minHeight: 40, justifyContent: 'center' },
        trackContent: { gap: TRACK_CELL_GAP, paddingRight: TRACK_END_PADDING },
        trackCell: {
            position: 'relative',
            width: TRACK_CELL_WIDTH,
            paddingVertical: 7,
            alignItems: 'center',
            borderRadius: 8,
            borderWidth: 1,
            borderColor: palette.trackCellBorder,
            backgroundColor: palette.trackCellBg,
        },
        trackCellActive: {
            borderWidth: 1.5,
            borderColor: palette.gold,
            backgroundColor: palette.dayTint,
        },
        trackCurrentDot: {
            position: 'absolute',
            top: 4,
            right: 4,
            width: 5,
            height: 5,
            borderRadius: 3,
            backgroundColor: palette.vermilion,
        },
        trackTop: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: palette.ink, fontVariant: tabular },
        trackSub: { fontSize: 10, lineHeight: 13, color: palette.muted, fontVariant: tabular },
        trackGlyph: { fontSize: 17, lineHeight: 22, fontWeight: '700' },
        trackGlyphFirst: { marginTop: 5 },
        trackGlyphNote: { fontSize: 11, fontWeight: '400', color: palette.muted },
        trackTag: { marginTop: 2, fontSize: 9, lineHeight: 12, color: palette.muted },
        trackFade: { position: 'absolute', top: 0, right: 0, bottom: 0, width: 18, pointerEvents: 'none' },

        /* 神煞 */
        shenShaList: { marginTop: 6 },
        shenShaRow: { minHeight: 34, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 8 },
        shenShaRowDivider: { borderBottomWidth: 1, borderBottomColor: palette.hairline },
        shenShaRowGroupEnd: { borderBottomColor: palette.rule },
        shenShaLabel: { width: 30, fontSize: 12, color: palette.muted },
        shenShaGanZhi: { width: 32, fontSize: 13, lineHeight: 20, fontWeight: '600' },
        shenShaStars: { flex: 1, fontSize: 13, lineHeight: 20, color: palette.ink },
        shenShaStarsEmpty: { color: palette.muted },

        /* 干支分层 */
        relationGroupFirst: { marginTop: 10 },
        relationGroupNext: {
            marginTop: 12,
            paddingTop: 10,
            borderTopWidth: 1,
            borderTopColor: palette.hairline,
        },
        relationRows: { marginTop: 4, gap: 8 },
        relationRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
        relationLabel: { width: 30, paddingTop: 2, fontSize: 12, lineHeight: 18, color: palette.muted },
        relationChips: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
        relationChip: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: palette.relationBg },
        relationChipText: { fontSize: 12, lineHeight: 18, color: palette.body },
        relationEmpty: { paddingTop: 2, fontSize: 12, lineHeight: 18, color: palette.muted },

        pressed: { opacity: 0.72 },
    });
};
