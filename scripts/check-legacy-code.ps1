# Check Legacy Code (PowerShell)
# Blocks legacy prompting code patterns from being reintroduced

$ErrorActionPreference = "Stop"

Write-Host "🔍 Checking for legacy code patterns..." -ForegroundColor Cyan

$exitCode = 0

# Block patterns
$blockPatterns = @(
    "prompt_segments_for_context",
    "prompting\.prompts\b",
    "prompting\.prompt_segments\b",
    "buildPrompt\("  # Allow only in tests/fixtures/legacy/**
)

# Search in backend/src (exclude node_modules and dist)
foreach ($pattern in $blockPatterns) {
    Write-Host "  Checking for: $pattern" -ForegroundColor Gray
    
    $matches = Get-ChildItem -Path "backend/src" -Recurse -Include "*.ts", "*.tsx" `
        | Select-String -Pattern $pattern `
        | Where-Object { $_.Path -notmatch "node_modules|dist" }
    
    if ($matches) {
        Write-Host "❌ ERROR: Found legacy pattern '$pattern' in backend/src" -ForegroundColor Red
        $matches | ForEach-Object { Write-Host "  $($_.Path):$($_.LineNumber): $($_.Line.Trim())" -ForegroundColor Yellow }
        $exitCode = 1
    }
}

# Check for initial-prompt route strings
$initialPromptMatches = Get-ChildItem -Path "backend/src" -Recurse -Include "*.ts", "*.tsx" `
    | Select-String -Pattern "initial-prompt" `
    | Where-Object { $_.Path -notmatch "node_modules|dist" }

if ($initialPromptMatches) {
    Write-Host "❌ ERROR: Found 'initial-prompt' route reference in backend/src" -ForegroundColor Red
    $initialPromptMatches | ForEach-Object { Write-Host "  $($_.Path):$($_.LineNumber): $($_.Line.Trim())" -ForegroundColor Yellow }
    $exitCode = 1
}

# Check for scope: 'scenario' in new code
$scenarioMatches = Get-ChildItem -Path "backend/src" -Recurse -Include "*.ts", "*.tsx" `
    | Select-String -Pattern "scope:\s*['\""]scenario['\""]" `
    | Where-Object { $_.Path -notmatch "node_modules|dist" }

if ($scenarioMatches) {
    Write-Host "❌ ERROR: Found scope:'scenario' in backend/src (use scope:'entry' instead)" -ForegroundColor Red
    $scenarioMatches | ForEach-Object { Write-Host "  $($_.Path):$($_.LineNumber): $($_.Line.Trim())" -ForegroundColor Yellow }
    $exitCode = 1
}

if ($exitCode -eq 0) {
    Write-Host "✅ No legacy code patterns found" -ForegroundColor Green
} else {
    Write-Host "❌ Legacy code patterns detected. See docs/deprecations/prompting-legacy-decomm.md" -ForegroundColor Red
}

exit $exitCode
