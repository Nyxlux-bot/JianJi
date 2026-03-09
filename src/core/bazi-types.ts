import { BaziAIConversationDigest, BaziAIConversationStage, PersistedAIChatMessage } from './ai-meta';
import { BaziFormatterContext } from './bazi-ai-context';

export type BaziGender = 0 | 1;

export type BaziPillarKey = 'year' | 'month' | 'day' | 'hour';

export type BaziFourPillars = [string, string, string, string];

export type BaziZiHourMode = 'late_zi_next_day' | 'early_zi_same_day';
export type BaziTimeMode = 'clock_time' | 'mean_solar_time' | 'true_solar_time';

export interface BaziSchoolOptions {
    ziHourMode?: BaziZiHourMode;
    timeMode?: BaziTimeMode;
    daylightSaving?: boolean;
}

export interface BaziSchoolOptionsResolved {
    ziHourMode: BaziZiHourMode;
    timeMode: BaziTimeMode;
    daylightSaving: boolean;
}

export type ShiShenName =
    | '比肩'
    | '劫财'
    | '食神'
    | '伤官'
    | '偏财'
    | '正财'
    | '七杀'
    | '正官'
    | '偏印'
    | '正印'
    | '日主';

export type CangGanType = 'benQi' | 'zhongQi' | 'yuQi';

export interface BaziTimeMeta {
    solarDate: string;
    solarTime: string;
    trueSolarTime: string;
    solarDateIso: string;
    solarDateTimeIso: string;
    trueSolarDateTimeIso: string;
}

export interface BaziShiShenItem {
    pillar: BaziPillarKey;
    pillarIndex: 0 | 1 | 2 | 3;
    ganZhi: string;
    tianGan: string;
    shiShen: ShiShenName;
}

export interface BaziCangGanItem {
    type: CangGanType;
    gan: string;
    shiShen: Exclude<ShiShenName, '日主'>;
}

export interface BaziCangGanGroup {
    pillar: BaziPillarKey;
    pillarIndex: 0 | 1 | 2 | 3;
    diZhi: string;
    benQi: BaziCangGanItem | null;
    zhongQi: BaziCangGanItem | null;
    yuQi: BaziCangGanItem | null;
    items: BaziCangGanItem[];
}

export interface BaziChildLimit {
    years: number;
    months: number;
    days: number;
    hours: number;
    minutes: number;
    startAge: number;
    startYear: number;
    jiaoYunDateTime: string;
    jiaoYunDateTimeIso: string;
    jiaoYunRuleText: string;
    jiaoYunYearStems: [string, string];
    jiaoYunAnchorJieName: string;
    jiaoYunAnchorJieDateTime: string;
    jiaoYunAnchorJieDateTimeIso: string;
    jiaoYunOffsetDaysAfterJie: number;
}

export interface BaziLiuYueItem {
    index: number;
    year: number;
    ganZhi: string;
    tianGan: string;
    diZhi: string;
    tianGanShiShen: Exclude<ShiShenName, '日主'>;
    diZhiShiShen: Exclude<ShiShenName, '日主'>;
    termName: string;
    termDate: string;
    termDateIso: string;
    isCurrent: boolean;
}

export interface BaziLiuNianItem {
    year: number;
    age: number;
    ganZhi: string;
    xiaoYunGanZhi: string;
    isCurrent: boolean;
    liuYue: BaziLiuYueItem[];
}

export interface BaziDaYunItem {
    index: number;
    ganZhi: string;
    startAge: number;
    endAge: number;
    startYear: number;
    endYear: number;
    jiaoYunDateTime: string;
    jiaoYunDateTimeIso: string;
    isCurrent: boolean;
    liuNian: BaziLiuNianItem[];
}

export type BaziYuanMingGroup = '东四命' | '西四命';

export interface BaziYuanMingItem {
    label: '元男' | '元女';
    guaNumber: number;
    guaName: string;
    wuXing: string;
    group: BaziYuanMingGroup;
}

export interface BaziYuanMing {
    baseYear: number;
    yuanNan: BaziYuanMingItem;
    yuanNv: BaziYuanMingItem;
    current: BaziYuanMingItem;
}

export interface BaziSubject {
    name: string;
    genderLabel: '男' | '女';
    mingZaoLabel: '乾造' | '坤造';
    yinYangLabel: '阴' | '阳';
}

export interface BaziBaseInfo {
    zodiac: string;
    lunarDisplay: string;
    solarDisplay: string;
    trueSolarDisplay: string;
    birthPlaceDisplay: string;
    constellation: string;
    xingXiu: string;
    renYuanDuty: string;
    renYuanDutyDetail: BaziRenYuanDutyDetail;
    taiYuan: string;
    taiXi: string;
    mingGong: string;
    shenGong: string;
    mingGua: string;
    kongWang: string;
}

export interface BaziRenYuanDutyDetail {
    stem: string;
    element: string;
    dayIndex: number;
    monthBranch: string;
    ruleKey: 'ziping_zhenquan_v1';
    display: string;
}

export interface BaziJieQiTerm {
    name: string;
    dateTime: string;
    dateTimeIso: string;
}

export interface BaziJieQiContext {
    prevTerm: BaziJieQiTerm;
    currentTerm: BaziJieQiTerm;
    nextTerm: BaziJieQiTerm;
    afterPrev: string;
    beforeNext: string;
}

export type BaziPillarMatrixRowKey =
    | 'mainStar'
    | 'subStar'
    | 'tianGan'
    | 'diZhi'
    | 'cangGan'
    | 'xingYun'
    | 'ziZuo'
    | 'kongWang'
    | 'naYin'
    | 'shenSha';

export interface BaziPillarMatrixRow {
    key: BaziPillarMatrixRowKey;
    label: string;
    values: [string, string, string, string];
}

export type BaziShenShaName = string;

export interface BaziShenShaPillarItem {
    pillar: BaziPillarKey;
    pillarIndex: 0 | 1 | 2 | 3;
    ganZhi: string;
    tianGan: string;
    diZhi: string;
    stars: BaziShenShaName[];
}

export interface BaziShenShaResult {
    byPillar: [
        BaziShenShaPillarItem,
        BaziShenShaPillarItem,
        BaziShenShaPillarItem,
        BaziShenShaPillarItem,
    ];
    allStars: BaziShenShaName[];
    starToPillars: Record<BaziShenShaName, BaziPillarKey[]>;
}

export type BaziShenShaHitLevel = 'strong' | 'normal';

export interface BaziShenShaCatalogItem {
    key: string;
    fullName: string;
    aliases: string[];
    category: string;
    description: string;
    sourceRefs: string[];
}

export interface BaziShenShaHitItem {
    star: string;
    hitLevel: BaziShenShaHitLevel;
    hitReason: string;
}

export interface BaziShenShaLayerPositionItem {
    position: BaziPillarKey;
    ganZhi: string;
    stars: BaziShenShaHitItem[];
}

export interface BaziShenShaLayerBucket {
    byPillar: BaziShenShaLayerPositionItem[];
    allStars: string[];
    starToPositions: Record<string, BaziPillarKey[]>;
    compatNote: string[];
}

export interface BaziShenShaLayerItem {
    index: number;
    label: string;
    ganZhi: string;
    bucket: BaziShenShaLayerBucket;
}

export interface BaziShenShaV2Result {
    catalogVersion: string;
    catalog: BaziShenShaCatalogItem[];
    siZhu: BaziShenShaLayerBucket;
    daYun: BaziShenShaLayerItem[];
    liuNian: BaziShenShaLayerItem[];
    liuYue: BaziShenShaLayerItem[];
    ganZhiBuckets?: Record<string, BaziShenShaLayerBucket>;
}

export interface BaziResult {
    id: string;
    createdAt: string;
    calculatedAt: string;
    gender: BaziGender;
    aiAnalysis?: string;
    aiChatHistory?: PersistedAIChatMessage[];
    quickReplies?: string[];
    aiConversationDigest?: BaziAIConversationDigest;
    aiConversationStage?: BaziAIConversationStage;
    aiVerificationSummary?: string;
    aiContextSnapshot?: BaziFormatterContext;
    longitude: number | null;
    solarDate: string;
    solarTime: string;
    trueSolarTime: string;
    timeMeta: BaziTimeMeta;
    fourPillars: BaziFourPillars;
    shiShen: [
        BaziShiShenItem,
        BaziShiShenItem,
        BaziShiShenItem,
        BaziShiShenItem,
    ];
    cangGan: [
        BaziCangGanGroup,
        BaziCangGanGroup,
        BaziCangGanGroup,
        BaziCangGanGroup,
    ];
    childLimit: BaziChildLimit;
    currentDaYunIndex: number;
    daYun: BaziDaYunItem[];
    liuNian: BaziLiuNianItem[];
    xiaoYun: BaziLiuNianItem[];
    yuanMing: BaziYuanMing;
    shenSha: BaziShenShaResult;
    subject: BaziSubject;
    baseInfo: BaziBaseInfo;
    jieQiContext: BaziJieQiContext;
    pillarMatrix: BaziPillarMatrixRow[];
    schoolOptionsResolved: BaziSchoolOptionsResolved;
    shenShaV2: BaziShenShaV2Result;
}
