/**
 * 动画性能守则，违反就退出 1（pre-commit 会跑）：
 * 1. 循环动画不用 withRepeat，改用 Reanimated 的 CSS 动画（animationName + css.keyframes）：
 *    C++ 每帧插值，不在 UI 线程跑 JS、不产生垃圾，常驻多少个都不会攒出 GC 停顿。
 * 2. useAnimatedStyle 只返回 transform / opacity / 颜色这类纯视觉属性。混进 zIndex、宽高、位置、边距，
 *    这次更新整个退回整棵视图树提交（原生同步开关也绕不过），逐帧跑就掉帧。
 *    确有必要的一次性动画，在样式函数里写 `motion-ok: 原因` 豁免。
 * 3. 弹簧配置写了 stiffness 就要写 mass：Reanimated 4 默认 mass 是 4，阻尼比只剩设想的一半。
 * 4. package.json 必须开着 Reanimated 的原生同步开关。
 */
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const files = [];
const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts')) files.push(full);
    }
};
walk(path.join(root, 'app'));
walk(path.join(root, 'src'));

const LAYOUT = /[{,]\s*(zIndex|width|height|minWidth|maxWidth|minHeight|maxHeight|top|left|right|bottom|margin\w*|padding\w*|flex\w*|position|borderWidth)\s*:/;
const problems = [];
const where = (file, source, index) => `${path.relative(root, file)}:${source.slice(0, index).split('\n').length}`;

for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');

    for (const match of source.matchAll(/withRepeat\(/g)) {
        problems.push(`${where(file, source, match.index)} 循环动画用了 withRepeat，改用 CSS 动画（animationName + css.keyframes）`);
    }

    let at = 0;
    while ((at = source.indexOf('useAnimatedStyle(', at)) >= 0) {
        let end = at + 'useAnimatedStyle('.length;
        for (let depth = 1; depth && end < source.length; end++) {
            if (source[end] === '(') depth++;
            else if (source[end] === ')') depth--;
        }
        const body = source.slice(at, end);
        const layout = body.match(LAYOUT);
        if (layout && !body.includes('motion-ok')) {
            problems.push(`${where(file, source, at)} useAnimatedStyle 里有布局属性 ${layout[1]}，只放 transform / opacity / 颜色`);
        }
        at = end;
    }

    for (const match of source.matchAll(/\{[^{}]*\bstiffness\b[^{}]*\}/g)) {
        if (!/\bmass\b/.test(match[0])) problems.push(`${where(file, source, match.index)} 弹簧没写 mass（Reanimated 4 默认 4）`);
    }
}

const flags = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).reanimated?.staticFeatureFlags ?? {};
if (flags.ANDROID_SYNCHRONOUSLY_UPDATE_UI_PROPS !== true) problems.push('package.json 没开 reanimated.staticFeatureFlags.ANDROID_SYNCHRONOUSLY_UPDATE_UI_PROPS');

if (problems.length) {
    console.error(`动画性能守则未通过（${problems.length} 处）：\n  ${problems.join('\n  ')}`);
    process.exit(1);
}
console.log(`Motion checks passed: ${files.length} files, no withRepeat, animated styles visual-only, springs with mass, sync UI props on.`);
