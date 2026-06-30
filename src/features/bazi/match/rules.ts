import { SixtyCycleYear } from 'tyme4ts';
import { BaziResult, ShiShenName } from '../../../core/bazi-types';
import { DIZHI_WUXING, TIANGAN_WUXING, WuXing } from '../../../core/liuyao-data';
import {
    CONTROLS,
    GAN_CHONG,
    GAN_HE,
    GENERATES,
    ZHI_CHONG,
    ZHI_HAI,
    ZHI_LIU_HE,
    ZHI_PO,
    ZHI_SAN_HE,
    ZHI_SAN_HUI,
    ZHI_XING_PAIR_RULES,
    ZHI_XING_SELF,
    getDictPairEntry,
    getGanKeMeta,
    getPairKey,
} from '../../../core/bazi-relation-rules';
import {
    BaziCompatibilityResult,
    BaziMarriageTimingCandidate,
    BaziMarriageTimingProfile,
    BaziMarriageTimingResult,
    BaziMarriageYearCandidate,
    BaziMatchDimensionScore,
    BaziMatchEvidence,
    BaziMatchGrade,
    BaziMatchMatrixEntry,
    BaziMatchProfile,
    BaziMatchReview,
    getBaziMatchGrade,
} from './types';
import type { BaziMatchClassicReferenceId } from './classic-references';

const ELEMENTS: WuXing[] = ['木', '火', '土', '金', '水'];
const STAR_NAMES: ShiShenName[] = ['比肩', '劫财', '食神', '伤官', '偏财', '正财', '七杀', '正官', '偏印', '正印'];
const DIMENSION_WEIGHTS: Record<BaziMatchDimensionScore['key'], number> = {
    harmony: 0.32,
    supportHusband: 0.22,
    supportWife: 0.22,
    offspring: 0.08,
    longevity: 0.16,
};
const YANG_STEMS = ['甲', '丙', '戊', '庚', '壬'];
const MIN_TIMING_AGE = 16;
const MIN_MARRIAGE_DISPLAY_AGE = 18;
const MAX_MARRIAGE_DISPLAY_AGE = 45;
const MARRIAGE_SIGNAL_THRESHOLD = 10;

interface FortuneYearItem {
    year: number;
    age: number;
    ganZhi: string;
    daYunGanZhi?: string;
}

interface BaziMatchEvidenceMatrixInput {
    maleProfile: BaziMatchProfile;
    femaleProfile: BaziMatchProfile;
    dimensions: BaziMatchDimensionScore[];
    marriageYears: BaziMarriageYearCandidate[];
    marriageTiming?: BaziMarriageTimingResult;
}

interface DimensionEvidenceItem {
    dimension: BaziMatchDimensionScore;
    evidence: BaziMatchEvidence;
    strength: BaziMatchMatrixEntry['strength'];
}

function clampScore(score: number): number {
    return Math.max(0, Math.min(100, Math.round(score)));
}

function addEvidence(
    evidence: BaziMatchEvidence[],
    label: string,
    detail: string,
    effect: BaziMatchEvidence['effect'],
    referenceIds: BaziMatchClassicReferenceId[] = ['HM-01'],
): void {
    evidence.push({ label, detail, effect, referenceIds });
}

function branchOf(ganZhi: string | undefined): string {
    return ganZhi && ganZhi.length >= 2 ? ganZhi.charAt(1) : '';
}

function stemOf(ganZhi: string | undefined): string {
    return ganZhi ? ganZhi.charAt(0) : '';
}

function splitPillars(fourPillars: BaziResult['fourPillars']): {
    stems: [string, string, string, string];
    branches: [string, string, string, string];
} {
    return {
        stems: fourPillars.map((item) => stemOf(item)) as [string, string, string, string],
        branches: fourPillars.map((item) => branchOf(item)) as [string, string, string, string],
    };
}

function countStar(starCounts: Partial<Record<ShiShenName, number>>, star: ShiShenName | undefined): void {
    if (!star || star === '日主') {
        return;
    }
    starCounts[star] = (starCounts[star] ?? 0) + 1;
}

function countElement(elementCounts: Record<WuXing, number>, element: WuXing | undefined): void {
    if (!element) {
        return;
    }
    elementCounts[element] += 1;
}

function getSortedElements(elementCounts: Record<WuXing, number>): WuXing[] {
    return [...ELEMENTS].sort((left, right) => elementCounts[right] - elementCounts[left]);
}

function getElementsWithLowestCount(elementCounts: Record<WuXing, number>): WuXing[] {
    const min = Math.min(...ELEMENTS.map((item) => elementCounts[item]));
    return ELEMENTS.filter((item) => elementCounts[item] === min);
}

function getNeededElements(elementCounts: Record<WuXing, number>): WuXing[] {
    const sorted = getSortedElements(elementCounts);
    const dominant = sorted[0];
    const weakest = getElementsWithLowestCount(elementCounts);
    const needs = new Set<WuXing>(weakest);
    const max = elementCounts[dominant];
    const min = Math.min(...ELEMENTS.map((item) => elementCounts[item]));
    if (max - min >= 3) {
        needs.add(Object.entries(CONTROLS).find(([, controlled]) => controlled === dominant)?.[0] as WuXing);
    }
    return [...needs].filter(Boolean);
}

function getStrength(dayElement: WuXing | undefined, elementCounts: Record<WuXing, number>): BaziMatchProfile['strength'] {
    if (!dayElement) {
        return 'balanced';
    }
    const count = elementCounts[dayElement];
    if (count >= 5) return 'strong';
    if (count <= 2) return 'weak';
    return 'balanced';
}

function buildDaYunProfile(result: BaziResult, referenceYear: number): BaziMatchProfile['futureDaYun'] {
    const endYear = referenceYear + 29;
    return result.daYun
        .filter((item) => item.endYear >= referenceYear && item.startYear <= endYear)
        .map((item) => {
            const stem = stemOf(item.ganZhi);
            const branch = branchOf(item.ganZhi);
            return {
                ganZhi: item.ganZhi,
                startYear: item.startYear,
                endYear: item.endYear,
                stemElement: TIANGAN_WUXING[stem] || '土',
                branchElement: DIZHI_WUXING[branch] || '土',
            };
        });
}

export function buildBaziMatchProfile(result: BaziResult, referenceDate: Date = new Date()): BaziMatchProfile {
    const { stems, branches } = splitPillars(result.fourPillars);
    const elementCounts = ELEMENTS.reduce((acc, element) => {
        acc[element] = 0;
        return acc;
    }, {} as Record<WuXing, number>);
    const starCounts: Partial<Record<ShiShenName, number>> = {};

    stems.forEach((stem) => countElement(elementCounts, TIANGAN_WUXING[stem]));
    branches.forEach((branch) => countElement(elementCounts, DIZHI_WUXING[branch]));
    result.cangGan.forEach((group) => {
        group.items.forEach((item) => {
            countElement(elementCounts, TIANGAN_WUXING[item.gan]);
            countStar(starCounts, item.shiShen);
        });
    });
    result.shiShen.forEach((item) => countStar(starCounts, item.shiShen));

    const sorted = getSortedElements(elementCounts);
    const dayElement = TIANGAN_WUXING[stems[2]];

    return {
        sourceId: result.id,
        name: result.subject.name?.trim() || result.fourPillars.join(' '),
        gender: result.gender,
        genderLabel: result.subject.genderLabel,
        mingZaoLabel: result.subject.mingZaoLabel,
        fourPillars: result.fourPillars,
        stems,
        branches,
        yearBranch: branches[0],
        dayStem: stems[2],
        dayBranch: branches[2],
        hourBranch: branches[3],
        mingGongBranch: branchOf(result.baseInfo.mingGong),
        zodiac: result.baseInfo.zodiac,
        shenSha: result.shenSha.allStars || [],
        elementCounts,
        neededElements: getNeededElements(elementCounts),
        dominantElements: sorted.slice(0, 2),
        weakElements: getElementsWithLowestCount(elementCounts),
        starCounts,
        strength: getStrength(dayElement, elementCounts),
        futureDaYun: buildDaYunProfile(result, referenceDate.getFullYear()),
    };
}

function hasAnyElement(source: WuXing[], target: WuXing[]): boolean {
    return source.some((item) => target.includes(item));
}

function getPairSanHeElement(left: string, right: string): WuXing | null {
    for (const [key, element] of Object.entries(ZHI_SAN_HE)) {
        const members = key.split('');
        if (members.includes(left) && members.includes(right)) {
            return element;
        }
    }
    return null;
}

function getPairSanHuiElement(left: string, right: string): WuXing | null {
    for (const [key, element] of Object.entries(ZHI_SAN_HUI)) {
        const members = key.split('');
        if (members.includes(left) && members.includes(right)) {
            return element;
        }
    }
    return null;
}

function isXingPair(left: string, right: string): boolean {
    if (left === right && ZHI_XING_SELF.includes(left as never)) {
        return true;
    }
    return ZHI_XING_PAIR_RULES.some((rule) => rule.members.includes(left as never) && rule.members.includes(right as never));
}

function applyStemRelation(
    left: string,
    right: string,
    evidence: BaziMatchEvidence[],
    label: string,
    referenceIds: BaziMatchClassicReferenceId[] = ['HM-02'],
): number {
    let score = 0;
    const he = getDictPairEntry(left, right, GAN_HE);
    if (he) {
        score += 18;
        addEvidence(evidence, label, `${left}${right}天干五合，合化${he[1]}，主心智与行动容易形成共同目标。`, 'positive', referenceIds);
    }
    if (getPairKey(left, right, GAN_CHONG as unknown as readonly string[])) {
        score -= 18;
        addEvidence(evidence, label, `${left}${right}天干相冲，沟通节奏容易一急一硬。`, 'negative', referenceIds);
    }
    const leftElement = TIANGAN_WUXING[left];
    const rightElement = TIANGAN_WUXING[right];
    if (leftElement && rightElement) {
        if (GENERATES[leftElement] === rightElement || GENERATES[rightElement] === leftElement) {
            score += 10;
            addEvidence(evidence, label, `${leftElement}${rightElement}相生，日常支持感较容易建立。`, 'positive', referenceIds);
        } else if (leftElement === rightElement) {
            score += 4;
            addEvidence(evidence, label, `双方日干同属${leftElement}，思维底色接近。`, 'positive', referenceIds);
        } else if (getGanKeMeta(left, right)) {
            score -= 8;
            addEvidence(evidence, label, `${leftElement}${rightElement}相克，容易在主导权上较劲。`, 'negative', referenceIds);
        }
    }
    return score;
}

function applyBranchRelation(
    left: string,
    right: string,
    evidence: BaziMatchEvidence[],
    label: string,
    strong = false,
    referenceIds: BaziMatchClassicReferenceId[] = ['PG-01', 'EXP-01'],
): number {
    let score = 0;
    const liuHe = getDictPairEntry(left, right, ZHI_LIU_HE);
    const sanHe = getPairSanHeElement(left, right);
    const sanHui = getPairSanHuiElement(left, right);
    if (liuHe) {
        score += strong ? 18 : 8;
        addEvidence(evidence, label, `${left}${right}六合${liuHe[1]}，关系稳定性较好。`, 'positive', referenceIds);
    } else if (sanHe) {
        score += strong ? 10 : 6;
        addEvidence(evidence, label, `${left}${right}同属三合${sanHe}局，目标与生活方式有互补空间。`, 'positive', referenceIds);
    } else if (sanHui) {
        score += strong ? 8 : 5;
        addEvidence(evidence, label, `${left}${right}同属三会${sanHui}势，外部环境协同时更容易合拍。`, 'positive', referenceIds);
    }
    if (getPairKey(left, right, ZHI_CHONG as unknown as readonly string[])) {
        score -= strong ? 28 : 14;
        addEvidence(evidence, label, `${left}${right}相冲，容易出现生活节奏与底层安全感冲突。`, 'negative', referenceIds);
    }
    if (getPairKey(left, right, ZHI_HAI as unknown as readonly string[])) {
        score -= strong ? 12 : 6;
        addEvidence(evidence, label, `${left}${right}相害，容易有隐性误会或期待落差。`, 'negative', referenceIds);
    }
    if (getPairKey(left, right, ZHI_PO as unknown as readonly string[])) {
        score -= strong ? 10 : 5;
        addEvidence(evidence, label, `${left}${right}相破，稳定性需靠规则感维护。`, 'negative', referenceIds);
    }
    if (isXingPair(left, right)) {
        score -= strong ? 14 : 7;
        addEvidence(evidence, label, `${left}${right}带刑象，冲突时容易各执己见。`, 'negative', referenceIds);
    }
    return score;
}

function buildDimension(key: BaziMatchDimensionScore['key'], title: string, score: number, evidence: BaziMatchEvidence[]): BaziMatchDimensionScore {
    const safeScore = clampScore(score);
    const grade = getBaziMatchGrade(safeScore);
    return {
        key,
        title,
        score: safeScore,
        grade,
        summary: `${title}${grade}，得分 ${safeScore}。`,
        evidence,
    };
}

function scoreHarmony(male: BaziMatchProfile, female: BaziMatchProfile): BaziMatchDimensionScore {
    const evidence: BaziMatchEvidence[] = [];
    let score = 60;
    score += applyStemRelation(male.dayStem, female.dayStem, evidence, '日干关系', ['HM-02']);
    score += applyBranchRelation(male.dayBranch, female.dayBranch, evidence, '夫妻宫', true, ['PG-01', 'PG-02', 'EXP-01']);
    score += applyBranchRelation(male.yearBranch, female.yearBranch, evidence, '生肖关系', false, ['HM-01']);
    if (male.mingGongBranch && female.mingGongBranch) {
        score += applyBranchRelation(male.mingGongBranch, female.mingGongBranch, evidence, '命宫关系', false, ['HM-01']);
    }
    if (evidence.length === 0) {
        addEvidence(evidence, '基础关系', '双方日干、日支、生肖未见明显合冲刑害，此项取中。', 'neutral', ['HM-01', 'PG-01']);
    }
    return buildDimension('harmony', '和睦', score, evidence);
}

function starTotal(profile: BaziMatchProfile, names: ShiShenName[]): number {
    return names.reduce((sum, name) => sum + (profile.starCounts[name] ?? 0), 0);
}

function scoreSupportHusband(male: BaziMatchProfile, female: BaziMatchProfile): BaziMatchDimensionScore {
    const evidence: BaziMatchEvidence[] = [];
    let score = 60;
    const femaleSupportsMale = hasAnyElement(female.dominantElements, male.neededElements);
    if (femaleSupportsMale) {
        score += 16;
        addEvidence(evidence, '男方所需', `女方旺势五行${female.dominantElements.join('、')}能补男方所需${male.neededElements.join('、')}。`, 'positive', ['HM-02']);
    }

    const maleBiJie = starTotal(male, ['比肩', '劫财']);
    const femaleShiShang = starTotal(female, ['食神', '伤官']);
    const maleCai = starTotal(male, ['偏财', '正财']);

    if (maleBiJie >= 4 && femaleShiShang >= 4) {
        score += 10;
        addEvidence(evidence, '食伤制化', '男方比劫旺、女方食伤旺，女方能化男方强势之气。', 'positive', ['FS-02', 'HM-01']);
    } else if (maleBiJie >= 4) {
        score -= 8;
        addEvidence(evidence, '男命比劫', '男方比劫偏重，需女方有足够化泄之力才能稳住关系。', 'negative', ['FS-02']);
    }
    if ((male.starCounts['偏财'] ?? 0) >= 2) {
        score -= 6;
        addEvidence(evidence, '男命偏财', '男方偏财透显偏多，女方助力之外仍需男方自守边界。', 'negative', ['FS-01', 'FS-02']);
    } else if (maleCai >= 2) {
        score += 8;
        addEvidence(evidence, '男命财星', '男方财星有根，女方助力较易落到家业经营。', 'positive', ['FS-01']);
    }

    const femaleDaYunSupport = daYunComplementScore(female, male);
    if (femaleDaYunSupport >= 4) {
        score += 6;
        addEvidence(evidence, '女方大运', '女方未来大运多见男方所需五行，后续助力不只在本命。', 'positive', ['HM-02', 'YQ-01']);
    }

    if (evidence.length === 0) {
        addEvidence(evidence, '旺夫格局', '未见明显旺夫或损夫信号，本项按中性处理。', 'neutral', ['HM-01', 'FS-01']);
    }
    return buildDimension('supportHusband', '旺夫', score, evidence);
}

function scoreSupportWife(male: BaziMatchProfile, female: BaziMatchProfile): BaziMatchDimensionScore {
    const evidence: BaziMatchEvidence[] = [];
    let score = 60;
    const maleSupportsFemale = hasAnyElement(male.dominantElements, female.neededElements);
    if (maleSupportsFemale) {
        score += 16;
        addEvidence(evidence, '女方所需', `男方旺势五行${male.dominantElements.join('、')}能补女方所需${female.neededElements.join('、')}。`, 'positive', ['HM-02']);
    }

    const maleBiJie = starTotal(male, ['比肩', '劫财']);
    const femaleShiShang = starTotal(female, ['食神', '伤官']);
    const femaleGuanSha = starTotal(female, ['正官', '七杀']);
    const femaleHasMixedGuanSha = (female.starCounts['正官'] ?? 0) > 0 && (female.starCounts['七杀'] ?? 0) > 0;

    if (femaleGuanSha >= 2) {
        score += 8;
        addEvidence(evidence, '女命夫星', '女方官杀星较明显，男方助力有伴侣星承接。', 'positive', ['PG-02']);
    }
    if (femaleHasMixedGuanSha && femaleShiShang === 0) {
        score -= 10;
        addEvidence(evidence, '官杀混杂', '女方官杀混杂且缺少食伤制化，男方帮扶时需避免加重压力。', 'negative', ['PG-02']);
    }
    if (femaleShiShang >= 4 && maleBiJie < 4) {
        score -= 8;
        addEvidence(evidence, '女命食伤', '女方食伤偏重，男方命局承接力不足时容易互相挑剔。', 'negative', ['PG-02', 'CY-01']);
    } else if (femaleShiShang >= 4 && maleBiJie >= 4) {
        score += 8;
        addEvidence(evidence, '硬配相承', '女方食伤旺、男方比劫旺，彼此强势有相承空间。', 'positive', ['HM-01']);
    }

    const maleDaYunSupport = daYunComplementScore(male, female);
    if (maleDaYunSupport >= 4) {
        score += 6;
        addEvidence(evidence, '男方大运', '男方未来大运多见女方所需五行，后续帮妻之力较稳。', 'positive', ['HM-02', 'YQ-01']);
    }

    if (evidence.length === 0) {
        addEvidence(evidence, '帮妻格局', '未见明显帮妻或耗妻信号，本项按中性处理。', 'neutral', ['HM-01', 'PG-02']);
    }
    return buildDimension('supportWife', '帮妻', score, evidence);
}

function scoreOffspring(male: BaziMatchProfile, female: BaziMatchProfile): BaziMatchDimensionScore {
    const evidence: BaziMatchEvidence[] = [];
    let score = 60;
    const maleChildStars = starTotal(male, ['正官', '七杀']);
    const femaleChildStars = starTotal(female, ['食神', '伤官']);

    if (maleChildStars >= 2) {
        score += 12;
        addEvidence(evidence, '男方子女星', `男方官杀子女星计 ${maleChildStars}，后代缘分有落点。`, 'positive', ['CY-01']);
    } else {
        score -= 8;
        addEvidence(evidence, '男方子女星', '男方官杀子女星偏弱，子女议题更依赖后天规划。', 'negative', ['CY-01']);
    }
    if (femaleChildStars >= 2) {
        score += 12;
        addEvidence(evidence, '女方子女星', `女方食伤子女星计 ${femaleChildStars}，养育表达较明显。`, 'positive', ['CY-01']);
    } else {
        score -= 8;
        addEvidence(evidence, '女方子女星', '女方食伤子女星偏弱，生育和养育节奏不宜被外界催促。', 'negative', ['CY-01']);
    }

    score += applyBranchRelation(male.hourBranch, female.hourBranch, evidence, '时柱子女宫', true, ['YY-01', 'EXP-01']);
    if (maleChildStars < 2 && femaleChildStars >= 3) {
        score += 6;
        addEvidence(evidence, '互补补救', '男方子女星偏弱，女方食伤较足，可形成一定补救。', 'positive', ['CY-01', 'HM-02']);
    }
    if (femaleChildStars < 2 && maleChildStars >= 3) {
        score += 6;
        addEvidence(evidence, '互补补救', '女方子女星偏弱，男方官杀较足，可形成一定补救。', 'positive', ['CY-01', 'HM-02']);
    }
    return buildDimension('offspring', '子女', score, evidence);
}

function daYunComplementScore(left: BaziMatchProfile, right: BaziMatchProfile): number {
    return left.futureDaYun.reduce((sum, item) => {
        let next = sum;
        if (right.neededElements.includes(item.stemElement)) next += 2;
        if (right.neededElements.includes(item.branchElement)) next += 2;
        if (right.dominantElements.includes(item.stemElement) && right.dominantElements.includes(item.branchElement)) next -= 1;
        return next;
    }, 0);
}

function scoreLifecycle(male: BaziMatchProfile, female: BaziMatchProfile): BaziMatchDimensionScore {
    const evidence: BaziMatchEvidence[] = [];
    let score = 60;

    if (male.futureDaYun.length === 0 || female.futureDaYun.length === 0) {
        addEvidence(evidence, '大运走势', '至少一方缺少未来大运数据，本维度按中性处理。', 'neutral', ['LS-01']);
        return buildDimension('longevity', '同寿', score, evidence);
    }

    const maleCurrent = male.futureDaYun[0];
    const femaleCurrent = female.futureDaYun[0];
    const startDiff = Math.abs(maleCurrent.startYear - femaleCurrent.startYear);
    if (startDiff <= 2) {
        score += 8;
        addEvidence(evidence, '换运节点', `双方当前大运起点相差 ${startDiff} 年，生命周期节奏较同步。`, 'positive', ['LS-01', 'YQ-01']);
    } else if (startDiff >= 7) {
        score -= 6;
        addEvidence(evidence, '换运节点', `双方当前大运起点相差 ${startDiff} 年，阶段转换容易错位。`, 'negative', ['LS-01', 'YQ-01']);
    }

    const complement = daYunComplementScore(male, female) + daYunComplementScore(female, male);
    if (complement >= 8) {
        score += 14;
        addEvidence(evidence, '未来三十年', '双方未来大运五行多次落在对方所需五行，起伏具备互补性。', 'positive', ['LS-01', 'HM-02']);
    } else if (complement >= 4) {
        score += 8;
        addEvidence(evidence, '未来三十年', '双方未来大运对彼此有一定补益。', 'positive', ['LS-01', 'HM-02']);
    } else if (complement <= 0) {
        score -= 8;
        addEvidence(evidence, '未来三十年', '双方未来大运补益信号偏少，需要靠现实规划保持同步。', 'negative', ['LS-01', 'HM-02']);
    }

    return buildDimension('longevity', '同寿', score, evidence);
}

function isYangStem(stem: string): boolean {
    return YANG_STEMS.includes(stem);
}

function getStemTenStar(dayStem: string, targetStem: string): ShiShenName | null {
    const dayElement = TIANGAN_WUXING[dayStem];
    const targetElement = TIANGAN_WUXING[targetStem];
    if (!dayElement || !targetElement) {
        return null;
    }

    const samePolarity = isYangStem(dayStem) === isYangStem(targetStem);
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
    if (GENERATES[targetElement] === dayElement) {
        return samePolarity ? '偏印' : '正印';
    }
    return null;
}

function getSpouseStars(result: BaziResult): ShiShenName[] {
    return result.gender === 1 ? ['偏财', '正财'] : ['七杀', '正官'];
}

function getSpouseStarRuleText(result: BaziResult): string {
    return result.gender === 1 ? '男命以财星为妻星' : '女命以官杀为夫星';
}

function collectFortuneYears(result: BaziResult): FortuneYearItem[] {
    const byYear = new Map<number, FortuneYearItem>();
    const addYear = (item: { year: number; age: number; ganZhi: string }, daYunGanZhi?: string) => {
        const previous = byYear.get(item.year);
        if (!previous) {
            byYear.set(item.year, { year: item.year, age: item.age, ganZhi: item.ganZhi, daYunGanZhi });
            return;
        }
        if (!previous.daYunGanZhi && daYunGanZhi) {
            byYear.set(item.year, { ...previous, daYunGanZhi });
        }
    };

    result.xiaoYun.forEach((item) => addYear(item));
    result.daYun.forEach((daYun) => {
        daYun.liuNian.forEach((item) => addYear(item, daYun.ganZhi));
    });
    result.liuNian.forEach((item) => addYear(item));

    return [...byYear.values()].sort((left, right) => left.year - right.year);
}

function getShenShaStarsForGanZhi(result: BaziResult, ganZhi: string): string[] {
    return result.shenShaV2?.ganZhiBuckets?.[ganZhi]?.allStars ?? [];
}

function scoreMarriageTimingYear(result: BaziResult, profile: BaziMatchProfile, item: FortuneYearItem): BaziMarriageTimingCandidate | null {
    if (item.age < MIN_TIMING_AGE) {
        return null;
    }

    let score = 0;
    const reasons: string[] = [];
    const referenceIds = new Set<BaziMatchClassicReferenceId>(['YQ-01']);
    const spouseStars = getSpouseStars(result);
    const spouseRuleText = getSpouseStarRuleText(result);
    const yearStem = stemOf(item.ganZhi);
    const yearBranch = branchOf(item.ganZhi);
    const yearStemStar = getStemTenStar(profile.dayStem, yearStem);

    if (yearStemStar && spouseStars.includes(yearStemStar)) {
        score += 14;
        reasons.push(`${spouseRuleText}，流年天干${yearStem}透${yearStemStar}`);
        referenceIds.add(result.gender === 1 ? 'FS-01' : 'PG-02');
    }

    if (item.daYunGanZhi) {
        const daYunStem = stemOf(item.daYunGanZhi);
        const daYunStemStar = getStemTenStar(profile.dayStem, daYunStem);
        if (daYunStemStar && spouseStars.includes(daYunStemStar)) {
            score += 8;
            reasons.push(`大运${item.daYunGanZhi}透${daYunStemStar}，婚缘底气先到`);
            referenceIds.add(result.gender === 1 ? 'FS-01' : 'PG-02');
        }
    }

    if (getDictPairEntry(profile.dayBranch, yearBranch, ZHI_LIU_HE)) {
        score += 10;
        reasons.push(`流年${yearBranch}六合夫妻宫${profile.dayBranch}`);
        referenceIds.add('EXP-01');
    } else if (getPairKey(profile.dayBranch, yearBranch, ZHI_CHONG as unknown as readonly string[])) {
        score += 10;
        reasons.push(`流年${yearBranch}冲动夫妻宫${profile.dayBranch}`);
        referenceIds.add('EXP-01');
    } else {
        const sanHe = getPairSanHeElement(profile.dayBranch, yearBranch);
        const sanHui = getPairSanHuiElement(profile.dayBranch, yearBranch);
        if (sanHe || sanHui) {
            score += 6;
            reasons.push(`流年${yearBranch}与夫妻宫${profile.dayBranch}成${sanHe ? `三合${sanHe}` : `三会${sanHui}`}势`);
            referenceIds.add('EXP-01');
        }
    }

    if (getPairKey(profile.dayBranch, yearBranch, ZHI_HAI as unknown as readonly string[])
        || getPairKey(profile.dayBranch, yearBranch, ZHI_PO as unknown as readonly string[])
        || isXingPair(profile.dayBranch, yearBranch)) {
        score += 4;
        reasons.push(`夫妻宫逢刑害破动，婚缘之事易被引动`);
        referenceIds.add('EXP-01');
    }

    if (getDictPairEntry(profile.dayStem, yearStem, GAN_HE)) {
        score += 5;
        reasons.push(`流年天干${yearStem}与日干${profile.dayStem}五合`);
        referenceIds.add('HM-02');
    }

    const shenSha = getShenShaStarsForGanZhi(result, item.ganZhi);
    if (shenSha.includes('红鸾') || shenSha.includes('天喜')) {
        score += 10;
        reasons.push(`流年带${['红鸾', '天喜'].filter((star) => shenSha.includes(star)).join('、')}喜庆星`);
        referenceIds.add('YQ-01');
    }
    if (shenSha.includes('桃花') || shenSha.includes('红艳')) {
        score += 5;
        reasons.push(`流年带${['桃花', '红艳'].filter((star) => shenSha.includes(star)).join('、')}情缘星`);
        referenceIds.add('YQ-01');
    }

    if (score < MARRIAGE_SIGNAL_THRESHOLD || reasons.length === 0) {
        return null;
    }

    return {
        year: item.year,
        age: item.age,
        ganZhi: item.ganZhi,
        score,
        reasons,
        referenceIds: [...referenceIds],
    };
}

function buildMarriageTimingProfile(result: BaziResult, profile: BaziMatchProfile): BaziMarriageTimingProfile {
    const candidates = collectFortuneYears(result)
        .map((item) => scoreMarriageTimingYear(result, profile, item))
        .filter((item): item is BaziMarriageTimingCandidate => Boolean(item))
        .sort((left, right) => right.score - left.score || left.year - right.year);

    return {
        name: profile.name,
        genderLabel: profile.genderLabel,
        candidates,
    };
}

function isDisplayMarriageAge(age: number): boolean {
    return age >= MIN_MARRIAGE_DISPLAY_AGE && age <= MAX_MARRIAGE_DISPLAY_AGE;
}

function getMarriageTriggerScore(profile: BaziMatchProfile, yearGanZhi: string, partner: BaziMatchProfile): { score: number; reasons: string[] } {
    const yearStem = stemOf(yearGanZhi);
    const yearBranch = branchOf(yearGanZhi);
    const yearStemElement = TIANGAN_WUXING[yearStem];
    const yearBranchElement = DIZHI_WUXING[yearBranch];
    const reasons: string[] = [];
    let score = 0;

    if (getDictPairEntry(profile.dayStem, yearStem, GAN_HE)) {
        score += 8;
        reasons.push(`${profile.name}日干${profile.dayStem}与流年${yearStem}五合`);
    }
    if (getDictPairEntry(profile.dayBranch, yearBranch, ZHI_LIU_HE)) {
        score += 7;
        reasons.push(`${profile.name}夫妻宫${profile.dayBranch}被流年${yearBranch}六合动`);
    }
    if (getDictPairEntry(profile.hourBranch, yearBranch, ZHI_LIU_HE)) {
        score += 4;
        reasons.push(`${profile.name}时柱${profile.hourBranch}被流年${yearBranch}六合动`);
    }
    const daySanHe = getPairSanHeElement(profile.dayBranch, yearBranch);
    if (daySanHe) {
        score += 5;
        reasons.push(`${profile.name}夫妻宫与流年成三合${daySanHe}势`);
    }
    if (profile.neededElements.includes(yearStemElement) || profile.neededElements.includes(yearBranchElement)) {
        score += 5;
        reasons.push(`流年五行补${profile.name}所需${profile.neededElements.join('、')}`);
    }
    if (partner.neededElements.includes(yearStemElement) || partner.neededElements.includes(yearBranchElement)) {
        score += 3;
        reasons.push(`流年五行也补${partner.name}所需`);
    }
    if (getPairKey(profile.dayBranch, yearBranch, ZHI_CHONG as unknown as readonly string[])) {
        score -= 8;
        reasons.push(`${profile.name}夫妻宫被流年${yearBranch}冲动，宜谨慎处理关系压力`);
    }
    return { score, reasons };
}

function buildMarriageYears(
    male: BaziMatchProfile,
    female: BaziMatchProfile,
    timing: BaziMarriageTimingResult,
): BaziMarriageYearCandidate[] {
    const allYears: BaziMarriageYearCandidate[] = [];
    const femaleByYear = new Map(timing.female.candidates.map((item) => [item.year, item]));

    timing.male.candidates.forEach((maleCandidate) => {
        const femaleCandidate = femaleByYear.get(maleCandidate.year);
        if (!femaleCandidate) {
            return;
        }
        if (!isDisplayMarriageAge(maleCandidate.age) || !isDisplayMarriageAge(femaleCandidate.age)) {
            return;
        }
        const year = maleCandidate.year;
        const ganZhi = maleCandidate.ganZhi || SixtyCycleYear.fromYear(year).getSixtyCycle().getName();
        const maleScore = getMarriageTriggerScore(male, ganZhi, female);
        const femaleScore = getMarriageTriggerScore(female, ganZhi, male);
        const score = maleCandidate.score + femaleCandidate.score + maleScore.score + femaleScore.score;
        const reasons = [
            `男方${maleCandidate.age}岁：${maleCandidate.reasons.slice(0, 2).join('；')}`,
            `女方${femaleCandidate.age}岁：${femaleCandidate.reasons.slice(0, 2).join('；')}`,
            ...maleScore.reasons,
            ...femaleScore.reasons,
        ];
        allYears.push({
            year,
            ganZhi,
            kind: score >= 40 ? 'trigger' : 'recommendation',
            score,
            reasons,
            maleAge: maleCandidate.age,
            femaleAge: femaleCandidate.age,
            referenceIds: [...new Set<BaziMatchClassicReferenceId>([
                ...(maleCandidate.referenceIds || []),
                ...(femaleCandidate.referenceIds || []),
                'YQ-01',
                'EXP-01',
            ])],
        });
    });

    return allYears.sort((left, right) => right.score - left.score || left.year - right.year).slice(0, 2);
}

function buildMarriageTiming(
    maleResult: BaziResult,
    femaleResult: BaziResult,
    maleProfile: BaziMatchProfile,
    femaleProfile: BaziMatchProfile,
): BaziMarriageTimingResult {
    const male = buildMarriageTimingProfile(maleResult, maleProfile);
    const female = buildMarriageTimingProfile(femaleResult, femaleProfile);
    const femaleByYear = new Map(female.candidates.map((item) => [item.year, item]));
    const sharedYears = male.candidates
        .filter((item) => {
            const femaleCandidate = femaleByYear.get(item.year);
            return Boolean(femaleCandidate && isDisplayMarriageAge(item.age) && isDisplayMarriageAge(femaleCandidate.age));
        })
        .map((item) => item.year)
        .sort((left, right) => left - right);

    return {
        male,
        female,
        summary: sharedYears.length > 0
            ? `两盘同年应期：${sharedYears.slice(0, 2).join('、')}年。`
            : '两盘近年未见同年应期，暂不定具体婚年。',
    };
}

function getDimension(dimensions: BaziMatchDimensionScore[], key: BaziMatchDimensionScore['key']): BaziMatchDimensionScore {
    return dimensions.find((item) => item.key === key) || dimensions[0];
}

function getEvidenceStrength(
    dimension: BaziMatchDimensionScore,
    evidence: BaziMatchEvidence,
): BaziMatchMatrixEntry['strength'] {
    if (evidence.effect === 'neutral') {
        return 'low';
    }

    if (evidence.effect === 'negative') {
        if (dimension.key === 'harmony' && evidence.label === '夫妻宫') return 'high';
        if (dimension.key === 'supportWife' && evidence.label === '官杀混杂') return 'high';
        if (dimension.key === 'supportHusband' && (evidence.label === '男命比劫' || evidence.label === '男命偏财')) {
            return dimension.score <= 58 ? 'high' : 'medium';
        }
        if (dimension.score <= 55) return 'high';
        return 'medium';
    }

    if (dimension.score >= 85) return 'high';
    if (dimension.score >= 70) return 'medium';
    return 'low';
}

function matrixEntry(
    category: BaziMatchMatrixEntry['category'],
    title: string,
    direction: BaziMatchMatrixEntry['direction'],
    strength: BaziMatchMatrixEntry['strength'],
    detail: string,
    referenceIds: BaziMatchClassicReferenceId[] = ['HM-01'],
): BaziMatchMatrixEntry {
    return { category, title, direction, strength, detail, referenceIds };
}

function flattenEvidence(dimensions: BaziMatchDimensionScore[]): DimensionEvidenceItem[] {
    return dimensions.flatMap((dimension) => dimension.evidence.map((evidence) => ({
        dimension,
        evidence,
        strength: getEvidenceStrength(dimension, evidence),
    })));
}

function strengthValue(strength: BaziMatchMatrixEntry['strength']): number {
    if (strength === 'high') return 3;
    if (strength === 'medium') return 2;
    return 1;
}

function pickEvidence(
    items: DimensionEvidenceItem[],
    direction: BaziMatchEvidence['effect'],
): DimensionEvidenceItem | undefined {
    return items
        .filter((item) => item.evidence.effect === direction)
        .sort((left, right) => (
            strengthValue(right.strength) - strengthValue(left.strength)
            || DIMENSION_WEIGHTS[right.dimension.key] - DIMENSION_WEIGHTS[left.dimension.key]
            || right.dimension.score - left.dimension.score
        ))[0];
}

function toMatrixEntry(
    category: BaziMatchMatrixEntry['category'],
    title: string,
    item: DimensionEvidenceItem,
): BaziMatchMatrixEntry {
    return matrixEntry(
        category,
        title,
        item.evidence.effect,
        item.strength,
        `${item.dimension.title}：${item.evidence.detail}`,
        item.evidence.referenceIds,
    );
}

function buildCompositeEntry(
    category: BaziMatchMatrixEntry['category'],
    title: string,
    items: DimensionEvidenceItem[],
    fallback: string,
): BaziMatchMatrixEntry {
    const negative = pickEvidence(items, 'negative');
    const positive = pickEvidence(items, 'positive');
    const picked = negative && negative.strength === 'high' ? negative : positive || negative || pickEvidence(items, 'neutral');
    if (!picked) {
        return matrixEntry(category, title, 'neutral', 'low', fallback);
    }
    return toMatrixEntry(category, title, picked);
}

function filterEvidenceItems(
    items: DimensionEvidenceItem[],
    predicate: (item: DimensionEvidenceItem) => boolean,
): DimensionEvidenceItem[] {
    return items.filter(predicate);
}

function buildMarriageTimingEntry(input: BaziMatchEvidenceMatrixInput): BaziMatchMatrixEntry {
    if (input.marriageYears.length === 0) {
        return matrixEntry(
            'marriageTiming',
            '婚期候选',
            'neutral',
            'medium',
            input.marriageTiming?.summary || '两盘近年未见同年应期，暂不定具体婚年。',
            ['YQ-01', 'EXP-01'],
        );
    }

    const detail = input.marriageYears
        .map((item, index) => {
            const label = index === 0 ? '主应期' : '备选应期';
            const ageText = item.maleAge && item.femaleAge ? `，男方${item.maleAge}岁，女方${item.femaleAge}岁` : '';
            return `${label}${item.year}年${ageText}：${item.reasons.slice(0, 2).join('；')}`;
        })
        .join('；');

    return matrixEntry('marriageTiming', '婚期候选', 'positive', 'medium', detail, ['YQ-01', 'EXP-01']);
}

function buildRiskPriorityEntries(
    input: BaziMatchEvidenceMatrixInput,
    items: DimensionEvidenceItem[],
): BaziMatchMatrixEntry[] {
    const risks: BaziMatchMatrixEntry[] = [];
    const harmony = getDimension(input.dimensions, 'harmony');
    const supportHusband = getDimension(input.dimensions, 'supportHusband');
    const supportWife = getDimension(input.dimensions, 'supportWife');
    const spousePalaceConflict = items.find((item) => (
        item.dimension.key === 'harmony'
        && item.evidence.label === '夫妻宫'
        && item.evidence.effect === 'negative'
        && item.strength === 'high'
    ));

    if (spousePalaceConflict) {
        risks.push(toMatrixEntry('riskPriority', '矛盾优先级', spousePalaceConflict));
    }
    if (supportWife.score <= 55) {
        risks.push(matrixEntry('riskPriority', '矛盾优先级', 'negative', 'high', '帮妻与女命夫星承接偏弱，先看官杀清浊、制化与现实压力边界。', ['PG-02']));
    }
    if (supportHusband.score <= 55) {
        risks.push(matrixEntry('riskPriority', '矛盾优先级', 'negative', 'high', '旺夫与男命财星承接偏弱，先看财星能否成用以及比劫是否夺财。', ['FS-01', 'FS-02']));
    }
    if (input.marriageYears.length === 0) {
        risks.push(matrixEntry('riskPriority', '矛盾优先级', 'negative', 'medium', '两盘未取到同年婚缘共振，婚期不宜强定年份。', ['YQ-01', 'EXP-01']));
    }
    if (harmony.score <= 55 && supportHusband.score <= 60 && supportWife.score <= 60) {
        risks.push(matrixEntry('riskPriority', '矛盾优先级', 'negative', 'high', '夫妻宫与互补承接同时偏弱，此盘不宜只看单项吉象。', ['HM-01', 'PG-01']));
    }

    return risks.slice(0, 3);
}

export function buildBaziMatchEvidenceMatrix(input: BaziMatchEvidenceMatrixInput): BaziMatchMatrixEntry[] {
    const items = flattenEvidence(input.dimensions);
    const positive = pickEvidence(items, 'positive');
    const negative = pickEvidence(items, 'negative');
    const spouseStarPalaceItems = filterEvidenceItems(items, (item) => (
        item.dimension.key === 'harmony'
        || item.evidence.label.includes('财星')
        || item.evidence.label.includes('偏财')
        || item.evidence.label.includes('夫星')
        || item.evidence.label.includes('官杀')
    ));
    const elementItems = filterEvidenceItems(items, (item) => (
        item.evidence.label.includes('所需')
        || item.evidence.label.includes('大运')
        || item.evidence.label.includes('未来三十年')
    ));
    const relationItems = filterEvidenceItems(items, (item) => (
        item.dimension.key === 'harmony'
        || item.evidence.label.includes('夫妻宫')
        || item.evidence.label.includes('日干')
        || item.evidence.label.includes('命宫')
    ));
    const fortuneItems = filterEvidenceItems(items, (item) => item.dimension.key === 'longevity');

    return [
        positive
            ? toMatrixEntry('bestFit', '最合之处', positive)
            : matrixEntry('bestFit', '最合之处', 'neutral', 'low', '未见特别突出的强合点，按整体中和看。'),
        negative
            ? toMatrixEntry('mainConflict', '最大冲突', negative)
            : matrixEntry('mainConflict', '最大冲突', 'neutral', 'low', '未见明显重冲重刑，后天经营比命局冲克更关键。'),
        buildCompositeEntry('spouseStarPalace', '夫妻星宫', spouseStarPalaceItems, '夫妻星宫未见集中异常，按中性参考。'),
        buildCompositeEntry('elementComplement', '喜忌互补', elementItems, '双方五行互补信号不集中，按中性参考。'),
        buildCompositeEntry('relationImpact', '冲刑合害', relationItems, '双方合冲刑害信号不集中，按中性参考。'),
        buildCompositeEntry('fortuneTiming', '岁运同步', fortuneItems, input.marriageTiming?.summary || '未来大运节奏按中性参考。'),
        buildMarriageTimingEntry(input),
        ...buildRiskPriorityEntries(input, items),
    ];
}

function calculateWeightedMatchScore(input: BaziMatchEvidenceMatrixInput, matrix: BaziMatchMatrixEntry[]): number {
    const weightedScore = input.dimensions.reduce((sum, item) => sum + item.score * DIMENSION_WEIGHTS[item.key], 0);
    const priorityRisks = matrix.filter((item) => item.category === 'riskPriority' && item.direction === 'negative');
    const highRisks = priorityRisks.filter((item) => item.strength === 'high');
    const mediumRisks = priorityRisks.filter((item) => item.strength === 'medium');
    const positiveHighCount = matrix.filter((item) => item.direction === 'positive' && item.strength === 'high').length;
    let score = weightedScore + Math.min(3, positiveHighCount);

    score -= highRisks.length * 4;
    score -= mediumRisks.length * 2;
    if (input.marriageYears.length > 0 && highRisks.length === 0) {
        score += 2;
    }

    const caps: number[] = [100];
    if (highRisks.some((item) => item.detail.includes('夫妻宫'))) {
        caps.push(72);
    }
    if (getDimension(input.dimensions, 'supportHusband').score <= 55 || getDimension(input.dimensions, 'supportWife').score <= 55) {
        caps.push(74);
    }
    if (highRisks.length >= 2) {
        caps.push(68);
    }
    if (input.marriageYears.length === 0) {
        caps.push(82);
    }

    return clampScore(Math.min(score, ...caps));
}

export function buildBaziMatchReview(
    totalScore: number,
    grade: BaziMatchGrade,
    matrix: BaziMatchMatrixEntry[],
): BaziMatchReview {
    const bestFit = matrix.find((item) => item.category === 'bestFit')?.detail || '未见特别突出的强合点。';
    const mainConflict = matrix.find((item) => item.category === 'mainConflict')?.detail || '未见明显重冲重刑。';
    const risks = matrix.filter((item) => item.category === 'riskPriority');
    const highRiskCount = risks.filter((item) => item.strength === 'high').length;
    const canProceed: BaziMatchReview['canProceed'] = totalScore >= 85 && highRiskCount === 0
        ? 'strong'
        : totalScore >= 70 && highRiskCount <= 1
            ? 'workable'
            : totalScore >= 55
                ? 'cautious'
                : 'difficult';
    const baseSummary = buildSummary(totalScore, grade);
    const mainLine = canProceed === 'strong'
        ? `${baseSummary} 此盘以互补成局为主，可成之处较明。`
        : canProceed === 'workable'
            ? `${baseSummary} 此盘能成，但要先认清一处核心冲突。`
            : canProceed === 'cautious'
                ? `${baseSummary} 此盘不可只看合象，需先处理星宫与喜忌上的压力。`
                : `${baseSummary} 此盘冲克承接偏重，成局难度较高。`;

    return {
        mainLine,
        canProceed,
        scoreReview: highRiskCount > 0
            ? '总分已按夫妻星宫、喜忌互补和矛盾优先级压制，不按五维简单平均。'
            : '总分以夫妻星宫、喜忌互补和岁运共振为主，五维分数只作展示参考。',
        bestFit,
        mainConflict,
        priorities: risks.length > 0
            ? risks.map((item) => item.detail)
            : ['先看最合之处能否落到日常分工，再看婚期应期是否形成同年共振。'],
    };
}

function buildSummary(totalScore: number, grade: BaziMatchGrade): string {
    if (grade === '优') return `总婚配指数 ${totalScore}，整体属于高契合组合。`;
    if (grade === '良') return `总婚配指数 ${totalScore}，整体匹配良好，但仍需关注局部冲突。`;
    if (grade === '中') return `总婚配指数 ${totalScore}，互补与冲突并存，关系质量取决于后天经营。`;
    return `总婚配指数 ${totalScore}，冲克信号较集中，若进入长期关系需先处理核心矛盾。`;
}

export function calculateBaziMatch(male: BaziResult, female: BaziResult, referenceDate: Date = new Date()): BaziCompatibilityResult {
    const maleProfile = buildBaziMatchProfile(male, referenceDate);
    const femaleProfile = buildBaziMatchProfile(female, referenceDate);
    const dimensions = [
        scoreHarmony(maleProfile, femaleProfile),
        scoreSupportHusband(maleProfile, femaleProfile),
        scoreSupportWife(maleProfile, femaleProfile),
        scoreOffspring(maleProfile, femaleProfile),
        scoreLifecycle(maleProfile, femaleProfile),
    ];
    const marriageTiming = buildMarriageTiming(male, female, maleProfile, femaleProfile);
    const marriageYears = buildMarriageYears(maleProfile, femaleProfile, marriageTiming);
    const evidenceMatrix = buildBaziMatchEvidenceMatrix({
        maleProfile,
        femaleProfile,
        dimensions,
        marriageYears,
        marriageTiming,
    });
    const totalScore = calculateWeightedMatchScore({
        maleProfile,
        femaleProfile,
        dimensions,
        marriageYears,
        marriageTiming,
    }, evidenceMatrix);
    const grade = getBaziMatchGrade(totalScore);
    const review = buildBaziMatchReview(totalScore, grade, evidenceMatrix);
    const nowIso = new Date().toISOString();

    return {
        id: `bazi-match-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: nowIso,
        calculatedAt: nowIso,
        male,
        female,
        maleProfile,
        femaleProfile,
        dimensions,
        totalScore,
        grade,
        summary: review.mainLine,
        marriageYears,
        marriageTiming,
        review,
        evidenceMatrix,
    };
}
