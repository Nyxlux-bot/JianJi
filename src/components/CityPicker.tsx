/**
 * 地区选择组件
 * 搜索 + 省 / 市 / 区县三列滚轮
 */

import React, { memo, useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
    FlatList,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import {
    buildRegionPathLabel,
    getCitiesByProvinceCode,
    getDefaultRegionCandidate,
    getDistrictsByCityCode,
    getProvinceOptions,
    RegionCandidate,
    RegionSearchResult,
    RegionSelection,
    resolveRegionCandidate,
    searchRegions,
} from '../core/city-data';
import { CustomAlert } from './CustomAlertProvider';
import ScrollPicker from './ScrollPicker';
import { Spacing, FontSize, BorderRadius } from '../theme/colors';
import { getCachedRegionCoordinates, resolveRegionSelection } from '../services/region-geocode';
import { getSettings } from '../services/settings';
import { useTheme } from '../theme/ThemeContext';

interface CityPickerProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (region: RegionSelection | null) => void | Promise<void>;
    selectedRegion?: RegionSelection | null;
}

type CityPickerStyles = ReturnType<typeof makeStyles>;

interface SearchResultRowProps {
    districtCode: string;
    districtName: string;
    label: string;
    styles: CityPickerStyles;
    onPress: (districtCode: string) => void;
}

const SearchResultRow = memo(function SearchResultRow({
    districtCode,
    districtName,
    label,
    styles,
    onPress,
}: SearchResultRowProps) {
    const handlePress = useCallback(() => {
        onPress(districtCode);
    }, [districtCode, onPress]);

    return (
        <Pressable
            style={({ pressed }) => [styles.searchResultRow, pressed && styles.pressablePressed]}
            onPress={handlePress}
        >
            <Text style={styles.searchResultDistrict}>{districtName}</Text>
            <Text style={styles.searchResultPath}>{label}</Text>
        </Pressable>
    );
});

function createCandidateFromSelection(selection?: RegionSelection | null): RegionCandidate {
    if (!selection) {
        return getDefaultRegionCandidate();
    }

    return resolveRegionCandidate({
        provinceCode: selection.provinceCode,
        cityCode: selection.cityCode,
        districtCode: selection.districtCode || undefined,
        provinceName: selection.provinceName,
        cityName: selection.cityName,
        districtName: selection.districtName || undefined,
    }) || getDefaultRegionCandidate();
}

export default function CityPicker({
    visible,
    onClose,
    onSelect,
    selectedRegion,
}: CityPickerProps) {
    const { Colors } = useTheme();
    const styles = useMemo(() => makeStyles(Colors), [Colors]);
    const provinceOptions = useMemo(() => getProvinceOptions(), []);
    const [candidate, setCandidate] = useState<RegionCandidate>(() => createCandidateFromSelection(selectedRegion));
    const [searchText, setSearchText] = useState('');
    const [geocoderApiKey, setGeocoderApiKey] = useState('');
    const [cachedCoordinates, setCachedCoordinates] = useState<{ longitude: number; latitude: number | null } | null>(null);
    const [cacheStatus, setCacheStatus] = useState<'loading' | 'hit' | 'miss'>('loading');
    const [resolving, setResolving] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    const deferredSearchText = useDeferredValue(searchText);

    const initialCandidate = useMemo(
        () => createCandidateFromSelection(selectedRegion),
        [selectedRegion],
    );

    useEffect(() => {
        if (!visible) {
            return;
        }

        setCandidate(initialCandidate);
        setSearchText('');
        setStatusMessage('');
    }, [initialCandidate, visible]);

    useEffect(() => {
        if (!visible) {
            return;
        }

        let active = true;
        getSettings().then((settings) => {
            if (active) {
                setGeocoderApiKey(settings.geocoderApiKey);
            }
        });

        return () => {
            active = false;
        };
    }, [visible]);

    const cityOptions = useMemo(
        () => getCitiesByProvinceCode(candidate.provinceCode),
        [candidate.provinceCode],
    );

    const districtOptions = useMemo(
        () => getDistrictsByCityCode(candidate.cityCode),
        [candidate.cityCode],
    );

    const provinceNames = useMemo(() => provinceOptions.map((item) => item.name), [provinceOptions]);
    const cityNames = useMemo(() => cityOptions.map((item) => item.name), [cityOptions]);
    const districtNames = useMemo(() => districtOptions.map((item) => item.name), [districtOptions]);

    useEffect(() => {
        if (cityOptions.length === 0) {
            return;
        }

        const currentCity = cityOptions.find((item) => item.code === candidate.cityCode);
        if (currentCity) {
            return;
        }

        const nextCity = cityOptions[0];
        const nextDistrict = getDistrictsByCityCode(nextCity.code)[0];
        if (!nextDistrict) {
            return;
        }

        setCandidate((prev) => ({
            ...prev,
            cityCode: nextCity.code,
            cityName: nextCity.name,
            districtCode: nextDistrict.code,
            districtName: nextDistrict.name,
        }));
    }, [candidate.cityCode, cityOptions]);

    useEffect(() => {
        if (districtOptions.length === 0) {
            return;
        }

        const currentDistrict = districtOptions.find((item) => item.code === candidate.districtCode);
        if (currentDistrict) {
            return;
        }

        const nextDistrict = districtOptions[0];
        setCandidate((prev) => ({
            ...prev,
            districtCode: nextDistrict.code,
            districtName: nextDistrict.name,
        }));
    }, [candidate.districtCode, districtOptions]);

    useEffect(() => {
        if (!visible || !candidate.districtCode) {
            setCachedCoordinates(null);
            setCacheStatus('miss');
            return;
        }

        let active = true;
        setCacheStatus('loading');
        getCachedRegionCoordinates(candidate.districtCode)
            .then((coordinates) => {
                if (!active) {
                    return;
                }
                setCachedCoordinates(coordinates);
                setCacheStatus(coordinates ? 'hit' : 'miss');
            })
            .catch(() => {
                if (!active) {
                    return;
                }
                setCachedCoordinates(null);
                setCacheStatus('miss');
            });

        return () => {
            active = false;
        };
    }, [candidate.districtCode, visible]);

    const searchResults = useMemo(
        () => (deferredSearchText.trim().length > 0 ? searchRegions(deferredSearchText, 20) : []),
        [deferredSearchText],
    );
    const searchResultsByDistrictCode = useMemo<Record<string, RegionSearchResult>>(
        () => Object.fromEntries(searchResults.map((item) => [item.districtCode, item])),
        [searchResults],
    );

    const handleProvinceChange = useCallback((provinceName: string) => {
        const province = provinceOptions.find((item) => item.name === provinceName);
        if (!province) {
            return;
        }

        const nextCity = getCitiesByProvinceCode(province.code)[0];
        const nextDistrict = nextCity ? getDistrictsByCityCode(nextCity.code)[0] : null;
        if (!nextCity || !nextDistrict) {
            return;
        }

        setCandidate({
            provinceCode: province.code,
            provinceName: province.name,
            cityCode: nextCity.code,
            cityName: nextCity.name,
            districtCode: nextDistrict.code,
            districtName: nextDistrict.name,
        });
    }, [provinceOptions]);

    const handleCityChange = useCallback((cityName: string) => {
        const nextCity = cityOptions.find((item) => item.name === cityName);
        if (!nextCity) {
            return;
        }

        const nextDistrict = getDistrictsByCityCode(nextCity.code)[0];
        if (!nextDistrict) {
            return;
        }

        setCandidate((prev) => ({
            ...prev,
            cityCode: nextCity.code,
            cityName: nextCity.name,
            districtCode: nextDistrict.code,
            districtName: nextDistrict.name,
        }));
    }, [cityOptions]);

    const handleDistrictChange = useCallback((districtName: string) => {
        const nextDistrict = districtOptions.find((item) => item.name === districtName);
        if (!nextDistrict) {
            return;
        }

        setCandidate((prev) => ({
            ...prev,
            districtCode: nextDistrict.code,
            districtName: nextDistrict.name,
        }));
    }, [districtOptions]);

    const handleSearchResultPress = useCallback((districtCode: string) => {
        const item = searchResultsByDistrictCode[districtCode];
        if (!item) {
            return;
        }
        setCandidate(item);
        setSearchText('');
        setStatusMessage('');
    }, [searchResultsByDistrictCode]);

    const handleClear = useCallback(async () => {
        await Promise.resolve(onSelect(null));
        onClose();
    }, [onClose, onSelect]);

    const handleConfirm = useCallback(async () => {
        try {
            setResolving(true);
            setStatusMessage('');
            const region = cachedCoordinates
                ? {
                    ...candidate,
                    longitude: cachedCoordinates.longitude,
                    latitude: cachedCoordinates.latitude,
                }
                : await resolveRegionSelection(candidate);

            await Promise.resolve(onSelect(region));
            onClose();
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : '地区解析失败';
            setStatusMessage(message);
            CustomAlert.alert('地区解析失败', message);
        } finally {
            setResolving(false);
        }
    }, [cachedCoordinates, candidate, onClose, onSelect]);

    const confirmDisabled = resolving || (cacheStatus === 'miss' && geocoderApiKey.trim().length === 0);
    const previewLabel = buildRegionPathLabel(candidate);
    const footerHint = cacheStatus === 'hit'
        ? '已缓存该区县经纬度，确认后将直接使用缓存结果。'
        : (geocoderApiKey.trim().length > 0
            ? '确认后将联网解析该区县经纬度，并缓存到本地。'
            : '请先在设置中填写腾讯位置服务 Key，或选择已缓存过的区县。');

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.container}>
                    <View style={styles.header}>
                        <Pressable
                            style={({ pressed }) => [styles.headerBtn, pressed && styles.pressablePressed]}
                            onPress={onClose}
                        >
                            <Text style={styles.headerBtnText}>取消</Text>
                        </Pressable>
                        <Text style={styles.headerTitle}>选择地区</Text>
                        <Pressable
                            style={({ pressed }) => [styles.headerBtn, pressed && styles.pressablePressed]}
                            onPress={() => {
                                void handleClear();
                            }}
                        >
                            <Text style={styles.clearText}>不使用</Text>
                        </Pressable>
                    </View>

                    <View style={styles.searchContainer}>
                        <TextInput
                            style={styles.searchInput}
                            value={searchText}
                            onChangeText={setSearchText}
                            placeholder="搜索全国城市及地区"
                            placeholderTextColor={Colors.text.tertiary}
                        />
                    </View>

                    {searchText.trim().length > 0 ? (
                        <FlatList
                            data={searchResults}
                            keyExtractor={(item) => item.districtCode}
                            style={styles.resultsList}
                            contentContainerStyle={styles.resultsListContent}
                            showsVerticalScrollIndicator={false}
                            renderItem={({ item }) => (
                                <SearchResultRow
                                    districtCode={item.districtCode}
                                    districtName={item.districtName}
                                    label={item.label}
                                    styles={styles}
                                    onPress={handleSearchResultPress}
                                />
                            )}
                            ListEmptyComponent={<Text style={styles.emptyText}>未找到匹配地区</Text>}
                        />
                    ) : (
                        <View style={styles.wheelArea}>
                            <View style={styles.wheelHeaderRow}>
                                <Text style={styles.wheelHeaderText}>省份</Text>
                                <Text style={styles.wheelHeaderText}>城市</Text>
                                <Text style={styles.wheelHeaderText}>区县</Text>
                            </View>

                            <View style={styles.wheelRow}>
                                <ScrollPicker
                                    data={provinceNames}
                                    value={candidate.provinceName}
                                    onValueChange={handleProvinceChange}
                                    Colors={Colors}
                                />
                                <ScrollPicker
                                    data={cityNames}
                                    value={candidate.cityName}
                                    onValueChange={handleCityChange}
                                    Colors={Colors}
                                />
                                <ScrollPicker
                                    data={districtNames}
                                    value={candidate.districtName}
                                    onValueChange={handleDistrictChange}
                                    Colors={Colors}
                                />
                            </View>
                        </View>
                    )}

                    <View style={styles.footer}>
                        <View style={styles.previewCard}>
                            <Text style={styles.previewLabel}>当前候选</Text>
                            <Text style={styles.previewValue}>{previewLabel}</Text>
                            <Text style={styles.previewHint}>{statusMessage || footerHint}</Text>
                        </View>

                        <Pressable
                            style={({ pressed }) => [
                                styles.confirmBtn,
                                confirmDisabled && styles.confirmBtnDisabled,
                                pressed && !confirmDisabled && styles.pressablePressed,
                            ]}
                            onPress={() => {
                                void handleConfirm();
                            }}
                            disabled={confirmDisabled}
                        >
                            <Text style={styles.confirmBtnText}>
                                {resolving ? '解析中...' : '确定'}
                            </Text>
                        </Pressable>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const makeStyles = (Colors: any) => StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    container: {
        backgroundColor: Colors.bg.primary,
        borderTopLeftRadius: BorderRadius.xl,
        borderTopRightRadius: BorderRadius.xl,
        minHeight: '72%',
        maxHeight: '88%',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.lg,
        borderBottomWidth: 0.5,
        borderBottomColor: Colors.border.subtle,
    },
    headerBtn: {
        width: 64,
        minHeight: 28,
        justifyContent: 'center',
    },
    headerBtnText: {
        fontSize: FontSize.md,
        color: Colors.text.secondary,
    },
    headerTitle: {
        fontSize: FontSize.lg,
        color: Colors.text.heading,
        fontWeight: '500',
    },
    clearText: {
        fontSize: FontSize.sm,
        color: Colors.accent.red,
        textAlign: 'right',
    },
    searchContainer: {
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
    },
    searchInput: {
        backgroundColor: Colors.bg.card,
        color: Colors.text.primary,
        fontSize: FontSize.md,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        borderRadius: 999,
        borderWidth: 0.5,
        borderColor: Colors.border.subtle,
    },
    wheelArea: {
        flex: 1,
        paddingHorizontal: Spacing.lg,
        paddingBottom: Spacing.lg,
    },
    wheelHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.md,
        paddingHorizontal: Spacing.xs,
    },
    wheelHeaderText: {
        flex: 1,
        textAlign: 'center',
        fontSize: FontSize.md,
        color: Colors.text.heading,
        fontWeight: '700',
    },
    wheelRow: {
        flexDirection: 'row',
        gap: Spacing.sm,
    },
    resultsList: {
        flex: 1,
        paddingHorizontal: Spacing.lg,
    },
    resultsListContent: {
        paddingBottom: Spacing.lg,
    },
    searchResultRow: {
        backgroundColor: Colors.bg.card,
        borderRadius: BorderRadius.lg,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        marginBottom: Spacing.sm,
        borderWidth: 0.5,
        borderColor: Colors.border.subtle,
    },
    searchResultDistrict: {
        fontSize: FontSize.md,
        color: Colors.text.heading,
        fontWeight: '600',
    },
    searchResultPath: {
        fontSize: FontSize.xs,
        color: Colors.text.tertiary,
        marginTop: 4,
    },
    footer: {
        paddingHorizontal: Spacing.lg,
        paddingTop: Spacing.sm,
        paddingBottom: Spacing.xl,
        gap: Spacing.md,
    },
    previewCard: {
        backgroundColor: Colors.bg.card,
        borderRadius: BorderRadius.lg,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        borderWidth: 0.5,
        borderColor: Colors.border.subtle,
    },
    previewLabel: {
        fontSize: FontSize.xs,
        color: Colors.text.tertiary,
        marginBottom: 4,
    },
    previewValue: {
        fontSize: FontSize.md,
        color: Colors.text.heading,
        fontWeight: '600',
    },
    previewHint: {
        marginTop: Spacing.xs,
        fontSize: FontSize.xs,
        color: Colors.text.secondary,
        lineHeight: 18,
    },
    confirmBtn: {
        backgroundColor: Colors.accent.gold,
        borderRadius: BorderRadius.lg,
        paddingVertical: Spacing.lg,
        alignItems: 'center',
    },
    confirmBtnDisabled: {
        opacity: 0.5,
    },
    confirmBtnText: {
        fontSize: FontSize.lg,
        color: Colors.text.inverse,
        fontWeight: '600',
        letterSpacing: 2,
    },
    pressablePressed: {
        opacity: 0.72,
    },
    emptyText: {
        fontSize: FontSize.sm,
        color: Colors.text.tertiary,
        textAlign: 'center',
        marginTop: Spacing.xxl,
    },
});
