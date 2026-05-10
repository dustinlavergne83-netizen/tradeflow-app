// send-ai-reminders
// Cron job: runs every minute, checks ai_reminders for due entries,
// sends SMS via AT&T email-to-SMS gateway (free, uses Resend API)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  // Allow OPTIONS for browser calls (not needed for cron but harmless)
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const resendKey  = Deno.env.get("RESEND_API_KEY") ?? "";
    const fromEmail  = Deno.env.get("RESEND_FROM_EMAIL") ?? "";

    if (!resendKey || !fromEmail) {
      console.error("Missing RESEND_API_KEY or RESEND_FROM_EMAIL secrets");
      return new Response(JSON.stringify({ error: "Missing Resend config" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // ── Find due, unprocessed reminders ─────────────────────────────────────
    const { data: reminders, error: fetchErr } = await supabase
      .from("ai_reminders")
      .select("id, user_id, message, remind_at")
      .eq("is_done", false)
      .lte("remind_at", new Date().toISOString())
      .limit(50);

    if (fetchErr) throw fetchErr;

    if (!reminders?.length) {
      console.log("No due reminders found");
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${reminders.length} due reminder(s)`);
    let sent = 0;
    let skipped = 0;

    for (const reminder of reminders) {
      // Mark done immediately so it doesn't re-fire if something errors below
      await supabase
        .from("ai_reminders")
        .update({ is_done: true })
        .eq("id", reminder.id);

      // Look up employee phone
      const { data: emp } = await supabase
        .from("employees")
        .select("phone, first_name")
        .eq("user_id", reminder.user_id)
        .maybeSingle();

      if (!emp?.phone) {
        console.log(`No phone for user ${reminder.user_id} — skipping SMS`);
        skipped++;
        continue;
      }

      // Strip to 10 digits (handles +1-318-555-1234, (318)555-1234, etc.)
      const digits = emp.phone.replace(/\D/g, "");
      const ten = digits.length === 11 && digits.startsWith("1")
        ? digits.slice(1)   // remove leading country code 1
        : digits.slice(-10);

      if (ten.length !== 10) {
        console.log(`Invalid phone "${emp.phone}" → skipping SMS`);
        skipped++;
        continue;
      }

      const toGateway = `${ten}@txt.att.net`;

      // Keep SMS body short (AT&T gateway: 160 char limit)
      const name = emp.first_name ? `${emp.first_name}, ` : "";
      const body = `🔔 ${name}reminder: ${reminder.message}`.slice(0, 155);

      console.log(`Sending SMS to ${toGateway}: "${body}"`);

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [toGateway],
          subject: "Reminder",   // AT&T may prepend subject — keep it minimal
          text: body,
        }),
      });

      const result = await res.json().catch(() => ({}));

      if (res.ok) {
        console.log(`✅ SMS sent to ${toGateway}`);
        sent++;
      } else {
        console.error(`❌ Resend error for ${toGateway}:`, result);
        skipped++;
      }
    }

    return new Response(
      JSON.stringify({ processed: reminders.length, sent, skipped }),
      { headers: { "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("send-ai-reminders fatal error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
