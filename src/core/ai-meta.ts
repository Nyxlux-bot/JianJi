export type PersistedAIChatRole = 'system' | 'user' | 'assistant';
export type BaziAIConversationStage = 'foundation_pending' | 'foundation_ready' | 'verification_ready' | 'followup_ready';

export interface PersistedAIChatMessage {
    role: PersistedAIChatRole;
    content: string;
    hidden?: boolean;
    requestContent?: string;
}

export interface BaziAIConversationFoundation {
    dayMaster: string;
    structure: string;
    favorableGod: string;
    unfavorableGod: string;
    personality: string;
}

export interface BaziAIConversationDigest {
    version: number;
    generatedAt: string;
    foundation: BaziAIConversationFoundation;
    verificationSummary: string;
    fiveYearSummary: string;
    rollingSummary: string;
    topicNotes: Record<string, string>;
}
