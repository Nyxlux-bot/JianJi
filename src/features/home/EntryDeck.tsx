import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import Animated, { Easing, FadeInDown, ReduceMotion, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { ChevronRightIcon } from '../../components/Icons';
import YongleCoin from '../../components/YongleCoin';
import { useTheme } from '../../theme/ThemeContext';
import { ENTRY_THEMES, HOME_ENTRIES, type EntryTheme, type HomeEntry, type HomeEntryId } from './entries';

const STORAGE_KEY = 'home_entry_open';
const OVERLAP = 10;
const EASING = Easing.bezier(0.2, 0.8, 0.2, 1);
const SERIF = Platform.select({ ios: 'Songti SC', android: 'serif', web: "'Songti SC', SimSun, serif", default: 'serif' });

function EntryArt({ entry, size }: { entry: HomeEntry; size: number }) {
    return (
        <View style={{ width: size, height: size }} pointerEvents="none" aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {entry.id === 'liuyao' ? (
                <>
                    <YongleCoin face="back" size={size * 0.46} style={{ position: 'absolute', left: size * 0.5, top: -size * 0.02, transform: [{ rotate: '12deg' }] }} />
                    <YongleCoin face="front" size={size * 0.54} style={{ position: 'absolute', left: size * 0.02, top: size * 0.2, transform: [{ rotate: '-14deg' }] }} />
                    <YongleCoin face="front" size={size * 0.58} style={{ position: 'absolute', left: size * 0.36, top: size * 0.44, transform: [{ rotate: '20deg' }] }} />
                </>
            ) : <Image source={entry.image} style={{ width: size, height: size }} resizeMode="contain" fadeDuration={0} accessibilityIgnoresInvertColors />}
        </View>
    );
}

function EntryCard({ entry, index, expanded, top, headerHeight, openHeight, artSize, colors, description, meta, onSelect, reduceMotion, largeText }: {
    entry: HomeEntry;
    index: number;
    expanded: boolean;
    top: number;
    headerHeight: number;
    openHeight: number;
    artSize: number;
    colors: EntryTheme;
    description: React.ReactNode;
    meta: string;
    onSelect: () => void;
    reduceMotion: boolean;
    largeText: boolean;
}) {
    const styles = useMemo(() => makeStyles(colors, entry.id), [colors, entry.id]);
    const gradientId = useId();
    const y = useSharedValue(top);
    const height = useSharedValue(expanded ? openHeight : headerHeight + OVERLAP);
    const arrow = useSharedValue(expanded ? 90 : 0);
    const art = useSharedValue(expanded ? 1 : 0);
    const text = useSharedValue(expanded ? 1 : 0);
    const detail = useSharedValue(expanded ? 1 : 0);
    const actions = useSharedValue(expanded ? 1 : 0);

    useEffect(() => {
        const motion = { duration: reduceMotion ? 0 : 380, easing: EASING };
        y.value = withTiming(top, motion);
        height.value = withTiming(expanded ? openHeight : headerHeight + OVERLAP, motion);
        arrow.value = withTiming(expanded ? 90 : 0, motion);
        for (const [progress, delay] of [[art, 80], [text, 120], [detail, 160], [actions, 200]] as const) {
            progress.value = expanded
                ? withDelay(reduceMotion ? 0 : delay, withTiming(1, { duration: reduceMotion ? 0 : 300, easing: EASING }))
                : withTiming(0, { duration: reduceMotion ? 0 : 120 });
        }
    }, [expanded, top, headerHeight, openHeight, reduceMotion, y, height, arrow, art, text, detail, actions]);

    const cardMotion = useAnimatedStyle(() => ({ top: y.value, height: height.value }));
    const arrowMotion = useAnimatedStyle(() => ({ transform: [{ rotate: `${arrow.value}deg` }] }));
    const artMotion = useAnimatedStyle(() => ({ opacity: art.value, transform: [{ translateX: (1 - art.value) * 24 }, { scale: 0.94 + art.value * 0.06 }] }));
    const textMotion = useAnimatedStyle(() => ({ opacity: text.value, transform: [{ translateY: (1 - text.value) * 6 }] }));
    const detailMotion = useAnimatedStyle(() => ({ opacity: detail.value, transform: [{ translateY: (1 - detail.value) * 6 }] }));
    const actionMotion = useAnimatedStyle(() => ({ opacity: actions.value, transform: [{ translateY: (1 - actions.value) * 6 }] }));
    const button = colors.buttons[entry.id];
    const gradient = colors.gradients[entry.id];

    return (
        <Animated.View
            entering={reduceMotion ? undefined : FadeInDown.duration(420).delay(index * 50).easing(EASING).reduceMotion(ReduceMotion.System)}
            style={[styles.card, { zIndex: index + 1, backgroundColor: gradient.top }, cardMotion]}
            testID={`home-entry-${entry.id}`}
        >
            <View style={styles.clip}>
                <View style={StyleSheet.absoluteFill} pointerEvents="none" aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                    <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
                        <Defs>
                            <LinearGradient id={`${gradientId}-fill`} x1="15%" y1="0%" x2="85%" y2="100%">
                                <Stop offset="0" stopColor={gradient.top} />
                                <Stop offset="0.49" stopColor={gradient.middle} />
                                <Stop offset="1" stopColor={gradient.bottom} />
                            </LinearGradient>
                            <RadialGradient id={`${gradientId}-glow`} cx="85%" cy="65%" rx="85%" ry="65%">
                                <Stop offset="0" stopColor={gradient.glow} stopOpacity={0.14} />
                                <Stop offset="1" stopColor={gradient.glow} stopOpacity={0} />
                            </RadialGradient>
                        </Defs>
                        <Rect width="100" height="100" fill={`url(#${gradientId}-fill)`} />
                        <Rect width="100" height="100" fill={`url(#${gradientId}-glow)`} />
                    </Svg>
                </View>
                <Pressable
                    onPress={onSelect}
                    style={({ pressed }) => [styles.head, { height: headerHeight }, pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityLabel={entry.title}
                    accessibilityState={{ expanded }}
                    aria-expanded={expanded}
                    accessibilityHint="展开功能入口"
                >
                    <EntryArt entry={entry} size={40} />
                    <View style={styles.titles}>
                        <Text style={styles.title} numberOfLines={1}>{entry.title}</Text>
                        <Text style={styles.subtitle} numberOfLines={1}>{entry.subtitle}</Text>
                    </View>
                    {!largeText && <Text style={styles.group}>{entry.group}</Text>}
                    <Animated.View style={arrowMotion}><ChevronRightIcon size={16} color={colors.muted} /></Animated.View>
                </Pressable>
                <View
                    style={[styles.body, { top: headerHeight, height: openHeight - headerHeight }]}
                    pointerEvents={expanded ? 'auto' : 'none'}
                    aria-hidden={!expanded}
                    accessibilityElementsHidden={!expanded}
                    importantForAccessibility={expanded ? 'auto' : 'no-hide-descendants'}
                >
                    <Animated.View style={[styles.art, artMotion]}><EntryArt entry={entry} size={artSize} /></Animated.View>
                    <View style={{ paddingRight: Math.max(0, artSize - 4) }}>
                        <Animated.View style={textMotion}><Text style={styles.description}>{description}</Text></Animated.View>
                        <Animated.View style={detailMotion}><Text style={styles.meta}>{meta}</Text></Animated.View>
                    </View>
                    <Animated.View style={[styles.actionRow, actionMotion]}>
                        {entry.actions.map(({ label, accessibilityLabel, route, Icon }, actionIndex) => (
                            <Pressable
                                key={label}
                                onPress={() => router.push(route)}
                                style={({ pressed }) => [styles.action, actionIndex === 0 && styles.primary, pressed && (reduceMotion ? styles.pressed : styles.actionPressed)]}
                                accessibilityRole="button"
                                accessibilityLabel={accessibilityLabel}
                                focusable={expanded}
                                tabIndex={expanded ? 0 : -1}
                            >
                                <Icon size={16} color={actionIndex === 0 ? button.ink : button.tint} />
                                <Text style={[styles.actionText, actionIndex === 0 && styles.primaryText]}>{label}</Text>
                                {actionIndex === 0 && <View style={styles.actionArrow}><ChevronRightIcon size={12} color={button.ink} /></View>}
                            </Pressable>
                        ))}
                    </Animated.View>
                </View>
            </View>
        </Animated.View>
    );
}

export default function EntryDeck({ liuyaoMeta, meihuaDescription, meihuaMeta }: {
    liuyaoMeta: string;
    meihuaDescription: React.ReactNode;
    meihuaMeta: string;
}) {
    const { theme } = useTheme();
    const { width, fontScale } = useWindowDimensions();
    const reduceMotion = useReducedMotion();
    const [cardWidth, setCardWidth] = useState(width - 32);
    const [open, setOpen] = useState<HomeEntryId>('liuyao');
    const hasSelected = useRef(false);
    const headerHeight = Math.max(52, Math.ceil(37 * fontScale + 12));
    const openHeight = headerHeight + Math.max(172, Math.ceil(156 * fontScale + 16));
    const largeText = fontScale > 1.3;
    const artSize = Math.min(largeText ? 96 : 168, Math.round(cardWidth * 0.46));
    const openIndex = HOME_ENTRIES.findIndex(entry => entry.id === open);

    useEffect(() => {
        let cancelled = false;
        AsyncStorage.getItem(STORAGE_KEY).then(saved => {
            const entry = HOME_ENTRIES.find(item => item.id === saved);
            if (!cancelled && !hasSelected.current && entry) setOpen(entry.id);
        }).catch(() => undefined);
        return () => { cancelled = true; };
    }, []);

    const select = (id: HomeEntryId) => {
        hasSelected.current = true;
        setOpen(id);
        AsyncStorage.setItem(STORAGE_KEY, id).catch(() => undefined);
    };

    return (
        <View
            style={{ height: openHeight + (HOME_ENTRIES.length - 1) * headerHeight }}
            onLayout={event => setCardWidth(event.nativeEvent.layout.width)}
            testID="home-entry-deck"
        >
            {HOME_ENTRIES.map((entry, index) => (
                <EntryCard
                    key={entry.id}
                    entry={entry}
                    index={index}
                    expanded={entry.id === open}
                    top={index * headerHeight + (index > openIndex ? openHeight - headerHeight - OVERLAP : 0)}
                    headerHeight={headerHeight}
                    openHeight={openHeight}
                    artSize={artSize}
                    colors={ENTRY_THEMES[theme]}
                    description={entry.id === 'meihua' ? meihuaDescription : entry.description}
                    meta={entry.id === 'liuyao' ? liuyaoMeta : entry.id === 'meihua' ? meihuaMeta : entry.meta}
                    onSelect={() => select(entry.id)}
                    reduceMotion={reduceMotion}
                    largeText={largeText}
                />
            ))}
        </View>
    );
}

function makeStyles(colors: EntryTheme, entryId: HomeEntryId) {
    const button = colors.buttons[entryId];
    return StyleSheet.create({
        card: { position: 'absolute', left: 0, right: 0, borderRadius: 18, shadowColor: colors.shadow, shadowOffset: { width: 0, height: -4 }, shadowOpacity: colors.shadowOpacity, shadowRadius: 10, elevation: 3 },
        clip: { flex: 1, overflow: 'hidden', borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, borderTopColor: colors.borderTop, borderBottomColor: colors.borderBottom },
        head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 12, paddingRight: 14 },
        titles: { flex: 1, minWidth: 0 },
        title: { fontFamily: SERIF, fontSize: 17, lineHeight: 22, fontWeight: '700', letterSpacing: 2, color: colors.ink },
        subtitle: { fontSize: 11, lineHeight: 15, color: colors.muted },
        group: { fontSize: 10.5, lineHeight: 14, letterSpacing: 2, color: colors.gold },
        body: { position: 'absolute', left: 0, right: 0, paddingTop: 4, paddingHorizontal: 16 },
        art: { position: 'absolute', right: 6, top: 0 },
        description: { marginTop: 4, fontSize: 13, lineHeight: 19, color: colors.ink },
        meta: { marginTop: 4, fontSize: 11.5, lineHeight: 17, color: colors.muted },
        actionRow: { position: 'absolute', left: 16, right: 16, bottom: 16, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
        action: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 12, paddingVertical: 10, minWidth: 76, minHeight: 44, borderRadius: 18, borderWidth: 1, borderColor: 'transparent', backgroundColor: 'transparent', overflow: 'hidden' },
        primary: { backgroundColor: button.fill, borderColor: button.border },
        actionText: { fontSize: 14, lineHeight: 20, fontWeight: '500', color: button.tint },
        primaryText: { color: button.ink, fontWeight: '600' },
        actionArrow: { marginLeft: 5 },
        actionPressed: { opacity: 0.85, transform: [{ translateY: 1 }, { scale: 0.98 }] },
        pressed: { opacity: 0.75 },
    });
}
