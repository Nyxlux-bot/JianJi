import {
    BaziAnalysisProfile,
    BaziBaseInfo,
    BaziCangGanGroup,
    BaziFourPillars,
    BaziSubject,
} from './bazi-types';
import { evaluateBaziRelationInteractions, BaziRelationState, BaziRelationType } from './bazi-relations';
import { buildWuXingBandFromMonthBranch } from './renyuan-duty';
import { DIZHI_WUXING, TIANGAN_WUXING, WuXing } from './liuyao-data';

export const BAZI_ANALYSIS_PROFILE_VERSION: BaziAnalysisProfile['version'] = 'bazi_school_analysis_v1';

type StemPolarity = '阴' | '阳';
type StrengthStatus = '旺' | '相' | '休' | '囚' | '死' | '—';
export interface BaziAnalysisInput {
    fourPillars: BaziFourPillars;
    cangGan: [BaziCangGanGroup, BaziCangGanGroup, BaziCangGanGroup, BaziCangGanGroup];
    baseInfo: BaziBaseInfo;
    subject: BaziSubject;
};

const YANG_STEMS = new Set(['甲', '丙', '戊', '庚', '壬']);
const SUPPORTIVE_STATUSES = new Set<StrengthStatus>(['旺', '相']);
const STRUCTURE_TEN_GODS = new Set(['比肩', '劫财', '食神', '伤官', '偏财', '正财', '七杀', '正官', '偏印', '正印']);
const ACTION_RELATIONS = new Set<BaziRelationType>([
    'gan_ke',
    'gan_chong',
    'zhi_chong',
    'zhi_po',
    'zhi_hai',
    'zhi_xing_pair',
    'zhi_xing_summary',
    'zhi_self_xing',
    'pillar_gaitou',
    'pillar_jiejiao',
    'pillar_fanyin',
]);
const COMBINATION_RELATIONS = new Set<BaziRelationType>([
    'gan_he',
    'zhi_san_hui',
    'zhi_san_he',
    'zhi_liu_he',
    'zhi_an_he',
]);

const GENERATES: Record<WuXing, WuXing> = {
    木: '火',
    火: '土',
    土: '金',
    金: '水',
    水: '木',
};

const CONTROLS: Record<WuXing, WuXing> = {
    木: '土',
    土: '水',
    水: '火',
    火: '金',
    金: '木',
};

function getStemPolarity(stem: string): StemPolarity {
    return YANG_STEMS.has(stem) ? '阳' : '阴';
}

function getGeneratingParent(element: WuXing): WuXing {
    const parent = (Object.keys(GENERATES) as WuXing[]).find((candidate) => GENERATES[candidate] === element);
    if (!parent) {
        throw new Error(`无法解析${element}的生扶五行`);
    }
    return parent;
}

function getTenGod(dayStem: string, targetStem: string): string {
    const dayElement = TIANGAN_WUXING[dayStem];
    const targetElement = TIANGAN_WUXING[targetStem];
    if (!dayElement || !targetElement) {
        return '';
    }

    const samePolarity = getStemPolarity(dayStem) === getStemPolarity(targetStem);
    if (dayElement === targetElement) {
        return samePolarity ? '比肩' : '劫财';
    }
    if (GENERATES[dayElement] === targetElement) {
        return samePolarity ? '食神' : '伤官';
    }
    if (CONTROLS[dayElement] === targetElement) {
        return samePolarity ? '偏财' : '正财';
    }
    if (CONTROLS[targetElement] === dayElement) {
        return samePolarity ? '七杀' : '正官';
    }
    return samePolarity ? '偏印' : '正印';
}

function getHiddenStems(input: BaziAnalysisInput): string[][] {
    return input.cangGan.map((group) => group.items.map((item) => item.gan));
}

function getMonthBranch(input: BaziAnalysisInput): string {
    return input.fourPillars[1].slice(1, 2);
}

function getDayMasterStem(input: BaziAnalysisInput): string {
    return input.fourPillars[2].slice(0, 1);
}

function getStrengthFacts(input: BaziAnalysisInput): {
    status: StrengthStatus;
    dayRoot: boolean;
    supportRoot: boolean;
    visibleSupport: boolean;
    hiddenSupport: boolean;
} {
    const dayStem = getDayMasterStem(input);
    const dayElement = TIANGAN_WUXING[dayStem];
    const supportElement = dayElement ? getGeneratingParent(dayElement) : undefined;
    const monthBranch = getMonthBranch(input);
    const status = (buildWuXingBandFromMonthBranch(monthBranch).find((item) => item.element === dayElement)?.status ?? '—') as StrengthStatus;
    const branches = input.fourPillars.map((pillar) => pillar.slice(1, 2));
    const hiddenStems = getHiddenStems(input);
    const dayRoot = branches.some((branch) => DIZHI_WUXING[branch] === dayElement)
        || hiddenStems.flat().some((stem) => TIANGAN_WUXING[stem] === dayElement);
    const supportRoot = branches.some((branch) => DIZHI_WUXING[branch] === supportElement)
        || hiddenStems.flat().some((stem) => TIANGAN_WUXING[stem] === supportElement);
    const visibleSupport = input.fourPillars
        .filter((_, index) => index !== 2)
        .some((pillar) => {
            const element = TIANGAN_WUXING[pillar.slice(0, 1)];
            return element === dayElement || element === supportElement;
        });
    const hiddenSupport = hiddenStems.flat().some((stem) => {
        const element = TIANGAN_WUXING[stem];
        return element === dayElement || element === supportElement;
    });

    return { status, dayRoot, supportRoot, visibleSupport, hiddenSupport };
}

function formatShufangStrength(facts: ReturnType<typeof getStrengthFacts>): string {
    const season = SUPPORTIVE_STATUSES.has(facts.status) ? '得令' : facts.status === '—' ? '月令不明' : '失令';
    const root = facts.dayRoot ? '得根' : '无根';
    const support = facts.visibleSupport || facts.hiddenSupport || facts.supportRoot ? '有扶' : '少扶';
    return `${season}·${root}·${support}`;
}

function resolveMonthCommander(input: BaziAnalysisInput): string {
    const dutyStem = input.baseInfo.renYuanDutyDetail.stem.trim();
    if (dutyStem) {
        const firstValidStem = [...dutyStem].find((stem) => Boolean(TIANGAN_WUXING[stem]));
        if (firstValidStem) {
            return firstValidStem;
        }
    }
    return input.cangGan[1]?.items[0]?.gan ?? '';
}

function formatShufangStructure(input: BaziAnalysisInput): string {
    const dayStem = getDayMasterStem(input);
    const commanderStem = resolveMonthCommander(input);
    const tenGod = getTenGod(dayStem, commanderStem);
    if (STRUCTURE_TEN_GODS.has(tenGod)) {
        return `${tenGod}格`;
    }
    return `月令${getMonthBranch(input)}格`;
}

function getRelationFacts(input: BaziAnalysisInput) {
    const tianGan = input.fourPillars.map((pillar) => pillar.slice(0, 1));
    const diZhi = input.fourPillars.map((pillar) => pillar.slice(1, 2));
    return evaluateBaziRelationInteractions(tianGan, diZhi, {
        monthBranch: getMonthBranch(input),
        visibleStems: tianGan,
        hiddenStemsByPillar: getHiddenStems(input),
        policy: 'ziping_strict_v1',
    });
}

function isUsableRelationState(state: BaziRelationState): boolean {
    return state !== 'constrained';
}

function formatMangpaiStrength(input: BaziAnalysisInput, relations: ReturnType<typeof getRelationFacts>): string {
    const facts = getStrengthFacts(input);
    const actionCount = relations.filter((item) => ACTION_RELATIONS.has(item.relationType) && isUsableRelationState(item.state)).length;
    const root = facts.dayRoot || facts.supportRoot ? '身有根' : '身无根';
    const doing = actionCount >= 2 ? '做功强' : actionCount === 1 ? '做功有象' : '做功弱';
    return `${root}·${doing}`;
}

function formatMangpaiStructure(input: BaziAnalysisInput, relations: ReturnType<typeof getRelationFacts>): string {
    const actionCount = relations.filter((item) => ACTION_RELATIONS.has(item.relationType) && isUsableRelationState(item.state)).length;
    const combinationCount = relations.filter((item) => COMBINATION_RELATIONS.has(item.relationType) && isUsableRelationState(item.state)).length;
    if (actionCount > 0) {
        return '制化做功';
    }
    if (combinationCount > 0) {
        return '合化做功';
    }
    const commander = resolveMonthCommander(input);
    const tenGod = getTenGod(getDayMasterStem(input), commander);
    return tenGod && STRUCTURE_TEN_GODS.has(tenGod) ? `${tenGod}主事` : '宫位做功待定';
}

function mergeSchoolReferences(left: string, right: string): string {
    return left === right ? left : `书：${left}\n盲：${right}`;
}

export function buildBaziAnalysisProfile(input: BaziAnalysisInput): BaziAnalysisProfile {
    const dayMasterStem = getDayMasterStem(input);
    const dayMasterElement = TIANGAN_WUXING[dayMasterStem] ?? '';
    const dayMasterPolarity = getStemPolarity(dayMasterStem);
    const dayMasterProperty = `${dayMasterStem}${dayMasterElement}`;
    const yinYangReference = `${dayMasterPolarity}日主 · ${input.subject.genderLabel}命`;
    const strengthFacts = getStrengthFacts(input);
    const relations = getRelationFacts(input);
    const shufang = {
        strength: formatShufangStrength(strengthFacts),
        structure: formatShufangStructure(input),
    };
    const mangpai = {
        strength: formatMangpaiStrength(input, relations),
        structure: formatMangpaiStructure(input, relations),
    };

    return {
        version: BAZI_ANALYSIS_PROFILE_VERSION,
        dayMasterStem,
        dayMasterElement,
        dayMasterPolarity,
        dayMasterProperty,
        yinYangReference,
        shufang,
        mangpai,
        summary: {
            dayMasterProperty,
            yinYangReference,
            strengthReference: mergeSchoolReferences(shufang.strength, mangpai.strength),
            structureReference: mergeSchoolReferences(shufang.structure, mangpai.structure),
        },
    };
}

export function isBaziAnalysisProfile(value: unknown): value is BaziAnalysisProfile {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const candidate = value as Partial<BaziAnalysisProfile>;
    const isSummary = (item: unknown): item is { strength: string; structure: string } => (
        Boolean(item)
        && typeof item === 'object'
        && typeof (item as { strength?: unknown }).strength === 'string'
        && typeof (item as { structure?: unknown }).structure === 'string'
    );
    return candidate.version === BAZI_ANALYSIS_PROFILE_VERSION
        && typeof candidate.dayMasterStem === 'string'
        && typeof candidate.dayMasterElement === 'string'
        && (candidate.dayMasterPolarity === '阴' || candidate.dayMasterPolarity === '阳')
        && typeof candidate.dayMasterProperty === 'string'
        && typeof candidate.yinYangReference === 'string'
        && isSummary(candidate.shufang)
        && isSummary(candidate.mangpai)
        && Boolean(candidate.summary)
        && typeof candidate.summary?.dayMasterProperty === 'string'
        && typeof candidate.summary?.yinYangReference === 'string'
        && typeof candidate.summary?.strengthReference === 'string'
        && typeof candidate.summary?.structureReference === 'string';
}
