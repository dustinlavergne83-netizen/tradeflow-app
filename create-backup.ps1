# TradeFlow Essential Backup Script
# Creates a backup of all essential files and folders

$backupName = "TradeFlow_Backup_$(Get-Date -Format 'yyyy-MM-dd_HHmm')"
$backupPath = "..\$backupName"

Write-Host "Creating backup: $backupName" -ForegroundColor Green

# Create backup directory
New-Item -ItemType Directory -Path $backupPath -Force | Out-Null

# Copy essential folders
Write-Host "Copying source code..." -ForegroundColor Yellow
Copy-Item -Path "src" -Destination "$backupPath\src" -Recurse
Copy-Item -Path "public" -Destination "$backupPath\public" -Recurse
Copy-Item -Path "supabase" -Destination "$backupPath\supabase" -Recurse

# Copy essential config files
Write-Host "Copying configuration files..." -ForegroundColor Yellow
$configFiles = @(
    ".env",
    ".env.local",
    ".gitignore",
    ".vercelignore",
    "app.json",
    "eas.json",
    "eslint.config.js",
    "index.html",
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    "vite.config.js"
)

foreach ($file in $configFiles) {
    if (Test-Path $file) {
        Copy-Item -Path $file -Destination $backupPath
    }
}

# Copy essential documentation
Write-Host "Copying documentation..." -ForegroundColor Yellow
$docs = @(
    "README.md",
    "CONDUIT_NAMING_CONVENTION_MASTER.md",
    "EMT_NAMING_CONVENTION.md",
    "PVC_NAMING_CONVENTION.md",
    "CONDUIT_TYPES_ORGANIZATION.md"
)

foreach ($doc in $docs) {
    if (Test-Path $doc) {
        Copy-Item -Path $doc -Destination $backupPath
    }
}

# Copy android folder (optional - comment out if you don't need it)
Write-Host "Copying Android files..." -ForegroundColor Yellow
if (Test-Path "android") {
    Copy-Item -Path "android" -Destination "$backupPath\android" -Recurse
}

Write-Host "`n✅ Backup complete!" -ForegroundColor Green
Write-Host "Location: $backupPath" -ForegroundColor Cyan
Write-Host "`nTo create a ZIP file, run:" -ForegroundColor Yellow
Write-Host "Compress-Archive -Path '$backupPath' -DestinationPath '$backupPath.zip'" -ForegroundColor White
