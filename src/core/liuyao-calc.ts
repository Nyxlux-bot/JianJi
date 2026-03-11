/**
 * 六爻排盘核心计算引擎
 * 支持四种起卦方式，生成完整排盘结果
 */

import {
    YaoValue, WuXing, LiuQin, LiuShen, DivinationMethod,
    BA_GUA, GUA_64, NA_JIA, DIZHI_WUXING, DIZHI_INDEX,
    getLiuQin, getLiuShen, LIUQIN_SHORT, LIUSHEN_SHORT,
    yaoToGuaIndex, GuaInfo, TIANGAN_WUXING,
} from './liuyao-data';
import { solarToLunar, getNaYin, getCurrentJieqi, LunarDate } from './lunar';
import { calculateTrueSolarTime, formatTrueSolarTime } from './true-solar-time';
import { getXunKong } from './xun-kong';
import { getShenSha, ShenShaResult } from './shen-sha';
import { getMonthGeneralByJieqi, getMoonPhase, MonthGeneral, MoonPhase } from './time-signs';
import { PersistedAIChatMessage } from './ai-meta';

// ==================== 排盘结果类型 ====================

export interface YaoDetail {
    position: number;      // 爻位 1-6 (初爻到上爻)
    positionName: string;  // 爻位名 (初、二、三、四、五、上)
    nature: 'yang' | 'yin'; // 阴阳
    isMoving: boolean;     // 是否动爻
    value: YaoValue;       // 原始值 6/7/8/9
    ganZhi: string;        // 天干地支 (如 "甲子")
    zhi: string;           // 地支
    wuxing: WuXing;        // 五行
    liuQin: LiuQin;        // 六亲
    liuQinShort: string;   // 六亲简称
    liuShen: LiuShen;      // 六神
    liuShenShort: string;  // 六神简称
    isShi: boolean;        // 是否世爻
    isYing: boolean;       // 是否应爻
    // 变卦爻信息（仅动爻有）
    bianZhi?: string;
    bianWuXing?: WuXing;
    bianLiuQin?: LiuQin;
    bianLiuQinShort?: string;
    // 伏神信息（本卦如果缺某六亲，会从本宫首卦寻找并挂在此爻上）
    fuShen?: {
        ganZhi: string;
        zhi: string;
        wuxing: WuXing;
        liuQin: LiuQin;
        liuQinShort: string;
    };
}

export interface PanResult {
    id: string;
    createdAt: string;
    method: DivinationMethod;
    question: string;
    aiAnalysis?: string; // 缓存保存的 AI 测算历史结果 (向后兼容)
    aiChatHistory?: PersistedAIChatMessage[]; // 增设用于持久保存上下文的多轮对话记录
    quickReplies?: string[]; // 针对本次测算的专属快捷短句
    // 时间信息
    solarDate: string;
    solarTime: string;
    lunarInfo: LunarDate;
    jieqi: { current: string; currentDate: string; next: string; nextDate: string };
    // 四柱
    yearGanZhi: string;
    monthGanZhi: string;
    dayGanZhi: string;
    hourGanZhi: string;
    yearNaYin: string;
    monthNaYin: string;
    dayNaYin: string;
    hourNaYin: string;
    // 旬空与神煞
    xunKong: [string, string];
    shenSha: ShenShaResult;
    monthGeneral?: MonthGeneral;
    moonPhase?: MoonPhase;
    // 本卦
    benGua: GuaInfo;
    benGuaYao: YaoDetail[];
    // 变卦 (有动爻时)
    bianGua?: GuaInfo;
    bianGuaYao?: YaoDetail[];
    // 动爻位列表
    movingYaoPositions: number[];
    // 原始爻值
    rawYaoValues: YaoValue[];
    // 真太阳时（可选，有地点时才有）
    trueSolarTime?: string;     // 真太阳时 "HH:mm"
    location?: string;          // 地点名称
    longitude?: number;         // 经度
}

// ==================== 爻位名称 ====================
const YAO_POS_NAMES = ['初', '二', '三', '四', '五', '上'];

// ==================== 核心计算函数 ====================

/**
 * 将6个爻值转换为完整排盘结果
 * @param yaoValues 六爻值数组 [初爻..上爻], 每项为 6/7/8/9
 * @param date 起卦时间
 * @param method 起卦方式
 * @param question 占问事项
 * @param longitude 可选，当地经度（用于真太阳时校准）
 * @param locationName 可选，地点名称
 */
export function calculatePan(
    yaoValues: YaoValue[],
    date: Date,
    method: DivinationMethod,
    question: string = '',
    longitude?: number,
    locationName?: string
): PanResult {
    // 1. 获取农历及四柱（如有经度，使用真太阳时）
    const effectiveDate = (longitude !== undefined)
        ? calculateTrueSolarTime(date, longitude)
        : date;
    const lunarInfo = solarToLunar(effectiveDate);
    const jieqi = getCurrentJieqi(effectiveDate);

    // 2. 确定本卦的上下卦
    const lowerYao = yaoValues.slice(0, 3).map(v => (v === 7 || v === 9) ? 1 : 0);
    const upperYao = yaoValues.slice(3, 6).map(v => (v === 7 || v === 9) ? 1 : 0);
    const lowerIdx = yaoToGuaIndex(lowerYao[0], lowerYao[1], lowerYao[2]);
    const upperIdx = yaoToGuaIndex(upperYao[0], upperYao[1], upperYao[2]);

    const benGuaKey = `${upperIdx}-${lowerIdx}`;
    const benGua = GUA_64[benGuaKey];

    if (!benGua) {
        throw new Error(`未找到卦象: ${benGuaKey}`);
    }

    // 3. 确定动爻和变卦
    const movingPositions: number[] = [];
    const bianYaoValues: number[] = [];

    for (let i = 0; i < 6; i++) {
        const v = yaoValues[i];
        if (v === 6 || v === 9) {
            movingPositions.push(i + 1);
            // 动则变: 6(老阴)→阳, 9(老阳)→阴
            bianYaoValues.push(v === 9 ? 0 : 1);
        } else {
            bianYaoValues.push(v === 7 ? 1 : 0);
        }
    }

    let bianGua: GuaInfo | undefined;
    let bianGuaYaoDetails: YaoDetail[] | undefined;

    if (movingPositions.length > 0) {
        const bianLower = bianYaoValues.slice(0, 3);
        const bianUpper = bianYaoValues.slice(3, 6);
        const bianLowerIdx = yaoToGuaIndex(bianLower[0], bianLower[1], bianLower[2]);
        const bianUpperIdx = yaoToGuaIndex(bianUpper[0], bianUpper[1], bianUpper[2]);
        const bianGuaKey = `${bianUpperIdx}-${bianLowerIdx}`;
        bianGua = GUA_64[bianGuaKey];
    }

    // 4. 获取六神
    const dayGan = lunarInfo.dayGanZhi[0];
    const liuShenArr = getLiuShen(dayGan);

    // 5. 计算本卦各爻的纳甲、六亲
    const benGongBaGua = Object.values(BA_GUA).find(g => g.name === benGua.gong);
    if (!benGongBaGua) {
        throw new Error(`找不到本宫卦象定义: ${benGua.gong}，基础词典可能被破坏`);
    }
    const gongWuXing = BA_GUA[benGongBaGua.index].wuxing;

    const lowerGuaName = BA_GUA[lowerIdx].name;
    const upperGuaName = BA_GUA[upperIdx].name;
    const lowerNaJia = NA_JIA[lowerGuaName];
    const upperNaJia = NA_JIA[upperGuaName];

    const benGuaYao: YaoDetail[] = [];
    for (let i = 0; i < 6; i++) {
        const isLower = i < 3;
        const naJia = isLower ? lowerNaJia.inner : upperNaJia.outer;
        const localIdx = isLower ? i : i - 3;
        const gan = naJia.gan;
        const zhi = naJia.zhi[localIdx];
        const ganZhi = gan + zhi;
        const wuxing = DIZHI_WUXING[zhi];
        const liuQin = getLiuQin(gongWuXing, wuxing);
        const isMoving = yaoValues[i] === 6 || yaoValues[i] === 9;

        const yaoDetail: YaoDetail = {
            position: i + 1,
            positionName: YAO_POS_NAMES[i],
            nature: (yaoValues[i] === 7 || yaoValues[i] === 9) ? 'yang' : 'yin',
            isMoving,
            value: yaoValues[i],
            ganZhi,
            zhi,
            wuxing,
            liuQin,
            liuQinShort: LIUQIN_SHORT[liuQin],
            liuShen: liuShenArr[i],
            liuShenShort: LIUSHEN_SHORT[liuShenArr[i]],
            isShi: benGua.shiYao === i + 1,
            isYing: benGua.yingYao === i + 1,
        };

        // 如果是动爻，计算变卦对应爻的信息
        if (isMoving && bianGua) {
            const bianLowerIdx2 = yaoToGuaIndex(bianYaoValues[0], bianYaoValues[1], bianYaoValues[2]);
            const bianUpperIdx2 = yaoToGuaIndex(bianYaoValues[3], bianYaoValues[4], bianYaoValues[5]);
            const bianLowerName = BA_GUA[bianLowerIdx2].name;
            const bianUpperName = BA_GUA[bianUpperIdx2].name;
            const bianNaJia = isLower ? NA_JIA[bianLowerName].inner : NA_JIA[bianUpperName].outer;
            const bianZhi = bianNaJia.zhi[localIdx];
            const bianWuXing = DIZHI_WUXING[bianZhi];
            yaoDetail.bianZhi = bianZhi;
            yaoDetail.bianWuXing = bianWuXing;
            yaoDetail.bianLiuQin = getLiuQin(gongWuXing, bianWuXing);
            yaoDetail.bianLiuQinShort = LIUQIN_SHORT[yaoDetail.bianLiuQin];
        }

        benGuaYao.push(yaoDetail);
    }

    // 5.5. 查找并挂载伏神 (六亲不全时，从本宫首卦借用)
    const presentLiuQins = new Set(benGuaYao.map(y => y.liuQin));
    const allLiuQins: LiuQin[] = ['父母', '兄弟', '子孙', '妻财', '官鬼'];
    const missingLiuQins = allLiuQins.filter(lq => !presentLiuQins.has(lq));

    if (missingLiuQins.length > 0) {
        // 本宫首卦就是本宫名称对应的卦 (如 '乾' 宫的首卦就是 '乾')
        const pureGuaName = benGua.gong;
        const pureNaJia = NA_JIA[pureGuaName];

        // 遍历本宫首卦六爻
        for (let i = 0; i < 6; i++) {
            const isLower = i < 3;
            const naJia = isLower ? pureNaJia.inner : pureNaJia.outer;
            const localIdx = isLower ? i : i - 3;
            const zhi = naJia.zhi[localIdx];
            const wuxing = DIZHI_WUXING[zhi];
            const liuQin = getLiuQin(gongWuXing, wuxing);

            // 如果这个首卦六亲是缺失的
            if (missingLiuQins.includes(liuQin)) {
                // 找到它，挂载到当前排盘对应的同一爻(飞神)下
                benGuaYao[i].fuShen = {
                    ganZhi: naJia.gan + zhi,
                    zhi: zhi,
                    wuxing: wuxing,
                    liuQin: liuQin,
                    liuQinShort: LIUQIN_SHORT[liuQin],
                };
            }
        }
    }

    // 6. 变卦详情
    if (bianGua) {
        bianGuaYaoDetails = [];
        const bianLowerIdx2 = yaoToGuaIndex(bianYaoValues[0], bianYaoValues[1], bianYaoValues[2]);
        const bianUpperIdx2 = yaoToGuaIndex(bianYaoValues[3], bianYaoValues[4], bianYaoValues[5]);
        const bianLowerName = BA_GUA[bianLowerIdx2].name;
        const bianUpperName = BA_GUA[bianUpperIdx2].name;

        for (let i = 0; i < 6; i++) {
            const isLower = i < 3;
            const naJia = isLower ? NA_JIA[bianLowerName].inner : NA_JIA[bianUpperName].outer;
            const localIdx = isLower ? i : i - 3;
            const zhi = naJia.zhi[localIdx];
            const wuxing = DIZHI_WUXING[zhi];
            const liuQin = getLiuQin(gongWuXing, wuxing);
            const nature = bianYaoValues[i] === 1 ? 'yang' as const : 'yin' as const;

            bianGuaYaoDetails.push({
                position: i + 1,
                positionName: YAO_POS_NAMES[i],
                nature,
                isMoving: false,
                value: (nature === 'yang' ? 7 : 8) as YaoValue,
                ganZhi: naJia.gan + zhi,
                zhi,
                wuxing,
                liuQin,
                liuQinShort: LIUQIN_SHORT[liuQin],
                liuShen: liuShenArr[i],
                liuShenShort: LIUSHEN_SHORT[liuShenArr[i]],
                isShi: false,
                isYing: false,
            });
        }
    }

    // 7. 组装结果
    const now = date;
    const panResult: PanResult = {
        id: generateId(),
        createdAt: now.toISOString(),
        method,
        question,
        solarDate: `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`,
        solarTime: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
        lunarInfo,
        jieqi,
        yearGanZhi: lunarInfo.yearGanZhi,
        monthGanZhi: lunarInfo.monthGanZhi,
        dayGanZhi: lunarInfo.dayGanZhi,
        hourGanZhi: lunarInfo.hourGanZhi,
        yearNaYin: getNaYin(lunarInfo.yearGanZhi),
        monthNaYin: getNaYin(lunarInfo.monthGanZhi),
        dayNaYin: getNaYin(lunarInfo.dayGanZhi),
        hourNaYin: getNaYin(lunarInfo.hourGanZhi),
        xunKong: getXunKong(lunarInfo.dayGanZhi),
        shenSha: getShenSha(lunarInfo.dayGanZhi[0], lunarInfo.dayGanZhi[1]),
        monthGeneral: getMonthGeneralByJieqi(jieqi.current, lunarInfo.monthGanZhi[1]),
        moonPhase: getMoonPhase(effectiveDate, lunarInfo.day),
        benGua,
        benGuaYao,
        bianGua,
        bianGuaYao: bianGuaYaoDetails,
        movingYaoPositions: movingPositions,
        rawYaoValues: yaoValues,
    };

    // 真太阳时信息
    if (longitude !== undefined) {
        panResult.trueSolarTime = formatTrueSolarTime(effectiveDate);
        panResult.longitude = longitude;
        if (locationName) {
            panResult.location = locationName;
        }
    }

    return panResult;
}

// ==================== 四种起卦方式 ====================

/** 时间排卦（梅花易数） */
export function divinateByTime(date: Date, question: string = '', longitude?: number, locationName?: string): PanResult {
    // 如有经度，先计算真太阳时用于确定时辰
    const effectiveDate = (longitude !== undefined)
        ? calculateTrueSolarTime(date, longitude)
        : date;
    const lunar = solarToLunar(effectiveDate);
    const yearZhi = lunar.yearGanZhi[1];
    const monthNum = lunar.month;
    const dayNum = lunar.day;
    const hourZhi = lunar.hourZhi;

    const yearNum = DIZHI_INDEX[yearZhi];
    const hourNum = DIZHI_INDEX[hourZhi];

    // 上卦 = (年支数 + 月数 + 日数) mod 8
    let upperNum = (yearNum + monthNum + dayNum) % 8;
    if (upperNum === 0) upperNum = 8;

    // 下卦 = (年支数 + 月数 + 日数 + 时支数) mod 8
    let lowerNum = (yearNum + monthNum + dayNum + hourNum) % 8;
    if (lowerNum === 0) lowerNum = 8;

    // 动爻 = (年+月+日+时) mod 6
    let movingYao = (yearNum + monthNum + dayNum + hourNum) % 6;
    if (movingYao === 0) movingYao = 6;

    // 构造爻值数组
    const upperGua = BA_GUA[upperNum];
    const lowerGua = BA_GUA[lowerNum];
    const yaoValues: YaoValue[] = [];

    for (let i = 0; i < 3; i++) {
        const isYang = lowerGua.yao[i] === 1;
        const isMoving = (i + 1) === movingYao;
        if (isMoving) {
            yaoValues.push(isYang ? 9 : 6);
        } else {
            yaoValues.push(isYang ? 7 : 8);
        }
    }
    for (let i = 0; i < 3; i++) {
        const isYang = upperGua.yao[i] === 1;
        const isMoving = (i + 4) === movingYao;
        if (isMoving) {
            yaoValues.push(isYang ? 9 : 6);
        } else {
            yaoValues.push(isYang ? 7 : 8);
        }
    }

    return calculatePan(yaoValues, date, 'time', question, longitude, locationName);
}

/** 硬币排卦（金钱卦） - 传入6次结果 */
export function divinateByCoin(coinResults: YaoValue[], date: Date, question: string = '', longitude?: number, locationName?: string): PanResult {
    return calculatePan(coinResults, date, 'coin', question, longitude, locationName);
}

/** 数字排卦（两数法） */
export function divinateByNumber(num1: number, num2: number, date: Date, question: string = '', longitude?: number, locationName?: string): PanResult {
    let upperNum = num1 % 8;
    if (upperNum === 0) upperNum = 8;
    let lowerNum = num2 % 8;
    if (lowerNum === 0) lowerNum = 8;
    let movingYao = (num1 + num2) % 6;
    if (movingYao === 0) movingYao = 6;

    const upperGua = BA_GUA[upperNum];
    const lowerGua = BA_GUA[lowerNum];
    const yaoValues: YaoValue[] = [];

    for (let i = 0; i < 3; i++) {
        const isYang = lowerGua.yao[i] === 1;
        const isMoving = (i + 1) === movingYao;
        yaoValues.push(isMoving ? (isYang ? 9 : 6) : (isYang ? 7 : 8));
    }
    for (let i = 0; i < 3; i++) {
        const isYang = upperGua.yao[i] === 1;
        const isMoving = (i + 4) === movingYao;
        yaoValues.push(isMoving ? (isYang ? 9 : 6) : (isYang ? 7 : 8));
    }

    return calculatePan(yaoValues, date, 'number', question, longitude, locationName);
}

/** 手动起卦 */
export function divinateManual(yaoValues: YaoValue[], date: Date, question: string = '', longitude?: number, locationName?: string): PanResult {
    return calculatePan(yaoValues, date, 'manual', question, longitude, locationName);
}

// ==================== 工具函数 ====================

function generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/** 模拟掷硬币一次 (返回单爻值) */
export function throwCoins(): YaoValue {
    // 三枚硬币: 字=3(阳), 花=2(阴)
    let sum = 0;
    for (let i = 0; i < 3; i++) {
        sum += Math.random() < 0.5 ? 3 : 2;
    }
    return sum as YaoValue; // 6, 7, 8, 9
}
