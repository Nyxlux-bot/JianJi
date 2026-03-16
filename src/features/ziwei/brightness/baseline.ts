import { kot, t } from 'iztro/lib/i18n';

import baseline from './ziwei-brightness-baseline.json';
import type { ZiweiAlgorithm } from '../types';

export type ZiweiBrightnessCode = 'miao' | 'wang' | 'de' | 'li' | 'ping' | 'xian' | 'bu';
export type ZiweiBrightnessValue = ZiweiBrightnessCode | null;

export type ZiweiBrightnessSchoolId = keyof typeof baseline.schools;

export function resolveZiweiBrightnessSchoolId(algorithm: ZiweiAlgorithm): ZiweiBrightnessSchoolId {
    return algorithm === 'zhongzhou' ? 'zhongzhou' : 'common_quanshu';
}

export function getZiweiBrightnessBaseline() {
    return baseline;
}

export function buildZiweiBrightnessConfig(schoolId: ZiweiBrightnessSchoolId): Record<string, string[]> {
    const school = baseline.schools[schoolId];
    if (!school) {
        return {};
    }

    const result: Record<string, string[]> = {};
    const expectedLength = baseline.branchOrder.length;

    Object.entries(school.stars).forEach(([starKey, values]) => {
        if (!Array.isArray(values) || values.length !== expectedLength) {
            return;
        }

        // Keep partial tables usable: unknown branches stay empty-string so `iztro`
        // can still resolve known branches instead of discarding the entire star.
        result[starKey] = (values as ZiweiBrightnessValue[]).map((value) => value ?? '');
    });

    return result;
}

export function resolveZiweiBrightnessLabel(
    algorithm: ZiweiAlgorithm,
    starNameOrKey: string,
    earthlyBranch: string,
): string {
    const schoolId = resolveZiweiBrightnessSchoolId(algorithm);
    const school = baseline.schools[schoolId];
    if (!school) {
        return '';
    }

    const starKey = kot<string>(starNameOrKey);
    const branchIndex = baseline.branchOrder.indexOf(earthlyBranch as (typeof baseline.branchOrder)[number]);
    if (branchIndex < 0) {
        return '';
    }

    const values = (school.stars as Record<string, Array<ZiweiBrightnessValue>>)[starKey];
    const code = values?.[branchIndex];

    return code ? t(code) : '';
}
