import { BaziCompatibilityResult, BaziMarriageYearCandidate, BaziMatchMatrixEntry, BaziMatchProfile, BaziMatchReview } from './types';
import { getBaziMatchClassicRefs, getBaziMatchDimensionReferenceFallbackIds } from './classic-references';
import { buildBaziMatchEvidenceMatrix, buildBaziMatchReview } from './rules';

const DISPLAY_MARRIAGE_MIN_AGE = 18;
const DISPLAY_MARRIAGE_MAX_AGE = 45;
const DISPLAY_MARRIAGE_LIMIT = 2;

function formatReferenceNames(ids?: readonly string[]): string {
    return getBaziMatchClassicRefs(ids).map((item) => `${item.title}（${item.source}）`).join('；');
}

function formatProfile(profile: BaziMatchProfile): string[] {
    return [
        `姓名：${profile.name}`,
        `命造：${profile.mingZaoLabel}（${profile.genderLabel}）`,
        `四柱：${profile.fourPillars.join(' ')}`,
        `日干/日支：${profile.dayStem}/${profile.dayBranch}`,
        `生肖地支：${profile.yearBranch}`,
        `命宫地支：${profile.mingGongBranch || '未记录'}`,
        `五行计数（统计，非旺衰定论）：${Object.entries(profile.elementCounts).map(([key, value]) => `${key}${value}`).join('、')}`,
        `偏需五行（规则参考，非已定用神）：${profile.neededElements.join('、') || '未见明显偏需'}`,
        `旺势五行（规则参考）：${profile.dominantElements.join('、')}`,
        `十神计数：${Object.entries(profile.starCounts).map(([key, value]) => `${key}${value}`).join('、') || '未记录'}`,
        `神煞：${profile.shenSha.join('、') || '无明显神煞'}`,
        `未来大运：${profile.futureDaYun.map((item) => `${item.startYear}-${item.endYear} ${item.ganZhi}`).join('；') || '未记录'}`,
    ];
}

function hasDisplayMarriageAge(item: BaziMarriageYearCandidate): boolean {
    return typeof item.maleAge === 'number'
        && typeof item.femaleAge === 'number'
        && item.maleAge >= DISPLAY_MARRIAGE_MIN_AGE
        && item.maleAge <= DISPLAY_MARRIAGE_MAX_AGE
        && item.femaleAge >= DISPLAY_MARRIAGE_MIN_AGE
        && item.femaleAge <= DISPLAY_MARRIAGE_MAX_AGE;
}

function formatCanProceed(value: BaziMatchReview['canProceed']): string {
    if (value === 'strong') return '成局较稳';
    if (value === 'workable') return '可以成局';
    if (value === 'cautious') return '谨慎成局';
    if (value === 'difficult') return '成局较难';
    return '未定';
}

export function getDisplayMarriageYears(result: BaziCompatibilityResult): BaziMarriageYearCandidate[] {
    return result.marriageYears
        .filter((item) => hasDisplayMarriageAge(item))
        .slice(0, DISPLAY_MARRIAGE_LIMIT);
}

export function formatBaziMatchForAI(result: BaziCompatibilityResult): string {
    const lines: string[] = [];
    const displayMarriageYears = getDisplayMarriageYears(result);
    const evidenceMatrix = result.evidenceMatrix || buildBaziMatchEvidenceMatrix({
        maleProfile: result.maleProfile,
        femaleProfile: result.femaleProfile,
        dimensions: result.dimensions,
        marriageYears: displayMarriageYears,
        marriageTiming: result.marriageTiming,
    });
    const review = result.review || buildBaziMatchReview(result.totalScore, result.grade, evidenceMatrix);
    lines.push('【合盘对象】');
    lines.push('男方：');
    formatProfile(result.maleProfile).forEach((line) => lines.push(`- ${line}`));
    lines.push('女方：');
    formatProfile(result.femaleProfile).forEach((line) => lines.push(`- ${line}`));
    lines.push('【本地规则参考】');
    lines.push('以下总分、分级、总断和证据矩阵来自同一规则系统，不是独立验证或婚姻成功概率；高分不能抵消具体负面证据。');
    lines.push(`- 总分：${result.totalScore}（${result.grade}）`);
    lines.push(`- 总断：${review.mainLine}`);
    lines.push(`- 能否成局：${formatCanProceed(review.canProceed)}`);
    lines.push(`- 分数口径：${review.scoreReview}`);
    lines.push(`- 最合之处：${review.bestFit}`);
    lines.push(`- 最大冲突：${review.mainConflict}`);
    lines.push(`- 矛盾优先级：${review.priorities.join('；')}`);
    lines.push('【证据矩阵（规则匹配及解释参考）】');
    evidenceMatrix.forEach((item: BaziMatchMatrixEntry) => {
        const refs = formatReferenceNames(item.referenceIds);
        const direction = { positive: '正向参考', negative: '负向参考', neutral: '中性参考' }[item.direction];
        const strength = { high: '较强', medium: '中等', low: '较弱' }[item.strength];
        lines.push(`- ${item.title}：${direction} / ${strength}。${item.detail}${refs ? `（取法依据：${refs}）` : ''}`);
    });
    lines.push('【五维分数参考】');
    result.dimensions.forEach((dimension) => {
        const refs = formatReferenceNames(getBaziMatchDimensionReferenceFallbackIds(dimension.key));
        lines.push(`- ${dimension.title}：${dimension.score}（${dimension.grade}，参考依据：${refs}）`);
        dimension.evidence.slice(0, 2).forEach((item) => {
            const refs = formatReferenceNames(item.referenceIds && item.referenceIds.length > 0
                ? item.referenceIds
                : getBaziMatchDimensionReferenceFallbackIds(dimension.key));
            lines.push(`  - ${item.label}：${item.detail}${refs ? `（典籍依据：${refs}）` : ''}`);
        });
    });
    lines.push('【婚期候选（不代表确定结婚年份）】');
    if (displayMarriageYears.length === 0) {
        lines.push('- 两盘近年未见同年应期，暂不定具体婚年。');
    } else {
        displayMarriageYears.forEach((item) => {
            const prefix = item.kind === 'trigger' ? '规则触发候选' : '参考候选';
            const ageText = item.maleAge && item.femaleAge ? `，男方${item.maleAge}岁，女方${item.femaleAge}岁` : '';
            const refs = formatReferenceNames(item.referenceIds);
            lines.push(`- ${prefix}：${item.year}年 ${item.ganZhi}${ageText}，依据：${item.reasons.slice(0, 3).join('；')}${refs ? `（典籍依据：${refs}）` : ''}`);
        });
    }
    return lines.join('\n');
}

export function buildBaziMatchSummaryTitle(result: BaziCompatibilityResult): string {
    return `${result.maleProfile.name} × ${result.femaleProfile.name}`;
}

export function buildBaziMatchSummarySubtitle(result: BaziCompatibilityResult): string {
    return `合盘 · ${result.totalScore}分 · ${result.grade}`;
}
