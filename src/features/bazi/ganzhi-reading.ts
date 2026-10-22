/**
 * 干支详情四个页签的读法：把关系图、流通链接、宫位和十神整理成「一句结论 + 逐条事实」。
 * 只读视图模型里已经算好的关系，不另立规则。
 */
import { BaziGanZhiDiagram, BaziGanZhiDiagramRelation } from '../../core/bazi-ganzhi-diagram';
import { getGanKeMeta } from '../../core/bazi-relation-rules';
import { BaziGender, BaziPillarKey, ShiShenName } from '../../core/bazi-types';
import {
    FAMILY_RELATIONS,
    GanZhiFlowLink,
    GanZhiRelationMode,
    GanZhiVisualPillar,
    GanZhiVisualViewModel,
    SOCIAL_RELATIONS,
    getGanZhiRelationLabels,
} from './ganzhi-visual';
import { WuXingElement, resolveWuXingElement } from './wuxing';

export type ReadingTone = 'pos' | 'neg' | 'mid';

const COUNT_WORD = ['零', '一', '两', '三', '四', '五', '六', '七', '八'];

function toneOf(tone: BaziGanZhiDiagramRelation['tone']): ReadingTone {
    if (tone === 'supportive') return 'pos';
    if (tone === 'obstructive') return 'neg';
    return 'mid';
}

const KIND_TAG: Partial<Record<BaziGanZhiDiagramRelation['kind'], string>> = {
    stem_clash: '冲',
    stem_control: '克',
    stem_five_combination: '合',
    branch_six_combination: '合',
    branch_three_combination: '合',
    branch_half_combination: '合',
    branch_three_meeting: '会',
    branch_hidden_combination: '暗合',
    branch_hidden_sandwich: '拱',
    branch_sandwich: '拱',
    branch_punishment: '刑',
    branch_self_punishment: '刑',
    branch_clash: '冲',
    branch_break: '破',
    branch_harm: '害',
    pillar_repeating: '伏吟',
    pillar_opposing: '反吟',
    pillar_hidden_carry: '暗带',
};

function tagOf(relation: BaziGanZhiDiagramRelation): string {
    return KIND_TAG[relation.kind] ?? relation.text;
}

/* ------------------------------------------------------------------ */
/* 干支：罗盘上的关系                                                     */
/* ------------------------------------------------------------------ */

export interface DialRelation {
    key: string;
    tone: ReadingTone;
    /** 清单里的短标签：冲、合、刑、伏吟 */
    tag: string;
    /** 罗盘上的标签：冲、三合水局、自刑 */
    label: string;
    /** 清单里的全名：子午相冲、申子辰三合水局 */
    name: string;
    positions: string;
    nodeOrders: number[];
    /** 天干、地支，还是整柱（伏吟、反吟） */
    layer: BaziGanZhiDiagramRelation['layer'];
    /** 天干相克：箭头指向被克一方 */
    arrowToOrder?: number;
}

export function buildDialRelations(diagram: BaziGanZhiDiagram, ring: 'zhi' | 'gan'): DialRelation[] {
    const source = ring === 'gan'
        ? diagram.stemRelations
        : [...diagram.branchRelations, ...diagram.pillarRelations.filter((item) => item.leftOrder !== item.rightOrder)];
    return source.map((relation) => {
        let arrowToOrder: number | undefined;
        if (relation.kind === 'stem_control' && relation.nodeOrders.length === 2) {
            const [a, b] = relation.nodeOrders.map((order) => diagram.nodes[order]);
            const meta = a && b ? getGanKeMeta(a.gan, b.gan) : null;
            if (meta) arrowToOrder = meta.controlled === a.gan ? a.order : b.order;
        }
        return {
            key: relation.key,
            tone: toneOf(relation.tone),
            tag: tagOf(relation),
            label: relation.text,
            name: relation.summaryText,
            positions: relation.nodeOrders.map((order) => diagram.nodes[order]?.label ?? '').join(' · '),
            nodeOrders: relation.nodeOrders,
            layer: relation.layer,
            arrowToOrder,
        };
    });
}

/* ------------------------------------------------------------------ */
/* 流通                                                                  */
/* ------------------------------------------------------------------ */

export interface FlowGlyph {
    char: string;
    element: WuXingElement | null;
    /** 年干、日支…… */
    position: string;
    shiShen: string;
}

export interface FlowChain {
    key: string;
    row: 'stem' | 'branch';
    glyphs: FlowGlyph[];
    links: Array<{ label: string; dir: 'forward' | 'backward' | 'both' }>;
    result: { text: string; element: WuXingElement | null } | null;
    caption: string;
}

export interface FlowBlock {
    key: string;
    tag: string;
    first: FlowGlyph;
    second: FlowGlyph;
    where: string;
    note: string;
}

export interface FlowReading {
    headline: string;
    lede: string;
    pass: number;
    block: number;
    chains: FlowChain[];
    blocks: FlowBlock[];
}

function glyphOf(pillar: GanZhiVisualPillar, row: 'stem' | 'branch'): FlowGlyph {
    const stem = row === 'stem';
    return {
        char: stem ? pillar.stem : pillar.branch,
        element: (stem ? pillar.stemElement : pillar.branchElement) as WuXingElement | null,
        position: `${pillar.label.charAt(0)}${stem ? '干' : '支'}`,
        shiShen: stem ? pillar.stemShiShen : pillar.branchShiShen,
    };
}

function glyphName(glyph: FlowGlyph, named: Set<string>): string {
    const base = `${glyph.char}${glyph.element ?? ''}`;
    if (named.has(glyph.position)) return base;
    named.add(glyph.position);
    if (glyph.shiShen.startsWith('元')) return `日主${base}`;
    return glyph.shiShen && glyph.shiShen !== '—' ? `${base}（${glyph.shiShen}）` : base;
}

const BLOCK_VERB: Record<string, string> = { 冲: '冲断', 克: '受克', 刑: '刑阻', 害: '相害', 破: '相破' };

export function buildFlowReading(viewModel: GanZhiVisualViewModel): FlowReading {
    const { pillars, flowLinks, diagram } = viewModel;
    const chains: FlowChain[] = [];

    (['stem', 'branch'] as const).forEach((row) => {
        const links = flowLinks
            .filter((link) => link.axis === 'horizontal' && link.row === row)
            .sort((left, right) => left.fromIndex - right.fromIndex);
        const runs: GanZhiFlowLink[][] = [];
        let run: GanZhiFlowLink[] = [];
        links.forEach((link) => {
            const broken = link.tone !== 'supportive' || (run.length > 0 && run[run.length - 1].toIndex !== link.fromIndex);
            if (broken && run.length) {
                runs.push(run);
                run = [];
            }
            if (link.tone === 'supportive') run.push(link);
        });
        if (run.length) runs.push(run);

        runs.forEach((items) => {
            const indices = [items[0].fromIndex, ...items.map((link) => link.toIndex)];
            const sheng = items.filter((link) => link.label === '生');
            // 相生全部由右往左时，倒过来读，让箭头都朝前
            const reversed = sheng.length > 0 && sheng.every((link) => link.direction === 'right_to_left');
            const ordered = reversed ? [...indices].reverse() : indices;
            const orderedLinks = reversed ? [...items].reverse() : items;
            const glyphs = ordered.map((index) => glyphOf(pillars[index], row));
            const linkView = orderedLinks.map((link) => {
                if (link.label !== '生') return { label: link.label, dir: 'both' as const };
                const forward = (link.direction === 'left_to_right') !== reversed;
                return { label: link.label, dir: forward ? 'forward' as const : 'backward' as const };
            });

            let result: FlowChain['result'] = null;
            if (row === 'branch') {
                const members = new Set(indices.map((index) => index + 2));
                const formed = diagram.branchRelations
                    .filter((relation) => ['branch_three_combination', 'branch_three_meeting', 'branch_half_combination'].includes(relation.kind))
                    .filter((relation) => relation.nodeOrders.every((order) => members.has(order)))
                    .sort((left, right) => right.nodeOrders.length - left.nodeOrders.length)[0];
                if (formed) result = { text: formed.text, element: resolveWuXingElement(formed.text) };
            }

            const named = new Set<string>();
            const parts = linkView.map((link, index) => {
                const a = glyphs[index];
                const b = glyphs[index + 1];
                if (link.label === '生') {
                    return link.dir === 'forward'
                        ? `${glyphName(a, named)}生${glyphName(b, named)}`
                        : `${glyphName(b, named)}生${glyphName(a, named)}`;
                }
                if (link.label === '助') return `${a.char}${b.char}同气相助`;
                return `${a.char}${b.char}相${link.label}`;
            });
            const caption = `${parts.join('，')}${result ? `，成${result.text}` : ''}。`;
            chains.push({ key: `${row}-${indices.join('')}`, row, glyphs, links: linkView, result, caption });
        });
    });
    chains.sort((left, right) => right.links.length - left.links.length || (left.row === 'stem' ? -1 : 1));

    const blocks: FlowBlock[] = flowLinks.filter((link) => link.tone === 'obstructive').map((link) => {
        if (link.axis === 'horizontal') {
            const row = link.row === 'branch' ? 'branch' : 'stem';
            const a = glyphOf(pillars[link.fromIndex], row);
            const b = glyphOf(pillars[link.toIndex], row);
            const swap = link.label === '克' && link.direction === 'right_to_left';
            return {
                key: link.key,
                tag: link.label,
                first: swap ? b : a,
                second: swap ? a : b,
                where: `${a.position} · ${b.position}`,
                note: row === 'stem' ? '天干相邻' : '地支相邻',
            };
        }
        const pillar = pillars[link.fromIndex];
        const stem = glyphOf(pillar, 'stem');
        const branch = glyphOf(pillar, 'branch');
        const stemActs = link.direction === 'left_to_right';
        return {
            key: link.key,
            tag: link.label,
            first: stemActs ? stem : branch,
            second: stemActs ? branch : stem,
            where: `${pillar.label}柱内`,
            note: pillar.pillarStatus ?? '',
        };
    });

    const horizontalBlocks = blocks.filter((item) => item.note.endsWith('相邻'));
    const verticalBlocks = blocks.length - horizontalBlocks.length;
    const lead = horizontalBlocks.find((item) => item.note === '天干相邻') ?? horizontalBlocks[0];
    const pillarShort = (glyph: FlowGlyph) => glyph.position.charAt(0);

    let headline = '四柱上下左右皆通';
    if (lead) {
        const [a, b] = [lead.first, lead.second].sort((left, right) => '年月日时'.indexOf(pillarShort(left)) - '年月日时'.indexOf(pillarShort(right)));
        headline = `气在${pillarShort(a)}、${pillarShort(b)}之间${BLOCK_VERB[lead.tag] ?? `${lead.tag}阻`}`;
    } else if (verticalBlocks > 0) {
        headline = '左右相通，柱内受阻';
    }

    const sentences: string[] = [];
    const longest = chains[0];
    if (longest && longest.links.length >= 2) {
        const oneWay = longest.links.every((link) => link.label === '生' && link.dir === 'forward');
        const allSheng = longest.links.every((link) => link.label === '生');
        const chars = longest.glyphs.map((glyph) => glyph.char).join(oneWay ? '→' : '、');
        sentences.push(`${longest.row === 'stem' ? '天干' : '地支'}${chars}${oneWay ? '一路相生' : allSheng ? '相生相连' : '相连'}`);
    }
    if (lead) {
        sentences.push(`${lead.first.position}${lead.first.char}与${lead.second.position}${lead.second.char}相${lead.tag}`);
    }
    if (verticalBlocks === pillars.length) sentences.push('四柱柱内上下皆为相克');
    else if (verticalBlocks > 0) sentences.push(`柱内上下有 ${verticalBlocks} 处受克`);
    else sentences.push('柱内上下皆通');

    return {
        headline,
        lede: `${sentences.join('；')}。`,
        pass: flowLinks.filter((link) => link.tone === 'supportive').length,
        block: blocks.length,
        chains: chains.slice(0, 3),
        blocks,
    };
}

/* ------------------------------------------------------------------ */
/* 宫位                                                                  */
/* ------------------------------------------------------------------ */

const STAGE_WORD = ['根', '苗', '花', '实'];
const STAGE_START = [0, 18, 36, 48];

export interface PalaceStage {
    key: BaziPillarKey;
    label: string;
    stem: string;
    branch: string;
    stemElement: WuXingElement | null;
    branchElement: WuXingElement | null;
    word: string;
    range: string;
    palaces: string[];
    time: string;
    space: string;
    body: string;
    people: string;
}

export interface PalaceHit {
    key: string;
    detail: string;
    tag: string;
    tone: ReadingTone;
}

/** 岁运动到的一柱，及动到它的各条关系 */
export interface PalaceHitGroup {
    stage: PalaceStage;
    items: PalaceHit[];
}

export interface PalaceReading {
    stages: PalaceStage[];
    currentIndex: number;
    headline: string;
    lede: string;
    hits: PalaceHitGroup[];
    hitsTitle: string;
    hitsMeta: string;
}

function valueText(value: { primary: string; secondary?: string } | undefined): string {
    if (!value) return '—';
    return value.secondary ? `${value.primary}、${value.secondary}` : value.primary;
}

function hitPhrase(tag: string, targets: string[]): string {
    const target = targets.length >= 3 ? `${targets.length} 柱` : targets.join('、');
    if (tag === '受克') return `受${target}克`;
    if (tag === '伏吟' || tag === '反吟') return `与${target}${tag}`;
    if (tag === '暗带' || tag === '拱' || tag === '暗合' || tag === '会') return `与${target}相${tag === '暗带' ? '带' : tag}`;
    return `${tag}${target}`;
}

export function buildPalaceReading(
    viewModel: GanZhiVisualViewModel,
    when: { age: number | null; yearWord: string; liuNian: string; yunLabel: string; yunGanZhi: string },
): PalaceReading {
    const group = (key: string) => viewModel.palaceGroups.find((item) => item.key === key);
    const stages: PalaceStage[] = viewModel.pillars.map((pillar, index) => {
        const time = group('time')?.values[index];
        return {
            key: pillar.key,
            label: pillar.label,
            stem: pillar.stem,
            branch: pillar.branch,
            stemElement: pillar.stemElement as WuXingElement | null,
            branchElement: pillar.branchElement as WuXingElement | null,
            word: STAGE_WORD[index],
            range: index < 3 ? `${STAGE_START[index] || 1}–${STAGE_START[index + 1]}` : `${STAGE_START[3]} 往后`,
            palaces: viewModel.palaceLabels[pillar.key],
            time: time?.primary ?? '—',
            space: valueText(group('space')?.values[index]),
            body: valueText(group('body')?.values[index]),
            people: valueText(group('people')?.values[index]),
        };
    });
    const age = when.age;
    const currentIndex = age === null ? -1 : age < 18 ? 0 : age < 36 ? 1 : age < 48 ? 2 : 3;

    const { diagram } = viewModel;
    const relations = [...diagram.stemRelations, ...diagram.branchRelations, ...diagram.pillarRelations];
    const seen = new Set<string>();
    const hitsByStage = new Map<number, PalaceHit[]>();
    // 来源（流年/岁运）→ 关系 → 被动到的柱
    const bySource = new Map<number, Map<string, string[]>>();
    relations.forEach((relation) => {
        const sources = relation.nodeOrders.filter((order) => order < 2);
        const targets = relation.nodeOrders.filter((order) => order >= 2);
        if (!sources.length || !targets.length) return;
        const tag = tagOf(relation);
        sources.forEach((source) => {
            let verb = tag;
            if (relation.kind === 'stem_control') {
                const own = diagram.nodes[source]?.gan;
                const other = diagram.nodes[targets[0]]?.gan;
                const meta = own && other ? getGanKeMeta(own, other) : null;
                if (meta && meta.controlled === own) verb = '受克';
            }
            const groups = bySource.get(source) ?? new Map<string, string[]>();
            const list = groups.get(verb) ?? [];
            targets.forEach((order) => {
                const label = diagram.nodes[order]?.label;
                if (label && !list.includes(label)) list.push(label);
            });
            groups.set(verb, list);
            bySource.set(source, groups);
        });
        targets.forEach((order) => {
            const dedupe = `${order}:${relation.summaryText}`;
            if (seen.has(dedupe)) return;
            seen.add(dedupe);
            if (!stages[order - 2]) return;
            const list = hitsByStage.get(order - 2) ?? [];
            hitsByStage.set(order - 2, list);
            list.push({
                key: `${relation.key}:${order}`,
                detail: `${sources.map((source) => diagram.nodes[source]?.label).join('、')} · ${relation.summaryText}`,
                tag,
                tone: toneOf(relation.tone),
            });
        });
    });
    const hits: PalaceHitGroup[] = [...hitsByStage.entries()]
        .sort(([left], [right]) => left - right)
        .map(([index, items]) => ({ stage: stages[index], items }));

    const current = stages[currentIndex];
    const headline = current ? `${age} 岁，走在${current.label}「${current.word}」段` : '四柱宫位与类象';
    const sourceName = (order: number) => (order === 0 ? `流年${when.liuNian}` : `${when.yunLabel}${when.yunGanZhi}`);
    // 一句话只说各动到几柱，再点出最要紧的一条；逐条留给下面的清单
    const sourcesSorted = [...bySource.entries()].sort(([left], [right]) => left - right);
    const reach = sourcesSorted.map(([order, groups]) => {
        const pillars = new Set([...groups.values()].flat());
        return `${sourceName(order)}动到 ${pillars.size} 柱`;
    });
    let notable = '';
    for (const verb of ['冲', '反吟', '伏吟', '刑']) {
        const hit = sourcesSorted.find(([, groups]) => groups.has(verb));
        if (hit) {
            notable = `${sourceName(hit[0])}${hitPhrase(verb, hit[1].get(verb) ?? [])}`;
            break;
        }
    }
    const hitSentence = reach.length ? `${reach.join('，')}${notable ? `，其中${notable}` : ''}` : '';
    const opening = current ? `${current.label}${current.stem}${current.branch}为${current.palaces.join('、')}，管 ${current.range.replace(' 往后', ' 岁往后')}${current.range.includes('往后') ? '' : ' 岁'}。` : '';
    const lede = `${opening}${hitSentence ? `${when.yearWord}${hitSentence}。` : `${when.yearWord}岁运未动原局宫位。`}`;

    return {
        stages,
        currentIndex,
        headline,
        lede,
        hits,
        hitsTitle: `${when.yearWord}动到的宫`,
        hitsMeta: `流年${when.liuNian} · ${when.yunLabel}${when.yunGanZhi}`,
    };
}

/* ------------------------------------------------------------------ */
/* 六亲                                                                  */
/* ------------------------------------------------------------------ */

type StarName = Exclude<ShiShenName, '日主'>;

const STAR_ORDER: StarName[] = ['偏财', '正财', '正官', '七杀', '正印', '偏印', '食神', '伤官', '比肩', '劫财'];
const BRANCH_PALACE: Record<BaziPillarKey, string> = { year: '祖辈宫', month: '父母宫', day: '夫妻宫', hour: '子女宫' };
const FAMILY_PERSONS: Record<'male' | 'female', string[]> = {
    male: ['父亲', '母亲', '妻子', '兄弟', '姐妹', '儿子', '女儿'],
    female: ['丈夫', '父亲', '婆婆', '兄弟', '姐妹', '儿子', '女儿'],
};

export interface KinSpot {
    key: string;
    /** 年干、日支…… */
    label: string;
    palace: string | null;
    char: string;
    element: WuXingElement | null;
    star: string;
    spouse: boolean;
}

export interface KinSatellite extends KinSpot {
    primary: string;
    rest: string[];
}

export interface KinRow {
    key: string;
    who: string;
    stars: string;
    at: KinSpot[];
}

export interface KinReading {
    headline: string;
    lede: string;
    satellites: KinSatellite[];
    rows: KinRow[];
    listTitle: string;
    listMeta: string;
}

export function buildKinSpots(pillars: GanZhiVisualPillar[]): KinSpot[] {
    const spots: KinSpot[] = [];
    pillars.forEach((pillar) => {
        if (pillar.key !== 'day') {
            spots.push({
                key: `${pillar.key}-stem`,
                label: `${pillar.label.charAt(0)}干`,
                palace: null,
                char: pillar.stem,
                element: pillar.stemElement as WuXingElement | null,
                star: pillar.stemShiShen,
                spouse: false,
            });
        }
    });
    pillars.forEach((pillar) => {
        spots.push({
            key: `${pillar.key}-branch`,
            label: `${pillar.label.charAt(0)}支`,
            palace: BRANCH_PALACE[pillar.key],
            char: pillar.branch,
            element: pillar.branchElement as WuXingElement | null,
            star: pillar.branchShiShen,
            spouse: pillar.key === 'day',
        });
    });
    return spots;
}

export function buildKinReading(pillars: GanZhiVisualPillar[], gender: BaziGender, mode: GanZhiRelationMode): KinReading {
    const sex = gender === 1 ? 'male' : 'female';
    const spots = buildKinSpots(pillars);
    const satellites: KinSatellite[] = spots.map((spot) => {
        const labels = getGanZhiRelationLabels(spot.star, gender, mode);
        return { ...spot, primary: labels[0] ?? '—', rest: labels.slice(1) };
    });
    const spotsOf = (stars: string[]) => spots.filter((spot) => stars.includes(spot.star));
    const countOf = (star: string) => spotsOf([star]).length;
    const placeText = (star: string) => {
        const at = spotsOf([star]).map((spot) => spot.label);
        return at.length ? `见于${at.join('、')}` : '原局未见';
    };
    const seenText = (star: string) => {
        const at = spotsOf([star]);
        if (!at.length) return '未现';
        return at.length === 1 ? `现于${at[0].label}` : `${COUNT_WORD[at.length] ?? at.length}见`;
    };

    if (mode === 'family') {
        const rows: KinRow[] = FAMILY_PERSONS[sex].map((who) => {
            const stars = STAR_ORDER.filter((star) => FAMILY_RELATIONS[sex][star]?.includes(who));
            return { key: who, who, stars: stars.join(' · '), at: spotsOf(stars) };
        }).filter((row) => row.stars.length > 0);
        const spouseStar = sex === 'male' ? '正财' : '正官';
        const spouseName = sex === 'male' ? '妻星' : '夫星';
        const dayStar = spots.find((spot) => spot.spouse)?.star ?? '—';
        const head = `${spouseName}${spouseStar}${seenText(spouseStar)}`;
        const tail = dayStar === spouseStar ? '坐夫妻宫' : `夫妻宫坐${dayStar}`;
        const otherStar = STAR_ORDER.filter((star) => star !== spouseStar)
            .sort((left, right) => countOf(right) - countOf(left))[0];
        const intro = sex === 'male' ? '男命以正财为妻、偏财为父' : '女命以正官为夫';
        return {
            headline: `${head}，${tail}`,
            lede: `${intro}。${spouseStar}${placeText(spouseStar)}；${otherStar}${placeText(otherStar)}。`,
            satellites,
            rows,
            listTitle: '按人找位',
            listMeta: `${sex === 'male' ? '男' : '女'}命取象 · 干支本气`,
        };
    }

    const rows: KinRow[] = STAR_ORDER.map((star) => ({
        key: star,
        who: SOCIAL_RELATIONS[star].join(' · '),
        stars: star,
        at: spotsOf([star]),
    }));
    const present = STAR_ORDER.filter((star) => countOf(star) > 0).sort((left, right) => countOf(right) - countOf(left));
    const top = present[0];
    const missing = (['正印', '正官', '正财'] as StarName[]).find((star) => countOf(star) === 0 && star !== top);
    const socialOf = (star: StarName) => SOCIAL_RELATIONS[star].slice(0, 2).join('、');
    const headline = top
        ? `${top}${seenText(top)}${missing ? `，${missing}未现` : ''}`
        : '十神不现于干支本气';
    const lede = top
        ? `${top}（${socialOf(top)}）${placeText(top)}${missing ? `；${missing}（${socialOf(missing)}）原局未见` : ''}。`
        : '';
    return {
        headline,
        lede,
        satellites,
        rows,
        listTitle: '按事找位',
        listMeta: '社会类象不分男女',
    };
}
