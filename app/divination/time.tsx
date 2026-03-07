/**
 * 时间排卦页面
 * 选择日期时间后自动计算卦象
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
import { BackIcon, ChevronRightIcon } from '../../src/components/Icons';
import { divinateByTime } from '../../src/core/liuyao-calc';
import { saveRecord } from '../../src/db/database';
import LocationBar from '../../src/components/LocationBar';
import CityPicker from '../../src/components/CityPicker';
import { useLocation } from '../../src/hooks/useLocation';
import DateTimePicker from '../../src/components/DateTimePicker';
import { useTheme } from "../../src/theme/ThemeContext";

export default function TimeDivination() {
    const { Colors } = useTheme();
    const styles = makeStyles(Colors);
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [pickerVisible, setPickerVisible] = useState(false);

    const [question, setQuestion] = useState('');
    const [loading, setLoading] = useState(false);
    const { city, pickerVisible: cityPickerVisible, openPicker: openCityPicker, closePicker: closeCityPicker, handleSelectCity } = useLocation();

    const handleDivinate = async () => {
        try {
            setLoading(true);

            if (isNaN(selectedDate.getTime())) {
                CustomAlert.alert('提示', '无效的时间');
                return;
            }

            const result = divinateByTime(selectedDate, question, city?.longitude, city?.name);
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

    const formatDateTime = (date: Date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        const h = String(date.getHours()).padStart(2, '0');
        const min = String(date.getMinutes()).padStart(2, '0');
        return `${y}-${m}-${d} ${h}:${min}`;
    };

    return (
        <View style={styles.container}>
            <StatusBarDecor />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <BackIcon size={24} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>时间排卦</Text>
                <View style={styles.backBtn} />
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                <Text style={styles.hint}>
                    选择起卦时间，以梅花易数法推算卦象
                </Text>

                {/* 地点选择 */}
                <LocationBar city={city} onPress={openCityPicker} />

                {/* 日期选择展示块（精简版） */}
                <View style={styles.dateSection}>
                    <Text style={styles.sectionLabel}>起卦时间</Text>
                    <TouchableOpacity
                        style={styles.datePickerTrigger}
                        activeOpacity={0.7}
                        onPress={() => setPickerVisible(true)}
                    >
                        <Text style={styles.dateDisplayValue}>
                            {formatDateTime(selectedDate)}
                        </Text>
                        <ChevronRightIcon size={20} color={Colors.text.tertiary} />
                    </TouchableOpacity>
                </View>

                {/* 占问事项 */}
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

                {/* 起卦按钮 */}
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
                visible={cityPickerVisible}
                onClose={closeCityPicker}
                onSelect={handleSelectCity}
                selectedCity={city}
            />

            <DateTimePicker
                visible={pickerVisible}
                initialDate={selectedDate}
                onClose={() => setPickerVisible(false)}
                onConfirm={(newDate) => {
                    setSelectedDate(newDate);
                    setPickerVisible(false);
                }}
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
    dateSection: { marginBottom: Spacing.xxl },
    sectionLabel: {
        fontSize: FontSize.sm, color: Colors.text.secondary,
        marginBottom: Spacing.md, letterSpacing: 1,
    },
    datePickerTrigger: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: Spacing.lg,
        paddingHorizontal: Spacing.xl,
        backgroundColor: Colors.bg.card,
        borderRadius: BorderRadius.lg,
        borderWidth: 0.5,
        borderColor: Colors.border.subtle,
    },
    dateDisplayValue: {
        fontSize: FontSize.lg,
        color: Colors.text.primary,
        letterSpacing: 2,
    },
    questionSection: { marginBottom: Spacing.xxl },
    questionInput: {
        backgroundColor: Colors.bg.card, color: Colors.text.primary,
        fontSize: FontSize.md, padding: Spacing.lg,
        borderRadius: BorderRadius.md, minHeight: 80,
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
