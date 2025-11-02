#!/bin/bash
# Check Legacy Code
# Blocks legacy prompting code patterns from being reintroduced

set -e

echo "🔍 Checking for legacy code patterns..."

EXIT_CODE=0

# Block patterns
BLOCK_PATTERNS=(
    "prompt_segments_for_context"
    "prompting\.prompts\b"
    "prompting\.prompt_segments\b"
    "buildPrompt\("  # Allow only in tests/fixtures/legacy/**
)

# Search patterns (exclude node_modules, dist, and legacy test fixtures)
for pattern in "${BLOCK_PATTERNS[@]}"; do
    echo "  Checking for: $pattern"
    
    # Search in backend/src (not in legacy test fixtures)
    if grep -r -n --include="*.ts" --include="*.tsx" \
        --exclude-dir=node_modules \
        --exclude-dir=dist \
        -E "$pattern" \
        backend/src 2>/dev/null; then
        
        echo "❌ ERROR: Found legacy pattern '$pattern' in backend/src"
        EXIT_CODE=1
    fi
    
    # Search for initial-prompt route strings
    if grep -r -n --include="*.ts" --include="*.tsx" \
        --exclude-dir=node_modules \
        --exclude-dir=dist \
        "initial-prompt" \
        backend/src 2>/dev/null; then
        
        echo "❌ ERROR: Found 'initial-prompt' route reference in backend/src"
        EXIT_CODE=1
    fi
done

# Check for scope: 'scenario' in new code (except legacy test fixtures)
if grep -r -n --include="*.ts" --include="*.tsx" \
    --exclude-dir=node_modules \
    --exclude-dir=dist \
    -E "scope:\s*['\"]scenario['\"]" \
    backend/src 2>/dev/null; then
    
    echo "❌ ERROR: Found scope:'scenario' in backend/src (use scope:'entry' instead)"
    EXIT_CODE=1
fi

if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ No legacy code patterns found"
else
    echo "❌ Legacy code patterns detected. See docs/deprecations/prompting-legacy-decomm.md"
fi

exit $EXIT_CODE
