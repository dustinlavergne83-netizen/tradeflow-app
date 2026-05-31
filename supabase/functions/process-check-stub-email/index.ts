// Process Check Stub Email — Resend Inbound Webhook
// Receives combined PDF from CPA, splits by page, uses GPT-4o to identify each employee,
// stores each page as a separate PDF in Supabase Storage + records in check_stubs table.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    // ── 1. Parse Resend webhook (JSON body) ────────────────────────────────
    // Resend delivers inbound emails as webhook events:
    // { type: "email.received", data: { from, to, subject, text, html, attachments } }
    // We also handle the legacy flat format just in case.
    const body = await req.json();

    // Filter: only process email.received events (not sent/bounced/etc.)
    const eventType: string = body.type ?? "";
    if (eventType && eventType !== "email.received") {
      console.log("Ignoring non-inbound event:", eventType);
      return new Response(JSON.stringify({ ignored: true, type: eventType }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Support both wrapped { type, data: {...} } and flat { from, subject, ... }
    const emailData = (body.data && typeof body.data === "object") ? body.data : body;

    const from: string = emailData.from ?? "";
    const subject: string = emailData.subject ?? "";
    const textBody: string = emailData.text ?? emailData.html ?? "";

    // Filter: only process emails to paystubs@dmlelectrical.com
    const toAddresses: string[] = Array.isArray(emailData.to)
      ? emailData.to
      : typeof emailData.to === "string"
        ? [emailData.to]
        : [];
    const isPaystubs = toAddresses.some(
      (addr: string) => addr.toLowerCase().includes("paystubs@dmlelectrical.com")
    );
    if (!isPaystubs && toAddresses.length > 0) {
      console.log("Ignoring email not addressed to paystubs@dmlelectrical.com. To:", toAddresses);
      return new Response(JSON.stringify({ ignored: true, to: toAddresses }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Inbound email from:", from, "To:", toAddresses, "Subject:", subject);

    // ── 2. Find PDF attachment ─────────────────────────────────────────────
    const attachments: Array<{ filename: string; content: string; contentType: string }> =
      emailData.attachments ?? [];

    const pdfAttachment = attachments.find(
      (a) => a.contentType?.includes("pdf") || a.filename?.toLowerCase().endsWith(".pdf")
    );

    if (!pdfAttachment) {
      console.error("No PDF attachment found in email");
      await sendResultEmail(from, [], "No PDF attachment found in the email.", supabase);
      return new Response(JSON.stringify({ error: "No PDF attachment found" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Found PDF attachment:", pdfAttachment.filename, "size:", pdfAttachment.content?.length);

    // ── 3. Decode base64 PDF ───────────────────────────────────────────────
    const pdfBase64 = pdfAttachment.content;
    const pdfBytes = base64ToUint8Array(pdfBase64);

    // ── 4. Get employee list ───────────────────────────────────────────────
    const { data: employees, error: empError } = await supabase
      .from("employees")
      .select("id, first_name, last_name")
      .or("archived.is.null,archived.eq.false")
      .order("last_name");

    if (empError) throw empError;
    console.log("Loaded", employees?.length ?? 0, "employees");

    // ── 5. Load pdf-lib and split into individual pages ────────────────────
    const { PDFDocument } = await import("https://cdn.skypack.dev/pdf-lib@1.17.1");
    const fullPdf = await PDFDocument.load(pdfBytes);
    const totalPages = fullPdf.getPageCount();
    console.log("PDF has", totalPages, "pages");

    // ── 6. Process each page ───────────────────────────────────────────────
    const results: Array<{
      page: number;
      employee?: string;
      employee_id?: string;
      pay_date?: string;
      success: boolean;
      error?: string;
    }> = [];

    for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
      console.log(`\n--- Processing page ${pageIndex + 1} of ${totalPages} ---`);
      try {
        // Extract single page PDF bytes
        const singlePdf = await PDFDocument.create();
        const [copiedPage] = await singlePdf.copyPages(fullPdf, [pageIndex]);
        singlePdf.addPage(copiedPage);
        const pageBytes = await singlePdf.save();

        // Extract text from page using pdfjs-dist
        const pageText = await extractTextFromPDFPage(pageBytes);
        console.log("Extracted text (first 200 chars):", pageText.substring(0, 200));

        // Ask GPT-4o to identify the employee from the text
        const aiResult = await identifyEmployeeWithAI(pageText, employees ?? [], pageIndex + 1);
        console.log("AI result:", JSON.stringify(aiResult));

        if (!aiResult.employee_id) {
          results.push({
            page: pageIndex + 1,
            success: false,
            error: aiResult.error ?? `Could not identify employee on page ${pageIndex + 1} (AI: "${aiResult.employee_name ?? "?"}")`,
          });
          continue;
        }

        const emp = (employees ?? []).find((e) => e.id === aiResult.employee_id);
        const empName = emp ? `${emp.first_name} ${emp.last_name}` : aiResult.matched_employee_name;

        // Build file path
        const payDate = aiResult.pay_date ?? aiResult.pay_period_end ?? new Date().toISOString().split("T")[0];
        const safeName = empName?.replace(/\s+/g, "_") ?? "Unknown";
        const filePath = `${aiResult.employee_id}/${safeName}_${payDate}.pdf`;

        // Upload to check-stubs bucket
        const { error: uploadError } = await supabase.storage
          .from("check-stubs")
          .upload(filePath, pageBytes, {
            contentType: "application/pdf",
            upsert: true,
          });

        if (uploadError) throw new Error("Upload failed: " + uploadError.message);

        // Insert database record
        const { error: dbError } = await supabase.from("check_stubs").insert({
          employee_id: aiResult.employee_id,
          pay_period_start: aiResult.pay_period_start ?? null,
          pay_period_end: aiResult.pay_period_end ?? null,
          pay_date: payDate,
          file_path: filePath,
          file_name: `${safeName}_${payDate}.pdf`,
          uploaded_by: null,
          ai_confidence: aiResult.confidence ?? 0,
          ai_raw_name: aiResult.employee_name ?? null,
        });

        // Ignore duplicate key (already uploaded this period)
        if (dbError && dbError.code !== "23505") throw new Error("DB insert failed: " + dbError.message);

        results.push({
          page: pageIndex + 1,
          employee: empName ?? undefined,
          employee_id: aiResult.employee_id,
          pay_date: payDate,
          success: true,
        });

      } catch (err: any) {
        console.error(`Page ${pageIndex + 1} failed:`, err.message);
        results.push({ page: pageIndex + 1, success: false, error: err.message });
      }
    }

    // ── 7. Send summary email back to CPA ─────────────────────────────────
    await sendResultEmail(from, results, null, supabase);

    const successCount = results.filter((r) => r.success).length;
    console.log(`\nDone: ${successCount}/${totalPages} pages processed successfully`);

    return new Response(
      JSON.stringify({ success: true, total: totalPages, processed: successCount, results }),
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

// ─── Extract text from a PDF page using pure-JS PDF stream parsing ──────────
// Works in Deno without any native modules (no canvas, no pdfjs-dist).
// Parses PDF content streams and extracts text from Tj / TJ operators.
function extractTextFromPDFPage(pdfBytes: Uint8Array): string {
  try {
    // Decode bytes as latin-1 (preserves all byte values)
    const decoder = new TextDecoder("latin-1");
    const pdfStr = decoder.decode(pdfBytes);

    const texts: string[] = [];

    // ── Decompress flate streams if present ──────────────────────────────
    // For now, work on raw PDF text (many payroll PDFs use uncompressed text)
    // Find all text blocks between BT...ET
    const btEtRegex = /BT([\s\S]*?)ET/g;
    let blockMatch: RegExpExecArray | null;

    while ((blockMatch = btEtRegex.exec(pdfStr)) !== null) {
      const block = blockMatch[1];

      // (text)Tj — single string show
      const tjRegex = /\(([^)\\]*(?:\\.[^)\\]*)*)\)\s*Tj/g;
      let m: RegExpExecArray | null;
      while ((m = tjRegex.exec(block)) !== null) {
        texts.push(decodePDFString(m[1]));
      }

      // [(text) num (text)]TJ — array string show
      const tjArrRegex = /\[([\s\S]*?)\]\s*TJ/g;
      let arrM: RegExpExecArray | null;
      while ((arrM = tjArrRegex.exec(block)) !== null) {
        const innerStr = arrM[1];
        const strParts = innerStr.match(/\(([^)\\]*(?:\\.[^)\\]*)*)\)/g) || [];
        strParts.forEach((p) => texts.push(decodePDFString(p.slice(1, -1))));
      }
    }

    // Also grab any readable ASCII text from the raw stream (catches unencoded text)
    if (texts.length === 0) {
      const asciiMatch = pdfStr.match(/[\x20-\x7E]{4,}/g) || [];
      const readable = asciiMatch
        .filter((s) => /[a-zA-Z]{2,}/.test(s))
        .join(" ");
      return readable.replace(/\s+/g, " ").trim().substring(0, 4000);
    }

    return texts.join(" ").replace(/\s+/g, " ").trim();
  } catch (err: any) {
    console.error("PDF text extraction failed:", err.message);
    return "";
  }
}

function decodePDFString(raw: string): string {
  return raw
    .replace(/\\n/g, " ")
    .replace(/\\r/g, " ")
    .replace(/\\t/g, " ")
    .replace(/\\(\d{3})/g, (_m, oct) => String.fromCharCode(parseInt(oct, 8)))
    .replace(/\\(.)/g, "$1");
}

// ─── Ask GPT-4o to identify the employee from extracted text ─────────────────
async function identifyEmployeeWithAI(
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
${pageText.substring(0, 3000)}

Return ONLY valid JSON (no markdown, no code block):
{
  "employee_name": "exact name as shown on the stub",
  "matched_employee_name": "closest match from KNOWN EMPLOYEES list, or null",
  "pay_period_start": "YYYY-MM-DD or null",
  "pay_period_end": "YYYY-MM-DD or null", 
  "pay_date": "YYYY-MM-DD or null",
  "confidence": 0.95
}

Rules:
- matched_employee_name MUST be exactly one name from the KNOWN EMPLOYEES list, or null
- Convert any date format to YYYY-MM-DD
- pay_date is the check date / date paid
- confidence is 0.0-1.0 based on how certain you are of the match`;

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
        max_tokens: 512,
        temperature: 0,
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      return { error: `OpenAI API error: ${err}` };
    }

    const data = await resp.json();
    const rawText = data.choices?.[0]?.message?.content ?? "";
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { error: `Could not parse AI response: ${rawText}` };

    const parsed = JSON.parse(jsonMatch[0]);

    // Match to employee ID
    let matchedEmployee: typeof employees[0] | undefined;

    if (parsed.matched_employee_name) {
      matchedEmployee = employees.find(
        (e) =>
          `${e.first_name} ${e.last_name}`.toLowerCase() ===
          parsed.matched_employee_name.toLowerCase()
      );
    }

    // Fallback: fuzzy match on employee_name
    if (!matchedEmployee && parsed.employee_name) {
      const nl = parsed.employee_name.toLowerCase().replace(/[^a-z\s]/g, "");
      matchedEmployee = employees.find((e) => {
        const fn = e.first_name.toLowerCase();
        const ln = e.last_name.toLowerCase();
        return nl.includes(fn) && nl.includes(ln);
      });
    }

    // Last-name-only fallback
    if (!matchedEmployee && parsed.employee_name) {
      const parts = parsed.employee_name.toLowerCase().split(/\s+/);
      matchedEmployee = employees.find((e) =>
        parts.some((p: string) => p === e.last_name.toLowerCase() && p.length > 2)
      );
    }

    return {
      employee_name: parsed.employee_name ?? null,
      matched_employee_name: matchedEmployee
        ? `${matchedEmployee.first_name} ${matchedEmployee.last_name}`
        : parsed.matched_employee_name ?? null,
      employee_id: matchedEmployee?.id ?? null,
      pay_period_start: parsed.pay_period_start ?? null,
      pay_period_end: parsed.pay_period_end ?? null,
      pay_date: parsed.pay_date ?? null,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
    };
  } catch (err: any) {
    return { error: `AI parsing failed: ${err.message}` };
  }
}

// ─── Send result email back to CPA ────────────────────────────────────────────
async function sendResultEmail(
  toEmail: string,
  results: Array<{ page: number; employee?: string; pay_date?: string; success: boolean; error?: string }>,
  overrideMessage: string | null,
  supabase: any
): Promise<void> {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) { console.log("RESEND_API_KEY not set — skipping result email"); return; }

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  const rows = results.map((r) =>
    r.success
      ? `<tr><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">Page ${r.page}</td><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">${r.employee}</td><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;color:#059669">✅ Stored (${r.pay_date})</td></tr>`
      : `<tr><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">Page ${r.page}</td><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">—</td><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;color:#ef4444">❌ ${r.error}</td></tr>`
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
    <p style="color:#111;">Your check stubs have been processed and stored.</p>
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

// ─── Base64 → Uint8Array ──────────────────────────────────────────────────────
function base64ToUint8Array(base64: string): Uint8Array {
  // Remove data URI prefix if present
  const clean = base64.replace(/^data:[^;]+;base64,/, "");
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
