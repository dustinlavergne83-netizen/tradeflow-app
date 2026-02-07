# Cleanup Old TradeFlow Backups
# Keeps only the last 7 backups, deletes older ones to save disk space

$backupFolder = "C:\Users\dusti"
$backupPattern = "TradeFlow_Backup_*"
$keepCount = 14  # Keep last 14 backups (2 weeks)

Write-Host "Cleaning up old backups..." -ForegroundColor Yellow
Write-Host "Keeping most recent $keepCount backups`n" -ForegroundColor Cyan

# Get all backup folders, sorted by creation date (newest first)
$backups = Get-ChildItem -Path $backupFolder -Directory -Filter $backupPattern | 
    Sort-Object CreationTime -Descending

$totalBackups = $backups.Count
$toDelete = $backups | Select-Object -Skip $keepCount

Write-Host "Found $totalBackups backup(s)" -ForegroundColor White

if ($toDelete.Count -gt 0) {
    Write-Host "Deleting $($toDelete.Count) old backup(s)..." -ForegroundColor Yellow
    
    foreach ($backup in $toDelete) {
        Write-Host "  Deleting: $($backup.Name)" -ForegroundColor Gray
        Remove-Item -Path $backup.FullName -Recurse -Force
    }
    
    Write-Host "`n✅ Cleanup complete!" -ForegroundColor Green
    Write-Host "Kept: $keepCount most recent backups" -ForegroundColor White
    Write-Host "Deleted: $($toDelete.Count) old backups" -ForegroundColor White
} else {
    Write-Host "✅ No old backups to delete (only $totalBackups backup(s) exist)" -ForegroundColor Green
}

# Also cleanup old ZIP files if they exist
$zipBackups = Get-ChildItem -Path $backupFolder -File -Filter "TradeFlow_Backup_*.zip" |
    Sort-Object CreationTime -Descending

$oldZips = $zipBackups | Select-Object -Skip $keepCount

if ($oldZips.Count -gt 0) {
    Write-Host "`nCleaning up old ZIP backups..." -ForegroundColor Yellow
    foreach ($zip in $oldZips) {
        Write-Host "  Deleting: $($zip.Name)" -ForegroundColor Gray
        Remove-Item -Path $zip.FullName -Force
    }
    Write-Host "✅ Deleted $($oldZips.Count) old ZIP backup(s)" -ForegroundColor Green
}
