<#
.SYNOPSIS
  Recomputes hashes for the files tracked in docs/testing/phase0-config-snapshot.json
  and reports whether anything changed.

.DESCRIPTION
  Run from the repo root:
    pwsh -NoProfile -File scripts/tools/check-phase0-config.ps1

  Pass -Update to refresh the snapshot file after intentionally modifying config.
#>
[CmdletBinding()]
param(
  [string]$SnapshotPath = "docs/testing/phase0-config-snapshot.json",
  [switch]$Update
)

$ErrorActionPreference = 'Stop'

if (!(Test-Path -Path $SnapshotPath)) {
  throw "Snapshot file not found: $SnapshotPath"
}

$snapshot = Get-Content -Raw -Path $SnapshotPath | ConvertFrom-Json
if (-not $snapshot.files) {
  throw "Snapshot file is missing the 'files' array."
}

function Get-FileFingerprint {
  param(
    [string]$RelativePath
  )

  if (!(Test-Path -Path $RelativePath)) {
    return [pscustomobject]@{
      path         = $RelativePath
      exists       = $false
      size         = $null
      lastWriteUtc = $null
      sha256       = $null
    }
  }

  $item = Get-Item -LiteralPath $RelativePath
  $hash = Get-FileHash -LiteralPath $RelativePath -Algorithm SHA256

  return [pscustomobject]@{
    path         = $RelativePath
    exists       = $true
    size         = $item.Length
    lastWriteUtc = $item.LastWriteTimeUtc.ToString("o")
    sha256       = $hash.Hash
  }
}

$differences = @()
$currentFingerprints = @()

foreach ($fileEntry in $snapshot.files) {
  $current = Get-FileFingerprint -RelativePath $fileEntry.path
  $currentFingerprints += $current

  $changed =
    ($current.exists -ne $true) -or
    ($fileEntry.sha256 -ne $current.sha256) -or
    ($fileEntry.size -ne $current.size) -or
    ($fileEntry.lastWriteUtc -ne $current.lastWriteUtc)

  if ($changed) {
    $differences += [pscustomobject]@{
      path       = $fileEntry.path
      snapshot   = $fileEntry.sha256
      current    = $current.sha256
      status     = if (-not $current.exists) { "missing" } else { "changed" }
    }
  }
}

if ($Update) {
  $newSnapshot = [pscustomobject]@{
    generatedAtUtc = (Get-Date).ToUniversalTime().ToString("o")
    files          = @()
  }

  foreach ($current in $currentFingerprints) {
    $newSnapshot.files += [pscustomobject]@{
      path         = $current.path
      size         = $current.size
      lastWriteUtc = $current.lastWriteUtc
      sha256       = $current.sha256
    }
  }

  $json = $newSnapshot | ConvertTo-Json -Depth 6
  Set-Content -Path $SnapshotPath -Value $json -Encoding UTF8
  Write-Host "Snapshot updated -> $SnapshotPath"
  exit 0
}

if ($differences.Count -eq 0) {
  Write-Host "All tracked config files match the snapshot." -ForegroundColor Green
  exit 0
}

Write-Warning "Detected differences in tracked config files:"
$differences | Format-Table -AutoSize
exit 1
