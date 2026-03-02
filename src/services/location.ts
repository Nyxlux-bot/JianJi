/**
 * 位置存储服务
 * 使用 AsyncStorage 持久化用户选择的城市
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { CityInfo } from '../core/city-data';

const LOCATION_KEY = 'settings_location';

/** 获取已保存的城市 */
export async function getLocation(): Promise<CityInfo | null> {
    try {
        const data = await AsyncStorage.getItem(LOCATION_KEY);
        if (!data) return null;
        return JSON.parse(data) as CityInfo;
    } catch {
        return null;
    }
}

/** 保存选择的城市 */
export async function saveLocation(city: CityInfo): Promise<void> {
    try {
        await AsyncStorage.setItem(LOCATION_KEY, JSON.stringify(city));
    } catch { }
}

/** 清除已保存的城市 */
export async function clearLocation(): Promise<void> {
    try {
        await AsyncStorage.removeItem(LOCATION_KEY);
    } catch { }
}
