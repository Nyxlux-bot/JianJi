import {
    evaluateBaziRelationInteractions,
    extractBaziRelations,
} from '../bazi-relations';

describe('bazi-relations', () => {
    it('validates pillar array length and member values', () => {
        expect(() => extractBaziRelations(['甲'], ['子', '丑', '寅', '卯'])).toThrow('天干数组长度必须为4');
        expect(() => extractBaziRelations(['甲', '乙', '丙', '丁'], ['子', '丑'])).toThrow('地支数组长度必须为4');
        expect(() => extractBaziRelations(['甲', '乙', '丙', '猫'], ['子', '丑', '寅', '卯'])).toThrow('无效天干: 猫');
        expect(() => extractBaziRelations(['甲', '乙', '丙', '丁'], ['子', '丑', '寅', '猫'])).toThrow('无效地支: 猫');
    });

    it('extracts ordered trio, stem, and branch facts', () => {
        expect(extractBaziRelations(
            ['甲', '己', '丙', '庚'],
            ['申', '子', '辰', '午'],
        )).toEqual([
            '年/月/日地支构成申子辰三合水局',
            '年柱与月柱天干甲己五合',
            '年柱与时柱天干甲庚相冲',
            '月柱与时柱地支子午六冲',
        ]);
    });

    it('keeps 午未 as neutral 六合 fact text', () => {
        const facts = extractBaziRelations(
            ['甲', '丁', '戊', '辛'],
            ['寅', '午', '未', '酉'],
        );

        expect(facts).toContain('月柱与日柱地支午未六合');
        expect(facts.join('|')).not.toContain('合土');
        expect(facts.join('|')).not.toContain('合日月');
    });

    it('extracts pair xing and full trio xing summary separately', () => {
        const facts = extractBaziRelations(
            ['甲', '丙', '戊', '壬'],
            ['寅', '巳', '申', '辰'],
        );

        expect(facts).toContain('年柱与月柱地支寅巳相刑（无恩之刑）');
        expect(facts).toContain('年柱与日柱地支寅申相刑（无恩之刑）');
        expect(facts).toContain('月柱与日柱地支巳申相刑（无恩之刑）');
        expect(facts).toContain('年/月/日地支齐见寅巳申，构成无恩之刑');
        expect(facts.indexOf('年/月/日地支齐见寅巳申，构成无恩之刑')).toBeGreaterThan(
            facts.indexOf('月柱与日柱地支巳申相刑（无恩之刑）'),
        );
    });

    it('counts duplicate self-xing branches only once per branch', () => {
        expect(extractBaziRelations(
            ['甲', '乙', '丙', '丁'],
            ['辰', '午', '辰', '辰'],
        )).toEqual([
            '年/日/时柱地支同见辰，构成辰自刑',
        ]);
    });

    it('marks fully supported relations as supported without conflict', () => {
        const evaluations = evaluateBaziRelationInteractions(
            ['甲', '己', '丙', '戊'],
            ['子', '寅', '辰', '申'],
            { visibleStems: ['戊'] },
        );
        const ganHe = evaluations.find((item) => item.fact === '年柱与月柱天干甲己五合');

        expect(ganHe).toBeDefined();
        expect(ganHe?.state).toBe('supported');
        expect(ganHe?.reasons.join(' ')).toContain('扶助土气');
    });

    it('marks unsupported he relations as constrained when clash overlaps', () => {
        const evaluations = evaluateBaziRelationInteractions(
            ['甲', '己', '庚', '丙'],
            ['申', '子', '辰', '午'],
        );
        const he = evaluations.find((item) => item.fact === '年柱与月柱天干甲己五合');

        expect(he).toBeDefined();
        expect(he?.state).toBe('constrained');
        expect(he?.reasons.join(' ')).toContain('合而未化');
    });

    it('marks supported he relations and clashes as coexist/constrained', () => {
        const evaluations = evaluateBaziRelationInteractions(
            ['甲', '己', '庚', '戊'],
            ['寅', '午', '子', '辰'],
            { visibleStems: ['戊'] },
        );
        const he = evaluations.find((item) => item.fact === '年柱与月柱天干甲己五合');
        const chong = evaluations.find((item) => item.fact === '年柱与日柱天干甲庚相冲');

        expect(he).toBeDefined();
        expect(chong).toBeDefined();
        expect(he?.state).toBe('coexists');
        expect(chong?.state).toBe('constrained');
        expect(he?.relatedFacts).toContain('年柱与日柱天干甲庚相冲');
        expect(chong?.reasons.join(' ')).toContain('牵制');
    });

    it('lets a supported sanhe constrain a partial clash while preserving both facts', () => {
        const evaluations = evaluateBaziRelationInteractions(
            ['甲', '丁', '戊', '辛'],
            ['申', '子', '辰', '午'],
            { visibleStems: ['壬'] },
        );
        const sanHe = evaluations.find((item) => item.fact === '年/月/日地支构成申子辰三合水局');
        const chong = evaluations.find((item) => item.fact === '月柱与时柱地支子午六冲');

        expect(sanHe).toBeDefined();
        expect(chong).toBeDefined();
        expect(sanHe?.state).toBe('coexists');
        expect(chong?.state).toBe('constrained');
        expect(chong?.reasons.join(' ')).toContain('牵制');
    });
});
