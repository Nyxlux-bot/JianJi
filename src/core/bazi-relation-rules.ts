import { DIZHI_WUXING, TIANGAN_WUXING, WuXing } from './liuyao-data';

export const GAN_HE: Record<string, WuXing> = {
    甲己: '土',
    乙庚: '金',
    丙辛: '水',
    丁壬: '木',
    戊癸: '火',
};

export const GAN_CHONG = ['甲庚', '乙辛', '丙壬', '丁癸'] as const;

export const ZHI_SAN_HUI: Record<string, WuXing> = {
    亥子丑: '水',
    寅卯辰: '木',
    巳午未: '火',
    申酉戌: '金',
};

export const ZHI_SAN_HE: Record<string, WuXing> = {
    申子辰: '水',
    亥卯未: '木',
    寅午戌: '火',
    巳酉丑: '金',
};

export const ZHI_LIU_HE: Record<string, WuXing> = {
    子丑: '土',
    寅亥: '木',
    卯戌: '火',
    辰酉: '金',
    巳申: '水',
    午未: '土',
};

export const ZHI_AN_HE = ['寅丑', '午亥', '卯申'] as const;
export const ZHI_CHONG = ['子午', '丑未', '寅申', '卯酉', '辰戌', '巳亥'] as const;
export const ZHI_HAI = ['子未', '丑午', '寅巳', '卯辰', '申亥', '酉戌'] as const;
export const ZHI_PO = ['子酉', '卯午', '辰丑', '未戌', '寅亥', '巳申'] as const;

export const ZHI_XING_PAIR_RULES = [
    { members: ['子', '卯'] as const, name: '无礼之刑' },
    { members: ['寅', '巳', '申'] as const, name: '无恩之刑' },
    { members: ['丑', '未', '戌'] as const, name: '恃势之刑' },
] as const;

export const ZHI_XING_SELF = ['辰', '午', '酉', '亥'] as const;

export const GENERATES: Record<WuXing, WuXing> = {
    木: '火',
    火: '土',
    土: '金',
    金: '水',
    水: '木',
};

export const CONTROLS: Record<WuXing, WuXing> = {
    木: '土',
    土: '水',
    水: '火',
    火: '金',
    金: '木',
};

export function getPairKey(pairA: string, pairB: string, rules: readonly string[]): string | null {
    for (const rule of rules) {
        if (rule === pairA + pairB || rule === pairB + pairA) {
            return rule;
        }
    }
    return null;
}

export function getDictPairEntry<T>(pairA: string, pairB: string, dict: Record<string, T>): [string, T] | null {
    for (const [key, value] of Object.entries(dict)) {
        if (key === pairA + pairB || key === pairB + pairA) {
            return [key, value];
        }
    }
    return null;
}

export function getElementInteraction(left: WuXing, right: WuXing): '生' | '助' | '克' | null {
    if (left === right) {
        return '助';
    }
    if (GENERATES[left] === right || GENERATES[right] === left) {
        return '生';
    }
    if (CONTROLS[left] === right || CONTROLS[right] === left) {
        return '克';
    }
    return null;
}

export function compareWuXing(left: WuXing, right: WuXing): {
    label: '生' | '助' | '克' | null;
    direction: 'left_to_right' | 'right_to_left' | 'bidirectional';
    polarity: 'positive' | 'negative' | 'neutral';
} {
    if (left === right) {
        return {
            label: '助',
            direction: 'bidirectional',
            polarity: 'positive',
        };
    }
    if (GENERATES[left] === right) {
        return {
            label: '生',
            direction: 'left_to_right',
            polarity: 'positive',
        };
    }
    if (GENERATES[right] === left) {
        return {
            label: '生',
            direction: 'right_to_left',
            polarity: 'positive',
        };
    }
    if (CONTROLS[left] === right) {
        return {
            label: '克',
            direction: 'left_to_right',
            polarity: 'negative',
        };
    }
    if (CONTROLS[right] === left) {
        return {
            label: '克',
            direction: 'right_to_left',
            polarity: 'negative',
        };
    }
    return {
        label: null,
        direction: 'bidirectional',
        polarity: 'neutral',
    };
}

export function isZhiXingPair(branchA: string, branchB: string): boolean {
    return ZHI_XING_PAIR_RULES.some((rule) => rule.members.includes(branchA as never) && rule.members.includes(branchB as never));
}

export function getZhiXingPairMeta(a: string, b: string): { key: string; name: string } | null {
    for (const rule of ZHI_XING_PAIR_RULES) {
        if (rule.members.includes(a as never) && rule.members.includes(b as never)) {
            return {
                key: rule.members.filter((member) => member === a || member === b).join(''),
                name: rule.name,
            };
        }
    }
    return null;
}

export function getGanKeMeta(stemA: string, stemB: string): { key: string; controller: string; controlled: string } | null {
    const elementA = TIANGAN_WUXING[stemA];
    const elementB = TIANGAN_WUXING[stemB];
    if (CONTROLS[elementA] === elementB) {
        return {
            key: `${stemA}${stemB}`,
            controller: stemA,
            controlled: stemB,
        };
    }
    if (CONTROLS[elementB] === elementA) {
        return {
            key: `${stemA}${stemB}`,
            controller: stemB,
            controlled: stemA,
        };
    }
    return null;
}

export function isFanyinPair(stemA: string, branchA: string, stemB: string, branchB: string): boolean {
    const ganChong = Boolean(getPairKey(stemA, stemB, GAN_CHONG));
    const ganKe = Boolean(getGanKeMeta(stemA, stemB));
    const zhiChong = Boolean(getPairKey(branchA, branchB, ZHI_CHONG));
    return zhiChong && (ganChong || ganKe);
}

export function getPillarStatus(stem: string, branch: string): '盖头' | '截脚' | null {
    const stemElement = TIANGAN_WUXING[stem];
    const branchElement = DIZHI_WUXING[branch];
    if (!stemElement || !branchElement) {
        return null;
    }
    if (CONTROLS[stemElement] === branchElement) {
        return '盖头';
    }
    if (CONTROLS[branchElement] === stemElement) {
        return '截脚';
    }
    return null;
}
