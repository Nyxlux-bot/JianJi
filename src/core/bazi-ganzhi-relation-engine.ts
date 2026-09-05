import {
    GAN_CHONG,
    GAN_HE,
    ZHI_AN_HE,
    ZHI_BAN_HE,
    ZHI_CHONG,
    ZHI_HAI,
    ZHI_LIU_HE,
    ZHI_PO,
    ZHI_SAN_HE,
    ZHI_SAN_HUI,
    ZHI_XING_PAIR_RULES,
    ZHI_XING_SELF,
    getGanKeMeta,
    getPillarStatus,
} from './bazi-relation-rules';

export const GAN_ZHI_RELATION_SETTINGS_VERSION = 1 as const;

export interface GanZhiRelationSettings {
    version: typeof GAN_ZHI_RELATION_SETTINGS_VERSION;
    stemClash: boolean;
    stemControl: boolean;
    stemFiveCombination: boolean;
    branchSixCombination: boolean;
    branchThreeCombination: boolean;
    branchThreeMeeting: boolean;
    branchHiddenCombination: boolean;
    branchHiddenSandwich: boolean;
    branchSandwich: boolean;
    branchPunishment: boolean;
    branchClash: boolean;
    branchBreak: boolean;
    branchHarm: boolean;
    pillarSelfCombination: boolean;
    pillarHiddenCarry: boolean;
    pillarCover: boolean;
    pillarCut: boolean;
    pillarRepeating: boolean;
    pillarOpposing: boolean;
}

export const DEFAULT_GAN_ZHI_RELATION_SETTINGS: GanZhiRelationSettings = {
    version: GAN_ZHI_RELATION_SETTINGS_VERSION,
    stemClash: false,
    stemControl: true,
    stemFiveCombination: true,
    branchSixCombination: true,
    branchThreeCombination: true,
    branchThreeMeeting: true,
    branchHiddenCombination: true,
    branchHiddenSandwich: false,
    branchSandwich: false,
    branchPunishment: true,
    branchClash: true,
    branchBreak: true,
    branchHarm: true,
    pillarSelfCombination: true,
    pillarHiddenCarry: false,
    pillarCover: true,
    pillarCut: true,
    pillarRepeating: true,
    pillarOpposing: true,
};

export type GanZhiRelationSettingKey = Exclude<keyof GanZhiRelationSettings, 'version'>;

export function normalizeGanZhiRelationSettings(value: unknown): GanZhiRelationSettings {
    if (!value || typeof value !== 'object') {
        return DEFAULT_GAN_ZHI_RELATION_SETTINGS;
    }
    const source = value as Record<string, unknown>;
    const normalized = { ...DEFAULT_GAN_ZHI_RELATION_SETTINGS };
    (Object.keys(DEFAULT_GAN_ZHI_RELATION_SETTINGS) as GanZhiRelationSettingKey[])
        .forEach((key) => {
            if (typeof source[key] === 'boolean') {
                normalized[key] = source[key] as boolean;
            }
        });
    return normalized;
}

export type GanZhiRelationScope = 'suiyun' | 'yuanju' | 'cross';
export type GanZhiRelationNodeScope = Exclude<GanZhiRelationScope, 'cross'>;
export type GanZhiRelationLayer = 'stem' | 'branch' | 'pillar';
export type GanZhiRelationTone = 'supportive' | 'obstructive' | 'neutral';

export type GanZhiRelationKind =
    | 'stem_clash'
    | 'stem_control'
    | 'stem_five_combination'
    | 'branch_six_combination'
    | 'branch_three_combination'
    | 'branch_half_combination'
    | 'branch_three_meeting'
    | 'branch_hidden_combination'
    | 'branch_hidden_sandwich'
    | 'branch_sandwich'
    | 'branch_punishment'
    | 'branch_self_punishment'
    | 'branch_clash'
    | 'branch_break'
    | 'branch_harm'
    | 'pillar_self_combination'
    | 'pillar_hidden_carry'
    | 'pillar_cover'
    | 'pillar_cut'
    | 'pillar_repeating'
    | 'pillar_opposing';

export interface GanZhiRelationNode {
    key: string;
    label: string;
    scope: GanZhiRelationNodeScope;
    order: number;
    gan: string;
    zhi: string;
    pillar: string;
}

export interface GanZhiRelationFact {
    key: string;
    kind: GanZhiRelationKind;
    layer: GanZhiRelationLayer;
    tone: GanZhiRelationTone;
    scope: GanZhiRelationScope;
    nodeOrders: number[];
    leftOrder: number;
    rightOrder: number;
    label: string;
    summaryText: string;
    priority: number;
}

interface PairRule {
    members: string;
    result?: string;
}

interface TripleRule {
    members: string;
    result: string;
}

export interface GanZhiDeclarativeRuleCatalog {
    version: 1;
    stemClash: readonly PairRule[];
    stemControl: readonly PairRule[];
    stemFiveCombination: readonly PairRule[];
    branchSixCombination: readonly PairRule[];
    branchThreeCombination: readonly TripleRule[];
    branchHalfCombination: readonly PairRule[];
    branchThreeMeeting: readonly TripleRule[];
    branchHiddenCombination: readonly PairRule[];
    branchSandwich: readonly PairRule[];
    branchClash: readonly PairRule[];
    branchBreak: readonly PairRule[];
    branchHarm: readonly PairRule[];
    pillarSelfCombination: readonly string[];
}

const GAN_ORDER = '甲乙丙丁戊己庚辛壬癸';
const JIA_ZI = [
    '甲子', '乙丑', '丙寅', '丁卯', '戊辰', '己巳', '庚午', '辛未', '壬申', '癸酉',
    '甲戌', '乙亥', '丙子', '丁丑', '戊寅', '己卯', '庚辰', '辛巳', '壬午', '癸未',
    '甲申', '乙酉', '丙戌', '丁亥', '戊子', '己丑', '庚寅', '辛卯', '壬辰', '癸巳',
    '甲午', '乙未', '丙申', '丁酉', '戊戌', '己亥', '庚子', '辛丑', '壬寅', '癸卯',
    '甲辰', '乙巳', '丙午', '丁未', '戊申', '己酉', '庚戌', '辛亥', '壬子', '癸丑',
    '甲寅', '乙卯', '丙辰', '丁巳', '戊午', '己未', '庚申', '辛酉', '壬戌', '癸亥',
] as const;

const STEM_CONTROL_RULES: PairRule[] = [];
for (let left = 0; left < GAN_ORDER.length - 1; left += 1) {
    for (let right = left + 1; right < GAN_ORDER.length; right += 1) {
        if (getGanKeMeta(GAN_ORDER[left], GAN_ORDER[right])) {
            STEM_CONTROL_RULES.push({ members: `${GAN_ORDER[left]}${GAN_ORDER[right]}` });
        }
    }
}

export const GAN_ZHI_DECLARATIVE_RULES: GanZhiDeclarativeRuleCatalog = {
    version: 1,
    stemClash: GAN_CHONG.map((members) => ({ members })),
    stemControl: STEM_CONTROL_RULES,
    stemFiveCombination: Object.entries(GAN_HE).map(([members, result]) => ({ members, result })),
    branchSixCombination: Object.entries(ZHI_LIU_HE).map(([members, result]) => ({ members, result })),
    branchThreeCombination: Object.entries(ZHI_SAN_HE).map(([members, result]) => ({ members, result })),
    branchHalfCombination: Object.entries(ZHI_BAN_HE).map(([members, result]) => ({ members, result })),
    branchThreeMeeting: Object.entries(ZHI_SAN_HUI).map(([members, result]) => ({ members, result })),
    branchHiddenCombination: ZHI_AN_HE.map((members) => ({ members })),
    branchSandwich: [
        { members: '亥丑', result: '子' },
        { members: '寅辰', result: '卯' },
        { members: '巳未', result: '午' },
        { members: '申戌', result: '酉' },
    ],
    branchClash: ZHI_CHONG.map((members) => ({ members })),
    branchBreak: ZHI_PO.map((members) => ({ members })),
    branchHarm: ZHI_HAI.map((members) => ({ members })),
    pillarSelfCombination: ['甲午', '壬午', '丁亥', '戊子', '辛巳', '癸巳'],
};

const KIND_PRIORITY: Record<GanZhiRelationKind, number> = {
    stem_clash: 10,
    stem_control: 20,
    stem_five_combination: 30,
    branch_six_combination: 40,
    branch_three_combination: 50,
    branch_half_combination: 60,
    branch_three_meeting: 70,
    branch_hidden_combination: 80,
    branch_hidden_sandwich: 90,
    branch_sandwich: 100,
    branch_punishment: 110,
    branch_self_punishment: 120,
    branch_clash: 130,
    branch_break: 140,
    branch_harm: 150,
    pillar_self_combination: 160,
    pillar_hidden_carry: 170,
    pillar_cover: 180,
    pillar_cut: 190,
    pillar_repeating: 200,
    pillar_opposing: 210,
};

function isUsableNode(node: GanZhiRelationNode): boolean {
    return node.pillar !== '—'
        && node.gan !== '—'
        && node.zhi !== '—'
        && node.pillar.length >= 2;
}

function pairMatches(left: string, right: string, members: string): boolean {
    return `${left}${right}` === members || `${right}${left}` === members;
}

function resolveScope(nodes: GanZhiRelationNode[], orders: number[]): GanZhiRelationScope {
    const scopes = new Set(orders.map((order) => nodes[order]?.scope).filter(Boolean));
    if (scopes.size === 1) {
        return scopes.values().next().value as GanZhiRelationNodeScope;
    }
    return 'cross';
}

function relationKey(kind: GanZhiRelationKind, orders: number[], discriminator = ''): string {
    return `${kind}:${orders.join('-')}:${discriminator}`;
}

function buildFact(input: {
    nodes: GanZhiRelationNode[];
    kind: GanZhiRelationKind;
    layer: GanZhiRelationLayer;
    tone: GanZhiRelationTone;
    orders: number[];
    label: string;
    summaryText: string;
    discriminator?: string;
}): GanZhiRelationFact {
    const orders = [...input.orders].sort((left, right) => left - right);
    return {
        key: relationKey(input.kind, orders, input.discriminator),
        kind: input.kind,
        layer: input.layer,
        tone: input.tone,
        scope: resolveScope(input.nodes, orders),
        nodeOrders: orders,
        leftOrder: orders[0],
        rightOrder: orders[orders.length - 1],
        label: input.label,
        summaryText: input.summaryText,
        priority: KIND_PRIORITY[input.kind],
    };
}

function everyPair(nodes: GanZhiRelationNode[], visit: (left: GanZhiRelationNode, right: GanZhiRelationNode) => void) {
    for (let left = 0; left < nodes.length - 1; left += 1) {
        if (!isUsableNode(nodes[left])) continue;
        for (let right = left + 1; right < nodes.length; right += 1) {
            if (!isUsableNode(nodes[right])) continue;
            visit(nodes[left], nodes[right]);
        }
    }
}

function findTripleOccurrences(nodes: GanZhiRelationNode[], members: string): number[][] {
    const candidates = members.split('').map((member) => (
        nodes.filter((node) => isUsableNode(node) && node.zhi === member).map((node) => node.order)
    ));
    if (candidates.some((items) => items.length === 0)) {
        return [];
    }
    const rows: number[][] = [];
    candidates[0].forEach((first) => {
        candidates[1].forEach((second) => {
            candidates[2].forEach((third) => {
                const orders = [first, second, third];
                if (new Set(orders).size === orders.length) {
                    rows.push(orders.sort((a, b) => a - b));
                }
            });
        });
    });
    return rows;
}

function hiddenCarryPillar(left: string, right: string): string | null {
    const leftIndex = JIA_ZI.indexOf(left as typeof JIA_ZI[number]);
    const rightIndex = JIA_ZI.indexOf(right as typeof JIA_ZI[number]);
    if (leftIndex < 0 || rightIndex < 0) return null;
    if ((leftIndex + 2) % JIA_ZI.length === rightIndex) {
        return JIA_ZI[(leftIndex + 1) % JIA_ZI.length];
    }
    if ((rightIndex + 2) % JIA_ZI.length === leftIndex) {
        return JIA_ZI[(rightIndex + 1) % JIA_ZI.length];
    }
    return null;
}

function appendStemFacts(
    nodes: GanZhiRelationNode[],
    settings: GanZhiRelationSettings,
    facts: GanZhiRelationFact[],
) {
    everyPair(nodes, (left, right) => {
        if (settings.stemClash) {
            const rule = GAN_ZHI_DECLARATIVE_RULES.stemClash.find((item) => pairMatches(left.gan, right.gan, item.members));
            if (rule) {
                facts.push(buildFact({
                    nodes,
                    kind: 'stem_clash',
                    layer: 'stem',
                    tone: 'obstructive',
                    orders: [left.order, right.order],
                    label: '冲',
                    summaryText: `${rule.members}相冲`,
                    discriminator: rule.members,
                }));
            }
        }

        if (settings.stemControl) {
            const meta = getGanKeMeta(left.gan, right.gan);
            if (meta) {
                facts.push(buildFact({
                    nodes,
                    kind: 'stem_control',
                    layer: 'stem',
                    tone: 'obstructive',
                    orders: [left.order, right.order],
                    label: '克',
                    summaryText: `${meta.controller}${meta.controlled}相克`,
                    discriminator: meta.key,
                }));
            }
        }

        if (settings.stemFiveCombination) {
            const rule = GAN_ZHI_DECLARATIVE_RULES.stemFiveCombination
                .find((item) => pairMatches(left.gan, right.gan, item.members));
            if (rule) {
                facts.push(buildFact({
                    nodes,
                    kind: 'stem_five_combination',
                    layer: 'stem',
                    tone: 'supportive',
                    orders: [left.order, right.order],
                    label: `合化${rule.result}`,
                    summaryText: `${rule.members}合化${rule.result}`,
                    discriminator: rule.members,
                }));
            }
        }
    });
}

function appendTripleBranchFacts(
    nodes: GanZhiRelationNode[],
    settings: GanZhiRelationSettings,
    facts: GanZhiRelationFact[],
): Set<string> {
    const fullThreeCombinationElements = new Set<string>();
    if (settings.branchThreeCombination) {
        GAN_ZHI_DECLARATIVE_RULES.branchThreeCombination.forEach((rule) => {
            const occurrences = findTripleOccurrences(nodes, rule.members);
            if (occurrences.length > 0) {
                fullThreeCombinationElements.add(rule.result ?? '');
            }
            occurrences.forEach((orders) => {
                facts.push(buildFact({
                    nodes,
                    kind: 'branch_three_combination',
                    layer: 'branch',
                    tone: 'supportive',
                    orders,
                    label: `三合${rule.result}局`,
                    summaryText: `${rule.members}三合${rule.result}局`,
                    discriminator: rule.members,
                }));
            });
        });
    }

    if (settings.branchThreeMeeting) {
        GAN_ZHI_DECLARATIVE_RULES.branchThreeMeeting.forEach((rule) => {
            findTripleOccurrences(nodes, rule.members).forEach((orders) => {
                facts.push(buildFact({
                    nodes,
                    kind: 'branch_three_meeting',
                    layer: 'branch',
                    tone: 'supportive',
                    orders,
                    label: `三会${rule.result}局`,
                    summaryText: `${rule.members}三会${rule.result}局`,
                    discriminator: rule.members,
                }));
            });
        });
    }
    return fullThreeCombinationElements;
}

function appendPairBranchFacts(
    nodes: GanZhiRelationNode[],
    settings: GanZhiRelationSettings,
    fullThreeCombinationElements: Set<string>,
    facts: GanZhiRelationFact[],
) {
    everyPair(nodes, (left, right) => {
        const orders = [left.order, right.order];
        const pushPair = (
            kind: GanZhiRelationKind,
            tone: GanZhiRelationTone,
            label: string,
            summaryText: string,
            discriminator: string,
        ) => {
            facts.push(buildFact({
                nodes,
                kind,
                layer: 'branch',
                tone,
                orders,
                label,
                summaryText,
                discriminator,
            }));
        };

        if (settings.branchSixCombination) {
            const rule = GAN_ZHI_DECLARATIVE_RULES.branchSixCombination
                .find((item) => pairMatches(left.zhi, right.zhi, item.members));
            if (rule) {
                pushPair(
                    'branch_six_combination',
                    'supportive',
                    `合化${rule.result}`,
                    `${rule.members}合化${rule.result}`,
                    rule.members,
                );
            }
        }

        if (settings.branchThreeCombination) {
            const rule = GAN_ZHI_DECLARATIVE_RULES.branchHalfCombination
                .find((item) => pairMatches(left.zhi, right.zhi, item.members));
            if (rule && !fullThreeCombinationElements.has(rule.result ?? '')) {
                pushPair(
                    'branch_half_combination',
                    'supportive',
                    `半合${rule.result}局`,
                    `${rule.members}半合${rule.result}局`,
                    rule.members,
                );
            }
        }

        if (settings.branchHiddenCombination) {
            const rule = GAN_ZHI_DECLARATIVE_RULES.branchHiddenCombination
                .find((item) => pairMatches(left.zhi, right.zhi, item.members));
            if (rule) {
                pushPair('branch_hidden_combination', 'supportive', '暗合', `${rule.members}暗合`, rule.members);
            }
        }

        const sandwichRule = GAN_ZHI_DECLARATIVE_RULES.branchSandwich
            .find((item) => pairMatches(left.zhi, right.zhi, item.members));
        const adjacent = Math.abs(left.order - right.order) === 1;
        const sandwichedAbsent = sandwichRule?.result
            ? !nodes.some((node) => isUsableNode(node) && node.zhi === sandwichRule.result)
            : false;
        const hiddenSandwich = Boolean(
            sandwichRule
            && adjacent
            && sandwichedAbsent
            && left.gan === right.gan
            && settings.branchHiddenSandwich,
        );
        if (hiddenSandwich && sandwichRule) {
            pushPair(
                'branch_hidden_sandwich',
                'neutral',
                `暗夹${sandwichRule.result}`,
                `${sandwichRule.members}暗夹${sandwichRule.result}`,
                sandwichRule.members,
            );
        } else if (sandwichRule && adjacent && sandwichedAbsent && settings.branchSandwich) {
            pushPair(
                'branch_sandwich',
                'neutral',
                `夹${sandwichRule.result}`,
                `${sandwichRule.members}夹${sandwichRule.result}`,
                sandwichRule.members,
            );
        }

        if (settings.branchPunishment) {
            const punishment = ZHI_XING_PAIR_RULES.find((rule) => (
                left.zhi !== right.zhi
                && rule.members.includes(left.zhi as never)
                && rule.members.includes(right.zhi as never)
            ));
            if (punishment) {
                pushPair(
                    'branch_punishment',
                    'obstructive',
                    '刑',
                    `${left.zhi}${right.zhi}相刑`,
                    punishment.members.join(''),
                );
            }
            if (left.zhi === right.zhi && ZHI_XING_SELF.includes(left.zhi as never)) {
                pushPair(
                    'branch_self_punishment',
                    'obstructive',
                    '自刑',
                    `${left.zhi}自刑`,
                    left.zhi,
                );
            }
        }

        const obstructiveRules: Array<{
            enabled: boolean;
            kind: GanZhiRelationKind;
            rules: readonly PairRule[];
            label: string;
            suffix: string;
        }> = [
            {
                enabled: settings.branchClash,
                kind: 'branch_clash',
                rules: GAN_ZHI_DECLARATIVE_RULES.branchClash,
                label: '冲',
                suffix: '相冲',
            },
            {
                enabled: settings.branchBreak,
                kind: 'branch_break',
                rules: GAN_ZHI_DECLARATIVE_RULES.branchBreak,
                label: '破',
                suffix: '相破',
            },
            {
                enabled: settings.branchHarm,
                kind: 'branch_harm',
                rules: GAN_ZHI_DECLARATIVE_RULES.branchHarm,
                label: '害',
                suffix: '相害',
            },
        ];
        obstructiveRules.forEach((entry) => {
            if (!entry.enabled) return;
            const rule = entry.rules.find((item) => pairMatches(left.zhi, right.zhi, item.members));
            if (rule) {
                pushPair(
                    entry.kind,
                    'obstructive',
                    entry.label,
                    `${rule.members}${entry.suffix}`,
                    rule.members,
                );
            }
        });
    });
}

function appendPillarFacts(
    nodes: GanZhiRelationNode[],
    settings: GanZhiRelationSettings,
    facts: GanZhiRelationFact[],
) {
    nodes.forEach((node) => {
        if (!isUsableNode(node)) return;
        if (
            settings.pillarSelfCombination
            && GAN_ZHI_DECLARATIVE_RULES.pillarSelfCombination.includes(node.pillar)
        ) {
            facts.push(buildFact({
                nodes,
                kind: 'pillar_self_combination',
                layer: 'pillar',
                tone: 'supportive',
                orders: [node.order],
                label: '自合',
                summaryText: `${node.pillar}自合`,
                discriminator: node.pillar,
            }));
        }

        const status = getPillarStatus(node.gan, node.zhi);
        if (status === '盖头' && settings.pillarCover) {
            facts.push(buildFact({
                nodes,
                kind: 'pillar_cover',
                layer: 'pillar',
                tone: 'neutral',
                orders: [node.order],
                label: status,
                summaryText: `${node.pillar}${status}`,
                discriminator: node.pillar,
            }));
        }
        if (status === '截脚' && settings.pillarCut) {
            facts.push(buildFact({
                nodes,
                kind: 'pillar_cut',
                layer: 'pillar',
                tone: 'neutral',
                orders: [node.order],
                label: status,
                summaryText: `${node.pillar}${status}`,
                discriminator: node.pillar,
            }));
        }
    });

    everyPair(nodes, (left, right) => {
        const orders = [left.order, right.order];
        if (settings.pillarRepeating && left.pillar === right.pillar) {
            facts.push(buildFact({
                nodes,
                kind: 'pillar_repeating',
                layer: 'pillar',
                tone: 'neutral',
                orders,
                label: '伏吟',
                summaryText: `${left.pillar}伏吟`,
                discriminator: left.pillar,
            }));
        }
        const branchClashes = GAN_ZHI_DECLARATIVE_RULES.branchClash
            .some((rule) => pairMatches(left.zhi, right.zhi, rule.members));
        if (
            settings.pillarOpposing
            && branchClashes
            && getGanKeMeta(left.gan, right.gan)
        ) {
            facts.push(buildFact({
                nodes,
                kind: 'pillar_opposing',
                layer: 'pillar',
                tone: 'obstructive',
                orders,
                label: '反吟',
                summaryText: `${left.pillar}↔${right.pillar}反吟`,
                discriminator: `${left.pillar}:${right.pillar}`,
            }));
        }
    });

    if (settings.pillarHiddenCarry) {
        const natalNodes = nodes.filter((node) => node.scope === 'yuanju' && isUsableNode(node));
        for (let index = 0; index < natalNodes.length - 1; index += 1) {
            const left = natalNodes[index];
            const right = natalNodes[index + 1];
            if (Math.abs(left.order - right.order) !== 1) continue;
            const hidden = hiddenCarryPillar(left.pillar, right.pillar);
            if (!hidden) continue;
            facts.push(buildFact({
                nodes,
                kind: 'pillar_hidden_carry',
                layer: 'pillar',
                tone: 'neutral',
                orders: [left.order, right.order],
                label: `暗带${hidden}`,
                summaryText: `${left.pillar}${right.pillar}暗带${hidden}`,
                discriminator: hidden,
            }));
        }
    }
}

export function sortGanZhiRelationFacts(facts: GanZhiRelationFact[]): GanZhiRelationFact[] {
    return [...facts].sort((left, right) => {
        const leftSpan = left.rightOrder - left.leftOrder;
        const rightSpan = right.rightOrder - right.leftOrder;
        if (leftSpan !== rightSpan) return rightSpan - leftSpan;
        if (left.leftOrder !== right.leftOrder) return left.leftOrder - right.leftOrder;
        if (left.rightOrder !== right.rightOrder) return right.rightOrder - left.rightOrder;
        if (left.priority !== right.priority) return left.priority - right.priority;
        return left.key.localeCompare(right.key);
    });
}

export function calculateGanZhiRelations(
    nodes: GanZhiRelationNode[],
    rawSettings: GanZhiRelationSettings = DEFAULT_GAN_ZHI_RELATION_SETTINGS,
): GanZhiRelationFact[] {
    const settings = normalizeGanZhiRelationSettings(rawSettings);
    const facts: GanZhiRelationFact[] = [];
    appendStemFacts(nodes, settings, facts);
    const fullThreeCombinationElements = appendTripleBranchFacts(nodes, settings, facts);
    appendPairBranchFacts(nodes, settings, fullThreeCombinationElements, facts);
    appendPillarFacts(nodes, settings, facts);
    return sortGanZhiRelationFacts(facts);
}
