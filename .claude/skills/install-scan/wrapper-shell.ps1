# wrapper-shell.ps1 — PowerShell wrapper functions for install-scan.
#
# Add to your PowerShell profile (run `notepad $PROFILE`) and dot-source:
#
#   . "$env:USERPROFILE\.local\share\install-scan\bin\wrapper-shell.ps1"
#
# Idempotent. Wrap pip / npm / brew / dotnet / cargo / choco / winget / etc.
# Same advisory-by-default behavior as the bash version.

if ($global:_InstallScanWrapperLoaded) { return }
$global:_InstallScanWrapperLoaded = $true

$script:InstallScanDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$script:InstallScanScript = Join-Path $script:InstallScanDir "install-scan.ps1"

function Invoke-InstallScanDispatch {
    param(
        [Parameter(Mandatory)] [string] $Manager,
        [Parameter(ValueFromRemainingArguments)] [string[]] $InstallArgs
    )
    if (-not $InstallArgs -or $InstallArgs.Count -eq 0) { return }
    if ($env:INSTALL_SCAN_DISABLE -eq "1" -or $env:INSTALL_SCAN_BYPASS -eq "1") { return }

    if (Test-Path $script:InstallScanScript) {
        & pwsh -NoProfile -File $script:InstallScanScript $Manager @InstallArgs 2>&1 | Out-Host
    } else {
        # Fallback: call bash version via WSL if available
        if (Get-Command wsl -ErrorAction SilentlyContinue) {
            $bashScript = Join-Path $script:InstallScanDir "install-scan.sh"
            $wslPath = ($bashScript -replace '\\', '/' -replace '^([A-Z]):', '/mnt/$1').ToLower() -replace '/mnt/(.)', '/mnt/$1'
            wsl bash $wslPath $Manager @InstallArgs 2>&1 | Out-Host
        }
    }
}

# Build wrapper functions for each manager.
# PowerShell can't override built-in cmdlets, but for external commands like pip,
# npm, brew, dotnet — defining a function with the same name takes precedence.

$managers = @(
    'pip', 'pip3', 'uv', 'pipx', 'poetry', 'conda', 'mamba',
    'npm', 'pnpm', 'yarn',
    'dotnet', 'cargo', 'gem', 'gh',
    'choco', 'winget', 'scoop', 'brew'
)

foreach ($mgr in $managers) {
    $body = @"
param([Parameter(ValueFromRemainingArguments)] [string[]] `$Args)
Invoke-InstallScanDispatch -Manager '$mgr' -InstallArgs `$Args
& (Get-Command -CommandType Application '$mgr' -ErrorAction SilentlyContinue).Path @Args
"@
    Set-Item -Path "function:global:$mgr" -Value ([scriptblock]::Create($body))
}

function Get-InstallScanStatus {
    Write-Host "install-scan v1.0 — PowerShell wrappers LOADED" -ForegroundColor Cyan
    Write-Host "  scanner:  $script:InstallScanScript"
    Write-Host "  cache:    $(if ($env:INSTALL_SCAN_CACHE_DIR) { $env:INSTALL_SCAN_CACHE_DIR } else { "$env:USERPROFILE\.cache\install-scan" })"
    Write-Host "  mode:     $(if ($env:INSTALL_SCAN_MODE) { $env:INSTALL_SCAN_MODE } else { 'advisory' })"
    Write-Host "  managers: $($managers -join ' ')"
    Write-Host ""
    Write-Host "  bypass once:    `$env:INSTALL_SCAN_BYPASS=1; <command>"
    Write-Host "  disable shell:  `$env:INSTALL_SCAN_DISABLE=1"
    Write-Host "  enforce mode:   `$env:INSTALL_SCAN_MODE='enforcing'"
}

Set-Alias install-scan-status Get-InstallScanStatus
