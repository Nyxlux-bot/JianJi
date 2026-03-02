/**
 * 城市选择组件
 * 两级选择：省份 → 城市
 * 用于真太阳时校准的经度选择
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    Modal, ScrollView, TextInput, FlatList,
} from 'react-native';
import { Spacing, FontSize, BorderRadius } from '../theme/colors';
import { PROVINCES, CITIES, CityInfo, searchCities } from '../core/city-data';
import { useTheme } from "../theme/ThemeContext";

interface CityPickerProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (city: CityInfo) => void;
    selectedCity?: CityInfo | null;
}

export default function CityPicker({ visible, onClose, onSelect, selectedCity }: CityPickerProps) {
    const { Colors } = useTheme();
        const styles = makeStyles(Colors);
    const [selectedProvince, setSelectedProvince] = useState<string | null>(null);
    const [searchText, setSearchText] = useState('');
    const [searchResults, setSearchResults] = useState<CityInfo[]>([]);

    // 重置状态
    useEffect(() => {
        if (visible) {
            setSearchText('');
            setSearchResults([]);
            setSelectedProvince(null);
        }
    }, [visible]);

    const handleSearch = useCallback((text: string) => {
        setSearchText(text);
        if (text.trim().length > 0) {
            setSearchResults(searchCities(text));
            setSelectedProvince(null);
        } else {
            setSearchResults([]);
        }
    }, []);

    const handleSelectCity = useCallback((city: CityInfo) => {
        onSelect(city);
        onClose();
    }, [onSelect, onClose]);

    const handleClear = useCallback(() => {
        onSelect(null as any);
        onClose();
    }, [onSelect, onClose]);

    const cities = selectedProvince ? (CITIES[selectedProvince] || []) : [];

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.container}>
                    {/* 标题栏 */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
                            <Text style={styles.headerBtnText}>取消</Text>
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>选择所在地</Text>
                        <TouchableOpacity onPress={handleClear} style={styles.headerBtn}>
                            <Text style={styles.clearText}>不使用</Text>
                        </TouchableOpacity>
                    </View>

                    {/* 当前选择 */}
                    {selectedCity && (
                        <View style={styles.currentCity}>
                            <Text style={styles.currentLabel}>当前：</Text>
                            <Text style={styles.currentName}>
                                {selectedCity.province} · {selectedCity.name}
                            </Text>
                            <Text style={styles.currentLng}>
                                E{selectedCity.longitude.toFixed(2)}°
                            </Text>
                        </View>
                    )}

                    {/* 搜索框 */}
                    <View style={styles.searchContainer}>
                        <TextInput
                            style={styles.searchInput}
                            value={searchText}
                            onChangeText={handleSearch}
                            placeholder="搜索城市名..."
                            placeholderTextColor={Colors.text.tertiary}
                        />
                    </View>

                    {/* 内容区域 */}
                    {searchText.trim().length > 0 ? (
                        /* 搜索结果 */
                        <FlatList
                            data={searchResults}
                            keyExtractor={(item) => `${item.province}-${item.name}`}
                            style={styles.list}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={styles.cityItem}
                                    onPress={() => handleSelectCity(item)}
                                >
                                    <Text style={styles.cityName}>{item.name}</Text>
                                    <Text style={styles.cityProvince}>{item.province}</Text>
                                    <Text style={styles.cityLng}>E{item.longitude.toFixed(2)}°</Text>
                                </TouchableOpacity>
                            )}
                            ListEmptyComponent={
                                <Text style={styles.emptyText}>未找到匹配的城市</Text>
                            }
                        />
                    ) : selectedProvince ? (
                        /* 城市列表 */
                        <View style={styles.list}>
                            <TouchableOpacity
                                style={styles.backToProvince}
                                onPress={() => setSelectedProvince(null)}
                            >
                                <Text style={styles.backText}>← 返回省份</Text>
                            </TouchableOpacity>
                            <Text style={styles.provinceTitle}>{selectedProvince}</Text>
                            <ScrollView showsVerticalScrollIndicator={false}>
                                {cities.map(city => (
                                    <TouchableOpacity
                                        key={city.name}
                                        style={styles.cityItem}
                                        onPress={() => handleSelectCity(city)}
                                    >
                                        <Text style={styles.cityName}>{city.name}</Text>
                                        <Text style={styles.cityLng}>E{city.longitude.toFixed(2)}°</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    ) : (
                        /* 省份列表 */
                        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
                            <View style={styles.provinceGrid}>
                                {PROVINCES.map(province => (
                                    <TouchableOpacity
                                        key={province}
                                        style={styles.provinceItem}
                                        onPress={() => setSelectedProvince(province)}
                                    >
                                        <Text style={styles.provinceName}>{province}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </ScrollView>
                    )}
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
            maxHeight: '80%',
            minHeight: '60%',
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
        headerBtn: { width: 60 },
        headerBtnText: { fontSize: FontSize.md, color: Colors.text.secondary },
        headerTitle: { fontSize: FontSize.lg, color: Colors.text.heading, fontWeight: '400' },
        clearText: { fontSize: FontSize.sm, color: Colors.accent.red, textAlign: 'right' },
        currentCity: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: Spacing.lg,
            paddingVertical: Spacing.sm,
            backgroundColor: Colors.bg.card,
            gap: Spacing.sm,
        },
        currentLabel: { fontSize: FontSize.sm, color: Colors.text.tertiary },
        currentName: { fontSize: FontSize.sm, color: Colors.accent.gold, flex: 1 },
        currentLng: { fontSize: FontSize.xs, color: Colors.text.tertiary },
        searchContainer: {
            paddingHorizontal: Spacing.lg,
            paddingVertical: Spacing.md,
        },
        searchInput: {
            backgroundColor: Colors.bg.card,
            color: Colors.text.primary,
            fontSize: FontSize.md,
            paddingHorizontal: Spacing.lg,
            paddingVertical: Spacing.sm,
            borderRadius: BorderRadius.md,
            borderWidth: 0.5,
            borderColor: Colors.border.subtle,
        },
        list: { flex: 1, paddingHorizontal: Spacing.lg },
        provinceGrid: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: Spacing.sm,
            paddingBottom: 40,
        },
        provinceItem: {
            backgroundColor: Colors.bg.card,
            borderRadius: BorderRadius.md,
            paddingHorizontal: Spacing.lg,
            paddingVertical: Spacing.md,
            borderWidth: 0.5,
            borderColor: Colors.border.subtle,
        },
        provinceName: { fontSize: FontSize.sm, color: Colors.text.primary },
        backToProvince: {
            paddingVertical: Spacing.sm,
            marginBottom: Spacing.sm,
        },
        backText: { fontSize: FontSize.sm, color: Colors.accent.gold },
        provinceTitle: {
            fontSize: FontSize.lg,
            color: Colors.text.heading,
            fontWeight: '400',
            marginBottom: Spacing.md,
        },
        cityItem: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: Spacing.md,
            paddingHorizontal: Spacing.md,
            borderBottomWidth: 0.5,
            borderBottomColor: Colors.border.subtle,
        },
        cityName: { fontSize: FontSize.md, color: Colors.text.primary, flex: 1 },
        cityProvince: { fontSize: FontSize.xs, color: Colors.text.tertiary, marginRight: Spacing.md },
        cityLng: { fontSize: FontSize.xs, color: Colors.text.tertiary },
        emptyText: {
            fontSize: FontSize.sm,
            color: Colors.text.tertiary,
            textAlign: 'center',
            marginTop: Spacing.xxl,
        },
    });
