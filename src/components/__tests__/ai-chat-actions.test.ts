import { buildRetryPlan, getLastAssistantContent } from '../ai-chat-actions';

const baseMessages = [
    { role: 'user' as const, content: '第一问' },
    { role: 'assistant' as const, content: '第一答复' },
    { role: 'user' as const, content: '第二问' },
    { role: 'assistant' as const, content: '第二答复' },
];

describe('ai chat actions', () => {
    it('gets the last assistant reply', () => {
        expect(getLastAssistantContent(baseMessages)).toBe('第二答复');
    });

    it('returns null if no assistant reply exists', () => {
        expect(getLastAssistantContent([{ role: 'user', content: 'only user' }])).toBeNull();
    });

    it('builds retry plan from latest user message', () => {
        const plan = buildRetryPlan(baseMessages);
        expect(plan).not.toBeNull();
        expect(plan?.retryText).toBe('第二问');
        expect(plan?.baseMessages).toEqual(baseMessages.slice(0, 2));
    });

    it('returns null when latest user message is empty', () => {
        const plan = buildRetryPlan([
            { role: 'user', content: '' },
            { role: 'assistant', content: 'ok' },
        ]);
        expect(plan).toBeNull();
    });
});
