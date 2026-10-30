import React, { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import Animated, { cancelAnimation, css, runOnJS, SensorType, useAnimatedReaction, useAnimatedSensor, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';
import PressableScale from '../../components/PressableScale';
import { ringLevel } from '../../components/YunZhuanBanners';
import { useTheme } from '../../theme/ThemeContext';
import StarDial from './StarDial';
import { ENTRY_THEMES, HOME_ENTRIES, type EntryTheme, type HomeEntry, type HomeEntryId } from './entries';

const STORAGE_KEY = 'home_entry_open';
const COUNT = HOME_ENTRIES.length;
const SERIF = Platform.select({ ios: 'Songti SC', android: 'serif', web: "'Songti SC', SimSun, serif", default: 'serif' });

// 四卡转台：正面 1、两侧 0.72、背面 0.44，保持参考效果的近大远小。
const DEPTH = 0.28;
const CORNER = 40;
const LIFT = 16;
const FLOAT = 14;
const SWAY = 1.4;
const TILT = [3.8, -1.4, 2.6, -4.2];
const BOB_MS = [5300, 7100, 4700, 5900];
const STAGE_TOP = LIFT * 2 + FLOAT + 6;
const SPRING = { damping: 19, stiffness: 210, mass: 1 };
// 按住/悬停：手指那一角往里按、整张后退；手指处压暗、对角淡白。bencho 源码 sink=35 的数值（sink 100 时为 13°、0.5、0.16、10px）
const LEAN = 4.55;       // 每轴最大角度
const SHADE = 0.175;
const LIGHT = 0.056;
const RECEDE = 0.0046;   // translateZ(-3.5px) 在 perspective 760 下约缩 0.46%
const HOVER = { stiffness: 415, damping: 19.7, mass: 1 }; // bencho 每帧 k 0.16、d 0.72 的弹簧换算
const HOLD_MS = 150;     // 按住不动这么久才接管手指，否则交给转盘拖动
const GYRO = 8;          // 手机倾斜到头约 8°，与原先一样
const TILT_RANGE = 0.35; // 手机偏离平时拿法约 20°，卡面翘到头
// 明暗按高斯式曲线淡出：纯色卡面上看不出 bencho 线性渐变那一圈边
const FALLOFF = [[0, 1], [0.12, 0.94], [0.25, 0.8], [0.38, 0.6], [0.5, 0.42], [0.62, 0.26], [0.75, 0.13], [0.88, 0.04], [1, 0]] as const;

function leanDepth(x: number, y: number) {
    'worklet';
    return Math.min(1, Math.sqrt(x * x + y * y) / Math.SQRT2);
}

function clampUnit(value: number) {
    'worklet';
    return Math.max(-1, Math.min(1, value));
}

// 手机倾斜只作用在正面那张：转到侧面时按 cos⁴ 退掉
function frontWeight(rotation: number, index: number) {
    'worklet';
    let off = (((index - rotation) % COUNT) + COUNT) % COUNT;
    if (off >= COUNT / 2) off -= COUNT;
    return Math.pow(Math.max(0, Math.cos(off * Math.PI * 2 / COUNT)), 4);
}

// 这张卡前面还有几张（越靠前越小）：只在两张卡交换前后时才变
function cardsAhead(rotation: number, index: number) {
    'worklet';
    const depthOf = (k: number) => {
        let off = (((k - rotation) % COUNT) + COUNT) % COUNT;
        if (off >= COUNT / 2) off -= COUNT;
        return Math.cos(off * Math.PI * 2 / COUNT);
    };
    const depth = depthOf(index);
    let ahead = 0;
    for (let k = 0; k < COUNT; k++) if (k !== index && depthOf(k) > depth) ahead++;
    return ahead;
}

// 明暗的位置：指针/手指（-1–1）叠上手机倾斜。倾斜取反，压暗落在翘起的对角，与原先一致
function leanPoint(pointer: number, tilt: number, weight: number) {
    'worklet';
    return clampUnit(pointer - tilt * weight);
}

// 卡面里的静态层都 memo 住：换选中时只重渲染文字，不重画 SVG 与图片
const EntryArt = memo(function EntryArt({ entry, size }: { entry: HomeEntry; size: number }) {
    const { theme } = useTheme();
    return (
        <View style={{ width: size, height: size }} pointerEvents="none" aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Image source={entry.image} style={{ width: size, height: size, tintColor: theme === 'yang' ? '#3C2F25' : '#E8D4AB' }} resizeMode="contain" fadeDuration={0} accessibilityIgnoresInvertColors />
        </View>
    );
});

// 纸纹：亮点、暗点两张平铺图各按主题染色，压在线稿上、文字下。贴图由 scripts/build-card-grain.py 生成
const GRAIN = { light: require('../../../assets/home/grain-light.webp'), dark: require('../../../assets/home/grain-dark.webp') };
const CardGrain = memo(function CardGrain({ grain }: { grain: EntryTheme['grain'] }) {
    return (
        <View style={deckStyles.fill} pointerEvents="none" aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Image source={GRAIN.light} resizeMode="repeat" fadeDuration={0} style={[deckStyles.tile, { tintColor: grain.light, opacity: grain.lightOpacity }]} />
            <Image source={GRAIN.dark} resizeMode="repeat" fadeDuration={0} style={[deckStyles.tile, { tintColor: grain.dark, opacity: grain.darkOpacity }]} />
        </View>
    );
});

const Glow = memo(function Glow({ id, color }: { id: string; color: string }) {
    return (
        <Svg width="100%" height="100%">
            <Defs>
                <RadialGradient id={id} cx="50%" cy="50%" rx="50%" ry="50%">
                    {FALLOFF.map(([offset, opacity]) => <Stop key={offset} offset={offset} stopColor={color} stopOpacity={opacity} />)}
                </RadialGradient>
            </Defs>
            <Rect width="100%" height="100%" fill={`url(#${id})`} />
        </Svg>
    );
});

// 卡面底：自上而下三色斜向渐变，右上一团淡光（同画布实物卡）
const CardGround = memo(function CardGround({ id, gradient }: { id: string; gradient: EntryTheme['gradients'][HomeEntryId] }) {
    return (
        <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', top: 0, left: 0 }}>
            <Defs>
                <LinearGradient id={`${id}-fill`} x1="37%" y1="0%" x2="63%" y2="100%">
                    <Stop offset="0" stopColor={gradient.top} />
                    <Stop offset="0.52" stopColor={gradient.middle} />
                    <Stop offset="1" stopColor={gradient.bottom} />
                </LinearGradient>
                <RadialGradient id={`${id}-glow`} cx="70%" cy="28%" rx="74%" ry="50%">
                    <Stop offset="0" stopColor={gradient.glow} stopOpacity={0.22} />
                    <Stop offset="1" stopColor={gradient.glow} stopOpacity={0} />
                </RadialGradient>
            </Defs>
            <Rect width="100" height="100" fill={`url(#${id}-fill)`} />
            <Rect width="100" height="100" fill={`url(#${id}-glow)`} />
        </Svg>
    );
});

// 手机倾斜 → 正面卡跟着翘、对角压暗。传感器在 UI 线程读写，不经过 JS
function TiltSensor({ tiltX, tiltY }: { tiltX: SharedValue<number>; tiltY: SharedValue<number> }) {
    const { sensor } = useAnimatedSensor(SensorType.ROTATION, { interval: 16 });
    const basePitch = useSharedValue(0);
    const baseRoll = useSharedValue(0);
    const ready = useSharedValue(false);

    useAnimatedReaction(() => sensor.value, ({ qw, qx, qy, qz, pitch, roll }) => {
        // 第一帧前传感器全是 0，不是有效姿态
        if (qw * qw + qx * qx + qy * qy + qz * qz < 0.5) return;
        if (!ready.value) {
            basePitch.value = pitch;
            baseRoll.value = roll;
            ready.value = true;
        }
        // 平时拿手机的角度算作「平」：基线约 3 秒跟上，只有晃动的那部分让卡翘起
        basePitch.value += (pitch - basePitch.value) * 0.006;
        baseRoll.value += (roll - baseRoll.value) * 0.006;
        const x = Math.max(-1, Math.min(1, (roll - baseRoll.value) / TILT_RANGE));
        const y = Math.max(-1, Math.min(1, (pitch - basePitch.value) / TILT_RANGE));
        // 静止时传感器有细抖：变化小于死区就不写，免得四张卡的三套样式每帧都重算。
        // 0.005 约合卡面 0.04°，看不出来，但拿稳手机时基本不再触发
        const nextX = tiltX.value + (x - tiltX.value) * 0.3;
        const nextY = tiltY.value + (y - tiltY.value) * 0.3;
        if (Math.abs(nextX - tiltX.value) > 0.005) tiltX.value = nextX;
        if (Math.abs(nextY - tiltY.value) > 0.005) tiltY.value = nextY;
    });

    useEffect(() => () => {
        tiltX.value = withTiming(0, { duration: 220 });
        tiltY.value = withTiming(0, { duration: 220 });
    }, [tiltX, tiltY]);

    return null;
}

const EntryCard = memo(function EntryCard({ entry, index, selected, rotation, tiltX, tiltY, dragged, width, height, spread, artSize, colors, description, meta, onSelect, reduceMotion, fontScale }: {
    entry: HomeEntry;
    index: number;
    selected: boolean;
    rotation: SharedValue<number>;
    tiltX: SharedValue<number>;
    tiltY: SharedValue<number>;
    dragged: React.RefObject<boolean>;
    width: number;
    height: number;
    spread: number;
    artSize: number;
    colors: EntryTheme;
    description: React.ReactNode;
    meta: string;
    onSelect: (index: number) => void;
    reduceMotion: boolean;
    fontScale: number;
}) {
    const styles = useMemo(() => makeStyles(colors, entry.id), [colors, entry.id]);
    const glowId = useId().replace(/[^\w-]/g, '');
    const pointX = useSharedValue(0);
    const pointY = useSharedValue(0);
    const press = useSharedValue(0);
    const hovering = useRef(false);
    const tilt = TILT[index % TILT.length];
    // 浮动单独一层，交给 C++ 驱动的 CSS 动画：原来写在 slotMotion 里，四张卡静止时也每帧在 JS 里重算整套位移。
    // 负半个周期的延迟让它从正中起步，暂停（离开首页、减弱动态效果）时也停在正中
    const float = useMemo(() => {
        const duration = BOB_MS[index % BOB_MS.length] / 2;
        return {
            animationName: css.keyframes({
                from: { transform: [{ translateY: -FLOAT }, { rotate: `${tilt - SWAY}deg` }] },
                to: { transform: [{ translateY: FLOAT }, { rotate: `${tilt + SWAY}deg` }] },
            }),
            animationDuration: duration,
            animationDelay: -duration / 2,
            animationDirection: 'alternate',
            animationIterationCount: 'infinite',
            animationTimingFunction: 'ease-in-out',
        } as const;
    }, [index, tilt]);

    // x、y 是指针在卡面上的位置（-1–1），on 为 0 时回正
    const lean = (x: number, y: number, on: number) => {
        'worklet';
        pointX.value = withSpring(clampUnit(x) * on, HOVER);
        pointY.value = withSpring(clampUnit(y) * on, HOVER);
        press.value = withSpring(on, HOVER);
    };
    const hover = (x: number, y: number, on: boolean) => {
        if (!on && !hovering.current) return;
        hovering.current = on;
        lean(x, y, on ? 1 : 0);
    };
    // 手机没有悬停：按住不动 150ms 后由这里接管手指，转盘和页面滚动都让开，手指滑到哪哪一角往里按。
    // 不覆盖底部按钮，免得慢点按钮被长按吃掉
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const hold = useMemo(() => Gesture.Pan()
        .activateAfterLongPress(HOLD_MS)
        .enabled(!reduceMotion)
        .onStart(event => lean(event.x / width * 2 - 1, event.y / height * 2 - 1, 1))
        .onUpdate(event => lean(event.x / width * 2 - 1, event.y / height * 2 - 1, 1))
        .onEnd(event => {
            lean(0, 0, 0);
            // 长按接管后侧卡的 onPress 不再触发：没怎么动就当作点了一下
            if (!selected && event.translationX * event.translationX + event.translationY * event.translationY < 100) runOnJS(onSelect)(index);
        }), [reduceMotion, width, height, selected, index, onSelect]);

    // 层级不放进动画样式：zIndex 混在里面，Reanimated 每帧都得走整棵树提交（原生同步开关也绕不过），
    // 转卡掉到十几帧。名次交换时才由 React 改一次
    const [ahead, setAhead] = useState(0);
    useAnimatedReaction(() => cardsAhead(rotation.value, index), (now, prev) => {
        if (now !== prev) runOnJS(setAhead)(now);
    });

    const slotMotion = useAnimatedStyle(() => {
        let off = (((index - rotation.value) % COUNT) + COUNT) % COUNT;
        if (off >= COUNT / 2) off -= COUNT;
        const angle = off * Math.PI * 2 / COUNT;
        const depth = Math.cos(angle);
        return {
            transform: [
                { translateX: Math.sin(angle) * spread },
                { translateY: -(1 - depth) * LIFT },
                { scale: 1 - (1 - depth) * DEPTH },
            ],
        };
    });
    // 指针所在那一角往里按、整张往后退（rotateX/rotateY 与 CSS 同向）；手机倾斜另算角度
    const cardMotion = useAnimatedStyle(() => {
        const w = frontWeight(rotation.value, index);
        return {
            transform: [
                { perspective: 760 },
                { scale: 1 - RECEDE * press.value },
                { rotateX: `${-pointY.value * LEAN + tiltY.value * w * GYRO}deg` },
                { rotateY: `${pointX.value * LEAN - tiltX.value * w * GYRO}deg` },
            ],
        };
    });
    // 指针处压一层与卡面同色系的深色、对角一层淡白，没有扫光；手机倾斜时浓淡跟着倾斜幅度走
    const shadeMotion = useAnimatedStyle(() => {
        const w = frontWeight(rotation.value, index);
        const x = leanPoint(pointX.value, tiltX.value, w);
        const y = leanPoint(pointY.value, tiltY.value, w);
        return {
            opacity: SHADE * Math.max(press.value, w * leanDepth(tiltX.value, tiltY.value)),
            transform: [{ translateX: (x + 1) / 2 * width - width * 0.7 }, { translateY: (y + 1) / 2 * height - height * 0.56 }],
        };
    });
    const lightMotion = useAnimatedStyle(() => {
        const w = frontWeight(rotation.value, index);
        const x = leanPoint(pointX.value, tiltX.value, w);
        const y = leanPoint(pointY.value, tiltY.value, w);
        return {
            opacity: LIGHT * Math.max(press.value, w * leanDepth(tiltX.value, tiltY.value)),
            transform: [{ translateX: (1 - x) / 2 * width - width * 0.8 }, { translateY: (1 - y) / 2 * height - height * 0.64 }],
        };
    });
    const button = colors.buttons[entry.id];

    return (
        <Animated.View
            style={[styles.slot, { width, height, marginLeft: -width / 2, zIndex: 100 - ahead }, slotMotion]}
            testID={`home-entry-${entry.id}`}
            aria-hidden={!selected}
            accessibilityElementsHidden={!selected}
            importantForAccessibility={selected ? 'auto' : 'no-hide-descendants'}
        >
            <Animated.View style={[styles.float, float, { animationPlayState: reduceMotion ? 'paused' : 'running' }]}>
                <Animated.View style={[styles.card, cardMotion]}>
                    <View pointerEvents="none" style={[styles.shadow, { boxShadow: colors.shadow }]} />
                    <View
                        style={styles.clip}
                        // 网页鼠标悬停；拖动转盘时回正
                        onPointerMove={event => {
                            if (event.nativeEvent.pointerType !== 'mouse') return;
                            const rect = (event.currentTarget as unknown as { getBoundingClientRect?: () => { left: number; top: number; width: number; height: number } }).getBoundingClientRect?.();
                            if (dragged.current || reduceMotion || !rect) {
                                hover(0, 0, false);
                                return;
                            }
                            hover((event.nativeEvent.clientX - rect.left) / rect.width * 2 - 1, (event.nativeEvent.clientY - rect.top) / rect.height * 2 - 1, true);
                        }}
                        onPointerLeave={event => { if (event.nativeEvent.pointerType === 'mouse') hover(0, 0, false); }}
                    >
                        <CardGround id={`${glowId}-ground`} gradient={colors.gradients[entry.id]} />
                        <GestureDetector gesture={hold}>
                            <Pressable
                                onPress={() => { if (!dragged.current) onSelect(index); }}
                                style={styles.fill}
                                accessible={false}
                                focusable={false}
                                tabIndex={-1}
                            >
                                <View style={[styles.art, { top: 74 * fontScale }]} pointerEvents="none">
                                    <EntryArt entry={entry} size={artSize} />
                                </View>
                                <CardGrain grain={colors.grain} />
                                <View style={styles.cardHead} pointerEvents="none">
                                    <Text style={styles.title} accessibilityRole="header" aria-level={2}>{entry.title}</Text>
                                    <Text style={styles.subtitle}>{entry.subtitle}</Text>
                                </View>
                                <View style={styles.details} pointerEvents="none">
                                    <Text style={styles.description} numberOfLines={2}>{description}</Text>
                                    <Text style={styles.meta} numberOfLines={2}>{meta}</Text>
                                </View>
                            </Pressable>
                        </GestureDetector>
                        <View style={styles.actionRow} pointerEvents={selected ? 'auto' : 'none'}>
                            {entry.actions.map(({ label, accessibilityLabel, route, Icon }, actionIndex) => (
                                <PressableScale
                                    key={label}
                                    onPress={() => { if (!dragged.current) router.push(route); }}
                                    style={[styles.action, actionIndex === 0 && styles.primary]}
                                    accessibilityRole="button"
                                    accessibilityLabel={accessibilityLabel}
                                    focusable={selected}
                                    tabIndex={selected ? 0 : -1}
                                >
                                    <Icon size={16} color={actionIndex === 0 ? button.ink : button.tint} />
                                    <Text style={[styles.actionText, actionIndex === 0 && styles.primaryText]}>{label}</Text>
                                </PressableScale>
                            ))}
                        </View>
                        <Animated.View pointerEvents="none" style={[styles.glow, { width: width * 1.4, height: height * 1.12 }, shadeMotion]}>
                            <Glow id={`${glowId}-shade`} color={colors.shade} />
                        </Animated.View>
                        <Animated.View pointerEvents="none" style={[styles.glow, { width: width * 1.6, height: height * 1.28 }, lightMotion]}>
                            <Glow id={`${glowId}-light`} color="#ffffff" />
                        </Animated.View>
                    </View>
                </Animated.View>
            </Animated.View>
        </Animated.View>
    );
});

export default function EntryDeck({ liuyaoMeta, meihuaDescription, meihuaMeta }: {
    liuyaoMeta: string;
    meihuaDescription: React.ReactNode;
    meihuaMeta: string;
}) {
    const { theme } = useTheme();
    const colors = ENTRY_THEMES[theme];
    const { width, fontScale } = useWindowDimensions();
    const reduceMotion = useReducedMotion();
    const [deckWidth, setDeckWidth] = useState(Math.min(620, width - 32));
    const [open, setOpen] = useState<HomeEntryId>('liuyao');
    const [focused, setFocused] = useState(false);
    const hasSelected = useRef(false);
    const rotation = useSharedValue(0);
    const dragFrom = useSharedValue(0);
    const tiltX = useSharedValue(0);
    const tiltY = useSharedValue(0);
    const dragged = useRef(false);
    const cardWidth = Math.min(284, deckWidth * (fontScale > 1.3 ? 0.8 : 0.68));
    const cardHeight = Math.ceil(366 + Math.max(0, fontScale - 1) * 220);
    const spread = Math.round(Math.min(cardWidth * 0.69, deckWidth * 0.28));
    const artSize = Math.min(fontScale > 1.3 ? 120 : 164, Math.round(cardWidth * 0.58));
    const unit = cardWidth * 0.8;
    const openIndex = HOME_ENTRIES.findIndex(entry => entry.id === open);

    useEffect(() => {
        let cancelled = false;
        AsyncStorage.getItem(STORAGE_KEY).then(saved => {
            const entry = HOME_ENTRIES.find(item => item.id === saved);
            if (!cancelled && !hasSelected.current && entry) {
                setOpen(entry.id);
                rotation.value = HOME_ENTRIES.indexOf(entry);
            }
        }).catch(() => undefined);
        return () => { cancelled = true; };
    }, [rotation]);

    // 只在首页聚焦时读手机倾斜
    useFocusEffect(useCallback(() => {
        setFocused(true);
        return () => setFocused(false);
    }, []));

    // 离开首页时轮盘可能还亮着，别让其他页的经幡一直退暗
    useEffect(() => () => {
        cancelAnimation(ringLevel);
        ringLevel.value = 0;
    }, []);

    const commit = useCallback((target: number) => {
        const id = HOME_ENTRIES[((target % COUNT) + COUNT) % COUNT].id;
        hasSelected.current = true;
        setOpen(id);
        AsyncStorage.setItem(STORAGE_KEY, id).catch(() => undefined);
    }, []);
    const markDragged = useCallback(() => {
        dragged.current = true;
        hasSelected.current = true;
    }, []);
    // 浏览器拖动后仍会派发 click；下一次按下前不触发卡面和入口按钮
    const clearDragged = useCallback(() => { dragged.current = false; }, []);

    const settle = useCallback((target: number) => {
        if (reduceMotion) {
            rotation.value = target;
            commit(target);
            return;
        }
        cancelAnimation(ringLevel);
        ringLevel.value = withTiming(1, { duration: 160 });
        // 落定后才更新选中（重渲染放在动画之后，转动时 JS 不干活）；约半秒后轮盘淡出
        rotation.value = withSpring(target, SPRING, finished => {
            if (!finished) return;
            ringLevel.value = withDelay(450, withTiming(0, { duration: 700 }));
            runOnJS(commit)(target);
        });
    }, [commit, reduceMotion, rotation]);

    const select = useCallback((index: number) => {
        const current = Math.round(rotation.value);
        const delta = ((index - current) % COUNT + COUNT) % COUNT;
        // 点的就是正面那张：不用转，也别让星盘闪一下
        if (!delta && rotation.value === current) return;
        settle(current + (delta > COUNT / 2 ? delta - COUNT : delta));
    }, [rotation, settle]);

    // 拖动在 UI 线程跑，不等 JS；松手把手指速度接进弹簧，不会在松手那一下顿住
    const pan = useMemo(() => Gesture.Pan()
        .activeOffsetX([-8, 8])
        .failOffsetY([-12, 12])
        .onTouchesDown(() => {
            runOnJS(clearDragged)();
        })
        .onStart(() => {
            cancelAnimation(rotation);
            dragFrom.value = rotation.value;
            runOnJS(markDragged)();
            if (!reduceMotion) {
                cancelAnimation(ringLevel);
                ringLevel.value = withTiming(1, { duration: 160 });
            }
        })
        .onUpdate(event => {
            if (!reduceMotion) rotation.value = dragFrom.value - event.translationX / unit;
        })
        .onEnd((event, success) => {
            const from = success ? dragFrom.value - event.translationX / unit : dragFrom.value;
            const velocity = success ? -event.velocityX / unit : 0;
            const target = Math.round(from + Math.max(-0.5, Math.min(0.5, velocity * 0.04)));
            if (reduceMotion) {
                rotation.value = target;
                runOnJS(commit)(target);
                return;
            }
            rotation.value = withSpring(target, { ...SPRING, velocity }, finished => {
                if (!finished) return;
                ringLevel.value = withDelay(450, withTiming(0, { duration: 700 }));
                runOnJS(commit)(target);
            });
        }), [rotation, dragFrom, unit, reduceMotion, clearDragged, markDragged, commit]);

    return (
        <View style={deckStyles.deck} testID="home-entry-deck" onLayout={event => setDeckWidth(event.nativeEvent.layout.width)}>
            {focused && !reduceMotion && Platform.OS !== 'web' ? <TiltSensor tiltX={tiltX} tiltY={tiltY} /> : null}
            <GestureDetector gesture={pan}>
                <View style={[deckStyles.stage, { height: STAGE_TOP + cardHeight + FLOAT + 24 }]}>
                    {reduceMotion ? null : <StarDial rotation={rotation} centerY={STAGE_TOP + cardHeight * 0.75} color={colors.dial} peak={colors.dialPeak} />}
                    {HOME_ENTRIES.map((entry, index) => (
                        <EntryCard
                            key={entry.id}
                            entry={entry}
                            index={index}
                            selected={entry.id === open}
                            rotation={rotation}
                            tiltX={tiltX}
                            tiltY={tiltY}
                            dragged={dragged}
                            width={cardWidth}
                            height={cardHeight}
                            spread={spread}
                            artSize={artSize}
                            colors={colors}
                            description={entry.id === 'meihua' ? meihuaDescription : entry.description}
                            meta={entry.id === 'liuyao' ? liuyaoMeta : entry.id === 'meihua' ? meihuaMeta : entry.meta}
                            onSelect={select}
                            reduceMotion={reduceMotion || !focused}
                            fontScale={fontScale}
                        />
                    ))}
                </View>
            </GestureDetector>
            {/* 页签去掉后，读屏用户靠这个上下滑切卡 */}
            <View
                style={deckStyles.srOnly}
                accessible
                accessibilityRole="adjustable"
                accessibilityLabel="选择术数"
                accessibilityValue={{ text: HOME_ENTRIES[openIndex].title }}
                accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
                onAccessibilityAction={event => select((openIndex + (event.nativeEvent.actionName === 'increment' ? 1 : -1) + COUNT) % COUNT)}
            />
        </View>
    );
}

const deckStyles = StyleSheet.create({
    deck: { width: '100%', maxWidth: 620, alignSelf: 'center' },
    stage: { overflow: 'visible', ...Platform.select({ web: { touchAction: 'pan-y' as const } }) },
    srOnly: { position: 'absolute', left: 0, top: 0, width: 1, height: 1, opacity: 0 },
    fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
    // Image 会拿资源尺寸当默认宽高，盖过四边贴齐，得写明铺满
    tile: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
});

function makeStyles(colors: EntryTheme, entryId: HomeEntryId) {
    const button = colors.buttons[entryId];
    return StyleSheet.create({
        slot: { position: 'absolute', left: '50%', top: STAGE_TOP },
        shadow: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: CORNER },
        float: { width: '100%', height: '100%' },
        card: { width: '100%', height: '100%', borderRadius: CORNER, backgroundColor: colors.gradients[entryId].middle },
        clip: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, overflow: 'hidden', borderRadius: CORNER },
        fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
        glow: { position: 'absolute', left: 0, top: 0 },
        cardHead: { position: 'absolute', left: 18, right: 18, top: 20 },
        title: { fontFamily: SERIF, fontSize: 26, lineHeight: 34, fontWeight: '600', color: colors.ink, textAlign: 'center' },
        subtitle: { marginTop: 2, fontSize: 12, lineHeight: 18, color: colors.muted, textAlign: 'center' },
        art: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
        details: { position: 'absolute', left: 18, right: 18, bottom: 82, gap: 4 },
        description: { fontSize: 14, lineHeight: 20, color: colors.ink, textAlign: 'center' },
        meta: { fontSize: 12, lineHeight: 18, color: colors.muted, textAlign: 'center' },
        actionRow: { position: 'absolute', left: 18, right: 18, bottom: 18, flexDirection: 'row', alignItems: 'center', gap: 6 },
        action: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 10, minHeight: 44, borderRadius: 22, backgroundColor: 'transparent', overflow: 'hidden' },
        primary: { backgroundColor: button.fill, borderColor: button.border },
        actionText: { fontSize: 14, lineHeight: 20, fontWeight: '500', color: button.tint },
        primaryText: { color: button.ink, fontWeight: '600' },
    });
}
