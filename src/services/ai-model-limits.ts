const DEFAULT_MAIN_AI_OUTPUT_TOKENS = 16_384;

function normalize(value: string): string {
    return value.trim().toLowerCase();
}

export function resolveMainAIOutputTokens(apiUrl: string, model: string): number {
    const normalizedApiUrl = normalize(apiUrl);
    const normalizedModel = normalize(model);

    if (/deepseek/.test(normalizedApiUrl) || /deepseek/.test(normalizedModel)) {
        if (/deepseek-(v4|chat|reasoner)/.test(normalizedModel)) {
            return 384_000;
        }
        return DEFAULT_MAIN_AI_OUTPUT_TOKENS;
    }

    if (/kimi|moonshot/.test(normalizedApiUrl) || /kimi|moonshot/.test(normalizedModel)) {
        if (/kimi-k2/.test(normalizedModel)) {
            return 131_072;
        }
        if (/moonshot-v1-128k/.test(normalizedModel)) {
            return 65_536;
        }
        if (/moonshot-v1-32k/.test(normalizedModel)) {
            return 16_384;
        }
        return DEFAULT_MAIN_AI_OUTPUT_TOKENS;
    }

    if (/claude|anthropic/.test(normalizedApiUrl) || /claude/.test(normalizedModel)) {
        if (/claude-(fable-5|opus-4-8|opus-4-7|opus-4-6|sonnet-5|sonnet-4-6)/.test(normalizedModel)) {
            return 128_000;
        }
        if (/claude-haiku-4-5/.test(normalizedModel)) {
            return 64_000;
        }
        return DEFAULT_MAIN_AI_OUTPUT_TOKENS;
    }

    if (/gemini/.test(normalizedApiUrl) || /gemini/.test(normalizedModel)) {
        if (/gemini-2\.5-pro/.test(normalizedModel)) {
            return 65_535;
        }
        return DEFAULT_MAIN_AI_OUTPUT_TOKENS;
    }

    if (/qwen/.test(normalizedApiUrl) || /qwen/.test(normalizedModel)) {
        return 16_384;
    }

    if (/^gpt-5(?:[.-]|$)/.test(normalizedModel)) {
        return 128_000;
    }
    if (/^gpt-4\.1(?:[.-]|$)/.test(normalizedModel)) {
        return 32_768;
    }
    if (/^gpt-4o(?:[.-]|$)/.test(normalizedModel)) {
        return 16_384;
    }

    return DEFAULT_MAIN_AI_OUTPUT_TOKENS;
}

export function buildMainAIOutputLimitMessage(maxTokens: number): string {
    return `输出达到当前模型配置的最大输出上限（${maxTokens} tokens），内容未完整写完。请缩小问题范围，或改用支持更大输出长度的模型后重试。`;
}
