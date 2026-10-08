import React, { useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../theme/ThemeContext';
import { CustomAlert } from './CustomAlertProvider';
import AIModelControls from './AIModelControls';
import { ChevronDownIcon, ChevronRightIcon, CloseIcon, EyeIcon, EyeOffIcon, MoreVerticalIcon } from './Icons';
import {
    createModelProfile, createProviderProfile, getActiveModel, getActiveProvider, getDefaultReasoning, getProviderDisplayName,
    sameProviderConfig, toProviderConfig, updateModelProfile, updateProviderProfile, type AISettings,
} from '../services/settings';
import { describeEndpointPreview, getProtocolCandidates, getProtocolLabel, isRawEndpointUrl } from '../services/ai-endpoints';
import { fetchProviderDiscovery } from '../services/ai-models';
import { describeProviderFailure, testProviderConnection, type AIProviderConnectionAttempt } from '../services/ai-provider-client';
import { clearCompatQuirks } from '../services/ai-compat-memory';
import { getThinkingStops } from '../services/ai-model-capabilities';
import type { AIModelMetadata, AIModelProfile, AIProviderCapabilities, AIProviderProfile, AIProviderProtocol } from '../services/ai-provider-types';

export interface SettingsSaveState {
    status: 'saved' | 'pending' | 'saving' | 'error';
    message?: string;
}

interface Feedback {
    key: string;
    message: string;
    hint?: string;
    tone: 'neutral' | 'success' | 'error';
    attempts?: AIProviderConnectionAttempt[];
}
interface Catalog {
    key: string;
    models: AIModelMetadata[];
    capabilities: AIProviderCapabilities;
    formKey: string;
}

const EMPTY_MODELS: AIModelMetadata[] = [];
/** Pause after the last edit before probing the connection on its own. */
const AUTO_DETECT_DELAY_MS = 1200;

function connectionKey(provider: AIProviderProfile): string {
    // Used only in memory to reject stale async results, never rendered or logged.
    return JSON.stringify([provider.id, provider.revision, provider.apiUrl, provider.apiKey]);
}
function formKey(provider: AIProviderProfile | undefined, model: AIModelProfile | undefined): string {
    return provider ? JSON.stringify([connectionKey(provider), model ?? null]) : '';
}
function redactError(message: string, key: string): string {
    return key.trim() ? message.split(key.trim()).join('[REDACTED]') : message;
}
function isReady(provider: AIProviderProfile | undefined): provider is AIProviderProfile {
    return Boolean(provider?.apiUrl.trim() && provider.apiKey.trim());
}

/** The attempt that best explains a failed test: a key problem beats a missing endpoint. */
function explainAttempts(attempts: AIProviderConnectionAttempt[]): { title: string; hint?: string } {
    const rank = (attempt: AIProviderConnectionAttempt) => {
        const status = attempt.result?.meta.httpStatus;
        if (status === 401 || status === 403) return 0;
        if (status === 429) return 1;
        if (status !== undefined && status >= 500) return 2;
        if (status === 404) return 4;
        return 3;
    };
    const best = [...attempts].sort((left, right) => rank(left) - rank(right))[0];
    const status = best?.result?.meta.httpStatus;
    const friendly = describeProviderFailure(status, best?.result?.providerError?.message ?? best?.error);
    if (friendly) return friendly;
    if (best?.code === 'invalid_configuration') return { title: '配置不完整', hint: best.error };
    if (best?.code === 'timeout') return { title: '等待超时', hint: '接口迟迟没有响应，检查网络或稍后再试。' };
    if (best?.code === 'network_error') return { title: '连不上这个地址', hint: '检查 Base URL 与网络。' };
    return { title: '没有通过检测', hint: best?.result?.providerError?.message ?? best?.error };
}

function Field({ label, value, onChangeText, placeholder, secureTextEntry = false, actions, autoFocus = false, onSubmit }: {
    label: string; value: string; onChangeText: (value: string) => void; placeholder?: string;
    secureTextEntry?: boolean; actions?: React.ReactNode; autoFocus?: boolean; onSubmit?: () => void;
}) {
    const { Colors } = useTheme();
    const [focused, setFocused] = useState(false);
    return <View style={styles.field}>
        <Text style={[styles.label, { color: Colors.text.secondary }]}>{label}</Text>
        <View style={[styles.inputRow, { borderColor: focused ? Colors.accent.gold : Colors.border.subtle, backgroundColor: Colors.bg.input }]}>
            <TextInput accessibilityLabel={label} value={value} placeholder={placeholder} placeholderTextColor={Colors.text.tertiary}
                style={[styles.input, { color: Colors.text.primary }]} autoCapitalize="none" autoCorrect={false} autoFocus={autoFocus}
                secureTextEntry={secureTextEntry} onChangeText={onChangeText} returnKeyType="done"
                onFocus={() => setFocused(true)} onBlur={() => { setFocused(false); onSubmit?.(); }} onSubmitEditing={onSubmit} />
            {actions}
        </View>
    </View>;
}

export interface AIProviderSettingsHandle {
    hasPendingModel: () => boolean;
    commitPendingModel: () => void;
}

/**
 * AI 中枢: Base URL, key and models. Everything saves itself; the connection is
 * probed automatically once the URL, key and a model are in place. Endpoint and
 * protocol come from the typed URL and the probe, never from the host name.
 */
export default function AIProviderSettings({ settings, onChange, saveState, ref }: {
    settings: AISettings; onChange: React.Dispatch<React.SetStateAction<AISettings>>;
    saveState: SettingsSaveState; ref?: React.Ref<AIProviderSettingsHandle>;
}) {
    const { Colors } = useTheme();
    const { width } = useWindowDimensions();
    const wide = width >= 760;
    const [catalog, setCatalog] = useState<Catalog | null>(null);
    const [catalogState, setCatalogState] = useState<{ key: string; loading: boolean; error?: string } | null>(null);
    const [testing, setTesting] = useState(false);
    const [feedback, setFeedback] = useState<Feedback | null>(null);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [advancedOpen, setAdvancedOpen] = useState(false);
    const [keyVisible, setKeyVisible] = useState(false);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [renaming, setRenaming] = useState(false);
    const settingsRef = useRef(settings);
    const mounted = useRef(false);
    const testRef = useRef<{ controller: AbortController; key: string } | null>(null);
    const catalogRef = useRef<AbortController | null>(null);
    const autoDetectedKey = useRef('');
    settingsRef.current = settings;
    const provider = getActiveProvider(settings);
    const model = getActiveModel(provider);
    const currentKey = formKey(provider, model);
    const catalogModels = provider && catalog?.key === connectionKey(provider) ? catalog.models : EMPTY_MODELS;
    const catalogLoading = Boolean(provider && catalogState?.key === connectionKey(provider) && catalogState.loading);
    const catalogError = provider && catalogState?.key === connectionKey(provider) ? catalogState.error : undefined;
    const visibleFeedback = feedback?.key === currentKey ? feedback : null;
    const preview = provider ? describeEndpointPreview(provider.apiUrl) : null;

    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
            testRef.current?.controller.abort(); testRef.current = null;
            catalogRef.current?.abort(); catalogRef.current = null;
        };
    }, []);
    useEffect(() => {
        setKeyVisible(false); setPickerOpen(false); setQuery(''); setDetailsOpen(false); setRenaming(false); setAdvancedOpen(false);
    }, [provider?.id]);
    // Any edit makes an in-flight test meaningless.
    useEffect(() => {
        const operation = testRef.current;
        if (operation && operation.key !== currentKey) {
            operation.controller.abort(); testRef.current = null; setTesting(false);
        }
    }, [currentKey]);

    const changeSettings = (update: (current: AISettings) => AISettings) => {
        onChange((current) => {
            const next = update(current);
            settingsRef.current = next;
            return next;
        });
    };
    const changeProvider = (update: (provider: AIProviderProfile) => AIProviderProfile) => {
        if (provider) changeSettings((current) => updateProviderProfile(current, provider.id, update));
    };
    const changeModel = (next: AIModelProfile) => changeProvider((current) => updateModelProfile(current, next.id, () => next));

    /* ---------- model catalog ---------- */
    const loadCatalog = async () => {
        const selected = getActiveProvider(settingsRef.current);
        if (!isReady(selected) || catalogRef.current) return;
        const key = connectionKey(selected);
        const controller = new AbortController();
        catalogRef.current = controller;
        setCatalogState({ key, loading: true });
        try {
            const probe = getActiveModel(selected) ?? createModelProfile('', getProtocolCandidates(selected.apiUrl)[0]);
            const discovery = await fetchProviderDiscovery(toProviderConfig(selected, probe), controller.signal);
            if (!mounted.current || controller.signal.aborted) return;
            setCatalog({ key, models: discovery.models, capabilities: discovery.capabilities, formKey: formKey(selected, getActiveModel(selected)) });
            setCatalogState({ key, loading: false, error: discovery.models.length ? undefined : '接口没有公开模型列表，可以直接输入模型名称。' });
        } catch (reason: unknown) {
            if (mounted.current && !controller.signal.aborted) {
                setCatalogState({ key, loading: false, error: redactError(reason instanceof Error ? reason.message : '获取模型列表失败', selected.apiKey) });
            }
        } finally {
            if (catalogRef.current === controller) catalogRef.current = null;
        }
    };
    const openPicker = () => {
        setPickerOpen(true); setQuery('');
        if (provider && catalog?.key !== connectionKey(provider) && !catalogLoading) void loadCatalog();
    };
    const closePicker = () => { setPickerOpen(false); setQuery(''); Keyboard.dismiss(); };

    const addModel = (name: string, metadata?: AIModelMetadata) => {
        const currentProvider = getActiveProvider(settingsRef.current);
        const trimmed = name.trim();
        if (!currentProvider || !trimmed) return;
        const existing = currentProvider.models.find((entry) => entry.model === trimmed);
        let selected = existing;
        if (!selected) {
            const protocol = getProtocolCandidates(currentProvider.apiUrl, trimmed, metadata?.endpoints)[0];
            selected = createModelProfile(trimmed, protocol);
            if (metadata?.reasoning) {
                const stops = getThinkingStops(protocol, metadata.reasoning);
                selected.reasoning = stops.includes('high') ? 'high' : stops[stops.length - 1] ?? getDefaultReasoning(trimmed, protocol);
            }
            if (metadata?.maxOutputTokens) selected.maxOutputTokens = Math.min(selected.maxOutputTokens, metadata.maxOutputTokens);
        }
        const chosen = selected;
        changeSettings((current) => updateProviderProfile(current, currentProvider.id, (entry) => ({
            ...entry, models: existing ? entry.models : [...entry.models, chosen], activeModelId: chosen.id,
        })));
        closePicker();
    };
    const commitModelQuery = () => {
        if (pickerOpen && query.trim()) addModel(query, catalogModels.find((entry) => entry.id === query.trim()));
        else closePicker();
    };
    useImperativeHandle(ref, () => ({
        hasPendingModel: () => Boolean(provider && pickerOpen && query.trim() && !provider.models.some((entry) => entry.model === query.trim())),
        commitPendingModel: commitModelQuery,
    }));
    const modelOptions = useMemo(() => {
        const saved = new Set(provider?.models.map((entry) => entry.model) ?? []);
        const keyword = query.trim().toLowerCase();
        return catalogModels.filter((entry) => !saved.has(entry.id) && (!keyword || entry.id.toLowerCase().includes(keyword)))
            .sort((left, right) => left.id.localeCompare(right.id));
    }, [provider?.models, catalogModels, query]);

    /* ---------- connection test ---------- */
    const runTest = async ({ auto = false } = {}) => {
        if (testRef.current) return;
        if (!auto) {
            commitModelQuery();
            const selected = getActiveProvider(settingsRef.current);
            // A manual re-check starts from scratch: forget what this provider's gateway rejected before.
            if (selected) await clearCompatQuirks(selected.id);
        }
        const selectedProvider = getActiveProvider(settingsRef.current);
        const selectedModel = getActiveModel(selectedProvider);
        if (!selectedProvider) return;
        const key = formKey(selectedProvider, selectedModel);
        if (!isReady(selectedProvider) || !selectedModel?.model.trim()) {
            setFeedback({ key, tone: 'error', message: '还差一步', hint: '填写 Base URL、API Key，并添加一个模型。' });
            return;
        }
        const config = toProviderConfig(selectedProvider, selectedModel);
        const operation = { controller: new AbortController(), key };
        testRef.current = operation;
        setTesting(true); setDetailsOpen(false);
        setFeedback({ key, tone: 'neutral', message: '正在检测连接…' });
        const isCurrent = () => mounted.current && testRef.current === operation && !operation.controller.signal.aborted;
        try {
            const response = await testProviderConnection(config, {
                signal: operation.controller.signal,
                catalogEndpoints: catalogModels.find((entry) => entry.id === selectedModel.model)?.endpoints,
                onAttempt: (protocol, index, total) => {
                    if (isCurrent()) setFeedback({ key, tone: 'neutral', message: `正在检测 ${getProtocolLabel(protocol)}${total > 1 ? `（${index}/${total}）` : ''}…` });
                },
            });
            if (!isCurrent()) return;
            const attempts = response.attempts.map((attempt) => ({ ...attempt, error: attempt.error ? redactError(attempt.error, config.apiKey) : undefined }));
            if (!response.success || !response.selectedProtocol) {
                const explained = explainAttempts(attempts);
                setFeedback({ key, tone: 'error', message: explained.title, hint: explained.hint, attempts });
                return;
            }
            const protocol: AIProviderProtocol = response.selectedProtocol;
            changeSettings((current) => updateProviderProfile(current, selectedProvider.id, (entry) => {
                const currentModel = getActiveModel(entry);
                if (!currentModel || !sameProviderConfig(config, toProviderConfig(entry, currentModel))) return entry;
                return { ...entry, models: entry.models.map((item) => item.id === selectedModel.id
                    ? { ...item, protocol, protocolVerified: true, revision: item.revision + 1 } : item) };
            }));
            const updated = getActiveProvider(settingsRef.current);
            const duration = response.selectedResult ? (response.selectedResult.meta.durationMs / 1000).toFixed(1) : undefined;
            const learned = response.selectedResult?.learnedQuirks ? '，已自动适配接口参数' : '';
            setFeedback({ key: formKey(updated, getActiveModel(updated)), tone: 'success', attempts,
                message: `已连通 · ${getProtocolLabel(protocol)}${duration ? ` · ${duration} 秒` : ''}${learned}` });
        } catch (reason: unknown) {
            if (isCurrent()) setFeedback({ key, tone: 'error', message: '检测没有完成', hint: redactError(reason instanceof Error ? reason.message : '接口请求失败', config.apiKey) });
        } finally {
            if (testRef.current === operation) { testRef.current = null; if (mounted.current) setTesting(false); }
        }
    };
    const cancelTest = () => {
        testRef.current?.controller.abort(); testRef.current = null; setTesting(false);
        setFeedback({ key: currentKey, tone: 'neutral', message: '已取消检测' });
    };

    // Probe once by itself when URL, key and model are in place and the model is not verified yet.
    useEffect(() => {
        if (!isReady(provider) || !model?.model.trim() || model.protocolVerified || testing || pickerOpen) return undefined;
        if (autoDetectedKey.current === currentKey) return undefined;
        const timer = setTimeout(() => {
            autoDetectedKey.current = currentKey;
            void runTest({ auto: true });
        }, AUTO_DETECT_DELAY_MS);
        return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentKey, testing, pickerOpen]);

    /* ---------- provider actions ---------- */
    const paste = async (field: 'apiUrl' | 'apiKey') => {
        if (!provider) return;
        const key = connectionKey(provider);
        try {
            const value = (await Clipboard.getStringAsync()).trim();
            if (!mounted.current) return;
            const current = getActiveProvider(settingsRef.current);
            if (!current || connectionKey(current) !== key) return;
            if (!value) { setFeedback({ key: formKey(current, getActiveModel(current)), tone: 'error', message: '剪贴板为空' }); return; }
            changeSettings((settings) => updateProviderProfile(settings, current.id, (entry) => ({ ...entry, [field]: value })));
        } catch { if (mounted.current) setFeedback({ key: currentKey, tone: 'error', message: '读取剪贴板失败' }); }
    };
    const addProvider = () => {
        const added = createProviderProfile();
        changeSettings((current) => ({ ...current, providers: [...current.providers, added], activeProviderId: added.id }));
    };
    const deleteProvider = () => {
        if (!provider) return;
        CustomAlert.alert('删除接口', `删除“${getProviderDisplayName(provider)}”的配置？历史分析仍可查看。`, [
            { text: '取消', style: 'cancel' }, { text: '删除', style: 'destructive', onPress: () => changeSettings((current) => {
                const providers = current.providers.filter((item) => item.id !== provider.id);
                return { ...current, providers, activeProviderId: current.activeProviderId === provider.id ? providers[0]?.id ?? null : current.activeProviderId };
            }) },
        ]);
    };
    const openProviderMenu = () => {
        if (!provider) return;
        CustomAlert.alert(getProviderDisplayName(provider), undefined, [
            { text: '重命名', onPress: () => setRenaming(true) },
            { text: '删除接口', style: 'destructive', onPress: deleteProvider },
            { text: '取消', style: 'cancel' },
        ]);
    };
    const removeModel = (target: AIModelProfile) => {
        CustomAlert.alert('移除模型', target.model, [{ text: '取消', style: 'cancel' }, { text: '移除', style: 'destructive', onPress: () => changeProvider((entry) => {
            const models = entry.models.filter((item) => item.id !== target.id);
            return { ...entry, models, activeModelId: entry.activeModelId === target.id ? models[0]?.id ?? null : entry.activeModelId };
        }) }]);
    };

    /* ---------- render ---------- */
    const caption = { color: Colors.text.secondary, fontSize: 12, lineHeight: 18 };
    const muted = { color: Colors.text.tertiary, fontSize: 12, lineHeight: 18 };
    const status: { tone: Feedback['tone']; message: string; hint?: string } = visibleFeedback
        ?? (model?.protocolVerified ? { tone: 'success', message: `已连通 · ${getProtocolLabel(model.protocol)}` }
            : { tone: 'neutral', message: !isReady(provider) ? '填好 Base URL 和 Key 后会自动检测' : model ? '未检测' : '添加模型后会自动检测' });
    const statusColor = status.tone === 'error' ? Colors.accent.red : status.tone === 'success' ? Colors.accent.jade : Colors.text.secondary;
    const verifiedProtocol = model?.protocolVerified ? model.protocol : undefined;
    const saveLabel = saveState.status === 'error' ? `未保存：${saveState.message ?? '内容未通过校验'}`
        : saveState.status === 'saved' ? '已自动保存' : '正在保存…';

    return (
        <View style={styles.container}>
            <View style={[styles.body, wide && styles.wideBody]}>
                <View style={[styles.providers, wide ? styles.sidebar : styles.tabs, { borderColor: Colors.border.subtle }]}>
                    <View style={styles.providerHeader}>
                        <Text style={[styles.label, { color: Colors.text.secondary }]}>接口</Text>
                        <Pressable accessibilityRole="button" accessibilityLabel="新增接口" onPress={addProvider}
                            style={({ pressed }) => [styles.textButton, { opacity: pressed ? 0.5 : 1 }]}>
                            <Text style={{ color: Colors.accent.gold, fontSize: 13 }}>＋ 添加</Text>
                        </Pressable>
                    </View>
                    <ScrollView horizontal={!wide} showsHorizontalScrollIndicator={false} showsVerticalScrollIndicator nestedScrollEnabled
                        contentContainerStyle={wide ? styles.providerColumn : styles.providerTabs} keyboardShouldPersistTaps="handled">
                        {settings.providers.map((entry) => {
                            const selected = entry.id === provider?.id;
                            const verified = getActiveModel(entry)?.protocolVerified;
                            return <Pressable key={entry.id} accessibilityRole="button" accessibilityLabel={`选择接口 ${getProviderDisplayName(entry)}`}
                                accessibilityState={{ selected }} onPress={() => changeSettings((current) => ({ ...current, activeProviderId: entry.id }))}
                                style={({ pressed }) => [styles.provider, wide && styles.sidebarProvider, { borderColor: selected ? Colors.accent.gold : 'transparent',
                                    backgroundColor: wide && selected ? Colors.bg.elevated : 'transparent', opacity: pressed ? 0.65 : 1 }]}>
                                <View style={styles.providerName}>
                                    <View style={[styles.statusDot, { backgroundColor: verified ? Colors.accent.jade : Colors.border.normal }]} />
                                    <Text numberOfLines={1} style={{ flexShrink: 1, color: selected ? Colors.accent.gold : Colors.text.primary, fontSize: 14, fontWeight: selected ? '600' : '400' }}>{getProviderDisplayName(entry)}</Text>
                                </View>
                                {wide && <Text numberOfLines={1} style={muted}>{getActiveModel(entry)?.model || '未选择模型'}</Text>}
                            </Pressable>;
                        })}
                    </ScrollView>
                </View>
                <ScrollView style={styles.formScroll} contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator>
                    {provider ? <View style={styles.formFields}>
                        <View style={styles.sectionHeader}>
                            {renaming
                                ? <View style={{ flex: 1 }}><Field label="接口名称" value={provider.name} placeholder={getProviderDisplayName({ name: '', apiUrl: provider.apiUrl })} autoFocus
                                    onChangeText={(name) => changeProvider((entry) => ({ ...entry, name }))} onSubmit={() => setRenaming(false)} /></View>
                                : <Pressable accessibilityRole="button" accessibilityLabel="重命名接口" onPress={() => setRenaming(true)} style={styles.titleButton}>
                                    <Text numberOfLines={1} style={[styles.sectionTitle, { color: Colors.text.heading }]}>{getProviderDisplayName(provider)}</Text>
                                </Pressable>}
                            <Pressable accessibilityRole="button" accessibilityLabel="接口操作" onPress={openProviderMenu} style={styles.iconButton}><MoreVerticalIcon size={20} /></Pressable>
                        </View>

                        <View style={styles.field}>
                            <Field label="Base URL" value={provider.apiUrl} placeholder="服务商或中转站提供的地址，例如 https://example.com/v1"
                                onChangeText={(apiUrl) => changeProvider((entry) => ({ ...entry, apiUrl }))}
                                actions={<Pressable accessibilityRole="button" accessibilityLabel="粘贴 Base URL" onPress={() => { void paste('apiUrl'); }} style={styles.textButton}><Text style={{ color: Colors.accent.gold }}>粘贴</Text></Pressable>} />
                            {preview ? <View style={styles.preview} accessibilityLabel="实际请求地址">
                                {(['responses', 'anthropic_messages'] as const).map((protocol) => {
                                    const dim = verifiedProtocol !== undefined && verifiedProtocol !== protocol;
                                    return <View key={protocol} style={styles.previewRow}>
                                        <Text style={[styles.previewLabel, muted, verifiedProtocol === protocol && { color: Colors.accent.jade }]}>
                                            {verifiedProtocol === protocol ? '✓ ' : ''}{protocol === 'responses' ? 'Responses' : 'Anthropic'}
                                        </Text>
                                        <Text selectable numberOfLines={2} style={[styles.previewUrl, muted, dim && { opacity: 0.55 }]}>{preview[protocol]}</Text>
                                    </View>;
                                })}
                                <Text style={muted}>{isRawEndpointUrl(provider.apiUrl) ? '以 # 结尾：按原样请求，不自动补路径。' : '只填到域名或 /v1 即可，路径会自动补全；末尾加 # 则原样请求。'}</Text>
                            </View> : null}
                        </View>

                        <Field label="API Key" value={provider.apiKey} placeholder="输入或粘贴密钥" secureTextEntry={!keyVisible} onChangeText={(apiKey) => changeProvider((entry) => ({ ...entry, apiKey }))}
                            actions={<>
                                <Pressable accessibilityRole="button" accessibilityLabel={keyVisible ? '隐藏 API Key' : '显示 API Key'} onPress={() => setKeyVisible(!keyVisible)} style={styles.iconButton}>{keyVisible ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}</Pressable>
                                <Pressable accessibilityRole="button" accessibilityLabel="粘贴 API Key" onPress={() => { void paste('apiKey'); }} style={styles.textButton}><Text style={{ color: Colors.accent.gold }}>粘贴</Text></Pressable>
                            </>} />

                        <View style={[styles.sectionHeader, styles.modelHeader, { borderColor: Colors.border.subtle }]}>
                            <Text style={[styles.sectionTitle, { color: Colors.text.heading }]}>模型</Text>
                            {!pickerOpen && <Pressable accessibilityRole="button" accessibilityLabel="添加模型" onPress={openPicker} style={styles.textButton}>
                                <Text style={{ color: Colors.accent.gold, fontSize: 13 }}>＋ 添加模型</Text>
                            </Pressable>}
                        </View>
                        {provider.models.length > 0 && <View style={styles.chips}>
                            {provider.models.map((entry) => {
                                const selected = entry.id === model?.id;
                                return <View key={entry.id} style={[styles.chip, { borderColor: selected ? Colors.accent.gold : Colors.border.subtle, backgroundColor: selected ? Colors.bg.elevated : 'transparent' }]}>
                                    <Pressable accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={`使用模型 ${entry.model}`}
                                        onPress={() => changeProvider((item) => ({ ...item, activeModelId: entry.id }))} style={styles.chipMain}>
                                        <View style={[styles.statusDot, { backgroundColor: entry.protocolVerified ? Colors.accent.jade : Colors.border.normal }]} />
                                        <Text numberOfLines={1} style={[styles.chipText, { color: selected ? Colors.accent.gold : Colors.text.primary }]}>{entry.model}</Text>
                                    </Pressable>
                                    <Pressable accessibilityRole="button" accessibilityLabel={`移除模型 ${entry.model}`} onPress={() => removeModel(entry)} hitSlop={6} style={styles.chipRemove}>
                                        <CloseIcon size={12} color={Colors.text.tertiary} />
                                    </Pressable>
                                </View>;
                            })}
                        </View>}
                        {pickerOpen && <View style={styles.picker}>
                            <View style={[styles.inputRow, { borderColor: Colors.accent.gold, backgroundColor: Colors.bg.input }]}>
                                <TextInput accessibilityLabel="搜索或输入模型名称" autoCapitalize="none" autoCorrect={false} autoFocus
                                    value={query} placeholder="搜索模型，或直接输入模型名称" placeholderTextColor={Colors.text.tertiary}
                                    style={[styles.input, { color: Colors.text.primary }]} onChangeText={setQuery} returnKeyType="done" onSubmitEditing={commitModelQuery} />
                                <Pressable accessibilityRole="button" accessibilityLabel="收起" onPress={closePicker} style={styles.iconButton}>
                                    <ChevronDownIcon size={18} color={Colors.accent.gold} />
                                </Pressable>
                            </View>
                            <View style={[styles.dropdown, { backgroundColor: Colors.bg.elevated, borderColor: Colors.border.normal }]}>
                                <View style={[styles.dropdownHead, { borderBottomColor: Colors.border.subtle }]}>
                                    <Text style={muted}>{catalogLoading ? '正在获取模型列表…' : catalogModels.length ? `接口提供 ${catalogModels.length} 个模型` : catalogError ?? (isReady(provider) ? '' : '填好 Base URL 和 Key 后可获取模型列表')}</Text>
                                    {isReady(provider) && (catalogLoading ? <ActivityIndicator size="small" color={Colors.accent.gold} /> : <Pressable accessibilityRole="button" onPress={() => { void loadCatalog(); }} style={styles.textButton}>
                                        <Text style={{ color: Colors.accent.gold, fontSize: 12 }}>刷新</Text>
                                    </Pressable>)}
                                </View>
                                <ScrollView style={styles.modelList} nestedScrollEnabled keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator>
                                    {query.trim() && !catalogModels.some((entry) => entry.id === query.trim()) ? <Pressable accessibilityRole="button" onPress={commitModelQuery}
                                        style={({ pressed }) => [styles.modelOption, { borderBottomColor: Colors.border.subtle, backgroundColor: pressed ? Colors.bg.card : 'transparent' }]}>
                                        <Text style={[styles.optionName, { color: Colors.accent.gold }]}>使用「{query.trim()}」</Text>
                                    </Pressable> : null}
                                    {modelOptions.map((entry) => <Pressable key={entry.id} accessibilityRole="button" onPress={() => addModel(entry.id, entry)}
                                        style={({ pressed }) => [styles.modelOption, { borderBottomColor: Colors.border.subtle, backgroundColor: pressed ? Colors.bg.card : 'transparent' }]}>
                                        <Text style={[styles.optionName, { color: Colors.text.primary }]}>{entry.id}</Text>
                                        {entry.endpoints?.length ? <Text style={muted}>{entry.endpoints.map((protocol) => protocol === 'responses' ? 'Responses' : 'Anthropic').join(' / ')}</Text> : null}
                                    </Pressable>)}
                                </ScrollView>
                            </View>
                        </View>}

                        <View style={[styles.statusRow, { borderColor: Colors.border.subtle }]}>
                            <View style={styles.statusText}>
                                <View style={styles.statusHeading}>
                                    {testing && <ActivityIndicator size="small" color={Colors.accent.gold} />}
                                    <Text accessibilityRole={status.tone === 'error' ? 'alert' : undefined} accessibilityLiveRegion="polite"
                                        style={{ flexShrink: 1, color: statusColor, fontSize: 13, lineHeight: 20, fontWeight: status.tone === 'neutral' ? '400' : '600' }}>
                                        {status.tone === 'success' && !testing ? '✓ ' : status.tone === 'error' ? '✕ ' : ''}{status.message}
                                    </Text>
                                </View>
                                {status.hint ? <Text style={caption}>{status.hint}</Text> : null}
                            </View>
                            {(model || testing) && <Pressable accessibilityRole="button" onPress={() => { if (testing) cancelTest(); else void runTest(); }} style={styles.textButton}>
                                <Text style={{ color: testing ? Colors.text.secondary : Colors.accent.gold, fontSize: 13 }}>{testing ? '取消' : model?.protocolVerified || visibleFeedback ? '重新检测' : '检测连接'}</Text>
                            </Pressable>}
                        </View>
                        {!!visibleFeedback?.attempts?.length && visibleFeedback.tone === 'error' && <>
                            <Pressable accessibilityRole="button" accessibilityState={{ expanded: detailsOpen }} onPress={() => setDetailsOpen(!detailsOpen)} style={styles.detailsToggle}>
                                <Text style={caption}>{detailsOpen ? '收起详情' : '查看详情'}</Text>{detailsOpen ? <ChevronDownIcon size={14} /> : <ChevronRightIcon size={14} />}
                            </Pressable>
                            {detailsOpen && visibleFeedback.attempts.map((attempt) => <View key={attempt.protocol} style={[styles.attempt, { borderColor: Colors.border.subtle }]}>
                                <Text style={{ color: attempt.success ? Colors.accent.jade : Colors.accent.red, fontSize: 12 }}>
                                    {getProtocolLabel(attempt.protocol)} · {attempt.success ? '成功' : attempt.result?.meta.httpStatus ? `HTTP ${attempt.result.meta.httpStatus}` : '失败'}
                                </Text>
                                <Text selectable style={muted}>{attempt.endpoint}</Text>
                                {attempt.error ? <Text selectable style={caption}>{attempt.result?.providerError?.message ?? attempt.error}</Text> : null}
                            </View>)}
                        </>}

                        {model && <>
                            <Text style={muted}>思考强度在 AI 分析页右上角的模型面板里调整。</Text>
                            <Pressable accessibilityRole="button" accessibilityState={{ expanded: advancedOpen }} onPress={() => setAdvancedOpen(!advancedOpen)}
                                style={({ pressed }) => [styles.disclosure, { borderColor: Colors.border.subtle, opacity: pressed ? 0.65 : 1 }]}>
                                <Text style={{ flex: 1, color: Colors.text.primary, fontSize: 14 }}>高级</Text>
                                <Text style={muted}>协议 · 输出上限 · 温度</Text>
                                {advancedOpen ? <ChevronDownIcon size={16} /> : <ChevronRightIcon size={16} />}
                            </Pressable>
                            {advancedOpen && <AIModelControls key={`${provider.id}:${model.id}`} provider={provider} model={model} onChange={changeModel}
                                capabilities={catalog?.formKey === currentKey ? catalog.capabilities : undefined} />}
                        </>}
                    </View> : <View style={styles.empty}>
                        <Text style={[styles.sectionTitle, { color: Colors.text.heading }]}>{settings.providers.length ? '选择一个接口' : '添加第一个接口'}</Text>
                        <Text style={[caption, { textAlign: 'center' }]}>{settings.providers.length ? '在接口列表中选择要配置的服务。' : '填写服务商或中转站提供的 Base URL 和 Key，再添加模型即可。'}</Text>
                        {!settings.providers.length && <Pressable accessibilityRole="button" onPress={addProvider} style={[styles.emptyButton, { backgroundColor: Colors.accent.gold }]}>
                            <Text style={{ color: Colors.text.inverse, fontSize: 14, fontWeight: '600' }}>添加接口</Text>
                        </Pressable>}
                    </View>}
                </ScrollView>
            </View>
            <View style={[styles.footer, { borderColor: Colors.border.subtle }]}>
                <Text numberOfLines={2} accessibilityLiveRegion="polite" style={[styles.saveState, muted, saveState.status === 'error' && { color: Colors.accent.red }]}>{saveLabel}</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, minHeight: 0 }, body: { flex: 1, minHeight: 0 }, wideBody: { flexDirection: 'row' },
    providers: { flexShrink: 0 }, tabs: { borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 20 },
    sidebar: { width: 200, padding: 14, borderRightWidth: StyleSheet.hairlineWidth }, providerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    providerTabs: { gap: 14 }, providerColumn: { gap: 8 }, provider: { maxWidth: 200, minHeight: 42, paddingVertical: 11, paddingHorizontal: 3, borderBottomWidth: 2 },
    sidebarProvider: { maxWidth: '100%', borderBottomWidth: 0, borderLeftWidth: 2, borderRadius: 6, paddingHorizontal: 12, gap: 6 },
    providerName: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    statusDot: { width: 6, height: 6, borderRadius: 3 },
    formScroll: { flex: 1, minWidth: 0 }, form: { paddingHorizontal: 24, paddingTop: 14, paddingBottom: 24, gap: 16 }, formFields: { gap: 16 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, sectionTitle: { fontSize: 16, fontWeight: '600' },
    titleButton: { flex: 1, minHeight: 40, justifyContent: 'center' },
    modelHeader: { marginTop: 6, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth }, label: { fontSize: 13, fontWeight: '500' }, field: { gap: 8 },
    inputRow: { minHeight: 46, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 9, paddingLeft: 12, paddingRight: 4 },
    input: { flex: 1, minWidth: 0, minHeight: 46, paddingVertical: 10, paddingRight: 8, fontSize: 14 }, iconButton: { minWidth: 40, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
    textButton: { minHeight: 40, paddingHorizontal: 9, alignItems: 'center', justifyContent: 'center' },
    preview: { gap: 4, paddingHorizontal: 2 }, previewRow: { flexDirection: 'row', gap: 8 }, previewLabel: { width: 82 }, previewUrl: { flex: 1 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: -4 },
    chip: { maxWidth: '100%', flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 999, paddingLeft: 12 },
    chipMain: { flexShrink: 1, minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 7 },
    chipText: { flexShrink: 1, fontSize: 13 }, chipRemove: { width: 32, height: 36, alignItems: 'center', justifyContent: 'center' },
    picker: { gap: 6 }, dropdown: { borderWidth: 1, borderRadius: 9, overflow: 'hidden' },
    dropdownHead: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingLeft: 13, paddingRight: 4, borderBottomWidth: StyleSheet.hairlineWidth },
    modelList: { maxHeight: 240 },
    modelOption: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 13, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
    optionName: { flex: 1, minWidth: 0, fontSize: 13, lineHeight: 20 },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
    statusText: { flex: 1, gap: 2 }, statusHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    detailsToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32, marginTop: -8 },
    attempt: { gap: 4, paddingVertical: 8, paddingLeft: 10, borderLeftWidth: 2 },
    disclosure: { minHeight: 50, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: 10 },
    empty: { minHeight: 220, justifyContent: 'center', alignItems: 'center', gap: 12, paddingHorizontal: 12 },
    emptyButton: { minHeight: 44, paddingHorizontal: 22, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
    footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 24, paddingTop: 10, paddingBottom: 14 }, saveState: { textAlign: 'right' },
});
