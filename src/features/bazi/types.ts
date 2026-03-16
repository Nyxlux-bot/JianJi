import { BaziGender, BaziResult, BaziTimeMode, BaziZiHourMode } from '../../core/bazi-types';
import { RegionSelection } from '../../core/city-data';
import { BaziGanZhiLayerSummary } from '../../core/bazi-ganzhi-layer';

export type BaziSectionKey = 'basicInfo' | 'basicChart' | 'proChart';

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
}

export interface ProChartColumnView {
    key: 'liuNian' | 'daYun' | 'year' | 'month' | 'day' | 'hour' | 'shenGong' | 'mingGong' | 'taiYuan';
    label: string;
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
    trackKind: 'dayun' | 'xiaoyun' | 'liunian' | 'liuyue';
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

export interface BaziProChartViewModel {
    header: BaziChartHeaderView;
    fortuneColumns: ProChartColumnView[];
    fortuneRows: ProChartRowView[];
    taimingColumns: ProChartColumnView[];
    taimingRows: ProChartRowView[];
    infoStrip: ProInfoStripView;
    daYunTrack: DenseTrackCellView[];
    liuNianTrack: DenseTrackCellView[];
    liuYueTrack: DenseTrackCellView[];
    ganZhiLayer: BaziGanZhiLayerSummary;
    shenShaSections: ProShenShaSectionView[];
}
