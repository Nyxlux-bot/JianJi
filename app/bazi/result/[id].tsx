import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
    BackIcon,
    ChevronRightIcon,
    EyeIcon,
    EyeOffIcon,
    MoreVerticalIcon,
    SparklesIcon,
} from '../../../src/components/Icons';
import AIChatModal from '../../../src/components/AIChatModal';
import ConfirmModal from '../../../src/components/ConfirmModal';
import { CustomAlert } from '../../../src/components/CustomAlertProvider';
import OverflowMenu, { OverflowMenuItem } from '../../../src/components/OverflowMenu';
import StatusBarDecor from '../../../src/components/StatusBarDecor';
import { useTheme } from '../../../src/theme/ThemeContext';
import { BorderRadius, FontSize, Spacing } from '../../../src/theme/colors';
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
    ProChartRowView,
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
import { shareBaziResultMarkdown } from '../../../src/services/share';
import { isAIConfigured } from '../../../src/services/settings';
import { clearAIAnalysisJob } from '../../../src/services/ai-analysis-jobs';

type EnergyMetric = 'energy' | 'direct' | 'hidden';

const MATRIX_COLORS: Record<string, string> = {
    木: '#2E9B47',
    火: '#D74B37',
    土: '#8E6A3B',
    金: '#D19A26',
    水: '#2B74D8',
};

function pickWuXingColor(text: string, Colors?: any): string | null {
    const palette: Record<string, string> = Colors ? {
        木: Colors.bazi.elementWood,
        火: Colors.bazi.elementFire,
        土: Colors.bazi.elementEarth,
        金: Colors.bazi.elementMetal,
        水: Colors.bazi.elementWater,
    } : MATRIX_COLORS;
    for (const [key, color] of Object.entries(palette)) {
        if (text.includes(key)) {
            return color;
        }
    }
    const chars = text.split('');
    const map: Record<string, string> = {
        甲: palette.木, 乙: palette.木, 寅: palette.木, 卯: palette.木,
        丙: palette.火, 丁: palette.火, 巳: palette.火, 午: palette.火,
        戊: palette.土, 己: palette.土, 辰: palette.土, 戌: palette.土, 丑: palette.土, 未: palette.土,
        庚: palette.金, 辛: palette.金, 申: palette.金, 酉: palette.金,
        壬: palette.水, 癸: palette.水, 子: palette.水, 亥: palette.水,
    };
    for (const char of chars) {
        if (map[char]) {
            return map[char];
        }
    }
    return null;
}

function pickWuXingBandBackground(element: string, Colors: any): string {
    const palette: Record<string, string> = {
        木: Colors.bazi.elementWoodBg,
        火: Colors.bazi.elementFireBg,
        土: Colors.bazi.elementEarthBg,
        金: Colors.bazi.elementMetalBg,
        水: Colors.bazi.elementWaterBg,
    };
    return palette[element] ?? Colors.bazi.surfaceMuted;
}

function ziHourModeLabel(mode: 'late_zi_next_day' | 'early_zi_same_day'): string {
    return mode === 'early_zi_same_day' ? '早子时当日' : '晚子时次日';
}

function timeModeLabel(mode: 'clock_time' | 'mean_solar_time' | 'true_solar_time'): string {
    return getBaziTimeModeLabel(mode);
}

function daylightSavingLabel(enabled: boolean): string {
    return enabled ? '开启' : '关闭';
}

function maskVisibleText(text: string): string {
    if (!text) {
        return '***';
    }
    return '*'.repeat(Math.max(3, text.length));
}

function maskLabeledText(text: string): string {
    const separatorIndex = text.indexOf('：');
    if (separatorIndex < 0) {
        return maskVisibleText(text);
    }
    const prefix = text.slice(0, separatorIndex + 1);
    const content = text.slice(separatorIndex + 1).trim();
    return `${prefix}${maskVisibleText(content)}`;
}

function getCurrentItemIndex<T extends { isCurrent: boolean }>(items: T[]): number {
    if (items.length === 0) {
        return 0;
    }
    const currentIndex = items.findIndex((item) => item.isCurrent);
    return currentIndex >= 0 ? currentIndex : 0;
}

export default function BaziResultPage() {
    const { Colors } = useTheme();
    const { width } = useWindowDimensions();
    const styles = makeStyles(Colors, width);
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
    const isCompactLayout = width < 420;
    const displayName = privacyEnabled ? maskVisibleText(result?.subject.name ?? '') : (result?.subject.name ?? '');
    const displaySolarHeader = privacyEnabled && proChartView ? maskLabeledText(proChartView.header.solarHeaderText) : (proChartView?.header.solarHeaderText ?? '');
    const displayLunarHeader = privacyEnabled && proChartView ? maskLabeledText(proChartView.header.lunarHeaderText) : (proChartView?.header.lunarHeaderText ?? '');
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

    return (
        <View style={styles.container}>
            <StatusBarDecor />
            <View style={styles.shell}>
                <View style={styles.compactHeader}>
                    <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.headerBtn, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="返回">
                        <BackIcon size={24} />
                    </Pressable>

                    <View style={styles.compactTabsRow} accessibilityRole="tablist">
                        <SectionTab label="命盘概览" active={activeSection === 'overview'} onPress={() => setActiveSection('overview')} styles={styles} />
                        <SectionTab label="专业细盘" active={activeSection === 'proChart'} onPress={() => setActiveSection('proChart')} styles={styles} />
                    </View>

                    <Pressable
                        onPress={handleOpenAIChat}
                        style={({ pressed }) => [styles.aiCompactBtn, (!aiConfigured || !result) && styles.aiCompactBtnDisabled, pressed && styles.pressed]}
                        disabled={!aiConfigured || !result}
                        accessibilityRole="button"
                        accessibilityLabel="AI 分析"
                    >
                        <SparklesIcon size={16} color={Colors.text.inverse} />
                        <Text style={styles.aiCompactBtnText}>AI</Text>
                    </Pressable>

                    {result ? (
                        <Pressable
                            onPress={() => setPrivacyEnabled((prev) => !prev)}
                            style={({ pressed }) => [styles.headerBtn, pressed && styles.pressed]}
                            accessibilityRole="button"
                            accessibilityLabel={privacyEnabled ? '关闭隐私模式' : '开启隐私模式'}
                        >
                            {privacyEnabled ? <EyeOffIcon size={20} /> : <EyeIcon size={20} />}
                        </Pressable>
                    ) : null}
                    <Pressable
                        onPress={() => setMenuVisible((prev) => !prev)}
                        style={({ pressed }) => [styles.headerBtn, !hasEnabledMenuItems && styles.headerBtnDisabled, pressed && styles.pressed]}
                        disabled={!hasEnabledMenuItems}
                        accessibilityRole="button"
                        accessibilityLabel="更多操作"
                    >
                        <MoreVerticalIcon size={20} />
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
                >
                    <View style={styles.pageSurface}>
                        {activeSection === 'overview' ? (
                        <>
                            <OverviewHero
                                name={displayName}
                                mingZao={result.subject.mingZaoLabel}
                                yinYang={`${result.subject.yinYangLabel}${result.subject.genderLabel}`}
                                solar={privacyEnabled ? maskVisibleText(result.baseInfo.solarDisplay) : result.baseInfo.solarDisplay}
                                lunar={privacyEnabled ? maskVisibleText(result.baseInfo.lunarDisplay) : result.baseInfo.lunarDisplay}
                                chartTime={privacyEnabled ? maskVisibleText(result.baseInfo.trueSolarDisplay) : result.baseInfo.trueSolarDisplay}
                                chartTimeLabel={getBaziChartTimeLabel(result.schoolOptionsResolved.timeMode)}
                                gender={result.subject.genderLabel}
                                zodiac={result.baseInfo.zodiac}
                                location={privacyEnabled ? maskVisibleText(result.baseInfo.birthPlaceDisplay) : result.baseInfo.birthPlaceDisplay}
                                timeMode={timeModeLabel(result.schoolOptionsResolved.timeMode)}
                                compact={isCompactLayout}
                                styles={styles}
                            />
                            <OverviewOriginChart rows={overviewOriginRows} styles={styles} Colors={Colors} />
                            {result.analysisProfile ? <BaziAnalysisReferenceStrip profile={result.analysisProfile} styles={styles} Colors={Colors} /> : null}
                            <WuXingOverview
                                energy={energyState.snapshot}
                                error={energyState.error}
                                metric={energyMetric}
                                onMetricChange={setEnergyMetric}
                                styles={styles}
                                Colors={Colors}
                            />
                            <JieQiTimeline
                                result={result}
                                chartTimeDisplay={privacyEnabled ? maskVisibleText(result.baseInfo.trueSolarDisplay) : result.baseInfo.trueSolarDisplay}
                                privacyEnabled={privacyEnabled}
                                styles={styles}
                            />
                            <OverviewSection title="命理参数" showHeader={false} styles={styles}>
                                <View style={styles.detailGrid}>
                                    <DetailTile label="星座" value={result.baseInfo.constellation} styles={styles} />
                                    <DetailTile label="星宿" value={result.baseInfo.xingXiu} styles={styles} />
                                    <DetailTile label="胎元" value={result.baseInfo.taiYuan} styles={styles} />
                                    <DetailTile label="胎息" value={result.baseInfo.taiXi} styles={styles} />
                                    <DetailTile label="命宫" value={result.baseInfo.mingGong} styles={styles} />
                                    <DetailTile label="身宫" value={result.baseInfo.shenGong} styles={styles} />
                                    <DetailTile label="命卦" value={result.baseInfo.mingGua} styles={styles} />
                                    <DetailTile label="空亡" value={result.baseInfo.kongWang} styles={styles} />
                                </View>
                            </OverviewSection>
                            <OverviewJourney
                                result={result}
                                privacyEnabled={privacyEnabled}
                                styles={styles}
                            />
                        </>
                        ) : proChartView ? (
                        <>
                            <ChartHeaderStrip
                                name={displayName}
                                solarText={displaySolarHeader}
                                lunarText={displayLunarHeader}
                                mingZaoText={proChartView.header.mingZaoText}
                                panelMode={panelMode}
                                showPanelSwitch
                                onTogglePanelMode={() => setPanelMode((prev) => (prev === 'fortune' ? 'taiming' : 'fortune'))}
                                styles={styles}
                            />
                            <View style={styles.proFlow}>
                                <DenseMatrix
                                    headerLabels={(panelMode === 'fortune' ? proChartView.fortuneColumns : proChartView.taimingColumns).map((column) => column.label)}
                                    rows={panelMode === 'fortune' ? proChartView.fortuneRows : proChartView.taimingRows}
                                    styles={styles}
                                />

                                <DualInfoStrip infoStrip={proChartView.infoStrip} styles={styles} />

                                <DenseTrackMatrix rowLabel="大运" columns={proChartView.daYunTrack} onSelect={handleSelectDaYunCell} styles={styles} />
                                <DenseTrackMatrix rowLabel="流年" columns={proChartView.liuNianTrack} onSelect={handleSelectLiuNianCell} styles={styles} />
                                <DenseTrackMatrix rowLabel="流月" columns={proChartView.liuYueTrack} onSelect={handleSelectLiuYueCell} styles={styles} />

                                <View style={styles.proQiYunBand}>
                                    {proChartView.infoStrip.qiYunBand.map((item, index) => {
                                        return (
                                            <View
                                                key={`${item.element}-${item.status}`}
                                                style={[
                                                    styles.proQiYunBandCell,
                                                    index === proChartView.infoStrip.qiYunBand.length - 1 && styles.proQiYunBandCellLast,
                                                    { backgroundColor: pickWuXingBandBackground(item.element, Colors) },
                                                ]}
                                            >
                                                <Text style={styles.proQiYunBandText}>
                                                    {item.element}{item.status}
                                                </Text>
                                            </View>
                                        );
                                    })}
                                </View>

                                <View style={styles.sectionTitleBar}>
                                    <Text style={styles.subTitle}>神煞分层</Text>
                                </View>
                                {proChartView.shenShaSections.map((section) => (
                                    <LayerStarBlock key={section.title} title={section.title} rows={section.rows} styles={styles} />
                                ))}

                                <View style={styles.sectionTitleBar}>
                                    <Text style={styles.subTitle}>干支分层</Text>
                                </View>
                                <GanZhiLayerBlock
                                    layer={proChartView.ganZhiLayer}
                                    onOpenDetails={handleOpenGanZhiVisual}
                                    detailsColor={Colors.bazi.chromeTextActive}
                                    styles={styles}
                                />
                            </View>
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

function splitMatrixLines(value: string): string[] {
    const lines = value.split(/\n|\s+/).map((item) => item.trim()).filter(Boolean);
    return lines.length > 0 ? lines : ['—'];
}

const OverviewOriginChart: React.FC<{
    rows: BaziPillarMatrixRow[];
    styles: ReturnType<typeof makeStyles>;
    Colors: any;
}> = ({ rows, styles, Colors }) => {
    const mainStars = getPillarMatrixValues(rows, 'mainStar');
    const tianGan = getPillarMatrixValues(rows, 'tianGan');
    const diZhi = getPillarMatrixValues(rows, 'diZhi');
    const cangGan = getPillarMatrixValues(rows, 'cangGan');
    const railRows: Array<{ key: BaziPillarMatrixRow['key']; label: string }> = [
        { key: 'xingYun', label: '星运' },
        { key: 'ziZuo', label: '自坐' },
        { key: 'naYin', label: '纳音' },
    ];
    const extraRows: Array<{ key: BaziPillarMatrixRow['key']; label: string }> = [
        { key: 'subStar', label: '副星' },
        { key: 'kongWang', label: '空亡' },
        { key: 'shenSha', label: '神煞' },
    ];
    const knownKeys = new Set<string>([
        'mainStar', 'tianGan', 'diZhi', 'cangGan',
        ...railRows.map((row) => row.key),
        ...extraRows.map((row) => row.key),
    ]);
    const additionalRows = rows.filter((row) => !knownKeys.has(row.key));

    return (
        <OverviewSection title="四柱原局" showHeader={false} flushBottom styles={styles}>
            <View style={styles.originPillarGrid}>
                {['年柱', '月柱', '日柱', '时柱'].map((label, index) => (
                    <View key={label} style={[styles.originPillar, index > 0 && styles.originPillarDivider, index === 2 && styles.originPillarDayMaster]}>
                        {index === 2 ? <Text style={styles.originDayMarker}>日主</Text> : null}
                        <Text style={styles.originPillarName}>{label}</Text>
                        <Text style={styles.originPillarStar}>{mainStars[index] || '—'}</Text>
                        <View style={styles.originGlyphStack}>
                            <Text style={[styles.originGlyph, { color: pickWuXingColor(tianGan[index], Colors) ?? Colors.text.primary }]}>{tianGan[index] || '—'}</Text>
                            <Text style={[styles.originGlyph, { color: pickWuXingColor(diZhi[index], Colors) ?? Colors.text.primary }]}>{diZhi[index] || '—'}</Text>
                        </View>
                        <View style={styles.originHiddenStems}>
                            {splitMatrixLines(cangGan[index]).map((line, lineIndex) => (
                                <Text key={`${label}-cang-${lineIndex}`} style={[styles.originHiddenStem, { color: pickWuXingColor(line, Colors) ?? Colors.text.secondary }]}>{line}</Text>
                            ))}
                        </View>
                    </View>
                ))}
            </View>

            <View style={styles.originRailStack}>
                {railRows.map((row) => {
                    const values = getPillarMatrixValues(rows, row.key);
                    return (
                        <View key={row.key} style={styles.originRail}>
                            <Text style={styles.originRailLabel}>{row.label}</Text>
                            {values.map((value, index) => {
                                const naYinColor = row.key === 'naYin' ? pickWuXingColor(value, Colors) : null;
                                return (
                                    <Text
                                        key={`${row.key}-${index}`}
                                        style={[styles.originRailValue, naYinColor ? { color: naYinColor } : null]}
                                    >
                                        {value || '—'}
                                    </Text>
                                );
                            })}
                        </View>
                    );
                })}
            </View>

            <View style={styles.originExtras}>
                {[...extraRows, ...additionalRows.map((row) => ({ key: row.key, label: row.label }))].map((row) => {
                    const values = getPillarMatrixValues(rows, row.key);
                    return (
                        <View key={row.key} style={styles.originExtraRow}>
                            <Text style={styles.originExtraLabel}>{row.label}</Text>
                            {values.map((value, index) => (
                                <View key={`${row.key}-${index}`} style={styles.originExtraCell}>
                                    {splitMatrixLines(value).map((line, lineIndex) => (
                                        <Text key={`${row.key}-${index}-${lineIndex}`} style={styles.originExtraText}>{line}</Text>
                                    ))}
                                </View>
                            ))}
                        </View>
                    );
                })}
            </View>
        </OverviewSection>
    );
};

const OverviewHero: React.FC<{
    name: string;
    mingZao: string;
    yinYang: string;
    solar: string;
    lunar: string;
    chartTime: string;
    chartTimeLabel: string;
    gender: string;
    zodiac: string;
    location: string;
    timeMode: string;
    compact?: boolean;
    styles: ReturnType<typeof makeStyles>;
}> = ({ name, mingZao, yinYang, solar, lunar, chartTime, chartTimeLabel, gender, zodiac, location, timeMode, compact = false, styles }) => (
    <View style={[styles.overviewHero, compact && styles.overviewHeroCompact]}>
        <View style={styles.overviewHeroMain}>
            <View style={styles.overviewNameBlock}>
                <Text style={[styles.overviewName, compact && styles.overviewNameCompact]}>{name || '未命名'}</Text>
            </View>
            <View style={styles.overviewDateGroup}>
                <Text style={styles.overviewIdentityLine}>阳历：{solar}</Text>
                <Text style={styles.overviewIdentityLine}>农历：{lunar}</Text>
                <Text style={styles.overviewIdentityTime}>{chartTimeLabel}：{chartTime}</Text>
            </View>
        </View>
        <View style={styles.overviewIdentitySide}>
            <Text style={[styles.overviewMingZao, compact && styles.overviewMingZaoCompact]}>{mingZao || '—'}</Text>
            <Text style={styles.overviewIdentityMeta}>{gender} · {zodiac} · {location || '未设置'}</Text>
            <Text style={styles.overviewIdentityMeta}>{yinYang} · {mingZao} · {timeMode}</Text>
        </View>
    </View>
);

const BaziAnalysisReferenceStrip: React.FC<{
    profile: BaziAnalysisProfile;
    styles: ReturnType<typeof makeStyles>;
    Colors: any;
}> = ({ profile, styles, Colors }) => {
    const items = [
        { label: '日主属性', value: profile.summary.dayMasterProperty },
        { label: '阴阳参考', value: profile.summary.yinYangReference },
        { label: '旺衰参考', value: profile.summary.strengthReference },
        { label: '格局参考', value: profile.summary.structureReference },
    ];
    const dayMasterColor = pickWuXingColor(profile.dayMasterElement, Colors);

    return (
        <View style={styles.analysisReferenceStrip} accessibilityLabel="书房派与盲派命盘参考">
            {items.map((item, index) => (
                <View key={item.label} style={[styles.analysisReferenceItem, index === 0 && styles.analysisReferenceItemFirst]}>
                    <Text style={styles.analysisReferenceLabel} numberOfLines={1}>{item.label}</Text>
                    <Text
                        style={[styles.analysisReferenceValue, item.label === '日主属性' && dayMasterColor ? { color: dayMasterColor } : null]}
                        numberOfLines={2}
                    >
                        {item.value}
                    </Text>
                </View>
            ))}
        </View>
    );
};

const OverviewSection: React.FC<{
    title: string;
    children: React.ReactNode;
    showHeader?: boolean;
    flushBottom?: boolean;
    styles: ReturnType<typeof makeStyles>;
}> = ({ title, children, showHeader = true, flushBottom = false, styles }) => (
    <View style={[styles.overviewSection, !showHeader && styles.overviewSectionWithoutHeader, flushBottom && styles.overviewSectionFlush]}>
        {showHeader ? (
            <View style={styles.overviewSectionHeader}>
                <View style={styles.overviewSectionTitleWrap}>
                    <View style={styles.overviewSectionMarker} />
                    <Text style={styles.overviewSectionTitle}>{title}</Text>
                </View>
            </View>
        ) : null}
        {children}
    </View>
);

const DetailTile: React.FC<{
    label: string;
    value: string;
    styles: ReturnType<typeof makeStyles>;
}> = ({ label, value, styles }) => (
    <View style={styles.detailTile}>
        <Text style={styles.detailTileLabel} numberOfLines={1}>{label}</Text>
        <Text style={styles.detailTileValue} numberOfLines={2}>{value || '—'}</Text>
    </View>
);

function splitTimelineDateTime(value: string): { date: string; time: string } {
    const match = value.trim().match(/^(.*?)(?:\s+)(\d{1,2}:\d{2}(?::\d{2})?)$/);
    if (!match) {
        return { date: value, time: '' };
    }
    return { date: match[1], time: match[2] };
}

const JieQiTimeline: React.FC<{
    result: BaziResult;
    chartTimeDisplay: string;
    privacyEnabled: boolean;
    styles: ReturnType<typeof makeStyles>;
}> = ({ result, chartTimeDisplay, privacyEnabled, styles }) => {
    const items: Array<{ label: string; dateTime: string; kind: 'term' | 'current' | 'birth' }> = [
        { label: result.jieQiContext.prevTerm.name, dateTime: result.jieQiContext.prevTerm.dateTime, kind: 'term' },
        { label: result.jieQiContext.currentTerm.name, dateTime: result.jieQiContext.currentTerm.dateTime, kind: 'current' },
        { label: '出生', dateTime: chartTimeDisplay, kind: 'birth' },
        { label: result.jieQiContext.nextTerm.name, dateTime: result.jieQiContext.nextTerm.dateTime, kind: 'term' },
    ];
    return (
        <OverviewSection title="节气坐标" showHeader={false} styles={styles}>
            <View style={styles.jieQiTimeline}>
                <View style={styles.jieQiLine} />
                <View style={styles.jieQiProgress} />
                {items.map((item, index) => (
                    <View
                        key={`${item.label}-${index}`}
                        style={[
                            styles.jieQiNode,
                            index === 0 && styles.jieQiNodePrev,
                            index === 1 && styles.jieQiNodeCurrent,
                            index === 2 && styles.jieQiNodeBirth,
                            index === 3 && styles.jieQiNodeNext,
                        ]}
                    >
                        <Text style={[styles.jieQiName, item.kind === 'birth' && styles.jieQiNameBirth, item.kind === 'current' && styles.jieQiNameCurrent]}>{item.label}</Text>
                        {(() => {
                            const dateTime = privacyEnabled && item.kind !== 'birth' ? maskVisibleText(item.dateTime) : item.dateTime;
                            const parts = splitTimelineDateTime(dateTime);
                            return (
                                <>
                                    <Text style={styles.jieQiDate}>{parts.date}</Text>
                                    {parts.time ? <Text style={styles.jieQiTime}>{parts.time}</Text> : null}
                                </>
                            );
                        })()}
                        <View style={[styles.jieQiDot, item.kind === 'birth' && styles.jieQiDotBirth, item.kind === 'current' && styles.jieQiDotCurrent]} />
                    </View>
                ))}
                <View style={styles.birthContext}>
                    <Text style={styles.birthContextText}>{result.jieQiContext.currentTerm.name}后 {result.jieQiContext.afterPrev} · {result.jieQiContext.nextTerm.name}前 {result.jieQiContext.beforeNext}</Text>
                    <Text style={styles.birthContextDuty}>{privacyEnabled ? maskVisibleText(result.baseInfo.renYuanDutyDetail.display || result.baseInfo.renYuanDuty) : (result.baseInfo.renYuanDutyDetail.display || result.baseInfo.renYuanDuty)}</Text>
                </View>
            </View>
        </OverviewSection>
    );
};

const WuXingOverview: React.FC<{
    energy: BaziWuXingEnergySnapshot | null;
    error: string;
    metric: EnergyMetric;
    onMetricChange: (metric: EnergyMetric) => void;
    styles: ReturnType<typeof makeStyles>;
    Colors: any;
}> = ({ energy, error, metric, onMetricChange, styles, Colors }) => {
    const tabs: Array<{ key: EnergyMetric; label: string }> = [
        { key: 'energy', label: '五行能量' },
        { key: 'direct', label: '五行个数' },
        { key: 'hidden', label: '含藏干数' },
    ];
    const getColor = (value: string) => pickWuXingColor(value, Colors) ?? Colors.text.primary;

    return (
        <OverviewSection title="五行态势" showHeader={false} styles={styles}>
            {energy ? (
                <View style={styles.partyBalance}>
                    <Text style={styles.partyLabel}>同党</Text>
                    <View style={styles.partyTrack}>
                        <View style={[styles.partySegment, styles.partySame, { width: `${energy.samePartyPercentage}%` }]}>
                            <Text style={styles.partySegmentText}>{energy.samePartyPercentage}%</Text>
                        </View>
                        <View style={[styles.partySegment, styles.partyDifferent, { width: `${energy.differentPartyPercentage}%` }]}>
                            <Text style={styles.partySegmentText}>{energy.differentPartyPercentage}%</Text>
                        </View>
                    </View>
                    <Text style={styles.partyLabel}>异党</Text>
                </View>
            ) : null}
            <View style={styles.metricTabs}>
                {tabs.map((tab) => (
                    <Pressable
                        key={tab.key}
                        style={({ pressed }) => [styles.metricTab, metric === tab.key && styles.metricTabActive, pressed && styles.pressed]}
                        onPress={() => onMetricChange(tab.key)}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: metric === tab.key }}
                    >
                        <Text style={[styles.metricTabText, metric === tab.key && styles.metricTabTextActive]}>{tab.label}</Text>
                    </Pressable>
                ))}
            </View>
            {!energy ? (
                <View style={styles.energyError}>
                    <Text style={styles.energyErrorTitle}>五行综合能量计算失败</Text>
                    <Text style={styles.energyErrorText}>{error || '命盘数据不完整'}</Text>
                </View>
            ) : (
                <>
                    <View style={styles.energyList}>
                        {energy.elements.map((item) => {
                            const value = metric === 'energy' ? item.percentage : metric === 'direct' ? item.directCount : item.withHiddenCount;
                            const max = metric === 'energy' ? 100 : Math.max(...energy.elements.map((element) => metric === 'direct' ? element.directCount : element.withHiddenCount), 1);
                            return (
                                <View key={item.element} style={styles.energyRow}>
                                    <Text style={[styles.energyElement, { color: getColor(item.element) }]}>{item.element}</Text>
                                    <View style={styles.energyTrack}>
                                        <View style={[styles.energyFill, { width: `${Math.max((value / max) * 100, value > 0 ? 5 : 0)}%`, backgroundColor: getColor(item.element) }]} />
                                    </View>
                                    <View style={styles.energyValueWrap}>
                                        <Text style={styles.energyValue}>{value}{metric === 'energy' ? '%' : '个'}</Text>
                                        <Text style={styles.energyMeta}>{item.seasonStatus} · {item.tenGodGroup}</Text>
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                    <Text style={styles.energyScopeNote}>
                        综合干支、藏干、宫位、岁运、刑冲合害与神煞活跃度
                        {energy.omittedSources.length > 0 ? `\n未计入缺失来源：${energy.omittedSources.join('、')}` : ''}
                    </Text>
                    <View style={styles.qiYunBand} accessibilityLabel="月令旺衰">
                        {energy.elements.map((item) => (
                            <View key={`${item.element}-${item.seasonStatus}`} style={styles.qiYunBandCell}>
                                <Text style={[styles.qiYunBandText, { color: getColor(item.element) }]}>{item.element}{item.seasonStatus}</Text>
                                <View style={[styles.qiYunDot, { borderColor: getColor(item.element) }]} />
                            </View>
                        ))}
                    </View>
                </>
            )}
        </OverviewSection>
    );
};

const SectionTab: React.FC<{ label: string; active: boolean; onPress: () => void; styles: ReturnType<typeof makeStyles>; }> = ({ label, active, onPress, styles }) => (
    <Pressable
        style={({ pressed }) => [styles.compactTabBtn, active && styles.compactTabBtnActive, pressed && styles.pressed]}
        onPress={onPress}
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
    >
        <Text style={[styles.compactTabText, active && styles.compactTabTextActive]}>{label}</Text>
    </Pressable>
);

const OverviewJourney: React.FC<{
    result: BaziResult;
    privacyEnabled: boolean;
    styles: ReturnType<typeof makeStyles>;
}> = ({ result, privacyEnabled, styles }) => {
    const qiYun = `${result.childLimit.years}年${result.childLimit.months}月${result.childLimit.days}天${result.childLimit.hours}时${result.childLimit.minutes}分`;
    const jiaoYun = privacyEnabled ? maskVisibleText(result.childLimit.jiaoYunDateTime) : result.childLimit.jiaoYunDateTime;
    const timeMode = timeModeLabel(result.schoolOptionsResolved.timeMode);
    const ziHourMode = ziHourModeLabel(result.schoolOptionsResolved.ziHourMode);
    const daylightSaving = daylightSavingLabel(result.schoolOptionsResolved.daylightSaving);
    return (
        <View style={styles.journeyBlock}>
            <View style={styles.journeyBand}>
                <View style={styles.journeyItem}>
                    <Text style={styles.journeyLabel}>起运</Text>
                    <Text style={[styles.journeyValue, styles.journeyValueStart]} numberOfLines={1}>{qiYun}</Text>
                </View>
                <View style={[styles.journeyItem, styles.journeyItemLast]}>
                    <Text style={styles.journeyLabel}>交运</Text>
                    <Text style={[styles.journeyValue, styles.journeyValueEnd]} numberOfLines={1}>{jiaoYun}</Text>
                </View>
            </View>
            <View style={styles.schoolBand}>
                <View style={styles.schoolItem}>
                    <Text style={styles.schoolLabel}>排盘口径</Text>
                    <Text style={styles.schoolValue}>{timeMode}</Text>
                </View>
                <View style={styles.schoolItem}>
                    <Text style={styles.schoolLabel}>子时口径</Text>
                    <Text style={styles.schoolValue}>{ziHourMode}</Text>
                </View>
                <View style={styles.schoolItem}>
                    <Text style={styles.schoolLabel}>夏令时</Text>
                    <Text style={styles.schoolValue}>{daylightSaving}</Text>
                </View>
            </View>
        </View>
    );
};

const ChartHeaderStrip: React.FC<{
    name: string;
    solarText: string;
    lunarText: string;
    mingZaoText: string;
    panelMode: BaziPanelMode;
    showPanelSwitch: boolean;
    onTogglePanelMode: () => void;
    styles: ReturnType<typeof makeStyles>;
}> = ({
    name,
    solarText,
    lunarText,
    mingZaoText,
    panelMode,
    showPanelSwitch,
    onTogglePanelMode,
    styles,
}) => (
        <View style={styles.chartHeaderStrip}>
            <View style={styles.chartHeaderMain}>
                <Text style={styles.chartHeaderName}>{name}</Text>
                <Text style={styles.chartHeaderLine} numberOfLines={1}>{solarText}</Text>
                <Text style={styles.chartHeaderLine} numberOfLines={1}>{lunarText}</Text>
            </View>
            <View style={styles.chartHeaderSide}>
                {showPanelSwitch ? (
                    <View style={styles.chartHeaderActions}>
                        <PanelModeSwitch panelMode={panelMode} onToggle={onTogglePanelMode} styles={styles} />
                    </View>
                ) : null}
                <Text style={styles.chartHeaderMingZao}>{mingZaoText}</Text>
            </View>
        </View>
    );

const PanelModeSwitch: React.FC<{
    panelMode: BaziPanelMode;
    onToggle: () => void;
    styles: ReturnType<typeof makeStyles>;
}> = ({ panelMode, onToggle, styles }) => (
    <Pressable
        style={[styles.panelSwitch, panelMode === 'taiming' && styles.panelSwitchActive]}
        onPress={onToggle}
        accessibilityRole="switch"
        accessibilityState={{ checked: panelMode === 'taiming' }}
    >
        <View style={[styles.panelSwitchThumb, panelMode === 'taiming' && styles.panelSwitchThumbActive]} />
        <View style={styles.panelSwitchTextRow}>
            <Text
                style={[
                    styles.panelSwitchLabel,
                    panelMode === 'fortune' && styles.panelSwitchLabelActive,
                ]}
            >
                流年大运
            </Text>
            <Text
                style={[
                    styles.panelSwitchLabel,
                    panelMode === 'taiming' && styles.panelSwitchLabelActive,
                ]}
            >
                胎命身
            </Text>
        </View>
    </Pressable>
);

const DenseMatrix: React.FC<{
    headerLabels: string[];
    rows: ProChartRowView[];
    styles: ReturnType<typeof makeStyles>;
}> = ({ headerLabels, rows, styles }) => (
    <View style={styles.proMatrixSurface}>
        <View style={styles.proMatrixDenseHeadRow}>
            <Text style={[styles.proMatrixDenseHeadLabelCell, styles.proMatrixDenseLabelCell]}>日期</Text>
            {headerLabels.map((label) => (
                <Text key={`head-${label}`} style={styles.proMatrixDenseHeadCell}>{label}</Text>
            ))}
        </View>
        {rows.map((row) => {
            const isLabelRow = row.density === 'label';
            const isSymbolRow = row.density === 'symbol';
            const isStackedRow = row.density === 'stacked';
            return (
                <View key={row.key} style={styles.proMatrixDenseRow}>
                    <Text style={[styles.proMatrixDenseLabel, styles.proMatrixDenseLabelCell]}>{row.label}</Text>
                    {row.cells.map((cell, index) => (
                        <View
                            key={`${row.key}-${index}`}
                            style={[
                                styles.proMatrixDenseCell,
                                isStackedRow && styles.proMatrixDenseStackedCell,
                            ]}
                        >
                            {cell.primary ? (
                                <Text
                                    style={[
                                        styles.proMatrixDensePrimary,
                                        isLabelRow && styles.proMatrixDenseLabelPrimary,
                                        isSymbolRow && styles.proMatrixDenseSymbolPrimary,
                                        cell.colorized ? { color: pickWuXingColor(cell.primary) ?? styles.proMatrixDensePrimary.color } : null,
                                    ]}
                                >
                                    {cell.primary}
                                </Text>
                            ) : null}
                            {cell.secondary ? (
                                <Text style={styles.proMatrixDenseSecondary}>{cell.secondary}</Text>
                            ) : null}
                            {cell.lines?.map((line, lineIndex) => (
                                <Text
                                    key={`${row.key}-${index}-${line}-${lineIndex}`}
                                    style={[
                                        styles.proMatrixDenseLine,
                                        row.key === 'shenSha' && styles.proMatrixDenseShenShaLine,
                                        row.key === 'cangGan' && styles.proMatrixDenseCangGanLine,
                                        cell.colorized ? { color: pickWuXingColor(line) ?? styles.proMatrixDenseLine.color } : null,
                                    ]}
                                >
                                    {line}
                                </Text>
                            ))}
                        </View>
                    ))}
                </View>
            );
        })}
    </View>
);

const DualInfoStrip: React.FC<{
    infoStrip: ReturnType<typeof buildBaziProChartViewModel>['infoStrip'];
    styles: ReturnType<typeof makeStyles>;
}> = ({ infoStrip, styles }) => {
    const renYuanColor = pickWuXingColor(infoStrip.renYuanShortText);
    return (
        <View style={styles.infoBand}>
            <View style={styles.infoBandRow}>
                <View style={styles.infoBandItem}>
                    <Text style={styles.infoBandValue}>{infoStrip.startText}</Text>
                </View>
                <View style={[styles.infoBandItem, styles.infoBandItemRight]}>
                    <Text style={[styles.infoBandValue, styles.infoBandValueRight]}>{infoStrip.ageText}</Text>
                </View>
            </View>
            <View style={styles.infoBandRow}>
                <View style={styles.infoBandItem}>
                    <Text style={styles.infoBandValue}>{infoStrip.changeText}</Text>
                </View>
                <View style={[styles.infoBandItem, styles.infoBandItemRight]}>
                    <Text style={[styles.infoBandValue, styles.infoBandValueRight]}>
                        <Text style={styles.infoBandValue}>人元司令：</Text>
                        <Text style={renYuanColor ? { color: renYuanColor } : null}>
                            {infoStrip.renYuanShortText}
                        </Text>
                    </Text>
                </View>
            </View>
        </View>
    );
};

const PersistBanner: React.FC<{
    message: string;
    onPress: () => void;
    styles: ReturnType<typeof makeStyles>;
}> = ({ message, onPress, styles }) => (
    <Pressable style={({ pressed }) => [styles.persistBanner, pressed && styles.pressed]} onPress={onPress}>
        <Text style={styles.persistBannerText}>{message}</Text>
    </Pressable>
);

const DenseTrackMatrix: React.FC<{
    rowLabel: string;
    columns: DenseTrackCellView[];
    onSelect: (cell: DenseTrackCellView) => void;
    styles: ReturnType<typeof makeStyles>;
}> = ({ rowLabel, columns, onSelect, styles }) => {
    if (columns.length === 0) {
        return <Text style={styles.emptyHint}>无</Text>;
    }
    return (
        <View style={styles.trackWrap}>
            <View style={styles.trackLeft}>
                <Text style={styles.trackLeftText}>{rowLabel}</Text>
            </View>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.trackRow}
                accessibilityLabel={`${rowLabel}轨道，可左右滑动查看更多`}
            >
                {columns.map((column) => {
                    const primaryColor = pickWuXingColor(column.primaryText);
                    const secondaryColor = pickWuXingColor(column.secondaryText);
                    return (
                        <Pressable
                            key={column.key}
                            style={({ pressed }) => [
                                styles.trackColumn,
                                column.active && styles.trackColumnActive,
                                pressed && column.selectable && styles.pressed,
                            ]}
                            onPress={() => onSelect(column)}
                            disabled={!column.selectable}
                            accessibilityRole="button"
                            accessibilityState={{ selected: column.active, disabled: !column.selectable }}
                        >
                            <Text style={[styles.trackTop, column.active && styles.trackActiveText]}>{column.topLabel}</Text>
                            <Text style={[styles.trackSub, column.active && styles.trackActiveText]}>{column.subLabel}</Text>
                            <Text style={[styles.trackPrimary, primaryColor ? { color: primaryColor } : null]}>{column.primaryText}</Text>
                            <Text style={[styles.trackSecondary, secondaryColor ? { color: secondaryColor } : null]}>{column.secondaryText}</Text>
                            {column.tertiaryText ? <Text style={styles.trackTertiary}>{column.tertiaryText}</Text> : null}
                            {column.isCurrent ? <Text style={styles.currentTag}>当前</Text> : null}
                        </Pressable>
                    );
                })}
            </ScrollView>
        </View>
    );
};

const LayerStarBlock: React.FC<{ title: string; rows: string[]; styles: ReturnType<typeof makeStyles>; }> = ({ title, rows, styles }) => (
    <View style={styles.layerBlock}>
        <Text style={styles.layerTitle}>{title}</Text>
        {rows.length === 0 ? (
            <Text style={styles.emptyHint}>无</Text>
        ) : rows.map((row) => (
            <Text key={`${title}-${row}`} style={styles.layerRow}>{row}</Text>
        ))}
    </View>
);

const GanZhiLayerBlock: React.FC<{
    layer: ReturnType<typeof buildBaziProChartViewModel>['ganZhiLayer'];
    onOpenDetails: () => void;
    detailsColor: string;
    styles: ReturnType<typeof makeStyles>;
}> = ({ layer, onOpenDetails, detailsColor, styles }) => {
    const rows: Array<{ label: string; value: string }> = [
        { label: '岁运天干：', value: layer.suiYunTianGan },
        { label: '岁运地支：', value: layer.suiYunDiZhi },
        { label: '岁运整柱：', value: layer.suiYunZhengZhu },
        { label: '原局天干：', value: layer.yuanJuTianGan },
        { label: '原局地支：', value: layer.yuanJuDiZhi },
        { label: '原局整柱：', value: layer.yuanJuZhengZhu },
    ];

    return (
        <View style={[styles.layerBlock, styles.ganZhiLayerBlock]}>
            {rows.map((row, index) => (
                <React.Fragment key={row.label}>
                    {index === 3 ? <View style={styles.ganZhiLayerDivider} /> : null}
                    <View style={styles.ganZhiLayerRow}>
                        <Text style={styles.ganZhiLayerLabel}>{row.label}</Text>
                        <Text style={styles.ganZhiLayerValue}>{row.value}</Text>
                    </View>
                </React.Fragment>
            ))}
            <View style={styles.ganZhiVisualEntryWrap}>
                <Pressable
                    style={({ pressed }) => [styles.ganZhiVisualEntry, pressed && styles.ganZhiVisualEntryPressed]}
                    onPress={onOpenDetails}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="打开干支详情"
                >
                    <Text style={styles.ganZhiVisualEntryText}>干支详情</Text>
                    <ChevronRightIcon size={14} color={detailsColor} />
                </Pressable>
            </View>
        </View>
    );
};

const makeStyles = (Colors: any, viewportWidth: number = 862) => {
    const boundedWidth = Math.min(862, Math.max(320, viewportWidth));
    const fluid = (min: number, max: number): number => Math.round(min + ((boundedWidth - 320) / 542) * (max - min));
    const gutter = fluid(17, 37);
    const railLabelWidth = fluid(58, 81);
    const sectionPadding = fluid(24, 33);
    const sectionHeadingSize = fluid(21, 29);
    const overviewHeroMinHeight = fluid(134, 157);
    const overviewHeroPadding = fluid(20, 26);
    const overviewNameSize = fluid(18, 25);
    const overviewMingZaoSize = fluid(26, 39);
    const pillarNameSize = fluid(16, 22);
    const pillarStarSize = fluid(15, 20);
    const pillarGlyphSize = fluid(37, 55);
    const hiddenStemMinHeight = fluid(78, 101);
    const railHeight = fluid(42, 50);
    const metricTabHeight = fluid(47, 62);
    const partyTrackHeight = fluid(25, 36);
    const timelineHeight = fluid(140, 162);
    const timelinePointWidth = fluid(86, 129);
    const journeyHeight = fluid(68, 82);
    const schoolHeight = fluid(62, 76);
    return StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.bazi.pageBg },
    shell: {
        position: 'relative',
        flex: 1,
        width: '100%',
        maxWidth: 862,
        alignSelf: 'center',
        overflow: 'hidden',
        backgroundColor: Colors.bazi.surfacePrimary,
        borderLeftWidth: StyleSheet.hairlineWidth,
        borderRightWidth: StyleSheet.hairlineWidth,
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
    missingActions: {
        flexDirection: 'row',
        gap: Spacing.sm,
    },
    missingBtn: {
        flex: 1,
        minHeight: 44,
        borderRadius: BorderRadius.md,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: Spacing.md,
    },
    missingBtnPrimary: {
        backgroundColor: Colors.bazi.trackActiveBorder,
    },
    missingBtnSecondary: {
        borderWidth: 1,
        borderColor: Colors.border.subtle,
        backgroundColor: Colors.bg.elevated,
    },
    missingBtnText: {
        fontSize: FontSize.sm,
        fontWeight: '600',
    },
    missingBtnPrimaryText: {
        color: Colors.text.inverse,
    },
    missingBtnSecondaryText: {
        color: Colors.text.primary,
    },
    compactHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.xs,
        paddingVertical: Spacing.xs,
        height: 48,
        gap: 4,
        backgroundColor: Colors.bg.primary,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border.subtle,
    },
    headerBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
    headerBtnDisabled: { opacity: 0.45 },
    compactTabsRow: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        marginHorizontal: 4,
    },
    compactTabBtn: {
        flex: 1,
        height: 32,
        borderRadius: BorderRadius.md,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
    },
    compactTabBtnActive: { backgroundColor: 'rgba(191,203,231,0.48)' },
    compactTabText: { color: Colors.text.secondary, fontSize: FontSize.xs, fontWeight: '500' },
    compactTabTextActive: { color: Colors.text.heading, fontWeight: '700' },
    aiCompactBtn: {
        height: 32,
        paddingHorizontal: 8,
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.accent.gold,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 4,
    },
    aiCompactBtnDisabled: {
        opacity: 0.45,
    },
    aiCompactBtnText: {
        fontSize: FontSize.xs,
        color: Colors.text.inverse,
        fontWeight: '700',
    },
    content: { flex: 1 },
    contentContainer: { width: '100%', alignItems: 'center', paddingBottom: 0 },
    pageSurface: { width: '100%', maxWidth: 862, backgroundColor: Colors.bazi.pageBg, paddingBottom: 0 },
    overviewHero: {
        minHeight: overviewHeroMinHeight,
        flexDirection: 'row',
        alignItems: 'stretch',
        paddingHorizontal: gutter,
        paddingVertical: overviewHeroPadding,
        backgroundColor: Colors.bazi.heroBg,
        borderBottomWidth: 1,
        borderBottomColor: Colors.bazi.heroBorder,
        gap: Spacing.md,
    },
    overviewHeroCompact: {
        minHeight: overviewHeroMinHeight,
        paddingVertical: overviewHeroPadding,
        gap: Spacing.sm,
    },
    overviewHeroMain: { flex: 1, minWidth: 0, justifyContent: 'center' },
    overviewNameBlock: { gap: 1 },
    overviewName: { color: Colors.bazi.heroTitle, fontSize: overviewNameSize, lineHeight: fluid(24, 32), fontWeight: '700', letterSpacing: 1 },
    overviewNameCompact: { fontSize: fluid(18, 22), lineHeight: fluid(23, 28), letterSpacing: 0.5 },
    overviewIdentitySide: { width: '38%', minWidth: fluid(142, 293), maxWidth: 293, justifyContent: 'center', alignItems: 'flex-end', gap: fluid(7, 10) },
    overviewMingZao: { color: Colors.bazi.selectedText, fontSize: overviewMingZaoSize, lineHeight: fluid(32, 45), fontWeight: '700' },
    overviewMingZaoCompact: { fontSize: fluid(25, 33), lineHeight: fluid(30, 38) },
    overviewIdentityMeta: { maxWidth: '100%', color: Colors.bazi.heroMeta, fontSize: 12, lineHeight: 17, textAlign: 'right', flexShrink: 1 },
    overviewDateGroup: { gap: 5, marginTop: 11 },
    overviewIdentityLine: { color: Colors.bazi.heroText, fontSize: FontSize.sm, lineHeight: 20, flexShrink: 1 },
    overviewIdentityTime: { color: Colors.bazi.heroMeta, fontSize: 12, lineHeight: 18, fontVariant: ['tabular-nums'] },
    overviewSection: {
        width: '100%',
        paddingHorizontal: gutter,
        paddingTop: sectionPadding,
        paddingBottom: sectionPadding,
        marginHorizontal: 0,
        marginTop: 0,
        borderBottomWidth: 1,
        borderBottomColor: Colors.bazi.divider,
        backgroundColor: Colors.bazi.surfacePrimary,
    },
    overviewSectionWithoutHeader: { paddingTop: fluid(12, 18) },
    overviewSectionFlush: { paddingBottom: 0 },
    overviewSectionHeader: { minHeight: 0, marginBottom: fluid(20, 26), flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: Spacing.sm, paddingHorizontal: 0, paddingVertical: 0 },
    overviewSectionTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: 0, minWidth: 0, flexShrink: 1 },
    overviewSectionMarker: { width: 0, height: 0 },
    overviewSectionTitle: { color: Colors.bazi.chromeTextActive, fontSize: sectionHeadingSize, lineHeight: fluid(27, 36), fontWeight: '700', letterSpacing: 1, flexShrink: 1 },
    originPillarGrid: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.bazi.divider },
    originPillar: { position: 'relative', flex: 1, minWidth: 0, alignItems: 'center', paddingHorizontal: 3, paddingTop: fluid(42, 57), paddingBottom: fluid(18, 24) },
    originPillarDivider: { borderLeftWidth: 1, borderLeftColor: Colors.bazi.divider },
    originPillarDayMaster: { backgroundColor: Colors.bazi.surfaceMuted, borderTopWidth: 2, borderTopColor: Colors.bazi.selectedBorder },
    originDayMarker: { position: 'absolute', top: -14, paddingHorizontal: 7, color: Colors.bazi.selectedText, fontSize: 12, backgroundColor: Colors.bazi.surfacePrimary },
    originPillarName: { color: Colors.text.tertiary, fontSize: pillarNameSize, lineHeight: fluid(21, 27), fontWeight: '600' },
    originPillarStar: { marginTop: fluid(18, 25), color: Colors.text.secondary, fontSize: pillarStarSize, textAlign: 'center' },
    originGlyphStack: { alignItems: 'center', gap: fluid(4, 6), marginTop: fluid(17, 23) },
    originGlyph: { fontSize: pillarGlyphSize, lineHeight: fluid(39, 58), fontWeight: '700' },
    originHiddenStems: { minHeight: hiddenStemMinHeight, alignItems: 'center', gap: 3, marginTop: fluid(16, 21) },
    originHiddenStem: { fontSize: fluid(12, 18), lineHeight: fluid(15, 22), fontWeight: '600', textAlign: 'center' },
    originRailStack: { borderBottomWidth: 1, borderBottomColor: Colors.bazi.divider },
    originRail: { minHeight: railHeight, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.bazi.divider },
    originRailLabel: { width: railLabelWidth, color: Colors.text.tertiary, fontSize: FontSize.sm, fontWeight: '600' },
    originRailValue: { flex: 1, minWidth: 0, color: Colors.text.secondary, fontSize: fluid(13, 18), lineHeight: fluid(17, 23), textAlign: 'center' },
    originExtras: { marginHorizontal: -gutter, marginTop: 0, paddingHorizontal: gutter, paddingTop: fluid(6, 9), paddingBottom: fluid(22, 28), backgroundColor: Colors.bazi.surfaceRaised },
    originExtraRow: { flexDirection: 'row', minHeight: fluid(44, 56), borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.bazi.divider },
    originExtraLabel: { width: railLabelWidth, paddingVertical: fluid(10, 16), color: Colors.text.tertiary, fontSize: fluid(12, 16), fontWeight: '600', textAlign: 'center', textAlignVertical: 'center' },
    originExtraCell: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', gap: 2, paddingHorizontal: 2, paddingVertical: fluid(10, 16) },
    originExtraText: { color: Colors.text.secondary, fontSize: fluid(10, 14), lineHeight: fluid(14, 18), textAlign: 'center' },
    analysisReferenceStrip: { width: '100%', flexDirection: 'row', backgroundColor: Colors.bazi.surfacePrimary, borderBottomWidth: 1, borderBottomColor: Colors.bazi.divider },
    analysisReferenceItem: { flex: 1, minWidth: 0, minHeight: fluid(62, 82), alignItems: 'center', justifyContent: 'center', paddingHorizontal: fluid(2, 7), paddingVertical: fluid(8, 12), borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: Colors.bazi.divider },
    analysisReferenceItemFirst: { borderLeftWidth: 0 },
    analysisReferenceLabel: { color: Colors.text.tertiary, fontSize: fluid(9, 14), lineHeight: fluid(13, 18), textAlign: 'center' },
    analysisReferenceValue: { marginTop: 4, color: Colors.bazi.selectedText, fontSize: fluid(10, 17), lineHeight: fluid(14, 22), fontWeight: '600', textAlign: 'center' },
    metricTabs: { flexDirection: 'row', marginTop: fluid(20, 28), borderTopWidth: 1, borderBottomWidth: 1, borderColor: Colors.bazi.divider },
    metricTab: { flex: 1, minHeight: metricTabHeight, alignItems: 'center', justifyContent: 'center' },
    metricTabActive: { borderBottomWidth: 2, borderBottomColor: Colors.bazi.selectedBorder },
    metricTabText: { color: Colors.text.tertiary, fontSize: FontSize.sm },
    metricTabTextActive: { color: Colors.bazi.selectedText, fontWeight: '700' },
    energyList: { paddingTop: 18, paddingBottom: 4, gap: 12 },
    energyRow: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    energyElement: { width: fluid(23, 30), fontSize: fluid(15, 20), fontWeight: '700' },
    energyTrack: { flex: 1, height: fluid(9, 12), borderRadius: 999, overflow: 'hidden', backgroundColor: Colors.bazi.surfaceMuted },
    energyFill: { height: '100%', borderRadius: 999 },
    energyValueWrap: { width: 90, alignItems: 'flex-end' },
    energyValue: { color: Colors.text.primary, fontSize: fluid(12, 17), fontWeight: '700' },
    energyMeta: { color: Colors.text.tertiary, fontSize: fluid(10, 13), marginTop: 1 },
    partyBalance: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    partyLabel: { color: Colors.text.secondary, fontSize: fluid(13, 18), fontWeight: '600' },
    partyTrack: { flex: 1, height: partyTrackHeight, flexDirection: 'row', overflow: 'hidden', borderRadius: 999, backgroundColor: Colors.bazi.surfaceMuted },
    partySegment: { height: '100%', alignItems: 'center', justifyContent: 'center', minWidth: 0 },
    partySegmentText: { color: Colors.text.heading, fontSize: 12, fontWeight: '600' },
    partySame: { backgroundColor: Colors.bazi.elementFire },
    partyDifferent: { backgroundColor: Colors.bazi.elementWater },
    energyScopeNote: { color: Colors.text.tertiary, fontSize: 11, lineHeight: 17, paddingTop: 16, textAlign: 'center' },
    energyError: { marginTop: Spacing.md, padding: Spacing.md, borderRadius: 8, borderWidth: 1, borderColor: Colors.bazi.warningBorder, backgroundColor: Colors.bazi.warningBg, gap: 4 },
    energyErrorTitle: { color: Colors.bazi.warningText, fontSize: FontSize.sm, fontWeight: '700' },
    energyErrorText: { color: Colors.bazi.warningText, fontSize: 12, lineHeight: 18 },
    jieQiTimeline: { minHeight: timelineHeight, position: 'relative', paddingTop: 0, paddingBottom: fluid(64, 76) },
    jieQiLine: { position: 'absolute', left: '5%', right: '6%', top: 62, height: 1, backgroundColor: Colors.bazi.divider },
    jieQiProgress: { position: 'absolute', left: '30%', top: 62, width: '28%', height: 1, backgroundColor: Colors.bazi.selectedBorder },
    jieQiNode: { position: 'absolute', top: 0, width: timelinePointWidth, minWidth: 0, alignItems: 'center', paddingHorizontal: 2, marginLeft: -timelinePointWidth / 2 },
    jieQiNodePrev: { left: '5%' },
    jieQiNodeCurrent: { left: '30%' },
    jieQiNodeBirth: { left: '58%' },
    jieQiNodeNext: { left: '94%' },
    jieQiName: { color: Colors.text.secondary, fontSize: fluid(13, 18), lineHeight: fluid(17, 23), textAlign: 'center' },
    jieQiNameCurrent: { color: Colors.bazi.selectedText, fontWeight: '700' },
    jieQiNameBirth: { color: Colors.bazi.selectedText, fontWeight: '700' },
    jieQiDate: { color: Colors.text.tertiary, fontSize: fluid(9, 12), lineHeight: fluid(13, 16), textAlign: 'center', marginTop: 2, fontVariant: ['tabular-nums'] },
    jieQiTime: { color: Colors.text.tertiary, fontSize: fluid(9, 12), lineHeight: fluid(13, 16), textAlign: 'center', fontVariant: ['tabular-nums'] },
    jieQiDot: { width: 10, height: 10, marginTop: 8, borderRadius: 5, borderWidth: 1, borderColor: Colors.text.tertiary, backgroundColor: Colors.bazi.surfacePrimary },
    jieQiDotCurrent: { width: 12, height: 12, marginTop: 7, borderWidth: 3, borderColor: Colors.bazi.selectedBg, backgroundColor: Colors.bazi.selectedBorder },
    jieQiDotBirth: { width: 12, height: 12, marginTop: 7, borderWidth: 1, borderColor: Colors.bazi.elementMetal, backgroundColor: Colors.bazi.elementMetal },
    birthContext: { position: 'absolute', top: 88, left: '33%', width: '50%', maxWidth: 380, alignItems: 'center' },
    birthContextText: { color: Colors.text.secondary, fontSize: fluid(11, 15), lineHeight: fluid(15, 22), textAlign: 'center' },
    birthContextDuty: { marginTop: 5, color: Colors.bazi.elementWood, fontSize: fluid(13, 18), lineHeight: fluid(18, 24), fontWeight: '600', textAlign: 'center' },
    detailGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingTop: 2, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.bazi.divider },
    detailTile: { width: '25%', minHeight: fluid(66, 108), paddingHorizontal: fluid(2, 9), paddingVertical: fluid(10, 19), borderLeftWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: Colors.bazi.divider },
    detailTileLabel: { color: Colors.text.tertiary, fontSize: fluid(10, 16), lineHeight: fluid(14, 21), textAlign: 'center' },
    detailTileValue: { marginTop: 5, color: Colors.text.primary, fontSize: fluid(12, 20), lineHeight: fluid(16, 26), fontWeight: '600', textAlign: 'center' },
    journeyBlock: { width: '100%', backgroundColor: Colors.bazi.pageBg },
    journeyBand: { minHeight: journeyHeight, marginHorizontal: 0, paddingHorizontal: gutter, flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bg.primary, borderBottomWidth: 1, borderBottomColor: Colors.bazi.divider },
    journeyItem: { width: '50%', minWidth: 0, minHeight: fluid(56, 64), flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: fluid(7, 15), borderBottomWidth: 0, borderBottomColor: Colors.bazi.divider },
    journeyItemLast: { justifyContent: 'flex-end' },
    journeyLabel: { color: Colors.bazi.selectedText, fontSize: fluid(14, 19), fontWeight: '700' },
    journeyValue: { flexShrink: 1, minWidth: 0, color: Colors.text.primary, fontSize: fluid(12, 19), lineHeight: fluid(18, 25), fontVariant: ['tabular-nums'] },
    journeyValueStart: { textAlign: 'left' },
    journeyValueEnd: { textAlign: 'right' },
    schoolBand: { minHeight: schoolHeight, marginHorizontal: 0, paddingHorizontal: gutter, flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bg.primary },
    schoolItem: { flex: 1, minWidth: 0, paddingHorizontal: 6, borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: Colors.bazi.divider },
    schoolLabel: { color: Colors.text.tertiary, fontSize: fluid(10, 14), textAlign: 'center' },
    schoolValue: { marginTop: 5, color: Colors.text.secondary, fontSize: fluid(11, 15), lineHeight: fluid(16, 20), textAlign: 'center' },
    proFlow: {
        marginHorizontal: 0,
        marginTop: 0,
        gap: 0,
    },
    chartHeaderStrip: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 12,
        backgroundColor: Colors.bazi.heroBg,
        borderBottomWidth: 1,
        borderBottomColor: Colors.bazi.heroBorder,
    },
    chartHeaderMain: {
        flex: 1,
        paddingRight: Spacing.md,
    },
    chartHeaderSide: {
        minWidth: 122,
        alignItems: 'flex-end',
        justifyContent: 'center',
    },
    chartHeaderActions: {
        flexDirection: 'row',
        gap: Spacing.xs,
        marginBottom: 8,
    },
    panelSwitch: {
        width: 118,
        height: 34,
        borderRadius: BorderRadius.round,
        backgroundColor: Colors.bazi.actionBg,
        borderWidth: 1,
        borderColor: Colors.bazi.actionBorder,
        justifyContent: 'center',
        overflow: 'hidden',
    },
    panelSwitchActive: {
        backgroundColor: Colors.bazi.actionBgActive,
        borderColor: Colors.bazi.chromeTextActive,
    },
    panelSwitchThumb: {
        position: 'absolute',
        left: 2,
        width: 50,
        height: 28,
        borderRadius: BorderRadius.round,
        backgroundColor: Colors.bg.card,
    },
    panelSwitchThumbActive: {
        left: 66,
    },
    panelSwitchTextRow: {
        flexDirection: 'row',
        alignItems: 'center',
        height: '100%',
    },
    panelSwitchLabel: {
        flex: 1,
        fontSize: 10,
        color: Colors.bazi.heroText,
        fontWeight: '600',
        zIndex: 1,
        textAlign: 'center',
    },
    panelSwitchLabelActive: {
        color: Colors.bazi.chromeTextActive,
    },
    chartHeaderName: {
        fontSize: FontSize.lg,
        color: Colors.bazi.heroTitle,
        fontWeight: '700',
        lineHeight: 24,
    },
    chartHeaderLine: {
        marginTop: 4,
        fontSize: FontSize.lg,
        color: Colors.bazi.heroText,
        lineHeight: 24,
    },
    chartHeaderMingZao: {
        fontSize: FontSize.lg,
        color: Colors.bazi.chromeTextActive,
        fontWeight: '700',
    },
    infoBand: {
        backgroundColor: Colors.bazi.surfacePrimary,
        borderTopWidth: 1,
        borderTopColor: Colors.bazi.chromeBorder,
        borderBottomWidth: 1,
        borderBottomColor: Colors.bazi.chromeBorder,
        paddingHorizontal: 10,
        paddingVertical: 8,
    },
    infoBandRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: Spacing.md,
    },
    infoBandItem: {
        flex: 1,
        minHeight: 22,
        justifyContent: 'center',
    },
    infoBandItemRight: {
        flex: 0,
        minWidth: 120,
        alignItems: 'flex-end',
    },
    infoBandValue: {
        fontSize: FontSize.sm,
        color: Colors.text.secondary,
        lineHeight: 18,
        fontWeight: '600',
    },
    infoBandValueRight: {
        textAlign: 'right',
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
    proMatrixSurface: {
        backgroundColor: Colors.bg.card,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border.subtle,
    },
    proMatrixDenseHeadRow: {
        flexDirection: 'row',
        backgroundColor: Colors.bg.elevated,
    },
    proMatrixDenseHeadLabelCell: {
        width: 40,
        minHeight: 38,
        textAlign: 'center',
        textAlignVertical: 'center',
        color: Colors.text.tertiary,
        fontSize: 16,
        paddingVertical: 6,
    },
    proMatrixDenseHeadCell: {
        flex: 1,
        minWidth: 0,
        minHeight: 38,
        textAlign: 'center',
        textAlignVertical: 'center',
        color: Colors.text.secondary,
        fontSize: 16,
        paddingVertical: 6,
    },
    proMatrixDenseLabelCell: {
        color: Colors.text.tertiary,
    },
    proMatrixDenseRow: {
        flexDirection: 'row',
        borderTopWidth: 1,
        borderTopColor: Colors.border.subtle,
    },
    proMatrixDenseLabel: {
        width: 40,
        minHeight: 46,
        textAlign: 'center',
        textAlignVertical: 'center',
        color: Colors.text.primary,
        fontSize: 16,
        paddingVertical: 5,
    },
    proMatrixDenseCell: {
        flex: 1,
        minWidth: 0,
        minHeight: 46,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 0,
        paddingVertical: 5,
    },
    proMatrixDenseStackedCell: {
        paddingVertical: 8,
    },
    proMatrixDensePrimary: {
        fontSize: 16,
        color: Colors.text.primary,
        fontWeight: '600',
    },
    proMatrixDenseLabelPrimary: {
        fontSize: 16,
        lineHeight: 22,
    },
    proMatrixDenseSymbolPrimary: {
        fontSize: 32,
        lineHeight: 36,
        fontWeight: '700',
    },
    proMatrixDenseSecondary: {
        fontSize: 12,
        color: Colors.text.tertiary,
        lineHeight: 15,
    },
    proMatrixDenseLine: {
        fontSize: 13,
        color: Colors.text.secondary,
        lineHeight: 16,
    },
    proMatrixDenseCangGanLine: {
        fontSize: 13,
        lineHeight: 16,
        fontWeight: '600',
    },
    proMatrixDenseShenShaLine: {
        fontSize: 12,
        lineHeight: 16,
        color: Colors.text.tertiary,
    },
    subTitle: {
        marginTop: Spacing.xs,
        fontSize: FontSize.md,
        color: Colors.text.heading,
        fontWeight: '600',
    },
    trackWrap: {
        flexDirection: 'row',
        borderTopWidth: 1,
        borderTopColor: Colors.border.subtle,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border.subtle,
    },
    trackLeft: {
        width: 38,
        backgroundColor: Colors.bg.elevated,
        alignItems: 'center',
        justifyContent: 'center',
        borderRightWidth: 1,
        borderRightColor: Colors.border.subtle,
    },
    trackLeftText: {
        fontSize: FontSize.lg,
        color: Colors.text.tertiary,
        fontWeight: '600',
        letterSpacing: 1,
    },
    trackRow: { gap: 0 },
    trackColumn: {
        width: 62,
        borderRightWidth: 1,
        borderRightColor: Colors.border.subtle,
        backgroundColor: Colors.bg.card,
        paddingVertical: 3,
        paddingHorizontal: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    trackColumnActive: {
        borderColor: Colors.bazi.trackActiveBorder,
        backgroundColor: Colors.bazi.trackActiveBg,
    },
    trackTop: { fontSize: FontSize.md, color: Colors.text.primary, fontWeight: '700', lineHeight: 18 },
    trackSub: { fontSize: 10, color: Colors.text.tertiary, lineHeight: 12 },
    trackPrimary: { fontSize: FontSize.md, color: Colors.text.primary, fontWeight: '700', lineHeight: 18 },
    trackSecondary: { fontSize: FontSize.md, color: Colors.text.secondary, fontWeight: '700', lineHeight: 18 },
    trackTertiary: { fontSize: 10, color: Colors.text.tertiary, lineHeight: 12, textAlign: 'center' },
    trackActiveText: { color: Colors.bazi.trackActiveText },
    currentTag: { color: Colors.bazi.trackActiveText, fontSize: FontSize.xs, fontWeight: '600' },
    proQiYunBand: {
        flexDirection: 'row',
        borderRadius: 0,
        overflow: 'hidden',
        backgroundColor: Colors.bazi.surfacePrimary,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border.subtle,
    },
    proQiYunBandCell: {
        flex: 1,
        minHeight: 30,
        position: 'relative',
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 4,
        borderRightWidth: 1,
        borderRightColor: Colors.border.subtle,
    },
    proQiYunBandCellLast: {
        borderRightWidth: 0,
    },
    proQiYunBandText: {
        fontSize: FontSize.sm,
        color: Colors.text.primary,
        fontWeight: '600',
    },
    qiYunBand: { flexDirection: 'row', marginTop: 24, borderBottomWidth: 1, borderBottomColor: Colors.bazi.divider },
    qiYunBandCell: {
        flex: 1,
        minHeight: 46,
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'flex-start',
        paddingBottom: 15,
    },
    qiYunBandText: {
        fontSize: FontSize.sm,
        color: Colors.text.secondary,
        fontWeight: '600',
    },
    qiYunDot: { position: 'absolute', bottom: -5, width: 9, height: 9, borderWidth: 1, borderRadius: 5, backgroundColor: Colors.bazi.surfacePrimary },
    sectionTitleBar: {
        backgroundColor: Colors.bg.elevated,
        borderTopWidth: 1,
        borderTopColor: Colors.border.subtle,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border.subtle,
        paddingHorizontal: Spacing.md,
        paddingVertical: 6,
    },
    ganZhiVisualEntryWrap: {
        alignItems: 'flex-end',
        paddingTop: Spacing.sm,
    },
    ganZhiVisualEntry: {
        minHeight: 32,
        paddingHorizontal: 10,
        borderRadius: BorderRadius.sm,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: Colors.bazi.actionBorder,
        backgroundColor: Colors.bazi.surfaceMuted,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
    },
    ganZhiVisualEntryPressed: {
        backgroundColor: Colors.bazi.actionBgActive,
        opacity: 0.86,
    },
    ganZhiVisualEntryText: {
        color: Colors.bazi.chromeTextActive,
        fontSize: FontSize.sm,
        fontWeight: '600',
    },
    layerBlock: {
        borderRadius: 0,
        borderWidth: 0,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border.subtle,
        backgroundColor: Colors.bg.card,
        paddingHorizontal: Spacing.md,
        paddingVertical: 8,
        gap: 3,
    },
    ganZhiLayerBlock: { borderBottomWidth: 0, paddingBottom: 0 },
    layerTitle: { fontSize: FontSize.sm, color: Colors.bazi.chromeTextActive, fontWeight: '600' },
    layerRow: { fontSize: FontSize.xs, color: Colors.text.secondary, lineHeight: 16 },
    ganZhiLayerRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: Spacing.xs,
    },
    ganZhiLayerLabel: {
        fontSize: FontSize.xs,
        color: Colors.text.tertiary,
        lineHeight: 18,
    },
    ganZhiLayerValue: {
        flex: 1,
        fontSize: FontSize.xs,
        color: Colors.text.secondary,
        lineHeight: 18,
    },
    ganZhiLayerDivider: {
        height: 1,
        backgroundColor: Colors.border.subtle,
        marginVertical: 6,
    },
    emptyHint: { fontSize: FontSize.xs, color: Colors.text.tertiary },
    pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
    });
};
