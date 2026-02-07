# Setup Automatic Nightly Backup for TradeFlow
# This script creates a Windows Task Scheduler task to run backups every night at 2 AM

Write-Host "Setting up automatic nightly backup..." -ForegroundColor Green

# Get the full path to the backup script
$scriptPath = Join-Path $PSScriptRoot "create-backup.ps1"
$projectPath = $PSScriptRoot

# Task settings
$taskName = "TradeFlow_Nightly_Backup"
$taskDescription = "Automatically backs up TradeFlow essential files every night at 2 AM"
$backupTime = "2:00AM"  # Change this time if you want a different schedule

# Create the scheduled task action
$action = New-ScheduledTaskAction `
    -Execute "PowerShell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`"" `
    -WorkingDirectory $projectPath

# Create the trigger (daily at 2 AM)
$trigger = New-ScheduledTaskTrigger -Daily -At $backupTime

# Create task settings
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable:$false

# Create the principal (run with highest privileges)
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
    
    Write-Host "`n✅ Automatic backup successfully configured!" -ForegroundColor Green
    Write-Host "`nBackup Schedule:" -ForegroundColor Cyan
    Write-Host "  • Runs every night at $backupTime" -ForegroundColor White
    Write-Host "  • Location: C:\Users\dusti\" -ForegroundColor White
    Write-Host "  • Format: TradeFlow_Backup_YYYY-MM-DD_HHMM" -ForegroundColor White
    
    Write-Host "`nUseful Commands:" -ForegroundColor Yellow
    Write-Host "  • View task: taskschd.msc" -ForegroundColor White
    Write-Host "  • Test now: .\create-backup.ps1" -ForegroundColor White
    Write-Host "  • Disable: Disable-ScheduledTask -TaskName '$taskName'" -ForegroundColor White
    Write-Host "  • Remove: Unregister-ScheduledTask -TaskName '$taskName'" -ForegroundColor White
    
    Write-Host "`n💡 Tip: Old backups will accumulate. Clean them up monthly to save disk space." -ForegroundColor Yellow
    
} catch {
    Write-Host "`n❌ Error creating scheduled task:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host "`nTry running PowerShell as Administrator." -ForegroundColor Yellow
}
