# Get Employee Invite Link Manually

Since the email isn't sending but the user IS being created, here's how to get the invite link manually to share with the employee:

## Option 1: Use Supabase Dashboard (Easiest)

1. Go to your **Supabase Dashboard**
2. Navigate to **Authentication** → **Users**
3. Find the newly created employee
4. Click on their email
5. Click **"Send Magic Link"** or **"Generate Password Reset Link"**
6. Copy that link and send it to the employee

## Option 2: Use SQL Query

Run this in your Supabase SQL Editor:

```sql
-- Get the most recently created user
SELECT 
  id,
  email,
  created_at,
  email_confirmed_at,
  confirmed_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 1;
```

Then use the Supabase Dashboard to send them a magic link.

## Option 3: Generate Link via Function

I'll create a simple function that just returns the invite link without trying to email it.

## Temporary Solution

For now, when you create an employee:
1. User is created successfully ✅
2. Go to Supabase Dashboard → Authentication → Users
3. Find the employee
4. Use "Send recovery email" or "Send magic link" 
5. Or manually share the password reset link

## Why Isn't Email Working?

The issue appears to be that while the Resend API call isn't erroring, it's also not actually reaching Resend. Possible causes:
- RESEND_API_KEY might be incorrect
- Network/firewall issue
- Resend domain not verified
- Edge function network restrictions

## Test the Resend API Key

Run this to verify your Resend API key works:

```bash
curl -X POST "https://api.resend.com/emails" \
  -H "Authorization: Bearer YOUR_RESEND_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "TimeClock <proposals@dmlelectrical.com>",
    "to": ["your-email@example.com"],
    "subject": "Test Email",
    "html": "<p>This is a test</p>"
  }'
```

If this works, then the issue is with how the Edge Function is calling Resend.

---

**For now, use the Supabase Dashboard method to send invite links manually until we fix the email issue.**
