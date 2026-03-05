import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    View, Text, StyleSheet, Modal, TouchableOpacity, TextInput,
    FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, Keyboard
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { Spacing, FontSize, BorderRadius } from '../theme/colors';
import { BackIcon, SendIcon } from './Icons';
import Markdown from 'react-native-markdown-display';
import { PanResult } from '../core/liuyao-calc';
import { AIChatMessage, buildSystemMessage, analyzeWithAIChatStream, generateQuickReplies } from '../services/ai';
import { CustomAlert } from './CustomAlertProvider';
import { saveRecord } from '../db/database';

interface AIChatModalProps {
    visible: boolean;
    onClose: () => void;
    result: PanResult;
    onUpdateResult: (r: PanResult) => void;
}

interface UIChatMessage extends AIChatMessage {
    uiId: string;
}

let messageSeq = 0;

function generateMessageId(prefix: 'user' | 'assistant' | 'history'): string {
    messageSeq += 1;
    return `${prefix}-${Date.now()}-${messageSeq}`;
}

function hydrateMessages(messages: AIChatMessage[]): UIChatMessage[] {
    return messages.map((message) => ({
        ...message,
        uiId: generateMessageId('history'),
    }));
}

function stripUiMessages(messages: UIChatMessage[]): AIChatMessage[] {
    return messages.map(({ role, content }) => ({ role, content }));
}


export default function AIChatModal({ visible, onClose, result, onUpdateResult }: AIChatModalProps) {
    const { Colors } = useTheme();
    const styles = useMemo(() => makeStyles(Colors), [Colors]);
    const markdownStyles = useMemo(() => makeMarkdownStyles(Colors), [Colors]);
    const insets = useSafeAreaInsets();

    const [messages, setMessages] = useState<UIChatMessage[]>([]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [quickReplies, setQuickReplies] = useState<string[]>([]);
    const flatListRef = useRef<FlatList>(null);
    const isMounted = useRef(true);

    useEffect(() => {
        isMounted.current = true;
        return () => {
            isMounted.current = false;
        };
    }, []);

    // 回显初始化：读取盘中的 aiChatHistory 或是兼容老的 aiAnalysis
    useEffect(() => {
        if (visible && result) {
            // 如果当前正在处理大模型流式输出（即使在后台），避免被旧的历史数据冲刷
            if (isLoading) return;

            let initialMsgs: AIChatMessage[] = [];
            if (result.aiChatHistory && result.aiChatHistory.length > 0) {
                initialMsgs = result.aiChatHistory;
            } else if (result.aiAnalysis) {
                initialMsgs = [{ role: 'assistant', content: result.aiAnalysis }];
            }
            const initialUiMessages = hydrateMessages(initialMsgs);
            setMessages(initialUiMessages);

            // 读取历史存在的快捷药丸
            if (result.quickReplies && result.quickReplies.length > 0) {
                setQuickReplies(result.quickReplies);
            }

            // 如果是空盘且第一次打开这个Modal，则自动发一条测算指令
            if (initialUiMessages.length === 0) {
                handleSend("请帮我全面分析一下此卦！", true);
            }
        } else {
            // 关闭时弹窗隐藏：不做任何暴力清空，让消息气泡和可能的流式继续工作
            setInputText('');
        }
    }, [visible, result.id]);

    const saveAndSync = async (newMessages: UIChatMessage[], newReplies?: string[]) => {
        const persistedMessages = stripUiMessages(newMessages);
        const updatedResult = { ...result, aiChatHistory: persistedMessages };
        if (newReplies) {
            updatedResult.quickReplies = newReplies;
        }
        await saveRecord(updatedResult);
        onUpdateResult(updatedResult);
    };

    const handleSend = async (textOverride?: string, isAutoInitial = false) => {
        const text = (textOverride || inputText).trim();
        if (!text && !isAutoInitial) return;

        Keyboard.dismiss();
        setInputText('');
        setQuickReplies([]);

        const newMessages: UIChatMessage[] = [
            ...messages,
            { role: 'user', content: text, uiId: generateMessageId('user') }
        ];
        setMessages(newMessages);
        setIsLoading(true);

        try {
            const systemMsg = await buildSystemMessage(result);
            // 给发往远端的数据注入 system prompt，但是前端显示的永远只有 user / assistant
            const messagesForAPI = [systemMsg, ...stripUiMessages(newMessages)];

            const streamRes = await analyzeWithAIChatStream(messagesForAPI, (chunkText) => {
                if (!isMounted.current) return;
                setMessages(prev => {
                    const last = prev[prev.length - 1];
                    if (last && last.role === 'assistant') {
                        const updated = [...prev];
                        updated[updated.length - 1] = { ...last, content: last.content + chunkText };
                        return updated;
                    } else {
                        return [...prev, { role: 'assistant', content: chunkText, uiId: generateMessageId('assistant') }];
                    }
                });
            });

            if (!isMounted.current) return;

            if (!streamRes.success) {
                CustomAlert.alert("请求失败", streamRes.error || "发生了未知错误");
                // 移除刚才添加的 user 占位
                setMessages(prev => prev.slice(0, prev.length - 1));
            } else {
                // 流式结束，保存最新对话到 DB。如果存在问题，则单独起一个静默请求去获取 Quick Replies
                setMessages(prev => {
                    const finalMsgs = [...prev];
                    saveAndSync(finalMsgs);

                    if (result.question) {
                        generateQuickReplies(result, stripUiMessages(finalMsgs)).then(replies => {
                            if (!isMounted.current) return;
                            if (replies && replies.length > 0) {
                                setQuickReplies(replies);
                                saveAndSync(finalMsgs, replies);
                            }
                        });
                    }
                    return finalMsgs;
                });
            }
        } catch (error) {
            console.error(error);
            CustomAlert.alert("错误", "连接超时或故障");
        } finally {
            if (isMounted.current) {
                setIsLoading(false);
            }
        }
    };

    const renderMessage = ({ item }: { item: UIChatMessage }) => {
        if (item.role === 'system') return null;

        const isUser = item.role === 'user';
        return (
            <View style={[styles.messageRow, isUser ? styles.messageRowUser : styles.messageRowAssistant]}>
                <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
                    {isUser ? (
                        <Text style={styles.bubbleTextUser}>{item.content}</Text>
                    ) : (
                        <Markdown style={markdownStyles}>
                            {item.content}
                        </Markdown>
                    )}
                </View>
            </View>
        );
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
                        <BackIcon size={24} color={Colors.text.primary} />
                    </TouchableOpacity>
                    {result.question ? (
                        <Text style={styles.headerTitle} numberOfLines={1}>{result.question}</Text>
                    ) : null}
                    <View style={styles.headerBtn} />
                </View>

                <KeyboardAvoidingView
                    style={styles.keyboardView}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                >
                    <FlatList
                        ref={flatListRef}
                        data={messages}
                        keyExtractor={(item) => item.uiId}
                        renderItem={renderMessage}
                        contentContainerStyle={styles.chatContainer}
                        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                        onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
                        showsVerticalScrollIndicator={false}
                    />

                    <View style={styles.inputSection}>
                        {quickReplies.length > 0 && !isLoading && (
                            <FlatList
                                data={quickReplies}
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                keyExtractor={(it, idx) => idx.toString()}
                                style={styles.quickRepliesList}
                                contentContainerStyle={{ paddingHorizontal: Spacing.md }}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        style={styles.quickReplyChip}
                                        onPress={() => handleSend(item)}
                                    >
                                        <Text style={styles.quickReplyText}>{item}</Text>
                                    </TouchableOpacity>
                                )}
                            />
                        )}

                        <View style={styles.inputRow}>
                            <TextInput
                                style={styles.textInput}
                                placeholder="向 AI 追问更多细节..."
                                placeholderTextColor={Colors.text.tertiary}
                                value={inputText}
                                onChangeText={setInputText}
                                multiline
                                maxLength={200}
                                returnKeyType="send"
                                onSubmitEditing={() => handleSend()}
                                editable={!isLoading}
                            />
                            <TouchableOpacity
                                style={[styles.sendBtn, (!inputText.trim() && !isLoading) && { opacity: 0.5 }]}
                                onPress={() => handleSend()}
                                disabled={isLoading || !inputText.trim()}
                            >
                                {isLoading ? (
                                    <ActivityIndicator size="small" color={Colors.text.inverse} />
                                ) : (
                                    <SendIcon size={20} color={Colors.text.inverse} />
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
}

const makeMarkdownStyles = (Colors: any) => ({
    body: {
        fontSize: FontSize.md,
        color: Colors.text.primary,
        lineHeight: 24,
    },
    heading1: { fontSize: FontSize.lg, color: Colors.accent.gold, marginTop: Spacing.md, marginBottom: Spacing.sm, fontWeight: 'bold' as any },
    heading2: { fontSize: FontSize.md, color: Colors.accent.gold, marginTop: Spacing.sm, marginBottom: Spacing.xs, fontWeight: 'bold' as any },
    heading3: { fontSize: FontSize.md, color: Colors.text.heading, marginTop: Spacing.sm, marginBottom: -Spacing.xs, fontWeight: 'bold' as any },
    strong: { fontWeight: 'bold' as any, color: Colors.accent.gold },
    em: { fontStyle: 'italic' as any, color: Colors.text.secondary },
    blockquote: { backgroundColor: 'transparent', borderLeftColor: Colors.border.subtle, borderLeftWidth: 4, paddingLeft: Spacing.md, marginVertical: Spacing.sm },
    paragraph: { marginTop: 0, marginBottom: Spacing.sm }
});

const makeStyles = (Colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.bg.primary,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border.subtle,
    },
    headerBtn: {
        width: 40, height: 40,
        justifyContent: 'center', alignItems: 'center'
    },
    headerTitle: {
        fontSize: FontSize.lg, color: Colors.text.heading, fontWeight: '500'
    },
    keyboardView: {
        flex: 1,
    },
    chatContainer: {
        padding: Spacing.md,
        paddingBottom: Spacing.xl,
    },
    messageRow: {
        flexDirection: 'row',
        marginBottom: Spacing.lg,
    },
    messageRowUser: {
        justifyContent: 'flex-end',
    },
    messageRowAssistant: {
        justifyContent: 'flex-start',
    },
    bubble: {
        maxWidth: '85%',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.lg,
    },
    bubbleUser: {
        backgroundColor: Colors.accent.jade,
        borderBottomRightRadius: 4,
    },
    bubbleAssistant: {
        backgroundColor: Colors.bg.card,
        borderBottomLeftRadius: 4,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
    },
    bubbleTextUser: {
        fontSize: FontSize.md,
        color: Colors.text.inverse,
        lineHeight: 22,
    },
    inputSection: {
        borderTopWidth: 1,
        borderTopColor: Colors.border.subtle,
        backgroundColor: Colors.bg.primary,
        paddingBottom: Platform.OS === 'ios' ? 0 : Spacing.md,
    },
    quickRepliesList: {
        paddingVertical: Spacing.sm,
    },
    quickReplyChip: {
        paddingHorizontal: Spacing.md,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: Colors.bg.elevated,
        borderWidth: 1,
        borderColor: Colors.accent.gold,
        marginRight: Spacing.sm,
    },
    quickReplyText: {
        fontSize: FontSize.sm,
        color: Colors.accent.gold,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        gap: Spacing.sm,
    },
    textInput: {
        flex: 1,
        minHeight: 40,
        maxHeight: 120,
        backgroundColor: Colors.bg.elevated,
        borderRadius: BorderRadius.md,
        paddingHorizontal: Spacing.md,
        paddingTop: 10,
        paddingBottom: 10,
        fontSize: FontSize.md,
        color: Colors.text.primary,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
    },
    sendBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: Colors.accent.gold,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 2,
    }
});
