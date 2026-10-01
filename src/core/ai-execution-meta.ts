export const AI_REASONING_EFFORTS = ['minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const;
export type AIReasoningEffort = typeof AI_REASONING_EFFORTS[number];
export type AIReasoningSetting = 'default' | 'off' | 'budget' | AIReasoningEffort;
export type AIThinkingMode = 'unknown' | 'unsupported' | 'responses' | 'adaptive' | 'budget';

export interface AISkillVersion {
    id: string;
    version: number;
}

/** Public request provenance. Credentials and endpoint URLs never belong here. */
export interface AIExecutionMeta {
    providerId: string;
    providerName: string;
    model: string;
    protocol: 'responses' | 'anthropic_messages';
    reasoning: AIReasoningSetting;
    thinkingMode: AIThinkingMode;
    thinkingBudgetTokens?: number;
    temperature?: number;
    maxOutputTokens: number;
    skills: AISkillVersion[];
}

export function isAIReasoningEffort(value: unknown): value is AIReasoningEffort {
    return AI_REASONING_EFFORTS.some((effort) => effort === value);
}

export function isAIReasoningSetting(value: unknown): value is AIReasoningSetting {
    return value === 'default' || value === 'off' || value === 'budget' || isAIReasoningEffort(value);
}

export function isAIThinkingMode(value: unknown): value is AIThinkingMode {
    return value === 'unknown' || value === 'unsupported' || value === 'responses' || value === 'adaptive' || value === 'budget';
}

/** Import only known public fields, including when a backup contains extra properties. */
export function sanitizeAIExecutionMeta(value: unknown): AIExecutionMeta | undefined {
    if (!value || typeof value !== 'object') return undefined;
    const raw = value as Record<string, unknown>;
    if (typeof raw.providerId !== 'string' || typeof raw.providerName !== 'string' || typeof raw.model !== 'string'
        || (raw.protocol !== 'responses' && raw.protocol !== 'anthropic_messages')
        || !isAIReasoningSetting(raw.reasoning) || !isAIThinkingMode(raw.thinkingMode)
        || typeof raw.maxOutputTokens !== 'number' || !Number.isSafeInteger(raw.maxOutputTokens) || raw.maxOutputTokens <= 0
        || !Array.isArray(raw.skills)) return undefined;
    const skills: AISkillVersion[] = [];
    for (const item of raw.skills) {
        if (!item || typeof item !== 'object') return undefined;
        const skill = item as Record<string, unknown>;
        if (typeof skill.id !== 'string' || typeof skill.version !== 'number' || !Number.isSafeInteger(skill.version) || skill.version < 1) return undefined;
        skills.push({ id: skill.id, version: skill.version });
    }
    return {
        providerId: raw.providerId, providerName: raw.providerName, model: raw.model,
        protocol: raw.protocol, reasoning: raw.reasoning, thinkingMode: raw.thinkingMode,
        maxOutputTokens: raw.maxOutputTokens, skills,
        ...(typeof raw.thinkingBudgetTokens === 'number' && Number.isSafeInteger(raw.thinkingBudgetTokens) && raw.thinkingBudgetTokens >= 1024
            ? { thinkingBudgetTokens: raw.thinkingBudgetTokens } : {}),
        ...(typeof raw.temperature === 'number' && Number.isFinite(raw.temperature) && raw.temperature >= 0 && raw.temperature <= 2
            ? { temperature: raw.temperature } : {}),
    };
}
