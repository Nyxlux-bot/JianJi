import { AI_REASONING_EFFORTS, isAIReasoningEffort } from '../core/ai-execution-meta';
import type {
    AICompatQuirks, AIModelMetadata, AIProviderConfig, AIProviderProtocol, AIReasoningCapability,
    AIReasoningEffort, AIReasoningSetting, AIThinkingMode,
} from './ai-provider-types';

export const DEFAULT_OUTPUT_TOKENS = 16_384;
export const DEFAULT_REASONING_OUTPUT_TOKENS = 32_768;
export const DEFAULT_THINKING_BUDGET = 8_192;
export const UNKNOWN_REASONING: AIReasoningCapability = { mode: 'unknown', efforts: [], supportsOff: false, defaultEnabled: false };

const NO_QUIRKS: AICompatQuirks = {};

// Model names are the same behind every gateway, so name rules are allowed —
// but only as hints. Unknown names still get the protocol's standard
// thinking parameters; a gateway that rejects them is handled by fallback.

/** Relay aliases such as *-thinking, *-reasoner, *-r1 or an effort suffix fix thinking on the gateway side. */
const ALWAYS_THINKING = /(?:^|[-_/])(?:reasoner|thinking|r1)(?:$|[-_])|^qwq(?:$|[-_])|-(?:minimal|low|medium|high|xhigh)$/i;
const NEVER_THINKING = /(?:^|[-_])no-?thinking(?:$|[-_])/i;

/** Only documented IDs match; gateway aliases need metadata, probing or fallback. */
export function getBuiltInModelMetadata(model: string, protocol: AIProviderProtocol): AIModelMetadata | undefined {
    const id = model.trim();
    if (NEVER_THINKING.test(id)) return { id, reasoning: { mode: 'unsupported', efforts: [], supportsOff: false, defaultEnabled: false } };
    if (ALWAYS_THINKING.test(id)) return { id, reasoning: { mode: 'always', efforts: [], supportsOff: false, defaultEnabled: true } };
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

/* ---------- thinking levels ---------- */

/** How thinking is expressed on the wire for this protocol, after what the gateway taught us. */
export type ThinkingFormat = 'responses' | 'adaptive' | 'budget' | 'none';

export function resolveThinkingFormat(protocol: AIProviderProtocol, mode: AIThinkingMode, quirks: AICompatQuirks = NO_QUIRKS): ThinkingFormat {
    if (quirks.reasoningFormat === 'none' || mode === 'unsupported' || mode === 'always') return 'none';
    if (protocol === 'responses') return 'responses';
    if (quirks.reasoningFormat) return quirks.reasoningFormat;
    return mode === 'adaptive' ? 'adaptive' : 'budget';
}

const STANDARD_EFFORTS: AIReasoningEffort[] = ['low', 'medium', 'high'];
const BUDGET_EFFORTS: AIReasoningEffort[] = ['low', 'medium', 'high', 'max'];

function sortEfforts(efforts: AIReasoningEffort[]): AIReasoningEffort[] {
    return AI_REASONING_EFFORTS.filter((effort) => efforts.includes(effort));
}

function getAllowedEfforts(format: ThinkingFormat, capability: AIReasoningCapability, quirks: AICompatQuirks): AIReasoningEffort[] {
    const declared = capability.mode !== 'unknown' && capability.efforts.length ? capability.efforts
        : format === 'budget' ? BUDGET_EFFORTS : STANDARD_EFFORTS;
    const rejected = quirks.unsupportedEfforts ?? [];
    return sortEfforts(declared.filter((effort) => !rejected.includes(effort)));
}

/** The detents the slider offers for this model; empty means the slider is locked. */
export function getThinkingStops(protocol: AIProviderProtocol, capability: AIReasoningCapability, quirks: AICompatQuirks = NO_QUIRKS): AIReasoningSetting[] {
    const format = resolveThinkingFormat(protocol, capability.mode, quirks);
    if (format === 'none') return [];
    // 'none' in the rejected list means this gateway refused "thinking off" on either protocol.
    const offAllowed = (capability.mode === 'unknown' || capability.supportsOff) && !quirks.unsupportedEfforts?.includes('none');
    return [...(offAllowed ? ['off' as const] : []), ...getAllowedEfforts(format, capability, quirks)];
}

export type ThinkingLock = 'always' | 'unsupported' | 'rejected';

export function getThinkingLock(capability: AIReasoningCapability, quirks: AICompatQuirks = NO_QUIRKS): ThinkingLock | null {
    if (capability.mode === 'always') return 'always';
    if (capability.mode === 'unsupported') return 'unsupported';
    if (quirks.reasoningFormat === 'none') return 'rejected';
    return null;
}

/** Legacy 'budget' settings map to the level whose budget is closest. */
export function budgetToLevel(tokens: number): AIReasoningEffort {
    if (tokens <= 4_096) return 'low';
    if (tokens <= 10_240) return 'medium';
    if (tokens <= 20_000) return 'high';
    return 'max';
}

function normalizeLevel(setting: AIReasoningSetting, budget?: number): Exclude<AIReasoningSetting, 'budget'> {
    return setting === 'budget' ? budgetToLevel(budget ?? DEFAULT_THINKING_BUDGET) : setting;
}

/** Nearest allowed effort, preferring a lighter one: a level the model lacks must not make it think longer. */
function pickEffort(level: AIReasoningEffort, allowed: AIReasoningEffort[]): AIReasoningEffort | undefined {
    if (allowed.includes(level)) return level;
    const index = AI_REASONING_EFFORTS.indexOf(level);
    for (let i = index - 1; i >= 0; i -= 1) if (allowed.includes(AI_REASONING_EFFORTS[i])) return AI_REASONING_EFFORTS[i];
    for (let i = index + 1; i < AI_REASONING_EFFORTS.length; i += 1) if (allowed.includes(AI_REASONING_EFFORTS[i])) return AI_REASONING_EFFORTS[i];
    return undefined;
}

/**
 * The stop a saved level lands on for this model — the same choice the
 * request makes. 'default' when nothing would be sent.
 */
export function resolveShownLevel(value: AIReasoningSetting, stops: AIReasoningSetting[], budget?: number): AIReasoningSetting {
    const level = normalizeLevel(value, budget);
    if (level === 'default' || stops.includes(level)) return level;
    if (level === 'off') return 'default';
    return pickEffort(level, stops.filter(isAIReasoningEffort)) ?? 'default';
}

/** Where the hollow "auto" thumb rests: "high" if offered, else the middle stop. */
export function getAutoRestIndex(stops: AIReasoningSetting[]): number {
    const high = stops.indexOf('high');
    return high >= 0 ? high : Math.floor((stops.length - 1) / 2);
}

/* ---------- output room ---------- */

// The output limit follows the level so thinking cannot eat the answer.
const OUTPUT_TOKENS_BY_LEVEL: Record<Exclude<AIReasoningSetting, 'budget'>, number> = {
    default: DEFAULT_REASONING_OUTPUT_TOKENS, off: DEFAULT_OUTPUT_TOKENS, minimal: DEFAULT_OUTPUT_TOKENS,
    low: 24_576, medium: 32_768, high: 49_152, xhigh: 65_536, max: 98_304,
};
const BUDGET_BY_LEVEL: Record<AIReasoningEffort, number> = {
    minimal: 2_048, low: 4_096, medium: 10_240, high: 16_384, xhigh: 24_576, max: 32_768,
};
/** Visible-answer room kept free of the thinking budget. */
export const ANSWER_RESERVE_TOKENS = 12_288;

type OutputConfig = Pick<AIProviderConfig, 'protocol' | 'reasoning' | 'thinkingBudgetTokens' | 'maxOutputTokens' | 'maxOutputTokensAuto'>;

export function resolveOutputBudget(
    config: OutputConfig,
    capability: { reasoning: AIReasoningCapability; modelMaxOutputTokens?: number },
    quirks: AICompatQuirks = NO_QUIRKS,
): number {
    const format = resolveThinkingFormat(config.protocol, capability.reasoning.mode, quirks);
    const level = normalizeLevel(config.reasoning, config.thinkingBudgetTokens);
    const wanted = config.maxOutputTokensAuto === false ? config.maxOutputTokens
        : capability.reasoning.mode === 'unsupported' ? DEFAULT_OUTPUT_TOKENS
            : capability.reasoning.mode === 'always' ? OUTPUT_TOKENS_BY_LEVEL.high
                : format === 'none' ? OUTPUT_TOKENS_BY_LEVEL.default
                    : OUTPUT_TOKENS_BY_LEVEL[level];
    const limits = [capability.modelMaxOutputTokens, quirks.maxOutputTokensCap].filter((value): value is number => value !== undefined && value > 0);
    return Math.max(1, Math.min(wanted, ...limits));
}

/** Thinking budget for a level, shrunk so the answer keeps its reserve. Undefined when no valid budget fits. */
export function resolveThinkingBudget(level: AIReasoningEffort, maxOutputTokens: number): number | undefined {
    const roomy = Math.min(BUDGET_BY_LEVEL[level], maxOutputTokens - ANSWER_RESERVE_TOKENS);
    const budget = roomy >= 1_024 ? roomy : Math.floor(maxOutputTokens / 2);
    return budget >= 1_024 && budget < maxOutputTokens ? budget : undefined;
}

/* ---------- request parameters ---------- */

export interface ReasoningRequest {
    parameters: Record<string, unknown>;
    format: ThinkingFormat;
    /** What was actually sent; 'default' when nothing was. */
    sent: Exclude<AIReasoningSetting, 'budget'>;
    budgetTokens?: number;
}

/**
 * Standard thinking parameters for the protocol. Never throws for an unknown
 * model: the request goes out and a rejection is handled by compat fallback.
 */
export function buildReasoningRequest(
    config: Pick<AIProviderConfig, 'protocol' | 'reasoning' | 'thinkingBudgetTokens'>,
    capability: AIReasoningCapability,
    maxOutputTokens: number,
    quirks: AICompatQuirks = NO_QUIRKS,
): ReasoningRequest {
    const level = normalizeLevel(config.reasoning, config.thinkingBudgetTokens);
    const format = resolveThinkingFormat(config.protocol, capability.mode, quirks);
    const none: ReasoningRequest = { parameters: {}, format, sent: 'default' };
    if (level === 'default' || format === 'none') return none;
    const stops = getThinkingStops(config.protocol, capability, quirks);
    if (level === 'off') {
        if (!stops.includes('off')) return none;
        return format === 'responses'
            ? { parameters: { reasoning: { effort: 'none' } }, format, sent: 'off' }
            : { parameters: { thinking: { type: 'disabled' } }, format, sent: 'off' };
    }
    const effort = pickEffort(level, getAllowedEfforts(format, capability, quirks));
    if (!effort) return none;
    if (format === 'responses') {
        return {
            parameters: { reasoning: { effort, ...(quirks.dropReasoningSummary ? {} : { summary: 'auto' }) } },
            format, sent: effort,
        };
    }
    if (format === 'adaptive') {
        return { parameters: { thinking: { type: 'adaptive' }, output_config: { effort } }, format, sent: effort };
    }
    const budgetTokens = resolveThinkingBudget(effort, maxOutputTokens);
    if (!budgetTokens) return none;
    return { parameters: { thinking: { type: 'enabled', budget_tokens: budgetTokens } }, format, sent: effort, budgetTokens };
}

export function isReasoningEnabled(config: Pick<AIProviderConfig, 'reasoning'>, capability: AIReasoningCapability): boolean {
    if (capability.mode === 'unsupported') return false;
    if (capability.mode === 'always') return true;
    if (config.reasoning === 'off') return false;
    return config.reasoning === 'default' ? capability.defaultEnabled : true;
}

/* ---------- labels ---------- */

export const THINKING_LEVEL_META: Record<Exclude<AIReasoningSetting, 'budget'>, { label: string; description: string }> = {
    default: { label: '自动', description: '不指定，按模型默认思考' },
    off: { label: '关', description: '直接作答，最快' },
    minimal: { label: '极简', description: '只做最少推演' },
    low: { label: '低', description: '略作推演，速度优先' },
    medium: { label: '中', description: '兼顾速度与深度' },
    high: { label: '高', description: '推理更充分，适合详批' },
    xhigh: { label: '超高', description: '更充分，耗时更长' },
    max: { label: '最高', description: '最充分，最慢' },
};

export function getReasoningLabel(value: AIReasoningSetting, budget?: number): string {
    if (value === 'budget') return THINKING_LEVEL_META[budgetToLevel(budget ?? DEFAULT_THINKING_BUDGET)].label;
    return THINKING_LEVEL_META[value]?.label ?? value;
}

export function isThinkingLevel(value: unknown): value is Exclude<AIReasoningSetting, 'budget'> {
    return value === 'default' || value === 'off' || isAIReasoningEffort(value);
}
