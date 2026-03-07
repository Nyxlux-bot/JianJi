import { HeavenStem, SixtyCycleYear, SolarTime } from 'tyme4ts';

export interface BaziJiaoYunRuleDetail {
    anchorJieName: string;
    anchorJieDateTime: string;
    anchorJieDateTimeIso: string;
    offsetDaysAfterJie: number;
    yearStemPair: [string, string];
    displayText: string;
}

type MonthStartJieName =
    | '立春'
    | '惊蛰'
    | '清明'
    | '立夏'
    | '芒种'
    | '小暑'
    | '立秋'
    | '白露'
    | '寒露'
    | '立冬'
    | '大雪'
    | '小寒';

function pad2(value: number): string {
    return String(value).padStart(2, '0');
}

function formatDisplayDateTime(date: Date): string {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function toTymeSolarTime(date: Date): SolarTime {
    return SolarTime.fromYmdHms(
        date.getFullYear(),
        date.getMonth() + 1,
        date.getDate(),
        date.getHours(),
        date.getMinutes(),
        date.getSeconds(),
    );
}

function solarTimeToDate(solarTime: SolarTime): Date {
    return new Date(
        solarTime.getYear(),
        solarTime.getMonth() - 1,
        solarTime.getDay(),
        solarTime.getHour(),
        solarTime.getMinute(),
        solarTime.getSecond(),
        0,
    );
}

function isMonthStartJie(name: string): name is MonthStartJieName {
    return [
        '立春', '惊蛰', '清明', '立夏', '芒种', '小暑',
        '立秋', '白露', '寒露', '立冬', '大雪', '小寒',
    ].includes(name);
}

function resolveAnchorJie(endDate: Date): { name: MonthStartJieName; date: Date } {
    let term = toTymeSolarTime(endDate).getSolarDay().getTerm();

    while (!term.isJie()) {
        term = term.next(-1);
    }

    const name = term.getName();
    if (!isMonthStartJie(name)) {
        throw new Error(`无法解析交运锚定节令: ${name}`);
    }

    return {
        name,
        date: solarTimeToDate(term.getJulianDay().getSolarTime()),
    };
}

function resolveYearStemPair(startYear: number): [string, string] {
    const firstStem = SixtyCycleYear.fromYear(startYear).getSixtyCycle().getHeavenStem().getName();
    const secondStem = HeavenStem.fromName(firstStem).next(5).getName();
    return [firstStem, secondStem];
}

export function buildJiaoYunRuleDetail(endDate: Date, startYear: number): BaziJiaoYunRuleDetail {
    const anchor = resolveAnchorJie(endDate);
    const diffMs = Math.max(endDate.getTime() - anchor.date.getTime(), 0);
    const offsetDaysAfterJie = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    const yearStemPair = resolveYearStemPair(startYear);

    return {
        anchorJieName: anchor.name,
        anchorJieDateTime: formatDisplayDateTime(anchor.date),
        anchorJieDateTimeIso: anchor.date.toISOString(),
        offsetDaysAfterJie,
        yearStemPair,
        displayText: `逢${yearStemPair[0]}、${yearStemPair[1]}年${anchor.name}后${offsetDaysAfterJie}天交大运`,
    };
}

export function createEmptyJiaoYunRuleDetail(): BaziJiaoYunRuleDetail {
    return {
        anchorJieName: '',
        anchorJieDateTime: '',
        anchorJieDateTimeIso: '',
        offsetDaysAfterJie: 0,
        yearStemPair: ['', ''],
        displayText: '',
    };
}
