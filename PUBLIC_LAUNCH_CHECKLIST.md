# 🚀 TradeFlow Public Launch Checklist
> **Status:** AAB built, Privacy Policy done, Square account ready — solve 20-tester requirement + wire subscription payments  
> **App:** TradeFlow — GPS Time Clock (`com.tradeflowapp.timeclock`)  
> **Last Updated:** June 17, 2026

---

## WHERE THINGS STAND RIGHT NOW

| Item | Status |
|------|--------|
| App code (public version) | ✅ Built — `timeclock-mobile/public/` |
| Subscription screen UI | ✅ Done — shows plans, trial countdown |
| Trial / feature gating logic | ✅ Done — `useSubscription.ts` |
| Bank account | ✅ Ready |
| Square account | ✅ Ready |
| Privacy Policy | ✅ Done |
| Android build (.aab) | ✅ Built |
| Square webhook (invoice payments) | ✅ Working — but invoices ONLY |
| **Square webhook for subscriptions** | ❌ Not wired yet |
| **20 Google Play testers (14 days)** | ❌ This is your main blocker |
| Google Play listing submitted | ❌ Pending testers |
| iOS / App Store | ❌ Later |

---

## 🔴 BLOCKER #1 — Google Play 20 Testers

### What Google Requires
Google requires **20 testers** to opt into your closed test track and **actively use the app for 14 continuous days** before they will allow you to promote to production (public). This is mandatory for new apps.

### How to Get 20 Testers Fast

**Option A — Ask People You Know (Fastest)**
You only need 20 Gmail addresses. Ask:
- Family members
- Other electricians / contractors you know
- Employees' family members
- Friends who own iPhones still need a Gmail — anyone with a Google account counts
- They don't have to actively use it — they just need to **opt in and install it**

> Google tracks "opted in" users, not active daily users. Install = counts toward 14 days.

**Option B — Post Online (Free)**
Post in these places asking for beta testers:
- **Facebook**: "Hey! I built a time clock app for contractors. Anyone want to be a free beta tester? Just need to install it on Android. Takes 2 min."
- **Reddit**: r/electricians, r/Contractor, r/smallbusiness, r/androidapps
- **LinkedIn**: Post asking for beta testers in contractor / trades groups
- **Local trade Facebook groups**

**Option C — Use Your Employees**
If your DML Electric crew has Android phones, add them as internal testers for the public app. They use the DML app daily — they can also have the public app installed (different package: `com.tradeflowapp.timeclock`).

### The Exact Process in Google Play Console

1. In Google Play Console → your TradeFlow app → **Testing → Closed testing**
2. Click **"Create track"** → name it "Alpha"
3. Click **"Manage testers"** → add a **Google Group** email list, OR paste emails one by one
4. Click **"Copy link"** — send THIS link to your testers
5. Testers click the link → join the test → install the app from Play Store
6. After 20 testers have joined AND 14 days have passed → the **"Promote to production"** button unlocks

> ⚠️ The 14-day clock starts the moment your 20th tester opts in. Start TODAY.

### While You Wait 14 Days — Do These Things Now:
- ✅ Wire Square subscriptions (see below)
- ✅ Test the payment flow end-to-end
- ✅ Create Square payment links / subscription products
- ✅ Set up the Google Play store listing text, screenshots, etc.
- ✅ Create a demo account for Google's reviewers

---

## 🔴 BLOCKER #2 — Square Subscription Payments Not Wired

### Current State
Your existing `supabase/functions/square-webhook` handles `payment.updated` → marks **invoices** as paid. It does **NOT** handle subscription billing for the public TradeFlow app.

The subscription.tsx screen has placeholder URLs:
```ts
const STARTER_URL = "https://tradeflowllc.com/upgrade?plan=starter";
const PRO_URL     = "https://tradeflowllc.com/upgrade?plan=pro";
```
These need to point to real Square Payment Links.

### Step 1 — Create Square Subscription Products

In your **Square Dashboard → Online Store → Payment Links**:

Create two **recurring** payment links:

| Product | Price | Billing Period |
|---------|-------|---------------|
| TradeFlow Starter | $29.00 | Monthly |
| TradeFlow Pro | $49.00 | Monthly |

For each link:
- Set billing as **Recurring / Subscription**
- Add a redirect URL after payment: `https://tradeflowllc.com/thank-you`
- Copy the Payment Link URL

### Step 2 — Update the App with Real Payment URLs

Open `timeclock-mobile/public/app/subscription.tsx`, lines 28-29:

```ts
// Replace these:
const STARTER_URL = "https://tradeflowllc.com/upgrade?plan=starter";
const PRO_URL     = "https://tradeflowllc.com/upgrade?plan=pro";

// With your real Square payment links:
const STARTER_URL = "https://square.link/u/YOUR_STARTER_LINK";
const PRO_URL     = "https://square.link/u/YOUR_PRO_LINK";
```

### Step 3 — Extend the Square Webhook for Subscriptions

The current webhook at `supabase/functions/square-webhook/index.ts` only handles invoices.
You need to add subscription event handling.

**In Square Developer Console → Webhooks:**
Add these events to your existing webhook subscription:
- `subscription.created`
- `subscription.updated` 
- `invoice.payment_made` (Square sends this for recurring billing)

**Then update the webhook code** to handle subscriptions:

```typescript
// Add this block INSIDE the main try/catch in square-webhook/index.ts
// after the existing payment.updated handler:

if (event.type === 'subscription.updated' || event.type === 'subscription.created') {
  const subscription = event.data?.object?.subscription
  if (!subscription) {
    return new Response(JSON.stringify({ received: true }), { status: 200 })
  }

  const customerId = subscription.customer_id
  const planId = subscription.plan_id  // or plan_variation_id

  // Map your Square plan IDs to tiers
  // Get these IDs from Square Dashboard → Catalog → Subscriptions
  const STARTER_PLAN_ID = 'YOUR_SQUARE_STARTER_PLAN_ID'
  const PRO_PLAN_ID     = 'YOUR_SQUARE_PRO_PLAN_ID'

  let tier = 'starter'
  if (planId === PRO_PLAN_ID) tier = 'pro'

  let status = 'trial'
  if (subscription.status === 'ACTIVE') status = 'active'
  if (subscription.status === 'CANCELED') status = 'cancelled'
  if (subscription.status === 'DEACTIVATED') status = 'expired'

  // Look up company by Square customer ID
  const { data: company } = await supabase
    .from('companies')
    .select('id')
    .eq('square_customer_id', customerId)
    .single()

  if (company) {
    await supabase
      .from('companies')
      .update({
        subscription_tier: status === 'cancelled' ? 'trial' : tier,
        subscription_status: status,
      })
      .eq('id', company.id)
    console.log(`Updated company ${company.id} → tier: ${tier}, status: ${status}`)
  } else {
    console.warn(`No company found for Square customer ${customerId}`)
  }
}
```

### Step 4 — Add Square Columns to Companies Table

Run in Supabase SQL Editor:
```sql
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS square_customer_id text,
  ADD COLUMN IF NOT EXISTS square_subscription_id text,
  ADD COLUMN IF NOT EXISTS billing_email text;
```

### Step 5 — Link Customer Email to Company on Sign-Up

When a new company signs up, you need to:
1. Create a Square customer with their email
2. Store the `square_customer_id` in the companies table
3. Pre-fill the Square Payment Link with their email

In the payment link URL, Square supports pre-filling:
```ts
const STARTER_URL = `https://square.link/u/YOUR_LINK?email=${encodeURIComponent(companyEmail)}`;
```

The webhook then uses the Square customer ID (returned when they complete checkout) to find the right company row.

### Step 6 — Deploy the Updated Webhook
```bash
supabase functions deploy square-webhook
```

---

## ✅ Google Play Store Listing (Do This While Waiting for Testers)

### Store Listing Text
In Google Play Console → Store listing:

**Short description (80 chars):**
> GPS time clock built for trade contractors

**Full description:**
```
TradeFlow is the GPS time clock built specifically for electrical contractors, 
plumbers, HVAC technicians, and other trade businesses.

Stop chasing paper timesheets. TradeFlow automatically tracks when your crew 
clocks in and out, where they are, and what jobs they're working on.

FEATURES:
✅ GPS-verified clock in / clock out
✅ Live employee location map
✅ Job & project assignment
✅ Weekly timesheet reports
✅ Employee management
✅ 30-day free trial — no credit card required
✅ Cancel anytime

PLANS:
• Starter ($29/mo) — Up to 10 employees, full timeclock + reports
• Pro ($49/mo) — Up to 25 employees + AI assistant

Built by a working electrical contractor for the trades.
Try it free for 30 days.
```

### Assets Needed
| Asset | Size | Notes |
|-------|------|-------|
| App icon | 512x512 PNG | Already in assets/icon.png |
| Feature graphic | 1024x500 PNG | TradeFlow logo on blue (#0b3ea8) background |
| Phone screenshots | 1080x1920 (min 2) | Clock-in screen, timesheets, map |

### Test Account for Google Reviewers
Google's review team will try to log in to test your app.
Create a test account in Supabase:
- Email: `demo@tradeflowllc.com`
- Password: something simple you'll remember
- Set `subscription_tier: 'pro'` and `subscription_status: 'active'` in the companies table
- Add 2-3 fake employees so the app looks functional

Enter this in Play Console → **App content → Test instructions**

---

## ✅ End-to-End Payment Test (Before Going Live)

1. Open the app → Tap "Upgrade to Starter"
2. Complete payment with a Square test payment method
3. In Supabase → check `companies` table → `subscription_tier` should change to `starter`
4. Reopen app → trial banner should be gone, features unlocked
5. Test cancellation flow → status should go to `cancelled`

---

## LAUNCH ORDER (What to Do Right Now)

```
TODAY:
✅ Bank account — DONE
✅ Square account — DONE  
✅ AAB built — DONE
✅ Privacy Policy — DONE

DO NOW (while waiting for testers):
🔲 1. Create Square subscription payment links (Starter $29, Pro $49)
🔲 2. Update subscription.tsx with real Square payment link URLs
🔲 3. Add subscription event handling to square-webhook
🔲 4. Run the SQL to add square_customer_id column to companies
🔲 5. Deploy updated square-webhook function
🔲 6. Get 20 people to join your Google Play closed test → START THE 14-DAY CLOCK
🔲 7. Complete Google Play store listing (screenshots, description, feature graphic)
🔲 8. Create demo account for Google reviewers
🔲 9. Test full Square payment flow end-to-end

IN 14 DAYS (once tester requirement is met):
🔲 10. Promote from Closed Test → Production in Google Play Console
🔲 11. Switch Square to live/production mode
🔲 12. Announce launch! 🎉
```

---

## Quick Reference

| File | What to change |
|------|---------------|
| `timeclock-mobile/public/app/subscription.tsx` | Lines 28-29 — replace placeholder URLs with Square payment links |
| `supabase/functions/square-webhook/index.ts` | Add subscription.created/updated handlers |
| Supabase SQL Editor | Add square_customer_id column to companies |
| Google Play Console | Set up closed test track, get 20 testers |

---

## Pricing

| Plan | Price | Employees | Features |
|------|-------|-----------|----------|
| Trial | Free (30 days) | Up to 5 | Core timeclock |
| Starter | $29/mo | Up to 10 | Timeclock + reports + jobs |
| Pro | $49/mo | Up to 25 | Everything + AI assistant |
