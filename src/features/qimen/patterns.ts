/**
 * 奇门十干克应（天地盘 81 组合格局）与五不遇时判定。
 * 格局名与核心释义依《奇门遁甲秘笈大全》通行口径，仅作结构化盘面注记。
 */
export interface QimenStemPattern {
    name: string;
    meaning: string;
    /** 偏吉 / 偏凶 / 中性，仅用于参考提示，不替代全盘综合判断。 */
    tone: 'auspicious' | 'caution' | 'neutral';
}

const PATTERNS: Record<string, QimenStemPattern> = {
    戊戊: { name: '青龙伏吟', meaning: '伏吟停滞，宜守静待时，不宜轻动。', tone: 'neutral' },
    戊己: { name: '贵人入狱', meaning: '公私皆有牵绊，推进易受卡阻。', tone: 'caution' },
    戊庚: { name: '值符飞宫', meaning: '吉事不吉、凶事更凶，主变动换位或失守。', tone: 'caution' },
    戊辛: { name: '青龙折足', meaning: '吉门尚可谋为，凶门防失足破财。', tone: 'caution' },
    戊壬: { name: '青龙入天牢', meaning: '阴阳不和，诸事多阻滞难顺。', tone: 'caution' },
    戊癸: { name: '青龙华盖', meaning: '吉门合招福，凶门多乖戾反复。', tone: 'neutral' },
    戊丁: { name: '青龙耀明', meaning: '见贵谋望易成，利于公开推进与亮明主张。', tone: 'auspicious' },
    戊丙: { name: '青龙返首', meaning: '事有回转得利之象，逢门迫、入墓、击刑则减力。', tone: 'auspicious' },
    戊乙: { name: '青龙合灵', meaning: '门吉事吉、门凶事凶，宜顺势借助外力。', tone: 'neutral' },

    己戊: { name: '犬遇青龙', meaning: '门吉谋望遂意，门凶则徒劳耗力。', tone: 'neutral' },
    己己: { name: '地户逢鬼', meaning: '易生疑虑拖延，忌冲动冒进。', tone: 'caution' },
    己庚: { name: '刑格返名', meaning: '先谋易受阻，竞争或纠纷不利先动。', tone: 'caution' },
    己辛: { name: '游魂入墓', meaning: '思路易迷糊犯错，防暗中损耗。', tone: 'caution' },
    己壬: { name: '地网高张', meaning: '是非纠缠，谋事难舒展。', tone: 'caution' },
    己癸: { name: '地刑玄武', meaning: '防私下纠葛、暗耗或失信反复。', tone: 'caution' },
    己丁: { name: '朱雀入墓', meaning: '消息与文书先曲后直，易藏而不露。', tone: 'neutral' },
    己丙: { name: '火悖地户', meaning: '刚猛遇暗阻，易因急躁惹是非。', tone: 'caution' },
    己乙: { name: '墓神不明', meaning: '前景朦胧，宜静守观察、不宜强推。', tone: 'caution' },

    庚戊: { name: '天乙伏宫', meaning: '大格阻滞，合作与推进阻力重重。', tone: 'caution' },
    庚己: { name: '官符刑格', meaning: '规则或私务生纠葛，易被掣肘。', tone: 'caution' },
    庚庚: { name: '太白同宫', meaning: '战格碰撞，多争执拉锯、损耗大。', tone: 'caution' },
    庚辛: { name: '白虎干格', meaning: '激进推进或远行易受挫受损。', tone: 'caution' },
    庚壬: { name: '小格', meaning: '动荡多变，消息反复难定。', tone: 'caution' },
    庚癸: { name: '大格', meaning: '诸事阻隔多变，不宜急进强攻。', tone: 'caution' },
    庚丁: { name: '亭亭之格', meaning: '易因内部牵扯或私情生变。', tone: 'neutral' },
    庚丙: { name: '太白入荧', meaning: '贼必来，防突发冲击与回撤压制。', tone: 'caution' },
    庚乙: { name: '太白蓬星', meaning: '退吉进凶，宜防守收敛、忌强攻。', tone: 'caution' },

    辛戊: { name: '困龙被伤', meaning: '防因错判或激进操作致损财受困。', tone: 'caution' },
    辛己: { name: '入狱自刑', meaning: '内部失误或自缚手脚，宜止损自省。', tone: 'caution' },
    辛庚: { name: '白虎出力', meaning: '强硬碰撞，退让则免伤、硬顶易损。', tone: 'caution' },
    辛辛: { name: '伏吟天庭', meaning: '自纠自耗，宜检讨旧错、不宜加码。', tone: 'caution' },
    辛壬: { name: '凶蛇入狱', meaning: '两方僵持难下，易陷胶着。', tone: 'caution' },
    辛癸: { name: '天牢华盖', meaning: '误入罗网，动辄受限。', tone: 'caution' },
    辛丁: { name: '狱神得奇', meaning: '困境中藏转机，逢吉门有望解困。', tone: 'auspicious' },
    辛丙: { name: '干合悖师', meaning: '因财或合作起分歧，门吉尚可合。', tone: 'neutral' },
    辛乙: { name: '白虎猖狂', meaning: '强压克柔，防突发下挫或关系破裂。', tone: 'caution' },

    壬戊: { name: '小蛇化龙', meaning: '逢吉门得助则有跃升突破之机。', tone: 'auspicious' },
    壬己: { name: '反吟蛇刑', meaning: '反复折腾、顺中有阻，宜先稳后动。', tone: 'caution' },
    壬庚: { name: '太白擒蛇', meaning: '遇强阻难行，易立判曲直。', tone: 'caution' },
    壬辛: { name: '腾蛇相缠', meaning: '纠缠反复、假象偏多，难以速决。', tone: 'caution' },
    壬壬: { name: '天狱自刑', meaning: '内外牵绊，变动多而实功少。', tone: 'caution' },
    壬癸: { name: '幼女奸淫', meaning: '易被表面利好诱惑，暗藏损耗。', tone: 'caution' },
    壬丁: { name: '干合蛇刑', meaning: '表面和合而内藏波动，契约宜审慎。', tone: 'neutral' },
    壬丙: { name: '水蛇入火', meaning: '急躁易失序，防情绪化操作。', tone: 'caution' },
    壬乙: { name: '小蛇得势', meaning: '柔顺借势，见好可收。', tone: 'auspicious' },

    癸戊: { name: '天乙会合', meaning: '财喜相合，门吉易成，门凶防反目。', tone: 'neutral' },
    癸己: { name: '华盖地户', meaning: '暗昧不明，宜静待信号明朗。', tone: 'caution' },
    癸庚: { name: '太白入网', meaning: '以暴争锋易自陷罗网。', tone: 'caution' },
    癸辛: { name: '网盖天牢', meaning: '受困难脱，防错误加码。', tone: 'caution' },
    癸壬: { name: '复见腾蛇', meaning: '旧患重来或二次震荡，难一步到位。', tone: 'caution' },
    癸癸: { name: '天网四张', meaning: '四面受阻，宜守忌冒进。', tone: 'caution' },
    癸丁: { name: '腾蛇夭矫', meaning: '消息虚惊、上下剧烈晃动。', tone: 'caution' },
    癸丙: { name: '华盖悖师', meaning: '反常生变，吉凶易骤转。', tone: 'caution' },
    癸乙: { name: '华盖逢星', meaning: '贵人暗助，逢吉门可缓步化解。', tone: 'neutral' },

    丁戊: { name: '青龙转光', meaning: '渐入佳境，得助推进。', tone: 'auspicious' },
    丁己: { name: '火入勾陈', meaning: '私下纠葛，谋事多曲折。', tone: 'caution' },
    丁庚: { name: '文书阻隔', meaning: '消息或计划受阻，往来拖延。', tone: 'caution' },
    丁辛: { name: '朱雀入狱', meaning: '先困后舒，忌急于求成。', tone: 'neutral' },
    丁壬: { name: '奇仪相合', meaning: '合作契合或得助沟通，利于协商。', tone: 'auspicious' },
    丁癸: { name: '朱雀投江', meaning: '消息落空、文书有失或预期落空。', tone: 'caution' },
    丁丁: { name: '奇入太阴', meaning: '文书消息偏吉，谋事较顺畅。', tone: 'auspicious' },
    丁丙: { name: '星随月转', meaning: '得势推进，防过热生变。', tone: 'auspicious' },
    丁乙: { name: '玉女奇生', meaning: '得机缘助力，宜稳步落实。', tone: 'auspicious' },

    丙戊: { name: '飞鸟跌穴', meaning: '顺势得利、易有突破机会，逢门迫入墓则减力。', tone: 'auspicious' },
    丙己: { name: '火悖入刑', meaning: '事多反复纠葛，防冲动出错。', tone: 'caution' },
    丙庚: { name: '荧入太白', meaning: '贼必去，阻力有望退散或换手出清。', tone: 'neutral' },
    丙辛: { name: '谋事就成', meaning: '丙辛相合，逢吉门易达成目标。', tone: 'auspicious' },
    丙壬: { name: '火入天罗', meaning: '虽有热势但受外网牵制，防乐极生变。', tone: 'caution' },
    丙癸: { name: '华盖悖师', meaning: '热势受浇，防突发利空或暗耗。', tone: 'caution' },
    丙丁: { name: '星奇朱雀', meaning: '文书消息偏吉，常人宜守稳。', tone: 'auspicious' },
    丙丙: { name: '月奇悖师', meaning: '文书消息易生紊乱或情绪过热。', tone: 'caution' },
    丙乙: { name: '日月并行', meaning: '公私皆宜，明暗配合顺畅。', tone: 'auspicious' },

    乙戊: { name: '阴害阳门', meaning: '利暗中布局蓄势，忌高调强攻。', tone: 'neutral' },
    乙己: { name: '日奇入雾', meaning: '前景朦胧，逢吉门可渐明、凶门难测。', tone: 'caution' },
    乙庚: { name: '日奇被刑', meaning: '竞争争执、受阻力压制。', tone: 'caution' },
    乙辛: { name: '青龙逃走', meaning: '失势回撤或主动撤离，防筹码/资金流失。', tone: 'caution' },
    乙壬: { name: '日奇入地', meaning: '受暗流牵制，是非易起。', tone: 'caution' },
    乙癸: { name: '华盖逢星', meaning: '宜隐忍蓄势、暂避锋芒。', tone: 'neutral' },
    乙丁: { name: '奇仪相佐', meaning: '谋划与文书得助，利于协作。', tone: 'auspicious' },
    乙丙: { name: '奇仪顺遂', meaning: '吉星易顺势受益，凶星防分歧波动。', tone: 'auspicious' },
    乙乙: { name: '日奇伏吟', meaning: '原地踏步，宜静观待变。', tone: 'neutral' },
};

export function getQimenStemPattern(heavenStem: string | null, earthStem: string, hiddenStem?: string): QimenStemPattern | null {
    if (!heavenStem) return null;
    const h = heavenStem === '甲' ? (hiddenStem ?? '') : heavenStem;
    const e = earthStem === '甲' ? (hiddenStem ?? '') : earthStem;
    return PATTERNS[h + e] ?? null;
}

const WU_BU_YU_SHI: Record<string, string> = {
    甲: '庚午', 乙: '辛巳', 丙: '壬辰', 丁: '癸卯', 戊: '甲寅',
    己: '乙丑', 庚: '丙子', 辛: '丁酉', 壬: '戊申', 癸: '己未',
};

/** 时干克日干且同阴阳为五不遇时。 */
export function isWuBuYuShi(dayPillar: string, hourPillar: string): boolean {
    return WU_BU_YU_SHI[dayPillar[0]] === hourPillar;
}
