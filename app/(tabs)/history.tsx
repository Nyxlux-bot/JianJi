/**
 * 历史记录页面
 * 展示所有排盘记录，支持查看和删除
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    FlatList, Alert,
} from 'react-native';
import StatusBarDecor from '../../src/components/StatusBarDecor';
import { router, useFocusEffect } from 'expo-router';
import { Spacing, FontSize, BorderRadius } from '../../src/theme/colors';
import { BackIcon, TrashIcon, ChevronRightIcon } from '../../src/components/Icons';
import { getAllRecords, deleteRecord, RecordSummary } from '../../src/db/database';
import ConfirmModal from '../../src/components/ConfirmModal';
import { useTheme } from "../../src/theme/ThemeContext";

const METHOD_CN: Record<string, string> = {
    time: '时间', coin: '硬币', number: '数字', manual: '手动',
};

export default function HistoryPage() {
    const { Colors } = useTheme();
    const styles = makeStyles(Colors);
    const [records, setRecords] = useState<RecordSummary[]>([]);
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
            <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => handleDelete(item.id, item.guaName)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
                <TrashIcon size={16} color={Colors.text.tertiary} />
            </TouchableOpacity>
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

            {records.length === 0 ? (
                <View style={styles.empty}>
                    <Text style={styles.emptyText}>暂无排盘记录</Text>
                    <Text style={styles.emptyHint}>起卦后的记录将保存在这里</Text>
                </View>
            ) : (
                <FlatList
                    data={records}
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
    deleteBtn: {
        width: 36, height: 36, justifyContent: 'center', alignItems: 'center',
    },
    empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyText: { fontSize: FontSize.lg, color: Colors.text.tertiary },
    emptyHint: { fontSize: FontSize.sm, color: Colors.text.tertiary, marginTop: Spacing.sm },
});
