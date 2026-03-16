import { ZiweiActiveScope, ZiweiTopTab } from './types';

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function normalizeString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

export interface ZiweiFormatterContext {
    cursorDateIso?: string;
    activeScope?: ZiweiActiveScope;
    selectedPalaceName?: string;
    selectedStarName?: string | null;
    activeTopTab?: ZiweiTopTab;
}

export function normalizeZiweiFormatterContext(context: unknown): ZiweiFormatterContext | undefined {
    if (!isObject(context)) {
        return undefined;
    }

    const activeScope = context.activeScope === 'decadal'
        || context.activeScope === 'age'
        || context.activeScope === 'yearly'
        || context.activeScope === 'monthly'
        || context.activeScope === 'daily'
        || context.activeScope === 'hourly'
        ? context.activeScope
        : undefined;
    const activeTopTab = context.activeTopTab === 'chart'
        || context.activeTopTab === 'pattern'
        || context.activeTopTab === 'palace'
        || context.activeTopTab === 'info'
        ? context.activeTopTab
        : undefined;
    const selectedStarName = context.selectedStarName === null
        ? null
        : normalizeString(context.selectedStarName);

    const normalized: ZiweiFormatterContext = {
        cursorDateIso: normalizeString(context.cursorDateIso),
        activeScope,
        selectedPalaceName: normalizeString(context.selectedPalaceName),
        selectedStarName,
        activeTopTab,
    };

    return Object.values(normalized).some((value) => value !== undefined)
        ? normalized
        : undefined;
}

export function cloneZiweiFormatterContext(context?: ZiweiFormatterContext): ZiweiFormatterContext | undefined {
    return normalizeZiweiFormatterContext(context);
}
