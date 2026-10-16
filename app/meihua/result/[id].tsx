/**
 * 梅花易数结果：卦象页（三卦表、体用、卦辞）与断语页（卦气、断语、类象）。
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import StatusBarDecor from '../../../src/components/StatusBarDecor';
import ConfirmModal from '../../../src/components/ConfirmModal';
import { CustomAlert } from '../../../src/components/CustomAlertProvider';
import OverflowMenu, { OverflowMenuItem } from '../../../src/components/OverflowMenu';
import WuXingIcon from '../../../src/components/WuXingIcon';
import HexagramLines from '../../../src/components/result/HexagramLines';
import {
    makeResultChromeStyles, ResultCard, ResultHero, ResultTopBar, type ResultTab,
} from '../../../src/components/result/ResultChrome';
import { useTheme } from '../../../src/theme/ThemeContext';
import { buildResultPalette, type ResultPalette } from '../../../src/theme/result-palette';
import { Spacing } from '../../../src/theme/colors';
import { deleteRecord, getAllRecords, getRecord, toggleFavorite } from '../../../src/db/database';
import { clearAIAnalysisJob } from '../../../src/services/ai-analysis-jobs';
import { isAIConfigured } from '../../../src/services/settings';
import { shareMeihuaResultMarkdown } from '../../../src/services/share';
import AIChatModal from '../../../src/components/AIChatModal';
import { getLinePositionName, getTiYong, getTrigram } from '../../../src/features/meihua/engine';
import { analyzeMeihua, type MeihuaRelation, type MeihuaTone, type MeihuaTrigramRelation } from '../../../src/features/meihua/rules';
import { getHexagramText, getLineText } from '../../../src/core/iching-texts';
import { LIUYAO_SUBJECT_SHORT } from '../../../src/core/liuyao-data';
import { getTrigramImages, TRIGRAM_IMAGE_SOURCE } from '../../../src/features/meihua/images';
import type { MeihuaHexagram, MeihuaResult } from '../../../src/features/meihua/types';

type View_ = 'gua' | 'judge';
const TABS: ResultTab<View_>[] = [{ key: 'gua', label: '卦象' }, { key: 'judge', label: '断语' }];
const SEAL: Record<MeihuaResult['method'], string> = { meihua_time: '时卦', meihua_number: '数卦' };
const STATE_PCT: Record<string, `${number}%`> = { 旺: '100%', 相: '75%', 休: '50%', 囚: '30%', 死: '15%' };
const PLUM_BRANCH = require('../../../assets/meihua/ui/plum-branch.png');
const TIYONG_LABEL: Record<MeihuaRelation, string> = { 比和: '体用比和', 生体: '用生体', 克体: '用克体', 体生: '体生用', 体克: '体克用' };
const OTHER_LABEL: Record<MeihuaRelation, string> = { 比和: '比和', 生体: '生体', 克体: '克体', 体生: '泄体', 体克: '受克' };

function relationFormula(relation: MeihuaRelation, ti: string, yong: string): string {
    if (relation === '比和') return `${ti}${yong}同气`;
    if (relation === '生体') return `${yong}生${ti}`;
    if (relation === '克体') return `${yong}克${ti}`;
    if (relation === '体生') return `${ti}生${yong}`;
    return `${ti}克${yong}`;
}

export default function MeihuaResultPage() {
    const { Colors } = useTheme();
    const palette = useMemo(() => buildResultPalette(Colors), [Colors]);
    const chrome = useMemo(() => makeResultChromeStyles(palette), [palette]);
    const styles = useMemo(() => makeStyles(palette), [palette]);
    const toneColor = (tone: MeihuaTone) => (tone === 'good' ? Colors.bazi.statePositive : tone === 'bad' ? Colors.bazi.stateNegative : palette.gold);

    const { id } = useLocalSearchParams<{ id: string }>();
    const [result, setResult] = useState<MeihuaResult | null>(null);
    const [screenState, setScreenState] = useState<'loading' | 'ready' | 'missing'>('loading');
    const [isFavorite, setIsFavorite] = useState(false);
    const [view, setView] = useState<View_>('gua');
    const [menuVisible, setMenuVisible] = useState(false);
    const [deleteVisible, setDeleteVisible] = useState(false);
    const [aiConfigured, setAiConfigured] = useState(false);
    const [aiVisible, setAiVisible] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            if (!id) return;
            const [detail, summaries] = await Promise.all([getRecord(id), getAllRecords()]);
            if (cancelled) return;
            if (!detail) {
                setScreenState('missing');
                return;
            }
            if (detail.engineType !== 'meihua') {
                router.replace(`/result/${id}`);
                return;
            }
            setResult(detail.result);
            setIsFavorite(Boolean(summaries.find((item) => item.id === id)?.isFavorite));
            setScreenState('ready');
            const configured = await isAIConfigured();
            if (!cancelled) setAiConfigured(configured);
        })();
        return () => {
            cancelled = true;
        };
    }, [id]);

    const analysis = useMemo(() => (result ? analyzeMeihua(result) : null), [result]);

    const handleOpenAI = () => {
        if (!aiConfigured) {
            CustomAlert.alert('未配置AI', '请先在设置中配置 AI 接口地址和 API Key', [
                { text: '去设置', onPress: () => router.push('/settings') },
                { text: '取消', style: 'cancel' },
            ]);
            return;
        }
        setAiVisible(true);
    };

    const menuItems: OverflowMenuItem[] = [
        {
            key: 'share', label: '导出分享', onPress: async () => {
                if (!result) return;
                try {
                    await shareMeihuaResultMarkdown(result);
                } catch (error: any) {
                    CustomAlert.alert('分享失败', typeof error?.message === 'string' ? error.message : '导出失败，请稍后重试');
                }
            },
        },
        {
            key: 'favorite', label: isFavorite ? '取消收藏' : '收藏结果', onPress: async () => {
                if (!id) return;
                await toggleFavorite(id);
                setIsFavorite((prev) => !prev);
            },
        },
        { key: 'delete', label: '删除记录', onPress: () => setDeleteVisible(true), destructive: true },
    ];

    if (screenState !== 'ready' || !result || !analysis) {
        return (
            <View style={styles.container}>
                <StatusBarDecor />
                <View style={styles.center}>
                    <Text style={styles.muted}>{screenState === 'missing' ? '记录不存在或已被删除' : '加载中...'}</Text>
                    {screenState === 'missing' ? (
                        <Pressable onPress={() => router.back()} style={styles.backLink}><Text style={styles.backLinkText}>返回上一页</Text></Pressable>
                    ) : null}
                </View>
            </View>
        );
    }

    const { lunarInfo } = result;
    const { ti, yong } = getTiYong(result);
    const tiTrigram = getTrigram(ti);
    const yongTrigram = getTrigram(yong);
    const tiyong = analysis.judgements[0];
    const columns: Array<{ kind: string; stage: string; hexagram: MeihuaHexagram; main?: boolean; up: MeihuaTrigramRelation; down: MeihuaTrigramRelation; moving?: number }> = [
        {
            kind: '本卦', stage: '事之始', hexagram: result.ben, main: true, moving: result.movingLine,
            up: result.tiPosition === 'upper' ? analysis.ti : analysis.yong,
            down: result.tiPosition === 'lower' ? analysis.ti : analysis.yong,
        },
        { kind: '互卦', stage: '事之中', hexagram: result.hu, up: analysis.huUpper, down: analysis.huLower },
        {
            kind: '变卦', stage: '事之终', hexagram: result.bian,
            up: result.tiPosition === 'upper' ? analysis.ti : analysis.bianYong,
            down: result.tiPosition === 'lower' ? analysis.ti : analysis.bianYong,
        },
    ];
    const roleLabel = (item: MeihuaTrigramRelation, main?: boolean) => {
        if (item.relation === '体') return '体';
        if (main) return '用';
        return '';
    };
    const yongRelation = analysis.yong.relation as MeihuaRelation;
    const relationNotes = (column: typeof columns[number]) => {
        if (column.main) return [{ text: TIYONG_LABEL[yongRelation], tone: analysis.yong.tone }];
        const items = [column.up, column.down].filter((item) => item.relation !== '体');
        const unique = items.filter((item, index) => items.findIndex((other) => other.index === item.index) === index);
        return unique.map((item) => ({ text: `${item.name} ${OTHER_LABEL[item.relation as MeihuaRelation]}`, tone: item.tone }));
    };
    const benText = getHexagramText(result.ben);
    const movingText = getLineText(result.ben, result.movingLine);

    const trigramCell = (item: MeihuaTrigramRelation, role: string, top: boolean) => (
        <View style={[styles.cell, styles.trigramRow, top && styles.ruleTop]}>
            <WuXingIcon element={item.wuxing} size={15} />
            <Text style={[styles.trigramName, { color: palette.element[item.wuxing] }]}>{item.name}</Text>
            {role ? <Text style={styles.roleTag}>{role}</Text> : null}
        </View>
    );

    return (
        <View style={styles.container}>
            <StatusBarDecor backgroundColor={palette.card} />
            <ResultTopBar
                tabs={TABS} active={view} onTab={setView}
                aiLabel="AI 解卦" aiDisabled={!aiConfigured} onAI={handleOpenAI}
                onMore={() => setMenuVisible((prev) => !prev)}
                styles={chrome} palette={palette}
            />
            <OverflowMenu visible={menuVisible} top={54} right={Spacing.lg} items={menuItems} onClose={() => setMenuVisible(false)} />

            <ResultHero
                title={result.question || result.ben.fullName}
                seal={SEAL[result.method]}
                chip={result.subject ? LIUYAO_SUBJECT_SHORT[result.subject] : undefined}
                styles={chrome}
                art={<Image source={PLUM_BRANCH} style={[chrome.heroArt, styles.heroArt]} resizeMode="contain" accessibilityIgnoresInvertColors />}
                rows={[
                    { label: '起卦', value: `${lunarInfo.yearGanZhi}年 ${lunarInfo.lunarMonthCN}${lunarInfo.lunarDayCN} ${lunarInfo.hourZhi}时` },
                    { label: '取数', value: result.numbers.map((item) => `${item.source} ${item.value}`).join(' · ') },
                    {
                        label: '月令', value: (
                            <Text style={chrome.heroRowValue}>
                                {analysis.monthZhi}月 · <Text style={{ color: palette.element[analysis.monthWuxing], fontWeight: '600' }}>{analysis.monthWuxing}</Text>旺
                            </Text>
                        ),
                    },
                    ...(result.timeRange ? [{ label: '时限', value: result.timeRange }] : []),
                ]}
            />

            <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
                {view === 'gua' ? (
                    <>
                        <ResultCard title="三卦" meta={`${getLinePositionName(result.movingLine)}动 · ${result.tiPosition === 'lower' ? '上' : '下'}卦为用`} styles={chrome}>
                            <View style={styles.table}>
                                <View style={styles.labelCol}>
                                    <View style={styles.headCell} />
                                    <Text style={[styles.rowLabel, styles.nameCell]}>卦名</Text>
                                    <Text style={[styles.rowLabel, styles.linesCell]}>卦画</Text>
                                    <Text style={[styles.rowLabel, styles.cell, styles.ruleTop]}>上卦</Text>
                                    <Text style={[styles.rowLabel, styles.cell, styles.ruleTopSoft]}>下卦</Text>
                                    <Text style={[styles.rowLabel, styles.noteCell, styles.ruleTopSoft]}>生克</Text>
                                </View>
                                {columns.map((column) => (
                                    <View key={column.kind} style={[styles.col, column.main && styles.colMain]}>
                                        <View style={styles.headCell}>
                                            <Text style={[styles.colHead, column.main && styles.colHeadMain]}>{column.kind}</Text>
                                            <Text style={styles.colStage}>{column.stage}</Text>
                                        </View>
                                        <Text style={[styles.hexName, styles.nameCell]} numberOfLines={1}>{column.hexagram.fullName}</Text>
                                        <View style={styles.linesCell}>
                                            <HexagramLines lines={column.hexagram.lines} movingLines={column.moving ? [column.moving] : []} width={42} color={palette.gold} movingColor={palette.vermilion} />
                                        </View>
                                        {trigramCell(column.up, roleLabel(column.up, column.main), true)}
                                        <View style={styles.ruleTopSoft}>{trigramCell(column.down, roleLabel(column.down, column.main), false)}</View>
                                        <View style={[styles.noteCell, styles.ruleTopSoft]}>
                                            {relationNotes(column).map((note) => (
                                                <Text key={note.text} style={[styles.note, { color: toneColor(note.tone) }]}>{note.text}</Text>
                                            ))}
                                        </View>
                                    </View>
                                ))}
                            </View>
                        </ResultCard>

                        <ResultCard title="体用" styles={chrome}>
                            <View style={styles.tiyongRow}>
                                {[{ label: '体', trigram: tiTrigram, state: analysis.tiState }, null, { label: '用', trigram: yongTrigram, state: analysis.yongState }].map((item, index) => (item ? (
                                    <View key={item.label} style={styles.tiyongSide}>
                                        <Text style={styles.muted}>{item.label}</Text>
                                        <View style={styles.tiyongMain}>
                                            <WuXingIcon element={item.trigram.wuxing} size={24} />
                                            <Text style={[styles.tiyongName, { color: palette.element[item.trigram.wuxing] }]}>{item.trigram.name}</Text>
                                        </View>
                                        <Text style={styles.tiyongMeta}>
                                            {item.trigram.wuxing} · <Text style={{ color: item.state === '旺' || item.state === '相' ? Colors.bazi.statePositive : item.state === '休' ? palette.body : Colors.bazi.stateNegative }}>{item.state}</Text>
                                        </Text>
                                    </View>
                                ) : (
                                    <View key={index} style={styles.tiyongMid}>
                                        <Text style={styles.muted}>{relationFormula(yongRelation, tiTrigram.wuxing, yongTrigram.wuxing)}</Text>
                                        <View style={[styles.arrowLine, { backgroundColor: toneColor(analysis.yong.tone) }]} />
                                        <Text style={[styles.tiyongVerdict, { color: toneColor(analysis.yong.tone) }]}>{relationNotes(columns[0])[0].text}</Text>
                                    </View>
                                )))}
                            </View>
                            <View style={styles.footer}>
                                <Text style={styles.bodyText}>{tiyong.text}</Text>
                                <Text style={[styles.bodyText, styles.mutedText]}>{analysis.judgements[1].text}</Text>
                            </View>
                        </ResultCard>

                        <ResultCard title="卦辞" styles={chrome}>
                            <View style={styles.textGrid}>
                                <View style={styles.textRow}>
                                    <Text style={styles.textLabel}>本 · {result.ben.name}</Text>
                                    <Text style={styles.scripture}>{benText.scripture}</Text>
                                </View>
                                <View style={styles.textRow}>
                                    <Text style={[styles.textLabel, { color: palette.vermilion }]}>{movingText.name} 动</Text>
                                    <Text style={styles.scripture}>{movingText.scripture}</Text>
                                </View>
                            </View>
                        </ResultCard>
                    </>
                ) : (
                    <>
                        <ResultCard title="卦气" meta={`${analysis.monthZhi}月${analysis.monthWuxing}当令`} styles={chrome}>
                            <View style={styles.seasonList}>
                                {analysis.season.map((row) => (
                                    <View key={row.wuxing} style={styles.seasonRow}>
                                        <WuXingIcon element={row.wuxing} size={16} />
                                        <Text style={[styles.seasonWx, { color: palette.element[row.wuxing] }]}>{row.wuxing}</Text>
                                        <View style={styles.bar}><View style={[styles.barFill, { width: STATE_PCT[row.state], backgroundColor: palette.element[row.wuxing] }]} /></View>
                                        <Text style={styles.seasonState}>{row.state}</Text>
                                        <Text style={styles.seasonHolders} numberOfLines={1}>{row.holders.join(' · ')}</Text>
                                    </View>
                                ))}
                            </View>
                        </ResultCard>

                        <ResultCard title="断语" meta="按体用生克规则" styles={chrome}>
                            <View style={styles.judgeList}>
                                {analysis.judgements.map((item) => (
                                    <View key={item.key} style={styles.judgeRow}>
                                        <Text style={styles.judgeLabel}>{item.label}</Text>
                                        <View style={styles.judgeBody}>
                                            <Text style={styles.bodyText}>{item.text}</Text>
                                            <Text style={styles.source}>{item.source}</Text>
                                        </View>
                                        <Text style={[styles.judgeTag, { color: toneColor(item.tone) }]}>{item.tag}</Text>
                                    </View>
                                ))}
                            </View>
                            <Text style={[styles.source, styles.footnote]}>程序按规则给出的提示，完整断卦请用 AI 解卦。</Text>
                        </ResultCard>

                        <ResultCard title="类象" meta={`取自${TRIGRAM_IMAGE_SOURCE}`} styles={chrome}>
                            <View style={styles.judgeList}>
                                {[{ role: '体', trigram: tiTrigram }, { role: '用', trigram: yongTrigram }].map((item) => (
                                    <View key={item.role} style={styles.imageRow}>
                                        <View style={styles.imageHead}>
                                            <WuXingIcon element={item.trigram.wuxing} size={15} />
                                            <Text style={[styles.imageName, { color: palette.element[item.trigram.wuxing] }]}>{item.trigram.name}</Text>
                                            <Text style={styles.roleTag}>{item.role}</Text>
                                        </View>
                                        <Text style={styles.bodyText}>{getTrigramImages(item.trigram.name).join(' · ')}</Text>
                                    </View>
                                ))}
                            </View>
                        </ResultCard>

                        {result.recentEvents ? (
                            <ResultCard title="近事" meta="起卦时补充" styles={chrome}>
                                <Text style={styles.bodyText}>{result.recentEvents}</Text>
                            </ResultCard>
                        ) : null}
                    </>
                )}
            </ScrollView>

            <AIChatModal
                visible={aiVisible}
                onClose={() => setAiVisible(false)}
                result={result}
                onUpdateResult={(updated) => setResult(updated as MeihuaResult)}
            />

            <ConfirmModal
                visible={deleteVisible}
                title="删除记录"
                message="确定要删除此起卦记录吗？删除后将无法恢复。"
                confirmText="删除"
                destructive
                onConfirm={async () => {
                    setDeleteVisible(false);
                    if (!id) return;
                    await clearAIAnalysisJob('meihua', id);
                    await deleteRecord(id);
                    router.back();
                }}
                onCancel={() => setDeleteVisible(false)}
            />
        </View>
    );
}

const ROW = { head: 40, name: 30, lines: 70, trigram: 36, note: 44 };

function makeStyles(palette: ResultPalette) {
    return StyleSheet.create({
        container: { flex: 1, backgroundColor: palette.page },
        center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
        muted: { fontSize: 12, lineHeight: 16, color: palette.muted },
        mutedText: { color: palette.muted },
        backLink: { paddingHorizontal: 16, paddingVertical: 8 },
        backLinkText: { fontSize: 14, color: palette.gold },
        heroArt: { right: -14, bottom: -26, width: 152, height: 152, opacity: 0.55 },
        body: { flex: 1 },
        bodyContent: { padding: 12, gap: 10, paddingBottom: 24 },
        table: { flexDirection: 'row', marginTop: 8 },
        labelCol: { width: 36 },
        col: { flex: 1, alignItems: 'stretch', borderRadius: 10 },
        colMain: { backgroundColor: palette.dayTint },
        headCell: { height: ROW.head, alignItems: 'center', justifyContent: 'center' },
        colHead: { fontSize: 12, lineHeight: 17, color: palette.muted },
        colHeadMain: { fontWeight: '600', color: palette.ink },
        colStage: { fontSize: 10.5, lineHeight: 14, color: palette.muted },
        rowLabel: { fontSize: 11, color: palette.muted, textAlignVertical: 'center' },
        nameCell: { height: ROW.name, lineHeight: ROW.name },
        hexName: { textAlign: 'center', fontSize: 15, fontWeight: '700', color: palette.heading },
        linesCell: { height: ROW.lines, lineHeight: ROW.lines, alignItems: 'center', justifyContent: 'center' },
        cell: { height: ROW.trigram, lineHeight: ROW.trigram },
        ruleTop: { borderTopWidth: 1, borderTopColor: palette.rule },
        ruleTopSoft: { borderTopWidth: 1, borderTopColor: palette.hairline },
        trigramRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 },
        trigramName: { fontSize: 21, lineHeight: 26, fontWeight: '700' },
        roleTag: { alignSelf: 'flex-start', marginTop: 6, fontSize: 11, lineHeight: 14, color: palette.gold },
        noteCell: { height: ROW.note, lineHeight: ROW.note, justifyContent: 'center', alignItems: 'center' },
        note: { fontSize: 12.5, lineHeight: 18 },
        tiyongRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
        tiyongSide: { flex: 1, alignItems: 'center' },
        tiyongMain: { flexDirection: 'row', alignItems: 'center', gap: 4 },
        tiyongName: { fontSize: 30, lineHeight: 38, fontWeight: '700' },
        tiyongMeta: { fontSize: 12, lineHeight: 16, color: palette.body },
        tiyongMid: { flex: 1.2, alignItems: 'center', gap: 4 },
        arrowLine: { width: '80%', height: 1.5, borderRadius: 1 },
        tiyongVerdict: { fontSize: 15, lineHeight: 20, fontWeight: '700' },
        footer: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: palette.hairline, gap: 4 },
        bodyText: { fontSize: 13, lineHeight: 20, color: palette.body },
        textGrid: { marginTop: 8, gap: 6 },
        textRow: { flexDirection: 'row', gap: 8 },
        textLabel: { width: 52, fontSize: 12, lineHeight: 21, color: palette.muted },
        scripture: { flex: 1, fontSize: 13.5, lineHeight: 21, color: palette.ink },
        seasonList: { marginTop: 8, gap: 6 },
        seasonRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
        seasonWx: { width: 16, fontSize: 12.5, fontWeight: '700' },
        bar: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden', backgroundColor: palette.barTrack },
        barFill: { height: '100%' },
        seasonState: { width: 18, fontSize: 12.5, fontWeight: '600', color: palette.heading },
        seasonHolders: { width: 140, fontSize: 12, color: palette.muted },
        judgeList: { marginTop: 8, gap: 10 },
        judgeRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
        judgeLabel: { width: 32, fontSize: 12, lineHeight: 20, color: palette.muted },
        judgeBody: { flex: 1, gap: 2 },
        judgeTag: { width: 34, textAlign: 'right', fontSize: 13, lineHeight: 20, fontWeight: '700' },
        source: { fontSize: 11, lineHeight: 16, color: palette.muted },
        footnote: { marginTop: 12 },
        imageRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
        imageHead: { width: 60, flexDirection: 'row', alignItems: 'center', gap: 3 },
        imageName: { fontSize: 16, fontWeight: '700' },
    });
}
