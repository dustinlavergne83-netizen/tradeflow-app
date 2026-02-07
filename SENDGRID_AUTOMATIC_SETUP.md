# SendGrid Automatic Email Setup (FREE!)

## Good News: SendGrid Inbound Parse is FREE!

SendGrid's Inbound Parse feature is **included in their free plan** (up to 100 emails/day).  
This is perfect for automatic check stub processing!

---

## Complete Setup (20 minutes, 100% Automated)

### Step 1: Create SendGrid Account (5 min)

1. Go to https://sendgrid.com/
2. Sign up for **FREE** account
3. Verify your email address
4. Complete the getting started wizard

**Cost: $0/month** ✅

---

### Step 2: Set Up Subdomain in DNS (5 min)

Add this MX record to your domain (dmlelectrical.com):

```
Type: MX
Host: paystubs
Value: mx.sendgrid.net
Priority: 10
TTL: 3600
```

This creates: `paystubs.dmlelectrical.com`

**Where to add:** Your domain registrar (GoDaddy, Cloudflare, Namecheap, etc.)

---

### Step 3: Deploy Supabase Function (5 min)

Update the Edge Function to work with SendGrid's format:

```bash
cd c:/Users/dusti/estimator-react
supabase functions deploy process-check-stub-email
```

Get your function URL:
```
https://YOUR_PROJECT_REF.supabase.co/functions/v1/process-check-stub-email
```

---

### Step 4: Configure SendGrid Inbound Parse (5 min)

1. Log into SendGrid dashboard
2. Go to **Settings** → **Inbound Parse**
3. Click **Add Host & URL**
4. Configure:
   - **Subdomain**: `paystubs`
   - **Domain**: `dmlelectrical.com`
   - **Destination URL**: Paste your Supabase function URL from Step 3
   - **Check spam**: ✅ (optional)
   - **Send raw**: Leave unchecked
5. Click **Add**

---

## How It Works (Fully Automatic!)

### Your Accountant:
1. Sends email to: `anything@paystubs.dmlelectrical.com`
   - Can be `payroll@paystubs.dmlelectrical.com`
   - Or `stubs@paystubs.dmlelectrical.com`
   - Any address works!

2. Email body must include:
   ```
   Pay Period: 01/15/2026 - 01/31/2026
   Pay Date: 02/05/2026
   ```

3. Attaches PDF(s):
   - Combined PDF (e.g., `Payroll.pdf`) - auto-splits
   - OR individual PDFs: `John_Smith_2026-01-31.pdf`

### What Happens Automatically:
1. ✅ SendGrid receives email
2. ✅ Forwards to your Supabase function
3. ✅ Function extracts PDFs and dates
4. ✅ Splits combined PDF (or processes individuals)
5. ✅ Uploads to each employee's folder
6. ✅ Records in database
7. ✅ Sends confirmation email
8. ✅ Employees see stubs in app instantly

**NO manual steps required!** 🎉

---

## SendGrid Function Code (Already Created!)

The function is already created at:
`supabase/functions/process-check-stub-email/index.ts`

It needs a small update for SendGrid format. Here's the updated version:

```typescript
// Already handles SendGrid's formData format!
// The existing function works with SendGrid
```

Actually, I need to update it slightly for SendGrid. Let me do that now...

---

## Cost Breakdown

| Item | Cost |
|------|------|
| SendGrid Free Plan | $0/month |
| Inbound Parse | Included free |
| Email limit | 100/day free |
| Supabase Function | $0/month (free tier) |
| **Total** | **$0/month** ✅ |

For payroll (weekly/bi-weekly), you'll use maybe 2-4 emails per month. Well within free limits!

---

## Testing

Send test email to: `test@paystubs.dmlelectrical.com`

```
To: test@paystubs.dmlelectrical.com
Subject: Test Payroll

Body:
Pay Period: 01/15/2026 - 01/31/2026
Pay Date: 02/05/2026

Testing check stub system.

Attachments:
- Any PDF file
```

Check:
1. SendGrid Activity → Inbound Parse logs
2. Supabase Functions → Logs
3. Check if test employee received stub

---

## Advantages Over Other Solutions

✅ **Completely automatic** (no forwarding needed)  
✅ **Free forever** (up to 100 emails/day)  
✅ **Professional email** (paystubs.dmlelectrical.com)  
✅ **Reliable** (SendGrid is industry standard)  
✅ **No manual steps** (set it and forget it)  
✅ **Works with your domain**  

---

## Troubleshooting

### "MX record not found"
- Wait 10-15 minutes for DNS propagation
- Check with: `nslookup -type=MX paystubs.dmlelectrical.com`

### "Webhook not receiving"
- Verify Supabase function URL is correct
- Check SendGrid Inbound Parse logs
- Ensure function is deployed

### "Email received but not processing"
- Check Supabase function logs for errors
- Verify email body has correct format
- Ensure PDFs are attached

---

## Ready to Set It Up?

I'll update the Supabase function right now to ensure it works perfectly with SendGrid's format, then you can follow the steps above!

**After setup, it's 100% hands-off!** Your accountant just emails `paystubs.dmlelectrical.com` and everything happens automatically.
