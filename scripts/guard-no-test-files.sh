#!/bin/sh
set -eu

mode="${1:---staged}"

tmp_file=$(mktemp)
blocked_file="$tmp_file.blocked"
trap 'rm -f "$tmp_file" "$blocked_file"' EXIT INT TERM

case "$mode" in
    --staged)
        git diff --cached --name-only --diff-filter=ACMR > "$tmp_file"
        ;;
    --stdin)
        cat > "$tmp_file"
        ;;
    *)
        echo "Usage: sh scripts/guard-no-test-files.sh [--staged|--stdin]" >&2
        exit 2
        ;;
esac

: > "$blocked_file"

while IFS= read -r path; do
    [ -n "$path" ] || continue

    case "$path" in
        *.test.ts|*.test.tsx|*.test.js|*.test.jsx|*.spec.ts|*.spec.tsx|*.spec.js|*.spec.jsx|\
        */__tests__/*|__tests__/*|\
        */tests/*|tests/*|\
        */__localtests__/*|__localtests__/*|\
        jest.config.js|jest.config.cjs|jest.config.mjs|jest.config.ts|\
        vitest.config.js|vitest.config.cjs|vitest.config.mjs|vitest.config.ts|\
        cypress.config.js|cypress.config.ts|\
        playwright.config.js|playwright.config.ts)
            printf '%s\n' "$path" >> "$blocked_file"
            ;;
    esac
done < "$tmp_file"

if [ -s "$blocked_file" ]; then
    echo "Commit/push blocked: this repository is configured to reject committed test files and test configs." >&2
    echo "Matched paths:" >&2
    cat "$blocked_file" >&2
    echo "Move local experiments outside the repo, or keep them in an untracked local directory." >&2
    exit 1
fi
