import type { BaziAIConversationDigest, ZiweiAIConversationDigest } from '../core/ai-meta';
import type { KinshipPrediction } from '../core/bazi-kinship';

export const BAZI_DIGEST_OUTPUT = {
    foundation: { dayMaster: '', structure: '', favorableGod: '', unfavorableGod: '', personality: '' },
    verificationSummary: '', fiveYearSummary: '', rollingSummary: '', topicNotes: { wealth: '', relationship: '', career: '' },
} satisfies Omit<BaziAIConversationDigest, 'version' | 'generatedAt'>;
export const ZIWEI_DIGEST_OUTPUT = {
    foundation: { lifeTheme: '', mingPalace: '', bodySoul: '', mutagenDynamics: '', personality: '' },
    verificationSummary: '', fiveYearSummary: '', rollingSummary: '', topicNotes: { wealth: '', relationship: '', career: '' },
    verificationTimeline: [], yearlyOutlook: {}, focusAnchors: {},
} satisfies Omit<ZiweiAIConversationDigest, 'version' | 'generatedAt'>;
export const KINSHIP_PREDICTION_OUTPUT = {
    kind: 'kinship', family: {
        onlyChild: null, birthOrder: null,
        siblings: { olderBrothers: null, olderSisters: null, youngerBrothers: null, youngerSisters: null },
        evidenceIds: [], basis: '简短说明实际支持判断的盘据；看不准的部分直说',
    },
} satisfies KinshipPrediction;
export const LIUYAO_QUICK_REPLIES_OUTPUT = { quickReplies: ['追问1', '追问2', '追问3'] };
