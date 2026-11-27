/**
 * 地区选择组件
 * 搜索 + 省 / 市 / 区县三列滚轮，内置全国区县离线 WGS-84 经纬度
 */

import { memo, useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import SheetModal from './SheetModal';
import {
    FlatList,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import FocusTextInput from './FocusTextInput';
import {
    buildRegionPathLabel,
    getCitiesByProvinceCode,
    getDefaultRegionCandidate,
    getDistrictsByCityCode,
    getProvinceOptions,
    getRegionCoordinates,
    RegionCandidate,
    RegionSearchResult,
    RegionSelection,
    resolveRegionCandidate,
    resolveRegionSelection,
    searchRegions,
} from '../core/city-data';
import ScrollPicker from './ScrollPicker';
import { Spacing, FontSize, BorderRadius } from '../theme/colors';
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

function formatCoordinateLabel(coordinates: { longitude: number; latitude: number } | null): string {
    if (!coordinates) {
        return '';
    }
    const lngLabel = coordinates.longitude >= 0 ? '东经' : '西经';
    const latLabel = coordinates.latitude >= 0 ? '北纬' : '南纬';
    return `${lngLabel} ${Math.abs(coordinates.longitude).toFixed(2)}° · ${latLabel} ${Math.abs(coordinates.latitude).toFixed(2)}°`;
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
    }, [initialCandidate, visible]);

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
        setCandidate({
            provinceCode: item.provinceCode,
            provinceName: item.provinceName,
            cityCode: item.cityCode,
            cityName: item.cityName,
            districtCode: item.districtCode,
            districtName: item.districtName,
        });
        setSearchText('');
    }, [searchResultsByDistrictCode]);

    const handleClear = useCallback(async () => {
        await Promise.resolve(onSelect(null));
        onClose();
    }, [onClose, onSelect]);

    const handleConfirm = useCallback(async () => {
        const region = resolveRegionSelection(candidate);
        if (!region) {
            return;
        }

        await Promise.resolve(onSelect(region));
        onClose();
    }, [candidate, onClose, onSelect]);

    const previewLabel = buildRegionPathLabel(candidate);
    const coordinates = useMemo(
        () => getRegionCoordinates(candidate.districtCode),
        [candidate.districtCode],
    );
    const coordinateLabel = formatCoordinateLabel(coordinates);

    return (
        <SheetModal visible={visible} onRequestClose={onClose}>
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
                        <FocusTextInput
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
                                    adaptiveFontSize
                                />
                                <ScrollPicker
                                    data={cityNames}
                                    value={candidate.cityName}
                                    onValueChange={handleCityChange}
                                    Colors={Colors}
                                    adaptiveFontSize
                                />
                                <ScrollPicker
                                    data={districtNames}
                                    value={candidate.districtName}
                                    onValueChange={handleDistrictChange}
                                    Colors={Colors}
                                    adaptiveFontSize
                                />
                            </View>
                        </View>
                    )}

                    <View style={styles.footer}>
                        <View style={styles.previewCard}>
                            <View style={styles.previewHeader}>
                                <Text style={styles.previewLabel}>当前候选</Text>
                                {coordinateLabel ? (
                                    <Text style={styles.previewCoords}>{coordinateLabel}</Text>
                                ) : null}
                            </View>
                            <Text style={styles.previewValue}>{previewLabel}</Text>
                        </View>

                        <Pressable
                            style={({ pressed }) => [
                                styles.confirmBtn,
                                pressed && styles.pressablePressed,
                            ]}
                            onPress={() => {
                                void handleConfirm();
                            }}
                        >
                            <Text style={styles.confirmBtnText}>确定</Text>
                        </Pressable>
                    </View>
                </View>
            </View>
        </SheetModal>
    );
}

const makeStyles = (Colors: any) => StyleSheet.create({
    overlay: {
        flex: 1,
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
        borderWidth: 1,
        borderColor: Colors.border.input,
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
    previewHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: Spacing.sm,
        marginBottom: 4,
    },
    previewLabel: {
        fontSize: FontSize.xs,
        color: Colors.text.tertiary,
    },
    previewCoords: {
        fontSize: FontSize.xs,
        color: Colors.accent.gold,
        fontWeight: '600',
        fontVariant: ['tabular-nums'],
    },
    previewValue: {
        fontSize: FontSize.md,
        color: Colors.text.heading,
        fontWeight: '600',
    },
    confirmBtn: {
        backgroundColor: Colors.accent.gold,
        borderRadius: BorderRadius.lg,
        paddingVertical: Spacing.lg,
        alignItems: 'center',
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
