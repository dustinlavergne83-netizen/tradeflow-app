# 🚀 Deploy Invoice Email Edge Function

## Quick Deploy Steps

### Option 1: Using Supabase CLI (Recommended)

1. **Make sure you're logged in to Supabase CLI:**
```bash
npx supabase login
```

2. **Link your project (if not already linked):**
```bash
npx supabase link --project-ref YOUR_PROJECT_REF
```
*(Get your project ref from Supabase Dashboard → Settings → General)*

3. **Deploy the send-invoice function:**
```bash
npx supabase functions deploy send-invoice
```

4. **Verify it's deployed:**
```bash
npx supabase functions list
```
You should see `send-invoice` in the list!

---

## Option 2: Manual Creation in Supabase Dashboard

If CLI doesn't work, you can create it manually:

### Step 1: Go to Supabase Dashboard
1. Open your project in Supabase Dashboard
2. Navigate to **Edge Functions** (in the sidebar)
3. Click **"Create a new function"**
4. Name it: `send-invoice`

### Step 2: Copy the Function Code
Copy the entire contents of: `supabase/functions/send-invoice/index.ts`

The file is located at:
```
c:\Users\dusti\estimator-react\supabase\functions\send-invoice\index.ts
```

### Step 3: Paste and Deploy
1. Paste the code into the function editor
2. Click **"Deploy"** or **"Save"**
3. Wait for deployment to complete

---

## Verify RESEND_API_KEY is Set

Make sure your Resend API key is configured:

```bash
npx supabase secrets list
```

You should see `RESEND_API_KEY` in the list. If not, set it:

```bash
npx supabase secrets set RESEND_API_KEY=your_resend_api_key_here
```

---

## Test the Function

After deploying, test it:

1. Go to any invoice in your app
2. Add a customer email
3. Click "📧 Email Invoice"
4. Check if the email sends successfully

---

## Troubleshooting

### "Function not found" error?
- Function name must be exactly `send-invoice` (with hyphen)
- Try redeploying: `npx supabase functions deploy send-invoice`

### "RESEND_API_KEY is not set" error?
- Run: `npx supabase secrets set RESEND_API_KEY=your_key_here`
- Restart the function after setting secrets

### CLI not working?
- Install/update Supabase CLI: `npm install -g supabase`
- Or use the manual dashboard method above

---

## Function File Location

The function code is already created at:
```
supabase/
  functions/
    send-invoice/
      index.ts  ← This file contains the email function
```

Just deploy it using one of the methods above!

---

✅ Once deployed, your invoice email feature will be fully functional!
