import { cloneZiweiFormatterContext, ZiweiFormatterContext } from '../features/ziwei/ai-context';
import {
    buildZiweiHoroscopePalaceView,
} from '../features/ziwei/view-model';
import {
    computeZiweiChart,
} from '../features/ziwei/iztro-adapter';
import { formatLocalDateTime } from '../core/bazi-local-time';
import { toZiweiInputPayload, type ZiweiRecordResult } from '../features/ziwei/record';
import type {
    ZiweiActiveScope,
    ZiweiDirectHoroscopeScopeView,
    ZiweiPalaceAnalysisView,
    ZiweiStarViewModel,
} from '../features/ziwei/types';

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

function formatScopeSummary(
    record: ZiweiRecordResult,
    chart: ReturnType<typeof computeZiweiChart>,
    cursorDate: Date,
): string[] {
    return [
        `- 当前大限：${chart.horoscopeSummary.decadal}`,
        `- 当前小限：${chart.horoscopeSummary.age}`,
        `- 当前流年：${chart.horoscopeSummary.yearly}`,
        `- 当前流月：${chart.horoscopeSummary.monthly}`,
        `- 当前流日：${chart.horoscopeSummary.daily}`,
        `- 当前流时：${chart.horoscopeSummary.hourly}`,
        `- 今年锚点：${new Date().getFullYear()}年（AI 的“今年/未来五年”统一按设备当前日期解释）`,
        `- 当前游标：${formatCursorDate(cursorDate)}`,
        `- 命盘记录：${record.id}`,
    ];
}

function resolveDirectScope(
    chart: ReturnType<typeof computeZiweiChart>,
    scope: ZiweiActiveScope,
): ZiweiDirectHoroscopeScopeView | null {
    return scope !== 'age'
        ? chart.directHoroscopeByScope[scope] || null
        : null;
}

function buildFocusLines(
    record: ZiweiRecordResult,
    chart: ReturnType<typeof computeZiweiChart>,
    context?: ZiweiFormatterContext,
): string[] {
    const activeScope = context?.activeScope || 'yearly';
    const selectedPalaceName = context?.selectedPalaceName || '命宫';
    const selectedPalace = chart.palaceByName[selectedPalaceName] || chart.palaceByName.命宫;
    const selectedScopePalace = activeScope === 'age'
        ? null
        : buildZiweiHoroscopePalaceView(
            chart.astrolabe,
            chart.horoscopeNow,
            selectedPalace.name,
            activeScope,
            resolveDirectScope(chart, activeScope),
        );

    const lines = [
        `- 当前页签：${context?.activeTopTab || 'chart'}`,
        `- 当前聚焦宫位：${selectedPalace.name} · ${selectedPalace.heavenlyStem}${selectedPalace.earthlyBranch}`,
        `- 当前聚焦星曜：${context?.selectedStarName || '未选定，默认宫位首星'}`,
        `- 当前运限层：${formatScopeLabel(activeScope)}`,
    ];

    if (selectedScopePalace) {
        lines.push(`- 运限映射：${selectedScopePalace.requestedPalaceName} → ${selectedScopePalace.resolvedPalaceName} · ${selectedScopePalace.heavenlyStem}${selectedScopePalace.earthlyBranch}`);
        lines.push(`- 运限四化：${selectedScopePalace.mutagenStars.lu || '无禄'} / ${selectedScopePalace.mutagenStars.quan || '无权'} / ${selectedScopePalace.mutagenStars.ke || '无科'} / ${selectedScopePalace.mutagenStars.ji || '无忌'}`);
        lines.push(`- 直取流耀：${selectedScopePalace.directHoroscopeStars.join('、') || '无'}`);
    }

    if (record.aiContextSnapshot) {
        lines.push(`- 轻量盘据：${record.aiContextSnapshot.chartSummary}`);
        lines.push(`- 默认运限摘要：${record.aiContextSnapshot.scopeSummary}`);
    }

    return lines;
}

function buildPalaceLines(palace: ZiweiPalaceAnalysisView): string[] {
    return [
        `- ${palace.name} ${palace.heavenlyStem}${palace.earthlyBranch}${formatPalaceFlags(palace)} | 大限 ${palace.decadalRange} | 小限 ${palace.ages}`,
        `  主星：${formatStarGroup(palace.majorStars)}`,
        `  辅曜：${formatStarGroup(palace.minorStars)}`,
        `  杂耀：${formatStarGroup(palace.adjectiveStars)}`,
        `  长生/博士/岁前/将前：${palace.changsheng12} / ${palace.boshi12} / ${palace.suiqian12} / ${palace.jiangqian12}`,
    ];
}

function buildStructureLines(palace: ZiweiPalaceAnalysisView): string[] {
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

export function formatZiweiToText(record: ZiweiRecordResult, runtimeContext?: ZiweiFormatterContext): string {
    const context = cloneZiweiFormatterContext(runtimeContext);
    const cursorDate = parseCursorDate(context);
    const chart = computeZiweiChart(
        toZiweiInputPayload(record),
        cursorDate,
    );

    const lines: string[] = [
        '【紫微斗数命盘】',
        '【盘头】',
        `- 姓名：${record.name?.trim() || '未填写'}`,
        `- 性别：${record.gender === 'male' ? '男命' : '女命'}`,
        `- 出生地：${record.cityLabel || '未设置出生地'}`,
        `- 输入语义：${record.calendarType === 'lunar' && record.lunar
            ? `农历 ${record.lunar.label || `${record.lunar.year}-${record.lunar.month}-${record.lunar.day}`}`
            : `公历 ${formatDateTime(record.birthLocal)}`}`,
        `- 真太阳时：${formatDateTime(record.trueSolarDateTimeLocal)} · ${record.timeLabel} (${record.timeRange})`,
        `- 节气四柱：${record.chineseDate}`,
        `- 五行局：${record.fiveElementsClass}`,
        `- 命主 / 身主：${record.soul} / ${record.body}`,
        `- 当前配置：${record.config.algorithm === 'zhongzhou' ? '中州算法' : '通行算法'} · ${record.config.yearDivide === 'exact' ? '年界立春' : '年界农历'} · ${record.config.horoscopeDivide === 'exact' ? '运限立春' : '运限农历'} · ${record.config.dayDivide === 'current' ? '晚子当日' : '晚子次日'} · ${record.config.astroType === 'earth' ? '地盘' : record.config.astroType === 'human' ? '人盘' : '天盘'}`,
        '',
        '【本命盘】',
    ];

    chart.palaces.forEach((palace) => {
        lines.push(...buildPalaceLines(palace));
    });

    lines.push('');
    lines.push('【结构层】');
    chart.palaces.forEach((palace) => {
        lines.push(...buildStructureLines(palace));
    });

    lines.push('');
    lines.push('【运限层】');
    formatScopeSummary(record, chart, cursorDate).forEach((line: string) => lines.push(line));

    lines.push('');
    lines.push('【当前焦点】');
    buildFocusLines(record, chart, context).forEach((line) => lines.push(line));

    if (record.aiContextSnapshot) {
        lines.push('');
        lines.push('【轻量盘据】');
        lines.push(`- 输入摘要：${record.aiContextSnapshot.inputSummary}`);
        lines.push(`- 校时摘要：${record.aiContextSnapshot.trueSolarSummary}`);
        lines.push(`- 命盘摘要：${record.aiContextSnapshot.chartSummary}`);
        lines.push(`- 命宫摘要：${record.aiContextSnapshot.palaceSummary}`);
        lines.push(`- 默认运限：${record.aiContextSnapshot.scopeSummary}`);
    }

    return lines.join('\n');
}
