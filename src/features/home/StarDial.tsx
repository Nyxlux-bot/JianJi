import React from 'react';
import Svg, { Circle, G, Path, Text as SvgText } from 'react-native-svg';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { ringLevel } from '../../components/YunZhuanBanners';

const R = 260;
const MANSIONS = '角亢氐房心尾箕斗牛女虚危室壁奎娄胃昴毕觜参井鬼柳星张翼轸';

function rays(r1: number, r2: number, count: number, longEvery = 0, r3 = r2, offset = 0) {
    let d = '';
    for (let k = 0; k < count; k++) {
        const a = (k * 360 / count + offset) * Math.PI / 180;
        const end = longEvery && k % longEvery === 0 ? r3 : r2;
        d += `M${(Math.cos(a) * r1).toFixed(1)} ${(Math.sin(a) * r1).toFixed(1)}L${(Math.cos(a) * end).toFixed(1)} ${(Math.sin(a) * end).toFixed(1)}`;
    }
    return d;
}

const TICKS = rays(254, 246, 112, 4, 236);
const SPOKES = rays(120, 176, 12, 0, 176, 15);
const BAND = 'M256 0A256 256 0 1 0 -256 0A256 256 0 1 0 256 0ZM214 0A214 214 0 1 0 -214 0A214 214 0 1 0 214 0Z';
// 宿名字头朝圆心，斜放后靠近人的那一半是正的
const LABELS = Array.from(MANSIONS, (name, k) => {
    const a = -90 + k * 360 / MANSIONS.length;
    const x = Math.cos(a * Math.PI / 180) * 225;
    const y = Math.sin(a * Math.PI / 180) * 225;
    return { name, x: x.toFixed(1), y: y.toFixed(1), rotate: `rotate(${(a - 90).toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})` };
});

/** 卡组底下斜放的二十八宿星盘：只在转卡时浮现，随卡组同向转 */
export default function StarDial({ rotation, centerY, color, peak }: {
    rotation: SharedValue<number>;
    centerY: number;
    color: string;
    peak: number;
}) {
    // 只随卡组转：星盘平时不可见，常驻的慢速自转只会让它每帧白白提交一次
    const motion = useAnimatedStyle(() => ({
        opacity: ringLevel.value * peak,
        transform: [
            { perspective: 700 },
            { rotateX: '62deg' },
            { rotateZ: `${rotation.value * 24}deg` },
            { scale: 0.94 + ringLevel.value * 0.06 },
        ],
    }));

    return (
        <Animated.View
            pointerEvents="none"
            shouldRasterizeIOS
            // 安卓不再套硬件层：react-native-svg 已经把整盘画成一张位图，再套一层就多一张 1560px 见方的贴图，
            // 首页贴图因此超过系统缓存上限，转卡时每帧重传
            aria-hidden
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[{ position: 'absolute', left: '50%', marginLeft: -R, top: centerY - R, width: R * 2, height: R * 2 }, motion]}
        >
            <Svg width={R * 2} height={R * 2} viewBox={`${-R} ${-R} ${R * 2} ${R * 2}`}>
                <Path d={BAND} fill={color} fillOpacity={0.12} fillRule="evenodd" />
                <Circle r={258} fill="none" stroke={color} strokeWidth={1.6} />
                <Circle r={214} fill="none" stroke={color} strokeWidth={1.2} />
                <Circle r={176} fill="none" stroke={color} strokeWidth={0.9} strokeDasharray="3 6" />
                <Circle r={120} fill="none" stroke={color} strokeWidth={0.9} />
                <Path d={TICKS} stroke={color} strokeWidth={1.1} fill="none" />
                <Path d={SPOKES} stroke={color} strokeWidth={0.9} fill="none" />
                <G fill={color}>
                    {LABELS.map(label => (
                        <SvgText key={label.name} x={label.x} y={label.y} transform={label.rotate} fontSize={15} fontWeight="600" textAnchor="middle" alignmentBaseline="central">
                            {label.name}
                        </SvgText>
                    ))}
                </G>
            </Svg>
        </Animated.View>
    );
}
