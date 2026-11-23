import { SixtyCycle, SolarDay, SolarTerm, SolarTime } from 'tyme4ts';
import { QIMEN_PALACES, QIMEN_RING } from './data';
import { computeVoidAndHorse, getQimenPositions, JU_TABLE, mod } from './engine';
import { isWuBuYuShi } from './patterns';
import { QIMEN_PERIODS, type QimenDun, type QimenPalace, type QimenPeriod, type QimenResult } from './types';
import type { PeriodBoard } from './period-board';

const NUMBERS = '一二三四五六七八九';
const MONTH_JU = ['174285396174', '285396174285', '396174285396'];
const SEATED_GODS = ['值符', '腾蛇', '太阴', '六合', '勾陈', '朱雀', '九地', '九天'];
const FLYING_GODS = ['值符', '腾蛇', '太阴', '六合', '勾陈', '太常', '朱雀', '九地', '九天'];

function solarDay(result: QimenResult): SolarDay {
    const [year, month, day] = result.solarDate.split('-').map(Number);
    return SolarDay.fromYmd(year, month, day);
}

/** 坐山沿用输入的北京时间，以当地历日交节、午夜换日。与其他盘的子初换日分开。 */
export function getQimenPillars(result: QimenResult): QimenResult['fourPillars'] {
    if (result.form !== '星飞门转') return result.fourPillars;
    const day = solarDay(result).getSixtyCycleDay();
    // 日盘到午夜才换日，时柱在晚子时已进入下一日的五鼠遁。
    return [day.getYear().getName(), day.getMonth().getName(), day.getSixtyCycle().getName(), result.fourPillars[3]];
}

function anchor(term: SolarTerm, interval: number): SolarDay {
    const day = term.getJulianDay().getSolarDay();
    const offset = day.getSixtyCycleDay().getSixtyCycle().getIndex() % interval;
    return day.next(offset <= interval / 2 ? -offset : interval - offset);
}

function seatedJu(result: QimenResult, day: SolarDay, year: number, period: QimenPeriod) {
    const since = year - 1864;
    if (period === '年盘') return { ju: mod(Math.floor(since / 20), 9) + 1, method: '三元年遁 · 二十年一局',
        basis: '1864 年立春起上元甲子阳一。每二十年进一局，三元一百八十年。' };
    if (period === '月盘') return { ju: Number(MONTH_JU[mod(Math.floor(since / 60), 3)][Math.floor(mod(since, 60) / 5)]),
        method: '甲己换局 · 五年一局', basis: '1864 年立春丙寅节月起阳一，每甲、己年立春换五年段，按上中下元月局表取局。' };
    const term = day.getTerm();
    if (period === '时盘') {
        // 以冬至为年度锚。阴阳各十二气、每气三段；两冬锚间多出的十五日置于大雪末。
        let winter = term.next(-term.getIndex());
        if (day.isBefore(anchor(winter, 15))) winter = winter.next(-24);
        else if (!day.isBefore(anchor(winter.next(24), 15))) winter = winter.next(24);
        const elapsed = day.subtract(anchor(winter, 15));
        const solarBlock = Math.min(Math.floor(elapsed / 15), 23);
        const naturalJu = Number(String(JU_TABLE[solarBlock])[Math.floor(elapsed / 5) % 3]);
        const ju = result.numberSeed !== undefined ? ((result.numberSeed - 1) % 9) + 1 : naturalJu;
        return {
            ju: solarBlock < 12 ? ju : -ju,
            method: result.numberSeed !== undefined ? `报数起局 · 数 ${result.numberSeed}` : '符头定局 · 六十时辰一局',
            basis: result.numberSeed !== undefined
                ? `以所报之数 ${result.numberSeed} 取余定为第 ${ju} 局，阴阳遁与四柱仍依当前时刻。`
                : '取冬至附近上元符头起阳一，依二十四气的三元表每五日换局。满一百八十日转阴；闰大雪重复最后十五日。',
        };
    }
    let solstice = term.next(12 - term.getIndex() % 12);
    while (day.isBefore(anchor(solstice, 60))) solstice = solstice.next(-12);
    const start = anchor(solstice, 60);
    const elapsed = day.subtract(start);
    const span = anchor(solstice.next(12), 60).subtract(start);
    const latterLeap = span === 240 && elapsed >= 210;
    const yang = (solstice.getIndex() === 0) !== latterLeap;
    const step = Math.floor((latterLeap ? elapsed - span : elapsed) / 20);
    return { ju: yang ? mod(step, 9) + 1 : -(9 - mod(step, 9)), method: '近二至甲子 · 二十日一局',
        basis: '冬至最近甲子起阳一，夏至最近甲子起阴九，二十日一局。两锚相隔二百四十日，末六十日各三十日接前后遁。' };
}

function mingJu(result: QimenResult, day: SolarDay, year: number, period: QimenPeriod) {
    if (period === '时盘') {
        if (result.numberSeed !== undefined) {
            return {
                ju: result.dun === 'yang' ? result.ju : -result.ju,
                method: `报数起局 · 数 ${result.numberSeed}`,
                basis: `以所报之数 ${result.numberSeed} 取余定为第 ${result.ju} 局，阴阳遁与四柱仍依当前时刻。`,
            };
        }
        return { ju: result.dun === 'yang' ? result.ju : -result.ju, method: '交节拆补 · 甲己符头',
            basis: '按实际交节时刻及日干支定三元，甲己符头五日一换。' };
    }
    let phase: number, method: string, basis: string;
    if (period === '年盘') {
        phase = 22 * 3 + 2 + Math.floor((year - 1864) / 60);
        method = '依运取局 · 六十年一局';
        basis = '依〈入门〉注文推算。以同治十年辛未所在甲子段为小雪下元，每逢甲子年进一元。';
    } else if (period === '月盘') {
        const month = '寅卯辰巳午未申酉戌亥子丑'.indexOf(result.fourPillars[1][1]);
        // 同治辛未年十一月为庚子（月序36），属于谷雨中元；每过甲子月进一元。
        phase = 8 * 3 + 1 + Math.floor(((year - 1871) * 12 + month - 10 + 36) / 60);
        method = '半世三局 · 六十月一局';
        basis = '依〈入门〉同治辛未年庚子月的谷雨中元局例顺推，每六十个节月进一元。';
    } else {
        const [h, m, s] = result.solarTime.split(':').map(Number);
        const term = SolarTime.fromYmdHms(day.getYear(), day.getMonth(), day.getDay(), h, m, s).getTerm();
        // tyme 的节气年自前一公历年的冬至起，跨立春仍属同一组六段。
        phase = mod(term.getYear() - 4, 12) * 6 + Math.floor(term.getIndex() / 4);
        method = '年支分遁 · 六段换元';
        basis = '依〈入门〉注文推算。每年配两气，从年前冬至起，依冬至、雨水、谷雨、夏至、处暑、霜降分六段。';
    }
    const step = mod(phase, 72);
    const idx = Math.floor(step / 3);
    const ju = Number(String(JU_TABLE[idx])[step % 3]);
    return { ju: idx < 12 ? ju : -ju, method, basis: basis + ' 本盘取' + SolarTerm.NAMES[idx] + ['上元','中元','下元'][step % 3] + '。' };
}

export function getFlyingBoard(result: QimenResult, period: QimenPeriod): PeriodBoard {
    const seated = result.form === '星飞门转';
    const day = solarDay(result);
    const pillars = getQimenPillars(result);
    const cycle = SixtyCycle.fromName(pillars[QIMEN_PERIODS.indexOf(period)]);
    const civilYear = day.getYear();
    const year = SixtyCycle.fromIndex(civilYear - 4).getName() === pillars[0] ? civilYear : civilYear - 1;
    const rule = seated ? seatedJu(result, day, year, period) : mingJu(result, day, year, period);
    const dun: QimenDun = rule.ju > 0 ? 'yang' : 'yin';
    const ju = Math.abs(rule.ju);
    const p = getQimenPositions(dun, ju, cycle.getIndex());
    const { earth, direction, chiefOrigin, stemPalace, chiefGateRawPalace, hiddenStem } = p;
    const { voidBranches, horseBranch, horsePalace } = computeVoidAndHorse(cycle.getIndex());
    const seasonalPalace = QIMEN_RING[Math.floor(day.getTerm().getIndex() / 3)];
    const longPeriod = period === '年盘' || period === '月盘';
    const gateOrigin = seated && chiefOrigin === 5 ? 2 : chiefOrigin;
    let gateAt = chiefGateRawPalace;
    if (seated && gateAt === 5) gateAt = longPeriod ? gateOrigin : seasonalPalace;
    const godAt = seated && stemPalace === 5 ? (longPeriod ? 8 : seasonalPalace) : stemPalace;
    const outerSource = chiefOrigin === 5 ? seasonalPalace : chiefOrigin;
    const outerTarget = stemPalace === 5 ? seasonalPalace : stemPalace;
    const fixedStems = longPeriod && (stemPalace === 5 || chiefOrigin === 5);
    const rotation = QIMEN_RING.indexOf(outerTarget) - QIMEN_RING.indexOf(outerSource);
    const gateRotation = QIMEN_RING.indexOf(gateAt) - QIMEN_RING.indexOf(gateOrigin);
    const palaces: QimenPalace[] = QIMEN_PALACES.map(info => {
        const { number } = info;
        const starFrom = mod(number - stemPalace + chiefOrigin - 1, 9);
        const ring = QIMEN_RING.indexOf(number);
        let gate = QIMEN_PALACES[mod(number - gateAt + chiefOrigin - 1, 9)].gate;
        let sky = earth[starFrom];
        let spirit: string | null;
        if (seated) {
            gate = number === 5 ? null : QIMEN_PALACES[QIMEN_RING[mod(ring - gateRotation, 8)] - 1].gate;
            sky = number === 5 || fixedStems ? earth[number - 1] : earth[QIMEN_RING[mod(ring - rotation, 8)] - 1];
            spirit = number === 5 ? null : SEATED_GODS[mod(direction * (ring - QIMEN_RING.indexOf(godAt)), 8)];
        } else {
            spirit = FLYING_GODS[mod(direction * (number - stemPalace), 9)];
            if (direction < 0 && spirit === '勾陈') spirit = '白虎';
            if (direction < 0 && spirit === '朱雀') spirit = '玄武';
        }
        const ground = earth[number - 1];
        return {
            number,
            earthStem: seated && ground === hiddenStem ? '甲' : ground,
            heavenStem: seated && sky === hiddenStem ? '甲' : sky,
            hostedEarthStem: null,
            hostedHeavenStem: null,
            star: QIMEN_PALACES[starFrom].star,
            gate,
            spirit,
            voidBranches: voidBranches.filter(branch => info.branches.includes(branch)),
            isHorse: number === horsePalace,
        };
    });
    const chief = {
        xunHead: cycle.getTen().getName(),
        hiddenStem,
        chiefStar: QIMEN_PALACES[chiefOrigin - 1].star,
        chiefGate: QIMEN_PALACES[gateOrigin - 1].gate ?? '五位',
        chiefStarPalace: stemPalace,
        chiefGatePalace: gateAt,
    };
    return {
        dun,
        ju,
        title: (direction > 0 ? '阳遁' : '阴遁') + NUMBERS[ju - 1] + '局',
        method: rule.method,
        detail: cycle.getName() + period[0],
        source: seated ? '透派坐山 · 座山盘作盘法' : '《奇门鸣法》〈入门〉',
        basis: rule.basis + (seated ? ' 北京时间，节入日换月、零点换日。盘中甲字代表本旬所遁的' + hiddenStem + '。' : ' 星门皆顺飞，九神随遁顺逆。'),
        centerNote: seated
            ? [`九星飞入中五，八门、八神排外八宫。`,
                chiefGateRawPalace === 5 && `值使原落中五，${longPeriod ? '按门本位' : '按节令寄宫'}落${QIMEN_PALACES[gateAt - 1].name}。`,
                stemPalace === 5 && `值符星入中，值符神寄${QIMEN_PALACES[godAt - 1].name}。`].filter(Boolean).join('')
            : `中五参与星门顺飞；五位本轮飞至${QIMEN_PALACES[palaces.findIndex(p => !p.gate)].name}，九神随遁顺逆。`,
        focus: gateAt,
        voidBranches,
        horseBranch,
        horsePalace,
        wuBuYuShi: period === '时盘' ? isWuBuYuShi(pillars[2], pillars[3]) : false,
        palaces,
        chief,
    };
}
