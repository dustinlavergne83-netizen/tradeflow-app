# FIX: Materials Catalog Covering Last Items

## Problem
The materials catalog at the bottom covers the last items when you scroll down the table.

## Solution
Add bottom padding to the main page container so you can scroll past the catalog.

## EXACT LOCATION
**File:** `src/pages/Estimate.jsx`
**Line:** Around line 2065

## FIND THIS CODE:
```jsx
<div
  style={{
    padding: 24,
    fontFamily: "Arial",
    maxWidth: 1200,
    margin: "0 auto",
  }}
>
```

## CHANGE IT TO:
```jsx
<div
  style={{
    padding: 24,
    fontFamily: "Arial",
    maxWidth: 1200,
    margin: "0 auto",
    paddingBottom: 280,
  }}
>
```

## What Changed
Added `paddingBottom: 280,` to give extra space at the bottom.

This pushes everything up by 280px so when you scroll to the last items, they appear ABOVE the fixed catalog at the bottom.

## That's It!
Just add that ONE line and save the file. The catalog won't cover your items anymore.
