import { computeZiweiTileStarsLayout } from './tile-layout';

describe('computeZiweiTileStarsLayout', () => {
    it.each([
        { width: 76, height: 82, compactBoard: true, count: 4, maxNameChars: 2 },
        { width: 76, height: 82, compactBoard: true, count: 7, maxNameChars: 3 },
        { width: 88, height: 96, compactBoard: false, count: 5, maxNameChars: 2 },
        { width: 90, height: 96, compactBoard: false, count: 8, maxNameChars: 3 },
    ])('fits within width/height budgets: %#', ({ width, height, compactBoard, count, maxNameChars }) => {
        const stars = Array.from({ length: count }, (_, index) => ({
            name: index === 0 ? '天魁'.slice(0, maxNameChars) : '紫微'.slice(0, maxNameChars),
        }));
        const layout = computeZiweiTileStarsLayout({
            availableHeight: height,
            availableWidth: width,
            compactBoard,
            stars,
        });

        expect(layout.scale).toBeLessThanOrEqual(1);
        expect(layout.scaledWidth).toBeLessThanOrEqual(width + 0.5);
        expect(layout.scaledHeight).toBeLessThanOrEqual(height + 0.5);
    });

    it('uses the longest star name to reserve a stable name slot height', () => {
        const layout = computeZiweiTileStarsLayout({
            availableHeight: 120,
            availableWidth: 120,
            compactBoard: false,
            stars: [{ name: '紫微' }, { name: '天喜' }, { name: '破碎' }],
        });

        expect(layout.maxNameChars).toBe(2);
        expect(layout.nameSlotHeight).toBe(layout.majorLineHeight * 2);
    });
});

