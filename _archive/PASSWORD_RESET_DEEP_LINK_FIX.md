# Password Reset Deep Link Fix

## Problem Identified

The password reset link was showing "requested path not valid" because the **deep link URL scheme was missing** from the app configuration.

### Root Cause

The `app.json` file was missing the `scheme` configuration required for handling deep links like `tradeflow://auth/callback`.

When users clicked the password reset email link, the mobile device didn't know which app should handle the `tradeflow://` URL scheme, resulting in the error.

## Fix Applied

### Updated: `timeclock-mobile/app.json`

Added the missing scheme configuration:

```json
{
  "expo": {
    "name": "TradeFlow",
    "slug": "timeclock-mobile",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "scheme": "tradeflow",    // ← THIS WAS MISSING!
    "splash": {
      // ... rest of config
    }
  }
}
```

## Required Actions to Complete Fix

### 1. Rebuild the Mobile App

The app **MUST be rebuilt** with the new configuration for the fix to take effect:

#### For Development (Expo Go):
```bash
cd timeclock-mobile
npx expo start
```

Then scan the QR code with your device.

#### For Production Build (Android):
```bash
cd timeclock-mobile
eas build --platform android --profile production
```

After build completes, download and install the new APK on devices.

### 2. Verify Supabase Configuration

Ensure your Supabase dashboard has the correct redirect URL configured:

1. Go to Supabase Dashboard → Authentication → URL Configuration
2. Under **Redirect URLs**, verify this URL is added:
   ```
   tradeflow://auth/callback
   ```
3. If not present, add it and save

### 3. Test the Password Reset Flow

Once the app is rebuilt and reinstalled:

1. **Request Password Reset:**
   - Open the app
   - Enter your email address
   - Tap "Forgot password?"
   - Check for success message

2. **Check Email:**
   - Open the password reset email
   - Verify the link format looks like:
     ```
     tradeflow://auth/callback?token=...&type=recovery
     ```

3. **Click the Reset Link:**
   - Click/tap the link in the email
   - The app should automatically open
   - You should see a "Processing invite..." message briefly
   - Then be redirected to the "Set Your Password" screen

4. **Set New Password:**
   - Enter a new password (minimum 6 characters)
   - Confirm the password
   - Tap "Set Password"
   - Should see success message and redirect to timeclock

## Why This Fix Works

### Deep Linking Basics

Mobile apps use URL schemes (like `https://`, `mailto:`, etc.) to handle links. Custom schemes (like `tradeflow://`) require explicit configuration.

### The Flow Now Works:

1. **User requests password reset** → Supabase sends email with `tradeflow://auth/callback?token=...`
2. **User clicks link** → Mobile OS looks for apps that handle `tradeflow://` scheme
3. **App is found** → Because `app.json` now declares `"scheme": "tradeflow"`
4. **App opens** → Expo Router handles the `/auth/callback` path
5. **Callback page** → Processes the token and redirects to set-password
6. **User resets password** → Success!

## Troubleshooting

### Issue: Link still doesn't work after rebuilding

**Solution:** Make sure you completely reinstalled the app. Simply updating over an existing install may not always update the deep link configuration. Try:
1. Uninstall the old app completely
2. Install the newly built app
3. Test again

### Issue: "Session expired" error

**Solution:** Password reset tokens expire after 1 hour (Supabase default). Request a new password reset link.

### Issue: Email not received

**Solutions:**
- Check spam/junk folder
- Verify the email address exists in Supabase auth users
- Check Supabase email settings are configured correctly

### Issue: App doesn't open from link

**Solutions:**
- Verify the app was rebuilt with the new `app.json` configuration
- Confirm the app is properly installed (not just running in Expo Go with old config)
- Check that the link format is correct: `tradeflow://auth/callback?token=...&type=recovery`

## Additional Configuration Notes

### For iOS (if you add iOS support later)

You'll also need to configure Associated Domains in `app.json`:

```json
{
  "expo": {
    "ios": {
      "bundleIdentifier": "com.dmlelectric.tradeflow",
      "associatedDomains": ["applinks:yourdomain.com"]
    }
  }
}
```

### For Android Manifest (handled automatically by Expo)

The `scheme` configuration in `app.json` automatically adds the necessary intent filters to the Android manifest. You don't need to manually edit AndroidManifest.xml.

## Security Considerations

- Password reset tokens expire after 1 hour
- Tokens are one-time use only
- Users must complete password reset in the same session
- Minimum password length is 6 characters (can be increased in Supabase settings)

## Summary

✅ **Fixed:** Added `"scheme": "tradeflow"` to `app.json`

📱 **Next Step:** Rebuild and reinstall the mobile app

🔒 **Result:** Password reset links will now properly open the app and allow users to reset their passwords

## Files Modified

- `timeclock-mobile/app.json` - Added scheme configuration

## Related Documentation

- `timeclock-mobile/PASSWORD_RESET_IMPLEMENTATION.md` - Original implementation guide
- `timeclock-mobile/app/auth/callback.tsx` - Handles the deep link callback
- `timeclock-mobile/app/auth/set-password.tsx` - Password reset form
- `timeclock-mobile/app/sign-in.tsx` - "Forgot password" functionality
