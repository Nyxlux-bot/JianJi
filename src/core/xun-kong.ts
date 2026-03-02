/**
 * 六爻排盘辅助计算 - 旬空计算模块
 */

const TIAN_GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const DI_ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

/**
 * 旬空（空亡）计算
 * @param riZhu 日柱干支（如 '己巳'）
 * @returns 包含两个空亡地支的数组（如 ['戌', '亥']）
 */
export function getXunKong(riZhu: string): [string, string] {
    if (riZhu.length !== 2) {
        throw new Error("日柱输入格式错误，应为两个完整的汉字，如 '己巳'");
    }

    const gan = riZhu.charAt(0);
    const zhi = riZhu.charAt(1);

    const ganIndex = TIAN_GAN.indexOf(gan);
    const zhiIndex = DI_ZHI.indexOf(zhi);

    if (ganIndex === -1 || zhiIndex === -1) {
        throw new Error(`非法的干支字符: ${riZhu}`);
    }

    // 利用数学取模算出所属旬的首支偏置（例如甲子旬首支是 0，甲戌旬首支是 10）
    const offset = (zhiIndex - ganIndex + 12) % 12;

    // 空亡为其所处那一旬的最后未被天干盖住的两个地支，即 offset+10 及其下一位
    const kongA = DI_ZHI[(offset + 10) % 12];
    const kongB = DI_ZHI[(offset + 11) % 12];

    return [kongA, kongB];
}
