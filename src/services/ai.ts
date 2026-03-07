/**
 * AI 分析服务
 * 负责六爻与八字两套排盘的系统提示词、上下文整理、流式请求与快捷追问。
 */

import EventSource from 'react-native-sse';
import { BaziAIConversationDigest, BaziAIConversationStage, PersistedAIChatMessage } from '../core/ai-meta';
import { extractBaziRelations } from '../core/bazi-relations';
import { BaziResult } from '../core/bazi-types';
import { getAllRelatedGua } from '../core/hexagramTransform';
import { PanResult } from '../core/liuyao-calc';
import { BA_GUA, DIZHI_WUXING } from '../core/liuyao-data';
import { getMonthGeneralByJieqi, getMoonPhase } from '../core/time-signs';
import ichingData from '../data/iching.json';
import { BaziFormatterContext, formatBaziToText } from './bazi-formatter';
import { DEFAULT_BAZI_SYSTEM_PROMPT, DEFAULT_LIUYAO_SYSTEM_PROMPT } from './default-prompts';
import { getSettings } from './settings';

const ICHING_MAP = new Map<string, string>();
(ichingData as any[]).forEach((item) => {
    ICHING_MAP.set(item.array.join(''), item.name);
});

const BAZI_DIGEST_VERSION = 1;
const BAZI_FOUNDATION_PROMPT = [
    '当前只执行八字工作流的第一阶段：基础定局。',
    '本阶段只允许输出基础定局，不允许输出前事核验，不允许输出未来趋势，不允许向用户提问。',
    '请围绕以下四个核心维度完成判断：日主旺衰、格局、用神忌神、性格基调。',
    '输出时请使用清晰小标题，并至少展开 3 个结构化小点，每个小点都要给出命理依据。',
    '本阶段全部内容写完后，必须在最后单独一行输出：[[BAZI_STAGE:FOUNDATION_DONE]]',
].join('\n');
const BAZI_VERIFICATION_PROMPT = [
    '基础定局已经完成，现在开始八字工作流第二阶段：前事核验。',
    '请只输出前事核验，不要重复基础定局，不要进入未来趋势。',
    '请列出 3 到 5 个过去关键时间点或阶段，每条必须包含：年龄或年份、可能应事、命理依据、对应大运流年。',
    '输出要结构化，优先使用编号列表，避免空泛描述。',
    '本阶段全部内容写完后，必须在最后单独一行输出：[[BAZI_STAGE:VERIFICATION_DONE]]',
].join('\n');
const BAZI_FALLBACK_QUICK_REPLIES = [
    '细看未来五年财运',
    '未来哪年感情波动大',
    '未来五年事业发力点',
];
const QUICK_REPLY_EMOJI_REGEX = /[\p{Extended_Pictographic}\uFE0F]/u;
const BAZI_STAGE_MARKERS = {
    foundation: '[[BAZI_STAGE:FOUNDATION_DONE]]',
    verification: '[[BAZI_STAGE:VERIFICATION_DONE]]',
    five_year: '[[BAZI_STAGE:FIVE_YEAR_DONE]]',
} as const;

export type BaziWorkflowResponseKind = keyof typeof BAZI_STAGE_MARKERS;

export interface AIAnalysisResult {
    success: boolean;
    content?: string;
    error?: string;
}

export interface AIChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface AIRequestOptions {
    temperature?: number;
    maxTokens?: number;
}

function isBaziResult(result: PanResult | BaziResult): result is BaziResult {
    return Array.isArray((result as BaziResult).fourPillars);
}

function getGongWuXing(gongName: string): string {
    const gua = Object.values(BA_GUA).find((item) => item.name === gongName);
    return gua ? gua.wuxing : '';
}

function formatPanForAI(result: PanResult): string {
    const lines: string[] = [];
    const monthGeneral = result.monthGeneral || getMonthGeneralByJieqi(result.jieqi?.current || '', result.monthGanZhi?.[1]);
    const createdAtDate = new Date(result.createdAt);
    const moonPhaseDate = Number.isNaN(createdAtDate.getTime()) ? new Date() : createdAtDate;
    const moonPhase = getMoonPhase(moonPhaseDate, result.lunarInfo?.day);

    lines.push('【排盘信息】');
    lines.push(`公历：${result.solarDate} ${result.solarTime}`);
    if (result.trueSolarTime) {
        lines.push(`真太阳时：${result.trueSolarTime}${result.location ? `（${result.location}，经度${result.longitude?.toFixed(2)}°）` : ''}`);
    }
    lines.push(`农历：${result.lunarInfo.lunarMonthCN}${result.lunarInfo.lunarDayCN} ${result.lunarInfo.hourZhi}时`);
    lines.push(`节气：${result.jieqi.current}（${result.jieqi.currentDate}）→ ${result.jieqi.next}（${result.jieqi.nextDate}）`);
    lines.push('');
    lines.push('【四柱】');
    lines.push(`年柱：${result.yearGanZhi}（${result.yearNaYin}）`);
    lines.push(`月柱：${result.monthGanZhi}（${result.monthNaYin}）`);
    lines.push(`日柱：${result.dayGanZhi}（${result.dayNaYin}）`);
    lines.push(`时柱：${result.hourGanZhi}（${result.hourNaYin}）`);
    lines.push(`【月将】${monthGeneral.zhi}将${monthGeneral.name}（依据节气：${monthGeneral.basedOnTerm}）`);
    lines.push(`【月相】${moonPhase.name}（月龄${moonPhase.ageDays.toFixed(2)}天，亮度${moonPhase.illuminationPct}%）`);
    if (result.xunKong && result.shenSha) {
        lines.push(`【空亡】日空：${result.xunKong.join(' ')}`);
        lines.push(`【神煞】驿马:${result.shenSha.yiMa || '无'} 桃花:${result.shenSha.taoHua || '无'} 贵人:${result.shenSha.tianYiGuiRen.join(' ')} 禄神:${result.shenSha.luShen || '无'} 羊刃:${result.shenSha.yangRen || '无'} 文昌:${result.shenSha.wenChang || '无'} 将星:${result.shenSha.jiangXing || '无'} 华盖:${result.shenSha.huaGai || '无'} 劫煞:${result.shenSha.jieSha || '无'} 灾煞:${result.shenSha.zaiSha || '无'}`);
    }
    lines.push('');

    const monthZhi = result.monthGanZhi[1];
    const dayZhi = result.dayGanZhi[1];
    lines.push(`【日月建】月建：${monthZhi}${DIZHI_WUXING[monthZhi] || ''}  日建：${dayZhi}${DIZHI_WUXING[dayZhi] || ''}`);
    lines.push('');

    const benGongWuXing = getGongWuXing(result.benGua.gong);
    lines.push(`【本卦】${result.benGua.fullName}（${result.benGua.gong}宫·${benGongWuXing}）`);

    const array = result.benGuaYao.map((item) => (item.nature === 'yang' ? 1 : 0));
    const related = getAllRelatedGua(array);
    const findGuaName = (target: number[]) => ICHING_MAP.get(target.join('')) || '未知';
    lines.push(`【衍生命卦】互卦：${findGuaName(related.hu)} | 错卦：${findGuaName(related.cuo)} | 综卦：${findGuaName(related.zong)}`);
    lines.push(`世爻：第${result.benGua.shiYao}爻 | 应爻：第${result.benGua.yingYao}爻`);
    lines.push('');
    lines.push('爻位 | 六神 | 六亲 | 天干 | 地支 | 五行 | 世应 | 动静');
    lines.push('-----|------|------|------|------|------|------|------');
    for (let index = 5; index >= 0; index -= 1) {
        const yao = result.benGuaYao[index];
        const shiYing = yao.isShi ? '世' : yao.isYing ? '应' : '　';
        const moving = yao.isMoving ? '动' : '静';
        const nature = yao.nature === 'yang' ? '阳' : '阴';
        const gan = yao.ganZhi[0];
        lines.push(`${yao.positionName}爻 | ${yao.liuShenShort} | ${yao.liuQinShort} | ${gan} | ${yao.zhi}${nature} | ${yao.wuxing} | ${shiYing} | ${moving}`);
    }

    if (result.bianGua) {
        lines.push('');
        const bianGongWuXing = getGongWuXing(result.bianGua.gong);
        lines.push(`【变卦】${result.bianGua.fullName}（${result.bianGua.gong}宫·${bianGongWuXing}）`);
        lines.push(`世爻：第${result.bianGua.shiYao}爻 | 应爻：第${result.bianGua.yingYao}爻`);
        if (result.bianGuaYao && result.bianGuaYao.length === 6) {
            lines.push('');
            lines.push('爻位 | 六亲 | 天干 | 地支 | 五行');
            lines.push('-----|------|------|------|------');
            for (let index = 5; index >= 0; index -= 1) {
                const yao = result.bianGuaYao[index];
                const nature = yao.nature === 'yang' ? '阳' : '阴';
                const gan = yao.ganZhi[0];
                lines.push(`${yao.positionName}爻 | ${yao.liuQinShort} | ${gan} | ${yao.zhi}${nature} | ${yao.wuxing}`);
            }
        }
    }

    if (result.movingYaoPositions.length > 0) {
        lines.push('');
        lines.push(`【动爻】第${result.movingYaoPositions.join('、')}爻`);
        for (const pos of result.movingYaoPositions) {
            const yao = result.benGuaYao[pos - 1];
            lines.push(`  ${yao.positionName}爻：${yao.liuShenShort}·${yao.liuQinShort}${yao.zhi}(${yao.wuxing})${yao.bianZhi ? ` → ${yao.bianLiuQinShort}${yao.bianZhi}(${yao.bianWuXing})` : ''}`);
        }
    }

    if (result.question) {
        lines.push('');
        lines.push(`【占问】${result.question}`);
    }

    lines.push('');
    lines.push(`起卦方式：${result.method}`);
    return lines.join('\n');
}

function splitBaziStemBranch(result: BaziResult): { stems: string[]; branches: string[] } {
    return {
        stems: result.fourPillars.map((item) => item[0]),
        branches: result.fourPillars.map((item) => item[1]),
    };
}

function getBaziRelations(result: BaziResult): string[] {
    const { stems, branches } = splitBaziStemBranch(result);
    return extractBaziRelations(stems, branches);
}

function toApiMessages(messages: PersistedAIChatMessage[]): AIChatMessage[] {
    return messages.map(({ role, content }) => ({ role, content }));
}

function toVisibleMessages(messages: PersistedAIChatMessage[]): PersistedAIChatMessage[] {
    return messages.filter((message) => !message.hidden);
}

function getLastVisibleUserContent(messages: PersistedAIChatMessage[]): string {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
        const message = messages[index];
        if (message.role === 'user' && !message.hidden && message.content.trim()) {
            return message.content.trim();
        }
    }
    return '';
}

function summarizeMessages(messages: PersistedAIChatMessage[]): string {
    const visible = toVisibleMessages(messages).filter((message) => message.role !== 'system');
    if (visible.length === 0) {
        return '暂无可见会话记录';
    }
    return visible.slice(-8).map((message) => `${message.role === 'user' ? '用户' : '助手'}：${message.content}`).join('\n');
}

export function normalizeBaziConversationStage(stage: unknown): BaziAIConversationStage | undefined {
    if (stage === 'foundation_pending' || stage === 'foundation_ready' || stage === 'verification_ready' || stage === 'followup_ready') {
        return stage;
    }
    if (stage === 'verification_confirmed') {
        return 'followup_ready';
    }
    if (stage === 'initial_pending') {
        return 'foundation_pending';
    }
    if (stage === 'verification_pending') {
        return 'verification_ready';
    }
    return undefined;
}

function hasBaziFollowUpHistory(messages?: PersistedAIChatMessage[]): boolean {
    if (!messages || messages.length === 0) {
        return false;
    }

    const visible = toVisibleMessages(messages).filter((message) => message.role !== 'system');
    const visibleUserCount = visible.filter((message) => message.role === 'user').length;
    const visibleAssistantCount = visible.filter((message) => message.role === 'assistant').length;
    return visibleUserCount > 0 || visibleAssistantCount > 1;
}

function countStructuredItems(section: string): number {
    return (section.match(/(^|\n)\s*(?:[-*•]|\d+[.)、])/g) ?? []).length;
}

function countMentionedYears(section: string): number {
    const matches = section.match(/\b20\d{2}\b/g) ?? [];
    return new Set(matches).size;
}

function getLatestAssistantText(result: BaziResult): string {
    if (result.aiChatHistory && result.aiChatHistory.length > 0) {
        for (let index = result.aiChatHistory.length - 1; index >= 0; index -= 1) {
            const message = result.aiChatHistory[index];
            if (message.role === 'assistant' && message.content.trim()) {
                return message.content.trim();
            }
        }
    }
    return result.aiAnalysis?.trim() || '';
}

function getContentMarker(content: string): BaziWorkflowResponseKind | null {
    const normalized = content.trim();
    for (const [kind, marker] of Object.entries(BAZI_STAGE_MARKERS) as [BaziWorkflowResponseKind, string][]) {
        if (normalized.includes(marker)) {
            return kind;
        }
    }
    return null;
}

function getExpectedMarker(kind: BaziWorkflowResponseKind): string {
    return BAZI_STAGE_MARKERS[kind];
}

function getPartialMarkerStartIndex(content: string): number {
    const markerStart = content.lastIndexOf('[[BAZI_STAGE:');
    if (markerStart === -1) {
        return -1;
    }

    return content.indexOf(']]', markerStart) === -1 ? markerStart : -1;
}

function normalizeStageText(content: string): string {
    return content
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

export function sanitizeBaziStreamingContent(content: string): string {
    const withoutMarkers = content.replace(/\[\[BAZI_STAGE:(?:FOUNDATION_DONE|VERIFICATION_DONE|FIVE_YEAR_DONE)\]\]/g, '');
    const partialMarkerStart = getPartialMarkerStartIndex(withoutMarkers);
    const visibleContent = partialMarkerStart === -1
        ? withoutMarkers
        : withoutMarkers.slice(0, partialMarkerStart);
    return normalizeStageText(visibleContent);
}

export function stripBaziStageMarkers(content: string): string {
    return normalizeStageText(
        content.replace(/\[\[BAZI_STAGE:(?:FOUNDATION_DONE|VERIFICATION_DONE|FIVE_YEAR_DONE)\]\]/g, ''),
    );
}

function formatLocalDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function resolveBaziFutureWindow(now: Date = new Date()): { currentYear: number; futureStartYear: number; futureEndYear: number; todayText: string } {
    const currentYear = now.getFullYear();
    return {
        currentYear,
        futureStartYear: currentYear + 1,
        futureEndYear: currentYear + 5,
        todayText: formatLocalDate(now),
    };
}

function getFoundationStructureIssues(content: string): string[] {
    const issues: string[] = [];
    const signalCount = ['日主', '格局', '用神', '忌神', '性格']
        .filter((keyword) => content.includes(keyword))
        .length;

    if (!content.includes('基础定局') && signalCount < 3) {
        issues.push('基础定局主体不足');
    }
    if (countStructuredItems(content) < 3 && signalCount < 4) {
        issues.push('基础定局结构不足');
    }

    return issues;
}

function getVerificationStructureIssues(content: string): string[] {
    const issues: string[] = [];
    const eventCount = countStructuredItems(content);

    if (!content.includes('前事核验') && !(content.includes('大运') && content.includes('流年'))) {
        issues.push('前事核验主体不足');
    }
    if (eventCount < 3) {
        issues.push('前事核验事件点数量不足');
    }

    return issues;
}

function getFiveYearStructureIssues(content: string, result?: BaziResult): string[] {
    const issues: string[] = [];
    const { currentYear, futureStartYear, futureEndYear } = resolveBaziFutureWindow();
    const mentionedYears = [String(currentYear), ...Array.from(
        { length: futureEndYear - futureStartYear + 1 },
        (_, index) => String(futureStartYear + index),
    )]
        .filter((year) => content.includes(year))
        .length;

    if (!content.includes('今年') && !content.includes('未来五年') && !content.includes('五年')) {
        issues.push('未来五年主体不足');
    }
    if (countStructuredItems(content) < 6 && mentionedYears < 4 && countMentionedYears(content) < 4) {
        issues.push('未来五年结构不足');
    }

    return issues;
}

export function getBaziWorkflowStructureIssues(
    kind: BaziWorkflowResponseKind,
    content: string,
    result?: BaziResult,
): string[] {
    if (kind === 'foundation') {
        return getFoundationStructureIssues(content);
    }
    if (kind === 'verification') {
        return getVerificationStructureIssues(content);
    }
    return getFiveYearStructureIssues(content, result);
}

export function validateBaziWorkflowResponse(
    kind: BaziWorkflowResponseKind,
    rawContent: string,
    result?: BaziResult,
): {
    success: boolean;
    cleanContent: string;
    marker: BaziWorkflowResponseKind | null;
    issues: string[];
} {
    const marker = getContentMarker(rawContent);
    const cleanContent = stripBaziStageMarkers(rawContent);
    const issues = marker === kind
        ? getBaziWorkflowStructureIssues(kind, cleanContent, result)
        : [`缺少完成标记：${getExpectedMarker(kind)}`];

    return {
        success: issues.length === 0,
        cleanContent,
        marker,
        issues,
    };
}

function buildBaziDigestText(digest: BaziAIConversationDigest): string {
    const topicLines = Object.entries(digest.topicNotes || {})
        .filter(([, value]) => value && value.trim())
        .map(([key, value]) => `${key}：${value}`);

    const lines = [
        '【既有诊断摘要】以下内容是本会话已确认的格局与分析基线，后续追问默认沿用，除非新证据足以推翻：',
        `日主：${digest.foundation.dayMaster || '未定'}`,
        `格局：${digest.foundation.structure || '未定'}`,
        `用神：${digest.foundation.favorableGod || '未定'}`,
        `忌神：${digest.foundation.unfavorableGod || '未定'}`,
        `性格：${digest.foundation.personality || '未定'}`,
        `前事核验：${digest.verificationSummary || '暂无前事核验摘要'}`,
        `未来五年：${digest.fiveYearSummary || '暂无未来五年摘要'}`,
        `会话摘要：${digest.rollingSummary || '暂无摘要'}`,
    ];

    if (topicLines.length > 0) {
        lines.push('分题记录：');
        topicLines.forEach((line) => lines.push(line));
    }

    return lines.join('\n');
}

function parseJsonPayload(content: string): Record<string, unknown> | null {
    const trimmed = content.trim();
    if (!trimmed) {
        return null;
    }

    const fencedMatch = trimmed.match(/```json\s*([\s\S]*?)\s*```/i);
    const candidate = fencedMatch ? fencedMatch[1] : trimmed;
    try {
        const parsed = JSON.parse(candidate);
        return typeof parsed === 'object' && parsed !== null ? parsed as Record<string, unknown> : null;
    } catch {
        return null;
    }
}

function normalizeDigest(payload: Record<string, unknown>): BaziAIConversationDigest | null {
    const foundation = typeof payload.foundation === 'object' && payload.foundation !== null
        ? payload.foundation as Record<string, unknown>
        : null;
    const topicNotesRaw = typeof payload.topicNotes === 'object' && payload.topicNotes !== null
        ? payload.topicNotes as Record<string, unknown>
        : {};

    const digest: BaziAIConversationDigest = {
        version: BAZI_DIGEST_VERSION,
        generatedAt: new Date().toISOString(),
        foundation: {
            dayMaster: typeof foundation?.dayMaster === 'string' ? foundation.dayMaster : '',
            structure: typeof foundation?.structure === 'string' ? foundation.structure : '',
            favorableGod: typeof foundation?.favorableGod === 'string' ? foundation.favorableGod : '',
            unfavorableGod: typeof foundation?.unfavorableGod === 'string' ? foundation.unfavorableGod : '',
            personality: typeof foundation?.personality === 'string' ? foundation.personality : '',
        },
        verificationSummary: typeof payload.verificationSummary === 'string'
            ? payload.verificationSummary
            : (typeof topicNotesRaw.verification === 'string' ? topicNotesRaw.verification : ''),
        fiveYearSummary: typeof payload.fiveYearSummary === 'string'
            ? payload.fiveYearSummary
            : (typeof topicNotesRaw.fiveYear === 'string' ? topicNotesRaw.fiveYear : ''),
        rollingSummary: typeof payload.rollingSummary === 'string' ? payload.rollingSummary : '',
        topicNotes: Object.fromEntries(
            Object.entries(topicNotesRaw)
                .filter(([key, value]) => key !== 'verification' && key !== 'fiveYear' && typeof value === 'string' && value.trim().length > 0)
                .map(([key, value]) => [key, value as string]),
        ),
    };

    const hasFoundation = Object.values(digest.foundation).some((value) => value.trim().length > 0);
    return hasFoundation
        || digest.verificationSummary.trim().length > 0
        || digest.fiveYearSummary.trim().length > 0
        || digest.rollingSummary.trim().length > 0
        ? digest
        : null;
}

function parseQuickReplyLines(content: string): string[] {
    const lines = content
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

    if (lines.length < 3) {
        return [];
    }

    const sliced = lines.slice(0, 3);
    const isValid = sliced.every((line) => (
        line.length >= 6
        && line.length <= 24
        && !QUICK_REPLY_EMOJI_REGEX.test(line)
        && !/^\d+[\.\)]/.test(line)
        && !/^[-*•]/.test(line)
    ));

    return isValid ? sliced : [];
}

async function requestChatCompletion(messages: AIChatMessage[], options: AIRequestOptions = {}): Promise<string | null> {
    const settings = await getSettings();
    if (!settings.apiKey || !settings.apiUrl) {
        return null;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
        const response = await fetch(settings.apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${settings.apiKey.trim()}`,
            },
            body: JSON.stringify({
                model: settings.model,
                messages,
                temperature: options.temperature ?? 0.3,
                max_tokens: options.maxTokens ?? 600,
            }),
            signal: controller.signal as RequestInit['signal'],
        });

        if (!response.ok) {
            return null;
        }

        const data = await response.json();
        return typeof data.choices?.[0]?.message?.content === 'string'
            ? data.choices[0].message.content
            : null;
    } catch {
        return null;
    } finally {
        clearTimeout(timeoutId);
    }
}

export function getBaziFoundationPrompt(): string {
    return BAZI_FOUNDATION_PROMPT;
}

function getBuiltInSystemPrompt(engine: 'liuyao' | 'bazi'): string {
    return engine === 'liuyao' ? DEFAULT_LIUYAO_SYSTEM_PROMPT : DEFAULT_BAZI_SYSTEM_PROMPT;
}

export function getLocalBaziQuickReplies(): string[] {
    return [...BAZI_FALLBACK_QUICK_REPLIES];
}

export function getLocalBaziVerificationActions(): string[] {
    return ['前事较准，继续深解', '前事偏差，重新校验'];
}

export function buildBaziVerificationPrompt(): string {
    return BAZI_VERIFICATION_PROMPT;
}

export function buildBaziVerificationRetryPrompt(): string {
    return [
        '请重新开始当前阶段，不要沿用刚才那条未完成的输出。',
        '请严格按照本阶段要求完整写完正文。',
        '本阶段全部内容写完后，必须在最后单独一行输出对应的阶段完成标记。',
    ].join('\n');
}

export function buildBaziFiveYearPrompt(result: BaziResult): string {
    const { currentYear, futureStartYear, futureEndYear, todayText } = resolveBaziFutureWindow();
    return [
        '前事核验已经通过，当前开始八字工作流第三阶段：未来五年解盘。',
        `当前设备本地日期是 ${todayText}，今年是 ${currentYear} 年。你必须把 ${currentYear} 年视为“今年”，不能把它并入未来五年。`,
        `请在已确认的基础定局与前事核验认知上，先单独分析今年（${currentYear} 年）的运势，再分析未来五年（${futureStartYear}-${futureEndYear} 年）的运势。`,
        '本阶段不要重复前两阶段正文，不要再向用户提问。',
        `输出顺序固定为：1. 今年（${currentYear}）总览；2. 未来五年总纲；3. ${futureStartYear}-${futureEndYear} 按年份逐年展开。`,
        `今年与未来每一年都至少写清：核心主题、命理依据（大运/流年如何作用）、机会点、风险点、落地建议。`,
        `结尾补一段总策略，说明 ${currentYear} 年当下应对重点，以及 ${futureStartYear}-${futureEndYear} 中最值得主动发力和最需要保守规避的年份。`,
        `本阶段全部内容写完后，必须在最后单独一行输出：${BAZI_STAGE_MARKERS.five_year}`,
    ].join('\n');
}

export function getLocalBaziFoundationActionLabel(): string {
    return '开始前事核验';
}

export function buildBaziFollowUpPrompt(userText: string): string {
    return `请沿用你之前已经完成的基础定局、前事核验与未来五年解盘结论，除非新证据足以推翻，不要重新泛论全局。现在只聚焦这个主题：${userText}。请先用一句话承接既有格局用忌与五年主线，再分点分析该主题的走势、依据、风险与建议。`;
}

export function getChatRequestOptions(
    result: PanResult | BaziResult,
    phase: 'initial' | 'followup',
): AIRequestOptions {
    if (!isBaziResult(result)) {
        return {};
    }

    return phase === 'initial'
        ? { temperature: 0.3, maxTokens: 3200 }
        : { temperature: 0.4, maxTokens: 3600 };
}

export function getBaziConversationStage(result: BaziResult): BaziAIConversationStage {
    const normalizedStage = normalizeBaziConversationStage(result.aiConversationStage);
    if (normalizedStage) {
        return normalizedStage;
    }

    if (result.aiConversationDigest || (result.quickReplies && result.quickReplies.length > 0) || hasBaziFollowUpHistory(result.aiChatHistory)) {
        return 'followup_ready';
    }

    const lastAssistantText = getLatestAssistantText(result);
    const contentMarker = getContentMarker([lastAssistantText, result.aiVerificationSummary || ''].filter(Boolean).join('\n'));

    if (contentMarker === 'verification') {
        return 'verification_ready';
    }
    if (contentMarker === 'foundation') {
        return 'foundation_ready';
    }
    if (result.aiAnalysis || (result.aiChatHistory && result.aiChatHistory.length > 0)) {
        return 'foundation_ready';
    }
    return 'foundation_pending';
}

export function shouldGeneratePostResponseArtifacts(
    result: PanResult | BaziResult,
    stageOrPhase: BaziAIConversationStage | 'initial' | 'followup',
): boolean {
    if (!isBaziResult(result)) {
        return true;
    }

    return stageOrPhase === 'followup_ready' || stageOrPhase === 'followup';
}

export async function buildSystemMessage(result: PanResult): Promise<AIChatMessage> {
    const panStr = formatPanForAI(result);

    return {
        role: 'system',
        content: `${getBuiltInSystemPrompt('liuyao')}\n\n【本轮要求】\n你当前的分析必须严格基于以下排盘数据（无论用户后续问什么，都不能跨出此盘数据范畴）：\n${panStr}`,
    };
}

export async function buildBaziSystemMessage(
    result: BaziResult,
    relations: string[],
    formatterContext?: BaziFormatterContext,
): Promise<AIChatMessage> {
    const baziText = formatBaziToText(result, relations, formatterContext);

    return {
        role: 'system',
        content: `${getBuiltInSystemPrompt('bazi')}

【系统铁律】
1. 系统已为你测算好四柱、岁运与客观合冲刑害事实。
2. 你绝对禁止自行推演、补算、篡改任何合冲刑害，凡涉及关系判断，必须只引用系统提供的事实。
3. 工作流顺序固定为：基础定局 → 前事核验 → 未来五年 → 用户追问；不得越级输出。
4. 基础定局阶段只准输出日主旺衰、格局、用神忌神、性格基调，不得混入前事核验或未来趋势。
5. 前事核验阶段必须结合命局、大运、流年、小运与当前流月组做交叉验证。
6. 每个阶段正文写完后，必须在最后单独一行输出系统指定的阶段完成标记。
7. 后续追问默认继承本会话已判定的格局、旺衰、用神、忌神与未来五年主线，除非新证据足以推翻。

【强制阅盘工序】
1. 基础定局：先定日主旺衰、格局、用神忌神与性格基调。
2. 前事核验：再用过去关键事件核验命局做功、体用、宾主判断。
3. 未来五年：只有在用户确认前事核验较准后，才进入未来五年判断。
4. 用户追问：只有在未来五年阶段完成后，才开放专题追问。

【输出要求】
1. 使用清晰小标题，不要暴露隐式推理过程。
2. 结论必须与系统给出的客观事实一致，不得编造未提供的家庭背景、职业经历或人生事件。
3. 不使用 emoji，不使用空泛鸡汤。
4. 若结论存在分歧，必须指出分歧来自何处。

【命盘底稿】
${baziText}`,
    };
}

export async function buildRequestMessages(
    result: PanResult | BaziResult,
    chatHistory: PersistedAIChatMessage[],
    formatterContext?: BaziFormatterContext,
): Promise<AIChatMessage[]> {
    if (!isBaziResult(result)) {
        return [await buildSystemMessage(result), ...toApiMessages(chatHistory)];
    }

    const relations = getBaziRelations(result);
    const systemMessage = await buildBaziSystemMessage(result, relations, formatterContext);
    const digest = result.aiConversationDigest;

    if (digest) {
        const recentVisible = toVisibleMessages(chatHistory).slice(-10);
        return [
            systemMessage,
            { role: 'system', content: buildBaziDigestText(digest) },
            ...toApiMessages(recentVisible),
        ];
    }

    return [systemMessage, ...toApiMessages(chatHistory)];
}

export async function analyzeWithAIChatStream(
    messages: AIChatMessage[],
    onChunk: (text: string) => void,
    signal?: AbortSignal,
    requestOptions: AIRequestOptions = {},
): Promise<AIAnalysisResult> {
    const settings = await getSettings();

    if (!settings.apiKey) {
        return { success: false, error: '请先在设置中配置 API Key' };
    }
    if (!settings.apiUrl) {
        return { success: false, error: '请先在设置中配置 API 接口地址' };
    }

    let fullContent = '';
    let eventSource: EventSource;

    return new Promise((resolve) => {
        let isAborted = false;
        let heartbeatTimer: NodeJS.Timeout;
        const resetHeartbeat = () => {
            if (heartbeatTimer) {
                clearTimeout(heartbeatTimer);
            }
            heartbeatTimer = setTimeout(() => {
                if (isAborted) {
                    return;
                }
                isAborted = true;
                eventSource.close();
                resolve({ success: false, error: '连接超时：服务器长时间无响应' });
            }, 30000);
        };

        resetHeartbeat();

        eventSource = new EventSource(settings.apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${settings.apiKey.trim()}`,
            },
            body: JSON.stringify({
                model: settings.model,
                messages,
                temperature: requestOptions.temperature ?? 0.7,
                max_tokens: requestOptions.maxTokens ?? 2000,
                stream: true,
            }),
        });

        if (signal) {
            signal.addEventListener('abort', () => {
                if (heartbeatTimer) {
                    clearTimeout(heartbeatTimer);
                }
                isAborted = true;
                eventSource.close();
                resolve({ success: false, error: 'ABORTED' });
            });
        }

        eventSource.addEventListener('message', (event) => {
            if (isAborted) {
                return;
            }
            resetHeartbeat();
            const dataStr = event.data;
            if (!dataStr) {
                return;
            }
            if (dataStr === '[DONE]') {
                if (heartbeatTimer) {
                    clearTimeout(heartbeatTimer);
                }
                eventSource.close();
                resolve({ success: true, content: fullContent });
                return;
            }

            try {
                const parsed = JSON.parse(dataStr);
                const chunk = parsed.choices?.[0]?.delta?.content || '';
                if (chunk) {
                    fullContent += chunk;
                    onChunk(chunk);
                }
            } catch {
                // 忽略非标准消息块
            }
        });

        eventSource.addEventListener('error', (error: any) => {
            if (isAborted) {
                return;
            }
            if (heartbeatTimer) {
                clearTimeout(heartbeatTimer);
            }
            eventSource.close();
            const errorMessage = error.message || JSON.stringify(error);
            resolve({
                success: false,
                error: `模型请求意外中断: ${errorMessage}`,
            });
        });
    });
}

export async function generateBaziConversationDigest(
    result: BaziResult,
    chatHistory: PersistedAIChatMessage[],
): Promise<BaziAIConversationDigest | null> {
    const relations = getBaziRelations(result);
    const previousDigest = result.aiConversationDigest;
    const baseContext = previousDigest
        ? `【已有摘要】\n${buildBaziDigestText(previousDigest)}`
        : `【命盘底稿】\n${formatBaziToText(result, relations)}`;
    const conversationSummary = summarizeMessages(chatHistory);
    const content = await requestChatCompletion([
        {
            role: 'system',
            content: '你是八字会话摘要器，只负责压缩已确认结论，不新增命理事实。输出必须是严格 JSON，不要 markdown，不要解释。',
        },
        {
            role: 'user',
            content: `${baseContext}

【最近会话】
${conversationSummary}

请只返回严格 JSON，结构如下：
{"foundation":{"dayMaster":"","structure":"","favorableGod":"","unfavorableGod":"","personality":""},"verificationSummary":"","fiveYearSummary":"","rollingSummary":"","topicNotes":{"wealth":"","relationship":"","career":""}}

要求：
1. foundation 只保留当前对话已经明确判定的结论。
2. verificationSummary 用 80 字以内压缩已完成的前事核验结论；没有就留空。
3. fiveYearSummary 用 80 字以内压缩已完成的未来五年主线；没有就留空。
4. rollingSummary 用 80 字以内总结当前分析进度。
5. topicNotes 只记录已经明确讨论过的后续专题，没有就留空字符串。
6. 不要输出 JSON 之外的任何内容。`,
        },
    ], { temperature: 0.1, maxTokens: 420 });

    if (!content) {
        return null;
    }

    const parsed = parseJsonPayload(content);
    return parsed ? normalizeDigest(parsed) : null;
}

export async function generateQuickReplies(
    result: PanResult | BaziResult,
    chatHistory: PersistedAIChatMessage[],
): Promise<string[]> {
    if (isBaziResult(result)) {
        const digestText = result.aiConversationDigest
            ? buildBaziDigestText(result.aiConversationDigest)
            : '暂无既有摘要，请围绕基础诊断与后续高价值追问生成短句。';
        const recentFocus = getLastVisibleUserContent(chatHistory) || '基础诊断';
        const content = await requestChatCompletion([
            {
                role: 'system',
                content: '你只负责生成八字追问短句。只返回 3 行纯文本，每行一条，不要 JSON，不要序号，不要 emoji，不要解释。',
            },
            {
                role: 'user',
                content: `【当前已确认摘要】
${digestText}

【最近关注】
${recentFocus}

请生成 3 条后续追问短句，要求：
1. 每条 8 到 18 个汉字。
2. 优先围绕未来五年财运、婚姻桃花、事业发力点或关键年份选择。
3. 若最近对话已经深入讨论其中某类，则替换成下一优先的高价值单主题追问。
4. 只输出 3 行纯文本。`,
            },
        ], { temperature: 0.4, maxTokens: 120 });

        const parsed = content ? parseQuickReplyLines(content) : [];
        return parsed.length === 3 ? parsed : BAZI_FALLBACK_QUICK_REPLIES;
    }

    if (!result.question) {
        return [];
    }

    const settings = await getSettings();
    if (!settings.apiKey || !settings.apiUrl) {
        return [];
    }

    const systemMsg = await buildSystemMessage(result);
    const instruction: AIChatMessage = {
        role: 'user',
        content: `这是用户占问的主题：“${result.question}”。请你根据前文提供的排盘数据及我们刚刚的对话进度，站在预测大师的角度，提供 3 到 4 个极具价值的【后续追问短句】。无需废话，仅返回一段被 \`\`\`json\`\`\` 包裹的内容，例如：{"quickReplies":["追问1","追问2","追问3"]}`,
    };

    const content = await requestChatCompletion(
        [systemMsg, ...toApiMessages(chatHistory), instruction],
        { temperature: 0.7, maxTokens: 180 },
    );
    if (!content) {
        return [];
    }

    const parsed = parseJsonPayload(content);
    return parsed && Array.isArray(parsed.quickReplies)
        ? parsed.quickReplies.filter((item): item is string => typeof item === 'string')
        : [];
}
