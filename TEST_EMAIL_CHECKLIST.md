# How to Check if Test Email Went Through

## Step-by-Step Verification

### Step 1: Check SendGrid Activity (Email Received?)

1. Go to https://app.sendgrid.com/
2. Log in to your SendGrid account
3. Click **Activity** in the left sidebar
4. Look for your test email in the list

**What to look for:**
- ✅ Email shows as "Delivered" or "Processed"
- ❌ Email shows as "Bounced" or "Dropped"

**Alternative: Check Inbound Parse Logs**
1. Go to **Settings** → **Inbound Parse**
2. Click on your configured hostname
3. View the **Webhook** section
4. Check for recent POST requests

---

### Step 2: Check Supabase Function Logs (Email Processed?)

1. Go to https://supabase.com/dashboard
2. Select your project
3. Click **Edge Functions** in the left sidebar
4. Click on `process-check-stub-email` function
5. Click **Logs** tab
6. Look for recent invocations

**What to look for:**
```
✅ "Email received from: [your-email]"
✅ "Pay Period: 2026-01-15 to 2026-01-31"
✅ "Attachments: 1"
✅ "Processing attachment: [filename]"
✅ "Check stub uploaded successfully"
```

**Common Errors:**
```
❌ "Email must include 'Pay Period: MM/DD/YYYY...'"
   → Fix: Add pay period to email body

❌ "Employee not found"
   → Fix: Check employee name matches database

❌ "Storage bucket not found"
   → Fix: Create 'check-stubs' bucket in Supabase Storage
```

---

### Step 3: Check Supabase Storage (File Uploaded?)

1. In Supabase Dashboard, click **Storage**
2. Click on `check-stubs` bucket
3. Look for newly uploaded PDF files
4. Files are named: `[employee_id]_[pay_period_end].pdf`

Example: `123e4567-e89b-12d3-a456-426614174000_2026-01-31.pdf`

---

### Step 4: Check Database (Record Created?)

1. In Supabase Dashboard, click **Table Editor**
2. Select `check_stubs` table
3. Look for a new row with:
   - Today's `uploaded_at` timestamp
   - Correct `pay_period_start`, `pay_period_end`, `pay_date`
   - `file_path` pointing to the uploaded PDF
   - `uploaded_by` = `null` (indicates email upload)

---

### Step 5: Check Employee App (Stub Visible?)

1. Open the mobile app
2. Log in as the employee
3. Go to **Pay Stubs** tab
4. Look for the newly uploaded stub
5. Try to open/download it

---

## Quick Diagnostic Commands

### Check DNS Propagation:
```bash
nslookup -type=MX paystubs.dmlelectrical.com
```

**Expected result:**
```
paystubs.dmlelectrical.com    MX preference = 10, mail exchanger = mx.sendgrid.net
```

### Test Supabase Function Directly:
You can test the function with a curl command (without SendGrid):

```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/process-check-stub-email \
  -H "Content-Type: multipart/form-data" \
  -F "from=test@example.com" \
  -F "subject=Test" \
  -F "text=Pay Period: 01/15/2026 - 01/31/2026
Pay Date: 02/05/2026" \
  -F "attachments=1" \
  -F "attachment1=@/path/to/test.pdf"
```

---

## Common Issues & Solutions

### Issue 1: "Email not showing in SendGrid"
**Cause:** DNS not propagated yet  
**Solution:** 
- Wait 15-30 minutes for DNS changes
- Verify MX record is correct
- Check domain registrar settings

### Issue 2: "SendGrid received but Supabase not triggered"
**Cause:** Webhook URL incorrect  
**Solution:**
- Verify webhook URL in SendGrid Inbound Parse
- Ensure URL is correct: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/process-check-stub-email`
- Check Supabase function is deployed

### Issue 3: "Function triggered but error in logs"
**Cause:** Email format or missing data  
**Solution:**
- Check email body includes pay period in correct format
- Verify PDF is attached
- Check employee names match database

### Issue 4: "File uploaded but not visible in app"
**Cause:** RLS policies or employee ID mismatch  
**Solution:**
- Verify storage bucket policies are set
- Check employee is not archived
- Verify employee_id in database matches user

---

## Test Email Template (Copy & Paste)

```
To: test@paystubs.dmlelectrical.com
Subject: Test Payroll - January 2026

Body:
Pay Period: 01/15/2026 - 01/31/2026
Pay Date: 02/05/2026

This is a test of the automatic check stub system.

Attachments:
- Attach any PDF file (or create a test PDF)
- Name it either:
  * FirstName_LastName_2026-01-31.pdf (for single employee)
  * OR Payroll.pdf (for combined - will auto-split)
```

---

## Where to Find Your Project Details

### Supabase Project Reference:
1. Go to Supabase Dashboard
2. Click on your project
3. Go to **Settings** → **General**
4. Find **Reference ID**

### Function URL Format:
```
https://[YOUR_PROJECT_REF].supabase.co/functions/v1/process-check-stub-email
```

Example:
```
https://abcdefghijklmnop.supabase.co/functions/v1/process-check-stub-email
```

---

## Success Checklist

After sending test email, verify:

- [ ] Email appears in SendGrid Activity
- [ ] SendGrid webhook shows successful POST
- [ ] Supabase function logs show execution
- [ ] PDF file appears in Storage bucket
- [ ] Row created in check_stubs table
- [ ] Employee can see stub in mobile app
- [ ] PDF downloads and opens correctly

**If all checked ✅ - System is working perfectly!**

---

## Need More Help?

If you're stuck:

1. **Check Supabase function logs** - This tells you exactly what went wrong
2. **Check SendGrid activity** - This confirms email was received
3. **Review error messages** - They're usually very specific about the issue

Most common issue: Forgetting to include pay period dates in the email body in the exact format shown!
