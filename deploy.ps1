# Comprehensive deployment script for StoneCaster
# This handles both client (Cloudflare) and server (Fly.io) deployments

Write-Host "Starting StoneCaster deployment..." -ForegroundColor Green

# Step 1: Set environment variables for client build
Write-Host "Setting client build environment variables..." -ForegroundColor Yellow
$env:VITE_SUPABASE_URL = "https://obfadjnywufemhhhcxiy.supabase.co"
$env:VITE_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_QKJ2Ji-SjAQJIbs5NITDpw_IMVQ9JDl"

# Step 2: Build the client
Write-Host "Building client..." -ForegroundColor Yellow
Set-Location frontend
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Client build failed!" -ForegroundColor Red
    exit 1
}
Set-Location ..

# Step 3: Deploy client to Cloudflare
Write-Host "Deploying client to Cloudflare..." -ForegroundColor Yellow
npx wrangler deploy
if ($LASTEXITCODE -ne 0) {
    Write-Host "Client deployment failed!" -ForegroundColor Red
    exit 1
}

# Step 4: Deploy server to Fly.io (Docker build happens automatically)
Write-Host "Deploying server to Fly.io..." -ForegroundColor Yellow
Write-Host "   (Docker build will happen automatically during deployment)" -ForegroundColor Gray
flyctl deploy
if ($LASTEXITCODE -ne 0) {
    Write-Host "Server deployment failed!" -ForegroundColor Red
    exit 1
}

Write-Host "Deployment completed successfully!" -ForegroundColor Green
Write-Host "Client: https://stonecaster.ai" -ForegroundColor Cyan
Write-Host "Server: https://stonecaster-api.fly.dev" -ForegroundColor Cyan
