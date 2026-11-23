import { SolarDay, SolarTime } from 'tyme4ts';
import { LIUYAO_SUBJECT_SHORT } from '../../core/liuyao-data';
import type { PersistedAIChatMessage } from '../../core/ai-meta';
import { QIMEN_GATES, QIMEN_PALACES } from './data';
import { getQimenPillars } from './flying-board';
import { getPeriodBoard } from './period-board';
import { getQimenPalaceNotes, getQimenPalaceRelations, getQimenStemPalaces } from './rules';
import type { QimenPeriod, QimenResult } from './types';

export function getQimenChatPeriod(messages: readonly PersistedAIChatMessage[]): QimenPeriod {
    for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === 'user') return messages[i].qimenPeriod ?? '时盘';
    }
    return '时盘';
}

const PILLAR_LABELS = ['年', '月', '日', '时'] as const;
const PERIOD_STEM_INDICES: Record<QimenPeriod, readonly (0 | 1 | 2 | 3)[]> = {
    时盘: [2, 3],
    日盘: [2, 3],
    月盘: [1, 2, 3],
    年盘: [0, 1, 2, 3],
};

/** 附带未来 14 天干支与后两节气公历日期，便于 AI 在需要时准确落定时窗而不臆测换算。 */
function formatUpcomingCalendar(result: QimenResult): string {
    const [y, m, d] = result.solarDate.split('-').map(Number);
    const [h, min, sec] = result.solarTime.split(':').map(Number);
    const startDay = SolarDay.fromYmd(y, m, d).next(result.form !== '星飞门转' && h >= 23 ? 1 : 0);
    const days: string[] = [];
    for (let offset = 0; offset < 14; offset++) {
        const cur = startDay.next(offset);
        const gz = cur.getSixtyCycleDay().getSixtyCycle().getName();
        days.push(`${String(cur.getMonth()).padStart(2, '0')}-${String(cur.getDay()).padStart(2, '0')}${gz}`);
    }
    const st = SolarTime.fromYmdHms(y, m, d, h, min, sec || 0);
    const next1 = st.getTerm().next(1);
    const next2 = st.getTerm().next(2);
    const fmtTerm = (t: ReturnType<typeof st.getTerm>) => {
        const d1 = t.getJulianDay().getSolarDay();
        return `${t.getName()}(${d1.getYear()}-${String(d1.getMonth()).padStart(2, '0')}-${String(d1.getDay()).padStart(2, '0')})`;
    };
    return `【近期干支与节气对照】日干支：${days.join('、')}；后续节气：${fmtTerm(next1)}、${fmtTerm(next2)}`;
}

function describePeriod(result: QimenResult, period: QimenPeriod): string {
    const board = getPeriodBoard(result, period);
    const pillars = getQimenPillars(result);
    const { xunHead, hiddenStem, chiefStar, chiefStarPalace, chiefGate, chiefGatePalace } = board.chief;
    const name = (n: number) => QIMEN_PALACES[n - 1].name + '宫';
    const lines = [
        `【${period}】${board.title} · ${board.detail} · ${board.method}${board.wuBuYuShi ? ' · 五不遇时' : ''}`,
        `依据：${board.source}。${board.basis}`,
        `旬首${xunHead}遁${hiddenStem}，值符${chiefStar}在${name(chiefStarPalace)}，值使${chiefGate}在${name(chiefGatePalace)}；${period[0]}旬空${board.voidBranches.join('')}，驿马${board.horseBranch}在${name(board.horsePalace)}`,
    ];
    const stemParts: string[] = [];
    for (const i of PERIOD_STEM_INDICES[period]) {
        const positions = getQimenStemPalaces(result, i, board).map(p => name(p.number));
        if (positions.length) stemParts.push(`${PILLAR_LABELS[i]}干(${pillars[i][0]})在${positions.join('、')}`);
    }
    if (stemParts.length) lines.push('主干落宫（含寄干）：' + stemParts.join('；'));

    for (const cell of board.palaces) {
        const info = QIMEN_PALACES[cell.number - 1];
        const dark = board.darkStems?.[cell.number - 1];
        const parts = [
            cell.star || '天禽随芮',
            cell.gate || (result.form === '飞盘' ? '五位' : '无门'),
            cell.spirit,
            cell.heavenStem && '天' + cell.heavenStem,
            '地' + cell.earthStem,
            dark && '暗' + dark,
            cell.hostedHeavenStem && '天禽寄' + cell.hostedHeavenStem,
            cell.hostedEarthStem && '地寄' + cell.hostedEarthStem,
        ];
        const notes = getQimenPalaceNotes(result, cell, board, period);
        const star = QIMEN_PALACES.find(p => p.star === cell.star);
        const relation = notes.find(n => ['门迫', '门受制', '门生宫', '宫生门', '门宫比和'].includes(n.label));
        const facts = [info.name + '宫' + info.element, star && cell.star + star.element,
            cell.gate && cell.gate + QIMEN_GATES[cell.gate].element, relation && relation.label + '（' + relation.detail.replace(/。$/u, '') + '）'].filter(Boolean);
        const noteText = notes
            .map(note => (note.compact ?? note.detail).replace(/。$/u, ''))
            .join('；');
        const body = parts.filter(Boolean).join('、') + (noteText ? `｜${noteText}` : '');
        lines.push(`【${period}·${name(cell.number)}】 ${facts.join(' · ')}｜${info.direction}·${info.element} ${body}`);
    }
    return lines.join('\n');
}

export function formatQimenForAI(result: QimenResult, period: QimenPeriod = '时盘', allPeriods = false): string {
    if (result.aiEvidence) {
        const context = result.aiEvidence.context.replace(/【当前查看】[年月日时]盘/u, '【当前查看】' + period);
        if (allPeriods) return context;
        let include = true;
        return context.split('\n').filter(line => {
            const heading = /^【([年月日时]盘)】/u.exec(line);
            if (heading) include = heading[1] === period;
            if (/^【(?:近期干支与节气对照|外八宫五行关系)】/u.test(line)) include = true;
            return include;
        }).join('\n');
    }
    const periods: QimenPeriod[] = allPeriods ? ['时盘', '日盘', '月盘', '年盘'] : [period];
    const timeBasis = result.form === '星飞门转' ? '北京时间，节入日换月、午夜换日' : '北京时间，交节时刻换月、子初换日';
    const pillars = getQimenPillars(result);
    return [
        `【起盘】${result.inputDateTime} · ${timeBasis} · ${result.lunarDate} · ${result.location || '未填地点'}`,
        `【盘式】${result.form ?? '转盘'}　【当前查看】${period}　【注记口径】月/日/时盘按${pillars[1][1]}月令计旺衰（八门用一般五行法，九星用烟波法）；年盘跨全年不套单月令。`,
        `【四柱】${pillars.join(' ')}　【节气】${result.solarTerm.name} ${result.solarTerm.at}，下节${result.solarTerm.nextName} ${result.solarTerm.nextAt}`,
        `【占问】${result.question || '未填写'}　【主体】${result.subject ? LIUYAO_SUBJECT_SHORT[result.subject] : '未填写'}`,
        `【近期事件：用户自述】${result.recentEvents || '未填写'}　【关注时间】${result.timeRange || '未填写'}`,
        ...periods.map(p => describePeriod(result, p)),
        formatUpcomingCalendar(result),
        '【外八宫五行关系】' + getQimenPalaceRelations().join('；'),
    ].join('\n');
}
