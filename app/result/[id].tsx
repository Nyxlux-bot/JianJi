/**
 * 六爻结果详情页
 * 对应路由: /result/[id]
 * 卦盘页：卦盘卡（翻看变卦、用神提要）+ 动爻或静卦；细批页：四柱、旬空月将月相、神煞、卦辞、时令。
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import StatusBarDecor from '../../src/components/StatusBarDecor';
import ConfirmModal from '../../src/components/ConfirmModal';
import { CustomAlert } from '../../src/components/CustomAlertProvider';
import { CompassIcon } from '../../src/components/Icons';
import HexagramDisplay from '../../src/components/HexagramDisplay';
import LiuShenIcon from '../../src/components/LiuShenIcon';
import WuXingIcon from '../../src/components/WuXingIcon';
import YongleCoin from '../../src/components/YongleCoin';
import GuaXiangBottomSheet from '../../src/components/GuaXiangBottomSheet';
import AIChatModal from '../../src/components/AIChatModal';
import OverflowMenu, { OverflowMenuItem } from '../../src/components/OverflowMenu';
import {
    makeResultChromeStyles, ResultCard, ResultHero, ResultTopBar, type ResultTab,
} from '../../src/components/result/ResultChrome';
import { PanResult } from '../../src/core/liuyao-calc';
import { getLiuQin, type LiuQin, type LiuyaoSubject } from '../../src/core/liuyao-data';
import { analyzeLiuyaoStatus, type LiuyaoMark } from '../../src/core/liuyao-status';
import { getHexagramText, getLineText } from '../../src/core/iching-texts';
import { getMonthGeneralByJieqi, getMoonPhase } from '../../src/core/time-signs';
import { getGanZhiElement } from '../../src/features/bazi/wuxing';
import { getRecord, deleteRecord, getAllRecords, toggleFavorite } from '../../src/db/database';
import { isAIConfigured } from '../../src/services/settings';
import { shareResultMarkdown } from '../../src/services/share';
import { clearAIAnalysisJob } from '../../src/services/ai-analysis-jobs';
import { useTheme } from '../../src/theme/ThemeContext';
import { Spacing } from '../../src/theme/colors';
import { buildResultPalette, type ResultPalette } from '../../src/theme/result-palette';

type Section = 'board' | 'detail';
const TABS: ResultTab<Section>[] = [{ key: 'board', label: '卦盘' }, { key: 'detail', label: '细批' }];
const METHOD_SEAL: Record<string, string> = { time: '时间', coin: '摇卦', number: '数字', manual: '手动' };
const SUBJECT_CHIP: Record<LiuyaoSubject, string> = { male: '男', female: '女', other: '其他' };
const YAO_POS_CN = ['初', '二', '三', '四', '五', '上'];
const YAO_TITLE = (pos: number, isYang: boolean) => (pos === 1 || pos === 6
    ? `${YAO_POS_CN[pos - 1]}${isYang ? '九' : '六'}`
    : `${isYang ? '九' : '六'}${YAO_POS_CN[pos - 1]}`);
const STATE_PCT: Record<string, `${number}%`> = { 旺: '100%', 相: '75%', 休: '50%', 囚: '30%', 死: '15%' };
const CHONG: Record<string, string> = { 子: '午', 午: '子', 丑: '未', 未: '丑', 寅: '申', 申: '寅', 卯: '酉', 酉: '卯', 辰: '戌', 戌: '辰', 巳: '亥', 亥: '巳' };
const HE: Record<string, string> = { 子: '丑', 丑: '子', 寅: '亥', 亥: '寅', 卯: '戌', 戌: '卯', 辰: '酉', 酉: '辰', 巳: '申', 申: '巳', 午: '未', 未: '午' };

/** 静卦看世应：合冲与生克。 */
function describeShiYing(result: PanResult): string {
    const shi = result.benGuaYao.find((yao) => yao.isShi);
    const ying = result.benGuaYao.find((yao) => yao.isYing);
    if (!shi || !ying) return '';
    const parts: string[] = [];
    if (HE[shi.zhi] === ying.zhi) parts.push(`${shi.zhi}${ying.zhi}相合，彼此有意`);
    if (CHONG[shi.zhi] === ying.zhi) parts.push(`${shi.zhi}${ying.zhi}相冲，彼此相背`);
    const relation = getLiuQin(shi.wuxing, ying.wuxing);
    parts.push({
        兄弟: '世应比和，彼此相当',
        子孙: '世生应，我去求人',
        妻财: '世克应，我能制彼',
        父母: '应生世，对方助我',
        官鬼: '应克世，彼来制我',
    }[relation]);
    return `${parts.join('；')}。`;
}

export default function ResultPage() {
    const { Colors } = useTheme();
    const palette = useMemo(() => buildResultPalette(Colors), [Colors]);
    const chrome = useMemo(() => makeResultChromeStyles(palette), [palette]);
    const styles = useMemo(() => makeStyles(palette), [palette]);

    const { id } = useLocalSearchParams<{ id: string }>();
    const [result, setResult] = useState<PanResult | null>(null);
    const [isFavorite, setIsFavorite] = useState(false);
    const [section, setSection] = useState<Section>('board');
    const [yong, setYong] = useState<LiuQin | null>(null);
    const [aiChatVisible, setAiChatVisible] = useState(false);
    const [aiConfigured, setAiConfigured] = useState(false);
    const [deleteModalVisible, setDeleteModalVisible] = useState(false);
    const [sheetVisible, setSheetVisible] = useState(false);
    const [menuVisible, setMenuVisible] = useState(false);
    const [screenState, setScreenState] = useState<'loading' | 'ready' | 'missing'>('loading');

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            if (id) {
                const [detail, summaries] = await Promise.all([getRecord(id), getAllRecords()]);
                if (!cancelled) {
                    if (!detail) {
                        setScreenState('missing');
                    } else if (detail.engineType === 'liuyao') {
                        setResult(detail.result);
                        setScreenState('ready');
                    } else if (detail.engineType === 'ziwei') {
                        router.replace(`/ziwei/result/${id}`);
                        return;
                    } else if (detail.engineType === 'baziCompatibility') {
                        router.replace(`/bazi/match/result/${id}`);
                        return;
                    } else if (detail.engineType === 'meihua') {
                        router.replace(`/meihua/result/${id}`);
                        return;
                    } else {
                        router.replace(`/bazi/result/${id}`);
                        return;
                    }
                    setIsFavorite(Boolean(summaries.find(item => item.id === id)?.isFavorite));
                }
            }
            const configured = await isAIConfigured();
            if (!cancelled) {
                setAiConfigured(configured);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [id]);

    const status = useMemo(() => (result ? analyzeLiuyaoStatus(result) : null), [result]);

    const handleOpenAIChat = () => {
        if (!result) return;
        if (!aiConfigured) {
            CustomAlert.alert('未配置AI', '请先在设置中配置 AI 接口地址和 API Key', [
                { text: '去设置', onPress: () => router.push('/settings') },
                { text: '取消', style: 'cancel' },
            ]);
            return;
        }
        setAiChatVisible(true);
    };

    const confirmDelete = async () => {
        setDeleteModalVisible(false);
        if (id) {
            await clearAIAnalysisJob('liuyao', id);
            await deleteRecord(id);
            router.back();
        }
    };

    const handleToggleFavorite = async () => {
        if (!id) return;
        await toggleFavorite(id);
        setIsFavorite(prev => !prev);
    };

    const handleShare = async () => {
        if (!result) return;
        try {
            await shareResultMarkdown(result);
        } catch (error: any) {
            const message = typeof error?.message === 'string' ? error.message : '导出失败，请稍后重试';
            CustomAlert.alert('分享失败', message);
        }
    };

    const menuItems: OverflowMenuItem[] = [
        { key: 'share', label: '导出分享', onPress: handleShare },
        { key: 'favorite', label: isFavorite ? '取消收藏' : '收藏结果', onPress: handleToggleFavorite },
        { key: 'delete', label: '删除记录', onPress: () => setDeleteModalVisible(true), destructive: true },
    ];

    if (screenState !== 'ready' || !result || !status) {
        return (
            <View style={styles.container}>
                <StatusBarDecor />
                <View style={styles.center}>
                    <Text style={styles.muted}>{screenState === 'missing' ? '记录不存在或已被删除' : '加载中...'}</Text>
                    {screenState === 'missing' ? (
                        <View style={styles.missingActions}>
                            <Pressable onPress={() => router.back()} style={styles.linkBtn}><Text style={styles.linkText}>返回上一页</Text></Pressable>
                            <Pressable onPress={() => router.replace('/history')} style={styles.linkBtn}><Text style={styles.linkText}>去历史记录</Text></Pressable>
                        </View>
                    ) : null}
                </View>
            </View>
        );
    }

    const elementColor = (char: string) => {
        const element = getGanZhiElement(char);
        return element ? palette.element[element] : palette.ink;
    };
    const ganZhi = (text: string) => [...text].map((char, index) => <Text key={index} style={{ color: elementColor(char) }}>{char}</Text>);
    const markText = (marks: LiuyaoMark[]) => marks.map((mark, index) => (
        <Text key={mark.label} style={{ color: mark.tone === 'good' ? Colors.bazi.statePositive : mark.tone === 'bad' ? Colors.bazi.stateNegative : palette.muted }}>
            {index > 0 ? ' · ' : ''}{mark.label}
        </Text>
    ));

    const shiYao = result.benGuaYao.find((yao) => yao.isShi);
    const activeYong: LiuQin = yong ?? shiYao?.liuQin ?? '官鬼';
    const benLines = result.benGuaYao.map((yao) => (yao.nature === 'yang' ? 1 : 0));
    const bianLines = result.bianGuaYao?.map((yao) => (yao.nature === 'yang' ? 1 : 0));
    const benText = getHexagramText({ lines: benLines });
    const bianText = bianLines ? getHexagramText({ lines: bianLines }) : null;
    const movingYao = [...result.movingYaoPositions].sort((a, b) => b - a).map((pos) => result.benGuaYao[pos - 1]);
    const monthGeneral = result.monthGeneral || getMonthGeneralByJieqi(result.jieqi?.current || '', result.monthGanZhi?.[1]);
    const createdAt = new Date(result.createdAt);
    const moonPhase = getMoonPhase(Number.isNaN(createdAt.getTime()) ? new Date() : createdAt, result.lunarInfo?.day);
    const shenSha = result.shenSha ? [
        ['驿马', result.shenSha.yiMa], ['桃花', result.shenSha.taoHua], ['天乙', result.shenSha.tianYiGuiRen?.join('')],
        ['禄神', result.shenSha.luShen], ['羊刃', result.shenSha.yangRen], ['文昌', result.shenSha.wenChang],
        ['将星', result.shenSha.jiangXing], ['华盖', result.shenSha.huaGai], ['劫煞', result.shenSha.jieSha], ['灾煞', result.shenSha.zaiSha],
    ] : [];
    const pillars = [
        { label: '年柱', ganZhi: result.yearGanZhi, naYin: result.yearNaYin },
        { label: '月柱', ganZhi: result.monthGanZhi, naYin: result.monthNaYin },
        { label: '日柱', ganZhi: result.dayGanZhi, naYin: result.dayNaYin, main: true },
        { label: '时柱', ganZhi: result.hourGanZhi, naYin: result.hourNaYin },
    ];

    return (
        <View style={styles.container}>
            <StatusBarDecor backgroundColor={palette.card} />
            <ResultTopBar
                tabs={TABS} active={section} onTab={setSection}
                aiLabel="AI 解卦" aiDisabled={!aiConfigured} onAI={handleOpenAIChat}
                onMore={() => setMenuVisible((prev) => !prev)}
                extra={(
                    <Pressable onPress={() => setSheetVisible(true)} style={({ pressed }) => [chrome.iconBtn, pressed && chrome.pressed]} accessibilityRole="button" accessibilityLabel="查阅互错综卦">
                        <CompassIcon size={20} color={palette.icon} />
                    </Pressable>
                )}
                styles={chrome} palette={palette}
            />
            <OverflowMenu visible={menuVisible} top={54} right={Spacing.lg} items={menuItems} onClose={() => setMenuVisible(false)} />

            <ResultHero
                title={result.question?.trim() || result.benGua.fullName}
                seal={METHOD_SEAL[result.method] || result.method}
                chip={result.subject ? SUBJECT_CHIP[result.subject] : undefined}
                styles={chrome}
                art={(
                    <View style={[chrome.heroArt, styles.coins]}>
                        <YongleCoin face="back" size={76} style={[styles.coin, { right: 54, top: 2, transform: [{ rotate: '-12deg' }] }]} />
                        <YongleCoin face="front" size={84} style={[styles.coin, { right: 0, top: 34, transform: [{ rotate: '16deg' }] }]} />
                    </View>
                )}
                rows={[
                    { label: '公历', value: `${result.solarDate} ${result.solarTime}${result.trueSolarTime ? ` · 真太阳时 ${result.trueSolarTime}` : ''}` },
                    { label: '农历', value: `${result.lunarInfo.yearGanZhi}年 ${result.lunarInfo.lunarMonthCN}${result.lunarInfo.lunarDayCN} ${result.lunarInfo.hourZhi}时` },
                    {
                        label: '节气', value: (
                            <Text style={chrome.heroRowValue} numberOfLines={1}>
                                <Text style={{ color: palette.vermilion }}>{result.jieqi.current}</Text> {result.jieqi.currentDate}
                                <Text style={{ color: palette.muted }}> · 下节 {result.jieqi.next} {result.jieqi.nextDate}</Text>
                            </Text>
                        ),
                    },
                    {
                        label: '四柱', value: (
                            <Text style={chrome.heroRowValue} numberOfLines={1}>
                                <Text style={styles.pillarText}>{[result.yearGanZhi, result.monthGanZhi, result.dayGanZhi, result.hourGanZhi].map((item, index) => <Text key={index}>{index > 0 ? ' ' : ''}{ganZhi(item)}</Text>)}</Text>
                                <Text style={{ color: palette.muted }}> · 旬空 </Text>
                                <Text style={styles.pillarText}>{ganZhi(result.xunKong.join(''))}</Text>
                            </Text>
                        ),
                    },
                ]}
            />

            <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
                {section === 'board' ? (
                    <>
                        <HexagramDisplay result={result} status={status} yong={activeYong} onYongChange={setYong} />
                        {movingYao.length > 0 ? (
                            <ResultCard title="动爻" meta={`${movingYao.map((yao) => `${YAO_POS_CN[yao.position - 1]}爻`).join('、')}发动`} styles={chrome}>
                                <View style={styles.list}>
                                    {movingYao.map((yao) => {
                                        const yaoStatus = status.yao[yao.position - 1];
                                        return (
                                            <View key={yao.position} style={styles.movingRow}>
                                                <Text style={styles.movingTitle}>{YAO_TITLE(yao.position, yao.nature === 'yang')}</Text>
                                                <View style={styles.flex}>
                                                    <View style={styles.inline}>
                                                        <LiuShenIcon liuShen={yao.liuShen} size={16} />
                                                        <Text style={[styles.inlineText, styles.shenName]}>{yao.liuShen}</Text>
                                                        <Text style={styles.inlineText}>{yao.liuQin}</Text>
                                                        <WuXingIcon element={yao.zhi} size={14} />
                                                        <Text style={[styles.inlineZhi, { color: elementColor(yao.zhi) }]}>{yao.zhi}</Text>
                                                        {yao.bianZhi ? (
                                                            <>
                                                                <Text style={styles.inlineMuted}>化</Text>
                                                                <Text style={styles.inlineText}>{yao.bianLiuQin}</Text>
                                                                <WuXingIcon element={yao.bianZhi} size={14} />
                                                                <Text style={[styles.inlineZhi, { color: elementColor(yao.bianZhi) }]}>{yao.bianZhi}</Text>
                                                            </>
                                                        ) : null}
                                                    </View>
                                                    {yaoStatus.marks.length + yaoStatus.transform.length > 0 ? (
                                                        <Text style={styles.notes}>{markText([...yaoStatus.marks, ...yaoStatus.transform])}</Text>
                                                    ) : null}
                                                    <Text style={styles.scripture}>{getLineText({ lines: benLines }, yao.position).scripture}</Text>
                                                </View>
                                            </View>
                                        );
                                    })}
                                </View>
                            </ResultCard>
                        ) : (
                            <ResultCard title="静卦" meta="六爻安静，看用神旺衰与世应" styles={chrome}>
                                <View style={styles.list}>
                                    <View style={styles.textRow}>
                                        <Text style={styles.textLabel}>世应</Text>
                                        <Text style={styles.textBody}>{describeShiYing(result)}</Text>
                                    </View>
                                    <View style={styles.textRow}>
                                        <Text style={styles.textLabel}>本 · {result.benGua.name}</Text>
                                        <Text style={styles.textScripture}>{benText.scripture}</Text>
                                    </View>
                                    <View style={styles.textRow}>
                                        <Text style={styles.textLabel}>象</Text>
                                        <Text style={styles.textBody}>{benText.xiang}</Text>
                                    </View>
                                </View>
                            </ResultCard>
                        )}
                    </>
                ) : (
                    <>
                        <ResultCard title="四柱" styles={chrome}>
                            <View style={styles.pillarTable}>
                                <View style={styles.pillarLabels}>
                                    <View style={styles.pillarHead} />
                                    <Text style={[styles.rowLabel, styles.pillarCell]}>天干</Text>
                                    <Text style={[styles.rowLabel, styles.pillarCell]}>地支</Text>
                                    <Text style={[styles.rowLabel, styles.nayinCell]}>纳音</Text>
                                </View>
                                {pillars.map((pillar) => (
                                    <View key={pillar.label} style={[styles.pillarCol, pillar.main && styles.pillarMain]}>
                                        <Text style={[styles.pillarHead, styles.colHead, pillar.main && styles.colHeadMain]}>{pillar.label}</Text>
                                        {[pillar.ganZhi[0], pillar.ganZhi[1]].map((char, index) => (
                                            <View key={index} style={[styles.pillarCell, styles.pillarCharCell]}>
                                                <WuXingIcon element={char} size={16} />
                                                <Text style={[styles.pillarChar, { color: elementColor(char) }]}>{char}</Text>
                                            </View>
                                        ))}
                                        <Text style={[styles.nayinCell, styles.nayin]}>{pillar.naYin}</Text>
                                    </View>
                                ))}
                            </View>
                        </ResultCard>

                        <ResultCard title="旬空 · 月将 · 月相" styles={chrome}>
                            <View style={styles.metaRow}>
                                <View style={styles.metaCell}>
                                    <Text style={styles.metaLabel}>旬空</Text>
                                    <Text style={styles.metaValue}>{ganZhi(result.xunKong.join(' '))}</Text>
                                </View>
                                <View style={styles.metaCellWide}>
                                    <Text style={styles.metaLabel}>月将</Text>
                                    <Text style={[styles.metaValue, { color: palette.gold }]}>{`${monthGeneral.zhi}将 · ${monthGeneral.name}`}</Text>
                                    <Text style={styles.metaHint}>{`依据节气：${monthGeneral.basedOnTerm}`}</Text>
                                </View>
                                <View style={styles.metaCellWide}>
                                    <Text style={styles.metaLabel}>月相</Text>
                                    <Text style={[styles.metaValue, { color: palette.gold }]}>{moonPhase.name}</Text>
                                    <Text style={styles.metaHint}>{`月龄 ${moonPhase.ageDays.toFixed(1)} 天 · 亮度 ${moonPhase.illuminationPct}%`}</Text>
                                </View>
                            </View>
                        </ResultCard>

                        {shenSha.length > 0 ? (
                            <ResultCard title="神煞" styles={chrome}>
                                <View style={styles.shenShaGrid}>
                                    {shenSha.map(([label, value], index) => (
                                        <View key={label} style={[styles.shenShaCell, index >= 5 && styles.shenShaRule]}>
                                            <Text style={styles.metaLabel}>{label}</Text>
                                            <Text style={styles.shenShaValue}>{value ? ganZhi(value) : '无'}</Text>
                                        </View>
                                    ))}
                                </View>
                            </ResultCard>
                        ) : null}

                        <ResultCard title="卦辞" styles={chrome}>
                            <View style={styles.list}>
                                <View style={styles.textRow}>
                                    <Text style={styles.textLabel}>本 · {result.benGua.name}</Text>
                                    <Text style={styles.textScripture}>{benText.scripture}</Text>
                                </View>
                                <View style={styles.textRow}>
                                    <Text style={styles.textLabel}>象</Text>
                                    <Text style={styles.textBody}>{benText.xiang}</Text>
                                </View>
                                {result.bianGua && bianText ? (
                                    <>
                                        <View style={styles.textRow}>
                                            <Text style={styles.textLabel}>变 · {result.bianGua.name}</Text>
                                            <Text style={styles.textScripture}>{bianText.scripture}</Text>
                                        </View>
                                        <View style={styles.textRow}>
                                            <Text style={styles.textLabel}>象</Text>
                                            <Text style={styles.textBody}>{bianText.xiang}</Text>
                                        </View>
                                    </>
                                ) : null}
                            </View>
                        </ResultCard>

                        <ResultCard title="时令" meta={`${result.monthGanZhi[1]}月 · ${result.dayGanZhi[1]}日`} styles={chrome}>
                            <View style={styles.seasonList}>
                                {status.season.map((row) => (
                                    <View key={row.wuxing} style={styles.seasonRow}>
                                        <WuXingIcon element={row.wuxing} size={16} />
                                        <Text style={[styles.seasonWx, { color: palette.element[row.wuxing] }]}>{row.wuxing}</Text>
                                        <View style={styles.bar}><View style={[styles.barFill, { width: STATE_PCT[row.state], backgroundColor: palette.element[row.wuxing] }]} /></View>
                                        <Text style={styles.seasonState}>{row.state}</Text>
                                        <Text style={styles.seasonHolders} numberOfLines={1}>{row.holders.join(' ')}</Text>
                                    </View>
                                ))}
                            </View>
                        </ResultCard>
                    </>
                )}
            </ScrollView>

            <ConfirmModal
                visible={deleteModalVisible}
                title="删除记录"
                message="确定要删除此排盘记录吗？删除后将无法恢复。"
                confirmText="删除"
                destructive={true}
                onConfirm={confirmDelete}
                onCancel={() => setDeleteModalVisible(false)}
            />

            {/* 半屏互错综卦象查阅抽屉 */}
            <GuaXiangBottomSheet
                visible={sheetVisible}
                onClose={() => setSheetVisible(false)}
                baseHexagramArray={benLines}
            />

            {/* AI 沉浸式对话弹窗 */}
            <AIChatModal
                visible={aiChatVisible}
                onClose={() => setAiChatVisible(false)}
                result={result}
                onUpdateResult={(updatedResult) => {
                    setResult(updatedResult as PanResult);
                }}
            />
        </View>
    );
}

function makeStyles(palette: ResultPalette) {
    return StyleSheet.create({
        container: { flex: 1, backgroundColor: palette.page },
        center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
        muted: { fontSize: 13, color: palette.muted },
        missingActions: { flexDirection: 'row', gap: 16 },
        linkBtn: { paddingHorizontal: 12, paddingVertical: 8 },
        linkText: { fontSize: 14, color: palette.gold },
        coins: { right: -10, top: 10, width: 150, height: 120, opacity: 0.5 },
        coin: { position: 'absolute' },
        pillarText: { fontWeight: '600', letterSpacing: 1 },
        body: { flex: 1 },
        bodyContent: { padding: 12, gap: 10, paddingBottom: 24 },
        flex: { flex: 1 },
        list: { marginTop: 8, gap: 10 },
        movingRow: { flexDirection: 'row', gap: 8 },
        movingTitle: { width: 36, fontSize: 13, lineHeight: 22, fontWeight: '700', color: palette.vermilion },
        inline: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 3 },
        inlineText: { fontSize: 13, lineHeight: 22, color: palette.body },
        shenName: { marginRight: 4 },
        inlineMuted: { fontSize: 13, lineHeight: 22, color: palette.muted, marginHorizontal: 3 },
        inlineZhi: { fontSize: 16, lineHeight: 22, fontWeight: '700' },
        notes: { fontSize: 12, lineHeight: 18 },
        scripture: { fontSize: 13, lineHeight: 20, color: palette.muted },
        textRow: { flexDirection: 'row', gap: 8 },
        textLabel: { width: 56, fontSize: 12, lineHeight: 21, color: palette.muted },
        textScripture: { flex: 1, fontSize: 13.5, lineHeight: 21, color: palette.ink },
        textBody: { flex: 1, fontSize: 13, lineHeight: 21, color: palette.body },
        pillarTable: { flexDirection: 'row', marginTop: 6 },
        pillarLabels: { width: 36 },
        pillarCol: { flex: 1, borderRadius: 10 },
        pillarMain: { backgroundColor: palette.dayTint },
        pillarHead: { height: 26, lineHeight: 26, textAlign: 'center' },
        colHead: { fontSize: 12, color: palette.muted },
        colHeadMain: { fontWeight: '600', color: palette.ink },
        rowLabel: { fontSize: 11, color: palette.muted },
        pillarCell: { height: 44, lineHeight: 44 },
        pillarCharCell: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
        pillarChar: { fontSize: 28, lineHeight: 36, fontWeight: '700' },
        nayinCell: { height: 32, lineHeight: 32, borderTopWidth: 1, borderTopColor: palette.hairline },
        nayin: { textAlign: 'center', fontSize: 13, color: palette.body },
        metaRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
        metaCell: { flex: 1 },
        metaCellWide: { flex: 1.3 },
        metaLabel: { fontSize: 11, lineHeight: 15, color: palette.muted },
        metaValue: { fontSize: 16, lineHeight: 24, fontWeight: '700', color: palette.heading },
        metaHint: { fontSize: 11, lineHeight: 15, color: palette.muted },
        shenShaGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
        shenShaCell: { width: '20%', alignItems: 'center', paddingVertical: 6 },
        shenShaRule: { borderTopWidth: 1, borderTopColor: palette.hairline },
        shenShaValue: { fontSize: 15, lineHeight: 21, fontWeight: '700', color: palette.heading },
        seasonList: { marginTop: 8, gap: 6 },
        seasonRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
        seasonWx: { width: 16, fontSize: 12.5, fontWeight: '700' },
        bar: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden', backgroundColor: palette.barTrack },
        barFill: { height: '100%' },
        seasonState: { width: 18, fontSize: 12.5, fontWeight: '600', color: palette.heading },
        seasonHolders: { width: 110, fontSize: 12, color: palette.muted },
    });
}
