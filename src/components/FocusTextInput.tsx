/**
 * 输入框的统一边框：静止时用 border.input（与背景对比 ≥ 3:1，看得出能输入），
 * 聚焦时换成金色，出错时换成朱红。
 * - FocusTextInput：边框画在输入框自己身上时，直接替换 TextInput；
 * - useFieldFocus：边框画在外层容器上时（搜索条、带图标的输入行），把 borderColor 给容器。
 */
import React, { forwardRef, useCallback, useState } from 'react';
import { TextInput, type TextInputFocusEvent, type TextInputProps } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

type FocusEvent = TextInputFocusEvent;

export function useFieldFocus(options: {
    invalid?: boolean;
    onFocus?: (event: FocusEvent) => void;
    onBlur?: (event: FocusEvent) => void;
} = {}) {
    const { Colors } = useTheme();
    const [focused, setFocused] = useState(false);
    const { invalid = false, onFocus, onBlur } = options;
    const handleFocus = useCallback((event: FocusEvent) => {
        setFocused(true);
        onFocus?.(event);
    }, [onFocus]);
    const handleBlur = useCallback((event: FocusEvent) => {
        setFocused(false);
        onBlur?.(event);
    }, [onBlur]);
    let borderColor: string = Colors.border.input;
    if (invalid) {
        borderColor = Colors.accent.red;
    } else if (focused) {
        borderColor = Colors.accent.gold;
    }
    return { focused, borderColor, onFocus: handleFocus, onBlur: handleBlur };
}

type FocusTextInputProps = TextInputProps & {
    /** 内容不合规时显示朱红边框 */
    invalid?: boolean;
};

const FocusTextInput = forwardRef<React.ElementRef<typeof TextInput>, FocusTextInputProps>(function FocusTextInput(
    { style, invalid, onFocus, onBlur, placeholderTextColor, ...rest },
    ref,
) {
    const { Colors } = useTheme();
    const field = useFieldFocus({ invalid, onFocus, onBlur });
    return (
        <TextInput
            ref={ref}
            {...rest}
            placeholderTextColor={placeholderTextColor ?? Colors.text.tertiary}
            style={[style, { borderColor: field.borderColor }]}
            onFocus={field.onFocus}
            onBlur={field.onBlur}
        />
    );
});

export default FocusTextInput;
