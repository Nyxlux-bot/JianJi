import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, TouchableWithoutFeedback } from 'react-native';
import { PanResult } from '../core/liuyao-calc';
import { Spacing, FontSize, BorderRadius } from '../theme/colors';
import { useTheme } from "../theme/ThemeContext";

interface HexagramDisplayProps {
    result: PanResult;
}

const YaoSymbol: React.FC<{ isYang: boolean; color: string; styles: any }> = ({ isYang, color, styles }) => (
    <View style={styles.yaoSymbolWrapper}>
        {isYang ? (
            <View style={[styles.yangLine, { backgroundColor: color }]} />
        ) : (
            <View style={styles.yinLineContainer}>
                <View style={[styles.yinLineHalf, { backgroundColor: color }]} />
                <View style={{ width: 14 }} />
                <View style={[styles.yinLineHalf, { backgroundColor: color }]} />
            </View>
        )}
    </View>
);

function getLiuShenColor(liuShen: string, Colors: any): string {
    const colorMap: Record<string, string> = {
        '青龙': Colors.liushen.qinglong,
        '朱雀': Colors.liushen.zhuque,
        '勾陈': Colors.liushen.gouchen,
        '螣蛇': Colors.liushen.tengshe,
        '白虎': Colors.liushen.baihu,
        '玄武': Colors.liushen.xuanwu,
    };
    return colorMap[liuShen] || Colors.text.secondary;
}

function HexagramDisplayComponent({ result }: HexagramDisplayProps) {
    const { Colors } = useTheme();
    const styles = makeStyles(Colors);
    const { benGua, benGuaYao, bianGua, bianGuaYao } = result;

    const reversedBenYao = React.useMemo(() => [...benGuaYao].reverse(), [benGuaYao]);
    const reversedBianYao = React.useMemo(() => bianGuaYao ? [...bianGuaYao].reverse() : null, [bianGuaYao]);

    const [isFlipped, setIsFlipped] = useState(false);
    const flipAnim = useRef(new Animated.Value(0)).current;

    const flipCard = () => {
        if (!bianGua) return;
        Animated.spring(flipAnim, {
            toValue: isFlipped ? 0 : 1,
            friction: 8,
            tension: 40,
            useNativeDriver: true,
        }).start();
        setIsFlipped(!isFlipped);
    };

    const frontInterpolate = flipAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '180deg'],
    });
    const backInterpolate = flipAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['180deg', '360deg'],
    });

    const frontAnimatedStyle = {
        transform: [{ perspective: 1000 }, { rotateY: frontInterpolate }],
    };
    const backAnimatedStyle = {
        transform: [{ perspective: 1000 }, { rotateY: backInterpolate }],
    };

    const renderBenGua = () => (
        <Animated.View style={[styles.guaCard, frontAnimatedStyle, { backfaceVisibility: 'hidden' as const }]}>
            <View style={styles.cardHeader}>
                <Text style={styles.cardHeaderText}>本卦</Text>
            </View>

            <View style={styles.yaoList}>
                {reversedBenYao.map((yao) => {
                    const isYang = yao.nature === 'yang';
                    const yaoColor = yao.isMoving ? Colors.yao.moving : Colors.yao.yang;
                    const liuShenColor = getLiuShenColor(yao.liuShen, Colors);

                    return (
                        <View key={yao.position} style={styles.yaoRow}>
                            <View style={styles.leftInfoStr}>
                                <View style={styles.fuShenArea}>
                                    {yao.fuShen ? (
                                        <Text style={styles.fuShenText}>
                                            {yao.fuShen.liuQin}{yao.fuShen.zhi}
                                        </Text>
                                    ) : null}
                                </View>
                                <Text style={[styles.textBase, { color: liuShenColor, width: 34 }]}>
                                    {yao.liuShen}
                                </Text>
                                <Text style={[styles.textBase, { color: yaoColor, width: 44 }]}>
                                    {yao.liuQin}{yao.zhi}
                                </Text>
                            </View>

                            <View style={styles.yaoLinesContainer}>
                                <YaoSymbol isYang={isYang} color={yaoColor} styles={styles} />
                            </View>

                            <View style={styles.rightInfoStr}>
                                {yao.isShi || yao.isYing ? (
                                    <Text style={[styles.textShiYing, { color: yao.isShi ? Colors.yao.moving : Colors.text.secondary }]}>
                                        {yao.isShi ? '世' : '应'}
                                    </Text>
                                ) : null}
                            </View>
                        </View>
                    );
                })}
            </View>

            <View style={styles.guaFooter}>
                <Text style={styles.guaName}>{benGua.name}</Text>
                <Text style={styles.guaFullName}>{benGua.fullName} · {benGua.gong}</Text>
                {bianGua && (
                    <Text style={styles.flipHintText}>点击卡片查看变卦 ⟲</Text>
                )}
            </View>
        </Animated.View>
    );

    const renderBianGua = () => {
        if (!bianGua || !reversedBianYao) return null;
        return (
            <Animated.View style={[styles.guaCard, styles.cardBack, backAnimatedStyle, { backfaceVisibility: 'hidden' as const }]}>
                <View style={styles.cardHeader}>
                    <Text style={styles.cardHeaderText}>变卦</Text>
                </View>

                <View style={styles.yaoList}>
                    {reversedBianYao.map((yao, index) => {
                        const isYang = yao.nature === 'yang';
                        const yaoColor = Colors.yao.yang;

                        return (
                            <View key={yao.position || index} style={styles.yaoRow}>
                                <View style={styles.leftInfoStr}>
                                    <View style={styles.fuShenArea} />
                                    <View style={{ width: 34 }} />
                                    <Text style={[styles.textBase, { color: yaoColor, width: 44 }]}>
                                        {yao.liuQin}{yao.zhi}
                                    </Text>
                                </View>

                                <View style={styles.yaoLinesContainer}>
                                    <YaoSymbol isYang={isYang} color={yaoColor} styles={styles} />
                                </View>

                                <View style={styles.rightInfoStr} />
                            </View>
                        );
                    })}
                </View>

                <View style={styles.guaFooter}>
                    <Text style={styles.guaName}>{bianGua.name}</Text>
                    <Text style={styles.guaFullName}>{bianGua.fullName} · {bianGua.gong}</Text>
                    <Text style={styles.flipHintText}>点击卡片返回本卦 ⟲</Text>
                </View>
            </Animated.View>
        );
    };

    return (
        <View style={styles.container}>
            <TouchableWithoutFeedback onPress={bianGua ? flipCard : undefined}>
                <View style={styles.cardWrapper}>
                    {renderBenGua()}
                    {renderBianGua()}
                </View>
            </TouchableWithoutFeedback>
        </View>
    );
}

export default React.memo(HexagramDisplayComponent, (prevProps, nextProps) => {
    // Only re-render if the core hexagram data changes
    return prevProps.result.benGuaYao === nextProps.result.benGuaYao &&
        prevProps.result.bianGuaYao === nextProps.result.bianGuaYao;
});

const makeStyles = (Colors: any) => StyleSheet.create({
    container: {
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xl,
        alignItems: 'center',
    },
    cardWrapper: {
        width: '100%',
        maxWidth: 400,
        alignItems: 'center',
    },
    guaCard: {
        width: '100%',
        backgroundColor: Colors.bg.card,
        borderRadius: BorderRadius.lg,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.xl,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 5,
    },
    cardBack: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    cardHeader: {
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        paddingHorizontal: Spacing.lg,
        paddingVertical: 4,
        borderRadius: BorderRadius.xl,
        marginBottom: Spacing.xxl,
    },
    cardHeaderText: {
        fontSize: FontSize.xs,
        color: Colors.text.tertiary,
    },
    yaoList: {
        gap: Spacing.xl,
        paddingHorizontal: Spacing.xs,
    },
    yaoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 24,
    },
    leftInfoStr: {
        flexDirection: 'row',
        alignItems: 'center',
        width: 125,
    },
    fuShenArea: {
        width: 45,
        alignItems: 'flex-end',
        paddingRight: Spacing.sm,
    },
    fuShenText: {
        fontSize: FontSize.xs - 2,
        color: Colors.text.tertiary,
    },
    yaoLinesContainer: {
        flex: 1,
        height: '100%',
        paddingHorizontal: Spacing.md,
        justifyContent: 'center',
    },
    rightInfoStr: {
        width: 24,
        alignItems: 'flex-start',
    },
    textBase: {
        fontSize: FontSize.sm + 1,
    },
    textShiYing: {
        fontSize: FontSize.sm + 1,
        fontWeight: 'bold',
    },
    yaoSymbolWrapper: {
        width: '100%',
        height: 10,
        justifyContent: 'center',
    },
    yangLine: {
        width: '100%',
        height: '100%',
        borderRadius: BorderRadius.sm,
    },
    yinLineContainer: {
        width: '100%',
        height: '100%',
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    yinLineHalf: {
        flex: 1,
        height: '100%',
        borderRadius: BorderRadius.sm,
    },
    guaFooter: {
        alignItems: 'center',
        marginTop: 36,
        paddingTop: Spacing.md,
    },
    guaName: {
        fontSize: FontSize.xxxl,
        color: Colors.text.heading,
        fontWeight: 'bold',
    },
    guaFullName: {
        fontSize: FontSize.sm,
        color: Colors.text.secondary,
        marginTop: Spacing.sm,
    },
    flipHintText: {
        fontSize: FontSize.xs,
        color: Colors.accent.gold,
        marginTop: Spacing.lg,
        opacity: 0.8,
    }
});
