import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TouchableWithoutFeedback, Modal, DeviceEventEmitter } from 'react-native';
import { Spacing, FontSize, BorderRadius } from '../theme/colors';
import { useTheme } from "../theme/ThemeContext";

export interface AlertButton {
    text: string;
    onPress?: () => void;
    style?: 'cancel' | 'destructive' | 'default';
}

export interface AlertOptions {
    title: string;
    message?: string;
    buttons?: AlertButton[];
}

export const CustomAlert = {
    alert: (title: string, message?: string, buttons?: AlertButton[]) => {
        DeviceEventEmitter.emit('SHOW_CUSTOM_ALERT', { title, message, buttons });
    }
};

export default function CustomAlertProvider() {
    const { Colors } = useTheme();
    const styles = makeStyles(Colors);
    const [visible, setVisible] = useState(false);
    const [config, setConfig] = useState<AlertOptions | null>(null);

    useEffect(() => {
        const sub = DeviceEventEmitter.addListener('SHOW_CUSTOM_ALERT', (opt: AlertOptions) => {
            setConfig(opt);
            setVisible(true);
        });
        return () => sub.remove();
    }, []);

    if (!visible || !config) return null;

    const handleClose = () => {
        setVisible(false);
    };

    const buttons = config.buttons && config.buttons.length > 0 ? config.buttons : [{ text: '确定', onPress: handleClose }];

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={handleClose}
        >
            <TouchableWithoutFeedback onPress={handleClose}>
                <View style={styles.overlay}>
                    <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
                        <View style={styles.modalContent}>
                            <Text style={styles.title}>{config.title}</Text>
                            {!!config.message && <Text style={styles.message}>{config.message}</Text>}

                            <View style={styles.buttonContainer}>
                                {buttons.map((btn, index) => {
                                    const isCancel = btn.style === 'cancel';
                                    const isDestructive = btn.style === 'destructive';
                                    return (
                                        <TouchableOpacity
                                            key={index}
                                            style={[
                                                styles.button,
                                                isCancel ? styles.cancelButton : (isDestructive ? styles.destructiveButton : styles.confirmButton),
                                                { marginLeft: index > 0 ? Spacing.md : 0 }
                                            ]}
                                            onPress={() => {
                                                handleClose();
                                                setTimeout(() => {
                                                    btn.onPress && btn.onPress();
                                                }, 100);
                                            }}
                                            activeOpacity={0.7}
                                        >
                                            <Text style={[
                                                isCancel ? styles.cancelButtonText : styles.confirmButtonText
                                            ]}>{btn.text}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
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
        flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.6)', justifyContent: 'center', alignItems: 'center', padding: Spacing.xl,
    },
    modalContent: {
        width: '100%', maxWidth: 340, backgroundColor: Colors.bg.card, borderRadius: BorderRadius.lg, padding: Spacing.xl,
        borderWidth: 1, borderColor: Colors.border.subtle, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 10,
    },
    title: {
        fontSize: FontSize.lg, fontWeight: 'bold', color: Colors.text.heading, marginBottom: Spacing.md, textAlign: 'center',
    },
    message: {
        fontSize: FontSize.md, color: Colors.text.secondary, textAlign: 'center', marginBottom: Spacing.xl, lineHeight: 22,
    },
    buttonContainer: {
        flexDirection: 'row', justifyContent: 'space-between',
    },
    button: {
        flex: 1, paddingVertical: Spacing.md, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center',
    },
    cancelButton: {
        backgroundColor: Colors.bg.elevated, borderWidth: 1, borderColor: Colors.border.subtle,
    },
    confirmButton: {
        backgroundColor: Colors.accent.jade,
    },
    destructiveButton: {
        backgroundColor: Colors.accent.red,
    },
    cancelButtonText: {
        fontSize: FontSize.md, color: Colors.text.secondary, fontWeight: '500',
    },
    confirmButtonText: {
        fontSize: FontSize.md, color: '#fff', fontWeight: '500',
    },
});
