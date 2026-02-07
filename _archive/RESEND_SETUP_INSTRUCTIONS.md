# How to Add RESEND_API_KEY to Supabase

## Quick Steps

You can use your existing Resend API key - no need to create a new one!

### Step 1: Get Your API Key from Resend

1. Go to: https://resend.com/api-keys
2. Find your existing Supabase API key
3. Copy it (it should start with `re_`)

### Step 2: Add Secret to Supabase Dashboard

1. Go to: https://supabase.com/dashboard/project/hyhjxdgdetdqoyoscflu/settings/functions
2. Scroll down to **"Edge Function Secrets"** section
3. Click **"Add new secret"**
4. Enter:
   - **Name:** `RESEND_API_KEY`
   - **Value:** (paste your API key from Resend)
5. Click **"Save"** or **"Add"**

### Step 3: Verify and Test

1. After adding the secret, wait 10-20 seconds for it to propagate
2. Go back to your app: http://localhost:5174/
3. Navigate to a proposal page
4. Select a contractor with an email
5. Click **"📧 Email Proposal"**
6. You should see success!

## Important Notes

### Domain Verification
Make sure `dustinelectrical.com` is verified in your Resend account:
- Go to: https://resend.com/domains
- Check if `dustinelectrical.com` is listed and verified
- The function sends from: `proposals@dustinelectrical.com`

### If You Need to Change the Sender Email
Edit the file: `supabase/functions/send-proposal/index.ts`
Find this line (around line 166):
```typescript
from: 'proposals@dustinelectrical.com',
```
Change it to your verified domain/email.

Then redeploy:
```powershell
supabase functions deploy send-proposal
```

## Troubleshooting

### "RESEND_API_KEY is not set" Error
- Make sure you added the secret with the exact name: `RESEND_API_KEY` (case-sensitive)
- Wait 10-20 seconds after adding it
- Try sending again

### Email Not Arriving
- Check Resend logs: https://resend.com/emails
- Verify your domain is set up correctly
- Check spam folder
- Make sure the recipient email is valid

### Domain Not Verified
If `dustinelectrical.com` isn't verified in Resend:
- Option 1: Verify the domain (requires DNS records)
- Option 2: Use Resend's test domain for development: `onboarding@resend.dev`
  - Edit the function and change the `from:` email
  - Redeploy the function

---

**Quick Link to Function Settings:**
https://supabase.com/dashboard/project/hyhjxdgdetdqoyoscflu/settings/functions
