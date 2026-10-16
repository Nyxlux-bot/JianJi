/**
 * 六爻卦盘卡：正面本卦（六神、伏神、六亲纳甲、卦画、世应、化出），点按翻到变卦。
 * 静卦不翻转。用神选择高亮对应爻，并给出旺衰提要。
 */
import React, { useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import type { PanResult, YaoDetail } from '../core/liuyao-calc';
import type { LiuQin } from '../core/liuyao-data';
import type { LiuyaoMark, LiuyaoStatus } from '../core/liuyao-status';
import { useTheme } from '../theme/ThemeContext';
import { buildResultPalette, type ResultPalette } from '../theme/result-palette';
import { getGanZhiElement } from '../features/bazi/wuxing';
import WuXingIcon from './WuXingIcon';
import LiuShenIcon from './LiuShenIcon';

const LIUQIN_OPTIONS: LiuQin[] = ['父母', '兄弟', '子孙', '妻财', '官鬼'];
/** 伏神列只有一字位，「子孙」取「孙」免与地支子混淆 */
const FU_SHORT: Record<LiuQin, string> = { 父母: '父', 兄弟: '兄', 子孙: '孙', 妻财: '财', 官鬼: '鬼' };
const ROW_HEIGHT = 40;
const FACE_HEIGHT = 44 + 22 + ROW_HEIGHT * 6;

interface HexagramDisplayProps {
    result: PanResult;
    status: LiuyaoStatus;
    yong: LiuQin;
    onYongChange: (liuQin: LiuQin) => void;
}

function YaoLine({ yang, width, color }: { yang: boolean; width: number; color: string }) {
    return yang
        ? <View style={{ width, height: 7, borderRadius: 1, backgroundColor: color }} />
        : (
            <View style={{ width, height: 7, flexDirection: 'row', gap: Math.round(width * 0.16) }}>
                <View style={{ flex: 1, borderRadius: 1, backgroundColor: color }} />
                <View style={{ flex: 1, borderRadius: 1, backgroundColor: color }} />
            </View>
        );
}

function HexagramDisplayComponent({ result, status, yong, onYongChange }: HexagramDisplayProps) {
    const { Colors } = useTheme();
    const palette = useMemo(() => buildResultPalette(Colors), [Colors]);
    const styles = useMemo(() => makeStyles(palette), [palette]);
    const [flipped, setFlipped] = useState(false);
    const flip = useRef(new Animated.Value(0)).current;
    const hasBian = Boolean(result.bianGua && result.bianGuaYao?.length === 6);

    const toneColor = (mark: LiuyaoMark) => (mark.tone === 'good' ? Colors.bazi.statePositive : mark.tone === 'bad' ? Colors.bazi.stateNegative : palette.muted);
    const zhiColor = (zhi: string) => {
        const element = getGanZhiElement(zhi);
        return element ? palette.element[element] : palette.ink;
    };
    const shenColor: Record<string, string> = {
        青龙: Colors.liushen.qinglong, 朱雀: Colors.liushen.zhuque, 勾陈: Colors.liushen.gouchen,
        螣蛇: Colors.liushen.tengshe, 白虎: Colors.liushen.baihu, 玄武: Colors.liushen.xuanwu,
    };

    const toggle = () => {
        if (!hasBian) return;
        Animated.spring(flip, { toValue: flipped ? 0 : 1, friction: 8, tension: 40, useNativeDriver: true }).start();
        setFlipped(!flipped);
    };
    const front = { transform: [{ perspective: 1000 }, { rotateY: flip.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) }] };
    const back = { transform: [{ perspective: 1000 }, { rotateY: flip.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] }) }] };

    const seal = (text: string, primary: boolean) => (
        <View style={[styles.seal, !primary && styles.sealMuted]}>
            <Text style={[styles.sealText, !primary && styles.sealTextMuted]}>{text}</Text>
        </View>
    );
    const shiYing = (isShi: boolean, isYing: boolean) => (isShi || isYing ? seal(isShi ? '世' : '应', isShi) : null);
    const naJia = (liuQin: string, zhi: string, size: 'lg' | 'sm', qinColor: string) => (
        <View style={styles.naJia}>
            <Text style={[size === 'lg' ? styles.qin : styles.qinSmall, { color: qinColor }]}>{liuQin}</Text>
            <WuXingIcon element={zhi} size={size === 'lg' ? 14 : 13} />
            <Text style={[size === 'lg' ? styles.zhi : styles.zhiSmall, { color: zhiColor(zhi) }]}>{zhi}</Text>
        </View>
    );
    const highlight = (hit: boolean) => (hit ? styles.rowHit : null);

    const header = (isFront: boolean) => {
        const gua = isFront ? result.benGua : result.bianGua!;
        const other = isFront ? result.bianGua : result.benGua;
        return (
            <View style={styles.faceHeader}>
                <View style={styles.faceTitle}>
                    {seal(isFront ? '本卦' : '变卦', isFront)}
                    <Text style={styles.guaName}>{gua.fullName}</Text>
                    <Text style={styles.guaMeta}>{gua.gong}宫</Text>
                </View>
                {hasBian && other ? (
                    <Pressable onPress={toggle} style={({ pressed }) => [styles.flipBtn, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={isFront ? '翻看变卦' : '翻回本卦'}>
                        <Text style={styles.flipLabel}>{isFront ? '变卦' : '本卦'}</Text>
                        <Text style={styles.flipName}>{other.fullName}</Text>
                        <Text style={styles.flipIcon}>⟲</Text>
                    </Pressable>
                ) : (
                    <View style={styles.staticTag}><Text style={styles.staticText}>静卦 · 无变卦</Text></View>
                )}
            </View>
        );
    };

    const benRows = [...result.benGuaYao].reverse();
    const frontFace = (
        <>
            {header(true)}
            <View style={[styles.row, styles.headRow]}>
                <Text style={[styles.colHead, styles.c0]}>六神</Text>
                <Text style={[styles.colHead, styles.c1]}>伏神</Text>
                <Text style={[styles.colHead, styles.c2]}>六亲</Text>
                <Text style={[styles.colHead, styles.c3, styles.center]}>卦画</Text>
                <Text style={[styles.colHead, styles.c4]}>世应</Text>
                {hasBian ? <Text style={[styles.colHead, styles.c5]}>化出</Text> : null}
            </View>
            {benRows.map((yao: YaoDetail) => {
                const yaoStatus = status.yao[yao.position - 1];
                const hit = yao.liuQin === yong || yao.fuShen?.liuQin === yong;
                const marks = yaoStatus.marks.slice(0, 2);
                const lineColor = yao.isMoving ? palette.vermilion : palette.gold;
                return (
                    <View key={yao.position} style={[styles.row, highlight(hit)]}>
                        {hit ? <View style={styles.hitBar} /> : null}
                        <View style={[styles.c0, styles.shen]}>
                            <LiuShenIcon liuShen={yao.liuShen} size={16} />
                            <Text style={[styles.shenText, { color: shenColor[yao.liuShen] }]}>{yao.liuShen}</Text>
                        </View>
                        <Text style={[styles.c1, styles.fu]} numberOfLines={1}>
                            {yao.fuShen ? <>{FU_SHORT[yao.fuShen.liuQin]}<Text style={{ color: zhiColor(yao.fuShen.zhi) }}>{yao.fuShen.zhi}</Text></> : ''}
                        </Text>
                        <View style={[styles.c2, styles.naJiaCell]}>
                            {naJia(yao.liuQin, yao.zhi, 'lg', yao.isMoving ? palette.vermilion : palette.body)}
                            <View style={styles.marks}>
                                {marks.map((mark) => <Text key={mark.label} style={[styles.mark, { color: toneColor(mark) }]}>{mark.short}</Text>)}
                            </View>
                        </View>
                        <View style={[styles.c3, styles.lineCell]}>
                            <YaoLine yang={yao.nature === 'yang'} width={hasBian ? 54 : 72} color={lineColor} />
                            <Text style={styles.moveMark}>{yao.isMoving ? (yao.value === 9 ? '○' : '×') : ''}</Text>
                        </View>
                        <View style={styles.c4}>{shiYing(yao.isShi, yao.isYing)}</View>
                        {hasBian ? (
                            <View style={styles.c5}>
                                {yao.isMoving && yao.bianZhi && yao.bianLiuQin ? naJia(yao.bianLiuQin, yao.bianZhi, 'sm', palette.body) : null}
                            </View>
                        ) : null}
                    </View>
                );
            })}
        </>
    );

    const bianRows = hasBian ? [...result.bianGuaYao!].reverse() : [];
    const backFace = hasBian ? (
        <>
            {header(false)}
            <View style={[styles.row, styles.headRow]}>
                <Text style={[styles.colHead, styles.c0]}>爻位</Text>
                <Text style={[styles.colHead, styles.c1]} />
                <Text style={[styles.colHead, styles.c2]}>六亲</Text>
                <Text style={[styles.colHead, styles.c3, styles.center]}>卦画</Text>
                <Text style={[styles.colHead, styles.c4]}>世应</Text>
                <Text style={[styles.colHead, styles.c5]}>本爻</Text>
            </View>
            {bianRows.map((yao: YaoDetail) => {
                const source = result.benGuaYao[yao.position - 1];
                const changed = source.isMoving;
                return (
                    <View key={yao.position} style={[styles.row, highlight(yao.liuQin === yong)]}>
                        {yao.liuQin === yong ? <View style={styles.hitBar} /> : null}
                        <Text style={[styles.c0, styles.pos]}>{yao.positionName}爻</Text>
                        <View style={styles.c1} />
                        <View style={[styles.c2, styles.naJiaCell]}>{naJia(yao.liuQin, yao.zhi, 'lg', changed ? palette.vermilion : palette.body)}</View>
                        <View style={[styles.c3, styles.lineCell]}>
                            <YaoLine yang={yao.nature === 'yang'} width={54} color={changed ? palette.vermilion : palette.gold} />
                            <Text style={styles.moveMark} />
                        </View>
                        <View style={styles.c4}>{shiYing(result.bianGua!.shiYao === yao.position, result.bianGua!.yingYao === yao.position)}</View>
                        <View style={[styles.c5, styles.dim]}>{changed ? naJia(source.liuQin, source.zhi, 'sm', palette.body) : null}</View>
                    </View>
                );
            })}
        </>
    ) : null;

    return (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <View style={styles.diamond} />
                <Text style={styles.cardTitle}>卦盘</Text>
                <View style={styles.spacer} />
                <View style={styles.segment} accessibilityRole="radiogroup" accessibilityLabel="用神">
                    {LIUQIN_OPTIONS.map((liuQin) => {
                        const on = liuQin === yong;
                        return (
                            <Pressable key={liuQin} onPress={() => onYongChange(liuQin)} style={[styles.segmentBtn, on && styles.segmentBtnOn]} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={liuQin}>
                                <Text style={[styles.segmentText, on && styles.segmentTextOn]}>{liuQin}</Text>
                            </Pressable>
                        );
                    })}
                </View>
            </View>

            <View style={styles.faces}>
                <Animated.View style={[styles.face, front, styles.hiddenBack]} pointerEvents={flipped ? 'none' : 'auto'}>
                    {frontFace}
                </Animated.View>
                {backFace ? (
                    <Animated.View style={[styles.face, styles.faceBack, back, styles.hiddenBack]} pointerEvents={flipped ? 'auto' : 'none'}>
                        {backFace}
                    </Animated.View>
                ) : null}
            </View>

            <View style={styles.summary}>
                <Text style={styles.summaryLabel}>用神</Text>
                <Text style={styles.summaryText}>{status.summary[yong]}</Text>
            </View>
        </View>
    );
}

export default React.memo(HexagramDisplayComponent);

function makeStyles(palette: ResultPalette) {
    return StyleSheet.create({
        card: { padding: 12, paddingBottom: 10, borderRadius: 12, borderWidth: 1, borderColor: palette.cardBorder, backgroundColor: palette.card },
        cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
        diamond: { width: 6, height: 6, backgroundColor: palette.vermilion, transform: [{ rotate: '45deg' }] },
        cardTitle: { fontSize: 15, lineHeight: 22, fontWeight: '700', color: palette.heading },
        spacer: { flex: 1 },
        segment: { flexDirection: 'row', padding: 2, gap: 2, borderRadius: 13, borderWidth: 1, borderColor: palette.segBorder, backgroundColor: palette.segTrack },
        segmentBtn: { height: 22, paddingHorizontal: 7, borderRadius: 11, borderWidth: 1, borderColor: 'transparent', justifyContent: 'center' },
        segmentBtnOn: { borderColor: palette.segBorder, backgroundColor: palette.segOn },
        segmentText: { fontSize: 12, fontWeight: '600', color: palette.muted },
        segmentTextOn: { color: palette.ink },
        faces: { marginTop: 8, height: FACE_HEIGHT },
        face: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
        faceBack: {},
        hiddenBack: { backfaceVisibility: 'hidden' },
        faceHeader: { height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
        faceTitle: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
        seal: { height: 18, paddingHorizontal: 4, borderRadius: 3, justifyContent: 'center', backgroundColor: palette.vermilion },
        sealMuted: { backgroundColor: palette.chipBg },
        sealText: { fontSize: 11, lineHeight: 14, fontWeight: '700', letterSpacing: 1, color: palette.sealText },
        sealTextMuted: { color: palette.chipInk },
        guaName: { fontSize: 18, lineHeight: 24, fontWeight: '700', color: palette.heading },
        guaMeta: { fontSize: 12, color: palette.muted },
        flipBtn: {
            height: 30, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10,
            borderRadius: 15, borderWidth: 1, borderColor: palette.segBorder, backgroundColor: palette.segTrack,
        },
        flipLabel: { fontSize: 12, color: palette.muted },
        flipName: { fontSize: 12, fontWeight: '600', color: palette.ink },
        flipIcon: { fontSize: 13, color: palette.gold },
        staticTag: { height: 30, justifyContent: 'center', paddingHorizontal: 10, borderRadius: 15, borderWidth: 1, borderStyle: 'dashed', borderColor: palette.segBorder },
        staticText: { fontSize: 12, color: palette.muted },
        row: { position: 'relative', height: ROW_HEIGHT, flexDirection: 'row', alignItems: 'center', gap: 3, borderBottomWidth: 1, borderBottomColor: palette.hairline },
        headRow: { height: 22, alignItems: 'flex-end', paddingBottom: 4, borderBottomColor: palette.rule },
        colHead: { fontSize: 11, lineHeight: 15, color: palette.muted },
        center: { textAlign: 'center' },
        c0: { width: 46 },
        c1: { width: 32 },
        c2: { width: 78 },
        c3: { flex: 1 },
        c4: { width: 28 },
        c5: { width: 66 },
        rowHit: { backgroundColor: palette.dayTint },
        hitBar: { position: 'absolute', left: -12, top: 8, bottom: 8, width: 3, borderTopRightRadius: 2, borderBottomRightRadius: 2, backgroundColor: palette.gold },
        shen: { flexDirection: 'row', alignItems: 'center', gap: 2 },
        shenText: { fontSize: 12 },
        fu: { fontSize: 10.5, color: palette.muted },
        naJiaCell: { flexDirection: 'row', alignItems: 'center' },
        naJia: { flexDirection: 'row', alignItems: 'center', gap: 2 },
        qin: { fontSize: 13 },
        qinSmall: { fontSize: 12 },
        zhi: { fontSize: 20, lineHeight: 24, fontWeight: '700' },
        zhiSmall: { fontSize: 18, lineHeight: 22, fontWeight: '700' },
        marks: { alignSelf: 'flex-start', marginTop: 5, marginLeft: 1 },
        mark: { fontSize: 10, lineHeight: 11 },
        lineCell: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
        moveMark: { width: 10, fontSize: 12, fontWeight: '700', color: palette.vermilion },
        pos: { fontSize: 11, color: palette.muted },
        dim: { opacity: 0.75 },
        summary: { flexDirection: 'row', gap: 8, paddingTop: 8 },
        summaryLabel: { fontSize: 12.5, lineHeight: 19, color: palette.muted },
        summaryText: { flex: 1, fontSize: 12.5, lineHeight: 19, color: palette.body },
        pressed: { opacity: 0.75 },
    });
}
