# Run Admin Migrations in Correct Order
# This script runs the admin migrations in the proper sequence to avoid type conflicts

param(
    [Parameter(Mandatory=$true)]
    [string]$DatabaseUrl
)

Write-Host "Running Admin Migrations in Correct Order..." -ForegroundColor Green

# Migration 1: Create Safe Worlds Mapping
Write-Host "1. Creating safe worlds mapping..." -ForegroundColor Yellow
psql $DatabaseUrl -f "supabase/migrations/20250131_fix_worlds_uuid_safe.sql"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Failed to create worlds mapping" -ForegroundColor Red
    exit 1
}

# Migration 2: Create Rulesets Table
Write-Host "2. Creating rulesets table..." -ForegroundColor Yellow
psql $DatabaseUrl -f "supabase/migrations/20250131_create_rulesets_table.sql"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Failed to create rulesets table" -ForegroundColor Red
    exit 1
}

# Migration 3: Admin Phase B (Safe Version)
Write-Host "3. Running safe admin associations (Phase B)..." -ForegroundColor Yellow
psql $DatabaseUrl -f "supabase/migrations/20250131_admin_associations_phase_b_safe.sql"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Failed to run safe admin associations migration" -ForegroundColor Red
    exit 1
}

# Migration 4: Admin Phase C
Write-Host "4. Running admin publishing (Phase C)..." -ForegroundColor Yellow
psql $DatabaseUrl -f "supabase/migrations/20250131_admin_publishing_phase_c.sql"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Failed to run admin publishing migration" -ForegroundColor Red
    exit 1
}

# Migration 5: Prompt Fields
Write-Host "5. Adding prompt fields..." -ForegroundColor Yellow
psql $DatabaseUrl -f "supabase/migrations/20250131_add_prompt_fields.sql"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Failed to add prompt fields" -ForegroundColor Red
    exit 1
}

# Migration 6: Scope Cleanup
Write-Host "6. Running scope cleanup..." -ForegroundColor Yellow
psql $DatabaseUrl -f "supabase/migrations/20250204_segments_scope_cleanup.sql"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Failed to run scope cleanup" -ForegroundColor Red
    exit 1
}

# Migration 7: Referential Integrity
Write-Host "7. Adding referential integrity..." -ForegroundColor Yellow
psql $DatabaseUrl -f "supabase/migrations/20250205_prompt_segments_ref_integrity.sql"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Failed to add referential integrity" -ForegroundColor Red
    exit 1
}

Write-Host "All admin migrations completed successfully!" -ForegroundColor Green

# Verify the schema
Write-Host "Verifying schema..." -ForegroundColor Cyan
psql $DatabaseUrl -c "
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name IN ('worlds', 'rulesets', 'entries', 'npcs', 'npc_packs')
ORDER BY table_name, ordinal_position;
"

Write-Host "Migration verification complete!" -ForegroundColor Green
