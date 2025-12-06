#!/bin/bash
# Stone Caster - Phase 1: Legacy Code Purge Script
# Purpose: Delete all legacy AWF/Stone/Mod directories and files
# Date: 2025-12-04

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/../src"

echo "🧹 Starting legacy code purge..."

# Delete directories matching awf-* pattern
echo "Deleting awf-* directories..."
find "$BACKEND_DIR" -type d -name "awf-*" -exec rm -rf {} + 2>/dev/null || true

# Delete directories matching stone-* pattern
echo "Deleting stone-* directories..."
find "$BACKEND_DIR" -type d -name "stone-*" -exec rm -rf {} + 2>/dev/null || true

# Delete mods directory
if [ -d "$BACKEND_DIR/mods" ]; then
    echo "Deleting backend/src/mods/..."
    rm -rf "$BACKEND_DIR/mods"
fi

# Delete marketplace directory
if [ -d "$BACKEND_DIR/marketplace" ]; then
    echo "Deleting backend/src/marketplace/..."
    rm -rf "$BACKEND_DIR/marketplace"
fi

# Delete specific legacy files
echo "Deleting legacy service files..."
rm -f "$BACKEND_DIR/services/stonePacks.service.ts" 2>/dev/null || true

# Delete awf-* files in various directories
echo "Deleting awf-* files..."
find "$BACKEND_DIR" -type f -name "awf-*" -delete 2>/dev/null || true
find "$BACKEND_DIR" -type f -name "*awf*" -delete 2>/dev/null || true

# Delete stone-* files (but keep stone_caster_mvp_webapp_prompt_template_just_add_files.md as it's a prompt template)
echo "Deleting stone-* service files..."
find "$BACKEND_DIR/services" -type f -name "stone*.ts" -delete 2>/dev/null || true
find "$BACKEND_DIR/services" -type f -name "stone*.test.ts" -delete 2>/dev/null || true

# Delete mod-* files
echo "Deleting mod-* files..."
find "$BACKEND_DIR" -type f -name "mod-*" -delete 2>/dev/null || true
find "$BACKEND_DIR/services" -type f -name "module-*.ts" -delete 2>/dev/null || true
find "$BACKEND_DIR/services" -type f -name "modules-*.ts" -delete 2>/dev/null || true

# Delete orchestrators/awf-* directories
if [ -d "$BACKEND_DIR/orchestrators" ]; then
    echo "Deleting orchestrators/awf-* directories..."
    find "$BACKEND_DIR/orchestrators" -type d -name "awf-*" -exec rm -rf {} + 2>/dev/null || true
fi

# Delete routes/awf-* files
echo "Deleting routes/awf-* files..."
find "$BACKEND_DIR/routes" -type f -name "awf-*" -delete 2>/dev/null || true
find "$BACKEND_DIR/routes" -type f -name "*awf*" -delete 2>/dev/null || true

# Delete model/awf-* files
echo "Deleting model/awf-* files..."
find "$BACKEND_DIR/model" -type f -name "awf-*" -delete 2>/dev/null || true
find "$BACKEND_DIR/model" -type f -name "*awf*" -delete 2>/dev/null || true

# Delete types/awf-* files
echo "Deleting types/awf-* files..."
find "$BACKEND_DIR/types" -type f -name "awf-*" -delete 2>/dev/null || true
find "$BACKEND_DIR/types" -type f -name "*awf*" -delete 2>/dev/null || true

echo "✅ Legacy code purge complete!"

