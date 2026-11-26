import React, { useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import FocusTextInput from '../../components/FocusTextInput';
import { CustomAlert } from '../../components/CustomAlertProvider';
import { makeAIPageStyles } from '../../components/ai/ai-page-styles';
import { updateExistingRecordResult } from '../../db/database';
import { isQimenResult } from '../../db/record-types';
import { useTheme } from '../../theme/ThemeContext';
import { getQimenReading, splitQimenReading } from './ai-reading';
import { qimenCitationText } from './palace-links';
import { type QimenResult, type QimenReviewEntry } from './types';

const volumes = ['总断', '时盘', '日盘', '月盘', '年盘'] as const;

export function QimenReview({ result, onSaved }: { result: QimenResult; onSaved: (result: QimenResult) => void }) {
    const { Colors } = useTheme();
    const styles = useMemo(() => makeAIPageStyles(Colors), [Colors]);
    const sections = useMemo(() => getQimenReading(result.aiChatHistory ?? []).sections ?? splitQimenReading(result.aiAnalysis ?? ''), [result.aiChatHistory, result.aiAnalysis]);
    const [volume, setVolume] = useState<QimenReviewEntry['volume']>('总断');
    const [date, setDate] = useState(() => new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10));
    const [horizon, setHorizon] = useState(result.timeRange ?? '');
    const [observation, setObservation] = useState('');
    const [manual, setManual] = useState('');
    const [saving, setSaving] = useState(false);
    const lock = useRef(false);
    const original = sections?.[volume];
    const forecast = original ? qimenCitationText(original) : manual.trim();
    const save = async () => {
        if (lock.current || !observation.trim()) return;
        const parsed = new Date(date + 'T00:00:00Z');
        if (!/^\d{4}-\d{2}-\d{2}$/u.test(date) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
            CustomAlert.alert('观察日期无效', '请填写有效日期，如 2026-11-23。'); return;
        }
        lock.current = true; setSaving(true);
        try {
            const entry: QimenReviewEntry = { volume, date, horizon: horizon.trim(), forecast, observation: observation.trim(), recordedAt: new Date().toISOString() };
            const updated = await updateExistingRecordResult(result.id, 'qimen', current => isQimenResult(current)
                ? { ...current, reviews: [...current.reviews ?? [], entry] } : null);
            if (!isQimenResult(updated)) throw new Error('原记录已不存在');
            onSaved(updated); setObservation(''); setManual('');
        } catch (err) { CustomAlert.alert('复盘保存失败', err instanceof Error ? err.message : '请重试'); }
        finally { lock.current = false; setSaving(false); }
    };
    return <View style={styles.chart}>
        <Text style={styles.chapName}>事后复盘</Text>
        <View style={styles.chartRow}>{volumes.map(v => <Pressable key={v} accessibilityRole="button" aria-pressed={v === volume}
            style={[styles.chip, v === volume && styles.segBtnOn]} onPress={() => setVolume(v)}><Text style={v === volume ? styles.chipText : styles.chartLineMuted}>{v}</Text></Pressable>)}</View>
        <Text style={styles.chapNo}>当时的判断</Text>
        {sections?.[volume] ? <Text selectable style={styles.chartLine}>{forecast}</Text>
            : <FocusTextInput style={styles.reviewInput} value={manual} onChangeText={setManual} accessibilityLabel="当时的判断" placeholder="可填写当时的判断" placeholderTextColor={Colors.text.tertiary} multiline maxLength={2000} />}
        <Text style={styles.hint}>关注期限</Text>
        <FocusTextInput style={styles.reviewInput} value={horizon} onChangeText={setHorizon} accessibilityLabel="复盘关注期限" maxLength={80} />
        <Text style={styles.hint}>观察日期</Text>
        <FocusTextInput style={styles.reviewInput} value={date} onChangeText={setDate} accessibilityLabel="观察日期" maxLength={10} />
        <Text style={styles.chapNo}>实际发生了什么</Text>
        <FocusTextInput style={styles.reviewInput} value={observation} onChangeText={setObservation} accessibilityLabel="实际观察" multiline maxLength={2000} />
        <Pressable accessibilityRole="button" disabled={saving || !observation.trim()} style={styles.segBtn} onPress={() => void save()}>
            <Text style={observation.trim() ? styles.chipText : styles.hint}>{saving ? '保存中…' : '保存复盘'}</Text>
        </Pressable>
        {result.reviews?.slice().reverse().map((entry, i) => <View key={entry.recordedAt + i} style={styles.qimenVerdict}>
            <Text style={styles.chipText}>{entry.date} · {entry.volume}{entry.horizon && ' · ' + entry.horizon}</Text>
            {entry.forecast && <><Text style={styles.hint}>当时的判断</Text><Text selectable style={styles.chartLineMuted}>{entry.forecast}</Text></>}
            <Text style={styles.hint}>实际观察</Text><Text selectable style={styles.chartLine}>{entry.observation}</Text>
        </View>)}
    </View>;
}
