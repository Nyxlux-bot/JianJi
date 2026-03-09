import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    TextInput,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
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
    saveSettings,
} from '../../src/services/settings';

function buildBackupSettings(settings: AISettings): AISettings {
    return {
        ...settings,
        apiKey: '',
    };
}

function normalizeImportedSettings(rawSettings: unknown, currentSettings: AISettings): AISettings {
    if (!rawSettings || typeof rawSettings !== 'object') {
        return currentSettings;
    }

    const incoming = rawSettings as Record<string, unknown>;

    return {
        apiUrl: typeof incoming.apiUrl === 'string' && incoming.apiUrl.trim().length > 0
            ? incoming.apiUrl
            : currentSettings.apiUrl,
        apiKey: typeof incoming.apiKey === 'string' && incoming.apiKey.trim().length > 0
            ? incoming.apiKey
            : currentSettings.apiKey,
        model: typeof incoming.model === 'string' && incoming.model.trim().length > 0
            ? incoming.model
            : currentSettings.model,
    };
}

export default function SettingsPage() {
    const { Colors, theme, setTheme } = useTheme();
    const styles = makeStyles(Colors);
    const [settings, setSettings] = useState<AISettings>(DEFAULT_SETTINGS);
    const [isInitializing, setIsInitializing] = useState(true);
    const [isBackingUp, setIsBackingUp] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);
    const [savingAI, setSavingAI] = useState(false);
    const [fetchingModels, setFetchingModels] = useState(false);
    const [previewVisible, setPreviewVisible] = useState(false);
    const [pendingRecords, setPendingRecords] = useState<DivinationRecordEnvelope[]>([]);
    const [pendingSettingsRaw, setPendingSettingsRaw] = useState<unknown>(null);
    const [pendingDuplicateCount, setPendingDuplicateCount] = useState(0);

    useEffect(() => {
        getSettings().then((nextSettings) => {
            setSettings(nextSettings);
            setIsInitializing(false);
        });
    }, []);

    const handleSaveAISettings = async () => {
        setSavingAI(true);
        try {
            await saveSettings(settings);
            CustomAlert.alert('保存成功', 'AI 配置已保存');
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : '保存配置失败';
            CustomAlert.alert('错误', message);
        } finally {
            setSavingAI(false);
        }
    };

    const fetchModels = async () => {
        if (!settings.apiUrl || !settings.apiKey) {
            CustomAlert.alert('提示', '请先配置 API Key 与接口地址。');
            return;
        }

        setFetchingModels(true);
        try {
            let url = settings.apiUrl;
            if (url.endsWith('/chat/completions')) {
                url = url.replace('/chat/completions', '/models');
            } else if (url.endsWith('/v1')) {
                url = `${url}/models`;
            } else {
                try {
                    const urlObj = new URL(settings.apiUrl);
                    urlObj.pathname = urlObj.pathname.replace(/\/chat\/completions\/?$/, '/models');
                    url = urlObj.toString();
                } catch {
                    // keep original url if parsing fails
                }
            }

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${settings.apiKey.trim()}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`连接失败 ${response.status}: ${text}`);
            }

            const data = await response.json();
            if (!data || !Array.isArray(data.data) || data.data.length === 0) {
                CustomAlert.alert('提示', '接口调用成功，但未返回可用的模型列表。');
                return;
            }

            const models = data.data
                .map((item: { id?: string }) => item.id)
                .filter((item: unknown): item is string => typeof item === 'string')
                .sort();

            if (models.length === 0) {
                CustomAlert.alert('提示', '接口调用成功，但未返回可用的模型列表。');
                return;
            }

            CustomAlert.alert('模型列表', models.join('\n'));
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : '获取模型失败';
            CustomAlert.alert('获取模型失败', message);
        } finally {
            setFetchingModels(false);
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
                meta: {
                    apiKeyIncluded: false,
                },
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
                CustomAlert.alert('备份已导出', '为安全起见，备份文件默认不包含 API Key，恢复后请手动填写。');
            } else {
                CustomAlert.alert('提示', '当前设备不支持分享文件');
            }
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : '备份失败';
            CustomAlert.alert('备份失败', message);
        } finally {
            setIsBackingUp(false);
        }
    };

    const handleRestore = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: 'application/json',
                copyToCacheDirectory: true,
            });

            if (result.canceled || !result.assets || result.assets.length === 0) {
                return;
            }

            const fileUri = result.assets[0].uri;
            const content = await FileSystem.readAsStringAsync(fileUri, { encoding: FileSystem.EncodingType.UTF8 });
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
                const normalizedSettings = normalizeImportedSettings(pendingSettingsRaw, settings);
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

            CustomAlert.alert(
                '恢复成功',
                `导入完成：新增 ${stats.inserted} 条，覆盖 ${stats.updated} 条，跳过 ${stats.skipped} 条。`,
            );
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : '文件解析错误';
            CustomAlert.alert('恢复失败', message);
        } finally {
            setIsRestoring(false);
        }
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
        <View style={styles.container}>
            <StatusBarDecor />
            <View style={styles.header}>
                <View style={styles.backBtn} />
                <Text style={styles.headerTitle}>设置</Text>
                <View style={styles.saveBtn} />
            </View>

            <ScrollView
                style={styles.content}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                <Text style={styles.sectionTitle}>外观设置</Text>
                <Text style={styles.sectionHint}>选择应用的全局主题颜色。</Text>
                <View style={styles.themeOptionsContainer}>
                    {[
                        { id: 'dark', name: '玄黑金', color: '#1A1C23' },
                        { id: 'green', name: '原矿绿', color: '#1F2E23' },
                        { id: 'white', name: '宣纸白', color: '#FDFBF7' },
                        { id: 'purple', name: '紫檀香', color: '#2A1B28' },
                    ].map((item) => (
                        <TouchableOpacity
                            key={item.id}
                            style={[styles.themeOptionBtn, theme === item.id && styles.themeOptionBtnActive]}
                            onPress={() => setTheme(item.id as typeof theme)}
                        >
                            <View style={[styles.themeColorPreview, { backgroundColor: item.color }]} />
                            <Text style={[styles.themeOptionText, theme === item.id && styles.themeOptionTextActive]}>
                                {item.name}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <Text style={styles.sectionTitle}>AI 配置</Text>
                <Text style={styles.sectionHint}>
                    连接配置全局共用。提示词已固定为内建版本，由开发者在代码中维护，用户侧仅保留接口配置。
                </Text>

                <View style={styles.card}>
                    <View style={styles.fieldGroup}>
                        <Text style={styles.label}>接口地址 (Base URL 或 Chat Endpoint)</Text>
                        <TextInput
                            style={styles.input}
                            value={settings.apiUrl}
                            onChangeText={(value) => setSettings((prev) => ({ ...prev, apiUrl: value }))}
                            placeholder="https://api.openai.com/v1/chat/completions"
                            placeholderTextColor={Colors.text.tertiary}
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                    </View>

                    <View style={styles.fieldGroup}>
                        <Text style={styles.label}>秘钥 (API Key)</Text>
                        <TextInput
                            style={styles.input}
                            value={settings.apiKey}
                            onChangeText={(value) => setSettings((prev) => ({ ...prev, apiKey: value }))}
                            placeholder="sk-..."
                            placeholderTextColor={Colors.text.tertiary}
                            secureTextEntry
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                    </View>

                    <View style={styles.fieldGroup}>
                        <View style={styles.modelLabelRow}>
                            <Text style={styles.label}>模型名称</Text>
                            <TouchableOpacity onPress={fetchModels} disabled={fetchingModels} style={styles.fetchBtn}>
                                {fetchingModels ? (
                                    <ActivityIndicator size="small" color={Colors.accent.gold} />
                                ) : (
                                    <Text style={styles.fetchBtnText}>获取线上模型列表</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                        <TextInput
                            style={styles.input}
                            value={settings.model}
                            onChangeText={(value) => setSettings((prev) => ({ ...prev, model: value }))}
                            placeholder="gpt-4o"
                            placeholderTextColor={Colors.text.tertiary}
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                    </View>
                </View>
                <TouchableOpacity
                    style={[styles.primaryBtn, savingAI && styles.primaryBtnDisabled]}
                    onPress={handleSaveAISettings}
                    disabled={savingAI}
                >
                    <Text style={styles.primaryBtnText}>{savingAI ? '保存中...' : '保存 AI 配置'}</Text>
                </TouchableOpacity>

                <Text style={styles.sectionTitle}>卷宗备份与迁移</Text>
                <Text style={styles.sectionHint}>
                    将接口配置与占卜记录安全打包为本地文件并支持恢复。为保护隐私，导出备份默认不包含 API Key。
                </Text>

                <View style={styles.backupOptionsContainer}>
                    <TouchableOpacity style={styles.backupBtn} onPress={handleBackup} disabled={isBackingUp}>
                        {isBackingUp ? (
                            <ActivityIndicator size="small" color={Colors.text.primary} />
                        ) : (
                            <Text style={styles.backupBtnText}>导出全量数据 (Backup)</Text>
                        )}
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.backupBtn, styles.restoreBtn]} onPress={handleRestore}>
                        <Text style={[styles.backupBtnText, styles.restoreBtnText]}>导入外部档案 (Restore)</Text>
                    </TouchableOpacity>
                </View>

                <View style={{ height: 60 }} />
            </ScrollView>

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
        </View>
    );
}

const makeStyles = (Colors: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.bg.primary },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
    },
    backBtn: { width: 40, height: 40, justifyContent: 'center' },
    headerTitle: { fontSize: FontSize.lg, color: Colors.text.heading, fontWeight: '400' },
    saveBtn: { width: 40, height: 40 },
    content: { flex: 1, paddingHorizontal: Spacing.xl },
    sectionTitle: {
        fontSize: FontSize.md,
        color: Colors.text.heading,
        fontWeight: '500',
        marginTop: Spacing.xxl,
        marginBottom: Spacing.xs,
    },
    sectionHint: {
        fontSize: FontSize.xs,
        color: Colors.text.tertiary,
        marginBottom: Spacing.lg,
        lineHeight: 18,
    },
    themeOptionsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.md,
        marginBottom: Spacing.xl,
    },
    themeOptionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.bg.elevated,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
        gap: Spacing.sm,
        minWidth: '45%',
    },
    themeOptionBtnActive: {
        borderColor: Colors.accent.gold,
        backgroundColor: Colors.bg.card,
    },
    themeColorPreview: {
        width: 16,
        height: 16,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
    },
    themeOptionText: {
        fontSize: FontSize.sm,
        color: Colors.text.secondary,
    },
    themeOptionTextActive: {
        color: Colors.accent.gold,
        fontWeight: 'bold',
    },
    card: {
        backgroundColor: Colors.bg.card,
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
        padding: Spacing.lg,
        gap: Spacing.lg,
        marginBottom: Spacing.lg,
    },
    fieldGroup: {
        gap: Spacing.xs,
    },
    label: {
        fontSize: FontSize.sm,
        color: Colors.text.secondary,
        fontWeight: '600',
    },
    input: {
        backgroundColor: Colors.bg.elevated,
        color: Colors.text.primary,
        fontSize: FontSize.md,
        padding: Spacing.md,
        borderRadius: BorderRadius.md,
        borderWidth: 0.5,
        borderColor: Colors.border.subtle,
    },
    modelLabelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    fetchBtn: {
        paddingHorizontal: Spacing.sm,
        paddingVertical: 5,
        backgroundColor: Colors.bg.elevated,
        borderRadius: BorderRadius.sm,
        minWidth: 120,
        alignItems: 'center',
        justifyContent: 'center',
    },
    fetchBtnText: {
        fontSize: FontSize.xs,
        color: Colors.accent.gold,
    },
    primaryBtn: {
        minHeight: 46,
        borderRadius: BorderRadius.md,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.accent.gold,
    },
    primaryBtnDisabled: {
        opacity: 0.5,
    },
    primaryBtnText: {
        fontSize: FontSize.md,
        color: Colors.text.inverse,
        fontWeight: '700',
    },
    backupOptionsContainer: {
        flexDirection: 'column',
        gap: Spacing.md,
        marginBottom: Spacing.xl,
    },
    backupBtn: {
        backgroundColor: Colors.bg.elevated,
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.md,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.border.subtle,
    },
    backupBtnText: {
        fontSize: FontSize.md,
        color: Colors.text.primary,
        fontWeight: '500',
    },
    restoreBtn: {
        backgroundColor: 'transparent',
    },
    restoreBtnText: {
        color: Colors.accent.gold,
    },
});
