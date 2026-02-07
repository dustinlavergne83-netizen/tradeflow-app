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

    // Parse the incoming email data from SendGrid Inbound Parse webhook
    const formData = await req.formData();
    
    const from = formData.get("from") as string || "";
    const subject = formData.get("subject") as string || "";
    const text = formData.get("text") as string || "";
    const html = formData.get("html") as string || "";
    
    console.log("Email received from:", from);
    console.log("Subject:", subject);
    
    // Get attachment count from SendGrid
    const attachmentCount = parseInt(formData.get("attachments") as string || "0");
    console.log("Attachments:", attachmentCount);
    
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

    console.log("Pay Period:", payPeriodStart, "to", payPeriodEnd);
    console.log("Pay Date:", payDate);

    // Process attachments from SendGrid format
    const results = [];
    
    for (let i = 1; i <= attachmentCount; i++) {
      const attachmentFile = formData.get(`attachment${i}`) as File;
      const attachmentInfo = formData.get(`attachment-info`) as string;
      
      if (!attachmentFile) {
        console.log(`No attachment found at index ${i}`);
        continue;
      }
      
      // Get filename from the file object or parse from attachment-info
      let filename = attachmentFile.name || "unknown.pdf";
      
      // SendGrid may send filename in attachment-info JSON
      if (attachmentInfo) {
        try {
          const info = JSON.parse(attachmentInfo);
          if (info[`attachment${i}`]?.filename) {
            filename = info[`attachment${i}`].filename;
          }
        } catch (e) {
          // If parse fails, use filename from file object
        }
      }
      
      console.log(`Processing attachment ${i}:`, filename);
      
      // Only process PDFs
      if (!filename.toLowerCase().endsWith('.pdf')) {
        results.push({ filename, success: false, error: "Not a PDF file" });
        continue;
      }

      // Read the PDF file from SendGrid's File object
      const pdfBytes = await attachmentFile.arrayBuffer();
      const uint8Array = new Uint8Array(pdfBytes);

      // Check if this is a combined PDF or single stub
      // Expected naming: "FirstName_LastName_PayDate.pdf" for single stubs
      // Or just "CheckStubs.pdf" or "Payroll.pdf" for combined
      
      if (isCombinedPDF(filename)) {
        console.log("Processing as combined PDF");
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
        console.log("Processing as single employee stub");
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

  console.log("Combined PDF has", totalPages, "pages");

  // Get all active employees
  const { data: employees, error: empError } = await supabase
    .from("employees")
    .select("id, first_name, last_name")
    .eq("archived", false)
    .order("last_name");

  if (empError) throw empError;

  console.log("Found", employees.length, "active employees");

  const results = [];
  
  // Assume 1 page per employee, in alphabetical order by last name
  for (let i = 0; i < employees.length && i < totalPages; i++) {
    try {
      const employee = employees[i];
      console.log(`Processing page ${i + 1} for ${employee.first_name} ${employee.last_name}`);
      
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
      console.error("Error processing employee:", employees[i].first_name, employees[i].last_name, err);
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

    console.log(`Looking for employee: ${firstName} ${lastName}`);

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

    console.log(`Uploading to: ${filePath}`);

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
    console.error("Error processing single stub:", err);
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
  if (!RESEND_API_KEY) {
    console.log("RESEND_API_KEY not set, skipping notification email");
    return; // Skip if not configured
  }

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

  try {
    const res = await fetch('https://api.resend.com/emails', {
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

    if (!res.ok) {
      console.error("Failed to send notification email:", await res.text());
    } else {
      console.log("Notification email sent successfully");
    }
  } catch (err) {
    console.error("Error sending notification:", err);
  }
}
