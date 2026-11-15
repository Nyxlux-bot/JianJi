import { BaziGender, BaziResult, BaziTimeMode, BaziZiHourMode } from '../../core/bazi-types';
import { RegionSelection } from '../../core/city-data';
import { BaziGanZhiLayerSummary } from '../../core/bazi-ganzhi-layer';

export type BaziSectionKey = 'overview' | 'proChart';

export interface BaziFormState {
    name: string;
    birthDate: Date;
    gender: BaziGender;
    location: RegionSelection | null;
    editingRecordId: string | null;
    locationFallbackLabel: string;
    useCustomReferenceDate: boolean;
    referenceDate: Date;
    ziHourMode: BaziZiHourMode;
    timeMode: BaziTimeMode;
    daylightSaving: boolean;
}

export type BaziPanelMode = 'fortune' | 'taiming';

export interface BaziPillarViewItem {
    key: 'year' | 'month' | 'day' | 'hour';
    ganZhi: string;
    shiShen: string;
    cangGanText: string;
}

export interface BaziResultViewModel {
    id: string;
    createdAt: string;
    calculatedAt: string;
    genderLabel: string;
    fourPillarText: string;
    pillars: BaziPillarViewItem[];
    shenShaAll: string[];
    childLimitText: string;
    currentDaYunIndex: number;
    result: BaziResult;
}

export interface FortuneSelectionView {
    mode: 'dayun' | 'xiaoyun';
    selectedDaYunIndex: number;
    selectedXiaoYunIndex: number;
    selectedLiuNianIndex: number;
    selectedLiuYueIndex: number;
    /** 流日在所选流月里的序号；不传时取今天，所选流月里没有今天就取第一天 */
    selectedLiuRiIndex?: number;
    /** 流时序号；不传时取此刻的时辰 */
    selectedLiuShiIndex?: number;
}

export interface ProChartColumnView {
    key: 'liuShi' | 'liuRi' | 'liuYue' | 'liuNian' | 'daYun' | 'xiaoYun' | 'year' | 'month' | 'day' | 'hour' | 'shenGong' | 'mingGong' | 'taiYuan';
    label: string;
    /** 列头第二行：流年写年份、流月写节令月名、流日写阳历日期 */
    subLabel?: string;
    ganZhi: string;
    mainStarShort: string;
    mainStarFull: string;
    subStarShort: string;
    subStarFull: string;
    tianGan: string;
    diZhi: string;
    cangGanLines: string[];
    xingYun: string;
    ziZuo: string;
    kongWang: string;
    naYin: string;
    shenSha: string[];
}

export interface CompactMatrixCellView {
    primary: string;
    secondary?: string;
    lines?: string[];
    colorized?: boolean;
}

export interface CompactMatrixRowView {
    key: string;
    label: string;
    density: 'label' | 'symbol' | 'stacked' | 'detail';
    cells: CompactMatrixCellView[];
}

export type ProChartCellView = CompactMatrixCellView;
export type ProChartRowView = CompactMatrixRowView;

export interface BaziChartHeaderView {
    name: string;
    solarHeaderText: string;
    lunarHeaderText: string;
    mingZaoText: string;
}

export interface QiYunBandItemView {
    element: string;
    status: '旺' | '相' | '休' | '囚' | '死' | '—';
}

export interface ProInfoStripView {
    startText: string;
    changeText: string;
    ageText: string;
    renYuanShortText: string;
    qiYunBand: QiYunBandItemView[];
}

export interface DenseTrackCellView {
    key: string;
    trackKind: 'dayun' | 'xiaoyun' | 'liunian' | 'liuyue' | 'liuri' | 'liushi';
    sourceIndex: number;
    topLabel: string;
    subLabel: string;
    primaryText: string;
    secondaryText: string;
    tertiaryText?: string;
    active: boolean;
    isCurrent: boolean;
    selectable: boolean;
}

export interface ProShenShaSectionView {
    title: string;
    rows: string[];
}

export interface ProShenShaRowView {
    key: 'year' | 'month' | 'day' | 'hour' | 'yunWei' | 'xiaoYun' | 'liuNian' | 'liuYue' | 'liuRi' | 'liuShi';
    label: string;
    ganZhi: string;
    stars: string[];
    /** 原局四柱与岁运之间的分组边界 */
    group: 'yuanJu' | 'suiYun';
}

export interface BaziProChartViewModel {
    header: BaziChartHeaderView;
    fortuneColumns: ProChartColumnView[];
    fortuneRows: ProChartRowView[];
    taimingColumns: ProChartColumnView[];
    taimingRows: ProChartRowView[];
    infoStrip: ProInfoStripView;
    /** 专业细盘岁运区，从细到粗：流时 流日 流月 流年 大运 小运；起运前没有大运列 */
    suiYunColumns: ProChartColumnView[];
    daYunTrack: DenseTrackCellView[];
    liuNianTrack: DenseTrackCellView[];
    liuYueTrack: DenseTrackCellView[];
    liuRiTrack: DenseTrackCellView[];
    liuShiTrack: DenseTrackCellView[];
    /** 运程坞说明行，依次对应 大运 流年 流月 流日 流时 */
    levelInfo: string[];
    ganZhiLayer: BaziGanZhiLayerSummary;
    shenShaSections: ProShenShaSectionView[];
    shenShaRows: ProShenShaRowView[];
}
