/**
 * check-new-emails — Supabase Edge Function
 * Called every minute by pg_cron.
 * For each row in email_push_subscriptions:
 *   1. Refresh the Microsoft access token
 *   2. Fetch the latest email from Graph API
 *   3. If it's newer than last_email_id → send Expo push notification
 *   4. Update last_email_id + new refresh token in DB
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TENANT       = "9bd3d089-ecc6-4777-9198-41f0d40f95d6";
const CLIENT_ID    = "1101ddc0-5dc1-4275-beb6-34b2ef897452";
const TOKEN_URL    = `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`;
const GRAPH_URL    = "https://graph.microsoft.com/v1.0/me/messages?$top=3&$orderby=receivedDateTime desc&$select=id,subject,from,receivedDateTime,isRead";
const EXPO_PUSH    = "https://exp.host/--/api/v2/push/send";
const MS_SCOPES    = "openid offline_access Mail.Read Mail.ReadBasic Mail.Send";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Load all subscriptions
    const { data: subs, error: subErr } = await supabase
      .from("email_push_subscriptions")
      .select("*");

    if (subErr) throw subErr;
    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ checked: 0 }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    let notified = 0;

    for (const sub of subs) {
      try {
        // 1. Refresh MS access token
        const tokenRes = await fetch(TOKEN_URL, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id:     CLIENT_ID,
            grant_type:    "refresh_token",
            refresh_token: sub.ms_refresh_token,
            scope:         MS_SCOPES,
          }).toString(),
        });
        const tokenData = await tokenRes.json();

        if (!tokenData.access_token) {
          console.error(`Token refresh failed for user ${sub.user_id}:`, tokenData.error);
          continue;
        }

        // 2. Fetch latest emails
        const graphRes = await fetch(GRAPH_URL, {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        const graphData = await graphRes.json();
        const emails: any[] = graphData.value || [];

        if (emails.length === 0) continue;

        const latestEmail = emails[0];

        // 3. Check if it's new (different from last seen ID)
        if (latestEmail.id !== sub.last_email_id) {
          // Find all emails newer than last seen
          const newEmails = sub.last_email_id
            ? emails.filter(e => e.id !== sub.last_email_id)
            : [latestEmail]; // First time — notify only about the single latest

          for (const email of newEmails) {
            // Skip emails already read (they're probably old)
            if (email.isRead && sub.last_email_id) continue;

            const sender =
              email.from?.emailAddress?.name ||
              email.from?.emailAddress?.address ||
              "Someone";
            const subject = email.subject || "(no subject)";

            // Send Expo push notification
            await fetch(EXPO_PUSH, {
              method: "POST",
              headers: {
                Accept: "application/json",
                "Accept-Encoding": "gzip, deflate",
                "Content-Type": "application/json",
              },
              body: JSON.stringify([{
                to:       sub.expo_push_token,
                sound:    "default",
                title:    `📧 New Email from ${sender}`,
                body:     subject,
                data:     { screen: "email", emailId: email.id },
                priority: "high",
                ttl:      3600,
              }]),
            });

            notified++;
          }

          // 4. Update DB: new last_email_id + refreshed tokens
          await supabase
            .from("email_push_subscriptions")
            .update({
              last_email_id:    latestEmail.id,
              ms_refresh_token: tokenData.refresh_token || sub.ms_refresh_token,
              last_checked_at:  new Date().toISOString(),
              updated_at:       new Date().toISOString(),
            })
            .eq("id", sub.id);
        } else {
          // No new email — just update the refresh token if it rotated
          if (tokenData.refresh_token && tokenData.refresh_token !== sub.ms_refresh_token) {
            await supabase
              .from("email_push_subscriptions")
              .update({
                ms_refresh_token: tokenData.refresh_token,
                last_checked_at:  new Date().toISOString(),
                updated_at:       new Date().toISOString(),
              })
              .eq("id", sub.id);
          }
        }
      } catch (err) {
        console.error(`Error processing sub ${sub.id}:`, err);
      }
    }

    return new Response(
      JSON.stringify({ success: true, checked: subs.length, notified }),
      { headers: { ...CORS, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("check-new-emails error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});
