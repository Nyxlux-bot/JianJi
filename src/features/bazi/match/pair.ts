/**
 * 任意两人合盘的通用部分：关系类型、「我 / TA」落槽、两盘之间的干支关系、互看十神。
 * 婚恋接原有合婚规则；其余关系的五维与时机见 relations.ts。
 */
import { HeavenStem } from 'tyme4ts';
import { GAN_CHONG, GAN_HE, GENERATES, getDictPairEntry, getGanKeMeta, getPairKey } from '../../../core/bazi-relation-rules';
import { BaziResult } from '../../../core/bazi-types';
import { TIANGAN_WUXING } from '../../../core/liuyao-data';
import { classifyBranchPair } from './cross-relations';
import { scoreLovePalaceStar, scorePairRelation } from './relations';
import { buildBaziMatchProfile, calculateBaziMatch } from './rules';
import {
    BaziCompatibilityResult,
    BaziMatchDimensionScore,
    BaziMatchDirection,
    BaziMatchEvidence,
    BaziMatchProfile,
    BaziMatchRelation,
    getBaziMatchGrade,
} from './types';

export interface MatchRelationMeta {
    key: BaziMatchRelation;
    name: string;
    hint: string;
    /** 选中后写明这类关系看什么 */
    look: string;
    directions: Array<{ key: BaziMatchDirection; label: string }>;
}

export const MATCH_RELATIONS: MatchRelationMeta[] = [
    { key: 'love', name: '婚恋', hint: '夫妻 · 恋人', look: '夫妻宫与配偶星、喜忌互补、日柱冲合、婚期', directions: [] },
    { key: 'biz', name: '合作', hint: '合伙 · 生意', look: '喜忌互补、财星与比劫、十神互看、日柱冲合、岁运同步', directions: [] },
    { key: 'friend', name: '朋友', hint: '知己 · 玩伴', look: '日干生合、性情偏向、生肖、喜忌互补', directions: [] },
    {
        key: 'work',
        name: '同事',
        hint: '上下级 · 搭档',
        look: '官印与食伤、事业宫（月柱）、日干生克',
        directions: [{ key: 'superior', label: '我是上级' }, { key: 'peer', label: '平级' }, { key: 'subordinate', label: '我是下属' }],
    },
    {
        key: 'kin',
        name: '亲子',
        hint: '父母 · 子女',
        look: '印星与子女星、年柱与时柱、喜忌互补',
        directions: [{ key: 'parent', label: '我是父母' }, { key: 'child', label: '我是子女' }],
    },
    { key: 'sib', name: '手足', hint: '兄弟 · 姐妹', look: '比劫、兄弟宫（月柱）、喜忌互补', directions: [] },
];

export function getMatchRelation(result: Pick<BaziCompatibilityResult, 'relation'>): MatchRelationMeta {
    return MATCH_RELATIONS.find((item) => item.key === (result.relation ?? 'love')) ?? MATCH_RELATIONS[0];
}

export function getMatchDirectionLabel(result: Pick<BaziCompatibilityResult, 'relation' | 'direction'>): string {
    return getMatchRelation(result).directions.find((item) => item.key === result.direction)?.label ?? '';
}

export interface MatchSides {
    me: BaziMatchProfile;
    ta: BaziMatchProfile;
}

export function getMatchSides(result: BaziCompatibilityResult): MatchSides {
    return (result.self ?? 'male') === 'male'
        ? { me: result.maleProfile, ta: result.femaleProfile }
        : { me: result.femaleProfile, ta: result.maleProfile };
}

/* ------------------------------------------------------------------ */
/* 两盘之间的干支关系                                                     */
/* ------------------------------------------------------------------ */

export interface PairLink {
    key: string;
    layer: 'stem' | 'branch';
    /** 我的第几柱、TA 的第几柱，0–3 为年月日时 */
    me: number;
    ta: number;
    tag: string;
    name: string;
    tone: 'pos' | 'neg';
    /** 生、克的受方 */
    toward?: 'me' | 'ta';
    /** 你日支 · TA 月支 */
    where: string;
}

const PILLAR = ['年', '月', '日', '时'];

interface PairSide {
    stems: readonly string[];
    branches: readonly string[];
}

export function buildPairLinks(me: PairSide, ta: PairSide): PairLink[] {
    const links: PairLink[] = [];
    const where = (i: number, j: number, part: string) => `你${PILLAR[i]}${part} · TA ${PILLAR[j]}${part}`;

    me.stems.forEach((a, i) => ta.stems.forEach((b, j) => {
        const base = { key: `s${i}${j}`, layer: 'stem' as const, me: i, ta: j, where: where(i, j, '干') };
        if (getDictPairEntry(a, b, GAN_HE)) {
            links.push({ ...base, tag: '合', name: `${a}${b}合`, tone: 'pos' });
            return;
        }
        if (getPairKey(a, b, GAN_CHONG)) {
            links.push({ ...base, tag: '冲', name: `${a}${b}冲`, tone: 'neg' });
            return;
        }
        // 天干两两生克太多，只看两人日干之间
        if (i !== 2 || j !== 2) return;
        const ke = getGanKeMeta(a, b);
        if (ke) {
            links.push({ ...base, tag: '克', name: `${ke.controller}克${ke.controlled}`, tone: 'neg', toward: ke.controlled === a ? 'me' : 'ta' });
            return;
        }
        if (GENERATES[TIANGAN_WUXING[a]] === TIANGAN_WUXING[b]) {
            links.push({ ...base, tag: '生', name: `${a}生${b}`, tone: 'pos', toward: 'ta' });
        } else if (GENERATES[TIANGAN_WUXING[b]] === TIANGAN_WUXING[a]) {
            links.push({ ...base, tag: '生', name: `${b}生${a}`, tone: 'pos', toward: 'me' });
        }
    }));

    me.branches.forEach((a, i) => ta.branches.forEach((b, j) => {
        const relation = classifyBranchPair(a, b);
        if (!relation) return;
        links.push({
            key: `b${i}${j}`,
            layer: 'branch',
            me: i,
            ta: j,
            tag: relation.name.includes('半合') ? '半合' : relation.tag,
            name: relation.name,
            tone: relation.tone,
            where: where(i, j, '支'),
        });
    }));
    return links;
}

const COUNT_ORDER = ['合', '生', '冲', '克', '刑', '害', '破'];

/** 合 5 · 冲 2……；半合并入合 */
export function countPairLinks(links: PairLink[]): Array<{ tag: string; tone: 'pos' | 'neg'; count: number }> {
    return COUNT_ORDER.map((tag) => {
        const hit = links.filter((link) => (link.tag === '半合' ? '合' : link.tag) === tag);
        return { tag, tone: hit[0]?.tone ?? 'pos', count: hit.length };
    }).filter((item) => item.count > 0);
}

/* ------------------------------------------------------------------ */
/* 互看十神                                                              */
/* ------------------------------------------------------------------ */

const STAR_GIST: Record<string, string> = {
    比肩: '与{o}并肩的同辈',
    劫财: '与{o}同进退、也会分利的人',
    食神: '替{o}把想法做出来的人',
    伤官: '替{o}出头、也爱挑{o}刺的人',
    正财: '{o}管得住、靠得住的人',
    偏财: '给{o}带来机会的人',
    正官: '管着{o}、给{o}立规矩的人',
    七杀: '给{o}压力、逼{o}上进的人',
    正印: '护着{o}、给{o}底气的人',
    偏印: '给{o}出主意、另开一路的人',
};

export interface MutualView {
    /** TA 之于你 */
    taToMe: string;
    taToMeGist: string;
    /** 你之于 TA */
    meToTa: string;
    meToTaGist: string;
    /** 两人日干五行之间：TA 的甲木生你丙火 */
    link: string;
}

export function buildMutualView(me: BaziMatchProfile, ta: BaziMatchProfile): MutualView {
    const meStem = HeavenStem.fromName(me.dayStem);
    const taStem = HeavenStem.fromName(ta.dayStem);
    const taToMe = meStem.getTenStar(taStem).getName();
    const meToTa = taStem.getTenStar(meStem).getName();
    const meEl = TIANGAN_WUXING[me.dayStem];
    const taEl = TIANGAN_WUXING[ta.dayStem];
    const ke = getGanKeMeta(me.dayStem, ta.dayStem);
    const he = getDictPairEntry(me.dayStem, ta.dayStem, GAN_HE);
    let link = `两人日干同为${meEl}`;
    if (he) link = `你的${me.dayStem}${meEl}与 TA ${ta.dayStem}${taEl}相合化${he[1]}`;
    else if (GENERATES[taEl] === meEl) link = `TA 的${ta.dayStem}${taEl}生你${me.dayStem}${meEl}`;
    else if (GENERATES[meEl] === taEl) link = `你的${me.dayStem}${meEl}生 TA ${ta.dayStem}${taEl}`;
    else if (ke) link = ke.controller === me.dayStem
        ? `你的${me.dayStem}${meEl}克 TA ${ta.dayStem}${taEl}`
        : `TA 的${ta.dayStem}${taEl}克你${me.dayStem}${meEl}`;
    // 「TA」夹在汉字中间要留空格，句首和标点前不留
    const gist = (star: string, other: string) => (STAR_GIST[star] ?? '').replace(/\{o\}/g, other === 'TA' ? ' TA ' : other).replace(/ ([、，。])/g, '$1').trim();
    return { taToMe, taToMeGist: gist(taToMe, '你'), meToTa, meToTaGist: gist(meToTa, 'TA'), link };
}

/* ------------------------------------------------------------------ */
/* 算一盘                                                                */
/* ------------------------------------------------------------------ */

export function calculatePairMatch(
    me: BaziResult,
    ta: BaziResult,
    relation: BaziMatchRelation,
    direction?: BaziMatchDirection,
    referenceDate: Date = new Date(),
): BaziCompatibilityResult {
    if (relation === 'love') {
        // 婚恋沿用合婚规则：一男一女时男方落 male 槽
        const meIsFemale = me.gender === 0 && ta.gender === 1;
        const base = meIsFemale ? calculateBaziMatch(ta, me, referenceDate) : calculateBaziMatch(me, ta, referenceDate);
        return { ...base, relation, self: meIsFemale ? 'female' : 'male' };
    }
    // 其余关系不分男女，「我」固定在 male 槽
    const meProfile = buildBaziMatchProfile(me, referenceDate);
    const taProfile = buildBaziMatchProfile(ta, referenceDate);
    const mutual = buildMutualView(meProfile, taProfile);
    const scored = scorePairRelation(relation, { me: meProfile, ta: taProfile, mutual, direction }, referenceDate.getFullYear());
    const nowIso = new Date().toISOString();
    return {
        id: `bazi-match-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: nowIso,
        calculatedAt: nowIso,
        male: me,
        female: ta,
        maleProfile: meProfile,
        femaleProfile: taProfile,
        dimensions: scored.dimensions,
        totalScore: scored.totalScore,
        grade: scored.grade,
        summary: scored.summary,
        marriageYears: scored.years,
        relation,
        direction,
        self: 'male',
    };
}

/* ------------------------------------------------------------------ */
/* 婚恋五维：旺夫、帮妻合为扶持，不再按男女分；另补宫星                    */
/* ------------------------------------------------------------------ */

function mergeEvidence(...lists: BaziMatchEvidence[][]): BaziMatchEvidence[] {
    const seen = new Set<string>();
    return lists.flat().filter((item) => {
        const key = `${item.label}|${item.detail}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

export function getDisplayDimensions(result: BaziCompatibilityResult): BaziMatchDimensionScore[] {
    if ((result.relation ?? 'love') !== 'love') return result.dimensions;
    const find = (key: string, legacy?: string) => result.dimensions.find((item) => item.key === key)
        ?? (legacy ? result.dimensions.find((item) => (item.key as string) === legacy) : undefined);
    const husband = find('supportHusband', 'mutualSupport');
    const wife = find('supportWife', 'mutualSupport');
    let support: BaziMatchDimensionScore | undefined;
    if (husband && wife && husband !== wife) {
        const score = Math.round((husband.score + wife.score) / 2);
        support = {
            key: 'supportHusband',
            title: '扶持',
            score,
            grade: getBaziMatchGrade(score),
            summary: `${husband.summary}${wife.summary}`,
            evidence: mergeEvidence(husband.evidence, wife.evidence),
        };
    } else if (husband ?? wife) {
        support = { ...(husband ?? wife) as BaziMatchDimensionScore, title: '扶持' };
    }
    const titled = (item: BaziMatchDimensionScore | undefined, title: string) => (item ? { ...item, title } : undefined);
    return [
        titled(find('harmony'), '和睦'),
        support,
        titled(find('offspring'), '子女'),
        titled(find('longevity', 'lifecycle'), '同寿'),
        result.dimensions.length ? scoreLovePalaceStar(result.maleProfile, result.femaleProfile) : undefined,
    ].filter((item): item is BaziMatchDimensionScore => Boolean(item));
}
