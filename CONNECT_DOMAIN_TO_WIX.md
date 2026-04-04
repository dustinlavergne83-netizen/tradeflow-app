# Connect dmlelectrical.com → Wix Website
## Your Domain is Managed by Microsoft 365

Your domain uses Microsoft's nameservers (ns1-4.bdm.microsoftonline.com), so
DNS is managed in the Microsoft 365 Admin Center — NOT GoDaddy or any other registrar.

---

## STEP 1: Get Wix DNS Records

1. Go to: https://manage.wix.com
2. Click your site (dustin7352.wixsite.com/my-site)
3. Click **Upgrade** (if you haven't — you need a paid Wix plan to connect a custom domain)
4. Go to **Settings → Domains**
5. Click **+ Connect a Domain**
6. Type: **dmlelectrical.com** → click **Connect**
7. Choose: **"I want to point my domain to Wix"** (NOT transfer)
8. Wix will show you DNS records — they will look like:

   | Type  | Host | Value                          |
   |-------|------|--------------------------------|
   | A     | @    | 185.230.63.107                 |
   | CNAME | www  | www.wixdns.net                 |

   ⚠️ Copy these exact values from Wix — don't use the values above, yours may differ.

---

## STEP 2: Add DNS Records in Microsoft 365 Admin Center

1. Go to: https://admin.microsoft.com
2. Sign in with your **dustin@dmlelectrical.com** account
3. In the left menu click **Settings → Domains**
4. Click **dmlelectrical.com**
5. Click the **DNS records** tab
6. Click **+ Add record**

### Add the A Record (Root Domain):
| Field | Value |
|-------|-------|
| Type | A |
| Name/Host | @ (or leave blank) |
| Points to / Value | 185.230.63.107 |
| TTL | 1 hour (3600) |

Click **Save**

### Add the CNAME Record (www):
| Field | Value |
|-------|-------|
| Type | CNAME |
| Name/Host | www |
| Points to / Value | www.wixdns.net |
| TTL | 1 hour (3600) |

Click **Save**

---

## STEP 3: Verify in Wix

1. Go back to Wix → Settings → Domains
2. Click **Refresh** or **Check DNS Status**
3. Wix will verify the records (can take 15 min – 48 hours to propagate)
4. Once verified, your site will be live at **dmlelectrical.com** and **www.dmlelectrical.com**

---

## IMPORTANT: Keep Your Email Working

Since your email (dustin@dmlelectrical.com) uses Microsoft 365, you have MX records
already set in Microsoft 365. Adding A/CNAME records will NOT break your email.
Only change the A and CNAME records — do NOT delete any MX records.

---

## BONUS: Also Connect Your TradeFlow App (Customer Portal)

Your customer portal is deployed at Vercel. Once Wix is working, you can add a
subdomain for the app:

1. In Microsoft 365 Admin → Domains → dmlelectrical.com → DNS records
2. Add this CNAME:

   | Type | Host | Points to |
   |------|------|-----------|
   | CNAME | app | cname.vercel-dns.com |

3. In Vercel (vercel.com) → your project → Settings → Domains
4. Add: **app.dmlelectrical.com**
5. Result: Your customer portal will be at **app.dmlelectrical.com/customer/portal**

---

## Need Help?

- Microsoft 365 DNS help: https://support.microsoft.com/en-us/office/add-dns-records-to-connect-your-domain
- Wix custom domain help: https://support.wix.com/en/article/connecting-a-domain-purchased-elsewhere


