process.env.TZ = 'Asia/Shanghai';

jest.mock('../../polyfills/intl', () => ({}));

import {
    buildZiweiBoardDecorations,
    buildZiweiBoardMetrics,
    buildZiweiBoardRenderModel,
    buildZiweiChartSnapshot,
    buildZiweiCenterOverviewState,
    buildZiweiCenterPanelContent,
    buildZiweiDirectHoroscopeScopeViewByScope,
    hydrateZiweiBoardSnapshotModel,
    buildZiweiPalaceFooterText,
    buildZiweiZoomMotion,
} from './view-model';
import {
    computeZiweiDynamicHoroscope,
    computeZiweiStaticChart,
    ZIWEI_DEFAULT_CONFIG,
    ZIWEI_STANDARD_TIMEZONE_OFFSET_MINUTES,
} from './iztro-adapter';
import type {
    ZiweiHoroscopeMutagenStars,
    ZiweiPalaceAnalysisView,
    ZiweiStarInsightView,
    ZiweiStarViewModel,
} from './types';

function makePayload(overrides: Partial<Parameters<typeof computeZiweiStaticChart>[0]> = {}) {
    return {
        birthLocal: '2018-02-25T15:00',
        longitude: 116.68,
        gender: 'male' as const,
        tzOffsetMinutes: ZIWEI_STANDARD_TIMEZONE_OFFSET_MINUTES,
        daylightSavingEnabled: false,
        calendarType: 'solar' as const,
        config: ZIWEI_DEFAULT_CONFIG,
        ...overrides,
    };
}

function makeStar(name: string, mutagen = ''): ZiweiStarViewModel {
    return {
        name,
        type: 'major',
        scope: 'origin',
        brightness: '庙',
        mutagen,
    };
}

function makePalace(): ZiweiPalaceAnalysisView {
    return {
        palaceIndex: 0,
        name: '命宫',
        heavenlyStem: '甲',
        earthlyBranch: '子',
        isBodyPalace: true,
        isOriginalPalace: true,
        isEmpty: false,
        hasBirthMutagen: true,
        hasSelfMutagen: true,
        mutagedPlaces: ['财帛', '官禄'],
        flight: {
            destinations: [
                { mutagen: '禄', palaceName: '财帛', isSelf: false },
                { mutagen: '权', palaceName: '官禄', isSelf: false },
                { mutagen: '科', palaceName: '迁移', isSelf: false },
                { mutagen: '忌', palaceName: '命宫', isSelf: true },
            ],
            targets: [
                { palaceName: '财帛', mutagens: ['禄'] },
                { palaceName: '官禄', mutagens: ['权'] },
            ],
            selfMutagens: ['忌'],
            missingSelfMutagens: ['禄', '权', '科'],
            birthMutagens: ['禄', '科'],
            missingBirthMutagens: ['权', '忌'],
            quietPalaceNames: ['父母', '福德'],
        },
        majorStars: [makeStar('紫微', '禄'), makeStar('天府')],
        minorStars: [makeStar('左辅'), makeStar('右弼')],
        adjectiveStars: [makeStar('天喜')],
        changsheng12: '长生',
        boshi12: '博士',
        jiangqian12: '将军',
        suiqian12: '岁建',
        decadalRange: '12-21岁',
        ages: '12 · 13 · 14',
        activeScopes: ['decadal', 'yearly'],
        surrounded: {
            target: '命宫',
            opposite: '迁移',
            wealth: '财帛',
            career: '官禄',
            palaceNames: ['命宫', '迁移', '财帛', '官禄'],
            starsSummary: '命宫见紫微，财官相照',
            majorStars: ['紫微', '天府'],
            minorStars: ['左辅', '右弼'],
            adjectiveStars: ['天喜'],
            mutagens: ['禄', '科'],
            checks: [
                { key: 'fubi', label: '辅弼同会', matched: true, detail: '辅弼同会成立', tone: 'accent' },
            ],
            hasLu: true,
            hasQuan: false,
            hasKe: true,
            hasJi: false,
        },
    };
}

function makeInsight(): ZiweiStarInsightView {
    return {
        name: '紫微',
        brightness: '庙',
        mutagen: '禄',
        brightnessMatches: ['庙'],
        mutagenFlags: ['禄'],
        scope: 'origin',
        palaceName: '命宫',
        oppositePalaceName: '迁移',
        surrounded: null,
    };
}

function makeMutagenStars(overrides: Partial<ZiweiHoroscopeMutagenStars> = {}): ZiweiHoroscopeMutagenStars {
    return {
        lu: '',
        quan: '',
        ke: '',
        ji: '',
        ...overrides,
    };
}

describe('buildZiweiBoardMetrics', () => {
    it.each([360, 393, 430])('builds a portrait board on width %s', (screenWidth) => {
        const metrics = buildZiweiBoardMetrics(screenWidth);

        expect(metrics.boardHeight).toBeGreaterThan(metrics.boardWidth);
        expect(metrics.boardWidth).toBeCloseTo(metrics.boardInset * 2 + metrics.cellWidth * 4 + metrics.gap * 3, 6);
        expect(metrics.boardHeight).toBeCloseTo(metrics.boardInset * 2 + metrics.cellHeight * 4 + metrics.gap * 3, 6);
        expect(metrics.centerWidth).toBeCloseTo(metrics.cellWidth * 2 + metrics.gap, 6);
        expect(metrics.centerHeight).toBeCloseTo(metrics.cellHeight * 2 + metrics.gap, 6);
        expect(metrics.centerTopHeight + metrics.centerBottomHeight).toBeCloseTo(metrics.centerHeight, 6);
        expect(metrics.boardInset).toBeGreaterThan(0);
        expect(metrics.chromeInset).toBeGreaterThan(0);
        expect(metrics.sectionGap).toBeGreaterThan(0);
        expect(metrics.controlCardPadding).toBeGreaterThan(0);
        expect(metrics.controlRowHeight).toBeGreaterThan(0);
    });
});

describe('buildZiweiCenterPanelContent', () => {
    it('builds compact center sections with the active star chip', () => {
        const content = buildZiweiCenterPanelContent(makePalace(), makeInsight(), 'yearly', {
            cursorDateLabel: '游标 2026-03-12 10:00',
            selectedScopePalace: {
                scope: 'yearly',
                requestedPalaceName: '命宫',
                resolvedPalaceName: '迁移',
                heavenlyStem: '丙',
                earthlyBranch: '寅',
                mutagen: ['禄'],
                mutagenStars: {
                    lu: '天同',
                    quan: '',
                    ke: '',
                    ji: '',
                },
                stars: ['紫微'],
                directHoroscopeStars: ['流曲'],
                directHoroscopeAllPresent: true,
                directHoroscopeAnyPresent: true,
                directHoroscopeAllAbsent: false,
                surrounded: null,
                hasLu: true,
                hasQuan: false,
                hasKe: false,
                hasJi: false,
            },
        });

        expect(content.title).toBe('命宫 · 甲子');
        expect(content.summary).toContain('12-21岁');
        expect(content.chips.find((chip) => chip.key === '紫微')?.active).toBe(true);
        expect(content.sections.find((section) => section.key === 'surrounded')?.lines[0]).toContain('命宫 / 迁移 / 财帛 / 官禄');
        expect(content.sections.find((section) => section.key === 'scope')?.lines[0]).toContain('流年');
    });

    it('uses the age summary when the selected layer is age', () => {
        const content = buildZiweiCenterPanelContent(makePalace(), null, 'age', {
            cursorDateLabel: '游标 2026-03-12 10:00',
            ageSummary: '小限 · 命宫 · 虚岁 18',
        });

        expect(content.sections.find((section) => section.key === 'scope')?.lines[1]).toContain('小限');
    });
});

describe('buildZiweiPalaceFooterText', () => {
    it('builds a stable footer string with scope overlay priority', () => {
        const footerText = buildZiweiPalaceFooterText(makePalace(), '流年兄弟');

        expect(footerText).toBe('流年兄弟 · 岁建 · 将军');
    });

    it('falls back to changsheng when there is no active scope overlay', () => {
        const footerText = buildZiweiPalaceFooterText(makePalace(), '');

        expect(footerText).toBe('长生 · 岁建 · 将军');
    });
});

describe('buildZiweiCenterOverviewState', () => {
    it('builds selected-scope state with mutagen badges', () => {
        const state = buildZiweiCenterOverviewState({
            soul: '廉贞',
            body: '天机',
            activeScope: 'yearly',
            selectedPalace: makePalace(),
            currentScopeSummary: '流年 · 兄弟 · 丙午',
            mutagenStars: makeMutagenStars({ lu: '天同', ke: '文昌' }),
            selectedScopePalace: {
                scope: 'yearly',
                requestedPalaceName: '命宫',
                resolvedPalaceName: '兄弟',
                heavenlyStem: '丙',
                earthlyBranch: '午',
                mutagen: ['禄', '科'],
                mutagenStars: makeMutagenStars({ lu: '天同', ke: '文昌' }),
                stars: [],
                directHoroscopeStars: [],
                directHoroscopeAllPresent: false,
                directHoroscopeAnyPresent: false,
                directHoroscopeAllAbsent: false,
                surrounded: null,
                hasLu: true,
                hasQuan: false,
                hasKe: true,
                hasJi: false,
            },
        });

        expect(state.focusTitle).toBe('命宫 · 甲子');
        expect(state.scopeState).toBe('流年 · 兄弟 · 丙午');
        expect(state.mutagenBadges.find((item) => item.key === 'lu')?.value).toBe('天同');
        expect(state.mutagenBadges.find((item) => item.key === 'ke')?.active).toBe(true);
    });

    it('falls back to age summary when there is no selected scope palace', () => {
        const state = buildZiweiCenterOverviewState({
            soul: '廉贞',
            body: '天机',
            activeScope: 'age',
            selectedPalace: makePalace(),
            currentScopeSummary: '小限 · 命宫 · 虚岁 18',
            mutagenStars: makeMutagenStars(),
            ageSummary: '小限 · 命宫 · 虚岁 18',
        });

        expect(state.scopeState).toBe('小限 · 命宫 · 虚岁 18');
        expect(state.summaryItems[2]).toBe('当前 小限');
        expect(state.mutagenBadges.every((item) => item.value === '--')).toBe(true);
    });
});

describe('buildZiweiZoomMotion', () => {
    it('clamps far edge-palace travel to a smaller in-viewport motion', () => {
        const motion = buildZiweiZoomMotion(
            { x: 8, y: 12, width: 88, height: 88 },
            { x: 40, y: 120, width: 320, height: 440 },
            430,
            932,
        );

        expect(motion.translateX).toBe(-32);
        expect(motion.translateY).toBe(-108);
        expect(motion.initialScale).toBeCloseTo(0.56, 6);
    });

    it('caps oversized travel for the opposite corner', () => {
        const motion = buildZiweiZoomMotion(
            { x: 320, y: 700, width: 88, height: 88 },
            { x: 40, y: 120, width: 320, height: 440 },
            430,
            932,
        );

        expect(motion.translateX).toBe(96);
        expect(motion.translateY).toBe(120);
        expect(motion.initialScale).toBeCloseTo(0.56, 6);
    });
});

describe('buildZiweiBoardRenderModel', () => {
    it('builds a lightweight palace render model with selection and base scope tags', () => {
        const staticChart = computeZiweiStaticChart(makePayload());
        const dynamic = computeZiweiDynamicHoroscope(staticChart, new Date(2024, 3, 15, 12, 0));
        const board = buildZiweiBoardRenderModel(staticChart, dynamic, 'yearly', '命宫');
        const minggong = board.byPalaceName.命宫 as any;

        expect(minggong.selected).toBe(true);
        expect(minggong.scopeTags.some((tag: { key: string }) => tag.key === 'yearly')).toBe(true);
        expect(Object.values(board.byPalaceName).some((item) => item.scopeTags.some((tag) => tag.key === 'origin'))).toBe(true);
        expect('overlays' in minggong).toBe(false);
        expect('yearAssignments' in minggong).toBe(false);
        expect(board.centerPanel.focusTitle).toContain('命宫');
    });

    it('keeps the age tag only on the active age palace', () => {
        const staticChart = computeZiweiStaticChart(makePayload());
        const dynamic = computeZiweiDynamicHoroscope(staticChart, new Date(2024, 3, 15, 12, 0));
        const ageBoard = buildZiweiBoardRenderModel(staticChart, dynamic, 'age', '命宫');
        const ageTags = Object.values(ageBoard.byPalaceName).filter((item) => item.scopeTags.some((tag) => tag.key === 'age'));

        expect(ageTags).toHaveLength(1);
        expect(ageTags[0].scopeTags.find((tag) => tag.key === 'age')?.label.startsWith('小')).toBe(true);
    });
});

describe('ziwei chart snapshot helpers', () => {
    it('builds a serializable chart snapshot with a default minggong base board', () => {
        const staticChart = computeZiweiStaticChart(makePayload());
        const snapshot = buildZiweiChartSnapshot(staticChart);

        expect(snapshot.version).toBe(1);
        expect(snapshot.palaces).toHaveLength(12);
        expect(snapshot.baseBoard.selectedPalaceName).toBe('命宫');
        expect(snapshot.baseBoard.byPalaceName.命宫.selected).toBe(true);
        expect(snapshot.staticMeta.trueSolarDateTimeLocal).toContain('T');
    });

    it('hydrates a new snapshot board model when the selected palace changes', () => {
        const staticChart = computeZiweiStaticChart(makePayload());
        const snapshot = buildZiweiChartSnapshot(staticChart);
        const migrated = hydrateZiweiBoardSnapshotModel(snapshot, '迁移');

        expect(migrated.selectedPalaceName).toBe('迁移');
        expect(migrated.byPalaceName.迁移.selected).toBe(true);
        expect(migrated.centerPanel.focusTitle).toContain('迁移');
    });
});

describe('buildZiweiBoardDecorations', () => {
    it('restores age overlays and cumulative scope overlays', () => {
        const staticChart = computeZiweiStaticChart(makePayload());
        const dynamic = computeZiweiDynamicHoroscope(staticChart, new Date(2036, 5, 20, 12, 0));
        const ageDecorations = buildZiweiBoardDecorations(staticChart, dynamic, 'age', computeZiweiDynamicHoroscope);
        const hourlyDecorations = buildZiweiBoardDecorations(staticChart, dynamic, 'hourly', computeZiweiDynamicHoroscope);
        const ageLabels = Object.values(ageDecorations.byPalaceName).map((item) => item.overlays.find((overlay) => overlay.key === 'age')?.label);

        expect(ageLabels.filter(Boolean)).toHaveLength(12);
        expect(ageLabels.every((label) => label?.startsWith('小'))).toBe(true);
        expect(hourlyDecorations.byPalaceName.命宫.overlays.map((overlay) => overlay.key)).toEqual(['age', 'yearly', 'decadal', 'monthly', 'daily', 'hourly']);
        expect(hourlyDecorations.byPalaceName.命宫.activeOverlay?.key).toBe('hourly');
        expect(hourlyDecorations.byPalaceName.命宫.historyOverlayLabels.map((label) => label.slice(0, 1))).toEqual(['小', '年', '限', '月', '日']);
    });

    it('restores year assignments for the current decadal span', () => {
        const staticChart = computeZiweiStaticChart(makePayload());
        const dynamic = computeZiweiDynamicHoroscope(staticChart, new Date(2036, 5, 20, 12, 0));
        const decorations = buildZiweiBoardDecorations(staticChart, dynamic, 'yearly', computeZiweiDynamicHoroscope);
        const assignments = Object.values(decorations.byPalaceName).flatMap((item) => item.yearAssignments);
        const fudeAssignments = decorations.byPalaceName.福德.yearAssignments.map((item) => item.label);

        expect(assignments).toHaveLength(10);
        expect(assignments.some((item) => item.label === '2036年19岁')).toBe(true);
        expect(assignments.some((item) => item.active)).toBe(true);
        expect(fudeAssignments).toContain(decorations.byPalaceName.福德.displayYearAssignment?.label || '');
    });

    it('reuses the same decoration bundle for identical dynamic scope inputs', () => {
        const staticChart = computeZiweiStaticChart(makePayload());
        const dynamic = computeZiweiDynamicHoroscope(staticChart, new Date(2036, 5, 20, 12, 0));
        const first = buildZiweiBoardDecorations(staticChart, dynamic, 'daily', computeZiweiDynamicHoroscope);
        const second = buildZiweiBoardDecorations(staticChart, dynamic, 'daily', computeZiweiDynamicHoroscope);

        expect(second).toBe(first);
    });
});

describe('buildZiweiDirectHoroscopeScopeViewByScope', () => {
    it('builds only the requested dynamic scope view', () => {
        const staticChart = computeZiweiStaticChart(makePayload());
        const dynamic = computeZiweiDynamicHoroscope(staticChart, new Date(2036, 5, 20, 12, 0));
        const scopeView = buildZiweiDirectHoroscopeScopeViewByScope(
            staticChart.astrolabe,
            dynamic.horoscopeNow,
            'daily',
            staticChart.input.config.algorithm,
        );

        expect(scopeView.scope).toBe('daily');
        expect(scopeView.palaceStars).toHaveLength(12);
        expect(Object.keys(scopeView.byPalaceName)).toHaveLength(12);
    });
});
