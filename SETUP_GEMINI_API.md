# 🔐 Secure Gemini API Setup Guide

## ✅ What Has Been Done

1. ✅ Created secure backend API route (`/api/generate-questions`)
2. ✅ Updated frontend to use backend API (no more exposed keys!)
3. ✅ Updated `.gitignore` to protect environment files
4. ✅ Created `.env.local.example` template
5. ✅ Removed all hardcoded API keys from frontend code

## 🚀 Next Steps - What YOU Need to Do

### Step 1: Get a New Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click **"Create API Key"**
4. Copy the generated key

### Step 2: Create `.env.local` File

```bash
# In the project root directory, copy the example file:
cp .env.local.example .env.local
```

Or manually create a file named `.env.local` in the project root.

### Step 3: Add Your API Key

Open `.env.local` and add your new Gemini API key:

```env
GOOGLE_GEMINI_API_KEY=your_actual_api_key_here
```

**IMPORTANT:** Replace `your_actual_api_key_here` with the actual key you got from Step 1.

### Step 4: Add Other Required Environment Variables

Your `.env.local` should look like this:

```env
# Authentication
NEXTAUTH_SECRET=your-nextauth-secret
NEXTAUTH_URL=http://localhost:3000

# Google OAuth
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-secret

# Database
MONGODB_URI=your-mongodb-connection-string

# Gemini API (NEW - ADD THIS!)
GOOGLE_GEMINI_API_KEY=your_actual_gemini_api_key_here
```

### Step 5: Restart Development Server

```bash
# Stop the server (Ctrl+C) and restart:
npm run dev
```

### Step 6: Test the Vocabulary Quiz

1. Navigate to http://localhost:3000/games/vocab-quiz
2. Select vocabulary sections
3. Click "Start Quiz"
4. Questions should generate successfully! ✨

## 🔒 Security Features Implemented

### Backend API Route Protection
- ✅ API key stored server-side only (never exposed to browser)
- ✅ Requires user authentication (NextAuth session)
- ✅ Checks user authorization (access control list)
- ✅ Comprehensive error handling
- ✅ Request logging for monitoring

### Frontend Updates
- ✅ All API calls go through `/api/generate-questions`
- ✅ No direct calls to Gemini API from frontend
- ✅ No exposed API keys in browser code
- ✅ Better error messages for users

### File Protection
- ✅ `.env.local` in `.gitignore` (won't be committed)
- ✅ `.env.local.example` as template (safe to commit)
- ✅ Clear comments warning about secrets

## 📁 Files Changed

### New Files
- `src/app/api/generate-questions/route.ts` - Secure API route
- `.env.local.example` - Environment template
- `SECURITY_ALERT.md` - Security documentation
- `SETUP_GEMINI_API.md` - This file!

### Modified Files
- `src/app/games/vocab-quiz/page.tsx` - Uses backend API now
- `.gitignore` - Enhanced environment file protection

## 🧪 Testing Checklist

- [ ] Created `.env.local` file
- [ ] Added new Gemini API key to `.env.local`
- [ ] Added other required environment variables
- [ ] Restarted development server
- [ ] Vocabulary Quiz generates questions successfully
- [ ] Explanations generate successfully
- [ ] No API key visible in browser DevTools
- [ ] No console errors

## ⚠️ Important Security Notes

### DO NOT:
- ❌ Commit `.env.local` to git
- ❌ Share your API key publicly
- ❌ Include API keys in frontend code
- ❌ Push API keys to GitHub

### DO:
- ✅ Keep API keys in `.env.local`
- ✅ Use environment variables
- ✅ Rotate keys regularly
- ✅ Set up API restrictions in Google Cloud Console

## 🔧 Troubleshooting

### Issue: "GOOGLE_GEMINI_API_KEY is not configured"
**Solution:**
1. Make sure `.env.local` exists in project root
2. Check the variable name is exactly `GOOGLE_GEMINI_API_KEY`
3. Restart the development server

### Issue: "Authentication required"
**Solution:** Make sure you're logged in before trying to generate questions

### Issue: "API configuration error"
**Solution:**
1. Verify your API key is valid at [AI Studio](https://aistudio.google.com/app/apikey)
2. Check for any typos in `.env.local`
3. Ensure no extra spaces around the `=` sign

### Issue: Questions still not generating
**Solution:**
1. Check browser console for errors (F12)
2. Check server logs in terminal
3. Verify API key hasn't been disabled by Google
4. Try creating a fresh API key

## 📚 Additional Resources

- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
- [Google Gemini API Docs](https://ai.google.dev/docs)
- [Google AI Studio](https://aistudio.google.com/)
- [NextAuth.js Documentation](https://next-auth.js.org/)

## 🆘 Need Help?

If you encounter any issues:
1. Check this guide's troubleshooting section
2. Review `SECURITY_ALERT.md` for security context
3. Check the browser console and server logs
4. Verify all environment variables are set correctly

---

**Remember:** Your API key is like a password - keep it secret, keep it safe! 🔐
