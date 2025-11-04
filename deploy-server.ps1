# deploy-server.ps1

$ErrorActionPreference = "Stop"

Write-Host "Starting StoneCaster server deployment..."

# 1) Aggressively clean ALL token sources for this process
# Clear environment variables
Remove-Item Env:FLY_ACCESS_TOKEN -ErrorAction SilentlyContinue
Remove-Item Env:FLY_API_TOKEN   -ErrorAction SilentlyContinue
Remove-Item Env:FLY_TOKEN -ErrorAction SilentlyContinue

# Clear flyctl's cached tokens by forcing logout
Write-Host "Clearing any cached authentication..."
# Tolerate flyctl logout warnings (e.g., metrics token unavailable) without failing
$__oldEA = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
$__logoutOutput = & flyctl auth logout 2>&1
$__logoutCode = $LASTEXITCODE
$ErrorActionPreference = $__oldEA
if ($__logoutCode -ne 0) {
  Write-Host "flyctl auth logout returned code $__logoutCode; continuing..." -ForegroundColor Yellow
}

# 2) Ensure flyctl is installed & recent enough
try {
  $flyctlVersion = flyctl version
  Write-Host "Using flyctl: $flyctlVersion" -ForegroundColor Gray
  Write-Host "Note: If you see 401 errors, try updating: flyctl version update" -ForegroundColor Gray
} catch {
  Write-Error "flyctl not found. Install from https://fly.io/docs/hands-on/install-flyctl/ and re-run."
  exit 1
}

# 3) Fresh auth flow - ensure no tokens are present
Write-Host "Verifying no stale tokens are present..."
$env:FLY_ACCESS_TOKEN = $null
$env:FLY_API_TOKEN = $null
$env:FLY_TOKEN = $null

Write-Host "Logging in to Fly.io (interactive login required)..."
flyctl auth login

Write-Host "Verifying login..."
try {
  $who = flyctl auth whoami
  Write-Host "Authenticated as: $who"
} catch {
  Write-Error "Login appears invalid (whoami failed). Please try logging in again."
  exit 1
}

# Refresh registry credentials for Docker/Depot builds
Write-Host "Refreshing registry credentials for Docker builds..." -ForegroundColor Yellow
try {
  flyctl auth docker 2>&1 | Out-Null
  Write-Host "Registry credentials refreshed." -ForegroundColor Green
} catch {
  Write-Host "Warning: Could not refresh registry credentials, but continuing..." -ForegroundColor Yellow
}

# 4) Verify app/org
$AppName = "stonecaster-api"
Write-Host "Checking app status for '$AppName'..."
try {
  flyctl status -a $AppName | Out-Null
} catch {
  Write-Host "Listing orgs for context:"
  flyctl orgs list
  Write-Error "Could not access app '$AppName'. Wrong org or app name? Update fly.toml and/or switch org: flyctl auth switch --org <org>"
  exit 1
}

# 5) Remote-only deploy (no local Docker required)
# Ensure no token env vars are set during deploy - use ONLY interactive session
$env:FLY_ACCESS_TOKEN = $null
$env:FLY_API_TOKEN = $null
$env:FLY_TOKEN = $null

Write-Host "Deploying server to Fly.io (remote build)..." -ForegroundColor Cyan
Write-Host "Note: Using authenticated session from flyctl config (no token env vars)"

$maxRetries = 2
$retryCount = 0
$deploySuccess = $false

# Only retry the deploy step, not the full process
while ($retryCount -lt $maxRetries -and -not $deploySuccess) {
  Write-Host "Deployment attempt $($retryCount + 1)/$maxRetries..." -ForegroundColor Cyan
  
  # Capture output without PowerShell treating it as errors
  # Temporarily disable error action to capture all output
  $deployOutput = ""
  $deployExitCode = 0
  
  # Save current error action preference
  $oldErrorAction = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  
  try {
    # Run deploy and capture all output (stdout and stderr)
    # Force legacy remote builder to avoid Depot registry 401s
    $deployOutput = & flyctl deploy -a $AppName --remote-only --depot=false 2>&1
    $deployExitCode = $LASTEXITCODE
    
    # Convert error records to strings
    $deployOutput = $deployOutput | ForEach-Object {
      if ($_ -is [System.Management.Automation.ErrorRecord]) {
        $_.ToString()
      } else {
        $_
      }
    }
  } catch {
    # PowerShell exception - convert to string
    $deployOutput = $_.Exception.Message
    $deployExitCode = 1
  } finally {
    # Restore error action preference
    $ErrorActionPreference = $oldErrorAction
  }
  
  # Capture output as string for pattern matching
  $deployOutputString = $deployOutput | Out-String
  
  # Check for 401/Unauthorized errors (case-insensitive)
  $isAuthError = ($deployOutputString -match "401|Unauthorized") -and $deployExitCode -ne 0
  
  if ($isAuthError) {
    Write-Host ""
    Write-Host "⚠️  Authentication error detected during deployment (401 Unauthorized)" -ForegroundColor Yellow
    Write-Host "The registry token may be stale even though API auth works." -ForegroundColor Yellow
    
    if ($retryCount -lt $maxRetries - 1) {
      # Check if API auth still works (whoami)
      Write-Host "Checking if API authentication is still valid..." -ForegroundColor Yellow
      try {
        $who = flyctl auth whoami
        Write-Host "API auth still valid: $who" -ForegroundColor Green
        Write-Host "Registry token may be stale. Re-authenticating to refresh..." -ForegroundColor Yellow
      } catch {
        Write-Host "API auth also lost. Re-authenticating..." -ForegroundColor Yellow
      }
      
      # Re-login to refresh registry token (even if API auth works)
      Write-Host "Please log in again when prompted:" -ForegroundColor Yellow
      
      # Aggressively clear all auth state
      flyctl auth logout 2>&1 | Out-Null
      
      # Clear flyctl config file if it exists (may contain stale registry tokens)
      $flyConfigPath = "$env:USERPROFILE\.fly\config.yml"
      if (Test-Path $flyConfigPath) {
        Write-Host "Clearing flyctl config cache..." -ForegroundColor Yellow
        Remove-Item $flyConfigPath -Force -ErrorAction SilentlyContinue
      }
      
      Start-Sleep -Seconds 2
      flyctl auth login
      
      # Verify re-authentication
      Write-Host "Verifying new authentication..."
      try {
        $who = flyctl auth whoami
        Write-Host "Re-authenticated as: $who" -ForegroundColor Green
      } catch {
        Write-Error "Re-authentication failed. Please try manually: flyctl auth logout && flyctl auth login"
        exit 1
      }
      
      # Force refresh registry credentials specifically
      Write-Host "Refreshing registry credentials for Docker builds..." -ForegroundColor Yellow
      try {
        flyctl auth docker 2>&1 | Out-Null
        Write-Host "Registry credentials refreshed." -ForegroundColor Green
      } catch {
        Write-Host "Warning: Could not refresh registry credentials" -ForegroundColor Yellow
      }
      
      # Also verify API access
      flyctl status -a $AppName | Out-Null
      
      $retryCount++
      Write-Host "Retrying deployment step only (not full process)..." -ForegroundColor Yellow
      Write-Host ""
      continue
    } else {
      Write-Error "Authentication failed after $maxRetries deployment attempts."
      Write-Host "The deployment step failed with 401 errors." -ForegroundColor Yellow
      Write-Host "Please manually run:" -ForegroundColor Yellow
      Write-Host "  flyctl auth logout" -ForegroundColor Yellow
      Write-Host "  flyctl auth login" -ForegroundColor Yellow
      Write-Host "  .\deploy-server.ps1" -ForegroundColor Yellow
      exit 1
    }
  } elseif ($deployExitCode -eq 0) {
    # Success!
    $deploySuccess = $true
    Write-Host "Deploy complete." -ForegroundColor Green
    Write-Host "Recent logs:"
    flyctl logs -a $AppName --no-tail 2>&1 | Select-Object -Last 30
  } else {
    # Other error, not auth-related
    Write-Error "Server deployment failed with exit code $deployExitCode"
    Write-Host "Deploy output:"
    $deployOutput
    Write-Host ""
    Write-Host "Last logs to help diagnose:"
    flyctl logs -a $AppName --no-tail 2>&1 | Select-Object -Last 30
    exit 1
  }
}
