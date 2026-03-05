import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { PanResult } from '../core/liuyao-calc';
import { AIChatMessage } from './ai';

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

function pickLastAssistant(result: PanResult): string {
    const chat = result.aiChatHistory || [];
    for (let i = chat.length - 1; i >= 0; i -= 1) {
        if (chat[i].role === 'assistant' && chat[i].content.trim()) {
            return chat[i].content;
        }
    }
    return (result.aiAnalysis || '').trim();
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

export async function shareChatMarkdown(result: PanResult, messages: AIChatMessage[]): Promise<void> {
    const lines: string[] = [
        `# AI 会话导出：${result.benGua.fullName}`,
        '',
        `- 起卦方式：${METHOD_LABEL[result.method] || result.method}`,
        `- 占问事项：${result.question || '未填写'}`,
        `- 导出时间：${new Date().toISOString()}`,
        '',
        '## 对话记录',
    ];

    if (!messages.length) {
        lines.push('- 暂无会话记录');
    } else {
        messages.forEach((message) => {
            if (message.role === 'system') {
                return;
            }
            const roleLabel = message.role === 'user' ? '用户' : '助手';
            lines.push('');
            lines.push(`### ${roleLabel}`);
            lines.push(message.content || '(空内容)');
        });
    }

    const fileName = `liuyao_chat_${sanitizeName(result.benGua.fullName)}_${Date.now()}.md`;
    await shareMarkdownFile(fileName, lines.join('\n'));
}
