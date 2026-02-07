# Backup to Google Drive - Cloud-safe backup
# Creates backup and copies to Google Drive for off-site protection

param(
    [string]$Label = ""
)

# Detect Google Drive folder
$possiblePaths = @(
    "G:\My Drive",
    "$env:USERPROFILE\Google Drive",
    "$env:USERPROFILE\GoogleDrive",
    "G:\",
    "$env:USERPROFILE\My Drive"
)

$googleDrivePath = $null
foreach ($path in $possiblePaths) {
    if (Test-Path $path) {
        $googleDrivePath = $path
        break
    }
}

if (-not $googleDrivePath) {
    Write-Host "Google Drive folder not found!" -ForegroundColor Red
    Write-Host "`nSearched these locations:" -ForegroundColor Yellow
    foreach ($path in $possiblePaths) {
        Write-Host "  $path" -ForegroundColor Gray
    }
    Write-Host "`nSolutions:" -ForegroundColor Cyan
    Write-Host "  1. Install Google Drive Desktop: https://www.google.com/drive/download/" -ForegroundColor White
    Write-Host "  2. Or manually specify path when prompted" -ForegroundColor White
    Write-Host "`nManually enter Google Drive path? (or press Enter to cancel)" -ForegroundColor Yellow
    $manualPath = Read-Host
    if ([string]::IsNullOrWhiteSpace($manualPath)) {
        Write-Host "Backup cancelled." -ForegroundColor Gray
        exit
    }
    if (Test-Path $manualPath) {
        $googleDrivePath = $manualPath
    } else {
        Write-Host "Path not found: $manualPath" -ForegroundColor Red
        exit
    }
}

Write-Host "Found Google Drive: $googleDrivePath" -ForegroundColor Green

# Create TradeFlow Backups folder in Google Drive
$driveBackupPath = Join-Path $googleDrivePath "TradeFlow_Backups"
if (-not (Test-Path $driveBackupPath)) {
    New-Item -ItemType Directory -Path $driveBackupPath -Force | Out-Null
    Write-Host "Created backup folder in Google Drive" -ForegroundColor Cyan
}

# Get label if not provided
if ([string]::IsNullOrWhiteSpace($Label)) {
    Write-Host "`nCloud Backup Tool" -ForegroundColor Cyan
    Write-Host "Description (or press Enter for date only):" -ForegroundColor Yellow
    $Label = Read-Host
}

# Create backup name
$timestamp = Get-Date -Format 'yyyy-MM-dd_HHmm'
if ([string]::IsNullOrWhiteSpace($Label)) {
    $backupName = "TradeFlow_$timestamp"
} else {
    $cleanLabel = $Label -replace '[^\w\s-]', '' -replace '\s+', '_'
    $backupName = "TradeFlow_${timestamp}_${cleanLabel}"
}

# Create temporary backup folder
$tempBackupPath = Join-Path $env:TEMP $backupName
Write-Host "`nCreating backup..." -ForegroundColor Green

# Create backup directory
New-Item -ItemType Directory -Path $tempBackupPath -Force | Out-Null

# Copy essential folders
Write-Host "Copying files..." -ForegroundColor Yellow

$folders = @("src", "public", "supabase")
foreach ($folder in $folders) {
    if (Test-Path $folder) {
        Write-Host "  Copying $folder..." -ForegroundColor Gray
        robocopy $folder "$tempBackupPath\$folder" /E /MT:8 /NFL /NDL /NJH /NJS /NC /NS | Out-Null
    }
}

# Copy config files
$configFiles = @(
    ".env", ".env.local", ".gitignore", ".vercelignore",
    "app.json", "eas.json", "eslint.config.js", "index.html",
    "package.json", "package-lock.json", "tsconfig.json", "vite.config.js"
)

foreach ($file in $configFiles) {
    if (Test-Path $file) {
        Copy-Item -Path $file -Destination $tempBackupPath -Force
    }
}

# Copy documentation
$docs = @(
    "README.md", "CONDUIT_NAMING_CONVENTION_MASTER.md",
    "EMT_NAMING_CONVENTION.md", "PVC_NAMING_CONVENTION.md",
    "CONDUIT_TYPES_ORGANIZATION.md"
)

foreach ($doc in $docs) {
    if (Test-Path $doc) {
        Copy-Item -Path $doc -Destination $tempBackupPath -Force
    }
}

# Create backup info file
$infoPath = Join-Path $tempBackupPath "BACKUP_INFO.txt"
@"
TradeFlow Cloud Backup
Created: $timestamp
Description: $Label
Computer: $env:COMPUTERNAME
User: $env:USERNAME
Backup Location: Google Drive
"@ | Out-File -FilePath $infoPath -Encoding UTF8

# Create ZIP file
Write-Host "Creating ZIP file..." -ForegroundColor Yellow
$zipName = "$backupName.zip"
$zipPath = Join-Path $env:TEMP $zipName
if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}
Compress-Archive -Path $tempBackupPath -DestinationPath $zipPath -Force

# Get ZIP size
$zipSize = (Get-Item $zipPath).Length / 1MB

# Copy to Google Drive
Write-Host "Uploading to Google Drive..." -ForegroundColor Cyan
$driveZipPath = Join-Path $driveBackupPath $zipName
Copy-Item -Path $zipPath -Destination $driveZipPath -Force

Write-Host "`nBackup complete!" -ForegroundColor Green
Write-Host "`nBackup Details:" -ForegroundColor Cyan
Write-Host "  Name: $zipName" -ForegroundColor White
Write-Host "  Size: $($zipSize.ToString('F2')) MB" -ForegroundColor White
Write-Host "  Location: $driveBackupPath" -ForegroundColor White
Write-Host "  Status: Syncing to Google Drive..." -ForegroundColor Yellow

# Cleanup temp files
Remove-Item $tempBackupPath -Recurse -Force
Remove-Item $zipPath -Force

Write-Host "`nTip: Google Drive will sync this to the cloud automatically." -ForegroundColor Yellow
Write-Host "Check the Google Drive icon in your taskbar for sync status." -ForegroundColor Gray

Write-Host "`nYour data is now safe in the cloud!" -ForegroundColor Green
