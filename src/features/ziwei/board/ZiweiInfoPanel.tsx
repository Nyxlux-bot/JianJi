import React, { memo, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { toRgba } from '../../../theme/bazi-theme';
import { detectZiweiPatterns, ZIWEI_PATTERN_TONE_LABEL, type ZiweiPatternTone } from '../patterns';
import { stemMutagenStars, ZIWEI_MUTAGEN_ORDER, zh } from '../scope-layer';
import type { ZiweiDynamicHoroscopeResult, ZiweiDynamicScope, ZiweiMutagen, ZiweiPalaceAnalysisView, ZiweiStarViewModel } from '../types';
import { ChevronIcon } from './ZiweiChrome';
import { GanzhiSpan } from './ZiweiPalaceDetail';
import type { ZiweiPalette } from './palette';

const base = { includeFontPadding: false } as const;
const YANG_STEMS = '甲丙戊庚壬';
const BRANCHES = '子丑寅卯辰巳午未申酉戌亥';
const DECADES_FOLDED = 8;
const SCOPE_ROWS: Array<{ scope: ZiweiDynamicScope | 'age'; label: string }> = [
    { scope: 'decadal', label: '大限' },
    { scope: 'age', label: '小限' },
    { scope: 'yearly', label: '流年' },
    { scope: 'monthly', label: '流月' },
    { scope: 'daily', label: '流日' },
    { scope: 'hourly', label: '流时' },
];

function makeStyles(palette: ZiweiPalette) {
    const card = { backgroundColor: palette.card, borderWidth: 1, borderColor: palette.cardBorder } as const;
    return StyleSheet.create({
        wrap: { paddingHorizontal: 16, paddingTop: 4 },
        hero: { ...card, borderRadius: 16, padding: 16 },
        heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
        name: { ...base, fontSize: 22, lineHeight: 28, fontWeight: '700', color: palette.heading },
        tags: { marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
        tag: { height: 22, paddingHorizontal: 8, borderRadius: 11, backgroundColor: palette.chipBg, justifyContent: 'center' },
        tagText: { ...base, fontSize: 12, lineHeight: 16, color: palette.chipInk },
        seal: { width: 64, height: 64, borderRadius: 12, backgroundColor: palette.vermilion, alignItems: 'center', justifyContent: 'center' },
        sealMain: { ...base, fontSize: 30, lineHeight: 34, fontWeight: '700', color: palette.sealText },
        sealSub: { ...base, fontSize: 12, lineHeight: 15, letterSpacing: 2, color: palette.sealText },
        rule: { height: 1, marginVertical: 14, backgroundColor: palette.hairline },
        pillars: { flexDirection: 'row' },
        pillar: { flex: 1, alignItems: 'center' },
        pillarRule: { borderLeftWidth: 1, borderLeftColor: palette.hairline },
        pillarLabel: { ...base, fontSize: 11, lineHeight: 16, color: palette.muted },
        pillarGz: { ...base, marginTop: 2, fontSize: 26, lineHeight: 30, fontWeight: '700', textAlign: 'center' },
        dateRow: { flexDirection: 'row', alignItems: 'baseline', minHeight: 24 },
        dateLabel: { ...base, width: 64, fontSize: 12, lineHeight: 24, color: palette.muted },
        dateValue: { ...base, flex: 1, fontSize: 13, lineHeight: 24, color: palette.body, fontVariant: ['tabular-nums'] },
        sectionHead: { marginTop: 20, marginBottom: 8, marginHorizontal: 4, minHeight: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
        sectionTitle: { ...base, fontSize: 13, lineHeight: 18, fontWeight: '600', color: palette.muted },
        sectionMeta: { ...base, fontSize: 12, lineHeight: 16, color: palette.muted, fontVariant: ['tabular-nums'] },
        sectionAction: { ...base, fontSize: 13, lineHeight: 18, fontWeight: '600', color: palette.gold },
        grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
        cell: { ...card, width: '47%', flexGrow: 1, borderRadius: 12, padding: 12, gap: 6 },
        cellHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
        cellTitle: { ...base, flexShrink: 1, fontSize: 12, lineHeight: 16, color: palette.muted },
        cellMain: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 6, rowGap: 2, minHeight: 20 },
        cellStar: { flexDirection: 'row', alignItems: 'center', gap: 3 },
        cellStarName: { ...base, fontSize: 14, lineHeight: 20, fontWeight: '700', color: palette.heading },
        cellBright: { ...base, fontSize: 11, lineHeight: 14, color: palette.muted },
        cellBorrow: { ...base, fontSize: 14, lineHeight: 20, color: palette.body },
        cellSub: { ...base, fontSize: 12, lineHeight: 16, color: palette.muted },
        card: { ...card, borderRadius: 14 },
        hua: { flexDirection: 'row', paddingVertical: 14, paddingHorizontal: 4 },
        huaCol: { flex: 1, alignItems: 'center' },
        huaStar: { ...base, marginTop: 6, fontSize: 15, lineHeight: 20, fontWeight: '700', color: palette.heading },
        huaDest: { ...base, marginTop: 2, fontSize: 12, lineHeight: 16, color: palette.muted },
        listCard: { ...card, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 4 },
        patternRow: { flexDirection: 'row', gap: 10, paddingVertical: 12 },
        rowRule: { borderTopWidth: 1, borderTopColor: palette.hairline },
        tone: { width: 28, height: 22, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
        toneText: { ...base, fontSize: 12, lineHeight: 16, fontWeight: '700' },
        patternBody: { flex: 1 },
        patternHead: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
        patternName: { ...base, fontSize: 14, lineHeight: 20, fontWeight: '700', color: palette.heading },
        patternSource: { ...base, flexShrink: 1, fontSize: 11, lineHeight: 16, color: palette.muted },
        laterHead: { ...base, paddingTop: 10, paddingBottom: 2, fontSize: 11, lineHeight: 16, color: palette.muted },
        patternDetail: { ...base, fontSize: 12, lineHeight: 18, color: palette.muted },
        empty: { ...base, paddingVertical: 12, fontSize: 13, lineHeight: 18, color: palette.muted },
        footnote: { ...base, marginTop: 6, marginHorizontal: 4, fontSize: 11, lineHeight: 16, color: palette.muted },
        decades: { ...card, borderRadius: 14, paddingHorizontal: 8, paddingVertical: 6 },
        decade: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8, borderRadius: 10 },
        decadeOn: { backgroundColor: palette.selectedTint },
        decadeAge: { width: 58 },
        decadeRange: { ...base, fontSize: 13, lineHeight: 18, fontWeight: '700', color: palette.heading, fontVariant: ['tabular-nums'] },
        decadeGz: { ...base, fontSize: 11, lineHeight: 14, fontWeight: '600' },
        decadeMain: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6 },
        decadeName: { ...base, fontSize: 14, lineHeight: 20, fontWeight: '700', color: palette.heading },
        decadeStars: { ...base, flexShrink: 1, fontSize: 13, lineHeight: 20, color: palette.body },
        nowTag: { paddingHorizontal: 5, borderRadius: 4, borderWidth: 1, borderColor: palette.goldBorder, backgroundColor: palette.goldSoft },
        nowTagText: { ...base, fontSize: 11, lineHeight: 16, fontWeight: '600', color: palette.gold },
        flips: { flexDirection: 'row', alignItems: 'center', gap: 8 },
        flip: { flexDirection: 'row', alignItems: 'center', gap: 3 },
        flipText: { ...base, fontSize: 12, lineHeight: 16, color: palette.body },
        expand: { height: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, borderTopWidth: 1, borderTopColor: palette.hairline },
        expandText: { ...base, fontSize: 13, lineHeight: 18, color: palette.muted },
        scope: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 8 },
        scopeLabel: { ...base, width: 28, fontSize: 13, lineHeight: 18, color: palette.muted },
        scopeGz: { ...base, width: 32, fontSize: 14, lineHeight: 18, fontWeight: '700' },
        scopeTag: { paddingHorizontal: 5, borderRadius: 4, borderWidth: 1, borderColor: palette.goldBorder, backgroundColor: palette.goldSoft },
        scopeTagText: { ...base, fontSize: 12, lineHeight: 18, fontWeight: '600', color: palette.gold },
        scopeChips: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 5 },
        scopeAge: { ...base, marginLeft: 'auto', fontSize: 12, lineHeight: 16, color: palette.muted, fontVariant: ['tabular-nums'] },
        chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
        chip: { height: 26, paddingHorizontal: 10, borderRadius: 13, borderWidth: 1, borderColor: palette.segBorder, justifyContent: 'center' },
        chipText: { ...base, fontSize: 12, lineHeight: 16, color: palette.body },
    });
}

type InfoStyles = ReturnType<typeof makeStyles>;

function HuaChip({ mutagen, filled, size = 16, palette }: { mutagen: ZiweiMutagen; filled: boolean; size?: number; palette: ZiweiPalette }) {
    const color = palette.mutagen[mutagen];
    return (
        <View
            style={[
                { width: size, height: size, borderRadius: size > 16 ? 4 : 3, alignItems: 'center', justifyContent: 'center' },
                filled ? { backgroundColor: color } : { borderWidth: 1, borderColor: color },
            ]}
        >
            <Text style={{ ...base, fontSize: size > 16 ? 12 : 10, lineHeight: size > 16 ? 16 : 12, fontWeight: '700', color: filled ? (mutagen === '忌' ? palette.jiText : palette.sealText) : color }}>
                {mutagen}
            </Text>
        </View>
    );
}

function ageRangeOf(palace: ZiweiPalaceAnalysisView): { start: number; label: string } {
    const label = palace.decadalRange.replace(/[^\d–-]/g, '').replace('-', '–');
    return { start: Number.parseInt(label, 10) || 0, label };
}

/** 主星；空宫写成「空宫 · 借对宫主星」 */
function majorText(palace: ZiweiPalaceAnalysisView, byName: Map<string, ZiweiPalaceAnalysisView>): string {
    if (palace.majorStars.length > 0) {
        return palace.majorStars.map((star) => star.name).join('·');
    }
    const borrowed = byName.get(palace.surrounded.opposite)?.majorStars.map((star) => star.name).join('·');
    return borrowed ? `空宫·借${borrowed}` : '空宫';
}

function SectionHead({ title, meta, styles, children }: { title: string; meta?: string; styles: InfoStyles; children?: React.ReactNode }) {
    return (
        <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle} accessibilityRole="header">{title}</Text>
            {children ?? (meta ? <Text style={styles.sectionMeta}>{meta}</Text> : null)}
        </View>
    );
}

function PalaceCell({
    title,
    palace,
    byName,
    sub,
    palette,
    styles,
    onPress,
}: {
    title: string;
    palace: ZiweiPalaceAnalysisView | undefined;
    byName: Map<string, ZiweiPalaceAnalysisView>;
    sub?: string;
    palette: ZiweiPalette;
    styles: InfoStyles;
    onPress: (index: number) => void;
}) {
    if (!palace) {
        return null;
    }
    const minors = palace.minorStars.map((star) => star.name).slice(0, 4).join('·');
    return (
        <Pressable
            style={styles.cell}
            onPress={() => onPress(palace.palaceIndex)}
            accessibilityRole="button"
            accessibilityLabel={`${title}，查看${palace.name}详情`}
        >
            <View style={styles.cellHead}>
                <Text style={styles.cellTitle} numberOfLines={1}>
                    {`${title} `}
                    <GanzhiSpan text={`${palace.heavenlyStem}${palace.earthlyBranch}`} palette={palette} style={{ fontWeight: '600' }} />
                </Text>
                <ChevronIcon direction="right" color={palette.muted} size={12} />
            </View>
            <View style={styles.cellMain}>
                {palace.majorStars.length > 0 ? palace.majorStars.map((star) => (
                    <View key={star.name} style={styles.cellStar}>
                        <Text style={styles.cellStarName}>{star.name}</Text>
                        {star.brightness ? <Text style={styles.cellBright}>{star.brightness}</Text> : null}
                        {star.mutagen ? <HuaChip mutagen={star.mutagen as ZiweiMutagen} filled palette={palette} /> : null}
                    </View>
                )) : <Text style={styles.cellBorrow} numberOfLines={1}>{majorText(palace, byName).replace('·借', ' · 借')}</Text>}
            </View>
            <Text style={styles.cellSub} numberOfLines={1}>{sub || minors || '无辅曜'}</Text>
        </Pressable>
    );
}

export interface ZiweiInfoPanelProps {
    name: string;
    gender: 'male' | 'female';
    chineseDate: string;
    zodiac: string | null;
    sign: string;
    fiveElements: string;
    soul: string;
    body: string;
    dateRows: Array<[string, string]>;
    /** 按宫位序号（palaceIndex）排的十二宫 */
    palaceByIndex: ZiweiPalaceAnalysisView[];
    dynamic: ZiweiDynamicHoroscopeResult | null;
    cursorLabel: string;
    configChips: string[];
    canEditConfig: boolean;
    palette: ZiweiPalette;
    onOpenPalace: (index: number) => void;
    onEditConfig: () => void;
}

function ZiweiInfoPanelBase({
    name,
    gender,
    chineseDate,
    zodiac,
    sign,
    fiveElements,
    soul,
    body,
    dateRows,
    palaceByIndex,
    dynamic,
    cursorLabel,
    configChips,
    canEditConfig,
    palette,
    onOpenPalace,
    onEditConfig,
}: ZiweiInfoPanelProps) {
    const styles = useMemo(() => makeStyles(palette), [palette]);
    const [allDecades, setAllDecades] = useState(false);
    const palaces = useMemo(() => palaceByIndex.filter(Boolean), [palaceByIndex]);
    const byName = useMemo(() => new Map(palaces.map((palace) => [palace.name, palace])), [palaces]);
    const patterns = useMemo(() => detectZiweiPatterns(palaces), [palaces]);
    const starHome = useMemo(() => {
        const map = new Map<string, { star: ZiweiStarViewModel; palace: ZiweiPalaceAnalysisView }>();
        palaces.forEach((palace) => [...palace.majorStars, ...palace.minorStars].forEach((star) => map.set(star.name, { star, palace })));
        return map;
    }, [palaces]);
    const decades = useMemo(() => palaces
        .map((palace) => ({ palace, range: ageRangeOf(palace), flips: stemMutagenStars(palace.heavenlyStem) }))
        .sort((a, b) => a.range.start - b.range.start), [palaces]);

    const ming = byName.get('命宫');
    const bodyPalace = palaces.find((palace) => palace.isBodyPalace);
    const origin = palaces.find((palace) => palace.isOriginalPalace);
    const pillars = chineseDate.split(' ').filter(Boolean);
    // 来因宫干即排盘所用的年干（随年界设置），比四柱年干更贴合大限顺逆
    const yearStem = origin?.heavenlyStem || pillars[0]?.[0] || '';
    const yinYang = yearStem ? `${YANG_STEMS.includes(yearStem) ? '阳' : '阴'}${gender === 'male' ? '男' : '女'}` : '';
    const forward = decades.length > 1
        && (BRANCHES.indexOf(decades[1].palace.earthlyBranch) - BRANCHES.indexOf(decades[0].palace.earthlyBranch) + 12) % 12 === 1;
    const tags = [
        yinYang,
        zodiac ? `属${zodiac}` : '',
        sign,
    ].filter(Boolean);
    const sealElement = fiveElements.slice(0, 1);
    const sealRest = fiveElements.slice(1);
    const birthHua = ZIWEI_MUTAGEN_ORDER.map((mutagen) => {
        const hit = [...starHome.values()].find((item) => item.star.mutagen === mutagen);
        return { mutagen, star: hit?.star.name || '—', palace: hit?.palace.name || '' };
    });
    const currentDecadeIndex = dynamic?.horoscopeNow.decadal.index ?? -1;
    const currentDecadeOrder = decades.findIndex((item) => item.palace.palaceIndex === currentDecadeIndex);
    const showAllDecades = allDecades || currentDecadeOrder >= DECADES_FOLDED;
    const visibleDecades = showAllDecades ? decades : decades.slice(0, DECADES_FOLDED);
    const soulHome = starHome.get(soul)?.palace.name;
    const bodyHome = starHome.get(body)?.palace.name;

    const toneColors: Record<ZiweiPatternTone, { bg: string; fg: string }> = {
        good: { bg: toRgba(palette.mutagen.禄, palette.isLight ? 0.12 : 0.18), fg: palette.mutagen.禄 },
        mixed: { bg: palette.goldSoft, fg: palette.gold },
        bad: { bg: toRgba(palette.vermilion, palette.isLight ? 0.12 : 0.18), fg: palette.vermilion },
    };

    return (
        <View style={styles.wrap}>
            <View style={styles.hero}>
                <View style={styles.heroTop}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.name} numberOfLines={1}>{name}</Text>
                        <View style={styles.tags}>
                            {tags.map((tag) => (
                                <View key={tag} style={styles.tag}><Text style={styles.tagText}>{tag}</Text></View>
                            ))}
                        </View>
                    </View>
                    {fiveElements ? (
                        <View style={styles.seal} accessible accessibilityLabel={`五行局 ${fiveElements}`}>
                            <Text style={styles.sealMain}>{sealElement}</Text>
                            <Text style={styles.sealSub}>{sealRest}</Text>
                        </View>
                    ) : null}
                </View>
                {pillars.length === 4 ? (
                    <>
                        <View style={styles.rule} />
                        <View style={styles.pillars}>
                            {pillars.map((pillar, order) => (
                                <View key={order} style={[styles.pillar, order > 0 && styles.pillarRule]}>
                                    <Text style={styles.pillarLabel}>{['年柱', '月柱', '日柱', '时柱'][order]}</Text>
                                    <GanzhiSpan text={pillar.slice(0, 1)} palette={palette} style={styles.pillarGz} />
                                    <GanzhiSpan text={pillar.slice(1, 2)} palette={palette} style={[styles.pillarGz, { marginTop: 0 }]} />
                                </View>
                            ))}
                        </View>
                    </>
                ) : null}
                <View style={styles.rule} />
                {dateRows.map(([label, value]) => (
                    <View key={label} style={styles.dateRow}>
                        <Text style={styles.dateLabel}>{label}</Text>
                        <Text style={styles.dateValue}>{value}</Text>
                    </View>
                ))}
            </View>

            <SectionHead title="命身要点" meta="点按查看宫位" styles={styles} />
            <View style={styles.grid}>
                <PalaceCell title="命宫" palace={ming} byName={byName} palette={palette} styles={styles} onPress={onOpenPalace} />
                <PalaceCell title={`身宫 · ${bodyPalace?.name || ''}`} palace={bodyPalace} byName={byName} palette={palette} styles={styles} onPress={onOpenPalace} />
                <PalaceCell
                    title={`来因 · ${origin?.name || ''}`}
                    palace={origin}
                    byName={byName}
                    sub={origin && origin.palaceIndex === currentDecadeIndex ? '当前大限正行此宫' : undefined}
                    palette={palette}
                    styles={styles}
                    onPress={onOpenPalace}
                />
                <View style={styles.cell}>
                    <Text style={styles.cellTitle}>命主 / 身主</Text>
                    <Text style={styles.cellStarName}>{`${soul || '—'} / ${body || '—'}`}</Text>
                    <Text style={styles.cellSub} numberOfLines={1}>
                        {[soulHome ? `${soul}在${soulHome}` : '', bodyHome ? `${body}在${bodyHome}` : ''].filter(Boolean).join(' · ') || '—'}
                    </Text>
                </View>
            </View>

            <SectionHead title="生年四化" meta={origin ? `${origin.heavenlyStem}干` : undefined} styles={styles} />
            <View style={[styles.card, styles.hua]}>
                {birthHua.map((item, order) => (
                    <View key={item.mutagen} style={[styles.huaCol, order > 0 && styles.pillarRule]}>
                        <HuaChip mutagen={item.mutagen} filled size={20} palette={palette} />
                        <Text style={styles.huaStar}>{item.star}</Text>
                        <Text style={styles.huaDest}>{item.palace ? `入${item.palace}` : ' '}</Text>
                    </View>
                ))}
            </View>

            <SectionHead title="格局" meta={patterns.length > 0 ? `${patterns.length} 项` : undefined} styles={styles} />
            <View style={styles.listCard}>
                {patterns.length > 0 ? patterns.map((hit, order) => {
                    const laterStart = hit.basis === 'later' && patterns[order - 1]?.basis !== 'later';
                    return (
                        <React.Fragment key={hit.key}>
                            {laterStart ? (
                                <Text style={[styles.laterHead, order > 0 && styles.rowRule]}>以下为后世书籍格局，《全书》未载</Text>
                            ) : null}
                            <View style={[styles.patternRow, order > 0 && !laterStart && styles.rowRule]}>
                                <View style={[styles.tone, { backgroundColor: toneColors[hit.tone].bg }]}>
                                    <Text style={[styles.toneText, { color: toneColors[hit.tone].fg }]}>{ZIWEI_PATTERN_TONE_LABEL[hit.tone]}</Text>
                                </View>
                                <View style={styles.patternBody}>
                                    <View style={styles.patternHead}>
                                        <Text style={styles.patternName}>{hit.name}</Text>
                                        <Text style={styles.patternSource} numberOfLines={1}>
                                            {hit.basis === 'verse' ? `${hit.source} · 取通行释义` : hit.source}
                                        </Text>
                                    </View>
                                    <Text style={styles.patternDetail}>{hit.detail}</Text>
                                </View>
                            </View>
                        </React.Fragment>
                    );
                }) : <Text style={styles.empty}>命宫未见《全书》所载格局</Text>}
            </View>
            <Text style={styles.footnote}>
                依《紫微斗数全书》卷一定富、定贵、定贫贱三局原注判定；赋文有句无注者取通行释义；后世格局单独标注。吉凶随原书所列之局，宜结合整盘与运限看。
            </Text>

            <SectionHead title="一生大限" meta={`${yinYang}${forward ? '顺行' : '逆行'} · 大限禄忌`} styles={styles} />
            <View style={styles.decades}>
                {visibleDecades.map(({ palace, range, flips }) => {
                    const on = palace.palaceIndex === currentDecadeIndex;
                    return (
                        <View key={palace.palaceIndex} style={[styles.decade, on && styles.decadeOn]}>
                            <View style={styles.decadeAge}>
                                <Text style={[styles.decadeRange, on && { color: palette.vermilion }]}>{range.label}</Text>
                                <GanzhiSpan text={`${palace.heavenlyStem}${palace.earthlyBranch}`} palette={palette} style={styles.decadeGz} />
                            </View>
                            <View style={styles.decadeMain}>
                                <Text style={[styles.decadeName, on && { color: palette.vermilion }]}>{palace.name}</Text>
                                {on ? <View style={styles.nowTag}><Text style={styles.nowTagText}>当前</Text></View> : null}
                                <Text style={styles.decadeStars} numberOfLines={1}>{majorText(palace, byName)}</Text>
                            </View>
                            <View style={styles.flips}>
                                {([['禄', flips[0]], ['忌', flips[3]]] as Array<[ZiweiMutagen, string]>).map(([mutagen, star]) => (star ? (
                                    <View key={mutagen} style={styles.flip}>
                                        <HuaChip mutagen={mutagen} filled={false} palette={palette} />
                                        <Text style={styles.flipText}>{star}</Text>
                                    </View>
                                ) : null))}
                            </View>
                        </View>
                    );
                })}
                {decades.length > DECADES_FOLDED && !showAllDecades ? (
                    <Pressable style={styles.expand} onPress={() => setAllDecades(true)} accessibilityRole="button">
                        <Text style={styles.expandText}>
                            {`展开 ${decades[DECADES_FOLDED].range.start}–${decades[decades.length - 1].range.label.split('–')[1] || ''} 岁 · 其余 ${decades.length - DECADES_FOLDED} 限`}
                        </Text>
                        <ChevronIcon direction="down" color={palette.muted} />
                    </Pressable>
                ) : null}
            </View>

            {dynamic ? (
                <>
                    <SectionHead title="当前运限" meta={cursorLabel} styles={styles} />
                    <View style={styles.listCard}>
                        {SCOPE_ROWS.map(({ scope, label }, order) => {
                            const item = dynamic.horoscopeNow[scope];
                            const stars = scope === 'age' ? [] : dynamic.runtimeSnapshot.scopes[scope].mutagen;
                            const home = palaceByIndex[item.index]?.name;
                            return (
                                <View key={scope} style={[styles.scope, order > 0 && styles.rowRule]}>
                                    <Text style={styles.scopeLabel}>{label}</Text>
                                    <GanzhiSpan
                                        text={`${zh(item.heavenlyStem, 'Heavenly')}${zh(item.earthlyBranch, 'Earthly')}`}
                                        palette={palette}
                                        style={styles.scopeGz}
                                    />
                                    {home ? <View style={styles.scopeTag}><Text style={styles.scopeTagText}>{home}</Text></View> : null}
                                    {scope === 'age' ? (
                                        <Text style={styles.scopeAge}>{`虚岁 ${dynamic.horoscopeNow.age.nominalAge}`}</Text>
                                    ) : (
                                        <View style={styles.scopeChips}>
                                            {stars.map((star, index) => (star ? (
                                                <View key={ZIWEI_MUTAGEN_ORDER[index]} style={styles.flip}>
                                                    <HuaChip mutagen={ZIWEI_MUTAGEN_ORDER[index]} filled={false} size={15} palette={palette} />
                                                    <Text style={styles.flipText}>{star}</Text>
                                                </View>
                                            ) : null))}
                                        </View>
                                    )}
                                </View>
                            );
                        })}
                    </View>
                </>
            ) : null}

            <SectionHead title="排盘设置" styles={styles}>
                <Pressable onPress={onEditConfig} disabled={!canEditConfig} hitSlop={12} accessibilityRole="button">
                    <Text style={[styles.sectionAction, !canEditConfig && { opacity: 0.45 }]}>修改</Text>
                </Pressable>
            </SectionHead>
            <View style={styles.chips}>
                {configChips.map((chip) => (
                    <View key={chip} style={styles.chip}><Text style={styles.chipText}>{chip}</Text></View>
                ))}
            </View>
        </View>
    );
}

export const ZiweiInfoPanel = memo(ZiweiInfoPanelBase);
