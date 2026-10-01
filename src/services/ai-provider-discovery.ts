import AsyncStorage from '@react-native-async-storage/async-storage';
import { isAIReasoningEffort, isAIThinkingMode } from '../core/ai-execution-meta';
import { resolveModelBehavior } from './ai-model-capabilities';
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
import type {
    AIModelMetadata,
    AIProviderCapabilities,
    AIProviderConfig,
    AIProviderDiscoveryResult,
    AIProviderProtocol,
    AIReasoningCapability,
} from './ai-provider-types';

const MODEL_METADATA_CACHE_PREFIX = 'ai_provider_model_metadata_v5_';
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

function parseReasoningMetadata(source: Record<string, unknown>): AIReasoningCapability | undefined {
    const capability = isRecord(source.capabilities) ? source.capabilities : source;
    const raw = isRecord(capability.reasoning) ? capability.reasoning : undefined;
    if (!raw || !isAIThinkingMode(raw.mode)) return undefined;
    return {
        mode: raw.mode,
        efforts: normalizeStringList(raw.efforts ?? raw.supported_efforts).filter(isAIReasoningEffort),
        supportsOff: raw.supportsOff === true || raw.supports_off === true,
        defaultEnabled: raw.defaultEnabled === true || raw.default_enabled === true,
    };
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
        temperatureWithReasoning: findExplicitBoolean(item, ['temperatureWithReasoning', 'temperature_with_reasoning']),
        reasoning: parseReasoningMetadata(item),
    };
}

function hasExplicitMetadata(metadata: AIModelMetadata | undefined): metadata is AIModelMetadata {
    return Boolean(
        metadata
        && (metadata.maxOutputTokens !== undefined
            || metadata.supportsTemperature !== undefined
            || metadata.supportedParameters?.length
            || metadata.reasoning),
    );
}

function getMetadataCacheKey(config: AIProviderConfig): string {
    return MODEL_METADATA_CACHE_PREFIX + [config.providerId, config.connectionRevision, config.model.trim(), config.protocol]
        .map((part) => encodeURIComponent(String(part))).join(':');
}

function getAuthHeaders(
    protocol: AIProviderProtocol,
    apiKey: string,
    endpoint: string,
): Record<string, string> {
    if (protocol === 'anthropic_messages') {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            Accept: 'application/json',
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
        Accept: 'application/json',
        Authorization: 'Bearer ' + apiKey.trim(),
    };
}

function validateConfig(config: AIProviderConfig, requireModel = true): void {
    if (!config.apiUrl.trim() || !config.apiKey.trim() || (requireModel && !config.model.trim())) {
        throw new Error('请先配置接口地址、API Key 与模型名称');
    }
    let url: URL;
    try { url = new URL(config.apiUrl.trim()); }
    catch { throw new Error('接口地址无效，请填写以 https:// 或 http:// 开头的完整地址。'); }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('接口地址只支持 https:// 或 http://。');
    if (url.username || url.password) throw new Error('请将凭据填写到 API Key 字段，不要放入接口地址。');
}

async function fetchModelCatalog(config: AIProviderConfig, signal?: AbortSignal): Promise<AIModelMetadata[]> {
    const endpoint = resolveModelsUrl(config.apiUrl);
    const transport = resolveAIWebTransport(endpoint);
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) controller.abort();
    const timeoutId = setTimeout(abort, CATALOG_REQUEST_TIMEOUT_MS);
    try {
        let response: Response;
        try {
            response = await fetch(transport.endpoint, {
                method: 'GET',
                headers: getAuthHeaders(config.protocol, config.apiKey, endpoint),
                signal: controller.signal,
            });
        } catch (error) {
            if (controller.signal.aborted) throw error;
            if (transport.webCrossOrigin) throw new Error(transport.webProxyUsed ? getWebProxyUnavailableMessage() : getWebCrossOriginMessage());
            throw error;
        }
        if (!response.ok) {
            const message = (await response.text()).slice(0, 300);
            throw new Error(`模型列表请求失败（HTTP ${response.status}）${message ? ': ' + message : ''}`);
        }
        const body: unknown = await response.json();
        const source = isRecord(body) ? body : {};
        const items = Array.isArray(source.data) ? source.data : Array.isArray(source.models) ? source.models : undefined;
        if (!items) throw new Error('接口返回的内容不是模型列表，请检查 API 地址；也可手动填写模型名称。');
        const models = items.map(parseModelMetadata).filter((item): item is AIModelMetadata => Boolean(item));
        return [...new Map(models.map((model) => [model.id, model])).values()];
    } catch (error) {
        if (signal?.aborted) throw new Error('获取模型已取消');
        if (controller.signal.aborted) throw new Error('获取模型列表超时（8 秒）');
        if (error instanceof SyntaxError) throw new Error('接口未返回有效 JSON 模型列表，请检查 API 地址。');
        throw error;
    } finally {
        clearTimeout(timeoutId);
        signal?.removeEventListener('abort', abort);
    }
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
    const behavior = resolveModelBehavior(config, explicitMetadata);
    return {
        protocol: config.protocol,
        endpoint,
        ...getEndpointLogMeta(endpoint),
        model: config.model.trim(),
        ...behavior,
        maxOutputTokens: config.maxOutputTokens,
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

export async function discoverProvider(config: AIProviderConfig, signal?: AbortSignal): Promise<AIProviderDiscoveryResult> {
    validateConfig(config, false);
    let models: AIModelMetadata[];
    try {
        models = await fetchModelCatalog(config, signal);
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
    if (signal?.aborted) throw new Error('获取模型已取消');
    const selectedMetadata = models.find((item) => item.id === config.model.trim());
    await Promise.all(models.map((metadata) => cacheModelMetadata({ ...config, model: metadata.id }, metadata)));
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
