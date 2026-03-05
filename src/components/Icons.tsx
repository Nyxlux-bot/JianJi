import React from 'react';
import Svg, { Path, Circle, Rect, Line, G } from 'react-native-svg';
import { useTheme } from "../theme/ThemeContext";

interface IconProps {
    size?: number;
    color?: string;
}

export const SparklesIcon: React.FC<IconProps> = ({ size = 24, color }) => {
    const { Colors } = useTheme();
    const c = color || Colors.accent.gold;
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Path stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
        </Svg>
    );
};

export const CompassIcon: React.FC<IconProps> = ({ size = 24, color }) => {
    const { Colors } = useTheme();
    const c = color || Colors.accent.gold;
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Path stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                d="M12 21a9 9 0 100-18 9 9 0 000 18z" />
            <Path stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                d="M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z" />
        </Svg>
    );
};

export const ClockIcon: React.FC<IconProps> = ({ size = 24, color }) => {
    const { Colors } = useTheme();
    const c = color || Colors.accent.gold;
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Circle cx="12" cy="12" r="10" stroke={c} strokeWidth="1.5" />
            <Path d="M12 6 L12 12 L16 14" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <Circle cx="12" cy="12" r="1" fill={c} />
        </Svg>
    );
};

export const CoinIcon: React.FC<IconProps> = ({ size = 24, color }) => {
    const { Colors } = useTheme();
    const c = color || Colors.accent.gold;
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Circle cx="12" cy="12" r="9" stroke={c} strokeWidth="1.5" />
            <Circle cx="12" cy="12" r="3" stroke={c} strokeWidth="1" />
            <Path d="M12 3 L12 5" stroke={c} strokeWidth="1" strokeLinecap="round" />
            <Path d="M12 19 L12 21" stroke={c} strokeWidth="1" strokeLinecap="round" />
            <Path d="M3 12 L5 12" stroke={c} strokeWidth="1" strokeLinecap="round" />
            <Path d="M19 12 L21 12" stroke={c} strokeWidth="1" strokeLinecap="round" />
        </Svg>
    );
};

export const NumberIcon: React.FC<IconProps> = ({ size = 24, color }) => {
    const { Colors } = useTheme();
    const c = color || Colors.accent.gold;
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Rect x="3" y="3" width="18" height="18" rx="3" stroke={c} strokeWidth="1.5" />
            <Path d="M8 8 L8 16" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
            <Path d="M12 8 L12 16" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
            <Path d="M16 8 L16 16" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
            <Circle cx="8" cy="10" r="1.5" fill={c} />
            <Circle cx="12" cy="13" r="1.5" fill={c} />
            <Circle cx="16" cy="11" r="1.5" fill={c} />
        </Svg>
    );
};

export const HandIcon: React.FC<IconProps> = ({ size = 24, color }) => {
    const { Colors } = useTheme();
    const c = color || Colors.accent.gold;
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Path
                d="M10.05 4.575a1.575 1.575 0 10-3.15 0v3m3.15-3v-1.5a1.575 1.575 0 013.15 0v1.5m-3.15 0l.075 5.925m3.075.75V4.575m0 0a1.575 1.575 0 013.15 0V15M6.9 7.575a1.575 1.575 0 10-3.15 0v8.175a6.75 6.75 0 006.75 6.75h2.018a5.25 5.25 0 003.712-1.538l1.732-1.732a5.25 5.25 0 001.538-3.712l.003-2.024a.668.668 0 01.198-.471 1.575 1.575 0 10-2.228-2.228 3.818 3.818 0 00-1.12 2.687M6.9 7.575V12m6.27 4.318A4.49 4.49 0 0116.35 15m.002 0h-.002"
                stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            />
        </Svg>
    );
};

export const BackIcon: React.FC<IconProps> = ({ size = 24, color }) => {
    const { Colors } = useTheme();
    const c = color || Colors.text.primary;
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Path d="M15 19l-7-7 7-7" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
    );
};

export const CloseIcon: React.FC<IconProps> = ({ size = 24, color }) => {
    const { Colors } = useTheme();
    const c = color || Colors.text.primary;
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Path d="M18 6L6 18" stroke={c} strokeWidth="2" strokeLinecap="round" />
            <Path d="M6 6l12 12" stroke={c} strokeWidth="2" strokeLinecap="round" />
        </Svg>
    );
};

export const HistoryIcon: React.FC<IconProps> = ({ size = 24, color }) => {
    const { Colors } = useTheme();
    const c = color || Colors.text.primary;
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M3 3v5h5" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M12 7v5l4 2" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
    );
};

export const TrashIcon: React.FC<IconProps> = ({ size = 24, color }) => {
    const { Colors } = useTheme();
    const c = color || Colors.accent.red;
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Path d="M3 6h18" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
            <Path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
            <Path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
            <Line x1="10" y1="11" x2="10" y2="17" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
            <Line x1="14" y1="11" x2="14" y2="17" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
        </Svg>
    );
};

export const StarIcon: React.FC<IconProps & { filled?: boolean }> = ({ size = 24, color, filled = false }) => {
    const { Colors } = useTheme();
    const c = color || Colors.accent.gold;
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? c : 'none'}>
            <Path
                d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            />
        </Svg>
    );
};

export const ChevronDownIcon: React.FC<IconProps> = ({ size = 24, color }) => {
    const { Colors } = useTheme();
    const c = color || Colors.text.secondary;
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Path d="M6 9l6 6 6-6" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
    );
};

export const ChevronRightIcon: React.FC<IconProps> = ({ size = 16, color }) => {
    const { Colors } = useTheme();
    const c = color || Colors.text.secondary;
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Path d="M9 6l6 6-6 6" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
    );
};

export const BaGuaIcon: React.FC<IconProps> = ({ size = 48, color }) => {
    const { Colors } = useTheme();
    const c = color || Colors.accent.gold;
    return (
        <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
            <Circle cx="24" cy="24" r="22" stroke={c} strokeWidth="1.5" />
            <Path
                d="M24 2 A22 22 0 0 1 24 46 A11 11 0 0 1 24 24 A11 11 0 0 0 24 2"
                fill={c} fillOpacity="0.15"
            />
            <Path
                d="M24 2 A22 22 0 0 1 24 46 A11 11 0 0 1 24 24 A11 11 0 0 0 24 2"
                stroke={c} strokeWidth="1"
            />
            <Circle cx="24" cy="13" r="3" fill={c} />
            <Circle cx="24" cy="35" r="3" stroke={c} strokeWidth="1.5" />
        </Svg>
    );
};

export const ShareIcon: React.FC<IconProps> = ({ size = 24, color }) => {
    const { Colors } = useTheme();
    const c = color || Colors.text.primary;
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Circle cx="18" cy="5" r="3" stroke={c} strokeWidth="1.5" />
            <Circle cx="6" cy="12" r="3" stroke={c} strokeWidth="1.5" />
            <Circle cx="18" cy="19" r="3" stroke={c} strokeWidth="1.5" />
            <Path d="M8.59 13.51l6.83 3.98" stroke={c} strokeWidth="1.5" />
            <Path d="M15.41 6.51l-6.82 3.98" stroke={c} strokeWidth="1.5" />
        </Svg>
    );
};

export const SettingsIcon: React.FC<IconProps> = ({ size = 24, color }) => {
    const { Colors } = useTheme();
    const c = color || Colors.text.primary;
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Circle cx="12" cy="12" r="3" stroke={c} strokeWidth="1.5" />
            <Path
                d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
                stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            />
        </Svg>
    );
};

export const AIIcon: React.FC<IconProps> = ({ size = 24, color }) => {
    const { Colors } = useTheme();
    const c = color || Colors.accent.jade;
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Path
                d="M12 2a4 4 0 0 1 4 4v1a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z"
                stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            />
            <Path d="M6 10v2a6 6 0 0 0 12 0v-2" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
            <Path d="M12 18v4" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
            <Path d="M8 22h8" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
            <Circle cx="10" cy="6" r="0.5" fill={c} />
            <Circle cx="14" cy="6" r="0.5" fill={c} />
            <Path d="M4 8h-2" stroke={c} strokeWidth="1" strokeLinecap="round" />
            <Path d="M22 8h-2" stroke={c} strokeWidth="1" strokeLinecap="round" />
            <Path d="M4 14h-1" stroke={c} strokeWidth="1" strokeLinecap="round" />
            <Path d="M21 14h-1" stroke={c} strokeWidth="1" strokeLinecap="round" />
        </Svg>
    );
};

export const LocationIcon: React.FC<IconProps> = ({ size = 24, color }) => {
    const { Colors } = useTheme();
    const c = color || Colors.accent.red;
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Path
                d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"
                stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            />
            <Circle cx="12" cy="10" r="3" stroke={c} strokeWidth="1.5" />
        </Svg>
    );
};

export const HomeIcon: React.FC<IconProps> = ({ size = 24, color }) => {
    const { Colors } = useTheme();
    const c = color || Colors.text.primary;
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M9 22V12h6v10" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
    );
};

export const ReadIcon: React.FC<IconProps> = ({ size = 24, color }) => {
    const { Colors } = useTheme();
    const c = color || Colors.text.primary;
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
    );
};

export const SendIcon: React.FC<IconProps> = ({ size = 24, color }) => {
    const { Colors } = useTheme();
    const c = color || Colors.text.primary;
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Path d="M22 2L11 13" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M22 2L15 22L11 13L2 9L22 2Z" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
    );
};

export const MoreVerticalIcon: React.FC<IconProps> = ({ size = 24, color }) => {
    const { Colors } = useTheme();
    const c = color || Colors.text.primary;
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Circle cx="12" cy="5" r="1.8" fill={c} />
            <Circle cx="12" cy="12" r="1.8" fill={c} />
            <Circle cx="12" cy="19" r="1.8" fill={c} />
        </Svg>
    );
};

export const GuaArrowIcon: React.FC<IconProps> = ({ size = 20, color }) => {
    const { Colors } = useTheme();
    const c = color || Colors.accent.gold;
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Path
                d="M4 12h13"
                stroke={c}
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <Path
                d="M13 7l6 5-6 5"
                stroke={c}
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <Circle cx="4" cy="12" r="1.2" fill={c} />
        </Svg>
    );
};
