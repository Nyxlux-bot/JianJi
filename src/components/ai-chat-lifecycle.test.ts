import { shouldAutoStartInitialAnalysis } from './ai-chat-lifecycle';

describe('shouldAutoStartInitialAnalysis', () => {
    it('does not auto-start before the modal has shown', () => {
        expect(shouldAutoStartInitialAnalysis({
            visible: true,
            modalShown: false,
            autoStartPending: true,
            isLoading: false,
            messageCount: 0,
        })).toBe(false);
    });

    it('auto-starts after the modal has shown when the initial chat is empty', () => {
        expect(shouldAutoStartInitialAnalysis({
            visible: true,
            modalShown: true,
            autoStartPending: true,
            isLoading: false,
            messageCount: 0,
        })).toBe(true);
    });

    it('stays idle when messages already exist or a request is in flight', () => {
        expect(shouldAutoStartInitialAnalysis({
            visible: true,
            modalShown: true,
            autoStartPending: true,
            isLoading: false,
            messageCount: 2,
        })).toBe(false);

        expect(shouldAutoStartInitialAnalysis({
            visible: true,
            modalShown: true,
            autoStartPending: true,
            isLoading: true,
            messageCount: 0,
        })).toBe(false);
    });
});
