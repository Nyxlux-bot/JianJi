export type WuXingElement = '木' | '火' | '土' | '金' | '水';

export const WUXING_ORDER: WuXingElement[] = ['木', '火', '土', '金', '水'];

const GAN_ZHI_ELEMENT: Record<string, WuXingElement> = {
    甲: '木', 乙: '木', 寅: '木', 卯: '木',
    丙: '火', 丁: '火', 巳: '火', 午: '火',
    戊: '土', 己: '土', 辰: '土', 戌: '土', 丑: '土', 未: '土',
    庚: '金', 辛: '金', 申: '金', 酉: '金',
    壬: '水', 癸: '水', 子: '水', 亥: '水',
};

export function isWuXingElement(value: string): value is WuXingElement {
    return (WUXING_ORDER as string[]).includes(value);
}

/**
 * 从文本中解析五行：优先识别直接出现的五行字（如“白蜡金”“壬水”），
 * 否则按天干地支逐字匹配（如“丁正财”→火）。
 */
export function resolveWuXingElement(text: string | null | undefined): WuXingElement | null {
    if (!text) {
        return null;
    }
    for (const element of WUXING_ORDER) {
        if (text.includes(element)) {
            return element;
        }
    }
    for (const char of text) {
        const element = GAN_ZHI_ELEMENT[char];
        if (element) {
            return element;
        }
    }
    return null;
}

/** 只看单个干支字本身（不受文字里其他五行字影响），用于把“丁正财”拆成“丁”+“正财” */
export function getGanZhiElement(char: string): WuXingElement | null {
    return GAN_ZHI_ELEMENT[char] ?? null;
}

const ELEMENT_TOKEN: Record<WuXingElement, string> = {
    木: 'elementWood', 火: 'elementFire', 土: 'elementEarth', 金: 'elementMetal', 水: 'elementWater',
};

/** 干支字取主题五行色（Colors.bazi.element*），非干支字返回 fallback */
export function getGanZhiColor(char: string, Colors: { bazi: Record<string, any> }, fallback: string): string {
    const element = GAN_ZHI_ELEMENT[char];
    return element ? Colors.bazi[ELEMENT_TOKEN[element]] : fallback;
}
