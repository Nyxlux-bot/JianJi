/**
 * 梅花易数起卦：时间起卦取年月日时数，数字起卦报两数，推演表实时给出本互变。
 */
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import StatusBarDecor from '../../src/components/StatusBarDecor';
import { CustomAlert } from '../../src/components/CustomAlertProvider';
import DateTimePicker from '../../src/components/DateTimePicker';
import WuXingIcon from '../../src/components/WuXingIcon';
import LiuyaoSubjectSelector from '../../src/components/LiuyaoSubjectSelector';
import type { LiuyaoSubject } from '../../src/core/liuyao-data';
import { getGanZhiElement } from '../../src/features/bazi/wuxing';
import HexagramLines from '../../src/components/result/HexagramLines';
import { BackIcon, ChevronRightIcon } from '../../src/components/Icons';
import { useTheme } from '../../src/theme/ThemeContext';
import { buildResultPalette, type ResultPalette } from '../../src/theme/result-palette';
import { saveRecord } from '../../src/db/database';
import { castMeihua, getLinePositionName, getTrigram, type MeihuaCastInput } from '../../src/features/meihua/engine';
import type { MeihuaMethod } from '../../src/features/meihua/types';

const MODES: Array<{ key: MeihuaMethod; label: string; desc: string }> = [
    { key: 'meihua_time', label: '时间起卦', desc: '年月日时取数' },
    { key: 'meihua_number', label: '数字起卦', desc: '随口报两个数' },
];

function formatDateTime(date: Date): string {
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseCount(text: string): number {
    const value = Number.parseInt(text, 10);
    return Number.isFinite(value) && value > 0 ? value : 0;
}

export default function MeihuaInputPage() {
    const { Colors } = useTheme();
    const palette = useMemo(() => buildResultPalette(Colors), [Colors]);
    const styles = useMemo(() => makeStyles(palette, Colors), [palette, Colors]);
    const params = useLocalSearchParams<{ mode?: string }>();
    const [mode, setMode] = useState<MeihuaMethod>(params.mode === 'number' ? 'meihua_number' : 'meihua_time');
    const [castDate, setCastDate] = useState(() => new Date());
    const [pickerVisible, setPickerVisible] = useState(false);
    const [first, setFirst] = useState('');
    const [second, setSecond] = useState('');
    const [question, setQuestion] = useState('');
    const [subject, setSubject] = useState<LiuyaoSubject | null>(null);
    const [recentEvents, setRecentEvents] = useState('');
    const [timeRange, setTimeRange] = useState('');
    const [saving, setSaving] = useState(false);

    const firstValue = parseCount(first);
    const secondValue = parseCount(second);
    const castInput: MeihuaCastInput | null = mode === 'meihua_time'
        ? { method: 'meihua_time' }
        : (firstValue && secondValue ? { method: 'meihua_number', first: firstValue, second: secondValue } : null);
    // 数字起卦以起卦此刻的时辰加数；预览按打开页面的时刻算，正式起卦时再取当下
    const previewDate = mode === 'meihua_time' ? castDate : new Date();
    const preview = useMemo(
        () => (castInput ? castMeihua(castInput, previewDate) : null),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [mode, castDate, firstValue, secondValue],
    );

    const handleCast = async () => {
        if (!castInput) {
            CustomAlert.alert('提示', '请先报上数和下数（正整数）');
            return;
        }
        if (!subject) {
            CustomAlert.alert('提示', '请选择起卦主体');
            return;
        }
        try {
            setSaving(true);
            const result = castMeihua(castInput, mode === 'meihua_time' ? castDate : new Date(), question.trim(), { subject, recentEvents, timeRange });
            await saveRecord({ engineType: 'meihua', result });
            router.push(`/meihua/result/${result.id}`);
        } catch (error: any) {
            CustomAlert.alert('起卦失败', error?.message || '请稍后重试');
        } finally {
            setSaving(false);
        }
    };

    const renderTrigram = (index: number) => {
        const trigram = getTrigram(index);
        return (
            <View style={styles.trigramCell}>
                <View>
                    <WuXingIcon element={trigram.wuxing} size={16} style={[styles.hangIcon, { left: -20, top: 7 }]} />
                    <Text style={[styles.trigramText, { color: palette.element[trigram.wuxing] }]}>{trigram.name}</Text>
                </View>
            </View>
        );
    };

    /** 取象：年支、时支配五行图标与五行色，月、日、报数照常显示 */
    const renderSource = (source: string, key: string) => {
        const element = source.length === 1 ? getGanZhiElement(source) : null;
        if (!element) return <Text key={key} style={styles.cellText}>{source}</Text>;
        return (
            <View key={key} style={styles.trigramCell}>
                <View>
                    <WuXingIcon element={element} size={14} style={[styles.hangIcon, { left: -18, top: 5 }]} />
                    <Text style={[styles.sourceText, { color: palette.element[element] }]}>{source}</Text>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <StatusBarDecor />
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.headerBtn} accessibilityRole="button" accessibilityLabel="返回">
                    <BackIcon size={22} color={palette.ink} />
                </Pressable>
                <Text style={styles.headerTitle}>梅花易数</Text>
                <View style={styles.headerBtn} />
            </View>

            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <Text style={styles.intro}>以时、以数取先天卦数，看体用生克断事。</Text>

                <Text style={styles.label}>起卦方式</Text>
                <View style={styles.modeRow} accessibilityRole="radiogroup">
                    {MODES.map((item) => {
                        const on = item.key === mode;
                        return (
                            <Pressable
                                key={item.key}
                                onPress={() => setMode(item.key)}
                                style={[styles.modeCard, on && styles.modeCardOn]}
                                accessibilityRole="radio"
                                accessibilityLabel={item.label}
                                accessibilityState={{ checked: on }}
                            >
                                <Text style={[styles.modeTitle, on && styles.modeTitleOn]}>{item.label}</Text>
                                <Text style={styles.modeDesc}>{item.desc}</Text>
                            </Pressable>
                        );
                    })}
                </View>

                {mode === 'meihua_time' ? (
                    <>
                        <Text style={styles.label}>起卦时间</Text>
                        <Pressable style={styles.field} onPress={() => setPickerVisible(true)} accessibilityRole="button" accessibilityLabel="选择起卦时间">
                            <Text style={styles.fieldText}>{formatDateTime(castDate)}</Text>
                            <ChevronRightIcon size={16} color={palette.muted} />
                        </Pressable>
                    </>
                ) : (
                    <>
                        <Text style={styles.label}>报数</Text>
                        <View style={styles.numberRow}>
                            {[{ label: '上数', value: first, onChange: setFirst }, { label: '下数', value: second, onChange: setSecond }].map((item) => (
                                <View key={item.label} style={styles.numberField}>
                                    <Text style={styles.numberLabel}>{item.label}</Text>
                                    <TextInput
                                        value={item.value}
                                        onChangeText={(text) => item.onChange(text.replace(/\D/g, '').slice(0, 6))}
                                        keyboardType="number-pad"
                                        placeholder="0"
                                        placeholderTextColor={palette.muted}
                                        style={styles.numberInput}
                                        accessibilityLabel={item.label}
                                    />
                                </View>
                            ))}
                        </View>
                    </>
                )}

                <LiuyaoSubjectSelector value={subject} onChange={setSubject} style={styles.subject} labelStyle={styles.label} />

                <Text style={styles.label}>占问事项（选填）</Text>
                <TextInput
                    value={question}
                    onChangeText={setQuestion}
                    placeholder="心中所想之事…"
                    placeholderTextColor={palette.muted}
                    multiline
                    style={styles.question}
                    accessibilityLabel="占问事项"
                />

                <Text style={styles.label}>近期发生的事（选填）</Text>
                <TextInput
                    value={recentEvents}
                    onChangeText={setRecentEvents}
                    placeholder="如：上周面了两家公司，一家已进二面"
                    placeholderTextColor={palette.muted}
                    multiline
                    style={styles.question}
                    accessibilityLabel="近期发生的事"
                />

                <Text style={styles.label}>想看的时间范围（选填）</Text>
                <TextInput
                    value={timeRange}
                    onChangeText={setTimeRange}
                    placeholder="如：未来三个月、今年年底前"
                    placeholderTextColor={palette.muted}
                    style={styles.singleLine}
                    accessibilityLabel="想看的时间范围"
                />

                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <View style={styles.diamond} />
                        <Text style={styles.cardTitle}>推演</Text>
                        <Text style={styles.cardMeta} numberOfLines={1}>
                            {preview
                                ? (mode === 'meihua_time'
                                    ? `${preview.lunarInfo.yearGanZhi}年 ${preview.lunarInfo.lunarMonthCN}${preview.lunarInfo.lunarDayCN} ${preview.lunarInfo.hourZhi}时`
                                    : `动爻加时辰数（${preview.lunarInfo.hourZhi} ${preview.numbers[2].value}）`)
                                : '报数后实时推演'}
                        </Text>
                    </View>
                    {preview ? (
                        <>
                            <View style={styles.table}>
                                <View style={styles.tableRow}>
                                    <Text style={styles.rowLabel} />
                                    {preview.numbers.map((item) => <Text key={item.label} style={styles.colHead}>{item.label}</Text>)}
                                </View>
                                <View style={styles.tableRow}>
                                    <Text style={styles.rowLabel}>取象</Text>
                                    {preview.numbers.map((item) => renderSource(item.source, item.label))}
                                </View>
                                <View style={styles.tableRow}>
                                    <Text style={styles.rowLabel}>数</Text>
                                    {preview.numbers.map((item) => <Text key={item.label} style={[styles.bigValue, { color: palette.gold }]}>{item.value}</Text>)}
                                </View>
                            </View>
                            <View style={[styles.table, styles.divided]}>
                                <View style={styles.tableRow}>
                                    <Text style={styles.rowLabel} />
                                    <Text style={styles.colHead}>上卦</Text>
                                    <Text style={styles.colHead}>下卦</Text>
                                    <Text style={styles.colHead}>动爻</Text>
                                </View>
                                <View style={styles.tableRow}>
                                    <Text style={styles.rowLabel}>成卦</Text>
                                    {renderTrigram(preview.ben.upper)}
                                    {renderTrigram(preview.ben.lower)}
                                    <Text style={[styles.bigValue, { color: palette.vermilion }]}>{getLinePositionName(preview.movingLine)}</Text>
                                </View>
                                <View style={styles.tableRow}>
                                    <Text style={styles.rowLabel}>算式</Text>
                                    <Text style={styles.formula}>{preview.formulas.upper}</Text>
                                    <Text style={styles.formula}>{preview.formulas.lower}</Text>
                                    <Text style={styles.formula}>{preview.formulas.moving}</Text>
                                </View>
                            </View>
                            <View style={[styles.resultRow, styles.divided]}>
                                <HexagramLines lines={preview.ben.lines} movingLines={[preview.movingLine]} width={34} barHeight={4} gap={3} color={palette.gold} movingColor={palette.vermilion} />
                                <View style={styles.resultText}>
                                    <Text style={styles.resultName}>{preview.ben.fullName} · {getLinePositionName(preview.movingLine)}动</Text>
                                    <Text style={styles.resultMeta}>互 {preview.hu.fullName} · 变 {preview.bian.fullName}</Text>
                                </View>
                            </View>
                        </>
                    ) : null}
                </View>

                <View style={styles.grow} />
                <Pressable
                    onPress={handleCast}
                    disabled={saving || !castInput}
                    style={({ pressed }) => [styles.castBtn, (saving || !castInput) && styles.castBtnDisabled, pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityLabel="起卦"
                >
                    <Text style={styles.castText}>{saving ? '起卦中…' : '起卦'}</Text>
                </Pressable>
            </ScrollView>

            <DateTimePicker
                visible={pickerVisible}
                initialDate={castDate}
                onClose={() => setPickerVisible(false)}
                onConfirm={(date) => {
                    setCastDate(date);
                    setPickerVisible(false);
                }}
            />
        </View>
    );
}

function makeStyles(palette: ResultPalette, Colors: any) {
    return StyleSheet.create({
        container: { flex: 1, backgroundColor: palette.page },
        header: { height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
        headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
        headerTitle: { fontSize: 17, fontWeight: '700', color: palette.heading },
        content: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 4, paddingBottom: 20 },
        intro: { marginBottom: 14, textAlign: 'center', fontSize: 13, lineHeight: 20, color: palette.muted },
        label: { marginTop: 14, marginBottom: 8, fontSize: 14, lineHeight: 20, color: palette.ink },
        modeRow: { flexDirection: 'row', gap: 10 },
        modeCard: {
            flex: 1,
            paddingVertical: 9,
            paddingHorizontal: 12,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: palette.cardBorder,
            backgroundColor: palette.card,
        },
        modeCardOn: { borderColor: palette.gold, backgroundColor: palette.goldSoft },
        modeTitle: { fontSize: 14, lineHeight: 20, fontWeight: '700', color: palette.ink },
        modeTitleOn: { color: Colors.accent.goldLight },
        modeDesc: { marginTop: 2, fontSize: 11.5, lineHeight: 16, color: palette.muted },
        field: {
            height: 46,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 14,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: palette.cardBorder,
            backgroundColor: palette.card,
        },
        fieldText: { fontSize: 15, color: palette.heading, fontVariant: ['tabular-nums'] },
        numberRow: { flexDirection: 'row', gap: 10 },
        numberField: {
            flex: 1,
            height: 46,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 14,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: palette.cardBorder,
            backgroundColor: palette.card,
        },
        numberLabel: { fontSize: 12, color: palette.muted },
        numberInput: { flex: 1, minWidth: 0, height: '100%', textAlign: 'right', fontSize: 17, fontWeight: '700', color: palette.heading },
        subject: { marginBottom: 0 },
        singleLine: {
            height: 46,
            paddingHorizontal: 14,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: palette.cardBorder,
            backgroundColor: palette.card,
            fontSize: 14,
            color: palette.heading,
        },
        question: {
            minHeight: 58,
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: palette.cardBorder,
            backgroundColor: palette.card,
            fontSize: 14,
            lineHeight: 20,
            color: palette.heading,
            textAlignVertical: 'top',
        },
        card: {
            marginTop: 14,
            padding: 14,
            paddingTop: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: palette.cardBorder,
            backgroundColor: palette.card,
        },
        cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
        diamond: { width: 6, height: 6, backgroundColor: palette.vermilion, transform: [{ rotate: '45deg' }] },
        cardTitle: { fontSize: 15, lineHeight: 20, fontWeight: '700', color: palette.heading },
        cardMeta: { flex: 1, textAlign: 'right', fontSize: 12, color: palette.muted },
        table: { marginTop: 10, gap: 2 },
        divided: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: palette.hairline },
        tableRow: { flexDirection: 'row', alignItems: 'center' },
        rowLabel: { width: 36, fontSize: 11, color: palette.muted },
        colHead: { flex: 1, textAlign: 'center', fontSize: 12, lineHeight: 17, color: palette.muted },
        cellText: { flex: 1, textAlign: 'center', fontSize: 14, lineHeight: 24, color: palette.body },
        bigValue: { flex: 1, textAlign: 'center', fontSize: 22, lineHeight: 30, fontWeight: '700' },
        trigramCell: { flex: 1, alignItems: 'center' },
        // 图标挂在字左侧（左移 图标宽+4），字本身居中，和表头、算式对齐；不用百分比，Android 上会按列宽算
        hangIcon: { position: 'absolute' },
        trigramText: { fontSize: 22, lineHeight: 30, fontWeight: '700' },
        sourceText: { fontSize: 14, lineHeight: 24, fontWeight: '600' },
        formula: { flex: 1, textAlign: 'center', fontSize: 11.5, lineHeight: 16, color: palette.muted, fontVariant: ['tabular-nums'] },
        resultRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
        resultText: { flex: 1 },
        resultName: { fontSize: 17, lineHeight: 24, fontWeight: '700', color: palette.heading },
        resultMeta: { fontSize: 12, lineHeight: 17, color: palette.muted },
        grow: { flexGrow: 1, minHeight: 16 },
        castBtn: {
            height: 52,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: palette.gold,
        },
        castBtnDisabled: { opacity: 0.45 },
        castText: { fontSize: 17, fontWeight: '700', letterSpacing: 6, color: Colors.text.inverse },
        pressed: { opacity: 0.8 },
    });
}
