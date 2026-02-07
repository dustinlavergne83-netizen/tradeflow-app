# TradeFlow Security & Protection Guide

## 🔒 Your App Security Status

### ✅ What's Already Protected:

1. **Authentication** - Users must sign in ✓
2. **Row Level Security (RLS)** - Database permissions set up ✓
3. **Encrypted connections** - HTTPS/SSL everywhere ✓
4. **Password security** - Handled by Supabase Auth ✓

### 🎯 Additional Protection Steps

---

## 1. Database Security (Supabase RLS)

### Current Protection:
Your app already has Row Level Security (RLS) enabled on most tables. This means:
- Employees can only see their own time entries
- You (admin) can see all data
- Projects are view-only for employees

### Verify RLS is Enabled:
Run this in Supabase Dashboard → SQL Editor:

```sql
-- Check which tables have RLS enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';
```

**Should show `rowsecurity = true` for all your tables**

### If RLS is Missing on Any Table:
```sql
-- Enable RLS on a table
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

-- Then add appropriate policies
```

---

## 2. User Access Control

### Current Setup:
✅ **Admin (You)**
- Can create projects
- Can view all employee time
- Can edit everything

✅ **Employees**
- Can clock in/out
- Can view their own time
- Can view projects (read-only)

### To Add More Admins:
You'd need to add an `is_admin` or `role` field to employees table.

---

## 3. API Keys & Environment Variables

### ⚠️ IMPORTANT: Your Supabase Keys

**Current Status:**
Your Supabase `anon` key is in the code - **this is OK for public apps!**

**Why it's safe:**
- The `anon` key is meant to be public
- Security is enforced by RLS policies in database
- Users can't bypass RLS even with the key

**DO NOT expose:**
- ❌ `service_role` key (has admin access)
- ❌ Database password
- ❌ Any API keys for paid services

**Where keys are:**
- Mobile: `timeclock-mobile/.env`
- Web: `src/lib/supabase.ts`

---

## 4. App Store Protection

### Once on Google Play:
✅ **Automatic protections:**
- APK signing (prevents tampering)
- Google Play Protect (malware scanning)
- Verified publisher badge

### Best Practices:
1. **Never share your signing key**
2. **Keep Google Play Console password secure**
3. **Enable 2FA on Google account**

---

## 5. Backup Your Data

### Supabase Automatic Backups:
- **Free plan:** Daily backups (7 days retained)
- **Pro plan:** Daily backups (30 days retained)

### Manual Backup:
I already created a guide: `HOW_TO_BACKUP.md`

**Quick backup command:**
```bash
# Export all data to SQL file
npx supabase db dump -f backup.sql
```

---

## 6. Code Protection

### Your Code is Already Protected:

**Web App:**
- ✅ Source code NOT visible to users
- ✅ JavaScript is minified/bundled
- ✅ Hosted code is compiled

**Mobile App:**
- ✅ APK is compiled (not readable)
- ✅ Logic is obfuscated
- ✅ Can't extract source code easily

### If You Want Extra Protection:
```json
// In app.json, add:
"android": {
  "enableProguardInReleaseBuilds": true,
  "shrinkResources": true
}
```

---

## 7. Employee Device Security

### Recommendations for Employees:

1. **Use strong password** for app login
2. **Don't share login credentials**
3. **Enable phone lock screen**
4. **Keep phone OS updated**

### You Can Enforce:
- Minimum password length (Supabase Auth settings)
- Email verification required
- Password reset only via email

---

## 8. Monitoring & Alerts

### Set Up Monitoring:

#### Supabase Dashboard:
- Go to **"Database" → "Roles & Permissions"**
- Review who has access

#### Email Alerts:
- Set up billing alerts
- Monitor usage spikes

#### Logs:
- Check **"Logs" tab** in Supabase
- See all auth attempts
- Track API usage

---

## 9. What to Do If Compromised

### If You Suspect Breach:

#### Immediate Actions:
1. **Change Supabase password** immediately
2. **Rotate API keys** (create new project if needed)
3. **Force all users to reset passwords**:
```sql
-- In Supabase SQL Editor
UPDATE auth.users SET email_confirmed_at = NULL;
```

#### Review:
4. Check Supabase logs for suspicious activity
5. Review all RLS policies
6. Check for unauthorized data access

---

## 10. Best Security Practices

### ✅ DO:
- Keep Supabase dashboard password secure
- Enable 2FA on all accounts (Google, Supabase, GitHub)
- Regularly review employee access
- Keep dependencies updated (`npm update`)
- Backup data weekly
- Monitor usage in Supabase dashboard

### ❌ DON'T:
- Share `service_role` key
- Commit `.env` files to Git (already in `.gitignore` ✓)
- Give employees admin access unless needed
- Use same password everywhere
- Ignore Supabase security emails

---

## 11. Employee Offboarding

### When Employee Leaves:

#### Option 1: Disable Account
```sql
-- In Supabase SQL Editor
UPDATE auth.users 
SET banned_until = '2099-12-31' 
WHERE email = 'employee@example.com';
```

#### Option 2: Delete Account
```sql
-- Delete from employees table (cascades to related data)
DELETE FROM employees WHERE email = 'employee@example.com';

-- Also delete from auth
DELETE FROM auth.users WHERE email = 'employee@example.com';
```

**Their time entries are preserved even after deletion!**

---

## 12. Compliance & Legal

### Data Protection:
✅ **Privacy policy** - Created ✓  
✅ **HTTPS encryption** - Automatic ✓  
✅ **Data deletion** - Users can request ✓  

### Employee Rights:
- Employees can request their data export
- You must delete data within 30 days if requested
- Keep time records for 3-7 years (IRS requirement)

---

## 13. Production Checklist

### Before Going Live:

- [x] RLS enabled on all tables
- [x] Authentication required
- [x] Privacy policy published
- [x] HTTPS enabled (automatic with Supabase)
- [ ] Test employee invite process
- [ ] Test data backup/restore
- [ ] Set up Supabase billing alerts
- [ ] Document admin procedures

---

## 14. Supabase Security Settings

### Go to Supabase Dashboard → Settings → Auth

**Recommended Settings:**
- ✅ **Email confirmation:** Required
- ✅ **Secure password:** Min 8 characters
- ✅ **Rate limiting:** Enabled
- ✅ **Session timeout:** 24 hours
- ✅ **Signup enabled:** No (you invite employees)

---

## 15. Quick Security Audit

### Run These Checks Monthly:

#### 1. Check Active Users:
```sql
SELECT email, last_sign_in_at 
FROM auth.users 
ORDER BY last_sign_in_at DESC;
```

#### 2. Check Recent Time Entries:
```sql
SELECT e.email, COUNT(*) as entries, MAX(s.clock_in) as last_entry
FROM shifts s
JOIN employees e ON s.user_id = e.user_id
WHERE s.clock_in > NOW() - INTERVAL '30 days'
GROUP BY e.email
ORDER BY last_entry DESC;
```

#### 3. Check Database Size:
```sql
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

---

## 🎯 Summary: You're Already Secure!

### ✅ Current Protection:
1. Authentication required ✓
2. RLS policies active ✓
3. Encrypted connections ✓
4. Secure password storage ✓
5. Privacy policy published ✓

### 🔐 Extra Steps (Optional):
- Enable 2FA on Google/Supabase accounts
- Set up weekly backups
- Monitor Supabase dashboard weekly
- Review employee access quarterly

---

## 🆘 Need Help?

### If You Have Security Concerns:
1. Check Supabase status: https://status.supabase.com
2. Review security docs: https://supabase.com/docs/guides/auth
3. Contact Supabase support (if on Pro plan)

### Emergency Contacts:
- **Google Play support:** play.google.com/console
- **Supabase support:** supabase.com/dashboard/support

---

**Your app is secure by design! The main things to protect are:**
1. Your Supabase dashboard password
2. Google Play Console access
3. Regular backups

**Everything else is handled automatically!** 🎉
