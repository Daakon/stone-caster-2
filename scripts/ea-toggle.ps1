# Early Access Toggle Script
# Phase B4: Quick toggle for EARLY_ACCESS_MODE on Fly.io server

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet('on','off')]
    [string]$Mode,
    
    [string]$App = 'stonecaster-api'
)

$ErrorActionPreference = "Stop"

Write-Host "Setting EARLY_ACCESS_MODE=$Mode on Fly app $App" -ForegroundColor Yellow

# Set the secret
Write-Host "Setting secret..." -ForegroundColor Cyan
flyctl secrets set "EARLY_ACCESS_MODE=$Mode" -a $App | Out-Null

if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to set secret!" -ForegroundColor Red
    exit 1
}

Write-Host "Secret set successfully." -ForegroundColor Green

# Restart machines to pick up the change
Write-Host "Restarting machines..." -ForegroundColor Cyan

# Get list of machines
$machines = flyctl machines list -a $App --json | ConvertFrom-Json

if ($machines.Count -eq 0) {
    Write-Host "No machines found. Deploying..." -ForegroundColor Yellow
    flyctl deploy -a $App --remote-only
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Deploy failed!" -ForegroundColor Red
        exit 1
    }
} else {
    # Restart all machines
    foreach ($machine in $machines) {
        $id = $machine.id
        Write-Host "Restarting machine $id..." -ForegroundColor Gray
        flyctl machines restart $id -a $App | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Warning: Failed to restart machine $id" -ForegroundColor Yellow
        }
    }
}

Write-Host "Done. EARLY_ACCESS_MODE is now $Mode" -ForegroundColor Green
Write-Host ""
Write-Host "Verify with:" -ForegroundColor Cyan
Write-Host "  curl https://api.stonecaster.ai/api/internal/flags -H 'Authorization: Bearer <admin-token>'" -ForegroundColor Gray

