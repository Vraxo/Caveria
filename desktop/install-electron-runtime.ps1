$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$electronRoot = Join-Path $projectRoot 'node_modules\electron'
$packagePath = Join-Path $electronRoot 'package.json'
$checksumsPath = Join-Path $electronRoot 'checksums.json'

try {
    if (-not (Test-Path $packagePath)) {
        throw "Electron package metadata is missing at $packagePath"
    }

    $electronPackage = Get-Content $packagePath -Raw | ConvertFrom-Json
    $checksums = Get-Content $checksumsPath -Raw | ConvertFrom-Json
    $version = $electronPackage.version
    $arch = switch ($env:PROCESSOR_ARCHITECTURE) {
        'AMD64' { 'x64' }
        'ARM64' { 'arm64' }
        'x86' { 'ia32' }
        default { throw "Unsupported Windows architecture: $env:PROCESSOR_ARCHITECTURE" }
    }

    $archiveName = "electron-v$version-win32-$arch.zip"
    $downloadUrl = "https://github.com/electron/electron/releases/download/v$version/$archiveName"
    $archivePath = Join-Path $env:TEMP $archiveName
    $distPath = Join-Path $electronRoot 'dist'
    $executablePath = Join-Path $distPath 'electron.exe'

    Write-Host "[Caveria] Downloading $archiveName..."
    Invoke-WebRequest -Uri $downloadUrl -OutFile $archivePath -UseBasicParsing

    $checksumProperty = $checksums.PSObject.Properties[$archiveName]
    $expectedHash = if ($checksumProperty) { $checksumProperty.Value } else { $null }
    if (-not $expectedHash) {
        throw "Electron's checksum manifest has no entry for $archiveName"
    }
    $actualHash = (Get-FileHash $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actualHash -ne $expectedHash.ToLowerInvariant()) {
        throw "Checksum mismatch for $archiveName"
    }
    Write-Host '[Caveria] Download verified.'

    if (Test-Path $distPath) {
        Remove-Item $distPath -Recurse -Force
    }
    New-Item $distPath -ItemType Directory -Force | Out-Null

    Write-Host '[Caveria] Extracting Electron runtime with Windows PowerShell...'
    Expand-Archive -Path $archivePath -DestinationPath $distPath -Force
    Set-Content -Path (Join-Path $electronRoot 'path.txt') -Value 'electron.exe' -NoNewline -Encoding Ascii

    if (-not (Test-Path $executablePath)) {
        throw "Extraction completed but electron.exe is missing. Antivirus may have quarantined it."
    }

    Write-Host "[Caveria] Electron runtime ready: $executablePath"
    Remove-Item $archivePath -Force -ErrorAction SilentlyContinue
    exit 0
}
catch {
    Write-Host ''
    Write-Host '[Caveria] Electron runtime installation failed.' -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host $_.ScriptStackTrace -ForegroundColor DarkRed
    exit 1
}
