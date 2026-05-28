import AsyncStorage from '@react-native-async-storage/async-storage';
import { PersistedAIChatMessage } from '../core/ai-meta';
import { PanResult, YaoDetail } from '../core/liuyao-calc';
import { saveRecord } from '../db/database';
import {
    AIErrorCode,
    analyzeWithAIChatStream,
    buildRequestBundle,
    getChatRequestOptions,
    stripThinkingBlocks,
} from './ai';

export type AIJobStatus =
    | 'idle'
    | 'running'
    | 'reasoning'
    | 'streaming'
    | 'validating'
    | 'completed'
    | 'failed'
    | 'interrupted'
    | 'cancelled';

export interface LiuyaoAIValidationResult {
    success: boolean;
    issues: string[];
    missingSections: string[];
    missingEvidenceAnchors: string[];
}

export interface LiuyaoAIJobState {
    jobId: string;
    recordId: string;
    status: AIJobStatus;
    phase: 'initial' | 'followup';
    messages: PersistedAIChatMessage[];
    draftContent: string;
    validatedContent: string;
    failure?: {
        code: AIErrorCode;
        message: string;
    };
    validation?: LiuyaoAIValidationResult;
    result?: PanResult;
    startedAt: string;
    updatedAt: string;
}

interface StartLiuyaoAIJobParams {
    result: PanResult;
    messages: PersistedAIChatMessage[];
    phase: 'initial' | 'followup';
}

type LiuyaoAIJobListener = (job: LiuyaoAIJobState | null) => void;
type JobEmitMode = 'immediate' | 'deferred' | 'none';

const activeControllers = new Map<string, AbortController>();
const jobStates = new Map<string, LiuyaoAIJobState>();
const listeners = new Map<string, Set<LiuyaoAIJobListener>>();
const emitTimers = new Map<string, ReturnType<typeof setTimeout>>();
const STORAGE_PREFIX = 'liuyao_ai_job_';
const STREAMING_EMIT_INTERVAL_MS = 250;

function createJobId(recordId: string): string {
    return `${recordId}-${Date.now()}`;
}

function isActiveStatus(status: AIJobStatus): boolean {
    return status === 'running' || status === 'reasoning' || status === 'streaming' || status === 'validating';
}

function storageKey(recordId: string): string {
    return `${STORAGE_PREFIX}${recordId}`;
}

function publish(recordId: string): void {
    const job = jobStates.get(recordId) ?? null;
    listeners.get(recordId)?.forEach((listener) => listener(job));
}

function clearScheduledEmit(recordId: string): void {
    const timer = emitTimers.get(recordId);
    if (!timer) {
        return;
    }
    clearTimeout(timer);
    emitTimers.delete(recordId);
}

function emit(recordId: string, mode: JobEmitMode = 'immediate'): void {
    if (mode === 'none') {
        return;
    }

    if (mode === 'deferred') {
        if (emitTimers.has(recordId)) {
            return;
        }
        const timer = setTimeout(() => {
            emitTimers.delete(recordId);
            publish(recordId);
        }, STREAMING_EMIT_INTERVAL_MS);
        emitTimers.set(recordId, timer);
        return;
    }

    clearScheduledEmit(recordId);
    publish(recordId);
}

async function persistJob(job: LiuyaoAIJobState | null): Promise<void> {
    if (!job) {
        return;
    }
    try {
        await AsyncStorage.setItem(storageKey(job.recordId), JSON.stringify({
            ...job,
            result: job.status === 'completed' ? job.result : undefined,
        }));
    } catch {
        // 持久化失败不影响当前内存任务。
    }
}

async function clearPersistedJob(recordId: string): Promise<void> {
    try {
        await AsyncStorage.removeItem(storageKey(recordId));
    } catch {
        // 清理失败不影响主流程。
    }
}

function setJobState(
    recordId: string,
    patch: Partial<LiuyaoAIJobState>,
    options: { emit?: JobEmitMode; persist?: boolean } = {},
): LiuyaoAIJobState {
    const previous = jobStates.get(recordId);
    if (!previous) {
        throw new Error('Liuyao AI job is not initialized');
    }
    const next: LiuyaoAIJobState = {
        ...previous,
        ...patch,
        updatedAt: new Date().toISOString(),
    };
    jobStates.set(recordId, next);
    if (options.persist !== false) {
        void persistJob(next);
    }
    emit(recordId, options.emit ?? 'immediate');
    return next;
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

export function validateLiuyaoAIContent(result: PanResult, content: string): LiuyaoAIValidationResult {
    const normalized = stripThinkingBlocks(content).trim();
    const sectionChecks: Array<{ label: string; pattern: RegExp }> = [
        { label: '整体卦意', pattern: /整体|总断|卦意|本卦/u },
        { label: '世应关系', pattern: /世应|世爻|应爻/u },
        { label: '用神忌神', pattern: /用神|忌神/u },
        { label: '动变分析', pattern: result.movingYaoPositions.length > 0 ? /动爻|动变|变卦/u : /无动爻|静卦|不变/u },
        { label: '应期推算', pattern: /应期|时间|月份|日期|日辰|时机/u },
        { label: '趋避建议', pattern: /建议|趋避|行动|风险|提醒/u },
    ];
    const missingSections = sectionChecks
        .filter((item) => !item.pattern.test(normalized))
        .map((item) => item.label);

    const anchorGroups = buildEvidenceAnchorGroups(result);
    const missingEvidenceAnchors = anchorGroups
        .filter((group) => group.required && !hasAny(normalized, group.values))
        .map((group) => group.label);
    const hitCount = anchorGroups.filter((group) => hasAny(normalized, group.values)).length;
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

export function getLiuyaoAIJob(recordId: string): LiuyaoAIJobState | null {
    return jobStates.get(recordId) ?? null;
}

export function subscribeLiuyaoAIJob(recordId: string, listener: LiuyaoAIJobListener): () => void {
    const current = listeners.get(recordId) ?? new Set<LiuyaoAIJobListener>();
    current.add(listener);
    listeners.set(recordId, current);
    listener(getLiuyaoAIJob(recordId));

    return () => {
        current.delete(listener);
        if (current.size === 0) {
            listeners.delete(recordId);
        }
    };
}

export async function recoverInterruptedLiuyaoAIJob(recordId: string): Promise<LiuyaoAIJobState | null> {
    if (jobStates.has(recordId)) {
        return getLiuyaoAIJob(recordId);
    }

    try {
        const raw = await AsyncStorage.getItem(storageKey(recordId));
        if (!raw) {
            return null;
        }
        const parsed = JSON.parse(raw) as LiuyaoAIJobState;
        if (isActiveStatus(parsed.status)) {
            const interrupted: LiuyaoAIJobState = {
                ...parsed,
                status: 'interrupted',
                failure: {
                    code: 'aborted',
                    message: '上次分析因应用中断未完成，可重新开始。',
                },
                updatedAt: new Date().toISOString(),
            };
            jobStates.set(recordId, interrupted);
            await persistJob(interrupted);
            emit(recordId);
            return interrupted;
        }
        jobStates.set(recordId, parsed);
        emit(recordId);
        return parsed;
    } catch {
        return null;
    }
}

export function cancelLiuyaoAIJob(recordId: string): void {
    const job = jobStates.get(recordId);
    activeControllers.get(recordId)?.abort();
    activeControllers.delete(recordId);
    clearScheduledEmit(recordId);
    if (job && isActiveStatus(job.status)) {
        setJobState(recordId, {
            status: 'cancelled',
            failure: {
                code: 'aborted',
                message: '已取消本次分析。',
            },
        });
    }
}

export function startLiuyaoAIJob({ result, messages, phase }: StartLiuyaoAIJobParams): LiuyaoAIJobState {
    const existing = jobStates.get(result.id);
    if (existing && isActiveStatus(existing.status)) {
        return existing;
    }

    const now = new Date().toISOString();
    const job: LiuyaoAIJobState = {
        jobId: createJobId(result.id),
        recordId: result.id,
        status: 'running',
        phase,
        messages,
        draftContent: '',
        validatedContent: '',
        startedAt: now,
        updatedAt: now,
    };
    jobStates.set(result.id, job);
    void persistJob(job);
    emit(result.id);

    const controller = new AbortController();
    activeControllers.set(result.id, controller);

    void (async () => {
        try {
            const requestBundle = await buildRequestBundle(result, messages);
            const requestOptions = {
                ...getChatRequestOptions(result, phase),
                stage: phase,
                debugMeta: requestBundle.debugMeta,
                onReasoning: () => {
                    const current = jobStates.get(result.id);
                    if (current && current.status === 'running') {
                        setJobState(result.id, { status: 'reasoning' });
                    }
                },
            };

            const response = await analyzeWithAIChatStream(
                requestBundle.messages,
                (chunk) => {
                    const current = jobStates.get(result.id);
                    if (!current || current.status === 'cancelled') {
                        return;
                    }
                    const nextContent = `${current.draftContent}${chunk}`;
                    setJobState(result.id, {
                        status: 'streaming',
                        draftContent: nextContent,
                    }, {
                        emit: 'deferred',
                        persist: false,
                    });
                },
                controller.signal,
                requestOptions,
            );

            activeControllers.delete(result.id);
            const current = jobStates.get(result.id);
            if (!current || current.status === 'cancelled') {
                return;
            }

            if (!response.success || !response.content) {
                setJobState(result.id, {
                    status: response.code === 'aborted' ? 'cancelled' : 'failed',
                    failure: {
                        code: response.code ?? 'network_error',
                        message: response.error || 'AI 请求失败，请稍后重试。',
                    },
                });
                return;
            }

            const cleanContent = stripThinkingBlocks(response.content).trim();
            setJobState(result.id, {
                status: 'validating',
                draftContent: cleanContent,
            });

            const validation = validateLiuyaoAIContent(result, cleanContent);
            if (!validation.success) {
                setJobState(result.id, {
                    status: 'failed',
                    validation,
                    failure: {
                        code: 'invalid_response',
                        message: `生成完成但未通过盘据校验：${validation.issues.join('；')}`,
                    },
                });
                return;
            }

            const finalMessages: PersistedAIChatMessage[] = [
                ...messages,
                { role: 'assistant', content: cleanContent },
            ];
            const updatedResult: PanResult = {
                ...result,
                aiAnalysis: cleanContent,
                aiChatHistory: finalMessages,
                quickReplies: [],
            };
            await saveRecord({
                engineType: 'liuyao',
                result: updatedResult,
            });

            setJobState(result.id, {
                status: 'completed',
                messages: finalMessages,
                draftContent: cleanContent,
                validatedContent: cleanContent,
                validation,
                result: updatedResult,
            });
            await clearPersistedJob(result.id);
        } catch (error) {
            activeControllers.delete(result.id);
            const current = jobStates.get(result.id);
            if (!current || current.status === 'cancelled') {
                return;
            }
            setJobState(result.id, {
                status: 'failed',
                failure: {
                    code: 'network_error',
                    message: error instanceof Error ? error.message : 'AI 请求失败，请稍后重试。',
                },
            });
        }
    })();

    return job;
}
