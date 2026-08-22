import { Platform } from 'react-native';

/**
 * Expo Web runs the app in a browser, where a provider that does not opt in to
 * CORS cannot be contacted directly. The development server exposes this
 * same-origin path and forwards the request without ever putting the API key
 * in the URL.
 */
export const AI_WEB_PROXY_PATH = '/__jianji_ai_proxy';

export interface AIWebTransport {
    endpoint: string;
    targetEndpoint: string;
    webCrossOrigin: boolean;
    webProxyUsed: boolean;
    pageOrigin?: string;
}

function getPageOrigin(): string | undefined {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
        return undefined;
    }
    return window.location.origin || undefined;
}

function getConfiguredProxyUrl(): string | undefined {
    const processLike = (globalThis as typeof globalThis & {
        process?: { env?: Record<string, string | undefined> };
    }).process;
    const value = processLike?.env?.EXPO_PUBLIC_AI_WEB_PROXY_URL?.trim();
    return value || undefined;
}

function canUseBundledDevelopmentProxy(): boolean {
    if (typeof window === 'undefined') {
        return false;
    }
    const hostname = window.location.hostname.toLowerCase();
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

export function resolveAIWebTransport(targetEndpoint: string): AIWebTransport {
    const pageOrigin = getPageOrigin();
    if (!pageOrigin) {
        return {
            endpoint: targetEndpoint,
            targetEndpoint,
            webCrossOrigin: false,
            webProxyUsed: false,
        };
    }

    let targetUrl: URL;
    try {
        targetUrl = new URL(targetEndpoint);
    } catch {
        return {
            endpoint: targetEndpoint,
            targetEndpoint,
            webCrossOrigin: false,
            webProxyUsed: false,
            pageOrigin,
        };
    }

    if (targetUrl.origin === pageOrigin) {
        return {
            endpoint: targetEndpoint,
            targetEndpoint,
            webCrossOrigin: false,
            webProxyUsed: false,
            pageOrigin,
        };
    }

    const configuredProxyUrl = getConfiguredProxyUrl();
    if (!configuredProxyUrl && !canUseBundledDevelopmentProxy()) {
        return {
            endpoint: targetEndpoint,
            targetEndpoint,
            webCrossOrigin: true,
            webProxyUsed: false,
            pageOrigin,
        };
    }

    const proxyUrl = new URL(configuredProxyUrl || AI_WEB_PROXY_PATH, pageOrigin);
    proxyUrl.searchParams.set('target', targetEndpoint);
    return {
        endpoint: proxyUrl.toString(),
        targetEndpoint,
        webCrossOrigin: true,
        webProxyUsed: true,
        pageOrigin,
    };
}

export function getWebProxyUnavailableMessage(): string {
    return '浏览器 AI 代理不可用。请重启 Expo Web 开发服务器后重试；已部署的 Web 请配置受控代理 EXPO_PUBLIC_AI_WEB_PROXY_URL。';
}

export function getWebCrossOriginMessage(): string {
    return '当前中转站未允许此 Web 来源（CORS）。本地 Expo Web 可重启后使用同源代理；已部署的 Web 请配置受控代理 EXPO_PUBLIC_AI_WEB_PROXY_URL。';
}
