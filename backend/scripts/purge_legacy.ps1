# Stone Caster - Phase 1: Legacy Code Purge Script (PowerShell)
# Purpose: Delete all legacy AWF/Stone/Mod directories and files
# Date: 2025-12-04

$ErrorActionPreference = "Continue"  # Continue on errors

$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$BACKEND_DIR = Join-Path $SCRIPT_DIR "..\src"

Write-Host "🧹 Starting legacy code purge..." -ForegroundColor Cyan

# Delete directories matching awf-* pattern
Write-Host "Deleting awf-* directories..." -ForegroundColor Yellow
Get-ChildItem -Path $BACKEND_DIR -Directory -Filter "awf-*" -Recurse -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue

# Delete directories matching stone-* pattern
Write-Host "Deleting stone-* directories..." -ForegroundColor Yellow
Get-ChildItem -Path $BACKEND_DIR -Directory -Filter "stone-*" -Recurse -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue

# Delete mods directory
$modsPath = Join-Path $BACKEND_DIR "mods"
if (Test-Path $modsPath) {
    Write-Host "Deleting backend/src/mods/..." -ForegroundColor Yellow
    Remove-Item -Path $modsPath -Recurse -Force -ErrorAction SilentlyContinue
}

# Delete marketplace directory
$marketplacePath = Join-Path $BACKEND_DIR "marketplace"
if (Test-Path $marketplacePath) {
    Write-Host "Deleting backend/src/marketplace/..." -ForegroundColor Yellow
    Remove-Item -Path $marketplacePath -Recurse -Force -ErrorAction SilentlyContinue
}

# Delete specific legacy files
Write-Host "Deleting legacy service files..." -ForegroundColor Yellow
$stonePacksPath = Join-Path $BACKEND_DIR "services\stonePacks.service.ts"
if (Test-Path $stonePacksPath) {
    Remove-Item -Path $stonePacksPath -Force -ErrorAction SilentlyContinue
}

# Delete awf-* files in various directories
Write-Host "Deleting awf-* files..." -ForegroundColor Yellow
Get-ChildItem -Path $BACKEND_DIR -File -Filter "awf-*" -Recurse -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
Get-ChildItem -Path $BACKEND_DIR -File -Filter "*awf*" -Recurse -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue

# Delete stone-* files (but keep stone_caster_mvp_webapp_prompt_template_just_add_files.md as it's a prompt template)
Write-Host "Deleting stone-* service files..." -ForegroundColor Yellow
Get-ChildItem -Path (Join-Path $BACKEND_DIR "services") -File -Filter "stone*.ts" -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
Get-ChildItem -Path (Join-Path $BACKEND_DIR "services") -File -Filter "stone*.test.ts" -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue

# Delete mod-* files
Write-Host "Deleting mod-* files..." -ForegroundColor Yellow
Get-ChildItem -Path $BACKEND_DIR -File -Filter "mod-*" -Recurse -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
Get-ChildItem -Path (Join-Path $BACKEND_DIR "services") -File -Filter "module-*.ts" -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
Get-ChildItem -Path (Join-Path $BACKEND_DIR "services") -File -Filter "modules-*.ts" -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue

# Delete orchestrators/awf-* directories
$orchestratorsPath = Join-Path $BACKEND_DIR "orchestrators"
if (Test-Path $orchestratorsPath) {
    Write-Host "Deleting orchestrators/awf-* directories..." -ForegroundColor Yellow
    Get-ChildItem -Path $orchestratorsPath -Directory -Filter "awf-*" -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
}

# Delete routes/awf-* files
Write-Host "Deleting routes/awf-* files..." -ForegroundColor Yellow
$routesPath = Join-Path $BACKEND_DIR "routes"
if (Test-Path $routesPath) {
    Get-ChildItem -Path $routesPath -File -Filter "awf-*" -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
    Get-ChildItem -Path $routesPath -File -Filter "*awf*" -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
}

# Delete model/awf-* files
Write-Host "Deleting model/awf-* files..." -ForegroundColor Yellow
$modelPath = Join-Path $BACKEND_DIR "model"
if (Test-Path $modelPath) {
    Get-ChildItem -Path $modelPath -File -Filter "awf-*" -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
    Get-ChildItem -Path $modelPath -File -Filter "*awf*" -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
}

# Delete types/awf-* files
Write-Host "Deleting types/awf-* files..." -ForegroundColor Yellow
$typesPath = Join-Path $BACKEND_DIR "types"
if (Test-Path $typesPath) {
    Get-ChildItem -Path $typesPath -File -Filter "awf-*" -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
    Get-ChildItem -Path $typesPath -File -Filter "*awf*" -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
}

Write-Host "✅ Legacy code purge complete!" -ForegroundColor Green

