import AsyncStorage from '@react-native-async-storage/async-storage';
import { isAIReasoningEffort } from '../core/ai-execution-meta';
import type { AICompatQuirks, AIProviderConfig, AIProviderProtocol } from './ai-provider-types';

// Parameters a provider config rejected, learned from its own error replies.
// The key includes connectionRevision, so changing the URL or key forgets them.

const STORAGE_PREFIX = 'ai_compat_v1_';
export const EMPTY_QUIRKS: Readonly<AICompatQuirks> = Object.freeze({});

type QuirkTarget = Pick<AIProviderConfig, 'providerId' | 'connectionRevision' | 'model'>;

const cache = new Map<string, AICompatQuirks>();
const listeners = new Set<() => void>();

function storageKey(target: QuirkTarget, protocol: AIProviderProtocol): string {
    return STORAGE_PREFIX + [target.providerId, target.connectionRevision, target.model.trim(), protocol]
        .map((part) => encodeURIComponent(String(part))).join(':');
}

function sanitize(value: unknown): AICompatQuirks {
    if (!value || typeof value !== 'object') return {};
    const raw = value as Record<string, unknown>;
    const quirks: AICompatQuirks = {};
    if (raw.reasoningFormat === 'adaptive' || raw.reasoningFormat === 'budget' || raw.reasoningFormat === 'none') quirks.reasoningFormat = raw.reasoningFormat;
    if (Array.isArray(raw.unsupportedEfforts)) {
        const efforts = raw.unsupportedEfforts.filter((item): item is NonNullable<AICompatQuirks['unsupportedEfforts']>[number] => item === 'none' || isAIReasoningEffort(item));
        if (efforts.length) quirks.unsupportedEfforts = [...new Set(efforts)];
    }
    if (raw.dropReasoningSummary === true) quirks.dropReasoningSummary = true;
    if (raw.dropTemperature === true) quirks.dropTemperature = true;
    if (typeof raw.maxOutputTokensCap === 'number' && Number.isSafeInteger(raw.maxOutputTokensCap) && raw.maxOutputTokensCap > 0) quirks.maxOutputTokensCap = raw.maxOutputTokensCap;
    if (typeof raw.learnedAt === 'string') quirks.learnedAt = raw.learnedAt;
    return quirks;
}

export function mergeQuirks(base: AICompatQuirks, extra: AICompatQuirks): AICompatQuirks {
    const efforts = [...new Set([...(base.unsupportedEfforts ?? []), ...(extra.unsupportedEfforts ?? [])])];
    const cap = [base.maxOutputTokensCap, extra.maxOutputTokensCap].filter((value): value is number => value !== undefined);
    return sanitize({
        ...base, ...extra,
        unsupportedEfforts: efforts.length ? efforts : undefined,
        maxOutputTokensCap: cap.length ? Math.min(...cap) : undefined,
    });
}

/** Synchronous view of what is already known; readCompatQuirks fills it. */
export function getCachedCompatQuirks(target: QuirkTarget, protocol: AIProviderProtocol): AICompatQuirks | undefined {
    return cache.get(storageKey(target, protocol));
}

export async function readCompatQuirks(target: QuirkTarget, protocol: AIProviderProtocol): Promise<AICompatQuirks> {
    const key = storageKey(target, protocol);
    const cached = cache.get(key);
    if (cached) return cached;
    let quirks: AICompatQuirks = {};
    try {
        const raw = await AsyncStorage.getItem(key);
        quirks = raw ? sanitize(JSON.parse(raw)) : {};
    } catch {
        quirks = {};
    }
    // A concurrent rememberCompatQuirks wins over the stored value.
    const current = cache.get(key);
    if (current) return current;
    cache.set(key, quirks);
    return quirks;
}

export async function rememberCompatQuirks(target: QuirkTarget, protocol: AIProviderProtocol, learned: AICompatQuirks): Promise<AICompatQuirks> {
    const key = storageKey(target, protocol);
    const merged = mergeQuirks(cache.get(key) ?? await readCompatQuirks(target, protocol), { ...learned, learnedAt: new Date().toISOString() });
    cache.set(key, merged);
    listeners.forEach((listener) => listener());
    try {
        await AsyncStorage.setItem(key, JSON.stringify(merged));
    } catch {
        // The in-memory copy still applies for this session.
    }
    return merged;
}

/** "Re-detect" starts from a clean slate for every model of the provider. */
export async function clearCompatQuirks(providerId: string): Promise<void> {
    const prefix = STORAGE_PREFIX + encodeURIComponent(providerId) + ':';
    for (const key of [...cache.keys()]) if (key.startsWith(prefix)) cache.delete(key);
    listeners.forEach((listener) => listener());
    try {
        const keys = (await AsyncStorage.getAllKeys()).filter((key) => key.startsWith(prefix));
        if (keys.length) await AsyncStorage.multiRemove(keys);
    } catch {
        // Stale entries only cost one extra fallback retry.
    }
}

export function subscribeCompatQuirks(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

export function hasQuirks(quirks: AICompatQuirks): boolean {
    return Boolean(quirks.reasoningFormat || quirks.unsupportedEfforts?.length || quirks.dropReasoningSummary
        || quirks.dropTemperature || quirks.maxOutputTokensCap);
}
