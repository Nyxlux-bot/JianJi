import type { GlossaryClassicBookLink, GlossaryDetailBlock, GlossaryEntry } from './types';

/**
 * 六爻卦盘上的名目：六亲、六神、世应、动变、伏神、用神，以及细批里的月将。
 * 原文核自站内《增删卜易》《卜筮正宗》《火珠林》。
 */

const ZS = (n: string, chapterTitle: string): GlossaryClassicBookLink => ({ bookId: 'zengshanbuyi', bookTitle: '增删卜易', chapterId: `zengshanbuyi-${n}`, chapterTitle });
const BS = (n: string, chapterTitle: string): GlossaryClassicBookLink => ({ bookId: 'bushizhengzong', bookTitle: '卜筮正宗', chapterId: `bushizhengzong-${n}`, chapterTitle });
const HZ = (n: string, chapterTitle: string): GlossaryClassicBookLink => ({ bookId: 'huozhulin', bookTitle: '火珠林', chapterId: `huozhulin-${n}`, chapterTitle });

const ZS_SHIYING = ZS('007', '世应章第六');
const ZS_DONGBIAN = ZS('008', '动变章第七');
const ZS_YONGSHEN = ZS('009', '用神章第八');
const ZS_YUANJI = ZS('010', '用神元神、忌神、仇神章第九');
const ZS_YUANJI_SW = ZS('011', '元神忌神衰旺章第十');
const ZS_BIAN_SK = ZS('016', '动变生克冲合章第十五');
const ZS_YUEJIANG = ZS('018', '月将章第十六');
const ZS_LIUSHEN = ZS('020', '六神章第十八');
const ZS_GUABIAN = ZS('026', '卦变生克墓绝章第二十四');
const ZS_FEIFU = ZS('034', '飞伏神章第二十八');
const ZS_DUFA = ZS('037', '独发章第三十一');
/** 第三十八篇里收了《黄金策千金赋》增删本 */
const ZS_HUANGJIN = { ...ZS('038', '两现章第三十二（一）'), label: '黄金策千金赋（两现章内）' };
const BS_WENDA = BS('002', '十八问答');
const BS_GEJUE = { ...BS('003', '今以甲乙丙丁日附载为式余仿此'), label: '六兽歌等歌诀' };
const HZ_SHIYING = HZ('005', '世应相克');
const HZ_FUCANG = HZ('007', '出现伏藏');

/* ---------------- 六亲 ---------------- */

const LIUQIN_BASIS: GlossaryDetailBlock = {
    heading: '装法',
    paragraphs: ['以卦所属本宫的五行为「我」：生我者父母，我生者子孙，克我者官鬼，我克者妻财，比和者兄弟。变出之爻的六亲仍按本卦之宫来定。'],
};

const LIUQIN_CITATION = {
    source: '《卜筮正宗·十八问答》',
    original: '生我者为父母，我生者为子孙，克我者为官鬼，我克者为妻财．比和者为兄弟．',
    translation: '生我的是父母，我生的是子孙，克我的是官鬼，我克的是妻财，与我同五行的是兄弟。',
    bookLink: BS_WENDA,
};

const liuqin = (
    title: string,
    subtitle: string,
    summary: string,
    focusHint: string,
    items: Array<[string, string]>,
    original: string,
    translation: string,
): GlossaryEntry => ({
    id: `liuyao-liuqin:${title}`,
    category: 'liuyao-liuqin',
    categoryLabel: '六亲',
    title,
    subtitle,
    nature: 'neutral',
    summary,
    focusHint,
    blocks: [{ heading: '所主', items: items.map(([label, content]) => ({ label, content })) }, LIUQIN_BASIS],
    citations: [
        { source: '《增删卜易·用神章》', original, translation, bookLink: ZS_YONGSHEN },
        LIUQIN_CITATION,
    ],
    bookLinks: [ZS_YONGSHEN, BS_WENDA],
});

export const LIUYAO_LIUQIN_GLOSSARY: GlossaryEntry[] = [
    liuqin(
        '父母', '生我者 · 庇护之神',
        '生我者为父母。占父母长辈、师长，占房屋、车船、衣服、文书契约，都以父母爻为用神——凡是庇护自身的都归父母。',
        '父母发动克子孙，占子女、医药忌之',
        [['人', '父母、祖父母、伯叔姑姨、师长、岳父母等长辈。'], ['物', '天地、城池、房屋、舟车、衣服、雨具、布匹、文书、契约。']],
        '父母爻：占父母即以卦中之父母爻为神。……占天地、城池、墙垣，宅舍、屋宇，舟车、衣服、雨具、绸缎，布匹、章奏、文书及书馆文契也以父母爻为用神，物类亦多在变通，一切庇护我身者是也。',
        '占父母就以卦中父母爻为用神。占天地、城池、房屋、车船、衣服、雨具、布匹、奏章、文书契约也取父母爻，凡是庇护自身的都归它。',
    ),
    liuqin(
        '兄弟', '比和者 · 劫财之神',
        '与本宫五行相同者为兄弟。占兄弟姐妹、同辈朋友用之；占财时兄弟是劫财之神，占谋事是阻碍之神。',
        '兄弟发动克妻财，求财最忌',
        [['人', '兄弟姐妹、族中同辈、结拜兄弟。'], ['事', '占财为劫神，占谋事为阻神，占妻妾为刑伤之神。']],
        '兄弟爻：占兄弟、姐妹、族中兄弟、姑姨、妹夫及结拜兄弟都以兄弟爻为用神。兄弟乃同类之人，彼得志则欺凌，见财则夺，所以占财物以此为劫神，占谋事以此为阻神、占妻妾、婢仆以此为刑伤克害之神。',
        '占兄弟姐妹、族中同辈、结拜兄弟都以兄弟爻为用神。兄弟是同类之人，得志便欺凌，见财便争夺，所以占财物时它是劫财之神，占谋事是阻碍之神，占妻妾是刑伤之神。',
    ),
    liuqin(
        '官鬼', '克我者 · 拘束之神',
        '克我者为官鬼。占功名、官府、丈夫（妻占夫）用之；占病为病症、占盗为贼——凡拘束自身的都归官鬼。',
        '官鬼持世，占功名为喜，占病讼为忧',
        [['人', '官长、丈夫、贼盗。'], ['事', '功名、官府、雷霆鬼神、邪祟。']],
        '官鬼爻：占功名、官府、雷霆鬼神、妻占夫皆以官鬼爻为用神。占乱臣贼盗、邪崇也以官鬼爻为用神，物类亦多，一切拘束我身者是也',
        '占功名、官府、雷霆鬼神、妻子占丈夫，都以官鬼爻为用神。占乱臣贼盗、邪祟也取官鬼，凡是拘束自身的都归它。',
    ),
    liuqin(
        '妻财', '我克者 · 财物与妻',
        '我克者为妻财。占妻妾、受我驱使之人，占货财、珠宝、仓库等一切财物，都看妻财爻。',
        '妻财发动克父母，占父母、文书忌之',
        [['人', '妻妾、婢仆、受我驱使之人。'], ['物', '货财、珠宝、仓库、一切使用之物。']],
        '占妻妾、婢、仆、役，我驱使之人……占货财、珠宝、仓库一切使用之财物亦以妻财爻为用神',
        '占妻妾、婢仆、受我驱使的人，占货财、珠宝、仓库等一切财物，都以妻财爻为用神。',
    ),
    liuqin(
        '子孙', '我生者 · 福德之神',
        '我生者为子孙。占子女晚辈、医药、僧道、六畜都看子孙。子孙是福德之神，能制官鬼、解忧愁，诸事见之为喜，唯独占功名忌它。',
        '子孙持世，忧疑可解；占功名最忌子孙发动',
        [['人', '子女、女婿、侄甥、门生、晚辈；忠臣良将、医生、僧道。'], ['物', '医药、六畜、禽兽。']],
        '子孙爻；占子孙、占女、女婿、侄、甥、门生凡在我子孙辈中皆以子孙爻为用神。……子孙福德之神。为制鬼之神、为解忧之神、为剥官之神，诸事见之为喜，独占功名者忌之。',
        '占子女、女婿、侄甥、门生等晚辈都以子孙爻为用神。子孙是福德之神，能制鬼、解忧，也能剥官，诸事见之为喜，唯独占功名忌它。',
    ),
];

/* ---------------- 六神 ---------------- */

const LIUSHEN_VIEW: GlossaryDetailBlock = {
    heading: '看法',
    paragraphs: ['六神是附合之神：卦吉逢青龙更吉，卦凶逢白虎更凶，不能离开用神旺衰单凭六神论吉凶。'],
};

const LIUSHEN_CITATION = {
    source: '《增删卜易·六神章》',
    original: '虎兴而遇吉神不害其吉，龙动而逢凶曜难掩其凶。此正理也……乃附合之神也，卦之吉者逢龙而更吉，卦之凶者逢白虎而更凶',
    translation: '白虎发动遇吉神，不妨其吉；青龙发动逢凶神，掩不住其凶。六神只是附合之神：卦吉逢青龙更吉，卦凶逢白虎更凶。',
    bookLink: ZS_LIUSHEN,
};

const liushen = (
    title: string,
    days: string,
    subtitle: string,
    summary: string,
    focusHint: string,
    source: string,
    original: string,
    translation: string,
    bookLink: GlossaryClassicBookLink,
): GlossaryEntry => ({
    id: `liuyao-liushen:${title}`,
    category: 'liuyao-liushen',
    categoryLabel: '六神',
    title,
    subtitle,
    nature: 'neutral',
    summary,
    focusHint,
    blocks: [
        { heading: '起法', paragraphs: [`${days}日起于初爻，依青龙、朱雀、勾陈、螣蛇、白虎、玄武的次序往上排。`] },
        LIUSHEN_VIEW,
    ],
    citations: [{ source, original, translation, bookLink }, LIUSHEN_CITATION],
    bookLinks: [ZS_LIUSHEN, BS_GEJUE],
});

export const LIUYAO_LIUSHEN_GLOSSARY: GlossaryEntry[] = [
    liushen(
        '青龙', '甲乙', '喜庆 · 酒色',
        '六神之首，主喜庆、财禄。临用神而用神旺，进财进禄；临忌神仇神则无益，也主酒色之灾。',
        '青龙附用神才吉，附忌神不吉',
        '《卜筮正宗·六兽歌断》',
        '发动青龙附用通，进财进禄福无穷，临仇遇忌都无益，酒色成灾在此中．',
        '青龙发动依附用神，进财进禄；临仇神、忌神则毫无益处，酒色成灾也出在它身上。',
        BS_GEJUE,
    ),
    liushen(
        '朱雀', '丙丁', '文书 · 口舌',
        '主文书、信息与口舌是非。朱雀发动生身，利于公事文书；与煞神同动，多是非口舌、徒劳无功。',
        '朱雀动看文书与口舌',
        '《卜筮正宗·六兽歌断》',
        '朱雀交重文印旺，煞神相并漫劳功，是非口舌皆因此，动出生身却利公．',
        '朱雀发动，文书印信旺；与煞神并见则徒劳无功，是非口舌也因它而起；动而生身，反利于公事。',
        BS_GEJUE,
    ),
    liushen(
        '勾陈', '戊', '田土 · 迟滞',
        '主田土、房产与迟滞纠缠。勾陈发动多忧田土之事，为忌神时连年不顺；生用神有情才吉，安静则无妨。',
        '勾陈动看田土与拖延',
        '《卜筮正宗·六兽歌断》',
        '勾陈发动忧田土，累岁迍邅为忌逢，生用有情方是吉，若然安静不迷蒙．',
        '勾陈发动，忧在田土；为忌神则连年困顿；生用神有情才吉，安静则不致昏昧。',
        BS_GEJUE,
    ),
    liushen(
        '螣蛇', '己', '惊恐 · 怪异',
        '主虚惊、怪梦、缠绕不明之事。螣蛇发动多夜梦惊恐、心神不宁。',
        '螣蛇动看惊扰与疑虑',
        '《火珠林·附六神》',
        '螣蛇：夜梦、惊恐、上许下保福。',
        '螣蛇主夜梦、惊恐，以及许愿求福之事。',
        HZ('038', '附：六神'),
    ),
    liushen(
        '白虎', '庚辛', '凶丧 · 官病',
        '主凶丧、官司、病患与刀伤。白虎发动临金克人口，须防伤损；遇火爻生身，则不作凶论。',
        '白虎动而克用，防丧病官非',
        '《卜筮正宗·六兽歌断》',
        '白虎交重丧恶事，官司病患必成凶，持金动克妨人口，遇火生身便不同．',
        '白虎发动主丧事恶事，官司、病患多凶；临金爻动而克，妨害人口；遇火爻生身，便不同论。',
        BS_GEJUE,
    ),
    liushen(
        '玄武', '壬癸', '暗昧 · 盗贼',
        '主暗昧、私情与盗贼。玄武发动多暗中之事，临官鬼防贼盗；生合世爻有情则无犯，临仇神忌神主奸盗之凶。',
        '玄武动防暗昧与失窃',
        '《卜筮正宗·六兽歌断》',
        '玄武动摇多暗昧，若临官鬼贼交攻，有情生世邪无犯，仇忌临之奸盗凶．',
        '玄武发动多暗昧之事；临官鬼则贼盗交攻；有情生世则邪不能犯；临仇神、忌神，主奸盗之凶。',
        BS_GEJUE,
    ),
];

/* ---------------- 世应、动变、伏神、用神、月将 ---------------- */

export const LIUYAO_YAO_GLOSSARY: GlossaryEntry[] = [
    {
        id: 'liuyao-yao:世',
        category: 'liuyao-yao',
        categoryLabel: '世应',
        title: '世爻',
        subtitle: '自己 · 本人之位',
        aliases: ['世', '持世'],
        nature: 'neutral',
        summary: '世爻代表占卦的人自己。自占看世爻：旺相，或临日月、得日月动爻生扶，诸事多吉；空破休囚、受冲克，诸事难成。',
        focusHint: '世应相生相合为美；世空则自己心意不实',
        blocks: [
            {
                heading: '安世',
                paragraphs: ['八纯卦世在上爻；一世至五世卦，世在初爻至五爻；游魂卦世在四爻，归魂卦世在三爻。应爻与世爻相隔两位。'],
            },
            {
                heading: '世与应',
                items: [
                    { label: '应生世', tone: 'favorable', content: '对方助我。' },
                    { label: '世克应', tone: 'favorable', content: '我能制彼。' },
                    { label: '应克世', tone: 'unfavorable', content: '彼来制我。' },
                    { label: '世生应', content: '我去求人。' },
                ],
            },
        ],
        citations: [
            {
                source: '《增删卜易·世应章》',
                original: '乾为天“世”在六，天风姤“世”在初，天山遁“世”在二，天地否“世”在三，天地观“世”在四，山地剥“世”在五，火地晋“世”在四，火天大有“世”退在三。隔世爻两位即是应爻，余卦仿此。',
                translation: '乾为天世在上爻，姤世在初，遁世在二，否世在三，观世在四，剥世在五，游魂晋世在四，归魂大有世退到三。与世爻隔两位的就是应爻。',
                bookLink: ZS_SHIYING,
            },
            {
                source: '《增删卜易·黄金策千金赋》',
                original: '世为己，应为人，大宜生合。……自占者，宜世爻旺相，或临日月，或日月动爻扶助，或动而化吉，诸占皆吉。',
                translation: '世为自己，应为他人，最宜相生相合。自占时，世爻旺相，或临日月，或得日月动爻扶助，或动而化吉，诸事皆吉。',
                bookLink: ZS_HUANGJIN,
            },
        ],
        bookLinks: [ZS_SHIYING, ZS_HUANGJIN],
    },
    {
        id: 'liuyao-yao:应',
        category: 'liuyao-yao',
        categoryLabel: '世应',
        title: '应爻',
        subtitle: '对方 · 他人之位',
        aliases: ['应'],
        nature: 'neutral',
        summary: '应爻代表对方、他人或所去之地。占彼此之事看世应：应生合世，对方有意助我；应克冲世，对方相背。占他人之事，以应爻为用神。',
        focusHint: '应爻空，对方不实；世应俱空，彼此皆无准实',
        blocks: [
            {
                heading: '看法',
                items: [
                    { label: '应生世', tone: 'favorable', content: '对方助我。' },
                    { label: '应克世', tone: 'unfavorable', content: '彼来制我。' },
                    { label: '应空', content: '他人不实。' },
                    { label: '应动', content: '对方心意多变。' },
                ],
            },
        ],
        citations: [
            {
                source: '《增删卜易·黄金策千金赋》',
                original: '占他人以应爻为用，喜他旺者，宜临旺相之地，又宜日月动爻以生扶……世应俱空，人无准实。世空自己不真，应空他人不实，世应俱空，彼此皆无准实。',
                translation: '占他人以应爻为用神，希望对方好，应爻宜旺相、宜得日月动爻生扶。世应都空，人不可靠：世空自己不真，应空他人不实。',
                bookLink: ZS_HUANGJIN,
            },
            {
                source: '《火珠林·世应相克》',
                original: '世爻乃我家情由，应爻为彼之事理。',
                translation: '世爻是我方的情由，应爻是对方的事理。',
                bookLink: HZ_SHIYING,
            },
        ],
        bookLinks: [ZS_SHIYING, HZ_SHIYING],
    },
    {
        id: 'liuyao-yao:动爻',
        category: 'liuyao-yao',
        categoryLabel: '动变',
        title: '动爻',
        subtitle: '事之始 · 吉凶生于动',
        aliases: ['发动', '独发', '独静', '交重', '老阳', '老阴'],
        nature: 'neutral',
        summary: '摇卦得老阳（○）、老阴（×）的爻为动爻，动则必变。卦中吉凶多由动爻引出：动爻能生克他爻，也受变出之爻回头生克。只有一爻动叫独发，五爻动一爻静叫独静。',
        focusHint: '动爻为事之始，变爻为事之终，最怕变出之爻回头冲克',
        blocks: [
            {
                heading: '看法',
                items: [
                    { label: '生克', content: '动爻即使休囚，也能克旺相的静爻；静爻之间，旺相的能生克休囚的。' },
                    { label: '独发', content: '古人以独发、独静定应期；野鹤认为成败迟速仍看用神，不可舍用神专看独发。' },
                ],
            },
        ],
        citations: [
            {
                source: '《增删卜易·黄金策千金赋》',
                original: '动为始，变为终，最怕交争。动爻为事之始，变爻为事之终，不宜互相冲克。',
                translation: '动爻是事情的开始，变爻是事情的结局，两者最怕互相冲克。',
                bookLink: ZS_HUANGJIN,
            },
            {
                source: '《增删卜易·独发章》',
                original: '五爻俱动，一爻不动，谓之独静；五爻不动，一爻独动，谓之独发。事之成败，由乎用神；应期迟速，亦由乎用神',
                translation: '五爻都动、一爻不动叫独静；五爻不动、一爻独动叫独发。但事情成败、应期迟速，都还是看用神。',
                bookLink: ZS_DUFA,
            },
        ],
        bookLinks: [ZS_DONGBIAN, ZS_DUFA],
    },
    {
        id: 'liuyao-yao:变爻',
        category: 'liuyao-yao',
        categoryLabel: '动变',
        title: '变爻',
        subtitle: '事之终 · 动而所化',
        aliases: ['化出', '变出', '化爻'],
        nature: 'neutral',
        summary: '动爻阴阳翻转后变出的爻叫变爻，代表事情的去向。变爻只回头生克冲合本位的动爻，不生克其他爻；日月则能生克变爻。变爻的六亲仍按本卦之宫来定。',
        focusHint: '回头生为吉，回头克为凶；化进、化退看事势进退',
        blocks: [
            {
                heading: '常见化象',
                items: [
                    { label: '回头', content: '变爻生动爻为回头生，克动爻为回头克。' },
                    { label: '进退', content: '同五行往前一位为化进神，往后一位为化退神。' },
                    { label: '空破', content: '变出之爻落旬空为化空，被月建冲为化破。' },
                ],
            },
        ],
        citations: [
            {
                source: '《增删卜易·动变生克冲合章》',
                original: '卦有动爻，动而必变，夫变出之爻能生克冲合本位之动爻，不能生克他爻，而他爻与本位之动爻，亦不能生克变爻。……日月如天，能生克动爻、静爻、变爻、飞爻、伏爻、而诸爻不能伤日月。',
                translation: '有动爻必有变爻。变爻只能生克冲合本位的动爻，不能生克其他爻；其他爻和本位动爻也不能生克变爻。日月如天，能生克动、静、变、飞、伏各爻，诸爻却伤不了日月。',
                bookLink: ZS_BIAN_SK,
            },
            {
                source: '《增删卜易·动变章》',
                original: '变出之爻按六亲者仍照正卦而推，余卦仿此。',
                translation: '变出之爻配六亲，仍按本卦所属之宫来推。',
                bookLink: ZS_DONGBIAN,
            },
        ],
        bookLinks: [ZS_BIAN_SK, ZS_GUABIAN],
    },
    {
        id: 'liuyao-yao:伏神',
        category: 'liuyao-yao',
        categoryLabel: '飞伏',
        title: '伏神',
        subtitle: '用神不上卦 · 本宫首卦寻之',
        aliases: ['伏', '飞神', '飞伏', '飞伏神'],
        nature: 'neutral',
        summary: '卦中找不到用神时，到本宫首卦（八纯卦）同一爻位找出这一六亲，伏在本卦该爻之下，叫伏神；压在上面的本卦爻叫飞神。伏神得生扶、飞神逢空破，伏神容易透出而有用。',
        focusHint: '先看伏神旺衰，再看飞神生它还是克它',
        blocks: [
            {
                heading: '有用无用',
                items: [
                    { label: '有用', tone: 'favorable', content: '得日月生；本身旺相；得飞神生；得动爻生；日月动爻冲克飞神；飞神空破、休囚、墓绝。' },
                    { label: '难出', tone: 'unfavorable', content: '休囚无气；被日月冲克；被旺相的飞神克；墓绝于日月飞爻；休囚又值空、月破。' },
                ],
            },
        ],
        citations: [
            {
                source: '《增删卜易·飞伏神章》',
                original: '若用神不现，即以日月为用神，倘日月非用神者，则于宫首卦寻之，因本宫首卦，父子财官六亲俱全之故耳……伏神有用者有六：伏神得日月生者一也；伏神旺相者二也；伏神得飞神生者三也；伏神得动爻生者四；伏神得遇日月动爻冲克飞神者五也；伏神得遇飞神空破休囚墓绝者六也。',
                translation: '用神不上卦，先看日月是否为用神；不是，就到本宫首卦去找，因为首卦六亲俱全。伏神有用的情形有六：得日月生，本身旺相，得飞神生，得动爻生，日月动爻冲克飞神，飞神空破休囚墓绝。',
                bookLink: ZS_FEIFU,
            },
            {
                source: '《火珠林·出现伏藏》',
                original: '出现旺相，为久为远；伏藏有气，只利暂时。',
                translation: '用神出现且旺相，主长久；伏藏而有气，只利一时。',
                bookLink: HZ_FUCANG,
            },
        ],
        bookLinks: [ZS_FEIFU, HZ_FUCANG],
    },
    {
        id: 'liuyao-yao:用神',
        category: 'liuyao-yao',
        categoryLabel: '用神',
        title: '用神',
        subtitle: '所占之事落在哪一爻',
        aliases: ['元神', '忌神', '仇神', '用爻', '主事爻'],
        nature: 'neutral',
        summary: '按所问之事取对应的六亲为用神，如问父母取父母爻、问财取妻财爻。生用神的是元神，克用神的是忌神，克元神、生忌神的是仇神。断卦先看用神旺衰，再看元神、忌神的动静。',
        focusHint: '用神旺相有生扶则吉，休囚受克则凶；卦盘右上可切换用神',
        blocks: [
            {
                heading: '四神',
                items: [
                    { label: '用神', content: '所占之事。' },
                    { label: '元神', tone: 'favorable', content: '生用神者，旺相发动则用神有根。' },
                    { label: '忌神', tone: 'unfavorable', content: '克用神者，发动最忌。' },
                    { label: '仇神', tone: 'unfavorable', content: '克元神、生忌神者。' },
                ],
            },
            {
                heading: '取用',
                items: [
                    { label: '自占', content: '以世爻为主。' },
                    { label: '父母', content: '长辈、房屋、文书。' },
                    { label: '官鬼', content: '功名、官府、丈夫、病症。' },
                    { label: '妻财', content: '财物、妻妾。' },
                    { label: '子孙', content: '子女、医药、六畜。' },
                    { label: '兄弟', content: '兄弟朋友。' },
                ],
            },
        ],
        citations: [
            {
                source: '《增删卜易·用神元神忌神仇神章》',
                original: '用神，即前各类之用神也。元神，生用神之神即为元神。忌神克用神之爻也。仇神者克元神而生忌神也。',
                translation: '用神就是按所占之事取的那一爻。生用神的是元神，克用神的是忌神，克元神而生忌神的是仇神。',
                bookLink: ZS_YUANJI,
            },
            {
                source: '《增删卜易·元神忌神衰旺章》',
                original: '元神虽生用神，须要旺相，方可生得用神。',
                translation: '元神虽然生用神，也要自身旺相，才生得动用神。',
                bookLink: ZS_YUANJI_SW,
            },
        ],
        bookLinks: [ZS_YONGSHEN, ZS_YUANJI],
    },
    {
        id: 'liuyao-yao:月将',
        category: 'liuyao-yao',
        categoryLabel: '月将',
        title: '月将',
        subtitle: '太阳过宫 · 按中气换将',
        aliases: ['将'],
        nature: 'neutral',
        summary: '细批里的月将是六壬、奇门所用的月将：太阳每过一个中气换一宫，如雨水后亥将登明、春分后戌将河魁。六爻论旺衰看的是月建，《增删卜易》把月建也叫月将，两者不是一回事。',
        focusHint: '六爻旺衰看月建；这里的月将多用于六壬取用与择时',
        blocks: [
            {
                heading: '十二将',
                paragraphs: ['雨水亥登明，春分戌河魁，谷雨酉从魁，小满申传送，夏至未小吉，大暑午胜光，处暑巳太乙，秋分辰天罡，霜降卯太冲，小雪寅功曹，冬至丑大吉，大寒子神后。'],
            },
        ],
        citations: [
            {
                source: '《增删卜易·月将章》',
                original: '月将即是月建又为月令。掌一月之权，司三旬之令。',
                translation: '《增删卜易》说的月将就是月建，也叫月令，掌管一个月三旬的时令。这与六壬按中气换的月将不同。',
                bookLink: ZS_YUEJIANG,
            },
        ],
        bookLinks: [ZS_YUEJIANG],
    },
];
