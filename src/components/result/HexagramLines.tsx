import React from 'react';
import { View } from 'react-native';

/** 画卦：lines 为初爻→上爻（1 阳 0 阴），自上而下绘制；movingLines 为 1 起的动爻位。 */
export default function HexagramLines({
    lines, movingLines = [], width, barHeight = 5, gap = 4, trigramGap = 4, color, movingColor,
}: {
    lines: number[];
    movingLines?: number[];
    width: number;
    barHeight?: number;
    gap?: number;
    trigramGap?: number;
    color: string;
    movingColor: string;
}) {
    const yinGap = Math.max(4, Math.round(width * 0.16));
    return (
        <View style={{ width }} accessible={false}>
            {lines.map((_, offset) => {
                const index = lines.length - 1 - offset;
                const fill = movingLines.includes(index + 1) ? movingColor : color;
                const marginTop = offset === 0 ? 0 : (index === 2 ? gap + trigramGap : gap);
                return lines[index] === 1
                    ? <View key={index} style={{ marginTop, height: barHeight, borderRadius: 1, backgroundColor: fill }} />
                    : (
                        <View key={index} style={{ marginTop, height: barHeight, flexDirection: 'row', gap: yinGap }}>
                            <View style={{ flex: 1, borderRadius: 1, backgroundColor: fill }} />
                            <View style={{ flex: 1, borderRadius: 1, backgroundColor: fill }} />
                        </View>
                    );
            })}
        </View>
    );
}
