import { calculateBazi } from '../../core/bazi-calc';
import { extractBaziRelations } from '../../core/bazi-relations';
import { BaziResult } from '../../core/bazi-types';
import {
    buildBaziFiveYearPrompt,
    buildRequestMessages,
    buildBaziSystemMessage,
    buildBaziVerificationPrompt,
    buildBaziVerificationRetryPrompt,
    generateQuickReplies,
    getBaziConversationStage,
    getBaziFoundationPrompt,
    getBaziWorkflowStructureIssues,
    getChatRequestOptions,
    getLocalBaziFoundationActionLabel,
    getLocalBaziVerificationActions,
    sanitizeBaziStreamingContent,
    shouldGeneratePostResponseArtifacts,
    stripBaziStageMarkers,
    validateBaziWorkflowResponse,
} from '../ai';
import { DEFAULT_BAZI_SYSTEM_PROMPT } from '../default-prompts';
import { getSettings } from '../settings';

jest.mock('react-native-sse', () => jest.fn());
jest.mock('../settings', () => ({
    getSettings: jest.fn(),
}));

describe('ai service', () => {
    const mockedGetSettings = getSettings as jest.MockedFunction<typeof getSettings>;
    const baseSettings = {
        apiUrl: 'https://example.com/v1/chat/completions',
        apiKey: 'test-key',
        model: 'gpt-4o',
    };

    function buildSampleResult(): BaziResult {
        return calculateBazi({
            date: new Date(2018, 1, 25, 15, 0, 0),
            gender: 1,
        });
    }

    beforeEach(() => {
        mockedGetSettings.mockResolvedValue(baseSettings as Awaited<ReturnType<typeof getSettings>>);
        global.fetch = jest.fn();
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.clearAllMocks();
    });

    it('builds strict bazi system message from formatted plaintext and relation facts', async () => {
        const result = buildSampleResult();
        const relations = extractBaziRelations(
            result.fourPillars.map((item) => item[0]),
            result.fourPillars.map((item) => item[1]),
        );

        const message = await buildBaziSystemMessage(result, relations);

        expect(message.role).toBe('system');
        expect(message.content).toContain(DEFAULT_BAZI_SYSTEM_PROMPT.slice(0, 20));
        expect(message.content).toContain('禁止自行推演、补算、篡改任何合冲刑害');
        expect(message.content).toContain('工作流顺序固定为：基础定局 → 前事核验 → 未来五年 → 用户追问');
        expect(message.content).toContain('宾主');
        expect(message.content).toContain('【命盘底稿】');
        expect(message.content).toContain('【系统测算的客观关系事实】');
        expect(message.content).toContain('【大运总表】');
        expect(message.content).toContain('【当前流年流月组】');
        expect(message.content).toContain(relations[0]);
    });

    it('clips bazi request context to digest plus the latest ten visible messages', async () => {
        const result = {
            ...buildSampleResult(),
            aiConversationDigest: {
                version: 1,
                generatedAt: '2026-03-07T00:00:00.000Z',
                foundation: {
                    dayMaster: '戊土日主',
                    structure: '偏财格',
                    favorableGod: '火土',
                    unfavorableGod: '木水',
                    personality: '稳中带拗',
                },
                verificationSummary: '前事核验已抓到三处关节点。',
                fiveYearSummary: '未来五年先抑后扬，2028后明显转强。',
                rollingSummary: '已完成基础格局和用忌诊断。',
                topicNotes: {
                    wealth: '财运已初判',
                },
            },
        };
        const chatHistory = [
            { role: 'user' as const, content: '隐藏首问', hidden: true },
            { role: 'assistant' as const, content: 'm0' },
            { role: 'assistant' as const, content: 'm1' },
            { role: 'user' as const, content: 'm2' },
            { role: 'assistant' as const, content: 'm3' },
            { role: 'user' as const, content: 'm4' },
            { role: 'assistant' as const, content: 'm5' },
            { role: 'user' as const, content: 'm6' },
            { role: 'assistant' as const, content: 'm7' },
            { role: 'user' as const, content: 'm8' },
            { role: 'assistant' as const, content: 'm9' },
            { role: 'user' as const, content: 'm10' },
            { role: 'assistant' as const, content: 'm11' },
        ];

        const requestMessages = await buildRequestMessages(result, chatHistory);

        expect(requestMessages).toHaveLength(12);
        expect(requestMessages[0].role).toBe('system');
        expect(requestMessages[1].content).toContain('【既有诊断摘要】');
        expect(requestMessages.map((item) => item.content)).not.toContain('隐藏首问');
        expect(requestMessages.map((item) => item.content)).not.toContain('m0');
        expect(requestMessages.map((item) => item.content)).not.toContain('m1');
        expect(requestMessages.map((item) => item.content)).toContain('m3');
        expect(requestMessages.map((item) => item.content)).toContain('m11');
    });

    it('returns AI generated bazi quick replies without emoji', async () => {
        const result = buildSampleResult();
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => ({
                choices: [{
                    message: {
                        content: '细看今明两年财运\n分析本局婚姻桃花\n这步大运学业事业',
                    },
                }],
            }),
        });

        const replies = await generateQuickReplies(result, [
            { role: 'assistant', content: '已完成基础诊断' },
        ]);

        expect(replies).toEqual([
            '细看今明两年财运',
            '分析本局婚姻桃花',
            '这步大运学业事业',
        ]);
    });

    it('falls back when generated quick replies contain emoji or invalid format', async () => {
        const result = buildSampleResult();
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => ({
                choices: [{
                    message: {
                        content: '1. 细看今明两年财运\n💔 分析本局婚姻桃花\n这步大运学业事业',
                    },
                }],
            }),
        });

        const replies = await generateQuickReplies(result, [
            { role: 'assistant', content: '已完成基础诊断' },
        ]);

        expect(replies).toEqual([
            '细看未来五年财运',
            '未来哪年感情波动大',
            '未来五年事业发力点',
        ]);
    });

    it('uses expanded token budgets for bazi initial and follow-up phases', () => {
        const result = buildSampleResult();

        expect(getChatRequestOptions(result, 'initial')).toEqual({ temperature: 0.3, maxTokens: 3200 });
        expect(getChatRequestOptions(result, 'followup')).toEqual({ temperature: 0.4, maxTokens: 3600 });
    });

    it('uses stage-specific prompts for foundation, verification, and five-year reading', () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-03-07T12:00:00+08:00'));

        const foundationPrompt = getBaziFoundationPrompt();
        const verificationPrompt = buildBaziVerificationPrompt();
        const fiveYearPrompt = buildBaziFiveYearPrompt(buildSampleResult());

        expect(foundationPrompt).toContain('当前只执行八字工作流的第一阶段：基础定局');
        expect(foundationPrompt).toContain('[[BAZI_STAGE:FOUNDATION_DONE]]');
        expect(foundationPrompt).toContain('不允许输出前事核验');
        expect(verificationPrompt).toContain('现在开始八字工作流第二阶段：前事核验');
        expect(verificationPrompt).toContain('[[BAZI_STAGE:VERIFICATION_DONE]]');
        expect(fiveYearPrompt).toContain('当前开始八字工作流第三阶段：未来五年解盘');
        expect(fiveYearPrompt).toContain('当前设备本地日期是 2026-03-07，今年是 2026 年');
        expect(fiveYearPrompt).toContain('先单独分析今年（2026 年）的运势，再分析未来五年（2027-2031 年）的运势');
        expect(fiveYearPrompt).toContain('不能把它并入未来五年');
        expect(fiveYearPrompt).toContain('[[BAZI_STAGE:FIVE_YEAR_DONE]]');

        jest.useRealTimers();
    });

    it('controls artifact generation by bazi verification stage', () => {
        const baziResult = buildSampleResult();
        const liuyaoLikeResult = {
            id: 'pan-1',
            createdAt: '2026-03-07T00:00:00.000Z',
            method: 'time',
            question: 'test',
            benGua: { fullName: '乾为天', gong: '乾', shiYao: 6, yingYao: 3 },
            benGuaYao: [],
            movingYaoPositions: [],
            solarDate: '2026-03-07',
            solarTime: '12:00',
            lunarInfo: { lunarMonthCN: '正月', lunarDayCN: '初一', hourZhi: '子', day: 1 },
            jieqi: { current: '惊蛰', currentDate: '2026-03-05', next: '春分', nextDate: '2026-03-20' },
            yearGanZhi: '甲子',
            monthGanZhi: '丙寅',
            dayGanZhi: '戊辰',
            hourGanZhi: '庚申',
            yearNaYin: '海中金',
            monthNaYin: '炉中火',
            dayNaYin: '大林木',
            hourNaYin: '石榴木',
            xunKong: ['戌', '亥'],
            shenSha: { yiMa: '', taoHua: '', tianYiGuiRen: [], luShen: '', yangRen: '', wenChang: '', jiangXing: '', huaGai: '', jieSha: '', zaiSha: '' },
            rawYaoValues: [],
        } as any;

        expect(shouldGeneratePostResponseArtifacts(baziResult, 'foundation_ready')).toBe(false);
        expect(shouldGeneratePostResponseArtifacts(baziResult, 'verification_ready')).toBe(false);
        expect(shouldGeneratePostResponseArtifacts(baziResult, 'followup_ready')).toBe(true);
        expect(shouldGeneratePostResponseArtifacts(liuyaoLikeResult, 'initial')).toBe(true);
    });

    it('exposes local bazi verification actions and stage prompts', () => {
        expect(getLocalBaziFoundationActionLabel()).toBe('开始前事核验');
        expect(getLocalBaziVerificationActions()).toEqual([
            '前事较准，继续深解',
            '前事偏差，重新校验',
        ]);
        expect(buildBaziVerificationRetryPrompt()).toContain('重新开始当前阶段');
    });

    it('sanitizes streaming content and validates explicit stage markers', () => {
        expect(sanitizeBaziStreamingContent('基础定局正文\n[[BAZI_STAGE:FOUND')).toBe('基础定局正文');
        expect(stripBaziStageMarkers('基础定局正文\n[[BAZI_STAGE:FOUNDATION_DONE]]')).toBe('基础定局正文');

        const foundationValidation = validateBaziWorkflowResponse(
            'foundation',
            '基础定局\n1. 日主旺衰：偏弱。\n2. 格局：财官并见。\n3. 用神忌神：喜火土，忌木水。\n[[BAZI_STAGE:FOUNDATION_DONE]]',
            buildSampleResult(),
        );
        expect(foundationValidation.success).toBe(true);
        expect(foundationValidation.cleanContent).toContain('基础定局');

        const verificationValidation = validateBaziWorkflowResponse(
            'verification',
            '前事核验\n1. 2018年 学业转折，流年引动。\n2. 2020年 工作变化，大运承压。\n3. 2023年 感情波动，合冲明显。\n[[BAZI_STAGE:FOUNDATION_DONE]]',
            buildSampleResult(),
        );
        expect(verificationValidation.success).toBe(false);
        expect(verificationValidation.issues[0]).toContain('缺少完成标记');
    });

    it('applies minimal structure checks after marker validation', () => {
        expect(
            getBaziWorkflowStructureIssues(
                'verification',
                '前事核验\n1. 2018年 学业转折，流年引动。\n2. 2020年 工作变化，大运承压。\n3. 2023年 感情波动，合冲明显。',
            ),
        ).toEqual([]);

        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-03-07T12:00:00+08:00'));
        expect(
            getBaziWorkflowStructureIssues(
                'five_year',
                '今年与未来五年总览\n1. 2026年 先守后攻。\n2. 2027年 财运起色。\n3. 2028年 事业抬升。\n4. 2029年 感情有变。\n5. 2030年 节奏转稳。\n6. 2031年 方向定型。',
                buildSampleResult(),
            ),
        ).toEqual([]);
        jest.useRealTimers();
    });

    it('infers workflow stage from legacy bazi chats and keeps fresh charts at initial stage', () => {
        expect(getBaziConversationStage(buildSampleResult())).toBe('foundation_pending');
        expect(getBaziConversationStage({
            ...buildSampleResult(),
            aiChatHistory: [{ role: 'assistant', content: '旧版基础解盘' }],
        })).toBe('foundation_ready');
        expect(getBaziConversationStage({
            ...buildSampleResult(),
            aiChatHistory: [{ role: 'assistant', content: '前事核验\n1. 2018...\n[[BAZI_STAGE:VERIFICATION_DONE]]' }],
        })).toBe('verification_ready');
        expect(getBaziConversationStage({
            ...buildSampleResult(),
            aiChatHistory: [
                { role: 'assistant', content: '旧版基础解盘' },
                { role: 'user', content: '继续看婚恋' },
                { role: 'assistant', content: '婚恋已继续展开' },
            ],
        })).toBe('followup_ready');
    });

});
