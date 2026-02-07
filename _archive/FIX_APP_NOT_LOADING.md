# Fix: App Not Loading After Uninstall

## What Happened
We changed the package name from `com.dmlelectric.timeclockmobile` to `com.dmlelectric.tradeflow`, which made Android think it's a completely new app. When you uninstalled the old one, Expo Go lost the connection.

## Quick Fix (2 Minutes)

### Step 1: Clear Everything and Restart
Run these commands in order:

```bash
cd c:\Users\dusti\estimator-react\timeclock-mobile
npx expo start --clear
```

This will:
- Clear all caches
- Start fresh dev server
- Show a new QR code

### Step 2: Scan QR Code Again
1. Open Expo Go on your phone
2. Scan the NEW QR code
3. App should load with TradeFlow branding!

## If That Doesn't Work...

### Option A: Reset Expo Go Cache
1. On your phone, open Expo Go
2. Shake your phone to open dev menu
3. Tap "Settings"
4. Tap "Clear cache"
5. Go back and scan QR code again

### Option B: Reinstall Expo Go
1. Uninstall Expo Go from your phone
2. Reinstall it from Google Play Store
3. Open it
4. Scan the QR code

### Option C: Use Different Connection Method
Instead of QR code, use the URL:

1. After running `npx expo start`, look for a line like:
   ```
   exp://192.168.1.xxx:8081
   ```
2. In Expo Go, tap "Enter URL manually"
3. Type that URL
4. Press "Connect"

## Still Having Issues?

The package name change might be the problem. Let's revert it temporarily:

### Revert Package Name (If needed)
I can change it back to the old package name so the app loads, then we'll change it later when you build for Play Store.

---

## What To Do Right Now:

**Run this command:**
```bash
cd c:\Users\dusti\estimator-react\timeclock-mobile
npx expo start --clear
```

Then scan the QR code on your phone!

Let me know if it works or what error you see.
