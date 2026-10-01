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
    capabilityOverrides?: AIModelCapabilityOverrides;
}

/** A job owns this snapshot; do not attach it to persisted job state. */
export interface AIRequestRuntime {
    config: Readonly<AIProviderConfig>;
    capabilities: AIProviderCapabilities;
    parameters: Record<string, unknown>;
    meta: AIExecutionMeta;
}
