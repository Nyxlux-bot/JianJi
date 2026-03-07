/**
 * 真太阳时计算模块
 *
 * 以设备当前时区的标准经线为基准：
 * - 平太阳时 = 本地钟表时 + 经度修正 + 夏令时修正（可选）
 * - 真太阳时 = 平太阳时 + 时差方程修正
 */

export interface SolarTimeCorrectionOptions {
    timezoneOffsetMinutes?: number;
    daylightSavingEnabled?: boolean;
}

/**
 * 时差方程 (Equation of Time)
 * 根据一年中的天数计算真太阳时与平太阳时的差值
 * 使用 Spencer (1971) 公式
 * @param date 日期
 * @returns 修正值，单位为分钟（正值表示真太阳时比平太阳时快）
 */
function equationOfTime(date: Date): number {
    const dayOfYear = getDayOfYear(date);
    // B = (360/365) * (dayOfYear - 81)，转换为弧度
    const B = (2 * Math.PI / 365) * (dayOfYear - 81);

    // Spencer 公式（返回分钟）
    const eot = 9.87 * Math.sin(2 * B)
        - 7.53 * Math.cos(B)
        - 1.5 * Math.sin(B);

    return eot;
}

/**
 * 获取一年中的第几天
 */
function getDayOfYear(date: Date): number {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date.getTime() - start.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/**
 * 推断当前时区的标准时区偏移（分钟）。
 * `Date#getTimezoneOffset()` 使用“西正东负”的约定。
 */
export function getStandardTimezoneOffsetMinutes(date: Date): number {
    const januaryOffset = new Date(date.getFullYear(), 0, 1).getTimezoneOffset();
    const julyOffset = new Date(date.getFullYear(), 6, 1).getTimezoneOffset();
    return Math.max(januaryOffset, julyOffset);
}

/**
 * 根据时区偏移计算标准经线（经度，东正西负）。
 */
export function getStandardMeridianLongitude(
    date: Date,
    timezoneOffsetMinutes: number = getStandardTimezoneOffsetMinutes(date),
): number {
    return (-timezoneOffsetMinutes / 60) * 15;
}

/**
 * 计算平太阳时。
 * @param date 本地钟表时
 * @param longitude 当地经度（东经为正）
 * @param options 时区与夏令时选项
 * @returns 平太阳时 Date 对象
 */
export function calculateMeanSolarTime(
    date: Date,
    longitude: number,
    options: SolarTimeCorrectionOptions = {},
): Date {
    if (longitude < -180 || longitude > 180) {
        throw new Error(`无效的经度: ${longitude}，经度必须在 -180 到 180 之间`);
    }

    const standardMeridian = getStandardMeridianLongitude(
        date,
        options.timezoneOffsetMinutes ?? getStandardTimezoneOffsetMinutes(date),
    );
    const longitudeCorrectionMinutes = (longitude - standardMeridian) * 4;
    const daylightSavingCorrectionMinutes = options.daylightSavingEnabled ? -60 : 0;
    const totalCorrectionMinutes = longitudeCorrectionMinutes + daylightSavingCorrectionMinutes;

    return new Date(date.getTime() + totalCorrectionMinutes * 60 * 1000);
}

/**
 * 计算真太阳时
 * @param date 本地钟表时
 * @param longitude 当地经度（东经为正）
 * @param options 时区与夏令时选项
 * @returns 真太阳时 Date 对象
 */
export function calculateTrueSolarTime(
    date: Date,
    longitude: number,
    options: SolarTimeCorrectionOptions = {},
): Date {
    const meanSolarTime = calculateMeanSolarTime(date, longitude, options);
    const eot = equationOfTime(meanSolarTime);
    return new Date(meanSolarTime.getTime() + eot * 60 * 1000);
}

/**
 * 格式化真太阳时为 HH:mm 字符串
 */
export function formatTrueSolarTime(date: Date): string {
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
}

/**
 * 获取时间修正差值描述
 * @param original 原始本地钟表时
 * @param adjusted 修正后的真太阳时
 * @returns 差值描述，如 "+14分钟" 或 "-8分钟"
 */
export function formatTimeDiff(original: Date, adjusted: Date): string {
    const diffMs = adjusted.getTime() - original.getTime();
    const diffMinutes = Math.round(diffMs / 60000);
    if (diffMinutes === 0) return '无修正';
    const sign = diffMinutes > 0 ? '+' : '';
    return `${sign}${diffMinutes}分钟`;
}
