import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import StatusBarDecor from '../../../src/components/StatusBarDecor';
import { buildZiweiHistoryRestoreRoute } from '../../../src/features/ziwei/result-route';
import { BorderRadius, FontSize, Spacing } from '../../../src/theme/colors';
import { useTheme } from '../../../src/theme/ThemeContext';

export default function ZiweiHistoryResultLoader() {
    const { Colors } = useTheme();
    const styles = makeStyles(Colors);
    const { id } = useLocalSearchParams<{ id: string }>();
    const [screenState, setScreenState] = useState<'loading' | 'missing'>('loading');

    useEffect(() => {
        if (!id) {
            setScreenState('missing');
            return;
        }

        router.replace({
            ...buildZiweiHistoryRestoreRoute(id),
        });
    }, [id]);

    if (screenState === 'loading') {
        return (
            <View style={styles.container}>
                <StatusBarDecor />
                <View style={styles.centerBox}>
                    <ActivityIndicator size="large" color={Colors.accent.gold} />
                    <Text style={styles.title}>正在打开紫微命盘...</Text>
                    <Text style={styles.body}>正在跳转到新的结果页恢复链路。</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBarDecor />
            <View style={styles.centerBox}>
                <Text style={styles.title}>记录不存在或已被删除</Text>
                <Text style={styles.body}>当前紫微记录已无法读取，可以返回历史记录查看其他命盘。</Text>
                <TouchableOpacity style={styles.actionBtn} onPress={() => router.replace('/history')}>
                    <Text style={styles.actionText}>去历史记录</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const makeStyles = (Colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.bg.primary,
    },
    centerBox: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: Spacing.xl,
    },
    title: {
        marginTop: Spacing.lg,
        fontSize: FontSize.xl,
        color: Colors.text.heading,
        fontWeight: '700',
        textAlign: 'center',
    },
    body: {
        marginTop: Spacing.md,
        fontSize: FontSize.sm,
        color: Colors.text.secondary,
        lineHeight: 22,
        textAlign: 'center',
    },
    actionBtn: {
        marginTop: Spacing.xl,
        minHeight: 46,
        minWidth: 180,
        borderRadius: BorderRadius.round,
        backgroundColor: Colors.accent.gold,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: Spacing.xl,
    },
    actionText: {
        color: Colors.text.inverse,
        fontSize: FontSize.md,
        fontWeight: '700',
    },
});
