import type { ZiweiWorkbenchLayout } from '../types';

/**
 * 一屏工作台的尺寸规则（与设计稿「适配规则」一致）：
 * - 棋盘宽 = 屏宽 − 24（平板单栏时最多 600）；宫高 = 剩余高度 ÷ 4，限制在 100–124，屏宽 ≥ 414 放宽到 136，
 *   高屏再放宽到宫宽的 1.6 倍；
 * - 宫高不到 100 → 紧凑模式（详情条压成一行）；紧凑后仍不到 96 → 退回整页滚动；
 * - 屏宽 ≥ 720 → 左盘右详情，字号整体 ×1.15。
 */
export const ZIWEI_STAGE = {
    boardTop: 8,
    axisTop: 8,
    axisHeight: 106,
    peekGap: 8,
    peekHeight: 64,
    peekHeightCompact: 48,
    sidePadding: 12,
    gap: 1,
    border: 1,
} as const;

export type ZiweiStageMode = 'std' | 'compact' | 'scroll' | 'wide';

export interface ZiweiTileFrame {
    left: number;
    top: number;
    width: number;
    height: number;
}

export interface ZiweiStageLayout {
    mode: ZiweiStageMode;
    boardWidth: number;
    boardHeight: number;
    colWidth: number;
    rowHeight: number;
    fontScale: number;
    peekHeight: number;
    /** 宽屏右侧详情栏宽度，其它模式为 0 */
    sideWidth: number;
    /** 按本命宫位序号（palaceIndex）给出的宫格位置 */
    frames: ZiweiTileFrame[];
    center: ZiweiTileFrame;
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function buildFrames(
    workbench: ZiweiWorkbenchLayout,
    colWidth: number,
    rowHeight: number,
): { frames: ZiweiTileFrame[]; center: ZiweiTileFrame } {
    const frames: ZiweiTileFrame[] = [];
    workbench.ringCells.forEach((cell) => {
        frames[cell.palaceIndex] = {
            left: ZIWEI_STAGE.border + cell.col * (colWidth + ZIWEI_STAGE.gap),
            top: ZIWEI_STAGE.border + cell.row * (rowHeight + ZIWEI_STAGE.gap),
            width: colWidth,
            height: rowHeight,
        };
    });
    return {
        frames,
        center: {
            left: ZIWEI_STAGE.border + colWidth + ZIWEI_STAGE.gap,
            top: ZIWEI_STAGE.border + rowHeight + ZIWEI_STAGE.gap,
            width: colWidth * 2 + ZIWEI_STAGE.gap,
            height: rowHeight * 2 + ZIWEI_STAGE.gap,
        },
    };
}

function boardFrom(boardWidth: number, rowHeight: number) {
    const colWidth = (boardWidth - ZIWEI_STAGE.border * 2 - ZIWEI_STAGE.gap * 3) / 4;
    const boardHeight = rowHeight * 4 + ZIWEI_STAGE.border * 2 + ZIWEI_STAGE.gap * 3;
    return { colWidth, boardHeight };
}

/**
 * @param width  可用宽度（屏宽）
 * @param height 顶栏与提示条以下、底部安全区以上的可用高度
 */
export function computeZiweiStageLayout(
    workbench: ZiweiWorkbenchLayout,
    width: number,
    height: number,
): ZiweiStageLayout {
    const fixed = ZIWEI_STAGE.boardTop + ZIWEI_STAGE.axisTop + ZIWEI_STAGE.axisHeight + ZIWEI_STAGE.peekGap;
    const chrome = ZIWEI_STAGE.border * 2 + ZIWEI_STAGE.gap * 3;

    if (width >= 720) {
        const fontScale = 1.15;
        const rowHeight = clamp((height - ZIWEI_STAGE.boardTop - ZIWEI_STAGE.axisTop - ZIWEI_STAGE.axisHeight - 12 - chrome) / 4, 100, 143);
        const boardWidth = Math.round(clamp(rowHeight * 4 * 1.02 + chrome, 420, Math.min(620, width * 0.56)));
        const { colWidth, boardHeight } = boardFrom(boardWidth, rowHeight);
        return {
            mode: 'wide',
            boardWidth,
            boardHeight,
            colWidth,
            rowHeight,
            fontScale,
            peekHeight: 0,
            sideWidth: width - boardWidth - ZIWEI_STAGE.sidePadding * 2,
            ...buildFrames(workbench, colWidth, rowHeight),
        };
    }

    const boardWidth = Math.min(width - ZIWEI_STAGE.sidePadding * 2, 600);
    const roomy = width >= 414;
    const fontScale = boardWidth >= 560 ? 1.15 : 1;
    // 高屏（20:9 及更长）多出的高度交给宫格，免得时间轴与底部详情条之间空出一大块；宫高最多为宫宽的 1.6 倍
    const rowMax = Math.max(fontScale > 1 ? 143 : roomy ? 136 : 124, Math.floor((boardWidth - chrome) / 4 * 1.6));

    let mode: ZiweiStageMode = 'std';
    let peekHeight: number = ZIWEI_STAGE.peekHeight;
    let rowHeight = (height - fixed - peekHeight - chrome) / 4;
    if (rowHeight < 100) {
        mode = 'compact';
        peekHeight = ZIWEI_STAGE.peekHeightCompact;
        rowHeight = (height - fixed - peekHeight - chrome) / 4;
        if (rowHeight < 96) {
            mode = 'scroll';
            rowHeight = 100;
        }
    }
    rowHeight = Math.floor(Math.min(rowHeight, rowMax));
    const { colWidth, boardHeight } = boardFrom(boardWidth, rowHeight);

    return {
        mode,
        boardWidth,
        boardHeight,
        colWidth,
        rowHeight,
        fontScale,
        peekHeight,
        sideWidth: 0,
        ...buildFrames(workbench, colWidth, rowHeight),
    };
}

/** 中宫四边上、离某个外圈宫格最近的点（三方四正连线的端点） */
export function triadAnchor(frame: ZiweiTileFrame, center: ZiweiTileFrame): { x: number; y: number } {
    const cx = frame.left + frame.width / 2;
    const cy = frame.top + frame.height / 2;
    const x0 = center.left;
    const y0 = center.top;
    const x1 = center.left + center.width;
    const y1 = center.top + center.height;
    const above = frame.top + frame.height <= y0;
    const below = frame.top >= y1;
    const leftOf = frame.left + frame.width <= x0;
    const rightOf = frame.left >= x1;

    if ((above || below) && !leftOf && !rightOf) {
        return { x: cx, y: above ? y0 : y1 };
    }
    if ((leftOf || rightOf) && !above && !below) {
        return { x: leftOf ? x0 : x1, y: cy };
    }
    return { x: leftOf ? x0 : x1, y: above ? y0 : y1 };
}
