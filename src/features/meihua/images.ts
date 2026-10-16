/** 八卦类象，取自《周易·说卦传》：卦德一项，余为天象、人伦、身体与常用物象。 */
export const TRIGRAM_IMAGE_SOURCE = '《周易·说卦传》';

export const TRIGRAM_IMAGES: Record<string, { virtue: string; items: string[] }> = {
    乾: { virtue: '健', items: ['天', '父', '君', '首', '马', '金玉'] },
    兑: { virtue: '说', items: ['泽', '少女', '口', '口舌', '羊', '毁折'] },
    离: { virtue: '丽', items: ['火', '日', '中女', '目', '雉', '甲胄戈兵'] },
    震: { virtue: '动', items: ['雷', '长子', '足', '龙', '大涂', '决躁'] },
    巽: { virtue: '入', items: ['风', '木', '长女', '股', '工', '进退不果'] },
    坎: { virtue: '陷', items: ['水', '中男', '耳', '豕', '隐伏', '加忧'] },
    艮: { virtue: '止', items: ['山', '少男', '手', '狗', '门阙', '径路'] },
    坤: { virtue: '顺', items: ['地', '母', '腹', '牛', '众', '布釜'] },
};

export function getTrigramImages(name: string): string[] {
    const image = TRIGRAM_IMAGES[name];
    return image ? [image.virtue, ...image.items] : [];
}
