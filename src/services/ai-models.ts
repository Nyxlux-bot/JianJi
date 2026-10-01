import { discoverProvider } from './ai-provider-discovery';
import type { AIProviderConfig, AIProviderDiscoveryResult } from './ai-provider-types';

export function fetchProviderDiscovery(config: AIProviderConfig, signal?: AbortSignal): Promise<AIProviderDiscoveryResult> {
    return discoverProvider(config, signal);
}
