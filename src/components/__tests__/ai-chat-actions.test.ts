import {
    buildRetryPlan,
    getLastAssistantContent,
    shouldShowBaziFoundationRetryAction,
} from '../ai-chat-actions';

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
        expect(plan?.displayText).toBe('第二问');
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

    it('ignores hidden user bootstrap messages when building retry plan', () => {
        const plan = buildRetryPlan([
            { role: 'user', content: '自动首问', hidden: true },
            { role: 'assistant', content: '首轮诊断' },
            { role: 'user', content: '细看财运' },
            { role: 'assistant', content: '财运分析' },
        ]);

        expect(plan).not.toBeNull();
        expect(plan?.retryText).toBe('细看财运');
    });

    it('prefers request content when rebuilding retry plan', () => {
        const plan = buildRetryPlan([
            { role: 'user', content: '细看财运', requestContent: '请沿用既有结论细看财运' },
            { role: 'assistant', content: '财运分析' },
        ]);

        expect(plan).not.toBeNull();
        expect(plan?.displayText).toBe('细看财运');
        expect(plan?.retryText).toBe('请沿用既有结论细看财运');
    });

    it('shows the foundation retry action after an attempted bootstrap request', () => {
        expect(shouldShowBaziFoundationRetryAction('foundation_pending', false, 0, true)).toBe(true);
        expect(shouldShowBaziFoundationRetryAction('foundation_pending', false, 0, false)).toBe(false);
        expect(shouldShowBaziFoundationRetryAction('foundation_pending', true, 1, true)).toBe(false);
        expect(shouldShowBaziFoundationRetryAction('foundation_ready', false, 1, true)).toBe(false);
    });
});
