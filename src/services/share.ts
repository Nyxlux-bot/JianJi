import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { PersistedAIChatMessage } from '../core/ai-meta';
import { extractBaziRelations } from '../core/bazi-relations';
import { BaziResult } from '../core/bazi-types';
import { PanResult } from '../core/liuyao-calc';
import { ZiweiRecordResult } from '../features/ziwei/record';
import { formatBaziToText } from './bazi-formatter';

const METHOD_LABEL: Record<string, string> = {
    time: '时间排卦',
    coin: '硬币排卦',
    number: '数字排卦',
    manual: '手动起卦',
};

function sanitizeName(name: string): string {
    return name
        .replace(/[\\/:*?"<>|\s]+/g, '_')
        .replace(/_+/g, '_')
        .slice(0, 30);
}

async function shareMarkdownFile(fileName: string, markdown: string): Promise<void> {
    if (!(await Sharing.isAvailableAsync())) {
        throw new Error('当前设备不支持分享功能');
    }

    const fileUri = `${FileSystem.documentDirectory}${fileName}`;
    await FileSystem.writeAsStringAsync(fileUri, markdown, { encoding: FileSystem.EncodingType.UTF8 });
    await Sharing.shareAsync(fileUri, {
        mimeType: 'text/markdown',
        dialogTitle: '分享内容',
        UTI: 'net.daringfireball.markdown',
    });
}

function isBaziResult(result: PanResult | BaziResult | ZiweiRecordResult): result is BaziResult {
    return Array.isArray((result as BaziResult).fourPillars);
}

function isZiweiResult(result: PanResult | BaziResult | ZiweiRecordResult): result is ZiweiRecordResult {
    const candidate = result as Partial<ZiweiRecordResult>;
    return typeof candidate.birthLocal === 'string'
        && typeof candidate.trueSolarDateTimeLocal === 'string'
        && typeof candidate.fiveElementsClass === 'string'
        && typeof candidate.soul === 'string'
        && typeof candidate.body === 'string';
}

function pickLastAssistant(result: PanResult): string {
    const chat = result.aiChatHistory || [];
    for (let i = chat.length - 1; i >= 0; i -= 1) {
        if (chat[i].role === 'assistant' && chat[i].content.trim()) {
            return chat[i].content;
        }
    }
    return (result.aiAnalysis || '').trim();
}

function getBaziRelations(result: BaziResult): string[] {
    const stems = result.fourPillars.map((pillar) => pillar.charAt(0));
    const branches = result.fourPillars.map((pillar) => pillar.charAt(1));
    return extractBaziRelations(stems, branches);
}

function formatBaziLiuYueLines(liuYue: BaziResult['liuNian'][number]['liuYue']): string[] {
    if (liuYue.length === 0) {
        return ['  - 流月：暂无'];
    }
    return liuYue.map((item) => (
        `  - ${item.index + 1}. ${item.termName} | ${item.ganZhi} | ${item.termDate}${item.isCurrent ? ' [当前流月]' : ''}`
    ));
}

function formatBaziLiuNianBlock(item: BaziResult['liuNian'][number]): string[] {
    return [
        `- ${item.year}年 | ${item.ganZhi} | 年龄${item.age} | 小运${item.xiaoYunGanZhi}${item.isCurrent ? ' [当前流年]' : ''}`,
        ...formatBaziLiuYueLines(item.liuYue),
    ];
}

function formatBaziDaYunBlock(item: BaziResult['daYun'][number]): string[] {
    const lines = [
        `### 第${item.index + 1}步大运：${item.ganZhi}${item.isCurrent ? ' [当前大运]' : ''}`,
        '',
        `- 年龄：${item.startAge}-${item.endAge}岁`,
        `- 年份：${item.startYear}-${item.endYear}年`,
        `- 交运：${item.jiaoYunDateTime}`,
        '',
        '#### 流年与流月',
        '',
    ];

    if (item.liuNian.length === 0) {
        lines.push('- 暂无流年数据');
        return lines;
    }

    item.liuNian.forEach((liuNian) => {
        lines.push(...formatBaziLiuNianBlock(liuNian), '');
    });
    return lines;
}

export function buildResultMarkdown(result: PanResult): string {
    const aiConclusion = pickLastAssistant(result);

    const lines: string[] = [
        `# 六爻排盘结果：${result.benGua.fullName}`,
        '',
        '## 基本信息',
        `- 起卦时间：${result.solarDate} ${result.solarTime}`,
        `- 起卦方式：${METHOD_LABEL[result.method] || result.method}`,
        `- 占问事项：${result.question || '未填写'}`,
        `- 本卦：${result.benGua.fullName}`,
        `- 变卦：${result.bianGua?.fullName || '无'}`,
        '',
        '## 四柱',
        `- 年柱：${result.yearGanZhi}（${result.yearNaYin}）`,
        `- 月柱：${result.monthGanZhi}（${result.monthNaYin}）`,
        `- 日柱：${result.dayGanZhi}（${result.dayNaYin}）`,
        `- 时柱：${result.hourGanZhi}（${result.hourNaYin}）`,
    ];

    if (aiConclusion) {
        lines.push('');
        lines.push('## AI 分析结论');
        lines.push(aiConclusion);
    }

    return lines.join('\n');
}

export async function shareResultMarkdown(result: PanResult): Promise<void> {
    const fileName = `liuyao_result_${sanitizeName(result.benGua.fullName)}_${Date.now()}.md`;
    const markdown = buildResultMarkdown(result);
    await shareMarkdownFile(fileName, markdown);
}

export function buildBaziResultMarkdown(result: BaziResult): string {
    const title = result.subject.name?.trim() || result.fourPillars.join(' ');
    const lines = [
        `# 八字排盘：${title}`,
        '',
        `- 命造：${result.subject.mingZaoLabel}（${result.subject.genderLabel}）`,
        `- 四柱：${result.fourPillars.join(' ')}`,
        `- 导出时间：${new Date().toISOString()}`,
        '',
        '## 完整排盘文本',
        '',
        formatBaziToText(result, getBaziRelations(result)),
        '',
        '## 全量大运流年流月',
        '',
        ...(result.daYun.length > 0 ? result.daYun.flatMap(formatBaziDaYunBlock) : ['- 暂无大运数据']),
        '',
        '## 全量小运流年流月',
        '',
        ...(result.xiaoYun.length > 0 ? result.xiaoYun.flatMap((item) => [...formatBaziLiuNianBlock(item), '']) : ['- 暂无小运数据']),
    ];

    return lines.join('\n');
}

export async function shareBaziResultMarkdown(result: BaziResult): Promise<void> {
    const fileName = `bazi_result_${sanitizeName(result.subject.name?.trim() || result.fourPillars.join('_'))}_${Date.now()}.md`;
    const markdown = buildBaziResultMarkdown(result);
    await shareMarkdownFile(fileName, markdown);
}

export async function shareChatMarkdown(result: PanResult | BaziResult | ZiweiRecordResult, messages: PersistedAIChatMessage[]): Promise<void> {
    const lines: string[] = [];

    if (isBaziResult(result)) {
        const title = result.subject.name?.trim() || result.fourPillars.join(' ');
        lines.push(`# AI 会话导出：${title}`);
        lines.push('');
        lines.push(`- 命造：${result.subject.mingZaoLabel}（${result.subject.genderLabel}）`);
        lines.push(`- 四柱：${result.fourPillars.join(' ')}`);
        lines.push(`- 导出时间：${new Date().toISOString()}`);
    } else if (isZiweiResult(result)) {
        lines.push(`# AI 会话导出：${result.name?.trim() || '紫微命盘'}`);
        lines.push('');
        lines.push(`- 性别：${result.gender === 'male' ? '男命' : '女命'}`);
        lines.push(`- 命盘：${result.fiveElementsClass} · 命主${result.soul} / 身主${result.body}`);
        lines.push(`- 真太阳时：${result.trueSolarDateTimeLocal.replace('T', ' ')}`);
        lines.push(`- 导出时间：${new Date().toISOString()}`);
    } else {
        lines.push(`# AI 会话导出：${result.benGua.fullName}`);
        lines.push('');
        lines.push(`- 起卦方式：${METHOD_LABEL[result.method] || result.method}`);
        lines.push(`- 占问事项：${result.question || '未填写'}`);
        lines.push(`- 导出时间：${new Date().toISOString()}`);
    }
    lines.push('');
    lines.push('## 对话记录');

    const visibleMessages = messages.filter((message) => message.role !== 'system' && !message.hidden);
    if (!visibleMessages.length) {
        lines.push('- 暂无会话记录');
    } else {
        visibleMessages.forEach((message) => {
            const roleLabel = message.role === 'user' ? '用户' : '助手';
            lines.push('');
            lines.push(`### ${roleLabel}`);
            lines.push(message.content || '(空内容)');
        });
    }

    const fileName = isBaziResult(result)
        ? `bazi_chat_${sanitizeName(result.subject.name?.trim() || result.fourPillars.join('_'))}_${Date.now()}.md`
        : isZiweiResult(result)
            ? `ziwei_chat_${sanitizeName(result.name?.trim() || result.fiveElementsClass)}_${Date.now()}.md`
        : `liuyao_chat_${sanitizeName(result.benGua.fullName)}_${Date.now()}.md`;
    await shareMarkdownFile(fileName, lines.join('\n'));
}
