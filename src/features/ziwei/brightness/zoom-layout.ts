import type { ZiweiZoomRect, ZiweiZoomTarget } from '../types';

export type ZiweiZoomPhase = 'closed' | 'opening' | 'open' | 'closing';

export interface ZiweiZoomViewport {
    width: number;
    height: number;
    paddingTop: number;
    paddingBottom: number;
    paddingHorizontal: number;
    maxScale?: number;
}

export interface ZiweiZoomDisplayLayout {
    scale: number;
    baseOffsetX: number;
    baseOffsetY: number;
    rect: ZiweiZoomRect;
}

export function canOpenZiweiZoom(phase: ZiweiZoomPhase): boolean {
    return phase === 'closed';
}

export function canCloseZiweiZoom(phase: ZiweiZoomPhase): boolean {
    return phase === 'opening' || phase === 'open';
}

export function buildZiweiZoomDisplayLayout(
    sourceRect: Pick<ZiweiZoomRect, 'width' | 'height'>,
    viewport: ZiweiZoomViewport,
): ZiweiZoomDisplayLayout {
    const sourceWidth = Math.max(1, sourceRect.width);
    const sourceHeight = Math.max(1, sourceRect.height);
    const availableWidth = Math.max(1, viewport.width - viewport.paddingHorizontal * 2);
    const availableHeight = Math.max(1, viewport.height - viewport.paddingTop - viewport.paddingBottom);
    const maxScale = viewport.maxScale && viewport.maxScale > 0 ? viewport.maxScale : Number.POSITIVE_INFINITY;
    const fitScale = Math.min(availableWidth / sourceWidth, availableHeight / sourceHeight, maxScale);
    const scale = Number.isFinite(fitScale) && fitScale > 0 ? fitScale : 1;
    const width = sourceWidth * scale;
    const height = sourceHeight * scale;

    return {
        scale,
        baseOffsetX: (width - sourceWidth) / 2,
        baseOffsetY: (height - sourceHeight) / 2,
        rect: {
            x: (viewport.width - width) / 2,
            y: viewport.paddingTop + (availableHeight - height) / 2,
            width,
            height,
        },
    };
}

export function resolveZiweiZoomPalaceName(
    zoomTarget: ZiweiZoomTarget | null,
    selectedPalaceName: string,
): string {
    return zoomTarget?.palaceName || selectedPalaceName;
}
