import { SolarTime } from 'tyme4ts';
import { BaziRenYuanDutyDetail } from './bazi-types';

type WuXingName = '水' | '木' | '金' | '土' | '火';
type EarthBranchName = '寅' | '卯' | '辰' | '巳' | '午' | '未' | '申' | '酉' | '戌' | '亥' | '子' | '丑';
type MonthStartTermName = '立春' | '惊蛰' | '清明' | '立夏' | '芒种' | '小暑' | '立秋' | '白露' | '寒露' | '立冬' | '大雪' | '小寒';
type WuXingBandStatus = '旺' | '相' | '休' | '囚' | '死' | '—';

interface DutySegmentRule {
    stem: string;
    days: number;
}

interface MonthStartContext {
    monthBranch: EarthBranchName;
    monthStartDate: Date;
}

export interface WuXingBandItem {
    element: WuXingName;
    status: WuXingBandStatus;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTH_START_TERM_TO_BRANCH: Record<MonthStartTermName, EarthBranchName> = {
    立春: '寅',
    惊蛰: '卯',
    清明: '辰',
    立夏: '巳',
    芒种: '午',
    小暑: '未',
    立秋: '申',
    白露: '酉',
    寒露: '戌',
    立冬: '亥',
    大雪: '子',
    小寒: '丑',
};
const MONTH_BRANCH_RULES: Record<EarthBranchName, DutySegmentRule[]> = {
    寅: [{ stem: '戊', days: 7 }, { stem: '丙', days: 7 }, { stem: '甲', days: 16 }],
    卯: [{ stem: '甲', days: 10 }, { stem: '乙', days: 20 }],
    辰: [{ stem: '乙', days: 9 }, { stem: '癸', days: 3 }, { stem: '戊', days: 18 }],
    巳: [{ stem: '戊', days: 5 }, { stem: '庚', days: 9 }, { stem: '丙', days: 16 }],
    午: [{ stem: '丙', days: 10 }, { stem: '己', days: 9 }, { stem: '丁', days: 11 }],
    未: [{ stem: '丁', days: 9 }, { stem: '乙', days: 3 }, { stem: '己', days: 18 }],
    申: [{ stem: '戊己', days: 10 }, { stem: '壬', days: 3 }, { stem: '庚', days: 17 }],
    酉: [{ stem: '庚', days: 10 }, { stem: '辛', days: 20 }],
    戌: [{ stem: '辛', days: 9 }, { stem: '丁', days: 3 }, { stem: '戊', days: 18 }],
    亥: [{ stem: '戊', days: 7 }, { stem: '甲', days: 5 }, { stem: '壬', days: 18 }],
    子: [{ stem: '壬', days: 10 }, { stem: '癸', days: 20 }],
    丑: [{ stem: '癸', days: 9 }, { stem: '辛', days: 3 }, { stem: '己', days: 18 }],
};
const BRANCH_TO_ELEMENT: Record<EarthBranchName, WuXingName> = {
    寅: '木',
    卯: '木',
    辰: '土',
    巳: '火',
    午: '火',
    未: '土',
    申: '金',
    酉: '金',
    戌: '土',
    亥: '水',
    子: '水',
    丑: '土',
};
const STEM_TO_ELEMENT: Record<string, WuXingName> = {
    甲: '木',
    乙: '木',
    丙: '火',
    丁: '火',
    戊: '土',
    己: '土',
    庚: '金',
    辛: '金',
    壬: '水',
    癸: '水',
};
const GENERATES: Record<WuXingName, WuXingName> = {
    木: '火',
    火: '土',
    土: '金',
    金: '水',
    水: '木',
};
const CONTROLS: Record<WuXingName, WuXingName> = {
    木: '土',
    土: '水',
    水: '火',
    火: '金',
    金: '木',
};
const WU_XING_ORDER: WuXingName[] = ['水', '木', '金', '土', '火'];

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

function startOfLocalDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function isMonthStartTerm(name: string): name is MonthStartTermName {
    return Object.prototype.hasOwnProperty.call(MONTH_START_TERM_TO_BRANCH, name);
}

function resolveMonthStartContext(date: Date): MonthStartContext {
    let term = toTymeSolarTime(date).getSolarDay().getTerm();

    for (let i = 0; i < 2 && !isMonthStartTerm(term.getName()); i += 1) {
        term = term.next(-1);
    }

    const termName = term.getName();
    if (!isMonthStartTerm(termName)) {
        throw new Error(`无法解析月令起节: ${termName}`);
    }

    return {
        monthBranch: MONTH_START_TERM_TO_BRANCH[termName],
        monthStartDate: solarTimeToDate(term.getJulianDay().getSolarTime()),
    };
}

function getCalendarDayIndex(from: Date, to: Date): number {
    const diff = startOfLocalDay(to).getTime() - startOfLocalDay(from).getTime();
    return Math.max(Math.floor(diff / DAY_MS) + 1, 1);
}

function resolveStemElement(stem: string): WuXingName {
    const firstStem = stem.charAt(0);
    const element = STEM_TO_ELEMENT[firstStem];
    if (!element) {
        throw new Error(`无法解析司令天干五行: ${stem}`);
    }
    return element;
}

function pickDutySegment(monthBranch: EarthBranchName, dayIndex: number): DutySegmentRule {
    const rules = MONTH_BRANCH_RULES[monthBranch];
    let remaining = dayIndex;

    for (const rule of rules) {
        if (remaining <= rule.days) {
            return rule;
        }
        remaining -= rule.days;
    }

    return rules[rules.length - 1];
}

function getGeneratingParent(element: WuXingName): WuXingName {
    const match = WU_XING_ORDER.find((candidate) => GENERATES[candidate] === element);
    if (!match) {
        throw new Error(`无法解析相生父元素: ${element}`);
    }
    return match;
}

function getController(element: WuXingName): WuXingName {
    const match = WU_XING_ORDER.find((candidate) => CONTROLS[candidate] === element);
    if (!match) {
        throw new Error(`无法解析相克控制元素: ${element}`);
    }
    return match;
}

export function createEmptyRenYuanDutyDetail(): BaziRenYuanDutyDetail {
    return {
        stem: '',
        element: '',
        dayIndex: 1,
        monthBranch: '',
        ruleKey: 'ziping_zhenquan_v1',
        display: '',
    };
}

export function calculateRenYuanDuty(date: Date): BaziRenYuanDutyDetail {
    if (Number.isNaN(date.getTime())) {
        return createEmptyRenYuanDutyDetail();
    }

    const monthStartContext = resolveMonthStartContext(date);
    const dayIndex = getCalendarDayIndex(monthStartContext.monthStartDate, date);
    const dutyRule = pickDutySegment(monthStartContext.monthBranch, dayIndex);
    const element = resolveStemElement(dutyRule.stem);

    return {
        stem: dutyRule.stem,
        element,
        dayIndex,
        monthBranch: monthStartContext.monthBranch,
        ruleKey: 'ziping_zhenquan_v1',
        display: `${dutyRule.stem}${element}第${dayIndex}天用事`,
    };
}

export function buildWuXingBandFromMonthBranch(monthBranch: string): WuXingBandItem[] {
    const monthElement = BRANCH_TO_ELEMENT[monthBranch as EarthBranchName];
    if (!monthElement) {
        return WU_XING_ORDER.map((element) => ({
            element,
            status: '—',
        }));
    }

    const statusByElement: Record<WuXingName, WuXingBandStatus> = {
        水: '—',
        木: '—',
        金: '—',
        土: '—',
        火: '—',
    };

    statusByElement[monthElement] = '旺';
    statusByElement[GENERATES[monthElement]] = '相';
    statusByElement[getGeneratingParent(monthElement)] = '休';
    statusByElement[getController(monthElement)] = '囚';
    statusByElement[CONTROLS[monthElement]] = '死';

    return WU_XING_ORDER.map((element) => ({
        element,
        status: statusByElement[element],
    }));
}
