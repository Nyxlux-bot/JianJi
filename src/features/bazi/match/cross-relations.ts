/**
 * 两盘地支之间的关系，取最显著的一种（六合、冲、半合、刑、害、破）。
 */
import {
    ZHI_BAN_HE,
    ZHI_CHONG,
    ZHI_HAI,
    ZHI_LIU_HE,
    ZHI_PO,
    ZHI_XING_SELF,
    getDictPairEntry,
    getPairKey,
    isZhiXingPair,
} from '../../../core/bazi-relation-rules';

export interface BranchPairRelation {
    tag: '合' | '冲' | '刑' | '害' | '破';
    name: string;
    tone: 'pos' | 'neg';
}

export function classifyBranchPair(a: string, b: string): BranchPairRelation | null {
    const liuHe = getDictPairEntry(a, b, ZHI_LIU_HE);
    if (liuHe) return { tag: '合', name: `${a}${b}六合${liuHe[1]}`, tone: 'pos' };
    if (getPairKey(a, b, ZHI_CHONG)) return { tag: '冲', name: `${a}${b}相冲`, tone: 'neg' };
    const banHe = getDictPairEntry(a, b, ZHI_BAN_HE);
    if (banHe) return { tag: '合', name: `${a}${b}半合${banHe[1]}`, tone: 'pos' };
    if (a === b ? (ZHI_XING_SELF as readonly string[]).includes(a) : isZhiXingPair(a, b)) {
        return { tag: '刑', name: a === b ? `${a}${b}自刑` : `${a}${b}相刑`, tone: 'neg' };
    }
    if (getPairKey(a, b, ZHI_HAI)) return { tag: '害', name: `${a}${b}相害`, tone: 'neg' };
    if (getPairKey(a, b, ZHI_PO)) return { tag: '破', name: `${a}${b}相破`, tone: 'neg' };
    return null;
}
