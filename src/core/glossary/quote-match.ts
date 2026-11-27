/**
 * 引文与书阁正文的比对规则：校验脚本核对原文、阅读器定位引文段都用这一份。
 * 比对前去掉标点，把异体字和底本错字统一，只认字。
 */

const PUNCTUATION = /[\s，。；：、！？“”‘’「」『』（）()《》〈〉·…,.;:!?\-—【】*．″′]/g;

/** 异体字：各书通用 */
const VARIANTS: ReadonlyArray<readonly [string, string]> = [
    ['絶', '绝'], ['陽', '阳'], ['陰', '阴'], ['隂', '阴'], ['尅', '克'], ['剋', '克'], ['徳', '德'], ['葢', '盖'],
    ['嵗', '岁'], ['竒', '奇'], ['轝', '舆'], ['夀', '寿'], ['刼', '劫'], ['羣', '群'], ['煞', '杀'], ['殺', '杀'],
    ['砂', '沙'], ['傍', '旁'], ['镴', '蜡'], ['旣', '既'], ['劒', '剑'], ['敎', '教'], ['戸', '户'], ['燿', '耀'],
    ['啣', '衔'], ['餧', '喂'], ['彷', '仿'], ['寳', '宝'], ['畧', '略'], ['顚', '颠'],
    ['乗', '乘'], ['髙', '高'], ['羙', '美'], ['隠', '隐'], ['馀', '余'],
];

/** 校字表：底本错字，引文里按通行本改正。[书目 id，底本写法，引文写法] */
const EMENDATIONS: ReadonlyArray<readonly [string, string, string]> = [
    // 殆知阁底本把「凶」录作「防」，「巳」「己」「已」常混，「戌」作「戍」
    ['sanmingtonghui', '防', '凶'], ['sanmingtonghui', '巳', '己'], ['sanmingtonghui', '已', '己'],
    ['sanmingtonghui', '毋', '母'], ['sanmingtonghui', '链', '炼'], ['sanmingtonghui', '涚', '洳'], ['sanmingtonghui', '戍', '戌'],
    // 底本里「高冈」的「冈」是私用区字符
    ['sanmingtonghui', '', '冈'],
    ['qiongtongbaojian', '巳', '己'], ['shenfengtongkao', '巳', '己'],
    ['zipingzhenquan', '百大贵之格', '而大贵之格'],
    // 《增删卜易》避讳把「玄武」写作「元武」，「螣蛇」作「滕蛇」「媵蛇」；星煞章贵人歌「乙己」误作「乙巳」
    ['zengshanbuyi', '元武', '玄武'], ['zengshanbuyi', '滕蛇', '螣蛇'], ['zengshanbuyi', '媵蛇', '螣蛇'],
    ['zengshanbuyi', '乙巳鼠猴', '乙己鼠猴'],
];

const CONFUSED_SI = new Set(EMENDATIONS.filter(([, from]) => from === '巳').map(([book]) => book));

export function normalizeQuoteText(text: string, bookId: string): string {
    let out = text.replace(PUNCTUATION, '');
    for (const [from, to] of VARIANTS) out = out.split(from).join(to);
    for (const [book, from, to] of EMENDATIONS) {
        if (book === bookId) out = out.split(from).join(to);
    }
    // 这几部底本「巳」「己」「已」不分，引文那边也归成一类再比
    if (CONFUSED_SI.has(bookId)) out = out.split('巳').join('己').split('已').join('己');
    return out;
}

/** 引文原文（按「……」切段）是否按先后出现在章节正文里；不在时返回出问题的那一段 */
export function matchQuote(original: string, chapterText: string, bookId: string): { ok: true } | { ok: false; segment: string; reordered: boolean } {
    const text = normalizeQuoteText(chapterText, bookId);
    let from = 0;
    for (const segment of original.split('……')) {
        const needle = normalizeQuoteText(segment, bookId);
        if (!needle) continue;
        const at = text.indexOf(needle, from);
        if (at >= 0) {
            from = at + needle.length;
            continue;
        }
        return { ok: false, segment, reordered: text.indexOf(needle) >= 0 };
    }
    return { ok: true };
}

/** 阅读器用：找出引文覆盖的连续段落起止序号（闭区间），找不到返回 null */
export function findQuoteParagraphRange(paragraphs: string[], quote: string, bookId: string): { start: number; end: number } | null {
    const needle = normalizeQuoteText(quote.split('……')[0], bookId);
    if (!needle) return null;
    const normalized = paragraphs.map((p) => normalizeQuoteText(p, bookId));
    const exact = normalized.findIndex((p) => p.includes(needle));
    if (exact >= 0) return { start: exact, end: exact };
    // 引文跨段时，按拼接正文精确定位起止段落，不因首段字短漏配
    let joined = '';
    const spans: Array<{ start: number; end: number }> = [];
    for (const p of normalized) {
        const start = joined.length;
        joined += p;
        spans.push({ start, end: joined.length });
    }
    const at = joined.indexOf(needle);
    if (at < 0) return null;
    const finish = at + needle.length;
    let startIdx = -1;
    let endIdx = -1;
    for (let i = 0; i < spans.length; i++) {
        if (spans[i].end > at && startIdx < 0) startIdx = i;
        if (spans[i].start < finish) endIdx = i;
    }
    return startIdx >= 0 && endIdx >= startIdx ? { start: startIdx, end: endIdx } : null;
}

/** 阅读器用：找出引文所在的起始段落序号，找不到返回 -1 */
export function findQuoteParagraph(paragraphs: string[], quote: string, bookId: string): number {
    return findQuoteParagraphRange(paragraphs, quote, bookId)?.start ?? -1;
}
