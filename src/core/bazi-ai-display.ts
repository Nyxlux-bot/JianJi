/** 仅转换阅读和导出的文字；保存的原文及给 AI 的引用 ID 保持可追溯。 */
const FACT_NAMES: Readonly<Record<string, string>> = {
    'natal.birth': '出生资料与排盘口径', 'natal.base': '命盘附加资料',
    'natal.jieqi': '出生节气', 'natal.qiyun': '起运与交运时间', 'natal.yuanming': '元命与命卦',
    'natal.season': '月令五行', 'natal.tenGodDistribution': '十神透藏分布',
    'natal.shensha': '原局神煞', 'natal.shenshaSources': '原局神煞来源', 'natal.relations': '原局干支关系',
    'fortune.shenshaSources': '岁运神煞来源', 'fortune.preluck': '交运前小运',
    'fortune.unassigned': '所属大运未记录的流年', 'context.focus': '当前查看的岁运',
    'reference.analysis': '原局分析参考', 'reference.energy': '所选岁运五行',
};
const PILLAR_NAMES: Readonly<Record<string, string>> = { year: '年柱', month: '月柱', day: '日柱', hour: '时柱' };
const RELATION_NAMES: Readonly<Record<string, string>> = {
    stem_control: '天干相克', stem_clash: '天干相冲', stem_five_combination: '天干五合',
    branch_clash: '地支相冲', branch_harm: '地支相害', branch_break: '地支相破',
    branch_punishment: '地支相刑', branch_self_punishment: '地支自刑',
    branch_six_combination: '地支六合', branch_three_combination: '地支三合',
    branch_three_meeting: '地支三会', branch_half_combination: '地支半合', branch_hidden_combination: '地支暗合',
    pillar_repeating: '整柱伏吟', pillar_opposing: '整柱反吟', pillar_cut: '截脚',
    pillar_cover: '盖头', pillar_self_combination: '干支自合',
};
const REFERENCE_PATTERN = new RegExp(
    'relation:[a-z_]+:[A-Za-z0-9_.+]+:[^\\s`，。、；：！？（）()\\[\\]<>]+'
    + '|fortune\\.shensha\\.[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]'
    + '|(?:natal|fortune|reference|context)\\.[A-Za-z0-9_]+(?:\\.[A-Za-z0-9_]+)*'
    + '|\\b(?:' + Object.keys(RELATION_NAMES).join('|') + ')\\b', 'g',
);

function describeReference(id: string): string {
    if (Object.hasOwn(FACT_NAMES, id)) return FACT_NAMES[id];
    if (Object.hasOwn(RELATION_NAMES, id)) return RELATION_NAMES[id];
    const pillar = id.match(/^(?:natal|n)\.(year|month|day|hour)(?:\.(roots|天干|藏干.+))?$/u);
    if (pillar) return PILLAR_NAMES[pillar[1]] + (pillar[2] === 'roots' ? '透干根气来源' : pillar[2] ?? '');
    if (id.startsWith('relation:')) {
        const [, , members, label] = id.split(':');
        return `${members.split('+').map(describeReference).join('与')}${label}`;
    }
    const compactAnnual = id.match(/^(?:d\d+|p|u)\.y(\d+)\.(ln|xy)$/);
    if (compactAnnual) return `${compactAnnual[1]}年${compactAnnual[2] === 'ln' ? '流年' : '小运'}`;
    const annual = id.match(/^fortune\.(?:dayun\.\d+|preluck|unassigned)\.year\.(\d+)(?:\.(liunian|xiaoyun))?$/);
    if (annual) return `${annual[1]}年${annual[2] === 'xiaoyun' ? '小运' : annual[2] === 'liunian' ? '流年' : '岁运'}`;
    const decade = id.match(/^(?:fortune\.dayun\.|d)(\d+)(?:\.(relations|years))?$/);
    if (decade) return `第${Number(decade[1]) + 1}步大运${decade[2] === 'relations' ? '与原局关系' : decade[2] === 'years' ? '流年索引' : ''}`;
    const month = id.match(/^(?:fortune\.month\.|m)(\d+)\.(\d+)$/);
    if (month) return `${month[1]}年流月记录${Number(month[2]) + 1}`;
    if (id.startsWith('fortune.shensha.')) return `${id.slice('fortune.shensha.'.length)}岁运神煞`;
    // 未知编号保留原文，不能把无法识别的引用伪装成有效盘据名称。
    return id;
}

export function formatBaziDisplayContent(content: string): string {
    const translate = (text: string) => text.replace(REFERENCE_PATTERN, describeReference);
    const withoutReferenceCode = content.replace(/(?<!`)`([^`\n]+)`(?!`)/g, (original, code: string) => {
        const translated = translate(code);
        return translated === code ? original : translated;
    });
    const translated = translate(withoutReferenceCode);
    return translated.replace(/\[R\d+\]/g, '').replace(/\[\s*\]/g, '');
}
