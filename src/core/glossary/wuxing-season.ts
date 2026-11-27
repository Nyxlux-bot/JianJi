import type { GlossaryClassicBookLink, GlossaryDetailBlock, GlossaryEntry } from './types';

/**
 * 五行旺相休囚死：梅花「卦气」、六爻「时令」两张卡共用。
 * 原文核自站内《三命通会·论五行旺相休囚死并寄生十二宫》《梅花易数》《增删卜易·四时旺相章》。
 */

export type SeasonState = '旺' | '相' | '休' | '囚' | '死';
export const SEASON_ORDER: SeasonState[] = ['旺', '相', '休', '囚', '死'];

const LINK_SM: GlossaryClassicBookLink = { bookId: 'sanmingtonghui', bookTitle: '三命通会', chapterId: 'sanmingtonghui-021', chapterTitle: '论五行旺相休囚死并寄生十二宫' };
const LINK_MH_GUASHU: GlossaryClassicBookLink = { bookId: 'meihuayishu', bookTitle: '梅花易数', chapterId: 'meihuayishu-002', chapterTitle: '周易卦数' };
const LINK_MH_SANYAO: GlossaryClassicBookLink = { bookId: 'meihuayishu', bookTitle: '梅花易数', chapterId: 'meihuayishu-008', chapterTitle: '三要灵应篇' };
const LINK_ZS_SISHI: GlossaryClassicBookLink = { bookId: 'zengshanbuyi', bookTitle: '增删卜易', chapterId: 'zengshanbuyi-017', chapterTitle: '四时旺相章第又十五' };

const TABLE: GlossaryDetailBlock = {
    heading: '四时五行',
    items: [
        { label: '春', content: '寅卯月：木旺、火相、水休、金囚、土死。' },
        { label: '夏', content: '巳午月：火旺、土相、木休、水囚、金死。' },
        { label: '秋', content: '申酉月：金旺、水相、土休、火囚、木死。' },
        { label: '冬', content: '亥子月：水旺、木相、金休、土囚、火死。' },
        { label: '四季', content: '辰戌丑未月：土旺、金相、火休、木囚、水死。' },
    ],
};

const RULE: GlossaryDetailBlock = {
    heading: '推法',
    paragraphs: ['以月令五行为准：与月令同五行为旺，月令所生为相，生月令者为休，克月令者为囚，被月令所克为死。'],
};

const season = (
    state: SeasonState,
    subtitle: string,
    summary: string,
    focusHint: string,
    usage: GlossaryDetailBlock,
    citations: GlossaryEntry['citations'],
    bookLinks: GlossaryClassicBookLink[],
): GlossaryEntry => ({
    id: `season:${state}`,
    category: 'wuxing-season',
    categoryLabel: '旺衰',
    title: state,
    subtitle,
    nature: 'neutral',
    summary,
    focusHint,
    blocks: [RULE, TABLE, usage],
    citations,
    bookLinks,
});

export const WUXING_SEASON_GLOSSARY: GlossaryEntry[] = [
    season(
        '旺',
        '与月令同五行 · 当令',
        '五行与月令同气，正当其时，力量最足：春木、夏火、秋金、冬水、辰戌丑未月土为旺。',
        '旺而太过也要看制化，不能一概论吉',
        {
            heading: '各术里的用法',
            items: [
                { label: '梅花', content: '体卦旺，即使受克也有承当；克体之卦旺，凶势加重。' },
                { label: '六爻', content: '用神旺相，吉事易成；旺相的静爻逢日辰相冲为暗动，反得其力。' },
            ],
        },
        [
            {
                source: '《三命通会·论五行旺相休囚死》',
                original: '盛德乘时曰旺……凡推造化见生旺者未必便作吉论，见休囚死绝未必便作凶言。',
                translation: '五行得时、气势正盛叫做旺。但推命时，见生旺未必就论吉，见休囚死绝也未必就论凶。',
                bookLink: LINK_SM,
            },
            {
                source: '《梅花易数·三要灵应篇》',
                original: '旺者，如寅卯之月日则木旺，巳午之月日火旺，申酉之月日金旺，亥子之月日水旺，辰戌丑未之月日土旺。',
                translation: '寅卯月日木旺，巳午月日火旺，申酉月日金旺，亥子月日水旺，辰戌丑未月日土旺。',
                bookLink: LINK_MH_SANYAO,
            },
        ],
        [LINK_SM, LINK_MH_SANYAO],
    ),
    season(
        '相',
        '月令所生 · 次旺',
        '月令所生的五行，承接当令之气，力量仅次于旺。如春月木旺，木生火，火为相。',
        '相与旺同属得令，论强弱时可归为一类',
        {
            heading: '各术里的用法',
            items: [
                { label: '梅花', content: '体卦相，与旺同论，受克也有承当。' },
                { label: '六爻', content: '旺相之爻有力，静而不动也能生克休囚之爻。' },
            ],
        },
        [
            {
                source: '《三命通会·论五行旺相休囚死》',
                original: '旺则生火，火乃木之子，子乘父业，故火相。',
                translation: '春木旺则生火，火是木之子，儿子承接父业，所以火为相。',
                bookLink: LINK_SM,
            },
            {
                source: '《增删卜易·四时旺相章》',
                original: '三月辰为月建辰土旺，丑未之土次之，土生金，金为相，相虽不旺，还有余气。',
                translation: '三月辰土当令为旺，丑未土次之；土生金，金为相，相虽不及旺，仍有余气。',
                bookLink: LINK_ZS_SISHI,
            },
        ],
        [LINK_SM, LINK_ZS_SISHI],
    ),
    season(
        '休',
        '生月令者 · 退而无事',
        '去生月令的五行，把气交给了当令者，自己退下休息，力量平平。如春月水生木，水为休。',
        '休者不旺也不受克，得生扶便可用',
        {
            heading: '各术里的用法',
            items: [
                { label: '梅花', content: '体卦休，气平平，成事须借外力。' },
                { label: '六爻', content: '休囚之爻静而无助则少力，得日辰、动爻生扶仍可用。' },
            ],
        },
        [
            {
                source: '《三命通会·论五行旺相休囚死》',
                original: '木用水生，生我者父母，今子嗣得时，登高明显赫之地，而生我者当知退矣，故水休。休者，美之无极，休然无事之义。',
                translation: '木靠水生，水是木的父母；如今儿子得时显赫，生它的父母便该退下，所以水为休。休，是功成身退、安然无事的意思。',
                bookLink: LINK_SM,
            },
        ],
        [LINK_SM],
    ),
    season(
        '囚',
        '克月令者 · 受制',
        '去克月令的五行，反被当令一方的气势所制，施展不开。如春月金克木，木旺而金囚。',
        '囚者无气，须得日辰、动爻生扶方能起',
        {
            heading: '各术里的用法',
            items: [
                { label: '梅花', content: '体卦囚而用卦克体，衰而逢克，凶势更重。' },
                { label: '六爻', content: '休囚之静爻逢日辰相冲为日破，愈加无用。' },
            ],
        },
        [
            {
                source: '《三命通会·论五行旺相休囚死》',
                original: '火能克金，金乃木之鬼，被火克制，不能施设，故金囚。',
                translation: '春天火相能克金，金本是克木的，此时反被火制住，施展不开，所以金为囚。',
                bookLink: LINK_SM,
            },
        ],
        [LINK_SM, LINK_ZS_SISHI],
    ),
    season(
        '死',
        '被月令所克 · 最衰',
        '被月令克制的五行，最为衰弱。如春月木克土，土为死。《梅花易数》说的「卦气衰」，就是这一等。',
        '体卦逢死最忌再受克；有生体之卦，衰可稍解',
        {
            heading: '各术里的用法',
            items: [
                { label: '梅花', content: '春坤艮、夏乾兑、秋震巽、冬离、四季月坎，卦气皆衰。' },
                { label: '六爻', content: '用神死于月令又无生扶，诸事难成。' },
            ],
        },
        [
            {
                source: '《三命通会·论五行旺相休囚死》',
                original: '火能生土，土为木之财，财为隐藏之物，草木发生，土散气尘，所以春木克土则死。',
                translation: '土是木所克的财，春天草木生发，土气被耗散，所以春木当令时土为死。',
                bookLink: LINK_SM,
            },
            {
                source: '《梅花易数·卦气衰》',
                original: '春坤、艮，夏乾、兑，秋震、巽，冬离，辰戌丑未坎。',
                translation: '春天坤艮土衰，夏天乾兑金衰，秋天震巽木衰，冬天离火衰，辰戌丑未月坎水衰。',
                bookLink: LINK_MH_GUASHU,
            },
        ],
        [LINK_SM, LINK_MH_GUASHU],
    ),
];
