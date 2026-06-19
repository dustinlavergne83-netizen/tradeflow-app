/**
 * smartvault-upload — Universal pay stub webhook
 *
 * Accepts PDF pay stubs from:
 *  • Zapier SmartVault integration (new file → POST webhook)
 *  • Make (Integromat) SmartVault scenario
 *  • SmartVault direct API poller
 *  • Manual upload from the TradeFlow UI
 *
 * POST body (JSON):
 *  { filename, contentBase64, contentType, from, subject }   ← direct upload
 *  { file_name, file_content, uploaded_by }                  ← Zapier format
 *  { name, content, url }                                    ← Make format
 *  { file_url }                                              ← download from URL
 *
 * Security: Set SMARTVAULT_WEBHOOK_SECRET in Supabase secrets.
 *   Send it as x-api-key header.  If not set, the endpoint accepts all requests
 *   (useful for testing; set the secret before going live).
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-api-key, content-type, apikey",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Security: validate API key if secret is configured ───────────────
    const expectedSecret = Deno.env.get("SMARTVAULT_WEBHOOK_SECRET");
    if (expectedSecret) {
      const provided =
        req.headers.get("x-api-key") ||
        req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
      if (provided !== expectedSecret) {
        return new Response(JSON.stringify({ error: "Unauthorized — invalid x-api-key" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    let body: Record<string, string> = {};
    const ct = req.headers.get("content-type") || "";

    if (ct.includes("application/json")) {
      body = await req.json();
    } else if (ct.includes("multipart/form-data")) {
      // Support direct file upload (HTML form)
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (file) {
        const bytes = await file.arrayBuffer();
        body.contentBase64 = btoa(
          String.fromCharCode(...new Uint8Array(bytes))
        );
        body.filename     = file.name;
        body.contentType  = file.type || "application/pdf";
      }
      body.from    = (formData.get("from")    as string) || "";
      body.subject = (formData.get("subject") as string) || "";
    } else {
      body = await req.json().catch(() => ({}));
    }

    // ── Normalise field names across different sender formats ────────────
    // Zapier sends: file_name, file_content (base64 or data-url), uploaded_by
    // Make sends:   name, content or url
    // TradeFlow UI: filename, contentBase64, contentType, from, subject
    const filename =
      body.filename || body.file_name || body.name || "paystub.pdf";
    const from =
      body.from || body.uploaded_by || body.uploader || "smartvault@cpa";
    const subject =
      body.subject ||
      body.description ||
      `Pay Stub from SmartVault: ${filename}`;
    const contentType = body.contentType || body.mime_type || "application/pdf";

    let contentBase64 = body.contentBase64 || body.file_content || body.content || "";

    // Strip data-url prefix if present (e.g. "data:application/pdf;base64,...")
    if (contentBase64.includes(",")) {
      contentBase64 = contentBase64.split(",")[1];
    }

    // If no base64 content, try downloading from a URL
    if (!contentBase64) {
      const fileUrl = body.file_url || body.url || body.download_url || body.link;
      if (fileUrl) {
        console.log("Downloading file from URL:", fileUrl);
        const res = await fetch(fileUrl);
        if (!res.ok) throw new Error(`Failed to fetch file (${res.status})`);
        const bytes = await res.arrayBuffer();
        contentBase64 = btoa(String.fromCharCode(...new Uint8Array(bytes)));
      }
    }

    if (!contentBase64) {
      return new Response(
        JSON.stringify({
          error:
            "No file content provided. Send contentBase64, file_content, or file_url.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ── Forward to the AI processing function ────────────────────────────
    const supabaseUrl  = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    const processRes = await fetch(
      `${supabaseUrl}/functions/v1/process-check-stub-email`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
        },
        body: JSON.stringify({
          source: body.source || "smartvault",
          filename,
          contentBase64,
          contentType,
          from,
          subject,
        }),
      }
    );

    const result = await processRes.json();
    const success = processRes.ok;

    return new Response(
      JSON.stringify({
        success,
        message: success
          ? `✅ "${filename}" received and queued for payroll approval.`
          : result.error || "Processing failed",
        filename,
        processed: result.processed,
        employees: result.employees,
      }),
      {
        status: success ? 200 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("smartvault-upload error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
