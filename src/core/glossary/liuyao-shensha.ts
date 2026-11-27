import type { GlossaryClassicBookLink, GlossaryClassicCitation, GlossaryDetailBlock, GlossaryEntry } from './types';

/**
 * 六爻细批里的神煞（src/core/shen-sha.ts）。按占卦日的干支查，和八字按四柱查不是一回事，所以单独成条。
 * 查法逐格与 getShenSha 比对（scripts/check-glossary.cjs）。
 */

const ZS_XINGSHA: GlossaryClassicBookLink = { bookId: 'zengshanbuyi', bookTitle: '增删卜易', chapterId: 'zengshanbuyi-038', chapterTitle: '两现章第三十二（一）', label: '星煞章（两现章内）' };
const BS_GEJUE: GlossaryClassicBookLink = { bookId: 'bushizhengzong', bookTitle: '卜筮正宗', chapterId: 'bushizhengzong-003', chapterTitle: '今以甲乙丙丁日附载为式余仿此', label: '禄马贵人等歌诀' };
const BS_DUI: GlossaryClassicBookLink = { bookId: 'bushizhengzong', bookTitle: '卜筮正宗', chapterId: 'bushizhengzong-011', chapterTitle: '兑宫属金', label: '辟神煞之谬（兑宫篇内）' };
const BS_HUNYIN: GlossaryClassicBookLink = { bookId: 'bushizhengzong', bookTitle: '卜筮正宗', chapterId: 'bushizhengzong-016', chapterTitle: '婚姻' };
const BS_FENMU: GlossaryClassicBookLink = { bookId: 'bushizhengzong', bookTitle: '卜筮正宗', chapterId: 'bushizhengzong-018', chapterTitle: '坟墓' };

const VIEW: GlossaryDetailBlock = {
    heading: '看法',
    paragraphs: ['六爻神煞只作参考：《增删卜易》作者四十余年只验得贵人、禄神、驿马、天喜，且说神煞不能独操祸福之权——用神旺相见之更吉，用神失陷虽有如无。'],
};

const XINGSHA: GlossaryClassicCitation = {
    source: '《增删卜易·星煞章》',
    original: '诸书星煞最多，余留心四十余载独验贵人禄神驿马天喜，然不能独操祸福之权，用神旺者见之愈吉，用神失陷虽有如无。',
    translation: '各书所列星煞极多，作者留心四十多年，只验得贵人、禄神、驿马、天喜；而且它们不能单独决定祸福，用神旺相见之更吉，用神失陷则有也等于没有。',
    bookLink: ZS_XINGSHA,
};

const star = (
    title: string,
    aliases: string[],
    subtitle: string,
    summary: string,
    focusHint: string,
    rule: string,
    extra: GlossaryDetailBlock[],
    citations: GlossaryClassicCitation[],
    bookLinks: GlossaryClassicBookLink[],
): GlossaryEntry => ({
    id: `liuyao-shensha:${title}`,
    category: 'liuyao-shensha',
    categoryLabel: '神煞',
    title,
    subtitle,
    aliases,
    nature: 'neutral',
    summary,
    focusHint,
    blocks: [{ heading: '查法', paragraphs: [rule] }, ...extra, VIEW],
    citations: [...citations, XINGSHA],
    bookLinks,
});

export const LIUYAO_SHENSHA_GLOSSARY: GlossaryEntry[] = [
    star(
        '驿马', ['马星'], '以日支查 · 主动、远行',
        '驿马主奔走、远行、迁动。按占卦日支所属三合局查：马临用神而用神旺，出行、迁动、求事多利；马临忌神发动，主奔波劳碌。',
        '占出行、行人、迁移时参看',
        '申子辰日见寅，寅午戌日见申，巳酉丑日见亥，亥卯未日见巳。',
        [],
        [
            {
                source: '《增删卜易·星煞章》',
                original: '申子辰马到寅 巳酉丑马在亥 寅午戌马居申 亥卯未马在巳 假令子日申日辰日占卦爻中见寅即为马余仿此',
                translation: '申子辰日马在寅，巳酉丑日马在亥，寅午戌日马在申，亥卯未日马在巳。比如子、申、辰日占卦，爻中见寅就是驿马。',
                bookLink: ZS_XINGSHA,
            },
        ],
        [ZS_XINGSHA, BS_GEJUE],
    ),
    star(
        '天乙贵人', ['天乙', '贵人', '太乙贵人'], '以日干查 · 主贵人扶助',
        '天乙贵人主逢凶得助、遇贵人提携。按占卦日干查，临用神或生合世爻而旺相，求谋多得人相助。',
        '谒贵、求官、诉讼时参看',
        '甲戊日见丑未，乙己日见子申，丙丁日见亥酉，壬癸日见卯巳，庚辛日见午寅。',
        [
            {
                heading: '流派',
                paragraphs: ['庚日贵人有两说：「庚辛逢马虎」取午寅，「甲戊庚牛羊」取丑未。本页与八字页都按前一说。'],
            },
        ],
        [
            {
                source: '《增删卜易·星煞章》',
                original: '甲戊兼牛羊 乙己鼠猴乡 丙丁猪鸡位 壬癸兔蛇藏 庚辛逢马虎 此是贵人方',
                translation: '甲戊日贵人在丑未，乙己日在子申，丙丁日在亥酉，壬癸日在卯巳，庚辛日在午寅。',
                bookLink: ZS_XINGSHA,
            },
            {
                source: '《卜筮正宗·贵人歌诀》',
                original: '甲戊（庚）兼牛羊，乙己鼠猴乡，丙丁猪鸡位，壬癸兔蛇藏，六辛逢马虎，此是贵人方．',
                translation: '这一本把庚归入丑未，只有辛日在午寅，是另一说。',
                bookLink: BS_GEJUE,
            },
        ],
        [ZS_XINGSHA, BS_GEJUE],
    ),
    star(
        '禄神', ['禄', '日禄'], '以日干查 · 主俸禄、衣食',
        '禄神是日干的临官之位，主俸禄、衣食与财源。临用神或持世而旺，衣食有靠；逢空破则禄薄。',
        '占财、占官、占身命时参看',
        '甲日见寅，乙日见卯，丙戊日见巳，丁己日见午，庚日见申，辛日见酉，壬日见亥，癸日见子。',
        [],
        [
            {
                source: '《卜筮正宗·禄马羊刃歌》',
                original: '甲禄在寅乙禄卯，丙戊在巳丁己午，庚禄在申辛禄酉，壬禄在亥癸禄子。',
                translation: '甲禄在寅，乙禄在卯，丙戊禄在巳，丁己禄在午，庚禄在申，辛禄在酉，壬禄在亥，癸禄在子。',
                bookLink: BS_GEJUE,
            },
        ],
        [ZS_XINGSHA, BS_GEJUE],
    ),
    star(
        '羊刃', ['阳刃', '刃'], '以日干查 · 主刚暴、损伤',
        '羊刃紧挨禄神的下一位（如甲禄在寅、刃在卯），刚而易过，主争斗、损伤、破财。临忌神发动克世，防血光口角；临用神而用神弱，反得其助。',
        '占病、占讼、占出行时留意',
        '甲日见卯，乙日见辰，丙戊日见午，丁己日见未，庚日见酉，辛日见戌，壬日见子，癸日见丑。',
        [
            {
                heading: '流派',
                paragraphs: ['阴干的刃有两说：一说在禄的下一位，乙见辰、丁己见未、辛见戌、癸见丑，六爻这里用它；一说在禄的上一位，乙见寅、丁己见巳、辛见申、癸见亥，八字页用它。'],
            },
        ],
        [
            {
                source: '通行口诀',
                original: '甲刃在卯，乙刃在辰，丙戊刃在午，丁己刃在未，庚刃在酉，辛刃在戌，壬刃在子，癸刃在丑。',
                translation: '各日干的羊刃都在禄神的下一位。',
            },
        ],
        [ZS_XINGSHA],
    ),
    star(
        '文昌', ['文昌贵人'], '以日干查 · 主文书、学业',
        '文昌主文书、考试、学业与聪明。临父母或官鬼而旺相，占考试、文书较利。',
        '占考试、文书时参看',
        '甲日见巳，乙日见午，丙戊日见申，丁己日见酉，庚日见亥，辛日见子，壬日见寅，癸日见卯。',
        [],
        [
            {
                source: '通行口诀',
                original: '甲乙巳午报君知，丙戊申宫丁己鸡，庚猪辛鼠壬逢虎，癸人见卯入云梯。',
                translation: '甲日在巳，乙日在午，丙戊日在申，丁己日在酉，庚日在亥，辛日在子，壬日在寅，癸日在卯。',
            },
        ],
        [ZS_XINGSHA],
    ),
    star(
        '将星', ['将星煞'], '以日支查 · 主权柄',
        '将星是日支三合局的中神，主权柄、威望与统领。临世爻、官鬼而旺，占功名、掌事较利。',
        '占功名、掌权时参看',
        '申子辰日见子，寅午戌日见午，巳酉丑日见酉，亥卯未日见卯。',
        [],
        [
            {
                source: '通行口诀',
                original: '寅午戌见午，申子辰见子，巳酉丑见酉，亥卯未见卯。',
                translation: '三合局的中间一字即是将星。',
            },
        ],
        [ZS_XINGSHA],
    ),
    star(
        '华盖', ['华盖星'], '以日支查 · 主孤高、僧道艺术',
        '华盖是日支三合局的墓库，主孤高、清静，近于宗教、玄学与艺术。临世爻多主性情清高、喜独处。',
        '占身命、占僧道艺术时参看',
        '申子辰日见辰，寅午戌日见戌，巳酉丑日见丑，亥卯未日见未。',
        [],
        [
            {
                source: '《卜筮正宗·坟墓》',
                original: '青龙临华盖之空亡，非僧则道',
                translation: '青龙临华盖又逢空亡，墓主不是僧人便是道士。',
                bookLink: BS_FENMU,
            },
        ],
        [ZS_XINGSHA, BS_FENMU],
    ),
    star(
        '桃花', ['咸池'], '以日支查 · 主情缘、酒色',
        '桃花又名咸池，主情缘、人缘与酒色。临妻财或官鬼而动，多主感情之事；与玄武同见，防私情暗昧。',
        '占婚姻、人缘时参看',
        '申子辰日见酉，寅午戌日见卯，巳酉丑日见午，亥卯未日见子。',
        [],
        [
            {
                source: '《卜筮正宗·坟墓》',
                original: '玄武遇咸池之劫煞，既盗且娼',
                translation: '玄武遇咸池又带劫煞，主既有盗贼之事，又有淫乱之事。',
                bookLink: BS_FENMU,
            },
        ],
        [ZS_XINGSHA, BS_FENMU],
    ),
    star(
        '劫煞', ['劫杀'], '以日支查 · 主劫夺、破耗',
        '劫煞主劫夺、破耗与意外之失。旧说求财忌劫煞，临兄弟发动尤甚；但仍以生克制化为主。',
        '占财物、出行时留意',
        '申子辰日见巳，寅午戌日见亥，巳酉丑日见寅，亥卯未日见申。',
        [],
        [
            {
                source: '《卜筮正宗·辟卜筮全书神煞之谬》',
                original: '如出行忌往亡；疾病忌丧车、沐浴、哭声、等煞，医药看天医，求财忌劫煞……至明刘伯温先生作千金赋云：自古神煞之多端，何如生克制化之一理',
                translation: '旧书以神煞断卦：出行忌往亡，疾病忌丧车、哭声，求财忌劫煞……到明代刘伯温作《千金赋》说：神煞再多，也不如生克制化一个道理。',
                bookLink: BS_DUI,
            },
            {
                source: '《卜筮正宗·婚姻》',
                original: '岁君逢劫煞，一年生意无聊',
                translation: '太岁爻带劫煞，一年生意冷淡。',
                bookLink: BS_HUNYIN,
            },
        ],
        [BS_DUI, ZS_XINGSHA],
    ),
    star(
        '灾煞', ['灾杀', '白虎煞'], '以日支查 · 主灾殃、疾病',
        '灾煞在劫煞之后一位，冲三合局的中神，主灾殃、疾病与血光。临官鬼发动克世，防病灾。',
        '占病、占安危时留意',
        '申子辰日见午，寅午戌日见子，巳酉丑日见卯，亥卯未日见酉。',
        [],
        [
            {
                source: '通行口诀',
                original: '申子辰在午，寅午戌在子，巳酉丑在卯，亥卯未在酉。',
                translation: '三合局中神所冲之位即是灾煞。',
            },
        ],
        [ZS_XINGSHA],
    ),
];
