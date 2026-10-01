import EventSource from 'react-native-sse';
import { resolveAIRequestRuntime } from './ai-request-runtime';
import { getProtocolLabel, inferProviderProtocol } from './ai-endpoints';
import type { AIExecutionMeta, AISkillVersion } from '../core/ai-execution-meta';
import { recordDiagnosticLog } from './diagnostics';
import {
    getWebCrossOriginMessage,
    getWebProxyUnavailableMessage,
    resolveAIWebTransport,
} from './ai-web-proxy';
import type {
    AIProviderCapabilities,
    AIProviderConfig,
    AIProviderProtocol,
    AIRequestRuntime,
} from './ai-provider-types';

// Gateways may omit thinking metadata or events. Waiting must not depend on
// model recognition or business stage names.
const STREAM_TIMEOUTS = {
    firstEventTimeoutMs: 120_000,
    idleTimeoutMs: 480_000,
    totalTimeoutMs: 900_000,
} as const;

export interface AIProviderMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export type AIProviderFailureCode =
    | 'http_error'
    | 'network_error'
    | 'timeout'
    | 'aborted'
    | 'invalid_response'
    | 'empty_response'
    | 'token_limit';

export interface AIProviderRequestMeta {
    executionMeta?: AIExecutionMeta;
    operationId: string;
    parentOperationId?: string;
    protocol: AIProviderProtocol;
    apiHost: string;
    endpointPath: string;
    model: string;
    maxOutputTokens: number;
    maxOutputTokensSource: AIProviderCapabilities['maxOutputTokensSource'];
    temperatureIncluded: boolean;
    metadataAvailable: boolean;
    metadataSource: AIProviderCapabilities['metadataSource'];
    firstEventTimeoutMs: number;
    idleTimeoutMs: number;
    totalTimeoutMs: number;
    firstEventMs?: number;
    durationMs: number;
    streamEventCount: number;
    contentChunkCount: number;
    invalidEventCount: number;
    httpStatus?: number;
    xhrState?: number;
    contentType?: string;
    requestId?: string;
    finishReason?: string;
    terminalEventReceived: boolean;
    reportedOutputTokens?: number;
    webCrossOrigin?: boolean;
    webProxyUsed?: boolean;
    pageOrigin?: string;
}

export interface AIProviderResult {
    success: boolean;
    content?: string;
    error?: string;
    code?: AIProviderFailureCode;
    meta: AIProviderRequestMeta;
}

export interface AIProviderConnectionTestResult {
    operationId: string;
    success: boolean;
    selectedProtocol?: AIProviderProtocol;
    selectedResult?: AIProviderResult;
    attempts: AIProviderConnectionAttempt[];
    error?: string;
}

export interface AIProviderConnectionAttempt {
    protocol: AIProviderProtocol;
    success: boolean;
    code?: AIProviderFailureCode | 'invalid_configuration';
    error?: string;
    result?: AIProviderResult;
}

export interface ProviderConnectionTestOptions {
    signal?: AbortSignal;
    onAttempt?: (protocol: AIProviderProtocol, index: number, total: number) => void;
}

export interface ProviderRequestOptions {
    skills?: AISkillVersion[];
    executionMeta?: AIExecutionMeta;
    maxTokens?: number;
    temperature?: number;
    signal?: AbortSignal;
    onChunk?: (text: string) => void;
    onReasoning?: () => void;
    parentOperationId?: string;
    stage: string;
    requestType: 'main' | 'digest' | 'quick_replies' | 'connection_test';
}

interface StreamState {
    content: string;
    finishReason?: string;
    terminalEventReceived: boolean;
    reportedOutputTokens?: number;
    streamEventCount: number;
    contentChunkCount: number;
    invalidEventCount: number;
    firstEventAt?: number;
    reasoningStarted: boolean;
}

interface ProviderStreamEvent {
    data?: string | null;
    message?: string;
    xhrStatus?: number;
    xhrState?: number;
}

let operationSequence = 0;

function createOperationId(): string {
    operationSequence += 1;
    return Date.now().toString(36) + '-' + operationSequence.toString(36);
}

function getAuthHeaders(
    protocol: AIProviderProtocol,
    apiKey: string,
    endpoint: string,
): Record<string, string> {
    if (protocol === 'anthropic_messages') {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
            'x-api-key': apiKey.trim(),
            'anthropic-version': '2023-06-01',
        };
        try {
            if (new URL(endpoint).hostname.toLowerCase() !== 'api.anthropic.com') {
                headers.Authorization = 'Bearer ' + apiKey.trim();
            }
        } catch {
            headers.Authorization = 'Bearer ' + apiKey.trim();
        }
        return headers;
    }
    return {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        Authorization: 'Bearer ' + apiKey.trim(),
    };
}

function splitSystemMessages(messages: AIProviderMessage[]): {
    instructions?: string;
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
} {
    const instructions = messages
        .filter((message) => message.role === 'system')
        .map((message) => message.content)
        .join('\n\n')
        .trim();
    return {
        instructions: instructions || undefined,
        messages: messages
            .filter((message): message is AIProviderMessage & { role: 'user' | 'assistant' } => message.role !== 'system')
            .map(({ role, content }) => ({ role, content })),
    };
}

function buildRequestBody(
    runtime: AIRequestRuntime,
    messages: AIProviderMessage[],
    options: ProviderRequestOptions,
): Record<string, unknown> {
    const { capabilities } = runtime;
    const maxOutputTokens = runtime.config.maxOutputTokens;
    const temperature = capabilities.supportsTemperature ? options.temperature : undefined;
    const normalized = splitSystemMessages(messages);
    if (capabilities.protocol === 'responses') {
        return {
            model: capabilities.model,
            ...(normalized.instructions ? { instructions: normalized.instructions } : {}),
            input: normalized.messages,
            max_output_tokens: maxOutputTokens,
            ...(temperature === undefined ? {} : { temperature }),
            ...runtime.parameters,
            stream: true,
        };
    }
    return {
        model: capabilities.model,
        ...(normalized.instructions ? { system: normalized.instructions } : {}),
        messages: normalized.messages,
        max_tokens: maxOutputTokens,
        ...(temperature === undefined ? {} : { temperature }),
        ...runtime.parameters,
        stream: true,
    };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function extractTextContent(value: unknown): string {
    if (typeof value === 'string') {
        return value;
    }
    if (!Array.isArray(value)) {
        return '';
    }
    return value.map((item) => {
        if (!isRecord(item)) {
            return '';
        }
        if (typeof item.text === 'string') {
            return item.text;
        }
        if (typeof item.content === 'string') {
            return item.content;
        }
        return '';
    }).join('');
}

function extractResponsesText(payload: Record<string, unknown>): string {
    if (typeof payload.output_text === 'string') {
        return payload.output_text;
    }
    if (!Array.isArray(payload.output)) {
        return '';
    }
    return payload.output.map((item) => {
        if (!isRecord(item)) {
            return '';
        }
        return extractTextContent(item.content);
    }).join('');
}

function parseProviderError(data: unknown): string {
    if (!isRecord(data)) {
        return '';
    }
    if (isRecord(data.response)) {
        const nested = parseProviderError(data.response);
        if (nested) {
            return nested;
        }
    }
    if (typeof data.message === 'string') {
        return data.message;
    }
    if (typeof data.error === 'string') {
        return data.error;
    }
    if (isRecord(data.error)) {
        if (typeof data.error.message === 'string') {
            return data.error.message;
        }
        return JSON.stringify(data.error);
    }
    return '';
}

function isTokenLimitReason(reason?: string): boolean {
    return reason === 'length'
        || reason === 'max_tokens'
        || reason === 'max_token_limit'
        || reason === 'max_output_tokens'
        || reason === 'model_context_window_exceeded';
}

function canTreatAnthropicTransportCloseAsCompletion(
    state: StreamState,
    httpStatus: number,
): boolean {
    const finishReason = state.finishReason;
    if (!state.terminalEventReceived || !state.content.trim() || !finishReason) {
        return false;
    }

    const isVisibleCompletion = finishReason === 'end_turn'
        || finishReason === 'stop_sequence'
        || finishReason === 'stop'
        || finishReason === 'refusal'
        || isTokenLimitReason(finishReason);
    if (!isVisibleCompletion) {
        return false;
    }

    // react-native-sse can emit a final XHR error after Android has already
    // delivered Anthropic's message_stop. A zero status is the native network
    // layer's close signal, not a provider HTTP error. Never infer completion
    // from a 200 CANCEL alone: it can also occur while a long response is cut
    // off mid-sentence.
    return httpStatus === 0 || httpStatus === 200;
}

function isAnthropicHttp200Cancel(message: string, httpStatus: number): boolean {
    return httpStatus === 200 && /stream\s+was\s+reset:\s*CANCEL/i.test(message);
}

function readOutputTokenCount(value: unknown): number | undefined {
    if (!isRecord(value)) {
        return undefined;
    }
    const usage = isRecord(value.usage) ? value.usage : value;
    const outputTokens = usage.output_tokens;
    return typeof outputTokens === 'number' && Number.isFinite(outputTokens) && outputTokens >= 0
        ? Math.floor(outputTokens)
        : undefined;
}

function recordOutputTokenCount(state: StreamState, value: unknown): void {
    const outputTokens = readOutputTokenCount(value);
    if (outputTokens !== undefined) {
        state.reportedOutputTokens = outputTokens;
    }
}

function getXhrMeta(
    eventSource: EventSource<string> | null,
): Pick<AIProviderRequestMeta, 'httpStatus' | 'xhrState' | 'contentType' | 'requestId'> {
    const xhr = (eventSource as unknown as { _xhr?: XMLHttpRequest } | null)?._xhr;
    if (!xhr) {
        return {};
    }
    const getHeader = (name: string): string | undefined => {
        try {
            return xhr.getResponseHeader(name) || undefined;
        } catch {
            return undefined;
        }
    };
    return {
        httpStatus: xhr.status || undefined,
        xhrState: xhr.readyState,
        contentType: getHeader('content-type'),
        requestId: getHeader('x-request-id')
            || getHeader('request-id')
            || getHeader('anthropic-request-id')
            || getHeader('cf-ray'),
    };
}

function buildMeta(
    operationId: string,
    capabilities: AIProviderCapabilities,
    options: ProviderRequestOptions,
    startedAt: number,
    state: StreamState,
    extra: Partial<AIProviderRequestMeta> = {},
): AIProviderRequestMeta {
    return {
        operationId,
        parentOperationId: options.parentOperationId,
        executionMeta: options.executionMeta,
        protocol: capabilities.protocol,
        apiHost: capabilities.apiHost,
        endpointPath: capabilities.endpointPath,
        model: capabilities.model,
        maxOutputTokens: Math.min(options.maxTokens ?? capabilities.maxOutputTokens, capabilities.maxOutputTokens),
        maxOutputTokensSource: capabilities.maxOutputTokensSource,
        temperatureIncluded: capabilities.supportsTemperature && options.temperature !== undefined,
        metadataAvailable: capabilities.metadataAvailable,
        metadataSource: capabilities.metadataSource,
        ...STREAM_TIMEOUTS,
        firstEventMs: state.firstEventAt ? state.firstEventAt - startedAt : undefined,
        durationMs: Date.now() - startedAt,
        streamEventCount: state.streamEventCount,
        contentChunkCount: state.contentChunkCount,
        invalidEventCount: state.invalidEventCount,
        finishReason: state.finishReason,
        terminalEventReceived: state.terminalEventReceived,
        reportedOutputTokens: state.reportedOutputTokens,
        ...extra,
    };
}

function formatFailure(message: string, meta: AIProviderRequestMeta): string {
    const status = meta.httpStatus ? '（HTTP ' + meta.httpStatus + '）' : '';
    const requestId = meta.requestId ? '，服务端请求 ID：' + meta.requestId : '';
    return meta.protocol + ' · ' + meta.endpointPath + status + '：' + message + requestId + '。请求编号：' + meta.operationId;
}

function logRequestStarted(
    operationId: string,
    capabilities: AIProviderCapabilities,
    options: ProviderRequestOptions,
): void {
    const transport = resolveAIWebTransport(capabilities.endpoint);
    void recordDiagnosticLog({
        level: 'info',
        source: 'AI:providerRequest',
        message: 'request_started',
        context: {
            operationId,
            parentOperationId: options.parentOperationId,
            executionMeta: options.executionMeta,
            stage: options.stage,
            requestType: options.requestType,
            protocol: capabilities.protocol,
            apiHost: capabilities.apiHost,
            endpointPath: capabilities.endpointPath,
            model: capabilities.model,
            maxOutputTokens: Math.min(options.maxTokens ?? capabilities.maxOutputTokens, capabilities.maxOutputTokens),
            maxOutputTokensSource: capabilities.maxOutputTokensSource,
            temperatureIncluded: capabilities.supportsTemperature && options.temperature !== undefined,
            metadataAvailable: capabilities.metadataAvailable,
            metadataSource: capabilities.metadataSource,
            ...STREAM_TIMEOUTS,
            webCrossOrigin: transport.webCrossOrigin,
            webProxyUsed: transport.webProxyUsed,
            pageOrigin: transport.pageOrigin,
        },
    });
}

function logFirstEvent(
    meta: AIProviderRequestMeta,
    options: ProviderRequestOptions,
): void {
    void recordDiagnosticLog({
        level: 'info',
        source: 'AI:providerRequest',
        message: 'request_first_event',
        context: {
            operationId: meta.operationId,
            parentOperationId: meta.parentOperationId,
            stage: options.stage,
            requestType: options.requestType,
            protocol: meta.protocol,
            apiHost: meta.apiHost,
            endpointPath: meta.endpointPath,
            model: meta.model,
            firstEventMs: meta.firstEventMs,
            httpStatus: meta.httpStatus,
            requestId: meta.requestId,
            webCrossOrigin: meta.webCrossOrigin,
            webProxyUsed: meta.webProxyUsed,
            pageOrigin: meta.pageOrigin,
        },
    });
}

function logRequestResult(
    result: AIProviderResult,
    options: ProviderRequestOptions,
    messages: AIProviderMessage[],
): void {
    const inputChars = messages.reduce((total, message) => total + message.content.length, 0);
    void recordDiagnosticLog({
        level: result.success ? 'info' : 'warn',
        source: 'AI:providerRequest',
        message: result.success ? 'request_completed' : 'request_failed',
        context: {
            stage: options.stage,
            requestType: options.requestType,
            success: result.success,
            code: result.code,
            errorMessage: result.error,
            inputMessageCount: messages.length,
            inputChars,
            systemChars: messages
                .filter((message) => message.role === 'system')
                .reduce((total, message) => total + message.content.length, 0),
            ...result.meta,
        },
    });
}

function appendChunk(
    state: StreamState,
    chunk: string,
    options: ProviderRequestOptions,
): void {
    if (!chunk) {
        return;
    }
    state.content += chunk;
    state.contentChunkCount += 1;
    options.onChunk?.(chunk);
}

function handleStreamPayload(
    protocol: AIProviderProtocol,
    eventType: string,
    rawData: string,
    state: StreamState,
    options: ProviderRequestOptions,
): { done?: boolean; error?: string; code?: AIProviderFailureCode } {
    state.streamEventCount += 1;
    if (rawData.trim() === '[DONE]') {
        state.terminalEventReceived = true;
        return { done: true };
    }

    let payload: Record<string, unknown>;
    try {
        payload = JSON.parse(rawData) as Record<string, unknown>;
    } catch {
        state.invalidEventCount += 1;
        if (eventType === 'error') {
            return {
                error: rawData.slice(0, 500) || '流式接口返回无法解析的错误事件',
                code: 'http_error',
            };
        }
        return {};
    }

    const payloadType = typeof payload.type === 'string' ? payload.type : eventType;
    if (protocol === 'responses') {
        if (payloadType === 'response.output_text.delta' && typeof payload.delta === 'string') {
            appendChunk(state, payload.delta, options);
            return {};
        }
        if (payloadType === 'response.output_text.done' && !state.content) {
            appendChunk(state, typeof payload.text === 'string' ? payload.text : '', options);
            return {};
        }
        if (payloadType === 'response.reasoning_text.delta' || payloadType === 'response.reasoning_summary_text.delta') {
            if (!state.reasoningStarted) {
                state.reasoningStarted = true;
                options.onReasoning?.();
            }
            return {};
        }
        if (payloadType === 'response.completed') {
            const response = isRecord(payload.response) ? payload.response : payload;
            if (!state.content) {
                appendChunk(state, extractResponsesText(response), options);
            }
            recordOutputTokenCount(state, response);
            state.finishReason = typeof response.status === 'string' ? response.status : 'completed';
            state.terminalEventReceived = true;
            return { done: true };
        }
        if (payloadType === 'response.incomplete') {
            const response = isRecord(payload.response) ? payload.response : payload;
            if (!state.content) {
                appendChunk(state, extractResponsesText(response), options);
            }
            recordOutputTokenCount(state, response);
            const details = isRecord(response.incomplete_details) ? response.incomplete_details : undefined;
            state.finishReason = typeof details?.reason === 'string' ? details.reason : 'incomplete';
            state.terminalEventReceived = true;
            return {
                done: true,
                code: isTokenLimitReason(state.finishReason) ? 'token_limit' : 'invalid_response',
                error: isTokenLimitReason(state.finishReason)
                    ? '模型输出达到上限，内容未完整生成'
                    : 'Responses API 返回未完成状态' + (state.finishReason ? '：' + state.finishReason : ''),
            };
        }
        if (payloadType === 'response.failed' || payloadType === 'error') {
            return {
                error: parseProviderError(payload) || 'Responses API 返回失败事件',
                code: 'http_error',
            };
        }
        return {};
    }

    if (payloadType === 'message_start') {
        const message = isRecord(payload.message) ? payload.message : undefined;
        recordOutputTokenCount(state, message);
        if (typeof message?.stop_reason === 'string') {
            state.finishReason = message.stop_reason;
        }
        return {};
    }
    if (payloadType === 'content_block_start') {
        const block = isRecord(payload.content_block) ? payload.content_block : undefined;
        if (block?.type === 'text' && typeof block.text === 'string') {
            appendChunk(state, block.text, options);
        }
        return {};
    }
    if (payloadType === 'content_block_delta') {
        const delta = isRecord(payload.delta) ? payload.delta : undefined;
        if (delta?.type === 'text_delta' && typeof delta.text === 'string') {
            appendChunk(state, delta.text, options);
        } else if (delta?.type === 'thinking_delta' && !state.reasoningStarted) {
            state.reasoningStarted = true;
            options.onReasoning?.();
        }
        return {};
    }
    if (payloadType === 'message_delta') {
        const delta = isRecord(payload.delta) ? payload.delta : undefined;
        recordOutputTokenCount(state, payload);
        if (typeof delta?.stop_reason === 'string') {
            state.finishReason = delta.stop_reason;
        }
        return {};
    }
    if (payloadType === 'message_stop') {
        state.terminalEventReceived = true;
        return {
            done: true,
            ...(isTokenLimitReason(state.finishReason)
                ? { code: 'token_limit' as const, error: '模型输出达到上限，内容未完整生成' }
                : {}),
        };
    }
    if (payloadType === 'error') {
        return {
            error: parseProviderError(payload) || 'Anthropic Messages 返回失败事件',
            code: 'http_error',
        };
    }
    return {};
}

function runStreamRequest(
    runtime: AIRequestRuntime,
    messages: AIProviderMessage[],
    options: ProviderRequestOptions,
    operationId: string,
): Promise<AIProviderResult> {
    const { config, capabilities } = runtime;
    const startedAt = Date.now();
    const transport = resolveAIWebTransport(capabilities.endpoint);
    const state: StreamState = {
        content: '',
        terminalEventReceived: false,
        streamEventCount: 0,
        contentChunkCount: 0,
        invalidEventCount: 0,
        reasoningStarted: false,
    };

    return new Promise((resolve) => {
        let settled = false;
        let firstEventTimer: ReturnType<typeof setTimeout> | undefined;
        let idleTimer: ReturnType<typeof setTimeout> | undefined;
        let totalTimer: ReturnType<typeof setTimeout> | undefined;
        let eventSource: EventSource<string> | null = null;

        const cleanup = () => {
            if (firstEventTimer) clearTimeout(firstEventTimer);
            if (idleTimer) clearTimeout(idleTimer);
            if (totalTimer) clearTimeout(totalTimer);
            options.signal?.removeEventListener('abort', handleAbort);
            eventSource?.close();
        };
        const makeResult = (
            success: boolean,
            extra: Partial<Omit<AIProviderResult, 'success' | 'meta'>> & { meta?: Partial<AIProviderRequestMeta> } = {},
        ): AIProviderResult => {
            const meta = buildMeta(operationId, capabilities, options, startedAt, state, {
                ...getXhrMeta(eventSource),
                webCrossOrigin: transport.webCrossOrigin,
                webProxyUsed: transport.webProxyUsed,
                pageOrigin: transport.pageOrigin,
                ...extra.meta,
            });
            return {
                success,
                content: state.content || undefined,
                ...extra,
                ...(success || !extra.error ? {} : { error: formatFailure(extra.error, meta) }),
                meta,
            };
        };
        const settle = (result: AIProviderResult) => {
            if (settled) {
                return;
            }
            settled = true;
            cleanup();
            logRequestResult(result, options, messages);
            resolve(result);
        };
        const finish = (code?: AIProviderFailureCode, error?: string) => {
            if (code) {
                settle(makeResult(false, { code, error }));
                return;
            }
            if (!state.content.trim()) {
                settle(makeResult(false, {
                    code: 'empty_response',
                    error: '模型流式响应已结束，但没有返回可见正文',
                }));
                return;
            }
            settle(makeResult(true));
        };
        const resetIdleTimer = () => {
            if (idleTimer) clearTimeout(idleTimer);
            idleTimer = setTimeout(() => {
                settle(makeResult(false, {
                    code: 'timeout',
                    error: '流式响应空闲超时（' + Math.round(STREAM_TIMEOUTS.idleTimeoutMs / 1000) + ' 秒）',
                }));
            }, STREAM_TIMEOUTS.idleTimeoutMs);
        };
        const markFirstEvent = () => {
            if (state.firstEventAt) {
                return;
            }
            state.firstEventAt = Date.now();
            if (firstEventTimer) clearTimeout(firstEventTimer);
            const meta = buildMeta(operationId, capabilities, options, startedAt, state, getXhrMeta(eventSource));
            logFirstEvent(meta, options);
        };
        const handleAbort = () => {
            settle(makeResult(false, { code: 'aborted', error: 'ABORTED' }));
        };
        const handleEvent = (eventType: string, event: ProviderStreamEvent) => {
            if (settled) {
                return;
            }
            if (!event.data) {
                // A few gateways omit the data line for the terminal
                // message_stop event. It is still a valid completion signal.
                if (eventType === 'message_stop') {
                    markFirstEvent();
                    resetIdleTimer();
                    state.streamEventCount += 1;
                    state.terminalEventReceived = true;
                    finish();
                }
                return;
            }
            markFirstEvent();
            resetIdleTimer();
            const outcome = handleStreamPayload(capabilities.protocol, eventType, event.data, state, options);
            if (outcome.error && !outcome.done) {
                settle(makeResult(false, {
                    code: outcome.code ?? 'http_error',
                    error: outcome.error,
                }));
                return;
            }
            if (outcome.done) {
                finish(outcome.code, outcome.error);
            }
        };
        const tryHandleAnthropicTransportClose = (
            errorText: string,
            httpStatus: number,
            xhrState?: number,
        ): boolean => {
            if (capabilities.protocol !== 'anthropic_messages' || !state.content.trim()) {
                return false;
            }
            if (!canTreatAnthropicTransportCloseAsCompletion(state, httpStatus)) {
                return false;
            }
            void recordDiagnosticLog({
                level: 'info',
                source: 'AI:providerRequest',
                message: 'late_transport_error_after_terminal_event',
                context: {
                    operationId,
                    protocol: capabilities.protocol,
                    endpointPath: capabilities.endpointPath,
                    httpStatus,
                    xhrState,
                    finishReason: state.finishReason,
                    terminalEventReceived: state.terminalEventReceived,
                    reportedOutputTokens: state.reportedOutputTokens,
                    contentChars: state.content.length,
                },
            });
            finish(
                isTokenLimitReason(state.finishReason) ? 'token_limit' : undefined,
                isTokenLimitReason(state.finishReason) ? '模型输出达到上限，内容未完整生成' : undefined,
            );
            return true;
        };

        try {
            if (options.signal?.aborted) {
                handleAbort();
                return;
            }
            eventSource = new EventSource<string>(transport.endpoint, {
                method: 'POST',
                headers: getAuthHeaders(capabilities.protocol, config.apiKey, capabilities.endpoint),
                body: JSON.stringify(buildRequestBody(runtime, messages, options)),
                pollingInterval: 0,
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : '无法创建流式连接';
            settle(makeResult(false, { code: 'network_error', error: message }));
            return;
        }

        options.signal?.addEventListener('abort', handleAbort, { once: true });
        if (options.signal?.aborted) {
            handleAbort();
            return;
        }
        firstEventTimer = setTimeout(() => {
            settle(makeResult(false, {
                code: 'timeout',
                error: '等待首个流式事件超时（' + Math.round(STREAM_TIMEOUTS.firstEventTimeoutMs / 1000) + ' 秒）',
            }));
        }, STREAM_TIMEOUTS.firstEventTimeoutMs);
        totalTimer = setTimeout(() => {
            settle(makeResult(false, {
                code: 'timeout',
                error: '流式请求总超时（' + Math.round(STREAM_TIMEOUTS.totalTimeoutMs / 1000) + ' 秒）',
            }));
        }, STREAM_TIMEOUTS.totalTimeoutMs);

        const eventTypes = capabilities.protocol === 'responses'
            ? [
                'message',
                'response.created',
                'response.in_progress',
                'response.output_item.added',
                'response.output_item.done',
                'response.content_part.added',
                'response.content_part.done',
                'response.output_text.delta',
                'response.output_text.done',
                'response.reasoning_text.delta',
                'response.reasoning_summary_text.delta',
                'response.reasoning_summary_part.added',
                'response.reasoning_summary_part.done',
                'response.completed',
                'response.incomplete',
                'response.failed',
            ]
            : [
                'message',
                'message_start',
                'content_block_start',
                'content_block_delta',
                'content_block_stop',
                'message_delta',
                'message_stop',
                'ping',
            ];
        eventTypes.forEach((eventType) => {
            eventSource!.addEventListener(eventType, (event) => {
                handleEvent(eventType, event as ProviderStreamEvent);
            });
        });
        eventSource!.addEventListener('error', (event) => {
            const providerEvent = event as ProviderStreamEvent;
            if (settled) {
                return;
            }
            const xhrMeta = getXhrMeta(eventSource);
            const eventHttpStatus = typeof providerEvent.xhrStatus === 'number'
                ? providerEvent.xhrStatus
                : undefined;
            const httpStatus = eventHttpStatus && eventHttpStatus > 0
                ? eventHttpStatus
                : (xhrMeta.httpStatus ?? eventHttpStatus ?? 0);
            const eventXhrState = typeof providerEvent.xhrState === 'number'
                ? providerEvent.xhrState
                : undefined;
            const xhrState = eventXhrState && eventXhrState > 0
                ? eventXhrState
                : (xhrMeta.xhrState ?? eventXhrState);
            const transportErrorText = [providerEvent.message, providerEvent.data]
                .filter((value): value is string => typeof value === 'string' && value.length > 0)
                .join(' ');
            const isHttp200Cancel = isAnthropicHttp200Cancel(transportErrorText, httpStatus);
            if (providerEvent.data && !isHttp200Cancel) {
                handleEvent('error', providerEvent);
                return;
            }
            if (tryHandleAnthropicTransportClose(transportErrorText, httpStatus, xhrState)) {
                return;
            }
            const errorMessage = !state.firstEventAt
                && transport.webCrossOrigin
                && httpStatus === 0
                ? (transport.webProxyUsed ? getWebProxyUnavailableMessage() : getWebCrossOriginMessage())
                : typeof providerEvent.message === 'string' && providerEvent.message
                ? providerEvent.message.slice(0, 500)
                : (httpStatus > 0 && httpStatus !== 200
                    ? `接口返回 HTTP ${httpStatus}，请检查该协议是否可用以及 API Key 权限`
                    : !state.firstEventAt && transport.webCrossOrigin
                    ? (transport.webProxyUsed ? getWebProxyUnavailableMessage() : getWebCrossOriginMessage())
                    : (isHttp200Cancel
                        ? '流式连接在收到完成事件前中断，已保留已生成的部分内容'
                        : '流式连接意外中断'));
            settle(makeResult(false, {
                code: isHttp200Cancel ? 'network_error' : (httpStatus > 0 ? 'http_error' : 'network_error'),
                error: errorMessage,
                meta: { httpStatus, xhrState },
            }));
        });
    });
}

export async function streamProviderText(
    runtime: AIRequestRuntime,
    messages: AIProviderMessage[],
    options: ProviderRequestOptions,
): Promise<AIProviderResult> {
    const effectiveOptions: ProviderRequestOptions = {
        ...options,
        maxTokens: runtime.config.maxOutputTokens,
        temperature: runtime.meta.temperature,
        executionMeta: { ...runtime.meta, skills: options.skills ?? runtime.meta.skills },
    };
    const operationId = createOperationId();
    logRequestStarted(operationId, runtime.capabilities, effectiveOptions);
    return runStreamRequest(runtime, messages, effectiveOptions, operationId);
}

export async function testProviderConnection(
    config: AIProviderConfig,
    options: ProviderConnectionTestOptions = {},
): Promise<AIProviderConnectionTestResult> {
    if (!config.apiUrl.trim() || !config.apiKey.trim() || !config.model.trim()) {
        throw new Error('请先填写接口地址、API Key，并选择模型。');
    }
    const operationId = 'connection-' + createOperationId();
    const first = config.protocolVerified ? config.protocol : inferProviderProtocol(config.apiUrl, config.model);
    const protocols: AIProviderProtocol[] = config.protocolPreference === 'auto'
        ? [first, first === 'responses' ? 'anthropic_messages' : 'responses']
        : [config.protocolPreference];
    const attempts: AIProviderConnectionAttempt[] = [];
    for (const [index, protocol] of protocols.entries()) {
        if (options.signal?.aborted) break;
        options.onAttempt?.(protocol, index + 1, protocols.length);
        let runtime: AIRequestRuntime;
        try {
            // Resolve capabilities for this candidate without changing the user's reasoning selection.
            runtime = await resolveAIRequestRuntime({ ...config, protocol });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : '读取模型配置失败';
            attempts.push({ protocol, success: false, code: 'invalid_configuration', error: message });
            continue;
        }
        if (options.signal?.aborted) break;
        const result = await streamProviderText(runtime, [{ role: 'user', content: '请只回复 pong。' }], {
            stage: 'connection_test', requestType: 'connection_test', signal: options.signal,
            parentOperationId: operationId,
        });
        attempts.push({ protocol, success: result.success, code: result.code, error: result.error, result });
        if (result.success) return { operationId, success: true, attempts, selectedProtocol: protocol, selectedResult: result };
        if (result.code === 'aborted') break;
    }
    return {
        operationId, success: false, attempts,
        error: options.signal?.aborted ? '连接测试已取消'
            : attempts.map((attempt) => `${getProtocolLabel(attempt.protocol)}：${attempt.error || '未返回完整正文'}`).join('\n\n'),
    };
}
