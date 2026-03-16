export interface ZiweiTileStarsLayoutOptions {
    availableHeight: number;
    availableWidth: number;
    compactBoard: boolean;
    stars: Array<{ name: string }>;
}

export interface ZiweiTileStarsLayout {
    brightnessSlotHeight: number;
    colWidth: number;
    gap: number;
    innerWidth: number;
    majorFontSize: number;
    majorLineHeight: number;
    maxNameChars: number;
    minorFontSize: number;
    minorLineHeight: number;
    mutagenSlotHeight: number;
    nameSlotHeight: number;
    rawColumnHeight: number;
    scale: number;
    scaledHeight: number;
    scaledWidth: number;
    totalColumns: number;
}

export function computeZiweiTileStarsLayout({
    availableHeight,
    availableWidth,
    compactBoard,
    stars,
}: ZiweiTileStarsLayoutOptions): ZiweiTileStarsLayout {
    const totalColumns = stars.length;
    const maxNameChars = Math.max(1, ...stars.map((star) => star.name.length));
    const tier: 'normal' | 'tight' | 'ultra' = totalColumns >= 7 ? 'ultra' : totalColumns >= 5 ? 'tight' : 'normal';

    const presets = compactBoard
        ? {
            normal: { gap: 2, colWidth: 13, majorFontSize: 13, majorLineHeight: 14, minorFontSize: 12, minorLineHeight: 13 },
            tight: { gap: 1, colWidth: 12, majorFontSize: 12, majorLineHeight: 13, minorFontSize: 11, minorLineHeight: 12 },
            ultra: { gap: 1, colWidth: 12, majorFontSize: 12, majorLineHeight: 13, minorFontSize: 11, minorLineHeight: 12 },
        }
        : {
            normal: { gap: 4, colWidth: 15, majorFontSize: 15, majorLineHeight: 16, minorFontSize: 14, minorLineHeight: 15 },
            tight: { gap: 2, colWidth: 14, majorFontSize: 14, majorLineHeight: 15, minorFontSize: 13, minorLineHeight: 14 },
            ultra: { gap: 1, colWidth: 13, majorFontSize: 13, majorLineHeight: 14, minorFontSize: 12, minorLineHeight: 13 },
        };

    const {
        gap,
        colWidth,
        majorFontSize,
        majorLineHeight,
        minorFontSize,
        minorLineHeight,
    } = presets[tier];

    const nameSlotHeight = maxNameChars * Math.max(majorLineHeight, minorLineHeight);
    const mutagenSlotHeight = compactBoard ? 10 : 12;
    const brightnessSlotHeight = compactBoard ? 10 : 12;
    const rawColumnHeight = nameSlotHeight + mutagenSlotHeight + brightnessSlotHeight;
    const innerWidth = totalColumns > 0 ? totalColumns * colWidth + Math.max(0, totalColumns - 1) * gap : 0;
    const safeWidth = Math.max(1, availableWidth);
    const safeHeight = Math.max(1, availableHeight);
    const widthScale = innerWidth > 0 ? Math.min(1, safeWidth / innerWidth) : 1;
    const heightScale = rawColumnHeight > 0 ? Math.min(1, safeHeight / rawColumnHeight) : 1;
    const scale = Math.min(1, widthScale, heightScale);

    return {
        brightnessSlotHeight,
        colWidth,
        gap,
        innerWidth,
        majorFontSize,
        majorLineHeight,
        maxNameChars,
        minorFontSize,
        minorLineHeight,
        mutagenSlotHeight,
        nameSlotHeight,
        rawColumnHeight,
        scale,
        scaledHeight: rawColumnHeight * scale,
        scaledWidth: innerWidth * scale,
        totalColumns,
    };
}

