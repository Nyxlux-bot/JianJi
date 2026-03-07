import { calculateBazi } from '../../../core/bazi-calc';
import { buildBaziProChartViewModel, getInitialFortuneSelection } from '../view-model';

describe('bazi pro chart view-model', () => {
    it('supports clickable xiaoyun mode before jiaoyun', () => {
        const result = calculateBazi({
            date: new Date(2001, 2, 7, 15, 40, 0),
            gender: 0,
            longitude: 116.41,
            referenceDate: new Date(2001, 5, 1, 12, 0, 0),
            schoolOptions: { timeMode: 'true_solar_time' },
        });

        const selection = getInitialFortuneSelection(result);
        const viewModel = buildBaziProChartViewModel(result, selection);

        expect(selection.mode).toBe('xiaoyun');
        expect(viewModel.daYunTrack[0].trackKind).toBe('xiaoyun');
        expect(viewModel.daYunTrack[0].selectable).toBe(true);
        expect(viewModel.liuNianTrack.length).toBe(result.xiaoYun.length);
        expect(viewModel.fortuneColumns[1].ganZhi).toBe(result.xiaoYun[selection.selectedXiaoYunIndex].xiaoYunGanZhi);
        expect(viewModel.liuYueTrack.length).toBe(result.xiaoYun[selection.selectedXiaoYunIndex].liuYue.length);
    });

    it('keeps decade mode linked to selected dayun after jiaoyun', () => {
        const result = calculateBazi({
            date: new Date(2001, 11, 8, 17, 41, 0),
            gender: 1,
            longitude: 116.68,
            referenceDate: new Date(2026, 2, 6, 12, 0, 0),
            schoolOptions: { timeMode: 'true_solar_time' },
        });

        const selection = getInitialFortuneSelection(result);
        const viewModel = buildBaziProChartViewModel(result, selection);
        const selectedDaYun = result.daYun[selection.selectedDaYunIndex];

        expect(selection.mode).toBe('dayun');
        expect(viewModel.header.name).toBe(result.subject.name);
        expect(viewModel.header.solarHeaderText).toContain('阳历：');
        expect(viewModel.header.lunarHeaderText).toContain('农历：');
        expect(viewModel.header.mingZaoText).toBe('乾造');
        expect(viewModel.liuNianTrack.length).toBe(selectedDaYun.liuNian.length);
        expect(viewModel.infoStrip.startText).toContain('分起运');
        expect(viewModel.infoStrip.changeText).toContain('逢');
        expect(viewModel.infoStrip.changeText).toContain('交大运');
        expect(viewModel.infoStrip.ageText).toContain('当前年龄');
        expect(viewModel.infoStrip.renYuanShortText).toBe('壬');
        expect(viewModel.fortuneRows.some((row) => row.key === 'subStar')).toBe(false);
        expect(viewModel.taimingColumns.map((column) => column.label)).toEqual(['身宫', '命宫', '胎元', '年柱', '月柱', '日柱', '时柱']);
        expect(viewModel.shenShaSections).toHaveLength(4);
    });

    it('keeps top matrix shensha fully expanded and star rows single line', () => {
        const result = calculateBazi({
            date: new Date(2001, 11, 8, 17, 41, 0),
            gender: 1,
            longitude: 116.68,
            referenceDate: new Date(2026, 2, 6, 12, 0, 0),
            schoolOptions: { timeMode: 'true_solar_time' },
        });

        const selection = getInitialFortuneSelection(result);
        const viewModel = buildBaziProChartViewModel(result, selection);
        const mainStarRow = viewModel.fortuneRows.find((row) => row.key === 'mainStar');
        const cangGanRow = viewModel.fortuneRows.find((row) => row.key === 'cangGan');
        const shenShaRow = viewModel.fortuneRows.find((row) => row.key === 'shenSha');
        const yearColumnStarCount = viewModel.fortuneColumns[2].shenSha.length;

        expect(mainStarRow?.cells.every((cell) => cell.secondary === undefined)).toBe(true);
        expect(cangGanRow?.cells[2].lines?.some((line) => line.includes('伤官') || line.includes('正官') || line.includes('正财'))).toBe(true);
        expect((shenShaRow?.cells[2].lines?.length ?? 0)).toBe(yearColumnStarCount);
        expect(shenShaRow?.cells.every((cell) => cell.lines && cell.lines.length > 0)).toBe(true);
        expect(viewModel.taimingRows.find((row) => row.key === 'shenSha')?.cells[0].lines?.length).toBeGreaterThan(0);
    });

    it('keeps duty strip and wuxing band fixed when selected liuyue changes', () => {
        const result = calculateBazi({
            date: new Date(2001, 11, 8, 17, 41, 0),
            gender: 1,
            longitude: 116.68,
            referenceDate: new Date(2026, 2, 6, 12, 0, 0),
            schoolOptions: { timeMode: 'true_solar_time' },
        });

        const selection = getInitialFortuneSelection(result);
        const baseView = buildBaziProChartViewModel(result, selection);
        const changedView = buildBaziProChartViewModel(result, {
            ...selection,
            selectedLiuYueIndex: Math.min(selection.selectedLiuYueIndex + 1, baseView.liuYueTrack.length - 1),
        });

        expect(changedView.infoStrip.renYuanShortText).toBe(baseView.infoStrip.renYuanShortText);
        expect(changedView.infoStrip.qiYunBand).toEqual(baseView.infoStrip.qiYunBand);
    });
});
