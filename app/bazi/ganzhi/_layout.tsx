import React from 'react';
import { Stack } from 'expo-router';
import { GanZhiRelationSettingsProvider } from '../../../src/features/bazi/ganzhi-relation-settings';
import { useTheme } from '../../../src/theme/ThemeContext';

export default function GanZhiLayout() {
    const { Colors } = useTheme();

    return (
        <GanZhiRelationSettingsProvider>
            <Stack
                screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: Colors.bg.primary },
                    animation: 'fade',
                }}
            />
        </GanZhiRelationSettingsProvider>
    );
}
