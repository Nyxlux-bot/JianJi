/**
 * 学习模块主页
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { router } from 'expo-router';
import StatusBarDecor from '../../src/components/StatusBarDecor';
import { useTheme } from '../../src/theme/ThemeContext';
import { ReadIcon, ChevronRightIcon } from '../../src/components/Icons';
import { Spacing, FontSize, BorderRadius } from '../../src/theme/colors';

export default function LearnPage() {
    const { Colors } = useTheme();
    const styles = makeStyles(Colors);

    return (
        <View style={styles.container}>
            <StatusBarDecor />
            <View style={styles.header}>
                <View style={styles.backBtn} />
                <Text style={styles.headerTitle}>学习</Text>
                <View style={styles.backBtn} />
            </View>

            <ScrollView
                style={styles.content}
                showsVerticalScrollIndicator={false}
            >
                <Text style={styles.sectionTitle}>易学书阁</Text>

                <TouchableOpacity
                    style={styles.menuCard}
                    activeOpacity={0.7}
                    onPress={() => router.push('/learn/hexagrams')}
                >
                    <View style={styles.iconContainer}>
                        <ReadIcon size={28} color={Colors.accent.gold} />
                    </View>
                    <View style={styles.menuTextContainer}>
                        <Text style={styles.menuTitle}>卦象总览 (六十四卦)</Text>
                        <Text style={styles.menuDesc}>查阅周易文辞、爻辞及详解结构</Text>
                    </View>
                    <ChevronRightIcon size={20} color={Colors.text.tertiary} />
                </TouchableOpacity>

                <View style={{ height: 100 }} />
            </ScrollView>
        </View>
    );
}

const makeStyles = (Colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.bg.primary,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
    },
    backBtn: { width: 40, height: 40 },
    headerTitle: {
        fontSize: FontSize.lg,
        color: Colors.text.heading,
        fontWeight: '400'
    },
    content: {
        flex: 1,
        paddingHorizontal: Spacing.xl,
    },
    sectionTitle: {
        fontSize: FontSize.sm,
        color: Colors.text.tertiary,
        marginTop: Spacing.xl,
        marginBottom: Spacing.lg,
        letterSpacing: 2,
    },
    menuCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.bg.card,
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        marginBottom: Spacing.md,
        borderWidth: 0.5,
        borderColor: Colors.border.subtle,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.bg.elevated,
        justifyContent: 'center',
        alignItems: 'center',
    },
    menuTextContainer: {
        flex: 1,
        marginLeft: Spacing.lg,
    },
    menuTitle: {
        fontSize: FontSize.lg,
        color: Colors.text.heading,
        fontWeight: '400',
    },
    menuDesc: {
        fontSize: FontSize.xs,
        color: Colors.text.tertiary,
        marginTop: 4,
    },
});
