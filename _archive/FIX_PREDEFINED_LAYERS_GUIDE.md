# Fix Predefined Layers - Implementation Guide

## The Problem

The 7 predefined takeoff layers were created in the database, but they have `is_predefined = FALSE` (or don't exist at all). The UI code specifically filters for `is_predefined = TRUE` when displaying "Section Layers", so they don't appear.

**Look in Takeoff.jsx line ~1457:**
```javascript
{layers.filter(l => l.is_predefined).sort(...).map(layer => ...)}
```

The predefined layers that should exist are:
1. **Fixtures** (Red: #EF4444)
2. **Power** (Orange: #F59E0B)
3. **Branch** (Green: #10B981)
4. **Feeders** (Blue: #3B82F6)
5. **Switchgear** (Purple: #8B5CF6)
6. **Equipment** (Pink: #EC4899)
7. **Special Systems** (Cyan: #06B6D4)

## The Solution

**USE THIS FILE:** `FIX_PREDEFINED_LAYERS_COMPLETE.sql` (not the old FIX_PREDEFINED_LAYERS.sql)

This comprehensive script will:
1. Show you what layers currently exist
2. Update any existing layers with these names to have `is_predefined = TRUE`
3. Insert any missing layers for existing plans
4. Verify the fix worked
5. Show a summary

### Steps to Apply the Fix

1. **First, Run the Diagnostic** (Optional but recommended)
   - Open Supabase Dashboard → SQL Editor
   - Copy and paste `DIAGNOSE_LAYERS.sql`
   - Run it to see the current state
   - This helps us understand what's wrong

2. **Run the Complete Fix**
   - Open Supabase Dashboard → SQL Editor
   - Copy the **entire contents** of `FIX_PREDEFINED_LAYERS_COMPLETE.sql`
   - Paste it into the SQL Editor
   - Click "Run" (or press Ctrl+Enter)
   - **READ THE OUTPUT** - it will show you:
     - BEFORE: What layers existed
     - Step 2: How many were updated
     - Step 3: How many were inserted
     - AFTER: All predefined layers now
     - SUMMARY: Counts by plan

3. **Verify in the Output**
   - Look for the "AFTER FIX - Predefined layers:" section
   - You should see all 7 layers for each plan_id with:
     - `is_predefined = true` (or `t`)
     - Correct `display_order` (1-7)
     - Correct colors
     - `visible = true`

4. **Test in the Application**
   - **HARD REFRESH** your browser (Ctrl+Shift+R or Cmd+Shift+R)
   - Navigate to your plan's takeoff page
   - Look in the left toolbar under "Section Layers"
   - You should now see all 7 predefined layers
   - They should be in order and NOT deleteable

5. **If Still Not Showing**
   - Check browser console (F12) for errors
   - Run `DIAGNOSE_LAYERS.sql` again to verify the database
   - Make sure you're looking at the right plan_id
   - Check that the plan_id in your URL matches the plan_id in the database results

## What the Fix Does

The SQL script:

1. **Updates existing layers** that match the 7 predefined names
2. **Sets `is_predefined = TRUE`** so the UI recognizes them
3. **Sets `section_name`** to match the layer name (for grouping)
4. **Sets `display_order`** to ensure they appear in the correct order (1-7)
5. **Sets `color`** to the correct predefined color for each layer
6. **Verifies the results** by selecting and displaying the updated layers

## Future Prevention

Going forward, when creating new plans, the `create_predefined_layers()` function should automatically create these layers with `is_predefined = TRUE`. The issue was that existing layers were created before this flag was properly set.

## Expected Result

After running this fix, you should see:

- ✅ All 7 predefined layers visible in the UI
- ✅ Layers appear in the correct order
- ✅ Each layer has its designated color
- ✅ Layers cannot be deleted (protected by `is_predefined = TRUE`)
- ✅ Measurements can be assigned to these layers

## Troubleshooting

**If layers still don't appear:**
1. Check browser console for errors
2. Verify the query ran successfully in Supabase
3. Make sure you're looking at the correct plan_id
4. Clear browser cache and hard refresh (Ctrl+Shift+R)

**If you need to recreate layers from scratch:**
1. Delete existing layers for a plan (if safe to do so)
2. Use the `create_predefined_layers()` function:
   ```sql
   SELECT create_predefined_layers('YOUR_PLAN_ID', 'YOUR_COMPANY_ID');
   ```

## Related Files

- `supabase/migrations/055_add_predefined_layers.sql` - Original migration that created the structure
- `src/pages/Takeoff.jsx` - Frontend code that uses these layers
- `CHECK_AND_CREATE_PREDEFINED_LAYERS.sql` - Diagnostic query to check layer status
