#!/bin/bash
# Stone Caster - Phase 1.3: Backend Legacy Purge Script
# Purpose: Remove all legacy AWF, Stone, and Mod backend code
# Date: 2025-12-04

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SRC_DIR="$BACKEND_DIR/src"

echo "🧹 Starting Backend Legacy Purge..."
echo "📁 Backend directory: $BACKEND_DIR"
echo ""

# Check if we're in the right directory
if [ ! -d "$SRC_DIR" ]; then
    echo "❌ Error: src/ directory not found. Are you running this from the backend directory?"
    exit 1
fi

# Function to safely remove files/directories
remove_if_exists() {
    local target="$1"
    if [ -e "$target" ]; then
        echo "  🗑️  Removing: $target"
        rm -rf "$target"
    else
        echo "  ⏭️  Skipping (not found): $target"
    fi
}

echo "📋 Step 1: Removing AWF legacy files..."
# Remove AWF assemblers
for file in "$SRC_DIR/assemblers"/awf-*; do
    remove_if_exists "$file"
done

# Remove AWF orchestrators (if directory exists)
if [ -d "$SRC_DIR/orchestrators" ]; then
    for file in "$SRC_DIR/orchestrators"/awf-*; do
        remove_if_exists "$file"
    done
fi

# Remove AWF routes
for file in "$SRC_DIR/routes"/awf-*; do
    remove_if_exists "$file"
done

# Remove AWF model files
for file in "$SRC_DIR/model"/awf-*; do
    remove_if_exists "$file"
done

# Remove AWF type files
for file in "$SRC_DIR/types"/awf-*; do
    remove_if_exists "$file"
done

# Remove AWF validators
for file in "$SRC_DIR/validators"/awf-*; do
    remove_if_exists "$file"
done

# Remove AWF utils
for file in "$SRC_DIR/utils"/awf-*; do
    remove_if_exists "$file"
done

echo ""
echo "📋 Step 2: Removing Stone legacy files..."
# Remove Stone service files
remove_if_exists "$SRC_DIR/services/stonePacks.service.ts"
remove_if_exists "$SRC_DIR/services/stone-packs.service.ts"
remove_if_exists "$SRC_DIR/services/stone.service.ts"

echo ""
echo "📋 Step 3: Removing Mod directories..."
# Remove mods directory
remove_if_exists "$SRC_DIR/mods"

# Remove marketplace directory
remove_if_exists "$SRC_DIR/marketplace"

echo ""
echo "📋 Step 4: Removing legacy analytics/reports services..."
# Remove analytics service (if exists)
remove_if_exists "$SRC_DIR/services/analytics.service.ts"
remove_if_exists "$SRC_DIR/services/admin.analytics.service.ts"

# Remove reports service (if exists)
remove_if_exists "$SRC_DIR/services/reports.service.ts"
remove_if_exists "$SRC_DIR/services/admin.reports.service.ts"

# Remove reviews service (if exists)
remove_if_exists "$SRC_DIR/services/reviews.service.ts"
remove_if_exists "$SRC_DIR/services/admin.reviews.service.ts"

echo ""
echo "✅ Backend Legacy Purge Complete!"
echo ""
echo "📊 Summary:"
echo "  - Removed AWF legacy files (assemblers, orchestrators, routes, models, types, validators, utils)"
echo "  - Removed Stone service files"
echo "  - Removed mods/ and marketplace/ directories"
echo "  - Removed legacy analytics/reports/reviews services"
echo ""
echo "⚠️  Next Steps:"
echo "  1. Review backend/src/index.ts for any remaining legacy route imports"
echo "  2. Run 'npm run build' to verify no build errors"
echo "  3. Run tests to ensure nothing broke"
echo ""

