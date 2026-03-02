/**
 * 首页 - 起卦方式选择
 */

import React, { useRef, useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView,
    Dimensions, TouchableWithoutFeedback, Modal, TextInput, ActivityIndicator, FlatList
} from 'react-native';
import StatusBarDecor from '../../src/components/StatusBarDecor';
import { router } from 'expo-router';
import { CustomAlert } from '../../src/components/CustomAlertProvider';
import { Spacing, FontSize, BorderRadius } from '../../src/theme/colors';
import {
    ClockIcon, CoinIcon, NumberIcon, HandIcon,
    HistoryIcon, BaGuaIcon, SettingsIcon,
} from '../../src/components/Icons';
import { useTheme } from "../../src/theme/ThemeContext";
import {
    AISettings, getSettings, saveSettings, DEFAULT_SETTINGS, lockAISettings, unlockAISettings
} from '../../src/services/settings';

const { width } = Dimensions.get('window');

interface MethodCardProps {
    title: string;
    description: string;
    icon: React.ReactNode;
    onPress: () => void;
    styles: any;
}

const MethodCard: React.FC<MethodCardProps> = ({ title, description, icon, onPress, styles }) => (
    <TouchableOpacity
        style={styles.methodCard}
        activeOpacity={0.7}
        onPress={onPress}
    >
        <View style={styles.methodIconContainer}>
            {icon}
        </View>
        <View style={styles.methodTextContainer}>
            <Text style={styles.methodTitle}>{title}</Text>
            <Text style={styles.methodDesc}>{description}</Text>
        </View>
    </TouchableOpacity>
);

export default function HomePage() {
    const { Colors } = useTheme();
    const styles = makeStyles(Colors);

    // AI 参数管理抽取
    const [settings, setSettings] = useState<AISettings>(DEFAULT_SETTINGS);
    const [saving, setSaving] = useState(false);

    // 神机阁核心浮层可视化状态
    const [aiModalVisible, setAiModalVisible] = useState(false);

    // Easter egg 彩蛋：连按 7 次解锁 (已迁入神机阁弹窗唤醒)
    const clickCount = useRef(0);
    const lastClickTime = useRef(0);

    // 模型选择器相关状态
    const [models, setModels] = useState<string[]>([]);
    const [fetchingModels, setFetchingModels] = useState(false);
    const [modelListVisible, setModelListVisible] = useState(false);

    useEffect(() => {
        getSettings().then(s => {
            setSettings(s);
        });

        // 页面卸载时自动上锁，实现仅本次解锁（不持久化隐藏门）
        return () => {
            lockAISettings().catch(console.error);
        };
    }, []);

    const handleSaveAISettings = async () => {
        setSaving(true);
        try {
            await saveSettings(settings);
            CustomAlert.alert('保存成功', 'AI 配置已保存');
            setAiModalVisible(false); // 关闭弹窗
        } catch {
            CustomAlert.alert('错误', '保存配置失败');
        } finally {
            setSaving(false);
        }
    };

    const handleResetPrompt = () => {
        CustomAlert.alert('重置提示词', '确认要恢复默认的系统分析指令吗？', [
            { text: '取消', style: 'cancel' },
            {
                text: '确定', onPress: () => {
                    setSettings(prev => ({
                        ...prev,
                        systemPrompt: DEFAULT_SETTINGS.systemPrompt,
                    }));
                },
            },
        ]);
    };

    const fetchModels = async () => {
        if (!settings.apiUrl || !settings.apiKey) {
            CustomAlert.alert('提示', '请先配置 API Key 与接口地址。');
            return;
        }

        setFetchingModels(true);
        try {
            // 将默认的 chat/completions 替换为 models 获取列表
            let url = settings.apiUrl;
            if (url.endsWith('/chat/completions')) {
                url = url.replace('/chat/completions', '/models');
            } else if (url.endsWith('/v1')) {
                url = `${url}/models`;
            } else {
                try {
                    const urlObj = new URL(settings.apiUrl);
                    urlObj.pathname = urlObj.pathname.replace(/\/chat\/completions\/?$/, '/models');
                    url = urlObj.toString();
                } catch {
                    // fall back
                }
            }

            const res = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${settings.apiKey.trim()}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!res.ok) {
                const text = await res.text();
                throw new Error(`连接失败 ${res.status}: ${text}`);
            }

            const data = await res.json();
            if (data && Array.isArray(data.data)) {
                const modelList = data.data.map((m: any) => m.id as string).filter(Boolean);
                if (modelList.length > 0) {
                    modelList.sort();
                    setModels(modelList);
                    setModelListVisible(true);
                } else {
                    CustomAlert.alert('提示', '接口调用成功，但未返回可用的模型列表。');
                }
            } else {
                CustomAlert.alert('提示', '返回数据格式不符合 OpenAI 接口规范，解析失败。');
            }
        } catch (e: any) {
            CustomAlert.alert('获取模型失败', e.message || String(e));
        } finally {
            setFetchingModels(false);
        }
    };

    const handleLogoPress = async () => {
        const now = Date.now();
        if (now - lastClickTime.current > 500) {
            // 如果超过500ms，重置连击
            clickCount.current = 1;
        } else {
            clickCount.current += 1;
        }
        lastClickTime.current = now;

        if (clickCount.current === 7) {
            await unlockAISettings();
            // 直接由弹窗 Alert 置换为弹出神木配置模态框
            setAiModalVisible(true);
            clickCount.current = 0; // 重置
        }
    };

    return (
        <View style={styles.container}>
            <StatusBarDecor />
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Logo 区域 */}
                <TouchableWithoutFeedback onPress={handleLogoPress}>
                    <View style={styles.logoSection}>
                        <BaGuaIcon size={64} color={Colors.accent.gold} />
                        <Text style={styles.appTitle}>见机</Text>
                        <Text style={styles.appSubtitle}>传统易学 · 精准排卦</Text>
                    </View>
                </TouchableWithoutFeedback>

                {/* 起卦方式 */}
                <View style={styles.methodsSection}>
                    <Text style={styles.sectionTitle}>选择起卦方式</Text>

                    <MethodCard
                        title="时间排卦"
                        description="以当前或指定时间起卦，梅花易数"
                        icon={<ClockIcon size={28} />}
                        onPress={() => router.push('/divination/time')}
                        styles={styles}
                    />

                    <MethodCard
                        title="硬币排卦"
                        description="模拟三枚铜钱，六次摇掷"
                        icon={<CoinIcon size={28} />}
                        onPress={() => router.push('/divination/coin')}
                        styles={styles}
                    />

                    <MethodCard
                        title="数字排卦"
                        description="输入数字，心念所至即为卦"
                        icon={<NumberIcon size={28} />}
                        onPress={() => router.push('/divination/number')}
                        styles={styles}
                    />

                    <MethodCard
                        title="手动起卦"
                        description="逐爻选择阴阳，自由组合"
                        icon={<HandIcon size={28} />}
                        onPress={() => router.push('/divination/manual')}
                        styles={styles}
                    />
                </View>



                {/* 底部留白 */}
                <View style={styles.footer}>
                    <Text style={styles.footerText}>心诚则灵</Text>
                </View>
            </ScrollView>

            {/* 神机阁高阶配置主浮层 */}
            <Modal
                visible={aiModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setAiModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.aiModalContent}>
                        <View style={styles.aiModalHeader}>
                            <TouchableOpacity onPress={() => setAiModalVisible(false)} style={styles.modalCloseBtn}>
                                <Text style={styles.modalCloseText}>关闭</Text>
                            </TouchableOpacity>
                            <Text style={styles.aiModalTitle}>AI 接口配置</Text>
                            <TouchableOpacity
                                onPress={handleSaveAISettings}
                                style={styles.modalCloseBtn}
                                disabled={saving}
                            >
                                <Text style={[styles.aiModalSaveText, saving && { opacity: 0.5 }]}>
                                    {saving ? '保存中' : '保存'}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            style={{ flex: 1, paddingHorizontal: Spacing.xl }}
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                        >
                            <Text style={styles.aiModalDesc}>
                                配置 OpenAI 或兼容协议的大模型参数。离开本界面即自动隐藏并锁定。
                            </Text>

                            <View style={styles.fieldGroup}>
                                <Text style={styles.label}>接口地址 (Base URL 或 Chat Endpoint)</Text>
                                <TextInput
                                    style={styles.input}
                                    value={settings.apiUrl}
                                    onChangeText={v => setSettings(prev => ({ ...prev, apiUrl: v }))}
                                    placeholder="https://api.openai.com/v1/chat/completions"
                                    placeholderTextColor={Colors.text.tertiary}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                />
                            </View>

                            <View style={styles.fieldGroup}>
                                <Text style={styles.label}>秘钥 (API Key)</Text>
                                <TextInput
                                    style={styles.input}
                                    value={settings.apiKey}
                                    onChangeText={v => setSettings(prev => ({ ...prev, apiKey: v }))}
                                    placeholder="sk-..."
                                    placeholderTextColor={Colors.text.tertiary}
                                    secureTextEntry
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                />
                            </View>

                            <View style={styles.fieldGroup}>
                                <View style={styles.modelLabelRow}>
                                    <Text style={styles.label}>模型名称</Text>
                                    <TouchableOpacity
                                        onPress={fetchModels}
                                        disabled={fetchingModels}
                                        style={styles.fetchBtn}
                                    >
                                        {fetchingModels ? (
                                            <ActivityIndicator size="small" color={Colors.accent.gold} />
                                        ) : (
                                            <Text style={styles.fetchBtnText}>获取线上模型列表</Text>
                                        )}
                                    </TouchableOpacity>
                                </View>
                                <TextInput
                                    style={styles.input}
                                    value={settings.model}
                                    onChangeText={v => setSettings(prev => ({ ...prev, model: v }))}
                                    placeholder="gpt-4o"
                                    placeholderTextColor={Colors.text.tertiary}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                />
                            </View>

                            {/* 系统提示词 */}
                            <View style={styles.promptSection}>
                                <View style={styles.promptHeader}>
                                    <Text style={styles.label}>系统提示词 (Prompt)</Text>
                                    <TouchableOpacity onPress={handleResetPrompt}>
                                        <Text style={styles.resetText}>恢复默认</Text>
                                    </TouchableOpacity>
                                </View>
                                <TextInput
                                    style={styles.promptInput}
                                    value={settings.systemPrompt}
                                    onChangeText={v => setSettings(prev => ({ ...prev, systemPrompt: v }))}
                                    placeholder="输入六爻测算的系统指令..."
                                    placeholderTextColor={Colors.text.tertiary}
                                    multiline
                                    textAlignVertical="top"
                                />
                            </View>

                            <View style={{ height: 40 }} />
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* 模型列表选择悬浮小窗 */}
            <Modal
                visible={modelListVisible}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setModelListVisible(false)}
            >
                <View style={styles.modalOverlayC}>
                    <View style={styles.modelListContent}>
                        <View style={styles.modelListHeader}>
                            <Text style={styles.aiModalTitle}>选择模型 ({models.length})</Text>
                            <TouchableOpacity onPress={() => setModelListVisible(false)} style={styles.modalCloseBtn}>
                                <Text style={styles.modalCloseText}>取消</Text>
                            </TouchableOpacity>
                        </View>
                        <FlatList
                            data={models}
                            keyExtractor={item => item}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={[
                                        styles.modelItem,
                                        settings.model === item && styles.modelItemActive
                                    ]}
                                    onPress={() => {
                                        setSettings(prev => ({ ...prev, model: item }));
                                        setModelListVisible(false);
                                    }}
                                >
                                    <Text style={[
                                        styles.modelItemText,
                                        settings.model === item && styles.modelItemTextActive
                                    ]}>{item}</Text>
                                </TouchableOpacity>
                            )}
                            ItemSeparatorComponent={() => <View style={styles.separator} />}
                            contentContainerStyle={{ paddingBottom: Spacing.xl }}
                        />
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const makeStyles = (Colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.bg.primary,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 40,
    },
    logoSection: {
        alignItems: 'center',
        paddingTop: 60,
        paddingBottom: 40,
    },
    appTitle: {
        fontSize: FontSize.xxxl,
        color: Colors.text.heading,
        fontWeight: '300',
        marginTop: Spacing.lg,
        letterSpacing: 8,
    },
    appSubtitle: {
        fontSize: FontSize.sm,
        color: Colors.text.tertiary,
        marginTop: Spacing.sm,
        letterSpacing: 4,
    },
    methodsSection: {
        paddingHorizontal: Spacing.xl,
    },
    sectionTitle: {
        fontSize: FontSize.sm,
        color: Colors.text.tertiary,
        marginBottom: Spacing.lg,
        letterSpacing: 2,
    },
    methodCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.bg.card,
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        marginBottom: Spacing.md,
        borderWidth: 0.5,
        borderColor: Colors.border.subtle,
    },
    methodIconContainer: {
        width: 52,
        height: 52,
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.bg.elevated,
        justifyContent: 'center',
        alignItems: 'center',
    },
    methodTextContainer: {
        flex: 1,
        marginLeft: Spacing.lg,
    },
    methodTitle: {
        fontSize: FontSize.lg,
        color: Colors.text.heading,
        fontWeight: '400',
    },
    methodDesc: {
        fontSize: FontSize.xs,
        color: Colors.text.tertiary,
        marginTop: 4,
    },
    bottomLinks: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: Spacing.xxl,
        paddingVertical: Spacing.md,
    },
    bottomButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        paddingHorizontal: Spacing.lg,
    },
    bottomButtonText: {
        fontSize: FontSize.md,
        color: Colors.text.secondary,
    },
    bottomDivider: {
        width: 1,
        height: 16,
        backgroundColor: Colors.border.subtle,
    },
    footer: {
        alignItems: 'center',
        marginTop: Spacing.xxxl,
        paddingBottom: Spacing.xxl,
    },
    footerText: {
        fontSize: FontSize.xs,
        color: Colors.text.tertiary,
        letterSpacing: 6,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-end',
    },
    modalOverlayC: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center'
    },
    aiModalContent: {
        backgroundColor: Colors.bg.primary,
        borderTopLeftRadius: BorderRadius.xl,
        borderTopRightRadius: BorderRadius.xl,
        height: '85%',
        paddingTop: Spacing.md,
    },
    aiModalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: Spacing.lg,
        paddingBottom: Spacing.md,
        borderBottomWidth: 0.5,
        borderColor: Colors.border.subtle,
        marginBottom: Spacing.md
    },
    aiModalTitle: {
        fontSize: FontSize.lg,
        color: Colors.text.heading,
        fontWeight: '500',
    },
    aiModalDesc: {
        fontSize: FontSize.sm, color: Colors.text.tertiary,
        marginBottom: Spacing.xl, lineHeight: 20,
    },
    modalCloseBtn: {
        padding: Spacing.sm,
    },
    modalCloseText: {
        fontSize: FontSize.md,
        color: Colors.text.secondary,
    },
    aiModalSaveText: {
        fontSize: FontSize.md,
        color: Colors.accent.gold,
        fontWeight: 'bold',
    },
    fieldGroup: { marginBottom: Spacing.lg },
    label: {
        fontSize: FontSize.sm, color: Colors.text.secondary,
        marginBottom: Spacing.xs,
        fontWeight: 'bold'
    },
    input: {
        backgroundColor: Colors.bg.card, color: Colors.text.primary,
        fontSize: FontSize.md, padding: Spacing.md,
        borderRadius: BorderRadius.md, borderWidth: 0.5, borderColor: Colors.border.subtle,
    },
    modelLabelRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: Spacing.xs,
    },
    fetchBtn: {
        paddingHorizontal: Spacing.sm, paddingVertical: 5,
        backgroundColor: Colors.bg.elevated,
        borderRadius: BorderRadius.sm,
    },
    fetchBtnText: {
        fontSize: FontSize.xs, color: Colors.accent.gold,
    },
    promptSection: { marginBottom: Spacing.lg },
    promptHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: Spacing.xs,
    },
    resetText: { fontSize: FontSize.sm, color: Colors.accent.red },
    promptInput: {
        backgroundColor: Colors.bg.card, color: Colors.text.primary,
        fontSize: FontSize.sm, padding: Spacing.lg,
        borderRadius: BorderRadius.md, minHeight: 180,
        borderWidth: 0.5, borderColor: Colors.border.subtle,
        lineHeight: 22,
    },
    modelListContent: {
        backgroundColor: Colors.bg.primary,
        borderRadius: BorderRadius.xl,
        width: '80%',
        maxHeight: '60%',
        paddingTop: Spacing.lg,
    },
    modelListHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: Spacing.xl,
        paddingBottom: Spacing.md,
        borderBottomWidth: 0.5,
        borderColor: Colors.border.subtle,
    },
    modelItem: {
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.xl,
    },
    modelItemActive: {
        backgroundColor: Colors.bg.elevated,
    },
    modelItemText: {
        fontSize: FontSize.md,
        color: Colors.text.primary,
    },
    modelItemTextActive: {
        color: Colors.accent.gold,
        fontWeight: 'bold',
    },
    separator: {
        height: 0.5,
        backgroundColor: Colors.border.subtle,
        marginLeft: Spacing.xl,
    }
});
