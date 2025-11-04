# deploy-backend.ps1
# Deploys StoneCaster backend to Fly.io using personal access token
# Usage: .\deploy-backend.ps1

$ErrorActionPreference = "Stop"

Write-Host "Starting StoneCaster backend deployment..." -ForegroundColor Cyan
# Helper: robust whoami check that tolerates warnings
function Test-FlyAuth {
    param()
    $oldEA = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $raw = & flyctl auth whoami 2>&1
    $code = $LASTEXITCODE
    $ErrorActionPreference = $oldEA
    $text = ($raw | Out-String).Trim()
    # Treat as authenticated if exit code is 0 OR output looks like an email/uuid/tokens id
    $looksAuthed = (
        $code -eq 0
    ) -or (
        $text -match '@' -or $text -match 'tokens\.fly\.io' -or $text -match '^[a-f0-9-]{36}$'
    )
    [PSCustomObject]@{ Ok = $looksAuthed; Code = $code; Text = $text }
}
# 0. Load .env file if it exists (project root)
$projectRoot = Get-Location
$envPath = Join-Path $projectRoot ".env"

if (Test-Path $envPath) {
    Write-Host "Loading environment variables from .env file..." -ForegroundColor Gray
    Get-Content $envPath | ForEach-Object {
        # Skip empty lines and comments
        if ($_ -match '^\s*#' -or $_ -match '^\s*$') {
            return
        }
        
        # Parse KEY=VALUE or KEY="VALUE WITH SPACES"
        if ($_ -match '^\s*([^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            
            # Remove surrounding quotes if present
            if ($value.Length -ge 2) {
                if (($value.StartsWith('"') -and $value.EndsWith('"')) -or 
                    ($value.StartsWith("'") -and $value.EndsWith("'"))) {
                    $value = $value.Substring(1, $value.Length - 2)
                }
            }
            
            # Only set if not already set (environment variable takes precedence)
            if (-not (Get-Item "Env:$key" -ErrorAction SilentlyContinue)) {
                Set-Item -Path "Env:$key" -Value $value
            }
        }
    }
    Write-Host "Loaded .env file" -ForegroundColor Gray
} else {
    Write-Host "No .env file found at $envPath, using environment variables only" -ForegroundColor Gray
}

# 1. Token optional (SSO orgs)
if (-not $env:FLY_ACCESS_TOKEN) {
    Write-Host ""
    Write-Host "No FLY_ACCESS_TOKEN detected; using interactive Fly session." -ForegroundColor Gray
}

# 2. Verify flyctl is installed (robust, ignore warnings)
$flyBin = Get-Command flyctl -ErrorAction SilentlyContinue
if (-not $flyBin) {
    # Fallback to default user install path if PATH not refreshed yet
    $defaultFly = Join-Path $env:USERPROFILE "AppData\Local\fly\bin\flyctl.exe"
    if (Test-Path $defaultFly) {
        $env:PATH = (Split-Path $defaultFly) + ";" + $env:PATH
        $flyBin = Get-Command flyctl -ErrorAction SilentlyContinue
    }
}
if (-not $flyBin) {
    Write-Host ""
    Write-Host "ERROR: flyctl not found on PATH." -ForegroundColor Red
    Write-Host "Install from: https://fly.io/docs/hands-on/install-flyctl/ or restart your shell." -ForegroundColor Yellow
    exit 1
} else {
    # Log version without treating warnings as fatal
    $oldEA = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $verOut = & flyctl version 2>&1 | Out-String
    $ErrorActionPreference = $oldEA
    if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($verOut)) {
        $first = ($verOut -split "`n")[0].Trim()
        Write-Host "Using flyctl: $first" -ForegroundColor Gray
    } else {
        Write-Host "flyctl detected." -ForegroundColor Gray
    }
}

# 3. Normalize Fly token and set FLY_API_TOKEN
function Normalize-FlyToken {
    param([string]$raw)
    if ([string]::IsNullOrWhiteSpace($raw)) { return $null }
    $t = $raw.Trim()
    if ($t -notmatch '^FlyV1\s') {
        if ($t -match ',') { $t = 'FlyV1 ' + $t }
        elseif ($t -match '^fm2_') { $t = 'FlyV1 ' + $t }
    }
    return $t
}
$normApi = Normalize-FlyToken $env:FLY_API_TOKEN
$normAcc = Normalize-FlyToken $env:FLY_ACCESS_TOKEN
if (-not [string]::IsNullOrWhiteSpace($normApi)) {
    $env:FLY_API_TOKEN = $normApi
} elseif (-not [string]::IsNullOrWhiteSpace($normAcc)) {
    $env:FLY_API_TOKEN = $normAcc
}
if (-not [string]::IsNullOrWhiteSpace($normAcc)) { $env:FLY_ACCESS_TOKEN = $normAcc }

# 4. Verify authentication (tolerate metrics warnings)
Write-Host "Verifying authentication..." -ForegroundColor Yellow
$auth = Test-FlyAuth
if (-not $auth.Ok) {
    Write-Host "Not authenticated. Starting Fly login..." -ForegroundColor Yellow
    # If env tokens are set, they override session auth and can break whoami; clear for this process
    if ($env:FLY_ACCESS_TOKEN -or $env:FLY_API_TOKEN -or $env:FLY_TOKEN) {
        Write-Host "Clearing FLY_* token env vars for interactive login..." -ForegroundColor Gray
        $env:FLY_ACCESS_TOKEN = $null
        $env:FLY_API_TOKEN    = $null
        $env:FLY_TOKEN        = $null
    }
    # Use --headless only if supported by this flyctl version
    $helpEA = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $loginHelp = & flyctl auth login --help 2>&1 | Out-String
    $ErrorActionPreference = $helpEA
    if ($loginHelp -match "--headless") { & flyctl auth login --headless } else { & flyctl auth login }
    $auth = Test-FlyAuth
    if (-not $auth.Ok) {
        Write-Host ""; Write-Host "ERROR: Authentication failed." -ForegroundColor Red
        Write-Host "Login did not complete successfully. Please try again." -ForegroundColor Yellow
        Write-Host "whoami output: $($auth.Text)" -ForegroundColor Gray
        exit 1
    }
}
$whoami = ($auth.Text -split "`n")[0].Trim()
Write-Host "Authenticated as: $whoami" -ForegroundColor Green

# 5. Refresh Docker registry credentials
Write-Host "Refreshing Docker registry credentials..." -ForegroundColor Yellow
try {
    flyctl auth docker 2>&1 | Out-Null
    Write-Host "Registry credentials refreshed." -ForegroundColor Green
} catch {
    Write-Host "Warning: Could not refresh registry credentials, continuing anyway..." -ForegroundColor Yellow
}

# 6. Verify app exists and is accessible (detect org automatically)
$AppName = "stonecaster-api"
Write-Host "Checking app '$AppName'..." -ForegroundColor Yellow

# Try to detect the owner/org from apps list
$owner = $null
$oldEA = $ErrorActionPreference; $ErrorActionPreference = "Continue"
$appsOut = & flyctl apps list 2>&1
$ErrorActionPreference = $oldEA
if ($appsOut) {
    $pattern = "^\s*" + [regex]::Escape($AppName) + "\s+(\S+)"
    $line = ($appsOut | Where-Object { $_ -match "^\s*$AppName\s+" } | Select-Object -First 1)
    if ($line -and ($line -match $pattern)) { $owner = $matches[1] }
}
if ($owner) { Write-Host "Detected owner/org: $owner" -ForegroundColor Gray }

# Status is best-effort (app names are global; org not required when using --app)
$oldEA = $ErrorActionPreference; $ErrorActionPreference = "Continue"
$null = & flyctl status --app $AppName 2>&1
$statusCode = $LASTEXITCODE
$ErrorActionPreference = $oldEA
if ($statusCode -ne 0) { Write-Host "Warning: Could not fetch status for '$AppName' (continuing)..." -ForegroundColor Yellow }
# 7. Verify we're in the project root (where fly.toml and Dockerfile are)
# Use current working directory (script should be run from project root)
# Note: $projectRoot was already set above when loading .env

$flyTomlPath = Join-Path $projectRoot "fly.toml"
if (-not (Test-Path $flyTomlPath)) {
    Write-Host ""
    Write-Host "ERROR: fly.toml not found in project root." -ForegroundColor Red
    Write-Host "Expected: $flyTomlPath" -ForegroundColor Yellow
    Write-Host "Current directory: $(Get-Location)" -ForegroundColor Yellow
    Write-Host "Please run this script from the project root directory." -ForegroundColor Yellow
    exit 1
}

$dockerfilePath = Join-Path $projectRoot "Dockerfile"
if (-not (Test-Path $dockerfilePath)) {
    Write-Host ""
    Write-Host "ERROR: Dockerfile not found in project root." -ForegroundColor Red
    Write-Host "Expected: $dockerfilePath" -ForegroundColor Yellow
    Write-Host "Please run this script from the project root directory." -ForegroundColor Yellow
    exit 1
}

# 8. Deploy to Fly.io
Write-Host ""
Write-Host "Deploying backend to Fly.io (remote build)..." -ForegroundColor Cyan
Write-Host "App: $AppName" -ForegroundColor Gray
if ($owner) { Write-Host "Org: $owner" -ForegroundColor Gray }
Write-Host "Project root: $projectRoot" -ForegroundColor Gray
Write-Host "Build: Remote builder (with 401 retry + local-aware fallback)" -ForegroundColor Gray
Write-Host ""

# Keep env token for first attempt; we'll only clear on interactive re-auth if needed
$prevFlyAccess = $env:FLY_ACCESS_TOKEN
$prevFlyApi    = $env:FLY_API_TOKEN
$prevFlyToken  = $env:FLY_TOKEN

# Detect if local Docker engine is available for potential fallback
$dockerAvailable = $false
try { docker info 2>&1 | Out-Null; if ($LASTEXITCODE -eq 0) { $dockerAvailable = $true } } catch { }

$maxRetries = 2
$attempt = 0
$deploySuccess = $false

while (-not $deploySuccess -and $attempt -lt $maxRetries) {
    $attempt++
    Write-Host "Remote deploy attempt $attempt/$maxRetries..." -ForegroundColor Cyan

    # Capture deploy output for error inspection
    $oldEA = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    # Disable Depot remote builder to avoid registry 401s; use legacy remote builder
    $deployOutput = & flyctl deploy --app $AppName --remote-only --now --depot=false 2>&1
    $deployCode = $LASTEXITCODE
    $ErrorActionPreference = $oldEA

    $deployText = ($deployOutput | Out-String)
    $isUnauthorized = ($deployCode -ne 0) -and ($deployText -match "401|Unauthorized|DENIED")

    if ($deployCode -eq 0) {
        $deploySuccess = $true
        break
    }

    if ($isUnauthorized -and $attempt -lt $maxRetries) {
        Write-Host "Detected 401/Unauthorized from registry during remote build." -ForegroundColor Yellow
        Write-Host "Refreshing Fly auth and retrying remote deploy..." -ForegroundColor Yellow

        # Aggressively refresh auth
        $__oldEA = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        $null = flyctl auth logout 2>&1
        $ErrorActionPreference = $__oldEA
        Start-Sleep -Seconds 1

        # Clear any env token variables before login to avoid flyctl warnings
        $env:FLY_ACCESS_TOKEN = $null
        $env:FLY_API_TOKEN    = $null
        $env:FLY_TOKEN        = $null

        try {
            if ($prevFlyAccess) {
                # Re-auth using existing token if available
                $env:FLY_API_TOKEN = $prevFlyAccess
                $__oldEA2 = $ErrorActionPreference
                $ErrorActionPreference = 'Continue'
                $null = & flyctl auth whoami 2>&1
                $ErrorActionPreference = $__oldEA2
            } else {
                flyctl auth login
            }
        } catch {
            Write-Host "Re-authentication failed; will prompt for interactive login..." -ForegroundColor Yellow
            flyctl auth login
        }

        try { flyctl auth docker 2>&1 | Out-Null } catch { }

        continue
    }

    # Non-auth related failure: log output and break to fallback
    Write-Host "Remote deploy failed (exit $deployCode)." -ForegroundColor Yellow
    Write-Host "Remote deploy output:" -ForegroundColor Gray
    $deployOutput | ForEach-Object { Write-Host $_ }
    break
}

if (-not $deploySuccess) {
    if ($dockerAvailable) {
        Write-Host "Falling back to local build and push..." -ForegroundColor Yellow
        try {
            # Restore token env for local auth if we had one
            if ($prevFlyAccess) { $env:FLY_API_TOKEN = $prevFlyAccess }

            # Ensure Docker registry creds are present for local push
            try { flyctl auth docker 2>&1 | Out-Null } catch { }

            flyctl deploy --app $AppName --local-only --now
            if ($LASTEXITCODE -ne 0) { throw "Local deploy failed with exit code $LASTEXITCODE" }
            $deploySuccess = $true
        } catch {
            Write-Host ""; Write-Host "ERROR: Deployment failed." -ForegroundColor Red
            Write-Host $_.Exception.Message -ForegroundColor Yellow
            Write-Host ""
            Write-Host "Recent logs:" -ForegroundColor Yellow
            try { flyctl logs --app $AppName --no-tail 2>&1 | Select-Object -Last 20 } catch { Write-Host "Could not fetch logs." -ForegroundColor Gray }
            exit 1
        }
    } else {
        Write-Host "Docker is not available; skipping local fallback." -ForegroundColor Yellow
        Write-Host "Attempting interactive re-auth and remote deploy..." -ForegroundColor Yellow
        try {
            flyctl auth logout 2>&1 | Out-Null
            flyctl auth login
            $oldEA = $ErrorActionPreference
            $ErrorActionPreference = "Continue"
            # Disable Depot on re-auth attempt as well
            $deployOutput = & flyctl deploy --app $AppName --remote-only --now --depot=false 2>&1
            $deployCode = $LASTEXITCODE
            $ErrorActionPreference = $oldEA
            if ($deployCode -ne 0) {
                Write-Host "Remote deploy failed after re-auth (exit $deployCode)" -ForegroundColor Yellow
                Write-Host "Remote deploy output:" -ForegroundColor Gray
                $deployOutput | ForEach-Object { Write-Host $_ }
                throw "Remote deploy failed after re-auth"
            }
            $deploySuccess = $true
        } catch {
            Write-Host ""; Write-Host "ERROR: Deployment failed." -ForegroundColor Red
            Write-Host $_.Exception.Message -ForegroundColor Yellow
            Write-Host ""
            Write-Host "Hints:" -ForegroundColor Yellow
            Write-Host " - Update flyctl: flyctl version update" -ForegroundColor Gray
            Write-Host " - Check org/app access: flyctl orgs list; flyctl status -a $AppName" -ForegroundColor Gray
            Write-Host " - Switch org if needed: flyctl auth switch --org <org>" -ForegroundColor Gray
            Write-Host ""
            Write-Host "Recent logs:" -ForegroundColor Yellow
            try { flyctl logs --app $AppName --no-tail 2>&1 | Select-Object -Last 20 } catch { Write-Host "Could not fetch logs." -ForegroundColor Gray }
            exit 1
        }
    }
}

Write-Host ""
Write-Host "Deployment completed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "App URL: https://$AppName.fly.dev" -ForegroundColor Cyan

# 1. Token optional (SSO orgs)
if (-not $env:FLY_ACCESS_TOKEN) {
    Write-Host ""
    Write-Host "No FLY_ACCESS_TOKEN detected; using interactive Fly session." -ForegroundColor Gray
}

# 2. Verify flyctl is installed (robust, ignore warnings)
$flyBin = Get-Command flyctl -ErrorAction SilentlyContinue
if (-not $flyBin) {
    # Fallback to default user install path if PATH not refreshed yet
    $defaultFly = Join-Path $env:USERPROFILE "AppData\Local\fly\bin\flyctl.exe"
    if (Test-Path $defaultFly) {
        $env:PATH = (Split-Path $defaultFly) + ";" + $env:PATH
        $flyBin = Get-Command flyctl -ErrorAction SilentlyContinue
    }
}
if (-not $flyBin) {
    Write-Host ""
    Write-Host "ERROR: flyctl not found on PATH." -ForegroundColor Red
    Write-Host "Install from: https://fly.io/docs/hands-on/install-flyctl/ or restart your shell." -ForegroundColor Yellow
    exit 1
} else {
    # Log version without treating warnings as fatal
    $oldEA = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $verOut = & flyctl version 2>&1 | Out-String
    $ErrorActionPreference = $oldEA
    if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($verOut)) {
        $first = ($verOut -split "`n")[0].Trim()
        Write-Host "Using flyctl: $first" -ForegroundColor Gray
    } else {
        Write-Host "flyctl detected." -ForegroundColor Gray
    }
}

# 3. Normalize Fly token and set FLY_API_TOKEN
function Normalize-FlyToken {
    param([string]$raw)
    if ([string]::IsNullOrWhiteSpace($raw)) { return $null }
    $t = $raw.Trim()
    if ($t -notmatch '^FlyV1\s') {
        if ($t -match ',') { $t = 'FlyV1 ' + $t }
        elseif ($t -match '^fm2_') { $t = 'FlyV1 ' + $t }
    }
    return $t
}
$normApi = Normalize-FlyToken $env:FLY_API_TOKEN
$normAcc = Normalize-FlyToken $env:FLY_ACCESS_TOKEN
if (-not [string]::IsNullOrWhiteSpace($normApi)) {
    $env:FLY_API_TOKEN = $normApi
} elseif (-not [string]::IsNullOrWhiteSpace($normAcc)) {
    $env:FLY_API_TOKEN = $normAcc
}
if (-not [string]::IsNullOrWhiteSpace($normAcc)) { $env:FLY_ACCESS_TOKEN = $normAcc }

# 4. Verify authentication (tolerate metrics warnings)
Write-Host "Verifying authentication..." -ForegroundColor Yellow
$auth = Test-FlyAuth
if (-not $auth.Ok) {
    Write-Host "Not authenticated. Starting Fly login..." -ForegroundColor Yellow
    # Use --headless only if supported by this flyctl version
    $helpEA = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $loginHelp = & flyctl auth login --help 2>&1 | Out-String
    $ErrorActionPreference = $helpEA
    if ($loginHelp -match "--headless") { & flyctl auth login --headless } else { & flyctl auth login }
    $auth = Test-FlyAuth
    if (-not $auth.Ok) {
        Write-Host ""; Write-Host "ERROR: Authentication failed." -ForegroundColor Red
        Write-Host "Login did not complete successfully. Please try again." -ForegroundColor Yellow
        Write-Host "whoami output: $($auth.Text)" -ForegroundColor Gray
        exit 1
    }
}
$whoami = ($auth.Text -split "`n")[0].Trim()
Write-Host "Authenticated as: $whoami" -ForegroundColor Green

# 5. Refresh Docker registry credentials
Write-Host "Refreshing Docker registry credentials..." -ForegroundColor Yellow
try {
    flyctl auth docker 2>&1 | Out-Null
    Write-Host "Registry credentials refreshed." -ForegroundColor Green
} catch {
    Write-Host "Warning: Could not refresh registry credentials, continuing anyway..." -ForegroundColor Yellow
}

# 6. Verify app exists and is accessible
$AppName = "stonecaster-api"
Write-Host "Checking app '$AppName'..." -ForegroundColor Yellow
try {
    flyctl status --app $AppName 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "status check failed"
    }
} catch {
    Write-Host ""
    Write-Host "ERROR: Cannot access app '$AppName'." -ForegroundColor Red
    Write-Host "The app may not exist or you may not have access to it." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Verify app name and organization:" -ForegroundColor Yellow
    Write-Host "  flyctl apps list" -ForegroundColor White
    exit 1
}
