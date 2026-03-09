import { WuXing } from '../../core/liuyao-data';
import { FortuneSelectionView } from './types';
import {
    BaziDiagramFlowLink,
    BaziDiagramRelation,
} from '../../core/bazi-diagram';

export type BaziDiagramTabKey = 'ganzhi' | 'flow' | 'palace' | 'kinship';

export interface BaziDiagramColumnView {
    key: string;
    label: string;
    note?: string;
    stem: string;
    branch: string;
    ganZhi: string;
    stemElement: WuXing;
    branchElement: WuXing;
    stemTenGod: string;
    branchTenGod: string;
}

export interface BaziDiagramRelationView extends BaziDiagramRelation {}

export interface BaziDiagramFlowLinkView extends BaziDiagramFlowLink {}

export interface BaziFlowPillarStatusView {
    key: string;
    label: '盖头' | '截脚';
}

export interface BaziPalaceColumnView {
    key: 'year' | 'month' | 'day' | 'hour';
    titleLines: string[];
    pillarLabel: string;
    stem: string;
    branch: string;
    stemElement: WuXing;
    branchElement: WuXing;
}

export interface BaziPalaceCategoryView {
    key: string;
    title: string;
    values: [string, string, string, string];
}

export interface BaziKinshipCellView {
    key: string;
    pillarLabel: string;
    topTenGod: string;
    topRelations: string[];
    stem: string;
    branch: string;
    bottomTenGod: string;
    bottomRelations: string[];
    stemElement: WuXing;
    branchElement: WuXing;
}

export interface BaziKinshipSectionView {
    title: string;
    columns: BaziKinshipCellView[];
}

export interface BaziDiagramViewModel {
    activeSelection: FortuneSelectionView;
    ganzhiColumns: BaziDiagramColumnView[];
    ganzhiRelations: BaziDiagramRelationView[];
    flowColumns: BaziDiagramColumnView[];
    flowLinks: BaziDiagramFlowLinkView[];
    flowStatuses: BaziFlowPillarStatusView[];
    palaceColumns: BaziPalaceColumnView[];
    palaceCategories: BaziPalaceCategoryView[];
    kinshipSections: [BaziKinshipSectionView, BaziKinshipSectionView];
    legend: {
        positive: string;
        negative: string;
    };
}

export interface BaziDiagramTenGodDictionary {
    kinship: Record<string, string[]>;
    social: Record<string, string[]>;
}

export interface BaziDiagramGenderDictionary {
    top: BaziDiagramTenGodDictionary;
    bottom: BaziDiagramTenGodDictionary;
}
