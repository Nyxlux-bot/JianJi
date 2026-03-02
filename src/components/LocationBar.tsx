/**
 * 地点选择栏组件
 * 显示在起卦页面上方，点击可打开城市选择器
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Spacing, FontSize, BorderRadius } from '../theme/colors';
import { CityInfo } from '../core/city-data';
import { LocationIcon, ChevronRightIcon } from './Icons';
import { useTheme } from "../theme/ThemeContext";

interface LocationBarProps {
    city: CityInfo | null;
    onPress: () => void;
}

export default function LocationBar({ city, onPress }: LocationBarProps) {
    const { Colors } = useTheme();
        const styles = makeStyles(Colors);
    return (
        <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
            <View style={styles.iconContainer}>
                <LocationIcon size={20} color={Colors.accent.red} />
            </View>
            {city ? (
                <View style={styles.info}>
                    <Text style={styles.cityName}>{city.name}</Text>
                    <Text style={styles.detail}>
                        E{city.longitude.toFixed(2)}° · 真太阳时校准
                    </Text>
                </View>
            ) : (
                <View style={styles.info}>
                    <Text style={styles.placeholder}>选择所在地（可选）</Text>
                    <Text style={styles.detail}>使用真太阳时校准时辰</Text>
                </View>
            )}
            <ChevronRightIcon size={20} color={Colors.text.tertiary} />
        </TouchableOpacity>
    );
}

const makeStyles = (Colors: any) => StyleSheet.create({
        container: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: Colors.bg.card,
            borderRadius: BorderRadius.md,
            paddingHorizontal: Spacing.lg,
            paddingVertical: Spacing.md,
            marginBottom: Spacing.lg,
            borderWidth: 0.5,
            borderColor: Colors.border.subtle,
        },
        iconContainer: {
            marginRight: Spacing.sm,
        },
        info: { flex: 1 },
        cityName: {
            fontSize: FontSize.sm,
            color: Colors.accent.gold,
            fontWeight: '400',
        },
        placeholder: {
            fontSize: FontSize.sm,
            color: Colors.text.secondary,
        },
        detail: {
            fontSize: FontSize.xs,
            color: Colors.text.tertiary,
            marginTop: 2,
        },
        arrow: {
            fontSize: FontSize.lg,
            color: Colors.text.tertiary,
            marginLeft: Spacing.sm,
        },
    });
