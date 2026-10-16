/**
 * 梅花易数体用生克与卦气规则。
 * 原文依据《梅花易数》（维基文库本）卷二「体用总诀」「衰旺论」、卷一「卦气旺」「卦气衰」。
 * 这里只给程序可判定的规则提示，不替代完整断卦。
 */
import { getLiuQin, WuXing } from '../../core/liuyao-data';
import { buildWuXingBandFromMonthBranch } from '../../core/renyuan-duty';
import { getBianYong, getTiYong, getTrigram } from './engine';
import type { MeihuaResult } from './types';

export type MeihuaRelation = '比和' | '生体' | '克体' | '体生' | '体克';
export type MeihuaTone = 'good' | 'mixed' | 'bad';
export type MeihuaSeasonState = '旺' | '相' | '休' | '囚' | '死';

const SOURCE_TIYONG = '《梅花易数》卷二「体用总诀」';
const SOURCE_SEASON = '《梅花易数》卷二「衰旺论」';

export const RELATION_RULES: Record<MeihuaRelation, { tone: MeihuaTone; quote: string }> = {
    比和: { tone: 'good', quote: '体用比和，则百事顺遂。' },
    生体: { tone: 'good', quote: '用生体，有进益之喜。' },
    体克: { tone: 'good', quote: '体克用，诸事吉。' },
    克体: { tone: 'bad', quote: '用克体，诸事凶。' },
    体生: { tone: 'bad', quote: '体生用，有耗失之患。' },
};

/** 其他经卦对体卦的关系。 */
export function relationToTi(tiWuxing: WuXing, otherWuxing: WuXing): MeihuaRelation {
    const liuQin = getLiuQin(tiWuxing, otherWuxing);
    if (liuQin === '兄弟') return '比和';
    if (liuQin === '父母') return '生体';
    if (liuQin === '官鬼') return '克体';
    if (liuQin === '子孙') return '体生';
    return '体克';
}

export interface MeihuaTrigramRelation {
    /** 体、用、互上、互下、变用 */
    role: string;
    index: number;
    name: string;
    wuxing: WuXing;
    relation: MeihuaRelation | '体';
    tone: MeihuaTone;
}

export interface MeihuaSeasonRow {
    wuxing: WuXing;
    state: MeihuaSeasonState;
    /** 本卦体用、互卦、变卦中属此五行的经卦 */
    holders: string[];
}

export interface MeihuaJudgement {
    key: 'tiyong' | 'season' | 'process' | 'outcome';
    label: string;
    text: string;
    tone: MeihuaTone;
    tag: string;
    source: string;
}

export interface MeihuaAnalysis {
    ti: MeihuaTrigramRelation;
    yong: MeihuaTrigramRelation;
    huUpper: MeihuaTrigramRelation;
    huLower: MeihuaTrigramRelation;
    bianYong: MeihuaTrigramRelation;
    monthZhi: string;
    monthWuxing: WuXing;
    season: MeihuaSeasonRow[];
    tiState: MeihuaSeasonState;
    yongState: MeihuaSeasonState;
    judgements: MeihuaJudgement[];
}

const TONE_TAG: Record<MeihuaTone, string> = { good: '吉', mixed: '平', bad: '凶' };

function describe(role: string, index: number, tiWuxing?: WuXing): MeihuaTrigramRelation {
    const trigram = getTrigram(index);
    if (!tiWuxing) {
        return { role, index, name: trigram.name, wuxing: trigram.wuxing, relation: '体', tone: 'good' };
    }
    const relation = relationToTi(tiWuxing, trigram.wuxing);
    return { role, index, name: trigram.name, wuxing: trigram.wuxing, relation, tone: RELATION_RULES[relation].tone };
}

function mergeTones(tones: MeihuaTone[]): MeihuaTone {
    if (tones.every((tone) => tone === 'good')) return 'good';
    if (tones.every((tone) => tone === 'bad')) return 'bad';
    return 'mixed';
}

function isStrong(state: MeihuaSeasonState): boolean {
    return state === '旺' || state === '相';
}

const PROCESS_PHRASE: Record<MeihuaRelation, string> = {
    比和: '与体比和，得同道相助',
    生体: '生体，中途得助',
    体克: '受体所克，中途可制',
    克体: '克体，中途有阻',
    体生: '泄体，中途有耗',
};

const OUTCOME_PHRASE: Record<MeihuaRelation, string> = {
    比和: '与体比和，终局顺遂',
    生体: '生体，终得助益',
    体克: '受体所克，终可成事',
    克体: '克体，终有阻害',
    体生: '泄体，终有耗损',
};

function tiyongText(ti: MeihuaTrigramRelation, yong: MeihuaTrigramRelation): string {
    const tiLabel = `体${ti.name}${ti.wuxing}`;
    const yongLabel = `用${yong.name}${yong.wuxing}`;
    switch (yong.relation) {
        case '比和': return `${tiLabel}、${yongLabel}比和，事易顺成。`;
        case '生体': return `${yongLabel}生${tiLabel}，有进益之喜。`;
        case '体克': return `${tiLabel}克${yongLabel}，我能制事，事可成。`;
        case '克体': return `${yongLabel}克${tiLabel}，事多阻碍，于己不利。`;
        default: return `${tiLabel}生${yongLabel}，有耗失之患，费力难得。`;
    }
}

function seasonJudgement(analysis: Pick<MeihuaAnalysis, 'ti' | 'yong' | 'tiState' | 'yongState' | 'monthZhi' | 'monthWuxing'>): MeihuaJudgement {
    const { ti, yong, tiState, yongState, monthZhi, monthWuxing } = analysis;
    const head = `${monthZhi}月${monthWuxing}当令，体${ti.wuxing}${tiState}、用${yong.wuxing}${yongState}`;
    let text: string;
    let tone: MeihuaTone;
    if (isStrong(tiState)) {
        tone = 'good';
        text = yong.relation === '克体' ? `${head}，体旺足以当克，凶中可解。` : `${head}，体气盛，主动在我。`;
    } else if (yong.relation === '克体' && isStrong(yongState)) {
        tone = 'bad';
        text = `${head}，体衰而用旺克体，凶势更重。`;
    } else if (tiState === '休') {
        tone = 'mixed';
        text = `${head}，体气平平，成事需借外力。`;
    } else {
        tone = RELATION_RULES[yong.relation as MeihuaRelation].tone === 'good' ? 'mixed' : 'bad';
        text = `${head}，体弱${isStrong(yongState) ? '用强' : ''}，成事费力，宜缓图。`;
    }
    return { key: 'season', label: '旺衰', text, tone, tag: tone === 'mixed' ? '需缓' : TONE_TAG[tone], source: `${SOURCE_SEASON}：凡占卜，体卦宜盛旺。` };
}

export function analyzeMeihua(result: MeihuaResult): MeihuaAnalysis {
    const { ti: tiIndex, yong: yongIndex } = getTiYong(result);
    const ti = describe('体', tiIndex);
    const yong = describe('用', yongIndex, ti.wuxing);
    const huUpper = describe('互上', result.hu.upper, ti.wuxing);
    const huLower = describe('互下', result.hu.lower, ti.wuxing);
    const bianYong = describe('变用', getBianYong(result), ti.wuxing);

    const monthZhi = result.lunarInfo.monthGanZhi[1];
    const band = buildWuXingBandFromMonthBranch(monthZhi);
    const monthWuxing = band.find((item) => item.status === '旺')?.element as WuXing;
    const stateOf = (wuxing: WuXing) => band.find((item) => item.element === wuxing)?.status as MeihuaSeasonState;
    const holders: Record<string, string[]> = {};
    for (const item of [ti, yong, huUpper, huLower, bianYong]) {
        const label = `${item.role}${item.name}`;
        (holders[item.wuxing] ||= []).includes(label) || holders[item.wuxing].push(label);
    }
    const season: MeihuaSeasonRow[] = (['旺', '相', '休', '囚', '死'] as MeihuaSeasonState[]).map((state) => {
        const wuxing = band.find((item) => item.status === state)?.element as WuXing;
        return { wuxing, state, holders: holders[wuxing] || [] };
    });
    const tiState = stateOf(ti.wuxing);
    const yongState = stateOf(yong.wuxing);

    const huParts = huUpper.index === huLower.index ? [huUpper] : [huUpper, huLower];
    const processTone = mergeTones(huParts.map((item) => item.tone));
    const yongTone = RELATION_RULES[yong.relation as MeihuaRelation].tone;
    const turn = yongTone !== bianYong.tone
        ? (yongTone === 'good' ? '，先吉后凶' : '，先凶后吉')
        : '';

    const judgements: MeihuaJudgement[] = [
        {
            key: 'tiyong', label: '体用', text: tiyongText(ti, yong), tone: yongTone, tag: TONE_TAG[yongTone],
            source: `${SOURCE_TIYONG}：${RELATION_RULES[yong.relation as MeihuaRelation].quote}`,
        },
        seasonJudgement({ ti, yong, tiState, yongState, monthZhi, monthWuxing }),
        {
            key: 'process', label: '过程',
            text: `互卦${huParts.map((item) => `${item.name}${item.wuxing}${PROCESS_PHRASE[item.relation as MeihuaRelation]}`).join('；')}。`,
            tone: processTone, tag: processTone === 'mixed' ? '参半' : TONE_TAG[processTone],
            source: `${SOURCE_TIYONG}：互乃中间之应。`,
        },
        {
            key: 'outcome', label: '结果',
            text: `用卦变${bianYong.name}${bianYong.wuxing}，${OUTCOME_PHRASE[bianYong.relation as MeihuaRelation]}${turn}。`,
            tone: bianYong.tone, tag: TONE_TAG[bianYong.tone],
            source: `${SOURCE_TIYONG}：变乃末后之期；用吉变凶者，先吉后凶；用凶变吉者，先凶后吉。`,
        },
    ];

    return { ti, yong, huUpper, huLower, bianYong, monthZhi, monthWuxing, season, tiState, yongState, judgements };
}
