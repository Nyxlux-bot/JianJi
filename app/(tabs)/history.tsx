/**
 * 历史记录页面
 * 展示所有排盘记录，支持查看和删除
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    FlatList, TextInput,
} from 'react-native';
import StatusBarDecor from '../../src/components/StatusBarDecor';
import { router, useFocusEffect } from 'expo-router';
import { Spacing, FontSize, BorderRadius } from '../../src/theme/colors';
import { TrashIcon, ChevronRightIcon, StarIcon } from '../../src/components/Icons';
import { getAllRecords, deleteRecord, toggleFavorite, RecordSummary } from '../../src/db/database';
import ConfirmModal from '../../src/components/ConfirmModal';
import { useTheme } from "../../src/theme/ThemeContext";
import { DivinationMethod } from '../../src/core/liuyao-data';
import { DEFAULT_HISTORY_FILTER, filterHistoryRecords, HistoryFilterState } from '../../src/utils/history-filter';

const METHOD_CN: Record<string, string> = {
    time: '时间', coin: '硬币', number: '数字', manual: '手动',
};

export default function HistoryPage() {
    const { Colors } = useTheme();
    const styles = makeStyles(Colors);
    const [records, setRecords] = useState<RecordSummary[]>([]);
    const [filters, setFilters] = useState<HistoryFilterState>(DEFAULT_HISTORY_FILTER);
    const [deleteModalVisible, setDeleteModalVisible] = useState(false);
    const [deletingRecord, setDeletingRecord] = useState<{ id: string, name: string } | null>(null);

    const loadRecords = useCallback(async () => {
        const data = await getAllRecords();
        setRecords(data);
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadRecords();
        }, [loadRecords])
    );

    const confirmDelete = async () => {
        if (deletingRecord?.id) {
            await deleteRecord(deletingRecord.id);
            setDeleteModalVisible(false);
            setDeletingRecord(null);
            loadRecords();
        }
    };

    const handleDelete = (id: string, name: string) => {
        setDeletingRecord({ id, name });
        setDeleteModalVisible(true);
    };

    const handleToggleFavorite = async (id: string) => {
        await toggleFavorite(id);
        loadRecords();
    };

    const handleToggleMethod = (method: DivinationMethod) => {
        setFilters((prev) => {
            const exists = prev.methods.includes(method);
            return {
                ...prev,
                methods: exists ? prev.methods.filter(m => m !== method) : [...prev.methods, method],
            };
        });
    };

    const filteredRecords = useMemo(
        () => filterHistoryRecords(records, filters),
        [records, filters]
    );

    const formatDate = (iso: string) => {
        const d = new Date(iso);
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const hh = String(d.getHours()).padStart(2, '0');
        const mi = String(d.getMinutes()).padStart(2, '0');
        return `${d.getFullYear()}-${mm}-${dd} ${hh}:${mi}`;
    };

    const renderItem = ({ item }: { item: RecordSummary }) => (
        <TouchableOpacity
            style={styles.recordCard}
            activeOpacity={0.7}
            onPress={() => router.push(`/result/${item.id}`)}
        >
            <View style={styles.recordLeft}>
                <View style={styles.recordHeader}>
                    <Text style={styles.recordGuaName}>{item.guaName}</Text>
                    {item.bianGuaName ? (
                        <>
                            <ChevronRightIcon size={12} color={Colors.text.tertiary} />
                            <Text style={styles.recordBianName}>{item.bianGuaName}</Text>
                        </>
                    ) : null}
                </View>
                <Text style={styles.recordMeta}>
                    {METHOD_CN[item.method] || item.method} · {formatDate(item.createdAt)}
                </Text>
                {item.question ? (
                    <Text style={styles.recordQuestion} numberOfLines={1}>
                        {item.question}
                    </Text>
                ) : null}
            </View>
            <View style={styles.actions}>
                <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => handleToggleFavorite(item.id)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <StarIcon size={17} color={item.isFavorite ? Colors.accent.gold : Colors.text.tertiary} filled={item.isFavorite} />
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => handleDelete(item.id, item.guaName)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <TrashIcon size={16} color={Colors.text.tertiary} />
                </TouchableOpacity>
            </View>
        </TouchableOpacity>
    );

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
                    onChangeText={(text) => setFilters(prev => ({ ...prev, keyword: text }))}
                    placeholder="搜索占问、本卦、变卦"
                    placeholderTextColor={Colors.text.tertiary}
                    clearButtonMode="while-editing"
                />
                <View style={styles.filterRow}>
                    <TouchableOpacity
                        style={[styles.filterChip, filters.onlyFavorite && styles.filterChipActive]}
                        onPress={() => setFilters(prev => ({ ...prev, onlyFavorite: !prev.onlyFavorite }))}
                    >
                        <Text style={[styles.filterChipText, filters.onlyFavorite && styles.filterChipTextActive]}>
                            仅收藏
                        </Text>
                    </TouchableOpacity>
                    {(Object.keys(METHOD_CN) as DivinationMethod[]).map((method) => {
                        const active = filters.methods.includes(method);
                        return (
                            <TouchableOpacity
                                key={method}
                                style={[styles.filterChip, active && styles.filterChipActive]}
                                onPress={() => handleToggleMethod(method)}
                            >
                                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                                    {METHOD_CN[method]}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>

            {records.length === 0 ? (
                <View style={styles.empty}>
                    <Text style={styles.emptyText}>暂无排盘记录</Text>
                    <Text style={styles.emptyHint}>起卦后的记录将保存在这里</Text>
                </View>
            ) : filteredRecords.length === 0 ? (
                <View style={styles.empty}>
                    <Text style={styles.emptyText}>未找到匹配记录</Text>
                    <Text style={styles.emptyHint}>调整关键词或筛选条件后重试</Text>
                </View>
            ) : (
                <FlatList
                    data={filteredRecords}
                    keyExtractor={item => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                />
            )}

            <ConfirmModal
                visible={deleteModalVisible}
                title="删除记录"
                message={`确定要删除"${deletingRecord?.name}"吗？删除后将无法恢复。`}
                confirmText="删除"
                destructive={true}
                onConfirm={confirmDelete}
                onCancel={() => setDeleteModalVisible(false)}
            />
        </View>
    );
}

const makeStyles = (Colors: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.bg.primary },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    },
    backBtn: { width: 40, height: 40, justifyContent: 'center' },
    headerTitle: { fontSize: FontSize.lg, color: Colors.text.heading, fontWeight: '400' },
    filterArea: {
        paddingHorizontal: Spacing.md,
        paddingBottom: Spacing.md,
        gap: Spacing.sm,
    },
    searchInput: {
        minHeight: 44,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
        backgroundColor: Colors.bg.card,
        color: Colors.text.primary,
        paddingHorizontal: Spacing.md,
        fontSize: FontSize.md,
    },
    filterRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
    },
    filterChip: {
        minHeight: 36,
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
    },
    filterChipTextActive: {
        color: Colors.accent.gold,
        fontWeight: '600',
    },
    listContent: { paddingHorizontal: Spacing.md, paddingBottom: 40 },
    recordCard: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: Colors.bg.card, borderRadius: BorderRadius.lg,
        padding: Spacing.lg, marginBottom: Spacing.sm,
        borderWidth: 0.5, borderColor: Colors.border.subtle,
    },
    recordLeft: { flex: 1 },
    recordHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
    recordGuaName: { fontSize: FontSize.lg, color: Colors.text.heading, fontWeight: '400' },
    recordBianName: { fontSize: FontSize.md, color: Colors.text.secondary },
    recordMeta: {
        fontSize: FontSize.xs, color: Colors.text.tertiary, marginTop: Spacing.xs,
    },
    recordQuestion: {
        fontSize: FontSize.sm, color: Colors.text.secondary, marginTop: Spacing.xs,
    },
    actions: {
        alignItems: 'center',
        marginLeft: Spacing.sm,
    },
    actionBtn: {
        width: 40, height: 40, justifyContent: 'center', alignItems: 'center',
    },
    empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyText: { fontSize: FontSize.lg, color: Colors.text.tertiary },
    emptyHint: { fontSize: FontSize.sm, color: Colors.text.tertiary, marginTop: Spacing.sm },
});
