/**
 * 六爻排盘：本卦推导互卦、错卦、综卦核心逻辑
 * 遵循《周易》数学规则，输入与输出均为长度为 6 的由 0 (阴) 和 1 (阳) 组成的数组。
 * 数组索引 0 代表初爻（从下往上数第一爻），索引 5 代表上爻。
 */

/**
 * 推断互卦 (Hu Gua)
 * 互卦是由本卦的内部结构产生：
 * - 下互卦：取本卦的二、三、四爻（即索引 1, 2, 3）
 * - 上互卦：取本卦的三、四、五爻（即索引 2, 3, 4）
 *
 * @param baseYao 本卦数组 (长度必须为 6)
 * @returns 互卦数组 (长度 6)
 */
export function getHuGua(baseYao: number[]): number[] {
    if (baseYao.length !== 6) {
        throw new Error("本卦数组长度必须为 6");
    }
    return [
        baseYao[1], // 互卦初爻 <- 本卦二爻
        baseYao[2], // 互卦二爻 <- 本卦三爻
        baseYao[3], // 互卦三爻 <- 本卦四爻
        baseYao[2], // 互卦四爻 <- 本卦三爻
        baseYao[3], // 互卦五爻 <- 本卦四爻
        baseYao[4]  // 互卦上爻 <- 本卦五爻
    ];
}

/**
 * 推断错卦 (Cuo Gua / 旁通卦)
 * 错卦是将本卦的六个爻阴阳全部反转。
 * 0 变 1，1 变 0。
 *
 * @param baseYao 本卦数组 (长度必须为 6)
 * @returns 错卦数组 (长度 6)
 */
export function getCuoGua(baseYao: number[]): number[] {
    if (baseYao.length !== 6) {
        throw new Error("本卦数组长度必须为 6");
    }
    return baseYao.map(yao => (yao === 0 ? 1 : 0));
}

/**
 * 推断综卦 (Zong Gua / 反卦)
 * 综卦是将整个本卦上下颠倒，即从上往下看。
 * 在数组操作上，就是将本卦的六个爻顺序完全颠倒反转。
 *
 * @param baseYao 本卦数组 (长度必须为 6)
 * @returns 综卦数组 (长度 6)
 */
export function getZongGua(baseYao: number[]): number[] {
    if (baseYao.length !== 6) {
        throw new Error("本卦数组长度必须为 6");
    }
    // 使用 [...baseYao] 避免修改原数组
    return [...baseYao].reverse();
}

export interface RelatedHexagrams {
    base: number[]; // 本卦
    hu: number[];   // 互卦
    cuo: number[];  // 错卦
    zong: number[]; // 综卦
}

/**
 * 获取所有相关衍生卦象
 * 一键推导出指定本卦对应的互、错、综三种关联卦。
 *
 * @param baseYao 本卦数组 (长度必须为 6)
 * @returns 包含本、互、错、综的综合对象
 */
export function getAllRelatedGua(baseYao: number[]): RelatedHexagrams {
    if (baseYao.length !== 6) {
        throw new Error("本卦数组长度必须为 6");
    }
    return {
        base: baseYao,
        hu: getHuGua(baseYao),
        cuo: getCuoGua(baseYao),
        zong: getZongGua(baseYao)
    };
}
