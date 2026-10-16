/**
 * 六爻卦盘的程序可判定状态：各爻与月建、日辰、旬空的关系，动爻化象，用神提要与时令表。
 * 只列事实性的生克冲合，不替代断卦。
 */
import type { PanResult, YaoDetail } from './liuyao-calc';
import { DIZHI_WUXING, getLiuQin, type LiuQin, type WuXing } from './liuyao-data';
import { buildWuXingBandFromMonthBranch } from './renyuan-duty';

export type LiuyaoTone = 'good' | 'bad' | 'neutral';
export type LiuyaoSeasonState = '旺' | '相' | '休' | '囚' | '死';

export interface LiuyaoMark {
    /** 卦盘角标，单字 */
    short: string;
    /** 完整说法，如「月破」 */
    label: string;
    tone: LiuyaoTone;
}

const CHONG: Record<string, string> = { 子: '午', 午: '子', 丑: '未', 未: '丑', 寅: '申', 申: '寅', 卯: '酉', 酉: '卯', 辰: '戌', 戌: '辰', 巳: '亥', 亥: '巳' };
const HE: Record<string, string> = { 子: '丑', 丑: '子', 寅: '亥', 亥: '寅', 卯: '戌', 戌: '卯', 辰: '酉', 酉: '辰', 巳: '申', 申: '巳', 午: '未', 未: '午' };
/** 进神：同五行顺行一位 */
const JIN: Record<string, string> = { 寅: '卯', 巳: '午', 申: '酉', 亥: '子', 丑: '辰', 辰: '未', 未: '戌', 戌: '丑' };
/** 五行入墓 */
const MU: Record<WuXing, string> = { 火: '戌', 水: '辰', 土: '辰', 木: '未', 金: '丑' };
const LIUQIN_ORDER: LiuQin[] = ['父母', '兄弟', '子孙', '妻财', '官鬼'];

function context(result: PanResult) {
    return {
        monthZhi: result.monthGanZhi[1],
        dayZhi: result.dayGanZhi[1],
        xunKong: result.xunKong ?? [],
        band: buildWuXingBandFromMonthBranch(result.monthGanZhi[1]),
    };
}

/** 某地支对月建、日辰、旬空的关系（适用本卦爻与伏神）。 */
function marksOf(zhi: string, ctx: ReturnType<typeof context>): LiuyaoMark[] {
    const marks: LiuyaoMark[] = [];
    if (zhi === ctx.monthZhi) marks.push({ short: '月', label: '临月建', tone: 'good' });
    if (zhi === ctx.dayZhi) marks.push({ short: '日', label: '临日辰', tone: 'good' });
    if (CHONG[zhi] === ctx.monthZhi) marks.push({ short: '破', label: '月破', tone: 'bad' });
    if (CHONG[zhi] === ctx.dayZhi) marks.push({ short: '冲', label: '日冲', tone: 'bad' });
    if (ctx.xunKong.includes(zhi)) marks.push({ short: '空', label: '旬空', tone: 'bad' });
    if (HE[zhi] === ctx.monthZhi) marks.push({ short: '合', label: '月合', tone: 'good' });
    if (HE[zhi] === ctx.dayZhi) marks.push({ short: '合', label: '日合', tone: 'good' });
    if (MU[DIZHI_WUXING[zhi]] === ctx.monthZhi) marks.push({ short: '墓', label: '入月墓', tone: 'bad' });
    return marks;
}

/** 动爻变出：进退、回头生克、化空化破。 */
function transformMarks(yao: YaoDetail, ctx: ReturnType<typeof context>): LiuyaoMark[] {
    if (!yao.isMoving || !yao.bianZhi || !yao.bianWuXing) return [];
    const marks: LiuyaoMark[] = [];
    if (JIN[yao.zhi] === yao.bianZhi) marks.push({ short: '进', label: '化进神', tone: 'good' });
    if (JIN[yao.bianZhi] === yao.zhi) marks.push({ short: '退', label: '化退神', tone: 'bad' });
    const back = getLiuQin(yao.wuxing, yao.bianWuXing);
    if (back === '父母') marks.push({ short: '生', label: '回头生', tone: 'good' });
    if (back === '官鬼') marks.push({ short: '克', label: '回头克', tone: 'bad' });
    if (ctx.xunKong.includes(yao.bianZhi)) marks.push({ short: '空', label: '化空', tone: 'bad' });
    if (CHONG[yao.bianZhi] === ctx.monthZhi) marks.push({ short: '破', label: '化破', tone: 'bad' });
    return marks;
}

export interface LiuyaoYaoStatus {
    position: number;
    marks: LiuyaoMark[];
    transform: LiuyaoMark[];
    fuShenMarks: LiuyaoMark[];
    state: LiuyaoSeasonState;
}

export interface LiuyaoSeasonRow {
    wuxing: WuXing;
    state: LiuyaoSeasonState;
    /** 本卦属此五行的地支，伏神加「伏」字 */
    holders: string[];
}

export interface LiuyaoStatus {
    yao: LiuyaoYaoStatus[];
    season: LiuyaoSeasonRow[];
    summary: Record<LiuQin, string>;
}

function describeYao(yao: YaoDetail, status: LiuyaoYaoStatus): string {
    const notes = [...status.marks, ...status.transform].map((mark) => mark.label);
    const moving = yao.isMoving && yao.bianZhi ? `发动化${yao.bianZhi}${yao.bianWuXing}` : '';
    return `${yao.positionName}爻${yao.zhi}${yao.wuxing}${status.state}${moving ? `，${moving}` : ''}${notes.length ? `，${notes.join('、')}` : ''}`;
}

export function analyzeLiuyaoStatus(result: PanResult): LiuyaoStatus {
    const ctx = context(result);
    const stateOf = (wuxing: WuXing) => (ctx.band.find((item) => item.element === wuxing)?.status ?? '休') as LiuyaoSeasonState;
    const yao = result.benGuaYao.map((item) => ({
        position: item.position,
        marks: marksOf(item.zhi, ctx),
        transform: transformMarks(item, ctx),
        fuShenMarks: item.fuShen ? marksOf(item.fuShen.zhi, ctx) : [],
        state: stateOf(item.wuxing),
    }));

    const season: LiuyaoSeasonRow[] = (['旺', '相', '休', '囚', '死'] as LiuyaoSeasonState[]).map((state) => {
        const wuxing = ctx.band.find((item) => item.status === state)?.element as WuXing;
        const holders = result.benGuaYao.filter((item) => item.wuxing === wuxing).map((item) => item.zhi);
        result.benGuaYao.forEach((item) => {
            if (item.fuShen?.wuxing === wuxing) holders.push(`伏${item.fuShen.zhi}`);
        });
        return { wuxing, state, holders: Array.from(new Set(holders)) };
    });

    const summary = {} as Record<LiuQin, string>;
    LIUQIN_ORDER.forEach((liuQin) => {
        const present = result.benGuaYao.filter((item) => item.liuQin === liuQin);
        if (present.length > 0) {
            const parts = present.map((item) => describeYao(item, yao[item.position - 1]));
            const shi = present.some((item) => item.isShi) ? '（持世）' : present.some((item) => item.isYing) ? '（持应）' : '';
            summary[liuQin] = `${liuQin}${present.length > 1 ? `${['', '', '两', '三', '四', '五', '六'][present.length]}现` : ''}${shi}：${parts.join('；')}。`;
            return;
        }
        const host = result.benGuaYao.find((item) => item.fuShen?.liuQin === liuQin);
        if (host?.fuShen) {
            const hidden = host.fuShen;
            const relation = getLiuQin(hidden.wuxing, host.wuxing);
            const flying = relation === '父母' ? '飞神生伏' : relation === '官鬼' ? '飞神克伏' : relation === '兄弟' ? '飞伏比和' : relation === '子孙' ? '伏神生飞，泄气' : '伏神克飞';
            const notes = yao[host.position - 1].fuShenMarks.map((mark) => mark.label);
            summary[liuQin] = `${liuQin}不上卦，${hidden.zhi}${hidden.wuxing}伏于${host.positionName}爻${host.zhi}${host.wuxing}之下，${stateOf(hidden.wuxing)}，${flying}${notes.length ? `，${notes.join('、')}` : ''}。`;
            return;
        }
        summary[liuQin] = `${liuQin}不上卦，亦无伏神可取。`;
    });

    return { yao, season, summary };
}
