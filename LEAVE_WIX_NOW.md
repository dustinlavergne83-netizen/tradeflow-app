# ✅ HOW TO LEAVE WIX — You Don't Need to Move Anything!

## Your Domain Situation
- **Domain registrar:** Wherever you originally bought it (GoDaddy, etc.)
- **DNS managed by:** Microsoft 365 Admin Center (ns1-4.bdm.microsoftonline.com)
- **Wix is NOT in control** — it's just 2 DNS records you added

## The Fix Is Simple: Delete 2 Records, Add Resend Records

---

## STEP 1: Go to Microsoft 365 Admin Center
👉 https://admin.microsoft.com
- Sign in: dustin@dmlelectrical.com
- Left menu → **Settings → Domains**
- Click **dmlelectrical.com**
- Click **DNS records** tab

---

## STEP 2: DELETE These 2 Wix Records

Look for these and **DELETE** them:

| Type  | Name/Host | Value |
|-------|-----------|-------|
| A     | @ (blank) | 185.230.63.107 |
| CNAME | www       | www.wixdns.net |

✅ This disconnects Wix. Your email will NOT break.
✅ Do NOT touch MX records.

---

## STEP 3: Add Resend DNS Records

Go to 👉 https://resend.com/domains
1. Click **+ Add Domain**
2. Type: **dmlelectrical.com** → click Add

Resend will show you records. Add them in Microsoft 365:

### Required TXT Record (DKIM — for email authentication):
| Type | Host | Value |
|------|------|-------|
| TXT | resend._domainkey | (copy from Resend) |

### SPF Record (may already exist — MERGE it, don't add a second):
If you already have a TXT record at `@` that starts with `v=spf1`, edit it to include `include:resend.com`:
```
v=spf1 include:spf.protection.outlook.com include:resend.com ~all
```

If there's no SPF record yet, add:
| Type | Host | Value |
|------|------|-------|
| TXT | @ | v=spf1 include:resend.com ~all |

---

## STEP 4: Add app.dmlelectrical.com → Vercel

Still in Microsoft 365 DNS, add:

| Type  | Host | Points to |
|-------|------|-----------|
| CNAME | app  | cname.vercel-dns.com |

Then go to: https://vercel.com → tradeflow project → Settings → Domains → Add **app.dmlelectrical.com**

---

## STEP 5: Verify in Resend

Back at https://resend.com/domains → click **Verify**

Wait 5-15 min. Once green ✅, emails will send from:
**noreply@dmlelectrical.com** (instead of onboarding@resend.dev)

---

## Summary: You Are NOT Moving Your Domain

Your domain stays:
- ✅ Registered wherever it was bought
- ✅ DNS managed by Microsoft 365
- ✅ Email (dustin@dmlelectrical.com) keeps working

You're just:
- ❌ Removing 2 Wix records
- ✅ Adding Resend records (so email works)
- ✅ Adding app subdomain → Vercel

**That's it!**
