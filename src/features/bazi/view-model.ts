import { HeavenStem, SixtyCycle } from 'tyme4ts';
import { buildWuXingBandFromMonthBranch } from '../../core/renyuan-duty';
import {
    BaziPillarKey,
    BaziResult,
    ShiShenName,
} from '../../core/bazi-types';
import { getXunKong } from '../../core/xun-kong';
import {
    BaziChartHeaderView,
    BaziProChartViewModel,
    BaziResultViewModel,
    DenseTrackCellView,
    FortuneSelectionView,
    ProChartColumnView,
    ProChartRowView,
    QiYunBandItemView,
} from './types';

const PILLAR_KEYS: Array<'year' | 'month' | 'day' | 'hour'> = ['year', 'month', 'day', 'hour'];
const MATRIX_PILLAR_LABEL: Record<BaziPillarKey, string> = {
    year: '年柱',
    month: '月柱',
    day: '日柱',
    hour: '时柱',
};
const SHI_SHEN_SHORT: Record<ShiShenName | string, string> = {
    比肩: '比',
    劫财: '劫',
    食神: '食',
    伤官: '伤',
    偏财: '才',
    正财: '财',
    七杀: '杀',
    正官: '官',
    偏印: '枭',
    正印: '印',
    日主: '元',
};

function toShiShenShort(name: string): string {
    return SHI_SHEN_SHORT[name] ?? name;
}

function buildCangGanText(result: BaziResult, index: number): string {
    const group = result.cangGan[index];
    const parts = group.items.map((item) => `${item.gan}${item.shiShen}`);
    return parts.join(' / ');
}

function formatChildLimitText(result: BaziResult): string {
    return `出生后${result.childLimit.years}年${result.childLimit.months}月${result.childLimit.days}天${result.childLimit.hours}时${result.childLimit.minutes}分起运`;
}

function buildHeader(result: BaziResult): BaziChartHeaderView {
    return {
        name: result.subject.name || '未命名',
        solarHeaderText: `阳历：${result.timeMeta.solarDate} ${result.timeMeta.solarTime}`,
        lunarHeaderText: `农历：${result.baseInfo.lunarDisplay}`,
        mingZaoText: result.subject.mingZaoLabel,
    };
}

function formatGanZhiWithShiShen(dayMaster: HeavenStem, ganZhi: string): { primaryText: string; secondaryText: string } {
    const sixtyCycle = SixtyCycle.fromName(ganZhi);
    const tianGan = sixtyCycle.getHeavenStem();
    const diZhi = sixtyCycle.getEarthBranch();
    const main = dayMaster.getTenStar(tianGan).getName();
    const sub = dayMaster.getTenStar(diZhi.getHideHeavenStemMain()).getName();

    return {
        primaryText: `${tianGan.getName()}${toShiShenShort(main)}`,
        secondaryText: `${diZhi.getName()}${toShiShenShort(sub)}`,
    };
}

function buildDerivedColumn(input: {
    key: ProChartColumnView['key'];
    label: string;
    ganZhi: string;
    dayMaster: HeavenStem;
    mainStarFull: string;
    mainStarShort: string;
    subStarFull: string;
    subStarShort: string;
    shenSha: string[];
}): ProChartColumnView {
    const sixtyCycle = SixtyCycle.fromName(input.ganZhi);
    const tianGan = sixtyCycle.getHeavenStem();
    const diZhi = sixtyCycle.getEarthBranch();
    const cangGanLines = diZhi
        .getHideHeavenStems()
        .map((item) => `${item.getHeavenStem().getName()}${input.dayMaster.getTenStar(item.getHeavenStem()).getName()}`);

    return {
        key: input.key,
        label: input.label,
        ganZhi: input.ganZhi,
        mainStarFull: input.mainStarFull,
        mainStarShort: input.mainStarShort,
        subStarFull: input.subStarFull,
        subStarShort: input.subStarShort,
        tianGan: tianGan.getName(),
        diZhi: diZhi.getName(),
        cangGanLines,
        xingYun: input.dayMaster.getTerrain(diZhi).getName(),
        ziZuo: tianGan.getTerrain(diZhi).getName(),
        kongWang: getXunKong(input.ganZhi).join(''),
        naYin: sixtyCycle.getSound().getName(),
        shenSha: input.shenSha,
    };
}

function buildEmptyColumn(key: ProChartColumnView['key'], label: string): ProChartColumnView {
    return {
        key,
        label,
        ganZhi: '—',
        mainStarShort: '—',
        mainStarFull: '—',
        subStarShort: '—',
        subStarFull: '—',
        tianGan: '—',
        diZhi: '—',
        cangGanLines: ['—'],
        xingYun: '—',
        ziZuo: '—',
        kongWang: '—',
        naYin: '—',
        shenSha: ['—'],
    };
}

function extractGanZhiFromDisplay(value: string): string {
    const raw = value.split('（')[0]?.trim() ?? '';
    return raw.length >= 2 ? raw : '';
}

function buildProChartRows(columns: ProChartColumnView[]): ProChartRowView[] {
    return [
        {
            key: 'mainStar',
            label: '主星',
            density: 'label',
            cells: columns.map((column) => ({
                primary: column.key === 'day' ? column.mainStarShort : column.mainStarFull,
            })),
        },
        {
            key: 'tianGan',
            label: '天干',
            density: 'symbol',
            cells: columns.map((column) => ({
                primary: column.tianGan,
                colorized: true,
            })),
        },
        {
            key: 'diZhi',
            label: '地支',
            density: 'symbol',
            cells: columns.map((column) => ({
                primary: column.diZhi,
                colorized: true,
            })),
        },
        {
            key: 'cangGan',
            label: '藏干',
            density: 'stacked',
            cells: columns.map((column) => ({
                primary: '',
                lines: column.cangGanLines,
                colorized: true,
            })),
        },
        {
            key: 'xingYun',
            label: '星运',
            density: 'detail',
            cells: columns.map((column) => ({
                primary: column.xingYun,
            })),
        },
        {
            key: 'ziZuo',
            label: '自坐',
            density: 'detail',
            cells: columns.map((column) => ({
                primary: column.ziZuo,
            })),
        },
        {
            key: 'kongWang',
            label: '空亡',
            density: 'detail',
            cells: columns.map((column) => ({
                primary: column.kongWang || '—',
            })),
        },
        {
            key: 'naYin',
            label: '纳音',
            density: 'detail',
            cells: columns.map((column) => ({
                primary: column.naYin,
            })),
        },
        {
            key: 'shenSha',
            label: '神煞',
            density: 'stacked',
            cells: columns.map((column) => ({
                primary: '',
                lines: column.shenSha.length > 0 ? column.shenSha : ['—'],
            })),
        },
    ];
}

function getLayerStarsForGanZhi(result: BaziResult, ganZhi: string): string[] {
    const bucket = result.shenShaV2.ganZhiBuckets?.[ganZhi];
    if (!bucket) {
        return [];
    }
    return bucket.byPillar[3]?.stars.map((item) => item.star) ?? [];
}

function buildSpecialColumn(input: {
    key: Extract<ProChartColumnView['key'], 'shenGong' | 'mingGong' | 'taiYuan'>;
    label: string;
    source: string;
    result: BaziResult;
    dayMaster: HeavenStem;
}): ProChartColumnView {
    const ganZhi = extractGanZhiFromDisplay(input.source);
    if (!ganZhi) {
        return buildEmptyColumn(input.key, input.label);
    }
    const sixtyCycle = SixtyCycle.fromName(ganZhi);
    const mainStarFull = input.dayMaster.getTenStar(sixtyCycle.getHeavenStem()).getName();
    const subStarFull = input.dayMaster.getTenStar(sixtyCycle.getEarthBranch().getHideHeavenStemMain()).getName();

    return buildDerivedColumn({
        key: input.key,
        label: input.label,
        ganZhi,
        dayMaster: input.dayMaster,
        mainStarFull,
        mainStarShort: toShiShenShort(mainStarFull),
        subStarFull,
        subStarShort: toShiShenShort(subStarFull),
        shenSha: getLayerStarsForGanZhi(input.result, ganZhi),
    });
}

function getSelectedDaYun(result: BaziResult, selection: FortuneSelectionView): BaziResult['daYun'][number] | null {
    if (result.daYun.length === 0) {
        return null;
    }
    const index = Math.min(Math.max(selection.selectedDaYunIndex, 0), result.daYun.length - 1);
    return result.daYun[index];
}

function getSelectedXiaoYun(result: BaziResult, selection: FortuneSelectionView): BaziResult['xiaoYun'][number] | null {
    if (result.xiaoYun.length === 0) {
        return null;
    }
    const index = Math.min(Math.max(selection.selectedXiaoYunIndex, 0), result.xiaoYun.length - 1);
    return result.xiaoYun[index];
}

function getActiveLiuNianList(
    result: BaziResult,
    selection: FortuneSelectionView,
    selectedDaYun: BaziResult['daYun'][number] | null,
): BaziResult['liuNian'] {
    if (selection.mode === 'xiaoyun') {
        return result.xiaoYun;
    }
    return selectedDaYun?.liuNian ?? [];
}

function getSelectedLiuNian(
    result: BaziResult,
    selection: FortuneSelectionView,
    selectedDaYun: BaziResult['daYun'][number] | null,
): BaziResult['liuNian'][number] | null {
    const list = getActiveLiuNianList(result, selection, selectedDaYun);
    if (list.length === 0) {
        return null;
    }
    const index = Math.min(Math.max(selection.selectedLiuNianIndex, 0), list.length - 1);
    return list[index];
}

function getSelectedLiuYue(
    selection: FortuneSelectionView,
    selectedLiuNian: BaziResult['liuNian'][number] | null,
): BaziResult['liuNian'][number]['liuYue'][number] | null {
    if (!selectedLiuNian || selectedLiuNian.liuYue.length === 0) {
        return null;
    }
    const index = Math.min(Math.max(selection.selectedLiuYueIndex, 0), selectedLiuNian.liuYue.length - 1);
    return selectedLiuNian.liuYue[index];
}

function buildRenYuanShortText(result: BaziResult): string {
    const duty = result.baseInfo.renYuanDutyDetail;
    if (!duty.stem) {
        return '—';
    }
    return duty.stem;
}

function getInitialIndex<T extends { isCurrent: boolean }>(items: T[]): number {
    if (items.length === 0) {
        return 0;
    }
    const currentIndex = items.findIndex((item) => item.isCurrent);
    return currentIndex >= 0 ? currentIndex : 0;
}

export function getInitialFortuneSelection(result: BaziResult): FortuneSelectionView {
    if (result.currentDaYunIndex >= 0) {
        const selectedDaYun = result.daYun[result.currentDaYunIndex] ?? result.daYun[0];
        const selectedLiuNianIndex = getInitialIndex(selectedDaYun?.liuNian ?? []);
        const selectedLiuNian = selectedDaYun?.liuNian[selectedLiuNianIndex];
        const selectedLiuYueIndex = getInitialIndex(selectedLiuNian?.liuYue ?? []);
        return {
            mode: 'dayun',
            selectedDaYunIndex: result.currentDaYunIndex,
            selectedXiaoYunIndex: 0,
            selectedLiuNianIndex,
            selectedLiuYueIndex,
        };
    }

    const selectedXiaoYunIndex = getInitialIndex(result.xiaoYun);
    const selectedXiaoYun = result.xiaoYun[selectedXiaoYunIndex];
    return {
        mode: 'xiaoyun',
        selectedDaYunIndex: 0,
        selectedXiaoYunIndex,
        selectedLiuNianIndex: selectedXiaoYunIndex,
        selectedLiuYueIndex: getInitialIndex(selectedXiaoYun?.liuYue ?? []),
    };
}

export function buildBaziResultViewModel(result: BaziResult): BaziResultViewModel {
    const pillars = PILLAR_KEYS.map((key, index) => ({
        key,
        ganZhi: result.fourPillars[index],
        shiShen: result.shiShen[index].shiShen,
        cangGanText: buildCangGanText(result, index),
    }));

    return {
        id: result.id,
        createdAt: result.createdAt,
        calculatedAt: result.calculatedAt,
        genderLabel: result.gender === 1 ? '男' : '女',
        fourPillarText: result.fourPillars.join(' '),
        pillars,
        shenShaAll: result.shenSha.allStars,
        childLimitText: formatChildLimitText(result),
        currentDaYunIndex: result.currentDaYunIndex,
        result,
    };
}

export function buildBaziProChartViewModel(
    result: BaziResult,
    selection: FortuneSelectionView,
): BaziProChartViewModel {
    const dayMaster = SixtyCycle.fromName(result.fourPillars[2]).getHeavenStem();
    const selectedDaYun = getSelectedDaYun(result, selection);
    const selectedXiaoYun = getSelectedXiaoYun(result, selection);
    const activeLiuNianList = getActiveLiuNianList(result, selection, selectedDaYun);
    const selectedLiuNian = getSelectedLiuNian(result, selection, selectedDaYun);
    const selectedLiuYue = getSelectedLiuYue(selection, selectedLiuNian);

    const liuNianColumn = (() => {
        if (!selectedLiuNian) {
            return buildEmptyColumn('liuNian', '流年');
        }
        const liuNianSixtyCycle = SixtyCycle.fromName(selectedLiuNian.ganZhi);
        const liuNianMain = dayMaster.getTenStar(liuNianSixtyCycle.getHeavenStem()).getName();
        const liuNianSub = dayMaster.getTenStar(liuNianSixtyCycle.getEarthBranch().getHideHeavenStemMain()).getName();
        return buildDerivedColumn({
            key: 'liuNian',
            label: '流年',
            ganZhi: selectedLiuNian.ganZhi,
            dayMaster,
            mainStarFull: liuNianMain,
            mainStarShort: toShiShenShort(liuNianMain),
            subStarFull: liuNianSub,
            subStarShort: toShiShenShort(liuNianSub),
            shenSha: getLayerStarsForGanZhi(result, selectedLiuNian.ganZhi),
        });
    })();

    const yunWeiGanZhi = selection.mode === 'xiaoyun'
        ? (selectedXiaoYun?.xiaoYunGanZhi ?? '—')
        : (selectedDaYun?.ganZhi ?? '—');
    const yunWeiLabel = '大运';
    const yunWeiColumn = yunWeiGanZhi === '—'
        ? buildEmptyColumn('daYun', yunWeiLabel)
        : (() => {
            const yunWeiSixtyCycle = SixtyCycle.fromName(yunWeiGanZhi);
            const yunWeiMain = dayMaster.getTenStar(yunWeiSixtyCycle.getHeavenStem()).getName();
            const yunWeiSub = dayMaster.getTenStar(yunWeiSixtyCycle.getEarthBranch().getHideHeavenStemMain()).getName();
            return buildDerivedColumn({
                key: 'daYun',
                label: yunWeiLabel,
                ganZhi: yunWeiGanZhi,
                dayMaster,
                mainStarFull: yunWeiMain,
                mainStarShort: toShiShenShort(yunWeiMain),
                subStarFull: yunWeiSub,
                subStarShort: toShiShenShort(yunWeiSub),
                shenSha: getLayerStarsForGanZhi(result, yunWeiGanZhi),
            });
        })();

    const dayLabel = result.subject.genderLabel === '男' ? '元男' : '元女';
    const pillarColumns = (['year', 'month', 'day', 'hour'] as BaziPillarKey[]).map((pillar, index) => {
        const ganZhi = result.fourPillars[index];
        const cangGanGroup = result.cangGan[index];
        const firstSub = cangGanGroup.items[0]?.shiShen ?? '比肩';
        const mainStarFull = pillar === 'day' ? '日主' : result.shiShen[index].shiShen;
        const mainStarShort = pillar === 'day' ? dayLabel : toShiShenShort(mainStarFull);
        const column = buildDerivedColumn({
            key: pillar,
            label: MATRIX_PILLAR_LABEL[pillar],
            ganZhi,
            dayMaster,
            mainStarFull,
            mainStarShort,
            subStarFull: firstSub,
            subStarShort: toShiShenShort(firstSub),
            shenSha: result.shenShaV2.siZhu.byPillar[index]?.stars.map((item) => item.star)
                ?? result.shenSha.byPillar[index].stars,
        });
        column.cangGanLines = cangGanGroup.items.map((item) => `${item.gan}${item.shiShen}`);
        return column;
    });

    const fortuneColumns = [liuNianColumn, yunWeiColumn, ...pillarColumns];
    const fortuneRows = buildProChartRows(fortuneColumns);
    const taimingColumns = [
        buildSpecialColumn({
            key: 'shenGong',
            label: '身宫',
            source: result.baseInfo.shenGong,
            result,
            dayMaster,
        }),
        buildSpecialColumn({
            key: 'mingGong',
            label: '命宫',
            source: result.baseInfo.mingGong,
            result,
            dayMaster,
        }),
        buildSpecialColumn({
            key: 'taiYuan',
            label: '胎元',
            source: result.baseInfo.taiYuan,
            result,
            dayMaster,
        }),
        ...pillarColumns,
    ];
    const taimingRows = buildProChartRows(taimingColumns);

    const xiaoYunByYear = new Map<number, BaziResult['xiaoYun'][number]>();
    result.xiaoYun.forEach((item) => {
        xiaoYunByYear.set(item.year, item);
    });

    const firstDaYunStartYear = result.daYun[0]?.startYear ?? Number.POSITIVE_INFINITY;
    const leadingXiaoYun = result.xiaoYun.filter((item) => item.year < firstDaYunStartYear);

    const daYunTrack: DenseTrackCellView[] = [
        ...leadingXiaoYun.map((item, index) => {
            const formatted = formatGanZhiWithShiShen(dayMaster, item.xiaoYunGanZhi);
            return {
                key: `xiaoyun-${item.year}`,
                trackKind: 'xiaoyun' as const,
                sourceIndex: index,
                topLabel: String(item.year),
                subLabel: `${item.age}岁`,
                primaryText: formatted.primaryText,
                secondaryText: formatted.secondaryText,
                tertiaryText: '小运',
                active: selection.mode === 'xiaoyun' && selection.selectedXiaoYunIndex === index,
                isCurrent: item.isCurrent,
                selectable: true,
            };
        }),
        ...result.daYun.map((item, index) => {
            const formatted = formatGanZhiWithShiShen(dayMaster, item.ganZhi);
            const xiaoYun = xiaoYunByYear.get(item.startYear);
            const xiaoText = xiaoYun ? formatGanZhiWithShiShen(dayMaster, xiaoYun.xiaoYunGanZhi) : null;
            return {
                key: `dayun-${index}`,
                trackKind: 'dayun' as const,
                sourceIndex: index,
                topLabel: String(item.startYear),
                subLabel: `${item.startAge}~${item.endAge}岁`,
                primaryText: formatted.primaryText,
                secondaryText: formatted.secondaryText,
                tertiaryText: xiaoText ? `小运 ${xiaoText.primaryText}${xiaoText.secondaryText}` : '小运 —',
                active: selection.mode === 'dayun' && selection.selectedDaYunIndex === index,
                isCurrent: item.isCurrent,
                selectable: true,
            };
        }),
    ];

    const liuNianTrack: DenseTrackCellView[] = activeLiuNianList.map((item, index) => {
        const formatted = formatGanZhiWithShiShen(dayMaster, item.ganZhi);
        const xiaoYunFormatted = formatGanZhiWithShiShen(dayMaster, item.xiaoYunGanZhi);
        const trackKind: DenseTrackCellView['trackKind'] = selection.mode === 'xiaoyun' ? 'xiaoyun' : 'liunian';
        return {
            key: `${selection.mode}-liunian-${item.year}`,
            trackKind,
            sourceIndex: index,
            topLabel: String(item.year),
            subLabel: `${item.age}岁`,
            primaryText: formatted.primaryText,
            secondaryText: formatted.secondaryText,
            tertiaryText: `小运 ${xiaoYunFormatted.primaryText}${xiaoYunFormatted.secondaryText}`,
            active: selection.selectedLiuNianIndex === index,
            isCurrent: item.isCurrent,
            selectable: true,
        };
    });

    const liuYueTrack: DenseTrackCellView[] = (selectedLiuNian?.liuYue ?? []).map((item, index) => ({
        key: `liuyue-${item.year}-${index}`,
        trackKind: 'liuyue' as const,
        sourceIndex: index,
        topLabel: item.termName,
        subLabel: item.termDate,
        primaryText: `${item.tianGan}${toShiShenShort(item.tianGanShiShen)}`,
        secondaryText: `${item.diZhi}${toShiShenShort(item.diZhiShiShen)}`,
        tertiaryText: item.ganZhi,
        active: selection.selectedLiuYueIndex === index,
        isCurrent: item.isCurrent,
        selectable: true,
    }));

    const qiYunBand = buildWuXingBandFromMonthBranch(result.baseInfo.renYuanDutyDetail.monthBranch) as QiYunBandItemView[];
    const infoStrip = {
        startText: `起运：${formatChildLimitText(result)}`,
        changeText: result.childLimit.jiaoYunRuleText
            ? `交运：${result.childLimit.jiaoYunRuleText}`
            : `交运：${result.childLimit.jiaoYunDateTime} · ${result.childLimit.startYear}年`,
        ageText: selectedLiuNian ? `当前年龄：${selectedLiuNian.age}岁` : '当前年龄：—',
        renYuanShortText: buildRenYuanShortText(result),
        qiYunBand,
    };

    const yunWeiStars = yunWeiGanZhi === '—' ? [] : getLayerStarsForGanZhi(result, yunWeiGanZhi);
    const liuNianStars = selectedLiuNian ? getLayerStarsForGanZhi(result, selectedLiuNian.ganZhi) : [];
    const liuYueStars = selectedLiuYue ? getLayerStarsForGanZhi(result, selectedLiuYue.ganZhi) : [];

    const shenShaSections = [
        {
            title: '四柱神煞',
            rows: result.shenShaV2.siZhu.byPillar.map((item) => (
                `${MATRIX_PILLAR_LABEL[item.position]} ${item.ganZhi}：${item.stars.map((star) => star.star).join('、') || '无'}`
            )),
        },
        {
            title: selection.mode === 'xiaoyun' ? '当前运位神煞（小运）' : '当前大运神煞',
            rows: [yunWeiGanZhi === '—' ? '无' : `${yunWeiGanZhi}：${yunWeiStars.join('、') || '无'}`],
        },
        {
            title: '当前流年神煞',
            rows: [selectedLiuNian ? `${selectedLiuNian.ganZhi}：${liuNianStars.join('、') || '无'}` : '无'],
        },
        {
            title: '当前流月神煞',
            rows: [selectedLiuYue ? `${selectedLiuYue.ganZhi}：${liuYueStars.join('、') || '无'}` : '无'],
        },
    ];

    return {
        header: buildHeader(result),
        fortuneColumns,
        fortuneRows,
        taimingColumns,
        taimingRows,
        infoStrip,
        daYunTrack,
        liuNianTrack,
        liuYueTrack,
        shenShaSections,
    };
}
