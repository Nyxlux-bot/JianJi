import type { BaziAIWorkflowStage, PersistedAIChatMessage } from '../../core/ai-meta';

/**
 * Groups a conversation into the chapters (卷) the AI page shows. Pure: the
 * page passes its messages and job state and renders what comes back.
 */
export type AIPageEngine = 'liuyao' | 'bazi' | 'ziwei' | 'baziCompatibility';
export type ChapterId = 'foundation' | 'verification' | 'five_year' | 'followup' | 'compat' | 'liuyao';
export type ChapterStatus = 'todo' | 'running' | 'done' | 'failed';

export interface ChapterMessage extends PersistedAIChatMessage {
    uiId: string;
    pending?: boolean;
}

export interface ChapterItem<M extends ChapterMessage = ChapterMessage> {
    message: M;
    /** Stage the message was written for; 'kinship' items live inside 卷一. */
    stage: BaziAIWorkflowStage | 'compat' | 'liuyao';
    /** An older verification replaced by a newer one. */
    superseded?: boolean;
    /** The assistant text currently being written. */
    streaming?: boolean;
}

export interface Chapter<M extends ChapterMessage = ChapterMessage> {
    id: ChapterId;
    no: string;
    title: string;
    short: string;
    status: ChapterStatus;
    items: ChapterItem<M>[];
}

export interface ChapterJobInfo {
    active: boolean;
    failed: boolean;
    expectedCompletion?: string;
    phase?: 'initial' | 'followup';
}

const CHAPTER_META: Record<ChapterId, { title: string; short: string }> = {
    foundation: { title: '基础定局', short: '定局' },
    verification: { title: '前事核验', short: '核验' },
    five_year: { title: '今年与未来五年', short: '五年' },
    followup: { title: '专题追问', short: '追问' },
    compat: { title: '合盘详批', short: '详批' },
    liuyao: { title: '卦象解读', short: '解卦' },
};

const NUMERALS = ['一', '二', '三', '四'];

export function getChapterOrder(engine: AIPageEngine): ChapterId[] {
    if (engine === 'baziCompatibility') return ['compat'];
    if (engine === 'liuyao') return ['liuyao', 'followup'];
    return ['foundation', 'verification', 'five_year', 'followup'];
}

function chapterOfStage(engine: AIPageEngine, stage: ChapterItem['stage']): ChapterId {
    if (engine === 'baziCompatibility') return 'compat';
    if (stage === 'liuyao') return 'liuyao';
    if (stage === 'foundation' || stage === 'kinship' || stage === 'kinship_review') return 'foundation';
    if (stage === 'verification' || stage === 'five_year') return stage;
    return 'followup';
}

/** Chapter a running or failed job writes into. */
export function getJobChapter(engine: AIPageEngine, job: Pick<ChapterJobInfo, 'expectedCompletion' | 'phase'>): ChapterId {
    if (engine === 'baziCompatibility') return 'compat';
    if (engine === 'liuyao') return job.phase === 'initial' ? 'liuyao' : 'followup';
    const stage = job.expectedCompletion;
    if (stage === 'foundation' || stage === 'kinship' || stage === 'kinship_review') return 'foundation';
    if (stage === 'verification' || stage === 'five_year') return stage;
    return 'followup';
}

const POSITIONAL_STAGES: BaziAIWorkflowStage[] = ['foundation', 'verification', 'five_year'];

/**
 * Stage for each message. Bazi v2 messages carry workflowStage (a streaming
 * draft inherits it from the request before it); older Bazi and Ziwei
 * conversations are positional: 1st reply 定局, 2nd 核验, 3rd 五年, then 追问.
 */
function assignStages<M extends ChapterMessage>(engine: AIPageEngine, messages: M[]): Array<ChapterItem<M>['stage']> {
    if (engine === 'baziCompatibility') return messages.map(() => 'compat');
    let assistantCount = 0;
    let lastUserStage: BaziAIWorkflowStage | undefined;
    return messages.map((message) => {
        if (engine === 'liuyao') {
            if (message.role === 'assistant') assistantCount += 1;
            return message.role === 'assistant' ? (assistantCount === 1 ? 'liuyao' : 'followup') : (assistantCount === 0 ? 'liuyao' : 'followup');
        }
        if (message.workflowStage) {
            if (message.role === 'user') lastUserStage = message.workflowStage;
            return message.workflowStage;
        }
        if (lastUserStage) return lastUserStage;
        const stage = POSITIONAL_STAGES[assistantCount] ?? 'followup';
        if (message.role === 'assistant') assistantCount += 1;
        return stage;
    });
}

export function deriveChapters<M extends ChapterMessage>(
    engine: AIPageEngine,
    messages: M[],
    job: ChapterJobInfo | null,
): Chapter<M>[] {
    const visible = messages.filter((message) => message.role !== 'system' && !message.pending);
    const stages = assignStages(engine, visible);
    const order = getChapterOrder(engine);
    const byId = new Map<ChapterId, ChapterItem<M>[]>(order.map((id) => [id, []]));
    visible.forEach((message, index) => {
        if (message.hidden || !message.content.trim()) return;
        byId.get(chapterOfStage(engine, stages[index]))?.push({ message, stage: stages[index] });
    });

    // Only the newest verification is the live one; earlier versions stay readable but folded.
    const verification = byId.get('verification');
    if (verification) {
        const replies = verification.filter((item) => item.message.role === 'assistant');
        replies.slice(0, -1).forEach((item) => { item.superseded = true; });
    }

    const jobChapter = job && (job.active || job.failed) ? getJobChapter(engine, job) : null;
    if (job?.active && jobChapter) {
        const items = byId.get(jobChapter) ?? [];
        const last = items[items.length - 1];
        if (last?.message.role === 'assistant') last.streaming = true;
    }

    return order.map((id, index) => {
        const items = byId.get(id) ?? [];
        const hasReply = items.some((item) => item.message.role === 'assistant' && !item.superseded);
        const status: ChapterStatus = jobChapter === id
            ? (job?.active ? 'running' : 'failed')
            : hasReply ? 'done' : 'todo';
        return {
            id, no: `卷${NUMERALS[index] ?? index + 1}`, ...CHAPTER_META[id],
            ...(engine === 'ziwei' && id === 'foundation' ? { title: '基础命盘', short: '命盘' } : {}),
            status, items,
        };
    });
}
