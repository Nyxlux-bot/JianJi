import React, { useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../theme/ThemeContext';
import { CustomAlert } from './CustomAlertProvider';
import AIModelControls, { AIChoice } from './AIModelControls';
import { ChevronDownIcon, ChevronRightIcon, EyeIcon, EyeOffIcon, MoreVerticalIcon } from './Icons';
import { createModelProfile, createProviderProfile, getActiveModel, getActiveProvider, sameProviderConfig, toProviderConfig, updateModelProfile, updateProviderProfile, type AISettings } from '../services/settings';
import { getProtocolLabel, inferProviderProtocol } from '../services/ai-endpoints';
import { fetchProviderDiscovery } from '../services/ai-models';
import { testProviderConnection, type AIProviderConnectionAttempt } from '../services/ai-provider-client';
import type { AIModelMetadata, AIModelProfile, AIProviderCapabilities, AIProviderProfile } from '../services/ai-provider-types';
import { DEFAULT_REASONING_OUTPUT_TOKENS } from '../services/ai-model-capabilities';

interface Operation {
    controller: AbortController;
    key: string;
    kind: 'models' | 'test';
}
interface Feedback {
    key: string;
    message: string;
    tone: 'neutral' | 'success' | 'error';
    attempts?: AIProviderConnectionAttempt[];
}
const EMPTY_MODELS: AIModelMetadata[] = [];

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

function Field({ label, value, onChangeText, placeholder, secureTextEntry = false, actions, disabled = false }: {
    label: string; value: string; onChangeText: (value: string) => void; placeholder?: string;
    secureTextEntry?: boolean; actions?: React.ReactNode; disabled?: boolean;
}) {
    const { Colors } = useTheme();
    const [focused, setFocused] = useState(false);
    return <View style={styles.field}>
        <Text style={[styles.label, { color: Colors.text.secondary }]}>{label}</Text>
        <View style={[styles.inputRow, { borderColor: focused ? Colors.accent.gold : Colors.border.subtle, backgroundColor: Colors.bg.input }]}>
            <TextInput accessibilityLabel={label} value={value} placeholder={placeholder} placeholderTextColor={Colors.text.tertiary}
                style={[styles.input, { color: Colors.text.primary }]} editable={!disabled} autoCapitalize="none" autoCorrect={false}
                secureTextEntry={secureTextEntry} onChangeText={onChangeText} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} />
            {actions}
        </View>
    </View>;
}

export interface AIProviderSettingsHandle {
    hasPendingModel: () => boolean;
    commitPendingModel: () => void;
}

export default function AIProviderSettings({ settings, onChange, onSave, hasUnsavedChanges, ref }: {
    settings: AISettings; onChange: React.Dispatch<React.SetStateAction<AISettings>>;
    onSave: () => Promise<boolean>; hasUnsavedChanges: boolean;
    ref?: React.Ref<AIProviderSettingsHandle>;
}) {
    const { Colors } = useTheme();
    const { width } = useWindowDimensions();
    const wide = width >= 760;
    const [catalog, setCatalog] = useState<{ key: string; models: AIModelMetadata[]; capabilities: AIProviderCapabilities; formKey: string } | null>(null);
    const [busy, setBusy] = useState<Operation['kind'] | null>(null);
    const [feedback, setFeedback] = useState<Feedback | null>(null);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [keyVisible, setKeyVisible] = useState(false);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [modelFocused, setModelFocused] = useState(false);
    const settingsRef = useRef(settings);
    const mounted = useRef(false);
    const operationRef = useRef<Operation | null>(null);
    const savingRef = useRef(false);
    settingsRef.current = settings;
    const provider = getActiveProvider(settings);
    const model = getActiveModel(provider);
    const currentKey = formKey(provider, model);
    const catalogModels = provider && catalog?.key === connectionKey(provider) ? catalog.models : EMPTY_MODELS;
    const visibleFeedback = feedback?.key === currentKey ? feedback : null;

    useEffect(() => {
        mounted.current = true;
        return () => { mounted.current = false; operationRef.current?.controller.abort(); operationRef.current = null; };
    }, []);
    useEffect(() => {
        setKeyVisible(false); setPickerOpen(false); setQuery(''); setDetailsOpen(false);
    }, [provider?.id]);
    useEffect(() => {
        const operation = operationRef.current;
        if (operation && operation.key !== currentKey) {
            operation.controller.abort(); operationRef.current = null; setBusy(null);
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
    const selectModel = (name: string, metadata?: AIModelMetadata) => {
        const currentProvider = getActiveProvider(settingsRef.current);
        if (!currentProvider || !name.trim()) return;
        const existing = currentProvider.models.find((entry) => entry.model === name.trim());
        const selected = existing ?? createModelProfile(name, inferProviderProtocol(currentProvider.apiUrl, name));
        if (!existing && metadata?.reasoning?.efforts.includes('high')) {
            selected.reasoning = 'high';
            selected.maxOutputTokens = DEFAULT_REASONING_OUTPUT_TOKENS;
        }
        if (!existing && metadata?.maxOutputTokens) selected.maxOutputTokens = Math.min(selected.maxOutputTokens, metadata.maxOutputTokens);
        changeSettings((current) => updateProviderProfile(current, currentProvider.id, (entry) => ({
            ...entry, models: existing ? entry.models : [...entry.models, selected], activeModelId: selected.id,
        })));
        setPickerOpen(false); setQuery(''); Keyboard.dismiss();
    };
    const commitModelQuery = () => {
        if (pickerOpen && query.trim()) selectModel(query, catalogModels.find((entry) => entry.id === query.trim()));
        else { setPickerOpen(false); Keyboard.dismiss(); }
    };
    useImperativeHandle(ref, () => ({
        hasPendingModel: () => Boolean(provider && pickerOpen && query.trim() && query.trim() !== model?.model),
        commitPendingModel: commitModelQuery,
    }));
    const modelOptions = useMemo(() => {
        const options = new Map<string, { name: string; saved: boolean; metadata?: AIModelMetadata }>();
        for (const entry of provider?.models ?? []) options.set(entry.model, { name: entry.model, saved: true });
        for (const entry of catalogModels) options.set(entry.id, { name: entry.id, saved: options.get(entry.id)?.saved ?? false, metadata: entry });
        const keyword = query.trim().toLowerCase();
        return [...options.values()].filter((entry) => !keyword || entry.name.toLowerCase().includes(keyword))
            .sort((a, b) => Number(b.saved) - Number(a.saved) || a.name.localeCompare(b.name));
    }, [provider?.models, catalogModels, query]);

    const isCurrentOperation = (operation: Operation) => {
        const current = getActiveProvider(settingsRef.current);
        return mounted.current && operationRef.current === operation && !operation.controller.signal.aborted
            && formKey(current, getActiveModel(current)) === operation.key;
    };
    const request = async (kind: Operation['kind']) => {
        if (operationRef.current || savingRef.current) return;
        if (kind === 'test') commitModelQuery();
        const selectedProvider = getActiveProvider(settingsRef.current);
        if (!selectedProvider) return;
        const selectedModel = getActiveModel(selectedProvider);
        const key = formKey(selectedProvider, selectedModel);
        if (!selectedProvider.apiUrl.trim() || !selectedProvider.apiKey.trim() || (kind === 'test' && !selectedModel?.model.trim())) {
            setFeedback({ key, tone: 'error', message: '请填写接口地址和 API Key，并选择要测试的模型。' });
            return;
        }
        const selected = selectedModel ?? createModelProfile('', inferProviderProtocol(selectedProvider.apiUrl));
        const config = toProviderConfig(selectedProvider, selected);
        const operation: Operation = { controller: new AbortController(), key, kind };
        operationRef.current = operation;
        setBusy(kind); setDetailsOpen(false);
        setFeedback({ key, tone: 'neutral', message: kind === 'models' ? '正在获取模型列表…' : '正在准备连接测试…' });
        try {
            if (kind === 'models') {
                const discovery = await fetchProviderDiscovery(config, operation.controller.signal);
                if (!isCurrentOperation(operation)) return;
                setCatalog({ key: connectionKey(selectedProvider), models: discovery.models, capabilities: discovery.capabilities, formKey: key });
                setPickerOpen(true); setQuery('');
                setFeedback({ key, tone: 'neutral', message: discovery.models.length ? `已获取 ${discovery.models.length} 个模型` : '接口未公开模型列表，可直接输入模型名称。' });
                return;
            }
            const response = await testProviderConnection(config, {
                signal: operation.controller.signal,
                onAttempt: (protocol, index, total) => {
                    if (isCurrentOperation(operation)) setFeedback({ key, tone: 'neutral', message: `正在测试 ${getProtocolLabel(protocol)}${total > 1 ? `（${index}/${total}）` : ''}…` });
                },
            });
            if (!isCurrentOperation(operation)) return;
            const attempts = response.attempts.map((attempt) => ({ ...attempt, error: attempt.error ? redactError(attempt.error, config.apiKey) : undefined }));
            if (!response.success || !response.selectedProtocol) {
                setFeedback({ key, tone: 'error', message: config.protocolPreference === 'auto' ? '两种协议均未通过连接测试' : `${getProtocolLabel(config.protocol)} 连接测试失败`, attempts });
                setDetailsOpen(true);
                return;
            }
            const protocol = response.selectedProtocol;
            changeSettings((current) => updateProviderProfile(current, selectedProvider.id, (entry) => {
                const currentModel = getActiveModel(entry);
                if (!currentModel || !sameProviderConfig(config, toProviderConfig(entry, currentModel))) return entry;
                return { ...entry, models: entry.models.map((item) => item.id === selected.id
                    ? { ...item, protocol, protocolVerified: true, revision: item.revision + 1 } : item) };
            }));
            const updated = getActiveProvider(settingsRef.current);
            const duration = response.selectedResult ? (response.selectedResult.meta.durationMs / 1000).toFixed(1) : undefined;
            setFeedback({ key: formKey(updated, getActiveModel(updated)), tone: 'success', attempts,
                message: `连接成功 · ${getProtocolLabel(protocol)}${duration ? ` · ${duration} 秒` : ''}` });
        } catch (reason: unknown) {
            if (isCurrentOperation(operation)) setFeedback({ key, tone: 'error', message: redactError(reason instanceof Error ? reason.message : '接口请求失败', config.apiKey) });
        } finally {
            if (operationRef.current === operation) { operationRef.current = null; if (mounted.current) setBusy(null); }
        }
    };
    const cancelOperation = () => {
        operationRef.current?.controller.abort(); operationRef.current = null; setBusy(null);
        setFeedback({ key: currentKey, tone: 'neutral', message: '已取消' });
    };
    const save = async () => {
        if (savingRef.current || operationRef.current) return;
        savingRef.current = true; setSaving(true);
        try {
            if (await onSave()) {
                const updated = getActiveProvider(settingsRef.current);
                if (mounted.current) setFeedback({ key: formKey(updated, getActiveModel(updated)), tone: 'success', message: '配置已保存' });
            }
        } finally { savingRef.current = false; if (mounted.current) setSaving(false); }
    };
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
    const deleteProvider = () => {
        if (!provider) return;
        CustomAlert.alert('删除接口', `删除“${provider.name}”的配置？历史分析仍可查看。`, [
            { text: '取消', style: 'cancel' }, { text: '删除', style: 'destructive', onPress: () => changeSettings((current) => ({
                ...current, providers: current.providers.filter((item) => item.id !== provider.id), activeProviderId: current.activeProviderId === provider.id ? null : current.activeProviderId,
            })) },
        ]);
    };
    const deleteModel = () => {
        if (!model) return;
        CustomAlert.alert('移除模型配置', model.model, [{ text: '取消', style: 'cancel' }, { text: '移除', style: 'destructive', onPress: () => changeProvider((entry) => ({
            ...entry, models: entry.models.filter((item) => item.id !== model.id), activeModelId: entry.activeModelId === model.id ? null : entry.activeModelId,
        })) }]);
    };
    const protocolStatus = model ? `${model.protocolPreference === 'auto' ? '自动适配' : '指定协议'} · ${model.protocolVerified ? `已验证 ${getProtocolLabel(model.protocol)}` : '待测试'}` : '自动适配 Responses / Anthropic';
    const caption = { color: Colors.text.secondary, fontSize: 12, lineHeight: 18 };
    const noticeColor = visibleFeedback?.tone === 'error' ? Colors.accent.red : visibleFeedback?.tone === 'success' ? Colors.accent.jade : Colors.text.secondary;
    return (
        <View style={styles.container}>
            <View style={[styles.body, wide && styles.wideBody]}>
                <View style={[styles.providers, wide ? styles.sidebar : styles.tabs, { borderColor: Colors.border.subtle }]}>
                    <View style={styles.providerHeader}>
                        <Text style={[styles.label, { color: Colors.text.secondary }]}>接口</Text>
                        <Pressable accessibilityRole="button" accessibilityLabel="新增接口" disabled={saving} onPress={() => {
                            const added = createProviderProfile(); added.name = `接口 ${settings.providers.length + 1}`;
                            changeSettings((current) => ({ ...current, providers: [...current.providers, added], activeProviderId: added.id }));
                        }} style={({ pressed }) => [styles.textButton, { opacity: pressed || saving ? 0.5 : 1 }]}>
                            <Text style={{ color: Colors.accent.gold, fontSize: 13 }}>＋ 新增</Text>
                        </Pressable>
                    </View>
                    <ScrollView horizontal={!wide} showsHorizontalScrollIndicator={false} showsVerticalScrollIndicator nestedScrollEnabled
                        contentContainerStyle={wide ? styles.providerColumn : styles.providerTabs} keyboardShouldPersistTaps="handled">
                        {settings.providers.map((entry) => <Pressable key={entry.id} accessibilityRole="button" accessibilityLabel={`选择接口 ${entry.name}`}
                            accessibilityState={{ selected: entry.id === provider?.id, disabled: saving }} disabled={saving}
                            onPress={() => changeSettings((current) => ({ ...current, activeProviderId: entry.id }))}
                            style={({ pressed }) => [styles.provider, wide && styles.sidebarProvider, { borderColor: entry.id === provider?.id ? Colors.accent.gold : 'transparent',
                                backgroundColor: wide && entry.id === provider?.id ? Colors.bg.elevated : 'transparent', opacity: pressed ? 0.65 : 1 }]}>
                            <Text numberOfLines={2} style={{ color: entry.id === provider?.id ? Colors.accent.gold : Colors.text.primary, fontSize: 14, fontWeight: entry.id === provider?.id ? '600' : '400' }}>{entry.name || '未命名接口'}</Text>
                            {wide && <Text numberOfLines={2} style={caption}>{getActiveModel(entry)?.model || '未选择模型'}</Text>}
                        </Pressable>)}
                    </ScrollView>
                </View>
                <ScrollView style={styles.formScroll} contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator>
                    {provider ? <View pointerEvents={saving ? 'none' : 'auto'} style={styles.formFields}>
                        <View style={styles.sectionHeader}>
                            <Text style={[styles.sectionTitle, { color: Colors.text.heading }]}>连接配置</Text>
                            <Pressable accessibilityRole="button" accessibilityLabel="删除当前接口" onPress={deleteProvider} style={styles.iconButton}><MoreVerticalIcon size={20} /></Pressable>
                        </View>
                        <Field label="接口名称" value={provider.name} placeholder="例如：主接口" onChangeText={(name) => changeProvider((entry) => ({ ...entry, name }))} />
                        <Field label="API 地址" value={provider.apiUrl} placeholder="https://api.example.com/v1" onChangeText={(apiUrl) => changeProvider((entry) => ({ ...entry, apiUrl }))}
                            actions={<Pressable accessibilityRole="button" accessibilityLabel="粘贴 API 地址" onPress={() => { void paste('apiUrl'); }} style={styles.textButton}><Text style={{ color: Colors.accent.gold }}>粘贴</Text></Pressable>} />
                        <Field label="API Key" value={provider.apiKey} placeholder="输入或粘贴密钥" secureTextEntry={!keyVisible} onChangeText={(apiKey) => changeProvider((entry) => ({ ...entry, apiKey }))}
                            actions={<>
                                <Pressable accessibilityRole="button" accessibilityLabel={keyVisible ? '隐藏 API Key' : '显示 API Key'} onPress={() => setKeyVisible(!keyVisible)} style={styles.iconButton}>{keyVisible ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}</Pressable>
                                <Pressable accessibilityRole="button" accessibilityLabel="粘贴 API Key" onPress={() => { void paste('apiKey'); }} style={styles.textButton}><Text style={{ color: Colors.accent.gold }}>粘贴</Text></Pressable>
                            </>} />
                        <View style={[styles.sectionHeader, styles.modelHeader, { borderColor: Colors.border.subtle }]}>
                            <Text style={[styles.sectionTitle, { color: Colors.text.heading }]}>模型</Text>
                            <Pressable accessibilityRole="button" disabled={busy !== null} onPress={() => { void request('models'); }} style={styles.textButton}>
                                {busy === 'models' ? <ActivityIndicator size="small" color={Colors.accent.gold} /> : <Text style={{ color: busy ? Colors.text.tertiary : Colors.accent.gold, fontSize: 13 }}>获取模型</Text>}
                            </Pressable>
                        </View>
                        <View style={styles.picker}>
                            <View style={[styles.inputRow, { borderColor: pickerOpen || modelFocused ? Colors.accent.gold : Colors.border.subtle, backgroundColor: Colors.bg.input }]}>
                                <TextInput accessibilityLabel="搜索或输入模型名称" autoCapitalize="none" autoCorrect={false}
                                    value={pickerOpen ? query : model?.model ?? ''} placeholder={pickerOpen ? '搜索模型，或输入自定义名称' : '选择或输入模型名称'} placeholderTextColor={Colors.text.tertiary}
                                    style={[styles.input, { color: Colors.text.primary }]} onFocus={() => { setPickerOpen(true); setModelFocused(true); }} onBlur={() => setModelFocused(false)}
                                    onChangeText={(value) => { setPickerOpen(true); setQuery(value); }} returnKeyType="done" onSubmitEditing={commitModelQuery} />
                                <Pressable accessibilityRole="button" accessibilityLabel={pickerOpen ? '收起模型列表' : '展开模型列表'} accessibilityState={{ expanded: pickerOpen }} style={styles.iconButton}
                                    onPress={() => { if (pickerOpen) { setPickerOpen(false); setQuery(''); Keyboard.dismiss(); } else { setPickerOpen(true); setQuery(''); } }}>
                                    {pickerOpen ? <ChevronDownIcon size={18} color={Colors.accent.gold} /> : <ChevronRightIcon size={18} />}
                                </Pressable>
                            </View>
                            {pickerOpen && <View style={[styles.dropdown, { backgroundColor: Colors.bg.elevated, borderColor: Colors.border.normal }]}>
                                <ScrollView style={styles.modelList} nestedScrollEnabled keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator>
                                    {modelOptions.map((entry) => <Pressable key={entry.name} accessibilityRole="button" accessibilityState={{ selected: model?.model === entry.name }}
                                        onPress={() => selectModel(entry.name, entry.metadata)} style={({ pressed }) => [styles.modelOption, { borderBottomColor: Colors.border.subtle,
                                            backgroundColor: pressed || model?.model === entry.name ? Colors.bg.card : 'transparent' }]}>
                                        <Text style={[styles.optionName, { color: model?.model === entry.name ? Colors.accent.gold : Colors.text.primary }]}>{entry.name}</Text>
                                        <Text style={caption}>{model?.model === entry.name ? '已选' : entry.saved ? '已保存' : ''}</Text>
                                    </Pressable>)}
                                    {query.trim() && !modelOptions.some((entry) => entry.name === query.trim()) ? <Pressable accessibilityRole="button" onPress={commitModelQuery} style={styles.modelOption}>
                                        <Text style={[styles.optionName, { color: Colors.accent.gold }]}>使用「{query.trim()}」</Text>
                                    </Pressable> : null}
                                    {modelOptions.length === 0 && !query.trim() && <Text style={[styles.emptyList, caption]}>获取模型列表，或直接输入模型名称。</Text>}
                                </ScrollView>
                            </View>}
                        </View>
                        <View style={styles.protocolRow}>
                            <Text style={[styles.protocolText, caption]}>{protocolStatus}</Text>
                            {model && <Pressable accessibilityRole="button" accessibilityLabel="移除当前模型配置" onPress={deleteModel} style={styles.textButton}><Text style={caption}>移除</Text></Pressable>}
                        </View>
                        {model && <AIModelControls key={`${provider.id}:${model.id}`} provider={provider} model={model} onChange={changeModel}
                            capabilities={catalog?.formKey === currentKey ? catalog.capabilities : undefined} />}
                    </View> : <View style={styles.empty}>
                        <Text style={[styles.sectionTitle, { color: Colors.text.heading }]}>{settings.providers.length ? '选择一个接口' : '添加第一个接口'}</Text>
                        <Text style={caption}>{settings.providers.length ? '在接口列表中选择要配置的服务。' : '新增接口后，填写地址、密钥并选择模型。'}</Text>
                    </View>}
                    {visibleFeedback && <View style={[styles.feedback, { borderColor: Colors.border.subtle }]}>
                        <View style={styles.feedbackHeading}>
                            {busy && <ActivityIndicator size="small" color={Colors.accent.gold} />}
                            <Text accessibilityRole={visibleFeedback.tone === 'error' ? 'alert' : undefined} accessibilityLiveRegion="polite" style={{ flex: 1, color: noticeColor, fontSize: 13, lineHeight: 20 }}>{visibleFeedback.message}</Text>
                        </View>
                        {!!visibleFeedback.attempts?.length && <>
                            <Pressable accessibilityRole="button" accessibilityState={{ expanded: detailsOpen }} onPress={() => setDetailsOpen(!detailsOpen)} style={styles.detailsToggle}>
                                <Text style={caption}>{detailsOpen ? '收起测试详情' : '查看测试详情'}</Text><ChevronDownIcon size={14} />
                            </Pressable>
                            {detailsOpen && visibleFeedback.attempts.map((attempt) => <View key={attempt.protocol} style={styles.attempt}>
                                <Text style={{ color: attempt.success ? Colors.accent.jade : Colors.accent.red, fontSize: 12 }}>{getProtocolLabel(attempt.protocol)} · {attempt.success ? '成功' : attempt.code === 'invalid_configuration' ? '参数配置不兼容' : '失败'}</Text>
                                <Text selectable style={caption}>{attempt.error || attempt.result?.meta.endpointPath}</Text>
                            </View>)}
                        </>}
                    </View>}
                </ScrollView>
            </View>
            <View style={[styles.footer, { borderColor: Colors.border.subtle, backgroundColor: Colors.bg.card }]}>
                <Text numberOfLines={2} accessibilityLiveRegion="polite" style={[styles.saveState, caption, busy && { color: Colors.accent.gold }]}>
                    {busy && visibleFeedback ? visibleFeedback.message : hasUnsavedChanges || (pickerOpen && !!query.trim()) ? '有未保存的修改' : '配置已保存'}
                </Text>
                <View style={styles.footerActions}>
                    <View style={styles.footerButton}><AIChoice label={busy ? '取消' : '测试连接'} disabled={saving || !provider} onPress={() => { if (busy) cancelOperation(); else void request('test'); }} /></View>
                    <View style={styles.footerButton}><AIChoice primary label={saving ? '保存中…' : '保存配置'} disabled={saving || busy !== null || (!hasUnsavedChanges && !(pickerOpen && query.trim()))} onPress={() => { void save(); }} /></View>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, minHeight: 0 }, body: { flex: 1, minHeight: 0 }, wideBody: { flexDirection: 'row' },
    providers: { flexShrink: 0 }, tabs: { borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 20 },
    sidebar: { width: 190, padding: 14, borderRightWidth: StyleSheet.hairlineWidth }, providerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    providerTabs: { gap: 14 }, providerColumn: { gap: 8 }, provider: { maxWidth: 200, minHeight: 42, paddingVertical: 11, paddingHorizontal: 3, borderBottomWidth: 2 },
    sidebarProvider: { maxWidth: '100%', borderBottomWidth: 0, borderLeftWidth: 2, borderRadius: 6, paddingHorizontal: 12, gap: 6 },
    formScroll: { flex: 1, minWidth: 0 }, form: { paddingHorizontal: 24, paddingTop: 14, paddingBottom: 24, gap: 16 }, formFields: { gap: 16 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, sectionTitle: { fontSize: 16, fontWeight: '600' },
    modelHeader: { marginTop: 6, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth }, label: { fontSize: 13, fontWeight: '500' }, field: { gap: 8 },
    inputRow: { minHeight: 46, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 9, paddingLeft: 12, paddingRight: 4 },
    input: { flex: 1, minWidth: 0, minHeight: 46, paddingVertical: 10, paddingRight: 8, fontSize: 14 }, iconButton: { minWidth: 40, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
    textButton: { minHeight: 40, paddingHorizontal: 9, alignItems: 'center', justifyContent: 'center' },
    picker: { gap: 6 }, dropdown: { borderWidth: 1, borderRadius: 9, overflow: 'hidden' }, modelList: { maxHeight: 224 },
    modelOption: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 13, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
    optionName: { flex: 1, minWidth: 0, fontSize: 13, lineHeight: 20 }, emptyList: { padding: 16 }, protocolRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: -12 }, protocolText: { flex: 1 },
    empty: { minHeight: 190, justifyContent: 'center', alignItems: 'center', gap: 12 }, feedback: { paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, gap: 8 }, feedbackHeading: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    detailsToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 36 }, attempt: { gap: 5, paddingVertical: 8 },
    footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 24, paddingTop: 10, paddingBottom: 16, gap: 8 }, saveState: { textAlign: 'right' },
    footerActions: { flexDirection: 'row', gap: 10 }, footerButton: { flex: 1 },
});
