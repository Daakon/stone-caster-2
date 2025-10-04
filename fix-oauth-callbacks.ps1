# Fix OAuth Callback URLs for Production
# This script sets the required environment variables for OAuth to work in production

Write-Host "🔧 Fixing OAuth Callback URLs for Production..." -ForegroundColor Green

# Set the OAuth callback URL environment variables
Write-Host "Setting OAuth callback URLs..." -ForegroundColor Yellow
flyctl secrets set FRONTEND_URL="https://stonecaster.ai" -a stonecaster-api
flyctl secrets set API_URL="https://api.stonecaster.ai" -a stonecaster-api

Write-Host "✅ OAuth callback URLs set successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next steps:" -ForegroundColor Cyan
Write-Host "1. Update OAuth provider configurations:" -ForegroundColor White
Write-Host "   - Google: https://api.stonecaster.ai/api/auth/oauth/google/callback" -ForegroundColor Gray
Write-Host "   - GitHub: https://api.stonecaster.ai/api/auth/oauth/github/callback" -ForegroundColor Gray
Write-Host "   - Discord: https://api.stonecaster.ai/api/auth/oauth/discord/callback" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Update Supabase OAuth configuration:" -ForegroundColor White
Write-Host "   - Set redirect URL to: https://api.stonecaster.ai/api/auth/oauth/{provider}/callback" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Redeploy the backend to pick up the new environment variables:" -ForegroundColor White
Write-Host "   flyctl deploy -a stonecaster-api" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Test OAuth authentication in production" -ForegroundColor White
Write-Host ""
Write-Host "🔍 To verify the secrets were set:" -ForegroundColor Cyan
Write-Host "flyctl secrets list -a stonecaster-api" -ForegroundColor Gray
