import type { ImageSourcePropType } from 'react-native';
import type { QimenGate } from './types';

export const QIMEN_GATE_IMAGES: Record<QimenGate, ImageSourcePropType> = {
    开门: require('../../../assets/qimen/gates/kai.png'),
    休门: require('../../../assets/qimen/gates/xiu.png'),
    生门: require('../../../assets/qimen/gates/sheng.png'),
    伤门: require('../../../assets/qimen/gates/shang.png'),
    杜门: require('../../../assets/qimen/gates/du.png'),
    景门: require('../../../assets/qimen/gates/jing.png'),
    死门: require('../../../assets/qimen/gates/si.png'),
    惊门: require('../../../assets/qimen/gates/jing-alarm.png'),
};
