import React from 'react';
import { Stack } from 'expo-router';

export default function GanZhiLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: 'transparent' },
                animation: 'fade',
            }}
        />
    );
}
