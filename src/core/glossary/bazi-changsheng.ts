import type { GlossaryEntry } from './types';

/**
 * 十二长生精解词典（12 项全覆盖）
 * 查法与本应用核心排盘库 tyme4ts（阳顺阴逆、火土同宫）100% 严格一致。
 * 古籍引证核自《子平真诠·论阴阳生死》《三命通会·论五行旺相休囚死并寄生十二宫》《渊海子平》。
 */

type StageTier = '强旺' | '平淡' | '衰弱';
export type StageRank = '四贵' | '四平' | '四忌';

/** 十二长生的先后次序 */
export const STAGE_ORDER = ['长生', '沐浴', '冠带', '临官', '帝旺', '衰', '病', '死', '墓', '绝', '胎', '养'] as const;

/** 气势强弱：本应用归纳，看的是这一位气是升、是盛还是收 */
const STAGE_TIER: Record<string, StageTier> = {
    长生: '强旺', 冠带: '强旺', 临官: '强旺', 帝旺: '强旺',
    衰: '平淡', 病: '平淡', 胎: '平淡', 养: '平淡',
    沐浴: '衰弱', 死: '衰弱', 墓: '衰弱', 绝: '衰弱',
};

/** 古法贵忌：《三命通会》「古以胎生旺库为四贵，死绝病败为四忌，余为四平」 */
export const STAGE_RANK: Record<string, StageRank> = {
    胎: '四贵', 长生: '四贵', 帝旺: '四贵', 墓: '四贵',
    死: '四忌', 绝: '四忌', 病: '四忌', 沐浴: '四忌',
    冠带: '四平', 临官: '四平', 衰: '四平', 养: '四平',
};

const TIER_TEXT: Record<StageTier, string> = {
    强旺: '与长生、冠带、临官、帝旺同属气势上升或正盛的一段。',
    平淡: '与衰、病、胎、养同属气势渐敛或初萌的一段。',
    衰弱: '与沐浴、死、墓、绝同属气机转折或收藏的一段。',
};

/** 气势强弱和古法贵忌是两个维度：墓、胎气势不旺，古法却列四贵；临官、冠带气势正盛，古法列四平 */
function stageBlock(title: string) {
    const tier = STAGE_TIER[title];
    const rank = STAGE_RANK[title];
    return {
        heading: '气势与古法贵忌',
        items: [
            { label: `气势 · ${tier}`, tone: tier === '强旺' ? 'favorable' as const : tier === '衰弱' ? 'unfavorable' as const : 'neutral' as const, content: `${TIER_TEXT[tier]}（本应用归纳）` },
            { label: `古法 · ${rank}`, tone: rank === '四贵' ? 'favorable' as const : rank === '四忌' ? 'unfavorable' as const : 'neutral' as const, content: `${title === '沐浴' ? '沐浴即「败」，' : title === '墓' ? '墓即「库」，' : ''}《三命通会》以胎、生、旺、库为四贵，死、绝、病、败为四忌，其余为四平。` },
        ],
    };
}

const BOOK_LINKS = [
    { bookId: 'zipingzhenquan', bookTitle: '子平真诠', chapterId: 'zipingzhenquan-004', chapterTitle: '论阴阳生死' },
    { bookId: 'sanmingtonghui', bookTitle: '三命通会', chapterId: 'sanmingtonghui-021', chapterTitle: '论五行旺相休囚死并寄生十二宫' },
    { bookId: 'sanmingtonghui', bookTitle: '三命通会', chapterId: 'sanmingtonghui-013', chapterTitle: '论天干隂阳生死' },
];

export const BAZI_CHANGSHENG_GLOSSARY: GlossaryEntry[] = [
    {
        id: 'changsheng:长生',
        category: 'bazi-changsheng',
        categoryLabel: '十二长生',
        title: '长生',
        subtitle: '气势强旺 · 古法四贵',
        nature: 'auspicious',
        summary: '如婴儿初生、草木萌发，生机勃勃而绵长不断。主新事物开端、生命力旺盛、后劲充足，遇吉神更增福泽与贵人扶持。',
        focusHint: '星运看日干对四柱地支；自坐看本柱天干对本柱地支',
        blocks: [
            {
                heading: '查法',
                paragraphs: ['星运以日干查四柱地支；自坐以本柱天干查本柱地支（阳干顺行、阴干逆行、火土同宫）。'],
                items: [
                    { label: '十干对照', content: '甲见亥、乙见午、丙见寅、丁见酉、戊见寅、己见酉、庚见巳、辛见子、壬见申、癸见卯。' },
                ],
            },
            {
                heading: '落柱与象义',
                items: [
                    { label: '核心意象', tone: 'favorable', content: '生发向荣、温润宽厚、持续成长、有源头活水，凡喜用落长生多主根基稳固、遇难呈祥。' },
                    { label: '落柱提示', content: '年柱多得祖荫早慧；月柱利事业起步；日坐长生主伴侣温厚、自身精力佳；时柱利晚景与子息。' },
                ],
            },
            stageBlock('长生'),
        ],
        citations: [
            {
                source: '《子平真诠·论阴阳生死》',
                original: '气之由盛而衰，衰而复盛，逐节细分，遂成十二……长生者，犹人之初生也。',
                translation: '长生就像人刚刚降生，元气初开、蓬勃向上，是十二种气势流转的起点。',
                bookLink: BOOK_LINKS[0],
            },
            {
                source: '《三命通会·论五行旺相休囚死并寄生十二宫》',
                original: '四曰长生，万物发生向荣，如人始生而向长也……古以胎生旺库为四贵。',
                translation: '长生象征万物萌发欣欣向荣，如同幼苗初长，旧法列为四贵之一。',
                bookLink: BOOK_LINKS[1],
            },
        ],
        bookLinks: BOOK_LINKS,
    },
    {
        id: 'changsheng:沐浴',
        category: 'bazi-changsheng',
        categoryLabel: '十二长生',
        title: '沐浴',
        subtitle: '气势衰弱 · 古法四忌 · 又名败地',
        aliases: ['败'],
        nature: 'neutral',
        summary: '如初生涤垢、草木抽芽尚未定型，形质柔脆而富于魅力变化。主审美情致、风流人缘与脱胎换骨，亦须防定力不足或环境波动。',
        focusHint: '又称败地、桃花之地；艺术人缘佳，忌无制冲破',
        blocks: [
            {
                heading: '查法',
                paragraphs: ['星运以日干查四柱地支；自坐以本柱天干查本柱地支。'],
                items: [
                    { label: '十干对照', content: '甲见子、乙见巳、丙见卯、丁见申、戊见卯、己见申、庚见午、辛见亥、壬见酉、癸见寅。' },
                ],
            },
            {
                heading: '落柱与象义',
                items: [
                    { label: '核心意象', content: '洗去旧壳、感性敏感、重外表与氛围、审美出众，常伴职业或情感上的变化适应期。' },
                    { label: '喜忌提示', content: '临喜用且有正官印星约束，反主才艺迷人、人脉广；若为忌神又逢冲合桃花，易心性浮荡、是非波折。' },
                ],
            },
            stageBlock('沐浴'),
        ],
        citations: [
            {
                source: '《子平真诠·论阴阳生死》',
                original: '沐浴者，犹人既生之后，而沐浴以去垢；如果核既为苗，则前之青壳，洗而去之矣。',
                translation: '沐浴就像婴儿出生后沐浴洗去尘垢，也像种子发芽蜕去外壳，是柔嫩而亟需呵护的阶段。',
                bookLink: BOOK_LINKS[0],
            },
            {
                source: '《三命通会·论五行旺相休囚死并寄生十二宫》',
                original: '五曰沐浴，又曰败，以万物始生，形体柔脆，易为所损，如人生后三日以沐浴之，防至困绝也。',
                translation: '沐浴之所以又称「败」，是因为万物初生时形体还很脆弱，容易受外力折损，所以处此阶段须稳扎稳打。',
                bookLink: BOOK_LINKS[1],
            },
        ],
        bookLinks: BOOK_LINKS,
    },
    {
        id: 'changsheng:冠带',
        category: 'bazi-changsheng',
        categoryLabel: '十二长生',
        title: '冠带',
        subtitle: '气势强旺 · 古法四平 · 渐成礼器',
        nature: 'auspicious',
        summary: '如少年加冠束带、万物渐荣秀，主成长进阶、体面自尊、才干初显与步入正轨，具备向上攀升的礼仪与冲劲。',
        focusHint: '气势渐盛，利学业进阶、职级晋升与形象树立',
        blocks: [
            {
                heading: '查法',
                paragraphs: ['星运以日干查四柱地支；自坐以本柱天干查本柱地支。'],
                items: [
                    { label: '十干对照', content: '甲见丑、乙见辰、丙见辰、丁见未、戊见辰、己见未、庚见未、辛见戌、壬见戌、癸见丑。' },
                ],
            },
            {
                heading: '落柱与象义',
                items: [
                    { label: '核心意象', tone: 'favorable', content: '羽翼渐丰、重视仪表与名声、好胜上进、从青涩走向成熟，易获师长赏识与阶段性突破。' },
                    { label: '落柱提示', content: '月日见冠带，多早立志向、讲究规矩体面；气势方升未满，尚有较大成长空间。' },
                ],
            },
            stageBlock('冠带'),
        ],
        citations: [
            {
                source: '《子平真诠·论阴阳生死》',
                original: '冠带者，形气渐长，犹人之年长而冠带也。',
                translation: '冠带表示形体与元气逐渐长成，犹如古人成年行冠礼、穿戴衣冠准备步入社会。',
                bookLink: BOOK_LINKS[0],
            },
            {
                source: '《三命通会·论五行旺相休囚死并寄生十二宫》',
                original: '六曰冠带，万物渐荣秀，如人具衣冠也。',
                translation: '冠带对应万物枝叶渐趋繁茂秀美，如人穿戴整齐、初显气象。',
                bookLink: BOOK_LINKS[1],
            },
        ],
        bookLinks: BOOK_LINKS,
    },
    {
        id: 'changsheng:临官',
        category: 'bazi-changsheng',
        categoryLabel: '十二长生',
        title: '临官',
        subtitle: '气势强旺 · 古法四平 · 又名建禄',
        aliases: ['建禄', '禄'],
        nature: 'auspicious',
        summary: '如人由长而壮、学成出仕，即「禄位」所在。主独立担当、事业根基扎实、食禄丰稳，兼具实干力与稳健进取心。',
        focusHint: '又称建禄，气实而不过亢，往往比帝旺更耐持久',
        blocks: [
            {
                heading: '查法',
                paragraphs: ['星运以日干查四柱地支；自坐以本柱天干查本柱地支。'],
                items: [
                    { label: '十干对照', content: '甲见寅、乙见卯、丙见巳、丁见午、戊见巳、己见午、庚见申、辛见酉、壬见亥、癸见子。' },
                ],
            },
            {
                heading: '落柱与象义',
                items: [
                    { label: '核心意象', tone: 'favorable', content: '建功立业、独当一面、自力更生、根基厚实；既具旺气又未至极亢，属于最稳健的强旺态。' },
                    { label: '落柱提示', content: '月柱为建禄、日柱为专禄、时柱为归禄，均喜无冲破而配财官食伤发用。' },
                ],
            },
            stageBlock('临官'),
        ],
        citations: [
            {
                source: '《子平真诠·论阴阳生死》',
                original: '临官者，由长而壮，犹人之可以出仕也。',
                translation: '临官象征从成长步入壮年，才干成熟、可以出仕任事、独当一面。',
                bookLink: BOOK_LINKS[0],
            },
            {
                source: '《渊海子平·诗诀》',
                original: '临官帝旺最为奇，禄贵同宫仔细推；若不状元登上第，直须黄甲脱麻衣。',
                translation: '临官与帝旺气势最盛，若与禄位、贵人同宫且格局清纯无破，往往能功名显达。',
                bookLink: { bookId: 'yuanhaiziping', bookTitle: '渊海子平', chapterId: 'yuanhaiziping-043', chapterTitle: '诗诀' },
            },
        ],
        bookLinks: [
            ...BOOK_LINKS,
            { bookId: 'yuanhaiziping', bookTitle: '渊海子平', chapterId: 'yuanhaiziping-043', chapterTitle: '诗诀' },
        ],
    },
    {
        id: 'changsheng:帝旺',
        category: 'bazi-changsheng',
        categoryLabel: '十二长生',
        title: '帝旺',
        subtitle: '气势强旺 · 古法四贵 · 盛极之峰',
        nature: 'auspicious',
        summary: '壮盛之极，如日中天、万物成熟兴旺。主自信果决、精力充沛、爆发力与掌控欲很强；物极必反，过旺宜见泄制方保长久。',
        focusHint: '能量顶点；喜用落之声势大振，忌神落之则刚亢易折',
        blocks: [
            {
                heading: '查法',
                paragraphs: ['星运以日干查四柱地支；自坐以本柱天干查本柱地支。'],
                items: [
                    { label: '十干对照', content: '甲见卯、乙见寅、丙见午、丁见巳、戊见午、己见巳、庚见酉、辛见申、壬见子、癸见亥。' },
                ],
            },
            {
                heading: '落柱与象义',
                items: [
                    { label: '核心意象', tone: 'favorable', content: '巅峰盛势、主见强烈、敢作敢为、不易屈居人下，适合担当核心主事者。' },
                    { label: '过旺提醒', tone: 'unfavorable', content: '盛极将衰，若局中比劫帝旺重重无财官食伤疏导，易刚愎固执、大起大落，须知进退之道。' },
                ],
            },
            stageBlock('帝旺'),
        ],
        citations: [
            {
                source: '《渊海子平·诗诀》',
                original: '临官帝旺最为奇，禄贵同宫仔细推；若不状元登上第，直须黄甲脱麻衣。',
                translation: '临官与帝旺为旺气之最，若与禄贵相逢且无冲克破格，最主建功立业、名声显赫。',
                bookLink: { bookId: 'yuanhaiziping', bookTitle: '渊海子平', chapterId: 'yuanhaiziping-043', chapterTitle: '诗诀' },
            },
            {
                source: '《子平真诠·论阴阳生死》',
                original: '帝旺者，壮盛之极，犹人之可以辅帝而大有为也。',
                translation: '帝旺是气势壮盛的顶点，如同人至盛年，足以建功立业、大有作为。',
                bookLink: BOOK_LINKS[0],
            },
            {
                source: '《三命通会·论五行旺相休囚死并寄生十二宫》',
                original: '八曰帝旺，万物成熟，如人之兴旺也……凡推造化，见生旺者未必便作吉论……生旺太过宜乎制伏。',
                translation: '帝旺代表成熟兴旺，但推命不可一见生旺便全断为吉——旺而太过同样需要适当制约疏导，以归中和。',
                bookLink: BOOK_LINKS[1],
            },
        ],
        bookLinks: [
            ...BOOK_LINKS,
            { bookId: 'yuanhaiziping', bookTitle: '渊海子平', chapterId: 'yuanhaiziping-043', chapterTitle: '诗诀' },
        ],
    },
    {
        id: 'changsheng:衰',
        category: 'bazi-changsheng',
        categoryLabel: '十二长生',
        title: '衰',
        subtitle: '气势平淡 · 古法四平 · 盛极初敛',
        nature: 'neutral',
        summary: '盛极之后的初转收敛，并非颓废无力，而是去其锐气、归于稳重内敛。主谨慎务实、守成精明、处事老练而不张扬。',
        focusHint: '外敛内实，利守成、财务与幕后谋划，不喜冒险激进',
        blocks: [
            {
                heading: '查法',
                paragraphs: ['星运以日干查四柱地支；自坐以本柱天干查本柱地支。'],
                items: [
                    { label: '十干对照', content: '甲见辰、乙见丑、丙见未、丁见辰、戊见未、己见辰、庚见戌、辛见未、壬见丑、癸见戌。' },
                ],
            },
            {
                heading: '落柱与象义',
                items: [
                    { label: '核心意象', content: '成熟稳健、知所进退、温和守分、不爱出风头；余气犹存，重积累而非爆发。' },
                    { label: '喜忌提示', content: '若日主偏旺，星运见衰反得中和谦退之美；若本就身弱，则宜借印比相扶、忌贪大求快。' },
                ],
            },
            stageBlock('衰'),
        ],
        citations: [
            {
                source: '《子平真诠·论阴阳生死》',
                original: '衰者，盛极而衰，物之初变也。',
                translation: '衰是气势从顶点开始回落的第一步，象征由外放转向收敛变化。',
                bookLink: BOOK_LINKS[0],
            },
            {
                source: '《三命通会·论五行旺相休囚死并寄生十二宫》',
                original: '九曰衰，万物形衰，如人之气衰也……见休囚死绝未必便作凶言……妙在识其通变。',
                translation: '衰代表气象初减，但推命不可死板断凶，过旺之局逢衰反而收敛成器，贵在灵活通变。',
                bookLink: BOOK_LINKS[1],
            },
        ],
        bookLinks: BOOK_LINKS,
    },
    {
        id: 'changsheng:病',
        category: 'bazi-changsheng',
        categoryLabel: '十二长生',
        title: '病',
        subtitle: '气势平淡 · 古法四忌',
        nature: 'neutral',
        summary: '衰之甚者为病，主心思细腻、同理心强、富于想象力与人文敏感度，亦提示精力易透支，处事重精神而忌过度劳神。',
        focusHint: '并非必然指身体疾病，更多体现为敏感、内省与重细节',
        blocks: [
            {
                heading: '查法',
                paragraphs: ['星运以日干查四柱地支；自坐以本柱天干查本柱地支。'],
                items: [
                    { label: '十干对照', content: '甲见巳、乙见子、丙见申、丁见卯、戊见申、己见卯、庚见亥、辛见午、壬见寅、癸见酉。' },
                ],
            },
            {
                heading: '落柱与象义',
                items: [
                    { label: '核心意象', content: '感性悲悯、观察入微、具艺术与助人情怀，易涉医理、心理、文化与幕后策划。' },
                    { label: '调衡提示', content: '容易想多耗神或行动力慢半拍，须注重作息节律，避免情绪积郁。' },
                ],
            },
            stageBlock('病'),
        ],
        citations: [
            {
                source: '《子平真诠·论阴阳生死》',
                original: '病者，衰之甚也。',
                translation: '病是衰势进一步加深的状态，气力减弱而感受趋于敏锐。',
                bookLink: BOOK_LINKS[0],
            },
            {
                source: '《三命通会·论五行旺相休囚死并寄生十二宫》',
                original: '十曰病，万物病如人之病也……死绝不及宜乎生扶。',
                translation: '病位代表外在气势不足，若为日主或喜用所在，最宜印比生扶或顺势调养。',
                bookLink: BOOK_LINKS[1],
            },
        ],
        bookLinks: BOOK_LINKS,
    },
    {
        id: 'changsheng:死',
        category: 'bazi-changsheng',
        categoryLabel: '十二长生',
        title: '死',
        subtitle: '气势衰弱 · 古法四忌 · 静极内专',
        nature: 'neutral',
        summary: '外在浮华气尽、归于沉寂静止。并非寿夭之断，在心性上主冷静沉潜、专注钻研、不慕虚荣，遇事倾向深思熟虑而非冲动冒进。',
        focusHint: '切勿望文生义断寿；吉神逢死力减，凶煞逢死反敛其凶',
        blocks: [
            {
                heading: '查法',
                paragraphs: ['星运以日干查四柱地支；自坐以本柱天干查本柱地支。'],
                items: [
                    { label: '十干对照', content: '甲见午、乙见亥、丙见酉、丁见寅、戊见酉、己见寅、庚见子、辛见巳、壬见卯、癸见申。' },
                ],
            },
            {
                heading: '落柱与象义',
                items: [
                    { label: '核心意象', content: '沉静内敛、耐得住寂寞、钻研力深，利于学术、技术、宗教哲学等需静心沉淀之事。' },
                    { label: '喜忌提示', content: '忌神或凶煞落死地则气焰大消；若核心用神落死地无生扶，则推进偏慢、须借岁运引动。' },
                ],
            },
            stageBlock('死'),
        ],
        citations: [
            {
                source: '《子平真诠·论阴阳生死》',
                original: '死者，气之尽而无余也。',
                translation: '死指该五行此一阶段的显化之气已尽，转入归藏前的寂静状态。',
                bookLink: BOOK_LINKS[0],
            },
            {
                source: '《三命通会·论五行旺相休囚死并寄生十二宫》',
                original: '十一曰死，万物死如人之死也……见休囚死绝未必便作凶言。',
                translation: '十二宫中的「死」只是五行气势循环中的一环，绝不可单凭一字断凶或断寿。',
                bookLink: BOOK_LINKS[1],
            },
        ],
        bookLinks: BOOK_LINKS,
    },
    {
        id: 'changsheng:墓',
        category: 'bazi-changsheng',
        categoryLabel: '十二长生',
        title: '墓',
        subtitle: '气势衰弱 · 古法四贵 · 又名库地',
        aliases: ['库'],
        nature: 'neutral',
        summary: '造化收藏归库之所，如丰收之后入仓贮藏。有气为「库」（主积蓄、收敛、厚藏待发），无气为「墓」（主闭塞保守、受困难展）。',
        focusHint: '分清是「库」还是「墓」：喜用有气逢适度刑冲开库反发',
        blocks: [
            {
                heading: '查法',
                paragraphs: ['星运以日干查四柱地支；自坐以本柱天干查本柱地支。'],
                items: [
                    { label: '十干对照', content: '甲见未、乙见戌、丙见戌、丁见丑、戊见戌、己见丑、庚见丑、辛见辰、壬见辰、癸见未。' },
                ],
            },
            {
                heading: '落柱与象义',
                items: [
                    { label: '核心意象', content: '节俭蓄财、善于收纳整理、低调深藏、重安全感；财官有气入库往往暗藏实力。' },
                    { label: '开库与闭塞', content: '有根有气则为财库、官库、印库，岁运轻引或逢合冲得宜易显发；若弱而无助则易显压抑迟滞。' },
                ],
            },
            stageBlock('墓'),
        ],
        citations: [
            {
                source: '《子平真诠·论阴阳生死》',
                original: '墓者，造化收藏，犹人之埋于土者也。',
                translation: '墓代表自然界将万物收敛珍藏起来的阶段，核心在「藏」与「聚」。',
                bookLink: BOOK_LINKS[0],
            },
            {
                source: '《三命通会·论五行旺相休囚死并寄生十二宫》',
                original: '十二曰墓，又曰库，以万物成功而藏之库，如人之终而归墓也……古以胎生旺库为四贵。',
                translation: '墓又称库，就像功成之后收入仓廪，因此古法也将「库」列为四贵之一。',
                bookLink: BOOK_LINKS[1],
            },
        ],
        bookLinks: [
            ...BOOK_LINKS,
            { bookId: 'zipingzhenquan', bookTitle: '子平真诠', chapterId: 'zipingzhenquan-018', chapterTitle: '论墓库刑冲之说' },
        ],
    },
    {
        id: 'changsheng:绝',
        category: 'bazi-changsheng',
        categoryLabel: '十二长生',
        title: '绝',
        subtitle: '气势衰弱 · 古法四忌 · 又名受气',
        aliases: ['受气', '胞'],
        nature: 'neutral',
        summary: '旧气已尽、新气将萌的临界转换点。主很强适应力与断舍离魄力，不恋旧辙；虽先天依托较浅，却最易出现「绝处逢生」之转机。',
        focusHint: '物极转机之位；遇生扶贵人常能柳暗花明、另起炉灶',
        blocks: [
            {
                heading: '查法',
                paragraphs: ['星运以日干查四柱地支；自坐以本柱天干查本柱地支。'],
                items: [
                    { label: '十干对照', content: '甲见申、乙见酉、丙见亥、丁见子、戊见亥、己见子、庚见寅、辛见卯、壬见巳、癸见午。' },
                ],
            },
            {
                heading: '落柱与象义',
                items: [
                    { label: '核心意象', content: '清零重启、反应机敏、无所执念、善于异地发展或跨界转型，常于低谷处另辟蹊径。' },
                    { label: '喜忌提示', content: '最喜逢印星或贵人相扶成「绝处逢生」；若独孤无援又逢刑冲，则防计划骤变与人际冷暖。' },
                ],
            },
            stageBlock('绝'),
        ],
        citations: [
            {
                source: '《子平真诠·论阴阳生死》',
                original: '绝者，前之气已绝，后之气将续也。',
                translation: '绝并非彻底终结，而是旧气散尽、新气即将接续的空灵交界点。',
                bookLink: BOOK_LINKS[0],
            },
            {
                source: '《三命通会·论五行旺相休囚死并寄生十二宫》',
                original: '一曰受气，又曰绝、曰胞，以万物在地中未有其象，如母腹空未有物也。',
                translation: '绝又叫「受气」，如同大地之下尚未显现外形，却正在酝酿下一轮生机。',
                bookLink: BOOK_LINKS[1],
            },
        ],
        bookLinks: BOOK_LINKS,
    },
    {
        id: 'changsheng:胎',
        category: 'bazi-changsheng',
        categoryLabel: '十二长生',
        title: '胎',
        subtitle: '气势平淡 · 古法四贵 · 孕育萌芽',
        nature: 'auspicious',
        summary: '天地气交而结聚成胎，新机初孕于无形。主创意构想、希望与潜力、规划筹备，富于好奇心与可塑性，重在培土静待开花。',
        focusHint: '利策划立项、开创新局；初生尚微，宜耐心沉淀忌急于求成',
        blocks: [
            {
                heading: '查法',
                paragraphs: ['星运以日干查四柱地支；自坐以本柱天干查本柱地支。'],
                items: [
                    { label: '十干对照', content: '甲见酉、乙见申、丙见子、丁见亥、戊见子、己见亥、庚见卯、辛见寅、壬见午、癸见巳。' },
                ],
            },
            {
                heading: '落柱与象义',
                items: [
                    { label: '核心意象', tone: 'favorable', content: '萌芽构想、理想主义、学习吸收力强、充满新点子，象征未来可期的种子阶段。' },
                    { label: '调衡提示', content: '落地执行初期力量较嫩，需借团队与经验逐步成型，避免想法多而坚持少。' },
                ],
            },
            stageBlock('胎'),
        ],
        citations: [
            {
                source: '《子平真诠·论阴阳生死》',
                original: '胎者，后之气续而结聚成胎也。',
                translation: '胎是指新接续的元气开始凝聚成形，孕育出新的生机。',
                bookLink: BOOK_LINKS[0],
            },
            {
                source: '《三命通会·论五行旺相休囚死并寄生十二宫》',
                original: '二曰受胎，天地气交氤氲造物，其物在地中萌芽，始有其气，如人受父母之气也。',
                translation: '受胎好比天地阴阳交感，事物在地底萌发最初的生机，古法列为四贵之一。',
                bookLink: BOOK_LINKS[1],
            },
        ],
        bookLinks: BOOK_LINKS,
    },
    {
        id: 'changsheng:养',
        category: 'bazi-changsheng',
        categoryLabel: '十二长生',
        title: '养',
        subtitle: '气势平淡 · 古法四平 · 成形蓄势',
        nature: 'auspicious',
        summary: '如胎儿在母腹中渐具形体、静待降生。主温和敦厚、善于蓄力筹谋、得长辈或环境滋养，细水长流、厚积薄发。',
        focusHint: '临近长生，主蓄势待发、稳健成器，利深耕积累',
        blocks: [
            {
                heading: '查法',
                paragraphs: ['星运以日干查四柱地支；自坐以本柱天干查本柱地支。'],
                items: [
                    { label: '十干对照', content: '甲见戌、乙见未、丙见丑、丁见戌、戊见丑、己见戌、庚见辰、辛见丑、壬见未、癸见辰。' },
                ],
            },
            {
                heading: '落柱与象义',
                items: [
                    { label: '核心意象', tone: 'favorable', content: '谦和稳重、有耐心、得照拂与栽培、擅长前期打基础与资源养护，后发而有力。' },
                    { label: '落柱提示', content: '年日见养多得家荫或长辈缘；事业上偏向长期主义与口碑沉淀。' },
                ],
            },
            stageBlock('养'),
        ],
        citations: [
            {
                source: '《子平真诠·论阴阳生死》',
                original: '养者，如人养母腹也。自是而后，长生循环无端矣。',
                translation: '养如同生命在母腹中滋养成形，过了养位便再度进入长生，周而复始。',
                bookLink: BOOK_LINKS[0],
            },
            {
                source: '《三命通会·论五行旺相休囚死并寄生十二宫》',
                original: '三曰成形，万物在地中成形，如人在母腹成形也。',
                translation: '养位（成形）代表内里已经具备完整雏形，只待时机一到便破土而出。',
                bookLink: BOOK_LINKS[1],
            },
        ],
        bookLinks: BOOK_LINKS,
    },
];
