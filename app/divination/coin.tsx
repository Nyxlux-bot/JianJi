/**
 * 硬币排卦页面
 * 模拟三枚铜钱，六次摇掷
 */

import React, { useState, useRef, useCallback, useEffect, memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Animated, Easing } from 'react-native';
import Svg, { Path, Text as SvgText } from 'react-native-svg';

import StatusBarDecor from '../../src/components/StatusBarDecor';
import { router } from 'expo-router';
import { CustomAlert } from '../../src/components/CustomAlertProvider';
import { Spacing, FontSize, BorderRadius } from '../../src/theme/colors';
import { buildRegionDisplayName } from '../../src/core/city-data';
import { BackIcon } from '../../src/components/Icons';
import { YaoValue } from '../../src/core/liuyao-data';
import { divinateByCoin } from '../../src/core/liuyao-calc';
import { saveRecord, getRecord } from '../../src/db/database';
import LocationBar from '../../src/components/LocationBar';
import CityPicker from '../../src/components/CityPicker';
import { useLocation } from '../../src/hooks/useLocation';
import { useTheme } from "../../src/theme/ThemeContext";
import YongleCoin from '../../src/components/YongleCoin';
import {
    CoinAngles,
    CoinFace,
    getFaceFromToss,
    mapTossToYaoValue,
} from '../../src/components/coin-motion';

const YAO_NAMES = ['初爻', '二爻', '三爻', '四爻', '五爻', '上爻'];
const VALUE_DESC: Record<number, { label: string; type: string }> = {
    6: { label: '老阴', type: '阴动' },
    7: { label: '少阳', type: '阳静' },
    8: { label: '少阴', type: '阴静' },
    9: { label: '老阳', type: '阳动' },
};

const COIN_SIZE = 76;

const YaoSVG = ({ value, color }: { value: YaoValue, color: string }) => {
    switch (value) {
        case 6:
            return (
                <Svg width="60" height="20" viewBox="0 0 60 20">
                    <Path d="M6 6 L14 14 M6 14 L14 6" stroke={color} strokeWidth="2" strokeLinecap="round" />
                    <Path d="M20 10 L35 10" stroke={color} strokeWidth="4" strokeLinecap="round" />
                    <Path d="M45 10 L60 10" stroke={color} strokeWidth="4" strokeLinecap="round" />
                </Svg>
            );
        case 7:
            return (
                <Svg width="60" height="20" viewBox="0 0 60 20">
                    <Path d="M20 10 L60 10" stroke={color} strokeWidth="4" strokeLinecap="round" />
                </Svg>
            );
        case 8:
            return (
                <Svg width="60" height="20" viewBox="0 0 60 20">
                    <Path d="M20 10 L35 10" stroke={color} strokeWidth="4" strokeLinecap="round" />
                    <Path d="M45 10 L60 10" stroke={color} strokeWidth="4" strokeLinecap="round" />
                </Svg>
            );
        case 9:
            return (
                <Svg width="60" height="20" viewBox="0 0 60 20">
                    <SvgText x="10" y="15" fontSize="14" fill={color} textAnchor="middle">○</SvgText>
                    <Path d="M20 10 L60 10" stroke={color} strokeWidth="4" strokeLinecap="round" />
                </Svg>
            );
        default:
            return null;
    }
};

interface CoinMotionState {
    rotateY: Animated.Value;
    translateY: Animated.Value;
    scale: Animated.Value;
    shadowOpacity: Animated.Value;
    currentAngles: CoinAngles;
}

function useCoinMotionState(): CoinMotionState {
    const rotateY = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(0)).current;
    const scale = useRef(new Animated.Value(1)).current;
    const shadowOpacity = useRef(new Animated.Value(0.26)).current;
    const currentAnglesRef = useRef<CoinAngles>({ x: 0, y: 0, z: 0 });

    return {
        rotateY,
        translateY,
        scale,
        shadowOpacity,
        currentAngles: currentAnglesRef.current,
    };
}

interface Coin3DProps {
    motion: CoinMotionState;
    themeName: 'dark' | 'green' | 'white' | 'purple';
    styles: ReturnType<typeof makeStyles>;
}

const Coin3D: React.FC<Coin3DProps> = memo(({ motion, themeName, styles }) => {
    const rotateYFront = motion.rotateY.interpolate({
        inputRange: [0, 360],
        outputRange: ['0deg', '360deg'],
    });

    const rotateYBack = motion.rotateY.interpolate({
        inputRange: [0, 360],
        outputRange: ['180deg', '540deg'],
    });

    return (
        <View style={styles.coinWrapper}>
            <Animated.View style={[styles.coin3DContainer, { transform: [{ perspective: 1000 }] }]}>
                <Animated.View style={[styles.coinSide, { transform: [{ rotateY: rotateYBack }] }]}>
                    <YongleCoin face="back" size={COIN_SIZE} themeName={themeName} />
                </Animated.View>

                <Animated.View style={[styles.coinSide, { transform: [{ rotateY: rotateYFront }] }]}>
                    <YongleCoin face="front" size={COIN_SIZE} themeName={themeName} />
                </Animated.View>
            </Animated.View>
        </View>
    );
});

Coin3D.displayName = 'Coin3D';

function animateCoin(motion: CoinMotionState, targetFace: CoinFace, seed: number): Promise<void> {
    return new Promise(resolve => {
        const totalDuration = 1000;
        const currentY = (motion.rotateY as any)._value || motion.currentAngles.y;
        const baseSpins = 1440;
        let targetY = currentY + baseSpins;
        const requiredRem = targetFace === 'front' ? 0 : 180;

        const rem = targetY % 360;
        let diff = requiredRem - rem;
        if (diff < 0) diff += 360;
        targetY += diff;

        // 执行并行并发原生动画
        Animated.parallel([
            Animated.timing(motion.rotateY, {
                toValue: targetY,
                duration: totalDuration,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            })
        ]).start(() => {
            motion.currentAngles.y = targetY;
            resolve();
        });
    });
}

function resetCoinMotion(motion: CoinMotionState) {
    motion.currentAngles.x = 0;
    motion.currentAngles.y = 0;
    motion.currentAngles.z = 0;

    motion.rotateY.setValue(0);
    motion.translateY.setValue(0);
    motion.scale.setValue(1);
    motion.shadowOpacity.setValue(0.26);
}

export default function CoinDivination() {
    const { Colors, theme } = useTheme();
    const styles = makeStyles(Colors);
    const [results, setResults] = useState<YaoValue[]>([]);
    const [shaking, setShaking] = useState(false);
    const [savingResult, setSavingResult] = useState(false);
    const [question, setQuestion] = useState('');
    const currentYao = results.length;
    const { location, pickerVisible, openPicker, closePicker, handleSelectLocation } = useLocation();

    const coinA = useCoinMotionState();
    const coinB = useCoinMotionState();
    const coinC = useCoinMotionState();
    const coinMotions = [coinA, coinB, coinC];

    const completeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        return () => {
            if (completeTimerRef.current) {
                clearTimeout(completeTimerRef.current);
                completeTimerRef.current = null;
            }
        };
    }, []);

    const handleThrow = useCallback(() => {
        if (currentYao >= 6 || shaking) return;
        setShaking(true);

        // true = 字面(front, 阴=2), false = 花面(back, 阳=3)
        const tossRes = [Math.random() < 0.5, Math.random() < 0.5, Math.random() < 0.5];

        const animations = tossRes.map((isFront, idx) => {
            const targetFace = getFaceFromToss(isFront);
            const seed = Date.now() + currentYao * 97 + idx * 131;
            return animateCoin(coinMotions[idx], targetFace, seed);
        });

        const yaoValue = mapTossToYaoValue(tossRes);

        Promise.all(animations).then(() => {
            setResults(prev => [...prev, yaoValue]);
            setShaking(false);
        });
    }, [coinMotions, currentYao, shaking]);

    const handleReset = () => {
        if (completeTimerRef.current) {
            clearTimeout(completeTimerRef.current);
            completeTimerRef.current = null;
        }
        setShaking(false);
        setResults([]);
        coinMotions.forEach(resetCoinMotion);
    };

    const handleComplete = async () => {
        if (results.length !== 6 || savingResult) return;
        const result = divinateByCoin(
            results,
            new Date(),
            question,
            location?.longitude,
            location ? buildRegionDisplayName(location) : undefined,
        );

        const persistWithRetry = async (): Promise<boolean> => {
            const maxAttempts = 3;
            for (let i = 1; i <= maxAttempts; i++) {
                try {
                    await saveRecord({
                        engineType: 'liuyao',
                        result,
                    });
                    const saved = await getRecord(result.id);
                    if (saved) return true;
                } catch (error) {
                    console.error(error);
                }
                if (i < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, 250 * i));
                }
            }
            return false;
        };

        setSavingResult(true);
        try {
            const saved = await persistWithRetry();
            if (!saved) {
                CustomAlert.alert("保存失败", "排盘结果未能可靠保存，请稍后重试。", [
                    { text: '取消', style: 'cancel' },
                    { text: '重试', onPress: handleComplete },
                ]);
                return;
            }
            router.push(`/result/${result.id}`);
        } finally {
            setSavingResult(false);
        }
    };

    return (
        <View style={styles.container}>
            <StatusBarDecor />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <BackIcon size={24} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>硬币排卦</Text>
                <TouchableOpacity onPress={handleReset} style={styles.backBtn}>
                    <Text style={styles.resetText}>重置</Text>
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.questionSection}>
                    <TextInput
                        style={styles.questionInput}
                        value={question}
                        onChangeText={setQuestion}
                        placeholder="心中默念所问之事..."
                        placeholderTextColor={Colors.text.tertiary}
                        maxLength={100}
                    />
                </View>

                <LocationBar location={location} onPress={openPicker} />

                <View style={styles.coinSection}>
                    <View style={styles.coinsDisplay}>
                        <Coin3D motion={coinA} themeName={theme} styles={styles} />
                        <Coin3D motion={coinB} themeName={theme} styles={styles} />
                        <Coin3D motion={coinC} themeName={theme} styles={styles} />
                    </View>

                    {currentYao < 6 ? (
                        <View style={styles.throwInfo}>
                            <Text style={styles.throwHint}>
                                第 {currentYao + 1} 爻 ({YAO_NAMES[currentYao]})
                            </Text>
                            <TouchableOpacity
                                style={[styles.throwButton, shaking && styles.throwButtonDisabled]}
                                activeOpacity={0.8}
                                onPress={handleThrow}
                                disabled={shaking}
                            >
                                <Text style={styles.throwButtonText}>
                                    {shaking ? '摇晃中...' : '抛掷求卦'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <TouchableOpacity
                            style={[styles.completeButton, savingResult && styles.completeButtonDisabled]}
                            activeOpacity={0.8}
                            onPress={handleComplete}
                            disabled={savingResult}
                        >
                            <Text style={styles.completeButtonText}>
                                {savingResult ? '保存中...' : '生成排盘全览'}
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>

                <View style={styles.resultsSection}>
                    <Text style={styles.sectionLabel}>
                        摇掷记录 ({results.length}/6)
                    </Text>
                    {results.map((value, index) => {
                        const desc = VALUE_DESC[value];
                        const isMoving = value === 6 || value === 9;
                        return (
                            <View key={index} style={styles.resultRow}>
                                <Text style={styles.resultYaoName}>{YAO_NAMES[index]}</Text>
                                <View style={[
                                    styles.resultBadge,
                                    isMoving && styles.resultBadgeMoving,
                                ]}>
                                    <View style={styles.resultValueContainer}>
                                        <Text style={[
                                            styles.resultValue,
                                            isMoving && styles.resultValueMoving,
                                        ]}>
                                            {desc.label}
                                        </Text>
                                        <YaoSVG value={value} color={isMoving ? Colors.accent.red : Colors.text.primary} />
                                    </View>
                                </View>
                                <Text style={[
                                    styles.resultType,
                                    isMoving && styles.resultTypeMoving,
                                ]}>
                                    {desc.type}
                                </Text>
                            </View>
                        );
                    })}

                    {Array.from({ length: 6 - results.length }).map((_, i) => (
                        <View key={`empty-${i}`} style={[styles.resultRow, styles.resultRowEmpty]}>
                            <Text style={styles.resultYaoName}>{YAO_NAMES[results.length + i]}</Text>
                            <Text style={styles.resultEmpty}>待摇</Text>
                        </View>
                    ))}
                </View>
            </ScrollView>

            <CityPicker
                visible={pickerVisible}
                onClose={closePicker}
                onSelect={handleSelectLocation}
                selectedRegion={location}
            />
        </View>
    );
}

const makeStyles = (Colors: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.bg.primary },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    },
    backBtn: { width: 50, height: 40, justifyContent: 'center' },
    headerTitle: { fontSize: FontSize.lg, color: Colors.text.heading, fontWeight: '400' },
    resetText: { fontSize: FontSize.sm, color: Colors.accent.gold },
    content: { flex: 1, paddingHorizontal: Spacing.xl },
    questionSection: { marginBottom: Spacing.lg },
    questionInput: {
        backgroundColor: Colors.bg.card, color: Colors.text.primary,
        fontSize: FontSize.md, padding: Spacing.lg,
        borderRadius: BorderRadius.md, borderWidth: 0.5, borderColor: Colors.border.subtle,
    },
    coinSection: {
        alignItems: 'center', paddingVertical: Spacing.xxl,
        backgroundColor: Colors.bg.card, borderRadius: BorderRadius.lg,
        marginBottom: Spacing.xl,
    },
    coinsDisplay: {
        flexDirection: 'row', gap: Spacing.lg, marginBottom: Spacing.xxl,
    },
    coinWrapper: {
        width: COIN_SIZE,
        height: COIN_SIZE + 14,
        alignItems: 'center',
        justifyContent: 'flex-start',
    },
    coin3DContainer: {
        width: COIN_SIZE,
        height: COIN_SIZE,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'visible',
    },
    coinSide: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: COIN_SIZE,
        height: COIN_SIZE,
        alignItems: 'center',
        justifyContent: 'center',
        backfaceVisibility: 'hidden',
    },
    coinShadow: {
        position: 'absolute',
        bottom: 2,
        width: COIN_SIZE * 0.8,
        height: 12,
        borderRadius: 999,
        backgroundColor: 'rgba(0,0,0,0.35)',
    },
    throwInfo: { alignItems: 'center' },
    throwHint: {
        fontSize: FontSize.md, color: Colors.text.secondary, marginBottom: Spacing.lg,
    },
    clickHint: {
        fontSize: FontSize.xs, color: Colors.text.tertiary, marginTop: Spacing.md,
    },
    throwButton: {
        backgroundColor: Colors.accent.gold, borderRadius: BorderRadius.lg,
        paddingVertical: Spacing.md, paddingHorizontal: Spacing.xxxl,
    },
    throwButtonDisabled: { opacity: 0.5 },
    throwButtonText: {
        fontSize: FontSize.lg, color: Colors.text.inverse, fontWeight: '500', letterSpacing: 4,
    },
    completeButton: {
        backgroundColor: Colors.accent.jade, borderRadius: BorderRadius.lg,
        paddingVertical: Spacing.md, paddingHorizontal: Spacing.xxxl,
    },
    completeButtonDisabled: { opacity: 0.6 },
    completeButtonText: {
        fontSize: FontSize.lg, color: '#fff', fontWeight: '500', letterSpacing: 2,
    },
    resultsSection: { marginBottom: 40 },
    sectionLabel: {
        fontSize: FontSize.sm, color: Colors.text.secondary,
        marginBottom: Spacing.md, letterSpacing: 1,
    },
    resultRow: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
        paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md,
        backgroundColor: Colors.bg.card, borderRadius: BorderRadius.md,
        marginBottom: Spacing.sm,
    },
    resultRowEmpty: { opacity: 0.4 },
    resultYaoName: { fontSize: FontSize.sm, color: Colors.text.secondary, width: 40 },
    resultBadge: {
        flex: 1, paddingVertical: 8, paddingHorizontal: Spacing.md,
        backgroundColor: Colors.bg.elevated, borderRadius: BorderRadius.sm,
    },
    resultValueContainer: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%',
    },
    resultBadgeMoving: { backgroundColor: Colors.yao.movingBg },
    resultValue: { fontSize: FontSize.md, color: Colors.text.primary },
    resultValueMoving: { color: Colors.accent.red },
    resultType: { fontSize: FontSize.xs, color: Colors.text.tertiary },
    resultTypeMoving: { color: Colors.accent.red },
    resultEmpty: { fontSize: FontSize.sm, color: Colors.text.tertiary },
});
