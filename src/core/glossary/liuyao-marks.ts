import type { GlossaryClassicBookLink, GlossaryDetailBlock, GlossaryEntry } from './types';

/**
 * 六爻卦盘上的状态标记（src/core/liuyao-status.ts 的 label）与卦型。
 * 原文核自站内《增删卜易》《卜筮正宗》。
 */

const ZS = (n: string, chapterTitle: string): GlossaryClassicBookLink => ({ bookId: 'zengshanbuyi', bookTitle: '增删卜易', chapterId: `zengshanbuyi-${n}`, chapterTitle });

const ZS_YUANJI_SW = ZS('011', '元神忌神衰旺章第十');
const ZS_BIAN_SK = ZS('016', '动变生克冲合章第十五');
const ZS_SISHI = ZS('017', '四时旺相章第又十五');
const ZS_YUEJIANG = ZS('018', '月将章第十六');
const ZS_RICHEN = ZS('019', '日辰章第十七');
const ZS_LIUHE = ZS('021', '六合章第十九');
const ZS_LIUCHONG = ZS('022', '六冲章第二十');
const ZS_ANDONG = ZS('024', '暗动章第二十二');
const ZS_GUABIAN = ZS('026', '卦变生克墓绝章第二十四');
const ZS_XUNKONG = ZS('028', '旬空章第二十六');
const ZS_SWMJ = ZS('029', '生旺墓绝章第又二十六');
const ZS_HUNGUA = ZS('032', '归魂游魂章第又二十六');
const ZS_YUEPO = ZS('033', '月破章第二十七');
const ZS_JINTUI = ZS('035', '进神退神章第二十九');
const ZS_RUMU = ZS('036', '随鬼入墓章第三十');
const ZS_HUANGJIN = { ...ZS('038', '两现章第三十二（一）'), label: '黄金策千金赋（两现章内）' };
const BS_WENDA2 = { bookId: 'bushizhengzong', bookTitle: '卜筮正宗', chapterId: 'bushizhengzong-022', chapterTitle: '十八问答附占验（二）' };
const BS_GEJUE = { bookId: 'bushizhengzong', bookTitle: '卜筮正宗', chapterId: 'bushizhengzong-003', chapterTitle: '今以甲乙丙丁日附载为式余仿此', label: '通玄赋等歌诀' };

const mark = (entry: Omit<GlossaryEntry, 'category' | 'nature'> & { nature?: GlossaryEntry['nature'] }): GlossaryEntry => ({
    category: 'liuyao-status',
    nature: 'neutral',
    ...entry,
});

const XUN_TABLE: GlossaryDetailBlock = {
    heading: '六甲旬空',
    items: [
        { label: '甲子旬', content: '戌亥空。' },
        { label: '甲戌旬', content: '申酉空。' },
        { label: '甲申旬', content: '午未空。' },
        { label: '甲午旬', content: '辰巳空。' },
        { label: '甲辰旬', content: '寅卯空。' },
        { label: '甲寅旬', content: '子丑空。' },
    ],
};

export const LIUYAO_STATUS_GLOSSARY: GlossaryEntry[] = [
    mark({
        id: 'liuyao-status:临月建',
        categoryLabel: '月日',
        title: '临月建',
        subtitle: '爻与月建同支 · 当令',
        aliases: ['月建', '临月', '月令'],
        nature: 'auspicious',
        summary: '爻的地支与月建相同，叫临月建，当令而旺。月建掌一月之权，能生扶衰弱之爻，也能克制强旺之爻；卦中没有用神时，可以月建为用神。',
        focusHint: '临月建为旺；若在旬内，野鹤认为仍算旬空',
        blocks: [
            {
                heading: '月建之权',
                items: [
                    { label: '扶弱', content: '生、合、比、拱、扶衰弱之爻，衰而亦旺。' },
                    { label: '抑强', content: '冲、克、刑、破强旺之爻，旺而亦衰。' },
                    { label: '制动变', content: '能制服变爻、动爻，冲克飞神以扶起伏神。' },
                ],
            },
        ],
        citations: [
            {
                source: '《增删卜易·月将章》',
                original: '月将乃当权之帅，万卜以之为纲领。爻之衰弱者能生之合之、比之、拱之、扶之，衰而亦旺。爻之强旺者能冲之克之、刑之、破之，旺而亦衰。……爻值月建旺相，当谓逢空不空，逢伤无害。古有此说，余试不然，在旬内者毕竟为空。',
                translation: '月建是当权之帅，万占以它为纲：衰弱的爻得它生合比拱扶助，衰也变旺；强旺的爻被它冲克刑破，旺也变衰。旧说爻临月建，逢空不空、逢伤无害；野鹤试过不然，在旬内的毕竟还是空。',
                bookLink: ZS_YUEJIANG,
            },
        ],
        bookLinks: [ZS_YUEJIANG, ZS_SISHI],
    }),
    mark({
        id: 'liuyao-status:临日辰',
        categoryLabel: '月日',
        title: '临日辰',
        subtitle: '爻与日辰同支',
        aliases: ['日辰', '日建', '临日'],
        nature: 'auspicious',
        summary: '爻的地支与占卦之日相同，叫临日辰。日辰为六爻主宰，四时皆旺，与月建同功；爻临日辰，逢月破不算破，遇冲克也少受伤。',
        focusHint: '日辰能冲空、冲合，也能生扶、克制诸爻',
        blocks: [
            {
                heading: '日辰之用',
                items: [
                    { label: '冲空', content: '旬空之爻逢日冲，冲空则实，反而有用。' },
                    { label: '冲合', content: '合住之爻逢日冲，冲开则散。' },
                    { label: '生克', content: '生扶衰弱如时雨滋苗，克制强旺如秋霜杀草。' },
                ],
            },
        ],
        citations: [
            {
                source: '《增删卜易·日辰章》',
                original: '日辰为六爻之主宰，司四时之旺相。……逢月破而不破，遇冲克而无伤，似与月建同权',
                translation: '日辰是六爻的主宰，四时皆旺。爻临日辰，逢月破不算破，遇冲克也无伤，与月建同权。',
                bookLink: ZS_RICHEN,
            },
        ],
        bookLinks: [ZS_RICHEN],
    }),
    mark({
        id: 'liuyao-status:月破',
        categoryLabel: '月日',
        title: '月破',
        subtitle: '月建冲爻',
        aliases: ['月冲'],
        nature: 'inauspicious',
        summary: '爻的地支被月建相冲叫月破，如寅月申爻、卯月酉爻。旧说月破之爻如枯根朽木，逢生不起；野鹤认为动爻月破仍能伤爻，出了本月、或到填实、逢合之日就不再破。',
        focusHint: '静而月破，又无日辰动爻生助，才是到底之破',
        blocks: [
            {
                heading: '逐月之破',
                paragraphs: ['正月申、二月酉、三月戌、四月亥、五月子、六月丑、七月寅、八月卯、九月辰、十月巳、十一月午、十二月未。'],
            },
        ],
        citations: [
            {
                source: '《增删卜易·月破章》',
                original: '正申、二酉、三戌，四亥、五子、六丑、七寅、八卯、九辰，十巳、十一午、十二未，月建冲之为月破……目下虽破，出月则不破，今日虽破，实破之日则不破，合之日则不破，近应日远应年月。惟而不动又无日辰动爻生助者则到底而破矣。',
                translation: '各月被月建所冲的地支为月破。眼下虽破，出了本月就不破；今天虽破，到填实之日、逢合之日也不破。只有安静不动、又无日辰动爻生助的，才是到底之破。',
                bookLink: ZS_YUEPO,
            },
        ],
        bookLinks: [ZS_YUEPO, ZS_YUEJIANG],
    }),
    mark({
        id: 'liuyao-status:日冲',
        categoryLabel: '月日',
        title: '日冲',
        subtitle: '日辰冲爻 · 暗动或日破',
        aliases: ['暗动', '日破'],
        summary: '爻被占卦之日相冲。静爻旺相，逢日冲为暗动，反得其力；静爻休囚，逢日冲为日破，更加无用。卦盘只标「冲」，是暗动还是日破，要看这一爻的旺衰。',
        focusHint: '旬空之爻逢日冲，叫冲空则实，反而有用',
        blocks: [
            {
                heading: '暗动',
                paragraphs: ['暗动有喜有忌：用神休囚而元神暗动来生，是喜；用神休囚无助而忌神暗动来克，是忌。'],
            },
        ],
        citations: [
            {
                source: '《增删卜易·日辰章》',
                original: '冲旺相之静爻，既为暗动，冲衰弱之静爻为日破，爻之旺而静者冲之则为暗动，愈得其力，爻之衰而静者，冲之则为日破，愈加无用。',
                translation: '日辰冲旺相的静爻为暗动，冲衰弱的静爻为日破：旺而静者被冲，更得其力；衰而静者被冲，更加无用。',
                bookLink: ZS_RICHEN,
            },
            {
                source: '《增删卜易·暗动章》',
                original: '静爻旺相日辰冲之为暗动，静爻休囚日辰冲之为破，暗动者有喜有忌。',
                translation: '静爻旺相被日辰冲为暗动，休囚被冲为破；暗动有喜也有忌。',
                bookLink: ZS_ANDONG,
            },
        ],
        bookLinks: [ZS_RICHEN, ZS_ANDONG],
    }),
    mark({
        id: 'liuyao-status:旬空',
        categoryLabel: '月日',
        title: '旬空',
        subtitle: '旬内所缺两支',
        aliases: ['空亡', '真空'],
        nature: 'inauspicious',
        summary: '十天干配十二地支，每一旬（十日）总有两支轮空，占卦之日所在旬里没有的两支就是旬空。爻逢旬空，多主目下不实；但旺相、发动、有日月动爻生扶的不作真空，出旬或逢冲之日便实。',
        focusHint: '野鹤：旺不为空，动不为空，月破为空',
        blocks: [
            XUN_TABLE,
            {
                heading: '真空',
                paragraphs: ['春土、夏金、秋木、冬火逢空，休囚无气，才是真空。'],
            },
        ],
        citations: [
            {
                source: '《增删卜易·旬空章》',
                original: '何谓旬空？如甲子至癸酉日为一旬，此十日之内，并无戌亥，以爻逢戌亥为空亡，又名旬空，馀仿此。',
                translation: '甲子到癸酉这十天为一旬，旬内没有戌、亥，所以爻遇戌亥就是空亡，又叫旬空，其余各旬照此类推。',
                bookLink: ZS_XUNKONG,
            },
            {
                source: '《增删卜易·旬空章》',
                original: '野鹤曰：旺不为空，动不为空，有日建动爻生扶者不为空，动而化空、伏而旺相皆不为空。月破为空。',
                translation: '野鹤说：旺相不算空，发动不算空，有日建、动爻生扶不算空，动而化空、伏而旺相都不算空；月破才算空。',
                bookLink: ZS_XUNKONG,
            },
        ],
        bookLinks: [ZS_XUNKONG, ZS_YUEPO],
    }),
    mark({
        id: 'liuyao-status:月合',
        categoryLabel: '月日',
        title: '月合',
        subtitle: '爻与月建六合',
        aliases: ['月建合'],
        nature: 'auspicious',
        summary: '爻的地支与月建六合，如子月丑爻，叫月合，为有用之爻。静爻逢合为合起，休囚也有旺相之意；动爻逢合则为合绊，一时动不起来，须待冲开之日。',
        focusHint: '合中带刑克的，不作合论',
        blocks: [
            {
                heading: '六合',
                paragraphs: ['子丑合、寅亥合、卯戌合、辰酉合、巳申合、午未合。'],
            },
        ],
        citations: [
            {
                source: '《增删卜易·月将章》',
                original: '爻逢月合而有用，爻逢月破而无功。月建合爻为月合，乃有用之爻也。',
                translation: '爻逢月合则有用，逢月破则无功。月建与爻相合叫月合，是有用之爻。',
                bookLink: ZS_YUEJIANG,
            },
            {
                source: '《增删卜易·六合章》',
                original: '爻静或与日月动爻合者得合而起。即使爻值休囚亦有旺相之意。爻动或与日月动爻合者谓之动逢合而绊住，反不能动之意。',
                translation: '静爻与日月、动爻相合，得合而起，即使休囚也有旺相之意；动爻与日月、动爻相合，叫动逢合而绊住，反而动不了。',
                bookLink: ZS_LIUHE,
            },
        ],
        bookLinks: [ZS_LIUHE, ZS_YUEJIANG],
    }),
    mark({
        id: 'liuyao-status:日合',
        categoryLabel: '月日',
        title: '日合',
        subtitle: '爻与日辰六合',
        aliases: ['日辰合'],
        nature: 'auspicious',
        summary: '爻的地支与占卦之日六合，叫日合。静爻得日合而起；动爻逢日合为合绊，吉凶都要等冲开合住的日月才应验。',
        focusHint: '忌神动逢日合，暂不成凶；元神动逢日合，暂不济事',
        blocks: [
            {
                heading: '六合',
                paragraphs: ['子丑合、寅亥合、卯戌合、辰酉合、巳申合、午未合。'],
            },
        ],
        citations: [
            {
                source: '《增删卜易·六合章》',
                original: '爻静或与日月动爻合者得合而起。即使爻值休囚亦有旺相之意。爻动或与日月动爻合者谓之动逢合而绊住，反不能动之意。',
                translation: '静爻与日月、动爻相合，得合而起；动爻与日月、动爻相合，叫动逢合而绊住，反而动不了。',
                bookLink: ZS_LIUHE,
            },
            {
                source: '《增删卜易·黄金策千金赋》',
                original: '动逢合而绊住。旧注忌神动逢日月相合，则不成凶。原神动逢日月合住则不济事。此亦有理，余得验者，后逢冲开之日月，吉凶俱成。',
                translation: '动爻逢合就被绊住：忌神动而被日月合住，暂不成凶；原神动而被合住，暂不济事。野鹤验得，到冲开的日月，吉凶都会应验。',
                bookLink: ZS_HUANGJIN,
            },
        ],
        bookLinks: [ZS_LIUHE, ZS_RICHEN],
    }),
    mark({
        id: 'liuyao-status:入月墓',
        categoryLabel: '月日',
        title: '入月墓',
        subtitle: '爻的五行墓于月建',
        aliases: ['入墓', '月墓'],
        nature: 'inauspicious',
        summary: '爻的五行墓库正是月建，如木爻逢未月、火爻逢戌月、金爻逢丑月、水土爻逢辰月，叫入月墓，主收藏、受困、暗昧不明。野鹤论长生十二位，只验生、旺、墓、绝四者。',
        focusHint: '墓库逢冲，或卦中多生扶，不作墓论',
        blocks: [
            {
                heading: '五行墓库',
                items: [
                    { label: '木', content: '墓在未。' },
                    { label: '火', content: '墓在戌。' },
                    { label: '金', content: '墓在丑。' },
                    { label: '水土', content: '墓在辰。' },
                ],
            },
        ],
        citations: [
            {
                source: '《增删卜易·生旺墓绝章》',
                original: '长生、沐浴、冠带、临官、帝旺、衰、病、死、墓、绝、胎、养 余得验者，只验生旺墓绝，其馀不验，不必用之。金长生在巳 旺在酉 墓在丑 绝在寅……金爻虽墓于丑土，若得未土冲动，或卦中土多生金，论生不论墓也。',
                translation: '十二长生之中，野鹤只验生、旺、墓、绝四位，其余不用。金长生在巳、旺在酉、墓在丑、绝在寅。金虽墓于丑，若丑被未冲动，或卦中土多生金，就论生不论墓。',
                bookLink: ZS_SWMJ,
            },
        ],
        bookLinks: [ZS_SWMJ, ZS_RUMU],
    }),
    mark({
        id: 'liuyao-status:化进神',
        categoryLabel: '化象',
        title: '化进神',
        subtitle: '动而化进 · 同五行往前一位',
        aliases: ['进神'],
        summary: '动爻化出同五行、往前一位的地支，叫化进神，如寅化卯、申化酉、丑化辰。吉神化进，事势渐长；忌神化进，祸也渐深。',
        focusHint: '旺相者乘势而进，休囚者待时而进',
        blocks: [
            {
                heading: '进神',
                items: [
                    { label: '七对', content: '亥化子、寅化卯、巳化午、申化酉、丑化辰、辰化未、未化戌。' },
                    { label: '实见', content: '按纳甲装卦，动爻实际只会化出寅化卯、申化酉、丑化辰、未化戌四种；亥化子、巳化午、辰化未在卦中碰不到。' },
                ],
            },
        ],
        citations: [
            {
                source: '《增删卜易·进神退神章》',
                original: '进神退神者，爻之动而化也，化进化退，吉凶祸福有喜忌之分，所喜者宜于化进，所忌者宜化退神。进神 亥化子 寅化卯 巳化午 申化酉 丑化辰 辰化未 未化戌',
                translation: '进神、退神是动爻所化。吉凶有喜忌之分：喜神宜化进，忌神宜化退。进神有亥化子、寅化卯、巳化午、申化酉、丑化辰、辰化未、未化戌。',
                bookLink: ZS_JINTUI,
            },
            {
                source: '《卜筮正宗·十八问答》',
                original: '吉神宜于化进，忌神宜于化退，进退之法有三：旺相者乘势而进一也．休囚者待时而进二也．',
                translation: '吉神宜化进，忌神宜化退。化进有三种：旺相的乘势而进，休囚的待时而进……',
                bookLink: BS_WENDA2,
            },
        ],
        bookLinks: [ZS_JINTUI],
    }),
    mark({
        id: 'liuyao-status:化退神',
        categoryLabel: '化象',
        title: '化退神',
        subtitle: '动而化退 · 同五行往后一位',
        aliases: ['退神'],
        summary: '动爻化出同五行、往后一位的地支，叫化退神，如卯化寅、酉化申、辰化丑。吉神化退，事势渐消；忌神化退，祸也渐轻。',
        focusHint: '忌神宜化退，用神元神化退则不利',
        blocks: [
            {
                heading: '退神',
                items: [
                    { label: '七对', content: '子化亥、卯化寅、午化巳、酉化申、辰化丑、未化辰、戌化未。' },
                    { label: '实见', content: '按纳甲装卦，动爻实际只会化出卯化寅、酉化申、辰化丑、戌化未四种；子化亥、午化巳、未化辰在卦中碰不到。' },
                ],
            },
        ],
        citations: [
            {
                source: '《增删卜易·进神退神章》',
                original: '退神 子化亥 卯化寅 午化巳 酉化申 辰化丑 未化辰 戌化未……退神由此而退也，如秋天花木渐渐凋零。',
                translation: '退神有子化亥、卯化寅、午化巳、酉化申、辰化丑、未化辰、戌化未。退神由此而退，像秋天花木渐渐凋零。',
                bookLink: ZS_JINTUI,
            },
        ],
        bookLinks: [ZS_JINTUI],
    }),
    mark({
        id: 'liuyao-status:回头生',
        categoryLabel: '化象',
        title: '回头生',
        subtitle: '变爻生动爻',
        aliases: ['化回头生', '化生'],
        nature: 'auspicious',
        summary: '动爻变出之爻反过来生本位的动爻，叫回头生，如巽木变坎水，水回头生木。动爻得变爻相生，力量增强，多主吉。',
        focusHint: '元神化回头生，生用神更有力',
        blocks: [],
        citations: [
            {
                source: '《增删卜易·卦变生克墓绝章》',
                original: '此乃巽卦变坎卦，巽木变坎水谓之化生，水回头以生木，也即以吉断。',
                translation: '巽卦变坎卦，巽木变出坎水，叫化生，水回头生木，可以断吉。',
                bookLink: ZS_GUABIAN,
            },
            {
                source: '《增删卜易·元神忌神衰旺章》',
                original: '元神动化回头生及化进神者二也。',
                translation: '元神能生用神的情形之二：元神发动，化回头生或化进神。',
                bookLink: ZS_YUANJI_SW,
            },
        ],
        bookLinks: [ZS_GUABIAN, ZS_BIAN_SK],
    }),
    mark({
        id: 'liuyao-status:回头克',
        categoryLabel: '化象',
        title: '回头克',
        subtitle: '变爻克动爻',
        aliases: ['化回头克', '化克'],
        nature: 'inauspicious',
        summary: '变出之爻反克本位的动爻，叫回头克，如震木变乾金，金回头克木。动而化回头克，多以凶论。',
        focusHint: '用神、世爻化回头克最忌',
        blocks: [],
        citations: [
            {
                source: '《增删卜易·卦变生克墓绝章》',
                original: '此乃震卦化乾卦，震木变乾金谓之化克，金回头以克木，也即以凶推。',
                translation: '震卦化乾卦，震木变出乾金，叫化克，金回头克木，要以凶推断。',
                bookLink: ZS_GUABIAN,
            },
            {
                source: '《增删卜易·动变生克冲合章》',
                original: '变爻之巳火能回头克本位之酉金，并不能克生他爻。',
                translation: '变出的巳火能回头克本位的酉金，但不能生克其他爻。',
                bookLink: ZS_BIAN_SK,
            },
        ],
        bookLinks: [ZS_GUABIAN, ZS_BIAN_SK],
    }),
    mark({
        id: 'liuyao-status:化空',
        categoryLabel: '化象',
        title: '化空',
        subtitle: '变出之爻落旬空',
        aliases: ['动而化空'],
        summary: '动爻变出的地支正在旬空。旧说化空无用；野鹤认为动不为空、化空也不为空，吉凶应在冲空、出空之日。',
        focusHint: '化空多主目下未应，待出旬或逢冲之日',
        blocks: [XUN_TABLE],
        citations: [
            {
                source: '《增删卜易·旬空章》',
                original: '旺不为空，动不为空，有日建动爻生扶者不为空，动而化空、伏而旺相皆不为空。',
                translation: '旺相不算空，发动不算空，有日建、动爻生扶不算空，动而化空、伏而旺相都不算空。',
                bookLink: ZS_XUNKONG,
            },
            {
                source: '《增删卜易·元神忌神衰旺章》',
                original: '占以临空化空为无用，非也。殊不知动不为空，皆应冲空实空之日而有用也。',
                translation: '旧以为临空、化空就无用，其实不然：动不为空，都在冲空、填实之日应验而有用。',
                bookLink: ZS_YUANJI_SW,
            },
        ],
        bookLinks: [ZS_XUNKONG, ZS_YUANJI_SW],
    }),
    mark({
        id: 'liuyao-status:化破',
        categoryLabel: '化象',
        title: '化破',
        subtitle: '变出之爻逢月破',
        aliases: ['化月破'],
        summary: '动爻变出的地支被月建所冲，叫化破。旧说变爻月破就不能伤动爻；野鹤认为变爻虽破仍能伤动爻，只是要等出月、填实或逢合之日应验。',
        focusHint: '化破之爻目下无力，过月或实破之日再看',
        blocks: [],
        citations: [
            {
                source: '《增删卜易·月破章》',
                original: '诸书皆以用神临月破如悖时也……作变爻者不能伤克动爻。野鹤曰：余得其验，动则能伤于爻，变则能伤于动，何也？神兆机于动。',
                translation: '诸书都说临月破之爻如失时之物，作变爻也不能伤克动爻。野鹤验得：月破之爻动了仍能伤爻，作变爻仍能伤动爻，因为神机兆于动。',
                bookLink: ZS_YUEPO,
            },
            {
                source: '《增删卜易·进神退神章》',
                original: '古以动日月化空破谓之不退，此卦官子孙动休囚而化空破，进者进而退者竟退。',
                translation: '古说动而化空、化破就不算退；此卦官鬼、子孙休囚而化空破，进的照样进，退的照样退。',
                bookLink: ZS_JINTUI,
            },
        ],
        bookLinks: [ZS_YUEPO, ZS_JINTUI],
    }),
];

const shape = (entry: Omit<GlossaryEntry, 'category' | 'categoryLabel' | 'nature'>): GlossaryEntry => ({
    category: 'liuyao-guaxing',
    categoryLabel: '卦型',
    nature: 'neutral',
    ...entry,
});

export const LIUYAO_GUAXING_GLOSSARY: GlossaryEntry[] = [
    shape({
        id: 'liuyao-guaxing:六冲卦',
        title: '六冲卦',
        subtitle: '内外卦六爻两两相冲',
        aliases: ['六冲'],
        summary: '内卦与外卦对应三爻的地支两两相冲，叫六冲卦。冲主散：占凶事宜冲散，占吉事不宜；但都要兼看用神，用神旺相虽冲不破。',
        focusHint: '近病逢六冲多愈；吉事逢冲多有始无终',
        blocks: [
            {
                heading: '十卦',
                paragraphs: ['乾为天、坎为水、艮为山、震为雷、巽为风、离为火、坤为地、兑为泽，以及天雷无妄、雷天大壮。'],
            },
        ],
        citations: [
            {
                source: '《增删卜易·六冲章》',
                original: '相冲之法有六。日月冲爻者一也，卦逢六冲二也……冲者散也，凡占凶事宜于冲散、占吉事而不宜，必兼用神而言，用神旺虽冲不破，用神失陷凶而又凶',
                translation: '相冲有六种，日月冲爻是一，卦逢六冲是二。冲就是散：占凶事宜冲散，占吉事不宜；但要兼看用神，用神旺相虽冲不破，用神失陷则凶上加凶。',
                bookLink: ZS_LIUCHONG,
            },
        ],
        bookLinks: [ZS_LIUCHONG],
    }),
    shape({
        id: 'liuyao-guaxing:六合卦',
        title: '六合卦',
        subtitle: '内外卦六爻两两相合',
        aliases: ['六合'],
        summary: '内卦与外卦对应三爻的地支两两相合，叫六合卦。合主聚、主成：吉事逢之有始有终，凶事逢之难以了结；仍须用神有气。',
        focusHint: '用神失陷，六合也无益',
        blocks: [
            {
                heading: '八卦',
                paragraphs: ['天地否、地天泰、雷地豫、地雷复、水泽节、泽水困、火山旅、山火贲。'],
            },
        ],
        citations: [
            {
                source: '《增删卜易·六合章》',
                original: '卦逢六合者即如天地否卦内外六爻自相和合是也，不动亦是。……凡得诸合，诸占皆以为吉……然必用神有气相宜，用若失陷无益。卜书曰：万事若得三六合，诸事必得久远，有始有终。但宜吉事逢之，事必就，不宜凶事逢之，事之难结。',
                translation: '卦逢六合，如天地否，内外六爻自相和合，不动也算。凡得合，诸占多以为吉，但必须用神有气，用神失陷则无益。合主久远、有始有终：吉事逢之必成，凶事逢之难以了结。',
                bookLink: ZS_LIUHE,
            },
        ],
        bookLinks: [ZS_LIUHE],
    }),
    shape({
        id: 'liuyao-guaxing:游魂卦',
        title: '游魂卦',
        subtitle: '各宫第七卦',
        aliases: ['游魂'],
        summary: '八宫中每宫第七卦为游魂卦，如乾宫火地晋、坤宫水天需。古以游魂主心无定向、迁改不常，出行无定止，行人游遍他乡。野鹤强调须以用神为主，游魂只作参考。',
        focusHint: '先看用神，再以游魂参之',
        blocks: [],
        citations: [
            {
                source: '《增删卜易·归魂游魂章》',
                original: '游魂卦为各宫之第七卦，如乾宫中之火地晋，坤宫中之水天需。……古以游魂行千里，我行此事而欲久者，游魂而不能久，心无定向，迁改不常。……野鹤曰：须以用神为主，然后以此参之，若舍用神执此而断者，谬也。',
                translation: '游魂是各宫第七卦，如乾宫火地晋、坤宫水天需。古说游魂行千里，想长久的事遇游魂难以长久，心无定向，迁改不常。野鹤说：须以用神为主，再以游魂参看，舍用神而专凭游魂断，是错的。',
                bookLink: ZS_HUNGUA,
            },
        ],
        bookLinks: [ZS_HUNGUA],
    }),
    shape({
        id: 'liuyao-guaxing:归魂卦',
        title: '归魂卦',
        subtitle: '各宫第八卦',
        aliases: ['归魂'],
        summary: '八宫中每宫第八卦为归魂卦，如乾宫火天大有、坤宫水地比。古以归魂主不出疆，诸事拘泥难行，与游魂相反；野鹤同样强调须以用神为主。',
        focusHint: '出行逢归魂多不成行；仍以用神为主',
        blocks: [],
        citations: [
            {
                source: '《增删卜易·归魂游魂章》',
                original: '归魂卦为各宫之第八卦，如乾宫中之火天大有，坤宫中之水地比。……古以归魂不出疆，诸事拘泥不行，与游魂卦相反而断之，可也。野鹤曰：亦须以用神为主。',
                translation: '归魂是各宫第八卦，如乾宫火天大有、坤宫水地比。古说归魂不出疆，诸事拘泥难行，与游魂相反来断。野鹤说：也须以用神为主。',
                bookLink: ZS_HUNGUA,
            },
            {
                source: '《卜筮正宗·通玄赋》',
                original: '出行宜世动，归魂不出疆',
                translation: '占出行宜世爻发动；得归魂卦，多走不出去。',
                bookLink: BS_GEJUE,
            },
        ],
        bookLinks: [ZS_HUNGUA, BS_GEJUE],
    }),
];
