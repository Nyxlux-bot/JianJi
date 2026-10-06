import { COMPAT_CONTRACT, FIVE_YEAR_CONTRACT, VERIFICATION_CONTRACT, type ChapterFieldContract } from '../output-contracts';

/**
 * Reads structure out of a finished (or streaming) chapter. Never rejects:
 * anything that is not recognised stays in a `markdown` segment, in order, so
 * joining every segment's `raw` text gives back the original content.
 */
export type ChapterLayoutKind = 'verification' | 'five_year' | 'compat';

export type VerificationFieldKey = ChapterFieldContract['key'];

export interface MarkdownSegment { type: 'markdown'; raw: string; text: string }
export interface EventSegment {
    type: 'event'; raw: string; open: boolean;
    year: number; ganZhi?: string; age?: string; summary: string;
    fields: Partial<Record<VerificationFieldKey, string>>;
    /** Text inside the block that did not belong to a field. */
    extra: string;
}
export interface YearSegment {
    type: 'year'; raw: string; open: boolean;
    year: number; ganZhi?: string; tag: string; body: string;
}
export interface StrategySegment { type: 'strategy'; raw: string; open: boolean; title: string; body: string }
export interface SectionSegment {
    type: 'section'; raw: string; open: boolean;
    title: string; lead: string; body: string;
}
export type ChapterSegment = MarkdownSegment | EventSegment | YearSegment | StrategySegment | SectionSegment;

export interface ChapterLayout {
    kind: ChapterLayoutKind;
    segments: ChapterSegment[];
    /** Recognised blocks; used for diagnostics, never for gating. */
    blockCount: number;
}

const GAN_ZHI = /[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]/u;
const HEADING = /^(#{2,4})\s+(.+?)\s*#*\s*$/u;
const BOLD_LINE = /^\*\*(.+?)\*\*\s*$/u;
const SEPARATOR = /\s*[·•・|｜/／]\s*|\s+[-—–]\s+/u;
const YEAR_START = /^(?:[一二三四五六七八九十\d]+[.)、．]\s*)?(?:今年\s*[（(]?\s*)?((?:19|20|21)\d{2})\s*年?\s*[）)]?/u;
const FENCE = /^\s*(```|~~~)/u;

interface RawBlock { heading: string | null; title: string; lines: string[] }

function cleanTitle(text: string): string {
    return text.replace(/\*\*|__/g, '').replace(/^[#>\s]+/, '').trim();
}

/** A whole-line bold text counts as a block title only when it looks like one. */
function isBoldTitle(title: string): boolean {
    return YEAR_START.test(title)
        || GAN_ZHI_THEN_YEAR.test(title)
        || title.includes(FIVE_YEAR_CONTRACT.strategyTitle)
        || COMPAT_CONTRACT.sections.some((section) => title.includes(section));
}

/** Split into blocks at level 2-4 headings (or whole-line bold titles), skipping fenced code. */
function splitBlocks(content: string): RawBlock[] {
    const blocks: RawBlock[] = [{ heading: null, title: '', lines: [] }];
    let inFence = false;
    for (const line of content.split('\n')) {
        if (FENCE.test(line)) inFence = !inFence;
        const bold = BOLD_LINE.exec(line.trim());
        const heading = inFence ? null : (HEADING.exec(line) ?? (bold && isBoldTitle(cleanTitle(bold[1])) ? bold : null));
        if (heading) {
            const title = cleanTitle(heading[heading.length - 1]);
            blocks.push({ heading: line, title, lines: [] });
            continue;
        }
        blocks[blocks.length - 1].lines.push(line);
    }
    return blocks;
}

function blockRaw(block: RawBlock): string {
    return [block.heading, ...block.lines].filter((line) => line !== null).join('\n');
}

const GAN_ZHI_THEN_YEAR = /^([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])\s*年?\s*[（(]\s*((?:19|20|21)\d{2})\s*年?\s*[）)]/u;

function parseYearTitle(title: string): { year: number; ganZhi?: string; rest: string[] } | null {
    const reversed = GAN_ZHI_THEN_YEAR.exec(title);
    if (reversed) {
        const rest = title.slice(reversed[0].length).split(SEPARATOR).map((part) => part.replace(/^[：:]\s*/, '').trim()).filter(Boolean);
        return { year: Number(reversed[2]), ganZhi: reversed[1], rest };
    }
    const match = YEAR_START.exec(title);
    if (!match) return null;
    let rest = title.slice(match[0].length).trim();
    let ganZhi: string | undefined;
    const ganZhiMatch = /^[（(]?\s*([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])\s*(?:年)?\s*[）)]?/u.exec(rest);
    if (ganZhiMatch) {
        ganZhi = ganZhiMatch[1];
        rest = rest.slice(ganZhiMatch[0].length).trim();
    }
    const parts = rest.split(SEPARATOR).map((part) => part.replace(/^[：:]\s*/, '').trim()).filter(Boolean);
    if (!ganZhi) {
        const index = parts.findIndex((part) => GAN_ZHI.test(part) && part.length <= 4);
        if (index !== -1) ganZhi = GAN_ZHI.exec(parts.splice(index, 1)[0])?.[0];
    }
    return { year: Number(match[1]), ganZhi, rest: parts };
}

const FIELD_LABELS = VERIFICATION_CONTRACT.fields.flatMap((field) =>
    [field.label, ...field.aliases].map((label) => ({ key: field.key, label })),
).sort((left, right) => right.label.length - left.label.length);

function matchField(line: string): { key: VerificationFieldKey; text: string } | null {
    const trimmed = line.trim().replace(/^[-*•]\s+/, '');
    for (const { key, label } of FIELD_LABELS) {
        const pattern = new RegExp(`^(?:\\*\\*|__)?${label}(?:\\*\\*|__)?\\s*[：:]\\s*(?:\\*\\*|__)?\\s*(.*)$`, 'u');
        const match = pattern.exec(trimmed);
        if (match) return { key, text: match[1].trim() };
    }
    return null;
}

function parseEventBody(lines: string[]): { fields: EventSegment['fields']; extra: string; trailing: string[] } {
    const fields: EventSegment['fields'] = {};
    const extra: string[] = [];
    const fieldCount = VERIFICATION_CONTRACT.fields.length;
    let current: VerificationFieldKey | null = null;
    let index = 0;
    for (; index < lines.length; index += 1) {
        const line = lines[index];
        const field = matchField(line);
        if (field && fields[field.key] === undefined) {
            current = field.key;
            fields[current] = field.text;
            continue;
        }
        if (current && line.trim()) {
            fields[current] = [fields[current], line.trim()].filter(Boolean).join('\n');
            continue;
        }
        if (!line.trim()) {
            current = null;
            // Once every field is filled, a paragraph after a blank line is
            // the chapter's closing remark rather than part of this event.
            if (Object.keys(fields).length === fieldCount) break;
            continue;
        }
        extra.push(line);
    }
    return { fields, extra: extra.join('\n').trim(), trailing: lines.slice(index) };
}

function markdown(raw: string): MarkdownSegment {
    return { type: 'markdown', raw, text: raw.trim() };
}

function firstSentence(body: string): { lead: string; body: string } {
    const trimmed = body.trim();
    const paragraphEnd = trimmed.search(/\n\s*\n/);
    const firstParagraph = paragraphEnd === -1 ? trimmed : trimmed.slice(0, paragraphEnd);
    const match = /^[^。！？!?\n]*[。！？!?](?:\*\*|__)?/u.exec(firstParagraph);
    if (!match || match[0].length > 64 || /^(?:[-*•]\s|\d+[.)、])/.test(firstParagraph)) return { lead: '', body: trimmed };
    return { lead: match[0].replace(/\*\*|__/g, '').trim(), body: trimmed.slice(match[0].length).trim() };
}

function toSegments(kind: ChapterLayoutKind, block: RawBlock, open: boolean): ChapterSegment[] {
    const raw = blockRaw(block);
    if (block.heading === null) return [markdown(raw)];
    const body = block.lines.join('\n').trim();

    if (kind === 'verification') {
        const parsed = parseYearTitle(block.title);
        if (!parsed) return [markdown(raw)];
        const ageIndex = parsed.rest.findIndex((part) => /^(?:虚岁\s*)?\d{1,3}\s*岁?$|^\d{1,3}\s*岁|^虚岁/u.test(part));
        const age = ageIndex === -1 ? undefined : parsed.rest.splice(ageIndex, 1)[0].replace(/\s+/g, '');
        const { fields, extra, trailing } = parseEventBody(block.lines);
        const event: EventSegment = {
            type: 'event', raw: blockRaw({ ...block, lines: block.lines.slice(0, block.lines.length - trailing.length) }),
            open, year: parsed.year, ganZhi: parsed.ganZhi,
            age: age && /^\d+$/.test(age) ? `${age}岁` : age,
            summary: parsed.rest.join(' · '), fields, extra,
        };
        return trailing.length ? [event, markdown(trailing.join('\n'))] : [event];
    }

    if (kind === 'five_year') {
        if (block.title.includes(FIVE_YEAR_CONTRACT.strategyTitle)) {
            return [{ type: 'strategy', raw, open, title: block.title, body }];
        }
        const parsed = parseYearTitle(block.title);
        if (!parsed) return [markdown(raw)];
        return [{ type: 'year', raw, open, year: parsed.year, ganZhi: parsed.ganZhi, tag: parsed.rest.join(' · '), body }];
    }

    const title = COMPAT_CONTRACT.sections.find((section) => block.title.includes(section));
    if (!title) return [markdown(raw)];
    return [{ type: 'section', raw, open, title, ...firstSentence(body) }];
}

/** Merge consecutive markdown segments so unrecognised text reads as one passage. */
function mergeMarkdown(segments: ChapterSegment[]): ChapterSegment[] {
    const merged: ChapterSegment[] = [];
    for (const segment of segments) {
        const previous = merged[merged.length - 1];
        if (segment.type === 'markdown' && previous?.type === 'markdown') {
            merged[merged.length - 1] = markdown(`${previous.raw}\n${segment.raw}`);
        } else {
            merged.push(segment);
        }
    }
    return merged.filter((segment) => segment.type !== 'markdown' || segment.text);
}

/**
 * @param complete false while streaming: the last block is marked `open` so the
 * UI can render it as still being written.
 */
export function parseChapter(kind: ChapterLayoutKind, content: string, complete = true): ChapterLayout {
    const blocks = splitBlocks(content);
    const segments = mergeMarkdown(blocks.flatMap((block, index) =>
        toSegments(kind, block, !complete && index === blocks.length - 1)));
    const blockCount = segments.filter((segment) => segment.type !== 'markdown').length;
    return { kind, segments, blockCount };
}

/** Diagnostics: share of recognised blocks against the contract's expectation. */
export function getChapterLayoutStats(layout: ChapterLayout): { recognized: number; leftoverChars: number } {
    return {
        recognized: layout.blockCount,
        leftoverChars: layout.segments
            .filter((segment): segment is MarkdownSegment => segment.type === 'markdown')
            .reduce((sum, segment) => sum + segment.text.length, 0),
    };
}
