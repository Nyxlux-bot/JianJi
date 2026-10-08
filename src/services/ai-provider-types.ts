import type { AIExecutionMeta, AIReasoningEffort, AIReasoningSetting, AIThinkingMode } from '../core/ai-execution-meta';

export type { AIReasoningEffort, AIReasoningSetting, AIThinkingMode } from '../core/ai-execution-meta';
export type AIProviderProtocol = 'responses' | 'anthropic_messages';

export type AIProviderProtocolPreference = 'auto' | AIProviderProtocol;

export interface AIReasoningCapability {
    mode: AIThinkingMode;
    efforts: AIReasoningEffort[];
    supportsOff: boolean;
    defaultEnabled: boolean;
}

export interface AIModelCapabilityOverrides {
    reasoning?: AIReasoningCapability;
    maxOutputTokens?: number;
    supportsTemperature?: boolean;
    temperatureWithReasoning?: boolean;
}

export interface AIModelProfile {
    id: string;
    revision: number;
    model: string;
    protocol: AIProviderProtocol;
    protocolPreference: AIProviderProtocolPreference;
    protocolVerified: boolean;
    temperature: number;
    reasoning: AIReasoningSetting;
    thinkingBudgetTokens: number;
    maxOutputTokens: number;
    /** Output limit follows the thinking level; false keeps the user's own maxOutputTokens. */
    maxOutputTokensAuto?: boolean;
    capabilityOverrides?: AIModelCapabilityOverrides;
}

export interface AIProviderProfile {
    id: string;
    revision: number;
    name: string;
    apiUrl: string;
    apiKey: string;
    models: AIModelProfile[];
    activeModelId: string | null;
}

export interface AIModelMetadata {
    id: string;
    ownedBy?: string;
    maxOutputTokens?: number;
    supportedParameters?: string[];
    supportsTemperature?: boolean;
    temperatureWithReasoning?: boolean;
    reasoning?: AIReasoningCapability;
    /** Protocols the catalog says this model is served on, when the gateway reports it. */
    endpoints?: AIProviderProtocol[];
}

/**
 * What one provider config taught us by rejecting parameters. Keyed per
 * provider revision + model + protocol, never per host: the same model name
 * behaves differently behind different gateways.
 */
export interface AICompatQuirks {
    /** Anthropic side: adaptive → budget → none. */
    reasoningFormat?: 'adaptive' | 'budget' | 'none';
    /** Responses side: effort values the gateway refused (e.g. 'xhigh', 'none'). */
    unsupportedEfforts?: Array<AIReasoningEffort | 'none'>;
    dropReasoningSummary?: boolean;
    dropTemperature?: boolean;
    maxOutputTokensCap?: number;
    learnedAt?: string;
}

export interface AIProviderCapabilities {
    protocol: AIProviderProtocol;
    endpoint: string;
    apiHost: string;
    endpointPath: string;
    model: string;
    maxOutputTokens: number;
    maxOutputTokensSource: 'override' | 'model_metadata' | 'model_rules' | 'default';
    modelMaxOutputTokens?: number;
    supportsTemperature: boolean;
    temperatureSource: 'override' | 'metadata' | 'model_rules' | 'omitted';
    temperatureWithReasoning: boolean;
    reasoning: AIReasoningCapability;
    reasoningSource: 'override' | 'metadata' | 'model_rules' | 'unknown';
    metadataAvailable: boolean;
    metadataSource: 'catalog' | 'cache' | 'default';
    discoveredAt: string;
}

export interface AIProviderDiscoveryResult {
    models: AIModelMetadata[];
    capabilities: AIProviderCapabilities;
}

export interface AIProviderConfig {
    providerId: string;
    providerName: string;
    connectionRevision: number;
    modelProfileId: string;
    modelRevision: number;
    apiUrl: string;
    apiKey: string;
    model: string;
    protocol: AIProviderProtocol;
    protocolPreference: AIProviderProtocolPreference;
    protocolVerified: boolean;
    temperature: number;
    reasoning: AIReasoningSetting;
    thinkingBudgetTokens: number;
    maxOutputTokens: number;
    maxOutputTokensAuto?: boolean;
    capabilityOverrides?: AIModelCapabilityOverrides;
}

/** A job owns this snapshot; do not attach it to persisted job state. */
export interface AIRequestRuntime {
    /** Effective request config: maxOutputTokens is already resolved. */
    config: Readonly<AIProviderConfig>;
    /** The user's settings snapshot, kept so a runtime can be rebuilt with new quirks. */
    source: Readonly<AIProviderConfig>;
    capabilities: AIProviderCapabilities;
    quirks: Readonly<AICompatQuirks>;
    parameters: Record<string, unknown>;
    meta: AIExecutionMeta;
}
