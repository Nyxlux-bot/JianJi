import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Polyline, Text as SvgText } from 'react-native-svg';
import { SolarDay } from 'tyme4ts';
import { router, useLocalSearchParams } from 'expo-router';
import StatusBarDecor from '../../src/components/StatusBarDecor';
import { BackIcon, ChevronRightIcon, LocationIcon } from '../../src/components/Icons';
import { CustomAlert } from '../../src/components/CustomAlertProvider';
import DateTimePicker from '../../src/components/DateTimePicker';
import CityPicker from '../../src/components/CityPicker';
import LiuyaoSubjectSelector from '../../src/components/LiuyaoSubjectSelector';
import { useLocation } from '../../src/hooks/useLocation';
import { useTheme } from '../../src/theme/ThemeContext';
import { buildResultPalette, type ResultPalette } from '../../src/theme/result-palette';
import { buildRegionDisplayName } from '../../src/core/city-data';
import type { LiuyaoSubject } from '../../src/core/liuyao-data';
import { getRecord, saveRecord } from '../../src/db/database';
import { castQimen, shiftQimenResultByHours } from '../../src/features/qimen/engine';
import { QIMEN_LAYOUT } from '../../src/features/qimen/data';
import {
    FORM_DESCRIPTIONS,
    JU_METHOD_DESCRIPTIONS,
    JU_METHOD_LABELS,
    SPIRIT_STYLE_LABELS,
} from '../../src/features/qimen/period-board';
import {
    QIMEN_FORMS, QIMEN_YEAR_RANGE,
    QIMEN_JU_METHODS,
    QIMEN_SPIRIT_STYLES,
    type QimenForm, type QimenResult,
    type QimenJuMethod,
    type QimenSpiritStyle,
} from '../../src/features/qimen/types';

function PalacePath({ fly, palette }: { fly: boolean; palette: ResultPalette }) {
    return <Svg width={104} height={80} viewBox="0 0 90 78" aria-hidden>
        <Path d="M1 1H89V77H1ZM30 1V77M60 1V77M1 26H89M1 52H89" stroke={palette.rule} fill="none" />
        <Polyline points={fly ? '45,65 75,13 15,39' : '45,65 15,65 15,39'} fill="none" stroke={palette.gold} strokeWidth={2} />
        {QIMEN_LAYOUT.map((n, i) => <SvgText key={n} x={15 + i % 3 * 30} y={17 + Math.floor(i / 3) * 26} textAnchor="middle" fontSize={11} fill={palette.ink} stroke={palette.card} strokeWidth={0.3}>{n}</SvgText>)}
    </Svg>;
}

function beijingNow(): Date {
    const date = new Date(Date.now() + 8 * 60 * 60 * 1000);
    // 现有滚轮使用设备本地字段；这里把北京时间作为墙上时间交给它。
    return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes());
}

function formatDate(date: Date): string {
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

interface FormDraft {
    form: QimenForm;
    juMethod: QimenJuMethod;
    spiritStyle: QimenSpiritStyle;
}

export default function QimenInputPage() {
    const { sourceId, offset } = useLocalSearchParams<{ sourceId?: string; offset?: string }>();
    const [loaded, setLoaded] = useState<{ key: string; source?: QimenResult; error?: string }>();
    const key = JSON.stringify([sourceId, offset]);
    const { Colors } = useTheme();
    useEffect(() => {
        if (!sourceId) return;
        let active = true;
        void getRecord(sourceId).then(record => {
            if (!active) return;
            if (record?.engineType !== 'qimen') throw new Error('来源盘不存在');
            const hours = Number(offset ?? 0) * 2;
            if (!Number.isSafeInteger(hours) || Math.abs(hours) > 24 * 366 * 201) throw new Error('时辰偏移无效');
            const source = hours ? shiftQimenResultByHours(record.result, hours) : record.result;
            if (!source) throw new Error('时间超出排盘范围');
            setLoaded({ key, source });
        }).catch((e: unknown) => { if (active) setLoaded({ key, error: e instanceof Error ? e.message : '来源盘读取失败' }); });
        return () => { active = false; };
    }, [key, sourceId, offset]);
    if (sourceId && (loaded?.key !== key || !loaded.source)) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <Text style={{ color: Colors.text.primary }}>{loaded?.key === key ? loaded.error : '读取来源盘…'}</Text>
        <Pressable accessibilityRole="button" onPress={() => router.back()}><Text style={{ color: Colors.accent.gold }}>返回</Text></Pressable>
    </View>;
    return <QimenCastForm key={key} source={sourceId ? loaded?.source : undefined} />;
}

function QimenCastForm({ source }: { source?: QimenResult }) {
    const { Colors } = useTheme();
    const palette = useMemo(() => buildResultPalette(Colors), [Colors]);
    const styles = useMemo(() => makeStyles(palette), [palette]);
    const place = useLocation();
    const [originalPlace, setOriginalPlace] = useState(!!source);
    const location = originalPlace ? source?.location ?? '' : place.location ? buildRegionDisplayName(place.location) : '';
    const longitude = originalPlace ? source?.longitude : place.location?.longitude;
    const insets = useSafeAreaInsets();
    const [date, setDate] = useState(() => source ? new Date(source.inputDateTime) : beijingNow());
    const [pickerVisible, setPickerVisible] = useState(false);
    const [castMode, setCastMode] = useState<'time' | 'number'>(source?.numberSeed ? 'number' : 'time');
    const [numberInput, setNumberInput] = useState(source?.numberSeed?.toString() ?? '');
    const [subject, setSubject] = useState<LiuyaoSubject | null>(source?.subject ?? null);
    const [question, setQuestion] = useState(source?.question ?? '');
    const [recentEvents, setRecentEvents] = useState(source?.recentEvents ?? '');
    const [timeRange, setTimeRange] = useState(source?.timeRange ?? '');
    const [backgroundOpen, setBackgroundOpen] = useState(false);
    const [form, setForm] = useState<QimenForm>(source?.form ?? '转盘');
    const [juMethod, setJuMethod] = useState<QimenJuMethod>(source?.juMethod ?? 'chaibu');
    const [spiritStyle, setSpiritStyle] = useState<QimenSpiritStyle>(source?.spiritStyle ?? 'gouchen');
    const [draft, setDraft] = useState<FormDraft | null>(null);
    const lunar = useMemo(() => SolarDay.fromYmd(date.getFullYear(), date.getMonth() + 1, date.getDate()).getLunarDay().toString(), [date]);
    const footerStyle = [styles.footer, { paddingBottom: Math.max(12, insets.bottom) }];
    const [saving, setSaving] = useState(false);
    const savingRef = useRef(false);

    const parsedSeed = useMemo(() => {
        if (castMode !== 'number') return undefined;
        const trimmed = numberInput.trim();
        if (!trimmed) return undefined;
        const value = Number(trimmed);
        return Number.isInteger(value) && value >= 1 && value <= 9999 ? value : null;
    }, [castMode, numberInput]);

    const coverSummary = form === '转盘'
        ? `${JU_METHOD_LABELS[juMethod]} · ${SPIRIT_STYLE_LABELS[spiritStyle]}`
        : FORM_DESCRIPTIONS[form];

    const handleCast = async () => {
        if (savingRef.current) return;
        if (castMode === 'number' && (parsedSeed === undefined || parsedSeed === null)) {
            CustomAlert.alert('请输入有效数字', '报数起局请输入 1–9999 的正整数。');
            return;
        }
        savingRef.current = true;
        setSaving(true);
        try {
            const result = castQimen({
                form,
                juMethod: form === '转盘' ? juMethod : 'chaibu',
                spiritStyle: form === '转盘' ? spiritStyle : 'gouchen',
                numberSeed: castMode === 'number' ? parsedSeed ?? undefined : undefined,
                dateTime: formatDate(date),
                question,
                subject: subject ?? undefined,
                recentEvents,
                timeRange,
                location, longitude,
            });
            await saveRecord({ engineType: 'qimen', result: source ? { ...result, sourceId: source.id } : result });
            router.push(`/qimen/result/${result.id}`);
        } catch (error) {
            CustomAlert.alert('起盘失败', error instanceof Error ? error.message : '请稍后重试');
        } finally {
            savingRef.current = false;
            setSaving(false);
        }
    };

    return (
        <View style={styles.container}>
            <StatusBarDecor />
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.headerButton} accessibilityRole="button" accessibilityLabel="返回">
                    <BackIcon size={22} color={palette.ink} />
                </Pressable>
                <Text style={styles.title}>奇门遁甲</Text>
                <View style={styles.headerButton} />
            </View>
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <Pressable accessibilityRole="button" accessibilityLabel={`排盘设置，当前${form}`} onPress={() => setDraft({ form, juMethod, spiritStyle })} style={styles.cover}>
                    <View style={styles.grow}>
                        <Text style={styles.muted}><Text style={{ color: palette.vermilion }}>◆ </Text> 排盘设置</Text>
                        <Text style={styles.coverTitle}>{form}</Text>
                        <Text style={styles.muted}>{coverSummary}</Text>
                    </View>
                    <Image source={require('../../assets/home/ink-brush-v6/qimen.webp')} accessible={false} resizeMode="contain" style={styles.art} />
                    <ChevronRightIcon size={16} color={palette.muted} />
                </Pressable>

                <View style={styles.modeTabs} accessibilityRole="tablist">
                    {([['time', '时间起局'], ['number', '报数起局']] as const).map(([key, label]) => {
                        const active = castMode === key;
                        return <Pressable key={key} onPress={() => setCastMode(key)} style={[styles.modeTab, active && styles.modeTabActive]}
                            accessibilityRole="tab" aria-selected={active}>
                            <Text style={[styles.modeTabText, active && styles.modeTabTextActive]}>{label}</Text>
                        </Pressable>;
                    })}
                </View>

                {castMode === 'number' ? (
                    <View style={styles.numberBox}>
                        <View style={styles.numberHeader}>
                            <Text style={styles.label}>所报数字（1–9999）</Text>
                            <Pressable onPress={() => setNumberInput(String(Math.floor(Math.random() * 999) + 1))} style={styles.textButton} accessibilityRole="button">
                                <Text style={styles.link}>随机取数</Text>
                            </Pressable>
                        </View>
                        <TextInput
                            value={numberInput}
                            onChangeText={value => setNumberInput(value.replace(/[^\d]/g, '').slice(0, 4))}
                            keyboardType="number-pad"
                            placeholder="心念所问之事，随意输入 1–9999 的整数"
                            placeholderTextColor={palette.muted}
                            style={styles.field}
                            accessibilityLabel="报数起局数字"
                        />
                        <Text style={styles.numberHint}>
                            {parsedSeed ? `余数定局：第 ${((parsedSeed - 1) % 9) + 1} 局（阴阳遁与四柱仍依下方时刻）` : '按数字对 9 取余定局，阴阳遁与四柱依下方北京时间。'}
                        </Text>
                    </View>
                ) : null}

                <View style={styles.labelRow}>
                    <Text style={styles.label}>起盘时间</Text>
                    <Pressable onPress={() => setDate(beijingNow())} style={styles.textButton} accessibilityRole="button" accessibilityLabel="使用当前北京时间">
                        <Text style={styles.link}>当前时刻</Text>
                    </Pressable>
                </View>
                <View style={styles.clockCard}>
                    <Pressable onPress={() => setPickerVisible(true)} style={styles.clockRow} accessibilityRole="button" accessibilityLabel="选择起盘时间">
                        <View style={styles.grow}><Text style={styles.fieldText}>{date.getFullYear()}年{date.getMonth() + 1}月{date.getDate()}日</Text><Text style={styles.muted}>{lunar} · 北京时间</Text></View>
                        <Text style={styles.fieldText}>{formatDate(date).slice(11, 16)}</Text>
                        <ChevronRightIcon size={18} color={palette.muted} />
                    </Pressable>
                    <Pressable onPress={place.openPicker} style={styles.placeRow} accessibilityRole="button"><LocationIcon size={16} color={palette.gold} /><Text style={[styles.muted, styles.grow]}>{location || '选择地点（选填）'}</Text><ChevronRightIcon size={16} color={palette.muted} /></Pressable>
                </View>
                <Text style={styles.label}>占问事项（选填）</Text>
                <TextInput value={question} onChangeText={setQuestion} maxLength={300} multiline placeholder="一局问一事，把具体问题写在这里" placeholderTextColor={palette.muted} style={[styles.field, styles.multiline]} accessibilityLabel="占问事项" />
                <Text style={styles.label}>关注期限（选填）</Text>
                <TextInput value={timeRange} onChangeText={setTimeRange} maxLength={80} placeholder="关注的时间范围，如未来一个月" placeholderTextColor={palette.muted} style={[styles.field, styles.range]} accessibilityLabel="关注时间范围" />
                <Pressable onPress={() => setBackgroundOpen(!backgroundOpen)} style={styles.disclosure} accessibilityRole="button" accessibilityState={{ expanded: backgroundOpen }}>
                    <Text style={styles.label}>补充占问背景</Text><Text style={styles.muted}>选填 {backgroundOpen ? '⌃' : '⌄'}</Text>
                </Pressable>
                {backgroundOpen ? <>
                    <TextInput value={recentEvents} onChangeText={setRecentEvents} maxLength={600} multiline placeholder="近期事件、相关人物与已经发生的情况" placeholderTextColor={palette.muted} style={[styles.field, styles.multiline]} accessibilityLabel="近期事件" />
                    <LiuyaoSubjectSelector value={subject} onChange={setSubject} style={styles.subject} labelStyle={styles.label} />
                </> : null}
            </ScrollView>
            <View style={footerStyle}>
                <Pressable onPress={handleCast} disabled={saving} style={({ pressed }) => [styles.castButton, { backgroundColor: palette.gold, opacity: saving || pressed ? 0.65 : 1 }]} accessibilityRole="button" accessibilityLabel="起盘">
                    <Text style={[styles.castText, { color: Colors.text.inverse }]}>{saving ? '起盘中…' : '开始排盘'}</Text>
                </Pressable>
            </View>
            {draft !== null && <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setDraft(null)}>
                <View style={[styles.container, { backgroundColor: palette.page }]}>
                    <StatusBarDecor />
                    <View style={styles.header}><Pressable style={styles.headerButton} accessibilityRole="button" accessibilityLabel="返回起盘" onPress={() => setDraft(null)}><BackIcon size={22} color={palette.ink} /></Pressable><Text style={styles.title}>排盘设置</Text><View style={styles.headerButton} /></View>
                    <ScrollView contentContainerStyle={styles.content}>
                        <Text style={styles.label}>盘式</Text>
                        <View accessibilityRole="radiogroup" style={styles.options}>{QIMEN_FORMS.map(option => {
                            const on = option === draft.form;
                            return <Pressable key={option} accessibilityRole="radio" aria-checked={on} onPress={() => setDraft(d => d ? { ...d, form: option } : d)} style={[styles.mode, on && styles.activeMode]}>
                                <View style={styles.grow}><Text style={[styles.modeName, on && { color: palette.gold }]}>{option}</Text><Text style={styles.muted}>{FORM_DESCRIPTIONS[option]}</Text></View>
                                <View style={[styles.radio, on && { borderColor: palette.gold }]}>{on && <View style={styles.dot} />}</View>
                            </Pressable>;
                        })}</View>

                        {draft.form === '转盘' ? <>
                            <Text style={[styles.label, styles.sectionGap]}>时家定局法</Text>
                            <View accessibilityRole="radiogroup" style={styles.pillRow}>
                                {QIMEN_JU_METHODS.map(option => {
                                    const on = option === draft.juMethod;
                                    return <Pressable key={option} accessibilityRole="radio" aria-checked={on}
                                        onPress={() => setDraft(d => d ? { ...d, juMethod: option } : d)}
                                        style={[styles.pillOption, on && styles.activeMode]}>
                                        <Text style={[styles.pillText, on && { color: palette.gold, fontWeight: '600' }]}>{JU_METHOD_LABELS[option]}</Text>
                                    </Pressable>;
                                })}
                            </View>
                            <Text style={styles.optionHint}>{JU_METHOD_DESCRIPTIONS[draft.juMethod]}</Text>

                            <Text style={[styles.label, styles.sectionGap]}>八神名称</Text>
                            <View accessibilityRole="radiogroup" style={styles.pillRow}>
                                {QIMEN_SPIRIT_STYLES.map(option => {
                                    const on = option === draft.spiritStyle;
                                    return <Pressable key={option} accessibilityRole="radio" aria-checked={on}
                                        onPress={() => setDraft(d => d ? { ...d, spiritStyle: option } : d)}
                                        style={[styles.pillOption, on && styles.activeMode]}>
                                        <Text style={[styles.pillText, on && { color: palette.gold, fontWeight: '600' }]}>{SPIRIT_STYLE_LABELS[option]}</Text>
                                    </Pressable>;
                                })}
                            </View>
                        </> : null}

                        <View style={styles.labelRow}><Text style={styles.label}>走宫示意</Text><Text style={styles.muted}>以坎一顺行为例</Text></View>
                        <View style={styles.figures}>{['九星', '八门'].map((name, i) => {
                            const fly = draft.form === '飞盘' || (i === 0 && draft.form === '星飞门转');
                            return <View key={name} style={styles.figure}><PalacePath fly={fly} palette={palette} /><Text style={styles.muted}>{name} · {fly ? '飞布' : '转排'}</Text></View>;
                        })}</View>
                    </ScrollView>
                    <View style={footerStyle}><Pressable accessibilityRole="button" onPress={() => { setForm(draft.form); setJuMethod(draft.juMethod); setSpiritStyle(draft.spiritStyle); setDraft(null); }} style={[styles.castButton, { backgroundColor: palette.gold }]}><Text style={[styles.castText, { color: Colors.text.inverse }]}>完成</Text></Pressable></View>
                </View>
            </Modal>}
            <DateTimePicker yearRange={QIMEN_YEAR_RANGE} visible={pickerVisible} initialDate={date} onClose={() => setPickerVisible(false)} onConfirm={(value) => { setDate(value); setPickerVisible(false); }} />
            <CityPicker visible={place.pickerVisible} selectedRegion={originalPlace ? null : place.location} onClose={place.closePicker} onSelect={region => { setOriginalPlace(false); return place.handleSelectLocation(region); }} />
        </View>
    );
}

function makeStyles(palette: ResultPalette) {
    return StyleSheet.create({
        container: { flex: 1 },
        header: { height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
        headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
        title: { fontSize: 17, fontWeight: '700', color: palette.heading },
        content: { paddingHorizontal: 20, paddingVertical: 16 },
        grow: { flex: 1 },
        cover: { minHeight: 110, paddingHorizontal: 16, gap: 6, flexDirection: 'row', alignItems: 'center', backgroundColor: palette.isLight ? '#eee6d7' : '#252823', borderRadius: 13, borderWidth: 1, borderColor: palette.cardBorder },
        coverTitle: { fontSize: 23, fontWeight: '700', color: palette.heading, marginVertical: 4 },
        art: { width: 84, height: 90, tintColor: palette.isLight ? '#3c2f25' : '#e8d4ab' },
        modeTabs: { flexDirection: 'row', gap: 8, marginTop: 14, marginBottom: 4 },
        modeTab: { flex: 1, minHeight: 40, borderRadius: 10, borderWidth: 1, borderColor: palette.cardBorder, backgroundColor: palette.card, alignItems: 'center', justifyContent: 'center' },
        modeTabActive: { borderColor: palette.goldBorder, backgroundColor: palette.goldSoft },
        modeTabText: { fontSize: 13, color: palette.muted },
        modeTabTextActive: { color: palette.gold, fontWeight: '600' },
        numberBox: { marginTop: 8, marginBottom: 4 },
        numberHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 36 },
        numberHint: { fontSize: 12, color: palette.muted, marginTop: 6, lineHeight: 18 },
        clockCard: { backgroundColor: palette.card, borderRadius: 11, borderWidth: 1, borderColor: palette.cardBorder, paddingHorizontal: 13, marginBottom: 18 },
        clockRow: { minHeight: 68, flexDirection: 'row', gap: 8, alignItems: 'center' },
        placeRow: { minHeight: 44, flexDirection: 'row', gap: 7, alignItems: 'center', borderTopWidth: 1, borderTopColor: palette.hairline },
        footer: { paddingHorizontal: 20, paddingTop: 12, backgroundColor: palette.page, borderTopWidth: 1, borderTopColor: palette.hairline },
        options: { gap: 8, marginBottom: 8 },
        sectionGap: { marginTop: 14 },
        pillRow: { flexDirection: 'row', gap: 8 },
        pillOption: { flex: 1, minHeight: 42, borderRadius: 10, borderWidth: 1, borderColor: palette.cardBorder, backgroundColor: palette.card, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
        pillText: { fontSize: 13, color: palette.heading },
        optionHint: { fontSize: 12, color: palette.muted, marginTop: 6, lineHeight: 18 },
        mode: { minHeight: 72, flexDirection: 'row', alignItems: 'center', borderRadius: 10, paddingHorizontal: 14, gap: 6, borderWidth: 1, borderColor: palette.cardBorder, backgroundColor: palette.card },
        activeMode: { borderColor: palette.goldBorder, backgroundColor: palette.goldSoft },
        modeName: { fontSize: 16, fontWeight: '600', color: palette.heading, marginBottom: 3 },
        radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: palette.rule, justifyContent: 'center', alignItems: 'center' },
        dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: palette.gold },
        figures: { flexDirection: 'row', borderRadius: 11, backgroundColor: palette.card, paddingVertical: 13, borderWidth: 1, borderColor: palette.cardBorder },
        figure: { flex: 1, alignItems: 'center', gap: 7 },
        labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44, marginTop: 8 },
        label: { fontSize: 14, color: palette.ink, marginBottom: 8 },
        textButton: { minHeight: 44, justifyContent: 'center' },
        link: { fontSize: 12, color: palette.gold },
        muted: { fontSize: 12, color: palette.muted },
        field: { minHeight: 46, borderRadius: 10, borderWidth: 1, borderColor: palette.cardBorder, backgroundColor: palette.card, paddingHorizontal: 14, paddingVertical: 12, color: palette.heading, fontSize: 14 },
        fieldText: { fontSize: 15, color: palette.heading, fontVariant: ['tabular-nums'] },
        multiline: { minHeight: 64, lineHeight: 21, textAlignVertical: 'top' },
        subject: { marginTop: 18, marginBottom: 18 },
        range: { marginTop: 10 },
        disclosure: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 52, gap: 8 },
        castButton: { minHeight: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
        castText: { fontSize: 17, fontWeight: '700', letterSpacing: 4 },
    });
}
