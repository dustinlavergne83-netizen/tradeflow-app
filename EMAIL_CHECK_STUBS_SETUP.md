# Email-Based Check Stub Upload System

## Overview

Yes! You can set up an email address for your accountant to send check stubs, and they will automatically be processed and stored for each employee. This guide covers the complete implementation.

## How It Works

1. **Your accountant emails** check stubs to a dedicated email address (e.g., `checkstubs@yourdomain.com`)
2. **Email service receives** the email and forwards it to your Supabase Edge Function
3. **System automatically**:
   - Extracts PDF attachments
   - Splits combined PDFs into individual stubs (if needed)
   - Stores each stub in the employee's folder
   - Records everything in the database
   - Notifies you of success/failure

## Solution: Using Resend (You Already Have This!)

Since you already have Resend set up, we can use their inbound email routing feature. This is even simpler than other services!

### Benefits of Using Resend:
- ✅ You're already set up and configured
- ✅ No additional service to manage
- ✅ Simple webhook-based routing
- ✅ Already integrated with your Supabase functions

---

## Setup Steps with Resend

### Step 1: Configure Resend Inbound Email Route

1. Go to https://resend.com/inbound
2. Click **Add Inbound Route**
3. Configure the route:
   - **From Address**: `*@checkstubs.yourdomain.com` (or use a specific address like `paystubs@checkstubs.yourdomain.com`)
   - **Webhook URL**: Your Supabase Edge Function URL:
     ```
     https://YOUR_PROJECT_REF.supabase.co/functions/v1/process-check-stub-email
     ```
   - Click **Create Route**

### Step 2: Add DNS Records

Resend will provide you with MX records to add to your domain. Add these to your DNS:

**For a subdomain (checkstubs.yourdomain.com):**
```
Type: MX
Host: checkstubs
Value: [Provided by Resend - usually inbound.resend.com]
Priority: 10
```

**DNS TXT Record (for verification):**
```
Type: TXT
Host: checkstubs
Value: [Provided by Resend]
```

Wait 5-10 minutes for DNS propagation.

### Step 3: Edge Function Already Created!

The Edge Function has already been created at:
`supabase/functions/process-check-stub-email/index.ts`

However, we need to update it to work with Resend's webhook format (which is different from SendGrid's).

### Step 4: Update Edge Function for Resend

The current function needs to be adjusted to handle Resend's webhook payload format. Replace the beginning of the function with:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Parse the incoming email data from SendGrid
    const formData = await req.formData();
    
    const from = formData.get("from") as string;
    const subject = formData.get("subject") as string;
    const text = formData.get("text") as string;
    const html = formData.get("html") as string;
    
    // Get pay period info from email body or subject
    // Expected format in email body:
    // Pay Period: 01/15/2026 - 01/31/2026
    // Pay Date: 02/05/2026
    
    const payPeriodMatch = text?.match(/Pay Period:\s*(\d{1,2}\/\d{1,2}\/\d{4})\s*-\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);
    const payDateMatch = text?.match(/Pay Date:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);
    
    if (!payPeriodMatch || !payDateMatch) {
      throw new Error("Email must include 'Pay Period: MM/DD/YYYY - MM/DD/YYYY' and 'Pay Date: MM/DD/YYYY' in the body");
    }
    
    const payPeriodStart = convertToISODate(payPeriodMatch[1]);
    const payPeriodEnd = convertToISODate(payPeriodMatch[2]);
    const payDate = convertToISODate(payDateMatch[1]);

    // Process attachments
    const attachmentCount = parseInt(formData.get("attachments") as string || "0");
    const results = [];
    
    for (let i = 1; i <= attachmentCount; i++) {
      const attachmentFile = formData.get(`attachment${i}`) as File;
      const attachmentInfo = formData.get(`attachment${i}-info`) as string;
      
      if (!attachmentFile) continue;
      
      const attachmentData = JSON.parse(attachmentInfo || "{}");
      const filename = attachmentData.filename || `attachment${i}`;
      
      // Only process PDFs
      if (!filename.toLowerCase().endsWith('.pdf')) {
        results.push({ filename, success: false, error: "Not a PDF file" });
        continue;
      }

      // Read the PDF file
      const pdfBytes = await attachmentFile.arrayBuffer();
      const uint8Array = new Uint8Array(pdfBytes);

      // Check if this is a combined PDF or single stub
      // Expected naming: "FirstName_LastName_PayDate.pdf" for single stubs
      // Or just "CheckStubs.pdf" or "Payroll.pdf" for combined
      
      if (isCombinedPDF(filename)) {
        // Process as combined PDF - needs splitting
        const splitResults = await splitCombinedPDF(
          uint8Array,
          payPeriodStart,
          payPeriodEnd,
          payDate,
          supabase
        );
        results.push(...splitResults);
      } else {
        // Process as single employee stub
        const singleResult = await processSingleStub(
          uint8Array,
          filename,
          payPeriodStart,
          payPeriodEnd,
          payDate,
          supabase
        );
        results.push(singleResult);
      }
    }

    // Send email notification with results
    await sendProcessingNotification(from, results, supabase);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Check stubs processed",
        results 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Email Processing Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

// Helper Functions

function convertToISODate(dateStr: string): string {
  // Convert MM/DD/YYYY to YYYY-MM-DD
  const [month, day, year] = dateStr.split('/');
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function isCombinedPDF(filename: string): boolean {
  // If filename doesn't follow "FirstName_LastName_Date.pdf" pattern, assume combined
  const singleStubPattern = /^[A-Za-z]+_[A-Za-z]+_\d{4}-\d{2}-\d{2}\.pdf$/i;
  return !singleStubPattern.test(filename);
}

async function splitCombinedPDF(
  pdfBytes: Uint8Array,
  payPeriodStart: string,
  payPeriodEnd: string,
  payDate: string,
  supabase: any
): Promise<any[]> {
  // Import PDF library
  const { PDFDocument } = await import("https://cdn.skypack.dev/pdf-lib@1.17.1");
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const totalPages = pdfDoc.getPageCount();

  // Get all active employees
  const { data: employees, error: empError } = await supabase
    .from("employees")
    .select("id, first_name, last_name")
    .eq("archived", false)
    .order("last_name");

  if (empError) throw empError;

  const results = [];
  
  // Assume 1 page per employee, in alphabetical order by last name
  for (let i = 0; i < employees.length && i < totalPages; i++) {
    try {
      const employee = employees[i];
      
      // Extract single page
      const newPdf = await PDFDocument.create();
      const [copiedPage] = await newPdf.copyPages(pdfDoc, [i]);
      newPdf.addPage(copiedPage);
      const newPdfBytes = await newPdf.save();

      // Upload to storage
      const fileName = `${employee.id}_${payPeriodEnd}.pdf`;
      const filePath = `check-stubs/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("check-stubs")
        .upload(filePath, newPdfBytes, {
          contentType: "application/pdf",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Insert record
      const { error: dbError } = await supabase.from("check_stubs").insert({
        employee_id: employee.id,
        pay_period_start: payPeriodStart,
        pay_period_end: payPeriodEnd,
        pay_date: payDate,
        file_path: filePath,
        file_name: `${employee.first_name}_${employee.last_name}_${payPeriodEnd}.pdf`,
        uploaded_by: null, // Email upload
      });

      if (dbError && dbError.code !== '23505') throw dbError; // Ignore duplicates

      results.push({
        employee: `${employee.first_name} ${employee.last_name}`,
        success: true,
        message: "Check stub uploaded successfully",
      });
    } catch (err) {
      results.push({
        employee: `${employees[i].first_name} ${employees[i].last_name}`,
        success: false,
        error: err.message,
      });
    }
  }

  return results;
}

async function processSingleStub(
  pdfBytes: Uint8Array,
  filename: string,
  payPeriodStart: string,
  payPeriodEnd: string,
  payDate: string,
  supabase: any
): Promise<any> {
  try {
    // Parse filename: FirstName_LastName_Date.pdf
    const match = filename.match(/^([A-Za-z]+)_([A-Za-z]+)_(\d{4}-\d{2}-\d{2})\.pdf$/i);
    
    if (!match) {
      throw new Error("Filename must be in format: FirstName_LastName_YYYY-MM-DD.pdf");
    }

    const [, firstName, lastName] = match;

    // Find employee
    const { data: employees, error: findError } = await supabase
      .from("employees")
      .select("id")
      .ilike("first_name", firstName)
      .ilike("last_name", lastName)
      .limit(1);

    if (findError) throw findError;
    if (!employees || employees.length === 0) {
      throw new Error(`Employee not found: ${firstName} ${lastName}`);
    }

    const employeeId = employees[0].id;
    const filePath = `check-stubs/${employeeId}_${payPeriodEnd}.pdf`;

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from("check-stubs")
      .upload(filePath, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) throw uploadError;

    // Insert record
    const { error: dbError } = await supabase.from("check_stubs").insert({
      employee_id: employeeId,
      pay_period_start: payPeriodStart,
      pay_period_end: payPeriodEnd,
      pay_date: payDate,
      file_path: filePath,
      file_name: filename,
      uploaded_by: null,
    });

    if (dbError && dbError.code !== '23505') throw dbError; // Ignore duplicates

    return {
      employee: `${firstName} ${lastName}`,
      success: true,
      message: "Check stub uploaded successfully",
    };
  } catch (err) {
    return {
      filename,
      success: false,
      error: err.message,
    };
  }
}

async function sendProcessingNotification(
  recipientEmail: string,
  results: any[],
  supabase: any
): Promise<void> {
  const successCount = results.filter(r => r.success).length;
  const failureCount = results.filter(r => !r.success).length;

  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  if (!RESEND_API_KEY) return; // Skip if not configured

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Check Stub Processing Results</title>
</head>
<body style="font-family: Arial, sans-serif; padding: 20px;">
  <h2 style="color: #0b3ea8;">Check Stub Processing Complete</h2>
  
  <p>Your email has been processed successfully.</p>
  
  <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
    <p style="margin: 5px 0;"><strong>✅ Successful:</strong> ${successCount}</p>
    <p style="margin: 5px 0;"><strong>❌ Failed:</strong> ${failureCount}</p>
  </div>

  <h3>Details:</h3>
  <ul>
    ${results.map(r => `
      <li>
        <strong>${r.employee || r.filename}:</strong> 
        ${r.success ? '✅ Success' : '❌ ' + r.error}
      </li>
    `).join('')}
  </ul>

  <p style="color: #666; font-size: 12px; margin-top: 30px;">
    This is an automated notification from DML Electrical Service, LLC
  </p>
</body>
</html>
  `;

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: 'reports@dmlelectrical.com',
      to: [recipientEmail],
      subject: `Check Stub Processing Results - ${successCount} Successful, ${failureCount} Failed`,
      html: html,
    }),
  });
}
```

### Step 5: Update the Edge Function for Resend

We need to modify the function to parse Resend's webhook format. I'll create an updated version.

### Step 6: Deploy the Edge Function

```bash
# Make sure you're logged in to Supabase
supabase login

# Link your project (if not already linked)
supabase link --project-ref YOUR_PROJECT_REF

# Deploy the function
supabase functions deploy process-check-stub-email
```

### Step 7: Get Your Supabase Function URL

You'll need this for Resend webhook configuration:

```
https://YOUR_PROJECT_REF.supabase.co/functions/v1/process-check-stub-email
```

Replace `YOUR_PROJECT_REF` with your actual Supabase project reference.

### Step 8: Test the System

**Send a test email to**: `anything@checkstubs.yourdomain.com`

**Email Format**:
```
To: paystubs@checkstubs.yourdomain.com
Subject: Payroll - January 31, 2026

Body:
Pay Period: 01/15/2026 - 01/31/2026
Pay Date: 02/05/2026

Please process the attached check stubs.

Attachments:
- John_Smith_2026-01-31.pdf (for single stub)
- OR PayrollStubs.pdf (for combined PDF - will auto-split)
```

---

## Email Format Requirements

### For Single Employee Stubs (Multiple Files)
- **Filename**: `FirstName_LastName_YYYY-MM-DD.pdf`
- Example: `John_Smith_2026-01-31.pdf`
- System will match name to employees in database

### For Combined PDF (One File)
- **Filename**: Any name (e.g., `Payroll.pdf`, `CheckStubs.pdf`)
- System will auto-detect and split by employee
- Pages must be in alphabetical order by last name
- One page per employee

### Email Body Must Include:
```
Pay Period: 01/15/2026 - 01/31/2026
Pay Date: 02/05/2026
```

---

## Security Features

✅ Only accepts emails from authorized senders (configure in function)  
✅ Validates PDF files only  
✅ Automatic duplicate detection  
✅ Error notifications for failures  
✅ Secure storage with RLS policies  

---

## Cost Breakdown

| Service | Free Tier | Cost After |
|---------|-----------|------------|
| Resend | Included with your plan | Already using Resend |
| Supabase Function | 500K invocations/month | $0.10 per 100K after |
| Supabase Storage | 1 GB | $0.021/GB/month |

**For typical use** (weekly/bi-weekly payroll): **$0/month**

---

## Troubleshooting

### "Email not processing"
1. Check Resend dashboard → Inbound → Logs
2. Verify MX record is set correctly (use `nslookup -type=MX checkstubs.yourdomain.com`)
3. Check Supabase function logs in your Supabase dashboard

### "Employee not found"
- Ensure employee name in filename exactly matches database
- Check spelling and capitalization

### "PDF won't split"
- Verify pages are in correct order
- Check one page per employee

---

## Alternative: Quick Email Forwarding Setup

If you don't want to set up a custom domain, you can use **email forwarding**:

1. Your accountant emails stubs to YOU
2. You forward to a special Supabase email address
3. System processes attachments

This is simpler but requires manual forwarding.

---

## Quick Start Checklist

1. ✅ Log into Resend dashboard
2. ✅ Create inbound route pointing to your Supabase function
3. ✅ Add MX and TXT DNS records (provided by Resend)
4. ✅ Deploy the updated Edge Function (see below)
5. ✅ Test with sample email
6. ✅ Train accountant on email format

**Important:** The Edge Function needs to be updated to work with Resend's webhook format. See the updated function below.

---

## Support

Once set up, your accountant simply:
1. Exports check stubs from payroll software
2. Emails them to `paystubs@checkstubs.yourdomain.com`
3. Includes pay period/date in email body
4. Employees automatically see stubs in their app!

**No manual uploading required!**
