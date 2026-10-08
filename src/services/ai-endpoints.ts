import type { AIProviderProtocol } from './ai-provider-types';

// Endpoint rules depend only on the URL the user typed, never on the host:
// the same base URL may be an official API, a new-api / sub2api relay or a
// self-hosted gateway.

export function getProtocolLabel(protocol: AIProviderProtocol): string {
    return protocol === 'responses' ? 'Responses' : 'Anthropic Messages';
}

const DEFAULT_API_BASE_PATH = '/v1';

/** A trailing "#" means "use this URL exactly as typed". */
export const RAW_URL_MARKER = '#';

const PROTOCOL_PATHS: Record<AIProviderProtocol, string> = {
    responses: '/responses',
    anthropic_messages: '/messages',
};

// '/chat/completions' is not a supported protocol; it is listed so a pasted
// OpenAI-style endpoint still reduces to its base URL.
const KNOWN_ENDPOINT_PATHS = [
    PROTOCOL_PATHS.responses,
    PROTOCOL_PATHS.anthropic_messages,
    '/models',
    '/chat/completions',
] as const;

const VERSION_SEGMENT = /^v\d+(?:[a-z]+\d*)?$/i;

function normalizeTrailingSlash(value: string): string {
    return value.replace(/\/+$/, '');
}

export function isRawEndpointUrl(apiUrl: string): boolean {
    return apiUrl.trim().endsWith(RAW_URL_MARKER);
}

function stripRawMarker(apiUrl: string): string {
    return apiUrl.trim().slice(0, -RAW_URL_MARKER.length).trim();
}

function findKnownEndpoint(path: string): string | undefined {
    return KNOWN_ENDPOINT_PATHS.find((endpointPath) => path.endsWith(endpointPath));
}

/**
 * Base-URL rules:
 * - empty path → /v1/<endpoint>
 * - already ends with a known endpoint → swap in the target endpoint
 * - last segment is a version (v1, v4, v1beta) → <path>/<endpoint>
 * - anything else (/anthropic, /api, /proxy …) → <path>/v1/<endpoint>
 */
function joinEndpointPath(pathname: string, endpointPath: string): string {
    const path = normalizeTrailingSlash(pathname);
    const known = findKnownEndpoint(path);
    if (known) return `${normalizeTrailingSlash(path.slice(0, -known.length))}${endpointPath}`;
    if (!path) return `${DEFAULT_API_BASE_PATH}${endpointPath}`;
    const lastSegment = path.slice(path.lastIndexOf('/') + 1);
    if (VERSION_SEGMENT.test(lastSegment)) return `${path}${endpointPath}`;
    return `${path}${DEFAULT_API_BASE_PATH}${endpointPath}`;
}

function resolveEndpointUrl(apiUrl: string, endpointPath: string): string {
    const trimmedUrl = apiUrl.trim();
    if (!trimmedUrl) {
        return trimmedUrl;
    }
    if (isRawEndpointUrl(trimmedUrl)) {
        const raw = stripRawMarker(trimmedUrl);
        // The raw URL is the request endpoint; only the model list is derived from it.
        if (endpointPath !== '/models') return raw;
        const suffixIndex = raw.search(/[?#]/u);
        const path = suffixIndex >= 0 ? raw.slice(0, suffixIndex) : raw;
        const known = findKnownEndpoint(normalizeTrailingSlash(path));
        return known ? `${normalizeTrailingSlash(path).slice(0, -known.length)}/models` : `${normalizeTrailingSlash(path)}/models`;
    }

    try {
        const url = new URL(trimmedUrl);
        url.pathname = joinEndpointPath(url.pathname, endpointPath);
        url.hash = '';
        return url.toString();
    } catch {
        const suffixIndex = trimmedUrl.search(/[?#]/u);
        const path = suffixIndex >= 0 ? trimmedUrl.slice(0, suffixIndex) : trimmedUrl;
        const suffix = suffixIndex >= 0 ? trimmedUrl.slice(suffixIndex) : '';
        return `${joinEndpointPath(path, endpointPath)}${suffix}`;
    }
}

export function resolveProviderEndpoint(apiUrl: string, protocol: AIProviderProtocol): string {
    return resolveEndpointUrl(apiUrl, PROTOCOL_PATHS[protocol]);
}

export function resolveModelsUrl(apiUrl: string): string {
    return resolveEndpointUrl(apiUrl, '/models');
}

/** What the form shows under the Base URL field. */
export function describeEndpointPreview(apiUrl: string): Record<AIProviderProtocol, string> | null {
    if (!apiUrl.trim()) return null;
    return {
        responses: resolveProviderEndpoint(apiUrl, 'responses'),
        anthropic_messages: resolveProviderEndpoint(apiUrl, 'anthropic_messages'),
    };
}

function getExplicitProtocol(apiUrl: string): AIProviderProtocol | undefined {
    const value = isRawEndpointUrl(apiUrl) ? stripRawMarker(apiUrl) : apiUrl.trim();
    let path = value;
    try { path = new URL(value).pathname; } catch { path = value.split(/[?#]/u)[0]; }
    path = normalizeTrailingSlash(path);
    if (path.endsWith(PROTOCOL_PATHS.responses)) return 'responses';
    if (path.endsWith(PROTOCOL_PATHS.anthropic_messages) || /\/anthropic(\/|$)/i.test(path)) return 'anthropic_messages';
    return undefined;
}

/**
 * Order to probe protocols in. Hints, strongest first: the URL path the user
 * typed, what the model catalog reported, then the model family. The order
 * only decides what is tried first; the connection test decides.
 */
export function getProtocolCandidates(apiUrl: string, model = '', catalogEndpoints?: AIProviderProtocol[]): AIProviderProtocol[] {
    const order: AIProviderProtocol[] = [];
    const add = (protocol: AIProviderProtocol | undefined) => {
        if (protocol && !order.includes(protocol)) order.push(protocol);
    };
    add(getExplicitProtocol(apiUrl));
    catalogEndpoints?.forEach(add);
    if (/^claude-/i.test(model.trim())) add('anthropic_messages');
    add('responses');
    add('anthropic_messages');
    return order;
}

export function inferProviderProtocol(apiUrl: string, model = ''): AIProviderProtocol {
    return getProtocolCandidates(apiUrl, model)[0];
}

export function getEndpointLogMeta(endpoint: string): { apiHost: string; endpointPath: string } {
    try {
        const url = new URL(endpoint);
        return { apiHost: url.host, endpointPath: url.pathname };
    } catch {
        return { apiHost: 'invalid-url', endpointPath: endpoint.slice(0, 160) };
    }
}

/**
 * The pre-2026.10 rules sent any path other than "", /v1, /anthropic or a
 * known endpoint as-is. Such saved URLs get a raw marker once, so a working
 * configuration keeps hitting the same URL.
 */
export function wasLegacyRawEndpoint(apiUrl: string): boolean {
    const trimmed = apiUrl.trim();
    if (!trimmed || isRawEndpointUrl(trimmed)) return false;
    let path: string;
    try { path = new URL(trimmed).pathname; } catch { return false; }
    const normalized = normalizeTrailingSlash(path);
    if (!normalized || findKnownEndpoint(normalized)) return false;
    return !normalized.endsWith(DEFAULT_API_BASE_PATH) && !normalized.endsWith('/anthropic');
}
