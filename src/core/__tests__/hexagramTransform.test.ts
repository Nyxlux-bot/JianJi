import { getHuGua, getCuoGua, getZongGua, getAllRelatedGua } from '../hexagramTransform';

describe('Hexagram Transformation (互错综卦)', () => {
    // 假设以水雷屯卦为例，爻象从初到上为：
    // 初九、六二、六三、六四、九五、上六
    // 对应数组: [1, 0, 0, 0, 1, 0]
    const chunGua = [1, 0, 0, 0, 1, 0];

    it('should correctly calculate Hu Gua (互卦)', () => {
        // 屯卦互为山地剥卦: [0, 0, 0, 0, 0, 1]
        // 取：2爻(0), 3爻(0), 4爻(0), 3爻(0), 4爻(0), 5爻(1)
        const expectedHu = [0, 0, 0, 0, 0, 1];
        expect(getHuGua(chunGua)).toEqual(expectedHu);
    });

    it('should correctly calculate Cuo Gua (错卦)', () => {
        // 屯卦全翻转为火风鼎卦: [0, 1, 1, 1, 0, 1]
        const expectedCuo = [0, 1, 1, 1, 0, 1];
        expect(getCuoGua(chunGua)).toEqual(expectedCuo);
    });

    it('should correctly calculate Zong Gua (综卦)', () => {
        // 屯卦上下颠倒为山水蒙卦: [0, 1, 0, 0, 0, 1]
        const expectedZong = [0, 1, 0, 0, 0, 1];
        expect(getZongGua(chunGua)).toEqual(expectedZong);
    });

    it('should correctly package all related hexagrams using getAllRelatedGua', () => {
        const result = getAllRelatedGua(chunGua);

        expect(result.base).toEqual(chunGua);
        expect(result.hu).toEqual([0, 0, 0, 0, 0, 1]);
        expect(result.cuo).toEqual([0, 1, 1, 1, 0, 1]);
        expect(result.zong).toEqual([0, 1, 0, 0, 0, 1]);
    });

    it('should throw an error if array length is not 6', () => {
        const invalidArray = [0, 1, 0];
        const errorMessage = "本卦数组长度必须为 6";

        expect(() => getHuGua(invalidArray)).toThrow(errorMessage);
        expect(() => getCuoGua(invalidArray)).toThrow(errorMessage);
        expect(() => getZongGua(invalidArray)).toThrow(errorMessage);
        expect(() => getAllRelatedGua(invalidArray)).toThrow(errorMessage);
    });

    it('should not mutate original array when computing Zong Gua', () => {
        const originalArray = [1, 0, 0, 0, 1, 0];
        const copy = [...originalArray];
        getZongGua(originalArray);
        expect(originalArray).toEqual(copy);
    });
});
