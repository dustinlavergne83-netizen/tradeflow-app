# Publishing the DML Time Clock Mobile App

## ✅ What Was Updated

The employee invite email now includes:
- **📱 Download for iPhone** button (App Store link)
- **📱 Download for Android** button (Google Play link)
- **Web version link** as alternative

## 🚨 Important: App Store Links Need to Be Updated

The current email template has **placeholder links**:
```
iPhone: https://apps.apple.com/app/dml-timeclock
Android: https://play.google.com/store/apps/details?id=com.dml.timeclock
Web: https://timeclock.dmlelectrical.com
```

**You need to:**
1. Publish your app to App Store and Google Play
2. Update the links in the email template with your actual app URLs

## Publishing to Apple App Store

### Prerequisites
- Apple Developer Account ($99/year) - https://developer.apple.com/
- Mac computer (required for App Store submission)
- Xcode installed

### Steps to Publish

1. **Configure App in EAS**
   ```bash
   cd timeclock-mobile
   npx eas build:configure
   ```

2. **Build for iOS**
   ```bash
   npx eas build --platform ios
   ```

3. **Submit to App Store**
   ```bash
   npx eas submit --platform ios
   ```

4. **In App Store Connect:**
   - Go to https://appstoreconnect.apple.com/
   - Fill in app information
   - Add screenshots
   - Submit for review (1-3 days)

5. **Get Your App Store URL:**
   - After approval: `https://apps.apple.com/app/your-app-name/id1234567890`
   - Update the email template with this URL

## Publishing to Google Play Store

### Prerequisites
- Google Play Developer Account ($25 one-time fee)
- Android Studio (recommended)

### Steps to Publish

1. **Build for Android**
   ```bash
   cd timeclock-mobile
   npx eas build --platform android
   ```

2. **Submit to Google Play**
   ```bash
   npx eas submit --platform android
   ```

3. **In Google Play Console:**
   - Go to https://play.google.com/console
   - Create app listing
   - Add screenshots, description
   - Submit for review (usually 1-2 days)

4. **Get Your Play Store URL:**
   - After approval: `https://play.google.com/store/apps/details?id=com.dml.timeclock`
   - Update the email template with this URL

## Alternative: TestFlight / Internal Testing

If you're not ready to publish publicly:

### iOS TestFlight (Beta Testing)
```bash
npx eas build --platform ios --profile preview
npx eas submit --platform ios --latest
```
- Get TestFlight link to share
- Up to 10,000 beta testers
- No App Store approval needed

### Android Internal Testing
```bash
npx eas build --platform android --profile preview
```
- Upload to Google Play Internal Testing
- Share link with testers
- No public listing needed

## Updating Email Template with Real Links

Once you have your app store URLs, update the invite email:

1. **Edit the function:**
   ```bash
   code supabase/functions/invite-employee/index.ts
   ```

2. **Replace the placeholder links:**
   ```typescript
   // Find these lines:
   <a href="https://apps.apple.com/app/dml-timeclock" ...>
   <a href="https://play.google.com/store/apps/details?id=com.dml.timeclock" ...>
   
   // Replace with your actual URLs:
   <a href="https://apps.apple.com/app/dml-timeclock/id1234567890" ...>
   <a href="https://play.google.com/store/apps/details?id=com.yourcompany.timeclock" ...>
   ```

3. **Deploy the updated function:**
   ```bash
   npx supabase functions deploy invite-employee
   ```

## Option: Skip App Stores (For Now)

If you want employees to use the app immediately without waiting for app store approval:

### Option 1: Expo Go (Development)
Employees can:
1. Install Expo Go from app stores
2. Scan QR code to run your app
3. Use during development/testing

**To share:**
```bash
cd timeclock-mobile
npx expo start
```
- Share the QR code with employees
- They scan it in Expo Go app

### Option 2: Direct APK (Android Only)
```bash
npx eas build --platform android --profile preview
```
- Download the .apk file
- Share it directly with Android employees
- They install it manually

### Option 3: Web App (All Devices)
Host the web version:
```bash
cd timeclock-mobile
npx expo export:web
```
- Deploy to Netlify/Vercel
- Update email with web URL
- Works on any device with a browser

## Recommended Approach

**For Immediate Use:**
1. Remove app store links from email (they don't work yet)
2. Add a web app URL or Expo Go instructions
3. Send invites to employees

**For Production:**
1. Publish apps to App Store and Google Play
2. Update email template with real links
3. Redeploy the function
4. Future invites will have working links

## Update Email Template Now

You have 3 choices:

### Choice 1: Remove App Links (Temporary)
Remove the app download buttons until apps are published. Employees use web version only.

### Choice 2: Use Expo Go Instructions
Replace app store links with Expo Go instructions for testing.

### Choice 3: Publish Apps First
Complete app store submissions, then update links with real URLs.

## Which Do You Want?

Let me know which approach you prefer, and I can update the email template accordingly:

1. **Remove app download buttons** - Keep it simple, web-only for now
2. **Add Expo Go instructions** - For beta testing with team
3. **Keep placeholder links** - Publish apps soon and update links

## EAS Configuration File

Your `timeclock-mobile/eas.json` should already be configured. If not, create:

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "app-bundle"
      }
    }
  },
  "submit": {
    "production": {}
  }
}
```

## Resources

- **Expo Docs:** https://docs.expo.dev/
- **EAS Build:** https://docs.expo.dev/build/introduction/
- **EAS Submit:** https://docs.expo.dev/submit/introduction/
- **App Store Guidelines:** https://developer.apple.com/app-store/review/guidelines/
- **Google Play Policies:** https://play.google.com/about/developer-content-policy/

## Current Status

✅ Email template includes app download buttons  
⚠️ Links are placeholders - need to be updated  
✅ Web version can work immediately  
⏳ App Store / Google Play publication pending  

Next step: Decide which approach to use and I can update the email template accordingly.
