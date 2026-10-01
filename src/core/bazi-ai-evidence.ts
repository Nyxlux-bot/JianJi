import type { BaziFormatterContext } from './bazi-ai-context';
import { getBaziBirthSignature } from './bazi-ai-identity';
import { formatLocalDisplayDateTime } from './bazi-local-time';
import {
    calculateGanZhiRelations,
    normalizeGanZhiRelationSettings,
    type GanZhiRelationNode,
    type GanZhiRelationSettings,
} from './bazi-ganzhi-relation-engine';
import { buildWuXingBandFromMonthBranch } from './renyuan-duty';
import { TIANGAN_WUXING, DIZHI_WUXING } from './liuyao-data';
import type { BaziLiuNianItem, BaziResult, BaziShenShaLayerBucket } from './bazi-types';

export const BAZI_AI_EVIDENCE_VERSION = 'bazi_ai_evidence_v1' as const;
const PILLARS = ['year', 'month', 'day', 'hour'] as const;
const PILLAR_NAMES = ['年柱', '月柱', '日柱', '时柱'] as const;
const STEMS = '甲乙丙丁戊己庚辛壬癸';
const BRANCHES = '子丑寅卯辰巳午未申酉戌亥';

export type BaziAIEvidenceRequest = { scope: 'natal' | 'full' } | {
    scope: 'historical' | 'forecast' | 'focused';
    years: number[];
    monthYears: number[];
};

export interface BaziAIEvidenceItem {
    id: string;
    label: string;
    scope: 'natal' | 'fortune' | 'context' | 'reference';
    value: unknown;
}

export interface BaziAIEvidencePack {
    version: typeof BAZI_AI_EVIDENCE_VERSION;
    scope: BaziAIEvidenceRequest['scope'];
    period?: {
        fromYear: number;
        toYear: number;
    };
    asOf: string;
    birthSignature: string;
    relationSettings: GanZhiRelationSettings;
    facts: BaziAIEvidenceItem[];
    coverage: {
        daYun: number;
        annualEntries: number;
        distinctYears: number;
        preLuckEntries: number;
        monthYears: number[];
        monthEntries: number;
        missingMonthYears: number[];
        relationFacts: number;
        years: number[];
        requestedYears: number[];
        missingYears: number[];
    };
}

type AddFact = (id: string, label: string, value: unknown, scope?: BaziAIEvidenceItem['scope']) => string;

function makeNode(key: string, label: string, ganZhi: string, scope: GanZhiRelationNode['scope'], order: number): GanZhiRelationNode {
    return { key, label, gan: ganZhi[0], zhi: ganZhi[1], pillar: ganZhi, scope, order };
}

function addNatalFacts(result: BaziResult, add: AddFact): GanZhiRelationNode[] {
    add('natal.birth', '出生与排盘口径', {
        subject: result.subject,
        time: result.timeMeta,
        longitude: result.longitude,
        birthPlace: result.baseInfo.birthPlaceDisplay,
        options: result.schoolOptionsResolved,
    });
    add('natal.base', '命盘附加资料（含胎元、胎息、命宫、身宫、命卦）', result.baseInfo);
    add('natal.jieqi', '出生节气上下文', result.jieQiContext);
    const { startAge: preLuckStartAge, ...childLimit } = result.childLimit;
    add('natal.qiyun', '精确起运与交运口径', {
        ...childLimit, preLuckStartAge, firstDaYunAge: result.daYun[0]?.startAge ?? null,
        boundary: 'preLuckStartAge 是出生后、起运前小运区间的起始运龄，不是起大运年龄；第一步大运运龄见 firstDaYunAge。',
    });
    add('natal.yuanming', '元命与命卦', result.yuanMing);
    add('natal.season', '月令五行带', buildWuXingBandFromMonthBranch(result.baseInfo.renYuanDutyDetail.monthBranch));
    const distribution: Record<string, string[]> = {};
    const nodes = result.fourPillars.map((ganZhi, index) => {
        const id = `natal.${PILLARS[index]}`;
        const god = index === 2 ? '日主' : result.shiShen[index].shiShen;
        const hidden = result.cangGan[index].items;
        add(id, PILLAR_NAMES[index], {
            ganZhi, stemElement: TIANGAN_WUXING[ganZhi[0]], branchElement: DIZHI_WUXING[ganZhi[1]],
            stemPolarity: STEMS.indexOf(ganZhi[0]) % 2 === 0 ? '阳' : '阴',
            branchPolarity: BRANCHES.indexOf(ganZhi[1]) % 2 === 0 ? '阳' : '阴',
            stemTenGod: god, hiddenStems: hidden,
            matrix: Object.fromEntries(result.pillarMatrix.map((row) => [row.label, row.values[index]])),
        });
        if (god !== '日主') (distribution[god] ??= []).push(`${id}.天干`);
        hidden.forEach((item) => (distribution[item.shiShen] ??= []).push(`${id}.藏干${item.gan}(${item.type})`));
        const roots = result.cangGan.flatMap((group, rootIndex) => group.items
            .filter((item) => TIANGAN_WUXING[item.gan] === TIANGAN_WUXING[ganZhi[0]])
            .map((item) => ({
                pillar: PILLAR_NAMES[rootIndex], stem: item.gan, qi: item.type,
                matching: item.gan === ganZhi[0] ? '同干' : '同五行',
                position: rootIndex === index ? '同柱' : '他柱', evidenceId: `natal.${PILLARS[rootIndex]}`,
            })));
        add(`${id}.roots`, `${PILLAR_NAMES[index]}透干的藏干来源`, {
            stem: ganZhi[0], roots,
            boundary: '只检查原局的同干/同五行藏干对应，不含新增大运、流年或流月。空列表仅表示原局未找到此类对应，不能据此断定岁运中无根；不裁定根气强弱、闭库或有效性。十二长生和自坐见各柱矩阵。',
        });
        return makeNode(id, PILLAR_NAMES[index], ganZhi, 'yuanju', index);
    });
    add('natal.tenGodDistribution', '十神透藏分布', distribution);
    add('natal.shensha', '原局各柱神煞（每项只属于列出的柱位）', {
        byPillar: result.shenShaV2.siZhu.byPillar.map((item) => ({
            pillar: PILLAR_NAMES[PILLARS.indexOf(item.position)], ganZhi: item.ganZhi, stars: item.stars,
        })),
    });
    add('reference.analysis', '系统启发式摘要，非已确认结论', result.analysisProfile ?? null, 'reference');
    return nodes;
}

export function buildBaziAIEvidencePack(
    result: BaziResult,
    context?: BaziFormatterContext,
    asOf: Date = new Date(),
    request: BaziAIEvidenceRequest = { scope: 'full' },
): BaziAIEvidencePack {
    const { scope } = request;
    const facts = new Map<string, BaziAIEvidenceItem>();
    const add: AddFact = (id, label, value, scope = 'natal') => {
        if (!facts.has(id)) facts.set(id, { id, label, value, scope });
        return id;
    };
    const settings = normalizeGanZhiRelationSettings(context?.ganZhiRelationSettings);
    const natalNodes = addNatalFacts(result, add);
    let relationCount = 0;
    const relationsFor = (extra: Array<{ key: string; label: string; ganZhi: string }>): string[] => {
        const nodes = [...natalNodes, ...extra.filter((item) => item.ganZhi.length === 2)
            .map((item, index) => makeNode(item.key, item.label, item.ganZhi, 'suiyun', natalNodes.length + index))];
        return calculateGanZhiRelations(nodes, settings).map((relation) => {
            const members = relation.nodeOrders.map((order) => nodes[order].key);
            const memberIds = relation.scope === 'yuanju' ? members
                : members.map((member) => member.replace('fortune.dayun.', 'd').replace('fortune.preluck', 'p')
                    .replace('fortune.unassigned', 'u').replace('fortune.month.', 'm')
                    .replace('natal.', 'n.').replace('.year.', '.y').replace('.liunian', '.ln').replace('.xiaoyun', '.xy'));
            const id = `relation:${relation.kind}:${memberIds.join('+')}:${relation.label}`;
            if (!facts.has(id)) {
                let summaryText = relation.summaryText.replace(/合化([木火土金水])/g,
                    '相合（规则所指五行为$1，是否成化未判定）');
                // 名称（label）已是关系摘要，值里只留类别和参与对象，避免长跨度证据包被重复字段撑大。
                const definition: Record<string, unknown> = {
                    kind: relation.kind,
                    between: relation.nodeOrders.map((order) => `${nodes[order].label}${nodes[order].pillar}`).join(' / '),
                };
                if (relation.kind === 'stem_control' && relation.controller && relation.controlled) {
                    const matchedNodes = relation.nodeOrders.map((order) => nodes[order]);
                    const controllerNode = matchedNodes.find((n) => n.gan === relation.controller);
                    const controlledNode = matchedNodes.find((n) => n.gan === relation.controlled);
                    if (controllerNode && controlledNode) {
                        summaryText = `${controllerNode.label}（${relation.controller}）克${controlledNode.label}（${relation.controlled}）`;
                        definition.controller = relation.controller;
                        definition.controlled = relation.controlled;
                    }
                }
                add(id, summaryText, definition, relation.scope === 'yuanju' ? 'natal' : 'fortune');
                relationCount += 1;
            }
            return id;
        });
    };
    add('natal.relations', '原局关系索引（空表表示当前启用规则下无命中）', relationsFor([]));
    const usedStars = new Set(result.shenShaV2.siZhu.allStars);
    // 原局说明的内容与 ID 不随阶段或查看的岁运变化。
    add('natal.shenshaSources', '原局命中神煞的说明与来源', {
        version: result.shenShaV2.catalogVersion,
        catalog: result.shenShaV2.catalog.filter((star) => usedStars.has(star.fullName)),
    });
    const addShenSha = (ganZhi: string, bucket?: BaziShenShaLayerBucket): string | null => {
        const available = bucket ?? result.shenShaV2.ganZhiBuckets?.[ganZhi];
        if (!available) return null;
        // The calculator substitutes the transit into its hour slot. Other
        // slots are recomputed context, not stars belonging to this transit.
        const transit = available.byPillar.find((item) => item.position === 'hour');
        if (!transit) return null;
        transit.stars.forEach((item) => usedStars.add(item.star));
        return add(`fortune.shensha.${ganZhi}`, `${ganZhi}岁运本身的神煞命中`, {
            ganZhi, stars: transit.stars,
            boundary: '这些神煞属于所列岁运干支，不属于原局时柱或其他原局柱位；原局神煞只使用原局各柱神煞条目。',
        }, 'fortune');
    };
    const selected = context?.fortuneSelection;
    const focusYear = selected?.mode === 'xiaoyun'
        ? result.xiaoYun[selected.selectedXiaoYunIndex]?.year
        : selected ? result.daYun[selected.selectedDaYunIndex]?.liuNian[selected.selectedLiuNianIndex]?.year : undefined;
    const requestedYears = 'years' in request ? [...new Set(request.years)].sort((a, b) => a - b) : [];
    const period = requestedYears.length
        ? { fromYear: requestedYears[0], toYear: requestedYears[requestedYears.length - 1] } : undefined;
    const inPeriod = (year: number): boolean => scope === 'full' || requestedYears.includes(year);
    const annualByYear = new Map([...result.xiaoYun, ...result.liuNian, ...result.daYun.flatMap((yun) => yun.liuNian)]
        .map((annual) => [annual.year, annual]));
    const daYun = result.daYun.map((yun, index) => {
        const endAt = result.daYun[index + 1]?.jiaoYunDateTimeIso;
        const transitionYear = endAt ? new Date(endAt).getFullYear() : undefined;
        const annuals = new Map(yun.liuNian.map((annual) => [annual.year, annual]));
        // 交运年同时提供旧运与新运的作用；流年事实仍取自同一份排盘结果。
        const transitionAnnual = transitionYear === undefined ? undefined : annualByYear.get(transitionYear);
        if (transitionYear !== undefined && transitionAnnual && endAt && new Date(endAt).getTime() > new Date(transitionYear, 0, 1).getTime()) {
            annuals.set(transitionYear, transitionAnnual);
        }
        return { yun, index, endAt, annuals: [...annuals.values()].filter((annual) => inPeriod(annual.year)) };
    }).filter((entry) => scope !== 'natal' && (scope === 'full' || entry.annuals.length > 0));
    const xiaoYun = result.xiaoYun.filter((annual) => scope !== 'natal' && inPeriod(annual.year));
    const liuNian = result.liuNian.filter((annual) => scope !== 'natal' && inPeriod(annual.year));
    const wantedMonthYears = new Set('monthYears' in request ? request.monthYears.filter(inPeriod)
        : scope === 'full' ? [asOf.getFullYear(), ...(focusYear === undefined ? [] : [focusYear])] : []);
    const monthData = new Map<number, { annual: BaziLiuNianItem; frames: Array<{ key: string; label: string; ganZhi: string }> }[]>();
    const years = new Set<number>();
    let annualCount = 0;
    const addAnnual = (annual: BaziLiuNianItem, parentId: string, yunGanZhi?: string) => {
        const id = `${parentId}.year.${annual.year}`;
        const period = daYun.find((entry) => `fortune.dayun.${entry.index}` === parentId);
        const frames = [
            ...(yunGanZhi ? [{ key: parentId, label: '大运', ganZhi: yunGanZhi }] : []),
            { key: `${id}.liunian`, label: `${annual.year}流年`, ganZhi: annual.ganZhi },
            ...(parentId === 'fortune.preluck' ? [{ key: `${id}.xiaoyun`, label: `${annual.year}小运`, ganZhi: annual.xiaoYunGanZhi }] : []),
        ];
        // 原局自身的关系已在 natal.relations 列出，逐年只保留岁运参与的关系，避免每年重复整套原局关系。
        const annualRelations = relationsFor(frames).filter((relationId) => facts.get(relationId)?.scope !== 'natal');
        // 前事核验跨度长，小运只作微观辅助，不逐年展开其神煞。
        const compactHistorical = scope === 'historical' && parentId !== 'fortune.preluck';
        if (yunGanZhi) add(parentId, '大运', yunGanZhi, 'fortune');
        add(`${id}.liunian`, `${annual.year}流年`, annual.ganZhi, 'fortune');
        if (!compactHistorical) add(`${id}.xiaoyun`, `${annual.year}小运`, annual.xiaoYunGanZhi, 'fortune');
        add(id, `${annual.year}年岁运`, {
            year: annual.year, age: annual.age, ganZhi: annual.ganZhi, xiaoYun: annual.xiaoYunGanZhi,
            ...(period ? { dayunPeriod: { ganZhi: period.yun.ganZhi,
                startLocal: formatLocalDisplayDateTime(new Date(period.yun.jiaoYunDateTimeIso)),
                endLocal: period.endAt ? formatLocalDisplayDateTime(new Date(period.endAt)) : null } } : {}),
            parentId, snapshotCurrent: annual.isCurrent, relations: annualRelations,
            shenSha: addShenSha(annual.ganZhi), ...(compactHistorical ? {} : { xiaoYunShenSha: addShenSha(annual.xiaoYunGanZhi) }),
        }, 'fortune');
        years.add(annual.year);
        annualCount += 1;
        if (wantedMonthYears.has(annual.year)) {
            const entries = monthData.get(annual.year) ?? [];
            entries.push({ annual, frames });
            monthData.set(annual.year, entries);
        }
        return id;
    };
    daYun.forEach(({ yun, index, endAt, annuals }) => {
        const id = `fortune.dayun.${index}`;
        const { liuNian: allAnnuals, ...data } = yun;
        add(id, `第${index + 1}步大运`, {
            ...data, snapshotCurrent: data.isCurrent, endAt: endAt ?? null,
            boundary: '按 jiaoYunDateTimeIso 起运，endAt 交下一运；交运年可同时列于两步大运。逐年条目的 dayunPeriod 只在起止时刻之间属于这步大运，同一年出现在两步大运时按时刻分别解释，不按上半年/下半年近似。',
        }, 'fortune');
        add(`${id}.relations`, '大运与原局关系', relationsFor([{ key: id, label: '大运', ganZhi: yun.ganZhi }]), 'fortune');
        addShenSha(yun.ganZhi, result.shenShaV2.daYun.find((item) => item.index === index)?.bucket);
        const annualIds = annuals.map((annual) => addAnnual(annual, id, yun.ganZhi));
        add(`${id}.years`, '该大运本轮展开的流年索引', annualIds, 'fortune');
    });
    if (xiaoYun.length) add('fortune.preluck', '交第一步大运之前的小运区间', result.childLimit, 'fortune');
    xiaoYun.forEach((annual) => addAnnual(annual, 'fortune.preluck'));
    // 兼容仅在顶层保留流年的旧记录，不用当前大运列表覆盖它们。
    const unassignedYears = liuNian.filter((annual) => !years.has(annual.year));
    if (unassignedYears.length) add('fortune.unassigned', '旧记录中缺少所属大运的流年，不得自行指定大运', null, 'fortune');
    unassignedYears.forEach((annual) => addAnnual(annual, 'fortune.unassigned'));
    let monthCount = 0;
    monthData.forEach((entries, year) => {
        const months = new Map<number, BaziLiuNianItem['liuYue'][number]>();
        entries.forEach(({ annual }) => annual.liuYue.forEach((month) => months.set(month.index, month)));
        months.forEach((month) => {
            const id = `fortune.month.${year}.${month.index}`;
            const { isCurrent, ...data } = month;
            add(id, `${year}年${month.termName}流月`, {
                ...data, snapshotCurrent: isCurrent, shenSha: addShenSha(month.ganZhi),
                periodRelations: entries.map(({ frames }) => ({
                    period: frames[0].key,
                    refs: relationsFor([...frames, { key: id, label: `${year}年${month.termName}流月`, ganZhi: month.ganZhi }]),
                })),
            }, 'fortune');
            monthCount += 1;
        });
    });
    if (scope !== 'natal') {
        add('fortune.shenshaSources', '新增岁运神煞的说明与来源', {
            version: result.shenShaV2.catalogVersion,
            catalog: result.shenShaV2.catalog.filter((star) => usedStars.has(star.fullName) && !result.shenShaV2.siZhu.allStars.includes(star.fullName)),
        }, 'fortune');
    }
    if (scope === 'full' || scope === 'focused') {
        add('context.focus', '查看焦点与历史排盘标记，不代表请求当天', {
            panelMode: context?.panelMode ?? null, selection: selected ?? null,
            selectedYear: focusYear ?? null,
        }, 'context');
        if (focusYear !== undefined && inPeriod(focusYear)) {
            add('reference.energy', '所选岁运的综合能量，禁止当作先天旺衰或六亲证据', context?.wuXingEnergy ?? null, 'reference');
        }
    }
    const missingMonthYears = [...wantedMonthYears].filter((year) => !monthData.get(year)?.some(({ annual }) => annual.liuYue.length > 0));
    return {
        version: BAZI_AI_EVIDENCE_VERSION, scope, ...(period ? { period } : {}), asOf: asOf.toISOString(), birthSignature: getBaziBirthSignature(result),
        relationSettings: settings, facts: [...facts.values()],
        coverage: {
            daYun: daYun.length, annualEntries: annualCount, distinctYears: years.size,
            preLuckEntries: xiaoYun.length,
            monthYears: [...monthData.keys()].sort((a, b) => a - b), monthEntries: monthCount, missingMonthYears,
            relationFacts: relationCount,
            years: [...years].sort((a, b) => a - b), requestedYears,
            missingYears: requestedYears.filter((year) => !years.has(year)),
        },
    };
}

export function formatBaziAIEvidencePack(pack: BaziAIEvidencePack): string {
    const grouped: Record<BaziAIEvidenceItem['scope'], unknown[][]> = { natal: [], fortune: [], context: [], reference: [] };
    pack.facts.forEach(({ id, label, value, scope }) => {
        grouped[scope].push([id, label, value]);
    });
    const { facts, ...metadata } = pack;
    return [
        '【命盘证据包】facts 按 natal/fortune/context/reference 分组，每行依次是 [id,名称,值]。null 表示未提供；关闭的关系规则不代表关系不存在。',
        '关系只表示规则匹配，不自动证明成化、作用强弱或吉凶；原始引用 ID 仅作系统定位，严禁在正文输出任何 [R编号] 或内部代码。正文结论引用只使用自然可读的宏观盘据（例如 [年柱]、[2026年岁运]），每个小节末尾最多保留 1 处，严禁逐句堆叠方括号。',
        '天干相克具有严格单向性（金克木、木克土、土克水、水克火、火克金），以各项关系事实明确标注的【主克方克受克方】为准，严禁颠倒生克方向（例如辛金克乙木，绝非乙克辛；丁火克辛金，绝非辛克丁）。起运后岁运推断以【大运、流年与原局】为核心主轴，小运及神煞仅作静态微观参考，不计入大运流年主力三合三会体系；原局根气来源不能用于证明新增岁运中无根。',
        pack.scope === 'natal'
            ? '本轮 scope=natal，仅展开原局事实，未提供岁运与流月；coverage 中的零值表示本轮未展开，不代表命盘不存在相应数据。'
            : pack.scope === 'historical'
                ? `本轮 scope=historical，仅展开 ${pack.period?.fromYear}-${pack.period?.toYear} 的历史岁运；范围外年份未提供，不得补造。`
                : pack.scope === 'forecast'
                    ? `本轮 scope=forecast，仅展开 ${pack.period?.fromYear}-${pack.period?.toYear} 的岁运；范围外年份未提供，不得补造。`
                    : pack.scope === 'focused'
                        ? `本轮 scope=focused，按问题取数，年份为 ${pack.coverage.requestedYears.join('、')}。`
                        : '本轮 scope=full，展开原局及岁运事实；coverage 描述本轮实际提供的范围。',
        'age 沿用排盘库运龄，不转换为周岁。snapshotCurrent 为历史排盘参考标记；asOf 是本轮请求日期，查看焦点与今年分别解释。',
        '原局事实与岁运事实分层使用。基础定局、六亲初验不得用所选岁运能量代替原局。流月仅覆盖 coverage.monthYears，其余月份未提供，禁止补造。',
        'coverage.years 是已提供年份；missingYears 与 missingMonthYears 是缺失资料，须明确告知，不能补算或声称已有完整依据。历史阶段的今年只能核对 asOf 之前的事件。',
        JSON.stringify({ ...metadata, facts: grouped }),
    ].join('\n');
}
