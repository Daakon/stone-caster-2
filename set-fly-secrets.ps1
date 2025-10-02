# Set Fly.io secrets for StoneCaster
# This script sets all required secrets for deployment

Write-Host "Setting Fly.io secrets for StoneCaster..." -ForegroundColor Green

# Set Supabase secrets
Write-Host "Setting Supabase secrets..." -ForegroundColor Yellow
flyctl secrets set SUPABASE_URL="https://hwudmbeedmntgqqxrceb.supabase.co" -a stonecaster-api
flyctl secrets set SUPABASE_ANON_KEY="sb_publishable_QKJ2Ji-SjAQJIbs5NITDpw_IMVQ9JDl" -a stonecaster-api
flyctl secrets set SUPABASE_SERVICE_KEY="your_service_key_here" -a stonecaster-api

# Set OpenAI secrets
Write-Host "Setting OpenAI secrets..." -ForegroundColor Yellow
flyctl secrets set OPENAI_API_KEY="your_openai_key_here" -a stonecaster-api
flyctl secrets set PRIMARY_AI_MODEL="gpt-4o-mini" -a stonecaster-api

# Set CORS origin
Write-Host "Setting CORS origin..." -ForegroundColor Yellow
flyctl secrets set CORS_ORIGIN="https://stonecaster.ai" -a stonecaster-api

# Set session secret
Write-Host "Setting session secret..." -ForegroundColor Yellow
flyctl secrets set SESSION_SECRET="your_session_secret_here" -a stonecaster-api

# Set Stripe secrets (if using payments)
Write-Host "Setting Stripe secrets..." -ForegroundColor Yellow
flyctl secrets set STRIPE_SECRET_KEY="your_stripe_secret_key_here" -a stonecaster-api
flyctl secrets set STRIPE_WEBHOOK_SECRET="your_stripe_webhook_secret_here" -a stonecaster-api

# Set Anthropic secrets (if using Claude)
Write-Host "Setting Anthropic secrets..." -ForegroundColor Yellow
flyctl secrets set ANTHROPIC_API_KEY="your_anthropic_key_here" -a stonecaster-api

Write-Host "All secrets set successfully!" -ForegroundColor Green
Write-Host "Run 'flyctl secrets list -a stonecaster-api' to verify" -ForegroundColor Cyan
