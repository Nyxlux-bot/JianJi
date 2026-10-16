/** 卦辞、爻辞（iching.json）与大象、小象（ichuan/xiang.json），按爻列（初爻→上爻，1 阳 0 阴）取用。 */
import ichingData from '../data/iching.json';
import xiangData from '../data/ichuan/xiang.json';

type HexagramLines = { lines: number[] };

interface IchingEntry {
    id: number;
    name: string;
    array: number[];
    scripture: string;
    lines: Array<{ name: string; scripture: string }>;
}

const XIANG = xiangData as Record<string, string>;
const BY_LINES = new Map((ichingData as IchingEntry[]).map((entry) => [entry.array.join(''), entry]));

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
