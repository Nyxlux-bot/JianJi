import React, { useRef, useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, Animated, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
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
}

export default function ScrollPicker({
    data,
    value,
    onValueChange,
    itemHeight = 44,
    visibleItems = 5,
    activeTextColor,
    inactiveTextColor,
    Colors: PropColors
}: ScrollPickerProps) {
    const { Colors: ContextColors } = useTheme();
    const Colors = PropColors || ContextColors;
    const styles = makeStyles(Colors);

    const resolvedActiveTextColor = activeTextColor || Colors.text.primary;
    const resolvedInactiveTextColor = inactiveTextColor || Colors.text.tertiary;

    const scrollY = useRef(new Animated.Value(0)).current;
    const scrollViewRef = useRef<any>(null);

    // 定位初始值
    const getInitialIndex = () => {
        const idx = data.indexOf(value);
        return idx !== -1 ? idx : 0;
    };

    const [selectedIndex, setSelectedIndex] = useState(getInitialIndex);
    const isProgrammaticScroll = useRef(false);

    const halfVisible = Math.floor(visibleItems / 2);
    // 用空字符串填补上下空间
    const spacer = Array(halfVisible).fill('');
    const paddedData = useMemo(() => [...spacer, ...data, ...spacer], [data, visibleItems]);

    // 值从外部改变时（不包括滚动自己触发的），滚动到对应位置
    useEffect(() => {
        const index = data.indexOf(value);
        if (index !== -1 && index !== selectedIndex) {
            setSelectedIndex(index);
            isProgrammaticScroll.current = true;
            // Native驱动下的scrollTo
            if (scrollViewRef.current) {
                if (typeof scrollViewRef.current.scrollTo === 'function') {
                    scrollViewRef.current.scrollTo({ y: index * itemHeight, animated: true });
                } else if (typeof scrollViewRef.current.getNode === 'function') {
                    scrollViewRef.current.getNode().scrollTo({ y: index * itemHeight, animated: true });
                }
            }

            setTimeout(() => {
                isProgrammaticScroll.current = false;
            }, 300);
        }
    }, [value, data, itemHeight, selectedIndex]);

    // 初始渲染时滚动到默认值
    useEffect(() => {
        const index = data.indexOf(value);
        if (index !== -1 && scrollViewRef.current) {
            setTimeout(() => {
                if (scrollViewRef.current) {
                    if (typeof scrollViewRef.current.scrollTo === 'function') {
                        scrollViewRef.current.scrollTo({ y: index * itemHeight, animated: false });
                    } else if (typeof scrollViewRef.current.getNode === 'function') {
                        scrollViewRef.current.getNode().scrollTo({ y: index * itemHeight, animated: false });
                    }
                }
            }, 0);
        }
    }, [data.length, itemHeight, value]);

    const handleMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        if (isProgrammaticScroll.current) {
            isProgrammaticScroll.current = false;
            return;
        }

        const offsetY = event.nativeEvent.contentOffset.y;
        let index = Math.round(offsetY / itemHeight);

        if (index < 0) index = 0;
        if (index >= data.length) index = data.length - 1;

        if (index !== selectedIndex) {
            setSelectedIndex(index);
            if (data[index] !== value) {
                onValueChange(data[index]);
            }
        }
    };

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
                onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                    { useNativeDriver: true }
                )}
                onMomentumScrollEnd={handleMomentumScrollEnd}
                onScrollEndDrag={handleMomentumScrollEnd}
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
                        outputRange: [0.85, 1.15, 0.85],
                        extrapolate: 'clamp'
                    });

                    const opacity = scrollY.interpolate({
                        inputRange,
                        outputRange: [0.4, 1, 0.4],
                        extrapolate: 'clamp'
                    });

                    return (
                        <View key={`${item}-${index}`} style={[styles.item, { height: itemHeight }]}>
                            {item !== '' && (
                                <Animated.Text
                                    style={[
                                        styles.itemText,
                                        {
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
                        </View>
                    );
                })}
            </Animated.ScrollView>
        </View>
    );
}

const makeStyles = (Colors: any) => StyleSheet.create({
    item: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    itemText: {
        fontSize: FontSize.lg,
    },
    highlight: {
        position: 'absolute',
        left: 2,
        right: 2,
        backgroundColor: Colors.bg.elevated,
        borderRadius: BorderRadius.md,
    }
});
