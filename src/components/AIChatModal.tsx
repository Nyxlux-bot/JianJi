import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
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
import { describeProviderFailure, readFailureStatus } from '../services/ai-provider-client';
import { getAutoRestIndex, getReasoningLabel, resolveShownLevel } from '../services/ai-model-capabilities';
import { setActiveModelReasoning } from '../services/settings';
import { useActiveAIModel } from '../hooks/useActiveAIModel';
import { shareChatMarkdown } from '../services/share';
import { Spacing } from '../theme/colors';
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
import { BackIcon, GuaArrowIcon, MoreVerticalIcon } from './Icons';
import type { BaziCompatibilityResult } from '../features/bazi/match/types';
import { getZiweiNatalOverview, getZiweiYearOverviews } from '../features/ziwei/ai-overview';
import { getBaziNatalEnergy, getBaziYearEnergy, getBaziYearInfo } from '../core/bazi-year-overview';
import { setVerificationMark } from '../services/ai-verification-marks';
import type { AIVerificationMark } from '../core/ai-verification-marks';
import { deriveChapters, getJobChapter, type AIPageEngine, type ChapterId } from './ai/derive-chapters';
import { AIChapterCard, type ChapterYearMeta } from './ai/AIChapterCard';
import {
    ActionButton, AIComposer, AIModelChip, AIStageStepper, BaziChartSummary, CompatChartSummary, EnergyPanel,
    FailureBanner, formatRunLabel, MutagenChips, ProgressBlock, ZiweiChartSummary,
} from './ai/AIPageParts';
import { makeAIMarkdownStyles, makeAIPageStyles } from './ai/ai-page-styles';
import OverflowMenu, { OverflowMenuItem } from './OverflowMenu';

interface AIChatModalProps {
    visible: boolean;
    onClose: () => void;
    result: AIPageResult;
    // Method syntax keeps callers that only handle their own result type assignable.
    onUpdateResult(result: AIPageResult): void;
    baziContext?: BaziFormatterContext;
    ziweiContext?: ZiweiFormatterContext;
}

type AIPageResult = PanResult | BaziResult | ZiweiRecordResult | BaziCompatibilityResult;

interface UIChatMessage extends PersistedAIChatMessage {
    uiId: string;
    pending?: boolean;
}

let messageSeq = 0;

function isBaziResult(result: unknown): result is BaziResult {
    return typeof result === 'object' && result !== null && 'fourPillars' in result && Array.isArray(result.fourPillars);
}

function isCompatResult(result: unknown): result is BaziCompatibilityResult {
    return typeof result === 'object' && result !== null && 'maleProfile' in result && 'femaleProfile' in result;
}

function getInitialPrompt(mode: AIPageEngine): string {
    if (mode === 'bazi') return getBaziFoundationPrompt();
    if (mode === 'ziwei') return getZiweiFoundationPrompt();
    if (mode === 'baziCompatibility') return '请进行八字合盘详批';
    return '请帮我全面分析一下此卦！';
}

function getQuickReplies(result: AIPageResult): string[] {
    return isCompatResult(result) ? [] : result.quickReplies ?? [];
}

function isZiweiResult(result: AIPageResult): result is ZiweiRecordResult {
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

function buildHeaderMeta(result: AIPageResult): { title: string; subtitle: string } {
    if (isCompatResult(result)) {
        return { title: '合盘详批', subtitle: `${result.maleProfile.name || '男方'} × ${result.femaleProfile.name || '女方'}` };
    }

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
    // 继续生成时，已写出的部分从一开始就留在原处。
    const keepsDraftVisible = ((job.status === 'running' || job.status === 'reasoning') && Boolean(job.draftContent))
        || job.status === 'streaming'
        || job.status === 'validating'
        || job.status === 'postprocessing'
        || job.status === 'saving'
        || job.status === 'failed'
        || job.status === 'interrupted';
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
    const activeModel = useActiveAIModel(visible);
    const latestResultRef = useRef<AIPageResult>(result);
    const latestBaziContextRef = useRef<BaziFormatterContext | undefined>(baziContext);
    const latestZiweiContextRef = useRef<ZiweiFormatterContext | undefined>(ziweiContext);
    const latestMessagesRef = useRef<UIChatMessage[]>([]);
    const visibleRef = useRef(visible);
    const loadingRef = useRef(false);
    const modalShownRef = useRef(false);
    const autoStartPendingRef = useRef(false);
    const autoStartTaskRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);
    const syncedAnalysisJobResultRef = useRef<AIPageResult | null>(null);

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
    const [, setArtifactNotice] = useState<string | null>(null);
    const [requestDebugMeta, setRequestDebugMeta] = useState<AIRequestDebugMeta | null>(null);
    const [menuVisible, setMenuVisible] = useState(false);
    const [headerBottom, setHeaderBottom] = useState(0);
    const [hasFoundationAttempted, setHasFoundationAttempted] = useState(false);
    const [presentationState, setPresentationState] = useState<ChatPresentationState>('idle');
    const [analysisJob, setAnalysisJob] = useState<AIAnalysisJobState | null>(null);
    const workflowMode: AIPageEngine = isBaziResult(result)
        ? 'bazi'
        : isZiweiResult(result) ? 'ziwei' : isCompatResult(result) ? 'baziCompatibility' : 'liuyao';
    const stagedMode = workflowMode === 'bazi' || workflowMode === 'ziwei';
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
            const updatedResult = analysisJob.result as AIPageResult;
            setQuickReplies(getQuickReplies(updatedResult));
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
                setQuickReplies(getQuickReplies(result));
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
                            : getQuickReplies(result),
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
        if (isCompatResult(baseResult)) throw new Error('合盘详批没有分阶段会话');
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
            /** Text written before a cut-off, for 继续生成. */
            continuation?: string;
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
            ...(options.continuation ? { continuation: { partial: options.continuation } } : {}),
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
                getInitialPrompt(workflowMode),
                {
                    isAutoInitial: true,
                    hiddenUser: workflowMode !== 'liuyao',
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
            const current = latestResultRef.current;
            if (isCompatResult(current)) {
                await Clipboard.setStringAsync(current.aiAnalysis ?? '');
                CustomAlert.alert('已复制', '合盘详批全文已复制。');
                return;
            }
            await shareChatMarkdown(current, toPersistedMessages(displayMessages));
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

    const handleRetryAnalysisJob = (continueFromDraft = false) => {
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
            continuation: continueFromDraft ? analysisJob.draftContent : undefined,
        });
    };

    const handleResetAnalysis = () => {
        setMenuVisible(false);
        if (workflowMode === 'baziCompatibility') {
            CustomAlert.alert('重新生成合盘详批？', '新的详批写完并保存后才会替换现在这份。', [
                { text: '取消', style: 'cancel' },
                { text: '重新生成', onPress: () => void handleSend(getInitialPrompt(workflowMode), { isAutoInitial: true, hiddenUser: true, baseMessagesOverride: [] }) },
            ]);
            return;
        }

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
                        getInitialPrompt(workflowMode),
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

    const isCompat = workflowMode === 'baziCompatibility';
    const jobActive = isActiveAIAnalysisJob(analysisJob);
    const menuItems: OverflowMenuItem[] = [
        { key: 'details', label: detailsVisible ? '收起分析详情' : '分析详情', onPress: () => { setDetailsVisible(!detailsVisible); setMenuVisible(false); } },
        ...(isCancellableAIAnalysisJob(analysisJob)
            ? [{ key: 'cancel-analysis', label: '停止生成', onPress: handleCancelAnalysisJob, destructive: true }]
            : []),
        { key: 'copy', label: '复制最后一段', onPress: handleCopyLatestAssistant, disabled: isLoading },
        ...(!isCompat ? [{ key: 'retry', label: '重试上一问', onPress: handleRetryLastQuestion, disabled: isLoading || ziweiAnalysisStale || (stagedMode && workflowStage !== 'followup_ready') || !buildRetryPlan(messages) }] : []),
        { key: 'export', label: isCompat ? '复制全文' : '导出会话', onPress: handleExportChat, disabled: isLoading },
        { key: 'reset', label: isCompat ? '重新生成详批' : '重置分析', onPress: handleResetAnalysis, disabled: isLoading, destructive: !isCompat },
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
    const composerLockReason = isCompat ? '合盘详批暂不支持追问'
        : ziweiStaleNotice ? '盘据已变化，请先重新开始分析'
            : jobActive ? '正在生成，写完后可以继续追问'
                : kinshipSaving ? '正在保存…'
                    : stagedMode && workflowStage !== 'followup_ready' ? '完成卷三后开放追问'
                        : undefined;

    /* ---------- chapters ---------- */
    const pageStyles = useMemo(() => makeAIPageStyles(Colors), [Colors]);
    const aiMarkdownStyles = useMemo(() => makeAIMarkdownStyles(Colors), [Colors]);
    const jobFailed = analysisJob?.status === 'failed' || analysisJob?.status === 'interrupted';
    const chapters = useMemo(() => deriveChapters(workflowMode, displayMessages, analysisJob ? {
        active: jobActive, failed: jobFailed, expectedCompletion: analysisJob.expectedCompletion, phase: analysisJob.phase,
    } : null), [workflowMode, displayMessages, jobActive, jobFailed, analysisJob?.expectedCompletion, analysisJob?.phase]);
    const shownChapters = chapters.filter((chapter) => chapter.status !== 'todo');
    const anchorChapter = shownChapters.find((chapter) => chapter.status === 'running' || chapter.status === 'failed')
        ?? shownChapters[shownChapters.length - 1];
    const runningChapter = jobActive && analysisJob ? getJobChapter(workflowMode, analysisJob) : null;
    const getDisplayContent = useCallback((message: UIChatMessage) => message.content, []);

    /* ---------- app-side year facts ---------- */
    const yearCache = useMemo(() => new Map<number, { meta?: ChapterYearMeta; panel?: React.ReactNode }>(), [result, pageStyles]);
    const yearMeta = useCallback((year: number): ChapterYearMeta | undefined => {
        const cached = yearCache.get(year);
        if (cached?.meta) return cached.meta;
        let meta: ChapterYearMeta | undefined;
        if (isBaziResult(result)) {
            const info = getBaziYearInfo(result, year);
            if (info) {
                const daYun = info.daYunGanZhi
                    ? `大运 ${info.previousDaYunGanZhi ? `${info.previousDaYunGanZhi}→` : ''}${info.daYunGanZhi}` : '小运期';
                meta = { ganZhi: info.ganZhi, meta: `${info.age}岁 · ${daYun}` };
            }
        } else if (isZiweiResult(result)) {
            const overview = getZiweiYearOverviews(result, [year])[year];
            if (overview) meta = { ganZhi: overview.ganZhi, meta: `大限 ${overview.decadalPalace}${overview.decadalRange ? `（${overview.decadalRange}）` : ''}` };
        }
        yearCache.set(year, { ...cached, meta });
        return meta;
    }, [result, yearCache]);
    const renderYearPanel = useCallback((year: number): React.ReactNode => {
        const cached = yearCache.get(year);
        if (cached && 'panel' in cached) return cached.panel;
        let panel: React.ReactNode = null;
        if (isBaziResult(result)) {
            const energy = getBaziYearEnergy(result, year);
            if (energy) panel = <EnergyPanel energy={energy} title={`${year} 五行占比`} styles={pageStyles} Colors={Colors} />;
        } else if (isZiweiResult(result)) {
            const overview = getZiweiYearOverviews(result, [year])[year];
            if (overview) {
                panel = (
                    <View style={pageStyles.yearPanel}>
                        <View style={pageStyles.yearPanelHead}>
                            <Text style={pageStyles.yearPanelTitle}>{year} {overview.ganZhi} · 流年命宫在{overview.yearlyPalace}</Text>
                            <Text style={pageStyles.yearPanelMeta}>大限 {overview.decadalPalace}</Text>
                        </View>
                        <MutagenChips items={overview.mutagens} styles={pageStyles} Colors={Colors} />
                    </View>
                );
            }
        }
        yearCache.set(year, { ...cached, panel });
        return panel;
    }, [result, yearCache, pageStyles, Colors]);
    const ziweiOverview = useMemo(() => (isZiweiResult(result) ? getZiweiNatalOverview(result) : null), [result]);
    const natalEnergy = useMemo(() => (isBaziResult(result) ? getBaziNatalEnergy(result) : null), [result]);

    /* ---------- 卷二 marks ---------- */
    const verificationMarks = useMemo(() => (isBaziResult(result) || isZiweiResult(result) ? getActiveVerificationMarks(result) : undefined), [result]);
    const marksEnabled = stagedMode && !jobActive && !ziweiStaleNotice
        && Boolean((isBaziResult(result) || isZiweiResult(result)) && result.aiVerificationSummary?.trim());
    const handleMark = useCallback((year: number, summary: string, mark: AIVerificationMark | null) => {
        const current = latestResultRef.current;
        if (!isBaziResult(current) && !isZiweiResult(current)) return;
        const engine = isBaziResult(current) ? 'bazi' : 'ziwei';
        void setVerificationMark<BaziResult | ZiweiRecordResult>(engine, current.id, current.aiVerificationSummary ?? '', year, summary, mark)
            .then((saved) => {
                if (!saved) throw new Error('前事核验已经更新，请在新版本上标记。');
                latestResultRef.current = saved;
                onUpdateResult(saved);
            })
            .catch((error: unknown) => CustomAlert.alert('标记没有保存', error instanceof Error ? error.message : String(error)));
    }, [onUpdateResult]);
    const markCount = Object.keys(verificationMarks ?? {}).length;

    /* ---------- scrolling: follow only when the reader is at the bottom ---------- */
    const scrollRef = useRef<ScrollView>(null);
    const chapterYRef = useRef<Partial<Record<ChapterId, number>>>({});
    const metricsRef = useRef({ offset: 0, height: 0, content: 0 });
    const followRef = useRef(false);
    const userScrollingRef = useRef(false);
    const pendingScrollRef = useRef<ChapterId | 'end' | null>(null);
    const [showNewPill, setShowNewPill] = useState(false);
    const [viewportHeight, setViewportHeight] = useState(0);
    const [currentChapterId, setCurrentChapterId] = useState<ChapterId | undefined>();

    useEffect(() => {
        if (!jobActive) setShowNewPill(false);
    }, [jobActive]);

    const scrollToChapter = useCallback((id: ChapterId, animated = true) => {
        const y = chapterYRef.current[id];
        if (y === undefined) return false;
        scrollRef.current?.scrollTo({ y: Math.max(0, y - 8), animated });
        setCurrentChapterId(id);
        return true;
    }, []);

    // A new chapter starts at its top; a follow-up question follows the answer.
    useEffect(() => {
        if (!runningChapter) return;
        setShowNewPill(false);
        if (runningChapter === 'followup' || runningChapter === 'liuyao' || runningChapter === 'compat') {
            followRef.current = true;
            pendingScrollRef.current = 'end';
            scrollRef.current?.scrollToEnd({ animated: true });
            return;
        }
        followRef.current = false;
        pendingScrollRef.current = runningChapter;
        if (scrollToChapter(runningChapter)) pendingScrollRef.current = null;
    }, [runningChapter, analysisJob?.jobId, scrollToChapter]);

    // Reopening lands on the newest chapter rather than the top or the very end.
    useEffect(() => {
        if (!visible) return;
        followRef.current = false;
        setShowNewPill(false);
        const anchor = anchorChapter?.id ?? null;
        pendingScrollRef.current = anchor;
        // The card may already have reported its position before this effect ran.
        if (anchor && scrollToChapter(anchor, false)) pendingScrollRef.current = null;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible, result.id]);

    const handleChapterLayout = useCallback((id: ChapterId, y: number) => {
        chapterYRef.current[id] = y;
        if (pendingScrollRef.current === id) {
            pendingScrollRef.current = null;
            requestAnimationFrame(() => scrollToChapter(id, false));
        }
    }, [scrollToChapter]);
    const chapterLayoutHandlers = useMemo(() => Object.fromEntries(chapters.map((chapter) => [
        chapter.id, (y: number) => handleChapterLayout(chapter.id, y),
    ])) as Record<ChapterId, (y: number) => void>, [chapters.length, handleChapterLayout]);

    const handleScroll = (event: { nativeEvent: { contentOffset: { y: number }; layoutMeasurement: { height: number }; contentSize: { height: number } } }) => {
        const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
        metricsRef.current = { offset: contentOffset.y, height: layoutMeasurement.height, content: contentSize.height };
        const nearBottom = contentOffset.y + layoutMeasurement.height >= contentSize.height - 48;
        if (userScrollingRef.current) followRef.current = nearBottom;
        if (nearBottom) setShowNewPill(false);
        const position = contentOffset.y + 48;
        let current: ChapterId | undefined;
        shownChapters.forEach((chapter) => {
            const y = chapterYRef.current[chapter.id];
            if (y !== undefined && y <= position) current = chapter.id;
        });
        // At the very bottom the last chapter is the one being read, even if its top can't reach the header.
        if (nearBottom && shownChapters.length) current = shownChapters[shownChapters.length - 1].id;
        if (current && current !== currentChapterId) setCurrentChapterId(current);
    };
    const handleContentSizeChange = (_width: number, height: number) => {
        const previous = metricsRef.current.content;
        metricsRef.current.content = height;
        if (pendingScrollRef.current === 'end' || followRef.current) {
            pendingScrollRef.current = null;
            scrollRef.current?.scrollToEnd({ animated: false });
            return;
        }
        const { offset, height: viewport } = metricsRef.current;
        if (jobActive && height > previous + 4 && offset + viewport < height - 48) setShowNewPill(true);
    };

    /* ---------- footer: progress, failure, or the next step ---------- */
    const describeFailure = (job: AIAnalysisJobState): { title: string; message: string; lighter: boolean } => {
        const kept = job.draftContent ? '已写出的部分留在上方，可以从断处继续生成，也可以整段重新生成。' : '可以重新生成。';
        if (job.status === 'interrupted') return { title: '上次生成被中断', message: `App 在生成途中被系统关闭。${kept}`, lighter: false };
        const code = job.failure?.code;
        const status = readFailureStatus(job.failure?.message);
        const friendly = describeProviderFailure(status, job.failure?.message);
        // Long thinking is the usual cause of truncation and gateway timeouts, so these offer a lighter level.
        if (code === 'token_limit') return { title: '正文没写完', message: `思考占用了大部分输出额度，模型在写完前停下了。${kept}`, lighter: true };
        if (code === 'network_error' || code === 'timeout') return { title: friendly?.title ?? '连接中断', message: `${friendly?.hint ?? '和接口的连接断开了。'}${kept}`, lighter: friendly ? Boolean(friendly.thinkingRelated) : true };
        if (code === 'invalid_response' || code === 'empty_response') return { title: '回复没有写完', message: `模型提前结束了回复。${kept}`, lighter: false };
        if (code === 'record_changed') return { title: '记录已变化', message: job.failure?.message ?? '', lighter: false };
        if (code === 'missing_api_key' || code === 'missing_api_url' || code === 'invalid_configuration') return { title: '接口还没配置好', message: job.failure?.message ?? '请到设置里检查接口与 Key。', lighter: false };
        if (code === 'http_error') {
            return friendly
                ? { title: friendly.title, message: `${friendly.hint}详情里有接口原话。`, lighter: Boolean(friendly.thinkingRelated) }
                : { title: '接口返回错误', message: '接口拒绝了这次请求，常见原因是额度、模型名或 Key。详情里有接口原话。', lighter: false };
        }
        return { title: '生成失败', message: job.failure?.message ?? '请稍后重试。', lighter: false };
    };

    /** One stop lighter than what the active model is set to, if there is one. */
    const lighterLevel = (() => {
        const model = activeModel.model;
        if (!model || activeModel.lock || activeModel.stops.length < 2) return undefined;
        const shown = resolveShownLevel(model.reasoning, activeModel.stops, model.thinkingBudgetTokens);
        const current = shown === 'default' ? getAutoRestIndex(activeModel.stops) : activeModel.stops.indexOf(shown);
        return current > 0 ? activeModel.stops[current - 1] : undefined;
    })();
    const retryLighter = () => {
        if (!lighterLevel) return;
        setActiveModelReasoning(lighterLevel)
            .then(() => handleRetryAnalysisJob())
            .catch((error: unknown) => CustomAlert.alert('思考强度未保存', error instanceof Error ? error.message : '请稍后重试。'));
    };

    const renderNextStep = (): React.ReactNode => {
        if (ziweiStaleNotice) {
            return (
                <View style={pageStyles.footer}>
                    <View style={[pageStyles.banner, pageStyles.bannerWarn]}>
                        <Text style={pageStyles.bannerTitle}>{ziweiStaleNotice.title}</Text>
                        <Text style={pageStyles.bannerText}>{ziweiStaleNotice.body}</Text>
                        <ActionButton label="按当前资料重新开始" primary small styles={pageStyles} onPress={() => { void restartBaziWorkflow(); }} />
                    </View>
                </View>
            );
        }
        if (analysisJob && jobActive) {
            return <ProgressBlock status={analysisJob.status} startedAt={analysisJob.startedAt} styles={pageStyles}
                modelLabel={formatRunLabel(analysisJob.executionMeta)}
                onStop={isCancellableAIAnalysisJob(analysisJob) ? handleCancelAnalysisJob : undefined} />;
        }
        if (analysisJob && jobFailed) {
            const failure = describeFailure(analysisJob);
            // A cut-off reply can be finished from where it stopped; JSON stages (六亲) cannot.
            const canContinue = Boolean(analysisJob.draftContent.trim())
                && !isKinshipResponseKind(analysisJob.expectedCompletion)
                && (analysisJob.status === 'interrupted'
                    || ['token_limit', 'network_error', 'timeout', 'invalid_response'].includes(analysisJob.failure?.code ?? ''));
            const lighter = failure.lighter && lighterLevel
                ? { label: `降到「${getReasoningLabel(lighterLevel)}」重新生成`, onPress: retryLighter } : undefined;
            const actions = canContinue
                ? [{ label: '继续生成', primary: true, onPress: () => handleRetryAnalysisJob(true) }, lighter ?? { label: '重新生成', onPress: () => handleRetryAnalysisJob() }]
                : [{ label: '重新生成', primary: true, onPress: () => handleRetryAnalysisJob() }, ...(lighter ? [lighter] : [])];
            return <FailureBanner title={failure.title} message={failure.message} styles={pageStyles}
                detail={analysisJob.failure ? `${analysisJob.failure.code}：${analysisJob.failure.message}` : undefined}
                actions={actions} />;
        }
        if (analysisJob?.status === 'cancelled') {
            return (
                <View style={pageStyles.footer}>
                    <Text style={pageStyles.footerText}>已停止，这次的内容没有保存。</Text>
                    <ActionButton label="重新生成" small styles={pageStyles} onPress={() => handleRetryAnalysisJob()} />
                </View>
            );
        }
        if (presentationState === 'preparing_request' && messages.length === 0) {
            return <ProgressBlock status="running" styles={pageStyles} />;
        }
        if (showInitialResetAction) {
            return (
                <View style={pageStyles.footer}>
                    <Text style={pageStyles.footerText}>基础分析还没有完成。</Text>
                    <ActionButton label="重试基础分析" primary styles={pageStyles} onPress={() => { void restartBaziWorkflow(); }} />
                </View>
            );
        }
        if (kinshipWorkflow && (workflowStage === 'foundation_ready' || workflowStage === 'kinship_ready') && !baziAnalysisStale && !isLoading) {
            const attempted = Boolean(kinshipState?.attempts.length);
            return (
                <View style={pageStyles.footer}>
                    <Text style={pageStyles.footerText}>
                        卷一已完成。下一步是<Text style={pageStyles.footerStrong}>前事核验</Text>：挑几个过去的年份给你核对，用来校准后面的推断。
                    </Text>
                    {attempted ? (
                        <View style={{ gap: 8 }}>
                            <Text style={pageStyles.hint}>六亲初验和你的实际情况吻合吗？</Text>
                            <View style={pageStyles.seg} accessibilityRole="radiogroup" accessibilityLabel="六亲初验反馈">
                                {(['matched', 'mismatched', 'unknown'] as const).map((choice) => {
                                    const disabled = kinshipSaving || (choice === 'matched' && kinshipUndetermined);
                                    const on = feedbackChoice === choice;
                                    return (
                                        <TouchableOpacity key={choice} accessibilityRole="radio" accessibilityState={{ checked: on, disabled }} disabled={disabled}
                                            style={[pageStyles.segBtn, on && pageStyles.segBtnOn, disabled && pageStyles.btnDisabled]}
                                            onPress={() => { setFeedbackChoice(choice); if (choice === 'mismatched') setFeedbackVisible(true); }}>
                                            <Text style={[pageStyles.segText, on && pageStyles.segTextOn]}>{KINSHIP_FEEDBACK_LABELS[choice]}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                            {kinshipUndetermined ? <Text style={pageStyles.hint}>初验里独生或排行没有判定，所以不能直接选“吻合”；可以填写实际情况。</Text> : null}
                        </View>
                    ) : null}
                    <ActionButton label={workflowStage === 'kinship_ready' ? '继续前事核验' : '开始前事核验'} primary disabled={kinshipSaving}
                        styles={pageStyles} onPress={() => { void handleKinshipContinue(feedbackChoice); }} />
                    {!attempted && !kinshipState?.actualFeedback ? (
                        <View style={pageStyles.option}>
                            <Text style={pageStyles.optionText}>可选：先让 AI 推一次兄弟姐妹与排行，对照你的实际情况。</Text>
                            <ActionButton label="六亲初验" small disabled={kinshipSaving} styles={pageStyles} onPress={() => { void runKinshipAction(handleStartKinship); }} />
                        </View>
                    ) : null}
                    <TouchableOpacity style={pageStyles.linkBtn} disabled={kinshipSaving} onPress={() => setFeedbackVisible(true)}>
                        <Text style={pageStyles.linkText}>{kinshipState?.actualFeedback ? '修改实际家庭情况' : '填写实际家庭情况'}</Text>
                    </TouchableOpacity>
                </View>
            );
        }
        if (showFoundationAction) {
            return (
                <View style={pageStyles.footer}>
                    <Text style={pageStyles.footerText}>
                        卷一已完成。下一步是<Text style={pageStyles.footerStrong}>前事核验</Text>：挑几个过去的年份给你核对，用来校准后面的推断。
                    </Text>
                    <ActionButton label={workflowMode === 'ziwei' ? getLocalZiweiFoundationActionLabel() : getLocalBaziFoundationActionLabel()}
                        primary styles={pageStyles} onPress={() => { void handleStartVerification(); }} />
                </View>
            );
        }
        if (showVerificationActions) {
            const actions = workflowMode === 'ziwei' ? getLocalZiweiVerificationActions() : getLocalBaziVerificationActions();
            const next = actions.find((action) => action.id === 'continue');
            const redo = actions.find((action) => action.id !== 'continue');
            return (
                <View style={pageStyles.footer}>
                    <Text style={pageStyles.footerText}>
                        {markCount > 0 ? `已标记 ${markCount} 条。` : '标记不是必须的。'}看完可以继续<Text style={pageStyles.footerStrong}>今年与未来五年</Text>；整体不准的话，可以重新核验。
                    </Text>
                    {next ? <ActionButton label={next.label} primary styles={pageStyles} onPress={() => handleVerificationActionPress(next)} /> : null}
                    {redo ? <ActionButton label={markCount > 0 ? '按我的标记重新核验' : redo.label} styles={pageStyles} onPress={() => handleVerificationActionPress(redo)} /> : null}
                </View>
            );
        }
        if (detailsVisible && formatRequestEvidenceNotice(requestDebugMeta)) {
            return <Text style={[pageStyles.hint, { marginTop: 10 }]}>{formatRequestEvidenceNotice(requestDebugMeta)}</Text>;
        }
        return null;
    };
    const footer = renderNextStep();

    const chartSummary = isBaziResult(result) ? <BaziChartSummary result={result} natalEnergy={natalEnergy} fortuneEnergy={baziContext?.wuXingEnergy} styles={pageStyles} Colors={Colors} />
        : ziweiOverview ? <ZiweiChartSummary overview={ziweiOverview} subtitle={headerMeta.subtitle} styles={pageStyles} Colors={Colors} />
            : isCompatResult(result) ? <CompatChartSummary result={result} styles={pageStyles} />
                : null;

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={handleClose} onShow={handleModalShow}>
            <GestureHandlerRootView style={pageStyles.flex}>
                <SafeAreaProvider style={pageStyles.container}>
                    <SafeAreaView style={pageStyles.container}>
                        <View style={pageStyles.header} onLayout={({ nativeEvent: { layout } }) => setHeaderBottom(layout.y + layout.height)}>
                            <View style={pageStyles.headerRow}>
                                <TouchableOpacity onPress={handleClose} style={pageStyles.headerBtn} accessibilityRole="button" accessibilityLabel="关闭 AI 分析">
                                    <BackIcon size={24} color={Colors.text.primary} />
                                </TouchableOpacity>
                                <View style={pageStyles.headerTitleWrap}>
                                    {workflowMode === 'liuyao' ? (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                            <Text style={pageStyles.headerTitle} numberOfLines={1}>{headerMeta.title}</Text>
                                            <GuaArrowIcon size={14} color={Colors.accent.gold} />
                                            <Text style={pageStyles.headerTitle} numberOfLines={1}>{headerMeta.subtitle}</Text>
                                        </View>
                                    ) : (
                                        <>
                                            <Text style={pageStyles.headerTitle} numberOfLines={1}>{headerMeta.title}</Text>
                                            <Text style={pageStyles.headerSubtitle} numberOfLines={1}>{headerMeta.subtitle}</Text>
                                        </>
                                    )}
                                </View>
                                <AIModelChip visible={visible} running={jobActive ? analysisJob?.executionMeta : undefined} styles={pageStyles} Colors={Colors} />
                                <TouchableOpacity onPress={() => setMenuVisible((prev) => !prev)} style={pageStyles.headerBtn}
                                    accessibilityRole="button" accessibilityLabel="更多操作" accessibilityState={{ expanded: menuVisible }}>
                                    <MoreVerticalIcon size={20} color={Colors.text.primary} />
                                </TouchableOpacity>
                            </View>
                            {stagedMode ? (
                                <AIStageStepper chapters={chapters} currentId={currentChapterId ?? anchorChapter?.id} styles={pageStyles}
                                    onPress={(id) => { followRef.current = false; scrollToChapter(id); }} />
                            ) : null}
                        </View>
                        <OverflowMenu visible={menuVisible} top={headerBottom} right={Spacing.lg} items={menuItems} onClose={() => setMenuVisible(false)} />

                        <KeyboardAvoidingView style={pageStyles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                            <View style={pageStyles.flex}>
                                <ScrollView
                                    ref={scrollRef}
                                    style={pageStyles.flex}
                                    onLayout={(event) => setViewportHeight(event.nativeEvent.layout.height)}
                                    contentContainerStyle={pageStyles.scrollBody}
                                    onScroll={handleScroll}
                                    scrollEventThrottle={100}
                                    onScrollBeginDrag={() => { userScrollingRef.current = true; }}
                                    onScrollEndDrag={() => { userScrollingRef.current = false; }}
                                    onMomentumScrollBegin={() => { userScrollingRef.current = true; }}
                                    onMomentumScrollEnd={() => { userScrollingRef.current = false; }}
                                    onContentSizeChange={handleContentSizeChange}
                                    keyboardShouldPersistTaps="handled"
                                    showsVerticalScrollIndicator={false}
                                >
                                    {chartSummary}
                                    {shownChapters.map((chapter) => (
                                        <AIChapterCard<UIChatMessage>
                                            key={chapter.id}
                                            chapter={chapter}
                                            styles={pageStyles}
                                            markdownStyles={aiMarkdownStyles}
                                            Colors={Colors}
                                            getDisplayContent={getDisplayContent}
                                            yearMeta={stagedMode ? yearMeta : undefined}
                                            renderYearPanel={stagedMode ? renderYearPanel : undefined}
                                            marks={chapter.id === 'verification' ? verificationMarks : undefined}
                                            onMark={chapter.id === 'verification' && marksEnabled ? handleMark : undefined}
                                            footer={chapter.id === anchorChapter?.id ? footer : undefined}
                                            onLayout={chapterLayoutHandlers[chapter.id]}
                                            minHeight={chapter.id === runningChapter && runningChapter !== 'followup' && viewportHeight > 0
                                                ? viewportHeight - 28 : undefined}
                                        />
                                    ))}
                                    {shownChapters.length === 0 ? (
                                        <View style={pageStyles.chap}>
                                            <View style={pageStyles.chapHead}>
                                                <Text style={pageStyles.chapNo}>{chapters[0]?.no}</Text>
                                                <Text style={pageStyles.chapName}>{chapters[0]?.title}</Text>
                                            </View>
                                            {footer ?? (
                                                <ActionButton label="开始分析" primary styles={pageStyles} onPress={() => {
                                                    void handleSend(getInitialPrompt(workflowMode), {
                                                        isAutoInitial: true, hiddenUser: workflowMode !== 'liuyao', baseMessagesOverride: [],
                                                        expectedCompletion: stagedMode ? 'foundation' : undefined,
                                                        nextWorkflowStage: stagedMode ? 'foundation_ready' : undefined,
                                                    });
                                                }} />
                                            )}
                                        </View>
                                    ) : null}
                                </ScrollView>
                                {showNewPill ? (
                                    <TouchableOpacity style={pageStyles.pill} accessibilityRole="button" onPress={() => {
                                        followRef.current = true;
                                        setShowNewPill(false);
                                        scrollRef.current?.scrollToEnd({ animated: true });
                                    }}>
                                        <Text style={pageStyles.pillText}>↓ 新内容</Text>
                                    </TouchableOpacity>
                                ) : null}
                            </View>
                            <AIComposer
                                value={inputText}
                                onChange={setInputText}
                                onSend={() => { void handleSend(); }}
                                disabledReason={composerLockReason}
                                busy={isLoading}
                                quickReplies={!isLoading && (!stagedMode || workflowStage === 'followup_ready') ? quickReplies : []}
                                onQuickReply={(text) => { void handleSend(text, { isQuickReply: stagedMode }); }}
                                    styles={pageStyles}
                                Colors={Colors}
                            />
                        </KeyboardAvoidingView>
                        <BaziKinshipFeedbackModal visible={feedbackVisible} value={feedbackDraft} busy={kinshipSaving}
                            onChange={setFeedbackDraft} onClose={() => setFeedbackVisible(false)} onSave={saveFeedbackAndContinue} />
                    </SafeAreaView>
                </SafeAreaProvider>
            </GestureHandlerRootView>
        </Modal>
    );
}
