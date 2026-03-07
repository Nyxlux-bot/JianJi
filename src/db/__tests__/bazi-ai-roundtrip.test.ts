jest.mock('react-native', () => ({
    Platform: { OS: 'web' },
}));

import { calculateBazi } from '../../core/bazi-calc';
import { BaziResult } from '../../core/bazi-types';
import { normalizeBaziResultV2 } from '../../core/bazi-normalize';
import { getRecord, saveRecord } from '../database';

describe('bazi ai metadata roundtrip', () => {
    const store = new Map<string, string>();

    beforeEach(() => {
        store.clear();
        Object.defineProperty(global, 'localStorage', {
            value: {
                getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
                setItem: (key: string, value: string) => {
                    store.set(key, value);
                },
                removeItem: (key: string) => {
                    store.delete(key);
                },
            },
            configurable: true,
        });
    });

    it('preserves ai history, quick replies and digest across normalize and database save/load', async () => {
        const base = calculateBazi({
            date: new Date(2001, 2, 7, 15, 40, 0),
            gender: 1,
            longitude: 116.41,
            schoolOptions: { timeMode: 'true_solar_time' },
        });

        const enriched: BaziResult = normalizeBaziResultV2({
            ...base,
            aiChatHistory: [
                { role: 'user', content: '自动首问', hidden: true, requestContent: '请先做基础定局' },
                { role: 'assistant', content: '基础诊断完成' },
            ],
            quickReplies: ['细看今明两年财运', '分析本局婚姻桃花'],
            aiConversationStage: 'verification_ready',
            aiVerificationSummary: '前事核验已抓到 3 个关键节点。',
            aiConversationDigest: {
                version: 1,
                generatedAt: '2026-03-07T00:00:00.000Z',
                foundation: {
                    dayMaster: '己土日主',
                    structure: '财官并见',
                    favorableGod: '火土',
                    unfavorableGod: '木水',
                    personality: '稳重细腻',
                },
                verificationSummary: '前事核验已抓到 3 个关键节点。',
                fiveYearSummary: '未来五年财运先扬后稳。',
                rollingSummary: '已完成基础结构判断。',
                topicNotes: {
                    wealth: '财运先看岁运扶抑',
                },
            },
        });

        expect(normalizeBaziResultV2(enriched).aiChatHistory?.[0].hidden).toBe(true);
        expect(normalizeBaziResultV2(enriched).aiConversationDigest?.foundation.structure).toBe('财官并见');
        expect(normalizeBaziResultV2(enriched).aiConversationStage).toBe('verification_ready');

        await saveRecord({
            engineType: 'bazi',
            result: enriched,
        });

        const detail = await getRecord(enriched.id);
        expect(detail?.engineType).toBe('bazi');

        const loaded = detail?.result as BaziResult;
        expect(loaded.aiChatHistory?.[0]).toEqual({
            role: 'user',
            content: '自动首问',
            hidden: true,
            requestContent: '请先做基础定局',
        });
        expect(loaded.quickReplies).toEqual(['细看今明两年财运', '分析本局婚姻桃花']);
        expect(loaded.aiConversationStage).toBe('verification_ready');
        expect(loaded.aiVerificationSummary).toBe('前事核验已抓到 3 个关键节点。');
        expect(loaded.aiConversationDigest?.rollingSummary).toBe('已完成基础结构判断。');
    });
});
