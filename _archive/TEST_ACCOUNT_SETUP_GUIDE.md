# 🧪 Test Account Setup for Google Play Store

## Quick Solution for Google Play Submission

**For password reset email issue:** Don't worry about it! You can provide Google with the temporary password directly.

**For admin privileges not showing:** The user needs to sign out and sign back in after you make them admin.

---

## Step-by-Step: Create Test Accounts for Google Play

### 1. Create Test Employee Account

In your web app:
1. Go to **Employees** page
2. Click **"+ Invite Employee"**
3. Enter email: `testemployee@gmail.com` (or any email)
4. Click **"Send Invitation"**
5. **COPY THE TEMPORARY PASSWORD** that appears in the success message

**Example:**
```
Email: testemployee@gmail.com
Temporary Password: TempPass123!
```

---

### 2. Create Test Admin Account

#### Option A: Promote the Employee (EASIER)

1. Stay on the Employees page
2. Find the test employee you just created
3. Click **"Make Admin"** button (purple button)
4. ✅ They're now an admin in the database!

#### Option B: Create a Separate Admin

1. Create another employee with a different email
2. Click "Make Admin" on that one

---

### 3. Important: Sign Out and Sign Back In

**The admin role won't show until the user signs out and back in!**

**In the mobile app:**
1. Sign out of the test account
2. Sign back in with the same credentials
3. Now they should see admin features!

**Why?** The app caches the user's role when they sign in. Signing out and back in refreshes it.

---

### 4. Test the Accounts

**Employee Account:**
- ✅ Can clock in/out
- ✅ Can view their own weekly hours
- ❌ Cannot see admin dashboard
- ❌ Cannot see other employees' timesheets

**Admin Account (after sign out/in):**
- ✅ Can clock in/out
- ✅ Can view own weekly hours
- ✅ CAN see admin dashboard
- ✅ CAN see all employees' timesheets
- ✅ CAN manage employees

---

## For Google Play Console

### App Access Section

**Select:** "All or some functionality in my app is restricted"

**Then provide:**

**Employee Test Account:**
```
Username: testemployee@gmail.com
Password: [the temp password from step 1]
Instructions: Log in to access employee time clock features. This account can clock in/out and view weekly hours.
```

**Admin Test Account:**
```
Username: testadmin@gmail.com
Password: [the temp password]
Instructions: Log in to access admin features. This account can view all employees, manage timesheets, and access the admin dashboard.
```

---

## Password Reset Email Issue

**Why it's not working:**
- Supabase needs SMTP configured to send password reset emails
- This requires setting up email service (Resend, SendGrid, etc.)

**For Play Store submission, you DON'T need this!**
- Just use the temporary passwords
- Google reviewers will use those to test
- You can set up password reset emails later if needed

---

## Quick Check: Is Admin Role Applied?

### Check in Supabase Dashboard

1. Go to https://supabase.com/dashboard
2. Select your project
3. Click **Table Editor**
4. Open **employees** table
5. Find your test account
6. Check the **role** column - should say "admin"
7. If it says "employee", click "Make Admin" again on the web app

### Force Refresh in Mobile App

If sign out/in doesn't work:
1. Close the app completely (swipe away)
2. Reopen the app
3. Sign in again
4. Admin features should now appear

---

## Summary for Google Play

**What to provide to Google:**

1. **Two test accounts** (employee + admin)
2. **Credentials** (email + temporary password for each)
3. **Brief instructions** on what each account can do

**Example for Play Console:**

```
Test Account #1 (Employee):
Email: testemployee@gmail.com
Password: TempPass123
Can access: Time clock, weekly hours view

Test Account #2 (Admin):
Email: testadmin@gmail.com  
Password: AdminPass456
Can access: All employee features plus admin dashboard, employee management, and timesheet viewing
```

---

## Troubleshooting

**Admin button clicked but role not changing?**
- Check browser console for errors
- Refresh the Employees page
- Check Supabase directly (see above)

**Sign in works but no admin features in mobile app?**
- Make sure you signed OUT first
- Then sign back IN
- Close app completely and reopen
- Check that role = "admin" in Supabase

**Password reset not sending email?**
- Don't worry about it for now!
- Use temporary passwords for testing
- This doesn't affect Play Store submission

---

## You're Ready! ✅

Once you have:
- [ ] Two test accounts created
- [ ] One promoted to admin
- [ ] Both passwords saved
- [ ] Admin account signed out and back in

You can provide these credentials to Google Play Console and continue with your submission!
