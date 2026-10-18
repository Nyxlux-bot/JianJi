import type { ImageSourcePropType } from 'react-native';
import type { Href } from 'expo-router';
import { BaGuaIcon, ClockIcon, CoinIcon, HandIcon, NumberIcon, RingsIcon, StarIcon } from '../../components/Icons';

export type HomeEntryId = 'liuyao' | 'meihua' | 'bazi' | 'ziwei';

export interface HomeEntry {
    id: HomeEntryId;
    title: string;
    subtitle: string;
    group: string;
    image?: ImageSourcePropType;
    description: string;
    meta: string;
    actions: { label: string; accessibilityLabel: string; route: Href; Icon: typeof CoinIcon }[];
}

export const HOME_ENTRIES: HomeEntry[] = [
    {
        id: 'liuyao', title: '六爻', subtitle: '纳甲 · 六亲 · 世应', group: '起卦',
        description: '三枚铜钱，六次摇掷成卦', meta: '',
        actions: [
            { label: '摇卦', accessibilityLabel: '摇卦', route: '/divination/coin', Icon: CoinIcon },
            { label: '手动', accessibilityLabel: '手动录入', route: '/divination/manual', Icon: HandIcon },
        ],
    },
    {
        id: 'meihua', title: '梅花易数', subtitle: '先天数 · 体用', group: '起卦',
        image: require('../../../assets/meihua/ui/plum-branch.png'), description: '', meta: '',
        actions: [
            { label: '时间', accessibilityLabel: '时间起卦', route: '/meihua/input?mode=time', Icon: ClockIcon },
            { label: '数字', accessibilityLabel: '数字起卦', route: '/meihua/input?mode=number', Icon: NumberIcon },
        ],
    },
    {
        id: 'bazi', title: '八字命理', subtitle: '四柱 · 十神 · 大运', group: '命盘',
        image: require('../../../assets/bazi/ui/taiji-clouds.webp'),
        description: '四柱十神，大运流年', meta: '两人可合盘，五维对照',
        actions: [
            { label: '排盘', accessibilityLabel: '八字排盘', route: '/bazi/input', Icon: BaGuaIcon },
            { label: '合盘', accessibilityLabel: '八字合盘', route: '/bazi/match', Icon: RingsIcon },
        ],
    },
    {
        id: 'ziwei', title: '紫微斗数', subtitle: '十二宫 · 四化', group: '命盘',
        image: require('../../../assets/ziwei/ui/star-chart.webp'),
        description: '十二宫星曜，四化运限', meta: '命盘信息与全书格局',
        actions: [{ label: '排盘', accessibilityLabel: '紫微排盘', route: '/ziwei/input', Icon: StarIcon }],
    },
];

export const ENTRY_THEMES = {
    yin: {
        buttons: {
            liuyao: { fill: '#66553D', ink: '#F4E5CC', tint: '#DFCDA8', border: '#D5BC8A50' },
            meihua: { fill: '#674C49', ink: '#F7E2DC', tint: '#E6C6BF', border: '#D8A49B50' },
            bazi: { fill: '#435D5C', ink: '#E0EFEA', tint: '#C1DCD4', border: '#9CBBB250' },
            ziwei: { fill: '#5C506D', ink: '#EEE4F7', tint: '#D9C8E9', border: '#BCA5D050' },
        },
        gradients: {
            liuyao: { top: '#282722', middle: '#363126', bottom: '#494033', glow: '#CAA66B' },
            meihua: { top: '#292627', middle: '#36302F', bottom: '#463737', glow: '#C0877F' },
            bazi: { top: '#232829', middle: '#2C3539', bottom: '#38464B', glow: '#91AAA7' },
            ziwei: { top: '#27262D', middle: '#322E3D', bottom: '#423B52', glow: '#A797B4' },
        },
        ink: '#F3EAD6', muted: '#B7AFA4', gold: '#E2C46E',
        border: '#FFFFFF10', borderTop: '#FFFFFF27', borderBottom: '#0B090C6B',
        shadow: '#08090C', shadowOpacity: 0.22,
    },
    yang: {
        buttons: {
            liuyao: { fill: '#E4D4B6', ink: '#594528', tint: '#68502D', border: '#80663850' },
            meihua: { fill: '#E5CDC8', ink: '#68453F', tint: '#784D47', border: '#98665C50' },
            bazi: { fill: '#CEDED9', ink: '#35534E', tint: '#3D5F59', border: '#587E7650' },
            ziwei: { fill: '#DBD0E2', ink: '#564269', tint: '#665177', border: '#856A9D50' },
        },
        gradients: {
            liuyao: { top: '#FCF8EF', middle: '#F1E8D4', bottom: '#E3D1A9', glow: '#B18A46' },
            meihua: { top: '#FCF6F2', middle: '#F3E6E0', bottom: '#E5CBC5', glow: '#B66D69' },
            bazi: { top: '#F6F7F3', middle: '#E6ECE9', bottom: '#CAD9D9', glow: '#789592' },
            ziwei: { top: '#F9F6F8', middle: '#EDE7EE', bottom: '#D9CFDF', glow: '#95839F' },
        },
        ink: '#2F2A24', muted: '#655D52', gold: '#815B16',
        border: '#6B53391C', borderTop: '#FFFFFFBF', borderBottom: '#7B645C38',
        shadow: '#463214', shadowOpacity: 0.08,
    },
};

export type EntryTheme = typeof ENTRY_THEMES.yin;
