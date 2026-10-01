import type { BaziResult } from '../core/bazi-types';
import type { ZiweiRecordResult } from '../features/ziwei/record';
import { updateExistingRecordResult } from '../db/database';
import {
    getActiveVerificationMarks,
    getVerificationRevision,
    type AIVerificationMark,
} from '../core/ai-verification-marks';

/**
 * Sets (or clears, with mark = null) one event's mark on the saved verification.
 * Reads the record fresh so a mark never lands on a verification the user is
 * no longer looking at: if the saved text changed, older marks are dropped.
 */
export async function setVerificationMark<T extends BaziResult | ZiweiRecordResult>(
    engineType: 'bazi' | 'ziwei',
    recordId: string,
    expectedVerification: string,
    year: number,
    summary: string,
    mark: AIVerificationMark | null,
): Promise<T | null> {
    const updated = await updateExistingRecordResult(recordId, engineType, (current) => {
        const result = current as T;
        const revision = getVerificationRevision(result.aiVerificationSummary);
        if (revision !== getVerificationRevision(expectedVerification)) return null;
        const marks = { ...getActiveVerificationMarks(result) };
        if (mark) marks[String(year)] = { mark, summary: summary.slice(0, 80) };
        else delete marks[String(year)];
        return { ...result, aiVerificationMarks: { revision, marks } };
    });
    return updated as T | null;
}
