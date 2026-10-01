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
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { BaziFormatterContext, mergeBaziFormatterContext } from '../core/bazi-ai-context';
import { normalizeGanZhiRelationSettings } from '../core/bazi-ganzhi-relation-engine';
import { BaziAIConversationStage, PersistedAIChatMessage } from '../core/ai-meta';
import { formatVerificationMarksShort, getActiveVerificationMarks, type AIVerificationMarkEntry } from '../core/ai-verification-marks';
import { BaziResult } from '../core/bazi-types';
import { getBaziBirthSignature } from '../core/bazi-ai-identity';
import { formatBaziDisplayContent } from '../core/bazi-ai-display';
import { getBaziWorkflowVersion, isBaziWorkflowStale } from '../core/bazi-ai-workflow';
import {
    canConfirmKinshipAttempt, confirmKinshipVerification, formatKinshipResponse, getCurrentKinshipVerification, getKinshipStateKey, isKinshipResponseKind,
    withKinshipActualFeedback, withKinshipFeedback, KINSHIP_ACTUAL_FIELDS, KINSHIP_FEEDBACK_ID, KINSHIP_FEEDBACK_LABELS,
    type BaziKinshipVerification, type KinshipActualFacts, type KinshipFeedback,
} from '../core/bazi-kinship';
import { buildBaziKinshipPrompt } from '../services/bazi-kinship-prompts';
import BaziKinshipFeedbackModal from './BaziKinshipFeedbackModal';
import AIModelSelector from './AIModelSelector';
import { PanResult } from '../core/liuyao-calc';
import { clearAIAnalysis, saveRecord, updateExistingRecordResult } from '../db/database';
import { ZiweiFormatterContext } from '../features/ziwei/ai-context';
import {
    buildZiweiAIConfigSignature,
    isZiweiAIConfigStale,
    ZiweiRecordResult,
} from '../features/ziwei/record';
import {
    AIRequestDebugMeta,
    AIWorkflowResponseKind,
    buildBaziFiveYearPrompt,
    buildBaziFollowUpPrompt,
    buildBaziVerificationPrompt,
    BaziVerificationAction,
    buildZiweiFiveYearPrompt,
    buildZiweiFollowUpPrompt,
    buildZiweiVerificationPrompt,
    getBaziConversationStage,
    getBaziFoundationPrompt,
    getLocalBaziFoundationActionLabel,
    getLocalBaziVerificationActions,
    getZiweiConversationStage,
    getZiweiFoundationPrompt,
    getLocalZiweiFoundationActionLabel,
    getLocalZiweiVerificationActions,
} from '../services/ai';
import {
    AIAnalysisJobState,
    cancelAIAnalysisJob,
    clearAIAnalysisJob,
    getAIAnalysisJob,
    isActiveAIAnalysisJob,
    isCancellableAIAnalysisJob,
    recoverInterruptedAIAnalysisJob,
    startAIAnalysisJob,
    subscribeAIAnalysisJob,
} from '../services/ai-analysis-jobs';
import { recordDiagnosticLog } from '../services/diagnostics';
import { shareChatMarkdown } from '../services/share';
import { BorderRadius, FontSize, Spacing } from '../theme/colors';
import { getLuminance } from '../theme/bazi-theme';
import { useTheme } from '../theme/ThemeContext';
import { CustomAlert } from './CustomAlertProvider';
import { ChatPresentationState, shouldAutoStartInitialAnalysis } from './ai-chat-lifecycle';
import {
    buildBaziVerificationRetryPlan,
    buildRetryPlan,
    getLastAssistantContent,
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

const BAZI_ELEMENT_COLOR_KEYS = {
    木: 'elementWood', 火: 'elementFire', 土: 'elementEarth', 金: 'elementMetal', 水: 'elementWater',
} as const;
const BLACK_WHITE_TEXT_THRESHOLD = 0.179;

function isBaziResult(result: unknown): result is BaziResult {
    return typeof result === 'object' && result !== null && 'fourPillars' in result && Array.isArray(result.fourPillars);
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

function hydrateMessages(messages: PersistedAIChatMessage[], idPrefix = 'history'): UIChatMessage[] {
    return messages.map((message, index) => ({
        ...message,
        uiId: `${idPrefix}-${index}-${message.role}`,
    }));
}

function areMessagesEqual(left: UIChatMessage[], right: UIChatMessage[]): boolean {
    if (left.length !== right.length) {
        return false;
    }

    return left.every((message, index) => {
        const other = right[index];
        return message.uiId === other.uiId
            && message.role === other.role
            && message.content === other.content
            && message.hidden === other.hidden
            && message.pending === other.pending
            && message.requestContent === other.requestContent
            && message.workflowStage === other.workflowStage
            && JSON.stringify(message.executionMeta) === JSON.stringify(other.executionMeta);
    });
}

function toPersistedMessages(messages: UIChatMessage[]): PersistedAIChatMessage[] {
    return messages.map(({ role, content, hidden, requestContent, workflowStage, executionMeta }) => ({
        role,
        content,
        hidden,
        requestContent,
        workflowStage,
        executionMeta,
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

function buildAnalysisJobPendingMessage(job: AIAnalysisJobState): UIChatMessage | null {
    const subject = job.engineType === 'liuyao'
        ? '六爻分析'
        : job.engineType === 'bazi'
            ? '八字分析'
            : '紫微分析';
    const content = job.status === 'streaming' && isKinshipResponseKind(job.expectedCompletion)
        ? '正在分析六亲...'
        : job.status === 'running'
        ? `正在提交${subject}...`
        : job.status === 'reasoning'
            ? '正在分析...'
            : job.status === 'validating'
                ? '正在检查回复格式...'
                : job.status === 'postprocessing'
                    ? '正在整理追问...'
                    : job.status === 'saving'
                        ? '正在保存...'
                    : '';

    if (!content) {
        return null;
    }

    return {
        role: 'assistant',
        content,
        pending: true,
        uiId: `ai-job-${job.jobId}-${job.status}`,
    };
}

function buildAnalysisJobMessages(job: AIAnalysisJobState): UIChatMessage[] {
    const baseMessages = hydrateMessages(job.messages, `ai-job-${job.jobId}-history`);
    const keepsDraftVisible = job.status === 'streaming'
        || job.status === 'validating'
        || job.status === 'postprocessing'
        || job.status === 'saving'
        || job.status === 'failed';
    if (keepsDraftVisible && job.draftContent) {
        const draftMessage: UIChatMessage = {
            role: 'assistant',
            content: job.draftContent,
            pending: false,
            uiId: `ai-job-${job.jobId}-draft`,
        };
        const pendingMessage = buildAnalysisJobPendingMessage(job);
        return pendingMessage
            ? [...baseMessages, draftMessage, pendingMessage]
            : [...baseMessages, draftMessage];
    }
    if (job.status === 'completed' && job.validatedContent) {
        return hydrateMessages(job.messages, `ai-job-${job.jobId}-history`);
    }
    const pendingMessage = buildAnalysisJobPendingMessage(job);
    return pendingMessage ? [...baseMessages, pendingMessage] : baseMessages;
}

function getAnalysisJobPresentationState(job: AIAnalysisJobState): ChatPresentationState {
    if (job.status === 'running') {
        return 'preparing_request';
    }
    if (job.status === 'reasoning') {
        return 'reasoning';
    }
    if (job.status === 'streaming' || job.status === 'validating') {
        return 'streaming';
    }
    if (job.status === 'postprocessing' || job.status === 'saving') {
        return 'streaming';
    }
    return 'presenting';
}

function getAnalysisJobNotice(job?: AIAnalysisJobState | null): string | null {
    if (!job) {
        return null;
    }
    if (job.status === 'streaming') {
        return '正文生成中，完成盘据校验后才会写入正式结果。';
    }
    if (job.status === 'failed') {
        return job.failure?.message || '分析失败，请重试当前阶段。';
    }
    if (job.status === 'interrupted') {
        return '上次分析已中断，未写入正式结果，可以重新开始。';
    }
    if (job.status === 'cancelled') {
        return '本次分析已取消。';
    }
    return null;
}

export default function AIChatModal({ visible, onClose, result, onUpdateResult, baziContext, ziweiContext }: AIChatModalProps) {
    const { Colors } = useTheme();
    const styles = useMemo(() => makeStyles(Colors), [Colors]);
    const markdownStyles = useMemo(() => makeMarkdownStyles(Colors), [Colors]);
    const flatListRef = useRef<FlatList>(null);
    const latestResultRef = useRef<PanResult | BaziResult | ZiweiRecordResult>(result);
    const latestBaziContextRef = useRef<BaziFormatterContext | undefined>(baziContext);
    const latestZiweiContextRef = useRef<ZiweiFormatterContext | undefined>(ziweiContext);
    const latestMessagesRef = useRef<UIChatMessage[]>([]);
    const visibleRef = useRef(visible);
    const loadingRef = useRef(false);
    const modalShownRef = useRef(false);
    const autoStartPendingRef = useRef(false);
    const autoStartTaskRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);
    const syncedAnalysisJobResultRef = useRef<PanResult | BaziResult | ZiweiRecordResult | null>(null);

    const [messages, setMessages] = useState<UIChatMessage[]>([]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [kinshipSaving, setKinshipSaving] = useState(false);
    const [feedbackVisible, setFeedbackVisible] = useState(false);
    const [feedbackChoice, setFeedbackChoice] = useState<KinshipFeedback | undefined>();
    const [feedbackDraft, setFeedbackDraft] = useState<KinshipActualFacts>({ siblings: '', birthOrder: '', circumstances: '', unknowns: '' });
    const [detailsVisible, setDetailsVisible] = useState(false);
    const feedbackSessionRef = useRef('');
    const kinshipActionRef = useRef(false);
    const [quickReplies, setQuickReplies] = useState<string[]>([]);
    const [artifactNotice, setArtifactNotice] = useState<string | null>(null);
    const [requestDebugMeta, setRequestDebugMeta] = useState<AIRequestDebugMeta | null>(null);
    const [menuVisible, setMenuVisible] = useState(false);
    const [headerBottom, setHeaderBottom] = useState(0);
    const [hasFoundationAttempted, setHasFoundationAttempted] = useState(false);
    const [presentationState, setPresentationState] = useState<ChatPresentationState>('idle');
    const [analysisJob, setAnalysisJob] = useState<AIAnalysisJobState | null>(null);
    const workflowMode: 'liuyao' | 'bazi' | 'ziwei' = isBaziResult(result)
        ? 'bazi'
        : (isZiweiResult(result) ? 'ziwei' : 'liuyao');
    const stagedMode = workflowMode !== 'liuyao';
    const kinshipWorkflow = isBaziResult(result) && getBaziWorkflowVersion(result) === 2;
    const kinshipState = isBaziResult(result) ? getCurrentKinshipVerification(result) : undefined;
    const latestKinshipAttempt = kinshipState?.attempts.at(-1);
    // 与业务规则一致：只要独生与排行已判定就能确认；人数里看不准的部分不在确认范围内。
    const kinshipUndetermined = !latestKinshipAttempt
        || !canConfirmKinshipAttempt({ ...latestKinshipAttempt, feedback: { ...latestKinshipAttempt.feedback, [KINSHIP_FEEDBACK_ID]: 'matched' } });
    useEffect(() => {
        const session = `${result.id}:${visible}`;
        if (feedbackSessionRef.current === session) return;
        feedbackSessionRef.current = session;
        setFeedbackDraft(kinshipState?.actualFeedback ?? { siblings: '', birthOrder: '', circumstances: '', unknowns: '' });
        setFeedbackChoice(kinshipState?.attempts.at(-1)?.feedback[KINSHIP_FEEDBACK_ID]);
        setFeedbackVisible(false);
    }, [result.id, visible, kinshipState]);
    const kinshipMessageContents = useMemo(() => {
        const content = new Map<string, string>();
        let round = 0;
        messages.forEach((message) => {
            if (message.role !== 'assistant' || message.workflowStage !== 'kinship' || message.pending) return;
            const attempt = kinshipState?.attempts[round++];
            if (attempt) content.set(message.uiId, formatKinshipResponse(attempt.prediction, attempt.evidence));
        });
        return content;
    }, [messages, kinshipState]);
    const displayMessages = useMemo(() => messages.map((message) => workflowMode === 'bazi' && message.role === 'assistant'
        ? { ...message, content: formatBaziDisplayContent(kinshipMessageContents.get(message.uiId) ?? message.content) }
        : message), [messages, kinshipMessageContents, workflowMode]);
    const baziAnalysisStale = isBaziResult(result) && isBaziWorkflowStale(result);
    const ziweiAnalysisStale = workflowMode === 'ziwei'
        && isZiweiResult(result)
        && isZiweiAIConfigStale(result);
    const [workflowStage, setWorkflowStage] = useState<BaziAIConversationStage | null>(
        workflowMode === 'bazi'
            ? getBaziConversationStage(result as BaziResult)
            : (workflowMode === 'ziwei' ? getZiweiConversationStage(result as ZiweiRecordResult) : null),
    );
    const headerMeta = buildHeaderMeta(result);
    const ziweiStaleNotice = useMemo(
        () => baziAnalysisStale ? { title: '出生盘据已变化', body: '旧分析与六亲记录仍可查看，请按当前出生资料重新开始分析。' } : buildZiweiStaleNotice(ziweiAnalysisStale),
        [ziweiAnalysisStale, baziAnalysisStale],
    );

    const cancelScheduledAutoStart = () => {
        if (autoStartTaskRef.current !== null) cancelAnimationFrame(autoStartTaskRef.current);
        autoStartTaskRef.current = null;
    };

    useEffect(() => {
        return () => {
            cancelScheduledAutoStart();
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
        void recoverInterruptedAIAnalysisJob(workflowMode, result.id);
        return subscribeAIAnalysisJob(workflowMode, result.id, setAnalysisJob);
    }, [workflowMode, result.id]);

    useEffect(() => {
        if (!analysisJob) {
            return;
        }

        const jobMessages = buildAnalysisJobMessages(analysisJob);
        setMessages((currentMessages) => {
            if (areMessagesEqual(currentMessages, jobMessages)) {
                latestMessagesRef.current = currentMessages;
                return currentMessages;
            }
            latestMessagesRef.current = jobMessages;
            return jobMessages;
        });
        setIsLoading(isActiveAIAnalysisJob(analysisJob));
        setArtifactNotice(getAnalysisJobNotice(analysisJob));
        setRequestDebugMeta(analysisJob.debugMeta ?? null);
        setPresentationState(getAnalysisJobPresentationState(analysisJob));
        if (analysisJob.expectedCompletion === 'foundation'
            && (analysisJob.status === 'failed' || analysisJob.status === 'interrupted' || analysisJob.status === 'cancelled')) {
            setHasFoundationAttempted(true);
        }

        if (analysisJob.status === 'completed'
            && analysisJob.result
            && syncedAnalysisJobResultRef.current !== analysisJob.result) {
            const updatedResult = analysisJob.result as PanResult | BaziResult | ZiweiRecordResult;
            setQuickReplies(updatedResult.quickReplies ?? []);
            syncedAnalysisJobResultRef.current = updatedResult;
            latestResultRef.current = updatedResult;
            onUpdateResult(updatedResult);
        }
    }, [analysisJob, onUpdateResult]);

    useEffect(() => {
        if (!visible) {
            cancelScheduledAutoStart();
            modalShownRef.current = false;
            autoStartPendingRef.current = false;
            setMenuVisible(false);
        }
    }, [visible]);

    useEffect(() => {
        syncedAnalysisJobResultRef.current = null;
        setHasFoundationAttempted(false);
    }, [result.id]);

    useEffect(() => {
        if (visible) {
            const currentJob = getAIAnalysisJob(workflowMode, result.id);
            if (currentJob) {
                const jobMessages = buildAnalysisJobMessages(currentJob);
                setMessages(jobMessages);
                latestMessagesRef.current = jobMessages;
                autoStartPendingRef.current = false;
                modalShownRef.current = false;
                setPresentationState(getAnalysisJobPresentationState(currentJob));
                setArtifactNotice(getAnalysisJobNotice(currentJob));
                setQuickReplies(result.quickReplies && result.quickReplies.length > 0 ? result.quickReplies : []);
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
            const runningJob = getAIAnalysisJob(workflowMode, result.id);
            autoStartPendingRef.current = hydrated.length === 0 && !runningJob;
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
            aiConversationStage?: BaziAIConversationStage | null;
            aiVerificationSummary?: string | null;
            aiContextSnapshot?: BaziResult['aiContextSnapshot'] | null;
            aiWorkflowVersion?: 1 | 2;
            aiWorkflowBirthSignature?: string | null;
            aiKinshipVerification?: BaziKinshipVerification | null;
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

        if (!isBaziResult(baseResult) && overrides.aiConversationStage === 'kinship_ready') throw new Error('六亲阶段仅用于八字会话');
        const commonStage = overrides.aiConversationStage === 'kinship_ready' ? undefined : overrides.aiConversationStage;
        const updatedResult: PanResult | BaziResult | ZiweiRecordResult = isBaziResult(baseResult)
            ? {
                ...baseResult,
                aiWorkflowVersion: overrides.aiWorkflowVersion ?? baseResult.aiWorkflowVersion,
                aiWorkflowBirthSignature: overrides.aiWorkflowBirthSignature === null ? undefined : overrides.aiWorkflowBirthSignature ?? baseResult.aiWorkflowBirthSignature,
                aiKinshipVerification: overrides.aiKinshipVerification === null ? undefined : overrides.aiKinshipVerification ?? baseResult.aiKinshipVerification,
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
                    aiConversationStage: hasStageOverride ? (commonStage ?? undefined) : baseResult.aiConversationStage,
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

    const handleSend = async (
        textOverride?: string,
        options: {
            isAutoInitial?: boolean;
            baseMessagesOverride?: UIChatMessage[];
            hiddenUser?: boolean;
            isQuickReply?: boolean;
            requestTextOverride?: string;
            nextWorkflowStage?: BaziAIConversationStage;
            expectedCompletion?: AIWorkflowResponseKind;
        } = {},
    ) => {
        const text = (textOverride || inputText).trim();
        if (!text && !options.isAutoInitial) {
            return;
        }

        cancelScheduledAutoStart();
        autoStartPendingRef.current = false;
        if (isActiveAIAnalysisJob(getAIAnalysisJob(workflowMode, latestResultRef.current.id))) {
            return;
        }

        const rewrittenText = options.requestTextOverride
            ?? (
                workflowMode === 'bazi' && options.isQuickReply
                    ? buildBaziFollowUpPrompt(text)
                    : (workflowMode === 'ziwei' && options.isQuickReply
                        ? buildZiweiFollowUpPrompt(text)
                        : null)
            );
        const baseMessages = options.baseMessagesOverride || messages;
        const nextMessages: UIChatMessage[] = [
            ...baseMessages,
            {
                role: 'user',
                content: text,
                hidden: options.hiddenUser,
                requestContent: rewrittenText && rewrittenText !== text ? rewrittenText : undefined,
                uiId: generateMessageId('user'),
                ...(isBaziResult(latestResultRef.current) && getBaziWorkflowVersion(latestResultRef.current) === 2
                    ? { workflowStage: options.expectedCompletion ?? 'followup' as const } : {}),
            },
        ];
        const phase = options.isAutoInitial ? 'initial' : 'followup';

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
        setIsLoading(true);

        const job = startAIAnalysisJob({
            engineType: workflowMode,
            result: latestResultRef.current,
            baseMessages: toPersistedMessages(baseMessages),
            requestMessages: toPersistedMessages(nextMessages),
            phase,
            expectedCompletion: options.expectedCompletion,
            nextWorkflowStage: options.nextWorkflowStage,
            formatterContext: workflowMode === 'bazi'
                ? latestBaziContextRef.current
                : (workflowMode === 'ziwei' ? latestZiweiContextRef.current : undefined),
        });
        setAnalysisJob(job);
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
        // onShow 已确认弹窗展示完成，下一帧再启动请求以保留首屏绘制机会。
        autoStartTaskRef.current = requestAnimationFrame(() => {
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
        const assistantText = getLastAssistantContent(displayMessages);
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
            ...(workflowMode === 'bazi' ? { aiWorkflowVersion: 2 as const, aiWorkflowBirthSignature: null, aiKinshipVerification: null } : {}),
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

    const handleStartVerification = async (override?: UIChatMessage[], marks: Record<string, AIVerificationMarkEntry> = {}) => {
        if (!stagedMode) {
            return;
        }

        const baseMessagesOverride = override ?? (kinshipWorkflow
            ? hydrateMessages(latestResultRef.current.aiChatHistory ?? []) : trimWorkflowMessages(messages, 1));
        const prompt = workflowMode === 'bazi' ? buildBaziVerificationPrompt(marks) : buildZiweiVerificationPrompt(marks);
        const markedText = formatVerificationMarksShort(marks);
        // Marks are the user's own feedback, so they stay visible in the
        // conversation; the full instructions travel as requestContent.
        await handleSend(markedText ? `按我的标记重新核验：${markedText}` : prompt, {
            baseMessagesOverride,
            hiddenUser: !markedText,
            requestTextOverride: prompt,
            expectedCompletion: 'verification',
            nextWorkflowStage: 'verification_ready',
        });
    };

    const handleRestartVerification = async () => {
        if (!stagedMode) {
            return;
        }

        const marks = getActiveVerificationMarks(latestResultRef.current as BaziResult | ZiweiRecordResult);
        if (kinshipWorkflow) {
            const history = hydrateMessages(latestResultRef.current.aiChatHistory ?? []);
            await saveAndSync(history, { quickReplies: [], aiConversationDigest: null, aiConversationStage: 'kinship_ready', aiVerificationSummary: null });
            await handleStartVerification(history, marks);
            return;
        }
        const verificationPrompt = workflowMode === 'bazi' ? buildBaziVerificationPrompt() : buildZiweiVerificationPrompt();
        const retryPlan = buildBaziVerificationRetryPlan(messages, verificationPrompt);
        if (!retryPlan) {
            CustomAlert.alert('无法重新校验', '当前没有可替换的前事核验内容。');
            return;
        }

        // A visible "按我的标记重新核验" message belongs to the verification being replaced.
        const baseMessages = [...retryPlan.baseMessages];
        while (baseMessages.length > 0 && baseMessages[baseMessages.length - 1].role === 'user') baseMessages.pop();
        setMessages(baseMessages);
        latestMessagesRef.current = baseMessages;
        setQuickReplies([]);
        setWorkflowStage('foundation_ready');

        await saveAndSync(baseMessages, {
            quickReplies: [],
            aiConversationDigest: null,
            aiConversationStage: 'foundation_ready',
            aiVerificationSummary: null,
        });

        await handleStartVerification(baseMessages, marks);
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
            baseMessagesOverride: kinshipWorkflow ? hydrateMessages(latestResultRef.current.aiChatHistory ?? []) : trimWorkflowMessages(messages, 2),
            hiddenUser: true,
            requestTextOverride: prompt,
            expectedCompletion: 'five_year',
            nextWorkflowStage: 'followup_ready',
        });
    };

    const runKinshipAction = async (action: () => Promise<void>) => {
        if (kinshipActionRef.current || isLoading) return;
        kinshipActionRef.current = true;
        setKinshipSaving(true);
        try { await action(); } catch (error) {
            CustomAlert.alert('暂时无法继续', error instanceof Error ? error.message : String(error));
        } finally { kinshipActionRef.current = false; setKinshipSaving(false); }
    };

    const saveKinship = async (next: BaziKinshipVerification, facts?: KinshipActualFacts): Promise<void> => {
        const base = latestResultRef.current;
        if (!isBaziResult(base)) throw new Error('当前不是八字会话');
        const saved = await updateExistingRecordResult(base.id, 'bazi', (current) => {
            if (!isBaziResult(current) || getBaziBirthSignature(current) !== next.birthSignature
                || getKinshipStateKey(current.aiKinshipVerification) !== getKinshipStateKey(base.aiKinshipVerification)) return null;
            const actualFeedback = facts ? next.actualFeedback : undefined;
            const feedbackMessage: PersistedAIChatMessage[] = actualFeedback
                && JSON.stringify(current.aiKinshipVerification?.actualFeedback) !== JSON.stringify(actualFeedback) ? [{
                role: 'user', workflowStage: 'verification',
                content: ['我提供的实际家庭情况：', ...Object.entries(KINSHIP_ACTUAL_FIELDS).flatMap(([key, label]) => {
                    const value = actualFeedback[key as keyof KinshipActualFacts];
                    return value ? [`${label}：${value}`] : [];
                })].join('\n'),
            }] : [];
            return { ...current, aiKinshipVerification: next,
                aiChatHistory: [...(current.aiChatHistory ?? []), ...feedbackMessage] };
        });
        if (!saved || !isBaziResult(saved)) throw new Error('记录已变化，请重新打开当前命盘后核验');
        latestResultRef.current = saved;
        setWorkflowStage(getBaziConversationStage(saved));
        onUpdateResult(saved);
    };

    const handleStartKinship = async () => {
        const current = latestResultRef.current;
        if (!isBaziResult(current)) return;
        await handleSend(buildBaziKinshipPrompt(), {
            baseMessagesOverride: hydrateMessages(current.aiChatHistory ?? []), hiddenUser: true,
            expectedCompletion: 'kinship', nextWorkflowStage: 'kinship_ready',
        });
    };

    const continueKinship = async (feedback?: KinshipFeedback, facts?: KinshipActualFacts, onSaved?: () => void) => {
        const current = latestResultRef.current;
        if (!isBaziResult(current) || isBaziWorkflowStale(current)) throw new Error('命盘已变化，请重新开始分析');
        if (feedback || facts) {
            const context = mergeBaziFormatterContext(current.aiContextSnapshot, latestBaziContextRef.current);
            let next: BaziKinshipVerification = getCurrentKinshipVerification(current) ?? {
                version: 2, birthSignature: getBaziBirthSignature(current), attempts: [],
                relationSettings: normalizeGanZhiRelationSettings(context?.ganZhiRelationSettings),
            };
            if (feedback) {
                next = withKinshipFeedback(next, KINSHIP_FEEDBACK_ID, feedback);
                if (feedback === 'matched') next = confirmKinshipVerification(next);
            }
            if (facts) next = withKinshipActualFeedback(next, facts);
            await saveKinship(next, facts);
        }
        onSaved?.();
        await handleStartVerification(hydrateMessages(latestResultRef.current.aiChatHistory ?? []));
    };
    const handleKinshipContinue = (feedback?: KinshipFeedback) => runKinshipAction(() => continueKinship(feedback));
    const saveFeedbackAndContinue = async () => {
        if (kinshipActionRef.current) return;
        kinshipActionRef.current = true;
        setKinshipSaving(true);
        try {
            const hasFacts = Object.values(feedbackDraft).some((value) => value.trim());
            await continueKinship(feedbackChoice, hasFacts ? feedbackDraft : undefined, () => {
                const current = latestResultRef.current;
                if (isBaziResult(current)) setFeedbackDraft(getCurrentKinshipVerification(current)?.actualFeedback
                    ?? { siblings: '', birthOrder: '', circumstances: '', unknowns: '' });
                setFeedbackVisible(false);
            });
        } finally {
            kinshipActionRef.current = false;
            setKinshipSaving(false);
        }
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
            await shareChatMarkdown(latestResultRef.current, toPersistedMessages(displayMessages));
        } catch (error: any) {
            const message = typeof error?.message === 'string' ? error.message : '导出失败，请稍后重试';
            void recordDiagnosticLog({
                level: 'error',
                source: 'AIChatModal:exportChat',
                message,
            });
            CustomAlert.alert('导出失败', message);
        }
    };

    const handleClose = () => {
        const close = () => {
            cancelScheduledAutoStart();
            setMenuVisible(false);
            setFeedbackVisible(false);
            onClose();
        };
        if (kinshipSaving) return;
        const saved = kinshipState?.actualFeedback;
        const dirty = (Object.keys(feedbackDraft) as Array<keyof KinshipActualFacts>).some((key) => feedbackDraft[key] !== (saved?.[key] ?? ''));
        if (dirty) {
            CustomAlert.alert('放弃未保存的反馈？', undefined, [
                { text: '继续填写', style: 'cancel', onPress: () => setFeedbackVisible(true) },
                { text: '放弃', style: 'destructive', onPress: close },
            ]);
        } else close();
    };

    const handleCancelAnalysisJob = () => {
        cancelAIAnalysisJob(workflowMode, result.id);
        setMenuVisible(false);
    };

    const handleRetryAnalysisJob = () => {
        if (!analysisJob || isActiveAIAnalysisJob(analysisJob)) {
            return;
        }
        if (analysisJob.expectedCompletion === 'kinship_review') {
            setMenuVisible(false);
            void handleKinshipContinue();
            return;
        }
        const failedUser = [...analysisJob.requestMessages]
            .reverse()
            .find((message) => message.role === 'user');
        if (!failedUser) {
            return;
        }
        const baseMessages = hydrateMessages(analysisJob.baseMessages, `ai-job-${analysisJob.jobId}-retry`);
        setMenuVisible(false);
        void handleSend(failedUser.content, {
            isAutoInitial: analysisJob.phase === 'initial',
            baseMessagesOverride: baseMessages,
            hiddenUser: failedUser.hidden,
            requestTextOverride: failedUser.requestContent,
            expectedCompletion: analysisJob.expectedCompletion,
            nextWorkflowStage: analysisJob.nextWorkflowStage,
        });
    };

    const handleResetAnalysis = () => {
        setMenuVisible(false);

        CustomAlert.alert(
            '确认重置 AI 分析？',
            '将清空所有会话记录并重新开始分析，排盘数据不受影响。',
            [
                { text: '取消', style: 'cancel' },
                {
                    text: '重置',
                    style: 'destructive',
                    onPress: () => void performResetAnalysis(),
                },
            ]
        );
    };

    const performResetAnalysis = async () => {
        try {
            // 1. 立即清空所有 UI 状态
            setMessages([]);
            setQuickReplies([]);
            setArtifactNotice(null);
            setPresentationState('idle');
            setHasFoundationAttempted(false);
            syncedAnalysisJobResultRef.current = null;
            latestMessagesRef.current = [];

            // 2. 中断并清理
            await clearAIAnalysisJob(workflowMode, result.id);
            setAnalysisJob(null);
            setIsLoading(false);

            // 3. 清理数据库记录
            const clearedRecord = await clearAIAnalysis(result.id);
            if (!clearedRecord) {
                throw new Error('记录不存在');
            }

            // 4. 类型窄化检查
            const clearedResult = clearedRecord.result;
            if (clearedRecord.engineType === 'baziCompatibility') {
                throw new Error('八字合盘暂不支持 AI 分析重置');
            }

            // 类型断言：已排除 baziCompatibility
            const typedResult = clearedResult as PanResult | BaziResult | ZiweiRecordResult;

            // 5. 更新 ref 和父组件状态
            latestResultRef.current = typedResult;
            onUpdateResult(typedResult);

            // 6. 重置工作流状态
            if (isBaziResult(typedResult)) {
                setWorkflowStage('foundation_pending');
                autoStartPendingRef.current = true;
            } else if (isZiweiResult(typedResult)) {
                setWorkflowStage('foundation_pending');
                autoStartPendingRef.current = true;
            } else {
                // 六爻
                autoStartPendingRef.current = true;
            }

            // 7. 通过统一任务重新启动分析
            if (visibleRef.current && !loadingRef.current) {
                cancelScheduledAutoStart();

                autoStartTaskRef.current = requestAnimationFrame(() => {
                    autoStartTaskRef.current = null;

                    if (!visibleRef.current || loadingRef.current) {
                        return;
                    }

                    // 再次确保清空(防止 useEffect 干扰)
                    setMessages([]);
                    latestMessagesRef.current = [];

                    void handleSend(
                        workflowMode === 'bazi'
                            ? getBaziFoundationPrompt()
                            : workflowMode === 'ziwei'
                                ? getZiweiFoundationPrompt()
                                : '请帮我全面分析一下此卦！',
                        {
                            isAutoInitial: true,
                            hiddenUser: true,
                            baseMessagesOverride: [],
                            expectedCompletion: stagedMode ? 'foundation' : undefined,
                            nextWorkflowStage: stagedMode ? 'foundation_ready' : undefined,
                        },
                    );
                });
            }

            CustomAlert.alert('重置成功', '已清空 AI 会话，正在重新分析...');
        } catch (error: any) {
            const message = typeof error?.message === 'string' ? error.message : '重置失败，请稍后重试';
            CustomAlert.alert('重置失败', message);
        }
    };

    const menuItems: OverflowMenuItem[] = [
        { key: 'details', label: detailsVisible ? '收起分析详情' : '分析详情', onPress: () => { setDetailsVisible(!detailsVisible); setMenuVisible(false); } },
        ...(isCancellableAIAnalysisJob(analysisJob)
            ? [{ key: 'cancel-analysis', label: '取消本次分析', onPress: handleCancelAnalysisJob, destructive: true }]
            : []),
        ...(analysisJob && !isActiveAIAnalysisJob(analysisJob)
            && (analysisJob.status === 'failed' || analysisJob.status === 'interrupted' || analysisJob.status === 'cancelled')
            ? [{ key: 'retry-analysis', label: '重试本次分析', onPress: handleRetryAnalysisJob }]
            : []),
        { key: 'copy', label: '复制回复', onPress: handleCopyLatestAssistant, disabled: isLoading },
        { key: 'retry', label: '重试上一问', onPress: handleRetryLastQuestion, disabled: isLoading || ziweiAnalysisStale || (stagedMode && workflowStage !== 'followup_ready') || !buildRetryPlan(messages) },
        { key: 'export', label: '导出会话', onPress: handleExportChat, disabled: isLoading },
        { key: 'reset', label: '重置分析', onPress: handleResetAnalysis, disabled: isLoading, destructive: true },
    ];
    const showFoundationAction = stagedMode
        && !kinshipWorkflow
        && !ziweiAnalysisStale
        && !baziAnalysisStale
        && workflowStage === 'foundation_ready'
        && !isLoading;
    const showVerificationActions = stagedMode
        && !ziweiAnalysisStale
        && !baziAnalysisStale
        && workflowStage === 'verification_ready'
        && !isLoading
        && Boolean(getLastAssistantContent(messages));
    const showInitialResetAction = shouldShowBaziFoundationRetryAction(
        workflowStage,
        isLoading,
        messages.length,
        hasFoundationAttempted,
    ) && !ziweiAnalysisStale;
    const inputLocked = isActiveAIAnalysisJob(analysisJob) || (stagedMode && workflowStage !== 'followup_ready') || ziweiAnalysisStale || baziAnalysisStale || kinshipSaving;

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
                    ) : item.pending ? (
                        <View style={styles.pendingBubble}>
                            <View style={styles.pendingBubbleHead}>
                                <ActivityIndicator size="small" color={Colors.accent.gold} />
                                <Text style={styles.pendingBubbleTitle}>{item.content}</Text>
                            </View>
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
            <SafeAreaProvider style={styles.container}>
                <SafeAreaView style={styles.container}>
                    <View style={[styles.header, workflowMode === 'bazi' && styles.baziHeader]}
                        onLayout={({ nativeEvent: { layout } }) => setHeaderBottom(layout.y + layout.height)}>
                        <TouchableOpacity onPress={handleClose} style={styles.headerBtn} accessibilityRole="button" accessibilityLabel="关闭 AI 分析">
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
                        <TouchableOpacity onPress={() => setMenuVisible((prev) => !prev)} style={styles.headerBtn}
                            accessibilityRole="button" accessibilityLabel="更多操作" accessibilityState={{ expanded: menuVisible }}>
                            <MoreVerticalIcon size={20} color={Colors.text.primary} />
                        </TouchableOpacity>
                    </View>
                    <OverflowMenu
                        visible={menuVisible}
                        top={headerBottom}
                        right={Spacing.lg}
                        items={menuItems}
                        onClose={() => setMenuVisible(false)}
                    />
                    {detailsVisible && isBaziResult(result) && baziContext?.wuXingEnergy ? (
                        <View style={styles.baziContextPreview}>
                            <View style={styles.baziContextPreviewHead}>
                                <Text style={styles.baziContextPreviewTitle}>当前岁运五行</Text>
                                <Text style={styles.baziContextPreviewFocus}>
                                    {baziContext.wuXingEnergy.focus.mode === 'xiaoyun' ? '小运' : '大运'} {baziContext.wuXingEnergy.focus.yunGanZhi || '—'}
                                    {' · '}流年 {baziContext.wuXingEnergy.focus.liuNianGanZhi || '—'}
                                    {' · '}流月 {baziContext.wuXingEnergy.focus.liuYueGanZhi || '—'}
                                </Text>
                            </View>
                            <View style={styles.baziEnergyBar} accessible accessibilityRole="image"
                                accessibilityLabel={`岁运五行占比：${baziContext.wuXingEnergy.elements.map((item) => `${item.element} ${item.percentage}%`).join('，')}`}>
                                {baziContext.wuXingEnergy.elements.filter((item) => item.percentage > 0).map((item) => {
                                    const backgroundColor = Colors.bazi[BAZI_ELEMENT_COLOR_KEYS[item.element]];
                                    const color = getLuminance(backgroundColor) > BLACK_WHITE_TEXT_THRESHOLD ? '#000000' : '#FFFFFF';
                                    return (
                                        <View key={item.element} style={[styles.baziEnergySegment, {
                                            width: `${item.percentage}%`, backgroundColor,
                                        }]}>
                                            <Text style={[styles.baziEnergyLabel, { color }]}
                                                numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                                                {item.element} {item.percentage}%
                                            </Text>
                                        </View>
                                    );
                                })}
                            </View>
                        </View>
                    ) : null}
                    <AIModelSelector visible={visible} running={isActiveAIAnalysisJob(analysisJob) ? analysisJob?.executionMeta : undefined} />

                    <KeyboardAvoidingView
                        style={styles.keyboardView}
                        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    >
                        <FlatList
                            ref={flatListRef}
                            data={displayMessages}
                            keyExtractor={(item) => item.uiId}
                            renderItem={renderMessage}
                            contentContainerStyle={styles.chatContainer}
                            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                            onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
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
                            {showInitialResetAction && !ziweiStaleNotice && (
                                <TouchableOpacity style={styles.workflowCardActionBtn} onPress={() => { void restartBaziWorkflow(); }}>
                                    <Text style={styles.workflowCardActionText}>重试基础分析</Text>
                                </TouchableOpacity>
                            )}
                            {kinshipWorkflow && (workflowStage === 'foundation_ready' || workflowStage === 'kinship_ready') && !baziAnalysisStale && !isLoading && (
                                <View style={styles.verificationActionsWrap}>
                                    <TouchableOpacity disabled={isLoading || kinshipSaving} style={[styles.verificationActionBtn, styles.verificationActionPrimary]}
                                        onPress={() => { void handleKinshipContinue(feedbackChoice); }}>
                                        <Text style={[styles.verificationActionText, styles.verificationActionPrimaryText]}>{workflowStage === 'kinship_ready' ? '继续前事核验' : '开始前事核验'}</Text>
                                    </TouchableOpacity>
                                    {!kinshipState?.attempts.length && !kinshipState?.actualFeedback && (
                                        <TouchableOpacity disabled={isLoading || kinshipSaving} style={styles.verificationActionBtn}
                                            onPress={() => { void runKinshipAction(handleStartKinship); }}>
                                            <Text style={styles.verificationActionText}>六亲初验</Text>
                                        </TouchableOpacity>
                                    )}
                                    {!!kinshipState?.attempts.length && <View style={styles.feedbackChoices} accessibilityRole="radiogroup" accessibilityLabel="六亲初验反馈">{(['matched', 'mismatched', 'unknown'] as const).map((choice) => {
                                        const disabled = kinshipSaving || (choice === 'matched' && kinshipUndetermined);
                                        return <TouchableOpacity key={choice} accessibilityRole="radio" accessibilityState={{ checked: feedbackChoice === choice, disabled }}
                                            disabled={disabled} style={[styles.verificationActionBtn, { flex: 1, opacity: disabled ? 0.45 : 1, borderColor: feedbackChoice === choice ? Colors.accent.gold : Colors.border.normal }]}
                                            onPress={() => { setFeedbackChoice(choice); if (choice === 'mismatched') setFeedbackVisible(true); }}>
                                            <Text style={styles.verificationActionText}>{KINSHIP_FEEDBACK_LABELS[choice]}</Text>
                                        </TouchableOpacity>;
                                    })}</View>}
                                    <TouchableOpacity disabled={isLoading || kinshipSaving} style={styles.verificationActionBtn} onPress={() => setFeedbackVisible(true)}>
                                        <Text style={styles.verificationActionText}>填写实际情况</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            {artifactNotice && !isLoading ? (
                                <Text style={styles.artifactNoticeText}>{artifactNotice}</Text>
                            ) : null}

                            {detailsVisible && formatRequestEvidenceNotice(requestDebugMeta) ? (
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

                            {!inputLocked && <View style={styles.inputRow}>
                                <TextInput
                                    style={styles.textInput}
                                    placeholder="继续追问..."
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
                            </View>}
                        </View>
                    </KeyboardAvoidingView>
                    <BaziKinshipFeedbackModal visible={feedbackVisible} value={feedbackDraft} busy={kinshipSaving}
                        onChange={setFeedbackDraft} onClose={() => setFeedbackVisible(false)} onSave={saveFeedbackAndContinue} />
                </SafeAreaView>
            </SafeAreaProvider>
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
    code_inline: { color: Colors.text.primary, backgroundColor: 'transparent', borderWidth: 0, padding: 0 },
    code_block: { color: Colors.text.primary, backgroundColor: Colors.bg.elevated, borderColor: Colors.border.normal },
    fence: { color: Colors.text.primary, backgroundColor: Colors.bg.elevated, borderColor: Colors.border.normal },
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
    baziHeader: {
        paddingVertical: Spacing.xs,
        borderBottomWidth: 0,
    },
    headerBtn: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitleWrap: {
        flex: 1,
        justifyContent: 'center',
        marginHorizontal: Spacing.sm,
    },
    baziContextPreview: {
        paddingHorizontal: Spacing.xl,
        paddingTop: Spacing.xs,
        paddingBottom: Spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border.subtle,
        gap: Spacing.xs,
    },
    baziContextPreviewHead: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: Spacing.sm,
    },
    baziContextPreviewTitle: {
        color: Colors.text.secondary,
        fontSize: FontSize.xs,
        fontWeight: '500',
    },
    baziContextPreviewFocus: {
        flexShrink: 1,
        marginLeft: 'auto',
        color: Colors.text.secondary,
        fontSize: FontSize.xs,
        textAlign: 'right',
    },
    baziEnergyBar: {
        minHeight: 28,
        flexDirection: 'row',
        overflow: 'hidden',
        borderRadius: BorderRadius.sm,
        backgroundColor: Colors.bazi.surfaceRaised,
    },
    baziEnergySegment: {
        flexShrink: 0,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 2,
        paddingVertical: Spacing.xs,
        overflow: 'hidden',
    },
    baziEnergyLabel: {
        maxWidth: '100%',
        fontSize: FontSize.xs,
        fontWeight: '600',
        textAlign: 'center',
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
        width: '100%',
        maxWidth: '100%',
        backgroundColor: 'transparent',
        paddingHorizontal: 0,
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
    feedbackChoices: { flexDirection: 'row', gap: Spacing.sm },
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
        borderColor: Colors.border.normal,
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
        color: Colors.text.primary,
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
