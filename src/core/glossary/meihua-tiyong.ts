import type { GlossaryClassicBookLink, GlossaryEntry } from './types';

/**
 * 梅花易数体用生克五种、三要外应，与八卦万物类象。
 * 原文核自站内《梅花易数》：体用总诀、三要灵应篇、占卜克应之诀、乾卦（八卦万物属类）。
 * 互卦、变卦里的经卦与体卦的生克也归这五种，页面上写作「生体」「克体」「泄体」「受克」「比和」。
 */

const LINK_TIYONG: GlossaryClassicBookLink = { bookId: 'meihuayishu', bookTitle: '梅花易数', chapterId: 'meihuayishu-005', chapterTitle: '体用总诀' };
const LINK_XIANG: GlossaryClassicBookLink = { bookId: 'meihuayishu', bookTitle: '梅花易数', chapterId: 'meihuayishu-003', chapterTitle: '乾卦', label: '八卦万物属类' };
const LINK_SANYAO: GlossaryClassicBookLink = { bookId: 'meihuayishu', bookTitle: '梅花易数', chapterId: 'meihuayishu-008', chapterTitle: '三要灵应篇' };
const LINK_KEYING: GlossaryClassicBookLink = { bookId: 'meihuayishu', bookTitle: '梅花易数', chapterId: 'meihuayishu-011', chapterTitle: '占卜克应之诀' };

export const MEIHUA_TIYONG_GLOSSARY: GlossaryEntry[] = [
    {
        id: 'meihua:体用比和',
        category: 'meihua-tiyong',
        categoryLabel: '体用诀',
        title: '体用比和',
        subtitle: '体用同五行 · 吉',
        aliases: ['比和'],
        nature: 'auspicious',
        summary: '用卦（或互卦、变卦）与体卦五行相同，主客同气，谋事阻力小，多得同类相助。',
        focusHint: '再看月令：体旺比和更顺，体衰比和只是不受伤',
        blocks: [
            {
                heading: '看法',
                items: [
                    { label: '体党', content: '互、变卦也多与体卦同五行，叫体党多，体势更盛。' },
                    { label: '用党', content: '互、变卦多与用卦同五行，叫用党多，体势反衰。' },
                ],
            },
        ],
        citations: [
            {
                source: '《梅花易数·体用总诀》',
                original: '体党多而体势盛，用党多则体势衰。……体用之间，比和则吉……体用比和，则百事顺遂。',
                translation: '与体卦同类的卦多，体势就盛；与用卦同类的卦多，体势就衰。体用之间以比和为吉，体用比和，百事顺遂。',
                bookLink: LINK_TIYONG,
            },
        ],
        bookLinks: [LINK_TIYONG],
    },
    {
        id: 'meihua:用生体',
        category: 'meihua-tiyong',
        categoryLabel: '体用诀',
        title: '用生体',
        subtitle: '用卦生体卦 · 吉 · 有进益',
        aliases: ['生体'],
        nature: 'auspicious',
        summary: '用卦（或互卦、变卦）的五行生扶体卦，主得助、有进益。看生体的是哪一卦，可推喜从何来。',
        focusHint: '生体之卦也宜旺，旺则助力大',
        blocks: [
            {
                heading: '八卦生体',
                items: [
                    { label: '乾', tone: 'favorable', content: '公门有喜、功名有望、尊长惠送、金宝之利。' },
                    { label: '兑', tone: 'favorable', content: '西方之财、喜悦事、饮食金玉之利、朋友讲习。' },
                    { label: '坤', tone: 'favorable', content: '田土之喜、乡人之益、阴人之利、谷帛之利。' },
                    { label: '艮', tone: 'favorable', content: '东北方之财、山田之喜，事有始终。' },
                    { label: '震', tone: 'favorable', content: '山林之益、东方之财、动中有喜、木货交易。' },
                    { label: '巽', tone: 'favorable', content: '山林之益、东南得财、茶果菜蔬之喜。' },
                    { label: '坎', tone: 'favorable', content: '北方之喜、水边人进利、鱼盐酒货文书之利。' },
                    { label: '离', tone: 'favorable', content: '南方之财、文书之喜、炉冶之利。' },
                ],
            },
        ],
        citations: [
            {
                source: '《梅花易数·体用总诀》',
                original: '体宜受用卦之生，用宜见卦体之克。……用生体，有进益之喜。……又卦中有生体之卦，看是何卦。',
                translation: '体卦宜受用卦之生，用卦宜受体卦之克。用生体，有进益之喜；卦中有生体之卦，要看是哪一卦，以推喜事所从来。',
                bookLink: LINK_TIYONG,
            },
        ],
        bookLinks: [LINK_TIYONG],
    },
    {
        id: 'meihua:体克用',
        category: 'meihua-tiyong',
        categoryLabel: '体用诀',
        title: '体克用',
        subtitle: '体卦克用卦 · 吉 · 我能制事',
        aliases: ['体克', '受克'],
        nature: 'auspicious',
        summary: '体卦的五行克用卦，事在我掌握之中，多能办成。互卦、变卦受体卦所克，本页标作「受克」，也是我能制事之象。',
        focusHint: '体卦有气才克得动；体衰用旺，反要费力',
        blocks: [
            {
                heading: '看法',
                paragraphs: ['体卦得令旺相，克用举重若轻，成事较快；体卦休囚而用卦旺，虽是体克用，也要多费周折。'],
            },
        ],
        citations: [
            {
                source: '《梅花易数·体用总诀》',
                original: '体盛则吉，体衰则凶。……体克用，诸事吉',
                translation: '体卦盛则吉，体卦衰则凶。体卦克用卦，诸事为吉。',
                bookLink: LINK_TIYONG,
            },
        ],
        bookLinks: [LINK_TIYONG],
    },
    {
        id: 'meihua:用克体',
        category: 'meihua-tiyong',
        categoryLabel: '体用诀',
        title: '用克体',
        subtitle: '用卦克体卦 · 凶 · 阻滞受制',
        aliases: ['克体'],
        nature: 'inauspicious',
        summary: '用卦（或互卦、变卦）的五行克体卦，外力压制自己，谋事多阻、于己不利。看克体的是哪一卦，可推阻力从何而来。',
        focusHint: '体卦得令或有生体之卦，凶可减轻',
        blocks: [
            {
                heading: '八卦克体',
                items: [
                    { label: '乾', tone: 'unfavorable', content: '公事、门户之忧，财宝之失，得罪尊长贵人。' },
                    { label: '兑', tone: 'unfavorable', content: '不利西方，口舌纷争，毁折之患，因饮食生忧。' },
                    { label: '坤', tone: 'unfavorable', content: '田土之忧，阴人、小人之害，布帛谷粟之损。' },
                    { label: '艮', tone: 'unfavorable', content: '诸事多违，百谋中阻，山林田土之失。' },
                    { label: '震', tone: 'unfavorable', content: '虚惊恐惧，身心不安，家宅不宁。' },
                    { label: '巽', tone: 'unfavorable', content: '草木姓人相害，山林生忧，防阴人小口之厄。' },
                    { label: '坎', tone: 'unfavorable', content: '险陷之事，寇盗之忧，酒后生灾。' },
                    { label: '离', tone: 'unfavorable', content: '文书之忧，失火之惊，南方之忧。' },
                ],
            },
            {
                heading: '转机',
                paragraphs: ['体卦当令旺相，或互、变卦中有生体之卦，凶势可减；体衰又重重受克，最凶。'],
            },
        ],
        citations: [
            {
                source: '《梅花易数·体用总诀》',
                original: '体克用，诸事吉；用克体，诸事凶。……又看卦中有克体之卦者，看是何卦。',
                translation: '体克用诸事吉，用克体诸事凶。卦中有克体之卦，要看是哪一卦，以推祸患所从来。',
                bookLink: LINK_TIYONG,
            },
            {
                source: '《梅花易数·衰旺论》',
                original: '若体衰而逢克，则其凶甚矣。体衰而有生体之卦，则衰稍解。',
                translation: '体卦衰弱又受克，凶上加凶；体衰而卦中有生体之卦，衰势稍可缓解。',
                bookLink: LINK_SANYAO,
            },
        ],
        bookLinks: [LINK_TIYONG, LINK_SANYAO],
    },
    {
        id: 'meihua:体生用',
        category: 'meihua-tiyong',
        categoryLabel: '体用诀',
        title: '体生用',
        subtitle: '体卦生用卦 · 泄气 · 有耗失',
        aliases: ['体生', '泄体', '泄气'],
        nature: 'inauspicious',
        summary: '体卦的五行去生用卦，叫做泄气，自己的精力、财物往外耗，多费力少得。互卦、变卦受体卦所生，本页标作「泄体」。',
        focusHint: '体旺小泄无妨，体衰再泄耗损更重',
        blocks: [
            {
                heading: '看法',
                paragraphs: ['用克体固然不好，体生用也不算有利。体卦旺时泄气，只是有所付出；体卦休囚再泄，宜及早收手。'],
            },
        ],
        citations: [
            {
                source: '《梅花易数·体用总诀》',
                original: '用克体固不宜，体生用亦非利。……体生用，为之泄气，如夏火逢土，亦泄气。……体生用，有耗失之患',
                translation: '用克体固然不宜，体生用也不算有利。体生用叫泄气，即使夏天火旺遇土也是泄气。体生用，有耗失之患。',
                bookLink: LINK_TIYONG,
            },
        ],
        bookLinks: [LINK_TIYONG],
    },
    {
        id: 'meihua:外应克应',
        category: 'meihua-tiyong',
        categoryLabel: '体用诀',
        title: '三要与外应',
        subtitle: '耳闻目见 · 外应参断',
        aliases: ['外应', '三要', '克应'],
        nature: 'neutral',
        summary: '梅花易数除卦象外，还看起卦、断卦时耳闻目见的外应，称为三要。外应与卦象相合，断语更可靠；不合时仍以体用为主。',
        focusHint: '外应以自然偶遇为准，不可牵强附会',
        blocks: [
            {
                heading: '观象',
                items: [
                    { label: '三要', content: '耳所闻、目所见、心所念，以不假思索、偶然遇到的为准。' },
                    { label: '内外', content: '卦为内，外应为外：内外皆吉断吉，皆凶断凶，一吉一凶须细审。' },
                ],
            },
        ],
        citations: [
            {
                source: '《梅花易数·三要灵应篇》',
                original: '三要者，运耳、目、心三者之要也。灵应者，灵妙而应验也。',
                translation: '三要，是运用耳、目、心三者的要诀；灵应，是灵妙而应验。',
                bookLink: LINK_SANYAO,
            },
            {
                source: '《梅花易数·十应目论》',
                original: '内卦不吉而外卦又吉，可以解其不吉；内卦吉而外卦不吉，反破其吉。若内外卦全吉，则断然吉。全凶则断然凶。',
                translation: '卦象不吉而外应吉，可以化解；卦象吉而外应不吉，反而破了吉。内外都吉就断吉，都凶就断凶。',
                bookLink: LINK_SANYAO,
            },
        ],
        bookLinks: [LINK_SANYAO, LINK_KEYING],
    },
];

const trigram = (
    name: string,
    image: string,
    subtitle: string,
    summary: string,
    focusHint: string,
    items: Array<[string, string]>,
    original: string,
    translation: string,
): GlossaryEntry => ({
    id: `trigram:${name}`,
    category: 'trigram-image',
    categoryLabel: '八卦类象',
    title: `${name}卦`,
    subtitle,
    aliases: [name, image],
    nature: 'neutral',
    summary,
    focusHint,
    blocks: [{ heading: '万物属类', items: items.map(([label, content]) => ({ label, content })) }],
    citations: [{ source: '《梅花易数·八卦万物属类》', original, translation, bookLink: LINK_XIANG }],
    bookLinks: [LINK_XIANG, LINK_TIYONG],
});

export const TRIGRAM_IMAGE_GLOSSARY: GlossaryEntry[] = [
    trigram(
        '乾', '乾为天', '先天一 · 金 · 西北 · 健',
        '三爻皆阳，象天，性刚健。类象为君父、尊长、官贵、公门，物为金玉、圆物、刚物。',
        '秋旺，夏衰；秋占多吉，夏占多不利',
        [
            ['天时', '天、冰、雹、霰。'],
            ['地理', '西北方、京都、大郡、高亢之所。'],
            ['人物', '君、父、大人、老人、长者、官宦、公门人。'],
            ['人事', '刚健武勇、果决、多动少静。'],
            ['身体', '首、骨、肺；病主头面、筋骨、上焦。'],
            ['物象', '金玉、宝珠、圆物、冠、镜；马、天鹅、狮、象。'],
            ['数目', '一、四、九；色大赤、玄；味辛辣。'],
        ],
        '人物：君、父、大人、老人、长者、官宦、名人、公门人。人事：刚健武勇、果决、多动少静、高上下屈。身体：首、骨、肺。',
        '人物为君主、父亲、大人、老人、长者、官宦、名人、公门中人；人事主刚健勇武、果决、多动少静；身体为头、骨、肺。',
    ),
    trigram(
        '兑', '兑为泽', '先天二 · 金 · 西 · 说',
        '上爻一阴，象泽，性喜悦。类象为少女、口舌、饮食、言说，物为金刃、缺损之器。',
        '秋旺，夏衰；秋占有喜，夏占防口舌破财',
        [
            ['天时', '雨泽、新月、星。'],
            ['地理', '泽、水际、缺池、废井、山崩破裂之地。'],
            ['人物', '少女、妾、歌妓、伶人、译人、巫师。'],
            ['人事', '喜悦、口舌、谗毁、谤说、饮食。'],
            ['身体', '舌、口喉、肺、痰涎；病主口舌咽喉、气喘。'],
            ['物象', '金刀、金类、乐器、废物、缺器；羊、泽中之物。'],
            ['数目', '四、二、九；色白；味辛辣。'],
        ],
        '人物：少女、妾、歌妓、伶人、译人、巫师。人事：喜悦、口、谗毁、谤说、饮食。身体：舌、口喉、肺、痰、涎。',
        '人物为少女、妾、歌妓、伶人、翻译、巫师；人事主喜悦、口舌、谗毁、毁谤、饮食；身体为舌、口喉、肺、痰涎。',
    ),
    trigram(
        '离', '离为火', '先天三 · 火 · 南 · 丽',
        '中爻一阴，外明内虚，象火与日。类象为中女、文人、文书、聪明才学，物为火、书、甲胄。',
        '夏旺，冬衰；夏占多顺，冬占多不利',
        [
            ['天时', '日、电、虹、霓、霞。'],
            ['地理', '南方、干亢之地、窑灶、炉冶之所。'],
            ['人物', '中女、文人、大腹、目疾人、甲胄之士。'],
            ['人事', '文画之所、聪明才学、相见虚心、书事。'],
            ['身体', '目、心、上焦；病主目疾、心疾、上焦热病。'],
            ['物象', '火、书、文、甲胄、干戈、干燥赤色之物；雉、龟、鳖、蟹、螺、蚌。'],
            ['数目', '三、二、七；色赤、紫、红；味苦。'],
        ],
        '人物：中女、文人、大腹、目疾人、甲胄之士。人事：文画之所、聪明才学、相见虚心、书事。身体：目、心、上焦。',
        '人物为中女、文人、大腹之人、眼疾之人、披甲之士；人事主文书字画、聪明才学、虚心相见、文书之事；身体为目、心、上焦。',
    ),
    trigram(
        '震', '震为雷', '先天四 · 木 · 东 · 动',
        '初爻一阳，象雷，性动。类象为长男、起动、虚惊、声势，物为竹木、乐器、花草。',
        '春旺，秋衰；春占多顺，秋占多不利',
        [
            ['天时', '雷。'],
            ['地理', '东方、树木、闹市、大途、竹林、草木茂盛之所。'],
            ['人物', '长男。'],
            ['人事', '起动、怒、虚惊、鼓动噪、多动少静。'],
            ['身体', '足、肝、发、声音；病主足疾、肝经、惊怖不安。'],
            ['物象', '木竹、萑苇、竹木乐器、繁鲜花草；龙、蛇。'],
            ['数目', '四、八、三；色青、绿、碧；味酸。'],
        ],
        '人物：长男。人事：起动、怒、虚惊、鼓动噪、多动少静。身体：足、肝、发、声音。',
        '人物为长男；人事主发动、发怒、虚惊、鼓噪、多动少静；身体为足、肝、头发、声音。',
    ),
    trigram(
        '巽', '巽为风', '先天五 · 木 · 东南 · 入',
        '初爻一阴，象风，性入而顺。类象为长女、秀士、利市、进退不果，物为绳、直长之物、竹木工巧之器。',
        '春旺，秋衰；春占多吉，秋占多不安',
        [
            ['天时', '风。'],
            ['地理', '东南方、草木茂秀之所、花果菜园。'],
            ['人物', '长女、秀士、寡妇、山林仙道之人。'],
            ['人事', '柔和、不定、鼓舞、利市三倍、进退不果。'],
            ['身体', '肱、股、气；病主股肱、风疾、肠疾、气疾。'],
            ['物象', '木香、绳、直物、长物、竹木、工巧之器；鸡、百禽、虫。'],
            ['数目', '五、三、八；色青、绿、碧、洁白；味酸。'],
        ],
        '人物：长女、秀士、寡妇之人、山林仙道之人。人事：柔和、不定、鼓舞、利市三倍、进退不果。身体：肱、股、气、风疾。',
        '人物为长女、秀士、寡妇、山林修道之人；人事主柔和、不定、鼓舞、获利三倍、进退不决；身体为臂、股、气，病为风疾。',
    ),
    trigram(
        '坎', '坎为水', '先天六 · 水 · 北 · 陷',
        '中爻一阳，外柔内刚，象水。类象为中男、江湖之人、险陷、漂泊，物为水具、酒器、带核之物。',
        '冬旺，辰戌丑未月衰；冬占多顺，四季月占多不利',
        [
            ['天时', '月、雨、雪、霜、露。'],
            ['地理', '北方、江湖、溪涧、泉井、卑湿之地。'],
            ['人物', '中男、江湖之人、舟人、盗贼。'],
            ['人事', '险陷卑下、外示以柔、漂泊不成、随波逐流。'],
            ['身体', '耳、血、肾；病主耳痛、肾疾、水泻、血病。'],
            ['物象', '带核之物、弓轮、矫揉之物、酒器、水具；豕、鱼、水中之物。'],
            ['数目', '一、六；色黑；味咸、酸。'],
        ],
        '人物：中男、江湖之人、舟人……人事：险陷卑下、外示以柔、内序以利、漂泊不成、随波逐流。身体：耳、血、肾。',
        '人物为中男、江湖之人、船夫；人事主险陷卑下、外表柔顺而内里图利、漂泊无成、随波逐流；身体为耳、血、肾。',
    ),
    trigram(
        '艮', '艮为山', '先天七 · 土 · 东北 · 止',
        '上爻一阳，象山，性止。类象为少男、闲人、阻隔、守静，物为土石、瓜果、黄物。',
        '辰戌丑未月旺，春衰；求快多阻，守成为宜',
        [
            ['天时', '云、雾、山岚。'],
            ['地理', '山径路、近山城、丘陵、坟墓、东北方。'],
            ['人物', '少男、闲人、山中人。'],
            ['人事', '阻隔、守静、进退不决、反背、止住、不见。'],
            ['身体', '手指、骨、鼻、背；病主手指、脾胃之疾。'],
            ['物象', '土石、瓜果、黄物、土中之物；虎、狗、鼠、百兽。'],
            ['数目', '五、七、十；色黄；味甘。'],
        ],
        '人物：少男、闲人、山中人。人事：阻隔、守静、进退不决、反背、止住、不见。身体：手指、骨、鼻、背。',
        '人物为少男、闲人、山里人；人事主阻隔、守静、进退不决、背离、停止、不得相见；身体为手指、骨、鼻、背。',
    ),
    trigram(
        '坤', '坤为地', '先天八 · 土 · 西南 · 顺',
        '三爻皆阴，象地，性柔顺。类象为老母、农夫、众人，物为方物、布帛、五谷、瓦器。',
        '辰戌丑未月旺，春衰；春占多不利',
        [
            ['天时', '云阴、雾气。'],
            ['地理', '田野、乡里、平地、西南方。'],
            ['人物', '老母、后母、农夫、乡人、众人、大腹人。'],
            ['人事', '吝啬、柔顺、懦弱、众多。'],
            ['身体', '腹、脾、胃、肉；病主腹疾、脾胃、饮食停伤。'],
            ['物象', '方物、柔物、布帛、丝绵、五谷、舆釜、瓦器；牛、百兽、牝马。'],
            ['数目', '八、五、十；色黄、黑；味甘。'],
        ],
        '人物：老母、后母、农夫、乡人、众人、大腹人。人事：吝啬、柔顺、懦弱、众多。身体：腹、脾、胃、肉。',
        '人物为老母、后母、农夫、乡人、众人、大腹之人；人事主吝啬、柔顺、懦弱、众多；身体为腹、脾、胃、肌肉。',
    ),
];
