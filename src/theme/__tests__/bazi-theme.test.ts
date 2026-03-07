import fs from 'node:fs';
import path from 'node:path';
import { Colors } from '../colors';
import { GreenColors } from '../colors-green';
import { PurpleColors } from '../colors-purple';
import { WhiteColors } from '../colors-white';

const THEMES = [Colors, GreenColors, WhiteColors, PurpleColors];

describe('bazi theme tokens', () => {
    it('provides bazi semantic tokens for every theme', () => {
        THEMES.forEach((theme) => {
            expect(theme.bazi.chromeBg).toBeTruthy();
            expect(theme.bazi.chromeBorder).toBeTruthy();
            expect(theme.bazi.heroBg).toBeTruthy();
            expect(theme.bazi.actionBg).toBeTruthy();
            expect(theme.bazi.infoBandBg).toBeTruthy();
            expect(theme.bazi.warningBg).toBeTruthy();
            expect(theme.bazi.trackActiveBorder).toBeTruthy();
        });
    });

    it('keeps key bazi theme tokens visually distinct across all themes', () => {
        expect(new Set(THEMES.map((theme) => theme.bazi.infoBandBg)).size).toBe(THEMES.length);
        expect(new Set(THEMES.map((theme) => theme.bazi.chromeTextActive)).size).toBe(THEMES.length);
        expect(new Set(THEMES.map((theme) => theme.bazi.actionBgActive)).size).toBe(THEMES.length);
        expect(new Set(THEMES.map((theme) => theme.bazi.trackActiveBorder)).size).toBe(THEMES.length);
    });

    it('does not regress result page back to hard-coded gold accents', () => {
        const filePath = path.resolve(__dirname, '../../../app/bazi/result/[id].tsx');
        const content = fs.readFileSync(filePath, 'utf8');

        expect(content).not.toContain('Colors.accent.gold');
        expect(content).not.toMatch(/#060708|#0B0A09|#D7B26A|#B9964A/);
        expect(content).not.toMatch(/rgba\(215,178,106|rgba\(255,246,223|rgba\(198,77,62/);
    });
});
