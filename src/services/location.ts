/**
 * 位置存储服务
 * 使用 AsyncStorage 持久化用户选择的地区
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    isLegacyCityInfo,
    isRegionSelection,
    RegionSelection,
    resolveRegionCandidate,
} from '../core/city-data';

const LOCATION_KEY = 'settings_location';

function normalizeStoredLocation(raw: unknown): RegionSelection | null {
    if (isRegionSelection(raw)) {
        return raw;
    }

    if (isLegacyCityInfo(raw)) {
        const candidate = resolveRegionCandidate({
            provinceName: raw.province,
            cityName: raw.name,
        });

        if (!candidate) {
            return {
                provinceCode: '',
                provinceName: raw.province,
                cityCode: '',
                cityName: raw.name,
                districtCode: '',
                districtName: '',
                longitude: raw.longitude,
                latitude: raw.latitude ?? null,
            };
        }

        return {
            provinceCode: candidate.provinceCode,
            provinceName: candidate.provinceName,
            cityCode: candidate.cityCode,
            cityName: candidate.cityName,
            districtCode: '',
            districtName: '',
            longitude: raw.longitude,
            latitude: raw.latitude ?? null,
        };
    }

    return null;
}

/** 获取已保存的地区 */
export async function getLocation(): Promise<RegionSelection | null> {
    try {
        const data = await AsyncStorage.getItem(LOCATION_KEY);
        if (!data) return null;
        return normalizeStoredLocation(JSON.parse(data));
    } catch {
        return null;
    }
}

/** 保存选择的地区 */
export async function saveLocation(location: RegionSelection): Promise<void> {
    try {
        await AsyncStorage.setItem(LOCATION_KEY, JSON.stringify(location));
    } catch { }
}

/** 清除已保存的城市 */
export async function clearLocation(): Promise<void> {
    try {
        await AsyncStorage.removeItem(LOCATION_KEY);
    } catch { }
}
