import { DI_ZHI, TIAN_GAN, TIANGAN_WUXING, WuXing } from './liuyao-data';

const PILLAR_NAMES = ['年', '月', '日', '时'] as const;
const VALID_STEMS = new Set<string>(TIAN_GAN);
const VALID_BRANCHES = new Set<string>(DI_ZHI);

const GAN_HE: Record<string, WuXing> = {
    甲己: '土',
    乙庚: '金',
    丙辛: '水',
    丁壬: '木',
    戊癸: '火',
};
const GAN_CHONG = ['甲庚', '乙辛', '丙壬', '丁癸'] as const;

const ZHI_SAN_HUI: Record<string, WuXing> = {
    亥子丑: '水',
    寅卯辰: '木',
    巳午未: '火',
    申酉戌: '金',
};
const ZHI_SAN_HE: Record<string, WuXing> = {
    申子辰: '水',
    亥卯未: '木',
    寅午戌: '火',
    巳酉丑: '金',
};
const ZHI_LIU_HE: Record<string, WuXing> = {
    子丑: '土',
    寅亥: '木',
    卯戌: '火',
    辰酉: '金',
    巳申: '水',
    午未: '土',
};
const ZHI_CHONG = ['子午', '丑未', '寅申', '卯酉', '辰戌', '巳亥'] as const;
const ZHI_HAI = ['子未', '丑午', '寅巳', '卯辰', '申亥', '酉戌'] as const;

const ZHI_XING_PAIR_RULES = [
    { members: ['子', '卯'] as const, name: '无礼之刑' },
    { members: ['寅', '巳', '申'] as const, name: '无恩之刑' },
    { members: ['丑', '未', '戌'] as const, name: '恃势之刑' },
] as const;
const ZHI_XING_SELF = ['辰', '午', '酉', '亥'] as const;

const MONTH_BRANCH_SEASON_ELEMENT: Record<string, WuXing> = {
    寅: '木',
    卯: '木',
    辰: '木',
    巳: '火',
    午: '火',
    未: '火',
    申: '金',
    酉: '金',
    戌: '金',
    亥: '水',
    子: '水',
    丑: '水',
};

type PillarIndex = 0 | 1 | 2 | 3;
type BaziRelationDomain = 'gan' | 'zhi';

export type BaziRelationType =
    | 'gan_he'
    | 'gan_chong'
    | 'zhi_san_hui'
    | 'zhi_san_he'
    | 'zhi_liu_he'
    | 'zhi_chong'
    | 'zhi_hai'
    | 'zhi_xing_pair'
    | 'zhi_xing_summary'
    | 'zhi_self_xing';

export type BaziRelationState = 'objective' | 'supported' | 'constrained' | 'coexists';

export interface BaziRelationEvaluationContext {
    monthBranch?: string;
    visibleStems?: string[];
    hiddenStemsByPillar?: string[][];
    policy?: 'ziping_strict_v1';
}

export interface BaziRelationInteractionEvaluation {
    fact: string;
    relationType: BaziRelationType;
    state: BaziRelationState;
    reasons: string[];
    relatedFacts: string[];
}

interface BaziRelationFact {
    id: string;
    fact: string;
    relationType: BaziRelationType;
    domain: BaziRelationDomain;
    members: string[];
    pillarIndexes: PillarIndex[];
    supportElement?: WuXing;
}

interface NormalizedEvaluationContext {
    monthBranch: string;
    visibleStems: string[];
    hiddenStemsByPillar: [string[], string[], string[], string[]];
    policy: 'ziping_strict_v1';
}

interface PreliminaryRelationEvaluation {
    fact: BaziRelationFact;
    state: Exclude<BaziRelationState, 'coexists'>;
    reasons: string[];
    interactionPriority: number;
}

const POSITIVE_RELATION_TYPES = new Set<BaziRelationType>([
    'gan_he',
    'zhi_san_hui',
    'zhi_san_he',
    'zhi_liu_he',
]);

function assertValidPillars(tg: string[], dz: string[]): void {
    if (!Array.isArray(tg) || tg.length !== 4) {
        throw new Error('天干数组长度必须为4');
    }
    if (!Array.isArray(dz) || dz.length !== 4) {
        throw new Error('地支数组长度必须为4');
    }

    tg.forEach((stem) => {
        if (!VALID_STEMS.has(stem)) {
            throw new Error(`无效天干: ${String(stem)}`);
        }
    });
    dz.forEach((branch) => {
        if (!VALID_BRANCHES.has(branch)) {
            throw new Error(`无效地支: ${String(branch)}`);
        }
    });
}

function normalizeEvaluationContext(
    dz: string[],
    context: BaziRelationEvaluationContext = {},
): NormalizedEvaluationContext {
    const monthBranch = context.monthBranch ?? dz[1];
    if (!VALID_BRANCHES.has(monthBranch)) {
        throw new Error(`无效月令地支: ${String(monthBranch)}`);
    }

    const extraVisible = context.visibleStems ?? [];
    extraVisible.forEach((stem) => {
        if (!VALID_STEMS.has(stem)) {
            throw new Error(`无效透干: ${String(stem)}`);
        }
    });

    const hiddenStemsByPillar = context.hiddenStemsByPillar ?? [[], [], [], []];
    if (!Array.isArray(hiddenStemsByPillar) || hiddenStemsByPillar.length !== 4) {
        throw new Error('hiddenStemsByPillar 长度必须为4');
    }

    hiddenStemsByPillar.forEach((stems, index) => {
        if (!Array.isArray(stems)) {
            throw new Error(`hiddenStemsByPillar[${index}] 必须为数组`);
        }
        stems.forEach((stem) => {
            if (!VALID_STEMS.has(stem)) {
                throw new Error(`无效藏干: ${String(stem)}`);
            }
        });
    });

    const policy = context.policy ?? 'ziping_strict_v1';
    if (policy !== 'ziping_strict_v1') {
        throw new Error(`不支持的关系评估策略: ${String(policy)}`);
    }

    return {
        monthBranch,
        visibleStems: [...extraVisible],
        hiddenStemsByPillar: [
            [...hiddenStemsByPillar[0]],
            [...hiddenStemsByPillar[1]],
            [...hiddenStemsByPillar[2]],
            [...hiddenStemsByPillar[3]],
        ],
        policy,
    };
}

function getPairKey(pairA: string, pairB: string, rules: readonly string[]): string | null {
    for (const rule of rules) {
        if (rule === pairA + pairB || rule === pairB + pairA) {
            return rule;
        }
    }
    return null;
}

function getDictPairEntry<T>(pairA: string, pairB: string, dict: Record<string, T>): [string, T] | null {
    for (const [key, value] of Object.entries(dict)) {
        if (key === pairA + pairB || key === pairB + pairA) {
            return [key, value];
        }
    }
    return null;
}

function findPresentIndexes(dz: string[], members: string[]): PillarIndex[] | null {
    const indexes: number[] = members.map((member) => dz.findIndex((branch) => branch === member));
    if (indexes.some((index) => index < 0)) {
        return null;
    }
    return indexes.sort((a, b) => a - b) as PillarIndex[];
}

function formatPairPillars(i: PillarIndex, j: PillarIndex): string {
    return `${PILLAR_NAMES[i]}柱与${PILLAR_NAMES[j]}柱`;
}

function formatGroupedPillars(indexes: PillarIndex[]): string {
    return indexes.map((index) => PILLAR_NAMES[index]).join('/');
}

function buildFactId(relationType: BaziRelationType, pillarIndexes: PillarIndex[], members: string[]): string {
    return `${relationType}:${pillarIndexes.join('-')}:${members.join('')}`;
}

function createTrioFact(
    relationType: 'zhi_san_hui' | 'zhi_san_he',
    key: string,
    element: WuXing,
    pillarIndexes: PillarIndex[],
): BaziRelationFact {
    const relationLabel = relationType === 'zhi_san_hui' ? `三会${element}局` : `三合${element}局`;
    return {
        id: buildFactId(relationType, pillarIndexes, key.split('')),
        fact: `${formatGroupedPillars(pillarIndexes)}地支构成${key}${relationLabel}`,
        relationType,
        domain: 'zhi',
        members: key.split(''),
        pillarIndexes,
        supportElement: element,
    };
}

function createPairFact(params: {
    relationType: 'gan_he' | 'gan_chong' | 'zhi_liu_he' | 'zhi_chong' | 'zhi_hai' | 'zhi_xing_pair';
    i: PillarIndex;
    j: PillarIndex;
    key: string;
    supportElement?: WuXing;
    suffix: string;
}): BaziRelationFact {
    const domainLabel = params.relationType.startsWith('gan_') ? '天干' : '地支';
    return {
        id: buildFactId(params.relationType, [params.i, params.j], params.key.split('')),
        fact: `${formatPairPillars(params.i, params.j)}${domainLabel}${params.key}${params.suffix}`,
        relationType: params.relationType,
        domain: params.relationType.startsWith('gan_') ? 'gan' : 'zhi',
        members: params.key.split(''),
        pillarIndexes: [params.i, params.j],
        supportElement: params.supportElement,
    };
}

function createXingSummaryFact(
    members: readonly string[],
    name: string,
    pillarIndexes: PillarIndex[],
): BaziRelationFact {
    const group = members.join('');
    return {
        id: buildFactId('zhi_xing_summary', pillarIndexes, [...members]),
        fact: `${formatGroupedPillars(pillarIndexes)}地支齐见${group}，构成${name}`,
        relationType: 'zhi_xing_summary',
        domain: 'zhi',
        members: [...members],
        pillarIndexes,
    };
}

function createSelfXingFact(branch: string, pillarIndexes: PillarIndex[]): BaziRelationFact {
    return {
        id: buildFactId('zhi_self_xing', pillarIndexes, [branch]),
        fact: `${formatGroupedPillars(pillarIndexes)}柱地支同见${branch}，构成${branch}自刑`,
        relationType: 'zhi_self_xing',
        domain: 'zhi',
        members: [branch],
        pillarIndexes,
    };
}

function getXingPairMeta(a: string, b: string): { key: string; name: string } | null {
    for (const rule of ZHI_XING_PAIR_RULES) {
        if (rule.members.includes(a as never) && rule.members.includes(b as never)) {
            return {
                key: rule.members.filter((member) => member === a || member === b).join(''),
                name: rule.name,
            };
        }
    }
    return null;
}

function collectBaziRelationFacts(tg: string[], dz: string[]): BaziRelationFact[] {
    assertValidPillars(tg, dz);

    const facts: BaziRelationFact[] = [];

    for (const [key, element] of Object.entries(ZHI_SAN_HUI)) {
        const indexes = findPresentIndexes(dz, key.split(''));
        if (indexes) {
            facts.push(createTrioFact('zhi_san_hui', key, element, indexes));
        }
    }

    for (const [key, element] of Object.entries(ZHI_SAN_HE)) {
        const indexes = findPresentIndexes(dz, key.split(''));
        if (indexes) {
            facts.push(createTrioFact('zhi_san_he', key, element, indexes));
        }
    }

    for (let i = 0; i < 3; i += 1) {
        for (let j = i + 1; j < 4; j += 1) {
            const stemA = tg[i];
            const stemB = tg[j];
            const ganHeEntry = getDictPairEntry(stemA, stemB, GAN_HE);
            if (ganHeEntry) {
                facts.push(createPairFact({
                    relationType: 'gan_he',
                    i: i as PillarIndex,
                    j: j as PillarIndex,
                    key: ganHeEntry[0],
                    supportElement: ganHeEntry[1],
                    suffix: '五合',
                }));
            }

            const ganChongKey = getPairKey(stemA, stemB, GAN_CHONG);
            if (ganChongKey) {
                facts.push(createPairFact({
                    relationType: 'gan_chong',
                    i: i as PillarIndex,
                    j: j as PillarIndex,
                    key: ganChongKey,
                    suffix: '相冲',
                }));
            }
        }
    }

    for (let i = 0; i < 3; i += 1) {
        for (let j = i + 1; j < 4; j += 1) {
            const branchA = dz[i];
            const branchB = dz[j];
            const liuHeEntry = getDictPairEntry(branchA, branchB, ZHI_LIU_HE);
            if (liuHeEntry) {
                facts.push(createPairFact({
                    relationType: 'zhi_liu_he',
                    i: i as PillarIndex,
                    j: j as PillarIndex,
                    key: liuHeEntry[0],
                    supportElement: liuHeEntry[1],
                    suffix: '六合',
                }));
            }

            const zhiChongKey = getPairKey(branchA, branchB, ZHI_CHONG);
            if (zhiChongKey) {
                facts.push(createPairFact({
                    relationType: 'zhi_chong',
                    i: i as PillarIndex,
                    j: j as PillarIndex,
                    key: zhiChongKey,
                    suffix: '六冲',
                }));
            }

            const zhiHaiKey = getPairKey(branchA, branchB, ZHI_HAI);
            if (zhiHaiKey) {
                facts.push(createPairFact({
                    relationType: 'zhi_hai',
                    i: i as PillarIndex,
                    j: j as PillarIndex,
                    key: zhiHaiKey,
                    suffix: '六害',
                }));
            }

            const xingPairMeta = getXingPairMeta(branchA, branchB);
            if (xingPairMeta) {
                facts.push(createPairFact({
                    relationType: 'zhi_xing_pair',
                    i: i as PillarIndex,
                    j: j as PillarIndex,
                    key: xingPairMeta.key,
                    suffix: `相刑（${xingPairMeta.name}）`,
                }));
            }
        }
    }

    ZHI_XING_PAIR_RULES
        .filter((rule) => rule.members.length === 3)
        .forEach((rule) => {
            const indexes = findPresentIndexes(dz, [...rule.members]);
            if (indexes) {
                facts.push(createXingSummaryFact(rule.members, rule.name, indexes));
            }
        });

    ZHI_XING_SELF.forEach((branch) => {
        const indexes = dz.reduce<PillarIndex[]>((result, value, index) => {
            if (value === branch) {
                result.push(index as PillarIndex);
            }
            return result;
        }, []);
        if (indexes.length >= 2) {
            facts.push(createSelfXingFact(branch, indexes));
        }
    });

    return facts;
}

function isPositiveRelation(relationType: BaziRelationType): boolean {
    return POSITIVE_RELATION_TYPES.has(relationType);
}

function isAdjacentPair(pillarIndexes: PillarIndex[]): boolean {
    return pillarIndexes.length === 2 && pillarIndexes[1] - pillarIndexes[0] === 1;
}

function uniqueStrings(items: string[]): string[] {
    return [...new Set(items)];
}

function getSupportStemPool(
    fact: BaziRelationFact,
    tg: string[],
    context: NormalizedEvaluationContext,
): string[] {
    const visiblePool = fact.relationType === 'gan_he'
        ? tg.filter((_, index) => !fact.pillarIndexes.includes(index as PillarIndex))
        : [...tg];

    return [
        ...visiblePool,
        ...context.visibleStems,
        ...context.hiddenStemsByPillar.flat(),
    ];
}

function getElementSupportStems(
    fact: BaziRelationFact,
    tg: string[],
    context: NormalizedEvaluationContext,
): string[] {
    if (!fact.supportElement) {
        return [];
    }

    return uniqueStrings(getSupportStemPool(fact, tg, context).filter((stem) => TIANGAN_WUXING[stem] === fact.supportElement));
}

function buildPositivePreliminaryEvaluation(
    fact: BaziRelationFact,
    tg: string[],
    context: NormalizedEvaluationContext,
): PreliminaryRelationEvaluation {
    const reasons: string[] = ['结构上存在该合会关系'];
    let supportCount = 0;

    if ((fact.relationType === 'gan_he' || fact.relationType === 'zhi_liu_he') && isAdjacentPair(fact.pillarIndexes)) {
        supportCount += 1;
        reasons.push('两柱紧贴，具备先天牵连条件');
    }

    if (fact.supportElement && MONTH_BRANCH_SEASON_ELEMENT[context.monthBranch] === fact.supportElement) {
        supportCount += 1;
        reasons.push(`月令为${context.monthBranch}，按当前策略扶助${fact.supportElement}气`);
    }

    const supportStems = getElementSupportStems(fact, tg, context);
    if (fact.supportElement && supportStems.length > 0) {
        supportCount += 1;
        reasons.push(`见${supportStems.join('、')}透干/藏干扶助${fact.supportElement}气`);
    }

    let state: PreliminaryRelationEvaluation['state'] = 'constrained';
    if (supportCount >= 2) {
        state = 'supported';
    } else if (supportCount === 1) {
        state = 'objective';
    } else {
        reasons.push('未见得令或透干/藏干扶助，当前仅按结构事实保留');
    }

    return {
        fact,
        state,
        reasons,
        interactionPriority: getInteractionPriority(fact, state),
    };
}

function buildNegativePreliminaryEvaluation(fact: BaziRelationFact): PreliminaryRelationEvaluation {
    const reasons = ['结构上存在该冲刑害关系'];
    if (fact.relationType === 'zhi_xing_summary') {
        reasons.push('三支齐见，三刑条件完整出现');
    }
    if (fact.relationType === 'zhi_self_xing') {
        reasons.push('同支重复至少两次，自刑条件成立');
    }

    return {
        fact,
        state: 'objective',
        reasons,
        interactionPriority: getInteractionPriority(fact, 'objective'),
    };
}

function getInteractionPriority(
    fact: BaziRelationFact,
    state: Exclude<BaziRelationState, 'coexists'>,
): number {
    switch (fact.relationType) {
        case 'zhi_san_hui':
            return 60;
        case 'zhi_san_he':
            return 50;
        case 'gan_he':
        case 'zhi_liu_he':
            return state === 'supported' ? 40 : 15;
        case 'gan_chong':
        case 'zhi_chong':
            return 30;
        case 'zhi_hai':
            return 20;
        case 'zhi_xing_pair':
        case 'zhi_xing_summary':
        case 'zhi_self_xing':
            return 10;
        default:
            return 0;
    }
}

function factsInteract(current: BaziRelationFact, other: BaziRelationFact): boolean {
    return current.domain === other.domain && current.members.some((member) => other.members.includes(member));
}

function applyInteractionState(
    current: PreliminaryRelationEvaluation,
    evaluations: PreliminaryRelationEvaluation[],
): BaziRelationInteractionEvaluation {
    const overlapping = evaluations.filter((candidate) => candidate.fact.id !== current.fact.id && factsInteract(current.fact, candidate.fact));
    const positiveOverlaps = overlapping.filter((candidate) => isPositiveRelation(candidate.fact.relationType));
    const negativeOverlaps = overlapping.filter((candidate) => !isPositiveRelation(candidate.fact.relationType));
    const strongerPositiveOverlaps = positiveOverlaps.filter((candidate) => candidate.interactionPriority > current.interactionPriority);

    const reasons = [...current.reasons];
    const relatedFacts = uniqueStrings(overlapping.map((candidate) => candidate.fact.fact));
    let state: BaziRelationState = current.state;

    if (isPositiveRelation(current.fact.relationType)) {
        if (current.state === 'supported') {
            if (negativeOverlaps.length > 0) {
                state = 'coexists';
                reasons.push(`虽获扶助，但仍与${negativeOverlaps.map((item) => item.fact.fact).join('；')}并见`);
            }
        } else if (negativeOverlaps.length > 0) {
            state = 'constrained';
            reasons.push(`未达成化条件，按合而未化且受${negativeOverlaps.map((item) => item.fact.fact).join('；')}牵制处理`);
        } else if (strongerPositiveOverlaps.length > 0) {
            state = 'coexists';
            reasons.push(`与更完整的${strongerPositiveOverlaps.map((item) => item.fact.fact).join('；')}并存`);
        }
    } else if (strongerPositiveOverlaps.length > 0) {
        state = 'constrained';
        reasons.push(`受${strongerPositiveOverlaps.map((item) => item.fact.fact).join('；')}牵制，仍保留为结构事实`);
    } else if (positiveOverlaps.length > 0) {
        state = 'coexists';
        reasons.push(`与${positiveOverlaps.map((item) => item.fact.fact).join('；')}并见，当前不作删除`);
    }

    return {
        fact: current.fact.fact,
        relationType: current.fact.relationType,
        state,
        reasons: uniqueStrings(reasons),
        relatedFacts,
    };
}

/**
 * 提取四柱中的客观合冲刑害事实，只输出结构上可直接确认的关系。
 */
export function extractBaziRelations(tg: string[], dz: string[]): string[] {
    return collectBaziRelationFacts(tg, dz).map((fact) => fact.fact);
}

/**
 * 在结构事实之上，按显式策略评估扶助、牵制与并存关系。
 */
export function evaluateBaziRelationInteractions(
    tg: string[],
    dz: string[],
    context: BaziRelationEvaluationContext = {},
): BaziRelationInteractionEvaluation[] {
    assertValidPillars(tg, dz);
    const normalizedContext = normalizeEvaluationContext(dz, context);
    const facts = collectBaziRelationFacts(tg, dz);
    const preliminary = facts.map((fact) => (
        isPositiveRelation(fact.relationType)
            ? buildPositivePreliminaryEvaluation(fact, tg, normalizedContext)
            : buildNegativePreliminaryEvaluation(fact)
    ));

    return preliminary.map((item) => applyInteractionState(item, preliminary));
}
