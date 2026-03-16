import {
    buildZiweiZoomDisplayLayout,
    canCloseZiweiZoom,
    canOpenZiweiZoom,
    resolveZiweiZoomPalaceName,
} from './zoom-layout';

describe('buildZiweiZoomDisplayLayout', () => {
    it('fits the zoom card proportionally inside the available viewport', () => {
        const layout = buildZiweiZoomDisplayLayout(
            { width: 88, height: 152 },
            {
                width: 430,
                height: 932,
                paddingTop: 72,
                paddingBottom: 40,
                paddingHorizontal: 20,
            },
        );

        expect(layout.scale).toBeCloseTo(390 / 88, 6);
        expect(layout.rect.width).toBeLessThanOrEqual(390);
        expect(layout.rect.height).toBeLessThanOrEqual(820);
        expect(layout.rect.width / layout.rect.height).toBeCloseTo(88 / 152, 6);
        expect(layout.rect.x).toBeCloseTo(20, 6);
        expect(layout.baseOffsetX).toBeCloseTo((layout.rect.width - 88) / 2, 6);
        expect(layout.baseOffsetY).toBeCloseTo((layout.rect.height - 152) / 2, 6);
    });
});

describe('resolveZiweiZoomPalaceName', () => {
    it('prefers the double-tapped palace over the currently selected palace', () => {
        expect(resolveZiweiZoomPalaceName({ palaceName: '迁移', rect: { x: 0, y: 0, width: 88, height: 152 } }, '命宫')).toBe('迁移');
    });

    it('falls back to the selected palace when no zoom target is active', () => {
        expect(resolveZiweiZoomPalaceName(null, '命宫')).toBe('命宫');
    });
});

describe('ziwei zoom phase guards', () => {
    it('blocks repeated open requests while zoom is opening or closing', () => {
        expect(canOpenZiweiZoom('opening')).toBe(false);
        expect(canOpenZiweiZoom('closing')).toBe(false);
    });

    it('blocks close requests when zoom is already closed or closing', () => {
        expect(canCloseZiweiZoom('closed')).toBe(false);
        expect(canCloseZiweiZoom('closing')).toBe(false);
    });

    it('allows open from closed and close from opening or open', () => {
        expect(canOpenZiweiZoom('closed')).toBe(true);
        expect(canCloseZiweiZoom('opening')).toBe(true);
        expect(canCloseZiweiZoom('open')).toBe(true);
    });
});
