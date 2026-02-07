# Debug Steps - Find The Exact Problem

Follow these steps **in order** and tell me where it fails:

## Step 1: Check Browser Console
1. Open browser (F12)
2. Go to Console tab
3. Export from Takeoff
4. **WAIT 2 seconds**
5. Look for these messages:

**What you SHOULD see:**
```
💾 Attempting CO save: X items for section "lighting", coId: xxx
🗑️ Deleting old items for section "lighting"...
📝 Inserting X items: [array of items]
✅ Items inserted successfully!
💰 Updating total for coId: xxx...
✅ CO auto-save complete!
```

**Tell me:**
- Do you see "💾 Attempting CO save"? (YES/NO)
- Do you see "✅ Items inserted successfully!"? (YES/NO)
- Do you see any RED error messages? (YES/NO - if yes, copy the error)

## Step 2: Check Database (if Step 1 shows success)
1. Go to Supabase
2. SQL Editor
3. Run this:
```sql
SELECT * FROM change_order_items 
WHERE change_order_id = 'YOUR_CO_ID_HERE'
ORDER BY section, sequence;
```

**Tell me:**
- How many rows returned?
- What sections do you see?

## Step 3: Check Load Function (if Step 2 shows data)
1. After export, switch to ANOTHER section
2. Check console - should see: `🔍 Loading CO section: "power" for coId: xxx`
3. Switch BACK to original section
4. Check console - should see: `📦 CO items found for "lighting": X`

**Tell me:**
- What does it say when you come back?
- Does it say "0" items found or does it show a number?

## STOP AND REPORT
**Don't go past the step where it fails. Tell me:**
1. Which step failed?
2. What exact message(s) you saw
3. Any error messages (copy them exactly)

This will pinpoint the exact problem.
