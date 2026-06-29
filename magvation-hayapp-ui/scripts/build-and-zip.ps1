Param(
    [Parameter(Mandatory=$true)]
    [string]$BuildNumber
)

$ErrorActionPreference = 'Stop'

# Resolve repository root (script located in scripts/)
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Push-Location $RepoRoot

Write-Host "Repository root: $RepoRoot"

# Read package.json
if (-not (Test-Path package.json)) {
    throw "package.json not found in $RepoRoot"
}
$pkg = Get-Content package.json -Raw | ConvertFrom-Json
$name = ($pkg.name -replace '[^A-Za-z0-9._-]','-').Trim('-')
$productNameSource = if ($pkg.productName) { $pkg.productName } else { $pkg.name }
$productName = ($productNameSource -replace '[^A-Za-z0-9._-]','-').Trim('-')
$version = $pkg.version

Write-Host "Preparing build for $productName version $version (build $BuildNumber)"

# Verify required Windows icon asset exists (used by Electron Forge config)
$iconRelativePath = 'assets\app-icon.ico'
$iconFullPath = Join-Path $RepoRoot $iconRelativePath
if (-not (Test-Path $iconFullPath)) {
    throw "Required icon file not found: $iconFullPath. Add your .ico at $iconRelativePath or update forge.config.ts and this script."
}

# Ensure production environment
Write-Host "Setting NODE_ENV=production"
$env:NODE_ENV = 'production'

# Clean existing output folders
$pathsToClean = @('out', '.vite', 'dist')
foreach ($p in $pathsToClean) {
    $full = Join-Path $RepoRoot $p
    if (Test-Path $full) {
        Write-Host "Removing existing output folder: $full"
        Remove-Item $full -Recurse -Force -ErrorAction Stop
    }
}

# Run the project's make/build script
Write-Host "Running: npm run make"
& npm run make
if ($LASTEXITCODE -ne 0) {
    throw "npm run make failed with exit code $LASTEXITCODE"
}

# Prefer packaged app folder under out/<productName>-win32-x64
$expectedPackDir = Join-Path $RepoRoot ("out\$($productName)-win32-x64")
if (Test-Path $expectedPackDir) {
    $packagedDir = $expectedPackDir
} else {
    # Fallback: pick first directory under out that looks like a win32 build
    $outParent = Join-Path $RepoRoot 'out'
    if (-not (Test-Path $outParent)) {
        throw "Expected out/ directory not found: $outParent"
    }
    $candidate = Get-ChildItem -Path $outParent -Directory | Where-Object { $_.Name -match 'win32' -and $_.Name -match 'x64' } | Select-Object -First 1
    if ($candidate) {
        $packagedDir = $candidate.FullName
    } else {
        throw "Could not find packaged win32 x64 directory under: $outParent"
    }
}


# Prepare zip name and path
$zipName = "$productName-$version-build$BuildNumber.zip"

# Ensure artifacts directory exists under out/artifacts
$artifactsDir = Join-Path $RepoRoot 'out\artifacts'
if (-not (Test-Path $artifactsDir)) {
    Write-Host "Creating artifacts directory: $artifactsDir"
    New-Item -ItemType Directory -Path $artifactsDir | Out-Null
}

$zipPath = Join-Path $artifactsDir $zipName

if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

if (-not $packagedDir -or -not (Test-Path $packagedDir)) {
    throw "Packaged directory not found or invalid: $packagedDir"
}

Write-Host "Creating archive from packaged folder: $packagedDir -> $zipPath"
Compress-Archive -Path (Join-Path $packagedDir '*') -DestinationPath $zipPath -Force

Write-Host "Archive created: $zipPath"
Pop-Location
Exit 0
