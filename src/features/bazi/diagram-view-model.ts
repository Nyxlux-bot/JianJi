import { HeavenStem, SixtyCycle } from 'tyme4ts';
import {
    BaziDiagramNode,
    buildBaziDiagramFlowLinks,
    extractBaziDiagramRelations,
    getBaziDiagramPillarStatus,
} from '../../core/bazi-diagram';
import { TIANGAN_WUXING, DIZHI_WUXING } from '../../core/liuyao-data';
import { BaziResult } from '../../core/bazi-types';
import {
    BaziDiagramColumnView,
    BaziDiagramGenderDictionary,
    BaziDiagramViewModel,
    BaziKinshipCellView,
    BaziPalaceCategoryView,
    BaziPalaceColumnView,
} from './diagram-types';
import { FortuneSelectionView } from './types';

function toShiShenShort(name: string): string {
    const map: Record<string, string> = {
        比肩: '比肩',
        劫财: '劫财',
        食神: '食神',
        伤官: '伤官',
        偏财: '偏财',
        正财: '正财',
        七杀: '七杀',
        正官: '正官',
        偏印: '偏印',
        正印: '正印',
        日主: '日主',
    };
    return map[name] ?? name;
}

function getDayMaster(result: BaziResult): HeavenStem {
    return SixtyCycle.fromName(result.fourPillars[2]).getHeavenStem();
}

function formatGanZhiWithShiShen(dayMaster: HeavenStem, ganZhi: string): { stemTenGod: string; branchTenGod: string } {
    const sixtyCycle = SixtyCycle.fromName(ganZhi);
    const tianGan = sixtyCycle.getHeavenStem();
    const diZhi = sixtyCycle.getEarthBranch();
    return {
        stemTenGod: toShiShenShort(dayMaster.getTenStar(tianGan).getName()),
        branchTenGod: toShiShenShort(dayMaster.getTenStar(diZhi.getHideHeavenStemMain()).getName()),
    };
}

function clampIndex(value: number, max: number): number {
    if (max < 0) {
        return 0;
    }
    return Math.min(Math.max(value, 0), max);
}

function getSelectedContext(result: BaziResult, selection: FortuneSelectionView): {
    selection: FortuneSelectionView;
    liuNianGanZhi: string;
    dayunGanZhi: string;
    dayunNote?: string;
} {
    if (selection.mode === 'xiaoyun') {
        const selectedXiaoYunIndex = clampIndex(selection.selectedXiaoYunIndex, result.xiaoYun.length - 1);
        const selectedXiaoYun = result.xiaoYun[selectedXiaoYunIndex];
        return {
            selection: {
                mode: 'xiaoyun',
                selectedDaYunIndex: 0,
                selectedXiaoYunIndex,
                selectedLiuNianIndex: selectedXiaoYunIndex,
                selectedLiuYueIndex: clampIndex(selection.selectedLiuYueIndex, (selectedXiaoYun?.liuYue.length ?? 1) - 1),
            },
            liuNianGanZhi: selectedXiaoYun?.ganZhi ?? '—',
            dayunGanZhi: selectedXiaoYun?.xiaoYunGanZhi ?? '—',
            dayunNote: '小运视角',
        };
    }

    const selectedDaYunIndex = clampIndex(selection.selectedDaYunIndex, result.daYun.length - 1);
    const selectedDaYun = result.daYun[selectedDaYunIndex];
    const selectedLiuNianIndex = clampIndex(selection.selectedLiuNianIndex, (selectedDaYun?.liuNian.length ?? 1) - 1);
    const selectedLiuNian = selectedDaYun?.liuNian[selectedLiuNianIndex];
    return {
        selection: {
            mode: 'dayun',
            selectedDaYunIndex,
            selectedXiaoYunIndex: clampIndex(selection.selectedXiaoYunIndex, result.xiaoYun.length - 1),
            selectedLiuNianIndex,
            selectedLiuYueIndex: clampIndex(selection.selectedLiuYueIndex, (selectedLiuNian?.liuYue.length ?? 1) - 1),
        },
        liuNianGanZhi: selectedLiuNian?.ganZhi ?? '—',
        dayunGanZhi: selectedDaYun?.ganZhi ?? '—',
    };
}

function createColumnView(input: {
    key: string;
    label: string;
    ganZhi: string;
    note?: string;
    stemTenGod?: string;
    branchTenGod?: string;
}): BaziDiagramColumnView {
    const ganZhi = input.ganZhi;
    if (!ganZhi || ganZhi.length < 2 || ganZhi === '—') {
        return {
            key: input.key,
            label: input.label,
            note: input.note,
            ganZhi: '—',
            stem: '—',
            branch: '—',
            stemElement: '土',
            branchElement: '土',
            stemTenGod: input.stemTenGod ?? '—',
            branchTenGod: input.branchTenGod ?? '—',
        };
    }

    return {
        key: input.key,
        label: input.label,
        note: input.note,
        ganZhi,
        stem: ganZhi[0],
        branch: ganZhi[1],
        stemElement: TIANGAN_WUXING[ganZhi[0]],
        branchElement: DIZHI_WUXING[ganZhi[1]],
        stemTenGod: input.stemTenGod ?? '—',
        branchTenGod: input.branchTenGod ?? '—',
    };
}

function toDiagramNode(column: BaziDiagramColumnView): BaziDiagramNode {
    return {
        key: column.key,
        label: column.label,
        stem: column.stem,
        branch: column.branch,
    };
}

function buildGanzhiColumns(result: BaziResult, selection: FortuneSelectionView): {
    columns: BaziDiagramColumnView[];
    activeSelection: FortuneSelectionView;
} {
    const dayMaster = getDayMaster(result);
    const selected = getSelectedContext(result, selection);
    const liuNianTenGod = selected.liuNianGanZhi === '—'
        ? { stemTenGod: '—', branchTenGod: '—' }
        : formatGanZhiWithShiShen(dayMaster, selected.liuNianGanZhi);
    const dayunTenGod = selected.dayunGanZhi === '—'
        ? { stemTenGod: '—', branchTenGod: '—' }
        : formatGanZhiWithShiShen(dayMaster, selected.dayunGanZhi);

    const columns: BaziDiagramColumnView[] = [
        createColumnView({
            key: 'liunian',
            label: '流年',
            ganZhi: selected.liuNianGanZhi,
            stemTenGod: liuNianTenGod.stemTenGod,
            branchTenGod: liuNianTenGod.branchTenGod,
        }),
        createColumnView({
            key: 'dayun',
            label: '大运',
            note: selected.dayunNote,
            ganZhi: selected.dayunGanZhi,
            stemTenGod: dayunTenGod.stemTenGod,
            branchTenGod: dayunTenGod.branchTenGod,
        }),
        createColumnView({
            key: 'year',
            label: '年柱',
            ganZhi: result.fourPillars[0],
            stemTenGod: toShiShenShort(result.shiShen[0].shiShen),
            branchTenGod: toShiShenShort(result.cangGan[0].items[0]?.shiShen ?? '—'),
        }),
        createColumnView({
            key: 'month',
            label: '月柱',
            ganZhi: result.fourPillars[1],
            stemTenGod: toShiShenShort(result.shiShen[1].shiShen),
            branchTenGod: toShiShenShort(result.cangGan[1].items[0]?.shiShen ?? '—'),
        }),
        createColumnView({
            key: 'day',
            label: '日柱',
            ganZhi: result.fourPillars[2],
            stemTenGod: '日主',
            branchTenGod: toShiShenShort(result.cangGan[2].items[0]?.shiShen ?? '—'),
        }),
        createColumnView({
            key: 'hour',
            label: '时柱',
            ganZhi: result.fourPillars[3],
            stemTenGod: toShiShenShort(result.shiShen[3].shiShen),
            branchTenGod: toShiShenShort(result.cangGan[3].items[0]?.shiShen ?? '—'),
        }),
    ];

    return {
        columns,
        activeSelection: selected.selection,
    };
}

const PALACE_CATEGORIES: BaziPalaceCategoryView[] = [
    {
        key: 'time',
        title: '时间类象',
        values: ['少年\n1~18岁', '青年\n18~36岁', '中年\n36~48岁', '晚年\n48岁往后'],
    },
    {
        key: 'space',
        title: '空间类象',
        values: ['远方', '家乡', '住所\n工作场所', '门户\n房子附近'],
    },
    {
        key: 'body',
        title: '身体类象',
        values: ['头部\n颈部', '胸部\n脊柱、肩背', '腹部\n心脑、内脏', '下肢\n泌尿系统'],
    },
    {
        key: 'social',
        title: '人际类象',
        values: ['外人\n长辈', '同事\n领导', '至亲之人', '晚辈\n学生'],
    },
];

function buildPalaceColumns(result: BaziResult): BaziPalaceColumnView[] {
    return [
        {
            key: 'year',
            titleLines: ['祖辈宫'],
            pillarLabel: '年柱',
            stem: result.fourPillars[0][0],
            branch: result.fourPillars[0][1],
            stemElement: TIANGAN_WUXING[result.fourPillars[0][0]],
            branchElement: DIZHI_WUXING[result.fourPillars[0][1]],
        },
        {
            key: 'month',
            titleLines: ['事业宫', '父母宫', '兄弟宫'],
            pillarLabel: '月柱',
            stem: result.fourPillars[1][0],
            branch: result.fourPillars[1][1],
            stemElement: TIANGAN_WUXING[result.fourPillars[1][0]],
            branchElement: DIZHI_WUXING[result.fourPillars[1][1]],
        },
        {
            key: 'day',
            titleLines: ['夫妻宫'],
            pillarLabel: '日柱',
            stem: result.fourPillars[2][0],
            branch: result.fourPillars[2][1],
            stemElement: TIANGAN_WUXING[result.fourPillars[2][0]],
            branchElement: DIZHI_WUXING[result.fourPillars[2][1]],
        },
        {
            key: 'hour',
            titleLines: ['子女宫'],
            pillarLabel: '时柱',
            stem: result.fourPillars[3][0],
            branch: result.fourPillars[3][1],
            stemElement: TIANGAN_WUXING[result.fourPillars[3][0]],
            branchElement: DIZHI_WUXING[result.fourPillars[3][1]],
        },
    ];
}

const MALE_DICT: BaziDiagramGenderDictionary = {
    top: {
        kinship: {
            比肩: ['兄弟', '堂亲'],
            劫财: ['姐妹', '手足'],
            食神: ['奶奶', '女儿'],
            伤官: ['儿子', '晚辈'],
            偏财: ['伯叔', '偏缘'],
            正财: ['父亲', '妻子'],
            七杀: ['情人', '儿媳'],
            正官: ['女婿', '官缘'],
            偏印: ['继母', '偏长辈'],
            正印: ['妈妈', '爷爷'],
            元男: ['自己'],
            元女: ['自己'],
        },
        social: {
            比肩: ['同辈', '伙伴'],
            劫财: ['竞争者', '朋友'],
            食神: ['晚辈', '学生', '下属', '仆人'],
            伤官: ['表达', '创作', '项目'],
            偏财: ['客户', '资源', '偏门财'],
            正财: ['稳定之财', '正途之财', '不动产'],
            七杀: ['敌人', '小人', '恶势力', '权力'],
            正官: ['领导', '职位', '规章'],
            偏印: ['研究', '玄思', '灵感'],
            正印: ['贵人', '房子', '文凭'],
            元男: ['自己'],
            元女: ['自己'],
        },
    },
    bottom: {
        kinship: {
            比肩: ['兄弟', '同辈'],
            劫财: ['姐妹', '争财者'],
            食神: ['孙辈', '女儿'],
            伤官: ['儿子', '外公'],
            偏财: ['父亲', '伯叔'],
            正财: ['爸爸', '妻子'],
            七杀: ['外婆', '夫家'],
            正官: ['丈夫', '女婿'],
            偏印: ['养母', '继亲'],
            正印: ['爸爸', '爷爷', '孙儿'],
            元男: ['自己'],
            元女: ['自己'],
        },
        social: {
            比肩: ['合伙', '同行'],
            劫财: ['竞争', '夺财'],
            食神: ['贵人', '房子', '文凭'],
            伤官: ['晚辈', '下属', '仆人'],
            偏财: ['客户', '外财', '资源'],
            正财: ['正财', '资产'],
            七杀: ['故人', '小人', '权柄'],
            正官: ['职位', '考核', '制度'],
            偏印: ['偏门', '学术', '策划'],
            正印: ['庇护', '名誉', '证书'],
            元男: ['自己'],
            元女: ['自己'],
        },
    },
};

const FEMALE_DICT: BaziDiagramGenderDictionary = {
    top: {
        kinship: {
            比肩: ['姐妹', '同辈'],
            劫财: ['兄弟', '手足'],
            食神: ['奶奶', '女儿'],
            伤官: ['儿子', '晚辈'],
            偏财: ['父亲', '伯叔'],
            正财: ['婆家', '资产'],
            七杀: ['偏夫', '情缘'],
            正官: ['丈夫', '夫缘'],
            偏印: ['继母', '偏长辈'],
            正印: ['妈妈', '奶奶'],
            元男: ['自己'],
            元女: ['自己'],
        },
        social: {
            比肩: ['闺蜜', '伙伴'],
            劫财: ['竞争者', '对手'],
            食神: ['学生', '作品', '下属'],
            伤官: ['表达', '才艺', '项目'],
            偏财: ['客户', '机缘', '偏财'],
            正财: ['稳定之财', '正财', '不动产'],
            七杀: ['压力', '小人', '权力'],
            正官: ['领导', '岗位', '规则'],
            偏印: ['研究', '灵感', '偏门'],
            正印: ['贵人', '文书', '房产'],
            元男: ['自己'],
            元女: ['自己'],
        },
    },
    bottom: {
        kinship: {
            比肩: ['姐妹', '同辈'],
            劫财: ['兄弟', '争财者'],
            食神: ['孙辈', '女儿'],
            伤官: ['儿子', '外亲'],
            偏财: ['父亲', '伯叔'],
            正财: ['婆家', '资产'],
            七杀: ['情缘', '偏夫'],
            正官: ['丈夫', '正缘'],
            偏印: ['养亲', '继亲'],
            正印: ['妈妈', '祖辈'],
            元男: ['自己'],
            元女: ['自己'],
        },
        social: {
            比肩: ['合作', '同行'],
            劫财: ['竞争', '消耗'],
            食神: ['贵人', '房子', '文凭'],
            伤官: ['晚辈', '下属', '项目'],
            偏财: ['客户', '外财', '资源'],
            正财: ['资产', '正财'],
            七杀: ['故人', '小人', '权势'],
            正官: ['职位', '制度', '声望'],
            偏印: ['偏门', '玄学', '策划'],
            正印: ['庇护', '名誉', '证书'],
            元男: ['自己'],
            元女: ['自己'],
        },
    },
};

function pickDictionary(result: BaziResult): BaziDiagramGenderDictionary {
    return result.gender === 1 ? MALE_DICT : FEMALE_DICT;
}

function buildKinshipCell(result: BaziResult, key: 'year' | 'month' | 'day' | 'hour', index: 0 | 1 | 2 | 3): BaziKinshipCellView {
    const dictionary = pickDictionary(result);
    const ganZhi = result.fourPillars[index];
    const topTenGod = key === 'day'
        ? result.yuanMing.current.label
        : toShiShenShort(result.shiShen[index].shiShen);
    const bottomTenGod = toShiShenShort(result.cangGan[index].items[0]?.shiShen ?? '正印');

    return {
        key,
        pillarLabel: key === 'year' ? '年柱' : key === 'month' ? '月柱' : key === 'day' ? '日柱' : '时柱',
        topTenGod,
        topRelations: dictionary.top.kinship[topTenGod] ?? ['亲缘'],
        stem: ganZhi[0],
        branch: ganZhi[1],
        bottomTenGod,
        bottomRelations: dictionary.bottom.kinship[bottomTenGod] ?? ['亲缘'],
        stemElement: TIANGAN_WUXING[ganZhi[0]],
        branchElement: DIZHI_WUXING[ganZhi[1]],
    };
}

function buildSocialCell(result: BaziResult, key: 'year' | 'month' | 'day' | 'hour', index: 0 | 1 | 2 | 3): BaziKinshipCellView {
    const dictionary = pickDictionary(result);
    const ganZhi = result.fourPillars[index];
    const topTenGod = key === 'day'
        ? result.yuanMing.current.label
        : toShiShenShort(result.shiShen[index].shiShen);
    const bottomTenGod = toShiShenShort(result.cangGan[index].items[0]?.shiShen ?? '正印');

    return {
        key: `${key}-social`,
        pillarLabel: key === 'year' ? '年柱' : key === 'month' ? '月柱' : key === 'day' ? '日柱' : '时柱',
        topTenGod,
        topRelations: dictionary.top.social[topTenGod] ?? ['社会关系'],
        stem: ganZhi[0],
        branch: ganZhi[1],
        bottomTenGod,
        bottomRelations: dictionary.bottom.social[bottomTenGod] ?? ['社会关系'],
        stemElement: TIANGAN_WUXING[ganZhi[0]],
        branchElement: DIZHI_WUXING[ganZhi[1]],
    };
}

function buildLegendText(viewModelInput: {
    relations: ReturnType<typeof extractBaziDiagramRelations>;
    flowLinks: ReturnType<typeof buildBaziDiagramFlowLinks>;
    flowStatuses: Array<{ key: string; label: '盖头' | '截脚' }>;
}): { positive: string; negative: string } {
    const positive = new Set<string>();
    const negative = new Set<string>();

    viewModelInput.relations.forEach((relation) => {
        if (relation.polarity === 'positive') {
            if (relation.relationType === 'gan_he') positive.add('五合');
            if (relation.relationType === 'zhi_liu_he') positive.add('六合');
            if (relation.relationType === 'zhi_san_he') positive.add('三合');
            if (relation.relationType === 'zhi_san_hui') positive.add('三会');
            if (relation.relationType === 'zhi_an_he') positive.add('暗合');
        }
        if (relation.polarity === 'negative') {
            if (relation.relationType === 'gan_chong' || relation.relationType === 'zhi_chong') negative.add('相冲');
            if (relation.relationType === 'gan_ke') negative.add('相克');
            if (relation.relationType === 'zhi_xing') negative.add('相刑');
            if (relation.relationType === 'zhi_po') negative.add('相破');
            if (relation.relationType === 'zhi_hai') negative.add('相害');
            if (relation.relationType === 'pillar_fanyin') negative.add('反吟');
        }
    });

    viewModelInput.flowLinks.forEach((link) => {
        if (link.polarity === 'positive') {
            if (link.label === '生') positive.add('相生');
            if (link.label === '助') positive.add('相助');
        }
        if (link.polarity === 'negative' && link.label === '克') {
            negative.add('相克');
        }
    });

    viewModelInput.flowStatuses.forEach((status) => negative.add(status.label));

    return {
        positive: positive.size > 0 ? `流通：${[...positive].join('、')}` : '流通：无',
        negative: negative.size > 0 ? `阻塞：${[...negative].join('、')}` : '阻塞：无',
    };
}

export function buildBaziDiagramViewModel(
    result: BaziResult,
    selection: FortuneSelectionView,
): BaziDiagramViewModel {
    const { columns, activeSelection } = buildGanzhiColumns(result, selection);
    const nodes = columns.map(toDiagramNode);
    const relations = extractBaziDiagramRelations(nodes);
    const flowLinks = buildBaziDiagramFlowLinks(nodes);
    const flowStatuses = columns
        .map((column) => ({
            key: column.key,
            label: getBaziDiagramPillarStatus(toDiagramNode(column)),
        }))
        .filter((item): item is { key: string; label: '盖头' | '截脚' } => Boolean(item.label));

    const palaceColumns = buildPalaceColumns(result);
    const kinshipColumns = [
        buildKinshipCell(result, 'year', 0),
        buildKinshipCell(result, 'month', 1),
        buildKinshipCell(result, 'day', 2),
        buildKinshipCell(result, 'hour', 3),
    ];
    const socialColumns = [
        buildSocialCell(result, 'year', 0),
        buildSocialCell(result, 'month', 1),
        buildSocialCell(result, 'day', 2),
        buildSocialCell(result, 'hour', 3),
    ];
    const legend = buildLegendText({
        relations,
        flowLinks,
        flowStatuses,
    });

    return {
        activeSelection,
        ganzhiColumns: columns,
        ganzhiRelations: relations,
        flowColumns: columns,
        flowLinks,
        flowStatuses,
        palaceColumns,
        palaceCategories: PALACE_CATEGORIES,
        kinshipSections: [
            { title: '亲属关系', columns: kinshipColumns },
            { title: '社会关系', columns: socialColumns },
        ],
        legend,
    };
}
