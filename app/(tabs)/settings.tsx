import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Easing,
    Modal,
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
import * as Clipboard from 'expo-clipboard';
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
import { ThemeType, useTheme } from '../../src/theme/ThemeContext';
import { validateImportRecords } from '../../src/db/import-validation';
import ImportPreviewModal from '../../src/components/ImportPreviewModal';
import {
    AISettings,
    DEFAULT_SETTINGS,
    getSettings,
    mergeImportedSettings,
    saveSettings,
} from '../../src/services/settings';
import { exportDiagnosticLogFile, recordDiagnosticLog } from '../../src/services/diagnostics';
import { fetchAvailableModels } from '../../src/services/ai-models';
import { resolveChatCompletionsUrl } from '../../src/services/ai-endpoints';
import { CloseIcon, ChevronRightIcon } from '../../src/components/Icons';
import appConfig from '../../app.json';

type SheetType = 'ai' | 'calendar' | 'data' | 'about' | null;

const APP_VERSION = appConfig.expo.version;
const HEXAGRAMS = Array.from({ length: 64 }, (_, index) => String.fromCharCode(0x4DC0 + index));

function buildBackupSettings(settings: AISettings): AISettings {
    return {
        ...settings,
        apiKey: '',
        geocoderApiKey: '',
    };
}

function getHostLabel(value: string): string {
    if (!value.trim()) return '未配置';
    try {
        return new URL(value).host;
    } catch {
        return value.replace(/^https?:\/\//, '').split('/')[0] || '已填写';
    }
}

function normalizeTemperatureInput(value: string): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return DEFAULT_SETTINGS.temperature;
    return Math.max(0, Math.min(2, Number(parsed.toFixed(2))));
}

function SaveIcon({ color, size = 22 }: { color: string; size?: number }) {
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Path d="M5 3h12l2 2v16H5V3z" stroke={color} strokeWidth="1.7" strokeLinejoin="round" />
            <Path d="M8 3v6h8V3" stroke={color} strokeWidth="1.7" strokeLinejoin="round" />
            <Path d="M8 21v-7h8v7" stroke={color} strokeWidth="1.7" strokeLinejoin="round" />
        </Svg>
    );
}

function EyeIcon({ color, hidden, size = 20 }: { color: string; hidden: boolean; size?: number }) {
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Path
                d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"
                stroke={color}
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth="1.7" />
            {hidden && <Path d="M4 20L20 4" stroke={color} strokeWidth="1.9" strokeLinecap="round" />}
        </Svg>
    );
}

function TaijiHub({
    theme,
    progress,
    Colors,
    onToggle,
}: {
    theme: ThemeType;
    progress: Animated.Value;
    Colors: any;
    onToggle: () => void;
}) {
    const rotate = progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
    const ringRotate = progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '22.5deg'] });
    const title = theme === 'yang' ? '太阳宣白' : '太阴玄黑';
    const yinColor = '#111111';
    const yangColor = '#f7f1e4';
    const ringColor = Colors.accent.gold;
    const center = 96;
    const outerRadius = 82;

    return (
        <View style={hubStyles.wrap}>
            <Pressable onPress={onToggle} style={({ pressed }) => [hubStyles.pressArea, pressed && { opacity: 0.9 }]}>
                <Animated.View style={{ transform: [{ rotate: ringRotate }] }}>
                    <Svg width={192} height={192} viewBox="0 0 192 192">
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
                    <Svg width={124} height={124} viewBox="0 0 132 132">
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
            <Text style={[hubStyles.themeName, { color: Colors.text.heading }]}>{title}</Text>
            <Text style={[hubStyles.themeAction, { color: Colors.accent.gold }]}>点按太极切换阴阳</Text>
        </View>
    );
}

export default function SettingsPage() {
    const { Colors, theme, setTheme } = useTheme();
    const styles = makeStyles(Colors);
    const themeProgress = useRef(new Animated.Value(theme === 'yang' ? 1 : 0)).current;
    const [settings, setSettings] = useState<AISettings>(DEFAULT_SETTINGS);
    const [isInitializing, setIsInitializing] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isBackingUp, setIsBackingUp] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);
    const [isExportingDiagnostics, setIsExportingDiagnostics] = useState(false);
    const [fetchingModels, setFetchingModels] = useState(false);
    const [testingAI, setTestingAI] = useState(false);
    const [availableModels, setAvailableModels] = useState<string[]>([]);
    const [modelDropdownVisible, setModelDropdownVisible] = useState(false);
    const [activeSheet, setActiveSheet] = useState<SheetType>(null);
    const [previewVisible, setPreviewVisible] = useState(false);
    const [pendingRecords, setPendingRecords] = useState<DivinationRecordEnvelope[]>([]);
    const [pendingSettingsRaw, setPendingSettingsRaw] = useState<unknown>(null);
    const [pendingDuplicateCount, setPendingDuplicateCount] = useState(0);

    const filteredModels = useMemo(() => {
        const keyword = settings.model.trim().toLowerCase();
        if (!keyword) return availableModels;
        return availableModels.filter((item) => item.toLowerCase().includes(keyword));
    }, [availableModels, settings.model]);

    useEffect(() => {
        getSettings().then((nextSettings) => {
            setSettings(nextSettings);
            setIsInitializing(false);
        });
    }, []);

    useEffect(() => {
        Animated.timing(themeProgress, {
            toValue: theme === 'yang' ? 1 : 0,
            duration: 520,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
        }).start();
    }, [theme, themeProgress]);

    useEffect(() => {
        setAvailableModels([]);
        setModelDropdownVisible(false);
    }, [settings.apiKey, settings.apiUrl]);

    const handleToggleTheme = () => {
        setTheme(theme === 'yang' ? 'yin' : 'yang');
    };

    const handleSaveSettings = async () => {
        setIsSaving(true);
        try {
            await saveSettings(settings);
            CustomAlert.alert('保存成功', '设置已保存');
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : '保存设置失败';
            CustomAlert.alert('保存失败', message);
        } finally {
            setIsSaving(false);
        }
    };

    const fetchModels = async () => {
        if (!settings.apiUrl.trim() || !settings.apiKey.trim()) {
            CustomAlert.alert('提示', '请先填写接口地址与 API Key。');
            return;
        }

        setFetchingModels(true);
        try {
            const models = await fetchAvailableModels({ apiUrl: settings.apiUrl, apiKey: settings.apiKey });
            setAvailableModels(models);
            setModelDropdownVisible(models.length > 0);
            CustomAlert.alert(models.length > 0 ? '获取成功' : '提示', models.length > 0 ? `已获取 ${models.length} 个模型。` : '接口可用，但未返回模型列表。');
        } catch (error: unknown) {
            setAvailableModels([]);
            setModelDropdownVisible(false);
            const message = error instanceof Error ? error.message : '获取模型失败';
            CustomAlert.alert('获取模型失败', message);
        } finally {
            setFetchingModels(false);
        }
    };

    const testAIConnection = async () => {
        if (!settings.apiUrl.trim() || !settings.apiKey.trim() || !settings.model.trim()) {
            CustomAlert.alert('提示', '请先填写接口地址、API Key 与模型名称。');
            return;
        }

        setTestingAI(true);
        try {
            const models = await fetchAvailableModels({ apiUrl: settings.apiUrl, apiKey: settings.apiKey });
            if (models.length > 0) {
                setAvailableModels(models);
                if (!models.includes(settings.model)) {
                    throw new Error('模型列表中没有当前模型，请重新选择模型名称。');
                }
            }

            const response = await fetch(resolveChatCompletionsUrl(settings.apiUrl), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${settings.apiKey}`,
                },
                body: JSON.stringify({
                    model: settings.model,
                    messages: [{ role: 'user', content: 'ping' }],
                    temperature: settings.temperature,
                    max_tokens: 8,
                }),
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`连接失败：${response.status} ${text.slice(0, 120)}`);
            }

            CustomAlert.alert('连接正常', '模型列表与对话接口均可用。');
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : '测试连接失败';
            CustomAlert.alert('测试失败', message);
        } finally {
            setTestingAI(false);
        }
    };

    const handleBackup = async () => {
        try {
            setIsBackingUp(true);
            const records = await exportAllRecords();
            const backupData = {
                version: 2,
                timestamp: new Date().toISOString(),
                settings: buildBackupSettings(settings),
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
        try {
            setIsRestoring(true);

            if (pendingSettingsRaw) {
                const normalizedSettings = mergeImportedSettings(pendingSettingsRaw, settings);
                await saveSettings(normalizedSettings);
                setSettings(normalizedSettings);
            }

            const stats = await importRecords(payload.selectedRecords, {
                mode: 'merge',
                conflictPolicy: payload.conflictPolicy,
            });

            setPreviewVisible(false);
            setPendingRecords([]);
            setPendingSettingsRaw(null);

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
                onPress: async () => {
                    await saveSettings(DEFAULT_SETTINGS);
                    setSettings(DEFAULT_SETTINGS);
                    setTheme('yin');
                    CustomAlert.alert('已恢复', '设置已恢复为默认状态。');
                },
            },
        ]);
    };

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
            <View style={styles.header}>
                <View style={styles.headerSide} />
                <Text style={styles.headerTitle}>设置</Text>
                <Pressable
                    style={({ pressed }) => [styles.saveButton, pressed && styles.pressed, isSaving && styles.disabled]}
                    onPress={handleSaveSettings}
                    disabled={isSaving}
                >
                    {isSaving ? <ActivityIndicator size="small" color={Colors.accent.gold} /> : <SaveIcon color={Colors.accent.gold} />}
                </Pressable>
            </View>

            <View style={styles.content}>
                <TaijiHub theme={theme} progress={themeProgress} Colors={Colors} onToggle={handleToggleTheme} />

                <View style={styles.cardGrid}>
                    <SettingCard
                        title="AI 中枢"
                        value={settings.apiKey ? settings.model || '已配置' : '未配置'}
                        meta={getHostLabel(settings.apiUrl)}
                        Colors={Colors}
                        onPress={() => setActiveSheet('ai')}
                    />
                    <SettingCard
                        title="排盘与校时"
                        value={settings.geocoderApiKey ? '位置 Key 已配置' : '未配置'}
                        meta="时间口径随排盘选择"
                        Colors={Colors}
                        onPress={() => setActiveSheet('calendar')}
                    />
                    <SettingCard
                        title="卷宗数据"
                        value="导入 / 导出"
                        meta="不导出接口密钥"
                        Colors={Colors}
                        onPress={() => setActiveSheet('data')}
                    />
                    <SettingCard
                        title="关于与重置"
                        value={`版本 ${APP_VERSION}`}
                        meta={theme === 'yang' ? '太阳宣白' : '太阴玄黑'}
                        Colors={Colors}
                        onPress={() => setActiveSheet('about')}
                    />
                </View>
            </View>

            <SettingsSheet visible={activeSheet !== null} title={getSheetTitle(activeSheet)} Colors={Colors} onClose={() => setActiveSheet(null)}>
                {activeSheet === 'ai' && (
                    <AISettingsSheet
                        settings={settings}
                        Colors={Colors}
                        styles={styles}
                        fetchingModels={fetchingModels}
                        testingAI={testingAI}
                        availableModels={availableModels}
                        filteredModels={filteredModels}
                        modelDropdownVisible={modelDropdownVisible}
                        setModelDropdownVisible={setModelDropdownVisible}
                        setSettings={setSettings}
                        fetchModels={fetchModels}
                        testAIConnection={testAIConnection}
                    />
                )}
                {activeSheet === 'calendar' && (
                    <View style={styles.sheetBlock}>
                        <FieldLabel label="腾讯位置服务 Key" />
                        <TextInput
                            style={styles.input}
                            value={settings.geocoderApiKey}
                            onChangeText={(value) => setSettings((prev) => ({ ...prev, geocoderApiKey: value }))}
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
                {activeSheet === 'data' && (
                    <View style={styles.sheetBlock}>
                        <ActionButton label={isBackingUp ? '导出中...' : '导出备份'} Colors={Colors} onPress={handleBackup} disabled={isBackingUp} />
                        <ActionButton label="导入档案" Colors={Colors} onPress={handleRestore} variant="secondary" />
                        <ActionButton
                            label={isExportingDiagnostics ? '导出中...' : '导出故障日志'}
                            Colors={Colors}
                            onPress={handleExportDiagnostics}
                            disabled={isExportingDiagnostics}
                            variant="secondary"
                        />
                    </View>
                )}
                {activeSheet === 'about' && (
                    <View style={styles.sheetBlock}>
                        <View style={styles.staticRow}>
                            <Text style={styles.staticLabel}>当前版本</Text>
                            <Text style={styles.staticValue}>{APP_VERSION}</Text>
                        </View>
                        <View style={styles.staticRow}>
                            <Text style={styles.staticLabel}>当前主题</Text>
                            <Text style={styles.staticValue}>{theme === 'yang' ? '太阳宣白' : '太阴玄黑'}</Text>
                        </View>
                        <View style={styles.staticColumn}>
                            <Text style={styles.staticLabel}>开源地址</Text>
                            <Text style={styles.linkValue}>https://github.com/Nyxlux-bot/JianJi</Text>
                        </View>
                        <ActionButton label="恢复默认设置" Colors={Colors} onPress={handleResetSettings} variant="danger" />
                    </View>
                )}
            </SettingsSheet>

            <ImportPreviewModal
                visible={previewVisible}
                loading={isRestoring}
                records={pendingRecords}
                duplicateCount={pendingDuplicateCount}
                allowEmptySelection={pendingSettingsRaw !== null && pendingSettingsRaw !== undefined}
                onCancel={() => {
                    setPreviewVisible(false);
                    setPendingRecords([]);
                    setPendingSettingsRaw(null);
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
        case 'data': return '卷宗数据';
        case 'about': return '关于与重置';
        default: return '';
    }
}

function SettingCard({
    title,
    value,
    meta,
    Colors,
    onPress,
}: {
    title: string;
    value: string;
    meta: string;
    Colors: any;
    onPress: () => void;
}) {
    return (
        <Pressable style={({ pressed }) => [cardStyles.card, { backgroundColor: Colors.bg.card, borderColor: Colors.border.subtle }, pressed && { opacity: 0.86 }]} onPress={onPress}>
            <View style={cardStyles.chevronRow}>
                <ChevronRightIcon size={16} color={Colors.text.tertiary} />
            </View>
            <Text style={[cardStyles.cardTitle, { color: Colors.text.heading }]} numberOfLines={1}>{title}</Text>
            <Text style={[cardStyles.cardValue, { color: Colors.text.primary }]} numberOfLines={1}>{value}</Text>
            <Text style={[cardStyles.cardMeta, { color: Colors.text.tertiary }]} numberOfLines={1}>{meta}</Text>
        </Pressable>
    );
}

function SettingsSheet({
    visible,
    title,
    Colors,
    children,
    onClose,
}: {
    visible: boolean;
    title: string;
    Colors: any;
    children: React.ReactNode;
    onClose: () => void;
}) {
    const sheetStyles = makeSheetStyles(Colors);
    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={sheetStyles.overlay}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
                <View style={sheetStyles.sheet}>
                    <View style={sheetStyles.handle} />
                    <View style={sheetStyles.header}>
                        <Text style={sheetStyles.title}>{title}</Text>
                        <Pressable style={sheetStyles.closeButton} onPress={onClose}>
                            <CloseIcon size={20} color={Colors.text.primary} />
                        </Pressable>
                    </View>
                    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                        {children}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}

function FieldLabel({ label }: { label: string }) {
    return <Text style={fieldLabelStyles.label}>{label}</Text>;
}

function AISettingsSheet({
    settings,
    Colors,
    styles,
    fetchingModels,
    testingAI,
    filteredModels,
    modelDropdownVisible,
    setModelDropdownVisible,
    setSettings,
    fetchModels,
    testAIConnection,
}: {
    settings: AISettings;
    Colors: any;
    styles: ReturnType<typeof makeStyles>;
    fetchingModels: boolean;
    testingAI: boolean;
    availableModels: string[];
    filteredModels: string[];
    modelDropdownVisible: boolean;
    setModelDropdownVisible: (value: boolean) => void;
    setSettings: React.Dispatch<React.SetStateAction<AISettings>>;
    fetchModels: () => void;
    testAIConnection: () => void;
}) {
    const [temperatureText, setTemperatureText] = useState(String(settings.temperature));
    const [apiKeyVisible, setApiKeyVisible] = useState(false);

    useEffect(() => {
        setTemperatureText(String(settings.temperature));
    }, [settings.temperature]);

    const copyValue = async (label: string, value: string) => {
        const text = value.trim();
        if (!text) {
            CustomAlert.alert('暂无可复制内容', `请先填写${label}。`);
            return;
        }
        await Clipboard.setStringAsync(text);
        CustomAlert.alert('复制成功', `${label}已复制。`);
    };

    const pasteApiUrl = async () => {
        const text = (await Clipboard.getStringAsync()).trim();
        if (!text) {
            CustomAlert.alert('剪贴板为空', '没有可粘贴内容。');
            return;
        }
        setSettings((prev) => ({ ...prev, apiUrl: text }));
    };

    const pasteApiKey = async () => {
        const text = (await Clipboard.getStringAsync()).trim();
        if (!text) {
            CustomAlert.alert('剪贴板为空', '没有可粘贴内容。');
            return;
        }
        setSettings((prev) => ({ ...prev, apiKey: text }));
    };

    const commitTemperature = () => {
        const normalized = normalizeTemperatureInput(temperatureText);
        setTemperatureText(String(normalized));
        setSettings((prev) => ({ ...prev, temperature: normalized }));
    };

    return (
        <View style={styles.sheetBlock}>
            <FieldLabel label="接口地址" />
            <View style={styles.inputRow}>
                <TextInput
                    style={styles.inputInRow}
                    value={settings.apiUrl}
                    onChangeText={(value) => setSettings((prev) => ({ ...prev, apiUrl: value }))}
                    placeholder="https://api.openai.com/v1/chat/completions"
                    placeholderTextColor={Colors.text.tertiary}
                    autoCapitalize="none"
                    autoCorrect={false}
                />
                <View style={styles.inputActions}>
                    <Pressable style={styles.inputTextButton} onPress={() => copyValue('接口地址', settings.apiUrl)}>
                        <Text style={styles.inputTextButtonLabel}>复制</Text>
                    </Pressable>
                    <Pressable style={styles.inputTextButton} onPress={pasteApiUrl}>
                        <Text style={styles.inputTextButtonLabel}>粘贴</Text>
                    </Pressable>
                </View>
            </View>

            <FieldLabel label="API Key" />
            <View style={styles.inputRow}>
                <TextInput
                    style={styles.inputInRow}
                    value={settings.apiKey}
                    onChangeText={(value) => setSettings((prev) => ({ ...prev, apiKey: value }))}
                    placeholder="sk-..."
                    placeholderTextColor={Colors.text.tertiary}
                    secureTextEntry={!apiKeyVisible}
                    autoCapitalize="none"
                    autoCorrect={false}
                />
                <View style={styles.inputActions}>
                    <Pressable
                        style={styles.inputIconButton}
                        onPress={() => setApiKeyVisible((prev) => !prev)}
                        accessibilityLabel={apiKeyVisible ? '隐藏 API Key' : '显示 API Key'}
                    >
                        <EyeIcon color={Colors.text.secondary} hidden={!apiKeyVisible} />
                    </Pressable>
                    <Pressable style={styles.inputTextButton} onPress={() => copyValue('API Key', settings.apiKey)}>
                        <Text style={styles.inputTextButtonLabel}>复制</Text>
                    </Pressable>
                    <Pressable style={styles.inputTextButton} onPress={pasteApiKey}>
                        <Text style={styles.inputTextButtonLabel}>粘贴</Text>
                    </Pressable>
                </View>
            </View>

            <FieldLabel label="模型名称" />
            <TextInput
                style={styles.input}
                value={settings.model}
                onChangeText={(value) => {
                    setSettings((prev) => ({ ...prev, model: value }));
                    setModelDropdownVisible(true);
                }}
                onFocus={() => setModelDropdownVisible(filteredModels.length > 0)}
                placeholder="gpt-4o"
                placeholderTextColor={Colors.text.tertiary}
                autoCapitalize="none"
                autoCorrect={false}
            />
            {modelDropdownVisible && filteredModels.length > 0 && (
                <View style={styles.modelDropdown}>
                    <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                        {filteredModels.map((item) => (
                            <Pressable
                                key={item}
                                style={({ pressed }) => [styles.modelOption, item === settings.model && styles.modelOptionActive, pressed && styles.pressed]}
                                onPress={() => {
                                    setSettings((prev) => ({ ...prev, model: item }));
                                    setModelDropdownVisible(false);
                                }}
                            >
                                <Text style={[styles.modelOptionText, item === settings.model && styles.modelOptionTextActive]}>{item}</Text>
                            </Pressable>
                        ))}
                    </ScrollView>
                </View>
            )}

            <FieldLabel label="温度" />
            <TextInput
                style={styles.input}
                value={temperatureText}
                onChangeText={setTemperatureText}
                onBlur={commitTemperature}
                onSubmitEditing={commitTemperature}
                placeholder="0.7"
                placeholderTextColor={Colors.text.tertiary}
                keyboardType="decimal-pad"
            />

            <View style={styles.sheetActions}>
                <ActionButton label={fetchingModels ? '获取中...' : '获取模型'} Colors={Colors} onPress={fetchModels} disabled={fetchingModels} />
                <ActionButton label={testingAI ? '测试中...' : '测试连接'} Colors={Colors} onPress={testAIConnection} disabled={testingAI} variant="secondary" />
            </View>
        </View>
    );
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
        height: 250,
        justifyContent: 'center',
    },
    pressArea: {
        width: 192,
        height: 192,
        alignItems: 'center',
        justifyContent: 'center',
    },
    taijiLayer: {
        position: 'absolute',
        width: 124,
        height: 124,
        alignItems: 'center',
        justifyContent: 'center',
    },
    themeName: {
        marginTop: -4,
        fontSize: 18,
        fontWeight: '700',
    },
    themeAction: {
        marginTop: 4,
        fontSize: 12,
        fontWeight: '600',
    },
});

const cardStyles = StyleSheet.create({
    card: {
        width: '48%',
        minHeight: 100,
        borderRadius: 18,
        borderWidth: 1,
        padding: 14,
    },
    chevronRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        marginBottom: 6,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 6,
    },
    cardValue: {
        fontSize: 13,
        fontWeight: '600',
        marginBottom: 4,
    },
    cardMeta: {
        fontSize: 11,
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

const makeSheetStyles = (Colors: any) => StyleSheet.create({
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
        backgroundColor: Colors.bg.primary,
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
    disabled: {
        opacity: 0.5,
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
