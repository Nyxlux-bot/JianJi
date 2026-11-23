import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { makeAIPageStyles } from '../../components/ai/ai-page-styles';
import { QIMEN_PALACES } from './data';
import { getPeriodBoard } from './period-board';
import { QIMEN_PERIODS, type QimenGate, type QimenPeriod, type QimenResult } from './types';

export function QimenComparison({ result, selected, gate, onSelect }: {
    result: QimenResult; selected: number; gate: QimenGate | null; onSelect: (period: QimenPeriod, palace: number) => void;
}) {
    const { Colors } = useTheme();
    const styles = useMemo(() => makeAIPageStyles(Colors), [Colors]);
    const [mode, setMode] = useState<'宫' | '门' | null>(null);
    const [tracked, setTracked] = useState<QimenGate>('生门');
    const expanded = mode !== null;
    const boards = useMemo(() => expanded ? QIMEN_PERIODS.map(p => getPeriodBoard(result, p)) : [], [result, expanded]);
    return <View style={styles.chart}>
        <Pressable accessibilityRole="button" aria-expanded={!!mode} style={styles.chartTop} onPress={() => {
            setMode(mode ? null : '宫'); setTracked(gate ?? '生门');
        }}>
            <Text style={styles.chartLine}>四盘对照</Text><Text style={styles.chipText}>{mode ? '收起' : '展开'}</Text>
        </Pressable>
        {mode && <>
            <View style={styles.seg}>{(['宫', '门'] as const).map(m => <Pressable key={m} style={[styles.segBtn, m === mode && styles.segBtnOn]}
                accessibilityRole="button" aria-pressed={mode === m} onPress={() => setMode(m)}>
                <Text style={styles.segText}>{m === '宫' ? '同宫 · ' + QIMEN_PALACES[selected - 1].name : '追踪八门'}</Text>
            </Pressable>)}</View>
            {mode === '门' && <View style={styles.chartRow}>{QIMEN_PALACES.flatMap(p => p.gate ? [p.gate] : []).map(g =>
                <Pressable key={g} accessibilityRole="button" accessibilityLabel={'追踪' + g} aria-pressed={g === tracked} style={[styles.chip, g === tracked && styles.segBtnOn]} onPress={() => setTracked(g)}>
                    <Text style={g === tracked ? styles.chipText : styles.chartLineMuted}>{g}</Text>
                </Pressable>)}</View>}
            {boards.map((board, i) => {
                const period = QIMEN_PERIODS[i];
                const cell = mode === '宫' ? board.palaces[selected - 1] : board.palaces.find(p => p.gate === tracked);
                if (!cell) return <Text key={period} style={styles.hint}>{period} · 未排此门</Text>;
                return <Pressable key={period} accessibilityRole="button" accessibilityLabel={`查看${period}·${QIMEN_PALACES[cell.number - 1].name}宫`}
                    style={styles.qimenVerdict} onPress={() => { setMode(null); onSelect(period, cell.number); }}>
                    <View style={styles.chartTop}><Text style={styles.chipText}>{period} · {QIMEN_PALACES[cell.number - 1].name}宫</Text><Text style={styles.hint}>{board.title} ›</Text></View>
                    <Text style={styles.chartLine}>{[cell.star ?? '天禽随芮', cell.gate ?? (result.form === '飞盘' ? '五位' : '无门'), cell.spirit].filter(Boolean).join(' · ')}</Text>
                    <Text style={styles.chartLineMuted}>天 {cell.heavenStem ?? '—'}{cell.hostedHeavenStem && '（寄' + cell.hostedHeavenStem + '）'}　地 {cell.earthStem}{cell.hostedEarthStem && '（寄' + cell.hostedEarthStem + '）'}</Text>
                </Pressable>;
            })}
        </>}
    </View>;
}
