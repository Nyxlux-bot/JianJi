/**
 * 历史记录页面
 * 展示所有排盘记录，支持查看、收藏、删除与分舱筛选
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import React, { memo, useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
    FlatList,
    GestureResponderEvent,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import ConfirmModal from '../../src/components/ConfirmModal';
import StatusBarDecor from '../../src/components/StatusBarDecor';
import { ChevronRightIcon, StarIcon, TrashIcon } from '../../src/components/Icons';
import { deleteRecord, getAllRecords, RecordSummary, toggleFavorite } from '../../src/db/database';
import { buildZiweiHistoryRestoreRoute } from '../../src/features/ziwei/result-route';
import { BorderRadius, FontSize, Spacing } from '../../src/theme/colors';
import { useTheme } from '../../src/theme/ThemeContext';
import {
    BaziHistoryCategory,
    DEFAULT_HISTORY_FILTER,
    filterHistoryRecords,
    getHistoryMetaLabel,
    HistoryActiveEngine,
    HistoryFilterState,
    LiuyaoHistoryCategory,
    ZiweiHistoryCategory,
} from '../../src/utils/history-filter';

const HISTORY_FILTER_STORAGE_KEY = 'history_filter_state_v2';

const ENGINE_OPTIONS: Array<{ key: HistoryActiveEngine; label: string; description: string }> = [
    { key: 'liuyao', label: '六爻', description: '时间、硬币、数字、手动起卦' },
    { key: 'bazi', label: '八字', description: '乾造、坤造与命盘收藏' },
    { key: 'ziwei', label: '紫微', description: '紫微斗数命盘与运限记录' },
];

const LIUYAO_CATEGORY_OPTIONS: Array<{ key: LiuyaoHistoryCategory; label: string }> = [
    { key: 'all', label: '全部' },
    { key: 'time', label: '时间' },
    { key: 'coin', label: '硬币' },
    { key: 'number', label: '数字' },
    { key: 'manual', label: '手动' },
    { key: 'favorite', label: '收藏' },
];

const BAZI_CATEGORY_OPTIONS: Array<{ key: BaziHistoryCategory; label: string }> = [
    { key: 'all', label: '全部' },
    { key: 'kunzao', label: '坤造' },
    { key: 'qianzao', label: '乾造' },
    { key: 'favorite', label: '收藏' },
];

const ZIWEI_CATEGORY_OPTIONS: Array<{ key: ZiweiHistoryCategory; label: string }> = [
    { key: 'all', label: '全部' },
    { key: 'male', label: '男命' },
    { key: 'female', label: '女命' },
    { key: 'favorite', label: '收藏' },
];

const META_LABELS: Record<string, string> = {
    time: '时间',
    coin: '硬币',
    number: '数字',
    manual: '手动',
    kunzao: '坤造',
    qianzao: '乾造',
    bazi: '八字',
    male: '男命',
    female: '女命',
    ziwei: '紫微',
};

type HistoryStyles = ReturnType<typeof makeStyles>;

interface HistoryRecordRowProps {
    id: string;
    title: string;
    question: string;
    createdAtLabel: string;
    metaLabel: string;
    engineType: RecordSummary['engineType'];
    isFavorite: boolean;
    favoriteColor: string;
    tertiaryColor: string;
    styles: HistoryStyles;
    onOpenRecord: (id: string, engineType: RecordSummary['engineType']) => void;
    onToggleFavorite: (id: string) => Promise<void>;
    onRequestDelete: (id: string, title: string) => void;
}

const HistoryRecordRow = memo(function HistoryRecordRow({
    id,
    title,
    question,
    createdAtLabel,
    metaLabel,
    engineType,
    isFavorite,
    favoriteColor,
    tertiaryColor,
    styles,
    onOpenRecord,
    onToggleFavorite,
    onRequestDelete,
}: HistoryRecordRowProps) {
    const handleOpen = useCallback(() => {
        onOpenRecord(id, engineType);
    }, [engineType, id, onOpenRecord]);

    const handleToggleFavoritePress = useCallback((event: GestureResponderEvent) => {
        event.stopPropagation();
        void onToggleFavorite(id);
    }, [id, onToggleFavorite]);

    const handleDeletePress = useCallback((event: GestureResponderEvent) => {
        event.stopPropagation();
        onRequestDelete(id, title);
    }, [id, onRequestDelete, title]);

    return (
        <Pressable
            style={({ pressed }) => [styles.recordCard, pressed && styles.recordCardPressed]}
            onPress={handleOpen}
        >
            <View style={styles.recordMain}>
                <Text style={styles.recordTitle} numberOfLines={1}>{title}</Text>
                <View style={styles.recordMetaRow}>
                    <View
                        style={[
                            styles.recordMetaBadge,
                            engineType === 'bazi'
                                ? styles.recordMetaBadgeBazi
                                : engineType === 'ziwei'
                                    ? styles.recordMetaBadgeZiwei
                                    : styles.recordMetaBadgeLiuyao,
                        ]}
                    >
                        <Text style={styles.recordMetaBadgeText}>{metaLabel}</Text>
                    </View>
                    <Text style={styles.recordMeta}>{createdAtLabel}</Text>
                </View>
                {question ? (
                    <Text style={styles.recordQuestion} numberOfLines={1}>
                        {question}
                    </Text>
                ) : null}
            </View>
            <View style={styles.recordActions}>
                <Pressable
                    style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]}
                    onPress={handleToggleFavoritePress}
                    hitSlop={10}
                >
                    <StarIcon
                        size={17}
                        color={isFavorite ? favoriteColor : tertiaryColor}
                        filled={isFavorite}
                    />
                </Pressable>
                <Pressable
                    style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]}
                    onPress={handleDeletePress}
                    hitSlop={10}
                >
                    <TrashIcon size={16} color={tertiaryColor} />
                </Pressable>
            </View>
        </Pressable>
    );
});

function normalizeStoredFilters(raw: unknown): HistoryFilterState {
    if (!raw || typeof raw !== 'object') {
        return DEFAULT_HISTORY_FILTER;
    }

    const parsed = raw as Partial<HistoryFilterState>;
    const activeEngine = parsed.activeEngine === 'bazi' || parsed.activeEngine === 'ziwei' ? parsed.activeEngine : 'liuyao';
    const liuyaoCategory = LIUYAO_CATEGORY_OPTIONS.some((item) => item.key === parsed.liuyaoCategory)
        ? parsed.liuyaoCategory as LiuyaoHistoryCategory
        : DEFAULT_HISTORY_FILTER.liuyaoCategory;
    const baziCategory = BAZI_CATEGORY_OPTIONS.some((item) => item.key === parsed.baziCategory)
        ? parsed.baziCategory as BaziHistoryCategory
        : DEFAULT_HISTORY_FILTER.baziCategory;
    const ziweiCategory = ZIWEI_CATEGORY_OPTIONS.some((item) => item.key === parsed.ziweiCategory)
        ? parsed.ziweiCategory as ZiweiHistoryCategory
        : DEFAULT_HISTORY_FILTER.ziweiCategory;

    return {
        keyword: typeof parsed.keyword === 'string' ? parsed.keyword : DEFAULT_HISTORY_FILTER.keyword,
        activeEngine,
        liuyaoCategory,
        baziCategory,
        ziweiCategory,
    };
}

function buildPersistedFilters(filter: HistoryFilterState): Pick<HistoryFilterState, 'activeEngine' | 'liuyaoCategory' | 'baziCategory' | 'ziweiCategory'> {
    return {
        activeEngine: filter.activeEngine,
        liuyaoCategory: filter.liuyaoCategory,
        baziCategory: filter.baziCategory,
        ziweiCategory: filter.ziweiCategory,
    };
}

export default function HistoryPage() {
    const { Colors } = useTheme();
    const styles = useMemo(() => makeStyles(Colors), [Colors]);
    const [records, setRecords] = useState<RecordSummary[]>([]);
    const [filters, setFilters] = useState<HistoryFilterState>(DEFAULT_HISTORY_FILTER);
    const [filtersReady, setFiltersReady] = useState(false);
    const [deleteModalVisible, setDeleteModalVisible] = useState(false);
    const [deletingRecord, setDeletingRecord] = useState<{ id: string; name: string } | null>(null);
    const deferredKeyword = useDeferredValue(filters.keyword);

    useEffect(() => {
        let active = true;
        AsyncStorage.getItem(HISTORY_FILTER_STORAGE_KEY)
            .then((value) => {
                if (!active) {
                    return;
                }
                const parsed = value ? JSON.parse(value) : null;
                setFilters((prev) => ({ ...prev, ...normalizeStoredFilters(parsed) }));
                setFiltersReady(true);
            })
            .catch(() => {
                if (active) {
                    setFiltersReady(true);
                }
            });

        return () => {
            active = false;
        };
    }, []);

    useEffect(() => {
        if (!filtersReady) {
            return;
        }
        void AsyncStorage.setItem(HISTORY_FILTER_STORAGE_KEY, JSON.stringify(buildPersistedFilters(filters)));
    }, [filters.activeEngine, filters.baziCategory, filters.liuyaoCategory, filters.ziweiCategory, filtersReady]);

    const loadRecords = useCallback(async () => {
        const data = await getAllRecords();
        setRecords(data);
    }, []);

    useFocusEffect(
        useCallback(() => {
            void loadRecords();
        }, [loadRecords]),
    );

    const confirmDelete = async () => {
        if (!deletingRecord?.id) {
            return;
        }
        await deleteRecord(deletingRecord.id);
        setDeleteModalVisible(false);
        setDeletingRecord(null);
        await loadRecords();
    };

    const handleRequestDelete = useCallback((id: string, name: string) => {
        setDeletingRecord({ id, name });
        setDeleteModalVisible(true);
    }, []);

    const handleToggleFavorite = useCallback(async (id: string) => {
        await toggleFavorite(id);
        await loadRecords();
    }, [loadRecords]);

    const handleOpenRecord = useCallback((id: string, engineType: RecordSummary['engineType']) => {
        if (engineType === 'bazi') {
            router.push(`/bazi/result/${id}`);
            return;
        }
        if (engineType === 'ziwei') {
            router.push(buildZiweiHistoryRestoreRoute(id));
            return;
        }
        router.push(`/result/${id}`);
    }, []);

    const filteredRecords = useMemo(
        () => filterHistoryRecords(records, {
            ...filters,
            keyword: deferredKeyword,
        }),
        [deferredKeyword, filters, records],
    );

    const currentEngineOption = ENGINE_OPTIONS.find((item) => item.key === filters.activeEngine) || ENGINE_OPTIONS[0];
    const currentCategoryOptions = filters.activeEngine === 'liuyao'
        ? LIUYAO_CATEGORY_OPTIONS
        : filters.activeEngine === 'bazi'
            ? BAZI_CATEGORY_OPTIONS
            : ZIWEI_CATEGORY_OPTIONS;

    const formatDate = useCallback((iso: string) => {
        const d = new Date(iso);
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const hh = String(d.getHours()).padStart(2, '0');
        const mi = String(d.getMinutes()).padStart(2, '0');
        return `${d.getFullYear()}-${mm}-${dd} ${hh}:${mi}`;
    }, []);

    const handleEngineChange = useCallback((engine: HistoryActiveEngine) => {
        setFilters((prev) => ({
            ...prev,
            activeEngine: engine,
        }));
    }, []);

    const handleCategoryChange = useCallback((category: LiuyaoHistoryCategory | BaziHistoryCategory | ZiweiHistoryCategory) => {
        setFilters((prev) => (
            prev.activeEngine === 'liuyao'
                ? { ...prev, liuyaoCategory: category as LiuyaoHistoryCategory }
                : prev.activeEngine === 'bazi'
                    ? { ...prev, baziCategory: category as BaziHistoryCategory }
                    : { ...prev, ziweiCategory: category as ZiweiHistoryCategory }
        ));
    }, []);

    const keyExtractor = useCallback((item: RecordSummary) => item.id, []);

    const renderItem = useCallback(({ item }: { item: RecordSummary }) => {
        const metaLabelKey = getHistoryMetaLabel(item);
        const metaLabel = META_LABELS[metaLabelKey] || item.engineType;

        return (
            <HistoryRecordRow
                id={item.id}
                title={item.title}
                question={item.question}
                createdAtLabel={formatDate(item.createdAt)}
                metaLabel={metaLabel}
                engineType={item.engineType}
                isFavorite={item.isFavorite}
                favoriteColor={Colors.accent.gold}
                tertiaryColor={Colors.text.tertiary}
                styles={styles}
                onOpenRecord={handleOpenRecord}
                onToggleFavorite={handleToggleFavorite}
                onRequestDelete={handleRequestDelete}
            />
        );
    }, [
        Colors.accent.gold,
        Colors.text.tertiary,
        formatDate,
        handleOpenRecord,
        handleRequestDelete,
        handleToggleFavorite,
        styles,
    ]);

    return (
        <View style={styles.container}>
            <StatusBarDecor />
            <View style={styles.header}>
                <View style={styles.backBtn} />
                <Text style={styles.headerTitle}>历史记录</Text>
                <View style={styles.backBtn} />
            </View>

            <View style={styles.filterArea}>
                <TextInput
                    style={styles.searchInput}
                    value={filters.keyword}
                    onChangeText={(text) => setFilters((prev) => ({ ...prev, keyword: text }))}
                    placeholder={`搜索当前${currentEngineOption.label}分舱的标题、副标题、占问`}
                    placeholderTextColor={Colors.text.tertiary}
                    clearButtonMode="while-editing"
                />

                <View style={styles.engineSegment}>
                    {ENGINE_OPTIONS.map((option) => {
                        const active = filters.activeEngine === option.key;
                        return (
                            <TouchableOpacity
                                key={option.key}
                                style={[styles.engineSegmentBtn, active && styles.engineSegmentBtnActive]}
                                onPress={() => handleEngineChange(option.key)}
                                activeOpacity={0.78}
                            >
                                <Text style={[styles.engineSegmentTitle, active && styles.engineSegmentTitleActive]}>
                                    {option.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                <View style={styles.categoryHeader}>
                    <Text style={styles.categoryTitle}>{currentEngineOption.label}筛选</Text>
                </View>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.categoryScrollContent}
                >
                    {currentCategoryOptions.map((option) => {
                        const active = filters.activeEngine === 'liuyao'
                            ? filters.liuyaoCategory === option.key
                            : filters.activeEngine === 'bazi'
                                ? filters.baziCategory === option.key
                                : filters.ziweiCategory === option.key;
                        return (
                            <TouchableOpacity
                                key={option.key}
                                style={[styles.filterChip, active && styles.filterChipActive]}
                                onPress={() => handleCategoryChange(option.key)}
                                activeOpacity={0.78}
                            >
                                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                                    {option.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            {records.length === 0 ? (
                <View style={styles.empty}>
                    <Text style={styles.emptyText}>暂无排盘记录</Text>
                    <Text style={styles.emptyHint}>起卦或排盘后的记录将保存在这里</Text>
                </View>
            ) : filteredRecords.length === 0 ? (
                <View style={styles.empty}>
                    <Text style={styles.emptyText}>未找到匹配记录</Text>
                    <Text style={styles.emptyHint}>调整当前分舱的搜索词或筛选条件后重试</Text>
                </View>
            ) : (
                <FlatList
                    data={filteredRecords}
                    keyExtractor={keyExtractor}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    initialNumToRender={12}
                    windowSize={8}
                />
            )}

            <ConfirmModal
                visible={deleteModalVisible}
                title="删除记录"
                message={`确定要删除"${deletingRecord?.name}"吗？删除后将无法恢复。`}
                confirmText="删除"
                destructive
                onConfirm={confirmDelete}
                onCancel={() => setDeleteModalVisible(false)}
            />
        </View>
    );
}

const makeStyles = (Colors: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.bg.primary },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
    },
    backBtn: { width: 40, height: 40, justifyContent: 'center' },
    headerTitle: { fontSize: FontSize.lg, color: Colors.text.heading, fontWeight: '400' },
    filterArea: {
        paddingHorizontal: Spacing.md,
        paddingBottom: Spacing.md,
        gap: Spacing.sm,
    },
    searchInput: {
        minHeight: 46,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
        backgroundColor: Colors.bg.card,
        color: Colors.text.primary,
        paddingHorizontal: Spacing.md,
        fontSize: FontSize.md,
    },
    engineSegment: {
        flexDirection: 'row',
        gap: Spacing.sm,
    },
    engineSegmentBtn: {
        flex: 1,
        minHeight: 46,
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
        backgroundColor: Colors.bg.elevated,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 4,
    },
    engineSegmentBtnActive: {
        borderColor: Colors.accent.gold,
        backgroundColor: Colors.bg.card,
    },
    engineSegmentTitle: {
        fontSize: FontSize.md,
        color: Colors.text.heading,
        fontWeight: '700',
    },
    engineSegmentTitleActive: {
        color: Colors.accent.gold,
    },
    categoryHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: Spacing.xs,
    },
    categoryTitle: {
        fontSize: FontSize.sm,
        color: Colors.text.secondary,
        fontWeight: '600',
    },
    categoryScrollContent: {
        gap: Spacing.sm,
        paddingRight: Spacing.md,
    },
    filterChip: {
        minHeight: 44,
        paddingHorizontal: Spacing.md,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
        backgroundColor: Colors.bg.elevated,
        justifyContent: 'center',
    },
    filterChipActive: {
        borderColor: Colors.accent.gold,
        backgroundColor: Colors.bg.card,
    },
    filterChipText: {
        fontSize: FontSize.sm,
        color: Colors.text.secondary,
        fontWeight: '500',
    },
    filterChipTextActive: {
        color: Colors.accent.gold,
        fontWeight: '700',
    },
    listContent: {
        paddingHorizontal: Spacing.md,
        paddingBottom: 40,
    },
    recordCard: {
        backgroundColor: Colors.bg.card,
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        marginBottom: Spacing.sm,
        borderWidth: 0.5,
        borderColor: Colors.border.subtle,
        gap: Spacing.sm,
    },
    recordCardPressed: {
        opacity: 0.82,
    },
    recordMain: {
        flex: 1,
        gap: Spacing.xs,
    },
    recordTitle: {
        fontSize: FontSize.lg,
        color: Colors.text.heading,
        fontWeight: '500',
    },
    recordMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    recordMetaBadge: {
        minWidth: 54,
        minHeight: 24,
        paddingHorizontal: Spacing.sm,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
    },
    recordMetaBadgeLiuyao: {
        backgroundColor: Colors.bg.elevated,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
    },
    recordMetaBadgeBazi: {
        backgroundColor: Colors.bg.elevated,
        borderWidth: 1,
        borderColor: Colors.accent.gold,
    },
    recordMetaBadgeZiwei: {
        backgroundColor: Colors.bg.elevated,
        borderWidth: 1,
        borderColor: '#6fa4ff',
    },
    recordMetaBadgeText: {
        fontSize: FontSize.xs,
        color: Colors.text.secondary,
        fontWeight: '700',
    },
    recordMeta: {
        fontSize: FontSize.xs,
        color: Colors.text.tertiary,
    },
    recordQuestion: {
        fontSize: FontSize.sm,
        color: Colors.text.secondary,
    },
    recordActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: Spacing.xs,
    },
    actionBtn: {
        width: 36,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 18,
        backgroundColor: Colors.bg.elevated,
    },
    actionBtnPressed: {
        opacity: 0.72,
    },
    empty: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: Spacing.xl,
    },
    emptyText: {
        fontSize: FontSize.lg,
        color: Colors.text.heading,
        fontWeight: '500',
    },
    emptyHint: {
        marginTop: Spacing.sm,
        fontSize: FontSize.sm,
        color: Colors.text.tertiary,
        textAlign: 'center',
        lineHeight: 22,
    },
});
