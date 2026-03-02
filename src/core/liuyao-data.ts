/**
 * 六爻排盘核心数据库
 */

// ==================== 基础类型 ====================
export type YaoValue = 6 | 7 | 8 | 9;
export type YaoNature = 'yang' | 'yin';
export type WuXing = '金' | '木' | '水' | '火' | '土';
export type LiuQin = '父母' | '兄弟' | '子孙' | '妻财' | '官鬼';
export type LiuShen = '青龙' | '朱雀' | '勾陈' | '螣蛇' | '白虎' | '玄武';
export type DivinationMethod = 'time' | 'coin' | 'number' | 'manual';

// ==================== 天干地支 ====================
export const TIAN_GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const;
export const DI_ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const;

export const TIANGAN_WUXING: Record<string, WuXing> = {
    '甲': '木', '乙': '木', '丙': '火', '丁': '火', '戊': '土', '己': '土', '庚': '金', '辛': '金', '壬': '水', '癸': '水',
};

export const DIZHI_WUXING: Record<string, WuXing> = {
    '子': '水', '丑': '土', '寅': '木', '卯': '木', '辰': '土', '巳': '火',
    '午': '火', '未': '土', '申': '金', '酉': '金', '戌': '土', '亥': '水',
};

export const DIZHI_INDEX: Record<string, number> = {
    '子': 1, '丑': 2, '寅': 3, '卯': 4, '辰': 5, '巳': 6, '午': 7, '未': 8, '申': 9, '酉': 10, '戌': 11, '亥': 12,
};

export const NAYIN: Record<string, string> = {
    '甲子': '海中金', '乙丑': '海中金', '丙寅': '炉中火', '丁卯': '炉中火',
    '戊辰': '大林木', '己巳': '大林木', '庚午': '路旁土', '辛未': '路旁土',
    '壬申': '剑锋金', '癸酉': '剑锋金', '甲戌': '山头火', '乙亥': '山头火',
    '丙子': '涧下水', '丁丑': '涧下水', '戊寅': '城头土', '己卯': '城头土',
    '庚辰': '白蜡金', '辛巳': '白蜡金', '壬午': '杨柳木', '癸未': '杨柳木',
    '甲申': '泉中水', '乙酉': '泉中水', '丙戌': '屋上土', '丁亥': '屋上土',
    '戊子': '霹雳火', '己丑': '霹雳火', '庚寅': '松柏木', '辛卯': '松柏木',
    '壬辰': '长流水', '癸巳': '长流水', '甲午': '沙中金', '乙未': '沙中金',
    '丙申': '山下火', '丁酉': '山下火', '戊戌': '平地木', '己亥': '平地木',
    '庚子': '壁上土', '辛丑': '壁上土', '壬寅': '金箔金', '癸卯': '金箔金',
    '甲辰': '覆灯火', '乙巳': '覆灯火', '丙午': '天河水', '丁未': '天河水',
    '戊申': '大驿土', '己酉': '大驿土', '庚戌': '钗钏金', '辛亥': '钗钏金',
    '壬子': '桑柘木', '癸丑': '桑柘木', '甲寅': '大溪水', '乙卯': '大溪水',
    '丙辰': '沙中土', '丁巳': '沙中土', '戊午': '天上火', '己未': '天上火',
    '庚申': '石榴木', '辛酉': '石榴木', '壬戌': '大海水', '癸亥': '大海水',
};

// ==================== 八卦 ====================
export interface BaGuaInfo {
    index: number;
    name: string;
    yao: [number, number, number]; // 从下到上 [初,二,三], 1=阳 0=阴
    wuxing: WuXing;
    nature: string;
}

/**
 * 先天八卦数: 1乾 2兑 3离 4震 5巽 6坎 7艮 8坤
 * yao从下到上: 乾[1,1,1] 兑[1,1,0] 离[1,0,1] 震[1,0,0] 巽[0,1,1] 坎[0,1,0] 艮[0,0,1] 坤[0,0,0]
 */
export const BA_GUA: Record<number, BaGuaInfo> = {
    1: { index: 1, name: '乾', yao: [1, 1, 1], wuxing: '金', nature: '天' },
    2: { index: 2, name: '兑', yao: [1, 1, 0], wuxing: '金', nature: '泽' },
    3: { index: 3, name: '离', yao: [1, 0, 1], wuxing: '火', nature: '火' },
    4: { index: 4, name: '震', yao: [1, 0, 0], wuxing: '木', nature: '雷' },
    5: { index: 5, name: '巽', yao: [0, 1, 1], wuxing: '木', nature: '风' },
    6: { index: 6, name: '坎', yao: [0, 1, 0], wuxing: '水', nature: '水' },
    7: { index: 7, name: '艮', yao: [0, 0, 1], wuxing: '土', nature: '山' },
    8: { index: 8, name: '坤', yao: [0, 0, 0], wuxing: '土', nature: '地' },
};

/** 通过三爻数组查找八卦先天数 */
export function yaoToGuaIndex(y1: number, y2: number, y3: number): number {
    // 先天数 = 8 - (y1*4 + y2*2 + y3)
    return 8 - (y1 * 4 + y2 * 2 + y3);
}

// ==================== 纳甲表 ====================
/**
 * 纳甲: 每个经卦作为内卦/外卦时各爻的天干地支
 * inner=内卦(下卦 yao1-3), outer=外卦(上卦 yao4-6)
 */
export const NA_JIA: Record<string, { inner: { gan: string; zhi: string[] }; outer: { gan: string; zhi: string[] } }> = {
    '乾': { inner: { gan: '甲', zhi: ['子', '寅', '辰'] }, outer: { gan: '壬', zhi: ['午', '申', '戌'] } },
    '坤': { inner: { gan: '乙', zhi: ['未', '巳', '卯'] }, outer: { gan: '癸', zhi: ['丑', '亥', '酉'] } },
    '震': { inner: { gan: '庚', zhi: ['子', '寅', '辰'] }, outer: { gan: '庚', zhi: ['午', '申', '戌'] } },
    '巽': { inner: { gan: '辛', zhi: ['丑', '亥', '酉'] }, outer: { gan: '辛', zhi: ['未', '巳', '卯'] } },
    '坎': { inner: { gan: '戊', zhi: ['寅', '辰', '午'] }, outer: { gan: '戊', zhi: ['申', '戌', '子'] } },
    '离': { inner: { gan: '己', zhi: ['卯', '丑', '亥'] }, outer: { gan: '己', zhi: ['酉', '未', '巳'] } },
    '艮': { inner: { gan: '丙', zhi: ['辰', '午', '申'] }, outer: { gan: '丙', zhi: ['戌', '子', '寅'] } },
    '兑': { inner: { gan: '丁', zhi: ['巳', '卯', '丑'] }, outer: { gan: '丁', zhi: ['亥', '酉', '未'] } },
};

// ==================== 六十四卦 ====================
export interface GuaInfo {
    name: string;
    fullName: string;
    upper: number;
    lower: number;
    gong: string;
    shiYao: number;
    yingYao: number;
}

/**
 * 六十四卦完整数据 Key="上卦先天数-下卦先天数"
 * 按八宫排列: 本卦→一世→二世→三世→四世→五世→游魂→归魂
 * 世应: 本(6,3) 一(1,4) 二(2,5) 三(3,6) 四(4,1) 五(5,2) 游(4,1) 归(3,6)
 */
export const GUA_64: Record<string, GuaInfo> = {
    // ===== 乾宫（金）=====
    '1-1': { name: '乾', fullName: '乾为天', upper: 1, lower: 1, gong: '乾', shiYao: 6, yingYao: 3 },
    '1-5': { name: '姤', fullName: '天风姤', upper: 1, lower: 5, gong: '乾', shiYao: 1, yingYao: 4 },
    '1-7': { name: '遁', fullName: '天山遁', upper: 1, lower: 7, gong: '乾', shiYao: 2, yingYao: 5 },
    '1-8': { name: '否', fullName: '天地否', upper: 1, lower: 8, gong: '乾', shiYao: 3, yingYao: 6 },
    '5-8': { name: '观', fullName: '风地观', upper: 5, lower: 8, gong: '乾', shiYao: 4, yingYao: 1 },
    '7-8': { name: '剥', fullName: '山地剥', upper: 7, lower: 8, gong: '乾', shiYao: 5, yingYao: 2 },
    '3-8': { name: '晋', fullName: '火地晋', upper: 3, lower: 8, gong: '乾', shiYao: 4, yingYao: 1 },
    '3-1': { name: '大有', fullName: '火天大有', upper: 3, lower: 1, gong: '乾', shiYao: 3, yingYao: 6 },

    // ===== 兑宫（金）=====
    '2-2': { name: '兑', fullName: '兑为泽', upper: 2, lower: 2, gong: '兑', shiYao: 6, yingYao: 3 },
    '2-6': { name: '困', fullName: '泽水困', upper: 2, lower: 6, gong: '兑', shiYao: 1, yingYao: 4 },
    '2-8': { name: '萃', fullName: '泽地萃', upper: 2, lower: 8, gong: '兑', shiYao: 2, yingYao: 5 },
    '2-7': { name: '咸', fullName: '泽山咸', upper: 2, lower: 7, gong: '兑', shiYao: 3, yingYao: 6 },
    '6-7': { name: '蹇', fullName: '水山蹇', upper: 6, lower: 7, gong: '兑', shiYao: 4, yingYao: 1 },
    '8-7': { name: '谦', fullName: '地山谦', upper: 8, lower: 7, gong: '兑', shiYao: 5, yingYao: 2 },
    '4-7': { name: '小过', fullName: '雷山小过', upper: 4, lower: 7, gong: '兑', shiYao: 4, yingYao: 1 },
    '4-2': { name: '归妹', fullName: '雷泽归妹', upper: 4, lower: 2, gong: '兑', shiYao: 3, yingYao: 6 },

    // ===== 离宫（火）=====
    '3-3': { name: '离', fullName: '离为火', upper: 3, lower: 3, gong: '离', shiYao: 6, yingYao: 3 },
    '3-7': { name: '旅', fullName: '火山旅', upper: 3, lower: 7, gong: '离', shiYao: 1, yingYao: 4 },
    '3-5': { name: '鼎', fullName: '火风鼎', upper: 3, lower: 5, gong: '离', shiYao: 2, yingYao: 5 },
    '3-6': { name: '未济', fullName: '火水未济', upper: 3, lower: 6, gong: '离', shiYao: 3, yingYao: 6 },
    '7-6': { name: '蒙', fullName: '山水蒙', upper: 7, lower: 6, gong: '离', shiYao: 4, yingYao: 1 },
    '5-6': { name: '涣', fullName: '风水涣', upper: 5, lower: 6, gong: '离', shiYao: 5, yingYao: 2 },
    '1-6': { name: '讼', fullName: '天水讼', upper: 1, lower: 6, gong: '离', shiYao: 4, yingYao: 1 },
    '1-3': { name: '同人', fullName: '天火同人', upper: 1, lower: 3, gong: '离', shiYao: 3, yingYao: 6 },

    // ===== 震宫（木）=====
    '4-4': { name: '震', fullName: '震为雷', upper: 4, lower: 4, gong: '震', shiYao: 6, yingYao: 3 },
    '4-8': { name: '豫', fullName: '雷地豫', upper: 4, lower: 8, gong: '震', shiYao: 1, yingYao: 4 },
    '4-6': { name: '解', fullName: '雷水解', upper: 4, lower: 6, gong: '震', shiYao: 2, yingYao: 5 },
    '4-5': { name: '恒', fullName: '雷风恒', upper: 4, lower: 5, gong: '震', shiYao: 3, yingYao: 6 },
    '8-5': { name: '升', fullName: '地风升', upper: 8, lower: 5, gong: '震', shiYao: 4, yingYao: 1 },
    '6-5': { name: '井', fullName: '水风井', upper: 6, lower: 5, gong: '震', shiYao: 5, yingYao: 2 },
    '2-5': { name: '大过', fullName: '泽风大过', upper: 2, lower: 5, gong: '震', shiYao: 4, yingYao: 1 },
    '2-4': { name: '随', fullName: '泽雷随', upper: 2, lower: 4, gong: '震', shiYao: 3, yingYao: 6 },

    // ===== 巽宫（木）=====
    '5-5': { name: '巽', fullName: '巽为风', upper: 5, lower: 5, gong: '巽', shiYao: 6, yingYao: 3 },
    '5-1': { name: '小畜', fullName: '风天小畜', upper: 5, lower: 1, gong: '巽', shiYao: 1, yingYao: 4 },
    '5-3': { name: '家人', fullName: '风火家人', upper: 5, lower: 3, gong: '巽', shiYao: 2, yingYao: 5 },
    '5-4': { name: '益', fullName: '风雷益', upper: 5, lower: 4, gong: '巽', shiYao: 3, yingYao: 6 },
    '1-4': { name: '无妄', fullName: '天雷无妄', upper: 1, lower: 4, gong: '巽', shiYao: 4, yingYao: 1 },
    '3-4': { name: '噬嗑', fullName: '火雷噬嗑', upper: 3, lower: 4, gong: '巽', shiYao: 5, yingYao: 2 },
    '7-4': { name: '颐', fullName: '山雷颐', upper: 7, lower: 4, gong: '巽', shiYao: 4, yingYao: 1 },
    '7-5': { name: '蛊', fullName: '山风蛊', upper: 7, lower: 5, gong: '巽', shiYao: 3, yingYao: 6 },

    // ===== 坎宫（水）=====
    '6-6': { name: '坎', fullName: '坎为水', upper: 6, lower: 6, gong: '坎', shiYao: 6, yingYao: 3 },
    '6-2': { name: '节', fullName: '水泽节', upper: 6, lower: 2, gong: '坎', shiYao: 1, yingYao: 4 },
    '6-4': { name: '屯', fullName: '水雷屯', upper: 6, lower: 4, gong: '坎', shiYao: 2, yingYao: 5 },
    '6-3': { name: '既济', fullName: '水火既济', upper: 6, lower: 3, gong: '坎', shiYao: 3, yingYao: 6 },
    '2-3': { name: '革', fullName: '泽火革', upper: 2, lower: 3, gong: '坎', shiYao: 4, yingYao: 1 },
    '4-3': { name: '丰', fullName: '雷火丰', upper: 4, lower: 3, gong: '坎', shiYao: 5, yingYao: 2 },
    '8-3': { name: '明夷', fullName: '地火明夷', upper: 8, lower: 3, gong: '坎', shiYao: 4, yingYao: 1 },
    '8-6': { name: '师', fullName: '地水师', upper: 8, lower: 6, gong: '坎', shiYao: 3, yingYao: 6 },

    // ===== 艮宫（土）=====
    '7-7': { name: '艮', fullName: '艮为山', upper: 7, lower: 7, gong: '艮', shiYao: 6, yingYao: 3 },
    '7-3': { name: '贲', fullName: '山火贲', upper: 7, lower: 3, gong: '艮', shiYao: 1, yingYao: 4 },
    '7-1': { name: '大畜', fullName: '山天大畜', upper: 7, lower: 1, gong: '艮', shiYao: 2, yingYao: 5 },
    '7-2': { name: '损', fullName: '山泽损', upper: 7, lower: 2, gong: '艮', shiYao: 3, yingYao: 6 },
    '3-2': { name: '睽', fullName: '火泽睽', upper: 3, lower: 2, gong: '艮', shiYao: 4, yingYao: 1 },
    '1-2': { name: '履', fullName: '天泽履', upper: 1, lower: 2, gong: '艮', shiYao: 5, yingYao: 2 },
    '5-2': { name: '中孚', fullName: '风泽中孚', upper: 5, lower: 2, gong: '艮', shiYao: 4, yingYao: 1 },
    '5-7': { name: '渐', fullName: '风山渐', upper: 5, lower: 7, gong: '艮', shiYao: 3, yingYao: 6 },

    // ===== 坤宫（土）=====
    '8-8': { name: '坤', fullName: '坤为地', upper: 8, lower: 8, gong: '坤', shiYao: 6, yingYao: 3 },
    '8-4': { name: '复', fullName: '地雷复', upper: 8, lower: 4, gong: '坤', shiYao: 1, yingYao: 4 },
    '8-2': { name: '临', fullName: '地泽临', upper: 8, lower: 2, gong: '坤', shiYao: 2, yingYao: 5 },
    '8-1': { name: '泰', fullName: '地天泰', upper: 8, lower: 1, gong: '坤', shiYao: 3, yingYao: 6 },
    '4-1': { name: '大壮', fullName: '雷天大壮', upper: 4, lower: 1, gong: '坤', shiYao: 4, yingYao: 1 },
    '2-1': { name: '夬', fullName: '泽天夬', upper: 2, lower: 1, gong: '坤', shiYao: 5, yingYao: 2 },
    '6-1': { name: '需', fullName: '水天需', upper: 6, lower: 1, gong: '坤', shiYao: 4, yingYao: 1 },
    '6-8': { name: '比', fullName: '水地比', upper: 6, lower: 8, gong: '坤', shiYao: 3, yingYao: 6 },
};

// ==================== 六亲计算 ====================
/**
 * 五行相生相克关系
 * 生我者=父母, 我生者=子孙, 克我者=官鬼, 我克者=妻财, 同我=兄弟
 */
const WUXING_SHENG: Record<string, string> = {
    '金': '水', '水': '木', '木': '火', '火': '土', '土': '金',
};
const WUXING_KE: Record<string, string> = {
    '金': '木', '木': '土', '土': '水', '水': '火', '火': '金',
};

export function getLiuQin(gongWuXing: WuXing, yaoWuXing: WuXing): LiuQin {
    if (gongWuXing === yaoWuXing) return '兄弟';
    if (WUXING_SHENG[gongWuXing] === yaoWuXing) return '子孙';  // 我生
    if (WUXING_KE[gongWuXing] === yaoWuXing) return '妻财';     // 我克
    // 反向查: 谁生我? 谁克我?
    for (const [k, v] of Object.entries(WUXING_SHENG)) {
        if (v === gongWuXing && k === yaoWuXing) return '父母';    // 生我
    }
    return '官鬼'; // 克我
}

// ==================== 六神计算 ====================
const LIU_SHEN_ORDER: LiuShen[] = ['青龙', '朱雀', '勾陈', '螣蛇', '白虎', '玄武'];

/**
 * 根据日干获取六神排列(初爻到六爻)
 * 甲乙→青龙始, 丙丁→朱雀始, 戊→勾陈始, 己→螣蛇始, 庚辛→白虎始, 壬癸→玄武始
 */
export function getLiuShen(dayGan: string): LiuShen[] {
    let startIdx = 0;
    if ('甲乙'.includes(dayGan)) startIdx = 0;
    else if ('丙丁'.includes(dayGan)) startIdx = 1;
    else if (dayGan === '戊') startIdx = 2;
    else if (dayGan === '己') startIdx = 3;
    else if ('庚辛'.includes(dayGan)) startIdx = 4;
    else startIdx = 5; // 壬癸
    const result: LiuShen[] = [];
    for (let i = 0; i < 6; i++) {
        result.push(LIU_SHEN_ORDER[(startIdx + i) % 6]);
    }
    return result;
}

// ==================== 六亲简称 ====================
export const LIUQIN_SHORT: Record<LiuQin, string> = {
    '父母': '父', '兄弟': '兄', '子孙': '子', '妻财': '财', '官鬼': '官',
};

export const LIUSHEN_SHORT: Record<LiuShen, string> = {
    '青龙': '龙', '朱雀': '雀', '勾陈': '勾', '螣蛇': '蛇', '白虎': '虎', '玄武': '武',
};
