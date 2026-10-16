/**
 * 历史记录（卷宗）页面
 * 按引擎分舱、按日期分组展示排盘记录，支持搜索、筛选、收藏，左滑或长按删除
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import React, { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, SectionList, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
// 滑动区内用手势库的 Pressable：左滑开始后点按会被取消，不会误开记录
import { Pressable as GesturePressable } from 'react-native-gesture-handler';
import Svg, { Circle, Path } from 'react-native-svg';
import ConfirmModal from '../../src/components/ConfirmModal';
import StatusBarDecor from '../../src/components/StatusBarDecor';
import HexagramLines from '../../src/components/result/HexagramLines';
import { StarIcon } from '../../src/components/Icons';
import { deleteRecord, getAllRecords, RecordSummary, toggleFavorite } from '../../src/db/database';
import { BA_GUA, GUA_64 } from '../../src/core/liuyao-data';
import { getRecordRoute } from '../../src/utils/record-route';
import { useTheme } from '../../src/theme/ThemeContext';
import { buildResultPalette, type ResultPalette } from '../../src/theme/result-palette';
import { clearAIAnalysisJob } from '../../src/services/ai-analysis-jobs';
import {
    BaziHistoryCategory,
    BaziCompatibilityHistoryCategory,
    DEFAULT_HISTORY_FILTER,
    filterHistoryRecords,
    getHistoryMetaLabel,
    HistoryActiveEngine,
    HistoryFilterState,
    LiuyaoHistoryCategory,
    MeihuaHistoryCategory,
    ZiweiHistoryCategory,
    getActiveHistoryCategory,
} from '../../src/utils/history-filter';

const HISTORY_FILTER_STORAGE_KEY = 'history_filter_state_v2';
const SERIF = Platform.select({ ios: 'Songti SC', android: 'serif', default: 'serif' });

const ENGINE_OPTIONS: Array<{ key: HistoryActiveEngine; label: string; placeholder: string }> = [
    { key: 'liuyao', label: '六爻', placeholder: '搜索卦名、占问' },
    { key: 'meihua', label: '梅花', placeholder: '搜索卦名、占问' },
    { key: 'bazi', label: '八字', placeholder: '搜索姓名、出生地' },
    { key: 'baziCompatibility', label: '合盘', placeholder: '搜索双方姓名' },
    { key: 'ziwei', label: '紫微', placeholder: '搜索姓名、出生地' },
];

const LIUYAO_CATEGORY_OPTIONS: Array<{ key: LiuyaoHistoryCategory; label: string }> = [
    { key: 'all', label: '全部' },
    { key: 'coin', label: '硬币' },
    { key: 'manual', label: '手动' },
    { key: 'favorite', label: '收藏' },
];

const MEIHUA_CATEGORY_OPTIONS: Array<{ key: MeihuaHistoryCategory; label: string }> = [
    { key: 'all', label: '全部' },
    { key: 'meihua_time', label: '时间' },
    { key: 'meihua_number', label: '数字' },
    { key: 'favorite', label: '收藏' },
];

const BAZI_CATEGORY_OPTIONS: Array<{ key: BaziHistoryCategory; label: string }> = [
    { key: 'all', label: '全部' },
    { key: 'qianzao', label: '乾造' },
    { key: 'kunzao', label: '坤造' },
    { key: 'favorite', label: '收藏' },
];

const ZIWEI_CATEGORY_OPTIONS: Array<{ key: ZiweiHistoryCategory; label: string }> = [
    { key: 'all', label: '全部' },
    { key: 'male', label: '乾造' },
    { key: 'female', label: '坤造' },
    { key: 'favorite', label: '收藏' },
];

const BAZI_COMPATIBILITY_CATEGORY_OPTIONS: Array<{ key: BaziCompatibilityHistoryCategory; label: string }> = [
    { key: 'all', label: '全部' },
    { key: 'favorite', label: '收藏' },
];

const META_LABELS: Record<string, string> = {
    time: '时间',
    coin: '硬币',
    number: '数字',
    manual: '手动',
    meihua_time: '时间',
    meihua_number: '数字',
    kunzao: '坤造',
    qianzao: '乾造',
    bazi: '八字',
    male: '乾造',
    female: '坤造',
    ziwei: '紫微',
    baziCompatibility: '合盘',
};

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

/** 卦名 → 卦画（初爻→上爻），给六爻、梅花记录画缩略卦 */
const LINES_BY_NAME = new Map(Object.values(GUA_64).map((gua) => [gua.fullName, [...BA_GUA[gua.lower].yao, ...BA_GUA[gua.upper].yao]]));

function pad(value: number): string {
    return String(value).padStart(2, '0');
}

function dayKey(date: Date): string {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

interface HistorySection {
    key: string;
    label: string;
    meta: string;
    data: RecordSummary[];
}

/** 按自然日分组：今天、昨天，其余写月日。 */
function groupByDay(records: RecordSummary[], now: Date): HistorySection[] {
    const today = dayKey(now);
    const yesterday = dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
    const sections: HistorySection[] = [];
    records.forEach((record) => {
        const date = new Date(record.createdAt);
        const key = Number.isNaN(date.getTime()) ? 'unknown' : dayKey(date);
        let section = sections[sections.length - 1];
        if (!section || section.key !== key) {
            const sameYear = date.getFullYear() === now.getFullYear();
            const dateText = `${sameYear ? '' : `${date.getFullYear()}年`}${date.getMonth() + 1}月${date.getDate()}日`;
            const label = key === today ? '今天' : key === yesterday ? '昨天' : key === 'unknown' ? '更早' : dateText;
            const meta = key === 'unknown' ? '' : `${label === dateText ? '' : `${dateText} `}周${WEEKDAYS[date.getDay()]}`;
            section = { key, label, meta, data: [] };
            sections.push(section);
        }
        section.data.push(record);
    });
    return sections;
}

/** 列表行的标题与副行。梅花摘要副标题形如「变 巽为风 · 时间起卦」。 */
function describeRecord(record: RecordSummary): { title: string; sub: string; hasQuestion: boolean } {
    const question = record.question?.trim() || '';
    if (record.engineType === 'liuyao') {
        return { title: record.subtitle ? `${record.title} 之 ${record.subtitle}` : record.title, sub: question || '未填写占问', hasQuestion: Boolean(question) };
    }
    if (record.engineType === 'meihua') {
        const bian = /^变 (\S+)/.exec(record.subtitle || '')?.[1];
        return { title: bian ? `${record.title} 之 ${bian}` : record.title, sub: question || '未填写占问', hasQuestion: Boolean(question) };
    }
    return { title: record.title, sub: record.subtitle || question, hasQuestion: true };
}

function sealOf(record: RecordSummary, metaKey: string): string {
    if (record.engineType === 'baziCompatibility') return '合';
    if (metaKey === 'kunzao' || metaKey === 'female') return '坤';
    if (metaKey === 'qianzao' || metaKey === 'male') return '乾';
    return record.engineType === 'ziwei' ? '紫' : '八';
}

function normalizeStoredFilters(raw: unknown): HistoryFilterState {
    if (!raw || typeof raw !== 'object') {
        return DEFAULT_HISTORY_FILTER;
    }

    const parsed = raw as Partial<HistoryFilterState>;
    const activeEngine = ENGINE_OPTIONS.some((item) => item.key === parsed.activeEngine)
        ? parsed.activeEngine as HistoryActiveEngine
        : 'liuyao';
    const pick = <T extends string>(options: Array<{ key: T }>, value: unknown, fallback: T): T => (
        options.some((item) => item.key === value) ? value as T : fallback
    );

    return {
        keyword: typeof parsed.keyword === 'string' ? parsed.keyword : DEFAULT_HISTORY_FILTER.keyword,
        activeEngine,
        liuyaoCategory: pick(LIUYAO_CATEGORY_OPTIONS, parsed.liuyaoCategory, DEFAULT_HISTORY_FILTER.liuyaoCategory),
        meihuaCategory: pick(MEIHUA_CATEGORY_OPTIONS, parsed.meihuaCategory, DEFAULT_HISTORY_FILTER.meihuaCategory),
        baziCategory: pick(BAZI_CATEGORY_OPTIONS, parsed.baziCategory, DEFAULT_HISTORY_FILTER.baziCategory),
        ziweiCategory: pick(ZIWEI_CATEGORY_OPTIONS, parsed.ziweiCategory, DEFAULT_HISTORY_FILTER.ziweiCategory),
        baziCompatibilityCategory: pick(BAZI_COMPATIBILITY_CATEGORY_OPTIONS, parsed.baziCompatibilityCategory, DEFAULT_HISTORY_FILTER.baziCompatibilityCategory),
    };
}

function buildPersistedFilters(filter: HistoryFilterState): Omit<HistoryFilterState, 'keyword'> {
    const { keyword: _keyword, ...rest } = filter;
    return rest;
}

type HistoryStyles = ReturnType<typeof makeStyles>;

interface HistoryRowProps {
    record: RecordSummary;
    first: boolean;
    last: boolean;
    palette: ResultPalette;
    styles: HistoryStyles;
    onOpen: (record: RecordSummary) => void;
    onToggleFavorite: (id: string) => void;
    onRequestDelete: (record: RecordSummary) => void;
}

const HistoryRow = memo(function HistoryRow({ record, first, last, palette, styles, onOpen, onToggleFavorite, onRequestDelete }: HistoryRowProps) {
    const swipeRef = useRef<SwipeableMethods>(null);
    const metaKey = getHistoryMetaLabel(record);
    const { title, sub, hasQuestion } = describeRecord(record);
    const lines = record.engineType === 'liuyao' || record.engineType === 'meihua' ? LINES_BY_NAME.get(record.title) : undefined;
    const seal = sealOf(record, metaKey);
    const date = new Date(record.createdAt);
    const time = Number.isNaN(date.getTime()) ? '' : `${pad(date.getHours())}:${pad(date.getMinutes())}`;
    const corner = [first && styles.rowFirst, last && styles.rowLast];

    return (
        <View style={[styles.rowShell, corner, !first && styles.rowRule]}>
            <ReanimatedSwipeable
                ref={swipeRef}
                friction={2}
                rightThreshold={36}
                overshootRight={false}
                renderRightActions={() => (
                    <Pressable
                        style={styles.deleteAction}
                        onPress={() => {
                            swipeRef.current?.close();
                            onRequestDelete(record);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`删除 ${title}`}
                    >
                        <Text style={styles.deleteText}>删除</Text>
                    </Pressable>
                )}
            >
                <View style={styles.row}>
                <GesturePressable
                    style={({ pressed }) => [styles.rowBody, pressed && styles.pressed]}
                    onPress={() => onOpen(record)}
                    onLongPress={() => onRequestDelete(record)}
                    accessibilityRole="button"
                    accessibilityLabel={title}
                    accessibilityHint="长按或左滑可删除"
                >
                    <View style={styles.thumb}>
                        {lines ? (
                            <HexagramLines lines={lines} width={20} barHeight={2.6} gap={2} trigramGap={2} color={palette.gold} movingColor={palette.gold} />
                        ) : (
                            <Text style={[styles.seal, { color: seal === '坤' ? palette.vermilion : seal === '乾' ? palette.element.水 : palette.gold }]}>{seal}</Text>
                        )}
                    </View>
                    <View style={styles.rowMain}>
                        <Text style={styles.rowTitle} numberOfLines={1}>{title}</Text>
                        <Text style={[styles.rowSub, !hasQuestion && styles.rowSubMuted]} numberOfLines={1}>{sub}</Text>
                    </View>
                    <View style={styles.rowSide}>
                        <Text style={styles.rowTime}>{time}</Text>
                        <Text style={styles.rowTag}>{META_LABELS[metaKey] || ''}</Text>
                    </View>
                </GesturePressable>
                    <GesturePressable
                        onPress={() => onToggleFavorite(record.id)}
                        style={styles.star}
                        hitSlop={6}
                        accessibilityRole="button"
                        accessibilityLabel={record.isFavorite ? '取消收藏' : '收藏'}
                    >
                        <StarIcon size={18} color={record.isFavorite ? palette.gold : palette.muted} filled={record.isFavorite} />
                    </GesturePressable>
                </View>
            </ReanimatedSwipeable>
        </View>
    );
});

export default function HistoryPage() {
    const { Colors } = useTheme();
    const insets = useSafeAreaInsets();
    const palette = useMemo(() => buildResultPalette(Colors), [Colors]);
    const styles = useMemo(() => makeStyles(palette), [palette]);
    const [records, setRecords] = useState<RecordSummary[]>([]);
    const [filters, setFilters] = useState<HistoryFilterState>(DEFAULT_HISTORY_FILTER);
    const [filtersReady, setFiltersReady] = useState(false);
    const [deletingRecord, setDeletingRecord] = useState<RecordSummary | null>(null);
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

    const persisted = JSON.stringify(buildPersistedFilters(filters));
    useEffect(() => {
        if (!filtersReady) {
            return;
        }
        void AsyncStorage.setItem(HISTORY_FILTER_STORAGE_KEY, persisted);
    }, [persisted, filtersReady]);

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
        if (!deletingRecord) {
            return;
        }
        await clearAIAnalysisJob(deletingRecord.engineType, deletingRecord.id);
        await deleteRecord(deletingRecord.id);
        setDeletingRecord(null);
        await loadRecords();
    };

    const handleToggleFavorite = useCallback((id: string) => {
        void toggleFavorite(id).then(loadRecords);
    }, [loadRecords]);

    const handleOpen = useCallback((record: RecordSummary) => {
        router.push(getRecordRoute(record.engineType, record.id));
    }, []);

    const sections = useMemo(
        () => groupByDay(filterHistoryRecords(records, { ...filters, keyword: deferredKeyword }), new Date()),
        [deferredKeyword, filters, records],
    );
    const engineCounts = useMemo(() => {
        const counts: Partial<Record<HistoryActiveEngine, number>> = {};
        records.forEach((record) => { counts[record.engineType] = (counts[record.engineType] ?? 0) + 1; });
        return counts;
    }, [records]);
    const favoriteCount = records.filter((record) => record.isFavorite).length;
    const currentEngine = ENGINE_OPTIONS.find((item) => item.key === filters.activeEngine) || ENGINE_OPTIONS[0];
    const categoryOptions: Array<{ key: string; label: string }> = filters.activeEngine === 'liuyao'
        ? LIUYAO_CATEGORY_OPTIONS
        : filters.activeEngine === 'meihua'
            ? MEIHUA_CATEGORY_OPTIONS
            : filters.activeEngine === 'bazi'
                ? BAZI_CATEGORY_OPTIONS
                : filters.activeEngine === 'baziCompatibility'
                    ? BAZI_COMPATIBILITY_CATEGORY_OPTIONS
                    : ZIWEI_CATEGORY_OPTIONS;
    const activeCategory = getActiveHistoryCategory(filters);

    const handleCategoryChange = (category: string) => {
        setFilters((prev) => {
            if (prev.activeEngine === 'liuyao') return { ...prev, liuyaoCategory: category as LiuyaoHistoryCategory };
            if (prev.activeEngine === 'meihua') return { ...prev, meihuaCategory: category as MeihuaHistoryCategory };
            if (prev.activeEngine === 'bazi') return { ...prev, baziCategory: category as BaziHistoryCategory };
            if (prev.activeEngine === 'baziCompatibility') return { ...prev, baziCompatibilityCategory: category as BaziCompatibilityHistoryCategory };
            return { ...prev, ziweiCategory: category as ZiweiHistoryCategory };
        });
    };

    const hasEngineRecords = (engineCounts[filters.activeEngine] ?? 0) > 0;

    return (
        <View style={styles.container}>
            <StatusBarDecor />
            <View style={styles.header}>
                <View>
                    <Text style={styles.brand}>卷宗</Text>
                    <Text style={styles.brandSub}>起卦与命盘的历史记录</Text>
                </View>
                <Text style={styles.headerMeta}>共 {records.length} 份 · 收藏 {favoriteCount}</Text>
            </View>

            <View style={styles.tabs} accessibilityRole="tablist">
                {ENGINE_OPTIONS.map((option) => {
                    const active = filters.activeEngine === option.key;
                    return (
                        <Pressable
                            key={option.key}
                            style={styles.tab}
                            onPress={() => setFilters((prev) => ({ ...prev, activeEngine: option.key }))}
                            accessibilityRole="tab"
                            accessibilityLabel={`${option.label} ${engineCounts[option.key] ?? 0} 份`}
                            accessibilityState={{ selected: active }}
                        >
                            <Text style={[styles.tabText, active && styles.tabTextActive]}>
                                {option.label}<Text style={styles.tabCount}> {engineCounts[option.key] ?? 0}</Text>
                            </Text>
                            {active ? <View style={styles.tabIndicator} /> : null}
                        </Pressable>
                    );
                })}
            </View>

            <View style={styles.filterArea}>
                <View style={styles.search}>
                    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                        <Circle cx={11} cy={11} r={6.5} stroke={palette.muted} strokeWidth={1.8} />
                        <Path d="M16 16l4 4" stroke={palette.muted} strokeWidth={1.8} strokeLinecap="round" />
                    </Svg>
                    <TextInput
                        style={styles.searchInput}
                        value={filters.keyword}
                        onChangeText={(text) => setFilters((prev) => ({ ...prev, keyword: text }))}
                        placeholder={currentEngine.placeholder}
                        placeholderTextColor={palette.muted}
                        clearButtonMode="while-editing"
                        accessibilityLabel="搜索记录"
                    />
                </View>
                <View style={styles.segment} accessibilityRole="radiogroup">
                    {categoryOptions.map((option) => {
                        const on = activeCategory === option.key;
                        return (
                            <Pressable
                                key={option.key}
                                style={[styles.segmentBtn, on && styles.segmentBtnOn]}
                                onPress={() => handleCategoryChange(option.key)}
                                accessibilityRole="radio"
                                accessibilityLabel={option.label}
                                accessibilityState={{ checked: on }}
                            >
                                <Text style={[styles.segmentText, on && styles.segmentTextOn]}>{option.label}</Text>
                            </Pressable>
                        );
                    })}
                </View>
            </View>

            {sections.length === 0 ? (
                <View style={styles.empty}>
                    <Text style={styles.emptyTitle}>{hasEngineRecords ? '没有匹配的记录' : `还没有${currentEngine.label}记录`}</Text>
                    <Text style={styles.emptyHint}>{hasEngineRecords ? '换个关键词或筛选条件试试' : '起卦或排盘后的记录会保存在这里'}</Text>
                </View>
            ) : (
                <SectionList
                    sections={sections}
                    keyExtractor={(item) => item.id}
                    stickySectionHeadersEnabled={false}
                    contentContainerStyle={[styles.listContent, { paddingBottom: 64 + Math.max(insets.bottom, 16) + 24 }]}
                    showsVerticalScrollIndicator={false}
                    initialNumToRender={14}
                    windowSize={8}
                    renderSectionHeader={({ section }) => (
                        <View style={styles.sectionHead}>
                            <Text style={styles.sectionLabel}>{section.label}</Text>
                            <Text style={styles.sectionMeta}>{section.meta}</Text>
                        </View>
                    )}
                    renderItem={({ item, index, section }) => (
                        <HistoryRow
                            record={item}
                            first={index === 0}
                            last={index === section.data.length - 1}
                            palette={palette}
                            styles={styles}
                            onOpen={handleOpen}
                            onToggleFavorite={handleToggleFavorite}
                            onRequestDelete={setDeletingRecord}
                        />
                    )}
                    ListFooterComponent={<Text style={styles.footer}>左滑或长按记录可删除</Text>}
                />
            )}

            <ConfirmModal
                visible={deletingRecord !== null}
                title="删除记录"
                message={`确定要删除"${deletingRecord?.title ?? ''}"吗？删除后将无法恢复。`}
                confirmText="删除"
                destructive
                onConfirm={confirmDelete}
                onCancel={() => setDeletingRecord(null)}
            />
        </View>
    );
}

const makeStyles = (palette: ResultPalette) => StyleSheet.create({
    container: { flex: 1, backgroundColor: palette.page },
    header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingTop: 20, paddingHorizontal: 16 },
    brand: { fontFamily: SERIF, fontSize: 28, lineHeight: 36, fontWeight: '500', letterSpacing: 6, color: palette.heading },
    brandSub: { fontSize: 11, lineHeight: 16, letterSpacing: 2, color: palette.gold },
    headerMeta: { fontSize: 12, lineHeight: 16, color: palette.muted },
    tabs: { flexDirection: 'row', gap: 20, marginTop: 8, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: palette.cardBorder },
    tab: { height: 42, justifyContent: 'center', paddingHorizontal: 2 },
    tabText: { fontSize: 15, fontWeight: '500', color: palette.muted },
    tabTextActive: { fontWeight: '700', color: palette.heading },
    tabCount: { fontSize: 10, fontWeight: '500', color: palette.muted },
    tabIndicator: { position: 'absolute', left: '50%', bottom: -1, width: 18, height: 2, marginLeft: -9, borderRadius: 1, backgroundColor: palette.vermilion },
    filterArea: { paddingTop: 12, paddingHorizontal: 16, gap: 10 },
    search: {
        height: 40, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12,
        borderRadius: 12, borderWidth: 1, borderColor: palette.cardBorder, backgroundColor: palette.segTrack,
    },
    searchInput: { flex: 1, height: '100%', fontSize: 14, color: palette.heading, paddingVertical: 0 },
    segment: { alignSelf: 'flex-start', flexDirection: 'row', gap: 2, padding: 2, borderRadius: 15, borderWidth: 1, borderColor: palette.segBorder, backgroundColor: palette.segTrack },
    segmentBtn: { height: 26, paddingHorizontal: 12, borderRadius: 13, borderWidth: 1, borderColor: 'transparent', justifyContent: 'center' },
    segmentBtnOn: { borderColor: palette.segBorder, backgroundColor: palette.segOn },
    segmentText: { fontSize: 12.5, fontWeight: '600', color: palette.muted },
    segmentTextOn: { color: palette.ink },
    listContent: { paddingHorizontal: 16, paddingTop: 6 },
    sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 10, marginBottom: 6 },
    sectionLabel: { fontSize: 12, lineHeight: 16, color: palette.muted },
    sectionMeta: { fontSize: 11, lineHeight: 16, color: palette.muted, opacity: 0.8 },
    rowShell: { overflow: 'hidden', borderLeftWidth: 1, borderRightWidth: 1, borderColor: palette.cardBorder, backgroundColor: palette.card },
    rowFirst: { borderTopWidth: 1, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
    rowLast: { borderBottomWidth: 1, borderBottomLeftRadius: 16, borderBottomRightRadius: 16 },
    rowRule: { borderTopWidth: 1, borderTopColor: palette.cardBorder },
    row: { flexDirection: 'row', alignItems: 'center', paddingRight: 6, backgroundColor: palette.card },
    rowBody: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingLeft: 12 },
    pressed: { opacity: 0.75 },
    thumb: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.segTrack },
    seal: { fontFamily: SERIF, fontSize: 16, fontWeight: '700' },
    rowMain: { flex: 1, minWidth: 0 },
    rowTitle: { fontSize: 15, lineHeight: 21, fontWeight: '700', color: palette.heading },
    rowSub: { fontSize: 12.5, lineHeight: 18, color: palette.body },
    rowSubMuted: { color: palette.muted },
    rowSide: { alignItems: 'flex-end', gap: 3 },
    rowTime: { fontSize: 12, lineHeight: 16, color: palette.muted, fontVariant: ['tabular-nums'] },
    rowTag: { paddingHorizontal: 5, borderRadius: 4, overflow: 'hidden', fontSize: 10.5, lineHeight: 15, color: palette.chipInk, backgroundColor: palette.chipBg },
    star: { width: 32, height: 40, alignItems: 'center', justifyContent: 'center' },
    deleteAction: { width: 72, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.vermilion },
    deleteText: { fontSize: 13, fontWeight: '700', color: palette.sealText },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, paddingBottom: 120 },
    emptyTitle: { fontSize: 15, fontWeight: '600', color: palette.heading },
    emptyHint: { fontSize: 13, color: palette.muted },
    footer: { marginTop: 12, textAlign: 'center', fontSize: 11, lineHeight: 16, color: palette.muted },
});
