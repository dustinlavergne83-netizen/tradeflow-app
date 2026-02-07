# Daily Breakdown Feature - Setup Instructions

## What's Been Added

✅ **Database Migration (088)** - Added `daily_breakdown` column to invoice_items table
✅ **Detail Report Display** - Shows hourly rate and daily breakdown with comments
✅ **State Management** - Added dailyBreakdowns and expandedItems state in Invoice.jsx

## What's Needed Next

The UI for adding daily breakdowns in the Invoice editor needs to be built. This will allow you to:

1. **Click "Expand Daily Breakdown"** on labor items
2. **Add daily entries** with date, hours, and comments
3. **View breakdown box** showing:
   - Date selector
   - Hours input
   - Comment box
4. **Save the breakdown** when you click "Save Changes"

## Format

Daily breakdowns are stored as JSON:
```json
{
  "2026-02-01": {"hours": 8, "notes": "Foundation work"},
  "2026-02-02": {"hours": 8, "notes": "Framing"},
  "2026-02-03": {"hours": 6, "notes": "Rough-in"}
}
```

## How It Will Work

1. Edit invoice → Expand labor item daily breakdown
2. Add dates, hours, and comments
3. Click "Save Changes"
4. Go to "📊 Detailed Report" → See breakdown by day
5. Each day shows hours × hourly rate with the comment displayed

This lets customers see exactly what work was done each day with notes!
