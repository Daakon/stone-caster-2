#!/bin/bash
# Stone Caster - Legacy Purge Script (Phase 1: Purge & Solidify)
# Purpose: Safely delete AWF and legacy code directories/files
# Usage: ./scripts/purge_legacy.sh [--dry-run] [--confirm]

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Defaults
DRY_RUN=true
CONFIRM=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --confirm)
      DRY_RUN=false
      CONFIRM=true
      shift
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      echo "Usage: $0 [--dry-run] [--confirm]"
      exit 1
      ;;
  esac
done

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend/src"

echo -e "${YELLOW}=== Stone Caster Legacy Purge Script ===${NC}"
echo "Project Root: $PROJECT_ROOT"
echo "Backend Dir: $BACKEND_DIR"
echo "Mode: $([ "$DRY_RUN" = true ] && echo "DRY-RUN (no files will be deleted)" || echo "LIVE (files will be deleted)")"
echo ""

# Safety check: ensure we're in the right directory
if [ ! -d "$BACKEND_DIR" ]; then
  echo -e "${RED}ERROR: Backend directory not found at $BACKEND_DIR${NC}"
  exit 1
fi

# Count files/directories to be deleted
TOTAL_COUNT=0
DELETED_COUNT=0

# Function to safely delete a path
delete_path() {
  local path="$1"
  local description="$2"
  
  if [ ! -e "$path" ]; then
    echo -e "${YELLOW}  [SKIP] $description: $path (not found)${NC}"
    return
  fi
  
  TOTAL_COUNT=$((TOTAL_COUNT + 1))
  
  if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}  [WOULD DELETE] $description: $path${NC}"
  else
    if [ -d "$path" ]; then
      rm -rf "$path"
      echo -e "${GREEN}  [DELETED] Directory: $path${NC}"
    else
      rm -f "$path"
      echo -e "${GREEN}  [DELETED] File: $path${NC}"
    fi
    DELETED_COUNT=$((DELETED_COUNT + 1))
  fi
}

echo -e "${YELLOW}=== Phase 1: AWF Directories ===${NC}"

# AWF directories (from PROJECT_CONTEXT_MAP.md Section 1)
for pattern in "awf-*"; do
  # Find all matching directories
  find "$BACKEND_DIR/assemblers" -maxdepth 1 -type d -name "$pattern" 2>/dev/null | while read -r dir; do
    delete_path "$dir" "AWF Assembler"
  done
  
  find "$BACKEND_DIR/orchestrators" -maxdepth 1 -type d -name "$pattern" 2>/dev/null | while read -r dir; do
    delete_path "$dir" "AWF Orchestrator"
  done
  
  find "$BACKEND_DIR/routes" -maxdepth 1 -type f -name "$pattern.ts" 2>/dev/null | while read -r file; do
    delete_path "$file" "AWF Route"
  done
  
  find "$BACKEND_DIR/model" -maxdepth 1 -type f -name "$pattern.ts" 2>/dev/null | while read -r file; do
    delete_path "$file" "AWF Model"
  done
  
  find "$BACKEND_DIR/types" -maxdepth 1 -type f -name "$pattern.ts" 2>/dev/null | while read -r file; do
    delete_path "$file" "AWF Type"
  done
  
  find "$BACKEND_DIR/validators" -maxdepth 1 -type f -name "$pattern.ts" 2>/dev/null | while read -r file; do
    delete_path "$file" "AWF Validator"
  done
  
  find "$BACKEND_DIR/utils" -maxdepth 1 -type f -name "$pattern.ts" 2>/dev/null | while read -r file; do
    delete_path "$file" "AWF Utility"
  done
  
  find "$BACKEND_DIR/metrics" -maxdepth 1 -type f -name "$pattern.ts" 2>/dev/null | while read -r file; do
    delete_path "$file" "AWF Metric"
  done
  
  find "$BACKEND_DIR/slos" -maxdepth 1 -type f -name "$pattern.ts" 2>/dev/null | while read -r file; do
    delete_path "$file" "AWF SLO"
  done
  
  find "$BACKEND_DIR/repositories" -maxdepth 1 -type f -name "$pattern.ts" 2>/dev/null | while read -r file; do
    delete_path "$file" "AWF Repository"
  done
  
  find "$BACKEND_DIR/authoring" -maxdepth 1 -type f -name "$pattern.ts" 2>/dev/null | while read -r file; do
    delete_path "$file" "AWF Authoring"
  done
  
  find "$BACKEND_DIR/interpreters" -maxdepth 1 -type f -name "$pattern.ts" 2>/dev/null | while read -r file; do
    delete_path "$file" "AWF Interpreter"
  done
  
  find "$BACKEND_DIR/jobs" -maxdepth 1 -type f -name "$pattern.ts" 2>/dev/null | while read -r file; do
    delete_path "$file" "AWF Job"
  done
done

# Also handle awf-* files in root of these directories
find "$BACKEND_DIR" -maxdepth 2 -type f -name "awf-*.ts" 2>/dev/null | while read -r file; do
  delete_path "$file" "AWF File"
done

echo ""
echo -e "${YELLOW}=== Phase 2: Legacy Directories ===${NC}"

# Legacy directories
delete_path "$BACKEND_DIR/mods" "Mods Directory"
delete_path "$BACKEND_DIR/marketplace" "Marketplace Directory"
delete_path "$BACKEND_DIR/autoplay" "Autoplay Directory"

echo ""
echo -e "${YELLOW}=== Phase 3: Legacy Service Files ===${NC}"

# Legacy service files
delete_path "$BACKEND_DIR/services/stonePacks.service.ts" "Stone Packs Service"
delete_path "$BACKEND_DIR/services/stoneLedger.service.ts" "Stone Ledger Service" 2>/dev/null || true
delete_path "$BACKEND_DIR/services/wallet.service.ts" "Wallet Service" 2>/dev/null || true

echo ""
echo -e "${YELLOW}=== Phase 4: Legacy Test Files ===${NC}"

# AWF test files
find "$PROJECT_ROOT/backend/tests" -type f -name "awf-*.test.ts" 2>/dev/null | while read -r file; do
  delete_path "$file" "AWF Test"
done

find "$PROJECT_ROOT/backend/tests" -type f -name "awf-*.ts" 2>/dev/null | while read -r file; do
  delete_path "$file" "AWF Test"
done

echo ""
echo -e "${YELLOW}=== Phase 5: Legacy Scripts ===${NC}"

# AWF scripts
find "$PROJECT_ROOT/scripts" -type f -name "*awf*" 2>/dev/null | while read -r file; do
  delete_path "$file" "AWF Script"
done

echo ""
echo -e "${YELLOW}=== Summary ===${NC}"
echo "Total items found: $TOTAL_COUNT"

if [ "$DRY_RUN" = true ]; then
  echo -e "${YELLOW}DRY-RUN mode: No files were actually deleted.${NC}"
  echo -e "${YELLOW}To actually delete these files, run: $0 --confirm${NC}"
else
  echo -e "${GREEN}Successfully deleted: $DELETED_COUNT items${NC}"
fi

echo ""
echo -e "${GREEN}Purge script completed!${NC}"

