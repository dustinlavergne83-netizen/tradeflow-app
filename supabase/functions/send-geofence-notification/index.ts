import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Replace {{name}} and {{fence}} in a message template */
function fillTemplate(template: string, name: string, fence: string): string {
  return template
    .replace(/\{\{name\}\}/g, name || "Someone")
    .replace(/\{\{fence\}\}/g, fence || "a work zone");
}

const DEFAULTS = {
  enter_message_self:   "You've arrived at {{fence}}",
  exit_message_self:    "You've left {{fence}}",
  enter_message_others: "{{name}} arrived at {{fence}}",
  exit_message_others:  "{{name}} left {{fence}}",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const {
      fence_type,
      fence_id,
      fence_name,
      event_type,           // "enter" | "exit"
      employee_name,
      company_id,
      triggering_user_id,   // the employee who crossed the fence
    } = await req.json();

    if (!fence_type || !fence_id || !event_type || !company_id) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const emoji = event_type === "enter" ? "📍" : "🚪";
    const name = employee_name || "Someone";
    const fence = fence_name || "a work zone";

    // ── Load notification settings (for custom messages + extra recipients) ──
    const { data: settings } = await supabase
      .from("geofence_notification_settings")
      .select("*")
      .eq("fence_type", fence_type)
      .eq("fence_id", fence_id)
      .maybeSingle();

    // Pick custom messages or fall back to defaults
    const msgSelf = event_type === "enter"
      ? (settings?.enter_message_self   || DEFAULTS.enter_message_self)
      : (settings?.exit_message_self    || DEFAULTS.exit_message_self);

    const msgOthers = event_type === "enter"
      ? (settings?.enter_message_others || DEFAULTS.enter_message_others)
      : (settings?.exit_message_others  || DEFAULTS.exit_message_others);

    const bodySelf   = fillTemplate(msgSelf,   name, fence);
    const bodyOthers = fillTemplate(msgOthers, name, fence);

    const messages: { to: string; title: string; body: string; userId?: string }[] = [];

    // ── 1. Always notify the person who crossed the fence ──
    if (triggering_user_id) {
      const { data: selfTokens } = await supabase
        .from("employee_push_tokens")
        .select("expo_push_token")
        .eq("user_id", triggering_user_id);

      (selfTokens || []).forEach((r: any) => {
        if (r.expo_push_token) {
          messages.push({
            to: r.expo_push_token,
            title: `${emoji} Geofence`,
            body: bodySelf,
            userId: triggering_user_id,
          });
        }
      });
    }

    // ── 2. Always notify admin(s) of the company ──
    const { data: admins } = await supabase
      .from("employees")
      .select("user_id")
      .eq("company_id", company_id)
      .eq("role", "admin")
      .not("user_id", "is", null);

    const adminUserIds: string[] = (admins || []).map((a: any) => a.user_id);

    if (adminUserIds.length > 0) {
      const { data: adminTokens } = await supabase
        .from("employee_push_tokens")
        .select("expo_push_token, user_id")
        .in("user_id", adminUserIds);

      (adminTokens || []).forEach((r: any) => {
        if (r.user_id === triggering_user_id) return; // already got personal msg
        if (r.expo_push_token) {
          messages.push({
            to: r.expo_push_token,
            title: `${emoji} ${fence}`,
            body: bodyOthers,
            userId: r.user_id,
          });
        }
      });
    }

    // ── 3. Notify additional configured employees ──
    if (settings) {
      const eventEnabled =
        (event_type === "enter" && settings.notify_on_enter) ||
        (event_type === "exit"  && settings.notify_on_exit);

      if (eventEnabled) {
        let extraQ = supabase
          .from("employee_push_tokens")
          .select("expo_push_token, user_id");

        if (!settings.notify_all_employees && settings.notify_employee_ids?.length > 0) {
          extraQ = extraQ.in("user_id", settings.notify_employee_ids);
        } else if (settings.notify_all_employees) {
          const { data: allEmp } = await supabase
            .from("employees")
            .select("user_id")
            .eq("company_id", company_id)
            .not("user_id", "is", null);
          const allIds = (allEmp || []).map((e: any) => e.user_id);
          if (allIds.length > 0) extraQ = extraQ.in("user_id", allIds);
        }

        const { data: extraTokens } = await extraQ;
        const alreadyQueued = new Set(messages.map((m) => m.to));

        (extraTokens || []).forEach((r: any) => {
          if (r.user_id === triggering_user_id) return;
          if (adminUserIds.includes(r.user_id)) return;
          if (!r.expo_push_token || alreadyQueued.has(r.expo_push_token)) return;

          messages.push({
            to: r.expo_push_token,
            title: `${emoji} ${fence}`,
            body: bodyOthers,
            userId: r.user_id,
          });
        });
      }
    }

    if (messages.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: "No push tokens to notify" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 4. Send via Expo Push API (batch max 100) ──
    const fullMessages = messages.map(({ userId: _uid, ...m }) => ({
      ...m,
      sound: "default",
      priority: "high",
      data: { fence_type, fence_id, event_type, fence_name },
    }));

    const chunkSize = 100;
    let totalSent = 0;

    for (let i = 0; i < fullMessages.length; i += chunkSize) {
      const chunk = fullMessages.slice(i, i + chunkSize);
      const res = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Accept-Encoding": "gzip, deflate",
        },
        body: JSON.stringify(chunk),
      });

      if (res.ok) totalSent += chunk.length;
      else console.error("Expo push error:", await res.text());
    }

    return new Response(JSON.stringify({ sent: totalSent, total_recipients: messages.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-geofence-notification error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
