import type { ZiweiFormatterContext } from '../features/ziwei/ai-context';
import {
    formatZiweiToFullText,
} from '../features/ziwei/ai-serializer';
import {
    isZiweiContextSnapshotCurrent,
    type ZiweiRecordResult,
} from '../features/ziwei/record';

export function formatZiweiToText(record: ZiweiRecordResult, runtimeContext?: ZiweiFormatterContext): string {
    return formatZiweiToFullText(record, runtimeContext, {
        enhancedEvidence: isZiweiContextSnapshotCurrent(record.aiContextSnapshot),
    });
}
