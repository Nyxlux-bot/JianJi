export type AIProviderProtocol = 'responses' | 'anthropic_messages';

export type AIProviderProtocolPreference = AIProviderProtocol;

export interface AIModelMetadata {
    id: string;
    ownedBy?: string;
    maxOutputTokens?: number;
    supportedParameters?: string[];
    supportsTemperature?: boolean;
}

export interface AIProviderCapabilities {
    protocol: AIProviderProtocol;
    endpoint: string;
    apiHost: string;
    endpointPath: string;
    model: string;
    maxOutputTokens: number;
    maxOutputTokensSource: 'model_metadata' | 'default';
    supportsTemperature: boolean;
    temperatureSource: 'metadata' | 'omitted';
    metadataAvailable: boolean;
    metadataSource: 'catalog' | 'cache' | 'default';
    discoveredAt: string;
}

export interface AIProviderDiscoveryResult {
    models: AIModelMetadata[];
    capabilities: AIProviderCapabilities;
}

export interface AIProviderConfig {
    apiUrl: string;
    apiKey: string;
    model: string;
    protocol: AIProviderProtocolPreference;
    temperature: number;
}
