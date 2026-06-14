# install-scan.ps1 — Windows-native pre-install vulnerability scanner.
#
# Mirrors install-scan.sh for Windows / PowerShell environments.
# Queries OSV.dev + CISA KEV. Advisory by default; enforcing if INSTALL_SCAN_MODE=enforcing.

[CmdletBinding()]
param(
    [Parameter(Mandatory, Position=0)] [string] $Manager,
    [Parameter(Position=1, ValueFromRemainingArguments)] [string[]] $ScanArgs
)

$ErrorActionPreference = 'Continue'
$script:Version = '1.0.0'

if ($env:INSTALL_SCAN_DISABLE -eq '1' -or $env:INSTALL_SCAN_BYPASS -eq '1') { exit 0 }

$script:Mode = if ($env:INSTALL_SCAN_MODE) { $env:INSTALL_SCAN_MODE } else { 'advisory' }
$script:CacheDir = if ($env:INSTALL_SCAN_CACHE_DIR) { $env:INSTALL_SCAN_CACHE_DIR } else { Join-Path $env:USERPROFILE '.cache\install-scan' }
$script:LogDir = if ($env:INSTALL_SCAN_LOG_DIR) { $env:INSTALL_SCAN_LOG_DIR } else { Join-Path $script:CacheDir 'logs' }
$script:OsvCacheDir = Join-Path $script:CacheDir 'osv'
$script:KevCache = Join-Path $script:CacheDir 'cisa-kev.json'

New-Item -Path $script:CacheDir, $script:LogDir, $script:OsvCacheDir -ItemType Directory -Force -ErrorAction SilentlyContinue | Out-Null

function Write-Info  { param($Msg) Write-Host "[install-scan] $Msg" -ForegroundColor Cyan }
function Write-Ok    { param($Msg) Write-Host "[install-scan] $Msg" -ForegroundColor Green }
function Write-Warn  { param($Msg) Write-Host "[install-scan] $Msg" -ForegroundColor Yellow }
function Write-Alert { param($Msg) Write-Host "[install-scan] $Msg" -ForegroundColor Red }

# First-run intro
$firstRunMarker = Join-Path $script:CacheDir '.first-run-shown'
if (-not (Test-Path $firstRunMarker)) {
    Write-Info "install-scan v$script:Version — pre-install vulnerability scanner."
    Write-Info "  Scans every package install against OSV.dev + CISA KEV before it runs."
    Write-Info "  Advisory by default. Set `$env:INSTALL_SCAN_MODE='enforcing' to block on KEV hits."
    Write-Info "  Bypass: `$env:INSTALL_SCAN_BYPASS=1; <command>"
    New-Item -Path $firstRunMarker -ItemType File -Force -ErrorAction SilentlyContinue | Out-Null
}

# CISA KEV refresh (6h TTL)
function Update-Kev {
    if (Test-Path $script:KevCache) {
        $age = (Get-Date) - (Get-Item $script:KevCache).LastWriteTime
        if ($age.TotalSeconds -lt 21600) { return }
    }
    try {
        Invoke-WebRequest -Uri 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json' `
            -OutFile "$script:KevCache.tmp" -TimeoutSec 10 -UseBasicParsing
        Move-Item -Path "$script:KevCache.tmp" -Destination $script:KevCache -Force
    } catch { }
}

function Test-KevHit {
    param([string]$Cve)
    if (-not (Test-Path $script:KevCache)) { return $false }
    try {
        $kev = Get-Content $script:KevCache -Raw | ConvertFrom-Json
        return ($null -ne ($kev.vulnerabilities | Where-Object { $_.cveID -eq $Cve }))
    } catch { return $false }
}

function Write-Audit {
    param($Ecosystem, $Name, $Version, $Verdict, $Vulns, $KevHits)
    $logFile = Join-Path $script:LogDir "audit-$(Get-Date -Format 'yyyy-MM-dd').jsonl"
    $event = @{
        ts = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
        tool = 'install-scan'
        tool_version = $script:Version
        user = $env:USERNAME
        host = $env:COMPUTERNAME
        invoker = 'manual'  # parent-process detection on Windows is best-effort
        manager = $Manager
        ecosystem = $Ecosystem
        name = $Name
        version = $Version
        verdict = $Verdict
        vulns = $Vulns
        kev_hits = $KevHits
        mode = $script:Mode
    }
    try {
        ($event | ConvertTo-Json -Compress -Depth 4) | Out-File -FilePath $logFile -Append -Encoding utf8
    } catch { }
}

function Invoke-OsvQuery {
    param($Ecosystem, $Name, $Version)
    $cacheKey = "${Ecosystem}_${Name}_$(if ($Version) { $Version } else { 'NOVER' })".Replace('/', '_').Replace('@', '_')
    $cacheFile = Join-Path $script:OsvCacheDir "$cacheKey.json"

    $body = if ($Version) {
        @{ package = @{ ecosystem = $Ecosystem; name = $Name }; version = $Version } | ConvertTo-Json -Compress
    } else {
        @{ package = @{ ecosystem = $Ecosystem; name = $Name } } | ConvertTo-Json -Compress
    }

    $resp = $null
    try {
        $resp = Invoke-RestMethod -Uri 'https://api.osv.dev/v1/query' -Method Post -Body $body -ContentType 'application/json' -TimeoutSec 8
        $resp | ConvertTo-Json -Depth 10 | Out-File -FilePath $cacheFile -Encoding utf8
    } catch {
        if (Test-Path $cacheFile) {
            $age = (Get-Date) - (Get-Item $cacheFile).LastWriteTime
            if ($age.TotalSeconds -lt 86400) {
                $resp = Get-Content $cacheFile -Raw | ConvertFrom-Json
                Write-Info "  (offline: using cached OSV result)"
            }
        }
    }

    $verSuffix = if ($Version) { "@$Version" } else { '' }
    if (-not $resp) {
        Write-Warn "  ⚠ $Ecosystem/$Name${verSuffix}: scan unavailable (network + no cache)"
        Write-Audit $Ecosystem $Name $Version 'SCAN_UNAVAILABLE' @() @()
        return
    }

    $count = if ($resp.vulns) { $resp.vulns.Count } else { 0 }
    if ($count -eq 0) {
        Write-Ok "  ✓ $Ecosystem/$Name${verSuffix}: no known vulns"
        Write-Audit $Ecosystem $Name $Version 'CLEAN' @() @()
        return
    }

    Write-Warn "  ⚠ $Ecosystem/$Name${verSuffix}: $count known vulnerabilit(y/ies)"
    $resp.vulns | Select-Object -First 5 | ForEach-Object {
        $summary = if ($_.summary) { $_.summary } elseif ($_.details) { $_.details } else { '(no summary)' }
        if ($summary.Length -gt 120) { $summary = $summary.Substring(0, 120) }
        Write-Host "    $($_.id) — $summary" -ForegroundColor Yellow
    }

    $vulnIds = @($resp.vulns | ForEach-Object { $_.id })
    $kevHits = @()
    $aliases = $resp.vulns | ForEach-Object { $_.aliases } | Where-Object { $_ -match '^CVE-' } | Sort-Object -Unique
    foreach ($cve in $aliases) {
        if (Test-KevHit $cve) {
            Write-Alert "  🔥 ACTIVELY EXPLOITED (CISA KEV: $cve)"
            $kevHits += $cve
        }
    }

    $verdict = if ($kevHits.Count -gt 0) { 'KEV_HIT' } else { 'VULNS_FOUND' }
    Write-Audit $Ecosystem $Name $Version $verdict $vulnIds $kevHits

    if ($script:Mode -eq 'enforcing' -and $kevHits.Count -gt 0) {
        Write-Alert "  ⛔ BLOCKED in enforcing mode — KEV hit on $Name"
        exit 1
    }
}

# --- Manager parsers (Windows-relevant subset) -----------------------------

function Parse-PipArgs {
    if ($ScanArgs[0] -ne 'install') { return }
    foreach ($arg in $ScanArgs[1..($ScanArgs.Count-1)]) {
        if ($arg.StartsWith('-') -or [string]::IsNullOrEmpty($arg) -or $arg.Contains('://')) { continue }
        if ($arg -match '==') {
            $name, $version = $arg -split '=='
        } else {
            $name = $arg; $version = ''
        }
        $name = $name -replace '\[.*\]', ''
        Invoke-OsvQuery 'PyPI' $name $version
    }
}

function Parse-NpmArgs {
    if ($ScanArgs[0] -notin @('install', 'i', 'add')) { return }
    foreach ($arg in $ScanArgs[1..($ScanArgs.Count-1)]) {
        if ($arg.StartsWith('-') -or [string]::IsNullOrEmpty($arg)) { continue }
        if ($arg -match '^@[^/]+/[^@]+@.+') {
            $idx = $arg.LastIndexOf('@')
            $name = $arg.Substring(0, $idx); $version = $arg.Substring($idx+1)
        } elseif ($arg.Contains('@') -and -not $arg.StartsWith('@')) {
            $idx = $arg.LastIndexOf('@')
            $name = $arg.Substring(0, $idx); $version = $arg.Substring($idx+1)
        } else {
            $name = $arg; $version = ''
        }
        Invoke-OsvQuery 'npm' $name $version
    }
}

function Parse-DotnetArgs {
    if ($ScanArgs[0] -eq 'add' -and $ScanArgs[1] -eq 'package') {
        $rest = $ScanArgs[2..($ScanArgs.Count-1)]
        $name = ''; $version = ''
        $i = 0
        while ($i -lt $rest.Count) {
            if ($rest[$i] -eq '--version' -or $rest[$i] -eq '-v') {
                $version = $rest[$i+1]; $i += 2; continue
            }
            if (-not $rest[$i].StartsWith('-') -and -not $name) { $name = $rest[$i] }
            $i++
        }
        if ($name) { Invoke-OsvQuery 'NuGet' $name $version }
    } elseif ($ScanArgs[0] -eq 'tool' -and $ScanArgs[1] -eq 'install') {
        foreach ($arg in $ScanArgs[2..($ScanArgs.Count-1)]) {
            if ($arg.StartsWith('-') -or [string]::IsNullOrEmpty($arg)) { continue }
            Invoke-OsvQuery 'NuGet' $arg ''
        }
    }
}

function Parse-ChocoOrWinget {
    param($EcoName)
    if ($ScanArgs[0] -notin @('install', 'upgrade')) { return }
    foreach ($arg in $ScanArgs[1..($ScanArgs.Count-1)]) {
        if ($arg.StartsWith('-') -or [string]::IsNullOrEmpty($arg)) { continue }
        Write-Info "  → ${EcoName}: $arg (no OSV ecosystem; manual verification advised)"
        Write-Audit $EcoName $arg '' 'MANUAL_REVIEW' @() @()
    }
}

# Refresh KEV in background-ish (sync but bounded)
Update-Kev

Write-Info "scanning: $Manager $($ScanArgs -join ' ')"

switch -Wildcard ($Manager.ToLower()) {
    { $_ -in @('pip', 'pip3') }       { Parse-PipArgs }
    { $_ -in @('npm', 'pnpm', 'yarn') } { Parse-NpmArgs }
    'dotnet'                            { Parse-DotnetArgs }
    'choco'                             { Parse-ChocoOrWinget 'Chocolatey' }
    'winget'                            { Parse-ChocoOrWinget 'winget' }
    'scoop'                             { Parse-ChocoOrWinget 'scoop' }
    default { exit 0 }
}

exit 0
