import React, { useEffect, useMemo, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    TextInput,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import StatusBarDecor from '../../src/components/StatusBarDecor';
import { BackIcon, ChevronRightIcon } from '../../src/components/Icons';
import { buildRegionDisplayName } from '../../src/core/city-data';
import { Spacing, FontSize, BorderRadius } from '../../src/theme/colors';
import { useTheme } from '../../src/theme/ThemeContext';
import { CustomAlert } from '../../src/components/CustomAlertProvider';
import { calculateBazi } from '../../src/core/bazi-calc';
import { BaziGender, BaziResult, BaziTimeMode, BaziZiHourMode } from '../../src/core/bazi-types';
import { getRecord, replaceRecord, saveRecord } from '../../src/db/database';
import LocationBar from '../../src/components/LocationBar';
import CityPicker from '../../src/components/CityPicker';
import DateTimePicker from '../../src/components/DateTimePicker';
import { buildBaziEditFormState } from '../../src/features/bazi/edit-helpers';
import { getPendingBaziRecord, primePendingBaziRecord } from '../../src/features/bazi/pending-result-cache';
import { BaziFormState } from '../../src/features/bazi/types';

function formatDateTime(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${d} ${hh}:${mm}`;
}

function buildBaziSummary(result: BaziResult) {
    return {
        title: result.subject.name || result.fourPillars.join(' '),
        method: result.subject.mingZaoLabel,
        subtitle: result.baseInfo.birthPlaceDisplay || '未设置出生地',
    };
}

function yieldToNextFrame(): Promise<void> {
    return new Promise((resolve) => {
        if (typeof globalThis.requestAnimationFrame === 'function') {
            globalThis.requestAnimationFrame(() => resolve());
            return;
        }
        setTimeout(resolve, 0);
    });
}

export default function BaziInputPage() {
    const { Colors } = useTheme();
    const styles = makeStyles(Colors);
    const { editId } = useLocalSearchParams<{ editId?: string }>();
    const [birthPickerVisible, setBirthPickerVisible] = useState(false);
    const [referencePickerVisible, setReferencePickerVisible] = useState(false);
    const [cityPickerVisible, setCityPickerVisible] = useState(false);
    const [form, setForm] = useState<BaziFormState>({
        name: '',
        birthDate: new Date(),
        gender: 1,
        location: null,
        editingRecordId: null,
        locationFallbackLabel: '',
        useCustomReferenceDate: false,
        referenceDate: new Date(),
        ziHourMode: 'late_zi_next_day',
        timeMode: 'clock_time',
        daylightSaving: false,
    });
    const [loading, setLoading] = useState(false);
    const [initializing, setInitializing] = useState(Boolean(editId));
    const usesSolarCorrection = form.timeMode !== 'clock_time';

    const effectiveReferenceDate = useMemo(
        () => (form.useCustomReferenceDate ? form.referenceDate : new Date()),
        [form.useCustomReferenceDate, form.referenceDate]
    );

    useEffect(() => {
        let cancelled = false;

        const loadEditingRecord = async () => {
            if (!editId) {
                setInitializing(false);
                return;
            }

            try {
                const pending = getPendingBaziRecord(editId);
                if (pending && pending.status !== 'saved') {
                    setForm(buildBaziEditFormState(pending.result));
                    return;
                }

                const detail = await getRecord(editId);
                if (cancelled) {
                    return;
                }
                if (!detail || detail.engineType !== 'bazi') {
                    CustomAlert.alert('提示', '未找到可编辑的八字记录');
                    router.back();
                    return;
                }
                setForm(buildBaziEditFormState(detail.result));
            } catch (error: unknown) {
                if (!cancelled) {
                    const message = error instanceof Error ? error.message : '加载八字记录失败';
                    CustomAlert.alert('错误', message);
                    router.back();
                }
            } finally {
                if (!cancelled) {
                    setInitializing(false);
                }
            }
        };

        void loadEditingRecord();

        return () => {
            cancelled = true;
        };
    }, [editId]);

    const handleGenderChange = (gender: BaziGender) => {
        setForm((prev) => ({ ...prev, gender }));
    };

    const handleZiHourModeChange = (mode: BaziZiHourMode) => {
        setForm((prev) => ({ ...prev, ziHourMode: mode }));
    };

    const handleTimeModeChange = (mode: BaziTimeMode) => {
        setForm((prev) => ({ ...prev, timeMode: mode }));
    };

    const handleDaylightSavingChange = (enabled: boolean) => {
        setForm((prev) => ({ ...prev, daylightSaving: enabled }));
    };

    const handleCalculate = async () => {
        try {
            setLoading(true);
            await yieldToNextFrame();
            const birthDate = form.birthDate;
            if (Number.isNaN(birthDate.getTime())) {
                CustomAlert.alert('提示', '出生时间无效');
                return;
            }
            if (form.timeMode !== 'clock_time' && !form.location) {
                CustomAlert.alert('提示', '平太阳时或真太阳时排盘需要先选择出生地');
                return;
            }

            const referenceDate = form.useCustomReferenceDate
                ? form.referenceDate
                : new Date();
            const result = calculateBazi({
                date: birthDate,
                gender: form.gender,
                longitude: form.location?.longitude,
                referenceDate,
                name: form.name,
                locationName: form.location ? buildRegionDisplayName(form.location) : '未设置出生地',
                schoolOptions: {
                    ziHourMode: form.ziHourMode,
                    timeMode: form.timeMode,
                    daylightSaving: form.daylightSaving,
                },
            });
            const envelope = {
                engineType: 'bazi',
                result,
                summary: buildBaziSummary(result),
            } as const;

            primePendingBaziRecord({
                result,
                envelope,
                persist: () => (
                    form.editingRecordId
                        ? replaceRecord(form.editingRecordId, envelope)
                        : saveRecord(envelope)
                ),
            });
            router.push(`/bazi/result/${result.id}`);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : '八字排盘失败';
            CustomAlert.alert('错误', message);
        } finally {
            setLoading(false);
        }
    };

    const locationDetailText = form.locationFallbackLabel
        ? (form.timeMode === 'clock_time'
            ? '原记录出生地未自动匹配，建议重新确认区县'
            : '原记录出生地未自动匹配，当前沿用旧经度，建议重新确认区县')
        : (form.timeMode === 'clock_time' ? '仅作出生地记录' : '本地时区下的校时经度');
    const locationFallbackDetailText = form.locationFallbackLabel
        ? '原记录出生地未能自动匹配，请重新确认区县'
        : '';

    return (
        <View style={styles.container}>
            <StatusBarDecor />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <BackIcon size={24} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{form.editingRecordId ? '修改八字' : '八字排盘'}</Text>
                <View style={styles.backBtn} />
            </View>

            {initializing ? (
                <View style={styles.initializingWrap}>
                    <Text style={styles.hint}>正在加载命盘...</Text>
                </View>
            ) : (
                <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                    <Text style={styles.hint}>
                        输入出生信息，八字会按当前设备时区的本地钟表时换算；平太阳时和真太阳时只在此基础上做经度与时差修正。
                    </Text>

                    <LocationBar
                        location={form.location}
                        onPress={() => setCityPickerVisible(true)}
                        detailText={locationDetailText}
                        placeholderDetailText={form.timeMode === 'clock_time'
                            ? '本地钟表时模式下可不选出生地'
                            : '平太阳时或真太阳时需要出生地经度'}
                        fallbackLabel={form.locationFallbackLabel}
                        fallbackDetailText={locationFallbackDetailText}
                    />

                    <View style={styles.section}>
                        <Text style={styles.sectionLabel}>姓名（可选）</Text>
                        <TextInput
                            style={styles.textInput}
                            value={form.name}
                            onChangeText={(text) => setForm((prev) => ({ ...prev, name: text }))}
                            placeholder="请输入命主姓名"
                            placeholderTextColor={Colors.text.tertiary}
                            maxLength={24}
                        />
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionLabel}>出生时间</Text>
                        <TouchableOpacity
                            style={styles.selector}
                            activeOpacity={0.75}
                            onPress={() => setBirthPickerVisible(true)}
                        >
                            <Text style={styles.selectorText}>{formatDateTime(form.birthDate)}</Text>
                            <ChevronRightIcon size={20} color={Colors.text.tertiary} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionLabel}>性别</Text>
                        <View style={styles.genderRow}>
                            <TouchableOpacity
                                style={[styles.genderBtn, form.gender === 1 && styles.genderBtnActive]}
                                onPress={() => handleGenderChange(1)}
                            >
                                <Text style={[styles.genderText, form.gender === 1 && styles.genderTextActive]}>男</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.genderBtn, form.gender === 0 && styles.genderBtnActive]}
                                onPress={() => handleGenderChange(0)}
                            >
                                <Text style={[styles.genderText, form.gender === 0 && styles.genderTextActive]}>女</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionLabel}>排盘口径</Text>
                        <View style={styles.timeModeGrid}>
                            <TouchableOpacity
                                style={[styles.timeModeBtn, form.timeMode === 'clock_time' && styles.modeBtnActive]}
                                onPress={() => handleTimeModeChange('clock_time')}
                            >
                                <Text style={[styles.timeModeTitle, form.timeMode === 'clock_time' && styles.modeTextActive]}>本地钟表时</Text>
                                <Text style={styles.timeModeHint}>按输入的本地钟表时间排盘，不做经度校时。</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.timeModeBtn, form.timeMode === 'mean_solar_time' && styles.modeBtnActive]}
                                onPress={() => handleTimeModeChange('mean_solar_time')}
                            >
                                <Text style={[styles.timeModeTitle, form.timeMode === 'mean_solar_time' && styles.modeTextActive]}>平太阳时</Text>
                                <Text style={styles.timeModeHint}>按当前时区标准经线与出生地经度换算，不含时差方程。</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.timeModeBtn, form.timeMode === 'true_solar_time' && styles.modeBtnActive]}
                                onPress={() => handleTimeModeChange('true_solar_time')}
                            >
                                <Text style={[styles.timeModeTitle, form.timeMode === 'true_solar_time' && styles.modeTextActive]}>真太阳时</Text>
                                <Text style={styles.timeModeHint}>在平太阳时基础上叠加时差方程修正，需要出生地经度。</Text>
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.advancedHint}>
                            默认使用本地钟表时。切到平太阳时或真太阳时后，会按当前设备时区的标准经线换算；原始出生时间显示保持不变。
                        </Text>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionLabel}>夏令时（可选）</Text>
                        <View style={[styles.modeRow, !usesSolarCorrection && styles.disabledRow]}>
                            <TouchableOpacity
                                style={[styles.modeBtn, !form.daylightSaving && styles.modeBtnActive]}
                                onPress={() => handleDaylightSavingChange(false)}
                                disabled={!usesSolarCorrection}
                            >
                                <Text style={[styles.modeText, !form.daylightSaving && styles.modeTextActive]}>
                                    关闭
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modeBtn, form.daylightSaving && styles.modeBtnActive]}
                                onPress={() => handleDaylightSavingChange(true)}
                                disabled={!usesSolarCorrection}
                            >
                                <Text style={[styles.modeText, form.daylightSaving && styles.modeTextActive]}>
                                    开启
                                </Text>
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.advancedHint}>
                            默认关闭。仅在平太阳时和真太阳时下生效；开启后会先按当前时区回退 60 分钟，再做经度与时差修正。
                        </Text>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionLabel}>流派口径（子时归属）</Text>
                        <View style={styles.modeRow}>
                            <TouchableOpacity
                                style={[styles.modeBtn, form.ziHourMode === 'late_zi_next_day' && styles.modeBtnActive]}
                                onPress={() => handleZiHourModeChange('late_zi_next_day')}
                            >
                                <Text style={[styles.modeText, form.ziHourMode === 'late_zi_next_day' && styles.modeTextActive]}>
                                    晚子时次日
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modeBtn, form.ziHourMode === 'early_zi_same_day' && styles.modeBtnActive]}
                                onPress={() => handleZiHourModeChange('early_zi_same_day')}
                            >
                                <Text style={[styles.modeText, form.ziHourMode === 'early_zi_same_day' && styles.modeTextActive]}>
                                    早子时当日
                                </Text>
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.advancedHint}>
                            默认使用晚子时归次日口径；切换后仅影响排盘规则，不改原始出生时间显示。
                        </Text>
                    </View>

                    <View style={styles.section}>
                        <TouchableOpacity
                            style={styles.advancedHeader}
                            onPress={() => setForm((prev) => ({ ...prev, useCustomReferenceDate: !prev.useCustomReferenceDate }))}
                        >
                            <Text style={styles.sectionLabel}>参考时点（用于当前运势判定）</Text>
                            <Text style={styles.advancedToggle}>
                                {form.useCustomReferenceDate ? '已自定义' : '默认当前时间'}
                            </Text>
                        </TouchableOpacity>
                        <Text style={styles.advancedHint}>
                            默认按当前本地时间判定当前大运/流年/流月；若排盘口径选择平太阳时或真太阳时，参考时点也会应用同一套经度与夏令时换算。
                        </Text>
                        {form.useCustomReferenceDate ? (
                            <TouchableOpacity
                                style={styles.selector}
                                activeOpacity={0.75}
                                onPress={() => setReferencePickerVisible(true)}
                            >
                                <Text style={styles.selectorText}>{formatDateTime(form.referenceDate)}</Text>
                                <ChevronRightIcon size={20} color={Colors.text.tertiary} />
                            </TouchableOpacity>
                        ) : (
                            <View style={styles.selector}>
                                <Text style={styles.selectorText}>{formatDateTime(effectiveReferenceDate)}</Text>
                            </View>
                        )}
                    </View>

                    <TouchableOpacity
                        style={[styles.calcBtn, loading && styles.calcBtnDisabled]}
                        onPress={handleCalculate}
                        disabled={loading}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.calcBtnText}>
                            {loading ? '排盘中...' : (form.editingRecordId ? '保存修改并排盘' : '开始排盘')}
                        </Text>
                    </TouchableOpacity>
                </ScrollView>
            )}

            <CityPicker
                visible={cityPickerVisible}
                onClose={() => setCityPickerVisible(false)}
                onSelect={async (selectedRegion) => {
                    setForm((prev) => ({
                        ...prev,
                        location: selectedRegion,
                        locationFallbackLabel: '',
                    }));
                    setCityPickerVisible(false);
                }}
                selectedRegion={form.location}
            />

            <DateTimePicker
                visible={birthPickerVisible}
                initialDate={form.birthDate}
                onClose={() => setBirthPickerVisible(false)}
                onConfirm={(date) => {
                    setForm((prev) => ({ ...prev, birthDate: date }));
                    setBirthPickerVisible(false);
                }}
            />

            <DateTimePicker
                visible={referencePickerVisible}
                initialDate={form.referenceDate}
                onClose={() => setReferencePickerVisible(false)}
                onConfirm={(date) => {
                    setForm((prev) => ({ ...prev, referenceDate: date, useCustomReferenceDate: true }));
                    setReferencePickerVisible(false);
                }}
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
    initializingWrap: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: Spacing.xl,
    },
    content: { flex: 1, paddingHorizontal: Spacing.xl },
    hint: {
        fontSize: FontSize.sm,
        color: Colors.text.tertiary,
        textAlign: 'center',
        marginVertical: Spacing.xl,
        lineHeight: 22,
    },
    section: { marginBottom: Spacing.xl },
    sectionLabel: {
        fontSize: FontSize.sm,
        color: Colors.text.secondary,
        marginBottom: Spacing.sm,
        letterSpacing: 1,
    },
    textInput: {
        minHeight: 48,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
        backgroundColor: Colors.bg.card,
        paddingHorizontal: Spacing.md,
        fontSize: FontSize.md,
        color: Colors.text.primary,
    },
    selector: {
        minHeight: 48,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
        backgroundColor: Colors.bg.card,
        paddingHorizontal: Spacing.md,
        alignItems: 'center',
        justifyContent: 'space-between',
        flexDirection: 'row',
    },
    selectorText: {
        fontSize: FontSize.md,
        color: Colors.text.primary,
    },
    genderRow: {
        flexDirection: 'row',
        gap: Spacing.sm,
    },
    genderBtn: {
        flex: 1,
        minHeight: 44,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
        backgroundColor: Colors.bg.card,
        alignItems: 'center',
        justifyContent: 'center',
    },
    genderBtnActive: {
        borderColor: Colors.accent.gold,
        backgroundColor: Colors.bg.elevated,
    },
    genderText: {
        fontSize: FontSize.md,
        color: Colors.text.secondary,
    },
    genderTextActive: {
        color: Colors.accent.gold,
        fontWeight: '600',
    },
    advancedHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: Spacing.xs,
    },
    advancedToggle: {
        fontSize: FontSize.xs,
        color: Colors.accent.gold,
    },
    advancedHint: {
        fontSize: FontSize.xs,
        color: Colors.text.tertiary,
        lineHeight: 18,
        marginBottom: Spacing.sm,
    },
    modeRow: {
        flexDirection: 'row',
        gap: Spacing.sm,
        marginBottom: Spacing.sm,
    },
    disabledRow: {
        opacity: 0.5,
    },
    modeBtn: {
        flex: 1,
        minHeight: 44,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
        backgroundColor: Colors.bg.card,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modeBtnActive: {
        borderColor: Colors.accent.gold,
        backgroundColor: Colors.bg.elevated,
    },
    modeText: {
        fontSize: FontSize.sm,
        color: Colors.text.secondary,
    },
    modeTextActive: {
        color: Colors.accent.gold,
        fontWeight: '600',
    },
    timeModeGrid: {
        gap: Spacing.sm,
        marginBottom: Spacing.sm,
    },
    timeModeBtn: {
        minHeight: 56,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
        backgroundColor: Colors.bg.card,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        justifyContent: 'center',
    },
    timeModeTitle: {
        fontSize: FontSize.sm,
        color: Colors.text.secondary,
        marginBottom: 4,
        fontWeight: '600',
    },
    timeModeHint: {
        fontSize: FontSize.xs,
        color: Colors.text.tertiary,
        lineHeight: 18,
    },
    calcBtn: {
        marginTop: Spacing.sm,
        marginBottom: 48,
        minHeight: 50,
        borderRadius: BorderRadius.lg,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.accent.gold,
    },
    calcBtnDisabled: {
        opacity: 0.5,
    },
    calcBtnText: {
        fontSize: FontSize.lg,
        color: Colors.text.inverse,
        fontWeight: '600',
        letterSpacing: 2,
    },
});
