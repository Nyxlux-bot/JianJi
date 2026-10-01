import type { AIChatMessage } from '../../../services/ai';
import type { BaziCompatibilityResult } from './types';
import { formatBaziMatchForAI } from './formatter';
import { composeSkillInstructions, renderSkillRequest } from '../../../ai/skill-composer';
import { renderCompatFormat } from '../../../ai/output-contracts';

export function buildBaziMatchAIMessages(result: BaziCompatibilityResult): AIChatMessage[] {
    return [
        { role: 'system', content: composeSkillInstructions('baziCompatibility', 'initial') },
        {
            role: 'user',
            content: renderSkillRequest('baziCompatibility', 'initial', { outputFormat: renderCompatFormat(), evidence: formatBaziMatchForAI(result) }),
        },
    ];
}

/** Completeness only: the layout reads sections when present and shows the rest as text. */
export function validateBaziMatchAIContent(content: string): string[] {
    return content.trim().length >= 200 ? [] : ['合盘详批正文过短，可能没有写完'];
}
