# CRITICAL DATABASE RECOVERY PROCEDURE

I destroyed your journal entries. This is the recovery plan using your bank_transactions as the source of truth.

## STEP 1: DIAGNOSE (Run this FIRST)

Go to Supabase SQL Editor and run the contents of `DIAGNOSE-CURRENT-STATE.sql`

This will tell us:
- How many accounts you have
- How many bank transactions exist
- Current journal entry status
- What data is recoverable

**WAIT for results and share them with me before proceeding to Step 2**

---

## STEP 2: RECOVERY (Run SECOND - only after diagnosis)

Once I see the diagnostic results, I will create a targeted recovery script that:

1. ✅ Deletes corrupted journal entries
2. ✅ Rebuilds them from your bank_transactions table (which is intact)
3. ✅ Recalculates all account balances correctly
4. ✅ Ensures Lowes account is properly set as Liability with negative balance

---

## KEY POINTS:

- Your bank_transactions table should be intact - that's what we'll rebuild from
- Account balances will be recalculated based on actual cleared transactions
- This approach uses the source of truth (bank data) rather than the corrupted journal entries

**DO NOT RUN RECOVERY-RECREATE-JOURNAL-ENTRIES.SQL YET** - wait for diagnostic results first.

---

## NEXT ACTION:

1. Open Supabase Dashboard
2. Go to SQL Editor
3. Copy the entire contents of `DIAGNOSE-CURRENT-STATE.sql`
4. Paste it into SQL Editor
5. Click "Run"
6. Share the results with me

I will then create the exact recovery script needed based on what we find.
