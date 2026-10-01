import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { AI_REASONING_EFFORTS } from '../core/ai-execution-meta';
import { DEFAULT_REASONING_OUTPUT_TOKENS, getReasoningLabel, isReasoningEnabled, resolveModelBehavior } from '../services/ai-model-capabilities';
import { getProtocolLabel, inferProviderProtocol } from '../services/ai-endpoints';
import { getProviderCapabilities } from '../services/ai-provider-discovery';
import type { AIModelProfile, AIProviderCapabilities, AIProviderProfile, AIProviderProtocolPreference, AIReasoningSetting, AIThinkingMode } from '../services/ai-provider-types';
import { toProviderConfig } from '../services/settings';
import { useTheme } from '../theme/ThemeContext';
import { ChevronDownIcon, ChevronRightIcon } from './Icons';

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

export default function AIModelControls({ provider, model, onChange, compact = false, capabilities: suppliedCapabilities }: {
    provider: AIProviderProfile; model: AIModelProfile; onChange: (model: AIModelProfile) => void; compact?: boolean;
    capabilities?: AIProviderCapabilities;
}) {
    const { Colors } = useTheme();
    const [advanced, setAdvanced] = useState(false);
    const [compatibility, setCompatibility] = useState(false);
    const [cached, setCached] = useState<{ key: string; value: AIProviderCapabilities } | null>(null);
    const [error, setError] = useState('');
    const config = toProviderConfig(provider, model);
    const key = JSON.stringify([provider.id, provider.revision, provider.apiUrl, model.id, model.revision, model.protocol]);
    useEffect(() => {
        let current = true;
        setError('');
        if (provider.apiKey.trim() && provider.apiUrl.trim() && model.model.trim()) {
            getProviderCapabilities(toProviderConfig(provider, model)).then((value) => {
                if (current) setCached({ key, value });
            }).catch((reason: unknown) => { if (current) setError(reason instanceof Error ? reason.message : '读取模型能力失败'); });
        }
        return () => { current = false; };
    }, [key, provider.apiKey]);
    const metadata = suppliedCapabilities?.model === model.model && suppliedCapabilities.protocol === model.protocol
        ? suppliedCapabilities : cached?.key === key ? cached.value : undefined;
    const behavior = metadata ?? resolveModelBehavior(config);
    const choices: AIReasoningSetting[] = ['default', ...(behavior.reasoning.supportsOff ? ['off' as const] : []),
        ...(behavior.reasoning.mode === 'budget' ? ['budget' as const] : behavior.reasoning.efforts)];
    const selectedUnsupported = !choices.includes(model.reasoning);
    const thinking = isReasoningEnabled(config, behavior.reasoning);
    const temperatureActive = behavior.supportsTemperature && (!thinking || behavior.temperatureWithReasoning);
    const changeReasoning = (reasoning: AIReasoningSetting) => {
        if (reasoning === model.reasoning) return;
        const enabling = reasoning !== 'default' && reasoning !== 'off' && (model.reasoning === 'default' || model.reasoning === 'off');
        onChange({ ...model, reasoning, maxOutputTokens: enabling
            ? Math.min(Math.max(model.maxOutputTokens, DEFAULT_REASONING_OUTPUT_TOKENS), behavior.modelMaxOutputTokens ?? Infinity) : model.maxOutputTokens });
    };
    const changeProtocol = (protocolPreference: AIProviderProtocolPreference) => {
        if (protocolPreference === model.protocolPreference) return;
        onChange({ ...model, protocolPreference, protocol: protocolPreference === 'auto'
            ? inferProviderProtocol(provider.apiUrl, model.model) : protocolPreference });
    };
    const overrideMode = (mode: AIThinkingMode | 'auto') => {
        const overrides = { ...model.capabilityOverrides };
        if (mode === 'auto') delete overrides.reasoning;
        else overrides.reasoning = { mode, efforts: mode === 'responses' || mode === 'adaptive' ? ['low', 'medium', 'high'] : [], supportsOff: false, defaultEnabled: false };
        onChange({ ...model, capabilityOverrides: overrides });
    };
    const protocolPreferences: AIProviderProtocolPreference[] = ['auto', 'responses', 'anthropic_messages'];
    const overrideModes: Array<AIThinkingMode | 'auto'> = ['auto', 'unsupported', ...(model.protocol === 'responses' ? ['responses' as const] : ['adaptive' as const, 'budget' as const])];
    const neutralText = { color: Colors.text.secondary, fontSize: 12, lineHeight: 18 };
    return (
        <View style={styles.block}>
            <Text style={[styles.label, { color: Colors.text.secondary }]}>思考等级</Text>
            <View style={styles.choices}>{choices.map((choice) => (
                <AIChoice key={choice} label={choice === 'budget' ? '思考预算' : getReasoningLabel(choice)} selected={model.reasoning === choice} onPress={() => changeReasoning(choice)} />
            ))}</View>
            {selectedUnsupported && <Text accessibilityRole="alert" style={{ color: Colors.accent.red }}>当前协议未声明支持 {model.reasoning}；可测试自动适配或修改高级兼容配置。</Text>}
            {model.reasoning === 'budget' && <AINumberField label="思考预算 · tokens" value={model.thinkingBudgetTokens} minimum={1024} maximum={model.maxOutputTokens - 1} integer commitOnBlur={compact}
                onChange={(thinkingBudgetTokens) => onChange({ ...model, thinkingBudgetTokens })} />}
            {!compact && <>
                <Pressable accessibilityRole="button" accessibilityState={{ expanded: advanced }} onPress={() => setAdvanced(!advanced)}
                    style={({ pressed }) => [styles.disclosure, { borderColor: Colors.border.subtle, opacity: pressed ? 0.65 : 1 }]}>
                    <Text style={{ color: Colors.text.primary, fontSize: 14 }}>高级设置</Text>
                    <Text numberOfLines={1} style={[styles.summary, neutralText]}>{model.protocolPreference === 'auto' ? '自动适配' : getProtocolLabel(model.protocol)}</Text>
                    {advanced ? <ChevronDownIcon size={16} /> : <ChevronRightIcon size={16} />}
                </Pressable>
                {advanced && <View style={styles.block}>
                    <Text style={[styles.label, { color: Colors.text.secondary }]}>连接协议</Text>
                    <View style={styles.choices}>{protocolPreferences.map((preference) => <AIChoice key={preference} label={preference === 'auto' ? '自动适配' : getProtocolLabel(preference)}
                        selected={model.protocolPreference === preference} onPress={() => changeProtocol(preference)} />)}</View>
                    <AINumberField label="总输出上限 · tokens" value={model.maxOutputTokens} minimum={1} maximum={behavior.modelMaxOutputTokens} integer onChange={(maxOutputTokens) => onChange({ ...model, maxOutputTokens })} />
                    <AINumberField label="温度" value={model.temperature} maximum={2} disabled={!temperatureActive} onChange={(temperature) => onChange({ ...model, temperature })} />
                    {!temperatureActive && <Text style={neutralText}>{thinking ? '当前思考模式不发送温度参数。' : '接口未声明温度能力，本次不发送。'}</Text>}
                    <Pressable accessibilityRole="button" accessibilityState={{ expanded: compatibility }} onPress={() => setCompatibility(!compatibility)} style={styles.numberRow}>
                        <Text style={[styles.numberLabel, { color: Colors.text.secondary }]}>模型兼容配置</Text>
                        {compatibility ? <ChevronDownIcon size={16} /> : <ChevronRightIcon size={16} />}
                    </Pressable>
                    {compatibility && <View style={styles.compatibility}>
                        <Text style={neutralText}>用于接口未公开能力的模型别名。显式设置的参数会参与连接测试。</Text>
                        <View style={styles.choices}>{overrideModes.map((mode) => <AIChoice key={mode} label={mode === 'auto' ? '自动识别' : mode === 'unsupported' ? '无思考参数' : mode === 'budget' ? 'token 预算' : mode}
                            selected={(model.capabilityOverrides?.reasoning?.mode ?? 'auto') === mode} onPress={() => overrideMode(mode)} />)}</View>
                        {model.capabilityOverrides?.reasoning && <>
                            {(model.capabilityOverrides.reasoning.mode === 'responses' || model.capabilityOverrides.reasoning.mode === 'adaptive') && <View style={styles.choices}>
                                {AI_REASONING_EFFORTS.map((effort) => <AIChoice key={effort} label={effort} selected={model.capabilityOverrides?.reasoning?.efforts.includes(effort)} onPress={() => {
                                    const reasoning = model.capabilityOverrides?.reasoning;
                                    if (!reasoning) return;
                                    onChange({ ...model, capabilityOverrides: { ...model.capabilityOverrides, reasoning: { ...reasoning,
                                        efforts: reasoning.efforts.includes(effort) ? reasoning.efforts.filter((value) => value !== effort) : [...reasoning.efforts, effort] } } });
                                }} />)}
                            </View>}
                            {(['supportsOff', 'defaultEnabled'] as const).map((flag) => <View style={styles.numberRow} key={flag}>
                                <Text style={[styles.numberLabel, { color: Colors.text.secondary }]}>{flag === 'supportsOff' ? '支持关闭思考' : '模型默认开启思考'}</Text>
                                <Switch accessibilityLabel={flag === 'supportsOff' ? '支持关闭思考' : '模型默认开启思考'} value={model.capabilityOverrides?.reasoning?.[flag] ?? false}
                                    trackColor={{ true: Colors.accent.gold, false: Colors.border.normal }} onValueChange={(value) => {
                                        const reasoning = model.capabilityOverrides?.reasoning;
                                        if (reasoning) onChange({ ...model, capabilityOverrides: { ...model.capabilityOverrides, reasoning: { ...reasoning, [flag]: value } } });
                                    }} />
                            </View>)}
                        </>}
                        <Text style={neutralText}>温度能力</Text>
                        <View style={styles.choices}>{(['auto', 'yes', 'no'] as const).map((choice) => <AIChoice key={choice} label={choice === 'auto' ? '自动识别' : choice === 'yes' ? '支持' : '不支持'}
                            selected={(model.capabilityOverrides?.supportsTemperature === undefined ? 'auto' : model.capabilityOverrides.supportsTemperature ? 'yes' : 'no') === choice} onPress={() => {
                                const overrides = { ...model.capabilityOverrides };
                                if (choice === 'auto') delete overrides.supportsTemperature; else overrides.supportsTemperature = choice === 'yes';
                                onChange({ ...model, capabilityOverrides: overrides });
                            }} />)}</View>
                    </View>}
                </View>}
            </>}
            {error !== '' && <Text accessibilityRole="alert" style={{ color: Colors.accent.red }}>{error}</Text>}
        </View>
    );
}

const styles = StyleSheet.create({
    block: { gap: 12 }, compatibility: { gap: 14, paddingBottom: 8 }, choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    choice: { minHeight: 42, maxWidth: '100%', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
    choiceText: { fontSize: 13, fontWeight: '500', flexShrink: 1, textAlign: 'center' }, label: { fontSize: 13, fontWeight: '500' },
    disclosure: { minHeight: 50, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
    summary: { flex: 1, textAlign: 'right' }, field: { gap: 6 }, numberRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 12 },
    numberLabel: { flex: 1, fontSize: 13 }, numberInput: { minHeight: 42, width: 116, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, fontSize: 14, textAlign: 'right', fontVariant: ['tabular-nums'] },
});
