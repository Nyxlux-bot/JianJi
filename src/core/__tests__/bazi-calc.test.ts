import { calculateBazi } from '../bazi-calc';
import { BAZI_SHENSHA_CATALOG, BAZI_SHENSHA_ALIAS_TO_FULLNAME } from '../bazi-shensha-catalog';

describe('calculateBazi', () => {
    const birthDate = new Date(1990, 5, 15, 12, 30, 0);
    const recordedAt = new Date(2026, 2, 7, 12, 0, 0);

    it('returns deterministic results for the same input', () => {
        const first = calculateBazi({
            date: birthDate,
            gender: 1,
            referenceDate: new Date(2010, 5, 15, 12, 30, 0),
            createdAt: recordedAt,
        });
        const second = calculateBazi({
            date: new Date(1990, 5, 15, 12, 30, 0),
            gender: 1,
            referenceDate: new Date(2010, 5, 15, 12, 30, 0),
            createdAt: recordedAt,
        });

        expect(first).toEqual(second);
    });

    it('keeps trueSolarTime equal to solarTime when longitude is absent', () => {
        const result = calculateBazi({ date: birthDate, gender: 1 });
        expect(result.trueSolarTime).toBe(result.solarTime);
        expect(result.timeMeta.trueSolarDateTimeIso).toBe(result.timeMeta.solarDateTimeIso);
    });

    it('allows true solar time correction to change pillars near zi hour boundary', () => {
        const baseDate = new Date(2024, 0, 1, 23, 40, 0);
        const plain = calculateBazi({ date: baseDate, gender: 1 });
        const corrected = calculateBazi({
            date: baseDate,
            gender: 1,
            longitude: 105,
            schoolOptions: { timeMode: 'true_solar_time' },
        });

        expect(corrected.trueSolarTime).not.toBe(plain.trueSolarTime);
        expect(corrected.fourPillars).not.toEqual(plain.fourPillars);
    });

    it('defaults referenceDate to birth date', () => {
        const withoutReference = calculateBazi({ date: birthDate, gender: 1, createdAt: recordedAt });
        const withReference = calculateBazi({ date: birthDate, gender: 1, referenceDate: birthDate, createdAt: recordedAt });

        expect(withoutReference).toEqual(withReference);
    });

    it('uses the provided createdAt as record timestamp', () => {
        const result = calculateBazi({
            date: birthDate,
            gender: 1,
            createdAt: recordedAt,
        });

        expect(result.createdAt).toBe(recordedAt.toISOString());
        expect(result.createdAt).not.toBe(result.timeMeta.solarDateTimeIso);
    });

    it('returns 戊戌甲寅戊子庚申 for 2018-02-25 15:00 without longitude correction', () => {
        const result = calculateBazi({
            date: new Date(2018, 1, 25, 15, 0, 0),
            gender: 1,
        });

        expect(result.trueSolarTime).toBe('15:00');
        expect(result.fourPillars).toEqual(['戊戌', '甲寅', '戊子', '庚申']);
    });

    it('keeps local clock-time pillars even when longitude exists under the default mode', () => {
        const result = calculateBazi({
            date: new Date(2018, 1, 25, 15, 0, 0),
            gender: 1,
            longitude: 116.41,
        });

        expect(result.schoolOptionsResolved.timeMode).toBe('clock_time');
        expect(result.trueSolarTime).toBe('15:00');
        expect(result.fourPillars).toEqual(['戊戌', '甲寅', '戊子', '庚申']);
    });

    it('supports mean-solar-time as a separate bazi-only correction mode', () => {
        const result = calculateBazi({
            date: new Date(2018, 1, 25, 15, 0, 0),
            gender: 1,
            longitude: 116.41,
            schoolOptions: { timeMode: 'mean_solar_time' },
        });

        expect(result.schoolOptionsResolved.timeMode).toBe('mean_solar_time');
        expect(result.trueSolarTime).toBe('14:45');
        expect(result.fourPillars).toEqual(['戊戌', '甲寅', '戊子', '己未']);
    });

    it('applies daylight-saving correction before solar-time conversion when enabled', () => {
        const standard = calculateBazi({
            date: new Date(2018, 1, 25, 13, 10, 0),
            gender: 1,
            longitude: 120,
            schoolOptions: { timeMode: 'mean_solar_time' },
        });
        const daylightSaving = calculateBazi({
            date: new Date(2018, 1, 25, 13, 10, 0),
            gender: 1,
            longitude: 120,
            schoolOptions: { timeMode: 'mean_solar_time', daylightSaving: true },
        });

        expect(standard.schoolOptionsResolved.daylightSaving).toBe(false);
        expect(daylightSaving.schoolOptionsResolved.daylightSaving).toBe(true);
        expect(standard.trueSolarTime).toBe('13:10');
        expect(daylightSaving.trueSolarTime).toBe('12:10');
        expect(daylightSaving.fourPillars).not.toEqual(standard.fourPillars);
    });

    it('moves 2018-02-25 15:00 into 未时 under the current true-solar-time formula', () => {
        const result = calculateBazi({
            date: new Date(2018, 1, 25, 15, 0, 0),
            gender: 1,
            longitude: 120,
            schoolOptions: { timeMode: 'true_solar_time' },
        });

        expect(result.trueSolarTime).toBe('14:46');
        expect(result.fourPillars).toEqual(['戊戌', '甲寅', '戊子', '己未']);
    });

    it('returns -1 currentDaYunIndex before first luck cycle starts', () => {
        const result = calculateBazi({ date: birthDate, gender: 1 });

        expect(result.currentDaYunIndex).toBe(-1);
        expect(result.liuNian).toEqual([]);
        expect(result.daYun.every((item) => !item.isCurrent)).toBe(true);
    });

    it('expands 10 decade fortunes and 10 fortune years for each decade', () => {
        const result = calculateBazi({
            date: birthDate,
            gender: 1,
            referenceDate: new Date(2010, 5, 15, 12, 30, 0),
        });

        expect(result.daYun).toHaveLength(10);
        expect(result.daYun.every((item) => item.liuNian.length === 10)).toBe(true);
        expect(result.shenShaV2.ganZhiBuckets?.[result.daYun[0].ganZhi]).toBeDefined();
        expect(result.shenShaV2.ganZhiBuckets?.[result.baseInfo.shenGong.split('（')[0]]).toBeDefined();
        expect(result.shenShaV2.ganZhiBuckets?.[result.baseInfo.mingGong.split('（')[0]]).toBeDefined();
        expect(result.shenShaV2.ganZhiBuckets?.[result.baseInfo.taiYuan.split('（')[0]]).toBeDefined();
    });

    it('marks day pillar ten star as day master', () => {
        const result = calculateBazi({ date: birthDate, gender: 1 });
        expect(result.shiShen[2].shiShen).toBe('日主');
    });

    it('keeps cangGan fixed slots in sync with original items', () => {
        const result = calculateBazi({ date: birthDate, gender: 1 });

        result.cangGan.forEach((group) => {
            const benQi = group.items.find((item) => item.type === 'benQi') ?? null;
            const zhongQi = group.items.find((item) => item.type === 'zhongQi') ?? null;
            const yuQi = group.items.find((item) => item.type === 'yuQi') ?? null;

            expect(group.benQi).toEqual(benQi);
            expect(group.zhongQi).toEqual(zhongQi);
            expect(group.yuQi).toEqual(yuQi);
        });
    });

    it('changes fortune direction/output when gender changes', () => {
        const male = calculateBazi({
            date: birthDate,
            gender: 1,
            referenceDate: new Date(2010, 5, 15, 12, 30, 0),
        });
        const female = calculateBazi({
            date: birthDate,
            gender: 0,
            referenceDate: new Date(2010, 5, 15, 12, 30, 0),
        });

        expect(male.daYun[0].ganZhi).not.toBe(female.daYun[0].ganZhi);
        expect(male.childLimit.startYear).not.toBe(female.childLimit.startYear);
    });

    it('keeps id stable but sensitive to referenceDate and longitude', () => {
        const base = calculateBazi({ date: birthDate, gender: 1 });
        const withReference = calculateBazi({
            date: birthDate,
            gender: 1,
            referenceDate: new Date(2010, 5, 15, 12, 30, 0),
        });
        const withLongitude = calculateBazi({
            date: birthDate,
            gender: 1,
            longitude: 116.4,
        });

        expect(base.id).not.toBe(withReference.id);
        expect(base.id).not.toBe(withLongitude.id);
        expect(base.id).toBe(calculateBazi({ date: birthDate, gender: 1 }).id);
    });

    it('returns -1 and empty top-level liuNian beyond the covered decade range', () => {
        const result = calculateBazi({
            date: birthDate,
            gender: 1,
            referenceDate: new Date(2200, 0, 1, 0, 0, 0),
        });

        expect(result.currentDaYunIndex).toBe(-1);
        expect(result.liuNian).toEqual([]);
    });

    it('builds bazi shensha for 2001-03-07 15:40 with true solar time', () => {
        const result = calculateBazi({
            date: new Date(2001, 2, 7, 15, 40, 0),
            gender: 1,
            longitude: 116.41,
            schoolOptions: { timeMode: 'true_solar_time' },
        });

        expect(result.trueSolarTime).toBe('15:13');
        expect(result.fourPillars).toEqual(['辛巳', '辛卯', '己巳', '壬申']);

        expect(result.shenSha.byPillar[0].stars).toEqual(['天德合', '福星贵人', '学堂', '国印贵人', '羊刃']);
        expect(result.shenSha.byPillar[1].stars).toEqual(['灾煞', '吊客']);
        expect(result.shenSha.byPillar[2].stars).toEqual(['天德合', '月德合', '福星贵人', '学堂', '国印贵人', '金神', '羊刃']);
        expect(result.shenSha.byPillar[3].stars).toEqual(['天乙贵人', '天德贵人', '词馆', '金舆', '勾绞煞', '空亡', '孤辰', '亡神']);

        expect(result.shenSha.allStars).toEqual([
            '天德合',
            '福星贵人',
            '学堂',
            '国印贵人',
            '羊刃',
            '灾煞',
            '吊客',
            '月德合',
            '金神',
            '天乙贵人',
            '天德贵人',
            '词馆',
            '金舆',
            '勾绞煞',
            '空亡',
            '孤辰',
            '亡神',
        ]);
        expect(result.yuanMing.baseYear).toBe(2001);
        expect(result.yuanMing.yuanNan.guaNumber).toBe(8);
        expect(result.yuanMing.yuanNan.guaName).toBe('艮');
        expect(result.yuanMing.yuanNv.guaNumber).toBe(7);
        expect(result.yuanMing.current.label).toBe('元男');
    });

    it('builds forward daYun/liuNian/liuYue for female chart at 2001-03-07 15:40', () => {
        const result = calculateBazi({
            date: new Date(2001, 2, 7, 15, 40, 0),
            gender: 0,
            longitude: 116.41,
            referenceDate: new Date(2010, 7, 30, 12, 0, 0),
            schoolOptions: { timeMode: 'true_solar_time' },
        });

        expect(result.childLimit.years).toBe(9);
        expect(result.childLimit.months).toBe(5);
        expect(result.childLimit.jiaoYunRuleText).toBe('逢庚、乙年立秋后20天交大运');
        expect(result.daYun[0].ganZhi).toBe('壬辰');
        expect(result.daYun[0].startYear).toBe(2010);
        expect(result.daYun[0].liuNian[0].ganZhi).toBe('庚寅');
        expect(result.daYun[0].liuNian[0].xiaoYunGanZhi).toBe('壬午');

        expect(result.xiaoYun[0].year).toBe(2001);
        expect(result.xiaoYun[0].ganZhi).toBe('辛巳');
        expect(result.xiaoYun[0].xiaoYunGanZhi).toBe('癸酉');
        expect(result.xiaoYun[0].liuYue[0].termName).toBe('惊蛰');
        expect(result.xiaoYun[0].liuYue[0].ganZhi).toBe('辛卯');
        expect(result.xiaoYun[0].liuYue[result.xiaoYun[0].liuYue.length - 1].termName).toBe('大雪');
        expect(result.yuanMing.current.label).toBe('元女');
        expect(result.yuanMing.current.guaName).toBe('兑');
    });

    it('builds huizhou male jiaoyun rule for 2001-12-08 17:41', () => {
        const result = calculateBazi({
            date: new Date(2001, 11, 8, 17, 41, 0),
            gender: 1,
            longitude: 114.42,
            locationName: '广东省惠州市惠城区',
            referenceDate: new Date(2026, 2, 6, 12, 0, 0),
            schoolOptions: { timeMode: 'true_solar_time' },
        });

        expect(result.childLimit.jiaoYunRuleText).toBe('逢壬、丁年立夏后12天交大运');
        expect(result.childLimit.jiaoYunYearStems).toEqual(['壬', '丁']);
        expect(result.childLimit.jiaoYunAnchorJieName).toBe('立夏');
        expect(result.childLimit.jiaoYunOffsetDaysAfterJie).toBe(12);
    });

    it('keeps complete structure for 2001-12-08 17:41 Shantou male chart', () => {
        const result = calculateBazi({
            date: new Date(2001, 11, 8, 17, 41, 0),
            gender: 1,
            longitude: 116.68,
            referenceDate: new Date(2026, 2, 6, 12, 0, 0),
            schoolOptions: { timeMode: 'true_solar_time' },
        });

        expect(result.longitude).toBe(116.68);
        expect(result.fourPillars).toHaveLength(4);
        expect(result.daYun).toHaveLength(10);
        expect(result.daYun.every((item) => item.liuNian.length === 10)).toBe(true);
        expect(result.daYun.every((item) => item.liuNian.every((year) => year.liuYue.length > 0))).toBe(true);
        expect(result.shenSha.byPillar).toHaveLength(4);
        expect(result.shenSha.byPillar[0].stars).toContain('金舆');
        expect(result.shenSha.byPillar[2].stars).toContain('学堂');
        expect(result.shenSha.byPillar[2].stars).toContain('金舆');
        expect(result.yuanMing.current.label).toBe('元男');
    });

    it('keeps shensha catalog at 55 and outputs only canonical full names', () => {
        const result = calculateBazi({
            date: new Date(2001, 11, 8, 17, 41, 0),
            gender: 1,
            longitude: 116.68,
            referenceDate: new Date(2026, 2, 6, 12, 0, 0),
            schoolOptions: { timeMode: 'true_solar_time' },
        });

        const catalogSet = new Set(BAZI_SHENSHA_CATALOG.map((item) => item.fullName));
        expect(BAZI_SHENSHA_CATALOG.length).toBe(55);
        expect(result.shenShaV2.catalog.length).toBe(55);
        expect(result.shenShaV2.siZhu.byPillar).toHaveLength(4);
        expect(result.shenShaV2.daYun.length).toBe(result.daYun.length);
        expect(result.shenShaV2.liuNian.length).toBe(result.liuNian.length);
        expect(result.shenShaV2.liuYue.length).toBe(result.liuNian[0].liuYue.length);

        result.shenShaV2.siZhu.allStars.forEach((name) => {
            expect(catalogSet.has(name)).toBe(true);
            expect(BAZI_SHENSHA_ALIAS_TO_FULLNAME[name]).toBe(name);
        });
        result.shenShaV2.daYun.forEach((layer) => {
            layer.bucket.allStars.forEach((name) => {
                expect(catalogSet.has(name)).toBe(true);
                expect(BAZI_SHENSHA_ALIAS_TO_FULLNAME[name]).toBe(name);
            });
        });
        result.shenShaV2.liuNian.forEach((layer) => {
            layer.bucket.allStars.forEach((name) => {
                expect(catalogSet.has(name)).toBe(true);
                expect(BAZI_SHENSHA_ALIAS_TO_FULLNAME[name]).toBe(name);
            });
        });
        result.shenShaV2.liuYue.forEach((layer) => {
            layer.bucket.allStars.forEach((name) => {
                expect(catalogSet.has(name)).toBe(true);
                expect(BAZI_SHENSHA_ALIAS_TO_FULLNAME[name]).toBe(name);
            });
        });
    });

    it('supports zi-hour school switch', () => {
        const base = calculateBazi({
            date: new Date(2001, 0, 1, 23, 30, 0),
            gender: 1,
        });
        const switched = calculateBazi({
            date: new Date(2001, 0, 1, 23, 30, 0),
            gender: 1,
            schoolOptions: { ziHourMode: 'early_zi_same_day' },
        });

        expect(base.schoolOptionsResolved.ziHourMode).toBe('late_zi_next_day');
        expect(base.schoolOptionsResolved.timeMode).toBe('clock_time');
        expect(switched.schoolOptionsResolved.ziHourMode).toBe('early_zi_same_day');
        expect(switched.schoolOptionsResolved.timeMode).toBe('clock_time');
        expect(switched.fourPillars).not.toEqual(base.fourPillars);
    });

    it('does not leak zi-hour provider choice across calls', () => {
        const input = {
            date: new Date(2001, 0, 1, 23, 30, 0),
            gender: 1 as const,
        };
        const before = calculateBazi(input);

        calculateBazi({
            ...input,
            schoolOptions: { ziHourMode: 'early_zi_same_day' },
        });

        const after = calculateBazi(input);
        expect(after.fourPillars).toEqual(before.fourPillars);
        expect(after.schoolOptionsResolved.ziHourMode).toBe('late_zi_next_day');
    });

    it('exposes child limit minutes and ziping renyuan duty detail', () => {
        const result = calculateBazi({
            date: new Date(2001, 11, 8, 17, 41, 0),
            gender: 1,
            longitude: 116.68,
            referenceDate: new Date(2026, 2, 6, 12, 0, 0),
            schoolOptions: { timeMode: 'true_solar_time' },
        });

        expect(result.childLimit.minutes).toBeGreaterThanOrEqual(0);
        expect(result.baseInfo.renYuanDuty).toBe('壬水用事');
        expect(result.baseInfo.renYuanDutyDetail.stem).toBe('壬');
        expect(result.baseInfo.renYuanDutyDetail.element).toBe('水');
        expect(result.baseInfo.renYuanDutyDetail.dayIndex).toBeGreaterThan(0);
        expect(result.baseInfo.renYuanDutyDetail.monthBranch).toBe('子');
        expect(result.baseInfo.renYuanDutyDetail.ruleKey).toBe('ziping_zhenquan_v1');
        expect(result.baseInfo.renYuanDutyDetail.display).toContain(`第${result.baseInfo.renYuanDutyDetail.dayIndex}天`);
    });
});
