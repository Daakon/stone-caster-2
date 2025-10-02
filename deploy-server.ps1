# Server deployment script for StoneCaster
# Deploys the Node.js API to Fly.io

Write-Host "Starting StoneCaster server deployment..." -ForegroundColor Green

# Step 1: Deploy server to Fly.io (Docker build happens automatically)
Write-Host "Deploying server to Fly.io..." -ForegroundColor Yellow
Write-Host "   (Docker build will happen automatically during deployment)" -ForegroundColor Gray
flyctl deploy
if ($LASTEXITCODE -ne 0) {
    Write-Host "Server deployment failed!" -ForegroundColor Red
    exit 1
}

Write-Host "Server deployment completed successfully!" -ForegroundColor Green
Write-Host "Server: https://stonecaster-api.fly.dev" -ForegroundColor Cyan
Write-Host "Health Check: https://stonecaster-api.fly.dev/health" -ForegroundColor Cyan
