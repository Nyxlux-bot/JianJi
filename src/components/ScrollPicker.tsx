import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { View, StyleSheet, Animated, NativeSyntheticEvent, NativeScrollEvent, Platform, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontSize, BorderRadius } from '../theme/colors';
import { useTheme } from "../theme/ThemeContext";

interface ScrollPickerProps {
    data: string[];
    value: string;
    onValueChange: (val: string) => void;
    itemHeight?: number;
    visibleItems?: number;
    activeTextColor?: string;
    inactiveTextColor?: string;
    Colors?: any;
    /** 上下渐隐要融进的底色，默认是弹层底色 bg.primary */
    fadeColor?: string;
    /** 按文字长度自动缩字号，适合省市区等长名称滚轮（全平台生效） */
    adaptiveFontSize?: boolean;
    /** 选中项缩放倍数，默认 1.15；长名称滚轮建议传 1.04 避免放大裁剪 */
    activeScale?: number;
}

function getAdaptiveFontSize(label: string): number {
    const length = Array.from(label).length;
    if (length <= 4) return 15;
    if (length === 5) return 14;
    if (length === 6) return 13;
    if (length === 7) return 12;
    if (length === 8) return 11.5;
    return 11;
}

export default function ScrollPicker({
    data,
    value,
    onValueChange,
    itemHeight = 44,
    visibleItems = 5,
    activeTextColor,
    Colors: PropColors,
    fadeColor,
    adaptiveFontSize = false,
    activeScale,
}: ScrollPickerProps) {
    const { Colors: ContextColors } = useTheme();
    const Colors = PropColors || ContextColors;
    const styles = useMemo(() => makeStyles(Colors), [Colors]);
    const fadeBase: string = fadeColor ?? Colors.bg.primary;
    // 8 位十六进制的全透明同色，渐隐时不会透出灰边
    const fadeClear = /^#[0-9a-f]{6}$/i.test(fadeBase) ? `${fadeBase}00` : 'transparent';

    const resolvedActiveTextColor = activeTextColor || Colors.text.primary;
    const resolvedActiveScale = activeScale ?? (adaptiveFontSize ? 1.04 : 1.15);
    const resolvedInactiveScale = adaptiveFontSize ? 0.92 : 0.85;
    // 保证放大后宽度 (width * activeScale) <= 98%，避免左右边缘被 overflow 裁切
    const textBoxWidth = `${Math.min(96, Math.floor(98 / Math.max(1, resolvedActiveScale)))}%` as `${number}%`;

    // 定位初始值
    const initialIndex = useMemo(() => {
        const idx = data.indexOf(value);
        return idx !== -1 ? idx : 0;
        // 仅用于初始化首帧位置
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const scrollY = useRef(new Animated.Value(initialIndex * itemHeight)).current;
    const scrollViewRef = useRef<any>(null);

    const [selectedIndex, setSelectedIndex] = useState(initialIndex);
    const isProgrammaticScroll = useRef(false);
    const programmaticTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const webScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const prevDataRef = useRef(data);

    // 供 Web 滚轮回调读取最新值，避免闭包过期
    const dataRef = useRef(data);
    const valueRef = useRef(value);
    const selectedIndexRef = useRef(selectedIndex);
    const onValueChangeRef = useRef(onValueChange);
    dataRef.current = data;
    valueRef.current = value;
    selectedIndexRef.current = selectedIndex;
    onValueChangeRef.current = onValueChange;

    const halfVisible = Math.floor(visibleItems / 2);
    // 用空字符串填补上下空间
    const paddedData = useMemo(() => {
        const spacer = Array(halfVisible).fill('');
        return [...spacer, ...data, ...spacer];
    }, [data, halfVisible]);

    const scrollToIndex = useCallback((index: number, animated: boolean) => {
        const targetY = index * itemHeight;
        isProgrammaticScroll.current = true;
        if (programmaticTimerRef.current) {
            clearTimeout(programmaticTimerRef.current);
        }
        if (webScrollTimerRef.current) {
            clearTimeout(webScrollTimerRef.current);
            webScrollTimerRef.current = null;
        }
        if (!animated) {
            scrollY.setValue(targetY);
        }
        const node = scrollViewRef.current;
        if (node) {
            if (typeof node.scrollTo === 'function') {
                node.scrollTo({ y: targetY, animated });
            } else if (typeof node.getNode === 'function') {
                node.getNode().scrollTo({ y: targetY, animated });
            }
        }
        programmaticTimerRef.current = setTimeout(() => {
            isProgrammaticScroll.current = false;
            programmaticTimerRef.current = null;
        }, animated ? 340 : 60);
    }, [itemHeight, scrollY]);

    // 卸载时清理定时器
    useEffect(() => {
        return () => {
            if (programmaticTimerRef.current) clearTimeout(programmaticTimerRef.current);
            if (webScrollTimerRef.current) clearTimeout(webScrollTimerRef.current);
        };
    }, []);

    // 首帧挂载时无动画定位到初始值
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        const timer = setTimeout(() => {
            const index = dataRef.current.indexOf(valueRef.current);
            scrollToIndex(index !== -1 ? index : 0, false);
        }, 0);
        return () => clearTimeout(timer);
    }, [itemHeight, scrollToIndex]);

    // 值或候选项列表从外部改变时，同步到对应位置
    useEffect(() => {
        const dataChanged = prevDataRef.current !== data;
        prevDataRef.current = data;
        const index = data.indexOf(value);
        const safeIndex = index !== -1 ? index : 0;

        if (dataChanged) {
            setSelectedIndex(safeIndex);
            const timer = setTimeout(() => {
                scrollToIndex(safeIndex, false);
            }, 0);
            return () => clearTimeout(timer);
        }

        if (index !== -1 && index !== selectedIndex) {
            setSelectedIndex(index);
            scrollToIndex(index, true);
        }
    }, [value, data, selectedIndex, scrollToIndex]);

    const commitOffset = useCallback((offsetY: number, snapOnWeb: boolean) => {
        const currentData = dataRef.current;
        if (currentData.length === 0) return;

        let index = Math.round(offsetY / itemHeight);
        if (index < 0) index = 0;
        if (index >= currentData.length) index = currentData.length - 1;

        if (snapOnWeb && Math.abs(offsetY - index * itemHeight) > 0.5) {
            scrollToIndex(index, true);
        }

        if (index !== selectedIndexRef.current) {
            setSelectedIndex(index);
        }
        const nextVal = currentData[index];
        if (nextVal !== undefined && nextVal !== valueRef.current) {
            onValueChangeRef.current(nextVal);
        }
    }, [itemHeight, scrollToIndex]);

    const handleMomentumScrollEnd = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
        if (isProgrammaticScroll.current) {
            isProgrammaticScroll.current = false;
            return;
        }
        commitOffset(event.nativeEvent.contentOffset.y, false);
    }, [commitOffset]);

    // Web 端鼠标滚轮 / 触控板滚动不会触发 onMomentumScrollEnd / onScrollEndDrag，
    // 通过 onScroll 防抖吸附并提交选中项，保证下级列与预览卡片同步更新
    const handleWebScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
        if (isProgrammaticScroll.current) {
            return;
        }
        const offsetY = event.nativeEvent.contentOffset.y;
        if (webScrollTimerRef.current) {
            clearTimeout(webScrollTimerRef.current);
        }
        webScrollTimerRef.current = setTimeout(() => {
            webScrollTimerRef.current = null;
            commitOffset(offsetY, true);
        }, 140);
    }, [commitOffset]);

    const handleScroll = useMemo(
        () => Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            {
                useNativeDriver: Platform.OS !== 'web',
                listener: Platform.OS === 'web' ? handleWebScroll : undefined,
            }
        ),
        [scrollY, handleWebScroll]
    );

    return (
        <View style={{ height: itemHeight * visibleItems, overflow: 'hidden', flex: 1 }}>
            {/* 中间高亮区域(物理背景) */}
            <View
                style={[
                    styles.highlight,
                    { height: itemHeight, top: halfVisible * itemHeight }
                ]}
                pointerEvents="none"
            />
            {/* 60FPS 的原生事件映射 */}
            <Animated.ScrollView
                ref={scrollViewRef}
                showsVerticalScrollIndicator={false}
                snapToInterval={itemHeight}
                decelerationRate="fast"
                onScroll={handleScroll}
                onMomentumScrollEnd={handleMomentumScrollEnd}
                // 甩动松手后还有惯性，等 onMomentumScrollEnd 再提交；这里只管没有惯性的松手
                onScrollEndDrag={(event) => { if (Math.abs(event.nativeEvent.velocity?.y ?? 0) < 0.01) handleMomentumScrollEnd(event); }}
                scrollEventThrottle={16} // 16ms 保证 60fps 的频率推送给动画引擎
                contentContainerStyle={{ paddingVertical: 0 }}
            >
                {paddedData.map((item, index) => {
                    // 该项目真实代表的数据索引（排除掉顶部 spacer）
                    const dataIndex = index - halfVisible;

                    // 定义这个项目的绝对物理位置 Y 的中心
                    const itemCenterY = dataIndex * itemHeight;

                    // 计算 Y 的可偏移范围
                    const inputRange = [
                        itemCenterY - itemHeight,
                        itemCenterY,
                        itemCenterY + itemHeight
                    ];

                    const scale = scrollY.interpolate({
                        inputRange,
                        outputRange: [resolvedInactiveScale, resolvedActiveScale, resolvedInactiveScale],
                        extrapolate: 'clamp'
                    });

                    const opacity = scrollY.interpolate({
                        inputRange,
                        outputRange: [0.4, 1, 0.4],
                        extrapolate: 'clamp'
                    });

                    if (item === '') {
                        return <View key={`spacer-${index}`} style={{ height: itemHeight }} />;
                    }

                    const resolvedFontSize = adaptiveFontSize ? getAdaptiveFontSize(item) : FontSize.lg;

                    // 点选上下的项直接跳过去：只提交值，滚动交给「外部改值」那个 Effect
                    return (
                        <Pressable
                            key={`${item}-${index}`}
                            accessibilityRole="button"
                            accessibilityLabel={item}
                            accessibilityState={{ selected: dataIndex === selectedIndex }}
                            onPress={() => {
                                if (data[dataIndex] !== value) {
                                    onValueChange(data[dataIndex]);
                                } else if (dataIndex !== selectedIndex) {
                                    setSelectedIndex(dataIndex);
                                    scrollToIndex(dataIndex, true);
                                }
                            }}
                            style={(state) => [
                                styles.item,
                                adaptiveFontSize && styles.itemCompact,
                                { height: itemHeight },
                                // 网页端鼠标悬停时给一点底色，提示可以点
                                Platform.OS === 'web' && (state as { hovered?: boolean }).hovered && dataIndex !== selectedIndex
                                    ? styles.itemHovered
                                    : null,
                            ]}
                        >
                            {(
                                <Animated.Text
                                    numberOfLines={1}
                                    ellipsizeMode="tail"
                                    adjustsFontSizeToFit={adaptiveFontSize}
                                    minimumFontScale={0.85}
                                    style={[
                                        styles.itemText,
                                        {
                                            width: textBoxWidth,
                                            fontSize: resolvedFontSize,
                                            lineHeight: Math.round(resolvedFontSize * 1.28),
                                            transform: [{ scale }],
                                            opacity: opacity,
                                            // TODO: 不支持对 color 属性进行 Native 插值，
                                            // 因此我们借由 opacity 来实现渐变感觉，或者使用固定的选中色
                                            color: resolvedActiveTextColor,
                                            fontWeight: '500' // 加粗
                                        }
                                    ]}
                                >
                                    {item}
                                </Animated.Text>
                            )}
                        </Pressable>
                    );
                })}
            </Animated.ScrollView>
            {/* 上下渐隐，提示还能滚动 */}
            <LinearGradient
                pointerEvents="none"
                colors={[fadeBase, fadeClear]}
                style={[styles.fade, { top: 0, height: itemHeight * 1.5 }]}
            />
            <LinearGradient
                pointerEvents="none"
                colors={[fadeClear, fadeBase]}
                style={[styles.fade, { bottom: 0, height: itemHeight * 1.5 }]}
            />
        </View>
    );
}

const makeStyles = (Colors: any) => StyleSheet.create({
    item: {
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 6,
        overflow: 'hidden',
    },
    itemCompact: {
        paddingHorizontal: 4,
    },
    itemHovered: {
        backgroundColor: Colors.bg.secondary,
        borderRadius: BorderRadius.md,
    },
    itemText: {
        textAlign: 'center',
        includeFontPadding: false,
        // 数字等宽，滚动时不左右跳
        fontVariant: ['tabular-nums'],
    },
    fade: {
        position: 'absolute',
        left: 0,
        right: 0,
    },
    highlight: {
        position: 'absolute',
        left: 2,
        right: 2,
        backgroundColor: Colors.bg.elevated,
        borderRadius: BorderRadius.md,
    }
});
