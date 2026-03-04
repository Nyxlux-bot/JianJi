/**
 * AI 分析服务
 * 调用 OpenAI 兼容接口进行六爻卦象分析
 */

import { PanResult, YaoDetail } from '../core/liuyao-calc';
import { BA_GUA, DIZHI_WUXING } from '../core/liuyao-data';
import { getSettings } from './settings';
import EventSource from 'react-native-sse';
import { getAllRelatedGua } from '../core/hexagramTransform';
import ichingData from '../data/iching.json';
import { getMonthGeneralByJieqi, getMoonPhase } from '../core/time-signs';

const ICHING_MAP = new Map<string, string>();
(ichingData as any[]).forEach(d => {
    ICHING_MAP.set(d.array.join(''), d.name);
});

/**
 * 根据卦宫名获取卦宫五行
 */
function getGongWuXing(gongName: string): string {
    const gua = Object.values(BA_GUA).find(g => g.name === gongName);
    return gua ? gua.wuxing : '';
}

/**
 * 将排盘结果序列化为文本描述，作为 AI 输入
 * 包含完整的排盘信息：四柱、日月建、本卦/变卦六爻、真太阳时等
 */
function formatPanForAI(result: PanResult): string {
    const lines: string[] = [];
    const monthGeneral = result.monthGeneral || getMonthGeneralByJieqi(result.jieqi?.current || '', result.monthGanZhi?.[1]);
    const createdAtDate = new Date(result.createdAt);
    const moonPhaseDate = Number.isNaN(createdAtDate.getTime()) ? new Date() : createdAtDate;
    const moonPhase = getMoonPhase(moonPhaseDate, result.lunarInfo?.day);

    // ===== 排盘信息 =====
    lines.push(`【排盘信息】`);
    lines.push(`公历：${result.solarDate} ${result.solarTime}`);
    if (result.trueSolarTime) {
        lines.push(`真太阳时：${result.trueSolarTime}` +
            (result.location ? `（${result.location}，经度${result.longitude?.toFixed(2)}°）` : ''));
    }
    lines.push(`农历：${result.lunarInfo.lunarMonthCN}${result.lunarInfo.lunarDayCN} ${result.lunarInfo.hourZhi}时`);
    lines.push(`节气：${result.jieqi.current}（${result.jieqi.currentDate}）→ ${result.jieqi.next}（${result.jieqi.nextDate}）`);
    lines.push('');

    // ===== 四柱 =====
    lines.push(`【四柱】`);
    lines.push(`年柱：${result.yearGanZhi}（${result.yearNaYin}）`);
    lines.push(`月柱：${result.monthGanZhi}（${result.monthNaYin}）`);
    lines.push(`日柱：${result.dayGanZhi}（${result.dayNaYin}）`);
    lines.push(`时柱：${result.hourGanZhi}（${result.hourNaYin}）`);
    lines.push(`【月将】${monthGeneral.zhi}将${monthGeneral.name}（依据节气：${monthGeneral.basedOnTerm}）`);
    lines.push(`【月相】${moonPhase.name}（月龄${moonPhase.ageDays.toFixed(2)}天，亮度${moonPhase.illuminationPct}%）`);
    if (result.xunKong && result.shenSha) {
        lines.push(`【空亡】日空：${result.xunKong.join(' ')}`);
        lines.push(`【神煞】驿马:${result.shenSha.yiMa || '无'} 桃花:${result.shenSha.taoHua || '无'} 贵人:${result.shenSha.tianYiGuiRen.join(' ')} 禄神:${result.shenSha.luShen || '无'} 羊刃:${result.shenSha.yangRen || '无'} 文昌:${result.shenSha.wenChang || '无'} 将星:${result.shenSha.jiangXing || '无'} 华盖:${result.shenSha.huaGai || '无'} 劫煞:${result.shenSha.jieSha || '无'} 灾煞:${result.shenSha.zaiSha || '无'}`);
    }
    lines.push('');

    // ===== 日月建 =====
    const monthZhi = result.monthGanZhi[1];
    const dayZhi = result.dayGanZhi[1];
    lines.push(`【日月建】月建：${monthZhi}${DIZHI_WUXING[monthZhi] || ''}  日建：${dayZhi}${DIZHI_WUXING[dayZhi] || ''}`);
    lines.push('');

    // ===== 本卦 =====
    const benGongWuXing = getGongWuXing(result.benGua.gong);
    lines.push(`【本卦】${result.benGua.fullName}（${result.benGua.gong}宫·${benGongWuXing}）`);

    // 衍生命卦
    const arr = result.benGuaYao.map(y => y.nature === 'yang' ? 1 : 0);
    const rel = getAllRelatedGua(arr);
    const findGuaName = (gArr: number[]) => {
        return ICHING_MAP.get(gArr.join('')) || '未知';
    };
    lines.push(`【衍生命卦】互卦：${findGuaName(rel.hu)} | 错卦：${findGuaName(rel.cuo)} | 综卦：${findGuaName(rel.zong)}`);

    lines.push(`世爻：第${result.benGua.shiYao}爻 | 应爻：第${result.benGua.yingYao}爻`);

    // 本卦各爻详情表（从上爻到初爻）
    lines.push('');
    lines.push('爻位 | 六神 | 六亲 | 天干 | 地支 | 五行 | 世应 | 动静');
    lines.push('-----|------|------|------|------|------|------|------');
    for (let i = 5; i >= 0; i--) {
        const yao = result.benGuaYao[i];
        const shiYing = yao.isShi ? '世' : yao.isYing ? '应' : '　';
        const moving = yao.isMoving ? '动' : '静';
        const nature = yao.nature === 'yang' ? '阳' : '阴';
        const gan = yao.ganZhi[0];
        lines.push(
            `${yao.positionName}爻 | ${yao.liuShenShort} | ${yao.liuQinShort} | ${gan} | ${yao.zhi}${nature} | ${yao.wuxing} | ${shiYing} | ${moving}`
        );
    }

    // ===== 变卦 =====
    if (result.bianGua) {
        lines.push('');
        const bianGongWuXing = getGongWuXing(result.bianGua.gong);
        lines.push(`【变卦】${result.bianGua.fullName}（${result.bianGua.gong}宫·${bianGongWuXing}）`);
        lines.push(`世爻：第${result.bianGua.shiYao}爻 | 应爻：第${result.bianGua.yingYao}爻`);

        // 变卦六爻完整表格
        if (result.bianGuaYao && result.bianGuaYao.length === 6) {
            lines.push('');
            lines.push('爻位 | 六亲 | 天干 | 地支 | 五行');
            lines.push('-----|------|------|------|------');
            for (let i = 5; i >= 0; i--) {
                const yao = result.bianGuaYao[i];
                const nature = yao.nature === 'yang' ? '阳' : '阴';
                const gan = yao.ganZhi[0];
                lines.push(
                    `${yao.positionName}爻 | ${yao.liuQinShort} | ${gan} | ${yao.zhi}${nature} | ${yao.wuxing}`
                );
            }
        }
    }

    // ===== 动爻详情 =====
    if (result.movingYaoPositions.length > 0) {
        lines.push('');
        lines.push(`【动爻】第${result.movingYaoPositions.join('、')}爻`);
        for (const pos of result.movingYaoPositions) {
            const yao = result.benGuaYao[pos - 1];
            lines.push(
                `  ${yao.positionName}爻：${yao.liuShenShort}·${yao.liuQinShort}${yao.zhi}(${yao.wuxing})` +
                (yao.bianZhi ? ` → ${yao.bianLiuQinShort}${yao.bianZhi}(${yao.bianWuXing})` : '')
            );
        }
    }

    // ===== 占问 =====
    if (result.question) {
        lines.push('');
        lines.push(`【占问】${result.question}`);
    }

    lines.push('');
    lines.push(`起卦方式：${result.method}`);

    return lines.join('\n');
}

export interface AIAnalysisResult {
    success: boolean;
    content?: string;
    error?: string;
}

export interface AIChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

/**
 * 组装每次会话的第一条 System Prompt，将排盘原始数据+人设要求锁定
 * 注意：必须强制大模型在此空间内沙盒化，切勿混淆不同排盘。
 */
export async function buildSystemMessage(result: PanResult): Promise<AIChatMessage> {
    const settings = await getSettings();
    const panStr = formatPanForAI(result);
    // 移除之前的附加任务指令，将其放到别的接口单独拿

    return {
        role: 'system',
        content: `${settings.systemPrompt}\n\n【本轮要求】\n你当前的分析必须严格基于以下排盘数据（无论用户后续问什么，都不能跨出此盘数据范畴）：\n${panStr}`
    };
}

/**
 * 流式输出 (Streaming) 多轮对话聊天接口
 */
export async function analyzeWithAIChatStream(
    messages: AIChatMessage[],
    onChunk: (text: string) => void,
    signal?: AbortSignal
): Promise<AIAnalysisResult> {
    const settings = await getSettings();

    if (!settings.apiKey) {
        return { success: false, error: '请先在设置中配置 API Key' };
    }
    if (!settings.apiUrl) {
        return { success: false, error: '请先在设置中配置 API 接口地址' };
    }

    let fullContent = '';

    let es: EventSource;

    return new Promise((resolve, reject) => {
        let isAborted = false;

        let heartbeatTimer: NodeJS.Timeout;
        const resetHeartbeat = () => {
            if (heartbeatTimer) clearTimeout(heartbeatTimer);
            heartbeatTimer = setTimeout(() => {
                if (isAborted) return;
                isAborted = true;
                es.close();
                resolve({ success: false, error: '连接超时：服务器长时间无响应' });
            }, 30000); // 30秒无数据包则认为死连接
        };

        resetHeartbeat();

        es = new EventSource(settings.apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${settings.apiKey.trim()}`,
            },
            body: JSON.stringify({
                model: settings.model,
                messages: messages,
                temperature: 0.7,
                max_tokens: 2000,
                stream: true,
            }),
        });

        // 绑定外部中断信号
        if (signal) {
            signal.addEventListener('abort', () => {
                if (heartbeatTimer) clearTimeout(heartbeatTimer);
                isAborted = true;
                es.close();
                resolve({ success: false, error: 'ABORTED' });
            });
        }

        // 处理新数据块
        es.addEventListener('message', (event) => {
            if (isAborted) return;
            resetHeartbeat();
            const dataStr = event.data;
            if (!dataStr) return;
            if (dataStr === '[DONE]') {
                if (heartbeatTimer) clearTimeout(heartbeatTimer);
                es.close();
                resolve({ success: true, content: fullContent });
                return;
            }

            try {
                const parsed = JSON.parse(dataStr);
                const chunk = parsed.choices?.[0]?.delta?.content || '';
                if (chunk) {
                    fullContent += chunk;
                    onChunk(chunk);
                }
            } catch (err) {
                // 忽略非格式化数据块
            }
        });

        // 处理连接层报错
        es.addEventListener('error', (err: any) => {
            if (isAborted) return;
            if (heartbeatTimer) clearTimeout(heartbeatTimer);
            es.close();
            const errMsg = err.message || JSON.stringify(err);
            resolve({
                success: false,
                error: `模型请求意外中断: ${errMsg}`,
            });
        });
    });
}


/**
 * 单独生成与卦象及当前聊天流强相关的灵感药丸
 * 此接口是非流式的后台静默请求
 */
export async function generateQuickReplies(result: PanResult, chatHistory: AIChatMessage[]): Promise<string[]> {
    if (!result.question) return []; // 就像用户说的，没有问题就不提供追问药丸

    const settings = await getSettings();
    if (!settings.apiKey || !settings.apiUrl) return [];

    const systemMsg = await buildSystemMessage(result);
    const instruction: AIChatMessage = {
        role: 'user',
        content: `这是用户占问的主题：“${result.question}”。请你根据前文提供的排盘数据及我们刚刚的对话进度，站在预测大师的角度，提供 3 到 4个极具价值的【后续追问短句】。无需废话，仅返回一段被 \`\`\`json\`\`\` 包裹的内容，例如：{"quickReplies": ["追问1", "追问2", "追问3"]}`
    };

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15秒超时防挂死

        const response = await fetch(settings.apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${settings.apiKey.trim()}`,
            },
            body: JSON.stringify({
                model: settings.model,
                messages: [systemMsg, ...chatHistory, instruction],
                temperature: 0.7,
            }),
            signal: controller.signal as RequestInit['signal'],
        });

        clearTimeout(timeoutId);

        if (!response.ok) return [];


        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';

        // 提取 JSON
        const regex = /```json\s*([\s\S]*?)\s*```/;
        const match = content.match(regex);
        if (match) {
            const parsed = JSON.parse(match[1]);
            return Array.isArray(parsed.quickReplies) ? parsed.quickReplies : [];
        } else {
            // 尝试直接解析
            const parsed = JSON.parse(content);
            return Array.isArray(parsed.quickReplies) ? parsed.quickReplies : [];
        }
    } catch {
        return [];
    }
}
