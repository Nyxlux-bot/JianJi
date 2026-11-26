import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';
import { webHorizontalFadeProps } from '../../../src/theme/web-enhance';
import { router, useLocalSearchParams } from 'expo-router';
import PressableScale from '../../../src/components/PressableScale';
import StatusBarDecor from '../../../src/components/StatusBarDecor';
import ConfirmModal from '../../../src/components/ConfirmModal';
import { CustomAlert } from '../../../src/components/CustomAlertProvider';
import OverflowMenu, { type OverflowMenuItem } from '../../../src/components/OverflowMenu';
import AIChatModal from '../../../src/components/AIChatModal';
import WuXingIcon from '../../../src/components/WuXingIcon';
import { makeResultChromeStyles, ResultTopBar, type ResultTab } from '../../../src/components/result/ResultChrome';
import { useTheme } from '../../../src/theme/ThemeContext';
import { buildResultPalette, type ResultPalette } from '../../../src/theme/result-palette';
import { deleteRecord, getRecord, saveRecord, toggleFavorite } from '../../../src/db/database';
import { clearAIAnalysisJob } from '../../../src/services/ai-analysis-jobs';
import { isAIConfigured } from '../../../src/services/settings';
import { shareQimenResultMarkdown } from '../../../src/services/share';
import { getRecordRoute } from '../../../src/utils/record-route';
import { getGanZhiElement } from '../../../src/features/bazi/wuxing';
import { QIMEN_GATES, QIMEN_LAYOUT, QIMEN_PALACES } from '../../../src/features/qimen/data';
import { castQimen, shiftQimenResultByHours } from '../../../src/features/qimen/engine';
import { getQimenPillars } from '../../../src/features/qimen/flying-board';
import { getPeriodBoard } from '../../../src/features/qimen/period-board';
import { QIMEN_GATE_IMAGES } from '../../../src/features/qimen/images';
import { compareQimenPalaces, getQimenPalaceBadges, getQimenStemPalaces } from '../../../src/features/qimen/rules';
import QimenPalaceDetail from '../../../src/features/qimen/QimenPalaceDetail';
import { QIMEN_PERIODS, type QimenPeriod, type QimenResult } from '../../../src/features/qimen/types';

import { QimenComparison } from '../../../src/features/qimen/QimenComparison';
import { QimenReview } from '../../../src/features/qimen/QimenReview';

type Tab = 'chart' | 'info' | 'review';
type FocusKey = 'year' | 'month' | 'day' | 'hour' | 'chiefStar' | 'chiefGate' | 'wu' | 'sheng' | 'kai';
const TABS: ResultTab<Tab>[] = [{ key: 'chart', label: '九宫' }, { key: 'info', label: '信息' }, { key: 'review', label: '复盘' }];
const DOUBLE_TAP_MS = 250;

export default function QimenResultPage() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const { Colors } = useTheme();
    const palette = useMemo(() => buildResultPalette(Colors), [Colors]);
    const styles = useMemo(() => makeStyles(palette), [palette]);
    const chrome = useMemo(() => makeResultChromeStyles(palette), [palette]);
    const [result, setResult] = useState<QimenResult | null>(null);
    const [hourOffset, setHourOffset] = useState(0);
    const activeResult = useMemo(() => {
        if (!result) return null;
        if (hourOffset === 0) return result;
        return shiftQimenResultByHours(result, hourOffset * 2) ?? result;
    }, [hourOffset, result]);
    const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading');
    const [tab, setTab] = useState<Tab>('chart');
    const [period, setPeriod] = useState<QimenPeriod>('时盘');
    const board = useMemo(() => activeResult ? getPeriodBoard(activeResult, period) : null, [activeResult, period]);
    const [selected, setSelected] = useState(1);
    const [focusKey, setFocusKey] = useState<FocusKey | null>(null);
    const [showBadges, setShowBadges] = useState(true);
    const [showDarkStem, setShowDarkStem] = useState(false);
    const [detailVisible, setDetailVisible] = useState(false);
    const [menuVisible, setMenuVisible] = useState(false);
    const [deleteVisible, setDeleteVisible] = useState(false);
    const [favorite, setFavorite] = useState(false);
    const [aiVisible, setAiVisible] = useState(false);
    const [showSnapshot, setShowSnapshot] = useState(false);
    const [boardVisit, setBoardVisit] = useState(false);
    const [aiQuestion, setAiQuestion] = useState<string>();
    const [screenReaderEnabled, setScreenReaderEnabled] = useState(false);
    const lastPalacePress = useRef<{ number: number; at: number } | null>(null);
    const scrollRef = useRef<ScrollViewInstance>(null);
    const boardOffset = useRef(0);
    const aiOpenTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        // RN Web 始终返回 true。浏览器的无指针激活在宫位 onPress 中识别。
        if (Platform.OS === 'web') return;
        void AccessibilityInfo.isScreenReaderEnabled().then(setScreenReaderEnabled);
        const subscription = AccessibilityInfo.addEventListener('screenReaderChanged', setScreenReaderEnabled);
        return () => subscription.remove();
    }, []);

    useEffect(() => {
        let cancelled = false;
        setState('loading');
        (async () => {
            try {
                const record = id ? await getRecord(id) : null;
                if (cancelled) return;
                if (!record) { setState('missing'); return; }
                if (record.engineType !== 'qimen') { router.replace(getRecordRoute(record.engineType, id)); return; }
                setResult(record.result);
                setHourOffset(0);
                setFocusKey(null);
                setPeriod('时盘');
                setDetailVisible(false);
                setBoardVisit(false);
                setShowSnapshot(false);
                setTab('chart');
                setSelected(getPeriodBoard(record.result, '时盘').focus);
                setFavorite(record.isFavorite);
                setState('ready');
            } catch (error) {
                if (cancelled) return;
                setState('missing');
                CustomAlert.alert('读取失败', error instanceof Error ? error.message : '记录读取失败');
            }
        })();
        return () => { cancelled = true; if (aiOpenTimer.current) clearTimeout(aiOpenTimer.current); };
    }, [id]);

    const openAI = async (palaceNumber?: number) => {
        try {
            if (!(await isAIConfigured())) {
                CustomAlert.alert('未配置 AI', '请先在设置中配置 AI 接口地址和 API Key', [
                    { text: '去设置', onPress: () => router.push('/settings') }, { text: '取消', style: 'cancel' },
                ]);
                return;
            }
            if (hourOffset !== 0) {
                setHourOffset(0);
            }
            setBoardVisit(false);
            setAiQuestion(palaceNumber ? `请结合${period}和本次占问，分析${QIMEN_PALACES[palaceNumber - 1].name}宫与所问之事的关系。` : undefined);
            if (detailVisible) {
                setDetailVisible(false);
                // 等宫位弹层收起，再呈现全屏 AI，避免 iOS 同时呈现两个 Modal。
                aiOpenTimer.current = setTimeout(() => setAiVisible(true), 300);
            } else setAiVisible(true);
        } catch (error) {
            CustomAlert.alert('打开 AI 失败', error instanceof Error ? error.message : '请稍后重试');
        }
    };

    const closeAI = useCallback(() => {
        setBoardVisit(false);
        setAiVisible(false);
        setAiQuestion(undefined);
    }, []);

    const openBoard = useCallback((target: QimenPeriod) => {
        setBoardVisit(true);
        setHourOffset(0);
        setPeriod(target);
        setTab('chart');
        setAiVisible(false);
        setAiQuestion(undefined);
        scrollRef.current?.scrollTo({ y: boardOffset.current, animated: false });
    }, []);

    const onPalaceLink = useCallback((url: string) => {
        if (!url.startsWith('qimen:')) return true;
        const match = /^qimen:\/\/palace\/([1-9])(?:\?period=([0-3]))?$/.exec(url);
        if (match && result) {
            const target = match[2] ? QIMEN_PERIODS[Number(match[2])] : '时盘';
            openBoard(target);
            setSelected(Number(match[1]));
        }
        return false;
    }, [result, openBoard]);

    const handleSaveShifted = async () => {
        if (!activeResult || hourOffset === 0) return;
        try {
            const fresh = castQimen({
                form: activeResult.form,
                juMethod: activeResult.juMethod,
                spiritStyle: activeResult.spiritStyle,
                numberSeed: activeResult.numberSeed,
                dateTime: activeResult.inputDateTime,
                location: activeResult.location,
                longitude: activeResult.longitude,
                question: activeResult.question,
                subject: activeResult.subject,
                recentEvents: activeResult.recentEvents,
                timeRange: activeResult.timeRange,
            });
            await saveRecord({ engineType: 'qimen', result: { ...fresh, sourceId: id } });
            router.replace(`/qimen/result/${fresh.id}`);
        } catch (error) {
            CustomAlert.alert('另存失败', error instanceof Error ? error.message : '请稍后重试');
        }
    };

    const menuItems: OverflowMenuItem[] = [
        { key: 'share', label: '导出分享', onPress: async () => {
            if (!activeResult) return;
            try { await shareQimenResultMarkdown(activeResult, period); }
            catch (error) { CustomAlert.alert('分享失败', error instanceof Error ? error.message : '请稍后重试'); }
        } },
        { key: 'favorite', label: favorite ? '取消收藏' : '收藏结果', onPress: async () => {
            try { await toggleFavorite(id); setFavorite(value => !value); }
            catch (error) { CustomAlert.alert('收藏失败', error instanceof Error ? error.message : '请稍后重试'); }
        } },
        { key: 'recast', label: '沿用此盘再起', onPress: () => router.push({ pathname: '/qimen/input', params: { sourceId: id, offset: String(hourOffset) } }) },
        { key: 'delete', label: '删除记录', destructive: true, onPress: () => setDeleteVisible(true) },
    ];

    const focusOptions = useMemo(() => {
        const items: { key: FocusKey; label: string }[] = [];
        if (period === '年盘') items.push({ key: 'year', label: '年干' });
        if (period === '月盘' || period === '年盘') items.push({ key: 'month', label: '月干' });
        items.push(
            { key: 'day', label: '日干' },
            { key: 'hour', label: '时干' },
            { key: 'chiefStar', label: '值符' },
            { key: 'chiefGate', label: '值使' },
            { key: 'wu', label: '戊(资金)' },
            { key: 'sheng', label: '生门' },
            { key: 'kai', label: '开门' },
        );
        return items;
    }, [period]);

    const highlightedPalaces = useMemo(() => {
        if (!focusKey || !activeResult || !board) return [] as number[];
        if (focusKey === 'year') return getQimenStemPalaces(activeResult, 0, board).map(p => p.number);
        if (focusKey === 'month') return getQimenStemPalaces(activeResult, 1, board).map(p => p.number);
        if (focusKey === 'day') return getQimenStemPalaces(activeResult, 2, board).map(p => p.number);
        if (focusKey === 'hour') return getQimenStemPalaces(activeResult, 3, board).map(p => p.number);
        if (focusKey === 'chiefStar') return [board.chief.chiefStarPalace];
        if (focusKey === 'chiefGate') return [board.chief.chiefGatePalace];
        if (focusKey === 'wu') {
            return board.palaces.filter(p =>
                p.heavenStem === '戊' || p.hostedHeavenStem === '戊'
                || (p.heavenStem === '甲' && board.chief.hiddenStem === '戊'),
            ).map(p => p.number);
        }
        if (focusKey === 'sheng') return board.palaces.filter(p => p.gate === '生门').map(p => p.number);
        return board.palaces.filter(p => p.gate === '开门').map(p => p.number);
    }, [activeResult, board, focusKey]);

    const activeFocusLabel = focusOptions.find(item => item.key === focusKey)?.label;
    const relationSummary = useMemo(() => {
        if (!focusKey || !highlightedPalaces.length || !activeFocusLabel) return null;
        const target = highlightedPalaces[0];
        const relation = compareQimenPalaces(target, selected, activeResult?.form);
        if (!relation) return null;
        return `${activeFocusLabel}(${QIMEN_PALACES[target - 1].name}) ↔ 选中(${QIMEN_PALACES[selected - 1].name})：${relation}`;
    }, [activeFocusLabel, activeResult?.form, focusKey, highlightedPalaces, selected]);

    if (!result || !activeResult || !board || state !== 'ready') return <View style={styles.container}><StatusBarDecor /><View style={styles.center}><Text style={styles.muted}>{state === 'missing' ? '记录不存在或无法读取' : '加载中…'}</Text><Pressable onPress={() => router.back()} style={styles.action} accessibilityRole="button"><Text style={styles.link}>返回上一页</Text></Pressable></View></View>;

    const turn = board.turn;
    const palace = board.palaces[selected - 1];
    const chief = board.chief;
    const pillars = getQimenPillars(activeResult);
    const form = activeResult.form ?? '转盘';
    const fullHour = period === '时盘' && form === '转盘';
    const clock = activeResult.inputDateTime.slice(0, 16).replace('T', '  ');
    const stemColor = (stem: string) => { const element = getGanZhiElement(stem); return element ? palette.element[element] : palette.ink; };
    const palaceName = (number: number) => QIMEN_PALACES[number - 1].name;
    const infoRows = [
        ['起盘时间', `${activeResult.inputDateTime.replace('T', ' ')} UTC+8`], ['农历', activeResult.lunarDate],
        ['地点', activeResult.location || '未填写'], ['盘面', form + ' · ' + period], ['定局方法', board.method], ['本盘', board.title + (board.wuBuYuShi ? ' · 五不遇时' : '')], ['排盘口径', board.basis], ['依据', board.source],
        ['当前节气', `${activeResult.solarTerm.name} · ${activeResult.solarTerm.at}`], ['下次交节', `${activeResult.solarTerm.nextName} · ${activeResult.solarTerm.nextAt}`],
        ...(fullHour ? [['符头与三元', `${activeResult.fuTou} · ${activeResult.yuan}`], ['基础盘版本', activeResult.ruleVersion]] : []),
        ['盘式版本', activeResult.boardVersion ?? '旧记录未留存'],
        ...(activeResult.aiEvidence ? [['AI 盘据快照', activeResult.aiEvidence.version + ' · ' + activeResult.aiEvidence.capturedAt]] : []),
        ['旬首', `${chief.xunHead}遁${chief.hiddenStem}`],
        ['值符', `${chief.chiefStar} · ${palaceName(chief.chiefStarPalace)}宫`], ['值使', `${chief.chiefGate} · ${palaceName(chief.chiefGatePalace)}宫`],
        [period[0] + '旬空与驿马', `${board.voidBranches.join('')}空 · ${board.horseBranch}马(${palaceName(board.horsePalace)})`],
        ['盘面摘要', board.detail], ['关注时间', activeResult.timeRange || '未填写'],
        ['近期事件', activeResult.recentEvents || '未填写'],
    ];

    return (
        <View style={styles.container}>
            <StatusBarDecor backgroundColor={palette.card} />
            <ResultTopBar tabs={TABS} active={tab} onTab={next => { if (next === 'review') setHourOffset(0); setTab(next); }} aiLabel="AI 解读" aiDisabled={false} onAI={() => void openAI()} onMore={() => setMenuVisible(!menuVisible)} styles={chrome} palette={palette} />
            {boardVisit && !aiVisible && <Pressable accessibilityRole="button" style={styles.detailRow} onPress={() => setAiVisible(true)}>
                <Text style={styles.link}>‹ 回到刚才的解读</Text>
            </Pressable>}
            <OverflowMenu visible={menuVisible} top={54} right={16} items={menuItems} onClose={() => setMenuVisible(false)} />
            <ScrollView ref={scrollRef} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
                <View style={styles.hero}>
                    <View style={styles.between}><Text style={styles.muted}><Text style={{ color: palette.vermilion }}>◆ </Text>{activeResult.question ? '占问事项' : '起盘时间'}</Text><Text style={styles.chip}>{form}</Text></View>
                    <Text style={styles.question} numberOfLines={2}>{activeResult.question || clock}</Text>
                    <Text style={styles.muted}>{[activeResult.question ? clock : activeResult.lunarDate, activeResult.location].filter(Boolean).join('　')}</Text>
                    <View style={styles.pillars}>{pillars.map((pillar, index) => <View key={index} style={styles.pillar}><Text style={styles.muted}>{['年', '月', '日', '时'][index]}</Text><Text style={styles.pillarValue}>{Array.from(pillar).map((symbol, i) => <Text key={i} style={{ color: stemColor(symbol) }}>{symbol}</Text>)}</Text></View>)}</View>
                </View>
                {tab !== 'review' && <View style={styles.periods} accessibilityRole="tablist">{QIMEN_PERIODS.map(item =>
                    <Pressable key={item} style={styles.periodTab} accessibilityRole="tab" aria-selected={item === period} onPress={() => {
                        if (item === period) return;
                        lastPalacePress.current = null;
                        setPeriod(item);
                    }}>
                        <Text style={[styles.periodLabel, item === period && styles.activeLabel]}>{item}</Text>
                        {item === period && <View pointerEvents="none" style={styles.indicatorTrack}><View style={styles.indicator} /></View>}
                    </Pressable>)}</View>}
                <View style={styles.content} onLayout={event => { boardOffset.current = event.nativeEvent.layout.y; }}>
                    {tab === 'chart' ? <>
                        <View style={styles.between}>
                            <View style={styles.summary}>
                                <View style={styles.titleRow}>
                                    <Text style={styles.boardTitle}>{board.title}</Text>
                                    {board.wuBuYuShi ? <Text style={styles.warnChip}>五不遇时</Text> : null}
                                </View>
                                <Text style={styles.small}>{board.detail} · {board.method}</Text>
                            </View>
                            <Pressable style={styles.action} onPress={() => setTab('info')} accessibilityRole="button"><Text style={styles.link}>依据 ›</Text></Pressable>
                        </View>

                        <View style={styles.stepperBar}>
                            <Pressable onPress={() => setHourOffset(v => v - 1)} style={styles.stepBtn} accessibilityRole="button" accessibilityLabel="上一时辰">
                                <Text style={styles.stepText}>‹ 上一时</Text>
                            </Pressable>
                            {hourOffset !== 0 ? (
                                <View style={styles.stepCenter}>
                                    <Text style={styles.stepOffset}>{hourOffset > 0 ? `+${hourOffset}` : hourOffset}时辰</Text>
                                    <Pressable onPress={() => setHourOffset(0)} hitSlop={6} accessibilityRole="button"><Text style={styles.link}>复原</Text></Pressable>
                                    <Pressable onPress={() => void handleSaveShifted()} hitSlop={6} accessibilityRole="button"><Text style={styles.link}>另存</Text></Pressable>
                                </View>
                            ) : (
                                <Text style={styles.stepHint}>值符 {chief.chiefStar}·{palaceName(chief.chiefStarPalace)}　值使 {chief.chiefGate}·{palaceName(chief.chiefGatePalace)}</Text>
                            )}
                            <Pressable onPress={() => setHourOffset(v => v + 1)} style={[styles.stepBtn, styles.stepBtnRight]} accessibilityRole="button" accessibilityLabel="下一时辰">
                                <Text style={styles.stepText}>下一时 ›</Text>
                            </Pressable>
                        </View>
                        {hourOffset !== 0 ? (
                            <View style={styles.duty}><Text style={styles.small}>值符 {chief.chiefStar}·{palaceName(chief.chiefStarPalace)}</Text><Text style={styles.small}>值使 {chief.chiefGate}·{palaceName(chief.chiefGatePalace)}</Text></View>
                        ) : null}

                        <View style={styles.boardToolbar}>
                            <Text style={styles.muted}>{screenReaderEnabled ? '激活宫位查看详情' : '单击选宫 · 双击详情'}</Text>
                            <View style={styles.toolbarRight}>
                                <Pressable onPress={() => setShowBadges(v => !v)} style={styles.miniToggle} accessibilityRole="switch" accessibilityState={{ checked: showBadges }}>
                                    <Text style={[styles.link, !showBadges && styles.muted]}>标·{showBadges ? '开' : '关'}</Text>
                                </Pressable>
                                {turn ? (
                                    <Pressable onPress={() => setShowDarkStem(v => !v)} style={styles.miniToggle} accessibilityRole="switch" accessibilityState={{ checked: showDarkStem }}>
                                        <Text style={[styles.link, !showDarkStem && styles.muted]}>暗干·{showDarkStem ? '开' : '关'}</Text>
                                    </Pressable>
                                ) : null}
                            </View>
                        </View>

                        <View style={styles.grid}>{QIMEN_LAYOUT.map((number, index) => {
                            const cell = board.palaces[number - 1];
                            const cellInfo = QIMEN_PALACES[number - 1];
                            const isHighlighted = highlightedPalaces.includes(number);
                            const cellStyle = [styles.cell, index % 3 === 2 && styles.lastColumn, index > 5 && styles.lastRow];
                            const highlightCorner = index === 0 ? styles.cornerTL
                                : index === 2 ? styles.cornerTR
                                : index === 6 ? styles.cornerBL
                                : index === 8 ? styles.cornerBR
                                : undefined;
                            const starElement = QIMEN_PALACES.find(item => item.star === cell.star)?.element;
                            const gateElement = cell.gate ? QIMEN_GATES[cell.gate].element : null;
                            const badges = showBadges ? getQimenPalaceBadges(cell, board) : [];
                            const dark = showDarkStem ? board.darkStems?.[number - 1] : undefined;
                            return <Pressable key={number} onPress={event => {
                                const now = Date.now();
                                const previous = lastPalacePress.current;
                                const activated = screenReaderEnabled || ('detail' in event.nativeEvent && event.nativeEvent.detail === 0);
                                setSelected(number);
                                if (activated || (previous?.number === number && now - previous.at < DOUBLE_TAP_MS)) {
                                    lastPalacePress.current = null;
                                    setDetailVisible(true);
                                } else lastPalacePress.current = { number, at: now };
                            }} onAccessibilityTap={() => { setSelected(number); setDetailVisible(true); }}
                                style={[...cellStyle, selected === number && styles.selected]}
                                accessibilityRole="button" aria-pressed={selected === number} accessibilityState={{ selected: selected === number }} accessibilityHint="查看宫位详情"
                                accessibilityLabel={[cellInfo.name + '宫', cell.gate ?? (form === '飞盘' ? '五位' : ''), cell.star, cell.heavenStem && '天盘' + cell.heavenStem, '地盘' + cell.earthStem, cell.spirit].filter(Boolean).join('，')}>
                                <View style={styles.between}>
                                    <View style={styles.palaceName}><WuXingIcon element={cellInfo.element} size={11} /><Text style={styles.small}>{cellInfo.name}</Text></View>
                                    <View style={styles.badgeRow}>
                                        {cell.voidBranches.length ? <Text style={styles.badgeWarn}>空</Text> : null}
                                        {cell.isHorse ? <Text style={styles.badgeWarn}>马</Text> : null}
                                        {badges.map(b => <Text key={b.key} style={b.tone === 'warn' ? styles.badgeGold : styles.badgeMuted}>{b.text}</Text>)}
                                    </View>
                                </View>
                                {number === 5 && form === '星飞门转' ? (
                                    <View style={styles.centerCell}>
                                        <Text style={[styles.centerPillar, starElement && { color: palette.element[starElement] }]}>{cell.star}</Text>
                                        <Text style={styles.small}>八门在外宫</Text>
                                        <Text style={styles.small}>天 <Text style={{ color: cell.heavenStem ? stemColor(cell.heavenStem) : palette.ink }}>{cell.heavenStem}</Text>　地 <Text style={{ color: stemColor(cell.earthStem) }}>{cell.earthStem}</Text></Text>
                                    </View>
                                ) : number === 5 && turn ? (
                                    <View style={styles.centerCell}>
                                        <Text style={styles.small}>{period}</Text>
                                        <Text style={styles.centerPillar}>{pillars[QIMEN_PERIODS.indexOf(period)]}</Text>
                                        <Text style={styles.small}>地 <Text style={{ color: stemColor(cell.earthStem) }}>{cell.earthStem}</Text>{dark ? <>　暗 <Text style={{ color: stemColor(dark) }}>{dark}</Text></> : ' · 寄坤'}</Text>
                                        <Text style={styles.small}>天禽随芮</Text>
                                    </View>
                                ) : <>
                                    <View style={styles.between}><Text style={[styles.star, { color: starElement ? palette.element[starElement] : palette.ink }]}>{cell.star}</Text><Text style={styles.spirit}>{cell.spirit}</Text></View>
                                    <View style={styles.gateStack}>{cell.gate && gateElement ? <Image source={QIMEN_GATE_IMAGES[cell.gate]} style={[styles.gateIcon, { tintColor: palette.element[gateElement] }]} resizeMode="contain" /> : null}<Text style={[styles.gate, { color: gateElement ? palette.element[gateElement] : palette.ink }]} numberOfLines={1}>{cell.gate ?? (form === '飞盘' ? '五位' : '八门在外宫')}</Text></View>
                                    <View style={styles.between}>
                                        <Text style={styles.small}>天 <Text style={[styles.stem, { color: cell.heavenStem ? stemColor(cell.heavenStem) : palette.ink }]}>{cell.heavenStem}</Text></Text>
                                        <Text style={styles.small}>地 <Text style={[styles.stem, { color: stemColor(cell.earthStem) }]}>{cell.earthStem}</Text></Text>
                                        {dark ? <Text style={styles.small}>暗 <Text style={{ color: stemColor(dark), fontWeight: '600' }}>{dark}</Text></Text> : null}
                                    </View>
                                    <Text style={styles.hosted} numberOfLines={1}>{cell.hostedHeavenStem || cell.hostedEarthStem ? `${cell.hostedHeavenStem ? `禽·天寄${cell.hostedHeavenStem} ` : ''}${cell.hostedEarthStem ? `地寄${cell.hostedEarthStem}` : ''}` : `${cellInfo.direction} · ${cellInfo.element}`}</Text>
                                </>}
                                {isHighlighted ? <View pointerEvents="none" style={[styles.highlightRing, highlightCorner]} /> : null}
                            </Pressable>;
                        })}</View>

                        <ScrollView horizontal {...webHorizontalFadeProps} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.focusRow}>
                            {focusOptions.map(item => {
                                const on = focusKey === item.key;
                                return <PressableScale key={item.key} onPress={() => setFocusKey(cur => cur === item.key ? null : item.key)}
                                    style={[styles.focusPill, on && styles.focusPillOn]} accessibilityRole="button" aria-pressed={on}>
                                    <Text style={[styles.focusPillText, on && styles.focusPillTextOn]}>{item.label}</Text>
                                </PressableScale>;
                            })}
                        </ScrollView>

                        {relationSummary ? (
                            <View style={styles.relationBar}><Text style={styles.relationText}>{relationSummary}</Text></View>
                        ) : null}

                        <View style={styles.legend}>
                            <Text style={styles.small}>上南下北 · 左东右西</Text>
                            <Text style={styles.small}>空·{period[0]}旬空  马·{period[0]}马{showBadges ? '  迫·刑·墓·伏·反' : ''}</Text>
                        </View>
                        <Pressable style={styles.detailRow} onPress={() => setDetailVisible(true)} accessibilityRole="button"><Text style={styles.infoValue}>{palaceName(selected)}宫</Text><Text style={styles.link}>宫位详情 ›</Text></Pressable>
                        <QimenComparison result={activeResult} selected={selected} gate={palace.gate} onSelect={(p, n) => {
                            setPeriod(p); setSelected(n); scrollRef.current?.scrollTo({ y: boardOffset.current, animated: false });
                        }} />
                    </> : tab === 'review' ? <QimenReview key={result.id} result={result} onSaved={setResult} /> : <View style={styles.reading}>
                        {result.sourceId && <Pressable accessibilityRole="button" style={styles.detailRow} onPress={() => router.push({ pathname: '/qimen/result/[id]', params: { id: result.sourceId! } })}>
                            <Text style={styles.link}>查看来源盘 ›</Text>
                        </Pressable>}{infoRows.map(([label, value]) => <View key={label} style={styles.infoRow}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>)}
                        {activeResult.aiEvidence && <>
                            <Pressable style={styles.detailRow} accessibilityRole="button" aria-expanded={showSnapshot} onPress={() => setShowSnapshot(!showSnapshot)}>
                                <Text style={styles.link}>{showSnapshot ? '收起解读时的盘据' : '查看解读时的盘据'}</Text>
                            </Pressable>
                            {showSnapshot && <Text selectable style={styles.small}>{activeResult.aiEvidence.context}</Text>}
                        </>}
                    </View>}
                </View>
            </ScrollView>
            <QimenPalaceDetail result={activeResult} palace={palace} period={period} board={board} visible={detailVisible} onSelect={setSelected} onClose={() => setDetailVisible(false)} onAI={() => void openAI(selected)} />
            <AIChatModal visible={aiVisible} onClose={closeAI} result={result} qimenPeriod={period} qimenBoardVisit={boardVisit} onUpdateResult={(updated: QimenResult) => setResult(updated)} initialQuestion={aiQuestion} onLinkPress={onPalaceLink} onQimenBoardPress={openBoard} />
            <ConfirmModal visible={deleteVisible} title="删除记录" message="删除这份奇门盘与 AI 会话？此操作无法撤销。" confirmText="删除" destructive onCancel={() => setDeleteVisible(false)} onConfirm={async () => {
                try { await clearAIAnalysisJob('qimen', id); await deleteRecord(id); setDeleteVisible(false); router.back(); }
                catch (error) { CustomAlert.alert('删除失败', error instanceof Error ? error.message : '请稍后重试'); }
            }} />
        </View>
    );
}

function makeStyles(palette: ResultPalette) {
    return StyleSheet.create({
        container: { flex: 1, backgroundColor: 'transparent' }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
        periods: { flexDirection: 'row', backgroundColor: palette.page, borderBottomWidth: 1, borderBottomColor: palette.rule },
        periodTab: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center' },
        periodLabel: { textAlign: 'center', color: palette.muted, fontSize: 15 },
        activeLabel: { fontWeight: '700', color: palette.heading },
        indicatorTrack: { position: 'absolute', left: 0, right: 0, bottom: 3, alignItems: 'center' },
        indicator: { width: 18, height: 2, borderRadius: 1, backgroundColor: palette.vermilion },
        summary: { flex: 1, gap: 3 },
        titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
        boardTitle: { fontSize: 19, fontWeight: '600', color: palette.gold },
        warnChip: { fontSize: 11, color: palette.vermilion, backgroundColor: palette.goldSoft, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden', fontWeight: '600' },
        stepperBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6, marginTop: 4, borderTopWidth: 1, borderTopColor: palette.hairline, gap: 6 },
        stepBtn: { minHeight: 34, paddingHorizontal: 6, justifyContent: 'center' },
        stepBtnRight: { alignItems: 'flex-end' },
        stepText: { fontSize: 12, color: palette.gold, fontWeight: '500' },
        stepCenter: { flexDirection: 'row', alignItems: 'center', gap: 10 },
        stepOffset: { fontSize: 12, color: palette.vermilion, fontWeight: '600' },
        stepHint: { flex: 1, textAlign: 'center', fontSize: 11, color: palette.muted },
        detailRow: { minHeight: 44, marginTop: 8, borderTopWidth: 1, borderTopColor: palette.rule, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
        hero: { backgroundColor: palette.card, paddingHorizontal: 16, paddingTop: 12, borderBottomColor: palette.hairline, borderBottomWidth: 1 },
        between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 3 },
        question: { fontSize: 17, lineHeight: 25, fontWeight: '700', color: palette.heading, marginTop: 5, marginBottom: 7 },
        muted: { fontSize: 12, color: palette.muted }, small: { fontSize: 12, lineHeight: 19, color: palette.muted }, ink: { color: palette.ink },
        link: { fontSize: 12, fontWeight: '500', color: palette.gold },
        chip: { backgroundColor: palette.chipBg, color: palette.chipInk, fontSize: 11, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4, overflow: 'hidden' },
        pillars: { flexDirection: 'row', marginTop: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: palette.hairline },
        pillar: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
        pillarValue: { fontSize: 16, letterSpacing: 1, fontWeight: '600' },
        duty: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 4, paddingVertical: 6, borderTopColor: palette.hairline, borderTopWidth: 1 },
        body: { paddingBottom: 32 }, content: { padding: 12 },
        boardToolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 4 },
        toolbarRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
        miniToggle: { minHeight: 36, justifyContent: 'center' },
        grid: { flexDirection: 'row', flexWrap: 'wrap', borderWidth: 1, borderColor: palette.rule, borderRadius: 10, overflow: 'hidden', backgroundColor: palette.card },
        cell: { position: 'relative', width: '33.333333%', minHeight: 116, padding: 8, borderRightWidth: 1, borderBottomWidth: 1, borderColor: palette.rule, backgroundColor: palette.card },
        lastColumn: { borderRightWidth: 0 }, lastRow: { borderBottomWidth: 0 },
        selected: { backgroundColor: palette.dayFill },
        // 内描边独立于宫格自身单边分隔线，四角精准贴合 grid 内圆角（10 - 1 = 9），不缺边、不切角、不挤内容
        highlightRing: { ...StyleSheet.absoluteFill, borderWidth: 1.5, borderColor: palette.gold },
        cornerTL: { borderTopLeftRadius: 9 },
        cornerTR: { borderTopRightRadius: 9 },
        cornerBL: { borderBottomLeftRadius: 9 },
        cornerBR: { borderBottomRightRadius: 9 },
        palaceName: { flexDirection: 'row', alignItems: 'center', gap: 3 },
        badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 2, flexWrap: 'nowrap' },
        badgeWarn: { fontSize: 10, fontWeight: '600', color: palette.vermilion },
        badgeGold: { fontSize: 10, fontWeight: '600', color: palette.gold },
        badgeMuted: { fontSize: 10, color: palette.muted },
        star: { fontSize: 12, lineHeight: 23 }, spirit: { fontSize: 12, color: palette.body },
        // 图标在上、门名在下居中；minHeight 按「图标 + 间距 + 一行字」算，没有门的宫（飞盘五位）也和同排对齐
        gateStack: { alignItems: 'center', justifyContent: 'center', gap: 2, minHeight: 48 },
        gate: { fontSize: 17, lineHeight: 22, fontWeight: '600' }, gateIcon: { width: 22, height: 24 },
        stem: { fontSize: 15, fontWeight: '600' },
        hosted: { fontSize: 12, lineHeight: 18, color: palette.muted, marginTop: 4 },
        centerCell: { flex: 1, alignItems: 'center', justifyContent: 'center' }, centerPillar: { fontSize: 20, lineHeight: 30, color: palette.heading, fontWeight: '600' },
        focusRow: { gap: 6, paddingTop: 10, paddingBottom: 2 },
        focusPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: palette.cardBorder, backgroundColor: palette.card },
        focusPillOn: { borderColor: palette.goldBorder, backgroundColor: palette.goldSoft },
        focusPillText: { fontSize: 12, color: palette.muted },
        focusPillTextOn: { color: palette.gold, fontWeight: '600' },
        relationBar: { marginTop: 8, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, backgroundColor: palette.goldSoft, borderWidth: 1, borderColor: palette.goldBorder },
        relationText: { fontSize: 12, color: palette.heading, lineHeight: 18 },
        legend: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4, marginTop: 7 },
        reading: { marginTop: 12, padding: 14, borderRadius: 12, backgroundColor: palette.card, borderColor: palette.cardBorder, borderWidth: 1 },
        action: { minHeight: 44, justifyContent: 'center', marginTop: 4 },
        infoRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: palette.hairline },
        infoLabel: { fontSize: 12, color: palette.muted, marginBottom: 5 }, infoValue: { fontSize: 14, color: palette.ink, lineHeight: 23 },
    });
}
