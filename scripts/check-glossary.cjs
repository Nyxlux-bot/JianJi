/**
 * 术语词典校验，违反就退出 1：
 * 1. 书阁链接（词条底栏、引文、合盘引证）的 bookId / chapterId 都在 src/data/classics/index.json，书名、章名一致；
 * 2. 挂了书阁链接的引文：原文按「……」切段，去标点、按校字表统一后，每段都要在该章出现，且先后一致；
 *    没挂书阁链接的引文，出处必须写明「口诀」，不能冒充某书原文；
 * 3. 覆盖率：十神、十二长生、纳音按 tyme4ts 全量，神煞按 BAZI_SHENSHA_CATALOG 全量，另有日主、干支关系、宫星；
 *    排盘引擎会输出的术语都要能被 resolveBaziTerm 查到；
 * 4. 词条里不许出现不合法的干支（如「壬卯」）；
 * 5. 神煞查法与排盘引擎一致：按日柱定的逐个日柱比，干支对照表逐格比。
 * 6. 六爻、梅花：盘面术语全能查到词条；六爻神煞、六神起法、进退神、卦型与引擎一致；
 *    梅花卦气与月令旺衰表一致，纯乾纯坤的互卦按「乾坤无互，互其变卦」取。
 *
 * 词典是 TS，这里借 Node 自带的类型擦除（node:module 的 stripTypeScriptTypes + registerHooks）直接载入，不引新依赖。
 */
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL, fileURLToPath } = require('node:url');
const nodeModule = require('node:module');

const root = path.resolve(__dirname, '..');

// 类型擦除还是实验特性，Node 每次都会提示一句，校验输出里不需要
const emitWarning = process.emitWarning;
process.emitWarning = (warning, ...rest) => {
    if (String(warning).includes('stripTypeScriptTypes')) return;
    emitWarning.call(process, warning, ...rest);
};
// 应用代码里的开发期自检用 __DEV__，在 Node 里关掉
globalThis.__DEV__ = false;
const problems = [];
const fail = (message) => problems.push(message);

if (typeof nodeModule.registerHooks !== 'function' || typeof nodeModule.stripTypeScriptTypes !== 'function') {
    console.error('check-glossary 需要 Node 22.15 / 23.5 以上（用到 module.registerHooks 与 stripTypeScriptTypes）');
    process.exit(1);
}

const ENGINE_FILE = path.join(root, 'src/core/bazi-shensha.ts');
const TYME_EXPORTS = new Set(Object.keys(require('tyme4ts')));
nodeModule.registerHooks({
    resolve(specifier, context, next) {
        if (specifier.startsWith('.') && !path.extname(specifier)) {
            for (const suffix of ['.ts', '/index.ts']) {
                try {
                    return next(specifier + suffix, context);
                } catch {
                    // 换下一个后缀
                }
            }
        }
        return next(specifier, context);
    },
    load(url, context, next) {
        if (!url.startsWith('file:') || !url.endsWith('.ts')) return next(url, context);
        const file = fileURLToPath(url);
        let source = fs.readFileSync(file, 'utf8')
            // bazi-types 只有类型，擦除后运行时没有这些导出
            .replace(/import\s*\{[^}]*\}\s*from\s*'\.\/bazi-types';?/g, '')
            // 从 tyme4ts 按值导入的类型（如 EightCharProvider）擦除后还在，运行时没有，去掉
            .replace(/import\s*\{([^}]*)\}\s*from\s*'tyme4ts'/g, (_, names) => `import { ${names.split(',').map((n) => n.trim()).filter((n) => TYME_EXPORTS.has(n.replace(/^type\s+/, ''))).join(', ')} } from 'tyme4ts'`);
        // 引擎的查表函数没有导出，校验时临时导出，好逐格比对
        if (file === ENGINE_FILE) source = source.replace(/^function /gm, 'export function ');
        return { format: 'module', source: nodeModule.stripTypeScriptTypes(source), shortCircuit: true };
    },
});

const load = (relative) => import(pathToFileURL(path.join(root, relative)).href);

/** 比对规则（去标点、异体字、校字表）在 src/core/glossary/quote-match.ts，阅读器定位引文也用它 */
let matchQuote = null;

const index = JSON.parse(fs.readFileSync(path.join(root, 'src/data/classics/index.json'), 'utf8'));
const books = new Map(index.map((book) => [book.id, book]));
const chapterCache = new Map();
const chapterText = (bookId, chapterId) => {
    if (!chapterCache.has(bookId)) {
        const file = path.join(root, 'src/data/classics/books', `${bookId}.book`);
        const chapters = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')).chapters : [];
        chapterCache.set(bookId, new Map(chapters.map((c) => [c.id, c.text])));
    }
    return chapterCache.get(bookId).get(chapterId);
};

const checkLink = (where, link) => {
    const book = books.get(link.bookId);
    if (!book) return fail(`${where}：书阁没有《${link.bookTitle}》（${link.bookId}）`), false;
    const chapter = book.chapters.find((c) => c.id === link.chapterId);
    if (!chapter) return fail(`${where}：《${book.title}》没有章节 ${link.chapterId}`), false;
    if (link.bookTitle !== book.title) fail(`${where}：书名写作「${link.bookTitle}」，书阁是「${book.title}」`);
    if (link.chapterTitle !== chapter.title) fail(`${where}：章名写作「${link.chapterTitle}」，书阁是「${chapter.title}」`);
    return true;
};

/** 原文按「……」切段，每段都要按先后出现在章节里 */
const checkQuote = (where, original, link) => {
    const raw = chapterText(link.bookId, link.chapterId);
    if (raw === undefined) return;
    const result = matchQuote(original, raw, link.bookId);
    if (result.ok) return;
    const head = result.segment.slice(0, 18);
    fail(result.reordered
        ? `${where}：「${head}…」在《${link.bookTitle}·${link.chapterTitle}》里，但先后顺序和引文不同`
        : `${where}：「${head}…」在《${link.bookTitle}·${link.chapterTitle}》里查不到`);
};

const STEMS = '甲乙丙丁戊己庚辛壬癸';
const BRANCHES = '子丑寅卯辰巳午未申酉戌亥';

async function main() {
    const glossary = await load('src/core/glossary/index.ts');
    ({ matchQuote } = await load('src/core/glossary/quote-match.ts'));
    const engine = await load('src/core/bazi-shensha.ts');
    const catalog = await load('src/core/bazi-shensha-catalog.ts');
    const match = await load('src/features/bazi/match/classic-references.ts');
    const tyme = await import('tyme4ts');
    const { ALL_GLOSSARY_ENTRIES, resolveBaziTerm, findGlossaryEntry } = glossary;

    /* ---------- 1、2：链接与引文 ---------- */
    let citationCount = 0;
    for (const entry of ALL_GLOSSARY_ENTRIES) {
        entry.bookLinks.forEach((link) => checkLink(`${entry.id} 底栏链接`, link));
        entry.citations.forEach((citation, i) => {
            citationCount += 1;
            const where = `${entry.id} 引文 ${i + 1}`;
            if (!citation.bookLink) {
                if (!citation.source.includes('口诀')) fail(`${where}：没有书阁链接，出处却写「${citation.source}」，像是某书原文`);
                return;
            }
            if (checkLink(where, citation.bookLink)) checkQuote(where, citation.original, citation.bookLink);
        });
    }
    for (const ref of match.BAZI_MATCH_CLASSIC_REFERENCES) {
        if (!ref.bookLink) continue;
        const where = `合盘引证 ${ref.id}`;
        if (checkLink(where, ref.bookLink)) checkQuote(where, ref.quote, ref.bookLink);
    }

    /* ---------- 3：覆盖率与解析 ---------- */
    const expectAll = (label, names, category) => {
        const missing = names.filter((name) => !findGlossaryEntry(name, category));
        if (missing.length) fail(`${label}缺词条：${missing.join('、')}`);
    };
    const stems = [...STEMS].map((s) => tyme.HeavenStem.fromName(s));
    const tenStars = new Set();
    const terrains = new Set();
    stems.forEach((a) => stems.forEach((b) => tenStars.add(a.getTenStar(b).getName())));
    stems.forEach((s) => [...BRANCHES].forEach((z) => terrains.add(s.getTerrain(tyme.EarthBranch.fromName(z)).getName())));
    const sounds = new Set();
    for (let i = 0; i < 60; i++) sounds.add(tyme.SixtyCycle.fromIndex(i).getSound().getName());
    expectAll('十神', [...tenStars], 'bazi-shishen');
    expectAll('十二长生', [...terrains], 'bazi-changsheng');
    expectAll('纳音', [...sounds], 'bazi-nayin');
    expectAll('神煞', catalog.BAZI_SHENSHA_CATALOG.map((item) => item.fullName), 'bazi-shensha');

    const engineSource = fs.readFileSync(ENGINE_FILE, 'utf8');
    const engineNames = [...new Set([...engineSource.matchAll(/addStar\(\s*'([^']+)'/g)].map((m) => m[1]))];
    const unresolved = engineNames.filter((name) => !resolveBaziTerm(name, 'bazi-shensha'));
    if (unresolved.length) fail(`排盘引擎输出的神煞查不到词条：${unresolved.join('、')}`);
    const shortForms = ['杀', '枭', '比', '劫', '食', '伤', '才', '财', '官', '印', '丙正印', '庚伤官'];
    const unresolvedShort = shortForms.filter((name) => !resolveBaziTerm(name, 'bazi-shishen'));
    if (unresolvedShort.length) fail(`十神简称查不到词条：${unresolvedShort.join('、')}`);
    for (const label of ['元男', '元女', '日主']) {
        if (resolveBaziTerm(label)?.category !== 'bazi-rizhu') fail(`「${label}」没有指到日主词条`);
    }
    if (glossary.BAZI_RELATION_TERMS) {
        expectAll('干支关系', glossary.BAZI_RELATION_TERMS, 'bazi-relation');
    } else {
        fail('缺干支关系词条（BAZI_RELATION_TERMS）');
    }
    expectAll('合盘宫星', ['夫妻宫', '子女宫', '夫星', '妻星'], 'bazi-palace');

    /* ---------- 4：不合法的干支 ---------- */
    const parity = (ch, list) => list.indexOf(ch) % 2;
    for (const entry of ALL_GLOSSARY_ENTRIES) {
        const text = JSON.stringify(entry);
        for (const m of text.matchAll(new RegExp(`([${STEMS}])([${BRANCHES}])`, 'g'))) {
            if (parity(m[1], STEMS) !== parity(m[2], BRANCHES)) {
                const around = text.slice(Math.max(0, m.index - 2), m.index + 3);
                // 「甲见子」「戊己丑」这类是查表写法，不是干支；只认前后都不是干支字的成对出现
                const before = text[m.index - 1] ?? '';
                const after = text[m.index + 2] ?? '';
                if (!STEMS.includes(before) && !BRANCHES.includes(before) && !BRANCHES.includes(after) && !STEMS.includes(after) && /[、或，。；日时柱]/.test(after)) {
                    fail(`${entry.id} 出现不合法的干支「${m[0]}」（…${around}…）`);
                }
            }
        }
    }

    /* ---------- 5：神煞查法与引擎一致 ---------- */
    const ruleText = (name) => {
        const entry = findGlossaryEntry(name, 'bazi-shensha');
        if (!entry) return '';
        return entry.blocks.filter((b) => b.heading.includes('查法'))
            .map((b) => [...(b.paragraphs ?? []), ...(b.items ?? []).map((item) => item.content)].join(' ')).join(' ');
    };
    // 按日柱（或月令 + 日柱）定的：日柱清单要和引擎逐个一致
    const DAY_STARS = ['魁罡', '金神', '八专日', '六秀日', '九丑日', '十恶大败', '孤鸾煞', '阴差阳错', '十灵日', '天赦日', '四废日', '天转日', '地转日'];
    const months = ['丙寅', '丁卯', '戊辰', '己巳', '庚午', '辛未', '壬申', '癸酉', '甲戌', '乙亥', '丙子', '丁丑'];
    const dayHits = Object.fromEntries(DAY_STARS.map((s) => [s, new Set()]));
    for (let i = 0; i < 60; i++) {
        const day = tyme.SixtyCycle.fromIndex(i).getName();
        for (const month of months) {
            const result = engine.calculateBaziShenSha({ fourPillars: ['甲子', month, day, '甲子'], gender: 1 });
            for (const star of result.byPillar[2].stars) dayHits[star]?.add(day);
        }
    }
    const ganZhiRe = new RegExp(`[${STEMS}][${BRANCHES}]`, 'g');
    for (const star of DAY_STARS) {
        const inText = new Set(ruleText(star).match(ganZhiRe) ?? []);
        const fromEngine = dayHits[star];
        const missing = [...fromEngine].filter((d) => !inText.has(d));
        const extra = [...inText].filter((d) => !fromEngine.has(d));
        if (missing.length || extra.length) fail(`${star} 查法与引擎不一致：漏 ${missing.join(' ') || '无'}，多 ${extra.join(' ') || '无'}`);
    }
    // 查表定的：「某见某」逐对比；引擎有而查法没写的也算不一致（写了「余仿此」的除外）
    const G = [...STEMS];
    const Z = [...BRANCHES];
    const byGan = (fn) => Object.fromEntries(G.map((g) => [g, Z.filter((z) => fn(g, z))]));
    const byZhi = (fn) => Object.fromEntries(Z.map((a) => [a, Z.filter((b) => fn(a, b))]));
    const byMonth = (fn) => Object.fromEntries(Z.map((m) => [m, [...G, ...Z].filter((x) => fn(m, x))]));
    const TABLES = {
        天乙贵人: byGan(engine.tianYiGuiRen), 太极贵人: byGan(engine.taiJiGuiRen), 福星贵人: byGan(engine.fuXing),
        文昌贵人: byGan(engine.wenChang), 国印贵人: byGan(engine.guoYin), 金舆: byGan(engine.jinYu), 禄神: byGan(engine.luShen),
        流霞: byGan(engine.liuXia), 红艳煞: byGan(engine.hongYan), 羊刃: byGan(engine.yangRen), 飞刃: byGan(engine.feiRen),
        天厨贵人: byGan((g, z) => engine.tianChu(g, g, z)),
        天德贵人: byMonth(engine.tianDeGuiRen), 月德贵人: byMonth(engine.yueDe), 天德合: byMonth(engine.tianDeHe), 月德合: byMonth(engine.yueDeHe),
        天医: byMonth((m, x) => Z.includes(x) && engine.tianYi(m, x)), 血刃: byMonth((m, x) => Z.includes(x) && engine.xueRen(m, x)),
        驿马: byZhi(engine.yiMa), 华盖: byZhi(engine.huaGai), 将星: byZhi(engine.jiangXing), 红鸾: byZhi(engine.hongLuan), 天喜: byZhi(engine.tianXi),
        劫煞: byZhi(engine.jieSha), 灾煞: byZhi(engine.zaiSha), 勾绞煞: byZhi(engine.gouJiaoSha), 孤辰: byZhi(engine.guChen), 寡宿: byZhi(engine.guaSu),
        亡神: byZhi(engine.wangShen), 桃花: byZhi(engine.taoHua),
        丧门: byZhi((a, b) => engine.checkYearZhiRelation(a, b, 'shangmen')),
        吊客: byZhi((a, b) => engine.checkYearZhiRelation(a, b, 'diaoke')),
        披麻: byZhi((a, b) => engine.checkYearZhiRelation(a, b, 'pima')),
    };
    const pairRe = new RegExp(`([${STEMS}${BRANCHES}]{1,4})[年月日命]?见([${STEMS}${BRANCHES}]{1,4})`, 'g');
    const barePairRe = new RegExp(`(?:^|[：、])([${STEMS}${BRANCHES}])([${STEMS}${BRANCHES}])(?=[、。；]|$)`, 'g');
    for (const [star, table] of Object.entries(TABLES)) {
        const text = ruleText(star);
        const pairs = [];
        for (const m of text.matchAll(pairRe)) [...m[1]].forEach((a) => [...m[2]].forEach((b) => pairs.push([a, b])));
        if (!pairs.length) for (const m of text.matchAll(barePairRe)) pairs.push([m[1], m[2]]);
        if (!pairs.length) {
            fail(`${star} 的查法读不出「某见某」，没法和引擎比对：${text.slice(0, 40)}`);
            continue;
        }
        const wrong = pairs.filter(([a, b]) => !(table[a] ?? []).includes(b)).map(([a, b]) => `${a}见${b}`);
        if (wrong.length) fail(`${star} 查法有引擎里没有的对子：${[...new Set(wrong)].join(' ')}`);
        if (!text.includes('余仿此')) {
            const said = new Set(pairs.map(([a, b]) => a + b));
            const missing = Object.entries(table).flatMap(([a, list]) => list.map((b) => a + b)).filter((p) => !said.has(p));
            if (missing.length) fail(`${star} 查法漏写引擎里的对子：${missing.map((p) => `${p[0]}见${p[1]}`).join(' ')}`);
        }
    }

    /* ---------- 6：六爻与梅花 ---------- */
    const liuyaoData = await load('src/core/liuyao-data.ts');
    const liuyaoStatus = await load('src/core/liuyao-status.ts');
    const liuyaoShenSha = await load('src/core/shen-sha.ts');
    const renyuan = await load('src/core/renyuan-duty.ts');
    const meihuaEngine = await load('src/features/meihua/engine.ts');
    const { resolveLiuyaoTerm, resolveMeihuaTerm, SEASON_ORDER } = glossary;
    const expectResolve = (label, names, resolve, category) => {
        const missing = names.filter((name) => !resolve(name, category));
        if (missing.length) fail(`${label}缺词条：${missing.join('、')}`);
    };
    const entryText = (entry, heading) => entry.blocks.filter((b) => !heading || b.heading.includes(heading))
        .map((b) => [...(b.paragraphs ?? []), ...(b.items ?? []).map((item) => item.content)].join(' ')).join(' ');

    expectResolve('六亲', Object.keys(liuyaoData.LIUQIN_SHORT), resolveLiuyaoTerm, 'liuyao-liuqin');
    expectResolve('六神', Object.keys(liuyaoData.LIUSHEN_SHORT), resolveLiuyaoTerm, 'liuyao-liushen');
    expectResolve('六爻爻位', ['世', '应', '动爻', '变爻', '伏神', '用神', '月将'], resolveLiuyaoTerm, 'liuyao-yao');
    const statusSource = fs.readFileSync(path.join(root, 'src/core/liuyao-status.ts'), 'utf8');
    const statusLabels = [...new Set([...statusSource.matchAll(/label: '([^']+)'/g)].map((m) => m[1]))];
    expectResolve('六爻状态标记', [...statusLabels, '旬空'], resolveLiuyaoTerm, 'liuyao-status');
    expectResolve('六爻神煞', liuyaoShenSha.SHEN_SHA_FIELDS.map(([, label]) => label), resolveLiuyaoTerm, 'liuyao-shensha');
    expectResolve('旺衰', SEASON_ORDER, resolveLiuyaoTerm, 'wuxing-season');

    // 卦型：64 卦按纳甲逐个算，算出的卦型都要有词条，六冲、六合卦名单与词条一致
    const shapeHits = { 六冲卦: [], 六合卦: [] };
    for (const gua of Object.values(liuyaoData.GUA_64)) {
        const lower = liuyaoData.BA_GUA[gua.lower].name;
        const upper = liuyaoData.BA_GUA[gua.upper].name;
        const yao = [...liuyaoData.NA_JIA[lower].inner.zhi, ...liuyaoData.NA_JIA[upper].outer.zhi].map((zhi) => ({ zhi }));
        for (const shape of liuyaoStatus.getGuaShapes(gua, yao)) {
            if (!resolveLiuyaoTerm(shape, 'liuyao-guaxing')) fail(`卦型「${shape}」查不到词条`);
            shapeHits[shape]?.push(gua.fullName);
        }
    }
    for (const [shape, names] of Object.entries(shapeHits)) {
        const text = entryText(resolveLiuyaoTerm(shape, 'liuyao-guaxing') ?? { blocks: [] });
        const listed = Object.values(liuyaoData.GUA_64).map((g) => g.fullName).filter((name) => text.includes(name));
        const missing = names.filter((n) => !listed.includes(n));
        const extra = listed.filter((n) => !names.includes(n));
        if (missing.length || extra.length) fail(`${shape}名单与纳甲推算不一致：漏 ${missing.join(' ') || '无'}，多 ${extra.join(' ') || '无'}`);
    }

    // 六爻神煞：「某日见某」逐对与 getShenSha 比
    const LIUYAO_STAR_KEY = Object.fromEntries(liuyaoShenSha.SHEN_SHA_FIELDS.map(([key, label]) => [label, key]));
    for (const [label, key] of Object.entries(LIUYAO_STAR_KEY)) {
        const entry = resolveLiuyaoTerm(label, 'liuyao-shensha');
        if (!entry) continue;
        const table = {};
        for (const g of G) for (const z of Z) {
            const value = liuyaoShenSha.getShenSha(g, z)[key];
            const hits = Array.isArray(value) ? value : [value];
            // 以日干查的只看干，以日支查的只看支
            const byStem = ['tianYiGuiRen', 'luShen', 'yangRen', 'wenChang'].includes(key);
            const head = byStem ? g : z;
            table[head] = [...new Set([...(table[head] ?? []), ...hits.filter(Boolean)])];
        }
        const text = entryText(entry, '查法');
        const pairs = [];
        for (const m of text.matchAll(pairRe)) [...m[1]].forEach((a) => [...m[2]].forEach((b) => pairs.push([a, b])));
        const wrong = pairs.filter(([a, b]) => !(table[a] ?? []).includes(b)).map(([a, b]) => `${a}见${b}`);
        const said = new Set(pairs.map(([a, b]) => a + b));
        const missing = Object.entries(table).flatMap(([a, list]) => list.map((b) => a + b)).filter((p) => !said.has(p));
        if (wrong.length) fail(`六爻${label} 查法有引擎里没有的对子：${[...new Set(wrong)].join(' ')}`);
        if (missing.length) fail(`六爻${label} 查法漏写引擎里的对子：${missing.map((p) => `${p[0]}见${p[1]}`).join(' ')}`);
    }

    // 六神：「某某日起于初爻」与 getLiuShen 一致
    for (const name of Object.keys(liuyaoData.LIUSHEN_SHORT)) {
        const entry = resolveLiuyaoTerm(name, 'liuyao-liushen');
        const m = entry && entryText(entry, '起法').match(new RegExp(`([${STEMS}]+)日起于初爻`));
        if (!m) { fail(`六神「${name}」没写起法`); continue; }
        const engineDays = G.filter((g) => liuyaoData.getLiuShen(g)[0] === name).join('');
        if (m[1] !== engineDays) fail(`六神「${name}」起法写「${m[1]}日」，排盘是「${engineDays}日」`);
    }

    // 进神退神：词条列出的「某化某」与 liuyao-status 的 JIN 表一致；
    // 「实见」一项按纳甲枚举八卦两两互变（只翻发动的爻）核对哪些真会出现、哪些碰不到
    const jin = Object.fromEntries([...statusSource.match(/const JIN[^{]*\{([^}]*)\}/)[1].matchAll(/(\S):\s*'(\S)'/g)].map((m) => [m[1], m[2]]));
    const huaRe = new RegExp(`([${BRANCHES}])化([${BRANCHES}])`, 'g');
    const pairsIn = (text) => new Set([...text.matchAll(huaRe)].map((m) => m[1] + m[2]));
    const reachable = new Set();
    const trigrams = Object.values(liuyaoData.BA_GUA);
    for (const half of ['inner', 'outer']) {
        for (const a of trigrams) for (const b of trigrams) {
            for (let i = 0; i < 3; i++) {
                if (a.yao[i] !== b.yao[i]) reachable.add(liuyaoData.NA_JIA[a.name][half].zhi[i] + liuyaoData.NA_JIA[b.name][half].zhi[i]);
            }
        }
    }
    const sameSet = (x, y) => x.size === y.size && [...x].every((v) => y.has(v));
    for (const [title, forward] of [['化进神', true], ['化退神', false]]) {
        const entry = resolveLiuyaoTerm(title, 'liuyao-status');
        const listed = pairsIn(entryText(entry));
        const expected = new Set(Object.entries(jin).map(([a, b]) => (forward ? a + b : b + a)));
        const missing = [...expected].filter((p) => !listed.has(p));
        const extra = [...listed].filter((p) => !expected.has(p));
        if (missing.length || extra.length) fail(`${title}与排盘不一致：漏 ${missing.join(' ') || '无'}，多 ${extra.join(' ') || '无'}`);
        const seen = entry.blocks.flatMap((b) => b.items ?? []).find((item) => item.label === '实见');
        if (!seen) { fail(`${title}缺「实见」一项`); continue; }
        const [occurs = '', never = ''] = seen.content.split('；');
        const wantOccurs = new Set([...expected].filter((p) => reachable.has(p)));
        const wantNever = new Set([...expected].filter((p) => !reachable.has(p)));
        if (!sameSet(pairsIn(occurs), wantOccurs)) fail(`${title}「实见」写的会出现的化象不对，按纳甲应为 ${[...wantOccurs].map((p) => `${p[0]}化${p[1]}`).join('、')}`);
        if (!sameSet(pairsIn(never), wantNever)) fail(`${title}「实见」写的碰不到的化象不对，按纳甲应为 ${[...wantNever].map((p) => `${p[0]}化${p[1]}`).join('、') || '无'}`);
    }

    // 梅花：盘面术语
    expectResolve('梅花三卦', ['本卦', '互卦', '变卦', '体卦', '用卦', '卦气'], resolveMeihuaTerm, 'meihua-gua');
    expectResolve('梅花体用', ['体用比和', '用生体', '用克体', '体生用', '体克用', '比和', '生体', '克体', '泄体', '受克'], resolveMeihuaTerm, 'meihua-tiyong');
    expectResolve('八卦类象', Object.values(liuyaoData.BA_GUA).map((g) => g.name), resolveMeihuaTerm, 'trigram-image');
    expectResolve('旺衰', SEASON_ORDER, resolveMeihuaTerm, 'wuxing-season');

    // 梅花卦气：《周易卦数》卦气旺、卦气衰对月令旺衰表的「旺」「死」
    const QI = { 寅: ['木', '土'], 卯: ['木', '土'], 巳: ['火', '金'], 午: ['火', '金'], 申: ['金', '木'], 酉: ['金', '木'], 亥: ['水', '火'], 子: ['水', '火'], 辰: ['土', '水'], 戌: ['土', '水'], 丑: ['土', '水'], 未: ['土', '水'] };
    for (const [month, [wang, si]] of Object.entries(QI)) {
        const band = renyuan.buildWuXingBandFromMonthBranch(month);
        const of = (state) => band.find((item) => item.status === state)?.element;
        if (of('旺') !== wang || of('死') !== si) fail(`${month}月旺衰表与卦气不符：旺 ${of('旺')}、死 ${of('死')}，应为旺 ${wang}、衰 ${si}`);
    }
    for (const [upper, lower] of [[1, 1], [8, 8]]) {
        for (let line = 1; line <= 6; line++) {
            const { ben, hu, bian } = meihuaEngine.buildMeihuaHexagrams(upper, lower, line);
            const fromBian = meihuaEngine.buildMeihuaHexagrams(bian.upper, bian.lower, 1).hu;
            if (hu.fullName !== fromBian.fullName) fail(`${ben.fullName}${line}爻动的互卦是${hu.fullName}，应取变卦${bian.fullName}的互卦${fromBian.fullName}`);
        }
    }

    /* ---------- 结果 ---------- */
    const counts = {};
    ALL_GLOSSARY_ENTRIES.forEach((e) => { counts[e.categoryLabel] = (counts[e.categoryLabel] ?? 0) + 1; });
    const summary = `${ALL_GLOSSARY_ENTRIES.length} 条词条（${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join('、')}），${citationCount} 条引文`;
    if (problems.length) {
        console.error(`术语词典校验没过（${problems.length} 处）：`);
        problems.forEach((p) => console.error(`  - ${p}`));
        console.error(summary);
        process.exit(1);
    }
    console.log(`术语词典校验通过：${summary}`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
