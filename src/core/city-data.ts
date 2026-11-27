/**
 * 中国行政区数据与地区选择模型
 * 数据来源：xiangyuecn/AreaCity-JsSpider-StatsGov 2025.251231.260403 (MIT)
 * 内置全国 34 个省级行政区、全部地市与区县的离线 WGS-84 经纬度（4 位小数）
 */

import rawRegionsJson from '../data/china-regions.json';

type RawDistrictTuple = readonly [code: string, name: string, longitude: number, latitude: number];
type RawCityTuple = readonly [code: string, name: string, districts: readonly RawDistrictTuple[]];
type RawProvinceTuple = readonly [code: string, name: string, cities: readonly RawCityTuple[]];

const regionSource = rawRegionsJson as unknown as readonly RawProvinceTuple[];

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

const provinces: ProvinceOption[] = [];
const cities: CityOption[] = [];
const districts: DistrictOption[] = [];
const provinceByCode = new Map<string, ProvinceOption>();
const cityByCode = new Map<string, CityOption>();
const districtByCode = new Map<string, DistrictOption>();
const coordinatesByDistrictCode = new Map<string, { longitude: number; latitude: number }>();
const citiesByProvinceCode = new Map<string, CityOption[]>();
const districtsByCityCode = new Map<string, DistrictOption[]>();
const districtsByProvinceCode = new Map<string, DistrictOption[]>();

for (const [provinceCode, provinceName, rawCities] of regionSource) {
    const provinceOption: ProvinceOption = { code: provinceCode, name: provinceName };
    provinces.push(provinceOption);
    provinceByCode.set(provinceCode, provinceOption);

    const provinceCities: CityOption[] = [];
    const provinceDistricts: DistrictOption[] = [];

    for (const [cityCode, cityName, rawDistricts] of rawCities) {
        const cityOption: CityOption = {
            code: cityCode,
            name: cityName,
            provinceCode,
        };
        cities.push(cityOption);
        provinceCities.push(cityOption);
        cityByCode.set(cityCode, cityOption);

        const cityDistricts: DistrictOption[] = [];
        for (const [districtCode, districtName, longitude, latitude] of rawDistricts) {
            const districtOption: DistrictOption = {
                code: districtCode,
                name: districtName,
                provinceCode,
                cityCode,
            };
            districts.push(districtOption);
            cityDistricts.push(districtOption);
            provinceDistricts.push(districtOption);
            districtByCode.set(districtCode, districtOption);
            coordinatesByDistrictCode.set(districtCode, { longitude, latitude });
        }

        districtsByCityCode.set(cityCode, cityDistricts);
    }

    citiesByProvinceCode.set(provinceCode, provinceCities);
    districtsByProvinceCode.set(provinceCode, provinceDistricts);
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

function isRedundantNextSegment(prev: string, next: string): boolean {
    const normPrev = normalizeRegionSegmentForDisplay(prev);
    const normNext = normalizeRegionSegmentForDisplay(next);
    if (normPrev === '重庆' && (next === '重庆城区' || next === '重庆郊县')) {
        return true;
    }
    if (normPrev !== normNext) {
        return false;
    }
    // 保留不同行政层级的同名省/地区与地级/县级市（如 吉林省 / 吉林市、和田地区 / 和田市）
    if ((prev.endsWith('省') || prev.endsWith('地区')) && next.endsWith('市')) {
        return false;
    }
    return true;
}

function dedupeRegionSegments(parts: Array<string | undefined>): string[] {
    return parts
        .map((item) => item?.trim() || '')
        .filter(Boolean)
        .reduce<string[]>((acc, item) => {
            const prev = acc[acc.length - 1];
            if (prev && isRedundantNextSegment(prev, item)) {
                return acc;
            }
            acc.push(item);
            return acc;
        }, []);
}

function buildCandidateFromDistrict(district: DistrictOption): RegionCandidate {
    const province = provinceByCode.get(district.provinceCode);
    const city = cityByCode.get(district.cityCode);

    return {
        provinceCode: province?.code || district.provinceCode,
        provinceName: province?.name || district.provinceCode,
        cityCode: city?.code || district.cityCode,
        cityName: city?.name || province?.name || district.cityCode,
        districtCode: district.code,
        districtName: district.name,
    };
}

interface IndexedRegion extends RegionSearchResult {
    normalizedDisplay: string;
    normalizedAliases: string[];
}

const districtSearchIndex: IndexedRegion[] = districts.map((district) => {
    const candidate = buildCandidateFromDistrict(district);
    const displayName = buildRegionDisplayName(candidate);
    const normalizedDisplay = normalizeRegionText(displayName);
    const aliasSet = new Set<string>([
        normalizedDisplay,
        normalizeRegionText(`${candidate.provinceName}${candidate.cityName}${candidate.districtName}`),
    ]);
    // 兼容历史记录中省/地区与同名市被折叠的写法（如 吉林省船营区、新疆维吾尔自治区和田地区）
    if (candidate.provinceName.endsWith('省')
        && candidate.cityName.endsWith('市')
        && normalizeRegionSegmentForDisplay(candidate.provinceName) === normalizeRegionSegmentForDisplay(candidate.cityName)) {
        aliasSet.add(normalizeRegionText(`${candidate.provinceName}${candidate.districtName}`));
    }
    if (candidate.cityName.endsWith('地区')
        && candidate.districtName.endsWith('市')
        && normalizeRegionSegmentForDisplay(candidate.cityName) === normalizeRegionSegmentForDisplay(candidate.districtName)) {
        aliasSet.add(normalizeRegionText(`${candidate.provinceName}${candidate.cityName}`));
    }

    return {
        ...candidate,
        label: buildRegionPathLabel(candidate),
        normalizedDisplay,
        normalizedAliases: Array.from(aliasSet),
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

export function getRegionCoordinates(
    districtCode: string,
): { longitude: number; latitude: number } | null {
    if (!districtCode) {
        return null;
    }
    const coords = coordinatesByDistrictCode.get(districtCode);
    return coords ? { longitude: coords.longitude, latitude: coords.latitude } : null;
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
        .filter((item) => item.normalizedAliases.some((alias) => alias.includes(normalizedKeyword)))
        .slice(0, limit)
        .map(({ normalizedDisplay: _normalizedDisplay, normalizedAliases: _normalizedAliases, ...result }) => result);
}

export function resolveRegionCandidate(input: Partial<RegionCandidate>): RegionCandidate | null {
    if (input.districtCode) {
        const exactDistrict = districtByCode.get(input.districtCode);
        if (exactDistrict) {
            return buildCandidateFromDistrict(exactDistrict);
        }
    }

    const normalizedProvinceName = normalizeRegionText(input.provinceName || '');
    const province = (input.provinceCode ? provinceByCode.get(input.provinceCode) : undefined)
        || (normalizedProvinceName
            ? provinces.find((item) => normalizeRegionText(item.name) === normalizedProvinceName)
            : undefined);
    if (!province) {
        return null;
    }

    const provinceCities = getCitiesByProvinceCode(province.code);
    const normalizedCityName = normalizeRegionText(input.cityName || '');
    const normalizedDistrictName = normalizeRegionText(input.districtName || '');

    let city = (input.cityCode ? provinceCities.find((item) => item.code === input.cityCode) : undefined)
        || (normalizedCityName
            ? provinceCities.find((item) => normalizeRegionText(item.name) === normalizedCityName)
            : undefined)
        || (provinceCities.length === 1 ? provinceCities[0] : undefined);

    if (!city) {
        // 兼容旧版「省直辖县级行政区划」或直辖市/已撤并地市：先按区县名在省内精确回查
        if (normalizedDistrictName) {
            const matchedInProvince = (districtsByProvinceCode.get(province.code) || []).find(
                (item) => normalizeRegionText(item.name) === normalizedDistrictName,
            );
            if (matchedInProvince) {
                return buildCandidateFromDistrict(matchedInProvince);
            }
        }
        // 兼容旧版直辖市（如重庆市下 cityName 为「重庆市」但新版分「重庆城区 / 重庆郊县」）
        if (normalizedCityName && normalizedCityName === normalizeRegionText(province.name) && provinceCities.length > 0) {
            city = provinceCities[0];
        } else {
            return null;
        }
    }

    const cityDistricts = getDistrictsByCityCode(city.code);
    const district = (input.districtCode ? cityDistricts.find((item) => item.code === input.districtCode) : undefined)
        || (normalizedDistrictName
            ? cityDistricts.find((item) => normalizeRegionText(item.name) === normalizedDistrictName)
            : undefined)
        || (!input.districtName || cityDistricts.length === 1 || Boolean(input.districtCode)
            ? cityDistricts[0]
            : undefined);
    if (!district) {
        return null;
    }

    return buildCandidateFromDistrict(district);
}

export function findRegionCandidateByDisplayText(placeText: string): RegionCandidate | null {
    const normalizedText = normalizeRegionText(placeText);
    if (!normalizedText) {
        return null;
    }

    const exact = districtSearchIndex.find((item) => item.normalizedAliases.includes(normalizedText));
    if (exact) {
        const {
            label: _label,
            normalizedDisplay: _normalizedDisplay,
            normalizedAliases: _normalizedAliases,
            ...result
        } = exact;
        return result;
    }

    const fuzzy = districtSearchIndex.find((item) =>
        item.normalizedAliases.some((alias) => alias.includes(normalizedText) || normalizedText.includes(alias)),
    );
    if (!fuzzy) {
        return null;
    }

    const {
        label: _label,
        normalizedDisplay: _normalizedDisplay,
        normalizedAliases: _normalizedAliases,
        ...result
    } = fuzzy;
    return result;
}

export function buildRegionSelection(
    candidate: RegionCandidate,
    coordinates: { longitude: number; latitude: number | null },
): RegionSelection {
    return {
        provinceCode: candidate.provinceCode,
        provinceName: candidate.provinceName,
        cityCode: candidate.cityCode,
        cityName: candidate.cityName,
        districtCode: candidate.districtCode,
        districtName: candidate.districtName,
        longitude: coordinates.longitude,
        latitude: coordinates.latitude,
    };
}

export function resolveRegionSelection(candidate: RegionCandidate): RegionSelection | null {
    const directCoords = getRegionCoordinates(candidate.districtCode);
    if (directCoords) {
        return buildRegionSelection(candidate, directCoords);
    }

    const resolved = resolveRegionCandidate(candidate);
    if (!resolved) {
        return null;
    }
    const resolvedCoords = getRegionCoordinates(resolved.districtCode);
    if (!resolvedCoords) {
        return null;
    }
    return buildRegionSelection(resolved, resolvedCoords);
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
