export type ChatPresentationState = 'idle' | 'presenting' | 'preparing_request' | 'streaming';

export interface AutoStartInitialAnalysisOptions {
    visible: boolean;
    modalShown: boolean;
    autoStartPending: boolean;
    isLoading: boolean;
    messageCount: number;
}

export function shouldAutoStartInitialAnalysis(options: AutoStartInitialAnalysisOptions): boolean {
    return options.visible
        && options.modalShown
        && options.autoStartPending
        && !options.isLoading
        && options.messageCount === 0;
}
