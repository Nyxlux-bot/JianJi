import type { AISkillVersion } from '../core/ai-execution-meta';
import { AI_SKILLS, COMMON_SKILL, SKILL_REFERENCES, type AISkillEngine, type AISkillStage } from './skill-registry';

type SkillVariables = Readonly<Record<string, string | number>>;

function render(text: string, variables: SkillVariables): string {
    return text.replace(/\{\{([A-Za-z][A-Za-z0-9]*)\}\}/g, (_, name: string) => {
        if (!(name in variables)) throw new Error(`Skill 缺少参数：${name}`);
        return String(variables[name]);
    });
}

function assertStage(engine: AISkillEngine, stage: AISkillStage, workflowVersion: 1 | 2): void {
    if (!AI_SKILLS[engine].requests[stage]) throw new Error(`Skill 不支持当前业务阶段：${engine}/${stage}`);
    if (stage === 'kinship' && workflowVersion !== 2) throw new Error('旧版会话不加载六亲 Skill');
}

export function getSkillVersions(engine: AISkillEngine, stage: AISkillStage, workflowVersion: 1 | 2 = 1): AISkillVersion[] {
    assertStage(engine, stage, workflowVersion);
    return [COMMON_SKILL, AI_SKILLS[engine]].map(({ id, version }) => ({ id, version }));
}

export function renderSkillRequest(engine: AISkillEngine | 'common', stage: AISkillStage, variables: SkillVariables = {}, workflowVersion: 1 | 2 = 1): string {
    if (engine !== 'common') assertStage(engine, stage, workflowVersion);
    const skill = engine === 'common' ? COMMON_SKILL : AI_SKILLS[engine];
    const template = skill.requests[stage];
    if (!template) throw new Error(`Skill 缺少阶段资源：${engine}/${stage}`);
    const boundary = stage === 'kinship' ? SKILL_REFERENCES.baziKinshipBoundary + '\n\n' : '';
    return render(boundary + template, variables);
}

/** Compose stable domain instructions. Stage prompts remain request-scoped so missing runtime variables cannot leak into system text. */
export function composeSkillInstructions(engine: AISkillEngine, stage: AISkillStage, variables: SkillVariables = {}, workflowVersion: 1 | 2 = 1): string {
    assertStage(engine, stage, workflowVersion);
    // Auxiliary requests have their own output contract and no chart workflow
    // variables. Loading the main Bazi template here throws before sending.
    if (stage === 'digest' || stage === 'quick_replies') {
        return [COMMON_SKILL.instructions, COMMON_SKILL.system].filter(Boolean).join('\n\n');
    }
    const skill = AI_SKILLS[engine];
    const parts = [COMMON_SKILL.instructions, skill.instructions];
    if (stage !== 'kinship') {
        parts.push('分析正文直接从正式 Markdown 标题开始，不输出前置自言自语。');
        parts.push('正文要分段：一段只讲一层意思，约 2-4 句、不超过 150 字，段与段之间空一行；一节内容较多时拆成几段，不要整节写成一大段。不用斜体和行内代码。');
    }
    if (skill.system) parts.push(render(skill.system, { ...variables, stage, workflowVersion }));
    if (engine === 'bazi') {
        const methods = stage === 'kinship'
            ? SKILL_REFERENCES.baziKinshipMethods : SKILL_REFERENCES.baziEvidenceMethods;
        parts.push(SKILL_REFERENCES.baziEvidenceFormat, methods);
    }
    if (engine === 'liuyao' && variables.completionMarker !== undefined) parts.push(render(SKILL_REFERENCES.liuyaoCompletion, variables));
    return parts.filter(Boolean).join('\n\n');
}
