# Migrate dmlelectrical.com Away from Wix → Resend + Vercel

## What We're Doing
- Remove Wix DNS records from Microsoft 365
- Add Resend domain verification records (so emails send from noreply@dmlelectrical.com)
- Point app.dmlelectrical.com → Vercel (your TradeFlow app)

---

## STEP 1: Log Into Microsoft 365 Admin Center
👉 https://admin.microsoft.com

1. Sign in with **dustin@dmlelectrical.com**
2. Go to **Settings → Domains**
3. Click **dmlelectrical.com**
4. Click the **DNS records** tab

---

## STEP 2: DELETE the Wix Records

Find and **DELETE** these records (they point to Wix):

| Type  | Host | Value to DELETE |
|-------|------|-----------------|
| A     | @    | 185.230.63.107  |
| CNAME | www  | www.wixdns.net  |

⚠️ Do NOT delete any MX records — those handle your email (Microsoft 365)

---

## STEP 3: Get Resend DNS Records

👉 Go to: https://resend.com/domains

1. Click **+ Add Domain**
2. Enter: **dmlelectrical.com**
3. Resend will show you DNS records to add. They will look like:

| Type  | Host                        | Value                          |
|-------|-----------------------------|--------------------------------|
| TXT   | resend._domainkey           | p=...long key...               |
| TXT   | @  (or dmlelectrical.com)   | v=spf1 include:resend.com ~all |
| MX    | send (or bounce)            | feedback-smtp.us-east-1.amazonses.com |

⚠️ Copy the EXACT values Resend shows you — don't use the examples above

---

## STEP 4: Add Resend DNS Records in Microsoft 365

Back in Microsoft 365 Admin → dmlelectrical.com → DNS records:

Add each record Resend showed you:

### TXT Record (DKIM key):
| Field | Value |
|-------|-------|
| Type | TXT |
| Name/Host | resend._domainkey |
| Value | (paste from Resend) |
| TTL | 3600 |

### SPF Record:
| Field | Value |
|-------|-------|
| Type | TXT |
| Name/Host | @ |
| Value | v=spf1 include:resend.com ~all |
| TTL | 3600 |

⚠️ If you already have an SPF record, you need to MERGE them, not add a second one.
Example merged: `v=spf1 include:spf.protection.outlook.com include:resend.com ~all`

---

## STEP 5: Add Vercel CNAME (for app.dmlelectrical.com)

Still in Microsoft 365 DNS records, add:

| Type  | Host | Points to |
|-------|------|-----------|
| CNAME | app  | cname.vercel-dns.com |

Then in Vercel (https://vercel.com):
1. Go to your **tradeflow** project → Settings → Domains
2. Add: **app.dmlelectrical.com**
3. Vercel will verify the CNAME automatically

---

## STEP 6: Verify Domain in Resend

1. Go back to https://resend.com/domains
2. Click **Verify** next to dmlelectrical.com
3. Wait 5-15 minutes for DNS to propagate
4. Status should change to ✅ Verified

---

## STEP 7: Deploy Updated Edge Functions

Run this in your terminal:

```bash
npx supabase functions deploy send-invoice
npx supabase functions deploy send-estimate
npx supabase functions deploy send-proposal
npx supabase functions deploy send-timesheet
```

---

## STEP 8: Confirm Supabase Secrets Are Set

Run:
```bash
npx supabase secrets list
```

You should see:
- ✅ RESEND_API_KEY
- ✅ SITE_URL

If SITE_URL is missing, set it:
```bash
npx supabase secrets set SITE_URL=https://app.dmlelectrical.com
```

---

## What Changes After This

| Before | After |
|--------|-------|
| From: onboarding@resend.dev | From: noreply@dmlelectrical.com |
| Wix website at dmlelectrical.com | Nothing at root (or redirect) |
| App at tradeflow-app.vercel.app | App at app.dmlelectrical.com |

---

## DNS Propagation Check

After adding records, verify with:
```bash
nslookup -type=TXT resend._domainkey.dmlelectrical.com
```

Or use: https://dnschecker.org

---

## Troubleshooting

**"Domain not verified" in Resend:**
- Wait 15-30 minutes and try verifying again
- Make sure TXT records were saved correctly in Microsoft 365

**Emails still showing onboarding@resend.dev:**
- Make sure edge functions were redeployed
- Check Resend domain status is "Verified"

**app.dmlelectrical.com not working:**
- Check CNAME record was added in Microsoft 365
- Make sure domain was added in Vercel project settings
