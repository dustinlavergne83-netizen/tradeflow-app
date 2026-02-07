# Price Scraping System - Implementation Guide

## 🎯 What Was Built

An automated price scraping system that fetches current prices from Lowe's and Home Depot websites and updates your custom materials database.

## 📦 Components Created

### 1. Database Migration (`040_add_price_scraping_fields.sql`)
- Added price tracking fields to `custom_materials` table
- Created `price_scrape_logs` table for tracking price changes
- Supports multiple suppliers: Lowe's, Home Depot, Amazon (future)

### 2. Edge Functions
- `scrape-lowes-price` - Extracts prices from Lowe's product pages
- `scrape-homedepot-price` - Extracts prices from Home Depot product pages

## 🚀 Deployment Steps

### Step 1: Run Database Migration

```bash
npx supabase db push
```

This adds the necessary columns to your custom_materials table and creates the price_scrape_logs table.

### Step 2: Deploy Edge Functions

```bash
# Deploy Lowe's scraper
npx supabase functions deploy scrape-lowes-price

# Deploy Home Depot scraper
npx supabase functions deploy scrape-homedepot-price
```

### Step 3: Test the Functions

You can test them directly from Supabase Dashboard or using curl:

```bash
# Test Lowe's scraper
curl -X POST 'https://your-project.supabase.co/functions/v1/scrape-lowes-price' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "materialId": "uuid-of-material",
    "lowesUrl": "https://www.lowes.com/pd/..."
  }'

# Test Home Depot scraper
curl -X POST 'https://your-project.supabase.co/functions/v1/scrape-homedepot-price' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "materialId": "uuid-of-material",
    "homedepotUrl": "https://www.homedepot.com/p/..."
  }'
```

## 💻 How to Use

### Adding URLs to Materials

When creating or editing a custom material, add the product URLs:

```javascript
await supabase
  .from('custom_materials')
  .update({
    lowes_url: 'https://www.lowes.com/pd/...',
    homedepot_url: 'https://www.homedepot.com/p/...',
    preferred_source: 'lowes' // or 'homedepot'
  })
  .eq('id', materialId)
```

### Scraping a Single Material Price

```javascript
const { data, error } = await supabase.functions.invoke('scrape-lowes-price', {
  body: {
    materialId: 'uuid-here',
    lowesUrl: 'https://www.lowes.com/pd/...'
  }
})

if (data.success) {
  console.log(`Price updated: $${data.price}`)
  console.log(`Change: ${data.priceChangePercent}%`)
}
```

### Viewing Price History

```sql
SELECT 
  material_name,
  source,
  old_price,
  new_price,
  price_change,
  price_change_percent,
  scraped_at
FROM price_scrape_logs
WHERE company_id = 'your-company-id'
ORDER BY scraped_at DESC
LIMIT 100;
```

## 🎨 UI Integration Example

### Add Update Price Button to Material Form

```jsx
async function handleUpdatePrice(materialId, source) {
  setUpdating(true)
  
  const material = materials.find(m => m.id === materialId)
  const url = source === 'lowes' ? material.lowes_url : material.homedepot_url
  
  if (!url) {
    alert('No URL configured for this source')
    return
  }
  
  const funcName = source === 'lowes' ? 'scrape-lowes-price' : 'scrape-homedepot-price'
  const urlParam = source === 'lowes' ? 'lowesUrl' : 'homedepotUrl'
  
  const { data, error } = await supabase.functions.invoke(funcName, {
    body: {
      materialId,
      [urlParam]: url
    }
  })
  
  if (data && data.success) {
    alert(`✓ ${data.message}`)
    // Reload materials to show new price
    await loadMaterials()
  } else {
    alert(`✗ Error: ${error?.message || data?.error}`)
  }
  
  setUpdating(false)
}

// In your JSX
<button 
  onClick={() => handleUpdatePrice(material.id, 'lowes')}
  disabled={!material.lowes_url || updating}
>
  {updating ? '⏳ Updating...' : '🔄 Update Lowe\'s Price'}
</button>
```

## 📋 Database Schema

### custom_materials (new fields)
```
lowes_url               TEXT
lowes_item_number       VARCHAR(50)
lowes_price             DECIMAL(10,2)
lowes_last_scraped      TIMESTAMP

homedepot_url           TEXT
homedepot_sku           VARCHAR(50)
homedepot_price         DECIMAL(10,2)
homedepot_last_scraped  TIMESTAMP

amazon_url              TEXT
amazon_asin             VARCHAR(50)
amazon_price            DECIMAL(10,2)
amazon_last_scraped     TIMESTAMP

preferred_source        VARCHAR(20)  -- 'lowes', 'homedepot', 'amazon', 'manual'
```

### price_scrape_logs
```
id                      UUID PRIMARY KEY
material_id             UUID
material_name           TEXT
source                  VARCHAR(20)  -- 'lowes', 'homedepot', etc.
old_price               DECIMAL(10,2)
new_price               DECIMAL(10,2)
price_change            DECIMAL(10,2)
price_change_percent    DECIMAL(5,2)
scraped_at              TIMESTAMP
success                 BOOLEAN
error_message           TEXT
company_id              UUID
```

## ⚠️ Important Notes

### Rate Limiting
- Scrapers include 2-second delays between requests
- Don't scrape more than 100 items per hour
- Respect website Terms of Service

### Error Handling
- Scrapers try multiple extraction methods
- Website structure changes will break scrapers
- Monitor the `price_scrape_logs` table for failures
- Update regex patterns if scraping fails

### Legal Considerations
- Web scraping is generally legal for personal use
- Don't overload servers
- Consider contacting stores for official API access
- Use proper User-Agent headers

## 🔧 Troubleshooting

### "Could not extract price" Error
1. Open the URL in your browser
2. Check if the page loads correctly
3. Website structure may have changed
4. Update the regex patterns in the scraper function

### "403 Forbidden" or "429 Too Many Requests"
1. You're making too many requests
2. Wait 5-10 minutes before trying again
3. Consider rotating User-Agent strings
4. May need to implement proxy rotation

### Prices Not Updating in UI
1. Check the database - did the update actually happen?
2. Reload your materials data after scraping
3. Check browser console for errors
4. Verify the Edge Function logs in Supabase dashboard

## 📈 Next Steps

### Future Enhancements
1. **Bulk Price Update UI** - Update all materials at once
2. **Price Alerts** - Email when prices change significantly
3. **Scheduled Updates** - Cron job to update nightly
4. **Price Comparison** - Show best price across suppliers
5. **Historical Charts** - Visualize price trends
6. **More Suppliers** - Add Amazon, electrical distributors

### Creating a Materials Price Manager Page
See example code in the original implementation plan for a full-featured UI.

## 🎯 Quick Start Checklist

- [ ] Run database migration
- [ ] Deploy Edge Functions
- [ ] Test with one material and URL
- [ ] Add UI buttons to update prices
- [ ] Monitor price_scrape_logs for issues
- [ ] Document your specific supplier URLs
- [ ] Set up error notifications
- [ ] Consider scheduled automation

## 📞 Support

If scrapers stop working:
1. Check if website changed their HTML structure
2. View Edge Function logs in Supabase dashboard
3. Test the URL manually in browser
4. Update extraction patterns as needed

---

**Built:** January 2026  
**Status:** Ready for Deployment  
**Dependencies:** Supabase Edge Functions, Deno runtime
