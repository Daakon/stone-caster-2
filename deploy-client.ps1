# Client deployment script for StoneCaster
# Deploys the React app to Cloudflare

$ErrorActionPreference = "Stop"

Write-Host "Starting StoneCaster client deployment..." -ForegroundColor Green

# Set CI/non-interactive environment variables
$env:CI = "1"
$env:WRANGLER_NON_INTERACTIVE = "1"

function Load-DotEnv {
    param(
        [string]$Path
    )

    $values = @{}
    if (-not (Test-Path $Path)) {
        return $values
    }

    Get-Content $Path | ForEach-Object {
        $line = $_.Trim()
        if ([string]::IsNullOrWhiteSpace($line)) { return }
        if ($line.StartsWith("#")) { return }

        $parts = $line -split '=', 2
        if ($parts.Count -ne 2) { return }

        $key = $parts[0].Trim()
        $value = $parts[1].Trim()

        if ($value.StartsWith('"') -and $value.EndsWith('"')) {
            $value = $value.Substring(1, $value.Length - 2)
        } elseif ($value.StartsWith("'") -and $value.EndsWith("'")) {
            $value = $value.Substring(1, $value.Length - 2)
        }

        if (-not [string]::IsNullOrWhiteSpace($key)) {
            $values[$key] = $value
        }
    }

    return $values
}

$dotenvData = @{}
$dotenvPaths = @()
$dotenvPaths += Join-Path $PSScriptRoot ".env"
$dotenvPaths += Join-Path $PSScriptRoot "frontend\.env"

foreach ($dotenvPath in $dotenvPaths) {
    $loaded = Load-DotEnv -Path $dotenvPath
    foreach ($key in $loaded.Keys) {
        if (-not $dotenvData.ContainsKey($key)) {
            $dotenvData[$key] = $loaded[$key]
        }
    }
}

# Step 1: Validate and use environment variables for client build
Write-Host "Validating client build environment variables..." -ForegroundColor Yellow

# Load optional URL variables (can be inferred from window.location in production)
if (-not $env:VITE_WEB_BASE_URL -and $dotenvData.ContainsKey('VITE_WEB_BASE_URL')) {
    $env:VITE_WEB_BASE_URL = $dotenvData['VITE_WEB_BASE_URL']
}
if (-not $env:VITE_API_BASE_URL -and $dotenvData.ContainsKey('VITE_API_BASE_URL')) {
    $env:VITE_API_BASE_URL = $dotenvData['VITE_API_BASE_URL']
}

# Set production defaults if not provided (will be inferred at runtime if missing)
if (-not $env:VITE_WEB_BASE_URL) {
    $env:VITE_WEB_BASE_URL = "https://stonecaster.ai"
    Write-Host "Using default VITE_WEB_BASE_URL: $($env:VITE_WEB_BASE_URL)" -ForegroundColor Gray
}
if (-not $env:VITE_API_BASE_URL) {
    $env:VITE_API_BASE_URL = "https://api.stonecaster.ai"
    Write-Host "Using default VITE_API_BASE_URL: $($env:VITE_API_BASE_URL)" -ForegroundColor Gray
}

# Require VITE_SUPABASE_URL from environment (allow fallback to .env)
if (-not $env:VITE_SUPABASE_URL -and $dotenvData.ContainsKey('VITE_SUPABASE_URL')) {
    $env:VITE_SUPABASE_URL = $dotenvData['VITE_SUPABASE_URL']
}
if (-not $env:VITE_SUPABASE_URL) {
    Write-Host "ERROR: VITE_SUPABASE_URL environment variable is required!" -ForegroundColor Red
    Write-Host "Set it in your environment or .env file before running this script." -ForegroundColor Yellow
    Write-Host "Example: `$env:VITE_SUPABASE_URL = 'https://your-project.supabase.co'" -ForegroundColor Gray
    exit 1
}

# Require VITE_SUPABASE_PUBLISHABLE_KEY from environment
if (-not $env:VITE_SUPABASE_PUBLISHABLE_KEY -and $dotenvData.ContainsKey('VITE_SUPABASE_PUBLISHABLE_KEY')) {
    $env:VITE_SUPABASE_PUBLISHABLE_KEY = $dotenvData['VITE_SUPABASE_PUBLISHABLE_KEY']
}
if (-not $env:VITE_SUPABASE_ANON_KEY -and $dotenvData.ContainsKey('VITE_SUPABASE_ANON_KEY')) {
    $env:VITE_SUPABASE_ANON_KEY = $dotenvData['VITE_SUPABASE_ANON_KEY']
}
if (-not $env:VITE_SUPABASE_PUBLISHABLE_KEY -and -not $env:VITE_SUPABASE_ANON_KEY) {
    Write-Host "ERROR: VITE_SUPABASE_PUBLISHABLE_KEY or VITE_SUPABASE_ANON_KEY environment variable is required!" -ForegroundColor Red
    Write-Host "Set it in your environment or .env file before running this script." -ForegroundColor Yellow
    exit 1
}

# Use ANON_KEY as fallback for PUBLISHABLE_KEY if needed
if (-not $env:VITE_SUPABASE_PUBLISHABLE_KEY) {
    $env:VITE_SUPABASE_PUBLISHABLE_KEY = $env:VITE_SUPABASE_ANON_KEY
}

Write-Host "Using environment variables for configuration" -ForegroundColor Green
Write-Host "  VITE_WEB_BASE_URL: $($env:VITE_WEB_BASE_URL)" -ForegroundColor Gray
Write-Host "  VITE_API_BASE_URL: $($env:VITE_API_BASE_URL)" -ForegroundColor Gray
Write-Host "  VITE_SUPABASE_URL: $($env:VITE_SUPABASE_URL)" -ForegroundColor Gray

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
