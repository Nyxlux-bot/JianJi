import React from 'react';
import { Image, ImageSourcePropType, ImageStyle, StyleProp } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { resolveWuXingElement, WuXingElement } from '../features/bazi/wuxing';

/**
 * 五行剪纸图标（assets/wuxing/ui，已裁去留白，96px）。
 * 传统五色里“金白”“水黑”会分别在宣纸底、暗底上隐没，因此：
 * - 阳（浅色）主题的金换成银白描边版 metal-yang；
 * - 阴（深色）主题的水换成提亮描边版 water-yin。
 */
const BASE_ICONS: Record<WuXingElement, ImageSourcePropType> = {
    木: require('../../assets/wuxing/ui/wood.png'),
    火: require('../../assets/wuxing/ui/fire.png'),
    土: require('../../assets/wuxing/ui/earth.png'),
    金: require('../../assets/wuxing/ui/metal.png'),
    水: require('../../assets/wuxing/ui/water.png'),
};

const YANG_ICONS: Partial<Record<WuXingElement, ImageSourcePropType>> = {
    金: require('../../assets/wuxing/ui/metal-yang.png'),
};

const YIN_ICONS: Partial<Record<WuXingElement, ImageSourcePropType>> = {
    水: require('../../assets/wuxing/ui/water-yin.png'),
};

interface WuXingIconProps {
    /** 五行字，或任意含天干地支的文本（取第一个能识别的五行） */
    element: string;
    size?: number;
    style?: StyleProp<ImageStyle>;
}

const WuXingIcon: React.FC<WuXingIconProps> = ({ element, size = 14, style }) => {
    const { theme } = useTheme();
    const resolved = resolveWuXingElement(element);
    if (!resolved) {
        return null;
    }
    const overrides = theme === 'yang' ? YANG_ICONS : YIN_ICONS;
    const source = overrides[resolved] ?? BASE_ICONS[resolved];
    return (
        <Image
            source={source}
            style={[{ width: size, height: size }, style]}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
            accessible={false}
        />
    );
};

export default WuXingIcon;
