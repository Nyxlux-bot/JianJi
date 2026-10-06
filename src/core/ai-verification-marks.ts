/**
 * Per-event feedback on 卷二 前事核验. Marks belong to one specific verification
 * text: `revision` is a hash of the saved verification content, so a newly
 * generated verification silently starts with no marks.
 */
export type AIVerificationMark = 'yes' | 'no' | 'unsure';

export interface AIVerificationMarkEntry {
    mark: AIVerificationMark;
    /** The event's one-line summary at the time it was marked, for prompts. */
    summary: string;
}

export interface AIVerificationMarks {
    revision: string;
    /** Keyed by event year. */
    marks: Record<string, AIVerificationMarkEntry>;
}

export const AI_VERIFICATION_MARK_LABELS: Record<AIVerificationMark, string> = {
    yes: '准',
    no: '不准',
    unsure: '记不清',
};

export function getVerificationRevision(content: string | undefined | null): string {
    const text = content?.trim() ?? '';
    let hash = 0x811c9dc5;
    for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return `${text.length}:${hash.toString(16).padStart(8, '0')}`;
}

function isMark(value: unknown): value is AIVerificationMark {
    return value === 'yes' || value === 'no' || value === 'unsure';
}

/** Drops malformed entries instead of rejecting the record. */
export function normalizeVerificationMarks(value: unknown): AIVerificationMarks | undefined {
    if (!value || typeof value !== 'object') return undefined;
    const candidate = value as { revision?: unknown; marks?: unknown };
    if (typeof candidate.revision !== 'string' || !candidate.marks || typeof candidate.marks !== 'object') return undefined;
    const marks = Object.fromEntries(Object.entries(candidate.marks as Record<string, unknown>).flatMap(([year, entry]) => {
        if (!/^\d{4}$/.test(year) || !entry || typeof entry !== 'object') return [];
        const { mark, summary } = entry as { mark?: unknown; summary?: unknown };
        return isMark(mark) ? [[year, { mark, summary: typeof summary === 'string' ? summary.slice(0, 80) : '' }]] : [];
    }));
    return { revision: candidate.revision, marks };
}

/** Marks that still belong to the saved verification text. */
export function getActiveVerificationMarks(result: {
    aiVerificationSummary?: string;
    aiVerificationMarks?: AIVerificationMarks;
}): Record<string, AIVerificationMarkEntry> {
    const stored = result.aiVerificationMarks;
    if (!stored || !result.aiVerificationSummary?.trim()) return {};
    return stored.revision === getVerificationRevision(result.aiVerificationSummary) ? stored.marks : {};
}

function describeMarks(marks: Record<string, AIVerificationMarkEntry>): string[] {
    return Object.entries(marks)
        .sort(([left], [right]) => Number(left) - Number(right))
        .map(([year, entry]) => `${year}${entry.summary ? `（${entry.summary}）` : ''}：${AI_VERIFICATION_MARK_LABELS[entry.mark]}`);
}

/** One-line visible feedback, e.g. "2015 准 · 2018 不准". */
export function formatVerificationMarksShort(marks: Record<string, AIVerificationMarkEntry>): string {
    return Object.entries(marks)
        .sort(([left], [right]) => Number(left) - Number(right))
        .map(([year, entry]) => `${year} ${AI_VERIFICATION_MARK_LABELS[entry.mark]}`)
        .join(' · ');
}

/** Context for 重新核验: what to avoid repeating and what to treat as known. */
export function buildVerificationRetryContext(marks: Record<string, AIVerificationMarkEntry>): string {
    const lines = describeMarks(marks);
    if (!lines.length) return '';
    return [
        '【用户对上一版前事核验的逐条标记】',
        ...lines,
        '标为“不准”的节点不要换个说法重复同一判断；标为“准”的作为已知背景，可以不再列出或换更有信息量的节点；“记不清”的可以换个角度保留。标记只是用户的回忆，不改动排盘事实。',
    ].join('\n');
}

/** Context for 五年 / 追问: user-confirmed and rejected past events. */
export function buildVerificationMarksContext(marks: Record<string, AIVerificationMarkEntry>): string {
    const lines = describeMarks(marks);
    if (!lines.length) return '';
    return [
        '【用户对前事核验的逐条标记】',
        ...lines,
        '“准”的节点可作为已发生的背景参考；“不准”的推断不要再当作依据。',
    ].join('\n');
}
