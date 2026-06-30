import React, { useCallback, useState } from 'react';
import {
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import StatusBarDecor from '../../../src/components/StatusBarDecor';
import { BackIcon, BaGuaIcon, ChevronRightIcon, SparklesIcon } from '../../../src/components/Icons';
import { CustomAlert } from '../../../src/components/CustomAlertProvider';
import { BaziResult } from '../../../src/core/bazi-types';
import { getAllRecords, getRecord, saveRecord } from '../../../src/db/database';
import { calculateBaziMatch } from '../../../src/features/bazi/match/rules';
import { buildBaziMatchSummarySubtitle, buildBaziMatchSummaryTitle } from '../../../src/features/bazi/match/formatter';
import { BorderRadius, FontSize, Spacing } from '../../../src/theme/colors';
import { useTheme } from '../../../src/theme/ThemeContext';

interface BaziChoice {
    id: string;
    title: string;
    subtitle: string;
    result: BaziResult;
}

type Side = 'male' | 'female';

function isMale(result: BaziResult): boolean {
    return result.gender === 1;
}

function isFemale(result: BaziResult): boolean {
    return result.gender === 0;
}

export default function BaziMatchSelectPage() {
    const { Colors } = useTheme();
    const styles = makeStyles(Colors);
    const [maleRecords, setMaleRecords] = useState<BaziChoice[]>([]);
    const [femaleRecords, setFemaleRecords] = useState<BaziChoice[]>([]);
    const [selectedMaleId, setSelectedMaleId] = useState<string | null>(null);
    const [selectedFemaleId, setSelectedFemaleId] = useState<string | null>(null);
    const [pickerSide, setPickerSide] = useState<Side | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const loadRecords = useCallback(async () => {
        setLoading(true);
        try {
            const summaries = await getAllRecords();
            const baziSummaries = summaries.filter((item) => item.engineType === 'bazi');
            const details = await Promise.all(baziSummaries.map(async (summary) => {
                const detail = await getRecord(summary.id);
                if (!detail || detail.engineType !== 'bazi') {
                    return null;
                }
                return {
                    id: summary.id,
                    title: summary.title,
                    subtitle: summary.subtitle,
                    result: detail.result,
                } as BaziChoice;
            }));
            const choices = details.filter((item): item is BaziChoice => Boolean(item));
            setMaleRecords(choices.filter((item) => isMale(item.result)));
            setFemaleRecords(choices.filter((item) => isFemale(item.result)));
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : '加载八字记录失败';
            CustomAlert.alert('错误', message);
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            void loadRecords();
        }, [loadRecords]),
    );

    const selectedMale = maleRecords.find((item) => item.id === selectedMaleId) || null;
    const selectedFemale = femaleRecords.find((item) => item.id === selectedFemaleId) || null;
    const pickerRecords = pickerSide === 'male' ? maleRecords : femaleRecords;

    const handleCreate = async () => {
        if (!selectedMale || !selectedFemale) {
            CustomAlert.alert('提示', '请先分别选择男方乾造与女方坤造');
            return;
        }
        if (selectedMale.id === selectedFemale.id) {
            CustomAlert.alert('提示', '合盘需要选择两条不同的八字记录');
            return;
        }
        try {
            setSaving(true);
            const result = calculateBaziMatch(selectedMale.result, selectedFemale.result, new Date());
            await saveRecord({
                engineType: 'baziCompatibility',
                result,
                summary: {
                    method: 'baziCompatibility',
                    title: buildBaziMatchSummaryTitle(result),
                    subtitle: buildBaziMatchSummarySubtitle(result),
                },
            });
            router.replace(`/bazi/match/result/${result.id}`);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : '生成合盘失败';
            CustomAlert.alert('错误', message);
        } finally {
            setSaving(false);
        }
    };

    const handleSelectFromPicker = (id: string) => {
        if (pickerSide === 'male') {
            setSelectedMaleId(id);
        } else if (pickerSide === 'female') {
            setSelectedFemaleId(id);
        }
        setPickerSide(null);
    };

    const renderSelectionSlot = (side: Side, selected: BaziChoice | null) => (
        <View style={styles.block}>
            <Text style={styles.blockTitle}>{side === 'male' ? '男方乾造' : '女方坤造'}</Text>
            <TouchableOpacity
                style={[styles.pickCard, selected && styles.pickCardSelected]}
                activeOpacity={0.82}
                onPress={() => setPickerSide(side)}
            >
                {!selected ? (
                    <View style={styles.plusBox}>
                        <Text style={styles.plusText}>＋</Text>
                    </View>
                ) : null}
                <View style={styles.pickMain}>
                    {selected ? (
                        <>
                            <Text style={styles.choiceTitle} numberOfLines={1}>{selected.title}</Text>
                            <Text style={styles.choiceSubtitle} numberOfLines={1}>{selected.subtitle}</Text>
                            <Text style={styles.choicePillars}>{selected.result.fourPillars.join(' ')}</Text>
                        </>
                    ) : (
                        <>
                            <Text style={styles.pickEmptyTitle}>点击选择{side === 'male' ? '男方八字' : '女方八字'}</Text>
                            <Text style={styles.pickEmptyHint}>从八字历史记录中选择</Text>
                        </>
                    )}
                </View>
                <ChevronRightIcon size={16} color={Colors.text.tertiary} />
            </TouchableOpacity>
        </View>
    );

    const noBazi = !loading && maleRecords.length === 0 && femaleRecords.length === 0;

    return (
        <View style={styles.container}>
            <StatusBarDecor />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
                    <BackIcon size={24} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>八字合盘</Text>
                <View style={styles.headerBtn} />
            </View>

            <ScrollView style={styles.content} contentContainerStyle={styles.contentBody} showsVerticalScrollIndicator={false}>
                <View style={styles.heroCard}>
                    <View style={styles.heroIcon}>
                        <BaGuaIcon size={42} color={Colors.accent.gold} />
                    </View>
                    <View style={styles.heroTextWrap}>
                        <Text style={styles.heroTitle}>选择双方八字</Text>
                        <Text style={styles.heroText}>合盘会保存双方快照，原八字后续删除也能回看。</Text>
                    </View>
                </View>

                {loading ? (
                    <Text style={styles.loadingText}>加载中...</Text>
                ) : noBazi ? (
                    <View style={styles.emptyCard}>
                        <SparklesIcon size={28} color={Colors.accent.gold} />
                        <Text style={styles.emptyTitle}>暂无可用八字记录</Text>
                        <Text style={styles.emptyText}>请先完成男方和女方八字排盘，再回来合盘。</Text>
                        <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.push('/bazi/input')} activeOpacity={0.82}>
                            <Text style={styles.secondaryBtnText}>去八字排盘</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <>
                        {renderSelectionSlot('male', selectedMale)}
                        {renderSelectionSlot('female', selectedFemale)}
                    </>
                )}
            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity
                    style={[styles.primaryBtn, (!selectedMale || !selectedFemale || saving) && styles.primaryBtnDisabled]}
                    onPress={handleCreate}
                    disabled={!selectedMale || !selectedFemale || saving}
                    activeOpacity={0.84}
                >
                    <Text style={styles.primaryBtnText}>{saving ? '生成中...' : '生成合盘'}</Text>
                </TouchableOpacity>
            </View>

            <Modal
                visible={Boolean(pickerSide)}
                transparent
                animationType="fade"
                onRequestClose={() => setPickerSide(null)}
            >
                <View style={styles.modalMask}>
                    <View style={styles.pickerPanel}>
                        <View style={styles.pickerHeader}>
                            <View>
                                <Text style={styles.pickerTitle}>{pickerSide === 'male' ? '选择男方乾造' : '选择女方坤造'}</Text>
                                <Text style={styles.pickerSubtitle}>八字历史列表</Text>
                            </View>
                            <TouchableOpacity style={styles.closeBtn} onPress={() => setPickerSide(null)} activeOpacity={0.78}>
                                <Text style={styles.closeBtnText}>关闭</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.pickerList} contentContainerStyle={styles.pickerListBody} showsVerticalScrollIndicator={false}>
                            {pickerRecords.length === 0 ? (
                                <View style={styles.modalEmpty}>
                                    <Text style={styles.emptyTitle}>{pickerSide === 'male' ? '暂无男方八字记录' : '暂无女方八字记录'}</Text>
                                    <Text style={styles.emptyText}>请先完成对应命造的八字排盘。</Text>
                                </View>
                            ) : pickerRecords.map((item) => {
                                const selected = item.id === (pickerSide === 'male' ? selectedMaleId : selectedFemaleId);
                                return (
                                    <TouchableOpacity
                                        key={item.id}
                                        style={[styles.choiceCard, selected && styles.choiceCardActive]}
                                        activeOpacity={0.78}
                                        onPress={() => handleSelectFromPicker(item.id)}
                                    >
                                        <View style={styles.choiceMain}>
                                            <Text style={styles.choiceTitle} numberOfLines={1}>{item.title}</Text>
                                            <Text style={styles.choiceSubtitle} numberOfLines={1}>{item.subtitle}</Text>
                                            <Text style={styles.choicePillars}>{item.result.fourPillars.join(' ')}</Text>
                                        </View>
                                        <ChevronRightIcon size={16} color={selected ? Colors.accent.gold : Colors.text.tertiary} />
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
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
    headerBtn: { width: 40, height: 40, justifyContent: 'center' },
    headerTitle: { fontSize: FontSize.lg, color: Colors.text.heading, fontWeight: '400' },
    content: { flex: 1 },
    contentBody: { padding: Spacing.lg, paddingBottom: 120, gap: Spacing.lg },
    heroCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        borderRadius: BorderRadius.xl,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
        backgroundColor: Colors.bg.card,
        padding: Spacing.lg,
    },
    heroIcon: {
        width: 60,
        height: 60,
        borderRadius: BorderRadius.lg,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.bg.elevated,
    },
    heroTextWrap: { flex: 1 },
    heroTitle: { color: Colors.text.heading, fontSize: FontSize.lg, fontWeight: '600' },
    heroText: { marginTop: 4, color: Colors.text.secondary, fontSize: FontSize.sm, lineHeight: 20 },
    block: { gap: Spacing.sm },
    blockTitle: { color: Colors.text.heading, fontSize: FontSize.md, fontWeight: '600' },
    pickCard: {
        minHeight: 118,
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: BorderRadius.xl,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
        backgroundColor: Colors.bg.card,
        padding: Spacing.lg,
        gap: Spacing.md,
    },
    pickCardSelected: {
        borderColor: Colors.accent.gold,
        backgroundColor: Colors.bg.elevated,
    },
    plusBox: {
        width: 44,
        height: 44,
        borderRadius: BorderRadius.round,
        borderWidth: 1,
        borderColor: Colors.accent.gold,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.bg.elevated,
    },
    plusText: { color: Colors.accent.gold, fontSize: 26, lineHeight: 30, fontWeight: '300' },
    pickMain: { flex: 1, gap: 4 },
    pickEmptyTitle: { color: Colors.text.heading, fontSize: FontSize.md, fontWeight: '600' },
    pickEmptyHint: { color: Colors.text.tertiary, fontSize: FontSize.sm },
    choiceCard: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
        backgroundColor: Colors.bg.card,
        padding: Spacing.md,
        gap: Spacing.sm,
    },
    choiceCardActive: { borderColor: Colors.accent.gold, backgroundColor: Colors.bg.elevated },
    choiceMain: { flex: 1, gap: 3 },
    choiceTitle: { color: Colors.text.heading, fontSize: FontSize.md, fontWeight: '600' },
    choiceSubtitle: { color: Colors.text.secondary, fontSize: FontSize.sm },
    choicePillars: { color: Colors.accent.gold, fontSize: FontSize.sm, letterSpacing: 1 },
    loadingText: { color: Colors.text.secondary, textAlign: 'center', paddingVertical: Spacing.xl },
    emptyCard: {
        alignItems: 'center',
        gap: Spacing.sm,
        borderRadius: BorderRadius.xl,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
        backgroundColor: Colors.bg.card,
        padding: Spacing.xl,
    },
    emptyTitle: { color: Colors.text.heading, fontSize: FontSize.md, fontWeight: '600' },
    emptyText: { color: Colors.text.secondary, fontSize: FontSize.sm, lineHeight: 20 },
    footer: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        padding: Spacing.lg,
        backgroundColor: Colors.bg.primary,
        borderTopWidth: 1,
        borderTopColor: Colors.border.subtle,
    },
    primaryBtn: {
        minHeight: 50,
        borderRadius: BorderRadius.round,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.accent.gold,
    },
    primaryBtnDisabled: { opacity: 0.45 },
    primaryBtnText: { color: Colors.text.inverse, fontSize: FontSize.md, fontWeight: '600' },
    secondaryBtn: {
        marginTop: Spacing.sm,
        minHeight: 42,
        borderRadius: BorderRadius.round,
        borderWidth: 1,
        borderColor: Colors.accent.gold,
        paddingHorizontal: Spacing.lg,
        alignItems: 'center',
        justifyContent: 'center',
    },
    secondaryBtnText: { color: Colors.accent.gold, fontSize: FontSize.sm, fontWeight: '600' },
    modalMask: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.48)',
        justifyContent: 'flex-end',
    },
    pickerPanel: {
        maxHeight: '78%',
        borderTopLeftRadius: BorderRadius.xl,
        borderTopRightRadius: BorderRadius.xl,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
        backgroundColor: Colors.bg.primary,
        paddingTop: Spacing.lg,
    },
    pickerHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.lg,
        paddingBottom: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border.subtle,
    },
    pickerTitle: { color: Colors.text.heading, fontSize: FontSize.lg, fontWeight: '600' },
    pickerSubtitle: { marginTop: 3, color: Colors.text.tertiary, fontSize: FontSize.sm },
    closeBtn: {
        minHeight: 36,
        borderRadius: BorderRadius.round,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
        paddingHorizontal: Spacing.md,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.bg.card,
    },
    closeBtnText: { color: Colors.text.secondary, fontSize: FontSize.sm, fontWeight: '600' },
    pickerList: { flexGrow: 0 },
    pickerListBody: { padding: Spacing.lg, gap: Spacing.sm, paddingBottom: Spacing.xl },
    modalEmpty: {
        alignItems: 'center',
        gap: Spacing.sm,
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
        backgroundColor: Colors.bg.card,
        padding: Spacing.xl,
    },
});
