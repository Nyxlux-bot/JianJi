import { BaziResult } from './bazi-types';
import {
    BaziGanZhiDiagramRelation,
    buildBaziGanZhiDiagram,
} from './bazi-ganzhi-diagram';
import {
    DEFAULT_GAN_ZHI_RELATION_SETTINGS,
    GanZhiRelationSettings,
} from './bazi-ganzhi-relation-engine';

export interface BaziGanZhiLayerSelection {
    mode?: 'dayun' | 'xiaoyun';
    selectedDaYunIndex: number;
    selectedXiaoYunIndex?: number;
    selectedLiuNianIndex: number;
}

export interface BaziGanZhiLayerSummary {
    suiYunTianGan: string;
    suiYunDiZhi: string;
    suiYunZhengZhu: string;
    yuanJuTianGan: string;
    yuanJuDiZhi: string;
    yuanJuZhengZhu: string;
}

function clampIndex(value: number, max: number): number {
    if (max < 0) return 0;
    return Math.min(Math.max(value, 0), max);
}

function resolveSelectedSuiYun(
    result: BaziResult,
    selection?: Partial<BaziGanZhiLayerSelection>,
): { yunWeiGanZhi: string; liuNianGanZhi: string; yunWeiLabel: '大运' | '小运' } {
    if (selection?.mode === 'xiaoyun') {
        const selectedXiaoYunIndex = clampIndex(
            selection.selectedXiaoYunIndex ?? selection.selectedLiuNianIndex ?? 0,
            result.xiaoYun.length - 1,
        );
        const selected = result.xiaoYun[selectedXiaoYunIndex];
        return {
            yunWeiGanZhi: selected?.xiaoYunGanZhi ?? '—',
            liuNianGanZhi: selected?.ganZhi ?? '—',
            yunWeiLabel: '小运',
        };
    }

    if (result.daYun.length === 0) {
        const fallbackIndex = clampIndex(selection?.selectedLiuNianIndex ?? 0, result.liuNian.length - 1);
        return {
            yunWeiGanZhi: '—',
            liuNianGanZhi: result.liuNian[fallbackIndex]?.ganZhi ?? '—',
            yunWeiLabel: '大运',
        };
    }

    const currentDaYunIndex = result.currentDaYunIndex >= 0 ? result.currentDaYunIndex : 0;
    const selectedDaYunIndex = clampIndex(
        selection?.selectedDaYunIndex ?? currentDaYunIndex,
        result.daYun.length - 1,
    );
    const selectedDaYun = result.daYun[selectedDaYunIndex];
    const liuNian = selectedDaYun?.liuNian ?? [];
    const defaultLiuNianIndex = Math.max(liuNian.findIndex((item) => item.isCurrent), 0);
    const selectedLiuNianIndex = clampIndex(
        selection?.selectedLiuNianIndex ?? defaultLiuNianIndex,
        liuNian.length - 1,
    );
    return {
        yunWeiGanZhi: selectedDaYun?.ganZhi ?? '—',
        liuNianGanZhi: liuNian[selectedLiuNianIndex]?.ganZhi ?? '—',
        yunWeiLabel: '大运',
    };
}

function summarize(
    relations: BaziGanZhiDiagramRelation[],
    target: 'suiyun' | 'yuanju',
): string {
    const seen = new Set<string>();
    const rows: string[] = [];
    relations.forEach((relation) => {
        const include = target === 'suiyun'
            ? relation.scope === 'suiyun' || relation.scope === 'cross'
            : relation.scope === 'yuanju';
        const key = `${relation.kind}:${relation.summaryText}`;
        if (include && !seen.has(key)) {
            seen.add(key);
            rows.push(relation.summaryText);
        }
    });
    return rows.length > 0 ? rows.join('、') : '无';
}

export function buildBaziGanZhiLayer(
    result: BaziResult,
    selection?: Partial<BaziGanZhiLayerSelection>,
    settings: GanZhiRelationSettings = DEFAULT_GAN_ZHI_RELATION_SETTINGS,
): BaziGanZhiLayerSummary {
    const selected = resolveSelectedSuiYun(result, selection);
    const diagram = buildBaziGanZhiDiagram({
        liuNianGanZhi: selected.liuNianGanZhi,
        yunWeiGanZhi: selected.yunWeiGanZhi,
        yunWeiLabel: selected.yunWeiLabel,
        fourPillars: result.fourPillars,
    }, settings);
    return {
        suiYunTianGan: summarize(diagram.stemRelations, 'suiyun'),
        suiYunDiZhi: summarize(diagram.branchRelations, 'suiyun'),
        suiYunZhengZhu: summarize(diagram.pillarRelations, 'suiyun'),
        yuanJuTianGan: summarize(diagram.stemRelations, 'yuanju'),
        yuanJuDiZhi: summarize(diagram.branchRelations, 'yuanju'),
        yuanJuZhengZhu: summarize(diagram.pillarRelations, 'yuanju'),
    };
}
