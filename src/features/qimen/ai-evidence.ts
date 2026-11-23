import { QIMEN_GATES, QIMEN_PALACES } from './data';
import { splitQimenReading } from './ai-reading';
import { annotateQimenPassages, linkQimenPalaces, qimenCitationText } from './palace-links';
import { QIMEN_PERIODS } from './types';

// 星、门、宫各有自己的五行。只校验能明确识别的陈述，取象与结论仍由模型解释。
const elements = new Map<string, string>();
for (const palace of QIMEN_PALACES) {
    elements.set(palace.star, palace.element);
    elements.set(palace.name + '宫', palace.element);
    elements.set(palace.name[0] + '宫', palace.element);
    elements.set(palace.name[0] + palace.element, palace.element);
}
for (const [gate, info] of Object.entries(QIMEN_GATES)) elements.set(gate, info.element);
const entity = '(' + [...elements.keys()].join('|') + ')';
const relationEntity = '(' + [...elements.keys(), ...'金木水火土'].join('|') + ')';
const attribute = new RegExp(entity + '(?:星)?(?:五行)?(?:属|为)?([木火土金水])', 'gu');
const together = new RegExp(entity + '(?:星)?[与和、]' + entity + '(?:同属|均属|皆属)([木火土金水])', 'gu');
const relationship = new RegExp(relationEntity + '[木火土金水]?(被|受)?(?:所)?(生|克)' + relationEntity + '|' + relationEntity + '[木火土金水]?(?:被|受)' + relationEntity + '[木火土金水]?(?:所)?(克|生)', 'gu');

function factConflict(text: string): string | undefined {
    for (const m of text.matchAll(attribute)) {
        if (elements.get(m[1]) !== m[2]) return m[1] + '属' + elements.get(m[1]);
    }
    for (const m of text.matchAll(together)) {
        if ([m[1], m[2]].some(name => elements.get(name) !== m[3])) return m[1] + '属' + elements.get(m[1]) + '，' + m[2] + '属' + elements.get(m[2]);
    }
    for (const m of text.matchAll(relationship)) {
        const from = m[6] || (m[2] ? m[4] : m[1]);
        const to = m[5] || (m[2] ? m[1] : m[4]);
        const cycle = (m[7] || m[3]) === '生' ? '木火土金水' : '木土水火金';
        if (cycle[(cycle.indexOf(elements.get(from) ?? from) + 1) % 5] !== (elements.get(to) ?? to)) return '请核对「' + m[0] + '」的生克方向';
    }
}

// 宫位标记同时是盘据编号。显示及存档使用该次请求的快照，模型只负责挑选依据。
export function resolveQimenEvidence(answer: string, context: string, requireFour = false) {
    const facts = new Map<string, string>();
    for (const m of context.matchAll(/^【([年月日时]盘·.{2}宫)】 ([^｜\n]+)｜/gmu)) facts.set(m[1], m[2]);
    const text = annotateQimenPassages(qimenCitationText(answer));
    const issue = factConflict(text);
    if (issue) return { issue };
    const sections = splitQimenReading(text);
    if (requireFour || (sections && QIMEN_PERIODS.every(period => sections[period]))) {
        for (const period of QIMEN_PERIODS) {
            const section = sections?.[period];
            if (!section || ![...facts.keys()].some(key => key.startsWith(period) && section.includes('【' + key + '】'))) {
                return { issue: period + '缺少本盘的解读或宫位引用' };
            }
        }
        if (!sections?.总断) return { issue: '缺少总断' };
    }
    const paragraphs = [];
    const relations = ['门克宫', '宫克门', '门生宫', '宫生门', '门宫比和'];
    let count = 0;
    for (const paragraph of text.split(/\n\s*\n/u)) {
        const cited = new Set<string>();
        for (const m of paragraph.matchAll(/【([年月日时]盘[·・][^】]+)】/gu)) {
            if (!facts.has(m[1])) return { issue: '本次盘面没有「' + m[1] + '」' };
            cited.add(m[1]);
            count++;
        }
        for (const phrase of paragraph.split(/[。；！？\n]/u)) {
            const keys = [...phrase.matchAll(/【([^】]+)】/gu)].map(m => m[1]).filter(key => facts.has(key));
            if (new Set(keys).size !== 1) continue;
            const evidence = facts.get(keys[0]);
            const direction = relations.find(r => phrase.includes(r));
            if (direction && evidence && !evidence.includes(direction)) return { issue: keys[0] + '的门宫关系与所引盘据不符' };
        }
        paragraphs.push(paragraph);
        for (const key of cited) paragraphs.push('> 【' + key + '】 ' + facts.get(key));
    }
    if (!count && /[坎坤震巽中乾兑艮离][一二三四五六七八九]宫/u.test(text)) return { issue: '请为本轮涉及的宫位附上对应盘据' };
    return { content: linkQimenPalaces(paragraphs.join('\n\n')) };
}
