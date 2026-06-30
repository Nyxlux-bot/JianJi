export const BAZI_MATCH_CLASSIC_SECTIONS = [
    '合婚总纲',
    '夫妻星',
    '夫妻宫',
    '五行损益',
    '子女',
    '婚期应期',
    '禁忌误区',
] as const;

export type BaziMatchClassicSection = typeof BAZI_MATCH_CLASSIC_SECTIONS[number];

export type BaziMatchClassicReferenceId =
    | 'HM-01'
    | 'HM-02'
    | 'FS-01'
    | 'FS-02'
    | 'PG-01'
    | 'PG-02'
    | 'CY-01'
    | 'YY-01'
    | 'YQ-01'
    | 'EXP-01'
    | 'LS-01';

export interface BaziMatchClassicReference {
    id: BaziMatchClassicReferenceId;
    section: BaziMatchClassicSection;
    title: string;
    source: string;
    sourceUrl?: string;
    quote: string;
    meaning: string;
    localRule: string;
    boundary: string;
    sourceType: 'classic' | 'experience' | 'boundary';
}

export const BAZI_MATCH_CLASSIC_REFERENCES: BaziMatchClassicReference[] = [
    {
        id: 'HM-01',
        section: '合婚总纲',
        title: '合婚须统看四柱',
        source: '《命理探源·论男女合婚》',
        sourceUrl: 'https://ctext.org/wiki.pl?chapter=435028&if=gb',
        quote: '男女合婚之说，由来久矣。',
        meaning: '合婚不是单看属相、年命或神煞，而要把双方四柱、五行、夫星、子星合看。',
        localRule: '合盘总分以五维同看，不用生肖或单一神煞直接定吉凶。',
        boundary: '生肖、命宫只作辅助，不作为合婚成败的唯一依据。',
        sourceType: 'classic',
    },
    {
        id: 'HM-02',
        section: '五行损益',
        title: '五行生克为合看底盘',
        source: '《命理探源·论男女合婚》',
        sourceUrl: 'https://ctext.org/wiki.pl?chapter=435028&if=gb',
        quote: '年、月、日、时干支八字，及五行生克。',
        meaning: '合婚要先看双方五行偏盛偏弱，再看一方能否补另一方所需。',
        localRule: '旺夫、帮妻以双方旺势五行、偏需五行和未来大运补益为主要依据。',
        boundary: '当前版本用本地五行计数估算喜忌，不冒充完整人工格局定用。',
        sourceType: 'classic',
    },
    {
        id: 'FS-01',
        section: '夫妻星',
        title: '男命以财星论妻',
        source: '《滴天髓阐微·夫妻》',
        sourceUrl: 'https://zh.wikisource.org/wiki/%E6%BB%B4%E5%A4%A9%E9%AB%93%E9%97%A1%E5%BE%AE',
        quote: '夫妻因缘宿世来，喜神有意傍天财。',
        meaning: '男命看妻不只看见财星，还要看财星是否为喜、是否有承接。',
        localRule: '旺夫维度检查男命财星、比劫与女方食伤制化，避免只见财星就判吉。',
        boundary: '财星多不必然婚佳，仍要看身强身弱与命局清浊。',
        sourceType: 'classic',
    },
    {
        id: 'FS-02',
        section: '夫妻星',
        title: '财星要看清浊承接',
        source: '《滴天髓阐微·夫妻》',
        sourceUrl: 'https://zh.wikisource.org/wiki/%E6%BB%B4%E5%A4%A9%E9%AB%93%E9%97%A1%E5%BE%AE',
        quote: '财旺身弱，又喜比劫。',
        meaning: '妻星、财星须结合日主承受力和全局制化，不能死看单星。',
        localRule: '男命比劫、财星偏重时，需看女方食伤与五行是否能化泄或补益。',
        boundary: '本地规则只给结构判断，不替代人工细定格局成败。',
        sourceType: 'classic',
    },
    {
        id: 'PG-01',
        section: '夫妻宫',
        title: '妻财子禄切近日主',
        source: '《子平真诠·论妻子》',
        sourceUrl: 'https://www.suanzhun.net/book/2515.html',
        quote: '妻以配身，子为后嗣。',
        meaning: '配偶与子女都与日主切近，判断时要重视日支、时柱等近身位置。',
        localRule: '和睦看日支夫妻宫，子女看时柱子女宫，并结合双方宫位关系。',
        boundary: '宫位只是落点，必须配合喜忌、星情和岁运。',
        sourceType: 'classic',
    },
    {
        id: 'PG-02',
        section: '夫妻宫',
        title: '妻宫须参月令喜忌',
        source: '《子平真诠·论妻子》',
        sourceUrl: 'https://www.suanzhun.net/book/2515.html',
        quote: '此盖以月令用神，配成喜忌。',
        meaning: '妻宫坐吉神未必吉，坐凶神也未必凶，关键在格局喜忌。',
        localRule: '夫妻宫合冲刑害先定互动形态，再用五行补益和星情判断可否承接。',
        boundary: '没有完整月令格局判定时，只输出谨慎的合盘倾向。',
        sourceType: 'classic',
    },
    {
        id: 'CY-01',
        section: '子女',
        title: '子女星要活看',
        source: '《滴天髓阐微·子女》',
        sourceUrl: 'https://zh.wikisource.org/wiki/%E6%BB%B4%E5%A4%A9%E9%AB%93%E9%97%A1%E5%BE%AE',
        quote: '子女根枝一世传。',
        meaning: '子女缘分不宜只死看一颗星，要看食伤、官杀、日主旺衰与喜忌。',
        localRule: '子女维度同时看男方官杀、女方食伤和双方时柱子女宫。',
        boundary: '只谈命理倾向，不给医学、生育能力或数量承诺。',
        sourceType: 'classic',
    },
    {
        id: 'YY-01',
        section: '子女',
        title: '时柱为子息落点',
        source: '《渊海子平》',
        sourceUrl: 'https://ctext.org/wiki.pl?chapter=524726&if=gb',
        quote: '时为花实，为子息。',
        meaning: '时柱常作为子女宫，适合观察后嗣、养育与晚景落点。',
        localRule: '子女维度将双方时支合冲刑害作为重要加减分依据。',
        boundary: '时柱受冲不等于无子，只表示相关议题更需规划与协调。',
        sourceType: 'classic',
    },
    {
        id: 'YQ-01',
        section: '婚期应期',
        title: '婚期须看岁运引动',
        source: '《命理探源·论流年》引《三命通会》',
        sourceUrl: 'https://ctext.org/wiki.pl?chapter=435028&if=gb',
        quote: '流年者，逐年游行之太岁也。',
        meaning: '婚期不是静态看本命一处，而要看大运、流年如何引动夫妻星宫。',
        localRule: '先算双方单盘婚缘应期，再取两盘同年共振，并只展示18至45岁候选。',
        boundary: '没有同年共振时不硬定婚年，不让详批自行补年份。',
        sourceType: 'classic',
    },
    {
        id: 'EXP-01',
        section: '婚期应期',
        title: '宫位引动与合冲刑害穿破',
        source: '盲派经验规则',
        quote: '宫位逢合冲刑害穿破而动。',
        meaning: '盲派常重宫位被岁运引动，合冲刑害破都可能使婚缘事件显化。',
        localRule: '婚期和和睦维度把夫妻宫、时柱的合冲刑害破作为触发信号。',
        boundary: '此条标为经验规则，不冒充具体古籍原文。',
        sourceType: 'experience',
    },
    {
        id: 'LS-01',
        section: '禁忌误区',
        title: '同寿只看节奏不判寿',
        source: '合婚功能边界',
        quote: '同寿不作寿元断语。',
        meaning: '同寿在合盘中只比较未来阶段起伏、换运节点与喜忌同步程度。',
        localRule: '同寿维度只输出生命周期协同，不输出寿命、死亡年份或医学判断。',
        boundary: '如涉及健康、寿命与医疗，应离开合婚页面另行处理。',
        sourceType: 'boundary',
    },
];

const CLASSIC_REFERENCE_BY_ID = new Map(
    BAZI_MATCH_CLASSIC_REFERENCES.map((item) => [item.id, item]),
);

export function getBaziMatchDimensionReferenceFallbackIds(key: string): BaziMatchClassicReferenceId[] {
    if (key === 'harmony') return ['HM-01', 'PG-01', 'EXP-01'];
    if (key === 'supportHusband') return ['HM-02', 'FS-01', 'FS-02'];
    if (key === 'supportWife') return ['HM-02', 'PG-02'];
    if (key === 'offspring') return ['CY-01', 'YY-01'];
    if (key === 'longevity') return ['LS-01', 'YQ-01'];
    return ['HM-01'];
}

export function getBaziMatchClassicRefs(ids?: readonly string[]): BaziMatchClassicReference[] {
    if (!ids || ids.length === 0) {
        return [];
    }
    const seen = new Set<string>();
    return ids.reduce<BaziMatchClassicReference[]>((acc, id) => {
        if (seen.has(id)) {
            return acc;
        }
        seen.add(id);
        const reference = CLASSIC_REFERENCE_BY_ID.get(id as BaziMatchClassicReferenceId);
        if (reference) {
            acc.push(reference);
        }
        return acc;
    }, []);
}

export function formatClassicReferenceIds(ids?: readonly string[]): string {
    return getBaziMatchClassicRefs(ids).map((item) => `${item.id} ${item.title}`).join('；');
}
