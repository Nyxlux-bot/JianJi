/**
 * 合作、朋友、同事、亲子、手足的五维与时机规则，另补婚恋的「宫星」一维。
 * 每维从 60 起算，按两盘干支冲合、互看十神、喜忌互补加减；契合度按各关系的主辅权重合成。
 * 宫位取义：年 背景·家门，月 做事·兄弟宫·父母宫，日 本人，时 往后·子女宫·下属。
 */
import { HeavenStem, SixtyCycleYear } from 'tyme4ts';
import { CONTROLS, GAN_CHONG, GAN_HE, GENERATES, getDictPairEntry, getPairKey } from '../../../core/bazi-relation-rules';
import { ShiShenName } from '../../../core/bazi-types';
import { DIZHI_WUXING, TIANGAN_WUXING, WuXing } from '../../../core/liuyao-data';
import { classifyBranchPair } from './cross-relations';
import type { MutualView } from './pair';
import { daYunComplementScore } from './rules';
import {
    BaziMarriageYearCandidate,
    BaziMatchDimensionKey,
    BaziMatchDimensionScore,
    BaziMatchDirection,
    BaziMatchEvidence,
    BaziMatchGrade,
    BaziMatchProfile,
    BaziMatchRelation,
    getBaziMatchGrade,
} from './types';

export type PairRelation = Exclude<BaziMatchRelation, 'love'>;

const PILLAR = ['年', '月', '日', '时'];
const YEAR_SPAN = 12;

/** 「TA」夹在汉字中间留空格，标点前后不留 */
function tidy(text: string): string {
    return text
        .replace(/TA/g, ' TA ')
        .replace(/ +/g, ' ')
        .replace(/([（、，。；：]) /g, '$1')
        .replace(/ ([（）、，。；：])/g, '$1')
        .trim();
}

function dim(key: BaziMatchDimensionKey, title: string) {
    let score = 60;
    const evidence: BaziMatchEvidence[] = [];
    return {
        add(delta: number, label: string, detail: string) {
            score += delta;
            evidence.push({ label, detail: tidy(detail), effect: delta > 0 ? 'positive' : delta < 0 ? 'negative' : 'neutral' });
        },
        done(fallback: string): BaziMatchDimensionScore {
            if (evidence.length === 0) evidence.push({ label: '未见明显信号', detail: fallback, effect: 'neutral' });
            const safe = Math.max(0, Math.min(100, Math.round(score)));
            const grade = getBaziMatchGrade(safe);
            return { key, title, score: safe, grade, summary: `${title}${grade}，得分 ${safe}。`, evidence };
        },
    };
}
type Dim = ReturnType<typeof dim>;

interface Side {
    p: BaziMatchProfile;
    /** 你 / TA / 男方 / 女方 */
    who: string;
}

function star(from: BaziMatchProfile, stem: string): ShiShenName {
    return HeavenStem.fromName(from.dayStem).getTenStar(HeavenStem.fromName(stem)).getName() as ShiShenName;
}

/** 某一行在四柱里出现的位置，日干本身不算 */
function spots(p: BaziMatchProfile, element: WuXing): string[] {
    const out: string[] = [];
    p.stems.forEach((stem, i) => { if (i !== 2 && TIANGAN_WUXING[stem] === element) out.push(`${PILLAR[i]}干${stem}`); });
    p.branches.forEach((branch, i) => { if (DIZHI_WUXING[branch] === element) out.push(`${PILLAR[i]}支${branch}`); });
    return out;
}

const wealthOf = (p: BaziMatchProfile): WuXing => CONTROLS[TIANGAN_WUXING[p.dayStem]];
const officerOf = (p: BaziMatchProfile): WuXing => (Object.keys(CONTROLS) as WuXing[]).find((el) => CONTROLS[el] === TIANGAN_WUXING[p.dayStem]) as WuXing;

/* ------------------------------------------------------------------ */
/* 通用检查                                                              */
/* ------------------------------------------------------------------ */

const REL_WORD = { 合: '相合', 冲: '相冲', 刑: '相刑', 害: '相害', 破: '相破' } as const;
const REL_WEIGHT = { 合: 1, 冲: -1, 刑: -0.6, 害: -0.6, 破: -0.4 } as const;

interface Meaning { pos: string; neg: string }

/** x 的第 i 柱地支对 y 的第 j 柱地支；label 不给时按柱名取 */
function checkBranch(d: Dim, x: Side, i: number, y: Side, j: number, weight: number, meaning: Meaning, label?: string): void {
    const a = x.p.branches[i];
    const b = y.p.branches[j];
    const rel = classifyBranchPair(a, b);
    if (!rel) return;
    const where = i === j ? rel.name : `${x.who}${PILLAR[i]}支${a}、${y.who}${PILLAR[j]}支${b}${rel.name.slice(2)}`;
    const head = label ?? (i === j ? `${PILLAR[i]}支` : `${PILLAR[i]}${PILLAR[j]}`);
    d.add(Math.round(weight * REL_WEIGHT[rel.tag]), `${head}${REL_WORD[rel.tag]}`, `${where}，${rel.tone === 'pos' ? meaning.pos : meaning.neg}。`);
}

function checkStem(d: Dim, x: Side, i: number, y: Side, j: number, weight: number, meaning: Meaning): void {
    const a = x.p.stems[i];
    const b = y.p.stems[j];
    const he = Boolean(getDictPairEntry(a, b, GAN_HE));
    if (!he && !getPairKey(a, b, GAN_CHONG)) return;
    const word = he ? '相合' : '相冲';
    d.add(he ? weight : -weight, `${PILLAR[i]}干${word}`, `${x.who}${PILLAR[i]}干${a}、${y.who}${PILLAR[j]}干${b}${word}，${he ? meaning.pos : meaning.neg}。`);
}

type Tie = 'he' | 'chong' | 'peer' | 'rob' | 'meGivesTa' | 'taGivesMe' | 'meCtrlTa' | 'taCtrlMe';
type TieTable = Partial<Record<Tie, [number, string]>>;
const TIE_LABEL: Record<Tie, string> = {
    he: '日干相合',
    chong: '日干相冲',
    peer: '日干比和',
    rob: '日干比和',
    meGivesTa: '日干相生',
    taGivesMe: '日干相生',
    meCtrlTa: '日干相克',
    taCtrlMe: '日干相克',
};

function dayTie(me: BaziMatchProfile, ta: BaziMatchProfile): Tie {
    if (getDictPairEntry(me.dayStem, ta.dayStem, GAN_HE)) return 'he';
    if (getPairKey(me.dayStem, ta.dayStem, GAN_CHONG)) return 'chong';
    const a = TIANGAN_WUXING[me.dayStem];
    const b = TIANGAN_WUXING[ta.dayStem];
    if (a === b) return star(me, ta.dayStem) === '比肩' ? 'peer' : 'rob';
    if (GENERATES[a] === b) return 'meGivesTa';
    if (GENERATES[b] === a) return 'taGivesMe';
    return CONTROLS[a] === b ? 'meCtrlTa' : 'taCtrlMe';
}

function checkDayStem(d: Dim, c: PairContext, table: TieTable): void {
    const tie = dayTie(c.me, c.ta);
    const entry = table[tie];
    if (entry) d.add(entry[0], TIE_LABEL[tie], `${c.mutual.link}，${entry[1]}。`);
}

/** 与结果页五行卡同口径：各取首要所需之行，对方计数多于自己即算补上 */
function checkComplement(d: Dim, me: BaziMatchProfile, ta: BaziMatchProfile): void {
    const meNeed = me.neededElements[0];
    const taNeed = ta.neededElements[0];
    const taGives = Boolean(meNeed) && ta.elementCounts[meNeed] > me.elementCounts[meNeed];
    const meGives = Boolean(taNeed) && me.elementCounts[taNeed] > ta.elementCounts[taNeed];
    if (taGives && meGives) {
        d.add(16, '喜忌互补', `你缺${meNeed}，TA ${meNeed} ${ta.elementCounts[meNeed]}；TA 需${taNeed}，你${taNeed} ${me.elementCounts[taNeed]}，两相补益。`);
    } else if (meNeed && meNeed === taNeed) {
        const more = taGives ? 'TA' : meGives ? '你' : '';
        const n = taGives ? ta.elementCounts[meNeed] : me.elementCounts[meNeed];
        d.add(more ? 2 : -6, '同缺一行', more
            ? `两人都缺${meNeed}，${more}${meNeed} ${n} 稍多，能补对方一些。`
            : `两人都缺${meNeed}，短处叠在一起。`);
    } else if (taGives) {
        d.add(8, '喜忌互补', `你缺${meNeed}，TA ${meNeed} ${ta.elementCounts[meNeed]} 能补你；TA 所需的${taNeed}你也不多。`);
    } else if (meGives) {
        d.add(8, '喜忌互补', `TA 需${taNeed}，你${taNeed} ${me.elementCounts[taNeed]} 能补 TA；你所需的${meNeed}TA 也不多。`);
    } else {
        d.add(0, '喜忌互补', '两人五行互补信号不明显。');
    }
}

function checkDaYunSync(d: Dim, me: BaziMatchProfile, ta: BaziMatchProfile): void {
    const a = me.futureDaYun[0];
    const b = ta.futureDaYun[0];
    if (!a || !b) return;
    const diff = Math.abs(a.startYear - b.startYear);
    if (diff <= 2) d.add(6, '换运节点', `两人大运交接相差 ${diff} 年，阶段大致同步。`);
    else if (diff >= 7) d.add(-6, '换运节点', `两人大运交接相差 ${diff} 年，阶段容易错位。`);
}

function checkRhythm(d: Dim, c: PairContext): void {
    const both = c.years.filter((item) => item.both).sort((a, b) => a.year - b.year);
    const list = both.slice(0, 2).map((item) => `${item.year} ${item.ganZhi}`).join('、');
    if (both.length >= 3) d.add(10, '同喜之年', `${list}等 ${both.length} 年，两人都走喜用。`);
    else if (both.length > 0) d.add(4, '同喜之年', `近 ${YEAR_SPAN} 年只有${list}两人都走喜用。`);
    else d.add(-4, '同喜之年', `近 ${YEAR_SPAN} 年两人少有同走喜用的年份，好年份各自错开。`);
    checkDaYunSync(d, c.me, c.ta);
}

/** 十神互看：按 TA 之于你的十神取断语 */
function checkMutualStar(d: Dim, c: PairContext, table: Partial<Record<ShiShenName, [number, string]>>): void {
    const entry = table[c.mutual.taToMe as ShiShenName];
    if (entry) d.add(entry[0], '十神互看', `TA 是你的${c.mutual.taToMe}，你是 TA 的${c.mutual.meToTa}：${entry[1]}。`);
}

/* ------------------------------------------------------------------ */
/* 顺年：两人同走喜用的流年                                               */
/* ------------------------------------------------------------------ */

interface PairYear { year: number; ganZhi: string; score: number; reasons: string[]; /** 两人都走喜用 */ both: boolean }

function buildPairYears(me: BaziMatchProfile, ta: BaziMatchProfile, palace: number, clash: string, fromYear: number): PairYear[] {
    const sides: Side[] = [{ p: ta, who: 'TA' }, { p: me, who: '你' }];
    const order = [...new Set([palace, 2, 0, 1, 3])];
    const out: PairYear[] = [];
    for (let year = fromYear; year < fromYear + YEAR_SPAN; year += 1) {
        const ganZhi = SixtyCycleYear.fromYear(year).getSixtyCycle().getName();
        const branch = ganZhi.charAt(1);
        const elements = [...new Set([TIANGAN_WUXING[ganZhi.charAt(0)], DIZHI_WUXING[branch]])];
        const meHit = elements.filter((el) => me.neededElements.includes(el));
        const taHit = elements.filter((el) => ta.neededElements.includes(el));
        if (meHit.length === 0 && taHit.length === 0) continue;
        const both = meHit.length > 0 && taHit.length > 0;
        const shared = meHit.filter((el) => taHit.includes(el));
        let score = (meHit.length + taHit.length) * 5 + (both ? 10 : 0);
        const head = `${ganZhi}${elements.join('')}年`;
        const reasons = [shared.length > 0
            ? `${head}，两人都喜${shared.join('、')}`
            : both
                ? `${head}，${meHit.join('、')}补你、${taHit.join('、')}补TA`
                : `${head}，补${meHit.length > 0 ? `你所需的${meHit.join('、')}` : `TA所需的${taHit.join('、')}`}`];
        const tie = sides.flatMap((side) => order.map((i) => ({ side, i, rel: classifyBranchPair(branch, side.p.branches[i]) })))
            .find((item) => item.rel?.tone === 'pos');
        if (tie?.rel) {
            score += 4;
            reasons.push(`${branch}与${tie.side.who}${PILLAR[tie.i]}支${tie.side.p.branches[tie.i]}${tie.rel.name.slice(2)}`);
        }
        sides.forEach((side) => {
            if (classifyBranchPair(branch, side.p.dayBranch)?.tag !== '冲') return;
            score -= 6;
            reasons.push(`${branch}冲${side.who}日支${side.p.dayBranch}，${clash}`);
        });
        out.push({ year, ganZhi, score, both, reasons: reasons.map(tidy) });
    }
    return out.sort((a, b) => b.score - a.score || a.year - b.year);
}

/* ------------------------------------------------------------------ */
/* 五种关系                                                              */
/* ------------------------------------------------------------------ */

interface PairContext {
    me: BaziMatchProfile;
    ta: BaziMatchProfile;
    mutual: MutualView;
    direction?: BaziMatchDirection;
    years: PairYear[];
}

const NEUTRAL = '两盘在这一项上未见明显信号，此项取中。';

function scoreBiz(c: PairContext): BaziMatchDimensionScore[] {
    const ME: Side = { p: c.me, who: '你' };
    const TA: Side = { p: c.ta, who: 'TA' };

    const complement = dim('complement', '互补');
    checkComplement(complement, c.me, c.ta);
    checkDayStem(complement, c, {
        he: [10, '心思往一处使'], chong: [-10, '意见常对冲'], peer: [4, '想法接近'], rob: [-2, '想法接近，也爱较劲'],
        taGivesMe: [8, 'TA 肯扶你'], meGivesTa: [6, '你肯扶 TA'], meCtrlTa: [-6, '你容易压着 TA 拿主意'], taCtrlMe: [-6, 'TA 容易压着你拿主意'],
    });

    const division = dim('division', '分工');
    checkMutualStar(division, c, {
        正印: [12, 'TA 出主意，你出成果'], 偏印: [12, 'TA 出主意，你出成果'],
        食神: [12, '你出主意，TA 出成果'], 伤官: [12, '你出主意，TA 出成果'],
        正财: [8, '你拍板，TA 管落地'], 偏财: [4, '你说了算，TA 跟着跑，分工要讲明'],
        正官: [8, 'TA 拍板，你管落地'], 七杀: [-2, 'TA 压着你做，久了易憋屈'],
        比肩: [0, '两人路数相同，分工要先说定'], 劫财: [-8, '两人同做一摊事，容易争功'],
    });
    checkStem(division, ME, 1, TA, 1, 8, { pos: '做事路数相投', neg: '做事路数相左' });
    checkBranch(division, ME, 1, TA, 1, 6, { pos: '做事方法合得来', neg: '做事方法常起冲突' });

    const wealth = dim('wealth', '财路');
    [ME, TA].forEach((side) => {
        const el = wealthOf(side.p);
        const at = spots(side.p, el);
        const label = side.who === '你' ? '你的财星' : 'TA 的财星';
        if (at.length >= 2) wealth.add(6, label, `财星${el}见于${at.join('、')}，有根。`);
        else if (at.length === 1) wealth.add(-2, label, `财星${el}只见${at[0]}一处，偏弱。`);
        else wealth.add(-6, label, `财星${el}在四柱里不显。`);
    });
    if (c.ta.dominantElements[0] === wealthOf(c.me)) wealth.add(6, '财从 TA 来', `TA 旺${wealthOf(c.me)}，正是你的财。`);
    if (c.me.dominantElements[0] === wealthOf(c.ta)) wealth.add(4, '财从你来', `你旺${wealthOf(c.ta)}，正是 TA 的财。`);
    if (c.mutual.taToMe === '劫财') wealth.add(-8, '比劫分利', 'TA 是你的劫财，合伙分利要事先说清。');
    else if ((c.me.starCounts.劫财 ?? 0) + (c.ta.starCounts.劫财 ?? 0) >= 4) wealth.add(-6, '比劫分利', '两人命里劫财都重，钱上要分清。');

    const trust = dim('trust', '信任');
    checkBranch(trust, ME, 2, TA, 2, 14, { pos: '本人对本人，彼此信得过', neg: '本人对本人，立场常对着来' });
    checkBranch(trust, ME, 1, TA, 3, 6, { pos: '做事与收尾接得上', neg: '做事与收尾相左' });
    checkBranch(trust, ME, 3, TA, 1, 6, { pos: '收尾与做事接得上', neg: '收尾与做事相左' });
    checkBranch(trust, ME, 0, TA, 0, 6, { pos: '外部关系相合，能缓一缓冲', neg: '外部背景不合，各有各的圈子' });

    const rhythm = dim('rhythm', '节奏');
    checkRhythm(rhythm, c);

    return [complement.done(NEUTRAL), division.done(NEUTRAL), wealth.done(NEUTRAL), trust.done(NEUTRAL), rhythm.done(NEUTRAL)];
}

function scoreFriend(c: PairContext): BaziMatchDimensionScore[] {
    const ME: Side = { p: c.me, who: '你' };
    const TA: Side = { p: c.ta, who: 'TA' };

    const rapport = dim('rapport', '投缘');
    checkDayStem(rapport, c, {
        he: [12, '一见如故'], chong: [-10, '脾气相冲'], peer: [6, '想法相近、聊得来'], rob: [4, '聊得来，也爱抬杠'],
        taGivesMe: [8, 'TA 肯照应你'], meGivesTa: [6, '你常照应 TA'], meCtrlTa: [-6, '说话容易顶着'], taCtrlMe: [-6, '说话容易顶着'],
    });
    checkBranch(rapport, ME, 0, TA, 0, 8, { pos: '玩得到一起', neg: '脾气不太对付' }, '生肖');

    const temper = dim('temper', '性情');
    const strengths = [c.me.strength, c.ta.strength];
    if (strengths.every((item) => item === 'strong')) temper.add(-6, '两强相遇', '两人日主都旺，谁也不让谁。');
    else if (strengths.every((item) => item === 'weak')) temper.add(2, '两弱相扶', '两人日主都偏弱，彼此体谅。');
    else if (strengths.includes('strong') && strengths.includes('weak')) {
        temper.add(4, '一强一弱', c.me.strength === 'strong' ? '你日主旺、TA 日主弱，你拿主意、TA 随和。' : 'TA 日主旺、你日主弱，TA 拿主意、你随和。');
    }
    checkStem(temper, ME, 1, TA, 1, 8, { pos: '性情相投', neg: '性子相左' });
    checkBranch(temper, ME, 1, TA, 1, 6, { pos: '做事合拍', neg: '做事节奏不同' });

    const complement = dim('complement', '互补');
    checkComplement(complement, c.me, c.ta);
    if (c.me.dominantElements[0] === c.ta.dominantElements[0]) complement.add(4, '同旺一行', `两人都旺${c.me.dominantElements[0]}，喜好相近。`);

    const contact = dim('contact', '往来');
    checkMutualStar(contact, c, {
        比肩: [8, '并肩的朋友'], 劫财: [2, '玩得到一起，钱上要分清'],
        正印: [6, 'TA 照顾你多些'], 偏印: [6, 'TA 照顾你多些'],
        食神: [4, '你照顾 TA 多些'], 伤官: [4, '你照顾 TA 多些'],
        正财: [2, '你说了算，TA 随你'], 偏财: [2, '你说了算，TA 随你'],
        正官: [-2, 'TA 爱管着你'], 七杀: [-6, 'TA 说话冲你，相处要有分寸'],
    });
    checkBranch(contact, ME, 2, TA, 2, 12, { pos: '相处舒服', neg: '处久了易起摩擦' });

    const lasting = dim('lasting', '长久');
    checkBranch(lasting, ME, 3, TA, 3, 8, { pos: '往后走得长', neg: '往后易各奔东西' });
    const flow = daYunComplementScore(c.me, c.ta) + daYunComplementScore(c.ta, c.me);
    if (flow >= 8) lasting.add(10, '未来大运', '两人未来大运多走对方所需，越处越近。');
    else if (flow >= 4) lasting.add(5, '未来大运', '两人未来大运对彼此有些补益。');
    else if (flow <= 0) lasting.add(-6, '未来大运', '两人未来大运少有交集，要靠主动联系。');
    checkDaYunSync(lasting, c.me, c.ta);

    return [rapport.done(NEUTRAL), temper.done(NEUTRAL), complement.done(NEUTRAL), contact.done(NEUTRAL), lasting.done(NEUTRAL)];
}

const HIERARCHY: Record<'superior' | 'peer' | 'subordinate', Partial<Record<ShiShenName, [number, string]>>> = {
    superior: {
        食神: [12, 'TA 肯把你交代的事做出来'], 伤官: [-6, 'TA 有本事，也爱顶撞你'],
        正财: [10, 'TA 听安排、靠得住'], 偏财: [6, 'TA 灵活，用得上'],
        正官: [-8, 'TA 反过来管着你'], 七杀: [-12, 'TA 不服你，常给你压力'],
        正印: [4, 'TA 像军师，给你出主意'], 偏印: [2, 'TA 主意多，未必照办'],
        比肩: [-4, 'TA 与你平起平坐，不太服管'], 劫财: [-8, 'TA 容易与你争功'],
    },
    peer: {
        比肩: [8, '平起平坐，能并肩'], 劫财: [-6, '容易争功'],
        食神: [4, '你常帮 TA'], 伤官: [0, '你帮 TA，也爱挑 TA 的刺'],
        正印: [6, 'TA 常帮你'], 偏印: [4, 'TA 给你出主意'],
        正财: [2, '你常拿主意'], 偏财: [2, '你常拿主意'],
        正官: [-2, 'TA 爱管你'], 七杀: [-8, 'TA 处处压你一头'],
    },
    subordinate: {
        正官: [12, 'TA 立得住规矩，带得动你'], 七杀: [-2, 'TA 给你压力大，也逼你上进'],
        正印: [12, 'TA 护着你、提携你'], 偏印: [6, 'TA 常给你指点'],
        食神: [0, 'TA 随和，管得不多'], 伤官: [-8, 'TA 爱挑你的刺'],
        正财: [-6, 'TA 反倒要你拿主意'], 偏财: [-4, 'TA 管得松散'],
        比肩: [-2, 'TA 像同辈，不太像上级'], 劫财: [-8, 'TA 容易与你争功'],
    },
};

function scoreWork(c: PairContext): BaziMatchDimensionScore[] {
    const ME: Side = { p: c.me, who: '你' };
    const TA: Side = { p: c.ta, who: 'TA' };
    const direction = c.direction === 'superior' || c.direction === 'subordinate' ? c.direction : 'peer';

    const cooperation = dim('cooperation', '配合');
    checkDayStem(cooperation, c, {
        he: [10, '做事容易想到一处'], chong: [-10, '意见常对冲'], peer: [4, '路数相近'], rob: [-2, '路数相近，也爱较劲'],
        taGivesMe: [8, 'TA 肯带你'], meGivesTa: [6, '你肯带 TA'], meCtrlTa: [-4, '你压得住 TA，也容易压过头'], taCtrlMe: [-4, 'TA 压得住你，也容易压过头'],
    });
    checkBranch(cooperation, ME, 2, TA, 2, 12, { pos: '本人相处合拍', neg: '本人相处常起摩擦' });

    const hierarchy = dim('hierarchy', '上下');
    checkMutualStar(hierarchy, c, HIERARCHY[direction]);

    const task = dim('task', '做事');
    checkStem(task, ME, 1, TA, 1, 8, { pos: '做事路数相投', neg: '做事路数相左' });
    checkBranch(task, ME, 1, TA, 1, 10, { pos: '能干到一处', neg: '干法不同' }, '事业宫');
    if (direction === 'superior') checkBranch(task, ME, 3, TA, 2, 6, { pos: 'TA 落在你的下属宫，用得顺手', neg: 'TA 与你的下属宫相犯，带起来费劲' }, '下属宫');
    if (direction === 'subordinate') checkBranch(task, TA, 3, ME, 2, 6, { pos: '你落在 TA 的下属宫，跟得顺', neg: '你与 TA 的下属宫相犯，磨合费劲' }, '下属宫');

    const complement = dim('complement', '互补');
    checkComplement(complement, c.me, c.ta);

    const rhythm = dim('rhythm', '节奏');
    checkRhythm(rhythm, c);

    return [cooperation.done(NEUTRAL), hierarchy.done(NEUTRAL), task.done(NEUTRAL), complement.done(NEUTRAL), rhythm.done(NEUTRAL)];
}

function scoreKin(c: PairContext): BaziMatchDimensionScore[] {
    const ME: Side = { p: c.me, who: '你' };
    const TA: Side = { p: c.ta, who: 'TA' };
    const [P, C] = c.direction === 'child' ? [TA, ME] : [ME, TA];
    const own = (side: Side) => (side.who === '你' ? '你的' : 'TA 的');

    const bond = dim('bond', '亲缘');
    const childStar = star(P.p, C.p.dayStem);
    const childStars: ShiShenName[] = P.p.gender === 1 ? ['正官', '七杀'] : ['食神', '伤官'];
    if (childStars.includes(childStar)) bond.add(10, '子女星', `${own(C)}日干${C.p.dayStem}落在${own(P)}子女星（${childStar}）上，亲缘深。`);
    const parentStar = star(C.p, P.p.dayStem);
    const parentStars: ShiShenName[] = P.p.gender === 1 ? ['偏财', '正财'] : ['正印', '偏印'];
    if (parentStars.includes(parentStar)) bond.add(10, '父母星', `${own(P)}日干${P.p.dayStem}正是${own(C)}${P.p.gender === 1 ? '父星' : '母星'}（${parentStar}）。`);
    if (!childStars.includes(childStar) && !parentStars.includes(parentStar)) bond.add(-4, '亲子星', '两人日干不落在亲子星上，亲缘多靠后天相处。');

    const palace = dim('palace', '宫位');
    checkBranch(palace, P, 3, C, 2, 10, { pos: '子女宫与孩子本人相合，缘分落得住', neg: '子女宫与孩子本人相犯，想法常不同' }, '子女宫');
    checkBranch(palace, C, 1, P, 2, 10, { pos: '父母宫与父母本人相合，亲近', neg: '父母宫与父母本人相犯，亲而有隔' }, '父母宫');

    const discipline = dim('discipline', '管教');
    const pEl = TIANGAN_WUXING[P.p.dayStem];
    const cEl = TIANGAN_WUXING[C.p.dayStem];
    const flow = `${own(P)}${P.p.dayStem}${pEl}`;
    const back = `${own(C)}${C.p.dayStem}${cEl}`;
    if (getDictPairEntry(P.p.dayStem, C.p.dayStem, GAN_HE)) discipline.add(8, '日干相合', `${flow}与${back}相合，亲而不疏。`);
    else if (GENERATES[pEl] === cEl) discipline.add(12, '父母生扶', `${flow}生${back}，管教以护为主。`);
    else if (GENERATES[cEl] === pEl) discipline.add(6, '子女反哺', `${back}生${flow}，孩子懂事、贴心。`);
    else if (CONTROLS[pEl] === cEl) {
        if (parentStar === '七杀') discipline.add(-8, '父母管束', `${flow}克${back}，管得太严，容易起逆反。`);
        else discipline.add(-2, '父母管束', `${flow}克${back}，管得住，也要留余地。`);
    } else if (CONTROLS[cEl] === pEl) discipline.add(-10, '子女逆克', `${back}克${flow}，孩子难管，常顶撞。`);
    else if (parentStar === '比肩') discipline.add(0, '日干比和', '两人日干同气，像朋友，管教靠讲道理。');
    else discipline.add(-4, '日干比和', '两人日干同气不同性，像同辈，管教容易较劲。');
    if ((C.p.starCounts.伤官 ?? 0) >= 3) discipline.add(-4, '子女伤官', `${C.who}命里伤官重，有主见，不爱被管。`);

    const getAlong = dim('getAlong', '相处');
    checkBranch(getAlong, ME, 2, TA, 2, 12, { pos: '日常相处和顺', neg: '日常相处易起冲突' });
    checkBranch(getAlong, ME, 0, TA, 0, 6, { pos: '脾气合得来', neg: '脾气不太对付' }, '生肖');

    const complement = dim('complement', '互补');
    checkComplement(complement, c.me, c.ta);

    return [bond.done(NEUTRAL), complement.done(NEUTRAL), palace.done(NEUTRAL), discipline.done(NEUTRAL), getAlong.done(NEUTRAL)];
}

function scoreSib(c: PairContext): BaziMatchDimensionScore[] {
    const ME: Side = { p: c.me, who: '你' };
    const TA: Side = { p: c.ta, who: 'TA' };

    const bond = dim('bond', '亲缘');
    if (c.mutual.taToMe === '比肩' || c.mutual.taToMe === '劫财') bond.add(12, '兄弟星', `TA 是你的${c.mutual.taToMe}，正落在兄弟姐妹星上。`);
    else bond.add(-4, '兄弟星', `TA 是你的${c.mutual.taToMe}，不落在兄弟姐妹星上，手足缘多看后天。`);
    checkBranch(bond, ME, 0, TA, 0, 6, { pos: '家门气场相合', neg: '家门气场不合，各有心思' });

    const palace = dim('palace', '宫位');
    checkBranch(palace, ME, 1, TA, 1, 12, { pos: '彼此挂念', neg: '聚少离多，或易起争执' }, '兄弟宫');
    checkStem(palace, ME, 1, TA, 1, 6, { pos: '想法相通', neg: '想法相左' });

    const complement = dim('complement', '互补');
    checkComplement(complement, c.me, c.ta);

    const help = dim('help', '帮衬');
    checkDayStem(help, c, {
        he: [8, '彼此亲近'], chong: [-8, '一碰就吵'], peer: [4, '互相照应'], rob: [-6, '容易为钱财、家产计较'],
        taGivesMe: [10, 'TA 肯帮你'], meGivesTa: [6, '你常帮 TA'], meCtrlTa: [-6, '你压着 TA'], taCtrlMe: [-6, 'TA 压着你'],
    });

    const getAlong = dim('getAlong', '相处');
    checkBranch(getAlong, ME, 2, TA, 2, 12, { pos: '相处和顺', neg: '相处易起冲突' });
    checkBranch(getAlong, ME, 3, TA, 3, 6, { pos: '往后来往不断', neg: '往后易疏远' });

    return [bond.done(NEUTRAL), palace.done(NEUTRAL), complement.done(NEUTRAL), help.done(NEUTRAL), getAlong.done(NEUTRAL)];
}

/* ------------------------------------------------------------------ */
/* 汇总                                                                  */
/* ------------------------------------------------------------------ */

interface PairSpec {
    score: (c: PairContext) => BaziMatchDimensionScore[];
    weights: Partial<Record<BaziMatchDimensionKey, number>>;
    /** 详断页开头的口径说明 */
    basis: string;
    /** 优、良、中、差各一句 */
    verdicts: [string, string, string, string];
    timing: { title: string; meta: string; palace: number; clash: string };
}

const PAIR_SPECS: Record<PairRelation, PairSpec> = {
    biz: {
        score: scoreBiz,
        weights: { complement: 0.25, division: 0.25, trust: 0.25, wealth: 0.125, rhythm: 0.125 },
        basis: '契合度以互补、分工、信任三项为主，财路、节奏为辅。',
        verdicts: ['合作很顺', '可以合作', '能合作，先立规矩', '合作阻力大'],
        timing: { title: '顺年', meta: '两盘流年喜用 · 仅作参考', palace: 2, clash: '宜先把分工写清' },
    },
    friend: {
        score: scoreFriend,
        weights: { rapport: 0.25, contact: 0.25, lasting: 0.25, temper: 0.125, complement: 0.125 },
        basis: '契合度以投缘、往来、长久三项为主，性情、互补为辅。',
        verdicts: ['很投缘', '处得来', '有合有冲', '难走近'],
        timing: { title: '走得近的年份', meta: '两盘流年喜用 · 仅作参考', palace: 2, clash: '这年容易闹别扭' },
    },
    work: {
        score: scoreWork,
        weights: { cooperation: 0.25, hierarchy: 0.25, task: 0.25, complement: 0.125, rhythm: 0.125 },
        basis: '契合度以配合、上下、做事三项为主，互补、节奏为辅。',
        verdicts: ['共事很顺', '配合得来', '配合要磨', '共事吃力'],
        timing: { title: '共事顺年', meta: '两盘流年喜用 · 仅作参考', palace: 1, clash: '这年配合要多沟通' },
    },
    kin: {
        score: scoreKin,
        weights: { bond: 0.25, palace: 0.2, discipline: 0.2, getAlong: 0.2, complement: 0.15 },
        basis: '契合度以亲缘为主，宫位、管教、相处次之，互补为辅。',
        verdicts: ['亲缘深厚', '亲子相得', '亲而有隔', '亲子多摩擦'],
        timing: { title: '关系顺年', meta: '两盘流年喜用 · 仅作参考', palace: 2, clash: '这年要多体谅' },
    },
    sib: {
        score: scoreSib,
        weights: { bond: 0.25, palace: 0.25, getAlong: 0.2, help: 0.15, complement: 0.15 },
        basis: '契合度以亲缘、宫位为主，相处、帮衬、互补为辅。',
        verdicts: ['手足情深', '手足和睦', '手足有隔', '手足多争'],
        timing: { title: '走得近的年份', meta: '两盘流年喜用 · 仅作参考', palace: 1, clash: '这年容易起争执' },
    },
};

export function getPairSpec(relation: BaziMatchRelation): PairSpec | null {
    return relation === 'love' ? null : PAIR_SPECS[relation];
}

const GRADE_ORDER: BaziMatchGrade[] = ['优', '良', '中', '差'];

/** 一句定调，再点最该留意的一条：主项优先，先找低分维里的忌，没有再取高分维里的吉 */
function headline(spec: PairSpec, grade: BaziMatchGrade, dimensions: BaziMatchDimensionScore[]): string {
    const verdict = spec.verdicts[GRADE_ORDER.indexOf(grade)];
    const isMain = (d: BaziMatchDimensionScore) => (spec.weights[d.key] ?? 0) >= 0.2;
    const ascending = [...dimensions].sort((a, b) => Number(isMain(b)) - Number(isMain(a)) || a.score - b.score);
    const descending = [...dimensions].sort((a, b) => Number(isMain(b)) - Number(isMain(a)) || b.score - a.score);
    const pick = ascending.map((d) => ({ d, e: d.evidence.find((item) => item.effect === 'negative') })).find((item) => item.e)
        ?? descending.map((d) => ({ d, e: d.evidence.find((item) => item.effect === 'positive') })).find((item) => item.e);
    return pick?.e ? `${verdict}。${pick.d.title}：${pick.e.detail}` : `${verdict}。`;
}

export interface PairScore {
    dimensions: BaziMatchDimensionScore[];
    totalScore: number;
    grade: BaziMatchGrade;
    summary: string;
    years: BaziMarriageYearCandidate[];
}

export function scorePairRelation(
    relation: PairRelation,
    input: { me: BaziMatchProfile; ta: BaziMatchProfile; mutual: MutualView; direction?: BaziMatchDirection },
    fromYear: number,
): PairScore {
    const spec = PAIR_SPECS[relation];
    const years = buildPairYears(input.me, input.ta, spec.timing.palace, spec.timing.clash, fromYear);
    const dimensions = spec.score({ ...input, years });
    const totalScore = Math.round(dimensions.reduce((sum, item) => sum + item.score * (spec.weights[item.key] ?? 0), 0));
    const grade = getBaziMatchGrade(totalScore);
    return {
        dimensions,
        totalScore,
        grade,
        summary: headline(spec, grade, dimensions),
        years: years.slice(0, 2).map((item, index) => ({
            year: item.year,
            ganZhi: item.ganZhi,
            kind: index === 0 ? 'trigger' : 'recommendation',
            score: item.score,
            reasons: item.reasons,
        })),
    };
}

/* ------------------------------------------------------------------ */
/* 婚恋宫星：夫妻宫与夫妻星，只在展示时补算，不进契合度                      */
/* ------------------------------------------------------------------ */

export function scoreLovePalaceStar(male: BaziMatchProfile, female: BaziMatchProfile): BaziMatchDimensionScore {
    const d = dim('palaceStar', '宫星');
    const M: Side = { p: male, who: '男方' };
    const F: Side = { p: female, who: '女方' };
    checkBranch(d, M, 2, F, 2, 12, { pos: '两人落得住', neg: '日常容易起摩擦' }, '夫妻宫');

    const wifeEl = wealthOf(male);
    const wifeAt = spots(male, wifeEl);
    if (wifeAt.length >= 2) d.add(6, '男命妻星', `妻星${wifeEl}见于${wifeAt.join('、')}，有根。`);
    else if (wifeAt.length === 1) d.add(0, '男命妻星', `妻星${wifeEl}只见${wifeAt[0]}一处。`);
    else d.add(-8, '男命妻星', `妻星${wifeEl}在四柱里不显。`);

    const husbandEl = officerOf(female);
    const husbandAt = spots(female, husbandEl);
    if (husbandAt.length >= 2) d.add(6, '女命夫星', `夫星${husbandEl}见于${husbandAt.join('、')}，有根。`);
    else if (husbandAt.length === 1) d.add(0, '女命夫星', `夫星${husbandEl}只见${husbandAt[0]}一处。`);
    else d.add(-8, '女命夫星', `夫星${husbandEl}在四柱里不显。`);

    const wifeStar = star(male, female.dayStem);
    if (wifeStar === '正财' || wifeStar === '偏财') d.add(8, '星落对方', `女方日干${female.dayStem}正是男方妻星（${wifeStar}）。`);
    const husbandStar = star(female, male.dayStem);
    if (husbandStar === '正官' || husbandStar === '七杀') d.add(8, '星落对方', `男方日干${male.dayStem}正是女方夫星（${husbandStar}）。`);
    return d.done('夫妻宫与夫妻星未见明显信号，此项取中。');
}
