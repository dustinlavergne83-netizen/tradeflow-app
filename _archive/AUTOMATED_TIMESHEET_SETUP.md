# Automated Weekly Timesheet Reports Setup Guide

## Overview
Your system can now automatically email weekly timesheet reports every Monday at 8 AM Central Time!

## How It Works
1. **Database Cron Job** - Runs every Monday at 8 AM
2. **Automated Function** - Calculates last week's hours
3. **Email Service** - Sends professional reports via Resend
4. **Multiple Recipients** - Can send to multiple email addresses

## Setup Instructions

### Step 1: Run the Database Migration
```bash
npx supabase db push
```

This creates the `automated_timesheet_reports` table and sets up the cron job.

### Step 2: Deploy the Edge Function
```bash
npx supabase functions deploy send-automated-timesheet
```

### Step 3: Add Your Email Recipients

**Option A: Using Supabase Dashboard (SQL Editor)**
```sql
INSERT INTO automated_timesheet_reports (recipient_email)
VALUES ('your-email@example.com');

-- Add multiple recipients:
INSERT INTO automated_timesheet_reports (recipient_email)
VALUES 
  ('manager@dmlelectrical.com'),
  ('accounting@dmlelectrical.com'),
  ('owner@dmlelectrical.com');
```

**Option B: Using the App (Future Feature)**
We can create a settings page where you can manage recipients through the UI.

### Step 4: Verify Setup

**Check if cron job is scheduled:**
```sql
SELECT * FROM cron.job WHERE jobname = 'send-weekly-timesheets';
```

**View active recipients:**
```sql
SELECT * FROM automated_timesheet_reports WHERE is_active = true;
```

**Test the function manually (optional):**
```bash
curl -X POST "https://[YOUR-PROJECT-REF].supabase.co/functions/v1/send-automated-timesheet" \
  -H "Authorization: Bearer [YOUR-ANON-KEY]"
```

## Schedule Details

- **Day:** Every Monday
- **Time:** 8:00 AM Central Time (2:00 PM UTC)
- **Report Period:** Previous week (Monday - Sunday)
- **Recipients:** All active emails in `automated_timesheet_reports` table

## Managing Recipients

### Add a Recipient
```sql
INSERT INTO automated_timesheet_reports (recipient_email)
VALUES ('newemail@example.com');
```

### Disable a Recipient (Don't Delete)
```sql
UPDATE automated_timesheet_reports
SET is_active = false
WHERE recipient_email = 'email@example.com';
```

### Re-enable a Recipient
```sql
UPDATE automated_timesheet_reports
SET is_active = true
WHERE recipient_email = 'email@example.com';
```

### Remove a Recipient
```sql
DELETE FROM automated_timesheet_reports
WHERE recipient_email = 'email@example.com';
```

## Email Content

The automated email includes:
- ✅ Professional HTML format
- ✅ Company branding
- ✅ Full timesheet table
- ✅ All employee hours
- ✅ Daily and weekly totals
- ✅ Week date range
- ✅ "Automated Weekly Report" badge

## Troubleshooting

### Reports Not Sending?

1. **Check cron job status:**
```sql
SELECT * FROM cron.job WHERE jobname = 'send-weekly-timesheets';
```

2. **Check active recipients:**
```sql
SELECT * FROM automated_timesheet_reports WHERE is_active = true;
```

3. **Verify Resend API Key:**
- Go to Supabase Dashboard → Project Settings → Edge Functions
- Ensure `RESEND_API_KEY` is set

4. **Check function logs:**
- Go to Supabase Dashboard → Edge Functions → send-automated-timesheet
- View logs for any errors

### Adjust Send Time

If you need to change the send time, update the cron schedule:

```sql
-- Unschedule old job
SELECT cron.unschedule('send-weekly-timesheets');

-- Schedule new time (example: 9 AM Central = 3 PM UTC)
SELECT cron.schedule(
  'send-weekly-timesheets',
  '0 15 * * 1',  -- 3 PM UTC every Monday
  $$SELECT send_weekly_timesheet_reports();$$
);
```

### Timezone Notes

- pg_cron uses UTC time
- Central Time (CST) = UTC - 6 hours
- Central Daylight Time (CDT) = UTC - 5 hours
- Adjust the hour in cron schedule based on daylight saving

**Current Schedule:**
- `0 14 * * 1` = 2 PM UTC = 8 AM CST
- During CDT, this becomes 9 AM local time

**To keep 8 AM year-round, you'd need two schedules:**
```sql
-- For CST months (November - March): 2 PM UTC
SELECT cron.schedule('send-weekly-timesheets-cst', '0 14 * 11-12,1-3 1', ...);

-- For CDT months (March - November): 1 PM UTC  
SELECT cron.schedule('send-weekly-timesheets-cdt', '0 13 * 3-11 1', ...);
```

## Next Steps

### Optional: Create UI Management Page

You can create a settings page in your app to:
- View all recipients
- Add new recipients
- Enable/disable recipients
- Change send time
- Test send now

Would you like me to create this UI page?

## Support

If you need help:
1. Check Supabase function logs
2. Verify email addresses are correct
3. Ensure Resend API key is valid
4. Check that employees have time entries for the week

## Summary

✅ Automatic weekly reports every Monday at 8 AM  
✅ Sends previous week's timesheet (Monday-Sunday)  
✅ Professional email format with company branding  
✅ Multiple recipients supported  
✅ Easy to manage via SQL or future UI  
✅ Powered by Supabase pg_cron + Resend

Your million dollar feature is ready! 🎉
