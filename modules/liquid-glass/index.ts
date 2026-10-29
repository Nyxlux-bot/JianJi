/**
 * Android 液态玻璃：GlassTarget 包住要被折射的内容，GlassView 放在它外面、叠在上面，实时折射底下那一块。
 * 只有装了开发包的 Android 13+ 有效；Expo Go、iOS、网页、旧 Android 上 GlassTarget 是普通 View，GlassView 什么都不画。
 */
import type React from 'react';
import { View, type ViewProps } from 'react-native';
import { requireNativeView, requireOptionalNativeModule } from 'expo';

const native = requireOptionalNativeModule<{ supported: boolean }>('LiquidGlass');

export const liquidGlassSupported = !!native?.supported;

export type GlassTargetProps = ViewProps & { targetId: string };

export type GlassViewProps = ViewProps & {
    targetId: string;
    /** 以下尺寸都是 dp */
    cornerRadius: number;
    /** 边缘最多把底图挪多远 */
    refraction: number;
    /** 边缘折射那一圈有多宽 */
    bevel: number;
    /** 整块往中心取像的比例，0 为不放大 */
    magnify?: number;
    /** 绿、蓝两路比红多挪的比例 */
    dispersion?: number;
    blurRadius?: number;
};

export const GlassTarget: React.ComponentType<GlassTargetProps> = native ? requireNativeView('LiquidGlass', 'GlassTarget') : View;

export const GlassView: React.ComponentType<GlassViewProps> = liquidGlassSupported ? requireNativeView('LiquidGlass', 'GlassView') : () => null;
