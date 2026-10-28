import React from 'react';
import { Stack } from 'expo-router';
import { withPageBackground } from '../../../src/components/PageBackground';

export default function GanZhiLayout() {
    return (
        <Stack
            screenLayout={withPageBackground}
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: 'transparent' },
                animation: 'ios_from_right',
            }}
        />
    );
}
