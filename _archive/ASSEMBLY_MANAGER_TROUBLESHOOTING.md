# Assembly Manager Troubleshooting

## Issue: Can't see assemblies in Assembly Manager

### Root Cause Found:
The Assembly Manager page **requires admin login**. Looking at the code:

```javascript
useEffect(() => {
  if (!isAdmin) {
    navigate("/");
  }
}, [isAdmin, navigate]);
```

### Current Status from Database Screenshot:
✅ **105 assemblies exist** in the database  
✅ **All have `is_active = TRUE`**  
✅ **RLS policy allows viewing**: `USING (true)`  

### The Real Problem:
**You need to be logged in as an admin user to access `/assembly-manager`**

### Solution Steps:

1. **Log in to your app** with an admin account
   - Go to http://localhost:5173
   - Sign in with your admin credentials

2. **Check if your user is an admin**:
   - Run this SQL in Supabase to check:
   ```sql
   SELECT id, email, role FROM auth.users;
   SELECT id, email, is_admin FROM admins;
   ```

3. **If you're not an admin, make yourself one**:
   ```sql
   -- Replace YOUR_USER_ID with your actual user ID
   INSERT INTO admins (id, email, is_admin, created_at)
   VALUES (
     'YOUR_USER_ID',
     'your@email.com',
     true,
     NOW()
   )
   ON CONFLICT (id) DO UPDATE
   SET is_admin = true;
   ```

4. **Then access the Assembly Manager**:
   - Navigate to http://localhost:5173/assembly-manager
   - You should see all 105 assemblies!

### Company ID Issue:
I notice in your screenshot that assemblies might have NULL company_id. This is fine for predefined assemblies since the RLS policy allows everyone to view them:

```sql
CREATE POLICY "Users can view all assemblies"
  ON assemblies FOR SELECT
  USING (true); -- All users can see predefined assemblies
```

However, if you want these to be truly "predefined" (not owned by anyone), you should ensure:
- `company_id IS NULL` for predefined assemblies
- `is_custom = FALSE` for predefined assemblies

### Debug Query:
Run this to see what assemblies exist:
```sql
SELECT 
  COUNT(*) as total,
  COUNT(CASE WHEN company_id IS NULL THEN 1 END) as predefined,
  COUNT(CASE WHEN company_id IS NOT NULL THEN 1 END) as company_owned,
  COUNT(CASE WHEN is_active = true THEN 1 END) as active,
  COUNT(CASE WHEN is_custom = true THEN 1 END) as custom
FROM assemblies;
```
