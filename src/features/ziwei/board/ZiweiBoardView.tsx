import React, { memo, useCallback, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
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
        starRow: {
            position: 'absolute',
            left: 5,
            right: 4,
            top: 4,
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: f(2),
        },
        starCol: { alignItems: 'center' },
        starMajor: { ...base, fontSize: f(14), lineHeight: f(15), fontWeight: '700', color: palette.heading, textAlign: 'center' },
        starMinor: { ...base, fontSize: f(11), lineHeight: f(12), fontWeight: '500', color: palette.body, textAlign: 'center' },
        starAdj: { ...base, fontSize: f(9.5), lineHeight: f(10.5), color: palette.muted, textAlign: 'center' },
        brightness: { ...base, marginTop: 1, fontSize: f(8.5), lineHeight: f(10), color: palette.faint },
        chipRow: { marginTop: 1, flexDirection: 'row', gap: 1 },
        chip: {
            width: f(12),
            height: f(12),
            borderRadius: 2,
            alignItems: 'center',
            justifyContent: 'center',
        },
        chipText: { ...base, fontSize: f(8.5), lineHeight: f(10), fontWeight: '700' },
        more: { ...base, marginLeft: 1, fontSize: f(9), lineHeight: f(11), color: palette.faint },
        scopeRow: {
            position: 'absolute',
            left: 5,
            right: 4,
            bottom: f(30),
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
            height: f(24),
            flexDirection: 'row',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
        },
        gods: { ...base, fontSize: f(8.5), lineHeight: f(10.5), color: palette.faint },
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

interface PlacedStar {
    star: ZiweiStarViewModel;
    kind: StarKind;
    scopeMutagen?: ZiweiMutagen;
}

function placeStars(
    palace: ZiweiPalaceAnalysisView,
    scopeMutagens: Record<string, ZiweiMutagen>,
    availableWidth: number,
    fontScale: number,
): { placed: PlacedStar[]; hidden: number } {
    const all: PlacedStar[] = [
        ...palace.majorStars.map((star) => ({ star, kind: 'major' as const })),
        ...palace.minorStars.map((star) => ({ star, kind: 'minor' as const })),
        ...palace.adjectiveStars.map((star) => ({ star, kind: 'adj' as const })),
    ].map((item) => ({ ...item, scopeMutagen: item.kind === 'adj' ? undefined : scopeMutagens[item.star.name] }));
    const gap = 2 * fontScale;
    const widthOf = (item: PlacedStar) => {
        const base = (item.kind === 'major' ? 15 : item.kind === 'minor' ? 12 : 10) * fontScale;
        const chips = (item.star.mutagen ? 1 : 0) + (item.scopeMutagen ? 1 : 0);
        return chips === 2 ? Math.max(base, 25 * fontScale) : base;
    };

    const placed: PlacedStar[] = [];
    const widths: number[] = [];
    let used = 0;
    let hidden = 0;
    for (const item of all) {
        const width = widthOf(item);
        if (hidden || used + width + (placed.length ? gap : 0) > availableWidth) {
            hidden += 1;
            continue;
        }
        used += width + (placed.length ? gap : 0);
        placed.push(item);
        widths.push(width);
    }
    // 给「+N」留出位置
    while (hidden && placed.length && used + 15 * fontScale > availableWidth) {
        used -= (widths.pop() || 0) + (placed.length > 1 ? gap : 0);
        placed.pop();
        hidden += 1;
    }
    return { placed, hidden };
}


const TileStars = memo(function TileStars({
    palace,
    mutKey,
    width,
    fontScale,
    palette,
    styles,
}: {
    palace: ZiweiPalaceAnalysisView;
    mutKey: string;
    width: number;
    fontScale: number;
    palette: ZiweiPalette;
    styles: ZiweiBoardStyles;
}) {
    const { placed, hidden } = useMemo(
        () => placeStars(palace, parseMutKey(mutKey), width - 9, fontScale),
        [fontScale, mutKey, palace, width],
    );

    return (
        <View style={styles.starRow} pointerEvents="none">
            {placed.map(({ star, kind, scopeMutagen }) => (
                <View key={star.name} style={styles.starCol}>
                    <Text style={kind === 'major' ? styles.starMajor : kind === 'minor' ? styles.starMinor : styles.starAdj}>
                        {verticalTextOf(star.name)}
                    </Text>
                    {kind !== 'adj' ? <Text style={styles.brightness}>{star.brightness || ' '}</Text> : null}
                    {star.mutagen || scopeMutagen ? (
                        <View style={styles.chipRow}>
                            {star.mutagen ? <MutagenChip mutagen={star.mutagen as ZiweiMutagen} filled palette={palette} styles={styles} /> : null}
                            {scopeMutagen ? <MutagenChip mutagen={scopeMutagen} filled={false} palette={palette} styles={styles} /> : null}
                        </View>
                    ) : null}
                </View>
            ))}
            {hidden ? <Text style={styles.more}>+{hidden}</Text> : null}
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
            <Text style={styles.gods}>{`${palace.changsheng12}\n${palace.boshi12}`}</Text>
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
            <View>
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
            <TileStars palace={palace} mutKey={mutKey} width={frame.width} fontScale={fontScale} palette={palette} styles={styles} />
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
