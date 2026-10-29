const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const routes = fs.readdirSync(path.join(root, 'app'), { recursive: true })
    .filter(file => file.endsWith('.tsx') && path.basename(file) !== '_layout.tsx');

for (const route of routes) {
    const source = read(path.join('app', route));
    assert.match(source, /container:\s*\{\s*flex:\s*1,\s*backgroundColor: 'transparent'/, route);
    for (const match of source.matchAll(/(?:shell|pageSurface):\s*\{([^}]+)\}/g)) {
        assert.doesNotMatch(match[1], /backgroundColor:\s*(?:palette\.page|Colors\.bg\.primary)/, route);
    }
}

const layout = read('app/_layout.tsx');
assert.match(layout, /screenLayout=\{withPageBackground\}/);
assert.match(layout, /navigationTheme\.colors, background: 'transparent'/);
assert.match(read('app/(tabs)/_layout.tsx'), /sceneStyle: \{ backgroundColor: 'transparent' \}/);
assert.match(read('app/bazi/ganzhi/_layout.tsx'), /contentStyle: \{ backgroundColor: 'transparent' \}/);
assert.match(read('src/components/AIChatModal.tsx'), /<PageBackground\s*\/>/);
assert.match(read('src/components/ai/ai-page-styles.ts'), /container: \{ flex: 1, backgroundColor: 'transparent' \}/);

const background = read('src/components/PageBackground.tsx');
assert.match(background, /pointerEvents="none"/);
assert.match(background, /accessibilityElementsHidden/);
assert.match(background, /<YunZhuanBanners\s*\/>/);
assert.doesNotMatch(background, /assets\/backgrounds/, 'Background images were replaced by the YunZhuan banners');

// 经幡字体：文件在、许可随附、组件和构建脚本用的是同一段经文
const banners = read('src/components/YunZhuanBanners.tsx');
assert.ok(banners.includes("require('../../assets/fonts/JianJiYunZhuan.ttf')"));
assert.match(banners, /if \(!loaded\) return null;/, 'Banners must wait for the font, or system glyphs flash first');
for (const asset of ['assets/fonts/JianJiYunZhuan.ttf', 'assets/fonts/OFL.txt']) {
    assert.ok(fs.statSync(path.join(root, asset)).size > 0, `Empty asset: ${asset}`);
}
const bannerText = banners.match(/const TEXT = '([^']+)'/)[1];
const scriptText = [...read('scripts/build-yunzhuan-font.py').matchAll(/^\s+'([^']+)'$/gm)].map(match => match[1]).join('');
assert.equal(bannerText, scriptText, 'TEXT drifted from scripts/build-yunzhuan-font.py; rebuild the font');
assert.match(read('src/components/StatusBarDecor.tsx'), /backgroundColor: 'transparent'/);
console.log(`Page background checks passed: ${routes.length} routes, nested navigation, AI modal, both themes.`);
