# Quick installer for syft and grype on Windows
# Downloads binaries directly from GitHub releases

Write-Host "`n=== Installing Vulnerability Scanning Tools ===" -ForegroundColor Cyan

$syftInstalled = Get-Command syft -ErrorAction SilentlyContinue
$grypeInstalled = Get-Command grype -ErrorAction SilentlyContinue

if ($syftInstalled -and $grypeInstalled) {
    Write-Host "Both syft and grype are already installed!" -ForegroundColor Green
    Write-Host "  syft version: " -NoNewline
    syft version
    Write-Host "  grype version: " -NoNewline
    grype version
    exit 0
}

# Installation directory
$installDir = "$env:LOCALAPPDATA\bin"
if (-not (Test-Path $installDir)) {
    New-Item -ItemType Directory -Path $installDir -Force | Out-Null
}

# Add to PATH if not already there
$currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($currentPath -notlike "*$installDir*") {
    Write-Host "Adding $installDir to user PATH..." -ForegroundColor Yellow
    [Environment]::SetEnvironmentVariable("Path", "$currentPath;$installDir", "User")
    $env:Path = "$env:Path;$installDir"
}

$originalLocation = Get-Location

try {
    Set-Location $installDir

    if (-not $syftInstalled) {
        Write-Host "`n[1/2] Installing syft..." -ForegroundColor Green
        
        # Get latest release info
        $syftRelease = Invoke-RestMethod -Uri "https://api.github.com/repos/anchore/syft/releases/latest"
        $syftAsset = $syftRelease.assets | Where-Object { $_.name -like "*windows_amd64.zip" } | Select-Object -First 1
        
        if (-not $syftAsset) {
            throw "Could not find Windows binary for syft"
        }
        
        Write-Host "  Downloading syft $($syftRelease.tag_name)..." -ForegroundColor Gray
        Invoke-WebRequest -Uri $syftAsset.browser_download_url -OutFile "syft.zip"
        
        Write-Host "  Extracting..." -ForegroundColor Gray
        Expand-Archive -Path "syft.zip" -DestinationPath "." -Force
        Remove-Item "syft.zip"
        
        Write-Host "  OK - syft installed to $installDir" -ForegroundColor Gray
    }

    if (-not $grypeInstalled) {
        Write-Host "`n[2/2] Installing grype..." -ForegroundColor Green
        
        # Get latest release info
        $grypeRelease = Invoke-RestMethod -Uri "https://api.github.com/repos/anchore/grype/releases/latest"
        $grypeAsset = $grypeRelease.assets | Where-Object { $_.name -like "*windows_amd64.zip" } | Select-Object -First 1
        
        if (-not $grypeAsset) {
            throw "Could not find Windows binary for grype"
        }
        
        Write-Host "  Downloading grype $($grypeRelease.tag_name)..." -ForegroundColor Gray
        Invoke-WebRequest -Uri $grypeAsset.browser_download_url -OutFile "grype.zip"
        
        Write-Host "  Extracting..." -ForegroundColor Gray
        Expand-Archive -Path "grype.zip" -DestinationPath "." -Force
        Remove-Item "grype.zip"
        
        Write-Host "  OK - grype installed to $installDir" -ForegroundColor Gray
    }

    Write-Host "`nInstallation complete!" -ForegroundColor Green
    Write-Host "`nTools installed to: $installDir" -ForegroundColor Cyan
    Write-Host "`nIMPORTANT: Close and reopen PowerShell for PATH changes to take effect" -ForegroundColor Yellow
    Write-Host "`nThen run:" -ForegroundColor Yellow
    Write-Host "  cd $PSScriptRoot"
    Write-Host "  .\scan-vulnerabilities.ps1"
    
}
catch {
    Write-Host "`nInstallation failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "`nTry manual installation:" -ForegroundColor Yellow
    Write-Host "  1. Download from: https://github.com/anchore/syft/releases"
    Write-Host "  2. Download from: https://github.com/anchore/grype/releases"
    Write-Host "  3. Extract .exe files to: $installDir"
    Write-Host "  4. Restart PowerShell"
    exit 1
}
finally {
    Set-Location $originalLocation
}
