import type { IFunctionalAstrolabe } from 'iztro/lib/astro/FunctionalAstrolabe';
import type { IFunctionalHoroscope } from 'iztro/lib/astro/FunctionalHoroscope';
import type { IFunctionalPalace } from 'iztro/lib/astro/FunctionalPalace';
import type { IFunctionalStar } from 'iztro/lib/star/FunctionalStar';

export type ZiweiGender = 'male' | 'female';
export type ZiweiCalendarType = 'solar' | 'lunar';
export type ZiweiAlgorithm = 'default' | 'zhongzhou';
export type ZiweiYearDivide = 'normal' | 'exact';
export type ZiweiDayDivide = 'forward' | 'current';
export type ZiweiAstroType = 'heaven' | 'earth' | 'human';
export type ZiweiMutagen = '禄' | '权' | '科' | '忌';
export type ZiweiBrightness = '庙' | '旺' | '得' | '利' | '平' | '陷' | '不';

export type ZiweiActiveScope = 'decadal' | 'age' | 'yearly' | 'monthly' | 'daily' | 'hourly';
export type ZiweiTopTab = 'chart' | 'pattern' | 'palace' | 'info';
export type ZiweiDynamicScope = Exclude<ZiweiActiveScope, 'age'>;

export type ZiweiLayerKey = 'origin' | ZiweiActiveScope;

export type ZiweiBranchSlotIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

export interface ZiweiConfigOptions {
    algorithm: ZiweiAlgorithm;
    yearDivide: ZiweiYearDivide;
    horoscopeDivide: ZiweiYearDivide;
    dayDivide: ZiweiDayDivide;
    astroType: ZiweiAstroType;
}

export interface ZiweiLunarDateInput {
    year: number;
    month: number;
    day: number;
    isLeapMonth: boolean;
    label?: string;
}

export interface ZiweiRouteParams {
    [key: string]: string | undefined;
    birthLocal: string;
    longitude: string;
    gender: string;
    tzOffsetMinutes: string;
    dst: string;
    calendarType?: string;
    lunarYear?: string;
    lunarMonth?: string;
    lunarDay?: string;
    isLeapMonth?: string;
    algorithm?: string;
    yearDivide?: string;
    horoscopeDivide?: string;
    dayDivide?: string;
    astroType?: string;
    cityLabel?: string;
    name?: string;
    timeIndex?: string;
    recordId?: string;
}

export interface ZiweiInputPayload {
    birthLocal: string;
    longitude: number;
    gender: ZiweiGender;
    tzOffsetMinutes: number;
    daylightSavingEnabled: boolean;
    calendarType: ZiweiCalendarType;
    lunar?: ZiweiLunarDateInput;
    config: ZiweiConfigOptions;
    cityLabel?: string;
    name?: string;
}

export interface ZiweiComputedInput extends ZiweiInputPayload {
    birthLocalDate: Date;
    trueSolarDate: Date;
    solarDate: string;
    trueSolarLunar: ZiweiLunarDateInput;
    timeIndex: number;
    timeLabel: string;
    timeRange: string;
}

export interface ZiweiStarViewModel {
    name: string;
    type: string;
    scope: string;
    brightness: string;
    mutagen: string;
}

export interface ZiweiTagCheckView {
    key: string;
    label: string;
    matched: boolean;
    detail: string;
    tone?: 'accent' | 'neutral' | 'warning' | 'danger';
}

export interface ZiweiPalaceMutagenDestinationView {
    mutagen: ZiweiMutagen;
    palaceName: string | null;
    isSelf: boolean;
}

export interface ZiweiPalaceFlightTargetView {
    palaceName: string;
    mutagens: ZiweiMutagen[];
}

export interface ZiweiPalaceFlightView {
    destinations: ZiweiPalaceMutagenDestinationView[];
    targets: ZiweiPalaceFlightTargetView[];
    selfMutagens: ZiweiMutagen[];
    missingSelfMutagens: ZiweiMutagen[];
    birthMutagens: ZiweiMutagen[];
    missingBirthMutagens: ZiweiMutagen[];
    quietPalaceNames: string[];
}

export interface ZiweiSurroundedPalacesView {
    target: string;
    opposite: string;
    wealth: string;
    career: string;
    palaceNames: string[];
    starsSummary: string;
    majorStars: string[];
    minorStars: string[];
    adjectiveStars: string[];
    mutagens: ZiweiMutagen[];
    checks: ZiweiTagCheckView[];
    hasLu: boolean;
    hasQuan: boolean;
    hasKe: boolean;
    hasJi: boolean;
}

export interface ZiweiPalaceAnalysisView {
    palaceIndex: number;
    name: string;
    heavenlyStem: string;
    earthlyBranch: string;
    isBodyPalace: boolean;
    isOriginalPalace: boolean;
    isEmpty: boolean;
    hasBirthMutagen: boolean;
    hasSelfMutagen: boolean;
    mutagedPlaces: string[];
    flight: ZiweiPalaceFlightView;
    majorStars: ZiweiStarViewModel[];
    minorStars: ZiweiStarViewModel[];
    adjectiveStars: ZiweiStarViewModel[];
    changsheng12: string;
    boshi12: string;
    jiangqian12: string;
    suiqian12: string;
    decadalRange: string;
    ages: string;
    activeScopes: ZiweiActiveScope[];
    surrounded: ZiweiSurroundedPalacesView;
}

export interface ZiweiBoardCell {
    earthlyBranch: string;
    palaceName: string;
    palaceIndex: number;
    branchSlotIndex: ZiweiBranchSlotIndex;
    row: number;
    col: number;
}

export interface ZiweiBranchSlotCell extends ZiweiBoardCell {}

export interface ZiweiBoardMetrics {
    boardWidth: number;
    boardHeight: number;
    gap: number;
    boardInset: number;
    cellWidth: number;
    cellHeight: number;
    cellSize: number;
    centerWidth: number;
    centerHeight: number;
    centerSize: number;
    chromeInset: number;
    outerPadding: number;
    tilePadding: number;
    centerTopHeight: number;
    centerBottomHeight: number;
    sectionGap: number;
    controlCardPadding: number;
    controlRowHeight: number;
    controlInset: number;
}

export interface ZiweiWorkbenchCenterCell {
    row: number;
    col: number;
    rowSpan: number;
    colSpan: number;
}

export interface ZiweiWorkbenchLayout {
    top: ZiweiBranchSlotCell[];
    left: ZiweiBranchSlotCell[];
    right: ZiweiBranchSlotCell[];
    bottom: ZiweiBranchSlotCell[];
    ringCells: ZiweiBranchSlotCell[];
    center: ZiweiWorkbenchCenterCell;
    byPalaceName: Record<string, ZiweiBranchSlotCell>;
    metrics?: ZiweiBoardMetrics;
    cellSize?: number;
    centerSize?: number;
}

export type ZiweiBoardLayout = ZiweiWorkbenchLayout;

export interface ZiweiCenterPanelChip {
    key: string;
    label: string;
    active: boolean;
}

export interface ZiweiCenterPanelSection {
    key: 'surrounded' | 'mutagen' | 'star' | 'scope';
    title: string;
    lines: string[];
}

export interface ZiweiCenterPanelContent {
    title: string;
    subtitle: string;
    summary: string;
    chips: ZiweiCenterPanelChip[];
    sections: ZiweiCenterPanelSection[];
}

export interface ZiweiStarInsightView {
    name: string;
    brightness: string;
    mutagen: string;
    brightnessMatches: ZiweiBrightness[];
    mutagenFlags: ZiweiMutagen[];
    scope: string;
    palaceName: string;
    oppositePalaceName: string;
    surrounded: ZiweiSurroundedPalacesView | null;
}

export interface ZiweiHoroscopeMutagenStars {
    lu: string;
    quan: string;
    ke: string;
    ji: string;
}

export interface ZiweiHoroscopeScopeView {
    scope: ZiweiActiveScope;
    label: string;
    palaceName: string;
    heavenlyStem: string;
    earthlyBranch: string;
    mutagen: string[];
    mutagenStars: ZiweiHoroscopeMutagenStars;
    stars: string[];
    directHoroscopeStars: string[];
    surrounded: ZiweiSurroundedPalacesView | null;
    hasLu: boolean;
    hasQuan: boolean;
    hasKe: boolean;
    hasJi: boolean;
}

export interface ZiweiHoroscopePalaceView {
    scope: ZiweiDynamicScope;
    requestedPalaceName: string;
    resolvedPalaceName: string;
    heavenlyStem: string;
    earthlyBranch: string;
    mutagen: string[];
    mutagenStars: ZiweiHoroscopeMutagenStars;
    stars: string[];
    directHoroscopeStars: string[];
    directHoroscopeAllPresent: boolean;
    directHoroscopeAnyPresent: boolean;
    directHoroscopeAllAbsent: boolean;
    surrounded: ZiweiSurroundedPalacesView | null;
    hasLu: boolean;
    hasQuan: boolean;
    hasKe: boolean;
    hasJi: boolean;
}

export interface ZiweiDirectHoroscopePalaceStars {
    palaceName: string;
    palaceIndex: number;
    starNames: string[];
    stars: ZiweiStarViewModel[];
}

export interface ZiweiDirectHoroscopeScopeView {
    scope: ZiweiDynamicScope;
    heavenlyStem: string;
    earthlyBranch: string;
    palaceStars: ZiweiDirectHoroscopePalaceStars[];
    byPalaceName: Record<string, ZiweiDirectHoroscopePalaceStars>;
}

export interface ZiweiHoroscopeSummary {
    solarDate: string;
    lunarDate: string;
    decadal: string;
    age: string;
    yearly: string;
    monthly: string;
    daily: string;
    hourly: string;
}

export interface ZiweiRouteParseSuccess {
    ok: true;
    value: ZiweiInputPayload;
    debugTimeIndex?: number;
}

export interface ZiweiRouteParseFailure {
    ok: false;
    message: string;
}

export type ZiweiRouteParseResult = ZiweiRouteParseSuccess | ZiweiRouteParseFailure;

export interface ZiweiChartResult {
    input: ZiweiComputedInput;
    astrolabe: IFunctionalAstrolabe;
    horoscopeNow: IFunctionalHoroscope;
    horoscopeSummary: ZiweiHoroscopeSummary;
    workbenchLayout: ZiweiWorkbenchLayout;
    palaces: ZiweiPalaceAnalysisView[];
    palaceByName: Record<string, ZiweiPalaceAnalysisView>;
    stars: ZiweiStarInsightView[];
    starByName: Record<string, ZiweiStarInsightView>;
    horoscopeScopes: ZiweiHoroscopeScopeView[];
    directHoroscopeByScope: Partial<Record<ZiweiDynamicScope, ZiweiDirectHoroscopeScopeView>>;
}

export interface ZiweiStaticChartResult {
    cacheKey: string;
    input: ZiweiComputedInput;
    astrolabe: IFunctionalAstrolabe;
    workbenchLayout: ZiweiWorkbenchLayout;
    palaces: ZiweiPalaceAnalysisView[];
    palaceByName: Record<string, ZiweiPalaceAnalysisView>;
    lazy: {
        starInsights?: ZiweiStarInsightView[];
        starByName?: Record<string, ZiweiStarInsightView>;
        dynamicAstrolabe?: IFunctionalAstrolabe;
        chartSnapshot?: ZiweiChartSnapshotV1;
    };
}

export interface ZiweiDynamicHoroscopeResult {
    cursorDate: Date;
    horoscopeNow: IFunctionalHoroscope;
    horoscopeSummary: ZiweiHoroscopeSummary;
}

export interface ZiweiScopeTagView {
    key: string;
    label: string;
    tone: 'origin' | 'body' | 'decadal' | 'age' | 'yearly' | 'monthly' | 'daily' | 'hourly';
    active: boolean;
}

export interface ZiweiPalaceOverlayView {
    key: ZiweiActiveScope;
    label: string;
    tone: 'decadal' | 'age' | 'yearly' | 'monthly' | 'daily' | 'hourly';
    active: boolean;
    stars: string[];
    mutagens: ZiweiMutagen[];
}

export interface ZiweiPalaceYearAssignmentView {
    key: string;
    label: string;
    year: number;
    nominalAge: number;
    active: boolean;
}

export interface ZiweiPalaceSelectionRenderModel {
    palaceName: string;
    selected: boolean;
    highlightKind: 'target' | 'opposite' | 'wealth' | 'career' | null;
}

export interface ZiweiPalaceRenderModel extends ZiweiPalaceSelectionRenderModel {
    scopeTags: ZiweiScopeTagView[];
    isAgePalace: boolean;
    scopeOverlayText: string;
    footerText: string;
}

export interface ZiweiCenterMutagenBadgeView {
    key: 'lu' | 'quan' | 'ke' | 'ji';
    label: '禄' | '权' | '科' | '忌';
    value: string;
    active: boolean;
}

export interface ZiweiBoardCenterPanelState {
    focusTitle: string;
    scopeState: string;
    scopeSummary: string;
    summaryItems: string[];
    mutagenBadges: ZiweiCenterMutagenBadgeView[];
}

export interface ZiweiBoardRenderModel {
    byPalaceName: Record<string, ZiweiPalaceRenderModel>;
    currentScopeSummary: string;
    centerPanel: ZiweiBoardCenterPanelState;
}

export interface ZiweiBoardSnapshotModel {
    selectedPalaceName: string;
    byPalaceName: Record<string, ZiweiPalaceSelectionRenderModel>;
    centerPanel: ZiweiBoardCenterPanelState;
}

export interface ZiweiChartSnapshotStaticMeta {
    lunarDate: string;
    chineseDate: string;
    fiveElementsClass: string;
    soul: string;
    body: string;
    birthLocal: string;
    trueSolarDateTimeLocal: string;
    timeLabel: string;
    timeRange: string;
}

export interface ZiweiChartSnapshotV1 {
    version: 1;
    staticMeta: ZiweiChartSnapshotStaticMeta;
    workbenchLayout: ZiweiWorkbenchLayout;
    palaces: ZiweiPalaceAnalysisView[];
    baseBoard: ZiweiBoardSnapshotModel;
}

export interface ZiweiPalaceDecorationView {
    palaceName: string;
    overlays: ZiweiPalaceOverlayView[];
    activeOverlay: ZiweiPalaceOverlayView | null;
    historyOverlayLabels: string[];
    yearAssignments: ZiweiPalaceYearAssignmentView[];
    displayYearAssignment: ZiweiPalaceYearAssignmentView | null;
}

export interface ZiweiBoardDecorationModel {
    cacheKey: string;
    activeScope: ZiweiActiveScope;
    byPalaceName: Record<string, ZiweiPalaceDecorationView>;
}

export interface ZiweiOrbitTrackItem {
    key: string;
    label: string;
    secondary: string;
    cursorDate: Date;
    active: boolean;
}

export interface ZiweiOrbitDrawerRow {
    key: ZiweiActiveScope;
    label: string;
    items: ZiweiOrbitTrackItem[];
}

export interface ZiweiOrbitDrawerSummaryItem {
    key: 'decadal' | 'age' | 'yearly';
    label: string;
    value: string;
}

export interface ZiweiOrbitDrawerState {
    activeScope: ZiweiActiveScope;
    summaryItems: ZiweiOrbitDrawerSummaryItem[];
    activeScopeLabel: string;
    rows: ZiweiOrbitDrawerRow[];
}

export interface ZiweiSelectedContext {
    selectedLayer: ZiweiLayerKey;
    selectedPalaceName: string;
    selectedStarName: string | null;
    cursorDateIso: string;
}

export interface ZiweiZoomRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface ZiweiZoomMotion {
    translateX: number;
    translateY: number;
    initialScale: number;
}

export interface ZiweiZoomTarget {
    palaceName: string;
    rect: ZiweiZoomRect;
}

export interface ZiweiRawContext {
    astrolabe: IFunctionalAstrolabe;
    horoscope: IFunctionalHoroscope;
}

export type ZiweiRawPalace = IFunctionalPalace;
export type ZiweiRawStar = IFunctionalStar;
