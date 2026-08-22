import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    getEndpointLogMeta,
    resolveModelsUrl,
    resolveProviderEndpoint,
} from './ai-endpoints';
import {
    getWebCrossOriginMessage,
    getWebProxyUnavailableMessage,
    resolveAIWebTransport,
} from './ai-web-proxy';
import { recordDiagnosticLog } from './diagnostics';
import {
    AIModelMetadata,
    AIProviderCapabilities,
    AIProviderConfig,
    AIProviderDiscoveryResult,
    AIProviderProtocol,
} from './ai-provider-types';

const DEFAULT_MAX_OUTPUT_TOKENS = 16 * 1024;
const MODEL_METADATA_CACHE_PREFIX = 'ai_provider_model_metadata_v4_';
const MODEL_METADATA_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CATALOG_REQUEST_TIMEOUT_MS = 8000;

interface CachedModelMetadata {
    expiresAt: number;
    metadata: AIModelMetadata;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function normalizeStringList(value: unknown): string[] {
    if (Array.isArray(value)) {
        return value
            .filter((item): item is string => typeof item === 'string')
            .map((item) => item.trim())
            .filter(Boolean);
    }
    if (typeof value === 'string') {
        return value
            .split(/[\s,|]+/u)
            .map((item) => item.trim())
            .filter(Boolean);
    }
    return [];
}

function normalizeParameterName(value: string): string {
    return value
        .trim()
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .replace(/[-\s]+/g, '_')
        .toLowerCase();
}

function findSupportedParameters(source: unknown): string[] {
    if (!isRecord(source)) {
        return [];
    }
    const candidates = [
        source.supported_parameters,
        source.supportedParameters,
        source.parameters,
        source.request_parameters,
        source.requestParameters,
    ].flatMap(normalizeStringList);
    const capabilities = isRecord(source.capabilities) ? source.capabilities : null;
    if (capabilities) {
        candidates.push(
            ...normalizeStringList(capabilities.supported_parameters),
            ...normalizeStringList(capabilities.supportedParameters),
        );
    }
    return Array.from(new Set(candidates.map(normalizeParameterName).filter(Boolean)));
}

function findPositiveInteger(source: unknown, keys: readonly string[], depth = 0): number | undefined {
    if (!isRecord(source) || depth > 2) {
        return undefined;
    }
    for (const key of keys) {
        const value = source[key];
        const parsed = typeof value === 'number'
            ? value
            : (typeof value === 'string' ? Number(value) : NaN);
        if (Number.isFinite(parsed) && parsed > 0) {
            return Math.floor(parsed);
        }
    }
    for (const nestedKey of ['limits', 'capabilities', 'metadata', 'model_info', 'modelInfo', 'config']) {
        const nested = findPositiveInteger(source[nestedKey], keys, depth + 1);
        if (nested) {
            return nested;
        }
    }
    return undefined;
}

function findExplicitBoolean(source: unknown, keys: readonly string[], depth = 0): boolean | undefined {
    if (!isRecord(source) || depth > 2) {
        return undefined;
    }
    for (const key of keys) {
        if (typeof source[key] === 'boolean') {
            return source[key] as boolean;
        }
    }
    for (const nestedKey of ['capabilities', 'metadata', 'model_info', 'modelInfo', 'config']) {
        const nested = findExplicitBoolean(source[nestedKey], keys, depth + 1);
        if (nested !== undefined) {
            return nested;
        }
    }
    return undefined;
}

function parseModelMetadata(item: unknown): AIModelMetadata | null {
    if (!isRecord(item)) {
        return null;
    }
    const id = typeof item.id === 'string'
        ? item.id.trim()
        : (typeof item.name === 'string' ? item.name.trim() : '');
    if (!id) {
        return null;
    }
    const supportedParameters = findSupportedParameters(item);
    const explicitTemperature = findExplicitBoolean(item, ['supports_temperature', 'supportsTemperature', 'temperature']);
    const supportsTemperature = explicitTemperature
        ?? (supportedParameters.length > 0 ? supportedParameters.includes('temperature') : undefined);
    return {
        id,
        ownedBy: typeof item.owned_by === 'string'
            ? item.owned_by
            : (typeof item.ownedBy === 'string' ? item.ownedBy : undefined),
        maxOutputTokens: findPositiveInteger(item, [
            'max_output_tokens',
            'maxOutputTokens',
            'output_token_limit',
            'outputTokenLimit',
            'output_limit',
            'outputLimit',
            'max_completion_tokens',
            'maxCompletionTokens',
            'max_tokens',
            'maxTokens',
        ]),
        supportedParameters: supportedParameters.length > 0 ? supportedParameters : undefined,
        supportsTemperature,
    };
}

function hasExplicitMetadata(metadata: AIModelMetadata | undefined): metadata is AIModelMetadata {
    return Boolean(
        metadata
        && (metadata.maxOutputTokens !== undefined
            || metadata.supportsTemperature !== undefined
            || metadata.supportedParameters?.length),
    );
}

function hashCacheKey(value: string): string {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
}

function getMetadataCacheKey(config: AIProviderConfig): string {
    const identity = [
        config.apiUrl.trim(),
        config.apiKey.trim(),
        config.model.trim(),
        config.protocol,
    ].join('|');
    return MODEL_METADATA_CACHE_PREFIX + hashCacheKey(identity);
}

function getAuthHeaders(
    protocol: AIProviderProtocol,
    apiKey: string,
    endpoint: string,
): Record<string, string> {
    if (protocol === 'anthropic_messages') {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'x-api-key': apiKey.trim(),
            'anthropic-version': '2023-06-01',
        };
        try {
            if (new URL(endpoint).hostname.toLowerCase() !== 'api.anthropic.com') {
                headers.Authorization = 'Bearer ' + apiKey.trim();
            }
        } catch {
            headers.Authorization = 'Bearer ' + apiKey.trim();
        }
        return headers;
    }
    return {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + apiKey.trim(),
    };
}

async function fetchWithCatalogTimeout(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CATALOG_REQUEST_TIMEOUT_MS);
    try {
        return await fetch(url, {
            ...init,
            signal: controller.signal as RequestInit['signal'],
        });
    } finally {
        clearTimeout(timeoutId);
    }
}

function validateConfig(config: AIProviderConfig): void {
    if (!config.apiUrl.trim() || !config.apiKey.trim() || !config.model.trim()) {
        throw new Error('请先配置接口地址、API Key 与模型名称');
    }
}

async function fetchModelCatalog(config: AIProviderConfig): Promise<AIModelMetadata[]> {
    const endpoint = resolveModelsUrl(config.apiUrl);
    const transport = resolveAIWebTransport(endpoint);
    let response: Response;
    try {
        response = await fetchWithCatalogTimeout(transport.endpoint, {
            method: 'GET',
            headers: getAuthHeaders(config.protocol, config.apiKey, endpoint),
        });
    } catch (error) {
        if (transport.webCrossOrigin) {
            throw new Error(transport.webProxyUsed ? getWebProxyUnavailableMessage() : getWebCrossOriginMessage());
        }
        throw error;
    }
    if (transport.webProxyUsed && (response.status === 404 || response.status === 405)) {
        throw new Error(getWebProxyUnavailableMessage());
    }
    if (!response.ok) {
        const message = (await response.text()).slice(0, 300);
        throw new Error(
            '模型列表请求失败（HTTP ' + response.status + '）'
            + (message ? ': ' + message : ''),
        );
    }
    const body = await response.json() as unknown;
    const source = isRecord(body) ? body : {};
    const items = Array.isArray(source.data)
        ? source.data
        : (Array.isArray(source.models) ? source.models : []);
    return items.map(parseModelMetadata).filter((item): item is AIModelMetadata => Boolean(item));
}

async function readCachedModelMetadata(config: AIProviderConfig): Promise<AIModelMetadata | undefined> {
    try {
        const raw = await AsyncStorage.getItem(getMetadataCacheKey(config));
        if (!raw) {
            return undefined;
        }
        const parsed = JSON.parse(raw) as CachedModelMetadata;
        if (!parsed || !Number.isFinite(parsed.expiresAt) || parsed.expiresAt <= Date.now()) {
            return undefined;
        }
        return hasExplicitMetadata(parsed.metadata) ? parsed.metadata : undefined;
    } catch {
        return undefined;
    }
}

async function cacheModelMetadata(config: AIProviderConfig, metadata?: AIModelMetadata): Promise<void> {
    if (!hasExplicitMetadata(metadata)) {
        return;
    }
    const value: CachedModelMetadata = {
        expiresAt: Date.now() + MODEL_METADATA_CACHE_TTL_MS,
        metadata,
    };
    try {
        await AsyncStorage.setItem(getMetadataCacheKey(config), JSON.stringify(value));
    } catch {
        // Metadata caching only affects optional request parameters.
    }
}

function buildCapabilities(
    config: AIProviderConfig,
    metadata: AIModelMetadata | undefined,
    metadataSource: AIProviderCapabilities['metadataSource'],
): AIProviderCapabilities {
    const endpoint = resolveProviderEndpoint(config.apiUrl, config.protocol);
    const explicitMetadata = hasExplicitMetadata(metadata) ? metadata : undefined;
    return {
        protocol: config.protocol,
        endpoint,
        ...getEndpointLogMeta(endpoint),
        model: config.model.trim(),
        maxOutputTokens: explicitMetadata?.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
        maxOutputTokensSource: explicitMetadata?.maxOutputTokens ? 'model_metadata' : 'default',
        supportsTemperature: explicitMetadata?.supportsTemperature === true,
        temperatureSource: explicitMetadata?.supportsTemperature === true ? 'metadata' : 'omitted',
        metadataAvailable: Boolean(explicitMetadata),
        metadataSource: explicitMetadata ? metadataSource : 'default',
        discoveredAt: new Date().toISOString(),
    };
}

function logCatalog(
    config: AIProviderConfig,
    capabilities: AIProviderCapabilities,
    modelCount: number,
): void {
    const transport = resolveAIWebTransport(resolveModelsUrl(config.apiUrl));
    void recordDiagnosticLog({
        level: 'info',
        source: 'AI:providerCatalog',
        message: 'catalog_completed',
        context: {
            protocol: capabilities.protocol,
            apiHost: capabilities.apiHost,
            endpointPath: capabilities.endpointPath,
            model: capabilities.model,
            modelCount,
            metadataAvailable: capabilities.metadataAvailable,
            maxOutputTokens: capabilities.maxOutputTokens,
            maxOutputTokensSource: capabilities.maxOutputTokensSource,
            supportsTemperature: capabilities.supportsTemperature,
            metadataSource: capabilities.metadataSource,
            webCrossOrigin: transport.webCrossOrigin,
            webProxyUsed: transport.webProxyUsed,
            pageOrigin: transport.pageOrigin,
        },
    });
}

export async function discoverProvider(config: AIProviderConfig): Promise<AIProviderDiscoveryResult> {
    validateConfig(config);
    let models: AIModelMetadata[];
    try {
        models = await fetchModelCatalog(config);
    } catch (error) {
        const endpoint = resolveModelsUrl(config.apiUrl);
        const endpointMeta = getEndpointLogMeta(endpoint);
        const transport = resolveAIWebTransport(endpoint);
        const message = error instanceof Error ? error.message : String(error);
        void recordDiagnosticLog({
            level: 'warn',
            source: 'AI:providerCatalog',
            message: 'catalog_failed',
            context: {
                protocol: config.protocol,
                ...endpointMeta,
                model: config.model.trim(),
                webCrossOrigin: transport.webCrossOrigin,
                webProxyUsed: transport.webProxyUsed,
                pageOrigin: transport.pageOrigin,
                errorMessage: message,
            },
        });
        throw error;
    }
    const selectedMetadata = models.find((item) => item.id === config.model.trim());
    await cacheModelMetadata(config, selectedMetadata);
    const capabilities = buildCapabilities(
        config,
        selectedMetadata,
        hasExplicitMetadata(selectedMetadata) ? 'catalog' : 'default',
    );
    logCatalog(config, capabilities, models.length);
    return { models, capabilities };
}

export async function getProviderCapabilities(config: AIProviderConfig): Promise<AIProviderCapabilities> {
    validateConfig(config);
    const metadata = await readCachedModelMetadata(config);
    return buildCapabilities(config, metadata, metadata ? 'cache' : 'default');
}
