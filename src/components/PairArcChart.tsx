/**
 * 两盘弧线：两人八柱并成一行，左四柱是我，右四柱是 TA，只画两人之间的关系。
 */
import React from 'react';
import ArcChart, { ArcColumn, ArcLink } from './ArcChart';
import type { PairLink } from '../features/bazi/match/pair';
import type { ResultPalette } from '../theme/result-palette';

const PILLAR = ['年', '月', '日', '时'];

export interface PairChartSide {
    name: string;
    stems: readonly string[];
    branches: readonly string[];
}

const PairArcChart: React.FC<{
    me: PairChartSide;
    ta: PairChartSide;
    links: PairLink[];
    width: number;
    glyphSize?: number;
    /** 底部标出年月日时 */
    showPillars?: boolean;
    palette: ResultPalette;
}> = ({ me, ta, links, width, glyphSize = 20, showPillars = true, palette }) => {
    const columns: ArcColumn[] = [me, ta].flatMap((side, sideIndex) => side.stems.map((stem, index) => ({
        key: `${sideIndex}-${index}`,
        stem,
        branch: side.branches[index],
        footer: showPillars ? PILLAR[index] : undefined,
        highlight: index === 2,
    })));
    const arcs: ArcLink[] = links.map((link) => ({
        key: link.key,
        cols: [link.me, 4 + link.ta],
        side: link.layer === 'stem' ? 'above' : 'below',
        tone: link.tone,
        label: link.tag,
        arrowTo: link.toward === 'me' ? link.me : link.toward === 'ta' ? 4 + link.ta : undefined,
    }));
    return (
        <ArcChart
            columns={columns}
            links={arcs}
            spans={[{ from: 0, to: 3, text: `${me.name} · 我` }, { from: 4, to: 7, text: `${ta.name} · TA` }]}
            splitAfter={3}
            width={width}
            glyphSize={glyphSize}
            palette={palette}
            accessibilityLabel={`两盘之间：${links.map((link) => link.name).join('，') || '无明显冲合'}`}
        />
    );
};

export default PairArcChart;
