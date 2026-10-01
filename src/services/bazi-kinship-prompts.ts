import { renderSkillRequest } from '../ai/skill-composer';
import { KINSHIP_PREDICTION_OUTPUT } from '../ai/output-contracts';

export function buildBaziKinshipPrompt(): string {
    return renderSkillRequest('bazi', 'kinship', {
        outputContract: JSON.stringify(KINSHIP_PREDICTION_OUTPUT),
    }, 2);
}
