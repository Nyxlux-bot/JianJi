import { formatLocalDateTime } from '../../core/bazi-local-time';
import type { ZiweiFormatterContext } from './ai-context';
import { computeZiweiDynamicHoroscope, computeZiweiStaticChart } from './iztro-adapter';
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
        `- ${palace.name} ${palace.heavenlyStem}${palace.earthlyBranch}${formatPalaceFlags(palace)} | 大限 ${palace.decadalRange} | 小限 ${palace.ages}`,
        `  主星：${formatStarGroup(palace.majorStars)}`,
        `  辅曜：${formatStarGroup(palace.minorStars)}`,
        `  杂耀：${formatStarGroup(palace.adjectiveStars)}`,
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
        `  主星组合：${palace.surrounded.majorStars.join('、') || '无'} | 辅曜：${palace.surrounded.minorStars.join('、') || '无'} | 杂耀：${palace.surrounded.adjectiveStars.join('、') || '无'}`,
        `  生年四化：${palace.flight.birthMutagens.join(' / ') || '无'} | 自化：${palace.flight.selfMutagens.join(' / ') || '无'} | 四化去向：${formatFlightTargets(palace)}`,
        `  禄权科忌：${mutagenFlags || '无'}`,
        `  判定标签：${palace.surrounded.checks.map((item) => `${item.label}${item.matched ? '✓' : '·'}`).join(' ｜ ')}`,
    ];
}

export function buildZiweiPromptSeed(staticChart: ZiweiStaticChartResult): string {
    const lines: string[] = ['【紫微斗数命盘】'];
    lines.push(...buildZiweiHeaderLinesFromStaticChart(staticChart));
    lines.push('');
    lines.push('【本命盘】');
    staticChart.palaces.forEach((palace) => {
        lines.push(...buildZiweiStaticPalaceLines(palace));
    });
    lines.push('');
    lines.push('【结构层】');
    staticChart.palaces.forEach((palace) => {
        lines.push(...buildZiweiStructureLines(palace));
    });
    return lines.join('\n');
}

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
    return [
        `禄:${mutagenStars.lu || '--'}`,
        `权:${mutagenStars.quan || '--'}`,
        `科:${mutagenStars.ke || '--'}`,
        `忌:${mutagenStars.ji || '--'}`,
    ].join(' / ');
}

function buildScopeSummaryLines(staticChart: ZiweiStaticChartResult, dynamic: ZiweiDynamicHoroscopeResult, cursorDate: Date): string[] {
    return [
        `- 当前大限：${dynamic.horoscopeSummary.decadal}`,
        `- 当前小限：${dynamic.horoscopeSummary.age}`,
        `- 当前流年：${dynamic.horoscopeSummary.yearly}`,
        `- 当前流月：${dynamic.horoscopeSummary.monthly}`,
        `- 当前流日：${dynamic.horoscopeSummary.daily}`,
        `- 当前流时：${dynamic.horoscopeSummary.hourly}`,
        `- 当前游标：${formatCursorDate(cursorDate)}`,
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
        `- 当前小限：${dynamic.horoscopeSummary.age}`,
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
    const resolvedPalaceName = dynamic.horoscopeNow.age.palaceNames[focusPalace.palaceIndex] || dynamic.horoscopeNow.agePalace()?.name || focusPalace.name;
    const resolvedPalace = staticChart.palaceByName[resolvedPalaceName] || focusPalace;
    const [lu = '', quan = '', ke = '', ji = ''] = dynamic.horoscopeNow.age.mutagen || [];

    return `- 小限：${focusPalace.name} → ${resolvedPalace.name} · ${resolvedPalace.heavenlyStem}${resolvedPalace.earthlyBranch} | 四化：禄:${lu || '--'} / 权:${quan || '--'} / 科:${ke || '--'} / 忌:${ji || '--'} | 直取流耀：无 | 虚岁：${dynamic.horoscopeNow.age.nominalAge}`;
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

    return `- ${formatScopeLabel(scope)}：${mapped.requestedPalaceName} → ${mapped.resolvedPalaceName} · ${mapped.heavenlyStem}${mapped.earthlyBranch} | 四化：${summarizeMutagenStars(mapped.mutagenStars)} | 直取流耀：${mapped.directHoroscopeStars.join('、') || '无'}`;
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

function buildYearlyCorePalaceLines(staticChart: ZiweiStaticChartResult, dynamic: ZiweiDynamicHoroscopeResult, palaceNames: string[]): string[] {
    const yearlyDirect = buildZiweiDirectHoroscopeScopeViewByScope(
        staticChart.astrolabe,
        dynamic.horoscopeNow,
        'yearly',
        staticChart.input.config.algorithm,
    );

    return palaceNames.map((palaceName) => {
        const mapped = buildZiweiHoroscopePalaceView(
            dynamic.horoscopeNow,
            palaceName,
            'yearly',
            yearlyDirect,
        );
        if (!mapped) {
            return `  - ${palaceName}：无法定位流年映射`;
        }
        return `  - ${palaceName}：${mapped.requestedPalaceName} → ${mapped.resolvedPalaceName} · ${mapped.heavenlyStem}${mapped.earthlyBranch} | 四化：${summarizeMutagenStars(mapped.mutagenStars)} | 直取流耀：${mapped.directHoroscopeStars.join('、') || '无'}`;
    });
}

function buildYearlyTriggerHighlights(staticChart: ZiweiStaticChartResult, dynamic: ZiweiDynamicHoroscopeResult, palaceNames: string[]): string {
    const yearlyDirect = buildZiweiDirectHoroscopeScopeViewByScope(
        staticChart.astrolabe,
        dynamic.horoscopeNow,
        'yearly',
        staticChart.input.config.algorithm,
    );
    const triggers = palaceNames.map((palaceName) => {
        const mapped = buildZiweiHoroscopePalaceView(
            dynamic.horoscopeNow,
            palaceName,
            'yearly',
            yearlyDirect,
        );
        if (!mapped) {
            return '';
        }

        const tags = [
            mapped.mutagenStars.lu ? `禄:${mapped.mutagenStars.lu}` : '',
            mapped.mutagenStars.quan ? `权:${mapped.mutagenStars.quan}` : '',
            mapped.mutagenStars.ke ? `科:${mapped.mutagenStars.ke}` : '',
            mapped.mutagenStars.ji ? `忌:${mapped.mutagenStars.ji}` : '',
            mapped.directHoroscopeStars.length > 0 ? `流耀:${mapped.directHoroscopeStars.join('/')}` : '',
        ].filter(Boolean);

        return tags.length > 0 ? `${palaceName}(${tags.join(' ')})` : '';
    }).filter(Boolean);

    return buildFocusTriggerSummary(triggers);
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

    return [
        `- ${label}：${year}年 | 大限：${dynamic.horoscopeSummary.decadal} | 小限：${dynamic.horoscopeSummary.age} | 流年：${dynamic.horoscopeSummary.yearly}`,
        ...buildYearlyCorePalaceLines(staticChart, dynamic, palaceNames),
        `  - 重点宫位触发：${buildYearlyTriggerHighlights(staticChart, dynamic, palaceNames)}`,
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
    const lines: string[] = ['【紫微斗数命盘】'];

    lines.push(...buildZiweiHeaderLinesFromRecord(record));
    lines.push('');
    lines.push('【本命盘】');
    staticChart.palaces.forEach((palace) => {
        lines.push(...buildZiweiStaticPalaceLines(palace));
    });
    lines.push('');
    lines.push('【结构层】');
    staticChart.palaces.forEach((palace) => {
        lines.push(...buildZiweiStructureLines(palace));
    });
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
    options: { enhancedEvidence?: boolean } = {},
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
    const runtimeDate = resolveStageRuntimeDate(stage, runtimeContext);
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
    const lines: string[] = [
        record.aiContextSnapshot?.promptSeed?.trim() || buildZiweiPromptSeed(staticChart),
    ];
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
        lines.push('【当前选中宫位六层映射】');
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
