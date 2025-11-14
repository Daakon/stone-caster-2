# Set Fly.io Secrets for Authentication
# This script sets the required environment variables for OAuth authentication in production
# It sets both the new (preferred) and legacy (backward compatibility) variable names

$ErrorActionPreference = "Stop"

Write-Host "🔐 Setting Fly.io Authentication Secrets..." -ForegroundColor Green
Write-Host ""

$appName = "stonecaster-api"

# Set the new preferred variable names
Write-Host "Setting WEB_BASE_URL (preferred)..." -ForegroundColor Yellow
flyctl secrets set WEB_BASE_URL="https://stonecaster.ai" -a $appName
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to set WEB_BASE_URL" -ForegroundColor Red
    exit 1
}

Write-Host "Setting API_BASE_URL (preferred)..." -ForegroundColor Yellow
flyctl secrets set API_BASE_URL="https://api.stonecaster.ai" -a $appName
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to set API_BASE_URL" -ForegroundColor Red
    exit 1
}

# Also set legacy variable names for backward compatibility
Write-Host "Setting FRONTEND_URL (legacy, for backward compatibility)..." -ForegroundColor Yellow
flyctl secrets set FRONTEND_URL="https://stonecaster.ai" -a $appName
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Warning: Failed to set FRONTEND_URL (non-critical)" -ForegroundColor Yellow
}

Write-Host "Setting API_URL (legacy, for backward compatibility)..." -ForegroundColor Yellow
flyctl secrets set API_URL="https://api.stonecaster.ai" -a $appName
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Warning: Failed to set API_URL (non-critical)" -ForegroundColor Yellow
}

# Set CORS origin if not already set
Write-Host "Setting CORS_ORIGIN..." -ForegroundColor Yellow
flyctl secrets set CORS_ORIGIN="https://stonecaster.ai" -a $appName
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Warning: Failed to set CORS_ORIGIN (may already be set)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "✅ Authentication secrets set successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Configuration Summary:" -ForegroundColor Cyan
Write-Host "   WEB_BASE_URL: https://stonecaster.ai" -ForegroundColor Gray
Write-Host "   API_BASE_URL: https://api.stonecaster.ai" -ForegroundColor Gray
Write-Host "   FRONTEND_URL: https://stonecaster.ai (legacy)" -ForegroundColor Gray
Write-Host "   API_URL: https://api.stonecaster.ai (legacy)" -ForegroundColor Gray
Write-Host "   CORS_ORIGIN: https://stonecaster.ai" -ForegroundColor Gray
Write-Host ""
Write-Host "⚠️  IMPORTANT: The backend needs to be restarted to pick up these changes." -ForegroundColor Yellow
Write-Host "   Run: flyctl deploy --remote-only -a $appName" -ForegroundColor Cyan
Write-Host ""
Write-Host "🔍 To verify the secrets were set:" -ForegroundColor Cyan
Write-Host "   flyctl secrets list -a $appName" -ForegroundColor Gray
Write-Host ""

