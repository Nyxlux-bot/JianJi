/**
 * AI 分析服务
 * 负责六爻与八字两套排盘的系统提示词、上下文整理、流式请求与快捷追问。
 */

import { BaziFormatterContext, mergeBaziFormatterContext } from '../core/bazi-ai-context';
import {
    AIConversationStage,
    BaziAIConversationDigest,
    BaziAIConversationStage,
    BaziAIWorkflowStage,
    PersistedAIChatMessage,
    ZiweiAIConversationDigest,
} from '../core/ai-meta';
import { buildBaziAIEvidencePack, formatBaziAIEvidencePack, type BaziAIEvidencePack } from '../core/bazi-ai-evidence';
import { BAZI_FORECAST_YEARS, resolveBaziEvidenceRequest } from '../core/bazi-ai-data-request';
import { getBaziRequestHistory, getBaziStageBaselines, getBaziWorkflowVersion, normalizeBaziStage, resolveBaziConversationStage } from '../core/bazi-ai-workflow';
import { buildKinshipContext, getCurrentKinshipVerification, isKinshipResponseKind, type KinshipResponseKind } from '../core/bazi-kinship';
import { BaziResult } from '../core/bazi-types';
import { getAllRelatedGua } from '../core/hexagramTransform';
import { PanResult } from '../core/liuyao-calc';
import { BA_GUA, DIZHI_WUXING, getLiuyaoSubjectLabel, getLiuQin, type WuXing } from '../core/liuyao-data';
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
import { BAZI_DIGEST_OUTPUT, ZIWEI_DIGEST_OUTPUT, LIUYAO_QUICK_REPLIES_OUTPUT, renderFiveYearFormat, renderVerificationFormat } from '../ai/output-contracts';
import { composeSkillInstructions, getSkillVersions, renderSkillRequest } from '../ai/skill-composer';
import { streamProviderText } from './ai-provider-client';
import type { AIRequestRuntime } from './ai-provider-types';
import type { AIExecutionMeta, AISkillVersion } from '../core/ai-execution-meta';
import { recordDiagnosticLog } from './diagnostics';
import { formatZiweiToText } from './ziwei-formatter';

const ICHING_MAP = new Map<string, string>();
(ichingData as any[]).forEach((item) => {
    ICHING_MAP.set(item.array.join(''), item.name);
});

const BAZI_DIGEST_VERSION = 1;
const BAZI_FALLBACK_QUICK_REPLIES = [
    '细看未来五年财运',
    '未来哪年感情波动大',
    '未来五年事业发力点',
];
const LIUYAO_FALLBACK_QUICK_REPLIES = [
    '此事何时见结果',
    '目前最大的阻力是什么',
    '下一步该主动还是等待',
];
export const LIUYAO_COMPLETION_MARKER = '[[LIUYAO_DONE]]';
const LIUYAO_COMPLETION_MARKER_PREFIX = '[[LIUYAO_DONE';
const LIUYAO_COMPLETION_MARKER_REGEX = /\[\[LIUYAO_DONE\]\]/g;
const ZIWEI_DIGEST_VERSION = 2;
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
const THINK_BLOCK_REGEX = /<(?:think|thought)>[\s\S]*?<\/(?:think|thought)>/gi;
const THINK_BLOCK_START_REGEX = /<(?:think|thought)>/i;
const THINK_BLOCK_END_REGEX = /<\/(?:think|thought)>/i;
const CODE_THINK_BLOCK_REGEX = /^```(?:thinking|thought|think)[\s\S]*?```/gi;

export type BaziWorkflowResponseKind = keyof typeof BAZI_STAGE_MARKERS;
export type ZiweiWorkflowResponseKind = keyof typeof ZIWEI_STAGE_MARKERS;
export type AIWorkflowResponseKind = BaziWorkflowResponseKind | ZiweiWorkflowResponseKind | KinshipResponseKind;

export interface BaziVerificationAction {
    id: 'continue' | 'retry_verification';
    label: string;
}

export interface AIAnalysisResult {
    executionMeta?: AIExecutionMeta;
    success: boolean;
    content?: string;
    error?: string;
    code?: AIErrorCode;
    stage?: string;
    recoverable?: boolean;
    usedFallback?: boolean;
}

export type AIErrorCode =
    | 'invalid_configuration'
    | 'missing_api_key'
    | 'missing_api_url'
    | 'http_error'
    | 'network_error'
    | 'timeout'
    | 'aborted'
    | 'invalid_response'
    | 'empty_response'
    | 'token_limit'
    | 'record_changed';

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
    mode: 'liuyao' | 'bazi' | 'ziwei' | 'baziCompatibility';
    skills?: AISkillVersion[];
    requestType: 'main' | 'digest' | 'quick_replies';
    workflowStage?: BaziAIWorkflowStage;
    usedPromptSeed?: boolean;
    usedDynamicEvidencePack?: boolean;
    usedDigest?: boolean;
    systemCharCount: number;
    messageCount: number;
    yearWindow?: string;
    focusPalaceName?: string;
    scopeLabel?: string;
    compatibilityMode?: boolean;
    evidenceScope?: BaziAIEvidencePack['scope'];
    evidenceYears?: number[];
    evidenceMonthYears?: number[];
    baselineRevisions?: Array<{ stage: string; revision: number }>;
}

export interface AIRequestBundle {
    messages: AIChatMessage[];
    debugMeta?: AIRequestDebugMeta;
    baziEvidencePack?: BaziAIEvidencePack;
}

export interface AIRequestBuildContext {
    workflowStage?: BaziAIWorkflowStage;
    asOf?: Date;
}

export interface AIRequestOptions {
    runtime: AIRequestRuntime;
    signal?: AbortSignal;
    skills?: AISkillVersion[];
    stage?: string;
    debugMeta?: AIRequestDebugMeta;
    onReasoning?: () => void;
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

function describeElementAction(left: string, leftElement: WuXing, right: string, rightElement: WuXing): string {
    const relation = getLiuQin(leftElement, rightElement);
    if (relation === '兄弟') return `${left}与${right}同五行`;
    if (relation === '子孙') return `${left}生${right}（${left}被泄，不是受生）`;
    if (relation === '父母') return `${right}生${left}（${right}被泄，不是受生）`;
    if (relation === '妻财') return `${left}克${right}`;
    return `${right}克${left}`;
}

export function formatPanForAI(result: PanResult): string {
    const lines: string[] = [];
    const monthGeneral = result.monthGeneral || getMonthGeneralByJieqi(result.jieqi?.current || '', result.monthGanZhi?.[1]);
    const createdAtDate = new Date(result.createdAt);
    const moonPhaseDate = Number.isNaN(createdAtDate.getTime()) ? new Date() : createdAtDate;
    const moonPhase = getMoonPhase(moonPhaseDate, result.lunarInfo?.day);

    lines.push('【起卦时点资料】');
    lines.push('以下四柱、日月建、旬空及节气属于所记起卦时点，不代表追问当天；后续提问不会改变此卦。');
    lines.push(`公历：${result.solarDate} ${result.solarTime}`);
    if (result.subject) {
        lines.push(`【性别/起卦主体】${getLiuyaoSubjectLabel(result.subject)}`);
    } else {
        lines.push('【性别/起卦主体】未指定（历史记录未保存该字段，请勿根据其他信息推断）');
    }
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
    lines.push(`【衍生卦（辅助）】互卦：${findGuaName(related.hu)} | 错卦：${findGuaName(related.cuo)} | 综卦：${findGuaName(related.zong)}`);
    lines.push('【本卦爻表】以下爻位、六亲、六神与世应均属本卦。');
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
    lines.push('【日月对本卦各爻的五行作用】以下只确定施受方向，不代替旺衰和吉凶判断。');
    result.benGuaYao.forEach((yao) => {
        const label = `${yao.positionName}爻${yao.zhi}${yao.wuxing}`;
        lines.push(`- ${describeElementAction(`月建${monthZhi}${DIZHI_WUXING[monthZhi]}`, DIZHI_WUXING[monthZhi], label, yao.wuxing)}；${describeElementAction(`日建${dayZhi}${DIZHI_WUXING[dayZhi]}`, DIZHI_WUXING[dayZhi], label, yao.wuxing)}`);
    });

    if (result.bianGua) {
        lines.push('');
        const bianGongWuXing = getGongWuXing(result.bianGua.gong);
        lines.push(`【变卦】${result.bianGua.fullName}（${result.bianGua.gong}宫·${bianGongWuXing}）`);
        lines.push(`变卦自身世爻：第${result.bianGua.shiYao}爻 | 应爻：第${result.bianGua.yingYao}爻（不替代本卦世应）`);
        if (result.bianGuaYao && result.bianGuaYao.length === 6) {
            lines.push('');
            lines.push('【变卦爻表】爻位干支属于变卦，六亲仍按本卦卦宫计算；上方变卦所属卦宫不改变此表的六亲口径。');
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
        lines.push(`【本卦动爻及变出（六亲按本卦卦宫）】第${result.movingYaoPositions.join('、')}爻`);
        for (const pos of result.movingYaoPositions) {
            const yao = result.benGuaYao[pos - 1];
            lines.push(`  ${yao.positionName}爻：${yao.liuShenShort}·${yao.liuQinShort}${yao.zhi}(${yao.wuxing})${yao.bianZhi ? ` → ${yao.bianLiuQinShort}${yao.bianZhi}(${yao.bianWuXing})` : ''}`);
        }
    } else {
        lines.push('【动变】本卦无动爻，不生成动爻变出判断。');
    }

    lines.push('【本卦伏神与飞神】');
    const hiddenSpirits = result.benGuaYao.filter((yao) => yao.fuShen);
    if (hiddenSpirits.length === 0) lines.push('记录未提供伏神条目，不自行补算；不能据此推断现实中缺少某类人物。');
    hiddenSpirits.forEach((yao) => {
        const hidden = yao.fuShen;
        if (!hidden) return;
        lines.push(`- 本卦${yao.positionName}爻下伏神：${hidden.liuQin} ${hidden.ganZhi}（${hidden.wuxing}）；同位飞神：${yao.liuQin} ${yao.ganZhi}（${yao.wuxing}）`);
    });

    if (result.question?.trim()) {
        lines.push('');
        lines.push(`【占问】${result.question}`);
    } else {
        lines.push('【占问】未填写；仅能先作卦象初步分析，不能擅定求财、感情等事项或当事人关系。');
    }

    lines.push('');
    lines.push(`起卦方式：${result.method}`);
    return lines.join('\n');
}

function toApiMessages(messages: PersistedAIChatMessage[]): AIChatMessage[] {
    return messages.map((message) => ({
        role: message.role,
        content: message.role === 'user' && message.requestContent ? message.requestContent : message.content,
    }));
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
    return normalizeBaziStage(stage);
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
    const withoutClosedThinkBlocks = content
        .replace(THINK_BLOCK_REGEX, '')
        .replace(CODE_THINK_BLOCK_REGEX, '');
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

function sanitizeLeadingDraft(content: string, kind?: BaziWorkflowResponseKind): string {
    const draftStartRegex = /^(?:\s*|\uFEFF)*(?:我(?:需要|要|来)写|我的任务是|当前阶段是|【?(?:思考过程|构思草稿)[：:]?)/u;
    if (!draftStartRegex.test(content)) {
        return content;
    }
    const stageHeading = kind === 'foundation' ? /基础|命盘|命格|定局|四柱|日主/
        : kind === 'verification' ? /前事|核验|^\d{4}/ : kind === 'five_year' ? /今年|总览|总纲|^\d{4}/ : /\S/;
    const headingIndex = [...content.matchAll(/^#{1,6}\s+(.+)$/gm)]
        .find((match) => stageHeading.test(match[1]))?.index ?? -1;
    if (headingIndex !== -1) {
        return content.slice(headingIndex).trimStart();
    }
    return '';
}

export function sanitizeBaziStreamingContent(content: string, kind?: BaziWorkflowResponseKind): string {
    const withoutMarkers = content.replace(/\[\[BAZI_STAGE:(?:FOUNDATION_DONE|VERIFICATION_DONE|FIVE_YEAR_DONE)\]\]/g, '');
    const withoutThinkingBlocks = stripThinkingBlocks(withoutMarkers);
    if (!withoutThinkingBlocks.trimStart().includes('\n')) return '';
    const withoutDrafts = sanitizeLeadingDraft(withoutThinkingBlocks, kind);
    const partialMarkerStart = getPartialMarkerStartIndex(withoutDrafts, '[[BAZI_STAGE:');
    const visibleContent = partialMarkerStart === -1
        ? withoutDrafts
        : withoutDrafts.slice(0, partialMarkerStart);
    return normalizeStageText(visibleContent);
}

export function stripBaziStageMarkers(content: string, kind?: BaziWorkflowResponseKind): string {
    const withoutMarkers = content.replace(/\[\[BAZI_STAGE:(?:FOUNDATION_DONE|VERIFICATION_DONE|FIVE_YEAR_DONE)\]\]/g, '');
    return normalizeStageText(
        sanitizeLeadingDraft(stripThinkingBlocks(withoutMarkers), kind),
    );
}

export function sanitizeZiweiStreamingContent(content: string, kind?: ZiweiWorkflowResponseKind): string {
    const withoutMarkers = content.replace(/\[\[ZIWEI_STAGE:(?:FOUNDATION_DONE|VERIFICATION_DONE|FIVE_YEAR_DONE)\]\]/g, '');
    const withoutThinkingBlocks = stripThinkingBlocks(withoutMarkers);
    if (!withoutThinkingBlocks.trimStart().includes('\n')) return '';
    const withoutDrafts = sanitizeLeadingDraft(withoutThinkingBlocks, kind);
    const partialMarkerStart = getPartialMarkerStartIndex(withoutDrafts, '[[ZIWEI_STAGE:');
    const visibleContent = partialMarkerStart === -1
        ? withoutDrafts
        : withoutDrafts.slice(0, partialMarkerStart);
    return normalizeStageText(visibleContent);
}

export function stripZiweiStageMarkers(content: string, kind?: ZiweiWorkflowResponseKind): string {
    const withoutMarkers = content.replace(/\[\[ZIWEI_STAGE:(?:FOUNDATION_DONE|VERIFICATION_DONE|FIVE_YEAR_DONE)\]\]/g, '');
    return normalizeStageText(
        sanitizeLeadingDraft(stripThinkingBlocks(withoutMarkers), kind),
    );
}

export function sanitizeLiuyaoStreamingContent(content: string): string {
    const withoutMarkers = content.replace(LIUYAO_COMPLETION_MARKER_REGEX, '');
    const withoutThinkingBlocks = stripThinkingBlocks(withoutMarkers);
    const partialMarkerStart = getPartialMarkerStartIndex(withoutThinkingBlocks, LIUYAO_COMPLETION_MARKER_PREFIX);
    const visibleContent = partialMarkerStart === -1
        ? withoutThinkingBlocks
        : withoutThinkingBlocks.slice(0, partialMarkerStart);
    return normalizeStageText(visibleContent);
}

export function stripLiuyaoCompletionMarker(content: string): string {
    return normalizeStageText(
        stripThinkingBlocks(content.replace(LIUYAO_COMPLETION_MARKER_REGEX, '')),
    );
}

export function hasLiuyaoCompletionMarker(content: string): boolean {
    return stripThinkingBlocks(content).trim().endsWith(LIUYAO_COMPLETION_MARKER);
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
        futureEndYear: currentYear + BAZI_FORECAST_YEARS,
        todayText: formatLocalDate(now),
    };
}

/**
 * Stage completion depends only on whether the reply was written to the end:
 * the stream finished normally (the provider reports token limits and broken
 * streams as failures before this point) and either the stage marker is
 * present or the body is long enough to be a full chapter. Headings and
 * labels are read by the layout parser and never fail a stage.
 */
const WORKFLOW_MIN_CHARS: Record<BaziWorkflowResponseKind, number> = {
    foundation: 400,
    verification: 300,
    five_year: 500,
};

function getWorkflowCompletenessIssues<TKind extends BaziWorkflowResponseKind>(
    kind: TKind,
    rawContent: string,
    cleanContent: string,
    markers: Record<TKind, string>,
): string[] {
    const hasMarker = stripThinkingBlocks(rawContent).includes(markers[kind]);
    if (hasMarker || cleanContent.trim().length >= WORKFLOW_MIN_CHARS[kind]) return [];
    return ['回复过短且没有本阶段完成标记，可能没有写完'];
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
    const cleanContent = stripBaziStageMarkers(rawContent, kind);
    const issues = getWorkflowCompletenessIssues(kind, rawContent, cleanContent, BAZI_STAGE_MARKERS);
    return { success: issues.length === 0, cleanContent, marker, issues };
}

export function validateZiweiWorkflowResponse(
    kind: ZiweiWorkflowResponseKind,
    rawContent: string,
): {
    success: boolean;
    cleanContent: string;
    marker: ZiweiWorkflowResponseKind | null;
    issues: string[];
} {
    const marker = getContentMarker(rawContent, ZIWEI_STAGE_MARKERS);
    const cleanContent = stripZiweiStageMarkers(rawContent, kind);
    const issues = getWorkflowCompletenessIssues(kind, rawContent, cleanContent, ZIWEI_STAGE_MARKERS);
    return { success: issues.length === 0, cleanContent, marker, issues };
}

function buildBaziDigestText(digest: BaziAIConversationDigest): string {
    const topicLines = Object.entries(digest.topicNotes || {})
        .filter(([, value]) => value && value.trim())
        .map(([key, value]) => `${key}：${value}`);

    const lines = [
        '【会话压缩摘要】这是 AI 对已有分析的整理，不能将候选事件或未确认推断当作用户事实；与保存的阶段原文冲突时，以原文及用户反馈为准。',
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
    const trimmed = stripThinkingBlocks(content).trim();
    if (!trimmed) {
        return null;
    }

    const tryParseObject = (candidate: string): Record<string, unknown> | null => {
        try {
            const parsed = JSON.parse(candidate);
            return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
                ? parsed as Record<string, unknown>
                : null;
        } catch {
            return null;
        }
    };

    const direct = tryParseObject(trimmed);
    if (direct) {
        return direct;
    }

    const fencedMatches = trimmed.matchAll(/```(?:json)?\s*([\s\S]*?)\s*```/gi);
    for (const match of fencedMatches) {
        const parsed = tryParseObject(match[1]);
        if (parsed) {
            return parsed;
        }
    }

    let objectStart = -1;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = 0; index < trimmed.length; index += 1) {
        const character = trimmed[index];
        if (objectStart === -1) {
            if (character === '{') {
                objectStart = index;
                depth = 1;
            }
            continue;
        }
        if (inString) {
            if (escaped) {
                escaped = false;
            } else if (character === '\\') {
                escaped = true;
            } else if (character === '"') {
                inString = false;
            }
            continue;
        }
        if (character === '"') {
            inString = true;
        } else if (character === '{') {
            depth += 1;
        } else if (character === '}') {
            depth -= 1;
            if (depth === 0) {
                const parsed = tryParseObject(trimmed.slice(objectStart, index + 1));
                if (parsed) {
                    return parsed;
                }
                objectStart = -1;
            }
        }
    }

    return null;
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
    void recordDiagnosticLog({
        level: 'warn',
        source: `AI:${label}`,
        message: failure.message,
        context: {
            code: failure.code,
            stage: failure.stage,
            recoverable: failure.recoverable,
            usedFallback: failure.usedFallback,
        },
    });
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
    options: AIRequestOptions,
): Promise<{ success: boolean; content?: string; failure?: AIFailureInfo }> {
    const stage = options.stage || 'completion';
    logAIRequestDebug({
        ...options.debugMeta,
        messageCount: options.debugMeta?.messageCount ?? messages.length,
        systemCharCount: options.debugMeta?.systemCharCount ?? (messages.find((item) => item.role === 'system')?.content.length || 0),
    });
    const response = await streamProviderText(options.runtime, messages, {
        stage,
        requestType: options.debugMeta?.requestType ?? (stage.includes('digest') ? 'digest' : 'quick_replies'),
        signal: options.signal,
        skills: options.skills,
    });
    return response.success && response.content
        ? { success: true, content: stripThinkingBlocks(response.content).trim() }
        : {
            success: false,
            failure: createAIFailure(
                response.code ?? 'network_error',
                stage,
                response.error || '模型请求失败',
            ),
        };
}

export function getBaziFoundationPrompt(): string {
    return renderSkillRequest('bazi', 'foundation', { completionMarker: BAZI_STAGE_MARKERS.foundation });
}

export function getZiweiFoundationPrompt(): string {
    return renderSkillRequest('ziwei', 'foundation', { completionMarker: ZIWEI_STAGE_MARKERS.foundation });
}

export function getLocalBaziQuickReplies(): string[] {
    return [...BAZI_FALLBACK_QUICK_REPLIES];
}

export function getLocalLiuyaoQuickReplies(result: PanResult): string[] {
    const question = result.question || '';
    if (/婚|感情|复合|对象|恋|姻缘/u.test(question)) {
        return ['这段关系能不能成', '对方现在怎么想', '何时适合推进关系'];
    }
    if (/财|钱|投资|生意|工作|事业|项目/u.test(question)) {
        return ['此事财动利弊如何', '何时适合推进项目', '目前最大的阻力是什么'];
    }
    if (/病|健康|身体|手术|药/u.test(question)) {
        return ['病势近期会缓吗', '哪段时间要多注意', '调养上最忌什么'];
    }
    return [...LIUYAO_FALLBACK_QUICK_REPLIES];
}

export function getLocalBaziVerificationActions(): BaziVerificationAction[] {
    return [
        { id: 'continue', label: '继续分析今年与未来五年' },
        { id: 'retry_verification', label: '重新分析前事' },
    ];
}

export function getLocalZiweiQuickReplies(): string[] {
    return [...ZIWEI_FALLBACK_QUICK_REPLIES];
}

export function getLocalZiweiVerificationActions(): BaziVerificationAction[] {
    return [
        { id: 'continue', label: '继续分析今年与未来五年' },
        { id: 'retry_verification', label: '重新分析前事' },
    ];
}

export function buildBaziVerificationPrompt(): string {
    return renderSkillRequest('bazi', 'verification', { outputFormat: renderVerificationFormat('bazi'), completionMarker: BAZI_STAGE_MARKERS.verification });
}

export function buildZiweiVerificationPrompt(): string {
    return renderSkillRequest('ziwei', 'verification', { outputFormat: renderVerificationFormat('ziwei'), completionMarker: ZIWEI_STAGE_MARKERS.verification });
}

export function buildBaziVerificationRetryPrompt(): string {
    return renderSkillRequest('common', 'retry');
}

export function buildBaziFiveYearPrompt(asOf: Date = new Date()): string {
    const { currentYear, futureStartYear, futureEndYear, todayText } = resolveBaziFutureWindow(asOf);
    return renderSkillRequest('bazi', 'five_year', { currentYear, futureStartYear, futureEndYear, todayText,
        outputFormat: renderFiveYearFormat('bazi', currentYear, futureEndYear), completionMarker: BAZI_STAGE_MARKERS.five_year });
}

export function buildZiweiFiveYearPrompt(result: ZiweiRecordResult, asOf: Date = new Date()): string {
    const { currentYear, futureStartYear, futureEndYear, todayText } = resolveBaziFutureWindow(asOf);
    return renderSkillRequest('ziwei', 'five_year', { currentYear, futureStartYear, futureEndYear, todayText,
        outputFormat: renderFiveYearFormat('ziwei', currentYear, futureEndYear), fiveElementsClass: result.fiveElementsClass, soul: result.soul, body: result.body, completionMarker: ZIWEI_STAGE_MARKERS.five_year });
}

export function getLocalBaziFoundationActionLabel(): string {
    return '开始前事核验';
}

export function getLocalZiweiFoundationActionLabel(): string {
    return '开始前事核验';
}

export function buildBaziFollowUpPrompt(userText: string): string {
    return renderSkillRequest('bazi', 'followup', { userText });
}

export function buildZiweiFollowUpPrompt(userText: string): string {
    return renderSkillRequest('ziwei', 'followup', { userText });
}

export function getBaziConversationStage(result: BaziResult): BaziAIConversationStage {
    return resolveBaziConversationStage(result);
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
    stageOrPhase: BaziAIConversationStage | 'initial' | 'followup',
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
        content: `${composeSkillInstructions('liuyao', 'initial', { completionMarker: LIUYAO_COMPLETION_MARKER })}\n\n【本轮排盘数据】\n${panStr}`,
    };
}

export async function buildBaziSystemMessage(
    result: BaziResult,
    formatterContext?: BaziFormatterContext,
    evidencePack?: BaziAIEvidencePack,
    stage: BaziAIWorkflowStage = 'foundation',
): Promise<AIChatMessage> {
    const context = mergeBaziFormatterContext(result.aiContextSnapshot, formatterContext);
    const asOf = new Date();
    const pack = evidencePack ?? buildBaziAIEvidencePack(result, context, asOf,
        resolveBaziEvidenceRequest(result, stage, asOf, result.aiChatHistory, context));
    const workflowVersion = getBaziWorkflowVersion(result);
    const workflow = workflowVersion === 2
        ? '基础定局 → 可选的一次六亲初验或用户实际情况反馈（均可跳过）→ 前事核验 → 今年与未来五年 → 专题追问'
        : '基础定局 → 前事核验 → 今年与未来五年 → 专题追问';
    const kinshipContext = workflowVersion === 2 && stage !== 'foundation' && stage !== 'kinship'
        ? buildKinshipContext(getCurrentKinshipVerification(result)) : '本轮没有可当作已确认家庭事实的答案。';
    const skillContext = composeSkillInstructions('bazi', stage, {
        workflowVersion, workflow, stage, kinshipContext,
    }, workflowVersion);
    return {
        role: 'system',
        content: `${skillContext}\n\n${formatBaziAIEvidencePack(pack)}`,
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
        '【此前紫微分析摘要】这是 AI 对历史分析的压缩，不证明用户核实过其中事件；即使旧摘要写有“已确认”，仍须有明确用户反馈支持，冲突时以当前反馈和对应盘据为准：',
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
    options: { usedDigest?: boolean; requestType?: AIRequestDebugMeta['requestType']; asOf?: Date } = {},
): AIRequestBundle {
    const stageContext = buildZiweiStageContext(result, workflowStage, formatterContext, {
        enhancedEvidence: shouldUseEnhancedZiweiEvidence(result),
        asOf: options.asOf,
    });
    const skillContext = composeSkillInstructions('ziwei', workflowStage, {
        stage: workflowStage,
        workflowVersion: 1,
        completionMarker: '',
    });
    const message: AIChatMessage = {
        role: 'system',
        content: `${skillContext}\n\n【命盘底稿】\n${stageContext.text}`,
    };
    const skills = getSkillVersions('ziwei', workflowStage === 'digest' || workflowStage === 'quick_replies' ? 'digest' : workflowStage);
    return {
        messages: [message],
        debugMeta: {
            mode: 'ziwei', requestType: options.requestType || 'main', skills,
            workflowStage: workflowStage === 'digest' || workflowStage === 'quick_replies' ? undefined : workflowStage,
            usedPromptSeed: Boolean(result.aiContextSnapshot?.promptSeed?.trim() && shouldUseEnhancedZiweiEvidence(result)),
            usedDynamicEvidencePack: stageContext.usedDynamicEvidencePack,
            usedDigest: options.usedDigest ?? false,
            systemCharCount: message.content.length, messageCount: 1,
            yearWindow: stageContext.yearWindow, focusPalaceName: stageContext.focusPalaceName,
            scopeLabel: stageContext.scopeLabel, compatibilityMode: !shouldUseEnhancedZiweiEvidence(result),
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

/**
 * Anthropic Messages 要求首条非 system 消息为 user；阶段锚点与摘要截断都可能让 assistant 排在最前。
 * 把开头连续的 assistant 消息合并为一条 user 背景消息，保证所有协议都能接受。
 */
export function ensureUserFirst(messages: AIChatMessage[]): AIChatMessage[] {
    const firstIndex = messages.findIndex((message) => message.role !== 'system');
    if (firstIndex < 0 || messages[firstIndex].role !== 'assistant') {
        return messages;
    }
    let end = firstIndex;
    while (end < messages.length && messages[end].role === 'assistant') {
        end += 1;
    }
    const background: AIChatMessage = {
        role: 'user',
        content: ['【此前已保存的 AI 分析，仅作背景，不代表用户已确认】', ...messages.slice(firstIndex, end).map((message) => message.content)].join('\n\n'),
    };
    return [...messages.slice(0, firstIndex), background, ...messages.slice(end)];
}

export async function buildRequestBundle(
    result: PanResult | BaziResult | ZiweiRecordResult,
    chatHistory: PersistedAIChatMessage[],
    formatterContext?: BaziFormatterContext | ZiweiFormatterContext,
    requestContext: AIRequestBuildContext = {},
): Promise<AIRequestBundle> {
    const bundle = await buildRawRequestBundle(result, chatHistory, formatterContext, requestContext);
    const messages = ensureUserFirst(bundle.messages);
    return messages === bundle.messages ? bundle : {
        ...bundle,
        messages,
        debugMeta: bundle.debugMeta ? { ...bundle.debugMeta, messageCount: messages.length } : bundle.debugMeta,
    };
}

async function buildRawRequestBundle(
    result: PanResult | BaziResult | ZiweiRecordResult,
    chatHistory: PersistedAIChatMessage[],
    formatterContext?: BaziFormatterContext | ZiweiFormatterContext,
    requestContext: AIRequestBuildContext = {},
): Promise<AIRequestBundle> {
    if (!isBaziResult(result) && !isZiweiResult(result)) {
        const isFollowup = requestContext.workflowStage === 'followup';
        const stage = isFollowup ? 'followup' as const : 'initial' as const;
        const messages = [
            await buildSystemMessage(result),
            { role: 'system' as const, content: renderSkillRequest('liuyao', stage) },
            ...toApiMessages(chatHistory),
        ];
        return {
            messages,
            debugMeta: {
                mode: 'liuyao',
                requestType: 'main',
                skills: getSkillVersions('liuyao', isFollowup ? 'followup' : 'initial'),
                usedDynamicEvidencePack: false,
                usedDigest: false,
                systemCharCount: messages[0]?.content.length || 0,
                messageCount: messages.length,
            },
        };
    }

    if (isBaziResult(result)) {
        const stage = requestContext.workflowStage ?? 'foundation';
        const state = getCurrentKinshipVerification(result);
        const context = mergeBaziFormatterContext(result.aiContextSnapshot, formatterContext as BaziFormatterContext | undefined);
        const effectiveContext = isKinshipResponseKind(stage) && state
            ? { ...context, ganZhiRelationSettings: state.relationSettings } : context;
        const asOf = requestContext.asOf ?? new Date();
        const pack = buildBaziAIEvidencePack(result, effectiveContext, asOf,
            resolveBaziEvidenceRequest(result, stage, asOf, chatHistory, effectiveContext));
        const systemMessage = await buildBaziSystemMessage(result, effectiveContext, pack, stage);
        const history = getBaziWorkflowVersion(result) === 2 ? getBaziRequestHistory(chatHistory, stage) : chatHistory;
        const stageHistory = stage === 'five_year' ? history.map((message, index) => index === history.length - 1 && message.role === 'user'
            ? { ...message, content: buildBaziFiveYearPrompt(new Date(pack.asOf)), requestContent: undefined } : message) : history;
        const digest = stage === 'followup' ? result.aiConversationDigest : undefined;
        const messages: AIChatMessage[] = [
            systemMessage,
            ...(digest ? [{ role: 'system' as const, content: buildBaziDigestText(digest) }] : []),
            ...toApiMessages(stageHistory),
        ];
        return {
            messages,
            baziEvidencePack: pack,
            debugMeta: {
                mode: 'bazi',
                requestType: 'main',
                skills: getSkillVersions('bazi', stage, getBaziWorkflowVersion(result)),
                workflowStage: requestContext.workflowStage,
                usedDynamicEvidencePack: true,
                usedDigest: Boolean(digest),
                systemCharCount: systemMessage.content.length,
                messageCount: messages.length,
                evidenceScope: pack.scope, evidenceYears: pack.coverage.years, evidenceMonthYears: pack.coverage.monthYears,
                baselineRevisions: getBaziStageBaselines(chatHistory).map(({ stage, revision }) => ({ stage, revision })),
            },
        };
    }

    if (isKinshipResponseKind(requestContext.workflowStage)) throw new Error('紫微会话不支持六亲初验阶段');
    const workflowStage = requestContext.workflowStage || (result.aiConversationDigest ? 'followup' : 'foundation');
    const asOf = requestContext.asOf ?? new Date();
    const stageHistory = workflowStage === 'five_year' ? chatHistory.map((message, index) => index === chatHistory.length - 1 && message.role === 'user'
        ? { ...message, content: buildZiweiFiveYearPrompt(result, asOf), requestContent: undefined } : message) : chatHistory;
    const digest = result.aiConversationDigest ? normalizeZiweiDigestState(result.aiConversationDigest) : null;
    const systemBundle = buildZiweiSystemBundle(result, workflowStage, formatterContext as ZiweiFormatterContext, {
        usedDigest: Boolean(digest),
        requestType: 'main',
        asOf,
    });
    const ziweiDebugMeta = systemBundle.debugMeta!;
    if (digest) {
        const messages: AIChatMessage[] = [
            ...systemBundle.messages,
            { role: 'system', content: buildZiweiDigestText(digest) },
            ...toApiMessages(stageHistory.filter((message, index) => !message.hidden || index === stageHistory.length - 1).slice(-10)),
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

    const messages: AIChatMessage[] = [...systemBundle.messages, ...toApiMessages(stageHistory)];
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
    signal: AbortSignal | undefined,
    requestOptions: AIRequestOptions,
): Promise<AIAnalysisResult> {
    const stage = requestOptions.stage || 'stream';
    if (!Array.isArray(messages) || messages.length === 0) {
        void recordDiagnosticLog({
            level: 'warn',
            source: 'AI:streamDecision',
            message: 'invalid_messages',
            context: {
                decision: 'invalid_messages',
                stage,
                messageCount: Array.isArray(messages) ? messages.length : 'not_array',
            },
        });
        return {
            success: false,
            error: 'AI 请求缺少消息内容，请重新发起分析。',
            code: 'invalid_response',
            stage,
            recoverable: true,
            usedFallback: false,
        };
    }

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

    let fullContent = '';
    const requestMeta = {
        mode: requestOptions.debugMeta?.mode,
        requestType: requestOptions.debugMeta?.requestType,
        workflowStage: requestOptions.debugMeta?.workflowStage,
        stage,
        model: requestOptions.runtime.config.model,
        messageCount: requestOptions.debugMeta?.messageCount ?? messages.length,
        systemCharCount: requestOptions.debugMeta?.systemCharCount ?? (messages.find((item) => item.role === 'system')?.content.length || 0),
    };
    logAIRequestDebug({ ...requestOptions.debugMeta, ...requestMeta });
    const response = await streamProviderText(requestOptions.runtime, messages, {
        stage,
        requestType: requestOptions.debugMeta?.requestType ?? 'main',
        skills: requestOptions.skills,
        signal,
        onReasoning: requestOptions.onReasoning,
        onChunk: (chunk) => {
            fullContent += chunk;
            onChunk(chunk);
        },
    });
    const result: AIAnalysisResult = response.success && response.content
        ? { success: true, content: response.content, executionMeta: response.meta.executionMeta }
        : {
            success: false,
            executionMeta: response.meta.executionMeta,
            error: response.error || '模型请求失败',
            code: response.code ?? 'network_error',
            stage,
            recoverable: true,
            usedFallback: false,
            content: response.content,
        };
    const decision = result.success
        ? 'provider_completed'
        : (result.code === 'token_limit' ? 'token_limit' : 'provider_failed');
    void recordDiagnosticLog({
        level: result.success ? 'info' : 'warn',
        source: 'AI:streamDecision',
        message: decision,
        context: {
            decision,
            success: result.success,
            code: result.code,
            contentChars: fullContent.length,
            contentTrimmedChars: fullContent.trim().length,
            ...requestMeta,
            ...response.meta,
            errorMessage: result.error,
        },
    });
    return result;
}

export async function generateBaziConversationDigest(
    result: BaziResult,
    chatHistory: PersistedAIChatMessage[],
    runtime: AIRequestRuntime,
    signal?: AbortSignal,
): Promise<AIArtifactResult<BaziAIConversationDigest | null>> {
    const previousDigest = result.aiConversationDigest;
    const baseContext = previousDigest
        ? `【已有摘要】\n${buildBaziDigestText(previousDigest)}`
        : `【命盘底稿】\n${JSON.stringify(buildBaziAIEvidencePack(result, result.aiContextSnapshot, undefined, { scope: 'natal' }).facts.filter((fact) => fact.scope === 'natal'))}`;
    const conversationSummary = getBaziWorkflowVersion(result) === 2
        ? getBaziRequestHistory(chatHistory, 'followup').map((message) => `${message.role}：${message.content}`).join('\n')
        : summarizeMessages(chatHistory);
    const completion = await requestChatCompletion([
        {
            role: 'system',
            content: composeSkillInstructions('bazi', 'digest'),
        },
        {
            role: 'user',
            content: renderSkillRequest('bazi', 'digest', { baseContext, conversationSummary,
                kinshipContext: buildKinshipContext(getCurrentKinshipVerification(result)), outputContract: JSON.stringify(BAZI_DIGEST_OUTPUT) }),
        },
    ], { runtime, signal, stage: 'bazi_digest', skills: getSkillVersions('bazi', 'digest') });

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
    runtime: AIRequestRuntime,
    signal?: AbortSignal,
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
            content: composeSkillInstructions('ziwei', 'digest'),
        },
        {
            role: 'user',
            content: renderSkillRequest('ziwei', 'digest', { baseContext, conversationSummary, outputContract: JSON.stringify(ZIWEI_DIGEST_OUTPUT) }),
        },
    ];
    const completion = await requestChatCompletion(digestMessages, {
        runtime, signal,
        stage: 'ziwei_digest',
        skills: getSkillVersions('ziwei', 'digest'),
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
    runtime: AIRequestRuntime,
    signal?: AbortSignal,
): Promise<AIArtifactResult<string[]>> {
    if (isBaziResult(result)) {
        const digestText = result.aiConversationDigest
            ? buildBaziDigestText(result.aiConversationDigest)
            : '暂无既有摘要，请围绕基础诊断与后续高价值追问生成短句。';
        const recentFocus = getLastVisibleUserContent(chatHistory) || '基础诊断';
        const completion = await requestChatCompletion([
            {
                role: 'system',
                content: composeSkillInstructions('bazi', 'quick_replies'),
            },
            {
                role: 'user',
                content: renderSkillRequest('bazi', 'quick_replies', { digestText, recentFocus,
                    kinshipContext: buildKinshipContext(getCurrentKinshipVerification(result)) }),
            },
        ], { runtime, signal, stage: 'bazi_quick_replies', skills: getSkillVersions('bazi', 'quick_replies') });

        const parsed = completion.success && completion.content ? parseQuickReplyLines(completion.content) : [];
        const containsKinshipCheck = parsed.some((line) => /六亲|独生|手足|兄弟|姐妹|哥哥|姐姐|弟弟|妹妹|排行|老大|老二/u.test(line));
        if (parsed.length === 3 && !containsKinshipCheck) {
            return { value: parsed };
        }

        const outcome = {
            value: BAZI_FALLBACK_QUICK_REPLIES,
            failure: completion.failure
                ? { ...completion.failure, usedFallback: true }
                : createAIFailure(
                    'invalid_response',
                    'bazi_quick_replies',
                    containsKinshipCheck ? '快捷追问越界重复核验家庭情况，已使用默认问题' : '八字快捷追问返回格式无效',
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
                content: composeSkillInstructions('ziwei', 'quick_replies'),
            },
            {
                role: 'user',
                content: renderSkillRequest('ziwei', 'quick_replies', { digestText, recentFocus }),
            },
        ];
        const completion = await requestChatCompletion(quickReplyMessages, {
            runtime, signal,
            stage: 'ziwei_quick_replies',
            skills: getSkillVersions('ziwei', 'quick_replies'),
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
        return { value: getLocalLiuyaoQuickReplies(result) };
    }

    const systemMsg: AIChatMessage = { role: 'system', content: composeSkillInstructions('liuyao', 'quick_replies') + '\n' + formatPanForAI(result) };
    const instruction: AIChatMessage = {
        role: 'user',
        content: renderSkillRequest('liuyao', 'quick_replies', { question: result.question, outputContract: JSON.stringify(LIUYAO_QUICK_REPLIES_OUTPUT) }),
    };

    const content = await requestChatCompletion(
        [systemMsg, ...toApiMessages(chatHistory), instruction],
        { runtime, signal, stage: 'liuyao_quick_replies' },
    );
    if (!content.success || !content.content) {
        const outcome = {
            value: getLocalLiuyaoQuickReplies(result),
            failure: content.failure ? { ...content.failure, usedFallback: true } : undefined,
        };
        logAIFailure('liuyao_quick_replies', outcome.failure);
        return outcome;
    }

    const parsed = parseJsonPayload(content.content);
    const outcome = {
        value: parsed && Array.isArray(parsed.quickReplies)
            ? parsed.quickReplies.filter((item): item is string => typeof item === 'string')
            : getLocalLiuyaoQuickReplies(result),
        failure: parsed && Array.isArray(parsed.quickReplies)
            ? undefined
            : createAIFailure('invalid_response', 'liuyao_quick_replies', '六爻快捷追问返回格式无效', { usedFallback: true }),
    };
    if (outcome.failure) {
        logAIFailure('liuyao_quick_replies', outcome.failure);
    }
    return outcome;
}
