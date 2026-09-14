# google-services.json required before building

`app.json` now references `./google-services.json` (required by the Twilio
Voice React Native SDK for Android push notifications / incoming calls).

**This file does not exist yet — any `eas build` for Android will fail until
it's added.**

## How to get it

1. Go to https://console.firebase.google.com → Create a project (any name,
   e.g. "DML Comms" or "TradeFlow Comms").
2. Add an Android app to the project:
   - Package name: `com.dmlelectric.comms` (must match `app.json` exactly)
3. Download the generated `google-services.json`.
4. Place it at `comms-mobile/google-services.json` (same folder as `app.json`).
5. In Firebase Console → Project Settings → Cloud Messaging → generate a
   **service account key** (JSON) — this is separate from google-services.json
   and is needed for the Twilio Push Credential (Voice → Push Credentials →
   Create → Android/FCM), not for the app itself.

Once the real file is in place, delete this note.
