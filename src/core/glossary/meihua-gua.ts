import type { GlossaryClassicBookLink, GlossaryDetailBlock, GlossaryEntry } from './types';

/**
 * 梅花三卦（本、互、变）、体卦用卦与卦气。
 * 原文核自站内《梅花易数》：周易卦数、体用总诀、天时占（人事占）、三要灵应篇（衰旺论）、观梅数诀序。
 */

const LINK_GUASHU: GlossaryClassicBookLink = { bookId: 'meihuayishu', bookTitle: '梅花易数', chapterId: 'meihuayishu-002', chapterTitle: '周易卦数' };
const LINK_TIYONG: GlossaryClassicBookLink = { bookId: 'meihuayishu', bookTitle: '梅花易数', chapterId: 'meihuayishu-005', chapterTitle: '体用总诀' };
const LINK_ZHANLI: GlossaryClassicBookLink = { bookId: 'meihuayishu', bookTitle: '梅花易数', chapterId: 'meihuayishu-006', chapterTitle: '天时占第一' };
const LINK_SANYAO: GlossaryClassicBookLink = { bookId: 'meihuayishu', bookTitle: '梅花易数', chapterId: 'meihuayishu-008', chapterTitle: '三要灵应篇' };
const LINK_GUANMEI: GlossaryClassicBookLink = { bookId: 'meihuayishu', bookTitle: '梅花易数', chapterId: 'meihuayishu-010', chapterTitle: '观梅数诀序' };

const THREE_GUA: GlossaryDetailBlock = {
    heading: '三卦分工',
    items: [
        { label: '本卦', content: '事之始，看体用定大局。' },
        { label: '互卦', content: '事之中，看中途的助力与阻碍。' },
        { label: '变卦', content: '事之终，看结局。' },
    ],
};

export const MEIHUA_GUA_GLOSSARY: GlossaryEntry[] = [
    {
        id: 'meihua:本卦',
        category: 'meihua-gua',
        categoryLabel: '三卦',
        title: '本卦',
        subtitle: '事之始 · 起卦所得',
        aliases: ['主卦'],
        nature: 'neutral',
        summary: '起卦所得的六爻卦，看事情的起点。动爻所在的经卦为用卦，另一个经卦为体卦，先由本卦的体用生克定吉凶大势。',
        focusHint: '先看体用生克与体卦旺衰，再看互卦、变卦',
        blocks: [
            {
                heading: '起卦',
                paragraphs: ['时间起卦：年、月、日数相加，除八取余为上卦；再加时数，除八取余为下卦；总数除六取余为动爻。'],
            },
            THREE_GUA,
        ],
        citations: [
            {
                source: '《梅花易数·年月日时起例》',
                original: '年月日为上卦。年月日加时总数为下卦。又以年月日时总数取爻。',
                translation: '年、月、日之数定上卦，年、月、日再加时数定下卦，年月日时总数定动爻。',
                bookLink: LINK_GUASHU,
            },
            {
                source: '《梅花易数·人事占》',
                original: '人事之占，详观体用。体卦为主，用卦为宾。……更详观互卦、变卦，以断吉凶；复究盛衰，以明休咎。',
                translation: '占人事，先细看体用：体卦为主，用卦为宾。再看互卦、变卦断吉凶，并推究卦气盛衰来明辨祸福。',
                bookLink: LINK_ZHANLI,
            },
        ],
        bookLinks: [LINK_GUASHU, LINK_TIYONG],
    },
    {
        id: 'meihua:互卦',
        category: 'meihua-gua',
        categoryLabel: '三卦',
        title: '互卦',
        subtitle: '事之中 · 本卦中间四爻',
        aliases: ['互'],
        nature: 'neutral',
        summary: '本卦去掉初爻、上爻，用中间四爻重新分成上下两卦，就是互卦，看事情发展的中途。乾、坤两卦没有互卦，取其变卦来互。',
        focusHint: '互卦生体，中途有助；互卦克体或泄体，中途多阻',
        blocks: [
            {
                heading: '取法',
                items: [
                    { label: '下互', content: '本卦二、三、四爻。' },
                    { label: '上互', content: '本卦三、四、五爻。' },
                    { label: '乾坤', content: '纯乾、纯坤去爻后仍是本卦，改取变卦的互卦。' },
                ],
            },
            THREE_GUA,
        ],
        citations: [
            {
                source: '《梅花易数·互卦起例》',
                original: '互卦只用八卦，不必取六十四卦名。互卦以重卦去了初爻及第六爻，以中间四爻分作两卦，看得何卦。又云：乾坤无互，互其变卦。',
                translation: '互卦只看八卦，不必叫出六十四卦名：把重卦去掉初爻和上爻，中间四爻分成两个三爻卦，看是什么卦。又说：乾、坤没有互卦，用它们的变卦来取互。',
                bookLink: LINK_GUASHU,
            },
            {
                source: '《梅花易数·体用总诀》',
                original: '大抵体用之说，体卦为主，用卦为事，互卦为事之中间，刻应变卦为事之终。',
                translation: '体用之法大要：体卦为主，用卦为所占之事，互卦看事情的中间，变卦看事情的结局。',
                bookLink: LINK_TIYONG,
            },
        ],
        bookLinks: [LINK_GUASHU, LINK_TIYONG],
    },
    {
        id: 'meihua:变卦',
        category: 'meihua-gua',
        categoryLabel: '三卦',
        title: '变卦',
        subtitle: '事之终 · 动爻阴阳互变',
        aliases: ['之卦'],
        nature: 'neutral',
        summary: '本卦动爻阳变阴、阴变阳所得之卦，看事情的结局。体卦不动，看变出的用卦对体卦是生是克。',
        focusHint: '用吉变凶，先吉后凶；用凶变吉，先凶后吉',
        blocks: [
            {
                heading: '看法',
                paragraphs: ['变卦的用卦生体、比和，结局多顺；克体、泄体，结局多耗多阻。与本卦体用合看，便知前后有无转折。'],
            },
            THREE_GUA,
        ],
        citations: [
            {
                source: '《梅花易数·爻以六除》',
                original: '若一爻动，则看此一爻，是阳爻则变阴爻，阴爻则变阳爻。',
                translation: '有一爻发动，就看这一爻：阳爻变为阴爻，阴爻变为阳爻。',
                bookLink: LINK_GUASHU,
            },
            {
                source: '《梅花易数·体用总诀》',
                original: '体用之间，比和则吉，互乃中间之应，变乃末后之期。故用吉变凶者，先吉后凶；用凶变吉者，先凶后吉。',
                translation: '体用比和为吉；互卦应在中途，变卦应在最后。所以用卦吉而变卦凶，是先吉后凶；用卦凶而变卦吉，是先凶后吉。',
                bookLink: LINK_TIYONG,
            },
        ],
        bookLinks: [LINK_TIYONG, LINK_GUASHU],
    },
    {
        id: 'meihua:体卦',
        category: 'meihua-gua',
        categoryLabel: '体用',
        title: '体卦',
        subtitle: '静卦 · 代表自己',
        aliases: ['体'],
        nature: 'neutral',
        summary: '本卦上下两个经卦中，没有动爻的一个为体卦，代表占卦的人自己或事情的主体。梅花断卦以体为主，看其余各卦对体卦是生是克。',
        focusHint: '体卦宜旺，宜受生，不宜受克',
        blocks: [
            {
                heading: '宜忌',
                items: [
                    { label: '宜', tone: 'favorable', content: '得月令旺相；受用、互、变卦之生；与之比和。' },
                    { label: '忌', tone: 'unfavorable', content: '休囚无气；被他卦所克；去生他卦而泄气。' },
                    { label: '体党', content: '互、变卦多与体卦同五行，体势盛；多与用卦同五行，用势盛。' },
                ],
            },
        ],
        citations: [
            {
                source: '《梅花易数·观梅数诀序》',
                original: '体用于变爻，作动静取之。动者为用，静者为体。',
                translation: '体用由动爻来分：有动爻的为用，没有动爻的为体。',
                bookLink: LINK_GUANMEI,
            },
            {
                source: '《梅花易数·体用总诀》',
                original: '宜受他卦之生，不宜他卦之克。他卦者，谓用互变也。',
                translation: '体卦宜受他卦之生，不宜受他卦之克；他卦指用卦、互卦、变卦。',
                bookLink: LINK_TIYONG,
            },
            {
                source: '《梅花易数·衰旺论》',
                original: '凡占卜，体卦宜盛旺。气旺而又逢生则吉，重遇克则凶。若体衰而逢克，则其凶甚矣。体衰而有生体之卦，则衰稍解。',
                translation: '占卜时体卦宜旺。体旺又得生为吉，受重克为凶；体衰又受克，凶上加凶；体衰而有生体之卦，衰势稍可缓解。',
                bookLink: LINK_SANYAO,
            },
        ],
        bookLinks: [LINK_TIYONG, LINK_SANYAO],
    },
    {
        id: 'meihua:用卦',
        category: 'meihua-gua',
        categoryLabel: '体用',
        title: '用卦',
        subtitle: '动卦 · 代表所占之事',
        aliases: ['用'],
        nature: 'neutral',
        summary: '本卦中有动爻的经卦为用卦，代表所占的事、对方或外境。用卦生体、比和为吉，体克用也吉；用卦克体、体生用为不利。',
        focusHint: '用宜受体之克，不宜克体',
        blocks: [
            {
                heading: '体用五种',
                items: [
                    { label: '比和', tone: 'favorable', content: '体用同五行，百事顺遂。' },
                    { label: '用生体', tone: 'favorable', content: '有进益之喜。' },
                    { label: '体克用', tone: 'favorable', content: '我能制事，诸事吉。' },
                    { label: '用克体', tone: 'unfavorable', content: '诸事凶。' },
                    { label: '体生用', tone: 'unfavorable', content: '泄气，有耗失之患。' },
                ],
            },
        ],
        citations: [
            {
                source: '《梅花易数·体用总诀》',
                original: '体用之说，动静之机，八卦主宾。五行生克，体为己身之兆，用为应事之端。体宜受用卦之生，用宜见卦体之克。',
                translation: '体用讲的是动静之机、八卦的主宾：体卦是自身之兆，用卦是所应之事的开端。体卦宜受用卦之生，用卦宜受体卦之克。',
                bookLink: LINK_TIYONG,
            },
        ],
        bookLinks: [LINK_TIYONG, LINK_GUANMEI],
    },
    {
        id: 'meihua:卦气',
        category: 'meihua-gua',
        categoryLabel: '卦气',
        title: '卦气',
        subtitle: '月令定体用强弱',
        aliases: ['卦气旺衰', '卦气衰旺', '衰旺', '旺衰'],
        nature: 'neutral',
        summary: '八卦按五行配四时：当令为旺，被月令所克为衰。体卦旺，虽受克也有承当；体卦衰又被克，凶势更重。本页按月令把五行分为旺、相、休、囚、死五等，书中的「衰」就是其中的「死」。',
        focusHint: '体卦宜旺，生体之卦宜旺，克体之卦宜衰',
        blocks: [
            {
                heading: '卦气旺衰',
                items: [
                    { label: '春', content: '震巽木旺，坤艮土衰。' },
                    { label: '夏', content: '离火旺，乾兑金衰。' },
                    { label: '秋', content: '乾兑金旺，震巽木衰。' },
                    { label: '冬', content: '坎水旺，离火衰。' },
                    { label: '四季', content: '辰戌丑未月坤艮土旺，坎水衰。' },
                ],
            },
        ],
        citations: [
            {
                source: '《梅花易数·卦气旺、卦气衰》',
                original: '震、巽木旺于春，离火旺于夏，乾、兑金旺于秋，坎水旺于冬，坤、艮土旺于辰戌丑未月。……春坤、艮，夏乾、兑，秋震、巽，冬离，辰戌丑未坎。',
                translation: '卦气旺：震巽木旺于春，离火旺于夏，乾兑金旺于秋，坎水旺于冬，坤艮土旺于辰戌丑未月。卦气衰：春坤艮，夏乾兑，秋震巽，冬离，辰戌丑未月坎。',
                bookLink: LINK_GUASHU,
            },
            {
                source: '《梅花易数·衰旺论》',
                original: '大抵体之卦宜旺，生体之卦气亦宜旺。克体之卦气宜衰。此心易论衰旺之诀也。',
                translation: '总之体卦宜旺，生体之卦也宜旺，克体之卦则宜衰，这是心易论衰旺的要诀。',
                bookLink: LINK_SANYAO,
            },
        ],
        bookLinks: [LINK_GUASHU, LINK_SANYAO],
    },
];
