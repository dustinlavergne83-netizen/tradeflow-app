# Quick Guide: Redeploy to Vercel

## 🚀 How to Update Your Live App

When you've made changes to your code and want to push them to your live Vercel site.

---

## Method 1: Git Push (If using GitHub) ⭐ EASIEST

If your Vercel is connected to GitHub, just push your changes:

```bash
# Stage your changes
git add .

# Commit with a message
git commit -m "Update app features"

# Push to GitHub
git push
```

**That's it!** Vercel will automatically:
1. Detect the push
2. Build your app
3. Deploy the new version
4. Update your live site

**Time:** 1-3 minutes

---

## Method 2: Vercel CLI (No Git needed)

If you're not using GitHub or want manual control:

```bash
# From your project directory
cd c:\Users\dusti\estimator-react

# Deploy to production
vercel --prod
```

**That's it!** Vercel will:
1. Build your app locally
2. Upload to Vercel
3. Deploy the new version

**Time:** 2-5 minutes

---

## Method 3: Vercel Dashboard

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click on your project
3. Go to **Deployments** tab
4. Click **Redeploy** on the latest deployment
5. Confirm

**Use this when:** You want to redeploy without any code changes (e.g., after updating environment variables)

---

## 📋 Full Workflow Example

### Scenario: You fixed a bug and want to deploy

```bash
# 1. Make your changes in VS Code
# (edit files, test locally with npm run dev)

# 2. Stage the changes
git add .

# 3. Commit with a descriptive message
git commit -m "Fix invoice calculation bug"

# 4. Push to GitHub (Vercel auto-deploys)
git push

# 5. Watch the deployment
# Go to vercel.com/dashboard or check your email
```

**Done in 30 seconds!** ⚡

---

## 🔍 Check Deployment Status

### Option 1: Email
- Vercel sends you an email when deployment starts and completes
- Check your email for "Deployment Ready" or "Deployment Failed"

### Option 2: Dashboard
- Go to [vercel.com/dashboard](https://vercel.com/dashboard)
- Click your project
- See deployment status in real-time

### Option 3: CLI
```bash
vercel logs
```

---

## ⚠️ Important Notes

### Your Changes Will Be Live Immediately
Once deployment completes, your changes are LIVE for all users.

**Before deploying:**
- ✅ Test locally with `npm run dev`
- ✅ Check that everything works
- ✅ Make sure you didn't break anything

### Environment Variables
If you added new environment variables:
1. Add them in Vercel Dashboard → Settings → Environment Variables
2. Redeploy for them to take effect

### Database Changes
If you made database changes:
1. Run migrations in Supabase first
2. Then deploy your app code

---

## 🐛 Troubleshooting

### Deployment Failed
1. Check your email for error details
2. Go to Vercel Dashboard → Deployments → Click failed deployment → View logs
3. Common issues:
   - Build errors (fix in your code)
   - Missing environment variables
   - Import errors

### Fix and Redeploy
```bash
# Fix the issue
# Then push again
git add .
git commit -m "Fix build error"
git push
```

### Changes Not Showing Up
1. **Hard refresh your browser:** Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
2. **Clear browser cache**
3. **Check deployment completed:** Vercel Dashboard
4. **Try incognito/private window**

### Rollback to Previous Version
1. Go to Vercel Dashboard
2. Deployments tab
3. Find the last working deployment
4. Click **⋮** menu → **Promote to Production**

---

## 📊 Monitoring Your Deployments

### View Recent Deployments
```bash
# List recent deployments
vercel ls
```

### View Logs
```bash
# View production logs
vercel logs

# View specific deployment logs
vercel logs <deployment-url>
```

### Check Build Time
- Go to Vercel Dashboard
- Each deployment shows build time and status
- Average build time: 1-3 minutes

---

## 🎯 Quick Commands Reference

```bash
# Deploy to production (auto-detects changes)
vercel --prod

# Deploy to preview (testing URL)
vercel

# View deployment logs
vercel logs

# List all deployments
vercel ls

# Redeploy latest without changes
vercel --prod --force

# Login to Vercel
vercel login

# Check Vercel CLI version
vercel --version
```

---

## 🔄 Typical Update Workflow

**For small fixes/updates:**
```bash
git add .
git commit -m "Quick fix"
git push
# Wait 2 minutes, refresh browser
```

**For major changes:**
```bash
# 1. Test thoroughly locally
npm run dev

# 2. Commit changes
git add .
git commit -m "Major feature update"

# 3. Push to GitHub
git push

# 4. Monitor deployment in Dashboard
# 5. Test live site thoroughly
# 6. Keep previous deployment URL handy for rollback if needed
```

---

## 📱 Mobile App Updates

**Note:** Mobile app (TradeFlow on Google Play) is separate!
- Web app: Deploys via Vercel (instant updates)
- Mobile app: Must be rebuilt and resubmitted to Google Play

To update mobile app:
```bash
cd timeclock-mobile
eas build --platform android
# Then submit to Google Play Console
```

---

## ✅ Post-Deployment Checklist

After each deployment:
- [ ] Visit your live site
- [ ] Test the feature you changed
- [ ] Test login still works
- [ ] Check mobile view (if relevant)
- [ ] Verify no console errors (F12 → Console)
- [ ] Test critical user flows
- [ ] Notify team of update (if needed)

---

## 💡 Pro Tips

**Preview Deployments**
Every branch gets its own preview URL! Great for testing before merging.

**Deployment Protection**
Enable in Vercel Settings → Git → Deployment Protection to require approval.

**Instant Rollback**
Always keep the previous deployment URL handy. One-click rollback if needed.

**Build Notifications**
Enable Slack/Discord notifications in Vercel settings for deployment updates.

---

## 🎉 Summary

**Most Common: Git Push Method**
```bash
git add .
git commit -m "Your changes"
git push
```

**Alternative: Vercel CLI**
```bash
vercel --prod
```

**That's it! Your live app is updated!** 🚀

---

**Your Vercel Dashboard:** [vercel.com/dashboard](https://vercel.com/dashboard)  
**Your Live App:** Check dashboard for URL
