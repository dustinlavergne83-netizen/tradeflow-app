# DML Comms AAB Build Script for Google Play
# This script builds the Android App Bundle for upload to Google Play Store

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  DML Comms AAB Build for Google Play  " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Navigate to the comms-mobile directory
$projectDir = "c:\Users\dusti\estimator-react\comms-mobile"

Write-Host "Navigating to: $projectDir" -ForegroundColor Yellow
Set-Location -Path $projectDir

Write-Host "Current directory: $(Get-Location)" -ForegroundColor Green
Write-Host ""

# Verify we're in the right directory
if (-not (Test-Path "app.json")) {
    Write-Host "ERROR: app.json not found! Not in comms-mobile directory." -ForegroundColor Red
    exit 1
}

Write-Host "✓ app.json found" -ForegroundColor Green
Write-Host "✓ Ready to build" -ForegroundColor Green
Write-Host ""

# Check EAS CLI login status
Write-Host "Checking EAS CLI authentication..." -ForegroundColor Yellow
npx eas whoami

Write-Host ""
Write-Host "Starting AAB build for Android (production)..." -ForegroundColor Cyan
Write-Host "This will take 15-25 minutes. Please wait..." -ForegroundColor Yellow
Write-Host ""

# Run the build command
npx eas build --platform android --profile production

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Build Complete!                      " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Green
Write-Host "1. Download the .aab file from the link above" -ForegroundColor Green
Write-Host "2. Go to: https://play.google.com/console" -ForegroundColor Green
Write-Host "3. Upload to Production release" -ForegroundColor Green
Write-Host "4. Submit for review" -ForegroundColor Green
Write-Host ""
