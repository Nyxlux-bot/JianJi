/**
 * 数字排卦页面
 * 输入两个或三个数字起卦
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
import { divinateByNumber } from '../../src/core/liuyao-calc';
import { saveRecord } from '../../src/db/database';
import LocationBar from '../../src/components/LocationBar';
import CityPicker from '../../src/components/CityPicker';
import { useLocation } from '../../src/hooks/useLocation';
import { useTheme } from "../../src/theme/ThemeContext";

export default function NumberDivination() {
    const { Colors } = useTheme();
    const styles = makeStyles(Colors);
    const [num1, setNum1] = useState('');
    const [num2, setNum2] = useState('');
    const [question, setQuestion] = useState('');
    const [loading, setLoading] = useState(false);
    const { city, pickerVisible, openPicker, closePicker, handleSelectCity } = useLocation();

    const handleDivinate = async () => {
        const n1 = parseInt(num1);
        const n2 = parseInt(num2);
        if (isNaN(n1) || isNaN(n2) || n1 <= 0 || n2 <= 0) {
            CustomAlert.alert('提示', '请输入有效的正整数');
            return;
        }
        try {
            setLoading(true);
            const result = divinateByNumber(n1, n2, new Date(), question, city?.longitude, city?.name);
            await saveRecord({
                engineType: 'liuyao',
                result,
            });
            router.push(`/result/${result.id}`);
        } catch (e: any) {
            CustomAlert.alert('错误', e.message || '排卦失败');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <StatusBarDecor />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <BackIcon size={24} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>数字排卦</Text>
                <View style={styles.backBtn} />
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                <Text style={styles.hint}>
                    心中默念所问之事，随意写下两个正整数{'\n'}
                    第一个数定上卦，第二个数定下卦
                </Text>

                {/* 地点选择 */}
                <LocationBar city={city} onPress={openPicker} />

                <View style={styles.inputSection}>
                    <Text style={styles.sectionLabel}>输入数字</Text>

                    <View style={styles.numberRow}>
                        <View style={styles.numberGroup}>
                            <Text style={styles.numberLabel}>第一个数（上卦）</Text>
                            <TextInput
                                style={styles.numberInput}
                                value={num1}
                                onChangeText={setNum1}
                                keyboardType="numeric"
                                placeholder="随心输入"
                                placeholderTextColor={Colors.text.tertiary}
                                maxLength={6}
                            />
                        </View>
                        <View style={styles.numberGroup}>
                            <Text style={styles.numberLabel}>第二个数（下卦）</Text>
                            <TextInput
                                style={styles.numberInput}
                                value={num2}
                                onChangeText={setNum2}
                                keyboardType="numeric"
                                placeholder="随心输入"
                                placeholderTextColor={Colors.text.tertiary}
                                maxLength={6}
                            />
                        </View>
                    </View>

                    <Text style={styles.formula}>
                        上卦 = 第一数 mod 8{'\n'}
                        下卦 = 第二数 mod 8{'\n'}
                        动爻 = (两数之和) mod 6
                    </Text>
                </View>

                <View style={styles.questionSection}>
                    <Text style={styles.sectionLabel}>占问事项（选填）</Text>
                    <TextInput
                        style={styles.questionInput}
                        value={question}
                        onChangeText={setQuestion}
                        placeholder="心中所想之事..."
                        placeholderTextColor={Colors.text.tertiary}
                        multiline
                        maxLength={100}
                    />
                </View>

                <TouchableOpacity
                    style={[styles.divinateButton, loading && styles.divinateButtonDisabled]}
                    activeOpacity={0.8}
                    onPress={handleDivinate}
                    disabled={loading}
                >
                    <Text style={styles.divinateButtonText}>
                        {loading ? '排卦中...' : '起卦'}
                    </Text>
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
    backBtn: { width: 40, height: 40, justifyContent: 'center' },
    headerTitle: { fontSize: FontSize.lg, color: Colors.text.heading, fontWeight: '400' },
    content: { flex: 1, paddingHorizontal: Spacing.xl },
    hint: {
        fontSize: FontSize.sm, color: Colors.text.tertiary,
        textAlign: 'center', marginVertical: Spacing.xxl, lineHeight: 22,
    },
    inputSection: { marginBottom: Spacing.xxl },
    sectionLabel: {
        fontSize: FontSize.sm, color: Colors.text.secondary,
        marginBottom: Spacing.md, letterSpacing: 1,
    },
    numberRow: { gap: Spacing.md },
    numberGroup: { marginBottom: Spacing.sm },
    numberLabel: { fontSize: FontSize.xs, color: Colors.text.tertiary, marginBottom: Spacing.xs },
    numberInput: {
        backgroundColor: Colors.bg.card, color: Colors.text.primary,
        fontSize: FontSize.xxl, padding: Spacing.lg,
        borderRadius: BorderRadius.md, textAlign: 'center',
        borderWidth: 0.5, borderColor: Colors.border.subtle, fontWeight: '300',
    },
    formula: {
        fontSize: FontSize.xs, color: Colors.text.tertiary,
        marginTop: Spacing.lg, lineHeight: 20,
        backgroundColor: Colors.bg.card, padding: Spacing.md,
        borderRadius: BorderRadius.sm, fontFamily: 'monospace',
    },
    questionSection: { marginBottom: Spacing.xxl },
    questionInput: {
        backgroundColor: Colors.bg.card, color: Colors.text.primary,
        fontSize: FontSize.md, padding: Spacing.lg,
        borderRadius: BorderRadius.md, minHeight: 60,
        textAlignVertical: 'top', borderWidth: 0.5, borderColor: Colors.border.subtle,
    },
    divinateButton: {
        backgroundColor: Colors.accent.gold, borderRadius: BorderRadius.lg,
        paddingVertical: Spacing.lg, alignItems: 'center', marginBottom: 40,
    },
    divinateButtonDisabled: { opacity: 0.5 },
    divinateButtonText: {
        fontSize: FontSize.lg, color: Colors.text.inverse, fontWeight: '500', letterSpacing: 4,
    },
});
