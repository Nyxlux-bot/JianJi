import { buildJiaoYunRuleDetail } from '../jiaoyun-rule';

describe('jiaoyun rule', () => {
    it('builds lixa after 12 days rule for 2002-05-18 11:40', () => {
        const detail = buildJiaoYunRuleDetail(new Date(2002, 4, 18, 11, 40, 0), 2002);

        expect(detail.anchorJieName).toBe('立夏');
        expect(detail.offsetDaysAfterJie).toBe(12);
        expect(detail.yearStemPair).toEqual(['壬', '丁']);
        expect(detail.displayText).toBe('逢壬、丁年立夏后12天交大运');
    });

    it('builds liqiu after 20 days rule for 2010-08-28 12:13', () => {
        const detail = buildJiaoYunRuleDetail(new Date(2010, 7, 28, 12, 13, 0), 2010);

        expect(detail.anchorJieName).toBe('立秋');
        expect(detail.offsetDaysAfterJie).toBe(20);
        expect(detail.yearStemPair).toEqual(['庚', '乙']);
        expect(detail.displayText).toBe('逢庚、乙年立秋后20天交大运');
    });
});
