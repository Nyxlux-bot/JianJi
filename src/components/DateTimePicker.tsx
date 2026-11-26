import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import SheetModal from './SheetModal';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import PressableScale from './PressableScale';
import FocusTextInput from './FocusTextInput';
import Svg, { Circle, Path } from 'react-native-svg';
import ScrollPicker from './ScrollPicker';
import { Spacing, FontSize, BorderRadius } from '../theme/colors';
import {
    BaziReverseMatch,
    findBaziMatches,
    formatLunarDateLabel,
    getBaziPillars,
    getLunarLeapMonth,
    getLunarMonthDays,
    lunarToSolar,
    solarToLunarDate,
    ZiHourMode,
} from '../core/lunar';
import { CustomAlert } from './CustomAlertProvider';
import { useTheme } from '../theme/ThemeContext';

export interface DateTimePickerTimeCorrectionNotice {
    /** 页面排盘时用的校时口径名称，例如「真太阳时」 */
    modeLabel: string;
    /** 是否提供「回填时改为本地钟表时」 */
    canSwitchToClockTime: boolean;
}

interface DateTimePickerProps {
    visible: boolean;
    initialDate: Date;
    yearRange?: { min: number; max: number };
    /** 四柱页的子时口径，默认与八字默认值一致（晚子时次日） */
    ziHourMode?: ZiHourMode;
    /** 回填后页面还会按经度校时时传入，四柱页会提醒反查结果已是排盘时间 */
    timeCorrectionNotice?: DateTimePickerTimeCorrectionNotice;
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
    /** 四柱反查回填时，用户选择改用本地钟表时排盘 */
    switchToClockTime?: boolean;
}

const TIAN_GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const DI_ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

const MONTH_CN = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];
const DAY_CN = [
    '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
    '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
    '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十',
];

// 与农历数据和四柱反查的范围一致（1900–2100）
const YEARS = Array.from({ length: 201 }, (_, i) => (1900 + i).toString());
const SOLAR_MONTHS = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));
const HOURS = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

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
    // 五行色走主题，深浅两套主题各自校过对比度
    if (['甲', '乙', '寅', '卯'].includes(char)) return Colors.bazi.elementWood;
    if (['丙', '丁', '巳', '午'].includes(char)) return Colors.bazi.elementFire;
    if (['戊', '己', '辰', '戌', '丑', '未'].includes(char)) return Colors.bazi.elementEarth;
    if (['庚', '辛', '申', '酉'].includes(char)) return Colors.bazi.elementMetal;
    if (['壬', '癸', '亥', '子'].includes(char)) return Colors.bazi.elementWater;
    return Colors.text.primary;
};

const getParityBranches = (gan: string) => {
    const isYang = TIAN_GAN.indexOf(gan) % 2 === 0;
    return DI_ZHI.filter((_, i) => i % 2 === (isYang ? 0 : 1));
};

interface PillarOption {
    pillar: string;
    /** 子时在早子时当日口径下的说明，例如「晚子 23 点」 */
    tag?: string;
    isLateZi?: boolean;
}

const getMonthPillarsForYear = (yGan: string): PillarOption[] => {
    const startGanIdx = [2, 4, 6, 8, 0][TIAN_GAN.indexOf(yGan) % 5];
    return Array.from({ length: 12 }, (_, i) => ({ pillar: TIAN_GAN[(startGanIdx + i) % 10] + DI_ZHI[(i + 2) % 12] }));
};

// 五鼠遁：甲己日起甲子，乙庚日起丙子，丙辛日起戊子，丁壬日起庚子，戊癸日起壬子
const getZiGanIndex = (dayGanIdx: number) => (dayGanIdx % 5) * 2;

const getHourPillarsForDay = (dGan: string, ziHourMode: ZiHourMode): PillarOption[] => {
    const dayGanIdx = TIAN_GAN.indexOf(dGan);
    const startGanIdx = getZiGanIndex(dayGanIdx);
    const options: PillarOption[] = Array.from({ length: 12 }, (_, i) => ({ pillar: TIAN_GAN[(startGanIdx + i) % 10] + DI_ZHI[i] }));
    if (ziHourMode === 'early_zi_same_day') {
        // 早子时当日：23 点的晚子时日柱仍是本日，时干按次日五鼠遁
        options[0] = { ...options[0], tag: '早子 0 点' };
        options.push({ pillar: TIAN_GAN[getZiGanIndex(dayGanIdx + 1)] + '子', tag: '晚子 23 点', isLateZi: true });
    }
    return options;
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

interface BaziResultDisplay {
    key: string;
    datetime: string;
    shichen: string;
    /** 交节切开这个时辰时的说明，例如「立春 16:27 后」 */
    termLabel: string;
    detail: string;
}

interface BaziResultRowProps {
    index: number;
    item: BaziResultDisplay;
    selected: boolean;
    onPress: (index: number) => void;
    styles: ReturnType<typeof makeStyles>;
}

const BaziResultRow = memo(function BaziResultRow({
    index,
    item,
    selected,
    onPress,
    styles,
}: BaziResultRowProps) {
    const handlePress = useCallback(() => {
        onPress(index);
    }, [index, onPress]);

    return (
        <PressableScale scaleTo={0.985}
            style={[styles.baziResultItem, selected && styles.baziResultItemSelected]}
            onPress={handlePress}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
        >
            <View style={[styles.baziRadio, selected && styles.baziRadioSelected]}>
                {selected ? <View style={styles.baziRadioDot} /> : null}
            </View>
            <View style={styles.baziResultBody}>
                <View style={styles.baziResultHeadline}>
                    <Text style={styles.baziResultText}>{item.datetime}</Text>
                    <Text style={styles.baziResultTag}>{item.shichen}</Text>
                    {item.termLabel ? <Text style={styles.baziResultTermTag}>{item.termLabel}</Text> : null}
                </View>
                <Text style={styles.baziResultDetail}>{item.detail}</Text>
            </View>
        </PressableScale>
    );
});

function createBaziDraftFromDate(date: Date, ziHourMode: ZiHourMode): BaziDraftState {
    const [yearGZ, monthGZ, dayGZ, hourGZ] = getBaziPillars(date, ziHourMode);

    return {
        step: null,
        yearGan: yearGZ[0],
        yearZhi: yearGZ[1],
        monthGan: monthGZ[0],
        monthZhi: monthGZ[1],
        dayGan: dayGZ[0],
        dayZhi: dayGZ[1],
        hourGan: hourGZ[0],
        hourZhi: hourGZ[1],
    };
}

function buildSelection(
    date: Date,
    sourceTab: DateTimePickerSelection['sourceTab'],
    switchToClockTime = false,
): DateTimePickerSelection {
    if (sourceTab === 'lunar') {
        const lunar = solarToLunarDate(date);
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
        ...(switchToClockTime ? { switchToClockTime: true } : {}),
    };
}

const pad2 = (value: number) => String(value).padStart(2, '0');
const formatHourMinute = (date: Date) => `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;

function describeBaziMatch(match: BaziReverseMatch): BaziResultDisplay {
    const { date } = match;
    // 有效区间按整分显示：起点向上取整，终点取最后一个有效的整分
    const from = new Date(match.validFrom.getTime());
    if (from.getSeconds() || from.getMilliseconds()) {
        from.setSeconds(0, 0);
        from.setMinutes(from.getMinutes() + 1);
    }
    const to = new Date(match.validUntil.getTime() - 1000);
    to.setSeconds(0, 0);
    const fromIsPreviousDay = from.getDate() !== date.getDate() || from.getMonth() !== date.getMonth();
    const term = match.solarTerm;

    return {
        key: String(date.getTime()),
        datetime: `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${formatHourMinute(date)}`,
        shichen: `${DI_ZHI[Math.floor((date.getHours() + 1) / 2) % 12]}时${match.isLateZi ? ' · 晚子' : ''}`,
        termLabel: term ? `${term.name} ${formatHourMinute(term.time)} ${term.side === 'after' ? '后' : '前'}` : '',
        detail: `农历 ${formatLunarDateLabel(solarToLunarDate(date))} · 有效 ${fromIsPreviousDay ? '前一日 ' : ''}${formatHourMinute(from)}–${formatHourMinute(to)}`,
    };
}

export default function DateTimePicker({
    visible,
    initialDate,
    yearRange,
    ziHourMode = 'late_zi_next_day',
    timeCorrectionNotice,
    onClose,
    onConfirm,
    onConfirmDetail,
}: DateTimePickerProps) {
    const { Colors, theme } = useTheme();
    const styles = useMemo(() => makeStyles(Colors, theme === 'yang'), [Colors, theme]);
    // 农历数据只覆盖 1900–2100，反查默认也限定在这段
    const searchStart = yearRange?.min ?? 1900;
    const searchEnd = yearRange?.max ?? 2099;
    const yearOptions = useMemo(() => yearRange ? Array.from({ length: yearRange.max - yearRange.min + 1 }, (_, i) => String(yearRange.min + i)) : YEARS, [yearRange]);
    const [activeTab, setActiveTab] = useState<'solar' | 'lunar' | 'bazi'>('solar');
    const [draftDate, setDraftDate] = useState(() => new Date(initialDate));
    const [fastInput, setFastInput] = useState('');
    const [baziDraft, setBaziDraft] = useState<BaziDraftState>(() => createBaziDraftFromDate(initialDate, ziHourMode));
    const [baziResults, setBaziResults] = useState<BaziReverseMatch[]>([]);
    const [selectedBaziIndex, setSelectedBaziIndex] = useState<number | null>(null);
    const [switchToClockTime, setSwitchToClockTime] = useState(true);

    const clearBaziResults = useCallback(() => {
        setBaziResults([]);
        setSelectedBaziIndex(null);
    }, []);

    useEffect(() => {
        if (visible) {
            const nextDate = new Date(initialDate);
            setDraftDate(nextDate);
            setFastInput('');
            setBaziDraft(createBaziDraftFromDate(nextDate, ziHourMode));
            clearBaziResults();
            setSwitchToClockTime(true);
        }
    }, [visible, initialDate, ziHourMode, clearBaziResults]);

    const applyDraftDate = useCallback((date: Date) => {
        const nextDate = new Date(date.getTime());
        nextDate.setSeconds(0, 0);
        setDraftDate(nextDate);
        clearBaziResults();
        setBaziDraft(createBaziDraftFromDate(nextDate, ziHourMode));
    }, [clearBaziResults, ziHourMode]);

    const handleConfirmSelection = useCallback((
        date: Date,
        sourceTab: DateTimePickerSelection['sourceTab'],
        switchToClock = false,
    ) => {
        const confirmedDate = new Date(date.getTime());
        if (yearRange && (confirmedDate.getFullYear() < yearRange.min || confirmedDate.getFullYear() > yearRange.max)) {
            CustomAlert.alert('时间超出范围', `请选择 ${yearRange.min}–${yearRange.max} 年内的公历时间。`);
            return;
        }
        onConfirm(confirmedDate);
        onConfirmDetail?.(buildSelection(confirmedDate, sourceTab, switchToClock));
    }, [onConfirm, onConfirmDetail, yearRange]);

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

    const lunarDate = useMemo(() => solarToLunarDate(draftDate), [draftDate]);
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
        clearBaziResults();
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
    }, [clearBaziResults]);

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

        const now = Date.now();
        // 离今天近的排在前面
        const nextResults = findBaziMatches(
            baziDraft.yearGan + baziDraft.yearZhi,
            baziDraft.monthGan + baziDraft.monthZhi,
            baziDraft.dayGan + baziDraft.dayZhi,
            baziDraft.hourGan + baziDraft.hourZhi,
            { startYear: searchStart, endYear: searchEnd, ziHourMode },
        ).sort((a, b) => Math.abs(a.date.getTime() - now) - Math.abs(b.date.getTime() - now));
        setBaziResults(nextResults);
        setSelectedBaziIndex(nextResults.length === 1 ? 0 : null);
        setBaziDraft((prev) => ({
            ...prev,
            step: null,
        }));
        if (nextResults.length === 0) {
            CustomAlert.alert('未找到', `在 ${searchStart}–${searchEnd} 年间没有找到对应的四柱时刻。`);
        }
    }, [baziDraft, searchStart, searchEnd, ziHourMode]);

    const selectedBaziMatch = selectedBaziIndex === null ? undefined : baziResults[selectedBaziIndex];
    // 有结果时必须先点选一条，不再默认取第一条
    const confirmDisabled = activeTab === 'bazi' && baziResults.length > 0 && !selectedBaziMatch;
    const canSwitchToClockTime = Boolean(timeCorrectionNotice?.canSwitchToClockTime);

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
            if (!selectedBaziMatch) {
                return;
            }
            applyDraftDate(selectedBaziMatch.date);
            handleConfirmSelection(selectedBaziMatch.date, 'bazi', canSwitchToClockTime && switchToClockTime);
            return;
        }

        runBaziSearch();
    }, [
        activeTab,
        applyDraftDate,
        baziResults.length,
        canSwitchToClockTime,
        draftDate,
        handleConfirmSelection,
        runBaziSearch,
        selectedBaziMatch,
        switchToClockTime,
    ]);

    const setGanAndAutoJump = useCallback((step: 'Y_GAN' | 'D_GAN', gan: string) => {
        clearBaziResults();
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
    }, [clearBaziResults]);

    const handleSetZhi = useCallback((step: 'Y_ZHI' | 'D_ZHI', zhi: string) => {
        clearBaziResults();
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
    }, [clearBaziResults]);

    const handleSetPillar = useCallback((step: 'M' | 'H', pillar: string) => {
        clearBaziResults();
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
    }, [clearBaziResults]);

    // 点选只是选中，按「确定」才回填
    const handleSelectBaziResult = useCallback((index: number) => {
        setSelectedBaziIndex(index);
    }, []);

    const baziResultItems = useMemo(() => baziResults.map(describeBaziMatch), [baziResults]);

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
                    <ScrollPicker data={yearOptions} value={solarYear} onValueChange={(value) => updateSolarDate({ year: parseInt(value, 10) })} Colors={Colors} />
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
                        <ScrollPicker data={yearOptions} value={lunarYear} onValueChange={(value) => updateLunarDate({ year: parseInt(value, 10) })} Colors={Colors} />
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
                                <PressableScale
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
                                </PressableScale>
                                <PressableScale
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
                                </PressableScale>
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
            <PressableScale onPress={onPress} style={[styles.bzCircle, active && styles.bzCircleActive, isPillarCombo && active && styles.bzCircleActiveCombo]}>
                <Text style={{ color: getColor(char, Colors), fontSize: FontSize.lg, fontWeight: 'bold' }}>{char}</Text>
            </PressableScale>
        );

        const isHourStep = baziDraft.step === 'H';
        const showEarlyZiOptions = isHourStep && ziHourMode === 'early_zi_same_day';
        let pillarOptions: PillarOption[] = [];
        if (baziDraft.step === 'M') {
            pillarOptions = getMonthPillarsForYear(baziDraft.yearGan);
        } else if (isHourStep) {
            pillarOptions = getHourPillarsForDay(baziDraft.dayGan, ziHourMode);
        }
        const modeLabel = timeCorrectionNotice?.modeLabel ?? '';

        return (
            <ScrollView
                style={styles.bzScroll}
                contentContainerStyle={styles.bzContainer}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                {/* 回填后还会校时的页面：提醒反查结果已是排盘时间 */}
                {timeCorrectionNotice ? (
                    <View style={styles.baziNotice}>
                        <View style={styles.baziNoticeRow}>
                            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={Colors.accent.gold} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={styles.baziNoticeIcon}>
                                <Circle cx="12" cy="12" r="9" />
                                <Path d="M12 8v5" />
                                <Path d="M12 16.5v.5" />
                            </Svg>
                            <Text style={styles.baziNoticeText}>
                                {canSwitchToClockTime
                                    ? `反查得到的就是排盘时间。当前按「${modeLabel}」排盘，回填后还会按出生地经度再校一次，时柱可能跟着变。`
                                    : `反查得到的就是排盘时间。这里固定按「${modeLabel}」排盘，出盘时还会按出生地经度再校一次，时辰可能跟着变。`}
                            </Text>
                        </View>
                        {canSwitchToClockTime ? (
                            <PressableScale scaleTo={0.985}
                                style={styles.baziNoticeCheckRow}
                                onPress={() => setSwitchToClockTime((prev) => !prev)}
                                accessibilityRole="checkbox"
                                accessibilityState={{ checked: switchToClockTime }}
                            >
                                <View style={[styles.baziCheckbox, switchToClockTime && styles.baziCheckboxChecked]}>
                                    {switchToClockTime ? (
                                        <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={Colors.text.inverse} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                            <Path d="M5 12l5 5L19 7" />
                                        </Svg>
                                    ) : null}
                                </View>
                                <Text style={styles.baziNoticeCheckText}>回填时改为「本地钟表时」</Text>
                            </PressableScale>
                        ) : null}
                    </View>
                ) : null}

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
                    <Text style={styles.baziSub}>查找范围：{searchStart}–{searchEnd}年</Text>
                    <PressableScale style={styles.baziClearBtn} onPress={clearBazi}>
                        <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={Colors.text.secondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <Path d="M3 6h18" />
                            <Path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                            <Path d="M10 11v6" />
                            <Path d="M14 11v6" />
                        </Svg>
                        <Text style={styles.baziClearText}>清除</Text>
                    </PressableScale>
                    <PressableScale style={styles.baziSearchBtn} onPress={runBaziSearch}>
                        <Text style={styles.baziSearchBtnText}>开始推算起时</Text>
                    </PressableScale>
                </View>

                {/* 候选底盘渲染 */}
                {baziDraft.step ? (
                    <View style={styles.bzGridContainer}>
                        {baziDraft.step === 'Y_GAN' || baziDraft.step === 'D_GAN' ? (
                            <View style={styles.bzGridRow}>
                                {TIAN_GAN.map((gan) => (
                                    <PressableScale key={gan} style={[styles.bzDataBtn, { width: '18%' }]} onPress={() => setGanAndAutoJump(baziDraft.step as 'Y_GAN' | 'D_GAN', gan)}>
                                        <Text style={{ color: getColor(gan, Colors), fontSize: FontSize.xl, fontWeight: 'bold' }}>{gan}</Text>
                                    </PressableScale>
                                ))}
                            </View>
                        ) : null}
    
                        {baziDraft.step === 'Y_ZHI' || baziDraft.step === 'D_ZHI' ? (
                            <View style={styles.bzGridRow}>
                                {getParityBranches(baziDraft.step === 'Y_ZHI' ? baziDraft.yearGan : baziDraft.dayGan).map((zhi) => (
                                    <PressableScale key={zhi} style={[styles.bzDataBtn, { width: '30%' }]} onPress={() => handleSetZhi(baziDraft.step as 'Y_ZHI' | 'D_ZHI', zhi)}>
                                        <Text style={{ color: getColor(zhi, Colors), fontSize: FontSize.xl, fontWeight: 'bold' }}>{zhi}</Text>
                                    </PressableScale>
                                ))}
                            </View>
                        ) : null}
    
                        {pillarOptions.length > 0 ? (
                            <View style={styles.bzGridSection}>
                                {showEarlyZiOptions ? (
                                    <Text style={styles.bzGridHint}>早子时当日：0 点的子时按本日起时干，23 点的晚子时按次日起时干，日柱仍是本日。</Text>
                                ) : null}
                                <View style={styles.bzGridRow}>
                                    {pillarOptions.map((option, index) => (
                                        <PressableScale
                                            key={`${option.pillar}-${index}`}
                                            style={[
                                                styles.bzDataBtn,
                                                styles.bzPillarBtn,
                                                showEarlyZiOptions && styles.bzPillarBtnTall,
                                                option.isLateZi && styles.bzLateZiBtn,
                                            ]}
                                            onPress={() => handleSetPillar(baziDraft.step as 'M' | 'H', option.pillar)}
                                        >
                                            <View style={styles.bzPillarChars}>
                                                <Text style={{ color: getColor(option.pillar[0], Colors), fontSize: FontSize.lg, fontWeight: 'bold' }}>{option.pillar[0]}</Text>
                                                <Text style={{ color: getColor(option.pillar[1], Colors), fontSize: FontSize.lg, fontWeight: 'bold' }}>{option.pillar[1]}</Text>
                                            </View>
                                            {option.tag ? (
                                                <Text style={[styles.bzPillarTag, option.isLateZi && styles.bzPillarTagLate]}>{option.tag}</Text>
                                            ) : null}
                                        </PressableScale>
                                    ))}
                                </View>
                            </View>
                        ) : null}
                    </View>
                ) : null}

                {/* 结果：点选一条再按「确定」回填 */}
                {baziResults.length > 0 ? (
                    <View style={styles.baziResults}>
                        <View style={styles.baziResultHeader}>
                            <Text style={styles.baziResultTitle}>找到 {baziResults.length} 个时刻</Text>
                            <Text style={styles.baziResultHint}>
                                {baziResults.length === 1 ? '只有一条，已选中' : '离今天近的在前 · 点选后按「确定」'}
                            </Text>
                        </View>
                        {baziResultItems.map((item, index) => (
                            <BaziResultRow
                                key={item.key}
                                index={index}
                                item={item}
                                selected={index === selectedBaziIndex}
                                onPress={handleSelectBaziResult}
                                styles={styles}
                            />
                        ))}
                    </View>
                ) : null}
            </ScrollView>
        );
    };

    return (
        <SheetModal visible={visible} onRequestClose={onClose}>
            <View style={styles.overlay}>
                <TouchableWithoutFeedback onPress={onClose}><View style={styles.closeArea} /></TouchableWithoutFeedback>
                <View style={styles.content}>
                    <View style={styles.header}>
                        <View style={styles.tabsPanel}>
                            <PressableScale style={[styles.tabBtn, activeTab === 'solar' && styles.tabBtnActive]} onPress={() => setActiveTab('solar')}>
                                <Text style={[styles.tabText, activeTab === 'solar' && styles.tabTextActive]}>公历</Text>
                            </PressableScale>
                            <PressableScale style={[styles.tabBtn, activeTab === 'lunar' && styles.tabBtnActive]} onPress={() => setActiveTab('lunar')}>
                                <Text style={[styles.tabText, activeTab === 'lunar' && styles.tabTextActive]}>农历</Text>
                            </PressableScale>
                            <PressableScale style={[styles.tabBtn, activeTab === 'bazi' && styles.tabBtnActive]} onPress={() => setActiveTab('bazi')}>
                                <Text style={[styles.tabText, activeTab === 'bazi' && styles.tabTextActive]}>四柱</Text>
                            </PressableScale>
                        </View>
                        <PressableScale
                            style={[styles.btnConfirm, confirmDisabled && styles.btnConfirmDisabled]}
                            onPress={handleConfirm}
                            disabled={confirmDisabled}
                            accessibilityState={{ disabled: confirmDisabled }}
                        >
                            <Text style={[styles.btnConfirmText, confirmDisabled && styles.btnConfirmTextDisabled]}>确定</Text>
                        </PressableScale>
                    </View>

                    {activeTab !== 'bazi' && (
                        <View style={styles.fastInputContainer}>
                            <FocusTextInput style={styles.fastInput} placeholder="出生年月(格式 199303270255)" placeholderTextColor={Colors.text.tertiary} keyboardType="numeric" value={fastInput} onChangeText={handleFastInput} />
                            <PressableScale style={styles.fastInputBtn} onPress={() => applyDraftDate(new Date())}>
                                <Text style={styles.fastInputBtnText}>当前时刻</Text>
                            </PressableScale>
                        </View>
                    )}

                    {activeTab !== 'bazi' && renderHeaders()}
                    {activeTab !== 'bazi' && renderPickers()}
                    {renderBaziPanel()}
                </View>
            </View>
        </SheetModal>
    );
}

// 浅色主题下金色小字在浅底上对比度不足 4.5:1，改用深金色
const goldTextColor = (Colors: any, isLightTheme: boolean) => (isLightTheme ? Colors.accent.goldDark : Colors.accent.gold);

const makeStyles = (Colors: any, isLightTheme = false) => StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'flex-end' },
    closeArea: { flex: 1 },
    content: {
        backgroundColor: Colors.bg.primary, borderTopLeftRadius: BorderRadius.xl,
        borderTopRightRadius: BorderRadius.xl, paddingBottom: Spacing.xxl,
        // 四柱页内容多时在面板内滚动，确定按钮始终留在屏内
        maxHeight: '94%',
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
    btnConfirmDisabled: { backgroundColor: Colors.bg.elevated },
    btnConfirmTextDisabled: { color: Colors.text.tertiary },
    fastInputContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.sm },
    fastInput: { flex: 1, backgroundColor: Colors.bg.elevated, borderWidth: 1, borderColor: Colors.border.input, borderRadius: BorderRadius.round, paddingHorizontal: Spacing.lg, paddingVertical: 10, fontSize: FontSize.sm, color: Colors.text.primary, fontVariant: ['tabular-nums'] },
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
        borderColor: Colors.accent.goldBorder,
        backgroundColor: Colors.accent.goldSoft,
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
    bzScroll: { flexShrink: 1 },
    bzContainer: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg },
    baziNotice: {
        marginTop: Spacing.md, padding: Spacing.md, gap: Spacing.sm,
        borderRadius: BorderRadius.md, backgroundColor: Colors.bg.card, borderWidth: 1, borderColor: Colors.border.subtle,
    },
    baziNoticeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
    baziNoticeIcon: { marginTop: 2 },
    baziNoticeText: { flex: 1, fontSize: FontSize.sm, lineHeight: 20, color: Colors.text.primary },
    baziNoticeCheckRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, minHeight: 36, paddingLeft: 24 },
    baziCheckbox: {
        width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: Colors.border.normal,
        alignItems: 'center', justifyContent: 'center',
    },
    baziCheckboxChecked: { backgroundColor: Colors.accent.gold, borderColor: Colors.accent.gold },
    baziNoticeCheckText: { fontSize: FontSize.sm, color: Colors.text.secondary },
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
    bzDataBtn: { minHeight: 50, backgroundColor: Colors.bg.elevated, borderRadius: BorderRadius.md, justifyContent: 'center', alignItems: 'center', borderWidth: 0.5, borderColor: Colors.border.subtle },
    bzGridSection: { gap: Spacing.sm },
    bzGridHint: { fontSize: 12, lineHeight: 18, color: Colors.text.secondary },
    bzPillarBtn: { width: '23%', gap: 2 },
    bzPillarBtnTall: { minHeight: 56 },
    bzPillarChars: { flexDirection: 'row', gap: 4 },
    bzPillarTag: { fontSize: FontSize.xs, color: Colors.text.secondary },
    bzPillarTagLate: { color: goldTextColor(Colors, isLightTheme) },
    bzLateZiBtn: { borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.accent.gold },
    baziResults: { marginTop: Spacing.md, padding: Spacing.md, gap: Spacing.sm, borderRadius: BorderRadius.md, backgroundColor: Colors.bg.elevated },
    baziResultHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: Spacing.sm },
    baziResultTitle: { color: Colors.text.primary, fontSize: 14, fontWeight: '600' },
    baziResultHint: { color: Colors.text.secondary, fontSize: 12 },
    baziResultItem: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: 10, paddingHorizontal: Spacing.md,
        borderRadius: BorderRadius.md, borderWidth: 1, borderColor: 'transparent',
    },
    baziResultItemSelected: { borderColor: Colors.accent.goldBorder, backgroundColor: Colors.accent.goldSoft },
    baziRadio: {
        width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: Colors.border.normal,
        alignItems: 'center', justifyContent: 'center',
    },
    baziRadioSelected: { borderColor: Colors.accent.gold },
    baziRadioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.accent.gold },
    baziResultBody: { flex: 1, minWidth: 0, gap: 4 },
    baziResultHeadline: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
    baziResultText: { color: goldTextColor(Colors, isLightTheme), fontSize: 16, fontWeight: 'bold', fontVariant: ['tabular-nums'] },
    baziResultTag: {
        fontSize: 12, color: Colors.text.secondary, backgroundColor: Colors.bg.card,
        paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, overflow: 'hidden',
    },
    baziResultTermTag: {
        fontSize: 12, color: goldTextColor(Colors, isLightTheme), backgroundColor: `${Colors.accent.gold}24`,
        paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, overflow: 'hidden',
    },
    baziResultDetail: { fontSize: 12, color: Colors.text.secondary, fontVariant: ['tabular-nums'] },
});
