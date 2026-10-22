/**
 * 弧线谱：干支排成一行，上方画天干与整柱的关系，下方画地支的关系，三柱成局画括弧。
 * 干支详情与合盘共用。标签高度按跨度排，撞上已放好的标签就再往外让一格。
 */
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Path, Polygon, Rect } from 'react-native-svg';
import WuXingIcon from './WuXingIcon';
import { getGanZhiElement } from '../features/bazi/wuxing';
import type { ResultPalette } from '../theme/result-palette';

export type ArcTone = 'pos' | 'neg' | 'mid';

export interface ArcColumn {
    key: string;
    stem: string;
    branch: string;
    /** 干支上方的小字行：柱名、十神 */
    header?: string[];
    headerTone?: 'yun' | 'day';
    /** 地支下方的金色小字：截脚、盖头 */
    status?: string;
    /** 下方弧线之外的小字：宫位、年份 */
    footer?: string;
    footerStrong?: boolean;
    highlight?: boolean;
}

export interface ArcLink {
    key: string;
    /** 两列连弧线，三列画括弧；数字是列的下标 */
    cols: number[];
    side: 'above' | 'below';
    tone: ArcTone;
    label: string;
    arrowTo?: number;
    dimmed?: boolean;
}

/** 柱内上下的生克，画在天干与地支之间 */
export interface ArcVertical {
    col: number;
    tone: ArcTone;
    label: string;
}

/** 跨几列的底注，如两人的名字 */
export interface ArcSpan {
    from: number;
    to: number;
    text: string;
}

const LABEL_H = 18;
const ROW_H = 15;
const MIN_ARC = 14;
const SPAN_STEP = 16;
const BUMP = 8;
const ARROW = 7;

interface PlacedLabel {
    key: string;
    text: string;
    tone: ArcTone;
    dimmed: boolean;
    cx: number;
    /** 离基线的距离 */
    h: number;
    w: number;
}

interface SideLayout {
    labels: PlacedLabel[];
    heights: Map<string, number>;
    offsets: Map<string, number>;
    extent: number;
}

function labelWidth(text: string): number {
    return Math.max(20, text.length * 11 + 10);
}

function layoutSide(links: ArcLink[], xOf: (col: number) => number): SideLayout {
    // 三柱成局的括弧先排，贴着字；两柱弧线再按跨度由短到长
    const sorted = [...links].sort((left, right) => {
        const bracketLeft = left.cols.length >= 3 ? 0 : 1;
        const bracketRight = right.cols.length >= 3 ? 0 : 1;
        const spanLeft = Math.max(...left.cols) - Math.min(...left.cols);
        const spanRight = Math.max(...right.cols) - Math.min(...right.cols);
        return bracketLeft - bracketRight || spanLeft - spanRight || left.key.localeCompare(right.key);
    });

    // 同一列落了几条线，就把落点左右错开一点，箭头不叠在一起
    const ends = new Map<number, Array<{ key: string; other: number }>>();
    sorted.forEach((link) => {
        const center = link.cols.reduce((sum, col) => sum + col, 0) / link.cols.length;
        link.cols.forEach((col) => {
            const list = ends.get(col) ?? [];
            list.push({ key: link.key, other: center === col ? col : center });
            ends.set(col, list);
        });
    });
    const offsets = new Map<string, number>();
    ends.forEach((list, col) => {
        list.sort((left, right) => left.other - right.other);
        list.forEach((item, index) => offsets.set(`${item.key}@${col}`, (index - (list.length - 1) / 2) * 5));
    });

    const labels: PlacedLabel[] = [];
    const heights = new Map<string, number>();
    sorted.forEach((link) => {
        const cols = [...link.cols].sort((left, right) => left - right);
        const span = cols[cols.length - 1] - cols[0];
        const cx = cols.length >= 3 ? xOf(cols[1]) : (xOf(cols[0]) + xOf(cols[cols.length - 1])) / 2;
        const w = labelWidth(link.label);
        let h = cols.length >= 3 ? 20 : MIN_ARC + (span - 1) * SPAN_STEP;
        const hits = (value: number) => labels.some((placed) =>
            Math.abs(placed.cx - cx) < (placed.w + w) / 2 + 2 && Math.abs(placed.h - value) < LABEL_H + 2);
        while (hits(h) && h < 240) h += BUMP;
        heights.set(link.key, h);
        labels.push({ key: link.key, text: link.label, tone: link.tone, dimmed: Boolean(link.dimmed), cx, h, w });
    });
    const extent = labels.length ? Math.max(...labels.map((label) => label.h)) + LABEL_H / 2 + 2 : 4;
    return { labels, heights, offsets, extent };
}

interface Props {
    columns: ArcColumn[];
    links: ArcLink[];
    verticals?: ArcVertical[];
    spans?: ArcSpan[];
    /** 在这一列之后画虚线分隔（岁运 | 原局、我 | TA） */
    splitAfter?: number;
    width: number;
    glyphSize?: number;
    palette: ResultPalette;
    accessibilityLabel: string;
}

const ArcChart: React.FC<Props> = ({
    columns, links, verticals = [], spans = [], splitAfter, width, glyphSize = 22, palette, accessibilityLabel,
}) => {
    const colW = width / columns.length;
    const xOf = (col: number) => colW * (col + 0.5);
    const lineH = Math.round(glyphSize * 1.3);
    const icon = Math.round(glyphSize * 0.55);
    const toneColor = (tone: ArcTone) => (tone === 'pos' ? palette.positive : tone === 'neg' ? palette.negative : palette.gold);
    const dash = (tone: ArcTone) => (tone === 'neg' ? '5,4' : tone === 'mid' ? '0.1,5' : undefined);

    const layout = useMemo(() => {
        const valid = links.filter((link) => link.cols.length >= 2 && new Set(link.cols).size === link.cols.length);
        const above = layoutSide(valid.filter((link) => link.side === 'above'), xOf);
        const below = layoutSide(valid.filter((link) => link.side === 'below'), xOf);
        const headerRows = Math.max(0, ...columns.map((column) => column.header?.length ?? 0));
        const hasStatus = columns.some((column) => column.status);
        const hasFooter = columns.some((column) => column.footer);
        const baseAbove = above.extent;
        const headerTop = baseAbove + 2;
        const stemTop = headerTop + headerRows * ROW_H + 2;
        const branchTop = stemTop + lineH + (verticals.length ? 36 : 4);
        const blockBottom = branchTop + lineH + (hasStatus ? ROW_H + 2 : 2);
        const baseBelow = blockBottom + 2;
        const footerTop = baseBelow + below.extent + 4;
        const spansTop = footerTop + (hasFooter ? ROW_H + 4 : 0);
        const height = spansTop + (spans.length ? ROW_H + 6 : 0);
        return { valid, above, below, baseAbove, headerTop, stemTop, branchTop, blockBottom, baseBelow, footerTop, spansTop, height };
        // xOf 只依赖 colW
    }, [columns, links, verticals.length, spans.length, colW, lineH]);

    const { above, below, baseAbove, headerTop, stemTop, branchTop, blockBottom, baseBelow, footerTop, spansTop, height } = layout;

    const shapes = layout.valid.map((link) => {
        const side = link.side === 'above' ? above : below;
        const base = link.side === 'above' ? baseAbove : baseBelow;
        const sign = link.side === 'above' ? -1 : 1;
        const h = side.heights.get(link.key) ?? MIN_ARC;
        const color = toneColor(link.tone);
        const x = (col: number) => xOf(col) + (side.offsets.get(`${link.key}@${col}`) ?? 0);
        const common = {
            stroke: color,
            strokeWidth: link.tone === 'pos' ? 2 : link.tone === 'mid' ? 2.2 : 1.8,
            strokeDasharray: dash(link.tone),
            strokeLinecap: 'round' as const,
            fill: 'none',
        };
        const opacity = link.dimmed ? 0.12 : 1;
        if (link.cols.length >= 3) {
            const cols = [...link.cols].sort((left, right) => left - right);
            const edge = base + sign * h;
            const d = `M${x(cols[0])} ${base} V${edge} H${x(cols[cols.length - 1])} V${base} ${cols.slice(1, -1).map((col) => `M${x(col)} ${base} V${edge}`).join(' ')}`;
            return <Path key={link.key} d={d} opacity={opacity} {...common} />;
        }
        // 有箭头时让路径终点落在箭头那一列
        const [first, second] = link.arrowTo === link.cols[0] ? [link.cols[1], link.cols[0]] : [link.cols[0], link.cols[1]];
        const arrow = link.arrowTo !== undefined;
        const xa = x(first);
        const xb = x(second);
        const k = h / 0.75;
        const endY = base + sign * (arrow ? ARROW : 0);
        const d = `M${xa} ${base} C${xa} ${base + sign * k} ${xb} ${base + sign * k} ${xb} ${endY}`;
        return (
            <React.Fragment key={link.key}>
                <Path d={d} opacity={opacity} {...common} />
                {arrow ? (
                    <Polygon
                        points={`${xb},${base} ${xb - 4},${base + sign * (ARROW + 1)} ${xb + 4},${base + sign * (ARROW + 1)}`}
                        fill={color}
                        opacity={opacity}
                    />
                ) : null}
            </React.Fragment>
        );
    });

    const verticalMid = (stemTop + lineH + branchTop) / 2;

    return (
        <View style={{ width, height }} accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
            <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
                {columns.map((column, index) => column.highlight ? (
                    <Rect
                        key={`hl-${column.key}`}
                        x={xOf(index) - colW / 2 + 2}
                        y={headerTop - 2}
                        width={colW - 4}
                        height={blockBottom - headerTop + 4}
                        rx={8}
                        fill={palette.dayFill}
                    />
                ) : null)}
                {splitAfter !== undefined && splitAfter < columns.length - 1 ? (
                    <Line
                        x1={colW * (splitAfter + 1)} y1={headerTop} x2={colW * (splitAfter + 1)} y2={blockBottom}
                        stroke={palette.rule} strokeWidth={1} strokeDasharray="3,3"
                    />
                ) : null}
                {verticals.map((item) => (
                    <Line
                        key={`v-${item.col}`}
                        x1={xOf(item.col)} y1={stemTop + lineH - 2} x2={xOf(item.col)} y2={branchTop + 2}
                        stroke={toneColor(item.tone)} strokeWidth={1.8} strokeDasharray={dash(item.tone)} strokeLinecap="round"
                    />
                ))}
                {shapes}
            </Svg>

            {columns.map((column, index) => (
                <React.Fragment key={column.key}>
                    {(column.header ?? []).map((text, row) => {
                        const strong = row === 0 && column.headerTone === 'day';
                        const color = row === 0 && column.headerTone === 'yun' ? palette.gold : strong ? palette.heading : palette.muted;
                        return (
                            <Text
                                key={`h-${row}`}
                                style={[styles.small, { left: xOf(index) - colW / 2, width: colW, top: headerTop + row * ROW_H, color }, strong && styles.strong]}
                                numberOfLines={1}
                            >
                                {text}
                            </Text>
                        );
                    })}
                    <View style={[styles.cell, { left: xOf(index) - colW / 2, width: colW, top: stemTop, height: lineH }]}>
                        <Glyph char={column.stem} size={glyphSize} lineH={lineH} icon={icon} palette={palette} />
                    </View>
                    <View style={[styles.cell, { left: xOf(index) - colW / 2, width: colW, top: branchTop, height: lineH }]}>
                        <Glyph char={column.branch} size={glyphSize} lineH={lineH} icon={icon} palette={palette} />
                    </View>
                    {column.status ? (
                        <Text style={[styles.small, styles.status, { left: xOf(index) - colW / 2, width: colW, top: branchTop + lineH + 1, color: palette.gold }]}>
                            {column.status}
                        </Text>
                    ) : null}
                    {column.footer ? (
                        <Text
                            style={[styles.small, { left: xOf(index) - colW / 2, width: colW, top: footerTop, color: column.footerStrong ? palette.heading : palette.muted }, column.footerStrong && styles.strong]}
                            numberOfLines={1}
                        >
                            {column.footer}
                        </Text>
                    ) : null}
                </React.Fragment>
            ))}

            {verticals.map((item) => (
                <Label
                    key={`vl-${item.col}`}
                    text={item.label}
                    color={toneColor(item.tone)}
                    background={columns[item.col]?.highlight ? palette.dayFill : palette.card}
                    cx={xOf(item.col)}
                    cy={verticalMid}
                    w={labelWidth(item.label)}
                    dimmed={false}
                />
            ))}
            {above.labels.map((label) => (
                <Label key={label.key} text={label.text} color={toneColor(label.tone)} background={palette.card} cx={label.cx} cy={baseAbove - label.h} w={label.w} dimmed={label.dimmed} />
            ))}
            {below.labels.map((label) => (
                <Label key={label.key} text={label.text} color={toneColor(label.tone)} background={palette.card} cx={label.cx} cy={baseBelow + label.h} w={label.w} dimmed={label.dimmed} />
            ))}

            {spans.map((span) => (
                <Text
                    key={`s-${span.from}`}
                    style={[styles.span, { left: colW * span.from, width: colW * (span.to - span.from + 1), top: spansTop, color: palette.ink }]}
                    numberOfLines={1}
                >
                    {span.text}
                </Text>
            ))}
        </View>
    );
};

const Glyph: React.FC<{ char: string; size: number; lineH: number; icon: number; palette: ResultPalette }> = ({ char, size, lineH, icon, palette }) => {
    const element = getGanZhiElement(char);
    return (
        <View style={styles.glyph}>
            {element ? <WuXingIcon element={char} size={icon} style={[styles.icon, { left: -(icon + 2), top: (lineH - icon) / 2 }]} /> : null}
            <Text style={{ fontSize: size, lineHeight: lineH, fontWeight: '700', color: element ? palette.element[element] : palette.ink }}>{char}</Text>
        </View>
    );
};

const Label: React.FC<{ text: string; color: string; background: string; cx: number; cy: number; w: number; dimmed: boolean }> = ({
    text, color, background, cx, cy, w, dimmed,
}) => (
    <View pointerEvents="none" style={[styles.label, { left: cx - w / 2, top: cy - LABEL_H / 2, width: w, borderColor: color, backgroundColor: background }, dimmed && styles.dimmed]}>
        <Text style={[styles.labelText, { color }]} numberOfLines={1}>{text}</Text>
    </View>
);

const styles = StyleSheet.create({
    small: { position: 'absolute', fontSize: 11, lineHeight: ROW_H, textAlign: 'center' },
    strong: { fontWeight: '600' },
    status: { fontWeight: '600' },
    cell: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
    glyph: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
    icon: { position: 'absolute' },
    label: { position: 'absolute', height: LABEL_H, borderRadius: 4, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    labelText: { fontSize: 11, lineHeight: 15, fontWeight: '700', includeFontPadding: false },
    dimmed: { opacity: 0.12 },
    span: { position: 'absolute', fontSize: 12, lineHeight: ROW_H + 2, fontWeight: '600', textAlign: 'center' },
});

export default ArcChart;
