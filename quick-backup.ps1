# Quick Backup - Run this after finishing a big change
# Creates a backup with a custom label/description

param(
    [string]$Label = ""
)

# If no label provided, ask for one
if ([string]::IsNullOrWhiteSpace($Label)) {
    Write-Host "💾 Quick Backup Tool" -ForegroundColor Cyan
    Write-Host "What did you just finish? (e.g., 'Fixed takeoff bug', 'Added new feature')" -ForegroundColor Yellow
    $Label = Read-Host "Description"
}

# Clean the label for use in filename (remove invalid characters)
$cleanLabel = $Label -replace '[^\w\s-]', '' -replace '\s+', '_'
$timestamp = Get-Date -Format 'yyyy-MM-dd_HHmm'
$backupName = "TradeFlow_Backup_${timestamp}_${cleanLabel}"
$backupPath = "..\$backupName"

Write-Host "`n🚀 Creating backup: $backupName" -ForegroundColor Green

# Create backup directory
New-Item -ItemType Directory -Path $backupPath -Force | Out-Null

# Copy essential folders
Write-Host "📁 Copying files..." -ForegroundColor Yellow

# Use robocopy for faster copying (built into Windows)
$folders = @("src", "public", "supabase")
foreach ($folder in $folders) {
    if (Test-Path $folder) {
        robocopy $folder "$backupPath\$folder" /E /MT:8 /NFL /NDL /NJH /NJS /NC /NS | Out-Null
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
        Copy-Item -Path $file -Destination $backupPath -Force
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
        Copy-Item -Path $doc -Destination $backupPath -Force
    }
}

# Create a CHANGELOG file in the backup
$changelogPath = Join-Path $backupPath "BACKUP_INFO.txt"
@"
TradeFlow Backup
Created: $timestamp
Description: $Label
Computer: $env:COMPUTERNAME
User: $env:USERNAME
"@ | Out-File -FilePath $changelogPath -Encoding UTF8

Write-Host "✅ Backup complete!" -ForegroundColor Green
Write-Host "`n📍 Location: $backupPath" -ForegroundColor Cyan
Write-Host "📝 Description: $Label" -ForegroundColor White

# Ask if user wants to create a ZIP
Write-Host "`n💾 Create ZIP file? (Y/N)" -ForegroundColor Yellow
$createZip = Read-Host

if ($createZip -eq 'Y' -or $createZip -eq 'y') {
    $zipPath = "$backupPath.zip"
    Write-Host "Creating ZIP file..." -ForegroundColor Yellow
    Compress-Archive -Path $backupPath -DestinationPath $zipPath -Force
    Write-Host "✅ ZIP created: $zipPath" -ForegroundColor Green
}

Write-Host "`n🎉 Done! You can continue working safely." -ForegroundColor Green
