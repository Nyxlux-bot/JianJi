/**
 * 运限快算
 *
 * iztro 的 `astrolabe.horoscope(date)` 每次都会重新换算农历、干支并重新排一遍流耀，
 * 在 Hermes 上一次要几十毫秒。这里按同一套规则逐步复刻（`FunctionalAstrolabe` 中的
 * `_getHoroscopeBySolarDate`），把只取决于干支、宫位序号或日期的部分全部做成查表缓存，
 * 最后仍然构造 iztro 自己的 `FunctionalHoroscope`，下游拿到的对象与原版完全一致。
 *
 * 唯一有意的差别：运限分界、日界读取本命盘自己的配置，而不是 iztro 的全局配置，
 * 避免同时打开多张不同配置的命盘时互相串味。
 */
import { getHeavenlyStemAndEarthlyBranchBySolarDate, normalizeDateStr, solar2lunar } from 'lunar-lite';
import FunctionalHoroscope from 'iztro/lib/astro/FunctionalHoroscope';
import type { IFunctionalAstrolabe } from 'iztro/lib/astro/FunctionalAstrolabe';
import type { IFunctionalHoroscope } from 'iztro/lib/astro/FunctionalHoroscope';
import { getConfig } from 'iztro/lib/astro/astro';
import { getPalaceNames } from 'iztro/lib/astro/palace';
import { EARTHLY_BRANCHES } from 'iztro/lib/data';
import { kot, t } from 'iztro/lib/i18n';
import { getYearly12 } from 'iztro/lib/star';
import { fixEarthlyBranchIndex, fixIndex, getMutagensByHeavenlyStem, timeToIndex } from 'iztro/lib/utils';
import { getCachedHoroscopeStar } from './iztro-optimizer';

type LunarDateValue = ReturnType<typeof solar2lunar>;
type GanzhiValue = ReturnType<typeof getHeavenlyStemAndEarthlyBranchBySolarDate>;
type DivideValue = 'normal' | 'exact';

export interface ZiweiFastHoroscopeRules {
    horoscopeDivide: DivideValue;
    dayDivide: 'forward' | 'current';
}

const LUNAR_CACHE_LIMIT = 1024;
const GANZHI_CACHE_LIMIT = 2048;
const lunarCache = new Map<string, LunarDateValue>();
const ganzhiCache = new Map<string, GanzhiValue>();
const birthdayCache = new WeakMap<object, LunarDateValue>();
const yearly12Cache = new Map<string, ReturnType<typeof getYearly12>>();
const palaceNamesCache = new Map<number, string[]>();
const mutagenCache = new Map<string, string[]>();

const CHILDHOOD_PALACES = ['命宫', '财帛', '疾厄', '夫妻', '福德', '官禄'];

function remember<K, V>(cache: Map<K, V>, key: K, value: V, limit: number): V {
    cache.set(key, value);
    if (cache.size > limit) {
        const oldest = cache.keys().next().value;
        if (oldest !== undefined) {
            cache.delete(oldest);
        }
    }
    return value;
}

function dayKey(date: Date): string {
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function lunarOf(date: Date): LunarDateValue {
    const key = dayKey(date);
    return lunarCache.get(key) ?? remember(lunarCache, key, solar2lunar(date), LUNAR_CACHE_LIMIT);
}

/** 运限用的农历日期（与 iztro 同源，按天缓存） */
export function getCachedLunarDate(date: Date): { lunarYear: number; lunarMonth: number; lunarDay: number; isLeap: boolean } {
    return lunarOf(date);
}

function ganzhiOf(date: Date, timeIndex: number, year: DivideValue, month?: DivideValue): GanzhiValue {
    // 'exact' 分界按节气交接时刻判定，同一天不同时间可能落在两侧，所以带上时分
    const exact = year === 'exact' || month === 'exact';
    const key = `${exact ? `${dayKey(date)}T${date.getHours()}:${date.getMinutes()}` : dayKey(date)}|${timeIndex}|${year}|${month ?? '-'}`;
    const cached = ganzhiCache.get(key);
    if (cached) {
        return cached;
    }
    const options = month === undefined ? { year } : { year, month };
    return remember(ganzhiCache, key, getHeavenlyStemAndEarthlyBranchBySolarDate(date, timeIndex, options), GANZHI_CACHE_LIMIT);
}

function palaceNamesFrom(index: number): string[] {
    let names = palaceNamesCache.get(index);
    if (!names) {
        names = getPalaceNames(index) as string[];
        palaceNamesCache.set(index, names);
    }
    // 下游可能持有并修改数组，交出去的总是副本
    return names.slice();
}

function mutagensOf(heavenlyStem: string): string[] {
    const customMutagens = getConfig().mutagens;
    if (customMutagens && Object.keys(customMutagens).length > 0) {
        return getMutagensByHeavenlyStem(heavenlyStem as never) as string[];
    }
    let mutagens = mutagenCache.get(heavenlyStem);
    if (!mutagens) {
        mutagens = getMutagensByHeavenlyStem(heavenlyStem as never) as string[];
        mutagenCache.set(heavenlyStem, mutagens);
    }
    return mutagens.slice();
}

/**
 * 流年岁前、将前诸星只取决于流年地支和流派。iztro 会按全局分界重新取一次流年，
 * 这里先用本盘的分界取到地支，再拿该地支任意一年的年中日期去查（年中不受分界影响）。
 */
function yearly12Of(targetDate: Date, horoscopeDivide: DivideValue): ReturnType<typeof getYearly12> {
    const { algorithm } = getConfig();
    const branch = ganzhiOf(targetDate, 0, horoscopeDivide).yearly[1];
    const branchIndex = EARTHLY_BRANCHES.indexOf(kot(branch, 'Earthly') as never);
    const key = `${algorithm}|${branchIndex}`;
    const cached = yearly12Cache.get(key);
    if (cached) {
        return cached;
    }
    // 2020 年为子年
    const value = getYearly12(new Date(2020 + branchIndex, 6, 1) as unknown as string);
    yearly12Cache.set(key, value);
    return value;
}

function birthdayOf(astrolabe: IFunctionalAstrolabe): LunarDateValue {
    let birthday = birthdayCache.get(astrolabe);
    if (!birthday) {
        birthday = solar2lunar(astrolabe.solarDate);
        birthdayCache.set(astrolabe, birthday);
    }
    return birthday;
}

export function computeFastHoroscope(
    astrolabe: IFunctionalAstrolabe,
    targetDate: Date,
    rules: ZiweiFastHoroscopeRules,
    timeIndex?: number,
): IFunctionalHoroscope {
    const birthday = birthdayOf(astrolabe);
    const date = lunarOf(targetDate);
    const targetTimeIndex = timeIndex ?? timeToIndex(targetDate.getHours());
    const adjustedTargetTimeIndex = rules.dayDivide === 'current' && targetTimeIndex >= 12 ? 0 : targetTimeIndex;
    const { yearly, monthly, daily, hourly } = ganzhiOf(targetDate, adjustedTargetTimeIndex, rules.horoscopeDivide, rules.horoscopeDivide);

    let nominalAge = date.lunarYear - birthday.lunarYear;
    if (getConfig().ageDivide === 'birthday') {
        if (date.lunarMonth > birthday.lunarMonth
            || (date.lunarMonth === birthday.lunarMonth && date.lunarDay > birthday.lunarDay)) {
            nominalAge += 1;
        }
    } else {
        nominalAge += 1;
    }

    let isChildhood = false;
    let decadalIndex = -1;
    let heavenlyStemOfDecade = 'jia';
    let earthlyBranchOfDecade = 'zi';
    let ageIndex = -1;
    let heavenlyStemOfAge = 'jia';
    let earthlyBranchOfAge = 'zi';
    const yearlyIndex = fixEarthlyBranchIndex(yearly[1] as never);

    astrolabe.palaces.some(({ decadal }, index) => {
        if (nominalAge >= decadal.range[0] && nominalAge <= decadal.range[1]) {
            decadalIndex = index;
            heavenlyStemOfDecade = decadal.heavenlyStem;
            earthlyBranchOfDecade = decadal.earthlyBranch;
            return true;
        }
        return false;
    });

    if (decadalIndex < 0) {
        // 未起运时取童限：一命二财三疾厄，四岁夫妻五福德，六岁事业为童限
        const targetPalace = astrolabe.palace(CHILDHOOD_PALACES[nominalAge - 1] as never);
        if (targetPalace) {
            isChildhood = true;
            decadalIndex = targetPalace.index;
            heavenlyStemOfDecade = targetPalace.heavenlyStem;
            earthlyBranchOfDecade = targetPalace.earthlyBranch;
        }
    }

    astrolabe.palaces.some(({ ages, heavenlyStem, earthlyBranch }, index) => {
        if (ages.includes(nominalAge)) {
            ageIndex = index;
            heavenlyStemOfAge = heavenlyStem;
            earthlyBranchOfAge = earthlyBranch;
            return true;
        }
        return false;
    });

    // 流月：流年地支逆数到生月，再顺数到生时为正月；闰月后半月按下月算
    const leapAddition = birthday.isLeap && birthday.lunarDay > 15 ? 1 : 0;
    const dateLeapAddition = date.isLeap && date.lunarDay > 15 ? 1 : 0;
    const monthlyIndex = fixIndex(
        yearlyIndex
        - (birthday.lunarMonth + leapAddition)
        + EARTHLY_BRANCHES.indexOf(kot(astrolabe.rawDates.chineseDate.hourly[1]) as never)
        + (date.lunarMonth + dateLeapAddition),
    );
    const dailyIndex = fixIndex(monthlyIndex + date.lunarDay - 1);
    const hourlyIndex = fixIndex(dailyIndex + EARTHLY_BRANCHES.indexOf(kot(hourly[1], 'Earthly') as never));

    const scope = {
        solarDate: normalizeDateStr(targetDate).slice(0, 3).join('-'),
        lunarDate: date.toString(true),
        decadal: {
            index: decadalIndex,
            name: isChildhood ? t('childhood') : t('decadal'),
            heavenlyStem: t(kot(heavenlyStemOfDecade, 'Heavnly')),
            earthlyBranch: t(kot(earthlyBranchOfDecade, 'Earthly')),
            palaceNames: palaceNamesFrom(decadalIndex),
            mutagen: mutagensOf(heavenlyStemOfDecade),
            stars: getCachedHoroscopeStar(heavenlyStemOfDecade, earthlyBranchOfDecade, 'decadal'),
        },
        age: {
            index: ageIndex,
            nominalAge,
            name: t('turn'),
            heavenlyStem: heavenlyStemOfAge,
            earthlyBranch: earthlyBranchOfAge,
            palaceNames: palaceNamesFrom(ageIndex),
            mutagen: mutagensOf(heavenlyStemOfAge),
        },
        yearly: {
            index: yearlyIndex,
            name: t('yearly'),
            heavenlyStem: t(kot(yearly[0], 'Heavenly')),
            earthlyBranch: t(kot(yearly[1], 'Earthly')),
            palaceNames: palaceNamesFrom(yearlyIndex),
            mutagen: mutagensOf(yearly[0]),
            stars: getCachedHoroscopeStar(yearly[0], yearly[1], 'yearly'),
            yearlyDecStar: yearly12Of(targetDate, rules.horoscopeDivide),
        },
        monthly: {
            index: monthlyIndex,
            name: t('monthly'),
            heavenlyStem: t(kot(monthly[0], 'Heavenly')),
            earthlyBranch: t(kot(monthly[1], 'Earthly')),
            palaceNames: palaceNamesFrom(monthlyIndex),
            mutagen: mutagensOf(monthly[0]),
            stars: getCachedHoroscopeStar(monthly[0], monthly[1], 'monthly'),
        },
        daily: {
            index: dailyIndex,
            name: t('daily'),
            heavenlyStem: t(kot(daily[0], 'Heavenly')),
            earthlyBranch: t(kot(daily[1], 'Earthly')),
            palaceNames: palaceNamesFrom(dailyIndex),
            mutagen: mutagensOf(daily[0]),
            stars: getCachedHoroscopeStar(daily[0], daily[1], 'daily'),
        },
        hourly: {
            index: hourlyIndex,
            name: t('hourly'),
            heavenlyStem: t(kot(hourly[0], 'Heavenly')),
            earthlyBranch: t(kot(hourly[1], 'Earthly')),
            palaceNames: palaceNamesFrom(hourlyIndex),
            mutagen: mutagensOf(hourly[0]),
            stars: getCachedHoroscopeStar(hourly[0], hourly[1], 'hourly'),
        },
    };

    return new FunctionalHoroscope(scope as never, astrolabe) as unknown as IFunctionalHoroscope;
}
