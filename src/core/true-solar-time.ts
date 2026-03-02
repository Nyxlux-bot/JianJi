/**
 * 真太阳时计算模块
 * 
 * 真太阳时 = 北京时间 + 经度时间修正 + 时差方程修正
 * - 经度修正: (当地经度 - 120°) × 4 分钟
 * - 时差方程: 根据日期计算地球公转偏差（Spencer公式，误差<30秒）
 */

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
 * 计算真太阳时
 * @param date 北京时间（UTC+8）
 * @param longitude 当地经度（东经为正）
 * @returns 真太阳时 Date 对象
 */
export function calculateTrueSolarTime(date: Date, longitude: number): Date {
    if (longitude < -180 || longitude > 180) {
        throw new Error(`无效的经度: ${longitude}，经度必须在 -180 到 180 之间`);
    }

    // 经度修正：每度经度差4分钟
    // 北京时间基准经度为 120°E
    const longitudeCorrection = (longitude - 120) * 4; // 分钟

    // 时差方程修正
    const eot = equationOfTime(date);

    // 总修正量（分钟）
    const totalCorrectionMinutes = longitudeCorrection + eot;

    // 创建修正后的 Date
    const result = new Date(date.getTime() + totalCorrectionMinutes * 60 * 1000);
    return result;
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
 * @param original 原始北京时间
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
