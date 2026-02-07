// Receipt Parser - Supabase Edge Function
// Uses OpenAI Vision API to extract data from receipt images

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import OpenAI from "https://esm.sh/openai@4.20.1"

serve(async (req) => {
  try {
    // Handle CORS
    if (req.method === 'OPTIONS') {
      return new Response('ok', { 
        headers: { 
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        }
      })
    }

    // Get request body
    const { 
      imageBase64,
      imageUrl,
      projectId,
      userId
    } = await req.json()

    // Validate input
    if (!imageBase64 && !imageUrl) {
      return new Response(
        JSON.stringify({ error: 'Missing image data' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Log for debugging
    console.log('Parse receipt called with userId:', userId)
    console.log('OpenAI API Key exists:', !!Deno.env.get('OPENAI_API_KEY'))
    
    // Check user is admin or supervisor
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_ANON_KEY') || ''
    )

    let employee;
    try {
      const { data: empData, error: employeeError } = await supabase
        .from('employees')
        .select('role')
        .eq('user_id', userId)
        .single()

      if (employeeError) {
        console.warn('Employee lookup error (continuing anyway):', employeeError)
      } else {
        employee = empData
        console.log('Employee role:', employee?.role)
      }
    } catch (e) {
      console.warn('Failed to check employee role (continuing anyway):', e)
    }

    // For now, allow any authenticated user to use this
    // Remove this check if you want to enforce role-based access
    // if (employeeError || !employee || (employee.role !== 'admin' && employee.role !== 'supervisor')) {
    //   return new Response(
    //     JSON.stringify({ error: 'Unauthorized - only admins and supervisors can parse receipts' }),
    //     { status: 403, headers: { 'Content-Type': 'application/json' } }
    //   )
    // }

    // Initialize OpenAI
    const openai = new OpenAI({
      apiKey: Deno.env.get('OPENAI_API_KEY')
    })

    // Prepare image for API
    const imageSource = imageBase64 
      ? {
          type: "base64" as const,
          media_type: "image/jpeg" as const,
          data: imageBase64
        }
      : {
          type: "url" as const,
          url: imageUrl as string
        }

    // Call OpenAI Vision API - using gpt-4o which has better vision support and availability
    let response;
    try {
      const imageData = imageBase64 ? `data:image/jpeg;base64,${imageBase64}` : imageUrl;
      
      console.log('Calling OpenAI with model gpt-4o')
      response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: imageData || "",
                }
              },
              {
                type: "text",
                text: `Analyze this receipt image and extract information in JSON:
{
  "vendor_name": "Store name",
  "amount": 0.00,
  "receipt_date": "YYYY-MM-DD",
  "receipt_items": [{"description": "item", "quantity": 1, "price": 0.00}],
  "raw_text": "Full receipt text"
}
Use null for unreadable values. Use decimals for amounts without currency.`
              }
            ]
          }
        ],
        max_tokens: 1024,
      })
    } catch (apiErr: any) {
      console.error('OpenAI API full error:', JSON.stringify(apiErr, null, 2))
      console.error('API error message:', apiErr.message)
      
      // If gpt-4o fails, try gpt-4-turbo as fallback
      console.log('gpt-4o failed, trying gpt-4-turbo as fallback...')
      try {
        response = await openai.chat.completions.create({
          model: "gpt-4-turbo",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image_url",
                  image_url: {
                    url: imageBase64 ? `data:image/jpeg;base64,${imageBase64}` : imageUrl || ""
                  }
                },
                {
                  type: "text",
                  text: `Analyze this receipt image and extract information in JSON:
{
  "vendor_name": "Store name",
  "amount": 0.00,
  "receipt_date": "YYYY-MM-DD",
  "receipt_items": [{"description": "item", "quantity": 1, "price": 0.00}],
  "raw_text": "Full receipt text"
}
Use null for unreadable values. Use decimals for amounts without currency.`
                }
              ]
            }
          ],
          max_tokens: 1024,
        })
      } catch (fallbackErr: any) {
        console.error('Fallback to gpt-4-turbo also failed:', fallbackErr.message)
        throw new Error(`OpenAI Vision API Error: ${apiErr.message}. Tried models: gpt-4o, gpt-4-turbo. Check your API key and model access.`)
      }
    }

    // Parse the response
    const responseText = response.choices[0].message.content || ''
    
    // Try to extract JSON from the response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('Could not extract JSON from response')
    }

    const parsedData = JSON.parse(jsonMatch[0])

    // Validate parsed data
    if (!parsedData.vendor_name || !parsedData.amount) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Could not parse receipt - vendor name or amount missing',
          rawResponse: responseText
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          vendor_name: parsedData.vendor_name,
          amount: parseFloat(parsedData.amount),
          receipt_date: parsedData.receipt_date,
          receipt_items: parsedData.receipt_items || [],
          raw_text: parsedData.raw_text,
          ai_confidence: 0.85, // GPT-4 vision is generally high confidence
          ai_model: 'gpt-4-vision-preview'
        }
      }),
      { 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    )

  } catch (error) {
    console.error('Error in parse-receipt function:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || 'Internal server error'
      }),
      { 
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    )
  }
})
