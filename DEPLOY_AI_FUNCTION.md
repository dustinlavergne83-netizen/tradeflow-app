# 🚀 Deploy AI Function to Supabase - Step by Step

## ✅ Prerequisites (You've Done These!)
- [x] OpenAI API key created
- [x] API key added to Supabase Edge Functions secrets
- [x] Function code updated to use OpenAI

---

## 📦 Deploy the Function

### Step 1: Open Terminal in Your Project
```bash
cd c:/Users/dusti/estimator-react
```

### Step 2: Deploy the Function
```bash
npx supabase functions deploy generate-proposal
```

**Expected Output:**
```
Deploying function generate-proposal...
✓ Function generate-proposal deployed successfully
```

---

## ✅ Verify Deployment

### Check in Supabase Dashboard:
1. Go to: https://supabase.com/dashboard
2. Select your project
3. Click "Edge Functions" in sidebar
4. You should see **generate-proposal** listed

---

## 🧪 Test the Function

### Option 1: Test from Dashboard
1. In Supabase Dashboard → Edge Functions
2. Click on **generate-proposal**
3. Click "Test function"
4. Use this test payload:
```json
{
  "projectName": "Office Renovation",
  "customerName": "Test Customer",
  "projectType": "commercial",
  "lineItems": [
    {
      "description": "LED Light Fixtures",
      "quantity": 25,
      "unit": "ea"
    },
    {
      "description": "EMT Conduit 3/4\"",
      "quantity": 150,
      "unit": "ft"
    },
    {
      "description": "Electrical Panel 200A",
      "quantity": 1,
      "unit": "ea"
    }
  ]
}
```
5. Click "Invoke function"
6. You should see AI-generated proposal text!

### Option 2: Test from Command Line
```bash
npx supabase functions invoke generate-proposal --body "{\"projectName\":\"Test Project\",\"customerName\":\"Test Customer\",\"lineItems\":[{\"description\":\"LED Fixture\",\"quantity\":10,\"unit\":\"ea\"}]}"
```

---

## 🎯 Expected Response

```json
{
  "success": true,
  "scopeOfWork": "Our scope of work for Office Renovation includes a comprehensive electrical installation...",
  "tokensUsed": 285,
  "cost": 0.00855
}
```

---

## 🐛 Troubleshooting

### Error: "Function not found"
**Solution:**
```bash
# Redeploy
npx supabase functions deploy generate-proposal
```

### Error: "OPENAI_API_KEY is not set"
**Solution:**
1. Go to Supabase Dashboard → Project Settings → Edge Functions
2. Add secret: `OPENAI_API_KEY` = your API key
3. Redeploy function

### Error: "OpenAI API error: Incorrect API key"
**Solution:**
- Verify your API key is correct
- Check it starts with `sk-proj-` or `sk-`
- Create new key at https://platform.openai.com/api-keys

### Error: "You exceeded your current quota"
**Solution:**
- Add payment method at https://platform.openai.com/account/billing
- Purchase credits ($10-20 to start)

---

## 🎉 Success! Now What?

Once deployed successfully:

### 1. Update Your React App
Add the AI button to your Estimate page (see next file)

### 2. Test in Your App
- Navigate to a project with line items
- Click "Summary" tab
- Look for the "✨ Generate with AI" button
- Click and watch the magic!

### 3. Monitor Usage
- Check OpenAI usage: https://platform.openai.com/usage
- Monitor costs daily
- Set usage limits if desired

---

## 💰 Cost Monitoring

After deploying, monitor your costs:

1. **Supabase Dashboard:**
   - Project Settings → Usage
   - Check Edge Function invocations

2. **OpenAI Dashboard:**
   - https://platform.openai.com/usage
   - View costs by day
   - Set billing alerts

**Expected Costs:**
- Function invocations: Free (1M free/month)
- OpenAI API: $0.02 per proposal
- Total: ~$10-30/month for typical usage

---

## 🔄 Redeploy After Changes

If you make changes to the function:

```bash
# 1. Edit the file
# 2. Deploy again
npx supabase functions deploy generate-proposal

# 3. Test
npx supabase functions invoke generate-proposal --body "{...}"
```

---

## 📊 Function Logs

View logs in real-time:

```bash
npx supabase functions logs generate-proposal
```

Or in Supabase Dashboard:
- Edge Functions → generate-proposal → Logs

---

## ✅ Deployment Checklist

- [ ] Function deployed successfully
- [ ] Test from Supabase Dashboard works
- [ ] OpenAI API key is correct
- [ ] AI-generated text appears
- [ ] No errors in logs
- [ ] Ready to add button to app!

---

## 🚀 Next Step

Once deployed, add the AI button to your app!

See: **ADD_AI_BUTTON.md** (next file) for the React code.
