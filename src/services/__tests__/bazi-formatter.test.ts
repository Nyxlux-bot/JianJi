import { calculateBazi } from '../../core/bazi-calc';
import { extractBaziRelations } from '../../core/bazi-relations';
import { formatBaziToText } from '../bazi-formatter';

describe('bazi formatter', () => {
    it('serializes bazi result into standardized plaintext sections', () => {
        const result = calculateBazi({
            date: new Date(2018, 1, 25, 15, 0, 0),
            gender: 1,
        });
        const relations = extractBaziRelations(
            result.fourPillars.map((item) => item[0]),
            result.fourPillars.map((item) => item[1]),
        );

        const text = formatBaziToText(result, relations);

        expect(text).toContain('【命主信息】');
        expect(text).toContain('【精确排盘】');
        expect(text).toContain('【命盘附加要点】');
        expect(text).toContain('【系统测算的客观关系事实】');
        expect(text).toContain('【大运总表】');
        expect(text).toContain('【当前流年流月组】');
        expect(text).toContain('【当前查看的专业细盘焦点】');
        expect(text).toContain('年柱：[');
        expect(text).toContain('月柱：[');
        expect(text).toContain('日柱：[');
        expect(text).toContain('时柱：[');
        expect(text).toContain('胎元：');
        expect(text).toContain('命宫：');
        expect(text).toContain('身宫：');
        expect(text).toContain('空亡：');
        expect(text).toContain('命卦：');
        expect(text).toContain(result.fourPillars[0]);
        expect(text).toContain(result.fourPillars[1]);
        expect(text).toContain(result.fourPillars[2]);
        expect(text).toContain(result.fourPillars[3]);
        expect(text).not.toContain('"fourPillars"');
        expect(text.trim().startsWith('{')).toBe(false);
    });

    it('falls back gracefully when current fortune year is unavailable', () => {
        const result = calculateBazi({
            date: new Date(1990, 5, 15, 12, 30, 0),
            gender: 1,
        });

        const text = formatBaziToText(result, []);

        expect(text).toContain('未检测到客观合冲刑害关系');
        expect(text).toContain('当前大运：尚未进入首步大运');
    });

    it('includes the selected professional chart focus when context is provided', () => {
        const result = calculateBazi({
            date: new Date(2018, 1, 25, 15, 0, 0),
            gender: 1,
        });

        const text = formatBaziToText(result, [], {
            panelMode: 'fortune',
            fortuneSelection: {
                mode: 'dayun',
                selectedDaYunIndex: 0,
                selectedXiaoYunIndex: 0,
                selectedLiuNianIndex: 0,
                selectedLiuYueIndex: 0,
            },
        });

        expect(text).toContain('当前面板：流年大运');
        expect(text).toContain('当前查看大运：');
        expect(text).toContain('当前查看流年：');
        expect(text).toContain('当前查看流月：');
    });
});
