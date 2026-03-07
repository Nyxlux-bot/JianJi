import React, { useEffect, useMemo, useState } from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    AIIcon,
    BackIcon,
    EyeIcon,
    EyeOffIcon,
    MoreVerticalIcon,
} from '../../../src/components/Icons';
import AIChatModal from '../../../src/components/AIChatModal';
import ConfirmModal from '../../../src/components/ConfirmModal';
import { CustomAlert } from '../../../src/components/CustomAlertProvider';
import OverflowMenu, { OverflowMenuItem } from '../../../src/components/OverflowMenu';
import StatusBarDecor from '../../../src/components/StatusBarDecor';
import { useTheme } from '../../../src/theme/ThemeContext';
import { BorderRadius, FontSize, Spacing } from '../../../src/theme/colors';
import {
    BaziPillarMatrixRow,
    BaziResult,
} from '../../../src/core/bazi-types';
import { getBaziChartTimeLabel, getBaziTimeModeLabel } from '../../../src/core/bazi-time';
import { normalizeBaziResultV2 } from '../../../src/core/bazi-normalize';
import { deleteRecord, getAllRecords, getRecord, toggleFavorite } from '../../../src/db/database';
import {
    BaziPanelMode,
    BaziSectionKey,
    DenseTrackCellView,
    FortuneSelectionView,
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
import { isAIConfigured } from '../../../src/services/settings';

const MATRIX_COLORS: Record<string, string> = {
    木: '#2E9B47',
    火: '#D74B37',
    土: '#8E6A3B',
    金: '#D19A26',
    水: '#2B74D8',
};

function pickWuXingColor(text: string): string | null {
    for (const [key, color] of Object.entries(MATRIX_COLORS)) {
        if (text.includes(key)) {
            return color;
        }
    }
    const chars = text.split('');
    const map: Record<string, string> = {
        甲: MATRIX_COLORS.木,
        乙: MATRIX_COLORS.木,
        寅: MATRIX_COLORS.木,
        卯: MATRIX_COLORS.木,
        丙: MATRIX_COLORS.火,
        丁: MATRIX_COLORS.火,
        巳: MATRIX_COLORS.火,
        午: MATRIX_COLORS.火,
        戊: MATRIX_COLORS.土,
        己: MATRIX_COLORS.土,
        辰: MATRIX_COLORS.土,
        戌: MATRIX_COLORS.土,
        丑: MATRIX_COLORS.土,
        未: MATRIX_COLORS.土,
        庚: MATRIX_COLORS.金,
        辛: MATRIX_COLORS.金,
        申: MATRIX_COLORS.金,
        酉: MATRIX_COLORS.金,
        壬: MATRIX_COLORS.水,
        癸: MATRIX_COLORS.水,
        子: MATRIX_COLORS.水,
        亥: MATRIX_COLORS.水,
    };
    for (const char of chars) {
        if (map[char]) {
            return map[char];
        }
    }
    return null;
}

function ziHourModeLabel(mode: 'late_zi_next_day' | 'early_zi_same_day'): string {
    return mode === 'early_zi_same_day' ? '早子时当日' : '晚子时次日';
}

function timeModeLabel(mode: 'clock_time' | 'mean_solar_time' | 'true_solar_time'): string {
    return getBaziTimeModeLabel(mode);
}

function chartTimeLabel(mode: 'clock_time' | 'mean_solar_time' | 'true_solar_time'): string {
    return getBaziChartTimeLabel(mode);
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

function buildBasicChartRows(rows: BaziPillarMatrixRow[]): ProChartRowView[] {
    return rows.map((row) => {
        const density: ProChartRowView['density'] = row.key === 'tianGan' || row.key === 'diZhi'
            ? 'symbol'
            : row.key === 'subStar' || row.key === 'cangGan' || row.key === 'shenSha'
                ? 'stacked'
                : row.key === 'mainStar'
                    ? 'label'
                    : 'detail';
        return {
            key: row.key,
            label: row.label,
            density,
            cells: row.values.map((value) => {
                const stackedLines = density === 'stacked'
                    ? value.split(/\n|\s+/).filter(Boolean)
                    : [];
                return {
                    primary: density === 'stacked' ? '' : (value || '—'),
                    lines: density === 'stacked'
                        ? (stackedLines.length > 0 ? stackedLines : ['—'])
                        : undefined,
                    colorized: row.key === 'tianGan' || row.key === 'diZhi' || row.key === 'cangGan',
                };
            }),
        };
    });
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
    const styles = makeStyles(Colors);
    const insets = useSafeAreaInsets();
    const { id } = useLocalSearchParams<{ id: string }>();

    const [result, setResult] = useState<BaziResult | null>(null);
    const [isFavorite, setIsFavorite] = useState(false);
    const [aiConfigured, setAiConfigured] = useState(false);
    const [aiChatVisible, setAiChatVisible] = useState(false);
    const [menuVisible, setMenuVisible] = useState(false);
    const [deleteVisible, setDeleteVisible] = useState(false);
    const [activeSection, setActiveSection] = useState<BaziSectionKey>('basicInfo');
    const [privacyEnabled, setPrivacyEnabled] = useState(false);
    const [panelMode, setPanelMode] = useState<BaziPanelMode>('fortune');
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
                router.replace(`/result/${id}`);
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

    const proChartView = useMemo(() => (
        result ? buildBaziProChartViewModel(result, fortuneSelection) : null
    ), [fortuneSelection, result]);
    const basicChartRows = useMemo(() => (
        result ? buildBasicChartRows(result.pillarMatrix) : []
    ), [result]);
    const displayName = privacyEnabled ? maskVisibleText(result?.subject.name ?? '') : (result?.subject.name ?? '');
    const displaySolarHeader = privacyEnabled && proChartView ? maskLabeledText(proChartView.header.solarHeaderText) : (proChartView?.header.solarHeaderText ?? '');
    const displayLunarHeader = privacyEnabled && proChartView ? maskLabeledText(proChartView.header.lunarHeaderText) : (proChartView?.header.lunarHeaderText ?? '');
    const displayHeroLunar = privacyEnabled ? maskVisibleText(result?.baseInfo.lunarDisplay ?? '') : (result?.baseInfo.lunarDisplay ?? '');
    const displayHeroSolar = privacyEnabled ? maskVisibleText(result?.baseInfo.solarDisplay ?? '') : (result?.baseInfo.solarDisplay ?? '');

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

    const handleDelete = async () => {
        if (!id || !hasPersistedRecord) return;
        setDeleteVisible(false);
        await deleteRecord(id);
        router.back();
    };
    const menuItems: OverflowMenuItem[] = [
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
                            <TouchableOpacity style={[styles.missingBtn, styles.missingBtnSecondary]} onPress={() => router.back()}>
                                <Text style={[styles.missingBtnText, styles.missingBtnSecondaryText]}>返回上一页</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.missingBtn, styles.missingBtnPrimary]} onPress={() => router.replace('/history')}>
                                <Text style={[styles.missingBtnText, styles.missingBtnPrimaryText]}>去历史记录</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
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
                        style={[styles.aiHeaderBtn, !aiConfigured && styles.aiHeaderBtnDisabled]}
                        activeOpacity={0.82}
                        disabled={!aiConfigured}
                    >
                        <AIIcon size={18} color={Colors.text.inverse} />
                        <Text style={styles.aiHeaderBtnText}>AI 解盘</Text>
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

            <View style={styles.sectionTabs}>
                <SectionTab label="基本信息" active={activeSection === 'basicInfo'} onPress={() => setActiveSection('basicInfo')} styles={styles} />
                <SectionTab label="基本排盘" active={activeSection === 'basicChart'} onPress={() => setActiveSection('basicChart')} styles={styles} />
                <SectionTab label="专业细盘" active={activeSection === 'proChart'} onPress={() => setActiveSection('proChart')} styles={styles} />
            </View>

            {persistStatus === 'error' ? (
                <PersistBanner
                    message={`保存失败：${persistError || '点击重试'}`}
                    onPress={handleRetryPersist}
                    styles={styles}
                />
            ) : null}

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {activeSection === 'basicInfo' ? (
                    <View style={styles.heroCard}>
                        <Text style={styles.heroName}>{displayName}</Text>
                        <Text style={styles.heroDate}>{displayHeroLunar}</Text>
                        <Text style={styles.heroDate}>{displayHeroSolar}</Text>
                    </View>
                ) : proChartView ? (
                    <ChartHeaderStrip
                        name={displayName}
                        solarText={displaySolarHeader}
                        lunarText={displayLunarHeader}
                        mingZaoText={proChartView.header.mingZaoText}
                        privacyEnabled={privacyEnabled}
                        panelMode={panelMode}
                        showPanelSwitch={activeSection === 'proChart'}
                        onTogglePrivacy={() => setPrivacyEnabled((prev) => !prev)}
                        onTogglePanelMode={() => setPanelMode((prev) => (prev === 'fortune' ? 'taiming' : 'fortune'))}
                        styles={styles}
                    />
                ) : null}

                {activeSection === 'basicInfo' && (
                    <View style={styles.block}>
                        <InfoGridRow label="姓名" value={displayName} styles={styles} />
                        <InfoGridRow label="性别" value={result.subject.genderLabel} styles={styles} />
                        <InfoGridRow label="命造" value={`${result.subject.yinYangLabel}${result.subject.mingZaoLabel}`} styles={styles} />
                        <InfoGridRow label="生肖" value={result.baseInfo.zodiac} styles={styles} />
                        <InfoGridRow label="农历" value={privacyEnabled ? maskVisibleText(result.baseInfo.lunarDisplay) : result.baseInfo.lunarDisplay} styles={styles} />
                        <InfoGridRow label="阳历" value={privacyEnabled ? maskVisibleText(result.baseInfo.solarDisplay) : result.baseInfo.solarDisplay} styles={styles} />
                        <InfoGridRow label={chartTimeLabel(result.schoolOptionsResolved.timeMode)} value={privacyEnabled ? maskVisibleText(result.baseInfo.trueSolarDisplay) : result.baseInfo.trueSolarDisplay} styles={styles} />
                        <InfoGridRow label="出生地区" value={result.baseInfo.birthPlaceDisplay} styles={styles} />
                        <InfoGridRow label="人元司令" value={result.baseInfo.renYuanDutyDetail.display || result.baseInfo.renYuanDuty} styles={styles} />
                        <InfoGridRow label="出生节气" value={`出生于${result.jieQiContext.currentTerm.name}后${result.jieQiContext.afterPrev}，${result.jieQiContext.nextTerm.name}前${result.jieQiContext.beforeNext}`} styles={styles} />
                        <InfoGridRow label={result.jieQiContext.prevTerm.name} value={result.jieQiContext.prevTerm.dateTime} styles={styles} />
                        <InfoGridRow label={result.jieQiContext.currentTerm.name} value={result.jieQiContext.currentTerm.dateTime} styles={styles} />
                        <InfoGridRow label={result.jieQiContext.nextTerm.name} value={result.jieQiContext.nextTerm.dateTime} styles={styles} />
                        <InfoGridRow label="排盘口径" value={timeModeLabel(result.schoolOptionsResolved.timeMode)} styles={styles} />
                        <InfoGridRow label="子时口径" value={ziHourModeLabel(result.schoolOptionsResolved.ziHourMode)} styles={styles} />
                        {result.schoolOptionsResolved.timeMode !== 'clock_time' ? (
                            <InfoGridRow label="夏令时" value={daylightSavingLabel(result.schoolOptionsResolved.daylightSaving)} styles={styles} />
                        ) : null}
                        <InfoGridRow label="星座" value={result.baseInfo.constellation} styles={styles} />
                        <InfoGridRow label="星宿" value={result.baseInfo.xingXiu} styles={styles} />
                        <InfoGridRow label="胎元" value={result.baseInfo.taiYuan} styles={styles} />
                        <InfoGridRow label="命宫" value={result.baseInfo.mingGong} styles={styles} />
                        <InfoGridRow label="身宫" value={result.baseInfo.shenGong} styles={styles} />
                        <InfoGridRow label="胎息" value={result.baseInfo.taiXi} styles={styles} />
                        <InfoGridRow label="命卦" value={result.baseInfo.mingGua} styles={styles} />
                        <InfoGridRow label="空亡" value={result.baseInfo.kongWang} styles={styles} />
                        <InfoGridRow label="起运" value={`${result.childLimit.years}年${result.childLimit.months}月${result.childLimit.days}天${result.childLimit.hours}时${result.childLimit.minutes}分`} styles={styles} />
                        <InfoGridRow label="交运" value={result.childLimit.jiaoYunDateTime} styles={styles} />
                    </View>
                )}

                {activeSection === 'basicChart' && (
                    <View style={styles.proFlow}>
                        <DenseMatrix
                            headerLabels={['年柱', '月柱', '日柱', '时柱']}
                            rows={basicChartRows}
                            styles={styles}
                        />
                    </View>
                )}

                {activeSection === 'proChart' && proChartView && (
                    <View style={styles.proFlow}>
                        {panelMode === 'fortune' ? (
                            <DenseMatrix
                                headerLabels={proChartView.fortuneColumns.map((column) => column.label)}
                                rows={proChartView.fortuneRows}
                                styles={styles}
                            />
                        ) : (
                            <DenseMatrix
                                headerLabels={proChartView.taimingColumns.map((column) => column.label)}
                                rows={proChartView.taimingRows}
                                styles={styles}
                            />
                        )}

                        <DualInfoStrip infoStrip={proChartView.infoStrip} styles={styles} />

                        <DenseTrackMatrix
                            rowLabel="大运"
                            columns={proChartView.daYunTrack}
                            onSelect={handleSelectDaYunCell}
                            styles={styles}
                        />

                        <DenseTrackMatrix
                            rowLabel="流年"
                            columns={proChartView.liuNianTrack}
                            onSelect={handleSelectLiuNianCell}
                            styles={styles}
                        />

                        <DenseTrackMatrix
                            rowLabel="流月"
                            columns={proChartView.liuYueTrack}
                            onSelect={handleSelectLiuYueCell}
                            styles={styles}
                        />

                        <View style={styles.qiYunBand}>
                            {proChartView.infoStrip.qiYunBand.map((item) => (
                                <View key={`${item.element}-${item.status}`} style={styles.qiYunBandCell}>
                                    <Text style={styles.qiYunBandText}>{item.element}{item.status}</Text>
                                </View>
                            ))}
                        </View>

                        <View style={styles.sectionTitleBar}>
                            <Text style={styles.subTitle}>神煞分层</Text>
                        </View>
                        {proChartView.shenShaSections.map((section) => (
                            <LayerStarBlock
                                key={section.title}
                                title={section.title}
                                rows={section.rows}
                                styles={styles}
                            />
                        ))}
                    </View>
                )}

                <View style={{ height: 40 }} />
            </ScrollView>

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
                }}
                onUpdateResult={(updatedResult) => {
                    setResult(normalizeBaziResultV2(updatedResult as BaziResult));
                }}
            />
        </View>
    );
}

const SectionTab: React.FC<{ label: string; active: boolean; onPress: () => void; styles: ReturnType<typeof makeStyles>; }> = ({ label, active, onPress, styles }) => (
    <TouchableOpacity style={[styles.sectionTab, active && styles.sectionTabActive]} onPress={onPress} activeOpacity={0.75}>
        <Text style={[styles.sectionTabText, active && styles.sectionTabTextActive]}>{label}</Text>
    </TouchableOpacity>
);

const InfoGridRow: React.FC<{ label: string; value: string; styles: ReturnType<typeof makeStyles>; }> = ({ label, value, styles }) => (
    <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
    </View>
);

const ChartHeaderStrip: React.FC<{
    name: string;
    solarText: string;
    lunarText: string;
    mingZaoText: string;
    privacyEnabled: boolean;
    panelMode: BaziPanelMode;
    showPanelSwitch: boolean;
    onTogglePrivacy: () => void;
    onTogglePanelMode: () => void;
    styles: ReturnType<typeof makeStyles>;
}> = ({
    name,
    solarText,
    lunarText,
    mingZaoText,
    privacyEnabled,
    panelMode,
    showPanelSwitch,
    onTogglePrivacy,
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
                <View style={styles.chartHeaderActions}>
                    <HeaderActionButton onPress={onTogglePrivacy} active={privacyEnabled} styles={styles}>
                        {privacyEnabled ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
                    </HeaderActionButton>
                    {showPanelSwitch ? <PanelModeSwitch panelMode={panelMode} onToggle={onTogglePanelMode} styles={styles} /> : null}
                </View>
                <Text style={styles.chartHeaderMingZao}>{mingZaoText}</Text>
            </View>
        </View>
    );

const HeaderActionButton: React.FC<{
    children: React.ReactNode;
    onPress: () => void;
    active?: boolean;
    styles: ReturnType<typeof makeStyles>;
}> = ({ children, onPress, active = false, styles }) => (
    <TouchableOpacity
        style={[styles.chartHeaderActionBtn, active && styles.chartHeaderActionBtnActive]}
        onPress={onPress}
        activeOpacity={0.82}
    >
        {children}
    </TouchableOpacity>
);

const PanelModeSwitch: React.FC<{
    panelMode: BaziPanelMode;
    onToggle: () => void;
    styles: ReturnType<typeof makeStyles>;
}> = ({ panelMode, onToggle, styles }) => (
    <TouchableOpacity
        style={[styles.panelSwitch, panelMode === 'taiming' && styles.panelSwitchActive]}
        onPress={onToggle}
        activeOpacity={0.84}
    >
        <View style={[styles.panelSwitchThumb, panelMode === 'taiming' && styles.panelSwitchThumbActive]} />
        <View style={styles.panelSwitchTextRow}>
            <Text
                style={[
                    styles.panelSwitchLabel,
                    styles.panelSwitchLabelLeft,
                    panelMode === 'fortune' && styles.panelSwitchLabelActive,
                ]}
            >
                流年大运
            </Text>
            <Text
                style={[
                    styles.panelSwitchLabel,
                    styles.panelSwitchLabelRight,
                    panelMode === 'taiming' && styles.panelSwitchLabelActive,
                ]}
            >
                胎命身
            </Text>
        </View>
    </TouchableOpacity>
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
    <TouchableOpacity style={styles.persistBanner} onPress={onPress} activeOpacity={0.82}>
        <Text style={styles.persistBannerText}>{message}</Text>
    </TouchableOpacity>
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
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trackRow}>
                {columns.map((column) => {
                    const primaryColor = pickWuXingColor(column.primaryText);
                    const secondaryColor = pickWuXingColor(column.secondaryText);
                    return (
                        <TouchableOpacity
                            key={column.key}
                            style={[
                                styles.trackColumn,
                                column.active && styles.trackColumnActive,
                            ]}
                            onPress={() => onSelect(column)}
                            activeOpacity={column.selectable ? 0.78 : 1}
                        >
                            <Text style={[styles.trackTop, column.active && styles.trackActiveText]}>{column.topLabel}</Text>
                            <Text style={[styles.trackSub, column.active && styles.trackActiveText]}>{column.subLabel}</Text>
                            <Text style={[styles.trackPrimary, primaryColor ? { color: primaryColor } : null]}>
                                {column.primaryText}
                            </Text>
                            <Text style={[styles.trackSecondary, secondaryColor ? { color: secondaryColor } : null]}>
                                {column.secondaryText}
                            </Text>
                            {column.tertiaryText ? (
                                <Text style={styles.trackTertiary}>{column.tertiaryText}</Text>
                            ) : null}
                            {column.isCurrent ? <Text style={styles.currentTag}>当前</Text> : null}
                        </TouchableOpacity>
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

const makeStyles = (Colors: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.bg.primary },
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
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
    },
    headerBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
    headerBtnDisabled: { opacity: 0.45 },
    headerCenter: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: Spacing.sm,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        width: 40,
    },
    aiHeaderBtn: {
        minHeight: 44,
        minWidth: 124,
        paddingHorizontal: Spacing.lg,
        borderRadius: 999,
        backgroundColor: Colors.bazi.trackActiveBorder,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.xs,
        shadowColor: Colors.bazi.trackActiveBorder,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.18,
        shadowRadius: 8,
        elevation: 4,
    },
    aiHeaderBtnDisabled: {
        opacity: 0.45,
    },
    aiHeaderBtnText: {
        fontSize: FontSize.sm,
        color: Colors.text.inverse,
        fontWeight: '700',
    },
    sectionTabs: {
        flexDirection: 'row',
        backgroundColor: Colors.bazi.chromeBg,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: Colors.bazi.chromeBorder,
    },
    sectionTab: {
        flex: 1,
        minHeight: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sectionTabActive: {
        borderBottomWidth: 2,
        borderBottomColor: Colors.bazi.chromeTextActive,
    },
    sectionTabText: { color: Colors.bazi.chromeText, fontSize: FontSize.md },
    sectionTabTextActive: { color: Colors.bazi.chromeTextActive, fontWeight: '600' },
    content: { flex: 1 },
    heroCard: {
        marginHorizontal: Spacing.md,
        marginTop: Spacing.md,
        marginBottom: Spacing.sm,
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        borderWidth: 1,
        borderColor: Colors.bazi.heroBorder,
        backgroundColor: Colors.bazi.heroBg,
    },
    heroName: { fontSize: 28, color: Colors.bazi.heroTitle, fontWeight: '700' },
    heroDate: { marginTop: 4, fontSize: FontSize.sm, color: Colors.bazi.heroText },
    block: {
        marginHorizontal: Spacing.md,
        marginTop: Spacing.sm,
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
        backgroundColor: Colors.bg.card,
        padding: Spacing.md,
        gap: Spacing.sm,
    },
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
    chartHeaderActionBtn: {
        width: 36,
        height: 36,
        borderRadius: BorderRadius.round,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.bazi.actionBg,
        borderWidth: 1,
        borderColor: Colors.bazi.actionBorder,
    },
    chartHeaderActionBtnActive: {
        backgroundColor: Colors.bazi.actionBgActive,
        borderColor: Colors.bazi.chromeTextActive,
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
    panelSwitchLabelLeft: {
    },
    panelSwitchLabelRight: {
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
    infoRow: {
        flexDirection: 'row',
        gap: Spacing.sm,
        justifyContent: 'space-between',
    },
    infoLabel: { width: 86, color: Colors.text.tertiary, fontSize: FontSize.sm },
    infoValue: { flex: 1, color: Colors.text.primary, fontSize: FontSize.sm, textAlign: 'right' },
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
    proMatrixDenseLabelCell: {
        color: Colors.text.tertiary,
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
    infoBand: {
        backgroundColor: Colors.bazi.infoBandBg,
        borderBottomWidth: 1,
        borderBottomColor: Colors.bazi.infoBandBorder,
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
        color: Colors.bazi.infoBandText,
        lineHeight: 18,
        fontWeight: '600',
    },
    infoBandValueRight: {
        textAlign: 'right',
    },
    qiYunBand: {
        flexDirection: 'row',
        borderRadius: 0,
        overflow: 'hidden',
        backgroundColor: Colors.bazi.infoBandBg,
    },
    qiYunBandCell: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 5,
        borderRightWidth: 1,
        borderRightColor: Colors.bazi.infoBandBorder,
    },
    qiYunBandText: {
        fontSize: FontSize.sm,
        color: Colors.bazi.infoBandText,
        fontWeight: '600',
    },
    sectionTitleBar: {
        backgroundColor: Colors.bg.elevated,
        borderTopWidth: 1,
        borderTopColor: Colors.border.subtle,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border.subtle,
        paddingHorizontal: Spacing.md,
        paddingVertical: 6,
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
    layerTitle: { fontSize: FontSize.sm, color: Colors.bazi.chromeTextActive, fontWeight: '600' },
    layerRow: { fontSize: FontSize.xs, color: Colors.text.secondary, lineHeight: 16 },
    emptyHint: { fontSize: FontSize.xs, color: Colors.text.tertiary },
});
