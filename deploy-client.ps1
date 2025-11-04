# Client deployment script for StoneCaster
# Deploys the React app to Cloudflare

$ErrorActionPreference = "Stop"

Write-Host "Starting StoneCaster client deployment..." -ForegroundColor Green

# Set CI/non-interactive environment variables
$env:CI = "1"
$env:WRANGLER_NON_INTERACTIVE = "1"

# Step 1: Set environment variables for client build
Write-Host "Setting client build environment variables..." -ForegroundColor Yellow
$env:VITE_SUPABASE_URL = "https://obfadjnywufemhhhcxiy.supabase.co"
$env:VITE_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_QKJ2Ji-SjAQJIbs5NITDpw_IMVQ9JDl"

# Step 2: Build the client
# Note: Using build:deploy to skip strict type checking for deployment
# TODO: Fix TypeScript errors and use regular build
Write-Host "Building client (deploy mode - skipping strict type checks)..." -ForegroundColor Yellow
Push-Location frontend
try {
    npm run build:deploy
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Client build failed!" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "Client build error: $_" -ForegroundColor Red
    exit 1
} finally {
    Pop-Location
}

# Step 3: Deploy client to Cloudflare
Write-Host "Deploying client to Cloudflare..." -ForegroundColor Yellow
try {
    npx wrangler deploy --config wrangler.toml
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Client deployment failed!" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "Client deployment error: $_" -ForegroundColor Red
    exit 1
}

Write-Host "Client deployment completed successfully!" -ForegroundColor Green
Write-Host "Client: https://stonecaster.ai" -ForegroundColor Cyan
