import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { materialId, lowesUrl } = await req.json()

    if (!materialId || !lowesUrl) {
      throw new Error('Missing required parameters')
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get current material price for comparison
    const { data: material } = await supabaseClient
      .from('custom_materials')
      .select('price, name, company_id')
      .eq('id', materialId)
      .single()

    if (!material) {
      throw new Error('Material not found')
    }

    const oldPrice = material.price

    console.log(`Scraping Lowe's for: ${material.name}`)
    console.log(`URL: ${lowesUrl}`)

    // Fetch Lowe's page with proper headers
    const response = await fetch(lowesUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      }
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const html = await response.text()

    // Extract price using multiple methods (Lowe's changes their structure)
    let price = null
    let itemNumber = null

    // Method 1: Look for price in meta tags
    const priceMetaMatch = html.match(/<meta[^>]+property="product:price:amount"[^>]+content="([0-9.]+)"/i)
    if (priceMetaMatch) {
      price = parseFloat(priceMetaMatch[1])
    }

    // Method 2: Look for JSON-LD structured data
    if (!price) {
      const jsonLdMatch = html.match(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i)
      if (jsonLdMatch) {
        try {
          const jsonData = JSON.parse(jsonLdMatch[1])
          if (jsonData.offers && jsonData.offers.price) {
            price = parseFloat(jsonData.offers.price)
          }
        } catch (e) {
          console.log('Failed to parse JSON-LD:', e)
        }
      }
    }

    // Method 3: Look for price in common HTML patterns
    if (!price) {
      const pricePatterns = [
        /data-price="([0-9.]+)"/i,
        /class="[^"]*price[^"]*"[^>]*>\$?([0-9,]+\.[0-9]{2})/i,
        /"price":\s*"?([0-9.]+)"?/i,
      ]

      for (const pattern of pricePatterns) {
        const match = html.match(pattern)
        if (match) {
          price = parseFloat(match[1].replace(',', ''))
          break
        }
      }
    }

    // Extract item number
    const itemNumberMatch = html.match(/item\s*#?\s*:?\s*([0-9]+)/i)
    if (itemNumberMatch) {
      itemNumber = itemNumberMatch[1]
    }

    if (!price || price <= 0) {
      throw new Error('Could not extract price from page. Page structure may have changed.')
    }

    console.log(`Found price: $${price}`)
    console.log(`Item number: ${itemNumber || 'N/A'}`)

    // Calculate price change
    const priceChange = price - oldPrice
    const priceChangePercent = oldPrice > 0 ? (priceChange / oldPrice) * 100 : 0

    // Update material in database
    const { error: updateError } = await supabaseClient
      .from('custom_materials')
      .update({
        lowes_price: price,
        lowes_item_number: itemNumber,
        lowes_last_scraped: new Date().toISOString(),
        price: price, // Update current price
      })
      .eq('id', materialId)

    if (updateError) {
      throw updateError
    }

    // Log the price scrape
    await supabaseClient
      .from('price_scrape_logs')
      .insert({
        material_id: materialId,
        material_name: material.name,
        source: 'lowes',
        old_price: oldPrice,
        new_price: price,
        price_change: priceChange,
        price_change_percent: priceChangePercent,
        success: true,
        company_id: material.company_id,
      })

    return new Response(
      JSON.stringify({
        success: true,
        price,
        itemNumber,
        oldPrice,
        priceChange,
        priceChangePercent: priceChangePercent.toFixed(2),
        message: `Successfully updated price from $${oldPrice.toFixed(2)} to $${price.toFixed(2)}`,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Error scraping Lowes:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
