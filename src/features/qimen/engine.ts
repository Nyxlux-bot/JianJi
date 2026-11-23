import { SixtyCycle, SolarDay, SolarTerm, SolarTime } from 'tyme4ts';
import { isLiuyaoSubject } from '../../core/liuyao-data';
import { QIMEN_PALACES, QIMEN_RING, QIMEN_SPIRITS, QIMEN_STEMS } from './data';
import type { QimenBoard, QimenCastInput, QimenDun, QimenJuMethod, QimenPalace, QimenResult } from './types';
import { QIMEN_BOARD_VERSIONS, QIMEN_YEAR_RANGE, QIMEN_FORMS, QIMEN_JU_METHODS, QIMEN_SPIRIT_STYLES } from './types';

// 从冬至起，按二十四节气依次取上、中、下元局数。
export const JU_TABLE = [174, 285, 396, 852, 963, 174, 396, 417, 528, 417, 528, 639, 936, 825, 714, 258, 147, 936, 714, 693, 582, 693, 582, 471];
const VOID_BRANCHES = ['戌亥', '申酉', '午未', '辰巳', '寅卯', '子丑'];
const HORSE_BRANCHES = ['寅', '亥', '申', '巳'];

export function mod(value: number, base: number): number {
    return ((value % base) + base) % base;
}

function host(number: number): number {
    return number === 5 ? 2 : number;
}

function formatSolarTime(solar: SolarTime): string {
    return `${solar.getYear()}-${String(solar.getMonth()).padStart(2, '0')}-${String(solar.getDay()).padStart(2, '0')}T${solar.getName()}`;
}

/** 根据六十甲子序号计算旬空地支、驿马地支与驿马落宫。 */
export function computeVoidAndHorse(pillarIndex: number) {
    const xunIndex = Math.floor(pillarIndex / 10);
    const voidBranches = Array.from(VOID_BRANCHES[xunIndex]);
    const horseBranch = HORSE_BRANCHES[pillarIndex % 4];
    const horsePalace = QIMEN_PALACES.find(palace => palace.branches.includes(horseBranch))!.number;
    return { xunIndex, voidBranches, horseBranch, horsePalace };
}

/** 置闰法：以甲己上元符头十五日一节推进，芒种或大雪超神满九日则置闰重复三元。 */
export function resolveZhiRun(targetDay: SolarDay): { termIndex: number; termName: string; isLeap: boolean; yuanIndex: number; dun: QimenDun; ju: number } {
    const startYear = Math.max(1895, targetDay.getYear() - 5);
    const ws = SolarTerm.fromIndex(startYear, 0).getJulianDay().getSolarDay();
    const idx = ws.getSixtyCycleDay().getSixtyCycle().getIndex() % 15;
    let fu = ws.next(idx <= 7 ? -idx : 15 - idx);
    let termYear = startYear;
    let termIndex = 0;
    let isLeap = false;
    for (let guard = 0; guard < 300; guard++) {
        const nextFu = fu.next(15);
        if (!targetDay.isBefore(fu) && targetDay.isBefore(nextFu)) {
            const elapsed = targetDay.subtract(fu);
            const yuanIndex = Math.min(2, Math.floor(elapsed / 5));
            const ju = Number(String(JU_TABLE[termIndex])[yuanIndex]);
            return { termIndex, termName: SolarTerm.NAMES[termIndex], isLeap, yuanIndex, dun: termIndex < 12 ? 'yang' : 'yin', ju };
        }
        const nextIndex = (termIndex + 1) % 24;
        const nextYear = termIndex === 23 ? termYear + 1 : termYear;
        const nextTermDay = SolarTerm.fromIndex(nextYear, nextIndex).getJulianDay().getSolarDay();
        const nextExceed = nextTermDay.subtract(nextFu);
        fu = nextFu;
        if (!isLeap && (termIndex === 11 || termIndex === 23) && nextExceed >= 9) {
            isLeap = true;
        } else {
            isLeap = false;
            termIndex = nextIndex;
            termYear = nextYear;
        }
    }
    throw new Error('置闰法推算超出范围');
}

/** 转盘时家定局（拆补 / 置闰 / 茅山）。 */
export function resolveTurnHourJu(solar: SolarTime, dayIndex: number, juMethod: QimenJuMethod): { dun: QimenDun; ju: number; yuanIndex: number; termLabel: string } {
    const term = solar.getTerm();
    if (juMethod === 'maoshan') {
        const elapsedSeconds = solar.subtract(term.getJulianDay().getSolarTime());
        const yuanIndex = Math.min(2, Math.max(0, Math.floor(elapsedSeconds / (5 * 86400))));
        const ju = Number(String(JU_TABLE[term.getIndex()])[yuanIndex]);
        return { dun: term.getIndex() < 12 ? 'yang' : 'yin', ju, yuanIndex, termLabel: term.getName() };
    }
    if (juMethod === 'zhirun') {
        // 子初换日：23:00 起进入次日符头日
        const targetDay = solar.getSolarDay().next(solar.getHour() >= 23 ? 1 : 0);
        const zr = resolveZhiRun(targetDay);
        return { dun: zr.dun, ju: zr.ju, yuanIndex: zr.yuanIndex, termLabel: (zr.isLeap ? '闰' : '') + zr.termName };
    }
    const yuanIndex = Math.floor(dayIndex / 5) % 3;
    const ju = Number(String(JU_TABLE[term.getIndex()])[yuanIndex]);
    return { dun: term.getIndex() < 12 ? 'yang' : 'yin', ju, yuanIndex, termLabel: term.getName() };
}

/** 转盘暗干（隐干）：本柱天干入值使宫阳顺阴逆飞布九宫；若与值使宫地盘干同则入中五宫起飞。 */
export function getQimenDarkStems(board: QimenBoard, periodStem: string): string[] {
    const stem = periodStem === '甲' ? board.hiddenStem : periodStem;
    const stemIdx = QIMEN_STEMS.indexOf(stem);
    if (stemIdx < 0) return Array<string>(9).fill('');
    const direction = board.dun === 'yang' ? 1 : -1;
    const gateCell = board.palaces[board.chiefGatePalace - 1];
    const startPalace = gateCell.earthStem === stem ? 5 : board.chiefGatePalace;
    const dark = Array<string>(9);
    for (let i = 0; i < 9; i++) {
        dark[mod(startPalace - 1 + direction * i, 9)] = QIMEN_STEMS[mod(stemIdx + i, 9)];
    }
    return dark;
}

export function getQimenPositions(dun: QimenDun, ju: number, pillarIndex: number) {
    if ((dun !== 'yang' && dun !== 'yin') || !Number.isInteger(ju) || ju < 1 || ju > 9
        || !Number.isInteger(pillarIndex) || pillarIndex < 0 || pillarIndex > 59) {
        throw new Error('奇门局数、阴阳遁或干支无效');
    }
    const direction = dun === 'yang' ? 1 : -1;
    const earth = Array<string>(9);
    Array.from(QIMEN_STEMS).forEach((stem, index) => {
        earth[mod(ju - 1 + direction * index, 9)] = stem;
    });
    const xunIndex = Math.floor(pillarIndex / 10);
    const hiddenStem = QIMEN_STEMS[xunIndex];
    const chiefOrigin = earth.indexOf(hiddenStem) + 1;
    const pillarStem = SixtyCycle.fromIndex(pillarIndex).getHeavenStem().getName();
    const stemPalace = earth.indexOf(pillarStem === '甲' ? hiddenStem : pillarStem) + 1;
    const chiefGateRawPalace = mod(chiefOrigin - 1 + direction * (pillarIndex % 10), 9) + 1;
    return { direction, earth, xunIndex, hiddenStem, chiefOrigin, stemPalace, chiefGateRawPalace };
}

/** 星门沿外环旋转，值使先从原宫飞九宫。 */
export function buildQimenBoard(dun: QimenDun, ju: number, pillarIndex: number): QimenBoard {
    const { direction, earth, xunIndex, hiddenStem, chiefOrigin, stemPalace, chiefGateRawPalace } = getQimenPositions(dun, ju, pillarIndex);
    const chiefStarPalace = host(stemPalace);
    const chiefGatePalace = host(chiefGateRawPalace);
    const chiefRingIndex = QIMEN_RING.indexOf(host(chiefOrigin));
    const starRotation = QIMEN_RING.indexOf(chiefStarPalace) - chiefRingIndex;
    const gateRotation = QIMEN_RING.indexOf(chiefGatePalace) - chiefRingIndex;
    const { voidBranches, horseBranch, horsePalace } = computeVoidAndHorse(pillarIndex);
    const palaces: QimenPalace[] = QIMEN_PALACES.map(info => {
        const ringIndex = QIMEN_RING.indexOf(info.number);
        const starOrigin = info.number === 5 ? null : QIMEN_RING[mod(ringIndex - starRotation, 8)];
        const gateOrigin = info.number === 5 ? null : QIMEN_RING[mod(ringIndex - gateRotation, 8)];
        return {
            number: info.number,
            earthStem: earth[info.number - 1],
            hostedEarthStem: info.number === 2 ? earth[4] : null,
            heavenStem: starOrigin === null ? null : earth[starOrigin - 1],
            hostedHeavenStem: starOrigin === 2 ? earth[4] : null,
            star: starOrigin === null ? null : QIMEN_PALACES[starOrigin - 1].star,
            gate: gateOrigin === null ? null : QIMEN_PALACES[gateOrigin - 1].gate,
            spirit: info.number === 5 ? null : QIMEN_SPIRITS[mod(direction * (ringIndex - QIMEN_RING.indexOf(chiefStarPalace)), 8)],
            voidBranches: voidBranches.filter(branch => info.branches.includes(branch)),
            isHorse: info.number === horsePalace,
        };
    });
    return {
        dun, ju, xunHead: SixtyCycle.fromIndex(xunIndex * 10).getName(), hiddenStem, voidBranches,
        horseBranch, horsePalace, chiefOrigin, chiefStarPalace, chiefGatePalace, chiefGateRawPalace,
        chiefStar: QIMEN_PALACES[chiefOrigin - 1].star,
        chiefGate: QIMEN_PALACES[host(chiefOrigin) - 1].gate!,
        palaces,
    };
}

export function castQimen(input: QimenCastInput): QimenResult {
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(input.dateTime);
    if (!match || Number(match[1]) < QIMEN_YEAR_RANGE.min || Number(match[1]) > QIMEN_YEAR_RANGE.max) throw new Error('请选择 1900–2100 年内的有效起盘时间');
    if ((input.form !== undefined && !QIMEN_FORMS.includes(input.form))
        || (input.juMethod !== undefined && !QIMEN_JU_METHODS.includes(input.juMethod))
        || (input.spiritStyle !== undefined && !QIMEN_SPIRIT_STYLES.includes(input.spiritStyle))
        || (input.numberSeed !== undefined && (!Number.isInteger(input.numberSeed) || input.numberSeed < 1 || input.numberSeed > 9999))
        || typeof input.question !== 'string' || input.question.length > 300
        || typeof input.location !== 'string' || input.location.length > 100
        || (input.longitude !== undefined && (!Number.isFinite(input.longitude) || Math.abs(input.longitude) > 180))
        || (input.subject !== undefined && !isLiuyaoSubject(input.subject))
        || (input.recentEvents !== undefined && (typeof input.recentEvents !== 'string' || input.recentEvents.length > 600))
        || (input.timeRange !== undefined && (typeof input.timeRange !== 'string' || input.timeRange.length > 80))) {
        throw new Error('起盘资料无效，请检查时间、地点和占问内容');
    }
    const solar = SolarTime.fromYmdHms(Number(match[1]), Number(match[2]), Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6] || 0));
    // 直接取干支时，不读可被其他模块切换的 LunarHour.provider。
    const hour = solar.getSixtyCycleHour();
    const term = solar.getTerm();
    const nextTerm = term.next(1);
    const dayIndex = hour.getDay().getIndex();
    const juMethod: QimenJuMethod = input.juMethod ?? 'chaibu';
    const resolved = resolveTurnHourJu(solar, dayIndex, juMethod);
    const dun = resolved.dun;
    const ju = input.numberSeed !== undefined ? ((input.numberSeed - 1) % 9) + 1 : resolved.ju;
    const yuanNames: QimenResult['yuan'][] = ['上元', '中元', '下元'];
    return {
        kind: 'qimen', id: Date.now().toString(36) + Math.random().toString(36).slice(2, 11), createdAt: new Date().toISOString(),
        form: input.form ?? '转盘',
        ...(juMethod !== 'chaibu' ? { juMethod } : {}),
        ...(input.spiritStyle && input.spiritStyle !== 'gouchen' ? { spiritStyle: input.spiritStyle } : {}),
        ...(input.numberSeed !== undefined ? { numberSeed: input.numberSeed } : {}),
        boardVersion: QIMEN_BOARD_VERSIONS[input.form ?? '转盘'],
        method: 'qimen_hour', ruleVersion: 'qimen-chaibu-1', timeBasis: 'clock', timezoneOffsetMinutes: -480,
        dayBoundary: 'zi_start', centerRule: 'kun', inputDateTime: formatSolarTime(solar),
        solarDate: formatSolarTime(solar).slice(0, 10), solarTime: solar.getName(),
        location: input.location.trim(), longitude: input.longitude, question: input.question.trim(),
        subject: input.subject, recentEvents: input.recentEvents?.trim(), timeRange: input.timeRange?.trim(),
        lunarDate: solar.getSolarDay().getLunarDay().toString(),
        fourPillars: [hour.getYear().getName(), hour.getMonth().getName(), hour.getDay().getName(), hour.getSixtyCycle().getName()],
        solarTerm: { name: term.getName(), at: formatSolarTime(term.getJulianDay().getSolarTime()).replace('T', ' '), nextName: nextTerm.getName(), nextAt: formatSolarTime(nextTerm.getJulianDay().getSolarTime()).replace('T', ' ') },
        yuan: yuanNames[resolved.yuanIndex], fuTou: SixtyCycle.fromIndex(Math.floor(dayIndex / 5) * 5).getName(),
        ...buildQimenBoard(dun, ju, hour.getSixtyCycle().getIndex()),
    };
}

/** 按指定小时数平移起盘时间并生成临时预览盘（不修改原记录）。 */
export function shiftQimenResultByHours(result: QimenResult, deltaHours: number): QimenResult | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(result.inputDateTime);
    if (!match) return null;
    const base = SolarTime.fromYmdHms(Number(match[1]), Number(match[2]), Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6] || 0));
    const shifted = base.next(deltaHours * 3600);
    if (shifted.getYear() < QIMEN_YEAR_RANGE.min || shifted.getYear() > QIMEN_YEAR_RANGE.max) return null;
    const preview = castQimen({
        form: result.form,
        juMethod: result.juMethod,
        spiritStyle: result.spiritStyle,
        // 报数盘步进时辰后仍按原数定局
        numberSeed: result.numberSeed,
        dateTime: formatSolarTime(shifted),
        location: result.location,
        longitude: result.longitude,
        question: result.question,
        subject: result.subject,
        recentEvents: result.recentEvents,
        timeRange: result.timeRange,
    });
    return { ...preview, id: result.id, createdAt: result.createdAt };
}
