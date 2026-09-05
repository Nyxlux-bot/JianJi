import {
    BaziGanZhiDiagram,
    BaziGanZhiDiagramRelation,
    buildBaziGanZhiDiagram,
} from '../../core/bazi-ganzhi-diagram';
import {
    compareWuXing,
    getPillarStatus,
} from '../../core/bazi-relation-rules';
import {
    DEFAULT_GAN_ZHI_RELATION_SETTINGS,
    GanZhiRelationKind,
    GanZhiRelationSettings,
} from '../../core/bazi-ganzhi-relation-engine';
import { BaziGender, BaziPillarKey, BaziResult, ShiShenName } from '../../core/bazi-types';
import { DIZHI_WUXING, TIANGAN_WUXING, WuXing } from '../../core/liuyao-data';
import { ProChartColumnView } from './types';

export type GanZhiVisualTab = 'ganzhi' | 'flow' | 'palace' | 'relations';
export type GanZhiRelationMode = 'family' | 'social';
export type GanZhiFlowDirection = 'left_to_right' | 'right_to_left' | 'bidirectional';

export interface GanZhiVisualPillar {
    key: BaziPillarKey;
    label: string;
    ganZhi: string;
    stem: string;
    branch: string;
    stemElement: WuXing | null;
    branchElement: WuXing | null;
    stemShiShen: string;
    branchShiShen: string;
    pillarStatus: '盖头' | '截脚' | null;
}

export interface GanZhiFlowLink {
    key: string;
    axis: 'horizontal' | 'vertical';
    row: 'stem' | 'branch' | 'pillar';
    fromIndex: number;
    toIndex: number;
    label: string;
    direction: GanZhiFlowDirection;
    tone: 'supportive' | 'obstructive';
}

export interface GanZhiPalaceGroup {
    key: 'time' | 'space' | 'body' | 'people';
    title: string;
    values: Array<{ primary: string; secondary?: string }>;
}

export interface GanZhiRelationProfile {
    pillarKey: BaziPillarKey;
    stemLabels: string[];
    branchLabels: string[];
}

export interface GanZhiVisualViewModel {
    diagram: BaziGanZhiDiagram;
    pillars: GanZhiVisualPillar[];
    flowLinks: GanZhiFlowLink[];
    palaceLabels: Record<BaziPillarKey, string[]>;
    palaceGroups: GanZhiPalaceGroup[];
    familyProfiles: GanZhiRelationProfile[];
    socialProfiles: GanZhiRelationProfile[];
}

const PILLAR_KEYS: BaziPillarKey[] = ['year', 'month', 'day', 'hour'];
const PILLAR_LABELS: Record<BaziPillarKey, string> = {
    year: '年柱',
    month: '月柱',
    day: '日柱',
    hour: '时柱',
};

const FAMILY_RELATIONS: Record<'male' | 'female', Record<Exclude<ShiShenName, '日主'>, string[]>> = {
    male: {
        比肩: ['兄弟', '同辈', '堂兄弟'],
        劫财: ['姐妹', '同辈', '儿媳'],
        食神: ['女儿', '晚辈', '孙辈'],
        伤官: ['儿子', '晚辈', '祖母'],
        偏财: ['父亲', '情人', '伯叔'],
        正财: ['妻子', '父亲', '叔伯'],
        七杀: ['儿子', '外婆', '姐夫'],
        正官: ['女儿', '奶奶', '女婿'],
        偏印: ['继母', '祖父', '岳母'],
        正印: ['母亲', '长辈', '岳父'],
    },
    female: {
        比肩: ['姐妹', '妯娌', '同辈'],
        劫财: ['兄弟', '公公', '同辈'],
        食神: ['奶奶', '女儿'],
        伤官: ['儿子', '外公', '夫家姐夫'],
        偏财: ['父亲', '婆婆', '伯叔'],
        正财: ['父亲', '伯叔'],
        七杀: ['情人', '儿媳', '外婆', '夫家姐妹'],
        正官: ['丈夫', '女婿', '奶奶', '夫家兄弟'],
        偏印: ['继母', '祖父', '夫家长辈'],
        正印: ['爷爷', '女婿', '孙儿'],
    },
};

const SOCIAL_RELATIONS: Record<Exclude<ShiShenName, '日主'>, string[]> = {
    比肩: ['朋友', '同事', '合伙人', '竞争者'],
    劫财: ['朋友', '同辈', '竞争者', '分利之人'],
    食神: ['晚辈', '学生', '下属', '仆人'],
    伤官: ['晚辈', '下属', '仆人'],
    偏财: ['意外之财', '流动资产', '客户', '生意'],
    正财: ['稳定之财', '正途之财', '不动产'],
    七杀: ['敌人', '小人', '恶势力', '权力'],
    正官: ['领导', '上司', '政府', '规则'],
    偏印: ['学者', '医生', '宗教人士', '特殊技艺'],
    正印: ['贵人', '房子', '文凭'],
};

export const GAN_ZHI_PALACE_LABELS: Record<BaziPillarKey, string[]> = {
    year: ['祖辈宫'],
    month: ['事业宫', '父母宫', '兄弟宫'],
    day: ['夫妻宫'],
    hour: ['子女宫'],
};

export const GAN_ZHI_PALACE_GROUPS: GanZhiPalaceGroup[] = [
    {
        key: 'time',
        title: '时间类象',
        values: [
            { primary: '少年', secondary: '1~18岁' },
            { primary: '青年', secondary: '18~36岁' },
            { primary: '中年', secondary: '36~48岁' },
            { primary: '晚年', secondary: '48岁往后' },
        ],
    },
    {
        key: 'space',
        title: '空间类象',
        values: [
            { primary: '远方' },
            { primary: '家乡' },
            { primary: '住所', secondary: '工作场所' },
            { primary: '门户', secondary: '房子附近' },
        ],
    },
    {
        key: 'body',
        title: '身体类象',
        values: [
            { primary: '头部', secondary: '颈部' },
            { primary: '胸部', secondary: '脊柱、肩背' },
            { primary: '腹部', secondary: '心脑、内脏' },
            { primary: '下肢', secondary: '泌尿系统' },
        ],
    },
    {
        key: 'people',
        title: '人际类象',
        values: [
            { primary: '外人' },
            { primary: '同事' },
            { primary: '至亲之人' },
            { primary: '晚辈' },
        ],
    },
];

export function getGanZhiRelationLabels(
    star: string,
    gender: BaziGender,
    mode: GanZhiRelationMode,
): string[] {
    if (star === '日主') {
        return ['自己'];
    }
    const normalized = star as Exclude<ShiShenName, '日主'>;
    if (mode === 'social') {
        return SOCIAL_RELATIONS[normalized] ?? ['暂无类象'];
    }
    return FAMILY_RELATIONS[gender === 1 ? 'male' : 'female'][normalized] ?? ['暂无类象'];
}

function horizontalLink(
    left: GanZhiVisualPillar,
    right: GanZhiVisualPillar,
    row: 'stem' | 'branch',
    index: number,
    diagram: BaziGanZhiDiagram,
): GanZhiFlowLink | null {
    const leftElement = row === 'stem' ? left.stemElement : left.branchElement;
    const rightElement = row === 'stem' ? right.stemElement : right.branchElement;
    if (!leftElement || !rightElement) {
        return null;
    }
    const compared = compareWuXing(leftElement, rightElement);
    const leftOrder = index + 2;
    const rightOrder = index + 3;
    const relations = row === 'stem' ? diagram.stemRelations : diagram.branchRelations;
    const priorities: GanZhiRelationKind[] = row === 'stem'
        ? ['stem_five_combination', 'stem_clash', 'stem_control']
        : [
            'branch_six_combination',
            'branch_three_combination',
            'branch_half_combination',
            'branch_three_meeting',
            'branch_hidden_combination',
            'branch_clash',
            'branch_punishment',
            'branch_self_punishment',
        ];
    const structural = priorities
        .map((kind) => relations.find((relation) => (
            relation.kind === kind
            && relation.nodeOrders.includes(leftOrder)
            && relation.nodeOrders.includes(rightOrder)
        )))
        .find((relation): relation is BaziGanZhiDiagramRelation => Boolean(relation));
    if (structural) {
        const label = (() => {
            if (structural.kind === 'stem_control') return '克';
            if (structural.kind === 'stem_clash' || structural.kind === 'branch_clash') return '冲';
            if (
                structural.kind === 'branch_punishment'
                || structural.kind === 'branch_self_punishment'
            ) return '刑';
            return '合';
        })();
        return {
            key: `${row}-${structural.key}-${index}`,
            axis: 'horizontal',
            row,
            fromIndex: index,
            toIndex: index + 1,
            label,
            direction: structural.kind === 'stem_control' ? compared.direction : 'bidirectional',
            tone: structural.tone === 'obstructive' ? 'obstructive' : 'supportive',
        };
    }

    if (!compared.label) {
        return null;
    }
    return {
        key: `${row}-${compared.label}-${index}`,
        axis: 'horizontal',
        row,
        fromIndex: index,
        toIndex: index + 1,
        label: compared.label,
        direction: compared.direction,
        tone: compared.polarity === 'negative' ? 'obstructive' : 'supportive',
    };
}

export function buildGanZhiFlowLinks(
    pillars: GanZhiVisualPillar[],
    diagram: BaziGanZhiDiagram,
): GanZhiFlowLink[] {
    const links: GanZhiFlowLink[] = [];
    for (let index = 0; index < pillars.length - 1; index += 1) {
        const stemLink = horizontalLink(pillars[index], pillars[index + 1], 'stem', index, diagram);
        const branchLink = horizontalLink(pillars[index], pillars[index + 1], 'branch', index, diagram);
        if (stemLink) links.push(stemLink);
        if (branchLink) links.push(branchLink);
    }

    pillars.forEach((pillar, index) => {
        if (!pillar.stemElement || !pillar.branchElement) return;
        const compared = compareWuXing(pillar.stemElement, pillar.branchElement);
        if (!compared.label) return;
        links.push({
            key: `pillar-${compared.label}-${index}`,
            axis: 'vertical',
            row: 'pillar',
            fromIndex: index,
            toIndex: index,
            label: compared.label,
            direction: compared.direction,
            tone: compared.polarity === 'negative' ? 'obstructive' : 'supportive',
        });
    });
    return links;
}

function buildProfiles(
    result: BaziResult,
    pillars: GanZhiVisualPillar[],
    mode: GanZhiRelationMode,
): GanZhiRelationProfile[] {
    return pillars.map((pillar) => ({
        pillarKey: pillar.key,
        stemLabels: pillar.key === 'day'
            ? ['自己']
            : getGanZhiRelationLabels(pillar.stemShiShen, result.gender, mode),
        branchLabels: getGanZhiRelationLabels(pillar.branchShiShen, result.gender, mode),
    }));
}

export function buildGanZhiVisualViewModel(
    result: BaziResult,
    fortuneColumns: ProChartColumnView[],
    yunWeiLabel: '大运' | '小运',
    settings: GanZhiRelationSettings = DEFAULT_GAN_ZHI_RELATION_SETTINGS,
): GanZhiVisualViewModel {
    const sourceByKey = new Map(fortuneColumns.map((column) => [column.key, column]));
    const pillars = PILLAR_KEYS.map((key, index): GanZhiVisualPillar => {
        const column = sourceByKey.get(key);
        const ganZhi = result.fourPillars[index];
        const stem = column?.tianGan ?? ganZhi[0] ?? '—';
        const branch = column?.diZhi ?? ganZhi[1] ?? '—';
        const stemShiShen = key === 'day'
            ? (result.subject.genderLabel === '男' ? '元男' : '元女')
            : (column?.mainStarFull ?? result.shiShen[index].shiShen);
        const branchShiShen = column?.subStarFull
            ?? result.cangGan[index]?.benQi?.shiShen
            ?? result.cangGan[index]?.items[0]?.shiShen
            ?? '比肩';
        return {
            key,
            label: PILLAR_LABELS[key],
            ganZhi,
            stem,
            branch,
            stemElement: TIANGAN_WUXING[stem] ?? null,
            branchElement: DIZHI_WUXING[branch] ?? null,
            stemShiShen,
            branchShiShen,
            pillarStatus: (() => {
                const status = getPillarStatus(stem, branch);
                if (status === '盖头' && settings.pillarCover) return status;
                if (status === '截脚' && settings.pillarCut) return status;
                return null;
            })(),
        };
    });
    const liuNianColumn = sourceByKey.get('liuNian');
    const yunWeiColumn = sourceByKey.get('daYun');
    const diagram = buildBaziGanZhiDiagram({
        liuNianGanZhi: liuNianColumn?.ganZhi,
        yunWeiGanZhi: yunWeiColumn?.ganZhi,
        yunWeiLabel,
        fourPillars: result.fourPillars,
    }, settings);

    return {
        diagram,
        pillars,
        flowLinks: buildGanZhiFlowLinks(pillars, diagram),
        palaceLabels: GAN_ZHI_PALACE_LABELS,
        palaceGroups: GAN_ZHI_PALACE_GROUPS,
        familyProfiles: buildProfiles(result, pillars, 'family'),
        socialProfiles: buildProfiles(result, pillars, 'social'),
    };
}
