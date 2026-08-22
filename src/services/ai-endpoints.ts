import { AIProviderProtocol } from './ai-provider-types';

const DEFAULT_API_BASE_PATH = '/v1';

const PROTOCOL_PATHS: Record<AIProviderProtocol, string> = {
    responses: '/responses',
    anthropic_messages: '/messages',
};

const KNOWN_ENDPOINT_PATHS = [
    PROTOCOL_PATHS.responses,
    PROTOCOL_PATHS.anthropic_messages,
    '/models',
] as const;

// Anthropic-compatible gateways (DeepSeek/Kimi at /anthropic, GLM at
// /api/anthropic) mount the Messages API at <base>/anthropic/v1/messages
// so tools like Claude Code can point ANTHROPIC_BASE_URL at them.
const ANTHROPIC_COMPAT_SEGMENT = '/anthropic';

function normalizeTrailingSlash(value: string): string {
    return value.replace(/\/+$/, '');
}

function getBasePath(pathname: string): string | null {
    const normalizedPath = normalizeTrailingSlash(pathname);
    for (const endpointPath of KNOWN_ENDPOINT_PATHS) {
        if (normalizedPath.endsWith(endpointPath)) {
            return normalizeTrailingSlash(normalizedPath.slice(0, -endpointPath.length));
        }
    }
    if (!normalizedPath) {
        return DEFAULT_API_BASE_PATH;
    }
    if (normalizedPath.endsWith(DEFAULT_API_BASE_PATH)) {
        return normalizedPath;
    }
    if (normalizedPath.endsWith(ANTHROPIC_COMPAT_SEGMENT)) {
        return `${normalizedPath}${DEFAULT_API_BASE_PATH}`;
    }
    return null;
}

function resolveFallbackEndpointUrl(value: string, endpointPath: string): string {
    const suffixIndex = value.search(/[?#]/u);
    const path = suffixIndex >= 0 ? value.slice(0, suffixIndex) : value;
    const suffix = suffixIndex >= 0 ? value.slice(suffixIndex) : '';
    const normalizedPath = normalizeTrailingSlash(path);
    for (const knownPath of KNOWN_ENDPOINT_PATHS) {
        if (normalizedPath.endsWith(knownPath)) {
            return `${normalizeTrailingSlash(normalizedPath.slice(0, -knownPath.length))}${endpointPath}${suffix}`;
        }
    }
    if (!normalizedPath) {
        return `${DEFAULT_API_BASE_PATH}${endpointPath}${suffix}`;
    }
    if (normalizedPath.endsWith(DEFAULT_API_BASE_PATH)) {
        return `${normalizedPath}${endpointPath}${suffix}`;
    }
    if (normalizedPath.endsWith(ANTHROPIC_COMPAT_SEGMENT)) {
        return `${normalizedPath}${DEFAULT_API_BASE_PATH}${endpointPath}${suffix}`;
    }
    return value;
}

function resolveEndpointUrl(apiUrl: string, endpointPath: string): string {
    const trimmedUrl = apiUrl.trim();
    if (!trimmedUrl) {
        return trimmedUrl;
    }

    try {
        const url = new URL(trimmedUrl);
        const basePath = getBasePath(url.pathname);
        if (basePath === null) {
            url.hash = '';
            return url.toString();
        }
        url.pathname = `${basePath}${endpointPath}`;
        url.hash = '';
        return url.toString();
    } catch {
        return resolveFallbackEndpointUrl(trimmedUrl, endpointPath);
    }
}

export function resolveProviderEndpoint(apiUrl: string, protocol: AIProviderProtocol): string {
    return resolveEndpointUrl(apiUrl, PROTOCOL_PATHS[protocol]);
}

export function resolveModelsUrl(apiUrl: string): string {
    return resolveEndpointUrl(apiUrl, '/models');
}

export function getEndpointLogMeta(endpoint: string): { apiHost: string; endpointPath: string } {
    try {
        const url = new URL(endpoint);
        return { apiHost: url.host, endpointPath: url.pathname };
    } catch {
        return { apiHost: 'invalid-url', endpointPath: endpoint.slice(0, 160) };
    }
}
