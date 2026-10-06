/**
 * Display-only reflow: breaks an over-long prose paragraph at sentence ends so
 * a model that writes a whole section as one block still reads in paragraphs.
 * Headings, lists, quotes, tables and fenced code pass through untouched, and
 * the stored message text is never changed.
 */
const LONG_PARAGRAPH = 200;
const TARGET_CHUNK = 110;
const MIN_TAIL = 40;

const FENCE = /^\s*(```|~~~)/u;
const NON_PROSE = /^\s*(?:#{1,6}\s|>|[-*+]\s|\d+[.)、]\s?|\|)/u;
// A sentence, plus closing quotes and a trailing [盘据] citation that belong to it.
const SENTENCE = /[^。！？!?]*[。！？!?]+[”’」』）)]*(?:\s*\[[^\]\n]{1,24}\])?|[^。！？!?]+$/gu;

function splitLongLine(line: string): string[] {
    const sentences = line.match(SENTENCE) ?? [line];
    const chunks: string[] = [];
    let current = '';
    sentences.forEach((sentence, index) => {
        current += sentence;
        const rest = sentences.slice(index + 1).join('').length;
        // Never break inside **bold**: the marker count must be even.
        const balanced = (current.match(/\*\*/g)?.length ?? 0) % 2 === 0;
        if (current.length >= TARGET_CHUNK && rest >= MIN_TAIL && balanced) {
            chunks.push(current.trim());
            current = '';
        }
    });
    if (current.trim()) chunks.push(current.trim());
    return chunks;
}

export function reflowLongParagraphs(content: string): string {
    if (content.length < LONG_PARAGRAPH) return content;
    let inFence = false;
    return content.split('\n').map((line) => {
        if (FENCE.test(line)) inFence = !inFence;
        if (inFence || line.length < LONG_PARAGRAPH || NON_PROSE.test(line)) return line;
        return splitLongLine(line).join('\n\n');
    }).join('\n');
}
