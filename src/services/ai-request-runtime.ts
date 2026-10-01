import { getProviderCapabilities } from './ai-provider-discovery';
import { buildReasoningParameters, isReasoningEnabled } from './ai-model-capabilities';
import type { AIProviderConfig, AIRequestRuntime } from './ai-provider-types';
import { getActiveProviderConfig, getSettings } from './settings';

export async function resolveAIRequestRuntime(config?: AIProviderConfig): Promise<AIRequestRuntime> {
    const selected = config ?? getActiveProviderConfig(await getSettings());
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
    const capabilities = await getProviderCapabilities(snapshot);
    if (!Number.isSafeInteger(snapshot.maxOutputTokens) || snapshot.maxOutputTokens <= 0) throw new Error('总输出 token 上限须为正整数。');
    if (capabilities.modelMaxOutputTokens && snapshot.maxOutputTokens > capabilities.modelMaxOutputTokens) {
        throw new Error(`总输出 token 上限超过当前模型已知能力（${capabilities.modelMaxOutputTokens}），请调整模型配置。`);
    }
    const parameters = buildReasoningParameters(snapshot, capabilities.reasoning);
    if (!Number.isFinite(snapshot.temperature) || snapshot.temperature < 0 || snapshot.temperature > 2) throw new Error('温度须在 0 到 2 之间。');
    const usesReasoning = isReasoningEnabled(snapshot, capabilities.reasoning);
    const temperature = capabilities.supportsTemperature && (!usesReasoning || capabilities.temperatureWithReasoning)
        ? snapshot.temperature : undefined;
    return {
        config: Object.freeze(snapshot), capabilities, parameters,
        meta: {
            providerId: snapshot.providerId, providerName: snapshot.providerName, model: snapshot.model,
            protocol: snapshot.protocol, reasoning: snapshot.reasoning, thinkingMode: capabilities.reasoning.mode,
            ...(snapshot.reasoning === 'budget' ? { thinkingBudgetTokens: snapshot.thinkingBudgetTokens } : {}),
            temperature, maxOutputTokens: snapshot.maxOutputTokens, skills: [],
        },
    };
}
