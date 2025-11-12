# Fix Production Configuration for StoneCaster
# This script sets the required environment variables for production deployment
# Run this after deployment to ensure CORS and OAuth redirects work correctly

$ErrorActionPreference = "Stop"

Write-Host "🔧 Fixing Production Configuration for StoneCaster..." -ForegroundColor Green
Write-Host ""

# Set CORS origin (must match the frontend domain)
Write-Host "Setting CORS origin..." -ForegroundColor Yellow
flyctl secrets set CORS_ORIGIN="https://stonecaster.ai" -a stonecaster-api
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to set CORS_ORIGIN" -ForegroundColor Red
    exit 1
}

# Set frontend URL (for OAuth redirects)
Write-Host "Setting FRONTEND_URL..." -ForegroundColor Yellow
flyctl secrets set FRONTEND_URL="https://stonecaster.ai" -a stonecaster-api
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to set FRONTEND_URL" -ForegroundColor Red
    exit 1
}

# Set API URL (for OAuth callback URLs)
# Use the custom domain for the production API URL
Write-Host "Setting API_URL..." -ForegroundColor Yellow
flyctl secrets set API_URL="https://api.stonecaster.ai" -a stonecaster-api
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to set API_URL" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ Production configuration updated successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Configuration Summary:" -ForegroundColor Cyan
Write-Host "   CORS_ORIGIN: https://stonecaster.ai" -ForegroundColor Gray
Write-Host "   FRONTEND_URL: https://stonecaster.ai" -ForegroundColor Gray
Write-Host "   API_URL: https://api.stonecaster.ai" -ForegroundColor Gray
Write-Host ""
Write-Host "⚠️  IMPORTANT: The backend needs to be restarted to pick up these changes." -ForegroundColor Yellow
Write-Host "   Run: flyctl deploy --remote-only --app stonecaster-api" -ForegroundColor Cyan
Write-Host ""
Write-Host "🔍 To verify the secrets were set:" -ForegroundColor Cyan
Write-Host "   flyctl secrets list -a stonecaster-api" -ForegroundColor Gray
Write-Host ""


