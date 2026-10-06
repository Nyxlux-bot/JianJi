import AsyncStorage from '@react-native-async-storage/async-storage';
import { isAIReasoningEffort, isAIReasoningSetting, isAIThinkingMode } from '../core/ai-execution-meta';
import { DEFAULT_OUTPUT_TOKENS, DEFAULT_REASONING_OUTPUT_TOKENS, DEFAULT_THINKING_BUDGET, getBuiltInModelMetadata } from './ai-model-capabilities';
import type { AIModelCapabilityOverrides, AIModelProfile, AIProviderConfig, AIProviderProfile, AIProviderProtocol } from './ai-provider-types';

export interface AISettings {
    version: 2;
    providers: AIProviderProfile[];
    activeProviderId: string | null;
    geocoderApiKey: string;
}

const SETTINGS_KEY = 'settings_document_v2';
const LEGACY_KEYS = ['settings_api_url', 'settings_api_key', 'settings_model', 'settings_ai_protocol', 'settings_ai_protocol_verified', 'settings_temperature', 'settings_geocoder_api_key'];
const LEGACY_PROMPT_KEYS = ['settings_prompt_liuyao_system', 'settings_prompt_liuyao_version', 'settings_prompt_liuyao_is_custom', 'settings_prompt_bazi_system', 'settings_prompt_bazi_version', 'settings_prompt_bazi_is_custom', 'settings_system_prompt', 'settings_ai_unlocked', 'settings_prompt_version', 'settings_prompt_is_custom'];
export const DEFAULT_SETTINGS: AISettings = { version: 2, providers: [], activeProviderId: null, geocoderApiKey: '' };
const listeners = new Set<(settings: AISettings) => void>();
let migration: Promise<AISettings> | undefined;
let writeQueue: Promise<void> = Promise.resolve();
let idSequence = 0;

function newId(prefix: string): string {
    return `${prefix}-${Date.now().toString(36)}-${(++idSequence).toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createModelProfile(model = '', protocol: AIProviderProtocol = 'responses'): AIModelProfile {
    const known = getBuiltInModelMetadata(model, protocol);
    const reasoning = known?.reasoning?.efforts.includes('high') ? 'high' : 'default';
    return {
        id: newId('model'), revision: 1, model: model.trim(), protocol, protocolPreference: 'auto', protocolVerified: false,
        temperature: 0.7, reasoning, thinkingBudgetTokens: DEFAULT_THINKING_BUDGET,
        maxOutputTokens: Math.min(reasoning === 'high' ? DEFAULT_REASONING_OUTPUT_TOKENS : DEFAULT_OUTPUT_TOKENS, known?.maxOutputTokens ?? Infinity),
    };
}

export function createProviderProfile(): AIProviderProfile {
    return { id: newId('provider'), revision: 1, name: '新接口', apiUrl: 'https://api.openai.com/v1', apiKey: '', models: [], activeModelId: null };
}

export function getActiveProvider(settings: AISettings): AIProviderProfile | undefined {
    return settings.providers.find((provider) => provider.id === settings.activeProviderId);
}

export function getActiveModel(provider?: AIProviderProfile): AIModelProfile | undefined {
    return provider?.models.find((model) => model.id === provider.activeModelId);
}

export function toProviderConfig(provider: AIProviderProfile, model: AIModelProfile): AIProviderConfig {
    return {
        providerId: provider.id, providerName: provider.name, connectionRevision: provider.revision,
        modelProfileId: model.id, modelRevision: model.revision, apiUrl: provider.apiUrl, apiKey: provider.apiKey,
        model: model.model, protocol: model.protocol, temperature: model.temperature, reasoning: model.reasoning,
        protocolPreference: model.protocolPreference, protocolVerified: model.protocolVerified,
        thinkingBudgetTokens: model.thinkingBudgetTokens, maxOutputTokens: model.maxOutputTokens,
        capabilityOverrides: model.capabilityOverrides,
    };
}

export function getActiveProviderConfig(settings: AISettings): AIProviderConfig {
    const provider = getActiveProvider(settings);
    const model = getActiveModel(provider);
    if (!provider) throw new Error('请先选择 AI 接口。');
    if (!model || !model.model.trim()) throw new Error('请先为当前接口选择或填写模型。');
    return toProviderConfig(provider, model);
}

export function sameProviderConfig(left: AIProviderConfig, right: AIProviderConfig): boolean {
    return left.providerId === right.providerId && left.connectionRevision === right.connectionRevision
        && left.modelProfileId === right.modelProfileId && left.modelRevision === right.modelRevision
        && left.protocol === right.protocol && left.protocolPreference === right.protocolPreference
        && left.apiUrl === right.apiUrl && left.apiKey === right.apiKey && left.model === right.model
        && left.temperature === right.temperature && left.reasoning === right.reasoning
        && left.thinkingBudgetTokens === right.thinkingBudgetTokens && left.maxOutputTokens === right.maxOutputTokens
        && JSON.stringify(left.capabilityOverrides) === JSON.stringify(right.capabilityOverrides);
}

export function updateProviderProfile(settings: AISettings, providerId: string, update: (provider: AIProviderProfile) => AIProviderProfile): AISettings {
    return { ...settings, providers: settings.providers.map((previous) => {
        if (previous.id !== providerId) return previous;
        const next = update(previous);
        const changed = next.apiUrl !== previous.apiUrl || next.apiKey !== previous.apiKey;
        return changed ? { ...next, revision: previous.revision + 1, models: next.models.map((model) => ({ ...model, protocolVerified: false })) } : next;
    }) };
}

export function updateModelProfile(provider: AIProviderProfile, modelId: string, update: (model: AIModelProfile) => AIModelProfile): AIProviderProfile {
    return { ...provider, models: provider.models.map((previous) => previous.id === modelId
        ? { ...update(previous), revision: previous.revision + 1, protocolVerified: false } : previous) };
}

function object(value: unknown, label: string): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label}格式无效`);
    return value as Record<string, unknown>;
}

function string(value: unknown, label: string): string {
    if (typeof value !== 'string') throw new Error(`${label}须为文本`);
    return value;
}

function integer(value: unknown, label: string, minimum = 1): number {
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) throw new Error(`${label}须为不小于 ${minimum} 的整数`);
    return value;
}

function parseOverrides(value: unknown): AIModelCapabilityOverrides | undefined {
    if (value === undefined) return undefined;
    const raw = object(value, '模型兼容配置');
    const result: AIModelCapabilityOverrides = {};
    if (raw.maxOutputTokens !== undefined) result.maxOutputTokens = integer(raw.maxOutputTokens, '模型能力上限');
    for (const key of ['supportsTemperature', 'temperatureWithReasoning'] as const) {
        const flag = raw[key];
        if (flag === undefined) continue;
        if (typeof flag !== 'boolean') throw new Error('温度兼容配置格式无效');
        result[key] = flag;
    }
    if (raw.reasoning !== undefined) {
        const reasoning = object(raw.reasoning, '思考能力');
        if (!isAIThinkingMode(reasoning.mode) || !Array.isArray(reasoning.efforts) || !reasoning.efforts.every(isAIReasoningEffort)
            || typeof reasoning.supportsOff !== 'boolean' || typeof reasoning.defaultEnabled !== 'boolean') throw new Error('思考能力配置格式无效');
        result.reasoning = { mode: reasoning.mode, efforts: [...new Set(reasoning.efforts)], supportsOff: reasoning.supportsOff, defaultEnabled: reasoning.defaultEnabled };
    }
    return result;
}

function parseModel(value: unknown): AIModelProfile {
    const raw = object(value, '模型');
    if (raw.protocol !== 'responses' && raw.protocol !== 'anthropic_messages') throw new Error('模型协议无效');
    if (raw.protocolPreference !== undefined && raw.protocolPreference !== 'auto'
        && raw.protocolPreference !== 'responses' && raw.protocolPreference !== 'anthropic_messages') throw new Error('协议选择无效');
    if (!isAIReasoningSetting(raw.reasoning)) throw new Error('思考设置无效');
    if (typeof raw.temperature !== 'number' || !Number.isFinite(raw.temperature) || raw.temperature < 0 || raw.temperature > 2) throw new Error('温度须在 0 到 2 之间');
    if (typeof raw.protocolVerified !== 'boolean') throw new Error('模型验证状态无效');
    const model: AIModelProfile = {
        id: string(raw.id, '模型标识'), revision: integer(raw.revision, '模型配置版本'), model: string(raw.model, '模型名称').trim(),
        protocol: raw.protocol, protocolVerified: raw.protocolVerified, temperature: raw.temperature,
        protocolPreference: raw.protocolPreference ?? 'auto',
        reasoning: raw.reasoning, thinkingBudgetTokens: integer(raw.thinkingBudgetTokens, '思考预算', 1024),
        maxOutputTokens: integer(raw.maxOutputTokens, '总输出上限'), capabilityOverrides: parseOverrides(raw.capabilityOverrides),
    };
    if (!model.id) throw new Error('模型标识不能为空');
    if (model.reasoning === 'budget' && model.thinkingBudgetTokens >= model.maxOutputTokens) throw new Error('思考预算必须小于总输出上限');
    return model;
}

function parseSettings(value: unknown): AISettings {
    const raw = object(value, '设置');
    if (raw.version !== 2 || !Array.isArray(raw.providers)) throw new Error('不支持的 AI 设置版本');
    const providers = raw.providers.map((value): AIProviderProfile => {
        const provider = object(value, '接口');
        if (!Array.isArray(provider.models)) throw new Error('接口模型列表无效');
        const models = provider.models.map(parseModel);
        if (new Set(models.map((model) => model.id)).size !== models.length) throw new Error('模型标识重复');
        const activeModelId = provider.activeModelId === null ? null : string(provider.activeModelId, '当前模型');
        if (activeModelId && !models.some((model) => model.id === activeModelId)) throw new Error('当前模型不存在');
        return {
            id: string(provider.id, '接口标识'), revision: integer(provider.revision, '接口配置版本'),
            name: string(provider.name, '接口名称'), apiUrl: string(provider.apiUrl, '接口地址').trim(),
            apiKey: string(provider.apiKey, 'API Key'), models, activeModelId,
        };
    });
    if (providers.some((provider) => !provider.id) || new Set(providers.map((provider) => provider.id)).size !== providers.length) throw new Error('接口标识为空或重复');
    const activeProviderId = raw.activeProviderId === null ? null : string(raw.activeProviderId, '当前接口');
    if (activeProviderId && !providers.some((provider) => provider.id === activeProviderId)) throw new Error('当前接口不存在');
    return { version: 2, providers, activeProviderId, geocoderApiKey: string(raw.geocoderApiKey, '地理编码 Key') };
}

function legacyProvider(raw: Record<string, unknown>): AIProviderProfile {
    const provider = createProviderProfile();
    const model = createModelProfile(typeof raw.model === 'string' ? raw.model : 'gpt-4o', raw.protocol === 'anthropic_messages' ? 'anthropic_messages' : 'responses');
    const temperature = typeof raw.temperature === 'number' ? raw.temperature : Number(raw.temperature ?? 0.7);
    return {
        ...provider, id: 'legacy-default', name: '原有接口',
        apiUrl: typeof raw.apiUrl === 'string' ? raw.apiUrl : provider.apiUrl,
        apiKey: typeof raw.apiKey === 'string' ? raw.apiKey : '', activeModelId: model.id,
        models: [{ ...model, reasoning: 'default', maxOutputTokens: DEFAULT_OUTPUT_TOKENS,
            temperature: Number.isFinite(temperature) ? Math.max(0, Math.min(2, temperature)) : 0.7,
            protocolVerified: raw.protocolVerified === true || raw.protocolVerified === 'true' }],
    };
}

async function loadSettings(): Promise<AISettings> {
    const saved = await AsyncStorage.getItem(SETTINGS_KEY);
    if (saved !== null) return parseSettings(JSON.parse(saved));
    const entries = await AsyncStorage.multiGet(LEGACY_KEYS);
    const values = new Map(entries);
    const hasAI = entries.slice(0, 6).some(([, value]) => value !== null);
    const provider = hasAI ? legacyProvider({
        apiUrl: values.get(LEGACY_KEYS[0]) ?? undefined, apiKey: values.get(LEGACY_KEYS[1]) ?? undefined,
        model: values.get(LEGACY_KEYS[2]) ?? undefined, protocol: values.get(LEGACY_KEYS[3]),
        protocolVerified: values.get(LEGACY_KEYS[4]), temperature: values.get(LEGACY_KEYS[5]) ?? undefined,
    }) : undefined;
    const settings: AISettings = { version: 2, providers: provider ? [provider] : [], activeProviderId: provider?.id ?? null, geocoderApiKey: values.get(LEGACY_KEYS[6]) ?? '' };
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    await AsyncStorage.multiRemove([...LEGACY_KEYS, ...LEGACY_PROMPT_KEYS]);
    return settings;
}

export async function getSettings(): Promise<AISettings> {
    await writeQueue;
    const pending = migration ?? (migration = loadSettings());
    try { return parseSettings(await pending); }
    finally { migration = undefined; }
}

export async function saveSettings(settings: AISettings): Promise<void> {
    const normalized = parseSettings(settings);
    const save = writeQueue.then(async () => {
        if (migration) await migration;
        await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(normalized));
        listeners.forEach((listener) => listener(parseSettings(normalized)));
    });
    // Callers receive this failure; later independent saves may still proceed.
    writeQueue = save.catch(() => undefined);
    return save;
}

export function subscribeSettings(listener: (settings: AISettings) => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

export async function isAIConfigured(): Promise<boolean> {
    const settings = await getSettings();
    const provider = getActiveProvider(settings);
    return Boolean(provider?.apiKey.trim() && provider.apiUrl.trim() && getActiveModel(provider)?.model.trim());
}

export function buildBackupSettings(settings: AISettings): AISettings {
    const clean = parseSettings(settings);
    return { ...clean, geocoderApiKey: '', providers: clean.providers.map((provider) => ({ ...provider, apiKey: '' })) };
}

export function mergeImportedSettings(value: unknown, current: AISettings): AISettings {
    const raw = object(value, '导入设置');
    const incoming = raw.version === 2 || raw.version === 4 ? parseSettings({ ...raw, version: 2 }).providers : [legacyProvider(raw)];
    const providers = [...current.providers];
    for (const source of incoming) {
        const index = providers.findIndex((provider) => provider.id === source.id);
        const existing = providers[index];
        const sameAddress = existing && existing.apiUrl.trim().replace(/\/+$/, '') === source.apiUrl.trim().replace(/\/+$/, '');
        if (sameAddress) {
            const models = [...existing.models];
            for (const imported of source.models) {
                const modelIndex = models.findIndex((model) => model.id === imported.id || (source.id === 'legacy-default' && model.model === imported.model));
                const previous = models[modelIndex];
                const next = { ...imported, id: previous?.id ?? imported.id, revision: (previous?.revision ?? 0) + 1, protocolVerified: false };
                if (modelIndex < 0) models.push(next); else models[modelIndex] = next;
            }
            providers[index] = { ...existing, name: source.name, revision: existing.revision + 1, models };
        } else {
            providers.push({ ...source, id: existing ? newId('provider') : source.id, apiKey: '',
                models: source.models.map((model) => ({ ...model, protocolVerified: false })) });
        }
    }
    // 恢复后若还没有当前接口，默认选中第一个，否则 AI 入口会一直显示“未配置”。
    const activeProviderId = current.activeProviderId && providers.some((provider) => provider.id === current.activeProviderId)
        ? current.activeProviderId : providers[0]?.id ?? null;
    return parseSettings({ ...current, providers, activeProviderId });
}
