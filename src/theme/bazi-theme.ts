export interface ThemeBaseTokens {
    bg: {
        primary: string;
        secondary: string;
        card: string;
        elevated: string;
        input: string;
        overlay: string;
    };
    text: {
        primary: string;
        secondary: string;
        tertiary: string;
        inverse: string;
        heading: string;
    };
    accent: {
        gold: string;
        goldLight: string;
        goldDark: string;
        red: string;
        redLight: string;
        jade: string;
        jadeDark: string;
    };
    border: {
        subtle: string;
        normal: string;
        accent: string;
    };
}

export interface BaziThemeTokens {
    pageBg: string;
    surfacePrimary: string;
    surfaceRaised: string;
    surfaceMuted: string;
    divider: string;
    selectedBg: string;
    selectedBorder: string;
    selectedText: string;
    elementWood: string;
    elementFire: string;
    elementEarth: string;
    elementMetal: string;
    elementWater: string;
    elementWoodBg: string;
    elementFireBg: string;
    elementEarthBg: string;
    elementMetalBg: string;
    elementWaterBg: string;
    statePositive: string;
    stateNegative: string;
    stateNeutral: string;
    chromeBg: string;
    chromeBorder: string;
    chromeText: string;
    chromeTextActive: string;
    heroBg: string;
    heroBorder: string;
    heroTitle: string;
    heroMeta: string;
    heroText: string;
    actionBg: string;
    actionBorder: string;
    actionBgActive: string;
    infoBandBg: string;
    infoBandBorder: string;
    infoBandText: string;
    infoBandMuted: string;
    trackActiveBg: string;
    trackActiveBorder: string;
    trackActiveText: string;
    warningBg: string;
    warningBorder: string;
    warningText: string;
}

interface BuildBaziThemeOptions {
    brandColor?: string;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
    const normalized = hex.replace('#', '');
    const raw = normalized.length === 3
        ? normalized.split('').map((item) => `${item}${item}`).join('')
        : normalized;

    return {
        r: parseInt(raw.slice(0, 2), 16),
        g: parseInt(raw.slice(2, 4), 16),
        b: parseInt(raw.slice(4, 6), 16),
    };
}

function rgbToHex(input: { r: number; g: number; b: number }): string {
    return `#${[input.r, input.g, input.b]
        .map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0'))
        .join('')}`;
}

function mixHex(base: string, accent: string, accentWeight: number): string {
    const safeWeight = Math.max(0, Math.min(1, accentWeight));
    const baseRgb = hexToRgb(base);
    const accentRgb = hexToRgb(accent);

    return rgbToHex({
        r: baseRgb.r * (1 - safeWeight) + accentRgb.r * safeWeight,
        g: baseRgb.g * (1 - safeWeight) + accentRgb.g * safeWeight,
        b: baseRgb.b * (1 - safeWeight) + accentRgb.b * safeWeight,
    });
}

function toRgba(hex: string, alpha: number): string {
    const rgb = hexToRgb(hex);
    return `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`;
}

function getLuminance(hex: string): number {
    const { r, g, b } = hexToRgb(hex);
    const channel = (value: number): number => {
        const normalized = value / 255;
        return normalized <= 0.03928
            ? normalized / 12.92
            : ((normalized + 0.055) / 1.055) ** 2.4;
    };

    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function pickReadableText(background: string, lightText: string, darkText: string): string {
    return getLuminance(background) > 0.42 ? darkText : lightText;
}

export function buildBaziThemeTokens(
    baseTheme: ThemeBaseTokens,
    options: BuildBaziThemeOptions = {},
): BaziThemeTokens {
    const brand = options.brandColor ?? baseTheme.accent.gold;
    const chromeBg = mixHex(baseTheme.bg.primary, brand, 0.08);
    const chromeBorder = mixHex(baseTheme.border.subtle, brand, 0.32);
    const chromeText = mixHex(baseTheme.text.tertiary, brand, 0.18);
    const chromeTextActive = mixHex(baseTheme.text.heading, brand, 0.58);
    const heroBg = mixHex(baseTheme.bg.card, brand, 0.14);
    const heroBorder = mixHex(baseTheme.border.normal, brand, 0.34);
    const heroTitle = mixHex(baseTheme.text.heading, brand, 0.44);
    const heroMeta = mixHex(baseTheme.text.secondary, brand, 0.26);
    const heroText = mixHex(baseTheme.text.primary, brand, 0.18);
    const infoBandBg = mixHex(baseTheme.bg.elevated, brand, 0.58);
    const infoBandText = pickReadableText(infoBandBg, baseTheme.text.heading, baseTheme.text.inverse);
    const trackActiveBg = mixHex(baseTheme.bg.elevated, brand, 0.24);
    const trackActiveText = mixHex(baseTheme.text.heading, brand, 0.52);
    const isLight = getLuminance(baseTheme.bg.primary) > 0.42;
    const elementWood = isLight ? '#2F8A4C' : '#58B96C';
    const elementFire = isLight ? '#C64531' : '#E9664F';
    const elementEarth = isLight ? '#8B6B43' : '#B18A58';
    const elementMetal = isLight ? '#B97908' : '#DCA32C';
    const elementWater = isLight ? '#2D6FC4' : '#4C8DE8';
    const elementBgWeight = 0.2;

    return {
        pageBg: baseTheme.bg.primary,
        surfacePrimary: baseTheme.bg.card,
        surfaceRaised: baseTheme.bg.elevated,
        surfaceMuted: mixHex(baseTheme.bg.card, brand, isLight ? 0.035 : 0.07),
        divider: mixHex(baseTheme.border.subtle, brand, 0.16),
        selectedBg: toRgba(brand, isLight ? 0.12 : 0.18),
        selectedBorder: brand,
        selectedText: mixHex(baseTheme.text.heading, brand, isLight ? 0.46 : 0.62),
        elementWood,
        elementFire,
        elementEarth,
        elementMetal,
        elementWater,
        elementWoodBg: mixHex(baseTheme.bg.card, elementWood, elementBgWeight),
        elementFireBg: mixHex(baseTheme.bg.card, elementFire, elementBgWeight),
        elementEarthBg: mixHex(baseTheme.bg.card, elementEarth, elementBgWeight),
        elementMetalBg: mixHex(baseTheme.bg.card, elementMetal, elementBgWeight),
        elementWaterBg: mixHex(baseTheme.bg.card, elementWater, elementBgWeight),
        statePositive: isLight ? '#2F8A63' : '#54B78E',
        stateNegative: isLight ? '#B9483E' : '#E16A5E',
        stateNeutral: mixHex(baseTheme.text.tertiary, brand, 0.12),
        chromeBg,
        chromeBorder,
        chromeText,
        chromeTextActive,
        heroBg,
        heroBorder,
        heroTitle,
        heroMeta,
        heroText,
        actionBg: toRgba(brand, 0.14),
        actionBorder: toRgba(brand, 0.24),
        actionBgActive: toRgba(brand, 0.3),
        infoBandBg,
        infoBandBorder: toRgba(infoBandText, 0.22),
        infoBandText,
        infoBandMuted: toRgba(infoBandText, 0.72),
        trackActiveBg,
        trackActiveBorder: brand,
        trackActiveText,
        warningBg: toRgba(baseTheme.accent.red, 0.16),
        warningBorder: toRgba(baseTheme.accent.red, 0.28),
        warningText: pickReadableText(
            mixHex(baseTheme.bg.elevated, baseTheme.accent.red, 0.24),
            mixHex(baseTheme.text.heading, baseTheme.accent.redLight, 0.18),
            mixHex(baseTheme.text.inverse, baseTheme.accent.red, 0.45),
        ),
    };
}
