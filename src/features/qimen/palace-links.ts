import { QIMEN_PALACES } from './data';
import { QIMEN_PERIODS } from './types';

const targets = new Map<string, string>();
for (const [index, period] of QIMEN_PERIODS.entries()) {
    for (const palace of QIMEN_PALACES) {
        targets.set(period + '·' + palace.name + '宫', `qimen://palace/${palace.number}?period=${index}`);
    }
}

// 新回复只给中文引用；旧回复中的地址可能和文字不一致，以读者看到的盘名、宫名为准。
const CITATION = /【([^【】\n]+)】|\[([^\]\n]+)\]\s*\((qimen:[^)\s]*)(?:\)|$)|<?(qimen:\/\/palace\/[1-9](?:\?period=[0-3])?)(?![\w/?=&%-])>?/gu;
const ADDRESS = /^qimen:\/\/palace\/([1-9])(?:\?period=([0-3]))?$/u;

export function linkQimenPalaces(text: string): string {
    return text.replace(CITATION, (original, marker?: string, oldLabel?: string, oldUrl?: string, bareUrl?: string) => {
        const label = (marker ?? oldLabel ?? '').replace(/\s*·\s*/gu, '·').trim();
        const namedTarget = targets.get(label);
        if (namedTarget) return `[${label}](${namedTarget})`;
        if (marker) return original;
        const address = ADDRESS.exec(oldUrl ?? bareUrl ?? '');
        if (!address) return oldLabel ?? original;
        const period = QIMEN_PERIODS[Number(address[2] ?? 3)];
        if (oldLabel) {
            const legacyTarget = targets.get(period + '·' + label);
            return legacyTarget ? `[${oldLabel}](${legacyTarget})` : original;
        }
        const palace = QIMEN_PALACES[Number(address[1]) - 1];
        return `[${period}·${palace.name}宫](${address[0]})`;
    });
}

export function qimenCitationText(text: string): string {
    return linkQimenPalaces(text).replace(/\[([^\]\n]+)\]\(qimen:[^)]*\)/gu, '【$1】');
}

// 旧回复有时只有宫名。仅给盘别明确的段落补引用，跨盘比较必须由作者指明落点。
export function annotateQimenPassages(text: string, initialPeriod?: typeof QIMEN_PERIODS[number]): string {
    let period = initialPeriod;
    return text.split(/(\n\s*\n)/u).map(block => {
        const heading = /^\s*#{1,4}\s+(总断|[年月日时]盘)(?=\s|$|[·：:])/u.exec(block);
        if (heading) period = QIMEN_PERIODS.find(p => p === heading[1]);
        if (block.includes('【') || /qimen:\/\/|另.{0,2}盘|两盘|跨盘|四盘/u.test(block)) return block;
        const named = QIMEN_PERIODS.filter(p => block.includes(p));
        if (named.length > 1 || (period && named.length && named[0] !== period)) return block;
        const scope = named[0] ?? period;
        if (!scope) return block;
        const names = QIMEN_PALACES.filter(p => block.includes(p.name + '宫'));
        if (!names.length) return block;
        return block + ' ' + names.map(p => '【' + scope + '·' + p.name + '宫】').join('');
    }).join('');
}
