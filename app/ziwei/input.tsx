import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { BackIcon, ChevronRightIcon, SparklesIcon } from '../../src/components/Icons';
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
import { formatTimeDiff } from '../../src/core/true-solar-time';
import { getRecord, replaceRecord, saveRecord } from '../../src/db/database';
import {
    buildZiweiInputPayload,
    computeZiweiDynamicHoroscope,
    computeZiweiDerivedInput,
    computeZiweiStaticChart,
    ZIWEI_DEFAULT_CONFIG,
    ZIWEI_STANDARD_TIMEZONE_OFFSET_MINUTES,
} from '../../src/features/ziwei/iztro-adapter';
import { buildZiweiEditFormState } from '../../src/features/ziwei/edit-helpers';
import { buildZiweiRecordResult, buildZiweiSummary } from '../../src/features/ziwei/record';
import { buildZiweiResultRoute } from '../../src/features/ziwei/result-route';
import {
    ZiweiAlgorithm,
    ZiweiAstroType,
    ZiweiConfigOptions,
    ZiweiDayDivide,
    ZiweiGender,
    ZiweiInputPayload,
    ZiweiLunarDateInput,
    ZiweiYearDivide,
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

const ALGORITHM_OPTIONS: Array<{ value: ZiweiAlgorithm; label: string }> = [
    { value: 'default', label: '通行' },
    { value: 'zhongzhou', label: '中州' },
];

const YEAR_DIVIDE_OPTIONS: Array<{ value: ZiweiYearDivide; label: string }> = [
    { value: 'normal', label: '农历正月' },
    { value: 'exact', label: '立春' },
];

const DAY_DIVIDE_OPTIONS: Array<{ value: ZiweiDayDivide; label: string }> = [
    { value: 'forward', label: '晚子算次日' },
    { value: 'current', label: '晚子算当日' },
];

const ASTRO_TYPE_OPTIONS: Array<{ value: ZiweiAstroType; label: string }> = [
    { value: 'heaven', label: '天盘' },
    { value: 'earth', label: '地盘' },
    { value: 'human', label: '人盘' },
];

const WARM_STATUS_COPY = {
    idle: '填写完成后会自动预热排盘引擎。',
    warming: '参数刚更新，正在后台预热命盘计算。',
    ready: '命盘引擎已预热，开始排盘会直接命中缓存。',
} as const;

const SUBMIT_PHASE_COPY = {
    calibrating: {
        title: '正在校准真太阳时',
        body: '先按出生地经度、时区与夏令时修正出生时刻。',
    },
    charting: {
        title: '正在生成紫微命盘',
        body: '正在计算十二宫位、主星辅曜、生年四化与当前运限。',
    },
    saving: {
        title: '正在写入命盘',
        body: '马上进入结果页，结果会写入历史记录供后续 AI 继续使用。',
    },
} as const;

function waitForNextPaint(): Promise<void> {
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
    const [initializing, setInitializing] = useState(Boolean(editId));
    const [warmState, setWarmState] = useState<keyof typeof WARM_STATUS_COPY>('idle');
    const [submitPhase, setSubmitPhase] = useState<keyof typeof SUBMIT_PHASE_COPY | null>(null);

    useEffect(() => {
        let cancelled = false;

        const loadEditingRecord = async () => {
            if (!editId) {
                setInitializing(false);
                return;
            }

            try {
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

    const preview = useMemo(() => {
        if (!location) {
            return null;
        }

        try {
            const payload = buildZiweiInputPayload({
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

            return {
                payload,
                computed: computeZiweiDerivedInput(payload),
            };
        } catch {
            return null;
        }
    }, [birthDate, birthSelection.calendarType, birthSelection.lunar, config, daylightSavingEnabled, gender, location, name]);

    useEffect(() => {
        let cancelled = false;

        if (!preview) {
            setWarmState('idle');
            return;
        }

        setWarmState('warming');
        const timer = setTimeout(() => {
            requestAnimationFrame(() => {
                if (cancelled) {
                    return;
                }

                try {
                    computeZiweiStaticChart(preview.payload);
                    if (!cancelled) {
                        setWarmState('ready');
                    }
                } catch {
                    if (!cancelled) {
                        setWarmState('idle');
                    }
                }
            });
        }, 90);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [preview]);

    const handleStart = async () => {
        if (submitPhase) {
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

        let navigated = false;
        try {
            setSubmitPhase('calibrating');
            await waitForNextPaint();
            await waitForNextPaint();

            setSubmitPhase('charting');
            const staticChart = computeZiweiStaticChart(payload);
            await waitForNextPaint();
            const dynamic = computeZiweiDynamicHoroscope(staticChart, new Date());
            const record = buildZiweiRecordResult({ staticChart, dynamic });

            const envelope = {
                engineType: 'ziwei' as const,
                result: record,
                summary: buildZiweiSummary(record),
            };

            setSubmitPhase('saving');
            await waitForNextPaint();

            if (editingRecordId) {
                await replaceRecord(editingRecordId, envelope);
            } else {
                await saveRecord(envelope);
            }

            navigated = true;
            router.push(buildZiweiResultRoute({
                payload,
                computed: staticChart.input,
                recordId: record.id,
            }));
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : '紫微命盘保存失败';
            CustomAlert.alert('错误', message);
        } finally {
            if (!navigated) {
                setSubmitPhase(null);
            }
        }
    };

    const submitCopy = submitPhase ? SUBMIT_PHASE_COPY[submitPhase] : null;
    const isSubmitting = submitPhase !== null;
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
                    本链路固定使用真太阳时。输入出生地区后，会先按中国标准时区 UTC+8 与经度、时差方程换算出真太阳时，再交给 `iztro` 排盘。
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

                <View style={styles.previewCard}>
                    <Text style={styles.previewTitle}>高级排盘配置</Text>
                    <Text style={styles.advancedHint}>
                        这里会直接影响 `iztro` 的排盘算法、分界口径和盘型，不再固定死在默认值。
                    </Text>

                    <View style={styles.optionSection}>
                        <Text style={styles.optionSectionLabel}>安星算法</Text>
                        <OptionGroup
                            styles={styles}
                            options={ALGORITHM_OPTIONS}
                            value={config.algorithm}
                            onChange={(value) => setConfig((prev) => ({ ...prev, algorithm: value }))}
                        />
                    </View>

                    <View style={styles.optionSection}>
                        <Text style={styles.optionSectionLabel}>年界 / 运限界</Text>
                        <Text style={styles.optionSubLabel}>年界</Text>
                        <OptionGroup
                            styles={styles}
                            options={YEAR_DIVIDE_OPTIONS}
                            value={config.yearDivide}
                            onChange={(value) => setConfig((prev) => ({ ...prev, yearDivide: value }))}
                        />
                        <View style={styles.optionSpacer} />
                        <Text style={styles.optionSubLabel}>运限界</Text>
                        <OptionGroup
                            styles={styles}
                            options={YEAR_DIVIDE_OPTIONS}
                            value={config.horoscopeDivide}
                            onChange={(value) => setConfig((prev) => ({ ...prev, horoscopeDivide: value }))}
                        />
                    </View>

                    <View style={styles.optionSection}>
                        <Text style={styles.optionSectionLabel}>晚子时口径</Text>
                        <OptionGroup
                            styles={styles}
                            options={DAY_DIVIDE_OPTIONS}
                            value={config.dayDivide}
                            onChange={(value) => setConfig((prev) => ({ ...prev, dayDivide: value }))}
                        />
                    </View>

                    <View style={styles.optionSection}>
                        <Text style={styles.optionSectionLabel}>盘型</Text>
                        <OptionGroup
                            styles={styles}
                            options={ASTRO_TYPE_OPTIONS}
                            value={config.astroType}
                            onChange={(value) => setConfig((prev) => ({ ...prev, astroType: value }))}
                        />
                    </View>
                </View>

                <View style={styles.previewCard}>
                    <View style={styles.previewTitleRow}>
                        <View style={styles.previewIcon}>
                            <SparklesIcon size={20} color={Colors.accent.gold} />
                        </View>
                        <View style={styles.previewTitleWrap}>
                            <Text style={styles.previewTitle}>真太阳时预演</Text>
                            <Text style={[styles.previewStatusText, warmState === 'ready' && styles.previewStatusTextReady]}>
                                {WARM_STATUS_COPY[warmState]}
                            </Text>
                        </View>
                    </View>
                    {preview ? (
                        <>
                            <PreviewItem
                                label="输入语义"
                                value={preview.payload.calendarType === 'lunar'
                                    ? `农历 · ${formatLunarInputLabel(preview.payload.lunar)}`
                                    : '公历'}
                                styles={styles}
                            />
                            <PreviewItem label="原始时间" value={formatDateTime(preview.computed.birthLocalDate)} styles={styles} />
                            <PreviewItem label="真太阳时" value={formatDateTime(preview.computed.trueSolarDate)} styles={styles} />
                            <PreviewItem label="修正差值" value={formatTimeDiff(preview.computed.birthLocalDate, preview.computed.trueSolarDate)} styles={styles} />
                            {preview.payload.calendarType === 'lunar' ? (
                                <PreviewItem
                                    label="校正后农历"
                                    value={formatLunarInputLabel(preview.computed.trueSolarLunar)}
                                    styles={styles}
                                />
                            ) : (
                                <PreviewItem label="排盘日期" value={preview.computed.solarDate} styles={styles} />
                            )}
                            <PreviewItem
                                label="排盘调用"
                                value={preview.payload.calendarType === 'lunar'
                                    ? `byLunar · ${formatLunarInputLabel(preview.computed.trueSolarLunar)}`
                                    : `bySolar · ${preview.computed.solarDate}`}
                                styles={styles}
                            />
                            <PreviewItem
                                label="落入时辰"
                                value={`${preview.computed.timeLabel} · ${preview.computed.timeRange}`}
                                styles={styles}
                            />
                        </>
                    ) : (
                        <Text style={styles.previewPlaceholder}>
                            选择出生地区后，这里会显示真太阳时校正结果与最终落入的时辰。
                        </Text>
                    )}
                </View>

                <TouchableOpacity
                    style={[styles.calcBtn, isSubmitting && styles.calcBtnDisabled]}
                    onPress={handleStart}
                    activeOpacity={0.82}
                    disabled={isSubmitting}
                >
                    <Text style={styles.calcBtnText}>
                        {isSubmitting ? '排盘中...' : (editingRecordId ? '保存修改并排盘' : '进入紫微盘')}
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

            {submitCopy ? (
                <View style={styles.processingOverlay}>
                    <View style={styles.processingCard}>
                        <ActivityIndicator size="large" color={Colors.accent.gold} />
                        <Text style={styles.processingTitle}>{submitCopy.title}</Text>
                        <Text style={styles.processingBody}>{submitCopy.body}</Text>
                    </View>
                </View>
            ) : null}
        </View>
    );
}

function PreviewItem({
    label,
    value,
    styles,
}: {
    label: string;
    value: string;
    styles: ReturnType<typeof makeStyles>;
}) {
    return (
        <View style={styles.previewItem}>
            <Text style={styles.previewLabel}>{label}</Text>
            <Text style={styles.previewValue}>{value}</Text>
        </View>
    );
}

function OptionGroup<T extends string>({
    styles,
    options,
    value,
    onChange,
}: {
    styles: ReturnType<typeof makeStyles>;
    options: Array<{ value: T; label: string }>;
    value: T;
    onChange: (value: T) => void;
}) {
    return (
        <View style={styles.optionGrid}>
            {options.map((option) => {
                const active = option.value === value;
                return (
                    <TouchableOpacity
                        key={option.value}
                        style={[styles.optionBtn, styles.optionGridBtn, active && styles.optionBtnActive]}
                        onPress={() => onChange(option.value)}
                    >
                        <Text style={[styles.optionText, active && styles.optionTextActive]}>
                            {option.label}
                        </Text>
                    </TouchableOpacity>
                );
            })}
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
