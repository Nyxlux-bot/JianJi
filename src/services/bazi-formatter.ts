import { BaziFormatterContext } from '../core/bazi-ai-context';
import { buildBaziGanZhiLayer } from '../core/bazi-ganzhi-layer';
import { buildWuXingBandFromMonthBranch } from '../core/renyuan-duty';
import { getBaziChartTimeLabel, getBaziTimeModeLabel } from '../core/bazi-time';
import { BaziDaYunItem, BaziLiuNianItem, BaziLiuYueItem, BaziResult } from '../core/bazi-types';

const PILLAR_LABELS = ['年柱', '月柱', '日柱', '时柱'] as const;
export type { BaziFormatterContext } from '../core/bazi-ai-context';

function formatCangGan(result: BaziResult, index: number): string {
    const items = result.cangGan[index]?.items ?? [];
    if (items.length === 0) {
        return '无藏干';
    }
    return items.map((item) => `${item.gan}${item.shiShen}`).join('、');
}

function formatShenSha(result: BaziResult, index: number): string {
    const stars = result.shenSha.byPillar[index]?.stars ?? [];
    return stars.length > 0 ? stars.join('、') : '无神煞';
}

function formatPillarLine(result: BaziResult, index: number): string {
    return `${PILLAR_LABELS[index]}：[${result.shiShen[index]?.shiShen || '未知'}] ${result.fourPillars[index] || '未知'} (${formatCangGan(result, index)}) - [神煞: ${formatShenSha(result, index)}]`;
}

function formatCurrentDaYun(result: BaziResult): BaziDaYunItem | null {
    return result.currentDaYunIndex >= 0 ? (result.daYun[result.currentDaYunIndex] ?? null) : null;
}

function formatCurrentLiuNian(result: BaziResult, currentDaYun: BaziDaYunItem | null): BaziLiuNianItem | null {
    return currentDaYun?.liuNian.find((item) => item.isCurrent)
        ?? result.liuNian.find((item) => item.isCurrent)
        ?? null;
}

function formatCurrentLiuYue(currentLiuNian: BaziLiuNianItem | null): BaziLiuYueItem | null {
    return currentLiuNian?.liuYue.find((item) => item.isCurrent) ?? null;
}

function formatCurrentXiaoYun(result: BaziResult): BaziLiuNianItem | null {
    return result.xiaoYun.find((item) => item.isCurrent) ?? null;
}

function formatDaYunLine(item: BaziDaYunItem, currentIndex: number): string {
    const currentTag = item.index === currentIndex ? ' [当前大运]' : '';
    return `- 第${item.index + 1}步：${item.ganZhi} | ${item.startAge}-${item.endAge}岁 | ${item.startYear}-${item.endYear}年${currentTag}`;
}

function formatLiuNianList(item: BaziLiuNianItem[] | undefined): string[] {
    if (!item || item.length === 0) {
        return ['- 当前大运下暂无流年数据'];
    }
    return item.map((liuNian) => `- ${liuNian.year}年 | ${liuNian.ganZhi} | 年龄${liuNian.age}${liuNian.isCurrent ? ' [当前流年]' : ''}`);
}

function formatLiuYueList(item: BaziLiuYueItem[] | undefined): string[] {
    if (!item || item.length === 0) {
        return ['- 当前流年下暂无流月数据'];
    }
    return item.map((liuYue) => `- ${liuYue.termName} | ${liuYue.ganZhi} | ${liuYue.termDate}${liuYue.isCurrent ? ' [当前流月]' : ''}`);
}

function resolveFocusLines(result: BaziResult, context?: BaziFormatterContext): string[] {
    if (!context?.fortuneSelection) {
        return ['- 未指定专业细盘焦点，默认以当前大运与当前流年组理解。'];
    }

    const { fortuneSelection, panelMode } = context;
    const lines = [`- 当前面板：${panelMode === 'taiming' ? '胎命身' : '流年大运'}`];

    if (fortuneSelection.mode === 'xiaoyun') {
        const selectedXiaoYun = result.xiaoYun[fortuneSelection.selectedXiaoYunIndex];
        const selectedLiuYue = selectedXiaoYun?.liuYue[fortuneSelection.selectedLiuYueIndex];
        lines.push(`- 当前查看小运：${selectedXiaoYun ? `${selectedXiaoYun.age}岁 | ${selectedXiaoYun.xiaoYunGanZhi} | 同年流年${selectedXiaoYun.ganZhi}` : '未命中小运焦点'}`);
        lines.push(`- 当前查看流月：${selectedLiuYue ? `${selectedLiuYue.termName} | ${selectedLiuYue.ganZhi}` : '未命中流月焦点'}`);
        return lines;
    }

    const selectedDaYun = result.daYun[fortuneSelection.selectedDaYunIndex];
    const selectedLiuNian = selectedDaYun?.liuNian[fortuneSelection.selectedLiuNianIndex];
    const selectedLiuYue = selectedLiuNian?.liuYue[fortuneSelection.selectedLiuYueIndex];
    lines.push(`- 当前查看大运：${selectedDaYun ? `第${selectedDaYun.index + 1}步 | ${selectedDaYun.ganZhi} | ${selectedDaYun.startAge}-${selectedDaYun.endAge}岁` : '未命中大运焦点'}`);
    lines.push(`- 当前查看流年：${selectedLiuNian ? `${selectedLiuNian.year}年 | ${selectedLiuNian.ganZhi} | 年龄${selectedLiuNian.age}` : '未命中流年焦点'}`);
    lines.push(`- 当前查看流月：${selectedLiuYue ? `${selectedLiuYue.termName} | ${selectedLiuYue.ganZhi}` : '未命中流月焦点'}`);
    return lines;
}

export function formatBaziToText(result: BaziResult, relations: string[], context?: BaziFormatterContext): string {
    const lines: string[] = [];
    const relationLines = relations.length > 0 ? relations : ['未检测到客观合冲刑害关系'];
    const wuXingBand = buildWuXingBandFromMonthBranch(result.baseInfo.renYuanDutyDetail.monthBranch);
    const ganZhiLayer = buildBaziGanZhiLayer(result, context?.fortuneSelection);
    const currentDaYun = formatCurrentDaYun(result);
    const currentLiuNian = formatCurrentLiuNian(result, currentDaYun);
    const currentLiuYue = formatCurrentLiuYue(currentLiuNian);
    const currentXiaoYun = formatCurrentXiaoYun(result);
    const trueSolarDisplay = result.baseInfo.trueSolarDisplay || `${result.solarDate} ${result.trueSolarTime}`;
    const chartTimeLabel = getBaziChartTimeLabel(result.schoolOptionsResolved.timeMode);
    const timeModeLabel = getBaziTimeModeLabel(result.schoolOptionsResolved.timeMode);

    lines.push(`【命主信息】性别：${result.subject.mingZaoLabel}（${result.subject.genderLabel}） | 姓名：${result.subject.name || '未命名命盘'} | ${chartTimeLabel}：${trueSolarDisplay} | 出生地：${result.baseInfo.birthPlaceDisplay || '未设置出生地'} | 排盘口径：${timeModeLabel}`);
    lines.push('【精确排盘】');
    for (let index = 0; index < 4; index += 1) {
        lines.push(formatPillarLine(result, index));
    }
    lines.push('【命盘附加要点】');
    lines.push(`- 胎元：${result.baseInfo.taiYuan || '未记录'}`);
    lines.push(`- 命宫：${result.baseInfo.mingGong || '未记录'}`);
    lines.push(`- 身宫：${result.baseInfo.shenGong || '未记录'}`);
    lines.push(`- 空亡：${result.baseInfo.kongWang || '未记录'}`);
    lines.push(`- 命卦：${result.baseInfo.mingGua || '未记录'}`);
    lines.push(`- 人元司令：${result.baseInfo.renYuanDutyDetail.display || result.baseInfo.renYuanDuty || '未记录'}`);
    lines.push('【月令五行带】');
    lines.push(`- 月令：${result.baseInfo.renYuanDutyDetail.monthBranch || '未记录'}`);
    lines.push(`- 旺相休囚死：${wuXingBand.map((item) => `${item.element}${item.status}`).join('、')}`);
    lines.push('【系统测算的客观关系事实】');
    relationLines.forEach((line) => {
        lines.push(`- ${line}`);
    });
    lines.push('【干支分层】');
    lines.push(`- 岁运天干：${ganZhiLayer.suiYunTianGan}`);
    lines.push(`- 岁运地支：${ganZhiLayer.suiYunDiZhi}`);
    lines.push(`- 岁运整柱：${ganZhiLayer.suiYunZhengZhu}`);
    lines.push('- 分割线');
    lines.push(`- 原局天干：${ganZhiLayer.yuanJuTianGan}`);
    lines.push(`- 原局地支：${ganZhiLayer.yuanJuDiZhi}`);
    lines.push(`- 原局整柱：${ganZhiLayer.yuanJuZhengZhu}`);
    lines.push('【大运总表】');
    if (result.daYun.length === 0) {
        lines.push('- 暂无大运数据');
    } else {
        result.daYun.forEach((item) => {
            lines.push(formatDaYunLine(item, result.currentDaYunIndex));
        });
    }
    lines.push('【当前流年流月组】');
    lines.push(`- 当前大运：${currentDaYun ? `第${currentDaYun.index + 1}步 | ${currentDaYun.ganZhi} | ${currentDaYun.startAge}-${currentDaYun.endAge}岁` : '尚未进入首步大运'}`);
    lines.push(`- 当前小运：${currentXiaoYun ? `${currentXiaoYun.age}岁 | ${currentXiaoYun.xiaoYunGanZhi} | 同年流年${currentXiaoYun.ganZhi}` : '未落在当前展开岁运范围内'}`);
    lines.push(`- 当前流年：${currentLiuNian ? `${currentLiuNian.year}年 | ${currentLiuNian.ganZhi} | 年龄${currentLiuNian.age}` : '未落在当前展开岁运范围内'}`);
    lines.push(`- 当前流月：${currentLiuYue ? `${currentLiuYue.termName} | ${currentLiuYue.ganZhi} | ${currentLiuYue.termDate}` : '当前流年未命中流月焦点'}`);
    lines.push('【当前大运下的流年列表】');
    formatLiuNianList(currentDaYun?.liuNian).forEach((line) => lines.push(line));
    lines.push('【当前流年对应的流月列表】');
    formatLiuYueList(currentLiuNian?.liuYue).forEach((line) => lines.push(line));
    lines.push('【当前查看的专业细盘焦点】');
    resolveFocusLines(result, context).forEach((line) => lines.push(line));

    return lines.join('\n');
}
