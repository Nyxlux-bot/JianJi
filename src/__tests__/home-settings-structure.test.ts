import fs from 'node:fs';
import path from 'node:path';

describe('home/settings structure', () => {
    const homePath = path.resolve(__dirname, '../../app/(tabs)/index.tsx');
    const settingsPath = path.resolve(__dirname, '../../app/(tabs)/settings.tsx');

    it('removes hidden AI config modal and easter egg from home page', () => {
        const content = fs.readFileSync(homePath, 'utf8');

        expect(content).toContain('六爻易数');
        expect(content).toContain('八字命理');
        expect(content).not.toContain('unlockAISettings');
        expect(content).not.toContain('lockAISettings');
        expect(content).not.toContain('aiModalVisible');
        expect(content).not.toContain('handleLogoPress');
        expect(content).not.toContain('fetchModels');
    });

    it('keeps only explicit AI interface settings without prompt editing UI', () => {
        const content = fs.readFileSync(settingsPath, 'utf8');

        expect(content).toContain('AI 配置');
        expect(content).toContain('提示词已固定为内建版本');
        expect(content).not.toContain('六爻 Prompt');
        expect(content).not.toContain('八字 Prompt');
        expect(content).not.toContain('恢复默认');
    });
});
