import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
} from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { router, useLocalSearchParams } from 'expo-router';
import StatusBarDecor from '../../../../src/components/StatusBarDecor';
import { CloseIcon } from '../../../../src/components/Icons';
import ConfirmModal from '../../../../src/components/ConfirmModal';
import OverflowMenu, { OverflowMenuItem } from '../../../../src/components/OverflowMenu';
import { CustomAlert } from '../../../../src/components/CustomAlertProvider';
import PairArcChart from '../../../../src/components/PairArcChart';
import WuXingIcon from '../../../../src/components/WuXingIcon';
import { makeResultChromeStyles, ResultCard, type ResultChromeStyles, ResultTopBar, type ResultTab } from '../../../../src/components/result/ResultChrome';
import { TIANGAN_WUXING } from '../../../../src/core/liuyao-data';
import { BaziCompatibilityResult, BaziMatchDimensionScore, BaziMatchProfile } from '../../../../src/features/bazi/match/types';
import { formatCanProceed, getBaziMatchReview, getDisplayMarriageYears } from '../../../../src/features/bazi/match/formatter';
import { getBaziMatchClassicRefs, getBaziMatchDimensionReferenceFallbackIds } from '../../../../src/features/bazi/match/classic-references';
import type { BaziMatchClassicReferenceId } from '../../../../src/features/bazi/match/classic-references';
import {
    buildMutualView,
    buildPairLinks,
    getDisplayDimensions,
    getMatchDirectionLabel,
    getMatchRelation,
    getMatchSides,
} from '../../../../src/features/bazi/match/pair';
import { getGanZhiElement, WUXING_ORDER, WuXingElement } from '../../../../src/features/bazi/wuxing';
import { deleteRecord, getRecord, toggleFavorite } from '../../../../src/db/database';
import { clearAIAnalysisJob } from '../../../../src/services/ai-analysis-jobs';
import AIChatModal from '../../../../src/components/AIChatModal';
import { isAIConfigured } from '../../../../src/services/settings';
import { buildResultPalette, ResultPalette } from '../../../../src/theme/result-palette';
import { useTheme } from '../../../../src/theme/ThemeContext';

type MatchView = 'overview' | 'detail';
const OVERVIEW_TAB: ResultTab<MatchView> = { key: 'overview', label: '总览' };
const DETAIL_TAB: ResultTab<MatchView> = { key: 'detail', label: '详断' };

// ResultCard 左右内边距 14 + 1px 边框
const CARD_INSET = 30;

const EFFECT_TAG = { positive: '吉', negative: '忌', neutral: '平' } as const;
const CN_DIGIT = '〇一二三四五六七八九';

function getDimensionReferenceIds(dimension: BaziMatchDimensionScore): BaziMatchClassicReferenceId[] {
    const evidenceIds = dimension.evidence.flatMap((item) => item.referenceIds || []);
    return [...new Set(evidenceIds.length > 0 ? evidenceIds : getBaziMatchDimensionReferenceFallbackIds(dimension.key))];
}

function dayMasterText(profile: BaziMatchProfile): string {
    return `${profile.dayStem}${TIANGAN_WUXING[profile.dayStem] ?? ''}日主`;
}

function complementText(me: BaziMatchProfile, ta: BaziMatchProfile): string {
    // 与五行图同口径：首要所需之行（图上标「需」的那一行），对方计数多于自己即算补上
    const gives = (from: BaziMatchProfile, to: BaziMatchProfile) =>
        to.neededElements.slice(0, 1).filter((element) => (from.elementCounts[element] ?? 0) > (to.elementCounts[element] ?? 0));
    const parts = [
        ...gives(ta, me).map((element) => `你需${element}，TA ${element} ${ta.elementCounts[element]} 正好补上`),
        ...gives(me, ta).map((element) => `TA 需${element}，你${element} ${me.elementCounts[element]} 能补益`),
    ];
    return parts.length ? `${parts.join('；')}。` : '两人五行互补信号不明显。';
}

export default function BaziMatchResultPage() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const { Colors } = useTheme();
    const palette = useMemo(() => buildResultPalette(Colors), [Colors]);
    const chrome = useMemo(() => makeResultChromeStyles(palette), [palette]);
    const styles = useMemo(() => makeStyles(palette, Colors), [palette, Colors]);
    const { width } = useWindowDimensions();
    const mountedRef = useRef(true);
    const [result, setResult] = useState<BaziCompatibilityResult | null>(null);
    const [screenState, setScreenState] = useState<'loading' | 'ready' | 'missing'>('loading');
    const [view, setView] = useState<MatchView>('overview');
    const [aiConfigured, setAiConfigured] = useState(false);
    const [aiVisible, setAiVisible] = useState(false);
    const [referenceIds, setReferenceIds] = useState<BaziMatchClassicReferenceId[]>([]);
    const [menuVisible, setMenuVisible] = useState(false);
    const [deleteVisible, setDeleteVisible] = useState(false);
    const [isFavorite, setIsFavorite] = useState(false);

    const derived = useMemo(() => {
        if (!result) return null;
        const { me, ta } = getMatchSides(result);
        return {
            me,
            ta,
            relation: getMatchRelation(result),
            directionLabel: getMatchDirectionLabel(result),
            dimensions: getDisplayDimensions(result),
            links: buildPairLinks(me, ta),
            mutual: buildMutualView(me, ta),
            marriageYears: getDisplayMarriageYears(result),
            review: result.dimensions.length ? getBaziMatchReview(result).review : null,
            meIsMale: (result.self ?? 'male') === 'male',
        };
    }, [result]);

    const load = useCallback(async () => {
        if (!id) {
            return;
        }
        const [detail, configured] = await Promise.all([getRecord(id), isAIConfigured()]);
        if (!mountedRef.current) {
            return;
        }
        setAiConfigured(configured);
        if (!detail) {
            setScreenState('missing');
            return;
        }
        if (detail.engineType !== 'baziCompatibility') {
            if (detail.engineType === 'bazi') {
                router.replace(`/bazi/result/${id}`);
                return;
            }
            if (detail.engineType === 'ziwei') {
                router.replace(`/ziwei/result/${id}`);
                return;
            }
            router.replace(`/result/${id}`);
            return;
        }
        setResult(detail.result);
        setIsFavorite(detail.isFavorite);
        setScreenState('ready');
    }, [id]);

    useEffect(() => {
        mountedRef.current = true;
        void load();
        return () => {
            mountedRef.current = false;
        };
    }, [load]);

    // The AI page owns generation, streaming and failure display for 合盘 too.
    const handleAI = () => {
        if (!result) {
            return;
        }
        if (!aiConfigured) {
            CustomAlert.alert('尚未配置', '请先在设置中配置接口地址和 API Key', [
                { text: '去设置', onPress: () => router.push('/settings') },
                { text: '取消', style: 'cancel' },
            ]);
            return;
        }
        setAiVisible(true);
    };

    const handleToggleFavorite = async () => {
        if (!id) return;
        await toggleFavorite(id);
        setIsFavorite((prev) => !prev);
    };

    const handleDelete = async () => {
        if (!id) return;
        setDeleteVisible(false);
        await clearAIAnalysisJob('baziCompatibility', id);
        await deleteRecord(id);
        router.back();
    };

    const menuItems: OverflowMenuItem[] = [
        { key: 'favorite', label: isFavorite ? '取消收藏' : '收藏合盘', onPress: handleToggleFavorite },
        { key: 'delete', label: '删除合盘', onPress: () => setDeleteVisible(true), destructive: true },
    ];

    if (screenState === 'loading') {
        return (
            <View style={styles.container}>
                <StatusBarDecor />
                <View style={styles.center}><Text style={styles.centerText}>加载中...</Text></View>
            </View>
        );
    }

    if (screenState === 'missing' || !result || !derived) {
        return (
            <View style={styles.container}>
                <StatusBarDecor />
                <View style={styles.center}><Text style={styles.centerText}>合盘记录不存在或已被删除</Text></View>
            </View>
        );
    }

    const contentWidth = Math.min(width - 32, 560);
    const { me, ta, relation, directionLabel, dimensions, links, mutual, marriageYears, review, meIsMale } = derived;
    const isLove = relation.key === 'love';
    const hasScore = dimensions.length > 0;
    const tabs = hasScore ? [OVERVIEW_TAB, DETAIL_TAB] : [OVERVIEW_TAB];
    const dayBranchLink = links.find((link) => link.layer === 'branch' && link.me === 2 && link.ta === 2);
    const heroLine = review
        ? `${formatCanProceed(review.canProceed)}。${review.mainConflict}`
        : `${mutual.link}：TA 是你的${mutual.taToMe}，你是 TA 的${mutual.meToTa}${dayBranchLink ? `；日支${dayBranchLink.name}` : ''}。`;

    return (
        <View style={styles.container}>
            <StatusBarDecor />
            <ResultTopBar
                tabs={tabs}
                active={hasScore ? view : 'overview'}
                onTab={setView}
                aiLabel={isLove ? 'AI 合盘' : ''}
                aiDisabled={!aiConfigured}
                onAI={handleAI}
                onMore={() => setMenuVisible((prev) => !prev)}
                styles={chrome}
                palette={palette}
            />
            <OverflowMenu visible={menuVisible} top={54} right={16} items={menuItems} onClose={() => setMenuVisible(false)} />

            <ScrollView style={styles.content} contentContainerStyle={styles.contentBody} showsVerticalScrollIndicator={false}>
                <View style={styles.hero}>
                    <View style={styles.heroMain}>
                        <View style={styles.heroNameRow}>
                            <Text style={styles.heroName} numberOfLines={1}>{me.name} × {ta.name}</Text>
                            <View style={chrome.seal}><Text style={chrome.sealText}>{relation.name}</Text></View>
                        </View>
                        <Text style={styles.heroWho}>我 · {dayMasterText(me)}　TA · {dayMasterText(ta)}{directionLabel ? `　${directionLabel}` : ''}</Text>
                        <Text style={styles.heroLine} numberOfLines={3}>{heroLine}</Text>
                    </View>
                    {hasScore ? <ScoreGauge score={result.totalScore} grade={result.grade} palette={palette} styles={styles} /> : null}
                </View>

                <View style={{ width: contentWidth, alignSelf: 'center' }}>
                    {view === 'overview' || !hasScore ? (
                        <>
                            <ResultCard title="两盘" meta="八柱一行 · 上为天干 下为地支" styles={chrome} style={styles.card}>
                                <View style={styles.chart}>
                                    <PairArcChart me={me} ta={ta} links={links} width={contentWidth - CARD_INSET} palette={palette} />
                                </View>
                                <View style={styles.legend}>
                                    <LegendLine color={palette.positive} label="合 · 生" styles={styles} />
                                    <LegendLine color={palette.negative} dash="4,3" label="冲 · 克 · 刑 · 害" styles={styles} />
                                    <Text style={styles.legendText}>箭头指向受生、受克的一方</Text>
                                </View>
                            </ResultCard>

                            <ResultCard title="互看" meta="以日干论十神" styles={chrome} style={styles.card}>
                                <View style={styles.mutual}>
                                    <View style={styles.mutualCol}>
                                        <Text style={styles.mutualLabel}>TA 之于你</Text>
                                        <Text style={styles.mutualStar}>{mutual.taToMe}</Text>
                                        <Text style={styles.mutualGist}>{mutual.taToMeGist}</Text>
                                    </View>
                                    <View style={[styles.mutualCol, styles.mutualRight]}>
                                        <Text style={styles.mutualLabel}>你之于 TA</Text>
                                        <Text style={styles.mutualStar}>{mutual.meToTa}</Text>
                                        <Text style={styles.mutualGist}>{mutual.meToTaGist}</Text>
                                    </View>
                                </View>
                                <Text style={styles.caption}>{mutual.link}。</Text>
                            </ResultCard>

                            <ResultCard title="五行" meta="干支本气计数" styles={chrome} style={styles.card}>
                                <ElementButterfly me={me} ta={ta} palette={palette} styles={styles} />
                                <Text style={styles.caption}>{complementText(me, ta)}</Text>
                            </ResultCard>

                            {hasScore ? (
                                <Pressable onPress={() => setView('detail')} style={({ pressed }) => pressed && styles.pressed} accessibilityRole="button" accessibilityLabel={`查看${relation.name}各维详断`}>
                                    <ResultCard title={`${relation.name}${CN_DIGIT[dimensions.length] ?? ''}维`} meta="点开看依据" styles={chrome} style={styles.card}>
                                        <View style={styles.cardBody}>
                                            {dimensions.map((dimension, index) => (
                                                <View key={dimension.key} style={[styles.dim, index > 0 && styles.rowSep]}>
                                                    <View style={styles.dimHead}>
                                                        <Text style={styles.dimTitle}>{dimension.title}</Text>
                                                        <View style={styles.track}><View style={[styles.trackFill, { width: `${Math.max(0, Math.min(100, dimension.score))}%` as const }]} /></View>
                                                        <Text style={styles.dimScore}>{dimension.score}</Text>
                                                        <Text style={styles.dimGrade}>{dimension.grade}</Text>
                                                    </View>
                                                    <Text style={styles.dimWhy} numberOfLines={1}>{dimension.evidence[0]?.detail ?? dimension.summary}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    </ResultCard>
                                </Pressable>
                            ) : null}

                            {isLove ? (
                                <ResultCard title="婚期" meta="两盘同年应期 · 仅作参考" styles={chrome} style={styles.card}>
                                    {marriageYears.length === 0 ? (
                                        <Text style={styles.emptyText}>两盘近年未见同年应期，暂不定具体婚年。</Text>
                                    ) : (
                                        <View style={styles.cardBody}>
                                            {marriageYears.map((item, index) => {
                                                const myAge = meIsMale ? item.maleAge : item.femaleAge;
                                                const taAge = meIsMale ? item.femaleAge : item.maleAge;
                                                return (
                                                    <View key={`${item.year}-${item.kind}`} style={[styles.yearRow, index > 0 && styles.rowSep]}>
                                                        <View style={styles.yearHead}>
                                                            <Text style={styles.yearText}>{item.year}</Text>
                                                            <GanZhi text={item.ganZhi} palette={palette} styles={styles} />
                                                            <View style={[styles.tag, { backgroundColor: index === 0 ? palette.goldSoft : palette.chipBg }]}>
                                                                <Text style={[styles.tagText, { color: index === 0 ? palette.gold : palette.chipInk }]}>{index === 0 ? '主应期' : '备选'}</Text>
                                                            </View>
                                                            {myAge && taAge ? <Text style={styles.yearAge}>我 {myAge} · TA {taAge}</Text> : null}
                                                        </View>
                                                        <Text style={styles.yearReason}>{item.reasons.slice(0, 3).join('；')}</Text>
                                                    </View>
                                                );
                                            })}
                                        </View>
                                    )}
                                </ResultCard>
                            ) : null}
                            <Text style={styles.fine}>{hasScore ? '契合度与断语出自本地规则，只作参考' : `${relation.name}的评分与时机规则还在写，先看两盘与互看`}</Text>
                        </>
                    ) : (
                        <>
                            {review ? <Text style={styles.basis}>{review.scoreReview}</Text> : null}
                            {dimensions.map((dimension) => (
                                <DimensionDetail
                                    key={dimension.key}
                                    dimension={dimension}
                                    onOpenReferences={isLove ? () => setReferenceIds(getDimensionReferenceIds(dimension)) : undefined}
                                    palette={palette}
                                    chrome={chrome}
                                    styles={styles}
                                />
                            ))}
                        </>
                    )}
                </View>
            </ScrollView>

            <ClassicReferenceSheet
                visible={referenceIds.length > 0}
                referenceIds={referenceIds}
                onClose={() => setReferenceIds([])}
                palette={palette}
                styles={styles}
            />

            <AIChatModal
                visible={aiVisible}
                onClose={() => setAiVisible(false)}
                result={result}
                onUpdateResult={(next) => setResult(next as BaziCompatibilityResult)}
            />

            <ConfirmModal
                visible={deleteVisible}
                title="删除合盘"
                message="确定要删除这条合盘记录吗？删除后将无法恢复。"
                confirmText="删除"
                destructive
                onConfirm={handleDelete}
                onCancel={() => setDeleteVisible(false)}
            />
        </View>
    );
}

type Styles = ReturnType<typeof makeStyles>;

const GanZhi: React.FC<{ text: string; palette: ResultPalette; styles: Styles }> = ({ text, palette, styles }) => (
    <Text style={styles.yearGz}>
        {Array.from(text).map((char, index) => {
            const element = getGanZhiElement(char);
            return <Text key={`${char}-${index}`} style={{ color: element ? palette.element[element] : palette.ink }}>{char}</Text>;
        })}
    </Text>
);

const LegendLine: React.FC<{ color: string; label: string; dash?: string; styles: Styles }> = ({ color, label, dash, styles }) => (
    <View style={styles.legendItem}>
        <Svg width={16} height={4}>
            <Line x1={1} y1={2} x2={15} y2={2} stroke={color} strokeWidth={2} strokeLinecap="round" strokeDasharray={dash} />
        </Svg>
        <Text style={styles.legendText}>{label}</Text>
    </View>
);

const ScoreGauge: React.FC<{ score: number; grade: string; palette: ResultPalette; styles: Styles }> = ({ score, grade, palette, styles }) => {
    const r = 30;
    const circumference = 2 * Math.PI * r;
    const ratio = Math.max(0, Math.min(1, score / 100));
    return (
        <View style={styles.gaugeWrap} accessible accessibilityRole="image" accessibilityLabel={`契合度 ${score}，${grade}`}>
            <View style={styles.gauge}>
                <Svg width={84} height={84} style={StyleSheet.absoluteFill}>
                    <Path d="M42 2 L42 6 M82 42 L78 42 M42 82 L42 78 M2 42 L6 42" stroke={palette.goldBorder} strokeWidth={1} />
                    <Circle cx={42} cy={42} r={r} fill="none" stroke={palette.barTrack} strokeWidth={5} />
                    <Circle
                        cx={42} cy={42} r={r} fill="none" stroke={palette.gold} strokeWidth={5} strokeLinecap="round"
                        strokeDasharray={`${(circumference * ratio).toFixed(2)},${circumference.toFixed(2)}`}
                        transform="rotate(-90 42 42)"
                    />
                </Svg>
                <Text style={styles.gaugeScore}>{score}</Text>
                <Text style={styles.gaugeGrade}>{grade}</Text>
            </View>
            <Text style={styles.gaugeLabel}>契合度</Text>
        </View>
    );
};

const ElementButterfly: React.FC<{ me: BaziMatchProfile; ta: BaziMatchProfile; palette: ResultPalette; styles: Styles }> = ({ me, ta, palette, styles }) => {
    const max = Math.max(3, ...WUXING_ORDER.map((element) => Math.max(me.elementCounts[element] ?? 0, ta.elementCounts[element] ?? 0)));
    const meNeed = me.neededElements[0];
    const taNeed = ta.neededElements[0];
    return (
        <View
            style={styles.bf}
            accessible
            accessibilityRole="image"
            accessibilityLabel={`五行计数，你：${WUXING_ORDER.map((e) => `${e}${me.elementCounts[e] ?? 0}`).join('')}；TA：${WUXING_ORDER.map((e) => `${e}${ta.elementCounts[e] ?? 0}`).join('')}`}
        >
            <View style={styles.bfHead}>
                <Text style={[styles.bfHeadText, { textAlign: 'right' }]}>{me.name} · 我</Text>
                <View style={styles.bfIcon} />
                <Text style={styles.bfHeadText}>{ta.name} · TA</Text>
            </View>
            {WUXING_ORDER.map((element: WuXingElement) => {
                const mine = me.elementCounts[element] ?? 0;
                const theirs = ta.elementCounts[element] ?? 0;
                const color = palette.element[element];
                return (
                    <View key={element} style={styles.bfRow}>
                        <View style={styles.bfNumLeft}>
                            {meNeed === element ? <Text style={styles.need}>我需</Text> : null}
                            <Text style={styles.bfNum}>{mine}</Text>
                        </View>
                        <View style={[styles.bfTrack, { justifyContent: 'flex-end' }]}>
                            {mine > 0 ? <View style={[styles.bfBar, { width: `${(mine / max) * 100}%` as const, backgroundColor: color }]} /> : null}
                        </View>
                        <View style={styles.bfIcon}><WuXingIcon element={element} size={26} /></View>
                        <View style={styles.bfTrack}>
                            {theirs > 0 ? <View style={[styles.bfBar, { width: `${(theirs / max) * 100}%` as const, backgroundColor: color }]} /> : null}
                        </View>
                        <View style={styles.bfNumRight}>
                            <Text style={styles.bfNum}>{theirs}</Text>
                            {taNeed === element ? <Text style={styles.need}>TA 需</Text> : null}
                        </View>
                    </View>
                );
            })}
        </View>
    );
};

const DimensionDetail: React.FC<{
    dimension: BaziMatchDimensionScore;
    onOpenReferences?: () => void;
    palette: ResultPalette;
    chrome: ResultChromeStyles;
    styles: Styles;
}> = ({ dimension, onOpenReferences, palette, chrome, styles }) => (
    <ResultCard
        title={dimension.title}
        styles={chrome}
        style={styles.card}
        right={(
            <>
                <Text style={styles.detailScore}>{dimension.score}</Text>
                <View style={[styles.tag, { backgroundColor: palette.goldSoft }]}><Text style={[styles.tagText, { color: palette.gold }]}>{dimension.grade}</Text></View>
            </>
        )}
    >
        <View style={[styles.track, styles.detailTrack]}><View style={[styles.trackFill, { width: `${Math.max(0, Math.min(100, dimension.score))}%` as const }]} /></View>
        {dimension.evidence.length === 0 ? (
            <Text style={styles.emptyText}>{dimension.summary}</Text>
        ) : (
            <View style={styles.cardBody}>
                {dimension.evidence.map((item, index) => (
                    <View key={`${dimension.key}-${index}`} style={[styles.evRow, index > 0 && styles.rowSep]}>
                        <View style={[styles.tag, { backgroundColor: item.effect === 'positive' ? palette.positiveSoft : item.effect === 'negative' ? palette.negativeSoft : palette.chipBg }]}>
                            <Text style={[styles.tagText, { color: item.effect === 'positive' ? palette.positive : item.effect === 'negative' ? palette.negative : palette.chipInk }]}>{EFFECT_TAG[item.effect]}</Text>
                        </View>
                        <Text style={styles.evText}><Text style={styles.evLabel}>{item.label}　</Text>{item.detail}</Text>
                    </View>
                ))}
            </View>
        )}
        {onOpenReferences ? (
            <Pressable onPress={onOpenReferences} style={({ pressed }) => [styles.refLink, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`${dimension.title}的典籍依据`}>
                <Text style={styles.refLinkText}>典籍依据</Text>
            </Pressable>
        ) : null}
    </ResultCard>
);

const ClassicReferenceSheet: React.FC<{
    visible: boolean;
    referenceIds: BaziMatchClassicReferenceId[];
    onClose: () => void;
    palette: ResultPalette;
    styles: Styles;
}> = ({ visible, referenceIds, onClose, palette, styles }) => {
    const references = getBaziMatchClassicRefs(referenceIds);

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.sheetRoot}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="关闭" />
                <View style={styles.sheet}>
                    <View style={styles.sheetHandle} />
                    <View style={styles.sheetHeader}>
                        <Text style={styles.sheetTitle}>典籍依据</Text>
                        <Text style={styles.sheetMeta}>{references.length} 条 · 短引、原意与本地规则</Text>
                        <Pressable onPress={onClose} style={({ pressed }) => [styles.sheetClose, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="关闭">
                            <CloseIcon size={20} color={palette.icon} />
                        </Pressable>
                    </View>
                    <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheetScrollBody} showsVerticalScrollIndicator={false}>
                        {references.map((item) => (
                            <View key={item.id} style={styles.ref}>
                                <View style={styles.refHead}>
                                    <Text style={styles.refId}>{item.id}</Text>
                                    <Text style={styles.refSection}>{item.section}</Text>
                                    <Text style={[styles.refType, { color: item.sourceType === 'classic' ? palette.gold : palette.chipInk }]}>
                                        {item.sourceType === 'classic' ? '古籍' : item.sourceType === 'experience' ? '经验' : '边界'}
                                    </Text>
                                </View>
                                <Text style={styles.refTitle}>{item.title}</Text>
                                <Text style={styles.refSource}>{item.source}</Text>
                                <Text style={styles.refQuote}>「{item.quote}」</Text>
                                {[['原意', item.meaning], ['规则', item.localRule], ['边界', item.boundary]].map(([label, text]) => (
                                    <View key={label} style={styles.refRow}>
                                        <Text style={styles.refLabel}>{label}</Text>
                                        <Text style={styles.refText}>{text}</Text>
                                    </View>
                                ))}
                            </View>
                        ))}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};

const makeStyles = (palette: ResultPalette, Colors: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: 'transparent' },
    pressed: { opacity: 0.72 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
    centerText: { color: palette.muted, fontSize: 15 },
    content: { flex: 1 },
    contentBody: { paddingBottom: 48 },

    hero: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingTop: 14, paddingBottom: 16, paddingLeft: 20, paddingRight: 18, backgroundColor: palette.card, borderBottomWidth: 1, borderBottomColor: palette.heroBorder },
    heroMain: { flex: 1, minWidth: 0 },
    heroNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    heroName: { flexShrink: 1, fontSize: 20, lineHeight: 28, fontWeight: '700', color: palette.heading },
    heroWho: { marginTop: 6, fontSize: 12, lineHeight: 18, color: palette.muted },
    heroLine: { marginTop: 6, fontSize: 13, lineHeight: 20, color: palette.body },
    gaugeWrap: { alignItems: 'center' },
    gauge: { width: 84, height: 84, alignItems: 'center', justifyContent: 'center' },
    gaugeScore: { fontSize: 26, lineHeight: 30, fontWeight: '700', color: palette.heading, fontVariant: ['tabular-nums'] },
    gaugeGrade: { fontSize: 11, lineHeight: 14, fontWeight: '700', color: palette.gold },
    gaugeLabel: { marginTop: 2, fontSize: 11, color: palette.muted },

    // 一段一张 ResultCard，卡里只用细线分行
    card: { marginTop: 12 },
    cardBody: { marginTop: 4 },
    rowSep: { borderTopWidth: 1, borderTopColor: palette.hairline },
    chart: { marginTop: 8 },
    caption: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: palette.hairline, fontSize: 13, lineHeight: 20, color: palette.body },
    emptyText: { paddingVertical: 8, fontSize: 13, lineHeight: 20, color: palette.muted },
    tag: { minWidth: 22, height: 20, paddingHorizontal: 6, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
    tagText: { fontSize: 11, fontWeight: '700' },

    legend: { marginTop: 6, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 6, columnGap: 14 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendText: { fontSize: 11.5, lineHeight: 16, color: palette.muted },

    mutual: { marginTop: 10, flexDirection: 'row' },
    mutualCol: { flex: 1, minWidth: 0, paddingRight: 12 },
    mutualRight: { paddingLeft: 12, paddingRight: 0, borderLeftWidth: 1, borderLeftColor: palette.hairline },
    mutualLabel: { fontSize: 12, lineHeight: 18, color: palette.muted },
    mutualStar: { marginTop: 2, fontSize: 24, lineHeight: 32, fontWeight: '700', color: palette.heading },
    mutualGist: { marginTop: 4, fontSize: 12.5, lineHeight: 19, color: palette.body },

    bf: { marginTop: 8 },
    bfHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
    bfHeadText: { flex: 1, fontSize: 11.5, lineHeight: 16, color: palette.muted },
    bfRow: { height: 32, flexDirection: 'row', alignItems: 'center', gap: 6 },
    bfNumLeft: { width: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
    bfNumRight: { width: 52, flexDirection: 'row', alignItems: 'center', gap: 4 },
    bfNum: { fontSize: 13, fontWeight: '700', color: palette.ink, fontVariant: ['tabular-nums'] },
    bfTrack: { flex: 1, height: 8, flexDirection: 'row', borderRadius: 2, backgroundColor: palette.barTrack, overflow: 'hidden' },
    bfBar: { height: 8, borderRadius: 2 },
    bfIcon: { width: 32, alignItems: 'center' },
    need: { height: 18, paddingHorizontal: 4, borderRadius: 4, overflow: 'hidden', fontSize: 10.5, lineHeight: 18, fontWeight: '700', color: palette.gold, backgroundColor: palette.goldSoft },

    dim: { paddingVertical: 9 },
    dimHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    dimTitle: { width: 40, fontSize: 14, fontWeight: '600', color: palette.heading },
    track: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden', backgroundColor: palette.barTrack },
    trackFill: { height: 4, borderRadius: 2, backgroundColor: palette.gold },
    dimScore: { width: 30, textAlign: 'right', fontSize: 15, fontWeight: '700', color: palette.heading, fontVariant: ['tabular-nums'] },
    dimGrade: { width: 16, fontSize: 11, fontWeight: '700', color: palette.gold },
    dimWhy: { marginTop: 4, marginLeft: 50, fontSize: 12, lineHeight: 18, color: palette.muted },

    yearRow: { paddingVertical: 10 },
    yearHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    yearText: { fontSize: 18, fontWeight: '700', color: palette.heading, fontVariant: ['tabular-nums'] },
    yearGz: { fontSize: 16, fontWeight: '700', letterSpacing: 1 },
    yearAge: { marginLeft: 'auto', fontSize: 12, color: palette.muted },
    yearReason: { marginTop: 4, fontSize: 12.5, lineHeight: 19, color: palette.body },
    fine: { marginTop: 18, textAlign: 'center', fontSize: 11.5, color: palette.muted },

    basis: { marginTop: 14, fontSize: 12, lineHeight: 18, color: palette.muted },
    detailScore: { fontSize: 17, fontWeight: '700', color: palette.heading, fontVariant: ['tabular-nums'] },
    detailTrack: { flex: 0, marginTop: 10 },
    evRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 10 },
    evLabel: { fontWeight: '600', color: palette.heading },
    evText: { flex: 1, fontSize: 13.5, lineHeight: 21, color: palette.body },
    refLink: { alignSelf: 'flex-end', minHeight: 36, justifyContent: 'center', paddingHorizontal: 4, marginBottom: -8 },
    refLinkText: { fontSize: 12.5, fontWeight: '600', color: palette.gold },

    sheetRoot: { flex: 1, justifyContent: 'flex-end', backgroundColor: Colors.bg.overlay },
    sheet: { maxHeight: '76%', borderTopLeftRadius: 20, borderTopRightRadius: 20, backgroundColor: palette.card },
    sheetHandle: { alignSelf: 'center', width: 36, height: 4, marginTop: 8, borderRadius: 2, backgroundColor: palette.rule },
    sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 20, paddingRight: 6, paddingTop: 4, paddingBottom: 8 },
    sheetTitle: { fontSize: 17, fontWeight: '700', color: palette.heading },
    sheetMeta: { flex: 1, fontSize: 12, color: palette.muted },
    sheetClose: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    sheetScroll: { flexGrow: 0 },
    sheetScrollBody: { paddingHorizontal: 16, paddingBottom: 28, gap: 10 },
    ref: { padding: 14, borderRadius: 12, borderWidth: 1, borderColor: palette.cardBorder },
    refHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    refId: { paddingHorizontal: 5, borderRadius: 4, overflow: 'hidden', fontSize: 11, lineHeight: 16, color: palette.chipInk, backgroundColor: palette.chipBg },
    refSection: { flex: 1, fontSize: 12, color: palette.muted },
    refType: { fontSize: 11, fontWeight: '700' },
    refTitle: { marginTop: 8, fontSize: 15, lineHeight: 22, fontWeight: '700', color: palette.heading },
    refSource: { fontSize: 12, lineHeight: 17, color: palette.muted },
    refQuote: { marginVertical: 8, fontSize: 15, lineHeight: 24, fontWeight: '600', color: palette.heading },
    refRow: { flexDirection: 'row', gap: 10, paddingTop: 6 },
    refLabel: { width: 30, fontSize: 12, lineHeight: 20, color: palette.muted },
    refText: { flex: 1, fontSize: 13, lineHeight: 20, color: palette.body },
});
