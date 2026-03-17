import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { BackIcon, ChevronRightIcon } from '../../src/components/Icons';
import StatusBarDecor from '../../src/components/StatusBarDecor';
import { useTheme } from '../../src/theme/ThemeContext';
import { BorderRadius, FontSize, Spacing } from '../../src/theme/colors';
import { buildRegionDisplayName, RegionSelection } from '../../src/core/city-data';
import { CustomAlert } from '../../src/components/CustomAlertProvider';
import LocationBar from '../../src/components/LocationBar';
import CityPicker from '../../src/components/CityPicker';
import DateTimePicker, { DateTimePickerSelection } from '../../src/components/DateTimePicker';
import { formatLocalDateTime } from '../../src/core/bazi-local-time';
import { formatLunarDateLabel } from '../../src/core/lunar';
import { getRecord } from '../../src/db/database';
import {
    buildZiweiInputPayload,
    ZIWEI_DEFAULT_CONFIG,
    ZIWEI_STANDARD_TIMEZONE_OFFSET_MINUTES,
} from '../../src/features/ziwei/iztro-adapter';
import { buildZiweiEditFormState } from '../../src/features/ziwei/edit-helpers';
import { getPendingZiweiRecord } from '../../src/features/ziwei/pending-result-cache';
import { createZiweiRecordId } from '../../src/features/ziwei/record';
import { buildZiweiResultRoute } from '../../src/features/ziwei/result-route';
import {
    ZiweiConfigOptions,
    ZiweiGender,
    ZiweiInputPayload,
    ZiweiLunarDateInput,
} from '../../src/features/ziwei/types';

function formatDateTime(date: Date): string {
    return formatLocalDateTime(date).replace('T', ' ');
}

function formatBirthPlace(
    provinceName?: string,
    cityName?: string,
    districtName?: string,
): string {
    if (!provinceName && !cityName && !districtName) {
        return '';
    }
    return `${provinceName || ''}${cityName || ''}${districtName || ''}`;
}

function formatLunarInputLabel(lunar?: ZiweiLunarDateInput): string {
    if (!lunar) {
        return '';
    }

    return lunar.label || formatLunarDateLabel({
        year: lunar.year,
        month: lunar.month,
        day: lunar.day,
        isLeap: lunar.isLeapMonth,
    });
}

function yieldToNextFrame(): Promise<void> {
    return new Promise((resolve) => {
        requestAnimationFrame(() => resolve());
    });
}

export default function ZiweiInputPage() {
    const { Colors } = useTheme();
    const styles = useMemo(() => makeStyles(Colors), [Colors]);
    const { editId } = useLocalSearchParams<{ editId?: string }>();
    const [name, setName] = useState('');
    const [gender, setGender] = useState<ZiweiGender>('male');
    const [birthDate, setBirthDate] = useState(new Date());
    const [birthSelection, setBirthSelection] = useState<{
        calendarType: 'solar' | 'lunar';
        lunar?: ZiweiLunarDateInput;
    }>({ calendarType: 'solar' });
    const [config, setConfig] = useState<ZiweiConfigOptions>(ZIWEI_DEFAULT_CONFIG);
    const [daylightSavingEnabled, setDaylightSavingEnabled] = useState(false);
    const [birthPickerVisible, setBirthPickerVisible] = useState(false);
    const [cityPickerVisible, setCityPickerVisible] = useState(false);
    const [location, setLocation] = useState<RegionSelection | null>(null);
    const [locationFallbackLabel, setLocationFallbackLabel] = useState('');
    const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
    const [editingCreatedAt, setEditingCreatedAt] = useState<string | null>(null);
    const [initializing, setInitializing] = useState(Boolean(editId));
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let cancelled = false;

        const loadEditingRecord = async () => {
            if (!editId) {
                setInitializing(false);
                return;
            }

            try {
                const pending = getPendingZiweiRecord(editId);
                if (pending && pending.status !== 'saved') {
                    const form = buildZiweiEditFormState(pending.result);
                    setName(form.name);
                    setGender(form.gender);
                    setBirthDate(form.birthDate);
                    setBirthSelection(form.birthSelection);
                    setConfig(form.config);
                    setDaylightSavingEnabled(form.daylightSavingEnabled);
                    setLocation(form.location);
                    setLocationFallbackLabel(form.locationFallbackLabel);
                    setEditingRecordId(form.editingRecordId);
                    setEditingCreatedAt(form.createdAt);
                    return;
                }

                const detail = await getRecord(editId);
                if (cancelled) {
                    return;
                }

                if (!detail || detail.engineType !== 'ziwei') {
                    CustomAlert.alert('提示', '未找到可编辑的紫微记录');
                    router.back();
                    return;
                }

                const form = buildZiweiEditFormState(detail.result);
                setName(form.name);
                setGender(form.gender);
                setBirthDate(form.birthDate);
                setBirthSelection(form.birthSelection);
                setConfig(form.config);
                setDaylightSavingEnabled(form.daylightSavingEnabled);
                setLocation(form.location);
                setLocationFallbackLabel(form.locationFallbackLabel);
                setEditingRecordId(form.editingRecordId);
                setEditingCreatedAt(form.createdAt);
            } catch (error: unknown) {
                if (!cancelled) {
                    const message = error instanceof Error ? error.message : '加载紫微记录失败';
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

    const handleStart = async () => {
        if (loading) {
            return;
        }

        if (!location) {
            CustomAlert.alert('提示', '紫微斗数排盘必须先选择出生地区，以便换算真太阳时。');
            return;
        }

        let payload: ZiweiInputPayload;
        try {
            payload = buildZiweiInputPayload({
                birthDate,
                longitude: location.longitude,
                gender,
                daylightSavingEnabled,
                calendarType: birthSelection.calendarType,
                lunar: birthSelection.lunar,
                config,
                cityLabel: buildRegionDisplayName(location),
                name,
                tzOffsetMinutes: ZIWEI_STANDARD_TIMEZONE_OFFSET_MINUTES,
            });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : '出生时间参数无效';
            CustomAlert.alert('错误', message);
            return;
        }

        try {
            setLoading(true);
            await yieldToNextFrame();
            const nextRecordId = editingRecordId || createZiweiRecordId();
            const nextCreatedAt = editingCreatedAt || new Date().toISOString();

            router.push(buildZiweiResultRoute({
                payload,
                recordId: nextRecordId,
                recordCreatedAt: nextCreatedAt,
                routeDraft: true,
            }));
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : '紫微命盘保存失败';
            CustomAlert.alert('错误', message);
        } finally {
            setLoading(false);
        }
    };
    const isSubmitting = loading;
    const handleLocationSelect = useCallback((selectedRegion: RegionSelection | null) => {
        setLocation(selectedRegion);
        setLocationFallbackLabel('');
        setCityPickerVisible(false);
    }, []);
    const handleBirthConfirm = useCallback((date: Date) => {
        setBirthDate(date);
        setBirthPickerVisible(false);
    }, []);
    const handleBirthConfirmDetail = useCallback((selection: DateTimePickerSelection) => {
        setBirthSelection({
            calendarType: selection.calendarType,
            lunar: selection.calendarType === 'lunar' && selection.lunar
                ? {
                    year: selection.lunar.year,
                    month: selection.lunar.month,
                    day: selection.lunar.day,
                    isLeapMonth: selection.lunar.isLeapMonth,
                    label: selection.lunar.label,
                }
                : undefined,
        });
    }, []);

    return (
        <View style={styles.container}>
            <StatusBarDecor />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} disabled={isSubmitting}>
                    <BackIcon size={24} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{editingRecordId ? '修改紫微' : '紫微斗数'}</Text>
                <View style={styles.backBtn} />
            </View>

            {initializing ? (
                <View style={styles.initializingWrap}>
                    <Text style={styles.hint}>正在加载命盘...</Text>
                </View>
            ) : (
                <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                <Text style={styles.hint}>
                    紫微斗数固定按真太阳时排盘。这里不再做预演，只有点击进入紫微盘时才会按出生地区与时间完成一次校时并直接出盘。
                </Text>

                <LocationBar
                    location={location}
                    onPress={() => setCityPickerVisible(true)}
                    detailText="必填 · 用于真太阳时校时"
                    placeholderDetailText="紫微斗数排盘必须选择出生地区"
                    fallbackLabel={locationFallbackLabel}
                    fallbackDetailText={locationFallbackLabel ? '原记录出生地未能自动匹配，请重新确认区县' : ''}
                />

                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>姓名（可选）</Text>
                    <TextInput
                        style={styles.textInput}
                        value={name}
                        onChangeText={setName}
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
                        <Text style={styles.selectorText}>{formatDateTime(birthDate)}</Text>
                        <ChevronRightIcon size={20} color={Colors.text.tertiary} />
                    </TouchableOpacity>
                    <Text style={styles.advancedHint}>
                        {birthSelection.calendarType === 'lunar'
                            ? `当前保留农历语义 · ${formatLunarInputLabel(birthSelection.lunar)}`
                            : '当前按公历语义入盘'}
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>性别</Text>
                    <View style={styles.optionRow}>
                        <TouchableOpacity
                            style={[styles.optionBtn, gender === 'male' && styles.optionBtnActive]}
                            onPress={() => setGender('male')}
                        >
                            <Text style={[styles.optionText, gender === 'male' && styles.optionTextActive]}>
                                男
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.optionBtn, gender === 'female' && styles.optionBtnActive]}
                            onPress={() => setGender('female')}
                        >
                            <Text style={[styles.optionText, gender === 'female' && styles.optionTextActive]}>
                                女
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>历史夏令时（可选）</Text>
                    <View style={styles.optionRow}>
                        <TouchableOpacity
                            style={[styles.optionBtn, !daylightSavingEnabled && styles.optionBtnActive]}
                            onPress={() => setDaylightSavingEnabled(false)}
                        >
                            <Text style={[styles.optionText, !daylightSavingEnabled && styles.optionTextActive]}>
                                关闭
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.optionBtn, daylightSavingEnabled && styles.optionBtnActive]}
                            onPress={() => setDaylightSavingEnabled(true)}
                        >
                            <Text style={[styles.optionText, daylightSavingEnabled && styles.optionTextActive]}>
                                开启
                            </Text>
                        </TouchableOpacity>
                    </View>
                    <Text style={styles.advancedHint}>
                        开启后会先回退 60 分钟，再按经度与时差方程进行真太阳时修正。
                    </Text>
                </View>

                <TouchableOpacity
                    style={[styles.calcBtn, isSubmitting && styles.calcBtnDisabled]}
                    onPress={handleStart}
                    activeOpacity={0.82}
                    disabled={isSubmitting}
                >
                    <Text style={styles.calcBtnText}>
                        {isSubmitting ? '排盘中...' : (editingRecordId ? '保存修改并进入紫微盘' : '进入紫微盘')}
                    </Text>
                </TouchableOpacity>
                </ScrollView>
            )}

            <CityPicker
                visible={cityPickerVisible}
                onClose={() => setCityPickerVisible(false)}
                onSelect={handleLocationSelect}
                selectedRegion={location}
            />

            <DateTimePicker
                visible={birthPickerVisible}
                initialDate={birthDate}
                onClose={() => setBirthPickerVisible(false)}
                onConfirm={handleBirthConfirm}
                onConfirmDetail={handleBirthConfirmDetail}
            />
        </View>
    );
}

const makeStyles = (Colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.bg.primary,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
    },
    backBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: FontSize.lg,
        color: Colors.text.heading,
        fontWeight: '400',
    },
    initializingWrap: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: Spacing.xl,
    },
    content: {
        flex: 1,
        paddingHorizontal: Spacing.xl,
    },
    hint: {
        fontSize: FontSize.sm,
        color: Colors.text.tertiary,
        textAlign: 'center',
        marginVertical: Spacing.xl,
        lineHeight: 22,
    },
    section: {
        marginBottom: Spacing.xl,
    },
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
    optionRow: {
        flexDirection: 'row',
        gap: Spacing.sm,
    },
    optionBtn: {
        flex: 1,
        minHeight: 44,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
        backgroundColor: Colors.bg.card,
        alignItems: 'center',
        justifyContent: 'center',
    },
    optionBtnActive: {
        borderColor: Colors.accent.gold,
        backgroundColor: Colors.bg.elevated,
    },
    optionText: {
        fontSize: FontSize.md,
        color: Colors.text.secondary,
    },
    optionTextActive: {
        color: Colors.accent.gold,
        fontWeight: '600',
    },
    advancedHint: {
        marginTop: Spacing.sm,
        fontSize: FontSize.xs,
        color: Colors.text.tertiary,
        lineHeight: 18,
    },
    optionSection: {
        marginTop: Spacing.lg,
    },
    optionSectionLabel: {
        fontSize: FontSize.xs,
        color: Colors.text.tertiary,
        marginBottom: Spacing.sm,
        letterSpacing: 1,
    },
    optionSubLabel: {
        fontSize: FontSize.xs,
        color: Colors.text.secondary,
        marginBottom: 6,
    },
    optionGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
    },
    optionGridBtn: {
        flexBasis: '31%',
        minWidth: 92,
    },
    optionSpacer: {
        height: Spacing.sm,
    },
    previewCard: {
        borderRadius: BorderRadius.xl,
        backgroundColor: Colors.bg.card,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
        padding: Spacing.xl,
        marginBottom: Spacing.xl,
    },
    previewTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.lg,
    },
    previewTitleWrap: {
        flex: 1,
    },
    previewIcon: {
        width: 34,
        height: 34,
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.bg.elevated,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: Spacing.sm,
    },
    previewTitle: {
        fontSize: FontSize.md,
        color: Colors.text.heading,
        fontWeight: '600',
    },
    previewStatusText: {
        marginTop: 4,
        fontSize: FontSize.xs,
        color: Colors.text.tertiary,
        lineHeight: 18,
    },
    previewStatusTextReady: {
        color: Colors.accent.gold,
    },
    previewItem: {
        marginBottom: Spacing.md,
    },
    previewLabel: {
        fontSize: FontSize.xs,
        color: Colors.text.tertiary,
        marginBottom: 4,
        letterSpacing: 1,
    },
    previewValue: {
        fontSize: FontSize.md,
        color: Colors.text.primary,
    },
    previewPlaceholder: {
        fontSize: FontSize.sm,
        color: Colors.text.tertiary,
        lineHeight: 20,
    },
    calcBtn: {
        minHeight: 50,
        borderRadius: BorderRadius.round,
        backgroundColor: Colors.accent.gold,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing.xxxl,
    },
    calcBtnDisabled: {
        opacity: 0.78,
    },
    calcBtnText: {
        fontSize: FontSize.md,
        color: Colors.text.inverse,
        fontWeight: '700',
        letterSpacing: 1,
    },
    processingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(8, 10, 16, 0.42)',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: Spacing.xl,
    },
    processingCard: {
        width: '100%',
        maxWidth: 320,
        borderRadius: BorderRadius.xl,
        backgroundColor: Colors.bg.card,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.xxl,
    },
    processingTitle: {
        marginTop: Spacing.lg,
        fontSize: FontSize.lg,
        color: Colors.text.heading,
        fontWeight: '600',
        textAlign: 'center',
    },
    processingBody: {
        marginTop: Spacing.sm,
        fontSize: FontSize.sm,
        color: Colors.text.secondary,
        lineHeight: 22,
        textAlign: 'center',
    },
});
