# ⚡ Quick Start Guide - NEW API KEY

## 🎯 For Local Development

```bash
# 1. Copy the environment template
cp .env.local.example .env.local

# 2. Edit .env.local and add your new API key
# GOOGLE_GEMINI_API_KEY=your_actual_key_here

# 3. Restart the development server
npm run dev
```

## ☁️ For Vercel Production

### Method 1: Via Vercel Dashboard (Recommended)

1. Go to https://vercel.com/dashboard
2. Select your project
3. Click **Settings** → **Environment Variables**
4. Add variable:
   - Key: `GOOGLE_GEMINI_API_KEY`
   - Value: `your_new_api_key_here`
   - Environments: ✅ All three
5. Save and redeploy

### Method 2: Via Vercel CLI

```bash
# Install Vercel CLI (if not installed)
npm i -g vercel

# Login to Vercel
vercel login

# Add environment variable
vercel env add GOOGLE_GEMINI_API_KEY

# When prompted, enter your API key
# Select: Production, Preview, Development (all)

# Redeploy
vercel --prod
```

## 🧪 Testing

### Local Test
```bash
# Start dev server
npm run dev

# Open browser
http://localhost:3000/games/vocab-quiz

# Try generating questions
```

### Production Test
```bash
# Open your live site
https://vh-beyondthehorizons.vercel.app/games/vocab-quiz

# Try generating questions
```

## ✅ Checklist

### Local Setup
- [ ] Created `.env.local` file
- [ ] Added `GOOGLE_GEMINI_API_KEY=your_key`
- [ ] Restarted server
- [ ] Tested vocab quiz locally

### Vercel Setup
- [ ] Logged into Vercel dashboard
- [ ] Added `GOOGLE_GEMINI_API_KEY` to environment variables
- [ ] Selected all three environments
- [ ] Clicked Save
- [ ] Redeployed application
- [ ] Tested vocab quiz in production

## 🆘 If Something Goes Wrong

### Local Issues
```bash
# Check if .env.local exists
ls -la .env.local

# Check environment is loaded
npm run dev
# Look for "✓ Ready" message
```

### Vercel Issues
1. Check deployment logs in Vercel dashboard
2. Verify environment variable is set correctly
3. Try manual redeploy
4. Clear browser cache (Ctrl+Shift+R)

## 📞 Quick Links

- Get API Key: https://aistudio.google.com/app/apikey
- Vercel Dashboard: https://vercel.com/dashboard
- Full Guide: Read `VERCEL_DEPLOYMENT_GUIDE.md`
- Security Info: Read `SECURITY_ALERT.md`

---

**Time to complete:** ~5 minutes
**Ready?** Get your API key and let's go! 🚀
