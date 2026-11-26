import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import PressableScale from './PressableScale';
import { BorderRadius, FontSize, Spacing } from '../theme/colors';
import { EASE_OUT } from '../theme/motion';
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
    const reduceMotion = useReducedMotion();
    const [mounted, setMounted] = useState(visible);
    const progress = useSharedValue(visible ? 1 : 0);

    useEffect(() => {
        if (visible) {
            setMounted(true);
            progress.value = withTiming(1, { duration: reduceMotion ? 0 : 120, easing: EASE_OUT });
        } else if (mounted) {
            progress.value = withTiming(0, { duration: reduceMotion ? 0 : 100, easing: Easing.in(Easing.cubic) }, (finished) => {
                if (finished) runOnJS(setMounted)(false);
            });
        }
    }, [visible, mounted, reduceMotion, progress]);

    const menuMotion = useAnimatedStyle(() => ({
        opacity: progress.value,
        transform: [
            { scale: reduceMotion ? 1 : 0.94 + 0.06 * progress.value },
            { translateY: reduceMotion ? 0 : (1 - progress.value) * -6 },
        ],
    }), [reduceMotion]);

    if (!mounted) {
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
            <Animated.View accessibilityRole="menu" style={[styles.menu, { top, right, width }, menuMotion]}>
                {items.map((item, index) => {
                    const showDivider = index < items.length - 1;
                    return (
                        <PressableScale scaleTo={0.985}
                            key={item.key}
                            accessibilityRole="menuitem"
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
                        </PressableScale>
                    );
                })}
            </Animated.View>
        </View>
    );
}

const makeStyles = (Colors: any) => StyleSheet.create({
    wrapper: {
        ...StyleSheet.absoluteFill,
        zIndex: 50,
    },
    backdrop: {
        ...StyleSheet.absoluteFill,
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
        transformOrigin: 'top right',
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
