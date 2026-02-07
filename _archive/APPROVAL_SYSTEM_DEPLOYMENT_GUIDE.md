# Complete Approval System Deployment Guide

## ✅ What's Been Created

### 1. Database System
- ✅ `supabase/migrations/038_timesheet_approval_workflow.sql`
- ✅ Pending reports table
- ✅ Approval workflow functions
- ✅ Updated cron job

### 2. Edge Functions
- ✅ `send-approval-notification` - Sends "Ready for Review" email
- ⏳ `send-approved-timesheet` - Sends reports after approval (use existing `send-automated-timesheet`)

### 3. UI (Simple Approach - Works Today!)
- Use existing Weekly Timesheet page
- Approval happens through manual button click

## 🚀 Quick Deploy (Recommended for Now)

This approach gives you approval workflow TODAY without complex UI:

### Step 1: Deploy What's Ready
```bash
# Deploy notification function
npx supabase functions deploy send-approval-notification

# Ensure automated function is deployed
npx supabase functions deploy send-automated-timesheet
```

### Step 2: Apply Database Migration
In Supabase Dashboard → SQL Editor:
```sql
-- Copy entire contents of:
-- supabase/migrations/038_timesheet_approval_workflow.sql
-- And run it
```

### Step 3: Configure Your Settings
```sql
-- Set yourself as approver
INSERT INTO automated_timesheet_reports (
  recipient_email,
  approver_email,
  requires_approval
) VALUES (
  'accounting@dmlelectrical.com',  -- Who gets final reports
  'your-email@dmlelectrical.com',   -- You (gets approval notification)
  true                                -- Requires approval
);
```

### Step 4: Add SITE_URL Environment Variable
In Supabase Dashboard → Project Settings → Edge Functions:
- Add secret: `SITE_URL` = `https://your-app-url.com`

## 📧 How It Works

### Monday 8 AM:
1. **Cron job runs** → Creates pending report
2. **You receive email** with:
   - Subject: "⏰ Weekly Timesheet Ready for Review"
   - Summary: Total hours, employee count
   - Button: "Review & Approve Timesheet"

### Your Action:
1. **Check email** for summary
2. **Log into app** at `/reports/weekly-timesheet`
3. **Review the data** for last week
4. **Click "✉️ Email Report"** button
5. **Enter recipient** or use preset
6. **Send!**

### After Approval:
1. Recipients get professional timesheet email
2. Report marked as "sent" in database
3. Audit trail preserved

## 🎯 Simple Approval UI (Use Today)

You don't need a complex approval page! Use what you have:

**Monday Morning Workflow:**
1. Get notification email ✅
2. Open app → Reports → Weekly Timesheet ✅
3. Review data ✅
4. Click "Email Report" button (already exists) ✅
5. Send to recipients ✅

**Benefits:**
- Works immediately
- Uses existing UI
- No new code needed
- Full control

## 🔧 Advanced: Full Approval UI (Optional Future Enhancement)

If you want a dedicated approval page later, create:

### New Page: `src/pages/reports/ApproveTimesheet.jsx`

**Features:**
- Shows pending reports list
- Click to view details
- "Approve & Send to All" button
- "Reject" button
- Approval history

**Route in App.jsx:**
```jsx
<Route path="/reports/approve-timesheet" element={<ApproveTimesheet />} />
```

This page would:
1. Get report ID from URL query
2. Load timesheet data
3. Show approve/reject buttons
4. Call `approve_and_send_timesheet` function

## 📊 Database Functions

### Approve and Send:
```sql
SELECT approve_and_send_timesheet(
  '[report-id]'::UUID,
  auth.uid()
);
```

### View Pending Reports:
```sql
SELECT * FROM pending_timesheet_reports
WHERE status = 'pending'
ORDER BY created_at DESC;
```

### View History:
```sql
SELECT * FROM pending_timesheet_reports
ORDER BY created_at DESC
LIMIT 20;
```

## 🔄 Workflow States

```
Monday 8 AM
    ↓
[pending] → You get notification
    ↓
[Your Review] → Check data in app
    ↓
[approved] → You click "Email Report"
    ↓
[sent] → Recipients get emails
```

## ⚙️ Configuration Options

### Disable Approval (Auto-send):
```sql
UPDATE automated_timesheet_reports
SET requires_approval = false;
```

### Change Approver:
```sql
UPDATE automated_timesheet_reports
SET approver_email = 'new-approver@example.com';
```

### Add More Recipients:
```sql
INSERT INTO automated_timesheet_reports (recipient_email)
VALUES ('another-person@example.com');
```

## 🧪 Testing

### Test Notification Email:
```bash
curl -X POST "https://dustin@dmlelectrical.com's Project.supabase.co/functions/v1/send-approval-notification" \
  -H "Authorization: Bearer [your-key]" \
  -H "Content-Type: application/json" \
  -d '{"week_start": "2025-12-29", "week_end": "2026-01-04"}'
```

### Manually Create Pending Report:
```sql
INSERT INTO pending_timesheet_reports (week_start, week_end, status)
VALUES ('2025-12-29', '2026-01-04', 'pending');
```

## 📝 Summary

**What You Have Now:**
✅ Automated pending report creation (Monday 8 AM)  
✅ Email notification with summary  
✅ Approval workflow database  
✅ Manual approval via existing UI  

**How to Use:**
1. Monday morning: Check email
2. See summary and total hours
3. Log into app if needed to review
4. Use "Email Report" button to send
5. Done!

**Future Enhancements (Optional):**
- Dedicated approval UI page
- One-click "Approve & Send" button in email
- Bulk approval for multiple weeks
- Approval via mobile

## 🎉 Result

You now have a professional approval workflow that:
- Notifies you every Monday at 8 AM
- Gives you control before sending
- Provides audit trail
- Works with your existing UI
- Can be enhanced later

**The best part?** It works TODAY with what you already have!
