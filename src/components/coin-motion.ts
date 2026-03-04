import { YaoValue } from '../core/liuyao-data';

export type CoinFace = 'front' | 'back';

export interface CoinAngles {
    x: number;
    y: number;
    z: number;
}

export function mapTossToYaoValue(tossRes: boolean[]): YaoValue {
    if (tossRes.length !== 3) {
        throw new Error('三枚硬币结果长度必须为 3');
    }

    const sum = tossRes.reduce((acc, isFront) => acc + (isFront ? 2 : 3), 0);
    if (sum !== 6 && sum !== 7 && sum !== 8 && sum !== 9) {
        throw new Error(`非法硬币和: ${sum}`);
    }

    return sum as YaoValue;
}

export function getFaceFromToss(isFront: boolean): CoinFace {
    return isFront ? 'front' : 'back';
}
