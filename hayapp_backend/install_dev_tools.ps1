# powershell -ExecutionPolicy Bypass -File install_dev_tools.ps1
# PowerShell script to install development tools
# Requires Administrator privileges

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "This script requires Administrator privileges. Please run PowerShell as Administrator." -ForegroundColor Red
    exit 1
}

Write-Host "Starting installation of development tools..." -ForegroundColor Green

# Set execution policy to RemoteSigned
Write-Host "`nSetting execution policy to RemoteSigned..." -ForegroundColor Cyan
try {
    Set-ExecutionPolicy RemoteSigned -Scope LocalMachine -Force
    Write-Host "Execution policy set successfully." -ForegroundColor Green
} catch {
    Write-Host "Failed to set execution policy: $_" -ForegroundColor Yellow
}

# Function to check if a command exists
function Test-CommandExists {
    param($command)
    $null = Get-Command $command -ErrorAction SilentlyContinue
    return $?
}

# Enable certificate pinning bypass for Microsoft Store
Write-Host "`nEnabling certificate pinning bypass..." -ForegroundColor Cyan
winget settings --enable BypassCertificatePinningForMicrosoftStore

# Install Make (via winget - GnuWin32)
Write-Host "`nInstalling Make..." -ForegroundColor Yellow
if (Test-CommandExists "make") {
    Write-Host "Make is already installed." -ForegroundColor Green
} else {
    winget install GnuWin32.Make --silent --accept-package-agreements --accept-source-agreements
    Write-Host "Make installed successfully." -ForegroundColor Green
    
    # Add GnuWin32 to PATH
    $gnuWinPath = "C:\Program Files (x86)\GnuWin32\bin"
    $machinePath = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
    if ($machinePath -notlike "*$gnuWinPath*") {
        Write-Host "Adding GnuWin32 to system PATH..." -ForegroundColor Cyan
        [System.Environment]::SetEnvironmentVariable("Path", "$machinePath;$gnuWinPath", "Machine")
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
        Write-Host "GnuWin32 added to PATH." -ForegroundColor Green
    }
}

# Install Node.js
Write-Host "`nInstalling Node.js..." -ForegroundColor Yellow
if (Test-CommandExists "node") {
    Write-Host "Node.js is already installed. Version: $(node --version)" -ForegroundColor Green
} else {
    winget install OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements
    Write-Host "Node.js installed successfully." -ForegroundColor Green
}

# Install Git
Write-Host "`nInstalling Git..." -ForegroundColor Yellow
if (Test-CommandExists "git") {
    Write-Host "Git is already installed. Version: $(git --version)" -ForegroundColor Green
} else {
    winget install Git.Git --silent --accept-package-agreements --accept-source-agreements
    Write-Host "Git installed successfully." -ForegroundColor Green
}

# Install Python 3.11
Write-Host "`nInstalling Python 3.11..." -ForegroundColor Yellow
$pythonInstalled = $false
try {
    $pythonVersion = & python --version 2>&1
    if ($pythonVersion -like "*3.11*") {
        Write-Host "Python 3.11 is already installed. Version: $pythonVersion" -ForegroundColor Green
        $pythonInstalled = $true
    }
} catch {
    # Python not found
}

if (-not $pythonInstalled) {
    winget install Python.Python.3.11 --silent --accept-package-agreements --accept-source-agreements
    Write-Host "Python 3.11 installed successfully." -ForegroundColor Green
}

# Install Visual C++ Redistributable
Write-Host "`nInstalling Visual C++ Redistributable..." -ForegroundColor Yellow
try {
    # Install the latest VC++ Redistributable (2015-2022)
    winget install Microsoft.VCRedist.2015+.x64 --silent --accept-package-agreements --accept-source-agreements
    Write-Host "Visual C++ Redistributable installed successfully." -ForegroundColor Green
} catch {
    Write-Host "Visual C++ Redistributable installation completed (may already be installed)." -ForegroundColor Yellow
}

# Disable certificate pinning bypass for Microsoft Store
Write-Host "`nDisabling certificate pinning bypass..." -ForegroundColor Cyan
winget settings --disable BypassCertificatePinningForMicrosoftStore

# Refresh environment variables
Write-Host "`nRefreshing environment variables..." -ForegroundColor Cyan
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# Create alias for python3.11
Write-Host "`nSetting up python3.11 alias..." -ForegroundColor Yellow

# Get Python 3.11 installation path
$pythonPath = Get-Command python -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source
if ($pythonPath) {
    $pythonDir = Split-Path $pythonPath
    $python311Path = Join-Path $pythonDir "python3.11.exe"
    
    # Create symbolic link or copy if python3.11.exe doesn't exist
    if (-not (Test-Path $python311Path)) {
        try {
            # Try to create a symbolic link (requires admin privileges)
            New-Item -ItemType SymbolicLink -Path $python311Path -Target $pythonPath -Force -ErrorAction Stop | Out-Null
            Write-Host "Created symbolic link for python3.11" -ForegroundColor Green
        } catch {
            # If symlink fails, create a hard link or copy
            try {
                New-Item -ItemType HardLink -Path $python311Path -Target $pythonPath -Force -ErrorAction Stop | Out-Null
                Write-Host "Created hard link for python3.11" -ForegroundColor Green
            } catch {
                # Fallback to copying the file
                Copy-Item $pythonPath $python311Path -Force
                Write-Host "Created copy for python3.11" -ForegroundColor Green
            }
        }
    } else {
        Write-Host "python3.11 alias already exists." -ForegroundColor Green
    }
} else {
    Write-Host "Python installation not found in PATH." -ForegroundColor Yellow
}

# Configure and start SSH Agent
Write-Host "`nConfiguring SSH Agent..." -ForegroundColor Yellow
try {
    $sshAgentService = Get-Service ssh-agent -ErrorAction SilentlyContinue
    if ($sshAgentService) {
        # Set service to start automatically
        Set-Service ssh-agent -StartupType Automatic
        # Start the service if not running
        if ($sshAgentService.Status -ne 'Running') {
            Start-Service ssh-agent
            Write-Host "SSH Agent started successfully." -ForegroundColor Green
        } else {
            Write-Host "SSH Agent is already running." -ForegroundColor Green
        }
    } else {
        Write-Host "SSH Agent service not found. It should be available in Windows 10/11." -ForegroundColor Yellow
    }
} catch {
    Write-Host "Failed to configure SSH Agent: $_" -ForegroundColor Red
}

Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "Installation completed!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "`nPlease restart your PowerShell session or run the following command to apply changes:"
Write-Host "  . `$PROFILE" -ForegroundColor Yellow
Write-Host "`nVerify installations with:"
Write-Host "  make --version" -ForegroundColor Yellow
Write-Host "  node --version" -ForegroundColor Yellow
Write-Host "  git --version" -ForegroundColor Yellow
Write-Host "  python --version" -ForegroundColor Yellow
Write-Host "  python3.11 --version" -ForegroundColor Yellow
Write-Host "`nSSH Agent Configuration:" -ForegroundColor Cyan
Write-Host "  The SSH Agent has been configured and started."
Write-Host "  To add your SSH keys, run:" -ForegroundColor Yellow
Write-Host "    ssh-add ~\.ssh\id_rsa" -ForegroundColor Yellow
Write-Host "  Or for a specific key:" -ForegroundColor Yellow
Write-Host "    ssh-add ~\.ssh\your_key_name" -ForegroundColor Yellow
Write-Host "`nNote: You may need to close and reopen PowerShell for all changes to take effect." -ForegroundColor Cyan
