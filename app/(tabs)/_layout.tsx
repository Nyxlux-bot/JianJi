import React, { useRef, useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet, Dimensions, Animated } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme/ThemeContext';
import { HistoryIcon, SettingsIcon, ReadIcon, HomeIcon } from '../../src/components/Icons';

// Dimensions for the floating tab bar
const { width } = Dimensions.get('window');
const TAB_BAR_WIDTH = width * 0.85;

function TabItem({ route, options, isFocused, navigation, safeColors }: any) {
    const scaleValue = useRef(new Animated.Value(isFocused ? 1 : 0)).current;

    useEffect(() => {
        Animated.spring(scaleValue, {
            toValue: isFocused ? 1 : 0,
            useNativeDriver: true,
            friction: 5,
            tension: 40,
        }).start();
    }, [isFocused]);

    const scale = scaleValue.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 1.2],
    });

    const onPress = () => {
        const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
        });

        if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
        }
    };

    let icon;
    const c = isFocused ? (safeColors.accent?.gold || '#cbb06d') : (safeColors.text?.tertiary || '#ccc');

    switch (route.name) {
        case 'index':
            icon = <HomeIcon size={24} color={c} />;
            break;
        case 'learn':
            icon = <ReadIcon size={24} color={c} />;
            break;
        case 'history':
            icon = <HistoryIcon size={24} color={c} />;
            break;
        case 'settings':
            icon = <SettingsIcon size={24} color={c} />;
            break;
    }

    return (
        <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            testID={options.tabBarTestID}
            onPress={onPress}
            style={styles.tabItem}
            activeOpacity={0.7}
        >
            <Animated.View style={{ transform: [{ scale }] }}>
                {icon}
            </Animated.View>
        </TouchableOpacity>
    );
}

function CustomTabBar({ state, descriptors, navigation }: any) {
    const { Colors } = useTheme();
    const insets = useSafeAreaInsets();
    const bottomPadding = Math.max(insets.bottom, 16);

    const safeColors = Colors || { bg: {}, text: {}, accent: {} };

    return (
        <View style={[styles.tabBarContainer, { paddingBottom: bottomPadding }]}>
            <View style={[
                styles.tabBar,
                {
                    backgroundColor: safeColors.bg?.secondary || '#fff',
                    shadowColor: safeColors.text?.primary || '#000',
                }
            ]}>
                {state.routes.map((route: any, index: number) => {
                    const { options } = descriptors[route.key];
                    const isFocused = state.index === index;
                    return (
                        <TabItem
                            key={index}
                            route={route}
                            index={index}
                            options={options}
                            isFocused={isFocused}
                            navigation={navigation}
                            safeColors={safeColors}
                        />
                    );
                })}
            </View>
        </View>
    );
}

export default function TabLayout() {
    const { Colors } = useTheme();

    return (
        <Tabs
            tabBar={(props) => <CustomTabBar {...props} />}
            screenOptions={{
                headerShown: false,
                sceneStyle: { backgroundColor: Colors?.bg?.primary || '#fff' },
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: '排盘',
                }}
            />
            <Tabs.Screen
                name="learn"
                options={{
                    title: '学习',
                }}
            />
            <Tabs.Screen
                name="history"
                options={{
                    title: '历史',
                }}
            />
            <Tabs.Screen
                name="settings"
                options={{
                    title: '设置',
                }}
            />
        </Tabs>
    );
}

const styles = StyleSheet.create({
    tabBarContainer: {
        position: 'absolute',
        bottom: 0,
        width: '100%',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    tabBar: {
        flexDirection: 'row',
        width: TAB_BAR_WIDTH,
        height: 64,
        borderRadius: 32,
        justifyContent: 'space-around',
        alignItems: 'center',
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
    },
    tabItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
    },
});
