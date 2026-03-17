export type PersistedAIChatRole = 'system' | 'user' | 'assistant';
export type AIConversationStage = 'foundation_pending' | 'foundation_ready' | 'verification_ready' | 'followup_ready';
export type BaziAIConversationStage = AIConversationStage;

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

export interface ZiweiAIConversationFoundation {
    lifeTheme: string;
    mingPalace: string;
    bodySoul: string;
    mutagenDynamics: string;
    personality: string;
}

export interface ZiweiAIConversationDigest {
    version: number;
    generatedAt: string;
    foundation: ZiweiAIConversationFoundation;
    verificationSummary: string;
    fiveYearSummary: string;
    rollingSummary: string;
    topicNotes: Record<string, string>;
    verificationTimeline?: string[];
    yearlyOutlook?: Record<string, string>;
    focusAnchors?: Record<string, string>;
}
