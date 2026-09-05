import {
    DEFAULT_GAN_ZHI_RELATION_SETTINGS,
    GanZhiRelationFact,
    GanZhiRelationKind,
    GanZhiRelationSettings,
    calculateGanZhiRelations,
} from './bazi-ganzhi-relation-engine';

export type BaziGanZhiDiagramScope = 'suiyun' | 'yuanju' | 'cross';
export type BaziGanZhiDiagramTone = 'supportive' | 'obstructive' | 'neutral';
export type BaziGanZhiDiagramLayer = 'stem' | 'branch' | 'pillar';

export interface BaziGanZhiDiagramNode {
    key: string;
    label: string;
    scope: Exclude<BaziGanZhiDiagramScope, 'cross'>;
    order: number;
    gan: string;
    zhi: string;
    pillar: string;
}

export interface BaziGanZhiDiagramRelation {
    key: string;
    kind: GanZhiRelationKind;
    text: string;
    summaryText: string;
    scope: BaziGanZhiDiagramScope;
    layer: BaziGanZhiDiagramLayer;
    tone: BaziGanZhiDiagramTone;
    nodeOrders: number[];
    leftOrder: number;
    rightOrder: number;
    priority: number;
}

export interface BaziGanZhiDiagram {
    nodes: BaziGanZhiDiagramNode[];
    stemRelations: BaziGanZhiDiagramRelation[];
    branchRelations: BaziGanZhiDiagramRelation[];
    pillarRelations: BaziGanZhiDiagramRelation[];
}

export interface BaziGanZhiDiagramInput {
    liuNianGanZhi?: string;
    yunWeiGanZhi?: string;
    yunWeiLabel?: '大运' | '小运';
    fourPillars: readonly string[];
}

function parseGanZhi(ganZhi?: string): { gan: string; zhi: string; pillar: string } {
    if (!ganZhi || ganZhi === '—' || ganZhi.length < 2) {
        return { gan: '—', zhi: '—', pillar: '—' };
    }
    return {
        gan: ganZhi[0],
        zhi: ganZhi[1],
        pillar: ganZhi.slice(0, 2),
    };
}

function mapFact(fact: GanZhiRelationFact): BaziGanZhiDiagramRelation {
    return {
        key: fact.key,
        kind: fact.kind,
        text: fact.label,
        summaryText: fact.summaryText,
        scope: fact.scope,
        layer: fact.layer,
        tone: fact.tone,
        nodeOrders: fact.nodeOrders,
        leftOrder: fact.leftOrder,
        rightOrder: fact.rightOrder,
        priority: fact.priority,
    };
}

export function buildBaziGanZhiDiagram(
    input: BaziGanZhiDiagramInput,
    settings: GanZhiRelationSettings = DEFAULT_GAN_ZHI_RELATION_SETTINGS,
): BaziGanZhiDiagram {
    const definitions = [
        { key: 'liuNian', label: '流年', scope: 'suiyun' as const, ganZhi: input.liuNianGanZhi },
        {
            key: 'yunWei',
            label: input.yunWeiLabel ?? '大运',
            scope: 'suiyun' as const,
            ganZhi: input.yunWeiGanZhi,
        },
        { key: 'year', label: '年柱', scope: 'yuanju' as const, ganZhi: input.fourPillars[0] },
        { key: 'month', label: '月柱', scope: 'yuanju' as const, ganZhi: input.fourPillars[1] },
        { key: 'day', label: '日柱', scope: 'yuanju' as const, ganZhi: input.fourPillars[2] },
        { key: 'hour', label: '时柱', scope: 'yuanju' as const, ganZhi: input.fourPillars[3] },
    ];
    const nodes: BaziGanZhiDiagramNode[] = definitions.map((definition, order) => ({
        ...definition,
        ...parseGanZhi(definition.ganZhi),
        order,
    }));
    const facts = calculateGanZhiRelations(nodes, settings).map(mapFact);
    return {
        nodes,
        stemRelations: facts.filter((fact) => fact.layer === 'stem'),
        branchRelations: facts.filter((fact) => fact.layer === 'branch'),
        pillarRelations: facts.filter((fact) => fact.layer === 'pillar'),
    };
}
