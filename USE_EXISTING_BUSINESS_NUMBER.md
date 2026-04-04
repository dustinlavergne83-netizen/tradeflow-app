# Using Your Existing Business Number with DML Comms

## The Problem
Right now the app uses a Twilio phone number (e.g., +1 318-XXX-XXXX) as the "business line."
Customers see that Twilio number, not your real business number.

## Solution: Port Your Number to Twilio

**Porting** means transferring your existing business number to Twilio.
After porting, Twilio controls the number — it works exactly the same for customers,
but now ALL calls and texts go through the app automatically.

---

## How to Port Your Number to Twilio

### Step 1 — Check if your number is portable
Go to: https://www.twilio.com/console/phone-numbers/port
Enter your current business number to verify it can be ported.

> **Most landlines, VoIP, and cell numbers can be ported.**
> AT&T, Spectrum, Comcast business lines all work.

### Step 2 — Do NOT cancel your current service yet
Keep your existing carrier active until the port is complete.
Canceling early will lose the number.

### Step 3 — Submit the port request in Twilio
1. Go to https://console.twilio.com/us1/develop/phone-numbers/port-requests
2. Click "Start a Port Request"
3. You'll need:
   - Your current carrier account number
   - The billing name on the account
   - Your current carrier's customer service PIN/password
   - A copy of your most recent phone bill (PDF)
4. Enter the phone number you want to port
5. Submit — Twilio will contact your carrier

### Step 4 — Wait (2–4 weeks)
Twilio handles everything with your carrier.
You'll get email updates.
Your number keeps working normally during this time.

### Step 5 — After port completes
Once ported, you'll see your real number in the Twilio console.

Update your `.env` / Supabase secret:
```
TWILIO_PHONE_NUMBER=+1YOURNUMBER
```

Update in Supabase (go to project settings → Edge Function Secrets):
- Key: `TWILIO_PHONE_NUMBER`
- Value: `+13181234567` (your real number in E.164 format)

Then reconfigure the Twilio webhooks for your number:
- Voice URL: `https://hyhjxdgdetdqoyoscflu.supabase.co/functions/v1/twilio-voice-inbound`
- SMS URL: `https://hyhjxdgdetdqoyoscflu.supabase.co/functions/v1/twilio-inbound-sms`

---

## Faster Option: Show Your Number on Outbound Calls (No Port Needed)

If you just want OUTBOUND calls to show your real number as caller ID:

1. Go to Twilio console → Phone Numbers → Verified Caller IDs
2. Click "Add a new Caller ID"
3. Enter your business number
4. Twilio calls you with a 6-digit verification code
5. Once verified, you can use it as the "from" number on outbound calls

**Limitation:** This only works for CALLS, not SMS.
For SMS, Twilio requires using a Twilio-registered number (10DLC).

To enable verified caller ID on outbound calls, edit the `twilio-connect-call` edge function:
Change `callerId` from the Twilio number to your verified number.

---

## SMS: Register for 10DLC (Keep Twilio number, just register business)

If you want your texts to come from a recognizable number,
the industry standard is 10DLC (10-Digit Long Code) registration:

1. Go to: https://console.twilio.com/us1/develop/sms/regulatory-compliance
2. Register your business (brand registration) — ~$4/month
3. Register your messaging use case
4. Approval takes 1-5 business days
5. After approval, your Twilio number is "verified" and carriers won't filter your texts

> This doesn't change the number — it just tells carriers your texts are legitimate,
> so they don't get marked as spam.

---

## Recommendation

| What you want | Solution | Time |
|---|---|---|
| Everything through real number | Port number to Twilio | 2-4 weeks |
| Outbound calls show real number | Verified Caller ID | 10 minutes |
| Texts don't get filtered as spam | 10DLC registration | 1-5 days |
| Quickest fix | Verified Caller ID + 10DLC | Same week |

**The best long-term solution is porting your number to Twilio.**
Once ported, your real business number handles everything — calls in, texts in, calls out, texts out — all through the app.
