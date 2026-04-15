import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    InteractionManager,
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
import { BaziFormatterContext, cloneBaziFormatterContext } from '../core/bazi-ai-context';
import { AIConversationStage, PersistedAIChatMessage } from '../core/ai-meta';
import { BaziResult } from '../core/bazi-types';
import { PanResult } from '../core/liuyao-calc';
import { saveRecord } from '../db/database';
import { ZiweiFormatterContext } from '../features/ziwei/ai-context';
import {
    buildZiweiAIConfigSignature,
    isZiweiAIConfigStale,
    ZiweiRecordResult,
} from '../features/ziwei/record';
import {
    AIRequestDebugMeta,
    AIWorkflowResponseKind,
    AIRequestOptions,
    analyzeWithAIChatStream,
    buildBaziFiveYearPrompt,
    buildBaziFollowUpPrompt,
    buildBaziVerificationPrompt,
    buildRequestBundle,
    BaziVerificationAction,
    buildZiweiFiveYearPrompt,
    buildZiweiFollowUpPrompt,
    buildZiweiVerificationPrompt,
    getBaziConversationStage,
    getBaziFoundationPrompt,
    getChatRequestOptions,
    getLocalBaziFoundationActionLabel,
    getLocalBaziVerificationActions,
    generateBaziConversationDigest,
    generateQuickReplies,
    generateZiweiConversationDigest,
    sanitizeBaziStreamingContent,
    sanitizeZiweiStreamingContent,
    stripThinkingBlocks,
    shouldGeneratePostResponseArtifacts,
    stripBaziStageMarkers,
    stripZiweiStageMarkers,
    validateBaziWorkflowResponse,
    validateZiweiWorkflowResponse,
    getZiweiConversationStage,
    getZiweiFoundationPrompt,
    getLocalZiweiFoundationActionLabel,
    getLocalZiweiVerificationActions,
    type AIFailureInfo,
} from '../services/ai';
import { shareChatMarkdown } from '../services/share';
import { BorderRadius, FontSize, Spacing } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { CustomAlert } from './CustomAlertProvider';
import { ChatPresentationState, shouldAutoStartInitialAnalysis } from './ai-chat-lifecycle';
import {
    buildBaziVerificationRetryPlan,
    buildRetryPlan,
    getLastAssistantContent,
    shouldRollbackFailedWorkflowResponse,
    shouldShowBaziFoundationRetryAction,
    trimWorkflowMessages,
} from './ai-chat-actions';
import { BackIcon, GuaArrowIcon, MoreVerticalIcon, SendIcon } from './Icons';
import OverflowMenu, { OverflowMenuItem } from './OverflowMenu';

interface AIChatModalProps {
    visible: boolean;
    onClose: () => void;
    result: PanResult | BaziResult | ZiweiRecordResult;
    onUpdateResult: (result: PanResult | BaziResult | ZiweiRecordResult) => void;
    baziContext?: BaziFormatterContext;
    ziweiContext?: ZiweiFormatterContext;
}

interface UIChatMessage extends PersistedAIChatMessage {
    uiId: string;
    pending?: boolean;
}

let messageSeq = 0;

function isBaziResult(result: PanResult | BaziResult | ZiweiRecordResult): result is BaziResult {
    return Array.isArray((result as BaziResult).fourPillars);
}

function isZiweiResult(result: PanResult | BaziResult | ZiweiRecordResult): result is ZiweiRecordResult {
    const candidate = result as Partial<ZiweiRecordResult>;
    return typeof candidate.birthLocal === 'string'
        && typeof candidate.trueSolarDateTimeLocal === 'string'
        && typeof candidate.fiveElementsClass === 'string'
        && typeof candidate.soul === 'string'
        && typeof candidate.body === 'string';
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
            cloned[index] = { ...cloned[index], content, pending: false };
            return cloned;
        }
    }
    return cloned;
}

function upsertStreamingAssistantContent(messages: UIChatMessage[], content: string): UIChatMessage[] {
    const cloned = [...messages];
    for (let index = cloned.length - 1; index >= 0; index -= 1) {
        if (cloned[index].role === 'assistant') {
            cloned[index] = { ...cloned[index], content, pending: false };
            return cloned;
        }
    }

    return [
        ...messages,
        {
            role: 'assistant',
            content,
            pending: false,
            uiId: generateMessageId('assistant'),
        },
    ];
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

function buildHeaderMeta(result: PanResult | BaziResult | ZiweiRecordResult): { title: string; subtitle: string } {
    if (isBaziResult(result)) {
        const title = result.subject.name?.trim() || `${result.subject.mingZaoLabel}AI 解盘`;
        const subtitle = result.fourPillars.join(' ');
        return { title, subtitle };
    }

    if (isZiweiResult(result)) {
        return {
            title: result.name?.trim() || '紫微命盘',
            subtitle: `${result.fiveElementsClass} · 命主${result.soul} / 身主${result.body}`,
        };
    }

    return {
        title: result.benGua.fullName,
        subtitle: result.bianGua?.fullName || '无变卦',
    };
}

function resolveRequestWorkflowStage(
    mode: 'liuyao' | 'bazi' | 'ziwei',
    options: {
        isAutoInitial?: boolean;
        expectedCompletion?: AIWorkflowResponseKind;
    },
): 'foundation' | 'verification' | 'five_year' | 'followup' | undefined {
    if (mode === 'liuyao') {
        return undefined;
    }

    if (options.expectedCompletion) {
        return options.expectedCompletion;
    }

    return options.isAutoInitial ? 'foundation' : 'followup';
}

function formatRequestEvidenceNotice(meta: AIRequestDebugMeta | null): string | null {
    if (!meta || meta.mode !== 'ziwei') {
        return null;
    }

    const parts = [
        meta.workflowStage ? `阶段 ${meta.workflowStage}` : '',
        meta.scopeLabel ? `当前 ${meta.scopeLabel}` : '',
        meta.focusPalaceName ? `焦点 ${meta.focusPalaceName}` : '',
        meta.yearWindow ? `六年包 ${meta.yearWindow}` : '',
        meta.compatibilityMode ? '兼容模式' : '增强证据',
    ].filter(Boolean);

    return parts.length > 0 ? `本轮依据：${parts.join(' · ')}` : null;
}

function buildZiweiStaleNotice(isStale: boolean): { title: string; body: string } | null {
    if (!isStale) {
        return null;
    }

    return {
        title: 'AI 分析已失效',
        body: '当前 AI 结论基于旧排盘口径，旧内容仍可查看，但不能继续沿用。请按当前配置重新开始 AI 分析。',
    };
}

function logAIClientFailure(scope: string, failure?: AIFailureInfo | null): void {
    if (!failure) {
        return;
    }

    console.warn('[AIChatModal]', scope, JSON.stringify(failure));
}

function formatAIFailureMessage(failure?: Pick<AIFailureInfo, 'code' | 'message' | 'usedFallback'> | null): string {
    if (!failure) {
        return 'AI 请求失败，请稍后重试。';
    }

    if (failure.usedFallback) {
        return `${failure.message}，已自动回退到本地默认结果。`;
    }

    switch (failure.code) {
        case 'missing_api_key':
        case 'missing_api_url':
            return failure.message;
        case 'timeout':
            return 'AI 请求超时，请稍后重试。';
        case 'network_error':
            return 'AI 请求中断，请检查网络或接口服务后重试。';
        case 'http_error':
            return failure.message;
        case 'invalid_response':
            return 'AI 返回格式无效，请重试。';
        case 'aborted':
            return 'AI 请求已取消。';
        default:
            return failure.message || 'AI 请求失败，请稍后重试。';
    }
}

function buildWorkflowNotice(
    mode: 'bazi' | 'ziwei' | 'liuyao',
    stage: AIConversationStage | null,
    isLoading: boolean,
): { title: string; body: string; tone: 'neutral' | 'accent' | 'ready' } | null {
    if (!stage || mode === 'liuyao') {
        return null;
    }

    const foundationLabel = mode === 'ziwei' ? '基础命盘分析' : '基础定局';
    const futureLabel = mode === 'ziwei' ? '今年与未来五年解析' : '未来五年解盘';

    if (stage === 'foundation_pending') {
        return {
            title: isLoading ? `正在生成${foundationLabel}` : `${foundationLabel}尚未完成`,
            body: isLoading
                ? `系统当前只会输出${foundationLabel}；没有拿到阶段完成标记前，不会进入前事核验。`
                : `${foundationLabel}还未完整结束。你可以重试当前阶段，但此时不会开放前事核验或后续追问。`,
            tone: 'neutral',
        };
    }

    if (stage === 'foundation_ready') {
        return {
            title: `${foundationLabel}已完成`,
            body: '现在才能开始前事核验。点击下方按钮后，系统会单独输出过去关键节点供你核对。',
            tone: 'accent',
        };
    }

    if (stage === 'verification_ready') {
        return {
            title: '前事核验已完成',
            body: '请核对上方过去经历是否准确。若较准，继续进入未来五年解盘；若偏差，重新校验会保留基础定局并重新生成前事核验。',
            tone: 'accent',
        };
    }

    return {
        title: `${futureLabel}已完成`,
        body: `后续追问会自动继承${foundationLabel}、前事核验与未来阶段主线的上下文，不会从头丢失前文。`,
        tone: 'ready',
    };
}

function buildPendingAssistantMessage(
    mode: 'liuyao' | 'bazi' | 'ziwei',
    options: {
        isAutoInitial?: boolean;
        expectedCompletion?: AIWorkflowResponseKind;
    } = {},
): UIChatMessage {
    const content = options.expectedCompletion === 'foundation'
        ? (mode === 'ziwei'
            ? '正在读取命盘并生成基础命盘分析...\n可先返回命盘页继续查看，分析会在后台继续。'
            : (mode === 'bazi'
                ? '正在读取四柱并生成基础定局...\n可先返回结果页继续查看，分析会在后台继续。'
                : '正在生成首轮分析...\n可先关闭弹窗，分析会在后台继续。'))
        : options.expectedCompletion === 'verification'
            ? '正在生成前事核验...\n可先关闭弹窗，分析会在后台继续。'
            : options.expectedCompletion === 'five_year'
                ? (mode === 'ziwei'
                    ? '正在展开今年与未来五年解析...\n可先返回命盘页继续查看，分析会在后台继续。'
                    : '正在展开未来五年分析...\n可先关闭弹窗，分析会在后台继续。')
                : (options.isAutoInitial
                    ? '正在准备 AI 分析...\n可先关闭弹窗，分析会在后台继续。'
                    : '正在连接 AI 并整理回复...\n可先关闭弹窗，分析会在后台继续。');

    return {
        role: 'assistant',
        content,
        pending: true,
        uiId: generateMessageId('assistant'),
    };
}

export default function AIChatModal({ visible, onClose, result, onUpdateResult, baziContext, ziweiContext }: AIChatModalProps) {
    const { Colors } = useTheme();
    const styles = useMemo(() => makeStyles(Colors), [Colors]);
    const markdownStyles = useMemo(() => makeMarkdownStyles(Colors), [Colors]);
    const insets = useSafeAreaInsets();
    const flatListRef = useRef<FlatList>(null);
    const isMounted = useRef(true);
    const latestResultRef = useRef<PanResult | BaziResult | ZiweiRecordResult>(result);
    const latestBaziContextRef = useRef<BaziFormatterContext | undefined>(baziContext);
    const latestZiweiContextRef = useRef<ZiweiFormatterContext | undefined>(ziweiContext);
    const latestMessagesRef = useRef<UIChatMessage[]>([]);
    const visibleRef = useRef(visible);
    const loadingRef = useRef(false);
    const modalShownRef = useRef(false);
    const autoStartPendingRef = useRef(false);
    const autoStartTaskRef = useRef<ReturnType<typeof InteractionManager.runAfterInteractions> | null>(null);
    const activeAbortControllerRef = useRef<AbortController | null>(null);
    const activeRequestSeqRef = useRef(0);

    const [messages, setMessages] = useState<UIChatMessage[]>([]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [quickReplies, setQuickReplies] = useState<string[]>([]);
    const [artifactNotice, setArtifactNotice] = useState<string | null>(null);
    const [requestDebugMeta, setRequestDebugMeta] = useState<AIRequestDebugMeta | null>(null);
    const [menuVisible, setMenuVisible] = useState(false);
    const [hasFoundationAttempted, setHasFoundationAttempted] = useState(false);
    const [presentationState, setPresentationState] = useState<ChatPresentationState>('idle');
    const workflowMode: 'liuyao' | 'bazi' | 'ziwei' = isBaziResult(result)
        ? 'bazi'
        : (isZiweiResult(result) ? 'ziwei' : 'liuyao');
    const stagedMode = workflowMode !== 'liuyao';
    const isAnalyzingPhase = presentationState === 'preparing_request' || presentationState === 'streaming';
    const ziweiAnalysisStale = workflowMode === 'ziwei'
        && isZiweiResult(result)
        && isZiweiAIConfigStale(result);
    const [workflowStage, setWorkflowStage] = useState<AIConversationStage | null>(
        workflowMode === 'bazi'
            ? getBaziConversationStage(result as BaziResult)
            : (workflowMode === 'ziwei' ? getZiweiConversationStage(result as ZiweiRecordResult) : null),
    );
    const headerMeta = buildHeaderMeta(result);
    const workflowNotice = useMemo(
        () => buildWorkflowNotice(workflowMode, workflowStage, isAnalyzingPhase),
        [isAnalyzingPhase, workflowMode, workflowStage],
    );
    const ziweiStaleNotice = useMemo(
        () => buildZiweiStaleNotice(ziweiAnalysisStale),
        [ziweiAnalysisStale],
    );

    const cancelScheduledAutoStart = () => {
        autoStartTaskRef.current?.cancel();
        autoStartTaskRef.current = null;
    };

    const invalidateActiveRequest = () => {
        activeRequestSeqRef.current += 1;
        const controller = activeAbortControllerRef.current;
        activeAbortControllerRef.current = null;
        if (controller) {
            controller.abort();
        }
    };

    useEffect(() => {
        isMounted.current = true;
        return () => {
            cancelScheduledAutoStart();
            invalidateActiveRequest();
            isMounted.current = false;
        };
    }, []);

    useEffect(() => {
        visibleRef.current = visible;
    }, [visible]);

    useEffect(() => {
        loadingRef.current = isLoading;
    }, [isLoading]);

    useEffect(() => {
        latestResultRef.current = result;
        latestBaziContextRef.current = baziContext;
        latestZiweiContextRef.current = ziweiContext;
        setWorkflowStage(
            isBaziResult(result)
                ? getBaziConversationStage(result)
                : (isZiweiResult(result) ? getZiweiConversationStage(result) : null),
        );
    }, [result, baziContext, ziweiContext]);

    useEffect(() => {
        latestMessagesRef.current = messages;
    }, [messages]);

    useEffect(() => {
        if (!visible) {
            cancelScheduledAutoStart();
            invalidateActiveRequest();
            modalShownRef.current = false;
            autoStartPendingRef.current = false;
            setIsLoading(false);
            setMenuVisible(false);
            setHasFoundationAttempted(false);
            setPresentationState('idle');
            setRequestDebugMeta(null);
        }
    }, [visible]);

    useEffect(() => {
        setHasFoundationAttempted(false);
    }, [result.id]);

    useEffect(() => {
        if (visible) {
            let initialMessages: PersistedAIChatMessage[] = [];
            if (result.aiChatHistory && result.aiChatHistory.length > 0) {
                initialMessages = result.aiChatHistory;
            } else if (result.aiAnalysis) {
                initialMessages = [{ role: 'assistant', content: result.aiAnalysis }];
            }

            const hydrated = hydrateMessages(initialMessages);
            setMessages(hydrated);
            latestMessagesRef.current = hydrated;
            autoStartPendingRef.current = hydrated.length === 0;
            modalShownRef.current = false;
            setPresentationState('presenting');
            setRequestDebugMeta(null);
            setQuickReplies(
                stagedMode && workflowMode === 'bazi' && getBaziConversationStage(result as BaziResult) !== 'followup_ready'
                    ? []
                    : stagedMode && workflowMode === 'ziwei' && getZiweiConversationStage(result as ZiweiRecordResult) !== 'followup_ready'
                        ? []
                        : ziweiAnalysisStale
                            ? []
                            : (result.quickReplies && result.quickReplies.length > 0 ? result.quickReplies : []),
            );
        } else {
            setInputText('');
        }
    }, [visible, result.id, stagedMode, workflowMode, result, ziweiAnalysisStale]);

    const saveAndSync = async (
        nextMessages: UIChatMessage[],
        overrides: {
            quickReplies?: string[];
            aiConversationDigest?: BaziResult['aiConversationDigest'] | ZiweiRecordResult['aiConversationDigest'] | null;
            aiConversationStage?: AIConversationStage | null;
            aiVerificationSummary?: string | null;
            aiContextSnapshot?: BaziResult['aiContextSnapshot'] | null;
            aiConfigSignature?: string | null;
            aiInvalidatedAt?: string | null;
        } = {},
    ): Promise<PanResult | BaziResult | ZiweiRecordResult> => {
        const persistedMessages = toPersistedMessages(nextMessages);
        const baseResult = latestResultRef.current;
        const lastAssistant = getLastAssistantContent(nextMessages) || undefined;
        const hasDigestOverride = Object.prototype.hasOwnProperty.call(overrides, 'aiConversationDigest');
        const hasStageOverride = Object.prototype.hasOwnProperty.call(overrides, 'aiConversationStage');
        const hasVerificationOverride = Object.prototype.hasOwnProperty.call(overrides, 'aiVerificationSummary');
        const hasContextSnapshotOverride = Object.prototype.hasOwnProperty.call(overrides, 'aiContextSnapshot');
        const hasConfigSignatureOverride = Object.prototype.hasOwnProperty.call(overrides, 'aiConfigSignature');
        const hasInvalidatedAtOverride = Object.prototype.hasOwnProperty.call(overrides, 'aiInvalidatedAt');
        const shouldRefreshZiweiAISignature = persistedMessages.length > 0
            || Boolean(lastAssistant)
            || hasDigestOverride
            || hasStageOverride
            || hasVerificationOverride;

        const updatedResult: PanResult | BaziResult | ZiweiRecordResult = isBaziResult(baseResult)
            ? {
                ...baseResult,
                aiAnalysis: lastAssistant,
                aiChatHistory: persistedMessages,
                quickReplies: overrides.quickReplies ?? baseResult.quickReplies ?? [],
                aiConversationDigest: hasDigestOverride
                    ? ((overrides.aiConversationDigest as BaziResult['aiConversationDigest'] | null | undefined) ?? undefined)
                    : baseResult.aiConversationDigest,
                aiConversationStage: hasStageOverride ? (overrides.aiConversationStage ?? undefined) : baseResult.aiConversationStage,
                aiVerificationSummary: hasVerificationOverride ? (overrides.aiVerificationSummary ?? undefined) : baseResult.aiVerificationSummary,
                aiContextSnapshot: hasContextSnapshotOverride ? (overrides.aiContextSnapshot ?? undefined) : baseResult.aiContextSnapshot,
            }
            : isZiweiResult(baseResult)
                ? {
                    ...baseResult,
                    aiAnalysis: lastAssistant,
                    aiChatHistory: persistedMessages,
                    quickReplies: overrides.quickReplies ?? baseResult.quickReplies ?? [],
                    aiConversationDigest: hasDigestOverride
                        ? ((overrides.aiConversationDigest as ZiweiRecordResult['aiConversationDigest'] | null | undefined) ?? undefined)
                        : baseResult.aiConversationDigest,
                    aiConversationStage: hasStageOverride ? (overrides.aiConversationStage ?? undefined) : baseResult.aiConversationStage,
                    aiVerificationSummary: hasVerificationOverride ? (overrides.aiVerificationSummary ?? undefined) : baseResult.aiVerificationSummary,
                    aiConfigSignature: hasConfigSignatureOverride
                        ? (overrides.aiConfigSignature ?? undefined)
                        : (shouldRefreshZiweiAISignature ? buildZiweiAIConfigSignature(baseResult.config) : baseResult.aiConfigSignature),
                    aiInvalidatedAt: hasInvalidatedAtOverride
                        ? (overrides.aiInvalidatedAt ?? undefined)
                        : (shouldRefreshZiweiAISignature ? undefined : baseResult.aiInvalidatedAt),
                }
                : {
                    ...baseResult,
                    aiAnalysis: lastAssistant,
                    aiChatHistory: persistedMessages,
                    quickReplies: overrides.quickReplies ?? baseResult.quickReplies ?? [],
                };

        await saveRecord({
            engineType: isBaziResult(updatedResult) ? 'bazi' : (isZiweiResult(updatedResult) ? 'ziwei' : 'liuyao'),
            result: updatedResult,
        });

        latestResultRef.current = updatedResult;
        latestMessagesRef.current = nextMessages;
        if (isBaziResult(updatedResult)) {
            setWorkflowStage(getBaziConversationStage(updatedResult));
        } else if (isZiweiResult(updatedResult)) {
            setWorkflowStage(getZiweiConversationStage(updatedResult));
        }
        onUpdateResult(updatedResult);
        return updatedResult;
    };

    const ensureBaziContextSnapshot = async (): Promise<BaziFormatterContext | undefined> => {
        if (workflowMode !== 'bazi' || !isBaziResult(latestResultRef.current)) {
            return undefined;
        }

        const currentResult = latestResultRef.current;
        if (currentResult.aiContextSnapshot) {
            return currentResult.aiContextSnapshot;
        }

        const snapshot = cloneBaziFormatterContext(latestBaziContextRef.current);
        if (!snapshot) {
            return undefined;
        }

        const updatedResult: BaziResult = {
            ...currentResult,
            aiContextSnapshot: snapshot,
        };

        await saveRecord({
            engineType: 'bazi',
            result: updatedResult,
        });

        latestResultRef.current = updatedResult;
        if (isMounted.current) {
            setWorkflowStage(getBaziConversationStage(updatedResult));
        }
        onUpdateResult(updatedResult);
        return snapshot;
    };

    const refreshArtifacts = async (finalMessages: UIChatMessage[]) => {
        const persisted = toPersistedMessages(finalMessages);
        const latest = latestResultRef.current;

        const quickReplyPromise = generateQuickReplies(latest, persisted);
        const digestPromise = isBaziResult(latest)
            ? generateBaziConversationDigest(latest, persisted)
            : (isZiweiResult(latest)
                ? generateZiweiConversationDigest(latest, persisted)
                : Promise.resolve({ value: null, failure: undefined }));

        const [quickReplyOutcome, digestOutcome] = await Promise.all([quickReplyPromise, digestPromise]);
        if (!isMounted.current) {
            return;
        }

        logAIClientFailure('quick_replies', quickReplyOutcome.failure);
        logAIClientFailure('conversation_digest', digestOutcome.failure);

        const quickReplyResult = quickReplyOutcome.value && quickReplyOutcome.value.length > 0 ? quickReplyOutcome.value : [];
        setArtifactNotice(quickReplyOutcome.failure?.usedFallback ? formatAIFailureMessage(quickReplyOutcome.failure) : null);
        setQuickReplies(quickReplyResult);

        await saveAndSync(finalMessages, {
            quickReplies: quickReplyResult,
            aiConversationDigest: isBaziResult(latestResultRef.current)
                ? digestOutcome.value ?? latestResultRef.current.aiConversationDigest
                : isZiweiResult(latestResultRef.current)
                    ? digestOutcome.value ?? latestResultRef.current.aiConversationDigest
                    : undefined,
            aiConversationStage: isBaziResult(latestResultRef.current)
                ? getBaziConversationStage(latestResultRef.current)
                : isZiweiResult(latestResultRef.current)
                    ? getZiweiConversationStage(latestResultRef.current)
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
            nextWorkflowStage?: AIConversationStage;
            expectedCompletion?: AIWorkflowResponseKind;
        } = {},
    ) => {
        const text = (textOverride || inputText).trim();
        if (!text && !options.isAutoInitial) {
            return;
        }

        cancelScheduledAutoStart();
        autoStartPendingRef.current = false;
        invalidateActiveRequest();
        const requestId = activeRequestSeqRef.current;
        const abortController = new AbortController();
        activeAbortControllerRef.current = abortController;

        const rewrittenText = options.requestTextOverride
            ?? (
                workflowMode === 'bazi' && options.isQuickReply
                    ? buildBaziFollowUpPrompt(text)
                    : (workflowMode === 'ziwei' && options.isQuickReply
                        ? buildZiweiFollowUpPrompt(text)
                        : null)
            );

        const baseMessages = options.baseMessagesOverride || messages;
        const phase = options.isAutoInitial ? 'initial' : 'followup';
        const requestOptions: AIRequestOptions = {
            ...getChatRequestOptions(
                latestResultRef.current,
                phase,
            ),
            stage: workflowMode === 'liuyao'
                ? phase
                : `${workflowMode}_${options.expectedCompletion ?? phase}`,
        };
        const currentWorkflowStage = workflowMode === 'bazi'
            ? getBaziConversationStage(latestResultRef.current as BaziResult)
            : (workflowMode === 'ziwei'
                ? getZiweiConversationStage(latestResultRef.current as ZiweiRecordResult)
                : null);
        const requestWorkflowStage = resolveRequestWorkflowStage(workflowMode, options);
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
        const uiMessages: UIChatMessage[] = [
            ...baseMessages,
            nextMessages[nextMessages.length - 1],
            buildPendingAssistantMessage(workflowMode, {
                isAutoInitial: options.isAutoInitial,
                expectedCompletion: options.expectedCompletion,
            }),
        ];

        Keyboard.dismiss();
        setInputText('');
        setQuickReplies([]);
        setArtifactNotice(null);
        if (workflowMode !== 'ziwei') {
            setRequestDebugMeta(null);
        }
        if (stagedMode && options.expectedCompletion === 'foundation') {
            setWorkflowStage('foundation_pending');
            setHasFoundationAttempted(true);
        }
        setPresentationState('preparing_request');
        setMessages(uiMessages);
        latestMessagesRef.current = uiMessages;
        setIsLoading(true);

        try {
            const lockedBaziContext = workflowMode === 'bazi' ? await ensureBaziContextSnapshot() : undefined;
            const streamRequest = async (requestHistory: PersistedAIChatMessage[]) => {
                let rawAssistantText = '';
                let hasReceivedChunk = false;
                const requestBundle = await buildRequestBundle(
                    latestResultRef.current,
                    requestHistory,
                    workflowMode === 'bazi'
                        ? (lockedBaziContext ?? latestBaziContextRef.current)
                        : (workflowMode === 'ziwei' ? latestZiweiContextRef.current : undefined),
                    {
                        workflowStage: requestWorkflowStage,
                    },
                );
                const messagesForAPI = requestBundle.messages;
                requestOptions.debugMeta = requestBundle.debugMeta;
                if (workflowMode === 'ziwei') {
                    setRequestDebugMeta(requestBundle.debugMeta || null);
                }

                if (requestId !== activeRequestSeqRef.current || abortController.signal.aborted) {
                    return {
                        success: false,
                        error: 'ABORTED',
                        code: 'aborted' as const,
                        stage: requestOptions.stage || 'stream',
                        recoverable: true,
                        usedFallback: false,
                    };
                }

                return analyzeWithAIChatStream(
                    messagesForAPI,
                    (chunkText) => {
                        if (!isMounted.current || requestId !== activeRequestSeqRef.current) {
                            return;
                        }
                        rawAssistantText += chunkText;
                        if (!hasReceivedChunk) {
                            hasReceivedChunk = true;
                            setPresentationState('streaming');
                        }
                        const assistantContent = workflowMode === 'bazi'
                            ? sanitizeBaziStreamingContent(rawAssistantText)
                            : (workflowMode === 'ziwei'
                                ? sanitizeZiweiStreamingContent(rawAssistantText)
                                : stripThinkingBlocks(rawAssistantText).trim());
                        setMessages((prev) => {
                            const updated = upsertStreamingAssistantContent(prev, assistantContent);
                            latestMessagesRef.current = updated;
                            return updated;
                        });
                    },
                    abortController.signal,
                    requestOptions,
                );
            };

            const requestSourceMessages = rewrittenText
                ? withRewrittenLastUserMessage(nextMessages, rewrittenText)
                : nextMessages;
            let streamRes = await streamRequest(toPersistedMessages(requestSourceMessages));

            if (!isMounted.current || requestId !== activeRequestSeqRef.current) {
                return;
            }

            if (!streamRes.success) {
                logAIClientFailure('stream_request', streamRes.code
                    ? {
                        code: streamRes.code,
                        stage: streamRes.stage || requestOptions.stage || 'stream',
                        recoverable: streamRes.recoverable ?? true,
                        usedFallback: streamRes.usedFallback ?? false,
                        message: streamRes.error || 'AI 请求失败',
                    }
                    : null);
                if (streamRes.error !== 'ABORTED') {
                    CustomAlert.alert('AI 请求失败', formatAIFailureMessage(streamRes.code ? {
                        code: streamRes.code,
                        message: streamRes.error || 'AI 请求失败',
                        usedFallback: streamRes.usedFallback ?? false,
                    } : null));
                }
                setMessages(baseMessages);
                latestMessagesRef.current = baseMessages;
            } else {
                let finalMessages = latestMessagesRef.current;
                const rawAssistantContent = streamRes.content || '';
                let stageSuccess = true;

                if (stagedMode) {
                    const cleanContent = workflowMode === 'bazi'
                        ? stripBaziStageMarkers(rawAssistantContent)
                        : stripZiweiStageMarkers(rawAssistantContent);
                    if (getLastAssistantContent(finalMessages) !== cleanContent) {
                        finalMessages = replaceLastAssistantContent(finalMessages, cleanContent);
                        setMessages(finalMessages);
                        latestMessagesRef.current = finalMessages;
                    }
                }

                if (stagedMode && options.expectedCompletion) {
                    const validation = workflowMode === 'bazi'
                        ? validateBaziWorkflowResponse(
                            options.expectedCompletion as 'foundation' | 'verification' | 'five_year',
                            rawAssistantContent,
                        )
                        : validateZiweiWorkflowResponse(
                            options.expectedCompletion as 'foundation' | 'verification' | 'five_year',
                            rawAssistantContent,
                        );
                    stageSuccess = validation.success;
                    const shouldRollbackFailedStage = shouldRollbackFailedWorkflowResponse(
                        workflowMode,
                        options.expectedCompletion as 'foundation' | 'verification' | 'five_year',
                        stageSuccess,
                    );
                    if (getLastAssistantContent(finalMessages) !== validation.cleanContent) {
                        finalMessages = replaceLastAssistantContent(finalMessages, validation.cleanContent);
                        setMessages(finalMessages);
                        latestMessagesRef.current = finalMessages;
                    }

                    if (!validation.success) {
                        if (workflowMode === 'ziwei' && (options.expectedCompletion === 'verification' || options.expectedCompletion === 'five_year')) {
                            const ziweiValidation = validation as ReturnType<typeof validateZiweiWorkflowResponse>;
                            console.warn('[AIChatModal] Ziwei staged validation failed', {
                                expectedCompletion: options.expectedCompletion,
                                marker: ziweiValidation.marker,
                                hasExpectedMarker: ziweiValidation.marker === options.expectedCompletion,
                                issues: ziweiValidation.issues,
                                parsedYearBuckets: ziweiValidation.debug?.parsedYearBuckets || [],
                                parsedVerificationBlockCount: ziweiValidation.debug?.parsedVerificationBlockCount || 0,
                                parsedVerificationHeaders: ziweiValidation.debug?.parsedVerificationHeaders || [],
                            });
                        }
                        if (shouldRollbackFailedStage) {
                            finalMessages = baseMessages;
                            setMessages(baseMessages);
                            latestMessagesRef.current = baseMessages;
                        }
                        const failedStageLabel = options.expectedCompletion === 'verification'
                            ? '前事核验阶段'
                            : (options.expectedCompletion === 'five_year' ? '未来五年阶段' : '当前阶段');
                        CustomAlert.alert(
                            '阶段未完成',
                            shouldRollbackFailedStage
                                ? `已生成内容未通过结构校验，未写入会话，请重试${failedStageLabel}。${validation.issues.join('；')}`
                                : `本阶段未完整结束，请重试本阶段。${validation.issues.join('；')}`,
                        );
                    }
                }

                const nextStage = stagedMode
                    ? (stageSuccess
                        ? (options.nextWorkflowStage ?? currentWorkflowStage ?? 'foundation_pending')
                        : (currentWorkflowStage ?? 'foundation_pending'))
                    : undefined;
                const verificationSummary = stagedMode
                    ? (stageSuccess && nextStage === 'verification_ready'
                        ? (getLastAssistantContent(finalMessages) || '')
                        : (isBaziResult(latestResultRef.current) || isZiweiResult(latestResultRef.current)
                            ? latestResultRef.current.aiVerificationSummary
                            : undefined))
                    : undefined;
                const digestOverride = stagedMode && nextStage !== 'followup_ready'
                    ? null
                    : ((isBaziResult(latestResultRef.current) || isZiweiResult(latestResultRef.current))
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
            if (requestId === activeRequestSeqRef.current) {
                CustomAlert.alert('AI 请求失败', 'AI 请求在本地处理时发生异常，请稍后重试。');
                setMessages(baseMessages);
                latestMessagesRef.current = baseMessages;
            }
        } finally {
            if (requestId === activeRequestSeqRef.current) {
                activeAbortControllerRef.current = null;
            }
            if (isMounted.current && requestId === activeRequestSeqRef.current) {
                setIsLoading(false);
                setPresentationState('presenting');
            }
        }
    };

    const handleModalShow = () => {
        modalShownRef.current = true;
        if (!shouldAutoStartInitialAnalysis({
            visible: visibleRef.current,
            modalShown: modalShownRef.current,
            autoStartPending: autoStartPendingRef.current,
            isLoading: loadingRef.current,
            messageCount: latestMessagesRef.current.length,
        })) {
            return;
        }

        autoStartPendingRef.current = false;
        setPresentationState('preparing_request');
        cancelScheduledAutoStart();
        autoStartTaskRef.current = InteractionManager.runAfterInteractions(() => {
            autoStartTaskRef.current = null;
            if (!visibleRef.current || !modalShownRef.current || loadingRef.current || latestMessagesRef.current.length > 0) {
                return;
            }

            void handleSend(
                workflowMode === 'bazi'
                    ? getBaziFoundationPrompt()
                    : (workflowMode === 'ziwei' ? getZiweiFoundationPrompt() : '请帮我全面分析一下此卦！'),
                {
                    isAutoInitial: true,
                    hiddenUser: stagedMode,
                    expectedCompletion: stagedMode ? 'foundation' : undefined,
                    nextWorkflowStage: stagedMode ? 'foundation_ready' : undefined,
                },
            );
        });
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
        if (!stagedMode) {
            return;
        }

        const emptyMessages: UIChatMessage[] = [];
        setMessages(emptyMessages);
        latestMessagesRef.current = emptyMessages;
        setQuickReplies([]);
        setWorkflowStage('foundation_pending');

        await saveAndSync(emptyMessages, {
            quickReplies: [],
            aiConversationDigest: null,
            aiConversationStage: 'foundation_pending',
            aiVerificationSummary: null,
            aiConfigSignature: workflowMode === 'ziwei' && isZiweiResult(latestResultRef.current)
                ? buildZiweiAIConfigSignature(latestResultRef.current.config)
                : undefined,
            aiInvalidatedAt: workflowMode === 'ziwei' ? null : undefined,
        });

        await handleSend(workflowMode === 'bazi' ? getBaziFoundationPrompt() : getZiweiFoundationPrompt(), {
            isAutoInitial: true,
            baseMessagesOverride: emptyMessages,
            hiddenUser: true,
            expectedCompletion: 'foundation',
            nextWorkflowStage: 'foundation_ready',
        });
    };

    const handleStartVerification = async (baseMessagesOverride: UIChatMessage[] = trimWorkflowMessages(messages, 1)) => {
        if (!stagedMode) {
            return;
        }

        const prompt = workflowMode === 'bazi' ? buildBaziVerificationPrompt() : buildZiweiVerificationPrompt();
        await handleSend(prompt, {
            baseMessagesOverride,
            hiddenUser: true,
            requestTextOverride: prompt,
            expectedCompletion: 'verification',
            nextWorkflowStage: 'verification_ready',
        });
    };

    const handleRestartVerification = async () => {
        if (!stagedMode) {
            return;
        }

        const verificationPrompt = workflowMode === 'bazi' ? buildBaziVerificationPrompt() : buildZiweiVerificationPrompt();
        const retryPlan = buildBaziVerificationRetryPlan(messages, verificationPrompt);
        if (!retryPlan) {
            CustomAlert.alert('无法重新校验', '当前没有可替换的前事核验内容。');
            return;
        }

        setMessages(retryPlan.baseMessages);
        latestMessagesRef.current = retryPlan.baseMessages;
        setQuickReplies([]);
        setWorkflowStage('foundation_ready');

        await saveAndSync(retryPlan.baseMessages, {
            quickReplies: [],
            aiConversationDigest: null,
            aiConversationStage: 'foundation_ready',
            aiVerificationSummary: null,
        });

        await handleStartVerification(retryPlan.baseMessages);
    };

    const handleVerificationConfirmed = async () => {
        if (!stagedMode) {
            return;
        }

        const prompt = isBaziResult(latestResultRef.current)
            ? buildBaziFiveYearPrompt()
            : (isZiweiResult(latestResultRef.current)
                ? buildZiweiFiveYearPrompt(latestResultRef.current)
                : '');
        if (!prompt) {
            return;
        }
        await handleSend(prompt, {
            baseMessagesOverride: trimWorkflowMessages(messages, 2),
            hiddenUser: true,
            requestTextOverride: prompt,
            expectedCompletion: 'five_year',
            nextWorkflowStage: 'followup_ready',
        });
    };

    const handleVerificationActionPress = (action: BaziVerificationAction) => {
        if (action.id === 'continue') {
            void handleVerificationConfirmed();
            return;
        }

        void handleRestartVerification();
    };

    const handleExportChat = async () => {
        try {
            await shareChatMarkdown(latestResultRef.current, toPersistedMessages(messages));
        } catch (error: any) {
            const message = typeof error?.message === 'string' ? error.message : '导出失败，请稍后重试';
            CustomAlert.alert('导出失败', message);
        }
    };

    const handleClose = () => {
        cancelScheduledAutoStart();
        invalidateActiveRequest();
        setIsLoading(false);
        setMenuVisible(false);
        onClose();
    };

    const menuItems: OverflowMenuItem[] = [
        { key: 'copy', label: '复制回复', onPress: handleCopyLatestAssistant, disabled: isLoading },
        { key: 'retry', label: '重试上一问', onPress: handleRetryLastQuestion, disabled: isLoading || ziweiAnalysisStale || (stagedMode && workflowStage !== 'followup_ready') },
        { key: 'export', label: '导出会话', onPress: handleExportChat, disabled: isLoading },
    ];
    const showFoundationAction = stagedMode
        && !ziweiAnalysisStale
        && workflowStage === 'foundation_ready'
        && !isLoading;
    const showVerificationActions = stagedMode
        && !ziweiAnalysisStale
        && workflowStage === 'verification_ready'
        && !isLoading
        && Boolean(getLastAssistantContent(messages));
    const showInitialResetAction = shouldShowBaziFoundationRetryAction(
        workflowStage,
        isLoading,
        messages.length,
        hasFoundationAttempted,
    ) && !ziweiAnalysisStale;
    const inputLocked = (stagedMode && workflowStage !== 'followup_ready') || ziweiAnalysisStale;

    const renderMessage = ({ item }: { item: UIChatMessage }) => {
        if (item.role === 'system' || item.hidden) {
            return null;
        }

        const isUser = item.role === 'user';
        const [pendingTitle, pendingBody] = item.pending ? item.content.split('\n', 2) : ['', ''];
        return (
            <View style={[styles.messageRow, isUser ? styles.messageRowUser : styles.messageRowAssistant]}>
                <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
                    {isUser ? (
                        <Text style={styles.bubbleTextUser}>{item.content}</Text>
                    ) : item.pending ? (
                        <View style={styles.pendingBubble}>
                            <View style={styles.pendingBubbleHead}>
                                <ActivityIndicator size="small" color={Colors.accent.gold} />
                                <Text style={styles.pendingBubbleTitle}>{pendingTitle}</Text>
                            </View>
                            {pendingBody ? (
                                <Text style={styles.pendingBubbleBody}>{pendingBody}</Text>
                            ) : null}
                        </View>
                    ) : (
                        <Markdown style={markdownStyles}>{item.content}</Markdown>
                    )}
                </View>
            </View>
        );
    };

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={handleClose} onShow={handleModalShow}>
            <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={handleClose} style={styles.headerBtn}>
                        <BackIcon size={24} color={Colors.text.primary} />
                    </TouchableOpacity>
                    <View style={styles.headerTitleWrap}>
                        {stagedMode ? (
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
                        {ziweiStaleNotice ? (
                            <View style={[styles.workflowCard, styles.workflowCardReady]}>
                                <Text style={styles.workflowCardTitle}>{ziweiStaleNotice.title}</Text>
                                <Text style={styles.workflowCardBody}>{ziweiStaleNotice.body}</Text>
                                <TouchableOpacity
                                    style={styles.workflowCardActionBtn}
                                    onPress={() => {
                                        void restartBaziWorkflow();
                                    }}
                                >
                                    <Text style={styles.workflowCardActionText}>按当前配置重新开始 AI 分析</Text>
                                </TouchableOpacity>
                            </View>
                        ) : null}
                        {stagedMode && workflowNotice && !ziweiStaleNotice ? (
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
                                {showInitialResetAction && !ziweiStaleNotice ? (
                                    <TouchableOpacity
                                        style={styles.workflowCardActionBtn}
                                        onPress={() => {
                                            void restartBaziWorkflow();
                                        }}
                                    >
                                        <Text style={styles.workflowCardActionText}>
                                            {workflowMode === 'ziwei' ? '重试基础命盘分析' : '重试基础定局'}
                                        </Text>
                                    </TouchableOpacity>
                                ) : null}
                            </View>
                        ) : null}

                        {formatRequestEvidenceNotice(requestDebugMeta) ? (
                            <Text style={styles.requestEvidenceText}>{formatRequestEvidenceNotice(requestDebugMeta)}</Text>
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
                                        {workflowMode === 'ziwei' ? getLocalZiweiFoundationActionLabel() : getLocalBaziFoundationActionLabel()}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        ) : showVerificationActions ? (
                            <View style={styles.verificationActionsWrap}>
                                {(workflowMode === 'ziwei' ? getLocalZiweiVerificationActions() : getLocalBaziVerificationActions()).map((action) => (
                                    <TouchableOpacity
                                        key={action.id}
                                        style={[
                                            styles.verificationActionBtn,
                                            action.id === 'continue' ? styles.verificationActionPrimary : styles.verificationActionSecondary,
                                        ]}
                                        onPress={() => handleVerificationActionPress(action)}
                                    >
                                        <Text
                                            style={[
                                                styles.verificationActionText,
                                                action.id === 'continue' ? styles.verificationActionPrimaryText : styles.verificationActionSecondaryText,
                                            ]}
                                        >
                                            {action.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        ) : (
                            <>
                                {artifactNotice && !isLoading && (!stagedMode || workflowStage === 'followup_ready') ? (
                                    <Text style={styles.artifactNoticeText}>{artifactNotice}</Text>
                                ) : null}
                                {quickReplies.length > 0 && !isLoading && (!stagedMode || workflowStage === 'followup_ready') ? (
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
                                                onPress={() => handleSend(item, { isQuickReply: stagedMode })}
                                            >
                                                <Text style={styles.quickReplyText}>{item}</Text>
                                            </TouchableOpacity>
                                        )}
                                    />
                                ) : null}
                            </>
                        )}

                        <View style={styles.inputRow}>
                            <TextInput
                                style={styles.textInput}
                                placeholder={stagedMode
                                    ? (ziweiAnalysisStale
                                        ? '当前 AI 基于旧配置失效，请先重新开始分析...'
                                        : (workflowStage === 'foundation_pending'
                                        ? (workflowMode === 'ziwei' ? '基础命盘分析完成前，暂不开放追问...' : '基础定局完成前，暂不开放追问...')
                                        : (workflowStage === 'foundation_ready'
                                            ? '点击“开始前事核验”后再继续...'
                                            : (workflowStage === 'verification_ready'
                                                ? '先确认前事核验，再进入未来五年...'
                                                : (workflowMode === 'ziwei'
                                                    ? '继续细问未来五年的事业、感情或关键年份...'
                                                    : '继续细问未来五年里的财运、婚恋或事业...')))))
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
        width: '85%',
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
    pendingBubble: {
        gap: Spacing.sm,
    },
    pendingBubbleHead: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    pendingBubbleTitle: {
        flex: 1,
        fontSize: FontSize.md,
        color: Colors.text.heading,
        fontWeight: '600',
        lineHeight: 22,
    },
    pendingBubbleBody: {
        fontSize: FontSize.sm,
        color: Colors.text.secondary,
        lineHeight: 20,
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
    requestEvidenceText: {
        paddingHorizontal: Spacing.md,
        paddingTop: Spacing.xs,
        fontSize: FontSize.xs,
        color: Colors.text.tertiary,
        lineHeight: 18,
    },
    artifactNoticeText: {
        paddingHorizontal: Spacing.md,
        paddingTop: Spacing.sm,
        fontSize: FontSize.xs,
        color: Colors.text.secondary,
        lineHeight: 18,
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
