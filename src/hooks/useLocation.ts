/**
 * 位置选择 Hook
 * 复用于所有起卦页面，管理城市选择状态
 */

import { useState, useEffect, useCallback } from 'react';
import { CityInfo } from '../core/city-data';
import { getLocation, saveLocation, clearLocation } from '../services/location';

export function useLocation() {
    const [city, setCity] = useState<CityInfo | null>(null);
    const [pickerVisible, setPickerVisible] = useState(false);

    useEffect(() => {
        getLocation().then(saved => {
            if (saved) setCity(saved);
        });
    }, []);

    const handleSelectCity = useCallback(async (selected: CityInfo | null) => {
        if (selected) {
            setCity(selected);
            await saveLocation(selected);
        } else {
            setCity(null);
            await clearLocation();
        }
    }, []);

    const openPicker = useCallback(() => setPickerVisible(true), []);
    const closePicker = useCallback(() => setPickerVisible(false), []);

    return {
        city,
        pickerVisible,
        openPicker,
        closePicker,
        handleSelectCity,
    };
}
