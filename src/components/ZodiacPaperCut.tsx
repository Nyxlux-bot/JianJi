import React from 'react';
import { Image, ImageSourcePropType, ImageStyle, StyleProp } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

export type ZodiacKey =
    | 'rat' | 'ox' | 'tiger' | 'rabbit' | 'dragon' | 'snake'
    | 'horse' | 'goat' | 'monkey' | 'rooster' | 'dog' | 'pig';

const ZODIAC_BY_CHAR: Record<string, ZodiacKey> = {
    鼠: 'rat', 牛: 'ox', 虎: 'tiger', 兔: 'rabbit', 龙: 'dragon', 蛇: 'snake',
    马: 'horse', 羊: 'goat', 猴: 'monkey', 鸡: 'rooster', 狗: 'dog', 猪: 'pig',
};

const YANG_IMAGES: Record<ZodiacKey, ImageSourcePropType> = {
    rat: require('../../assets/zodiac/yang/rat.png'),
    ox: require('../../assets/zodiac/yang/ox.png'),
    tiger: require('../../assets/zodiac/yang/tiger.png'),
    rabbit: require('../../assets/zodiac/yang/rabbit.png'),
    dragon: require('../../assets/zodiac/yang/dragon.png'),
    snake: require('../../assets/zodiac/yang/snake.png'),
    horse: require('../../assets/zodiac/yang/horse.png'),
    goat: require('../../assets/zodiac/yang/goat.png'),
    monkey: require('../../assets/zodiac/yang/monkey.png'),
    rooster: require('../../assets/zodiac/yang/rooster.png'),
    dog: require('../../assets/zodiac/yang/dog.png'),
    pig: require('../../assets/zodiac/yang/pig.png'),
};

const YIN_IMAGES: Record<ZodiacKey, ImageSourcePropType> = {
    rat: require('../../assets/zodiac/yin/rat.png'),
    ox: require('../../assets/zodiac/yin/ox.png'),
    tiger: require('../../assets/zodiac/yin/tiger.png'),
    rabbit: require('../../assets/zodiac/yin/rabbit.png'),
    dragon: require('../../assets/zodiac/yin/dragon.png'),
    snake: require('../../assets/zodiac/yin/snake.png'),
    horse: require('../../assets/zodiac/yin/horse.png'),
    goat: require('../../assets/zodiac/yin/goat.png'),
    monkey: require('../../assets/zodiac/yin/monkey.png'),
    rooster: require('../../assets/zodiac/yin/rooster.png'),
    dog: require('../../assets/zodiac/yin/dog.png'),
    pig: require('../../assets/zodiac/yin/pig.png'),
};

/**
 * 素材里朝右的生肖。剪纸放在信息区右侧，统一镜像成朝左（朝向文字），
 * 免得头部被裁在屏幕边缘。
 */
const FACES_RIGHT: Record<'yang' | 'yin', ReadonlySet<ZodiacKey>> = {
    yang: new Set<ZodiacKey>(['rat', 'ox', 'rabbit', 'goat', 'pig']),
    yin: new Set<ZodiacKey>(['rat', 'ox', 'tiger', 'rabbit', 'goat', 'monkey', 'dog', 'pig']),
};

export function resolveZodiacKey(zodiac: string | null | undefined): ZodiacKey | null {
    if (!zodiac) {
        return null;
    }
    for (const char of zodiac) {
        const key = ZODIAC_BY_CHAR[char];
        if (key) {
            return key;
        }
    }
    return null;
}

interface ZodiacPaperCutProps {
    /** 生肖字（如“马”）或 ZodiacKey */
    zodiac: string;
    size?: number;
    /** 不传时按主题取默认：阳 0.2、阴 0.3 */
    opacity?: number;
    style?: StyleProp<ImageStyle>;
}

const ZodiacPaperCut: React.FC<ZodiacPaperCutProps> = ({ zodiac, size = 180, opacity, style }) => {
    const { theme } = useTheme();
    const key = (zodiac in YANG_IMAGES ? zodiac : resolveZodiacKey(zodiac)) as ZodiacKey | null;
    if (!key) {
        return null;
    }
    const mode = theme === 'yang' ? 'yang' : 'yin';
    const source = (mode === 'yang' ? YANG_IMAGES : YIN_IMAGES)[key];
    const mirrored = FACES_RIGHT[mode].has(key);
    return (
        <Image
            source={source}
            resizeMode="contain"
            accessible={false}
            style={[
                {
                    width: size,
                    height: size,
                    opacity: opacity ?? (mode === 'yang' ? 0.2 : 0.3),
                },
                mirrored ? { transform: [{ scaleX: -1 }] } : null,
                style,
            ]}
        />
    );
};

export default ZodiacPaperCut;
