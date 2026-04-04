# Use Your Business Number Without Porting — Setup Guide

Since your number can't be ported right now, here's how to make the system
work WITH your existing number using Verified Caller ID + Call Forwarding.

This takes about 15 minutes total.

---

## Part 1 — Verify Your Business Number in Twilio (10 min)
This makes your outbound calls show your real business number to customers.

1. Go to: https://console.twilio.com/us1/develop/phone-numbers/verified-caller-ids
2. Click **"Add a new Caller ID"**
3. Enter your business phone number (e.g., +13185551234)
4. Twilio will CALL that number with a 6-digit code
5. Answer the call, enter the code
6. ✅ Your number is now verified

### Add to Supabase as a secret:
Go to: https://supabase.com/dashboard/project/hyhjxdgdetdqoyoscflu/settings/functions

Click **"Add new secret"** and add:
- **Name:** `TWILIO_CALLER_ID`
- **Value:** `+1YOURNUMBER` (use E.164 format, e.g., +13185551234)

After saving, the `twilio-connect-call` function will automatically use your
real number as the caller ID on all outbound calls.

---

## Part 2 — Forward Inbound Calls to Twilio (5 min)
This makes calls to your business number ring through to the app (and your phone).

### If you have AT&T:
- Dial `*72` then your Twilio number
- Example: `*72 +13187654321` (your Twilio number)
- Press Call — wait for confirmation tone

### If you have Spectrum/Charter Business:
- Log in to Spectrum Business portal
- Phone → Call Forwarding → Forward to Twilio number

### If you have a VoIP system (RingCentral, Vonage, etc.):
- Log in to your VoIP admin portal
- Set call forwarding/redirect to your Twilio number

### If you have a cell phone as business line:
- Settings → Phone → Call Forwarding → Forward to Twilio number
  (AT&T cell: dial *21* + Twilio number + # then press Call)

---

## Part 3 — Forward Inbound SMS (optional — can't be auto-forwarded)
SMS cannot be automatically forwarded between carriers.

**Options for inbound texts:**
1. **Tell customers your new Twilio number for texts** — set it as your "text line"
2. **Use your business number for calls, Twilio number for texts** — many businesses do this
3. **Port the number later** when it becomes available — then everything unifies

---

## How It Works After Setup

```
Customer calls YOUR real number
  → Forwarded to Twilio number
  → Twilio handles it (rings your phone)
  → Call logged in the app
  → Voicemail captured if missed

You call customer from app
  → Customer sees YOUR real number (Verified Caller ID)
  → Call recorded if you choose
  → Logged in app

Customer texts Twilio number
  → Shows in app inbox
  → You reply from app (shows Twilio number)
```

---

## Result
- ✅ Outbound calls: customers see your real business number
- ✅ Inbound calls: your business number rings through the app
- ⚠️ Inbound/outbound texts: still use Twilio number (unless you port later)

This is a solid working setup. Port the number later when it's available
to get full unification.
