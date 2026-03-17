import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BorderRadius, FontSize, Spacing } from '../../../theme/colors';
import { useTheme } from '../../../theme/ThemeContext';
import {
    ZiweiAlgorithm,
    ZiweiAstroType,
    ZiweiConfigOptions,
    ZiweiDayDivide,
    ZiweiYearDivide,
} from '../types';

const ALGORITHM_OPTIONS: Array<{ value: ZiweiAlgorithm; label: string }> = [
    { value: 'default', label: '通行' },
    { value: 'zhongzhou', label: '中州' },
];

const YEAR_DIVIDE_OPTIONS: Array<{ value: ZiweiYearDivide; label: string }> = [
    { value: 'normal', label: '农历正月' },
    { value: 'exact', label: '立春' },
];

const DAY_DIVIDE_OPTIONS: Array<{ value: ZiweiDayDivide; label: string }> = [
    { value: 'forward', label: '晚子算次日' },
    { value: 'current', label: '晚子算当日' },
];

const ASTRO_TYPE_OPTIONS: Array<{ value: ZiweiAstroType; label: string }> = [
    { value: 'heaven', label: '天盘' },
    { value: 'earth', label: '地盘' },
    { value: 'human', label: '人盘' },
];

interface ZiweiConfigPanelProps {
    value: ZiweiConfigOptions;
    onChange: (nextValue: ZiweiConfigOptions) => void;
    mode?: 'result';
}

function OptionGroup<T extends string>({
    options,
    value,
    onChange,
}: {
    options: Array<{ value: T; label: string }>;
    value: T;
    onChange: (value: T) => void;
}) {
    const { Colors } = useTheme();
    const styles = useMemo(() => makeStyles(Colors), [Colors]);

    return (
        <View style={styles.optionGrid}>
            {options.map((option) => {
                const active = option.value === value;
                return (
                    <TouchableOpacity
                        key={option.value}
                        style={[styles.optionBtn, active && styles.optionBtnActive]}
                        onPress={() => onChange(option.value)}
                    >
                        <Text style={[styles.optionText, active && styles.optionTextActive]}>
                            {option.label}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}

export default function ZiweiConfigPanel({ value, onChange, mode = 'result' }: ZiweiConfigPanelProps) {
    const { Colors } = useTheme();
    const styles = useMemo(() => makeStyles(Colors), [Colors]);

    return (
        <View style={styles.panel}>
            <Text style={styles.title}>排盘设置</Text>
            <Text style={styles.hint}>
                {mode === 'result'
                    ? '修改后会立即按当前配置刷新命盘与运限；点击完成时覆盖当前记录。'
                    : '这里的设置会影响当前紫微命盘的排盘口径。'}
            </Text>

            <View style={styles.section}>
                <Text style={styles.sectionLabel}>安星算法</Text>
                <OptionGroup
                    options={ALGORITHM_OPTIONS}
                    value={value.algorithm}
                    onChange={(next) => onChange({ ...value, algorithm: next })}
                />
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionLabel}>年界</Text>
                <OptionGroup
                    options={YEAR_DIVIDE_OPTIONS}
                    value={value.yearDivide}
                    onChange={(next) => onChange({ ...value, yearDivide: next })}
                />
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionLabel}>运限界</Text>
                <OptionGroup
                    options={YEAR_DIVIDE_OPTIONS}
                    value={value.horoscopeDivide}
                    onChange={(next) => onChange({ ...value, horoscopeDivide: next })}
                />
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionLabel}>晚子时口径</Text>
                <OptionGroup
                    options={DAY_DIVIDE_OPTIONS}
                    value={value.dayDivide}
                    onChange={(next) => onChange({ ...value, dayDivide: next })}
                />
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionLabel}>盘型</Text>
                <OptionGroup
                    options={ASTRO_TYPE_OPTIONS}
                    value={value.astroType}
                    onChange={(next) => onChange({ ...value, astroType: next })}
                />
            </View>
        </View>
    );
}

const makeStyles = (Colors: any) => StyleSheet.create({
    panel: {
        padding: Spacing.lg,
        borderRadius: BorderRadius.lg,
        backgroundColor: Colors.bg.card,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
        gap: Spacing.md,
    },
    title: {
        fontSize: FontSize.lg,
        color: Colors.text.heading,
        fontWeight: '600',
    },
    hint: {
        fontSize: FontSize.sm,
        lineHeight: 20,
        color: Colors.text.secondary,
    },
    section: {
        gap: Spacing.sm,
    },
    sectionLabel: {
        fontSize: FontSize.sm,
        color: Colors.text.primary,
        fontWeight: '600',
    },
    optionGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
    },
    optionBtn: {
        minHeight: 40,
        paddingHorizontal: Spacing.md,
        borderRadius: BorderRadius.round,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.bg.elevated,
    },
    optionBtnActive: {
        borderColor: Colors.accent.gold,
        backgroundColor: Colors.bg.primary,
    },
    optionText: {
        fontSize: FontSize.sm,
        color: Colors.text.secondary,
    },
    optionTextActive: {
        color: Colors.accent.gold,
        fontWeight: '600',
    },
});
