import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import ZodiacPaperCut from '../../../components/ZodiacPaperCut';
import type { ZiweiMutagen, ZiweiPalaceAnalysisView, ZiweiStarViewModel } from '../types';
import { parseMutKey, verticalTextOf, ZIWEI_MUTAGEN_ORDER, type ZiweiScopeLayer } from '../scope-layer';
import { triadAnchor, type ZiweiStageLayout, type ZiweiTileFrame } from './layout';
import { useZiweiSelectedIndex, type ZiweiSelectionStore } from './selection-store';
import { ganzhiColor, type ZiweiPalette } from './palette';

/* ------------------------------------------------------------------ */
/* 样式：按配色与字号档位生成一次，所有宫格共用                           */
/* ------------------------------------------------------------------ */

/** 宫格纵向分区（按字号档位缩放）：底栏三行十二神，运限行压在底栏之上，其余高度留给星曜 */
const TILE_FOOTER_HEIGHT = 35;
const TILE_SCOPE_BOTTOM = 41;
const TILE_SCOPE_HEIGHT = 12;
const TILE_STAR_TOP = 4;
const STAR_GAP = 2;
const STAR_ROW_GAP = 3;

export function makeBoardStyles(palette: ZiweiPalette, fontScale: number) {
    const f = (value: number) => Math.round(value * fontScale * 10) / 10;
    const base = { includeFontPadding: false } as const;
    return StyleSheet.create({
        board: {
            position: 'relative',
            borderRadius: 12,
            overflow: 'hidden',
            backgroundColor: palette.grid,
        },
        cell: { position: 'absolute', backgroundColor: palette.card },
        cellSelected: { position: 'absolute', backgroundColor: palette.selectedTint },
        tile: { position: 'absolute', overflow: 'hidden' },
        starArea: {
            position: 'absolute',
            left: 5,
            right: 4,
            top: TILE_STAR_TOP,
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: f(STAR_GAP),
        },
        starSide: { flex: 1, minWidth: 0, overflow: 'hidden' },
        starHidden: { opacity: 0 },
        starWrap: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'flex-start',
            columnGap: f(STAR_GAP),
            rowGap: f(STAR_ROW_GAP),
        },
        starCol: { alignItems: 'center' },
        starMajor: { ...base, fontSize: f(14), lineHeight: f(15), fontWeight: '700', color: palette.heading, textAlign: 'center' },
        starMinor: { ...base, fontSize: f(11), lineHeight: f(12), fontWeight: '500', color: palette.body, textAlign: 'center' },
        starAdj: { ...base, fontSize: f(9.5), lineHeight: f(10.5), color: palette.muted, textAlign: 'center' },
        brightness: { ...base, marginTop: 1, fontSize: f(8.5), lineHeight: f(10), color: palette.faint },
        chipRow: { marginTop: 1, flexDirection: 'row', gap: 1 },
        chipStack: { flexDirection: 'column' },
        chip: {
            width: f(12),
            height: f(12),
            borderRadius: 2,
            alignItems: 'center',
            justifyContent: 'center',
        },
        chipText: { ...base, fontSize: f(8.5), lineHeight: f(10), fontWeight: '700' },
        more: { ...base, position: 'absolute', right: 0, bottom: 0, fontSize: f(9), lineHeight: f(10), color: palette.faint },
        scopeRow: {
            position: 'absolute',
            left: 5,
            right: 4,
            bottom: f(TILE_SCOPE_BOTTOM),
            flexDirection: 'row',
            alignItems: 'center',
            gap: 3,
            overflow: 'hidden',
        },
        scopeTag: {
            paddingHorizontal: 2,
            borderRadius: 3,
            borderWidth: 1,
            borderColor: palette.goldBorder,
            backgroundColor: palette.goldSoft,
        },
        scopeTagMing: { borderColor: palette.gold, backgroundColor: palette.gold },
        scopeTagText: { ...base, fontSize: f(9), lineHeight: f(12), fontWeight: '600', color: palette.gold },
        scopeTagTextMing: { color: palette.card },
        flows: { ...base, flexShrink: 1, fontSize: f(8.5), lineHeight: f(12), color: palette.gold },
        footer: {
            position: 'absolute',
            left: 5,
            right: 4,
            bottom: 4,
            height: f(TILE_FOOTER_HEIGHT),
            flexDirection: 'row',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
        },
        gods: { ...base, fontSize: f(8.5), lineHeight: f(10.5), color: palette.faint },
        branchBlock: { alignItems: 'center' },
        nameBlock: { alignItems: 'center' },
        nameRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
        badge: {
            width: f(11),
            height: f(11),
            borderRadius: 2,
            borderWidth: 1,
            alignItems: 'center',
            justifyContent: 'center',
        },
        badgeText: { ...base, fontSize: f(8), lineHeight: f(9) },
        palaceName: { ...base, fontSize: f(12), lineHeight: f(14), fontWeight: '600', color: palette.ink },
        range: { ...base, fontSize: f(8.5), lineHeight: f(10), color: palette.muted, fontVariant: ['tabular-nums'] },
        stemBranch: { ...base, fontSize: f(11), lineHeight: f(12), fontWeight: '600', textAlign: 'center' },
        center: { position: 'absolute', alignItems: 'center', paddingHorizontal: 12, paddingTop: f(12) },
        centerSoul: { ...base, fontSize: f(10.5), lineHeight: f(14), color: palette.muted },
        pillars: { marginTop: f(6), flexDirection: 'row', gap: f(10) },
        pillarText: { ...base, fontSize: f(12.5), lineHeight: f(15), fontWeight: '600', textAlign: 'center' },
        centerRule: { marginTop: f(9), alignSelf: 'stretch', height: 1, backgroundColor: palette.hairline },
        headRow: { marginTop: f(9), flexDirection: 'row', alignItems: 'baseline', gap: 6 },
        headChip: {
            paddingHorizontal: 4,
            borderRadius: 3,
            borderWidth: 1,
            borderColor: palette.goldBorder,
            backgroundColor: palette.goldSoft,
        },
        headChipText: { ...base, fontSize: f(10), lineHeight: f(14), fontWeight: '600', color: palette.gold },
        headMain: { ...base, fontSize: f(15), lineHeight: f(20), fontWeight: '700', color: palette.heading, fontVariant: ['tabular-nums'] },
        headSub: { ...base, marginTop: 2, fontSize: f(10.5), lineHeight: f(14), color: palette.muted, textAlign: 'center' },
        mutGrid: { marginTop: f(8), flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: f(12), rowGap: f(5), width: '100%' },
        mutItem: { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: '40%' },
        mutStar: { ...base, fontSize: f(12), lineHeight: f(16), color: palette.ink },
        bigChip: {
            width: f(15),
            height: f(15),
            borderRadius: 3,
            alignItems: 'center',
            justifyContent: 'center',
        },
        bigChipText: { ...base, fontSize: f(10), lineHeight: f(13), fontWeight: '700' },
        halo: { textShadowColor: palette.card, textShadowRadius: 3, textShadowOffset: { width: 0, height: 0 } },
        overlay: { ...StyleSheet.absoluteFill },
        ring: { position: 'absolute', borderWidth: 1.5, borderColor: palette.vermilion },
        triadBar: { position: 'absolute', height: 2, backgroundColor: palette.vermilion },
        seal: { position: 'absolute' },
    });
}

export type ZiweiBoardStyles = ReturnType<typeof makeBoardStyles>;

/* ------------------------------------------------------------------ */
/* 四化标记                                                             */
/* ------------------------------------------------------------------ */

export function MutagenChip({
    mutagen,
    filled,
    palette,
    styles,
    big = false,
}: {
    mutagen: ZiweiMutagen;
    filled: boolean;
    palette: ZiweiPalette;
    styles: ZiweiBoardStyles;
    big?: boolean;
}) {
    const color = palette.mutagen[mutagen];
    const textColor = filled ? (mutagen === '忌' ? palette.jiText : palette.sealText) : color;
    return (
        <View
            style={[
                big ? styles.bigChip : styles.chip,
                filled ? { backgroundColor: color } : { borderWidth: 1, borderColor: color },
            ]}
        >
            <Text style={[big ? styles.bigChipText : styles.chipText, { color: textColor }]}>{mutagen}</Text>
        </View>
    );
}

/* ------------------------------------------------------------------ */
/* 星曜层：只取决于本命数据与本宫的运限四化                                 */
/* ------------------------------------------------------------------ */

type StarKind = 'major' | 'minor' | 'adj';

/** 生年、运限两个四化标上下叠放时，带双标的主星列高（字 2×15 + 亮度 11 + 两标 2×13） */
const STACKED_CHIP_COLUMN = 67;

/**
 * 星曜排版交给布局引擎：左边主星（最多两颗）一列一列排，右边辅星、杂曜放进自动换行区，
 * 换不换行、换到哪由引擎按真实字宽决定，不同机型、字体与系统字号下都不会错位。
 * 换下来的星从右区左边起排，落在辅星、杂曜下面，不会压到主星的四化标；
 * 右区每颗星由引擎回报实际落点，排不进可用高度的整颗隐去（不裁半截），角上显示「…」提示详情里有完整星曜。
 */
const TileStars = memo(function TileStars({
    palace,
    mutKey,
    height,
    fontScale,
    palette,
    styles,
}: {
    palace: ZiweiPalaceAnalysisView;
    mutKey: string;
    height: number;
    fontScale: number;
    palette: ZiweiPalette;
    styles: ZiweiBoardStyles;
}) {
    const scopeMutagens = useMemo(() => parseMutKey(mutKey), [mutKey]);
    const limit = height - TILE_STAR_TOP - (TILE_SCOPE_BOTTOM + TILE_SCOPE_HEIGHT) * fontScale - 2;
    // 格子够高才把两个四化标上下叠放（列宽不翻倍）；矮格子仍并排，免得压到运限行
    const stackChips = limit >= STACKED_CHIP_COLUMN * fontScale;
    const moreHeight = 10 * fontScale;
    const moreWidth = 10 * fontScale;
    const sideStars = useMemo(() => [
        ...palace.minorStars.map((star) => ({ star, kind: 'minor' as const })),
        ...palace.adjectiveStars.map((star) => ({ star, kind: 'adj' as const })),
    ], [palace]);
    // 右区尺寸或某颗星尺寸一变，合并到下一个任务把各星相对右区的实际位置量一遍（真机、Web 一致；
    // 不用动画帧，后台页面里它会被暂停）。按顺序取能完整放下的前缀；有隐藏时「…」占右下角，压到那一角的星也让出来
    const wrapRef = useRef<View>(null);
    const wrapWidthRef = useRef(0);
    const itemRefs = useRef<Array<View | null>>([]);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [visibleCount, setVisibleCount] = useState(Number.POSITIVE_INFINITY);
    const remeasure = useCallback(() => {
        if (timerRef.current !== null || sideStars.length === 0) {
            return;
        }
        timerRef.current = setTimeout(() => {
            timerRef.current = null;
            const wrap = wrapRef.current;
            if (!wrap) {
                return;
            }
            const boxes: Array<{ right: number; bottom: number } | undefined> = new Array(sideStars.length);
            let pending = sideStars.length;
            const settle = () => {
                pending -= 1;
                if (pending > 0) {
                    return;
                }
                const fits = (index: number, reserveCorner: boolean) => {
                    const box = boxes[index];
                    if (!box || box.bottom > limit + 0.5) {
                        return false;
                    }
                    const inCorner = box.right > wrapWidthRef.current - moreWidth && box.bottom > limit - moreHeight + 0.5;
                    return !(reserveCorner && inCorner);
                };
                const prefix = (reserveCorner: boolean) => {
                    let count = 0;
                    while (count < boxes.length && fits(count, reserveCorner)) {
                        count += 1;
                    }
                    return count;
                };
                const full = prefix(false);
                const next = full === boxes.length ? full : prefix(true);
                setVisibleCount((current) => (current === next ? current : next));
            };
            sideStars.forEach((_, index) => {
                const item = itemRefs.current[index];
                if (!item) {
                    settle();
                    return;
                }
                item.measureLayout(wrap, (x, y, itemWidth, itemHeight) => {
                    boxes[index] = { right: x + itemWidth, bottom: y + itemHeight };
                    settle();
                }, settle);
            });
        }, 0);
    }, [limit, moreHeight, moreWidth, sideStars]);
    const handleWrapLayout = useCallback((event: LayoutChangeEvent) => {
        wrapWidthRef.current = event.nativeEvent.layout.width;
        remeasure();
    }, [remeasure]);
    useEffect(() => () => {
        // 置空：开发模式会先卸载再挂载，留着旧句柄的话之后的测量都会被当成「已排队」跳过
        if (timerRef.current !== null) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);
    const hiddenCount = Number.isFinite(visibleCount) ? sideStars.length - visibleCount : 0;

    const renderColumn = (star: ZiweiStarViewModel, kind: StarKind, order = -1) => {
        const scopeMutagen = kind === 'adj' ? undefined : scopeMutagens[star.name];
        return (
            <View
                key={star.name}
                ref={order >= 0 ? (node) => { itemRefs.current[order] = node; } : undefined}
                style={[styles.starCol, order >= visibleCount && styles.starHidden]}
                onLayout={order >= 0 ? remeasure : undefined}
            >
                <Text style={kind === 'major' ? styles.starMajor : kind === 'minor' ? styles.starMinor : styles.starAdj}>
                    {verticalTextOf(star.name)}
                </Text>
                {kind !== 'adj' || star.brightness ? <Text style={styles.brightness}>{star.brightness || ' '}</Text> : null}
                {star.mutagen || scopeMutagen ? (
                    <View style={[styles.chipRow, stackChips && styles.chipStack]}>
                        {star.mutagen ? <MutagenChip mutagen={star.mutagen as ZiweiMutagen} filled palette={palette} styles={styles} /> : null}
                        {scopeMutagen ? <MutagenChip mutagen={scopeMutagen} filled={false} palette={palette} styles={styles} /> : null}
                    </View>
                ) : null}
            </View>
        );
    };

    return (
        <View style={[styles.starArea, { height: limit }]} pointerEvents="none">
            {palace.majorStars.map((star) => renderColumn(star, 'major'))}
            <View style={[styles.starSide, { maxHeight: limit }]}>
                <View ref={wrapRef} style={styles.starWrap} onLayout={handleWrapLayout}>
                    {sideStars.map(({ star, kind }, order) => renderColumn(star, kind, order))}
                </View>
            </View>
            {hiddenCount > 0 ? <Text style={styles.more}>…</Text> : null}
        </View>
    );
});

/* ------------------------------------------------------------------ */
/* 运限层：每宫一行角色与流曜                                             */
/* ------------------------------------------------------------------ */

const TileScopeRow = memo(function TileScopeRow({
    tag,
    isMing,
    flows,
    styles,
}: {
    tag: string;
    isMing: boolean;
    flows: string;
    styles: ZiweiBoardStyles;
}) {
    if (!tag) {
        return null;
    }
    return (
        <View style={styles.scopeRow} pointerEvents="none">
            <View style={[styles.scopeTag, isMing && styles.scopeTagMing]}>
                <Text style={[styles.scopeTagText, isMing && styles.scopeTagTextMing]}>{tag}</Text>
            </View>
            {flows ? <Text style={styles.flows} numberOfLines={1}>{flows}</Text> : null}
        </View>
    );
});

const TileFooter = memo(function TileFooter({
    palace,
    palette,
    styles,
}: {
    palace: ZiweiPalaceAnalysisView;
    palette: ZiweiPalette;
    styles: ZiweiBoardStyles;
}) {
    const range = palace.decadalRange.replace(/[^\d–-]/g, '').replace('-', '–');
    return (
        <View style={styles.footer} pointerEvents="none">
            <Text style={styles.gods}>{`${palace.boshi12}\n${palace.jiangqian12}\n${palace.suiqian12}`}</Text>
            <View style={styles.nameBlock}>
                <View style={styles.nameRow}>
                    {palace.isBodyPalace ? (
                        <View style={[styles.badge, { borderColor: palette.vermilion }]}>
                            <Text style={[styles.badgeText, { color: palette.vermilion, fontWeight: '700' }]}>身</Text>
                        </View>
                    ) : null}
                    {palace.isOriginalPalace ? (
                        <View style={[styles.badge, { borderColor: palette.muted }]}>
                            <Text style={[styles.badgeText, { color: palette.muted }]}>因</Text>
                        </View>
                    ) : null}
                    <Text style={styles.palaceName}>{palace.name}</Text>
                </View>
                <Text style={styles.range}>{range}</Text>
            </View>
            <View style={styles.branchBlock}>
                <Text style={styles.gods}>{palace.changsheng12}</Text>
                <Text style={[styles.stemBranch, { color: ganzhiColor(palace.heavenlyStem, palette) }]}>{palace.heavenlyStem}</Text>
                <Text style={[styles.stemBranch, { color: ganzhiColor(palace.earthlyBranch, palette) }]}>{palace.earthlyBranch}</Text>
            </View>
        </View>
    );
});

const DOUBLE_TAP_MS = 250;
const returnTrue = () => true;

const ZiweiTile = memo(function ZiweiTile({
    index,
    palace,
    frame,
    tag,
    isMing,
    flows,
    mutKey,
    fontScale,
    palette,
    styles,
    onSelect,
    onDoubleTap,
}: {
    index: number;
    palace: ZiweiPalaceAnalysisView;
    frame: ZiweiTileFrame;
    tag: string;
    isMing: boolean;
    flows: string;
    mutKey: string;
    fontScale: number;
    palette: ZiweiPalette;
    styles: ZiweiBoardStyles;
    onSelect: (index: number) => void;
    onDoubleTap?: (index: number) => void;
}) {
    const lastTapRef = useRef(0);
    const handlePress = useCallback(() => {
        const now = Date.now();
        if (onDoubleTap && now - lastTapRef.current < DOUBLE_TAP_MS) {
            lastTapRef.current = 0;
            onDoubleTap(index);
            return;
        }
        lastTapRef.current = now;
        // 单击立即生效，不等双击判定
        onSelect(index);
    }, [index, onDoubleTap, onSelect]);

    // 用最轻的响应者 View：Pressable 每格都要挂一套按压状态机，十二格重画时开销明显
    return (
        <View
            onStartShouldSetResponder={returnTrue}
            onResponderRelease={handlePress}
            style={[styles.tile, frame]}
            accessible
            accessibilityRole="button"
            accessibilityLabel={`${palace.name}，${palace.majorStars.map((star) => star.name).join('、') || '空宫'}`}
            onAccessibilityTap={handlePress}
        >
            <TileStars palace={palace} mutKey={mutKey} height={frame.height} fontScale={fontScale} palette={palette} styles={styles} />
            <TileScopeRow tag={tag} isMing={isMing} flows={flows} styles={styles} />
            <TileFooter palace={palace} palette={palette} styles={styles} />
        </View>
    );
});

/* ------------------------------------------------------------------ */
/* 底色层与选中层：点宫位时只有这两层重画                                   */
/* ------------------------------------------------------------------ */

const CellBackground = memo(function CellBackground({
    layout,
    selection,
    isValid,
    fallbackIndex,
    styles,
}: {
    layout: ZiweiStageLayout;
    selection: ZiweiSelectionStore;
    isValid: (index: number) => boolean;
    fallbackIndex: number;
    styles: ZiweiBoardStyles;
}) {
    const selectedIndex = useZiweiSelectedIndex(selection, isValid, fallbackIndex);
    return (
        <>
            {layout.frames.map((frame, index) => (
                <View key={index} style={[index === selectedIndex ? styles.cellSelected : styles.cell, frame]} />
            ))}
            <View style={[styles.cell, layout.center]} />
        </>
    );
});

const SelectionLayer = memo(function SelectionLayer({
    layout,
    palaces,
    selection,
    isValid,
    fallbackIndex,
    palette,
    styles,
}: {
    layout: ZiweiStageLayout;
    palaces: ZiweiPalaceAnalysisView[];
    selection: ZiweiSelectionStore;
    isValid: (index: number) => boolean;
    fallbackIndex: number;
    palette: ZiweiPalette;
    styles: ZiweiBoardStyles;
}) {
    const selectedIndex = useZiweiSelectedIndex(selection, isValid, fallbackIndex);
    const triad = useMemo<[number, number, number] | null>(() => {
        const selected = palaces.find((palace) => palace.palaceIndex === selectedIndex);
        if (!selected) {
            return null;
        }
        const indexOf = (name: string) => palaces.find((palace) => palace.name === name)?.palaceIndex ?? -1;
        return [indexOf(selected.surrounded.opposite), indexOf(selected.surrounded.wealth), indexOf(selected.surrounded.career)];
    }, [palaces, selectedIndex]);
    const selectedFrame = layout.frames[selectedIndex];
    if (!selectedFrame) {
        return null;
    }
    const anchors = triad ? triad.map((index) => (layout.frames[index] ? triadAnchor(layout.frames[index], layout.center) : null)) : [];
    const self = triadAnchor(selectedFrame, layout.center);
    const [opposite, wealth, career] = anchors;
    return (
        <View style={styles.overlay} pointerEvents="none">
            {triad?.map((index) => (layout.frames[index] ? (
                <View key={index} style={[styles.triadBar, { left: layout.frames[index].left, top: layout.frames[index].top, width: layout.frames[index].width }]} />
            ) : null))}
            <View style={[styles.ring, selectedFrame]} />
            <Svg width={layout.boardWidth} height={layout.boardHeight} style={StyleSheet.absoluteFill}>
                {wealth ? <Line x1={self.x} y1={self.y} x2={wealth.x} y2={wealth.y} stroke={palette.triadLine} strokeWidth={1} /> : null}
                {career ? <Line x1={self.x} y1={self.y} x2={career.x} y2={career.y} stroke={palette.triadLine} strokeWidth={1} /> : null}
                {wealth && career ? <Line x1={wealth.x} y1={wealth.y} x2={career.x} y2={career.y} stroke={palette.triadLine} strokeWidth={1} /> : null}
                {opposite ? <Line x1={self.x} y1={self.y} x2={opposite.x} y2={opposite.y} stroke={palette.triadLine} strokeWidth={1} strokeDasharray="3 3" /> : null}
                {[self, opposite, wealth, career].map((point, order) => (point ? (
                    <Circle key={order} cx={point.x} cy={point.y} r={2} fill={palette.vermilion} />
                ) : null))}
            </Svg>
        </View>
    );
});

/* ------------------------------------------------------------------ */
/* 中宫                                                                 */
/* ------------------------------------------------------------------ */

const CenterStatic = memo(function CenterStatic({
    frame,
    soul,
    body,
    chineseDate,
    zodiac,
    palette,
    styles,
}: {
    frame: ZiweiTileFrame;
    soul: string;
    body: string;
    chineseDate: string;
    zodiac: string | null;
    palette: ZiweiPalette;
    styles: ZiweiBoardStyles;
}) {
    const sealSize = Math.floor(Math.min(frame.width, frame.height) * 0.98);
    const pillars = chineseDate.split(' ').filter(Boolean);
    return (
        <>
            {zodiac ? (
                <ZodiacPaperCut
                    zodiac={zodiac}
                    size={sealSize}
                    opacity={palette.sealOpacity}
                    style={[styles.seal, { left: (frame.width - sealSize) / 2 + 6, top: (frame.height - sealSize) / 2 + 2 }]}
                />
            ) : null}
            <Text style={[styles.centerSoul, styles.halo]}>{`命主 ${soul} · 身主 ${body}`}</Text>
            <View style={styles.pillars}>
                {pillars.map((pillar, index) => (
                    <View key={index}>
                        {pillar.split('').map((char, charIndex) => (
                            <Text key={charIndex} style={[styles.pillarText, styles.halo, { color: ganzhiColor(char, palette) }]}>{char}</Text>
                        ))}
                    </View>
                ))}
            </View>
        </>
    );
});

const CenterHead = memo(function CenterHead({
    layer,
    palette,
    styles,
}: {
    layer: ZiweiScopeLayer;
    palette: ZiweiPalette;
    styles: ZiweiBoardStyles;
}) {
    return (
        <>
            <View style={styles.centerRule} />
            <View style={styles.headRow}>
                <View style={styles.headChip}>
                    <Text style={styles.headChipText}>{layer.head.label}</Text>
                </View>
                <Text style={[styles.headMain, styles.halo]}>
                    {layer.head.main}
                    {layer.head.mainGanzhi ? ' · ' : ''}
                    {layer.head.mainGanzhi.split('').map((char, index) => (
                        <Text key={index} style={{ color: ganzhiColor(char, palette) }}>{char}</Text>
                    ))}
                </Text>
            </View>
            <Text style={[styles.headSub, styles.halo]} numberOfLines={1}>{layer.head.sub}</Text>
            <View style={styles.mutGrid}>
                {ZIWEI_MUTAGEN_ORDER.map((mutagen, order) => (layer.mutagenStars[order] ? (
                    <View key={mutagen} style={styles.mutItem}>
                        <MutagenChip mutagen={mutagen} filled={layer.filledMutagen} palette={palette} styles={styles} big />
                        <Text style={[styles.mutStar, styles.halo]}>{layer.mutagenStars[order]}</Text>
                    </View>
                ) : null))}
            </View>
        </>
    );
});

/* ------------------------------------------------------------------ */
/* 棋盘                                                                 */
/* ------------------------------------------------------------------ */

export interface ZiweiBoardViewProps {
    palaces: ZiweiPalaceAnalysisView[];
    layout: ZiweiStageLayout;
    layer: ZiweiScopeLayer | null;
    selection: ZiweiSelectionStore;
    isValidIndex: (index: number) => boolean;
    fallbackIndex: number;
    soul: string;
    body: string;
    chineseDate: string;
    zodiac: string | null;
    palette: ZiweiPalette;
    styles: ZiweiBoardStyles;
    onSelect: (index: number) => void;
    onDoubleTap?: (index: number) => void;
}

function ZiweiBoardViewBase({
    palaces,
    layout,
    layer,
    selection,
    isValidIndex,
    fallbackIndex,
    soul,
    body,
    chineseDate,
    zodiac,
    palette,
    styles,
    onSelect,
    onDoubleTap,
}: ZiweiBoardViewProps) {
    return (
        <View style={[styles.board, { width: layout.boardWidth, height: layout.boardHeight }]}>
            <CellBackground layout={layout} selection={selection} isValid={isValidIndex} fallbackIndex={fallbackIndex} styles={styles} />
            {palaces.map((palace) => {
                const index = palace.palaceIndex;
                const frame = layout.frames[index];
                if (!frame) {
                    return null;
                }
                return (
                    <ZiweiTile
                        key={palace.name}
                        index={index}
                        palace={palace}
                        frame={frame}
                        tag={layer?.tags[index] || ''}
                        isMing={layer ? layer.mingIndex === index : false}
                        flows={layer?.flows[index] || ''}
                        mutKey={layer?.mutKeys[index] || ''}
                        fontScale={layout.fontScale}
                        palette={palette}
                        styles={styles}
                        onSelect={onSelect}
                        onDoubleTap={onDoubleTap}
                    />
                );
            })}
            <View style={[styles.center, layout.center]} pointerEvents="none">
                <CenterStatic
                    frame={layout.center}
                    soul={soul}
                    body={body}
                    chineseDate={chineseDate}
                    zodiac={zodiac}
                    palette={palette}
                    styles={styles}
                />
                {layer ? <CenterHead layer={layer} palette={palette} styles={styles} /> : null}
            </View>
            <SelectionLayer
                layout={layout}
                palaces={palaces}
                selection={selection}
                isValid={isValidIndex}
                fallbackIndex={fallbackIndex}
                palette={palette}
                styles={styles}
            />
        </View>
    );
}

export const ZiweiBoardView = memo(ZiweiBoardViewBase);
