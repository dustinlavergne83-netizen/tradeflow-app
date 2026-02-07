# Employee Invite System - Email Invites

## Overview
The employee invite system has been updated to send actual email invitations instead of generating temporary passwords. Employees will now receive an email with a link to set up their own password.

## What Changed

### Before:
- Admin would send an invite
- System would create a user with a temporary password (e.g., `TradeFlow1234!`)
- Admin had to manually share the email and temporary password with the employee
- Employee would sign in and then change their password

### After:
- Admin sends an invite through the app
- System sends an **email** to the employee via Supabase Auth (using Resend)
- Employee receives an email with a secure link to set up their password
- Employee clicks the link, sets their password, and gains access immediately
- No manual password sharing needed! ✅

## How It Works

### For Admins:

1. **Open the TimeClock Mobile App** (or web version)
2. Navigate to **Admin → Invite Employee**
3. Enter the employee's email address
4. Click **"Send Invite"**
5. The employee will receive an email with an invitation link
6. You'll see a confirmation message: "Invitation Sent! ✅"

### For Employees:

1. Check your email for an invitation from your company
2. Click the link in the email
3. Set up your own password
4. Sign in to the TimeClock app with your email and new password

## Technical Details

### Updated Files:
- `timeclock-mobile/supabase/functions/invite-employee/index.ts` - Changed from `createUser` to `inviteUserByEmail`
- `timeclock-mobile/app/admin/index.tsx` - Updated success message to reflect email sending

### Function Changes:
```typescript
// OLD: Created user with temp password
await admin.auth.admin.createUser({
  email: email,
  password: tempPassword,
  email_confirm: true,
  user_metadata: { role: role },
});

// NEW: Sends email invite
await admin.auth.admin.inviteUserByEmail(email, {
  data: { role: role },
  redirectTo: "tradeflow://auth/callback",
});
```

### Email Configuration:
- Emails are sent via **Supabase Auth** using your configured email provider (Resend)
- The same Resend API key used for proposals is used for invites
- Email templates can be customized in the Supabase Dashboard under **Authentication → Email Templates**

## Testing the Invite System

### Prerequisites:
1. ✅ Supabase project with Auth configured
2. ✅ Resend API key configured in Supabase
3. ✅ Function deployed: `supabase functions deploy invite-employee`
4. ✅ Admin account with permission to invite users

### Test Steps:
1. Sign in as an admin
2. Go to Admin → Invite Employee
3. Enter a valid email address (use your own for testing)
4. Click "Send Invite"
5. Check the email inbox for the invitation
6. Click the link in the email
7. Set up a password
8. Sign in to the app

## Customizing Email Templates

To customize the invitation email:

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Navigate to **Authentication → Email Templates**
3. Find the **"Invite user"** template
4. Customize the subject and body
5. Use these variables:
   - `{{ .SiteURL }}` - Your site URL
   - `{{ .Token }}` - The invite token
   - `{{ .TokenHash }}` - Token hash
   - `{{ .ConfirmationURL }}` - Full confirmation URL

## Troubleshooting

### Emails Not Being Received:
1. Check Resend dashboard for delivery logs
2. Verify RESEND_API_KEY is set in Supabase Edge Functions secrets
3. Check spam/junk folders
4. Verify the email domain is verified in Resend

### Invite Link Not Working:
1. Ensure the `redirectTo` URL is configured correctly
2. For mobile app: `tradeflow://auth/callback`
3. For web: Your deployed app URL or `http://localhost:8081/auth/callback`

### Function Errors:
1. Check function logs: `supabase functions logs invite-employee`
2. Verify environment variables are set
3. Ensure user has admin role

## Environment Variables Required

In Supabase Edge Functions, ensure these are set:
```
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
RESEND_API_KEY=your_resend_api_key
```

## Benefits of Email Invites

✅ **More Secure** - No temporary passwords to share
✅ **Better UX** - Employees set their own memorable password
✅ **Professional** - Branded email invitations
✅ **Audit Trail** - Track who was invited and when
✅ **Less Manual Work** - No need to copy/paste passwords

## Next Steps

1. ✅ Function deployed and ready to use
2. Test with a real email address
3. Customize email template if needed (optional)
4. Start inviting employees!

## Support

If you encounter any issues:
- Check Supabase function logs
- Review Resend email delivery logs
- Ensure all environment variables are configured
- Verify email domain is verified in Resend

---

**Last Updated:** December 30, 2025
**Status:** ✅ Deployed and Ready to Use
