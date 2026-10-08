import { getProviderCapabilities } from './ai-provider-discovery';
import { buildReasoningRequest, isReasoningEnabled, resolveOutputBudget } from './ai-model-capabilities';
import { getCachedCompatQuirks, readCompatQuirks } from './ai-compat-memory';
import type { AICompatQuirks, AIProviderCapabilities, AIProviderConfig, AIRequestRuntime } from './ai-provider-types';
import { getActiveProviderConfig, getSettings } from './settings';

function snapshotConfig(selected: AIProviderConfig): AIProviderConfig {
    const snapshot: AIProviderConfig = {
        ...selected,
        capabilityOverrides: selected.capabilityOverrides ? {
            ...selected.capabilityOverrides,
            reasoning: selected.capabilityOverrides.reasoning ? {
                ...selected.capabilityOverrides.reasoning,
                efforts: [...selected.capabilityOverrides.reasoning.efforts],
            } : undefined,
        } : undefined,
    };
    if (snapshot.protocolPreference !== 'auto') snapshot.protocol = snapshot.protocolPreference;
    return snapshot;
}

/** Pure: the same source, capabilities and quirks always give the same request. */
export function buildRequestRuntime(source: AIProviderConfig, capabilities: AIProviderCapabilities, quirks: AICompatQuirks): AIRequestRuntime {
    if (source.maxOutputTokensAuto === false
        && (!Number.isSafeInteger(source.maxOutputTokens) || source.maxOutputTokens <= 0)) throw new Error('总输出 token 上限须为正整数。');
    if (!Number.isFinite(source.temperature) || source.temperature < 0 || source.temperature > 2) throw new Error('温度须在 0 到 2 之间。');
    const maxOutputTokens = resolveOutputBudget(source, capabilities, quirks);
    const reasoning = buildReasoningRequest(source, capabilities.reasoning, maxOutputTokens, quirks);
    const usesReasoning = reasoning.sent === 'default'
        ? isReasoningEnabled({ reasoning: 'default' }, capabilities.reasoning)
        : reasoning.sent !== 'off';
    const temperature = capabilities.supportsTemperature && !quirks.dropTemperature
        && (!usesReasoning || capabilities.temperatureWithReasoning) ? source.temperature : undefined;
    const config: AIProviderConfig = { ...source, maxOutputTokens };
    return {
        config: Object.freeze(config), source: Object.freeze({ ...source }),
        capabilities: { ...capabilities, maxOutputTokens }, quirks: Object.freeze({ ...quirks }),
        parameters: reasoning.parameters,
        meta: {
            providerId: source.providerId, providerName: source.providerName, model: source.model,
            protocol: source.protocol, reasoning: reasoning.sent, thinkingMode: capabilities.reasoning.mode,
            ...(reasoning.budgetTokens ? { thinkingBudgetTokens: reasoning.budgetTokens } : {}),
            temperature, maxOutputTokens, skills: [],
        },
    };
}

export async function resolveAIRequestRuntime(config?: AIProviderConfig): Promise<AIRequestRuntime> {
    const snapshot = snapshotConfig(config ?? getActiveProviderConfig(await getSettings()));
    const [capabilities, quirks] = await Promise.all([
        getProviderCapabilities(snapshot),
        readCompatQuirks(snapshot, snapshot.protocol),
    ]);
    return buildRequestRuntime(snapshot, capabilities, quirks);
}

/**
 * A job resolves its runtime once and reuses it for follow-up requests. If a
 * sibling request has since learned a quirk, rebuild before sending.
 */
export function refreshRuntimeQuirks(runtime: AIRequestRuntime): AIRequestRuntime {
    const cached = getCachedCompatQuirks(runtime.source, runtime.source.protocol);
    if (!cached || JSON.stringify(cached) === JSON.stringify(runtime.quirks)) return runtime;
    const rebuilt = buildRequestRuntime(runtime.source, runtime.capabilities, cached);
    return { ...rebuilt, meta: { ...rebuilt.meta, skills: runtime.meta.skills } };
}
