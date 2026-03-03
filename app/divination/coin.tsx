/**
 * 硬币排卦页面
 * 模拟三枚铜钱，六次摇掷
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    ScrollView, TextInput, Alert, Animated, Easing
} from 'react-native';
import Svg, { Path, Text as SvgText } from 'react-native-svg';
import StatusBarDecor from '../../src/components/StatusBarDecor';
import { router } from 'expo-router';
import { CustomAlert } from '../../src/components/CustomAlertProvider';
import { Spacing, FontSize, BorderRadius } from '../../src/theme/colors';
import { BackIcon } from '../../src/components/Icons';
import { YaoValue } from '../../src/core/liuyao-data';
import { divinateByCoin } from '../../src/core/liuyao-calc';
import { saveRecord, getRecord } from '../../src/db/database';
import LocationBar from '../../src/components/LocationBar';
import CityPicker from '../../src/components/CityPicker';
import { useLocation } from '../../src/hooks/useLocation';
import { useTheme } from "../../src/theme/ThemeContext";

const YAO_NAMES = ['初爻', '二爻', '三爻', '四爻', '五爻', '上爻'];
const VALUE_DESC: Record<number, { label: string; type: string }> = {
    6: { label: '老阴', type: '阴动' },
    7: { label: '少阳', type: '阳静' },
    8: { label: '少阴', type: '阴静' },
    9: { label: '老阳', type: '阳动' },
};

/**
 * 六爻基本符号 SVG 渲染
 * 阳爻为一条长横线；阴爻为两条短横线；
 * 老阳带有圆圈(○)；老阴带有交叉(✕)；
 */
const YaoSVG = ({ value, color }: { value: YaoValue, color: string }) => {
    switch (value) {
        // 6：老阴 (- - ✕)
        case 6:
            return (
                <Svg width="60" height="20" viewBox="0 0 60 20">
                    {/* 左侧空出给变爻标记的交叉 */}
                    <Path d="M6 6 L14 14 M6 14 L14 6" stroke={color} strokeWidth="2" strokeLinecap="round" />
                    {/* 阴爻两端平移 */}
                    <Path d="M20 10 L35 10" stroke={color} strokeWidth="4" strokeLinecap="round" />
                    <Path d="M45 10 L60 10" stroke={color} strokeWidth="4" strokeLinecap="round" />
                </Svg>
            );
        // 7：少阳 (---)
        case 7:
            return (
                <Svg width="60" height="20" viewBox="0 0 60 20">
                    <Path d="M20 10 L60 10" stroke={color} strokeWidth="4" strokeLinecap="round" />
                </Svg>
            );
        // 8：少阴 (- -)
        case 8:
            return (
                <Svg width="60" height="20" viewBox="0 0 60 20">
                    {/* 阴爻两端平移 */}
                    <Path d="M20 10 L35 10" stroke={color} strokeWidth="4" strokeLinecap="round" />
                    <Path d="M45 10 L60 10" stroke={color} strokeWidth="4" strokeLinecap="round" />
                </Svg>
            );
        // 9：老阳 (--- ○)
        case 9:
            return (
                <Svg width="60" height="20" viewBox="0 0 60 20">
                    {/* 左侧空出给变爻标记的圆圈 */}
                    <SvgText x="10" y="15" fontSize="14" fill={color} textAnchor="middle">○</SvgText>
                    <Path d="M20 10 L60 10" stroke={color} strokeWidth="4" strokeLinecap="round" />
                </Svg>
            );
        default:
            return null;
    }
};

/**
 * 纯函数：硬币正面（字面/阴面） 
 * 价值为 2，外圆内方，写有文字
 */
const CoinFront = ({ color, size, textColor }: { color: string, size: number, textColor: string }) => {
    return (
        <Svg width={size} height={size} viewBox="0 0 100 100">
            {/* 纯正的外圆内方：利用 fillRule="evenodd" 镂空内部 */}
            <Path
                d="M50 2 A48 48 0 1 0 50 98 A48 48 0 1 0 50 2 Z M35 35 L65 35 L65 65 L35 65 Z"
                fill={color}
                fillRule="evenodd"
            />
            {/* 边框纹路装饰（浅色描边增强金属感） */}
            <Path d="M50 6 A44 44 0 1 0 50 94 A44 44 0 1 0 50 6 Z" fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth="1" />
            <Path d="M33 33 L67 33 L67 67 L33 67 Z" fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth="1" />

            <SvgText x="50" y="29" fontSize="16" fill={textColor} textAnchor="middle" fontWeight="bold">永</SvgText>
            <SvgText x="50" y="85" fontSize="16" fill={textColor} textAnchor="middle" fontWeight="bold">樂</SvgText>
            <SvgText x="85" y="56" fontSize="16" fill={textColor} textAnchor="middle" fontWeight="bold">通  </SvgText>
            <SvgText x="15" y="56" fontSize="16" fill={textColor} textAnchor="middle" fontWeight="bold">  寶</SvgText>
        </Svg>
    );
};

/**
 * 纯函数：硬币背面（花面/阳面） 
 * 价值为 3，外圆内方，无字
 */
const CoinBack = ({ color, size }: { color: string, size: number }) => {
    return (
        <Svg width={size} height={size} viewBox="0 0 100 100">
            <Path
                d="M50 2 A48 48 0 1 0 50 98 A48 48 0 1 0 50 2 Z M35 35 L65 35 L65 65 L35 65 Z"
                fill={color}
                fillRule="evenodd"
            />
            <Path d="M50 6 A44 44 0 1 0 50 94 A44 44 0 1 0 50 6 Z" fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth="1" />
            <Path d="M33 33 L67 33 L67 67 L33 67 Z" fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth="1" />
        </Svg>
    );
};

export default function CoinDivination() {
    const { Colors } = useTheme();
    const styles = makeStyles(Colors);
    const [results, setResults] = useState<YaoValue[]>([]);
    const [shaking, setShaking] = useState(false);
    const [savingResult, setSavingResult] = useState(false);
    const [question, setQuestion] = useState('');
    const currentYao = results.length;
    const { city, pickerVisible, openPicker, closePicker, handleSelectCity } = useLocation();

    // 独立控制 3 枚硬币的翻转角度（存的是累计的绝对角度值，初始为0）
    const spinValues = useRef([
        new Animated.Value(0),
        new Animated.Value(0),
        new Animated.Value(0),
    ]).current;

    // 记录每枚硬币当前的静止角度（防止下次旋转时产生从0度重置的回跳生硬感）
    const currentAngles = useRef([0, 0, 0]).current;

    useEffect(() => {
        return () => {
            // Memory leak protection: stop all animations on unmount
            spinValues.forEach(val => val.stopAnimation());
        };
    }, [spinValues]);

    const handleThrow = useCallback(() => {
        if (currentYao >= 6 || shaking) return;
        setShaking(true);

        /**
         * 判定三枚硬币正反 (正面为true，对应阳面/字面)
         * - 在六爻中：背面/花面为阳（计为3），正面/字面为阴（计为2）
         * - 纯随机 50% 概率，三次结果分别控制三枚硬币。
         */
        const tossRes = [Math.random() < 0.5, Math.random() < 0.5, Math.random() < 0.5];

        const animations = tossRes.map((isFront, idx) => {
            // 最少转4整圈（1440度）以营造真实的抛掷感
            let targetAngle = currentAngles[idx] + 1440;

            // 找出当前的度数偏移
            const mod = targetAngle % 360;

            // 如果计算结果是停在前面（字面），那么角度必须对齐到0（360的倍数）
            // 如果停在背面（阳面），角度需额外+180
            const neededMod = isFront ? 0 : 180;
            let diff = neededMod - mod;
            if (diff < 0) diff += 360;

            targetAngle += diff;
            currentAngles[idx] = targetAngle; // 存入引用以供下个爻累加

            // 分配稍有差异的动画时长，模拟三枚硬币各自落地不一的时差感
            return Animated.timing(spinValues[idx], {
                toValue: targetAngle,
                duration: 1200 + idx * 250,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true
            });
        });

        // 计算当前爻的阴阳数字总量：字(正面)=2，花(背面)=3
        const sumNum = tossRes.map(isFront => isFront ? 2 : 3).reduce((a, b) => a + b, 0);
        const sum = sumNum as YaoValue;

        Animated.parallel(animations).start(() => {
            // 动画全部执行完毕后，六次爻长+1并刷新UI
            setResults(prev => [...prev, sum]);
            setShaking(false);
        });
    }, [currentYao, shaking, spinValues]);

    const handleReset = () => {
        setResults([]);
        // 抹除度数记录，使硬币归零
        currentAngles.fill(0);
        spinValues.forEach(val => val.setValue(0));
    };

    const handleComplete = async () => {
        if (results.length !== 6 || savingResult) return;
        // 将六个推演的结果传给引擎进行最终全貌生成
        const result = divinateByCoin(results, new Date(), question, city?.longitude, city?.name);

        const persistWithRetry = async (): Promise<boolean> => {
            const maxAttempts = 3;
            for (let i = 1; i <= maxAttempts; i++) {
                try {
                    await saveRecord(result);
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
                {/* 占问事项 */}
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

                {/* 真太阳时参考地点 */}
                <LocationBar city={city} onPress={openPicker} />

                {/* 硬币中心区域：将整个板块转为 Touchable，点击空白即可摇铜钱 */}
                <TouchableOpacity
                    style={styles.coinSection}
                    activeOpacity={1}
                    onPress={currentYao < 6 && !shaking ? handleThrow : undefined}
                >
                    <View style={styles.coinsDisplay}>
                        {spinValues.map((spinVal, idx) => {
                            // 插值动画映射。将累计的大数字转为 CSS 的 deg 值。
                            // 由于使用了极大的范围保护，不会出现出界异常。
                            const rotateYFront = spinVal.interpolate({
                                inputRange: [0, 100000],
                                outputRange: ['0deg', '100000deg']
                            });
                            // 背面组件的挂载必须比前面的角度高出 180 度，才能形成正反对立面
                            const rotateYBack = spinVal.interpolate({
                                inputRange: [0, 100000],
                                outputRange: ['180deg', '100180deg']
                            });

                            return (
                                <View key={idx} style={styles.coinWrapper}>
                                    <Animated.View style={[styles.coinSide, { transform: [{ perspective: 1000 }, { rotateY: rotateYBack }] }]}>
                                        <CoinBack size={76} color={Colors.accent.gold} />
                                    </Animated.View>
                                    <Animated.View style={[styles.coinSide, { transform: [{ perspective: 1000 }, { rotateY: rotateYFront }] }]}>
                                        <CoinFront size={76} color={Colors.accent.gold} textColor={Colors.bg.primary} />
                                    </Animated.View>
                                </View>
                            );
                        })}
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
                            <Text style={styles.clickHint}>提示：也可直接点击空白处抛掷</Text>
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
                </TouchableOpacity>

                {/* 摇掷已成结果列表清单 */}
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

                    {/* 未求出的空位占位提示 */}
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
                onSelect={handleSelectCity}
                selectedCity={city}
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
        width: 76, height: 76,
        alignItems: 'center', justifyContent: 'center',
    },
    coinSide: {
        position: 'absolute',
        backfaceVisibility: 'hidden',
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
        flex: 1, paddingVertical: 4, paddingHorizontal: Spacing.md,
        backgroundColor: Colors.bg.elevated, borderRadius: BorderRadius.sm,
    },
    resultValueContainer: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%',
    },
    resultBadgeMoving: { backgroundColor: Colors.yao.movingBg },
    resultValue: { fontSize: FontSize.md, color: Colors.text.primary },
    resultValueMoving: { color: Colors.accent.red },
    resultType: { fontSize: FontSize.xs, color: Colors.text.tertiary, width: 40 },
    resultTypeMoving: { color: Colors.accent.red },
    resultEmpty: { fontSize: FontSize.sm, color: Colors.text.tertiary },
});
