import React, { useEffect, useMemo, useState } from 'react';
import {
    Modal,
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
} from 'react-native';
import { PanResult } from '../core/liuyao-calc';
import { BorderRadius, FontSize, Spacing } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { ImportConflictPolicy } from '../db/database';

interface ImportPreviewModalProps {
    visible: boolean;
    records: PanResult[];
    duplicateCount: number;
    loading?: boolean;
    allowEmptySelection?: boolean;
    onCancel: () => void;
    onConfirm: (payload: { selectedRecords: PanResult[]; conflictPolicy: ImportConflictPolicy }) => void;
}

function formatTime(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
        return iso;
    }
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd} ${hh}:${mi}`;
}

export default function ImportPreviewModal({
    visible,
    records,
    duplicateCount,
    loading = false,
    allowEmptySelection = false,
    onCancel,
    onConfirm,
}: ImportPreviewModalProps) {
    const { Colors } = useTheme();
    const styles = useMemo(() => makeStyles(Colors), [Colors]);

    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [conflictPolicy, setConflictPolicy] = useState<ImportConflictPolicy>('skip');

    useEffect(() => {
        if (!visible) {
            return;
        }
        setSelectedIds(new Set(records.map(record => record.id)));
        setConflictPolicy('skip');
    }, [visible, records]);

    const selectedRecords = useMemo(
        () => records.filter(record => selectedIds.has(record.id)),
        [records, selectedIds]
    );
    const canConfirm = !loading && (allowEmptySelection || selectedRecords.length > 0);

    const toggleRecord = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const renderItem = ({ item }: { item: PanResult }) => {
        const checked = selectedIds.has(item.id);
        return (
            <TouchableOpacity style={styles.recordRow} onPress={() => toggleRecord(item.id)}>
                <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                    <Text style={[styles.checkboxText, checked && styles.checkboxTextChecked]}>{checked ? '[x]' : '[ ]'}</Text>
                </View>
                <View style={styles.recordInfo}>
                    <Text style={styles.recordTitle} numberOfLines={1}>{item.benGua.fullName}</Text>
                    <Text style={styles.recordMeta} numberOfLines={1}>{formatTime(item.createdAt)}</Text>
                    {item.question ? <Text style={styles.recordQuestion} numberOfLines={1}>{item.question}</Text> : null}
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent
            onRequestClose={onCancel}
        >
            <View style={styles.mask}>
                <View style={styles.panel}>
                    <Text style={styles.title}>恢复预览</Text>
                    <Text style={styles.summaryText}>备份记录：{records.length} 条</Text>
                    <Text style={styles.summaryText}>重复记录：{duplicateCount} 条</Text>
                    <Text style={styles.summaryHint}>可勾选要导入的记录，默认全选。</Text>

                    <View style={styles.policyBox}>
                        <Text style={styles.policyTitle}>重复记录处理</Text>
                        <View style={styles.policyRow}>
                            <TouchableOpacity
                                style={[styles.policyBtn, conflictPolicy === 'skip' && styles.policyBtnActive]}
                                onPress={() => setConflictPolicy('skip')}
                            >
                                <Text style={[styles.policyBtnText, conflictPolicy === 'skip' && styles.policyBtnTextActive]}>
                                    跳过重复
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.policyBtn, conflictPolicy === 'replace' && styles.policyBtnActive]}
                                onPress={() => setConflictPolicy('replace')}
                            >
                                <Text style={[styles.policyBtnText, conflictPolicy === 'replace' && styles.policyBtnTextActive]}>
                                    覆盖重复
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <FlatList
                        data={records}
                        keyExtractor={(item, index) => `${item.id}-${index}`}
                        renderItem={renderItem}
                        style={styles.list}
                        showsVerticalScrollIndicator={false}
                    />

                    <Text style={styles.selectionText}>已选择 {selectedRecords.length} / {records.length} 条</Text>

                    <View style={styles.footer}>
                        <TouchableOpacity
                            style={[styles.footerBtn, styles.cancelBtn]}
                            onPress={onCancel}
                            disabled={loading}
                        >
                            <Text style={styles.cancelBtnText}>取消</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[
                                styles.footerBtn,
                                styles.confirmBtn,
                                !canConfirm && styles.confirmBtnDisabled,
                            ]}
                            onPress={() => onConfirm({ selectedRecords, conflictPolicy })}
                            disabled={!canConfirm}
                        >
                            <Text style={styles.confirmBtnText}>{loading ? '导入中...' : '开始导入'}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const makeStyles = (Colors: any) => StyleSheet.create({
    mask: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'flex-end',
    },
    panel: {
        maxHeight: '88%',
        backgroundColor: Colors.bg.primary,
        borderTopLeftRadius: BorderRadius.lg,
        borderTopRightRadius: BorderRadius.lg,
        padding: Spacing.lg,
    },
    title: {
        fontSize: FontSize.lg,
        color: Colors.text.heading,
        fontWeight: '600',
        marginBottom: Spacing.sm,
    },
    summaryText: {
        fontSize: FontSize.sm,
        color: Colors.text.secondary,
        marginBottom: 4,
    },
    summaryHint: {
        fontSize: FontSize.xs,
        color: Colors.text.tertiary,
        marginBottom: Spacing.md,
    },
    policyBox: {
        borderWidth: 1,
        borderColor: Colors.border.subtle,
        borderRadius: BorderRadius.md,
        padding: Spacing.sm,
        marginBottom: Spacing.md,
        backgroundColor: Colors.bg.card,
    },
    policyTitle: {
        fontSize: FontSize.sm,
        color: Colors.text.secondary,
        marginBottom: Spacing.sm,
    },
    policyRow: {
        flexDirection: 'row',
        gap: Spacing.sm,
    },
    policyBtn: {
        flex: 1,
        minHeight: 40,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Colors.bg.elevated,
    },
    policyBtnActive: {
        borderColor: Colors.accent.gold,
        backgroundColor: Colors.bg.card,
    },
    policyBtnText: {
        fontSize: FontSize.sm,
        color: Colors.text.secondary,
    },
    policyBtnTextActive: {
        color: Colors.accent.gold,
        fontWeight: '600',
    },
    list: {
        maxHeight: 260,
    },
    recordRow: {
        minHeight: 52,
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.bg.card,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
        paddingHorizontal: Spacing.sm,
        paddingVertical: Spacing.sm,
        marginBottom: Spacing.sm,
        flexDirection: 'row',
        alignItems: 'center',
    },
    checkbox: {
        width: 44,
        minHeight: 44,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: BorderRadius.sm,
    },
    checkboxChecked: {
        backgroundColor: Colors.bg.elevated,
    },
    checkboxText: {
        color: Colors.text.tertiary,
        fontSize: FontSize.sm,
    },
    checkboxTextChecked: {
        color: Colors.accent.gold,
    },
    recordInfo: {
        flex: 1,
    },
    recordTitle: {
        fontSize: FontSize.md,
        color: Colors.text.heading,
    },
    recordMeta: {
        fontSize: FontSize.xs,
        color: Colors.text.tertiary,
        marginTop: 2,
    },
    recordQuestion: {
        fontSize: FontSize.xs,
        color: Colors.text.secondary,
        marginTop: 2,
    },
    selectionText: {
        fontSize: FontSize.xs,
        color: Colors.text.tertiary,
        marginTop: Spacing.xs,
    },
    footer: {
        flexDirection: 'row',
        gap: Spacing.sm,
        marginTop: Spacing.md,
    },
    footerBtn: {
        flex: 1,
        minHeight: 44,
        borderRadius: BorderRadius.md,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
    },
    cancelBtn: {
        borderColor: Colors.border.subtle,
        backgroundColor: Colors.bg.elevated,
    },
    cancelBtnText: {
        color: Colors.text.secondary,
        fontSize: FontSize.md,
    },
    confirmBtn: {
        borderColor: Colors.accent.gold,
        backgroundColor: Colors.accent.gold,
    },
    confirmBtnDisabled: {
        opacity: 0.5,
    },
    confirmBtnText: {
        color: Colors.text.inverse,
        fontSize: FontSize.md,
        fontWeight: '600',
    },
});
