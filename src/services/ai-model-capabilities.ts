import { isAIReasoningEffort } from '../core/ai-execution-meta';
import type { AIModelMetadata, AIProviderConfig, AIProviderProtocol, AIReasoningCapability } from './ai-provider-types';

export const DEFAULT_OUTPUT_TOKENS = 16_384;
export const DEFAULT_REASONING_OUTPUT_TOKENS = 32_768;
export const DEFAULT_THINKING_BUDGET = 8_192;
export const UNKNOWN_REASONING: AIReasoningCapability = { mode: 'unknown', efforts: [], supportsOff: false, defaultEnabled: false };

/** Only documented IDs match; gateway aliases need metadata or an explicit override. */
export function getBuiltInModelMetadata(model: string, protocol: AIProviderProtocol): AIModelMetadata | undefined {
    const id = model.trim();
    if (protocol === 'responses') {
        if (id === 'gpt-6-astra') return {
            id, maxOutputTokens: 128_000,
            reasoning: { mode: 'responses', efforts: ['low', 'medium', 'high', 'xhigh', 'max'], supportsOff: false, defaultEnabled: true },
        };
        if (/^gpt-5\.[45]-pro(?:-\d{4}-\d{2}-\d{2})?$/.test(id)) return {
            id, maxOutputTokens: 128_000,
            reasoning: { mode: 'responses', efforts: ['medium', 'high', 'xhigh'], supportsOff: false, defaultEnabled: true },
        };
        if (/^gpt-5\.1(?:-\d{4}-\d{2}-\d{2})?$/.test(id)) return {
            id, maxOutputTokens: 128_000, supportsTemperature: true, temperatureWithReasoning: false,
            reasoning: { mode: 'responses', efforts: ['low', 'medium', 'high'], supportsOff: true, defaultEnabled: false },
        };
        if (/^gpt-(?:4o(?:-mini)?|4\.1(?:-mini|-nano)?)(?:-\d{4}-\d{2}-\d{2})?$/.test(id)) return {
            id, supportsTemperature: true, temperatureWithReasoning: false,
            reasoning: { mode: 'unsupported', efforts: [], supportsOff: false, defaultEnabled: false },
        };
        return undefined;
    }
    if (/^claude-(?:opus|sonnet)-4-6(?:-\d{8})?$/.test(id)) return {
        id, supportsTemperature: true, temperatureWithReasoning: false,
        reasoning: { mode: 'adaptive', efforts: ['low', 'medium', 'high', 'max'], supportsOff: true, defaultEnabled: false },
    };
    // 5 系列带小版本号（如 claude-opus-5-5、claude-fable-5-1）与日期后缀均视为同一能力档。
    if (/^claude-(?:opus-4-[78]|(?:opus|sonnet|fable)-5(?:-\d{1,2})?)(?:-\d{8})?$/.test(id)) return {
        id, supportsTemperature: false,
        reasoning: { mode: 'adaptive', efforts: ['low', 'medium', 'high', 'xhigh', 'max'], supportsOff: true, defaultEnabled: /-5(?:-\d{1,2})?(?:-\d{8})?$/.test(id) },
    };
    if (/^claude-(?:opus|sonnet|haiku)-4-5(?:-\d{8})?$/.test(id)) return {
        id, supportsTemperature: true, temperatureWithReasoning: false,
        reasoning: { mode: 'budget', efforts: [], supportsOff: true, defaultEnabled: false },
    };
    return undefined;
}

export function resolveModelBehavior(config: AIProviderConfig, metadata?: AIModelMetadata) {
    const rules = getBuiltInModelMetadata(config.model, config.protocol);
    const overrides = config.capabilityOverrides;
    return {
        reasoning: overrides?.reasoning ?? metadata?.reasoning ?? rules?.reasoning ?? UNKNOWN_REASONING,
        reasoningSource: overrides?.reasoning ? 'override' : metadata?.reasoning ? 'metadata' : rules?.reasoning ? 'model_rules' : 'unknown',
        modelMaxOutputTokens: overrides?.maxOutputTokens ?? metadata?.maxOutputTokens ?? rules?.maxOutputTokens,
        maxOutputTokensSource: overrides?.maxOutputTokens !== undefined ? 'override' : metadata?.maxOutputTokens !== undefined ? 'model_metadata' : rules?.maxOutputTokens !== undefined ? 'model_rules' : 'default',
        supportsTemperature: overrides?.supportsTemperature ?? metadata?.supportsTemperature ?? rules?.supportsTemperature ?? false,
        temperatureSource: overrides?.supportsTemperature !== undefined ? 'override' : metadata?.supportsTemperature !== undefined ? 'metadata' : rules?.supportsTemperature !== undefined ? 'model_rules' : 'omitted',
        temperatureWithReasoning: overrides?.temperatureWithReasoning ?? metadata?.temperatureWithReasoning ?? rules?.temperatureWithReasoning ?? false,
    } as const;
}

export function isReasoningEnabled(config: AIProviderConfig, capability: AIReasoningCapability): boolean {
    if (config.reasoning === 'off') return false;
    return config.reasoning === 'default' ? capability.defaultEnabled : true;
}

export function buildReasoningParameters(config: AIProviderConfig, capability: AIReasoningCapability): Record<string, unknown> {
    const selected = config.reasoning;
    if (selected === 'default') return {};
    if (capability.mode === 'unknown' || capability.mode === 'unsupported') throw new Error('当前模型未声明支持思考参数，请选择“模型默认”或配置高级兼容能力。');
    if ((config.protocol === 'responses') !== (capability.mode === 'responses')) throw new Error('思考模式与当前协议不兼容，请检查高级兼容配置。');
    if (selected === 'off') {
        if (!capability.supportsOff) throw new Error('当前模型不支持关闭思考。');
        return config.protocol === 'responses' ? { reasoning: { effort: 'none' } } : { thinking: { type: 'disabled' } };
    }
    if (capability.mode === 'budget') {
        if (selected !== 'budget') throw new Error('当前模型使用思考 token 预算，不支持所选等级。');
        if (!Number.isSafeInteger(config.thinkingBudgetTokens) || config.thinkingBudgetTokens < 1024 || config.thinkingBudgetTokens >= config.maxOutputTokens) throw new Error('思考预算须为至少 1024 的整数，且小于总输出 token 上限。');
        return { thinking: { type: 'enabled', budget_tokens: config.thinkingBudgetTokens } };
    }
    if (!isAIReasoningEffort(selected) || !capability.efforts.includes(selected)) throw new Error('当前模型不支持所选思考等级，请重新选择。');
    return capability.mode === 'responses' ? { reasoning: { effort: selected } }
        : { thinking: { type: 'adaptive' }, output_config: { effort: selected } };
}

export function getReasoningLabel(value: AIProviderConfig['reasoning'], budget?: number): string {
    if (value === 'default') return '模型默认';
    if (value === 'off') return '关闭思考';
    if (value === 'budget') return `预算 ${budget ?? DEFAULT_THINKING_BUDGET}`;
    return value;
}
