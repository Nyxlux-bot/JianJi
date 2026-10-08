import AsyncStorage from '@react-native-async-storage/async-storage';
import { sanitizeAIExecutionMeta, type AIExecutionMeta } from '../core/ai-execution-meta';
import { resolveAIRequestRuntime } from './ai-request-runtime';
import type { AIRequestRuntime } from './ai-provider-types';
import { BaziAIConversationStage, PersistedAIChatMessage } from '../core/ai-meta';
import type { BaziAIEvidencePack } from '../core/bazi-ai-evidence';
import { getBaziBirthSignature } from '../core/bazi-ai-identity';
import { getBaziWorkflowVersion, isBaziWorkflowStale } from '../core/bazi-ai-workflow';
import {
    appendKinshipResponse, formatKinshipResponse, getKinshipStateKey,
    getCurrentKinshipVerification, isKinshipResponseKind,
    MAX_KINSHIP_ATTEMPTS, parseKinshipResponse, type KinshipResponse,
} from '../core/bazi-kinship';
import { cloneBaziFormatterContext, mergeBaziFormatterContext, BaziFormatterContext } from '../core/bazi-ai-context';
import { BaziResult } from '../core/bazi-types';
import { PanResult, YaoDetail } from '../core/liuyao-calc';
import { getRecord, updateExistingRecordResult } from '../db/database';
import { DivinationEngine, DivinationResult } from '../db/record-types';
import { buildBaziMatchAIMessages, validateBaziMatchAIContent } from '../features/bazi/match/ai';
import { getChapterLayoutStats, parseChapter, type ChapterLayoutKind } from '../ai/layout/parse-chapter';
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
    getLocalLiuyaoQuickReplies,
    getZiweiConversationStage,
    hasLiuyaoCompletionMarker,
    sanitizeBaziStreamingContent,
    sanitizeLiuyaoStreamingContent,
    sanitizeZiweiStreamingContent,
    shouldGeneratePostResponseArtifacts,
    stripBaziStageMarkers,
    stripLiuyaoCompletionMarker,
    stripThinkingBlocks,
    stripZiweiStageMarkers,
    validateBaziWorkflowResponse,
    validateZiweiWorkflowResponse,
} from './ai';
import { recordDiagnosticLog } from './diagnostics';
import { getSkillVersions } from '../ai/skill-composer';

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
    /** Why the reply counts as unfinished. Only completeness fails a job. */
    issues: string[];
    /** Content observations for diagnostics; never fail a job. */
    notes?: string[];
}

export interface AIAnalysisJobRequest {
    engineType: DivinationEngine;
    result: DivinationResult;
    baseMessages: PersistedAIChatMessage[];
    requestMessages: PersistedAIChatMessage[];
    phase: 'initial' | 'followup';
    expectedCompletion?: AIWorkflowResponseKind;
    nextWorkflowStage?: BaziAIConversationStage;
    formatterContext?: BaziFormatterContext | ZiweiFormatterContext;
    /** Text already written before a cut-off; the model is asked to continue from its end. */
    continuation?: { partial: string };
}

export interface AIAnalysisJobState {
    executionMeta?: AIExecutionMeta;
    jobId: string;
    recordId: string;
    engineType: DivinationEngine;
    status: AIAnalysisJobStatus;
    phase: 'initial' | 'followup';
    expectedCompletion?: AIWorkflowResponseKind;
    nextWorkflowStage?: BaziAIConversationStage;
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
/** Last time a streaming draft was written to storage, per job key. */
const draftPersistedAt = new Map<string, number>();
const DRAFT_PERSIST_INTERVAL_MS = 3000;
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
        // The draft is kept so a reply cut off by the app being killed can be
        // continued after restart instead of being written again from scratch.
        await AsyncStorage.setItem(key, JSON.stringify({
            ...job,
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

function cleanStreamContent(engineType: DivinationEngine, content: string, kind?: AIWorkflowResponseKind): string {
    if (engineType === 'bazi' && isKinshipResponseKind(kind)) return '';
    if (engineType === 'bazi') {
        return sanitizeBaziStreamingContent(content, isKinshipResponseKind(kind) ? undefined : kind);
    }
    if (engineType === 'ziwei') {
        return sanitizeZiweiStreamingContent(content, isKinshipResponseKind(kind) ? undefined : kind);
    }
    if (engineType === 'baziCompatibility') {
        return stripEmoji(stripThinkingBlocks(content)).trim();
    }
    if (engineType === 'liuyao') {
        return sanitizeLiuyaoStreamingContent(content);
    }
    return stripThinkingBlocks(content).trim();
}

function cleanFinalContent(engineType: DivinationEngine, content: string, kind?: AIWorkflowResponseKind): string {
    if (engineType === 'bazi') {
        return stripBaziStageMarkers(content, isKinshipResponseKind(kind) ? undefined : kind);
    }
    if (engineType === 'ziwei') {
        return stripZiweiStageMarkers(content, isKinshipResponseKind(kind) ? undefined : kind);
    }
    if (engineType === 'baziCompatibility') {
        return stripEmoji(stripThinkingBlocks(content)).trim();
    }
    if (engineType === 'liuyao') {
        return stripLiuyaoCompletionMarker(content);
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
        && left.requestContent === right.requestContent
        && left.workflowStage === right.workflowStage
        && JSON.stringify(left.executionMeta) === JSON.stringify(right.executionMeta);
}

function arePersistedMessageListsEqual(left: PersistedAIChatMessage[], right: PersistedAIChatMessage[]): boolean {
    return left.length === right.length
        && left.every((message, index) => arePersistedMessagesEqual(message, right[index]));
}

const CONTINUATION_PROMPT = '上一条回复因为长度或网络原因中断了。请从中断处直接接着写：不要重复已经写过的内容，不要重新开头，也不要重写已经出现过的标题；全部写完后，如果原要求有完成标记，照常在最后单独一行输出。';

/** Join a cut-off reply with its continuation, dropping text the model repeated at the seam. */
export function mergeContinuation(partial: string, continuation: string): string {
    const head = partial.replace(/\s+$/u, '');
    const tail = continuation.replace(/^\s+/u, '');
    if (!tail) return partial;
    const maxOverlap = Math.min(head.length, tail.length, 800);
    for (let size = maxOverlap; size >= 6; size -= 1) {
        if (head.endsWith(tail.slice(0, size))) return head + tail.slice(size);
    }
    // The model often restarts the line it was cut in: keep its complete version.
    const lineStart = head.lastIndexOf('\n') + 1;
    const lastLine = head.slice(lineStart);
    if (lastLine.trim().length >= 4 && tail.startsWith(lastLine.slice(0, Math.min(lastLine.length, 12)))) {
        return head.slice(0, lineStart) + tail;
    }
    const seam = partial.slice(head.length) || continuation.slice(0, continuation.length - tail.length);
    return head + seam + tail;
}

function validateContent(
    request: AIAnalysisJobRequest,
    rawContent: string,
    cleanContent: string,
): AIAnalysisValidationResult {
    if (!cleanContent.trim()) return { success: false, issues: ['未识别到完整分析正文，请重试本次分析'] };
    if (isKinshipResponseKind(request.expectedCompletion)) {
        return { success: false, issues: ['六亲阶段须使用结构化盘据校验'] };
    }
    if (request.engineType === 'bazi' && request.expectedCompletion) {
        const validation = validateBaziWorkflowResponse(request.expectedCompletion, rawContent);
        return { success: validation.success, issues: validation.issues };
    }
    if (request.engineType === 'ziwei' && request.expectedCompletion) {
        const validation = validateZiweiWorkflowResponse(request.expectedCompletion, rawContent);
        return { success: validation.success, issues: validation.issues };
    }
    if (request.engineType === 'liuyao') {
        const validation = validateLiuyaoAIContent(request.result as PanResult, rawContent, request.phase);
        return { success: validation.success, issues: validation.issues, notes: validation.notes };
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
    if (!hasLiuyaoCompletionMarker(content)) {
        return {
            success: false,
            issues: ['流式响应在正文完成前结束（未收到六爻完成标记）'],
            missingSections: [],
            missingEvidenceAnchors: [],
        };
    }
    const anchorGroups = buildEvidenceAnchorGroups(result);
    const hitCount = anchorGroups.filter((group) => hasAny(normalized, group.values)).length;
    const missingEvidenceAnchors = phase === 'initial'
        ? anchorGroups
            .filter((group) => group.required && !hasAny(normalized, group.values))
            .map((group) => group.label)
        : [];

    if (phase === 'followup') {
        const notes = hitCount < 2 ? [`盘面锚点不足（${hitCount}/2）`] : [];
        return {
            success: true,
            issues: [],
            notes,
            missingSections: [],
            missingEvidenceAnchors: notes,
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
    const notes = [
        ...missingSections.map((item) => `缺少${item}`),
        ...missingEvidenceAnchors.map((item) => `缺少${item}引用`),
    ];
    return {
        success: true,
        issues: [],
        notes,
        missingSections,
        missingEvidenceAnchors: Array.from(new Set(missingEvidenceAnchors)),
    };
}

function getLayoutKind(request: AIAnalysisJobRequest): ChapterLayoutKind | null {
    if (request.engineType === 'baziCompatibility') return 'compat';
    if (request.engineType !== 'bazi' && request.engineType !== 'ziwei') return null;
    return request.expectedCompletion === 'verification' || request.expectedCompletion === 'five_year'
        ? request.expectedCompletion : null;
}

/** Per model × stage hit rate of the layout parser, so prompt drift shows up in logs. */
function logLayoutDiagnostics(
    request: AIAnalysisJobRequest,
    content: string,
    executionMeta: AIExecutionMeta,
    validation: AIAnalysisValidationResult,
): void {
    const kind = getLayoutKind(request);
    if (!kind && !validation.notes?.length) return;
    const stats = kind ? getChapterLayoutStats(parseChapter(kind, content)) : undefined;
    void recordDiagnosticLog({
        level: 'info',
        source: 'AI:layout',
        message: kind ?? request.engineType,
        context: {
            engineType: request.engineType,
            stage: request.expectedCompletion ?? request.phase,
            model: executionMeta.model,
            contentChars: content.length,
            ...stats,
            ...(validation.notes?.length ? { notes: validation.notes } : {}),
        },
    });
}

function assertBaziRequestStage(request: AIAnalysisJobRequest, result: BaziResult): void {
    if (getBaziWorkflowVersion(result) !== 2) {
        if (isKinshipResponseKind(request.expectedCompletion)) throw new Error('旧会话请重置后再使用六亲初验');
        return;
    }
    if (isBaziWorkflowStale(result)) throw new Error('出生资料或排盘口径已变化，请重新开始 AI 分析');
    const stage = getBaziConversationStage(result);
    const state = getCurrentKinshipVerification(result);
    const kind = request.expectedCompletion;
    if (kind === 'kinship') {
        if (stage !== 'foundation_ready' && stage !== 'kinship_ready') throw new Error('请先完成基础定局');
        if (state && (state.attempts.length >= MAX_KINSHIP_ATTEMPTS || state.actualFeedback)) throw new Error('六亲仅作一次可选初验，可填写实际情况或直接进入前事核验');
        if (request.nextWorkflowStage !== 'kinship_ready') throw new Error('六亲初验目标阶段无效');
        return;
    }
    if (kind === 'kinship_review') {
        throw new Error('已取消单独六亲复核，请填写实际情况后直接进入前事核验');
    }
    if (kind === 'verification' && stage === 'foundation_pending') throw new Error('请先完成基础定局');
    if (kind === 'five_year' && stage !== 'verification_ready' && stage !== 'followup_ready') throw new Error('请先完成前事核验并确认后再分析未来五年');
    if (!kind && request.phase === 'followup' && stage !== 'followup_ready') throw new Error('请先完成未来五年分析再进行专题追问');
}

async function buildMessagesForRequest(request: AIAnalysisJobRequest, asOf: Date): Promise<{
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    debugMeta?: AIRequestDebugMeta;
    requestResult: DivinationResult;
    baziEvidencePack?: BaziAIEvidencePack;
}> {
    if (request.engineType === 'baziCompatibility') {
        const messages = buildBaziMatchAIMessages(request.result as BaziCompatibilityResult);
        return {
            messages,
            debugMeta: {
                mode: 'baziCompatibility', requestType: 'main', workflowStage: 'followup',
                usedDynamicEvidencePack: true, usedDigest: false, compatibilityMode: true,
                skills: getSkillVersions('baziCompatibility', 'initial'), systemCharCount: messages[0].content.length, messageCount: messages.length,
            },
            requestResult: request.result,
        };
    }

    let requestResult = request.result;
    let formatterContext = request.formatterContext;
    if (request.engineType === 'bazi') {
        const bazi = request.result as BaziResult;
        assertBaziRequestStage(request, bazi);
        const override = cloneBaziFormatterContext(request.formatterContext as BaziFormatterContext | undefined);
        const snapshot = mergeBaziFormatterContext(
            (request.result as BaziResult).aiContextSnapshot,
            override,
        );
        requestResult = {
            ...(request.result as BaziResult),
            aiWorkflowVersion: getBaziWorkflowVersion(bazi),
            aiWorkflowBirthSignature: getBaziWorkflowVersion(bazi) === 2
                ? (bazi.aiWorkflowBirthSignature ?? getBaziBirthSignature(bazi)) : bazi.aiWorkflowBirthSignature,
            aiContextSnapshot: snapshot ?? (request.result as BaziResult).aiContextSnapshot,
        };
        formatterContext = override;
    }
    const workflowStage = request.expectedCompletion
        ?? (request.phase === 'followup' ? 'followup' : undefined);
    const bundle = await buildRequestBundle(
        requestResult as PanResult | BaziResult | ZiweiRecordResult,
        request.requestMessages,
        formatterContext,
        { workflowStage, asOf },
    );
    return {
        messages: bundle.messages,
        debugMeta: bundle.debugMeta,
        requestResult,
        baziEvidencePack: bundle.baziEvidencePack,
    };
}

async function generateArtifacts(
    request: AIAnalysisJobRequest,
    result: PanResult | BaziResult | ZiweiRecordResult,
    finalMessages: PersistedAIChatMessage[],
    nextStage?: BaziAIConversationStage,
    runtime?: AIRequestRuntime,
    signal?: AbortSignal,
): Promise<{
    quickReplies: string[];
    digest?: BaziResult['aiConversationDigest'] | ZiweiRecordResult['aiConversationDigest'];
}> {
    if (!runtime) throw new Error('缺少本次任务的模型配置');
    const shouldGenerate = request.engineType === 'liuyao'
        || shouldGeneratePostResponseArtifacts(result, nextStage ?? request.phase);
    if (!shouldGenerate) {
        return { quickReplies: [] };
    }

    let quickReplyOutcome;
    let digestOutcome;
    try {
        [quickReplyOutcome, digestOutcome] = await Promise.all([
            generateQuickReplies(result, finalMessages, runtime, signal),
            request.engineType === 'bazi'
                ? generateBaziConversationDigest(result as BaziResult, finalMessages, runtime, signal)
                : request.engineType === 'ziwei'
                    ? generateZiweiConversationDigest(result as ZiweiRecordResult, finalMessages, runtime, signal)
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
    kinship?: { response: KinshipResponse; pack: BaziAIEvidencePack; id: string },
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
        if (getBaziBirthSignature(current) !== getBaziBirthSignature(requestBazi)
            || current.calculatedAt !== requestBazi.calculatedAt
            || current.gender !== requestBazi.gender
            || current.longitude !== requestBazi.longitude
            || current.solarDate !== requestBazi.solarDate
            || current.solarTime !== requestBazi.solarTime
            || current.trueSolarTime !== requestBazi.trueSolarTime
            || JSON.stringify(current.schoolOptionsResolved) !== JSON.stringify(requestBazi.schoolOptionsResolved)) {
            return null;
        }
        if (getKinshipStateKey(current.aiKinshipVerification) !== getKinshipStateKey(requestBazi.aiKinshipVerification)) return null;
        const requestSnapshot = requestResult as BaziResult;
        return {
            ...current,
            aiWorkflowVersion: requestSnapshot.aiWorkflowVersion,
            aiWorkflowBirthSignature: requestSnapshot.aiWorkflowBirthSignature,
            aiKinshipVerification: kinship
                ? appendKinshipResponse(getCurrentKinshipVerification(current), kinship.response, kinship.pack, kinship.id)
                : current.aiKinshipVerification,
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
    if (nextStage === 'kinship_ready') return null;
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
    partialContent?: string,
): void {
    activeControllers.delete(key);
    if (!isCurrentJob(key, jobId)) {
        return;
    }
    const current = jobStates.get(key);
    if (!current) {
        return;
    }
    const status = code === 'aborted' ? 'cancelled' : 'failed';
    setJobState(key, {
        status,
        messages: status === 'cancelled' ? current.baseMessages : current.requestMessages,
        // Keep already-rendered output visible when the transport or
        // validation fails after streaming has started. An explicit cancel
        // is the only path that intentionally clears it.
        draftContent: status === 'cancelled' ? '' : (partialContent || current.draftContent),
        validatedContent: '',
        failure: { code, message },
        validation,
    });
}

async function enrichSavedResultWithArtifacts(input: {
    key: string;
    jobId: string;
    request: AIAnalysisJobRequest;
    requestResult: DivinationResult;
    finalMessages: PersistedAIChatMessage[];
    cleanContent: string;
    nextStage?: BaziAIConversationStage;
    runtime: AIRequestRuntime;
    signal: AbortSignal;
}): Promise<void> {
    const { key, jobId, request, requestResult, finalMessages, cleanContent, nextStage, runtime, signal } = input;
    try {
        if (!isCurrentJob(key, jobId)) {
            return;
        }
        const artifacts = await generateArtifacts(
            request,
            requestResult as PanResult | BaziResult | ZiweiRecordResult,
            finalMessages,
            nextStage,
            runtime, signal,
        );
        if (!isCurrentJob(key, jobId)) {
            void recordDiagnosticLog({
                level: 'info',
                source: 'AI:jobArtifacts',
                message: 'artifact_update_skipped',
                context: {
                    engineType: request.engineType,
                    reason: 'job_superseded',
                },
            });
            return;
        }
        const enrichedResult = await updateExistingRecordResult(
            request.result.id,
            request.engineType,
            (currentResult) => {
                const currentMessages = currentResult.aiChatHistory ?? [];
                if (!isCurrentJob(key, jobId)
                    || !arePersistedMessageListsEqual(currentMessages, finalMessages)) {
                    return null;
                }
                return buildUpdatedResult(
                    request,
                    requestResult,
                    currentResult,
                    finalMessages,
                    cleanContent,
                    artifacts,
                );
            },
        );
        if (!enrichedResult) {
            void recordDiagnosticLog({
                level: 'info',
                source: 'AI:jobArtifacts',
                message: 'artifact_update_skipped',
                context: {
                    engineType: request.engineType,
                    reason: 'conversation_changed_or_record_removed',
                },
            });
            return;
        }
        if (isCurrentJob(key, jobId)) {
            setJobState(key, { result: enrichedResult }, { persist: false });
        }
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
    }
}

function scheduleCompletedJobCleanup(key: string, jobId: string): void {
    setTimeout(() => {
        const completed = jobStates.get(key);
        if (completed?.jobId === jobId && completed.status === 'completed') {
            jobStates.delete(key);
            publish(key);
        }
    }, 1000);
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
        draftContent: request.continuation?.partial ?? '',
        validatedContent: '',
        startedAt: now,
        updatedAt: now,
    };
    jobStates.set(key, job);
    void persistJob(job);
    emit(key);

    activeControllers.get(key)?.abort();
    const controller = new AbortController();
    activeControllers.set(key, controller);

    void (async () => {
        try {
            const runtime = await resolveAIRequestRuntime();
            if (controller.signal.aborted || !isCurrentJob(key, job.jobId)) return;
            const built = await buildMessagesForRequest(request, new Date(now));
            if (!isCurrentJob(key, job.jobId) || controller.signal.aborted) {
                return;
            }
            let executionMeta: AIExecutionMeta = { ...runtime.meta, skills: built.debugMeta?.skills ?? [] };
            setJobState(key, { debugMeta: built.debugMeta, executionMeta });

            const partial = request.continuation?.partial ?? '';
            const requestMessages = partial
                ? [...built.messages, { role: 'assistant' as const, content: partial }, { role: 'user' as const, content: CONTINUATION_PROMPT }]
                : built.messages;
            // Everything below sees the whole reply: what was written before plus this continuation.
            const withPartial = (text: string) => (partial ? mergeContinuation(partial, text) : text);
            let rawContent = '';
            const requestOptions = {
                runtime,
                skills: executionMeta.skills,
                stage: request.engineType === 'liuyao' ? request.phase : `${request.engineType}_${request.expectedCompletion ?? request.phase}`,
                debugMeta: built.debugMeta,
                onReasoning: () => {},
            };
            requestOptions.onReasoning = () => {
                if (isCurrentJob(key, job.jobId)) {
                    setJobState(key, { status: 'reasoning' });
                }
            };

            const response = await analyzeWithAIChatStream(
                requestMessages,
                (chunk) => {
                    if (!isCurrentJob(key, job.jobId) || controller.signal.aborted) {
                        return;
                    }
                    rawContent += chunk;
                    const nowMs = Date.now();
                    const persist = nowMs - (draftPersistedAt.get(key) ?? 0) >= DRAFT_PERSIST_INTERVAL_MS;
                    if (persist) draftPersistedAt.set(key, nowMs);
                    setJobState(key, {
                        status: 'streaming',
                        draftContent: withPartial(cleanStreamContent(request.engineType, rawContent, request.expectedCompletion)),
                    }, { emit: 'deferred', persist });
                },
                controller.signal,
                requestOptions,
            );

            if (!isCurrentJob(key, job.jobId)) {
                return;
            }
            // A compat retry may have dropped a parameter; record what was actually sent.
            if (response.executionMeta) {
                executionMeta = { ...response.executionMeta, skills: executionMeta.skills };
                setJobState(key, { executionMeta });
            }
            if (!response.content) {
                failJob(
                    key,
                    job.jobId,
                    response.code ?? 'network_error',
                    response.error || 'AI 请求失败，请稍后重试。',
                    undefined,
                    partial || undefined,
                );
                return;
            }
            const fullContent = withPartial(partial ? stripThinkingBlocks(response.content) : response.content);

            if (!response.success) {
                failJob(
                    key,
                    job.jobId,
                    response.code ?? 'network_error',
                    response.error || 'AI 请求失败，请稍后重试。',
                    undefined,
                    cleanStreamContent(request.engineType, fullContent, request.expectedCompletion),
                );
                return;
            }

            let cleanContent = cleanFinalContent(request.engineType, fullContent, request.expectedCompletion);
            setJobState(key, { status: 'validating' });
            let kinship: { response: KinshipResponse; pack: BaziAIEvidencePack; id: string } | undefined;
            let validation: AIAnalysisValidationResult;
            if (request.engineType === 'bazi' && isKinshipResponseKind(request.expectedCompletion)) {
                cleanContent = '';
                try {
                    if (!built.baziEvidencePack) throw new Error('缺少本轮命盘证据包');
                    const parsed = parseKinshipResponse(stripThinkingBlocks(response.content), request.expectedCompletion,
                        built.baziEvidencePack, getCurrentKinshipVerification(built.requestResult as BaziResult)?.actualFeedback);
                    kinship = { response: parsed, pack: built.baziEvidencePack, id: job.jobId };
                    cleanContent = formatKinshipResponse(parsed, built.baziEvidencePack.facts);
                    validation = { success: true, issues: [] };
                } catch (error) {
                    validation = { success: false, issues: [error instanceof Error ? error.message : String(error)] };
                }
            } else {
                validation = validateContent(request, fullContent, cleanContent);
            }
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
                    `回复可能没有写完：${validation.issues.join('；')}`,
                    validation,
                    cleanContent,
                );
                return;
            }

            logLayoutDiagnostics(request, cleanContent, executionMeta, validation);

            const finalMessages: PersistedAIChatMessage[] = [
                ...request.requestMessages,
                {
                    role: 'assistant', content: cleanContent, executionMeta,
                    ...(request.engineType === 'bazi' && getBaziWorkflowVersion(built.requestResult as BaziResult) === 2
                        ? { workflowStage: request.expectedCompletion ?? 'followup' as const } : {}),
                },
            ];
            setJobState(key, {
                status: 'saving',
                draftContent: cleanContent,
                validation,
            }, { persist: false });

            const currentStage = request.engineType === 'bazi'
                ? getBaziConversationStage(built.requestResult as BaziResult)
                : request.engineType === 'ziwei'
                    ? getZiweiConversationStage(built.requestResult as ZiweiRecordResult)
                    : undefined;
            const nextStage = request.nextWorkflowStage ?? currentStage;
            const initialArtifacts = request.engineType === 'liuyao'
                ? { quickReplies: getLocalLiuyaoQuickReplies(built.requestResult as PanResult) }
                : { quickReplies: [] };
            const savingJob = jobStates.get(key);
            if (!savingJob) {
                return;
            }
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
                    initialArtifacts,
                    kinship,
                ),
            );
            if (!updatedResult) {
                failJob(key, job.jobId, 'record_changed', '生成期间这份记录被修改或删除，本次结果没有写入。正文仍在上方，可以重新生成。', undefined, cleanContent);
                return;
            }
            if (!isCurrentJob(key, job.jobId) || controller.signal.aborted) {
                return;
            }

            setJobState(key, {
                status: 'completed',
                messages: finalMessages,
                draftContent: cleanContent,
                validatedContent: cleanContent,
                validation,
                result: updatedResult,
            });
            await clearPersistedJob(request.engineType, request.result.id);
            if (request.engineType !== 'baziCompatibility'
                && (request.engineType === 'liuyao'
                    || shouldGeneratePostResponseArtifacts(
                        built.requestResult as PanResult | BaziResult | ZiweiRecordResult,
                        nextStage ?? request.phase,
                    ))) {
                void enrichSavedResultWithArtifacts({
                    key,
                    jobId: job.jobId,
                    request,
                    requestResult: built.requestResult,
                    finalMessages,
                    cleanContent,
                    nextStage, runtime, signal: controller.signal,
                }).finally(() => {
                    if (activeControllers.get(key) === controller) activeControllers.delete(key);
                    scheduleCompletedJobCleanup(key, job.jobId);
                });
            } else {
                if (activeControllers.get(key) === controller) activeControllers.delete(key);
                scheduleCompletedJobCleanup(key, job.jobId);
            }
        } catch (error) {
            if (activeControllers.get(key) === controller) activeControllers.delete(key);
            void recordDiagnosticLog({
                level: 'warn',
                source: 'AI:analysisJob',
                message: 'job_exception',
                context: {
                    engineType: request.engineType,
                    error: error instanceof Error ? error.message : String(error),
                },
            });
            const errorMessage = error instanceof Error ? error.message : 'AI 请求失败，请稍后重试。';
            const errorCode: AIErrorCode = /配置|思考|token|模型|接口/u.test(errorMessage) ? 'invalid_configuration' : 'network_error';
            failJob(key, job.jobId, errorCode, errorMessage);
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
            executionMeta: sanitizeAIExecutionMeta(parsed.executionMeta),
            expectedCompletion: parsed.expectedCompletion,
            nextWorkflowStage: parsed.nextWorkflowStage,
            baseMessages,
            requestMessages,
            messages: recoveredStatus === 'cancelled' ? baseMessages : requestMessages,
            draftContent: recoveredStatus === 'cancelled' || typeof parsed.draftContent !== 'string' ? '' : parsed.draftContent,
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
    } catch (error) {
        void recordDiagnosticLog({
            level: 'warn',
            source: 'AI:jobStorage',
            message: 'recover_failed',
            context: {
                engineType,
                recordId,
                error: error instanceof Error ? error.message : String(error),
            },
        });
        return null;
    }
}
