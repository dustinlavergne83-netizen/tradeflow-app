// Supabase Edge Function to split a combined PDF into individual employee check stubs
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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

    const formData = await req.formData();
    const pdfFile = formData.get("pdf_file") as File;
    const payPeriodStart = formData.get("pay_period_start") as string;
    const payPeriodEnd = formData.get("pay_period_end") as string;
    const payDate = formData.get("pay_date") as string;
    const employeeMappingsJson = formData.get("employee_mappings") as string;
    const uploadedBy = formData.get("uploaded_by") as string;

    if (!pdfFile || !payPeriodStart || !payPeriodEnd || !payDate || !employeeMappingsJson) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse employee mappings: [{ employee_id, page_start, page_end, employee_name }]
    const employeeMappings = JSON.parse(employeeMappingsJson);

    // Read PDF file as array buffer
    const pdfBytes = await pdfFile.arrayBuffer();
    const uint8Array = new Uint8Array(pdfBytes);

    // Import PDF library
    const { PDFDocument } = await import("https://cdn.skypack.dev/pdf-lib@1.17.1");
    const pdfDoc = await PDFDocument.load(uint8Array);
    const totalPages = pdfDoc.getPageCount();

    const results = [];

    // Split PDF for each employee
    for (const mapping of employeeMappings) {
      try {
        const { employee_id, page_start, page_end, employee_name } = mapping;

        // Validate page range
        if (page_start < 1 || page_end > totalPages || page_start > page_end) {
          results.push({
            employee_id,
            employee_name,
            success: false,
            error: `Invalid page range: ${page_start}-${page_end} (PDF has ${totalPages} pages)`,
          });
          continue;
        }

        // Create new PDF with specified pages
        const newPdf = await PDFDocument.create();
        const pageIndices = [];
        for (let i = page_start - 1; i < page_end; i++) {
          pageIndices.push(i);
        }
        const copiedPages = await newPdf.copyPages(pdfDoc, pageIndices);
        copiedPages.forEach((page) => newPdf.addPage(page));

        // Save new PDF
        const newPdfBytes = await newPdf.save();

        // Upload to storage
        const fileName = `${employee_id}_${payPeriodEnd}.pdf`;
        const filePath = `check-stubs/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("check-stubs")
          .upload(filePath, newPdfBytes, {
            contentType: "application/pdf",
            upsert: true,
          });

        if (uploadError) throw uploadError;

        // Insert record into database
        const { error: dbError } = await supabase.from("check_stubs").insert({
          employee_id,
          pay_period_start: payPeriodStart,
          pay_period_end: payPeriodEnd,
          pay_date: payDate,
          file_path: filePath,
          file_name: `${employee_name}_${payPeriodEnd}.pdf`,
          uploaded_by: uploadedBy,
        });

        if (dbError) throw dbError;

        results.push({
          employee_id,
          employee_name,
          success: true,
          file_path: filePath,
        });
      } catch (err) {
        results.push({
          employee_id: mapping.employee_id,
          employee_name: mapping.employee_name,
          success: false,
          error: err.message,
        });
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("PDF Split Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
