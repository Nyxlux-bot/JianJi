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
import { exportAllRecords, importRecords, type ImportMode } from '../../src/db/database';
import StatusBarDecor from '../../src/components/StatusBarDecor';
import { router } from 'expo-router';
import { Spacing, FontSize, BorderRadius } from '../../src/theme/colors';
import { BackIcon } from '../../src/components/Icons';
import {
    AISettings, getSettings, saveSettings, DEFAULT_SETTINGS
} from '../../src/services/settings';
import { CURRENT_PROMPT_VERSION } from '../../src/services/default-prompts';
import { useTheme } from "../../src/theme/ThemeContext";

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
        const performRestore = async (backupData: any, mode: ImportMode) => {
            try {
                setLoading(true);

                if (backupData.settings) {
                    const normalizedSettings = normalizeImportedSettings(backupData.settings, settings);
                    try {
                        await saveSettings(normalizedSettings);
                        setSettings(normalizedSettings);
                    } catch (error: any) {
                        const message = typeof error?.message === 'string' ? error.message : '持久化设置失败';
                        throw new Error(`设置恢复失败：${message}`);
                    }
                }

                await importRecords(backupData.records, { mode });

                const modeText = mode === 'replace' ? '覆盖恢复' : '合并恢复';
                CustomAlert.alert('恢复成功', `${modeText}完成，成功恢复 ${backupData.records.length || 0} 条占卜记录。`, [
                    { text: '确定', onPress: () => router.back() }
                ]);
            } catch (e: any) {
                CustomAlert.alert('恢复失败', typeof e.message === 'string' ? e.message : '文件解析错误');
            } finally {
                setLoading(false);
            }
        };

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

            const promptReplaceRestore = () => {
                CustomAlert.alert('确认覆盖恢复', '覆盖恢复会先清空本地全部记录，再导入备份内容。确定继续吗？', [
                    { text: '取消', style: 'cancel' },
                    { text: '确认覆盖', style: 'destructive', onPress: () => performRestore(backupData, 'replace') },
                ]);
            };

            CustomAlert.alert('选择恢复方式', '请选择导入策略（默认推荐：合并恢复）', [
                { text: '合并恢复', onPress: () => performRestore(backupData, 'merge') },
                { text: '覆盖恢复', style: 'destructive', onPress: promptReplaceRestore },
                { text: '取消', style: 'cancel' },
            ]);
        } catch (e: any) {
            CustomAlert.alert('恢复失败', typeof e.message === 'string' ? e.message : '文件解析错误');
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
