import { BaziShenShaCatalogItem } from './bazi-types';

const SOURCE = 'https://www.fatemaster.ai/guides/shensha';

const CATALOG: BaziShenShaCatalogItem[] = [
    { key: 'tian-yi-gui-ren', fullName: '天乙贵人', aliases: ['天乙'], category: '贵人', description: '主贵人与助力。', sourceRefs: [SOURCE] },
    { key: 'tian-de-gui-ren', fullName: '天德贵人', aliases: ['天德'], category: '贵人', description: '主德助与逢凶化吉。', sourceRefs: [SOURCE] },
    { key: 'yue-de-gui-ren', fullName: '月德贵人', aliases: ['月德'], category: '贵人', description: '主人缘与缓和冲突。', sourceRefs: [SOURCE] },
    { key: 'tai-ji-gui-ren', fullName: '太极贵人', aliases: ['太极'], category: '贵人', description: '主悟性与学术潜力。', sourceRefs: [SOURCE] },
    { key: 'wen-chang-gui-ren', fullName: '文昌贵人', aliases: ['文昌'], category: '文名', description: '主学业、文书与考试。', sourceRefs: [SOURCE] },
    { key: 'guo-yin-gui-ren', fullName: '国印贵人', aliases: ['国印'], category: '权柄', description: '主权柄、管理与名望。', sourceRefs: [SOURCE] },
    { key: 'xue-tang', fullName: '学堂', aliases: [], category: '文名', description: '主学习力与受教环境。', sourceRefs: [SOURCE] },
    { key: 'ci-guan', fullName: '词馆', aliases: [], category: '文名', description: '主表达、修辞与文采。', sourceRefs: [SOURCE] },
    { key: 'lu-shen', fullName: '禄神', aliases: [], category: '禄命', description: '主禄位、财禄与事业根基。', sourceRefs: [SOURCE] },
    { key: 'yi-ma', fullName: '驿马', aliases: [], category: '动象', description: '主迁移、奔波与流动。', sourceRefs: [SOURCE] },
    { key: 'tao-hua', fullName: '桃花', aliases: [], category: '人缘', description: '主人缘、魅力与情感。', sourceRefs: [SOURCE] },
    { key: 'hong-luan', fullName: '红鸾', aliases: [], category: '喜庆', description: '主婚恋与喜事机缘。', sourceRefs: [SOURCE] },
    { key: 'tian-xi', fullName: '天喜', aliases: [], category: '喜庆', description: '主庆贺、情感与喜讯。', sourceRefs: [SOURCE] },
    { key: 'yang-ren', fullName: '羊刃', aliases: [], category: '刚烈', description: '主刚烈、执行力与冲劲。', sourceRefs: [SOURCE] },
    { key: 'jie-sha', fullName: '劫煞', aliases: [], category: '煞曜', description: '主突发阻滞与竞争。', sourceRefs: [SOURCE] },
    { key: 'zai-sha', fullName: '灾煞', aliases: [], category: '煞曜', description: '主波折与外在干扰。', sourceRefs: [SOURCE] },
    { key: 'kong-wang', fullName: '空亡', aliases: [], category: '虚耗', description: '主虚耗、延迟与落空。', sourceRefs: [SOURCE] },
    { key: 'fu-xing-gui-ren', fullName: '福星贵人', aliases: ['福星'], category: '贵人', description: '主福泽与贵助。', sourceRefs: [SOURCE] },
    { key: 'tian-chu-gui-ren', fullName: '天厨贵人', aliases: ['天厨'], category: '福禄', description: '主口福、享受与物资。', sourceRefs: [SOURCE] },
    { key: 'de-xiu-gui-ren', fullName: '德秀贵人', aliases: ['德秀'], category: '贵人', description: '主才德与文雅气质。', sourceRefs: [SOURCE] },
    { key: 'tian-yi', fullName: '天医', aliases: [], category: '医药', description: '主医药缘与康复力。', sourceRefs: [SOURCE] },
    { key: 'yue-de-he', fullName: '月德合', aliases: [], category: '合曜', description: '月德合化，缓和冲克。', sourceRefs: [SOURCE] },
    { key: 'tian-de-he', fullName: '天德合', aliases: [], category: '合曜', description: '天德合化，主和解。', sourceRefs: [SOURCE] },
    { key: 'san-qi-gui-ren', fullName: '三奇贵人', aliases: [], category: '贵人', description: '三奇连珠，主机巧与机遇。', sourceRefs: [SOURCE] },
    { key: 'jiang-xing', fullName: '将星', aliases: [], category: '权柄', description: '主统领、决断与威势。', sourceRefs: [SOURCE] },
    { key: 'hua-gai', fullName: '华盖', aliases: [], category: '气质', description: '主艺术、宗教与孤高。', sourceRefs: [SOURCE] },
    { key: 'kui-gang', fullName: '魁罡', aliases: [], category: '格局', description: '主刚强与特立。', sourceRefs: [SOURCE] },
    { key: 'fei-ren', fullName: '飞刃', aliases: [], category: '煞曜', description: '主冲动与锋芒。', sourceRefs: [SOURCE] },
    { key: 'xue-ren', fullName: '血刃', aliases: [], category: '煞曜', description: '主血光与外伤风险。', sourceRefs: [SOURCE] },
    { key: 'gou-jiao-sha', fullName: '勾绞煞', aliases: [], category: '煞曜', description: '主纠缠、牵扯与牵连。', sourceRefs: [SOURCE] },
    { key: 'yuan-chen', fullName: '元辰', aliases: [], category: '煞曜', description: '主心性波动与阻滞。', sourceRefs: [SOURCE] },
    { key: 'gu-chen', fullName: '孤辰', aliases: [], category: '孤寡', description: '主孤独感与情感疏离。', sourceRefs: [SOURCE] },
    { key: 'gua-su', fullName: '寡宿', aliases: [], category: '孤寡', description: '主寡缘与独处倾向。', sourceRefs: [SOURCE] },
    { key: 'hong-yan-sha', fullName: '红艳煞', aliases: ['红艳'], category: '人缘', description: '主异性缘与情感波动。', sourceRefs: [SOURCE] },
    { key: 'wang-shen', fullName: '亡神', aliases: [], category: '煞曜', description: '主精神压力与失误。', sourceRefs: [SOURCE] },
    { key: 'jin-yu', fullName: '金舆', aliases: [], category: '福禄', description: '主体面、享受与资源。', sourceRefs: [SOURCE] },
    { key: 'jin-shen', fullName: '金神', aliases: [], category: '格局', description: '主刚决与锐气。', sourceRefs: [SOURCE] },
    { key: 'tian-she-ri', fullName: '天赦日', aliases: ['天赦'], category: '吉曜', description: '主解厄与缓解。', sourceRefs: [SOURCE] },
    { key: 'liu-xia', fullName: '流霞', aliases: [], category: '煞曜', description: '主口舌与血气。', sourceRefs: [SOURCE] },
    { key: 'sang-men', fullName: '丧门', aliases: [], category: '丧煞', description: '主丧忧与家门烦忧。', sourceRefs: [SOURCE] },
    { key: 'diao-ke', fullName: '吊客', aliases: [], category: '丧煞', description: '主外来不宁与吊慰。', sourceRefs: [SOURCE] },
    { key: 'pi-ma', fullName: '披麻', aliases: [], category: '丧煞', description: '主服麻孝事之象。', sourceRefs: [SOURCE] },
    { key: 'tong-zi-sha', fullName: '童子煞', aliases: ['童子'], category: '煞曜', description: '主特殊敏感与波折。', sourceRefs: [SOURCE] },
    { key: 'shi-ling-ri', fullName: '十灵日', aliases: ['十灵'], category: '日煞', description: '十灵日曜。', sourceRefs: [SOURCE] },
    { key: 'ba-zhuan-ri', fullName: '八专日', aliases: ['八专'], category: '日煞', description: '八专日曜。', sourceRefs: [SOURCE] },
    { key: 'liu-xiu-ri', fullName: '六秀日', aliases: [], category: '日曜', description: '六秀日曜。', sourceRefs: [SOURCE] },
    { key: 'jiu-chou-ri', fullName: '九丑日', aliases: ['九丑'], category: '日煞', description: '九丑日曜。', sourceRefs: [SOURCE] },
    { key: 'si-fei-ri', fullName: '四废日', aliases: ['四废'], category: '日煞', description: '四废日曜。', sourceRefs: [SOURCE] },
    { key: 'shi-e-da-bai', fullName: '十恶大败', aliases: [], category: '日煞', description: '主财禄受损与失守。', sourceRefs: [SOURCE] },
    { key: 'tian-luo-di-wang', fullName: '天罗地网', aliases: ['天罗', '地网'], category: '煞曜', description: '主束缚、牵制与阻碍。', sourceRefs: [SOURCE] },
    { key: 'yin-cha-yang-cuo', fullName: '阴差阳错', aliases: [], category: '煞曜', description: '主错配与误差。', sourceRefs: [SOURCE] },
    { key: 'gu-luan-sha', fullName: '孤鸾煞', aliases: ['孤鸾'], category: '煞曜', description: '主婚恋波折。', sourceRefs: [SOURCE] },
    { key: 'gong-lu', fullName: '拱禄', aliases: [], category: '禄命', description: '主禄位与助力。', sourceRefs: [SOURCE] },
    { key: 'di-zhuan-ri', fullName: '地转日', aliases: [], category: '日煞', description: '地转日曜。', sourceRefs: [SOURCE] },
    { key: 'tian-zhuan-ri', fullName: '天转日', aliases: [], category: '日煞', description: '天转日曜。', sourceRefs: [SOURCE] },
];

export const BAZI_SHENSHA_CATALOG = CATALOG;

export const BAZI_SHENSHA_ALIAS_TO_FULLNAME: Record<string, string> = CATALOG.reduce<Record<string, string>>(
    (acc, item) => {
        acc[item.fullName] = item.fullName;
        item.aliases.forEach((alias) => {
            acc[alias] = item.fullName;
        });
        return acc;
    },
    {}
);

export const BAZI_SHENSHA_FULLNAME_SET = new Set(CATALOG.map((item) => item.fullName));
