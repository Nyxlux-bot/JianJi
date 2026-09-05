import {
    CONTROLS,
    GAN_CHONG,
    GAN_HE,
    GENERATES,
    getDictPairEntry,
    getGanKeMeta,
    getPairKey,
    getPillarStatus,
    isFanyinPair,
    isZhiXingPair,
    ZHI_AN_HE,
    ZHI_BAN_HE,
    ZHI_CHONG,
    ZHI_HAI,
    ZHI_LIU_HE,
    ZHI_PO,
    ZHI_SAN_HE,
    ZHI_SAN_HUI,
    ZHI_XING_SELF,
} from './bazi-relation-rules';
import { DIZHI_WUXING, TIANGAN_WUXING, type WuXing } from './liuyao-data';
import { buildWuXingBandFromMonthBranch } from './renyuan-duty';
import type { BaziResult } from './bazi-types';
import type { BaziFortuneSelection } from './bazi-ai-context';

export const BAZI_WUXING_ENERGY_VERSION = 'bazi_wuxing_energy_v1' as const;
export const BAZI_WUXING_ORDER = ['木', '火', '土', '金', '水'] as const;

export type BaziWuXingElement = typeof BAZI_WUXING_ORDER[number];
export type BaziWuXingSeasonStatus = '旺' | '相' | '休' | '囚' | '死' | '—';
export type BaziTenGodGroup = '印绶' | '比劫' | '食伤' | '财才' | '官杀';

export interface BaziWuXingEnergyElementSnapshot {
    element: BaziWuXingElement;
    percentage: number;
    directCount: number;
    withHiddenCount: number;
    seasonStatus: BaziWuXingSeasonStatus;
    tenGodGroup: BaziTenGodGroup;
}

export interface BaziWuXingEnergySnapshot {
    version: typeof BAZI_WUXING_ENERGY_VERSION;
    scope: 'fortune_selection';
    focus: {
        mode: 'dayun' | 'xiaoyun';
        yunGanZhi: string;
        liuNianGanZhi: string;
        liuYueGanZhi: string;
    };
    elements: BaziWuXingEnergyElementSnapshot[];
    samePartyPercentage: number;
    differentPartyPercentage: number;
    omittedSources: string[];
}

interface EnergySource {
    key: string;
    ganZhi: string;
    stem: string;
    branch: string;
    kind: 'original' | 'palace' | 'fortune';
}

const SEASON_MULTIPLIER: Record<BaziWuXingSeasonStatus, number> = {
    旺: 1.4,
    相: 1.2,
    休: 1,
    囚: 0.8,
    死: 0.6,
    '—': 1,
};

function createElementRecord(initialValue = 0): Record<BaziWuXingElement, number> {
    return {
        木: initialValue,
        火: initialValue,
        土: initialValue,
        金: initialValue,
        水: initialValue,
    };
}

function isWuXing(value: WuXing | undefined): value is BaziWuXingElement {
    return Boolean(value && BAZI_WUXING_ORDER.includes(value as BaziWuXingElement));
}

function parseGanZhi(value: string): { stem: string; branch: string; ganZhi: string } | null {
    const text = value.trim();
    for (let index = 0; index < text.length - 1; index += 1) {
        const stem = text[index];
        const branch = text[index + 1];
        if (TIANGAN_WUXING[stem] && DIZHI_WUXING[branch]) {
            return { stem, branch, ganZhi: `${stem}${branch}` };
        }
    }
    return null;
}

function parseOriginalGanZhi(value: string): { stem: string; branch: string; ganZhi: string } | null {
    const text = value.trim();
    if (text.length !== 2 || !TIANGAN_WUXING[text[0]] || !DIZHI_WUXING[text[1]]) {
        return null;
    }
    return { stem: text[0], branch: text[1], ganZhi: text };
}

function addElementScore(
    scores: Record<BaziWuXingElement, number>,
    element: WuXing | undefined,
    amount: number,
): void {
    if (isWuXing(element)) {
        scores[element] += amount;
    }
}

function addGanZhiScore(
    scores: Record<BaziWuXingElement, number>,
    source: EnergySource,
    stemScore: number,
    branchScore: number,
): void {
    addElementScore(scores, TIANGAN_WUXING[source.stem], stemScore);
    addElementScore(scores, DIZHI_WUXING[source.branch], branchScore);
}

function getGeneratingParent(element: BaziWuXingElement): BaziWuXingElement {
    const parent = BAZI_WUXING_ORDER.find((candidate) => GENERATES[candidate] === element);
    if (!parent) {
        throw new Error(`无法解析${element}的生扶五行`);
    }
    return parent;
}

function getTenGodGroup(dayElement: BaziWuXingElement, element: BaziWuXingElement): BaziTenGodGroup {
    if (element === dayElement) return '比劫';
    if (GENERATES[element] === dayElement) return '印绶';
    if (GENERATES[dayElement] === element) return '食伤';
    if (CONTROLS[dayElement] === element) return '财才';
    return '官杀';
}

function normalizePercentages(scores: Record<BaziWuXingElement, number>): Record<BaziWuXingElement, number> {
    const nonNegative = BAZI_WUXING_ORDER.map((element) => Math.max(0, scores[element]));
    const total = nonNegative.reduce((sum, value) => sum + value, 0);
    if (total <= 0) {
        throw new Error('五行综合能量总分为零，无法归一化');
    }

    const exact = nonNegative.map((value) => (value / total) * 100);
    const floors = exact.map(Math.floor);
    const remainder = 100 - floors.reduce((sum, value) => sum + value, 0);
    const order = exact
        .map((value, index) => ({ index, fraction: value - floors[index] }))
        .sort((left, right) => right.fraction - left.fraction || left.index - right.index);

    for (let index = 0; index < remainder; index += 1) {
        floors[order[index].index] += 1;
    }

    return BAZI_WUXING_ORDER.reduce<Record<BaziWuXingElement, number>>((accumulator, element, index) => {
        accumulator[element] = floors[index];
        return accumulator;
    }, createElementRecord());
}

function applyCappedDelta(
    scores: Record<BaziWuXingElement, number>,
    delta: Record<BaziWuXingElement, number>,
    capRatio: number,
): void {
    BAZI_WUXING_ORDER.forEach((element) => {
        const cap = Math.abs(scores[element] * capRatio);
        const bounded = Math.max(-cap, Math.min(cap, delta[element]));
        scores[element] = Math.max(0, scores[element] + bounded);
    });
}

function addPairPenalty(
    delta: Record<BaziWuXingElement, number>,
    left: EnergySource,
    right: EnergySource,
    amount: number,
    layer: 'stem' | 'branch',
): void {
    const leftElement = layer === 'stem' ? TIANGAN_WUXING[left.stem] : DIZHI_WUXING[left.branch];
    const rightElement = layer === 'stem' ? TIANGAN_WUXING[right.stem] : DIZHI_WUXING[right.branch];
    addElementScore(delta, leftElement, amount);
    addElementScore(delta, rightElement, amount);
}

function applyRelationCorrections(
    scores: Record<BaziWuXingElement, number>,
    sources: EnergySource[],
): void {
    const delta = createElementRecord();
    const branches = sources.map((source) => source.branch);
    const branchSet = new Set(branches);
    const fullThreeCombinationElements = new Set<WuXing>();

    Object.entries(ZHI_SAN_HUI).forEach(([members, resultElement]) => {
        if ([...members].every((member) => branchSet.has(member))) {
            addElementScore(delta, resultElement, 8);
        }
    });
    Object.entries(ZHI_SAN_HE).forEach(([members, resultElement]) => {
        if ([...members].every((member) => branchSet.has(member))) {
            fullThreeCombinationElements.add(resultElement);
            addElementScore(delta, resultElement, 8);
        }
    });

    for (let leftIndex = 0; leftIndex < sources.length; leftIndex += 1) {
        const left = sources[leftIndex];
        const pillarStatus = getPillarStatus(left.stem, left.branch);
        if (pillarStatus === '盖头') {
            addElementScore(delta, DIZHI_WUXING[left.branch], -0.75);
        } else if (pillarStatus === '截脚') {
            addElementScore(delta, TIANGAN_WUXING[left.stem], -0.75);
        }

        for (let rightIndex = leftIndex + 1; rightIndex < sources.length; rightIndex += 1) {
            const right = sources[rightIndex];
            const ganHe = getDictPairEntry(left.stem, right.stem, GAN_HE);
            if (ganHe) addElementScore(delta, ganHe[1], 4);

            if (getPairKey(left.stem, right.stem, GAN_CHONG)) {
                addPairPenalty(delta, left, right, -2, 'stem');
            }

            const ganKe = getGanKeMeta(left.stem, right.stem);
            if (ganKe) {
                addElementScore(delta, TIANGAN_WUXING[ganKe.controlled], -1);
            }

            const liuHe = getDictPairEntry(left.branch, right.branch, ZHI_LIU_HE);
            if (liuHe) addElementScore(delta, liuHe[1], 4);
            if (getPairKey(left.branch, right.branch, ZHI_AN_HE)) {
                addElementScore(delta, DIZHI_WUXING[left.branch], 0.5);
                addElementScore(delta, DIZHI_WUXING[right.branch], 0.5);
            }

            const banHe = getDictPairEntry(left.branch, right.branch, ZHI_BAN_HE);
            if (banHe && !fullThreeCombinationElements.has(banHe[1])) {
                addElementScore(delta, banHe[1], 3);
            }

            if (getPairKey(left.branch, right.branch, ZHI_CHONG)) {
                addPairPenalty(delta, left, right, -2, 'branch');
            }
            if (isZhiXingPair(left.branch, right.branch)) {
                addPairPenalty(delta, left, right, -1.5, 'branch');
            }
            if (left.branch === right.branch && ZHI_XING_SELF.includes(left.branch as never)) {
                addPairPenalty(delta, left, right, -1.5, 'branch');
            }
            if (getPairKey(left.branch, right.branch, ZHI_HAI)) {
                addPairPenalty(delta, left, right, -1, 'branch');
            }
            if (getPairKey(left.branch, right.branch, ZHI_PO)) {
                addPairPenalty(delta, left, right, -0.75, 'branch');
            }

            const isOriginalFortunePair = left.kind !== right.kind
                && (left.kind === 'original' || right.kind === 'original')
                && (left.kind === 'fortune' || right.kind === 'fortune');
            if (isOriginalFortunePair && left.ganZhi === right.ganZhi) {
                addElementScore(delta, TIANGAN_WUXING[left.stem], 1);
                addElementScore(delta, DIZHI_WUXING[left.branch], 1);
            } else if (isOriginalFortunePair && isFanyinPair(left.stem, left.branch, right.stem, right.branch)) {
                addPairPenalty(delta, left, right, -1.5, 'stem');
                addPairPenalty(delta, left, right, -1.5, 'branch');
            }
        }
    }

    applyCappedDelta(scores, delta, 0.15);
}

function applyShenShaActivation(
    result: Readonly<BaziResult>,
    sources: EnergySource[],
    scores: Record<BaziWuXingElement, number>,
): void {
    const delta = createElementRecord();
    const seen = new Set<string>();
    const addHit = (source: EnergySource, star: string, hitLevel: 'strong' | 'normal') => {
        const dedupeKey = `${source.key}:${star}`;
        if (seen.has(dedupeKey)) return;
        seen.add(dedupeKey);
        const amount = hitLevel === 'strong' ? 0.3 : 0.15;
        addElementScore(delta, TIANGAN_WUXING[source.stem], amount);
        addElementScore(delta, DIZHI_WUXING[source.branch], amount);
    };

    sources.forEach((source, index) => {
        if (source.kind === 'original') {
            result.shenShaV2.siZhu.byPillar[index]?.stars.forEach((hit) => addHit(source, hit.star, hit.hitLevel));
            return;
        }
        const bucket = result.shenShaV2.ganZhiBuckets?.[source.ganZhi];
        const carrier = bucket?.byPillar[3];
        carrier?.stars.forEach((hit) => addHit(source, hit.star, hit.hitLevel));
    });

    applyCappedDelta(scores, delta, 0.03);
}

function addOriginalScores(
    result: Readonly<BaziResult>,
    scores: Record<BaziWuXingElement, number>,
    directCounts: Record<BaziWuXingElement, number>,
    withHiddenCounts: Record<BaziWuXingElement, number>,
): EnergySource[] {
    return result.fourPillars.map((value, index) => {
        const parsed = parseOriginalGanZhi(value);
        if (!parsed) {
            throw new Error(`原局${['年', '月', '日', '时'][index]}柱干支非法：${value || '空值'}`);
        }
        const source: EnergySource = {
            key: `original-${index}`,
            kind: 'original',
            ...parsed,
        };
        addElementScore(scores, TIANGAN_WUXING[source.stem], 10);
        addElementScore(directCounts, TIANGAN_WUXING[source.stem], 1);
        addElementScore(withHiddenCounts, TIANGAN_WUXING[source.stem], 1);
        addElementScore(directCounts, DIZHI_WUXING[source.branch], 1);

        const hiddenGroup = result.cangGan[index];
        if (!hiddenGroup || hiddenGroup.diZhi !== source.branch) {
            throw new Error(`原局${['年', '月', '日', '时'][index]}柱藏干与地支不一致`);
        }
        const hidden = [hiddenGroup.benQi, hiddenGroup.zhongQi, hiddenGroup.yuQi]
            .filter((item): item is NonNullable<typeof item> => item !== null);
        if (hidden.length === 0) {
            throw new Error(`原局${['年', '月', '日', '时'][index]}柱缺少藏干数据`);
        }
        const ratios = hidden.length === 1 ? [1] : hidden.length === 2 ? [0.7, 0.3] : [0.6, 0.3, 0.1];
        hidden.slice(0, 3).forEach((item, hiddenIndex) => {
            const element = TIANGAN_WUXING[item.gan];
            if (!element) {
                throw new Error(`原局藏干非法：${item.gan || '空值'}`);
            }
            addElementScore(scores, element, 12 * ratios[hiddenIndex]);
            addElementScore(withHiddenCounts, element, 1);
        });
        return source;
    });
}

function resolveFortuneSources(
    result: Readonly<BaziResult>,
    selection: Readonly<BaziFortuneSelection>,
    omittedSources: string[],
): { sources: EnergySource[]; focus: BaziWuXingEnergySnapshot['focus'] } {
    const sources: EnergySource[] = [];
    let yunGanZhi = '';
    let liuNianGanZhi = '';
    let liuYueGanZhi = '';

    const pushSource = (key: string, value: string | undefined, missingLabel: string) => {
        const parsed = value ? parseGanZhi(value) : null;
        if (!parsed) {
            omittedSources.push(missingLabel);
            return;
        }
        const source: EnergySource = { key, kind: 'fortune', ...parsed };
        sources.push(source);
    };

    if (selection.mode === 'xiaoyun') {
        const xiaoYun = result.xiaoYun[selection.selectedXiaoYunIndex];
        yunGanZhi = xiaoYun?.xiaoYunGanZhi ?? '';
        liuNianGanZhi = xiaoYun?.ganZhi ?? '';
        pushSource('fortune-xiaoyun', yunGanZhi, '小运');
        pushSource('fortune-liunian', liuNianGanZhi, '流年');
        const liuYue = xiaoYun?.liuYue[selection.selectedLiuYueIndex];
        liuYueGanZhi = liuYue?.ganZhi ?? '';
        pushSource('fortune-liuyue', liuYueGanZhi, '流月');
    } else {
        const daYun = result.daYun[selection.selectedDaYunIndex];
        yunGanZhi = daYun?.ganZhi ?? '';
        pushSource('fortune-dayun', yunGanZhi, '大运');
        const liuNian = daYun?.liuNian[selection.selectedLiuNianIndex];
        liuNianGanZhi = liuNian?.ganZhi ?? '';
        pushSource('fortune-liunian', liuNianGanZhi, '流年');
        const liuYue = liuNian?.liuYue[selection.selectedLiuYueIndex];
        liuYueGanZhi = liuYue?.ganZhi ?? '';
        pushSource('fortune-liuyue', liuYueGanZhi, '流月');
    }

    return {
        sources,
        focus: {
            mode: selection.mode,
            yunGanZhi,
            liuNianGanZhi,
            liuYueGanZhi,
        },
    };
}

export function buildBaziWuXingEnergy(
    result: Readonly<BaziResult>,
    fortuneSelection: Readonly<BaziFortuneSelection>,
): BaziWuXingEnergySnapshot {
    if (!Array.isArray(result.fourPillars) || result.fourPillars.length !== 4) {
        throw new Error('原局四柱数据不完整，无法计算五行综合能量');
    }
    if (!Array.isArray(result.cangGan) || result.cangGan.length !== 4) {
        throw new Error('原局藏干数据不完整，无法计算五行综合能量');
    }
    const scores = createElementRecord();
    const directCounts = createElementRecord();
    const withHiddenCounts = createElementRecord();
    const omittedSources: string[] = [];
    const sources = addOriginalScores(result, scores, directCounts, withHiddenCounts);

    const palaceInputs = [
        ['胎元', result.baseInfo.taiYuan],
        ['胎息', result.baseInfo.taiXi],
        ['命宫', result.baseInfo.mingGong],
        ['身宫', result.baseInfo.shenGong],
    ] as const;
    palaceInputs.forEach(([label, value]) => {
        const parsed = parseGanZhi(value ?? '');
        if (!parsed) {
            omittedSources.push(label);
            return;
        }
        const source: EnergySource = { key: `palace-${label}`, kind: 'palace', ...parsed };
        sources.push(source);
        addGanZhiScore(scores, source, 2, 2);
    });

    const fortune = resolveFortuneSources(result, fortuneSelection, omittedSources);
    fortune.sources.forEach((source) => {
        const score = source.key.endsWith('liuyue') ? 2 : source.key.endsWith('liunian') ? 4 : 6;
        addGanZhiScore(scores, source, score, score);
        sources.push(source);
    });

    const seasonBand = buildWuXingBandFromMonthBranch(result.baseInfo.renYuanDutyDetail.monthBranch);
    const seasonByElement = BAZI_WUXING_ORDER.reduce<Record<BaziWuXingElement, BaziWuXingSeasonStatus>>((accumulator, element) => {
        const status = seasonBand.find((item) => item.element === element)?.status ?? '—';
        accumulator[element] = status;
        return accumulator;
    }, { 木: '—', 火: '—', 土: '—', 金: '—', 水: '—' });
    BAZI_WUXING_ORDER.forEach((element) => {
        scores[element] *= SEASON_MULTIPLIER[seasonByElement[element]];
    });

    applyRelationCorrections(scores, sources);
    applyShenShaActivation(result, sources, scores);
    const percentages = normalizePercentages(scores);

    const dayStem = parseOriginalGanZhi(result.fourPillars[2])?.stem;
    const dayElement = dayStem ? TIANGAN_WUXING[dayStem] : undefined;
    if (!isWuXing(dayElement)) {
        throw new Error('日主五行非法，无法计算同党异党');
    }
    const supportElement = getGeneratingParent(dayElement);
    const samePartyPercentage = percentages[dayElement] + percentages[supportElement];

    return {
        version: BAZI_WUXING_ENERGY_VERSION,
        scope: 'fortune_selection',
        focus: fortune.focus,
        elements: BAZI_WUXING_ORDER.map((element) => ({
            element,
            percentage: percentages[element],
            directCount: directCounts[element],
            withHiddenCount: withHiddenCounts[element],
            seasonStatus: seasonByElement[element],
            tenGodGroup: getTenGodGroup(dayElement, element),
        })),
        samePartyPercentage,
        differentPartyPercentage: 100 - samePartyPercentage,
        omittedSources: Array.from(new Set(omittedSources)),
    };
}
