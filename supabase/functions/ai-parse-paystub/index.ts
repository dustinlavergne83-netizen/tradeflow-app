// AI Paystub Parser - Supabase Edge Function
// Uses OpenAI GPT-4o Vision to extract employee name and pay period data from paystub PDFs

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import OpenAI from "https://esm.sh/openai@4.20.1";

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
    const { pageImageBase64, employees } = await req.json();

    if (!pageImageBase64) {
      return new Response(
        JSON.stringify({ error: "Missing page image (pageImageBase64)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      throw new Error("OPENAI_API_KEY is not configured in Supabase secrets");
    }

    const openai = new OpenAI({ apiKey: openaiKey });

    const employeeList = employees?.length
      ? employees.map((e: any) => `${e.first_name} ${e.last_name}`).join(", ")
      : "No employee list provided";

    console.log(`Analyzing paystub for ${employees?.length ?? 0} employees`);

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${pageImageBase64}`,
                detail: "high",
              },
            },
            {
              type: "text",
              text: `This is a paycheck stub or paystub document. Extract the following information.

Known employees in our system: ${employeeList}

Return ONLY valid JSON (no markdown, no code block, just raw JSON):
{
  "employee_name": "exact name as shown on stub",
  "matched_employee_name": "closest matching name from the known employees list above, or null if none match",
  "pay_period_start": "YYYY-MM-DD or null",
  "pay_period_end": "YYYY-MM-DD or null",
  "pay_date": "YYYY-MM-DD or null",
  "confidence": 0.95
}

Rules:
- employee_name: the exact name as printed on the stub (e.g. "JOHN A SMITH" or "Smith, John")
- matched_employee_name: must be an exact name from the known employees list, or null. Match by first+last name.
- Dates: convert any format (01/15/2026, Jan 15 2026, 1/15/26, etc.) to YYYY-MM-DD
- pay_period_start / pay_period_end: the pay period range (often labeled "Pay Period" or "Period Covered")
- pay_date: the actual check/payment date (often labeled "Check Date", "Pay Date", "Date Paid")
- confidence: a 0.0–1.0 float representing how confident you are in the employee identification`,
            },
          ],
        },
      ],
      max_tokens: 512,
    });

    const text = response.choices[0].message.content || "";
    console.log("AI raw response:", text);

    // Extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error(`Could not extract JSON from AI response: ${text}`);
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Find the best-matching employee from the list
    let matchedEmployee: any = null;

    if (employees && employees.length > 0) {
      // 1) Try exact match on matched_employee_name
      if (parsed.matched_employee_name) {
        matchedEmployee = employees.find(
          (e: any) =>
            `${e.first_name} ${e.last_name}`.toLowerCase() ===
            parsed.matched_employee_name.toLowerCase()
        );
      }

      // 2) Try matching against employee_name (first + last both present)
      if (!matchedEmployee && parsed.employee_name) {
        const nl = parsed.employee_name.toLowerCase().replace(/[^a-z\s]/g, "");
        matchedEmployee = employees.find((e: any) => {
          const fn = e.first_name.toLowerCase();
          const ln = e.last_name.toLowerCase();
          return nl.includes(fn) && nl.includes(ln);
        });
      }

      // 3) Last-name-only fallback
      if (!matchedEmployee && parsed.employee_name) {
        const parts = parsed.employee_name.toLowerCase().split(/\s+/);
        matchedEmployee = employees.find((e: any) =>
          parts.some((p: string) => p === e.last_name.toLowerCase() && p.length > 2)
        );
      }
    }

    const result = {
      success: true,
      employee_name: parsed.employee_name ?? null,
      employee_id: matchedEmployee?.id ?? null,
      matched_employee_name: matchedEmployee
        ? `${matchedEmployee.first_name} ${matchedEmployee.last_name}`
        : parsed.matched_employee_name ?? null,
      pay_period_start: parsed.pay_period_start ?? null,
      pay_period_end: parsed.pay_period_end ?? null,
      pay_date: parsed.pay_date ?? null,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
    };

    console.log("Matched result:", result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("ai-parse-paystub error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
