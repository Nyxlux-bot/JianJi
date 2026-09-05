import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BorderRadius, Colors as ThemeColors, FontSize, Spacing } from '../theme/colors';
import { LIUYAO_SUBJECT_OPTIONS } from '../core/liuyao-data';
import type { LiuyaoSubject } from '../core/liuyao-data';
import { useTheme } from '../theme/ThemeContext';

interface LiuyaoSubjectSelectorProps {
    value: LiuyaoSubject | null;
    onChange: (value: LiuyaoSubject) => void;
}

/**
 * 六爻四种起卦方式共用的起卦主体选择器。
 * “其他”刻意覆盖其他性别、非人类物种、物品或其他非人的占问主体。
 */
export default function LiuyaoSubjectSelector({ value, onChange }: LiuyaoSubjectSelectorProps) {
    const { Colors } = useTheme();
    const styles = makeStyles(Colors);

    return (
        <View style={styles.section}>
            <Text style={styles.sectionLabel}>性别 / 起卦主体</Text>
            <View style={styles.optionsRow} accessibilityRole="radiogroup">
                {LIUYAO_SUBJECT_OPTIONS.map((option) => {
                    const selected = value === option.value;
                    return (
                        <TouchableOpacity
                            key={option.value}
                            style={[styles.option, selected && styles.optionSelected]}
                            activeOpacity={0.75}
                            onPress={() => onChange(option.value)}
                            accessibilityRole="radio"
                            accessibilityState={{ selected }}
                            accessibilityLabel={`${option.label}，${option.description}`}
                        >
                            <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
                                {option.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
            <Text style={styles.helperText}>
                其他：可指其他性别、动物/植物等物种、物品或其他非人主体；具体对象请写在占问事项中
            </Text>
        </View>
    );
}

const makeStyles = (Colors: typeof ThemeColors) => StyleSheet.create({
    section: {
        marginBottom: Spacing.xxl,
    },
    sectionLabel: {
        fontSize: FontSize.sm,
        color: Colors.text.secondary,
        marginBottom: Spacing.md,
        letterSpacing: 1,
    },
    optionsRow: {
        flexDirection: 'row',
        gap: Spacing.sm,
    },
    option: {
        flex: 1,
        minHeight: 44,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
        backgroundColor: Colors.bg.card,
        alignItems: 'center',
        justifyContent: 'center',
    },
    optionSelected: {
        borderColor: Colors.accent.gold,
        backgroundColor: Colors.bg.elevated,
    },
    optionLabel: {
        fontSize: FontSize.md,
        color: Colors.text.secondary,
    },
    optionLabelSelected: {
        color: Colors.accent.gold,
        fontWeight: '600',
    },
    helperText: {
        marginTop: Spacing.sm,
        fontSize: FontSize.xs,
        lineHeight: 18,
        color: Colors.text.tertiary,
    },
});
