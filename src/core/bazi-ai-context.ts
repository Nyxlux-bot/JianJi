function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function normalizeIndex(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0
        ? Math.floor(value)
        : null;
}

export type BaziPanelMode = 'fortune' | 'taiming';
export type BaziFortuneSelectionMode = 'dayun' | 'xiaoyun';

export interface BaziFortuneSelection {
    mode: BaziFortuneSelectionMode;
    selectedDaYunIndex: number;
    selectedXiaoYunIndex: number;
    selectedLiuNianIndex: number;
    selectedLiuYueIndex: number;
}

export interface BaziFormatterContext {
    panelMode?: BaziPanelMode;
    fortuneSelection?: BaziFortuneSelection;
}

export function normalizeBaziFormatterContext(context: unknown): BaziFormatterContext | undefined {
    if (!isObject(context)) {
        return undefined;
    }

    const panelMode = context.panelMode === 'fortune' || context.panelMode === 'taiming'
        ? context.panelMode
        : undefined;
    const rawSelection = isObject(context.fortuneSelection) ? context.fortuneSelection : null;

    const fortuneSelection = rawSelection
        && (rawSelection.mode === 'dayun' || rawSelection.mode === 'xiaoyun')
        ? (() => {
            const selectedDaYunIndex = normalizeIndex(rawSelection.selectedDaYunIndex);
            const selectedXiaoYunIndex = normalizeIndex(rawSelection.selectedXiaoYunIndex);
            const selectedLiuNianIndex = normalizeIndex(rawSelection.selectedLiuNianIndex);
            const selectedLiuYueIndex = normalizeIndex(rawSelection.selectedLiuYueIndex);

            if (
                selectedDaYunIndex === null
                || selectedXiaoYunIndex === null
                || selectedLiuNianIndex === null
                || selectedLiuYueIndex === null
            ) {
                return undefined;
            }

            return {
                mode: rawSelection.mode,
                selectedDaYunIndex,
                selectedXiaoYunIndex,
                selectedLiuNianIndex,
                selectedLiuYueIndex,
            } satisfies BaziFortuneSelection;
        })()
        : undefined;

    if (!panelMode && !fortuneSelection) {
        return undefined;
    }

    return {
        panelMode,
        fortuneSelection,
    };
}

export function cloneBaziFormatterContext(context?: BaziFormatterContext): BaziFormatterContext | undefined {
    return normalizeBaziFormatterContext(context);
}
