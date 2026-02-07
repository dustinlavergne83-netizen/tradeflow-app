# Bank Statement CSV Upload - Implementation Guide

## Overview

The CSV upload feature allows you to import bank transactions directly from CSV files exported from your bank or accounting software. This streamlines the process of reconciling bank accounts by eliminating manual data entry.

## Features

✅ **Drag & Drop or Browse** - Upload files easily via drag-and-drop or file browser
✅ **Auto-Detection** - Automatically detects common column formats from major banks
✅ **Column Mapping** - Manual override for custom CSV formats
✅ **Preview** - See how your data will be imported before committing
✅ **Bulk Import** - Import hundreds of transactions in seconds
✅ **Error Handling** - Validation and error reporting for data quality
✅ **Multiple Formats** - Supports various date and amount formats

## How to Use

### Step 1: Export Your Bank Statement

Export a CSV file from your bank's online banking portal. Most banks provide this option under:
- **Statements & Documents**
- **Download Center**
- **Activity Export**
- **Transaction History**

**Recommended Export Settings:**
- Format: CSV (Comma-separated values)
- Include all transactions for the period
- Include headers/column names

### Step 2: Access Upload Feature

1. Navigate to **Accounting → Bank Accounts**
2. Click on the bank account you want to import to
3. Click the **📤 Upload CSV** button in the top right

### Step 3: Upload Your File

- **Drag and drop** your CSV file into the upload zone, OR
- Click **Browse Files** to select from your computer

### Step 4: Map Columns

The system will automatically detect common column formats, but you can manually adjust if needed:

**Required Fields:**
- **Transaction Date*** - The date the transaction occurred
- **Description*** - Transaction description or memo
- **Amount*** - Transaction amount

**Optional Fields:**
- **Reference/Check Number** - Check numbers or transaction IDs
- **Transaction Type** - Type of transaction (will auto-detect if not provided)

### Step 5: Preview & Import

- Review the preview table showing the first 5 transactions
- Verify dates, amounts, and descriptions are correct
- Click **✓ Import [X] Transactions** to complete the import

## Supported CSV Formats

### Bank-Specific Formats

#### Chase Bank
```csv
Details,Posting Date,Description,Amount,Type,Balance,Check or Slip #
DEBIT,01/15/2024,OFFICE DEPOT,-125.50,ACH_DEBIT,5234.50,
```

#### Wells Fargo
```csv
Date,Amount,*,*,Description
01/15/2024,-125.50,*,*,OFFICE DEPOT PURCHASE
```

#### Bank of America
```csv
Posted Date,Reference Number,Payee,Address,Amount
01/15/2024,12345678,OFFICE DEPOT,123 MAIN ST,-125.50
```

#### Generic Format
```csv
Date,Description,Debit,Credit,Balance
01/15/2024,OFFICE DEPOT,125.50,,5234.50
```

### Date Formats Supported

- `MM/DD/YYYY` - 01/15/2024
- `MM-DD-YYYY` - 01-15-2024
- `YYYY-MM-DD` - 2024-01-15
- `DD/MM/YYYY` - 15/01/2024

### Amount Formats Supported

- **Positive/Negative:** `125.50` or `-125.50`
- **With Currency Symbol:** `$125.50` or `-$125.50`
- **Thousands Separator:** `$1,234.50` or `-$1,234.50`
- **Parentheses for Negatives:** `(125.50)` - automatically converts to -125.50
- **Separate Debit/Credit Columns:** System will merge them appropriately

## Transaction Type Detection

The system automatically determines transaction types based on:

1. **Transaction Type Column** (if provided):
   - "deposit", "credit" → Deposit
   - "withdrawal", "debit", "payment" → Withdrawal
   - "transfer" → Transfer
   - "fee" → Fee
   - "interest" → Interest

2. **Amount Sign** (if no type column):
   - Positive amounts → Deposits
   - Negative amounts → Withdrawals

## Best Practices

### Before Importing

1. ✅ **Review your CSV** - Open in Excel/Google Sheets to verify data quality
2. ✅ **Check date range** - Ensure you're not importing duplicate transactions
3. ✅ **Verify balance** - Compare ending balance with bank statement
4. ✅ **Remove headers** - Some banks add extra header rows; keep only column names

### After Importing

1. ✅ **Mark as Cleared** - Click the checkbox next to each transaction to mark it as cleared
2. ✅ **Add Categories** - Edit transactions to add categories for reporting
3. ✅ **Link to Entries** - Match transactions to journal entries for reconciliation
4. ✅ **Verify Balance** - Check that the cleared balance matches your bank

## Troubleshooting

### Common Issues

#### Issue: "No valid transactions to import"
**Solution:** 
- Verify CSV has data rows (not just headers)
- Check that date, description, and amount columns are mapped correctly
- Ensure dates are in a recognized format

#### Issue: "Row X: Missing or invalid date"
**Solution:**
- Check date format in your CSV
- Ensure date column contains actual dates, not text
- Remove any blank rows

#### Issue: Amounts importing incorrectly
**Solution:**
- Check if negative amounts use parentheses `(125.50)` or minus sign `-125.50`
- Verify amount column doesn't have non-numeric characters (except $ , . -)
- For separate Debit/Credit columns, map both to "Amount"

#### Issue: All transactions showing as same type
**Solution:**
- If CSV has a transaction type column, map it
- Otherwise, ensure amounts have correct signs (+ for deposits, - for withdrawals)
- You can manually edit transaction types after import

### Data Quality Tips

1. **Remove duplicates before import** - Check if transactions already exist
2. **Clean up descriptions** - Some banks include extra codes; clean in Excel first
3. **Verify amounts** - Cross-check a few transactions manually
4. **Test with small batch first** - Import 5-10 transactions to verify format

## Example CSV Files

### Example 1: Simple Format
```csv
Date,Description,Amount
01/15/2024,Customer Payment,1500.00
01/16/2024,Office Supplies,-125.50
01/17/2024,Electric Bill,-234.75
```

### Example 2: Detailed Format
```csv
Transaction Date,Description,Reference,Debit,Credit,Type
01/15/2024,Customer Payment,INV-1001,,1500.00,Deposit
01/16/2024,Office Supplies,CK-5001,125.50,,Check
01/17/2024,Electric Bill,ACH-2001,234.75,,ACH
```

### Example 3: Bank Format
```csv
Posting Date,Details,Reference Number,Withdrawals,Deposits,Balance
01/15/2024,CUSTOMER PAYMENT - INV 1001,,0.00,1500.00,6734.50
01/16/2024,CHECK #5001 - OFFICE SUPPLIES,5001,125.50,0.00,6609.00
01/17/2024,ACH DEBIT - ELECTRIC CO,ACH2001,234.75,0.00,6374.25
```

## Technical Details

### Imported Fields

When you import transactions, the following data is saved:

- `transaction_date` - From your Date column
- `description` - From your Description column
- `amount` - From your Amount column (positive for deposits, negative for withdrawals)
- `reference_number` - From your Reference column (optional)
- `transaction_type` - Auto-detected or from Type column
- `bank_account_id` - Automatically linked to current account
- `created_by` - Your user ID
- `imported_date` - Timestamp of import
- `is_cleared` - Defaults to false (you mark as cleared manually)
- `notes` - Automatically includes import filename

### Security & Permissions

- Only users with access to the bank account can import transactions
- Row-level security ensures transactions are company-specific
- Imported transactions are editable and deletable
- Import history is tracked via `imported_date` field

## Advanced Features

### Duplicate Prevention

To prevent importing duplicates:
1. Check existing transactions before importing
2. Use date ranges that don't overlap
3. Filter by imported vs. manual transactions using the `imported_date` field

### Batch Processing

The system can handle large CSV files:
- Tested with up to 1,000 transactions
- Validation runs before import
- Error summary shows which rows failed
- Option to continue with valid rows if some have errors

### Custom Formats

If your bank uses a unique format:
1. Export a sample CSV
2. Map columns manually in the upload interface
3. Preview to verify correct mapping
4. Save the mapping for future imports (feature coming soon)

## Support

For issues or questions:
- Check the troubleshooting section above
- Verify your CSV format matches examples
- Test with a small sample file first
- Contact support if problems persist

## Future Enhancements

Planned features:
- 🔜 Save custom column mappings
- 🔜 Import scheduling/automation
- 🔜 QFX/OFX file support
- 🔜 Automatic duplicate detection
- 🔜 Smart transaction categorization
- 🔜 Multi-account import
