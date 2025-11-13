# Set Fly.io secrets for StoneCaster
# This script sets all required secrets for deployment

Write-Host "Setting Fly.io secrets for StoneCaster..." -ForegroundColor Green

# Set Supabase secrets
Write-Host "Setting Supabase secrets..." -ForegroundColor Yellow

# Require SUPABASE_URL from environment (no hardcoded values allowed)
if (-not $env:SUPABASE_URL) {
    Write-Host "ERROR: SUPABASE_URL environment variable is required!" -ForegroundColor Red
    Write-Host "Set it in your environment before running this script." -ForegroundColor Yellow
    Write-Host "Example: `$env:SUPABASE_URL = 'https://your-project.supabase.co'" -ForegroundColor Gray
    exit 1
}

# Require SUPABASE_ANON_KEY from environment
if (-not $env:SUPABASE_ANON_KEY) {
    Write-Host "ERROR: SUPABASE_ANON_KEY environment variable is required!" -ForegroundColor Red
    Write-Host "Set it in your environment before running this script." -ForegroundColor Yellow
    exit 1
}

# Require SUPABASE_SERVICE_KEY from environment
if (-not $env:SUPABASE_SERVICE_KEY -and -not $env:SUPABASE_SERVICE_ROLE_KEY) {
    Write-Host "ERROR: SUPABASE_SERVICE_KEY or SUPABASE_SERVICE_ROLE_KEY environment variable is required!" -ForegroundColor Red
    Write-Host "Set it in your environment before running this script." -ForegroundColor Yellow
    exit 1
}

# Use SERVICE_ROLE_KEY as fallback for SERVICE_KEY if needed
$serviceKey = $env:SUPABASE_SERVICE_KEY
if (-not $serviceKey) {
    $serviceKey = $env:SUPABASE_SERVICE_ROLE_KEY
}

flyctl secrets set SUPABASE_URL="$env:SUPABASE_URL" -a stonecaster-api
flyctl secrets set SUPABASE_ANON_KEY="$env:SUPABASE_ANON_KEY" -a stonecaster-api
flyctl secrets set SUPABASE_SERVICE_KEY="$serviceKey" -a stonecaster-api

# Set OpenAI secrets
Write-Host "Setting OpenAI secrets..." -ForegroundColor Yellow
flyctl secrets set OPENAI_API_KEY="your_openai_key_here" -a stonecaster-api
flyctl secrets set PRIMARY_AI_MODEL="gpt-4o-mini" -a stonecaster-api

# Set CORS origin
Write-Host "Setting CORS origin..." -ForegroundColor Yellow
flyctl secrets set CORS_ORIGIN="https://stonecaster.ai" -a stonecaster-api

# Set OAuth callback URLs
Write-Host "Setting OAuth callback URLs..." -ForegroundColor Yellow
flyctl secrets set FRONTEND_URL="https://stonecaster.ai" -a stonecaster-api
flyctl secrets set API_URL="https://api.stonecaster.ai" -a stonecaster-api

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

# Set Cloudflare Images secrets (if using media uploads)
Write-Host "Setting Cloudflare Images secrets..." -ForegroundColor Yellow
if ($env:CF_ACCOUNT_ID -and $env:CF_API_TOKEN -and $env:CF_IMAGES_ACCOUNT_HASH -and $env:CF_IMAGES_DELIVERY_URL) {
    flyctl secrets set CF_ACCOUNT_ID="$env:CF_ACCOUNT_ID" -a stonecaster-api
    flyctl secrets set CF_API_TOKEN="$env:CF_API_TOKEN" -a stonecaster-api
    flyctl secrets set CF_IMAGES_ACCOUNT_HASH="$env:CF_IMAGES_ACCOUNT_HASH" -a stonecaster-api
    flyctl secrets set CF_IMAGES_DELIVERY_URL="$env:CF_IMAGES_DELIVERY_URL" -a stonecaster-api
    Write-Host "Cloudflare Images secrets set successfully" -ForegroundColor Green
} else {
    Write-Host "WARNING: Cloudflare Images secrets not set. Set CF_ACCOUNT_ID, CF_API_TOKEN, CF_IMAGES_ACCOUNT_HASH, and CF_IMAGES_DELIVERY_URL environment variables to enable." -ForegroundColor Yellow
}

Write-Host "All secrets set successfully!" -ForegroundColor Green
Write-Host "Run 'flyctl secrets list -a stonecaster-api' to verify" -ForegroundColor Cyan
