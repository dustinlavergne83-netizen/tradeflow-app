# Quick Deployment Guide: Email Check Stubs

## You're using Resend - Perfect! Here's what to do:

### Step 1: Deploy the Supabase Function (5 minutes)

```bash
# Make sure you're in your project directory
cd c:/Users/dusti/estimator-react

# Login to Supabase (if not already)
supabase login

# Deploy the function
supabase functions deploy process-check-stub-email
```

After deployment, you'll get a URL like:
```
https://YOUR_PROJECT_REF.supabase.co/functions/v1/process-check-stub-email
```

**Copy this URL - you'll need it for Step 2!**

---

### Step 2: Configure Resend Inbound Route (3 minutes)

1. Go to https://resend.com/inbound
2. Click **"Add Inbound Route"**
3. Fill in:
   - **Email pattern**: `*@paystubs.dmlelectrical.com` (or your chosen subdomain)
   - **Webhook URL**: Paste the Supabase function URL from Step 1
   - Click **Save**

4. Resend will show you DNS records to add. **Copy these!**

---

### Step 3: Add DNS Records (5-10 minutes)

Go to your domain registrar (GoDaddy, Cloudflare, Namecheap, etc.) and add:

**MX Record:**
```
Type: MX
Host: paystubs (or your subdomain)
Value: [Provided by Resend - usually something like inbound.resend.com]
Priority: 10
TTL: 3600
```

**TXT Record (for verification):**
```
Type: TXT
Host: paystubs
Value: [Provided by Resend]
TTL: 3600
```

**Wait 5-10 minutes** for DNS to propagate.

---

### Step 4: Test It! (2 minutes)

Send a test email to: `test@paystubs.dmlelectrical.com`

**Email format:**
```
To: test@paystubs.dmlelectrical.com
Subject: Test Payroll

Body:
Pay Period: 01/15/2026 - 01/31/2026
Pay Date: 02/05/2026

Testing the check stub system.

Attachments:
- Attach a test PDF (can be named John_Smith_2026-01-31.pdf or Payroll.pdf)
```

**Check results:**
1. Resend Dashboard → Inbound → View logs
2. Supabase Dashboard → Functions → View logs
3. You should receive a confirmation email with processing results

---

### Step 5: Train Your Accountant (2 minutes)

Send them this template:

**To:** paystubs@dmlelectrical.com

**Subject:** Payroll - [Date]

**Body:**
```
Pay Period: MM/DD/YYYY - MM/DD/YYYY
Pay Date: MM/DD/YYYY

Attached are the check stubs for this pay period.
```

**Attachments:**
- Option 1: Combined PDF (any name) - system auto-splits by employee alphabetically
- Option 2: Individual PDFs named: `FirstName_LastName_YYYY-MM-DD.pdf`

---

## Troubleshooting

### "Email not being received"
- Check DNS propagation: `nslookup -type=MX paystubs.dmlelectrical.com`
- Verify Resend inbound route is active
- Check Resend logs

### "Processing failed"
- Check Supabase function logs for errors
- Verify email body has correct pay period format
- Ensure PDF attachments are included

### "Employee not found"
- Check employee names match database exactly
- Verify filename format for individual stubs

---

## What Happens Automatically:

1. ✅ Accountant emails to `paystubs@dmlelectrical.com`
2. ✅ Resend forwards to Supabase function
3. ✅ Function extracts PDFs and date info
4. ✅ Splits combined PDF OR processes individual files
5. ✅ Stores each stub in employee's folder
6. ✅ Records in database
7. ✅ Sends confirmation email
8. ✅ Employees see stubs in mobile app instantly

---

## Cost: $0/month

- Resend: Already included in your plan
- Supabase: Well within free tier limits
- Total additional cost: **$0**

---

## Need Help?

- View full setup guide: `EMAIL_CHECK_STUBS_SETUP.md`
- Check Resend logs: https://resend.com/inbound
- Check Supabase logs: Your Supabase Dashboard → Functions
- Test email format in the setup guide

**Once deployed, this is completely hands-off!** 🎉
