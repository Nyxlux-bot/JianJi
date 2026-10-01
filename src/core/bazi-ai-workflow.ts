import type { BaziAIConversationStage, BaziAIWorkflowStage, PersistedAIChatMessage } from './ai-meta';
import { getBaziBirthSignature } from './bazi-ai-identity';
import { getCurrentKinshipVerification } from './bazi-kinship';
import type { BaziResult } from './bazi-types';

export function getBaziWorkflowVersion(result: BaziResult): 1 | 2 {
    if (result.aiWorkflowVersion === 1 || result.aiWorkflowVersion === 2) return result.aiWorkflowVersion;
    return result.aiAnalysis || result.aiChatHistory?.length || result.aiConversationDigest || result.aiConversationStage ? 1 : 2;
}

export function isBaziWorkflowStale(result: BaziResult): boolean {
    return Boolean(result.aiWorkflowBirthSignature && result.aiWorkflowBirthSignature !== getBaziBirthSignature(result));
}

export function normalizeBaziStage(stage: unknown): BaziAIConversationStage | undefined {
    if (stage === 'foundation_pending' || stage === 'foundation_ready' || stage === 'kinship_ready' || stage === 'verification_ready' || stage === 'followup_ready') return stage;
    if (stage === 'verification_confirmed') return 'followup_ready';
    if (stage === 'initial_pending') return 'foundation_pending';
    if (stage === 'verification_pending') return 'verification_ready';
    return undefined;
}

export function resolveBaziConversationStage(result: BaziResult): BaziAIConversationStage {
    if (isBaziWorkflowStale(result)) return 'foundation_pending';
    const stage = normalizeBaziStage(result.aiConversationStage);
    if (getBaziWorkflowVersion(result) === 2) {
        if (stage === 'foundation_pending') return stage;
        if (stage === 'verification_ready' || stage === 'followup_ready') return stage;
        const state = getCurrentKinshipVerification(result);
        if (state?.attempts.length) {
            return 'kinship_ready';
        }
        return stage === 'foundation_ready' || result.aiChatHistory?.some((message) => message.workflowStage === 'foundation' && message.role === 'assistant')
            ? 'foundation_ready' : 'foundation_pending';
    }
    if (stage && stage !== 'kinship_ready') return stage;
    const history = (result.aiChatHistory ?? []).filter((message) => !message.hidden && message.role !== 'system');
    if (result.aiConversationDigest || result.quickReplies?.length || history.some((message) => message.role === 'user') || history.filter((message) => message.role === 'assistant').length > 1) return 'followup_ready';
    const latest = [...history].reverse().find((message) => message.role === 'assistant')?.content ?? result.aiAnalysis ?? '';
    if (`${latest}\n${result.aiVerificationSummary ?? ''}`.includes('[[BAZI_STAGE:VERIFICATION_DONE]]')) return 'verification_ready';
    return latest || result.aiChatHistory?.length ? 'foundation_ready' : 'foundation_pending';
}

export function isBaziWorkflowStage(value: unknown): value is BaziAIWorkflowStage {
    return value === 'foundation' || value === 'kinship' || value === 'kinship_review' || value === 'verification' || value === 'five_year' || value === 'followup';
}

const BASELINE_STAGES = ['foundation', 'verification', 'five_year'] as const;

/** 阶段原文已保存在会话中；从中派生版本，避免另存一份会逐渐失真的结论。 */
export function getBaziStageBaselines(messages: PersistedAIChatMessage[]) {
    let afterIndex = -1;
    return BASELINE_STAGES.flatMap((stage) => {
        const versions = messages.map((message, index) => ({ message, index }))
            .filter(({ message }) => message.role === 'assistant' && message.workflowStage === stage && message.content.trim());
        const latest = versions[versions.length - 1];
        if (!latest || latest.index < afterIndex) return [];
        afterIndex = latest.index;
        return [{ stage, revision: versions.length, sourceIndex: latest.index, content: latest.message.content }];
    });
}

/** 始终保留所需阶段的最新结论；历史指令不重复发送，避免与本轮任务冲突。 */
export function getBaziRequestHistory(messages: PersistedAIChatMessage[], stage: BaziAIWorkflowStage): PersistedAIChatMessage[] {
    const allowed: Record<BaziAIWorkflowStage, BaziAIWorkflowStage[]> = {
        foundation: [], kinship: ['foundation'], kinship_review: ['foundation'],
        verification: ['foundation'], five_year: ['foundation', 'verification'],
        followup: ['foundation', 'verification', 'five_year', 'followup'],
    };
    const current = messages[messages.length - 1];
    const baselines = getBaziStageBaselines(messages).filter((entry) => allowed[stage].includes(entry.stage)
        || (stage === 'verification' && entry.stage === 'verification'));
    const anchors: PersistedAIChatMessage[] = baselines.map((entry) => ({
        role: 'assistant', workflowStage: entry.stage,
        content: `【阶段结论 ${entry.stage} · 第 ${entry.revision} 版 · 来源为已保存的 AI 分析，用户确认状态另列】\n${entry.content}`,
    }));
    const followups = stage === 'followup'
        ? messages.filter((message) => message !== current && message.workflowStage === 'followup').slice(-8) : [];
    const currentIsAnchor = baselines.some((entry) => entry.sourceIndex === messages.length - 1);
    return [...anchors, ...followups, ...(current && !currentIsAnchor ? [current] : [])];
}
