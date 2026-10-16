import React from 'react';
import { Image, ImageSourcePropType, ImageStyle, StyleProp } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import type { LiuShen } from '../core/liuyao-data';

/**
 * 六神剪纸图标（assets/liushen/ui，已裁去留白，96px）。
 * 玄武墨色在暗底、白虎象牙白在宣纸底会隐没，因此：
 * - 阳（浅色）主题的白虎换成银灰描边版 baihu-yang；
 * - 阴（深色）主题的玄武换成提亮描边版 xuanwu-yin。
 */
const BASE_ICONS: Record<LiuShen, ImageSourcePropType> = {
    青龙: require('../../assets/liushen/ui/qinglong.png'),
    朱雀: require('../../assets/liushen/ui/zhuque.png'),
    勾陈: require('../../assets/liushen/ui/gouchen.png'),
    螣蛇: require('../../assets/liushen/ui/tengshe.png'),
    白虎: require('../../assets/liushen/ui/baihu.png'),
    玄武: require('../../assets/liushen/ui/xuanwu.png'),
};

const YANG_ICONS: Partial<Record<LiuShen, ImageSourcePropType>> = {
    白虎: require('../../assets/liushen/ui/baihu-yang.png'),
};

const YIN_ICONS: Partial<Record<LiuShen, ImageSourcePropType>> = {
    玄武: require('../../assets/liushen/ui/xuanwu-yin.png'),
};

interface LiuShenIconProps {
    liuShen: LiuShen;
    size?: number;
    style?: StyleProp<ImageStyle>;
}

const LiuShenIcon: React.FC<LiuShenIconProps> = ({ liuShen, size = 16, style }) => {
    const { theme } = useTheme();
    const overrides = theme === 'yang' ? YANG_ICONS : YIN_ICONS;
    const source = overrides[liuShen] ?? BASE_ICONS[liuShen];
    if (!source) {
        return null;
    }
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

export default LiuShenIcon;
