# 🚀 AI Quick Start Guide - Get AI Working in 30 Minutes!

## What You're Building
Add an "✨ Generate with AI" button to your estimate summary page that automatically writes professional proposal descriptions.

---

## Step 1: Get OpenAI API Key (5 minutes)

1. **Go to:** https://platform.openai.com/signup
2. **Sign up** for an OpenAI account
3. **Add payment method** (required, but usage is very cheap)
4. **Create API key:**
   - Go to https://platform.openai.com/api-keys
   - Click "Create new secret key"
   - Name it: "Estimator App"
   - **COPY THE KEY** - you only see it once!
   - Looks like: `sk-proj-xxxxxxxxxxxxxxxxxxxx`

💰 **Cost:** ~$0.02 per proposal generated (less than a penny!)

---

## Step 2: Add API Key to Supabase (3 minutes)

1. **Open your Supabase Dashboard:**
   - Go to: https://supabase.com/dashboard
   - Select your project

2. **Navigate to Edge Functions Settings:**
   - Click "Edge Functions" in sidebar
   - Click "Manage secrets" or "Settings"

3. **Add the secret:**
   - Name: `OPENAI_API_KEY`
   - Value: Paste your OpenAI key from Step 1
   - Click "Add" or "Save"

---

## Step 3: Deploy the AI Function (5 minutes)

The function is already created at: `supabase/functions/generate-proposal/index.ts`

### Deploy it:

```bash
# Make sure you're in your project directory
cd c:/Users/dusti/estimator-react

# Login to Supabase CLI (if not already)
npx supabase login

# Link to your project (if not already)
npx supabase link --project-ref YOUR_PROJECT_REF

# Deploy the function
npx supabase functions deploy generate-proposal
```

**Don't have Supabase CLI?** Install it:
```bash
npm install -g supabase
```

✅ **Success message:** "Deployed function generate-proposal"

---

## Step 4: Update the Function to Use OpenAI (2 minutes)

Edit: `supabase/functions/generate-proposal/index.ts`

**Find this line (around line 43):**
```typescript
// TODO: Uncomment when OpenAI is set up
/*
```

**And this line (around line 98):**
```typescript
*/
```

**Delete those two lines** to uncomment the OpenAI code.

**Then ADD this import at the top:**
```typescript
import OpenAI from "https://esm.sh/openai@4.20.1"
```

**Delete the mock response section** (lines 100-125 approximately):
```typescript
// TEMPORARY: Mock response for testing (remove when OpenAI is set up)
const mockResponse = `...`
// ... delete all of this
```

**Save and redeploy:**
```bash
npx supabase functions deploy generate-proposal
```

---

## Step 5: Add AI Button to Your App (10 minutes)

### Option A: Add to Estimate Summary Page

Open: `src/pages/Estimate.jsx`

Find the "Scope of Work Description" section (around line 800) and add this button above the textarea:

```jsx
{/* AI Generate Button */}
<div style={{ marginBottom: 12, display: "flex", gap: 10, alignItems: "center" }}>
  <button
    onClick={async () => {
      if (!rows || rows.length === 0) {
        alert("Add some line items first!");
        return;
      }
      
      setAutoSaving(true); // Show loading state
      
      try {
        const { data, error } = await supabase.functions.invoke('generate-proposal', {
          body: {
            projectName: projectName || 'Electrical Project',
            customerName: customerName || 'Customer',
            projectType: 'commercial',
            lineItems: rows
              .filter(r => r.item && r.item.trim())
              .map(r => ({
                description: r.item,
                quantity: r.qty,
                unit: r.unit || 'ea'
              }))
          }
        });

        if (error) throw error;
        
        if (data.success) {
          setDescription(data.scopeOfWork);
          alert('✨ AI proposal generated!');
        } else {
          throw new Error(data.error || 'Failed to generate');
        }
      } catch (err) {
        console.error('AI generation error:', err);
        alert('Error: ' + err.message);
      } finally {
        setAutoSaving(false);
      }
    }}
    disabled={autoSaving}
    style={{
      padding: "10px 20px",
      background: autoSaving 
        ? "#999" 
        : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      border: "none",
      borderRadius: 6,
      color: "#fff",
      fontSize: 14,
      fontWeight: "bold",
      cursor: autoSaving ? "wait" : "pointer",
      display: "flex",
      alignItems: "center",
      gap: 8,
      transition: "all 0.3s"
    }}
  >
    {autoSaving ? "✨ Generating..." : "✨ Generate Scope with AI"}
  </button>
  
  {!isChangeOrder && description && (
    <span style={{ fontSize: 12, color: "#999" }}>
      💡 Tip: You can edit the AI-generated text
    </span>
  )}
</div>
```

**Import supabase at the top if not already:**
```javascript
import { supabase } from "../lib/supabase";
```

---

## Step 6: Test It! (5 minutes)

1. **Run your app:**
   ```bash
   npm run dev
   ```

2. **Navigate to a project** with some estimate line items

3. **Click "Summary" tab**

4. **Scroll to "Scope of Work Description"**

5. **Click "✨ Generate Scope with AI"**

6. **Watch the magic happen!** ✨

---

## 🎉 Success Checklist

- [ ] OpenAI API key created
- [ ] API key added to Supabase secrets
- [ ] Function deployed to Supabase
- [ ] OpenAI code uncommented
- [ ] Button added to Estimate.jsx
- [ ] Tested with a real estimate
- [ ] AI-generated text appears in textarea
- [ ] You can edit the text afterwards

---

## 💰 Cost Tracking

Check your OpenAI usage:
1. Go to: https://platform.openai.com/usage
2. View costs by day/month
3. Set usage limits if desired

**Expected costs:**
- 10 proposals/day = $0.20/day = $6/month
- 50 proposals/day = $1/day = $30/month

**Way cheaper than hiring a writer!** 🎯

---

## 🐛 Troubleshooting

### "Function not found"
- Redeploy: `npx supabase functions deploy generate-proposal`
- Check function exists in Supabase Dashboard

### "Missing required fields"
- Make sure you have line items in your estimate
- Check that `rows` array has items with `item` property

### "OpenAI API error"
- Verify API key is correct in Supabase secrets
- Check OpenAI account has credits: https://platform.openai.com/account/billing

### "CORS error"
- Function should handle CORS automatically
- Try redeploying the function

### Button doesn't appear
- Clear browser cache
- Check console for React errors
- Verify you saved Estimate.jsx

---

## 🚀 What's Next?

Once this works, you can:

1. **Add to other pages:**
   - Invoice descriptions
   - Change order justifications
   - Email templates

2. **Enhance the prompts:**
   - Add company-specific language
   - Include your standard terms
   - Customize by project type

3. **Add more AI features:**
   - Material quantity suggestions
   - Labor hour estimates
   - Plan reading (advanced)

4. **Improve the UI:**
   - Add loading animations
   - Show cost per generation
   - Add "Regenerate" button
   - Token/cost tracking

---

## 📝 Example Generated Output

**Input:**
- Project: "Office Building Renovation"
- Customer: "ABC Corp"
- Line Items: 50x LED Fixtures, 100ft EMT Conduit, 3x Panels

**AI Output:**
> "Our scope of work for Office Building Renovation includes a comprehensive electrical upgrade designed to meet all current NEC codes and ABC Corp's specific requirements. This commercial renovation project encompasses lighting system upgrades, power distribution improvements, and electrical panel installations throughout the facility.
>
> We will provide and install 50 high-efficiency LED fixtures, 100 linear feet of EMT conduit, and 3 electrical panels as specified. All materials will be installed in accordance with manufacturer specifications and local electrical codes, ensuring the highest quality workmanship throughout. Our installation will include proper circuit protection, grounding, and labeling for easy maintenance.
>
> Upon completion, we will provide complete testing and commissioning of all systems, ensuring everything is operational and meets performance specifications. This includes final inspections, as-built drawings, and coordination with local authorities for code compliance."

Pretty good for $0.02! 🎯

---

## 💡 Pro Tips

1. **Test with different project types** - AI adapts to residential vs commercial
2. **Edit the prompts** to match your company's writing style
3. **Save good outputs** as templates for similar projects
4. **Use it for inspiration** - don't rely on it 100%
5. **Always review** AI-generated text before sending to customers

---

## Questions?

Stuck? Common issues:
- **"It's too expensive"** - You control usage, typical cost is $5-30/month
- **"AI isn't accurate"** - That's why you review and edit it!
- **"How do I customize it?"** - Edit the prompt in the function
- **"Can I use Claude instead?"** - Yes! Just change the API

**Need help?** Check the main `AI_INTEGRATION_GUIDE.md` for details.

---

## 🎯 Your 30-Minute Goal

By the end of this guide, you should be able to:
1. Click a button
2. Wait 3-5 seconds
3. See a professional proposal description appear
4. Edit it if needed
5. Save it to your estimate

**That's it! You've added AI to your app!** 🎉

Now go build more AI features using the patterns in `AI_INTEGRATION_GUIDE.md`!
