const CHAT_COMPLETIONS_PATH = '/v1/chat/completions';
const MODELS_PATH = '/v1/models';

function normalizeTrailingSlash(value: string): string {
    return value.replace(/\/+$/, '');
}

function hasChatCompletionsPath(pathname: string): boolean {
    return /\/chat\/completions\/?$/.test(pathname);
}

function hasModelsPath(pathname: string): boolean {
    return /\/models\/?$/.test(pathname);
}

function hasV1Path(pathname: string): boolean {
    return /\/v1\/?$/.test(pathname);
}

export function resolveChatCompletionsUrl(apiUrl: string): string {
    const trimmedUrl = apiUrl.trim();

    if (!trimmedUrl) {
        return trimmedUrl;
    }

    try {
        const url = new URL(trimmedUrl);
        const normalizedPath = normalizeTrailingSlash(url.pathname);

        if (hasChatCompletionsPath(url.pathname)) {
            return url.toString();
        }

        if (hasV1Path(url.pathname)) {
            url.pathname = `${normalizedPath}/chat/completions`;
            return url.toString();
        }

        if (!normalizedPath) {
            url.pathname = CHAT_COMPLETIONS_PATH;
            return url.toString();
        }

        return trimmedUrl;
    } catch {
        if (trimmedUrl.endsWith('/chat/completions')) {
            return trimmedUrl;
        }

        if (trimmedUrl.endsWith('/v1')) {
            return `${trimmedUrl}/chat/completions`;
        }

        return trimmedUrl;
    }
}

export function resolveModelsUrl(apiUrl: string): string {
    const trimmedUrl = apiUrl.trim();

    if (!trimmedUrl) {
        return trimmedUrl;
    }

    try {
        const url = new URL(trimmedUrl);
        const normalizedPath = normalizeTrailingSlash(url.pathname);

        if (hasModelsPath(url.pathname)) {
            return url.toString();
        }

        if (hasChatCompletionsPath(url.pathname)) {
            url.pathname = `${normalizedPath.replace(/\/chat\/completions$/, '')}/models`;
            return url.toString();
        }

        if (hasV1Path(url.pathname)) {
            url.pathname = `${normalizedPath}/models`;
            return url.toString();
        }

        if (!normalizedPath) {
            url.pathname = MODELS_PATH;
            return url.toString();
        }

        return trimmedUrl;
    } catch {
        if (trimmedUrl.endsWith('/chat/completions')) {
            return trimmedUrl.replace(/\/chat\/completions$/, '/models');
        }

        if (trimmedUrl.endsWith('/v1')) {
            return `${trimmedUrl}/models`;
        }

        return trimmedUrl;
    }
}
