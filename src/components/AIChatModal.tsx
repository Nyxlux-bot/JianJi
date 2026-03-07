import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import Markdown from 'react-native-markdown-display';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BaziAIConversationStage, PersistedAIChatMessage } from '../core/ai-meta';
import { BaziResult } from '../core/bazi-types';
import { PanResult } from '../core/liuyao-calc';
import { saveRecord } from '../db/database';
import {
    AIRequestOptions,
    analyzeWithAIChatStream,
    BaziWorkflowResponseKind,
    buildBaziFiveYearPrompt,
    buildBaziFollowUpPrompt,
    buildBaziVerificationPrompt,
    buildRequestMessages,
    getBaziFoundationPrompt,
    getBaziConversationStage,
    getChatRequestOptions,
    getLocalBaziFoundationActionLabel,
    getLocalBaziVerificationActions,
    generateBaziConversationDigest,
    generateQuickReplies,
    sanitizeBaziStreamingContent,
    shouldGeneratePostResponseArtifacts,
    stripBaziStageMarkers,
    validateBaziWorkflowResponse,
} from '../services/ai';
import { BaziFormatterContext } from '../services/bazi-formatter';
import { shareChatMarkdown } from '../services/share';
import { BorderRadius, FontSize, Spacing } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { CustomAlert } from './CustomAlertProvider';
import {
    buildRetryPlan,
    getLastAssistantContent,
    shouldShowBaziFoundationRetryAction,
} from './ai-chat-actions';
import { BackIcon, GuaArrowIcon, MoreVerticalIcon, SendIcon } from './Icons';
import OverflowMenu, { OverflowMenuItem } from './OverflowMenu';

interface AIChatModalProps {
    visible: boolean;
    onClose: () => void;
    result: PanResult | BaziResult;
    onUpdateResult: (result: PanResult | BaziResult) => void;
    baziContext?: BaziFormatterContext;
}

interface UIChatMessage extends PersistedAIChatMessage {
    uiId: string;
}

let messageSeq = 0;

function isBaziResult(result: PanResult | BaziResult): result is BaziResult {
    return Array.isArray((result as BaziResult).fourPillars);
}

function generateMessageId(prefix: 'user' | 'assistant' | 'history'): string {
    messageSeq += 1;
    return `${prefix}-${Date.now()}-${messageSeq}`;
}

function hydrateMessages(messages: PersistedAIChatMessage[]): UIChatMessage[] {
    return messages.map((message) => ({
        ...message,
        uiId: generateMessageId('history'),
    }));
}

function toPersistedMessages(messages: UIChatMessage[]): PersistedAIChatMessage[] {
    return messages.map(({ role, content, hidden, requestContent }) => ({
        role,
        content,
        hidden,
        requestContent,
    }));
}

function replaceLastAssistantContent(messages: UIChatMessage[], content: string): UIChatMessage[] {
    const cloned = [...messages];
    for (let index = cloned.length - 1; index >= 0; index -= 1) {
        if (cloned[index].role === 'assistant') {
            cloned[index] = { ...cloned[index], content };
            return cloned;
        }
    }
    return cloned;
}

function trimTrailingHiddenUsers(messages: UIChatMessage[]): UIChatMessage[] {
    const trimmed = [...messages];
    while (trimmed.length > 0) {
        const last = trimmed[trimmed.length - 1];
        if (last.role === 'user' && last.hidden) {
            trimmed.pop();
            continue;
        }
        break;
    }
    return trimmed;
}

function trimWorkflowMessages(messages: UIChatMessage[], expectedAssistantCount: number): UIChatMessage[] {
    let visibleAssistantCount = messages.filter((message) => message.role === 'assistant' && !message.hidden).length;
    if (visibleAssistantCount <= expectedAssistantCount) {
        return messages;
    }

    for (let index = messages.length - 1; index >= 0; index -= 1) {
        const message = messages[index];
        if (message.role === 'assistant' && !message.hidden) {
            visibleAssistantCount -= 1;
            if (visibleAssistantCount === expectedAssistantCount) {
                return trimTrailingHiddenUsers(messages.slice(0, index));
            }
        }
    }

    return messages;
}

function withRewrittenLastUserMessage(messages: UIChatMessage[], rewrittenContent: string): UIChatMessage[] {
    const cloned = [...messages];
    for (let index = cloned.length - 1; index >= 0; index -= 1) {
        if (cloned[index].role === 'user') {
            cloned[index] = { ...cloned[index], content: rewrittenContent };
            return cloned;
        }
    }
    return cloned;
}

function buildHeaderMeta(result: PanResult | BaziResult): { title: string; subtitle: string } {
    if (isBaziResult(result)) {
        const title = result.subject.name?.trim() || `${result.subject.mingZaoLabel}AI 解盘`;
        const subtitle = result.fourPillars.join(' ');
        return { title, subtitle };
    }

    return {
        title: result.benGua.fullName,
        subtitle: result.bianGua?.fullName || '无变卦',
    };
}

function buildWorkflowNotice(
    stage: BaziAIConversationStage | null,
    isLoading: boolean,
): { title: string; body: string; tone: 'neutral' | 'accent' | 'ready' } | null {
    if (!stage) {
        return null;
    }

    if (stage === 'foundation_pending') {
        return {
            title: isLoading ? '正在生成基础定局' : '基础定局尚未完成',
            body: isLoading
                ? '系统当前只会输出基础定局；没有拿到阶段完成标记前，不会进入前事核验。'
                : '基础定局还未完整结束。你可以重试基础定局，但此时不会开放前事核验或后续追问。',
            tone: 'neutral',
        };
    }

    if (stage === 'foundation_ready') {
        return {
            title: '基础定局已完成',
            body: '现在才能开始前事核验。点击下方按钮后，系统会单独输出过去关键节点供你核对。',
            tone: 'accent',
        };
    }

    if (stage === 'verification_ready') {
        return {
            title: '前事核验已完成',
            body: '请核对上方过去经历是否准确。若较准，继续进入未来五年解盘；若偏差，重新校验会从基础定局整轮重开。',
            tone: 'accent',
        };
    }

    return {
        title: '未来五年解盘已完成',
        body: '后续追问会自动继承基础定局、前事核验与未来五年走势的上下文，不会从头丢失前文。',
        tone: 'ready',
    };
}

export default function AIChatModal({ visible, onClose, result, onUpdateResult, baziContext }: AIChatModalProps) {
    const { Colors } = useTheme();
    const styles = useMemo(() => makeStyles(Colors), [Colors]);
    const markdownStyles = useMemo(() => makeMarkdownStyles(Colors), [Colors]);
    const insets = useSafeAreaInsets();
    const flatListRef = useRef<FlatList>(null);
    const isMounted = useRef(true);
    const latestResultRef = useRef<PanResult | BaziResult>(result);
    const latestBaziContextRef = useRef<BaziFormatterContext | undefined>(baziContext);
    const latestMessagesRef = useRef<UIChatMessage[]>([]);

    const [messages, setMessages] = useState<UIChatMessage[]>([]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [quickReplies, setQuickReplies] = useState<string[]>([]);
    const [menuVisible, setMenuVisible] = useState(false);
    const [hasFoundationAttempted, setHasFoundationAttempted] = useState(false);
    const [baziStage, setBaziStage] = useState<BaziAIConversationStage | null>(
        isBaziResult(result) ? getBaziConversationStage(result) : null,
    );

    const baziMode = isBaziResult(result);
    const headerMeta = buildHeaderMeta(result);
    const workflowNotice = useMemo(
        () => buildWorkflowNotice(baziStage, isLoading),
        [baziStage, isLoading],
    );

    useEffect(() => {
        isMounted.current = true;
        return () => {
            isMounted.current = false;
        };
    }, []);

    useEffect(() => {
        latestResultRef.current = result;
        latestBaziContextRef.current = baziContext;
        setBaziStage(isBaziResult(result) ? getBaziConversationStage(result) : null);
    }, [result, baziContext]);

    useEffect(() => {
        latestMessagesRef.current = messages;
    }, [messages]);

    useEffect(() => {
        if (!visible) {
            setMenuVisible(false);
            setHasFoundationAttempted(false);
        }
    }, [visible]);

    useEffect(() => {
        setHasFoundationAttempted(false);
    }, [result.id]);

    useEffect(() => {
        if (visible) {
            if (isLoading) {
                return;
            }

            let initialMessages: PersistedAIChatMessage[] = [];
            if (result.aiChatHistory && result.aiChatHistory.length > 0) {
                initialMessages = result.aiChatHistory;
            } else if (result.aiAnalysis) {
                initialMessages = [{ role: 'assistant', content: result.aiAnalysis }];
            }

            const hydrated = hydrateMessages(initialMessages);
            setMessages(hydrated);
            latestMessagesRef.current = hydrated;
            setQuickReplies(
                baziMode && getBaziConversationStage(result) !== 'followup_ready'
                    ? []
                    : (result.quickReplies && result.quickReplies.length > 0 ? result.quickReplies : []),
            );

            if (hydrated.length === 0) {
                void handleSend(
                    baziMode ? getBaziFoundationPrompt() : '请帮我全面分析一下此卦！',
                    {
                        isAutoInitial: true,
                        hiddenUser: baziMode,
                        expectedBaziCompletion: baziMode ? 'foundation' : undefined,
                        nextBaziStage: baziMode ? 'foundation_ready' : undefined,
                    },
                );
            }
        } else {
            setInputText('');
        }
    }, [visible, result.id]);

    const saveAndSync = async (
        nextMessages: UIChatMessage[],
        overrides: {
            quickReplies?: string[];
            aiConversationDigest?: BaziResult['aiConversationDigest'] | null;
            aiConversationStage?: BaziAIConversationStage | null;
            aiVerificationSummary?: string | null;
        } = {},
    ): Promise<PanResult | BaziResult> => {
        const persistedMessages = toPersistedMessages(nextMessages);
        const baseResult = latestResultRef.current;
        const lastAssistant = getLastAssistantContent(nextMessages) || undefined;
        const hasDigestOverride = Object.prototype.hasOwnProperty.call(overrides, 'aiConversationDigest');
        const hasStageOverride = Object.prototype.hasOwnProperty.call(overrides, 'aiConversationStage');
        const hasVerificationOverride = Object.prototype.hasOwnProperty.call(overrides, 'aiVerificationSummary');

        const updatedResult: PanResult | BaziResult = isBaziResult(baseResult)
            ? {
                ...baseResult,
                aiAnalysis: lastAssistant,
                aiChatHistory: persistedMessages,
                quickReplies: overrides.quickReplies ?? baseResult.quickReplies ?? [],
                aiConversationDigest: hasDigestOverride ? (overrides.aiConversationDigest ?? undefined) : baseResult.aiConversationDigest,
                aiConversationStage: hasStageOverride ? (overrides.aiConversationStage ?? undefined) : baseResult.aiConversationStage,
                aiVerificationSummary: hasVerificationOverride ? (overrides.aiVerificationSummary ?? undefined) : baseResult.aiVerificationSummary,
            }
            : {
                ...baseResult,
                aiAnalysis: lastAssistant,
                aiChatHistory: persistedMessages,
                quickReplies: overrides.quickReplies ?? baseResult.quickReplies ?? [],
            };

        await saveRecord({
            engineType: isBaziResult(updatedResult) ? 'bazi' : 'liuyao',
            result: updatedResult,
        });

        latestResultRef.current = updatedResult;
        latestMessagesRef.current = nextMessages;
        if (isBaziResult(updatedResult)) {
            setBaziStage(getBaziConversationStage(updatedResult));
        }
        onUpdateResult(updatedResult);
        return updatedResult;
    };

    const refreshArtifacts = async (finalMessages: UIChatMessage[]) => {
        const persisted = toPersistedMessages(finalMessages);
        const latest = latestResultRef.current;

        const quickReplyPromise = generateQuickReplies(latest, persisted);
        const digestPromise = isBaziResult(latest)
            ? generateBaziConversationDigest(latest, persisted)
            : Promise.resolve(null);

        const [generatedReplies, generatedDigest] = await Promise.all([quickReplyPromise, digestPromise]);
        if (!isMounted.current) {
            return;
        }

        const quickReplyResult = generatedReplies && generatedReplies.length > 0 ? generatedReplies : [];
        setQuickReplies(quickReplyResult);

        await saveAndSync(finalMessages, {
            quickReplies: quickReplyResult,
            aiConversationDigest: isBaziResult(latestResultRef.current)
                ? generatedDigest ?? latestResultRef.current.aiConversationDigest
                : undefined,
            aiConversationStage: isBaziResult(latestResultRef.current)
                ? getBaziConversationStage(latestResultRef.current)
                : undefined,
        });
    };

    const handleSend = async (
        textOverride?: string,
        options: {
            isAutoInitial?: boolean;
            baseMessagesOverride?: UIChatMessage[];
            hiddenUser?: boolean;
            isQuickReply?: boolean;
            requestTextOverride?: string;
            nextBaziStage?: BaziAIConversationStage;
            expectedBaziCompletion?: BaziWorkflowResponseKind;
        } = {},
    ) => {
        const text = (textOverride || inputText).trim();
        if (!text && !options.isAutoInitial) {
            return;
        }

        const rewrittenText = options.requestTextOverride
            ?? (baziMode && options.isQuickReply
                ? buildBaziFollowUpPrompt(text)
                : null);

        const baseMessages = options.baseMessagesOverride || messages;
        const requestOptions: AIRequestOptions = getChatRequestOptions(
            latestResultRef.current,
            options.isAutoInitial ? 'initial' : 'followup',
        );
        const phase = options.isAutoInitial ? 'initial' : 'followup';
        const currentBaziStage = baziMode ? getBaziConversationStage(latestResultRef.current as BaziResult) : null;
        const nextMessages: UIChatMessage[] = [
            ...baseMessages,
            {
                role: 'user',
                content: text,
                hidden: options.hiddenUser,
                requestContent: rewrittenText && rewrittenText !== text ? rewrittenText : undefined,
                uiId: generateMessageId('user'),
            },
        ];

        Keyboard.dismiss();
        setInputText('');
        setQuickReplies([]);
        setMessages(nextMessages);
        latestMessagesRef.current = nextMessages;
        setIsLoading(true);

        try {
            const streamRequest = async (requestHistory: PersistedAIChatMessage[]) => {
                let rawAssistantText = '';
                const messagesForAPI = await buildRequestMessages(
                    latestResultRef.current,
                    requestHistory,
                    latestBaziContextRef.current,
                );

                return analyzeWithAIChatStream(
                    messagesForAPI,
                    (chunkText) => {
                        if (!isMounted.current) {
                            return;
                        }
                        rawAssistantText += chunkText;
                        const assistantContent = baziMode
                            ? sanitizeBaziStreamingContent(rawAssistantText)
                            : rawAssistantText;
                        setMessages((prev) => {
                            const last = prev[prev.length - 1];
                            const updated = last && last.role === 'assistant'
                                ? [...prev.slice(0, -1), { ...last, content: assistantContent }]
                                : [...prev, { role: 'assistant' as const, content: assistantContent, uiId: generateMessageId('assistant') }];
                            latestMessagesRef.current = updated;
                            return updated;
                        });
                    },
                    undefined,
                    requestOptions,
                );
            };

            const requestSourceMessages = rewrittenText
                ? withRewrittenLastUserMessage(nextMessages, rewrittenText)
                : nextMessages;
            if (baziMode && options.expectedBaziCompletion === 'foundation') {
                setHasFoundationAttempted(true);
            }
            let streamRes = await streamRequest(toPersistedMessages(requestSourceMessages));

            if (!isMounted.current) {
                return;
            }

            if (!streamRes.success) {
                CustomAlert.alert('请求失败', streamRes.error || '发生了未知错误');
                setMessages(baseMessages);
                latestMessagesRef.current = baseMessages;
            } else {
                let finalMessages = latestMessagesRef.current;
                const rawAssistantContent = streamRes.content || '';
                let stageSuccess = true;

                if (baziMode) {
                    const cleanContent = stripBaziStageMarkers(rawAssistantContent);
                    finalMessages = replaceLastAssistantContent(finalMessages, cleanContent);
                    setMessages(finalMessages);
                    latestMessagesRef.current = finalMessages;
                }

                if (baziMode && options.expectedBaziCompletion) {
                    const validation = validateBaziWorkflowResponse(
                        options.expectedBaziCompletion,
                        rawAssistantContent,
                        latestResultRef.current as BaziResult,
                    );
                    stageSuccess = validation.success;
                    finalMessages = replaceLastAssistantContent(finalMessages, validation.cleanContent);
                    setMessages(finalMessages);
                    latestMessagesRef.current = finalMessages;

                    if (!validation.success) {
                        CustomAlert.alert(
                            '阶段未完成',
                            `本阶段未完整结束，请重试本阶段。${validation.issues.join('；')}`,
                        );
                    }
                }

                const nextStage = baziMode
                    ? (stageSuccess
                        ? (options.nextBaziStage ?? currentBaziStage ?? 'foundation_pending')
                        : (currentBaziStage ?? 'foundation_pending'))
                    : undefined;
                const verificationSummary = baziMode
                    ? (stageSuccess && nextStage === 'verification_ready'
                        ? (getLastAssistantContent(finalMessages) || '')
                        : (isBaziResult(latestResultRef.current)
                            ? latestResultRef.current.aiVerificationSummary
                            : undefined))
                    : undefined;
                const digestOverride = baziMode && nextStage !== 'followup_ready'
                    ? null
                    : (baziMode && isBaziResult(latestResultRef.current)
                        ? latestResultRef.current.aiConversationDigest
                        : undefined);

                if (stageSuccess && shouldGeneratePostResponseArtifacts(latestResultRef.current, nextStage ?? phase)) {
                    await saveAndSync(finalMessages, {
                        quickReplies: [],
                        aiConversationDigest: digestOverride,
                        aiConversationStage: nextStage,
                        aiVerificationSummary: verificationSummary,
                    });
                    void refreshArtifacts(finalMessages);
                } else {
                    setQuickReplies([]);
                    await saveAndSync(finalMessages, {
                        quickReplies: [],
                        aiConversationDigest: digestOverride,
                        aiConversationStage: nextStage,
                        aiVerificationSummary: verificationSummary,
                    });
                }
            }
        } catch (error) {
            console.error(error);
            CustomAlert.alert('错误', '连接超时或故障');
            setMessages(baseMessages);
            latestMessagesRef.current = baseMessages;
        } finally {
            if (isMounted.current) {
                setIsLoading(false);
            }
        }
    };

    const handleCopyLatestAssistant = async () => {
        const assistantText = getLastAssistantContent(messages);
        if (!assistantText) {
            CustomAlert.alert('暂无可复制内容', '当前没有助手回复可复制。');
            return;
        }
        await Clipboard.setStringAsync(assistantText);
        CustomAlert.alert('复制成功', '已复制最后一条助手回复。');
    };

    const handleRetryLastQuestion = async () => {
        const retryPlan = buildRetryPlan(messages);
        if (!retryPlan) {
            CustomAlert.alert('无法重试', '当前会话中没有可重试的问题。');
            return;
        }
        setMessages(retryPlan.baseMessages);
        latestMessagesRef.current = retryPlan.baseMessages;
        setQuickReplies([]);
        await handleSend(retryPlan.displayText, {
            baseMessagesOverride: retryPlan.baseMessages,
            requestTextOverride: retryPlan.retryText !== retryPlan.displayText ? retryPlan.retryText : undefined,
        });
    };

    const restartBaziWorkflow = async () => {
        if (!baziMode) {
            return;
        }

        const emptyMessages: UIChatMessage[] = [];
        setMessages(emptyMessages);
        latestMessagesRef.current = emptyMessages;
        setQuickReplies([]);
        setBaziStage('foundation_pending');

        await saveAndSync(emptyMessages, {
            quickReplies: [],
            aiConversationDigest: null,
            aiConversationStage: 'foundation_pending',
            aiVerificationSummary: null,
        });

        await handleSend(getBaziFoundationPrompt(), {
            isAutoInitial: true,
            baseMessagesOverride: emptyMessages,
            hiddenUser: true,
            expectedBaziCompletion: 'foundation',
            nextBaziStage: 'foundation_ready',
        });
    };

    const handleStartVerification = async () => {
        if (!baziMode) {
            return;
        }

        await handleSend(buildBaziVerificationPrompt(), {
            baseMessagesOverride: trimWorkflowMessages(messages, 1),
            hiddenUser: true,
            requestTextOverride: buildBaziVerificationPrompt(),
            expectedBaziCompletion: 'verification',
            nextBaziStage: 'verification_ready',
        });
    };

    const handleVerificationConfirmed = async () => {
        if (!baziMode || !isBaziResult(latestResultRef.current)) {
            return;
        }

        const prompt = buildBaziFiveYearPrompt(latestResultRef.current);
        await handleSend(prompt, {
            baseMessagesOverride: trimWorkflowMessages(messages, 2),
            hiddenUser: true,
            requestTextOverride: prompt,
            expectedBaziCompletion: 'five_year',
            nextBaziStage: 'followup_ready',
        });
    };

    const handleExportChat = async () => {
        try {
            await shareChatMarkdown(result, toPersistedMessages(messages));
        } catch (error: any) {
            const message = typeof error?.message === 'string' ? error.message : '导出失败，请稍后重试';
            CustomAlert.alert('导出失败', message);
        }
    };

    const handleClose = () => {
        setMenuVisible(false);
        onClose();
    };

    const menuItems: OverflowMenuItem[] = [
        { key: 'copy', label: '复制回复', onPress: handleCopyLatestAssistant, disabled: isLoading },
        { key: 'retry', label: '重试上一问', onPress: handleRetryLastQuestion, disabled: isLoading || (baziMode && baziStage !== 'followup_ready') },
        { key: 'export', label: '导出会话', onPress: handleExportChat, disabled: isLoading },
    ];
    const showFoundationAction = baziMode
        && baziStage === 'foundation_ready'
        && !isLoading;
    const showVerificationActions = baziMode
        && baziStage === 'verification_ready'
        && !isLoading
        && Boolean(getLastAssistantContent(messages));
    const showInitialResetAction = shouldShowBaziFoundationRetryAction(
        baziStage,
        isLoading,
        messages.length,
        hasFoundationAttempted,
    );
    const inputLocked = baziMode && baziStage !== 'followup_ready';

    const renderMessage = ({ item }: { item: UIChatMessage }) => {
        if (item.role === 'system' || item.hidden) {
            return null;
        }

        const isUser = item.role === 'user';
        return (
            <View style={[styles.messageRow, isUser ? styles.messageRowUser : styles.messageRowAssistant]}>
                <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
                    {isUser ? (
                        <Text style={styles.bubbleTextUser}>{item.content}</Text>
                    ) : (
                        <Markdown style={markdownStyles}>{item.content}</Markdown>
                    )}
                </View>
            </View>
        );
    };

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
            <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={handleClose} style={styles.headerBtn}>
                        <BackIcon size={24} color={Colors.text.primary} />
                    </TouchableOpacity>
                    <View style={styles.headerTitleWrap}>
                        {baziMode ? (
                            <>
                                <Text style={styles.headerPrimaryTitle} numberOfLines={1}>
                                    {headerMeta.title}
                                </Text>
                                <Text style={styles.headerSecondaryTitle} numberOfLines={1}>
                                    {headerMeta.subtitle}
                                </Text>
                            </>
                        ) : (
                            <View style={styles.hexagramHeaderRow}>
                                <Text style={styles.headerGuaName} numberOfLines={1}>
                                    {headerMeta.title}
                                </Text>
                                <GuaArrowIcon size={16} color={Colors.accent.gold} />
                                <Text style={styles.headerGuaName} numberOfLines={1}>
                                    {headerMeta.subtitle}
                                </Text>
                            </View>
                        )}
                    </View>
                    <TouchableOpacity onPress={() => setMenuVisible((prev) => !prev)} style={styles.headerBtn}>
                        <MoreVerticalIcon size={20} color={Colors.text.primary} />
                    </TouchableOpacity>
                </View>
                <OverflowMenu
                    visible={menuVisible}
                    top={insets.top + 54}
                    right={Spacing.lg}
                    items={menuItems}
                    onClose={() => setMenuVisible(false)}
                />

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
                        {baziMode && workflowNotice ? (
                            <View
                                style={[
                                    styles.workflowCard,
                                    workflowNotice.tone === 'accent'
                                        ? styles.workflowCardAccent
                                        : (workflowNotice.tone === 'ready' ? styles.workflowCardReady : null),
                                ]}
                            >
                                <Text style={styles.workflowCardTitle}>{workflowNotice.title}</Text>
                                <Text style={styles.workflowCardBody}>{workflowNotice.body}</Text>
                                {showInitialResetAction ? (
                                    <TouchableOpacity
                                        style={styles.workflowCardActionBtn}
                                        onPress={() => {
                                            void restartBaziWorkflow();
                                        }}
                                    >
                                        <Text style={styles.workflowCardActionText}>重试基础定局</Text>
                                    </TouchableOpacity>
                                ) : null}
                            </View>
                        ) : null}

                        {showFoundationAction ? (
                            <View style={styles.verificationActionsWrap}>
                                <TouchableOpacity
                                    style={[styles.verificationActionBtn, styles.verificationActionPrimary]}
                                    onPress={() => {
                                        void handleStartVerification();
                                    }}
                                >
                                    <Text style={[styles.verificationActionText, styles.verificationActionPrimaryText]}>
                                        {getLocalBaziFoundationActionLabel()}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        ) : showVerificationActions ? (
                            <View style={styles.verificationActionsWrap}>
                                {getLocalBaziVerificationActions().map((label) => (
                                    <TouchableOpacity
                                        key={label}
                                        style={[
                                            styles.verificationActionBtn,
                                            label.includes('继续') ? styles.verificationActionPrimary : styles.verificationActionSecondary,
                                        ]}
                                        onPress={() => {
                                            if (label.includes('继续')) {
                                                void handleVerificationConfirmed();
                                                return;
                                            }

                                            void restartBaziWorkflow();
                                        }}
                                    >
                                        <Text
                                            style={[
                                                styles.verificationActionText,
                                                label.includes('继续') ? styles.verificationActionPrimaryText : styles.verificationActionSecondaryText,
                                            ]}
                                        >
                                            {label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        ) : quickReplies.length > 0 && !isLoading && (!baziMode || baziStage === 'followup_ready') && (
                            <FlatList
                                data={quickReplies}
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                keyExtractor={(item, index) => `${item}-${index}`}
                                style={styles.quickRepliesList}
                                contentContainerStyle={{ paddingHorizontal: Spacing.md }}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        style={styles.quickReplyChip}
                                        onPress={() => handleSend(item, { isQuickReply: baziMode })}
                                    >
                                        <Text style={styles.quickReplyText}>{item}</Text>
                                    </TouchableOpacity>
                                )}
                            />
                        )}

                        <View style={styles.inputRow}>
                            <TextInput
                                style={styles.textInput}
                                placeholder={baziMode
                                    ? (baziStage === 'foundation_pending'
                                        ? '基础定局完成前，暂不开放追问...'
                                        : (baziStage === 'foundation_ready'
                                            ? '点击“开始前事核验”后再继续...'
                                            : (baziStage === 'verification_ready'
                                                ? '先确认前事核验，再进入未来五年...'
                                                : '继续细问未来五年里的财运、婚恋或事业...')))
                                    : '向 AI 追问更多细节...'}
                                placeholderTextColor={Colors.text.tertiary}
                                value={inputText}
                                onChangeText={setInputText}
                                multiline
                                maxLength={240}
                                returnKeyType="send"
                                onSubmitEditing={() => handleSend()}
                                editable={!isLoading && !inputLocked}
                            />
                            <TouchableOpacity
                                style={[styles.sendBtn, (!inputText.trim() || inputLocked) && !isLoading ? { opacity: 0.5 } : null]}
                                onPress={() => handleSend()}
                                disabled={isLoading || !inputText.trim() || inputLocked}
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
    paragraph: { marginTop: 0, marginBottom: Spacing.sm },
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
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitleWrap: {
        flex: 1,
        justifyContent: 'center',
        marginHorizontal: Spacing.sm,
    },
    hexagramHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.xs,
    },
    headerPrimaryTitle: {
        fontSize: FontSize.md,
        color: Colors.text.heading,
        fontWeight: '600',
        textAlign: 'center',
    },
    headerSecondaryTitle: {
        fontSize: FontSize.sm,
        color: Colors.text.secondary,
        marginTop: 2,
        textAlign: 'center',
    },
    headerGuaName: {
        maxWidth: '42%',
        fontSize: FontSize.md,
        color: Colors.text.heading,
        fontWeight: '500',
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
    workflowCard: {
        marginHorizontal: Spacing.md,
        marginTop: Spacing.sm,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.bg.card,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
        gap: Spacing.xs,
    },
    workflowCardAccent: {
        borderColor: Colors.accent.gold,
        backgroundColor: Colors.bg.elevated,
    },
    workflowCardReady: {
        borderColor: Colors.accent.jade,
        backgroundColor: Colors.bg.elevated,
    },
    workflowCardTitle: {
        fontSize: FontSize.md,
        fontWeight: '600',
        color: Colors.text.heading,
    },
    workflowCardBody: {
        fontSize: FontSize.sm,
        lineHeight: 20,
        color: Colors.text.secondary,
    },
    workflowCardActionBtn: {
        minHeight: 44,
        marginTop: Spacing.xs,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.accent.gold,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
    },
    workflowCardActionText: {
        fontSize: FontSize.sm,
        fontWeight: '600',
        color: Colors.accent.gold,
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
    verificationActionsWrap: {
        paddingHorizontal: Spacing.md,
        paddingTop: Spacing.sm,
        gap: Spacing.sm,
    },
    verificationActionBtn: {
        minHeight: 44,
        borderRadius: BorderRadius.md,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        justifyContent: 'center',
        borderWidth: 1,
    },
    verificationActionPrimary: {
        backgroundColor: Colors.accent.gold,
        borderColor: Colors.accent.gold,
    },
    verificationActionSecondary: {
        backgroundColor: Colors.bg.elevated,
        borderColor: Colors.border.subtle,
    },
    verificationActionText: {
        fontSize: FontSize.md,
        textAlign: 'center',
        fontWeight: '600',
    },
    verificationActionPrimaryText: {
        color: Colors.text.inverse,
    },
    verificationActionSecondaryText: {
        color: Colors.text.primary,
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
    },
});
