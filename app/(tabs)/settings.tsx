import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    BackHandler,
    Easing,
    KeyboardAvoidingView,
    Linking,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { useFocusEffect, useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';
import { CustomAlert } from '../../src/components/CustomAlertProvider';
import {
    DivinationRecordEnvelope,
    exportAllRecords,
    getAllRecords,
    importRecords,
    type ImportConflictPolicy,
} from '../../src/db/database';
import StatusBarDecor from '../../src/components/StatusBarDecor';
import { BorderRadius, FontSize, Spacing } from '../../src/theme/colors';
import { useTheme } from '../../src/theme/ThemeContext';
import { validateImportRecords } from '../../src/db/import-validation';
import ImportPreviewModal from '../../src/components/ImportPreviewModal';
import {
    AISettings,
    DEFAULT_SETTINGS,
    getSettings,
    mergeImportedSettings,
    saveSettings,
    buildBackupSettings,
    getActiveProvider,
    getActiveModel,
    subscribeSettings,
} from '../../src/services/settings';
import { exportDiagnosticLogFile, recordDiagnosticLog } from '../../src/services/diagnostics';
import AIProviderSettings, { type AIProviderSettingsHandle, type SettingsSaveState } from '../../src/components/AIProviderSettings';
import { CloseIcon, ChevronRightIcon, LocationIcon, SparkleIcon } from '../../src/components/Icons';
import { buildResultPalette, type ResultPalette } from '../../src/theme/result-palette';
import { DIVINATION_ENGINE_LABEL, type DivinationEngine } from '../../src/db/record-types';
import appConfig from '../../app.json';
import { registerSettingsLeaveHandler } from '../../src/services/settings-leave-guard';
import { useGanZhiRelationSettings } from '../../src/features/bazi/ganzhi-relation-settings';

type SheetType = 'ai' | 'calendar' | null;

const APP_VERSION = appConfig.expo.version;
const REPO_URL = 'https://github.com/Nyxlux-bot/JianJi';
const THEME_SWATCHES = [
    { key: 'yin', label: '玄黑', fill: '#121212' },
    { key: 'yang', label: '宣白', fill: '#f6f1e7' },
] as const;
const RECORD_ENGINES: Array<{ engine: DivinationEngine; badge: string }> = [
    { engine: 'liuyao', badge: '卦' },
    { engine: 'meihua', badge: '梅' },
    { engine: 'bazi', badge: '八' },
    { engine: 'ziwei', badge: '紫' },
    { engine: 'baziCompatibility', badge: '合' },
];
const HEXAGRAMS = Array.from({ length: 64 }, (_, index) => String.fromCharCode(0x4DC0 + index));

function getHostLabel(value: string): string {
    if (!value.trim()) return '未配置';
    try {
        return new URL(value).host;
    } catch {
        return value.replace(/^https?:\/\//, '').split('/')[0] || '已填写';
    }
}

function getAIHubMeta(settings: AISettings): string {
    const provider = getActiveProvider(settings);
    if (!provider) return '未配置';
    const host = getHostLabel(provider.apiUrl.trim().replace(/#$/, ''));
    const model = getActiveModel(provider);
    return model ? `${host} · ${model.protocolVerified ? '已连通' : '未检测'}` : host;
}

function areSettingsEqual(left: AISettings, right: AISettings): boolean {
    return JSON.stringify(left) === JSON.stringify(right);
}

const SETTINGS_AUTOSAVE_DELAY_MS = 600;

/** 太极与 64 卦环按 192 视框绘制，整体缩到设置页主题卡的尺寸 */
const HUB_SIZE = 112;
const TAIJI_SIZE = Math.round(124 * HUB_SIZE / 192);

function TaijiHub({
    progress,
    Colors,
    onToggle,
}: {
    progress: Animated.Value;
    Colors: any;
    onToggle: () => void;
}) {
    const rotate = progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
    const ringRotate = progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '22.5deg'] });
    const yinColor = '#111111';
    const yangColor = '#f7f1e4';
    const ringColor = Colors.accent.gold;
    const center = 96;
    const outerRadius = 82;

    return (
        <View style={hubStyles.wrap}>
            <Pressable onPress={onToggle} style={({ pressed }) => [hubStyles.pressArea, pressed && { opacity: 0.9 }]} accessibilityRole="button" accessibilityLabel="点按太极切换阴阳">
                <Animated.View style={{ transform: [{ rotate: ringRotate }] }}>
                    <Svg width={HUB_SIZE} height={HUB_SIZE} viewBox="0 0 192 192">
                        <Circle cx={center} cy={center} r={88} fill="none" stroke={ringColor} strokeWidth="1" opacity="0.5" />
                        <Circle cx={center} cy={center} r={68} fill="none" stroke={ringColor} strokeWidth="1" opacity="0.28" />
                        {HEXAGRAMS.map((hexagram, index) => {
                            const angle = (index / HEXAGRAMS.length) * Math.PI * 2 - Math.PI / 2;
                            const x = center + Math.cos(angle) * outerRadius;
                            const y = center + Math.sin(angle) * outerRadius;
                            return (
                                <SvgText
                                    key={`${hexagram}-${index}`}
                                    x={x}
                                    y={y + 3}
                                    fill={ringColor}
                                    fontSize="8.5"
                                    fontWeight="600"
                                    textAnchor="middle"
                                    opacity="0.86"
                                    transform={`rotate(${angle * 180 / Math.PI + 90} ${x} ${y})`}
                                >
                                    {hexagram}
                                </SvgText>
                            );
                        })}
                    </Svg>
                </Animated.View>
                <Animated.View style={[hubStyles.taijiLayer, { transform: [{ rotate }] }]}>
                    <Svg width={TAIJI_SIZE} height={TAIJI_SIZE} viewBox="0 0 132 132">
                        <Circle cx="66" cy="66" r="61" fill={yangColor} stroke={ringColor} strokeWidth="2" />
                        <Path
                            d="M66 5a61 61 0 0 1 0 122 30.5 30.5 0 0 1 0-61 30.5 30.5 0 0 0 0-61z"
                            fill={yinColor}
                        />
                        <Circle cx="66" cy="35.5" r="30.5" fill={yangColor} />
                        <Circle cx="66" cy="96.5" r="30.5" fill={yinColor} />
                        <Circle cx="66" cy="35.5" r="8" fill={yinColor} />
                        <Circle cx="66" cy="96.5" r="8" fill={yangColor} />
                    </Svg>
                </Animated.View>
            </Pressable>
        </View>
    );
}

export default function SettingsPage() {
    const { Colors, theme, setTheme, saveTheme } = useTheme();
    const navigation = useNavigation();
    const styles = makeStyles(Colors);
    const insets = useSafeAreaInsets();
    const palette = React.useMemo(() => buildResultPalette(Colors), [Colors]);
    const layout = React.useMemo(() => makeLayoutStyles(palette, Colors), [palette, Colors]);
    const [recordCounts, setRecordCounts] = useState<{ total: number; byEngine: Partial<Record<DivinationEngine, number>> }>({ total: 0, byEngine: {} });
    const themeProgress = useRef(new Animated.Value(theme === 'yang' ? 1 : 0)).current;
    const [settings, setSettings] = useState<AISettings>(DEFAULT_SETTINGS);
    const [savedSettings, setSavedSettings] = useState<AISettings>(DEFAULT_SETTINGS);
    const [saveState, setSaveState] = useState<SettingsSaveState>({ status: 'saved' });
    const [isInitializing, setIsInitializing] = useState(true);
    const [initializationError, setInitializationError] = useState('');
    const [isBackingUp, setIsBackingUp] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);
    const [isExportingDiagnostics, setIsExportingDiagnostics] = useState(false);
    const [activeSheet, setActiveSheet] = useState<SheetType>(null);
    const [previewVisible, setPreviewVisible] = useState(false);
    const [pendingRecords, setPendingRecords] = useState<DivinationRecordEnvelope[]>([]);
    const [pendingSettingsRaw, setPendingSettingsRaw] = useState<unknown>(null);
    const [pendingGanZhiRelationSettingsRaw, setPendingGanZhiRelationSettingsRaw] = useState<unknown>(undefined);
    const [pendingDuplicateCount, setPendingDuplicateCount] = useState(0);
    const settingsRef = useRef(settings);
    const savedSettingsRef = useRef(savedSettings);
    const themeRef = useRef(theme);
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const saveChainRef = useRef<Promise<boolean>>(Promise.resolve(true));
    const aiProviderSettingsRef = useRef<AIProviderSettingsHandle>(null);
    const bypassNavigationGuardRef = useRef(false);
    const {
        settings: ganZhiRelationSettings,
        ready: ganZhiRelationSettingsReady,
        replaceSettings: replaceGanZhiRelationSettings,
    } = useGanZhiRelationSettings();

    const loadSettings = async () => {
        setIsInitializing(true);
        setInitializationError('');
        try {
            const nextSettings = await getSettings();
            settingsRef.current = nextSettings;
            savedSettingsRef.current = nextSettings;
            setSettings(nextSettings);
            setSavedSettings(nextSettings);
            setSaveState({ status: 'saved' });
        } catch (error: unknown) {
            setInitializationError(error instanceof Error ? error.message : '读取设置失败');
        } finally {
            setIsInitializing(false);
        }
    };
    useEffect(() => { void loadSettings(); }, []);
    useEffect(() => () => clearTimeout(saveTimerRef.current), []);

    useEffect(() => subscribeSettings((nextSettings) => {
        const hasDraft = !areSettingsEqual(settingsRef.current, savedSettingsRef.current);
        savedSettingsRef.current = nextSettings;
        setSavedSettings(nextSettings);
        if (!hasDraft) {
            settingsRef.current = nextSettings;
            setSettings(nextSettings);
        }
    }), []);

    useEffect(() => {
        settingsRef.current = settings;
    }, [settings]);

    useEffect(() => {
        themeRef.current = theme;
    }, [theme]);

    useEffect(() => {
        Animated.timing(themeProgress, {
            toValue: theme === 'yang' ? 1 : 0,
            duration: 520,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
        }).start();
    }, [theme, themeProgress]);

    // Settings save themselves: each change is written shortly after the last
    // edit. A draft that does not validate yet (e.g. a half-typed number) stays
    // on screen with its reason instead of interrupting with a dialog.
    const persistSettings = useCallback((): Promise<boolean> => {
        clearTimeout(saveTimerRef.current);
        const run = async (): Promise<boolean> => {
            const snapshot = settingsRef.current;
            if (areSettingsEqual(snapshot, savedSettingsRef.current)) {
                setSaveState({ status: 'saved' });
                return true;
            }
            setSaveState({ status: 'saving' });
            try {
                await saveSettings(snapshot);
                savedSettingsRef.current = snapshot;
                setSavedSettings(snapshot);
                setSaveState(areSettingsEqual(settingsRef.current, snapshot) ? { status: 'saved' } : { status: 'pending' });
                return true;
            } catch (error: unknown) {
                setSaveState({ status: 'error', message: error instanceof Error ? error.message : '保存设置失败' });
                return false;
            }
        };
        saveChainRef.current = saveChainRef.current.then(run, run);
        return saveChainRef.current;
    }, []);

    const updateSettings = useCallback((nextState: React.SetStateAction<AISettings>) => {
        const next = typeof nextState === 'function' ? nextState(settingsRef.current) : nextState;
        settingsRef.current = next;
        setSettings(next);
        clearTimeout(saveTimerRef.current);
        if (areSettingsEqual(next, savedSettingsRef.current)) return;
        setSaveState({ status: 'pending' });
        saveTimerRef.current = setTimeout(() => { void persistSettings(); }, SETTINGS_AUTOSAVE_DELAY_MS);
    }, [persistSettings]);

    const getHasUnsavedChanges = useCallback(() => {
        return Boolean(aiProviderSettingsRef.current?.hasPendingModel())
            || !areSettingsEqual(settingsRef.current, savedSettingsRef.current);
    }, []);

    useFocusEffect(useCallback(() => {
        let active = true;
        getAllRecords().then((records) => {
            if (!active) return;
            const byEngine: Partial<Record<DivinationEngine, number>> = {};
            records.forEach((record) => { byEngine[record.engineType] = (byEngine[record.engineType] ?? 0) + 1; });
            setRecordCounts({ total: records.length, byEngine });
        }).catch(() => undefined);
        return () => { active = false; };
    }, []));

    const aiProvider = getActiveProvider(settings);
    const aiModel = aiProvider ? getActiveModel(aiProvider) : undefined;
    const aiStatus = !aiProvider
        ? { label: '未配置', good: false }
        : aiModel?.protocolVerified ? { label: '已连通', good: true } : { label: aiModel ? '未检测' : '待选模型', good: false };

    const handleToggleTheme = () => {
        const nextTheme = themeRef.current === 'yang' ? 'yin' : 'yang';
        themeRef.current = nextTheme;
        setTheme(nextTheme);
        saveTheme(nextTheme).catch(() => undefined);
    };

    const discardDraft = useCallback(() => {
        clearTimeout(saveTimerRef.current);
        settingsRef.current = savedSettingsRef.current;
        setSettings(savedSettingsRef.current);
        setSaveState({ status: 'saved' });
    }, []);

    /** Leaving writes whatever is pending; only a draft that cannot be saved asks first. */
    const requestLeave = useCallback((proceed: () => void) => {
        aiProviderSettingsRef.current?.commitPendingModel();
        void persistSettings().then((saved) => {
            if (saved) {
                proceed();
                return;
            }
            CustomAlert.alert('有修改无法保存', '当前填写的内容未通过校验，离开会放弃这些修改。', [
                { text: '继续编辑', style: 'cancel' },
                {
                    text: '放弃修改',
                    style: 'destructive',
                    onPress: () => {
                        discardDraft();
                        proceed();
                    },
                },
            ]);
        });
    }, [discardDraft, persistSettings]);

    const requestCloseSheet = useCallback(() => {
        if (activeSheet === null) {
            return;
        }
        requestLeave(() => setActiveSheet(null));
    }, [activeSheet, requestLeave]);

    useFocusEffect(useCallback(() => (
        registerSettingsLeaveHandler((proceed) => {
            requestLeave(() => {
                bypassNavigationGuardRef.current = true;
                setActiveSheet(null);
                proceed();
                setTimeout(() => {
                    bypassNavigationGuardRef.current = false;
                }, 0);
            });
        })
    ), [requestLeave]));

    useFocusEffect(useCallback(() => {
        const unsubscribe = navigation.addListener('beforeRemove', (event) => {
            if (bypassNavigationGuardRef.current || !getHasUnsavedChanges()) {
                return;
            }
            event.preventDefault();
            requestLeave(() => {
                bypassNavigationGuardRef.current = true;
                navigation.dispatch(event.data.action);
                setTimeout(() => {
                    bypassNavigationGuardRef.current = false;
                }, 0);
            });
        });
        return unsubscribe;
    }, [getHasUnsavedChanges, navigation, requestLeave]));

    useFocusEffect(useCallback(() => {
        const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
            if (activeSheet !== null) {
                requestCloseSheet();
                return true;
            }
            if (!getHasUnsavedChanges()) {
                return false;
            }
            requestLeave(() => BackHandler.exitApp());
            return true;
        });
        return () => subscription.remove();
    }, [activeSheet, getHasUnsavedChanges, requestCloseSheet, requestLeave]));

    const handleBackup = async () => {
        if (!ganZhiRelationSettingsReady) {
            CustomAlert.alert('设置加载中', '干支关系设置尚未加载完成，请稍后再导出备份。');
            return;
        }
        try {
            setIsBackingUp(true);
            const records = await exportAllRecords();
            const backupData = {
                version: 4,
                timestamp: new Date().toISOString(),
                settings: buildBackupSettings(settingsRef.current),
                ganZhiRelationSettings,
                meta: { apiKeyIncluded: false },
                records,
            };
            const jsonStr = JSON.stringify(backupData, null, 2);
            const fileName = `divination_backup_${new Date().getTime()}.json`;
            const fileUri = `${FileSystem.documentDirectory}${fileName}`;

            await FileSystem.writeAsStringAsync(fileUri, jsonStr, { encoding: FileSystem.EncodingType.UTF8 });

            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(fileUri, {
                    mimeType: 'application/json',
                    dialogTitle: '备份易学数据',
                    UTI: 'public.json',
                });
                CustomAlert.alert('备份已导出', '备份文件默认不包含 API Key 与腾讯位置服务 Key。');
            } else {
                CustomAlert.alert('提示', '当前设备不支持分享文件');
            }
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : '备份失败';
            void recordDiagnosticLog({
                level: 'error',
                source: 'settings:backup',
                message,
            });
            CustomAlert.alert('备份失败', message);
        } finally {
            setIsBackingUp(false);
        }
    };

    const handleExportDiagnostics = async () => {
        try {
            setIsExportingDiagnostics(true);
            await exportDiagnosticLogFile();
            CustomAlert.alert('故障日志已导出', '日志文件不包含接口密钥。');
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : '导出故障日志失败';
            void recordDiagnosticLog({
                level: 'error',
                source: 'settings:exportDiagnostics',
                message,
            });
            CustomAlert.alert('导出失败', message);
        } finally {
            setIsExportingDiagnostics(false);
        }
    };

    const handleRestore = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: 'application/json',
                copyToCacheDirectory: true,
            });

            if (result.canceled || !result.assets || result.assets.length === 0) return;

            const content = await FileSystem.readAsStringAsync(result.assets[0].uri, { encoding: FileSystem.EncodingType.UTF8 });
            const backupData = JSON.parse(content);
            if (!Array.isArray(backupData.records)) {
                throw new Error('无效的备份文件：缺失记录数据');
            }

            const validatedRecords = validateImportRecords(backupData.records as unknown[]);
            const existingRecords = await getAllRecords();
            const existingIdSet = new Set(existingRecords.map((record) => record.id));
            const duplicateCount = validatedRecords.reduce(
                (count, record) => count + (existingIdSet.has(record.result.id) ? 1 : 0),
                0
            );

            setPendingRecords(validatedRecords);
            setPendingSettingsRaw(backupData.settings);
            setPendingGanZhiRelationSettingsRaw(backupData.ganZhiRelationSettings);
            setPendingDuplicateCount(duplicateCount);
            setPreviewVisible(true);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : '文件解析错误';
            void recordDiagnosticLog({
                level: 'error',
                source: 'settings:restorePreview',
                message,
            });
            CustomAlert.alert('恢复失败', message);
        }
    };

    const handleConfirmRestore = async (payload: {
        selectedRecords: DivinationRecordEnvelope[];
        conflictPolicy: ImportConflictPolicy;
    }) => {
        if (pendingGanZhiRelationSettingsRaw !== undefined && !ganZhiRelationSettingsReady) {
            CustomAlert.alert('设置加载中', '干支关系设置尚未加载完成，请稍后再恢复。');
            return;
        }
        try {
            setIsRestoring(true);

            if (pendingSettingsRaw !== null && pendingSettingsRaw !== undefined) {
                const normalizedSettings = mergeImportedSettings(pendingSettingsRaw, settingsRef.current);
                await saveSettings(normalizedSettings);
                settingsRef.current = normalizedSettings;
                savedSettingsRef.current = normalizedSettings;
                setSettings(normalizedSettings);
                setSavedSettings(normalizedSettings);
            }
            if (pendingGanZhiRelationSettingsRaw !== undefined) {
                await replaceGanZhiRelationSettings(pendingGanZhiRelationSettingsRaw);
            }

            const stats = await importRecords(payload.selectedRecords, {
                mode: 'merge',
                conflictPolicy: payload.conflictPolicy,
            });

            setPreviewVisible(false);
            setPendingRecords([]);
            setPendingSettingsRaw(null);
            setPendingGanZhiRelationSettingsRaw(undefined);

            CustomAlert.alert('恢复成功', `导入完成：新增 ${stats.inserted} 条，覆盖 ${stats.updated} 条，跳过 ${stats.skipped} 条。`);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : '文件解析错误';
            void recordDiagnosticLog({
                level: 'error',
                source: 'settings:restoreConfirm',
                message,
            });
            CustomAlert.alert('恢复失败', message);
        } finally {
            setIsRestoring(false);
        }
    };

    const handleResetSettings = () => {
        CustomAlert.alert('恢复默认设置', '将清空接口 Key 与模型配置，是否继续？', [
            { text: '取消', style: 'cancel' },
            {
                text: '恢复',
                style: 'destructive',
                onPress: () => {
                    updateSettings({ ...DEFAULT_SETTINGS });
                    themeRef.current = 'yin';
                    setTheme('yin');
                    saveTheme('yin').catch(() => undefined);
                    CustomAlert.alert('已恢复', '已恢复默认设置。');
                },
            },
        ]);
    };

    if (initializationError) {
        return <View style={styles.container}>
            <StatusBarDecor />
            <View style={{ padding: Spacing.lg, gap: Spacing.md }}>
                <Text accessibilityRole="alert" style={{ color: Colors.accent.red }}>读取设置失败：{initializationError}</Text>
                <ActionButton label="重新读取设置" Colors={Colors} onPress={() => { void loadSettings(); }} />
            </View>
        </View>;
    }

    if (isInitializing) {
        return (
            <View style={styles.container}>
                <StatusBarDecor />
                <ActivityIndicator color={Colors.accent.gold} style={{ marginTop: 60 }} />
            </View>
        );
    }

    return (
        <Animated.View style={styles.container}>
            <StatusBarDecor />
            <ScrollView
                contentContainerStyle={[layout.content, { paddingBottom: 64 + Math.max(insets.bottom, 16) + 16 }]}
                showsVerticalScrollIndicator={false}
            >
                <View style={layout.header}>
                    <View>
                        <Text style={layout.brand}>设置</Text>
                        <Text style={layout.brandSub}>主题 · AI · 卷宗</Text>
                    </View>
                    <Text style={layout.version}>见机 v{APP_VERSION}</Text>
                </View>

                <View style={[layout.card, layout.themeCard]}>
                    <TaijiHub progress={themeProgress} Colors={Colors} onToggle={handleToggleTheme} />
                    <View style={layout.flex}>
                        <Text style={layout.themeName}>{theme === 'yang' ? '太阳宣白' : '太阴玄黑'}</Text>
                        <Text style={layout.muted}>点按太极切换阴阳</Text>
                        <View style={layout.swatchRow} accessibilityRole="radiogroup">
                            {THEME_SWATCHES.map((item) => {
                                const on = theme === item.key;
                                return (
                                    <Pressable
                                        key={item.key}
                                        onPress={() => { if (!on) handleToggleTheme(); }}
                                        style={[layout.swatch, on && layout.swatchOn]}
                                        accessibilityRole="radio"
                                        accessibilityState={{ checked: on }}
                                        accessibilityLabel={item.label}
                                    >
                                        <View style={[layout.swatchDot, { backgroundColor: item.fill }]} />
                                        <Text style={[layout.swatchText, on && layout.swatchTextOn]}>{item.label}</Text>
                                    </Pressable>
                                );
                            })}
                        </View>
                    </View>
                </View>

                <Text style={layout.sectionLabel}>AI 中枢</Text>
                <Pressable style={({ pressed }) => [layout.card, layout.rowCard, pressed && styles.pressed]} onPress={() => setActiveSheet('ai')} accessibilityRole="button" accessibilityLabel="AI 中枢">
                    <View style={[layout.iconTile, layout.iconTileGold]}><SparkleIcon size={18} color={palette.gold} /></View>
                    <View style={layout.flex}>
                        <View style={layout.titleRow}>
                            <Text style={layout.rowTitle} numberOfLines={1}>{aiModel?.model || '待选择模型'}</Text>
                            <Text style={[layout.badge, aiStatus.good ? layout.badgeGood : layout.badgeMuted]}>{aiStatus.label}</Text>
                        </View>
                        <Text style={layout.muted} numberOfLines={1}>{aiProvider ? getHostLabel(aiProvider.apiUrl.trim().replace(/#$/, '')) : '配置接口地址与 API Key 后可用 AI 解卦'}</Text>
                    </View>
                    <ChevronRightIcon size={16} color={palette.muted} />
                </Pressable>

                <Text style={layout.sectionLabel}>排盘与校时</Text>
                <Pressable style={({ pressed }) => [layout.card, layout.rowCard, pressed && styles.pressed]} onPress={() => setActiveSheet('calendar')} accessibilityRole="button" accessibilityLabel="排盘与校时">
                    <View style={layout.iconTile}><LocationIcon size={18} color={palette.vermilion} /></View>
                    <View style={layout.flex}>
                        <View style={layout.titleRow}>
                            <Text style={layout.rowTitle} numberOfLines={1}>腾讯位置服务 Key</Text>
                            <Text style={[layout.badge, settings.geocoderApiKey ? layout.badgeGood : layout.badgeMuted]}>{settings.geocoderApiKey ? '已配置' : '未配置'}</Text>
                        </View>
                        <Text style={layout.muted} numberOfLines={1}>按出生地、起卦地换算真太阳时</Text>
                    </View>
                    <ChevronRightIcon size={16} color={palette.muted} />
                </Pressable>

                <View style={layout.sectionHead}>
                    <Text style={layout.sectionLabelInline}>卷宗数据</Text>
                    <Text style={layout.sectionLabelInline}>共 {recordCounts.total} 份</Text>
                </View>
                <View style={[layout.card, layout.dataCard]}>
                    <View style={layout.countRow}>
                        {RECORD_ENGINES.map((item, index) => (
                            <View key={item.engine} style={[layout.countCell, index > 0 && layout.countRule]}>
                                <Text style={[layout.countBadge, { color: item.engine === 'meihua' ? palette.vermilion : palette.gold }]}>{item.badge}</Text>
                                <Text style={layout.countValue}>{recordCounts.byEngine[item.engine] ?? 0}</Text>
                                <Text style={layout.countLabel}>{DIVINATION_ENGINE_LABEL[item.engine]}</Text>
                            </View>
                        ))}
                    </View>
                    <View style={layout.dataActions}>
                        <Pressable onPress={handleBackup} disabled={isBackingUp} style={({ pressed }) => [layout.pill, layout.pillPrimary, layout.pillWide, (pressed || isBackingUp) && styles.pressed]} accessibilityRole="button">
                            <Text style={layout.pillPrimaryText}>{isBackingUp ? '导出中…' : '导出备份'}</Text>
                        </Pressable>
                        <Pressable onPress={handleRestore} disabled={isRestoring} style={({ pressed }) => [layout.pill, (pressed || isRestoring) && styles.pressed]} accessibilityRole="button">
                            <Text style={layout.pillText}>导入档案</Text>
                        </Pressable>
                        <Pressable onPress={handleExportDiagnostics} disabled={isExportingDiagnostics} style={({ pressed }) => [layout.pill, (pressed || isExportingDiagnostics) && styles.pressed]} accessibilityRole="button">
                            <Text style={layout.pillText}>{isExportingDiagnostics ? '导出中…' : '故障日志'}</Text>
                        </Pressable>
                    </View>
                    <Text style={layout.note}>备份与日志都不含接口密钥。</Text>
                </View>

                <Text style={layout.sectionLabel}>关于</Text>
                <View style={layout.card}>
                    <Pressable onPress={() => { void Linking.openURL(REPO_URL); }} style={({ pressed }) => [layout.aboutRow, pressed && styles.pressed]} accessibilityRole="link">
                        <Text style={layout.aboutLabel}>开源地址</Text>
                        <Text style={layout.aboutLink} numberOfLines={1}>github.com/Nyxlux-bot/JianJi ↗</Text>
                    </Pressable>
                    <Pressable onPress={handleResetSettings} style={({ pressed }) => [layout.aboutRow, layout.aboutRule, pressed && styles.pressed]} accessibilityRole="button">
                        <Text style={layout.danger}>恢复默认设置</Text>
                    </Pressable>
                </View>
            </ScrollView>

            <SettingsSheet visible={activeSheet !== null} title={getSheetTitle(activeSheet)} Colors={Colors} onClose={requestCloseSheet} independentContent={activeSheet === 'ai'}>
                {activeSheet === 'ai' && (
                    <AIProviderSettings ref={aiProviderSettingsRef} settings={settings} onChange={updateSettings} saveState={saveState} />
                )}
                {activeSheet === 'calendar' && (
                    <View style={styles.sheetBlock}>
                        <FieldLabel label="腾讯位置服务 Key" />
                        <TextInput
                            style={styles.input}
                            value={settings.geocoderApiKey}
                            onChangeText={(value) => updateSettings((prev) => ({ ...prev, geocoderApiKey: value }))}
                            placeholder="请输入腾讯位置服务 Key"
                            placeholderTextColor={Colors.text.tertiary}
                            secureTextEntry
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                        <View style={styles.staticRow}>
                            <Text style={styles.staticLabel}>时间换算口径</Text>
                            <Text style={styles.staticValue}>排盘页选择</Text>
                        </View>
                    </View>
                )}
            </SettingsSheet>

            <ImportPreviewModal
                visible={previewVisible}
                loading={isRestoring}
                records={pendingRecords}
                duplicateCount={pendingDuplicateCount}
                allowEmptySelection={(
                    pendingSettingsRaw !== null
                    && pendingSettingsRaw !== undefined
                ) || pendingGanZhiRelationSettingsRaw !== undefined}
                onCancel={() => {
                    setPreviewVisible(false);
                    setPendingRecords([]);
                    setPendingSettingsRaw(null);
                    setPendingGanZhiRelationSettingsRaw(undefined);
                }}
                onConfirm={handleConfirmRestore}
            />
        </Animated.View>
    );
}

function getSheetTitle(sheet: SheetType): string {
    switch (sheet) {
        case 'ai': return 'AI 中枢';
        case 'calendar': return '排盘与校时';
        default: return '';
    }
}

function SettingsSheet({
    visible,
    title,
    Colors,
    children,
    onClose,
    independentContent = false,
}: {
    visible: boolean;
    title: string;
    Colors: ReturnType<typeof useTheme>['Colors'];
    children: React.ReactNode;
    onClose: () => void;
    independentContent?: boolean;
}) {
    const sheetStyles = makeSheetStyles(Colors);
    const insets = useSafeAreaInsets();
    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <KeyboardAvoidingView style={sheetStyles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined} enabled={independentContent}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="关闭设置" accessibilityRole="button" />
                <View style={[sheetStyles.sheet, independentContent && sheetStyles.aiSheet,
                    independentContent && { paddingBottom: Math.max(insets.bottom, 8) }]}>
                    <View style={sheetStyles.handle} />
                    <View style={[sheetStyles.header, independentContent && sheetStyles.aiHeader]}>
                        <Text style={sheetStyles.title}>{title}</Text>
                        <Pressable style={sheetStyles.closeButton} onPress={onClose} accessibilityRole="button" accessibilityLabel="关闭设置">
                            <CloseIcon size={20} color={Colors.text.primary} />
                        </Pressable>
                    </View>
                    {independentContent ? children : (
                        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                            {children}
                        </ScrollView>
                    )}
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

function FieldLabel({ label }: { label: string }) {
    return <Text style={fieldLabelStyles.label}>{label}</Text>;
}

function ActionButton({
    label,
    Colors,
    onPress,
    disabled,
    variant = 'primary',
}: {
    label: string;
    Colors: any;
    onPress: () => void;
    disabled?: boolean;
    variant?: 'primary' | 'secondary' | 'danger';
}) {
    const isPrimary = variant === 'primary';
    const isDanger = variant === 'danger';
    return (
        <Pressable
            style={({ pressed }) => [
                actionStyles.button,
                {
                    backgroundColor: isDanger ? Colors.accent.red : (isPrimary ? Colors.accent.gold : Colors.bg.elevated),
                    borderColor: isPrimary || isDanger ? 'transparent' : Colors.border.subtle,
                },
                pressed && { opacity: 0.85 },
                disabled && { opacity: 0.5 },
            ]}
            onPress={onPress}
            disabled={disabled}
        >
            <Text style={[actionStyles.text, { color: isPrimary || isDanger ? Colors.text.inverse : Colors.text.primary }]}>{label}</Text>
        </Pressable>
    );
}

const hubStyles = StyleSheet.create({
    wrap: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    pressArea: {
        width: HUB_SIZE,
        height: HUB_SIZE,
        alignItems: 'center',
        justifyContent: 'center',
    },
    taijiLayer: {
        position: 'absolute',
        width: TAIJI_SIZE,
        height: TAIJI_SIZE,
        alignItems: 'center',
        justifyContent: 'center',
    },
});

const actionStyles = StyleSheet.create({
    button: {
        minHeight: 46,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: Spacing.md,
    },
    text: {
        fontSize: FontSize.md,
        fontWeight: '700',
    },
});

const fieldLabelStyles = StyleSheet.create({
    label: {
        fontSize: FontSize.sm,
        fontWeight: '700',
        color: '#8f7732',
        marginTop: Spacing.xs,
    },
});

const makeSheetStyles = (Colors: ReturnType<typeof useTheme>['Colors']) => StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: Colors.bg.overlay,
    },
    sheet: {
        maxHeight: '78%',
        backgroundColor: Colors.bg.card,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: Spacing.xl,
        paddingTop: Spacing.sm,
        paddingBottom: Spacing.xxl,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
    },
    aiSheet: {
        width: '100%',
        maxWidth: 920,
        alignSelf: 'center',
        height: '90%',
        maxHeight: '96%',
        paddingHorizontal: 0,
        overflow: 'hidden',
    },
    aiHeader: {
        paddingHorizontal: 24,
        marginBottom: 4,
    },
    handle: {
        width: 46,
        height: 5,
        borderRadius: 5,
        alignSelf: 'center',
        backgroundColor: Colors.border.normal,
        marginBottom: Spacing.lg,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: Spacing.lg,
    },
    title: {
        color: Colors.text.heading,
        fontSize: FontSize.xl,
        fontWeight: '800',
    },
    closeButton: {
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.bg.elevated,
    },
});

const makeStyles = (Colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    header: {
        height: 58,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.xl,
    },
    headerSide: {
        width: 42,
        height: 42,
    },
    headerTitle: {
        fontSize: FontSize.lg,
        color: Colors.text.heading,
        fontWeight: '700',
    },
    saveButton: {
        width: 42,
        height: 42,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent',
    },
    content: {
        flex: 1,
        paddingHorizontal: Spacing.xl,
        justifyContent: 'flex-start',
        paddingBottom: 116,
    },
    cardGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        rowGap: 12,
        marginTop: 26,
    },
    pressed: {
        opacity: 0.82,
    },
    sheetBlock: {
        gap: Spacing.md,
        paddingBottom: Spacing.lg,
    },
    input: {
        minHeight: 46,
        backgroundColor: Colors.bg.elevated,
        color: Colors.text.primary,
        fontSize: FontSize.md,
        paddingHorizontal: Spacing.md,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
    },
    inputRow: {
        minHeight: 46,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.bg.elevated,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
        paddingLeft: Spacing.md,
        paddingRight: Spacing.xs,
    },
    inputInRow: {
        flex: 1,
        minHeight: 46,
        color: Colors.text.primary,
        fontSize: FontSize.md,
        paddingVertical: 0,
        paddingRight: Spacing.sm,
    },
    inputActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
    },
    inputIconButton: {
        width: 34,
        height: 34,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: BorderRadius.sm,
    },
    inputTextButton: {
        minHeight: 34,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: Spacing.sm,
        borderRadius: BorderRadius.sm,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
    },
    inputTextButtonLabel: {
        color: Colors.accent.gold,
        fontSize: FontSize.xs,
        fontWeight: '700',
    },
    modelDropdown: {
        maxHeight: 190,
        backgroundColor: Colors.bg.elevated,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
        overflow: 'hidden',
    },
    modelOption: {
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.md,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: Colors.border.subtle,
    },
    modelOptionActive: {
        backgroundColor: Colors.bg.card,
    },
    modelOptionText: {
        fontSize: FontSize.sm,
        color: Colors.text.primary,
    },
    modelOptionTextActive: {
        color: Colors.accent.gold,
        fontWeight: '700',
    },
    capabilityRow: {
        minHeight: 58,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: Spacing.md,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.bg.elevated,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
    },
    capabilityLabel: {
        color: Colors.text.tertiary,
        fontSize: FontSize.xs,
        fontWeight: '600',
    },
    capabilityDetails: {
        flex: 1,
        minWidth: 0,
    },
    capabilityValue: {
        marginTop: 3,
        color: Colors.text.primary,
        fontSize: FontSize.sm,
        fontWeight: '700',
    },
    capabilitySource: {
        color: Colors.accent.gold,
        fontSize: FontSize.xs,
        fontWeight: '700',
    },
    sheetActions: {
        flexDirection: 'row',
        gap: Spacing.md,
        marginTop: Spacing.sm,
    },
    staticRow: {
        minHeight: 48,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.bg.elevated,
        paddingHorizontal: Spacing.md,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
    },
    staticLabel: {
        fontSize: FontSize.sm,
        color: Colors.text.secondary,
        fontWeight: '700',
    },
    staticValue: {
        fontSize: FontSize.sm,
        color: Colors.text.primary,
        fontWeight: '700',
    },
    staticColumn: {
        minHeight: 64,
        justifyContent: 'center',
        gap: 6,
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.bg.elevated,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
    },
    linkValue: {
        fontSize: FontSize.sm,
        color: Colors.accent.gold,
        fontWeight: '700',
    },
});

const makeLayoutStyles = (palette: ResultPalette, Colors: any) => StyleSheet.create({
    content: { paddingTop: 20, paddingHorizontal: 16, gap: 12 },
    flex: { flex: 1, minWidth: 0 },
    header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
    brand: { fontFamily: Platform.select({ ios: 'Songti SC', android: 'serif', default: 'serif' }), fontSize: 28, lineHeight: 36, fontWeight: '500', letterSpacing: 6, color: palette.heading },
    brandSub: { fontSize: 11, lineHeight: 16, letterSpacing: 2, color: palette.gold },
    version: { fontSize: 11, lineHeight: 16, color: palette.muted },
    card: { borderRadius: 16, borderWidth: 1, borderColor: palette.cardBorder, backgroundColor: palette.card },
    themeCard: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingLeft: 10, paddingRight: 14, borderRadius: 18 },
    themeName: { fontFamily: Platform.select({ ios: 'Songti SC', android: 'serif', default: 'serif' }), fontSize: 21, lineHeight: 28, fontWeight: '700', color: palette.heading },
    muted: { marginTop: 2, fontSize: 12, lineHeight: 17, color: palette.muted },
    swatchRow: { marginTop: 12, flexDirection: 'row', gap: 8 },
    swatch: { height: 32, flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 6, paddingRight: 10, borderRadius: 16, borderWidth: 1, borderColor: palette.cardBorder, backgroundColor: palette.segTrack },
    swatchOn: { borderColor: palette.gold },
    swatchDot: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: palette.cardBorder },
    swatchText: { fontSize: 12.5, fontWeight: '600', color: palette.muted },
    swatchTextOn: { color: palette.heading },
    sectionLabel: { fontSize: 12, lineHeight: 16, color: palette.muted, marginBottom: -4 },
    sectionHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: -4 },
    sectionLabelInline: { fontSize: 12, lineHeight: 16, color: palette.muted },
    rowCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
    iconTile: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.segTrack },
    iconTileGold: { backgroundColor: palette.goldSoft },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    rowTitle: { flexShrink: 1, fontSize: 15, lineHeight: 21, fontWeight: '700', color: palette.heading },
    badge: { paddingHorizontal: 6, borderRadius: 4, overflow: 'hidden', fontSize: 11, lineHeight: 16, fontWeight: '600' },
    badgeGood: { color: Colors.bazi.statePositive, backgroundColor: palette.isLight ? 'rgba(47,138,99,0.12)' : 'rgba(84,183,142,0.14)' },
    badgeMuted: { color: palette.muted, backgroundColor: palette.segTrack },
    dataCard: { paddingVertical: 12, paddingHorizontal: 14 },
    countRow: { flexDirection: 'row' },
    countCell: { flex: 1, alignItems: 'center' },
    countRule: { borderLeftWidth: 1, borderLeftColor: palette.cardBorder },
    countBadge: { fontFamily: Platform.select({ ios: 'Songti SC', android: 'serif', default: 'serif' }), fontSize: 13, lineHeight: 18, fontWeight: '700' },
    countValue: { fontSize: 18, lineHeight: 24, fontWeight: '700', color: palette.heading },
    countLabel: { fontSize: 11, lineHeight: 15, color: palette.muted },
    dataActions: { flexDirection: 'row', gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: palette.cardBorder },
    pill: { flex: 1, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.cardBorder, backgroundColor: palette.segTrack },
    pillWide: { flex: 1.2 },
    pillPrimary: { borderColor: palette.gold, backgroundColor: palette.gold },
    pillText: { fontSize: 13, fontWeight: '600', color: palette.ink },
    pillPrimaryText: { fontSize: 13, fontWeight: '700', color: Colors.text.inverse },
    note: { marginTop: 8, fontSize: 11, lineHeight: 16, color: palette.muted },
    aboutRow: { height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 14 },
    aboutRule: { borderTopWidth: 1, borderTopColor: palette.cardBorder },
    aboutLabel: { fontSize: 14, color: palette.ink },
    aboutLink: { flexShrink: 1, fontSize: 13, color: palette.gold },
    danger: { fontSize: 14, color: palette.vermilion },
});
