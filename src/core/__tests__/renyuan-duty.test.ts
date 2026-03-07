import { buildWuXingBandFromMonthBranch, calculateRenYuanDuty } from '../renyuan-duty';

describe('renyuan duty', () => {
    it('resolves zi month duty as ren water for 2001-12-08 17:41 sample', () => {
        const duty = calculateRenYuanDuty(new Date(2001, 11, 8, 17, 26, 0));

        expect(duty.stem).toBe('壬');
        expect(duty.element).toBe('水');
        expect(duty.monthBranch).toBe('子');
        expect(duty.ruleKey).toBe('ziping_zhenquan_v1');
        expect(duty.display).toContain('壬水');
    });

    it('starts counting from day 1 at exact jie boundary', () => {
        const duty = calculateRenYuanDuty(new Date(2001, 11, 7, 9, 28, 53));

        expect(duty.dayIndex).toBe(1);
        expect(duty.stem).toBe('壬');
        expect(duty.element).toBe('水');
    });

    it('builds zi month wuxing band with correct wang xiang xiu qiu si order', () => {
        expect(buildWuXingBandFromMonthBranch('子')).toEqual([
            { element: '水', status: '旺' },
            { element: '木', status: '相' },
            { element: '金', status: '休' },
            { element: '土', status: '囚' },
            { element: '火', status: '死' },
        ]);
    });
});
