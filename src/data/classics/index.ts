/**
 * 书阁典籍：书目与篇目随包内置（index.json），正文按资源打包、打开时才读（books/*.book）。
 * 数据由 scripts/build-classics.py 生成，每部书的底本写在 source 里。
 */
import { Platform } from 'react-native';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import index from './index.json';
import { BOOK_FILES } from './books';

export type ClassicArt = 'shan' | 'yi' | 'ming' | 'xiang' | 'bu';

export interface ClassicChapterMeta {
    id: string;
    title: string;
    volume?: string;
    charCount: number;
}

export interface ClassicBookMeta {
    id: string;
    title: string;
    author: string;
    dynasty: string;
    art: ClassicArt;
    charCount: number;
    /** 底本：殆知阁 / 维基文库 / 原书阁数据；note 是对底本的说明（如未校订、已删今人注） */
    source: { kind: string; ref: string[]; url?: string; note?: string };
    chapters: ClassicChapterMeta[];
}

export interface ClassicChapter {
    id: string;
    title: string;
    volume?: string;
    text: string;
}

export const CLASSIC_BOOKS = index as ClassicBookMeta[];

/** 五术五卷，按山医命相卜的传统次序 */
export const CLASSIC_ARTS: Array<{ key: ClassicArt; ch: string; cap: string; juan: string; title: string; desc: string }> = [
    { key: 'shan', ch: '山', cap: '修身', juan: '卷一', title: '修身养性', desc: '丹道 · 导引 · 养生，以修心炼形为本' },
    { key: 'yi', ch: '医', cap: '方脉', juan: '卷二', title: '方脉针灸', desc: '医经 · 方剂 · 本草 · 针灸，察病于未形' },
    { key: 'ming', ch: '命', cap: '推命', juan: '卷三', title: '推命知运', desc: '四柱 · 格局 · 用神 · 星曜，由生辰推一生' },
    { key: 'xiang', ch: '相', cap: '观形', juan: '卷四', title: '观形察气', desc: '人相 · 地相，由形见神' },
    { key: 'bu', ch: '卜', cap: '占筮', juan: '卷五', title: '占筮决疑', desc: '易占 · 纳甲 · 梅花，因事起卦' },
];

export function getClassicBookMeta(bookId: string): ClassicBookMeta | undefined {
    return CLASSIC_BOOKS.find((book) => book.id === bookId);
}

// 只留最近打开的一部在内存里：本草纲目一部就有几 MB
let cached: { id: string; chapters: Promise<ClassicChapter[]> } | null = null;

/** 读入一部书的正文；书目里没有这部书时返回 null */
export function loadClassicChapters(bookId: string): Promise<ClassicChapter[] | null> {
    const file = BOOK_FILES[bookId];
    if (!file) return Promise.resolve(null);
    if (cached?.id !== bookId) {
        const chapters = readAsset(file).then((raw) => (JSON.parse(raw) as { chapters: ClassicChapter[] }).chapters);
        chapters.catch(() => {
            if (cached?.id === bookId) cached = null;
        });
        cached = { id: bookId, chapters };
    }
    return cached.chapters;
}

async function readAsset(moduleId: number): Promise<string> {
    const asset = Asset.fromModule(moduleId);
    if (Platform.OS === 'web') {
        const response = await fetch(asset.uri);
        if (!response.ok) throw new Error(`读取典籍失败：${response.status}`);
        return response.text();
    }
    await asset.downloadAsync();
    return FileSystem.readAsStringAsync(asset.localUri ?? asset.uri, { encoding: FileSystem.EncodingType.UTF8 });
}
