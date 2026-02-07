# Deploying to Vercel - Complete Guide

## 🚀 Deploy Your Estimator App to Production

This guide will walk you through deploying your React app to Vercel so it's live on the internet.

## 📋 Prerequisites

- Your app works locally (`npm run dev`)
- Supabase database is set up
- GitHub account (optional but recommended)

## 🎯 Option 1: Deploy via Vercel CLI (Fastest)

### Step 1: Install Vercel CLI

```bash
npm install -g vercel
```

### Step 2: Login to Vercel

```bash
vercel login
```

This will open your browser to login/signup with Vercel.

### Step 3: Deploy!

From your project directory:

```bash
cd c:\Users\dusti\estimator-react
vercel
```

**Follow the prompts:**
- Set up and deploy? **Y**
- Which scope? (Select your account)
- Link to existing project? **N**
- What's your project's name? `estimator-react` (or your choice)
- In which directory is your code located? `./` (press Enter)
- Want to override settings? **N**

**Vercel will:**
1. Build your project
2. Deploy it
3. Give you a live URL like: `https://estimator-react-xyz123.vercel.app`

### Step 4: Set Environment Variables

```bash
vercel env add VITE_SUPABASE_URL
# Paste: https://hyhjxdgdetdqoyoscflu.supabase.co

vercel env add VITE_SUPABASE_ANON_KEY
# Paste: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Step 5: Redeploy with Environment Variables

```bash
vercel --prod
```

**Done! Your app is live! 🎉**

---

## 🎯 Option 2: Deploy via GitHub (Recommended for Teams)

### Step 1: Push to GitHub

```bash
# Initialize git if not already done
git init
git add .
git commit -m "Ready for deployment"

# Create repo on GitHub, then:
git remote add origin https://github.com/your-username/estimator-react.git
git push -u origin main
```

### Step 2: Import to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New" → "Project"
3. Import your GitHub repository
4. Vercel auto-detects it's a Vite project

### Step 3: Configure Environment Variables

In Vercel dashboard:
1. Go to Project Settings → Environment Variables
2. Add:
   ```
   VITE_SUPABASE_URL = https://hyhjxdgdetdqoyoscflu.supabase.co
   VITE_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
3. Check "Production", "Preview", "Development"

### Step 4: Deploy

Click "Deploy" - Vercel builds and deploys automatically!

**Every git push will auto-deploy!** 🚀

---

## ⚙️ Vercel Configuration

Create `vercel.json` in your project root:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

This ensures proper routing for your React app.

---

## 🌐 Custom Domain Setup (Optional)

### Step 1: Buy Domain
- Namecheap, GoDaddy, Google Domains, etc.
- Example: `myestimator.com`

### Step 2: Add to Vercel

1. Go to Project Settings → Domains
2. Add your domain: `myestimator.com`
3. Vercel gives you DNS records

### Step 3: Update DNS

In your domain registrar:
```
Type: A
Name: @
Value: 76.76.21.21 (Vercel's IP)

Type: CNAME
Name: www
Value: cname.vercel-dns.com
```

Wait 24-48 hours for DNS propagation.

**Done! Your app is at your custom domain! 🎉**

---

## 🔧 Build Settings

Ensure your `package.json` has:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

And `vite.config.js`:

```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js']
        }
      }
    }
  }
})
```

---

## 📊 Monitoring & Analytics

### Add Vercel Analytics (Optional)

```bash
npm install @vercel/analytics
```

In `src/main.jsx`:

```javascript
import { Analytics } from '@vercel/analytics/react'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <Analytics />
  </React.StrictMode>
)
```

Redeploy to see analytics in Vercel dashboard.

---

## 🔒 Security Checklist

Before going live:

- [ ] Environment variables are set
- [ ] Supabase Row Level Security (RLS) is enabled
- [ ] Test all auth flows work
- [ ] Test database permissions
- [ ] Remove any console.logs with sensitive data
- [ ] Add error boundaries
- [ ] Test on mobile devices
- [ ] Set up error monitoring (Sentry optional)

---

## 🐛 Troubleshooting

### Build Fails

**Error:** `Build failed`
**Fix:** Check build logs, usually missing environment variables

```bash
# Test build locally first
npm run build
```

### Routes Don't Work (404 errors)

**Error:** Direct URLs return 404
**Fix:** Add `vercel.json` with rewrites (see above)

### Environment Variables Not Working

**Error:** `VITE_SUPABASE_URL is undefined`
**Fix:** 
1. Ensure variables start with `VITE_`
2. Redeploy after adding variables
3. Check they're set for "Production"

### Blank Page After Deploy

**Error:** White screen, no errors
**Fix:**
1. Check browser console
2. Verify Supabase connection
3. Check build output in Vercel logs

### Images Not Loading

**Error:** Images work locally but not in production
**Fix:** Use `/` paths for public assets
```javascript
// ❌ Wrong
<img src="./assets/logo.jpg" />

// ✅ Correct
<img src="/assets/logo.jpg" />
```

---

## 📈 Performance Optimization

### Enable Compression

Vercel automatically compresses assets.

### Add Loading States

```javascript
const [loading, setLoading] = useState(true)

useEffect(() => {
  loadData().finally(() => setLoading(false))
}, [])

if (loading) return <div>Loading...</div>
```

### Lazy Load Routes

```javascript
import { lazy, Suspense } from 'react'

const Estimate = lazy(() => import('./pages/Estimate'))

<Suspense fallback={<div>Loading...</div>}>
  <Routes>
    <Route path="/estimate" element={<Estimate />} />
  </Routes>
</Suspense>
```

---

## 🔄 Update Workflow

### After Making Changes:

**With GitHub:**
```bash
git add .
git commit -m "Update feature"
git push
# Vercel auto-deploys!
```

**With CLI:**
```bash
vercel --prod
```

### Rollback if Needed:

1. Go to Vercel dashboard
2. Deployments tab
3. Find previous good deployment
4. Click "Promote to Production"

---

## 📱 Mobile Access

Share your live URL:
- `https://your-app.vercel.app`
- Or your custom domain

Works on any device with a browser!

### Add to Home Screen (iOS/Android):

Users can add as a web app:
- iOS: Safari → Share → Add to Home Screen
- Android: Chrome → Menu → Add to Home Screen

---

## 🎯 Post-Deployment Checklist

- [ ] App loads at Vercel URL
- [ ] Login works
- [ ] Can create projects
- [ ] Can create estimates
- [ ] All pages accessible
- [ ] Mobile responsive
- [ ] Share URL with team
- [ ] Set up custom domain (optional)
- [ ] Enable analytics (optional)
- [ ] Bookmark Vercel dashboard

---

## 📞 Support & Resources

- **Vercel Docs:** [vercel.com/docs](https://vercel.com/docs)
- **Vercel Dashboard:** [vercel.com/dashboard](https://vercel.com/dashboard)
- **Build Logs:** Check in dashboard if deployment fails

---

## 🎉 Quick Start Commands

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Deploy to production
vercel --prod

# View logs
vercel logs

# Remove deployment
vercel rm estimator-react
```

---

**Your app will be live in minutes! 🚀**

After deployment, your URL will look like:
`https://estimator-react-xyz123.vercel.app`

Share it with your team and start using it in production!
