import React from 'react';
import { Stack } from 'expo-router';
import { useTheme } from '../../../src/theme/ThemeContext';

export default function GanZhiLayout() {
    const { Colors } = useTheme();

    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: Colors.bg.primary },
                animation: 'fade',
            }}
        />
    );
}
