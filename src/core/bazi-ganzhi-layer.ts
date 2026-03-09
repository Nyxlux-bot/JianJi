import {
    GAN_CHONG,
    GAN_HE,
    getDictPairEntry,
    getGanKeMeta,
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
    ZHI_XING_SELF,
} from './bazi-relation-rules';
import { BaziResult } from './bazi-types';

export interface BaziGanZhiLayerSelection {
    selectedDaYunIndex: number;
    selectedLiuNianIndex: number;
}

export interface BaziGanZhiLayerSummary {
    suiYunTianGan: string;
    suiYunDiZhi: string;
    suiYunZhengZhu: string;
    yuanJuTianGan: string;
    yuanJuDiZhi: string;
    yuanJuZhengZhu: string;
}

type LayerScope = 'suiyun' | 'yuanju' | 'cross';
type InternalScope = Exclude<LayerScope, 'cross'>;

interface LayerNode {
    scope: InternalScope;
    order: number;
    gan: string;
    zhi: string;
    pillar: string;
}

interface BranchFact {
    dedupeKey: string;
    text: string;
    scope: LayerScope;
    priority: number;
    leftOrder: number;
    rightOrder: number;
    order: number;
}

interface StemFact {
    dedupeKey: string;
    text: string;
    scope: LayerScope;
    priority: number;
    leftOrder: number;
    rightOrder: number;
    order: number;
}

const EXTENDED_ZHI_AN_HE = ['寅未', '子戌'] as const;
const HALF_HE_MAP: Record<string, string> = {
    申子: '水',
    子辰: '水',
    亥卯: '木',
    卯未: '木',
    寅午: '火',
    午戌: '火',
    巳酉: '金',
    酉丑: '金',
};
const GONG_HE_MAP: Record<string, string> = {
    寅戌: '午',
    申辰: '子',
    亥未: '卯',
    巳丑: '酉',
};

const STEM_PRIORITY: Record<'chong' | 'ke' | 'he', number> = {
    chong: 10,
    ke: 20,
    he: 30,
};

const BRANCH_PRIORITY: Record<string, number> = {
    liuhe: 10,
    anhe: 20,
    gonghe: 30,
    sanhe: 40,
    sanhui: 50,
    banhe: 60,
    xing: 70,
    chong: 80,
    po: 90,
    hai: 100,
    selfxing: 110,
};

function clampIndex(value: number, max: number): number {
    if (max < 0) {
        return 0;
    }
    return Math.min(Math.max(value, 0), max);
}

function uniqueJoin(items: string[]): string {
    if (items.length === 0) {
        return '无';
    }
    return [...new Set(items)].join('、');
}

function parseGanZhi(ganZhi: string): { gan: string; zhi: string; pillar: string } | null {
    if (!ganZhi || ganZhi.length < 2 || ganZhi === '—') {
        return null;
    }
    return {
        gan: ganZhi[0],
        zhi: ganZhi[1],
        pillar: ganZhi,
    };
}

function resolveSelectedSuiYun(
    result: BaziResult,
    selection?: Partial<BaziGanZhiLayerSelection>,
): { daYunGanZhi: string; liuNianGanZhi: string } {
    if (result.daYun.length === 0) {
        const fallbackLiuNian = result.liuNian[0]?.ganZhi ?? '—';
        return {
            daYunGanZhi: '—',
            liuNianGanZhi: fallbackLiuNian,
        };
    }

    const defaultDaYunIndex = result.currentDaYunIndex >= 0 ? result.currentDaYunIndex : 0;
    const selectedDaYunIndex = clampIndex(
        selection?.selectedDaYunIndex ?? defaultDaYunIndex,
        result.daYun.length - 1,
    );
    const selectedDaYun = result.daYun[selectedDaYunIndex];

    const liuNianList = selectedDaYun?.liuNian ?? [];
    if (liuNianList.length === 0) {
        return {
            daYunGanZhi: selectedDaYun?.ganZhi ?? '—',
            liuNianGanZhi: '—',
        };
    }

    const defaultLiuNianIndex = (() => {
        const currentIndex = liuNianList.findIndex((item) => item.isCurrent);
        return currentIndex >= 0 ? currentIndex : 0;
    })();
    const selectedLiuNianIndex = clampIndex(
        selection?.selectedLiuNianIndex ?? defaultLiuNianIndex,
        liuNianList.length - 1,
    );
    const selectedLiuNian = liuNianList[selectedLiuNianIndex];

    return {
        daYunGanZhi: selectedDaYun?.ganZhi ?? '—',
        liuNianGanZhi: selectedLiuNian?.ganZhi ?? '—',
    };
}

function collectPillarRelationsByScope(nodes: LayerNode[], scope: InternalScope): string[] {
    const scoped = nodes.filter((item) => item.scope === scope);
    const rows: string[] = [];

    scoped.forEach((item) => {
        const status = getPillarStatus(item.gan, item.zhi);
        if (status) {
            rows.push(`${item.pillar}${status}`);
        }
    });

    for (let i = 0; i < scoped.length - 1; i += 1) {
        for (let j = i + 1; j < scoped.length; j += 1) {
            const left = scoped[i];
            const right = scoped[j];
            if (left.pillar === right.pillar) {
                rows.push(`${left.pillar}伏吟`);
            }
            if (isFanyinPair(left.gan, left.zhi, right.gan, right.zhi)) {
                rows.push(`${left.pillar}↔${right.pillar}反吟`);
            }
        }
    }

    return [...new Set(rows)];
}

function resolveScopeFromIndexes(nodes: LayerNode[], indexes: number[]): LayerScope {
    const scopes = new Set(indexes.map((index) => nodes[index].scope));
    if (scopes.size === 1) {
        return scopes.values().next().value as InternalScope;
    }
    return 'cross';
}

function findBranchIndexes(nodes: LayerNode[], members: string[]): number[] | null {
    const indexes = members.map((member) => nodes.findIndex((node) => node.zhi === member));
    if (indexes.some((index) => index < 0)) {
        return null;
    }
    return indexes;
}

function hasFullTrio(nodes: LayerNode[], trioKey: string): boolean {
    return trioKey.split('').every((member) => nodes.some((node) => node.zhi === member));
}

function sortStemFacts(facts: StemFact[]): StemFact[] {
    return [...facts].sort((left, right) => {
        if (left.priority !== right.priority) {
            return left.priority - right.priority;
        }
        if (left.leftOrder !== right.leftOrder) {
            return left.leftOrder - right.leftOrder;
        }
        if (left.rightOrder !== right.rightOrder) {
            return left.rightOrder - right.rightOrder;
        }
        return left.order - right.order;
    });
}

function sortBranchFacts(facts: BranchFact[]): BranchFact[] {
    return [...facts].sort((left, right) => {
        if (left.priority !== right.priority) {
            return left.priority - right.priority;
        }
        if (left.leftOrder !== right.leftOrder) {
            return left.leftOrder - right.leftOrder;
        }
        if (left.rightOrder !== right.rightOrder) {
            return left.rightOrder - right.rightOrder;
        }
        return left.order - right.order;
    });
}

function collectStemFacts(nodes: LayerNode[]): StemFact[] {
    const facts: StemFact[] = [];
    let order = 0;

    for (let i = 0; i < nodes.length - 1; i += 1) {
        for (let j = i + 1; j < nodes.length; j += 1) {
            const left = nodes[i];
            const right = nodes[j];
            const scope = resolveScopeFromIndexes(nodes, [i, j]);
            const ganA = left.gan;
            const ganB = right.gan;

            const ganChongKey = getPairKey(ganA, ganB, GAN_CHONG);
            if (ganChongKey) {
                facts.push({
                    dedupeKey: `chong:${ganChongKey}`,
                    text: `${ganChongKey}相冲`,
                    scope,
                    priority: STEM_PRIORITY.chong,
                    leftOrder: left.order,
                    rightOrder: right.order,
                    order: order += 1,
                });
            }

            const ganKeMeta = getGanKeMeta(ganA, ganB);
            if (ganKeMeta) {
                const normalizedPair = [ganA, ganB]
                    .sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))
                    .join('');
                facts.push({
                    dedupeKey: `ke:${normalizedPair}`,
                    text: `${ganKeMeta.controller}${ganKeMeta.controlled}相克`,
                    scope,
                    priority: STEM_PRIORITY.ke,
                    leftOrder: left.order,
                    rightOrder: right.order,
                    order: order += 1,
                });
            }

            const ganHeEntry = getDictPairEntry(ganA, ganB, GAN_HE);
            if (ganHeEntry) {
                facts.push({
                    dedupeKey: `he:${ganHeEntry[0]}`,
                    text: `${ganHeEntry[0]}合化${ganHeEntry[1]}`,
                    scope,
                    priority: STEM_PRIORITY.he,
                    leftOrder: left.order,
                    rightOrder: right.order,
                    order: order += 1,
                });
            }
        }
    }

    return facts;
}

function collectBranchFacts(nodes: LayerNode[]): BranchFact[] {
    const facts: BranchFact[] = [];
    let order = 0;
    const anHeRules = [...ZHI_AN_HE, ...EXTENDED_ZHI_AN_HE];
    const halfKeys = Object.keys(HALF_HE_MAP);
    const gongKeys = Object.keys(GONG_HE_MAP);
    const halfToFullTrio: Record<string, string> = {
        申子: '申子辰',
        子辰: '申子辰',
        亥卯: '亥卯未',
        卯未: '亥卯未',
        寅午: '寅午戌',
        午戌: '寅午戌',
        巳酉: '巳酉丑',
        酉丑: '巳酉丑',
    };

    for (const [key, element] of Object.entries(ZHI_SAN_HE)) {
        const indexes = findBranchIndexes(nodes, key.split(''));
        if (!indexes) {
            continue;
        }
        const ordered = indexes.map((index) => nodes[index].order).sort((a, b) => a - b);
        facts.push({
            dedupeKey: `sanhe:${key}`,
            text: `${key}三合${element}局`,
            scope: resolveScopeFromIndexes(nodes, indexes),
            priority: BRANCH_PRIORITY.sanhe,
            leftOrder: ordered[0],
            rightOrder: ordered[ordered.length - 1],
            order: order += 1,
        });
    }

    for (const [key, element] of Object.entries(ZHI_SAN_HUI)) {
        const indexes = findBranchIndexes(nodes, key.split(''));
        if (!indexes) {
            continue;
        }
        const ordered = indexes.map((index) => nodes[index].order).sort((a, b) => a - b);
        facts.push({
            dedupeKey: `sanhui:${key}`,
            text: `${key}三会${element}局`,
            scope: resolveScopeFromIndexes(nodes, indexes),
            priority: BRANCH_PRIORITY.sanhui,
            leftOrder: ordered[0],
            rightOrder: ordered[ordered.length - 1],
            order: order += 1,
        });
    }

    for (let i = 0; i < nodes.length - 1; i += 1) {
        for (let j = i + 1; j < nodes.length; j += 1) {
            const left = nodes[i];
            const right = nodes[j];
            const scope = resolveScopeFromIndexes(nodes, [i, j]);
            const branchA = left.zhi;
            const branchB = right.zhi;

            const liuHeEntry = getDictPairEntry(branchA, branchB, ZHI_LIU_HE);
            if (liuHeEntry) {
                const [key, element] = liuHeEntry;
                facts.push({
                    dedupeKey: `liuhe:${key}`,
                    text: `${key}合化${element}`,
                    scope,
                    priority: BRANCH_PRIORITY.liuhe,
                    leftOrder: left.order,
                    rightOrder: right.order,
                    order: order += 1,
                });
            }

            const anHeKey = getPairKey(branchA, branchB, anHeRules);
            if (anHeKey) {
                facts.push({
                    dedupeKey: `anhe:${anHeKey}`,
                    text: `${anHeKey}暗合`,
                    scope,
                    priority: BRANCH_PRIORITY.anhe,
                    leftOrder: left.order,
                    rightOrder: right.order,
                    order: order += 1,
                });
            }

            const gongHeKey = getPairKey(branchA, branchB, gongKeys);
            if (gongHeKey) {
                facts.push({
                    dedupeKey: `gonghe:${gongHeKey}`,
                    text: `${gongHeKey}拱合${GONG_HE_MAP[gongHeKey]}`,
                    scope,
                    priority: BRANCH_PRIORITY.gonghe,
                    leftOrder: left.order,
                    rightOrder: right.order,
                    order: order += 1,
                });
            }

            const banHeKey = getPairKey(branchA, branchB, halfKeys);
            if (banHeKey) {
                const fullTrio = halfToFullTrio[banHeKey];
                if (!fullTrio || !hasFullTrio(nodes, fullTrio)) {
                    facts.push({
                        dedupeKey: `banhe:${banHeKey}`,
                        text: `${banHeKey}半合${HALF_HE_MAP[banHeKey]}局`,
                        scope,
                        priority: BRANCH_PRIORITY.banhe,
                        leftOrder: left.order,
                        rightOrder: right.order,
                        order: order += 1,
                    });
                }
            }

            const zhiXingMeta = getZhiXingPairMeta(branchA, branchB);
            if (zhiXingMeta && branchA !== branchB) {
                const xingKey = zhiXingMeta.name === '无礼之刑'
                    ? zhiXingMeta.key
                    : `${branchA}${branchB}`;
                facts.push({
                    dedupeKey: `xing:${zhiXingMeta.key}`,
                    text: `${xingKey}相刑`,
                    scope,
                    priority: BRANCH_PRIORITY.xing,
                    leftOrder: left.order,
                    rightOrder: right.order,
                    order: order += 1,
                });
            }

            const zhiChongKey = getPairKey(branchA, branchB, ZHI_CHONG);
            if (zhiChongKey) {
                facts.push({
                    dedupeKey: `chong:${zhiChongKey}`,
                    text: `${zhiChongKey}相冲`,
                    scope,
                    priority: BRANCH_PRIORITY.chong,
                    leftOrder: left.order,
                    rightOrder: right.order,
                    order: order += 1,
                });
            }

            const zhiPoKey = getPairKey(branchA, branchB, ZHI_PO);
            if (zhiPoKey) {
                facts.push({
                    dedupeKey: `po:${zhiPoKey}`,
                    text: `${branchA}${branchB}相破`,
                    scope,
                    priority: BRANCH_PRIORITY.po,
                    leftOrder: left.order,
                    rightOrder: right.order,
                    order: order += 1,
                });
            }

            const zhiHaiKey = getPairKey(branchA, branchB, ZHI_HAI);
            if (zhiHaiKey) {
                facts.push({
                    dedupeKey: `hai:${zhiHaiKey}`,
                    text: `${zhiHaiKey}相害`,
                    scope,
                    priority: BRANCH_PRIORITY.hai,
                    leftOrder: left.order,
                    rightOrder: right.order,
                    order: order += 1,
                });
            }
        }
    }

    ZHI_XING_SELF.forEach((branch) => {
        const indexes: number[] = [];
        nodes.forEach((node, index) => {
            if (node.zhi === branch) {
                indexes.push(index);
            }
        });
        if (indexes.length < 2) {
            return;
        }
        const ordered = indexes.map((index) => nodes[index].order).sort((a, b) => a - b);
        facts.push({
            dedupeKey: `selfxing:${branch}`,
            text: `${branch}自刑`,
            scope: resolveScopeFromIndexes(nodes, indexes),
            priority: BRANCH_PRIORITY.selfxing,
            leftOrder: ordered[0],
            rightOrder: ordered[ordered.length - 1],
            order: order += 1,
        });
    });

    return facts;
}

function pickStemLines(facts: StemFact[], scope: LayerScope): string[] {
    const filtered = sortStemFacts(facts)
        .filter((item) => (
            scope === 'suiyun'
                ? item.scope === 'suiyun' || item.scope === 'cross'
                : item.scope === 'yuanju'
        ));
    const dedupe = new Set<string>();
    const rows: string[] = [];
    filtered.forEach((item) => {
        if (dedupe.has(item.dedupeKey)) {
            return;
        }
        dedupe.add(item.dedupeKey);
        rows.push(item.text);
    });
    return rows;
}

function pickBranchLines(facts: BranchFact[], scope: LayerScope): string[] {
    const filtered = sortBranchFacts(facts)
        .filter((item) => (
            scope === 'suiyun'
                ? item.scope === 'suiyun' || item.scope === 'cross'
                : item.scope === 'yuanju'
        ));
    const dedupe = new Set<string>();
    const rows: string[] = [];
    filtered.forEach((item) => {
        if (dedupe.has(item.dedupeKey)) {
            return;
        }
        dedupe.add(item.dedupeKey);
        rows.push(item.text);
    });
    return rows;
}

export function buildBaziGanZhiLayer(
    result: BaziResult,
    selection?: Partial<BaziGanZhiLayerSelection>,
): BaziGanZhiLayerSummary {
    const selected = resolveSelectedSuiYun(result, selection);
    const liuNian = parseGanZhi(selected.liuNianGanZhi);
    const daYun = parseGanZhi(selected.daYunGanZhi);
    const siZhu = result.fourPillars
        .map((item) => parseGanZhi(item))
        .filter((item): item is NonNullable<typeof item> => Boolean(item));

    const nodes: LayerNode[] = [];
    if (liuNian) {
        nodes.push({ scope: 'suiyun', order: 0, ...liuNian });
    }
    if (daYun) {
        nodes.push({ scope: 'suiyun', order: 1, ...daYun });
    }
    siZhu.forEach((item, index) => {
        nodes.push({ scope: 'yuanju', order: 2 + index, ...item });
    });

    const stemFacts = collectStemFacts(nodes);
    const suiYunTianGanRows = pickStemLines(stemFacts, 'suiyun');
    const finalSuiYunTianGan = uniqueJoin(suiYunTianGanRows);
    const yuanJuTianGan = uniqueJoin(pickStemLines(stemFacts, 'yuanju'));
    const suiYunZhengZhu = uniqueJoin(collectPillarRelationsByScope(nodes, 'suiyun'));
    const yuanJuZhengZhu = uniqueJoin(collectPillarRelationsByScope(nodes, 'yuanju'));
    const branchFacts = collectBranchFacts(nodes);
    const suiYunDiZhi = uniqueJoin(pickBranchLines(branchFacts, 'suiyun'));
    const yuanJuDiZhi = uniqueJoin(pickBranchLines(branchFacts, 'yuanju'));

    return {
        suiYunTianGan: finalSuiYunTianGan,
        suiYunDiZhi,
        suiYunZhengZhu,
        yuanJuTianGan,
        yuanJuDiZhi,
        yuanJuZhengZhu,
    };
}
