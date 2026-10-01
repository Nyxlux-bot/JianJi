import type { AIChatMessage } from '../../../services/ai';
import type { BaziCompatibilityResult } from './types';
import { formatBaziMatchForAI } from './formatter';
import { composeSkillInstructions, renderSkillRequest } from '../../../ai/skill-composer';

export function buildBaziMatchAIMessages(result: BaziCompatibilityResult): AIChatMessage[] {
    return [
        { role: 'system', content: composeSkillInstructions('baziCompatibility', 'initial') },
        {
            role: 'user',
            content: renderSkillRequest('baziCompatibility', 'initial', { evidence: formatBaziMatchForAI(result) }),
        },
    ];
}

export function validateBaziMatchAIContent(content: string): string[] {
    const requiredSections = [
        '合婚总断',
        '最合之处',
        '最大冲突',
        '能不能成',
        '婚后相处',
        '婚期应期',
        '一句话取法',
    ];
    return requiredSections
        .filter((section) => !content.includes(section))
        .map((section) => `缺少${section}`);
}
