/**
 * 术语精解统一入口
 * 汇总八字（十神、十二长生、纳音、神煞、日主、宫星、干支关系）、梅花（体用诀、三卦、八卦类象）、
 * 六爻（六亲、六神、世应动变伏神用神、状态标记、卦型、神煞）与两者共用的五行旺衰。
 * 原文、链接、覆盖率由 scripts/check-glossary.cjs 校验。
 * 纯数据与查询层，不依赖任何 UI 组件，供排盘弹窗与书阁速查共用。
 */

import { BAZI_CHANGSHENG_GLOSSARY } from './bazi-changsheng';
import { BAZI_NAYIN_GLOSSARY } from './bazi-nayin';
import { BAZI_PALACE_GLOSSARY, BAZI_RIZHU_GLOSSARY } from './bazi-pillar';
import { BAZI_RELATION_GLOSSARY, BAZI_RELATION_TERMS, RELATION_KIND_TERM } from './bazi-relation';
import { BAZI_SHENSHA_GLOSSARY } from './bazi-shensha';
import { BAZI_SHISHEN_GLOSSARY } from './bazi-shishen';
import { MEIHUA_TIYONG_GLOSSARY, TRIGRAM_IMAGE_GLOSSARY } from './meihua-tiyong';
import { MEIHUA_GUA_GLOSSARY } from './meihua-gua';
import { WUXING_SEASON_GLOSSARY } from './wuxing-season';
import { LIUYAO_LIUQIN_GLOSSARY, LIUYAO_LIUSHEN_GLOSSARY, LIUYAO_YAO_GLOSSARY } from './liuyao-roles';
import { LIUYAO_GUAXING_GLOSSARY, LIUYAO_STATUS_GLOSSARY } from './liuyao-marks';
import { LIUYAO_SHENSHA_GLOSSARY } from './liuyao-shensha';
import type { GlossaryCategory, GlossaryEntry } from './types';

export * from './types';
export { STAGE_ORDER, STAGE_RANK, type StageRank } from './bazi-changsheng';
export { SEASON_ORDER, type SeasonState } from './wuxing-season';
export {
    BAZI_CHANGSHENG_GLOSSARY,
    BAZI_NAYIN_GLOSSARY,
    BAZI_SHENSHA_GLOSSARY,
    BAZI_SHISHEN_GLOSSARY,
    BAZI_RIZHU_GLOSSARY,
    BAZI_PALACE_GLOSSARY,
    BAZI_RELATION_GLOSSARY,
    BAZI_RELATION_TERMS,
    RELATION_KIND_TERM,
    MEIHUA_TIYONG_GLOSSARY,
    MEIHUA_GUA_GLOSSARY,
    TRIGRAM_IMAGE_GLOSSARY,
    WUXING_SEASON_GLOSSARY,
    LIUYAO_LIUQIN_GLOSSARY,
    LIUYAO_LIUSHEN_GLOSSARY,
    LIUYAO_YAO_GLOSSARY,
    LIUYAO_STATUS_GLOSSARY,
    LIUYAO_GUAXING_GLOSSARY,
    LIUYAO_SHENSHA_GLOSSARY,
};

export const ALL_GLOSSARY_ENTRIES: GlossaryEntry[] = [
    ...BAZI_SHISHEN_GLOSSARY,
    ...BAZI_CHANGSHENG_GLOSSARY,
    ...BAZI_NAYIN_GLOSSARY,
    ...BAZI_SHENSHA_GLOSSARY,
    ...BAZI_RIZHU_GLOSSARY,
    ...BAZI_PALACE_GLOSSARY,
    ...BAZI_RELATION_GLOSSARY,
    ...MEIHUA_TIYONG_GLOSSARY,
    ...MEIHUA_GUA_GLOSSARY,
    ...TRIGRAM_IMAGE_GLOSSARY,
    ...WUXING_SEASON_GLOSSARY,
    ...LIUYAO_LIUQIN_GLOSSARY,
    ...LIUYAO_LIUSHEN_GLOSSARY,
    ...LIUYAO_YAO_GLOSSARY,
    ...LIUYAO_STATUS_GLOSSARY,
    ...LIUYAO_GUAXING_GLOSSARY,
    ...LIUYAO_SHENSHA_GLOSSARY,
];

const ENTRY_BY_ID = new Map<string, GlossaryEntry>();
const ENTRY_BY_CATEGORY_TERM = new Map<string, GlossaryEntry>();
const ENTRY_BY_TERM = new Map<string, GlossaryEntry>();

function normalizeTerm(raw: string): string {
    return raw.trim().replace(/\s+/g, '');
}

for (const entry of ALL_GLOSSARY_ENTRIES) {
    ENTRY_BY_ID.set(entry.id, entry);
    const terms = [entry.title, ...(entry.aliases ?? [])];
    for (const term of terms) {
        const key = normalizeTerm(term);
        if (!key) continue;
        ENTRY_BY_CATEGORY_TERM.set(`${entry.category}:${key}`, entry);
        if (!ENTRY_BY_TERM.has(key)) {
            ENTRY_BY_TERM.set(key, entry);
        }
    }
}

/** 按唯一 ID 精确获取词条（如 'shishen:正印'、'nayin:大林木'） */
export function getGlossaryEntryById(id: string): GlossaryEntry | null {
    return ENTRY_BY_ID.get(id) ?? null;
}

/** 按类目获取整组词条，适合书阁速查页列表展示 */
export function getGlossaryByCategory(category: GlossaryCategory): GlossaryEntry[] {
    return ALL_GLOSSARY_ENTRIES.filter((entry) => entry.category === category);
}

/**
 * 按术语名与可选类目查找精解词条（自动支持别名与古今异写归一）。
 * 推荐在已知排盘行类型时传入 category，避免极少数跨类重名歧义（如「正印」等）。
 */
export function findGlossaryEntry(
    term: string,
    category?: GlossaryCategory,
): GlossaryEntry | null {
    const key = normalizeTerm(term);
    if (!key) return null;

    if (category) {
        const hit = ENTRY_BY_CATEGORY_TERM.get(`${category}:${key}`);
        if (hit) return hit;
    }

    return ENTRY_BY_TERM.get(key) ?? null;
}

export type BaziTermCategory = 'bazi-shishen' | 'bazi-changsheng' | 'bazi-nayin' | 'bazi-shensha' | 'bazi-rizhu' | 'bazi-palace' | 'bazi-relation';

const BAZI_NON_TERM_LABELS = new Set(['—', '-', '']);
const HEAVEN_STEM_PREFIX_RE = /^[甲乙丙丁戊己庚辛壬癸](.+)$/;
/** 关系引擎的完整标签：「三合水局」「三会木局」「合化土」 */
const RELATION_LABEL_RE: Array<[RegExp, string]> = [
    [/^三合.局$/, '三合'],
    [/^三会.局$/, '三会'],
    [/^合化.$/, '天干五合'],
    [/^(子卯|卯子)?无礼之刑$|^(寅巳申)?无恩之刑$|^(丑未戌)?恃势之刑$/, '三刑'],
];

/**
 * 解析八字排盘单元格里的术语文本：
 * - 空值、占位符（'—'）不响应；「元男 / 元女 / 日主」指到日主词条；
 * - 藏干复合文本（如「丙正印」「庚伤官」）自动剥离前缀天干匹配十神；
 * - 关系标签的完整写法（「三合水局」「合化土」）归一到对应词条。
 */
export function resolveBaziTerm(raw: string, category?: BaziTermCategory): GlossaryEntry | null {
    const cleaned = normalizeTerm(raw);
    if (BAZI_NON_TERM_LABELS.has(cleaned)) {
        return null;
    }

    const direct = findGlossaryEntry(cleaned, category);
    if (direct) return direct;

    if (!category || category === 'bazi-shishen') {
        const match = cleaned.match(HEAVEN_STEM_PREFIX_RE);
        if (match) {
            const hit = findGlossaryEntry(match[1], 'bazi-shishen');
            if (hit) return hit;
        }
    }

    if (!category || category === 'bazi-relation') {
        for (const [re, term] of RELATION_LABEL_RE) {
            if (re.test(cleaned)) return findGlossaryEntry(term, 'bazi-relation');
        }
    }

    return null;
}

/** 按关系引擎的 kind 取词条：单字标签「冲」「合」分不清是干还是支，页面接入时用 kind */
export function resolveRelationKind(kind: string): GlossaryEntry | null {
    const term = RELATION_KIND_TERM[kind];
    return term ? findGlossaryEntry(term, 'bazi-relation') : null;
}

/**
 * 关系引擎的摘要文字归到词条，如「子午相冲」「甲己合化土」「申子辰三合水局」「日柱伏吟」。
 * 「合化X」在天干是五合、在地支是六合，所以要带上所在的行。
 */
const RELATION_SUMMARY_RULES: Record<'stem' | 'branch' | 'pillar', Array<[RegExp, string]>> = {
    stem: [[/合化.$/, '天干五合'], [/相冲$/, '天干相冲'], [/克/, '天干相克']],
    branch: [
        [/三合.局$/, '三合'], [/三会.局$/, '三会'], [/半合.局$/, '半合'], [/暗合$/, '暗合'], [/夹.$/, '拱合'],
        [/合化.$/, '六合'], [/自刑$/, '自刑'], [/相?刑$/, '三刑'], [/相?冲$/, '六冲'], [/相?破$/, '相破'], [/相?害$/, '六害'],
    ],
    pillar: [[/伏吟$/, '伏吟'], [/反吟$/, '反吟'], [/自合$/, '自合'], [/盖头$/, '盖头'], [/截脚$/, '截脚']],
};

export function resolveRelationSummary(text: string, domain: 'stem' | 'branch' | 'pillar'): GlossaryEntry | null {
    const cleaned = normalizeTerm(text);
    const hit = RELATION_SUMMARY_RULES[domain].find(([re]) => re.test(cleaned));
    return hit ? findGlossaryEntry(hit[1], 'bazi-relation') : null;
}

/** 判断某术语是否存在对应精解词条，供盘面决定是否渲染可点击态 */
export function hasGlossaryEntry(term: string, category?: GlossaryCategory): boolean {
    return findGlossaryEntry(term, category) !== null;
}

/* ---------------- 六爻与梅花 ---------------- */

export type LiuyaoTermCategory = 'liuyao-liuqin' | 'liuyao-liushen' | 'liuyao-yao' | 'liuyao-status' | 'liuyao-guaxing' | 'liuyao-shensha' | 'wuxing-season';
export type MeihuaTermCategory = 'meihua-gua' | 'meihua-tiyong' | 'trigram-image' | 'wuxing-season';

/** 六爻盘面上的术语只在给定类目里找：「白虎」「将星」这类名字和八字神煞重名，不能串类 */
export function resolveLiuyaoTerm(raw: string, category: LiuyaoTermCategory): GlossaryEntry | null {
    const key = normalizeTerm(raw);
    return key ? ENTRY_BY_CATEGORY_TERM.get(`${category}:${key}`) ?? null : null;
}

/** 梅花盘面上的术语，同样只在给定类目里找 */
export function resolveMeihuaTerm(raw: string, category: MeihuaTermCategory): GlossaryEntry | null {
    const key = normalizeTerm(raw);
    return key ? ENTRY_BY_CATEGORY_TERM.get(`${category}:${key}`) ?? null : null;
}
