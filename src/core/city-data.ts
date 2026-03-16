/**
 * 中国行政区数据与地区选择模型
 * 基于 GB/T 2260 省 / 市 / 区县数据构建三级联动与搜索能力
 */

interface RawProvince {
    code: string;
    name: string;
    province: string;
}

interface RawCity {
    code: string;
    name: string;
    province: string;
    city: string;
}

interface RawArea {
    code: string;
    name: string;
    province: string;
    city: string;
    area: string;
}

const provinceSource = require('@province-city-china/province') as RawProvince[];
const citySource = require('@province-city-china/city') as RawCity[];
const areaSource = require('@province-city-china/area') as RawArea[];

export interface LegacyCityInfo {
    name: string;
    province: string;
    longitude: number;
    latitude?: number | null;
}

export interface RegionCandidate {
    provinceCode: string;
    provinceName: string;
    cityCode: string;
    cityName: string;
    districtCode: string;
    districtName: string;
}

export interface RegionSelection extends RegionCandidate {
    longitude: number;
    latitude: number | null;
}

export interface ProvinceOption {
    code: string;
    name: string;
}

export interface CityOption {
    code: string;
    name: string;
    provinceCode: string;
}

export interface DistrictOption {
    code: string;
    name: string;
    provinceCode: string;
    cityCode: string;
}

export interface RegionSearchResult extends RegionCandidate {
    label: string;
}

const provinces: ProvinceOption[] = provinceSource.map((item) => ({
    code: item.code,
    name: item.name,
}));

const provinceByCode = new Map(provinces.map((item) => [item.code, item]));

function getSyntheticCityName(provinceName: string, cityCode: string): string {
    if (cityCode === '110100') {
        return '北京';
    }
    if (cityCode === '120100') {
        return '天津';
    }
    if (cityCode === '310100') {
        return '上海';
    }
    if (cityCode === '500100') {
        return '重庆城区';
    }
    if (cityCode === '500200') {
        return '重庆郊县';
    }
    return provinceName;
}

const baseCities: CityOption[] = citySource.map((item) => ({
    code: item.code,
    name: item.name,
    provinceCode: `${item.province}0000`,
}));

const districts: DistrictOption[] = areaSource.map((item) => ({
    code: item.code,
    name: item.name,
    provinceCode: `${item.province}0000`,
    cityCode: `${item.province}${item.city}00`,
}));

const syntheticCitiesMap = new Map<string, CityOption>();
for (const district of districts) {
    const province = provinceByCode.get(district.provinceCode);
    if (!province) {
        continue;
    }
    const hasBaseCity = baseCities.some((item) => item.code === district.cityCode);
    if (hasBaseCity || syntheticCitiesMap.has(district.cityCode)) {
        continue;
    }

    syntheticCitiesMap.set(district.cityCode, {
        code: district.cityCode,
        name: getSyntheticCityName(province.name, district.cityCode),
        provinceCode: province.code,
    });
}

const cities: CityOption[] = [...baseCities, ...Array.from(syntheticCitiesMap.values())];
const cityByCode = new Map(cities.map((item) => [item.code, item]));
const districtByCode = new Map(districts.map((item) => [item.code, item]));

const citiesByProvinceCode = new Map<string, CityOption[]>();
for (const city of cities) {
    const list = citiesByProvinceCode.get(city.provinceCode);
    if (list) {
        list.push(city);
    } else {
        citiesByProvinceCode.set(city.provinceCode, [city]);
    }
}

const districtsByCityCode = new Map<string, DistrictOption[]>();
for (const district of districts) {
    const list = districtsByCityCode.get(district.cityCode);
    if (list) {
        list.push(district);
    } else {
        districtsByCityCode.set(district.cityCode, [district]);
    }
}

const REGION_SUFFIX_PATTERN = /特别行政区|自治区|自治州|自治县|矿区|林区|群岛|省|市|区|县|盟|旗/g;
const REGION_DISPLAY_DEDUP_SUFFIX_PATTERN = /特别行政区|自治区|自治州|自治县|省|市|地区|盟/g;

function normalizeRegionText(value: string): string {
    return value
        .trim()
        .replace(/\s+/g, '')
        .replace(REGION_SUFFIX_PATTERN, '')
        .toLowerCase();
}

function normalizeRegionSegmentForDisplay(value: string): string {
    return value
        .trim()
        .replace(/\s+/g, '')
        .replace(REGION_DISPLAY_DEDUP_SUFFIX_PATTERN, '')
        .toLowerCase();
}

function dedupeRegionSegments(parts: Array<string | undefined>): string[] {
    return parts
        .map((item) => item?.trim() || '')
        .filter(Boolean)
        .reduce<string[]>((acc, item) => {
            const prev = acc[acc.length - 1];
            if (prev && normalizeRegionSegmentForDisplay(prev) === normalizeRegionSegmentForDisplay(item)) {
                return acc;
            }
            acc.push(item);
            return acc;
        }, []);
}

function buildCandidateFromDistrict(district: DistrictOption): RegionCandidate {
    const province = provinceByCode.get(district.provinceCode);
    const city = cityByCode.get(district.cityCode)
        || (province
            ? {
                code: district.cityCode,
                name: getSyntheticCityName(province.name, district.cityCode),
                provinceCode: province.code,
            }
            : null);

    if (!province) {
        return {
            provinceCode: district.provinceCode,
            provinceName: district.provinceCode,
            cityCode: district.cityCode,
            cityName: city?.name || district.cityCode,
            districtCode: district.code,
            districtName: district.name,
        };
    }

    return {
        provinceCode: province.code,
        provinceName: province.name,
        cityCode: city?.code || district.cityCode,
        cityName: city?.name || province.name,
        districtCode: district.code,
        districtName: district.name,
    };
}

const districtSearchIndex: Array<RegionSearchResult & { normalizedText: string }> = districts.map((district) => {
    const candidate = buildCandidateFromDistrict(district);
    return {
        ...candidate,
        label: buildRegionPathLabel(candidate),
        normalizedText: normalizeRegionText(buildRegionDisplayName(candidate)),
    };
});

export function buildRegionDisplayName(
    region: Pick<RegionCandidate, 'provinceName' | 'cityName' | 'districtName'>,
): string {
    return dedupeRegionSegments([region.provinceName, region.cityName, region.districtName]).join('');
}

export function buildRegionPathLabel(
    region: Pick<RegionCandidate, 'provinceName' | 'cityName' | 'districtName'>,
): string {
    return dedupeRegionSegments([region.provinceName, region.cityName, region.districtName]).join(' / ');
}

export function getProvinceOptions(): ProvinceOption[] {
    return provinces;
}

export function getCitiesByProvinceCode(provinceCode: string): CityOption[] {
    return citiesByProvinceCode.get(provinceCode) || [];
}

export function getDistrictsByCityCode(cityCode: string): DistrictOption[] {
    return districtsByCityCode.get(cityCode) || [];
}

export function getDefaultRegionCandidate(): RegionCandidate {
    const province = provinces[0];
    const city = getCitiesByProvinceCode(province.code)[0];
    const district = getDistrictsByCityCode(city.code)[0];

    if (!province || !city || !district) {
        throw new Error('行政区默认数据缺失');
    }

    return {
        provinceCode: province.code,
        provinceName: province.name,
        cityCode: city.code,
        cityName: city.name,
        districtCode: district.code,
        districtName: district.name,
    };
}

export function searchRegions(keyword: string, limit: number = 20): RegionSearchResult[] {
    const normalizedKeyword = normalizeRegionText(keyword);
    if (!normalizedKeyword) {
        return [];
    }

    return districtSearchIndex
        .filter((item) => item.normalizedText.includes(normalizedKeyword))
        .slice(0, limit)
        .map(({ normalizedText: _normalizedText, ...result }) => result);
}

export function resolveRegionCandidate(input: Partial<RegionCandidate>): RegionCandidate | null {
    if (input.districtCode) {
        const district = districtByCode.get(input.districtCode);
        if (district) {
            return buildCandidateFromDistrict(district);
        }
    }

    const province = input.provinceCode
        ? provinceByCode.get(input.provinceCode)
        : provinces.find((item) => normalizeRegionText(item.name) === normalizeRegionText(input.provinceName || ''));
    if (!province) {
        return null;
    }

    const provinceCities = getCitiesByProvinceCode(province.code);
    const city = input.cityCode
        ? provinceCities.find((item) => item.code === input.cityCode)
        : provinceCities.find((item) => normalizeRegionText(item.name) === normalizeRegionText(input.cityName || ''));
    if (!city) {
        return null;
    }

    const cityDistricts = getDistrictsByCityCode(city.code);
    const district = input.districtCode
        ? cityDistricts.find((item) => item.code === input.districtCode)
        : (input.districtName
            ? cityDistricts.find((item) => normalizeRegionText(item.name) === normalizeRegionText(input.districtName || ''))
            : cityDistricts[0]);
    if (!district) {
        return null;
    }

    return {
        provinceCode: province.code,
        provinceName: province.name,
        cityCode: city.code,
        cityName: city.name,
        districtCode: district.code,
        districtName: district.name,
    };
}

export function findRegionCandidateByDisplayText(placeText: string): RegionCandidate | null {
    const normalizedText = normalizeRegionText(placeText);
    if (!normalizedText) {
        return null;
    }

    const exact = districtSearchIndex.find((item) => item.normalizedText === normalizedText);
    if (exact) {
        return exact;
    }

    const fuzzy = districtSearchIndex.find((item) =>
        item.normalizedText.includes(normalizedText) || normalizedText.includes(item.normalizedText),
    );

    return fuzzy || null;
}

export function buildRegionSelection(
    candidate: RegionCandidate,
    coordinates: { longitude: number; latitude: number | null },
): RegionSelection {
    return {
        ...candidate,
        longitude: coordinates.longitude,
        latitude: coordinates.latitude,
    };
}

export function isLegacyCityInfo(value: unknown): value is LegacyCityInfo {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const candidate = value as Partial<LegacyCityInfo>;
    return typeof candidate.name === 'string'
        && typeof candidate.province === 'string'
        && typeof candidate.longitude === 'number';
}

export function isRegionSelection(value: unknown): value is RegionSelection {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const candidate = value as Partial<RegionSelection>;
    return typeof candidate.provinceName === 'string'
        && typeof candidate.cityName === 'string'
        && typeof candidate.districtName === 'string'
        && typeof candidate.longitude === 'number';
}
