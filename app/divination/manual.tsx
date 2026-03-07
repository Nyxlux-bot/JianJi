/**
 * 手动起卦页面
 * 逐爻选择阴阳/动静
 */

import React, { useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    ScrollView, TextInput, Alert,
} from 'react-native';
import StatusBarDecor from '../../src/components/StatusBarDecor';
import { router } from 'expo-router';
import { CustomAlert } from '../../src/components/CustomAlertProvider';
import { Spacing, FontSize, BorderRadius } from '../../src/theme/colors';
import { BackIcon } from '../../src/components/Icons';
import { YaoValue } from '../../src/core/liuyao-data';
import { divinateManual } from '../../src/core/liuyao-calc';
import { saveRecord } from '../../src/db/database';
import LocationBar from '../../src/components/LocationBar';
import CityPicker from '../../src/components/CityPicker';
import { useLocation } from '../../src/hooks/useLocation';
import { useTheme } from "../../src/theme/ThemeContext";

const YAO_NAMES = ['初爻', '二爻', '三爻', '四爻', '五爻', '上爻'];
const YAO_OPTIONS: { value: YaoValue; label: string; desc: string }[] = [
    { value: 7, label: '阳', desc: '少阳（静）' },
    { value: 8, label: '阴', desc: '少阴（静）' },
    { value: 9, label: '阳动', desc: '老阳（动）' },
    { value: 6, label: '阴动', desc: '老阴（动）' },
];

export default function ManualDivination() {
    const { Colors } = useTheme();
    const styles = makeStyles(Colors);
    const [yaoValues, setYaoValues] = useState<(YaoValue | null)[]>([null, null, null, null, null, null]);
    const [question, setQuestion] = useState('');
    const { city, pickerVisible, openPicker, closePicker, handleSelectCity } = useLocation();

    const setYao = (index: number, value: YaoValue) => {
        setYaoValues(prev => {
            const next = [...prev];
            next[index] = value;
            return next;
        });
    };

    const allSet = yaoValues.every(v => v !== null);

    const handleDivinate = async () => {
        if (!allSet) {
            CustomAlert.alert('提示', '请选择所有六爻');
            return;
        }
        try {
            const result = divinateManual(yaoValues as YaoValue[], new Date(), question, city?.longitude, city?.name);
            await saveRecord({
                engineType: 'liuyao',
                result,
            });
            router.push(`/result/${result.id}`);
        } catch (e: any) {
            CustomAlert.alert('错误', e.message || '排卦失败');
        }
    };

    const handleReset = () => {
        setYaoValues([null, null, null, null, null, null]);
    };

    return (
        <View style={styles.container}>
            <StatusBarDecor />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <BackIcon size={24} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>手动起卦</Text>
                <TouchableOpacity onPress={handleReset} style={styles.backBtn}>
                    <Text style={styles.resetText}>重置</Text>
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                <Text style={styles.hint}>逐爻选择阴阳和动静</Text>

                {/* 地点选择 */}
                <LocationBar city={city} onPress={openPicker} />

                {/* 占问事项 */}
                <View style={styles.questionSection}>
                    <TextInput
                        style={styles.questionInput}
                        value={question}
                        onChangeText={setQuestion}
                        placeholder="占问事项（选填）"
                        placeholderTextColor={Colors.text.tertiary}
                        maxLength={100}
                    />
                </View>

                {/* 六爻选择 */}
                <View style={styles.yaoSection}>
                    {YAO_NAMES.map((name, index) => (
                        <View key={index} style={styles.yaoRow}>
                            <Text style={styles.yaoName}>{name}</Text>
                            <View style={styles.optionsRow}>
                                {YAO_OPTIONS.map(opt => {
                                    const isSelected = yaoValues[index] === opt.value;
                                    const isMoving = opt.value === 6 || opt.value === 9;
                                    return (
                                        <TouchableOpacity
                                            key={opt.value}
                                            style={[
                                                styles.optionBtn,
                                                isSelected && styles.optionBtnSelected,
                                                isSelected && isMoving && styles.optionBtnMoving,
                                            ]}
                                            activeOpacity={0.7}
                                            onPress={() => setYao(index, opt.value)}
                                        >
                                            <Text style={[
                                                styles.optionLabel,
                                                isSelected && styles.optionLabelSelected,
                                                isSelected && isMoving && styles.optionLabelMoving,
                                            ]}>
                                                {opt.label}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>
                    ))}
                </View>

                {/* 预览 */}
                <View style={styles.previewSection}>
                    <Text style={styles.sectionLabel}>预览</Text>
                    <View style={styles.previewContainer}>
                        {[...yaoValues].reverse().map((v, rIdx) => {
                            const idx = 5 - rIdx;
                            if (v === null) return (
                                <View key={idx} style={styles.previewYao}>
                                    <Text style={styles.previewEmpty}>- - -</Text>
                                </View>
                            );
                            const isYang = v === 7 || v === 9;
                            const isMoving = v === 6 || v === 9;
                            const color = isMoving ? Colors.yao.moving : Colors.yao.yang;
                            return (
                                <View key={idx} style={styles.previewYao}>
                                    {isYang ? (
                                        <View style={[styles.previewYangLine, { backgroundColor: color }]} />
                                    ) : (
                                        <View style={styles.previewYinRow}>
                                            <View style={[styles.previewYinHalf, { backgroundColor: color }]} />
                                            <View style={styles.previewYinGap} />
                                            <View style={[styles.previewYinHalf, { backgroundColor: color }]} />
                                        </View>
                                    )}
                                </View>
                            );
                        })}
                    </View>
                </View>

                <TouchableOpacity
                    style={[styles.divinateButton, !allSet && styles.divinateButtonDisabled]}
                    activeOpacity={0.8}
                    onPress={handleDivinate}
                    disabled={!allSet}
                >
                    <Text style={styles.divinateButtonText}>起卦</Text>
                </TouchableOpacity>
            </ScrollView>

            <CityPicker
                visible={pickerVisible}
                onClose={closePicker}
                onSelect={handleSelectCity}
                selectedCity={city}
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
    backBtn: { width: 50, height: 40, justifyContent: 'center' },
    headerTitle: { fontSize: FontSize.lg, color: Colors.text.heading, fontWeight: '400' },
    resetText: { fontSize: FontSize.sm, color: Colors.accent.gold },
    content: { flex: 1, paddingHorizontal: Spacing.xl },
    hint: {
        fontSize: FontSize.sm, color: Colors.text.tertiary,
        textAlign: 'center', marginVertical: Spacing.lg,
    },
    questionSection: { marginBottom: Spacing.lg },
    questionInput: {
        backgroundColor: Colors.bg.card, color: Colors.text.primary,
        fontSize: FontSize.md, padding: Spacing.lg,
        borderRadius: BorderRadius.md, borderWidth: 0.5, borderColor: Colors.border.subtle,
    },
    yaoSection: { gap: Spacing.sm, marginBottom: Spacing.xxl },
    yaoRow: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: Colors.bg.card, borderRadius: BorderRadius.md,
        padding: Spacing.md, gap: Spacing.md,
    },
    yaoName: { fontSize: FontSize.sm, color: Colors.text.secondary, width: 40 },
    optionsRow: { flex: 1, flexDirection: 'row', gap: Spacing.xs },
    optionBtn: {
        flex: 1, paddingVertical: Spacing.sm,
        backgroundColor: Colors.bg.elevated, borderRadius: BorderRadius.sm,
        alignItems: 'center', borderWidth: 1, borderColor: 'transparent',
    },
    optionBtnSelected: { borderColor: Colors.accent.gold, backgroundColor: 'rgba(200,148,58,0.1)' },
    optionBtnMoving: { borderColor: Colors.accent.red, backgroundColor: Colors.yao.movingBg },
    optionLabel: { fontSize: FontSize.xs, color: Colors.text.secondary },
    optionLabelSelected: { color: Colors.accent.gold },
    optionLabelMoving: { color: Colors.accent.red },
    previewSection: { marginBottom: Spacing.xxl },
    sectionLabel: {
        fontSize: FontSize.sm, color: Colors.text.secondary,
        marginBottom: Spacing.md, letterSpacing: 1,
    },
    previewContainer: {
        backgroundColor: Colors.bg.card, borderRadius: BorderRadius.lg,
        padding: Spacing.xl, gap: Spacing.md, alignItems: 'center',
    },
    previewYao: { width: 120, height: 12, justifyContent: 'center' },
    previewEmpty: { textAlign: 'center', color: Colors.text.tertiary, fontSize: FontSize.xs },
    previewYangLine: { height: 6, borderRadius: 3 },
    previewYinRow: { flexDirection: 'row', height: 6 },
    previewYinHalf: { flex: 1, borderRadius: 3 },
    previewYinGap: { width: 14 },
    divinateButton: {
        backgroundColor: Colors.accent.gold, borderRadius: BorderRadius.lg,
        paddingVertical: Spacing.lg, alignItems: 'center', marginBottom: 40,
    },
    divinateButtonDisabled: { opacity: 0.4 },
    divinateButtonText: {
        fontSize: FontSize.lg, color: Colors.text.inverse, fontWeight: '500', letterSpacing: 4,
    },
});
