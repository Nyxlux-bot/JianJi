import { PersistedAIChatMessage } from '../../../core/ai-meta';
import { BaziResult, ShiShenName } from '../../../core/bazi-types';
import { WuXing } from '../../../core/liuyao-data';
import type { BaziMatchClassicReferenceId } from './classic-references';

export type BaziMatchDimensionKey = 'harmony' | 'supportHusband' | 'supportWife' | 'offspring' | 'longevity';
/** 婚恋、合作、朋友、同事、亲子、手足 */
export type BaziMatchRelation = 'love' | 'biz' | 'friend' | 'work' | 'kin' | 'sib';
/** 同事、亲子的方向，从「我」看 */
export type BaziMatchDirection = 'superior' | 'peer' | 'subordinate' | 'parent' | 'child';
export type BaziMatchGrade = '优' | '良' | '中' | '差';
export type BaziMarriageYearKind = 'trigger' | 'recommendation';

export interface BaziMatchEvidence {
    label: string;
    detail: string;
    effect: 'positive' | 'negative' | 'neutral';
    referenceIds?: BaziMatchClassicReferenceId[];
}

export type BaziMatchEvidenceMatrixCategory =
    | 'bestFit'
    | 'mainConflict'
    | 'spouseStarPalace'
    | 'elementComplement'
    | 'relationImpact'
    | 'fortuneTiming'
    | 'marriageTiming'
    | 'riskPriority';

export type BaziMatchEvidenceDirection = 'positive' | 'negative' | 'neutral';
export type BaziMatchEvidenceStrength = 'high' | 'medium' | 'low';

export interface BaziMatchMatrixEntry {
    category: BaziMatchEvidenceMatrixCategory;
    title: string;
    direction: BaziMatchEvidenceDirection;
    strength: BaziMatchEvidenceStrength;
    detail: string;
    referenceIds?: BaziMatchClassicReferenceId[];
}

export interface BaziMatchReview {
    mainLine: string;
    canProceed: 'strong' | 'workable' | 'cautious' | 'difficult';
    scoreReview: string;
    bestFit: string;
    mainConflict: string;
    priorities: string[];
}

export interface BaziMatchDimensionScore {
    key: BaziMatchDimensionKey;
    title: string;
    score: number;
    grade: BaziMatchGrade;
    summary: string;
    evidence: BaziMatchEvidence[];
}

export interface BaziMarriageYearCandidate {
    year: number;
    ganZhi: string;
    kind: BaziMarriageYearKind;
    score: number;
    reasons: string[];
    maleAge?: number;
    femaleAge?: number;
    referenceIds?: BaziMatchClassicReferenceId[];
}

export interface BaziMarriageTimingCandidate {
    year: number;
    age: number;
    ganZhi: string;
    score: number;
    reasons: string[];
    referenceIds?: BaziMatchClassicReferenceId[];
}

export interface BaziMarriageTimingProfile {
    name: string;
    genderLabel: string;
    candidates: BaziMarriageTimingCandidate[];
}

export interface BaziMarriageTimingResult {
    male: BaziMarriageTimingProfile;
    female: BaziMarriageTimingProfile;
    summary: string;
}

export interface BaziMatchProfile {
    sourceId: string;
    name: string;
    gender: BaziResult['gender'];
    genderLabel: string;
    mingZaoLabel: string;
    fourPillars: BaziResult['fourPillars'];
    stems: [string, string, string, string];
    branches: [string, string, string, string];
    yearBranch: string;
    dayStem: string;
    dayBranch: string;
    hourBranch: string;
    mingGongBranch: string;
    zodiac: string;
    shenSha: string[];
    elementCounts: Record<WuXing, number>;
    neededElements: WuXing[];
    dominantElements: WuXing[];
    weakElements: WuXing[];
    starCounts: Partial<Record<ShiShenName, number>>;
    strength: 'weak' | 'balanced' | 'strong';
    futureDaYun: Array<{
        ganZhi: string;
        startYear: number;
        endYear: number;
        stemElement: WuXing;
        branchElement: WuXing;
    }>;
}

export interface BaziCompatibilityResult {
    id: string;
    createdAt: string;
    calculatedAt: string;
    male: BaziResult;
    female: BaziResult;
    maleProfile: BaziMatchProfile;
    femaleProfile: BaziMatchProfile;
    dimensions: BaziMatchDimensionScore[];
    totalScore: number;
    grade: BaziMatchGrade;
    summary: string;
    marriageYears: BaziMarriageYearCandidate[];
    marriageTiming?: BaziMarriageTimingResult;
    review?: BaziMatchReview;
    evidenceMatrix?: BaziMatchMatrixEntry[];
    aiAnalysis?: string;
    aiChatHistory?: PersistedAIChatMessage[];
    /** 关系类型；旧记录没有，按婚恋读 */
    relation?: BaziMatchRelation;
    direction?: BaziMatchDirection;
    /**
     * 「我」在 male 还是 female 槽位；旧记录没有，按 male 读。
     * 婚恋按男女落槽；其余关系两个槽位只是两个人，「我」固定在 male 槽，不分男女。
     */
    self?: 'male' | 'female';
}

export function getBaziMatchGrade(score: number): BaziMatchGrade {
    if (score >= 85) return '优';
    if (score >= 70) return '良';
    if (score >= 55) return '中';
    return '差';
}
