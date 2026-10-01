import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { AIExecutionMeta } from '../core/ai-execution-meta';
import { getReasoningLabel } from '../services/ai-model-capabilities';
import { getActiveModel, getActiveProvider, getSettings, saveSettings, subscribeSettings, updateModelProfile, updateProviderProfile, type AISettings } from '../services/settings';
import { useTheme } from '../theme/ThemeContext';
import AIModelControls, { AIChoice } from './AIModelControls';

export default function AIModelSelector({ visible, running }: { visible: boolean; running?: AIExecutionMeta }) {
    const { Colors } = useTheme();
    const [settings, setSettings] = useState<AISettings | null>(null);
    const [expanded, setExpanded] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    useEffect(() => {
        if (!visible) return;
        let mounted = true;
        const unsubscribe = subscribeSettings((value) => { if (mounted) setSettings(value); });
        getSettings().then((value) => { if (mounted) { setSettings(value); setError(''); } })
            .catch((reason: unknown) => { if (mounted) setError(reason instanceof Error ? reason.message : '读取模型配置失败'); });
        return () => { mounted = false; unsubscribe(); };
    }, [visible]);
    const provider = settings ? getActiveProvider(settings) : undefined;
    const model = getActiveModel(provider);
    const selectionLabel = model?.model ?? '选择模型';
    const runningLabel = running?.model;
    const persist = async (change: (current: AISettings) => AISettings) => {
        if (busy) return;
        setBusy(true); setError('');
        try {
            const next = change(await getSettings());
            await saveSettings(next);
            setSettings(next);
        } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : '保存模型选择失败'); }
        finally { setBusy(false); }
    };
    return <View style={[styles.container, { borderBottomColor: Colors.border.subtle }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="切换接口、模型与思考等级" accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)} style={styles.trigger}>
            <Text style={[styles.label, { color: Colors.accent.gold }]}>{runningLabel ?? selectionLabel}</Text>
            <Text style={{ color: Colors.text.secondary }}>{expanded ? '收起' : '切换'}</Text>
        </Pressable>
        {running && expanded && <Text style={{ color: Colors.text.secondary }}>本次：{running.providerName} · {getReasoningLabel(running.reasoning, running.thinkingBudgetTokens)}；下次：{selectionLabel}</Text>}
        {expanded && <ScrollView style={styles.options} nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {!settings?.providers.length && <Text style={{ color: Colors.text.secondary }}>请先在设置的 AI 中枢添加接口与模型。</Text>}
            {settings?.providers.map((entry) => <View key={entry.id} style={styles.group}>
                <Text style={{ color: Colors.text.secondary }}>{entry.name}{!entry.apiKey.trim() ? ' · 待配置 Key' : ''}</Text>
                <View style={styles.row}>{entry.models.map((candidate) => <AIChoice key={candidate.id} label={candidate.model} disabled={busy || !entry.apiKey.trim()}
                    selected={provider?.id === entry.id && model?.id === candidate.id} onPress={() => { void persist((current) => {
                        const existing = current.providers.find((item) => item.id === entry.id);
                        if (!existing?.models.some((item) => item.id === candidate.id)) throw new Error('该模型已删除，请重新选择。');
                        return updateProviderProfile({ ...current, activeProviderId: entry.id }, entry.id, (item) => ({ ...item, activeModelId: candidate.id }));
                    }); }} />)}</View>
            </View>)}
            {provider && model && <View pointerEvents={busy ? 'none' : 'auto'} style={styles.group}>
                <AIModelControls key={`${provider.id}:${model.id}`} compact provider={provider} model={model} onChange={(next) => { void persist((current) => {
                    const currentProvider = current.providers.find((item) => item.id === provider.id);
                    const currentModel = currentProvider?.models.find((item) => item.id === model.id);
                    if (!currentProvider || !currentModel || currentProvider.revision !== provider.revision || currentModel.revision !== model.revision) throw new Error('模型配置已更新，请重新选择等级。');
                    return updateProviderProfile(current, provider.id, (entry) => updateModelProfile(entry, model.id, () => next));
                }); }} />
            </View>}
        </ScrollView>}
        {error !== '' && <Text accessibilityRole="alert" style={{ color: Colors.accent.red }}>{error}</Text>}
    </View>;
}
const styles = StyleSheet.create({
    container: { paddingHorizontal: 20, paddingBottom: 8, borderBottomWidth: 1, gap: 8 },
    trigger: { flexDirection: 'row', minHeight: 44, alignItems: 'center', gap: 12 }, label: { flex: 1, fontSize: 13, lineHeight: 20 },
    options: { maxHeight: 290 }, group: { gap: 10, paddingVertical: 12 }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
