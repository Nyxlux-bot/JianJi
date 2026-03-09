import { DIZHI_WUXING, TIANGAN_WUXING, WuXing } from './liuyao-data';
import {
    compareWuXing,
    GAN_CHONG,
    GAN_HE,
    getDictPairEntry,
    getPairKey,
    getPillarStatus,
    getZhiXingPairMeta,
    isFanyinPair,
    ZHI_AN_HE,
    ZHI_CHONG,
    ZHI_HAI,
    ZHI_LIU_HE,
    ZHI_PO,
    ZHI_SAN_HE,
    ZHI_SAN_HUI,
} from './bazi-relation-rules';

export type BaziDiagramRelationDomain = 'gan' | 'zhi' | 'pillar';
export type BaziDiagramRelationPolarity = 'positive' | 'negative' | 'neutral';
export type BaziDiagramRelationType =
    | 'gan_he'
    | 'gan_chong'
    | 'gan_sheng'
    | 'gan_ke'
    | 'gan_tongqi'
    | 'zhi_san_he'
    | 'zhi_san_hui'
    | 'zhi_liu_he'
    | 'zhi_chong'
    | 'zhi_hai'
    | 'zhi_an_he'
    | 'zhi_xing'
    | 'zhi_po'
    | 'zhi_sheng'
    | 'zhi_ke'
    | 'zhi_tongqi'
    | 'pillar_gaitou'
    | 'pillar_jiejiao'
    | 'pillar_fuyin'
    | 'pillar_fanyin';

export type BaziDiagramFlowDirection = 'left_to_right' | 'right_to_left' | 'bidirectional' | 'vertical_down' | 'vertical_up';

export interface BaziDiagramNode {
    key: string;
    label: string;
    stem: string;
    branch: string;
}

export interface BaziDiagramRelation {
    id: string;
    domain: BaziDiagramRelationDomain;
    relationType: BaziDiagramRelationType;
    from: number;
    to: number;
    label: string;
    polarity: BaziDiagramRelationPolarity;
    lane: number;
}

export interface BaziDiagramFlowLink {
    id: string;
    row: 'stem' | 'branch' | 'pillar';
    from: number;
    to: number;
    label: string;
    polarity: BaziDiagramRelationPolarity;
    direction: BaziDiagramFlowDirection;
}

function toPairRelationId(prefix: string, domain: BaziDiagramRelationDomain, from: number, to: number): string {
    return `${prefix}:${domain}:${from}-${to}`;
}

function assignLanes(relations: Omit<BaziDiagramRelation, 'lane'>[]): BaziDiagramRelation[] {
    const laneRightEdges: number[] = [];
    return relations.map((relation) => {
        const start = Math.min(relation.from, relation.to);
        const end = Math.max(relation.from, relation.to);
        let lane = 0;
        while (lane < laneRightEdges.length && start <= laneRightEdges[lane]) {
            lane += 1;
        }
        laneRightEdges[lane] = end;
        return {
            ...relation,
            lane,
        };
    });
}

function findPresentIndexes(branches: string[], members: string[]): number[] | null {
    const indexes = members.map((member) => branches.findIndex((branch) => branch === member));
    if (indexes.some((index) => index < 0)) {
        return null;
    }
    return indexes.sort((left, right) => left - right);
}

function buildStemPairRelations(nodes: BaziDiagramNode[]): Omit<BaziDiagramRelation, 'lane'>[] {
    const relations: Omit<BaziDiagramRelation, 'lane'>[] = [];

    for (let i = 0; i < nodes.length - 1; i += 1) {
        for (let j = i + 1; j < nodes.length; j += 1) {
            const stemA = nodes[i].stem;
            const stemB = nodes[j].stem;
            const ganHeEntry = getDictPairEntry(stemA, stemB, GAN_HE);
            if (ganHeEntry) {
                relations.push({
                    id: toPairRelationId('gan-he', 'gan', i, j),
                    domain: 'gan',
                    relationType: 'gan_he',
                    from: i,
                    to: j,
                    label: `合化${ganHeEntry[1]}`,
                    polarity: 'positive',
                });
            }

            if (getPairKey(stemA, stemB, GAN_CHONG)) {
                relations.push({
                    id: toPairRelationId('gan-chong', 'gan', i, j),
                    domain: 'gan',
                    relationType: 'gan_chong',
                    from: i,
                    to: j,
                    label: '克',
                    polarity: 'negative',
                });
            }

            const elementA = TIANGAN_WUXING[stemA];
            const elementB = TIANGAN_WUXING[stemB];
            const interaction = compareWuXing(elementA, elementB);
            if (!interaction.label) {
                continue;
            }

            relations.push({
                id: toPairRelationId(`gan-${interaction.label}`, 'gan', i, j),
                domain: 'gan',
                relationType: interaction.label === '生'
                    ? 'gan_sheng'
                    : (interaction.label === '助' ? 'gan_tongqi' : 'gan_ke'),
                from: i,
                to: j,
                label: interaction.label,
                polarity: interaction.polarity,
            });
        }
    }

    return relations;
}

function buildBranchPairRelations(nodes: BaziDiagramNode[]): Omit<BaziDiagramRelation, 'lane'>[] {
    const relations: Omit<BaziDiagramRelation, 'lane'>[] = [];
    const branches = nodes.map((node) => node.branch);

    for (const [key, element] of Object.entries(ZHI_SAN_HUI)) {
        const indexes = findPresentIndexes(branches, key.split(''));
        if (!indexes) {
            continue;
        }
        relations.push({
            id: `zhi-sanhui:${indexes.join('-')}:${key}`,
            domain: 'zhi',
            relationType: 'zhi_san_hui',
            from: indexes[0],
            to: indexes[indexes.length - 1],
            label: `三会${element}`,
            polarity: 'positive',
        });
    }

    for (const [key, element] of Object.entries(ZHI_SAN_HE)) {
        const indexes = findPresentIndexes(branches, key.split(''));
        if (!indexes) {
            continue;
        }
        relations.push({
            id: `zhi-sanhe:${indexes.join('-')}:${key}`,
            domain: 'zhi',
            relationType: 'zhi_san_he',
            from: indexes[0],
            to: indexes[indexes.length - 1],
            label: `三合${element}`,
            polarity: 'positive',
        });
    }

    for (let i = 0; i < nodes.length - 1; i += 1) {
        for (let j = i + 1; j < nodes.length; j += 1) {
            const branchA = nodes[i].branch;
            const branchB = nodes[j].branch;
            let hasStructuralRelation = false;
            const liuHeEntry = getDictPairEntry(branchA, branchB, ZHI_LIU_HE);
            if (liuHeEntry) {
                relations.push({
                    id: toPairRelationId('zhi-liuhe', 'zhi', i, j),
                    domain: 'zhi',
                    relationType: 'zhi_liu_he',
                    from: i,
                    to: j,
                    label: `合化${liuHeEntry[1]}`,
                    polarity: 'positive',
                });
                hasStructuralRelation = true;
            }

            if (getPairKey(branchA, branchB, ZHI_AN_HE)) {
                relations.push({
                    id: toPairRelationId('zhi-anhe', 'zhi', i, j),
                    domain: 'zhi',
                    relationType: 'zhi_an_he',
                    from: i,
                    to: j,
                    label: '暗合',
                    polarity: 'positive',
                });
                hasStructuralRelation = true;
            }

            if (getPairKey(branchA, branchB, ZHI_CHONG)) {
                relations.push({
                    id: toPairRelationId('zhi-chong', 'zhi', i, j),
                    domain: 'zhi',
                    relationType: 'zhi_chong',
                    from: i,
                    to: j,
                    label: '冲',
                    polarity: 'negative',
                });
                hasStructuralRelation = true;
            }

            if (getPairKey(branchA, branchB, ZHI_HAI)) {
                relations.push({
                    id: toPairRelationId('zhi-hai', 'zhi', i, j),
                    domain: 'zhi',
                    relationType: 'zhi_hai',
                    from: i,
                    to: j,
                    label: '害',
                    polarity: 'negative',
                });
                hasStructuralRelation = true;
            }

            if (getPairKey(branchA, branchB, ZHI_PO)) {
                relations.push({
                    id: toPairRelationId('zhi-po', 'zhi', i, j),
                    domain: 'zhi',
                    relationType: 'zhi_po',
                    from: i,
                    to: j,
                    label: '破',
                    polarity: 'negative',
                });
                hasStructuralRelation = true;
            }

            const xingMeta = getZhiXingPairMeta(branchA, branchB);
            if (xingMeta) {
                relations.push({
                    id: toPairRelationId('zhi-xing', 'zhi', i, j),
                    domain: 'zhi',
                    relationType: 'zhi_xing',
                    from: i,
                    to: j,
                    label: '刑',
                    polarity: 'negative',
                });
                hasStructuralRelation = true;
            }

            if (hasStructuralRelation) {
                continue;
            }

            const elementA = DIZHI_WUXING[branchA];
            const elementB = DIZHI_WUXING[branchB];
            const interaction = compareWuXing(elementA, elementB);
            if (!interaction.label) {
                continue;
            }

            relations.push({
                id: toPairRelationId(`zhi-${interaction.label}`, 'zhi', i, j),
                domain: 'zhi',
                relationType: interaction.label === '生'
                    ? 'zhi_sheng'
                    : (interaction.label === '助' ? 'zhi_tongqi' : 'zhi_ke'),
                from: i,
                to: j,
                label: interaction.label,
                polarity: interaction.polarity,
            });
        }
    }

    return relations;
}

function buildPillarRelations(nodes: BaziDiagramNode[]): Omit<BaziDiagramRelation, 'lane'>[] {
    const relations: Omit<BaziDiagramRelation, 'lane'>[] = [];

    nodes.forEach((node, index) => {
        const status = getPillarStatus(node.stem, node.branch);
        if (!status) {
            return;
        }
        relations.push({
            id: `${status}-${index}`,
            domain: 'pillar',
            relationType: status === '盖头' ? 'pillar_gaitou' : 'pillar_jiejiao',
            from: index,
            to: index,
            label: status,
            polarity: 'negative',
        });
    });

    for (let i = 0; i < nodes.length - 1; i += 1) {
        for (let j = i + 1; j < nodes.length; j += 1) {
            if (nodes[i].stem === nodes[j].stem && nodes[i].branch === nodes[j].branch) {
                relations.push({
                    id: toPairRelationId('pillar-fuyin', 'pillar', i, j),
                    domain: 'pillar',
                    relationType: 'pillar_fuyin',
                    from: i,
                    to: j,
                    label: '伏吟',
                    polarity: 'neutral',
                });
            }
            if (isFanyinPair(nodes[i].stem, nodes[i].branch, nodes[j].stem, nodes[j].branch)) {
                relations.push({
                    id: toPairRelationId('pillar-fanyin', 'pillar', i, j),
                    domain: 'pillar',
                    relationType: 'pillar_fanyin',
                    from: i,
                    to: j,
                    label: '反吟',
                    polarity: 'negative',
                });
            }
        }
    }

    return relations;
}

export function extractBaziDiagramRelations(nodes: BaziDiagramNode[]): BaziDiagramRelation[] {
    const stemRelations = buildStemPairRelations(nodes)
        .sort((left, right) => (right.to - right.from) - (left.to - left.from) || left.from - right.from);
    const branchRelations = buildBranchPairRelations(nodes)
        .sort((left, right) => (right.to - right.from) - (left.to - left.from) || left.from - right.from);
    const pillarRelations = buildPillarRelations(nodes)
        .sort((left, right) => (right.to - right.from) - (left.to - left.from) || left.from - right.from);

    return [
        ...assignLanes(stemRelations),
        ...assignLanes(branchRelations),
        ...assignLanes(pillarRelations),
    ];
}

export function buildBaziDiagramFlowLinks(nodes: BaziDiagramNode[]): BaziDiagramFlowLink[] {
    const links: BaziDiagramFlowLink[] = [];

    for (let index = 0; index < nodes.length - 1; index += 1) {
        const current = nodes[index];
        const next = nodes[index + 1];
        const stemInteraction = compareWuXing(TIANGAN_WUXING[current.stem], TIANGAN_WUXING[next.stem]);
        if (stemInteraction.label) {
            links.push({
                id: `flow-stem-${index}-${index + 1}`,
                row: 'stem',
                from: index,
                to: index + 1,
                label: stemInteraction.label,
                polarity: stemInteraction.polarity,
                direction: stemInteraction.direction,
            });
        }

        const branchInteraction = compareWuXing(DIZHI_WUXING[current.branch], DIZHI_WUXING[next.branch]);
        if (branchInteraction.label) {
            links.push({
                id: `flow-branch-${index}-${index + 1}`,
                row: 'branch',
                from: index,
                to: index + 1,
                label: branchInteraction.label,
                polarity: branchInteraction.polarity,
                direction: branchInteraction.direction,
            });
        }
    }

    nodes.forEach((node, index) => {
        const pillarInteraction = compareWuXing(TIANGAN_WUXING[node.stem], DIZHI_WUXING[node.branch]);
        if (!pillarInteraction.label) {
            return;
        }

        links.push({
            id: `flow-pillar-${index}`,
            row: 'pillar',
            from: index,
            to: index,
            label: pillarInteraction.label,
            polarity: pillarInteraction.polarity,
            direction: pillarInteraction.direction === 'left_to_right'
                ? 'vertical_down'
                : (pillarInteraction.direction === 'right_to_left' ? 'vertical_up' : 'bidirectional'),
        });
    });

    return links;
}

export function getBaziDiagramPillarStatus(node: BaziDiagramNode): '盖头' | '截脚' | null {
    return getPillarStatus(node.stem, node.branch);
}
