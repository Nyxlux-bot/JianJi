import React, { memo, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type {
    ZiweiDynamicHoroscopeResult,
    ZiweiDynamicScope,
    ZiweiMutagen,
    ZiweiPalaceAnalysisView,
    ZiweiStarInsightView,
} from '../types';
import {
    lunarMonthLabel,
    palaceShortLabel,
    parseMutKey,
    stemMutagenStars,
    ZIWEI_MUTAGEN_ORDER,
    type ZiweiCursorInfo,
    type ZiweiView,
} from '../scope-layer';
import { ganzhiColor, type ZiweiPalette } from './palette';

const SCOPE_ROWS: Array<{ scope: ZiweiDynamicScope; label: string; prefix: string }> = [
    { scope: 'decadal', label: '大限', prefix: '限' },
    { scope: 'yearly', label: '流年', prefix: '年' },
    { scope: 'monthly', label: '流月', prefix: '月' },
];

export function makeDetailStyles(palette: ZiweiPalette) {
    const base = { includeFontPadding: false } as const;
    return StyleSheet.create({
        section: { paddingHorizontal: 16, paddingTop: 16 },
        sectionRule: { marginTop: 14, borderTopWidth: 1, borderTopColor: palette.hairline },
        sectionTitle: { ...base, fontSize: 12, lineHeight: 16, color: palette.muted },
        tagRow: { flexDirection: 'row', gap: 6, marginBottom: 2 },
        tag: { paddingHorizontal: 6, borderRadius: 4, backgroundColor: palette.chipBg },
        tagText: { ...base, fontSize: 11, lineHeight: 16, color: palette.chipInk },
        starWrap: { marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 18, rowGap: 6 },
        starItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
        starMajor: { ...base, fontSize: 20, lineHeight: 26, fontWeight: '700', color: palette.heading },
        starMinor: { ...base, fontSize: 15, lineHeight: 22, fontWeight: '500', color: palette.body },
        starOn: { color: palette.vermilion },
        brightness: { ...base, fontSize: 12, lineHeight: 16, color: palette.muted },
        chip: { width: 16, height: 16, borderRadius: 3, alignItems: 'center', justifyContent: 'center' },
        chipText: { ...base, fontSize: 11, lineHeight: 14, fontWeight: '700' },
        adjWrap: { marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
        adj: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: palette.relationBg },
        adjText: { ...base, fontSize: 12, lineHeight: 18, color: palette.body },
        insight: {
            marginTop: 10,
            paddingHorizontal: 10,
            paddingVertical: 8,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: palette.goldBorder,
            backgroundColor: palette.goldSoft,
        },
        insightText: { ...base, fontSize: 12, lineHeight: 18, color: palette.body },
        triGrid: { marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
        triCell: { width: '48.5%', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, backgroundColor: palette.relationBg },
        triHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
        triName: { ...base, fontSize: 13, lineHeight: 18, fontWeight: '600', color: palette.ink },
        triRole: { ...base, fontSize: 10, lineHeight: 14, color: palette.muted },
        triMajor: { ...base, marginTop: 2, fontSize: 12, lineHeight: 17, color: palette.ink },
        triMinor: { ...base, fontSize: 11, lineHeight: 15, color: palette.muted },
        checks: { marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
        check: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 3,
            paddingHorizontal: 8,
            paddingVertical: 2,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: palette.segBorder,
        },
        checkText: { ...base, fontSize: 11, lineHeight: 16 },
        flyGrid: { marginTop: 6, flexDirection: 'row', flexWrap: 'wrap', rowGap: 4 },
        flyItem: { width: '50%', flexDirection: 'row', alignItems: 'center', gap: 6 },
        flyStar: { ...base, width: 32, fontSize: 13, lineHeight: 20, color: palette.ink },
        flyArrow: { ...base, fontSize: 13, lineHeight: 20, color: palette.faint },
        flyDest: { ...base, fontSize: 13, lineHeight: 20, fontWeight: '600', color: palette.ink },
        selfTag: { marginLeft: 2, paddingHorizontal: 4, borderRadius: 3, backgroundColor: palette.chipBg },
        selfTagText: { ...base, fontSize: 10, lineHeight: 15, color: palette.chipInk },
        scopeRow: { marginTop: 4, height: 30, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, borderRadius: 8 },
        scopeRowOn: { backgroundColor: palette.selectedTint },
        scopeLabel: { ...base, width: 84, fontSize: 12, lineHeight: 16, color: palette.muted, fontVariant: ['tabular-nums'] },
        scopeLabelOn: { color: palette.ink, fontWeight: '600' },
        scopeTag: { paddingHorizontal: 5, borderRadius: 4, borderWidth: 1, borderColor: palette.goldBorder, backgroundColor: palette.goldSoft },
        scopeTagText: { ...base, fontSize: 12, lineHeight: 18, fontWeight: '600', color: palette.gold },
        scopeStars: { ...base, flexShrink: 1, fontSize: 13, lineHeight: 18, color: palette.gold },
        gods: { marginTop: 8, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 },
        god: { alignItems: 'center', gap: 2 },
        godLabel: { ...base, fontSize: 10.5, lineHeight: 14, color: palette.muted },
        godValue: { ...base, fontSize: 14, lineHeight: 18, color: palette.ink },
        lineText: { ...base, marginTop: 6, fontSize: 13, lineHeight: 20, color: palette.body },
        lineLabel: { color: palette.muted },
    });
}

export type ZiweiDetailStyles = ReturnType<typeof makeDetailStyles>;

function Chip({ mutagen, filled, palette, styles }: { mutagen: ZiweiMutagen; filled: boolean; palette: ZiweiPalette; styles: ZiweiDetailStyles }) {
    const color = palette.mutagen[mutagen];
    return (
        <View style={[styles.chip, filled ? { backgroundColor: color } : { borderWidth: 1, borderColor: color }]}>
            <Text style={[styles.chipText, { color: filled ? (mutagen === '忌' ? palette.jiText : palette.sealText) : color }]}>{mutagen}</Text>
        </View>
    );
}

export function GanzhiSpan({ text, palette, style }: { text: string; palette: ZiweiPalette; style?: any }) {
    return (
        <Text style={style}>
            {text.split('').map((char, index) => (
                <Text key={index} style={{ color: ganzhiColor(char, palette) }}>{char}</Text>
            ))}
        </Text>
    );
}

function Section({ title, first, styles, children }: { title: string; first?: boolean; styles: ZiweiDetailStyles; children: React.ReactNode }) {
    return (
        <View style={[styles.section, !first && styles.sectionRule]}>
            <Text style={styles.sectionTitle}>{title}</Text>
            {children}
        </View>
    );
}

export interface ZiweiPalaceDetailProps {
    palace: ZiweiPalaceAnalysisView;
    palaces: ZiweiPalaceAnalysisView[];
    dynamic: ZiweiDynamicHoroscopeResult | null;
    cursorInfo: ZiweiCursorInfo | null;
    view: ZiweiView;
    /** 当前视图下本宫的运限四化（scope-layer 的 mutKey） */
    mutKey: string;
    starByName: Record<string, ZiweiStarInsightView> | null;
    selectedStarName: string | null;
    onSelectStar: (name: string | null) => void;
    palette: ZiweiPalette;
    styles: ZiweiDetailStyles;
}

function ZiweiPalaceDetailBase({
    palace,
    palaces,
    dynamic,
    cursorInfo,
    view,
    mutKey,
    starByName,
    selectedStarName,
    onSelectStar,
    palette,
    styles,
}: ZiweiPalaceDetailProps) {
    // 本地选中的星跟着宫位走：换宫后自动清空，不需要重新挂载整页详情
    const [localStar, setLocalStar] = useState<{ palace: string; star: string | null }>({ palace: '', star: null });
    const focusedStar = selectedStarName ?? (localStar.palace === palace.name ? localStar.star : null);
    const scopeMutagens = useMemo(() => parseMutKey(mutKey), [mutKey]);
    const byName = useMemo(() => Object.fromEntries(palaces.map((item) => [item.name, item])), [palaces]);
    const insight = focusedStar && starByName ? starByName[focusedStar] : null;
    const stemStars = useMemo(() => stemMutagenStars(palace.heavenlyStem), [palace.heavenlyStem]);

    const toggleStar = (name: string) => {
        const next = focusedStar === name ? null : name;
        setLocalStar({ palace: palace.name, star: next });
        onSelectStar(next);
    };

    const tags = [palace.isBodyPalace ? '身宫' : '', palace.isOriginalPalace ? '来因宫' : '', palace.isEmpty ? '空宫' : ''].filter(Boolean);
    const surround = palace.surrounded;
    const roles: Array<[string, string]> = [
        ['本宫', surround.target],
        ['对宫', surround.opposite],
        ['三合', surround.wealth],
        ['三合', surround.career],
    ];

    return (
        <View style={{ paddingBottom: 20 }}>
            <Section title="星曜" first styles={styles}>
                {tags.length ? (
                    <View style={[styles.tagRow, { marginTop: 6 }]}>
                        {tags.map((tag) => (
                            <View key={tag} style={styles.tag}><Text style={styles.tagText}>{tag}</Text></View>
                        ))}
                    </View>
                ) : null}
                <View style={styles.starWrap}>
                    {[...palace.majorStars, ...palace.minorStars].map((star, order) => {
                        const major = order < palace.majorStars.length;
                        const scopeMutagen = scopeMutagens[star.name];
                        return (
                            <Pressable key={star.name} style={styles.starItem} onPress={() => toggleStar(star.name)} accessibilityRole="button">
                                <Text style={[major ? styles.starMajor : styles.starMinor, focusedStar === star.name && styles.starOn]}>{star.name}</Text>
                                {star.brightness ? <Text style={styles.brightness}>{star.brightness}</Text> : null}
                                {star.mutagen ? <Chip mutagen={star.mutagen as ZiweiMutagen} filled palette={palette} styles={styles} /> : null}
                                {scopeMutagen ? <Chip mutagen={scopeMutagen} filled={false} palette={palette} styles={styles} /> : null}
                            </Pressable>
                        );
                    })}
                    {palace.majorStars.length + palace.minorStars.length === 0 ? (
                        <Text style={styles.starMinor}>空宫</Text>
                    ) : null}
                </View>
                {palace.adjectiveStars.length ? (
                    <View style={styles.adjWrap}>
                        {palace.adjectiveStars.map((star) => (
                            <View key={star.name} style={styles.adj}><Text style={styles.adjText}>{star.name}</Text></View>
                        ))}
                    </View>
                ) : null}
                {insight ? (
                    <View style={styles.insight}>
                        <Text style={styles.insightText}>
                            {`${insight.name}：亮度 ${insight.brightnessMatches.join(' / ') || insight.brightness || '无'} · 四化 ${insight.mutagenFlags.map((item) => `化${item}`).join(' / ') || '无'} · 对宫 ${insight.oppositePalaceName}`}
                        </Text>
                    </View>
                ) : null}
            </Section>

            <Section title="三方四正" styles={styles}>
                <View style={styles.triGrid}>
                    {roles.map(([role, name], order) => {
                        const target = byName[name];
                        if (!target) {
                            return null;
                        }
                        const opposite = byName[target.surrounded.opposite];
                        const major = target.majorStars.map((star) => star.name).join('·')
                            || (opposite?.majorStars.length ? `空宫 · 借${opposite.majorStars.map((star) => star.name).join('·')}` : '空宫');
                        const minor = target.minorStars.slice(0, 3).map((star) => star.name).join('·');
                        return (
                            <View key={`${role}-${order}`} style={styles.triCell}>
                                <View style={styles.triHead}>
                                    <Text style={[styles.triName, name === palace.name && { color: palette.vermilion }]}>{name}</Text>
                                    <Text style={styles.triRole}>{role}</Text>
                                </View>
                                <Text style={styles.triMajor}>{major}</Text>
                                <Text style={styles.triMinor} numberOfLines={1}>{minor || ' '}</Text>
                            </View>
                        );
                    })}
                </View>
                <View style={styles.checks}>
                    {surround.checks.map((check) => {
                        const bad = check.tone === 'danger' && check.matched;
                        const color = check.matched && !bad ? palette.mutagen.禄 : bad ? palette.vermilion : palette.faint;
                        return (
                            <View key={check.key} style={styles.check}>
                                <Text style={[styles.checkText, { color, fontWeight: '700' }]}>{check.matched && !bad ? '✓' : bad ? '!' : '·'}</Text>
                                <Text style={[styles.checkText, { color: check.matched ? color : palette.muted }]}>{check.label}</Text>
                            </View>
                        );
                    })}
                </View>
            </Section>

            <Section title={`宫干飞化 · ${palace.heavenlyStem}干`} styles={styles}>
                <View style={styles.flyGrid}>
                    {palace.flight.destinations.map((destination, order) => (
                        <View key={destination.mutagen} style={styles.flyItem}>
                            <Chip mutagen={destination.mutagen} filled={false} palette={palette} styles={styles} />
                            <Text style={styles.flyStar}>{stemStars[order] || ''}</Text>
                            <Text style={styles.flyArrow}>→</Text>
                            <Text style={styles.flyDest}>{destination.palaceName || '无'}</Text>
                            {destination.isSelf ? (
                                <View style={styles.selfTag}><Text style={styles.selfTagText}>自化</Text></View>
                            ) : null}
                        </View>
                    ))}
                </View>
            </Section>

            {dynamic && cursorInfo ? (
                <Section title="运限" styles={styles}>
                    {SCOPE_ROWS.map(({ scope, label, prefix }) => {
                        const snapshot = dynamic.runtimeSnapshot.scopes[scope];
                        const role = snapshot.palaceNames[palace.palaceIndex] || '';
                        const flows = (snapshot.starNamesByPalaceIndex[palace.palaceIndex] || []).join(' ');
                        const decadal = scope === 'decadal'
                            ? palaces[dynamic.horoscopeNow.decadal.index]?.decadalRange.replace(/[^\d–-]/g, '').replace('-', '–')
                            : '';
                        const when = scope === 'decadal'
                            ? decadal
                            : scope === 'yearly'
                                ? `${cursorInfo.liunianYear}`
                                : lunarMonthLabel(cursorInfo.lunarMonth, cursorInfo.isLeap);
                        const on = view === scope;
                        return (
                            <View key={scope} style={[styles.scopeRow, on && styles.scopeRowOn]}>
                                <Text style={[styles.scopeLabel, on && styles.scopeLabelOn]} numberOfLines={1}>{`${label} ${when}`}</Text>
                                {role ? (
                                    <View style={styles.scopeTag}><Text style={styles.scopeTagText}>{`${prefix}${palaceShortLabel(role)}`}</Text></View>
                                ) : null}
                                <Text style={styles.scopeStars} numberOfLines={1}>{flows}</Text>
                            </View>
                        );
                    })}
                </Section>
            ) : null}

            <Section title="十二神" styles={styles}>
                <View style={styles.gods}>
                    {[
                        ['长生', palace.changsheng12],
                        ['博士', palace.boshi12],
                        ['岁前', palace.suiqian12],
                        ['将前', palace.jiangqian12],
                    ].map(([label, value]) => (
                        <View key={label} style={styles.god}>
                            <Text style={styles.godLabel}>{label}</Text>
                            <Text style={styles.godValue}>{value || '—'}</Text>
                        </View>
                    ))}
                </View>
            </Section>
        </View>
    );
}

export const ZiweiPalaceDetail = memo(ZiweiPalaceDetailBase);

/** 4×4 小盘：标出当前宫与三方四正 */
export function ZiweiLocator({
    palace,
    palaces,
    cellOf,
    palette,
    size = 32,
}: {
    palace: ZiweiPalaceAnalysisView;
    palaces: ZiweiPalaceAnalysisView[];
    cellOf: (palaceIndex: number) => { row: number; col: number } | undefined;
    palette: ZiweiPalette;
    size?: number;
}) {
    const cell = (size - 3) / 4;
    const triad = new Set([palace.surrounded.opposite, palace.surrounded.wealth, palace.surrounded.career]);
    return (
        <View style={{ width: size, height: size }} accessibilityLabel="宫位位置">
            {palaces.map((item) => {
                const position = cellOf(item.palaceIndex);
                if (!position) {
                    return null;
                }
                const selected = item.name === palace.name;
                const inTriad = triad.has(item.name);
                return (
                    <View
                        key={item.name}
                        style={{
                            position: 'absolute',
                            left: position.col * (cell + 1),
                            top: position.row * (cell + 1),
                            width: cell,
                            height: cell,
                            borderRadius: 1.5,
                            backgroundColor: selected ? palette.vermilion : inTriad ? palette.selectedTint : palette.grid,
                            borderWidth: inTriad && !selected ? 1 : 0,
                            borderColor: palette.vermilion,
                        }}
                    />
                );
            })}
        </View>
    );
}

export { ZIWEI_MUTAGEN_ORDER };
