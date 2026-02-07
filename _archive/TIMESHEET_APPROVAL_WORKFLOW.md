# Timesheet Approval Workflow System

## Overview
A comprehensive approval system that requires review before sending automated weekly timesheet reports.

## How It Works

### Monday Morning (8 AM Central):
1. **System creates** a pending timesheet report for last week
2. **You receive** an email notification: "Weekly Timesheet Ready for Review"
3. **Email contains**:
   - Link to approval page
   - Quick summary of hours
   - "Review & Approve" button

### Your Workflow:
1. **Click link** in notification email
2. **Review timesheet** data in the app
3. **Make any corrections** if needed
4. **Click "Approve & Send"** button
5. **Reports automatically sent** to all recipients

### If You Don't Approve:
- Reports stay in "Pending" status
- No emails sent to recipients
- You can approve later from the app
- Old pending reports visible in history

## Database Structure

### New Tables:

**`pending_timesheet_reports`**
- Stores reports waiting for approval
- Tracks status: pending → approved → sent
- Records who approved and when
- Stores timesheet data snapshot

**`automated_timesheet_reports` (Updated)**
- Added `requires_approval` column (default: true)
- Added `approver_email` column (your email)

## Setup Instructions

### Step 1: Apply the Migration
```bash
# In Supabase Dashboard SQL Editor, run:
supabase/migrations/038_timesheet_approval_workflow.sql
```

### Step 2: Set Your Approver Email
```sql
UPDATE automated_timesheet_reports
SET 
  requires_approval = true,
  approver_email = 'your-email@dmlelectrical.com'
WHERE id IN (SELECT id FROM automated_timesheet_reports LIMIT 1);
```

### Step 3: Add Report Recipients
```sql
-- These are the people who will receive reports AFTER you approve
INSERT INTO automated_timesheet_reports (recipient_email, requires_approval)
VALUES 
  ('accounting@dmlelectrical.com', true),
  ('manager@dmlelectrical.com', true);
```

## Approval UI Page (To Be Created)

### Page: `/reports/pending-timesheets`

**Features:**
- List all pending reports
- Show report details (week, hours, employees)
- Preview before approving
- Approve button → sends to all recipients
- Reject button → marks as rejected
- History of sent/rejected reports

**UI Components Needed:**
1. Pending reports table
2. Report detail modal
3. Approve/Reject buttons
4. Email preview

## Edge Functions Needed

### 1. `send-approval-notification`
**Purpose:** Send "Ready for Review" email to approver

**Triggered by:** Cron job (Monday 8 AM)

**Email Content:**
```
Subject: Weekly Timesheet Ready for Review

Hi [Approver],

The weekly timesheet for [Date Range] is ready for your review.

Total Hours: 123.5
Employees: 8

[Review & Approve Button] → Links to approval page

If you have questions, log in to review the details.
```

### 2. `send-approved-timesheet`  
**Purpose:** Send timesheet to recipients after approval

**Triggered by:** Approval button click

**Actions:**
- Gets approved report data
- Sends to all active recipients
- Marks report as "sent"

## Current Status

✅ Database migration created  
✅ Approval workflow logic complete  
⏳ Need to create Edge Functions  
⏳ Need to create approval UI page  
⏳ Need to deploy

## Implementation Next Steps

### Quick Start (Manual Approval):
1. Apply migration 038
2. Set your approver email
3. Use existing "Email Report" button manually after reviewing

### Full Automation (Requires Development):
1. Create `send-approval-notification` Edge Function
2. Create `send-approved-timesheet` Edge Function  
3. Create approval UI page
4. Add approval link to notification email
5. Test complete workflow

## Toggle Between Modes

### Automatic (No Approval Required):
```sql
UPDATE automated_timesheet_reports
SET requires_approval = false;
```
Reports will send automatically every Monday.

### Manual Approval (Default):
```sql
UPDATE automated_timesheet_reports
SET requires_approval = true,
    approver_email = 'your-email@dmlelectrical.com';
```
You'll get notification to approve first.

## API Endpoints

### Approve Report:
```typescript
// Call from UI
const { data, error } = await supabase
  .rpc('approve_and_send_timesheet', {
    report_id: '[UUID]',
    user_id: user.id
  });
```

### Get Pending Reports:
```sql
SELECT * FROM pending_timesheet_reports
WHERE status = 'pending'
ORDER BY created_at DESC;
```

### Get Report History:
```sql
SELECT * FROM pending_timesheet_reports
ORDER BY created_at DESC
LIMIT 10;
```

## Benefits of Approval Workflow

✅ Quality control before sending  
✅ Catch errors or missing entries  
✅ Professional presentation  
✅ Audit trail of approvals  
✅ Flexibility to skip weeks  
✅ Control over timing  

## Summary

The approval workflow gives you complete control:
- **Monday 8 AM:** Get notification
- **Your Review:** Check the data
- **Your Approval:** Send to recipients
- **Peace of Mind:** Nothing sent without your OK

Would you like me to create the Edge Functions and UI page to complete this system?
