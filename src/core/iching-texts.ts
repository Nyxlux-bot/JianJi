/** 卦辞、爻辞（iching.json）与彖传、大象、小象、文言（ichuan），按爻列（初爻→上爻，1 阳 0 阴）取用。 */
import ichingData from '../data/iching.json';
import tuanData from '../data/ichuan/tuan.json';
import wenData from '../data/ichuan/wen.json';
import xiangData from '../data/ichuan/xiang.json';
import { GUA_64, yaoToGuaIndex } from './liuyao-data';

type HexagramLines = { lines: number[] };

interface IchingEntry {
    id: number;
    name: string;
    array: number[];
    scripture: string;
    lines: Array<{ name: string; scripture: string }>;
}

const XIANG = xiangData as Record<string, string>;
const TUAN = tuanData as Record<string, string>;
const WEN = wenData as Record<string, string>;
const BY_LINES = new Map((ichingData as IchingEntry[]).map((entry) => [entry.array.join(''), entry]));

export interface HexagramEntry {
    /** 通行卦序 1-64 */
    id: number;
    /** 卦名，坎卦作「坎」而非数据里的「习坎」 */
    name: string;
    fullName: string;
    lines: number[];
    /** 上卦、下卦先天数 1-8 */
    upper: number;
    lower: number;
    scripture: string;
}

export const HEXAGRAMS: HexagramEntry[] = (ichingData as IchingEntry[]).map((entry) => {
    const [a, b, c, d, e, f] = entry.array;
    const lower = yaoToGuaIndex(a, b, c);
    const upper = yaoToGuaIndex(d, e, f);
    const gua = GUA_64[`${upper}-${lower}`];
    return { id: entry.id, name: gua.name, fullName: gua.fullName, lines: entry.array, upper, lower, scripture: entry.scripture };
});

export function findHexagramByLines(lines: number[]): HexagramEntry | undefined {
    const key = lines.join('');
    return HEXAGRAMS.find((item) => item.lines.join('') === key);
}

/** 彖传、大象、文言（仅乾坤）与全部爻辞小象；乾坤含用九、用六。缺文时为空串。 */
export function getHexagramClassics(id: number): { tuan: string; xiang: string; wen: string; lines: LineText[] } {
    const entry = (ichingData as IchingEntry[])[id - 1];
    return {
        tuan: TUAN[`iching__${id}`] || '',
        xiang: XIANG[`iching__${id}`] || '',
        wen: WEN[`iching__${id}`] || '',
        lines: (entry?.lines || []).map((line, index) => ({
            name: line.name,
            scripture: line.scripture,
            xiang: XIANG[`iching__${id}_${index + 1}`] || '',
        })),
    };
}

export interface HexagramText {
    /** 卦辞 */
    scripture: string;
    /** 大象 */
    xiang: string;
}

export interface LineText {
    /** 爻题，如「六五」 */
    name: string;
    scripture: string;
    /** 小象 */
    xiang: string;
}

export function getHexagramText(hexagram: HexagramLines): HexagramText {
    const entry = BY_LINES.get(hexagram.lines.join(''));
    return { scripture: entry?.scripture || '', xiang: entry ? XIANG[`iching__${entry.id}`] || '' : '' };
}

export function getLineText(hexagram: HexagramLines, line: number): LineText {
    const entry = BY_LINES.get(hexagram.lines.join(''));
    const item = entry?.lines[line - 1];
    return {
        name: item?.name || '',
        scripture: item?.scripture || '',
        xiang: entry ? XIANG[`iching__${entry.id}_${line}`] || '' : '',
    };
}
