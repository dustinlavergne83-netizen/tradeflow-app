// Send Push Notification - Edge Function
// Called by pg_cron every minute to check for due reminders and send Expo push notifications
// Can also be called directly to send an immediate push

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    // Use service role for full access
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {}
    
    // Mode 1: Direct push (called with specific token + message)
    if (body.pushToken && body.title && body.body) {
      const result = await sendExpoPush([{
        to: body.pushToken,
        sound: 'default',
        title: body.title,
        body: body.body,
        data: body.data || {},
      }])
      return new Response(JSON.stringify({ success: true, result }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      })
    }

    // Mode 2: Check for due reminders (pg_cron mode)
    const now = new Date().toISOString()

    const { data: dueReminders, error: queryError } = await supabase
      .from('ai_reminders')
      .select('*')
      .lte('remind_at', now)
      .eq('push_sent', false)
      .eq('is_done', false)
      .not('push_token', 'is', null)
      .limit(50)

    if (queryError) {
      console.error('Query error:', queryError)
      return new Response(JSON.stringify({ error: queryError.message }), {
        status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      })
    }

    if (!dueReminders || dueReminders.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: 'No due reminders' }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      })
    }

    console.log(`Found ${dueReminders.length} due reminder(s)`)

    // Build Expo notification messages
    const notifications = dueReminders.map(reminder => ({
      to: reminder.push_token,
      sound: 'default',
      title: '🔔 DML Reminder',
      body: reminder.message,
      data: {
        reminderId: reminder.id,
        type: 'reminder',
        screen: 'ai',
      },
      priority: 'high',
      ttl: 3600, // 1 hour
    }))

    // Send to Expo Push API (batches of 100)
    const chunks = chunkArray(notifications, 100)
    const results = []

    for (const chunk of chunks) {
      const result = await sendExpoPush(chunk)
      results.push(result)
    }

    // Mark reminders as sent
    const sentIds = dueReminders.map(r => r.id)
    await supabase
      .from('ai_reminders')
      .update({ push_sent: true })
      .in('id', sentIds)

    console.log(`Sent ${dueReminders.length} push notification(s)`)

    return new Response(
      JSON.stringify({ success: true, sent: dueReminders.length, results }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Push notification error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error', success: false }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  }
})

// ── Helper: Send to Expo Push API ────────────────────────────────────────────
async function sendExpoPush(messages: any[]) {
  const response = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(messages),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Expo Push API error: ${response.status} - ${errorText}`)
  }

  return await response.json()
}

// ── Helper: Chunk array ──────────────────────────────────────────────────────
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}
