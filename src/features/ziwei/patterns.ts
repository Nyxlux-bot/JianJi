import type { ZiweiMutagen, ZiweiPalaceAnalysisView } from './types';

/**
 * 命盘格局识别。规则以《紫微斗数全书》卷一为准：
 * - 「定富局 / 定贵局 / 定贫贱局」有原注的，照原注写条件；吉凶随所在之局（富、贵为吉，贫贱为凶）；
 * - 卷一《骨髓赋》《太微赋》等只有赋句、没有注的，条件取通行释义，并标明；
 * - 「定杂局」论行限，不属命盘格局，不收；
 * - 《全书》未载、后世书籍常用的格局单列，标「后世通行」。
 * 每条命中都返回依据，便于对照盘面；同名格局各派宽严不一，这里只认几何上明确的写法。
 */

export type ZiweiPatternTone = 'good' | 'mixed' | 'bad';
/** note：原注；verse：卷一赋文有句无注，取通行释义；later：后世通行，《全书》未载 */
export type ZiweiPatternBasis = 'note' | 'verse' | 'later';

export interface ZiweiPatternHit {
    key: string;
    name: string;
    tone: ZiweiPatternTone;
    basis: ZiweiPatternBasis;
    /** 出处，如「全书·定贵局」 */
    source: string;
    /** 命中依据，一句话 */
    detail: string;
}

const BRANCHES = '子丑寅卯辰巳午未申酉戌亥';
const FOUR_SHA = ['擎羊', '陀罗', '火星', '铃星'];
const SIX_LUCKY = ['左辅', '右弼', '文昌', '文曲', '天魁', '天钺'];
/** iztro 的空亡类杂曜：截空写作「截路」 */
const KONG_WANG = ['截路', '旬空', '空亡'];
const TONE_ORDER: Record<ZiweiPatternTone, number> = { good: 0, mixed: 1, bad: 2 };
const BASIS_ORDER: Record<ZiweiPatternBasis, number> = { note: 0, verse: 0, later: 1 };

type Palace = ZiweiPalaceAnalysisView;

function starsOf(palace: Palace) {
    return [...palace.majorStars, ...palace.minorStars, ...palace.adjectiveStars];
}

function buildContext(palaces: Palace[]) {
    const byBranch = new Map(palaces.map((palace) => [palace.earthlyBranch, palace]));
    const byName = new Map(palaces.map((palace) => [palace.name, palace]));
    const palaceOfStar = new Map<string, Palace>();
    const brightnessOf = new Map<string, string>();
    const birthStar: Partial<Record<ZiweiMutagen, string>> = {};
    palaces.forEach((palace) => {
        starsOf(palace).forEach((star) => {
            palaceOfStar.set(star.name, palace);
            brightnessOf.set(star.name, star.brightness);
            if (star.mutagen) {
                birthStar[star.mutagen as ZiweiMutagen] = star.name;
            }
        });
    });
    const ming = byName.get('命宫');
    if (!ming) {
        return null;
    }
    const body = palaces.find((palace) => palace.isBodyPalace);
    const offset = (palace: Palace, step: number) => byBranch.get(BRANCHES[(BRANCHES.indexOf(palace.earthlyBranch) + step + 12) % 12]);
    const squareOf = (palace: Palace) => [palace, offset(palace, 6), offset(palace, 4), offset(palace, 8)]
        .filter((item): item is Palace => Boolean(item));
    const has = (palace: Palace | undefined, star: string | undefined) => Boolean(palace && star && palaceOfStar.get(star) === palace);
    const hasAll = (palace: Palace | undefined, ...stars: string[]) => stars.every((star) => has(palace, star));
    const inMing = (...stars: string[]) => hasAll(ming, ...stars);
    const inSquareOf = (palace: Palace, ...stars: string[]) => stars.every((star) => squareOf(palace).some((item) => has(item, star)));
    const inSquare = (...stars: string[]) => inSquareOf(ming, ...stars);
    const branchOf = (star: string) => palaceOfStar.get(star)?.earthlyBranch || '';
    const at = (palace: Palace | undefined, branches: string) => Boolean(palace?.earthlyBranch) && branches.includes(palace!.earthlyBranch);
    /** 两颗星分居某宫两邻 */
    const clampAt = (palace: Palace, a: string, b: string) => {
        const prev = offset(palace, -1);
        const next = offset(palace, 1);
        return (has(prev, a) && has(next, b)) || (has(prev, b) && has(next, a));
    };
    /** 六合宫（暗合）：子丑、寅亥、卯戌、辰酉、巳申、午未 */
    const heOf = (palace: Palace) => byBranch.get(BRANCHES[(13 - BRANCHES.indexOf(palace.earthlyBranch)) % 12]);
    const light = (star: string) => brightnessOf.get(star) || '';
    const bright = (star: string) => ['庙', '旺'].includes(light(star));
    const kongIn = (palace: Palace | undefined) => KONG_WANG.filter((star) => has(palace, star));
    /** 宫内的禄：禄存或生年化禄星，返回写法 */
    const luIn = (palace: Palace | undefined) => {
        if (has(palace, '禄存')) {
            return '禄存';
        }
        return birthStar.禄 && has(palace, birthStar.禄) ? `${birthStar.禄}化禄` : '';
    };
    const birthInSquare = (mutagen: ZiweiMutagen) => Boolean(birthStar[mutagen] && inSquare(birthStar[mutagen]!));
    return {
        ming, body, byName, birthStar, palaceOfStar,
        offset, has, hasAll, inMing, inSquare, inSquareOf, branchOf, at, clampAt, heOf, light, bright, kongIn, luIn, birthInSquare,
    };
}

type PatternContext = NonNullable<ReturnType<typeof buildContext>>;

interface PatternRule {
    key: string;
    name: string | ((c: PatternContext) => string);
    tone: ZiweiPatternTone;
    basis: ZiweiPatternBasis;
    source: string;
    /** 命中返回依据，不命中返回空 */
    test: (c: PatternContext) => string | null | false | undefined;
}

const RULES: PatternRule[] = [
    /* ------------------------- 定富局（原注） ------------------------- */
    {
        key: 'caiyinjiayin', name: '财荫夹印', tone: 'good', basis: 'note', source: '全书·定富局',
        // 原注：相守命武梁来夹是也，田宅宫亦然
        test: (c) => c.inMing('天相') && c.clampAt(c.ming, '武曲', '天梁') && '天相守命，武曲、天梁来夹',
    },
    {
        key: 'riyuejiacai', name: '日月夹财', tone: 'good', basis: 'note', source: '全书·定富局',
        // 原注：武守命日月来夹是也，财帛宫亦然
        test: (c) => c.inMing('武曲') && c.clampAt(c.ming, '太阳', '太阴') && '武曲守命，太阳、太阴来夹',
    },
    {
        key: 'cailujiama', name: '财禄夹马', tone: 'good', basis: 'note', source: '全书·定富局',
        // 原注：马守命武禄来夹是也，逢生旺尤妙
        test: (c) => {
            if (!c.inMing('天马')) {
                return null;
            }
            const prev = c.offset(c.ming, -1);
            const next = c.offset(c.ming, 1);
            const lu = c.has(prev, '武曲') ? c.luIn(next) : c.has(next, '武曲') ? c.luIn(prev) : '';
            return lu && `天马守命，武曲、${lu}来夹`;
        },
    },
    {
        key: 'yinyingongshen', name: '荫印拱身', tone: 'good', basis: 'note', source: '全书·定富局',
        // 原注：身临田宅梁相拱冲是也，勿坐空亡
        test: (c) => c.body?.name === '田宅' && c.inSquareOf(c.body, '天梁', '天相') && c.kongIn(c.body).length === 0
            && '身宫在田宅，天梁、天相拱冲，不坐空亡',
    },
    {
        key: 'riyuezhaobi', name: '日月照璧', tone: 'good', basis: 'note', source: '全书·定富局',
        // 原注：日月临田宅宫是也，喜居墓库
        test: (c) => c.hasAll(c.byName.get('田宅'), '太阳', '太阴') && `太阳、太阴同临田宅（${c.byName.get('田宅')!.earthlyBranch}宫）`,
    },
    {
        key: 'jincan', name: '金灿光辉', tone: 'good', basis: 'note', source: '全书·定富局',
        // 原注：太阳单守，命在午宫是也
        test: (c) => c.inMing('太阳') && c.at(c.ming, '午') && '太阳单守午宫命垣',
    },

    /* ------------------------- 定贵局（原注） ------------------------- */
    {
        key: 'riyuejiaming', name: '日月夹命', tone: 'good', basis: 'note', source: '全书·定贵局',
        // 原注：不坐空亡遇逢本宫有吉星是也
        test: (c) => {
            const lucky = SIX_LUCKY.filter((star) => c.inMing(star));
            return c.clampAt(c.ming, '太阳', '太阴') && c.kongIn(c.ming).length === 0 && lucky.length > 0
                && `太阳、太阴夹命，命宫不坐空亡，有${lucky.join('、')}`;
        },
    },
    {
        key: 'richufusang', name: '日出扶桑', tone: 'good', basis: 'note', source: '全书·定贵局',
        // 原注：日在卯守命是也，守官禄宫亦然。骨髓赋「日照雷门富贵荣华」即此
        test: (c) => {
            if (c.branchOf('太阳') !== '卯') {
                return null;
            }
            if (c.inMing('太阳')) {
                return '太阳在卯宫守命（骨髓赋称日照雷门）';
            }
            return c.has(c.byName.get('官禄'), '太阳') && '太阳在卯宫守官禄';
        },
    },
    {
        key: 'yueluohai', name: '月落亥宫', tone: 'good', basis: 'note', source: '全书·定贵局',
        // 原注：月在亥守命是也，又名月朗天门
        test: (c) => c.inMing('太阴') && c.at(c.ming, '亥') && '太阴在亥宫守命（又名月朗天门）',
    },
    {
        key: 'yueshengcanghai', name: '月生沧海', tone: 'good', basis: 'note', source: '全书·定贵局',
        // 原注：月在子宫守田宅是也
        test: (c) => c.has(c.byName.get('田宅'), '太阴') && c.branchOf('太阴') === '子' && '太阴在子宫守田宅',
    },
    {
        key: 'junchen', name: '君臣庆会', tone: 'good', basis: 'note', source: '全书·定贵局',
        // 原注：紫微左右同守命是也，更会相武阴妙上
        test: (c) => {
            if (!c.inMing('紫微', '左辅', '右弼')) {
                return null;
            }
            const more = ['天相', '武曲', '太阴'].filter((star) => c.inSquare(star));
            return `紫微、左辅、右弼同守命宫${more.length > 0 ? `，更会${more.join('、')}` : ''}`;
        },
    },
    {
        key: 'fubigongzhu', name: '辅弼拱主', tone: 'good', basis: 'note', source: '全书·定贵局',
        // 原注：紫微守命二星来拱是也，夹之亦然
        test: (c) => {
            if (!c.inMing('紫微') || c.inMing('左辅', '右弼')) {
                return null;
            }
            if (c.clampAt(c.ming, '左辅', '右弼')) {
                return '紫微守命，左辅、右弼来夹';
            }
            return c.inSquare('左辅', '右弼') && '紫微守命，左辅、右弼来拱';
        },
    },
    {
        key: 'jinyufujia', name: '金舆扶驾', tone: 'good', basis: 'note', source: '全书·定贵局',
        // 原注：紫微守命前后有日月来夹是也
        test: (c) => c.inMing('紫微') && c.clampAt(c.ming, '太阳', '太阴') && '紫微守命，太阳、太阴前后来夹',
    },
    {
        key: 'caiyinjialu', name: '财印夹禄', tone: 'good', basis: 'note', source: '全书·定贵局',
        // 原注：禄守命梁相来夹是也，入财亦然
        test: (c) => {
            const lu = c.luIn(c.ming);
            return lu && c.clampAt(c.ming, '天梁', '天相') && `${lu}守命，天梁、天相来夹`;
        },
    },
    {
        key: 'lumapeiyin', name: '禄马佩印', tone: 'good', basis: 'note', source: '全书·定贵局',
        // 原注：马前有禄印星同宫是也（原注简略，这里取天马与禄、天相同宫，且在命宫三方四正）
        test: (c) => {
            const horse = c.palaceOfStar.get('天马');
            const lu = c.luIn(horse);
            return horse && lu && c.has(horse, '天相') && c.inSquare('天马') && `天马与${lu}、天相同在${horse.name}`;
        },
    },
    {
        key: 'zuogui', name: '坐贵向贵', tone: 'good', basis: 'note', source: '全书·定贵局',
        // 原注：谓魁钺在命迭相坐拱是也
        test: (c) => {
            if (c.inMing('天魁') && !c.inMing('天钺') && c.inSquare('天钺')) {
                return `天魁坐命，天钺在${c.palaceOfStar.get('天钺')!.name}相拱`;
            }
            return c.inMing('天钺') && !c.inMing('天魁') && c.inSquare('天魁') && `天钺坐命，天魁在${c.palaceOfStar.get('天魁')!.name}相拱`;
        },
    },
    {
        key: 'matoudaijian', name: '马头带剑', tone: 'good', basis: 'note', source: '全书·定贵局',
        // 原注：谓马有刃是也，不是居午格
        test: (c) => c.inMing('天马', '擎羊') && '天马、擎羊同守命宫（马有刃）',
    },
    {
        key: 'xingqiu', name: '刑囚夹印', tone: 'good', basis: 'note', source: '全书·定贵局',
        // 原注：天刑廉贞同临身命，主武勇之人
        test: (c) => {
            if (c.inMing('天刑', '廉贞')) {
                return '天刑、廉贞同临命宫，主武勇';
            }
            return c.body && c.body !== c.ming && c.hasAll(c.body, '天刑', '廉贞') && '天刑、廉贞同临身宫，主武勇';
        },
    },
    {
        key: 'tanhuo', name: '贪火相逢', tone: 'good', basis: 'note', source: '全书·定贵局',
        // 原注：谓二星守命同居庙旺是也
        test: (c) => c.inMing('贪狼', '火星') && c.bright('贪狼') && c.bright('火星')
            && `贪狼${c.light('贪狼')}、火星${c.light('火星')}同守命宫`,
    },
    {
        key: 'wuqushouyuan', name: '武曲守垣', tone: 'good', basis: 'note', source: '全书·定贵局',
        // 原注：武守命卯宫是也，余不是
        test: (c) => c.inMing('武曲') && c.at(c.ming, '卯') && '武曲在卯宫守命',
    },
    {
        key: 'quanlushengfeng', name: '权禄生逢', tone: 'good', basis: 'note', source: '全书·定贵局',
        // 原注：二星守命庙旺是也，陷不是
        test: (c) => {
            const lu = c.birthStar.禄;
            const quan = c.birthStar.权;
            return lu && quan && c.inMing(lu, quan) && c.bright(lu) && c.bright(quan)
                && `化禄${lu}${c.light(lu)}、化权${quan}${c.light(quan)}同守命宫`;
        },
    },
    {
        key: 'yangrenrumiao', name: '羊刃入庙', tone: 'good', basis: 'note', source: '全书·定贵局',
        // 原注：辰戌丑未守命遇吉是也
        test: (c) => {
            if (!c.inMing('擎羊') || !c.at(c.ming, '辰戌丑未')) {
                return null;
            }
            const lucky = SIX_LUCKY.filter((star) => c.inSquare(star));
            return lucky.length > 0 && `擎羊在${c.ming.earthlyBranch}宫守命，会${lucky.join('、')}`;
        },
    },

    /* --------------- 定贵局（注「见前批注」，条件取赋文通行释义） --------------- */
    {
        key: 'qishachaodou', name: (c) => (c.at(c.ming, '子午') ? '七杀仰斗' : '七杀朝斗'), tone: 'good', basis: 'verse', source: '全书·定贵局 / 骨髓赋',
        // 骨髓赋：七杀朝斗爵禄荣昌；朝斗仰斗爵禄荣昌
        test: (c) => c.inMing('七杀') && c.at(c.ming, '寅申子午') && `七杀在${c.ming.earthlyBranch}宫守命`,
    },
    {
        key: 'riyuebingming', name: '日月并明', tone: 'good', basis: 'verse', source: '全书·定贵局 / 骨髓赋',
        // 骨髓赋：日月并明佐九重于尧殿
        test: (c) => c.palaceOfStar.get('太阳') !== c.palaceOfStar.get('太阴')
            && c.inSquare('太阳', '太阴') && c.bright('太阳') && c.bright('太阴')
            && `太阳${c.light('太阳')}、太阴${c.light('太阴')}，分居而同照命宫`,
    },
    {
        key: 'mingzhu', name: '明珠出海', tone: 'good', basis: 'verse', source: '全书·定贵局 / 骨髓赋',
        // 骨髓赋：三合明珠生旺地稳步蟾宫
        test: (c) => c.at(c.ming, '未') && c.ming.majorStars.length === 0 && c.branchOf('太阳') === '卯' && c.branchOf('太阴') === '亥'
            && '命坐未宫无主星，太阳在卯、太阴在亥三合拱照',
    },
    {
        key: 'riyuetonglin', name: '日月同临', tone: 'good', basis: 'verse', source: '全书·定贵局 / 骨髓赋',
        // 骨髓赋：日月同临官居侯伯
        test: (c) => c.inMing('太阳', '太阴') && `太阳${c.light('太阳')}、太阴${c.light('太阴')}同临${c.ming.earthlyBranch}宫命垣`,
    },
    {
        key: 'kequanlugong', name: '科权禄拱', tone: 'good', basis: 'verse', source: '全书·定贵局 / 骨髓赋',
        // 骨髓赋：科权禄拱名誉昭彰（后世称三奇加会）
        test: (c) => c.birthInSquare('禄') && c.birthInSquare('权') && c.birthInSquare('科')
            && `化禄${c.birthStar.禄}、化权${c.birthStar.权}、化科${c.birthStar.科}会于命宫三方四正`,
    },
    {
        key: 'fuxiang', name: '府相朝垣', tone: 'good', basis: 'verse', source: '全书·定贵局 / 骨髓赋',
        // 骨髓赋：府相同来会命宫全家食禄
        test: (c) => !c.inMing('天府') && !c.inMing('天相') && c.inSquare('天府', '天相') && '天府、天相会照命宫',
    },
    {
        key: 'zifuchaoyuan', name: '紫府朝垣', tone: 'good', basis: 'verse', source: '全书·定贵局 / 骨髓赋',
        // 骨髓赋：紫府朝垣食禄万钟
        test: (c) => !c.inMing('紫微') && !c.inMing('天府') && c.inSquare('紫微', '天府') && '紫微、天府会照命宫',
    },
    {
        key: 'wenxinganggong', name: '文星暗拱', tone: 'good', basis: 'verse', source: '全书·定贵局 / 骨髓赋',
        // 骨髓赋：文星暗拱贾谊允矣登科
        test: (c) => !c.inMing('文昌') && !c.inMing('文曲') && c.inSquare('文昌', '文曲') && '文昌、文曲拱照命宫',
    },
    {
        key: 'jujimao', name: '巨机居卯', tone: 'good', basis: 'verse', source: '全书·定贵局',
        // 十二宫诸星得地合格诀：卯上巨机为贵格
        test: (c) => c.inMing('巨门', '天机') && c.at(c.ming, '卯') && '巨门、天机在卯宫守命',
    },
    {
        key: 'minglu', name: '明禄暗禄', tone: 'good', basis: 'verse', source: '全书·定贵局 / 骨髓赋',
        // 骨髓赋：明禄暗禄锦上添花。命宫有禄为明，六合宫有禄为暗
        test: (c) => {
            const he = c.heOf(c.ming);
            const ming = c.luIn(c.ming);
            const hidden = he ? c.luIn(he) : '';
            return ming && hidden && ming !== hidden && `命宫有${ming}，暗合${he!.name}有${hidden}`;
        },
    },
    {
        key: 'kemingluan', name: '科明禄暗', tone: 'good', basis: 'verse', source: '全书·定贵局 / 骨髓赋',
        // 骨髓赋：科明禄暗位列三台
        test: (c) => {
            const he = c.heOf(c.ming);
            const ke = c.birthStar.科;
            const hidden = he ? c.luIn(he) : '';
            return ke && c.inMing(ke) && hidden && `化科${ke}守命，暗合${he!.name}有${hidden}`;
        },
    },

    /* ------------------------ 定贫贱局（原注） ------------------------ */
    {
        key: 'shengbufengshi', name: '生不逢时', tone: 'bad', basis: 'note', source: '全书·定贫贱局',
        // 原注：命坐空亡逢廉贞是也
        test: (c) => {
            const kong = c.kongIn(c.ming);
            return c.inMing('廉贞') && kong.length > 0 && `廉贞守命，命坐${kong.join('、')}`;
        },
    },
    {
        key: 'lufengliangsha', name: '禄逢两杀', tone: 'bad', basis: 'note', source: '全书·定贫贱局',
        // 原注：禄坐空亡又逢空劫杀星是也
        test: (c) => {
            const lu = c.luIn(c.ming);
            const kong = c.kongIn(c.ming);
            const jie = ['地空', '地劫'].filter((star) => c.inSquare(star));
            return lu && kong.length > 0 && jie.length > 0 && `${lu}守命而坐${kong.join('、')}，又会${jie.join('、')}`;
        },
    },
    {
        key: 'maluokongwang', name: '马落空亡', tone: 'bad', basis: 'note', source: '全书·定贫贱局',
        // 原注：马既落亡虽禄冲会无用主奔波
        test: (c) => {
            const horse = c.palaceOfStar.get('天马');
            const kong = c.kongIn(horse);
            return horse && c.inSquare('天马') && kong.length > 0 && `天马在${horse.name}落${kong.join('、')}`;
        },
    },
    {
        key: 'riyuecanghui', name: '日月藏辉', tone: 'bad', basis: 'note', source: '全书·定贫贱局',
        // 原注：日月反背又逢巨暗是也
        test: (c) => '戌亥子'.includes(c.branchOf('太阳') || '_') && '辰巳午'.includes(c.branchOf('太阴') || '_')
            && (c.inSquare('太阳') || c.inSquare('太阴')) && c.inSquare('巨门')
            && `太阳在${c.branchOf('太阳')}、太阴在${c.branchOf('太阴')}反背，又会巨门`,
    },
    {
        key: 'caiyuqiuchou', name: '财与囚仇', tone: 'bad', basis: 'note', source: '全书·定贫贱局',
        // 原注：武贞同守身命是也（二星不同宫，取一守命、一守身）
        test: (c) => {
            if (!c.body || c.body === c.ming) {
                return null;
            }
            if (c.inMing('武曲') && c.has(c.body, '廉贞')) {
                return '武曲守命，廉贞守身';
            }
            return c.inMing('廉贞') && c.has(c.body, '武曲') && '廉贞守命，武曲守身';
        },
    },
    {
        key: 'yishenggupin', name: '一生孤贫', tone: 'bad', basis: 'note', source: '全书·定贫贱局',
        // 原注：谓破守命星陷地是也
        test: (c) => c.inMing('破军') && c.light('破军') === '陷' && `破军陷于${c.ming.earthlyBranch}宫守命`,
    },
    {
        key: 'junzizaiye', name: '君子在野', tone: 'bad', basis: 'note', source: '全书·定贫贱局',
        // 原注：谓四杀守身命而言临陷地是也
        test: (c) => {
            const atMing = FOUR_SHA.filter((star) => c.inMing(star) && c.light(star) === '陷');
            if (atMing.length > 0) {
                return `${atMing.join('、')}陷地守命`;
            }
            const atBody = c.body && c.body !== c.ming ? FOUR_SHA.filter((star) => c.has(c.body, star) && c.light(star) === '陷') : [];
            return atBody.length > 0 && `${atBody.join('、')}陷地守身`;
        },
    },
    {
        key: 'liangchonghuagai', name: '两重华盖', tone: 'bad', basis: 'note', source: '全书·定贫贱局',
        // 原注：谓禄存化禄坐命遇空劫是也
        test: (c) => {
            const lu = c.birthStar.禄;
            const jie = ['地空', '地劫'].filter((star) => c.inSquare(star));
            return lu && c.inMing('禄存', lu) && jie.length > 0 && `禄存、${lu}化禄坐命，遇${jie.join('、')}`;
        },
    },

    /* ----------------- 卷一赋文（不在四局，条件取通行释义） ----------------- */
    { key: 'zifu', name: '紫府同宫', tone: 'good', basis: 'verse', source: '全书·骨髓赋', test: (c) => c.inMing('紫微', '天府') && '紫微、天府同守命宫' },
    {
        key: 'shizhong', name: '石中隐玉', tone: 'good', basis: 'note', source: '全书·论石中隐玉格',
        // 格名注：命在子午逢巨门是也
        test: (c) => c.inMing('巨门') && c.at(c.ming, '子午') && `巨门在${c.ming.earthlyBranch}宫守命`,
    },
    { key: 'juri', name: '巨日同宫', tone: 'good', basis: 'verse', source: '全书·骨髓赋', test: (c) => c.inMing('巨门', '太阳') && `巨门、太阳同守${c.ming.earthlyBranch}宫` },
    { key: 'tanwu', name: '贪武同行', tone: 'good', basis: 'verse', source: '全书·骨髓赋', test: (c) => c.inMing('武曲', '贪狼') && '武曲、贪狼同守命宫' },
    { key: 'wengui', name: '文桂文华', tone: 'good', basis: 'verse', source: '全书·骨髓赋', test: (c) => c.inMing('文昌', '文曲') && '文昌、文曲同守命宫' },
    { key: 'shanyin', name: '善荫朝纲', tone: 'good', basis: 'verse', source: '全书·太微赋', test: (c) => c.inMing('天机', '天梁') && '天机、天梁同守命宫' },
    {
        key: 'luma', name: '禄马交驰', tone: 'good', basis: 'note', source: '全书·太微赋 / 问天马星',
        // 问天马星：如与禄存同宫，谓之禄马交驰
        test: (c) => {
            const horse = c.palaceOfStar.get('天马');
            return horse && c.has(horse, '禄存') && c.inSquare('天马') && `天马与禄存同在${horse.name}`;
        },
    },
    {
        key: 'jiyue', name: '机月同梁', tone: 'mixed', basis: 'verse', source: '全书·骨髓赋',
        // 骨髓赋：机月同梁作吏人
        test: (c) => c.inSquare('天机', '太阴', '天同', '天梁') && '天机、太阴、天同、天梁会于命宫三方四正',
    },
    {
        key: 'fanshui', name: '泛水桃花', tone: 'bad', basis: 'note', source: '全书·太微赋 / 重补斗数彀率',
        // 彀率：贪狼居子乃为泛水桃花；太微赋：贪居亥子，名为犯水桃花
        test: (c) => c.inMing('贪狼') && c.at(c.ming, '子亥') && `贪狼在${c.ming.earthlyBranch}宫守命`,
    },
    {
        key: 'fanbei', name: '日月反背', tone: 'bad', basis: 'verse', source: '全书·太微赋',
        // 太微赋：日月最嫌反背。已成「日月藏辉」时不再重复
        test: (c) => '戌亥子'.includes(c.branchOf('太阳') || '_') && '辰巳午'.includes(c.branchOf('太阴') || '_')
            && (c.inSquare('太阳') || c.inSquare('太阴')) && !c.inSquare('巨门')
            && `太阳在${c.branchOf('太阳')}、太阴在${c.branchOf('太阴')}，日月失辉照命`,
    },

    /* ------------------------ 后世通行（《全书》未载） ------------------------ */
    {
        key: 'shapolang', name: '杀破狼', tone: 'mixed', basis: 'later', source: '后世通行',
        test: (c) => {
            const lead = ['七杀', '破军', '贪狼'].find((star) => c.inMing(star));
            return lead && c.inSquare('七杀', '破军', '贪狼') && `${lead}坐命，七杀、破军、贪狼会于三方`;
        },
    },
    {
        key: 'kongming', name: '命无正曜', tone: 'mixed', basis: 'later', source: '后世通行',
        test: (c) => {
            if (c.ming.majorStars.length > 0) {
                return null;
            }
            const borrowed = c.offset(c.ming, 6)?.majorStars.map((star) => star.name).join('、');
            return borrowed ? `命宫无主星，借迁移${borrowed}安命` : '命宫无主星，迁移亦空';
        },
    },
    {
        key: 'yangliang', name: '阳梁昌禄', tone: 'good', basis: 'later', source: '后世通行',
        test: (c) => {
            if (!c.inSquare('太阳', '天梁', '文昌')) {
                return null;
            }
            const lu = c.inSquare('禄存') ? '禄存' : c.birthInSquare('禄') ? `${c.birthStar.禄}化禄` : '';
            return lu && `太阳、天梁、文昌与${lu}会于命宫三方四正`;
        },
    },
    {
        key: 'xiongsu', name: '雄宿朝元', tone: 'good', basis: 'later', source: '后世通行',
        test: (c) => c.inMing('廉贞') && c.at(c.ming, '寅申') && FOUR_SHA.every((star) => !c.inMing(star)) && `廉贞在${c.ming.earthlyBranch}宫守命，不见四煞`,
    },
    {
        key: 'jixiang', name: '极向离明', tone: 'good', basis: 'later', source: '后世通行',
        test: (c) => c.inMing('紫微') && c.at(c.ming, '午') && FOUR_SHA.every((star) => !c.inMing(star)) && '紫微在午宫守命，不见四煞',
    },
    { key: 'yingxing', name: '英星入庙', tone: 'good', basis: 'later', source: '后世通行', test: (c) => c.inMing('破军') && c.at(c.ming, '子午') && `破军在${c.ming.earthlyBranch}宫守命` },
    { key: 'shouxing', name: '寿星入庙', tone: 'good', basis: 'later', source: '后世通行', test: (c) => c.inMing('天梁') && c.at(c.ming, '午') && '天梁在午宫守命' },
    { key: 'lingtan', name: '铃贪格', tone: 'good', basis: 'later', source: '后世通行', test: (c) => c.inMing('贪狼', '铃星') && '贪狼、铃星同守命宫' },
    { key: 'zuoyou', name: '左右同宫', tone: 'good', basis: 'later', source: '后世通行', test: (c) => !c.inMing('紫微') && c.inMing('左辅', '右弼') && '左辅、右弼同守命宫' },
    { key: 'kuiyuejia', name: '魁钺夹命', tone: 'good', basis: 'later', source: '后世通行', test: (c) => c.clampAt(c.ming, '天魁', '天钺') && '天魁、天钺分居命宫两邻' },
    { key: 'zuoyoujia', name: '左右夹命', tone: 'good', basis: 'later', source: '后世通行', test: (c) => !c.inMing('紫微') && c.clampAt(c.ming, '左辅', '右弼') && '左辅、右弼分居命宫两邻' },
    { key: 'changqujia', name: '昌曲夹命', tone: 'good', basis: 'later', source: '后世通行', test: (c) => c.clampAt(c.ming, '文昌', '文曲') && '文昌、文曲分居命宫两邻' },
    {
        key: 'yangtuoji', name: '羊陀夹忌', tone: 'bad', basis: 'later', source: '后世通行',
        test: (c) => Boolean(c.birthStar.忌) && c.inMing(c.birthStar.忌!) && c.clampAt(c.ming, '擎羊', '陀罗')
            && `${c.birthStar.忌}化忌守命，擎羊、陀罗夹命`,
    },
    { key: 'huolingjia', name: '火铃夹命', tone: 'bad', basis: 'later', source: '后世通行', test: (c) => c.clampAt(c.ming, '火星', '铃星') && '火星、铃星分居命宫两邻' },
    { key: 'kongjiejia', name: '空劫夹命', tone: 'bad', basis: 'later', source: '后世通行', test: (c) => c.clampAt(c.ming, '地空', '地劫') && '地空、地劫分居命宫两邻' },
];

export function detectZiweiPatterns(palaces: ZiweiPalaceAnalysisView[]): ZiweiPatternHit[] {
    const context = buildContext(palaces);
    if (!context) {
        return [];
    }
    const hits: ZiweiPatternHit[] = [];
    RULES.forEach((rule) => {
        const detail = rule.test(context);
        if (detail) {
            hits.push({
                key: rule.key,
                name: typeof rule.name === 'function' ? rule.name(context) : rule.name,
                tone: rule.tone,
                basis: rule.basis,
                source: rule.source,
                detail,
            });
        }
    });
    // 《全书》所载在前，后世通行在后；各自再按吉、中、凶排
    return hits.sort((a, b) => BASIS_ORDER[a.basis] - BASIS_ORDER[b.basis] || TONE_ORDER[a.tone] - TONE_ORDER[b.tone]);
}

export const ZIWEI_PATTERN_TONE_LABEL: Record<ZiweiPatternTone, string> = { good: '吉', mixed: '中', bad: '凶' };
export const ZIWEI_PATTERN_BASIS_LABEL: Record<ZiweiPatternBasis, string> = {
    note: '原注',
    verse: '赋文无注，取通行释义',
    later: '后世通行，《全书》未载',
};
