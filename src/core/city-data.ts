/**
 * 中国主要城市经纬度数据库
 * 用于真太阳时计算
 * 包含所有省会城市、直辖市及主要地级市
 */

export interface CityInfo {
    name: string;       // 城市名
    province: string;   // 省/自治区/直辖市
    longitude: number;  // 经度（东经）
    latitude: number;   // 纬度（北纬）
}

/** 省份列表（按地理区域排序） */
export const PROVINCES = [
    '北京', '天津', '上海', '重庆',
    '河北', '山西', '辽宁', '吉林', '黑龙江',
    '江苏', '浙江', '安徽', '福建', '江西', '山东',
    '河南', '湖北', '湖南', '广东', '广西',
    '海南', '四川', '贵州', '云南', '西藏',
    '陕西', '甘肃', '青海', '宁夏', '新疆',
    '内蒙古', '台湾', '香港', '澳门',
] as const;

/** 按省份分组的城市数据 */
export const CITIES: Record<string, CityInfo[]> = {
    '北京': [
        { name: '北京', province: '北京', longitude: 116.41, latitude: 39.90 },
    ],
    '天津': [
        { name: '天津', province: '天津', longitude: 117.20, latitude: 39.13 },
    ],
    '上海': [
        { name: '上海', province: '上海', longitude: 121.47, latitude: 31.23 },
    ],
    '重庆': [
        { name: '重庆', province: '重庆', longitude: 106.55, latitude: 29.56 },
    ],
    '河北': [
        { name: '石家庄', province: '河北', longitude: 114.51, latitude: 38.04 },
        { name: '唐山', province: '河北', longitude: 118.18, latitude: 39.63 },
        { name: '秦皇岛', province: '河北', longitude: 119.60, latitude: 39.94 },
        { name: '邯郸', province: '河北', longitude: 114.54, latitude: 36.63 },
        { name: '保定', province: '河北', longitude: 115.46, latitude: 38.87 },
        { name: '张家口', province: '河北', longitude: 114.88, latitude: 40.77 },
        { name: '承德', province: '河北', longitude: 117.96, latitude: 40.95 },
        { name: '沧州', province: '河北', longitude: 116.84, latitude: 38.31 },
        { name: '廊坊', province: '河北', longitude: 116.68, latitude: 39.54 },
        { name: '衡水', province: '河北', longitude: 115.67, latitude: 37.74 },
        { name: '邢台', province: '河北', longitude: 114.50, latitude: 37.07 },
    ],
    '山西': [
        { name: '太原', province: '山西', longitude: 112.55, latitude: 37.87 },
        { name: '大同', province: '山西', longitude: 113.30, latitude: 40.08 },
        { name: '阳泉', province: '山西', longitude: 113.58, latitude: 37.86 },
        { name: '长治', province: '山西', longitude: 113.12, latitude: 36.20 },
        { name: '晋城', province: '山西', longitude: 112.85, latitude: 35.50 },
        { name: '朔州', province: '山西', longitude: 112.43, latitude: 39.33 },
        { name: '临汾', province: '山西', longitude: 111.52, latitude: 36.09 },
        { name: '运城', province: '山西', longitude: 111.01, latitude: 35.03 },
    ],
    '辽宁': [
        { name: '沈阳', province: '辽宁', longitude: 123.43, latitude: 41.80 },
        { name: '大连', province: '辽宁', longitude: 121.61, latitude: 38.91 },
        { name: '鞍山', province: '辽宁', longitude: 122.99, latitude: 41.11 },
        { name: '抚顺', province: '辽宁', longitude: 123.96, latitude: 41.87 },
        { name: '本溪', province: '辽宁', longitude: 123.77, latitude: 41.29 },
        { name: '丹东', province: '辽宁', longitude: 124.38, latitude: 40.12 },
        { name: '锦州', province: '辽宁', longitude: 121.13, latitude: 41.10 },
        { name: '营口', province: '辽宁', longitude: 122.23, latitude: 40.67 },
    ],
    '吉林': [
        { name: '长春', province: '吉林', longitude: 125.32, latitude: 43.88 },
        { name: '吉林', province: '吉林', longitude: 126.55, latitude: 43.84 },
        { name: '四平', province: '吉林', longitude: 124.37, latitude: 43.17 },
        { name: '通化', province: '吉林', longitude: 125.94, latitude: 41.73 },
        { name: '白城', province: '吉林', longitude: 122.84, latitude: 45.62 },
        { name: '延吉', province: '吉林', longitude: 129.51, latitude: 42.89 },
    ],
    '黑龙江': [
        { name: '哈尔滨', province: '黑龙江', longitude: 126.63, latitude: 45.75 },
        { name: '齐齐哈尔', province: '黑龙江', longitude: 123.97, latitude: 47.35 },
        { name: '牡丹江', province: '黑龙江', longitude: 129.63, latitude: 44.55 },
        { name: '佳木斯', province: '黑龙江', longitude: 130.37, latitude: 46.80 },
        { name: '大庆', province: '黑龙江', longitude: 125.10, latitude: 46.59 },
        { name: '绥化', province: '黑龙江', longitude: 126.97, latitude: 46.65 },
    ],
    '江苏': [
        { name: '南京', province: '江苏', longitude: 118.80, latitude: 32.06 },
        { name: '苏州', province: '江苏', longitude: 120.62, latitude: 31.30 },
        { name: '无锡', province: '江苏', longitude: 120.31, latitude: 31.49 },
        { name: '常州', province: '江苏', longitude: 119.97, latitude: 31.78 },
        { name: '徐州', province: '江苏', longitude: 117.28, latitude: 34.21 },
        { name: '南通', province: '江苏', longitude: 120.86, latitude: 31.98 },
        { name: '连云港', province: '江苏', longitude: 119.22, latitude: 34.60 },
        { name: '扬州', province: '江苏', longitude: 119.41, latitude: 32.39 },
        { name: '盐城', province: '江苏', longitude: 120.16, latitude: 33.35 },
        { name: '镇江', province: '江苏', longitude: 119.45, latitude: 32.20 },
        { name: '泰州', province: '江苏', longitude: 119.92, latitude: 32.46 },
        { name: '宿迁', province: '江苏', longitude: 118.28, latitude: 33.96 },
        { name: '淮安', province: '江苏', longitude: 119.02, latitude: 33.61 },
    ],
    '浙江': [
        { name: '杭州', province: '浙江', longitude: 120.15, latitude: 30.27 },
        { name: '宁波', province: '浙江', longitude: 121.55, latitude: 29.87 },
        { name: '温州', province: '浙江', longitude: 120.70, latitude: 28.00 },
        { name: '嘉兴', province: '浙江', longitude: 120.76, latitude: 30.77 },
        { name: '湖州', province: '浙江', longitude: 120.09, latitude: 30.89 },
        { name: '绍兴', province: '浙江', longitude: 120.58, latitude: 30.00 },
        { name: '金华', province: '浙江', longitude: 119.65, latitude: 29.08 },
        { name: '台州', province: '浙江', longitude: 121.42, latitude: 28.66 },
    ],
    '安徽': [
        { name: '合肥', province: '安徽', longitude: 117.28, latitude: 31.86 },
        { name: '芜湖', province: '安徽', longitude: 118.38, latitude: 31.33 },
        { name: '蚌埠', province: '安徽', longitude: 117.39, latitude: 32.92 },
        { name: '淮南', province: '安徽', longitude: 117.02, latitude: 32.63 },
        { name: '马鞍山', province: '安徽', longitude: 118.51, latitude: 31.67 },
        { name: '安庆', province: '安徽', longitude: 117.05, latitude: 30.53 },
        { name: '黄山', province: '安徽', longitude: 118.34, latitude: 29.72 },
        { name: '阜阳', province: '安徽', longitude: 115.81, latitude: 32.89 },
    ],
    '福建': [
        { name: '福州', province: '福建', longitude: 119.30, latitude: 26.08 },
        { name: '厦门', province: '福建', longitude: 118.09, latitude: 24.48 },
        { name: '泉州', province: '福建', longitude: 118.68, latitude: 24.87 },
        { name: '漳州', province: '福建', longitude: 117.65, latitude: 24.51 },
        { name: '莆田', province: '福建', longitude: 119.01, latitude: 25.43 },
        { name: '龙岩', province: '福建', longitude: 117.02, latitude: 25.08 },
        { name: '三明', province: '福建', longitude: 117.64, latitude: 26.26 },
        { name: '南平', province: '福建', longitude: 118.18, latitude: 26.64 },
    ],
    '江西': [
        { name: '南昌', province: '江西', longitude: 115.89, latitude: 28.68 },
        { name: '景德镇', province: '江西', longitude: 117.18, latitude: 29.27 },
        { name: '九江', province: '江西', longitude: 116.00, latitude: 29.70 },
        { name: '赣州', province: '江西', longitude: 114.93, latitude: 25.83 },
        { name: '吉安', province: '江西', longitude: 114.99, latitude: 27.11 },
        { name: '上饶', province: '江西', longitude: 117.97, latitude: 28.45 },
    ],
    '山东': [
        { name: '济南', province: '山东', longitude: 117.02, latitude: 36.67 },
        { name: '青岛', province: '山东', longitude: 120.38, latitude: 36.07 },
        { name: '烟台', province: '山东', longitude: 121.45, latitude: 37.46 },
        { name: '潍坊', province: '山东', longitude: 119.16, latitude: 36.71 },
        { name: '淄博', province: '山东', longitude: 118.05, latitude: 36.81 },
        { name: '济宁', province: '山东', longitude: 116.59, latitude: 35.40 },
        { name: '临沂', province: '山东', longitude: 118.34, latitude: 35.10 },
        { name: '威海', province: '山东', longitude: 122.12, latitude: 37.51 },
        { name: '日照', province: '山东', longitude: 119.53, latitude: 35.42 },
        { name: '德州', province: '山东', longitude: 116.36, latitude: 37.43 },
        { name: '聊城', province: '山东', longitude: 115.98, latitude: 36.45 },
        { name: '泰安', province: '山东', longitude: 117.09, latitude: 36.19 },
        { name: '菏泽', province: '山东', longitude: 115.44, latitude: 35.24 },
        { name: '枣庄', province: '山东', longitude: 117.32, latitude: 34.81 },
    ],
    '河南': [
        { name: '郑州', province: '河南', longitude: 113.65, latitude: 34.76 },
        { name: '洛阳', province: '河南', longitude: 112.45, latitude: 34.62 },
        { name: '开封', province: '河南', longitude: 114.31, latitude: 34.80 },
        { name: '南阳', province: '河南', longitude: 112.53, latitude: 33.00 },
        { name: '安阳', province: '河南', longitude: 114.39, latitude: 36.10 },
        { name: '新乡', province: '河南', longitude: 113.88, latitude: 35.30 },
        { name: '许昌', province: '河南', longitude: 113.85, latitude: 34.04 },
        { name: '信阳', province: '河南', longitude: 114.07, latitude: 32.13 },
        { name: '周口', province: '河南', longitude: 114.70, latitude: 33.63 },
        { name: '驻马店', province: '河南', longitude: 114.02, latitude: 33.01 },
    ],
    '湖北': [
        { name: '武汉', province: '湖北', longitude: 114.31, latitude: 30.59 },
        { name: '宜昌', province: '湖北', longitude: 111.29, latitude: 30.69 },
        { name: '襄阳', province: '湖北', longitude: 112.14, latitude: 32.04 },
        { name: '荆州', province: '湖北', longitude: 112.24, latitude: 30.33 },
        { name: '十堰', province: '湖北', longitude: 110.80, latitude: 32.63 },
        { name: '黄冈', province: '湖北', longitude: 114.87, latitude: 30.44 },
        { name: '孝感', province: '湖北', longitude: 113.92, latitude: 30.92 },
        { name: '咸宁', province: '湖北', longitude: 114.32, latitude: 29.84 },
    ],
    '湖南': [
        { name: '长沙', province: '湖南', longitude: 112.94, latitude: 28.23 },
        { name: '株洲', province: '湖南', longitude: 113.13, latitude: 27.83 },
        { name: '湘潭', province: '湖南', longitude: 112.94, latitude: 27.83 },
        { name: '衡阳', province: '湖南', longitude: 112.57, latitude: 26.89 },
        { name: '岳阳', province: '湖南', longitude: 113.13, latitude: 29.36 },
        { name: '常德', province: '湖南', longitude: 111.70, latitude: 29.03 },
        { name: '郴州', province: '湖南', longitude: 113.01, latitude: 25.77 },
        { name: '永州', province: '湖南', longitude: 111.61, latitude: 26.42 },
    ],
    '广东': [
        { name: '广州', province: '广东', longitude: 113.26, latitude: 23.13 },
        { name: '深圳', province: '广东', longitude: 114.06, latitude: 22.55 },
        { name: '珠海', province: '广东', longitude: 113.58, latitude: 22.27 },
        { name: '佛山', province: '广东', longitude: 113.12, latitude: 23.02 },
        { name: '东莞', province: '广东', longitude: 113.75, latitude: 23.05 },
        { name: '中山', province: '广东', longitude: 113.39, latitude: 22.52 },
        { name: '惠州', province: '广东', longitude: 114.42, latitude: 23.11 },
        { name: '汕头', province: '广东', longitude: 116.68, latitude: 23.35 },
        { name: '湛江', province: '广东', longitude: 110.36, latitude: 21.27 },
        { name: '江门', province: '广东', longitude: 113.08, latitude: 22.58 },
        { name: '茂名', province: '广东', longitude: 110.93, latitude: 21.66 },
        { name: '肇庆', province: '广东', longitude: 112.46, latitude: 23.05 },
        { name: '梅州', province: '广东', longitude: 116.12, latitude: 24.29 },
        { name: '清远', province: '广东', longitude: 113.06, latitude: 23.68 },
    ],
    '广西': [
        { name: '南宁', province: '广西', longitude: 108.37, latitude: 22.82 },
        { name: '柳州', province: '广西', longitude: 109.41, latitude: 24.33 },
        { name: '桂林', province: '广西', longitude: 110.29, latitude: 25.27 },
        { name: '梧州', province: '广西', longitude: 111.28, latitude: 23.47 },
        { name: '北海', province: '广西', longitude: 109.12, latitude: 21.48 },
        { name: '玉林', province: '广西', longitude: 110.15, latitude: 22.63 },
        { name: '百色', province: '广西', longitude: 106.62, latitude: 23.90 },
        { name: '河池', province: '广西', longitude: 108.06, latitude: 24.70 },
    ],
    '海南': [
        { name: '海口', province: '海南', longitude: 110.35, latitude: 20.02 },
        { name: '三亚', province: '海南', longitude: 109.51, latitude: 18.25 },
        { name: '儋州', province: '海南', longitude: 109.58, latitude: 19.52 },
    ],
    '四川': [
        { name: '成都', province: '四川', longitude: 104.07, latitude: 30.67 },
        { name: '绵阳', province: '四川', longitude: 104.73, latitude: 31.47 },
        { name: '德阳', province: '四川', longitude: 104.40, latitude: 31.13 },
        { name: '宜宾', province: '四川', longitude: 104.64, latitude: 28.75 },
        { name: '南充', province: '四川', longitude: 106.11, latitude: 30.80 },
        { name: '自贡', province: '四川', longitude: 104.78, latitude: 29.34 },
        { name: '乐山', province: '四川', longitude: 103.77, latitude: 29.55 },
        { name: '泸州', province: '四川', longitude: 105.44, latitude: 28.87 },
        { name: '达州', province: '四川', longitude: 107.47, latitude: 31.21 },
        { name: '内江', province: '四川', longitude: 105.06, latitude: 29.58 },
        { name: '攀枝花', province: '四川', longitude: 101.72, latitude: 26.58 },
    ],
    '贵州': [
        { name: '贵阳', province: '贵州', longitude: 106.71, latitude: 26.65 },
        { name: '遵义', province: '贵州', longitude: 106.93, latitude: 27.73 },
        { name: '六盘水', province: '贵州', longitude: 104.83, latitude: 26.59 },
        { name: '安顺', province: '贵州', longitude: 105.95, latitude: 26.25 },
        { name: '毕节', province: '贵州', longitude: 105.29, latitude: 27.30 },
    ],
    '云南': [
        { name: '昆明', province: '云南', longitude: 102.83, latitude: 25.05 },
        { name: '曲靖', province: '云南', longitude: 103.80, latitude: 25.49 },
        { name: '玉溪', province: '云南', longitude: 102.55, latitude: 24.35 },
        { name: '大理', province: '云南', longitude: 100.23, latitude: 25.59 },
        { name: '丽江', province: '云南', longitude: 100.23, latitude: 26.86 },
        { name: '红河', province: '云南', longitude: 103.38, latitude: 23.36 },
        { name: '西双版纳', province: '云南', longitude: 100.80, latitude: 22.01 },
    ],
    '西藏': [
        { name: '拉萨', province: '西藏', longitude: 91.11, latitude: 29.65 },
        { name: '日喀则', province: '西藏', longitude: 88.88, latitude: 29.27 },
        { name: '林芝', province: '西藏', longitude: 94.36, latitude: 29.65 },
    ],
    '陕西': [
        { name: '西安', province: '陕西', longitude: 108.94, latitude: 34.27 },
        { name: '咸阳', province: '陕西', longitude: 108.71, latitude: 34.33 },
        { name: '宝鸡', province: '陕西', longitude: 107.24, latitude: 34.36 },
        { name: '渭南', province: '陕西', longitude: 109.50, latitude: 34.50 },
        { name: '汉中', province: '陕西', longitude: 107.02, latitude: 33.07 },
        { name: '延安', province: '陕西', longitude: 109.49, latitude: 36.60 },
        { name: '榆林', province: '陕西', longitude: 109.73, latitude: 38.28 },
        { name: '安康', province: '陕西', longitude: 109.02, latitude: 32.68 },
    ],
    '甘肃': [
        { name: '兰州', province: '甘肃', longitude: 103.84, latitude: 36.06 },
        { name: '天水', province: '甘肃', longitude: 105.72, latitude: 34.58 },
        { name: '白银', province: '甘肃', longitude: 104.14, latitude: 36.54 },
        { name: '庆阳', province: '甘肃', longitude: 107.64, latitude: 35.73 },
        { name: '平凉', province: '甘肃', longitude: 106.67, latitude: 35.54 },
        { name: '酒泉', province: '甘肃', longitude: 98.49, latitude: 39.73 },
        { name: '嘉峪关', province: '甘肃', longitude: 98.27, latitude: 39.80 },
        { name: '武威', province: '甘肃', longitude: 102.64, latitude: 37.93 },
    ],
    '青海': [
        { name: '西宁', province: '青海', longitude: 101.78, latitude: 36.62 },
        { name: '海东', province: '青海', longitude: 102.10, latitude: 36.50 },
        { name: '格尔木', province: '青海', longitude: 94.90, latitude: 36.42 },
    ],
    '宁夏': [
        { name: '银川', province: '宁夏', longitude: 106.27, latitude: 38.47 },
        { name: '石嘴山', province: '宁夏', longitude: 106.38, latitude: 39.02 },
        { name: '吴忠', province: '宁夏', longitude: 106.20, latitude: 37.99 },
        { name: '固原', province: '宁夏', longitude: 106.24, latitude: 36.02 },
        { name: '中卫', province: '宁夏', longitude: 105.20, latitude: 37.50 },
    ],
    '新疆': [
        { name: '乌鲁木齐', province: '新疆', longitude: 87.62, latitude: 43.83 },
        { name: '克拉玛依', province: '新疆', longitude: 84.87, latitude: 45.60 },
        { name: '吐鲁番', province: '新疆', longitude: 89.19, latitude: 42.95 },
        { name: '哈密', province: '新疆', longitude: 93.51, latitude: 42.82 },
        { name: '昌吉', province: '新疆', longitude: 87.31, latitude: 44.01 },
        { name: '库尔勒', province: '新疆', longitude: 86.15, latitude: 41.76 },
        { name: '阿克苏', province: '新疆', longitude: 80.26, latitude: 41.17 },
        { name: '喀什', province: '新疆', longitude: 75.99, latitude: 39.47 },
        { name: '伊宁', province: '新疆', longitude: 81.33, latitude: 43.91 },
    ],
    '内蒙古': [
        { name: '呼和浩特', province: '内蒙古', longitude: 111.75, latitude: 40.84 },
        { name: '包头', province: '内蒙古', longitude: 109.84, latitude: 40.66 },
        { name: '赤峰', province: '内蒙古', longitude: 118.89, latitude: 42.26 },
        { name: '鄂尔多斯', province: '内蒙古', longitude: 109.98, latitude: 39.81 },
        { name: '呼伦贝尔', province: '内蒙古', longitude: 119.77, latitude: 49.21 },
        { name: '通辽', province: '内蒙古', longitude: 122.24, latitude: 43.65 },
        { name: '乌海', province: '内蒙古', longitude: 106.79, latitude: 39.66 },
    ],
    '台湾': [
        { name: '台北', province: '台湾', longitude: 121.56, latitude: 25.04 },
        { name: '高雄', province: '台湾', longitude: 120.31, latitude: 22.62 },
        { name: '台中', province: '台湾', longitude: 120.68, latitude: 24.14 },
        { name: '台南', province: '台湾', longitude: 120.23, latitude: 22.99 },
    ],
    '香港': [
        { name: '香港', province: '香港', longitude: 114.17, latitude: 22.32 },
    ],
    '澳门': [
        { name: '澳门', province: '澳门', longitude: 113.55, latitude: 22.19 },
    ],
};

/**
 * 获取所有城市列表（扁平化）
 */
export function getAllCities(): CityInfo[] {
    const all: CityInfo[] = [];
    for (const cities of Object.values(CITIES)) {
        all.push(...cities);
    }
    return all;
}

/**
 * 按名称搜索城市
 */
export function searchCities(keyword: string): CityInfo[] {
    if (!keyword.trim()) return [];
    const all = getAllCities();
    return all.filter(c =>
        c.name.includes(keyword) || c.province.includes(keyword)
    ).slice(0, 20);
}
