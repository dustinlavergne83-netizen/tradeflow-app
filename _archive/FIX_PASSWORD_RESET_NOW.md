# Fix Password Reset - Action Required!

## The Problem

Looking at your email link, the redirect URL is:
```
redirect_to=https://hyhjxdgdetdqoyoscflu.supabase.co
```

This should be:
```
redirect_to=http://localhost:19006/auth/callback
```

## Why This Is Happening

The code changes I made haven't been loaded yet! Your dev server is still running the OLD code.

## SOLUTION: Restart Your Dev Server

### Step 1: Stop the Current Server

In your terminal where Expo is running:
- Press `Ctrl+C` to stop the server

### Step 2: Restart the Server

```bash
cd timeclock-mobile
npx expo start
```

### Step 3: Refresh Your Browser

- After the server restarts, **refresh** your browser tab
- Or press `w` in the Expo terminal to open in web browser

### Step 4: Test Again

1. Go to the sign-in page
2. Enter your email
3. Click "Forgot password?"
4. Check your email
5. **Look at the new link** - it should now say:
   ```
   redirect_to=http://localhost:19006/auth/callback
   ```
6. Click the link - it should now work!

## What The Code Changes Do

The updated `sign-in.tsx` now detects you're on web and uses:

```typescript
if (Platform.OS === "web") {
  if (typeof window !== "undefined") {
    redirectTo = `${window.location.origin}/auth/callback`;
    // This becomes: http://localhost:19006/auth/callback
  }
}
```

But this only works **after restarting** the dev server!

## Quick Checklist

- [ ] Stop dev server (`Ctrl+C`)
- [ ] Restart dev server (`npx expo start`)
- [ ] Refresh browser
- [ ] Request new password reset
- [ ] Check email - URL should say `localhost:19006`
- [ ] Click link - should work now!

## Still Not Working?

If after restarting it still shows the Supabase URL:

1. **Clear browser cache**: Hard refresh with `Ctrl+Shift+R`
2. **Check you're in the right directory**: Make sure you're in `timeclock-mobile` folder
3. **Verify the code change**: Open `timeclock-mobile/app/sign-in.tsx` and look for the Platform.OS check around line 60

## Why It Says "Path Not Valid"

The Supabase URL `https://hyhjxdgdetdqoyoscflu.supabase.co` doesn't have an `/auth/callback` route configured. That's why you get "path not valid". Once the redirect points to your local dev server (`http://localhost:19006/auth/callback`), the route exists and it will work!
