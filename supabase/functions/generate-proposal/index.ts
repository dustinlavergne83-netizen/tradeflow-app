// AI Proposal Generator - Supabase Edge Function
// This function uses OpenAI to generate professional proposal text

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
      projectName, 
      customerName,
      lineItems, 
      projectType = 'commercial',
      squareFootage,
      buildingType,
      additionalInstructions 
    } = await req.json()

    // Validate input
    if (!projectName || !lineItems || lineItems.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Initialize OpenAI
    const openai = new OpenAI({
      apiKey: Deno.env.get('OPENAI_API_KEY')
    })

    // Build the prompt with context
    const itemsList = lineItems
      .map(item => `- ${item.description}: ${item.quantity} ${item.unit}`)
      .join('\n')

    const prompt = `You are an expert electrical contractor writing a professional proposal.

Project Information:
- Project Name: ${projectName}
- Customer: ${customerName}
- Type: ${projectType}
${buildingType ? `- Building Type: ${buildingType}` : ''}
${squareFootage ? `- Square Footage: ${squareFootage} sq ft` : ''}

Scope of Work (Line Items):
${itemsList}

Task: Write a professional, detailed scope of work description (2-3 paragraphs) that:
1. Summarizes the electrical work to be performed
2. Highlights key features and quality standards
3. Is clear and easy for the customer to understand
4. Sounds professional and confident
5. Mentions specific items from the line items naturally
${additionalInstructions ? `\n\nADDITIONAL REQUIREMENTS: ${additionalInstructions}` : ''}

Keep it concise but thorough. Write in first person plural (we/our).`

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { 
          role: "system", 
          content: "You are a professional electrical contractor with 20 years of experience writing winning proposals." 
        },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 600
    })

    const generatedText = completion.choices[0].message.content

    return new Response(
      JSON.stringify({ 
        success: true,
        scopeOfWork: generatedText,
        tokensUsed: completion.usage?.total_tokens,
        cost: (completion.usage?.total_tokens || 0) * 0.00003 // Approximate GPT-4 cost
      }),
      { 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    )

  } catch (error) {
    console.error('Error in generate-proposal function:', error)
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        success: false 
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
