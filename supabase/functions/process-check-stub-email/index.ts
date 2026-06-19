// Process Check Stub Email — Multi-source inbound handler
// Receives PDF from CPA (email or direct upload), splits by page,
// uses GPT-4o to identify each employee AND extract wages/taxes/garnishments,
// stores each page as a PDF in Supabase Storage + check_stubs table,
// then creates a pending payroll_expense_approvals record for owner review.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // ── Build service-role Supabase client ──────────────────────────────────────
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  // ── Try to extract authenticated user ID from the JWT ───────────────────────
  // Used as created_by on payroll_expense_approvals records.
  let callerUserId: string | null = null;
  const authHeader = req.headers.get("authorization") ?? "";
  if (authHeader.startsWith("Bearer ")) {
    try {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      callerUserId = user?.id ?? null;
      if (callerUserId) console.log("Caller user ID:", callerUserId);
    } catch (e) {
      console.warn("Could not decode JWT user (non-fatal):", e);
    }
  }

  try {
    const contentType = req.headers.get("content-type") ?? "";
    console.log("Incoming content-type:", contentType);

    let from = "";
    let subject = "";
    let filename = "paystubs.pdf";
    let pdfBytes: Uint8Array;
    // Set to true for direct uploads (email-inbox, manual-upload, smartvault)
    // so we don't send a result email — user reviews on the Payroll Approval page instead.
    let skipResultEmail = false;

    // ── 1a. Mailgun inbound (multipart/form-data) ────────────────────────────
    if (contentType.includes("multipart/form-data")) {
      console.log("Parsing Mailgun multipart webhook...");
      const form = await req.formData();

      from = (form.get("from") as string) ?? "";
      const to = (form.get("recipient") as string) ?? (form.get("To") as string) ?? "";
      subject = (form.get("subject") as string) ?? (form.get("Subject") as string) ?? "";
      const attachmentCount = parseInt((form.get("attachment-count") as string) ?? "0", 10);

      console.log("Mailgun from:", from, "to:", to, "subject:", subject, "attachments:", attachmentCount);

      const toAddresses = [to].filter(Boolean);
      const isPaystubs = toAddresses.some((addr) => {
        const a = addr.toLowerCase();
        return a.includes("paystubs@stubs.dmlelectrical.com") || a.includes("paystubs@dmlelectrical.com");
      });
      if (!isPaystubs) {
        console.log("Ignoring — not addressed to paystubs:", toAddresses);
        return new Response(JSON.stringify({ ignored: true }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let pdfFile: File | null = null;
      for (let i = 1; i <= Math.max(attachmentCount, 5); i++) {
        const file = form.get(`attachment-${i}`) as File | null;
        if (!file) continue;
        if (file.type?.includes("pdf") || file.name?.toLowerCase().endsWith(".pdf")) {
          pdfFile = file;
          filename = file.name;
          console.log("Mailgun PDF:", file.name, "size:", file.size);
          break;
        }
      }
      if (!pdfFile) {
        const msg = "No PDF attachment found in Mailgun email";
        console.error(msg);
        await sendResultEmail(from, [], msg, supabase);
        return new Response(JSON.stringify({ error: msg }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      pdfBytes = new Uint8Array(await pdfFile.arrayBuffer());

    // ── 1b–1d. JSON sources ──────────────────────────────────────────────────
    } else {
      const body = await req.json();

      // Direct upload from Email Inbox, manual upload, or SmartVault
      if (body.source?.startsWith("email-inbox") && body.contentBase64) {
        from = body.from ?? "admin-upload";
        subject = body.subject ?? "";
        filename = body.filename ?? "paystubs.pdf";
        skipResultEmail = true; // review on Payroll Approval page, no email needed
        console.log("Email Inbox upload from:", from, "filename:", filename);
        pdfBytes = base64ToUint8Array(body.contentBase64);

      // Postmark
      } else if (body.MailboxHash !== undefined || Array.isArray(body.Attachments)) {
        from = body.From ?? body.from ?? "";
        subject = body.Subject ?? body.subject ?? "";
        const toRaw: string = body.To ?? body.to ?? body.OriginalRecipient ?? "";
        if (!toRaw.toLowerCase().includes("paystubs")) {
          return new Response(JSON.stringify({ ignored: true }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const attachments: any[] = body.Attachments ?? [];
        const pdfAtt = attachments.find(
          (a: any) => (a.ContentType ?? "").toLowerCase().includes("pdf") ||
            (a.Name ?? "").toLowerCase().endsWith(".pdf")
        );
        if (!pdfAtt) {
          await sendResultEmail(from, [], "No PDF attachment found in Postmark email", supabase);
          return new Response(JSON.stringify({ error: "No PDF" }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        filename = pdfAtt.Name ?? "paystubs.pdf";
        pdfBytes = base64ToUint8Array(pdfAtt.Content ?? "");

      // SmartVault / manual upload
      } else if (body.source === "smartvault" || body.source === "manual-upload") {
        from = body.from ?? "admin-upload";
        subject = body.subject ?? "";
        filename = body.filename ?? "paystubs.pdf";
        skipResultEmail = true; // review on Payroll Approval page, no email needed
        console.log("Direct upload source:", body.source, "filename:", filename);
        const b64 = body.contentBase64 ?? body.file_content ?? body.content ?? "";
        pdfBytes = base64ToUint8Array(b64);

      // Resend
      } else {
        const eventType: string = body.type ?? "";
        if (eventType && eventType !== "email.received") {
          return new Response(JSON.stringify({ ignored: true, type: eventType }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const emailData = (body.data && typeof body.data === "object") ? body.data : body;
        from = emailData.from ?? "";
        subject = emailData.subject ?? "";
        const toAddresses: string[] = Array.isArray(emailData.to) ? emailData.to
          : typeof emailData.to === "string" ? [emailData.to] : [];
        if (!toAddresses.some((a: string) => a.toLowerCase().includes("paystubs")) && toAddresses.length > 0) {
          return new Response(JSON.stringify({ ignored: true }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const attachments: any[] = emailData.attachments ?? [];
        const pdfAtt = attachments.find(
          (a: any) => (a.content_type ?? a.contentType ?? "").includes("pdf") ||
            (a.filename ?? "").toLowerCase().endsWith(".pdf")
        );
        if (!pdfAtt) {
          await sendResultEmail(from, [], "No PDF attachment found in the email.", supabase);
          return new Response(JSON.stringify({ error: "No PDF attachment" }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const inlineB64: string = pdfAtt.content ?? pdfAtt.data ?? "";
        if (!inlineB64) {
          const msg = "Resend does not provide attachment content. Use Postmark or Email Inbox instead.";
          await sendResultEmail(from, [], msg, supabase);
          return new Response(JSON.stringify({ error: msg }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        filename = pdfAtt.filename ?? "paystubs.pdf";
        pdfBytes = base64ToUint8Array(inlineB64);
      }
    }

    // ── If no callerUserId, try to find admin by email domain / company ───────
    if (!callerUserId) {
      try {
        const { data: adminRows } = await supabase
          .from("employees")
          .select("user_id")
          .eq("admin", true)
          .limit(1);
        callerUserId = adminRows?.[0]?.user_id ?? null;
        if (callerUserId) console.log("Found admin user_id:", callerUserId);
      } catch (e) {
        console.warn("Could not find admin user (non-fatal):", e);
      }
    }

    // ── 2. Get employee list ──────────────────────────────────────────────────
    const { data: employees, error: empError } = await supabase
      .from("employees")
      .select("id, first_name, last_name")
      .or("archived.is.null,archived.eq.false")
      .order("last_name");
    if (empError) throw empError;
    console.log("Loaded", employees?.length ?? 0, "employees");

    // ── 3. Load pdf-lib and split into individual pages ───────────────────────
    const { PDFDocument } = await import("https://esm.sh/pdf-lib@1.17.1");
    const fullPdf = await PDFDocument.load(pdfBytes!);
    const totalPages = fullPdf.getPageCount();
    console.log("PDF pages:", totalPages);

    // ── 4. Process each page ──────────────────────────────────────────────────
    const results: Array<{
      page: number;
      employee?: string;
      employee_id?: string;
      pay_date?: string;
      gross_wages?: number;
      net_pay?: number;
      success: boolean;
      error?: string;
    }> = [];

    for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
      console.log(`\n--- Page ${pageIndex + 1}/${totalPages} ---`);
      try {
        // Extract single-page PDF
        const singlePdf = await PDFDocument.create();
        const [copiedPage] = await singlePdf.copyPages(fullPdf, [pageIndex]);
        singlePdf.addPage(copiedPage);
        const pageBytes = await singlePdf.save();

        // Extract text
        const pageText = extractTextFromPDFPage(pageBytes);
        console.log("Text snippet:", pageText.substring(0, 200));

        // AI: identify employee + extract all financial figures
        const aiResult = await parsePaystubWithAI(pageText, employees ?? [], pageIndex + 1);
        console.log("AI result:", JSON.stringify(aiResult));

        if (!aiResult.employee_id) {
          results.push({
            page: pageIndex + 1,
            success: false,
            error: aiResult.error ?? `Could not identify employee on page ${pageIndex + 1}`,
          });
          continue;
        }

        const emp = (employees ?? []).find((e) => e.id === aiResult.employee_id);
        const empName = emp ? `${emp.first_name} ${emp.last_name}` : (aiResult.matched_employee_name ?? "Unknown");

        // Build file path: FirstName_LastName/YYYY/MM.DD.YYpaystub.pdf
        const payDate = aiResult.pay_date ?? aiResult.pay_period_end ?? new Date().toISOString().split("T")[0];
        const [yr, mo, dy] = payDate.split("-");
        const datePart = `${mo}.${dy}.${yr.slice(2)}`;
        const folderName = `${emp?.first_name ?? "Unknown"}_${emp?.last_name ?? "Employee"}`;
        const filePath = `${folderName}/${yr}/${datePart}paystub.pdf`;
        const fileNameStr = `${datePart} paystub.pdf`;

        // Upload PDF
        const { error: uploadError } = await supabase.storage
          .from("check-stubs")
          .upload(filePath, pageBytes, { contentType: "application/pdf", upsert: true });
        if (uploadError) throw new Error("Upload failed: " + uploadError.message);

        // Insert check_stubs record
        let checkStubId: string | null = null;
        const { data: stubRow, error: dbError } = await supabase
          .from("check_stubs")
          .insert({
            employee_id: aiResult.employee_id,
            pay_period_start: aiResult.pay_period_start ?? null,
            pay_period_end: aiResult.pay_period_end ?? null,
            pay_date: payDate,
            file_path: filePath,
            file_name: fileNameStr,
            uploaded_by: callerUserId,
            ai_confidence: aiResult.confidence ?? 0,
            ai_raw_name: aiResult.employee_name ?? null,
          })
          .select("id")
          .single();

        if (dbError && dbError.code !== "23505") {
          throw new Error("DB insert failed: " + dbError.message);
        }
        checkStubId = stubRow?.id ?? null;

        // ── NEW: Create pending payroll_expense_approvals record ────────────
        await createPayrollApprovalRecord({
          supabase,
          employeeId: aiResult.employee_id,
          employeeName: empName,
          payDate,
          payPeriodStart: aiResult.pay_period_start ?? null,
          payPeriodEnd: aiResult.pay_period_end ?? null,
          grossWages: aiResult.gross_wages ?? 0,
          federalTax: aiResult.federal_tax ?? 0,
          stateTax: aiResult.state_tax ?? 0,
          socialSecurity: aiResult.social_security ?? 0,
          medicare: aiResult.medicare ?? 0,
          garnishments: aiResult.garnishments ?? 0,
          otherDeductions: aiResult.other_deductions ?? 0,
          netPay: aiResult.net_pay ?? 0,
          checkStubId,
          sourceEmail: from,
          sourceSubject: subject,
          sourceFilename: filename,
          createdBy: callerUserId,
        });

        // Send push notification (non-blocking)
        sendPayStubPushNotification(supabase, aiResult.employee_id, empName, payDate)
          .catch((e) => console.warn("Push notification failed:", e.message));

        results.push({
          page: pageIndex + 1,
          employee: empName,
          employee_id: aiResult.employee_id,
          pay_date: payDate,
          gross_wages: aiResult.gross_wages,
          net_pay: aiResult.net_pay,
          success: true,
        });

      } catch (err: any) {
        console.error(`Page ${pageIndex + 1} failed:`, err.message);
        results.push({ page: pageIndex + 1, success: false, error: err.message });
      }
    }

    // ── 5. Send result summary email back to CPA ──────────────────────────────
    // Only for actual email submissions (Mailgun/Postmark/Resend).
    // For direct uploads, the user reviews on the Payroll Approval page.
    if (!skipResultEmail) {
      await sendResultEmail(from, results, null, supabase);
    } else {
      console.log("Skipping result email — direct upload, review via Payroll Approval page.");
    }

    const successCount = results.filter((r) => r.success).length;
    console.log(`\nDone: ${successCount}/${totalPages} pages processed`);

    return new Response(
      JSON.stringify({
        success: true,
        total: totalPages,
        processed: successCount,
        results,
        message: `${successCount} check stub(s) processed and queued for your approval in the Payroll Approval Queue.`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("Fatal error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ─── Create a pending payroll_expense_approvals record ───────────────────────
async function createPayrollApprovalRecord(opts: {
  supabase: any;
  employeeId: string;
  employeeName: string;
  payDate: string;
  payPeriodStart: string | null;
  payPeriodEnd: string | null;
  grossWages: number;
  federalTax: number;
  stateTax: number;
  socialSecurity: number;
  medicare: number;
  garnishments: number;
  otherDeductions: number;
  netPay: number;
  checkStubId: string | null;
  sourceEmail: string;
  sourceSubject: string;
  sourceFilename: string;
  createdBy: string | null;
}): Promise<void> {
  try {
    const { error } = await opts.supabase
      .from("payroll_expense_approvals")
      .insert({
        employee_id: opts.employeeId,
        employee_name: opts.employeeName,
        pay_date: opts.payDate,
        pay_period_start: opts.payPeriodStart,
        pay_period_end: opts.payPeriodEnd,
        gross_wages: opts.grossWages,
        federal_tax: opts.federalTax,
        state_tax: opts.stateTax,
        social_security: opts.socialSecurity,
        medicare: opts.medicare,
        garnishments: opts.garnishments,
        other_deductions: opts.otherDeductions,
        net_pay: opts.netPay,
        check_stub_id: opts.checkStubId,
        source_email: opts.sourceEmail,
        source_subject: opts.sourceSubject,
        source_filename: opts.sourceFilename,
        status: "pending",
        created_by: opts.createdBy,
      });
    if (error) {
      console.error("Failed to create payroll approval record:", error.message);
    } else {
      console.log(`✅ Payroll approval record created for ${opts.employeeName}`);
    }
  } catch (e: any) {
    console.error("createPayrollApprovalRecord threw:", e.message);
  }
}

// ─── AI: Parse paystub — extract employee identity + ALL financial figures ────
async function parsePaystubWithAI(
  pageText: string,
  employees: Array<{ id: string; first_name: string; last_name: string }>,
  pageNum: number
): Promise<{
  employee_name?: string | null;
  matched_employee_name?: string | null;
  employee_id?: string | null;
  pay_period_start?: string | null;
  pay_period_end?: string | null;
  pay_date?: string | null;
  gross_wages?: number;
  federal_tax?: number;
  state_tax?: number;
  social_security?: number;
  medicare?: number;
  garnishments?: number;
  other_deductions?: number;
  net_pay?: number;
  confidence?: number;
  error?: string;
}> {
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiKey) return { error: "OPENAI_API_KEY not configured" };

  const employeeListStr = employees
    .map((e) => `${e.first_name} ${e.last_name}`)
    .join(", ");

  const prompt = `This is extracted text from page ${pageNum} of a paycheck stub PDF.

KNOWN EMPLOYEES: ${employeeListStr}

EXTRACTED TEXT:
${pageText.substring(0, 3500)}

Return ONLY valid JSON (no markdown, no code blocks):
{
  "employee_name": "exact name as shown on stub",
  "matched_employee_name": "closest match from KNOWN EMPLOYEES list, or null",
  "pay_period_start": "YYYY-MM-DD or null",
  "pay_period_end": "YYYY-MM-DD or null",
  "pay_date": "YYYY-MM-DD or null",
  "gross_wages": 0.00,
  "federal_tax": 0.00,
  "state_tax": 0.00,
  "social_security": 0.00,
  "medicare": 0.00,
  "garnishments": 0.00,
  "other_deductions": 0.00,
  "net_pay": 0.00,
  "confidence": 0.95
}

Rules:
- matched_employee_name MUST be exactly one name from KNOWN EMPLOYEES, or null
- All dollar amounts are positive numbers (no dollar signs or commas)
- gross_wages: total gross pay before deductions (look for "Gross Pay", "Gross Earnings", "Current Gross")
- federal_tax: federal income tax withheld (look for "Federal Tax", "Fed Inc Tax", "Federal Withholding")
- state_tax: state income tax withheld (look for "State Tax", "State Inc Tax", "State Withholding")
- social_security: FICA social security (look for "Social Security", "SS Tax", "FICA")
- medicare: Medicare tax (look for "Medicare", "Med Tax")
- garnishments: wage garnishments (look for "Garnishment", "Child Support", "Levy")
- other_deductions: any other deductions not listed above
- net_pay: take-home pay after all deductions (look for "Net Pay", "Net Amount", "Check Amount")
- confidence: 0.0-1.0 for employee match certainty`;

  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 600,
        temperature: 0,
      }),
    });

    if (!resp.ok) {
      return { error: `OpenAI error: ${await resp.text()}` };
    }

    const data = await resp.json();
    const rawText = data.choices?.[0]?.message?.content ?? "";
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { error: `Could not parse AI response: ${rawText}` };

    const parsed = JSON.parse(jsonMatch[0]);

    // Match employee
    let matchedEmployee: typeof employees[0] | undefined;
    if (parsed.matched_employee_name) {
      matchedEmployee = employees.find(
        (e) => `${e.first_name} ${e.last_name}`.toLowerCase() ===
          parsed.matched_employee_name.toLowerCase()
      );
    }
    if (!matchedEmployee && parsed.employee_name) {
      const nl = parsed.employee_name.toLowerCase().replace(/[^a-z\s]/g, "");
      matchedEmployee = employees.find((e) => {
        const fn = e.first_name.toLowerCase();
        const ln = e.last_name.toLowerCase();
        return nl.includes(fn) && nl.includes(ln);
      });
    }
    if (!matchedEmployee && parsed.employee_name) {
      const parts = parsed.employee_name.toLowerCase().split(/\s+/);
      matchedEmployee = employees.find((e) =>
        parts.some((p: string) => p === e.last_name.toLowerCase() && p.length > 2)
      );
    }

    const toNum = (v: any) => typeof v === "number" ? v : parseFloat(String(v ?? "0").replace(/[$,]/g, "")) || 0;

    return {
      employee_name: parsed.employee_name ?? null,
      matched_employee_name: matchedEmployee
        ? `${matchedEmployee.first_name} ${matchedEmployee.last_name}`
        : parsed.matched_employee_name ?? null,
      employee_id: matchedEmployee?.id ?? null,
      pay_period_start: parsed.pay_period_start ?? null,
      pay_period_end: parsed.pay_period_end ?? null,
      pay_date: parsed.pay_date ?? null,
      gross_wages: toNum(parsed.gross_wages),
      federal_tax: toNum(parsed.federal_tax),
      state_tax: toNum(parsed.state_tax),
      social_security: toNum(parsed.social_security),
      medicare: toNum(parsed.medicare),
      garnishments: toNum(parsed.garnishments),
      other_deductions: toNum(parsed.other_deductions),
      net_pay: toNum(parsed.net_pay),
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
    };
  } catch (err: any) {
    return { error: `AI parsing failed: ${err.message}` };
  }
}

// ─── Extract text from a PDF page ────────────────────────────────────────────
function extractTextFromPDFPage(pdfBytes: Uint8Array): string {
  try {
    const decoder = new TextDecoder("latin-1");
    const pdfStr = decoder.decode(pdfBytes);
    const texts: string[] = [];

    const btEtRegex = /BT([\s\S]*?)ET/g;
    let blockMatch: RegExpExecArray | null;
    while ((blockMatch = btEtRegex.exec(pdfStr)) !== null) {
      const block = blockMatch[1];
      const tjRegex = /\(([^)\\]*(?:\\.[^)\\]*)*)\)\s*Tj/g;
      let m: RegExpExecArray | null;
      while ((m = tjRegex.exec(block)) !== null) texts.push(decodePDFString(m[1]));
      const tjArrRegex = /\[([\s\S]*?)\]\s*TJ/g;
      let arrM: RegExpExecArray | null;
      while ((arrM = tjArrRegex.exec(block)) !== null) {
        const strParts = arrM[1].match(/\(([^)\\]*(?:\\.[^)\\]*)*)\)/g) || [];
        strParts.forEach((p) => texts.push(decodePDFString(p.slice(1, -1))));
      }
    }

    if (texts.length === 0) {
      const asciiMatch = pdfStr.match(/[\x20-\x7E]{4,}/g) || [];
      return asciiMatch.filter((s) => /[a-zA-Z]{2,}/.test(s)).join(" ").replace(/\s+/g, " ").trim().substring(0, 4000);
    }
    return texts.join(" ").replace(/\s+/g, " ").trim();
  } catch (err: any) {
    console.error("PDF text extraction failed:", err.message);
    return "";
  }
}

function decodePDFString(raw: string): string {
  return raw
    .replace(/\\n/g, " ").replace(/\\r/g, " ").replace(/\\t/g, " ")
    .replace(/\\(\d{3})/g, (_m, oct) => String.fromCharCode(parseInt(oct, 8)))
    .replace(/\\(.)/g, "$1");
}

// ─── Send result email back to CPA ───────────────────────────────────────────
async function sendResultEmail(
  toEmail: string,
  results: Array<{ page: number; employee?: string; pay_date?: string; gross_wages?: number; net_pay?: number; success: boolean; error?: string }>,
  overrideMessage: string | null,
  supabase: any
): Promise<void> {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey || !toEmail || toEmail === "admin-upload") {
    console.log("Skipping result email (no key or no-reply target)");
    return;
  }

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  const rows = results.map((r) =>
    r.success
      ? `<tr><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">Page ${r.page}</td><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">${r.employee}</td><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">${r.pay_date}</td><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;color:#059669">✅ Stored${r.gross_wages ? ` ($${r.gross_wages})` : ""}</td></tr>`
      : `<tr><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">Page ${r.page}</td><td colspan="2" style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">—</td><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;color:#ef4444">❌ ${r.error}</td></tr>`
  ).join("");

  const html = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
  <div style="background:#0b3ea8;padding:20px 24px;border-radius:8px 8px 0 0;">
    <h2 style="color:#fff;margin:0;font-size:20px;">DML Electrical — Check Stub Processing</h2>
  </div>
  <div style="background:#f9fafb;padding:20px 24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
    ${overrideMessage
      ? `<p style="color:#ef4444;font-weight:bold;">${overrideMessage}</p>`
      : `
    <p style="color:#111;">Your check stubs have been processed and are <strong>pending approval</strong> by Dustin in the Payroll Approval Queue.</p>
    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:6px;padding:14px;margin-bottom:16px;">
      <div style="font-size:22px;font-weight:800;color:${successCount > 0 ? "#059669" : "#6b7280"}">
        ✅ ${successCount} processed &nbsp; ${failCount > 0 ? `<span style="color:#ef4444;">❌ ${failCount} failed</span>` : ""}
      </div>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead>
        <tr style="background:#f3f4f6;">
          <th style="padding:8px 10px;text-align:left;border-bottom:2px solid #e5e7eb;">Page</th>
          <th style="padding:8px 10px;text-align:left;border-bottom:2px solid #e5e7eb;">Employee</th>
          <th style="padding:8px 10px;text-align:left;border-bottom:2px solid #e5e7eb;">Pay Date</th>
          <th style="padding:8px 10px;text-align:left;border-bottom:2px solid #e5e7eb;">Status</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    `}
    <p style="color:#9ca3af;font-size:11px;margin-top:20px;">Processed automatically by TradeFlow · DML Electrical Service, LLC</p>
  </div>
</div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${resendKey}` },
      body: JSON.stringify({
        from: "DML Electrical Service <noreply@dmlelectrical.com>",
        to: [toEmail],
        subject: overrideMessage
          ? "⚠️ Check Stub Processing Error — DML Electrical"
          : `✅ Check Stubs Processed: ${successCount}/${results.length} — DML Electrical`,
        html,
      }),
    });
    if (!res.ok) console.error("Result email failed:", await res.text());
    else console.log("Result email sent to", toEmail);
  } catch (err: any) {
    console.error("sendResultEmail error:", err.message);
  }
}

// ─── Send push notification to employee ──────────────────────────────────────
async function sendPayStubPushNotification(
  supabase: any, employeeId: string, employeeName: string, payDate: string
): Promise<void> {
  if (!employeeId) return;
  const { data: emp } = await supabase.from("employees").select("user_id").eq("id", employeeId).single();
  if (!emp?.user_id) return;
  const { data: tokenRow } = await supabase.from("employee_push_tokens")
    .select("expo_push_token").eq("user_id", emp.user_id)
    .order("created_at", { ascending: false }).limit(1).single();
  if (!tokenRow?.expo_push_token) return;

  const formattedDate = (() => {
    try { return new Date(payDate + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }); }
    catch { return payDate; }
  })();

  await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Accept": "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      to: tokenRow.expo_push_token,
      sound: "default",
      title: "📄 Pay Stub Ready",
      body: `Your pay stub for ${formattedDate} is available. Tap to view.`,
      data: { type: "pay_stub", employee_id: employeeId },
      priority: "high",
    }),
  });
}

// ─── Base64 → Uint8Array ──────────────────────────────────────────────────────
function base64ToUint8Array(base64: string): Uint8Array {
  const clean = base64.replace(/^data:[^;]+;base64,/, "");
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
