import { discoverProvider } from './ai-provider-discovery';
import { AIProviderDiscoveryResult, AIProviderProtocolPreference } from './ai-provider-types';

interface FetchAvailableModelsParams {
    apiUrl: string;
    apiKey: string;
    model?: string;
    protocol?: AIProviderProtocolPreference;
    temperature?: number;
}

export async function fetchProviderDiscovery({
    apiUrl,
    apiKey,
    model = 'gpt-4o',
    protocol = 'responses',
    temperature = 0.7,
}: FetchAvailableModelsParams): Promise<AIProviderDiscoveryResult> {
    return discoverProvider({
        apiUrl,
        apiKey,
        model: model.trim() || 'gpt-4o',
        protocol,
        temperature,
    });
}
