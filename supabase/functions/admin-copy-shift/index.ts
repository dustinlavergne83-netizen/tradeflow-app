// admin-copy-shift: Copies a shift to another employee using service role (bypasses RLS)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify caller is authenticated
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Not authenticated')

    // Verify the caller's session using anon key
    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user }, error: userErr } = await anonClient.auth.getUser()
    if (userErr || !user) throw new Error('Invalid session')

    // Use SERVICE ROLE client — bypasses RLS entirely
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { targetUid, day, segs } = await req.json()
    if (!targetUid || !day || !segs?.length) {
      throw new Error(`Missing required fields: targetUid=${targetUid}, day=${day}, segs=${segs?.length}`)
    }

    console.log(`admin-copy-shift: targetUid=${targetUid}, day=${day}, segCount=${segs.length}`)

    // Fetch target employee's company_id (needed for inserts)
    const { data: empData, error: empErr } = await admin
      .from('employees')
      .select('company_id')
      .eq('user_id', targetUid)
      .single()

    if (empErr) console.warn('Could not fetch employee company_id:', empErr.message)
    const companyId = empData?.company_id || null
    console.log(`company_id for target: ${companyId}`)

    // Check if target employee already has a shift on this day
    const { data: existingShifts, error: existErr } = await admin
      .from('shifts')
      .select('id')
      .eq('user_id', targetUid)
      .gte('clock_in', day + 'T00:00:00')
      .lte('clock_in', day + 'T23:59:59')
      .limit(1)

    if (existErr) console.warn('Error checking existing shifts:', existErr.message)
    console.log(`Existing shifts for ${targetUid} on ${day}:`, existingShifts?.length ?? 0)

    let shiftId: string

    if (existingShifts && existingShifts.length > 0) {
      shiftId = existingShifts[0].id
      console.log(`Using existing shift: ${shiftId}`)
    } else {
      const firstSeg = segs[0]
      const lastSeg = segs[segs.length - 1]

      const shiftInsert: Record<string, unknown> = {
        user_id: targetUid,
        clock_in: firstSeg.start_at,
        clock_out: lastSeg.end_at || null,
      }
      if (companyId) shiftInsert.company_id = companyId

      console.log('Inserting shift:', JSON.stringify(shiftInsert))
      const { data: newShift, error: shiftErr } = await admin
        .from('shifts')
        .insert(shiftInsert)
        .select()
        .single()

      if (shiftErr) {
        console.error('Shift insert error:', shiftErr)
        throw new Error(`Shift insert failed: ${shiftErr.message}`)
      }
      shiftId = newShift.id
      console.log(`Created new shift: ${shiftId}`)
    }

    // Insert all segments for the target employee
    let insertedCount = 0
    for (const sourceSeg of segs) {
      const segInsert: Record<string, unknown> = {
        shift_id: shiftId,
        user_id: targetUid,
        start_at: sourceSeg.start_at,
        end_at: sourceSeg.end_at || null,
        project_task: sourceSeg.project_task || null,
        project_id: sourceSeg.project_id || null,
        is_lunch: sourceSeg.is_lunch || false,
      }
      if (companyId) segInsert.company_id = companyId

      console.log('Inserting segment:', JSON.stringify(segInsert))
      const { error: segErr } = await admin.from('shift_segments').insert(segInsert)
      if (segErr) {
        console.error('Segment insert error:', segErr)
        throw new Error(`Segment insert failed: ${segErr.message}`)
      }
      insertedCount++
    }

    console.log(`Successfully inserted ${insertedCount} segments for shift ${shiftId}`)

    return new Response(
      JSON.stringify({ success: true, shiftId, insertedCount }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('admin-copy-shift error:', err)
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
