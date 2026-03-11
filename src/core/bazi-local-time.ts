function pad2(value: number): string {
    return String(value).padStart(2, '0');
}

function extractDateParts(value: string): [number, number, number] | null {
    const match = value.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
    if (!match) {
        return null;
    }

    return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function extractTimeParts(value: string): [number, number, number] | null {
    const match = value.match(/(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
    if (!match) {
        return null;
    }

    return [Number(match[1]), Number(match[2]), Number(match[3] || '0')];
}

function isValidDateTimeParts(
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
    second: number,
): boolean {
    const date = new Date(year, month - 1, day, hour, minute, second, 0);
    return date.getFullYear() === year
        && date.getMonth() === month - 1
        && date.getDate() === day
        && date.getHours() === hour
        && date.getMinutes() === minute
        && date.getSeconds() === second;
}

export function formatLocalDateTime(date: Date): string {
    return [
        `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`,
        `${pad2(date.getHours())}:${pad2(date.getMinutes())}`,
    ].join('T');
}

export function formatLocalDisplayDateTime(date: Date): string {
    return [
        `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`,
        `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`,
    ].join(' ');
}

export function parseLocalDateTime(value: string | undefined | null): Date | null {
    if (typeof value !== 'string' || !value.trim()) {
        return null;
    }

    const dateParts = extractDateParts(value);
    const timeParts = extractTimeParts(value);
    if (!dateParts || !timeParts) {
        return null;
    }

    const [year, month, day] = dateParts;
    const [hour, minute, second] = timeParts;
    if (!isValidDateTimeParts(year, month, day, hour, minute, second)) {
        return null;
    }

    return new Date(year, month - 1, day, hour, minute, second, 0);
}

export function buildLocalDateTimeFromDateAndTime(
    dateText: string | undefined | null,
    timeText: string | undefined | null,
): string | undefined {
    if (typeof dateText !== 'string' || typeof timeText !== 'string') {
        return undefined;
    }

    const dateParts = extractDateParts(dateText);
    const timeParts = extractTimeParts(timeText);
    if (!dateParts || !timeParts) {
        return undefined;
    }

    const [year, month, day] = dateParts;
    const [hour, minute] = timeParts;
    if (!isValidDateTimeParts(year, month, day, hour, minute, 0)) {
        return undefined;
    }

    return `${year}-${pad2(month)}-${pad2(day)}T${pad2(hour)}:${pad2(minute)}`;
}

export function normalizeLocalDateTimeText(value: string | undefined | null): string | undefined {
    const parsed = parseLocalDateTime(value);
    return parsed ? formatLocalDateTime(parsed) : undefined;
}
