interface FetchAvailableModelsParams {
    apiUrl: string;
    apiKey: string;
}

interface ModelsResponseItem {
    id?: string;
}

interface ModelsResponseBody {
    data?: ModelsResponseItem[];
}

export function resolveModelsUrl(apiUrl: string): string {
    const trimmedUrl = apiUrl.trim();

    if (!trimmedUrl) {
        return trimmedUrl;
    }

    if (trimmedUrl.endsWith('/chat/completions')) {
        return trimmedUrl.replace(/\/chat\/completions$/, '/models');
    }

    if (trimmedUrl.endsWith('/v1')) {
        return `${trimmedUrl}/models`;
    }

    try {
        const url = new URL(trimmedUrl);

        if (/\/chat\/completions\/?$/.test(url.pathname)) {
            url.pathname = url.pathname.replace(/\/chat\/completions\/?$/, '/models');
            return url.toString();
        }

        if (/\/v1\/?$/.test(url.pathname)) {
            url.pathname = `${url.pathname.replace(/\/$/, '')}/models`;
            return url.toString();
        }

        return trimmedUrl;
    } catch {
        return trimmedUrl;
    }
}

function extractModelIds(body: ModelsResponseBody): string[] {
    if (!Array.isArray(body.data)) {
        return [];
    }

    return Array.from(
        new Set(
            body.data
                .map((item) => item.id?.trim())
                .filter((item): item is string => Boolean(item))
        )
    ).sort((left, right) => left.localeCompare(right));
}

export async function fetchAvailableModels({
    apiUrl,
    apiKey,
}: FetchAvailableModelsParams): Promise<string[]> {
    const response = await fetch(resolveModelsUrl(apiUrl), {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${apiKey.trim()}`,
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`连接失败 ${response.status}: ${text}`);
    }

    const body = await response.json() as ModelsResponseBody;
    return extractModelIds(body);
}
