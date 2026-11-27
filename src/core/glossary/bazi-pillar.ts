import type { GlossaryClassicBookLink, GlossaryEntry } from './types';

/**
 * 日主与宫星：四柱表日柱的「元男 / 元女」，合盘页反复出现的夫妻宫、子女宫、夫星、妻星。
 * 原文均核自站内《渊海子平》《子平真诠》《滴天髓阐微》。
 */

const LINK_YH_JICHU: GlossaryClassicBookLink = { bookId: 'yuanhaiziping', bookTitle: '渊海子平', chapterId: 'yuanhaiziping-001', chapterTitle: '基础' };
const LINK_YH_LIUQIN: GlossaryClassicBookLink = { bookId: 'yuanhaiziping', bookTitle: '渊海子平', chapterId: 'yuanhaiziping-004', chapterTitle: '六亲' };
const LINK_YH_KANMING: GlossaryClassicBookLink = { bookId: 'yuanhaiziping', bookTitle: '渊海子平', chapterId: 'yuanhaiziping-010', chapterTitle: '看命入式' };
const LINK_ZP_QIZI: GlossaryClassicBookLink = { bookId: 'zipingzhenquan', bookTitle: '子平真诠', chapterId: 'zipingzhenquan-025', chapterTitle: '论妻子' };
const LINK_DT_FUQI: GlossaryClassicBookLink = { bookId: 'ditiansuichanwei', bookTitle: '滴天髓阐微', chapterId: 'ditiansuichanwei-036', chapterTitle: '夫妻' };
const LINK_DT_NVMING: GlossaryClassicBookLink = { bookId: 'ditiansuichanwei', bookTitle: '滴天髓阐微', chapterId: 'ditiansuichanwei-041', chapterTitle: '女命' };

export const BAZI_RIZHU_GLOSSARY: GlossaryEntry[] = [
    {
        id: 'rizhu:日主',
        category: 'bazi-rizhu',
        categoryLabel: '日主',
        title: '日主',
        subtitle: '日干为我 · 论命之主',
        aliases: ['元男', '元女', '日元', '日干', '命主'],
        nature: 'neutral',
        summary: '日柱天干代表命主自己。子平法以日干为主，先看它在月令、四柱里是旺是弱，再论十神喜忌、取用神。四柱表里的「元男」「元女」就是日主，同时标出命主性别。',
        focusHint: '先看日主得令、得地、得势与否，再论十神喜忌',
        blocks: [
            {
                heading: '看法',
                paragraphs: ['以日为主，年为本，月为提纲，时为辅佐：先看日干坐在什么地支、身旺还是身弱，再看地支格局与月令五行，最后参看岁运。'],
            },
            {
                heading: '日主与十神',
                paragraphs: ['十神都从日主推出，《渊海子平》归为五类：'],
                items: [
                    { label: '官杀', content: '克我者，阳克阳、阴克阴为七杀，异性为正官。' },
                    { label: '财星', content: '我克者，正财、偏财。' },
                    { label: '印绶', content: '生我者，正印、偏印（倒食）。' },
                    { label: '食伤', content: '我生者，食神、伤官。' },
                    { label: '比劫', content: '同我者，比肩、劫财。' },
                ],
            },
        ],
        citations: [
            {
                source: '《渊海子平·论日为主》',
                original: '至于宋时，方有子平之说；取日干为主，以年为根，以月为苗，以日为花，以时为果；以生旺死绝休囚制化，决人生休咎。',
                translation: '到了宋代才有子平之法：以日干为命主，年为根、月为苗、日为花、时为果，用生旺死绝、休囚制化来判断一生吉凶。',
                bookLink: LINK_YH_JICHU,
            },
            {
                source: '《渊海子平·看命入式》',
                original: '日干为己身，日支为妻妾，则知妻妾之贤淑。',
                translation: '日干代表自己，日支代表配偶，由此看配偶贤淑与否。',
                bookLink: LINK_YH_KANMING,
            },
        ],
        bookLinks: [LINK_YH_JICHU, LINK_YH_KANMING],
    },
];

export const BAZI_PALACE_GLOSSARY: GlossaryEntry[] = [
    {
        id: 'palace:夫妻宫',
        category: 'bazi-palace',
        categoryLabel: '宫位',
        title: '夫妻宫',
        subtitle: '日柱地支 · 配偶之位',
        aliases: ['妻宫', '夫宫', '配偶宫'],
        nature: 'neutral',
        summary: '日柱地支为夫妻宫，男命称妻宫，女命称夫宫，看配偶与婚姻的落点。坐的是什么十神，吉凶要按月令用神的喜忌来定，不能只看名目。',
        focusHint: '合盘看两人日支的合、冲、刑、害，再看各自月令喜忌',
        blocks: [
            {
                heading: '看法',
                paragraphs: ['日支为配偶之位。合盘时，两人日支相合多主相投，相冲多主磨合，再结合各自的喜忌看能否承接。'],
            },
            {
                heading: '坐下十神',
                items: [
                    { label: '坐财官', tone: 'favorable', content: '一般主配偶贤良；但月令用印的，见财反为不美。' },
                    { label: '坐伤刃', tone: 'unfavorable', content: '一般不吉；但财格、煞格得之，反主配偶能内助。' },
                ],
            },
        ],
        citations: [
            {
                source: '《子平真诠·论妻子》',
                original: '以妻论之，坐下财官，妻当贤贵；然亦有坐财官而妻不利，逢伤刃而妻反吉者，何也？此盖月令用神，配成喜忌。',
                translation: '论妻：日支坐财官，妻子多贤贵；但也有坐财官反而不利、坐伤官羊刃反而吉的，原因在于要按月令用神来配喜忌。',
                bookLink: LINK_ZP_QIZI,
            },
            {
                source: '《渊海子平·看命入式》',
                original: '日干为己身，日支为妻妾，则知妻妾之贤淑。',
                translation: '日干代表自己，日支代表配偶，由此看配偶贤淑与否。',
                bookLink: LINK_YH_KANMING,
            },
        ],
        bookLinks: [LINK_ZP_QIZI, LINK_YH_KANMING],
    },
    {
        id: 'palace:子女宫',
        category: 'bazi-palace',
        categoryLabel: '宫位',
        title: '子女宫',
        subtitle: '时柱 · 子息之位',
        aliases: ['子息宫', '时柱子女宫'],
        nature: 'neutral',
        summary: '时柱为子女宫，看子息与晚景。看法与夫妻宫相近：看时柱所坐，以及子女星是喜是忌。',
        focusHint: '合盘看两人时柱的合冲，并配合男命官杀、女命食伤',
        blocks: [
            {
                heading: '看法',
                paragraphs: ['时柱为子息之位。子女星男命看官杀，女命看食伤（《渊海子平·六亲》）。'],
            },
        ],
        citations: [
            {
                source: '《渊海子平·看命入式》',
                original: '时为花实，为子息，方知嗣续之所归。',
                translation: '时柱如同花与果实，代表子女，由此看后代的归宿。',
                bookLink: LINK_YH_KANMING,
            },
            {
                source: '《子平真诠·论妻子》',
                original: '至于子息，其看宫分与星所透喜忌，理与论妻略同。',
                translation: '看子女时，看宫位与子女星透出的喜忌，道理和看妻大致相同。',
                bookLink: LINK_ZP_QIZI,
            },
        ],
        bookLinks: [LINK_YH_KANMING, LINK_ZP_QIZI],
    },
    {
        id: 'palace:妻星',
        category: 'bazi-palace',
        categoryLabel: '宫星',
        title: '妻星',
        subtitle: '男命 · 以财为妻',
        aliases: ['男命妻星', '男命财星'],
        nature: 'neutral',
        summary: '男命以财星论妻：正财为妻，偏财为妾，今多看作偏缘。财星是喜是忌、有无承接，比盘里有没有财星更要紧。',
        focusHint: '财星为喜且有承接为美；财旺身弱喜比劫帮身',
        blocks: [
            {
                heading: '看法',
                items: [
                    { label: '正财', content: '为妻。' },
                    { label: '偏财', content: '为妾，又为父。' },
                ],
            },
            {
                heading: '活看财星',
                paragraphs: ['财星薄的要助财；财旺身弱，又喜比劫；财星伤印的，要官星通关（《滴天髓阐微·夫妻》原注）。'],
            },
        ],
        citations: [
            {
                source: '《滴天髓阐微·夫妻》',
                original: '夫妻因缘宿世来，喜神有意傍天财。',
                translation: '夫妻缘分由来已久；财星若是喜神，配偶多佳。',
                bookLink: LINK_DT_FUQI,
            },
            {
                source: '《渊海子平·六亲》',
                original: '正财为妻；偏财为妾，为父是也。',
                translation: '正财是妻子，偏财是妾，也代表父亲。',
                bookLink: LINK_YH_LIUQIN,
            },
        ],
        bookLinks: [LINK_DT_FUQI, LINK_YH_LIUQIN],
    },
    {
        id: 'palace:夫星',
        category: 'bazi-palace',
        categoryLabel: '宫星',
        title: '夫星',
        subtitle: '女命 · 以官为夫',
        aliases: ['女命夫星'],
        nature: 'neutral',
        summary: '女命以官星论夫：正官为夫，七杀为偏夫。官星明顺，夫贵而吉；官星太旺或太微，古法另取伤官、财星等为夫，要看全局而定。',
        focusHint: '官星明顺为美；官杀混杂、伤官见官须看制化',
        blocks: [
            {
                heading: '看法',
                items: [
                    { label: '正官', content: '为夫。' },
                    { label: '七杀', content: '为偏夫。' },
                ],
            },
            {
                heading: '活看官星',
                paragraphs: ['官星太旺，以伤官为夫；官星太微，以财为夫（《滴天髓阐微·女命》原注）。'],
            },
        ],
        citations: [
            {
                source: '《渊海子平·六亲》',
                original: '妇人命取六亲，与男命不同：取官星为夫星；七杀是偏夫；食神是男；伤官是女。',
                translation: '女命取六亲和男命不同：以官星为夫星，七杀为偏夫，食神为儿子，伤官为女儿。',
                bookLink: LINK_YH_LIUQIN,
            },
            {
                source: '《滴天髓阐微·女命》',
                original: '局中官星明顺，夫贵而吉，理自然矣。若官星太旺，以伤官为夫，官星太微，以财为夫。',
                translation: '命局官星清明顺遂，丈夫显贵而吉利，这是自然之理。官星过旺时以伤官为夫，官星太弱时以财星为夫。',
                bookLink: LINK_DT_NVMING,
            },
        ],
        bookLinks: [LINK_YH_LIUQIN, LINK_DT_NVMING],
    },
];
