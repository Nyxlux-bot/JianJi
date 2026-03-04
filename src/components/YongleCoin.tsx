import React from 'react';
import { Image, ImageStyle, StyleProp } from 'react-native';

export type CoinFace = 'front' | 'back';

export interface YongleCoinProps {
    face: CoinFace;
    size?: number;
    themeName?: 'dark' | 'green' | 'white' | 'purple';
    style?: StyleProp<ImageStyle>;
}

export default function YongleCoin({ face, size = 100, style }: YongleCoinProps) {
    const source = face === 'front'
        ? require('../../assets/coins/yongle_front.png')
        : require('../../assets/coins/yongle_back.png');

    return (
        <Image
            source={source}
            style={[{ width: size, height: size }, style]}
            resizeMode="contain"
            fadeDuration={0}
        />
    );
}
