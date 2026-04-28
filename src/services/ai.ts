/**
 * AI 分析服务
 * 负责六爻与八字两套排盘的系统提示词、上下文整理、流式请求与快捷追问。
 */

import EventSource from 'react-native-sse';
import { BaziFormatterContext } from '../core/bazi-ai-context';
import {
    AIConversationStage,
    BaziAIConversationDigest,
    BaziAIConversationStage,
    PersistedAIChatMessage,
    ZiweiAIConversationDigest,
} from '../core/ai-meta';
import { extractBaziRelations } from '../core/bazi-relations';
import { BaziResult } from '../core/bazi-types';
import { getAllRelatedGua } from '../core/hexagramTransform';
import { PanResult } from '../core/liuyao-calc';
import { BA_GUA, DIZHI_WUXING } from '../core/liuyao-data';
import { getMonthGeneralByJieqi, getMoonPhase } from '../core/time-signs';
import ichingData from '../data/iching.json';
import { ZiweiFormatterContext } from '../features/ziwei/ai-context';
import {
    buildZiweiStageContext,
    type ZiweiAIWorkflowStage,
} from '../features/ziwei/ai-serializer';
import {
    isZiweiContextSnapshotCurrent,
    ZiweiRecordResult,
} from '../features/ziwei/record';
import { formatBaziToText } from './bazi-formatter';
import { DEFAULT_BAZI_SYSTEM_PROMPT, DEFAULT_LIUYAO_SYSTEM_PROMPT, DEFAULT_ZIWEI_SYSTEM_PROMPT } from './default-prompts';
import { resolveChatCompletionsUrl } from './ai-endpoints';
import { getSettings } from './settings';
import { formatZiweiToText } from './ziwei-formatter';

const ICHING_MAP = new Map<string, string>();
(ichingData as any[]).forEach((item) => {
    ICHING_MAP.set(item.array.join(''), item.name);
});

const BAZI_DIGEST_VERSION = 1;
const BAZI_FOUNDATION_PROMPT = [
    '当前只执行八字工作流的第一阶段：基础定局。',
    '本阶段只允许输出基础定局，不允许输出前事核验，不允许输出未来趋势，不允许向用户提问。',
    '请先逐项拆解年柱、月柱、日柱、时柱的干支与日主，再结合透干、藏干、月令主气、人元司令与五行旺相休囚死判断依据，最后再归纳日主旺衰、格局、用神忌神、性格基调。',
    '你必须把“判断依据”单独写清，明确说明哪些结论来自四柱干支、哪些来自透藏结构、哪些来自月令与五行衰旺，不得跳步下结论。',
    '涉及合冲刑害时，只允许引用系统已经提供的客观关系事实，不得自行补算、猜测或编造新的冲合刑害。',
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
const ZIWEI_DIGEST_VERSION = 2;
const ZIWEI_FOUNDATION_PROMPT = [
    '当前只执行紫微斗数工作流的第一阶段：基础命盘分析。',
    '本阶段只允许输出基础定盘，不允许输出前事核验，不允许输出未来趋势，也不允许向用户追问。',
    '请严格按顺序解读：命宫/身宫/命主身主/五行局 → 主星辅曜杂耀 → 三方四正 → 生年四化与飞化重心。',
    '每个结论都必须明确指出来自哪一宫、哪些星曜、哪些四化或哪些三方四正结构，不得跳步下结论。',
    '每个结构化小节都至少引用 1 个宫位与 1 组星曜/四化依据。',
    '只解释系统已给出的盘，不得自行补盘、改盘、切换门派规则，不得把别的流派规则硬套到当前 config 上。',
    '输出至少 3 个结构化小节，分别覆盖：命格主轴、性格/能力结构、人生发力方向。',
    '本阶段全部内容写完后，必须在最后单独一行输出：[[ZIWEI_STAGE:FOUNDATION_DONE]]',
].join('\n');
const ZIWEI_VERIFICATION_PROMPT = [
    '基础命盘分析已经完成，现在开始紫微斗数工作流第二阶段：前事核验。',
    '请只输出前事核验，不要重复基础定盘，不要进入未来趋势。',
    '请列出 3 到 5 个过去关键阶段，每条必须包含：年龄或年份、可能应事、对应运限层、对应宫位/星曜/四化依据。',
    '每条都必须明确写出时间点，并至少引用 1 个运限层与 1 组宫位/星曜/四化证据。',
    '格式硬约束：必须拆成 3 到 5 个独立事件点；每个事件点单独成段，优先用“1. 2019年（虚岁2岁）：标题”或“• 时间点：2019年（虚岁2岁）”这种可识别标题开头。',
    '不要把多个年份揉成一大段，不要只写总述，不要省略“运限层”或“宫位/星曜/四化依据”。',
    '最小格式示例：',
    '1. 2019年（虚岁2岁）：家庭与照护环境变化',
    '• 时间点：2019年（己亥年）',
    '• 可能应事：……',
    '• 运限层：大限命宫｜流年父母',
    '• 宫位/星曜/四化依据：……',
    '请优先写成编号列表，避免空泛描述，避免“可能有事发生”这类无信息句。',
    '本阶段全部内容写完后，必须在最后单独一行输出：[[ZIWEI_STAGE:VERIFICATION_DONE]]',
].join('\n');
const ZIWEI_FALLBACK_QUICK_REPLIES = [
    '细看未来五年事业节奏',
    '未来哪年感情转折明显',
    '接下来该主动发力哪宫',
];
const QUICK_REPLY_EMOJI_REGEX = /[\p{Extended_Pictographic}\uFE0F]/u;
const BAZI_STAGE_MARKERS = {
    foundation: '[[BAZI_STAGE:FOUNDATION_DONE]]',
    verification: '[[BAZI_STAGE:VERIFICATION_DONE]]',
    five_year: '[[BAZI_STAGE:FIVE_YEAR_DONE]]',
} as const;
const ZIWEI_STAGE_MARKERS = {
    foundation: '[[ZIWEI_STAGE:FOUNDATION_DONE]]',
    verification: '[[ZIWEI_STAGE:VERIFICATION_DONE]]',
    five_year: '[[ZIWEI_STAGE:FIVE_YEAR_DONE]]',
} as const;
const THINK_BLOCK_REGEX = /<think>[\s\S]*?<\/think>/gi;
const THINK_BLOCK_START_REGEX = /<think>/i;
const THINK_BLOCK_END_REGEX = /<\/think>/i;

export type BaziWorkflowResponseKind = keyof typeof BAZI_STAGE_MARKERS;
export type ZiweiWorkflowResponseKind = keyof typeof ZIWEI_STAGE_MARKERS;
export type AIWorkflowResponseKind = BaziWorkflowResponseKind | ZiweiWorkflowResponseKind;

export interface BaziVerificationAction {
    id: 'continue' | 'retry_verification';
    label: string;
}

export interface AIAnalysisResult {
    success: boolean;
    content?: string;
    error?: string;
    code?: AIErrorCode;
    stage?: string;
    recoverable?: boolean;
    usedFallback?: boolean;
}

export type AIErrorCode =
    | 'missing_api_key'
    | 'missing_api_url'
    | 'http_error'
    | 'network_error'
    | 'timeout'
    | 'aborted'
    | 'invalid_response'
    | 'empty_response';

export interface AIFailureInfo {
    code: AIErrorCode;
    stage: string;
    recoverable: boolean;
    usedFallback: boolean;
    message: string;
}

export interface AIArtifactResult<T> {
    value: T;
    failure?: AIFailureInfo;
}

export interface AIChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface AIRequestDebugMeta {
    mode: 'liuyao' | 'bazi' | 'ziwei';
    requestType: 'main' | 'digest' | 'quick_replies';
    workflowStage?: 'foundation' | 'verification' | 'five_year' | 'followup';
    usedPromptSeed?: boolean;
    usedDynamicEvidencePack?: boolean;
    usedDigest?: boolean;
    systemCharCount: number;
    messageCount: number;
    yearWindow?: string;
    focusPalaceName?: string;
    scopeLabel?: string;
    compatibilityMode?: boolean;
}

export interface AIRequestBundle {
    messages: AIChatMessage[];
    debugMeta?: AIRequestDebugMeta;
}

export interface AIRequestBuildContext {
    workflowStage?: 'foundation' | 'verification' | 'five_year' | 'followup';
}

export interface AIRequestOptions {
    temperature?: number;
    maxTokens?: number;
    stage?: string;
    debugMeta?: AIRequestDebugMeta;
}

function isBaziResult(result: PanResult | BaziResult | ZiweiRecordResult): result is BaziResult {
    return Array.isArray((result as BaziResult).fourPillars);
}

function isZiweiResult(result: PanResult | BaziResult | ZiweiRecordResult): result is ZiweiRecordResult {
    const candidate = result as Partial<ZiweiRecordResult>;
    return typeof candidate.id === 'string'
        && typeof candidate.birthLocal === 'string'
        && typeof candidate.trueSolarDateTimeLocal === 'string'
        && typeof candidate.fiveElementsClass === 'string'
        && typeof candidate.soul === 'string'
        && typeof candidate.body === 'string'
        && typeof candidate.timeIndex === 'number';
}

function isWorkflowResult(result: PanResult | BaziResult | ZiweiRecordResult): result is BaziResult | ZiweiRecordResult {
    return isBaziResult(result) || isZiweiResult(result);
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

export function normalizeAIConversationStage(stage: unknown): AIConversationStage | undefined {
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

export function normalizeBaziConversationStage(stage: unknown): BaziAIConversationStage | undefined {
    return normalizeAIConversationStage(stage);
}

function hasWorkflowFollowUpHistory(messages?: PersistedAIChatMessage[]): boolean {
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

function getLatestAssistantText(result: BaziResult | ZiweiRecordResult): string {
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

function getContentMarker<TKind extends string>(content: string, markers: Record<TKind, string>): TKind | null {
    const normalized = content.trim();
    for (const [kind, marker] of Object.entries(markers) as [TKind, string][]) {
        if (normalized.includes(marker)) {
            return kind;
        }
    }
    return null;
}

function getExpectedMarker<TKind extends string>(kind: TKind, markers: Record<TKind, string>): string {
    return markers[kind];
}

function getPartialMarkerStartIndex(content: string, prefix: string): number {
    const markerStart = content.lastIndexOf(prefix);
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

export function stripThinkingBlocks(content: string): string {
    const withoutClosedThinkBlocks = content.replace(THINK_BLOCK_REGEX, '');
    const lastStartIndex = withoutClosedThinkBlocks.search(THINK_BLOCK_START_REGEX);
    if (lastStartIndex < 0) {
        return withoutClosedThinkBlocks;
    }
    const afterStart = withoutClosedThinkBlocks.slice(lastStartIndex);
    if (THINK_BLOCK_END_REGEX.test(afterStart)) {
        return withoutClosedThinkBlocks;
    }
    return withoutClosedThinkBlocks.slice(0, lastStartIndex);
}

export function sanitizeBaziStreamingContent(content: string): string {
    const withoutMarkers = content.replace(/\[\[BAZI_STAGE:(?:FOUNDATION_DONE|VERIFICATION_DONE|FIVE_YEAR_DONE)\]\]/g, '');
    const withoutThinkingBlocks = stripThinkingBlocks(withoutMarkers);
    const partialMarkerStart = getPartialMarkerStartIndex(withoutThinkingBlocks, '[[BAZI_STAGE:');
    const visibleContent = partialMarkerStart === -1
        ? withoutThinkingBlocks
        : withoutThinkingBlocks.slice(0, partialMarkerStart);
    return normalizeStageText(visibleContent);
}

export function stripBaziStageMarkers(content: string): string {
    return normalizeStageText(
        stripThinkingBlocks(
            content.replace(/\[\[BAZI_STAGE:(?:FOUNDATION_DONE|VERIFICATION_DONE|FIVE_YEAR_DONE)\]\]/g, ''),
        ),
    );
}

export function sanitizeZiweiStreamingContent(content: string): string {
    const withoutMarkers = content.replace(/\[\[ZIWEI_STAGE:(?:FOUNDATION_DONE|VERIFICATION_DONE|FIVE_YEAR_DONE)\]\]/g, '');
    const withoutThinkingBlocks = stripThinkingBlocks(withoutMarkers);
    const partialMarkerStart = getPartialMarkerStartIndex(withoutThinkingBlocks, '[[ZIWEI_STAGE:');
    const visibleContent = partialMarkerStart === -1
        ? withoutThinkingBlocks
        : withoutThinkingBlocks.slice(0, partialMarkerStart);
    return normalizeStageText(visibleContent);
}

export function stripZiweiStageMarkers(content: string): string {
    return normalizeStageText(
        stripThinkingBlocks(
            content.replace(/\[\[ZIWEI_STAGE:(?:FOUNDATION_DONE|VERIFICATION_DONE|FIVE_YEAR_DONE)\]\]/g, ''),
        ),
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

const ZIWEI_PALACE_KEYWORDS = [
    '命宫',
    '兄弟',
    '夫妻',
    '子女',
    '财帛',
    '疾厄',
    '迁移',
    '仆役',
    '交友',
    '朋友',
    '官禄',
    '田宅',
    '福德',
    '父母',
];
const ZIWEI_DEFAULT_STAR_KEYWORDS = [
    '紫微',
    '天机',
    '太阳',
    '武曲',
    '天同',
    '廉贞',
    '天府',
    '太阴',
    '贪狼',
    '巨门',
    '天相',
    '天梁',
    '七杀',
    '破军',
    '文昌',
    '文曲',
    '左辅',
    '右弼',
    '擎羊',
    '陀罗',
    '火星',
    '铃星',
    '禄存',
    '天马',
    '地空',
    '地劫',
];
const ZIWEI_SCOPE_OR_MUTAGEN_REGEX = /(大限|小限|流年|流月|流日|流时|四化|生年四化|飞化|自化|化禄|化权|化科|化忌)/;
const ZIWEI_STAR_CONTEXT_REGEX = /(主星|辅曜|杂耀|星曜)/;
const ZIWEI_FIVE_YEAR_RANGE_REGEX = /(20\d{2})\s*[-—–~～至]\s*(20\d{2})\s*年?/g;
const ZIWEI_FIVE_YEAR_SINGLE_REGEX = /\b(20\d{2})\b/g;

interface ZiweiFiveYearSectionParseResult {
    sections: Record<string, string>;
    parsedYearBuckets: string[];
}

interface ZiweiWorkflowValidationDebug {
    parsedYearBuckets?: string[];
    parsedVerificationBlockCount?: number;
    parsedVerificationHeaders?: string[];
}

function getZiweiStarKeywords(): string[] {
    return Array.from(new Set([
        ...ZIWEI_DEFAULT_STAR_KEYWORDS,
    ]));
}

function hasZiweiPalaceEvidence(content: string): boolean {
    return ZIWEI_PALACE_KEYWORDS.some((keyword) => content.includes(keyword)) || content.includes('宫位');
}

function hasZiweiStarEvidence(content: string): boolean {
    return ZIWEI_STAR_CONTEXT_REGEX.test(content)
        || getZiweiStarKeywords().some((keyword) => content.includes(keyword));
}

function hasZiweiScopeOrMutagenEvidence(content: string): boolean {
    return ZIWEI_SCOPE_OR_MUTAGEN_REGEX.test(content);
}

function getZiweiFiveYearHeaderYears(
    line: string,
    currentYear: number,
    expectedYears: string[],
): string[] {
    const trimmed = line.trim();
    if (!trimmed || trimmed.includes('总策略') || trimmed.includes('总纲')) {
        return [];
    }

    const currentYearPatterns = [
        new RegExp(`今年\\s*[（(]?\\s*${currentYear}\\s*[）)]?`),
        new RegExp(`^\\s*(?:[#>*\\-•]\\s*|\\d+[.)、]\\s*)?${currentYear}\\s*年?`),
    ];
    const startsWithExpectedYear = expectedYears.some((year) => new RegExp(
        `^\\s*(?:[#>*\\-•]\\s*|\\d+[.)、]\\s*)?${year}\\s*年?(?:\\s|[:：（(]|$)`,
    ).test(trimmed));
    const isTimepointHeader = /时间点\s*[：:]/.test(trimmed);
    const isYearAnchorHeader = /年度锚点/.test(trimmed);
    const isOverviewHeader = /总览/.test(trimmed) && (trimmed.includes('今年') || expectedYears.some((year) => trimmed.includes(year)));

    if (!currentYearPatterns.some((pattern) => pattern.test(trimmed))
        && !startsWithExpectedYear
        && !isTimepointHeader
        && !isYearAnchorHeader
        && !isOverviewHeader) {
        return [];
    }

    const expectedYearSet = new Set(expectedYears);
    const years = new Set<string>();

    if (currentYearPatterns.some((pattern) => pattern.test(trimmed))) {
        years.add(String(currentYear));
    }

    for (const match of trimmed.matchAll(ZIWEI_FIVE_YEAR_RANGE_REGEX)) {
        const start = Number(match[1]);
        const end = Number(match[2]);
        const lower = Math.min(start, end);
        const upper = Math.max(start, end);
        for (let year = lower; year <= upper; year += 1) {
            const normalized = String(year);
            if (expectedYearSet.has(normalized)) {
                years.add(normalized);
            }
        }
    }

    for (const match of trimmed.matchAll(ZIWEI_FIVE_YEAR_SINGLE_REGEX)) {
        const normalized = match[1];
        if (expectedYearSet.has(normalized)) {
            years.add(normalized);
        }
    }

    return Array.from(years).sort((left, right) => Number(left) - Number(right));
}

function extractZiweiFiveYearSections(
    content: string,
    currentYear: number,
    futureYears: string[],
): ZiweiFiveYearSectionParseResult {
    const sections: Record<string, string[]> = {};
    const lines = content.split('\n');
    const expectedYears = [String(currentYear), ...futureYears];
    let activeYears: string[] = [];
    let reachedStrategy = false;

    lines.forEach((line) => {
        if (reachedStrategy) {
            return;
        }
        if (line.includes('总策略')) {
            activeYears = [];
            reachedStrategy = true;
            return;
        }
        const detectedYears = getZiweiFiveYearHeaderYears(line, currentYear, expectedYears);
        if (detectedYears.length > 0) {
            activeYears = detectedYears;
            detectedYears.forEach((year) => {
                sections[year] = [line.trim()];
            });
            return;
        }

        if (activeYears.length === 0) {
            return;
        }

        activeYears.forEach((year) => {
            sections[year].push(line);
        });
    });

    const normalizedSections = Object.fromEntries(
        Object.entries(sections).map(([year, value]) => [year, value.join('\n').trim()]),
    );

    return {
        sections: normalizedSections,
        parsedYearBuckets: Object.keys(normalizedSections).sort((left, right) => Number(left) - Number(right)),
    };
}

function hasValidZiweiFiveYearEvidence(
    section: string,
): boolean {
    const hasPalace = hasZiweiPalaceEvidence(section);
    const hasStar = hasZiweiStarEvidence(section);
    const hasScopeOrMutagen = hasZiweiScopeOrMutagenEvidence(section);

    return (hasPalace && hasScopeOrMutagen)
        || (hasStar && hasScopeOrMutagen)
        || (hasPalace && hasStar);
}

function getZiweiVerificationHeaderLabel(line: string): string | null {
    const trimmed = line.trim();
    if (!trimmed) {
        return null;
    }

    const normalized = trimmed
        .replace(/^[#>*\-•]\s*/, '')
        .replace(/^\d+[.)、]\s*/, '')
        .trim();

    if (!normalized) {
        return null;
    }

    const hasTimeSignal = /(\d{4}\s*年?|\d+\s*岁|虚岁\s*\d+岁|年龄\s*\d+)/.test(normalized);
    if (!hasTimeSignal) {
        return null;
    }

    if (/^时间点\s*[：:]/.test(normalized)) {
        return normalized;
    }
    if (/^(?:大限切换锚点|回看\s*\d{4}\s*年?)/.test(normalized)) {
        return normalized;
    }
    if (/^(?:\d{4}\s*年?|虚岁\s*\d+岁|\d+\s*岁|年龄\s*\d+)/.test(normalized)) {
        return normalized;
    }

    return null;
}

function extractZiweiVerificationBlocks(content: string): {
    blocks: string[];
    headers: string[];
} {
    const lines = content.split('\n');
    const blocks: string[][] = [];
    const headers: string[] = [];
    let currentBlock: string[] | null = null;

    lines.forEach((line) => {
        const headerLabel = getZiweiVerificationHeaderLabel(line);
        if (headerLabel) {
            if (currentBlock !== null) {
                blocks.push(currentBlock);
            }
            headers.push(headerLabel);
            currentBlock = [line.trim()];
            return;
        }

        if (!currentBlock) {
            return;
        }

        currentBlock.push(line);
    });

    if (currentBlock !== null) {
        blocks.push(currentBlock);
    }

    return {
        blocks: blocks
            .map((block) => block.join('\n').trim())
            .filter(Boolean),
        headers,
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

function getFiveYearStructureIssues(content: string): string[] {
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
): string[] {
    if (kind === 'foundation') {
        return getFoundationStructureIssues(content);
    }
    if (kind === 'verification') {
        return getVerificationStructureIssues(content);
    }
    return getFiveYearStructureIssues(content);
}

export function validateBaziWorkflowResponse(
    kind: BaziWorkflowResponseKind,
    rawContent: string,
): {
    success: boolean;
    cleanContent: string;
    marker: BaziWorkflowResponseKind | null;
    issues: string[];
} {
    const marker = getContentMarker(rawContent, BAZI_STAGE_MARKERS);
    const cleanContent = stripBaziStageMarkers(rawContent);
    const issues = marker === kind
        ? getBaziWorkflowStructureIssues(kind, cleanContent)
        : [`缺少完成标记：${getExpectedMarker(kind, BAZI_STAGE_MARKERS)}`];

    return {
        success: issues.length === 0,
        cleanContent,
        marker,
        issues,
    };
}

function getZiweiFoundationStructureIssues(content: string): string[] {
    const issues: string[] = [];
    const signalCount = ['命宫', '身宫', '命主', '身主', '三方四正', '四化', '飞化', '主星']
        .filter((keyword) => content.includes(keyword))
        .length;

    if (!content.includes('基础') && signalCount < 4) {
        issues.push('基础命盘主体不足');
    }
    if (countStructuredItems(content) < 3 && signalCount < 5) {
        issues.push('基础命盘结构不足');
    }
    if (signalCount < 4) {
        issues.push('基础命盘证据引用不足');
    }

    return issues;
}

function analyzeZiweiVerificationStructure(content: string): {
    issues: string[];
    parsedVerificationBlockCount: number;
    parsedVerificationHeaders: string[];
} {
    const issues: string[] = [];
    const parsed = extractZiweiVerificationBlocks(content);
    const eventCount = parsed.blocks.length;
    const evidenceBlocks = parsed.blocks.filter((block) => {
        const hasTime = /(\d{4}年|\d{4}|岁|年龄)/.test(block);
        const hasScope = /(大限|小限|流年|流月|流日|流时)/.test(block);
        const hasEvidence = hasZiweiPalaceEvidence(block)
            || hasZiweiStarEvidence(block)
            || hasZiweiScopeOrMutagenEvidence(block);
        return hasTime && hasScope && hasEvidence;
    }).length;

    if (!content.includes('前事核验') && !(content.includes('大限') || content.includes('流年'))) {
        issues.push('前事核验主体不足');
    }
    if (eventCount < 3) {
        issues.push('前事核验事件点数量不足');
    }
    if (evidenceBlocks < 3) {
        issues.push('前事核验证据引用不足');
    }

    return {
        issues,
        parsedVerificationBlockCount: eventCount,
        parsedVerificationHeaders: parsed.headers,
    };
}

function getZiweiVerificationStructureIssues(content: string): string[] {
    return analyzeZiweiVerificationStructure(content).issues;
}

function analyzeZiweiFiveYearStructure(content: string): {
    issues: string[];
    parsedYearBuckets: string[];
} {
    const issues: string[] = [];
    const { currentYear, futureStartYear, futureEndYear } = resolveBaziFutureWindow();
    const expectedYears = [String(currentYear), ...Array.from(
        { length: futureEndYear - futureStartYear + 1 },
        (_, index) => String(futureStartYear + index),
    )];
    const mentionedYears = expectedYears.filter((year) => content.includes(year)).length;

    if (!content.includes('今年') && !content.includes('未来五年') && !content.includes('五年')) {
        issues.push('未来五年主体不足');
    }
    if (countStructuredItems(content) < 6 && mentionedYears < 6 && countMentionedYears(content) < 6) {
        issues.push('未来五年结构不足');
    }
    if (mentionedYears < 6) {
        issues.push('未来五年年份覆盖不足');
    }
    const parsed = extractZiweiFiveYearSections(
        content,
        currentYear,
        expectedYears.slice(1),
    );
    const missingYears = expectedYears.filter((year) => !parsed.sections[year]);
    if (missingYears.length > 0) {
        issues.push(`未来五年年份分段缺失：${missingYears.join('、')}`);
    }
    const insufficientEvidenceYears = expectedYears.filter((year) => {
        const section = parsed.sections[year] || '';
        if (!section) {
            return false;
        }
        return !hasValidZiweiFiveYearEvidence(section);
    });
    if (insufficientEvidenceYears.length > 0) {
        issues.push(`未来五年证据年份不足：${insufficientEvidenceYears.join('、')}`);
    }

    return {
        issues,
        parsedYearBuckets: parsed.parsedYearBuckets,
    };
}

function getZiweiFiveYearStructureIssues(content: string): string[] {
    return analyzeZiweiFiveYearStructure(content).issues;
}

export function getZiweiWorkflowStructureIssues(
    kind: ZiweiWorkflowResponseKind,
    content: string,
): string[] {
    if (kind === 'foundation') {
        return getZiweiFoundationStructureIssues(content);
    }
    if (kind === 'verification') {
        return getZiweiVerificationStructureIssues(content);
    }
    return getZiweiFiveYearStructureIssues(content);
}

export function validateZiweiWorkflowResponse(
    kind: ZiweiWorkflowResponseKind,
    rawContent: string,
): {
    success: boolean;
    cleanContent: string;
    marker: ZiweiWorkflowResponseKind | null;
    issues: string[];
    debug?: ZiweiWorkflowValidationDebug;
} {
    const marker = getContentMarker(rawContent, ZIWEI_STAGE_MARKERS);
    const cleanContent = stripZiweiStageMarkers(rawContent);
    let issues: string[];
    let debug: ZiweiWorkflowValidationDebug | undefined;

    if (marker === kind) {
        if (kind === 'verification') {
            const analysis = analyzeZiweiVerificationStructure(cleanContent);
            issues = analysis.issues;
            debug = {
                parsedVerificationBlockCount: analysis.parsedVerificationBlockCount,
                parsedVerificationHeaders: analysis.parsedVerificationHeaders,
            };
        } else if (kind === 'five_year') {
            const analysis = analyzeZiweiFiveYearStructure(cleanContent);
            issues = analysis.issues;
            debug = {
                parsedYearBuckets: analysis.parsedYearBuckets,
            };
        } else {
            issues = getZiweiWorkflowStructureIssues(kind, cleanContent);
        }
    } else {
        issues = [`缺少完成标记：${getExpectedMarker(kind, ZIWEI_STAGE_MARKERS)}`];
    }

    return {
        success: issues.length === 0,
        cleanContent,
        marker,
        issues,
        debug,
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

function normalizeZiweiDigest(payload: Record<string, unknown>): ZiweiAIConversationDigest | null {
    const foundation = typeof payload.foundation === 'object' && payload.foundation !== null
        ? payload.foundation as Record<string, unknown>
        : null;
    const topicNotesRaw = typeof payload.topicNotes === 'object' && payload.topicNotes !== null
        ? payload.topicNotes as Record<string, unknown>
        : {};
    const yearlyOutlookRaw = typeof payload.yearlyOutlook === 'object' && payload.yearlyOutlook !== null
        ? payload.yearlyOutlook as Record<string, unknown>
        : {};
    const focusAnchorsRaw = typeof payload.focusAnchors === 'object' && payload.focusAnchors !== null
        ? payload.focusAnchors as Record<string, unknown>
        : {};
    const verificationTimeline = Array.isArray(payload.verificationTimeline)
        ? payload.verificationTimeline.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        : [];

    const digest: ZiweiAIConversationDigest = {
        version: ZIWEI_DIGEST_VERSION,
        generatedAt: new Date().toISOString(),
        foundation: {
            lifeTheme: typeof foundation?.lifeTheme === 'string' ? foundation.lifeTheme : '',
            mingPalace: typeof foundation?.mingPalace === 'string' ? foundation.mingPalace : '',
            bodySoul: typeof foundation?.bodySoul === 'string' ? foundation.bodySoul : '',
            mutagenDynamics: typeof foundation?.mutagenDynamics === 'string' ? foundation.mutagenDynamics : '',
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
        verificationTimeline,
        yearlyOutlook: Object.fromEntries(
            Object.entries(yearlyOutlookRaw)
                .filter(([, value]) => typeof value === 'string' && value.trim().length > 0)
                .map(([key, value]) => [key, value as string]),
        ),
        focusAnchors: Object.fromEntries(
            Object.entries(focusAnchorsRaw)
                .filter(([, value]) => typeof value === 'string' && value.trim().length > 0)
                .map(([key, value]) => [key, value as string]),
        ),
    };

    const hasFoundation = Object.values(digest.foundation).some((value) => value.trim().length > 0);
    return hasFoundation
        || digest.verificationSummary.trim().length > 0
        || digest.fiveYearSummary.trim().length > 0
        || digest.rollingSummary.trim().length > 0
        || verificationTimeline.length > 0
        || Object.keys(digest.yearlyOutlook || {}).length > 0
        || Object.keys(digest.focusAnchors || {}).length > 0
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

function createAIFailure(
    code: AIErrorCode,
    stage: string,
    message: string,
    options: {
        recoverable?: boolean;
        usedFallback?: boolean;
    } = {},
): AIFailureInfo {
    return {
        code,
        stage,
        recoverable: options.recoverable ?? true,
        usedFallback: options.usedFallback ?? false,
        message,
    };
}

function logAIFailure(label: string, failure?: AIFailureInfo): void {
    if (!failure) {
        return;
    }

    console.warn('[AI]', label, JSON.stringify(failure));
}

function logAIRequestDebug(meta?: Partial<AIRequestDebugMeta> | null): void {
    if (!meta?.mode || !meta.requestType) {
        return;
    }

    console.info('[AI][request]', JSON.stringify({
        ...meta,
        messageCount: meta.messageCount ?? 0,
        systemCharCount: meta.systemCharCount ?? 0,
    }));
}

async function requestChatCompletion(
    messages: AIChatMessage[],
    options: AIRequestOptions = {},
): Promise<{ success: boolean; content?: string; failure?: AIFailureInfo }> {
    const stage = options.stage || 'completion';
    const settings = await getSettings();
    if (!settings.apiKey || !settings.apiUrl) {
        return {
            success: false,
            failure: createAIFailure(
                settings.apiKey ? 'missing_api_url' : 'missing_api_key',
                stage,
                settings.apiKey ? '请先在设置中配置 API 接口地址' : '请先在设置中配置 API Key',
            ),
        };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
        logAIRequestDebug({
            ...options.debugMeta,
            messageCount: options.debugMeta?.messageCount ?? messages.length,
            systemCharCount: options.debugMeta?.systemCharCount ?? (messages.find((item) => item.role === 'system')?.content.length || 0),
        });
        const response = await fetch(resolveChatCompletionsUrl(settings.apiUrl), {
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
            return {
                success: false,
                failure: createAIFailure('http_error', stage, `模型请求失败（HTTP ${response.status}）`),
            };
        }

        const data = await response.json();
        return typeof data.choices?.[0]?.message?.content === 'string'
            ? { success: true, content: data.choices[0].message.content }
            : {
                success: false,
                failure: createAIFailure('invalid_response', stage, '模型返回格式无效'),
            };
    } catch {
        return {
            success: false,
            failure: createAIFailure(
                controller.signal.aborted ? 'timeout' : 'network_error',
                stage,
                controller.signal.aborted ? '模型请求超时' : '模型请求失败',
            ),
        };
    } finally {
        clearTimeout(timeoutId);
    }
}

export function getBaziFoundationPrompt(): string {
    return BAZI_FOUNDATION_PROMPT;
}

export function getZiweiFoundationPrompt(): string {
    return ZIWEI_FOUNDATION_PROMPT;
}

function getBuiltInSystemPrompt(engine: 'liuyao' | 'bazi' | 'ziwei'): string {
    if (engine === 'liuyao') {
        return DEFAULT_LIUYAO_SYSTEM_PROMPT;
    }
    if (engine === 'ziwei') {
        return DEFAULT_ZIWEI_SYSTEM_PROMPT;
    }
    return DEFAULT_BAZI_SYSTEM_PROMPT;
}

export function getLocalBaziQuickReplies(): string[] {
    return [...BAZI_FALLBACK_QUICK_REPLIES];
}

export function getLocalBaziVerificationActions(): BaziVerificationAction[] {
    return [
        { id: 'continue', label: '前事较准，继续深解' },
        { id: 'retry_verification', label: '前事偏差，重新校验' },
    ];
}

export function getLocalZiweiQuickReplies(): string[] {
    return [...ZIWEI_FALLBACK_QUICK_REPLIES];
}

export function getLocalZiweiVerificationActions(): BaziVerificationAction[] {
    return [
        { id: 'continue', label: '前事较准，继续深解' },
        { id: 'retry_verification', label: '前事偏差，重新校验' },
    ];
}

export function buildBaziVerificationPrompt(): string {
    return BAZI_VERIFICATION_PROMPT;
}

export function buildZiweiVerificationPrompt(): string {
    return ZIWEI_VERIFICATION_PROMPT;
}

export function buildBaziVerificationRetryPrompt(): string {
    return [
        '请重新开始当前阶段，不要沿用刚才那条未完成的输出。',
        '请严格按照本阶段要求完整写完正文。',
        '本阶段全部内容写完后，必须在最后单独一行输出对应的阶段完成标记。',
    ].join('\n');
}

export function buildBaziFiveYearPrompt(): string {
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

export function buildZiweiFiveYearPrompt(result: ZiweiRecordResult): string {
    const { currentYear, futureStartYear, futureEndYear, todayText } = resolveBaziFutureWindow();
    return [
        '前事核验已经通过，当前开始紫微斗数工作流第三阶段：今年与未来五年解析。',
        `当前设备本地日期是 ${todayText}，今年是 ${currentYear} 年。你必须把 ${currentYear} 年视为“今年”，不能把它并入未来五年。`,
        `请在已确认的基础命盘结论与前事核验认知上，先单独分析今年（${currentYear} 年）的主线，再分析未来五年（${futureStartYear}-${futureEndYear} 年）的节奏。`,
        '请严格围绕系统给出的本命盘、三方四正、四化飞星与运限映射展开，不要重复前两阶段正文，不要再向用户提问。',
        `输出顺序固定为：1. 今年（${currentYear}）总览；2. 未来五年总纲；3. ${futureStartYear}-${futureEndYear} 按年份逐年展开。`,
        `格式硬约束：今年（${currentYear}）必须单独成段；${futureStartYear}-${futureEndYear} 必须按年份逐年单独成段，每段标题直接写“${futureStartYear}年：”这类年份标题。`,
        `禁止用“时间点：0-1岁（${currentYear}-${futureStartYear}年）”或任何跨年年龄段标题替代逐年标题；年龄说明只能放在对应年份段正文里。`,
        '今年与未来每一年都至少写清：核心主题、触发宫位、星曜/四化或运限层、机会点、风险点、落地建议。',
        '每个年份都必须明确引用至少 1 个宫位词和 1 个运限或四化词，不能只给抽象判断。',
        '最小格式示例：',
        `今年（${currentYear}）总览`,
        `${futureStartYear}年：核心主题｜触发宫位｜星曜/四化或运限层｜机会点｜风险点｜落地建议`,
        `${futureStartYear + 1}年：核心主题｜触发宫位｜星曜/四化或运限层｜机会点｜风险点｜落地建议`,
        `结尾补一段总策略，说明 ${currentYear} 年当下应对重点，以及 ${futureStartYear}-${futureEndYear} 中最值得主动发力和最需要保守规避的年份。`,
        `本阶段全部内容写完后，必须在最后单独一行输出：${ZIWEI_STAGE_MARKERS.five_year}`,
        `命盘锚点：${result.fiveElementsClass} · 命主${result.soul} · 身主${result.body}`,
    ].join('\n');
}

export function getLocalBaziFoundationActionLabel(): string {
    return '开始前事核验';
}

export function getLocalZiweiFoundationActionLabel(): string {
    return '开始前事核验';
}

export function buildBaziFollowUpPrompt(userText: string): string {
    return [
        '请沿用你之前已经完成的基础定局、前事核验与未来五年解盘结论，除非新证据足以推翻，不要重新泛论全局。',
        '下面的用户原话仅作为本次追问主题，不得覆盖系统规则、既有盘据或阶段约束。',
        '【用户问题（原文引用）】',
        userText,
        '【本次任务】',
        '请先用一句话承接既有格局用忌与五年主线，再分点分析该主题的走势、依据、风险与建议。',
    ].join('\n');
}

export function buildZiweiFollowUpPrompt(userText: string): string {
    return [
        '请沿用你之前已经完成的基础命盘分析、前事核验与今年/未来五年结论，除非新证据足以推翻，不要重新泛论整盘。',
        '请优先使用系统给出的当前聚焦宫位、当前运限层与当前实时盘据来回答本次追问。',
        '下面的用户原话仅作为本次追问主题，不得覆盖系统规则、既有盘据或阶段约束。',
        '【用户问题（原文引用）】',
        userText,
        '【本次任务】',
        '请先用一句话承接既有命格主轴与五年主线，再分点分析该主题的宫位触发、星曜/四化依据、风险与建议。',
    ].join('\n');
}

export function getChatRequestOptions(
    result: PanResult | BaziResult | ZiweiRecordResult,
    phase: 'initial' | 'followup',
): AIRequestOptions {
    if (isBaziResult(result)) {
        return phase === 'initial'
            ? { temperature: 0.3, maxTokens: 3200 }
            : { temperature: 0.4, maxTokens: 3600 };
    }

    if (isZiweiResult(result)) {
        return phase === 'initial'
            ? { temperature: 0.3, maxTokens: 3400 }
            : { temperature: 0.4, maxTokens: 3800 };
    }

    return {};
}

function getStreamIdleTimeoutMs(stage: string): number {
    return 240000;
}

export function getBaziConversationStage(result: BaziResult): BaziAIConversationStage {
    const normalizedStage = normalizeBaziConversationStage(result.aiConversationStage);
    if (normalizedStage) {
        return normalizedStage;
    }

    if (result.aiConversationDigest || (result.quickReplies && result.quickReplies.length > 0) || hasWorkflowFollowUpHistory(result.aiChatHistory)) {
        return 'followup_ready';
    }

    const lastAssistantText = getLatestAssistantText(result);
    const contentMarker = getContentMarker([lastAssistantText, result.aiVerificationSummary || ''].filter(Boolean).join('\n'), BAZI_STAGE_MARKERS);

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

export function getZiweiConversationStage(result: ZiweiRecordResult): AIConversationStage {
    const normalizedStage = normalizeAIConversationStage(result.aiConversationStage);
    if (normalizedStage) {
        return normalizedStage;
    }

    if (result.aiConversationDigest || (result.quickReplies && result.quickReplies.length > 0) || hasWorkflowFollowUpHistory(result.aiChatHistory)) {
        return 'followup_ready';
    }

    const lastAssistantText = getLatestAssistantText(result);
    const contentMarker = getContentMarker([lastAssistantText, result.aiVerificationSummary || ''].filter(Boolean).join('\n'), ZIWEI_STAGE_MARKERS);

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
    result: PanResult | BaziResult | ZiweiRecordResult,
    stageOrPhase: AIConversationStage | 'initial' | 'followup',
): boolean {
    if (!isWorkflowResult(result)) {
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
    const baziText = formatBaziToText(result, relations, result.aiContextSnapshot ?? formatterContext);

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

function buildZiweiDigestText(digest: ZiweiAIConversationDigest): string {
    const normalized = normalizeZiweiDigestState(digest);
    const topicLines = Object.entries(normalized.topicNotes || {})
        .filter(([, value]) => value && value.trim())
        .map(([key, value]) => `${key}：${value}`);
    const timelineLines = (normalized.verificationTimeline || [])
        .filter((value) => value.trim().length > 0)
        .map((value) => `- ${value}`);
    const yearlyLines = Object.entries(normalized.yearlyOutlook || {})
        .filter(([, value]) => value && value.trim())
        .map(([year, value]) => `${year}：${value}`);
    const focusAnchorLines = Object.entries(normalized.focusAnchors || {})
        .filter(([, value]) => value && value.trim())
        .map(([key, value]) => `${key}：${value}`);

    const lines = [
        '【既有紫微诊断摘要】以下结论已在前文确认，后续追问默认沿用，除非新证据足以推翻：',
        `命格主轴：${normalized.foundation.lifeTheme || '未定'}`,
        `命宫重点：${normalized.foundation.mingPalace || '未定'}`,
        `命主/身主：${normalized.foundation.bodySoul || '未定'}`,
        `四化飞星：${normalized.foundation.mutagenDynamics || '未定'}`,
        `个性结构：${normalized.foundation.personality || '未定'}`,
        `前事核验：${normalized.verificationSummary || '暂无前事核验摘要'}`,
        `未来五年：${normalized.fiveYearSummary || '暂无未来五年摘要'}`,
        `会话摘要：${normalized.rollingSummary || '暂无摘要'}`,
    ];

    if (timelineLines.length > 0) {
        lines.push('前事时间线：');
        timelineLines.forEach((line) => lines.push(line));
    }
    if (yearlyLines.length > 0) {
        lines.push('逐年主线：');
        yearlyLines.forEach((line) => lines.push(line));
    }
    if (focusAnchorLines.length > 0) {
        lines.push('焦点锚点：');
        focusAnchorLines.forEach((line) => lines.push(line));
    }
    if (topicLines.length > 0) {
        lines.push('分题记录：');
        topicLines.forEach((line) => lines.push(line));
    }

    return lines.join('\n');
}

function normalizeZiweiDigestState(digest?: ZiweiAIConversationDigest | null): ZiweiAIConversationDigest {
    return {
        version: digest?.version || ZIWEI_DIGEST_VERSION,
        generatedAt: digest?.generatedAt || '',
        foundation: {
            lifeTheme: digest?.foundation.lifeTheme || '',
            mingPalace: digest?.foundation.mingPalace || '',
            bodySoul: digest?.foundation.bodySoul || '',
            mutagenDynamics: digest?.foundation.mutagenDynamics || '',
            personality: digest?.foundation.personality || '',
        },
        verificationSummary: digest?.verificationSummary || '',
        fiveYearSummary: digest?.fiveYearSummary || '',
        rollingSummary: digest?.rollingSummary || '',
        topicNotes: digest?.topicNotes || {},
        verificationTimeline: digest?.verificationTimeline || [],
        yearlyOutlook: digest?.yearlyOutlook || {},
        focusAnchors: digest?.focusAnchors || {},
    };
}

function shouldUseEnhancedZiweiEvidence(result: ZiweiRecordResult): boolean {
    return isZiweiContextSnapshotCurrent(result.aiContextSnapshot);
}

function buildZiweiSystemBundle(
    result: ZiweiRecordResult,
    workflowStage: ZiweiAIWorkflowStage,
    formatterContext?: ZiweiFormatterContext,
    options: { usedDigest?: boolean; requestType?: AIRequestDebugMeta['requestType'] } = {},
): AIRequestBundle {
    const stageContext = buildZiweiStageContext(result, workflowStage, formatterContext, {
        enhancedEvidence: shouldUseEnhancedZiweiEvidence(result),
    });
    const message: AIChatMessage = {
        role: 'system',
        content: `${getBuiltInSystemPrompt('ziwei')}

【系统铁律】
1. 你只能解释系统已经给出的紫微盘，不得自行补盘、改盘、换门派规则。
2. 当前盘面由 iztro 与当前 config 共同决定，config 是唯一事实源；若 config 为中州算法，只能按中州算法结果解释，不得跨算法改盘。
3. 工作流顺序固定为：基础命盘分析 → 前事核验 → 今年与未来五年 → 用户追问；不得越级输出。
4. 基础定盘阶段只准输出命格主轴、性格结构、能力结构、人生发力方向，不得提前输出未来趋势。
5. 前事核验必须结合本命盘、三方四正、生年四化、飞化与运限映射交叉验证。
6. 每个阶段正文写完后，必须在最后单独一行输出系统指定的阶段完成标记。
7. 后续追问默认继承本会话已确认的命格主轴、前事核验与未来五年主线，除非新证据足以推翻。

【强制阅盘工序】
1. 静态定盘：命宫/身宫/命主身主/五行局 → 主星辅曜杂耀 → 三方四正。
2. 动态判断：生年四化 → 宫干飞化/自化 → 当前运限宫位 → 流耀/直取星。
3. 时间展开：只有在用户确认前事核验较准后，才进入今年与未来五年判断。
4. 用户追问：只有在未来五年阶段完成后，才开放专题追问。

【输出要求】
1. 使用清晰小标题，不要暴露隐式推理过程。
2. 每个结论都必须说明宫位、星曜、四化或运限依据。
3. 不使用 emoji，不使用空泛鸡汤，不编造未提供的人生经历。
4. 若同一结论存在不同解释口径，必须说明分歧来自哪一层盘据。

【命盘底稿】
${stageContext.text}`,
    };

    return {
        messages: [message],
        debugMeta: {
            mode: 'ziwei',
            requestType: options.requestType || 'main',
            workflowStage: workflowStage === 'digest' || workflowStage === 'quick_replies' ? undefined : workflowStage,
            usedPromptSeed: Boolean(result.aiContextSnapshot?.promptSeed?.trim() && shouldUseEnhancedZiweiEvidence(result)),
            usedDynamicEvidencePack: stageContext.usedDynamicEvidencePack,
            usedDigest: options.usedDigest ?? false,
            systemCharCount: message.content.length,
            messageCount: 1,
            yearWindow: stageContext.yearWindow,
            focusPalaceName: stageContext.focusPalaceName,
            scopeLabel: stageContext.scopeLabel,
            compatibilityMode: !shouldUseEnhancedZiweiEvidence(result),
        },
    };
}

export async function buildZiweiSystemMessage(
    result: ZiweiRecordResult,
    formatterContext?: ZiweiFormatterContext,
    workflowStage: ZiweiAIWorkflowStage = 'followup',
): Promise<AIChatMessage> {
    return buildZiweiSystemBundle(result, workflowStage, formatterContext).messages[0];
}

export async function buildRequestBundle(
    result: PanResult | BaziResult | ZiweiRecordResult,
    chatHistory: PersistedAIChatMessage[],
    formatterContext?: BaziFormatterContext | ZiweiFormatterContext,
    requestContext: AIRequestBuildContext = {},
): Promise<AIRequestBundle> {
    if (!isBaziResult(result) && !isZiweiResult(result)) {
        const messages = [await buildSystemMessage(result), ...toApiMessages(chatHistory)];
        return {
            messages,
            debugMeta: {
                mode: 'liuyao',
                requestType: 'main',
                usedDynamicEvidencePack: false,
                usedDigest: false,
                systemCharCount: messages[0]?.content.length || 0,
                messageCount: messages.length,
            },
        };
    }

    const recentVisible = toVisibleMessages(chatHistory).slice(-10);
    if (isBaziResult(result)) {
        const relations = getBaziRelations(result);
        const systemMessage = await buildBaziSystemMessage(result, relations, result.aiContextSnapshot ?? formatterContext as BaziFormatterContext);
        const digest = result.aiConversationDigest;

        if (digest) {
            const messages: AIChatMessage[] = [
                systemMessage,
                { role: 'system', content: buildBaziDigestText(digest) },
                ...toApiMessages(recentVisible),
            ];
            return {
                messages,
                debugMeta: {
                    mode: 'bazi',
                    requestType: 'main',
                    workflowStage: requestContext.workflowStage,
                    usedDynamicEvidencePack: true,
                    usedDigest: true,
                    systemCharCount: systemMessage.content.length,
                    messageCount: messages.length,
                },
            };
        }

        const messages = [systemMessage, ...toApiMessages(chatHistory)];
        return {
            messages,
            debugMeta: {
                mode: 'bazi',
                requestType: 'main',
                workflowStage: requestContext.workflowStage,
                usedDynamicEvidencePack: true,
                usedDigest: false,
                systemCharCount: systemMessage.content.length,
                messageCount: messages.length,
            },
        };
    }

    const workflowStage = requestContext.workflowStage || (result.aiConversationDigest ? 'followup' : 'foundation');
    const digest = result.aiConversationDigest ? normalizeZiweiDigestState(result.aiConversationDigest) : null;
    const systemBundle = buildZiweiSystemBundle(result, workflowStage, formatterContext as ZiweiFormatterContext, {
        usedDigest: Boolean(digest),
        requestType: 'main',
    });
    const ziweiDebugMeta = systemBundle.debugMeta!;
    if (digest) {
        const messages: AIChatMessage[] = [
            ...systemBundle.messages,
            { role: 'system', content: buildZiweiDigestText(digest) },
            ...toApiMessages(recentVisible),
        ];
        return {
            messages,
            debugMeta: {
                ...ziweiDebugMeta,
                usedDigest: true,
                messageCount: messages.length,
            },
        };
    }

    const messages: AIChatMessage[] = [...systemBundle.messages, ...toApiMessages(chatHistory)];
    return {
        messages,
        debugMeta: {
            ...ziweiDebugMeta,
            usedDigest: false,
            messageCount: messages.length,
        },
    };
}

export async function buildRequestMessages(
    result: PanResult | BaziResult | ZiweiRecordResult,
    chatHistory: PersistedAIChatMessage[],
    formatterContext?: BaziFormatterContext | ZiweiFormatterContext,
    requestContext: AIRequestBuildContext = {},
): Promise<AIChatMessage[]> {
    const bundle = await buildRequestBundle(result, chatHistory, formatterContext, requestContext);
    return bundle.messages;
}

export async function analyzeWithAIChatStream(
    messages: AIChatMessage[],
    onChunk: (text: string) => void,
    signal?: AbortSignal,
    requestOptions: AIRequestOptions = {},
): Promise<AIAnalysisResult> {
    const stage = requestOptions.stage || 'stream';
    if (signal?.aborted) {
        return {
            success: false,
            error: 'ABORTED',
            code: 'aborted',
            stage,
            recoverable: true,
            usedFallback: false,
        };
    }

    const settings = await getSettings();

    if (!settings.apiKey) {
        return {
            success: false,
            error: '请先在设置中配置 API Key',
            code: 'missing_api_key',
            stage,
            recoverable: true,
            usedFallback: false,
        };
    }
    if (!settings.apiUrl) {
        return {
            success: false,
            error: '请先在设置中配置 API 接口地址',
            code: 'missing_api_url',
            stage,
            recoverable: true,
            usedFallback: false,
        };
    }

    let fullContent = '';
    let eventSource: EventSource;

    return new Promise((resolve) => {
        let isAborted = false;
        let heartbeatTimer: NodeJS.Timeout;
        const streamIdleTimeoutMs = getStreamIdleTimeoutMs(stage);
        const handleAbort = () => {
            if (heartbeatTimer) {
                clearTimeout(heartbeatTimer);
            }
            isAborted = true;
            eventSource.close();
            resolve({
                success: false,
                error: 'ABORTED',
                code: 'aborted',
                stage,
                recoverable: true,
                usedFallback: false,
            });
        };
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
                resolve({
                    success: false,
                    error: '连接超时：服务器长时间无响应',
                    code: 'timeout',
                    stage,
                    recoverable: true,
                    usedFallback: false,
                });
            }, streamIdleTimeoutMs);
        };

        resetHeartbeat();
        logAIRequestDebug({
            ...requestOptions.debugMeta,
            messageCount: requestOptions.debugMeta?.messageCount ?? messages.length,
            systemCharCount: requestOptions.debugMeta?.systemCharCount ?? (messages.find((item) => item.role === 'system')?.content.length || 0),
        });

        eventSource = new EventSource(resolveChatCompletionsUrl(settings.apiUrl), {
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
            lineEndingCharacter: '\n',
        });

        if (signal) {
            signal.addEventListener('abort', handleAbort, { once: true });
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
            if (signal) {
                signal.removeEventListener('abort', handleAbort);
            }
            eventSource.close();
            const errorStatus = typeof error.xhrStatus === 'number' && error.xhrStatus > 0
                ? `HTTP ${error.xhrStatus}`
                : '';
            const errorMessage = error.message || JSON.stringify(error);
            resolve({
                success: false,
                error: `模型请求意外中断${errorStatus ? `（${errorStatus}）` : ''}: ${errorMessage}`,
                code: errorStatus ? 'http_error' : 'network_error',
                stage,
                recoverable: true,
                usedFallback: false,
            });
        });
    });
}

export async function generateBaziConversationDigest(
    result: BaziResult,
    chatHistory: PersistedAIChatMessage[],
): Promise<AIArtifactResult<BaziAIConversationDigest | null>> {
    const relations = getBaziRelations(result);
    const previousDigest = result.aiConversationDigest;
    const baseContext = previousDigest
        ? `【已有摘要】\n${buildBaziDigestText(previousDigest)}`
        : `【命盘底稿】\n${formatBaziToText(result, relations, result.aiContextSnapshot)}`;
    const conversationSummary = summarizeMessages(chatHistory);
    const completion = await requestChatCompletion([
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
    ], { temperature: 0.1, maxTokens: 420, stage: 'bazi_digest' });

    if (!completion.success || !completion.content) {
        const outcome = {
            value: null,
            failure: completion.failure,
        };
        logAIFailure('bazi_digest', outcome.failure);
        return outcome;
    }

    const parsed = parseJsonPayload(completion.content);
    if (parsed) {
        return { value: normalizeDigest(parsed) };
    }

    const outcome = {
        value: null,
        failure: createAIFailure('invalid_response', 'bazi_digest', '八字摘要返回的 JSON 结构无效'),
    };
    logAIFailure('bazi_digest', outcome.failure);
    return outcome;
}

export async function generateZiweiConversationDigest(
    result: ZiweiRecordResult,
    chatHistory: PersistedAIChatMessage[],
): Promise<AIArtifactResult<ZiweiAIConversationDigest | null>> {
    const previousDigest = result.aiConversationDigest
        ? normalizeZiweiDigestState(result.aiConversationDigest)
        : null;
    const baseContext = previousDigest
        ? `【已有摘要】\n${buildZiweiDigestText(previousDigest)}`
        : `【命盘底稿】\n${formatZiweiToText(result)}`;
    const conversationSummary = summarizeMessages(chatHistory);
    const digestMessages: AIChatMessage[] = [
        {
            role: 'system',
            content: '你是紫微斗数会话摘要器，只负责压缩已确认结论，不新增命理事实。输出必须是严格 JSON，不要 markdown，不要解释。',
        },
        {
            role: 'user',
            content: `${baseContext}

【最近会话】
${conversationSummary}

请只返回严格 JSON，结构如下：
{"foundation":{"lifeTheme":"","mingPalace":"","bodySoul":"","mutagenDynamics":"","personality":""},"verificationSummary":"","fiveYearSummary":"","rollingSummary":"","verificationTimeline":[""],"yearlyOutlook":{"2026":""},"focusAnchors":{"career":"","relationship":"","wealth":""},"topicNotes":{"career":"","relationship":"","wealth":""}}

要求：
1. foundation 只保留当前对话已经明确判定的结论。
2. verificationSummary 用 80 字以内压缩已完成的前事核验结论；没有就留空。
3. fiveYearSummary 用 80 字以内压缩已完成的今年/未来五年主线；没有就留空。
4. verificationTimeline 保留 3 到 5 条已经确认的过去节点，每条一句。
5. yearlyOutlook 只填写已经明确讨论到的年份主线，key 用四位年份字符串。
6. focusAnchors 记录当前高频专题对应的宫位或主轴锚点，没有就留空字符串。
7. topicNotes 只记录已经明确讨论过的后续专题，没有就留空字符串。
8. 不要输出 JSON 之外的任何内容。`,
        },
    ];
    const completion = await requestChatCompletion(digestMessages, {
        temperature: 0.1,
        maxTokens: 520,
        stage: 'ziwei_digest',
        debugMeta: {
            mode: 'ziwei',
            requestType: 'digest',
            usedPromptSeed: false,
            usedDynamicEvidencePack: shouldUseEnhancedZiweiEvidence(result),
            usedDigest: Boolean(result.aiConversationDigest),
            systemCharCount: digestMessages[0].content.length,
            messageCount: digestMessages.length,
            compatibilityMode: !shouldUseEnhancedZiweiEvidence(result),
        },
    });

    if (!completion.success || !completion.content) {
        const outcome = {
            value: null,
            failure: completion.failure,
        };
        logAIFailure('ziwei_digest', outcome.failure);
        return outcome;
    }

    const parsed = parseJsonPayload(completion.content);
    if (parsed) {
        return { value: normalizeZiweiDigest(parsed) };
    }

    const outcome = {
        value: null,
        failure: createAIFailure('invalid_response', 'ziwei_digest', '紫微摘要返回的 JSON 结构无效'),
    };
    logAIFailure('ziwei_digest', outcome.failure);
    return outcome;
}

export async function generateQuickReplies(
    result: PanResult | BaziResult | ZiweiRecordResult,
    chatHistory: PersistedAIChatMessage[],
): Promise<AIArtifactResult<string[]>> {
    if (isBaziResult(result)) {
        const digestText = result.aiConversationDigest
            ? buildBaziDigestText(result.aiConversationDigest)
            : '暂无既有摘要，请围绕基础诊断与后续高价值追问生成短句。';
        const recentFocus = getLastVisibleUserContent(chatHistory) || '基础诊断';
        const completion = await requestChatCompletion([
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
        ], { temperature: 0.4, maxTokens: 120, stage: 'bazi_quick_replies' });

        const parsed = completion.success && completion.content ? parseQuickReplyLines(completion.content) : [];
        if (parsed.length === 3) {
            return { value: parsed };
        }

        const outcome = {
            value: BAZI_FALLBACK_QUICK_REPLIES,
            failure: completion.failure
                ? { ...completion.failure, usedFallback: true }
                : createAIFailure(
                    'invalid_response',
                    'bazi_quick_replies',
                    '八字快捷追问返回格式无效',
                    { usedFallback: true },
                ),
        };
        logAIFailure('bazi_quick_replies', outcome.failure);
        return outcome;
    }

    if (isZiweiResult(result)) {
        const digestText = result.aiConversationDigest
            ? buildZiweiDigestText(normalizeZiweiDigestState(result.aiConversationDigest))
            : '暂无既有摘要，请围绕命格主轴、前事核验与未来五年高价值追问生成短句。';
        const recentFocus = getLastVisibleUserContent(chatHistory) || '基础命盘分析';
        const quickReplyMessages: AIChatMessage[] = [
            {
                role: 'system',
                content: '你只负责生成紫微斗数追问短句。只返回 3 行纯文本，每行一条，不要 JSON，不要序号，不要 emoji，不要解释。',
            },
            {
                role: 'user',
                content: `【当前已确认摘要】
${digestText}

【最近关注】
${recentFocus}

请生成 3 条后续追问短句，要求：
1. 每条 8 到 18 个汉字。
2. 优先围绕未来五年事业节奏、感情转折、关键年份、应主动发力的宫位。
3. 若最近对话已经深入讨论其中某类，则替换成下一优先的高价值单主题追问。
4. 只输出 3 行纯文本。`,
            },
        ];
        const completion = await requestChatCompletion(quickReplyMessages, {
            temperature: 0.4,
            maxTokens: 120,
            stage: 'ziwei_quick_replies',
            debugMeta: {
                mode: 'ziwei',
                requestType: 'quick_replies',
                usedPromptSeed: false,
                usedDynamicEvidencePack: shouldUseEnhancedZiweiEvidence(result),
                usedDigest: Boolean(result.aiConversationDigest),
                systemCharCount: quickReplyMessages[0].content.length,
                messageCount: quickReplyMessages.length,
                compatibilityMode: !shouldUseEnhancedZiweiEvidence(result),
            },
        });

        const parsed = completion.success && completion.content ? parseQuickReplyLines(completion.content) : [];
        if (parsed.length === 3) {
            return { value: parsed };
        }

        const outcome = {
            value: ZIWEI_FALLBACK_QUICK_REPLIES,
            failure: completion.failure
                ? { ...completion.failure, usedFallback: true }
                : createAIFailure(
                    'invalid_response',
                    'ziwei_quick_replies',
                    '紫微快捷追问返回格式无效',
                    { usedFallback: true },
                ),
        };
        logAIFailure('ziwei_quick_replies', outcome.failure);
        return outcome;
    }

    if (!result.question) {
        return { value: [] };
    }

    const settings = await getSettings();
    if (!settings.apiKey || !settings.apiUrl) {
        return {
            value: [],
            failure: createAIFailure(
                settings.apiKey ? 'missing_api_url' : 'missing_api_key',
                'liuyao_quick_replies',
                settings.apiKey ? '请先在设置中配置 API 接口地址' : '请先在设置中配置 API Key',
                { usedFallback: true },
            ),
        };
    }

    const systemMsg = await buildSystemMessage(result);
    const instruction: AIChatMessage = {
        role: 'user',
        content: `这是用户占问的主题：“${result.question}”。请你根据前文提供的排盘数据及我们刚刚的对话进度，站在预测大师的角度，提供 3 到 4 个极具价值的【后续追问短句】。无需废话，仅返回一段被 \`\`\`json\`\`\` 包裹的内容，例如：{"quickReplies":["追问1","追问2","追问3"]}`,
    };

    const content = await requestChatCompletion(
        [systemMsg, ...toApiMessages(chatHistory), instruction],
        { temperature: 0.7, maxTokens: 180, stage: 'liuyao_quick_replies' },
    );
    if (!content.success || !content.content) {
        const outcome = {
            value: [],
            failure: content.failure,
        };
        logAIFailure('liuyao_quick_replies', outcome.failure);
        return outcome;
    }

    const parsed = parseJsonPayload(content.content);
    const outcome = {
        value: parsed && Array.isArray(parsed.quickReplies)
            ? parsed.quickReplies.filter((item): item is string => typeof item === 'string')
            : [],
        failure: parsed && Array.isArray(parsed.quickReplies)
            ? undefined
            : createAIFailure('invalid_response', 'liuyao_quick_replies', '六爻快捷追问返回格式无效'),
    };
    if (outcome.failure) {
        logAIFailure('liuyao_quick_replies', outcome.failure);
    }
    return outcome;
}
