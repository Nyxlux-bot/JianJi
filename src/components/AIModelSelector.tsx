import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { getActiveModel, getActiveProvider, getProviderDisplayName, getSettings, saveSettings, subscribeSettings, updateProviderProfile, type AISettings } from '../services/settings';
import { FontSize } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';

/** A search box only earns its place once the list is longer than a glance. */
const SEARCH_THRESHOLD = 6;
const ROW_INSET = 14;

/** '#RRGGBB' + alpha → rgba(); other formats are returned unchanged. */
function withAlpha(color: string, alpha: number): string {
    const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color.trim());
    if (!match) return color;
    const [r, g, b] = match.slice(1).map((part) => parseInt(part, 16));
    return `rgba(${r},${g},${b},${alpha})`;
}

/** Fades from transparent to the line color and back, in the same RGB so no gray fringe appears. */
function taper(rgb: string, alpha: number) {
    return [`rgba(${rgb},0)`, `rgba(${rgb},${alpha})`, `rgba(${rgb},${alpha})`, `rgba(${rgb},0)`] as const;
}

/** An engraved line between sheet sections: a dark groove over a light highlight, tapering at both ends. */
export function EngravedDivider({ dark }: { dark: boolean }) {
    const groove = dark ? taper('0,0,0', 0.75) : taper('60,40,10', 0.2);
    const light = dark ? taper('255,255,255', 0.1) : taper('255,255,255', 1);
    const line = { locations: [0, 0.15, 0.85, 1] as const, start: { x: 0, y: 0.5 }, end: { x: 1, y: 0.5 }, style: styles.dividerLine };
    return (
        <View pointerEvents="none" style={styles.divider}>
            <LinearGradient colors={groove} {...line} />
            <LinearGradient colors={light} {...line} />
        </View>
    );
}

/**
 * Searchable model list for the AI page sheet, grouped by provider when there
 * is more than one. The current model is marked by a theme-colored gradient.
 */
export default function AIModelPicker({ visible, maxHeight }: { visible: boolean; maxHeight: number }) {
    const { Colors, theme } = useTheme();
    const dark = theme !== 'yang';
    const [settings, setSettings] = useState<AISettings | null>(null);
    const [query, setQuery] = useState('');
    const [focused, setFocused] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    useEffect(() => {
        if (!visible) return;
        let mounted = true;
        setQuery('');
        const unsubscribe = subscribeSettings((value) => { if (mounted) setSettings(value); });
        getSettings().then((value) => { if (mounted) { setSettings(value); setError(''); } })
            .catch((reason: unknown) => { if (mounted) setError(reason instanceof Error ? reason.message : '读取模型配置失败'); });
        return () => { mounted = false; unsubscribe(); };
    }, [visible]);
    const provider = settings ? getActiveProvider(settings) : undefined;
    const model = getActiveModel(provider);
    const providers = useMemo(() => settings?.providers ?? [], [settings]);
    const total = providers.reduce((sum, entry) => sum + entry.models.length, 0);
    const groups = useMemo(() => {
        const keyword = query.trim().toLowerCase();
        return providers.map((entry) => ({
            entry,
            ready: Boolean(entry.apiKey.trim() && entry.apiUrl.trim()),
            models: entry.models.filter((candidate) => !keyword || candidate.model.toLowerCase().includes(keyword)),
        })).filter((group) => !keyword || group.models.length > 0);
    }, [providers, query]);
    const select = async (providerId: string, modelId: string) => {
        if (busy) return;
        setBusy(true); setError('');
        try {
            const current = await getSettings();
            const existing = current.providers.find((item) => item.id === providerId);
            if (!existing?.models.some((item) => item.id === modelId)) throw new Error('该模型已删除，请重新选择。');
            const next = updateProviderProfile({ ...current, activeProviderId: providerId }, providerId, (item) => ({ ...item, activeModelId: modelId }));
            await saveSettings(next);
            setSettings(next);
        } catch (reason: unknown) {
            setError(reason instanceof Error ? reason.message : '保存模型选择失败');
        } finally {
            setBusy(false);
        }
    };
    const accent = Colors.accent.gold;
    return <View>
        {total > SEARCH_THRESHOLD || query ? (
            <View style={[styles.search, { backgroundColor: Colors.bg.input, borderColor: focused ? accent : Colors.border.subtle }]}>
                <TextInput accessibilityLabel="搜索模型" value={query} onChangeText={setQuery} placeholder={`搜索 ${total} 个模型`}
                    placeholderTextColor={Colors.text.tertiary} autoCapitalize="none" autoCorrect={false} returnKeyType="search"
                    onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
                    style={[styles.searchInput, { color: Colors.text.primary }]} />
            </View>
        ) : null}
        <ScrollView style={{ maxHeight }} nestedScrollEnabled keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {!providers.length && <Text style={[styles.empty, { color: Colors.text.secondary }]}>还没有接口。到「设置 › AI 中枢」添加 Base URL、Key 和模型。</Text>}
            {providers.length > 0 && groups.length === 0 ? <Text style={[styles.empty, { color: Colors.text.secondary }]}>没有匹配「{query.trim()}」的模型</Text> : null}
            {groups.map(({ entry, ready, models }) => {
                const selectedIndex = models.findIndex((candidate) => provider?.id === entry.id && model?.id === candidate.id);
                return (
                    <View key={entry.id} style={styles.group}>
                        {providers.length > 1 ? (
                            <Text style={[styles.groupTitle, { color: Colors.text.tertiary }]} numberOfLines={1}>
                                {getProviderDisplayName(entry)}{ready ? '' : ' · 待填写地址或 Key'}
                            </Text>
                        ) : null}
                        {models.length === 0 && <Text style={[styles.empty, { color: Colors.text.tertiary }]}>未添加模型</Text>}
                        {models.map((candidate, index) => {
                            const selected = index === selectedIndex;
                            return (
                                <Pressable key={candidate.id} accessibilityRole="button" accessibilityState={{ selected, disabled: busy || !ready }}
                                    disabled={busy || !ready} onPress={() => { void select(entry.id, candidate.id); }}
                                    style={({ pressed }) => [styles.row, { opacity: !ready ? 0.45 : pressed && !selected ? 0.6 : 1 }]}>
                                    {selected ? (
                                        <LinearGradient pointerEvents="none" style={StyleSheet.absoluteFill}
                                            colors={[withAlpha(accent, dark ? 0.3 : 0.22), withAlpha(accent, dark ? 0.1 : 0.08), withAlpha(accent, 0)]}
                                            locations={[0, 0.55, 1]} start={{ x: 1, y: 0.5 }} end={{ x: 0, y: 0.5 }} />
                                    ) : null}
                                    <Text numberOfLines={1} style={[styles.rowName, selected
                                        ? { color: accent, fontWeight: '600' } : { color: Colors.text.primary }]}>{candidate.model}</Text>
                                </Pressable>
                            );
                        })}
                    </View>
                );
            })}
            {providers.length > 0 ? <Text style={[styles.footnote, { color: Colors.text.tertiary }]}>添加或移除模型请到「设置 › AI 中枢」</Text> : null}
        </ScrollView>
        {error !== '' && <Text accessibilityRole="alert" style={[styles.error, { color: Colors.accent.red }]}>{error}</Text>}
    </View>;
}

const styles = StyleSheet.create({
    search: { minHeight: 42, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, justifyContent: 'center', marginBottom: 10 },
    searchInput: { minHeight: 40, fontSize: FontSize.sm, paddingVertical: 8 },
    empty: { paddingVertical: 12, paddingHorizontal: ROW_INSET, fontSize: FontSize.sm, lineHeight: 20 },
    group: { paddingBottom: 6 },
    groupTitle: { fontSize: FontSize.xs, letterSpacing: 1, paddingHorizontal: ROW_INSET, marginTop: 6, marginBottom: 4 },
    row: { minHeight: 46, justifyContent: 'center', paddingHorizontal: ROW_INSET, borderRadius: 12, overflow: 'hidden' },
    rowName: { fontSize: FontSize.md },
    divider: { height: 2, marginHorizontal: ROW_INSET },
    dividerLine: { height: 1 },
    footnote: { fontSize: FontSize.xs, lineHeight: 18, paddingHorizontal: ROW_INSET, marginTop: 6 },
    error: { fontSize: FontSize.xs, marginTop: 6 },
});
