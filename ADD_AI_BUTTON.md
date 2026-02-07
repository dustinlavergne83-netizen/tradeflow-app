# ✨ Add AI Button to Your Estimate Page

## 🎯 Goal
Add a "Generate with AI" button to the Estimate Summary page that creates professional proposal descriptions.

---

## 📝 Step 1: Find the Right Location

Open: `src/pages/Estimate.jsx`

Look for the **"Scope of Work Description"** section (around line 1040-1060).

You'll find something like:
```jsx
{/* DESCRIPTION/SCOPE OF WORK */}
<div style={{
  background: "#2a2a2a",
  border: "1px solid #444",
  borderRadius: 8,
  padding: 20,
  marginBottom: 20
}}>
  <h3 style={{ margin: "0 0 12px 0", color: "#f97316", fontSize: 16 }}>
    Scope of Work Description
  </h3>
  <textarea
    value={description}
    onChange={(e) => setDescription(e.target.value)}
    ...
  />
</div>
```

---

## ✨ Step 2: Add the AI Button

**Add this code RIGHT AFTER the `<h3>` tag and BEFORE the `<textarea>`:**

```jsx
{/* AI Generate Button */}
<div style={{ marginBottom: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
  <button
    onClick={async () => {
      // Get all sections' items for complete context
      const allItems = Object.values(sections).flat();
      
      if (!allItems || allItems.length === 0) {
        alert("Add some line items to your estimate first!");
        return;
      }
      
      setAutoSaving(true);
      
      try {
        const { data, error } = await supabase.functions.invoke('generate-proposal', {
          body: {
            projectName: projectName || 'Electrical Project',
            customerName: customerName || 'Customer',
            projectType: 'commercial',
            lineItems: allItems
              .filter(item => !item.parent_id) // Only include parent items
              .map(item => ({
                description: item.description,
                quantity: item.quantity,
                unit: item.unit || 'ea'
              }))
          }
        });

        if (error) {
          console.error('Supabase function error:', error);
          throw error;
        }
        
        if (data && data.success) {
          setDescription(data.scopeOfWork);
          
          // Show cost info
          const costInfo = data.cost ? ` (Cost: $${data.cost.toFixed(4)})` : '';
          alert(`✨ AI proposal generated!${costInfo}\n\nYou can edit the text below before saving.`);
        } else {
          throw new Error(data?.error || 'Failed to generate proposal');
        }
      } catch (err) {
        console.error('AI generation error:', err);
        alert('Error generating proposal: ' + (err.message || 'Unknown error'));
      } finally {
        setAutoSaving(false);
      }
    }}
    disabled={autoSaving}
    style={{
      padding: "10px 20px",
      background: autoSaving 
        ? "#666" 
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
      transition: "all 0.3s",
      opacity: autoSaving ? 0.6 : 1
    }}
  >
    {autoSaving ? "✨ Generating..." : "✨ Generate Scope with AI"}
  </button>
  
  {!isChangeOrder && (
    <span style={{ fontSize: 12, color: "#999" }}>
      💡 AI will analyze your line items and create a professional description
    </span>
  )}
</div>
```

---

## 🔧 Step 3: Verify supabase Import

Make sure you have this import at the top of `Estimate.jsx`:

```javascript
import { supabase } from "../lib/supabase";
```

**It should already be there!** (You're already using it for other database operations)

---

## 📸 Visual Reference

### Before Adding Button:
```
┌─────────────────────────────────────┐
│ Scope of Work Description           │
├─────────────────────────────────────┤
│                                     │
│  [Empty textarea]                   │
│                                     │
└─────────────────────────────────────┘
```

### After Adding Button:
```
┌─────────────────────────────────────┐
│ Scope of Work Description           │
├─────────────────────────────────────┤
│ [✨ Generate Scope with AI]  💡 Tip │
├─────────────────────────────────────┤
│                                     │
│  [Textarea with AI-generated text]  │
│                                     │
└─────────────────────────────────────┘
```

---

## ✅ Complete Code Example

Here's the complete section after your changes:

```jsx
{/* DESCRIPTION/SCOPE OF WORK */}
<div style={{
  background: "#2a2a2a",
  border: "1px solid #444",
  borderRadius: 8,
  padding: 20,
  marginBottom: 20
}}>
  <h3 style={{ margin: "0 0 12px 0", color: "#f97316", fontSize: 16 }}>
    Scope of Work Description
  </h3>
  
  {/* AI Generate Button - NEW CODE */}
  <div style={{ marginBottom: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
    <button
      onClick={async () => {
        const allItems = Object.values(sections).flat();
        
        if (!allItems || allItems.length === 0) {
          alert("Add some line items to your estimate first!");
          return;
        }
        
        setAutoSaving(true);
        
        try {
          const { data, error } = await supabase.functions.invoke('generate-proposal', {
            body: {
              projectName: projectName || 'Electrical Project',
              customerName: customerName || 'Customer',
              projectType: 'commercial',
              lineItems: allItems
                .filter(item => !item.parent_id)
                .map(item => ({
                  description: item.description,
                  quantity: item.quantity,
                  unit: item.unit || 'ea'
                }))
            }
          });

          if (error) throw error;
          
          if (data && data.success) {
            setDescription(data.scopeOfWork);
            const costInfo = data.cost ? ` (Cost: $${data.cost.toFixed(4)})` : '';
            alert(`✨ AI proposal generated!${costInfo}\n\nYou can edit the text below before saving.`);
          } else {
            throw new Error(data?.error || 'Failed to generate proposal');
          }
        } catch (err) {
          console.error('AI generation error:', err);
          alert('Error generating proposal: ' + (err.message || 'Unknown error'));
        } finally {
          setAutoSaving(false);
        }
      }}
      disabled={autoSaving}
      style={{
        padding: "10px 20px",
        background: autoSaving ? "#666" : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        border: "none",
        borderRadius: 6,
        color: "#fff",
        fontSize: 14,
        fontWeight: "bold",
        cursor: autoSaving ? "wait" : "pointer",
        display: "flex",
        alignItems: "center",
        gap: 8,
        transition: "all 0.3s",
        opacity: autoSaving ? 0.6 : 1
      }}
    >
      {autoSaving ? "✨ Generating..." : "✨ Generate Scope with AI"}
    </button>
    
    {!isChangeOrder && (
      <span style={{ fontSize: 12, color: "#999" }}>
        💡 AI will analyze your line items and create a professional description
      </span>
    )}
  </div>
  
  {/* Existing textarea */}
  <textarea
    value={description}
    onChange={(e) => setDescription(e.target.value)}
    placeholder="Enter a description of the scope of work for this estimate. This will appear on the proposal..."
    style={{
      width: "100%",
      minHeight: 100,
      padding: "12px",
      background: "#1a1a1a",
      border: "1px solid #555",
      borderRadius: 6,
      color: "#fff",
      fontSize: 14,
      fontFamily: "Arial",
      resize: "vertical"
    }}
  />
</div>
```

---

## 🧪 Step 4: Test It!

1. **Save the file** (`Ctrl+S` or `Cmd+S`)

2. **Make sure your dev server is running:**
   ```bash
   npm run dev
   ```

3. **Navigate to a project:**
   - Open your app in browser
   - Go to a project with estimate items
   - Click "Summary" tab

4. **Look for the button:**
   - Should appear above the "Scope of Work" textarea
   - Purple gradient button with sparkle emoji

5. **Click the button:**
   - Should show "✨ Generating..."
   - Wait 3-5 seconds
   - AI-generated text appears in textarea
   - Alert shows cost

6. **Edit if needed:**
   - The generated text is fully editable
   - Make any changes you want
   - It will auto-save like before

---

## 🎉 Success Checklist

- [ ] Button appears on Summary page
- [ ] Clicking button shows "Generating..." state
- [ ] AI-generated text appears in 3-5 seconds
- [ ] Text is editable
- [ ] No console errors
- [ ] Auto-save still works

---

## 🐛 Troubleshooting

### Button doesn't appear
- Clear browser cache (Ctrl+Shift+R)
- Check for React errors in console
- Verify you saved the file

### "Function not found" error
- Deploy function: `npx supabase functions deploy generate-proposal`
- Check Supabase Dashboard → Edge Functions

### "Missing required fields" error
- Make sure you have line items in your estimate
- Navigate to Summary tab (not individual sections)

### Button stays in "Generating..." state
- Check browser console for errors
- Verify OpenAI API key in Supabase
- Check function logs: `npx supabase functions logs generate-proposal`

### Generated text is generic
- Add more detailed line items
- Try different project types
- Customize the prompt in the Edge Function

---

## 🚀 What's Next?

Once this works, you can:

### 1. Add More AI Features
- Change order justifications
- Invoice descriptions
- Material suggestions
- Email templates

### 2. Customize the Prompts
- Edit `supabase/functions/generate-proposal/index.ts`
- Change the prompt to match your style
- Add company-specific language

### 3. Improve the UI
- Add loading animation
- Show cost after generation
- Add "Regenerate" button
- Keep history of generated versions

### 4. Track Usage
- Monitor costs in OpenAI dashboard
- Track how often it's used
- Gather user feedback

---

## 💡 Pro Tips

1. **Always review AI-generated text** - Don't send without checking
2. **Use it as a starting point** - Edit to match your voice
3. **Test with different project types** - AI adapts to context
4. **Save good outputs** as templates for similar projects
5. **Monitor costs** in first week to understand usage patterns

---

## 📝 Example Output

**Input:**
- 50x LED Light Fixtures
- 150ft EMT Conduit
- 3x Electrical Panels

**AI Output:**
> "Our scope of work for this project includes a comprehensive electrical installation designed to meet all current NEC codes and safety requirements. We will provide and install 50 high-efficiency LED light fixtures, 150 feet of EMT conduit, and 3 electrical panels as specified in the attached estimate.
>
> All materials will be installed in accordance with manufacturer specifications and local electrical codes, ensuring the highest quality workmanship throughout. Our installation will include proper circuit protection, grounding, and labeling for easy maintenance and future service.
>
> Upon completion, we will provide complete testing and commissioning of all systems, ensuring everything is operational and meets performance specifications. This includes final inspections, as-built drawings, and coordination with local authorities for code compliance."

Pretty good for $0.02! 🎯

---

## ✅ You're Done!

You now have AI-powered proposal generation in your app! 🎉

Time to impress your customers with professional, instant proposals!
