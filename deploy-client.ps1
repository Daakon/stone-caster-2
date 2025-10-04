# Client deployment script for StoneCaster
# Deploys the React app to Cloudflare

Write-Host "Starting StoneCaster client deployment..." -ForegroundColor Green

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

Write-Host "Client deployment completed successfully!" -ForegroundColor Green
Write-Host "Client: https://stonecaster.ai" -ForegroundColor Cyan
