<#
.SYNOPSIS
    Purges legacy AWF and Stone files from the Chimera project.
.DESCRIPTION
    Deletes directories and files marked for removal in PROJECT_CONTEXT_MAP.md.
    Defaults to Dry Run mode for safety.
.EXAMPLE
    .\scripts\purge_legacy.ps1
    Runs in Dry Run mode (lists files only).
.EXAMPLE
    .\scripts\purge_legacy.ps1 -Execute
    Actually deletes the files.
#>

param (
    [switch]$Execute
)

# The Kill List (From PROJECT_CONTEXT_MAP.md)
$LegacyPatterns = @(
    "backend/src/assemblers/awf-*",
    "backend/src/orchestrators/awf-*",
    "backend/src/routes/awf-*",
    "backend/src/model/awf-*",
    "backend/src/types/awf-*",
    "backend/src/mods",
    "backend/src/marketplace",
    "backend/src/services/stonePacks.service.ts"
)

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   CHIMERA LEGACY PURGE PROTOCOL (PS)     " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

if (-not $Execute) {
    Write-Host "MODE: DRY RUN (No files will be deleted)" -ForegroundColor Yellow
    Write-Host "Use '-Execute' switch to perform deletion.`n" -ForegroundColor Gray
} else {
    Write-Host "MODE: EXECUTE (Files WILL be deleted)" -ForegroundColor Red
    Start-Sleep -Seconds 2
}

foreach ($pattern in $LegacyPatterns) {
    # Resolve the path relative to the script location or root
    # Assuming script is run from project root
    $items = Get-ChildItem -Path $pattern -Recurse -ErrorAction SilentlyContinue

    if ($items) {
        foreach ($item in $items) {
            if (-not $Execute) {
                Write-Host "[DRY RUN] Would delete: $($item.FullName)" -ForegroundColor Yellow
            } else {
                Write-Host "Deleting: $($item.FullName)" -ForegroundColor Red
                Remove-Item -LiteralPath $item.FullName -Recurse -Force
            }
        }
    } else {
        # Pattern didn't match anything (already clean?)
        # Write-Host "No match found for: $pattern" -ForegroundColor DarkGray
    }
}

Write-Host "`nOperation Complete." -ForegroundColor Cyan