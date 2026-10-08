import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type AccessibilityActionEvent, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { getAutoRestIndex, resolveShownLevel, THINKING_LEVEL_META, type ThinkingLock } from '../../services/ai-model-capabilities';
import type { AIReasoningSetting } from '../../services/ai-provider-types';
import { FontSize } from '../../theme/colors';

const KNOB = 26;
/** The rail is inset by half a knob so both end stops sit fully inside the touch area. */
const INSET = KNOB / 2;
const AREA_HEIGHT = 44;
const RAIL_HEIGHT = 6;
const HOLE = 8;
const LABEL_WIDTH = 44;
const SNAP = { damping: 26, stiffness: 320, overshootClamping: true } as const;

const LOCK_COPY: Record<ThinkingLock, { label: string; description: string }> = {
    always: { label: '始终', description: '这个模型始终会先思考再作答，接口不提供调节。' },
    unsupported: { label: '不支持', description: '这个模型不支持调节思考。' },
    rejected: { label: '自动', description: '此接口不接受思考参数，按模型默认运行。在 AI 中枢点「重新检测」可再试一次。' },
};

function levelMeta(level: AIReasoningSetting) {
    return THINKING_LEVEL_META[level === 'budget' ? 'medium' : level];
}

/**
 * Thinking-strength slider for the model sheet: a coin-shaped knob on a
 * stepped rail with a label under every stop. Drag or tap; it snaps to a stop
 * and commits on release. The stops come from the active model.
 */
export default function ThinkingSlider({ stops, value, budget, lock, onChange, Colors }: {
    stops: AIReasoningSetting[];
    value: AIReasoningSetting;
    budget?: number;
    lock: ThinkingLock | null;
    onChange: (level: AIReasoningSetting) => void;
    Colors: any;
}) {
    const styles = useMemo(() => makeStyles(Colors), [Colors]);
    const count = stops.length;
    const locked = Boolean(lock) || count < 2;
    const shown = resolveShownLevel(value, stops, budget);
    const auto = !locked && shown === 'default';
    const index = auto ? getAutoRestIndex(stops) : Math.max(0, stops.indexOf(shown));

    const [hover, setHover] = useState<number | null>(null);
    const [areaWidth, setAreaWidth] = useState(0);
    const width = useSharedValue(0);
    const x = useSharedValue(INSET);
    const pressed = useSharedValue(0);
    const lastHover = useSharedValue(-1);

    const stopX = useCallback((stop: number, span: number) => {
        'worklet';
        return count > 1 ? INSET + (stop * (span - 2 * INSET)) / (count - 1) : span - INSET;
    }, [count]);
    const restX = useCallback((span: number) => (lock === 'always' ? span - INSET : stopX(index, span)), [lock, index, stopX]);

    // Follow the saved level whenever it changes outside a drag.
    useEffect(() => {
        if (width.value > 0 && pressed.value === 0) x.value = withTiming(restX(width.value), { duration: 180 });
    }, [restX, width, x, pressed]);

    const commit = useCallback((stop: number) => {
        setHover(null);
        const next = stops[stop];
        if (next && next !== shown) onChange(next);
    }, [stops, shown, onChange]);

    const gesture = useMemo(() => {
        const nearest = (px: number) => {
            'worklet';
            const span = width.value - 2 * INSET;
            if (count < 2 || span <= 0) return 0;
            return Math.min(count - 1, Math.max(0, Math.round(((px - INSET) / span) * (count - 1))));
        };
        const settle = (px: number) => {
            'worklet';
            const stop = nearest(px);
            x.value = withSpring(stopX(stop, width.value), SNAP);
            runOnJS(commit)(stop);
        };
        const pan = Gesture.Pan()
            .enabled(!locked)
            .activeOffsetX([-3, 3])
            .failOffsetY([-16, 16])
            .onBegin(() => { pressed.value = withTiming(1, { duration: 120 }); })
            .onUpdate((event) => {
                x.value = Math.min(width.value - INSET, Math.max(INSET, event.x));
                const stop = nearest(event.x);
                if (stop !== lastHover.value) {
                    lastHover.value = stop;
                    runOnJS(setHover)(stop);
                }
            })
            .onEnd((event) => settle(event.x))
            .onFinalize(() => {
                pressed.value = withTiming(0, { duration: 160 });
                lastHover.value = -1;
            });
        const tap = Gesture.Tap().enabled(!locked).onEnd((event, success) => {
            if (success) settle(event.x);
        });
        return Gesture.Exclusive(pan, tap);
    }, [count, locked, commit, stopX, width, x, pressed, lastHover]);

    const fillStyle = useAnimatedStyle(() => ({ width: Math.max(0, x.value - INSET) }));
    const knobStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: x.value - KNOB / 2 }, { scale: 1 + pressed.value * 0.12 }],
    }));

    const onLayout = (event: LayoutChangeEvent) => {
        const next = event.nativeEvent.layout.width;
        width.value = next;
        x.value = restX(next);
        setAreaWidth(next);
    };

    const focus = hover ?? index;
    const focusLevel: AIReasoningSetting = hover !== null ? stops[hover] : auto ? 'default' : shown;
    const valueLabel = lock ? LOCK_COPY[lock].label : levelMeta(focusLevel).label;
    const description = lock ? LOCK_COPY[lock].description
        : count < 2 ? '这个模型只有一个思考档位。'
            : auto && hover === null ? '还没指定档位，按模型默认思考。拖动或点选一档即可指定。'
                : levelMeta(focusLevel).description;

    const onAccessibilityAction = (event: AccessibilityActionEvent) => {
        if (locked) return;
        const step = event.nativeEvent.actionName === 'increment' ? 1 : event.nativeEvent.actionName === 'decrement' ? -1 : 0;
        // From "auto" the first step lands on the resting stop.
        const next = auto ? getAutoRestIndex(stops) : Math.min(count - 1, Math.max(0, index + step));
        if (stops[next] && stops[next] !== shown) onChange(stops[next]);
    };

    return (
        <View style={styles.root}>
            <View style={styles.head}>
                <Text style={styles.title}>思考强度</Text>
                <Text style={[styles.value, (locked || (auto && hover === null)) && styles.valueMuted]}>{valueLabel}</Text>
            </View>
            <View
                accessible
                accessibilityRole="adjustable"
                accessibilityLabel="思考强度"
                accessibilityValue={{ text: `${valueLabel}，${description}` }}
                accessibilityActions={locked ? [] : [{ name: 'increment' }, { name: 'decrement' }]}
                onAccessibilityAction={onAccessibilityAction}
            >
                <GestureDetector gesture={gesture}>
                    <View style={styles.area} onLayout={onLayout} collapsable={false}>
                        <View style={[styles.rail, locked && styles.railLocked]} />
                        {!locked || lock === 'always' ? (
                            <Animated.View style={[styles.fill, auto && styles.fillAuto, lock === 'always' && styles.fillAlways, fillStyle]} />
                        ) : null}
                        {!locked && areaWidth > 0 ? stops.map((stop, stopIndex) => {
                            const filled = !auto && stopIndex < focus;
                            return <View key={stop} pointerEvents="none" style={[styles.notch, filled ? styles.notchFilled : styles.notchEmpty,
                                { left: stopX(stopIndex, areaWidth) - 2 }]} />;
                        }) : null}
                        {!locked || lock === 'always' ? (
                            <Animated.View pointerEvents="none" style={[styles.knob, auto && styles.knobAuto, lock === 'always' && styles.knobLocked, knobStyle]}>
                                <View style={[styles.hole, auto && styles.holeAuto]} />
                            </Animated.View>
                        ) : null}
                    </View>
                </GestureDetector>
            </View>
            {!locked && areaWidth > 0 ? (
                <View style={styles.labels}>
                    {stops.map((stop, stopIndex) => {
                        const active = !auto && stopIndex === focus;
                        return (
                            <Pressable key={stop} accessibilityRole="button" accessibilityLabel={`思考强度 ${levelMeta(stop).label}`}
                                accessibilityState={{ selected: active }} hitSlop={6}
                                onPress={() => {
                                    if (stop === shown) return;
                                    x.value = withSpring(stopX(stopIndex, width.value), SNAP);
                                    onChange(stop);
                                }}
                                style={[styles.label, { left: stopX(stopIndex, areaWidth) - LABEL_WIDTH / 2 }]}>
                                <Text style={[styles.labelText, active && styles.labelTextActive]} numberOfLines={1}>{levelMeta(stop).label}</Text>
                            </Pressable>
                        );
                    })}
                </View>
            ) : null}
            <Text style={styles.description}>{description}</Text>
        </View>
    );
}

const makeStyles = (Colors: any) => StyleSheet.create({
    root: { gap: 4 },
    head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 2 },
    title: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text.heading },
    value: { fontSize: FontSize.md, fontWeight: '600', color: Colors.accent.gold },
    valueMuted: { color: Colors.text.secondary, fontWeight: '500' },
    area: { height: AREA_HEIGHT, justifyContent: 'center' },
    rail: {
        position: 'absolute', left: INSET, right: INSET, top: (AREA_HEIGHT - RAIL_HEIGHT) / 2, height: RAIL_HEIGHT,
        borderRadius: RAIL_HEIGHT / 2, backgroundColor: Colors.border.normal,
    },
    railLocked: { opacity: 0.45 },
    fill: {
        position: 'absolute', left: INSET, top: (AREA_HEIGHT - RAIL_HEIGHT) / 2, height: RAIL_HEIGHT,
        borderRadius: RAIL_HEIGHT / 2, backgroundColor: Colors.accent.gold,
    },
    fillAuto: { opacity: 0 },
    fillAlways: { opacity: 0.45 },
    notch: { position: 'absolute', top: AREA_HEIGHT / 2 - 2, width: 4, height: 4, borderRadius: 2 },
    notchFilled: { backgroundColor: Colors.bg.card, opacity: 0.7 },
    notchEmpty: { backgroundColor: Colors.text.tertiary, opacity: 0.55 },
    // A round coin with a square hole, after the coins used for casting.
    knob: {
        position: 'absolute', left: 0, top: (AREA_HEIGHT - KNOB) / 2, width: KNOB, height: KNOB, borderRadius: KNOB / 2,
        backgroundColor: Colors.accent.gold, alignItems: 'center', justifyContent: 'center',
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.28, shadowRadius: 4, elevation: 3,
    },
    knobAuto: { backgroundColor: Colors.bg.card, borderWidth: 2, borderColor: Colors.accent.gold, shadowOpacity: 0.12 },
    knobLocked: { opacity: 0.6, shadowOpacity: 0, elevation: 0 },
    hole: { width: HOLE, height: HOLE, borderRadius: 1.5, backgroundColor: Colors.bg.card },
    holeAuto: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: Colors.accent.gold },
    labels: { height: 20 },
    label: { position: 'absolute', top: 0, width: LABEL_WIDTH, alignItems: 'center' },
    labelText: { fontSize: FontSize.xs, color: Colors.text.tertiary },
    labelTextActive: { color: Colors.accent.gold, fontWeight: '600' },
    description: { marginTop: 6, fontSize: FontSize.xs, lineHeight: 18, color: Colors.text.secondary },
});
