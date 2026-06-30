export interface BaziClassicChapterMeta {
    id: string;
    title: string;
    charCount: number;
}

export interface BaziClassicBookMeta {
    id: string;
    title: string;
    author: string;
    dynasty: string;
    chapterCount: number;
    charCount: number;
    chapters: BaziClassicChapterMeta[];
}

export interface BaziClassicChapter {
    id: string;
    title: string;
    text: string;
}

export interface BaziClassicBook {
    id: string;
    title: string;
    author: string;
    dynasty: string;
    chapters: BaziClassicChapter[];
}
