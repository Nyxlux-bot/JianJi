/** 梅花易数喂给 AI 的结构化起卦资料。判语、卦气、类象按当前规则现算。 */
import { getLinePositionName, getTiYong, getTrigram } from './engine';
import { getTrigramImages, TRIGRAM_IMAGE_SOURCE } from './images';
import { analyzeMeihua, RELATION_RULES, type MeihuaRelation, type MeihuaTrigramRelation } from './rules';
import { getHexagramText, getLineText } from '../../core/iching-texts';
import { MEIHUA_METHOD_LABEL, type MeihuaHexagram, type MeihuaResult } from './types';

const TONE_LABEL = { good: '吉', mixed: '平', bad: '凶' } as const;

function trigramLabel(index: number): string {
    const trigram = getTrigram(index);
    return `${trigram.name}（${trigram.nature}·${trigram.wuxing}）`;
}

function hexagramLine(label: string, hexagram: MeihuaHexagram): string {
    return `${label}：${hexagram.fullName}｜上卦${trigramLabel(hexagram.upper)}，下卦${trigramLabel(hexagram.lower)}`;
}

const TIYONG_LABEL: Record<MeihuaRelation, string> = { 比和: '体用比和', 生体: '用生体', 克体: '用克体', 体生: '体生用', 体克: '体克用' };
const OTHER_LABEL: Record<MeihuaRelation, string> = { 比和: '与体比和', 生体: '生体', 克体: '克体', 体生: '泄体（体生之）', 体克: '受体所克' };

function relationLine(item: MeihuaTrigramRelation, ti: MeihuaTrigramRelation): string {
    const relation = item.relation as MeihuaRelation;
    const tone = TONE_LABEL[RELATION_RULES[relation].tone];
    const head = `- ${item.role}${item.name}${item.wuxing} → 体${ti.name}${ti.wuxing}`;
    return item.role === '用'
        ? `${head}：${TIYONG_LABEL[relation]}（${tone}；${RELATION_RULES[relation].quote}）`
        : `${head}：${OTHER_LABEL[relation]}（${tone}）`;
}

export function formatMeihuaForAI(result: MeihuaResult): string {
    const analysis = analyzeMeihua(result);
    const { lunarInfo, jieqi } = result;
    const { ti, yong } = getTiYong(result);
    const lines: string[] = [];

    lines.push('【起卦资料】以下时间、月令与取数属于所记起卦时点，不随追问当天改变。');
    lines.push(`起卦方式：${MEIHUA_METHOD_LABEL[result.method]}`);
    lines.push(`公历：${result.solarDate} ${result.solarTime}`);
    lines.push(`农历：${lunarInfo.yearGanZhi}年 ${lunarInfo.lunarMonthCN}${lunarInfo.lunarDayCN} ${lunarInfo.hourZhi}时`);
    lines.push(`四柱：${lunarInfo.yearGanZhi} ${lunarInfo.monthGanZhi} ${lunarInfo.dayGanZhi} ${lunarInfo.hourGanZhi}`);
    lines.push(`节气：${jieqi.current}（${jieqi.currentDate}）→ ${jieqi.next}（${jieqi.nextDate}）`);
    lines.push(`取数：${result.numbers.map((item) => `${item.label}${item.source}=${item.value}`).join('，')}`);
    lines.push(result.method === 'meihua_time'
        ? '取法：年支数＋农历月＋日为上卦数，再加时支数为下卦数，年月日时总数除六取动爻（《梅花易数》卷一「年月日时起例」）。'
        : '取法：前数为上卦，后数为下卦，两数并时支数除六取动爻（参《梅花易数》卷一「物数占例」以卦数并时数取爻）。');
    lines.push(`算式：上卦 ${result.formulas.upper}；下卦 ${result.formulas.lower}；动爻 ${result.formulas.moving}`);
    lines.push('');

    lines.push('【三卦】');
    lines.push(hexagramLine('本卦（事之始）', result.ben));
    lines.push(hexagramLine('互卦（事之中，取二至五爻）', result.hu));
    lines.push(hexagramLine('变卦（事之终）', result.bian));
    lines.push(`动爻：本卦${getLinePositionName(result.movingLine)}`);
    lines.push('');

    lines.push('【体用】');
    lines.push(`动爻在${result.tiPosition === 'lower' ? '上' : '下'}卦，故${result.tiPosition === 'lower' ? '上' : '下'}卦为用，另一卦为体。`);
    lines.push(`体卦：${trigramLabel(ti)}；用卦：${trigramLabel(yong)}`);
    lines.push('');

    lines.push('【生克】以体卦为主，逐一列出各经卦对体的作用：');
    lines.push(relationLine(analysis.yong, analysis.ti));
    lines.push(relationLine(analysis.huUpper, analysis.ti));
    lines.push(relationLine(analysis.huLower, analysis.ti));
    lines.push(relationLine(analysis.bianYong, analysis.ti));
    lines.push('');

    lines.push(`【卦气】月令：${analysis.monthZhi}月，${analysis.monthWuxing}当令。`);
    lines.push(analysis.season.map((row) => `${row.wuxing}${row.state}${row.holders.length ? `（${row.holders.join('、')}）` : ''}`).join('；'));
    lines.push(`体卦${analysis.ti.name}${analysis.ti.wuxing}${analysis.tiState}，用卦${analysis.yong.name}${analysis.yong.wuxing}${analysis.yongState}。`);
    lines.push('');

    const benText = getHexagramText(result.ben);
    const movingText = getLineText(result.ben, result.movingLine);
    const huText = getHexagramText(result.hu);
    const bianText = getHexagramText(result.bian);
    lines.push('【卦辞爻辞】');
    lines.push(`本卦${result.ben.name}卦辞：${benText.scripture}　象曰：${benText.xiang}`);
    lines.push(`动爻${movingText.name}：${movingText.scripture}　象曰：${movingText.xiang}`);
    lines.push(`互卦${result.hu.name}卦辞：${huText.scripture}`);
    lines.push(`变卦${result.bian.name}卦辞：${bianText.scripture}`);
    lines.push('');

    lines.push(`【类象】取自${TRIGRAM_IMAGE_SOURCE}`);
    lines.push(`体卦${getTrigram(ti).name}：${getTrigramImages(getTrigram(ti).name).join('、')}`);
    lines.push(`用卦${getTrigram(yong).name}：${getTrigramImages(getTrigram(yong).name).join('、')}`);
    lines.push('');

    lines.push('【程序规则判定（参考）】按体用生克与卦气口诀机械给出，须结合全盘综合判断：');
    analysis.judgements.forEach((item) => lines.push(`- ${item.label}（${item.tag}）：${item.text}`));
    lines.push('');

    lines.push(result.question.trim()
        ? `【占问】${result.question.trim()}`
        : '【占问】未填写；仅能先作卦象初步分析，不能擅定所问之事或当事人关系。');
    return lines.join('\n');
}
