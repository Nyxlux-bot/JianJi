import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
    FlatList,
    ListRenderItemInfo,
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import ScrollPicker from './ScrollPicker';
import { Spacing, FontSize, BorderRadius } from '../theme/colors';
import {
    findDatesByBazi,
    formatLunarDateLabel,
    getLunarLeapMonth,
    getLunarMonthDays,
    lunarToSolar,
    solarToLunar,
} from '../core/lunar';
import { CustomAlert } from './CustomAlertProvider';
import { useTheme } from '../theme/ThemeContext';

interface DateTimePickerProps {
    visible: boolean;
    initialDate: Date;
    onClose: () => void;
    onConfirm: (date: Date) => void;
    onConfirmDetail?: (selection: DateTimePickerSelection) => void;
}

export interface DateTimePickerSelection {
    date: Date;
    sourceTab: 'solar' | 'lunar' | 'bazi';
    calendarType: 'solar' | 'lunar';
    lunar?: {
        year: number;
        month: number;
        day: number;
        isLeapMonth: boolean;
        label: string;
    };
}

const TIAN_GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const DI_ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

const MONTH_CN = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];
const DAY_CN = [
    '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
    '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
    '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十',
];

const YEARS = Array.from({ length: 150 }, (_, i) => (1900 + i).toString());
const SOLAR_MONTHS = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));
const HOURS = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));
const BAZI_RESULT_ROW_HEIGHT = 44;

function getDaysInMonth(year: number, month: number): number {
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return 31;
    return new Date(year, month, 0).getDate();
}

function isValidSolarDate(y: number, m: number, d: number, h: number, min: number): boolean {
    if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d) || !Number.isInteger(h) || !Number.isInteger(min)) {
        return false;
    }
    if (m < 1 || m > 12) return false;
    if (h < 0 || h > 23) return false;
    if (min < 0 || min > 59) return false;

    const maxDay = getDaysInMonth(y, m);
    if (d < 1 || d > maxDay) return false;

    const date = new Date(y, m - 1, d);
    return date.getFullYear() === y && (date.getMonth() + 1) === m && date.getDate() === d;
}

// ==== 五行颜色与级联辅助方法 ====
const getColor = (char: string, Colors: any) => {
    if (!char) return Colors.text.primary;
    if (['甲', '乙', '寅', '卯'].includes(char)) return '#4CAF50';
    if (['丙', '丁', '巳', '午'].includes(char)) return '#F44336';
    if (['戊', '己', '辰', '戌', '丑', '未'].includes(char)) return '#8D6E63';
    if (['庚', '辛', '申', '酉'].includes(char)) return '#FF9800';
    if (['壬', '癸', '亥', '子'].includes(char)) return '#2196F3';
    return Colors.text.primary;
};

const getParityBranches = (gan: string) => {
    const isYang = TIAN_GAN.indexOf(gan) % 2 === 0;
    return DI_ZHI.filter((_, i) => i % 2 === (isYang ? 0 : 1));
};

const getMonthPillarsForYear = (yGan: string) => {
    const startGanIdx = [2, 4, 6, 8, 0][TIAN_GAN.indexOf(yGan) % 5];
    return Array.from({ length: 12 }, (_, i) => TIAN_GAN[(startGanIdx + i) % 10] + DI_ZHI[(i + 2) % 12]);
};

const getHourPillarsForDay = (dGan: string) => {
    const startGanIdx = [0, 2, 4, 6, 8][TIAN_GAN.indexOf(dGan) % 5];
    return Array.from({ length: 12 }, (_, i) => TIAN_GAN[(startGanIdx + i) % 10] + DI_ZHI[i % 12]);
};

type BaziStep = 'Y_GAN' | 'Y_ZHI' | 'M' | 'D_GAN' | 'D_ZHI' | 'H' | null;

interface BaziDraftState {
    step: BaziStep;
    yearGan: string;
    yearZhi: string;
    monthGan: string;
    monthZhi: string;
    dayGan: string;
    dayZhi: string;
    hourGan: string;
    hourZhi: string;
}

interface BaziResultRowItem {
    index: number;
    key: string;
    label: string;
}

interface BaziResultRowProps {
    index: number;
    label: string;
    onPress: (index: number) => void;
    itemStyle: object;
    textStyle: object;
}

const BaziResultRow = memo(function BaziResultRow({
    index,
    label,
    onPress,
    itemStyle,
    textStyle,
}: BaziResultRowProps) {
    const handlePress = useCallback(() => {
        onPress(index);
    }, [index, onPress]);

    return (
        <TouchableOpacity style={itemStyle} onPress={handlePress}>
            <Text style={textStyle}>{label}</Text>
        </TouchableOpacity>
    );
});

function createBaziDraftFromDate(date: Date): BaziDraftState {
    const lunar = solarToLunar(date);

    return {
        step: null,
        yearGan: lunar.yearGanZhi[0],
        yearZhi: lunar.yearGanZhi[1],
        monthGan: lunar.monthGanZhi[0],
        monthZhi: lunar.monthGanZhi[1],
        dayGan: lunar.dayGanZhi[0],
        dayZhi: lunar.dayGanZhi[1],
        hourGan: lunar.hourGanZhi[0],
        hourZhi: lunar.hourGanZhi[1],
    };
}

function buildSelection(date: Date, sourceTab: DateTimePickerSelection['sourceTab']): DateTimePickerSelection {
    if (sourceTab === 'lunar') {
        const lunar = solarToLunar(date);
        return {
            date,
            sourceTab,
            calendarType: 'lunar',
            lunar: {
                year: lunar.year,
                month: lunar.month,
                day: lunar.day,
                isLeapMonth: lunar.isLeap,
                label: formatLunarDateLabel({
                    year: lunar.year,
                    month: lunar.month,
                    day: lunar.day,
                    isLeap: lunar.isLeap,
                }),
            },
        };
    }

    return {
        date,
        sourceTab,
        calendarType: 'solar',
    };
}

function formatBaziResultLabel(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:00`;
}

export default function DateTimePicker({
    visible,
    initialDate,
    onClose,
    onConfirm,
    onConfirmDetail,
}: DateTimePickerProps) {
    const { Colors } = useTheme();
    const styles = useMemo(() => makeStyles(Colors), [Colors]);
    const [activeTab, setActiveTab] = useState<'solar' | 'lunar' | 'bazi'>('solar');
    const [draftDate, setDraftDate] = useState(() => new Date(initialDate));
    const [fastInput, setFastInput] = useState('');
    const [baziDraft, setBaziDraft] = useState<BaziDraftState>(() => createBaziDraftFromDate(initialDate));
    const [baziResults, setBaziResults] = useState<Date[]>([]);

    useEffect(() => {
        if (visible) {
            const nextDate = new Date(initialDate);
            setDraftDate(nextDate);
            setFastInput('');
            setBaziDraft(createBaziDraftFromDate(nextDate));
            setBaziResults([]);
        }
    }, [visible, initialDate]);

    const applyDraftDate = useCallback((date: Date) => {
        const nextDate = new Date(date.getTime());
        nextDate.setSeconds(0, 0);
        setDraftDate(nextDate);
        setBaziResults([]);
        setBaziDraft(createBaziDraftFromDate(nextDate));
    }, []);

    const handleConfirmSelection = useCallback((date: Date, sourceTab: DateTimePickerSelection['sourceTab']) => {
        const confirmedDate = new Date(date.getTime());
        onConfirm(confirmedDate);
        onConfirmDetail?.(buildSelection(confirmedDate, sourceTab));
    }, [onConfirm, onConfirmDetail]);

    const solarYear = draftDate.getFullYear().toString();
    const solarMonth = String(draftDate.getMonth() + 1).padStart(2, '0');
    const solarDay = String(draftDate.getDate()).padStart(2, '0');
    const hour = String(draftDate.getHours()).padStart(2, '0');
    const minute = String(draftDate.getMinutes()).padStart(2, '0');

    const solarDaysNum = useMemo(() => {
        const y = draftDate.getFullYear();
        const m = draftDate.getMonth() + 1;
        const maxDays = getDaysInMonth(y, m);
        return Array.from({ length: maxDays }, (_, i) => (i + 1).toString().padStart(2, '0'));
    }, [draftDate]);

    const lunarDate = useMemo(() => solarToLunar(draftDate), [draftDate]);
    const lunarYear = lunarDate.year.toString();
    const lunarMonth = MONTH_CN[lunarDate.month - 1];
    const lunarDay = DAY_CN[lunarDate.day - 1];
    const lunarLeapMonth = getLunarLeapMonth(lunarDate.year);
    const canToggleLeapMonth = lunarLeapMonth > 0 && lunarLeapMonth === lunarDate.month;

    const updateSolarDate = useCallback((overrides: Partial<{
        year: number;
        month: number;
        day: number;
        hour: number;
        minute: number;
    }>) => {
        const nextYear = overrides.year ?? draftDate.getFullYear();
        const nextMonth = overrides.month ?? draftDate.getMonth() + 1;
        const nextHour = overrides.hour ?? draftDate.getHours();
        const nextMinute = overrides.minute ?? draftDate.getMinutes();
        const nextDay = Math.max(
            1,
            Math.min(overrides.day ?? draftDate.getDate(), getDaysInMonth(nextYear, nextMonth)),
        );
        applyDraftDate(new Date(nextYear, nextMonth - 1, nextDay, nextHour, nextMinute));
    }, [applyDraftDate, draftDate]);

    const updateLunarDate = useCallback((overrides: Partial<{
        year: number;
        month: number;
        day: number;
        isLeapMonth: boolean;
    }>) => {
        const nextYear = overrides.year ?? lunarDate.year;
        const nextMonth = overrides.month ?? lunarDate.month;
        const requestedIsLeap = overrides.isLeapMonth ?? lunarDate.isLeap;
        const nextIsLeap = requestedIsLeap && getLunarLeapMonth(nextYear) === nextMonth;
        const nextDay = Math.max(
            1,
            Math.min(overrides.day ?? lunarDate.day, getLunarMonthDays(nextYear, nextMonth, nextIsLeap)),
        );
        const nextDate = lunarToSolar(nextYear, nextMonth, nextDay, nextIsLeap);
        if (!nextDate) {
            return;
        }
        nextDate.setHours(draftDate.getHours(), draftDate.getMinutes(), 0, 0);
        applyDraftDate(nextDate);
    }, [applyDraftDate, draftDate, lunarDate.day, lunarDate.isLeap, lunarDate.month, lunarDate.year]);

    const clearBazi = useCallback(() => {
        setBaziResults([]);
        setBaziDraft({
            step: 'Y_GAN',
            yearGan: '',
            yearZhi: '',
            monthGan: '',
            monthZhi: '',
            dayGan: '',
            dayZhi: '',
            hourGan: '',
            hourZhi: '',
        });
    }, []);

    const handleFastInput = useCallback((val: string) => {
        setFastInput(val);
        const pureNumbers = val.replace(/\D/g, '');
        if (pureNumbers.length >= 8) {
            const y = parseInt(pureNumbers.substring(0, 4), 10);
            const m = parseInt(pureNumbers.substring(4, 6), 10);
            const d = parseInt(pureNumbers.substring(6, 8), 10);
            const h = pureNumbers.length >= 10 ? parseInt(pureNumbers.substring(8, 10), 10) : 0;
            const min = pureNumbers.length >= 12 ? parseInt(pureNumbers.substring(10, 12), 10) : 0;

            if (isValidSolarDate(y, m, d, h, min)) {
                applyDraftDate(new Date(y, m - 1, d, h, min));
            }
        }
    }, [applyDraftDate]);

    const runBaziSearch = useCallback(() => {
        if (
            !baziDraft.yearGan
            || !baziDraft.yearZhi
            || !baziDraft.monthGan
            || !baziDraft.monthZhi
            || !baziDraft.dayGan
            || !baziDraft.dayZhi
            || !baziDraft.hourGan
            || !baziDraft.hourZhi
        ) {
            CustomAlert.alert('提示', '请完整填选四柱所有的八个字！');
            return;
        }

        const nextResults = findDatesByBazi(
            baziDraft.yearGan + baziDraft.yearZhi,
            baziDraft.monthGan + baziDraft.monthZhi,
            baziDraft.dayGan + baziDraft.dayZhi,
            baziDraft.hourGan + baziDraft.hourZhi,
            1801,
            2099,
        );
        setBaziResults(nextResults);
        setBaziDraft((prev) => ({
            ...prev,
            step: null,
        }));
        if (nextResults.length === 0) {
            CustomAlert.alert('未找到', '在 1801-2099 年间没有找到这套四柱搭配的准确时间！');
        }
    }, [baziDraft]);

    const handleConfirm = useCallback(() => {
        if (activeTab === 'solar') {
            handleConfirmSelection(draftDate, 'solar');
            return;
        }

        if (activeTab === 'lunar') {
            handleConfirmSelection(draftDate, 'lunar');
            return;
        }

        if (baziResults.length > 0) {
            const firstResult = baziResults[0];
            applyDraftDate(firstResult);
            handleConfirmSelection(firstResult, 'bazi');
            return;
        }

        runBaziSearch();
    }, [activeTab, applyDraftDate, baziResults, draftDate, handleConfirmSelection, runBaziSearch]);

    const setGanAndAutoJump = useCallback((step: 'Y_GAN' | 'D_GAN', gan: string) => {
        setBaziResults([]);
        if (step === 'Y_GAN') {
            setBaziDraft((prev) => ({
                ...prev,
                step: 'Y_ZHI',
                yearGan: gan,
                yearZhi: '',
                monthGan: '',
                monthZhi: '',
            }));
            return;
        }

        setBaziDraft((prev) => ({
            ...prev,
            step: 'D_ZHI',
            dayGan: gan,
            dayZhi: '',
            hourGan: '',
            hourZhi: '',
        }));
    }, []);

    const handleSetZhi = useCallback((step: 'Y_ZHI' | 'D_ZHI', zhi: string) => {
        setBaziResults([]);
        if (step === 'Y_ZHI') {
            setBaziDraft((prev) => ({
                ...prev,
                yearZhi: zhi,
                step: 'M',
            }));
            return;
        }

        setBaziDraft((prev) => ({
            ...prev,
            dayZhi: zhi,
            step: 'H',
        }));
    }, []);

    const handleSetPillar = useCallback((step: 'M' | 'H', pillar: string) => {
        setBaziResults([]);
        if (step === 'M') {
            setBaziDraft((prev) => ({
                ...prev,
                monthGan: pillar[0],
                monthZhi: pillar[1],
                step: 'D_GAN',
            }));
            return;
        }

        setBaziDraft((prev) => ({
            ...prev,
            hourGan: pillar[0],
            hourZhi: pillar[1],
            step: null,
        }));
    }, []);

    const handleSelectBaziResult = useCallback((index: number) => {
        const nextDate = baziResults[index];
        if (!nextDate) {
            return;
        }

        applyDraftDate(nextDate);
        handleConfirmSelection(nextDate, 'bazi');
    }, [applyDraftDate, baziResults, handleConfirmSelection]);

    const baziResultItems = useMemo<BaziResultRowItem[]>(() => (
        baziResults.map((date, index) => ({
            index,
            key: `${date.getTime()}-${index}`,
            label: formatBaziResultLabel(date),
        }))
    ), [baziResults]);

    const renderBaziResultItem = useCallback(({ item }: ListRenderItemInfo<BaziResultRowItem>) => (
        <BaziResultRow
            index={item.index}
            label={item.label}
            onPress={handleSelectBaziResult}
            itemStyle={styles.baziResultItem}
            textStyle={styles.baziResultText}
        />
    ), [handleSelectBaziResult, styles.baziResultItem, styles.baziResultText]);

    const keyExtractor = useCallback((item: BaziResultRowItem) => item.key, []);
    const getBaziItemLayout = useCallback((_: ArrayLike<BaziResultRowItem> | null | undefined, index: number) => ({
        length: BAZI_RESULT_ROW_HEIGHT,
        offset: BAZI_RESULT_ROW_HEIGHT * index,
        index,
    }), []);

    const renderHeaders = () => (
        <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>年</Text>
            <Text style={styles.pickerTitle}>月</Text>
            <Text style={styles.pickerTitle}>日</Text>
            <Text style={styles.pickerTitle}>时</Text>
            <Text style={styles.pickerTitle}>分</Text>
        </View>
    );

    const renderPickers = () => {
        if (activeTab === 'solar') {
            return (
                <View style={styles.pickerContainer}>
                    <ScrollPicker data={YEARS} value={solarYear} onValueChange={(value) => updateSolarDate({ year: parseInt(value, 10) })} Colors={Colors} />
                    <ScrollPicker data={SOLAR_MONTHS} value={solarMonth} onValueChange={(value) => updateSolarDate({ month: parseInt(value, 10) })} Colors={Colors} />
                    <ScrollPicker data={solarDaysNum} value={solarDay} onValueChange={(value) => updateSolarDate({ day: parseInt(value, 10) })} Colors={Colors} />
                    <ScrollPicker data={HOURS} value={hour} onValueChange={(value) => updateSolarDate({ hour: parseInt(value, 10) })} Colors={Colors} />
                    <ScrollPicker data={MINUTES} value={minute} onValueChange={(value) => updateSolarDate({ minute: parseInt(value, 10) })} Colors={Colors} />
                </View>
            );
        }
        if (activeTab === 'lunar') {
            return (
                <View>
                    <View style={styles.pickerContainer}>
                        <ScrollPicker data={YEARS} value={lunarYear} onValueChange={(value) => updateLunarDate({ year: parseInt(value, 10) })} Colors={Colors} />
                        <ScrollPicker data={MONTH_CN} value={lunarMonth} onValueChange={(value) => updateLunarDate({ month: MONTH_CN.indexOf(value) + 1 })} Colors={Colors} />
                        <ScrollPicker data={DAY_CN} value={lunarDay} onValueChange={(value) => updateLunarDate({ day: DAY_CN.indexOf(value) + 1 })} Colors={Colors} />
                        <ScrollPicker data={HOURS} value={hour} onValueChange={(value) => updateSolarDate({ hour: parseInt(value, 10) })} Colors={Colors} />
                        <ScrollPicker data={MINUTES} value={minute} onValueChange={(value) => updateSolarDate({ minute: parseInt(value, 10) })} Colors={Colors} />
                    </View>
                    <View style={styles.lunarMetaRow}>
                        <Text style={styles.lunarMetaText}>
                            {lunarLeapMonth > 0
                                ? `本年闰 ${MONTH_CN[lunarLeapMonth - 1]} 月`
                                : '本年无闰月'}
                        </Text>
                        {canToggleLeapMonth ? (
                            <View style={styles.lunarLeapToggleRow}>
                                <TouchableOpacity
                                    style={[
                                        styles.lunarLeapToggleBtn,
                                        !lunarDate.isLeap && styles.lunarLeapToggleBtnActive,
                                    ]}
                                    onPress={() => updateLunarDate({ isLeapMonth: false })}
                                >
                                    <Text
                                        style={[
                                            styles.lunarLeapToggleText,
                                            !lunarDate.isLeap && styles.lunarLeapToggleTextActive,
                                        ]}
                                    >
                                        平月
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[
                                        styles.lunarLeapToggleBtn,
                                        lunarDate.isLeap && styles.lunarLeapToggleBtnActive,
                                    ]}
                                    onPress={() => updateLunarDate({ isLeapMonth: true })}
                                >
                                    <Text
                                        style={[
                                            styles.lunarLeapToggleText,
                                            lunarDate.isLeap && styles.lunarLeapToggleTextActive,
                                        ]}
                                    >
                                        闰月
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        ) : null}
                    </View>
                </View>
            );
        }
        return null;
    };

    const renderBaziPanel = () => {
        if (activeTab !== 'bazi') return null;

        const renderCircle = (char: string, active: boolean, onPress: () => void, isPillarCombo = false) => (
            <TouchableOpacity onPress={onPress} style={[styles.bzCircle, active && styles.bzCircleActive, isPillarCombo && active && styles.bzCircleActiveCombo]}>
                <Text style={{ color: getColor(char, Colors), fontSize: FontSize.lg, fontWeight: 'bold' }}>{char}</Text>
            </TouchableOpacity>
        );

        return (
            <View style={styles.bzContainer}>
                {/* 4柱指示器 */}
                <View style={styles.bzIndicators}>
                    <View style={styles.bzCol}>
                        <Text style={styles.bzColTitle}>年柱</Text>
                        {renderCircle(baziDraft.yearGan, baziDraft.step === 'Y_GAN', () => setBaziDraft((prev) => ({ ...prev, step: 'Y_GAN' })))}
                        {renderCircle(baziDraft.yearZhi, baziDraft.step === 'Y_ZHI', () => setBaziDraft((prev) => ({ ...prev, step: prev.yearGan ? 'Y_ZHI' : 'Y_GAN' })))}
                    </View>
                    <View style={styles.bzCol}>
                        <Text style={styles.bzColTitle}>月柱</Text>
                        {renderCircle(baziDraft.monthGan, baziDraft.step === 'M', () => setBaziDraft((prev) => ({ ...prev, step: prev.yearGan ? 'M' : 'Y_GAN' })), true)}
                        {renderCircle(baziDraft.monthZhi, baziDraft.step === 'M', () => setBaziDraft((prev) => ({ ...prev, step: prev.yearGan ? 'M' : 'Y_GAN' })), true)}
                    </View>
                    <View style={styles.bzCol}>
                        <Text style={styles.bzColTitle}>日柱</Text>
                        {renderCircle(baziDraft.dayGan, baziDraft.step === 'D_GAN', () => setBaziDraft((prev) => ({ ...prev, step: 'D_GAN' })))}
                        {renderCircle(baziDraft.dayZhi, baziDraft.step === 'D_ZHI', () => setBaziDraft((prev) => ({ ...prev, step: prev.dayGan ? 'D_ZHI' : 'D_GAN' })))}
                    </View>
                    <View style={styles.bzCol}>
                        <Text style={styles.bzColTitle}>时柱</Text>
                        {renderCircle(baziDraft.hourGan, baziDraft.step === 'H', () => setBaziDraft((prev) => ({ ...prev, step: prev.dayGan ? 'H' : 'D_GAN' })), true)}
                        {renderCircle(baziDraft.hourZhi, baziDraft.step === 'H', () => setBaziDraft((prev) => ({ ...prev, step: prev.dayGan ? 'H' : 'D_GAN' })), true)}
                    </View>
                </View>

                {/* 搜索提示栏 */}
                <View style={styles.baziControl}>
                    <Text style={styles.baziSub}>查找范围：1801~2099年</Text>
                    <TouchableOpacity style={styles.baziClearBtn} onPress={clearBazi}>
                        <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={Colors.text.secondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <Path d="M3 6h18" />
                            <Path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                            <Path d="M10 11v6" />
                            <Path d="M14 11v6" />
                        </Svg>
                        <Text style={styles.baziClearText}>清除</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.baziSearchBtn} onPress={runBaziSearch}>
                        <Text style={styles.baziSearchBtnText}>开始推算起时</Text>
                    </TouchableOpacity>
                </View>

                {/* 候选底盘渲染 */}
                <View style={styles.bzGridContainer}>
                    {baziDraft.step === 'Y_GAN' || baziDraft.step === 'D_GAN' ? (
                        <View style={styles.bzGridRow}>
                            {TIAN_GAN.map((gan) => (
                                <TouchableOpacity key={gan} style={[styles.bzDataBtn, { width: '18%' }]} onPress={() => setGanAndAutoJump(baziDraft.step as 'Y_GAN' | 'D_GAN', gan)}>
                                    <Text style={{ color: getColor(gan, Colors), fontSize: FontSize.xl, fontWeight: 'bold' }}>{gan}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    ) : null}

                    {baziDraft.step === 'Y_ZHI' || baziDraft.step === 'D_ZHI' ? (
                        <View style={styles.bzGridRow}>
                            {getParityBranches(baziDraft.step === 'Y_ZHI' ? baziDraft.yearGan : baziDraft.dayGan).map((zhi) => (
                                <TouchableOpacity key={zhi} style={[styles.bzDataBtn, { width: '30%' }]} onPress={() => handleSetZhi(baziDraft.step as 'Y_ZHI' | 'D_ZHI', zhi)}>
                                    <Text style={{ color: getColor(zhi, Colors), fontSize: FontSize.xl, fontWeight: 'bold' }}>{zhi}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    ) : null}

                    {baziDraft.step === 'M' || baziDraft.step === 'H' ? (
                        <View style={styles.bzGridRow}>
                            {(baziDraft.step === 'M' ? getMonthPillarsForYear(baziDraft.yearGan) : getHourPillarsForDay(baziDraft.dayGan)).map((pillar) => (
                                <TouchableOpacity key={pillar} style={[styles.bzDataBtn, { width: '23%', flexDirection: 'row', gap: 4 }]} onPress={() => handleSetPillar(baziDraft.step as 'M' | 'H', pillar)}>
                                    <Text style={{ color: getColor(pillar[0], Colors), fontSize: FontSize.lg, fontWeight: 'bold' }}>{pillar[0]}</Text>
                                    <Text style={{ color: getColor(pillar[1], Colors), fontSize: FontSize.lg, fontWeight: 'bold' }}>{pillar[1]}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    ) : null}
                </View>

                {/* 结果显示 */}
                {baziResults.length > 0 && (
                    <View style={styles.baziResults}>
                        <Text style={styles.baziResultTitle}>满足该干支流转的时刻 (点击即可选中):</Text>
                        <FlatList
                            data={baziResultItems}
                            renderItem={renderBaziResultItem}
                            keyExtractor={keyExtractor}
                            getItemLayout={getBaziItemLayout}
                            initialNumToRender={8}
                            showsVerticalScrollIndicator={false}
                            style={styles.baziResultsList}
                        />
                    </View>
                )}
            </View>
        );
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <TouchableWithoutFeedback onPress={onClose}><View style={styles.closeArea} /></TouchableWithoutFeedback>
                <View style={styles.content}>
                    <View style={styles.header}>
                        <View style={styles.tabsPanel}>
                            <TouchableOpacity style={[styles.tabBtn, activeTab === 'solar' && styles.tabBtnActive]} onPress={() => setActiveTab('solar')}>
                                <Text style={[styles.tabText, activeTab === 'solar' && styles.tabTextActive]}>公历</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.tabBtn, activeTab === 'lunar' && styles.tabBtnActive]} onPress={() => setActiveTab('lunar')}>
                                <Text style={[styles.tabText, activeTab === 'lunar' && styles.tabTextActive]}>农历</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.tabBtn, activeTab === 'bazi' && styles.tabBtnActive]} onPress={() => setActiveTab('bazi')}>
                                <Text style={[styles.tabText, activeTab === 'bazi' && styles.tabTextActive]}>四柱</Text>
                            </TouchableOpacity>
                        </View>
                        <TouchableOpacity style={styles.btnConfirm} onPress={handleConfirm}>
                            <Text style={styles.btnConfirmText}>确定</Text>
                        </TouchableOpacity>
                    </View>

                    {activeTab !== 'bazi' && (
                        <View style={styles.fastInputContainer}>
                            <TextInput style={styles.fastInput} placeholder="出生年月(格式 199303270255)" placeholderTextColor={Colors.text.tertiary} keyboardType="numeric" value={fastInput} onChangeText={handleFastInput} />
                            <TouchableOpacity style={styles.fastInputBtn} onPress={() => applyDraftDate(new Date())}>
                                <Text style={styles.fastInputBtnText}>当前时刻</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {activeTab !== 'bazi' && renderHeaders()}
                    {activeTab !== 'bazi' && renderPickers()}
                    {renderBaziPanel()}
                </View>
            </View>
        </Modal>
    );
}

const makeStyles = (Colors: any) => StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    closeArea: { flex: 1 },
    content: {
        backgroundColor: Colors.bg.primary, borderTopLeftRadius: BorderRadius.xl,
        borderTopRightRadius: BorderRadius.xl, paddingBottom: Spacing.xxl
    },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.lg, borderBottomWidth: 0.5, borderBottomColor: Colors.border.subtle,
    },
    tabsPanel: { flexDirection: 'row', backgroundColor: Colors.bg.elevated, borderRadius: BorderRadius.round, padding: 4 },
    tabBtn: { paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: BorderRadius.round },
    tabBtnActive: { backgroundColor: Colors.bg.primary, elevation: 2 },
    tabText: { fontSize: FontSize.md, color: Colors.text.tertiary },
    tabTextActive: { color: Colors.text.primary, fontWeight: '500' },
    btnConfirm: { backgroundColor: Colors.accent.gold, paddingHorizontal: Spacing.xl, paddingVertical: 8, borderRadius: BorderRadius.round },
    btnConfirmText: { fontSize: FontSize.md, color: Colors.text.inverse, fontWeight: '500', letterSpacing: 1 },
    fastInputContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.sm },
    fastInput: { flex: 1, backgroundColor: Colors.bg.elevated, borderRadius: BorderRadius.round, paddingHorizontal: Spacing.lg, paddingVertical: 10, fontSize: FontSize.sm, color: Colors.text.primary },
    fastInputBtn: { paddingHorizontal: Spacing.md, paddingVertical: 10, backgroundColor: Colors.bg.card, borderWidth: 1, borderColor: Colors.border.subtle, borderRadius: BorderRadius.round },
    fastInputBtnText: { fontSize: FontSize.sm, color: Colors.text.secondary },
    pickerHeader: { flexDirection: 'row', paddingHorizontal: Spacing.lg, marginTop: Spacing.md },
    pickerTitle: { flex: 1, textAlign: 'center', fontSize: FontSize.sm, color: Colors.text.secondary, fontWeight: 'bold' },
    pickerContainer: { flexDirection: 'row', paddingHorizontal: Spacing.sm, height: 200, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    lunarMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.lg,
        paddingTop: Spacing.sm,
    },
    lunarMetaText: {
        fontSize: FontSize.sm,
        color: Colors.text.secondary,
    },
    lunarLeapToggleRow: {
        flexDirection: 'row',
        gap: 6,
    },
    lunarLeapToggleBtn: {
        minHeight: 34,
        paddingHorizontal: Spacing.md,
        borderRadius: BorderRadius.round,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
        backgroundColor: Colors.bg.elevated,
        alignItems: 'center',
        justifyContent: 'center',
    },
    lunarLeapToggleBtnActive: {
        borderColor: Colors.accent.gold,
        backgroundColor: Colors.bg.card,
    },
    lunarLeapToggleText: {
        fontSize: FontSize.sm,
        color: Colors.text.secondary,
    },
    lunarLeapToggleTextActive: {
        color: Colors.accent.gold,
        fontWeight: '600',
    },

    // ======== Bazi Styles ========
    bzContainer: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg },
    bzIndicators: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: Spacing.lg },
    bzCol: { alignItems: 'center', gap: Spacing.md },
    bzColTitle: { fontSize: FontSize.md, color: Colors.text.secondary, fontWeight: 'bold' },
    bzCircle: { width: 50, height: 50, borderRadius: 25, backgroundColor: Colors.bg.elevated, justifyContent: 'center', alignItems: 'center' },
    bzCircleActive: { backgroundColor: Colors.bg.card, borderWidth: 1.5, borderColor: Colors.text.tertiary },
    bzCircleActiveCombo: { backgroundColor: Colors.bg.card, borderWidth: 1, borderColor: Colors.border.subtle },
    baziControl: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.sm, borderTopWidth: 0.5, borderTopColor: Colors.border.subtle },
    baziSub: { fontSize: FontSize.sm, color: Colors.text.tertiary, flex: 1 },
    baziClearBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: Spacing.md },
    baziClearText: { color: Colors.text.secondary, fontSize: FontSize.sm },
    baziSearchBtn: { backgroundColor: Colors.accent.gold, paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: BorderRadius.round },
    baziSearchBtnText: { color: Colors.text.inverse, fontSize: FontSize.sm, fontWeight: 'bold' },
    bzGridContainer: { minHeight: 180, marginTop: Spacing.md },
    bzGridRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
    bzDataBtn: { height: 50, backgroundColor: Colors.bg.elevated, borderRadius: BorderRadius.md, justifyContent: 'center', alignItems: 'center', borderWidth: 0.5, borderColor: Colors.border.subtle },
    baziResults: { height: 160, backgroundColor: Colors.bg.elevated, borderRadius: BorderRadius.md, padding: Spacing.md, marginTop: Spacing.md },
    baziResultsList: { flex: 1 },
    baziResultTitle: { color: Colors.text.secondary, fontSize: FontSize.sm, marginBottom: Spacing.sm },
    baziResultItem: { minHeight: BAZI_RESULT_ROW_HEIGHT, justifyContent: 'center', borderBottomWidth: 0.5, borderBottomColor: Colors.border.subtle },
    baziResultText: { color: Colors.accent.gold, fontSize: FontSize.md, textAlign: 'center', fontWeight: 'bold' }
});
