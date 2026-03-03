import React, { useState, useEffect, useMemo } from 'react';
import {
    Modal, View, Text, StyleSheet, TouchableOpacity,
    TouchableWithoutFeedback, TextInput, Alert, ScrollView
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import ScrollPicker from './ScrollPicker';
import { Spacing, FontSize, BorderRadius } from '../theme/colors';
import { solarToLunar, lunarToSolar, findDatesByBazi } from '../core/lunar';
import { CustomAlert } from './CustomAlertProvider';
import { useTheme } from "../theme/ThemeContext";

interface DateTimePickerProps {
    visible: boolean;
    initialDate: Date;
    onClose: () => void;
    onConfirm: (date: Date) => void;
}

const TIAN_GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const DI_ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

const MONTH_CN = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];
const DAY_CN = [
    '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
    '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
    '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十',
];

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

export default function DateTimePicker({
    visible,
    initialDate,
    onClose,
    onConfirm,
}: DateTimePickerProps) {
    const { Colors } = useTheme();
    const styles = makeStyles(Colors);
    const [activeTab, setActiveTab] = useState<'solar' | 'lunar' | 'bazi'>('solar');

    // === 公历/农历 共享的时分状态 ===
    const [hour, setHour] = useState('00');
    const [minute, setMinute] = useState('00');

    // === 公历状态 ===
    const [solarYear, setSolarYear] = useState('1900');
    const [solarMonth, setSolarMonth] = useState('01');
    const [solarDay, setSolarDay] = useState('01');

    // === 农历状态 ===
    const [lunarYear, setLunarYear] = useState('1900');
    const [lunarMonth, setLunarMonth] = useState('正');
    const [lunarDay, setLunarDay] = useState('初一');

    // === 四柱状态 ===
    const [bzStep, setBzStep] = useState<BaziStep>('Y_GAN');
    const [bzYGan, setBzYGan] = useState('甲');
    const [bzYZhi, setBzYZhi] = useState('子');
    const [bzMGan, setBzMGan] = useState('丙');
    const [bzMZhi, setBzMZhi] = useState('寅');
    const [bzDGan, setBzDGan] = useState('甲');
    const [bzDZhi, setBzDZhi] = useState('子');
    const [bzHGan, setBzHGan] = useState('甲');
    const [bzHZhi, setBzHZhi] = useState('子');

    const [fastInput, setFastInput] = useState('');
    const [baziResults, setBaziResults] = useState<Date[]>([]);

    useEffect(() => {
        if (visible) {
            syncFromDate(initialDate);
            setFastInput('');
        }
    }, [visible, initialDate]);

    const syncFromDate = (date: Date) => {
        setSolarYear(date.getFullYear().toString());
        setSolarMonth((date.getMonth() + 1).toString().padStart(2, '0'));
        setSolarDay(date.getDate().toString().padStart(2, '0'));
        setHour(date.getHours().toString().padStart(2, '0'));
        setMinute(date.getMinutes().toString().padStart(2, '0'));

        const lunar = solarToLunar(date);
        setLunarYear(lunar.year.toString());
        setLunarMonth(MONTH_CN[lunar.month - 1]);
        setLunarDay(DAY_CN[lunar.day - 1]);

        setBzYGan(lunar.yearGanZhi[0]); setBzYZhi(lunar.yearGanZhi[1]);
        setBzMGan(lunar.monthGanZhi[0]); setBzMZhi(lunar.monthGanZhi[1]);
        setBzDGan(lunar.dayGanZhi[0]); setBzDZhi(lunar.dayGanZhi[1]);
        setBzHGan(lunar.hourGanZhi[0]); setBzHZhi(lunar.hourGanZhi[1]);
        setBaziResults([]);
        setBzStep(null);
    };

    const clearBazi = () => {
        setBaziResults([]);
        setBzStep('Y_GAN');
        setBzYGan(''); setBzYZhi('');
        setBzMGan(''); setBzMZhi('');
        setBzDGan(''); setBzDZhi('');
        setBzHGan(''); setBzHZhi('');
    };

    const yearsNum = Array.from({ length: 150 }, (_, i) => (1900 + i).toString());
    const solarMonthsNum = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));
    const solarDaysNum = useMemo(() => {
        const y = parseInt(solarYear, 10);
        const m = parseInt(solarMonth, 10);
        const maxDays = getDaysInMonth(y, m);
        return Array.from({ length: maxDays }, (_, i) => (i + 1).toString().padStart(2, '0'));
    }, [solarYear, solarMonth]);
    const hoursNum = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
    const minutesNum = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

    useEffect(() => {
        const day = parseInt(solarDay, 10);
        if (!Number.isInteger(day)) {
            setSolarDay('01');
            return;
        }
        const maxDays = solarDaysNum.length;
        if (day > maxDays) {
            setSolarDay(String(maxDays).padStart(2, '0'));
        } else if (day < 1) {
            setSolarDay('01');
        }
    }, [solarDay, solarDaysNum]);

    const handleFastInput = (val: string) => {
        setFastInput(val);
        const pureNumbers = val.replace(/\D/g, '');
        if (pureNumbers.length >= 8) {
            const y = parseInt(pureNumbers.substring(0, 4));
            const m = parseInt(pureNumbers.substring(4, 6));
            const d = parseInt(pureNumbers.substring(6, 8));
            const h = pureNumbers.length >= 10 ? parseInt(pureNumbers.substring(8, 10)) : 0;
            const min = pureNumbers.length >= 12 ? parseInt(pureNumbers.substring(10, 12)) : 0;

            if (isValidSolarDate(y, m, d, h, min)) {
                syncFromDate(new Date(y, m - 1, d, h, min));
            }
        }
    };

    const handleConfirm = () => {
        if (activeTab === 'solar') {
            const y = parseInt(solarYear, 10);
            const m = parseInt(solarMonth, 10);
            const d = parseInt(solarDay, 10);
            const h = parseInt(hour, 10);
            const min = parseInt(minute, 10);
            if (!isValidSolarDate(y, m, d, h, min)) {
                CustomAlert.alert("错误", "该公历日期无效，请重新选择");
                return;
            }
            onConfirm(new Date(y, m - 1, d, h, min));
        } else if (activeTab === 'lunar') {
            const mIdx = MONTH_CN.indexOf(lunarMonth) + 1;
            const dIdx = DAY_CN.indexOf(lunarDay) + 1;
            const d = lunarToSolar(parseInt(lunarYear), mIdx, dIdx, false);
            if (d) {
                d.setHours(parseInt(hour), parseInt(minute), 0, 0);
                onConfirm(d);
            } else {
                CustomAlert.alert("错误", "该农历日期无效");
            }
        } else if (activeTab === 'bazi') {
            if (baziResults.length > 0) {
                onConfirm(baziResults[0]);
            } else {
                searchBazi();
            }
        }
    };

    const searchBazi = () => {
        if (!bzYGan || !bzYZhi || !bzMGan || !bzMZhi || !bzDGan || !bzDZhi || !bzHGan || !bzHZhi) {
            CustomAlert.alert("提示", "请完整填选四柱所有的八个字！");
            return;
        }
        const results = findDatesByBazi(bzYGan + bzYZhi, bzMGan + bzMZhi, bzDGan + bzDZhi, bzHGan + bzHZhi, 1801, 2099);
        setBaziResults(results);
        setBzStep(null);
        if (results.length === 0) {
            CustomAlert.alert("未找到", "在 1801-2099 年间没有找到这套四柱搭配的准确时间！");
        }
    };

    const setGanAndAutoJump = (step: 'Y_GAN' | 'D_GAN', gan: string) => {
        if (step === 'Y_GAN') {
            setBzYGan(gan);
            setBzYZhi('');
            setBzMGan(''); setBzMZhi('');
            setBzStep('Y_ZHI');
        } else {
            setBzDGan(gan);
            setBzDZhi('');
            setBzHGan(''); setBzHZhi('');
            setBzStep('D_ZHI');
        }
    };

    const handleSetZhi = (step: 'Y_ZHI' | 'D_ZHI', zhi: string) => {
        if (step === 'Y_ZHI') {
            setBzYZhi(zhi);
            setBzStep('M');
        } else {
            setBzDZhi(zhi);
            setBzStep('H');
        }
    };

    const handleSetPillar = (step: 'M' | 'H', p: string) => {
        if (step === 'M') {
            setBzMGan(p[0]); setBzMZhi(p[1]);
            setBzStep('D_GAN');
        } else {
            setBzHGan(p[0]); setBzHZhi(p[1]);
            setBzStep(null);
        }
    };

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
                    <ScrollPicker data={yearsNum} value={solarYear} onValueChange={setSolarYear} Colors={Colors} />
                    <ScrollPicker data={solarMonthsNum} value={solarMonth} onValueChange={setSolarMonth} Colors={Colors} />
                    <ScrollPicker data={solarDaysNum} value={solarDay} onValueChange={setSolarDay} Colors={Colors} />
                    <ScrollPicker data={hoursNum} value={hour} onValueChange={setHour} Colors={Colors} />
                    <ScrollPicker data={minutesNum} value={minute} onValueChange={setMinute} Colors={Colors} />
                </View>
            );
        }
        if (activeTab === 'lunar') {
            return (
                <View style={styles.pickerContainer}>
                    <ScrollPicker data={yearsNum} value={lunarYear} onValueChange={setLunarYear} Colors={Colors} />
                    <ScrollPicker data={MONTH_CN} value={lunarMonth} onValueChange={setLunarMonth} Colors={Colors} />
                    <ScrollPicker data={DAY_CN} value={lunarDay} onValueChange={setLunarDay} Colors={Colors} />
                    <ScrollPicker data={hoursNum} value={hour} onValueChange={setHour} Colors={Colors} />
                    <ScrollPicker data={minutesNum} value={minute} onValueChange={setMinute} Colors={Colors} />
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
                        {renderCircle(bzYGan, bzStep === 'Y_GAN', () => setBzStep('Y_GAN'))}
                        {renderCircle(bzYZhi, bzStep === 'Y_ZHI', () => !bzYGan ? setBzStep('Y_GAN') : setBzStep('Y_ZHI'))}
                    </View>
                    <View style={styles.bzCol}>
                        <Text style={styles.bzColTitle}>月柱</Text>
                        {renderCircle(bzMGan, bzStep === 'M', () => !bzYGan ? setBzStep('Y_GAN') : setBzStep('M'), true)}
                        {renderCircle(bzMZhi, bzStep === 'M', () => !bzYGan ? setBzStep('Y_GAN') : setBzStep('M'), true)}
                    </View>
                    <View style={styles.bzCol}>
                        <Text style={styles.bzColTitle}>日柱</Text>
                        {renderCircle(bzDGan, bzStep === 'D_GAN', () => setBzStep('D_GAN'))}
                        {renderCircle(bzDZhi, bzStep === 'D_ZHI', () => !bzDGan ? setBzStep('D_GAN') : setBzStep('D_ZHI'))}
                    </View>
                    <View style={styles.bzCol}>
                        <Text style={styles.bzColTitle}>时柱</Text>
                        {renderCircle(bzHGan, bzStep === 'H', () => !bzDGan ? setBzStep('D_GAN') : setBzStep('H'), true)}
                        {renderCircle(bzHZhi, bzStep === 'H', () => !bzDGan ? setBzStep('D_GAN') : setBzStep('H'), true)}
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
                    <TouchableOpacity style={styles.baziSearchBtn} onPress={searchBazi}>
                        <Text style={styles.baziSearchBtnText}>开始推算起时</Text>
                    </TouchableOpacity>
                </View>

                {/* 候选底盘渲染 */}
                <View style={styles.bzGridContainer}>
                    {bzStep === 'Y_GAN' || bzStep === 'D_GAN' ? (
                        <View style={styles.bzGridRow}>
                            {TIAN_GAN.map(g => (
                                <TouchableOpacity key={g} style={[styles.bzDataBtn, { width: '18%' }]} onPress={() => setGanAndAutoJump(bzStep, g)}>
                                    <Text style={{ color: getColor(g, Colors), fontSize: FontSize.xl, fontWeight: 'bold' }}>{g}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    ) : null}

                    {bzStep === 'Y_ZHI' || bzStep === 'D_ZHI' ? (
                        <View style={styles.bzGridRow}>
                            {getParityBranches(bzStep === 'Y_ZHI' ? bzYGan : bzDGan).map(z => (
                                <TouchableOpacity key={z} style={[styles.bzDataBtn, { width: '30%' }]} onPress={() => handleSetZhi(bzStep as 'Y_ZHI' | 'D_ZHI', z)}>
                                    <Text style={{ color: getColor(z, Colors), fontSize: FontSize.xl, fontWeight: 'bold' }}>{z}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    ) : null}

                    {bzStep === 'M' || bzStep === 'H' ? (
                        <View style={styles.bzGridRow}>
                            {(bzStep === 'M' ? getMonthPillarsForYear(bzYGan) : getHourPillarsForDay(bzDGan)).map(p => (
                                <TouchableOpacity key={p} style={[styles.bzDataBtn, { width: '23%', flexDirection: 'row', gap: 4 }]} onPress={() => handleSetPillar(bzStep as 'M' | 'H', p)}>
                                    <Text style={{ color: getColor(p[0], Colors), fontSize: FontSize.lg, fontWeight: 'bold' }}>{p[0]}</Text>
                                    <Text style={{ color: getColor(p[1], Colors), fontSize: FontSize.lg, fontWeight: 'bold' }}>{p[1]}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    ) : null}
                </View>

                {/* 结果显示 */}
                {baziResults.length > 0 && (
                    <ScrollView style={styles.baziResults}>
                        <Text style={styles.baziResultTitle}>满足该干支流转的时刻 (点击即可选中):</Text>
                        {baziResults.map((date, idx) => (
                            <TouchableOpacity key={idx} style={styles.baziResultItem} onPress={() => onConfirm(date)}>
                                <Text style={styles.baziResultText}>
                                    {date.getFullYear()}-{String(date.getMonth() + 1).padStart(2, '0')}-{String(date.getDate()).padStart(2, '0')} {String(date.getHours()).padStart(2, '0')}:00
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                )}
            </View>
        );
    }

    return (
        <Modal visible={visible} transparent={true} animationType="slide" onRequestClose={onClose}>
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
                            <TouchableOpacity style={styles.fastInputBtn} onPress={() => syncFromDate(new Date())}>
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
    baziResultTitle: { color: Colors.text.secondary, fontSize: FontSize.sm, marginBottom: Spacing.sm },
    baziResultItem: { paddingVertical: Spacing.sm, borderBottomWidth: 0.5, borderBottomColor: Colors.border.subtle },
    baziResultText: { color: Colors.accent.gold, fontSize: FontSize.md, textAlign: 'center', fontWeight: 'bold' }
});
