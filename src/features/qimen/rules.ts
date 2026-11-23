import { DIZHI_WUXING, type WuXing } from '../../core/liuyao-data';
import { QIMEN_GATES, QIMEN_PALACES } from './data';
import { getQimenPillars } from './flying-board';
import { getQimenStemPattern } from './patterns';
import type { PeriodBoard } from './period-board';
import { QIMEN_PERIODS, type QimenPalace, type QimenPeriod, type QimenResult } from './types';

const SHENG: Record<WuXing, WuXing> = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
const KE: Record<WuXing, WuXing> = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
const PUNISHMENT: Record<string, number> = { 戊: 3, 己: 2, 庚: 8, 辛: 9, 壬: 4, 癸: 4 };
const WONDER_TOMB: Record<string, number> = { 乙: 2, 丙: 6, 丁: 8 };

export interface QimenPalaceNote {
    label: string;
    detail: string;
    /** 精简版（供 AI 序列化节省 Token，避免重复口径说明）。 */
    compact?: string;
}

export interface QimenPalaceBadge {
    key: 'po' | 'xing' | 'mu' | 'fu' | 'fan';
    text: string;
    tone: 'warn' | 'muted';
}

function strength(element: WuXing, environment: WuXing, star: boolean): string {
    if (element === environment) return star ? '相' : '旺';
    if (SHENG[element] === environment) return star ? '旺' : '休';
    if (SHENG[environment] === element) return star ? '废' : '相';
    if (KE[element] === environment) return star ? '休' : '囚';
    return star ? '囚' : '死';
}

function resolveStem(stem: string | null, hiddenStem: string): string | null {
    if (!stem) return null;
    return stem === '甲' ? hiddenStem : stem;
}

export function getQimenPalaceRelations(): string[] {
    const palaces = QIMEN_PALACES.filter(palace => palace.number !== 5);
    const relations: string[] = [];
    for (const [index, first] of palaces.entries()) {
        for (const second of palaces.slice(index + 1)) {
            const a = `${first.name}宫${first.element}`;
            const b = `${second.name}宫${second.element}`;
            if (first.element === second.element) relations.push(`${a}与${b}比和`);
            else if (SHENG[first.element] === second.element) relations.push(`${a}生${b}`);
            else if (SHENG[second.element] === first.element) relations.push(`${b}生${a}`);
            else if (KE[first.element] === second.element) relations.push(`${a}克${b}`);
            else relations.push(`${b}克${a}`);
        }
    }
    return relations;
}

/** 比较任意两个外八宫的五行生克关系，供九宫交互对照条使用。 */
export function compareQimenPalaces(fromNumber: number, toNumber: number, form: QimenResult['form'] = '转盘'): string | null {
    if (fromNumber === toNumber) return '同宫比和';
    if (form === '转盘' && (fromNumber === 5 || toNumber === 5)) return '中五寄坤土，需结合外宫综合看';
    const a = QIMEN_PALACES[fromNumber - 1];
    const b = QIMEN_PALACES[toNumber - 1];
    if (!a || !b) return null;
    if (a.element === b.element) return `${a.name}宫(${a.element})与${b.name}宫(${b.element})比和`;
    if (SHENG[a.element] === b.element) return `${a.name}宫(${a.element})生${b.name}宫(${b.element})`;
    if (SHENG[b.element] === a.element) return `${b.name}宫(${b.element})生${a.name}宫(${a.element})`;
    if (KE[a.element] === b.element) return `${a.name}宫(${a.element})克${b.name}宫(${b.element})`;
    return `${b.name}宫(${b.element})克${a.name}宫(${a.element})`;
}

/** 提取宫格角落精炼徽标（迫/刑/墓/伏/反），供九宫盘一屏直读。 */
export function getQimenPalaceBadges(palace: QimenPalace, board: PeriodBoard): QimenPalaceBadge[] {
    if (board.turn && palace.number === 5) return [];
    const info = QIMEN_PALACES[palace.number - 1];
    const badges: QimenPalaceBadge[] = [];
    if (palace.gate && KE[QIMEN_GATES[palace.gate].element] === info.element) {
        badges.push({ key: 'po', text: '迫', tone: 'warn' });
    }
    const stems = [resolveStem(palace.heavenStem, board.chief.hiddenStem), resolveStem(palace.hostedHeavenStem, board.chief.hiddenStem)];
    if (stems.some(stem => stem && PUNISHMENT[stem] === palace.number)) {
        badges.push({ key: 'xing', text: '刑', tone: 'warn' });
    }
    if (stems.some(stem => stem && WONDER_TOMB[stem] === palace.number)) {
        badges.push({ key: 'mu', text: '墓', tone: 'warn' });
    }
    const starInfo = palace.star ? QIMEN_PALACES.find(item => item.star === palace.star) : undefined;
    const gateInfo = palace.gate ? QIMEN_PALACES.find(item => item.gate === palace.gate) : undefined;
    if (palace.star === info.star || (palace.gate !== null && palace.gate === info.gate)) {
        badges.push({ key: 'fu', text: '伏', tone: 'muted' });
    } else if (palace.number !== 5 && ((starInfo && starInfo.number + palace.number === 10) || (gateInfo && gateInfo.number + palace.number === 10))) {
        badges.push({ key: 'fan', text: '反', tone: 'muted' });
    }
    return badges;
}

/** 注记只陈述规则与盘层，不能单凭一个标记判定整件事的吉凶。支持转盘、飞盘与星飞门转。 */
export function getQimenPalaceNotes(result: QimenResult, palace: QimenPalace, board: PeriodBoard, period: QimenPeriod): QimenPalaceNote[] {
    const info = QIMEN_PALACES[palace.number - 1];
    const pillars = getQimenPillars(result);
    if (board.turn && palace.number === 5) {
        const hosted = board.palaces.find(item => item.hostedHeavenStem !== null);
        const hostedName = hosted ? QIMEN_PALACES[hosted.number - 1].name + '宫' : '外宫';
        return [{
            label: '中宫寄宫',
            detail: `中五地盘${palace.earthStem}保留；地盘寄坤二，天禽携${palace.earthStem}随天芮落${hostedName}。中宫没有独立八门与八神。`,
        }];
    }
    const notes: QimenPalaceNote[] = [];
    if (!board.turn) {
        const starHome = QIMEN_PALACES.find(p => p.star === palace.star);
        const gateHome = QIMEN_PALACES.find(p => p.gate === palace.gate);
        const seated = result.form === '星飞门转';
        const starPath = starHome ? `${palace.star}自${starHome.name}顺飞至${info.name}` : '';
        const gatePath = seated && !palace.gate ? '八门仅在外八宫转排，中五不排门'
            : `${palace.gate ?? '五位'}自${gateHome?.name ?? '中五'}${seated ? '转排' : '顺飞'}至${info.name}`;
        if (board.centerNote && (palace.number === 5 || palace.number === board.focus)) notes.push({ label: '本盘入中', detail: board.centerNote });
        notes.push({ label: '星门落宫', detail: [starPath, gatePath].filter(Boolean).join('；') + '。' });
    }
    if (palace.voidBranches.length) {
        notes.push({
            label: period[0] + '旬空',
            detail: `${board.chief.xunHead}旬空${board.voidBranches.join('')}；本宫对应${palace.voidBranches.join('')}空。`,
            compact: `${period[0]}旬空(${palace.voidBranches.join('')}空)`,
        });
    }
    if (palace.isHorse) {
        notes.push({
            label: period[0] + '马',
            detail: `${pillars[QIMEN_PERIODS.indexOf(period)][1]}${period[0]}取${board.horseBranch}为驿马，落${info.name}宫。`,
            compact: `${period[0]}马(${board.horseBranch})`,
        });
    }
    const monthBranch = pillars[1][1];
    const month = DIZHI_WUXING[monthBranch];
    if (palace.gate) {
        const element = QIMEN_GATES[palace.gate].element;
        if (KE[element] === info.element) notes.push({ label: '门迫', detail: `${palace.gate}${element}克${info.name}宫${info.element}，为门克宫。`, compact: `门迫(${palace.gate}${element}克${info.name}${info.element})` });
        else if (KE[info.element] === element) notes.push({ label: '门受制', detail: `${info.name}宫${info.element}克${palace.gate}${element}，为宫克门。`, compact: `门受制(${info.name}${info.element}克${palace.gate}${element})` });
        else if (SHENG[element] === info.element) notes.push({ label: '门生宫', detail: `${palace.gate}${element}生${info.name}宫${info.element}。`, compact: `门生宫(${palace.gate}${element}生${info.name}${info.element})` });
        else if (SHENG[info.element] === element) notes.push({ label: '宫生门', detail: `${info.name}宫${info.element}生${palace.gate}${element}。`, compact: `宫生门(${info.name}${info.element}生${palace.gate}${element})` });
        else notes.push({ label: '门宫比和', detail: `${palace.gate}与${info.name}宫同属${element}。`, compact: `门宫比和(${element})` });
        // 年盘跨全年十二月，不套用起盘当月的单月令旺衰。
        if (period !== '年盘') {
            const gateStrength = strength(element, month, false);
            notes.push({
                label: '门的月令旺衰',
                detail: `${monthBranch}月${month}当令，${palace.gate}${element}为${gateStrength}（一般五行法）。`,
                compact: `${palace.gate}${element}${gateStrength}`,
            });
        }
    } else if (palace.number === 5 && result.form === '星飞门转') {
        notes.push({ label: '中宫无门', detail: '透派坐山中五宫有九星与天地干，八门与八神仅排于外八宫。' });
    }
    if (palace.star && period !== '年盘') {
        const starElement = QIMEN_PALACES.find(item => item.star === palace.star)!.element;
        const starStrength = strength(starElement, month, true);
        notes.push({
            label: '星的月令旺衰',
            detail: `${monthBranch}月${month}当令，${palace.star}${starElement}为${starStrength}（烟波法，星与门的旺衰规则不同）。`,
            compact: `${palace.star}${starElement}${starStrength}`,
        });
    }
    for (const [layer, rawStem] of [['天盘', palace.heavenStem], ['天盘寄干', palace.hostedHeavenStem]] as const) {
        const stem = resolveStem(rawStem, board.chief.hiddenStem);
        if (!stem) continue;
        if (PUNISHMENT[stem] === palace.number) notes.push({ label: '六仪击刑', detail: `${layer}${rawStem}${rawStem === '甲' ? `（遁${stem}）` : ''}落${info.name}宫，命中六仪击刑。`, compact: `${layer}${stem}击刑` });
        if (WONDER_TOMB[stem] === palace.number) notes.push({ label: '三奇入墓', detail: `${layer}${rawStem}落${info.name}宫，按古典三奇墓（乙未、丙戌、丁丑）标记。`, compact: `${layer}${stem}三奇入墓` });
    }
    const pattern = getQimenStemPattern(palace.heavenStem, palace.earthStem, board.chief.hiddenStem);
    if (pattern) {
        notes.push({
            label: `十干克应 · ${pattern.name}`,
            detail: `天${palace.heavenStem}加地${palace.earthStem}为「${pattern.name}」：${pattern.meaning}`,
            compact: `格局[${pattern.name}：${pattern.meaning.replace(/。$/u, '')}]`,
        });
    }
    if (palace.hostedHeavenStem) {
        const hostedPattern = getQimenStemPattern(palace.hostedHeavenStem, palace.earthStem, board.chief.hiddenStem);
        if (hostedPattern) {
            notes.push({
                label: `寄干克应 · ${hostedPattern.name}`,
                detail: `天禽寄${palace.hostedHeavenStem}加地${palace.earthStem}为「${hostedPattern.name}」：${hostedPattern.meaning}`,
                compact: `寄格局[${hostedPattern.name}]`,
            });
        }
    }
    const starOrigin = palace.star ? QIMEN_PALACES.find(item => item.star === palace.star)?.number : undefined;
    const gateOrigin = palace.gate ? QIMEN_PALACES.find(item => item.gate === palace.gate)?.number : undefined;
    if (palace.star === info.star) notes.push({ label: '星伏吟', detail: `${palace.star}回到本位${info.name}宫。`, compact: '星伏吟' });
    else if (palace.number !== 5 && starOrigin && starOrigin + palace.number === 10) notes.push({ label: '星反吟', detail: `${palace.star}落本位对冲宫（${info.name}宫）。`, compact: '星反吟' });
    if (palace.gate && palace.gate === info.gate) notes.push({ label: '门伏吟', detail: `${palace.gate}回到本位${info.name}宫。`, compact: '门伏吟' });
    else if (palace.number !== 5 && gateOrigin && gateOrigin + palace.number === 10) notes.push({ label: '门反吟', detail: `${palace.gate}落本位对冲宫（${info.name}宫）。`, compact: '门反吟' });
    return notes;
}

/** 甲干按其所在旬所遁六仪取用；天盘本干与天禽寄干都参与定位，兼容三种盘式。 */
export function getQimenStemPalaces(result: QimenResult, pillarIndex: 0 | 1 | 2 | 3, board: PeriodBoard): QimenPalace[] {
    const pillar = getQimenPillars(result)[pillarIndex];
    let stem = pillar[0];
    if (stem === '甲') {
        const branches = '子戌申午辰寅';
        stem = '戊己庚辛壬癸'[branches.indexOf(pillar[1])];
    }
    return board.palaces.filter(palace =>
        resolveStem(palace.heavenStem, board.chief.hiddenStem) === stem
        || resolveStem(palace.hostedHeavenStem, board.chief.hiddenStem) === stem,
    );
}
