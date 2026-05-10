// AI Assistant - Main Edge Function
// Handles voice (Whisper) and text input → GPT-4o → action execution

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import OpenAI from "https://esm.sh/openai@4.20.1"

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    const authHeader = req.headers.get('Authorization')

    // Supabase client with user auth
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader ?? '' } } }
    )

    // Supabase service client for writes
    const supabaseService = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Authenticate user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      })
    }

    const openai = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY') })

    const body = await req.json()
    const {
      type = 'text',        // 'text' or 'voice'
      message,              // text message (if type=text)
      audioBase64,          // base64 encoded audio (if type=voice)
      audioFormat = 'm4a',  // audio format
      pushToken,            // Expo push token for this device
      conversationHistory = [], // previous messages [{role, content}]
    } = body

    let userMessage = message

    // ─── Step 1: Transcribe audio via Whisper ───────────────────────────────
    if (type === 'voice' && audioBase64) {
      try {
        const audioBytes = Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0))
        const transcription = await openai.audio.transcriptions.create({
          file: new File([audioBytes], `audio.${audioFormat}`, { type: `audio/${audioFormat}` }),
          model: 'whisper-1',
          language: 'en',
        })
        userMessage = transcription.text
        console.log('Whisper transcript:', userMessage)
      } catch (whisperError) {
        console.error('Whisper error:', whisperError)
        return new Response(JSON.stringify({ error: 'Failed to transcribe audio', success: false }), {
          status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        })
      }
    }

    if (!userMessage || !userMessage.trim()) {
      return new Response(JSON.stringify({ error: 'No message provided', success: false }), {
        status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      })
    }

    // ─── Step 2: Fetch user profile + context data ───────────────────────────
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id, full_name')
      .eq('id', user.id)
      .single()

    const companyId = profile?.company_id

    // Fetch all projects using service client (bypasses RLS entirely — no company_id filter needed)
    // Match the same status values the app uses
    const { data: recentProjects, error: projectsError } = await supabaseService
      .from('projects')
      .select('id, name, status, customer')
      .order('name', { ascending: true })
      .limit(200)

    console.log(`Projects loaded: ${recentProjects?.length || 0}, error: ${projectsError?.message}`)

    // Also fetch project_tasks (timeclock project name history) for fuzzy matching
    const { data: projectTasks } = await supabaseService
      .from('project_tasks')
      .select('name')
      .order('name', { ascending: true })
      .limit(200)

    // Fetch recent invoices
    const { data: recentInvoices } = await supabase
      .from('invoices')
      .select('id, invoice_number, customer_name, total, balance_due, status')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(10)

    // Fetch upcoming reminders
    const { data: upcomingReminders } = await supabase
      .from('ai_reminders')
      .select('id, message, remind_at, is_done')
      .eq('user_id', user.id)
      .eq('is_done', false)
      .gte('remind_at', new Date().toISOString())
      .order('remind_at', { ascending: true })
      .limit(5)

    // Fetch all active employees using service client (bypasses RLS)
    const { data: allEmployees } = await supabaseService
      .from('employees')
      .select('id, user_id, first_name, last_name, preferred_name')
      .eq('is_active', true)
      .or('archived.is.null,archived.eq.false')
      .order('first_name', { ascending: true })

    console.log(`Employees loaded: ${allEmployees?.length || 0}`)

    // Fetch currently clocked-in employees (shifts with no clock_out)
    const { data: activeShifts } = await supabaseService
      .from('shifts')
      .select('id, user_id, clock_in')
      .is('clock_out', null)
      .not('clock_in', 'is', null)

    // Fetch latest open segment for each active shift to get project name
    const activeShiftIds = (activeShifts || []).map(s => s.id)
    let segmentsByShiftId: Record<string, string> = {}
    if (activeShiftIds.length > 0) {
      const { data: openSegs } = await supabaseService
        .from('shift_segments')
        .select('shift_id, project_task')
        .in('shift_id', activeShiftIds)
        .is('end_at', null)
      ;(openSegs || []).forEach(seg => {
        segmentsByShiftId[seg.shift_id] = seg.project_task || 'No project assigned'
      })
    }

    // Build a map of user_id -> employee
    const employeeByUserId: Record<string, any> = {}
    const employeeByName: Record<string, any> = {}
    ;(allEmployees || []).forEach(emp => {
      employeeByUserId[emp.user_id] = emp
      const fullName = `${emp.first_name} ${emp.last_name}`.toLowerCase()
      const preferredName = emp.preferred_name 
        ? `${emp.preferred_name} ${emp.last_name}`.toLowerCase() 
        : null
      employeeByName[fullName] = emp
      if (preferredName) employeeByName[preferredName] = emp
      // Also index by first name alone for convenience
      employeeByName[emp.first_name.toLowerCase()] = emp
    })

    // Enrich active shifts with employee/project names
    const activeShiftsSummary = (activeShifts || []).map(shift => {
      const emp = employeeByUserId[shift.user_id]
      const elapsed = shift.clock_in 
        ? Math.round((Date.now() - new Date(shift.clock_in).getTime()) / 60000)
        : 0
      return {
        shiftId: shift.id,
        userId: shift.user_id,
        employeeName: emp ? `${emp.first_name} ${emp.last_name}` : 'Unknown',
        projectName: segmentsByShiftId[shift.id] || 'No project assigned',
        clockIn: shift.clock_in,
        elapsedMinutes: elapsed,
      }
    })

    // Get start of current week for hours query
    const startOfWeek = new Date()
    const dayOfWeek = startOfWeek.getDay()
    const daysBack = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    startOfWeek.setDate(startOfWeek.getDate() - daysBack)
    startOfWeek.setHours(0, 0, 0, 0)

    // ─── Step 3: Build system prompt with context ─────────────────────────────
    const now = new Date()
    const nowStr = now.toLocaleString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago'
    })

    const systemPrompt = `You are an AI assistant for DML Electrical Service LLC, a licensed electrical contracting company in Jennings, Louisiana, owned by Dustin Lavergne.

Current Date/Time (Central): ${nowStr}
Current User (the person talking to you): ${profile?.full_name || 'Dustin Lavergne'} | user_id: ${user.id}
IMPORTANT: When the user says "clock me in", "clock me out", "I started at...", "my hours", etc. — they are referring to THEMSELVES (${profile?.full_name || 'Dustin Lavergne'}, user_id: ${user.id}). Always use their user_id directly for self-references.

YOUR CAPABILITIES:
- Set reminders that send an SMS text message to your AT&T phone when the time arrives (use set_reminder tool) — just say "remind me [what] at [time]" and you'll get a text
- Parse & SAVE material lists directly to a project (use add_materials tool — saves to project_material_lists table)
- Generate professional proposal/scope of work text (use generate_proposal tool)
- Generate invoice descriptions (use generate_invoice_description tool)
- Create a real invoice in the database for a customer/project (use create_invoice tool)
- Create a draft estimate in the database (use create_estimate tool)
- Mark an invoice as paid (use mark_invoice_paid tool)
- Clock employees in/out of projects — including manual entries for past times (use clock_in_employee / clock_out_employee tools)
- Check timeclock status and hours (use get_timeclock_status / get_weekly_hours tools)
- Answer questions about projects, invoices, customers, and timeclock

ACTIVE PROJECTS (${recentProjects?.length || 0}):
${recentProjects?.map(p => `• "${p.name}" | Status: ${p.status} | Customer: ${p.customer || 'N/A'} | ID: ${p.id}`).join('\n') || 'None loaded'}

RECENT INVOICES (${recentInvoices?.length || 0}):
${recentInvoices?.map(i => `• Invoice #${i.invoice_number}: ${i.customer_name} | Total: $${i.total} | Balance: $${i.balance_due} | Status: ${i.status}`).join('\n') || 'None loaded'}

UPCOMING REMINDERS:
${upcomingReminders?.map(r => `• ${new Date(r.remind_at).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}: ${r.message}`).join('\n') || 'No upcoming reminders'}

EMPLOYEES (${allEmployees?.length || 0} active):
${allEmployees?.map(e => `• ${e.first_name} ${e.last_name}${e.preferred_name ? ` (goes by ${e.preferred_name})` : ''} | user_id: ${e.user_id}`).join('\n') || 'None loaded'}

CURRENTLY CLOCKED IN (${activeShiftsSummary.length} employees):
${activeShiftsSummary.length > 0 
  ? activeShiftsSummary.map(s => `• ${s.employeeName} → ${s.projectName} | Clocked in: ${new Date(s.clockIn).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} (${Math.floor(s.elapsedMinutes / 60)}h ${s.elapsedMinutes % 60}m)`).join('\n')
  : 'No one currently clocked in'}

GUIDELINES:
- Be brief and direct in your responses
- For material lists, always use the add_materials tool to return structured data
- For reminders, parse natural language dates/times accurately (e.g. "Monday" = next Monday from now)
- For proposals/invoices, write professional electrical contractor language
- When asked about project or invoice status, look it up from the context above
- For timeclock questions, use the status from CURRENTLY CLOCKED IN above or call get_timeclock_status
- When clocking someone in/out, match employee names from the EMPLOYEES list (use preferred name if mentioned)
- Always be helpful, professional, and specific to electrical contracting`

    // ─── Step 4: Define GPT-4o tools ──────────────────────────────────────────
    const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
      {
        type: 'function',
        function: {
          name: 'set_reminder',
          description: 'Set a reminder to notify the user at a specific date and time. Use this whenever the user says "remind me", "don\'t forget", "schedule", or mentions a time-based action.',
          parameters: {
            type: 'object',
            properties: {
              message: {
                type: 'string',
                description: 'What the reminder is about (concise, action-oriented)'
              },
              remind_at: {
                type: 'string',
                description: 'ISO 8601 datetime string for when to send the reminder (in America/Chicago timezone, converted to UTC)'
              },
            },
            required: ['message', 'remind_at']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'add_materials',
          description: 'Parse a spoken or typed material/item list into structured line items for an electrical estimate. Use this when the user lists materials, says "add to estimate", dictates a material list, or describes items to include.',
          parameters: {
            type: 'object',
            properties: {
              materials: {
                type: 'array',
                description: 'Array of parsed material line items',
                items: {
                  type: 'object',
                  properties: {
                    item: { type: 'string', description: 'Material or item name (clean, professional name)' },
                    qty: { type: 'number', description: 'Quantity as a number' },
                    unit: { type: 'string', description: 'Unit of measure: ea, ft, lf, lot, hr, etc.' },
                  },
                  required: ['item', 'qty', 'unit']
                }
              },
              project_name: {
                type: 'string',
                description: 'Name of the project to add materials to, if mentioned by user'
              }
            },
            required: ['materials']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'generate_proposal',
          description: 'Generate professional proposal scope of work text for an electrical project. Use when user asks to "write a proposal", "generate scope", or "create proposal text".',
          parameters: {
            type: 'object',
            properties: {
              project_name: { type: 'string', description: 'Name of the project' },
              customer_name: { type: 'string', description: 'Customer name if known' },
              description: { type: 'string', description: 'Description of the electrical work to be done' },
              project_type: { type: 'string', enum: ['residential', 'commercial', 'industrial', 'agricultural'], description: 'Type of project' }
            },
            required: ['project_name', 'description']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'generate_invoice_description',
          description: 'Generate professional invoice notes/description text for completed electrical work.',
          parameters: {
            type: 'object',
            properties: {
              project_name: { type: 'string', description: 'Project name' },
              work_completed: { type: 'string', description: 'Description of work completed' },
            },
            required: ['project_name', 'work_completed']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'get_timeclock_status',
          description: 'Get current timeclock status — who is clocked in, what project they are on, and how long they have been working. Use when user asks "who\'s clocked in", "who is working", "what time did everyone start", or similar status questions.',
          parameters: {
            type: 'object',
            properties: {
              employee_name: {
                type: 'string',
                description: 'Specific employee name to check (optional — omit to get all employees)'
              }
            },
            required: []
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'clock_in_employee',
          description: 'Clock an employee in to a project. Use when user says "clock in [name]", "start [name] on [project]", "[name] is starting work", or "clock [name] in at [time]". Supports manual past-time entry — if a specific time is mentioned (e.g. "at 7 this morning", "at 7:30 am"), pass it as clock_in_time.',
          parameters: {
            type: 'object',
            properties: {
              employee_name: {
                type: 'string',
                description: 'First name, last name, or preferred name of the employee to clock in'
              },
              project_name: {
                type: 'string',
                description: 'Name of the project to clock them into (optional)'
              },
              clock_in_time: {
                type: 'string',
                description: 'ISO 8601 datetime string for the clock-in time (in America/Chicago timezone, converted to UTC). Use this when the user specifies a past time like "7 this morning" or "7:30 am". If not specified, defaults to right now.'
              }
            },
            required: ['employee_name']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'clock_out_employee',
          description: 'Clock an employee out, ending their current shift. Use when user says "clock out [name]", "[name] is done", "[name] is leaving", or "end [name]\'s shift". If a specific clock-out time is mentioned, pass it as clock_out_time.',
          parameters: {
            type: 'object',
            properties: {
              employee_name: {
                type: 'string',
                description: 'First name, last name, or preferred name of the employee to clock out'
              },
              clock_out_time: {
                type: 'string',
                description: 'ISO 8601 datetime string for the clock-out time. Use when the user specifies a past time. Defaults to right now if omitted.'
              }
            },
            required: ['employee_name']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'get_weekly_hours',
          description: 'Get total hours worked this week for all employees or a specific employee. Use when user asks "how many hours did [name] work", "what are this week\'s hours", "weekly totals", etc.',
          parameters: {
            type: 'object',
            properties: {
              employee_name: {
                type: 'string',
                description: 'Specific employee name (optional — omit to get totals for all employees)'
              }
            },
            required: []
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'mark_invoice_paid',
          description: 'Mark an invoice as paid and set balance_due to 0. Use when user says "mark [invoice/customer] as paid", "[customer] paid", "invoice [number] is paid", etc.',
          parameters: {
            type: 'object',
            properties: {
              invoice_number: {
                type: 'string',
                description: 'Invoice number (e.g. "1023") if the user mentioned it'
              },
              customer_name: {
                type: 'string',
                description: 'Customer name to look up the invoice if no invoice number was given'
              },
              payment_method: {
                type: 'string',
                description: 'How they paid — cash, check, card, etc. (optional)'
              }
            },
            required: []
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'create_invoice',
          description: 'Create a new invoice in the database for a customer/project. Use when user says "create an invoice for [customer]", "make an invoice for [project]", "bill [customer] $[amount]", etc.',
          parameters: {
            type: 'object',
            properties: {
              customer_name: { type: 'string', description: 'Customer name for the invoice' },
              project_name: { type: 'string', description: 'Project name (optional — used to link to a project)' },
              total: { type: 'number', description: 'Invoice total amount in dollars' },
              description: { type: 'string', description: 'Description of the work / invoice notes' },
            },
            required: ['customer_name', 'total']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'create_estimate',
          description: 'Create a draft estimate in the database. Use when user says "create an estimate for [customer]", "make a quote for [project]", "start an estimate", etc.',
          parameters: {
            type: 'object',
            properties: {
              customer_name: { type: 'string', description: 'Customer name for the estimate' },
              project_name: { type: 'string', description: 'Project name or description' },
              total: { type: 'number', description: 'Estimated total amount in dollars (if mentioned)' },
              description: { type: 'string', description: 'Scope of work or description of what is being estimated' },
            },
            required: ['customer_name']
          }
        }
      }
    ]

    // ─── Step 5: Call GPT-4o ─────────────────────────────────────────────────
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-8).map((m: any) => ({ role: m.role, content: m.content })),
      { role: 'user', content: userMessage }
    ]

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      tools,
      tool_choice: 'auto',
      temperature: 0.6,
      max_tokens: 1000,
    })

    const choice = completion.choices[0]
    let responseMessage = choice.message.content || ''
    let action: string | null = null
    let actionData: any = null

    // ─── Step 6: Handle tool calls ────────────────────────────────────────────
    if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls?.length) {
      const toolCall = choice.message.tool_calls[0]
      const toolArgs = JSON.parse(toolCall.function.arguments)

      // ── set_reminder ────────────────────────────────────────────────────────
      if (toolCall.function.name === 'set_reminder') {
        const { error: reminderError } = await supabaseService
          .from('ai_reminders')
          .insert({
            user_id: user.id,
            company_id: companyId,
            message: toolArgs.message,
            remind_at: toolArgs.remind_at,
            push_token: pushToken || null,
          })

        if (!reminderError) {
          const remindDate = new Date(toolArgs.remind_at)
          const formattedDate = remindDate.toLocaleString('en-US', {
            weekday: 'long', month: 'long', day: 'numeric',
            hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago'
          })
          action = 'set_reminder'
          actionData = { message: toolArgs.message, remind_at: toolArgs.remind_at }
          responseMessage = `✅ Reminder set!\n\n"${toolArgs.message}"\n\n📅 ${formattedDate}\n\n📱 You'll get an SMS text to your phone at that time!`
        } else {
          console.error('Reminder insert error:', reminderError)
          responseMessage = `I tried to set a reminder but ran into an issue. Please try again.`
        }

      // ── add_materials ────────────────────────────────────────────────────────
      } else if (toolCall.function.name === 'add_materials') {
        const materialList = toolArgs.materials
          .map((m: any) => `• ${m.qty} ${m.unit} — ${m.item}`)
          .join('\n')

        // Try to save to project if a project name was mentioned
        let savedToProject: string | null = null
        let savedListId: string | null = null
        if (toolArgs.project_name) {
          const searchTerm = toolArgs.project_name.toLowerCase()
          const matchedProject = recentProjects?.find(p =>
            p.name.toLowerCase().includes(searchTerm) ||
            searchTerm.includes(p.name.toLowerCase()) ||
            (p.customer && p.customer.toLowerCase().includes(searchTerm))
          )
          if (matchedProject) {
            try {
              // Create the material list record
              const { data: newList, error: listError } = await supabaseService
                .from('project_material_lists')
                .insert({
                  project_id: matchedProject.id,
                  title: 'Material List',
                  status: 'draft',
                  created_by: user.id,
                })
                .select()
                .single()

              if (!listError && newList) {
                savedListId = newList.id
                // Insert all items
                const itemRows = toolArgs.materials.map((m: any, idx: number) => ({
                  material_list_id: newList.id,
                  description: m.item,
                  quantity: m.qty,
                  unit: m.unit,
                  unit_cost: 0,
                  total_cost: 0,
                  category: 'Other',
                  status: 'needed',
                  sort_order: idx,
                }))
                await supabaseService.from('material_list_items').insert(itemRows)
                savedToProject = matchedProject.name
              }
            } catch (saveErr) {
              console.error('Error saving material list:', saveErr)
            }
          }
        }

        action = 'add_materials'
        actionData = {
          materials: toolArgs.materials,
          project_name: toolArgs.project_name || null,
          saved_to_project: savedToProject,
          list_id: savedListId,
        }

        responseMessage = `✅ Got it! Here are your materials (${toolArgs.materials.length} items):\n\n${materialList}`
        if (savedToProject) {
          responseMessage += `\n\n📋 Saved to "${savedToProject}" project! View it under that project's Material Lists in the app.`
        } else if (toolArgs.project_name) {
          responseMessage += `\n\n⚠️ Couldn't find project "${toolArgs.project_name}" — list not saved. Tap "Copy List" to use it manually.`
        } else {
          responseMessage += `\n\nTap "Copy List" to use these, or say which project to save them to.`
        }

      // ── generate_proposal ─────────────────────────────────────────────────
      } else if (toolCall.function.name === 'generate_proposal') {
        const proposalCompletion = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [{
            role: 'user',
            content: `Write a professional electrical contractor proposal scope of work (2-3 paragraphs) for DML Electrical Service LLC.

Project: ${toolArgs.project_name}
Customer: ${toolArgs.customer_name || 'Customer'}
Type: ${toolArgs.project_type || 'commercial'}
Work Description: ${toolArgs.description}

Write in first person plural (we/our). Be professional, specific to electrical work, and mention NEC compliance. Keep it concise but thorough.`
          }],
          max_tokens: 600,
          temperature: 0.7,
        })

        const proposalText = proposalCompletion.choices[0].message.content || ''
        action = 'generate_proposal'
        actionData = { text: proposalText, project_name: toolArgs.project_name }
        responseMessage = `✅ Proposal generated for "${toolArgs.project_name}"!\n\nTap "Copy Text" to use it in your estimate or proposal.`

      // ── generate_invoice_description ────────────────────────────────────────
      } else if (toolCall.function.name === 'generate_invoice_description') {
        const invoiceCompletion = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [{
            role: 'user',
            content: `Write a professional electrical contractor invoice description (1-2 sentences) for:
Project: ${toolArgs.project_name}
Work Completed: ${toolArgs.work_completed}
Be concise and professional. Start with what was installed/completed.`
          }],
          max_tokens: 150,
          temperature: 0.5,
        })

        const invoiceText = invoiceCompletion.choices[0].message.content || ''
        action = 'generate_invoice_description'
        actionData = { text: invoiceText, project_name: toolArgs.project_name }
        responseMessage = `✅ Invoice description ready!\n\nTap "Copy Text" to use it.`

      // ── get_timeclock_status ──────────────────────────────────────────────
      } else if (toolCall.function.name === 'get_timeclock_status') {
        const filterName = toolArgs.employee_name?.toLowerCase()
        let filtered = activeShiftsSummary

        if (filterName) {
          filtered = activeShiftsSummary.filter(s =>
            s.employeeName.toLowerCase().includes(filterName)
          )
        }

        action = 'timeclock_status'
        actionData = { shifts: filtered }

        if (filtered.length === 0) {
          responseMessage = filterName
            ? `🕐 ${toolArgs.employee_name} is not currently clocked in.`
            : `🕐 No one is currently clocked in.`
        } else {
          const lines = filtered.map(s => {
            const hrs = Math.floor(s.elapsedMinutes / 60)
            const mins = s.elapsedMinutes % 60
            const clockInTime = new Date(s.clockIn).toLocaleTimeString('en-US', {
              hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago'
            })
            return `• **${s.employeeName}** — ${s.projectName}\n  Clocked in at ${clockInTime} (${hrs}h ${mins}m ago)`
          })
          responseMessage = `🕐 Currently clocked in (${filtered.length}):\n\n${lines.join('\n\n')}`
        }

      // ── clock_in_employee ────────────────────────────────────────────────
      } else if (toolCall.function.name === 'clock_in_employee') {
        const searchName = toolArgs.employee_name?.toLowerCase()

        // Find employee by name (fuzzy match)
        let matchedEmployee = employeeByName[searchName]
        if (!matchedEmployee) {
          // Try partial match
          matchedEmployee = (allEmployees || []).find(e =>
            e.first_name.toLowerCase().includes(searchName) ||
            e.last_name.toLowerCase().includes(searchName) ||
            (e.preferred_name && e.preferred_name.toLowerCase().includes(searchName))
          )
        }

        // Self-reference fallback: "me", "myself", "I", or the current user's name
        if (!matchedEmployee) {
          const selfTerms = ['me', 'myself', 'i']
          const currentUserName = (profile?.full_name || 'dustin lavergne').toLowerCase()
          const isSelf = selfTerms.includes(searchName) ||
            currentUserName.includes(searchName) ||
            searchName.includes('dustin')
          if (isSelf) {
            // Synthesize an employee object from the current user's profile
            const nameParts = (profile?.full_name || 'Dustin Lavergne').split(' ')
            matchedEmployee = {
              user_id: user.id,
              first_name: nameParts[0] || 'Dustin',
              last_name: nameParts.slice(1).join(' ') || 'Lavergne',
              preferred_name: null,
            }
          }
        }

        if (!matchedEmployee) {
          responseMessage = `❌ I couldn't find an employee named "${toolArgs.employee_name}". Available employees: ${(allEmployees || []).map(e => e.first_name).join(', ')}`
        } else {
          // Check if already clocked in
          const alreadyClockedIn = activeShiftsSummary.find(s => s.userId === matchedEmployee.user_id)
          if (alreadyClockedIn) {
            responseMessage = `⚠️ ${matchedEmployee.first_name} ${matchedEmployee.last_name} is already clocked in on "${alreadyClockedIn.projectName}". Clock them out first if you want to switch projects.`
          } else {
            // Find project — search by name AND customer_name, then fall back to project_tasks, then raw text
            let projectNameDisplay = ''
            if (toolArgs.project_name) {
              const searchTerm = toolArgs.project_name.toLowerCase()
              const proj = recentProjects?.find(p =>
                p.name.toLowerCase().includes(searchTerm) ||
                searchTerm.includes(p.name.toLowerCase()) ||
                (p.customer && p.customer.toLowerCase().includes(searchTerm)) ||
                (p.customer && searchTerm.includes(p.customer.toLowerCase()))
              )
              if (proj) {
                // Use the project name from our system
                projectNameDisplay = proj.name
              } else {
                // Check project_tasks history (timeclock free-text names)
                const taskMatch = (projectTasks || []).find(t =>
                  t.name && (
                    t.name.toLowerCase().includes(searchTerm) ||
                    searchTerm.includes(t.name.toLowerCase())
                  )
                )
                // Use matched task name, or just use what the user said
                projectNameDisplay = taskMatch ? taskMatch.name : toolArgs.project_name
              }
            }

            // Use provided past time if given, otherwise use now
            const clockInTime = toolArgs.clock_in_time
              ? new Date(toolArgs.clock_in_time).toISOString()
              : new Date().toISOString()
            const isManualEntry = !!toolArgs.clock_in_time

            // shifts table has NO project_id — project lives in shift_segments
            const { data: newShift, error: shiftError } = await supabaseService
              .from('shifts')
              .insert({
                user_id: matchedEmployee.user_id,
                clock_in: clockInTime,
                clock_out: null,
              })
              .select()
              .single()

            if (!shiftError && newShift) {
              // Create the first shift_segment with the project name
              await supabaseService.from('shift_segments').insert({
                user_id: matchedEmployee.user_id,
                shift_id: newShift.id,
                project_task: projectNameDisplay !== 'No project' ? projectNameDisplay : '',
                start_at: clockInTime,
                end_at: null,
              })

              const displayName = `${matchedEmployee.first_name} ${matchedEmployee.last_name}`
              const formattedTime = new Date(clockInTime).toLocaleTimeString('en-US', {
                hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago'
              })
              action = 'clock_in'
              actionData = { employeeName: displayName, projectName: projectNameDisplay, clockIn: clockInTime, isManualEntry }
              const manualNote = isManualEntry ? '\n📝 Manual entry — time backdated.' : ''
              responseMessage = `✅ **${displayName}** clocked in!\n\n⏰ ${formattedTime}\n📂 Project: ${projectNameDisplay}${manualNote}\n\nThis shows in the timeclock app immediately.`
            } else {
              console.error('Clock-in error:', shiftError)
              responseMessage = `❌ Failed to clock in ${matchedEmployee.first_name}. Error: ${shiftError?.message}`
            }
          }
        }

      // ── clock_out_employee ───────────────────────────────────────────────
      } else if (toolCall.function.name === 'clock_out_employee') {
        const searchName = toolArgs.employee_name?.toLowerCase()

        // Find employee
        let matchedEmployee = employeeByName[searchName]
        if (!matchedEmployee) {
          matchedEmployee = (allEmployees || []).find(e =>
            e.first_name.toLowerCase().includes(searchName) ||
            e.last_name.toLowerCase().includes(searchName) ||
            (e.preferred_name && e.preferred_name.toLowerCase().includes(searchName))
          )
        }

        // Self-reference fallback for clock-out too
        if (!matchedEmployee) {
          const selfTerms = ['me', 'myself', 'i']
          const currentUserName = (profile?.full_name || 'dustin lavergne').toLowerCase()
          const isSelf = selfTerms.includes(searchName) ||
            currentUserName.includes(searchName) ||
            searchName.includes('dustin')
          if (isSelf) {
            const nameParts = (profile?.full_name || 'Dustin Lavergne').split(' ')
            matchedEmployee = {
              user_id: user.id,
              first_name: nameParts[0] || 'Dustin',
              last_name: nameParts.slice(1).join(' ') || 'Lavergne',
              preferred_name: null,
            }
          }
        }

        if (!matchedEmployee) {
          responseMessage = `❌ I couldn't find an employee named "${toolArgs.employee_name}".`
        } else {
          // Find their active shift
          const activeShift = activeShiftsSummary.find(s => s.userId === matchedEmployee.user_id)

          if (!activeShift) {
            responseMessage = `⚠️ ${matchedEmployee.first_name} ${matchedEmployee.last_name} is not currently clocked in.`
          } else {
            // Use provided past time if given, otherwise use now
            const clockOutTime = toolArgs.clock_out_time
              ? new Date(toolArgs.clock_out_time).toISOString()
              : new Date().toISOString()
            const isManualClockOut = !!toolArgs.clock_out_time

            const { error: clockOutError } = await supabaseService
              .from('shifts')
              .update({ clock_out: clockOutTime })
              .eq('id', activeShift.shiftId)

            // Also close any open shift_segments for this shift
            await supabaseService
              .from('shift_segments')
              .update({ end_at: clockOutTime })
              .eq('shift_id', activeShift.shiftId)
              .is('end_at', null)

            if (!clockOutError) {
              const displayName = `${matchedEmployee.first_name} ${matchedEmployee.last_name}`
              // Calculate total from actual clock_in to given clock_out
              const clockOutMs = new Date(clockOutTime).getTime()
              const clockInMs = new Date(activeShift.clockIn).getTime()
              const totalMinutes = Math.max(0, Math.round((clockOutMs - clockInMs) / 60000))
              const totalHrs = Math.floor(totalMinutes / 60)
              const totalMins = totalMinutes % 60
              const formattedTime = new Date(clockOutTime).toLocaleTimeString('en-US', {
                hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago'
              })
              const manualNote = isManualClockOut ? '\n📝 Manual entry — time backdated.' : ''
              action = 'clock_out'
              actionData = { employeeName: displayName, clockOut: clockOutTime, totalMinutes, isManualClockOut }
              responseMessage = `✅ **${displayName}** clocked out!\n\n⏰ ${formattedTime}\n📂 Project: ${activeShift.projectName}\n⏱️ Total time: ${totalHrs}h ${totalMins}m${manualNote}\n\nUpdated in the timeclock app.`
            } else {
              console.error('Clock-out error:', clockOutError)
              responseMessage = `❌ Failed to clock out ${matchedEmployee.first_name}. Error: ${clockOutError.message}`
            }
          }
        }

      // ── get_weekly_hours ─────────────────────────────────────────────────
      } else if (toolCall.function.name === 'get_weekly_hours') {
        const { data: weekShifts } = await supabaseService
          .from('shifts')
          .select('user_id, clock_in, clock_out')
          .gte('clock_in', startOfWeek.toISOString())
          .not('clock_out', 'is', null)

        // Aggregate by employee
        const hoursByEmployee: Record<string, number> = {}
        ;(weekShifts || []).forEach(shift => {
          const emp = employeeByUserId[shift.user_id]
          if (!emp) return
          const name = `${emp.first_name} ${emp.last_name}`
          const hours = (new Date(shift.clock_out).getTime() - new Date(shift.clock_in).getTime()) / 3600000
          hoursByEmployee[name] = (hoursByEmployee[name] || 0) + hours
        })

        const filterName = toolArgs.employee_name?.toLowerCase()
        let entries = Object.entries(hoursByEmployee).sort((a, b) => b[1] - a[1])

        if (filterName) {
          entries = entries.filter(([name]) => name.toLowerCase().includes(filterName))
        }

        action = 'weekly_hours'
        actionData = { hours: Object.fromEntries(entries) }

        if (entries.length === 0) {
          responseMessage = filterName
            ? `📊 No hours recorded for "${toolArgs.employee_name}" this week yet.`
            : `📊 No completed shifts recorded this week yet.`
        } else {
          const weekStart = startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          const lines = entries.map(([name, hrs]) => {
            const h = Math.floor(hrs)
            const m = Math.round((hrs - h) * 60)
            return `• **${name}**: ${h}h ${m}m`
          })
          const totalHrs = entries.reduce((sum, [, h]) => sum + h, 0)
          const totalH = Math.floor(totalHrs)
          const totalM = Math.round((totalHrs - totalH) * 60)
          responseMessage = `📊 Week of ${weekStart}:\n\n${lines.join('\n')}\n\n**Total crew: ${totalH}h ${totalM}m**`
        }

      // ── mark_invoice_paid ────────────────────────────────────────────────
      } else if (toolCall.function.name === 'mark_invoice_paid') {
        // Find the invoice by number or customer name
        let targetInvoice: any = null

        if (toolArgs.invoice_number) {
          targetInvoice = recentInvoices?.find(i =>
            String(i.invoice_number) === String(toolArgs.invoice_number)
          )
          // If not in recent, search DB
          if (!targetInvoice) {
            const { data: foundInv } = await supabaseService
              .from('invoices')
              .select('id, invoice_number, customer_name, total, balance_due, status')
              .eq('company_id', companyId)
              .eq('invoice_number', toolArgs.invoice_number)
              .single()
            targetInvoice = foundInv
          }
        } else if (toolArgs.customer_name) {
          const search = toolArgs.customer_name.toLowerCase()
          targetInvoice = recentInvoices?.find(i =>
            i.customer_name?.toLowerCase().includes(search)
          )
          if (!targetInvoice) {
            const { data: foundInvs } = await supabaseService
              .from('invoices')
              .select('id, invoice_number, customer_name, total, balance_due, status')
              .eq('company_id', companyId)
              .ilike('customer_name', `%${toolArgs.customer_name}%`)
              .order('created_at', { ascending: false })
              .limit(1)
            targetInvoice = foundInvs?.[0] || null
          }
        }

        if (!targetInvoice) {
          responseMessage = `❌ Couldn't find that invoice. Try saying the invoice number or the exact customer name.`
        } else if (targetInvoice.status === 'paid') {
          responseMessage = `ℹ️ Invoice #${targetInvoice.invoice_number} for ${targetInvoice.customer_name} is already marked as paid.`
        } else {
          const { error: paidError } = await supabaseService
            .from('invoices')
            .update({
              status: 'paid',
              balance_due: 0,
              payment_method: toolArgs.payment_method || null,
              paid_at: new Date().toISOString(),
            })
            .eq('id', targetInvoice.id)

          if (!paidError) {
            action = 'invoice_paid'
            actionData = { invoiceId: targetInvoice.id, invoiceNumber: targetInvoice.invoice_number, customerName: targetInvoice.customer_name, total: targetInvoice.total }
            const payMethod = toolArgs.payment_method ? ` (${toolArgs.payment_method})` : ''
            responseMessage = `✅ Invoice #${targetInvoice.invoice_number} marked as paid!\n\n👤 Customer: ${targetInvoice.customer_name}\n💰 Amount: $${Number(targetInvoice.total).toFixed(2)}${payMethod}\n\nBalance is now $0.00.`
          } else {
            console.error('Mark paid error:', paidError)
            responseMessage = `❌ Failed to mark invoice as paid: ${paidError.message}`
          }
        }

      // ── create_invoice ───────────────────────────────────────────────────
      } else if (toolCall.function.name === 'create_invoice') {
        try {
          // Get next invoice number
          const { data: lastInv } = await supabaseService
            .from('invoices')
            .select('invoice_number')
            .eq('company_id', companyId)
            .order('invoice_number', { ascending: false })
            .limit(1)
          const nextNum = lastInv?.[0]?.invoice_number
            ? Number(lastInv[0].invoice_number) + 1
            : 1001

          // Try to find project id if project_name given
          let linkedProjectId: string | null = null
          if (toolArgs.project_name) {
            const searchTerm = toolArgs.project_name.toLowerCase()
            const proj = recentProjects?.find(p =>
              p.name.toLowerCase().includes(searchTerm) ||
              searchTerm.includes(p.name.toLowerCase())
            )
            if (proj) linkedProjectId = proj.id
          }

          const { data: newInvoice, error: invError } = await supabaseService
            .from('invoices')
            .insert({
              company_id: companyId,
              invoice_number: nextNum,
              customer_name: toolArgs.customer_name,
              total: toolArgs.total,
              balance_due: toolArgs.total,
              status: 'draft',
              notes: toolArgs.description || null,
              project_id: linkedProjectId,
              created_by: user.id,
            })
            .select()
            .single()

          if (!invError && newInvoice) {
            action = 'invoice_created'
            actionData = { invoiceId: newInvoice.id, invoiceNumber: nextNum, customerName: toolArgs.customer_name, total: toolArgs.total }
            responseMessage = `✅ Invoice #${nextNum} created!\n\n👤 Customer: ${toolArgs.customer_name}\n💰 Total: $${Number(toolArgs.total).toFixed(2)}\n📋 Status: Draft${toolArgs.project_name ? `\n📂 Project: ${toolArgs.project_name}` : ''}\n\nOpen the web app to add line items and send it.`
          } else {
            responseMessage = `❌ Failed to create invoice: ${invError?.message}`
          }
        } catch (invErr: any) {
          responseMessage = `❌ Invoice creation failed: ${invErr.message}`
        }

      // ── create_estimate ──────────────────────────────────────────────────
      } else if (toolCall.function.name === 'create_estimate') {
        try {
          // Try to find project id if project_name given
          let linkedProjectId: string | null = null
          if (toolArgs.project_name) {
            const searchTerm = toolArgs.project_name.toLowerCase()
            const proj = recentProjects?.find(p =>
              p.name.toLowerCase().includes(searchTerm) ||
              searchTerm.includes(p.name.toLowerCase())
            )
            if (proj) linkedProjectId = proj.id
          }

          const { data: newEst, error: estError } = await supabaseService
            .from('estimates')
            .insert({
              company_id: companyId,
              customer_name: toolArgs.customer_name,
              project_name: toolArgs.project_name || null,
              total: toolArgs.total || 0,
              status: 'draft',
              notes: toolArgs.description || null,
              project_id: linkedProjectId,
              created_by: user.id,
            })
            .select()
            .single()

          if (!estError && newEst) {
            action = 'estimate_created'
            actionData = { estimateId: newEst.id, customerName: toolArgs.customer_name, projectName: toolArgs.project_name, total: toolArgs.total }
            const totalStr = toolArgs.total ? `$${Number(toolArgs.total).toFixed(2)}` : 'TBD'
            responseMessage = `✅ Draft estimate created!\n\n👤 Customer: ${toolArgs.customer_name}${toolArgs.project_name ? `\n📂 Project: ${toolArgs.project_name}` : ''}\n💰 Total: ${totalStr}\n\nOpen the web app to add line items and finalize it.`
          } else {
            responseMessage = `❌ Failed to create estimate: ${estError?.message}`
          }
        } catch (estErr: any) {
          responseMessage = `❌ Estimate creation failed: ${estErr.message}`
        }
      }
    }

    // ─── Step 7: Save conversation to database ────────────────────────────────
    try {
      await supabaseService.from('ai_conversations').insert([
        {
          user_id: user.id,
          company_id: companyId,
          role: 'user',
          content: userMessage,
          transcript: type === 'voice' ? userMessage : null,
        },
        {
          user_id: user.id,
          company_id: companyId,
          role: 'assistant',
          content: responseMessage,
          action,
          action_data: actionData,
        }
      ])
    } catch (saveError) {
      console.error('Failed to save conversation:', saveError)
      // Non-fatal - continue
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: responseMessage,
        transcript: type === 'voice' ? userMessage : undefined,
        action,
        actionData,
      }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('AI Assistant error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error', success: false }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  }
})
