# DT Specialties — Vercel Deployment Guide

## Overview
DT Specialties runs on the **same codebase and same Supabase database** as DML.
Branding (purple/gold, "DT Specialties" name) is loaded automatically from the
`companies` table once a DT Specialties employee logs in.

---

## Step 1 — Run the SQL Setup
Open Supabase Dashboard → SQL Editor and run `DT_SPECIALTIES_SETUP.sql`.
This creates the company row with LSU Purple/Gold colors.

---

## Step 2 — Create the First Admin User
Go to the DML app at `/super-admin` (you must be logged in as a super admin).

Click **"Onboard New Company"** and fill in:
- Company Name: `DT Specialties`
- Slug: `dt-specialties`
- Primary Color: `#461D7C`
- Secondary Color: `#FDD023`
- Admin Email / Password / Name

This creates the Supabase Auth user AND the employee record automatically.

---

## Step 3 — Create a New Vercel Project

1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import the **same GitHub repo** (tradeflow / dml)
3. Name it something like `dt-specialties`
4. Set the **Root Directory** to the repo root (same as DML)
5. Framework: **Vite**

---

## Step 4 — Set Environment Variables on the New Vercel Project

In the new project's Settings → Environment Variables, add:

| Variable | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://hyhjxdgdetdqoyoscflu.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | *(same anon key as DML)* |
| `VITE_SITE_URL` | `https://dt-specialties.vercel.app` *(or your custom domain)* |
| `VITE_CLOVER_PUBLIC_KEY` | *(same as DML, or new key if different account)* |

---

## Step 5 — Deploy
Click **Deploy**. The app will build and go live at your new Vercel URL.

DT Specialties employees log in → they get:
- 🟣 **LSU Purple** header background (`#461D7C`)
- 🟡 **LSU Gold** accent / buttons (`#FDD023`)
- **"DT Specialties"** as the app name in the header and sign-in page
- All their own projects, invoices, employees — completely separate from DML data

DML employees log in → still see blue/orange, "TradeFlow" — nothing changed for them.

---

## Adding a Logo Later
When you have a logo for DT Specialties:
1. Upload it to Supabase Storage (bucket: `company-logos`) or any public URL
2. Run:
```sql
UPDATE companies
SET logo_url = 'https://your-logo-url.com/dt-logo.png'
WHERE slug = 'dt-specialties';
```
The logo will appear in the header and sign-in page automatically — no code change needed.

---

## Custom Domain (Optional)
In the Vercel project → Settings → Domains, add a custom domain like `app.dtspecialties.com`.
Update `VITE_SITE_URL` to match.
