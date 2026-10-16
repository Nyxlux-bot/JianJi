/** 书阁阅读进度：最近读的书、每本书读到的篇与位置，以及正文字号。只存本机。 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'learn_reading_v1';

export interface ReadingState {
    lastBookId?: string;
    books: Record<string, { chapterId: string; progress: number }>;
    /** 正文字号档位：0 小、1 中、2 大 */
    fontSize: number;
}

const EMPTY: ReadingState = { books: {}, fontSize: 1 };

export async function loadReadingState(): Promise<ReadingState> {
    try {
        const raw = await AsyncStorage.getItem(KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        return parsed && typeof parsed === 'object' && parsed.books ? { ...EMPTY, ...parsed } : EMPTY;
    } catch {
        return EMPTY;
    }
}

export async function saveReadingState(state: ReadingState): Promise<void> {
    try {
        await AsyncStorage.setItem(KEY, JSON.stringify(state));
    } catch {
        // 进度丢了只影响「继续阅读」，不打断阅读
    }
}
