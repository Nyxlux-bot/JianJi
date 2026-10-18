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
assert.match(layout, /<PageBackground\s*\/>/);
assert.match(layout, /navigationTheme\.colors, background: 'transparent'/);
assert.match(read('app/(tabs)/_layout.tsx'), /sceneStyle: \{ backgroundColor: 'transparent' \}/);
assert.match(read('app/bazi/ganzhi/_layout.tsx'), /contentStyle: \{ backgroundColor: 'transparent' \}/);
assert.match(read('src/components/AIChatModal.tsx'), /<PageBackground\s*\/>/);
assert.match(read('src/components/ai/ai-page-styles.ts'), /container: \{ flex: 1, backgroundColor: 'transparent' \}/);

const background = read('src/components/PageBackground.tsx');
assert.match(background, /pointerEvents="none"/);
assert.match(background, /accessibilityElementsHidden/);
for (const asset of ['assets/backgrounds/day-clouds-birds.png', 'assets/backgrounds/night-milky-way.png']) {
    assert.ok(background.includes(asset), `Missing source: ${asset}`);
    assert.ok(fs.statSync(path.join(root, asset)).size > 0, `Empty image: ${asset}`);
}
assert.match(read('src/components/StatusBarDecor.tsx'), /backgroundColor: 'transparent'/);
console.log(`Page background checks passed: ${routes.length} routes, nested navigation, AI modal, both themes.`);
