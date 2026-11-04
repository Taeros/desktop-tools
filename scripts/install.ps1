# Desktop Tools installer / updater for Windows. Per-user, no admin rights.
#   powershell -ExecutionPolicy Bypass -File scripts\install.ps1
# Re-run any time to update dependencies. Everything lives under %LOCALAPPDATA%\DesktopTools.
param([switch]$NoStart)
$ErrorActionPreference = 'Stop'
$App  = Split-Path -Parent $PSScriptRoot
$Root = Join-Path $env:LOCALAPPDATA 'DesktopTools'
$Log  = Join-Path $Root 'install.log'
New-Item -ItemType Directory -Force -Path $Root | Out-Null
Start-Transcript -Path $Log -Force | Out-Null
try {
    # 1. uv (Python package manager), installed privately for Desktop Tools only
    $UvDir = Join-Path $Root 'uv'
    $Uv = Join-Path $UvDir 'uv.exe'
    if (-not (Test-Path $Uv)) {
        Write-Host 'Installing uv (per-user)...'
        $env:UV_INSTALL_DIR = $UvDir
        $env:UV_NO_MODIFY_PATH = '1'
        Invoke-RestMethod https://astral.sh/uv/install.ps1 | Invoke-Expression
    }
    # 2. Python 3.12 and dependencies from the lock file (hash-pinned)
    $env:UV_PYTHON_INSTALL_DIR = Join-Path $Root 'python'
    $env:UV_CACHE_DIR = Join-Path $Root 'cache\uv'
    Push-Location $App
    & $Uv sync --frozen --no-dev --python 3.12
    if ($LASTEXITCODE -ne 0) { throw "uv sync failed ($LASTEXITCODE)" }
    Pop-Location
    Write-Host 'Desktop Tools installed.'
    # 3. Start (the app creates its own start-at-login shortcut if that setting is on)
    if (-not $NoStart) {
        Start-Process -FilePath (Join-Path $App '.venv\Scripts\pythonw.exe') -ArgumentList '-m', 'desktop_tools' -WorkingDirectory $App
        Write-Host 'Started. Press Ctrl+Alt+Shift+D to open it.'
    }
} finally {
    Stop-Transcript | Out-Null
}
