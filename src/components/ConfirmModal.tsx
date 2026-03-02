import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, TouchableWithoutFeedback } from 'react-native';
import { Spacing, FontSize, BorderRadius } from '../theme/colors';
import { useTheme } from "../theme/ThemeContext";

interface ConfirmModalProps {
    visible: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel: () => void;
    destructive?: boolean; // 确认按钮是否为警告色
}

export default function ConfirmModal({
    visible,
    title,
    message,
    confirmText = '确定',
    cancelText = '取消',
    onConfirm,
    onCancel,
    destructive = false,
}: ConfirmModalProps) {
    const { Colors } = useTheme();
        const styles = makeStyles(Colors);
    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={onCancel}
        >
            <TouchableWithoutFeedback onPress={onCancel}>
                <View style={styles.overlay}>
                    <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
                        <View style={styles.modalContent}>
                            <Text style={styles.title}>{title}</Text>
                            <Text style={styles.message}>{message}</Text>

                            <View style={styles.buttonContainer}>
                                <TouchableOpacity
                                    style={[styles.button, styles.cancelButton]}
                                    onPress={onCancel}
                                    activeOpacity={0.7}
                                >
                                    <Text style={styles.cancelButtonText}>{cancelText}</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.button, destructive ? styles.destructiveButton : styles.confirmButton]}
                                    onPress={onConfirm}
                                    activeOpacity={0.7}
                                >
                                    <Text style={styles.confirmButtonText}>{confirmText}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
}

const makeStyles = (Colors: any) => StyleSheet.create({
        overlay: {
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: Spacing.xl,
        },
        modalContent: {
            width: '100%',
            maxWidth: 340,
            backgroundColor: Colors.bg.card,
            borderRadius: BorderRadius.lg,
            padding: Spacing.xl,
            shadowColor: '#000',
            shadowOffset: {
                width: 0,
                height: 4,
            },
            shadowOpacity: 0.3,
            shadowRadius: 10,
            elevation: 10,
            borderWidth: 1,
            borderColor: Colors.border.subtle,
        },
        title: {
            fontSize: FontSize.lg,
            fontWeight: 'bold',
            color: Colors.text.heading,
            marginBottom: Spacing.md,
            textAlign: 'center',
        },
        message: {
            fontSize: FontSize.md,
            color: Colors.text.secondary,
            textAlign: 'center',
            marginBottom: Spacing.xl,
            lineHeight: 22,
        },
        buttonContainer: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            gap: Spacing.md,
        },
        button: {
            flex: 1,
            paddingVertical: Spacing.md,
            borderRadius: BorderRadius.md,
            alignItems: 'center',
            justifyContent: 'center',
        },
        cancelButton: {
            backgroundColor: Colors.bg.elevated,
            borderWidth: 1,
            borderColor: Colors.border.subtle,
        },
        confirmButton: {
            backgroundColor: Colors.accent.jade,
        },
        destructiveButton: {
            backgroundColor: Colors.accent.red,
        },
        cancelButtonText: {
            fontSize: FontSize.md,
            color: Colors.text.secondary,
            fontWeight: '500',
        },
        confirmButtonText: {
            fontSize: FontSize.md,
            color: '#fff',
            fontWeight: '500',
        },
    });
