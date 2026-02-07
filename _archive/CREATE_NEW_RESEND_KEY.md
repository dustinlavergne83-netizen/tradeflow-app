# How to Create a New Resend API Key

## Why You Need a New Key

API keys in Resend are only shown once when created. After that, they're hidden for security. You'll need to create a new one.

## Step-by-Step Instructions

### 1. Go to Resend API Keys Page
Visit: https://resend.com/api-keys

### 2. Create New API Key

1. Click the **"Create API Key"** button (usually blue button in top right)
2. Fill in the form:
   - **Name:** `Supabase Functions` (or any name you prefer)
   - **Permission:** Select **"Sending access"** (or "Full access" if you prefer)
   - **Domain:** Select your domain or "All domains"
3. Click **"Add"** or **"Create"**

### 3. Copy the API Key

⚠️ **IMPORTANT:** After creating the key, it will show you the full key ONCE.

1. You'll see something like: `re_123456789abcdefghijklmnop`
2. **Copy it immediately** - you won't be able to see it again!
3. Keep this window open while you add it to Supabase

### 4. Add to Supabase

1. Go to: https://supabase.com/dashboard/project/hyhjxdgdetdqoyoscflu/settings/functions
2. Scroll down to **"Edge Function Secrets"** section
3. Click **"Add new secret"** or the **"+"** button
4. Enter:
   - **Name:** `RESEND_API_KEY` (exactly like this, case-sensitive)
   - **Value:** (paste the API key you just copied)
5. Click **"Save"** or **"Add"**

### 5. Test It!

1. Wait 10-20 seconds for the secret to propagate
2. Go back to your app: http://localhost:5174/
3. Navigate to a proposal page
4. Click **"📧 Email Proposal"**
5. Success! 🎉

## What If I Already Created Multiple Keys?

That's fine! You can have multiple API keys. Just create a new one specifically for Supabase and use that.

## Alternative: Use CLI to Set Secret

If you prefer, you can also set the secret via CLI:

```powershell
# First, create the API key in Resend dashboard, then run:
supabase secrets set RESEND_API_KEY=re_your_actual_key_here
```

## Troubleshooting

### Can't Create API Key in Resend
- Make sure you're logged into the correct Resend account
- Check if you have permission to create API keys

### Secret Not Working After Adding
- Double-check the name is exactly: `RESEND_API_KEY`
- Make sure there are no extra spaces in the key value
- Wait 20-30 seconds and try again

### Domain Issues
Make sure `dustinelectrical.com` is verified in Resend:
- Go to: https://resend.com/domains
- If not verified, you can temporarily use: `onboarding@resend.dev` for testing
  - Edit `supabase/functions/send-proposal/index.ts`
  - Change the `from:` email
  - Redeploy: `supabase functions deploy send-proposal`

---

**Quick Links:**
- Create Key: https://resend.com/api-keys
- Add Secret: https://supabase.com/dashboard/project/hyhjxdgdetdqoyoscflu/settings/functions
- Check Domains: https://resend.com/domains
