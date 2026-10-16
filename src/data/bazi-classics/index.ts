import booksIndex from './books-index.json';
import type { BaziClassicBook, BaziClassicBookMeta } from './types';

export type {
    BaziClassicBook,
    BaziClassicBookMeta,
    BaziClassicChapter,
    BaziClassicChapterMeta,
} from './types';

export const BAZI_CLASSIC_BOOK_INDEX = booksIndex as BaziClassicBookMeta[];

export function getBaziClassicBook(bookId: string): BaziClassicBook | null {
    switch (bookId) {
        case 'zipingzhenquan':
            return require('./books/zipingzhenquan.json') as BaziClassicBook;
        case 'ditiansuichanwei':
            return require('./books/ditiansuichanwei.json') as BaziClassicBook;
        case 'yuanhaiziping':
            return require('./books/yuanhaiziping.json') as BaziClassicBook;
        case 'minglitanyuan':
            return require('./books/minglitanyuan.json') as BaziClassicBook;
        default:
            return null;
    }
}

/**
 * 数据里的篇名带序号、书名后缀和「卷四」「赋论·一」等卷次，显示前拆开：
 * 「论十干十二支1」→ 论十干十二支；「论正官/论正官取运31-32」→ 论正官（附取运）；
 * 「论天干宜忌-卷四 - 命理探源-袁树珊(民国)」→ 论天干宜忌 + 卷四。
 */
export function getChapterLabel(rawTitle: string): { title: string; volume: string } {
    const base = rawTitle.replace(/\s+-\s+命理探源.*$/, '').replace(/\d+(-\d*)?$/, '');
    const merged = base.match(/^(.+)\/\1取运$/);
    if (merged) return { title: `${merged[1]}（附取运）`, volume: '' };
    const split = base.match(/^(.+)-((?:卷|赋论).+)$/);
    return split ? { title: split[1], volume: split[2] } : { title: base, volume: '' };
}

const stripHeading = (line: string) => line.replace(/^[一二三四五六七八九十百]+[．、.]\s*/, '').replace(/[《》\s]/g, '');

/** 正文按行分段；首行若只是重复篇名（如「一．论十干十二支」）则去掉。 */
export function getChapterParagraphs(chapter: { title: string; text: string }): string[] {
    const lines = chapter.text.split('\n').map((line) => line.trim()).filter(Boolean);
    const heading = stripHeading(lines[0] || '');
    const raw = chapter.title.replace(/\s+-\s+命理探源.*$/, '');
    const label = getChapterLabel(chapter.title);
    const repeats = [raw, raw.split('-')[0], label.title, label.title.replace(/（附取运）$/, '')].some((item) => stripHeading(item) === heading);
    return repeats && lines.length > 1 ? lines.slice(1) : lines;
}

if (__DEV__) {
    const cases: Array<[string, string, string]> = [
        ['论十干十二支1', '论十干十二支', ''],
        ['论正官/论正官取运31-32', '论正官（附取运）', ''],
        ['论天干宜忌-卷四 - 命理探源-袁树珊(民国)', '论天干宜忌', '卷四'],
        ['卷一 本原 - 命理探源-袁树珊(民国)', '卷一 本原', ''],
        ['子平举要歌-赋论·一', '子平举要歌', '赋论·一'],
        ['天道', '天道', ''],
    ];
    const bad = cases.filter(([raw, title, volume]) => {
        const got = getChapterLabel(raw);
        return got.title !== title || got.volume !== volume;
    });
    if (bad.length) console.error('[bazi-classics] 篇名清理自检失败', bad);
}
