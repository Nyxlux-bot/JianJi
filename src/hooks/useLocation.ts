/**
 * 位置选择 Hook
 * 复用于所有起卦页面，管理城市选择状态
 */

import { useState, useEffect, useCallback } from 'react';
import { RegionSelection } from '../core/city-data';
import { getLocation, saveLocation, clearLocation } from '../services/location';

export function useLocation() {
    const [location, setLocation] = useState<RegionSelection | null>(null);
    const [pickerVisible, setPickerVisible] = useState(false);

    useEffect(() => {
        getLocation().then((saved) => {
            if (saved) setLocation(saved);
        });
    }, []);

    const handleSelectLocation = useCallback(async (selected: RegionSelection | null) => {
        if (selected) {
            setLocation(selected);
            await saveLocation(selected);
        } else {
            setLocation(null);
            await clearLocation();
        }
    }, []);

    const openPicker = useCallback(() => setPickerVisible(true), []);
    const closePicker = useCallback(() => setPickerVisible(false), []);

    return {
        location,
        pickerVisible,
        openPicker,
        closePicker,
        handleSelectLocation,
    };
}
