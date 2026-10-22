import React, { useCallback, useMemo, useState } from 'react';
import {
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import StatusBarDecor from '../../../src/components/StatusBarDecor';
import { BackIcon, CloseIcon } from '../../../src/components/Icons';
import { CustomAlert } from '../../../src/components/CustomAlertProvider';
import PairArcChart from '../../../src/components/PairArcChart';
import { makeResultChromeStyles, ResultCard } from '../../../src/components/result/ResultChrome';
import { BaziResult } from '../../../src/core/bazi-types';
import { TIANGAN_WUXING } from '../../../src/core/liuyao-data';
import { getAllRecords, getRecord, saveRecord } from '../../../src/db/database';
import { buildBaziMatchSummarySubtitle, buildBaziMatchSummaryTitle } from '../../../src/features/bazi/match/formatter';
import { MATCH_RELATIONS, buildPairLinks, calculatePairMatch, countPairLinks } from '../../../src/features/bazi/match/pair';
import { BaziMatchDirection, BaziMatchRelation } from '../../../src/features/bazi/match/types';
import { getGanZhiElement } from '../../../src/features/bazi/wuxing';
import { buildResultPalette, ResultPalette } from '../../../src/theme/result-palette';
import { useTheme } from '../../../src/theme/ThemeContext';

interface BaziChoice {
    id: string;
    title: string;
    result: BaziResult;
}

type Side = 'me' | 'ta';
type GenderFilter = 'all' | 'male' | 'female';

// ResultCard 左右内边距 14 + 1px 边框
const CARD_INSET = 30;

function choiceMeta(result: BaziResult): string {
    const dayStem = result.fourPillars[2].charAt(0);
    return `${result.gender === 1 ? '男' : '女'} · ${result.timeMeta.solarDate.slice(0, 4)} · ${dayStem}${TIANGAN_WUXING[dayStem] ?? ''}日主`;
}

function sideOf(choice: BaziChoice) {
    return {
        name: choice.title,
        stems: choice.result.fourPillars.map((pillar) => pillar.charAt(0)),
        branches: choice.result.fourPillars.map((pillar) => pillar.charAt(1)),
    };
}

export default function BaziMatchSelectPage() {
    const { Colors } = useTheme();
    const palette = useMemo(() => buildResultPalette(Colors), [Colors]);
    const chrome = useMemo(() => makeResultChromeStyles(palette), [palette]);
    const styles = useMemo(() => makeStyles(palette, Colors), [palette, Colors]);
    const { width } = useWindowDimensions();
    const [records, setRecords] = useState<BaziChoice[]>([]);
    const [meId, setMeId] = useState<string | null>(null);
    const [taId, setTaId] = useState<string | null>(null);
    const [relation, setRelation] = useState<BaziMatchRelation>('love');
    const [direction, setDirection] = useState<BaziMatchDirection | undefined>(undefined);
    const [pickerSide, setPickerSide] = useState<Side | null>(null);
    const [filter, setFilter] = useState<GenderFilter>('all');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const loadRecords = useCallback(async () => {
        setLoading(true);
        try {
            const summaries = await getAllRecords();
            const details = await Promise.all(summaries.filter((item) => item.engineType === 'bazi').map(async (summary) => {
                const detail = await getRecord(summary.id);
                if (!detail || detail.engineType !== 'bazi') return null;
                return { id: summary.id, title: summary.title, result: detail.result } as BaziChoice;
            }));
            setRecords(details.filter((item): item is BaziChoice => Boolean(item)));
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : '加载八字记录失败';
            CustomAlert.alert('错误', message);
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            void loadRecords();
        }, [loadRecords]),
    );

    const me = records.find((item) => item.id === meId) ?? null;
    const ta = records.find((item) => item.id === taId) ?? null;
    const relationMeta = MATCH_RELATIONS.find((item) => item.key === relation) ?? MATCH_RELATIONS[0];
    const links = useMemo(() => (me && ta ? buildPairLinks(sideOf(me), sideOf(ta)) : []), [me, ta]);
    const counts = countPairLinks(links);
    const ready = Boolean(me && ta && !saving);
    const pickerRecords = records.filter((item) => filter === 'all' || (filter === 'male') === (item.result.gender === 1));
    const otherId = pickerSide === 'me' ? taId : meId;

    const pickRelation = (next: BaziMatchRelation) => {
        setRelation(next);
        setDirection(MATCH_RELATIONS.find((item) => item.key === next)?.directions[0]?.key);
    };

    const handleCreate = async () => {
        if (!me || !ta) {
            CustomAlert.alert('提示', '请先选好两个人');
            return;
        }
        try {
            setSaving(true);
            const result = calculatePairMatch(me.result, ta.result, relation, direction, new Date());
            await saveRecord({
                engineType: 'baziCompatibility',
                result,
                summary: {
                    method: 'baziCompatibility',
                    title: buildBaziMatchSummaryTitle(result),
                    subtitle: buildBaziMatchSummarySubtitle(result),
                },
            });
            router.replace(`/bazi/match/result/${result.id}`);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : '生成合盘失败';
            CustomAlert.alert('错误', message);
        } finally {
            setSaving(false);
        }
    };

    const handlePick = (id: string) => {
        if (pickerSide === 'me') setMeId(id);
        if (pickerSide === 'ta') setTaId(id);
        setPickerSide(null);
    };

    const noBazi = !loading && records.length === 0;

    return (
        <View style={styles.container}>
            <StatusBarDecor />
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.headerBtn, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="返回">
                    <BackIcon size={22} color={palette.ink} />
                </Pressable>
                <Text style={styles.headerTitle} accessibilityRole="header">合盘</Text>
                <View style={styles.headerBtn} />
            </View>

            <ScrollView style={styles.content} contentContainerStyle={styles.contentBody} showsVerticalScrollIndicator={false}>
                {loading ? (
                    <Text style={styles.muted}>加载中...</Text>
                ) : noBazi ? (
                    <View style={[chrome.card, styles.emptyPanel]}>
                        <Text style={styles.emptyTitle}>还没有八字记录</Text>
                        <Text style={styles.muted}>先给两个人各排一盘，再回来合盘。</Text>
                        <Pressable style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]} onPress={() => router.push('/bazi/input')}>
                            <Text style={styles.secondaryBtnText}>去排盘</Text>
                        </Pressable>
                    </View>
                ) : (
                    <>
                        <ResultCard title="两人" meta="任选两条八字记录，不分男女" styles={chrome}>
                            <View style={styles.pair}>
                                <SlotButton side="me" choice={me} onPress={() => setPickerSide('me')} palette={palette} styles={styles} />
                                <Pressable
                                    onPress={() => {
                                        setMeId(taId);
                                        setTaId(meId);
                                    }}
                                    style={({ pressed }) => [styles.swap, pressed && styles.pressed]}
                                    accessibilityRole="button"
                                    accessibilityLabel="互换两人"
                                >
                                    <Text style={styles.swapText}>⇄</Text>
                                </Pressable>
                                <SlotButton side="ta" choice={ta} onPress={() => setPickerSide('ta')} palette={palette} styles={styles} />
                            </View>
                        </ResultCard>

                        <ResultCard title="关系" meta="决定看哪些宫位与十神" styles={chrome} style={styles.card}>
                            <View style={styles.rels} accessibilityRole="radiogroup">
                                {MATCH_RELATIONS.map((item) => {
                                    const on = item.key === relation;
                                    return (
                                        <Pressable
                                            key={item.key}
                                            onPress={() => pickRelation(item.key)}
                                            style={({ pressed }) => [styles.rel, on && styles.relOn, pressed && styles.pressed]}
                                            accessibilityRole="radio"
                                            accessibilityState={{ checked: on }}
                                        >
                                            <Text style={[styles.relName, on && { color: palette.gold }]}>{item.name}</Text>
                                            <Text style={styles.relHint}>{item.hint}</Text>
                                        </Pressable>
                                    );
                                })}
                            </View>
                            {relationMeta.directions.length > 0 ? (
                                <View style={styles.dir}>
                                    <Text style={styles.dirLabel}>方向</Text>
                                    <View style={styles.seg} accessibilityRole="radiogroup">
                                        {relationMeta.directions.map((item) => {
                                            const on = item.key === direction;
                                            return (
                                                <Pressable key={item.key} onPress={() => setDirection(item.key)} style={[styles.segBtn, on && styles.segBtnOn]} accessibilityRole="radio" accessibilityState={{ checked: on }}>
                                                    <Text style={[styles.segText, on && styles.segTextOn]}>{item.label}</Text>
                                                </Pressable>
                                            );
                                        })}
                                    </View>
                                </View>
                            ) : null}
                            <Text style={styles.look}><Text style={styles.lookHead}>{relationMeta.name}看　</Text>{relationMeta.look}</Text>
                        </ResultCard>

                        <ResultCard title="初看" meta={me && ta ? '两人八柱并成一行' : '选好两人后先画一遍'} styles={chrome} style={styles.card}>
                            {me && ta ? (
                                <>
                                    <View style={styles.preview}>
                                        <PairArcChart me={sideOf(me)} ta={sideOf(ta)} links={links} width={Math.min(width - 32, 560) - CARD_INSET} glyphSize={17} showPillars={false} palette={palette} />
                                    </View>
                                    <Text style={styles.sum}>
                                        {counts.length ? '两人之间 ' : '两人之间未见明显冲合'}
                                        {counts.map((item, index) => (
                                            <Text key={item.tag}>
                                                {index > 0 ? ' · ' : ''}
                                                <Text style={{ color: item.tone === 'pos' ? palette.positive : palette.negative, fontWeight: '700' }}>{item.tag} {item.count}</Text>
                                            </Text>
                                        ))}
                                        {counts.length ? '，合盘后看全部' : ''}
                                    </Text>
                                </>
                            ) : (
                                <Text style={styles.sumEmpty}>两盘之间的合、冲、刑、害会画在这里。</Text>
                            )}
                        </ResultCard>
                    </>
                )}
            </ScrollView>

            {!noBazi ? (
                <View style={styles.footer}>
                    <Pressable
                        style={({ pressed }) => [styles.primaryBtn, !ready && styles.primaryBtnDisabled, pressed && ready && styles.pressed]}
                        onPress={handleCreate}
                        disabled={!ready}
                        accessibilityRole="button"
                        accessibilityState={{ disabled: !ready }}
                    >
                        <Text style={styles.primaryBtnText}>{saving ? '生成中' : '合盘'}</Text>
                    </Pressable>
                    <Text style={styles.footNote}>保存两人快照，原记录删掉也能回看</Text>
                </View>
            ) : null}

            <Modal visible={Boolean(pickerSide)} transparent animationType="slide" onRequestClose={() => setPickerSide(null)}>
                <View style={styles.modalMask}>
                    <Pressable style={StyleSheet.absoluteFill} onPress={() => setPickerSide(null)} accessibilityLabel="关闭" />
                    <View style={styles.sheet}>
                        <View style={styles.sheetHandle} />
                        <View style={styles.sheetHeader}>
                            <Text style={styles.sheetTitle}>{pickerSide === 'me' ? '选我' : '选 TA'}</Text>
                            <Text style={styles.sheetMeta}>{records.length} 条记录 · 不分男女</Text>
                            <Pressable style={({ pressed }) => [styles.headerBtn, pressed && styles.pressed]} onPress={() => setPickerSide(null)} accessibilityRole="button" accessibilityLabel="关闭">
                                <CloseIcon size={20} color={palette.icon} />
                            </Pressable>
                        </View>
                        <View style={[styles.seg, styles.sheetSeg]} accessibilityRole="tablist">
                            {([['all', '全部'], ['male', '男'], ['female', '女']] as Array<[GenderFilter, string]>).map(([key, label]) => {
                                const on = key === filter;
                                return (
                                    <Pressable key={key} onPress={() => setFilter(key)} style={[styles.segBtn, on && styles.segBtnOn]} accessibilityRole="tab" accessibilityState={{ selected: on }}>
                                        <Text style={[styles.segText, on && styles.segTextOn]}>{label}</Text>
                                    </Pressable>
                                );
                            })}
                        </View>
                        <ScrollView style={styles.sheetList} contentContainerStyle={styles.sheetListBody} showsVerticalScrollIndicator={false}>
                            {pickerRecords.length === 0 ? (
                                <Text style={[styles.muted, styles.sheetEmpty]}>这一类还没有记录，先排一盘。</Text>
                            ) : pickerRecords.map((item, index) => {
                                const selected = item.id === (pickerSide === 'me' ? meId : taId);
                                const taken = item.id === otherId;
                                return (
                                    <Pressable
                                        key={item.id}
                                        disabled={taken}
                                        style={({ pressed }) => [styles.sheetRow, index > 0 && styles.rowSep, taken && styles.sheetRowOff, pressed && styles.pressed]}
                                        onPress={() => handlePick(item.id)}
                                        accessibilityRole="button"
                                        accessibilityState={{ selected, disabled: taken }}
                                    >
                                        <View style={styles.choiceMain}>
                                            <Text style={styles.choiceTitle} numberOfLines={1}>{item.title}</Text>
                                            <Text style={styles.choiceMeta} numberOfLines={1}>{taken ? `已选作「${pickerSide === 'me' ? 'TA' : '我'}」` : choiceMeta(item.result)}</Text>
                                        </View>
                                        <Pillars pillars={item.result.fourPillars} palette={palette} styles={styles} />
                                        <Text style={[styles.check, !selected && styles.checkOff]}>✓</Text>
                                    </Pressable>
                                );
                            })}
                            <Pressable style={({ pressed }) => [styles.newChart, pressed && styles.pressed]} onPress={() => { setPickerSide(null); router.push('/bazi/input'); }}>
                                <Text style={styles.newChartText}>新排一盘</Text>
                            </Pressable>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const SlotButton: React.FC<{
    side: Side;
    choice: BaziChoice | null;
    onPress: () => void;
    palette: ResultPalette;
    styles: ReturnType<typeof makeStyles>;
}> = ({ side, choice, onPress, palette, styles }) => (
    <Pressable
        style={({ pressed }) => [styles.slot, pressed && styles.pressed]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={choice ? `更换${side === 'me' ? '我' : ' TA'}：${choice.title}` : `选${side === 'me' ? '我' : ' TA'}`}
    >
        <View style={styles.who}><Text style={styles.whoText}>{side === 'me' ? '我' : 'TA'}</Text></View>
        {choice ? (
            <>
                <Text style={styles.slotName} numberOfLines={1}>{choice.title}</Text>
                <Text style={styles.slotMeta} numberOfLines={1}>{choiceMeta(choice.result)}</Text>
                <Pillars pillars={choice.result.fourPillars} palette={palette} styles={styles} />
            </>
        ) : (
            <>
                <Text style={styles.slotEmpty}>选一条记录</Text>
                <Text style={styles.slotMeta}>从八字记录里挑</Text>
            </>
        )}
    </Pressable>
);

const Pillars: React.FC<{ pillars: readonly string[]; palette: ResultPalette; styles: ReturnType<typeof makeStyles> }> = ({ pillars, palette, styles }) => (
    <Text style={styles.pillars} numberOfLines={1}>
        {pillars.map((pillar, index) => (
            <Text key={`${pillar}-${index}`}>
                {index > 0 ? ' ' : ''}
                {Array.from(pillar).map((char, charIndex) => {
                    const element = getGanZhiElement(char);
                    return <Text key={charIndex} style={{ color: element ? palette.element[element] : palette.ink }}>{char}</Text>;
                })}
            </Text>
        ))}
    </Text>
);

const makeStyles = (palette: ResultPalette, Colors: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: 'transparent' },
    pressed: { opacity: 0.72 },
    header: { height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
    headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 17, fontWeight: '700', color: palette.heading },
    content: { flex: 1 },
    contentBody: { width: '100%', maxWidth: 592, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 2, paddingBottom: 132 },
    muted: { fontSize: 13, lineHeight: 20, color: palette.muted, textAlign: 'center' },
    card: { marginTop: 12 },
    rowSep: { borderTopWidth: 1, borderTopColor: palette.hairline },

    pair: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
    slot: { flex: 1, minWidth: 0, minHeight: 112, alignItems: 'flex-start', paddingTop: 10, paddingBottom: 12, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: palette.hairline },
    who: { height: 18, paddingHorizontal: 5, borderRadius: 4, justifyContent: 'center', backgroundColor: palette.chipBg },
    whoText: { fontSize: 11, lineHeight: 16, fontWeight: '700', color: palette.ink },
    slotName: { marginTop: 6, fontSize: 16, lineHeight: 22, fontWeight: '700', color: palette.heading },
    slotEmpty: { marginTop: 6, fontSize: 15, lineHeight: 22, fontWeight: '600', color: palette.ink },
    slotMeta: { fontSize: 11.5, lineHeight: 16, color: palette.muted },
    pillars: { marginTop: 6, fontSize: 12.5, lineHeight: 18, fontWeight: '700' },
    swap: { width: 24, height: 44, alignItems: 'center', justifyContent: 'center' },
    swapText: { fontSize: 16, color: palette.muted },

    rels: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    rel: { width: '31.5%', flexGrow: 1, height: 58, alignItems: 'center', justifyContent: 'center', gap: 2, borderRadius: 8, borderWidth: 1, borderColor: palette.hairline },
    relOn: { borderColor: palette.goldBorder, backgroundColor: palette.goldSoft },
    relName: { fontSize: 15, lineHeight: 20, fontWeight: '700', color: palette.heading },
    relHint: { fontSize: 11, lineHeight: 15, color: palette.muted },
    dir: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
    dirLabel: { fontSize: 12, color: palette.muted },
    seg: { flex: 1, flexDirection: 'row', padding: 2, borderRadius: 8, backgroundColor: palette.segTrack },
    segBtn: { flex: 1, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 6 },
    segBtnOn: { backgroundColor: palette.segOn },
    segText: { fontSize: 13, color: palette.muted },
    segTextOn: { color: palette.heading, fontWeight: '700' },
    look: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: palette.hairline, fontSize: 13, lineHeight: 20, color: palette.body },
    lookHead: { fontWeight: '600', color: palette.heading },

    preview: { marginTop: 8 },
    sum: { marginTop: 4, fontSize: 12, lineHeight: 18, color: palette.muted },
    sumEmpty: { marginTop: 8, fontSize: 13, lineHeight: 20, color: palette.muted },

    emptyPanel: { marginTop: 24, alignItems: 'center', gap: 8, padding: 24 },
    emptyTitle: { fontSize: 15, fontWeight: '700', color: palette.heading },
    secondaryBtn: { marginTop: 8, minHeight: 44, paddingHorizontal: 22, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.goldBorder, backgroundColor: palette.goldSoft },
    secondaryBtnText: { fontSize: 14, fontWeight: '600', color: palette.gold },

    footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20, backgroundColor: Colors.bg.primary },
    primaryBtn: { height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.gold },
    primaryBtnDisabled: { opacity: 0.45 },
    primaryBtnText: { fontSize: 16, fontWeight: '700', letterSpacing: 4, paddingLeft: 4, color: Colors.text.inverse },
    footNote: { marginTop: 8, textAlign: 'center', fontSize: 11.5, lineHeight: 16, color: palette.muted },

    modalMask: { flex: 1, justifyContent: 'flex-end', backgroundColor: Colors.bg.overlay },
    sheet: { maxHeight: '78%', paddingBottom: 12, borderTopLeftRadius: 20, borderTopRightRadius: 20, backgroundColor: palette.card },
    sheetHandle: { alignSelf: 'center', width: 36, height: 4, marginTop: 8, borderRadius: 2, backgroundColor: palette.rule },
    sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 20, paddingRight: 6, paddingTop: 4 },
    sheetTitle: { fontSize: 17, fontWeight: '700', color: palette.heading },
    sheetMeta: { flex: 1, fontSize: 12, color: palette.muted },
    sheetSeg: { flex: 0, flexShrink: 0, flexBasis: 'auto', marginHorizontal: 20, marginTop: 6, marginBottom: 4 },
    sheetList: { flexGrow: 0 },
    sheetListBody: { paddingHorizontal: 20, paddingBottom: 12 },
    sheetEmpty: { paddingVertical: 28 },
    sheetRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
    sheetRowOff: { opacity: 0.45 },
    choiceMain: { flex: 1, minWidth: 0, gap: 2 },
    choiceTitle: { fontSize: 15, lineHeight: 21, fontWeight: '700', color: palette.heading },
    choiceMeta: { fontSize: 11.5, lineHeight: 16, color: palette.muted },
    check: { width: 20, fontSize: 16, fontWeight: '700', textAlign: 'center', color: palette.gold },
    checkOff: { opacity: 0 },
    newChart: { marginTop: 12, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.goldBorder, backgroundColor: palette.goldSoft },
    newChartText: { fontSize: 14, fontWeight: '600', color: palette.gold },
});
