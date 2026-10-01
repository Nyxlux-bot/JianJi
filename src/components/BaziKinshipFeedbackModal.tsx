import React, { useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KINSHIP_ACTUAL_FIELDS, type KinshipActualFacts, type KinshipActualField } from '../core/bazi-kinship';
import { useTheme } from '../theme/ThemeContext';

interface Props {
    visible: boolean;
    value: KinshipActualFacts;
    busy: boolean;
    onChange: (value: KinshipActualFacts) => void;
    onClose: () => void;
    onSave: () => Promise<void>;
}

export default function BaziKinshipFeedbackModal({ visible, value, busy, onChange, onClose, onSave }: Props) {
    const { Colors } = useTheme();
    const [expanded, setExpanded] = useState(false);
    const [error, setError] = useState('');
    const [focused, setFocused] = useState<KinshipActualField | null>(null);
    const triggerRef = useRef<React.ElementRef<typeof TextInput>>(null);
    const canSave = Object.values(value).some((text) => text.trim());
    const fields: KinshipActualField[] = expanded ? ['siblings', 'birthOrder', 'circumstances', 'unknowns'] : ['siblings', 'birthOrder'];
    const save = async () => {
        if (busy || !canSave) return;
        setError('');
        try { await onSave(); }
        catch (reason: unknown) { setError(reason instanceof Error ? reason.message : '反馈保存失败'); }
    };
    return <Modal visible={visible} transparent animationType="fade" onRequestClose={() => { if (!busy) onClose(); }}
        onShow={() => { setError(''); triggerRef.current?.focus(); }}>
        <SafeAreaView style={styles.overlay}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboard}>
                <View accessibilityViewIsModal style={[styles.dialog, { backgroundColor: Colors.bg.primary, borderColor: Colors.border.normal }]}>
                    <Text accessibilityRole="header" style={[styles.title, { color: Colors.text.heading }]}>实际家庭情况</Text>
                    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.fields}>
                        {fields.map((field) => <View key={field} style={styles.field}>
                            <Text style={{ color: Colors.text.primary }}>{KINSHIP_ACTUAL_FIELDS[field]}</Text>
                            <TextInput ref={field === 'siblings' ? triggerRef : undefined} accessibilityLabel={KINSHIP_ACTUAL_FIELDS[field]}
                                multiline maxLength={600} editable={!busy} value={value[field]} placeholder="选填"
                                placeholderTextColor={Colors.text.tertiary} onFocus={() => setFocused(field)} onBlur={() => setFocused(null)}
                                onChangeText={(text) => onChange({ ...value, [field]: text })}
                                style={[styles.input, { color: Colors.text.primary, backgroundColor: Colors.bg.input,
                                    borderColor: focused === field ? Colors.accent.gold : Colors.border.normal }]} />
                        </View>)}
                        <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)} style={styles.button}>
                            <Text style={{ color: Colors.accent.gold }}>{expanded ? '收起补充信息' : '补充信息'}</Text>
                        </Pressable>
                        {!!error && <Text accessibilityRole="alert" style={{ color: Colors.accent.red }}>{error}</Text>}
                    </ScrollView>
                    <View style={styles.actions}>
                        <Pressable accessibilityRole="button" disabled={busy} accessibilityState={{ disabled: busy }} onPress={onClose} style={styles.button}>
                            <Text style={{ color: Colors.text.secondary }}>取消</Text>
                        </Pressable>
                        <Pressable accessibilityRole="button" disabled={busy || !canSave} accessibilityState={{ disabled: busy || !canSave }} onPress={() => { void save(); }}
                            style={[styles.button, styles.primary, { backgroundColor: Colors.accent.gold, opacity: busy || !canSave ? 0.6 : 1 }]}>
                            {busy ? <ActivityIndicator color={Colors.text.inverse} /> : <Text style={{ color: Colors.text.inverse, fontWeight: '600' }}>保存并继续</Text>}
                        </Pressable>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    </Modal>;
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
    keyboard: { flex: 1, padding: 16, justifyContent: 'center', alignItems: 'center' },
    dialog: { width: '100%', maxWidth: 520, maxHeight: '100%', borderRadius: 8, borderWidth: 1, padding: 20, gap: 16 },
    title: { fontSize: 18, fontWeight: '600' }, fields: { gap: 16 }, field: { gap: 8 },
    input: { minHeight: 64, maxHeight: 160, borderWidth: 1, borderRadius: 6, padding: 12, fontSize: 16, textAlignVertical: 'top' },
    actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, flexWrap: 'wrap' },
    button: { minHeight: 44, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center' }, primary: { borderRadius: 6 },
});
