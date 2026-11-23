import type { PersistedAIChatMessage } from '../../core/ai-meta';
import { QIMEN_PERIODS, type QimenPeriod } from './types';

export const QIMEN_INITIAL_REQUEST = '请围绕本次占问合读时、日、月、年四盘，先给判断，再说明各时间尺度的依据。';
export const QIMEN_READING_TABS = (['时盘', '日盘', '月盘', '年盘', '追问'] as const).map(id => ({ id, short: id }));
export type QimenReadingTab = typeof QIMEN_READING_TABS[number]['id'];

export function splitQimenReading(text: string) {
    const sections: Partial<Record<QimenPeriod | '总断', string>> = {};
    let section: QimenPeriod | '总断' = '总断';
    const headings = new Set<string>();
    let lines: string[] = [];
    const save = () => {
        const body = lines.join('\n').trim();
        if (body) sections[section] = [sections[section], body].filter(Boolean).join('\n\n');
        lines = [];
    };
    for (const line of text.split(/\r?\n/u)) {
        // 兼容「## 总断」「**总断**」「## 时盘 · 当下」及「**总断**：正文写在同一行」的情况，不吞正文。
        const heading = /^\s*(?:#{1,4}\s+|\*\*)(?:\*\*)?(总断|时盘|日盘|月盘|年盘)(?:\*\*)?(?:\s*([·：:｜|—-])\s*(.*?))?(?:\*\*)?\s*$/u.exec(line);
        if (!heading) {
            lines.push(line);
            continue;
        }
        save();
        section = QIMEN_PERIODS.find(period => period === heading[1]) ?? '总断';
        headings.add(section);
        const sep = heading[2];
        const trailing = heading[3]?.replace(/\*\*$/u, '').trim();
        if (trailing && ((sep === '：' || sep === ':') || trailing.length > 16 || /[，。；！？]/u.test(trailing))) {
            lines.push(trailing);
        }
    }
    save();
    return headings.has('总断') || headings.size > 1 ? sections : undefined;
}

export function getQimenReading<M extends PersistedAIChatMessage & { pending?: boolean }>(messages: readonly M[]) {
    const visible = messages.filter(m => !m.hidden && !m.pending && m.role !== 'system'
        && !(m.role === 'user' && m.content === QIMEN_INITIAL_REQUEST));
    let partial: { message: M; sections: NonNullable<ReturnType<typeof splitQimenReading>> } | undefined;
    for (const message of visible) {
        if (message.role !== 'assistant') continue;
        const sections = splitQimenReading(message.content);
        if (!sections) continue;
        partial = { message, sections };
        if (QIMEN_PERIODS.every(period => sections[period])) break;
    }
    const index = partial ? visible.indexOf(partial.message) : -1;
    const question = index > 0 ? visible.slice(0, index).filter(m => m.role === 'user').at(-1)?.content : undefined;
    // 在追问中补充占问后生成的分卷，保留它在对话中的位置。
    const chat = index === 0 ? visible.slice(1) : visible;
    return { message: partial?.message, sections: partial?.sections, question, chat };
}
