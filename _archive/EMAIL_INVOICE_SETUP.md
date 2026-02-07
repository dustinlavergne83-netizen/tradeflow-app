# 📧 Email Invoice Feature - Complete Setup Guide

## ✅ What's Been Implemented

You can now email invoices directly to customers from your invoice editor, just like you do with proposals!

---

## 🎯 Features

### 1. Customer Email Field ✅
- Added customer email field to invoice form
- Saved with invoice for future reference
- Pre-filled from project customer if available

### 2. Email Functionality ✅
- **"📧 Email Invoice"** button in invoice editor
- Professional HTML email template
- Includes all invoice details:
  - Invoice number and dates
  - Customer information
  - Line items table
  - Payment totals
  - Balance due (color-coded)
  - Payment terms and notes

### 3. Automatic Status Update ✅
- Invoice status automatically changes to "sent" after emailing
- Tracks when invoices have been sent to customers

---

## 📋 Setup Required

### Step 1: Run Database Migration

You need to add the `customer_email` column to the invoices table.

**Option A: Supabase Dashboard (Recommended)**
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy and paste this SQL:

```sql
-- Add customer_email column to invoices table
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_email text;

-- Add index for faster email lookups
CREATE INDEX IF NOT EXISTS invoices_customer_email_idx ON invoices(customer_email);
```

4. Click **Run**
5. Done! ✅

**Option B: Using Supabase CLI**
```bash
# The migration file is already created at:
# supabase/migrations/016_add_customer_email_to_invoices.sql

# Run it with:
npx supabase db push
```

### Step 2: Deploy Edge Function

Deploy the `send-invoice` Edge Function to Supabase.

```bash
# Deploy the function
npx supabase functions deploy send-invoice

# Verify the RESEND_API_KEY secret is set (should already be set from proposals)
npx supabase secrets list
```

**If you need to set the RESEND_API_KEY:**
```bash
npx supabase secrets set RESEND_API_KEY=your_resend_api_key_here
```

---

## 🚀 How to Use

### Creating and Sending an Invoice:

1. **Create/Edit Invoice**
   - Go to project detail page
   - Click "+ New Invoice" or edit existing invoice
   
2. **Fill in Details**
   - Invoice number (auto-generated)
   - Customer name
   - **Customer email** (required for sending)
   - Invoice date and due date
   - Add line items
   - Set amount paid (if any)
   
3. **Save First** (Optional but recommended)
   - Click "💾 Save Changes" to save your work
   
4. **Send Email**
   - Click **"📧 Email Invoice"** button
   - Confirm the recipient email
   - Wait for success message
   - Invoice status automatically updates to "sent"

---

## 📧 Email Template Features

The invoice email includes:

### Header
- Professional DML Electrical branding
- Invoice number and date prominently displayed

### Bill To Section
- Customer name
- Due date (highlighted if overdue)

### Line Items Table
- Description, quantity, unit price, total
- Clean, professional formatting
- Easy to read on desktop and mobile

### Payment Summary
- Subtotal
- Amount paid (if any)
- **Balance due** (color-coded: red if unpaid, green if paid)

### Payment Terms
- Automatic payment reminder if balance is due
- "Paid in Full" message if fully paid
- Custom notes from invoice

### Footer
- Company contact information
- Professional closing

---

## 🎨 Email Customization

To customize the email template, edit:
```
supabase/functions/send-invoice/index.ts
```

You can modify:
- Company name and address (in footer)
- Email sender address (`from: 'invoices@dmlelectrical.com'`)
- Colors and styling
- Text and messaging

After making changes, redeploy:
```bash
npx supabase functions deploy send-invoice
```

---

## 🔍 Testing Checklist

Test these scenarios:

- [ ] Add customer email to new invoice
- [ ] Save invoice with email
- [ ] Send invoice to test email address
- [ ] Verify email received and looks correct
- [ ] Check invoice status updated to "sent"
- [ ] Test sending progress billing invoice
- [ ] Test invoice with partial payment
- [ ] Test fully paid invoice email
- [ ] Verify overdue invoice shows in red
- [ ] Test email with custom notes

---

## 🐛 Troubleshooting

### Email not sending?

1. **Check Edge Function is deployed:**
   ```bash
   npx supabase functions list
   ```
   Should show `send-invoice` in the list

2. **Check RESEND_API_KEY is set:**
   ```bash
   npx supabase secrets list
   ```
   Should show `RESEND_API_KEY`

3. **Check browser console for errors:**
   - Open browser DevTools (F12)
   - Look for error messages

4. **Verify customer email is entered:**
   - Email field must be filled in
   - Must be valid email format

### Customer email not saving?

1. **Run the database migration:**
   - See Step 1 above
   - Check if column exists in Supabase dashboard

2. **Check for database errors:**
   - Look in browser console
   - Check Supabase logs

---

## 💡 Tips & Best Practices

### 1. Always Save Before Sending
- Click "Save Changes" before emailing
- Ensures all data is up to date

### 2. Test with Your Own Email First
- Send to yourself to verify formatting
- Check on mobile and desktop

### 3. Use Professional Email Domain
- Update sender address from 'invoices@dmlelectrical.com' to your domain
- Improves deliverability and trust

### 4. Track Sent Invoices
- Status automatically changes to "sent"
- Use this to track which invoices have been delivered

### 5. Follow Up on Overdue Invoices
- Overdue invoices show with red balance
- Email includes payment reminder

---

## 📊 How It Works

### Flow:
1. User clicks "📧 Email Invoice"
2. Frontend validates email and line items
3. Frontend calls `send-invoice` Edge Function
4. Edge Function generates HTML email using Resend API
5. Email is sent to customer
6. Invoice status updated to "sent"
7. Success message shown to user

### Data Sent to Edge Function:
- Customer email address
- Customer name
- Invoice number and dates
- All line items
- Payment amounts
- Notes

### Security:
- Edge Function requires authentication
- RESEND_API_KEY stored as secret
- Emails only sent to specified recipient

---

## 🔗 Related Features

This works seamlessly with:
- **Progress Billing** - Email progress invoices
- **Direct Invoices** - Email custom invoices  
- **Proposal Conversion** - Email invoices created from proposals
- **Invoice Preview** - Preview before sending

---

## 📝 Files Modified

1. **Frontend:**
   - `src/pages/Invoice.jsx` - Added email field and send function

2. **Backend:**
   - `supabase/functions/send-invoice/index.ts` - Email Edge Function
   - `supabase/migrations/016_add_customer_email_to_invoices.sql` - Database migration

---

## ✨ Next Steps

Optional enhancements you might consider:

- [ ] Email receipt confirmation to sender
- [ ] Schedule automated payment reminders
- [ ] Attach PDF version of invoice
- [ ] Track email opens and clicks
- [ ] Send to multiple recipients (CC/BCC)
- [ ] Customize email templates per customer

---

## 🎉 You're All Set!

Once you've run the migration and deployed the Edge Function, you can start emailing invoices to customers!

**Quick Start:**
1. Run SQL migration in Supabase dashboard
2. Deploy Edge Function: `npx supabase functions deploy send-invoice`
3. Edit any invoice
4. Add customer email
5. Click "📧 Email Invoice"
6. Done! ✅

---

**Created:** December 30, 2025  
**Status:** Ready to Deploy  
**Similar To:** Proposal Email Feature (already working)
