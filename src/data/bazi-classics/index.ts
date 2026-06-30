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
