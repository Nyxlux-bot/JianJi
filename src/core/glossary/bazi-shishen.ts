import type { GlossaryEntry } from './types';

/**
 * 八字十神精解词典（10 项全覆盖）
 * 古籍引证核自站内《渊海子平》《三命通会》《子平真诠》《命理探源》。
 */
const SHISHEN_ENTRIES: GlossaryEntry[] = [
    {
        id: 'shishen:比肩',
        category: 'bazi-shishen',
        categoryLabel: '十神',
        title: '比肩',
        subtitle: '同五行 · 同阴阳 · 比劫类',
        aliases: ['比'],
        nature: 'neutral',
        summary: '与日主五行相同且阴阳一致者为比肩，如甲见甲、乙见乙。代表自我意识、独立自立、平辈同侪与并肩协力，也主竞争分利。',
        focusHint: '身弱喜比肩帮身扛财官；身强忌比肩叠见夺财',
        blocks: [
            {
                heading: '心性',
                items: [
                    { label: '为喜', tone: 'favorable', content: '稳重踏实、意志坚定、自尊自信、独立自主、讲义气、不轻易屈服，有主见与执行力。' },
                    { label: '为忌', tone: 'unfavorable', content: '固执己见、好胜争强、不善变通、刚愎自用，易与人暗中较劲或陷入孤立。' },
                ],
            },
            {
                heading: '取象',
                items: [
                    { label: '为喜', tone: 'favorable', content: '同辈知己、合作伙伴、兄弟姐妹助力、凭个人真本事白手起家、守成护产。' },
                    { label: '为忌', tone: 'unfavorable', content: '同业竞争、合伙分利、破耗钱财、口舌争端；男命过旺易冷落妻缘。' },
                ],
            },
            {
                heading: '要旨',
                paragraphs: ['同我者为比劫，同性为比肩。比肩如手足并立，身弱得之则有所依凭，身旺重见则分夺财禄。'],
            },
            {
                heading: '十神功用',
                items: [
                    { label: '帮身任财官', content: '日干偏弱而财官偏重时，比肩通根助身，能代日主扛起财星与官杀压力，化险为用。' },
                    { label: '生助食伤', content: '局中食伤泄秀而力量不足，比肩相生则才华有源，利技艺、专业与团队协作。' },
                    { label: '分财克财', content: '日干本强再逢比肩重重，无官杀制比或食伤通关，最易群比争财，主破耗与合伙生隙。' },
                ],
            },
        ],
        citations: [
            {
                source: '《子平真诠·论建禄月劫》',
                original: '建禄者，月建逢禄堂也，禄即是劫。……故建禄与月劫，可同一格，不必加分，皆以透干支，别取财官煞食为用。',
                translation: '月令见日主临官禄位即为建禄，本质与比劫相通。月令建禄或比劫不能单作喜忌，须看其余干支透出何物，另取财、官、七杀或食伤为用神。',
                bookLink: { bookId: 'zipingzhenquan', bookTitle: '子平真诠', chapterId: 'zipingzhenquan-040', chapterTitle: '论建禄月劫' },
            },
            {
                source: '《渊海子平·基础》',
                original: '以甲为例，见甲：为比肩、兄弟……同类之阴阳……甲乙见甲乙是也。',
                translation: '以甲木日主为例，见到同属阳木的甲即称为比肩，六亲主同辈兄弟；与日主同五行的比肩劫财，全看日主强弱与格局配合定吉凶。',
                bookLink: { bookId: 'yuanhaiziping', bookTitle: '渊海子平', chapterId: 'yuanhaiziping-001', chapterTitle: '基础' },
            },
        ],
        bookLinks: [
            { bookId: 'zipingzhenquan', bookTitle: '子平真诠', chapterId: 'zipingzhenquan-040', chapterTitle: '论建禄月劫' },
            { bookId: 'yuanhaiziping', bookTitle: '渊海子平', chapterId: 'yuanhaiziping-001', chapterTitle: '基础' },
        ],
    },
    {
        id: 'shishen:劫财',
        category: 'bazi-shishen',
        categoryLabel: '十神',
        title: '劫财',
        subtitle: '同五行 · 异阴阳 · 比劫类',
        aliases: ['劫', '败财'],
        nature: 'neutral',
        summary: '与日主五行相同而阴阳相异者为劫财，如甲见乙、乙见甲。较比肩更具锋芒与行动力，善于交际破局，但亦主冲动争夺与财帛起伏。',
        focusHint: '身弱喜劫财合杀帮身；身旺见正财最怕劫财无制',
        blocks: [
            {
                heading: '心性',
                items: [
                    { label: '为喜', tone: 'favorable', content: '热情豪爽、胆大果决、善察言观色、人脉广博、执行力强，逆境中敢拼敢闯。' },
                    { label: '为忌', tone: 'unfavorable', content: '冲动急躁、投机冒进、好面子讲排场、占有欲强，易因情绪或轻信他人而破财。' },
                ],
            },
            {
                heading: '取象',
                items: [
                    { label: '为喜', tone: 'favorable', content: '魄力开拓、资源整合、借势合作、以柔化刚或以猛制胜的突破口。' },
                    { label: '为忌', tone: 'unfavorable', content: '破耗失财、借贷拖累、同侪夺利、感情竞争；古称阳见阴为败财，忌直克正财。' },
                ],
            },
            {
                heading: '要旨',
                paragraphs: ['同我者为比劫，异性为劫财。劫财喜食伤泄秀生财，或得官杀约束成器；忌身旺见财而无护卫。'],
            },
            {
                heading: '十神功用',
                items: [
                    { label: '扶弱敌杀', content: '日弱杀重时，劫财既可帮身，又常能以异性之合「合杀留清」（如甲日见庚杀得乙合），转危为权。' },
                    { label: '转劫生财', content: '劫财过旺而命局见食伤，可将躁动之气转化为才华与产出，形成「比劫生食伤、食伤生财」的良性流通。' },
                    { label: '劫夺正财', content: '身强劫旺而正财虚露无护，最主大起大落、钱财难聚，宜见正官七杀制劫或食伤通关。' },
                ],
            },
        ],
        citations: [
            {
                source: '《渊海子平·论劫财》',
                original: '五阳见五阴为败财，主克妻害子；五阴见五阳为劫财，主破耗、防小人，不克妻……财者，人之所欲，方令弟兄见之，多有争竞。',
                translation: '阳干见阴干同类旧称败财，阴干见阳干同类称劫财；钱财人人所欲，命局比劫与财星直面相争且无制化时，最易引发破耗与人际纷争。',
                bookLink: { bookId: 'yuanhaiziping', bookTitle: '渊海子平', chapterId: 'yuanhaiziping-002', chapterTitle: '十神' },
            },
            {
                source: '《子平真诠·论建禄月劫》',
                original: '禄劫用财，须带食伤，盖月令为劫而以财作用，二财相克，必以伤食化之，始可转劫生财。',
                translation: '月令建禄或劫财而以财星为用神时，必须配食神或伤官来通关化泄，使劫财转而去生食伤、再生财星，方能变争夺为生发。',
                bookLink: { bookId: 'zipingzhenquan', bookTitle: '子平真诠', chapterId: 'zipingzhenquan-040', chapterTitle: '论建禄月劫' },
            },
        ],
        bookLinks: [
            { bookId: 'yuanhaiziping', bookTitle: '渊海子平', chapterId: 'yuanhaiziping-002', chapterTitle: '十神' },
            { bookId: 'zipingzhenquan', bookTitle: '子平真诠', chapterId: 'zipingzhenquan-040', chapterTitle: '论建禄月劫' },
        ],
    },
    {
        id: 'shishen:食神',
        category: 'bazi-shishen',
        categoryLabel: '十神',
        title: '食神',
        subtitle: '我生者 · 同阴阳 · 四吉神之一',
        aliases: ['食', '寿星'],
        nature: 'auspicious',
        summary: '日主所生且阴阳相同者为食神，如甲见丙、乙见丁。古称「寿星」「福星」，主温和宽厚、审美才艺、口福衣禄与从容生财。',
        focusHint: '喜身旺、见财、制杀；最忌偏印贴身「枭神夺食」',
        blocks: [
            {
                heading: '心性',
                items: [
                    { label: '为喜', tone: 'favorable', content: '温和宽厚、心胸豁达、细腻儒雅、懂得享受生活、有审美与创意、不急功近利。' },
                    { label: '为忌', tone: 'unfavorable', content: '安逸懒散、缺乏魄力、好逸恶劳、想多做少，或沉溺口腹享乐而失于进取。' },
                ],
            },
            {
                heading: '取象',
                items: [
                    { label: '为喜', tone: 'favorable', content: '衣食丰足、福寿安康、技艺作品、饮食文化、教育传播、温和稳健的生财之道；女命亦主子息。' },
                    { label: '为忌', tone: 'unfavorable', content: '精力透支、思虑过度、计划空转；若遭偏印重克（枭神夺食），主福禄受阻、心情郁结或突发波折。' },
                ],
            },
            {
                heading: '要旨',
                paragraphs: ['我生者为食伤，同性为食神。食神有气胜财官，先要身强旺本干；最怕偏印来夺食。'],
            },
            {
                heading: '十神功用',
                items: [
                    { label: '泄秀吐华', content: '日干强旺得食神一位清透，主才情内蕴、表达流畅、以专业立身。' },
                    { label: '食神生财', content: '身强食旺而又透财星，财源由才智技能源源化出，为稳健富厚之美格。' },
                    { label: '食神制杀', content: '命带七杀攻身，得旺食神贴身制约且无财印破局，能化暴为权，多出实干掌权之才。' },
                ],
            },
        ],
        citations: [
            {
                source: '《渊海子平·论食神》',
                original: '食神者，生我财神之谓也……命中带此者，主人财厚食丰、腹量宽洪、肌体肥大、优游自足、有子息、有寿考……忌倒食，恐伤其食神；喜财神相生。',
                translation: '食神之所以称「食」，是因为它能转生财星滋养日主。命局食神得用者，多气度宽宏、衣食丰厚、从容有寿；最喜见财相生，最怕偏印（倒食）克损。',
                bookLink: { bookId: 'yuanhaiziping', bookTitle: '渊海子平', chapterId: 'yuanhaiziping-002', chapterTitle: '十神' },
            },
            {
                source: '《子平真诠·论食神》',
                original: '食神生财，美格也。财要有根，不必偏正叠出，如身强食旺而财透，大贵之格。',
                translation: '食神生财是极佳的格局，财星须有地支根气而不必偏正混杂；若日主健旺、食神有力、财星清透，往往富贵双全。',
                bookLink: { bookId: 'zipingzhenquan', bookTitle: '子平真诠', chapterId: 'zipingzhenquan-035', chapterTitle: '论食神（附取运）' },
            },
        ],
        bookLinks: [
            { bookId: 'yuanhaiziping', bookTitle: '渊海子平', chapterId: 'yuanhaiziping-002', chapterTitle: '十神' },
            { bookId: 'zipingzhenquan', bookTitle: '子平真诠', chapterId: 'zipingzhenquan-035', chapterTitle: '论食神（附取运）' },
        ],
    },
    {
        id: 'shishen:伤官',
        category: 'bazi-shishen',
        categoryLabel: '十神',
        title: '伤官',
        subtitle: '我生者 · 异阴阳 · 秀气与锋芒',
        aliases: ['伤'],
        nature: 'neutral',
        summary: '日主所生且阴阳相异者为伤官，如甲见丁、乙见丙。才华横溢、领悟极快、破旧立新，因能克制正官故带叛逆锋芒，成格极贵、失控易惹是非。',
        focusHint: '伤官佩印主文贵，伤官生财主富发；无制忌见正官',
        blocks: [
            {
                heading: '心性',
                items: [
                    { label: '为喜', tone: 'favorable', content: '聪颖绝伦、思维敏锐、表达犀利、富有创造力与感染力、敢于突破常规、领悟力超群。' },
                    { label: '为忌', tone: 'unfavorable', content: '恃才傲物、心高气傲、言辞尖锐、情绪起伏大、不服管束，易因口舌得罪权贵或自寻烦恼。' },
                ],
            },
            {
                heading: '取象',
                items: [
                    { label: '为喜', tone: 'favorable', content: '艺术创作、发明研发、演讲写作、律师演艺、名声口碑、破格立新的专业成就。' },
                    { label: '为忌', tone: 'unfavorable', content: '官非口舌、职场顶撞上司、名誉受损、情绪内耗；女命无制则易对配偶苛求挑剔。' },
                ],
            },
            {
                heading: '要旨',
                paragraphs: ['我生者为食伤，异性为伤官。伤官虽非吉神，实为秀气；火土伤官宜伤尽，金水伤官喜见官。'],
            },
            {
                heading: '十神功用',
                items: [
                    { label: '伤官生财', content: '身强伤官旺而引出财星，才华落地为财富，既能生财又能化解伤官克官之暴，俗称「富贵自天来」。' },
                    { label: '伤官佩印', content: '身弱或伤官过旺泄身太过，得正印贴身制伤护身，去其狂傲、留其文采，多成文人学者或高位清贵。' },
                    { label: '伤官见官', content: '局中本用正官而伤官直克无财通关、无印制伤，主职位动荡、是非口舌；惟金水伤官喜调候见官属例外。' },
                ],
            },
        ],
        citations: [
            {
                source: '《子平真诠·论伤官》',
                original: '伤官虽非吉神，实为秀气，故文人学士，多于伤官格内得之。而夏木见水，冬金见火，则又为秀之尤秀者也。',
                translation: '伤官虽名列四凶神，实则是天地灵秀之气所钟，历史上许多才华出众的文人学士都出自伤官格；尤其是夏木得水润、冬金得火暖，更是秀中之秀。',
                bookLink: { bookId: 'zipingzhenquan', bookTitle: '子平真诠', chapterId: 'zipingzhenquan-037', chapterTitle: '论伤官（附取运）' },
            },
            {
                source: '《渊海子平·论伤官》',
                original: '火土伤官宜伤尽；金水伤官要见官；木火见官官有旺；土金官去返成官；惟有水木伤官格，财官两见始为欢。',
                translation: '五行伤官不可一概而论：火土伤官怕见官而宜伤尽，金水伤官因寒喜火官调候，木火、土金、水木各须因气候寒暖与财印配合灵活取用。',
                bookLink: { bookId: 'yuanhaiziping', bookTitle: '渊海子平', chapterId: 'yuanhaiziping-002', chapterTitle: '十神' },
            },
        ],
        bookLinks: [
            { bookId: 'zipingzhenquan', bookTitle: '子平真诠', chapterId: 'zipingzhenquan-037', chapterTitle: '论伤官（附取运）' },
            { bookId: 'yuanhaiziping', bookTitle: '渊海子平', chapterId: 'yuanhaiziping-002', chapterTitle: '十神' },
        ],
    },
    {
        id: 'shishen:偏财',
        category: 'bazi-shishen',
        categoryLabel: '十神',
        title: '偏财',
        subtitle: '我克者 · 同阴阳 · 众人之财',
        aliases: ['才'],
        nature: 'auspicious',
        summary: '日主所克且阴阳相同者为偏财，如甲见戊、乙见己。为流动之财、众人之财与机遇之财，主慷慨豁达、商业眼光敏锐、善于经营变通。',
        focusHint: '喜身强、食伤生财、官星护财；最忌比劫明夺与空亡',
        blocks: [
            {
                heading: '心性',
                items: [
                    { label: '为喜', tone: 'favorable', content: '慷慨大度、圆融豁达、头脑灵活、善抓商机、行动力强、交际手腕老练，不拘小节。' },
                    { label: '为忌', tone: 'unfavorable', content: '挥霍无度、浮躁贪快、喜投机博弈、情感不专，易财来财去难以沉淀。' },
                ],
            },
            {
                heading: '取象',
                items: [
                    { label: '为喜', tone: 'favorable', content: '贸易投资、企业经营、副业横财、人脉变现、流动资金；六亲主父亲，男命亦主异性缘。' },
                    { label: '为忌', tone: 'unfavorable', content: '投资亏损、资金链紧绷、因财生谤、父缘疏离或感情枝节多。' },
                ],
            },
            {
                heading: '要旨',
                paragraphs: ['我克者为财星，同性为偏财。偏财乃众人之财，喜身强相胜、官星护卫，最怕比劫分夺。'],
            },
            {
                heading: '十神功用',
                items: [
                    { label: '生助官杀', content: '身强财旺而见官星，财能滋官，商业资源可顺势转化为社会地位与权责。' },
                    { label: '破印损学', content: '日弱用印而偏财强旺直克印星，称「贪财坏印」，易因逐利分心而损名誉、学业或长辈庇荫。' },
                    { label: '财多身弱', content: '满盘偏财而日主无根无印，虽见商机却力不胜任，反为财所累，须行比劫印绶运方能发越。' },
                ],
            },
        ],
        citations: [
            {
                source: '《渊海子平·论偏财》',
                original: '偏财者，乃众人之财也，只恐兄弟姊妹有夺之，则福不全……偏财好出、亦不惧藏，惟怕有以分夺，反空亡耳……偏财主人慷慨、不甚吝财。',
                translation: '偏财是流通于世间的众人之财，不论透干还是藏支都能发挥作用，最怕比劫（兄弟姐妹）分夺或落入空亡；命带偏财得用者，多性格慷慨大方。',
                bookLink: { bookId: 'yuanhaiziping', bookTitle: '渊海子平', chapterId: 'yuanhaiziping-002', chapterTitle: '十神' },
            },
            {
                source: '《三命通会·论偏财》',
                original: '何谓偏财？乃甲见戊、乙见己之例，非妻所带，乃众人之财也，切忌有姊妹兄弟分夺……经曰：偏财好出，亦不惧藏，唯怕分夺及落空亡。',
                translation: '什么是偏财？如甲见戊、乙见己，不是妻子带来的财，而是众人之财，最怕兄弟姐妹来分夺。古经说：偏财不怕露，也不怕藏，只怕被分夺和落空亡。',
                bookLink: { bookId: 'sanmingtonghui', bookTitle: '三命通会', chapterId: 'sanmingtonghui-060', chapterTitle: '论偏财（一）' },
            },
        ],
        bookLinks: [
            { bookId: 'yuanhaiziping', bookTitle: '渊海子平', chapterId: 'yuanhaiziping-002', chapterTitle: '十神' },
            { bookId: 'sanmingtonghui', bookTitle: '三命通会', chapterId: 'sanmingtonghui-060', chapterTitle: '论偏财（一）' },
            { bookId: 'zipingzhenquan', bookTitle: '子平真诠', chapterId: 'zipingzhenquan-033', chapterTitle: '论财（附取运）' },
        ],
    },
    {
        id: 'shishen:正财',
        category: 'bazi-shishen',
        categoryLabel: '十神',
        title: '正财',
        subtitle: '我克者 · 异阴阳 · 四吉神之一',
        aliases: ['财'],
        nature: 'auspicious',
        summary: '日主所克且阴阳相异者为正财，如甲见己、乙见戊。代表勤劳所得的稳健资产、务实守信与家业根基，男命兼主正妻。',
        focusHint: '财宜得时藏实、身旺能任；忌财多身弱或比劫直夺',
        blocks: [
            {
                heading: '心性',
                items: [
                    { label: '为喜', tone: 'favorable', content: '勤恳踏实、诚实守信、精打细算、重承诺、有家庭责任感，做事步步为营、追求实效。' },
                    { label: '为忌', tone: 'unfavorable', content: '拘谨保守、斤斤计较、格局偏小、过分看重得失，遇大事易瞻前顾后。' },
                ],
            },
            {
                heading: '取象',
                items: [
                    { label: '为喜', tone: 'favorable', content: '薪俸正业、实业积蓄、不动产与固定资产、踏实稳定的收入；男命主贤内助。' },
                    { label: '为忌', tone: 'unfavorable', content: '为生计奔忙、财务压力、守财失机、因钱财起家庭或职场摩擦。' },
                ],
            },
            {
                heading: '要旨',
                paragraphs: ['我克者为财星，异性为正财。故财要得时，不要财多；身健能任，方为己用。'],
            },
            {
                heading: '十神功用',
                items: [
                    { label: '财旺生官', content: '身强财旺且见正官清透，既护财免受比劫之夺，又以财富支撑事业晋升与社会声望。' },
                    { label: '财星佩印', content: '财星略重而日主稍弱时，若位置隔开不相碍，印星生身以任财，反能稳健致富。' },
                    { label: '财多压身', content: '正财叠见而日主虚弱无助，称「富屋贫人」，往往经手钱财多却留存少，须比劫印运帮扶。' },
                ],
            },
        ],
        citations: [
            {
                source: '《渊海子平·论正财》',
                original: '大抵正财，吾妻之财也……必精神康强，然后可以享用之；如吾身方且自萎懦而不振，虽妻财丰厚，但能目视，终不可一毫受用。故财要得时，不要财多。',
                translation: '正财就像实实在在的家业与正妻之财，必须日主自身强健有力才能真正享用；如果日主虚弱，纵使满盘财星也只能眼看而难以落袋。因此正财贵在得令有用，不在于堆砌过多。',
                bookLink: { bookId: 'yuanhaiziping', bookTitle: '渊海子平', chapterId: 'yuanhaiziping-002', chapterTitle: '十神' },
            },
            {
                source: '《子平真诠·论财》',
                original: '财为我克，使用之物也，以能生官，所以为美……财喜根深，不宜太露，然透一位以清用，格所最喜。',
                translation: '财星受日主支配，又能生助正官，因此列为吉神。财星喜地支藏根深厚、不宜满盘虚露遭劫，只在天干清透一位最成美格。',
                bookLink: { bookId: 'zipingzhenquan', bookTitle: '子平真诠', chapterId: 'zipingzhenquan-033', chapterTitle: '论财（附取运）' },
            },
        ],
        bookLinks: [
            { bookId: 'yuanhaiziping', bookTitle: '渊海子平', chapterId: 'yuanhaiziping-002', chapterTitle: '十神' },
            { bookId: 'zipingzhenquan', bookTitle: '子平真诠', chapterId: 'zipingzhenquan-033', chapterTitle: '论财（附取运）' },
        ],
    },
    {
        id: 'shishen:七杀',
        category: 'bazi-shishen',
        categoryLabel: '十神',
        title: '七杀',
        subtitle: '克我者 · 同阴阳 · 偏官权柄',
        aliases: ['杀', '七煞', '偏官'],
        nature: 'neutral',
        summary: '克制日主且阴阳相同者为七杀（又称偏官），如甲见庚、乙见辛。力道猛烈如猛虎，有制化则为威权魄力与大成就，无制攻身则主压力险阻。',
        focusHint: '有制为偏官、无制为七杀；喜食神制杀、印星化杀、羊刃合杀',
        blocks: [
            {
                heading: '心性',
                items: [
                    { label: '为喜', tone: 'favorable', content: '果断刚毅、魄力过人、志向远大、不畏艰险、危机应变力很强，有统御与开拓之威。' },
                    { label: '为忌', tone: 'unfavorable', content: '急躁多疑、好勇斗狠、压力焦虑、易走极端，或长期处于高压紧绷、招小人忌惮之境。' },
                ],
            },
            {
                heading: '取象',
                items: [
                    { label: '为喜', tone: 'favorable', content: '军警司法、核心决策权、高难赛道破局、权威地位、乱局建功；女命兼主偏缘或强势伴侣。' },
                    { label: '为忌', tone: 'unfavorable', content: '突发风险、外伤疾病、小人构陷、职场高压与官非纷争。' },
                ],
            },
            {
                heading: '要旨',
                paragraphs: ['克我者为官杀，同性为偏官七杀。有制伏则为偏官，无制伏则为七杀；偏官有制化为权。'],
            },
            {
                heading: '十神功用',
                items: [
                    { label: '食神制杀', content: '身健杀旺而得食神有力制约，最忌财星转生七杀或偏印夺食，成格多主实干大权。' },
                    { label: '杀印相生', content: '七杀攻身而有正偏印居中通关化杀生身，化戾气为权威与学养，俗称「众杀猖狂，一仁可化」。' },
                    { label: '羊刃驾杀', content: '身强带阳刃与七杀两相抗衡，刚柔相济，主胆略超群、武职或商业搏杀建功。' },
                    { label: '官杀混杂', content: '正官与七杀同透无清，易使行事标准摇摆、压力叠至，须取去留合杀方清。' },
                ],
            },
        ],
        citations: [
            {
                source: '《子平真诠·论偏官》',
                original: '煞以攻身，似非美物，而大贵之格，多存七煞。盖控制得宜，煞为我用，如大英雄大豪杰，似难驾驭，而处之有方，则惊天动地之功，忽焉而就。',
                translation: '七杀虽直接攻克日主，看似凶猛，但大贵之格多带七杀。就像桀骜难驯的豪杰，只要驾驭制化得法，便能成就非凡功业。',
                bookLink: { bookId: 'zipingzhenquan', bookTitle: '子平真诠', chapterId: 'zipingzhenquan-036', chapterTitle: '论偏官（附取运）' },
            },
            {
                source: '《渊海子平·论偏官》',
                original: '有制伏则为偏官，无制伏则为七杀；譬诸小人，御之得其道则可使，失其道则难敌，在吾控御之道何如耳！',
                translation: '有食伤制约或印星化泄时称为偏官（可化为权威），毫无制化且日弱难当时才是攻身七杀，关键全在命局与岁运如何驾驭。',
                bookLink: { bookId: 'yuanhaiziping', bookTitle: '渊海子平', chapterId: 'yuanhaiziping-002', chapterTitle: '十神' },
            },
        ],
        bookLinks: [
            { bookId: 'zipingzhenquan', bookTitle: '子平真诠', chapterId: 'zipingzhenquan-036', chapterTitle: '论偏官（附取运）' },
            { bookId: 'yuanhaiziping', bookTitle: '渊海子平', chapterId: 'yuanhaiziping-002', chapterTitle: '十神' },
            { bookId: 'sanmingtonghui', bookTitle: '三命通会', chapterId: 'sanmingtonghui-058', chapterTitle: '论古人立印食官财名义（一）' },
        ],
    },
    {
        id: 'shishen:正官',
        category: 'bazi-shishen',
        categoryLabel: '十神',
        title: '正官',
        subtitle: '克我者 · 异阴阳 · 四吉神之首',
        aliases: ['官'],
        nature: 'auspicious',
        summary: '克制日主且阴阳相异者为正官，如甲见辛、乙见庚。阴阳有情相约，代表秩序、礼法、名誉、责任感与正规仕途职权，女命兼主正夫。',
        focusHint: '喜清纯一位、财生印护；最忌伤官直克、刑冲破害与官杀混杂',
        blocks: [
            {
                heading: '心性',
                items: [
                    { label: '为喜', tone: 'favorable', content: '端庄正直、恪守规则、自律守信、重视口碑与荣誉、处事稳妥公允，具管理与协调风范。' },
                    { label: '为忌', tone: 'unfavorable', content: '循规蹈矩、胆小怕事、过度在意他人评价，官多为杀时反生自卑压抑与束缚感。' },
                ],
            },
            {
                heading: '取象',
                items: [
                    { label: '为喜', tone: 'favorable', content: '公职管理、名誉头衔、规章制度、上司提拔、体面稳定的社会地位；女命主正缘夫星。' },
                    { label: '为忌', tone: 'unfavorable', content: '条框束缚、上级苛责、声誉受损、官司纠纷；官多无印则变克为压。' },
                ],
            },
            {
                heading: '要旨',
                paragraphs: ['克我者为官杀，异性为正官。正官乃贵气之物，一位清纯为贵，喜财生印护，忌伤官与刑冲。'],
            },
            {
                heading: '十神功用',
                items: [
                    { label: '官印相生', content: '正官配正印，印星化官生身、又能护官免受伤官克损，主仕途清贵、口碑卓著。' },
                    { label: '财官双美', content: '身强得财生官、无劫夺财、无伤破官，名利兼得，易在正规体系中稳步高升。' },
                    { label: '官星约比', content: '命局比劫过旺夺财时，正官居中制约比劫、保护财星，令团队与资产皆入正轨。' },
                ],
            },
        ],
        citations: [
            {
                source: '《子平真诠·论正官》',
                original: '正官者分所当尊，如在国有君，在家有亲，刑冲破害，以下犯上，乌乎可乎？以刑冲破害为忌，则以生之护之为喜矣。',
                translation: '正官代表正当的秩序与贵气，最忌遭遇刑冲破害和伤官以下犯上；因此正官格以财星生官、印星护官为最喜。',
                bookLink: { bookId: 'zipingzhenquan', bookTitle: '子平真诠', chapterId: 'zipingzhenquan-032', chapterTitle: '论正官（附取运）' },
            },
            {
                source: '《渊海子平·正官论》',
                original: '正官仁德性情纯，词馆文章可立身；官印相生逢岁运，玉堂金马坐朝臣。',
                translation: '正官清纯得用者，性情仁厚端正，凭学识品行立身；若原局官印相生又得岁运相助，往往能位列显要。',
                bookLink: { bookId: 'yuanhaiziping', bookTitle: '渊海子平', chapterId: 'yuanhaiziping-002', chapterTitle: '十神' },
            },
        ],
        bookLinks: [
            { bookId: 'zipingzhenquan', bookTitle: '子平真诠', chapterId: 'zipingzhenquan-032', chapterTitle: '论正官（附取运）' },
            { bookId: 'yuanhaiziping', bookTitle: '渊海子平', chapterId: 'yuanhaiziping-002', chapterTitle: '十神' },
        ],
    },
    {
        id: 'shishen:偏印',
        category: 'bazi-shishen',
        categoryLabel: '十神',
        title: '偏印',
        subtitle: '生我者 · 同阴阳 · 枭神与奇思',
        aliases: ['枭', '枭神', '倒食'],
        nature: 'neutral',
        summary: '生扶日主且阴阳相同者为偏印（见食神相克时旧称枭神、倒食），如甲见壬、乙见癸。主敏锐直觉、另辟蹊径、冷门专精与超然独立。',
        focusHint: '喜偏财制枭、七杀相生；最忌无制贴克食神（枭神夺食）',
        blocks: [
            {
                heading: '心性',
                items: [
                    { label: '为喜', tone: 'favorable', content: '机敏深邃、观察力很强、思想独特、不落俗套，擅钻研冷门高深技艺与玄学策划。' },
                    { label: '为忌', tone: 'unfavorable', content: '敏感多疑、孤僻内敛、容易半途而废、计较得失，遇事易想偏或自我封闭。' },
                ],
            },
            {
                heading: '取象',
                items: [
                    { label: '为喜', tone: 'favorable', content: '非传统学术、研发洞察、艺术灵感、玄学宗教、中医技术、幕后谋士与独特专长。' },
                    { label: '为忌', tone: 'unfavorable', content: '枭神夺食引发的计划中断、情绪抑郁、健康失调、反复折腾与人际疏离。' },
                ],
            },
            {
                heading: '要旨',
                paragraphs: ['生我者为印星，同性为偏印；见食神则称倒食、枭神，喜偏财以制之。'],
            },
            {
                heading: '十神功用',
                items: [
                    { label: '化杀生身', content: '七杀攻身而日主偏弱，偏印贴身化杀生身，往往能成就极深的城府、技艺与非常之功。' },
                    { label: '枭神夺食', content: '局中本以食神生财或制杀，若偏印强旺贴身克食且无财解救，主财源中断、情绪受压或计划受挫。' },
                    { label: '财星制枭', content: '偏印为忌而得偏财有力克制，去其孤僻犹豫、留其精明睿智，反能脚踏实地变现才华。' },
                ],
            },
        ],
        citations: [
            {
                source: '《渊海子平·论倒食》',
                original: '夫倒食者，冲财神之谓也，一名吞啖煞。用财神大忌见之，用食神亦忌见之……如甲见丙为食神，能生土财；然壬克丙火，丙火不能生甲木之土财。',
                translation: '偏印在克制食神时被称为倒食（吞啖煞）。以甲木为例，丙火是食神能生土财，若壬水偏印贴身克丙，就断了生财之源，故食神格最忌偏印无制。',
                bookLink: { bookId: 'yuanhaiziping', bookTitle: '渊海子平', chapterId: 'yuanhaiziping-002', chapterTitle: '十神' },
            },
            {
                source: '《三命通会·论古人立印食官财名义》',
                original: '生我者有父母之义，故立名印绶……如壬生甲、癸生乙……阴阳各从其类。',
                translation: '生扶日主者总名印绶，偏印虽与正印同属生我，但因其同性相生、偏克食神，须看全盘是否用食伤或需要化杀来定喜忌。',
                bookLink: { bookId: 'sanmingtonghui', bookTitle: '三命通会', chapterId: 'sanmingtonghui-058', chapterTitle: '论古人立印食官财名义（一）' },
            },
        ],
        bookLinks: [
            { bookId: 'yuanhaiziping', bookTitle: '渊海子平', chapterId: 'yuanhaiziping-002', chapterTitle: '十神' },
            { bookId: 'zipingzhenquan', bookTitle: '子平真诠', chapterId: 'zipingzhenquan-034', chapterTitle: '论印绶（附取运）' },
        ],
    },
    {
        id: 'shishen:正印',
        category: 'bazi-shishen',
        categoryLabel: '十神',
        title: '正印',
        subtitle: '生我者 · 异阴阳 · 四吉神之一',
        aliases: ['印', '印绶'],
        nature: 'auspicious',
        summary: '生扶日主且阴阳相异者为正印，如甲见癸、乙见壬。阴阳有情相生，主仁慈厚道、学识修养、贵人庇荫与安稳根基，六亲主母亲。',
        focusHint: '喜官杀生印、佩伤护身；忌身旺印重或身弱财旺坏印',
        blocks: [
            {
                heading: '心性',
                items: [
                    { label: '为喜', tone: 'favorable', content: '仁慈宽厚、心地善良、安静平和、富有同情心与修养、注重精神内涵、记忆与学习力佳。' },
                    { label: '为忌', tone: 'unfavorable', content: '懒散依赖、行动力偏弱、不思进取、优柔寡断、爱面子，遇事习惯逃避或等靠他人。' },
                ],
            },
            {
                heading: '取象',
                items: [
                    { label: '为喜', tone: 'favorable', content: '学历学位、荣誉证书、靠山贵人、房产田宅、文化教育、体面稳妥的庇护与名望。' },
                    { label: '为忌', tone: 'unfavorable', content: '学业中断、名誉受损、失却依靠、固守旧念、懒惰退缩或因母辈牵绊。' },
                ],
            },
            {
                heading: '要旨',
                paragraphs: ['生日主、扶日主者为印星，异性为正印。有官无印即非真官，有印无官反成其福。'],
            },
            {
                heading: '十神功用',
                items: [
                    { label: '生身', content: '日干弱而印绶生身，最喜官星生印助源；若日干已强又印重无泄，反喜财星制印以防慈母败儿。' },
                    { label: '泄官杀', content: '日干弱而官杀强旺，正印居间化泄官杀转为生身之力，身印两旺则化险为贵。' },
                    { label: '御伤', content: '日干弱而伤官泄气太过，正印可驾驭伤官护日主，形成「伤官佩印」；若身强印旺，则喜财旺克印或食伤泄秀。' },
                    { label: '挫食', content: '正印过重亦会压制食神生财与表达欲，使人流于空想少实干，须有财星或清透食神调衡。' },
                ],
            },
        ],
        citations: [
            {
                source: '《渊海子平·论印绶》',
                original: '夫印绶者，生我之谓也，亦名生气。以阳见阴，以阴见阳，谓之正印……喜官星生印，忌财旺破印。',
                translation: '印绶是生扶日主的生气，阴阳相异而生我者为正印。最喜官星生印，忌财星过旺破印。',
                bookLink: { bookId: 'yuanhaiziping', bookTitle: '渊海子平', chapterId: 'yuanhaiziping-002', chapterTitle: '十神' },
            },
            {
                source: '《子平真诠·论印绶》',
                original: '印绶喜其生身，正偏同为美格，故财与印不分偏正，同为一格而论之。',
                translation: '印绶以生扶日主为喜，正印、偏印都是好格局，所以印和财一样，不分正偏，归为一格来论。',
                bookLink: { bookId: 'zipingzhenquan', bookTitle: '子平真诠', chapterId: 'zipingzhenquan-034', chapterTitle: '论印绶（附取运）' },
            },
        ],
        bookLinks: [
            { bookId: 'yuanhaiziping', bookTitle: '渊海子平', chapterId: 'yuanhaiziping-002', chapterTitle: '十神' },
            { bookId: 'zipingzhenquan', bookTitle: '子平真诠', chapterId: 'zipingzhenquan-034', chapterTitle: '论印绶（附取运）' },
            { bookId: 'sanmingtonghui', bookTitle: '三命通会', chapterId: 'sanmingtonghui-058', chapterTitle: '论古人立印食官财名义（一）' },
        ],
    },
];

const LIU_QIN_LINK = { bookId: 'yuanhaiziping', bookTitle: '渊海子平', chapterId: 'yuanhaiziping-004', chapterTitle: '六亲' };

/** 六亲：依《渊海子平·六亲》，以日干为主；女命只有官杀、食伤与男命不同 */
const LIU_QIN: Record<string, { male: string; female?: string }> = {
    比肩: { male: '兄弟姐妹（以甲日为例，见甲为兄）。', female: '兄弟姐妹。' },
    劫财: { male: '兄弟姐妹（以甲日为例，见乙为弟妹）。', female: '兄弟姐妹。' },
    食神: { male: '孙子。', female: '儿子。' },
    伤官: { male: '孙女，兼论祖母。', female: '女儿。' },
    偏财: { male: '父亲；又为妾。', female: '父亲。' },
    正财: { male: '妻子。' },
    七杀: { male: '儿子。', female: '偏夫。' },
    正官: { male: '女儿。', female: '丈夫（夫星）。' },
    偏印: { male: '偏母（继母、庶母），兼论祖父。', female: '偏母，兼论祖父。' },
    正印: { male: '母亲。', female: '母亲。' },
};

function withLiuQin(entry: GlossaryEntry): GlossaryEntry {
    const kin = LIU_QIN[entry.title];
    if (!kin) return entry;
    const block = {
        heading: '六亲',
        paragraphs: ['依《渊海子平·六亲》，以日干为主：'],
        items: [
            { label: '男命', content: kin.male },
            ...(kin.female ? [{ label: '女命', content: kin.female }] : []),
        ],
    };
    const at = entry.blocks.findIndex((b) => b.heading === '取象');
    const blocks = [...entry.blocks];
    blocks.splice(at >= 0 ? at + 1 : blocks.length, 0, block);
    return { ...entry, blocks, bookLinks: [...entry.bookLinks, LIU_QIN_LINK] };
}

export const BAZI_SHISHEN_GLOSSARY: GlossaryEntry[] = SHISHEN_ENTRIES.map(withLiuQin);
