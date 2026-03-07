import { SixtyCycle } from 'tyme4ts';
import {
    BaziFourPillars,
    BaziGender,
    BaziPillarKey,
    BaziShenShaLayerBucket,
    BaziShenShaLayerItem,
    BaziShenShaLayerPositionItem,
    BaziShenShaPillarItem,
    BaziShenShaResult,
    BaziShenShaV2Result,
} from './bazi-types';
import {
    BAZI_SHENSHA_ALIAS_TO_FULLNAME,
    BAZI_SHENSHA_CATALOG,
} from './bazi-shensha-catalog';

export interface CalculateBaziShenShaParams {
    fourPillars: BaziFourPillars;
    gender: BaziGender;
}

export interface CalculateBaziShenShaV2Params extends CalculateBaziShenShaParams {
    daYun?: Array<{ index: number; ganZhi: string }>;
    liuNian?: Array<{ index: number; year: number; ganZhi: string }>;
    liuYue?: Array<{ index: number; year: number; ganZhi: string; termName: string }>;
    ganZhiPool?: string[];
}

interface ParsedPillar {
    ganZhi: string;
    gan: string;
    zhi: string;
}

interface BaziShenShaContext {
    yearGan: string;
    yearZhi: string;
    monthGan: string;
    monthZhi: string;
    dayGan: string;
    dayZhi: string;
    hourGan: string;
    hourZhi: string;
    yearNaYin: string;
    gender: BaziGender;
}

const PILLAR_KEYS: [BaziPillarKey, BaziPillarKey, BaziPillarKey, BaziPillarKey] = ['year', 'month', 'day', 'hour'];
const JIA_ZI: string[] = [
    '甲子', '乙丑', '丙寅', '丁卯', '戊辰', '己巳', '庚午', '辛未', '壬申', '癸酉',
    '甲戌', '乙亥', '丙子', '丁丑', '戊寅', '己卯', '庚辰', '辛巳', '壬午', '癸未',
    '甲申', '乙酉', '丙戌', '丁亥', '戊子', '己丑', '庚寅', '辛卯', '壬辰', '癸巳',
    '甲午', '乙未', '丙申', '丁酉', '戊戌', '己亥', '庚子', '辛丑', '壬寅', '癸卯',
    '甲辰', '乙巳', '丙午', '丁未', '戊申', '己酉', '庚戌', '辛亥', '壬子', '癸丑',
    '甲寅', '乙卯', '丙辰', '丁巳', '戊午', '己未', '庚申', '辛酉', '壬戌', '癸亥',
];

const NIAN_ZHI_ORDER: string[] = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const SHANG_MEN_ORDER: string[] = ['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑'];
const DIAO_KE_ORDER: string[] = ['戌', '亥', '子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉'];
const PI_MA_ORDER: string[] = ['酉', '戌', '亥', '子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申'];

function toCanonicalStarName(name: string): string {
    return BAZI_SHENSHA_ALIAS_TO_FULLNAME[name] ?? name;
}

function parsePillar(ganZhi: string): ParsedPillar {
    const sixtyCycle = SixtyCycle.fromName(ganZhi);
    return {
        ganZhi,
        gan: sixtyCycle.getHeavenStem().getName(),
        zhi: sixtyCycle.getEarthBranch().getName(),
    };
}

function getJiaZiOrder(ganZhi: string): number {
    const index = JIA_ZI.indexOf(ganZhi);
    return index >= 0 ? index + 1 : 0;
}

function tianganYinYang(gan: string): boolean {
    return gan === '甲' || gan === '丙' || gan === '戊' || gan === '庚' || gan === '壬';
}

function dizhiWuXing(zhi: string): string {
    const map: Record<string, string> = {
        寅: '木',
        卯: '木',
        巳: '火',
        午: '火',
        丑: '土',
        辰: '土',
        未: '土',
        戌: '土',
        申: '金',
        酉: '金',
        亥: '水',
        子: '水',
    };
    return map[zhi] ?? '';
}

function tianYiGuiRen(gan: string, zhi: string): boolean {
    const map: Record<string, readonly string[]> = {
        甲: ['丑', '未'],
        戊: ['丑', '未'],
        乙: ['申', '子'],
        己: ['申', '子'],
        丙: ['亥', '酉'],
        丁: ['亥', '酉'],
        壬: ['卯', '巳'],
        癸: ['卯', '巳'],
        庚: ['午', '寅'],
        辛: ['午', '寅'],
    };
    return (map[gan] ?? []).includes(zhi);
}

function taiJiGuiRen(gan: string, zhi: string): boolean {
    const map: Record<string, readonly string[]> = {
        甲: ['子', '午'],
        乙: ['子', '午'],
        丙: ['酉', '卯'],
        丁: ['酉', '卯'],
        庚: ['寅', '亥'],
        辛: ['寅', '亥'],
        壬: ['申', '巳'],
        癸: ['申', '巳'],
    };
    if (gan === '戊' || gan === '己') {
        return dizhiWuXing(zhi) === '土';
    }
    return (map[gan] ?? []).includes(zhi);
}

function tianDeGuiRen(monthZhi: string, ganOrZhi: string): boolean {
    const map: Record<string, string> = {
        寅: '丁',
        卯: '申',
        辰: '壬',
        巳: '辛',
        午: '亥',
        未: '甲',
        申: '癸',
        酉: '寅',
        戌: '丙',
        亥: '乙',
        子: '巳',
        丑: '庚',
    };
    return map[monthZhi] === ganOrZhi;
}

function yueDe(monthZhi: string, gan: string): boolean {
    const map: Record<string, string> = {
        寅: '丙',
        午: '丙',
        戌: '丙',
        申: '壬',
        子: '壬',
        辰: '壬',
        亥: '甲',
        卯: '甲',
        未: '甲',
        巳: '庚',
        酉: '庚',
        丑: '庚',
    };
    return map[monthZhi] === gan;
}

function deXiuGuiRen(monthZhi: string, gans: readonly string[]): boolean {
    const hasGan = (targets: readonly string[]): boolean => gans.some((gan) => targets.includes(gan));
    const hasBoth = (gan1: string, gan2: string): boolean => gans.includes(gan1) && gans.includes(gan2);

    if (['寅', '午', '戌'].includes(monthZhi)) {
        return hasGan(['丙', '丁']) && hasBoth('戊', '癸');
    }
    if (['申', '子', '辰'].includes(monthZhi)) {
        return hasGan(['壬', '癸', '戊', '己']) && (hasBoth('丙', '辛') || hasBoth('甲', '己'));
    }
    if (['巳', '酉', '丑'].includes(monthZhi)) {
        return hasGan(['庚', '辛']) && hasBoth('乙', '庚');
    }
    if (['亥', '卯', '未'].includes(monthZhi)) {
        return hasGan(['甲', '乙']) && hasBoth('丁', '壬');
    }
    return false;
}

function tianDeHe(monthZhi: string, ganOrZhi: string): boolean {
    const map: Record<string, string> = {
        寅: '壬',
        卯: '巳',
        辰: '丁',
        巳: '丙',
        午: '寅',
        未: '己',
        申: '戊',
        酉: '亥',
        戌: '辛',
        亥: '庚',
        子: '申',
        丑: '乙',
    };
    return map[monthZhi] === ganOrZhi;
}

function yueDeHe(monthZhi: string, gan: string): boolean {
    const map: Record<string, readonly string[]> = {
        辛: ['寅', '午', '戌'],
        丁: ['申', '子', '辰'],
        乙: ['巳', '酉', '丑'],
        己: ['亥', '卯', '未'],
    };
    return (map[gan] ?? []).includes(monthZhi);
}

function fuXing(gan: string, zhi: string): boolean {
    const rules: Array<{ gans: string[]; zhis: string[] }> = [
        { gans: ['甲', '丙'], zhis: ['寅', '子'] },
        { gans: ['乙', '癸'], zhis: ['卯', '丑'] },
        { gans: ['戊'], zhis: ['申'] },
        { gans: ['己'], zhis: ['未'] },
        { gans: ['丁'], zhis: ['亥'] },
        { gans: ['庚'], zhis: ['午'] },
        { gans: ['辛'], zhis: ['巳'] },
        { gans: ['壬'], zhis: ['辰'] },
    ];
    return rules.some((rule) => rule.gans.includes(gan) && rule.zhis.includes(zhi));
}

function wenChang(gan: string, zhi: string): boolean {
    const map: Record<string, string> = {
        甲: '巳',
        乙: '午',
        丙: '申',
        丁: '酉',
        戊: '申',
        己: '酉',
        庚: '亥',
        辛: '子',
        壬: '寅',
        癸: '卯',
    };
    return map[gan] === zhi;
}

function xueTang(yearNaYin: string, gan: string, zhi: string): boolean {
    const element = yearNaYin.slice(-1);
    const map: Record<string, [string, [string, string]]> = {
        金: ['巳', ['辛', '巳']],
        木: ['亥', ['己', '亥']],
        水: ['申', ['甲', '申']],
        土: ['申', ['戊', '申']],
        火: ['寅', ['丙', '寅']],
    };
    const rule = map[element];
    if (!rule) {
        return false;
    }
    return zhi === rule[0] || (gan === rule[1][0] && zhi === rule[1][1]);
}

function ciGuan(yearNaYin: string, gan: string, zhi: string): boolean {
    const element = yearNaYin.slice(-1);
    const map: Record<string, [string, [string, string]]> = {
        金: ['申', ['壬', '卯']],
        木: ['寅', ['庚', '寅']],
        水: ['亥', ['癸', '亥']],
        土: ['亥', ['丁', '亥']],
        火: ['巳', ['乙', '巳']],
    };
    const rule = map[element];
    if (!rule) {
        return false;
    }
    return zhi === rule[0] || (gan === rule[1][0] && zhi === rule[1][1]);
}

function kuiGang(dayGan: string, dayZhi: string): boolean {
    const map: Record<string, readonly string[]> = {
        壬: ['辰'],
        庚: ['戌', '辰'],
        戊: ['戌'],
    };
    return (map[dayGan] ?? []).includes(dayZhi);
}

function guoYin(gan: string, zhi: string): boolean {
    const map: Record<string, string> = {
        甲: '戌',
        乙: '亥',
        丙: '丑',
        丁: '寅',
        戊: '丑',
        己: '寅',
        庚: '辰',
        辛: '巳',
        壬: '未',
        癸: '申',
    };
    return map[gan] === zhi;
}

function yiMa(baseZhi: string, targetZhi: string): boolean {
    const map: Record<string, string> = {
        申: '寅',
        子: '寅',
        辰: '寅',
        寅: '申',
        午: '申',
        戌: '申',
        亥: '巳',
        卯: '巳',
        未: '巳',
        巳: '亥',
        酉: '亥',
        丑: '亥',
    };
    return map[baseZhi] === targetZhi;
}

function huaGai(baseZhi: string, targetZhi: string): boolean {
    const map: Record<string, string> = {
        申: '辰',
        子: '辰',
        辰: '辰',
        寅: '戌',
        午: '戌',
        戌: '戌',
        巳: '丑',
        酉: '丑',
        丑: '丑',
        亥: '未',
        卯: '未',
        未: '未',
    };
    return map[baseZhi] === targetZhi;
}

function jiangXing(baseZhi: string, targetZhi: string): boolean {
    const map: Record<string, readonly string[]> = {
        申: ['子'],
        子: ['子'],
        寅: ['午'],
        午: ['午'],
        戌: ['午'],
        巳: ['酉'],
        酉: ['酉'],
        丑: ['酉'],
        亥: ['卯'],
        卯: ['卯'],
        未: ['卯'],
    };
    return (map[baseZhi] ?? []).includes(targetZhi);
}

function jinYu(gan: string, zhi: string): boolean {
    const map: Record<string, string> = {
        甲: '辰',
        乙: '巳',
        丁: '申',
        己: '申',
        丙: '未',
        戊: '未',
        庚: '戌',
        辛: '亥',
        壬: '丑',
        癸: '寅',
    };
    return map[gan] === zhi;
}

function jinShen(gan: string, zhi: string): boolean {
    const set = new Set<string>(['乙丑', '己巳', '癸酉']);
    return set.has(`${gan}${zhi}`);
}

function wuGui(monthZhi: string, zhi: string): boolean {
    const map: Record<string, string> = {
        子: '辰',
        丑: '巳',
        寅: '午',
        卯: '未',
        辰: '申',
        巳: '酉',
        午: '戌',
        未: '亥',
        申: '子',
        酉: '丑',
        戌: '寅',
        亥: '卯',
    };
    return map[monthZhi] === zhi;
}

function tianYi(monthZhi: string, zhi: string): boolean {
    const map: Record<string, string> = {
        寅: '丑',
        卯: '寅',
        辰: '卯',
        巳: '辰',
        午: '巳',
        未: '午',
        申: '未',
        酉: '申',
        戌: '酉',
        亥: '戌',
        子: '亥',
        丑: '子',
    };
    return map[monthZhi] === zhi;
}

function luShen(dayGan: string, zhi: string): boolean {
    const map: Record<string, string> = {
        甲: '寅',
        乙: '卯',
        丙: '巳',
        丁: '午',
        戊: '巳',
        己: '午',
        庚: '申',
        辛: '酉',
        壬: '亥',
        癸: '子',
    };
    return map[dayGan] === zhi;
}

function tianShe(monthZhi: string, dayGan: string, dayZhi: string): boolean {
    const dayGanZhi = `${dayGan}${dayZhi}`;
    if (['寅', '卯', '辰'].includes(monthZhi)) {
        return dayGanZhi === '戊寅';
    }
    if (['巳', '午', '未'].includes(monthZhi)) {
        return dayGanZhi === '甲午';
    }
    if (['申', '酉', '戌'].includes(monthZhi)) {
        return dayGanZhi === '戊申';
    }
    if (['亥', '子', '丑'].includes(monthZhi)) {
        return dayGanZhi === '甲子';
    }
    return false;
}

function hongLuan(yearZhi: string, zhi: string): boolean {
    const map: Record<string, string> = {
        子: '卯',
        丑: '寅',
        寅: '丑',
        卯: '子',
        辰: '亥',
        巳: '戌',
        午: '酉',
        未: '申',
        申: '未',
        酉: '午',
        戌: '巳',
        亥: '辰',
    };
    return map[yearZhi] === zhi;
}

function tianXi(yearZhi: string, zhi: string): boolean {
    const map: Record<string, string> = {
        子: '酉',
        丑: '申',
        寅: '未',
        卯: '午',
        辰: '巳',
        巳: '辰',
        午: '卯',
        未: '寅',
        申: '丑',
        酉: '子',
        戌: '亥',
        亥: '戌',
    };
    return map[yearZhi] === zhi;
}

function liuXia(dayGan: string, zhi: string): boolean {
    const set = new Set<string>(['甲酉', '乙戌', '丙未', '丁申', '戊巳', '己午', '庚辰', '辛卯', '壬亥', '癸寅']);
    return set.has(`${dayGan}${zhi}`);
}

function hongYan(dayGan: string, zhi: string): boolean {
    const set = new Set<string>(['甲午', '乙午', '丙寅', '丁未', '戊辰', '己辰', '庚戌', '辛酉', '壬子', '癸申']);
    return set.has(`${dayGan}${zhi}`);
}

function tianLuo(baseZhi: string, targetZhi: string): boolean {
    return (baseZhi === '戌' && targetZhi === '亥') || (baseZhi === '亥' && targetZhi === '戌');
}

function diWang(baseZhi: string, targetZhi: string): boolean {
    return (baseZhi === '辰' && targetZhi === '巳') || (baseZhi === '巳' && targetZhi === '辰');
}

function yangRen(dayGan: string, zhi: string): boolean {
    const map: Record<string, string> = {
        甲: '卯',
        乙: '寅',
        丙: '午',
        丁: '巳',
        戊: '午',
        己: '巳',
        庚: '酉',
        辛: '申',
        壬: '子',
        癸: '亥',
    };
    return map[dayGan] === zhi;
}

function feiRen(dayGan: string, zhi: string): boolean {
    const map: Record<string, string> = {
        甲: '酉',
        乙: '申',
        丙: '子',
        戊: '子',
        丁: '丑',
        己: '丑',
        庚: '卯',
        辛: '辰',
        壬: '午',
        癸: '未',
    };
    return map[dayGan] === zhi;
}

function xueRen(monthZhi: string, zhi: string): boolean {
    const map: Record<string, string> = {
        子: '午',
        丑: '子',
        寅: '丑',
        卯: '未',
        辰: '寅',
        巳: '申',
        午: '卯',
        未: '酉',
        申: '辰',
        酉: '戌',
        戌: '巳',
        亥: '亥',
    };
    return map[monthZhi] === zhi;
}

function baZhuan(dayGan: string, dayZhi: string): boolean {
    const set = new Set<string>(['甲寅', '乙卯', '丁未', '戊戌', '己未', '庚申', '辛酉', '癸丑']);
    return set.has(`${dayGan}${dayZhi}`);
}

function jiuChou(dayGan: string, dayZhi: string): boolean {
    const set = new Set<string>(['丁酉', '戊子', '戊午', '己卯', '己酉', '辛卯', '辛酉', '壬子', '壬午']);
    return set.has(`${dayGan}${dayZhi}`);
}

function jieSha(baseZhi: string, targetZhi: string): boolean {
    const map: Record<string, readonly string[]> = {
        亥: ['寅', '午', '戌'],
        巳: ['申', '子', '辰'],
        寅: ['巳', '酉', '丑'],
        申: ['亥', '卯', '未'],
    };
    return (map[targetZhi] ?? []).includes(baseZhi);
}

function zaiSha(yearZhi: string, targetZhi: string): boolean {
    const map: Record<string, readonly string[]> = {
        午: ['申', '子', '辰'],
        子: ['寅', '午', '戌'],
        卯: ['巳', '酉', '丑'],
        酉: ['亥', '卯', '未'],
    };
    return (map[targetZhi] ?? []).includes(yearZhi);
}

function yuanChen(yearZhi: string, targetZhi: string, isMan: boolean, yearGanYang: boolean): boolean {
    const yangMaleYinFemaleMap: Record<string, string> = {
        子: '未',
        丑: '申',
        寅: '酉',
        卯: '戌',
        辰: '亥',
        巳: '子',
        午: '丑',
        未: '寅',
        申: '卯',
        酉: '辰',
        戌: '巳',
        亥: '午',
    };
    const yinMaleYangFemaleMap: Record<string, string> = {
        子: '巳',
        丑: '午',
        寅: '未',
        卯: '申',
        辰: '酉',
        巳: '戌',
        午: '亥',
        未: '子',
        申: '丑',
        酉: '寅',
        戌: '卯',
        亥: '辰',
    };
    const useYangMaleYinFemale = isMan === yearGanYang;
    const map = useYangMaleYinFemale ? yangMaleYinFemaleMap : yinMaleYangFemaleMap;
    return map[yearZhi] === targetZhi;
}

function kongWang(ganZhi: string, zhi: string): boolean {
    const order = getJiaZiOrder(ganZhi);
    if (order === 0) {
        return false;
    }
    if (order <= 10) {
        return zhi === '戌' || zhi === '亥';
    }
    if (order <= 20) {
        return zhi === '申' || zhi === '酉';
    }
    if (order <= 30) {
        return zhi === '午' || zhi === '未';
    }
    if (order <= 40) {
        return zhi === '辰' || zhi === '巳';
    }
    if (order <= 50) {
        return zhi === '寅' || zhi === '卯';
    }
    return zhi === '子' || zhi === '丑';
}

function tongZi(monthZhi: string, yearNaYin: string, zhi: string): boolean {
    const monthRule: Record<string, readonly string[]> = {
        寅: ['寅', '子'],
        卯: ['寅', '子'],
        辰: ['寅', '子'],
        申: ['寅', '子'],
        酉: ['寅', '子'],
        戌: ['寅', '子'],
        巳: ['卯', '未', '辰'],
        午: ['卯', '未', '辰'],
        未: ['卯', '未', '辰'],
        亥: ['卯', '未', '辰'],
        子: ['卯', '未', '辰'],
        丑: ['卯', '未', '辰'],
    };
    if ((monthRule[monthZhi] ?? []).includes(zhi)) {
        return true;
    }

    const element = yearNaYin.slice(-1);
    const elementRule: Record<string, readonly string[]> = {
        金: ['午', '卯'],
        木: ['午', '卯'],
        水: ['酉', '戌'],
        火: ['酉', '戌'],
        土: ['辰', '巳'],
    };
    return (elementRule[element] ?? []).includes(zhi);
}

function tianChu(yearGan: string, dayGan: string, zhi: string): boolean {
    const map: Record<string, string> = {
        丙: '巳',
        丁: '午',
        戊: '申',
        己: '酉',
        庚: '亥',
        辛: '子',
        壬: '寅',
        癸: '卯',
    };
    return map[yearGan] === zhi || map[dayGan] === zhi;
}

function guChen(yearZhi: string, targetZhi: string): boolean {
    const map: Record<string, readonly string[]> = {
        寅: ['亥', '子', '丑'],
        巳: ['寅', '卯', '辰'],
        申: ['巳', '午', '未'],
        亥: ['申', '酉', '戌'],
    };
    return (map[targetZhi] ?? []).includes(yearZhi);
}

function guaSu(yearZhi: string, targetZhi: string): boolean {
    const map: Record<string, readonly string[]> = {
        戌: ['亥', '子', '丑'],
        丑: ['寅', '卯', '辰'],
        辰: ['巳', '午', '未'],
        未: ['申', '酉', '戌'],
    };
    return (map[targetZhi] ?? []).includes(yearZhi);
}

function wangShen(baseZhi: string, targetZhi: string): boolean {
    const map: Record<string, readonly string[]> = {
        亥: ['申', '子', '辰'],
        巳: ['寅', '午', '戌'],
        申: ['巳', '酉', '丑'],
        寅: ['亥', '卯', '未'],
    };
    return (map[targetZhi] ?? []).includes(baseZhi);
}

function shiEDaBai(dayGan: string, dayZhi: string): boolean {
    const map: Record<string, string> = {
        甲: '辰',
        乙: '巳',
        壬: '申',
        丙: '申',
        丁: '亥',
        庚: '辰',
        戊: '戌',
        癸: '亥',
        辛: '巳',
        己: '丑',
    };
    return map[dayGan] === dayZhi;
}

function taoHua(baseZhi: string, targetZhi: string): boolean {
    const map: Record<string, string> = {
        申: '酉',
        子: '酉',
        辰: '酉',
        寅: '卯',
        午: '卯',
        戌: '卯',
        巳: '午',
        酉: '午',
        丑: '午',
        亥: '子',
        卯: '子',
        未: '子',
    };
    return map[baseZhi] === targetZhi;
}

function guLuan(dayGan: string, dayZhi: string): boolean {
    const set = new Set<string>(['乙巳', '丁巳', '辛亥', '戊申', '甲寅', '戊午', '壬子', '丙午']);
    return set.has(`${dayGan}${dayZhi}`);
}

function yinChaYangCuo(dayGan: string, dayZhi: string): boolean {
    const map: Record<string, readonly string[]> = {
        丙: ['子', '午'],
        丁: ['丑', '未'],
        戊: ['寅', '申'],
        辛: ['卯', '酉'],
        壬: ['辰', '戌'],
        癸: ['巳', '亥'],
    };
    return (map[dayGan] ?? []).includes(dayZhi);
}

function siFei(monthZhi: string, dayGan: string, dayZhi: string): boolean {
    const map: Record<string, readonly string[]> = {
        寅: ['庚申', '辛酉'],
        卯: ['庚申', '辛酉'],
        辰: ['庚申', '辛酉'],
        巳: ['壬子', '癸亥'],
        午: ['壬子', '癸亥'],
        未: ['壬子', '癸亥'],
        申: ['甲寅', '乙卯'],
        酉: ['甲寅', '乙卯'],
        戌: ['甲寅', '乙卯'],
        亥: ['丙午', '丁巳'],
        子: ['丙午', '丁巳'],
        丑: ['丙午', '丁巳'],
    };
    return (map[monthZhi] ?? []).includes(`${dayGan}${dayZhi}`);
}

function liuXiuRi(dayGan: string, dayZhi: string): boolean {
    const set = new Set<string>(['丙午', '丁未', '戊子', '戊午', '己丑', '己未']);
    return set.has(`${dayGan}${dayZhi}`);
}

function gongLu(dayGan: string, dayZhi: string, hourGan: string, hourZhi: string): boolean {
    const set = new Set<string>([
        '癸亥-癸丑',
        '癸丑-癸亥',
        '戊辰-丁巳',
        '乙巳-丙戌',
        '己未-己巳',
    ]);
    return set.has(`${dayGan}${dayZhi}-${hourGan}${hourZhi}`);
}

function tianZhuanRi(monthZhi: string, dayGan: string, dayZhi: string): boolean {
    if (['寅', '卯', '辰'].includes(monthZhi)) return `${dayGan}${dayZhi}` === '乙卯';
    if (['巳', '午', '未'].includes(monthZhi)) return `${dayGan}${dayZhi}` === '丙午';
    if (['申', '酉', '戌'].includes(monthZhi)) return `${dayGan}${dayZhi}` === '辛酉';
    return `${dayGan}${dayZhi}` === '壬子';
}

function diZhuanRi(monthZhi: string, dayGan: string, dayZhi: string): boolean {
    if (['寅', '卯', '辰'].includes(monthZhi)) return `${dayGan}${dayZhi}` === '辛卯';
    if (['巳', '午', '未'].includes(monthZhi)) return `${dayGan}${dayZhi}` === '戊午';
    if (['申', '酉', '戌'].includes(monthZhi)) return `${dayGan}${dayZhi}` === '癸酉';
    return `${dayGan}${dayZhi}` === '丙子';
}

function gouJiaoSha(yearZhi: string, targetZhi: string): boolean {
    const order = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
    const index = order.indexOf(yearZhi);
    if (index < 0) return false;
    const gou = order[(index + 3) % 12];
    const jiao = order[(index + 9) % 12];
    return targetZhi === gou || targetZhi === jiao;
}

function sanQiGuiRen(gans: [string, string, string, string], pillarIndex: 0 | 1 | 2 | 3): boolean {
    const windows: Array<[string, string, string]> = [
        [gans[0], gans[1], gans[2]],
        [gans[1], gans[2], gans[3]],
    ];
    const rules: Array<[string, string, string]> = [
        ['乙', '丙', '丁'],
        ['甲', '戊', '庚'],
        ['辛', '壬', '癸'],
    ];
    const inWindow = windows.some((window) => rules.some((rule) => window.join('') === rule.join('')));
    if (!inWindow) return false;
    if (pillarIndex === 0) return windows[0].includes(gans[0]);
    if (pillarIndex === 3) return windows[1].includes(gans[3]);
    return windows.some((window) => window.includes(gans[pillarIndex]));
}

function checkYearZhiRelation(yearZhi: string, targetZhi: string, type: 'shangmen' | 'diaoke' | 'pima'): boolean {
    const index = NIAN_ZHI_ORDER.indexOf(yearZhi);
    if (index < 0) {
        return false;
    }
    const mapByType: Record<'shangmen' | 'diaoke' | 'pima', string[]> = {
        shangmen: SHANG_MEN_ORDER,
        diaoke: DIAO_KE_ORDER,
        pima: PI_MA_ORDER,
    };
    return mapByType[type][index] === targetZhi;
}

function shiLing(dayGan: string, dayZhi: string): boolean {
    const set = new Set<string>(['甲辰', '乙亥', '丙辰', '丁酉', '戊午', '庚戌', '庚寅', '辛亥', '壬寅', '癸未']);
    return set.has(`${dayGan}${dayZhi}`);
}

function collectPillarStars(
    context: BaziShenShaContext,
    target: ParsedPillar,
    witch: 1 | 2 | 3 | 4,
    pillarIndex: 0 | 1 | 2 | 3,
): string[] {
    const stars: string[] = [];
    const targetGan = target.gan;
    const targetZhi = target.zhi;
    const isMan = context.gender === 1;
    const allGans: [string, string, string, string] = [context.yearGan, context.monthGan, context.dayGan, context.hourGan];
    const addStar = (name: string, hit: boolean): void => {
        const canonicalName = toCanonicalStarName(name);
        if (hit && !stars.includes(canonicalName)) {
            stars.push(canonicalName);
        }
    };

    addStar('天乙', tianYiGuiRen(context.dayGan, targetZhi) || tianYiGuiRen(context.yearGan, targetZhi));
    addStar('太极', taiJiGuiRen(context.dayGan, targetZhi) || taiJiGuiRen(context.yearGan, targetZhi));
    addStar('天德', tianDeGuiRen(context.monthZhi, targetGan) || tianDeGuiRen(context.monthZhi, targetZhi));
    addStar('月德', yueDe(context.monthZhi, targetGan));
    addStar('德秀', deXiuGuiRen(context.monthZhi, allGans));
    addStar('天德合', tianDeHe(context.monthZhi, targetGan) || tianDeHe(context.monthZhi, targetZhi));
    addStar('月德合', yueDeHe(context.monthZhi, targetGan));
    addStar('福星', fuXing(context.yearGan, targetZhi) || fuXing(context.dayGan, targetZhi));
    addStar('文昌', wenChang(context.dayGan, targetZhi) || wenChang(context.yearGan, targetZhi));
    addStar('学堂', xueTang(context.yearNaYin, targetGan, targetZhi));
    addStar('词馆', witch !== 3 && ciGuan(context.yearNaYin, targetGan, targetZhi));
    addStar('魁罡', witch === 3 && kuiGang(context.dayGan, context.dayZhi));
    addStar('国印', guoYin(context.dayGan, targetZhi) || guoYin(context.yearGan, targetZhi));
    addStar('三奇贵人', sanQiGuiRen(allGans, pillarIndex));
    addStar('驿马', (witch !== 3 && yiMa(context.dayZhi, targetZhi)) || (witch !== 1 && yiMa(context.yearZhi, targetZhi)));
    addStar('华盖', (witch !== 3 && huaGai(context.dayZhi, targetZhi)) || (witch !== 1 && huaGai(context.yearZhi, targetZhi)));
    addStar('将星', (witch !== 3 && jiangXing(context.dayZhi, targetZhi)) || (witch !== 1 && jiangXing(context.yearZhi, targetZhi)));
    addStar('金舆', jinYu(context.dayGan, targetZhi) || jinYu(context.yearGan, targetZhi));
    addStar('金神', (witch === 3 && jinShen(context.dayGan, context.dayZhi)) || (witch === 4 && jinShen(context.hourGan, context.hourZhi)));
    addStar('天医', witch !== 2 && tianYi(context.monthZhi, targetZhi));
    addStar('禄神', luShen(context.dayGan, targetZhi));
    addStar('天赦', tianShe(context.monthZhi, context.dayGan, context.dayZhi));
    addStar('红鸾', witch !== 1 && hongLuan(context.yearZhi, targetZhi));
    addStar('天喜', witch !== 1 && tianXi(context.yearZhi, targetZhi));
    addStar('流霞', liuXia(context.dayGan, targetZhi));
    addStar('红艳', hongYan(context.dayGan, targetZhi));
    addStar(
        '天罗地网',
        (witch !== 3 && (tianLuo(context.dayZhi, targetZhi) || diWang(context.dayZhi, targetZhi)))
        || (witch !== 1 && (tianLuo(context.yearZhi, targetZhi) || diWang(context.yearZhi, targetZhi)))
    );
    addStar('羊刃', yangRen(context.dayGan, targetZhi));
    addStar('飞刃', feiRen(context.dayGan, targetZhi));
    addStar('血刃', xueRen(context.monthZhi, targetZhi));
    addStar('八专', witch === 3 && baZhuan(context.dayGan, context.dayZhi));
    addStar('六秀日', witch === 3 && liuXiuRi(context.dayGan, context.dayZhi));
    addStar('九丑', witch === 3 && jiuChou(context.dayGan, context.dayZhi));
    addStar('劫煞', jieSha(context.dayZhi, targetZhi) || jieSha(context.yearZhi, targetZhi));
    addStar('灾煞', zaiSha(context.yearZhi, targetZhi));
    addStar('勾绞煞', witch !== 1 && gouJiaoSha(context.yearZhi, targetZhi));
    addStar('元辰', witch !== 1 && yuanChen(context.yearZhi, targetZhi, isMan, tianganYinYang(context.yearGan)));
    addStar('空亡', (witch !== 3 && kongWang(`${context.dayGan}${context.dayZhi}`, targetZhi)) || (witch !== 1 && kongWang(`${context.yearGan}${context.yearZhi}`, targetZhi)));
    addStar('童子', (witch === 3 && tongZi(context.monthZhi, context.yearNaYin, context.dayZhi))
        || (witch === 4 && tongZi(context.monthZhi, context.yearNaYin, context.hourZhi)));
    addStar('天厨', tianChu(context.yearGan, context.dayGan, targetZhi));
    addStar('孤辰', witch !== 1 && guChen(context.yearZhi, targetZhi));
    addStar('寡宿', witch !== 1 && guaSu(context.yearZhi, targetZhi));
    addStar('亡神', (witch !== 3 && wangShen(context.dayZhi, targetZhi)) || (witch !== 1 && wangShen(context.yearZhi, targetZhi)));
    addStar('十恶大败', witch === 3 && shiEDaBai(context.dayGan, context.dayZhi));
    addStar('桃花', taoHua(context.dayZhi, targetZhi) || taoHua(context.yearZhi, targetZhi));
    addStar('孤鸾', witch === 3 && guLuan(context.dayGan, context.dayZhi));
    addStar('阴差阳错', witch === 3 && yinChaYangCuo(context.dayGan, context.dayZhi));
    addStar('四废', witch === 3 && siFei(context.monthZhi, context.dayGan, context.dayZhi));
    addStar('天转日', witch === 3 && tianZhuanRi(context.monthZhi, context.dayGan, context.dayZhi));
    addStar('地转日', witch === 3 && diZhuanRi(context.monthZhi, context.dayGan, context.dayZhi));
    addStar('丧门', witch !== 1 && checkYearZhiRelation(context.yearZhi, targetZhi, 'shangmen'));
    addStar('吊客', witch !== 1 && checkYearZhiRelation(context.yearZhi, targetZhi, 'diaoke'));
    addStar('披麻', witch !== 1 && checkYearZhiRelation(context.yearZhi, targetZhi, 'pima'));
    addStar('十灵', witch === 3 && shiLing(context.dayGan, context.dayZhi));
    addStar('拱禄', witch === 4 && gongLu(context.dayGan, context.dayZhi, context.hourGan, context.hourZhi));

    return stars;
}

function buildStarToPillars(byPillar: BaziShenShaResult['byPillar']): Record<string, BaziPillarKey[]> {
    const starToPillars: Record<string, BaziPillarKey[]> = {};
    byPillar.forEach((item) => {
        item.stars.forEach((star) => {
            if (!starToPillars[star]) {
                starToPillars[star] = [];
            }
            if (!starToPillars[star].includes(item.pillar)) {
                starToPillars[star].push(item.pillar);
            }
        });
    });
    return starToPillars;
}

function buildAllStars(byPillar: BaziShenShaResult['byPillar']): string[] {
    const allStars: string[] = [];
    byPillar.forEach((item) => {
        item.stars.forEach((star) => {
            if (!allStars.includes(star)) {
                allStars.push(star);
            }
        });
    });
    return allStars;
}

export function calculateBaziShenSha(params: CalculateBaziShenShaParams): BaziShenShaResult {
    if (params.gender !== 0 && params.gender !== 1) {
        throw new Error(`无效的性别: ${String(params.gender)}`);
    }

    const parsed = params.fourPillars.map((ganZhi) => parsePillar(ganZhi)) as [
        ParsedPillar,
        ParsedPillar,
        ParsedPillar,
        ParsedPillar,
    ];

    const context: BaziShenShaContext = {
        yearGan: parsed[0].gan,
        yearZhi: parsed[0].zhi,
        monthGan: parsed[1].gan,
        monthZhi: parsed[1].zhi,
        dayGan: parsed[2].gan,
        dayZhi: parsed[2].zhi,
        hourGan: parsed[3].gan,
        hourZhi: parsed[3].zhi,
        yearNaYin: SixtyCycle.fromName(parsed[0].ganZhi).getSound().getName(),
        gender: params.gender,
    };

    const byPillar = parsed.map((pillar, index) => {
        const pillarIndex = index as 0 | 1 | 2 | 3;
        const item: BaziShenShaPillarItem = {
            pillar: PILLAR_KEYS[pillarIndex],
            pillarIndex,
            ganZhi: pillar.ganZhi,
            tianGan: pillar.gan,
            diZhi: pillar.zhi,
            stars: collectPillarStars(context, pillar, (pillarIndex + 1) as 1 | 2 | 3 | 4, pillarIndex),
        };
        return item;
    }) as BaziShenShaResult['byPillar'];

    return {
        byPillar,
        allStars: buildAllStars(byPillar),
        starToPillars: buildStarToPillars(byPillar),
    };
}

function toLayerBucket(result: BaziShenShaResult, compatNote: string[] = []): BaziShenShaLayerBucket {
    const byPillar: BaziShenShaLayerPositionItem[] = result.byPillar.map((item) => ({
        position: item.pillar,
        ganZhi: item.ganZhi,
        stars: item.stars.map((star) => ({
            star,
            hitLevel: star.includes('贵人') ? 'strong' : 'normal',
            hitReason: `命中${star}`,
        })),
    }));

    return {
        byPillar,
        allStars: result.allStars,
        starToPositions: result.starToPillars,
        compatNote,
    };
}

function withReplacedHour(fourPillars: BaziFourPillars, hourGanZhi: string): BaziFourPillars {
    return [fourPillars[0], fourPillars[1], fourPillars[2], hourGanZhi];
}

function toLayerItems(
    ganZhiBuckets: Record<string, BaziShenShaLayerBucket>,
    items: Array<{ index: number; label: string; ganZhi: string }>
): BaziShenShaLayerItem[] {
    return items.map((item) => {
        const bucket = ganZhiBuckets[item.ganZhi]
            ?? {
                byPillar: [],
                allStars: [],
                starToPositions: {},
                compatNote: ['主口径按 fatemaster 神煞指南映射'],
            };
        return {
            index: item.index,
            label: item.label,
            ganZhi: item.ganZhi,
            bucket,
        };
    });
}

export function buildBaziShenShaBucketMap(params: CalculateBaziShenShaParams & { ganZhiList: string[] }): Record<string, BaziShenShaLayerBucket> {
    const uniqueGanZhi = Array.from(new Set(params.ganZhiList.filter((item) => typeof item === 'string' && item !== '—')));
    const compatNote = ['主口径按 fatemaster 神煞指南映射'];

    return uniqueGanZhi.reduce<Record<string, BaziShenShaLayerBucket>>((accumulator, ganZhi) => {
        accumulator[ganZhi] = toLayerBucket(
            calculateBaziShenSha({
                fourPillars: withReplacedHour(params.fourPillars, ganZhi),
                gender: params.gender,
            }),
            compatNote,
        );
        return accumulator;
    }, {});
}

export function toLegacyBaziShenShaResult(bucket: BaziShenShaLayerBucket): BaziShenShaResult {
    const byPillar = bucket.byPillar.map((item, index) => ({
        pillar: item.position,
        pillarIndex: index as 0 | 1 | 2 | 3,
        ganZhi: item.ganZhi,
        tianGan: SixtyCycle.fromName(item.ganZhi).getHeavenStem().getName(),
        diZhi: SixtyCycle.fromName(item.ganZhi).getEarthBranch().getName(),
        stars: item.stars.map((star) => star.star),
    })) as BaziShenShaResult['byPillar'];

    return {
        byPillar,
        allStars: bucket.allStars,
        starToPillars: bucket.starToPositions,
    };
}

export function calculateBaziShenShaV2(params: CalculateBaziShenShaV2Params): BaziShenShaV2Result {
    const siZhuLegacy = calculateBaziShenSha(params);
    const siZhu = toLayerBucket(siZhuLegacy, ['主口径按 fatemaster 神煞指南映射']);
    const ganZhiBuckets = buildBaziShenShaBucketMap({
        fourPillars: params.fourPillars,
        gender: params.gender,
        ganZhiList: [
            ...(params.ganZhiPool ?? []),
            ...(params.daYun ?? []).map((item) => item.ganZhi),
            ...(params.liuNian ?? []).map((item) => item.ganZhi),
            ...(params.liuYue ?? []).map((item) => item.ganZhi),
        ],
    });

    const daYun = toLayerItems(
        ganZhiBuckets,
        (params.daYun ?? []).map((item) => ({
            index: item.index,
            label: `大运${item.index + 1}`,
            ganZhi: item.ganZhi,
        }))
    );

    const liuNian = toLayerItems(
        ganZhiBuckets,
        (params.liuNian ?? []).map((item) => ({
            index: item.index,
            label: `流年${item.year}`,
            ganZhi: item.ganZhi,
        }))
    );

    const liuYue = toLayerItems(
        ganZhiBuckets,
        (params.liuYue ?? []).map((item) => ({
            index: item.index,
            label: `流月${item.termName}`,
            ganZhi: item.ganZhi,
        }))
    );

    return {
        catalogVersion: 'fatemaster-55-v1',
        catalog: BAZI_SHENSHA_CATALOG,
        siZhu,
        daYun,
        liuNian,
        liuYue,
        ganZhiBuckets,
    };
}
