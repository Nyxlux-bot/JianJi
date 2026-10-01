import common from './skills/common/SKILL.md';
import retry from './skills/common/references/retry.md';
import auxiliary from './skills/common/references/auxiliary.md';
import liuyao from './skills/liuyao/SKILL.md';
import liuyaoInitial from './skills/liuyao/references/initial.md';
import liuyaoFollowup from './skills/liuyao/references/followup.md';
import liuyaoCompletion from './skills/liuyao/references/completion.md';
import liuyaoQuick from './skills/liuyao/references/quick_replies.md';
import bazi from './skills/bazi/SKILL.md';
import baziSystem from './skills/bazi/references/system.md';
import baziFoundation from './skills/bazi/references/foundation.md';
import baziVerification from './skills/bazi/references/verification.md';
import baziFiveYear from './skills/bazi/references/five_year.md';
import baziFollowup from './skills/bazi/references/followup.md';
import baziKinship from './skills/bazi/references/kinship.md';
import baziKinshipBoundary from './skills/bazi/references/kinship-boundary.md';
import baziKinshipMethods from './skills/bazi/references/kinship-mangpai.md';
import baziEvidenceFormat from './skills/bazi/references/evidence-format.md';
import baziEvidenceMethods from './skills/bazi/references/evidence-methods.md';
import baziDigest from './skills/bazi/references/digest.md';
import baziQuick from './skills/bazi/references/quick_replies.md';
import ziwei from './skills/ziwei/SKILL.md';
import ziweiSystem from './skills/ziwei/references/system.md';
import ziweiFoundation from './skills/ziwei/references/foundation.md';
import ziweiVerification from './skills/ziwei/references/verification.md';
import ziweiFiveYear from './skills/ziwei/references/five_year.md';
import ziweiFollowup from './skills/ziwei/references/followup.md';
import ziweiDigest from './skills/ziwei/references/digest.md';
import ziweiQuick from './skills/ziwei/references/quick_replies.md';
import compatibility from './skills/bazi-compatibility/SKILL.md';
import compatibilityInitial from './skills/bazi-compatibility/references/initial.md';

export type AISkillEngine = 'liuyao' | 'bazi' | 'ziwei' | 'baziCompatibility';
export type AISkillStage = 'initial' | 'foundation' | 'kinship' | 'kinship_review' | 'verification' | 'five_year' | 'followup' | 'digest' | 'quick_replies' | 'retry';
export interface AISkillDefinition {
    id: string;
    version: number;
    instructions: string;
    requests: Partial<Record<AISkillStage, string>>;
    system?: string;
}
export const COMMON_SKILL: AISkillDefinition = { id: 'jianji-common', version: 3, instructions: common, requests: { retry }, system: auxiliary };
export const AI_SKILLS: Record<AISkillEngine, AISkillDefinition> = {
    liuyao: { id: 'jianji-liuyao', version: 3, instructions: liuyao, requests: { initial: liuyaoInitial, followup: liuyaoFollowup, quick_replies: liuyaoQuick } },
    bazi: { id: 'jianji-bazi', version: 9, instructions: bazi, system: baziSystem,
        requests: { foundation: baziFoundation, kinship: baziKinship, verification: baziVerification, five_year: baziFiveYear, followup: baziFollowup, digest: baziDigest, quick_replies: baziQuick } },
    ziwei: { id: 'jianji-ziwei', version: 4, instructions: ziwei, system: ziweiSystem,
        requests: { foundation: ziweiFoundation, verification: ziweiVerification, five_year: ziweiFiveYear, followup: ziweiFollowup, digest: ziweiDigest, quick_replies: ziweiQuick } },
    baziCompatibility: { id: 'jianji-bazi-compatibility', version: 3, instructions: compatibility, requests: { initial: compatibilityInitial } },
};
export const SKILL_REFERENCES = { liuyaoCompletion, baziKinshipBoundary, baziKinshipMethods, baziEvidenceFormat, baziEvidenceMethods };
