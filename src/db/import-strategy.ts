export type ImportAction = 'insert' | 'update' | 'skip';

export function resolveImportAction(
    hasExisting: boolean,
    mode: 'merge' | 'replace',
    conflictPolicy: 'skip' | 'replace'
): ImportAction {
    if (!hasExisting) {
        return 'insert';
    }
    if (mode === 'replace') {
        return 'update';
    }
    return conflictPolicy === 'skip' ? 'skip' : 'update';
}
