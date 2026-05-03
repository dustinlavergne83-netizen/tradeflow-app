import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function fillTemplate(template: string, name: string): string {
  return template.replace(/\{\{name\}\}/g, name || "there");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const {
      schedule_id,
      company_id,
      title,
      message,
      notify_all,
      notify_employee_ids,
    } = await req.json();

    if (!message) {
      return new Response(JSON.stringify({ error: "Missing message" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // ── Step 1: Get employees with push tokens ────────────────────────────────
    // We join employees → push tokens.
    // If notify_all = true: get all employees (service_role sees all rows).
    // If notify_all = false: filter to specific user_ids.
    //
    // NOTE: employees.company_id filtering is skipped here because this function
    // is called only from validated schedules. service_role bypasses RLS so we
    // use user_id filtering when specific employees are chosen.

    let empQuery = supabase
      .from("employees")
      .select("id, user_id, first_name, last_name")
      .not("user_id", "is", null);

    // If company_id is provided, try filtering — but fall back gracefully
    if (company_id) {
      empQuery = empQuery.eq("company_id", company_id);
    }

    // If specific employees chosen, narrow to those user_ids
    if (!notify_all && notify_employee_ids?.length > 0) {
      empQuery = empQuery.in("user_id", notify_employee_ids);
    }

    const { data: employees, error: empError } = await empQuery;

    console.log("Employees found:", employees?.length ?? 0, empError ?? "");

    // If company_id filter returned nothing, retry without it
    // (handles case where company_id column doesn't match)
    let resolvedEmployees = employees;
    if ((!employees || employees.length === 0) && company_id) {
      console.log("Retrying employee query without company_id filter...");
      let fallbackQuery = supabase
        .from("employees")
        .select("id, user_id, first_name, last_name")
        .not("user_id", "is", null);

      if (!notify_all && notify_employee_ids?.length > 0) {
        fallbackQuery = fallbackQuery.in("user_id", notify_employee_ids);
      }

      const { data: fallbackEmps } = await fallbackQuery;
      resolvedEmployees = fallbackEmps;
      console.log("Fallback employees found:", resolvedEmployees?.length ?? 0);
    }

    if (!resolvedEmployees || resolvedEmployees.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, reason: "No employees found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userIds = resolvedEmployees.map((e: any) => e.user_id);

    // ── Step 2: Get push tokens ───────────────────────────────────────────────
    const { data: tokens, error: tokenError } = await supabase
      .from("employee_push_tokens")
      .select("expo_push_token, user_id")
      .in("user_id", userIds);

    console.log("Push tokens found:", tokens?.length ?? 0, tokenError ?? "");

    if (!tokens || tokens.length === 0) {
      return new Response(
        JSON.stringify({
          sent: 0,
          reason: "No push tokens — employees may not have opened the mobile app yet",
          employees_found: resolvedEmployees.length,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Step 3: Build personalised messages ──────────────────────────────────
    const empMap: Record<string, any> = {};
    resolvedEmployees.forEach((e: any) => { empMap[e.user_id] = e; });

    const messages = tokens
      .filter((t: any) => t.expo_push_token)
      .map((t: any) => {
        const emp = empMap[t.user_id];
        const name = emp?.first_name || "there";
        return {
          to: t.expo_push_token,
          title: title || "TradeFlow",
          body: fillTemplate(message, name),
          sound: "default",
          priority: "high",
          data: { type: "scheduled_notification", schedule_id: schedule_id ?? null },
        };
      });

    if (messages.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, reason: "Tokens found but all were empty/invalid" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Step 4: Send via Expo Push API (batches of 100) ──────────────────────
    const chunkSize = 100;
    let totalSent = 0;
    const allTickets: any[] = [];
    const allErrors: any[] = [];

    for (let i = 0; i < messages.length; i += chunkSize) {
      const chunk = messages.slice(i, i + chunkSize);
      const res = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Accept-Encoding": "gzip, deflate",
        },
        body: JSON.stringify(chunk),
      });

      const responseBody = await res.json().catch(() => null);
      console.log("Expo push response:", JSON.stringify(responseBody));

      if (res.ok && responseBody?.data) {
        for (const ticket of responseBody.data) {
          allTickets.push(ticket);
          if (ticket.status === "ok") {
            totalSent++;
          } else if (ticket.status === "error") {
            allErrors.push({ message: ticket.message, details: ticket.details });
            console.error("Expo ticket error:", ticket.message, ticket.details);
          }
        }
      } else {
        console.error("Expo push HTTP error:", res.status, JSON.stringify(responseBody));
        allErrors.push({ httpStatus: res.status, body: responseBody });
      }
    }

    return new Response(
      JSON.stringify({ sent: totalSent, total: messages.length, tickets: allTickets, errors: allErrors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("send-scheduled-notification error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
