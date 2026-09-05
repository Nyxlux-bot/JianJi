import type {
    BaziTenGodGroup,
    BaziWuXingElement,
    BaziWuXingEnergySnapshot,
    BaziWuXingSeasonStatus,
} from './bazi-wuxing-energy';

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function normalizeIndex(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0
        ? Math.floor(value)
        : null;
}

export type BaziPanelMode = 'fortune' | 'taiming';
export type BaziFortuneSelectionMode = 'dayun' | 'xiaoyun';

export interface BaziFortuneSelection {
    mode: BaziFortuneSelectionMode;
    selectedDaYunIndex: number;
    selectedXiaoYunIndex: number;
    selectedLiuNianIndex: number;
    selectedLiuYueIndex: number;
}

export interface BaziFormatterContext {
    panelMode?: BaziPanelMode;
    fortuneSelection?: BaziFortuneSelection;
    wuXingEnergy?: BaziWuXingEnergySnapshot;
}

const WU_XING_ORDER: BaziWuXingElement[] = ['木', '火', '土', '金', '水'];
const SEASON_STATUSES: BaziWuXingSeasonStatus[] = ['旺', '相', '休', '囚', '死', '—'];
const TEN_GOD_GROUPS: BaziTenGodGroup[] = ['印绶', '比劫', '食伤', '财才', '官杀'];

function normalizePercentage(value: unknown): number | null {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100
        ? value
        : null;
}

function normalizeCount(value: unknown): number | null {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
}

function normalizeWuXingEnergy(value: unknown): BaziWuXingEnergySnapshot | undefined {
    if (!isObject(value)
        || value.version !== 'bazi_wuxing_energy_v1'
        || value.scope !== 'fortune_selection'
        || !isObject(value.focus)
        || (value.focus.mode !== 'dayun' && value.focus.mode !== 'xiaoyun')
        || typeof value.focus.yunGanZhi !== 'string'
        || typeof value.focus.liuNianGanZhi !== 'string'
        || typeof value.focus.liuYueGanZhi !== 'string'
        || !Array.isArray(value.elements)
        || value.elements.length !== WU_XING_ORDER.length
        || !Array.isArray(value.omittedSources)
    ) {
        return undefined;
    }

    const rawElements = value.elements;
    const elements = WU_XING_ORDER.map((element, index) => {
        const raw = rawElements[index];
        if (!isObject(raw)
            || raw.element !== element
            || !SEASON_STATUSES.includes(raw.seasonStatus as BaziWuXingSeasonStatus)
            || !TEN_GOD_GROUPS.includes(raw.tenGodGroup as BaziTenGodGroup)
        ) {
            return null;
        }
        const percentage = normalizePercentage(raw.percentage);
        const directCount = normalizeCount(raw.directCount);
        const withHiddenCount = normalizeCount(raw.withHiddenCount);
        if (percentage === null || directCount === null || withHiddenCount === null) {
            return null;
        }
        return {
            element,
            percentage,
            directCount,
            withHiddenCount,
            seasonStatus: raw.seasonStatus as BaziWuXingSeasonStatus,
            tenGodGroup: raw.tenGodGroup as BaziTenGodGroup,
        };
    });
    const normalizedElements = elements.filter((element): element is NonNullable<typeof element> => element !== null);
    if (normalizedElements.length !== WU_XING_ORDER.length) {
        return undefined;
    }

    const samePartyPercentage = normalizePercentage(value.samePartyPercentage);
    const differentPartyPercentage = normalizePercentage(value.differentPartyPercentage);
    const energyTotal = normalizedElements.reduce((sum, element) => sum + element.percentage, 0);
    if (samePartyPercentage === null
        || differentPartyPercentage === null
        || samePartyPercentage + differentPartyPercentage !== 100
        || energyTotal !== 100
        || !value.omittedSources.every((item) => typeof item === 'string')
    ) {
        return undefined;
    }
    const omittedSources = value.omittedSources.filter((item): item is string => typeof item === 'string');

    return {
        version: 'bazi_wuxing_energy_v1',
        scope: 'fortune_selection',
        focus: {
            mode: value.focus.mode,
            yunGanZhi: value.focus.yunGanZhi,
            liuNianGanZhi: value.focus.liuNianGanZhi,
            liuYueGanZhi: value.focus.liuYueGanZhi,
        },
        elements: normalizedElements,
        samePartyPercentage,
        differentPartyPercentage,
        omittedSources,
    };
}

export function normalizeBaziFormatterContext(context: unknown): BaziFormatterContext | undefined {
    if (!isObject(context)) {
        return undefined;
    }

    const panelMode = context.panelMode === 'fortune' || context.panelMode === 'taiming'
        ? context.panelMode
        : undefined;
    const rawSelection = isObject(context.fortuneSelection) ? context.fortuneSelection : null;
    const wuXingEnergy = normalizeWuXingEnergy(context.wuXingEnergy);

    const fortuneSelection = rawSelection
        && (rawSelection.mode === 'dayun' || rawSelection.mode === 'xiaoyun')
        ? (() => {
            const selectedDaYunIndex = normalizeIndex(rawSelection.selectedDaYunIndex);
            const selectedXiaoYunIndex = normalizeIndex(rawSelection.selectedXiaoYunIndex);
            const selectedLiuNianIndex = normalizeIndex(rawSelection.selectedLiuNianIndex);
            const selectedLiuYueIndex = normalizeIndex(rawSelection.selectedLiuYueIndex);

            if (
                selectedDaYunIndex === null
                || selectedXiaoYunIndex === null
                || selectedLiuNianIndex === null
                || selectedLiuYueIndex === null
            ) {
                return undefined;
            }

            return {
                mode: rawSelection.mode,
                selectedDaYunIndex,
                selectedXiaoYunIndex,
                selectedLiuNianIndex,
                selectedLiuYueIndex,
            } satisfies BaziFortuneSelection;
        })()
        : undefined;

    if (!panelMode && !fortuneSelection && !wuXingEnergy) {
        return undefined;
    }

    return {
        panelMode,
        fortuneSelection,
        wuXingEnergy,
    };
}

export function cloneBaziFormatterContext(context?: BaziFormatterContext): BaziFormatterContext | undefined {
    return normalizeBaziFormatterContext(context);
}

export function mergeBaziFormatterContext(
    base?: BaziFormatterContext,
    override?: BaziFormatterContext,
): BaziFormatterContext | undefined {
    const panelMode = override?.panelMode ?? base?.panelMode;
    const fortuneSelection = override?.fortuneSelection ?? base?.fortuneSelection;
    const wuXingEnergy = override?.wuXingEnergy ?? base?.wuXingEnergy;

    if (!panelMode && !fortuneSelection && !wuXingEnergy) {
        return undefined;
    }

    return {
        panelMode,
        fortuneSelection,
        wuXingEnergy,
    };
}
