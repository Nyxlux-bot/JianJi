import ichingData from '../../data/iching.json';
import xiangData from '../../data/ichuan/xiang.json';
import type { MeihuaHexagram } from './types';

interface IchingEntry {
    id: number;
    name: string;
    array: number[];
    scripture: string;
    lines: Array<{ name: string; scripture: string }>;
}

const XIANG = xiangData as Record<string, string>;
const BY_LINES = new Map((ichingData as IchingEntry[]).map((entry) => [entry.array.join(''), entry]));

export interface MeihuaHexagramText {
    /** 卦辞 */
    scripture: string;
    /** 大象 */
    xiang: string;
}

export interface MeihuaLineText {
    /** 爻题，如「六五」 */
    name: string;
    scripture: string;
    /** 小象 */
    xiang: string;
}

export function getHexagramText(hexagram: MeihuaHexagram): MeihuaHexagramText {
    const entry = BY_LINES.get(hexagram.lines.join(''));
    return { scripture: entry?.scripture || '', xiang: entry ? XIANG[`iching__${entry.id}`] || '' : '' };
}

export function getLineText(hexagram: MeihuaHexagram, line: number): MeihuaLineText {
    const entry = BY_LINES.get(hexagram.lines.join(''));
    const item = entry?.lines[line - 1];
    return {
        name: item?.name || '',
        scripture: item?.scripture || '',
        xiang: entry ? XIANG[`iching__${entry.id}_${line}`] || '' : '',
    };
}
