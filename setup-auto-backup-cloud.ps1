# Setup Automatic Cloud Backup for TradeFlow
# Configures nightly backups to Google Drive for off-site protection

Write-Host "Setting up automatic Google Drive backup..." -ForegroundColor Green

# Get the full path to the backup script
$scriptPath = Join-Path $PSScriptRoot "backup-to-google-drive.ps1"
$projectPath = $PSScriptRoot

# Task settings
$taskName = "TradeFlow_Cloud_Backup"
$taskDescription = "Automatically backs up TradeFlow to Google Drive every night at 2 AM"
$backupTime = "2:00AM"

# Create the scheduled task action
$action = New-ScheduledTaskAction `
    -Execute "PowerShell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`" -Label `"auto`"" `
    -WorkingDirectory $projectPath

# Create the trigger (daily at 2 AM)
$trigger = New-ScheduledTaskTrigger -Daily -At $backupTime

# Create task settings
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable:$true

# Create the principal
$principal = New-ScheduledTaskPrincipal `
    -UserId "$env:USERDOMAIN\$env:USERNAME" `
    -LogonType Interactive `
    -RunLevel Highest

# Register the scheduled task
try {
    # Remove existing task if it exists
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
    
    # Create new task
    Register-ScheduledTask `
        -TaskName $taskName `
        -Description $taskDescription `
        -Action $action `
        -Trigger $trigger `
        -Settings $settings `
        -Principal $principal | Out-Null
    
    Write-Host "`nAutomatic cloud backup configured!" -ForegroundColor Green
    Write-Host "`nBackup Schedule:" -ForegroundColor Cyan
    Write-Host "  Runs every night at $backupTime" -ForegroundColor White
    Write-Host "  Saves to: Google Drive\TradeFlow_Backups\" -ForegroundColor White
    Write-Host "  Format: ZIP files (compressed)" -ForegroundColor White
    Write-Host "  Auto-syncs to cloud" -ForegroundColor White
    
    Write-Host "`nWhat gets backed up:" -ForegroundColor Yellow
    Write-Host "  All source code (src/)" -ForegroundColor White
    Write-Host "  Assets (public/)" -ForegroundColor White
    Write-Host "  Database config (supabase/)" -ForegroundColor White
    Write-Host "  Config files (.env, package.json, etc.)" -ForegroundColor White
    Write-Host "  Documentation" -ForegroundColor White
    
    Write-Host "`nUseful Commands:" -ForegroundColor Cyan
    Write-Host "  Test now: .\backup-to-google-drive.ps1" -ForegroundColor White
    Write-Host "  View task: taskschd.msc" -ForegroundColor White
    Write-Host "  Disable: Disable-ScheduledTask -TaskName '$taskName'" -ForegroundColor White
    Write-Host "  Remove: Unregister-ScheduledTask -TaskName '$taskName'" -ForegroundColor White
    
    Write-Host "`nBenefits of Cloud Backup:" -ForegroundColor Yellow
    Write-Host "  Protected from computer failure" -ForegroundColor Green
    Write-Host "  Access backups from any device" -ForegroundColor Green
    Write-Host "  Version history in Google Drive" -ForegroundColor Green
    Write-Host "  Automatic sync to cloud" -ForegroundColor Green
    
    Write-Host "`nRemember: Keep local backups too for faster recovery!" -ForegroundColor Yellow
    
} catch {
    Write-Host "`nError creating scheduled task:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host "`nTry running PowerShell as Administrator." -ForegroundColor Yellow
}
