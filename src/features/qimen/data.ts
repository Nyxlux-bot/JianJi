import type { WuXing } from '../../core/liuyao-data';
import type { QimenGate, QimenPalaceInfo } from './types';

export const QIMEN_RULE_LABEL = '时家转盘 · 拆补法';
export const QIMEN_RULE_DETAIL = '北京时间 UTC+8；子初 23:00 换日；按交节时刻切局；中五寄坤，天禽随芮；空亡、驿马均取时柱。';
export const QIMEN_LAYOUT = [4, 9, 2, 3, 5, 7, 8, 1, 6];
export const QIMEN_RING = [1, 8, 3, 4, 9, 2, 7, 6];
export const QIMEN_STEMS = '戊己庚辛壬癸丁丙乙';
export const QIMEN_SPIRITS = ['值符', '腾蛇', '太阴', '六合', '白虎', '玄武', '九地', '九天'];

export const QIMEN_PALACES: readonly QimenPalaceInfo[] = [
    { number: 1, name: '坎一', direction: '正北', element: '水', branches: '子', star: '天蓬', gate: '休门' },
    { number: 2, name: '坤二', direction: '西南', element: '土', branches: '未申', star: '天芮', gate: '死门' },
    { number: 3, name: '震三', direction: '正东', element: '木', branches: '卯', star: '天冲', gate: '伤门' },
    { number: 4, name: '巽四', direction: '东南', element: '木', branches: '辰巳', star: '天辅', gate: '杜门' },
    { number: 5, name: '中五', direction: '中央', element: '土', branches: '', star: '天禽', gate: null },
    { number: 6, name: '乾六', direction: '西北', element: '金', branches: '戌亥', star: '天心', gate: '开门' },
    { number: 7, name: '兑七', direction: '正西', element: '金', branches: '酉', star: '天柱', gate: '惊门' },
    { number: 8, name: '艮八', direction: '东北', element: '土', branches: '丑寅', star: '天任', gate: '生门' },
    { number: 9, name: '离九', direction: '正南', element: '火', branches: '午', star: '天英', gate: '景门' },
];

export const QIMEN_GATES: Record<QimenGate, { element: WuXing; motif: string; meaning: string; basis: string }> = {
    开门: { element: '金', motif: '金阙洞开', meaning: '开通、任职、事业、公开交往。', basis: '开门配乾；《说卦》以天、金为乾象。双扉打开是现代图标转译。' },
    休门: { element: '水', motif: '静水涵月', meaning: '休养、调节、休闲与沟通。', basis: '休门配坎；《说卦》以水、月为坎象。以月与静水表现休息。' },
    生门: { element: '土', motif: '艮山萌芽', meaning: '生发、收益、资源与发展。', basis: '生门配艮；《说卦》以山为艮象。山与新芽结合，表达生长。' },
    伤门: { element: '木', motif: '雷木裂枝', meaning: '行动、竞争、冲突与损伤。', basis: '伤门配震；《说卦》以雷、动为震象。裂枝与雷形表达冲击。' },
    杜门: { element: '木', motif: '木扉深闭', meaning: '隐蔽、限制、技术与保密。', basis: '杜门配巽；《说卦》以木、风为巽象。闭扉与横闩表达遮蔽。' },
    景门: { element: '火', motif: '离日生焰', meaning: '显现、文书、形象与表达。', basis: '景门配离；《说卦》以火、日为离象。日与火焰表达明亮。' },
    死门: { element: '土', motif: '坤土封藏', meaning: '停滞、收束、土地与静止。', basis: '死门配坤；《说卦》以地为坤象。土丘与地层表达封藏。' },
    惊门: { element: '金', motif: '金铎振声', meaning: '惊动、口舌、声音与警觉。', basis: '惊门配兑；《说卦》以口舌为兑象。金铎与声纹是现代图标转译。' },
};
