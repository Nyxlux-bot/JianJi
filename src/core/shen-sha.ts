/**
 * 六爻排盘辅助计算 - 核心神煞模块
 * 提供基于严格规则的纯净独立函数，拒绝规则幻觉
 */

const TIAN_GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const DI_ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

export interface ShenShaResult {
    yiMa: string;               // 驿马
    taoHua: string;             // 桃花
    tianYiGuiRen: [string, string]; // 天乙贵人（两个地支）
    luShen: string;             // 禄神
    yangRen: string;            // 羊刃
    wenChang: string;           // 文昌
    jiangXing: string;          // 将星
    huaGai: string;             // 华盖
    jieSha: string;             // 劫煞
    zaiSha: string;             // 灾煞
}

const ZHI_GROUPS = {
    SHUI: ['申', '子', '辰'], // 水局
    MU: ['亥', '卯', '未'], // 木局
    HUO: ['寅', '午', '戌'], // 火局
    JIN: ['巳', '酉', '丑'] // 金局
};

function getZhiGroup(zhi: string): 'SHUI' | 'MU' | 'HUO' | 'JIN' | null {
    if (ZHI_GROUPS.SHUI.includes(zhi)) return 'SHUI';
    if (ZHI_GROUPS.MU.includes(zhi)) return 'MU';
    if (ZHI_GROUPS.HUO.includes(zhi)) return 'HUO';
    if (ZHI_GROUPS.JIN.includes(zhi)) return 'JIN';
    return null;
}

const SHEN_SHA_MAPS = {
    yiMa: { SHUI: '寅', MU: '巳', HUO: '申', JIN: '亥' },
    taoHua: { SHUI: '酉', MU: '子', HUO: '卯', JIN: '午' },
    jiangXing: { SHUI: '子', MU: '卯', HUO: '午', JIN: '酉' },
    huaGai: { SHUI: '辰', MU: '未', HUO: '戌', JIN: '丑' },
    jieSha: { SHUI: '巳', MU: '申', HUO: '亥', JIN: '寅' },
    zaiSha: { SHUI: '午', MU: '酉', HUO: '子', JIN: '卯' }
};

const GAN_MAPS = {
    tianYiGuiRen: {
        '甲': ['丑', '未'] as [string, string], '戊': ['丑', '未'] as [string, string],
        '乙': ['子', '申'] as [string, string], '己': ['子', '申'] as [string, string],
        '丙': ['亥', '酉'] as [string, string], '丁': ['亥', '酉'] as [string, string],
        '壬': ['卯', '巳'] as [string, string], '癸': ['卯', '巳'] as [string, string],
        '庚': ['午', '寅'] as [string, string], '辛': ['午', '寅'] as [string, string]
    },
    luShen: { '甲': '寅', '乙': '卯', '丙': '巳', '丁': '午', '戊': '巳', '己': '午', '庚': '申', '辛': '酉', '壬': '亥', '癸': '子' },
    yangRen: { '甲': '卯', '乙': '辰', '丙': '午', '丁': '未', '戊': '午', '己': '未', '庚': '酉', '辛': '戌', '壬': '子', '癸': '丑' },
    wenChang: { '甲': '巳', '乙': '午', '丙': '申', '丁': '酉', '戊': '申', '己': '酉', '庚': '亥', '辛': '子', '壬': '寅', '癸': '卯' }
};

export function getShenSha(dayGan: string, dayZhi: string): ShenShaResult {
    if (!TIAN_GAN.includes(dayGan)) throw new Error(`天干格式错误: ${dayGan}`);
    if (!DI_ZHI.includes(dayZhi)) throw new Error(`地支格式错误: ${dayZhi}`);

    const group = getZhiGroup(dayZhi);

    return {
        yiMa: group ? SHEN_SHA_MAPS.yiMa[group] : '',
        taoHua: group ? SHEN_SHA_MAPS.taoHua[group] : '',
        tianYiGuiRen: (GAN_MAPS.tianYiGuiRen as Record<string, [string, string]>)[dayGan] || ['', ''],
        luShen: (GAN_MAPS.luShen as Record<string, string>)[dayGan] || '',
        yangRen: (GAN_MAPS.yangRen as Record<string, string>)[dayGan] || '',
        wenChang: (GAN_MAPS.wenChang as Record<string, string>)[dayGan] || '',
        jiangXing: group ? SHEN_SHA_MAPS.jiangXing[group] : '',
        huaGai: group ? SHEN_SHA_MAPS.huaGai[group] : '',
        jieSha: group ? SHEN_SHA_MAPS.jieSha[group] : '',
        zaiSha: group ? SHEN_SHA_MAPS.zaiSha[group] : ''
    };
}
