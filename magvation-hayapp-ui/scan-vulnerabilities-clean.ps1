# Vulnerability Scanning Script for Electron App
# Scans only production dependencies that ship with the app

Write-Host "`n=== HayApp Vulnerability Scanner ===" -ForegroundColor Cyan
Write-Host "This script scans ONLY production dependencies for vulnerabilities`n" -ForegroundColor Yellow

# Check if syft is installed
$syftInstalled = Get-Command syft -ErrorAction SilentlyContinue
$grypeInstalled = Get-Command grype -ErrorAction SilentlyContinue

if (-not $syftInstalled -or -not $grypeInstalled) {
    Write-Host "ERROR: syft and/or grype not found!" -ForegroundColor Red
    Write-Host "`nYou need to install syft and grype first." -ForegroundColor Yellow
    Write-Host "Run: .\install-tools-clean.ps1" -ForegroundColor Green
    exit 1
}

Write-Host "[1/5] Backing up node_modules..." -ForegroundColor Green
$backupPath = "$env:TEMP\hayapp_node_modules_backup"
if (Test-Path "node_modules") {
    if (Test-Path $backupPath) {
        Remove-Item $backupPath -Recurse -Force
    }
    Move-Item "node_modules" $backupPath
    Write-Host "  OK - Backup created at $backupPath" -ForegroundColor Gray
}

Write-Host "`n[2/5] Installing ONLY production dependencies..." -ForegroundColor Green
npm ci --omit=dev --legacy-peer-deps
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERROR - npm install failed!" -ForegroundColor Red
    # Restore backup
    if (Test-Path $backupPath) {
        if (Test-Path "node_modules") {
            Remove-Item "node_modules" -Recurse -Force
        }
        Move-Item $backupPath "node_modules"
    }
    exit 1
}
Write-Host "  OK - Production dependencies installed" -ForegroundColor Gray

Write-Host "`n[3/5] Generating SBOM with syft..." -ForegroundColor Green
syft dir:. -o cyclonedx-json=webapp_sbom.json 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERROR - SBOM generation failed!" -ForegroundColor Red
    exit 1
}
Write-Host "  OK - SBOM saved to webapp_sbom.json" -ForegroundColor Gray

Write-Host "`n[4/5] Scanning for vulnerabilities with grype..." -ForegroundColor Green
Write-Host "`n" -NoNewline
grype webapp_sbom.json
$grypeExitCode = $LASTEXITCODE

Write-Host "`n[4/5b] Saving detailed JSON report..." -ForegroundColor Green
grype webapp_sbom.json -o json | Out-File -Encoding utf8 webapp_vulnerabilities.json
Write-Host "  OK - Detailed report saved to webapp_vulnerabilities.json" -ForegroundColor Gray

Write-Host "`n[5/5] Restoring full node_modules..." -ForegroundColor Green
if (Test-Path "node_modules") {
    Remove-Item "node_modules" -Recurse -Force
}
if (Test-Path $backupPath) {
    Move-Item $backupPath "node_modules"
    Write-Host "  OK - Development dependencies restored" -ForegroundColor Gray
}

Write-Host "`n=== Scan Complete ===" -ForegroundColor Cyan
Write-Host "`nGenerated files:" -ForegroundColor Yellow
Write-Host "  * webapp_sbom.json - Software Bill of Materials"
Write-Host "  * webapp_vulnerabilities.json - Detailed vulnerability report"

if ($grypeExitCode -eq 0) {
    Write-Host "`nNo vulnerabilities found in production dependencies!" -ForegroundColor Green
} else {
    Write-Host "`nVulnerabilities found - review output above" -ForegroundColor Yellow
    Write-Host "These affect your PRODUCTION app, not dev tools" -ForegroundColor Red
}

Write-Host "`nTo review JSON report:"
Write-Host "  code webapp_vulnerabilities.json"
Write-Host ""
