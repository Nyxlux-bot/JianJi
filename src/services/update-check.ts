const RELEASES_API = 'https://api.github.com/repos/Nyxlux-bot/JianJi/releases?per_page=20';
const REQUEST_TIMEOUT_MS = 10000;

export interface AppUpdate {
    version: string;
    notes: string;
    pageUrl: string;
    apkUrl?: string;
}

// 与 scripts/release-version.js 的 versionCode 同一编码：同一版本号里 beta 排在正式版之前
function versionKey(version: string): number | null {
    const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-beta\.([1-9]\d*))?$/.exec(version.trim());
    if (!match) return null;
    return Number(match[1]) * 1000000 + Number(match[2]) * 10000 + Number(match[3]) * 100 + (Number(match[4]) || 99);
}

function httpsUrl(value: unknown): string | undefined {
    return typeof value === 'string' && value.startsWith('https://') ? value : undefined;
}

// 自定义弹窗正文居中、不能滚动，只列版本说明的分段标题；完整说明在发布页
function summarizeNotes(body: string): string {
    const sections = body.split(/\r?\n/).map((line) => /^#{1,3}\s+(.+)$/.exec(line.trim())?.[1]).filter(Boolean);
    return sections.length ? `更新内容：${sections.join('、')}` : '';
}

// 正式版只收正式版；装着 beta 的也收 beta，同号正式版排在 beta 之后，照样能收到
export function pickUpdate(releases: unknown, currentVersion: string): AppUpdate | null {
    const currentKey = versionKey(currentVersion);
    if (currentKey === null || !Array.isArray(releases)) return null;
    const includeBeta = currentVersion.includes('-beta.');
    let best: { key: number; release: Record<string, any> } | null = null;
    for (const release of releases) {
        if (!release || typeof release.tag_name !== 'string' || release.draft || (release.prerelease && !includeBeta)) continue;
        const key = versionKey(release.tag_name);
        if (key !== null && key > currentKey && (!best || key > best.key)) best = { key, release };
    }
    const pageUrl = httpsUrl(best?.release.html_url);
    if (!best || !pageUrl) return null;
    const assets: unknown[] = Array.isArray(best.release.assets) ? best.release.assets : [];
    const apk = assets.find((asset: any) => typeof asset?.name === 'string' && asset.name.endsWith('.apk')) as any;
    return {
        version: best.release.tag_name.replace(/^v/, ''),
        notes: summarizeNotes(String(best.release.body ?? '')),
        pageUrl,
        apkUrl: httpsUrl(apk?.browser_download_url),
    };
}

export async function checkForUpdate(currentVersion: string): Promise<AppUpdate | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
        let response: Response;
        try {
            response = await fetch(RELEASES_API, { headers: { Accept: 'application/vnd.github+json' }, signal: controller.signal });
        } catch {
            throw new Error(controller.signal.aborted ? '连接 GitHub 超时，请稍后再试。' : '连不上 GitHub，请检查网络后再试。');
        }
        if (response.status === 403 || response.status === 429) throw new Error('检查太频繁，GitHub 暂时拒绝了请求，请过一会儿再试。');
        if (!response.ok) throw new Error(`GitHub 返回 HTTP ${response.status}，请稍后再试。`);
        return pickUpdate(await response.json(), currentVersion);
    } finally {
        clearTimeout(timeoutId);
    }
}
