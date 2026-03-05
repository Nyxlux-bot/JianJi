import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BorderRadius, FontSize, Spacing } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';

export interface OverflowMenuItem {
    key: string;
    label: string;
    onPress: () => void;
    destructive?: boolean;
    disabled?: boolean;
}

interface OverflowMenuProps {
    visible: boolean;
    top: number;
    right: number;
    width?: number;
    items: OverflowMenuItem[];
    onClose: () => void;
}

export default function OverflowMenu({
    visible,
    top,
    right,
    width = 160,
    items,
    onClose,
}: OverflowMenuProps) {
    const { Colors } = useTheme();
    const styles = useMemo(() => makeStyles(Colors), [Colors]);

    if (!visible) {
        return null;
    }

    const handleItemPress = (item: OverflowMenuItem) => {
        onClose();
        if (!item.disabled) {
            item.onPress();
        }
    };

    return (
        <View style={styles.wrapper} pointerEvents="box-none">
            <Pressable style={styles.backdrop} onPress={onClose} />
            <View style={[styles.menu, { top, right, width }]}>
                {items.map((item, index) => {
                    const showDivider = index < items.length - 1;
                    return (
                        <TouchableOpacity
                            key={item.key}
                            style={[styles.menuItem, item.disabled && styles.menuItemDisabled]}
                            onPress={() => handleItemPress(item)}
                            disabled={item.disabled}
                        >
                            <Text
                                style={[
                                    styles.menuText,
                                    item.destructive && styles.menuTextDanger,
                                    item.disabled && styles.menuTextDisabled,
                                ]}
                            >
                                {item.label}
                            </Text>
                            {showDivider ? <View style={styles.divider} /> : null}
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
}

const makeStyles = (Colors: any) => StyleSheet.create({
    wrapper: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 50,
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'transparent',
    },
    menu: {
        position: 'absolute',
        backgroundColor: Colors.bg.card,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
        elevation: 8,
        overflow: 'hidden',
    },
    menuItem: {
        minHeight: 44,
        justifyContent: 'center',
        paddingHorizontal: Spacing.md,
    },
    menuItemDisabled: {
        opacity: 0.55,
    },
    menuText: {
        fontSize: FontSize.sm,
        color: Colors.text.primary,
    },
    menuTextDanger: {
        color: Colors.accent.red,
    },
    menuTextDisabled: {
        color: Colors.text.tertiary,
    },
    divider: {
        position: 'absolute',
        left: Spacing.md,
        right: Spacing.md,
        bottom: 0,
        height: 1,
        backgroundColor: Colors.border.subtle,
    },
});
