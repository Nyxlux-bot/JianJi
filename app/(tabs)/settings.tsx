/**
 * 设置页面
 * 配置 AI 接口地址、API Key、模型名称和六爻分析提示词
 */

import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    ScrollView, ActivityIndicator
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { CustomAlert } from '../../src/components/CustomAlertProvider';
import { exportAllRecords, getAllRecords, importRecords, type ImportConflictPolicy } from '../../src/db/database';
import StatusBarDecor from '../../src/components/StatusBarDecor';
import { Spacing, FontSize, BorderRadius } from '../../src/theme/colors';
import {
    AISettings, getSettings, saveSettings, DEFAULT_SETTINGS
} from '../../src/services/settings';
import { CURRENT_PROMPT_VERSION } from '../../src/services/default-prompts';
import { useTheme } from "../../src/theme/ThemeContext";
import { PanResult } from '../../src/core/liuyao-calc';
import { validateImportRecords } from '../../src/db/import-validation';
import ImportPreviewModal from '../../src/components/ImportPreviewModal';

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

    const incoming = rawSettings as Partial<AISettings>;
    const incomingApiKey = typeof incoming.apiKey === 'string' ? incoming.apiKey.trim() : '';
    const incomingPrompt = typeof incoming.systemPrompt === 'string'
        ? incoming.systemPrompt
        : currentSettings.systemPrompt;

    const resolvedPromptIsCustom = typeof incoming.promptIsCustom === 'boolean'
        ? incoming.promptIsCustom
        : incomingPrompt.trim() !== DEFAULT_SETTINGS.systemPrompt.trim();

    const parsedPromptVersion = typeof incoming.promptVersion === 'number' && Number.isFinite(incoming.promptVersion)
        ? incoming.promptVersion
        : currentSettings.promptVersion;

    return {
        ...currentSettings,
        apiUrl: typeof incoming.apiUrl === 'string' && incoming.apiUrl.trim().length > 0
            ? incoming.apiUrl
            : currentSettings.apiUrl,
        apiKey: incomingApiKey.length > 0 ? incoming.apiKey! : currentSettings.apiKey,
        model: typeof incoming.model === 'string' && incoming.model.trim().length > 0
            ? incoming.model
            : currentSettings.model,
        systemPrompt: incomingPrompt,
        aiSettingsUnlocked: typeof incoming.aiSettingsUnlocked === 'boolean'
            ? incoming.aiSettingsUnlocked
            : currentSettings.aiSettingsUnlocked,
        promptVersion: parsedPromptVersion > 0 ? parsedPromptVersion : CURRENT_PROMPT_VERSION,
        promptIsCustom: resolvedPromptIsCustom,
    };
}

export default function SettingsPage() {
    const { Colors, theme, setTheme } = useTheme();
    const styles = makeStyles(Colors);
    const [settings, setSettings] = useState<AISettings>(DEFAULT_SETTINGS);
    const [loading, setLoading] = useState(true);
    const [previewVisible, setPreviewVisible] = useState(false);
    const [pendingRecords, setPendingRecords] = useState<PanResult[]>([]);
    const [pendingSettingsRaw, setPendingSettingsRaw] = useState<unknown>(null);
    const [pendingDuplicateCount, setPendingDuplicateCount] = useState(0);

    useEffect(() => {
        getSettings().then(s => {
            setSettings(s);
            setLoading(false);
        });
    }, []);

    const handleBackup = async () => {
        try {
            setLoading(true);
            const records = await exportAllRecords();
            const backupData = {
                version: 1,
                timestamp: new Date().toISOString(),
                settings: buildBackupSettings(settings),
                meta: {
                    apiKeyIncluded: false,
                },
                records: records
            };
            const jsonStr = JSON.stringify(backupData, null, 2);
            const fileName = `liuyao_backup_${new Date().getTime()}.json`;
            const fileUri = `${FileSystem.documentDirectory}${fileName}`;

            await FileSystem.writeAsStringAsync(fileUri, jsonStr, { encoding: FileSystem.EncodingType.UTF8 });

            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(fileUri, {
                    mimeType: 'application/json',
                    dialogTitle: '备份易学数据',
                    UTI: 'public.json'
                });
                CustomAlert.alert('备份已导出', '为安全起见，备份文件默认不包含 API Key，恢复后请手动填写。');
            } else {
                CustomAlert.alert('提示', '当前设备不支持分享文件');
            }
        } catch (e: any) {
            CustomAlert.alert('备份失败', e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleRestore = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: 'application/json',
                copyToCacheDirectory: true,
            });

            if (result.canceled || !result.assets || result.assets.length === 0) return;

            const fileUri = result.assets[0].uri;
            const content = await FileSystem.readAsStringAsync(fileUri, { encoding: FileSystem.EncodingType.UTF8 });

            const backupData = JSON.parse(content);
            if (!Array.isArray(backupData.records)) {
                throw new Error('无效的备份文件：缺失记录数据');
            }
            const validatedRecords = validateImportRecords(backupData.records as unknown[]);
            const existingRecords = await getAllRecords();
            const existingIdSet = new Set(existingRecords.map(record => record.id));
            const duplicateCount = validatedRecords.reduce(
                (count, record) => count + (existingIdSet.has(record.id) ? 1 : 0),
                0
            );

            setPendingRecords(validatedRecords);
            setPendingSettingsRaw(backupData.settings);
            setPendingDuplicateCount(duplicateCount);
            setPreviewVisible(true);
        } catch (e: any) {
            CustomAlert.alert('恢复失败', typeof e.message === 'string' ? e.message : '文件解析错误');
        }
    };

    const handleConfirmRestore = async (payload: { selectedRecords: PanResult[]; conflictPolicy: ImportConflictPolicy }) => {
        try {
            setLoading(true);

            if (pendingSettingsRaw) {
                const normalizedSettings = normalizeImportedSettings(pendingSettingsRaw, settings);
                try {
                    await saveSettings(normalizedSettings);
                    setSettings(normalizedSettings);
                } catch (error: any) {
                    const message = typeof error?.message === 'string' ? error.message : '持久化设置失败';
                    throw new Error(`设置恢复失败：${message}`);
                }
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
                `导入完成：新增 ${stats.inserted} 条，覆盖 ${stats.updated} 条，跳过 ${stats.skipped} 条。`
            );
        } catch (e: any) {
            CustomAlert.alert('恢复失败', typeof e.message === 'string' ? e.message : '文件解析错误');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
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
                {/* 外观设置 */}
                <Text style={styles.sectionTitle}>外观设置</Text>
                <Text style={styles.sectionHint}>
                    选择应用的全局主题颜色
                </Text>
                <View style={styles.themeOptionsContainer}>
                    {[
                        { id: 'dark', name: '玄黑金', color: '#1A1C23' },
                        { id: 'green', name: '原矿绿', color: '#1F2E23' },
                        { id: 'white', name: '宣纸白', color: '#FDFBF7' },
                        { id: 'purple', name: '紫檀香', color: '#2A1B28' },
                    ].map(t => (
                        <TouchableOpacity
                            key={t.id}
                            style={[
                                styles.themeOptionBtn,
                                theme === t.id && styles.themeOptionBtnActive
                            ]}
                            onPress={() => setTheme(t.id as any)}
                        >
                            <View style={[styles.themeColorPreview, { backgroundColor: t.color }]} />
                            <Text style={[
                                styles.themeOptionText,
                                theme === t.id && styles.themeOptionTextActive
                            ]}>{t.name}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <View style={{ height: 20 }} />

                {/* 卷宗档：数据备份与恢复 */}
                <Text style={styles.sectionTitle}>卷宗备份与迁移</Text>
                <Text style={styles.sectionHint}>
                    将设置与占卜记录安全打包为本地文件并支持恢复。为保护隐私，导出备份默认不包含 API Key。
                </Text>

                <View style={styles.backupOptionsContainer}>
                    <TouchableOpacity style={styles.backupBtn} onPress={handleBackup}>
                        <Text style={styles.backupBtnText}>导出全量数据 (Backup)</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.backupBtn, styles.restoreBtn]} onPress={handleRestore}>
                        <Text style={[styles.backupBtnText, styles.restoreBtnText]}>导入外部档案 (Restore)</Text>
                    </TouchableOpacity>
                </View>

                <View style={{ height: 60 }} />
            </ScrollView>

            <ImportPreviewModal
                visible={previewVisible}
                loading={loading}
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
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    },
    backBtn: { width: 40, height: 40, justifyContent: 'center' },
    headerTitle: { fontSize: FontSize.lg, color: Colors.text.heading, fontWeight: '400' },
    saveBtn: { paddingHorizontal: Spacing.md, height: 40, justifyContent: 'center' },
    saveText: { fontSize: FontSize.md, color: Colors.accent.gold, fontWeight: '500' },
    content: { flex: 1, paddingHorizontal: Spacing.xl },
    sectionTitle: {
        fontSize: FontSize.md, color: Colors.text.heading, fontWeight: '500',
        marginTop: Spacing.xxl, marginBottom: Spacing.xs,
    },
    sectionHint: {
        fontSize: FontSize.xs, color: Colors.text.tertiary,
        marginBottom: Spacing.lg, lineHeight: 18,
    },
    themeOptionsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginBottom: Spacing.xl },
    themeOptionBtn: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bg.elevated,
        paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md,
        borderWidth: 1, borderColor: Colors.border.subtle, gap: Spacing.sm, minWidth: '45%'
    },
    themeOptionBtnActive: { borderColor: Colors.accent.gold, backgroundColor: Colors.bg.card },
    themeColorPreview: { width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: Colors.border.subtle },
    themeOptionText: { fontSize: FontSize.sm, color: Colors.text.secondary },
    themeOptionTextActive: { color: Colors.accent.gold, fontWeight: 'bold' },
    backupOptionsContainer: { flexDirection: 'column', gap: Spacing.md, marginBottom: Spacing.xl },
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
