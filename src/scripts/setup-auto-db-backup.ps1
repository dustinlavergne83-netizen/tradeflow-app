# Setup Automatic Nightly DATABASE Backup for TradeFlow
# Schedules backup-database.cjs to run every night at 2 AM, exporting all
# Supabase table data to Google Drive. This is separate from and
# complementary to setup-auto-backup-cloud.ps1, which only backs up source
# code (src/, public/, supabase/) and never touches the database.

Write-Host "Setting up automatic nightly database backup..." -ForegroundColor Green

# Repo root is two levels up from src/scripts/
$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$scriptPath = Join-Path $PSScriptRoot "backup-database.cjs"

$nodePath = (Get-Command node -ErrorAction Stop).Source

$taskName = "TradeFlow_Database_Backup"
$taskDescription = "Nightly export of all TradeFlow/Supabase database tables to Google Drive (2 AM)"
$backupTime = "2:00AM"

$action = New-ScheduledTaskAction `
    -Execute $nodePath `
    -Argument "`"$scriptPath`"" `
    -WorkingDirectory $repoRoot

$trigger = New-ScheduledTaskTrigger -Daily -At $backupTime

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable:$true

$principal = New-ScheduledTaskPrincipal `
    -UserId "$env:USERDOMAIN\$env:USERNAME" `
    -LogonType Interactive `
    -RunLevel Limited

try {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

    Register-ScheduledTask `
        -TaskName $taskName `
        -Description $taskDescription `
        -Action $action `
        -Trigger $trigger `
        -Settings $settings `
        -Principal $principal | Out-Null

    Write-Host "`nAutomatic database backup configured!" -ForegroundColor Green
    Write-Host "`nBackup Schedule:" -ForegroundColor Cyan
    Write-Host "  Runs every night at $backupTime" -ForegroundColor White
    Write-Host "  Saves to: G:\My Drive\TradeFlow_Backups\db_data_*.json.gz" -ForegroundColor White
    Write-Host "  Retains the most recent 14 backups automatically" -ForegroundColor White

    Write-Host "`nWhat gets backed up:" -ForegroundColor Yellow
    Write-Host "  Every row of every table in the Supabase 'public' schema" -ForegroundColor White
    Write-Host "  (customers, invoices, estimates, expenses, time entries, etc.)" -ForegroundColor White

    Write-Host "`nUseful Commands:" -ForegroundColor Cyan
    Write-Host "  Test now:  node src\scripts\backup-database.cjs" -ForegroundColor White
    Write-Host "  Verify:    node src\scripts\verify-backup.cjs" -ForegroundColor White
    Write-Host "  View task: taskschd.msc" -ForegroundColor White
    Write-Host "  Disable:   Disable-ScheduledTask -TaskName '$taskName'" -ForegroundColor White
    Write-Host "  Remove:    Unregister-ScheduledTask -TaskName '$taskName'" -ForegroundColor White

    Write-Host "`nNote: this covers DATABASE rows only, not uploaded files (plans/photos)" -ForegroundColor Yellow
    Write-Host "in Supabase Storage. Ask if you want that covered too." -ForegroundColor Yellow

} catch {
    Write-Host "`nError creating scheduled task:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host "`nTry running PowerShell as Administrator." -ForegroundColor Yellow
}
