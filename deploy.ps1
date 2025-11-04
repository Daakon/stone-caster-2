# Comprehensive deployment script for StoneCaster
# This handles both client (Cloudflare) and server (Fly.io) deployments

$ErrorActionPreference = "Stop"

Write-Host "Starting StoneCaster deployment..." -ForegroundColor Green

# Set CI/non-interactive environment variables
$env:CI = "1"
$env:WRANGLER_NON_INTERACTIVE = "1"
# Clear any Fly.io token env vars - use interactive login only
Remove-Item Env:FLY_API_TOKEN -ErrorAction SilentlyContinue
Remove-Item Env:FLY_ACCESS_TOKEN -ErrorAction SilentlyContinue
Remove-Item Env:FLY_TOKEN -ErrorAction SilentlyContinue

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
# Ensure we're in the root directory for wrangler.toml
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

# Step 4: Deploy server to Fly.io (Docker build happens automatically)
Write-Host "Deploying server to Fly.io..." -ForegroundColor Yellow
Write-Host "   (Note: Use deploy-server.ps1 for server-only deployments with proper auth)" -ForegroundColor Gray
Write-Host "   (This will use interactive login - ensure you're authenticated)" -ForegroundColor Gray
# Ensure no token env vars are set
$env:FLY_API_TOKEN = $null
$env:FLY_ACCESS_TOKEN = $null
$env:FLY_TOKEN = $null
try {
    # Use remote-only build to avoid local Docker requirements
    flyctl deploy --remote-only --app stonecaster-api
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Server deployment failed!" -ForegroundColor Red
        Write-Host "For better auth handling, use: .\deploy-server.ps1" -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host "Server deployment error: $_" -ForegroundColor Red
    Write-Host "For better auth handling, use: .\deploy-server.ps1" -ForegroundColor Yellow
    exit 1
}

Write-Host "Deployment completed successfully!" -ForegroundColor Green
Write-Host "Client: https://stonecaster.ai" -ForegroundColor Cyan
Write-Host "Server: https://stonecaster-api.fly.dev" -ForegroundColor Cyan
