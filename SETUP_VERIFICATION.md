# Setup Verification - Complete This BEFORE Sending Test Email

## Current Status: Setup Not Complete

If you don't see webhook anywhere or activity, the setup isn't done yet. Let's verify each step:

---

## Step 1: Check DNS MX Record (REQUIRED)

### Verify Your MX Record is Set:

**Windows Command:**
```cmd
nslookup -type=MX paystubs.dmlelectrical.com
```

**Expected Result:**
```
paystubs.dmlelectrical.com    MX preference = 10, mail exchanger = mx.sendgrid.net
```

**If you see "Non-existent domain" or no MX record:**
❌ **DNS record not added yet!**

### How to Add MX Record:

1. **Go to your domain registrar** (where you bought dmlelectrical.com)
   - GoDaddy, Cloudflare, Namecheap, etc.

2. **Find DNS settings**:
   - Look for "DNS Management" or "DNS Records"

3. **Add this MX record**:
   ```
   Type: MX
   Name: paystubs (or Host: paystubs)
   Value: mx.sendgrid.net
   Priority: 10
   TTL: 3600 (or Auto)
   ```

4. **Save and wait 10-15 minutes** for DNS propagation

---

## Step 2: Configure SendGrid Inbound Parse (REQUIRED)

### You Need To Do This In SendGrid:

1. **Go to SendGrid Dashboard**: https://app.sendgrid.com/

2. **Navigate to Inbound Parse**:
   - Click **Settings** in left sidebar
   - Click **Inbound Parse**
   - (NOT "Activity" - that's for outbound emails!)

3. **Click "Add Host & URL" button**

4. **Fill out the form**:
   
   **Subdomain:** `paystubs`
   
   **Domain:** `dmlelectrical.com`
   
   **Destination URL:** `YOUR_SUPABASE_FUNCTION_URL`
   - Format: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/process-check-stub-email`
   - Find your project ref in Supabase Dashboard → Settings → General
   
   **Check spam:** Leave unchecked (or check if you want)
   
   **POST the raw, full MIME message:** Leave UNCHECKED

5. **Click "Add"**

6. **You should now see**:
   - Your hostname listed: `paystubs.dmlelectrical.com`
   - The destination URL
   - A status indicator

---

## Step 3: Deploy Supabase Function (REQUIRED)

### Have You Deployed the Function?

```bash
cd c:/Users/dusti/estimator-react
supabase login
supabase functions deploy process-check-stub-email
```

**After deployment, you'll get a URL like:**
```
https://abcdefghijk.supabase.co/functions/v1/process-check-stub-email
```

**Copy this URL** - you need it for SendGrid Inbound Parse!

---

## Step 4: Verify Setup is Complete

### Checklist Before Sending Test Email:

- [ ] MX record added to DNS (verified with nslookup command)
- [ ] Waited 10-15 minutes after adding DNS record
- [ ] Created SendGrid Inbound Parse webhook
- [ ] Destination URL points to your Supabase function
- [ ] Supabase function is deployed
- [ ] Storage bucket `check-stubs` exists in Supabase

---

## Where To Find Things in SendGrid

### Inbound Parse (Where You Configure Webhook):
1. Log into https://app.sendgrid.com/
2. Click **Settings** (left sidebar)
3. Click **Inbound Parse**
4. You should see your configuration OR a button to "Add Host & URL"

**Screenshot: What It Looks Like:**
- You'll see a list of configured hostnames
- Each hostname shows the destination URL
- There's an "Add Host & URL" button at the top

### Activity (Where Emails Show AFTER Setup):
This is only for emails you SEND, not receive!
- For inbound emails, logs appear in Inbound Parse section

---

## Common Mistakes

### Mistake 1: Looking in "Activity" for inbound emails
❌ **Wrong:** Activity tab is for OUTBOUND emails you send
✅ **Right:** Inbound Parse section for emails you RECEIVE

### Mistake 2: Not adding DNS MX record
❌ Without MX record, emails can't reach SendGrid
✅ Must add MX record to your domain registrar

### Mistake 3: Wrong webhook URL
❌ Using wrong Supabase project reference
✅ Get correct URL from Supabase after deploying

---

## Quick Setup Summary

**1. Deploy Function:**
```bash
supabase functions deploy process-check-stub-email
```
Copy the URL you get!

**2. Add DNS MX Record** at your domain registrar:
- Name: `paystubs`
- Type: MX
- Value: `mx.sendgrid.net`
- Priority: 10

**3. Configure SendGrid Inbound Parse:**
- Go to Settings → Inbound Parse
- Click "Add Host & URL"
- Subdomain: `paystubs`
- Domain: `dmlelectrical.com`
- URL: Your Supabase function URL

**4. Wait 10-15 minutes** for DNS

**5. Send test email!**

---

## What To Do Next:

### Option A: You Haven't Started Setup Yet
→ Follow the steps in **SENDGRID_AUTOMATIC_SETUP.md**
→ Start with deploying the Supabase function

### Option B: You've Partially Set Up
→ Use the checklist above to see what's missing
→ Most likely: DNS record not added OR Inbound Parse not configured

### Option C: Setup is Complete
→ Wait 15 minutes after DNS changes
→ Then send test email
→ Then check using **TEST_EMAIL_CHECKLIST.md**

---

## Need Help Right Now?

Tell me:
1. **Have you deployed the Supabase function?** (Yes/No)
2. **Have you added the MX DNS record?** (Yes/No)
3. **Have you configured Inbound Parse in SendGrid?** (Yes/No)

I can help you with whichever step you're on!
