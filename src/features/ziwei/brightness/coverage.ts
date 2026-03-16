import { kot } from 'iztro/lib/i18n';

import type { ZiweiPalaceAnalysisView } from '../types';

export interface ZiweiBrightnessCoverageItem {
    starKey: string;
    starName: string;
    palaceName: string;
    brightness: string;
}

export function collectZiweiStarsMissingBrightness(palaces: ZiweiPalaceAnalysisView[]): ZiweiBrightnessCoverageItem[] {
    return palaces.flatMap((palace) => (
        [...palace.majorStars, ...palace.minorStars, ...palace.adjectiveStars]
            .filter((star) => !star.brightness)
            .map((star) => ({
                starKey: kot(star.name),
                starName: star.name,
                palaceName: palace.name,
                brightness: star.brightness,
            }))
    ));
}
