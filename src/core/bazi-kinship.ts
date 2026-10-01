import type { BaziAIEvidenceItem, BaziAIEvidencePack } from './bazi-ai-evidence';
import { getBaziBirthSignature } from './bazi-ai-identity';
import { normalizeGanZhiRelationSettings, type GanZhiRelationSettings } from './bazi-ganzhi-relation-engine';
import type { BaziResult } from './bazi-types';

export const MAX_KINSHIP_ATTEMPTS = 1;
const MAX_STORED_KINSHIP_ATTEMPTS = 3;
export const KINSHIP_FEEDBACK_ID = 'family';
export type KinshipResponseKind = 'kinship' | 'kinship_review';
export type KinshipFeedback = 'matched' | 'mismatched' | 'unknown';
export const KINSHIP_FEEDBACK_LABELS: Record<KinshipFeedback, string> = {
    matched: '吻合', mismatched: '不符', unknown: '不清楚',
};
export const KINSHIP_ACTUAL_FIELDS = {
    siblings: '已知兄弟姐妹情况', birthOrder: '已知出生顺序',
    circumstances: '早夭、失散、送养或成长家庭情况', unknowns: '暂不清楚的信息',
} as const;
export type KinshipActualField = keyof typeof KINSHIP_ACTUAL_FIELDS;
export type KinshipActualFacts = Record<KinshipActualField, string>;

export const KINSHIP_SIBLING_LABELS = {
    olderBrothers: '哥哥', olderSisters: '姐姐', youngerBrothers: '弟弟', youngerSisters: '妹妹',
} as const;
export type KinshipSiblingKind = keyof typeof KINSHIP_SIBLING_LABELS;

export interface KinshipPrediction {
    kind: 'kinship';
    family: {
        onlyChild: boolean | null;
        birthOrder: number | null;
        siblings: Record<KinshipSiblingKind, number | null>;
        evidenceIds: string[];
        basis: string;
    };
}

export interface KinshipReview {
    kind: 'kinship_review';
    items: Array<{
        field: KinshipActualField;
        assessment: 'supported' | 'conflicting' | 'insufficient';
        explanation: string;
        evidenceIds: string[];
    }>;
    limitations: string;
}

export type KinshipResponse = KinshipPrediction | KinshipReview;

export interface BaziKinshipAttempt {
    id: string;
    createdAt: string;
    prediction: KinshipPrediction;
    evidence: BaziAIEvidenceItem[];
    feedback: Record<string, KinshipFeedback>;
}

export interface BaziKinshipVerification {
    version: 2;
    birthSignature: string;
    relationSettings: GanZhiRelationSettings;
    attempts: BaziKinshipAttempt[];
    actualFeedback?: KinshipActualFacts;
    review?: { id: string; createdAt: string; result: KinshipReview; evidence: BaziAIEvidenceItem[] };
    confirmation?: { mode: 'prediction' | 'feedback'; responseId: string; confirmedAt: string };
}

function object(value: unknown, label: string): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label}须为对象`);
    return value as Record<string, unknown>;
}

function string(value: unknown, label: string, allowEmpty = false): string {
    if (typeof value !== 'string' || (!allowEmpty && !value.trim())) throw new Error(`${label}缺少文字`);
    return value.trim();
}

function array(value: unknown, label: string): unknown[] {
    if (!Array.isArray(value)) throw new Error(`${label}须为数组`);
    return value;
}

function evidenceIds(value: unknown, ids: Set<string>, required: boolean): string[] {
    const refs = array(value, 'evidenceIds').map((id) => string(id, '盘据 ID'));
    if (required && refs.length === 0) throw new Error('明确判断必须引用盘据');
    if (refs.some((id) => !ids.has(id))) throw new Error('六亲回复引用了本轮未提供的盘据 ID');
    return [...new Set(refs)];
}

function readCount(value: unknown, label: string, minimum = 0): number | null {
    if (value === null) return null;
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) throw new Error(`${label}须为整数或 null`);
    return value;
}

function readPrediction(value: unknown, ids: Set<string>): KinshipPrediction {
    const payload = object(value, '六亲初验');
    if (payload.kind !== 'kinship') throw new Error('六亲初验响应类型不正确');
    if (Object.keys(payload).some((key) => key !== 'kind' && key !== 'family')) throw new Error('六亲初验只接受手足与排行判断，不接受额外条目');
    const family = object(payload.family, '手足与排行');
    if (family.onlyChild !== true && family.onlyChild !== false && family.onlyChild !== null) throw new Error('独生判断须为 true、false 或 null');
    const birthOrder = readCount(family.birthOrder, '家中排行', 1);
    const rawSiblings = object(family.siblings, '手足人数');
    const siblings: KinshipPrediction['family']['siblings'] = {
        olderBrothers: readCount(rawSiblings.olderBrothers, '哥哥人数'),
        olderSisters: readCount(rawSiblings.olderSisters, '姐姐人数'),
        youngerBrothers: readCount(rawSiblings.youngerBrothers, '弟弟人数'),
        youngerSisters: readCount(rawSiblings.youngerSisters, '妹妹人数'),
    };
    const counts = Object.values(siblings);
    if (family.onlyChild === true && (birthOrder !== 1 || counts.some((count) => count !== 0))) throw new Error('独生须排行第一且没有兄弟姐妹');
    if (family.onlyChild !== true && counts.every((count) => count === 0)) throw new Error('认定没有兄弟姐妹时，独生判断须一致');
    if ((counts.some((count) => count !== null && count > 0) || (birthOrder !== null && birthOrder > 1)) && family.onlyChild !== false) throw new Error('手足人数或排行与独生判断矛盾');
    const knownOlder = (siblings.olderBrothers ?? 0) + (siblings.olderSisters ?? 0);
    if (birthOrder !== null && (birthOrder <= knownOlder
        || (siblings.olderBrothers !== null && siblings.olderSisters !== null && birthOrder !== knownOlder + 1))) {
        throw new Error('家中排行与哥哥姐姐人数矛盾');
    }
    const determined = family.onlyChild !== null || birthOrder !== null || counts.some((count) => count !== null);
    return { kind: 'kinship', family: {
        onlyChild: family.onlyChild, birthOrder, siblings,
        evidenceIds: evidenceIds(family.evidenceIds, ids, determined),
        basis: string(family.basis, '判断依据'),
    } };
}

/** 旧记录只迁移结构化判断，不从长篇解释中猜测手足性别或人数。 */
function readLegacyPrediction(value: unknown, ids: Set<string>): KinshipPrediction {
    const payload = object(value, '旧六亲初验');
    if (payload.kind !== 'kinship') throw new Error('旧六亲初验类型不正确');
    const siblings = object(payload.siblings, '旧手足判断');
    const order = object(payload.birthOrder, '旧出生序位');
    if (siblings.value !== 'only_child' && siblings.value !== 'has_siblings' && siblings.value !== 'unknown') throw new Error('旧手足判断无效');
    const count = siblings.value === 'only_child' ? 0 : null;
    return readPrediction({ kind: 'kinship', family: {
        onlyChild: siblings.value === 'unknown' ? null : siblings.value === 'only_child',
        birthOrder: order.value,
        siblings: { olderBrothers: count, olderSisters: count, youngerBrothers: count, youngerSisters: count },
        evidenceIds: [...evidenceIds(siblings.evidenceIds, ids, siblings.value !== 'unknown'), ...evidenceIds(order.evidenceIds, ids, order.value !== null)],
        basis: [string(siblings.statement, '旧手足说明'), string(order.statement, '旧排行说明')].join('\n'),
    } }, ids);
}

function readActualFacts(value: unknown): KinshipActualFacts {
    const facts = object(value, '用户实际情况');
    const normalized: KinshipActualFacts = {
        siblings: string(facts.siblings, '已知兄弟姐妹情况', true),
        birthOrder: string(facts.birthOrder, '已知出生顺序', true),
        circumstances: string(facts.circumstances, '特殊情况', true),
        unknowns: string(facts.unknowns, '未知信息', true),
    };
    if (!Object.values(normalized).some(Boolean)) throw new Error('请至少填写一项已知情况或不清楚的信息');
    return normalized;
}

function readReview(value: unknown, ids: Set<string>, actual?: KinshipActualFacts): KinshipReview {
    const payload = object(value, '六亲反馈复核');
    if (payload.kind !== 'kinship_review') throw new Error('六亲反馈复核响应类型不正确');
    const items = array(payload.items, '复核条目').map((entry) => {
        const item = object(entry, '复核条目');
        if (item.field !== 'siblings' && item.field !== 'birthOrder' && item.field !== 'circumstances' && item.field !== 'unknowns') {
            throw new Error('复核条目须对应用户反馈字段');
        }
        if (item.assessment !== 'supported' && item.assessment !== 'conflicting' && item.assessment !== 'insufficient') {
            throw new Error('复核须区分支持、冲突和依据不足');
        }
        return {
            field: item.field, assessment: item.assessment,
            explanation: string(item.explanation, '复核说明'),
            evidenceIds: evidenceIds(item.evidenceIds, ids, item.assessment !== 'insufficient'),
        } satisfies KinshipReview['items'][number];
    });
    if (items.length === 0 || new Set(items.map((item) => item.field)).size !== items.length) throw new Error('复核条目缺失或重复');
    if (actual && Object.entries(actual).some(([field, value]) => value && !items.some((item) => item.field === field))) {
        throw new Error('复核未覆盖用户填写的全部情况');
    }
    return { kind: 'kinship_review', items, limitations: string(payload.limitations, '复核边界说明') };
}

export function isKinshipResponseKind(kind: unknown): kind is KinshipResponseKind {
    return kind === 'kinship' || kind === 'kinship_review';
}

export function parseKinshipResponse(content: string, kind: KinshipResponseKind, pack: BaziAIEvidencePack, actual?: KinshipActualFacts): KinshipResponse {
    // 只在 JSON 系统边界捕获解析错误，不从残缺正文中猜测成功结果。
    let value: unknown;
    try { value = JSON.parse(content.trim()); } catch { throw new Error('六亲回复不是完整 JSON，请手动重试；本次不计入推断次数'); }
    const ids = new Set(pack.facts.filter((fact) => kind === 'kinship' ? fact.scope === 'natal' : fact.scope !== 'reference').map((fact) => fact.id));
    return kind === 'kinship' ? readPrediction(value, ids) : readReview(value, ids, actual);
}

export function formatKinshipSummary(prediction: KinshipPrediction): string {
    const { onlyChild, birthOrder, siblings } = prediction.family;
    if (onlyChild === true) return '是独生子女。';
    if (onlyChild === null && birthOrder === null) return '是否独生及家中排行暂时看不准。';
    const lines = [onlyChild === false ? '不是独生子女' : '是否独生暂时看不准'];
    lines.push(birthOrder === null ? '排行暂时看不准' : birthOrder === 1 ? '家里排行第一' : `家里排行第${birthOrder}`);
    const details = (Object.keys(KINSHIP_SIBLING_LABELS) as KinshipSiblingKind[]).flatMap((key) => {
        const count = siblings[key];
        return count !== null && count > 0 ? [`${count}个${KINSHIP_SIBLING_LABELS[key]}`] : [];
    });
    if (details.length) lines.push(`有${details.join('、')}`);
    return lines.join('，') + '。';
}

export function canConfirmKinshipAttempt(attempt?: BaziKinshipAttempt): boolean {
    return Boolean(attempt
        && attempt.prediction.family.onlyChild !== null
        && attempt.prediction.family.birthOrder !== null
        && attempt.feedback[KINSHIP_FEEDBACK_ID] === 'matched');
}

export function getCurrentKinshipVerification(result: BaziResult): BaziKinshipVerification | undefined {
    const state = result.aiKinshipVerification;
    return state?.birthSignature === getBaziBirthSignature(result) ? state : undefined;
}

export function isKinshipConfirmed(state?: BaziKinshipVerification): boolean {
    const confirmation = state?.confirmation;
    if (!state || !confirmation) return false;
    if (confirmation.mode === 'feedback') return state.review?.id === confirmation.responseId && Boolean(state.actualFeedback);
    const latest = state.attempts[state.attempts.length - 1];
    return latest?.id === confirmation.responseId && canConfirmKinshipAttempt(latest);
}

export function withKinshipFeedback(state: BaziKinshipVerification, claimId: string, feedback: KinshipFeedback): BaziKinshipVerification {
    const latest = state.attempts[state.attempts.length - 1];
    if (!latest || claimId !== KINSHIP_FEEDBACK_ID) throw new Error('六亲核验项目已变化');
    if (feedback === 'matched' && (latest.prediction.family.onlyChild === null || latest.prediction.family.birthOrder === null)) throw new Error('尚未给出明确的手足与排行判断，不能标记吻合');
    return {
        ...state, confirmation: undefined,
        attempts: state.attempts.map((attempt) => attempt.id === latest.id
            ? { ...attempt, feedback: { ...attempt.feedback, [claimId]: feedback } } : attempt),
    };
}

export function withKinshipActualFeedback(state: BaziKinshipVerification, actual: KinshipActualFacts): BaziKinshipVerification {
    return { ...state, actualFeedback: readActualFacts(actual), review: undefined, confirmation: undefined };
}

export function confirmKinshipVerification(state: BaziKinshipVerification): BaziKinshipVerification {
    const latest = state.attempts[state.attempts.length - 1];
    if (state.review && state.actualFeedback) {
        return { ...state, confirmation: { mode: 'feedback', responseId: state.review.id, confirmedAt: new Date().toISOString() } };
    }
    if (!canConfirmKinshipAttempt(latest)) throw new Error('请先确认手足与排行判断');
    return { ...state, confirmation: { mode: 'prediction', responseId: latest.id, confirmedAt: new Date().toISOString() } };
}

export function appendKinshipResponse(state: BaziKinshipVerification | undefined, response: KinshipResponse, pack: BaziAIEvidencePack, id: string): BaziKinshipVerification {
    const current: BaziKinshipVerification = state ?? { version: 2, birthSignature: pack.birthSignature, relationSettings: pack.relationSettings, attempts: [] };
    if (current.birthSignature !== pack.birthSignature) throw new Error('出生盘据已变化，请重新开始分析');
    const refs = response.kind === 'kinship' ? response.family.evidenceIds : response.items.flatMap((item) => item.evidenceIds);
    const evidence = pack.facts.filter((fact) => refs.includes(fact.id));
    const createdAt = new Date().toISOString();
    if (response.kind === 'kinship_review') {
        if (!current.actualFeedback || current.attempts.length === 0) throw new Error('缺少初验记录或实际情况反馈');
        return { ...current, review: { id, createdAt, result: response, evidence }, confirmation: undefined };
    }
    if (current.attempts.length >= MAX_KINSHIP_ATTEMPTS || current.actualFeedback || isKinshipConfirmed(current)) throw new Error('六亲初验不能继续增加轮次');
    return { ...current, attempts: [...current.attempts, { id, createdAt, prediction: response, evidence, feedback: {} }] };
}

export function formatKinshipResponse(response: KinshipResponse, evidence: BaziAIEvidenceItem[]): string {
    const labels = new Map(evidence.map((fact) => [fact.id, fact.label]));
    const refs = (ids: string[]) => ids.length ? ids.map((id) => labels.get(id) ?? id).join('；') : '目前没有充分盘据';
    if (response.kind === 'kinship_review') {
        const assessment = { supported: '有相关盘据', conflicting: '存在冲突', insufficient: '依据不足' };
        return ['## 六亲反馈复核', '以下实际情况来自用户反馈，不计作 AI 首次推断命中。', ...response.items.map((item) =>
            `### ${KINSHIP_ACTUAL_FIELDS[item.field]} · ${assessment[item.assessment]}\n${item.explanation}\n\n盘据：${refs(item.evidenceIds)}`), response.limitations].join('\n\n');
    }
    return `## 六亲初验\n\n${formatKinshipSummary(response)}\n\n${response.family.basis}`;
}

export function buildKinshipContext(state?: BaziKinshipVerification): string {
    if (!state) return '用户未提供家庭情况，六亲初验为可选项；不得推定家庭事实，也不得要求补做初验才能继续。';
    return JSON.stringify({
        note: 'actualFeedback 是用户自述，优先于 AI 推断和旧摘要；unknowns 仅表示未知。prediction 是历史假设，只有用户明确标为 matched 的结论可按用户确认引用，mismatched 须弃用，unknown 或无反馈不能作为事实。反馈后的解释不计为预测命中。结合原局与本轮岁运分析反馈，不得改动四柱、杜撰事件或为迎合反馈强改用忌；与旧结论冲突时明确修订依据和局限。无需额外六亲复核或确认即可继续当前阶段。',
        attempts: state.attempts.map(({ prediction, feedback }, index) => ({
            round: index + 1, prediction, feedback,
            usage: feedback[KINSHIP_FEEDBACK_ID] === 'mismatched' ? '用户已否定，仅保留历史，不得作为后续事实'
                : state.actualFeedback ? '历史推断，须以用户填写的实际情况为准，冲突部分弃用'
                    : feedback[KINSHIP_FEEDBACK_ID] === 'matched' ? '用户认可本次手足与排行判断，不代表其他事件也已核实'
                        : '尚未核实，不得作为用户事实',
        })),
        actualFeedback: state.actualFeedback ?? null, review: state.review?.result ?? null,
        confirmation: state.confirmation ?? null,
    });
}

/** 导入和持久化边界：不能让损坏的反馈结构被推断成“已通过”。 */
export function normalizeKinshipVerification(value: unknown): BaziKinshipVerification | undefined {
    if (value === undefined || value === null) return undefined;
    const source = object(value, '六亲核验记录');
    if (source.version !== 1 && source.version !== 2) throw new Error('不支持的六亲核验记录版本');
    const readEvidence = (input: unknown) => array(input, '保存的盘据').map((entry) => {
        const item = object(entry, '保存的盘据');
        if (item.scope !== 'natal' && item.scope !== 'fortune' && item.scope !== 'context' && item.scope !== 'reference') throw new Error('盘据范围无效');
        return { id: string(item.id, '盘据 ID'), label: string(item.label, '盘据名称'), scope: item.scope, value: item.value } satisfies BaziAIEvidenceItem;
    });
    const attempts = array(source.attempts, '六亲推断记录').map((entry) => {
        const item = object(entry, '六亲推断记录');
        const evidence = readEvidence(item.evidence);
        const ids = new Set(evidence.filter((fact) => fact.scope === 'natal').map((fact) => fact.id));
        const prediction = source.version === 1 ? readLegacyPrediction(item.prediction, ids) : readPrediction(item.prediction, ids);
        const feedbackSource = object(item.feedback, '逐项反馈');
        const feedback: Record<string, KinshipFeedback> = {};
        const legacyClues = source.version === 1
            ? array(object(item.prediction, '旧六亲判断').clues, '旧线索').map((entry) => {
                const clue = object(entry, '旧线索');
                const id = string(clue.id, '旧线索 ID');
                if (!/^clue_[a-z0-9_]+$/.test(id)) throw new Error('旧线索 ID 无效');
                evidenceIds(clue.evidenceIds, ids, true);
                return id;
            }) : [];
        if (legacyClues.length > 6 || new Set(legacyClues).size !== legacyClues.length) throw new Error('旧线索记录无效');
        const keys = new Set(source.version === 1 ? ['siblings', 'birthOrder', ...legacyClues] : [KINSHIP_FEEDBACK_ID]);
        Object.entries(feedbackSource).forEach(([key, status]) => {
            if (!keys.has(key) || (status !== 'matched' && status !== 'mismatched' && status !== 'unknown')) throw new Error('六亲逐项反馈无效');
            feedback[key] = status;
        });
        let combinedFeedback = feedback;
        if (source.version === 1) {
            // 被否定的旧线索不能因界面简化而自动变成“已通过”。
            const status = Object.values(feedback).includes('mismatched') ? 'mismatched'
                : feedback.siblings === 'matched' && feedback.birthOrder === 'matched' && legacyClues.every((id) => feedback[id] !== undefined)
                    ? 'matched' : Object.values(feedback).includes('unknown') ? 'unknown' : undefined;
            combinedFeedback = status ? { [KINSHIP_FEEDBACK_ID]: status } : {};
        }
        return { id: string(item.id, '推断 ID'), createdAt: string(item.createdAt, '推断时间'), prediction, evidence, feedback: combinedFeedback };
    });
    // 保留旧版最多三轮的记录；新请求只允许一次初验。
    if (attempts.length > MAX_STORED_KINSHIP_ATTEMPTS || new Set(attempts.map((attempt) => attempt.id)).size !== attempts.length) throw new Error('六亲推断轮次无效');
    const actualFeedback = source.actualFeedback === undefined ? undefined : readActualFacts(source.actualFeedback);
    const result: BaziKinshipVerification = {
        version: 2, birthSignature: string(source.birthSignature, '出生盘签名'),
        relationSettings: normalizeGanZhiRelationSettings(object(source.relationSettings, '关系设置')),
        attempts, actualFeedback,
    };
    if (source.review !== undefined) {
        if (!actualFeedback || attempts.length === 0) throw new Error('旧复核记录缺少初验或用户实际情况');
        const review = object(source.review, '复核记录');
        const evidence = readEvidence(review.evidence);
        result.review = {
            id: string(review.id, '复核 ID'), createdAt: string(review.createdAt, '复核时间'), evidence,
            result: readReview(review.result, new Set(evidence.filter((fact) => fact.scope !== 'reference').map((fact) => fact.id)), actualFeedback),
        };
    }
    if (source.confirmation !== undefined) {
        const confirmation = object(source.confirmation, '用户确认');
        if (confirmation.mode !== 'prediction' && confirmation.mode !== 'feedback') throw new Error('六亲确认方式无效');
        result.confirmation = { mode: confirmation.mode, responseId: string(confirmation.responseId, '确认对象'), confirmedAt: string(confirmation.confirmedAt, '确认时间') };
        if (!isKinshipConfirmed(result)) throw new Error('六亲确认与保存的核验结果不一致');
    }
    return result;
}
