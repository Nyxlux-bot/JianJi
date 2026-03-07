export type BasicChatRole = 'system' | 'user' | 'assistant';

export interface BasicChatMessage {
    role: BasicChatRole;
    content: string;
    hidden?: boolean;
    requestContent?: string;
}

export interface RetryPlan<T extends BasicChatMessage> {
    baseMessages: T[];
    displayText: string;
    retryText: string;
}

export function shouldShowBaziFoundationRetryAction(
    stage: 'foundation_pending' | 'foundation_ready' | 'verification_ready' | 'followup_ready' | null,
    isLoading: boolean,
    messageCount: number,
    hasFoundationAttempted: boolean,
): boolean {
    return stage === 'foundation_pending'
        && !isLoading
        && (messageCount > 0 || hasFoundationAttempted);
}

export function getLastAssistantContent<T extends BasicChatMessage>(messages: T[]): string | null {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
        const message = messages[i];
        if (message.role === 'assistant' && message.content.trim()) {
            return message.content;
        }
    }
    return null;
}

export function buildRetryPlan<T extends BasicChatMessage>(messages: T[]): RetryPlan<T> | null {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
        const message = messages[i];
        if (message.role !== 'user' || message.hidden) {
            continue;
        }
        const retryText = (message.requestContent || message.content).trim();
        const displayText = message.content.trim();
        if (!retryText) {
            return null;
        }
        return {
            baseMessages: messages.slice(0, i),
            displayText,
            retryText,
        };
    }
    return null;
}
