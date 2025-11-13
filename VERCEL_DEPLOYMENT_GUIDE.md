# 🚀 Vercel Deployment Guide - Environment Variables

## 📝 Quick Summary

For Vercel, you need to:
1. Add your new Gemini API key to Vercel's dashboard
2. Redeploy your application
3. Test that it works in production

## 🔧 Step-by-Step Instructions

### Step 1: Access Your Vercel Project

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click on your project: **vh-beyondthehorizons** (or your project name)
3. Click on **"Settings"** tab at the top

### Step 2: Add Environment Variables

1. In Settings, click **"Environment Variables"** in the left sidebar
2. You'll see a form to add new environment variables

### Step 3: Add Your New Gemini API Key

Add this environment variable:

**Key:** `GOOGLE_GEMINI_API_KEY`
**Value:** `your_new_api_key_here` (paste your actual key)
**Environments:** Select **all three**: ✅ Production ✅ Preview ✅ Development

Click **"Save"**

### Step 4: Verify Existing Environment Variables

Make sure these are also set in Vercel (you probably already have them):

#### Required for Authentication
- ✅ `NEXTAUTH_SECRET` - Your NextAuth secret
- ✅ `NEXTAUTH_URL` - `https://vh-beyondthehorizons.vercel.app`
- ✅ `GOOGLE_CLIENT_ID` - Your Google OAuth client ID
- ✅ `GOOGLE_CLIENT_SECRET` - Your Google OAuth secret

#### Required for Database
- ✅ `MONGODB_URI` - Your MongoDB connection string

#### NEW - Required for Games
- ✅ `GOOGLE_GEMINI_API_KEY` - Your NEW Gemini API key ⚠️

### Step 5: Redeploy Your Application

After adding the environment variable, you have two options:

#### Option A: Automatic Redeploy (Recommended)
```bash
# Push your latest code to trigger automatic deployment
git add .
git commit -m "Implement secure API route for Gemini API"
git push origin main
```

#### Option B: Manual Redeploy
1. Go to "Deployments" tab in Vercel
2. Find the latest deployment
3. Click the three dots menu (⋯)
4. Click **"Redeploy"**
5. Check **"Use existing Build Cache"** (optional)
6. Click **"Redeploy"**

### Step 6: Test Production Deployment

1. Visit your live site: `https://vh-beyondthehorizons.vercel.app`
2. Log in
3. Go to **Vocabulary Quiz** (`/games/vocab-quiz`)
4. Select sections and try generating questions
5. Questions should generate successfully! ✨

## 🎯 Visual Guide - Vercel Dashboard

```
Vercel Dashboard
│
├── Select Your Project (vh-beyondthehorizons)
│
├── Settings Tab
│   │
│   └── Environment Variables
│       │
│       ├── Add New Variable
│       │   ├── Key: GOOGLE_GEMINI_API_KEY
│       │   ├── Value: [your_actual_key]
│       │   └── Environments: ✅ Production ✅ Preview ✅ Development
│       │
│       └── Click "Save"
│
└── Deployments Tab
    │
    └── Wait for automatic redeploy
        OR
        Click "Redeploy" manually
```

## 📋 Complete Environment Variables Checklist

### Authentication Variables
```
✅ NEXTAUTH_SECRET=your-secret-here
✅ NEXTAUTH_URL=https://vh-beyondthehorizons.vercel.app
✅ GOOGLE_CLIENT_ID=your-oauth-client-id
✅ GOOGLE_CLIENT_SECRET=your-oauth-secret
```

### Database Variables
```
✅ MONGODB_URI=mongodb+srv://...
```

### API Variables (NEW!)
```
✅ GOOGLE_GEMINI_API_KEY=your-new-gemini-key
```

### Optional Variables
```
⚪ EMAILJS_SERVICE_ID=your-emailjs-service
⚪ EMAILJS_TEMPLATE_ID=your-emailjs-template
⚪ EMAILJS_PUBLIC_KEY=your-emailjs-key
```

## 🔄 How It Works

### Local Development (.env.local)
```
Your Computer
│
├── .env.local
│   └── GOOGLE_GEMINI_API_KEY=your_key
│
└── npm run dev
    └── Reads from .env.local
```

### Vercel Production
```
Vercel Server
│
├── Environment Variables Dashboard
│   └── GOOGLE_GEMINI_API_KEY=your_key
│
└── Deployment
    └── Reads from Vercel's environment
```

## 🚨 Important Notes

### DO:
✅ Add the new API key to Vercel before deploying
✅ Select all three environments (Production, Preview, Development)
✅ Test in production after deployment
✅ Keep your API key secret

### DON'T:
❌ Commit `.env.local` to git
❌ Share your API key in public
❌ Use the old leaked API key
❌ Forget to redeploy after adding variables

## 🐛 Troubleshooting

### Issue: "GOOGLE_GEMINI_API_KEY is not configured" in Production

**Solution:**
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Check if `GOOGLE_GEMINI_API_KEY` is listed
3. If not, add it as described above
4. Redeploy the application

### Issue: Changes Not Reflecting

**Solution:**
1. Make sure you clicked "Save" in Vercel dashboard
2. Redeploy the application (Deployments tab → Redeploy)
3. Clear your browser cache (Ctrl+Shift+R or Cmd+Shift+R)
4. Check if you're on the latest deployment

### Issue: API Key Errors After Deployment

**Solution:**
1. Check the key in Vercel dashboard (Settings → Environment Variables)
2. Verify the key is valid at [Google AI Studio](https://aistudio.google.com/app/apikey)
3. Make sure there are no extra spaces in the key value
4. Try creating a fresh deployment

### Issue: Works Locally but Not on Vercel

**Solution:**
1. Ensure the environment variable name is EXACTLY: `GOOGLE_GEMINI_API_KEY`
2. Check that the variable is set for "Production" environment
3. Look at deployment logs: Deployments tab → Click on deployment → View Function Logs
4. Check for any error messages in the logs

## 📊 Deployment Checklist

Before going live, check:

- [ ] New Gemini API key created at Google AI Studio
- [ ] `GOOGLE_GEMINI_API_KEY` added to Vercel
- [ ] All three environments selected (Production, Preview, Development)
- [ ] Latest code pushed to GitHub (includes secure API route)
- [ ] Vercel automatic deployment completed successfully
- [ ] Vocabulary Quiz tested in production
- [ ] Questions generate successfully
- [ ] No errors in browser console
- [ ] No API key visible in browser DevTools

## 🎉 Success Indicators

You'll know it's working when:
- ✅ Vocabulary Quiz generates questions
- ✅ No "API key is not configured" errors
- ✅ Explanations appear after quiz completion
- ✅ No 500 errors in Vercel logs
- ✅ API key not visible in browser DevTools

## 📞 Need More Help?

### Check Vercel Logs
1. Go to your project in Vercel
2. Click "Deployments" tab
3. Click on the latest deployment
4. Scroll down to "Function Logs"
5. Look for any error messages

### Vercel Resources
- [Environment Variables Docs](https://vercel.com/docs/concepts/projects/environment-variables)
- [Deployment Docs](https://vercel.com/docs/concepts/deployments/overview)
- [Next.js on Vercel](https://vercel.com/docs/frameworks/nextjs)

---

**Remember:** Environment variables in Vercel are separate from your local `.env.local` file. You need to set them in BOTH places:
- Local development: `.env.local` file
- Production: Vercel dashboard

**Status:** Ready for deployment! 🚀
**Next Step:** Add your new API key to Vercel dashboard
