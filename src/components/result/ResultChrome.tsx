/**
 * 六爻、梅花结果页共用的版式件：顶栏页签、卦主头图、◆ 段卡。
 * 尺寸与配色沿用八字结果页（app/bazi/result/[id].tsx）。
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { router } from 'expo-router';
import { BackIcon, MoreVerticalIcon, SparkleIcon } from '../Icons';
import type { ResultPalette } from '../../theme/result-palette';

export function makeResultChromeStyles(palette: ResultPalette) {
    return StyleSheet.create({
        topBar: {
            height: 48,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 4,
            backgroundColor: palette.card,
            borderBottomWidth: 1,
            borderBottomColor: palette.hairline,
        },
        iconBtn: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
        backBtn: { width: 44 },
        spacer: { flex: 1 },
        tabs: { flexDirection: 'row', alignItems: 'center', gap: 18, marginLeft: 2 },
        tab: { height: 44, paddingHorizontal: 2, justifyContent: 'center' },
        tabText: { fontSize: 15, lineHeight: 20, fontWeight: '500', color: palette.muted },
        tabTextActive: { fontWeight: '700', color: palette.heading },
        tabIndicator: {
            position: 'absolute',
            left: '50%',
            bottom: 6,
            width: 16,
            height: 2,
            marginLeft: -8,
            borderRadius: 1,
            backgroundColor: palette.vermilion,
        },
        aiChip: {
            height: 28,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            marginRight: 2,
            paddingLeft: 8,
            paddingRight: 10,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: palette.goldBorder,
            backgroundColor: palette.goldSoft,
        },
        disabled: { opacity: 0.45 },
        aiChipText: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: palette.gold },
        pressed: { opacity: 0.7 },

        hero: {
            position: 'relative',
            overflow: 'hidden',
            paddingTop: 12,
            paddingBottom: 14,
            paddingHorizontal: 20,
            backgroundColor: palette.card,
            borderBottomWidth: 1,
            borderBottomColor: palette.heroBorder,
        },
        heroArt: { position: 'absolute', pointerEvents: 'none' },
        heroNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 72 },
        heroName: { flexShrink: 1, fontSize: 20, lineHeight: 28, fontWeight: '700', color: palette.heading },
        seal: {
            height: 18,
            paddingHorizontal: 4,
            borderRadius: 3,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: palette.vermilion,
        },
        sealText: { fontSize: 11, lineHeight: 14, fontWeight: '700', letterSpacing: 1, color: palette.sealText },
        chip: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, backgroundColor: palette.chipBg },
        chipText: { fontSize: 11, lineHeight: 15, fontWeight: '500', color: palette.chipInk },
        heroRows: { marginTop: 6, gap: 3 },
        heroRow: { flexDirection: 'row', alignItems: 'center' },
        heroRowLabel: { width: 44, fontSize: 12, lineHeight: 19, color: palette.muted },
        heroRowValue: { flexShrink: 1, fontSize: 13, lineHeight: 19, color: palette.ink },

        card: {
            padding: 14,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: palette.cardBorder,
            backgroundColor: palette.card,
        },
        cardHeader: { minHeight: 22, flexDirection: 'row', alignItems: 'center', gap: 8 },
        cardDiamond: { width: 6, height: 6, backgroundColor: palette.vermilion, transform: [{ rotate: '45deg' }] },
        cardTitle: { fontSize: 15, lineHeight: 22, fontWeight: '700', color: palette.heading },
        cardMeta: { flex: 1, fontSize: 12, color: palette.muted },
    });
}

export type ResultChromeStyles = ReturnType<typeof makeResultChromeStyles>;

export interface ResultTab<K extends string> {
    key: K;
    label: string;
}

export function ResultTopBar<K extends string>({
    tabs, active, onTab, aiLabel, aiDisabled, onAI, onMore, extra, styles, palette,
}: {
    tabs: ResultTab<K>[];
    active: K;
    onTab: (key: K) => void;
    aiLabel: string;
    aiDisabled: boolean;
    onAI: () => void;
    onMore: () => void;
    extra?: React.ReactNode;
    styles: ResultChromeStyles;
    palette: ResultPalette;
}) {
    return (
        <View style={styles.topBar}>
            <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.iconBtn, styles.backBtn, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="返回">
                <BackIcon size={22} color={palette.ink} />
            </Pressable>
            <View style={styles.tabs} accessibilityRole="tablist">
                {tabs.map((tab) => {
                    const on = tab.key === active;
                    return (
                        <Pressable key={tab.key} onPress={() => onTab(tab.key)} style={({ pressed }) => [styles.tab, pressed && styles.pressed]} accessibilityRole="tab" accessibilityState={{ selected: on }}>
                            <Text style={[styles.tabText, on && styles.tabTextActive]}>{tab.label}</Text>
                            {on ? <View style={styles.tabIndicator} /> : null}
                        </Pressable>
                    );
                })}
            </View>
            <View style={styles.spacer} />
            <Pressable
                onPress={onAI}
                disabled={aiDisabled}
                style={({ pressed }) => [styles.aiChip, aiDisabled && styles.disabled, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={aiLabel}
                hitSlop={{ top: 8, bottom: 8 }}
            >
                <SparkleIcon size={13} color={palette.gold} />
                <Text style={styles.aiChipText}>{aiLabel}</Text>
            </Pressable>
            {extra}
            <Pressable onPress={onMore} style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="更多操作">
                <MoreVerticalIcon size={20} color={palette.icon} />
            </Pressable>
        </View>
    );
}

export interface HeroRow {
    label: string;
    value: React.ReactNode;
}

export function ResultHero({ title, seal, chip, rows, art, styles }: {
    title: string;
    seal?: string;
    chip?: string;
    rows: HeroRow[];
    art?: React.ReactNode;
    styles: ResultChromeStyles;
}) {
    return (
        <View style={styles.hero}>
            {art}
            <View style={styles.heroNameRow}>
                <Text style={styles.heroName} numberOfLines={1}>{title}</Text>
                {seal ? <View style={styles.seal}><Text style={styles.sealText}>{seal}</Text></View> : null}
                {chip ? <View style={styles.chip}><Text style={styles.chipText}>{chip}</Text></View> : null}
            </View>
            <View style={styles.heroRows}>
                {rows.map((row) => (
                    <View key={row.label} style={styles.heroRow}>
                        <Text style={styles.heroRowLabel}>{row.label}</Text>
                        {typeof row.value === 'string'
                            ? <Text style={styles.heroRowValue} numberOfLines={1}>{row.value}</Text>
                            : row.value}
                    </View>
                ))}
            </View>
        </View>
    );
}

export function ResultCard({ title, meta, right, children, style, styles }: {
    title: string;
    meta?: string;
    right?: React.ReactNode;
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    styles: ResultChromeStyles;
}) {
    return (
        <View style={[styles.card, style]}>
            <View style={styles.cardHeader}>
                <View style={styles.cardDiamond} />
                <Text style={styles.cardTitle}>{title}</Text>
                <Text style={styles.cardMeta} numberOfLines={1}>{meta || ''}</Text>
                {right}
            </View>
            {children}
        </View>
    );
}
