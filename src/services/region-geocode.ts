import AsyncStorage from '@react-native-async-storage/async-storage';
import { buildRegionSelection, RegionCandidate, RegionSelection } from '../core/city-data';
import { getSettings } from './settings';

const TENCENT_GEOCODE_URL = 'https://apis.map.qq.com/ws/geocoder/v1/';
const REGION_COORDINATE_CACHE_KEY = 'settings_region_coordinate_cache_v1';

interface RegionCoordinateCacheEntry {
    longitude: number;
    latitude: number | null;
    updatedAt: string;
}

type RegionCoordinateCache = Record<string, RegionCoordinateCacheEntry>;

interface TencentGeocodeResponse {
    status?: number;
    message?: string;
    result?: {
        location?: {
            lat?: number;
            lng?: number;
        };
        ad_info?: {
            adcode?: string;
        };
    };
}

async function readCoordinateCache(): Promise<RegionCoordinateCache> {
    try {
        const raw = await AsyncStorage.getItem(REGION_COORDINATE_CACHE_KEY);
        if (!raw) {
            return {};
        }
        const parsed = JSON.parse(raw) as RegionCoordinateCache;
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

async function writeCoordinateCache(cache: RegionCoordinateCache): Promise<void> {
    await AsyncStorage.setItem(REGION_COORDINATE_CACHE_KEY, JSON.stringify(cache));
}

export async function getCachedRegionCoordinates(
    districtCode: string,
): Promise<{ longitude: number; latitude: number | null } | null> {
    if (!districtCode) {
        return null;
    }

    const cache = await readCoordinateCache();
    const entry = cache[districtCode];
    if (!entry) {
        return null;
    }

    return {
        longitude: entry.longitude,
        latitude: entry.latitude,
    };
}

export async function hasCachedRegionCoordinates(districtCode: string): Promise<boolean> {
    const cached = await getCachedRegionCoordinates(districtCode);
    return cached !== null;
}

async function cacheRegionCoordinates(
    districtCode: string,
    coordinates: { longitude: number; latitude: number | null },
): Promise<void> {
    const cache = await readCoordinateCache();
    cache[districtCode] = {
        ...coordinates,
        updatedAt: new Date().toISOString(),
    };
    await writeCoordinateCache(cache);
}

function parseTencentLocation(
    location: { lat?: number; lng?: number } | undefined,
): { longitude: number; latitude: number | null } | null {
    if (!location) {
        return null;
    }

    const longitude = Number(location.lng);
    const latitude = Number(location.lat);
    if (!Number.isFinite(longitude)) {
        return null;
    }

    return {
        longitude,
        latitude: Number.isFinite(latitude) ? latitude : null,
    };
}

async function fetchTencentCoordinates(candidate: RegionCandidate): Promise<{ longitude: number; latitude: number | null }> {
    const settings = await getSettings();
    const geocoderApiKey = settings.geocoderApiKey.trim();

    if (!geocoderApiKey) {
        throw new Error('请先在设置中填写腾讯位置服务 Key。');
    }

    const query = [
        `key=${encodeURIComponent(geocoderApiKey)}`,
        `address=${encodeURIComponent(`${candidate.provinceName}${candidate.cityName}${candidate.districtName}`)}`,
        'output=json',
    ].join('&');

    const response = await fetch(`${TENCENT_GEOCODE_URL}?${query}`, {
        method: 'GET',
        headers: {
            Accept: 'application/json',
        },
    });

    if (!response.ok) {
        throw new Error(`地区解析失败：${response.status}`);
    }

    const data = await response.json() as TencentGeocodeResponse;
    if (data.status !== 0 || !data.result?.location) {
        throw new Error(data.message || '未找到对应区县坐标');
    }

    const coordinates = parseTencentLocation(data.result.location);
    if (!coordinates) {
        throw new Error('地理编码返回了无效坐标');
    }

    const resolvedAdcode = data.result.ad_info?.adcode;
    if (resolvedAdcode && resolvedAdcode !== candidate.districtCode) {
        throw new Error('腾讯位置服务返回的行政区与当前区县不一致');
    }

    return coordinates;
}

export async function resolveRegionSelection(candidate: RegionCandidate): Promise<RegionSelection> {
    const cached = await getCachedRegionCoordinates(candidate.districtCode);
    if (cached) {
        return buildRegionSelection(candidate, cached);
    }

    const coordinates = await fetchTencentCoordinates(candidate);
    await cacheRegionCoordinates(candidate.districtCode, coordinates);
    return buildRegionSelection(candidate, coordinates);
}
