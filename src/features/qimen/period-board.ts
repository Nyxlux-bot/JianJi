import { SixtyCycle, SolarDay } from 'tyme4ts';
import { QIMEN_RULE_DETAIL } from './data';
import { getFlyingBoard } from './flying-board';
import { buildQimenBoard, getQimenDarkStems, resolveZhiRun } from './engine';
import { isWuBuYuShi } from './patterns';
import {
    QIMEN_PERIODS,
    type QimenBoard,
    type QimenDun,
    type QimenForm,
    type QimenJuMethod,
    type QimenPalace,
    type QimenPeriod,
    type QimenResult,
    type QimenSpiritStyle,
} from './types';

export const FORM_DESCRIPTIONS: Record<QimenForm, string> = {
    转盘: '衍象坊转盘 · 支持拆补 / 置闰 / 茅山',
    飞盘: '《奇门鸣法》 · 星门顺飞，九神随遁',
    星飞门转: '透派坐山 · 九星顺飞，八门转排',
};

export const JU_METHOD_LABELS: Record<QimenJuMethod, string> = {
    chaibu: '拆补法',
    zhirun: '置闰法',
    maoshan: '茅山法',
};

export const JU_METHOD_DESCRIPTIONS: Record<QimenJuMethod, string> = {
    chaibu: '按交节瞬间切节气，依日干支符头定三元。',
    zhirun: '甲己上元符头十五日一节，芒种或大雪超神满九日置闰。',
    maoshan: '交节瞬间直入上元，每满六十时辰（五日）依次进元。',
};

export const SPIRIT_STYLE_LABELS: Record<QimenSpiritStyle, string> = {
    gouchen: '勾陈 · 朱雀',
    baihu: '白虎 · 玄武',
};

const YUAN = ['上元', '中元', '下元'];
const NUMBERS = '一二三四五六七八九';

export interface PeriodBoard {
    dun: QimenDun;
    ju: number;
    method: string;
    title: string;
    detail: string;
    basis: string;
    source: string;
    focus: number;
    voidBranches: string[];
    horseBranch: string;
    horsePalace: number;
    centerNote?: string;
    darkStems?: readonly string[];
    wuBuYuShi?: boolean;
    turn?: QimenBoard;
    chief: Pick<QimenBoard, 'xunHead' | 'hiddenStem' | 'chiefStar' | 'chiefStarPalace' | 'chiefGatePalace'> & { chiefGate: string };
    palaces: readonly QimenPalace[];
}

function turningBoard(
    board: QimenBoard,
    spiritStyle: QimenSpiritStyle,
    periodStem: string,
    method: string,
    detail: string,
    basis: string,
    source: string,
    wuBuYuShi = false,
): PeriodBoard {
    const palaces = spiritStyle === 'baihu'
        ? board.palaces
        : board.palaces.map(p => {
            if (p.spirit === '白虎') return { ...p, spirit: '勾陈' };
            if (p.spirit === '玄武') return { ...p, spirit: '朱雀' };
            return p;
        });
    const styledBoard: QimenBoard = { ...board, palaces };
    return {
        dun: board.dun,
        ju: board.ju,
        method,
        title: (board.dun === 'yang' ? '阳' : '阴') + '遁' + NUMBERS[board.ju - 1] + '局',
        detail,
        basis,
        source,
        focus: board.chiefGatePalace,
        voidBranches: board.voidBranches,
        horseBranch: board.horseBranch,
        horsePalace: board.horsePalace,
        darkStems: getQimenDarkStems(styledBoard, periodStem),
        wuBuYuShi,
        turn: styledBoard,
        chief: board,
        palaces,
    };
}

function calendarTurn(result: QimenResult, period: '年盘' | '月盘' | '日盘', cycle: number): PeriodBoard {
    let dun: QimenDun = 'yin';
    let ju: number, yuan: number, method: string, basis: string;
    let leap = false;
    if (period === '日盘') {
        const [y, m, d] = result.solarDate.split('-').map(Number);
        const day = SolarDay.fromYmd(y, m, d).next(result.solarTime.startsWith('23:') ? 1 : 0);
        const term = day.getTerm();
        // 甲子锚点可早于或晚于实际交节日。由下一次二至向前找最近的已生效锚点。
        let solstice = term.next(12 - term.getIndex() % 12);
        let elapsed: number;
        for (;;) {
            const solsticeDay = solstice.getJulianDay().getSolarDay();
            const index = solsticeDay.getSixtyCycleDay().getSixtyCycle().getIndex();
            const anchor = solsticeDay.next(index <= 30 ? -index : 60 - index);
            elapsed = day.subtract(anchor);
            if (elapsed >= 0) break;
            solstice = solstice.next(-12);
        }
        dun = solstice.getIndex() === 0 ? 'yang' : 'yin';
        ju = dun === 'yang' ? 1 + elapsed % 9 : 9 - elapsed % 9;
        yuan = Math.min(2, Math.floor(elapsed / 60));
        leap = elapsed >= 180;
        method = '二至甲子起局';
        basis = `以最接近${solstice.getName()}的甲子日为起点，相隔同为三十天取较早者。冬至阳一顺行，夏至阴九逆行，每日一局、六十日一元。`;
    } else if (period === '月盘') {
        const branch = result.fourPillars[0][1];
        yuan = '子午卯酉'.includes(branch) ? 0 : '寅申巳亥'.includes(branch) ? 1 : 2;
        const monthOffset = '寅卯辰巳午未申酉戌亥子丑'.indexOf(result.fourPillars[1][1]);
        ju = (([8, 2, 5][yuan] - 1 - monthOffset + 18) % 9) + 1;
        method = '年支定元 · 逐月逆行';
        basis = '按节令月建，以寅月为正月。四仲年正月起阴八，四孟年起阴二，四季年起阴五，逐月逆行。';
    } else {
        const civilYear = Number(result.solarDate.slice(0, 4));
        const pillarYear = SixtyCycle.fromIndex(civilYear - 4).getIndex() === cycle ? civilYear : civilYear - 1;
        yuan = (Math.floor((pillarYear - 1864) / 60) + 3) % 3;
        ju = (([1, 4, 7][yuan] - 1 - cycle + 63) % 9) + 1;
        method = '三元甲子 · 逐年逆行';
        basis = '立春换年，以 1864 年上元甲子为锚点，三元甲子分别起阴一、阴四、阴七，其后逐年逆行。';
    }
    const pillar = result.fourPillars[QIMEN_PERIODS.indexOf(period)];
    return turningBoard(
        buildQimenBoard(dun, ju, cycle),
        result.spiritStyle ?? 'gouchen',
        pillar[0],
        method,
        `${YUAN[yuan]}${leap ? '·闰' : ''} · ${pillar}${period[0]}`,
        basis,
        '衍象坊 · ' + period[0] + '家转盘',
    );
}

export function getPeriodBoard(result: QimenResult, period: QimenPeriod): PeriodBoard {
    if (result.form && result.form !== '转盘') return getFlyingBoard(result, period);
    const pillar = result.fourPillars[QIMEN_PERIODS.indexOf(period)];
    if (period === '时盘') {
        const juMethod: QimenJuMethod = result.juMethod ?? 'chaibu';
        const method = result.numberSeed !== undefined
            ? `报数起局 · 数 ${result.numberSeed}`
            : JU_METHOD_LABELS[juMethod];
        const basis = result.numberSeed !== undefined
            ? `以所报之数 ${result.numberSeed} 取余定为第 ${result.ju} 局；北京时间 UTC+8，子初换日，中五寄坤，天禽随芮。`
            : juMethod === 'chaibu'
                ? QIMEN_RULE_DETAIL
                : `北京时间 UTC+8；子初 23:00 换日；${JU_METHOD_DESCRIPTIONS[juMethod]}中五寄坤，天禽随芮；空亡、驿马均取时柱。`;
        let termName = result.solarTerm.name;
        if (juMethod === 'zhirun' && result.numberSeed === undefined) {
            const [y, m, d] = result.solarDate.split('-').map(Number);
            const targetDay = SolarDay.fromYmd(y, m, d).next(result.solarTime.startsWith('23:') ? 1 : 0);
            const zr = resolveZhiRun(targetDay);
            termName = (zr.isLeap ? '闰' : '') + zr.termName;
        }
        const detail = result.numberSeed !== undefined
            ? `${result.solarTerm.name} · 报数${result.numberSeed} · ${pillar}时`
            : `${termName} · ${result.yuan} · ${pillar}时`;
        const source = result.numberSeed !== undefined ? '时家转盘 · 报数起局' : `时家转盘 · ${JU_METHOD_LABELS[juMethod]}`;
        return turningBoard(
            result,
            result.spiritStyle ?? 'gouchen',
            pillar[0],
            method,
            detail,
            basis,
            source,
            isWuBuYuShi(result.fourPillars[2], result.fourPillars[3]),
        );
    }
    return calendarTurn(result, period, SixtyCycle.fromName(pillar).getIndex());
}
