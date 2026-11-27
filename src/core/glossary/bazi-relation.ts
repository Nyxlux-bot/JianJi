import type { GlossaryClassicBookLink, GlossaryEntry, GlossaryNature } from './types';

/**
 * 干支关系词典：八字「干支关系」层、干支详情页与合盘页上的合、冲、刑、害、破等标签。
 * 查法与本应用的关系规则 src/core/bazi-relation-rules.ts 一致；古籍说法不同处在查法里写明。
 */

const link = (bookId: string, bookTitle: string, chapterId: string, chapterTitle: string): GlossaryClassicBookLink => ({ bookId, bookTitle, chapterId, chapterTitle });
const SM_GANHE = link('sanmingtonghui', '三命通会', 'sanmingtonghui-031', '论十干合');
const SM_LIUHE = link('sanmingtonghui', '三命通会', 'sanmingtonghui-033', '论支元六合');
const SM_SANHE = link('sanmingtonghui', '三命通会', 'sanmingtonghui-034', '论支元三合');
const SM_LIUHAI = link('sanmingtonghui', '三命通会', 'sanmingtonghui-035', '论六害');
const SM_SANXING = link('sanmingtonghui', '三命通会', 'sanmingtonghui-036', '论三刑');
const SM_SUIYUN = link('sanmingtonghui', '三命通会', 'sanmingtonghui-029', '总论嵗运');
const SM_SHENSHA = link('sanmingtonghui', '三命通会', 'sanmingtonghui-049', '总论诸神煞');
const ZP_SHENGKE = link('zipingzhenquan', '子平真诠', 'zipingzhenquan-003', '论阴阳生克');
const ZP_HEBUHE = link('zipingzhenquan', '子平真诠', 'zipingzhenquan-006', '论十干合而不合');
const ZP_XINGCHONG = link('zipingzhenquan', '子平真诠', 'zipingzhenquan-008', '论刑冲会合解法');
const DT_FANGJU = link('ditiansuichanwei', '滴天髓阐微', 'ditiansuichanwei-012', '方局');
const SF_GAITOU = link('shenfengtongkao', '神峰通考', 'shenfengtongkao-007', '盖头说');

interface RelationSeed {
    title: string;
    subtitle: string;
    aliases?: string[];
    nature: GlossaryNature;
    summary: string;
    focusHint: string;
    rule: string;
    notes?: Array<{ label: string; content: string; tone?: 'favorable' | 'unfavorable' | 'neutral' }>;
    citations?: Array<{ source: string; original: string; translation: string; bookLink: GlossaryClassicBookLink }>;
    bookLinks: GlossaryClassicBookLink[];
}

const SEEDS: RelationSeed[] = [
    {
        title: '天干五合',
        subtitle: '甲己 · 乙庚 · 丙辛 · 丁壬 · 戊癸',
        aliases: ['五合', '干合', '合化', '天干合'],
        nature: 'neutral',
        summary: '阴阳相配的两干相合。合则有情，相合的两干彼此牵绊；能不能化成另一种五行，要看月令和全局是否支持。',
        focusHint: '看两干是否紧贴、有无争合妒合、月令是否支持化气',
        rule: '甲己合化土、乙庚合化金、丙辛合化水、丁壬合化木、戊癸合化火。',
        notes: [
            { label: '合而不化', content: '两干相合而不变质，多论作牵绊、减力。' },
            { label: '隔位', content: '隔位太远，或中间夹着克神，合而不能合，《子平真诠》称为半合，祸福只得十之二三。' },
        ],
        citations: [
            {
                source: '《三命通会·论十干合》',
                original: '夫合者，乃和谐之义。如阳见阳，二阳相竞则为克；阴见阴，二阴不足则为克；惟阴见阳、阳见阴为合，亦如男女相合而成夫妇之道。',
                translation: '合是和谐的意思。阳干遇阳干相争为克，阴干遇阴干不足也为克；只有阴阳相遇才为合，就像男女相配成为夫妇。',
                bookLink: SM_GANHE,
            },
            {
                source: '《子平真诠·论十干合而不合》',
                original: '又有隔位太远，如甲在年干，己在时上，心虽相契，地则相远，如人天南地北，不能相合一般。',
                translation: '两干隔得太远，比如甲在年干、己在时干，心意虽然相合，位置却离得远，就像天南地北的两个人，合不到一起。',
                bookLink: ZP_HEBUHE,
            },
        ],
        bookLinks: [SM_GANHE, ZP_HEBUHE],
    },
    {
        title: '天干相冲',
        subtitle: '甲庚 · 乙辛 · 丙壬 · 丁癸',
        aliases: ['干冲', '天干冲'],
        nature: 'inauspicious',
        summary: '方位相对、同性相克的两干相遇，主动荡、对立。戊己居中，不论冲。',
        focusHint: '冲到喜用为损，冲去忌神反而为福',
        rule: '甲庚冲、乙辛冲、丙壬冲、丁癸冲。',
        bookLinks: [],
    },
    {
        title: '天干相克',
        subtitle: '木克土 · 土克水 · 水克火 · 火克金 · 金克木',
        aliases: ['干克', '相克'],
        nature: 'neutral',
        summary: '两干五行相克。克是节制，不全是坏事：生而不克，四时也不成；关键看克的是喜神还是忌神。',
        focusHint: '克去忌神为用，克伤喜神为病',
        rule: '木克土、土克水、水克火、火克金、金克木；以日干论，阳克阳、阴克阴为七杀，阴阳相克为正官。',
        citations: [
            {
                source: '《子平真诠·论阴阳生克》',
                original: '然而有生又必有克，生而不克，则四时亦不成矣。克者，所以节而止之，使之收敛，以为发泄之机。',
                translation: '有生就一定有克，只生不克，四季也无法运转。克的作用是节制，让万物收敛，为下一次生发蓄势。',
                bookLink: ZP_SHENGKE,
            },
        ],
        bookLinks: [ZP_SHENGKE],
    },
    {
        title: '六合',
        subtitle: '子丑 · 寅亥 · 卯戌 · 辰酉 · 巳申 · 午未',
        aliases: ['地支六合', '支合'],
        nature: 'auspicious',
        summary: '地支两两相合，主亲和、牵绊，也能化解刑冲。',
        focusHint: '合住喜神则减力，合住忌神则为福；合能解冲',
        rule: '子丑合、寅亥合、卯戌合、辰酉合、巳申合、午未合。',
        notes: [
            { label: '解冲', tone: 'favorable', content: '刑冲遇合可以化解，如卯酉相冲而支中有戌，卯与戌合便不冲（《子平真诠》）。' },
        ],
        citations: [
            {
                source: '《三命通会·论支元六合》',
                original: '夫合者，和也，乃阴阳相和，其气自合。',
                translation: '合就是和，阴阳相互调和，气自然相合。',
                bookLink: SM_LIUHE,
            },
            {
                source: '《子平真诠·论刑冲会合解法》',
                original: '合者，六合也，子与丑合之类是也。',
                translation: '这里说的合就是六合，像子与丑相合这一类。',
                bookLink: ZP_XINGCHONG,
            },
        ],
        bookLinks: [SM_LIUHE, ZP_XINGCHONG],
    },
    {
        title: '三合',
        subtitle: '申子辰水 · 亥卯未木 · 寅午戌火 · 巳酉丑金',
        aliases: ['三合局', '合局'],
        nature: 'auspicious',
        summary: '三支按「生、旺、库」结成一局，三字齐全才成局，力量强，能改变局中五行的轻重。',
        focusHint: '三字齐全才算成局；局神是喜是忌决定吉凶',
        rule: '申子辰合水局、亥卯未合木局、寅午戌合火局、巳酉丑合金局。',
        citations: [
            {
                source: '《三命通会·论支元三合》',
                original: '如申子辰，申乃子之母，辰乃子之子；申乃水生，子乃水旺……有生有成有收，万物得始得终，乃自然之理……若三字缺其一，则化不成局，不可以三合化局论。',
                translation: '以申子辰为例：申是水的长生，子是水的帝旺，辰是水的墓库，有生、有成、有收，万物有始有终，这是自然之理。三字缺一，就化不成局，不能按三合论。',
                bookLink: SM_SANHE,
            },
        ],
        bookLinks: [SM_SANHE],
    },
    {
        title: '半合',
        subtitle: '三合缺一字',
        aliases: ['半三合'],
        nature: 'neutral',
        summary: '三合局只见两字，如申子、子辰。不成全局，力量较弱；岁运补足所缺之字时才成局。',
        focusHint: '有旺支（子午卯酉）在内的半合较有力',
        rule: '申子、子辰半合水；亥卯、卯未半合木；寅午、午戌半合火；巳酉、酉丑半合金。',
        citations: [
            {
                source: '《三命通会·论支元三合》',
                original: '若三字缺其一，则化不成局，不可以三合化局论。',
                translation: '三字缺一，就化不成局，不能按三合论。',
                bookLink: SM_SANHE,
            },
        ],
        bookLinks: [SM_SANHE],
    },
    {
        title: '三会',
        subtitle: '寅卯辰木 · 巳午未火 · 申酉戌金 · 亥子丑水',
        aliases: ['三会局', '会局', '方局'],
        nature: 'auspicious',
        summary: '同一方位的三支相会，三字全为成方，力量比三合局更强。',
        focusHint: '三字俱全才算成方；方局之神旺极，喜忌最分明',
        rule: '寅卯辰会东方木，巳午未会南方火，申酉戌会西方金，亥子丑会北方水。',
        citations: [
            {
                source: '《滴天髓阐微·方局》',
                original: '方是方兮局是局，要得方兮莫混局。',
                translation: '方是方，局是局，成了方局就不要和三合局混在一起看。',
                bookLink: DT_FANGJU,
            },
            {
                source: '《滴天髓阐微·方局》任铁樵注',
                original: '凡三字全为成方，如寅卯辰全，其力量较胜于亥卯未木局。',
                translation: '三字齐全才算成方，比如寅卯辰俱全，力量比亥卯未木局还强。',
                bookLink: DT_FANGJU,
            },
        ],
        bookLinks: [DT_FANGJU],
    },
    {
        title: '暗合',
        subtitle: '寅丑 · 午亥 · 卯申',
        aliases: ['地支暗合'],
        nature: 'neutral',
        summary: '两支表面不合，藏干里的主气相合，主暗中的牵连与往来。',
        focusHint: '暗合多主私下的联系，宜结合所合十神看',
        rule: '寅丑暗合、午亥暗合、卯申暗合。',
        bookLinks: [],
    },
    {
        title: '拱合',
        subtitle: '两支夹拱中间一支',
        aliases: ['拱', '虚拱', '夹拱'],
        nature: 'neutral',
        summary: '两支一前一后，把中间那一支「拱」出来，如丑卯拱寅。所拱之支不在盘面，却有其气。',
        focusHint: '拱出的若是禄、贵，古法以为贵气；被冲破则不拱',
        rule: '同一旬或相邻的两支，夹住中间缺的一支，即为拱，如丑卯拱寅、辰午拱巳。',
        citations: [
            {
                source: '《三命通会·论三刑》',
                original: '拱者禄之尊，如甲禄居寅，不见寅而见丑卯在两傍拱之，谓之虚拱。',
                translation: '所谓拱，是禄的尊位：甲禄在寅，盘中不见寅，却有丑、卯在两旁把寅夹出来，叫作虚拱。',
                bookLink: SM_SANXING,
            },
        ],
        bookLinks: [SM_SANXING],
    },
    {
        title: '六冲',
        subtitle: '子午 · 丑未 · 寅申 · 卯酉 · 辰戌 · 巳亥',
        aliases: ['冲', '相冲', '地支相冲', '地支六冲'],
        nature: 'inauspicious',
        summary: '相隔六位、方位相对的两支相冲，主动荡、分离、变动。冲到用神尤其破格，冲去忌神反而为福。',
        focusHint: '先看冲的是喜是忌，再看有无三合、六合来解',
        rule: '子午冲、丑未冲、寅申冲、卯酉冲、辰戌冲、巳亥冲。',
        notes: [
            { label: '可解', tone: 'favorable', content: '三合、六合可以解冲（《子平真诠·论刑冲会合解法》）。' },
        ],
        citations: [
            {
                source: '《子平真诠·论刑冲会合解法》',
                original: '冲者，六冲也，子午卯酉之类是也……八字支中，刑冲俱非美事，而三合六合，可以解之。',
                translation: '冲就是六冲，像子午、卯酉这类。八字地支里，刑和冲都不是好事，但三合、六合可以化解。',
                bookLink: ZP_XINGCHONG,
            },
        ],
        bookLinks: [ZP_XINGCHONG],
    },
    {
        title: '三刑',
        subtitle: '子卯 · 寅巳申 · 丑未戌',
        aliases: ['刑', '相刑', '无礼之刑', '无恩之刑', '恃势之刑'],
        nature: 'inauspicious',
        summary: '子卯相刑为无礼之刑，寅巳申为无恩之刑，丑未戌为恃势之刑，主刑伤、是非与不和。',
        focusHint: '三字全见力重，只见两字力轻；有合可解',
        rule: '子刑卯、卯刑子（无礼之刑）；寅刑巳、巳刑申、申刑寅（无恩之刑）；丑刑戌、戌刑未、未刑丑（恃势之刑）。',
        citations: [
            {
                source: '《三命通会·论三刑》',
                original: '子卯一刑也，寅巳申二刑也，丑未戌三刑也。',
                translation: '子卯是一种刑，寅巳申是第二种，丑未戌是第三种。',
                bookLink: SM_SANXING,
            },
        ],
        bookLinks: [SM_SANXING, ZP_XINGCHONG],
    },
    {
        title: '自刑',
        subtitle: '辰辰 · 午午 · 酉酉 · 亥亥',
        aliases: [],
        nature: 'inauspicious',
        summary: '辰、午、酉、亥四支见同一支为自刑，主自我纠结、自招烦扰。',
        focusHint: '自刑多应在心性与自身作为上',
        rule: '辰见辰、午见午、酉见酉、亥见亥为自刑。',
        citations: [
            {
                source: '《三命通会·论三刑》',
                original: '如申子辰三合加寅卯辰三位，则申刑寅，子刑卯，辰见辰自刑。',
                translation: '比如申子辰三合遇上寅卯辰三支：申刑寅，子刑卯，辰见辰就是自刑。',
                bookLink: SM_SANXING,
            },
        ],
        bookLinks: [SM_SANXING],
    },
    {
        title: '六害',
        subtitle: '子未 · 丑午 · 寅巳 · 卯辰 · 申亥 · 酉戌',
        aliases: ['害', '相害', '六穿', '穿'],
        nature: 'inauspicious',
        summary: '六害又称六穿。害是合我所冲之神：子怕午冲，未却去合午，所以子未相害。主暗损与六亲不睦。',
        focusHint: '害多应在人情与暗处的损耗',
        rule: '子未害、丑午害、寅巳害、卯辰害、申亥害、酉戌害。',
        citations: [
            {
                source: '《三命通会·论六害》',
                original: '六害者，十二支凌战之辰也……如子生人畏午冲，而未却去合午……所以皆为害也。',
                translation: '六害是十二地支彼此欺凌争战的组合。比如子年生人怕午来冲，未却去合午，所以子与未相害。',
                bookLink: SM_LIUHAI,
            },
        ],
        bookLinks: [SM_LIUHAI],
    },
    {
        title: '相破',
        subtitle: '子酉 · 卯午 · 辰丑 · 未戌 · 寅亥 · 巳申',
        aliases: ['破', '六破'],
        nature: 'inauspicious',
        summary: '两支相破，主耗散、折损，力量比冲、刑轻。',
        focusHint: '破多作轻微的耗损看，不宜单凭一破论凶',
        rule: '子酉破、卯午破、辰丑破、未戌破、寅亥破、巳申破。古法里寅亥、巳申同时相合，不取为破。',
        citations: [
            {
                source: '《三命通会·总论诸神煞》',
                original: '破煞：此煞卯与午、丑与辰、子与酉、未与戌皆相破，惟寅申巳亥原破却三合，故不取。犯者主少年灾滞，财产耗散，兼身有折伤之灾。',
                translation: '破煞：卯午、丑辰、子酉、未戌相破；寅、申、巳、亥之间虽破却又相合，所以不取。犯了主少年多阻滞、财产耗散，身体也有折伤之灾。',
                bookLink: SM_SHENSHA,
            },
        ],
        bookLinks: [SM_SHENSHA],
    },
    {
        title: '伏吟',
        subtitle: '两柱干支完全相同',
        aliases: [],
        nature: 'inauspicious',
        summary: '大运、流年与命局某柱（古法多看日柱）干支完全相同，叫伏吟，古称「岁运压日」。主事情反复、心中郁闷。',
        focusHint: '伏吟日柱最重，多应在自身与配偶',
        rule: '两柱天干相同、地支也相同，如甲子见甲子。',
        citations: [
            {
                source: '《三命通会·总论岁运》',
                original: '若岁运与日相对，谓之返吟；岁运压日，谓之伏吟。二者不利六亲，非横破财，不为吉兆。',
                translation: '岁运与日柱相对冲叫返吟，与日柱相同叫伏吟。两者都不利六亲，多有意外破财，不是吉兆。',
                bookLink: SM_SUIYUN,
            },
        ],
        bookLinks: [SM_SUIYUN],
    },
    {
        title: '反吟',
        subtitle: '天克地冲',
        aliases: ['返吟', '天克地冲'],
        nature: 'inauspicious',
        summary: '大运、流年与命局某柱天干相克、地支相冲，叫反吟，古作返吟，即「岁运与日相对」。主变动、冲突。',
        focusHint: '反吟日柱最重，多应在自身与配偶',
        rule: '两柱天干相克、地支相冲，如甲子见庚午。',
        citations: [
            {
                source: '《三命通会·总论岁运》',
                original: '若岁运与日相对，谓之返吟；岁运压日，谓之伏吟。二者不利六亲，非横破财，不为吉兆。',
                translation: '岁运与日柱相对冲叫返吟，与日柱相同叫伏吟。两者都不利六亲，多有意外破财，不是吉兆。',
                bookLink: SM_SUIYUN,
            },
        ],
        bookLinks: [SM_SUIYUN],
    },
    {
        title: '自合',
        subtitle: '天干与本柱地支藏干相合',
        aliases: ['干支自合'],
        nature: 'neutral',
        summary: '同一柱里，天干与坐下地支所藏之干构成天干五合，如辛巳（巳中藏丙，丙辛合）、壬午（午中藏丁，丁壬合）。主本柱气机内聚、暗中相牵。',
        focusHint: '自合能牵住本柱力量，合留喜用为得，合绊忌神亦减其害',
        rule: '本盘取六柱：甲午（甲己合）、壬午（丁壬合）、丁亥（丁壬合）、戊子（戊癸合）、辛巳（丙辛合）、癸巳（戊癸合）。',
        notes: [
            { label: '口径', content: '各家取数略异，本盘取最常用的六柱；另有派别兼取丙戌、己亥、乙巳等柱。' },
            { label: '与暗合之别', content: '暗合是两地支之间的藏干相合，自合则是同一柱天干与本支藏干相合。' },
        ],
        bookLinks: [SM_GANHE, ZP_HEBUHE],
    },
    {
        title: '盖头',
        subtitle: '天干克地支',
        aliases: [],
        nature: 'neutral',
        summary: '一柱之中天干克地支，叫盖头：地支的力量被头上的天干压住，发不出来。',
        focusHint: '喜神被盖头则减力，忌神被盖头反而为福',
        rule: '同一柱里天干五行克地支五行，如甲辰（木克土）、庚寅（金克木）。',
        citations: [
            {
                source: '《神峰通考·盖头说》',
                original: '大抵人之八字，类如此。八字中上四个字是头也，下地支四字是肚腹四肢也。',
                translation: '人的八字大体像一个人：上面四个天干是头，下面四个地支是肚腹四肢。',
                bookLink: SF_GAITOU,
            },
            {
                source: '《神峰通考·盖头说》',
                original: '凡有所害之物，露出头面，便是动物，就能作害。',
                translation: '凡是有害的东西，一旦露在天干上，就会起作用、造成妨害。',
                bookLink: SF_GAITOU,
            },
        ],
        bookLinks: [SF_GAITOU],
    },
    {
        title: '截脚',
        subtitle: '地支克天干',
        aliases: [],
        nature: 'neutral',
        summary: '一柱之中地支克天干，叫截脚：天干的根基被脚下地支截断，有名无力。',
        focusHint: '喜神被截脚则虚浮，忌神被截脚反而无害',
        rule: '同一柱里地支五行克天干五行，如甲申（金克木）、丙子（水克火）。',
        bookLinks: [SF_GAITOU],
    },
];

export const BAZI_RELATION_GLOSSARY: GlossaryEntry[] = SEEDS.map((seed) => ({
    id: `relation:${seed.title}`,
    category: 'bazi-relation',
    categoryLabel: '干支关系',
    title: seed.title,
    subtitle: seed.subtitle,
    aliases: seed.aliases,
    nature: seed.nature,
    summary: seed.summary,
    focusHint: seed.focusHint,
    blocks: [
        { heading: '查法', paragraphs: [seed.rule] },
        ...(seed.notes ? [{ heading: '要点', items: seed.notes }] : []),
    ],
    citations: seed.citations ?? [],
    bookLinks: seed.bookLinks,
}));

/** 校验脚本与页面接入共用：每个关系标签都要有词条 */
export const BAZI_RELATION_TERMS = SEEDS.map((seed) => seed.title);

/** 关系引擎的 kind 对应到词条名（单字标签「冲」「合」不够分辨干支，要按 kind 取） */
export const RELATION_KIND_TERM: Record<string, string> = {
    stem_clash: '天干相冲',
    stem_control: '天干相克',
    stem_five_combination: '天干五合',
    branch_six_combination: '六合',
    branch_three_combination: '三合',
    branch_half_combination: '半合',
    branch_three_meeting: '三会',
    branch_hidden_combination: '暗合',
    branch_hidden_sandwich: '拱合',
    branch_sandwich: '拱合',
    branch_punishment: '三刑',
    branch_self_punishment: '自刑',
    branch_clash: '六冲',
    branch_break: '相破',
    branch_harm: '六害',
    pillar_repeating: '伏吟',
    pillar_opposing: '反吟',
    pillar_self_combination: '自合',
    pillar_cover: '盖头',
    pillar_cut: '截脚',
};
