export type BasicChatRole = 'system' | 'user' | 'assistant';

export interface BasicChatMessage {
    role: BasicChatRole;
    content: string;
}

export interface RetryPlan<T extends BasicChatMessage> {
    baseMessages: T[];
    retryText: string;
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
        if (message.role !== 'user') {
            continue;
        }
        const retryText = message.content.trim();
        if (!retryText) {
            return null;
        }
        return {
            baseMessages: messages.slice(0, i),
            retryText,
        };
    }
    return null;
}
