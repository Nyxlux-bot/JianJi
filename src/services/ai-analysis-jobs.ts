import AsyncStorage from '@react-native-async-storage/async-storage';
import { AIConversationStage, PersistedAIChatMessage } from '../core/ai-meta';
import { cloneBaziFormatterContext, BaziFormatterContext } from '../core/bazi-ai-context';
import { BaziResult } from '../core/bazi-types';
import { PanResult, YaoDetail } from '../core/liuyao-calc';
import { getRecord, updateExistingRecordResult } from '../db/database';
import { DivinationEngine, DivinationResult } from '../db/record-types';
import { buildBaziMatchAIMessages, validateBaziMatchAIContent } from '../features/bazi/match/ai';
import { BaziCompatibilityResult } from '../features/bazi/match/types';
import { ZiweiFormatterContext } from '../features/ziwei/ai-context';
import {
    buildZiweiAIConfigSignature,
    ZiweiRecordResult,
} from '../features/ziwei/record';
import {
    AIErrorCode,
    AIRequestDebugMeta,
    AIWorkflowResponseKind,
    analyzeWithAIChatStream,
    buildRequestBundle,
    generateBaziConversationDigest,
    generateQuickReplies,
    generateZiweiConversationDigest,
    getBaziConversationStage,
    getChatRequestOptions,
    getLocalLiuyaoQuickReplies,
    getZiweiConversationStage,
    sanitizeBaziStreamingContent,
    sanitizeZiweiStreamingContent,
    shouldGeneratePostResponseArtifacts,
    stripBaziStageMarkers,
    stripThinkingBlocks,
    stripZiweiStageMarkers,
    validateBaziWorkflowResponse,
    validateZiweiWorkflowResponse,
} from './ai';
import { recordDiagnosticLog } from './diagnostics';

export type AIAnalysisJobStatus =
    | 'running'
    | 'reasoning'
    | 'streaming'
    | 'validating'
    | 'postprocessing'
    | 'saving'
    | 'completed'
    | 'failed'
    | 'interrupted'
    | 'cancelled';

export interface AIAnalysisValidationResult {
    success: boolean;
    issues: string[];
}

export interface AIAnalysisJobRequest {
    engineType: DivinationEngine;
    result: DivinationResult;
    baseMessages: PersistedAIChatMessage[];
    requestMessages: PersistedAIChatMessage[];
    phase: 'initial' | 'followup';
    expectedCompletion?: AIWorkflowResponseKind;
    nextWorkflowStage?: AIConversationStage;
    formatterContext?: BaziFormatterContext | ZiweiFormatterContext;
}

export interface AIAnalysisJobState {
    jobId: string;
    recordId: string;
    engineType: DivinationEngine;
    status: AIAnalysisJobStatus;
    phase: 'initial' | 'followup';
    expectedCompletion?: AIWorkflowResponseKind;
    nextWorkflowStage?: AIConversationStage;
    baseMessages: PersistedAIChatMessage[];
    requestMessages: PersistedAIChatMessage[];
    messages: PersistedAIChatMessage[];
    draftContent: string;
    validatedContent: string;
    failure?: {
        code: AIErrorCode;
        message: string;
    };
    validation?: AIAnalysisValidationResult;
    debugMeta?: AIRequestDebugMeta;
    result?: DivinationResult;
    startedAt: string;
    updatedAt: string;
}

type AIAnalysisJobListener = (job: AIAnalysisJobState | null) => void;
type JobEmitMode = 'immediate' | 'deferred' | 'none';

const activeControllers = new Map<string, AbortController>();
const jobStates = new Map<string, AIAnalysisJobState>();
const listeners = new Map<string, Set<AIAnalysisJobListener>>();
const emitTimers = new Map<string, ReturnType<typeof setTimeout>>();
const persistenceQueues = new Map<string, Promise<void>>();
const STORAGE_PREFIX = 'ai_analysis_job_v1_';
const LEGACY_LIUYAO_STORAGE_PREFIX = 'liuyao_ai_job_';
const STREAMING_EMIT_INTERVAL_MS = 250;

function jobKey(engineType: DivinationEngine, recordId: string): string {
    return `${engineType}:${recordId}`;
}

function storageKey(engineType: DivinationEngine, recordId: string): string {
    return `${STORAGE_PREFIX}${engineType}_${recordId}`;
}

function createJobId(engineType: DivinationEngine, recordId: string): string {
    return `${engineType}-${recordId}-${Date.now()}`;
}

export function isActiveAIAnalysisJob(job?: AIAnalysisJobState | null): boolean {
    return job?.status === 'running'
        || job?.status === 'reasoning'
        || job?.status === 'streaming'
        || job?.status === 'validating'
        || job?.status === 'postprocessing'
        || job?.status === 'saving';
}

export function isCancellableAIAnalysisJob(job?: AIAnalysisJobState | null): boolean {
    return isActiveAIAnalysisJob(job) && job?.status !== 'saving';
}

function publish(key: string): void {
    const job = jobStates.get(key) ?? null;
    listeners.get(key)?.forEach((listener) => listener(job));
}

function clearScheduledEmit(key: string): void {
    const timer = emitTimers.get(key);
    if (!timer) {
        return;
    }
    clearTimeout(timer);
    emitTimers.delete(key);
}

function emit(key: string, mode: JobEmitMode = 'immediate'): void {
    if (mode === 'none') {
        return;
    }
    if (mode === 'deferred') {
        if (emitTimers.has(key)) {
            return;
        }
        const timer = setTimeout(() => {
            emitTimers.delete(key);
            publish(key);
        }, STREAMING_EMIT_INTERVAL_MS);
        emitTimers.set(key, timer);
        return;
    }
    clearScheduledEmit(key);
    publish(key);
}

async function persistJob(job: AIAnalysisJobState): Promise<void> {
    const key = storageKey(job.engineType, job.recordId);
    const previous = persistenceQueues.get(key) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(async () => {
        await AsyncStorage.setItem(key, JSON.stringify({
            ...job,
            draftContent: '',
            validatedContent: '',
            result: undefined,
        }));
    }).catch((error) => {
        void recordDiagnosticLog({
            level: 'warn',
            source: 'AI:jobStorage',
            message: 'persist_failed',
            context: { error: error instanceof Error ? error.message : String(error) },
        });
    });
    persistenceQueues.set(key, next);
    await next;
    if (persistenceQueues.get(key) === next) {
        persistenceQueues.delete(key);
    }
}

async function clearPersistedJob(engineType: DivinationEngine, recordId: string): Promise<void> {
    const key = storageKey(engineType, recordId);
    const previous = persistenceQueues.get(key) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(async () => {
        await AsyncStorage.removeItem(key);
    }).catch((error) => {
        void recordDiagnosticLog({
            level: 'warn',
            source: 'AI:jobStorage',
            message: 'clear_failed',
            context: { error: error instanceof Error ? error.message : String(error) },
        });
    });
    persistenceQueues.set(key, next);
    await next;
    if (persistenceQueues.get(key) === next) {
        persistenceQueues.delete(key);
    }
}

function setJobState(
    key: string,
    patch: Partial<AIAnalysisJobState>,
    options: { emit?: JobEmitMode; persist?: boolean } = {},
): AIAnalysisJobState {
    const previous = jobStates.get(key);
    if (!previous) {
        throw new Error('AI analysis job is not initialized');
    }
    const next: AIAnalysisJobState = {
        ...previous,
        ...patch,
        updatedAt: new Date().toISOString(),
    };
    jobStates.set(key, next);
    if (options.persist !== false) {
        void persistJob(next);
    }
    emit(key, options.emit ?? 'immediate');
    return next;
}

function isCurrentJob(key: string, jobId: string): boolean {
    return jobStates.get(key)?.jobId === jobId;
}

function stripEmoji(content: string): string {
    return content.replace(/[\p{Extended_Pictographic}\uFE0F]/gu, '');
}

function cleanStreamContent(engineType: DivinationEngine, content: string): string {
    if (engineType === 'bazi') {
        return sanitizeBaziStreamingContent(content);
    }
    if (engineType === 'ziwei') {
        return sanitizeZiweiStreamingContent(content);
    }
    if (engineType === 'baziCompatibility') {
        return stripEmoji(stripThinkingBlocks(content)).trim();
    }
    return stripThinkingBlocks(content).trim();
}

function cleanFinalContent(engineType: DivinationEngine, content: string): string {
    if (engineType === 'bazi') {
        return stripBaziStageMarkers(content);
    }
    if (engineType === 'ziwei') {
        return stripZiweiStageMarkers(content);
    }
    if (engineType === 'baziCompatibility') {
        return stripEmoji(stripThinkingBlocks(content)).trim();
    }
    return stripThinkingBlocks(content).trim();
}

function getLastAssistantContent(messages: PersistedAIChatMessage[]): string | undefined {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
        const message = messages[index];
        if (message.role === 'assistant' && message.content.trim()) {
            return message.content.trim();
        }
    }
    return undefined;
}

function arePersistedMessagesEqual(left: PersistedAIChatMessage, right: PersistedAIChatMessage): boolean {
    return left.role === right.role
        && left.content === right.content
        && left.hidden === right.hidden
        && left.requestContent === right.requestContent;
}

function arePersistedMessageListsEqual(left: PersistedAIChatMessage[], right: PersistedAIChatMessage[]): boolean {
    return left.length === right.length
        && left.every((message, index) => arePersistedMessagesEqual(message, right[index]));
}

function getRequestDebugMeta(request: AIAnalysisJobRequest): AIRequestDebugMeta | undefined {
    if (request.engineType !== 'baziCompatibility') {
        return undefined;
    }
    const messages = buildBaziMatchAIMessages(request.result as BaziCompatibilityResult);
    return {
        mode: 'bazi',
        requestType: 'main',
        workflowStage: 'followup',
        usedDynamicEvidencePack: true,
        usedDigest: false,
        compatibilityMode: true,
        systemCharCount: messages[0]?.content.length || 0,
        messageCount: messages.length,
    };
}

function validateContent(
    request: AIAnalysisJobRequest,
    rawContent: string,
    cleanContent: string,
): AIAnalysisValidationResult {
    if (request.engineType === 'bazi' && request.expectedCompletion) {
        const validation = validateBaziWorkflowResponse(request.expectedCompletion, rawContent);
        return { success: validation.success, issues: validation.issues };
    }
    if (request.engineType === 'ziwei' && request.expectedCompletion) {
        const validation = validateZiweiWorkflowResponse(request.expectedCompletion, rawContent);
        return { success: validation.success, issues: validation.issues };
    }
    if (request.engineType === 'liuyao') {
        const validation = validateLiuyaoAIContent(request.result as PanResult, cleanContent, request.phase);
        return { success: validation.success, issues: validation.issues };
    }
    if (request.engineType === 'baziCompatibility') {
        const issues = validateBaziMatchAIContent(cleanContent);
        return { success: issues.length === 0, issues };
    }
    return { success: Boolean(cleanContent), issues: cleanContent ? [] : ['正文为空'] };
}

function hasAny(text: string, values: string[]): boolean {
    return values.some((value) => value.trim().length > 0 && text.includes(value.trim()));
}

function yaoPositionName(position: number): string {
    return ['初', '二', '三', '四', '五', '上'][position - 1] || String(position);
}

function yaoAnchorValues(yao: YaoDetail): string[] {
    return [
        yao.liuQin,
        yao.liuQinShort,
        yao.liuShen,
        yao.liuShenShort,
        yao.zhi,
        yao.wuxing,
    ].filter(Boolean);
}

function buildEvidenceAnchorGroups(result: PanResult): Array<{ label: string; values: string[]; required?: boolean }> {
    const groups: Array<{ label: string; values: string[]; required?: boolean }> = [
        { label: '本卦', values: [result.benGua.fullName, result.benGua.name, result.benGua.gong], required: true },
        { label: '世应', values: ['世爻', '应爻', `第${result.benGua.shiYao}爻`, `第${result.benGua.yingYao}爻`], required: true },
        { label: '日月建', values: [result.monthGanZhi, result.dayGanZhi, result.monthGanZhi[1], result.dayGanZhi[1]], required: true },
        { label: '旬空', values: [...(result.xunKong ?? []), '空亡', '旬空'] },
    ];

    if (result.bianGua) {
        groups.push({ label: '变卦', values: [result.bianGua.fullName, result.bianGua.name], required: true });
    }

    if (result.movingYaoPositions.length > 0) {
        const movingValues = result.movingYaoPositions.flatMap((position) => {
            const yao = result.benGuaYao[position - 1];
            return [
                '动爻',
                `${yaoPositionName(position)}爻`,
                `第${position}爻`,
                ...(yao ? yaoAnchorValues(yao) : []),
            ];
        });
        groups.push({ label: '动爻', values: movingValues, required: true });
    } else {
        groups.push({ label: '静卦', values: ['无动爻', '静卦', '不变'] });
    }

    const yaoValues = result.benGuaYao.flatMap(yaoAnchorValues);
    groups.push({ label: '六亲六神', values: Array.from(new Set(yaoValues)) });
    return groups;
}

export function validateLiuyaoAIContent(
    result: PanResult,
    content: string,
    phase: 'initial' | 'followup' = 'initial',
): AIAnalysisValidationResult & { missingSections: string[]; missingEvidenceAnchors: string[] } {
    const normalized = stripThinkingBlocks(content).trim();
    const anchorGroups = buildEvidenceAnchorGroups(result);
    const hitCount = anchorGroups.filter((group) => hasAny(normalized, group.values)).length;
    const missingEvidenceAnchors = phase === 'initial'
        ? anchorGroups
            .filter((group) => group.required && !hasAny(normalized, group.values))
            .map((group) => group.label)
        : [];

    if (phase === 'followup') {
        const issues = [
            ...(normalized.length < 80 ? ['正文过短'] : []),
            ...(hitCount < 2 ? [`盘面锚点不足（${hitCount}/2）`] : []),
        ];
        return {
            success: issues.length === 0,
            issues,
            missingSections: [],
            missingEvidenceAnchors: issues.filter((item) => item.includes('盘面锚点')),
        };
    }

    const movingLabels = result.movingYaoPositions.flatMap((position) => [`${yaoPositionName(position)}爻`, `第${position}爻`]);
    const movingYaoPattern = result.movingYaoPositions.length > 0
        ? new RegExp(`动爻|动变|变卦|变爻|发动|化出|化为|之卦|${movingLabels.join('|')}`, 'u')
        : /无动爻|静卦|不变/u;
    const sectionChecks: Array<{ label: string; pattern: RegExp }> = [
        { label: '整体卦意', pattern: /整体|总断|卦意|本卦/u },
        { label: '世应关系', pattern: /世应|世爻|应爻/u },
        { label: '用神忌神', pattern: /用神|忌神/u },
        { label: '动变分析', pattern: movingYaoPattern },
        { label: '应期推算', pattern: /应期|时间|月份|日期|日辰|时机/u },
        { label: '趋避建议', pattern: /建议|趋避|行动|风险|提醒/u },
    ];
    const missingSections = sectionChecks
        .filter((item) => !item.pattern.test(normalized))
        .map((item) => item.label);
    const minAnchorHitCount = Math.min(4, anchorGroups.length);
    if (hitCount < minAnchorHitCount) {
        missingEvidenceAnchors.push(`盘面锚点不足（${hitCount}/${minAnchorHitCount}）`);
    }
    const issues = [
        ...missingSections.map((item) => `缺少${item}`),
        ...missingEvidenceAnchors.map((item) => `缺少${item}引用`),
    ];
    return {
        success: issues.length === 0,
        issues,
        missingSections,
        missingEvidenceAnchors: Array.from(new Set(missingEvidenceAnchors)),
    };
}

async function buildMessagesForRequest(request: AIAnalysisJobRequest): Promise<{
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    debugMeta?: AIRequestDebugMeta;
    requestResult: DivinationResult;
}> {
    if (request.engineType === 'baziCompatibility') {
        return {
            messages: buildBaziMatchAIMessages(request.result as BaziCompatibilityResult),
            debugMeta: getRequestDebugMeta(request),
            requestResult: request.result,
        };
    }

    let requestResult = request.result;
    let formatterContext = request.formatterContext;
    if (request.engineType === 'bazi') {
        const snapshot = cloneBaziFormatterContext(request.formatterContext as BaziFormatterContext | undefined);
        requestResult = {
            ...(request.result as BaziResult),
            aiContextSnapshot: snapshot ?? (request.result as BaziResult).aiContextSnapshot,
        };
        formatterContext = snapshot;
    }
    const workflowStage = request.expectedCompletion
        ?? (request.phase === 'followup' ? 'followup' : undefined);
    const bundle = await buildRequestBundle(
        requestResult as PanResult | BaziResult | ZiweiRecordResult,
        request.requestMessages,
        formatterContext,
        { workflowStage },
    );
    return {
        messages: bundle.messages,
        debugMeta: bundle.debugMeta,
        requestResult,
    };
}

async function generateArtifacts(
    request: AIAnalysisJobRequest,
    result: PanResult | BaziResult | ZiweiRecordResult,
    finalMessages: PersistedAIChatMessage[],
    nextStage?: AIConversationStage,
): Promise<{
    quickReplies: string[];
    digest?: BaziResult['aiConversationDigest'] | ZiweiRecordResult['aiConversationDigest'];
}> {
    const shouldGenerate = request.engineType === 'liuyao'
        || shouldGeneratePostResponseArtifacts(result, nextStage ?? request.phase);
    if (!shouldGenerate) {
        return { quickReplies: [] };
    }

    let quickReplyOutcome;
    let digestOutcome;
    try {
        [quickReplyOutcome, digestOutcome] = await Promise.all([
            generateQuickReplies(result, finalMessages),
            request.engineType === 'bazi'
                ? generateBaziConversationDigest(result as BaziResult, finalMessages)
                : request.engineType === 'ziwei'
                    ? generateZiweiConversationDigest(result as ZiweiRecordResult, finalMessages)
                    : Promise.resolve({ value: null }),
        ]);
    } catch (error) {
        void recordDiagnosticLog({
            level: 'warn',
            source: 'AI:jobArtifacts',
            message: 'artifact_generation_failed',
            context: {
                engineType: request.engineType,
                error: error instanceof Error ? error.message : String(error),
            },
        });
        return {
            quickReplies: request.engineType === 'liuyao' ? getLocalLiuyaoQuickReplies(result as PanResult) : [],
        };
    }

    if (quickReplyOutcome.failure) {
        void recordDiagnosticLog({
            level: 'warn',
            source: 'AI:jobQuickReplies',
            message: quickReplyOutcome.failure.message,
            context: { code: quickReplyOutcome.failure.code, engineType: request.engineType },
        });
    }
    return {
        quickReplies: quickReplyOutcome.value?.length
            ? quickReplyOutcome.value
            : (request.engineType === 'liuyao' ? getLocalLiuyaoQuickReplies(result as PanResult) : []),
        digest: digestOutcome.value ?? undefined,
    };
}

function buildUpdatedResult(
    request: AIAnalysisJobRequest,
    requestResult: DivinationResult,
    currentResult: DivinationResult,
    finalMessages: PersistedAIChatMessage[],
    cleanContent: string,
    artifacts: Awaited<ReturnType<typeof generateArtifacts>>,
): DivinationResult | null {
    if (request.engineType === 'liuyao') {
        return {
            ...(currentResult as PanResult),
            aiAnalysis: cleanContent,
            aiChatHistory: finalMessages,
            quickReplies: artifacts.quickReplies,
        };
    }
    if (request.engineType === 'baziCompatibility') {
        return {
            ...(currentResult as BaziCompatibilityResult),
            aiAnalysis: cleanContent,
            aiChatHistory: finalMessages,
        };
    }

    const currentStage = request.engineType === 'bazi'
        ? getBaziConversationStage(requestResult as BaziResult)
        : getZiweiConversationStage(requestResult as ZiweiRecordResult);
    const nextStage = request.nextWorkflowStage ?? currentStage;
    const verificationSummary = nextStage === 'verification_ready'
        ? getLastAssistantContent(finalMessages)
        : request.engineType === 'bazi'
            ? (currentResult as BaziResult).aiVerificationSummary
            : (currentResult as ZiweiRecordResult).aiVerificationSummary;

    if (request.engineType === 'bazi') {
        const current = currentResult as BaziResult;
        const requestBazi = request.result as BaziResult;
        if (current.calculatedAt !== requestBazi.calculatedAt
            || current.gender !== requestBazi.gender
            || current.longitude !== requestBazi.longitude
            || current.solarDate !== requestBazi.solarDate
            || current.solarTime !== requestBazi.solarTime
            || current.trueSolarTime !== requestBazi.trueSolarTime
            || JSON.stringify(current.schoolOptionsResolved) !== JSON.stringify(requestBazi.schoolOptionsResolved)) {
            return null;
        }
        return {
            ...current,
            aiAnalysis: cleanContent,
            aiChatHistory: finalMessages,
            quickReplies: artifacts.quickReplies,
            aiConversationDigest: nextStage === 'followup_ready'
                ? (artifacts.digest as BaziResult['aiConversationDigest'] | undefined) ?? current.aiConversationDigest
                : undefined,
            aiConversationStage: nextStage,
            aiVerificationSummary: verificationSummary,
            aiContextSnapshot: (requestResult as BaziResult).aiContextSnapshot,
        };
    }

    const current = currentResult as ZiweiRecordResult;
    const requestZiwei = request.result as ZiweiRecordResult;
    if (current.birthLocal !== requestZiwei.birthLocal
        || current.trueSolarDateTimeLocal !== requestZiwei.trueSolarDateTimeLocal
        || current.gender !== requestZiwei.gender
        || current.longitude !== requestZiwei.longitude
        || current.timeIndex !== requestZiwei.timeIndex
        || buildZiweiAIConfigSignature(current.config) !== buildZiweiAIConfigSignature(requestZiwei.config)) {
        return null;
    }
    return {
        ...current,
        aiAnalysis: cleanContent,
        aiChatHistory: finalMessages,
        quickReplies: artifacts.quickReplies,
        aiConversationDigest: nextStage === 'followup_ready'
            ? (artifacts.digest as ZiweiRecordResult['aiConversationDigest'] | undefined) ?? current.aiConversationDigest
            : undefined,
        aiConversationStage: nextStage,
        aiVerificationSummary: verificationSummary,
        aiConfigSignature: buildZiweiAIConfigSignature(requestZiwei.config),
        aiInvalidatedAt: undefined,
    };
}

function failJob(
    key: string,
    jobId: string,
    code: AIErrorCode,
    message: string,
    validation?: AIAnalysisValidationResult,
): void {
    activeControllers.delete(key);
    if (!isCurrentJob(key, jobId)) {
        return;
    }
    const current = jobStates.get(key);
    if (!current) {
        return;
    }
    setJobState(key, {
        status: code === 'aborted' ? 'cancelled' : 'failed',
        messages: current.baseMessages,
        draftContent: '',
        validatedContent: '',
        failure: { code, message },
        validation,
    });
}

export function startAIAnalysisJob(request: AIAnalysisJobRequest): AIAnalysisJobState {
    const key = jobKey(request.engineType, request.result.id);
    const existing = jobStates.get(key);
    if (existing && isActiveAIAnalysisJob(existing)) {
        return existing;
    }

    const now = new Date().toISOString();
    const job: AIAnalysisJobState = {
        jobId: createJobId(request.engineType, request.result.id),
        recordId: request.result.id,
        engineType: request.engineType,
        status: 'running',
        phase: request.phase,
        expectedCompletion: request.expectedCompletion,
        nextWorkflowStage: request.nextWorkflowStage,
        baseMessages: request.baseMessages,
        requestMessages: request.requestMessages,
        messages: request.requestMessages,
        draftContent: '',
        validatedContent: '',
        startedAt: now,
        updatedAt: now,
    };
    jobStates.set(key, job);
    void persistJob(job);
    emit(key);

    const controller = new AbortController();
    activeControllers.set(key, controller);

    void (async () => {
        try {
            const built = await buildMessagesForRequest(request);
            if (!isCurrentJob(key, job.jobId) || controller.signal.aborted) {
                return;
            }
            setJobState(key, { debugMeta: built.debugMeta });

            let rawContent = '';
            const requestOptions = request.engineType === 'baziCompatibility'
                ? { temperature: 0.3, stage: 'bazi_match', debugMeta: built.debugMeta }
                : {
                    ...getChatRequestOptions(
                        built.requestResult as PanResult | BaziResult | ZiweiRecordResult,
                        request.phase,
                    ),
                    stage: request.engineType === 'liuyao'
                        ? request.phase
                        : `${request.engineType}_${request.expectedCompletion ?? request.phase}`,
                    debugMeta: built.debugMeta,
                };
            requestOptions.onReasoning = () => {
                if (isCurrentJob(key, job.jobId)) {
                    setJobState(key, { status: 'reasoning' });
                }
            };

            const response = await analyzeWithAIChatStream(
                built.messages,
                (chunk) => {
                    if (!isCurrentJob(key, job.jobId) || controller.signal.aborted) {
                        return;
                    }
                    rawContent += chunk;
                    setJobState(key, {
                        status: 'streaming',
                        draftContent: cleanStreamContent(request.engineType, rawContent),
                    }, { emit: 'deferred', persist: false });
                },
                controller.signal,
                requestOptions,
            );

            if (!isCurrentJob(key, job.jobId)) {
                return;
            }
            if (!response.success || !response.content) {
                failJob(
                    key,
                    job.jobId,
                    response.code ?? 'network_error',
                    response.error || 'AI 请求失败，请稍后重试。',
                );
                return;
            }

            const cleanContent = cleanFinalContent(request.engineType, response.content);
            setJobState(key, { status: 'validating' });
            const validation = validateContent(request, response.content, cleanContent);
            if (!validation.success) {
                void recordDiagnosticLog({
                    level: 'warn',
                    source: 'AI:jobValidation',
                    message: 'validation_failed',
                    context: {
                        engineType: request.engineType,
                        expectedCompletion: request.expectedCompletion,
                        issues: validation.issues,
                        contentChars: cleanContent.length,
                    },
                });
                failJob(
                    key,
                    job.jobId,
                    'invalid_response',
                    `生成完成但未通过结构校验：${validation.issues.join('；')}`,
                    validation,
                );
                return;
            }

            const finalMessages: PersistedAIChatMessage[] = [
                ...request.requestMessages,
                { role: 'assistant', content: cleanContent },
            ];
            setJobState(key, {
                status: 'postprocessing',
                draftContent: cleanContent,
                validation,
            });

            const currentStage = request.engineType === 'bazi'
                ? getBaziConversationStage(built.requestResult as BaziResult)
                : request.engineType === 'ziwei'
                    ? getZiweiConversationStage(built.requestResult as ZiweiRecordResult)
                    : undefined;
            const nextStage = request.nextWorkflowStage ?? currentStage;
            const artifacts = request.engineType === 'baziCompatibility'
                ? { quickReplies: [] }
                : await generateArtifacts(
                    request,
                    built.requestResult as PanResult | BaziResult | ZiweiRecordResult,
                    finalMessages,
                    nextStage,
                );
            if (!isCurrentJob(key, job.jobId) || controller.signal.aborted) {
                return;
            }

            const savingJob = setJobState(key, { status: 'saving' }, { persist: false });
            await persistJob(savingJob);
            if (!isCurrentJob(key, job.jobId) || controller.signal.aborted) {
                return;
            }
            const updatedResult = await updateExistingRecordResult(
                request.result.id,
                request.engineType,
                (currentResult) => buildUpdatedResult(
                    request,
                    built.requestResult,
                    currentResult,
                    finalMessages,
                    cleanContent,
                    artifacts,
                ),
            );
            if (!updatedResult) {
                failJob(key, job.jobId, 'aborted', '记录已删除或排盘内容已变化，本次分析未写入。');
                return;
            }
            if (!isCurrentJob(key, job.jobId) || controller.signal.aborted) {
                return;
            }
            if (!isCurrentJob(key, job.jobId) || controller.signal.aborted) {
                return;
            }

            activeControllers.delete(key);
            setJobState(key, {
                status: 'completed',
                messages: finalMessages,
                draftContent: cleanContent,
                validatedContent: cleanContent,
                validation,
                result: updatedResult,
            });
            await clearPersistedJob(request.engineType, request.result.id);
            setTimeout(() => {
                const completed = jobStates.get(key);
                if (completed?.jobId === job.jobId && completed.status === 'completed') {
                    jobStates.delete(key);
                    publish(key);
                }
            }, 1000);
        } catch (error) {
            activeControllers.delete(key);
            void recordDiagnosticLog({
                level: 'warn',
                source: 'AI:analysisJob',
                message: 'job_exception',
                context: {
                    engineType: request.engineType,
                    error: error instanceof Error ? error.message : String(error),
                },
            });
            failJob(
                key,
                job.jobId,
                'network_error',
                error instanceof Error ? error.message : 'AI 请求失败，请稍后重试。',
            );
        }
    })();

    return job;
}

export function getAIAnalysisJob(engineType: DivinationEngine, recordId: string): AIAnalysisJobState | null {
    return jobStates.get(jobKey(engineType, recordId)) ?? null;
}

export function subscribeAIAnalysisJob(
    engineType: DivinationEngine,
    recordId: string,
    listener: AIAnalysisJobListener,
): () => void {
    const key = jobKey(engineType, recordId);
    const current = listeners.get(key) ?? new Set<AIAnalysisJobListener>();
    current.add(listener);
    listeners.set(key, current);
    listener(getAIAnalysisJob(engineType, recordId));
    return () => {
        current.delete(listener);
        if (current.size === 0) {
            listeners.delete(key);
        }
    };
}

export function cancelAIAnalysisJob(engineType: DivinationEngine, recordId: string): void {
    const key = jobKey(engineType, recordId);
    const job = jobStates.get(key);
    activeControllers.get(key)?.abort();
    activeControllers.delete(key);
    clearScheduledEmit(key);
    if (job && isCancellableAIAnalysisJob(job)) {
        setJobState(key, {
            status: 'cancelled',
            messages: job.baseMessages,
            draftContent: '',
            validatedContent: '',
            failure: { code: 'aborted', message: '已取消本次分析。' },
        });
    }
}

export async function clearAIAnalysisJob(engineType: DivinationEngine, recordId: string): Promise<void> {
    const key = jobKey(engineType, recordId);
    activeControllers.get(key)?.abort();
    activeControllers.delete(key);
    clearScheduledEmit(key);
    jobStates.delete(key);
    await clearPersistedJob(engineType, recordId);
    if (engineType === 'liuyao') {
        try {
            await AsyncStorage.removeItem(`${LEGACY_LIUYAO_STORAGE_PREFIX}${recordId}`);
        } catch (error) {
            void recordDiagnosticLog({
                level: 'warn',
                source: 'AI:jobStorage',
                message: 'legacy_clear_failed',
                context: { error: error instanceof Error ? error.message : String(error) },
            });
        }
    }
    publish(key);
}

export async function recoverInterruptedAIAnalysisJob(
    engineType: DivinationEngine,
    recordId: string,
): Promise<AIAnalysisJobState | null> {
    const existing = getAIAnalysisJob(engineType, recordId);
    if (existing) {
        return existing;
    }

    try {
        let raw = await AsyncStorage.getItem(storageKey(engineType, recordId));
        let legacyLiuyaoJob = false;
        if (!raw && engineType === 'liuyao') {
            raw = await AsyncStorage.getItem(`${LEGACY_LIUYAO_STORAGE_PREFIX}${recordId}`);
            if (raw) {
                legacyLiuyaoJob = true;
                await AsyncStorage.removeItem(`${LEGACY_LIUYAO_STORAGE_PREFIX}${recordId}`);
            }
        }
        if (!raw) {
            return null;
        }
        const parsed = JSON.parse(raw) as Partial<AIAnalysisJobState> & {
            messages?: PersistedAIChatMessage[];
        };
        const now = new Date().toISOString();
        const detail = await getRecord(recordId);
        const activeAfterRead = getAIAnalysisJob(engineType, recordId);
        if (activeAfterRead) {
            return activeAfterRead;
        }
        const baseMessages = detail?.engineType === 'liuyao'
            && legacyLiuyaoJob
            ? detail.result.aiChatHistory ?? []
            : parsed.baseMessages || [];
        const requestMessages = legacyLiuyaoJob
            ? parsed.messages || baseMessages
            : parsed.requestMessages || baseMessages;
        const savedMessages = detail?.engineType === engineType
            ? detail.result.aiChatHistory ?? []
            : [];
        const resultAlreadyCommitted = parsed.status === 'completed'
            || (parsed.status === 'saving'
                && !arePersistedMessageListsEqual(savedMessages, baseMessages)
                && savedMessages.length === requestMessages.length + 1
                && requestMessages.every((message, index) => arePersistedMessagesEqual(message, savedMessages[index]))
                && savedMessages[savedMessages.length - 1]?.role === 'assistant');
        if (resultAlreadyCommitted) {
            await clearPersistedJob(engineType, recordId);
            return null;
        }
        const persistedStatus = parsed.status;
        const recoveredStatus: AIAnalysisJobStatus = persistedStatus === 'failed'
            || persistedStatus === 'cancelled'
            || persistedStatus === 'interrupted'
            ? persistedStatus
            : 'interrupted';
        const recovered: AIAnalysisJobState = {
            jobId: parsed.jobId || createJobId(engineType, recordId),
            recordId,
            engineType,
            status: recoveredStatus,
            phase: parsed.phase === 'followup' ? 'followup' : 'initial',
            expectedCompletion: parsed.expectedCompletion,
            nextWorkflowStage: parsed.nextWorkflowStage,
            baseMessages,
            requestMessages,
            messages: baseMessages,
            draftContent: '',
            validatedContent: '',
            failure: recoveredStatus === 'interrupted'
                ? { code: 'aborted', message: '上次分析因应用中断未完成，请手动重试。' }
                : parsed.failure,
            startedAt: parsed.startedAt || now,
            updatedAt: now,
        };
        const key = jobKey(engineType, recordId);
        jobStates.set(key, recovered);
        await persistJob(recovered);
        emit(key);
        return recovered;
    } catch {
        return null;
    }
}
