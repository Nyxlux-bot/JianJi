import React from 'react';
import { View, StyleSheet, Platform, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from "../theme/ThemeContext";

const StatusBarDecor: React.FC = () => {
    const { Colors } = useTheme();
    const styles = makeStyles(Colors);
    const insets = useSafeAreaInsets();

    const topHeight = Math.max(
        insets.top,
        Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0,
        24
    );

    return (
        <View style={[styles.container, { height: topHeight }]} />
    );
};
export default StatusBarDecor;

const makeStyles = (Colors: any) => StyleSheet.create({
    container: {
        width: '100%',
        backgroundColor: Colors.bg.primary,
    },
});
