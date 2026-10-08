import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { getCachedCompatQuirks } from '../services/ai-compat-memory';
import { getProtocolLabel } from '../services/ai-endpoints';
import { isReasoningEnabled, resolveModelBehavior, resolveOutputBudget } from '../services/ai-model-capabilities';
import { getProviderCapabilities } from '../services/ai-provider-discovery';
import type { AIModelProfile, AIProviderCapabilities, AIProviderProfile, AIProviderProtocolPreference } from '../services/ai-provider-types';
import { toProviderConfig } from '../services/settings';
import { useTheme } from '../theme/ThemeContext';

export function AIChoice({ label, selected = false, disabled = false, primary = false, onPress }: {
    label: string; selected?: boolean; disabled?: boolean; primary?: boolean; onPress: () => void;
}) {
    const { Colors } = useTheme();
    const [focused, setFocused] = useState(false);
    return (
        <Pressable accessibilityRole="button" accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress}
            onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
            style={({ pressed }) => [styles.choice, {
                borderColor: focused || selected ? Colors.accent.gold : Colors.border.subtle,
                backgroundColor: primary ? Colors.accent.gold : selected ? Colors.bg.elevated : 'transparent',
                opacity: disabled ? 0.45 : pressed ? 0.7 : 1,
            }]}>
            <Text style={[styles.choiceText, { color: primary ? Colors.text.inverse : selected ? Colors.accent.gold : Colors.text.primary }]}>{label}</Text>
        </Pressable>
    );
}

export function AINumberField({ label, value, onChange, minimum = 0, maximum, integer = false, disabled = false, commitOnBlur = false }: {
    label: string; value: number; onChange: (value: number) => void; minimum?: number; maximum?: number;
    integer?: boolean; disabled?: boolean; commitOnBlur?: boolean;
}) {
    const { Colors } = useTheme();
    const [text, setText] = useState(Number.isFinite(value) ? String(value) : '');
    const [focused, setFocused] = useState(false);
    const editing = useRef(false);
    useEffect(() => { if (!editing.current) setText(Number.isFinite(value) ? String(value) : ''); }, [value]);
    const number = text.trim() ? Number(text) : NaN;
    const valid = Number.isFinite(number) && number >= minimum && (maximum === undefined || number <= maximum) && (!integer || Number.isSafeInteger(number));
    const finish = () => {
        if (!editing.current) return;
        editing.current = false;
        setFocused(false);
        if (commitOnBlur && valid && number !== value) onChange(number);
    };
    return (
        <View style={styles.field}>
            <View style={styles.numberRow}>
                <Text style={[styles.numberLabel, { color: disabled ? Colors.text.tertiary : Colors.text.secondary }]}>{label}</Text>
                <TextInput accessibilityLabel={label} value={text} keyboardType={integer ? 'number-pad' : 'decimal-pad'}
                    editable={!disabled} autoCorrect={false} selectTextOnFocus
                    style={[styles.numberInput, { color: disabled ? Colors.text.tertiary : Colors.text.primary, backgroundColor: Colors.bg.input,
                        borderColor: !valid ? Colors.accent.red : focused ? Colors.accent.gold : Colors.border.subtle }]}
                    onFocus={() => { editing.current = true; setFocused(true); }} onBlur={finish} onSubmitEditing={finish}
                    onChangeText={(next) => { setText(next); if (!commitOnBlur) onChange(next.trim() ? Number(next) : NaN); }} />
            </View>
            {!valid && <Text accessibilityRole="alert" style={{ color: Colors.accent.red, fontSize: 12 }}>
                {maximum === undefined ? `请输入不小于 ${minimum} 的${integer ? '整数' : '数字'}` : `请输入 ${minimum}～${maximum} 之间的${integer ? '整数' : '数字'}`}
            </Text>}
        </View>
    );
}

function formatTokens(value: number): string {
    return value >= 1000 ? `${Math.round(value / 1024)}k` : String(value);
}

/**
 * Advanced settings for one model: protocol, output limit, temperature and a
 * last-resort switch to stop sending thinking parameters. Thinking strength
 * itself is set on the AI page.
 */
export default function AIModelControls({ provider, model, onChange, capabilities: suppliedCapabilities }: {
    provider: AIProviderProfile; model: AIModelProfile; onChange: (model: AIModelProfile) => void;
    capabilities?: AIProviderCapabilities;
}) {
    const { Colors } = useTheme();
    const [cached, setCached] = useState<{ key: string; value: AIProviderCapabilities } | null>(null);
    const config = toProviderConfig(provider, model);
    const effective = model.protocolPreference === 'auto' ? config : { ...config, protocol: model.protocolPreference };
    const key = JSON.stringify([provider.id, provider.revision, provider.apiUrl, model.id, model.model, effective.protocol]);
    useEffect(() => {
        let current = true;
        if (provider.apiUrl.trim() && model.model.trim()) {
            getProviderCapabilities(effective).then((value) => { if (current) setCached({ key, value }); }).catch(() => undefined);
        }
        return () => { current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);
    const metadata = suppliedCapabilities?.model === model.model && suppliedCapabilities.protocol === effective.protocol
        ? suppliedCapabilities : cached?.key === key ? cached.value : undefined;
    const behavior = metadata ?? resolveModelBehavior(effective);
    const quirks = getCachedCompatQuirks(effective, effective.protocol) ?? {};
    const autoOutput = resolveOutputBudget({ ...effective, maxOutputTokensAuto: true }, behavior, quirks);
    const thinking = isReasoningEnabled(effective, behavior.reasoning);
    const temperatureActive = behavior.supportsTemperature && !quirks.dropTemperature && (!thinking || behavior.temperatureWithReasoning);
    const thinkingOverride = model.capabilityOverrides?.reasoning;
    const thinkingParams: 'auto' | 'off' | 'custom' = !thinkingOverride ? 'auto' : thinkingOverride.mode === 'unsupported' ? 'off' : 'custom';

    const changeProtocol = (protocolPreference: AIProviderProtocolPreference) => {
        if (protocolPreference === model.protocolPreference) return;
        onChange({ ...model, protocolPreference, protocol: protocolPreference === 'auto' ? model.protocol : protocolPreference });
    };
    const changeThinkingParams = (mode: 'auto' | 'off') => {
        const overrides = { ...model.capabilityOverrides };
        if (mode === 'auto') delete overrides.reasoning;
        else overrides.reasoning = { mode: 'unsupported', efforts: [], supportsOff: false, defaultEnabled: false };
        onChange({ ...model, capabilityOverrides: Object.keys(overrides).length ? overrides : undefined });
    };
    const caption = { color: Colors.text.tertiary, fontSize: 12, lineHeight: 18 };
    return (
        <View style={styles.block}>
            <View style={styles.group}>
                <Text style={[styles.label, { color: Colors.text.secondary }]}>连接协议</Text>
                <View style={styles.choices}>{(['auto', 'responses', 'anthropic_messages'] as const).map((preference) => (
                    <AIChoice key={preference} label={preference === 'auto' ? '自动' : getProtocolLabel(preference)}
                        selected={model.protocolPreference === preference} onPress={() => changeProtocol(preference)} />
                ))}</View>
                <Text style={caption}>{model.protocolPreference === 'auto'
                    ? model.protocolVerified ? `检测结果：${getProtocolLabel(model.protocol)}` : '检测连接时自动选择可用的协议。'
                    : '只使用所选协议，检测时不再尝试另一种。'}</Text>
            </View>
            <View style={styles.group}>
                <Text style={[styles.label, { color: Colors.text.secondary }]}>输出上限</Text>
                <View style={styles.choices}>
                    <AIChoice label={`自动 · ${formatTokens(autoOutput)}`} selected={model.maxOutputTokensAuto !== false}
                        onPress={() => onChange({ ...model, maxOutputTokensAuto: true })} />
                    <AIChoice label="手动" selected={model.maxOutputTokensAuto === false}
                        onPress={() => onChange({ ...model, maxOutputTokensAuto: false, maxOutputTokens: model.maxOutputTokensAuto === false ? model.maxOutputTokens : autoOutput })} />
                </View>
                {model.maxOutputTokensAuto === false
                    ? <AINumberField label="总输出上限 · tokens" value={model.maxOutputTokens} minimum={1} maximum={behavior.modelMaxOutputTokens} integer
                        onChange={(maxOutputTokens) => onChange({ ...model, maxOutputTokens })} />
                    : <Text style={caption}>随思考强度自动调整，给正文留足余量，避免思考太长把正文挤掉。</Text>}
            </View>
            {temperatureActive ? (
                <View style={styles.group}>
                    <AINumberField label="温度" value={model.temperature} maximum={2} onChange={(temperature) => onChange({ ...model, temperature })} />
                </View>
            ) : null}
            <View style={styles.group}>
                <Text style={[styles.label, { color: Colors.text.secondary }]}>思考参数</Text>
                <View style={styles.choices}>
                    <AIChoice label="自动" selected={thinkingParams === 'auto'} onPress={() => changeThinkingParams('auto')} />
                    <AIChoice label="不发送" selected={thinkingParams === 'off'} onPress={() => changeThinkingParams('off')} />
                    {thinkingParams === 'custom' ? <AIChoice label="旧版自定义" selected onPress={() => undefined} /> : null}
                </View>
                <Text style={caption}>{thinkingParams === 'off'
                    ? '不再发送任何思考参数，由模型或中转自行决定。'
                    : '按协议发送标准思考参数；接口不接受时会自动退回并记住。'}</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    block: { gap: 18 }, group: { gap: 8 }, choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    choice: { minHeight: 40, maxWidth: '100%', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 8, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
    choiceText: { fontSize: 13, fontWeight: '500', flexShrink: 1, textAlign: 'center' }, label: { fontSize: 13, fontWeight: '500' },
    field: { gap: 6 }, numberRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 12 },
    numberLabel: { flex: 1, fontSize: 13 }, numberInput: { minHeight: 42, width: 116, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, fontSize: 14, textAlign: 'right', fontVariant: ['tabular-nums'] },
});
