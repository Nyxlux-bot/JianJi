/**
 * 术语精解统一数据结构
 * 供排盘页「原地精解弹窗」与书阁「速查」共用，按术数分模块维护。
 */

export type GlossaryCategory =
    | 'bazi-shishen'
    | 'bazi-changsheng'
    | 'bazi-nayin'
    | 'bazi-shensha'
    | 'bazi-rizhu'
    | 'bazi-palace'
    | 'bazi-relation'
    | 'meihua-tiyong'
    | 'meihua-gua'
    | 'trigram-image'
    | 'wuxing-season'
    | 'liuyao-liuqin'
    | 'liuyao-liushen'
    | 'liuyao-yao'
    | 'liuyao-status'
    | 'liuyao-guaxing'
    | 'liuyao-shensha';

export type GlossaryNature = 'auspicious' | 'inauspicious' | 'neutral';

export type GlossaryItemTone = 'favorable' | 'unfavorable' | 'neutral';

export interface GlossaryClassicBookLink {
    /** 对应 src/data/classics/index.json 中的书目 id */
    bookId: string;
    /** 书名，不含书名号，如「渊海子平」 */
    bookTitle: string;
    /** 对应 src/data/classics/index.json 中的章节 id */
    chapterId: string;
    /** 章节名，如「论纳音取象」 */
    chapterTitle: string;
    /** 弹窗底栏显示的章名，缺省用 chapterTitle；书阁章名不达意时用，如《增删卜易》「两现章」里收的星煞章 */
    label?: string;
}

export interface GlossaryClassicCitation {
    /** 出处标题，如「《渊海子平》」「《三命通会·论纳音取象》」 */
    source: string;
    /** 古籍原文或传统口诀 */
    original: string;
    /** 白话今译（原文已极浅白时可省略） */
    translation?: string;
    /** 精准对应的站内书阁章节（可选） */
    bookLink?: GlossaryClassicBookLink;
}

export interface GlossaryDetailItem {
    /** 条目标签，如「为喜」「为忌」「生身」「戊辰木」「天时」 */
    label: string;
    /** 条目说明正文 */
    content: string;
    /** 可选语义倾向，供前端轻度着色 */
    tone?: GlossaryItemTone;
}

export interface GlossaryDetailBlock {
    /** 分节标题，如「心性」「取象」「古诀」「十神功用」「查法」「逐柱辨析」「落柱要点」 */
    heading: string;
    /** 分段正文 */
    paragraphs?: string[];
    /** 结构化要点列表 */
    items?: GlossaryDetailItem[];
}

export interface GlossaryEntry {
    /** 稳定唯一标识，格式为 `<domain>:<canonicalName>` */
    id: string;
    category: GlossaryCategory;
    /** 展示用类目短标，如「十神」「十二长生」「纳音」「神煞」「体用诀」「八卦类象」 */
    categoryLabel: string;
    /** 居中主标题 */
    title: string;
    /** 副标题或补充元信息，如「戊辰 · 己巳 · 木」「贵人 · 吉神」「气势强旺 · 古法四贵」 */
    subtitle?: string;
    /** 别名，供归一查询 */
    aliases?: string[];
    /** 吉凶或属性倾向 */
    nature?: GlossaryNature;
    /** 顶部「精评」总括，直指核心 */
    summary: string;
    /** 重点观察提示，如「主看日柱、年柱」「主看月令与透干」 */
    focusHint?: string;
    /** 结构化精解分块 */
    blocks: GlossaryDetailBlock[];
    /** 古籍原文与白话今译引证 */
    citations: GlossaryClassicCitation[];
    /** 弹窗底部直达书阁的推荐章节（均核验存在于 classics/index.json） */
    bookLinks: GlossaryClassicBookLink[];
}
