# Vendors Page Implementation Guide

## Overview
A complete Vendors page has been created for managing vendor information, similar to the Customers page.

## What Was Created

### 1. Database Migration
**File:** `supabase/migrations/047_create_vendors_table.sql`

Creates a `vendors` table with the following fields:
- `id` - UUID primary key
- `vendor_name` - Vendor company name (required)
- `contact_person` - Contact person name
- `address` - Full address
- `email` - Email address
- `phone` - Phone number
- `website` - Website URL
- `account_number` - Vendor account number
- `payment_terms` - Payment terms (default: 30 days)
- `notes` - Additional notes
- `balance` - Balance owed to vendor
- `archived` - Archive status
- `created_at` / `updated_at` - Timestamps
- `company_id` - Reference to companies table

### 2. Vendors Page Component
**File:** `src/pages/Vendors.jsx`

Full-featured page with:
- ✅ Add new vendors (modal form)
- ✅ View vendor details (expandable card)
- ✅ Edit vendors inline
- ✅ Archive/unarchive vendors
- ✅ Delete vendors (single or bulk)
- ✅ Search vendors
- ✅ Filter (active/archived)
- ✅ Import/export CSV
- ✅ Quick actions (New Bill, New Expense)

### 3. Routing & Navigation
- ✅ Added to `src/App.jsx` routing at `/vendors`
- ✅ Added to `src/Components/Sidebar.jsx` navigation menu

## How to Deploy

### Step 1: Run the Database Migration

Go to your Supabase Dashboard:
1. Open https://supabase.com/dashboard
2. Select your project
3. Go to **SQL Editor**
4. Click **New Query**
5. Copy and paste the contents of `supabase/migrations/047_create_vendors_table.sql`
6. Click **Run** or press `Ctrl+Enter`

You should see: "Success. No rows returned"

### Step 2: Verify the Table

In the Supabase Dashboard:
1. Go to **Table Editor**
2. Look for the `vendors` table in the list
3. Confirm it has all the expected columns

### Step 3: Test the Page

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Navigate to http://localhost:5173/vendors

3. Test the features:
   - Click **+ Add Vendor** to add a new vendor
   - Click on a vendor row to see details
   - Try editing a vendor
   - Test search functionality
   - Test archive/unarchive
   - Try importing a CSV file

## CSV Import Format

When importing vendors, your CSV should have these columns:
- `Vendor Name` (or `Name` or `Vendor`) - Required
- `Contact Person` (or `Contact`)
- `Address`
- `Email`
- `Phone`
- `Website`
- `Account Number` (or `Account #`)
- `Payment Terms` (default: 30 if not provided)
- `Notes`
- `Balance` (or `Open Balance`)

Example CSV:
```csv
Vendor Name,Contact Person,Email,Phone,Address,Payment Terms,Balance
ABC Supplies,John Doe,john@abc.com,555-1234,123 Main St,30,0
XYZ Distributors,Jane Smith,jane@xyz.com,555-5678,456 Oak Ave,net 45,250.00
```

## Features

### Vendor Detail Card
Click any vendor row to see:
- Contact information (person, email, phone, website, address)
- Account details (account #, payment terms, balance owed)
- Quick action buttons (New Bill, New Expense)
- Recent bills, expenses, and purchase history (placeholders for future integration)

### Inline Editing
- Click the ✏️ (edit) button on any vendor row
- Edit fields directly in the table
- Click ✓ to save or ✕ to cancel

### Archive Feature
- Archive vendors you no longer work with (keeps them in database)
- Toggle "Show Archived" to view archived vendors
- Unarchive when needed

### Bulk Operations
- Select multiple vendors with checkboxes
- Use "Select All" / "Deselect All"
- Delete selected vendors in bulk

## Integration Points

The Vendors page is ready to integrate with:
- **Bills** - Link bills to vendors
- **Expenses** - Link expenses to vendors
- **Purchase Orders** - Track purchases from vendors
- **Bank Transactions** - Match transactions to vendor bills

## Database Permissions

The migration includes Row Level Security (RLS) policies:
- Users can only manage vendors in their own company
- Policy: `"Users can manage vendors in their company"`

## Next Steps

Consider adding:
1. **1099 Tracking** - Track 1099 contractors
2. **Payment History** - Show payment records
3. **Purchase Order Management** - Create and track POs
4. **Vendor Performance** - Track on-time delivery, quality metrics
5. **Tax Information** - W-9 forms, EIN numbers
6. **Credit Limits** - Set and track credit limits
7. **Preferred Vendor Status** - Mark preferred vendors
8. **Auto-categorization** - Automatically assign expense categories per vendor

## Troubleshooting

### "Table does not exist" error
- Make sure you ran the migration in Supabase
- Check that the table appears in the Table Editor

### "Permission denied" error
- Verify RLS policies are correctly applied
- Check that your user has a company_id in the employees table

### Vendors not loading
- Check browser console for errors
- Verify Supabase connection in `.env` file
- Ensure you're logged in with a valid account

## Support

If you encounter issues:
1. Check the browser console for error messages
2. Verify the migration was run successfully
3. Check that RLS policies allow your user to access the data
4. Ensure your `.env` file has correct Supabase credentials

---

**Status:** ✅ Ready to Deploy
**Version:** 1.0
**Date:** January 4, 2026
