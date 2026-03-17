import { star } from 'iztro';
import type { IFunctionalAstrolabe } from 'iztro/lib/astro/FunctionalAstrolabe';
import type { IFunctionalHoroscope } from 'iztro/lib/astro/FunctionalHoroscope';
import type { IFunctionalPalace } from 'iztro/lib/astro/FunctionalPalace';
import type { IFunctionalSurpalaces } from 'iztro/lib/astro/FunctionalSurpalaces';
import type { IFunctionalStar } from 'iztro/lib/star/FunctionalStar';
import { formatLocalDateTime } from '../../core/bazi-local-time';
import { getSolarTermDate, solarToLunar } from '../../core/lunar';
import { measureZiweiPerf } from './perf';
import {
    ZiweiActiveScope,
    ZiweiAlgorithm,
    ZiweiBrightness,
    ZiweiBoardLayout,
    ZiweiBoardCenterPanelState,
    ZiweiBoardScopeModel,
    ZiweiBoardSnapshotModel,
    ZiweiBoardMetrics,
    ZiweiBoardRenderModel,
    ZiweiBranchSlotIndex,
    ZiweiCenterPanelContent,
    ZiweiCenterPanelSection,
    ZiweiCenterMutagenBadgeView,
    ZiweiDynamicHoroscopeResult,
    ZiweiDynamicScope,
    ZiweiDirectHoroscopeScopeView,
    ZiweiHoroscopePalaceView,
    ZiweiHoroscopeMutagenStars,
    ZiweiHoroscopeScopeView,
    ZiweiHoroscopeSummary,
    ZiweiLayerKey,
    ZiweiMutagen,
    ZiweiBoardDecorationModel,
    ZiweiOrbitDrawerRow,
    ZiweiOrbitDrawerState,
    ZiweiPalaceAnalysisView,
    ZiweiPalaceDecorationView,
    ZiweiPalaceOverlayView,
    ZiweiPalaceSelectionRenderModel,
    ZiweiPalaceYearAssignmentView,
    ZiweiPalaceRenderModel,
    ZiweiPalaceScopeRenderModel,
    ZiweiChartSnapshotV1,
    ZiweiConfigOptions,
    ZiweiScopeTagView,
    ZiweiStaticChartResult,
    ZiweiStarInsightView,
    ZiweiStarViewModel,
    ZiweiSurroundedPalacesView,
    ZiweiYearDivide,
    ZiweiZoomMotion,
    ZiweiZoomRect,
} from './types';
import {
    resolveZiweiBrightnessLabel,
} from './brightness/baseline';

const EARTHLY_BRANCH_TO_SLOT: Record<string, ZiweiBranchSlotIndex> = {
    子: 0,
    丑: 1,
    寅: 2,
    卯: 3,
    辰: 4,
    巳: 5,
    午: 6,
    未: 7,
    申: 8,
    酉: 9,
    戌: 10,
    亥: 11,
};

const SLOT_ORDER = [
    { branchSlotIndex: 5 as ZiweiBranchSlotIndex, row: 0, col: 0 },
    { branchSlotIndex: 6 as ZiweiBranchSlotIndex, row: 0, col: 1 },
    { branchSlotIndex: 7 as ZiweiBranchSlotIndex, row: 0, col: 2 },
    { branchSlotIndex: 8 as ZiweiBranchSlotIndex, row: 0, col: 3 },
    { branchSlotIndex: 4 as ZiweiBranchSlotIndex, row: 1, col: 0 },
    { branchSlotIndex: 9 as ZiweiBranchSlotIndex, row: 1, col: 3 },
    { branchSlotIndex: 3 as ZiweiBranchSlotIndex, row: 2, col: 0 },
    { branchSlotIndex: 10 as ZiweiBranchSlotIndex, row: 2, col: 3 },
    { branchSlotIndex: 2 as ZiweiBranchSlotIndex, row: 3, col: 0 },
    { branchSlotIndex: 1 as ZiweiBranchSlotIndex, row: 3, col: 1 },
    { branchSlotIndex: 0 as ZiweiBranchSlotIndex, row: 3, col: 2 },
    { branchSlotIndex: 11 as ZiweiBranchSlotIndex, row: 3, col: 3 },
] as const;

const SCOPE_LABELS: Record<ZiweiActiveScope, string> = {
    decadal: '大限',
    age: '小限',
    yearly: '流年',
    monthly: '流月',
    daily: '流日',
    hourly: '流时',
};

const CENTER_LAYER_LABELS: Record<ZiweiLayerKey, string> = {
    origin: '本命',
    decadal: '大限',
    age: '小限',
    yearly: '流年',
    monthly: '流月',
    daily: '流日',
    hourly: '流时',
};

const BOARD_MAX_WIDTH = 460;
const ZIWEI_ZOOM_MAX_X = 96;
const ZIWEI_ZOOM_MAX_Y = 120;
const ZIWEI_MUTAGENS: ZiweiMutagen[] = ['禄', '权', '科', '忌'];
const ZIWEI_BRIGHTNESS_LEVELS: ZiweiBrightness[] = ['庙', '旺', '得', '利', '平', '陷', '不'];
const SURROUNDED_SHA_STARS = ['擎羊', '陀罗', '火星', '铃星', '地空', '地劫'] as const;
const CUMULATIVE_SCOPE_ORDER: ZiweiActiveScope[] = ['decadal', 'age', 'yearly', 'monthly', 'daily', 'hourly'];
const OVERLAY_DISPLAY_ORDER: ZiweiActiveScope[] = ['age', 'yearly', 'decadal', 'monthly', 'daily', 'hourly'];
const SCOPE_PREFIX_LABELS: Record<ZiweiActiveScope, string> = {
    decadal: '限',
    age: '小',
    yearly: '年',
    monthly: '月',
    daily: '日',
    hourly: '时',
};
const PALACE_SHORT_LABELS: Record<string, string> = {
    命宫: '命',
    兄弟: '兄',
    夫妻: '夫',
    子女: '子',
    财帛: '财',
    疾厄: '疾',
    迁移: '迁',
    仆役: '友',
    交友: '友',
    朋友: '友',
    官禄: '官',
    田宅: '田',
    福德: '福',
    父母: '父',
};
const ZIWEI_DECORATION_CACHE_LIMIT = 48;
const ZIWEI_DECADAL_ASSIGNMENT_CACHE_LIMIT = 24;
const ziweiBoardDecorationsCache = new Map<string, ZiweiBoardDecorationModel>();
const ziweiDecadalAssignmentsCache = new Map<string, Record<string, ZiweiPalaceYearAssignmentView[]>>();

function formatMutagen(mutagen?: string): string {
    return mutagen ? `化${mutagen}` : '';
}

function formatStarLabel(star: { name: string; brightness?: string; mutagen?: string }): string {
    return [star.name, star.brightness || '', formatMutagen(star.mutagen)].join('');
}

function resolveStarBrightness(star: IFunctionalStar, earthlyBranch: string, algorithm: ZiweiAlgorithm): string {
    return star.brightness || resolveZiweiBrightnessLabel(
        algorithm,
        star.name,
        earthlyBranch,
    );
}

function toStarViewModel(star: IFunctionalStar, earthlyBranch: string, algorithm: ZiweiAlgorithm): ZiweiStarViewModel {
    return {
        name: star.name,
        type: star.type,
        scope: star.scope,
        brightness: resolveStarBrightness(star, earthlyBranch, algorithm),
        mutagen: star.mutagen || '',
    };
}

function flattenHoroscopeStars(stars?: IFunctionalStar[][]): string[] {
    if (!stars) {
        return [];
    }

    return stars.flat().map((star) => formatStarLabel(star));
}

function buildHoroscopeMutagenStars(mutagenStars: string[]) {
    const [lu = '', quan = '', ke = '', ji = ''] = mutagenStars;
    return { lu, quan, ke, ji };
}

function buildActiveScopes(index: number, horoscope: IFunctionalHoroscope): ZiweiActiveScope[] {
    const result: ZiweiActiveScope[] = [];
    const agePalaceIndex = horoscope.agePalace()?.index;

    if (horoscope.decadal.index === index) {
        result.push('decadal');
    }
    if (agePalaceIndex === index) {
        result.push('age');
    }
    if (horoscope.yearly.index === index) {
        result.push('yearly');
    }
    if (horoscope.monthly.index === index) {
        result.push('monthly');
    }
    if (horoscope.daily.index === index) {
        result.push('daily');
    }
    if (horoscope.hourly.index === index) {
        result.push('hourly');
    }

    return result;
}

export function getZiweiBranchSlotIndex(earthlyBranch: string): ZiweiBranchSlotIndex {
    return EARTHLY_BRANCH_TO_SLOT[earthlyBranch] as ZiweiBranchSlotIndex;
}

function buildBoardCell(astrolabe: IFunctionalAstrolabe, config: (typeof SLOT_ORDER)[number]) {
    const palace = astrolabe.palaces.find((item) => getZiweiBranchSlotIndex(item.earthlyBranch) === config.branchSlotIndex);
    if (!palace) {
        throw new Error(`缺少地支槽位 ${config.branchSlotIndex} 对应的宫位`);
    }

    return {
        earthlyBranch: palace.earthlyBranch,
        palaceName: palace.name,
        palaceIndex: palace.index,
        branchSlotIndex: config.branchSlotIndex,
        row: config.row,
        col: config.col,
    };
}

function summarizePalaceStars(palace: IFunctionalPalace): string {
    const major = palace.majorStars.map((star) => star.name).join('、');
    const minor = palace.minorStars.map((star) => star.name).join('、');
    const adjective = palace.adjectiveStars.map((star) => star.name).slice(0, 2).join('、');
    const parts = [
        major ? `${palace.name}:${major}` : '',
        minor ? `辅星:${minor}` : '',
        adjective ? `杂耀:${adjective}` : '',
    ].filter(Boolean);

    return parts.join(' · ') || `${palace.name}:空宫`;
}

function uniqueStarNames(palaces: IFunctionalPalace[], key: 'majorStars' | 'minorStars' | 'adjectiveStars'): string[] {
    return Array.from(new Set(palaces.flatMap((palace) => palace[key].map((star) => star.name))));
}

function buildPairCheck(
    key: string,
    label: string,
    surrounded: IFunctionalSurpalaces,
    stars: readonly string[],
    tone: 'accent' | 'neutral' | 'warning' | 'danger',
) {
    const matched = surrounded.have(stars as any);
    const anyMatched = surrounded.haveOneOf(stars as any);
    const detail = matched ? `${label}成立` : anyMatched ? `${label}仅成半会` : `${label}未见`;

    return {
        key,
        label,
        matched,
        detail,
        tone,
    };
}

function buildSurroundedPalacesView(surrounded?: IFunctionalSurpalaces): ZiweiSurroundedPalacesView | null {
    if (!surrounded) {
        return null;
    }

    const palaces = [surrounded.target, surrounded.opposite, surrounded.wealth, surrounded.career];
    const majorStars = uniqueStarNames(palaces, 'majorStars');
    const minorStars = uniqueStarNames(palaces, 'minorStars');
    const adjectiveStars = uniqueStarNames(palaces, 'adjectiveStars');
    const mutagens = ZIWEI_MUTAGENS.filter((mutagen) => surrounded.haveMutagen(mutagen as any));
    const hasNoJi = surrounded.notHaveMutagen('忌');

    return {
        target: surrounded.target.name,
        opposite: surrounded.opposite.name,
        wealth: surrounded.wealth.name,
        career: surrounded.career.name,
        palaceNames: palaces.map((palace) => palace.name),
        starsSummary: [
            summarizePalaceStars(surrounded.target),
            summarizePalaceStars(surrounded.opposite),
            summarizePalaceStars(surrounded.wealth),
            summarizePalaceStars(surrounded.career),
        ].join(' ｜ '),
        majorStars,
        minorStars,
        adjectiveStars,
        mutagens,
        checks: [
            buildPairCheck('fubi', '辅弼同会', surrounded, ['左辅', '右弼'], 'accent'),
            buildPairCheck('changqu', '昌曲同会', surrounded, ['文昌', '文曲'], 'accent'),
            buildPairCheck('luma', '禄马同驰', surrounded, ['禄存', '天马'], 'warning'),
            {
                key: 'sha',
                label: '煞曜介入',
                matched: surrounded.haveOneOf(SURROUNDED_SHA_STARS as any),
                detail: surrounded.haveOneOf(SURROUNDED_SHA_STARS as any) ? '见羊陀火铃空劫' : '煞曜未入局',
                tone: surrounded.haveOneOf(SURROUNDED_SHA_STARS as any) ? 'danger' : 'neutral',
            },
            {
                key: 'noji',
                label: '无忌入局',
                matched: hasNoJi,
                detail: hasNoJi ? '三方四正未见化忌' : '三方四正见化忌',
                tone: hasNoJi ? 'accent' : 'danger',
            },
        ],
        hasLu: surrounded.haveMutagen('禄'),
        hasQuan: surrounded.haveMutagen('权'),
        hasKe: surrounded.haveMutagen('科'),
        hasJi: surrounded.haveMutagen('忌'),
    };
}

function buildPalaceFlightView(palace: IFunctionalPalace, astrolabe: IFunctionalAstrolabe) {
    const destinations = ZIWEI_MUTAGENS.map((mutagen, index) => {
        const target = palace.mutagedPlaces()[index];
        return {
            mutagen,
            palaceName: target?.name || null,
            isSelf: target?.name === palace.name,
        };
    });
    const targets = astrolabe.palaces
        .map((targetPalace) => ({
            palaceName: targetPalace.name,
            mutagens: ZIWEI_MUTAGENS.filter((mutagen) => palace.fliesTo(targetPalace.name as any, mutagen as any)),
        }))
        .filter((item) => item.mutagens.length > 0);
    const selfMutagens = ZIWEI_MUTAGENS.filter((mutagen) => palace.selfMutaged(mutagen as any));
    const missingSelfMutagens = ZIWEI_MUTAGENS.filter((mutagen) => palace.notSelfMutaged(mutagen as any));
    const birthMutagens = ZIWEI_MUTAGENS.filter((mutagen) => palace.hasMutagen(mutagen as any));
    const missingBirthMutagens = ZIWEI_MUTAGENS.filter((mutagen) => palace.notHaveMutagen(mutagen as any));
    const quietPalaceNames = astrolabe.palaces
        .filter((targetPalace) => palace.notFlyTo(targetPalace.name as any, ZIWEI_MUTAGENS as any))
        .map((targetPalace) => targetPalace.name);

    return {
        destinations,
        targets,
        selfMutagens,
        missingSelfMutagens,
        birthMutagens,
        missingBirthMutagens,
        quietPalaceNames,
    };
}

function uniqueStars(astrolabe: IFunctionalAstrolabe): IFunctionalStar[] {
    const map = new Map<string, IFunctionalStar>();

    astrolabe.palaces.forEach((palace) => {
        [...palace.majorStars, ...palace.minorStars, ...palace.adjectiveStars].forEach((star) => {
            if (!map.has(star.name)) {
                map.set(star.name, star);
            }
        });
    });

    return Array.from(map.values());
}

function sortStars(a: IFunctionalStar, b: IFunctionalStar): number {
    const priority: Record<string, number> = {
        major: 0,
        soft: 1,
        tough: 2,
        lucun: 3,
        tianma: 4,
        helper: 5,
        flower: 6,
        adjective: 7,
    };

    return (priority[a.type] ?? 99) - (priority[b.type] ?? 99) || a.name.localeCompare(b.name, 'zh-Hans-CN');
}

function formatHoroscopeItem(astrolabe: IFunctionalAstrolabe, item: { index: number; heavenlyStem: string; earthlyBranch: string; name: string }): string {
    const palaceName = astrolabe.palaces[item.index]?.name || '未知宫位';
    return `${item.name} · ${palaceName} · ${item.heavenlyStem}${item.earthlyBranch}`;
}

export function buildZiweiBoardMetrics(screenWidth: number): ZiweiBoardMetrics {
    const safeScreenWidth = Number.isFinite(screenWidth) && screenWidth > 0 ? screenWidth : 393;
    const chromeInset = safeScreenWidth <= 360 ? 2 : safeScreenWidth <= 430 ? 3 : 4;
    const boardInset = safeScreenWidth <= 375 ? 4 : 6;
    const gap = safeScreenWidth <= 375 ? 4 : 6;
    const outerWidth = Math.min(safeScreenWidth - chromeInset * 2, BOARD_MAX_WIDTH);
    const usableWidth = outerWidth - boardInset * 2 - gap * 3;
    const cellWidth = Math.round(usableWidth / 4);
    const centerWidth = cellWidth * 2 + gap;
    const boardWidth = boardInset * 2 + cellWidth * 4 + gap * 3;
    const cellHeight = Math.max(150, Math.round(cellWidth * 1.72));
    const centerHeight = cellHeight * 2 + gap;
    const centerTopHeight = Math.max(104, Math.round(centerHeight * 0.33));
    const tilePadding = safeScreenWidth <= 375 ? 4 : 5;
    const sectionGap = safeScreenWidth <= 375 ? 4 : 6;
    const controlCardPadding = safeScreenWidth <= 375 ? 6 : 8;
    const controlRowHeight = safeScreenWidth <= 375 ? 34 : 36;

    return {
        boardWidth,
        boardHeight: boardInset * 2 + cellHeight * 4 + gap * 3,
        gap,
        boardInset,
        cellWidth,
        cellHeight,
        cellSize: cellWidth,
        centerWidth,
        centerHeight,
        centerSize: centerWidth,
        chromeInset,
        outerPadding: chromeInset,
        tilePadding,
        centerTopHeight,
        centerBottomHeight: centerHeight - centerTopHeight,
        sectionGap,
        controlCardPadding,
        controlRowHeight,
        controlInset: controlCardPadding,
    };
}

function clampZoomTravel(delta: number, limit: number): number {
    if (!Number.isFinite(delta)) {
        return 0;
    }

    return Math.max(-limit, Math.min(limit, delta));
}

export function buildZiweiZoomMotion(
    sourceRect: ZiweiZoomRect,
    targetRect: ZiweiZoomRect,
    screenWidth: number,
    screenHeight: number,
): ZiweiZoomMotion {
    const maxTranslateX = Math.min(ZIWEI_ZOOM_MAX_X, Math.max(48, screenWidth * 0.24));
    const maxTranslateY = Math.min(ZIWEI_ZOOM_MAX_Y, Math.max(64, screenHeight * 0.22));
    const initialScale = Math.max(0.56, Math.min(1, sourceRect.width / targetRect.width));

    return {
        translateX: clampZoomTravel(sourceRect.x - targetRect.x, maxTranslateX),
        translateY: clampZoomTravel(sourceRect.y - targetRect.y, maxTranslateY),
        initialScale,
    };
}

export function buildZiweiBoardLayout(astrolabe: IFunctionalAstrolabe): ZiweiBoardLayout {
    const cells = SLOT_ORDER.map((item) => buildBoardCell(astrolabe, item));

    return {
        top: cells.filter((item) => item.row === 0),
        left: cells.filter((item) => item.col === 0 && item.row > 0 && item.row < 3),
        right: cells.filter((item) => item.col === 3 && item.row > 0 && item.row < 3),
        bottom: cells.filter((item) => item.row === 3),
        ringCells: cells,
        center: {
            row: 1,
            col: 1,
            rowSpan: 2,
            colSpan: 2,
        },
        byPalaceName: Object.fromEntries(cells.map((item) => [item.palaceName, item])),
    };
}

function buildPalaceAnalysisView(
    astrolabe: IFunctionalAstrolabe,
    palace: IFunctionalPalace,
    activeScopes: ZiweiActiveScope[],
    algorithm: ZiweiAlgorithm,
): ZiweiPalaceAnalysisView {
    const flight = buildPalaceFlightView(palace, astrolabe);

    return {
        palaceIndex: palace.index,
        name: palace.name,
        heavenlyStem: palace.heavenlyStem,
        earthlyBranch: palace.earthlyBranch,
        isBodyPalace: palace.isBodyPalace,
        isOriginalPalace: palace.isOriginalPalace,
        isEmpty: palace.isEmpty(),
        hasBirthMutagen: flight.birthMutagens.length > 0,
        hasSelfMutagen: flight.selfMutagens.length > 0,
        mutagedPlaces: flight.destinations.map((item) => item.palaceName).filter(Boolean) as string[],
        flight,
        majorStars: palace.majorStars.map((star) => toStarViewModel(star, palace.earthlyBranch, algorithm)),
        minorStars: palace.minorStars.map((star) => toStarViewModel(star, palace.earthlyBranch, algorithm)),
        adjectiveStars: palace.adjectiveStars.map((star) => toStarViewModel(star, palace.earthlyBranch, algorithm)),
        changsheng12: palace.changsheng12,
        boshi12: palace.boshi12,
        jiangqian12: palace.jiangqian12,
        suiqian12: palace.suiqian12,
        decadalRange: `${palace.decadal.range[0]}-${palace.decadal.range[1]}岁`,
        ages: palace.ages.join(' · '),
        activeScopes,
        surrounded: buildSurroundedPalacesView(astrolabe.surroundedPalaces(palace.name))!,
    };
}

export function buildZiweiStaticPalaceAnalysisViews(astrolabe: IFunctionalAstrolabe, algorithm: ZiweiAlgorithm): ZiweiPalaceAnalysisView[] {
    return astrolabe.palaces.map((palace) => buildPalaceAnalysisView(astrolabe, palace, [], algorithm));
}

export function buildZiweiPalaceAnalysisViews(
    astrolabe: IFunctionalAstrolabe,
    horoscope: IFunctionalHoroscope,
    algorithm: ZiweiAlgorithm,
): ZiweiPalaceAnalysisView[] {
    return astrolabe.palaces.map((palace) => buildPalaceAnalysisView(astrolabe, palace, buildActiveScopes(palace.index, horoscope), algorithm));
}

export function buildZiweiStarInsightViews(astrolabe: IFunctionalAstrolabe, algorithm: ZiweiAlgorithm): ZiweiStarInsightView[] {
    return uniqueStars(astrolabe)
        .sort(sortStars)
        .map((star) => {
            const palace = star.palace();
            const oppositePalace = star.oppositePalace();
            const surrounded = star.surroundedPalaces();

            const palaceEarthlyBranch = palace?.earthlyBranch || '';
            const resolvedBrightness = resolveStarBrightness(star, palaceEarthlyBranch, algorithm);

            return {
                name: star.name,
                brightness: resolvedBrightness,
                mutagen: star.mutagen || '',
                brightnessMatches: resolvedBrightness
                    ? [resolvedBrightness as ZiweiBrightness]
                    : ZIWEI_BRIGHTNESS_LEVELS.filter((brightness) => star.withBrightness(brightness as any)),
                mutagenFlags: ZIWEI_MUTAGENS.filter((mutagen) => star.withMutagen(mutagen as any)),
                scope: star.scope,
                palaceName: palace?.name || '未知宫位',
                oppositePalaceName: oppositePalace?.name || '未知宫位',
                surrounded: buildSurroundedPalacesView(surrounded),
            };
        });
}

function buildDirectHoroscopeScopeView(
    astrolabe: IFunctionalAstrolabe,
    scope: ZiweiDynamicScope,
    item: IFunctionalHoroscope[ZiweiDynamicScope],
    algorithm: ZiweiAlgorithm,
): ZiweiDirectHoroscopeScopeView {
    const palaceStars = star
        .getHoroscopeStar(item.heavenlyStem as any, item.earthlyBranch as any, scope)
        .map((starsAtPalace, palaceIndex) => ({
            palaceName: astrolabe.palaces[palaceIndex]?.name || `第${palaceIndex + 1}宫`,
            palaceIndex,
            starNames: starsAtPalace.map((directStar) => directStar.name),
            stars: starsAtPalace.map((directStar) => toStarViewModel(directStar, astrolabe.palaces[palaceIndex]?.earthlyBranch || '', algorithm)),
        }));

    return {
        scope,
        heavenlyStem: item.heavenlyStem,
        earthlyBranch: item.earthlyBranch,
        palaceStars,
        byPalaceName: Object.fromEntries(palaceStars.map((entry) => [entry.palaceName, entry])),
    };
}

export function buildZiweiDirectHoroscopeScopeViewByScope(
    astrolabe: IFunctionalAstrolabe,
    horoscope: IFunctionalHoroscope,
    scope: ZiweiDynamicScope,
    algorithm: ZiweiAlgorithm,
): ZiweiDirectHoroscopeScopeView {
    return buildDirectHoroscopeScopeView(astrolabe, scope, horoscope[scope], algorithm);
}

export function buildZiweiDirectHoroscopeScopeViews(
    astrolabe: IFunctionalAstrolabe,
    horoscope: IFunctionalHoroscope,
    algorithm: ZiweiAlgorithm,
): Partial<Record<ZiweiDynamicScope, ZiweiDirectHoroscopeScopeView>> {
    return {
        decadal: buildZiweiDirectHoroscopeScopeViewByScope(astrolabe, horoscope, 'decadal', algorithm),
        yearly: buildZiweiDirectHoroscopeScopeViewByScope(astrolabe, horoscope, 'yearly', algorithm),
        monthly: buildZiweiDirectHoroscopeScopeViewByScope(astrolabe, horoscope, 'monthly', algorithm),
        daily: buildZiweiDirectHoroscopeScopeViewByScope(astrolabe, horoscope, 'daily', algorithm),
        hourly: buildZiweiDirectHoroscopeScopeViewByScope(astrolabe, horoscope, 'hourly', algorithm),
    };
}

export function buildZiweiHoroscopeScopeViews(
    astrolabe: IFunctionalAstrolabe,
    horoscope: IFunctionalHoroscope,
    directHoroscopeByScope: Partial<Record<ZiweiDynamicScope, ZiweiDirectHoroscopeScopeView>> = {},
): ZiweiHoroscopeScopeView[] {
    const agePalace = horoscope.agePalace();

    const scoped = (
        scope: Exclude<ZiweiActiveScope, 'age'>,
        item: IFunctionalHoroscope['decadal'],
        focusPalaceName: string,
    ): ZiweiHoroscopeScopeView => {
        const activePalaceName = astrolabe.palaces[item.index]?.name || '未知宫位';

        return {
            scope,
            label: SCOPE_LABELS[scope],
            palaceName: activePalaceName,
            heavenlyStem: item.heavenlyStem,
            earthlyBranch: item.earthlyBranch,
            mutagen: item.mutagen,
            mutagenStars: buildHoroscopeMutagenStars(item.mutagen),
            stars: flattenHoroscopeStars(item.stars),
            directHoroscopeStars: directHoroscopeByScope[scope]?.byPalaceName[activePalaceName]?.starNames || [],
            surrounded: buildSurroundedPalacesView(horoscope.surroundPalaces(focusPalaceName as any, scope as any)),
            hasLu: horoscope.hasHoroscopeMutagen(focusPalaceName as any, scope as any, '禄'),
            hasQuan: horoscope.hasHoroscopeMutagen(focusPalaceName as any, scope as any, '权'),
            hasKe: horoscope.hasHoroscopeMutagen(focusPalaceName as any, scope as any, '科'),
            hasJi: horoscope.hasHoroscopeMutagen(focusPalaceName as any, scope as any, '忌'),
        };
    };

    return [
        scoped('decadal', horoscope.decadal, '命宫'),
        {
            scope: 'age',
            label: SCOPE_LABELS.age,
            palaceName: agePalace?.name || '未知宫位',
            heavenlyStem: agePalace?.heavenlyStem || '',
            earthlyBranch: agePalace?.earthlyBranch || '',
            mutagen: horoscope.age.mutagen || [],
            mutagenStars: buildHoroscopeMutagenStars(horoscope.age.mutagen || []),
            stars: [],
            directHoroscopeStars: [],
            surrounded: agePalace ? buildSurroundedPalacesView(astrolabe.surroundedPalaces(agePalace.name)) : null,
            hasLu: agePalace ? agePalace.hasMutagen('禄') : false,
            hasQuan: agePalace ? agePalace.hasMutagen('权') : false,
            hasKe: agePalace ? agePalace.hasMutagen('科') : false,
            hasJi: agePalace ? agePalace.hasMutagen('忌') : false,
        },
        scoped('yearly', horoscope.yearly, '命宫'),
        scoped('monthly', horoscope.monthly, '命宫'),
        scoped('daily', horoscope.daily, '命宫'),
        scoped('hourly', horoscope.hourly, '命宫'),
    ];
}

export function buildZiweiHoroscopePalaceView(
    astrolabe: IFunctionalAstrolabe,
    horoscope: IFunctionalHoroscope,
    palaceName: string,
    scope: ZiweiDynamicScope,
    directHoroscope?: ZiweiDirectHoroscopeScopeView | null,
): ZiweiHoroscopePalaceView | null {
    const palace = horoscope.palace(palaceName as any, scope as any);
    if (!palace) {
        return null;
    }

    const horoscopeItem = horoscope[scope];
    const surrounded = horoscope.surroundPalaces(palaceName as any, scope as any);
    const resolvedPalaceName = palace.name;
    const directHoroscopeStars = directHoroscope?.byPalaceName[resolvedPalaceName]?.starNames || [];

    return {
        scope,
        requestedPalaceName: palaceName,
        resolvedPalaceName,
        heavenlyStem: palace.heavenlyStem,
        earthlyBranch: palace.earthlyBranch,
        mutagen: horoscopeItem.mutagen,
        mutagenStars: buildHoroscopeMutagenStars(horoscopeItem.mutagen),
        stars: flattenHoroscopeStars(horoscopeItem.stars),
        directHoroscopeStars,
        directHoroscopeAllPresent:
            directHoroscopeStars.length > 0
                ? horoscope.hasHoroscopeStars(palaceName as any, scope as any, directHoroscopeStars as any)
                : false,
        directHoroscopeAnyPresent:
            directHoroscopeStars.length > 0
                ? horoscope.hasOneOfHoroscopeStars(palaceName as any, scope as any, directHoroscopeStars as any)
                : false,
        directHoroscopeAllAbsent:
            directHoroscopeStars.length > 0
                ? horoscope.notHaveHoroscopeStars(palaceName as any, scope as any, directHoroscopeStars as any)
                : false,
        surrounded: buildSurroundedPalacesView(surrounded),
        hasLu: horoscope.hasHoroscopeMutagen(palaceName as any, scope as any, '禄'),
        hasQuan: horoscope.hasHoroscopeMutagen(palaceName as any, scope as any, '权'),
        hasKe: horoscope.hasHoroscopeMutagen(palaceName as any, scope as any, '科'),
        hasJi: horoscope.hasHoroscopeMutagen(palaceName as any, scope as any, '忌'),
    };
}

function trimOldestCacheEntry<T>(cache: Map<string, T>, limit: number) {
    if (cache.size <= limit) {
        return;
    }

    const oldestKey = cache.keys().next().value;
    if (oldestKey) {
        cache.delete(oldestKey);
    }
}

export function buildZiweiBoardDecorationCacheKey(
    staticChart: ZiweiStaticChartResult,
    dynamic: ZiweiDynamicHoroscopeResult,
    activeScope: ZiweiActiveScope,
): string {
    return `${staticChart.cacheKey}|${dynamic.cursorDate.getTime()}|${activeScope}`;
}

function buildZiweiDecadalAssignmentsCacheKey(
    staticChart: ZiweiStaticChartResult,
    dynamic: ZiweiDynamicHoroscopeResult,
): string {
    return `${staticChart.cacheKey}|${dynamic.horoscopeNow.decadal.index}|${staticChart.input.config.horoscopeDivide}`;
}

function getScopeOverlayPalaceName(
    horoscope: IFunctionalHoroscope,
    palaceIndex: number,
    scope: ZiweiActiveScope,
): string {
    if (scope === 'age') {
        return horoscope.age.palaceNames[palaceIndex] || '';
    }

    return horoscope[scope].palaceNames[palaceIndex] || '';
}

function getPalaceShortLabel(palaceName: string): string {
    if (!palaceName) {
        return '';
    }

    return PALACE_SHORT_LABELS[palaceName] || palaceName.replace(/宫/g, '').slice(0, 1);
}

function buildScopeOverlayLabel(
    horoscope: IFunctionalHoroscope,
    palaceIndex: number,
    scope: ZiweiActiveScope,
): string {
    const palaceName = getScopeOverlayPalaceName(horoscope, palaceIndex, scope);
    return `${SCOPE_PREFIX_LABELS[scope]}${getPalaceShortLabel(palaceName)}`;
}

function buildVisibleScopes(activeScope: ZiweiActiveScope): ZiweiActiveScope[] {
    return CUMULATIVE_SCOPE_ORDER.slice(0, CUMULATIVE_SCOPE_ORDER.indexOf(activeScope) + 1);
}

function buildOverlayMutagens(
    palace: ZiweiPalaceAnalysisView,
    horoscope: IFunctionalHoroscope,
    scope: ZiweiActiveScope,
): ZiweiMutagen[] {
    if (scope === 'age') {
        const palaceStarNames = [
            ...palace.majorStars,
            ...palace.minorStars,
            ...palace.adjectiveStars,
        ].map((star) => star.name);
        const [lu = '', quan = '', ke = '', ji = ''] = horoscope.age.mutagen || [];

        return [
            { key: '禄' as ZiweiMutagen, starName: lu },
            { key: '权' as ZiweiMutagen, starName: quan },
            { key: '科' as ZiweiMutagen, starName: ke },
            { key: '忌' as ZiweiMutagen, starName: ji },
        ].filter((item) => item.starName && palaceStarNames.includes(item.starName)).map((item) => item.key);
    }

    return ZIWEI_MUTAGENS.filter((mutagen) => horoscope.hasHoroscopeMutagen(palace.name as any, scope as any, mutagen as any));
}

function buildOverlayStars(
    horoscope: IFunctionalHoroscope,
    palaceIndex: number,
    scope: ZiweiActiveScope,
): string[] {
    if (scope === 'age') {
        return [];
    }

    return (horoscope[scope].stars?.[palaceIndex] || []).map((star) => star.name);
}

function buildPalaceOverlays(
    palace: ZiweiPalaceAnalysisView,
    horoscope: IFunctionalHoroscope,
    activeScope: ZiweiActiveScope,
): ZiweiPalaceOverlayView[] {
    const visibleScopes = new Set(buildVisibleScopes(activeScope));

    return OVERLAY_DISPLAY_ORDER
        .filter((scope) => visibleScopes.has(scope))
        .map((scope) => ({
            key: scope,
            label: buildScopeOverlayLabel(horoscope, palace.palaceIndex, scope),
            tone: scope,
            active: scope === activeScope,
            stars: buildOverlayStars(horoscope, palace.palaceIndex, scope),
            mutagens: buildOverlayMutagens(palace, horoscope, scope),
        }));
}

function buildHistoryOverlayLabels(
    overlays: ZiweiPalaceOverlayView[],
    activeScope: ZiweiActiveScope,
): string[] {
    return overlays
        .filter((overlay) => overlay.key !== activeScope)
        .map((overlay) => overlay.label);
}

function buildDisplayYearAssignment(
    yearAssignments: ZiweiPalaceYearAssignmentView[],
): ZiweiPalaceYearAssignmentView | null {
    if (yearAssignments.length === 0) {
        return null;
    }

    return yearAssignments.find((item) => item.active) || yearAssignments[0] || null;
}

function buildDecadalYearAssignments(
    staticChart: ZiweiStaticChartResult,
    dynamic: ZiweiDynamicHoroscopeResult,
    resolveDynamicHoroscope: (
        staticChart: ZiweiStaticChartResult,
        cursorDate: Date,
    ) => ZiweiDynamicHoroscopeResult,
): Record<string, ZiweiPalaceYearAssignmentView[]> {
    const cacheKey = buildZiweiDecadalAssignmentsCacheKey(staticChart, dynamic);
    const cached = ziweiDecadalAssignmentsCache.get(cacheKey);

    if (cached) {
        return cached;
    }

    const assignments = measureZiweiPerf('buildDecadalYearAssignments', () => {
        const nextAssignments = Object.fromEntries(
            staticChart.palaces.map((palace) => [palace.name, [] as ZiweiPalaceYearAssignmentView[]]),
        ) as Record<string, ZiweiPalaceYearAssignmentView[]>;
        const [startAge, endAge] = staticChart.astrolabe.palaces[dynamic.horoscopeNow.decadal.index]?.decadal.range || [0, -1];
        const birthYear = staticChart.input.birthLocalDate.getFullYear();
        const horoscopeDivide = staticChart.input.config.horoscopeDivide;

        for (let nominalAge = startAge; nominalAge <= endAge; nominalAge += 1) {
            const year = birthYear + nominalAge - 1;
            const cursorDate = buildNominalAgeCursorDate(birthYear, nominalAge, horoscopeDivide);
            const yearlyDynamic = resolveDynamicHoroscope(staticChart, cursorDate);
            const yearlyPalace = staticChart.astrolabe.palaces[yearlyDynamic.horoscopeNow.yearly.index];

            if (!yearlyPalace) {
                continue;
            }

            nextAssignments[yearlyPalace.name]?.push({
                key: `age-${year}-${nominalAge}`,
                label: `${year}年${nominalAge}岁`,
                year,
                nominalAge,
                active: false,
            });
        }

        return nextAssignments;
    });

    ziweiDecadalAssignmentsCache.set(cacheKey, assignments);
    trimOldestCacheEntry(ziweiDecadalAssignmentsCache, ZIWEI_DECADAL_ASSIGNMENT_CACHE_LIMIT);
    return assignments;
}

export function buildZiweiBoardDecorations(
    staticChart: ZiweiStaticChartResult,
    dynamic: ZiweiDynamicHoroscopeResult,
    activeScope: ZiweiActiveScope,
    resolveDynamicHoroscope: (
        staticChart: ZiweiStaticChartResult,
        cursorDate: Date,
    ) => ZiweiDynamicHoroscopeResult,
): ZiweiBoardDecorationModel {
    const cacheKey = buildZiweiBoardDecorationCacheKey(staticChart, dynamic, activeScope);
    const cached = ziweiBoardDecorationsCache.get(cacheKey);

    if (cached) {
        return cached;
    }

    const baseAssignments = buildDecadalYearAssignments(staticChart, dynamic, resolveDynamicHoroscope);
    const currentYear = dynamic.cursorDate.getFullYear();
    const byPalaceName = Object.fromEntries(staticChart.palaces.map((palace) => {
        const overlays = buildPalaceOverlays(palace, dynamic.horoscopeNow, activeScope);
        const activeOverlay = overlays.find((overlay) => overlay.key === activeScope) || null;
        const historyOverlayLabels = buildHistoryOverlayLabels(overlays, activeScope);
        const baseYearAssignments = baseAssignments[palace.name] || [];
        const yearAssignments = baseYearAssignments.map((item) => ({
            ...item,
            active: item.year === currentYear,
        }));
        const displayYearAssignment = buildDisplayYearAssignment(yearAssignments);

        return [
            palace.name,
            {
                palaceName: palace.name,
                overlays,
                activeOverlay,
                historyOverlayLabels,
                yearAssignments,
                displayYearAssignment,
            },
        ];
    })) as Record<string, ZiweiPalaceDecorationView>;

    const nextDecorationModel: ZiweiBoardDecorationModel = {
        cacheKey,
        activeScope,
        byPalaceName,
    };

    ziweiBoardDecorationsCache.set(cacheKey, nextDecorationModel);
    trimOldestCacheEntry(ziweiBoardDecorationsCache, ZIWEI_DECORATION_CACHE_LIMIT);
    return nextDecorationModel;
}

export function getCurrentScopeSummary(dynamic: ZiweiDynamicHoroscopeResult, activeScope: ZiweiActiveScope): string {
    switch (activeScope) {
        case 'decadal':
            return dynamic.horoscopeSummary.decadal;
        case 'age':
            return dynamic.horoscopeSummary.age;
        case 'yearly':
            return dynamic.horoscopeSummary.yearly;
        case 'monthly':
            return dynamic.horoscopeSummary.monthly;
        case 'daily':
            return dynamic.horoscopeSummary.daily;
        case 'hourly':
            return dynamic.horoscopeSummary.hourly;
        default:
            return dynamic.horoscopeSummary.yearly;
    }
}

function buildPalaceScopeTags(
    palace: ZiweiPalaceAnalysisView,
    dynamic: ZiweiDynamicHoroscopeResult,
    activeScope: ZiweiActiveScope,
): ZiweiScopeTagView[] {
    const tags: ZiweiScopeTagView[] = [
        {
            key: 'decadal',
            label: `大${(dynamic.horoscopeNow.decadal.palaceNames[palace.palaceIndex] || '').replace(/\s/g, '').slice(0, 1) || palace.name.slice(0, 1)}`,
            tone: 'decadal',
            active: activeScope === 'decadal',
        },
        {
            key: 'yearly',
            label: `年${(dynamic.horoscopeNow.yearly.palaceNames[palace.palaceIndex] || '').replace(/\s/g, '').slice(0, 1) || palace.name.slice(0, 1)}`,
            tone: 'yearly',
            active: activeScope === 'yearly',
        },
        {
            key: 'monthly',
            label: `月${(dynamic.horoscopeNow.monthly.palaceNames[palace.palaceIndex] || '').replace(/\s/g, '').slice(0, 1) || palace.name.slice(0, 1)}`,
            tone: 'monthly',
            active: activeScope === 'monthly',
        },
        {
            key: 'daily',
            label: `日${(dynamic.horoscopeNow.daily.palaceNames[palace.palaceIndex] || '').replace(/\s/g, '').slice(0, 1) || palace.name.slice(0, 1)}`,
            tone: 'daily',
            active: activeScope === 'daily',
        },
        {
            key: 'hourly',
            label: `时${(dynamic.horoscopeNow.hourly.palaceNames[palace.palaceIndex] || '').replace(/\s/g, '').slice(0, 1) || palace.name.slice(0, 1)}`,
            tone: 'hourly',
            active: activeScope === 'hourly',
        },
    ];

    if (dynamic.horoscopeNow.agePalace()?.name === palace.name) {
        tags.unshift({
            key: 'age',
            label: `小${dynamic.horoscopeNow.age.nominalAge}`,
            tone: 'age',
            active: activeScope === 'age',
        });
    }

    if (palace.isOriginalPalace) {
        tags.unshift({
            key: 'origin',
            label: '命',
            tone: 'origin',
            active: false,
        });
    }
    if (palace.isBodyPalace) {
        tags.push({
            key: 'body',
            label: '身',
            tone: 'body',
            active: false,
        });
    }

    return tags;
}

export function buildZiweiPalaceFooterText(
    palace: ZiweiPalaceAnalysisView,
    scopeOverlayText: string,
): string {
    return [
        scopeOverlayText || palace.changsheng12,
        palace.suiqian12,
        palace.jiangqian12,
    ].filter(Boolean).join(' · ');
}

function resolveScopeMutagenStars(
    dynamic: ZiweiDynamicHoroscopeResult,
    activeScope: ZiweiActiveScope,
): ZiweiHoroscopeMutagenStars {
    switch (activeScope) {
        case 'decadal':
            return buildHoroscopeMutagenStars(dynamic.horoscopeNow.decadal.mutagen);
        case 'age':
            return buildHoroscopeMutagenStars(dynamic.horoscopeNow.age.mutagen || []);
        case 'yearly':
            return buildHoroscopeMutagenStars(dynamic.horoscopeNow.yearly.mutagen);
        case 'monthly':
            return buildHoroscopeMutagenStars(dynamic.horoscopeNow.monthly.mutagen);
        case 'daily':
            return buildHoroscopeMutagenStars(dynamic.horoscopeNow.daily.mutagen);
        case 'hourly':
            return buildHoroscopeMutagenStars(dynamic.horoscopeNow.hourly.mutagen);
        default:
            return buildHoroscopeMutagenStars(dynamic.horoscopeNow.yearly.mutagen);
    }
}

function buildZiweiCenterMutagenBadges(mutagenStars: ZiweiHoroscopeMutagenStars): ZiweiCenterMutagenBadgeView[] {
    return [
        { key: 'lu', label: '禄', value: mutagenStars.lu || '--', active: Boolean(mutagenStars.lu) },
        { key: 'quan', label: '权', value: mutagenStars.quan || '--', active: Boolean(mutagenStars.quan) },
        { key: 'ke', label: '科', value: mutagenStars.ke || '--', active: Boolean(mutagenStars.ke) },
        { key: 'ji', label: '忌', value: mutagenStars.ji || '--', active: Boolean(mutagenStars.ji) },
    ];
}

export function buildZiweiCenterOverviewState(params: {
    soul: string;
    body: string;
    activeScope: ZiweiActiveScope;
    selectedPalace: ZiweiPalaceAnalysisView;
    currentScopeSummary: string;
    mutagenStars: ZiweiHoroscopeMutagenStars;
    selectedScopePalace?: ZiweiHoroscopePalaceView | null;
    ageSummary?: string;
}): ZiweiBoardCenterPanelState {
    const {
        soul,
        body,
        activeScope,
        selectedPalace,
        currentScopeSummary,
        mutagenStars,
        selectedScopePalace,
        ageSummary,
    } = params;

    return {
        focusTitle: `${selectedPalace.name} · ${selectedPalace.heavenlyStem}${selectedPalace.earthlyBranch}`,
        scopeState: selectedScopePalace
            ? `${SCOPE_LABELS[activeScope]} · ${selectedScopePalace.resolvedPalaceName} · ${selectedScopePalace.heavenlyStem}${selectedScopePalace.earthlyBranch}`
            : (ageSummary || `当前 ${SCOPE_LABELS[activeScope]}`),
        scopeSummary: currentScopeSummary,
        summaryItems: [
            `命主 ${soul}`,
            `身主 ${body}`,
            `当前 ${SCOPE_LABELS[activeScope]}`,
        ],
        mutagenBadges: buildZiweiCenterMutagenBadges(mutagenStars),
    };
}

function buildZiweiScopeRenderByPalaceName(
    staticChart: ZiweiStaticChartResult,
    dynamic: ZiweiDynamicHoroscopeResult,
    activeScope: ZiweiActiveScope,
): Record<string, ZiweiPalaceScopeRenderModel> {
    return Object.fromEntries(staticChart.palaces.map((palace) => {
        const scopeOverlayText = activeScope === 'age'
            ? (dynamic.horoscopeNow.agePalace()?.name === palace.name ? `${dynamic.horoscopeNow.age.nominalAge}虚岁` : '')
            : dynamic.horoscopeNow[activeScope].palaceNames[palace.palaceIndex];

        return [
            palace.name,
            {
                palaceName: palace.name,
                scopeTags: buildPalaceScopeTags(palace, dynamic, activeScope),
                isAgePalace: dynamic.horoscopeNow.agePalace()?.name === palace.name,
                scopeOverlayText: scopeOverlayText || '',
                footerText: buildZiweiPalaceFooterText(palace, scopeOverlayText || ''),
            },
        ];
    })) as Record<string, ZiweiPalaceScopeRenderModel>;
}

export function buildZiweiBoardScopeModel(
    staticChart: ZiweiStaticChartResult,
    dynamic: ZiweiDynamicHoroscopeResult,
    activeScope: ZiweiActiveScope,
    selectedDirectScopeArg?: ZiweiDirectHoroscopeScopeView | null,
): ZiweiBoardScopeModel {
    const currentScopeSummary = getCurrentScopeSummary(dynamic, activeScope);
    const selectedDirectScope = selectedDirectScopeArg !== undefined
        ? selectedDirectScopeArg
        : activeScope !== 'age'
            ? buildZiweiDirectHoroscopeScopeViewByScope(
                staticChart.astrolabe,
                dynamic.horoscopeNow,
                activeScope,
                staticChart.input.config.algorithm,
            )
            : null;

    return {
        activeScope,
        currentScopeSummary,
        selectedDirectScope,
        byPalaceName: buildZiweiScopeRenderByPalaceName(staticChart, dynamic, activeScope),
    };
}

export function buildZiweiBoardRenderModelFromScopeModel(params: {
    staticChart: ZiweiStaticChartResult;
    dynamic: ZiweiDynamicHoroscopeResult;
    scopeModel: ZiweiBoardScopeModel;
    selectedPalaceName: string;
}): ZiweiBoardRenderModel {
    const { staticChart, dynamic, scopeModel, selectedPalaceName } = params;
    const selectedPalace = staticChart.palaceByName[selectedPalaceName] || staticChart.palaceByName.命宫;
    const highlightSurrounded = selectedPalace.surrounded;
    const selectedScopePalace = scopeModel.activeScope === 'age'
        ? null
        : buildZiweiHoroscopePalaceView(
            staticChart.astrolabe,
            dynamic.horoscopeNow,
            selectedPalace.name,
            scopeModel.activeScope,
            scopeModel.selectedDirectScope,
        );
    const centerMutagenStars = selectedScopePalace?.mutagenStars || resolveScopeMutagenStars(dynamic, scopeModel.activeScope);
    const byPalaceName = Object.fromEntries(staticChart.palaces.map((palace) => {
        const baseModel = scopeModel.byPalaceName[palace.name];
        return [
            palace.name,
            {
                ...baseModel,
                selected: selectedPalaceName === palace.name,
                highlightKind: getPalaceHighlightKind(palace.name, highlightSurrounded),
            },
        ];
    })) as Record<string, ZiweiPalaceRenderModel>;

    return {
        byPalaceName,
        currentScopeSummary: scopeModel.currentScopeSummary,
        centerPanel: buildZiweiCenterOverviewState({
            soul: staticChart.astrolabe.soul,
            body: staticChart.astrolabe.body,
            activeScope: scopeModel.activeScope,
            selectedPalace,
            currentScopeSummary: scopeModel.currentScopeSummary,
            mutagenStars: centerMutagenStars,
            selectedScopePalace,
            ageSummary: scopeModel.activeScope === 'age'
                ? `小限 · ${dynamic.horoscopeNow.agePalace()?.name || selectedPalace.name} · 虚岁 ${dynamic.horoscopeNow.age.nominalAge}`
                : undefined,
        }),
    };
}

function getPalaceHighlightKind(
    palaceName: string,
    surrounded: ZiweiSurroundedPalacesView,
): ZiweiPalaceRenderModel['highlightKind'] {
    if (surrounded.target === palaceName) {
        return 'target';
    }
    if (surrounded.opposite === palaceName) {
        return 'opposite';
    }
    if (surrounded.wealth === palaceName) {
        return 'wealth';
    }
    if (surrounded.career === palaceName) {
        return 'career';
    }
    return null;
}

function buildZiweiSnapshotCenterPanel(params: {
    selectedPalace: ZiweiPalaceAnalysisView;
    staticMeta: ZiweiChartSnapshotV1['staticMeta'];
}): ZiweiBoardCenterPanelState {
    const { selectedPalace, staticMeta } = params;

    return {
        focusTitle: `${selectedPalace.name} · ${selectedPalace.heavenlyStem}${selectedPalace.earthlyBranch}`,
        scopeState: '本命盘 · 静态快照',
        scopeSummary: [
            staticMeta.fiveElementsClass,
            selectedPalace.decadalRange,
            selectedPalace.isBodyPalace ? '身宫' : '',
            selectedPalace.isOriginalPalace ? '来因宫' : '',
        ].filter(Boolean).join(' · '),
        summaryItems: [
            `命主 ${staticMeta.soul}`,
            `身主 ${staticMeta.body}`,
            '历史快照',
        ],
        mutagenBadges: buildZiweiCenterMutagenBadges({
            lu: '',
            quan: '',
            ke: '',
            ji: '',
        }),
    };
}

function buildZiweiBoardSnapshotModelFromPalaces(params: {
    palaces: ZiweiPalaceAnalysisView[];
    staticMeta: ZiweiChartSnapshotV1['staticMeta'];
    selectedPalaceName: string;
}): ZiweiBoardSnapshotModel {
    const palaceByName = Object.fromEntries(params.palaces.map((palace) => [palace.name, palace])) as Record<string, ZiweiPalaceAnalysisView>;
    const fallbackPalace = palaceByName.命宫 || params.palaces[0];
    const selectedPalace = palaceByName[params.selectedPalaceName] || fallbackPalace;
    const highlightSurrounded = selectedPalace.surrounded;
    const byPalaceName = Object.fromEntries(params.palaces.map((palace) => [
        palace.name,
        {
            palaceName: palace.name,
            selected: selectedPalace.name === palace.name,
            highlightKind: getPalaceHighlightKind(palace.name, highlightSurrounded),
        },
    ])) as Record<string, ZiweiPalaceSelectionRenderModel>;

    return {
        selectedPalaceName: selectedPalace.name,
        byPalaceName,
        centerPanel: buildZiweiSnapshotCenterPanel({
            selectedPalace,
            staticMeta: params.staticMeta,
        }),
    };
}

export function hydrateZiweiBoardSnapshotModel(
    snapshot: ZiweiChartSnapshotV1,
    selectedPalaceName: string = snapshot.baseBoard.selectedPalaceName,
): ZiweiBoardSnapshotModel {
    if (selectedPalaceName === snapshot.baseBoard.selectedPalaceName) {
        return snapshot.baseBoard;
    }

    return buildZiweiBoardSnapshotModelFromPalaces({
        palaces: snapshot.palaces,
        staticMeta: snapshot.staticMeta,
        selectedPalaceName,
    });
}

export function buildZiweiChartSnapshot(staticChart: ZiweiStaticChartResult): ZiweiChartSnapshotV1 {
    if (staticChart.lazy.chartSnapshot) {
        return staticChart.lazy.chartSnapshot;
    }

    const defaultSelectedPalaceName = staticChart.palaceByName.命宫
        ? '命宫'
        : staticChart.palaces[0]?.name || '命宫';
    const staticMeta: ZiweiChartSnapshotV1['staticMeta'] = {
        lunarDate: staticChart.astrolabe.lunarDate,
        chineseDate: staticChart.astrolabe.chineseDate,
        fiveElementsClass: staticChart.astrolabe.fiveElementsClass,
        soul: staticChart.astrolabe.soul,
        body: staticChart.astrolabe.body,
        birthLocal: staticChart.input.birthLocal,
        trueSolarDateTimeLocal: formatLocalDateTime(staticChart.input.trueSolarDate),
        timeLabel: staticChart.input.timeLabel,
        timeRange: staticChart.input.timeRange,
    };
    const snapshot: ZiweiChartSnapshotV1 = {
        version: 1,
        staticMeta,
        workbenchLayout: staticChart.workbenchLayout,
        palaces: staticChart.palaces,
        baseBoard: buildZiweiBoardSnapshotModelFromPalaces({
            palaces: staticChart.palaces,
            staticMeta,
            selectedPalaceName: defaultSelectedPalaceName,
        }),
    };

    staticChart.lazy.chartSnapshot = snapshot;
    return snapshot;
}

export function buildZiweiBoardRenderModel(
    staticChart: ZiweiStaticChartResult,
    dynamic: ZiweiDynamicHoroscopeResult,
    activeScope: ZiweiActiveScope,
    selectedPalaceName: string,
    selectedDirectScopeArg?: ZiweiDirectHoroscopeScopeView | null,
): ZiweiBoardRenderModel {
    return buildZiweiBoardRenderModelFromScopeModel({
        staticChart,
        dynamic,
        scopeModel: buildZiweiBoardScopeModel(
            staticChart,
            dynamic,
            activeScope,
            selectedDirectScopeArg,
        ),
        selectedPalaceName,
    });
}

function buildOrbitCursorDate(baseDate: Date, patch: {
    year?: number;
    month?: number;
    day?: number;
    hour?: number;
}): Date {
    const year = typeof patch.year === 'number' ? patch.year : baseDate.getFullYear();
    const month = typeof patch.month === 'number' ? patch.month : baseDate.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();
    const day = Math.max(1, Math.min(typeof patch.day === 'number' ? patch.day : baseDate.getDate(), lastDay));
    const hour = typeof patch.hour === 'number' ? patch.hour : baseDate.getHours();
    const minute = typeof patch.hour === 'number' ? 0 : baseDate.getMinutes();

    return new Date(year, month, day, hour, minute, 0, 0);
}

function buildYearlyAnchorDate(year: number, horoscopeDivide: ZiweiYearDivide): Date {
    if (year < 1900 || year > 2100) {
        // The app only guarantees 1900-2100 lunar conversions; keep far-future track items stable
        // without crashing the drawer.
        return new Date(year, 0, 1, 12, 0, 0, 0);
    }

    if (horoscopeDivide === 'exact') {
        const lichun = getSolarTermDate(year, 2);
        return new Date(year, lichun.getMonth(), lichun.getDate(), 12, 0, 0, 0);
    }

    for (let month = 0; month < 3; month += 1) {
        for (let day = 1; day <= 31; day += 1) {
            const candidate = new Date(year, month, day, 12, 0, 0, 0);
            if (candidate.getMonth() !== month) {
                break;
            }
            const lunar = solarToLunar(candidate);
            if (lunar.month === 1 && lunar.day === 1 && !lunar.isLeap) {
                return candidate;
            }
        }
    }

    throw new Error(`无法定位 ${year} 年的流年锚点日期`);
}

function buildNominalAgeCursorDate(
    birthYear: number,
    nominalAge: number,
    horoscopeDivide: ZiweiConfigOptions['horoscopeDivide'],
): Date {
    return buildYearlyAnchorDate(birthYear + nominalAge - 1, horoscopeDivide);
}

function buildYearlyOrbitItems(
    birthYear: number,
    activeCursorDate: Date,
    dynamic: ZiweiDynamicHoroscopeResult,
    horoscopeDivide: ZiweiConfigOptions['horoscopeDivide'],
) {
    const [startAge, endAge] = dynamic.horoscopeNow.astrolabe.palaces[dynamic.horoscopeNow.decadal.index].decadal.range;

    return Array.from({ length: endAge - startAge + 1 }, (_, index) => {
        const nominalAge = startAge + index;
        const year = birthYear + nominalAge - 1;
        const cursorDate = buildNominalAgeCursorDate(birthYear, nominalAge, horoscopeDivide);

        return {
            key: `year-${year}`,
            label: `${year}`,
            secondary: `${nominalAge}岁`,
            cursorDate,
            active: activeCursorDate.getFullYear() === year,
        };
    });
}

function buildHourlyOrbitItems(cursorDate: Date) {
    const items = [
        { label: '早子', hour: 0 },
        { label: '丑', hour: 1 },
        { label: '寅', hour: 3 },
        { label: '卯', hour: 5 },
        { label: '辰', hour: 7 },
        { label: '巳', hour: 9 },
        { label: '午', hour: 11 },
        { label: '未', hour: 13 },
        { label: '申', hour: 15 },
        { label: '酉', hour: 17 },
        { label: '戌', hour: 19 },
        { label: '亥', hour: 21 },
        { label: '晚子', hour: 23 },
    ];

    return items.map((item, index) => ({
        key: `hour-${index}`,
        label: item.label,
        secondary: `${item.hour.toString().padStart(2, '0')}:00`,
        cursorDate: buildOrbitCursorDate(cursorDate, { hour: item.hour }),
        active: cursorDate.getHours() === item.hour,
    }));
}

export function buildZiweiOrbitDrawerState(
    staticChart: ZiweiStaticChartResult,
    dynamic: ZiweiDynamicHoroscopeResult,
    activeScope: ZiweiActiveScope,
): ZiweiOrbitDrawerState {
    const cursorDate = dynamic.cursorDate;
    const birthYear = staticChart.input.birthLocalDate.getFullYear();
    const currentYear = cursorDate.getFullYear();
    const currentMonth = cursorDate.getMonth();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const horoscopeDivide = staticChart.input.config.horoscopeDivide;
    const decadalItems = staticChart.astrolabe.palaces
        .map((palace) => ({
            key: `decadal-${palace.decadal.range[0]}`,
            label: `${palace.decadal.range[0]}-${palace.decadal.range[1]}岁`,
            secondary: palace.name,
            cursorDate: buildNominalAgeCursorDate(birthYear, palace.decadal.range[0], horoscopeDivide),
            active: dynamic.horoscopeNow.decadal.index === palace.index,
        }))
        .sort((a, b) => a.cursorDate.getFullYear() - b.cursorDate.getFullYear());
    const yearlyItems = buildYearlyOrbitItems(birthYear, cursorDate, dynamic, horoscopeDivide);
    const monthlyItems = Array.from({ length: 12 }, (_, index) => ({
        key: `month-${index + 1}`,
        label: `${index + 1}月`,
        secondary: `${currentYear}`,
        cursorDate: buildOrbitCursorDate(cursorDate, { month: index }),
        active: currentMonth === index,
    }));
    const dailyItems = Array.from({ length: daysInMonth }, (_, index) => ({
        key: `day-${index + 1}`,
        label: `${index + 1}日`,
        secondary: `${currentMonth + 1}月`,
        cursorDate: buildOrbitCursorDate(cursorDate, { day: index + 1 }),
        active: cursorDate.getDate() === index + 1,
    }));
    const rowsByScope: Record<ZiweiActiveScope, ZiweiOrbitDrawerRow[]> = {
        decadal: [{ key: 'decadal', label: SCOPE_LABELS.decadal, items: decadalItems }],
        age: [{ key: 'yearly', label: SCOPE_LABELS.yearly, items: yearlyItems }],
        yearly: [{ key: 'yearly', label: SCOPE_LABELS.yearly, items: yearlyItems }],
        monthly: [
            { key: 'yearly', label: SCOPE_LABELS.yearly, items: yearlyItems },
            { key: 'monthly', label: SCOPE_LABELS.monthly, items: monthlyItems },
        ],
        daily: [
            { key: 'yearly', label: SCOPE_LABELS.yearly, items: yearlyItems },
            { key: 'monthly', label: SCOPE_LABELS.monthly, items: monthlyItems },
            { key: 'daily', label: SCOPE_LABELS.daily, items: dailyItems },
        ],
        hourly: [
            { key: 'yearly', label: SCOPE_LABELS.yearly, items: yearlyItems },
            { key: 'monthly', label: SCOPE_LABELS.monthly, items: monthlyItems },
            { key: 'daily', label: SCOPE_LABELS.daily, items: dailyItems },
            { key: 'hourly', label: SCOPE_LABELS.hourly, items: buildHourlyOrbitItems(cursorDate) },
        ],
    };

    return {
        activeScope,
        activeScopeLabel: SCOPE_LABELS[activeScope],
        summaryItems: [
            {
                key: 'decadal',
                label: '大限',
                value: staticChart.astrolabe.palaces[dynamic.horoscopeNow.decadal.index]
                    ? `${staticChart.astrolabe.palaces[dynamic.horoscopeNow.decadal.index].name} ${staticChart.astrolabe.palaces[dynamic.horoscopeNow.decadal.index].decadal.range[0]}-${staticChart.astrolabe.palaces[dynamic.horoscopeNow.decadal.index].decadal.range[1]}岁`
                    : dynamic.horoscopeSummary.decadal,
            },
            {
                key: 'yearly',
                label: '流年',
                value: `${cursorDate.getFullYear()}年`,
            },
        ],
        rows: rowsByScope[activeScope],
    };
}

function summarizeMutagenFlags(surrounded: ZiweiSurroundedPalacesView): string {
    const activeFlags = [
        surrounded.hasLu ? '禄' : '',
        surrounded.hasQuan ? '权' : '',
        surrounded.hasKe ? '科' : '',
        surrounded.hasJi ? '忌' : '',
    ].filter(Boolean);

    return activeFlags.length > 0 ? activeFlags.join(' / ') : '无四化';
}

function summarizeSelectedPalace(palace: ZiweiPalaceAnalysisView): string {
    const headStars = palace.majorStars.slice(0, 2).map((star) => star.name).join('、');
    return headStars ? `主星 ${headStars}` : '主星未起';
}

function summarizeFlightDestinations(palace: ZiweiPalaceAnalysisView): string {
    return palace.flight.destinations
        .map((item) => `${item.mutagen}→${item.palaceName || '无'}`)
        .join(' · ');
}

function summarizeSelfMutagens(palace: ZiweiPalaceAnalysisView): string {
    if (palace.flight.selfMutagens.length === 0) {
        return '无自化';
    }

    return `自化 ${palace.flight.selfMutagens.join(' / ')}`;
}

function summarizeHoroscopeMutagenStars(mutagenStars: {
    lu: string;
    quan: string;
    ke: string;
    ji: string;
}): string {
    const parts = [
        mutagenStars.lu ? `禄:${mutagenStars.lu}` : '',
        mutagenStars.quan ? `权:${mutagenStars.quan}` : '',
        mutagenStars.ke ? `科:${mutagenStars.ke}` : '',
        mutagenStars.ji ? `忌:${mutagenStars.ji}` : '',
    ].filter(Boolean);

    return parts.join(' · ') || '无四化';
}

interface BuildZiweiCenterPanelOptions {
    cursorDateLabel?: string;
    selectedScopePalace?: ZiweiHoroscopePalaceView | null;
    ageSummary?: string;
}

export function buildZiweiCenterPanelContent(
    selectedPalace: ZiweiPalaceAnalysisView,
    selectedStar: ZiweiStarInsightView | null,
    selectedLayer: ZiweiLayerKey,
    options: BuildZiweiCenterPanelOptions = {},
): ZiweiCenterPanelContent {
    const sections: ZiweiCenterPanelSection[] = [
        {
            key: 'surrounded',
            title: '三方四正',
            lines: [
                `${selectedPalace.surrounded.target} / ${selectedPalace.surrounded.opposite} / ${selectedPalace.surrounded.wealth} / ${selectedPalace.surrounded.career}`,
                `四化 ${summarizeMutagenFlags(selectedPalace.surrounded)} · ${(selectedPalace.surrounded.checks.filter((item) => item.matched).map((item) => item.label).join(' / ') || summarizeSelectedPalace(selectedPalace))}`,
            ],
        },
        {
            key: 'mutagen',
            title: '飞化与杂项',
            lines: [
                summarizeFlightDestinations(selectedPalace),
                `${summarizeSelfMutagens(selectedPalace)} · 长生 ${selectedPalace.changsheng12} · 博士 ${selectedPalace.boshi12}`,
            ],
        },
    ];

    if (selectedStar) {
        sections.push({
            key: 'star',
            title: '选中星曜',
            lines: [
                `${selectedStar.name} · ${selectedStar.palaceName} / ${selectedStar.oppositePalaceName}`,
                `${selectedStar.brightnessMatches.join(' / ') || selectedStar.brightness || '无亮度'} · ${(selectedStar.mutagenFlags.map((item) => `化${item}`).join(' / ') || '无四化')}`,
            ],
        });
    }

    if (selectedLayer === 'age' && options.ageSummary) {
        sections.push({
            key: 'scope',
            title: '当前层级',
            lines: [
                `${CENTER_LAYER_LABELS[selectedLayer]}视角`,
                options.cursorDateLabel ? `${options.ageSummary} · ${options.cursorDateLabel}` : options.ageSummary,
            ],
        });
    } else if (selectedLayer !== 'origin' && options.selectedScopePalace) {
        sections.push({
            key: 'scope',
            title: '当前层级',
            lines: [
                `${CENTER_LAYER_LABELS[selectedLayer]} · ${options.selectedScopePalace.requestedPalaceName} -> ${options.selectedScopePalace.resolvedPalaceName}`,
                `${summarizeHoroscopeMutagenStars(options.selectedScopePalace.mutagenStars)}${options.selectedScopePalace.directHoroscopeStars.length > 0 ? ` · 流耀 ${options.selectedScopePalace.directHoroscopeStars.join(' / ')}` : ''}${options.cursorDateLabel ? ` · ${options.cursorDateLabel}` : ''}`,
            ],
        });
    } else {
        sections.push({
            key: 'scope',
            title: '当前层级',
            lines: [
                `${CENTER_LAYER_LABELS[selectedLayer]}视角`,
                options.cursorDateLabel || '盘面高亮同步更新',
            ],
        });
    }

    return {
        title: `${selectedPalace.name} · ${selectedPalace.heavenlyStem}${selectedPalace.earthlyBranch}`,
        subtitle: `${CENTER_LAYER_LABELS[selectedLayer]}视角`,
        summary: [
            selectedPalace.decadalRange,
            selectedPalace.isBodyPalace ? '身宫' : '',
            selectedPalace.isOriginalPalace ? '原宫' : '',
        ].filter(Boolean).join(' · '),
        chips: [...selectedPalace.majorStars, ...selectedPalace.minorStars].slice(0, 4).map((star) => ({
            key: star.name,
            label: formatStarLabel(star),
            active: selectedStar?.name === star.name,
        })),
        sections,
    };
}

export function buildZiweiHoroscopeSummary(
    astrolabe: IFunctionalAstrolabe,
    horoscope: IFunctionalHoroscope,
): ZiweiHoroscopeSummary {
    const agePalace = horoscope.agePalace();
    const agePalaceName = agePalace?.name || astrolabe.palaces[horoscope.age.index]?.name || '未知宫位';

    return {
        solarDate: horoscope.solarDate,
        lunarDate: horoscope.lunarDate,
        decadal: `${formatHoroscopeItem(astrolabe, horoscope.decadal)} · ${astrolabe.palaces[horoscope.decadal.index]?.decadal.range.join('-')}岁`,
        age: `小限 · ${agePalaceName} · 虚岁 ${horoscope.age.nominalAge}`,
        yearly: formatHoroscopeItem(astrolabe, horoscope.yearly),
        monthly: formatHoroscopeItem(astrolabe, horoscope.monthly),
        daily: formatHoroscopeItem(astrolabe, horoscope.daily),
        hourly: formatHoroscopeItem(astrolabe, horoscope.hourly),
    };
}
