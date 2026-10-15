import { formatLocalDateTime } from '../../core/bazi-local-time';
import type { ZiweiFormatterContext } from './ai-context';
import { detectZiweiPatterns, ZIWEI_PATTERN_BASIS_LABEL, ZIWEI_PATTERN_TONE_LABEL } from './patterns';
import { computeZiweiDynamicHoroscope, computeZiweiStaticChart } from './iztro-adapter';
import { stemMutagenStars, zh } from './scope-layer';
import type {
    ZiweiActiveScope,
    ZiweiComputedInput,
    ZiweiConfigOptions,
    ZiweiDynamicHoroscopeResult,
    ZiweiDynamicScope,
    ZiweiHoroscopeMutagenStars,
    ZiweiInputPayload,
    ZiweiPalaceAnalysisView,
    ZiweiStaticChartResult,
    ZiweiStarViewModel,
} from './types';
import {
    buildZiweiDirectHoroscopeScopeViewByScope,
    buildZiweiHoroscopePalaceView,
} from './view-model';

export const ZIWEI_AI_CONTEXT_VERSION = 3;
const ZIWEI_CORE_PALACE_NAMES = ['命宫', '官禄', '财帛', '夫妻', '迁移', '疾厄'] as const;

export type ZiweiAIWorkflowStage =
    | 'foundation'
    | 'verification'
    | 'five_year'
    | 'followup'
    | 'digest'
    | 'quick_replies';

export interface ZiweiRecordLike {
    birthLocal: string;
    longitude: number;
    gender: 'male' | 'female';
    tzOffsetMinutes: number;
    daylightSavingEnabled: boolean;
    calendarType: 'solar' | 'lunar';
    lunar?: ZiweiInputPayload['lunar'];
    config: ZiweiConfigOptions;
    cityLabel?: string;
    name?: string;
    solarDate: string;
    trueSolarDateTimeLocal: string;
    timeLabel: string;
    timeRange: string;
    lunarDate: string;
    chineseDate: string;
    fiveElementsClass: string;
    soul: string;
    body: string;
    aiContextSnapshot?: {
        promptSeed?: string;
    };
}

export interface ZiweiStageContextBundle {
    text: string;
    usedDynamicEvidencePack: boolean;
    yearWindow?: string;
    focusPalaceName: string;
    scopeLabel: string;
}

function formatDateTime(value: string): string {
    return value.replace('T', ' ');
}

function formatCursorDate(date: Date): string {
    return formatLocalDateTime(date).replace('T', ' ');
}

function parseCursorDate(context?: ZiweiFormatterContext): Date {
    if (!context?.cursorDateIso) {
        return new Date();
    }

    const parsed = new Date(context.cursorDateIso);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function resolveStageRuntimeDate(stage: ZiweiAIWorkflowStage, context?: ZiweiFormatterContext): Date {
    if (stage === 'verification' || stage === 'five_year' || stage === 'digest') {
        return new Date();
    }

    return parseCursorDate(context);
}

function toInputPayload(record: ZiweiRecordLike): ZiweiInputPayload {
    return {
        birthLocal: record.birthLocal,
        longitude: record.longitude,
        gender: record.gender,
        tzOffsetMinutes: record.tzOffsetMinutes,
        daylightSavingEnabled: record.daylightSavingEnabled,
        calendarType: record.calendarType,
        lunar: record.lunar,
        config: record.config,
        cityLabel: record.cityLabel,
        name: record.name,
    };
}

export function formatZiweiConfigSummary(input: Pick<ZiweiRecordLike, 'config'> | Pick<ZiweiComputedInput, 'config'>): string {
    return `${input.config.algorithm === 'zhongzhou' ? '中州算法' : '通行算法'} · ${input.config.yearDivide === 'exact' ? '年界立春' : '年界农历'} · ${input.config.horoscopeDivide === 'exact' ? '运限立春' : '运限农历'} · ${input.config.dayDivide === 'current' ? '晚子当日' : '晚子次日'} · ${input.config.astroType === 'earth' ? '地盘' : input.config.astroType === 'human' ? '人盘' : '天盘'}`;
}

function formatInputSummary(input: ZiweiComputedInput): string {
    if (input.calendarType === 'lunar' && input.lunar) {
        return `农历 ${input.lunar.label || `${input.lunar.year}-${input.lunar.month}-${input.lunar.day}`}`;
    }
    return `公历 ${input.birthLocal.replace('T', ' ')}`;
}

function formatRecordInputSummary(record: ZiweiRecordLike): string {
    if (record.calendarType === 'lunar' && record.lunar) {
        return `农历 ${record.lunar.label || `${record.lunar.year}-${record.lunar.month}-${record.lunar.day}`}`;
    }
    return `公历 ${record.birthLocal.replace('T', ' ')}`;
}

function formatStar(star: ZiweiStarViewModel): string {
    return [star.name, star.brightness || '', star.mutagen ? `化${star.mutagen}` : '']
        .filter(Boolean)
        .join('');
}

function formatStarGroup(stars: ZiweiStarViewModel[]): string {
    return stars.length > 0 ? stars.map(formatStar).join('、') : '无';
}

function formatFlightTargets(palace: ZiweiPalaceAnalysisView): string {
    return palace.flight.destinations
        .map((item) => `${item.mutagen}→${item.palaceName || '无'}`)
        .join(' · ') || '无';
}

function formatPalaceFlags(palace: ZiweiPalaceAnalysisView): string {
    const flags = [
        palace.isBodyPalace ? '身宫' : '',
        palace.isOriginalPalace ? '来因宫' : '',
        palace.isEmpty ? '空宫' : '',
    ].filter(Boolean);

    return flags.length > 0 ? ` [${flags.join(' / ')}]` : '';
}

/*
 * 统一写法：字段之间用「 | 」，列表内用「 · 」或「、」，标签后用全角冒号；
 * 四化一律写成「禄 天同 · 权 天机 · 科 文昌 · 忌 廉贞」，需要时在星名后括注本命落宫。
 */

const PALACE_SEQUENCE = ['命宫', '兄弟', '夫妻', '子女', '财帛', '疾厄', '迁移', '仆役', '交友', '官禄', '田宅', '福德', '父母'];
const BRANCHES = '子丑寅卯辰巳午未申酉戌亥';
const YANG_STEMS = '甲丙戊庚壬';
const MUTAGEN_LABELS = ['禄', '权', '科', '忌'] as const;

/** 按「命宫、兄弟、夫妻……父母」的十二宫次序排，读盘时从命宫起 */
function orderedPalaces(palaces: ZiweiPalaceAnalysisView[]): ZiweiPalaceAnalysisView[] {
    const rank = (name: string) => {
        const order = PALACE_SEQUENCE.indexOf(name);
        return order < 0 ? PALACE_SEQUENCE.length : order;
    };
    return [...palaces].sort((a, b) => rank(a.name) - rank(b.name));
}

function homeOfStar(palaces: ZiweiPalaceAnalysisView[], starName: string): ZiweiPalaceAnalysisView | undefined {
    return palaces.find((palace) => [...palace.majorStars, ...palace.minorStars].some((star) => star.name === starName));
}

function formatGanzhi(palace: ZiweiPalaceAnalysisView): string {
    return `${palace.heavenlyStem}${palace.earthlyBranch}`;
}

function formatDecadeRange(palace: ZiweiPalaceAnalysisView): string {
    return `${palace.decadalRange.replace(/[^\d–-]/g, '').replace('-', '–')}岁`;
}

/** 四化一行：传入本命十二宫时在星名后括注落宫 */
function formatMutagenRow(stars: string[], palaces?: ZiweiPalaceAnalysisView[]): string {
    return MUTAGEN_LABELS.map((label, order) => {
        const star = stars[order];
        if (!star) {
            return `${label} —`;
        }
        const home = palaces ? homeOfStar(palaces, star)?.name : '';
        return `${label} ${star}${home ? `（${home}）` : ''}`;
    }).join(' · ');
}

function sortedDecades(palaces: ZiweiPalaceAnalysisView[]): ZiweiPalaceAnalysisView[] {
    return [...palaces].sort((a, b) => Number.parseInt(a.decadalRange, 10) - Number.parseInt(b.decadalRange, 10));
}

/** 盘头补充：阴阳与大限顺逆、命身来因所在、命主身主落宫、生年四化落宫 */
function buildZiweiChartKeyLines(staticChart: ZiweiStaticChartResult): string[] {
    const palaces = staticChart.palaces;
    const ming = staticChart.palaceByName.命宫;
    const body = palaces.find((palace) => palace.isBodyPalace);
    const origin = palaces.find((palace) => palace.isOriginalPalace);
    // 来因宫干就是排盘所用的年干（随年界设置）
    const yearStem = origin?.heavenlyStem || String(staticChart.astrolabe.chineseDate || '').slice(0, 1);
    const decades = sortedDecades(palaces);
    const forward = decades.length > 1
        && (BRANCHES.indexOf(decades[1].earthlyBranch) - BRANCHES.indexOf(decades[0].earthlyBranch) + 12) % 12 === 1;
    const soul = String(staticChart.astrolabe.soul || '');
    const bodyStar = String(staticChart.astrolabe.body || '');
    const birthStars = MUTAGEN_LABELS.map((label) => (
        palaces.flatMap((palace) => [...palace.majorStars, ...palace.minorStars]).find((star) => star.mutagen === label)?.name || ''
    ));
    const locate = (palace?: ZiweiPalaceAnalysisView) => (palace ? `${palace.name}（${formatGanzhi(palace)}）` : '未知');
    const starHome = (star: string) => (star ? `${star}在${homeOfStar(palaces, star)?.name || '未知宫位'}` : '—');

    return [
        `- 阴阳与大限：${YANG_STEMS.includes(yearStem) ? '阳' : '阴'}${staticChart.input.gender === 'male' ? '男' : '女'} · 大限${forward ? '顺' : '逆'}行`,
        `- 命宫 / 身宫 / 来因宫：命宫${ming ? `（${formatGanzhi(ming)}）` : ''} · 身宫在${locate(body)} · 来因宫在${locate(origin)}`,
        `- 命主 / 身主落宫：${starHome(soul)} · ${starHome(bodyStar)}`,
        `- 生年四化（${yearStem}干）：${formatMutagenRow(birthStars, palaces)}`,
    ];
}

export function buildZiweiHeaderLinesFromStaticChart(staticChart: ZiweiStaticChartResult): string[] {
    const input = staticChart.input;

    return [
        '【盘头】',
        `- 姓名：${input.name?.trim() || '未填写'}`,
        `- 性别：${input.gender === 'male' ? '男命' : '女命'}`,
        `- 出生地：${input.cityLabel || '未设置出生地'}`,
        `- 输入语义：${formatInputSummary(input)}`,
        `- 真太阳时：${formatLocalDateTime(input.trueSolarDate).replace('T', ' ')} · ${input.timeLabel} (${input.timeRange})`,
        `- 北京时间：${formatLocalDateTime(input.birthLocalDate).replace('T', ' ')}`,
        `- 节气四柱：${staticChart.astrolabe.chineseDate}`,
        `- 农历：${staticChart.astrolabe.lunarDate}`,
        `- 五行局：${staticChart.astrolabe.fiveElementsClass}`,
        `- 命主 / 身主：${staticChart.astrolabe.soul} / ${staticChart.astrolabe.body}`,
        ...buildZiweiChartKeyLines(staticChart),
        `- 当前配置：${formatZiweiConfigSummary(input)}`,
    ];
}

function buildZiweiHeaderLinesFromRecord(record: ZiweiRecordLike): string[] {
    return [
        '【盘头】',
        `- 姓名：${record.name?.trim() || '未填写'}`,
        `- 性别：${record.gender === 'male' ? '男命' : '女命'}`,
        `- 出生地：${record.cityLabel || '未设置出生地'}`,
        `- 输入语义：${formatRecordInputSummary(record)}`,
        `- 真太阳时：${formatDateTime(record.trueSolarDateTimeLocal)} · ${record.timeLabel} (${record.timeRange})`,
        `- 节气四柱：${record.chineseDate}`,
        `- 农历：${record.lunarDate}`,
        `- 五行局：${record.fiveElementsClass}`,
        `- 命主 / 身主：${record.soul} / ${record.body}`,
        `- 当前配置：${formatZiweiConfigSummary(record)}`,
    ];
}

export function buildZiweiStaticPalaceLines(palace: ZiweiPalaceAnalysisView): string[] {
    return [
        `- ${palace.name} ${palace.heavenlyStem}${palace.earthlyBranch}${formatPalaceFlags(palace)} | 大限 ${formatDecadeRange(palace)} | 小限 ${palace.ages}`,
        `  主星：${formatStarGroup(palace.majorStars)}`,
        `  辅曜：${formatStarGroup(palace.minorStars)}`,
        `  杂曜：${formatStarGroup(palace.adjectiveStars)}`,
        `  长生/博士/岁前/将前：${palace.changsheng12} / ${palace.boshi12} / ${palace.suiqian12} / ${palace.jiangqian12}`,
    ];
}

export function buildZiweiStructureLines(palace: ZiweiPalaceAnalysisView): string[] {
    const mutagenFlags = [
        palace.surrounded.hasLu ? '禄' : '',
        palace.surrounded.hasQuan ? '权' : '',
        palace.surrounded.hasKe ? '科' : '',
        palace.surrounded.hasJi ? '忌' : '',
    ].filter(Boolean).join('');

    return [
        `- ${palace.name}：三方四正 ${palace.surrounded.palaceNames.join(' / ')}`,
        `  三方四正汇总：主星 ${palace.surrounded.majorStars.join('、') || '无'} | 辅曜 ${palace.surrounded.minorStars.join('、') || '无'} | 杂曜 ${palace.surrounded.adjectiveStars.join('、') || '无'}`,
        `  本宫生年四化：${palace.flight.birthMutagens.join(' / ') || '无'} | 本宫自化：${palace.flight.selfMutagens.join(' / ') || '无'} | 本宫宫干飞化去向：${formatFlightTargets(palace)}`,
        `  三方四正四化汇总：${mutagenFlags || '无'}`,
        `  规则匹配成立：${palace.surrounded.checks.filter((item) => item.matched).map((item) => item.label).join('、') || '无'}`,
        `  规则匹配不成立：${palace.surrounded.checks.filter((item) => !item.matched).map((item) => item.label).join('、') || '无'}`,
    ];
}

/** 本命盘、结构层、大限总览、命宫格局：盘种子与兼容全文共用 */
function buildZiweiStaticSectionLines(staticChart: ZiweiStaticChartResult): string[] {
    const palaces = orderedPalaces(staticChart.palaces);
    return [
        '【本命盘】',
        ...palaces.flatMap((palace) => buildZiweiStaticPalaceLines(palace)),
        '',
        '【结构层】',
        '三方四正汇总是本宫、对宫与两个三合宫的星曜合计，不等于本宫同坐；星曜所在宫位以【本命盘】为准。',
        ...palaces.flatMap((palace) => buildZiweiStructureLines(palace)),
        '',
        ...buildZiweiDecadeLines(staticChart),
        '',
        ...buildZiweiPatternLines(staticChart),
    ];
}

export function buildZiweiPromptSeed(staticChart: ZiweiStaticChartResult): string {
    const lines: string[] = ['【紫微斗数命盘】'];
    lines.push(...buildZiweiHeaderLinesFromStaticChart(staticChart));
    lines.push('');
    lines.push(...buildZiweiStaticSectionLines(staticChart));
    return lines.join('\n');
}

const DECADE_SECTION_TITLE = '【大限总览】';
const PATTERN_SECTION_TITLE = '【命宫格局】';

function buildZiweiDecadeLines(staticChart: ZiweiStaticChartResult): string[] {
    const palaces = staticChart.palaces;
    return [
        DECADE_SECTION_TITLE,
        '大限四化取该大限宫干；括号内是四化星所在的本命宫位。',
        ...sortedDecades(palaces).map((palace) => (
            `- ${formatDecadeRange(palace)} · ${palace.name} ${formatGanzhi(palace)} | 主星：${palace.majorStars.map((star) => star.name).join('、') || '空宫'} | 大限四化：${formatMutagenRow(stemMutagenStars(palace.heavenlyStem), palaces)}`
        )),
    ];
}

function buildZiweiPatternLines(staticChart: ZiweiStaticChartResult): string[] {
    const hits = detectZiweiPatterns(staticChart.palaces);
    return [
        PATTERN_SECTION_TITLE,
        '依《紫微斗数全书》卷一定富、定贵、定贫贱三局原注判定；赋文有句无注者取通行释义，后世格局另标。只作结构线索，须结合整盘与运限，不可单凭格局论断吉凶。',
        ...(hits.length > 0
            ? hits.map((hit) => {
                const source = hit.basis === 'later' ? ZIWEI_PATTERN_BASIS_LABEL.later : `${hit.source} · ${ZIWEI_PATTERN_BASIS_LABEL[hit.basis]}`;
                return `- ${hit.name}（${ZIWEI_PATTERN_TONE_LABEL[hit.tone]} · ${source}）：${hit.detail}`;
            })
            : ['- 未见《全书》所载格局']),
    ];
}

/** 旧记录存档的盘种子早于这些小节，调用时补上；不升种子版本，免得旧盘都被判为规则漂移 */
const SEED_SUPPLEMENTS: Array<[string, (staticChart: ZiweiStaticChartResult) => string[]]> = [
    [DECADE_SECTION_TITLE, buildZiweiDecadeLines],
    [PATTERN_SECTION_TITLE, buildZiweiPatternLines],
];

function formatScopeLabel(scope: ZiweiActiveScope): string {
    switch (scope) {
        case 'decadal':
            return '大限';
        case 'age':
            return '小限';
        case 'yearly':
            return '流年';
        case 'monthly':
            return '流月';
        case 'daily':
            return '流日';
        case 'hourly':
            return '流时';
        default:
            return scope;
    }
}

function formatTopTabLabel(tab?: ZiweiFormatterContext['activeTopTab']): string {
    switch (tab) {
        case 'chart':
            return '命盘';
        case 'pattern':
            return '格局分析';
        case 'palace':
            return '宫位详解';
        case 'info':
            return '基本信息';
        default:
            return '命盘';
    }
}

function summarizeMutagenStars(mutagenStars: ZiweiHoroscopeMutagenStars): string {
    return formatMutagenRow([mutagenStars.lu, mutagenStars.quan, mutagenStars.ke, mutagenStars.ji]);
}

/**
 * 一层运限的定位，干支与宫位分开写，避免「流年 · 兄弟 · 丙午」这种把流年干支和宫位并列的歧义：
 * 「流年 丙午：流年命宫落本命兄弟（戊午）」
 */
function describeScope(staticChart: ZiweiStaticChartResult, dynamic: ZiweiDynamicHoroscopeResult, scope: ZiweiActiveScope): string {
    const item = dynamic.horoscopeNow[scope];
    const home = staticChart.palaces[item.index];
    const homeText = home ? `本命${home.name}（${formatGanzhi(home)}）` : '未知宫位';
    const label = formatScopeLabel(scope);
    if (scope === 'age') {
        return `小限：小限命宫落${homeText} · 虚岁 ${dynamic.horoscopeNow.age.nominalAge}`;
    }
    const ganzhi = `${zh(item.heavenlyStem, 'Heavenly')}${zh(item.earthlyBranch, 'Earthly')}`;
    const range = scope === 'decadal' && home ? `（${formatDecadeRange(home)}）` : '';
    return `${label} ${ganzhi}${range}：${label}命宫落${homeText}`;
}

function buildScopeSummaryLines(staticChart: ZiweiStaticChartResult, dynamic: ZiweiDynamicHoroscopeResult, cursorDate: Date): string[] {
    const scopes: ZiweiActiveScope[] = ['decadal', 'age', 'yearly', 'monthly', 'daily', 'hourly'];
    return [
        ...scopes.map((scope) => (
            `- ${describeScope(staticChart, dynamic, scope)} | 四化：${formatMutagenRow(dynamic.horoscopeNow[scope].mutagen || [], staticChart.palaces)}`
        )),
        `- 本组动态资料时点：${formatCursorDate(cursorDate)}（仅对应此时点，不是其他年份的运限资料）`,
        `- 当前配置：${formatZiweiConfigSummary(staticChart.input)}`,
    ];
}

function resolveFocus(staticChart: ZiweiStaticChartResult, context?: ZiweiFormatterContext) {
    const focusPalaceName = context?.selectedPalaceName || '命宫';
    return staticChart.palaceByName[focusPalaceName] || staticChart.palaceByName.命宫 || staticChart.palaces[0];
}

function buildFocusLines(staticChart: ZiweiStaticChartResult, dynamic: ZiweiDynamicHoroscopeResult, context?: ZiweiFormatterContext): string[] {
    const focusPalace = resolveFocus(staticChart, context);
    const activeScope = context?.activeScope || 'yearly';
    const lines = [
        `- 当前页签：${formatTopTabLabel(context?.activeTopTab)}`,
        `- 当前聚焦宫位：${focusPalace.name} · ${focusPalace.heavenlyStem}${focusPalace.earthlyBranch}`,
        `- 当前聚焦星曜：${context?.selectedStarName || '未选定'}`,
        `- 当前运限层：${formatScopeLabel(activeScope)}`,
        `- 当前${describeScope(staticChart, dynamic, 'age')}`,
    ];

    if (context?.cursorDateIso) {
        lines.push(`- 当前游标：${formatCursorDate(parseCursorDate(context))}`);
    }

    return lines;
}

function buildStaticSelectedPalaceLine(palace: ZiweiPalaceAnalysisView): string {
    return `- 本命：${palace.name} · ${palace.heavenlyStem}${palace.earthlyBranch} | 主星：${palace.majorStars.map((item) => item.name).join('、') || '空宫'} | 生年四化：${palace.flight.birthMutagens.join(' / ') || '无'} | 自化：${palace.flight.selfMutagens.join(' / ') || '无'}`;
}

function buildAgeScopeMatrixLine(staticChart: ZiweiStaticChartResult, dynamic: ZiweiDynamicHoroscopeResult, focusPalace: ZiweiPalaceAnalysisView): string {
    const age = dynamic.horoscopeNow.age;
    // 找小限盘里名为「聚焦宫」的那一宫落在本命哪里（与其他运限层同一取法）；取不到时命宫退回小限宫位
    const resolvedIndex = ((age.palaceNames || []) as string[]).indexOf(focusPalace.name);
    const resolvedPalace = staticChart.palaces[resolvedIndex >= 0 ? resolvedIndex : focusPalace.name === '命宫' ? age.index : -1];
    if (!resolvedPalace) {
        return `- 小限：${focusPalace.name} → 无法定位`;
    }

    return `- 小限：小限${focusPalace.name}落本命${resolvedPalace.name}（${formatGanzhi(resolvedPalace)}） | 四化：${formatMutagenRow(age.mutagen || [])} | 直取流耀：无 | 虚岁：${age.nominalAge}`;
}

function buildDynamicScopeMatrixLine(
    staticChart: ZiweiStaticChartResult,
    dynamic: ZiweiDynamicHoroscopeResult,
    focusPalace: ZiweiPalaceAnalysisView,
    scope: ZiweiDynamicScope,
): string {
    const directScope = buildZiweiDirectHoroscopeScopeViewByScope(
        staticChart.astrolabe,
        dynamic.horoscopeNow,
        scope,
        staticChart.input.config.algorithm,
    );
    const mapped = buildZiweiHoroscopePalaceView(
        dynamic.horoscopeNow,
        focusPalace.name,
        scope,
        directScope,
    );

    if (!mapped) {
        return `- ${formatScopeLabel(scope)}：${focusPalace.name} → 无法定位`;
    }

    const label = formatScopeLabel(scope);
    return `- ${label}：${label}${mapped.requestedPalaceName}落本命${mapped.resolvedPalaceName}（${mapped.heavenlyStem}${mapped.earthlyBranch}） | 四化：${summarizeMutagenStars(mapped.mutagenStars)} | 直取流耀：${mapped.directHoroscopeStars.join('、') || '无'}`;
}

function buildSelectedPalaceMatrixLines(staticChart: ZiweiStaticChartResult, dynamic: ZiweiDynamicHoroscopeResult, context?: ZiweiFormatterContext): string[] {
    const focusPalace = resolveFocus(staticChart, context);
    const lines = [
        `- 聚焦摘要：${focusPalace.name} · ${focusPalace.heavenlyStem}${focusPalace.earthlyBranch} | 当前页签：${formatTopTabLabel(context?.activeTopTab)} | 星曜：${context?.selectedStarName || '未选定'}`,
        buildStaticSelectedPalaceLine(focusPalace),
        buildDynamicScopeMatrixLine(staticChart, dynamic, focusPalace, 'decadal'),
        buildAgeScopeMatrixLine(staticChart, dynamic, focusPalace),
        buildDynamicScopeMatrixLine(staticChart, dynamic, focusPalace, 'yearly'),
        buildDynamicScopeMatrixLine(staticChart, dynamic, focusPalace, 'monthly'),
        buildDynamicScopeMatrixLine(staticChart, dynamic, focusPalace, 'daily'),
        buildDynamicScopeMatrixLine(staticChart, dynamic, focusPalace, 'hourly'),
    ];

    return lines;
}

function buildYearAnchorDate(year: number): Date {
    return new Date(year, 6, 1, 12, 0, 0, 0);
}

function buildYearRealtimeDate(baseDate: Date, year: number): Date {
    return new Date(year, baseDate.getMonth(), baseDate.getDate(), baseDate.getHours(), baseDate.getMinutes(), 0, 0);
}

function buildFocusTriggerSummary(lines: string[]): string {
    if (lines.length === 0) {
        return '未见明显触发';
    }

    return lines.slice(0, 4).join('；');
}

function buildYearEvidenceLines(
    staticChart: ZiweiStaticChartResult,
    dynamic: ZiweiDynamicHoroscopeResult,
    focusPalaceName: string,
    year: number,
    label: string,
): string[] {
    const palaceNames = Array.from(new Set([
        ...ZIWEI_CORE_PALACE_NAMES,
        focusPalaceName,
    ]));
    const yearlyDirect = buildZiweiDirectHoroscopeScopeViewByScope(
        staticChart.astrolabe,
        dynamic.horoscopeNow,
        'yearly',
        staticChart.input.config.algorithm,
    );
    // 流年四化全年同一组，只在年头写一次；各宫只记落点、宫内实际见到的流年四化与流曜
    const triggers: string[] = [];
    const palaceLines = palaceNames.map((palaceName) => {
        const mapped = buildZiweiHoroscopePalaceView(dynamic.horoscopeNow, palaceName, 'yearly', yearlyDirect);
        if (!mapped) {
            return `  - 流年${palaceName}：无法定位`;
        }
        const inside = [
            mapped.hasLu ? `禄 ${mapped.mutagenStars.lu}` : '',
            mapped.hasQuan ? `权 ${mapped.mutagenStars.quan}` : '',
            mapped.hasKe ? `科 ${mapped.mutagenStars.ke}` : '',
            mapped.hasJi ? `忌 ${mapped.mutagenStars.ji}` : '',
        ].filter(Boolean);
        const flows = mapped.directHoroscopeStars;
        if (inside.length > 0 || flows.length > 0) {
            triggers.push(`流年${palaceName}（${[...inside, ...(flows.length > 0 ? [`流曜 ${flows.join('、')}`] : [])].join(' · ')}）`);
        }
        return `  - 流年${palaceName}：落本命${mapped.resolvedPalaceName}（${mapped.heavenlyStem}${mapped.earthlyBranch}） | 宫内流年四化：${inside.join(' · ') || '无'} | 直取流耀：${flows.join('、') || '无'}`;
    });

    return [
        `- ${label}：${year}年 | ${describeScope(staticChart, dynamic, 'decadal')} | ${describeScope(staticChart, dynamic, 'age')} | ${describeScope(staticChart, dynamic, 'yearly')}`,
        `  - 流年四化：${formatMutagenRow(dynamic.horoscopeNow.yearly.mutagen || [], staticChart.palaces)}`,
        '  - 以下是本组流年各宫的落点；大限、小限只作该锚点背景，不代替本命宫位或其他年份的四化。',
        ...palaceLines,
        `  - 重点宫位触发：${buildFocusTriggerSummary(triggers)}`,
    ];
}

function resolveVerificationYears(staticChart: ZiweiStaticChartResult, dynamic: ZiweiDynamicHoroscopeResult): number[] {
    const currentYear = dynamic.cursorDate.getFullYear();
    const birthYear = staticChart.input.birthLocalDate.getFullYear();
    const currentDecadal = staticChart.astrolabe.palaces[dynamic.horoscopeNow.decadal.index];
    const decadalStartAge = currentDecadal?.decadal.range[0] || 1;
    const decadalSwitchYear = birthYear + decadalStartAge - 1;
    const baseCandidates = [decadalSwitchYear, currentYear - 1, currentYear - 3, currentYear - 5];
    const clamped = baseCandidates
        .map((year) => Math.min(currentYear, Math.max(birthYear, year)));

    const unique = Array.from(new Set(clamped)).sort((a, b) => a - b);
    for (let year = birthYear; unique.length < 4 && year <= currentYear; year += 1) {
        if (!unique.includes(year)) {
            unique.push(year);
        }
    }

    return unique.sort((a, b) => a - b);
}

function buildVerificationTimePackLines(staticChart: ZiweiStaticChartResult, runtimeDynamic: ZiweiDynamicHoroscopeResult, focusPalaceName: string): string[] {
    const years = resolveVerificationYears(staticChart, runtimeDynamic);
    const lines = [
        `- 核验年份：${years.join(' / ')}`,
    ];

    years.forEach((year) => {
        const dynamic = computeZiweiDynamicHoroscope(staticChart, buildYearAnchorDate(year));
        const label = year === years[0] ? '大限切换锚点' : `回看 ${year} 年`;
        lines.push(...buildYearEvidenceLines(staticChart, dynamic, focusPalaceName, year, label));
    });

    return lines;
}

function buildFiveYearEvidenceLines(staticChart: ZiweiStaticChartResult, context?: ZiweiFormatterContext): { lines: string[]; yearWindow: string } {
    const cursorDate = parseCursorDate(context);
    const currentYear = cursorDate.getFullYear();
    const focusPalace = resolveFocus(staticChart, context);
    const years = Array.from({ length: 6 }, (_, index) => currentYear + index);
    const lines = [
        `- 年度窗口：${currentYear}-${currentYear + 5}`,
        '- 每组年度资料只对应标注年份及其锚点；不同年份分别取证。7 月 1 日是取数锚点，不是预测事件日期，亦不证明该年所有时点的动态层相同。',
        `- 今年实时锚点：${formatCursorDate(cursorDate)}`,
    ];

    years.forEach((year, index) => {
        if (index === 0) {
            const realtimeDynamic = computeZiweiDynamicHoroscope(staticChart, buildYearRealtimeDate(cursorDate, year));
            const yearlyAnchorDynamic = computeZiweiDynamicHoroscope(staticChart, buildYearAnchorDate(year));
            lines.push(...buildYearEvidenceLines(staticChart, realtimeDynamic, focusPalace.name, year, `今年实时快照（${year}）`));
            lines.push(...buildYearEvidenceLines(staticChart, yearlyAnchorDynamic, focusPalace.name, year, `${year} 年年度锚点（7/1 12:00）`));
            return;
        }

        const dynamic = computeZiweiDynamicHoroscope(staticChart, buildYearAnchorDate(year));
        lines.push(...buildYearEvidenceLines(staticChart, dynamic, focusPalace.name, year, `${year} 年年度锚点（7/1 12:00）`));
    });

    return {
        lines,
        yearWindow: `${currentYear}-${currentYear + 5}`,
    };
}

function buildCompatibilityFullText(record: ZiweiRecordLike, context?: ZiweiFormatterContext): string {
    const payload = toInputPayload(record);
    const staticChart = computeZiweiStaticChart(payload);
    const cursorDate = parseCursorDate(context);
    const dynamic = computeZiweiDynamicHoroscope(staticChart, cursorDate);
    const lines: string[] = ['【紫微斗数命盘】', '旧记录资料范围：下列本命资料与游标时点的动态资料分别使用；本请求没有逐年年度证据包，不得把单一时点外推到整个五年。'];

    lines.push(...buildZiweiHeaderLinesFromRecord(record));
    lines.push(...buildZiweiChartKeyLines(staticChart));
    lines.push('');
    lines.push(...buildZiweiStaticSectionLines(staticChart));
    lines.push('');
    lines.push('【运限层】');
    lines.push(...buildScopeSummaryLines(staticChart, dynamic, cursorDate));
    lines.push('');
    lines.push('【当前焦点】');
    lines.push(...buildFocusLines(staticChart, dynamic, context));

    return lines.join('\n');
}

export function buildZiweiStageContext(
    record: ZiweiRecordLike,
    stage: ZiweiAIWorkflowStage,
    runtimeContext?: ZiweiFormatterContext,
    options: { enhancedEvidence?: boolean; asOf?: Date } = {},
): ZiweiStageContextBundle {
    if (!options.enhancedEvidence) {
        const payload = toInputPayload(record);
        const staticChart = computeZiweiStaticChart(payload);
        const focusPalace = resolveFocus(staticChart, runtimeContext);
        return {
            text: buildCompatibilityFullText(record, runtimeContext),
            usedDynamicEvidencePack: false,
            focusPalaceName: focusPalace.name,
            scopeLabel: formatScopeLabel(runtimeContext?.activeScope || 'yearly'),
        };
    }

    const payload = toInputPayload(record);
    const staticChart = computeZiweiStaticChart(payload);
    const runtimeDate = options.asOf && (stage === 'verification' || stage === 'five_year')
        ? options.asOf : resolveStageRuntimeDate(stage, runtimeContext);
    const effectiveContext: ZiweiFormatterContext | undefined = runtimeContext
        ? {
            ...runtimeContext,
            cursorDateIso: runtimeDate.toISOString(),
        }
        : {
            cursorDateIso: runtimeDate.toISOString(),
        };
    const dynamic = computeZiweiDynamicHoroscope(staticChart, runtimeDate);
    const focusPalace = resolveFocus(staticChart, runtimeContext);
    const savedSeed = record.aiContextSnapshot?.promptSeed?.trim();
    const lines: string[] = [savedSeed || buildZiweiPromptSeed(staticChart)];
    if (savedSeed) {
        SEED_SUPPLEMENTS.forEach(([title, build]) => {
            if (!savedSeed.includes(title)) {
                lines.push('', ...build(staticChart));
            }
        });
    }
    lines.push('');
    lines.push('【当前焦点】');
    lines.push(...buildFocusLines(staticChart, dynamic, effectiveContext));

    let usedDynamicEvidencePack = false;
    let yearWindow: string | undefined;

    if (stage === 'verification' || stage === 'five_year' || stage === 'followup' || stage === 'digest') {
        lines.push('');
        lines.push('【运限层】');
        lines.push(...buildScopeSummaryLines(staticChart, dynamic, runtimeDate));
        usedDynamicEvidencePack = true;
    }

    if (stage === 'verification') {
        lines.push('');
        lines.push('【前事核验时间包】');
        lines.push(...buildVerificationTimePackLines(staticChart, dynamic, focusPalace.name));
    }

    if (stage === 'five_year' || stage === 'followup' || stage === 'digest') {
        lines.push('');
        lines.push(`【当前选中宫位六层映射 · ${formatCursorDate(runtimeDate)}】`);
        lines.push('各行分别属于本命、大限、小限、流年、流月、流日或流时，不可跨层替代；月日时只描述本组时点。');
        lines.push(...buildSelectedPalaceMatrixLines(staticChart, dynamic, effectiveContext));
    }

    if (stage === 'five_year' || stage === 'digest') {
        const yearly = buildFiveYearEvidenceLines(staticChart, effectiveContext);
        lines.push('');
        lines.push('【六年年度证据包】');
        lines.push(...yearly.lines);
        yearWindow = yearly.yearWindow;
    }

    return {
        text: lines.join('\n'),
        usedDynamicEvidencePack,
        yearWindow,
        focusPalaceName: focusPalace.name,
        scopeLabel: formatScopeLabel(runtimeContext?.activeScope || 'yearly'),
    };
}

export function formatZiweiToFullText(
    record: ZiweiRecordLike,
    runtimeContext?: ZiweiFormatterContext,
    options: { enhancedEvidence?: boolean } = {},
): string {
    const stage = options.enhancedEvidence ? 'digest' : 'foundation';
    return buildZiweiStageContext(record, stage, runtimeContext, options).text;
}
